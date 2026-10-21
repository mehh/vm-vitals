# Build: VM Vitals (working name) - free, shareable health monitor for computers that run AI agents
Audience: indie hackers on X running Grok Bot / Claude Code / Codex on VMs and Mac minis. Goal is shareability, not revenue.
Deliver an MVP:
1. Agent: single-binary Go (or Node) daemon, installed with ONE line: `curl -fsSL <host>/install.sh | sh -s -- <pair-token>`. Installs systemd (Linux) or launchd (macOS) service. Every 30s reports disk, CPU, memory, load, swap, top processes, OOM kills, installed CLI tools (claude, codex, node, python, gcloud, tailscale...), and running agent jobs. No secrets, no env vars, no file contents ever.
2. Pairing: token in install command auto-registers the machine; no login loop. Optional claim later via email magic link.
3. Web app: Next.js + Postgres (Neon or Vercel Postgres), deployable to Vercel. Per-machine live dashboard with charts, alerts (disk>85%, OOM, job died), and a public share page + OG image card ("my AI's computer, live") for X posts. Incident timeline where users note what broke and what fixed it, shareable.
4. README with install, a demo GIF plan, and a Grok Bot setup snippet (one prompt that tells a bot to install it on its own computer).
Work in a git repo here. Write progress to status.txt (one line per milestone) and a final summary to result.md: what works, how to run locally, what's needed to deploy (accounts/env vars by NAME only). Do not deploy, push to public GitHub, or post anywhere.
