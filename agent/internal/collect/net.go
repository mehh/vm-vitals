package collect

import (
	"strconv"
	"strings"
	"time"
)

// netSample is a cumulative byte counter snapshot across all non-loopback
// interfaces. Rates are derived from two samples a tick apart.
type netSample struct {
	rx, tx uint64
	at     time.Time
}

// net returns throughput since the previous tick. The first tick has no
// baseline and returns nil (the field is omitted from the report).
func (c *Collector) net() (*Net, error) {
	cur, err := readNetSample()
	if err != nil {
		return nil, err
	}
	prev := c.prevNet
	if prev.at.IsZero() {
		// First tick: take a short second sample so even `vm-vitals once`
		// reports a rate instead of nothing.
		prev = cur
		time.Sleep(time.Second)
		if cur, err = readNetSample(); err != nil {
			return nil, err
		}
	}
	c.prevNet = cur
	return rateFrom(prev, cur)
}

func rateFrom(prev, cur netSample) (*Net, error) {
	if prev.at.IsZero() || cur.rx < prev.rx || cur.tx < prev.tx {
		return nil, nil
	}
	dt := cur.at.Sub(prev.at).Seconds()
	if dt <= 0 {
		return nil, nil
	}
	return &Net{
		RxBps:    round1(float64(cur.rx-prev.rx) / dt),
		TxBps:    round1(float64(cur.tx-prev.tx) / dt),
		RxTotalB: cur.rx,
		TxTotalB: cur.tx,
	}, nil
}

// parseProcNetDev sums rx/tx bytes from /proc/net/dev, skipping loopback.
func parseProcNetDev(s string) netSample {
	var out netSample
	for _, line := range strings.Split(s, "\n") {
		name, rest, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		name = strings.TrimSpace(name)
		if name == "lo" || name == "" {
			continue
		}
		f := strings.Fields(rest)
		if len(f) < 9 {
			continue
		}
		rx, _ := strconv.ParseUint(f[0], 10, 64)
		tx, _ := strconv.ParseUint(f[8], 10, 64)
		out.rx += rx
		out.tx += tx
	}
	out.at = time.Now()
	return out
}

// parseNetstatIB sums Ibytes/Obytes from `netstat -ib` link rows (one per
// interface), skipping lo0. Address rows for the same interface are ignored
// so bytes are not double counted.
func parseNetstatIB(s string) netSample {
	var out netSample
	for _, line := range strings.Split(s, "\n") {
		f := strings.Fields(line)
		if len(f) < 10 || f[0] == "Name" || strings.HasPrefix(f[0], "lo") {
			continue
		}
		if !strings.HasPrefix(f[2], "<Link#") {
			continue
		}
		// Name Mtu Network Address Ipkts Ierrs Ibytes Opkts Oerrs Obytes Coll
		// Address may be missing (e.g. utun), shifting columns left by one.
		var rxIdx, txIdx int
		if len(f) >= 11 {
			rxIdx, txIdx = 6, 9
		} else {
			rxIdx, txIdx = 5, 8
		}
		rx, _ := strconv.ParseUint(f[rxIdx], 10, 64)
		tx, _ := strconv.ParseUint(f[txIdx], 10, 64)
		out.rx += rx
		out.tx += tx
	}
	out.at = time.Now()
	return out
}
