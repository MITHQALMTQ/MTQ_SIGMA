#!/usr/bin/env bash
# MTQΣ — Session-Open Anti-Stale-Snapshot Battery (Task 32 hardening)
#
# WHY THIS EXISTS (incidents #4 and #5, worklog Tasks 30–31): this sandbox
# is periodically RE-IMAGED to an old filesystem snapshot, which
# resurrects a pre-sync repo + dev server while origin/main always held
# the truth. The regression was detected both times by this exact check
# sequence within seconds — it is now formalized so ANY session (human or
# agent) runs it BEFORE trusting local state.
#
# USAGE:   bash scripts/session-open-battery.sh
# EXIT:    0 = all planes aligned (safe to work)
#          1 = regression detected — DO NOT TRUST local state; recover
#              forward-only per worklog Tasks 30/31 (fetch, prove content
#              redundancy by blob hash, then reset --hard origin/main).
#          2 = not a git repository

set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "BATTERY FAIL: not a git repo"; exit 2; }

fail=0
echo "== MTQΣ session-open battery =="

# [1/5] Fetch first — always. Local refs are worthless until refreshed.
echo "[1/5] git fetch origin ..."
if git fetch origin --quiet --tags 2>/dev/null; then
  echo "      fetch OK"
else
  echo "      WARN: fetch failed (offline?); continuing with existing refs"
fi

# [2/5] local HEAD vs origin/main — THE stale-snapshot detector.
HEAD_SHA=$(git rev-parse HEAD)
ORIGIN_SHA=$(git rev-parse origin/main)
if [ "$HEAD_SHA" = "$ORIGIN_SHA" ]; then
  echo "[2/5] local == origin/main == ${HEAD_SHA:0:12}  OK"
else
  echo "[2/5] STALE TREE DETECTED: local ${HEAD_SHA:0:12} != origin/main ${ORIGIN_SHA:0:12}"
  echo "      This is the known sandbox re-image regression (worklog Task 30/31)."
  echo "      Forward-only recovery: prove content redundancy by blob hash,"
  echo "      then: git reset --hard origin/main  (NEVER roll back the remote)."
  fail=1
fi

# [3/5] No-rollback anchor (Task 26 machinery) must be an ancestor of HEAD.
anchor=$(git tag -l 'no-rollback-anchor-*' | sort | tail -1)
if [ -n "$anchor" ] && git merge-base --is-ancestor "$anchor" HEAD; then
  echo "[3/5] no-rollback anchor '$anchor' is ancestor of HEAD  OK"
else
  echo "[3/5] ANCHOR CHECK FAILED (anchor: '${anchor:-none found}') — history may have been rolled back!"
  fail=1
fi

# [4/5] Working tree state (informational — dirty is normal mid-work,
# but a freshly re-imaged session should be clean).
if [ -z "$(git status --porcelain)" ]; then
  echo "[4/5] working tree clean  OK"
else
  echo "[4/5] working tree dirty (shown if fresh session — investigate):"
  git status --porcelain | head -10
fi

# [5/5] Dev server liveness (informational).
if curl -s -m 3 -o /dev/null http://localhost:3000/api/health 2>/dev/null; then
  echo "[5/5] dev server responding on :3000  OK"
else
  echo "[5/5] dev server NOT responding on :3000"
  echo "      (if needed, relaunch: ( setsid bash dev-watchdog.sh >> /tmp/watchdog-launch.log 2>&1 & )"
  echo "       — the double-fork orphan pattern; single-fork is reaped, Task 31)"
fi

if [ "$fail" -eq 0 ]; then
  echo "== BATTERY PASS — all planes aligned at ${HEAD_SHA:0:12} =="
  exit 0
else
  echo "== BATTERY FAIL — regression detected; recover forward-only BEFORE ANY work =="
  exit 1
fi
