#!/usr/bin/env bash
# MTQΣ — V31 TURN 2A isolated regression harness (incident 19 root-cause fix).
#
# Runs the FULL Phase 6 matrix (20 scenarios) plus the Phase 7 incident-19
# reproduction against ISOLATED clones with disposable database fixtures:
#   • every sandbox is a throwaway copy of a minimal template repository that
#     carries the REAL light tooling (plane5-bootstrap.sh, plane5-run.sh,
#     git-drift-guard.ts, git-state-classify.ts, snapshot-publish.ts,
#     plane5-backstop-heartbeat.ts, src/lib/boot/{git-drift,git-state,
#     snapshot-manifest}.ts) — the system under test is the production code;
#   • every sandbox origin is a throwaway bare repo whose URL contains
#     MITHQALMTQ/MTQ_SIGMA (the authenticity pattern §3.3 checks);
#   • the LIVE repository, the LIVE databases, and the LIVE :3000 server are
#     NEVER touched: PATH stubs neutralize ss/curl/ps/pkill for wrapper-level
#     scenarios (ss finds no listener so the guard can never kill the real
#     server; curl is answered 200/403 locally; ps shows a synthetic
#     watchdog);
#   • the live databases are never read: fixture sqlite files are generated
#     per-sandbox with python3.
#
# Usage: bash tests/plane5-git-state-regression.sh   (from the repo root)
# Output: PASS/FAIL per scenario + a final summary; exit 0 iff all pass.

set -uo pipefail

REPO_SRC="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d /tmp/mtq-v31-t2a-XXXXXX)"
STUBS="$WORK/stubs"
PASS=0; FAIL=0; FAILED_SCENARIOS=""

