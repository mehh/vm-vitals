//go:build linux

package collect

import "testing"

func TestParseMeminfo(t *testing.T) {
	m := parseMeminfo(`MemTotal:        8000000 kB
MemFree:         1000000 kB
MemAvailable:    3000000 kB
SwapTotal:       2000000 kB
SwapFree:        1500000 kB
HugePages_Total:       0
`)
	mem := memFromMeminfo(m)
	if mem.TotalB != 8000000*1024 || mem.AvailB != 3000000*1024 || mem.Pct != 62.5 {
		t.Errorf("%+v", mem)
	}
	if m["HugePages_Total"] != 0 {
		t.Error("non-kB value should parse as-is")
	}
}

func TestCPUPct(t *testing.T) {
	prev := cpuSample{idle: 100, total: 200}
	cur := cpuSample{idle: 150, total: 400}
	if got := cpuPct(prev, cur); got != 75 {
		t.Errorf("want 75 got %v", got)
	}
}

func TestParseProcStat(t *testing.T) {
	s, err := parseProcStat("cpu  10 0 10 70 10 0 0 0 0 0\ncpu0 1 2 3 4 5 6 7 8 9 10\n")
	if err != nil || s.total != 100 || s.idle != 80 {
		t.Errorf("%+v %v", s, err)
	}
}

func TestParseOOMLines(t *testing.T) {
	out := parseOOMLines(`some line
Out of memory: Killed process 1234 (node) total-vm:1kB, anon-rss:2kB, file-rss:0kB, shmem-rss:0kB, UID:1000 pgtables:8kB oom_score_adj:0
other`)
	if len(out) != 1 || out[0] != "Killed process 1234 (node)" {
		t.Errorf("%v", out)
	}
}
