package collect

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestParsePS(t *testing.T) {
	out := `
    1     0   0.0  0.1   9876 12-03:04:05 /sbin/launchd
 4242     1  12.5  3.2 524288    01:02:03 /opt/homebrew/bin/node
 9999  4242   0.3  0.0   1024       00:42 claude
`
	procs := parsePS(out)
	if len(procs) != 3 {
		t.Fatalf("want 3 procs, got %d", len(procs))
	}
	if procs[0].Name != "launchd" || procs[0].ElapsedS != 12*86400+3*3600+4*60+5 {
		t.Errorf("launchd parsed wrong: %+v", procs[0])
	}
	if procs[1].CPUPct != 12.5 || procs[1].RSSB != 524288*1024 || procs[1].Name != "node" {
		t.Errorf("node parsed wrong: %+v", procs[1])
	}
	if procs[2].ElapsedS != 42 || procs[2].PPID != 4242 {
		t.Errorf("etime/ppid wrong: %+v", procs[2])
	}
}

func TestAgentJobsFoldsChildren(t *testing.T) {
	procs := []rawProc{
		{Proc: Proc{PID: 1, Name: "launchd"}},
		{Proc: Proc{PID: 10, Name: "claude", CPUPct: 1, RSSB: 100}, PPID: 1, ElapsedS: 500, argv0: "claude"},
		{Proc: Proc{PID: 11, Name: "claude", CPUPct: 2, RSSB: 50}, PPID: 10, ElapsedS: 499, argv0: "claude"},
		{Proc: Proc{PID: 12, Name: "claude", CPUPct: 3, RSSB: 25}, PPID: 11, ElapsedS: 498, argv0: "claude"},
		{Proc: Proc{PID: 20, Name: "codex", CPUPct: 5, RSSB: 10}, PPID: 1, ElapsedS: 10, argv0: "codex"},
	}
	jobs := agentJobs(procs)
	if len(jobs) != 2 {
		t.Fatalf("want 2 jobs got %d: %+v", len(jobs), jobs)
	}
	if jobs[0].PID != 10 || jobs[0].CPUPct != 6 || jobs[0].RSSB != 175 || jobs[0].ElapsedS != 500 {
		t.Errorf("claude job wrong: %+v", jobs[0])
	}
	if jobs[1].Name != "codex" {
		t.Errorf("codex job wrong: %+v", jobs[1])
	}
}

func TestParsePSArgsDropsEverythingPastTwoTokens(t *testing.T) {
	out := `
4242 /usr/bin/node /home/me/.npm/_npx/claude/cli.js --api-key SECRET --dangerously-skip-permissions
4243 python3 -m aider --model gpt
4244 /usr/local/bin/codex exec "do the thing" --token abc
`
	m := parsePSArgs(out)
	if m[4242] != [2]string{"node", "cli.js"} {
		t.Errorf("4242: %v", m[4242])
	}
	if m[4243] != [2]string{"python3", ""} {
		t.Errorf("4243 should not keep flags: %v", m[4243])
	}
	if m[4244] != [2]string{"codex", "exec"} {
		t.Errorf("4244: %v", m[4244])
	}
	for _, v := range m {
		for _, s := range v {
			if s == "SECRET" || s == "abc" {
				t.Fatal("leaked an argument")
			}
		}
	}
}

func TestMatchAgent(t *testing.T) {
	cases := []struct {
		p    rawProc
		want string
	}{
		{rawProc{Proc: Proc{Name: "claude"}, argv0: "claude"}, "claude"},
		{rawProc{Proc: Proc{Name: "node"}, argv0: "node", argv1: "codex.js"}, "codex"},
		{rawProc{Proc: Proc{Name: "python3.12"}, argv0: "python3.12", argv1: "aider"}, "aider"},
		{rawProc{Proc: Proc{Name: "node"}, argv0: "node", argv1: "server.js"}, ""},
		{rawProc{Proc: Proc{Name: "bash"}, argv0: "bash", argv1: "deploy.sh"}, ""},
	}
	for _, c := range cases {
		if got := matchAgent(c.p); got != c.want {
			t.Errorf("%+v: want %q got %q", c.p, c.want, got)
		}
	}
}

func TestParseEtime(t *testing.T) {
	if parseEtime("05") != 5 || parseEtime("01:02") != 62 || parseEtime("1-00:00:01") != 86401 {
		t.Error("etime parsing wrong")
	}
}

func TestTopProcsOrder(t *testing.T) {
	procs := []rawProc{
		{Proc: Proc{PID: 1, Name: "a", CPUPct: 1}},
		{Proc: Proc{PID: 2, Name: "b", CPUPct: 50}},
		{Proc: Proc{PID: 3, Name: "c", CPUPct: 0, RSSB: 10}},
		{Proc: Proc{PID: 4, Name: "d", CPUPct: 0, RSSB: 900 << 20}},
	}
	top := topProcs(procs, 10)
	if len(top) != 3 || top[0].Name != "b" || top[1].Name != "a" || top[2].Name != "d" {
		t.Errorf("got %+v", top)
	}
}

// Regression: a Linux box with an overlay root produced "disks": null and
// the server answered "malformed report" on every tick.
func TestReportListsAreNeverNull(t *testing.T) {
	r := &Report{V: 1}
	r.normalize()
	b, err := json.Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	js := string(b)
	for _, key := range []string{"disks", "top_procs", "tools", "jobs"} {
		if strings.Contains(js, `"`+key+`":null`) {
			t.Errorf("%s marshals as null: %s", key, js)
		}
		if !strings.Contains(js, `"`+key+`":[]`) {
			t.Errorf("%s should be an empty array: %s", key, js)
		}
	}
	if strings.Contains(js, `"net":`) {
		t.Errorf("net should be omitted when nil: %s", js)
	}
}

func TestNormalizeKeepsExistingLists(t *testing.T) {
	r := &Report{Disks: []Disk{{Mount: "/"}}, Jobs: []Job{{Name: "claude"}}}
	r.normalize()
	if len(r.Disks) != 1 || len(r.Jobs) != 1 || len(r.Top) != 0 || len(r.Tools) != 0 {
		t.Errorf("%+v", r)
	}
}
