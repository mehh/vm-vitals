# Security policy

VM Vitals puts a daemon on machines that also hold API keys and source code. If you find a way it leaks more than it says it does, I want to hear about it.

## Supported versions

| What | Supported |
|---|---|
| Latest agent release, currently v0.3.x | Yes |
| Older agent releases | No. Reinstall with the install line to upgrade |
| The hosted site at https://vm-vitals.vercel.app | Yes |
| Self-hosted copies of the web app | Best effort, if the bug is also in `main` |

## Report a vulnerability

Use GitHub's private vulnerability reporting. Go to the Security tab of [mehh/vm-vitals](https://github.com/mehh/vm-vitals/security) and click "Report a vulnerability", or open https://github.com/mehh/vm-vitals/security/advisories/new directly.

Please don't open a public issue or PR for a security bug. Include what you did, what you saw, the agent version from `vm-vitals version` and your OS. A proof of concept helps a lot.

## Response time

This is a side project, so it's best effort. Expect a first reply within a few days. Once a fix ships I'll credit you in the advisory unless you'd rather stay anonymous.

## In scope

- The agent sending or reading anything beyond what the README section "What the background agent does" and the `/privacy` page list. Examples are env vars, full command lines, file contents or anything from the user's home directory.
- Viewing or changing another person's machine dashboard, incidents or alerts without being its owner.
- Sending reports to `/api/ingest` for a machine you don't hold the token for.
- Token handling. Machine tokens are stored as SHA-256 hashes server-side, and pair tokens expire 24 hours after they're created. A way around either counts.
- Magic-link sign-in issues, like reusing a link or claiming someone else's machines.
- Installer integrity. Tricking `/install.sh` or `/dl/<file>` into serving a binary that didn't come from the release, or into running something other than the agent. Note that the installer doesn't verify a checksum today. It relies on HTTPS to the host.
- Public share pages exposing data that's private on the dashboard.

## Out of scope

- Anything that needs root or physical access to the monitored machine already. An attacker with root can read the config file and the machine token, and that's expected.
- Data a user chose to publish on their own share page.
- Rate limiting, missing security headers and similar findings without a real attack attached.
- Social engineering, spam, and denial of service against the hosted site.
- Bugs in Vercel, Neon, GitHub or other services we run on. Report those to them.

## What the agent can and can't do

This is the threat model, so you know what counts as a leak. You can check all of it in `agent/internal/collect/`.

It runs as the user who installed it. If you installed with sudo, that's root, as a system-wide systemd service. Otherwise it's a user systemd service on Linux, a launchd agent on macOS, or a background process with a cron entry when there's no user systemd bus.

On Linux it reads `/proc` (stat, meminfo, loadavg, uptime, mounts, vmstat, net/dev, kernel osrelease) and calls statfs on each real mount. It also runs `journalctl -k` and keeps only "Killed process N (name)" fragments, when the journal is readable.

On macOS it runs `sysctl`, `vm_stat` and `netstat -ib`.

On both it runs `ps` twice. The first call gets pid, parent pid, CPU, memory, elapsed time and executable name. The second gets the command line, which gets cut to the basenames of argv[0] and argv[1] right away. The rest is thrown away before it lands in a struct.

For a fixed list of CLIs in `knownTools`, it checks PATH and runs `<tool> --version` or the listed equivalent, keeping the first line up to 80 characters. Every child process gets a minimal env: PATH, HOME, `LANG=C`, `LC_ALL=C`, `NO_COLOR=1`, `CI=1` and `TERM=dumb`.

From its own environment the collectors read PATH and HOME. The installer also checks whether `XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS` are set to decide if a user systemd service will work. It doesn't send those values anywhere.

It posts JSON to the server URL in its config, with the machine token as a bearer token. The hosted site uses HTTPS. The agent doesn't force HTTPS, so a self-hosted server on plain HTTP gets plain HTTP.

It doesn't read file contents, keystrokes, clipboard, browser data or shell history. It doesn't listen on any port. It doesn't run anything the server tells it to. The only thing it takes from the server's reply is the report interval, and it ignores anything under 10 seconds.
