// Package svc handles config on disk and OS service installation.
package svc

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
)

type Config struct {
	Server       string `json:"server"`
	MachineID    string `json:"machine_id"`
	MachineToken string `json:"machine_token"`
	IntervalS    int    `json:"interval_s"`
	Name         string `json:"name,omitempty"`
}

// Paths describes where the binary, config and service unit live. Scope is
// "system" when running as root, else "user".
type Paths struct {
	Scope      string
	BinDir     string
	ConfigDir  string
	ConfigFile string
	LogDir     string
}

func IsRoot() bool { return os.Geteuid() == 0 }

func ResolvePaths() Paths {
	if IsRoot() {
		p := Paths{Scope: "system", BinDir: "/usr/local/bin", ConfigDir: "/etc/vm-vitals", LogDir: "/var/log/vm-vitals"}
		p.ConfigFile = filepath.Join(p.ConfigDir, "config.json")
		return p
	}
	home, _ := os.UserHomeDir()
	p := Paths{Scope: "user", BinDir: filepath.Join(home, ".local", "bin"), ConfigDir: filepath.Join(home, ".config", "vm-vitals")}
	if runtime.GOOS == "darwin" {
		p.LogDir = filepath.Join(home, "Library", "Logs", "vm-vitals")
	} else {
		p.LogDir = filepath.Join(home, ".local", "state", "vm-vitals")
	}
	p.ConfigFile = filepath.Join(p.ConfigDir, "config.json")
	return p
}

func LoadConfig(path string) (*Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var c Config
	if err := json.Unmarshal(b, &c); err != nil {
		return nil, err
	}
	if c.Server == "" || c.MachineToken == "" {
		return nil, errors.New("config missing server or machine_token")
	}
	if c.IntervalS <= 0 {
		c.IntervalS = 30
	}
	return &c, nil
}

func SaveConfig(path string, c *Config) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	b, _ := json.MarshalIndent(c, "", "  ")
	return os.WriteFile(path, append(b, '\n'), 0o600)
}
