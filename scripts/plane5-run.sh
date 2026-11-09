#!/usr/bin/env bash
# MTQΣ — Plane-5 deterministic scheduled runner (v30 §3 Phase B/C).
#
# DESIGN: the platform scheduler only supports agent-invoked payloads
# (agentTurn), and agent turns consume the gateway's GLOBAL model
# concurrency budget (both v3.2 backstop fires on 2026-11-08 — 19:17:48Z and
# 21:17:48Z — were permanently REJECTED with "model concurrency limit
# exceeded", no queue, no retry). The v30 correction is a LIGHTWEIGHT
# DETERMINISTIC EXECUTION MODEL: the scheduled agent's ONLY job is to run
# this one committed script and relay its final one-line output. Every
# decision, check, remediation, telemetry write, and commit lives HERE —
# deterministic, bounded, auditable — so each fire consumes the minimum
# model capacity and the minimum wall-clock window.
#
# USAGE (by the scheduled agent, or by hand):
#   bash scripts/plane5-run.sh monitor  [--job-id N] [--scheduler-json '<json>']
#   bash scripts/plane5-run.sh backstop [--job-id N]
#
# V31 TURN 2A (incident 19 root-cause fix):
#   • The bootstrap's git gate is now the SHARED branch-state classification
#     (EXACT_MATCH / SAFE_SNAPSHOT_AHEAD proceed; everything else BLOCKS),
#     replacing the contradictory strict HEAD==origin assertion.
#   • PLANE5_LOCK_FILE (default /tmp/plane5-backstop.lock) — override for
#     isolated regression sandboxes.
#   • The backstop PUBLISHES validated snapshots (scripts/snapshot-publish.ts)
#     after its DB plane: dump+manifest atomically, committed with exactly the
#     three snapshot paths, pushed. The 60s write-behind loops no longer dirty
#     the tracked dumps at all (staging architecture — see db-ops.ts).
#   • SNAPSHOT_INVALID transition repair: when the ONLY bootstrap failure is a
#     missing/mismatched publication manifest (e.g. a platform turn-end sweep
#     advanced a dump without one), the wrapper performs ONE sanctioned repair
#     publication and retries the bootstrap ONCE. This is snapshot PUBLICATION,
#     never database recovery — the fail-closed recovery authorization in
#     db-selfheal.ts is untouched, and structurally-invalid dumps (bad genesis,
#     height regression, partial payload) are refused by the publisher.
#
# JOB IDENTITY (V31 RC-2): scheduler fires derive their job ID from the
# verified registry topology (monitor = 516198, backstop = 516197; registry
# checked 2026-11-09). Manual invocations should set PLANE5_JOB_ID=manual or
# --job-id manual to avoid misattribution. Re-verify the registry whenever
# plane-5 jobs are recreated.
#
# MONITOR DEGRADED MODE (V31 RC-3): if bootstrap fails ONLY at sync/prerequisite
# stages (exit 13/14/15 — guard already passed, tree provably synced-or-ahead)
# the monitor still observes the on-disk heartbeat and alerts (/tmp telemetry
# only, NEVER a commit, classification never OK). Authenticity failures
# (exit 11/12/1/other) remain hard BLOCKED. See EXIT CODES below.
#
# RETRIEVAL AFTER A RE-IMAGE (self-sufficient — the checkout may be a stale
# snapshot whose scripts/ predate this file):
#   git fetch origin >/dev/null 2>&1; \
#   git show origin/main:scripts/plane5-run.sh > /tmp/plane5-run.sh && \
#   bash /tmp/plane5-run.sh <mode> ...
#
# SAFETY (unchanged from the v3.x contracts — v30 §6 Phase E):
#   - NEVER raw-git realign: repository healing happens exclusively through
#     scripts/plane5-bootstrap.sh → scripts/git-drift-guard.ts
#     (archive → content-subsumption proof → forward-only realign;
#     db/*.db never touched). Guard BLOCKED (genuine unique local content)
#     → stop, /tmp telemetry only, NO commit, operator adjudication.
#   - DB recovery is forward-only from the git-tracked durable layer; a
#     newer validated live state is never replaced by an older snapshot.
#   - The backstop holds an exclusive flock for its whole run — concurrent
#     self-heal operations are structurally impossible (v30 §3 Phase B).
#   - All HTTP checks are curl -m 5 (bounded); the heartbeat writer verifies
#     tsIso(UTC) parses back to tsMs from one clock source before writing.
#
# DURABLE EXECUTION LEDGER (v30 §4 Phase C): every run appends JSONL entries
# to backups/plane5/execution-ledger.jsonl (STARTED + FINAL, plus explicit
# outcome classifications) when the tree is bootstrapped/synced; /tmp/
# plane5-execution-ledger.jsonl always (transient evidence of bootstrap-stage
# failures). The ledger distinguishes: EXECUTED-OK / EXECUTED-ALERT /
# EXECUTED-BLOCKED / BOOTSTRAP-FAILED / OVERLAP-SKIP, and records the
# scheduler-observed state (run_count/stage/info) supplied via
# --scheduler-json so rejected dispatches are distinguishable from
# never-dispatched ones. backups/plane5/** is a guard-derivable prefix — a
# stranded ledger write can never block forward realignment.
#
# EXIT CODES: 0 = ran to completion (monitor classification or backstop
# result is IN THE OUTPUT, not the exit code); 1 = BLOCKED (guard); 9 =
# bootstrap-stage failure; 43 = overlap-skip (lock held); 10 = usage.

