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

# 2026-10-21 (Task 8): cap the Node heap — the 4GB box also runs the
# mtq-feed (3003) + keeper (3040) mini-services (~1.9GB RSS combined);
# an uncapped next-server balloons past 1.2GB during Turbopack compiles
# and the kernel OOM-killer takes it down (evidence: dmesg oom-kill
# next-server pid 6276). 768MB keeps compiles within budget.
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=768"

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
