Kris wants VM Vitals showcased as a fun open-source project (the repo is already public). Make it trustworthy and inviting:
- An MIT LICENSE, plus a fun README with screenshots or GIFs, a "Send this prompt to your Grok Bot" quickstart, and the dashboard and share page.
- A clear "What the background agent does" section: exactly which metrics it collects, how often, where they're sent, what it never touches (no file contents, no keystrokes, no secrets), how to inspect the service (systemd/launchd/nohup files shown verbatim), and how to stop and uninstall it in one command. Add an `uninstall` subcommand if one doesn't exist.
- A link to the source from the website footer and install page ("open source, read every line").
- CONTRIBUTING.md, SECURITY.md, issue templates, and a CI badge. Also set the repo description, topics (grokbot, monitoring, build-in-public) and homepage via gh.
- Scan for secrets before pushing. Commit, push, deploy, and verify. Write the result to oss-result.md.

ALSO (Kris, top priority, expects it by morning):
- A really cool landing page featuring Grok Bot and its little agent friend blobs: illustrated or animated blob characters (SVG/CSS), a cheeky, playful UX and microcopy, and a hero with the "send this prompt to your Grok Bot" flow.
- A polished SEO setup: meta titles and descriptions, a dynamic OG and Twitter image for the homepage and for each machine's share page (with blobs and live stats), a favicon and apple-touch-icon, and a manifest.
- End-to-end flow: install, see real data on the dashboard within a minute, and share it with friends (a share button and a copy link). Verify with a real paired machine, then screenshot the landing, dashboard and OG image to oss-shots/.

DESIGN DIRECTION (Kris, after seeing the current page; this overrides any earlier styling):
- The current look is too boring and reads like a Bootstrap template. Rebuild the visual design from scratch.
- Pull the color scheme, type and vibe from https://grokbotaustin.vercel.app/ (fetch it and study its CSS). Brand it a bit like Grok: bold, dark, high-contrast, editorial.
- Feature the fun little Grok Bot avatar characters and agent blob friends prominently, with tasteful animation (idle bobbing, blinking, reacting to health). It should look cool and NOT cheesy: no generic card grids or default Tailwind and Bootstrap feel.
- Apply this to the landing, dashboard, share page and OG images. Screenshot at desktop and 390px to oss-shots/ and self-critique before shipping.