set -uo pipefail
ROOT="${MTQ_SIGMA_ROOT:-/home/z/my-project}"
MODE="${1:-}"
SCHED_JSON="null"
shift 2>/dev/null || true
# V31 RC-2 (2026-11-09): cron payloads are immutable and carry no --job-id, so
# scheduler fires derive identity from the registry topology above. Override:
# PLANE5_JOB_ID env or --job-id (manual runs should use "manual").
case "$MODE" in
  monitor)  JOB_ID="${PLANE5_JOB_ID:-516198}" ;;
  backstop) JOB_ID="${PLANE5_JOB_ID:-516197}" ;;
  *)        JOB_ID="${PLANE5_JOB_ID:-manual}" ;;
esac
while [ $# -gt 0 ]; do
  case "$1" in
    --job-id) JOB_ID="${2:-manual}"; shift 2 ;;
    --scheduler-json) SCHED_JSON="${2:-null}"; shift 2 ;;
    *) shift ;;
  esac
done

[ "$MODE" = "monitor" ] || [ "$MODE" = "backstop" ] || { echo "USAGE: plane5-run.sh <monitor|backstop> [--job-id N] [--scheduler-json '<json>']"; exit 10; }
cd "$ROOT" || { echo "BOOTSTRAP_FAILED root-missing"; exit 10; }

# backstop holds an exclusive flock for its WHOLE run (bootstrap included) —
# concurrent self-heal operations are structurally impossible (v30 §3 Phase B).
# PLANE5_LOCK_FILE override exists for the isolated regression harness
# (tests/plane5-git-state-regression.sh) so sandbox runs never contend with
# the operational lock.
if [ "$MODE" = "backstop" ]; then
  PLANE5_LOCK="${PLANE5_LOCK_FILE:-/tmp/plane5-backstop.lock}"
  exec 9>"$PLANE5_LOCK"
  if flock -n 9; then
    # V31 TURN 3 (R-5 §7): the holder records its OWN identity (pid, cmdline,
    # acquisition time) in the lock's companion file — future OVERLAP_SKIPs
    # can name WHO held the lock and SINCE WHEN. The 2026-11-09 13:17Z/14:17Z
    # skips left an unidentified holder because no holder evidence existed;
    # post-mortem identification (lsof scans) is unreliable — the
    # investigating process itself inherits fd 9 on the lock file and
    # self-lists. The lock itself is NEVER removed because it appears old —
    # only the holder's own process exit releases it.
    printf '%s pid=%s cmd=%s\n' "$(date -u +%FT%T.%3NZ)" "$$" \
      "$(tr '\0' ' ' < /proc/$$/cmdline 2>/dev/null | head -c 140)" \
      > "$PLANE5_LOCK.holder" 2>/dev/null || true
  else
    HOLDER_INFO=""
    if [ -f "$PLANE5_LOCK.holder" ]; then
      HOLDER_INFO=" lastHolder=$(head -c 240 "$PLANE5_LOCK.holder" 2>/dev/null | tr '\n' ' ')"
    fi
    echo "$(date -u +%FT%T.%3NZ) {\"mode\":\"backstop\",\"jobId\":\"$JOB_ID\",\"phase\":\"FINAL\",\"outcome\":\"OVERLAP-SKIP\"}" >> /tmp/plane5-execution-ledger.jsonl
    echo "PLANE_5_BACKSTOP OVERLAP_SKIP state=LOCK_CONTENTION — lock held by a concurrent execution; this fire stands down (no concurrent self-heal)${HOLDER_INFO}"
    exit 43
  fi
fi

LEDGER_DURABLE="backups/plane5/execution-ledger.jsonl"
LEDGER_TMP="/tmp/plane5-execution-ledger.jsonl"

# ── clock: single source (python3 UTC), parse-back verified ──────────
clock() { python3 -c 'import datetime; n=datetime.datetime.now(datetime.timezone.utc); ts=n.strftime("%Y-%m-%dT%H:%M:%S.")+f"{n.microsecond//1000:03d}Z"; ms=int(n.timestamp()*1000); import sys; assert int(datetime.datetime.fromisoformat(ts.replace("Z","+00:00")).timestamp()*1000)==ms; print(ts, ms)' ; }
NOW_ISO="$(clock | cut -d" " -f1)"; NOW_MS="$(clock | cut -d" " -f2)"
START_MS="$NOW_MS"

# ── ledger append (valid JSONL via python3) ──────────────────────────
# ledger <phase> <outcome> <extra-json-fragments...>
ledger() {
  local PHASE="$1" OUTCOME="$2"; shift 2
  python3 - "$LEDGER_TMP" "$PHASE" "$OUTCOME" "$NOW_ISO" "$MODE" "$JOB_ID" "$SCHED_JSON" "$(( $(date -u +%s%3N) - START_MS ))" "$@" <<'PYEOF'
import json, sys, os
path, phase, outcome, ts, mode, job, sched, dur = sys.argv[1:9]
extra = {}
for a in sys.argv[9:]:
    k, _, v = a.partition('=')
    # v30 hotfix (job 516198 fire 2026-11-09T00:09Z): a fragment starting with
    # '{'/'[' that is NOT valid JSON (e.g. a '[bootstrap ...] FAIL ...' log tail
    # passed as bootstrapTail/guardTail) previously CRASHED this append — the
    # durable BOOTSTRAP-FAILED / EXECUTED-BLOCKED evidence was lost. Parse when
    # possible, otherwise keep the fragment verbatim. Evidence is never dropped.
    if v[:1] in ('{', '['):
        try: extra[k] = json.loads(v)
        except Exception: extra[k] = v
    else: extra[k] = v
entry = {"tsIso": ts, "mode": mode, "jobId": job, "phase": phase, "outcome": outcome,
         "durationMs": int(dur), "schedulerObserved": json.loads(sched) if sched != "null" else None, **extra}
line = json.dumps(entry, separators=(',', ':'))
def rotate(p):
    # V31 RC-5 (2026-11-09): append-only rotation — history moves to a tracked
    # archive (execution-ledger.archive.jsonl), never deleted. Rotation failure
    # must never block the evidence append itself.
    try:
        if not os.path.exists(p): return
        with open(p) as f: lines = f.readlines()
        if len(lines) <= 1000: return
        move, keep = lines[:-200], lines[-200:]
        arch = os.path.join(os.path.dirname(p), "execution-ledger.archive.jsonl")
        with open(arch, "a") as f: f.writelines(move)
        tmp = p + ".rotating"
        with open(tmp, "w") as f: f.writelines(keep)
        os.replace(tmp, p)
    except Exception:
        pass
for p in (path, "backups/plane5/execution-ledger.jsonl"):
    try:
        rotate(p)
        os.makedirs(os.path.dirname(p), exist_ok=True) if os.path.dirname(p) and not os.path.exists(os.path.dirname(p)) else None
        with open(p, 'a') as f: f.write(line + "\n")
    except Exception:
        pass
PYEOF
}

