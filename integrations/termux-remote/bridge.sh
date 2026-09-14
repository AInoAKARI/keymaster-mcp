#!/data/data/com.termux/files/usr/bin/bash
set -u

CONTROL_REPO="AInoAKARI/akari-automation"
CONTROL_ISSUE="3"
ROOT="$HOME/.akari-bridge"
STATE="$ROOT/last-id"
LOG="$ROOT/bridge.log"
POLL_SECONDS="${AKARI_BRIDGE_POLL_SECONDS:-20}"
mkdir -p "$ROOT"
touch "$STATE" "$LOG"

update_issue() {
  local body="$1"
  gh issue edit "$CONTROL_ISSUE" -R "$CONTROL_REPO" --body "$body" >/dev/null 2>&1 || true
}

while true; do
  BODY="$(gh issue view "$CONTROL_ISSUE" -R "$CONTROL_REPO" --json body -q .body 2>/dev/null || true)"
  if [ -z "$BODY" ] || ! printf '%s' "$BODY" | jq -e . >/dev/null 2>&1; then
    sleep "$POLL_SECONDS"
    continue
  fi

  ID="$(printf '%s' "$BODY" | jq -r '.id // empty')"
  STATUS="$(printf '%s' "$BODY" | jq -r '.status // empty')"
  CMD="$(printf '%s' "$BODY" | jq -r '.command // empty')"
  CWD="$(printf '%s' "$BODY" | jq -r '.cwd // "~"')"
  LAST_ID="$(cat "$STATE" 2>/dev/null || true)"

  if [ -n "$ID" ] && [ "$STATUS" = "queued" ] && [ -n "$CMD" ] && [ "$ID" != "$LAST_ID" ]; then
    printf '%s' "$ID" > "$STATE"
    STARTED="$(date -Iseconds)"
    RUNNING="$(jq -cn --arg id "$ID" --arg cmd "$CMD" --arg cwd "$CWD" --arg started "$STARTED" '{id:$id,status:"running",command:$cmd,cwd:$cwd,started_at:$started,result:"",exit_code:null}')"
    update_issue "$RUNNING"

    TMP="$ROOT/result.tmp"
    : > "$TMP"

    if [ "$CWD" = "~" ]; then
      CWD="$HOME"
    fi

    (
      cd "$CWD" 2>/dev/null || cd "$HOME"
      timeout 1800 bash -lc "$CMD"
    ) >"$TMP" 2>&1
    CODE=$?

    RESULT="$(tail -c 12000 "$TMP" 2>/dev/null || true)"
    FINISHED="$(date -Iseconds)"
    FINAL_STATUS="done"
    [ "$CODE" -eq 0 ] || FINAL_STATUS="failed"

    FINAL="$(jq -cn \
      --arg id "$ID" \
      --arg status "$FINAL_STATUS" \
      --arg cmd "$CMD" \
      --arg cwd "$CWD" \
      --arg started "$STARTED" \
      --arg finished "$FINISHED" \
      --arg result "$RESULT" \
      --argjson code "$CODE" \
      '{id:$id,status:$status,command:$cmd,cwd:$cwd,started_at:$started,finished_at:$finished,result:$result,exit_code:$code}')"

    update_issue "$FINAL"
    printf '%s [%s] exit=%s cmd=%s\n' "$FINISHED" "$FINAL_STATUS" "$CODE" "$CMD" >> "$LOG"
  fi

  sleep "$POLL_SECONDS"
done
