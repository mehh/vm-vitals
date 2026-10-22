//go:build darwin

package collect

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type cpuSample struct{} // unused on macOS; we sample via top

func kernelVersion() string {
	ctx := context.Background()
	out, _ := run(ctx, 3*time.Second, "sysctl", "-n", "kern.osproductversion")
	if out != "" {
		return "macOS " + out
	}
	out, _ = run(ctx, 3*time.Second, "uname", "-r")
	return out
}

var bootRe = regexp.MustCompile(`sec = (\d+)`)

func uptime() (int64, error) {
	out, err := run(context.Background(), 3*time.Second, "sysctl", "-n", "kern.boottime")
	if err != nil {
		return 0, err
	}
	m := bootRe.FindStringSubmatch(out)
	if m == nil {
		return 0, errors.New("bad kern.boottime")
	}
	sec, _ := strconv.ParseInt(m[1], 10, 64)
	return time.Now().Unix() - sec, nil
}

var topCPURe = regexp.MustCompile(`CPU usage: ([\d.]+)% user, ([\d.]+)% sys, ([\d.]+)% idle`)

func (c *Collector) cpu() (CPU, error) {
	// Two samples; the first is a since-boot average, the second is live.
	out, err := run(context.Background(), 6*time.Second, "top", "-l", "2", "-n", "0", "-s", "1")
	if err != nil {
		return CPU{}, err
	}
	p, ok := parseTopCPU(out)
	if !ok {
		return CPU{}, errors.New("no CPU usage line from top")
	}
	return CPU{Pct: p}, nil
}

func parseTopCPU(out string) (float64, bool) {
	all := topCPURe.FindAllStringSubmatch(out, -1)
	if len(all) == 0 {
		return 0, false
	}
	m := all[len(all)-1]
	idle, _ := strconv.ParseFloat(m[3], 64)
	return round1(100 - idle), true
}

func loadavg() (Load, error) {
	out, err := run(context.Background(), 3*time.Second, "sysctl", "-n", "vm.loadavg")
	if err != nil {
		return Load{}, err
	}
	return parseLoadavg(out)
}

func parseLoadavg(s string) (Load, error) {
	f := strings.Fields(strings.Trim(s, "{} "))
	if len(f) < 3 {
		return Load{}, errors.New("bad vm.loadavg")
	}
	l1, _ := strconv.ParseFloat(f[0], 64)
	l5, _ := strconv.ParseFloat(f[1], 64)
	l15, _ := strconv.ParseFloat(f[2], 64)
	return Load{L1: l1, L5: l5, L15: l15}, nil
}

var vmStatRe = regexp.MustCompile(`^(.+?):\s+(\d+)\.?$`)

func memory() (Mem, error) {
	ctx := context.Background()
	totalS, err := run(ctx, 3*time.Second, "sysctl", "-n", "hw.memsize")
	if err != nil {
		return Mem{}, err
	}
	total, _ := strconv.ParseUint(totalS, 10, 64)
	vm, err := run(ctx, 3*time.Second, "vm_stat")
	if err != nil {
		return Mem{}, err
	}
	return memFromVMStat(total, vm), nil
}

func memFromVMStat(total uint64, vm string) Mem {
	pageSize := uint64(16384)
	if m := regexp.MustCompile(`page size of (\d+) bytes`).FindStringSubmatch(vm); m != nil {
		pageSize, _ = strconv.ParseUint(m[1], 10, 64)
	}
	stats := map[string]uint64{}
	for _, line := range strings.Split(vm, "\n") {
		if m := vmStatRe.FindStringSubmatch(strings.TrimSpace(line)); m != nil {
			n, _ := strconv.ParseUint(m[2], 10, 64)
			stats[m[1]] = n * pageSize
		}
	}
	// Activity Monitor's "Memory Used" = app memory (active+speculative-ish) +
	// wired + compressed. We use active + wired + compressed as a stable proxy.
	used := stats["Pages active"] + stats["Pages wired down"] + stats["Pages occupied by compressor"]
	if used > total {
		used = total
	}
	return Mem{TotalB: total, UsedB: used, AvailB: total - used, Pct: pct(used, total)}
}

var swapRe = regexp.MustCompile(`total = ([\d.]+)([KMG]) +used = ([\d.]+)([KMG])`)

func swap() (Swap, error) {
	out, err := run(context.Background(), 3*time.Second, "sysctl", "-n", "vm.swapusage")
	if err != nil {
		return Swap{}, err
	}
	return parseSwapUsage(out)
}

func parseSwapUsage(s string) (Swap, error) {
	m := swapRe.FindStringSubmatch(s)
	if m == nil {
		return Swap{}, errors.New("bad vm.swapusage")
	}
	total := toBytes(m[1], m[2])
	used := toBytes(m[3], m[4])
	return Swap{TotalB: total, UsedB: used, Pct: pct(used, total)}, nil
}

func toBytes(num, unit string) uint64 {
	f, _ := strconv.ParseFloat(num, 64)
	switch unit {
	case "K":
		f *= 1 << 10
	case "M":
		f *= 1 << 20
	case "G":
		f *= 1 << 30
	}
	return uint64(f)
}

func disks() ([]Disk, error) {
	mounts := []string{"/"}
	if entries, err := os.ReadDir("/Volumes"); err == nil {
		for _, e := range entries {
			mounts = append(mounts, filepath.Join("/Volumes", e.Name()))
		}
	}
	var out []Disk
	seen := map[[2]int32]bool{}
	for _, m := range mounts {
		var st syscall.Statfs_t
		if err := syscall.Statfs(m, &st); err != nil {
			continue
		}
		if seen[st.Fsid.Val] {
			continue
		}
		seen[st.Fsid.Val] = true
		total := st.Blocks * uint64(st.Bsize)
		free := st.Bavail * uint64(st.Bsize)
		if total == 0 {
			continue
		}
		used := total - free
		fs := cstr(st.Fstypename[:])
		if m != "/" && (fs == "autofs" || fs == "devfs") {
			continue
		}
		out = append(out, Disk{Mount: m, FS: fs, TotalB: total, UsedB: used, Pct: pct(used, total)})
	}
	return out, nil
}

// macOS has no OOM killer in the Linux sense (jetsam is the nearest thing and
// is not exposed cleanly). Report unsupported so the UI says so.
func oom() OOM { return OOM{Supported: false} }

func cstr(b []int8) string {
	out := make([]byte, 0, len(b))
	for _, c := range b {
		if c == 0 {
			break
		}
		out = append(out, byte(c))
	}
	return string(out)
}

func readNetSample() (netSample, error) {
	out, err := run(context.Background(), 3*time.Second, "netstat", "-ib")
	if err != nil {
		return netSample{}, err
	}
	return parseNetstatIB(out), nil
}
