Bug from a real Linux install (Grok Bot box, amd64, no systemd user bus):
1. Every report fails with "report failed: malformed report". Find which field the Linux collector sends that the server rejects, fix it (be lenient server-side with optional or unknown fields too), and add a test.
2. Service install fails when there's no user D-Bus or XDG_RUNTIME_DIR (systemctl --user is unavailable). Fall back to a nohup or cron @reboot runner and don't exit with an error.
Commit, push, cut release v0.1.1, deploy, and verify. Write the result to linux-fix-result.md.