# ── (§0) bootstrap from authoritative origin — NEVER raw-git realign ──
run_bootstrap() {
  REMOTE="$(git remote get-url origin 2>/dev/null)"
  case "$REMOTE" in *MITHQALMTQ/MTQ_SIGMA*) ;; *) echo REMOTE_AUTH_FAIL; return 9;; esac
  git fetch origin >/dev/null 2>&1 || { echo FETCH_FAIL_BLOCKED; return 9; }
  if [ -f scripts/plane5-bootstrap.sh ]; then bash scripts/plane5-bootstrap.sh; else git show origin/main:scripts/plane5-bootstrap.sh > /tmp/plane5-bootstrap.sh && bash /tmp/plane5-bootstrap.sh; fi
}
BOOT_OUT="$(run_bootstrap 2>&1)"
BOOT_EXIT=$?
BOOTSTRAP_STATE="OK"
REPAIR_STATUS="not-needed"
GIT_STATE_BOOT="UNKNOWN"
# V31 TURN 2A — SNAPSHOT_INVALID transition repair: when the ONLY bootstrap
# failure is an unverifiable publication state (missing/mismatched manifest —
# e.g. a platform turn-end sweep advanced the tracked dump without one, the
# incident-19 geometry), perform ONE sanctioned repair publication and retry
# the bootstrap ONCE. Publication ≠ recovery: the publisher structurally
# validates the dumps (parse/genesis/completeness/forward-only) and the
# fail-closed recovery authorization is untouched. All other blocked states
# (SOURCE_CODE_AHEAD/BEHIND/DIVERGED/REMOTE_UNAVAILABLE/AUTHORITY_UNVERIFIED)
# have no publication fix and never enter this path.
if [ "$BOOT_EXIT" -ne 0 ] && [ "$MODE" = "backstop" ]; then
  GIT_STATE_BOOT="$(python3 -c 'import json
try:
    print(json.load(open("/tmp/plane5-git-state.json"))["state"])
except Exception:
    print("UNKNOWN")' 2>/dev/null || echo UNKNOWN)"
  if [ "$BOOT_EXIT" -eq 13 ] && [ "$GIT_STATE_BOOT" = "SNAPSHOT_INVALID" ] && [ -f scripts/snapshot-publish.ts ]; then
    REPAIR_OUT="$(bun run scripts/snapshot-publish.ts --repair 2>&1 | tail -1)"
    REPAIR_PUBLISHED="$(printf '%s' "$REPAIR_OUT" | python3 -c 'import json,sys
try:
    print(str(json.load(sys.stdin).get("published", "false")).lower())
except Exception:
    print("unparseable")' 2>/dev/null || echo unparseable)"
    REPAIR_STATUS="attempted(published=$REPAIR_PUBLISHED)"
    ledger REPAIR "REPAIR-PUBLICATION" "repair=$REPAIR_STATUS" "repairTail=$(printf '%s' "$REPAIR_OUT" | tail -c 300)"
    if [ "$REPAIR_PUBLISHED" = "true" ]; then
      BOOT_OUT="$(run_bootstrap 2>&1)"
      BOOT_EXIT=$?
      REPAIR_STATUS="$REPAIR_STATUS;retryBootstrapExit=$BOOT_EXIT"
    else
      REPAIR_STATUS="$REPAIR_STATUS;retry-skipped"
    fi
  fi
fi
if [ "$BOOT_EXIT" -ne 0 ]; then
  ledger FINAL "BOOTSTRAP-FAILED" "bootstrapExit=$BOOT_EXIT" "bootstrapTail=$(echo "$BOOT_OUT" | tail -2 | tr '\n' ' ')" "gitState=$GIT_STATE_BOOT" "repair=$REPAIR_STATUS"
  # V31 RC-3 (2026-11-09): a monitor fire whose bootstrap failed ONLY at the
  # sync/prerequisite stages (13 = HEAD provably ahead after the guard passed;
  # 14/15 = synced tree, prerequisite/snapshot issue) still holds the freshest
  # heartbeat evidence on disk — it OBSERVES and ALERTS in degraded mode
  # (/tmp telemetry only, NEVER a commit, classification never OK) instead of
  # going blind. Authenticity failures (11 remote, 12 fetch, 1 guard BLOCKED,
  # anything else) remain hard BLOCKED: nothing about the tree can be trusted.
  DEGRADED="no"
  if [ "$MODE" = "monitor" ]; then
    case "$BOOT_EXIT" in 13|14|15) DEGRADED="yes" ;; esac
  fi
  if [ "$DEGRADED" != "yes" ]; then
    echo "PLANE_5_${MODE^^} BLOCKED bootstrap_exit=$BOOT_EXIT — $(echo "$BOOT_OUT" | tail -1)"
    echo "PLANE_5_${MODE^^} BLOCKED bootstrap_exit=$BOOT_EXIT — $(echo "$BOOT_OUT" | tail -1)" >&2
    exit 9
  fi
  BOOTSTRAP_STATE="DEGRADED(exit=$BOOT_EXIT)"
