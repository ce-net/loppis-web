#!/bin/sh
# ce app entry: serve the marketplace page + /api node proxy. Finds node past the
# supervisor's bare PATH (nvm/homebrew installs).
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$DIR/daemon.log"
exec >> "$LOG" 2>&1
if command -v node >/dev/null 2>&1; then exec node "$DIR/dev-server.mjs"; fi
for cand in "$HOME"/.nvm/versions/node/*/bin/node /opt/homebrew/bin/node /usr/local/bin/node; do
  [ -x "$cand" ] && exec "$cand" "$DIR/dev-server.mjs"
done
echo "loppis-web: no node runtime found" >&2; exit 127
