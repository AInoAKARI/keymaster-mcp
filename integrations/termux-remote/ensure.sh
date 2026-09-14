#!/data/data/com.termux/files/usr/bin/bash
set -u
ROOT="$HOME/.akari-bridge"
PIDFILE="$ROOT/bridge.pid"
mkdir -p "$ROOT"

if [ -s "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  exit 0
fi

termux-wake-lock >/dev/null 2>&1 || true
nohup "$ROOT/bridge.sh" >> "$ROOT/nohup.log" 2>&1 &
echo $! > "$PIDFILE"
