#!/bin/bash
# MTQΣ dev-server watchdog v3 (Task 47 — root-cause remediation round 2).
#
# Changes vs v2 (task42):
#   - PRE-BOOT SOURCE-INTEGRITY HEAL: before every `next dev` start, runs
#     scripts/source-integrity-heal.ts — unstaged deletions of HEAD-tracked
#     files (the recurring /api/constituency/upload deletion class, 5×) are
#     restored BEFORE the server compiles routes. Sentineled via
#     db/ALLOW-FILE-DELETIONS; staged/committed deletions are respected.
#   - IN-PROCESS GUARD (belt): src/instrumentation.ts now runs the same
#     restore at boot + every 60s and the cloud-sync write-behind itself —
#     dump freshness no longer depends on THIS watchdog surviving (incident
#     #7: re-image killed the watchdog while the server kept running).
#
# Carried from v2:
#   - PRE-BOOT DB SELF-HEAL: before every `next dev` start, runs
#     scripts/db-selfheal.ts — a wiped/regressed data layer is restored
#     forward-only from the git-tracked cloud dumps BEFORE the chain node
#     can re-seed genesis. (Belt to the in-process guard in
#     src/lib/chain/node.ts ensureChainNode().)
#   - CLOUD-SYNC LOOP: a detached subshell refreshes
#     backups/db-snapshots/latest-*.sql every 60s (write-behind, bounded
#     loss window) and kills the server on the live-regression signature
#     (see scripts/db-cloud-sync.ts) — this loop then reboots it through
#     the self-heal path.
#   - PORT GUARD: if :3000 is already healthy, supervise passively instead
#     of spawning a duplicate server (EADDRINUSE crash-loop protection).
#
# Start fully detached (survives the parent bash session ending):
#   ( setsid bash dev-watchdog.sh >> /tmp/watchdog-launch.log 2>&1 & )
#
# Designed to be launched via the double-fork orphan pattern (Task 31:
# single-fork spawns are reaped by the tool-call teardown).

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
WATCHDOG_PID_LOG=/tmp/mtq-watchdog.pid

# 2026-10-21 (Task 8): cap the Node heap — the 4GB box also runs
# mini-services; an uncapped next-server balloons past 1.2GB during
# Turbopack compiles and the kernel OOM-killer takes it down.
# 768MB keeps compiles within budget.
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=768"

echo $$ > "$WATCHDOG_PID_LOG"
echo "[$(date -u +%H:%M:%S)] watchdog v3 up (pid $$) — self-heal + source-integrity + cloud-sync armed" >> "$LOG"

# Task 42: cloud-layer sync loop (detached subshell). Never fatal.
(
  while true; do
    bun run scripts/db-cloud-sync.ts >> /tmp/db-cloud-sync.log 2>&1 || true
    sleep 60
  done
) &

while true; do
  # Port guard: a healthy server is already up (ours from a previous loop,
  # or an externally-started one) — supervise passively, never double-start.
  if curl -s -m 3 -o /dev/null http://localhost:3000/api/health 2>/dev/null; then
    sleep 15
    continue
  fi

  # Pre-boot source-integrity heal (Task 47): restore unstaged deletions of
  # HEAD-tracked files BEFORE the server compiles routes.
  echo "[$(date -u +%H:%M:%S)] watchdog: :3000 down — source-integrity heal before boot..." >> "$LOG"
  bun run scripts/source-integrity-heal.ts >> "$LOG" 2>&1 || true

  # Pre-boot DB self-heal (Task 42): restore a wiped/regressed data layer
  # BEFORE the chain node boots — the silent re-seed path is closed.
  echo "[$(date -u +%H:%M:%S)] watchdog: :3000 down — running DB self-heal before boot..." >> "$LOG"
  if bun run scripts/db-selfheal.ts >> "$LOG" 2>&1; then
    :
  else
    echo "[$(date -u +%H:%M:%S)] watchdog: self-heal FAILED — booting anyway; watch for a re-seed in dev.log" >> "$LOG"
  fi

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
