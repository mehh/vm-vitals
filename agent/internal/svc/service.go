package svc

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

const (
	serviceName = "vm-vitals"
	launchLabel = "com.vmvitals.agent"
)

// InstallService writes a systemd unit (Linux) or a launchd plist (macOS)
// pointing at binPath and starts it. On Linux without a usable systemd (no
// user bus, containers) it falls back to a detached process plus a cron
// @reboot line. DryRunDir, when set, writes the unit file there instead and
// does not touch the service manager (used in tests).
type InstallOpts struct {
	BinPath    string
	ConfigFile string
	LogDir     string
	DryRunDir  string
}

func InstallService(o InstallOpts) (string, error) {
	switch runtime.GOOS {
	case "linux":
		return installSystemd(o)
	case "darwin":
		return installLaunchd(o)
	default:
		return "", fmt.Errorf("unsupported OS %s; run `vm-vitals run` under your own supervisor", runtime.GOOS)
	}
}

func systemdUnit(o InstallOpts) string {
	wanted := "multi-user.target"
	if !IsRoot() {
		wanted = "default.target"
	}
	return fmt.Sprintf(`[Unit]
Description=VM Vitals agent (health monitor for AI-agent machines)
After=network-online.target
Wants=network-online.target

[Service]
ExecStart=%s run --config %s
Restart=always
RestartSec=10
Nice=10
# Hardening: the agent only needs to read /proc and run ps.
NoNewPrivileges=true
ProtectHome=read-only
ProtectSystem=strict
ReadWritePaths=%s
PrivateTmp=true

[Install]
WantedBy=%s
`, o.BinPath, o.ConfigFile, o.LogDir, wanted)
}

func installSystemd(o InstallOpts) (string, error) {
	unit := systemdUnit(o)
	if o.DryRunDir != "" {
		p := filepath.Join(o.DryRunDir, serviceName+".service")
		return p, os.WriteFile(p, []byte(unit), 0o644)
	}
	if !systemdAvailable() {
		// No systemd to talk to (container, or a user session with no D-Bus
		// / XDG_RUNTIME_DIR). Don't fail the install; supervise it ourselves.
		return installFallback(o)
	}
	var dir string
	var ctl []string
	if IsRoot() {
		dir = "/etc/systemd/system"
		ctl = []string{"systemctl"}
	} else {
		home, _ := os.UserHomeDir()
		dir = filepath.Join(home, ".config/systemd/user")
		ctl = []string{"systemctl", "--user"}
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	p := filepath.Join(dir, serviceName+".service")
	if err := os.WriteFile(p, []byte(unit), 0o644); err != nil {
		return "", err
	}
	steps := [][]string{
		append(append([]string{}, ctl...), "daemon-reload"),
		append(append([]string{}, ctl...), "enable", "--now", serviceName+".service"),
		append(append([]string{}, ctl...), "restart", serviceName+".service"),
	}
	for _, s := range steps {
		if out, err := exec.Command(s[0], s[1:]...).CombinedOutput(); err != nil {
			// systemd looked usable but isn't (bus went away, policy denies).
			// Same answer: run it ourselves rather than leave the box silent.
			_ = os.Remove(p)
			how, ferr := installFallback(o)
			if ferr != nil {
				return p, fmt.Errorf("%s: %v: %s; fallback: %v", strings.Join(s, " "), err, strings.TrimSpace(string(out)), ferr)
			}
			return how + fmt.Sprintf(" (systemd unavailable: %s)", strings.TrimSpace(string(out))), nil
		}
	}
	if !IsRoot() {
		// Keep the user service alive after logout.
		_ = exec.Command("loginctl", "enable-linger", strconv.Itoa(os.Getuid())).Run()
	}
	return p, nil
}

func launchdPlistPath() string {
	if IsRoot() {
		return "/Library/LaunchDaemons/" + launchLabel + ".plist"
	}
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library/LaunchAgents", launchLabel+".plist")
}

func launchdDomain() string {
	if IsRoot() {
		return "system"
	}
	return "gui/" + strconv.Itoa(os.Getuid())
}

func launchdPlist(o InstallOpts) string {
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>%s</string>
  <key>ProgramArguments</key>
  <array>
    <string>%s</string>
    <string>run</string>
    <string>--config</string>
    <string>%s</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>Nice</key><integer>10</integer>
  <key>StandardOutPath</key><string>%s/agent.log</string>
  <key>StandardErrorPath</key><string>%s/agent.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:%s</string>
  </dict>
</dict>
</plist>
`, launchLabel, o.BinPath, o.ConfigFile, o.LogDir, o.LogDir, filepath.Dir(o.BinPath))
}

func installLaunchd(o InstallOpts) (string, error) {
	plist := launchdPlist(o)
	if o.DryRunDir != "" {
		p := filepath.Join(o.DryRunDir, launchLabel+".plist")
		return p, os.WriteFile(p, []byte(plist), 0o644)
	}
	p := launchdPlistPath()
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return "", err
	}
	_ = os.MkdirAll(o.LogDir, 0o755)
	// Stop any previous copy first so the new plist takes effect.
	_ = exec.Command("launchctl", "bootout", launchdDomain(), p).Run()
	if err := os.WriteFile(p, []byte(plist), 0o644); err != nil {
		return "", err
	}
	if out, err := exec.Command("launchctl", "bootstrap", launchdDomain(), p).CombinedOutput(); err != nil {
		// Older macOS: fall back to load -w.
		if out2, err2 := exec.Command("launchctl", "load", "-w", p).CombinedOutput(); err2 != nil {
			return p, fmt.Errorf("launchctl bootstrap: %s; load: %s", strings.TrimSpace(string(out)), strings.TrimSpace(string(out2)))
		}
	}
	_ = exec.Command("launchctl", "kickstart", "-k", launchdDomain()+"/"+launchLabel).Run()
	return p, nil
}