fi
[ "$BOOTSTRAP_STATE" = "OK" ] && echo "$BOOT_OUT" | tail -4

ORIGIN_SHA="$(git rev-parse origin/main 2>/dev/null || echo unknown)"

# ════════════════════════════════════════════════════════════════════
# MONITOR — observes and alerts; NEVER remediates (v3.1 contract)
# ════════════════════════════════════════════════════════════════════
if [ "$MODE" = "monitor" ]; then
  HB_PATH=""; HB_SRC="missing"
  if   [ -f backups/plane5/heartbeat.json ]; then HB_PATH="backups/plane5/heartbeat.json"; HB_SRC="durable"
  elif [ -f /tmp/plane5-heartbeat.json ];   then HB_PATH="/tmp/plane5-heartbeat.json";    HB_SRC="tmp"
  fi

  READOUT="$(python3 - "$HB_PATH" "$HB_SRC" <<'PYEOF'
import json, sys, datetime
path, src = sys.argv[1], sys.argv[2]
if src == "missing" or not path:
    print(json.dumps({"hb": "MISSING", "tsMs": 0, "tsIso": "MISSING", "result": "MISSING",
                      "ageS": -1, "classification": "PLANE_5_ALERT", "clockConsistent": False, "originSha": "?"})); raise SystemExit
hb = json.load(open(path))
n = datetime.datetime.now(datetime.timezone.utc); now_ms = int(n.timestamp()*1000)
try:
    parsed = int(datetime.datetime.fromisoformat(hb["tsIso"].replace("Z","+00:00")).timestamp()*1000)
except Exception:
    parsed = -1
consistent = parsed == hb["tsMs"]
age = (now_ms - hb["tsMs"]) // 1000 if consistent else 999999999
# V31 RC-9 (incident 14 extension / Phase 8): a heartbeat OLDER than its own
# nextDueMs (plus a 15-minute grace) means the scheduled backstop that should
# have refreshed it was missed or REJECTED — alert even while age < 9000s so a
# rejected dispatch can never hide behind a still-young heartbeat.
overdue = (hb.get("nextDueMs") or 0) > 0 and now_ms > hb["nextDueMs"] + 900000
cls = ("PLANE_5_ALERT" if age >= 9000 or overdue else
       "PLANE_5_OK" if hb.get("result") == "OK" else
       "PLANE_5_" + str(hb.get("result", "ALERT")).upper())
print(json.dumps({"hb": "present", "tsMs": hb["tsMs"], "tsIso": hb["tsIso"], "result": hb.get("result","?"),
                  "ageS": age, "classification": cls, "clockConsistent": consistent, "originSha": hb.get("originSha","?")}))
PYEOF
)"

  CLASSIFICATION="$(echo "$READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["classification"])')"
  HB_TSISO="$(echo "$READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["tsIso"])')"
  HB_RESULT="$(echo "$READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["result"])')"
  AGE_S="$(echo "$READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["ageS"])')"
  HB_ORIGIN="$(echo "$READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["originSha"])')"

  # V31 TURN 3 (R-4 §6, F-3 fix): the monitor probes the ACTUAL database
  # plane — a regressed database can never again hide behind a fresh OK
  # heartbeat (the h20333→h3941 regression did exactly that for ~3h). The
  # probe is READ-ONLY: the monitor OBSERVES and ALERTS; it NEVER remediates
  # (that is the backstop's function). Infra planes are observed the same
  # way and folded into the 14-state taxonomy (SERVER_UNAVAILABLE /
  # WATCHDOG_UNAVAILABLE / ROUTE_FAILURE; LOCK_CONTENTION and
  # BOOTSTRAP_BLOCKED exit earlier; SCHEDULER_REJECTED rides the ledger's
  # schedulerObserved field).
  MON_DBV_OUT="$(bun run scripts/plane5-db-verify.ts 2>/dev/null || true)"
  MON_DBV_OK="$(printf '%s' "$MON_DBV_OUT" | python3 -c 'import json,sys
try:
    d = json.load(sys.stdin); assert d.get("state")
    print("yes")
except Exception:
    print("no")' 2>/dev/null || echo no)"
  if [ "$MON_DBV_OK" != "yes" ]; then
    MON_DBV_OUT='{"state":"DATABASE_UNREADABLE","severity":"alert","detail":"plane5-db-verify unavailable or unparseable (fail-closed — never health)"}'
  fi
  DBV_STATE="$(printf '%s' "$MON_DBV_OUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["state"])')"
  DBV_SEVERITY="$(printf '%s' "$MON_DBV_OUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("severity","alert"))')"
  DBV_DETAIL="$(printf '%s' "$MON_DBV_OUT" | python3 -c 'import json,sys; print(str(json.load(sys.stdin).get("detail","n/a"))[:200])')"
  MON_SERVER="$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://localhost:3000/ 2>/dev/null || echo 000)"
  MON_WATCHDOG="$(ps ax -o cmd= | grep -F 'dev-watchdog.sh' | grep -vF grep | head -1 | wc -l)"
  MON_ROUTE="$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X POST http://localhost:3000/api/constituency/upload 2>/dev/null || echo 000)"
  INFRA_STATE="none"
  [ "$MON_SERVER" != "200" ] && INFRA_STATE="SERVER_UNAVAILABLE"
  [ "$MON_WATCHDOG" = "0" ] && [ "$INFRA_STATE" = "none" ] && INFRA_STATE="WATCHDOG_UNAVAILABLE"
  [ "$MON_ROUTE" != "403" ] && [ "$INFRA_STATE" = "none" ] && INFRA_STATE="ROUTE_FAILURE"

  ALERTING="no"
  [ "$CLASSIFICATION" != "PLANE_5_OK" ] && ALERTING="yes"
  # V31 TURN 3 (R-4): the monitor's OWN DB-plane probe and infra observation
  # alert independently of the heartbeat — no self-report can mask them.
  if [ "$DBV_SEVERITY" != "ok" ] || [ "$INFRA_STATE" != "none" ]; then
    ALERTING="yes"
    [ "$CLASSIFICATION" = "PLANE_5_OK" ] && CLASSIFICATION="PLANE_5_ALERT"
  fi
  # V31 RC-3: a degraded bootstrap compromises the durable telemetry layer
  # itself — never report OK while unsynced; force the alerting flow.
  if [ "$BOOTSTRAP_STATE" != "OK" ]; then
    ALERTING="yes"
    [ "$CLASSIFICATION" = "PLANE_5_OK" ] && CLASSIFICATION="PLANE_5_ALERT"
  fi

  if [ "$ALERTING" = "yes" ]; then
    # alert flow: durable alerts.log line + monitor-state (durable+/tmp)
    # V31 TURN 3 (R-4): the alert line carries the 14-state taxonomy fields
    # (dbState/infraState) — no generic ALERT.
    python3 - "$AGE_S" "$CLASSIFICATION" "$HB_TSISO" "$HB_RESULT" "$BOOTSTRAP_STATE" "$DBV_STATE" "$INFRA_STATE" "$DBV_DETAIL" <<'PYEOF'
