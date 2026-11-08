#!/usr/bin/env bash
# MTQΣ — Plane-5 external bootstrap gate (v29 directive §3/§5).
#
# PURPOSE: run BEFORE any application database self-heal or application startup
# so that repository recovery and source verification always precede data-layer
# recovery. This script is the pre-application bootstrap gate; it is designed
# to be invoked by the EXTERNAL orchestration layer (the Plane-5 cron jobs),
# because a fresh sandbox re-image restores a STALE task46-era snapshot whose
# scripts/ do not contain any of this tooling.
#
# SOURCES: (a) tracked copy at scripts/plane5-bootstrap.sh (present once the
# tree is synced); (b) retrieved from the authoritative origin via
#   git show origin/main:scripts/plane5-bootstrap.sh > /tmp/plane5-bootstrap.sh
# (the cron payloads embed this retrieval as an inline fallback).
#
# SAFETY: this script performs NO destructive operations. All repository
# healing (archive → content-subsumption proof → forward-only realign →
# dependency refresh) is performed exclusively by the harness-proven
# git-drift guard (scripts/git-drift-guard.ts + src/lib/boot/git-drift.ts),
# materialized here byte-exact from origin/main. If the guard classifies
# genuine unique local content (exit 1 / BLOCKED) we STOP and report — its
# protection is never bypassed.
#
# EXIT CODES: 0 = BOOTSTRAP_OK (tree authoritative + prerequisites + snapshot
# verified; the application boot chain may proceed);
# 1 = guard BLOCKED (operator adjudication required);
# 9/10..15 = bootstrap-stage failure (remote authenticity / fetch / guard
# anomaly / HEAD mismatch / missing prerequisite / snapshot verify fail) —
# in every non-zero case the application must NOT be started against an
# unverified database.

set -uo pipefail
ROOT="${MTQ_SIGMA_ROOT:-/home/z/my-project}"
log() { echo "[bootstrap $(date -u +%FT%T.%3NZ)] $*"; }

# ── (§3.1) working directory ─────────────────────────────────────────
cd "$ROOT" || { log "FAIL root missing: $ROOT"; exit 10; }

# ── (§3.3) repository identity + remote authenticity ─────────────────
REMOTE="$(git remote get-url origin 2>/dev/null || true)"
case "$REMOTE" in
  *MITHQALMTQ/MTQ_SIGMA*) log "remote authenticity OK (MITHQALMTQ/MTQ_SIGMA)" ;;
  *) log "FAIL remote authenticity: '${REMOTE:-<none>}' — refusing"; exit 11 ;;
esac

# ── (§3.2) fetch latest authorized main ──────────────────────────────
FETCH_OUT="$(git fetch origin 2>&1)"; FETCH_RC=$?
[ -n "$FETCH_OUT" ] && echo "$FETCH_OUT" | tail -2
[ "$FETCH_RC" -ne 0 ] && { log "FAIL git fetch origin (rc=$FETCH_RC) — BLOCKED, no realign by hand"; exit 12; }
ORIGIN_SHA="$(git rev-parse origin/main)"
log "authoritative origin/main = $ORIGIN_SHA"

# ── (§3.4) safely retrieve the current guard implementation ──────────
# Materialize-if-absent ONLY (never overwrite an existing/tracked file, so a
# pre-guard snapshot gets untracked copies — which can never dirty the tree
# the guard is about to classify).
mkdir -p src/lib/boot
if [ ! -f scripts/git-drift-guard.ts ]; then
  git show origin/main:scripts/git-drift-guard.ts > scripts/git-drift-guard.ts
  log "guard CLI materialized from origin/main (was absent)"
fi
if [ ! -f src/lib/boot/git-drift.ts ]; then
  git show origin/main:src/lib/boot/git-drift.ts > src/lib/boot/git-drift.ts
  log "guard library materialized from origin/main (was absent)"
fi

# ── (§3.5–§3.7) run the proven guard (archive+subsumption+forward-only) ─
bun run scripts/git-drift-guard.ts
GUARD_EXIT=$?
case "$GUARD_EXIT" in
  0)  log "guard exit 0 — synced/ahead (git plane OK)" ;;
  42) log "guard exit 42 — REALIGNED forward-only (local line archived; db/*.db untouched)" ;;
  1)  log "guard exit 1 — BLOCKED: genuine unique local content. NO realign. Report classification + changed paths verbatim for operator adjudication." ;;
  *)  log "guard unexpected exit $GUARD_EXIT — treating as blocked"; exit "$GUARD_EXIT" ;;
esac
[ "$GUARD_EXIT" -eq 1 ] && exit 1

# ── (§3.8) local HEAD equals the authoritative origin commit ─────────
HEAD_SHA="$(git rev-parse HEAD)"
if [ "$HEAD_SHA" != "$ORIGIN_SHA" ]; then
  log "FAIL HEAD $HEAD_SHA != origin/main $ORIGIN_SHA after guard — BLOCKED"
  exit 13
fi

# ── (§3.9) expected source-integrity + database recovery files exist ──
MISSING=0
for f in scripts/source-integrity-heal.ts scripts/db-selfheal.ts \
         scripts/plane5-backstop-heartbeat.ts dev-watchdog.sh \
         backups/db-snapshots/latest-chain.sql backups/db-snapshots/latest-custom.sql; do
  if [ ! -f "$f" ]; then log "FAIL prerequisite missing: $f"; MISSING=1; fi
done
[ "$MISSING" -eq 0 ] || { log "prerequisites incomplete — refusing application start"; exit 14; }

# ── (§3.10) verify the committed database snapshot before boot ───────
TIP_LINE="$(git show origin/main:backups/db-snapshots/latest-chain.sql | sed -n 3p)"
TIP_H="$(printf '%s\n' "$TIP_LINE" | grep -oE 'height=[0-9]+' | head -1 | cut -d= -f2)"
GEN_COUNT="$(git show origin/main:backups/db-snapshots/latest-chain.sql | grep -c 'gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d')"
GEN_COUNT="${GEN_COUNT:-0}"
if [ -z "$TIP_H" ] || [ "$TIP_H" -lt 1000 ] || [ "$GEN_COUNT" -lt 1 ]; then
  log "FAIL snapshot verification: tipLine='$TIP_LINE' genesisCount=$GEN_COUNT"
  exit 15
fi
log "snapshot verified: committedTip=h$TIP_H · canonical genesis gen_3baf0dba… present"

log "BOOTSTRAP_OK — repository authoritative; application boot chain may proceed"
log "boot chain order (watchdog v4): drift guard → source-integrity heal → db-selfheal (forward-only + rollback-prevention + identity gate) → next dev"
exit 0
