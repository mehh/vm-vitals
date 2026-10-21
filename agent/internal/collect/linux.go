//go:build linux

package collect

import (
	"bufio"
	"context"
	"errors"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type cpuSample struct {
	idle, total uint64
	at          time.Time
}

func kernelVersion() string {
	b, err := os.ReadFile("/proc/sys/kernel/osrelease")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(b))
}

func uptime() (int64, error) {
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0, err
	}
	f := strings.Fields(string(b))
	if len(f) < 1 {
		return 0, errors.New("bad /proc/uptime")
	}
	v, err := strconv.ParseFloat(f[0], 64)
	return int64(v), err
}

func readCPUSample() (cpuSample, error) {
	b, err := os.ReadFile("/proc/stat")
	if err != nil {
		return cpuSample{}, err
	}
	return parseProcStat(string(b))
}

func parseProcStat(s string) (cpuSample, error) {
	for _, line := range strings.Split(s, "\n") {
		if !strings.HasPrefix(line, "cpu ") {
			continue
		}
		f := strings.Fields(line)[1:]
		var total, idle uint64
		for i, v := range f {
			n, _ := strconv.ParseUint(v, 10, 64)
			total += n
			if i == 3 || i == 4 { // idle + iowait
				idle += n
			}
		}
		return cpuSample{idle: idle, total: total, at: time.Now()}, nil
	}
	return cpuSample{}, errors.New("no cpu line in /proc/stat")
}

func (c *Collector) cpu() (CPU, error) {
	cur, err := readCPUSample()
	if err != nil {
		return CPU{}, err
	}
	prev := c.prevCPU
	if prev.total == 0 || cur.total <= prev.total {
		// First tick: take a short second sample so we have a delta.
		time.Sleep(500 * time.Millisecond)
		prev = cur
		cur, err = readCPUSample()
		if err != nil {
			return CPU{}, err
		}
	}
	c.prevCPU = cur
	return CPU{Pct: cpuPct(prev, cur)}, nil
}

func cpuPct(prev, cur cpuSample) float64 {
	dt := float64(cur.total - prev.total)
	if dt <= 0 {
		return 0
	}
	di := float64(cur.idle - prev.idle)
	return round1((dt - di) / dt * 100)
}

func loadavg() (Load, error) {
	b, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return Load{}, err
	}
	f := strings.Fields(string(b))
	if len(f) < 3 {
		return Load{}, errors.New("bad /proc/loadavg")
	}
	l1, _ := strconv.ParseFloat(f[0], 64)
	l5, _ := strconv.ParseFloat(f[1], 64)
	l15, _ := strconv.ParseFloat(f[2], 64)
	return Load{L1: l1, L5: l5, L15: l15}, nil
}

func readMeminfo() (map[string]uint64, error) {
	b, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return nil, err
	}
	return parseMeminfo(string(b)), nil
}

// parseMeminfo returns values in bytes.
func parseMeminfo(s string) map[string]uint64 {
	m := map[string]uint64{}
	for _, line := range strings.Split(s, "\n") {
		k, v, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		f := strings.Fields(v)
		if len(f) == 0 {
			continue
		}
		n, _ := strconv.ParseUint(f[0], 10, 64)
		if len(f) > 1 && f[1] == "kB" {
			n *= 1024
		}
		m[k] = n
	}
	return m
}

func memory() (Mem, error) {
	m, err := readMeminfo()
	if err != nil {
		return Mem{}, err
	}
	return memFromMeminfo(m), nil
}

func memFromMeminfo(m map[string]uint64) Mem {
	total := m["MemTotal"]
	avail, ok := m["MemAvailable"]
	if !ok {
		avail = m["MemFree"] + m["Buffers"] + m["Cached"]
	}
	used := total - avail
	return Mem{TotalB: total, UsedB: used, AvailB: avail, Pct: pct(used, total)}
}

func swap() (Swap, error) {
	m, err := readMeminfo()
	if err != nil {
		return Swap{}, err
	}
	total := m["SwapTotal"]
	used := total - m["SwapFree"]
	return Swap{TotalB: total, UsedB: used, Pct: pct(used, total)}, nil
}

var skipFS = map[string]bool{
	"tmpfs": true, "devtmpfs": true, "sysfs": true, "proc": true, "cgroup": true, "cgroup2": true,
	"overlay": true, "squashfs": true, "devpts": true, "mqueue": true, "hugetlbfs": true,
	"debugfs": true, "tracefs": true, "securityfs": true, "pstore": true, "bpf": true,
	"autofs": true, "binfmt_misc": true, "configfs": true, "fusectl": true, "efivarfs": true,
	"nsfs": true, "ramfs": true, "rpc_pipefs": true, "fuse.snapfuse": true, "fuse.lxcfs": true,
}

func disks() ([]Disk, error) {
	f, err := os.Open("/proc/mounts")
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var out []Disk
	seen := map[string]bool{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 3 {
			continue
		}
		dev, mount, fstype := fields[0], fields[1], fields[2]
		if skipFS[fstype] || strings.HasPrefix(mount, "/snap/") || strings.HasPrefix(mount, "/boot/efi") {
			continue
		}
		if !strings.HasPrefix(dev, "/") && fstype != "zfs" && fstype != "nfs" && fstype != "nfs4" {
			continue
		}
		if seen[dev] && fstype != "zfs" {
			continue
		}
		var st syscall.Statfs_t
		if err := syscall.Statfs(mount, &st); err != nil {
			continue
		}
		total := st.Blocks * uint64(st.Bsize)
		free := st.Bavail * uint64(st.Bsize)
		if total == 0 {
			continue
		}
		seen[dev] = true
		used := total - free
		out = append(out, Disk{Mount: mount, FS: fstype, TotalB: total, UsedB: used, Pct: pct(used, total)})
	}
	return out, nil
}

func oom() OOM {
	o := OOM{Supported: true}
	if b, err := os.ReadFile("/proc/vmstat"); err == nil {
		for _, line := range strings.Split(string(b), "\n") {
			if strings.HasPrefix(line, "oom_kill ") {
				o.KillsTotal, _ = strconv.ParseInt(strings.TrimSpace(line[9:]), 10, 64)
			}
		}
	}
	// Best effort: recent kernel log lines. Needs journal access; silently
	// skipped otherwise.
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	out, err := run(ctx, 4*time.Second, "journalctl", "-k", "-q", "-o", "cat", "-n", "200", "--no-pager")
	if err == nil {
		o.Recent = parseOOMLines(out)
	}
	return o
}

// parseOOMLines keeps only "Killed process <pid> (<name>)" fragments.
func parseOOMLines(s string) []string {
	var out []string
	for _, line := range strings.Split(s, "\n") {
		i := strings.Index(line, "Killed process ")
		if i < 0 {
			continue
		}
		frag := line[i:]
		if j := strings.Index(frag, ")"); j >= 0 {
			frag = frag[:j+1]
		}
		out = append(out, frag)
	}
	if len(out) > 5 {
		out = out[len(out)-5:]
	}
	return out
}