import json, sys, datetime, os
age, cls, hb_ts, hb_res, boot, db_state, infra_state, db_detail = sys.argv[1:9]
n = datetime.datetime.now(datetime.timezone.utc)
ts = n.strftime("%Y-%m-%dT%H:%M:%S.") + f"{n.microsecond//1000:03d}Z"
now_ms = int(n.timestamp()*1000)
line = f"{ts} age={age} classification={cls} dbState={db_state} infraState={infra_state} heartbeat={hb_ts} result={hb_res} bootstrap={boot}"
if db_state != "HEALTHY": line += f" dbDetail={db_detail}"
# V31 RC-3: durable alert/state writes ONLY when the tree is synced (bootstrap
# OK); degraded runs keep /tmp copies so the observer never loses the alert
# record even while it cannot publish.
if boot == "OK":
    with open("backups/plane5/alerts.log", "a") as f: f.write(line + "\n")
with open("/tmp/plane5-alerts.log", "a") as f: f.write(line + "\n")
state = {"lastSeenMs": now_ms, "lastResult": hb_res if hb_res != "MISSING" else "MISSING", "missingSinceMs": now_ms if hb_res == "MISSING" else None, "bootstrapState": boot, "dbState": db_state, "infraState": infra_state}
if boot == "OK":
    json.dump(state, open("backups/plane5/monitor-state.json", "w"))
json.dump(state, open("/tmp/plane5-monitor-state.json", "w"))
PYEOF
  else
    # healthy run: still refresh state (fresh durable read clears missingSince)
    python3 - "$HB_RESULT" "$BOOTSTRAP_STATE" "$DBV_STATE" <<'PYEOF'
import json, sys, datetime
n = datetime.datetime.now(datetime.timezone.utc); now_ms = int(n.timestamp()*1000)
state = {"lastSeenMs": now_ms, "lastResult": sys.argv[1], "missingSinceMs": None, "bootstrapState": sys.argv[2], "dbState": sys.argv[3]}
json.dump(state, open("backups/plane5/monitor-state.json", "w"))
json.dump(state, open("/tmp/plane5-monitor-state.json", "w"))
PYEOF
  fi

  # commit rule: synced (bootstrap 0) AND (new alert OR classification changed
  # vs last monitor ledger entry) AND throttle > 30 min since last backups/plane5 commit
  LAST_CLS="$(tail -50 "$LEDGER_DURABLE" 2>/dev/null | python3 -c '
import sys, json
last = None
for line in sys.stdin:
    try:
        e = json.loads(line)
        if e.get("mode") == "monitor" and e.get("phase") == "FINAL": last = e.get("classification")
    except Exception: pass
print(last or "none")' 2>/dev/null || echo none)"
  LAST_COMMIT_ISO="$(git log -1 --format=%cI -- backups/plane5/ 2>/dev/null || echo 1970-01-01T00:00:00Z)"
  THROTTLE_OK="$(python3 -c "
import sys, datetime
age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat('$LAST_COMMIT_ISO'.replace('Z','+00:00'))).total_seconds()
print('yes' if age > 1800 else 'no')")"
  COMMIT_SHA="none"
  # V31 RC-3: no commit whatsoever while the tree is not synced.
  if [ "$BOOTSTRAP_STATE" = "OK" ] && { [ "$ALERTING" = "yes" ] || [ "$CLASSIFICATION" != "$LAST_CLS" ]; } && [ "$THROTTLE_OK" = "yes" ]; then
    if git add backups/plane5 2>/dev/null && git commit -m "plane5-monitor: $(date -u +%FT%T.%3NZ) $CLASSIFICATION" >/dev/null 2>&1 && git push origin main >/dev/null 2>&1; then
      COMMIT_SHA="$(git rev-parse --short HEAD)"
    else
      git checkout -- backups/plane5/ 2>/dev/null; COMMIT_SHA="commit-failed-restored"
    fi
  fi

  ledger FINAL "EXECUTED-$CLASSIFICATION" "classification=$CLASSIFICATION" "bootstrapState=$BOOTSTRAP_STATE" "heartbeatTsIso=$HB_TSISO" "ageS=$AGE_S" "heartbeatResult=$HB_RESULT" "heartbeatOriginSha=$HB_ORIGIN" "dbState=$DBV_STATE" "dbSeverity=$DBV_SEVERITY" "infraState=$INFRA_STATE" "server=$MON_SERVER" "watchdog=$MON_WATCHDOG" "route=$MON_ROUTE" "dbDetail=$DBV_DETAIL" "commit=$COMMIT_SHA"
  echo "PLANE_5_MONITOR $CLASSIFICATION age=${AGE_S}s hb=$HB_TSISO result=$HB_RESULT origin=$HB_ORIGIN db=$DBV_STATE infra=$INFRA_STATE server=$MON_SERVER watchdog=$MON_WATCHDOG route=$MON_ROUTE job=$JOB_ID bootstrap=$BOOTSTRAP_STATE ledger=outcome=EXECUTED-$CLASSIFICATION"
  exit 0
