//go:build unix

package svc

import (
	"os"
	"path/filepath"
	"testing"
)

func TestUninstallRemovesEverythingAndIsRepeatable(t *testing.T) {
	if IsRoot() {
		t.Skip("user-scope check")
	}
	home := t.TempDir()
	t.Setenv("HOME", home) // keep launchctl/systemctl paths inside the temp dir
	p := Paths{Scope: "user", BinDir: filepath.Join(home, "bin"), ConfigDir: filepath.Join(home, "cfg"), LogDir: filepath.Join(home, "logs")}
	p.ConfigFile = filepath.Join(p.ConfigDir, "config.json")
	for _, d := range []string{p.BinDir, p.ConfigDir, p.LogDir} {
		if err := os.MkdirAll(d, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	files := []string{filepath.Join(p.BinDir, "vm-vitals"), p.ConfigFile, filepath.Join(p.LogDir, "agent.log")}
	for _, f := range files {
		if err := os.WriteFile(f, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	done, err := Uninstall(p)
	if err != nil {
		t.Fatal(err)
	}
	if len(done) < 3 {
		t.Errorf("expected binary, config and logs in the report, got %v", done)
	}
	for _, f := range append(files, p.ConfigDir, p.LogDir) {
		if _, err := os.Stat(f); !os.IsNotExist(err) {
			t.Errorf("%s still exists", f)
		}
	}
	again, err := Uninstall(p)
	if err != nil || len(again) != 0 {
		t.Errorf("second run should be a no-op, got %v, %v", again, err)
	}
}

func TestLaunchdStateKeepsFirstOfEach(t *testing.T) {
	out := "gui/501/com.vmvitals.agent = {\n\tactive count = 1\n\tstate = running\n\tpid = 55968\n\tendpoint = {\n\t\tstate = active\n\t}\n\tstate = active\n}"
	if got := launchdState(out); got != "state = running, pid = 55968" {
		t.Errorf("got %q", got)
	}
}
