#!/bin/bash
# Watchdog: restarts `next dev` if it dies.
# Designed to be fully detached via setsid+nohup+disown so it survives
# the parent bash session ending.

cd /home/z/my-project

# Load .env.local (Next.js loads it too, but we want to be sure for any
# spawned subprocesses that we exec)
set -a
. .env.local 2>/dev/null
. .env 2>/dev/null
set +a

# Reset DATABASE_URL so it doesn't shadow TURSO_DATABASE_URL
unset DATABASE_URL

LOG=dev.log
PIDS_LOG=/tmp/mtq-dev.pid

while true; do
  echo "[$(date -u +%H:%M:%S)] watchdog: starting next dev..." >> "$LOG"
  # Start next dev in the foreground of THIS bash; we'll loop if it exits.
  ./node_modules/.bin/next dev -p 3000 >> "$LOG" 2>&1 &
  NEXT_PID=$!
  echo $NEXT_PID > "$PIDS_LOG"
  wait $NEXT_PID
  EXIT=$?
  echo "[$(date -u +%H:%M:%S)] watchdog: next dev exited (code=$EXIT). restarting in 2s..." >> "$LOG"
  sleep 2
done
