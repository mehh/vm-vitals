# VM Vitals: Grok Bot vibe redesign, result

Shipped 2026-10-22 (UTC, just after midnight). Live, smoke tested, screenshots below.

## Live URL

https://vm-vitals.vercel.app

Production deploy from commit `04eb14b` on `mehh/vm-vitals` main. Agent release v0.2.0 at
https://github.com/mehh/vm-vitals/releases/tag/v0.2.0, and `RELEASE_BASE_URL` on Vercel now points at it.

## What changed

**Onboarding is a prompt now.** The homepage button reads "Get a prompt for your Grok Bot". Clicking it mints a token and shows a chat bubble: "Hey Grok Bot, install VM Vitals on your computer so I can watch your vitals. Run exactly this command, then tell me the dashboard link it prints: curl ... | sh -s -- pair_...". There is a small picker to re-address it to Claude Code, Codex, or "my bot". A "Copy prompt" button, a status line that listens for the pairing, and an "or run it yourself" toggle that holds the raw curl line with the sudo checkbox. The prompt text lives in `web/src/lib/prompt.ts` and the pair-tokens API returns it alongside the command.

**Your bot's heartbeat.** Each machine gets a health score from 0 to 100 and a mood: Thriving, Humming along, Sweating a bit, Wheezing, Flatlining, Gone quiet (offline), Warming up (no report yet). Each mood has a quip. An EKG strip scrolls under the score and its tempo follows CPU and load, so a busy box visibly races. The scoring is in `web/src/lib/vitals.ts` and is shared by the dashboard, the share page, the homepage cards and the OG image.

**Live charts.** A vitals board with ring gauges and one-hour sparklines for CPU, memory, disk and network, refreshed every 15 seconds. The recharts panels got gradient fills, a network panel (download and upload), and range titles like "The last hour, in squiggles". Homepage machine cards show the score ring, mood emoji and three meters.

**Network is real data.** The Go agent (v0.2.0) now reports bytes per second in and out across non-loopback interfaces, from `/proc/net/dev` on Linux and `netstat -ib` on macOS. The samples table gained `net_rx_bps` and `net_tx_bps` (migrated automatically on first request; Neon took it during the live smoke). Machines still on agent v0.1.0 see a friendly empty state on the network tile telling them to re-run the install line.

**Share page and OG card.** The share page leads with the mood card, then the vitals board, charts, alerts, jobs, incidents, and a closing CTA to get a prompt. The OG image shows the score ring, mood emoji and label, four stat bars and a one-hour CPU sparkline. Page titles read "grok-mini is thriving · my AI's computer, live". The "Post on X" text now includes the mood and score.

**Empty states and copy.** "Nobody's home. No claude, codex, grok or aider process is running. The box is napping." "Zero since boot. The kernel hasn't had to murder anything." "No swap configured. Brave." The 404 page is "No pulse here" with a flat EKG line. Dark palette with violet, sky, lime and pink series colors, glow on the primary cards, reduced-motion respected.

**Tests.** `pnpm test` runs 13 node:test unit tests for the prompt builder and the score/mood logic. The smoke test grew from 33 to 41 checks: the homepage offers the prompt and no longer offers the old CTA, the minted prompt addresses Grok Bot, embeds the exact command and token, asks for the dashboard link and uses the deployed host; network survives ingest, snapshot and samples; the dashboard and share page render the heartbeat, score and a mood. Local run: 41/41. Live run against https://vm-vitals.vercel.app: 41/41. Go tests pass, including the new `/proc/net/dev` and `netstat -ib` parsers.

**Deploy hygiene.** `web/.vercelignore` excludes `public/dl/vm-vitals-*` and `.data`. No secrets printed or committed; the staged diff was scanned before the push.

## Screenshots

Taken with Google Chrome through python playwright (`web/scripts/shots.py`) against a demo machine seeded with an hour of history (`web/scripts/seed-demo.mjs`). The live set was seeded on production and the demo machine deleted afterwards.

Live site (https://vm-vitals.vercel.app):

- docs/screenshots-live/home.png
- docs/screenshots-live/home-prompt.png (prompt revealed, "or run it yourself" open)
- docs/screenshots-live/prompt-card.png
- docs/screenshots-live/dashboard.png
- docs/screenshots-live/share.png
- docs/screenshots-live/og.png
- docs/screenshots-live/not-found.png

Local dev set, same pages: docs/screenshots/*.png

## Notes

- Existing machines keep working. The one leftover from the first deploy, `kris-mac-smoke`, runs agent v0.1.0 and will show the "can't feel the network yet" tile until reinstalled.
- Two other briefs sit in the repo untracked, `linux-fix-brief.md` and `oss-brief.md`. I left them alone; they look like separate tasks. One of them reports "malformed report" from a Linux install, which my ingest change does not address (the `net` field is optional either way).
- The health score is deliberately kind to high CPU (a bot that works is fine) and harsh on disk and memory near the top.
