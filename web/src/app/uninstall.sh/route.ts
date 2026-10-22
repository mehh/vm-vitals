export const runtime = "nodejs";

/**
 * GET /uninstall.sh  ->  removes the agent, whatever version is installed.
 * Usage: curl -fsSL <host>/uninstall.sh | sh        (add sudo for a root install)
 * Runs `vm-vitals uninstall` if the binary is there, then sweeps every path
 * any agent version could have written, so older installs come out clean too.
 */
export async function GET() {
  const script = `#!/bin/sh
# VM Vitals uninstaller. Source: https://github.com/mehh/vm-vitals
# Stops the agent and deletes its service, binary, config and logs. Touches nothing else.
set -u

if [ "$(id -u)" = 0 ]; then ROOT=1; else ROOT=0; fi
OS=$(uname -s)

RAN=0
for b in /usr/local/bin/vm-vitals "$HOME/.local/bin/vm-vitals" "$(command -v vm-vitals 2>/dev/null || true)"; do
  if [ -n "$b" ] && [ -x "$b" ]; then "$b" uninstall || true; RAN=1; break; fi
done

# Sweep, in case the binary was missing or older than v0.3.
if [ "$OS" = Darwin ]; then
  if [ $ROOT = 1 ]; then
    launchctl bootout system/com.vmvitals.agent 2>/dev/null || true
    rm -f /Library/LaunchDaemons/com.vmvitals.agent.plist
    rm -rf /etc/vm-vitals /var/log/vm-vitals /usr/local/bin/vm-vitals
  else
    launchctl bootout "gui/$(id -u)/com.vmvitals.agent" 2>/dev/null || true
    rm -f "$HOME/Library/LaunchAgents/com.vmvitals.agent.plist"
    rm -rf "$HOME/.config/vm-vitals" "$HOME/Library/Logs/vm-vitals" "$HOME/.local/bin/vm-vitals"
  fi
else
  if [ $ROOT = 1 ]; then
    systemctl disable --now vm-vitals.service 2>/dev/null || true
    rm -f /etc/systemd/system/vm-vitals.service
    systemctl daemon-reload 2>/dev/null || true
    LOGDIR=/var/log/vm-vitals
    rm -rf /etc/vm-vitals /usr/local/bin/vm-vitals
  else
    systemctl --user disable --now vm-vitals.service 2>/dev/null || true
    rm -f "$HOME/.config/systemd/user/vm-vitals.service"
    systemctl --user daemon-reload 2>/dev/null || true
    LOGDIR="$HOME/.local/state/vm-vitals"
    rm -rf "$HOME/.config/vm-vitals" "$HOME/.local/bin/vm-vitals"
  fi
  if [ -f "$LOGDIR/agent.pid" ]; then kill "$(cat "$LOGDIR/agent.pid")" 2>/dev/null || true; fi
  rm -rf "$LOGDIR"
  if command -v crontab >/dev/null 2>&1 && crontab -l 2>/dev/null | grep -q '# vm-vitals$'; then
    crontab -l 2>/dev/null | grep -v '# vm-vitals$' | crontab -
  fi
fi

# The binary already said goodbye if it ran.
[ $RAN = 1 ] || echo "VM Vitals is uninstalled. Delete the machine from its dashboard to drop its history too."
`;
  return new Response(script, {
    headers: { "content-type": "text/x-shellscript; charset=utf-8", "cache-control": "no-cache" },
  });
}