fi

# ════════════════════════════════════════════════════════════════════
# BACKSTOP — six planes, sanctioned remediation (v3.2 contract)
# ════════════════════════════════════════════════════════════════════
# NOTE: the exclusive flock was acquired ONCE at the top of the script (fd 9,
# env-overridable via PLANE5_LOCK_FILE). No second exec/open here — re-opening
# fd 9 would momentarily release the lock we already hold.
ledger STARTED "EXECUTING" "note=backstop lock acquired"

# ── plane 1: git drift (harness-proven guard; never raw git) ─────────
GUARD_EXIT=0
bun run scripts/git-drift-guard.ts >/tmp/plane5-guard.out 2>&1
GUARD_EXIT=$?
case "$GUARD_EXIT" in
  0) GIT_PLANE="OK" ;;
  42) GIT_PLANE="OK" ;;  # guard already archived + realigned forward-only; re-verified below
  1) GIT_PLANE="BLOCKED" ;;
  *) GIT_PLANE="BLOCKED" ;;
esac
[ "$GUARD_EXIT" = "42" ] && bash scripts/plane5-bootstrap.sh >/tmp/plane5-rebootstrap.out 2>&1

if [ "$GIT_PLANE" = "BLOCKED" ]; then
  ledger FINAL "EXECUTED-BLOCKED" "git=BLOCKED" "guardExit=$GUARD_EXIT" "guardTail=$(tail -3 /tmp/plane5-guard.out | tr '\n' ' ')"
  # v30 hotfix: BLOCKED line on both streams (relay-agent visibility, see above)
  echo "PLANE_5_BACKSTOP BLOCKED git=BLOCKED guard_exit=$GUARD_EXIT — $(tail -2 /tmp/plane5-guard.out | tr '\n' ' ')"
  echo "PLANE_5_BACKSTOP BLOCKED git=BLOCKED guard_exit=$GUARD_EXIT — $(tail -2 /tmp/plane5-guard.out | tr '\n' ' ')" >&2
  exit 1
fi

# ── plane 2: db regression + dual lag metrics (readonly) ─────────────
# V31 TURN 3 (R-4 §6): the collapsed OK/RECOVERY_REQUIRED/ALERT probe (which
# also CRASHED outright on a missing database file — sqlite3.connect on an
# absent path raises and the whole readout evaporated) is replaced by the
# SHARED 14-state classifier: scripts/plane5-db-verify.ts consumes db-probe's
# explicit outcomes, the generation-store pointer/journal, and the committed
# layer — the SAME taxonomy the monitor and the heartbeat writer consume.
# An unavailable/unparseable verifier is FAIL-CLOSED: inability to verify the
# database is NEVER reported as health.
DB_READOUT="$(bun run scripts/plane5-db-verify.ts 2>/dev/null || true)"
DBV_OK="$(printf '%s' "$DB_READOUT" | python3 -c 'import json,sys
try:
    d = json.load(sys.stdin); assert d.get("state")
    print("yes")
except Exception:
    print("no")' 2>/dev/null || echo no)"
if [ "$DBV_OK" != "yes" ]; then
  DB_READOUT='{"state":"DATABASE_UNREADABLE","severity":"alert","detail":"plane5-db-verify unavailable or unparseable (fail-closed — never health)","liveTip":0,"customRows":0,"unbackedAhead":0,"recoveryDeficit":0,"diskTip":null,"publishedTip":null,"committedTip":null,"snapshotParseOk":false}'
fi
DB_PLANE="$(printf '%s' "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["state"])')"
DB_SEVERITY="$(printf '%s' "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("severity","alert"))')"
DB_DETAIL="$(printf '%s' "$DB_READOUT" | python3 -c 'import json,sys; print(str(json.load(sys.stdin).get("detail","n/a"))[:220])')"
LIVE_TIP="$(printf '%s' "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("liveTip") or 0)')"
CROWS="$(printf '%s' "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("customRows") or 0)')"
UNBACKED="$(printf '%s' "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("unbackedAhead") or 0)')"
DEFICIT="$(printf '%s' "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("recoveryDeficit") or 0)')"
COMMITTED_TIP="$(printf '%s' "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("committedTip") or "?")')"
DISK_TIP="$(printf '%s' "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("diskTip") or "?")')"
PUBLISHED_TIP="$(printf '%s' "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("publishedTip") or "?")')"

# ── plane 2b: validated snapshot publication (V31 TURN 2A) ────────────
# The recovery source of record is published by the VALIDATED atomic path:
# staging → structural validation → manifest (sha256/genesis/height/version)
# → tracked files → commit (exactly the three snapshot paths) → push. This is
# the replacement for the v30 “backstop commit rule includes
# backups/db-snapshots” mitigation: the write-behind no longer dirties the
# tracked files at all, so the platform turn-end sweep has nothing to sweep.
PUBLISH_OUT="$(bun run scripts/snapshot-publish.ts 2>/dev/null | tail -1)"
PUBLISHED_NOW="$(printf '%s' "$PUBLISH_OUT" | python3 -c 'import json,sys
try:
    d = json.load(sys.stdin)
    print("yes" if d.get("published") else "no")
