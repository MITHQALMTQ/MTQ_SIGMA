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
JOB_ID="manual"
SCHED_JSON="null"
shift 2>/dev/null || true
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
# concurrent self-heal operations are structurally impossible (v30 §3 Phase B)
if [ "$MODE" = "backstop" ]; then
  exec 9>/tmp/plane5-backstop.lock
  if ! flock -n 9; then
    echo "$(date -u +%FT%T.%3NZ) {\"mode\":\"backstop\",\"jobId\":\"$JOB_ID\",\"phase\":\"FINAL\",\"outcome\":\"OVERLAP-SKIP\"}" >> /tmp/plane5-execution-ledger.jsonl
    echo "PLANE_5_BACKSTOP OVERLAP_SKIP — lock held by a concurrent execution; this fire stands down (no concurrent self-heal)"
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
for p in (path, "backups/plane5/execution-ledger.jsonl"):
    try:
        os.makedirs(os.path.dirname(p), exist_ok=True) if os.path.dirname(p) and not os.path.exists(os.path.dirname(p)) else None
        with open(p, 'a') as f: f.write(line + "\n")
    except Exception:
        pass
PYEOF
}

# ── (§0) bootstrap from authoritative origin — NEVER raw-git realign ──
BOOT_OUT="$( { REMOTE="$(git remote get-url origin 2>/dev/null)"; case "$REMOTE" in *MITHQALMTQ/MTQ_SIGMA*) ;; *) echo REMOTE_AUTH_FAIL; exit 9;; esac; git fetch origin >/dev/null 2>&1 || { echo FETCH_FAIL_BLOCKED; exit 9; }; if [ -f scripts/plane5-bootstrap.sh ]; then bash scripts/plane5-bootstrap.sh; else git show origin/main:scripts/plane5-bootstrap.sh > /tmp/plane5-bootstrap.sh && bash /tmp/plane5-bootstrap.sh; fi; } 2>&1 )"
BOOT_EXIT=$?
if [ "$BOOT_EXIT" -ne 0 ]; then
  ledger FINAL "BOOTSTRAP-FAILED" "bootstrapExit=$BOOT_EXIT" "bootstrapTail=$(echo "$BOOT_OUT" | tail -2 | tr '\n' ' ')"
  # v30 hotfix: BLOCKED line is emitted to BOTH streams — the relay agent must
  # see the classification even if one stream is dropped on non-zero exit.
  echo "PLANE_5_${MODE^^} BLOCKED bootstrap_exit=$BOOT_EXIT — $(echo "$BOOT_OUT" | tail -1)"
  echo "PLANE_5_${MODE^^} BLOCKED bootstrap_exit=$BOOT_EXIT — $(echo "$BOOT_OUT" | tail -1)" >&2
  exit 9
fi
echo "$BOOT_OUT" | tail -4

# tree is bootstrapped (synced) → durable ledger writes are permitted
ORIGIN_SHA="$(git rev-parse origin/main)"

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
    print(json.dumps({"hb": "MISSING", "tsMs": 0, "tsIso": "MISSING", "result": "MISSING"})); raise SystemExit
hb = json.load(open(path))
n = datetime.datetime.now(datetime.timezone.utc); now_ms = int(n.timestamp()*1000)
try:
    parsed = int(datetime.datetime.fromisoformat(hb["tsIso"].replace("Z","+00:00")).timestamp()*1000)
except Exception:
    parsed = -1
