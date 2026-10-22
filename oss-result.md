# VM Vitals open-source launch: result

Shipped 2026-10-22, around 00:50 Central. Live at https://vm-vitals.vercel.app, repo at https://github.com/mehh/vm-vitals.

## What shipped

**A new look, built from scratch.** I studied grokbotaustin.vercel.app's CSS: pure black, white ink, #262626 hairlines, Geist Mono everywhere, a faint graph-paper grid, a blinking block cursor, and color only for ok/warn/bad. The purple-gradient card look is gone. Panels are hairline grids instead of floating cards, headlines are huge 800-weight mono, and there's a marquee ticker. Landing, dashboard, share page, install page, privacy page, 404 and both OG cards all use it.

**Grok Bot and the crew.** Five characters drawn as plain SVG in `web/src/components/Critters.tsx`: Grok Bot, plus Chip (CPU), Mimi (memory), Stash (disk) and Ping (network). Each friend is an outlined jar that fills with its metric, with a slow liquid wave on top. The fill turns amber at 85% and red at 95%. Faces change with the level: happy, calm, busy, sweaty (with a sweat drop), panic. Offline machines snore. Grok Bot's face follows the health mood, and its antenna is the status light, pulsing at the machine's heartbeat. Idle animations are breathing, blinking, bobbing, swaying and shaking, offset per character, and all of it switches off under reduced motion. The same drawings render in the OG images through a small SVG serializer, since next/og only accepts plain SVG elements.

**Landing page.** The hero says "is my bot's computer okay?" with a terminal kicker, and a stage where Grok Bot and the crew act out a scripted night: idle, Claude Code wakes up, npm install, "node_modules ate the disk", prune, back to thriving. One button, **Copy prompt for your Grok Bot**, mints the token and copies the prompt in the same click. The copy uses a promise-backed ClipboardItem, so Safari keeps the user gesture. "Read the prompt first" shows the prompt with the token blanked out. A live line shows machines reporting and heartbeats in the last hour from the database. Below that: meet the crew, how it works with a mock chat with Grok Bot, "What the background agent does", a preview of the share card, and a closing CTA.

**Share flow.** The dashboard has a Public page switch, the link with **Copy link**, a native **Share…** sheet where the browser has one, **Post on X**, **Open**, and a live preview of the exact card your friends will see. The share page has Copy link and Share in its header.

**SEO.** Titles, descriptions and canonical links per page. Dynamic OG and Twitter images for the homepage and for every public machine, drawn with the crew and live stats, plus an hour of CPU. Static favicon.ico, icon.svg, apple-touch-icon, 192/512 and maskable icons, a web manifest, robots.txt (keeps `/m/`, `/api/` and `/auth/` out) and a sitemap. Geist Mono TTFs are bundled under the OFL for the cards.

**Agent v0.3.0 and v0.3.1.**
- `vm-vitals status` prints the binary, config, service manager, whether it's running, the log command, and the service file verbatim.
- `vm-vitals uninstall` now removes the service, the crontab line, the binary, the config with the machine token, and the logs. Before, it only removed the service.
- `curl -fsSL https://vm-vitals.vercel.app/uninstall.sh | sh` does the same for any agent version, even if the binary is gone.
- v0.3.1 fixes a bug that the real-machine test found (details below).

