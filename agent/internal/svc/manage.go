package svc

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
)

// ServiceFile is the unit or plist path for the current scope, whether or
// not it exists.
func ServiceFile() string {
	switch runtime.GOOS {
	case "linux":
		if IsRoot() {
			return filepath.Join("/etc/systemd/system", serviceName+".service")
		}
		home, _ := os.UserHomeDir()
		return filepath.Join(home, ".config/systemd/user", serviceName+".service")
	case "darwin":
		return launchdPlistPath()
	}
	return ""
}

// Uninstall stops the agent and removes everything install put on disk: the
// service (systemd, launchd, or the background runner and its cron line),
// the binary, the config with the machine token, and the logs. It returns a
// line per thing it removed. Missing pieces are skipped, so running it twice
// is fine.
func Uninstall(p Paths) ([]string, error) {
	var done []string
	note := func(format string, a ...any) { done = append(done, fmt.Sprintf(format, a...)) }

	switch runtime.GOOS {
	case "linux":
		unit := serviceName + ".service"
		ctl := []string{"systemctl"}
		if !IsRoot() {
			ctl = append(ctl, "--user")
		}
		// Only touch systemd if our unit file is there; the unit name alone
		// isn't proof the service is ours.
		if _, err := os.Stat(ServiceFile()); err == nil {
			if _, err := exec.LookPath("systemctl"); err == nil {
				if exec.Command(ctl[0], append(ctl[1:], "disable", "--now", unit)...).Run() == nil {
					note("stopped and disabled %s", unit)
				}
			}
			if removed(ServiceFile()) {
				note("removed %s", ServiceFile())
				_ = exec.Command(ctl[0], append(ctl[1:], "daemon-reload")...).Run()
			}
		}
		if pid := fallbackPID(p.LogDir); pid > 0 {
			stopFallback(p.LogDir)
			note("stopped background agent (pid %d)", pid)
		}
		if cur, err := readCrontab(); err == nil && strings.Contains(cur, p.ConfigFile+" ") && strings.Contains(cur, cronTag) {
			if err := removeCron(); err == nil {
				note("removed the @reboot line from crontab")
			}
		}
	case "darwin":
		// launchctl addresses jobs by label, so only boot one out when our
		// plist is on disk. /uninstall.sh sweeps by label regardless.
		plist := launchdPlistPath()
		if _, err := os.Stat(plist); err == nil {
			if exec.Command("launchctl", "bootout", launchdDomain()+"/"+launchLabel).Run() == nil {
				note("stopped launchd job %s", launchLabel)
			} else {
				_ = exec.Command("launchctl", "unload", plist).Run()
			}
			if removed(plist) {
				note("removed %s", plist)
			}
		}
	}

	bin := filepath.Join(p.BinDir, "vm-vitals")
	if removed(bin) {
		note("removed %s", bin)
	}
	if removed(p.ConfigFile) {
		note("removed %s (machine token)", p.ConfigFile)
		_ = os.Remove(p.ConfigDir) // only if empty
	}
	if st, err := os.Stat(p.LogDir); err == nil && st.IsDir() {
		if err := os.RemoveAll(p.LogDir); err != nil {
			return done, err
		}
		note("removed %s", p.LogDir)
	}
	return done, nil
}

func removed(path string) bool {
	return path != "" && os.Remove(path) == nil
}

func fallbackPID(logDir string) int {
	b, err := os.ReadFile(pidFile(logDir))
	if err != nil {
		return 0
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(b)))
	if err != nil || pid <= 1 || syscall.Kill(pid, 0) != nil {
		return 0
	}
	return pid
}

// Status describes the installed agent for `vm-vitals status`.
type Status struct {
	Scope       string
	Binary      string
	BinaryFound bool
	Config      *Config
	ConfigFile  string
	ConfigErr   error
	Manager     string // "systemd", "launchd", "background", or "none"
	ServiceFile string
	ServiceBody string
	Running     string // best-effort one-liner from the service manager
	LogHint     string
	CronLine    string
}

func GetStatus(p Paths) Status {
	s := Status{Scope: p.Scope, Binary: filepath.Join(p.BinDir, "vm-vitals"), ConfigFile: p.ConfigFile, Manager: "none"}
	if _, err := os.Stat(s.Binary); err == nil {
		s.BinaryFound = true
	}
	s.Config, s.ConfigErr = LoadConfig(p.ConfigFile)

	switch runtime.GOOS {
	case "linux":
		if b, err := os.ReadFile(ServiceFile()); err == nil {
			s.Manager, s.ServiceFile, s.ServiceBody = "systemd", ServiceFile(), string(b)
			args := []string{"is-active", serviceName}
			s.LogHint = "journalctl -u vm-vitals -f"
			if !IsRoot() {
				args = append([]string{"--user"}, args...)
				s.LogHint = "journalctl --user -u vm-vitals -f"
			}
			out, _ := exec.Command("systemctl", args...).Output()
			s.Running = "systemctl says: " + strings.TrimSpace(string(out))
		}
		if pid := fallbackPID(p.LogDir); pid > 0 {
			if s.Manager == "none" {
				s.Manager = "background"
				s.LogHint = "tail -f " + logFile(p.LogDir)
			}
			s.Running = fmt.Sprintf("background process pid %d is alive", pid)
		}
		if cur, err := readCrontab(); err == nil {
			for _, l := range strings.Split(cur, "\n") {
				if strings.HasSuffix(strings.TrimSpace(l), cronTag) {
					s.CronLine = l
				}
			}
		}
	case "darwin":
		plist := launchdPlistPath()
		if b, err := os.ReadFile(plist); err == nil {
			s.Manager, s.ServiceFile, s.ServiceBody = "launchd", plist, string(b)
			s.LogHint = "tail -f " + logFile(p.LogDir)
			out, err := exec.Command("launchctl", "print", launchdDomain()+"/"+launchLabel).Output()
			if err != nil {
				s.Running = "launchctl has no job " + launchLabel + " loaded"
			} else {
				s.Running = "launchctl: " + launchdState(string(out))
			}
		}
	}
	return s
}

// launchdState pulls "state = running" and the pid out of `launchctl print`.
func launchdState(out string) string {
	var parts []string
	seen := map[string]bool{}
	for _, l := range strings.Split(out, "\n") {
		l = strings.TrimSpace(l)
		for _, k := range []string{"state = ", "pid = "} {
			// Nested sections repeat "state = active"; the job's own line comes first.
			if strings.HasPrefix(l, k) && !seen[k] {
				seen[k] = true
				parts = append(parts, l)
			}
		}
	}
	if len(parts) == 0 {
		return "loaded"
	}
	return strings.Join(parts, ", ")
}