log()  { printf '\033[36m[HARNESS]\033[0m %s\n' "$*"; }
ok()   { PASS=$((PASS+1)); printf '\033[32m  PASS\033[0m %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); FAILED_SCENARIOS="$FAILED_SCENARIOS $1"; printf '\033[31m  FAIL\033[0m %s\n' "$2"; }

check() { # check <scenario-id> <description> <expected> <actual>
  if [ "$3" = "$4" ]; then ok "$2"; else bad "$1" "$2 — expected '$3' got '$4'"; fi
}
check_contains() { # check_contains <scenario-id> <description> <needle> <haystack>
  case "$4" in *"$3"*) ok "$2" ;; *) bad "$1" "$2 — '$3' not found" ;; esac
}

# ─── PATH stubs (live-system isolation) ──────────────────────────────────────
mkdir -p "$STUBS"
cat > "$STUBS/ss" <<'EOF'
#!/bin/sh
# isolation stub: no listeners are ever found; the drift guard CLI can never
# kill the real :3000 dev server from inside a test sandbox.
exit 0
EOF
cat > "$STUBS/curl" <<'EOF'
#!/bin/sh
# isolation stub: answer the wrapper/writer plane probes locally.
case " $* " in *" -X "*) echo 403 ;; *) echo 200 ;; esac
EOF
cat > "$STUBS/ps" <<'EOF'
#!/bin/sh
# isolation stub: a synthetic watchdog is always alive.
echo "bash dev-watchdog.sh"
EOF
cat > "$STUBS/pkill" <<'EOF'
#!/bin/sh
# isolation stub: never kill real processes from a test sandbox.
exit 0
EOF
chmod +x "$STUBS"/*

# ─── dump fixture builders ───────────────────────────────────────────────────
GENESIS="gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d"

make_chain_dump() { # <path> <height> [no_genesis] [no_commit_trailer]
  local path="$1" height="$2" extra="" trailer="COMMIT;"
  [ "${3:-}" = "no_genesis" ] || extra="-- genesis $GENESIS present in canonical chain"
  [ "${4:-}" = "torn" ] && trailer="-- COMMIT; (truncated)"
  {
    echo "-- MTQΣ logical backup (format v2: schema+data, self-contained) fixture @ h$height"
    echo "-- Restore: executeMultiple() this file into an EMPTY sqlite file."
    echo "-- MTQ-DUMP-TIP rows=1250 height=$height tables=8 [blocks:600 validators:8]"
    echo "-- $extra"
    echo "PRAGMA foreign_keys=OFF;"
    echo "BEGIN TRANSACTION;"
    echo "CREATE TABLE blocks (height INTEGER PRIMARY KEY, hash TEXT);"
    echo "INSERT INTO blocks (height, hash) VALUES ($height, 'x');"
    echo "$trailer"
  } > "$path"
}

make_custom_dump() { # <path> <rows>
  {
    echo "-- MTQΣ logical backup (format v2: schema+data, self-contained) fixture"
    echo "-- Restore: executeMultiple() this file into an EMPTY sqlite file."
    echo "-- MTQ-DUMP-TIP rows=$2 height=- tables=9 [telemetry:$2]"
    echo "PRAGMA foreign_keys=OFF;"
    echo "BEGIN TRANSACTION;"
    echo "CREATE TABLE telemetry (id INTEGER PRIMARY KEY, v REAL);"
    echo "INSERT INTO telemetry (id, v) VALUES (1, 0.5);"
    echo "COMMIT;"
  } > "$1"
}

make_manifest() { # <chain_path> <custom_path> <out> <version>
  python3 - "$1" "$2" "$3" "$4" "$GENESIS" <<'PYEOF'
import hashlib, json, re, sys, datetime
chain_p, custom_p, out, version, genesis = sys.argv[1:6]
def tip(path):
    t = open(path).read()
    m = re.search(r"^-- MTQ-DUMP-TIP rows=(\d+) height=(\d+|-) tables=(\d+)", t, re.M)
    return int(m.group(1)), (None if m.group(2) == "-" else int(m.group(2))), t
crows, cheight, ctext = tip(chain_p)
xrows, _, xtext = tip(custom_p)
man = {
  "version": int(version), "format": 1,
  "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
  "source": {"repo": "MITHQALMTQ/MTQ_SIGMA", "environment": "testnet-shadow"},
  "chain": {"path": "backups/db-snapshots/latest-chain.sql", "sourceDb": "db/chain.db",
            "sha256": hashlib.sha256(ctext.encode()).hexdigest(), "bytes": len(ctext.encode()),
            "height": cheight, "rows": crows, "genesis": genesis, "dumpFormat": 2},
  "custom": {"path": "backups/db-snapshots/latest-custom.sql", "sourceDb": "db/custom.db",
             "sha256": hashlib.sha256(xtext.encode()).hexdigest(), "bytes": len(xtext.encode()),
             "rows": xrows, "dumpFormat": 2},
}
open(out, "w").write(json.dumps(man, indent=2) + "\n")
PYEOF
}

# ─── template repository (the system under test + stubs) ─────────────────────
TEMPLATE="$WORK/template"
build_template() {
  mkdir -p "$TEMPLATE/scripts" "$TEMPLATE/src/lib/boot" "$TEMPLATE/backups/db-snapshots" \
           "$TEMPLATE/backups/plane5" "$TEMPLATE/db" "$TEMPLATE/src/app"
  # REAL light tooling — the production code under test.
  cp "$REPO_SRC/scripts/plane5-bootstrap.sh"            "$TEMPLATE/scripts/"
  cp "$REPO_SRC/scripts/plane5-run.sh"                  "$TEMPLATE/scripts/"
  cp "$REPO_SRC/scripts/git-drift-guard.ts"             "$TEMPLATE/scripts/"
  cp "$REPO_SRC/scripts/git-state-classify.ts"          "$TEMPLATE/scripts/"
  cp "$REPO_SRC/scripts/snapshot-publish.ts"            "$TEMPLATE/scripts/"
  # V31 TURN 3 (R-4 §6): the 14-state DB-plane verifier + its library
  # dependencies (db-plane-state classifier, db-probe outcomes, the
  # generation-store pointer/journal readers) + the runtime preflight
  # (bootstrap §3.11 — the template carries package.json + a node_modules
  # symlink so the preflight and the @libsql imports resolve exactly as in
  # production).
  cp "$REPO_SRC/scripts/plane5-db-verify.ts"            "$TEMPLATE/scripts/"
  cp "$REPO_SRC/scripts/runtime-preflight.ts"          "$TEMPLATE/scripts/"
  cp "$REPO_SRC/src/lib/boot/db-plane-state.ts"         "$TEMPLATE/src/lib/boot/"
  cp "$REPO_SRC/src/lib/boot/db-probe.ts"               "$TEMPLATE/src/lib/boot/"
  cp "$REPO_SRC/src/lib/boot/generation-store.ts"      "$TEMPLATE/src/lib/boot/"
  cp "$REPO_SRC/package.json"                          "$TEMPLATE/package.json"
  ln -sfn "$REPO_SRC/node_modules"                      "$TEMPLATE/node_modules"
  cp "$REPO_SRC/scripts/plane5-backstop-heartbeat.ts"   "$TEMPLATE/scripts/"
  cp "$REPO_SRC/src/lib/boot/git-drift.ts"              "$TEMPLATE/src/lib/boot/"
  cp "$REPO_SRC/src/lib/boot/git-state.ts"              "$TEMPLATE/src/lib/boot/"
  cp "$REPO_SRC/src/lib/boot/snapshot-manifest.ts"      "$TEMPLATE/src/lib/boot/"
  # Existence-only stubs (§3.9 prerequisites + authority checks read presence).
  echo "// stub: recovery CLI presence fixture (the classifier checks existence at HEAD)" > "$TEMPLATE/scripts/db-selfheal.ts"
  echo "// stub: db-ops presence fixture" > "$TEMPLATE/src/lib/db-ops.ts"
  echo "// stub: source-integrity heal presence fixture" > "$TEMPLATE/scripts/source-integrity-heal.ts"
  echo "#!/bin/bash
# stub watchdog (presence fixture for §3.9)" > "$TEMPLATE/dev-watchdog.sh"
  chmod +x "$TEMPLATE/dev-watchdog.sh"
  echo "// fixture app source" > "$TEMPLATE/src/app/page.ts"
  mkdir -p "$TEMPLATE/src/app/api/constituency/upload"
  echo "// fixture upload route (403 fail-closed gate)" > "$TEMPLATE/src/app/api/constituency/upload/route.ts"
  echo "# fixture worklog" > "$TEMPLATE/worklog.md"
  echo '{"lastSeenMs":0,"lastResult":"OK","missingSinceMs":null,"bootstrapState":"OK"}' > "$TEMPLATE/backups/plane5/monitor-state.json"
  touch "$TEMPLATE/backups/plane5/execution-ledger.jsonl" "$TEMPLATE/backups/plane5/alerts.log"
  # Baseline published snapshots + manifest at h19000 / 4100 rows (v1).
  make_chain_dump "$TEMPLATE/backups/db-snapshots/latest-chain.sql" 19000
  make_custom_dump "$TEMPLATE/backups/db-snapshots/latest-custom.sql" 4100
  make_manifest "$TEMPLATE/backups/db-snapshots/latest-chain.sql" \
                "$TEMPLATE/backups/db-snapshots/latest-custom.sql" \
                "$TEMPLATE/backups/db-snapshots/manifest.json" 1
  cat > "$TEMPLATE/.gitignore" <<'EOF'
/backups/db-snapshots/.staging/
node_modules
EOF
  # Fixture live databases (the wrapper's plane 2 + the heartbeat writer read these).
  python3 - "$TEMPLATE" <<'PYEOF'
import sqlite3, sys
root = sys.argv[1]
chain = sqlite3.connect(f"{root}/db/chain.db")
chain.execute("CREATE TABLE blocks (height INTEGER PRIMARY KEY, hash TEXT)")
chain.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)")
chain.executemany("INSERT INTO blocks (height, hash) VALUES (?, ?)", [(i, f"h{i}") for i in range(1, 19051)])
chain.execute("INSERT INTO meta (key, value) VALUES ('boot_mode', 'normal')")
chain.commit(); chain.close()
custom = sqlite3.connect(f"{root}/db/custom.db")
custom.execute("CREATE TABLE telemetry (id INTEGER PRIMARY KEY, v REAL)")
custom.executemany("INSERT INTO telemetry (id, v) VALUES (?, ?)", [(i, 0.5) for i in range(1, 4201)])
custom.commit(); custom.close()
PYEOF
  git -C "$TEMPLATE" init -q -b main
  git -C "$TEMPLATE" config user.name "T2A Harness"
  git -C "$TEMPLATE" config user.email "t2a@harness.test"
  git -C "$TEMPLATE" add -A
  git -C "$TEMPLATE" commit -qm "base: template with published snapshots + manifest v1"
}

# ─── sandbox factory ──────────────────────────────────────────────────────────
SANDBOX_N=0
new_sandbox() { # prints the sandbox path; sets $SB
  SANDBOX_N=$((SANDBOX_N+1))
  SB="$WORK/sb$SANDBOX_N"
  local ORG="$WORK/o$SANDBOX_N/MITHQALMTQ/MTQ_SIGMA.git"
  mkdir -p "$(dirname "$ORG")"
  cp -r "$TEMPLATE" "$SB"
  git init -q --bare -b main "$ORG"   # path form: creates the directory (git -C cannot chdir into a missing dir)
  git -C "$SB" remote remove origin 2>/dev/null || true
  git -C "$SB" remote add origin "$ORG"
  git -C "$SB" push -q -u origin main || { echo "HARNESS FATAL: sandbox origin push failed" >&2; exit 99; }
  SB_ORIGIN="$ORG"
  SB_BASE="$(git -C "$SB" rev-parse HEAD)"
  printf '%s' "$SB"
}

classify() { # <sandbox> [extra flags] → prints state; exit code preserved
  local sb="$1"; shift
  (cd "$sb" && MTQ_SIGMA_ROOT="$sb" bun run scripts/git-state-classify.ts "$@" 2>/dev/null) | python3 -c 'import json,sys; print(json.load(sys.stdin)["state"])'
}
classify_exit() {
  local sb="$1"; shift
  (cd "$sb" && MTQ_SIGMA_ROOT="$sb" bun run scripts/git-state-classify.ts "$@" >/dev/null 2>&1); echo $?
}
bootstrap_run() { # <sandbox> → prints "exit=N"
  local sb="$1"
  (cd "$sb" && MTQ_SIGMA_ROOT="$sb" PATH="$STUBS:$PATH" bash scripts/plane5-bootstrap.sh >/tmp/t2a-bootstrap.out 2>&1); echo "exit=$?"
}
bootstrap_out() { cat /tmp/t2a-bootstrap.out; }

# commit helpers (run inside sandbox cwd)
commit_valid_publication() { # <sandbox> <new_height> <new_rows> [version_hint]
  local sb="$1" h="$2" rows="$3"
  make_chain_dump "$sb/backups/db-snapshots/latest-chain.sql" "$h"
  make_custom_dump "$sb/backups/db-snapshots/latest-custom.sql" "$rows"
  local v; v=$(python3 -c 'import json; print(json.load(open("'"$sb"'/backups/db-snapshots/manifest.json"))["version"])' 2>/dev/null || echo 0)
  make_manifest "$sb/backups/db-snapshots/latest-chain.sql" "$sb/backups/db-snapshots/latest-custom.sql" \
                "$sb/backups/db-snapshots/manifest.json" "$((v+1))"
  git -C "$sb" add backups/db-snapshots/latest-chain.sql backups/db-snapshots/latest-custom.sql backups/db-snapshots/manifest.json
  git -C "$sb" commit -qm "snapshot-publish fixture: chain h$h custom r$rows"
}
commit_platform_sweep() { # <sandbox> <new_height> — dump-only, NO manifest (the incident-19 geometry)
  local sb="$1" h="$2"
  make_chain_dump "$sb/backups/db-snapshots/latest-chain.sql" "$h"
  git -C "$sb" add backups/db-snapshots/latest-chain.sql
  git -C "$sb" commit -qm "42c58ed2-fcb1-4f4e-accb-9a4b3ee89d37"
}
commit_source() { # <sandbox>
  local sb="$1"
  echo "// source change" >> "$sb/src/app/page.ts"
  git -C "$sb" add src/app/page.ts
  git -C "$sb" commit -qm "source change"
}
commit_mixed() { # <sandbox> <new_height> — dump + source in ONE commit
  local sb="$1" h="$2"
  make_chain_dump "$sb/backups/db-snapshots/latest-chain.sql" "$h"
  echo "// mixed change" >> "$sb/src/app/page.ts"
  git -C "$sb" add backups/db-snapshots/latest-chain.sql src/app/page.ts
  git -C "$sb" commit -qm "mixed: dump + source"
}
advance_origin() { # <sandbox> — push an unrelated commit to the sandbox BARE origin from a second clone
  local sb="$1"
  local cl="$WORK/advancer$SANDBOX_N"
  git clone -q "$SB_ORIGIN" "$cl"
  git -C "$cl" config user.name "T2A Advancer"
  git -C "$cl" config user.email "adv@harness.test"
  echo "# origin advance" >> "$cl/worklog.md"
  git -C "$cl" commit -qam "origin advance"
  git -C "$cl" push -q origin main
}
rewind_origin() { # make the local publication commits UNPUSHED again (simulated push failure / wrapper-commit-without-push)
  git -C "$SB_ORIGIN" update-ref refs/heads/main "$SB_BASE"
}

log ""
log "V31 TURN 2A regression harness — work dir $WORK"
log "Building template (real tooling + fixture snapshots + manifest v1)…"
build_template
log "Template ready. Running Phase 6 scenarios S1–S20 + Phase 7 P1/P2/R1…"

# ══════════════════════════ S1 — exact match ═════════════════════════════════
new_sandbox >/dev/null
check "S1" "S1 classifier: EXACT_MATCH"        "EXACT_MATCH"        "$(classify "$SB")"
check "S1" "S1 classifier exit 0"              "0"                  "$(classify_exit "$SB")"
check "S1" "S1 bootstrap exit 0"               "exit=0"             "$(bootstrap_run "$SB")"
check_contains "S1" "S1 bootstrap reports EXACT_MATCH" "git state EXACT_MATCH" "$(bootstrap_out)"

# ══════════════════════════ S2 — one valid snapshot-only ahead commit ════════
new_sandbox >/dev/null
commit_valid_publication "$SB" 19060 4100
check "S2" "S2 classifier: SAFE_SNAPSHOT_AHEAD (1 commit)" "SAFE_SNAPSHOT_AHEAD" "$(classify "$SB")"
check "S2" "S2 classifier exit 0 (proceed)"    "0"                  "$(classify_exit "$SB")"
check "S2" "S2 bootstrap exit 0"               "exit=0"             "$(bootstrap_run "$SB")"
check_contains "S2" "S2 bootstrap reports SAFE_SNAPSHOT_AHEAD" "SAFE_SNAPSHOT_AHEAD" "$(bootstrap_out)"

# ══════════════════════════ S3 — multiple valid snapshot-only commits ════════
new_sandbox >/dev/null
commit_valid_publication "$SB" 19060 4100
commit_valid_publication "$SB" 19120 4150
commit_valid_publication "$SB" 19180 4200
check "S3" "S3 classifier: SAFE (3 commits)"   "SAFE_SNAPSHOT_AHEAD" "$(classify "$SB")"
check "S3" "S3 bootstrap exit 0"               "exit=0"             "$(bootstrap_run "$SB")"

# ══════════════════════════ S4 — source-code ahead ═══════════════════════════
new_sandbox >/dev/null
commit_source "$SB"
check "S4" "S4 classifier: SOURCE_CODE_AHEAD"  "SOURCE_CODE_AHEAD"  "$(classify "$SB")"
check "S4" "S4 classifier exit 10 (blocked)"   "10"                 "$(classify_exit "$SB")"
check "S4" "S4 bootstrap BLOCKED exit 13"      "exit=13"            "$(bootstrap_run "$SB")"
check_contains "S4" "S4 bootstrap names the state" "SOURCE_CODE_AHEAD" "$(bootstrap_out)"

# ══════════════════════════ S5 — mixed snapshot+source commit ════════════════
new_sandbox >/dev/null
commit_mixed "$SB" 19060
check "S5" "S5 classifier: SOURCE_CODE_AHEAD (mixed)" "SOURCE_CODE_AHEAD" "$(classify "$SB")"
check "S5" "S5 bootstrap BLOCKED exit 13"      "exit=13"            "$(bootstrap_run "$SB")"

# ══════════════════════════ S6 — behind origin ═══════════════════════════════
new_sandbox >/dev/null
SB6="$SB"
advance_origin "$SB6"
check "S6" "S6 classifier: BEHIND"             "BEHIND"             "$(classify "$SB6")"
check "S6" "S6 classifier exit 11 (blocked)"   "11"                 "$(classify_exit "$SB6")"
B6="$(bootstrap_run "$SB6")"
check "S6" "S6 bootstrap proceeds ONLY via guard fast-forward (controlled update)" "exit=0" "$B6"
check_contains "S6" "S6 guard fast-forwarded" "FAST-FORWARDED" "$(bootstrap_out)"
check_contains "S6" "S6 bootstrap EXACT_MATCH after FF" "EXACT_MATCH" "$(bootstrap_out)"

# ══════════════════════════ S7 — diverged ════════════════════════════════════
new_sandbox >/dev/null
SB7="$SB"
commit_source "$SB7"          # local side has its own commit
advance_origin "$SB7"         # AND origin advanced on a different line
check "S7" "S7 classifier: DIVERGED"           "DIVERGED"           "$(classify "$SB7")"
check "S7" "S7 classifier exit 12 (blocked)"   "12"                 "$(classify_exit "$SB7")"
check "S7" "S7 bootstrap blocked (guard exit 1 on unique content)" "exit=1" "$(bootstrap_run "$SB7")"

# ══════════════════════════ S8 — remote unavailable ══════════════════════════
new_sandbox >/dev/null
SB8="$SB"
git -C "$SB8" remote set-url origin "$WORK/nonexistent/MITHQALMTQ/MTQ_SIGMA.git"
check "S8" "S8 classifier: REMOTE_UNAVAILABLE" "REMOTE_UNAVAILABLE" "$(classify "$SB8")"
check "S8" "S8 classifier exit 13 (blocked)"   "13"                 "$(classify_exit "$SB8")"
check "S8" "S8 bootstrap fetch failure blocks (exit 12)" "exit=12"  "$(bootstrap_run "$SB8")"

# ══════════════════════════ S9 — invalid content hash ════════════════════════
new_sandbox >/dev/null
SB9="$SB"
commit_valid_publication "$SB9" 19060 4100
python3 - "$SB9" <<'PYEOF'
import json, sys
p = sys.argv[1] + "/backups/db-snapshots/manifest.json"
m = json.load(open(p))
m["chain"]["sha256"] = "0" * 64  # tampered hash
open(p, "w").write(json.dumps(m, indent=2) + "\n")
PYEOF
git -C "$SB9" add backups/db-snapshots/manifest.json
git -C "$SB9" commit -qm "tamper: manifest hash no longer matches the payload"
check "S9" "S9 classifier: SNAPSHOT_INVALID"   "SNAPSHOT_INVALID"   "$(classify "$SB9")"
check "S9" "S9 classifier exit 14 (blocked)"   "14"                 "$(classify_exit "$SB9")"
check "S9" "S9 bootstrap BLOCKED exit 13"      "exit=13"            "$(bootstrap_run "$SB9")"

# ══════════════════════════ S10 — missing manifest (legacy sweep geometry) ═══
new_sandbox >/dev/null
SB10="$SB"
commit_platform_sweep "$SB10" 19060
check "S10" "S10 classifier: SNAPSHOT_INVALID (manifest missing)" "SNAPSHOT_INVALID" "$(classify "$SB10")"
check "S10" "S10 bootstrap BLOCKED exit 13"    "exit=13"            "$(bootstrap_run "$SB10")"
check_contains "S10" "S10 bootstrap names missing manifest" "SNAPSHOT_INVALID" "$(bootstrap_out)"

# ══════════════════════════ S11 — snapshot lacks genesis ═════════════════════
new_sandbox >/dev/null
SB11="$SB"
make_chain_dump "$SB11/backups/db-snapshots/latest-chain.sql" 19060 no_genesis
make_custom_dump "$SB11/backups/db-snapshots/latest-custom.sql" 4100
make_manifest "$SB11/backups/db-snapshots/latest-chain.sql" "$SB11/backups/db-snapshots/latest-custom.sql" "$SB11/backups/db-snapshots/manifest.json" 2
git -C "$SB11" add backups/db-snapshots
git -C "$SB11" commit -qm "publication without genesis in payload"
check "S11" "S11 classifier: SNAPSHOT_INVALID (no genesis)" "SNAPSHOT_INVALID" "$(classify "$SB11")"
check "S11" "S11 bootstrap BLOCKED exit 13"   "exit=13"            "$(bootstrap_run "$SB11")"

# ══════════════════════════ S12 — chain height regresses ═════════════════════
new_sandbox >/dev/null
SB12="$SB"
commit_valid_publication "$SB12" 18900 4100   # BELOW origin's h19000
check "S12" "S12 classifier: SNAPSHOT_INVALID (height regression)" "SNAPSHOT_INVALID" "$(classify "$SB12")"
check "S12" "S12 bootstrap BLOCKED exit 13"   "exit=13"            "$(bootstrap_run "$SB12")"

# ══════════════════════════ S13 — partial/interrupted dump ═══════════════════
new_sandbox >/dev/null
SB13="$SB"
make_chain_dump "$SB13/backups/db-snapshots/latest-chain.sql" 19060 "" torn
make_custom_dump "$SB13/backups/db-snapshots/latest-custom.sql" 4100
make_manifest "$SB13/backups/db-snapshots/latest-chain.sql" "$SB13/backups/db-snapshots/latest-custom.sql" "$SB13/backups/db-snapshots/manifest.json" 2
git -C "$SB13" add backups/db-snapshots
git -C "$SB13" commit -qm "publication with torn dump"
check "S13" "S13 classifier: SNAPSHOT_INVALID (partial dump)" "SNAPSHOT_INVALID" "$(classify "$SB13")"
check "S13" "S13 bootstrap BLOCKED exit 13"   "exit=13"            "$(bootstrap_run "$SB13")"

# ══════════════════════════ S14 — recovery authority missing ═════════════════
new_sandbox >/dev/null
SB14="$SB"
git -C "$SB14" rm -q scripts/db-selfheal.ts
git -C "$SB14" commit -qm "remove recovery CLI from BASE (pushed to origin too)"
git -C "$SB14" push -q origin main
commit_valid_publication "$SB14" 19060 4100
check "S14" "S14 classifier: AUTHORITY_UNVERIFIED (heal CLI absent)" "AUTHORITY_UNVERIFIED" "$(classify "$SB14")"
check "S14" "S14 classifier exit 15 (blocked)" "15"                 "$(classify_exit "$SB14")"
check "S14" "S14 bootstrap BLOCKED exit 13"    "exit=13"            "$(bootstrap_run "$SB14")"

# ══════════════════════════ S15 — manifest progression across range ══════════
new_sandbox >/dev/null
SB15="$SB"
commit_valid_publication "$SB15" 19060 4100
commit_valid_publication "$SB15" 19120 4150
V15="$(cd "$SB15" && git show HEAD:backups/db-snapshots/manifest.json | python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])')"
check "S15" "S15 manifest version progressed to 3" "3" "$V15"
check "S15" "S15 classifier: SAFE"               "SAFE_SNAPSHOT_AHEAD" "$(classify "$SB15")"
check "S15" "S15 bootstrap exit 0"               "exit=0"             "$(bootstrap_run "$SB15")"

# ══════════════════════════ S16 — one invalid among valid ════════════════════
new_sandbox >/dev/null
SB16="$SB"
commit_valid_publication "$SB16" 19060 4100
commit_valid_publication "$SB16" 19120 4150
commit_valid_publication "$SB16" 19080 4200   # REGRESSION vs 19120 in the range
commit_valid_publication "$SB16" 19180 4250
check "S16" "S16 classifier: SNAPSHOT_INVALID (one bad commit among valid)" "SNAPSHOT_INVALID" "$(classify "$SB16")"
check "S16" "S16 bootstrap BLOCKED exit 13"   "exit=13"            "$(bootstrap_run "$SB16")"

# ══════════════════════════ S17 — remote moves during validation ═════════════
new_sandbox >/dev/null
SB17="$SB"
commit_valid_publication "$SB17" 19060 4100
advance_origin "$SB17"
check "S17" "S17 classifier (fresh fetch): DIVERGED — stale acceptance impossible" "DIVERGED" "$(classify "$SB17")"
B17="$(bootstrap_run "$SB17")"
check "S17" "S17 bootstrap never accepts stale: controlled realign-under-proof or block" "exit=0" "$B17"
check_contains "S17" "S17 guard archived + realigned (subsumption-proven, never a blind accept)" "REALIGNED" "$(bootstrap_out)"
check_contains "S17" "S17 post-realign state is EXACT_MATCH" "EXACT_MATCH" "$(bootstrap_out)"

# ══════════════════════════ S18 — new snapshot lands mid-flow ════════════════
new_sandbox >/dev/null
SB18="$SB"
commit_valid_publication "$SB18" 19060 4100   # unpushed valid publication
mkdir -p "$SB18/backups/db-snapshots/.staging"
make_chain_dump "$SB18/backups/db-snapshots/.staging/latest-chain.sql" 19120
make_custom_dump "$SB18/backups/db-snapshots/.staging/latest-custom.sql" 4150
P18="$(cd "$SB18" && MTQ_SIGMA_ROOT="$SB18" bun run scripts/snapshot-publish.ts 2>/dev/null | tail -1)"
check_contains "S18" "S18 threshold-less publisher publishes the staged dump" '"published":true' "$P18"
rewind_origin   # simulate push failure: both publications remain unpushed
check "S18" "S18 classifier after second publication: SAFE (2 ahead)" "SAFE_SNAPSHOT_AHEAD" "$(classify "$SB18")"
check "S18" "S18 bootstrap exit 0"              "exit=0"             "$(bootstrap_run "$SB18")"

# ══════════════════════════ S19 — scheduler overlap (lock held) ══════════════
new_sandbox >/dev/null
SB19="$SB"
LOCK19="$WORK/lock19"
( flock -n 9 && sleep 45 ) 9>"$LOCK19" &
LOCK19_PID=$!
# wait until the holder actually HOLDS the lock (probe must FAIL to acquire)
for _ in $(seq 1 100); do
  if bash -c 'exec 9>"'"$LOCK19"'"; flock -n 9' 2>/dev/null; then sleep 0.1; else break; fi
done
W19="$(cd "$SB19" && MTQ_SIGMA_ROOT="$SB19" PLANE5_LOCK_FILE="$LOCK19" PATH="$STUBS:$PATH" \
        bash scripts/plane5-run.sh backstop --job-id manual 2>&1 | tail -1; echo "rc=$?")"
check_contains "S19" "S19 wrapper stands down with OVERLAP_SKIP" "OVERLAP_SKIP" "$W19"
kill "$LOCK19_PID" 2>/dev/null || true
L19="$(tail -1 "$SB19/backups/plane5/execution-ledger.jsonl" 2>/dev/null | python3 -c 'import json,sys; print(json.load(sys.stdin).get("outcome","none"))' 2>/dev/null || echo empty)"
check "S19" "S19 durable ledger untouched by the stood-down fire" "empty" "$L19"

# ══════════════════════════ S20 — recovery explicitly blocked (sentinel) ═════
new_sandbox >/dev/null
SB20="$SB"
commit_valid_publication "$SB20" 19060 4100
python3 - "$SB20" <<'PYEOF'
import sys, time
open(sys.argv[1] + "/db/ALLOW-GENESIS-RESET", "w").write(f"{int((time.time()+3600)*1000)}\nintentional reset fixture\n")
PYEOF
check "S20" "S20 classifier: AUTHORITY_UNVERIFIED (reset sentinel)" "AUTHORITY_UNVERIFIED" "$(classify "$SB20")"
check "S20" "S20 bootstrap BLOCKED exit 13"    "exit=13"            "$(bootstrap_run "$SB20")"

# ══════════════ P1 — Phase 7: the original incident-19 scenario (positive) ═══
new_sandbox >/dev/null
P1="$SB"
check "P1" "P1 pre-state: EXACT_MATCH (verified clone matching origin)" "EXACT_MATCH" "$(classify "$P1")"
# 2. generate a valid forward-only chain snapshot (the write-behind product)
mkdir -p "$P1/backups/db-snapshots/.staging"
make_chain_dump "$P1/backups/db-snapshots/.staging/latest-chain.sql" 19060
make_custom_dump "$P1/backups/db-snapshots/.staging/latest-custom.sql" 4100
# 3–4. wrapper creates a LOCAL snapshot-only commit and leaves it UNPUSHED
P1_PUB="$(cd "$P1" && MTQ_SIGMA_ROOT="$P1" bun run scripts/snapshot-publish.ts 2>/dev/null | tail -1)"
check_contains "P1" "P1 wrapper publication created a local commit" '"published":true' "$P1_PUB"
rewind_origin   # the publication commit is now UNPUSHED — the incident-19 geometry
# 5–10. run the backstop bootstrap in isolation
check "P1" "P1 bootstrap: SAFE_SNAPSHOT_AHEAD"   "SAFE_SNAPSHOT_AHEAD" "$(classify "$P1")"
B_P1="$(bootstrap_run "$P1")"
check "P1" "P1 bootstrap exit 0 (original failure ELIMINATED)" "exit=0" "$B_P1"
check_contains "P1" "P1 bootstrap reaches snapshot verification stage" "snapshot verified at HEAD" "$(bootstrap_out)"
check_contains "P1" "P1 bootstrap BOOTSTRAP_OK" "BOOTSTRAP_OK" "$(bootstrap_out)"
# 6b. db-root resolution: the wrapper's full six-plane run boots against the
#     SANDBOX root (fixture DBs) — proving canonical root + recovery
#     authorization + DB integrity + the legitimate next stage end-to-end.
W_P1="$(cd "$P1" && MTQ_SIGMA_ROOT="$P1" PLANE5_LOCK_FILE="$WORK/lock-p1" PATH="$STUBS:$PATH" \
        bash scripts/plane5-run.sh backstop --job-id manual 2>&1 | tail -1)"
check_contains "P1" "P1 full backstop: gitState=SAFE_SNAPSHOT_AHEAD" "gitState=SAFE_SNAPSHOT_AHEAD" "$W_P1"
check_contains "P1" "P1 full backstop: result=OK" "result=OK" "$W_P1"
check_contains "P1" "P1 full backstop: db plane HEALTHY (14-state taxonomy; fixture DB integrity)" " db=HEALTHY " "$W_P1"
L_P1="$(tail -1 "$P1/backups/plane5/execution-ledger.jsonl" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("outcome"))')"
check "P1" "P1 ledger: EXECUTED-OK" "EXECUTED-OK" "$L_P1"
HB_P1="$(python3 -c 'import json; print(json.load(open("'"$P1"'/backups/plane5/heartbeat.json")).get("result"))' 2>/dev/null || echo missing)"
check "P1" "P1 heartbeat written with result OK (git plane healthy under SAFE-ahead)" "OK" "$HB_P1"
A_P1="$(cd "$P1" && MTQ_SIGMA_ROOT="$P1" bun run scripts/git-state-classify.ts 2>/dev/null | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["authority"]["selfhealCliPresent"], d["authority"]["resetSentinelActive"], d["manifest"]["chainShaOk"])')"
check "P1" "P1 recovery authorization verified (heal CLI present · sentinel inactive · manifest hash ok)" "True False True" "$A_P1"

# ══════════════ P2 — Phase 7 negative: unpushed source commit must block ════
new_sandbox >/dev/null
P2="$SB"
commit_valid_publication "$P2" 19060 4100
commit_source "$P2"
check "P2" "P2 classifier: SOURCE_CODE_AHEAD"   "SOURCE_CODE_AHEAD"  "$(classify "$P2")"
check "P2" "P2 bootstrap BLOCKED exit 13"       "exit=13"            "$(bootstrap_run "$P2")"
W_P2="$(cd "$P2" && MTQ_SIGMA_ROOT="$P2" PLANE5_LOCK_FILE="$WORK/lock-p2" PATH="$STUBS:$PATH" \
        bash scripts/plane5-run.sh backstop --job-id manual 2>&1 | tail -1)"
check_contains "P2" "P2 wrapper relays BLOCKED bootstrap_exit=13" "BLOCKED bootstrap_exit=13" "$W_P2"
L_P2="$(python3 - "$P2" <<'PYEOF'
import json, sys
last = None
for line in open(sys.argv[1] + "/backups/plane5/execution-ledger.jsonl"):
    try:
        e = json.loads(line)
        if e.get("phase") == "FINAL":
            last = e
    except Exception:
        pass
print(f"{last.get('outcome')} {last.get('gitState')}" if last else "missing")
PYEOF
)"
check "P2" "P2 ledger: BOOTSTRAP-FAILED with gitState=SOURCE_CODE_AHEAD" "BOOTSTRAP-FAILED SOURCE_CODE_AHEAD" "$L_P2"

# ══════════════ R1 — transition repair: platform sweep self-heals ═══════════
new_sandbox >/dev/null
R1="$SB"
commit_platform_sweep "$R1" 19060     # the LITERAL incident-19 geometry (dump-only, no manifest)
check "R1" "R1 pre-repair: SNAPSHOT_INVALID"    "SNAPSHOT_INVALID"   "$(classify "$R1")"
W_R1="$(cd "$R1" && MTQ_SIGMA_ROOT="$R1" PLANE5_LOCK_FILE="$WORK/lock-r1" PATH="$STUBS:$PATH" \
        bash scripts/plane5-run.sh backstop --job-id manual 2>&1 | tail -1)"
# After a repair that PUSHES, the retry bootstrap legitimately classifies
# EXACT_MATCH; with the push held back it would be SAFE_SNAPSHOT_AHEAD. Both
# are proceed states — the assertion is that SNAPSHOT_INVALID is GONE.
R1_STATE="$(printf '%s' "$W_R1" | grep -oE 'gitState=[A-Z_]+' | cut -d= -f2)"
check "R1" "R1 post-repair state is a PROCEED state (EXACT_MATCH or SAFE_SNAPSHOT_AHEAD — never SNAPSHOT_INVALID)" "proceed"   "$(case "$R1_STATE" in EXACT_MATCH|SAFE_SNAPSHOT_AHEAD) echo proceed ;; *) echo blocked:$R1_STATE ;; esac)"
check_contains "R1" "R1 wrapper completed OK after repair" "result=OK" "$W_R1"
L_R1="$(grep -c 'REPAIR-PUBLICATION' "$R1/backups/plane5/execution-ledger.jsonl" 2>/dev/null)"; L_R1="${L_R1:-0}"
check "R1" "R1 ledger records REPAIR-PUBLICATION" "1" "$L_R1"

# ═══════════════════════════════ summary ═════════════════════════════════════
log ""
log "══════════════════════════════════════════════════════════"
log "  PASS=$PASS  FAIL=$FAIL"
[ -n "$FAILED_SCENARIOS" ] && log "  failed scenarios:$FAILED_SCENARIOS"
log "══════════════════════════════════════════════════════════"
if [ "$FAIL" -eq 0 ]; then
  log "ALL SCENARIOS PASS — work dir retained for inspection: $WORK"
  exit 0
else
  log "FAILURES — work dir retained for inspection: $WORK"
  exit 1
fi