consistent = parsed == hb["tsMs"]
age = (now_ms - hb["tsMs"]) // 1000 if consistent else 999999999
cls = ("PLANE_5_ALERT" if age >= 9000 else
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

  ALERTING="no"
  [ "$CLASSIFICATION" != "PLANE_5_OK" ] && ALERTING="yes"

  if [ "$ALERTING" = "yes" ]; then
    # alert flow: durable alerts.log line + monitor-state (durable+/tmp)
    python3 - "$AGE_S" "$CLASSIFICATION" "$HB_TSISO" "$HB_RESULT" <<'PYEOF'
import json, sys, datetime, os
age, cls, hb_ts, hb_res = sys.argv[1:5]
n = datetime.datetime.now(datetime.timezone.utc)
ts = n.strftime("%Y-%m-%dT%H:%M:%S.") + f"{n.microsecond//1000:03d}Z"
now_ms = int(n.timestamp()*1000)
line = f"{ts} age={age} classification={cls} heartbeat={hb_ts} result={hb_res}"
with open("backups/plane5/alerts.log", "a") as f: f.write(line + "\n")
state = {"lastSeenMs": now_ms, "lastResult": hb_res if hb_res != "MISSING" else "MISSING", "missingSinceMs": now_ms if hb_res == "MISSING" else None}
json.dump(state, open("backups/plane5/monitor-state.json", "w"))
json.dump(state, open("/tmp/plane5-monitor-state.json", "w"))
PYEOF
  else
    # healthy run: still refresh state (fresh durable read clears missingSince)
    python3 - "$HB_RESULT" <<'PYEOF'
import json, sys, datetime
n = datetime.datetime.now(datetime.timezone.utc); now_ms = int(n.timestamp()*1000)
state = {"lastSeenMs": now_ms, "lastResult": sys.argv[1], "missingSinceMs": None}
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
  if { [ "$ALERTING" = "yes" ] || [ "$CLASSIFICATION" != "$LAST_CLS" ]; } && [ "$THROTTLE_OK" = "yes" ]; then
    if git add backups/plane5 2>/dev/null && git commit -m "plane5-monitor: $(date -u +%FT%T.%3NZ) $CLASSIFICATION" >/dev/null 2>&1 && git push origin main >/dev/null 2>&1; then
      COMMIT_SHA="$(git rev-parse --short HEAD)"
    else
      git checkout -- backups/plane5/ 2>/dev/null; COMMIT_SHA="commit-failed-restored"
    fi
  fi

  ledger FINAL "EXECUTED-$CLASSIFICATION" "classification=$CLASSIFICATION" "heartbeatTsIso=$HB_TSISO" "ageS=$AGE_S" "heartbeatResult=$HB_RESULT" "heartbeatOriginSha=$HB_ORIGIN" "commit=$COMMIT_SHA"
  echo "PLANE_5_MONITOR $CLASSIFICATION age=${AGE_S}s hb=$HB_TSISO result=$HB_RESULT origin=$HB_ORIGIN job=$JOB_ID ledger=outcome=EXECUTED-$CLASSIFICATION"
  exit 0
fi

# ════════════════════════════════════════════════════════════════════
# BACKSTOP — six planes, sanctioned remediation (v3.2 contract)
# ════════════════════════════════════════════════════════════════════
exec 9>/tmp/plane5-backstop.lock
if ! flock -n 9; then :; fi # lock already acquired above (kept for clarity)
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
DB_READOUT="$(python3 - <<'PYEOF'
import sqlite3, json, subprocess, re
def ro(p):
    c = sqlite3.connect(f"file:{p}?mode=ro", uri=True); return c
chain = ro("db/chain.db")
h, n = chain.execute("SELECT MAX(height), COUNT(*) FROM blocks").fetchone()
integrity = chain.execute("PRAGMA integrity_check").fetchone()[0]
meta = dict(chain.execute("SELECT key, value FROM meta").fetchall())
chain.close()
custom = ro("db/custom.db")
tables = [r[0] for r in custom.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'").fetchall()]
crows = sum(custom.execute(f"SELECT COUNT(*) FROM [{t}]").fetchone()[0] for t in tables)
cintegrity = custom.execute("PRAGMA integrity_check").fetchone()[0]
custom.close()
def tip(src):
    try:
        line = src.split("\n")[2]
        m = re.search(r"height=(\d+)", line)
        return int(m.group(1)) if m else -1
    except Exception:
        return -1
disk_tip = tip(open("backups/db-snapshots/latest-chain.sql", errors="replace").read(4096))
committed = subprocess.run(["git", "show", "origin/main:backups/db-snapshots/latest-chain.sql"], capture_output=True, timeout=60).stdout.decode(errors="replace")
committed_tip = tip(committed)
unbacked = max(0, (h or 0) - committed_tip)
deficit = max(0, committed_tip - (h or 0))
floors_ok = integrity == "ok" and cintegrity == "ok" and (h or 0) >= 500 and crows >= 4000 and meta.get("boot_mode") != "re-seeded"
db = "OK" if (floors_ok and deficit <= 60) else ("ALERT" if (not floors_ok or deficit > 10000) else "RECOVERY_REQUIRED")
print(json.dumps({"liveTip": h, "nBlocks": n, "customRows": crows, "integrity": integrity, "customIntegrity": cintegrity,
                  "bootMode": meta.get("boot_mode"), "diskTip": disk_tip, "committedTip": committed_tip,
                  "unbackedAhead": unbacked, "recoveryDeficit": deficit, "db": db}))
PYEOF
)"
DB_PLANE="$(echo "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["db"])')"
LIVE_TIP="$(echo "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["liveTip"])')"
CROWS="$(echo "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["customRows"])')"
UNBACKED="$(echo "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["unbackedAhead"])')"
DEFICIT="$(echo "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["recoveryDeficit"])')"
COMMITTED_TIP="$(echo "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["committedTip"])')"
DISK_TIP="$(echo "$DB_READOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["diskTip"])')"

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
  # writer failed/unverified: fall back to building the heartbeat here (same contract)
  HB_JSON="$(python3 - "$GIT_PLANE" "$DB_PLANE" "$SERVER" "$ROUTE" "$UNBACKED" "$DEFICIT" "$LIVE_TIP" "$CROWS" "$ORIGIN_SHA" <<'PYEOF'
