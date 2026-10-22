package collect

import (
	"context"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"
	"time"
)

// Collector produces Reports. It keeps a little state between ticks (CPU
// counters, cached tool versions) so sampling is cheap.
type Collector struct {
	AgentVersion string

	mu        sync.Mutex
	prevCPU   cpuSample
	prevNet   netSample
	toolCache []Tool
	toolAt    time.Time
}

const toolCacheTTL = 10 * time.Minute

func New(version string) *Collector {
	return &Collector{AgentVersion: version}
}

// Collect gathers one report. Individual collector failures are recorded in
// Report.Warn rather than failing the whole tick.
func (c *Collector) Collect(ctx context.Context) *Report {
	c.mu.Lock()
	defer c.mu.Unlock()

	r := &Report{
		V:            1,
		At:           time.Now().UTC(),
		OS:           runtime.GOOS,
		Arch:         runtime.GOARCH,
		AgentVersion: c.AgentVersion,
	}
	r.Hostname, _ = os.Hostname()
	r.Kernel = kernelVersion()

	warn := func(what string, err error) {
		if err != nil {
			r.Warn = append(r.Warn, what+": "+err.Error())
		}
	}

	var err error
	r.UptimeS, err = uptime()
	warn("uptime", err)

	r.CPU, err = c.cpu()
	warn("cpu", err)
	r.CPU.Cores = runtime.NumCPU()

	r.Load, err = loadavg()
	warn("load", err)

	r.Mem, err = memory()
	warn("mem", err)

	r.Swap, err = swap()
	warn("swap", err)

	r.Disks, err = disks()
	warn("disks", err)

	procs, err := processes(ctx)
	warn("procs", err)
	r.Top = topProcs(procs, 8)
	r.Jobs = agentJobs(procs)

	r.OOM = oom()

	r.Net, err = c.net()
	warn("net", err)

	if time.Since(c.toolAt) > toolCacheTTL || c.toolCache == nil {
		c.toolCache = detectTools(ctx)
		c.toolAt = time.Now()
	}
	r.Tools = c.toolCache

	r.normalize()
	return r
}

// normalize makes sure every list field is a real (possibly empty) array.
// A nil slice marshals to JSON null, and the server rejects null for
// "disks" with "malformed report". Seen on Linux boxes whose root mount is
// overlay (containers, some cloud images), where no disk made the cut.
func (r *Report) normalize() {
	if r.Disks == nil {
		r.Disks = []Disk{}
	}
	if r.Top == nil {
		r.Top = []Proc{}
	}
	if r.Tools == nil {
		r.Tools = []Tool{}
	}
	if r.Jobs == nil {
		r.Jobs = []Job{}
	}
}

// run executes a command with a timeout and returns trimmed stdout.
func run(ctx context.Context, timeout time.Duration, name string, args ...string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = minimalEnv()
	out, err := cmd.Output()
	return strings.TrimSpace(string(out)), err
}

// minimalEnv gives child processes a tiny environment. We never read or ship
// our own env, and this keeps tool `--version` probes from seeing it either.
func minimalEnv() []string {
	path := os.Getenv("PATH")
	if path == "" {
		path = "/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin"
	}
	home := os.Getenv("HOME")
	env := []string{"PATH=" + path, "LANG=C", "LC_ALL=C", "NO_COLOR=1", "CI=1", "TERM=dumb"}
	if home != "" {
		env = append(env, "HOME="+home)
	}
	return env
}