**Open-source files.** MIT `LICENSE` (GitHub detects it), a rewritten `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, three issue forms plus a config pointing security reports to private reporting, a PR template, and a new `ci` workflow: agent vet, test and cross-build, plus web typecheck and unit tests. The README has the ci, agent-linux, license and live badges, a "Send this prompt to your Grok Bot" quickstart with the exact prompt, screenshots, and a full "What the background agent does" section. That section covers every metric and its source, the 30-second interval and endpoint, what it never touches, the systemd unit, the launchd plist and the cron/background fallback line verbatim (generated from the real templates), and the one-command uninstall.

**Source links.** The footer says "Open source, MIT. Read every line on GitHub". The `/install` page and the landing's agent section say "open source · read every line" with links to the repo and to `types.go`. `install.sh` itself now carries the repo link, `vm-vitals status`, and the uninstall line.

**Repo settings via gh.** Description set, homepage https://vm-vitals.vercel.app, topics grokbot, monitoring, build-in-public, ai-agents, golang, nextjs. Private vulnerability reporting is on.

## The bug the real machine found

The first real install on this Mac showed memory "0 B of 0 B", load 0.00 and no network after 7 minutes. The report's own warnings said `exec: "sysctl": executable file not found in $PATH`. The launchd plist sets a PATH without /usr/sbin, and on macOS sysctl and netstat live there. So every macOS launchd install since v0.1.0 has reported empty memory, load, swap, uptime and network. The seeded demo data hid it.

v0.3.1 adds /usr/sbin:/sbin to the plist. The agent also appends the standard system dirs to its own PATH at startup, so old installs recover on upgrade. Under launchd's exact environment, v0.3.0 throws all five errors and v0.3.1 throws none.

While chasing that, I found that my own new uninstall unit test had booted out the live launchd agent. launchctl addresses jobs by label, and the test only redirected HOME. Uninstall now only touches a launchd job or systemd unit when its file is where install put it, and only removes a crontab line that points at its own config. Linux CI would have had the same exposure with the crontab.

## Verification

- **Real end-to-end on this Mac against prod, run twice.** The second run is the clean one: fresh browser, v0.3.1. Headless Chrome clicked Copy prompt for your Grok Bot, and the clipboard held the full prompt with the token. I ran the curl line from the prompt verbatim. Install took 11.6s and picked launchd, user scope. The landing page redirected to the dashboard at 24.5s with real data already on it ("10.5 GB of 16.0 GB" memory, load, network). The stored report had agent v0.3.1, zero collector warnings, and six agent jobs (Ollama, Claude Code, Grok). Then the run flipped the page public and clicked Copy link. The share page returned 200 with og:image, and the card rendered as PNG.
- **`vm-vitals status` on the real install** printed the launchd plist byte for byte as the README shows it, with `state = running, pid = …`.
- **One-command uninstall from prod, run twice for real.** Both runs removed the plist, binary, config and logs, and no launchd job remained.
- **Smoke test against prod: 59/59.** Before: 41. It now also covers install.sh's source and uninstall lines, uninstall.sh, both OG images, both Twitter images, /og/demo, manifest, robots, sitemap, icons, the /install page, and the footer source link.
- **Other checks.** `pnpm test` passes. `tsc` is clean. `next build` passes. `go vet` (darwin and linux) and `go test` pass. GitHub Actions ci and agent-linux are green on both pushed commits (de68034, b82fb34) and both tags.
- **Prod checks.** `/dl/*` redirects to the v0.3.1 release, every SEO route returns the right content type, and the canonical and og:image tags point at vm-vitals.vercel.app.
- **Secret scan.** gitleaks 8.30.1 (checksum verified, run from /tmp) found no leaks in the staged diff of each commit or in the full history. The working-tree hits were all in gitignored `web/.next` build caches and `fun.log`.

## Screenshots

All in `oss-shots/`, taken from production. Dashboard, share page and share card show the real paired Mac (MrKlean, "sweating a bit", 61, because its disk really is at 93%). Each page is captured at 1440px and at 390px. No page scrolls sideways at 390px; the script checks `scrollWidth`.

- `landing-hero.png`, `landing-desktop.png`, `landing-mobile.png`
- `dashboard-hero.png`, `dashboard-desktop.png`, `dashboard-mobile.png`
- `share-desktop.png`, `share-mobile.png`
- `install-desktop.png`, `install-mobile.png`
- `og-home.png`, `og-share.png` (the live card for the real machine)
- `crew.gif`, the hero crew acting out the scripted night (used in the README)

## Self-critique

What I changed after looking at my own screenshots:
- The crew row's dividers were uneven. I switched to the same 1px hairline grid as the other sections.
- Terminal comments in the agent section were clipped. Each now sits on its own line above its command.
- "0 machines reporting" undersold a quiet moment, so it hides at zero.
- Four separate 390px overflows: whitespace-pre code inside grid and flex children.
- "366 KB/s" collided with Ping, so units now render smaller than the number.
- Sparklines showed gaps: Chrome mis-measures `pathLength` dashes with non-scaling strokes. I dropped the draw-in animation.
- Network axis labels wrapped. They now use a compact format (1.7M, 439K).
- On mobile the crew list was very tall. Each member is now a row.
- The hero score was hidden on phones. It now shows.

What still isn't great:
- The characters are mine, drawn in code. They're consistent and readable at 34px, but a real illustrator would give them more personality.
- On phones the dashboard hero is a long scroll: name, Grok Bot, mood, EKG, then the score. A side-by-side compact layout would be tighter.
- The landing's share preview uses demo numbers, and the alt text says so. Charts are recharts restyled to monochrome, not hand-drawn SVG.
- crew.gif is 1.9 MB. gifski isn't installed, so it's an ffmpeg palette GIF.

## Leftovers and notes

- This Mac is back the way I found it: no agent installed. Both test machines I paired were deleted from prod. The pairings belonged to a headless browser's cookie, so Kris couldn't have managed them anyway. To watch this Mac for real, click the button on the site from your own browser. It takes about 25 seconds.
- `kris-mac-smoke` (m_r4rpyrvv8u) from the original launch is still on prod. It isn't mine, so I left it.
- The Mac's disk really is at 93% (17 GB free). Stash was not being dramatic.
- `vm-vitals status` now shows the running state cleanly. That dedupe fix shipped in v0.3.1.
- The other session's commit 4059b14 (linux-fix result) is in history untouched. I rebased onto it. It had exited by the time I replied, so nothing went back to it. I updated the shared deploy-targets memory note for v0.3.1.
- Releases: v0.3.0 (status, full uninstall) and v0.3.1 (macOS PATH fix, safer uninstall). RELEASE_BASE_URL on Vercel production points at v0.3.1.
