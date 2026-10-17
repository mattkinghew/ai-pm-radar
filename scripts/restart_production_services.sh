#!/usr/bin/env bash
# AI PM Radar — pinned 2026-10-14 15:00 historical snapshot recovery.
# Explicit, manual one-key start only; does not install a LaunchAgent or auto-deploy.
set -euo pipefail
umask 077

ROOT="/Users/mattgor/Documents/Daily/ai-pm-radar"
SUPERVISOR="$ROOT/scripts/pinned-recovery-supervisor.mjs"
STATE="$HOME/Library/Application Support/AI PM Radar/recovery-state"
LOGS="$HOME/Library/Logs/AI PM Radar"
PIDFILE="$STATE/pinned-recovery.pid"
LOGFILE="$LOGS/production-pinned-recovery.log"

cd "$ROOT"
mkdir -p "$STATE" "$LOGS"
chmod 700 "$STATE"
test -f "$SUPERVISOR" || { echo "Missing pinned recovery supervisor; stopped." >&2; exit 1; }
node --check "$SUPERVISOR"

# A deliberate defense-in-depth declaration. Pinned recovery launches NO cloud
# worker, D1 binding, Cloud Sync writer, scheduled research job or migration.
export cloud_write_authorized=false
export CLOUD_WRITE_AUTHORIZED=false
export AI_PM_RADAR_CLOUD_WRITE_AUTHORIZED=false

pid_in_use() {
  local port="$1"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | grep -q '^[0-9]' || return 1
}

if pid_in_use 4320 || pid_in_use 4310; then
  echo "Radar Origin/Helper port is already occupied; refusing to start duplicate services." >&2
  echo "Inspect lsof on ports 4320/4310 and run npm run health:mobile manually." >&2
  exit 2
fi
if [[ -f "$PIDFILE" ]]; then
  old_pid="$(cat "$PIDFILE" || true)"
  if [[ "$old_pid" =~ ^[0-9]+$ ]] && kill -0 "$old_pid" 2>/dev/null; then
    echo "Recovery PID $old_pid still exists. Inspect before retrying; no process killed." >&2
    exit 2
  fi
fi

echo "Starting pinned historical Radar Origin, Helper and dedicated Tunnel..."
nohup node "$SUPERVISOR" </dev/null >>"$LOGFILE" 2>&1 &
pid=$!
printf '%s\n' "$pid" > "$PIDFILE"
chmod 600 "$PIDFILE"
sleep 2

if ! kill -0 "$pid" 2>/dev/null; then
  echo "Recovery supervisor exited on startup. Review the restricted local recovery log." >&2
  exit 1
fi

if npm run health:mobile; then
  echo "Pinned Radar recovery health PASS. Supervisor PID=$pid"
  echo "Origin 4320 / Helper 4310 verified; Tunnel may take longer to establish."
  echo "The public HTTPS path remains Cloudflare Access protected."
else
  echo "Pinned Origin/Helper health FAILED. Stopping only the newly started recovery supervisor." >&2
  kill -TERM "$pid" 2>/dev/null || true
  exit 1
fi
