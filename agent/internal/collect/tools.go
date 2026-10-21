package collect

import (
	"context"
	"os/exec"
	"strings"
	"time"
)

// knownTools is the fixed list of CLIs we look for on PATH. We only ever run
// `<tool> --version` (or the listed alternative) and keep the first line.
var knownTools = []struct {
	name string
	args []string
}{
	{"claude", []string{"--version"}},
	{"codex", []string{"--version"}},
	{"gemini", []string{"--version"}},
	{"grok", []string{"--version"}},
	{"aider", []string{"--version"}},
	{"opencode", []string{"--version"}},
	{"goose", []string{"--version"}},
	{"cursor-agent", []string{"--version"}},
	{"amp", []string{"--version"}},
	{"openclaw", []string{"--version"}},
	{"ollama", []string{"--version"}},
	{"node", []string{"--version"}},
	{"bun", []string{"--version"}},
	{"deno", []string{"--version"}},
	{"npm", []string{"--version"}},
	{"pnpm", []string{"--version"}},
	{"python3", []string{"--version"}},
	{"uv", []string{"--version"}},
	{"go", []string{"version"}},
	{"rustc", []string{"--version"}},
	{"docker", []string{"--version"}},
	{"podman", []string{"--version"}},
	{"git", []string{"--version"}},
	{"gh", []string{"--version"}},
	{"gcloud", []string{"--version"}},
	{"aws", []string{"--version"}},
	{"az", []string{"version", "--output", "tsv"}},
	{"vercel", []string{"--version"}},
	{"wrangler", []string{"--version"}},
	{"flyctl", []string{"version"}},
	{"tailscale", []string{"--version"}},
	{"tmux", []string{"-V"}},
	{"ffmpeg", []string{"-version"}},
	{"caddy", []string{"version"}},
	{"nginx", []string{"-v"}},
}

func detectTools(ctx context.Context) []Tool {
	var tools []Tool
	for _, t := range knownTools {
		path, err := exec.LookPath(t.name)
		if err != nil {
			continue
		}
		tool := Tool{Name: t.name, Path: path}
		out, err := run(ctx, 6*time.Second, path, t.args...)
		if err != nil && out == "" {
			// nginx prints to stderr; try capturing it.
			if t.name == "nginx" {
				out = combined(ctx, path, t.args...)
			}
		}
		tool.Version = firstLine(out)
		tools = append(tools, tool)
	}
	return tools
}

func combined(ctx context.Context, name string, args ...string) string {
	ctx, cancel := context.WithTimeout(ctx, 6*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Env = minimalEnv()
	out, _ := cmd.CombinedOutput()
	return strings.TrimSpace(string(out))
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[:i]
	}
	s = strings.TrimSpace(s)
	if len(s) > 80 {
		s = s[:80]
	}
	return s
}
