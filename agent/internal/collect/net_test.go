package collect

import "testing"

func TestParseProcNetDev(t *testing.T) {
	s := parseProcNetDev(`Inter-|   Receive                                                |  Transmit
 face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed
    lo: 1000 10 0 0 0 0 0 0 1000 10 0 0 0 0 0 0
  eth0: 5000 50 0 0 0 0 0 0 2000 20 0 0 0 0 0 0
 wlan0: 300 3 0 0 0 0 0 0 100 1 0 0 0 0 0 0
`)
	if s.rx != 5300 || s.tx != 2100 {
		t.Errorf("rx=%d tx=%d", s.rx, s.tx)
	}
}

func TestParseNetstatIB(t *testing.T) {
	s := parseNetstatIB(`Name       Mtu   Network       Address            Ipkts Ierrs     Ibytes    Opkts Oerrs     Obytes  Coll
lo0        16384 <Link#1>                          100     0      10000      100     0      10000     0
lo0        16384 127           127.0.0.1           100     -      10000      100     -      10000     -
en0        1500  <Link#11>   aa:bb:cc:dd:ee:ff    5000     0     700000     4000     0     300000     0
en0        1500  192.168.1     192.168.1.10       5000     -     700000     4000     -     300000     -
utun4      1400  <Link#20>                          10     0       2000        5     0       1000     0
`)
	if s.rx != 702000 || s.tx != 301000 {
		t.Errorf("rx=%d tx=%d", s.rx, s.tx)
	}
}

func TestNetRate(t *testing.T) {
	c := New("test")
	c.prevNet = netSample{rx: 1000, tx: 500, at: c.prevNet.at}
	if n, _ := rateFrom(netSample{rx: 1000, tx: 500}, netSample{rx: 4000, tx: 1500, at: c.prevNet.at}); n != nil {
		t.Error("zero dt should give nil")
	}
}
