#!/bin/sh
# Cross-compile the agent for every supported target into web/public/dl/
# so the local web app can serve them at /dl/<name>. Upload the same files
# to a GitHub release (or any static host) and set RELEASE_BASE_URL in prod.
set -eu
cd "$(dirname "$0")"
VERSION="${VERSION:-$(git describe --tags --always --dirty 2>/dev/null || echo dev)}"
OUT="${OUT:-../web/public/dl}"
mkdir -p "$OUT"
for target in linux/amd64 linux/arm64 darwin/amd64 darwin/arm64; do
  os=${target%/*}; arch=${target#*/}
  echo "building $os/$arch"
  CGO_ENABLED=0 GOOS=$os GOARCH=$arch go build -trimpath \
    -ldflags "-s -w -X main.Version=$VERSION" \
    -o "$OUT/vm-vitals-$os-$arch" .
done
ls -la "$OUT"