except Exception:
    print("no")' 2>/dev/null || echo no)"
PUBLISH_COMMIT="$(printf '%s' "$PUBLISH_OUT" | python3 -c 'import json,sys
try:
    d = json.load(sys.stdin)
    print(d.get("commit") or "none")
except Exception:
    print("none")' 2>/dev/null || echo none)"

# ── plane 3: dev server + watchdog (sanctioned remediation) ──────────
SERVER="$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://localhost:3000/ 2>/dev/null || echo 000)"
WATCHDOG_ALIVE="$(ps aux | grep dev-watchdog | grep -v grep | head -1 | wc -l)"
REMEDIATED="no"
if [ "$SERVER" != "200" ] || [ "$WATCHDOG_ALIVE" = "0" ]; then
  pkill -f 'next dev' 2>/dev/null; sleep 2
  ( setsid bash dev-watchdog.sh >> /tmp/watchdog-launch.log 2>&1 & )
  sleep 60
  SERVER="$(curl -s -o /dev/null -w '%{http_code}' -m 5 http://localhost:3000/ 2>/dev/null || echo 000)"
  WATCHDOG_ALIVE="$(ps aux | grep dev-watchdog | grep -v grep | head -1 | wc -l)"
  REMEDIATED="yes"
fi
SERVER_PLANE="$SERVER"; [ "$WATCHDOG_ALIVE" != "0" ] && [ "$SERVER" = "200" ] && SERVER_PLANE="200+watchdog"
WATCHDOG_STATE="no"; [ "$WATCHDOG_ALIVE" != "0" ] && WATCHDOG_STATE="yes"

# ── plane 4: upload route (fail-closed 403) ──────────────────────────
ROUTE_STATE="present"
[ -f src/app/api/constituency/upload/route.ts ] || ROUTE_STATE="missing"
ROUTE="$(curl -s -o /dev/null -w '%{http_code}' -m 5 -X POST http://localhost:3000/api/constituency/upload 2>/dev/null || echo 000)"
if [ "$ROUTE_STATE" = "missing" ] && [ "$GIT_PLANE" = "OK" ]; then
  git checkout origin/main -- src/app/api/constituency/upload/route.ts 2>/dev/null && ROUTE_STATE="WORKTREE-ONLY(temporary)"
fi

# ── plane 6 (5 is the report): dual heartbeat via tracked writer ────
# The writer re-measures every plane fresh from one clock source, verifies
# tsIso↔tsMs round-trip, writes /tmp always and the durable copy only when
# git is synced. Its output is re-verified here before being trusted.
HB_OUT="$(bun run scripts/plane5-backstop-heartbeat.ts 2>/tmp/plane5-hb-writer.err)"
HB_JSON="$(echo "$HB_OUT" | python3 -c '
import sys, json
try:
    d = json.loads(sys.stdin.read())
    keep = ("tsIso", "tsMs", "result", "originSha", "chainTip", "customRows", "planes")
    print(json.dumps({k: d.get(k) for k in keep}))
except Exception:
    print("{}")' 2>/dev/null || echo '{}')"
HB_OK="$(echo "$HB_JSON" | python3 -c '
import json, sys, datetime
d = json.load(sys.stdin)
try:
    ok = int(datetime.datetime.fromisoformat(d["tsIso"].replace("Z","+00:00")).timestamp()*1000) == d["tsMs"] and bool(d.get("result"))
except Exception:
    ok = False
print("yes" if ok else "no")' 2>/dev/null || echo no)"
if [ "$HB_OK" != "yes" ]; then
  # writer failed/unverified: fall back to building the heartbeat here (same
  # contract). V31 TURN 3 (R-4): carries the 14-state dbState and severity.
  HB_JSON="$(python3 - "$GIT_PLANE" "$DB_PLANE" "$DB_SEVERITY" "$SERVER" "$ROUTE" "$UNBACKED" "$DEFICIT" "$LIVE_TIP" "$CROWS" "$ORIGIN_SHA" "$WATCHDOG_STATE" <<'PYEOF'
import json, sys, datetime, os
git, db_state, sev, server, route, unb, deficit, tip, rows, origin, wd = sys.argv[1:12]
n = datetime.datetime.now(datetime.timezone.utc); ts_ms = int(n.timestamp()*1000)
ts = n.strftime("%Y-%m-%dT%H:%M:%S.") + f"{n.microsecond//1000:03d}Z"
assert int(datetime.datetime.fromisoformat(ts.replace("Z","+00:00")).timestamp()*1000) == ts_ms
db = "OK" if db_state in ("HEALTHY", "DATABASE_RECOVERED") else db_state
# V31 RC-4 + TURN 3: overall OK requires EVERY plane (watchdog owner alive,
# db healthy-family state) — a fresh heartbeat must never claim health while
# one is missing. Severity carries the taxonomy; no generic ALERT.
result = "OK" if (git=="OK" and db=="OK" and server=="200" and route=="403" and wd=="yes") else ("ALERT" if sev=="alert" else "BLOCKED")
hb = {"tsIso": ts, "tsMs": ts_ms, "nextDueMs": ts_ms+3600000,
      "planes": {"git": git, "db": db, "dbState": db_state, "dbSeverity": sev, "server": server, "route": route, "watchdog": wd, "unbackedAhead": int(unb), "recoveryDeficit": int(deficit)},
      "chainTip": int(tip), "customRows": int(rows), "originSha": origin, "result": result}
open("/tmp/plane5-heartbeat.json","w").write(json.dumps(hb, indent=2)+"\n")
if git == "OK": open("backups/plane5/heartbeat.json","w").write(json.dumps(hb, indent=2)+"\n")
print(json.dumps(hb))
PYEOF
)"
fi
HB_RESULT="$(echo "$HB_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("result","?"))')"
HB_TSISO="$(echo "$HB_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tsIso","?"))')"

