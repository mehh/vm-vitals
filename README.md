# VM Vitals

Free, shareable health monitor for the computers that run your AI agents. The VM
with Claude Code on it. The Mac mini running Grok Bot overnight. The box you only
remember exists when the disk fills up and Codex stops answering.

One line installs a tiny Go daemon. Every 30 seconds it reports disk, CPU, memory,
load, swap, top processes, OOM kills, which agent CLIs are installed, and which
agent jobs are running. The web app gives you a live dashboard, alerts, a public
share page with an OG card for X, and an incident log for "what broke, what fixed
it".

Numbers and process names only. Never env vars, never command-line arguments,
never file contents. `vm-vitals once` prints exactly what gets sent.

## Install (on the machine you want to watch)

1. Open the web app, click "Get my install command".
2. Run it on the box:

```sh
curl -fsSL https://YOUR-HOST/install.sh | sh -s -- pair_xxxxxxxxxxxxxxxxxxxxxxxx
```

Linux gets a systemd service (system-wide if run as root, otherwise a user service
with linger enabled). macOS gets a launchd agent. The dashboard opens itself in the
browser that minted the token, about 30 seconds later.

Useful afterwards:

```sh
vm-vitals once        # print one full report as JSON
vm-vitals uninstall   # stop and remove the service
# logs
journalctl -u vm-vitals -f            # Linux, root install
journalctl --user -u vm-vitals -f     # Linux, user install
tail -f ~/Library/Logs/vm-vitals/agent.log   # macOS
```

No account is needed. Machines belong to the browser that paired them. If you want
to open them from a phone or another laptop, type an email on the machine page and
click the magic link. That's the whole login system.

## Tell your bot to install it

Paste this into Grok Bot, Claude Code, Codex, or whatever is driving the machine.
Replace the token.

```
Install the VM Vitals health monitor on this machine so I can watch your computer
from my phone. Run exactly this command, then tell me the dashboard URL it prints:

curl -fsSL https://YOUR-HOST/install.sh | sh -s -- pair_xxxxxxxxxxxxxxxxxxxxxxxx

It only sends system metrics (disk, CPU, memory, process names, tool versions).
Do not modify the command. If it asks for sudo and you don't have it, run it
without sudo; a user-level service is fine.
```

The install card on the homepage renders this snippet with your real token filled in.

## Run it locally

Requirements: Go 1.22+, Node 20+, pnpm. No Postgres needed for local dev; the app
falls back to an embedded PGlite database in `web/.data/`.

```sh
# 1. build agent binaries into web/public/dl/ so /install.sh can serve them
./agent/build.sh

# 2. run the web app
cd web
pnpm install
pnpm dev            # http://localhost:3000

# 3. end-to-end check (pairs a fake machine, ingests, flips alerts, renders OG image)
pnpm smoke

# 4. point a real agent at it
# click "Get my install command" on localhost:3000, then:
curl -fsSL http://localhost:3000/install.sh | sh -s -- pair_...
```

Agent tests: `cd agent && go test ./...`

## Deploy

The web app is a stock Next.js app. Vercel plus a Postgres (Neon or Vercel Postgres)
is the intended target. Set these environment variables:

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Tables are created on first request. |
| `NEXT_PUBLIC_APP_URL` | Public URL, baked into install commands and OG cards. |
| `RELEASE_BASE_URL` | Where agent binaries live, e.g. a GitHub release. Files must be named `vm-vitals-<os>-<arch>`. Unset = serve from `web/public/dl/`. |
| `RESEND_API_KEY` | Optional. Enables magic-link emails. Unset = link is printed to the server log. |
| `EMAIL_FROM` | Optional. Sender for magic links. |

Build binaries with `VERSION=v0.1.0 ./agent/build.sh` and upload the four files
to the release.

## What gets reported

See `/privacy` in the app, or read `agent/internal/collect/`. Short version:

- hostname, OS, arch, kernel, uptime, agent version
- CPU %, cores, load averages, memory, swap, per-disk usage
- top 8 processes (pid, executable name, cpu, mem)
- OOM kill counter from `/proc/vmstat` and "Killed process N (name)" fragments when the journal is readable (Linux only)
- which of a fixed list of CLIs are on PATH, and their `--version` first line
- running agent jobs (claude, codex, gemini, grok, aider, opencode, goose, cursor-agent, amp, openclaw, ollama, ...): pid, cpu, mem, runtime. Children are folded into the parent.

The agent reads only PATH and HOME from its environment. Process arguments are
trimmed to the basename of argv[0] and argv[1] before they land in a Go struct,
so API keys passed on a command line never make it into memory, let alone the wire.

## Alerts

Evaluated server-side on every report:

| Alert | Condition |
|---|---|
| disk | any real filesystem ≥85% (warning), ≥95% (critical) |
| memory | ≥90% (warning), ≥95% (critical) |
| swap | ≥80% of configured swap |
| load | 5-minute load > 2× core count |
| oom | kernel OOM kill counter increased |
| job_died | an agent process seen last tick (running ≥60s) is gone |
| offline | no report for 2 minutes |

State alerts resolve themselves when the condition clears. OOM and job_died are
events; they auto-resolve after an hour.

## Demo GIF plan

Thirty seconds, 1280×800, dark terminal on the left, browser on the right.

1. (0–4s) Browser on the homepage. Click "Get my install command". Token appears.
2. (4–10s) Terminal: paste the curl line. Show "Pairing MrKlean with ... Paired. Service installed." Keep the dashboard URL line visible.
3. (10–16s) Browser auto-redirects to the dashboard. Stat tiles fill in. Point at "Agent jobs running: Claude Code · 23h".
4. (16–22s) Toggle "public page". Click "Post on X". Show the X compose with the unfurled card: name, "Needs attention", four bars.
5. (22–28s) Back on the dashboard, click "+ Log an incident", type "Disk hit 90%, pnpm store prune fixed it", save. It appears in the timeline.
6. (28–30s) Hold on the share page with the card. Caption: "my AI's computer, live."

Record with `screen` on macOS or `wf-recorder` on Linux, convert with `ffmpeg -i demo.mov -vf "fps=12,scale=1280:-1" -loop 0 demo.gif` or use gifski for better colors.

## Layout

```
agent/                 Go daemon. go build ./ -> single static binary
  internal/collect/    collectors (linux.go, darwin.go, procs.go, tools.go)
  internal/svc/        config, HTTP client, systemd/launchd installer
  build.sh             cross-compile all four targets
web/                   Next.js 16 app (App Router) + Postgres/PGlite
  src/app/api/         pair, ingest, pair-tokens, machines, incidents, claim
  src/app/m/[id]       private dashboard
  src/app/s/[slug]     public share page + opengraph-image
  src/app/install.sh   the installer script, templated with the host
  src/app/dl/[file]    binary download / redirect
  scripts/smoke.mjs    end-to-end test
```
