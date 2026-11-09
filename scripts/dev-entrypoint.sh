#!/bin/bash
# MTQΣ platform dev entrypoint (V31 TURN 3 — Fix R-1, §2: mandatory pre-boot
# gate wired into the PLATFORM's own start command).
#
# WHY (Incident 22, proven 2026-11-09T14:51Z boot log): the platform boots
# this sandbox with `bun run dev`, whose script was raw `next dev -p 3000` —
# the application started DIRECTLY, with no image/repo/source/database
# validation, and (on a stale Task-46-era image) its pre-T2A self-heal
# restored h3941-era dumps over the live database BEFORE any git realignment,
# then the mid-run realignment flipped code under the running server and the
# dependency mismatch (swc 16.1.3 vs next 16.4.5, missing vendored meriyah)
# killed it. Every defense lived in the watchdog — which nothing started
# until the next hourly backstop fire (a ≤1h uncovered window per re-image).
#
# WHAT: `bun run dev` now routes through the complete startup gate chain —
#   dev-entrypoint.sh → dev-watchdog.sh (singleton) →
#     git-drift guard → source-integrity heal → runtime dependency
#     preflight → db-selfheal (central recovery authorization + staged
#     generation store) → next dev → readiness verification (HTTP 200).
# The entrypoint stays alive in the foreground for as long as the watchdog
# lives (a platform supervisor watching `bun run dev` sees a live process),
# and exits when the watchdog dies so the supervisor restarts the whole
# gate chain — the application can no longer outlive its gate.
#
# Singleton: exactly one watchdog per sandbox (flock in dev-watchdog.sh).
# Duplicate entrypoint invocations babysit the SAME watchdog — they never
# spawn a second supervision tree (double write-behind / EADDRINUSE
# ping-pong are structurally impossible).

cd /home/z/my-project

WATCHDOG_PID_LOG=/tmp/mtq-watchdog.pid

ensure_watchdog() {
  local wpid
  wpid="$(cat "$WATCHDOG_PID_LOG" 2>/dev/null || true)"
  if [ -n "$wpid" ] && kill -0 "$wpid" 2>/dev/null; then
    return 0
  fi
  # Stale/missing pid: launch a fresh watchdog, fully detached (setsid
  # double-fork — survives this script, this shell, and turn teardown).
  ( setsid bash dev-watchdog.sh >> /tmp/watchdog-launch.log 2>&1 & )
  # Wait for it to claim its pid (it writes the pid file immediately after
  # acquiring the singleton lock; a lock-refused duplicate exits silently
  # without clobbering the holder's pid file).
  for _ in $(seq 1 30); do
    wpid="$(cat "$WATCHDOG_PID_LOG" 2>/dev/null || true)"
    if [ -n "$wpid" ] && kill -0 "$wpid" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if ! ensure_watchdog; then
  # Retry once — the only failure mode is a launch race with another
  # entrypoint instance whose watchdog has not yet written its pid.
  sleep 10
  ensure_watchdog || echo "[dev-entrypoint] watchdog launch not confirmed — continuing to babysit whatever pid file appears" >&2
fi

WPID="$(cat "$WATCHDOG_PID_LOG" 2>/dev/null || echo 0)"
echo "[dev-entrypoint] $(date -u +%Y-%m-%dT%H:%M:%SZ) gate chain supervised by watchdog pid ${WPID} — server output continues in dev.log"

# Foreground babysit: live for as long as the watchdog lives; exit promptly
# when it dies so any supervisor restarts the full gate chain.
while kill -0 "$WPID" 2>/dev/null; do
  sleep 15
done
echo "[dev-entrypoint] watchdog (pid $WPID) exited at $(date -u +%Y-%m-%dT%H:%M:%SZ) — exiting so the gate chain restarts"
