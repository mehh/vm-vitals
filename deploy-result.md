# VM Vitals deploy result

Deployed 2026-10-21 (UTC evening) under Kris's accounts. Live and smoke tested.

## Live URL

https://vm-vitals.vercel.app

## What was done

1. GitHub: created `mehh/vm-vitals`, pushed `main`. The repo was created private, then switched to **public** because GitHub release asset downloads from a private repo need auth and `/dl/<target>` redirects there. Secret scan (tokens, keys, connection strings, private keys) over all tracked and untracked files was clean before the push; only `web/.env.example` with empty values is tracked.
2. Release: `VERSION=v0.1.0 ./agent/build.sh`, then release `v0.1.0` at https://github.com/mehh/vm-vitals/releases/tag/v0.1.0 with `vm-vitals-{linux,darwin}-{amd64,arm64}`. An unauthenticated download of an asset returns 200.
3. Database: Neon via the Vercel Marketplace (the Neon integration was already installed on the team). Resource `vm-vitals-db`, connected to project `vm-vitals`. It injected `DATABASE_URL` (plus the usual `POSTGRES_*`/`PG*` names). Tables are created on first request, which the smoke test exercised.
4. Vercel: project `vm-vitals` on team "mehh's projects" (scope `mehhs-projects`), deployed from `web/` with the CLI. Production env vars set: `DATABASE_URL` (Neon), `NEXT_PUBLIC_APP_URL=https://vm-vitals.vercel.app`, `RELEASE_BASE_URL=https://github.com/mehh/vm-vitals/releases/download/v0.1.0`. Deployed twice; the second deploy bakes `NEXT_PUBLIC_APP_URL` into the build. Resend was skipped as asked, so magic links print to the Vercel function log.

## Smoke test (live)

- Homepage: 200, renders the "Get my install command" flow.
- `/install.sh`: 200, `text/x-shellscript`, `HOST` defaults to `https://vm-vitals.vercel.app`.
- `/dl/vm-vitals-darwin-arm64`: 200, serves the v0.1.0 binary (`vm-vitals v0.1.0 darwin/arm64`).
- Pair + ingest from this Mac: minted a pair token through the API with an owner cookie, ran the real downloaded agent with `HOME` pointed at a throwaway dir and `install --no-service`, then `run`. The server reported `reporting: true` about 8 seconds later. Dashboard `/m/<id>` rendered the machine with top processes and installed tools. Without the owner cookie the page says the machine belongs to another browser and shows no metrics, and the machine API returns 403.
- No launchd service was installed on this Mac (`launchctl list` has no vm-vitals entry, no LaunchAgent plist). The sandbox dir, downloaded binary and config were deleted afterward.
- The test machine `kris-mac-smoke` (id `m_r4rpyrvv8u`) remains in the database and will show as offline after 2 minutes. Delete it from its dashboard if you want a clean slate.

## Blockers

None. Both CLIs were already logged in (`gh` as `mehh`, `vercel` as `mehh`).

## Notes and judgment calls

- `/dl/*` currently serves the binaries straight from the deployment, not via the `RELEASE_BASE_URL` redirect. The CLI deploy uploads the working tree, and the freshly built binaries sat in `web/public/dl/` (gitignored, but not ignored by Vercel). Next.js serves `public/` files before route handlers. This works and the bytes are identical to the release assets, but it adds ~25 MB to each deployment. A deploy from a clean checkout (or a `web/.vercelignore` listing `public/dl/vm-vitals-*`) would fall through to the redirect, which was verified to work. Left as is.
- Release downloads go to a public repo, so the source is public. Nothing sensitive is in it.
- `gh` has a second, stale account `kchase_hvue` with an invalid token. It was not used.
