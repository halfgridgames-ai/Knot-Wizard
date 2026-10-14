#!/usr/bin/env bash
# Copy the built web game (../web) into www/ and sync it into the Android project.
# Run from anywhere:  bash android-app/sync-web.sh
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/../web"
DEST="$HERE/www"

if [ ! -f "$SRC/index.html" ]; then
  echo "error: $SRC/index.html not found - run build-web.py first" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST"
# The service worker is pointless inside the app (files are already local) and
# can serve stale code after an update, so it is left out. README.md is docs only.
for f in "$SRC"/*; do
  name="$(basename "$f")"
  case "$name" in
    sw.js|README.md) continue ;;
  esac
  cp -R "$f" "$DEST/"
done

cd "$HERE"
npx cap sync android
