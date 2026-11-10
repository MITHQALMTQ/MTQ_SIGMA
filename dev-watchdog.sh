#!/bin/bash
# MTQΣ dev-server watchdog v5 (V31 TURN 3 — permanent startup repair).
#
# Changes vs v4 (V31 TURN 3):
#   - RUNTIME DEPENDENCY PREFLIGHT before every `next dev` start: the
#     Incident-22 fourth recurrence (2026-11-09T14:51Z) proved the re-image
#     crash class — git realigns source while node_modules keeps the stale
#     image's dependency state (next 16.4.5 + @next/swc 16.1.3 + missing
#     vendored meriyah) → next dev dies at next.config.ts load and the old
#     watchdog crash-looped through it. Now: preflight (scripts/runtime-
#     preflight.ts) → bun install --frozen-lockfile on mismatch → re-check →
#     still mismatched → DO NOT START next dev (honest blocked status,
#     retry in 60s). The application never starts on an unverified runtime.
#   - FAIL-CLOSED DB SELF-HEAL EXIT CONTRACT: db-selfheal exit 1 (authorized
#     restore failed) or exit 2 (recovery REFUSED fail-closed) → next dev is
#     NOT started (the old "booting anyway" behavior re-seeded genesis over
#     unadjudicated databases — the silent divergence path is closed).
#
# Changes vs v3 (task47):
#   - PRE-BOOT GIT-DRIFT GUARD: before every `next dev` start, runs
#     scripts/git-drift-guard.ts — incident #8 (2026-11-07) proved the last
#     unprotected re-image surface: .git restored to a mid-session snapshot
#     while origin/main was 26 commits ahead → the server booted STALE CODE
#     and served it until a human noticed. The guard fetches, classifies
#     local HEAD vs origin/main, and realigns forward-only (fast-forward, or
#     diverged-with-content-subsumption-proof → archive + reset --hard).
#     The LIVE DATABASES are gitignored — never touched by a realign. When
#     package.json/bun.lock/prisma schema changed across the realign it also
#     refreshes the runtime layer (bun install + prisma generate).
#   - DRIFT-SUPERVISION SUBLOOP: every 60s while the server runs, the same
#     guard re-checks (fetch throttled to 5 min inside the script); on a
#     realign it kills :3000 (only when THIS watchdog is alive) so the main
#     loop reboots the server through the full heal path on the new code.
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

# V31 TURN 3 (R-5 §7): SINGLETON LOCK — exactly one watchdog per sandbox.
# Acquired before ANY other action so a refused duplicate exits without
# touching the pid file, the log tail, or the supervision loops. Without
# this, a second entry (platform dev-entrypoint retry racing the pid-file
# write, cron backstop remediation, manual start) would run a second
# drift-guard loop, a second cloud-sync write-behind (concurrent dump
# writes), and a second next-dev management loop (EADDRINUSE ping-pong) —
# the OVERLAP_SKIP-class concurrency hazard, now structural rather than
# schedulable.
exec 9>/tmp/mtq-watchdog.lock
if ! flock -n 9; then
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] watchdog: singleton lock held by another instance — this start is a no-op (no duplicate supervision)" >> /tmp/watchdog-launch.log
  exit 0
fi

# Load .env.local (Next.js loads it too, but we want to be sure for any
# spawned subprocesses that we exec)
set -a
. .env.local 2>/dev/null
. .env 2>/dev/null
set +a

# Reset DATABASE_URL so it doesn't shadow TURSO_DATABASE_URL
unset DATABASE_URL

# 2026-11-08 ROOT-CAUSE FIX (stale-secret pinning class): this watchdog is a
# LONG-LIVED shell, so any secret sourced above stays exported in OUR
# environment forever — every `next dev` we spawn INHERITS it, and Next.js
# deliberately never overwrites pre-set process.env values with .env.local
# values. Live incident: the owner pasted a fresh GEMINI_API_KEY into
# .env.local, but this shell still exported the leak-revoked AIza… key from
# its own boot hours earlier → the restarted server kept answering with the
# DEAD key (403 "reported as leaked") no matter how many times .env.local was
# fixed or the server restarted. Fix: NEVER pass secrets through this shell —
# unset them here so the ONLY path for keys into next dev is Next.js's own
# .env.local loading, which is re-read fresh at every boot. (The bun
# self-heal/cloud-sync scripts this watchdog execs need DATABASE_URL-class
# config only — never AI/FRED keys.)
unset GEMINI_API_KEY GROQ_API_KEY HUGGINGFACE_API_KEY NVIDIA_API_KEY OPENROUTER_API_KEY FRED_API_KEY

LOG=dev.log
PIDS_LOG=/tmp/mtq-dev.pid
WATCHDOG_PID_LOG=/tmp/mtq-watchdog.pid

# 2026-10-21 (Task 8): cap the Node heap — the 4GB box also runs
# mini-services; an uncapped next-server balloons past 1.2GB during
# Turbopack compiles and the kernel OOM-killer takes it down.
# 768MB keeps compiles within budget.
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=768"

echo $$ > "$WATCHDOG_PID_LOG"
echo "[$(date -u +%H:%M:%S)] watchdog v5 up (pid $$) — git-drift + source-integrity + runtime-preflight + generation-gated self-heal + cloud-sync armed" >> "$LOG"

# Task 60: git-drift supervision loop (detached subshell). Never fatal.
# The guard's own fetch is throttled (5 min) so a 60s cadence stays polite;
# on REALIGNED it kills :3000 itself (verifying THIS watchdog is alive), the
# main loop's `wait` returns, and the reboot boots the realigned code.
(
  while true; do
    bun run scripts/git-drift-guard.ts >> "$LOG" 2>&1
    sleep 60
  done
) &

