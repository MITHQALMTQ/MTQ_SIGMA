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
# anomaly / git-state BLOCKED / missing prerequisite / snapshot verify fail) —
# in every non-zero case the application must NOT be started against an
# unverified database.
#
# V31 TURN 2A (incident 19 root-cause fix, 2026-11-09): §3.8 no longer asserts
# strict HEAD == origin/main. It runs the SHARED branch-state classification
# (src/lib/boot/git-state.ts via scripts/git-state-classify.ts) and admits
# exactly two proceed states: EXACT_MATCH and SAFE_SNAPSHOT_AHEAD (every
# ahead commit touches only explicitly approved operational snapshot/evidence
# files, every snapshot passes independent integrity checks — tip parse,
# canonical genesis, transaction completeness, forward-only heights, HEAD
# manifest sha256 verification). SOURCE_CODE_AHEAD / BEHIND / DIVERGED /
# REMOTE_UNAVAILABLE / SNAPSHOT_INVALID / AUTHORITY_UNVERIFIED all BLOCK
# (exit 13) — the git plane never authorizes database restoration by itself;
# recovery keeps its own fail-closed forward-only authorization.

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
# the guard is about to classify). V31 TURN 2A: the shared classifier and
# snapshot-manifest modules are materialized the same way, because §3.8/§3.10
# below depend on them (a re-imaged stale checkout must be able to fetch the
# classification tooling from origin before it can classify anything).
mkdir -p src/lib/boot
if [ ! -f scripts/git-drift-guard.ts ]; then
  git show origin/main:scripts/git-drift-guard.ts > scripts/git-drift-guard.ts
  log "guard CLI materialized from origin/main (was absent)"
fi
if [ ! -f src/lib/boot/git-drift.ts ]; then
  git show origin/main:src/lib/boot/git-drift.ts > src/lib/boot/git-drift.ts
  log "guard library materialized from origin/main (was absent)"
fi
if [ ! -f scripts/git-state-classify.ts ]; then
  git show origin/main:scripts/git-state-classify.ts > scripts/git-state-classify.ts
  log "git-state classifier CLI materialized from origin/main (was absent)"
fi
if [ ! -f src/lib/boot/git-state.ts ]; then
  git show origin/main:src/lib/boot/git-state.ts > src/lib/boot/git-state.ts
  log "git-state classification library materialized from origin/main (was absent)"
fi
if [ ! -f src/lib/boot/snapshot-manifest.ts ]; then
  git show origin/main:src/lib/boot/snapshot-manifest.ts > src/lib/boot/snapshot-manifest.ts
  log "snapshot-manifest library materialized from origin/main (was absent)"
fi
# V31 TURN 3 (R-1 §2.3): runtime preflight is part of the pre-boot gate; a
# re-imaged checkout must be able to fetch it from origin before it can
# classify anything.
if [ ! -f scripts/runtime-preflight.ts ]; then
  git show origin/main:scripts/runtime-preflight.ts > scripts/runtime-preflight.ts
  log "runtime preflight materialized from origin/main (was absent)"
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

# ── (§3.8) SHARED branch-state classification (V31 TURN 2A) ───────────
# Replaces the contradictory strict HEAD == origin/main assertion: the same
# Git state used to pass the drift guard ("ahead-only — not a regression",
# exit 0) and fail here (exit 13). The classifier is the single source of
# truth for both this gate and the wrapper/heartbeat git planes. The fetch
# already happened in §3.2, so --no-fetch trusts the verified origin ref.
STATE_JSON="$(bun run scripts/git-state-classify.ts --no-fetch 2>/dev/null || true)"
STATE="$(printf '%s' "$STATE_JSON" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin)["state"])
except Exception:
    print("CLASSIFY_ERROR")')"
HEAD_SHA="$(git rev-parse HEAD)"
# Persist the full report for the wrapper (ledger attribution + repair path).
printf '%s\n' "$STATE_JSON" > /tmp/plane5-git-state.json 2>/dev/null || true
case "$STATE" in
  EXACT_MATCH)
    log "git state EXACT_MATCH — HEAD == origin/main == $HEAD_SHA" ;;
  SAFE_SNAPSHOT_AHEAD)
    AHEAD_N="$(printf '%s' "$STATE_JSON" | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin)["aheadCount"])
except Exception:
    print("?")')"
    log "git state SAFE_SNAPSHOT_AHEAD — $AHEAD_N ahead commit(s), approved operational snapshot/evidence files only, snapshots validated forward-only, HEAD manifest verified" ;;
  *)
    log "FAIL git state $STATE — BLOCKED (see /tmp/plane5-git-state.json reasons)"
    exit 13 ;;
esac

# ── (§3.9) expected source-integrity + database recovery files exist ──
MISSING=0
for f in scripts/source-integrity-heal.ts scripts/db-selfheal.ts \
         scripts/plane5-backstop-heartbeat.ts dev-watchdog.sh \
         backups/db-snapshots/latest-chain.sql backups/db-snapshots/latest-custom.sql \
         backups/db-snapshots/manifest.json; do
  if [ ! -f "$f" ]; then log "FAIL prerequisite missing: $f"; MISSING=1; fi
