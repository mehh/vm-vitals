//go:build darwin

package collect

import "testing"

func TestParseTopCPU(t *testing.T) {
	out := `Processes: 500 total
CPU usage: 50.0% user, 25.0% sys, 25.0% idle
...
CPU usage: 5.5% user, 4.5% sys, 90.0% idle
`
	p, ok := parseTopCPU(out)
	if !ok || p != 10 {
		t.Errorf("want 10 got %v %v", p, ok)
	}
}

func TestParseLoadavg(t *testing.T) {
	l, err := parseLoadavg("{ 1.50 2.25 3.00 }")
	if err != nil || l.L1 != 1.5 || l.L5 != 2.25 || l.L15 != 3 {
		t.Errorf("%+v %v", l, err)
	}
}

func TestParseSwapUsage(t *testing.T) {
	s, err := parseSwapUsage("total = 2048.00M  used = 512.00M  free = 1536.00M  (encrypted)")
	if err != nil || s.TotalB != 2048<<20 || s.UsedB != 512<<20 || s.Pct != 25 {
		t.Errorf("%+v %v", s, err)
	}
}

func TestMemFromVMStat(t *testing.T) {
	vm := `Mach Virtual Memory Statistics: (page size of 16384 bytes)
Pages free:                               1000.
Pages active:                             2000.
Pages inactive:                           500.
Pages wired down:                         1000.
Pages occupied by compressor:             1000.
`
	m := memFromVMStat(16384*8000, vm)
	if m.UsedB != 16384*4000 || m.Pct != 50 {
		t.Errorf("%+v", m)
	}
}
