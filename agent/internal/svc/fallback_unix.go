//go:build unix

package svc

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// Fallback supervisor for Linux boxes without a usable systemd: containers,
// minimal images, or a user session with no D-Bus / XDG_RUNTIME_DIR, where
// `systemctl --user` just says "Failed to connect to bus". We start the agent
// detached (nohup-style) right now and add a cron @reboot line so it comes
// back after a restart. Neither is as good as systemd, but the box reports.

const cronTag = "# vm-vitals"

func pidFile(logDir string) string { return filepath.Join(logDir, "agent.pid") }
func logFile(logDir string) string { return filepath.Join(logDir, "agent.log") }

// systemdAvailable reports whether `systemctl` (system scope as root, user
// scope otherwise) can actually talk to a running systemd.
func systemdAvailable() bool {
	if _, err := exec.LookPath("systemctl"); err != nil {
		return false
	}
	if IsRoot() {
		st, err := os.Stat("/run/systemd/system")
		return err == nil && st.IsDir()
	}
	if os.Getenv("XDG_RUNTIME_DIR") == "" && os.Getenv("DBUS_SESSION_BUS_ADDRESS") == "" {
		return false
	}
	cmd := exec.Command("systemctl", "--user", "show-environment")
	cmd.Stdout, cmd.Stderr = nil, nil
	return cmd.Run() == nil
}

// installFallback starts the agent detached and registers a cron @reboot
// line. It returns a description for the "Service installed" message.
func installFallback(o InstallOpts) (string, error) {
	_ = os.MkdirAll(o.LogDir, 0o755)
	stopFallback(o.LogDir)

	pid, err := startDetached(o)
	if err != nil {
		return "", fmt.Errorf("start agent: %w", err)
	}
	_ = os.WriteFile(pidFile(o.LogDir), []byte(strconv.Itoa(pid)+"\n"), 0o644)

	how := fmt.Sprintf("background process pid %d, log %s", pid, logFile(o.LogDir))
	if err := installCron(o); err != nil {
		how += "; cron @reboot not added (" + err.Error() + "), re-run install after a reboot"
	} else {
		how += ", cron @reboot entry"
	}
	return how, nil
}

func startDetached(o InstallOpts) (int, error) {
	lf, err := os.OpenFile(logFile(o.LogDir), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return 0, err
	}
	defer lf.Close()
	cmd := exec.Command(o.BinPath, "run", "--config", o.ConfigFile)
	cmd.Stdin = nil
	cmd.Stdout = lf
	cmd.Stderr = lf
	cmd.Dir = "/"
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true} // survive our exit and the shell's HUP
	if err := cmd.Start(); err != nil {
		return 0, err
	}
	pid := cmd.Process.Pid
	_ = cmd.Process.Release()
	// Give it a moment to fail fast (bad config, missing binary).
	time.Sleep(300 * time.Millisecond)
	if err := syscall.Kill(pid, 0); err != nil {
		return 0, fmt.Errorf("agent exited immediately; see %s", logFile(o.LogDir))
	}
	return pid, nil
}

// stopFallback kills a previously started detached agent, if any.
func stopFallback(logDir string) {
	b, err := os.ReadFile(pidFile(logDir))
	if err != nil {
		return
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(b)))
	if err != nil || pid <= 1 {
		return
	}
	_ = syscall.Kill(pid, syscall.SIGTERM)
	for i := 0; i < 20; i++ {
		if syscall.Kill(pid, 0) != nil {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	_ = os.Remove(pidFile(logDir))
}

func cronLine(o InstallOpts) string {
	return fmt.Sprintf("@reboot %s run --config %s >> %s 2>&1 %s", o.BinPath, o.ConfigFile, logFile(o.LogDir), cronTag)
}

// mergeCrontab returns existing with any previous vm-vitals line replaced by
// line (or appended if there was none). Blank trailing lines are kept tidy.
func mergeCrontab(existing, line string) string {
	var out []string
	for _, l := range strings.Split(existing, "\n") {
		if strings.HasSuffix(strings.TrimSpace(l), cronTag) {
			continue
		}
		out = append(out, l)
	}
	for len(out) > 0 && strings.TrimSpace(out[len(out)-1]) == "" {
		out = out[:len(out)-1]
	}
	if line != "" {
		out = append(out, line)
	}
	if len(out) == 0 {
		return ""
	}
	return strings.Join(out, "\n") + "\n"
}

func readCrontab() (string, error) {
	if _, err := exec.LookPath("crontab"); err != nil {
		return "", errors.New("crontab not installed")
	}
	out, err := exec.Command("crontab", "-l").CombinedOutput()
	if err != nil {
		// "no crontab for user" exits 1; treat as empty.
		if strings.Contains(strings.ToLower(string(out)), "no crontab") {
			return "", nil
		}
		return "", fmt.Errorf("crontab -l: %s", strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

func writeCrontab(content string) error {
	if strings.TrimSpace(content) == "" {
		out, err := exec.Command("crontab", "-r").CombinedOutput()
		if err != nil && !strings.Contains(strings.ToLower(string(out)), "no crontab") {
			return fmt.Errorf("crontab -r: %s", strings.TrimSpace(string(out)))
		}
		return nil
	}
	cmd := exec.Command("crontab", "-")
	cmd.Stdin = bytes.NewBufferString(content)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("crontab -: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

func installCron(o InstallOpts) error {
	cur, err := readCrontab()
	if err != nil {
		return err
	}
	return writeCrontab(mergeCrontab(cur, cronLine(o)))
}

func removeCron() error {
	cur, err := readCrontab()
	if err != nil {
		return err
	}
	if !strings.Contains(cur, cronTag) {
		return nil
	}
	return writeCrontab(mergeCrontab(cur, ""))
}
