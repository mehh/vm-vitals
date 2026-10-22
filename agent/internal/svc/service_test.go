//go:build unix

package svc

import (
	"strings"
	"testing"
)

func TestMergeCrontabReplacesOurLine(t *testing.T) {
	existing := "MAILTO=\"\"\n0 3 * * * /usr/bin/backup\n@reboot /old/vm-vitals run --config /old.json >> /old.log 2>&1 # vm-vitals\n\n"
	o := InstallOpts{BinPath: "/home/bot/.local/bin/vm-vitals", ConfigFile: "/home/bot/.config/vm-vitals/config.json", LogDir: "/home/bot/.local/state/vm-vitals"}
	got := mergeCrontab(existing, cronLine(o))
	want := "MAILTO=\"\"\n0 3 * * * /usr/bin/backup\n@reboot /home/bot/.local/bin/vm-vitals run --config /home/bot/.config/vm-vitals/config.json >> /home/bot/.local/state/vm-vitals/agent.log 2>&1 # vm-vitals\n"
	if got != want {
		t.Errorf("got:\n%s\nwant:\n%s", got, want)
	}
	if strings.Count(got, cronTag) != 1 {
		t.Errorf("exactly one tagged line expected")
	}
}

func TestMergeCrontabEmptyAndRemove(t *testing.T) {
	o := InstallOpts{BinPath: "/b", ConfigFile: "/c", LogDir: "/l"}
	got := mergeCrontab("", cronLine(o))
	if got != cronLine(o)+"\n" {
		t.Errorf("%q", got)
	}
	if mergeCrontab(got, "") != "" {
		t.Errorf("removing our only line should leave an empty crontab: %q", mergeCrontab(got, ""))
	}
	if mergeCrontab("0 1 * * * x\n"+got, "") != "0 1 * * * x\n" {
		t.Errorf("other lines must survive removal")
	}
}

func TestSystemdAvailableWithoutUserBus(t *testing.T) {
	if IsRoot() {
		t.Skip("user-scope check")
	}
	t.Setenv("XDG_RUNTIME_DIR", "")
	t.Setenv("DBUS_SESSION_BUS_ADDRESS", "")
	if systemdAvailable() {
		t.Error("no XDG_RUNTIME_DIR and no D-Bus address must mean no user systemd")
	}
}
