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

# [1/8] Fetch first — always. Local refs are worthless until refreshed.
echo "[1/8] git fetch origin ..."
if git fetch origin --quiet --tags 2>/dev/null; then
  echo "      fetch OK"
else
  echo "      WARN: fetch failed (offline?); continuing with existing refs"
fi

# [2/8] local HEAD vs origin/main — THE stale-snapshot detector.
# Task 49 upgrade: THREE-WAY classification. The old binary check advised
# `reset --hard origin/main` for any inequality — correct for a stale tree
# (re-image resurrection), but DESTRUCTIVE for a DIVERGED history (incident
# #9, 2026-11-06: a re-image mid-session spawned parallel local/origin lines;
# reset --hard would have destroyed 4 local-only task commits). Classify:
#   EQUAL    → aligned
#   BEHIND   → stale tree → forward-only reset advice is CORRECT
#   DIVERGED → parallel lines → NEVER reset; forward-only MERGE (task49 pattern)
HEAD_SHA=$(git rev-parse HEAD)
ORIGIN_SHA=$(git rev-parse origin/main)
if [ "$HEAD_SHA" = "$ORIGIN_SHA" ]; then
  echo "[2/8] local == origin/main == ${HEAD_SHA:0:12}  OK"
else
  if git merge-base --is-ancestor "$HEAD_SHA" "$ORIGIN_SHA"; then
    echo "[2/8] STALE TREE DETECTED: local ${HEAD_SHA:0:12} is BEHIND origin/main ${ORIGIN_SHA:0:12}"
    echo "      The watchdog v4 git-drift guard auto-heals this class at boot; if it"
    echo "      is still stale here, heal now: git merge --ff-only origin/main"
    fail=1
  elif git merge-base --is-ancestor "$ORIGIN_SHA" "$HEAD_SHA"; then
    echo "[2/8] local ${HEAD_SHA:0:12} is AHEAD of origin/main ${ORIGIN_SHA:0:12} (unpushed work)"
    echo "      Not a regression — but PUSH before any risky operation so the cloud"
    echo "      layer (git = the off-box truth) holds this work: git push origin HEAD:main"
    echo "      (unpushed commits are exactly what the re-image wiped in incident #9)."
  else
    echo "[2/8] DIVERGED HISTORY DETECTED: local ${HEAD_SHA:0:12} and origin/main ${ORIGIN_SHA:0:12} share neither tip"
    echo "      The amend-drift signature (incident #8). The task60 guard auto-realigns"
    echo "      ONLY under content-subsumption proof; if still diverged here it found"
    echo "      unique local content — human decision required. Recover forward-only:"
    echo "        bun run scripts/git-drift-guard.ts --status   # see the classification"
    echo "        git merge origin/main --no-ff --no-commit     → resolve per task49"
    echo "      Intentional divergence: git-drift-guard.ts --allow-drift \"reason\""
    fail=1
  fi
fi

# [3/8] git-drift guard (task60 — incident #8 root cause): fetch +
# classify + AUTO-HEAL forward-only (fast-forward or proven-subsumption
# realign; archives the local line first). Exit 42 = healed NOW (restart
# the server); exit 1 = BLOCKED (unique content — see [2/8] guidance).
echo "[3/8] git-drift guard (auto-heal plane) ..."
if bun run scripts/git-drift-guard.ts; then
  echo "      drift guard: aligned (or ahead-only — push soon)"
else
  RC=$?
  if [ "$RC" -eq 42 ]; then
    echo "      drift guard: REALIGNED — state is now trusted; RESTART the dev server"
    echo "      so it compiles the realigned code (watchdog v4 does this automatically)."
  else
    echo "      drift guard: BLOCKED — unique local content or dirty tree; see [2/8]"
    fail=1
  fi
fi

# [3/8] No-rollback anchor (Task 26 machinery) must be an ancestor of HEAD.
anchor=$(git tag -l 'no-rollback-anchor-*' | sort | tail -1)
if [ -n "$anchor" ] && git merge-base --is-ancestor "$anchor" HEAD; then
  echo "[3/8] no-rollback anchor '$anchor' is ancestor of HEAD  OK"
else
  echo "[3/8] ANCHOR CHECK FAILED (anchor: '${anchor:-none found}') — history may have been rolled back!"
  fail=1
fi

# [4/8] Working tree state (informational — dirty is normal mid-work,
# but a freshly re-imaged session should be clean).
if [ -z "$(git status --porcelain)" ]; then
  echo "[4/8] working tree clean  OK"
else
  echo "[4/8] working tree dirty (shown if fresh session — investigate):"
  git status --porcelain | head -10
fi

# [5/8] Dev server liveness (informational).
if curl -s -m 3 -o /dev/null http://localhost:3000/api/health 2>/dev/null; then
  echo "[5/8] dev server responding on :3000  OK"
else
  echo "[5/8] dev server NOT responding on :3000"
  echo "      (if needed, relaunch: ( setsid bash dev-watchdog.sh >> /tmp/watchdog-launch.log 2>&1 & )"
  echo "       — the double-fork orphan pattern; single-fork is reaped, Task 31)"
fi

# [6/8] Database regression detector (incident 2026-11-06: sandbox re-image
# re-seeded db/chain.db to genesis + wiped db/custom.db telemetry; git-tracked
# truth survived, DBs did not — caught only by manual row-count comparison).
# Task 42: recovery is now AUTOMATIC at boot (node.ts self-heal + watchdog
# pre-boot heal + db-cloud-sync guard), so this check usually passes by
# session-open; it stays as the loud manual gate + reset-acknowledgment gate.
if bun run scripts/check-db-regression.ts; then
  :
else
  echo "[6/8] DATABASE REGRESSION SIGNATURE — one-command recovery:"
  echo "      bun run scripts/db-selfheal.ts   (forward-only restore from the"
  echo "      git-tracked cloud layer; see backups/INCIDENT-2026-11-06-DB-REGRESSION.md)"
  echo "      (an intentional reset uses: db-selfheal.ts --allow-reset \"reason\" + worklog.md)"
  fail=1
fi

# [7/8] Brand asset & render-quality guard (task56, F-56 root-cause
# protection): catches the JPEG-masquerade icon class (a photo shipped as
# .svg/.png → pixelated logo everywhere) and the fuzzy-text-on-scroll class
# (Framer Motion filter finals without transitionEnd cleanup; resting
# will-change pinning compositor layers).
if bun run scripts/check-brand-assets.ts; then
  :
else
  echo "[7/8] BRAND/RENDER GUARD FAILED — fix per task56 (regenerate icons from"
  echo "      public/brand/mtqs-mark.svg; add transitionEnd:{filter:'none'} to"
  echo "      filter-animated entrances; remove resting will-change)"
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "== BATTERY PASS — all planes aligned at ${HEAD_SHA:0:12} =="
  exit 0
else
  echo "== BATTERY FAIL — regression detected; recover forward-only BEFORE ANY work =="
  exit 1
fi
