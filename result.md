# VM Vitals: MVP result

Built 2026-10-21. Everything below was run locally on this Mac. Nothing was deployed, pushed, or posted.

## What works

Agent (`agent/`, Go, no dependencies, ~6 MB static binary)
- Builds for linux/amd64, linux/arm64, darwin/amd64, darwin/arm64 (`agent/build.sh`).
- Collects CPU %, cores, load, memory, swap, per-disk usage, top 8 processes, OOM kill counter plus recent kills (Linux), installed CLI tools with versions (35-tool fixed list), and running agent jobs (claude, codex, gemini, grok, aider, opencode, goose, cursor-agent, amp, openclaw, ollama, ...). Child processes fold into the parent job.
- `vm-vitals install --server URL --token PAIR` pairs, writes config (0600), copies itself to `~/.local/bin` or `/usr/local/bin`, and installs a launchd agent (macOS) or systemd unit (Linux, system or user scope with linger). `--dry-run-dir` writes the unit without touching the service manager; that path was tested here. The real launchd load path was not exercised on this Mac to avoid installing a service on it.
- `vm-vitals run` reports every 30 s with exponential backoff on failure, honors a server-suggested interval, and backs off to 5 min if its token is rejected.
- `vm-vitals once` prints the exact JSON that gets sent.
- Privacy: only PATH and HOME are read from the environment; process args are cut to basenames of argv[0] and argv[1] before being stored; no file contents, no network info.
- Unit tests for every parser (ps, etime, /proc/stat, meminfo, vm_stat, sysctl, OOM lines, job folding). `go vet` clean on darwin and linux.
- Verified live: the agent ran against the local server from a sandboxed HOME, paired, and reported real data from this Mac (it correctly flagged the disk at 90%).

Web (`web/`, Next.js 16, React 19, Tailwind 4, Recharts, PGlite or Postgres)
- Homepage mints a pair token (tied to an httpOnly owner cookie), shows the one-line install command, a sudo variant, and a "tell your bot" snippet, then polls and redirects to the dashboard when the first report lands.
- Private dashboard `/m/<id>`: health badge, alerts, share controls, X intent link, email claim form, charts (1h/6h/24h/7d, server-side bucketed), stat tiles, agent jobs, top processes, disks, OOM, installed tools, incident timeline with create/edit/resolve/delete. Polls every 10 s.
- Public share page `/s/<slug>` (off by default) with the same data read-only, plus `/s/<slug>/opengraph-image` rendering a 1200×630 PNG card ("my AI's computer, live") with name, health, CPU/MEM/DISK/JOBS bars and running agents. Twitter card meta is set.
- Alerts: disk ≥85/95, memory ≥90/95, swap ≥80, load > 2× cores, OOM counter increase, agent job died, offline after 2 min. State alerts auto-resolve; event alerts expire after 1 h.
- Pairing: token in the install command auto-registers the machine; re-running install with the same token rotates the machine token instead of duplicating. Pair tokens expire after 24 h; machine tokens are stored hashed.
- Claim: POST email → magic link (Resend if configured, otherwise printed to the server log) → session cookie, machines from the requesting and clicking browsers attach to that email.
- `/install.sh` is generated with the deployment URL baked in. `/dl/<target>` serves binaries from `web/public/dl/` or redirects to `RELEASE_BASE_URL`.
- `pnpm smoke` runs 30 end-to-end checks (pair, ingest, auth, alerts open/resolve, samples, private/public gating, OG image, incidents, claim, re-pair, delete). All pass. `pnpm build` succeeds. `tsc --noEmit` clean.
- Visual check: homepage, share page and OG image were screenshotted and reviewed.

## How to run locally

```sh
./agent/build.sh                 # binaries -> web/public/dl/
cd web && pnpm install && pnpm dev
pnpm smoke                       # in another shell
# real agent: click "Get my install command" at http://localhost:3000, then
curl -fsSL http://localhost:3000/install.sh | sh -s -- pair_...
```

No DATABASE_URL needed locally; PGlite stores data in `web/.data/`.

## What's needed to deploy

Accounts: Vercel (hosting), Neon or Vercel Postgres (database), somewhere static for the four agent binaries (a GitHub release is simplest), optionally Resend (magic-link email) and a domain.

Environment variables (names only):
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `RELEASE_BASE_URL`
- `RESEND_API_KEY` (optional)
- `EMAIL_FROM` (optional)

Steps: `VERSION=v0.1.0 ./agent/build.sh`, upload `web/public/dl/vm-vitals-*` to a release, set `RELEASE_BASE_URL` to that release's download base, deploy `web/` to Vercel with the variables above. Tables are created on first request.

## Known gaps and judgment calls

- The macOS launchd and Linux systemd service load paths are implemented but only the file generation was exercised here (dry run). First real install on a Linux VM should be watched once.
- macOS has no OOM-kill counter; the UI says so instead of faking one.
- Sessions, owner cookies and magic links are plain and unsigned by design (random 192–256-bit tokens, hashed where stored). `SESSION_SECRET` from `.env.example` is reserved and unused.
- Samples are kept 7 days; there is no cron, retention runs opportunistically on ingest.
- The share page refreshes on reload rather than live-polling; the owner dashboard live-polls.
- No rate limiting on `/api/ingest` beyond the 256 KB body cap. Fine for an MVP behind Vercel.
- `vm-vitals uninstall` removes the service but leaves the binary and config in place.
