#!/data/data/com.termux/files/usr/bin/bash
set -u

BASE="https://raw.githubusercontent.com/AInoAKARI/keymaster-mcp/main/integrations/termux-remote"
ROOT="$HOME/.akari-bridge"
mkdir -p "$ROOT"

pkg update -y
pkg upgrade -y || true
dpkg --configure -a || true

if ! pkg install -y gh jq curl coreutils termux-api; then
  apt remove -y ffmpeg >/dev/null 2>&1 || true
  dpkg --configure -a || true
  pkg upgrade -y || true
  pkg install -y gh jq curl coreutils termux-api
fi

curl -fsSL "$BASE/bridge.sh" -o "$ROOT/bridge.sh"
curl -fsSL "$BASE/ensure.sh" -o "$ROOT/ensure.sh"
chmod 700 "$ROOT/bridge.sh" "$ROOT/ensure.sh"

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo
  echo 'GitHub認証を1回だけ行います。表示された案内に従ってブラウザ認証してください。'
  gh auth login --hostname github.com --git-protocol https --web
fi

if ! gh issue view 3 -R AInoAKARI/akari-automation >/dev/null 2>&1; then
  echo 'GitHub認証はできましたが、制御キューへアクセスできません。'
  exit 1
fi

"$ROOT/ensure.sh"

termux-job-scheduler \
  --script "$ROOT/ensure.sh" \
  --job-id 24803 \
  --period-ms 900000 \
  --persisted true >/dev/null 2>&1 || true

BOOT_CMD="printf 'AKARI_ANDROID_BRIDGE_OK\\n'; uname -a; command -v termux-microphone-record || true"
BODY="$(jq -cn --arg cmd "$BOOT_CMD" '{id:"bootstrap-ready",status:"queued",command:$cmd,cwd:"~",result:"",exit_code:null}')"
gh issue edit 3 -R AInoAKARI/akari-automation --body "$BODY" >/dev/null

echo
echo 'AIﾉアカリ☆ Android Bridge: 接続待ち'
echo 'この画面は閉じてOKです。20〜40秒後にGPT側から疎通確認できます。'