# worklog entry when remediation was performed
if [ "$REMEDIATED" = "yes" ] || [ "$ROUTE_STATE" = "WORKTREE-ONLY(temporary)" ] || [ -f /tmp/plane5-rebootstrap.out ]; then
  {
    echo ""
    echo "## $(date -u +%FT%TZ) — plane5 backstop (job $JOB_ID, deterministic runner)"
    echo "- remediation: server/watchdog relaunch=$REMEDIATED · route=$ROUTE_STATE · rebootstrap=$( [ -f /tmp/plane5-rebootstrap.out ] && echo yes || echo no )"
    echo "- planes: git=$GIT_PLANE db=$DB_PLANE server=$SERVER_PLANE route=$ROUTE · tip=h$LIVE_TIP rows=$CROWS unbacked=$UNBACKED deficit=$DEFICIT"
    echo "- heartbeat: $HB_TSISO result=$HB_RESULT (dual write: /tmp + durable-when-synced)"
  } >> worklog.md 2>/dev/null || true
fi

# commit rules (V31 TURN 2A: snapshots are owned by the validated publisher —
# plane 2b above — so these rules now cover ONLY the plane-5 evidence files and
# the worklog; backups/db-snapshots is deliberately absent from every git add,
# and a dirty snapshot file routes to the honest held-dirty branch so the next
# publisher/repair pass owns it. git synced-or-safe here by construction —
# BLOCKED exited earlier.)
COMMIT_SHA="none"
DIRTY="$(git status --porcelain | wc -l)"
if [ "$HB_RESULT" = "OK" ] || python3 -c '
import subprocess, sys
out = subprocess.run(["git","status","--porcelain"], capture_output=True, text=True).stdout
sys.exit(0 if all(l.split()[-1].startswith(("backups/plane5/","worklog.md")) for l in out.splitlines() if l.strip()) else 1)'; then
  if git add backups/plane5 worklog.md 2>/dev/null; then
    if git commit -m "plane5-heartbeat: $HB_TSISO $HB_RESULT" >/dev/null 2>&1; then
      if git push origin main >/dev/null 2>&1; then
        COMMIT_SHA="$(git rev-parse --short HEAD)"
      else
        # push rejected: guard ONCE (realigns; plane5 files derivable), rewrite, retry once
        bun run scripts/git-drift-guard.ts >/dev/null 2>&1
        bun run scripts/plane5-backstop-heartbeat.ts >/dev/null 2>&1
        git add backups/plane5 worklog.md 2>/dev/null
        git commit -m "plane5-heartbeat: $(date -u +%FT%T.%3NZ) $HB_RESULT (post-realign retry)" >/dev/null 2>&1 \
          && git push origin main >/dev/null 2>&1 && COMMIT_SHA="$(git rev-parse --short HEAD)" || { git checkout -- backups/plane5/ 2>/dev/null; COMMIT_SHA="push-failed-restored"; }
      fi
    else
      git checkout -- backups/plane5/ 2>/dev/null; COMMIT_SHA="nothing-to-commit"
    fi
  fi
else
  # non-OK with non-plane5 tree changes: durable heartbeat already written by the
  # writer when git=OK — commit ONLY plane5 files is impossible; report honestly.
  # (A dirty backups/db-snapshots file lands here too: the publisher owns it.)
  git add backups/plane5 2>/dev/null && git commit -m "plane5-heartbeat: $HB_TSISO $HB_RESULT" >/dev/null 2>&1 \
    && git push origin main >/dev/null 2>&1 && COMMIT_SHA="$(git rev-parse --short HEAD)" || { git checkout -- backups/plane5/ 2>/dev/null; COMMIT_SHA="held-nonplane5-dirty"; }
fi

# git-state attribution (V31 TURN 2A): the classification the bootstrap used,
# read back from the report it persisted (never re-derived — the ledger must
# attribute the SAME state that gated this execution).
GIT_STATE_FINAL="$(python3 -c 'import json
try:
    print(json.load(open("/tmp/plane5-git-state.json"))["state"])
except Exception:
    print("UNKNOWN")' 2>/dev/null || echo UNKNOWN)"

ledger FINAL "EXECUTED-$HB_RESULT" "git=$GIT_PLANE" "gitState=$GIT_STATE_FINAL" "db=$DB_PLANE" "dbState=$DB_PLANE" "dbSeverity=$DB_SEVERITY" "dbDetail=$DB_DETAIL" "server=$SERVER_PLANE" "route=$ROUTE" \
  "result=$HB_RESULT" "heartbeatTsIso=$HB_TSISO" "chainTip=$LIVE_TIP" "customRows=$CROWS" \
  "unbackedAhead=$UNBACKED" "recoveryDeficit=$DEFICIT" "diskTip=$DISK_TIP" "publishedTip=$PUBLISHED_TIP" "committedTip=$COMMITTED_TIP" \
  "snapshotPublished=$PUBLISHED_NOW" "publishCommit=$PUBLISH_COMMIT" "repair=$REPAIR_STATUS" \
  "remediated=$REMEDIATED" "routeState=$ROUTE_STATE" "commit=$COMMIT_SHA" "originSha=$ORIGIN_SHA"

echo "PLANE_5_BACKSTOP git=$GIT_PLANE gitState=$GIT_STATE_FINAL db=$DB_PLANE server=$SERVER_PLANE route=$ROUTE tip=h$LIVE_TIP rows=$CROWS unbacked=$UNBACKED deficit=$DEFICIT published=h$PUBLISHED_TIP snapshotPublished=$PUBLISHED_NOW heartbeat=$HB_TSISO result=$HB_RESULT origin=$ORIGIN_SHA commit=$COMMIT_SHA job=$JOB_ID"
exit 0