# Task 42: cloud-layer sync loop (detached subshell). Never fatal.
(
  while true; do
    bun run scripts/db-cloud-sync.ts >> /tmp/db-cloud-sync.log 2>&1 || true
    sleep 60
  done
) &

while true; do
  # Port guard: a HEALTHY server is already up (ours from a previous loop,
  # or an externally-started one) — supervise passively, never double-start.
  # V31 TURN 3 (readiness verification): "healthy" = HTTP 200 on /api/health,
  # NOT merely "a listener answered". Proven live on 2026-11-09T15:2xZ: the
  # instrumentation MODULE_UNPARSABLE defect served HTTP 500 on every route,
  # yet `curl -s` exits 0 on any HTTP status — this watchdog passively
  # supervised a dead-in-effect server indefinitely. A non-200 responder is
  # now reclaimed through the full heal chain (kill + guard → integrity →
  # preflight → selfheal → next dev). Connection failure (code 000) still
  # means "port free" — boot normally, no kill.
  HEALTH_CODE=$(curl -s -m 3 -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)
  if [ "$HEALTH_CODE" = "200" ]; then
    sleep 15
    continue
  fi
  if [ -n "$HEALTH_CODE" ] && [ "$HEALTH_CODE" != "000" ]; then
    echo "[$(date -u +%H:%M:%S)] watchdog: :3000 answers but NOT healthy (HTTP $HEALTH_CODE) — reclaiming the port through the full heal chain" >> "$LOG"
    pkill -f "node_modules/.bin/next dev" >> "$LOG" 2>&1 || true
    pkill -f "next-server" >> "$LOG" 2>&1 || true
    sleep 3
  fi

  # Pre-boot git-drift guard (Task 60): realign HEAD to origin BEFORE the
  # source-integrity heal (the heal restores against the NEW HEAD) and
  # BEFORE the server compiles any code. Exit 42 = realigned (boot will
  # compile the new code); exit 1 = BLOCKED (unique local content / dirty
  # tree) — boot anyway on local code, the battery will shout.
  echo "[$(date -u +%H:%M:%S)] watchdog: :3000 down — git-drift guard before boot..." >> "$LOG"
  bun run scripts/git-drift-guard.ts >> "$LOG" 2>&1
  DRIFT_RC=$?
  if [ "$DRIFT_RC" -eq 42 ]; then
    echo "[$(date -u +%H:%M:%S)] watchdog: git-drift REALIGNED HEAD — booting the realigned code." >> "$LOG"
  elif [ "$DRIFT_RC" -ne 0 ]; then
    echo "[$(date -u +%H:%M:%S)] watchdog: git-drift BLOCKED (rc=$DRIFT_RC) — booting local HEAD; run scripts/session-open-battery.sh to decide." >> "$LOG"
  fi

  # Pre-boot source-integrity heal (Task 47): restore unstaged deletions of
  # HEAD-tracked files BEFORE the server compiles routes.
  echo "[$(date -u +%H:%M:%S)] watchdog: :3000 down — source-integrity heal before boot..." >> "$LOG"
  bun run scripts/source-integrity-heal.ts >> "$LOG" 2>&1 || true

  # V31 TURN 3 (R-1 §2.3, in-repo): RUNTIME DEPENDENCY PREFLIGHT. The boot
  # chain order is guard → source-integrity heal → runtime preflight →
  # db-selfheal → next dev. A mismatched runtime layer is healed (one
  # bun install --frozen-lockfile) — and when it cannot be healed, next dev
  # is NOT started: an honest blocked status instead of a crash loop.
  echo "[$(date -u +%H:%M:%S)] watchdog: :3000 down — runtime preflight before boot..." >> "$LOG"
  if ! bun run scripts/runtime-preflight.ts >> "$LOG" 2>&1; then
    echo "[$(date -u +%H:%M:%S)] watchdog: runtime preflight FAILED — refreshing runtime layer (bun install --frozen-lockfile)..." >> "$LOG"
    bun install --frozen-lockfile >> "$LOG" 2>&1 \
      || echo "[$(date -u +%H:%M:%S)] watchdog: bun install FAILED (network/cache — will retry next loop)" >> "$LOG"
    if ! bun run scripts/runtime-preflight.ts >> "$LOG" 2>&1; then
      echo "[$(date -u +%H:%M:%S)] watchdog: runtime preflight STILL FAILED — BLOCKED: NOT starting next dev on a mismatched runtime (honest degraded status; retry in 60s)" >> "$LOG"
      sleep 60
      continue
    fi
  fi

  # Pre-boot DB self-heal (Task 42 → V31 TURN 3 central authorization): the
  # chain node's silent re-seed path is closed — and so is the old "booting
  # anyway" fallback. Exit 1 = authorized restore failed (torn state);
  # exit 2 = recovery REFUSED fail-closed (operator adjudication). In BOTH
  # cases the databases are untouched and next dev must NOT start.
  echo "[$(date -u +%H:%M:%S)] watchdog: :3000 down — running DB self-heal (central authorization) before boot..." >> "$LOG"
  SELFHEAL_RC=0
  bun run scripts/db-selfheal.ts >> "$LOG" 2>&1 || SELFHEAL_RC=$?
  if [ "$SELFHEAL_RC" -ne 0 ]; then
    echo "[$(date -u +%H:%M:%S)] watchdog: db-selfheal rc=$SELFHEAL_RC — BLOCKED: NOT starting next dev (1=authorized restore failed; 2=recovery REFUSED, operator adjudication). Databases untouched; retry in 60s." >> "$LOG"
    sleep 60
    continue
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
