# Contributing to VM Vitals

Thanks for poking at this. VM Vitals is a small project with two parts. A Go agent sits on the box your AI agent runs on and reports numbers every 30 seconds. A Next.js app turns those numbers into a dashboard, alerts and a share page. Both are easy to run on a laptop.

## Run it locally

You need Go 1.22+, Node 20+ and pnpm. You don't need Postgres. Without `DATABASE_URL` the web app uses an embedded PGlite database in `web/.data/`.

```sh
# build the four agent binaries into web/public/dl/ so /install.sh can serve them
./agent/build.sh

# run the web app on http://localhost:3000
cd web
pnpm install
pnpm dev
```

To watch a real agent report in, click "Copy prompt for your Grok Bot" on localhost:3000, open "or run it yourself" and run the curl line it gives you. `vm-vitals once` prints a single report as JSON without sending anything, which is the fastest way to check a collector change.

## Tests

Run these before you open a PR. CI runs the same ones.

```sh
cd web
pnpm typecheck    # tsc --noEmit
pnpm test         # unit tests in web/scripts/*.test.mjs
pnpm smoke        # end-to-end: pairs a fake machine, ingests, flips alerts, renders the OG image

cd agent
go vet ./...
go test ./...
```

`pnpm smoke` needs the dev server running.

## Where things live

```
agent/
  main.go              commands: install, run, once, status, uninstall, version
  internal/collect/    collectors. linux.go, darwin.go, net.go, procs.go, tools.go
  internal/svc/        config, HTTP client, systemd/launchd installer, cron fallback
  build.sh             cross-compiles linux and darwin, amd64 and arm64
web/
  src/app/api/         pair, ingest, pair-tokens, machines, incidents, claim
  src/app/m/[id]       private machine dashboard
  src/app/s/[slug]     public share page and its OG image
  src/app/privacy      the privacy page
  src/app/install.sh   the installer script, templated with the host
  src/app/uninstall.sh the one-line uninstaller
  src/components/Critters.tsx   Grok Bot and the blob crew, plain SVG
  src/lib/og.tsx       the social cards, drawn with next/og
  src/app/dl/[file]    binary download or redirect to the release
  scripts/             smoke test and unit tests
```

## Ground rules for the agent

The agent runs on other people's machines, often next to API keys and half-finished code. People install it because we promise it's boring. Keep it boring.

- No new Go dependencies without talking about it in an issue first. Today it's standard library only, and that's on purpose.
- The agent never reads file contents, keystrokes or secrets. Reading kernel numbers out of `/proc` is fine. Reading someone's `~/.ssh` is not.
- From the environment it reads PATH and HOME. Nothing else ends up in a report. Child processes get a minimal env built in `minimalEnv()` in `agent/internal/collect/collect.go`.
- Command-line arguments get cut down to the basename of argv[0] and argv[1] in `parsePSArgs`. Nothing past that gets kept. Don't loosen this, because API keys get passed on command lines all the time.
- Any new field in the report must be listed in the README under "What the background agent does" and on the `/privacy` page (`web/src/app/privacy`). If it isn't documented, it doesn't ship.

## Detect a new agent CLI

This is the easiest useful PR you can make. Two places to touch:

1. `agentTools` in `agent/internal/collect/procs.go` maps a process or script name to a display label, for example `"aider": "Aider"`. This is what spots a running job. If the CLI runs as a node or python script, its script name gets matched as argv[1] under the interpreter, so add the script name. A `.js` or `.mjs` suffix is stripped for you.
2. `knownTools` in `agent/internal/collect/tools.go` is the list of CLIs looked up on PATH and asked for `--version`. Add an entry if the tool has a version flag that is fast, offline and prints one line. If it phones home or prompts for anything, leave it out.

Add a test case in `agent/internal/collect/collect_test.go` if the process shape is unusual. If you're not sure how the CLI shows up in `ps`, open a "Detect a new agent CLI" issue with the output of `ps -axww -o pid=,comm=,args=` trimmed to that one process, with arguments past the first two removed.

## Good first issues

- New agent CLIs to detect. There's always a new one.
- Windows support. Not supported today at all. It would need a collector, a service installer and a PowerShell install line.
- Translations of the moods shown on the dashboard and share page. They live in `MOODS` in `web/src/lib/vitals.ts`.
- A new member of the crew. Characters are plain SVG in `web/src/components/Critters.tsx`, and a GPU blob would be very welcome.

## Pull request checklist

- [ ] `pnpm typecheck` and `pnpm test` pass in `web/`
- [ ] `go vet ./...` and `go test ./...` pass in `agent/`
- [ ] No new Go dependencies, or there's an issue where we agreed on one
- [ ] New report fields are listed in the README and on `/privacy`
- [ ] Screenshot attached for anything you can see in the UI
- [ ] One change per PR. Small PRs get merged fast, big ones get read slowly

## Security bugs

Please don't file those as public issues. See [SECURITY.md](SECURITY.md).
