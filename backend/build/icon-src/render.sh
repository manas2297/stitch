#!/bin/sh
# Renders appicon.svg to ../appicon.png (1024x1024, transparent corners), which
# `wails build` turns into the macOS .icns and Windows .ico. Needs Google Chrome.
set -e
cd "$(dirname "$0")"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
printf '<html><body style="margin:0"><img src="file://%s/appicon.svg" width="1024" height="1024" style="display:block"></body></html>' "$PWD" > "$tmp/icon.html"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --default-background-color=00000000 --allow-file-access-from-files --window-size=1024,1024 \
  --screenshot="$PWD/../appicon.png" "file://$tmp/icon.html" 2>/dev/null
# Wails only generates the Windows icon when it's missing, so drop the stale one.
rm -f ../windows/icon.ico
echo "Wrote $(cd .. && pwd)/appicon.png"