import json, sys, datetime, os
git, db, server, route, unb, deficit, tip, rows, origin = sys.argv[1:10]
n = datetime.datetime.now(datetime.timezone.utc); ts_ms = int(n.timestamp()*1000)
ts = n.strftime("%Y-%m-%dT%H:%M:%S.") + f"{n.microsecond//1000:03d}Z"
assert int(datetime.datetime.fromisoformat(ts.replace("Z","+00:00")).timestamp()*1000) == ts_ms
result = "OK" if (git=="OK" and db=="OK" and server=="200" and route=="403") else ("ALERT" if db=="ALERT" else "BLOCKED")
hb = {"tsIso": ts, "tsMs": ts_ms, "nextDueMs": ts_ms+3600000,
      "planes": {"git": git, "db": db, "server": server, "route": route, "unbackedAhead": int(unb), "recoveryDeficit": int(deficit)},
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

# commit rules (git synced here by construction — BLOCKED exited earlier)
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
  git add backups/plane5 2>/dev/null && git commit -m "plane5-heartbeat: $HB_TSISO $HB_RESULT" >/dev/null 2>&1 \
    && git push origin main >/dev/null 2>&1 && COMMIT_SHA="$(git rev-parse --short HEAD)" || { git checkout -- backups/plane5/ 2>/dev/null; COMMIT_SHA="held-nonplane5-dirty"; }
fi

ledger FINAL "EXECUTED-$HB_RESULT" "git=$GIT_PLANE" "db=$DB_PLANE" "server=$SERVER_PLANE" "route=$ROUTE" \
  "result=$HB_RESULT" "heartbeatTsIso=$HB_TSISO" "chainTip=$LIVE_TIP" "customRows=$CROWS" \
  "unbackedAhead=$UNBACKED" "recoveryDeficit=$DEFICIT" "diskTip=$DISK_TIP" "committedTip=$COMMITTED_TIP" \
  "remediated=$REMEDIATED" "routeState=$ROUTE_STATE" "commit=$COMMIT_SHA" "originSha=$ORIGIN_SHA"

echo "PLANE_5_BACKSTOP git=$GIT_PLANE db=$DB_PLANE server=$SERVER_PLANE route=$ROUTE tip=h$LIVE_TIP rows=$CROWS unbacked=$UNBACKED deficit=$DEFICIT heartbeat=$HB_TSISO result=$HB_RESULT origin=$ORIGIN_SHA commit=$COMMIT_SHA job=$JOB_ID"
exit 0
