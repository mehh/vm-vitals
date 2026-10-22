// Package collect gathers machine health. Everything in a Report is safe to
// publish: numbers, mount points, process *names* (never arguments), and the
// version strings of well-known CLI tools. No env vars, no file contents, no
// command-line arguments ever leave the box.
package collect

import "time"

// Report is the payload posted to the server every tick.
type Report struct {
	V            int       `json:"v"`
	At           time.Time `json:"at"`
	Hostname     string    `json:"hostname"`
	OS           string    `json:"os"`
	Arch         string    `json:"arch"`
	Kernel       string    `json:"kernel,omitempty"`
	UptimeS      int64     `json:"uptime_s"`
	AgentVersion string    `json:"agent_version"`

	CPU   CPU      `json:"cpu"`
	Load  Load     `json:"load"`
	Mem   Mem      `json:"mem"`
	Swap  Swap     `json:"swap"`
	Disks []Disk   `json:"disks"`
	Top   []Proc   `json:"top_procs"`
	OOM   OOM      `json:"oom"`
	Tools []Tool   `json:"tools"`
	Jobs  []Job    `json:"jobs"`
	Net   *Net     `json:"net,omitempty"`      // nil on the first tick (no baseline yet)
	Warn  []string `json:"warnings,omitempty"` // collector errors, best-effort
}

// Net is throughput across all non-loopback interfaces since the last tick.
type Net struct {
	RxBps    float64 `json:"rx_bps"`
	TxBps    float64 `json:"tx_bps"`
	RxTotalB uint64  `json:"rx_total_b"`
	TxTotalB uint64  `json:"tx_total_b"`
}

type CPU struct {
	Pct   float64 `json:"pct"`
	Cores int     `json:"cores"`
}

type Load struct {
	L1  float64 `json:"l1"`
	L5  float64 `json:"l5"`
	L15 float64 `json:"l15"`
}

type Mem struct {
	TotalB uint64  `json:"total_b"`
	UsedB  uint64  `json:"used_b"`
	AvailB uint64  `json:"avail_b"`
	Pct    float64 `json:"pct"`
}

type Swap struct {
	TotalB uint64  `json:"total_b"`
	UsedB  uint64  `json:"used_b"`
	Pct    float64 `json:"pct"`
}

type Disk struct {
	Mount  string  `json:"mount"`
	FS     string  `json:"fs,omitempty"`
	TotalB uint64  `json:"total_b"`
	UsedB  uint64  `json:"used_b"`
	Pct    float64 `json:"pct"`
}

// Proc is a process summary. Name is the executable's basename only.
type Proc struct {
	PID    int     `json:"pid"`
	Name   string  `json:"name"`
	CPUPct float64 `json:"cpu_pct"`
	MemPct float64 `json:"mem_pct"`
	RSSB   uint64  `json:"rss_b"`
}

type OOM struct {
	Supported  bool     `json:"supported"`
	KillsTotal int64    `json:"kills_total"` // cumulative since boot (Linux)
	Recent     []string `json:"recent,omitempty"`
}

type Tool struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Version string `json:"version,omitempty"`
}

// Job is a running AI-agent process (claude, codex, aider, ...).
type Job struct {
	Name     string  `json:"name"` // matched tool name, e.g. "claude"
	Kind     string  `json:"kind"` // display label, e.g. "Claude Code"
	PID      int     `json:"pid"`
	CPUPct   float64 `json:"cpu_pct"`
	RSSB     uint64  `json:"rss_b"`
	ElapsedS int64   `json:"elapsed_s"`
}

func pct(used, total uint64) float64 {
	if total == 0 {
		return 0
	}
	return round1(float64(used) / float64(total) * 100)
}

func round1(f float64) float64 {
	return float64(int(f*10+0.5)) / 10
}
