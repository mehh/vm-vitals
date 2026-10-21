package collect

import (
	"context"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// rawProc is one row from ps. argv0/argv1 are basenames only; the rest of the
// command line is discarded before it ever lands in a struct.
type rawProc struct {
	Proc
	PPID     int
	ElapsedS int64
	argv0    string
	argv1    string
}

// Interpreters whose first script argument identifies the real program.
var interpreters = map[string]bool{
	"node": true, "nodejs": true, "bun": true, "deno": true,
	"python": true, "python3": true, "python3.11": true, "python3.12": true, "python3.13": true,
	"uv": true, "npx": true, "pnpm": true, "ruby": true, "sh": true, "bash": true, "zsh": true,
}

// agentTools maps a process/script name to a display label. The order matters
// for nothing; it's a set.
var agentTools = map[string]string{
	"claude":       "Claude Code",
	"codex":        "Codex",
	"gemini":       "Gemini CLI",
	"grok":         "Grok",
	"grokbot":      "Grok Bot",
	"aider":        "Aider",
	"opencode":     "OpenCode",
	"goose":        "Goose",
	"cursor-agent": "Cursor Agent",
	"amp":          "Amp",
	"openclaw":     "OpenClaw",
	"clawdbot":     "Clawdbot",
	"moltbot":      "Moltbot",
	"kimi":         "Kimi CLI",
	"qwen":         "Qwen Code",
	"copilot":      "Copilot CLI",
	"ollama":       "Ollama",
}

func processes(ctx context.Context) ([]rawProc, error) {
	out, err := run(ctx, 8*time.Second, "ps", "-axww", "-o", "pid=,ppid=,pcpu=,pmem=,rss=,etime=,comm=")
	if err != nil {
		return nil, err
	}
	procs := parsePS(out)

	// Second pass for argv, sanitized to two basenames.
	args, err := run(ctx, 8*time.Second, "ps", "-axww", "-o", "pid=,args=")
	if err == nil {
		argv := parsePSArgs(args)
		for i := range procs {
			if a, ok := argv[procs[i].PID]; ok {
				procs[i].argv0, procs[i].argv1 = a[0], a[1]
			}
		}
	}
	return procs, nil
}

func parsePS(out string) []rawProc {
	var procs []rawProc
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) < 7 {
			continue
		}
		pid, err := strconv.Atoi(f[0])
		if err != nil {
			continue
		}
		ppid, _ := strconv.Atoi(f[1])
		cpu, _ := strconv.ParseFloat(f[2], 64)
		mem, _ := strconv.ParseFloat(f[3], 64)
		rssKB, _ := strconv.ParseUint(f[4], 10, 64)
		elapsed := parseEtime(f[5])
		name := filepath.Base(strings.Join(f[6:], " "))
		procs = append(procs, rawProc{
			Proc:     Proc{PID: pid, Name: name, CPUPct: round1(cpu), MemPct: round1(mem), RSSB: rssKB * 1024},
			PPID:     ppid,
			ElapsedS: elapsed,
		})
	}
	return procs
}

// parsePSArgs returns pid -> [argv0 basename, argv1 basename]. Everything
// past the second token is dropped on the floor on purpose.
func parsePSArgs(out string) map[int][2]string {
	m := map[int][2]string{}
	for _, line := range strings.Split(out, "\n") {
		f := strings.Fields(line)
		if len(f) < 2 {
			continue
		}
		pid, err := strconv.Atoi(f[0])
		if err != nil {
			continue
		}
		var a [2]string
		a[0] = filepath.Base(f[1])
		if len(f) > 2 && !strings.HasPrefix(f[2], "-") {
			a[1] = filepath.Base(f[2])
		}
		m[pid] = a
	}
	return m
}

// parseEtime handles [[dd-]hh:]mm:ss.
func parseEtime(s string) int64 {
	var days int64
	if i := strings.Index(s, "-"); i >= 0 {
		days, _ = strconv.ParseInt(s[:i], 10, 64)
		s = s[i+1:]
	}
	parts := strings.Split(s, ":")
	var total int64
	for _, p := range parts {
		n, _ := strconv.ParseInt(p, 10, 64)
		total = total*60 + n
	}
	return days*86400 + total
}

func topProcs(procs []rawProc, n int) []Proc {
	sorted := make([]rawProc, 0, len(procs))
	for _, p := range procs {
		if p.CPUPct > 0 || p.RSSB > 50<<20 {
			sorted = append(sorted, p)
		}
	}
	sort.Slice(sorted, func(i, j int) bool {
		if sorted[i].CPUPct != sorted[j].CPUPct {
			return sorted[i].CPUPct > sorted[j].CPUPct
		}
		return sorted[i].RSSB > sorted[j].RSSB
	})
	if len(sorted) > n {
		sorted = sorted[:n]
	}
	out := make([]Proc, len(sorted))
	for i, p := range sorted {
		out[i] = p.Proc
	}
	return out
}

// agentJobs picks out processes that are AI coding agents. Helper children
// of a matched agent (claude spawns several) are folded into their parent:
// one job per top-level agent process, with CPU and memory summed.
func agentJobs(procs []rawProc) []Job {
	matched := map[int]string{}
	byPID := map[int]rawProc{}
	for _, p := range procs {
		byPID[p.PID] = p
		if name := matchAgent(p); name != "" {
			matched[p.PID] = name
		}
	}
	// Walk up to the top-most matched ancestor.
	root := func(pid int) int {
		cur := pid
		for depth := 0; depth < 32; depth++ {
			p, ok := byPID[cur]
			if !ok {
				break
			}
			if _, parentMatched := matched[p.PPID]; !parentMatched {
				break
			}
			cur = p.PPID
		}
		return cur
	}
	agg := map[int]*Job{}
	var order []int
	for pid, name := range matched {
		r := root(pid)
		j, ok := agg[r]
		if !ok {
			rp := byPID[r]
			rname := matched[r]
			j = &Job{Name: rname, Kind: agentTools[rname], PID: r, ElapsedS: rp.ElapsedS}
			agg[r] = j
			order = append(order, r)
		}
		_ = name
		p := byPID[pid]
		j.CPUPct = round1(j.CPUPct + p.CPUPct)
		j.RSSB += p.RSSB
	}
	jobs := make([]Job, 0, len(agg))
	for _, r := range order {
		jobs = append(jobs, *agg[r])
	}
	sort.Slice(jobs, func(i, j int) bool { return jobs[i].ElapsedS > jobs[j].ElapsedS })
	return jobs
}

func matchAgent(p rawProc) string {
	cands := []string{p.Name, p.argv0}
	if interpreters[p.argv0] || interpreters[p.Name] {
		cands = append(cands, p.argv1)
	}
	for _, c := range cands {
		c = strings.TrimSuffix(strings.ToLower(c), ".js")
		c = strings.TrimSuffix(c, ".mjs")
		if _, ok := agentTools[c]; ok {
			return c
		}
	}
	return ""
}
