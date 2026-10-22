Deploy VM Vitals live ASAP (Kris approved). Read result.md for deploy steps.
1. Create a private GitHub repo mehh/vm-vitals (gh CLI) and push. Build the agent binaries with VERSION=v0.1.0 ./agent/build.sh and publish them as a GitHub release (make the repo public if release downloads need it; no secrets in the repo, so scan before pushing).
2. Provision Postgres (Neon through the Vercel Marketplace, or Vercel Postgres) and deploy web/ to Vercel under Kris's account using the vercel CLI. Set DATABASE_URL, NEXT_PUBLIC_APP_URL (the vercel.app URL), and RELEASE_BASE_URL. Skip Resend.
3. Smoke test the live URL: the homepage loads, /install.sh serves, and a pair+ingest from this Mac in a sandboxed HOME works. Do NOT install a launchd service on this Mac.
Never print secrets. Write progress to deploy-status.txt and the live URL plus any blockers (e.g. a CLI not logged in) to deploy-result.md.
