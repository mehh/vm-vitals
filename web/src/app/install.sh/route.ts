import { appUrl } from "@/lib/format";

export const runtime = "nodejs";

/**
 * GET /install.sh  ->  the one-line installer, with this deployment's URL baked in.
 * Usage: curl -fsSL <host>/install.sh | sh -s -- <pair-token>
 */
export async function GET() {
  const host = appUrl();
  const script = `#!/bin/sh
# VM Vitals installer. Pairs this machine and installs a background service.
# Reads: nothing of yours. Sends: numbers, process names, CLI tool versions.
set -eu

HOST="\${VM_VITALS_HOST:-${host}}"
TOKEN="\${1:-\${VM_VITALS_TOKEN:-}}"
NAME="\${VM_VITALS_NAME:-}"

if [ -z "$TOKEN" ]; then
  echo "usage: curl -fsSL $HOST/install.sh | sh -s -- <pair-token>" >&2
  echo "Get a pair token at $HOST" >&2
  exit 2
fi

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$OS" in
  linux|darwin) ;;
  *) echo "unsupported OS: $OS (Linux and macOS only)" >&2; exit 1 ;;
esac
case "$ARCH" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac

TMP=$(mktemp -d 2>/dev/null || mktemp -d -t vmvitals)
trap 'rm -rf "$TMP"' EXIT
URL="$HOST/dl/vm-vitals-$OS-$ARCH"
echo "Downloading $URL"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$TMP/vm-vitals"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TMP/vm-vitals" "$URL"
else
  echo "need curl or wget" >&2; exit 1
fi
chmod +x "$TMP/vm-vitals"

if [ -n "$NAME" ]; then
  "$TMP/vm-vitals" install --server "$HOST" --token "$TOKEN" --name "$NAME"
else
  "$TMP/vm-vitals" install --server "$HOST" --token "$TOKEN"
fi

echo
echo "Done. See exactly what gets reported with:  vm-vitals once"
case "$OS" in
  darwin) echo "Logs: ~/Library/Logs/vm-vitals/agent.log   Remove: vm-vitals uninstall" ;;
  linux)  if [ "$(id -u)" = 0 ]; then echo "Logs: journalctl -u vm-vitals -f (or /var/log/vm-vitals/agent.log without systemd)   Remove: vm-vitals uninstall"; else echo "Logs: journalctl --user -u vm-vitals -f (or ~/.local/state/vm-vitals/agent.log without systemd)   Remove: vm-vitals uninstall"; fi ;;
esac
`;
  return new Response(script, {
    headers: { "content-type": "text/x-shellscript; charset=utf-8", "cache-control": "no-cache" },
  });
}
