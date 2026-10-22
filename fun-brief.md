# VM Vitals: Grok Bot vibe redesign
Kris's feedback: this tool is for Grok Bots. It's a fun, interesting tool full of charts, graphs and data. It shouldn't be dry.
1. Change the onboarding so "Get my install command" becomes "Get a prompt for your Grok Bot". Show a friendly copyable prompt the user pastes into their Grok Bot, e.g. "Hey Grok Bot, install VM Vitals on your computer so I can watch your vitals: run `curl -fsSL https://vm-vitals.vercel.app/install.sh | sh -s -- <pair token>` and tell me your dashboard link." Keep the raw command in a small "or run it yourself" toggle.
2. Make it exciting: playful copy, a bot personality ("your bot's heartbeat"), live animated charts (CPU, memory, disk, network sparklines and gauges), health score and mood, a fun share page and OG image, and empty states with personality. Dark, vibrant, tasteful.
3. Keep all smoke tests passing and add tests for the prompt flow. Don't print or commit secrets.
4. Commit, push to mehh/vm-vitals main, deploy to Vercel prod (add web/.vercelignore for public/dl/vm-vitals-*), and smoke-test the live URL.
Write progress to fun-status.txt, and write the final result to fun-result.md (live URL, what changed, screenshot paths).