done
[ "$MISSING" -eq 0 ] || { log "prerequisites incomplete — refusing application start"; exit 14; }

# ── (§3.10) verify the committed snapshot against its manifest (HEAD) ─
# V31 TURN 2A: the recovery source of record is the snapshot at HEAD (for
# SAFE_SNAPSHOT_AHEAD this is NEWER than origin's — a validated newer state
# is never discarded). Independent verification, not a trust of the §3.8
# classifier: this gate re-reads the committed blobs and re-hashes them
# against the manifest itself. The canonical genesis constant mirrors
# src/lib/boot/snapshot-manifest.ts (CANONICAL_GENESIS).
TIP_LINE="$(git show HEAD:backups/db-snapshots/latest-chain.sql | sed -n 3p)"
TIP_H="$(printf '%s\n' "$TIP_LINE" | grep -oE 'height=[0-9]+' | head -1 | cut -d= -f2)"
GEN_COUNT="$(git show HEAD:backups/db-snapshots/latest-chain.sql | grep -c 'gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d')"
GEN_COUNT="${GEN_COUNT:-0}"
MAN_SHA_CHAIN="$(git show HEAD:backups/db-snapshots/manifest.json 2>/dev/null | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin)["chain"]["sha256"])
except Exception:
    print("MISSING-MANIFEST")' 2>/dev/null || echo MISSING-MANIFEST)"
MAN_SHA_CUSTOM="$(git show HEAD:backups/db-snapshots/manifest.json 2>/dev/null | python3 -c 'import json,sys
try:
    print(json.load(sys.stdin)["custom"]["sha256"])
except Exception:
    print("MISSING-MANIFEST")' 2>/dev/null || echo MISSING-MANIFEST)"
ACT_SHA_CHAIN="$(git show HEAD:backups/db-snapshots/latest-chain.sql | sha256sum | cut -d' ' -f1)"
ACT_SHA_CUSTOM="$(git show HEAD:backups/db-snapshots/latest-custom.sql | sha256sum | cut -d' ' -f1)"
CHAIN_SHA_OK="no"; [ "$MAN_SHA_CHAIN" = "$ACT_SHA_CHAIN" ] && CHAIN_SHA_OK="yes"
CUSTOM_SHA_OK="no"; [ "$MAN_SHA_CUSTOM" = "$ACT_SHA_CUSTOM" ] && CUSTOM_SHA_OK="yes"
if [ -z "$TIP_H" ] || [ "$TIP_H" -lt 1000 ] || [ "$GEN_COUNT" -lt 1 ] \
   || [ "$CHAIN_SHA_OK" != "yes" ] || [ "$CUSTOM_SHA_OK" != "yes" ]; then
  log "FAIL snapshot verification: tipH='$TIP_H' genesisCount=$GEN_COUNT chainShaOk=$CHAIN_SHA_OK customShaOk=$CUSTOM_SHA_OK"
  exit 15
fi
MAN_V="$(git show HEAD:backups/db-snapshots/manifest.json | python3 -c 'import json,sys; print(json.load(sys.stdin).get("version","?"))' 2>/dev/null || echo '?')"
log "snapshot verified at HEAD: manifest v$MAN_V · committedTip=h$TIP_H · sha256 match · canonical genesis gen_3baf0dba… present"

# ── (§3.11) runtime consistency — V31 TURN 3 (R-1 §2.3, in-repo) ───────
# The fourth Incident-22 recurrence (2026-11-09T14:51Z): git realigns the
# tree while node_modules keeps the stale image's dependency state → the
# platform's next dev dies at config load (swc 16.1.3 vs next 16.4.5,
# missing vendored meriyah) before any guard acts. When node_modules exists,
# its next/swc/meriyah state must match the package manifest — a mismatch
# is a hard bootstrap failure (exit 16) that the wrapper repairs with ONE
# `bun install --frozen-lockfile` + ONE retry. Absent node_modules (isolated
# regression sandboxes / fresh clones) the step is skipped: nothing to
# validate, nothing to start against.
if [ -d node_modules ] && command -v bun >/dev/null 2>&1; then
  if ! bun run scripts/runtime-preflight.ts >/tmp/plane5-runtime-preflight.out 2>&1; then
    log "FAIL runtime preflight — $(tail -1 /tmp/plane5-runtime-preflight.out 2>/dev/null | head -c 300)"
    log "runtime layer mismatch — repair: bun install --frozen-lockfile, then retry bootstrap"
    exit 16
  fi
  log "runtime preflight OK — node_modules matches the package manifest (next/swc/meriyah)"
fi

log "BOOTSTRAP_OK — repository authoritative; application boot chain may proceed"
log "boot chain order (watchdog v5): drift guard → source-integrity heal → runtime preflight → db-selfheal (central authorization + staged generations + rollback prevention + identity gate) → next dev"
exit 0
