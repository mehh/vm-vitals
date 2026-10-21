// vm-vitals: a small daemon that reports machine health to a VM Vitals server.
//
//	vm-vitals install --server https://vitals.example --token PAIRTOKEN
//	vm-vitals run     [--config path]
//	vm-vitals once    # print one report as JSON (exactly what gets sent)
//	vm-vitals uninstall
//	vm-vitals version
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"github.com/vm-vitals/agent/internal/collect"
	"github.com/vm-vitals/agent/internal/svc"
)

// Version is set by -ldflags "-X main.Version=..." at build time.
var Version = "dev"

func main() {
	log.SetFlags(log.LstdFlags | log.LUTC)
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "install":
		err = cmdInstall(os.Args[2:])
	case "run":
		err = cmdRun(os.Args[2:])
	case "once":
		err = cmdOnce()
	case "uninstall":
		err = svc.UninstallService()
	case "version", "--version", "-v":
		fmt.Println("vm-vitals", Version, runtime.GOOS+"/"+runtime.GOARCH)
	case "help", "-h", "--help":
		usage()
	default:
		usage()
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprintln(os.Stderr, `vm-vitals - health monitor for computers that run AI agents

  vm-vitals install --server URL --token PAIR_TOKEN [--name NAME] [--no-service]
  vm-vitals run [--config PATH]
  vm-vitals once        print one report as JSON and exit
  vm-vitals uninstall   stop and remove the service
  vm-vitals version`)
}

func cmdOnce() error {
	c := collect.New(Version)
	r := c.Collect(context.Background())
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(r)
}

func cmdInstall(args []string) error {
	fs := flag.NewFlagSet("install", flag.ExitOnError)
	server := fs.String("server", "", "VM Vitals server URL")
	token := fs.String("token", "", "pair token from the website")
	name := fs.String("name", "", "display name for this machine (default: hostname)")
	noService := fs.Bool("no-service", false, "pair and write config only; don't install a service")
	dryRun := fs.String("dry-run-dir", "", "write service files here instead of installing (testing)")
	_ = fs.Parse(args)
	if *server == "" || *token == "" {
		return errors.New("--server and --token are required")
	}

	paths := svc.ResolvePaths()
	host, _ := os.Hostname()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	client := svc.NewClient(*server, "", Version)
	fmt.Printf("Pairing %s with %s ...\n", host, *server)
	pr, err := client.Pair(ctx, svc.PairRequest{PairToken: *token, Hostname: host, OS: runtime.GOOS, Arch: runtime.GOARCH, Name: *name})
	if err != nil {
		return err
	}
	interval := pr.IntervalS
	if interval <= 0 {
		interval = 30
	}
	cfg := &svc.Config{Server: *server, MachineID: pr.MachineID, MachineToken: pr.MachineToken, IntervalS: interval, Name: *name}
	if err := svc.SaveConfig(paths.ConfigFile, cfg); err != nil {
		return fmt.Errorf("write config: %w", err)
	}
	fmt.Printf("Paired. Config: %s\n", paths.ConfigFile)

	if *noService {
		fmt.Printf("Dashboard: %s\nRun it with: %s run --config %s\n", pr.DashboardURL, selfPath(), paths.ConfigFile)
		return nil
	}

	// Copy ourselves into place so the service has a stable path.
	binPath, err := installBinary(paths.BinDir, *dryRun)
	if err != nil {
		return err
	}
	_ = os.MkdirAll(paths.LogDir, 0o755)
	unit, err := svc.InstallService(svc.InstallOpts{BinPath: binPath, ConfigFile: paths.ConfigFile, LogDir: paths.LogDir, DryRunDir: *dryRun})
	if err != nil {
		return fmt.Errorf("service install (%s): %w", unit, err)
	}
	fmt.Printf("Service installed (%s scope): %s\n", paths.Scope, unit)
	fmt.Printf("\nDashboard: %s\n", pr.DashboardURL)
	return nil
}

func selfPath() string {
	p, err := os.Executable()
	if err != nil {
		return "vm-vitals"
	}
	return p
}

func installBinary(binDir, dryRun string) (string, error) {
	self, err := os.Executable()
	if err != nil {
		return "", err
	}
	self, _ = filepath.EvalSymlinks(self)
	if dryRun != "" {
		return self, nil
	}
	dest := filepath.Join(binDir, "vm-vitals")
	if self == dest {
		return dest, nil
	}
	if err := os.MkdirAll(binDir, 0o755); err != nil {
		return "", err
	}
	data, err := os.ReadFile(self)
	if err != nil {
		return "", err
	}
	tmp := dest + ".tmp"
	if err := os.WriteFile(tmp, data, 0o755); err != nil {
		return "", err
	}
	return dest, os.Rename(tmp, dest)
}

func cmdRun(args []string) error {
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	cfgPath := fs.String("config", svc.ResolvePaths().ConfigFile, "config file")
	_ = fs.Parse(args)

	cfg, err := svc.LoadConfig(*cfgPath)
	if err != nil {
		return fmt.Errorf("load config %s: %w (run `vm-vitals install` first)", *cfgPath, err)
	}
	client := svc.NewClient(cfg.Server, cfg.MachineToken, Version)
	collector := collect.New(Version)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	interval := time.Duration(cfg.IntervalS) * time.Second
	log.Printf("vm-vitals %s reporting to %s every %s (machine %s)", Version, cfg.Server, interval, cfg.MachineID)

	backoff := interval
	for {
		tickCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
		report := collector.Collect(tickCtx)
		resp, err := client.Report(tickCtx, report)
		cancel()

		wait := interval
		switch {
		case errors.Is(err, svc.ErrUnauthorized):
			log.Printf("server rejected our token; was this machine removed? retrying in 5m")
			wait = 5 * time.Minute
		case err != nil:
			log.Printf("report failed: %v (retry in %s)", err, backoff)
			wait = backoff
			if backoff < 5*time.Minute {
				backoff *= 2
			}
		default:
			backoff = interval
			if resp.IntervalS > 0 && resp.IntervalS >= 10 {
				wait = time.Duration(resp.IntervalS) * time.Second
			}
		}

		select {
		case <-ctx.Done():
			log.Println("shutting down")
			return nil
		case <-time.After(wait):
		}
	}
}
