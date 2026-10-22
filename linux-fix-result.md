# Linux fix result

Shipped as agent v0.2.1, not v0.1.1. v0.2.0 (network throughput) was already out, so a v0.1.1 tag on newer code would sort below the current release and point backwards. v0.2.1 is the patch release on top of v0.2.0. If you want a v0.1.1 tag anyway for the Grok Bot box, say so and I'll add it on the same commit.

An earlier run did the code, commit, push, release and deploy but never wrote this file. This session checked each step against the live system.

## 1. "report failed: malformed report"

The field was `disks`. On a box whose root is overlay (containers, some cloud images), every mount in `/proc/mounts` matched the skip list, so `disks()` returned a nil slice. Go marshals a nil slice as `null`, and the ingest route's `Array.isArray` check rejected the whole report. `top_procs`, `tools` and `jobs` could go null the same way.

Agent fixes (commit 11d9a91):
- `diskMounts()` always keeps the root mount, and `disks()` falls back to statfs on `/` if `/proc/mounts` gives nothing usable.
- `Report.normalize()` turns every nil list into `[]` before marshalling.
- Tests cover an overlay root, a rootfs root, a normal VM and the JSON shape (`agent/internal/collect/linux_test.go`, `collect_test.go`).

Server fixes:
- `web/src/lib/report.ts` `parseReport()` replaces the strict check. Null or missing lists become `[]`, wrong types become zero values, unknown fields are dropped, and a missing `v` means v1. Only a body that isn't a JSON object gets "malformed report".
- `web/scripts/report.test.mjs` has 7 unit tests. `smoke.mjs` gained checks for null lists, unknown fields and a non-object body.

## 2. Service install without a user bus

When `systemctl --user` can't reach systemd (no `XDG_RUNTIME_DIR`, no D-Bus, or no systemd at all), `vm-vitals install` no longer exits with an error. It starts the agent detached in its own session, writes `agent.pid`, logs to `~/.local/state/vm-vitals/agent.log` (`/var/log/vm-vitals/` as root) and adds a `@reboot` crontab line tagged `# vm-vitals`. If systemd looks fine but enable fails, it takes the same path. `vm-vitals uninstall` kills the process and removes the cron line. Code is in `agent/internal/svc/fallback_unix.go`, tests in `service_test.go`.

## Verification

- `go test ./...` and `GOOS=linux go vet ./...` pass locally. `node --test scripts/report.test.mjs` passes 7 of 7, and `tsc --noEmit` is clean.
- GitHub Actions `agent-linux` passed on main and on the v0.2.1 tag (runs 39725348220, 39725351261, 39725579502). This is the real amd64 Linux check. With `XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS` unset, `systemctl --user` printed "Failed to connect to bus", and `vm-vitals install` printed "Service installed (user scope): background process pid 6656 ... cron @reboot entry". The crontab line was present, the process was alive after 50 seconds, and agent.log had no "report failed". Uninstall then removed both the process and the cron line.
- Release v0.2.1 on mehh/vm-vitals has all four binaries. `https://vm-vitals.vercel.app/dl/vm-vitals-linux-amd64` redirects to the v0.2.1 asset, and the downloaded file is an x86-64 ELF that reports v0.2.1.
- The production Vercel deploy is Ready, and RELEASE_BASE_URL was updated for v0.2.1.
- `BASE=https://vm-vitals.vercel.app node scripts/smoke.mjs` ran against prod and every check passed, including "ingest null lists accepted" and "ingest unknown fields accepted". The smoke machine was deleted at the end.
- Replayed the exact payload a v0.2.0 Linux agent sends from an overlay-root box (`"disks":null`, `"top_procs":null`, `"tools":null`, `"jobs":null`, no `net`) against prod on a freshly paired machine. Ingest answered 200 `{"ok":true}`, the dashboard API showed health ok with an empty disks list, and the machine was deleted afterwards. So a Grok Bot box still on v0.2.0 starts reporting as soon as the deploy is live, before anyone reinstalls.
- Vercel Sandbox was tried first for the Linux run and the API returned 403 for this account, which is why the check lives in GitHub Actions.

## Leftovers

- The CI install run paired `m_xmkykuc8ys` (gh-runner-linux-test) on prod; it was deleted after the run, so nothing is left behind. Later manual runs of the workflow with a pair token will each leave one machine to delete.
- To fix the Grok Bot box, re-run the install command. It pulls v0.2.1 and falls back to the background runner on its own.
