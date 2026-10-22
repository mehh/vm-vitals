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

// An overlay-root container, like the Grok Bot box. Before the fix every
// mount was filtered and disks came out as JSON null.
func TestDiskMountsKeepsOverlayRoot(t *testing.T) {
	mounts := `overlay / overlay rw,relatime,lowerdir=/x,upperdir=/y,workdir=/z 0 0
proc /proc proc rw,nosuid,nodev,noexec,relatime 0 0
tmpfs /dev tmpfs rw,nosuid,size=65536k,mode=755 0 0
sysfs /sys sysfs ro,nosuid,nodev,noexec,relatime 0 0
cgroup /sys/fs/cgroup cgroup2 ro,nosuid,nodev,noexec,relatime 0 0
/dev/sda1 /etc/hosts ext4 rw,relatime 0 0
/dev/sda1 /data ext4 rw,relatime 0 0
`
	got := diskMounts(mounts)
	if len(got) != 2 {
		t.Fatalf("want 2 mounts got %d: %+v", len(got), got)
	}
	if got[0].mount != "/" || got[0].fstype != "overlay" {
		t.Errorf("root should be kept: %+v", got[0])
	}
	if got[1].mount != "/etc/hosts" {
		t.Errorf("first ext4 mount of sda1 wins: %+v", got[1])
	}
}

func TestDiskMountsRootfsRoot(t *testing.T) {
	got := diskMounts("rootfs / rootfs rw 0 0\n/dev/root / ext4 rw 0 0\n")
	if len(got) != 1 || got[0].mount != "/" || got[0].fstype != "rootfs" {
		t.Errorf("%+v", got)
	}
}

func TestDiskMountsNormalVM(t *testing.T) {
	mounts := `sysfs /sys sysfs rw 0 0
/dev/vda1 / ext4 rw,relatime 0 0
/dev/vda15 /boot/efi vfat rw 0 0
tmpfs /run tmpfs rw 0 0
/dev/loop0 /snap/core/1 squashfs ro 0 0
/dev/vdb /mnt/data xfs rw 0 0
`
	got := diskMounts(mounts)
	if len(got) != 2 || got[0].mount != "/" || got[1].mount != "/mnt/data" {
		t.Errorf("%+v", got)
	}
}

func TestDisksNeverNil(t *testing.T) {
	d, _ := disks()
	if d == nil {
		t.Fatal("disks() returned a nil slice")
	}
}
