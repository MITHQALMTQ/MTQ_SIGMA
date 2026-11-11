# Boot-Chain Source-Integrity Review — Phase 0 Containment Readiness (Workstream F)

**Document ID:** SEC-P0-BOOT-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T13:35Z (UTC) · **Workstream:** F
**Branch:** security/phase-0-review-prep @ fc9ad97 (docs-only; ancestry unchanged) · **Author role:** implementer AI-agent lineage (evidence preparer — NOT an independent auditor)
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED

> **Standing independence limitation:** prepared inside the assessed environment by the implementer's own agent lineage; all results herein are implementer-side and require independent reproduction per the reviewer handoff package (SEC-P0-HANDOFF-001). No secret value is reproduced anywhere — fingerprints, status codes, counts, and object identifiers only.

---

## 0. Scope, method, and rule compliance

- **Assignment:** COO master directive §7, item F — read-only review of the dev-boot chain's source-integrity semantics. **No boot-chain or recovery-script file was modified, created, or deleted by this assignment** (see §5).
- **Evidence base:** all `file:line` citations for source files refer to the review worktree `/home/z/phase0-review-wt` @ `security/phase-0-review-prep` fc9ad97 (tracked content == authoritative `origin/main` 926ee00 per SEC-P0-DELTA-001 §0). Substituted-lineage facts were inspected read-only via `git -C /home/z/my-project show/ls-tree/log/reflog/rev-parse` (13:21–13:30Z, 2026-11-11). No application code was executed (R6); no network probe was required for this workstream — every claim is repo-local read-only evidence.
- **Evidence labels:** `[VERIFIED-FACT]` = re-verified this session (command and file:line cited); `[HISTORICAL]` = prior recorded evidence (doc + section); `[UNVERIFIED]` = could not be verified from this substrate.
- **Register cross-reference:** extends finding **F-0-P1-02** and corrective-addendum finding **AF-05** (SEC-P0-ADDENDUM-001 §9) — this document never contradicts them; it deepens the component-level analysis and adds the Phase-1 state-machine design.
- **Disclosure registration (briefing R8):** the 2026-11-11 owner-message credential disclosure event (values redacted) has no functional intersection with the boot chain reviewed here (the watchdog unsets AI/API env values at `dev-watchdog.sh:106`; none of the disclosed credential types is boot-chain load-bearing); rotation remains urgently recommended and is tracked by Workstreams A/I.
- Prior frozen evidence relied on: `authoritative-main-delta-assessment.md` (SEC-P0-DELTA-001) §§1/5/6/11; `public-object-exposure-and-review-addendum.md` (SEC-P0-ADDENDUM-001) §9/§10.2; `independent-review-preparation.md` (SEC-P0-IRP-001 v1.1) §evidence-integrity anchors; `worklog.md` (tracked copy @ fc9ad97).

---

## 0.1 Reproduction commands (read-only; reviewer re-run expected)

```
# lineage + suppression sites (all read-only)
git -C /home/z/my-project rev-list --left-right --count d6fd5d6...origin/main   # 2  168
git -C /home/z/my-project merge-base d6fd5d6 origin/main                        # ff67aa2…
git -C /home/z/my-project log --oneline -3 d6fd5d6                              # 9fe4058 / d6fd5d6 subject
git -C /home/z/my-project ls-tree --name-only d6fd5d6 -- scripts/source-integrity-heal.ts scripts/dev-entrypoint.sh scripts/plane5-run.sh   # (all ABSENT)
git -C /home/z/my-project show d6fd5d6:dev-watchdog.sh | rg -n '|| true'        # 135 / 158 / 159 / 180
git -C /home/z/my-project show d6fd5d6:src/instrumentation.ts | rg -c 'source-integrity'   # 0
git -C /home/z/my-project reflog --date=iso | head -25                           # checkout events 00:54–00:57Z
# scheduler evidence (tracked copies at the review worktree)
wc -l      /home/z/phase0-review-wt/backups/plane5/execution-ledger.jsonl         # 58
tail -n 1 /home/z/phase0-review-wt/backups/plane5/execution-ledger.jsonl        # EXECUTED-OK 23:30:29Z
rg -n '522457|522460' /home/z/phase0-review-wt/worklog.md                       # :10670 :10684
```

No live-state, process, network, or git-mutating command was used for this document (R2/R3/R6 compliance). The secret gate is run by the orchestrator after staging; this document contains no 64-hex literal (verified by pattern count 0).

---

## 1. Component-by-component review

### 1.1 `dev-watchdog.sh` — the boot sequence it implements

`[VERIFIED-FACT]` (read of the full 223-line file; sequence order cited):

1. `cd /home/z/my-project` (`:66`) — the watchdog supervises the **substituted-lineage clone**, not the review worktree.
2. Singleton `flock` on `/tmp/mtq-watchdog.lock`, fd 9 (`:77-81`); a refused duplicate exits 0 without touching state.
3. Env load `. .env.local`/`. .env` with `2>/dev/null` (`:85-88`); `unset DATABASE_URL` (`:91`); unset of all AI/FRED API env names (`:106`) — the long-lived-shell stale-secret class fix.
4. `LOG=dev.log`, pid files (`:108-110`); heap cap (`:116`); pid write + banner (`:118-119`).
5. **Detached git-drift supervision subloop**, every 60 s (`:125-130`) — same guard as pre-boot; "Never fatal" (`:121`).
6. **Detached cloud-sync subloop**, every 60 s (`:133-138`) — carries the `|| true` at `:135`.
7. **Main loop** (`:140`): port-health probe `curl /api/health` (`:151`); HTTP 200 → passive supervision (`:152-155`); non-200/non-000 → "reclaim through the full heal chain" with two `pkill … || true` (`:156-161`).
8. **Pre-boot git-drift guard** (`:169`), rc captured (`:170`): rc 42 → "booting the realigned code" (`:171-172`); rc ≠ 0 → *"booting local HEAD; run scripts/session-open-battery.sh to decide"* (`:173-175`) — a BLOCKED verdict is logged, not enforced.
9. **Pre-boot source-integrity heal** (`:180`): `bun run scripts/source-integrity-heal.ts >> "$LOG" 2>&1 || true`.
10. **Runtime dependency preflight** (`:187-197`): fail → one `bun install --frozen-lockfile` repair (`:190-191`) → re-check → still failing → **BLOCKED** (`sleep 60; continue`, `:193-196`).
11. **DB self-heal** (`:204-211`): rc captured (`:206`); rc ≠ 0 → **BLOCKED** (`:207-210`).
12. **`next dev`** starts (`:213-218`); on exit the loop restarts in 2 s (`:219-221`).

The script has **no `set -e`** anywhere (only `set -a`/`set +a` at `:85/:88`) — per-step failure tolerance is structural, and only steps 10–11 close fail-closed.

#### Failure-suppression inventory — every site, with consequence analysis `[VERIFIED-FACT]`

| # | Site | Code | Suppressed failure class | Consequence |
|---|---|---|---|---|
| S1 | `:135` | `bun run scripts/db-cloud-sync.ts >> /tmp/db-cloud-sync.log 2>&1 \|\| true` | write-behind dump refresh crash / any non-zero exit (the script file itself is present at both lineages — verified via `git ls-tree d6fd5d6`; the suppressed class is *runtime* failure, e.g. an unreadable post-re-image database) | Dump staleness grows silently; the *bounded loss window* design goal (comment `:52-56`) is unmet with no signal; on the substituted lineage the in-process cloud-sync twin is also absent (`git show d6fd5d6:src/instrumentation.ts` imports only `ensureChainNode`, `:10-11` — verified) → hours-scale snapshot staleness (the incident-#7 class the loop was built against, `dev-watchdog.sh:52-56`). |
| S2 | `:158` | `pkill -f "node_modules/.bin/next dev" … \|\| true` | no matching process (pkill rc 1) | Benign in isolation; but combined with S3 a *failed reclaim* (server survives the kill) is indistinguishable from success — the next iteration re-probes, so the true effect is deferred detection, not detection loss. |
| S3 | `:159` | `pkill -f "next-server" … \|\| true` | same | Same as S2; a non-200 listener that pkill cannot terminate is retried every loop with only `dev.log` prose as evidence. |
| S4 | `:180` | `bun run scripts/source-integrity-heal.ts >> "$LOG" 2>&1 \|\| true` | **all** non-zero semantics: missing script (realized at the substituted lineage), heal runtime error, exit-1 "restore failed" (`source-integrity-heal.ts:46-50`) | The single most consequential site: the only step whose entire purpose is *source-tree* verification has its failure language erased; boot proceeds unconditionally into a possibly partially-recovered application (AF-05). |
| S5 | `:86-87` | `. .env.local 2>/dev/null` / `. .env 2>/dev/null` | unreadable/absent env files | Downstream steps fail individually (often fail-closed at DB self-heal), so consequence is bounded, but the root cause is masked in logs. |
| S6 | `:151` | `HEALTH_CODE=$(curl … 2>/dev/null)` | curl transport errors | A transient probe error yields code ""/000 → treated as port-free → attempted boot; availability-side, not integrity-side. |
| S7 | `:173-175` | guard rc ≠ 0 → echo "booting local HEAD" | git-drift guard BLOCKED (diverged/unique-content/unverifiable origin) | An *unauthorized source* verdict is converted into a log line; boot continues on it (see Q9). |
| S8 | `:191` | `bun install … \|\| echo "…will retry next loop"` | dependency repair failure | Bounded: the re-check at `:192-196` still blocks. Honest degraded status. |

Sites S1–S4 are the literal `|| true` sites (`:135, :158, :159, :180` — verified by full read; no other `|| true` exists in the file). S5–S8 are soft-suppression sites included for completeness of the inventory.

### 1.2 `scripts/source-integrity-heal.ts` — exit-code semantics `[VERIFIED-FACT]`

- **Modes:** `--allow-deletions "reason" [--hours N]` writes the `db/ALLOW-FILE-DELETIONS` sentinel (default 6 h, max 168 h — `:20-36`, `:29`) and exits 0; sentinel active → "standing down", exit 0 (`:38-42`); default actuator path (`:44-57`).
- **Exit 1 only when** `report.action === "error"` OR (`failed.length > 0 && restored.length === 0`) (`:46-50`) — i.e. *every* restore attempt failed.
- **Invocation-outcome semantics table `[VERIFIED-FACT]`** (CLI `:44-57` + library `:102-147` + watchdog `dev-watchdog.sh:180`):

| Tree state encountered | `report.action` | CLI exit | Watchdog effect (`:180`) |
|---|---|---|---|
| no unstaged deletions | `none` | 0 | proceed (correct) |
| deletions, all restored | `restored` | 0 | proceed (correct) |
| deletions, some restored + some failed | `partial` | **0** | proceed — **partial masked as success** |
| deletions, all restores failed | `error` | 1 | proceed — `|| true` erases the only failure signal |
| sentinel active | `sentinel` | 0 | deletions are KEPT silently for up to 168 h |
| heal script itself absent (the substituted lineage) | — | non-zero (module-not-found) | proceed — realized at d6fd5d6 (§4) |
| `--allow-deletions` invocation | — | 0 | guard stands down ≤ 168 h by operator (or any process's) choice |

- **PARTIAL → exit 0 (verified):** when some files restored and some failed, the `:51-53` branch prints the restored count and `:57` executes `process.exit(0)`. The failed list appears only as prose lines; no exit-code or JSON artifact distinguishes partial from clean success.
- **What it restores:** unstaged worktree deletions of HEAD-tracked files, byte-exact, via `git restore` **from the local HEAD commit** (`src/lib/boot/source-integrity.ts:109-137`; header `source-integrity-heal.ts:8-9`). The restoration source is the local git object DB, not `origin/main`, not any external manifest.
- **Manifest/hash verification of the result: none.** No manifest covers the heal result; the "verification" is only git's implicit object integrity during `git restore`. The report object (`SourceIntegrityReport`, `source-integrity.ts:102-107`) is printed only in the failure branch (`:47-48`) and is never persisted to a machine-readable location.
- **Authorization concept: none.** Any process able to run `bun` in the repo can invoke the heal, or write the stand-down sentinel (`source-integrity-heal.ts:11-14`; `source-integrity.ts:123-129`) — the sentinel is a gitignored file whose only content is an expiry epoch and a free-text reason (`:58-62`).

### 1.3 `src/lib/boot/source-integrity.ts` — the integrity model `[VERIFIED-FACT]`

The model is **"unstaged-deletion-of-HEAD-tracked-file"** and nothing broader:

- Detection = `git status --porcelain -z --no-renames`, signature `X=' ' AND Y='D'` (`:76-98`) — only *unstaged worktree deletions* of files HEAD tracks.
- **Out of scope by construction:** staged deletions (`git rm` — "explicit intent", `:73-74`), committed deletions (`:16`), *modifications* (a tampered-but-present file is invisible), untracked-file injection (added files are invisible), and any non-git working state.
- No content hashing, no origin-side comparison, no coverage of `node_modules` or generated runtime layer.
- No `.git` → guard inactive, reported as a note (`:77`, `:118-121`) — "production/standalone boot; guard inactive" (a deleted `.git` silently disables the model).
- Sentinel `db/ALLOW-FILE-DELETIONS` (line 1 expiry epoch-ms, line 2 reason, `:17-19`, `:42-56`) stands the guard down for up to 168 h (`:58-62`).
- Action taxonomy `none | restored | partial | error` (`:102-107`); `partial` = `failed>0 && restored>0` (`:146-147`).

### 1.4 `scripts/git-drift-guard.ts` — what it guards, when, what it blocks `[VERIFIED-FACT]`

- **Guards:** local HEAD vs `origin/main` branch geometry. Classifies and heals: behind+clean → `merge --ff-only` (exit 42); diverged **with proven content-subsumption** → archive + `reset --hard origin/main` (exit 42); synced/ahead-only → no-op (exit 0); unique local content / dirty tree → **BLOCKED**, exit 1 (header `:8-16`; switch `:132-140`). The live databases (gitignored) are never touched (`:15`).
- **Exit-code fan-out across the four invocation sites `[VERIFIED-FACT]`:**

| Guard verdict | Exit | Watchdog pre-boot (`dev-watchdog.sh:169-175`) | In-process (`src/instrumentation.ts:51-76`, `:96-103`) | Backstop (`scripts/plane5-run.sh:425-441`) |
|---|---|---|---|---|
| synced / ahead-only | 0 | proceed | chain node boots | plane OK |
| fast-forwarded / realigned | 42 | "booting the realigned code"; guard itself kills :3000 when the watchdog is alive (`git-drift-guard.ts:82-129`) → full-chain reboot | hot-reload picks up swapped sources; clean restart advised (`:193-201`) | re-bootstrap then continue |
| BLOCKED | 1 | **"booting local HEAD" — advisory only** | chain node + DB self-heal stand down; web app keeps serving | **hard BLOCKED, exit 1, no remediation** |

- **When it runs relative to boot:** pre-boot in the watchdog (`dev-watchdog.sh:169`); in the 60 s drift-supervision subloop (`:125-130`); in-process at server boot + every 60 s (`src/instrumentation.ts:53-76`, `:193-223`); in the plane-5 wrapper plane 1 (`scripts/plane5-run.sh:425-441`); in the session-open battery (header `:5`). On a realign it kills :3000 only when the watchdog is alive (`:82-129`) so the main loop reboots through the full chain.
- **What it blocks:** only *itself* — exit 1 is advisory to the watchdog, which responds "booting local HEAD" (`dev-watchdog.sh:173-175`). A `--allow-drift` sentinel (`db/ALLOW-GIT-REALIGN`, ≤168 h, `:23-26`, `:39-55`) stands the guard down entirely.
- **`--status` mode:** classification-only, always exit 0 (`:18-21`, `:57-73`) — the operator adjudication instrument actually used against the substituted lineage (worklog.md:10667 `[HISTORICAL]`).

### 1.5 `scripts/runtime-preflight.ts` — what the checks prove and do not prove `[VERIFIED-FACT]`

Four checks only: (1) installed `next` version satisfies `package.json` declared range at major.minor granularity (`:53-68`); (2) `@next/swc` platform binary equals the *installed* next version (`:70-90`); (3) the vendored meriyah file inside `@sentry/server-utils` exists (`:92-111`); (4) `node_modules/.bin/next` exists (`:113-116`). Prisma client state is informational-only, never blocking (`:118-121`). Exit codes: 0 consistent / 3 mismatch (`:19`, `:129-135`).

- **Proves:** the runtime layer can be expected to *load* — the Incident-22 crash class (stale swc/meriyah under a realigned tree) is covered.
- **Does NOT prove:** application-source completeness or authenticity (no `src/` path is touched), lockfile-level integrity of any package other than the four probed artifacts, DB state, secret state, or the *lineage* of the code about to be compiled. It is a necessary runtime gate, not a source-integrity gate — and in the watchdog chain it runs **after** the suppressed heal (`:188`), so it cannot compensate for it.

### 1.6 `scripts/db-selfheal.ts` — DB-level self-heal semantics and masking `[VERIFIED-FACT]`

- Central decision from `src/lib/boot/recovery-authorization.ts` + staged-generation restore from `src/lib/boot/generation-store.ts` (`:9-10`); the restore pipeline is reconcile → probe → authorize → prepare → validate → activate (`src/lib/db-ops.ts:386-403`, `:441-560`; `generation-store.ts:24-31`).
- **Exit contract (fail-closed where it counts):** 0 = ok / no restore needed / fresh environment / sentinel; 1 = authorized restore FAILED (torn state); 2 = recovery REFUSED (`:11-18`, `:52-62`). The watchdog honors it: rc ≠ 0 → boot BLOCKED (`dev-watchdog.sh:207-211`).
- `--allow-reset` sentinel `db/ALLOW-GENESIS-RESET` (≤168 h, `:20-25`, `:31-47`) stands the whole layer down.
- **Refusal taxonomy `[VERIFIED-FACT]`** — the 15 fail-closed refusal constants (`recovery-authorization.ts:52-67`): SENTINEL_ACTIVE, REPOSITORY_IDENTITY_UNVERIFIED, RUNTIME_SOURCE_UNVERIFIED, LIVE_DB_UNREADABLE/BUSY/INTEGRITY_FAILURE/IDENTITY_MISMATCH/SCHEMA_UNSUPPORTED, PUBLISHED_SOURCE_MANIFEST_MISSING/INVALID/UNUSABLE, STAGED_SOURCE_UNUSABLE, NO_VERIFIED_RECOVERY_SOURCE, NO_RESTORE_NEEDED, CUSTOM_LIVE_MATERIALLY_AHEAD — each with an immutable, centrally-enforced verdict (`:117-121`, "refusal is terminal, never re-derived"). The refusal reasons make the DB layer the best-instrumented plane of the chain — which sharpens the contrast with the source plane (no taxonomy, no exit contract, no consumer).
- **What it can mask:** the decision inputs include a *git-state precondition* (`recovery-authorization.ts:154-159` — EXACT_MATCH / SAFE_SNAPSHOT_AHEAD required; `src/lib/db-ops.ts:485-498`) — but that precondition is evaluated **at heal time only**, and an exit-0 "OK — live databases at/ahead of every verified recovery source" (`db-selfheal.ts:66`) says **nothing about the source tree that will serve that data**. A completely healthy DB pair boots happily under a partially-restored or substituted source tree (Q5). The DB layer also writes provenance evidence (meta `boot_mode`/`selfheal_at`, journal, pointer — `plane5-backstop-heartbeat.ts:58-74`) that is *about the database only* — creating a "verified-looking" runtime posture orthogonal to source integrity.

### 1.7 Recovery authorization and generation-store activation — provenance analysis `[VERIFIED-FACT]`

- `authorizeRecovery` is genuinely fail-closed on source identity: repository identity (`recovery-authorization.ts:147-152`), runtime source state (`:154-159`, git classification a necessary-not-sufficient precondition), manifest gate for the published layer (`:195-227` — MANIFEST_MISSING/INVALID → refused; `validateManifestAgainst` re-hashes payloads), forward-only direction (`:284-307`), cross-DB generation consistency (`:309-316`), genesis identity (`:318-324`). Refusal is terminal (`:37`, `:117-121`).
- **The provenance gap (Q8):** the *activated* generation's durable record does **not** bind to the source tree or to content hashes: `GenerationManifest.source` is written with `chainSha256: null, customSha256: null` (`generation-store.ts:335-353`, esp. `:341-342` — the interface *declares* hash fields at `:66-71` but the writer never fills them); the active-generation pointer records only `generationId / activatedAt / chainTip / customRows / sourceOrigin` (`:83-89`, written `:444-450`) — **no git HEAD, no commit id, no dump hash**. The staged-source path validates *structure only* (tip parse / completeness / genesis — `:233-264`, `recovery-authorization.ts:232-264`) and is explicitly usable "with an unverifiable published layer" (`recovery-authorization.ts:254-255`). Provenance is therefore *advisory metadata* (origin label + journal prose), not a verified binding: an activated generation cannot be re-verified after the fact against the tree that authorized it.
- `detectForeignWrite` (`generation-store.ts:547-565`) detects live-behind-generation *after the fact* — evidence-only, does not block.

### 1.8 Scheduler backstop and monitor logic — and where the heal result is (not) consumed `[VERIFIED-FACT]`

- **Monitor (`scripts/plane5-run.sh monitor`, `:266-413`):** reads the freshest heartbeat (`:268-270`), classifies OK only when age < 9000 s, not overdue, and heartbeat `result == "OK"` (`:272-297`); independently probes the DB plane via `scripts/plane5-db-verify.ts` (fail-closed to DATABASE_UNREADABLE when unparseable, `:314-326`) and infra planes (server `:327`, watchdog `:328`, upload-route 403 `:329-333`); forces alerting whenever the DB severity is not ok, infra ≠ none, or bootstrap degraded (`:335-348`). It observes and alerts; it never remediates (`:264`, `:305-313`). Durable writes (alerts.log, monitor-state.json, commits) happen **only** when bootstrap is OK (`:362-372`, `:401-408`).
- **Backstop (`:416-627`):** plane-1 drift guard — guard exit 1 → hard BLOCKED, exit 1, no remediation (`:425-441`); plane-2 DB verify (fail-closed `:452-461`); plane-2b validated snapshot publication (`:480-492`); plane-3 server/watchdog relaunch remediation (`:498-505`); plane-4 upload-route presence check with an origin-sourced worktree restore (`:510-515`); plane-6 heartbeat writer (`:521-560`); evidence commits with no-commit-while-unsynced rule (`:575-609`).
- **Heartbeat writer (`scripts/plane5-backstop-heartbeat.ts`):** result OK requires git OK **and** db OK **and** server 200 **and** route 403 **and** watchdog alive **and** snapshotParseOk **and** unbackedAhead ≤ 2000 (`:145-148`); the git plane uses the shared classification (EXACT_MATCH / SAFE_SNAPSHOT_AHEAD only, `:91-99`); writes `/tmp/plane5-heartbeat.json` always and the durable copy only when git is OK (`:165-166`). Durable evidence: heartbeat.json, monitor-state.json, alerts.log, execution-ledger.jsonl (58 entries in the tracked copy; last FINAL `2026-11-10T23:30:29.530Z EXECUTED-OK`, heartbeat `23:31:59.705Z OK h23846 / 129,692 rows / deficit 0` — `backups/plane5/*`, `wc -l`/`awk NR` = 58) `[VERIFIED-FACT]`.
- **`monitor-state.json` consumers:** written by the monitor (`plane5-run.sh:368-380`); its `missingSinceMs` baseline semantics are consumed by the legacy scheduled monitor payload (`audit-work/v26-task61b-cont/evidence/plane5-heartbeat-monitor-payload.txt` `[HISTORICAL]`); it is on the approved-evidence path list (`src/lib/boot/git-state.ts:100-107`); **no application code reads it** (repo grep: only `plane5-run.sh`, tests, and audit-work references).
- **Bootstrap gate (`scripts/plane5-bootstrap.sh`):** remote authenticity exit 11 (`:52-56`), fetch exit 12 (`:58-61`), guard materialized-if-absent from origin (`:65-112`), guard run with exit-1 → exit 1 (`:114-123`), shared 8-state classification admitting only EXACT_MATCH / SAFE_SNAPSHOT_AHEAD, else exit 13 (`:125-153`), **prerequisite check that `scripts/source-integrity-heal.ts` exists → exit 14** (`:155-163`), HEAD snapshot manifest sha256 re-verification → exit 15 (`:165-196`), runtime preflight → exit 16 (`:198-215`), then BOOTSTRAP_OK with the documented chain order (`:217-218`).
- **Is the heal result machine-readable anywhere? NO.** The heal's exit code is discarded at `dev-watchdog.sh:180`; its JSON report is emitted only on the failure branch to stdout (`source-integrity-heal.ts:47-48`) which lands in `dev.log`; the in-process twin logs only (`src/instrumentation.ts:82-91`, `:180-186`); the heartbeat fields (`plane5-backstop-heartbeat.ts:160-164`), monitor-state fields (`plane5-run.sh:368`), ledger fields (`:410`, `:620-624`), and bootstrap gates (`plane5-bootstrap.sh` §3.5–§3.11) contain **no heal/source-integrity field**. Detection is human-only via `dev.log` — exactly as AF-05 states (SEC-P0-ADDENDUM-001 §9) `[HISTORICAL]`.
- **Scheduler registrations:** job IDs documented at `plane5-run.sh:37-41` (monitor 516198 / backstop 516197, "re-verify the registry whenever plane-5 jobs are recreated"); worklog.md:10483 (backstop recreated phase-shifted as **514615**; collision root cause), :10656 (re-registration as 519580/519582 after first registry wipe) `[HISTORICAL]`; current registry per worklog.md:10670/:10684: **monitor 522457 (hourly :55:45Z) + backstop 522460 (hourly :17:48Z)** `[HISTORICAL]`. No backup manifest references these IDs (grep of `backups/` — no matches) `[VERIFIED-FACT]`. Post-re-image live registry state is `[UNVERIFIED]` (platform-side).

---

### 1.9 Coverage matrix — what each link of the chain actually verifies

`[VERIFIED-FACT]` (synthesized from §1.1–§1.8; every cell derivable from the cited lines):

| Chain link | Verifies | Does NOT verify | Failure visible to monitoring? |
|---|---|---|---|
| git-drift guard (`dev-watchdog.sh:169`) | HEAD-vs-origin geometry; unique-content detection | worktree content at compile time; unstaged deletions; modifications; `.git`-absent case | Indirectly (bootstrap exit 13 / ledger BLOCKED) — never in the heartbeat when the server is up |
| source-integrity heal (`dev-watchdog.sh:180`) | unstaged deletions of HEAD-tracked files | modifications; staged/committed deletions; added files; *its own outcome* | **NO — exit code discarded, report is dev.log prose (Q3)** |
| runtime preflight (`dev-watchdog.sh:188`) | 4 node_modules artifacts match manifest | any `src/` path; lockfile integrity beyond probes; source lineage | Yes (blocked status; heartbeat server plane degrades) |
| db-selfheal (`dev-watchdog.sh:206`) | live DB vs manifest-verified dumps, forward-only | source tree; runtime; anything outside db/*.db | Yes (rc 1/2 → blocked; 14-state db plane) |
| `next dev` (`dev-watchdog.sh:215`) | nothing — it is the consumer of all prior verdicts | — | HTTP 200 only (availability, not integrity) |
| heartbeat (`plane5-backstop-heartbeat.ts:145-148`) | composite of the above planes | heal result; every file except the single upload route | It IS the monitor input — hence the blindness propagates (Q6) |

The structural conclusion: **source integrity is the only chain link with no machine consumer** — every other link either blocks boot or feeds a monitored plane. This is the precise asymmetry AF-05 names and §3's HEAL VERIFICATION / artifact states are designed to remove.

---

## 2. The ten mandatory questions

**(1) Can the watchdog boot after source integrity fails? — YES `[VERIFIED-FACT]`.**
Evidence: `dev-watchdog.sh:180` (`|| true`) erases every non-zero semantics of the heal, including exit 1 (`source-integrity-heal.ts:46-50`); the in-process twin catches its own guard failure and continues ("app continues", `src/instrumentation.ts:88-91`). Contrast: runtime-preflight (`:187-196`) and db-selfheal (`:204-211`) DO block.
*Consequence:* the only stage whose subject is the *application source* is the only always-advisory stage. A re-imaged tree with a missing heal script, a heal that errors, or a heal that restores 0-of-N files produces an identical subsequent chain: preflight (runtime-only), DB self-heal (data-only), `next dev`. The system can spend its whole "verified" posture — healthy DB, matched runtime, HTTP 200 — on an incomplete source tree, and the sole detection channel is a human reading `dev.log`.

**(2) Can partial restoration return success? — YES `[VERIFIED-FACT]`.**
Evidence: exit 1 requires `failed>0 && restored==0` (`source-integrity-heal.ts:46-50`); with `restored>0 && failed>0` the CLI prints the restored list and executes `process.exit(0)` (`:51-57`); the library labels this `action:"partial"` (`source-integrity.ts:146-147`) but that label is never an exit code.
*Consequence:* even a hypothetical rc check downstream would green-light a tree where some routes were resurrected and others remain deleted. The partial state is the *most dangerous* state (mixed old/new code, compile-time-dependent behavior per route), and it is precisely the one indistinguishable from success. Sixty-second in-process sweeps (`instrumentation.ts:177-189`) may eventually retry, but each retry's partial outcome is again exit-0-shaped and only prose-logged.

**(3) Is the restoration result machine-readable? — NO `[VERIFIED-FACT]`.**
Evidence: §1.8 — the heal report is stdout-into-`dev.log` prose (JSON only in the failure branch, `source-integrity-heal.ts:47-48`); the rc is discarded at `dev-watchdog.sh:180`; no heartbeat/monitor-state/ledger/bootstrap field carries it; no code consumes it (repo grep, §1.8).
*Consequence:* the scheduler monitor, the backstop, the platform, and any future external monitor are structurally blind to source-integrity outcomes. Monitoring integrity is currently *inferred* proxies only: git classification (branch geometry — blind to unstaged deletions of *any* file except via the heal itself), the single upload-route HTTP 403 probe (`plane5-run.sh:329-333`, `plane5-backstop-heartbeat.ts:77`), and server-200. A failed heal of any file other than that one route can coexist with result OK for as long as those proxies hold.

**(4) Can another process change the repository between guard and boot? — YES `[VERIFIED-FACT]`.**
Evidence: nothing serializes the `:169`→`:215` sequence: the singleton flock excludes only other watchdogs (`:77-81`); the drift-supervision subloop (`:125-130`) and cloud-sync subloop (`:133-138`) run concurrently in the same shell; the *in-process* 60 s tick of a still-running server runs the drift guard and can realign HEAD mid-window (`src/instrumentation.ts:190-223`); the backstop materializes untracked guard/classifier files into the worktree (`plane5-bootstrap.sh:65-112`) and can `git checkout origin/main -- <route>` (`plane5-run.sh:514`); the drift guard itself realigns and kills :3000 (`git-drift-guard.ts:82-129`); and platform automation demonstrably performs forced checkouts — reflog 2026-11-11 00:54:06/00:54:11/00:55:55/00:56:12/00:57:09/00:57:23 `checkout: moving from … to …` events, including a recorded "concurrent platform automation forced git checkout main TWICE during evidence preservation" commit note (`git -C /home/z/my-project reflog --date=iso | head -25`, 13:2xZ read-only) `[VERIFIED-FACT]`.
*Consequence:* the guard verdict at `:169-175` describes a tree state that may no longer hold when `next dev` compiles at `:215`. There is no re-check at the commit point, no digest of the tree captured with the verdict, and no overlap state. Every boot is therefore *at best* a TOCTOU-windowed authorization; the state machine in §3 (OVERLAP — BLOCKED) is designed precisely against this.

**(5) Can the database be healthy while the application source is incomplete? — YES `[VERIFIED-FACT]` (semantics) + `[HISTORICAL]` (realized).**
Evidence: `db-selfheal.ts` exit-0 family — ok / no restore needed / fresh / sentinel (`:11-18`, `:63-68`) — is a statement exclusively about `db/chain.db`/`db/custom.db` vs the dump layer; runtime preflight inspects four node_modules artifacts only (`runtime-preflight.ts:53-121`); the source gate is the suppressed heal (§1). Realized form: the substituted lineage d6fd5d6 lacks 4 API routes vs authoritative (SEC-P0-DELTA-001 §2) while its ledger shows the monitor pipeline functioning (`git show d6fd5d6:backups/plane5/execution-ledger.jsonl` — one BOOTSTRAP-FAILED entry) `[VERIFIED-FACT]`.
*Consequence:* "DB healthy" is the system's most trusted signal (it gates boot fail-closed), yet it is orthogonal to source completeness. An operator or monitor pattern-matching on DB health, heartbeat OK, and server 200 — the entire machine plane — receives zero bits of information about source integrity.

**(6) Can the monitor report healthy while source integrity has failed? — YES (within its probe coverage) `[VERIFIED-FACT]`.**
Evidence: heartbeat OK condition (`plane5-backstop-heartbeat.ts:145-148`) = git classification OK ∧ DB OK ∧ server 200 ∧ route 403 ∧ watchdog ∧ snapshotParseOk ∧ bounded lag — no source-integrity input; `classifyGitState` evaluates commit geometry and HEAD-blob authority only (`src/lib/boot/git-state.ts:240-314` — it never inspects the working tree, so EXACT_MATCH holds even while HEAD-tracked files sit deleted-unstaged); the git-drift *guard* does react to dirt (its dirty-tree BLOCKED, realized verbatim in the substituted ledger's bootstrapTail "tracked working tree is dirty — commit/stash first") and feeds bootstrap exit 1 → monitor hard BLOCKED (`plane5-run.sh:249-256`) — but that alert speaks of *dirtiness*, not of which file is missing nor whether the heal failed, and an unstaged deletion the heal silently restores never surfaces at all. The monitor's only file-existence probe is the upload route (`plane5-run.sh:329-333`, `:510-515`).
*Consequence:* for any file other than `src/app/api/constituency/upload/route.ts`, a source-integrity failure (or its silent partial heal) is invisible to the monitor. The monitor is honest about what it measures — but what it measures was never a source-integrity contract, and the heal result it would need is not machine-readable (Q3).

**(7) Can platform re-image restore an obsolete lineage? — YES, historically realized `[HISTORICAL]` + fresh reflog `[VERIFIED-FACT]`.**
Evidence: worklog.md:10666 — "platform base-image refreshes (~16:2xZ and 21:23Z) re-froze the repo to a stale Nov-7 base + a 2-commit local line (guard BLOCKED at the 16:56Z monitor fire)"; SEC-P0-DELTA-001 §1 (d6fd5d6 = 2 substituted-only commits, 2 ahead/168 behind, merge-base ff67aa2 — re-verified: `git rev-list --left-right --count d6fd5d6...origin/main` = `2 168`, `git merge-base` = ff67aa2…) `[VERIFIED-FACT]`; reflog shows main moving to d6fd5d6 on 2026-11-10 16:56:54Z ("commit: c8cbcc8c-…-cron") and checkouts back onto it on 2026-11-11 00:54–00:57Z `[VERIFIED-FACT]`; the substituted ledger's single entry records BOOTSTRAP-FAILED at 16:56:44Z with "guard exit 1 — BLOCKED: genuine unique local content. NO realign." (`git show d6fd5d6:backups/plane5/execution-ledger.jsonl`) `[VERIFIED-FACT]`.
*Consequence:* the platform's re-image writer is a *third* repository actor the boot chain does not serialize (Q4). If the watchdog were started on the substituted tree, its chain would run: guard → "booting local HEAD" (`:173-175`) → heal script absent (ls-tree at d6fd5d6: `scripts/source-integrity-heal.ts` NOT present) masked by `|| true` (`:180` — invocation text verified identical at d6fd5d6 via `git show`) → preflight → db-selfheal → `next dev` on 168-commits-stale code. The 2026-11-11 outcome avoided this only because the platform did not start a server (reflog 29581df note: "DBs absent, no boot — adjudication deferred to approval gate" `[VERIFIED-FACT]`) — an availability accident, not an authorization control.

**(8) Can a recovery generation be activated without preserving source provenance? — YES (partial provenance, unverified binding) `[VERIFIED-FACT]`.**
Evidence: §1.7 — the generation manifest declares hash fields but the writer stores `chainSha256/customSha256: null` (`generation-store.ts:335-353`); the pointer carries no git commit (`:83-89`, `:444-450`); the staged path is structure-only and usable beside an unverifiable published layer (`recovery-authorization.ts:232-264`, esp. `:254-255`); the authorization's git-state check (`:154-159`) is transient — evaluated at decision time, recorded nowhere in the activated artifact.
*Consequence:* after activation, nothing can answer "which source tree authorized this generation, and do its payloads still hash-match?" — the strongest provenance the store offers is an origin label and journal prose. Combined with (4), a realign or forced checkout that lands *between* authorization and activation leaves the activated generation attributed to a tree that no longer exists. This is the precise gap the HEAL VERIFICATION + UNAUTHORIZED SOURCE states in §3 must close, and it feeds Workstream G (SEC-P0-IDENT-001, platform-identity-and-recovery-separation).

**(9) Can the platform launch `next dev` on an unapproved HEAD? — YES structurally; realized once pre-entrypoint `[VERIFIED-FACT]`/`[HISTORICAL]`.**
Evidence: `dev-watchdog.sh:173-175` boots local HEAD after a BLOCKED guard verdict ("booting local HEAD; run scripts/session-open-battery.sh to decide"); the authoritative `package.json` maps `dev` → `bash scripts/dev-entrypoint.sh` (read this session), which routes through the watchdog gate chain (`scripts/dev-entrypoint.sh:15-23`) — but at the substituted lineage `scripts/dev-entrypoint.sh` is ABSENT (ls-tree at d6fd5d6 `[VERIFIED-FACT]`), so `bun run dev` there fails availability-wise (F-0-P3-02, SEC-P0-DELTA-001 §11.2 `[HISTORICAL]`) rather than being *authorized* closed. Historical pre-gate launch: `src/instrumentation.ts:30-46` records the 2026-11-08T22:47:59Z incident where the platform's own `next dev` booted directly on a stale task46-era snapshot with no watchdog and its pre-guard self-heal restored obsolete h3941 dumps `[HISTORICAL]`.
*Consequence:* "unapproved HEAD" is today an *advisory* classification at the exact point of ignition. The watchdog's own comment concedes the design posture — "the battery will shout" (`:167`, `:174`) — i.e., detection-after-boot, human-mediated. Any platform-side start command that bypasses dev-entrypoint (as the 2026-11-08 incident did) has no gate at all; the gate that exists does not bind its BLOCKED verdict to the start decision.

**(10) Can scheduled automation act on a substituted checkout? — remediation NO (fail-closed, proven); evidence-writes YES `[VERIFIED-FACT]`.**
Evidence: the wrapper bootstraps from origin when local scripts are absent (`plane5-run.sh:49-53`, `:195-200`) — and plane-5 scripts ARE absent at d6fd5d6 (ls-tree: `scripts/plane5-run.sh`, `scripts/plane5-bootstrap.sh` NOT present) `[VERIFIED-FACT]`; the origin-sourced bootstrap runs the guard → BLOCKED exit 1 → wrapper exits 9 BOOTSTRAP-FAILED, monitor hard-BLOCKED (not in the 13/14/15 degraded set, `:249-256`) — realized in the substituted ledger's single entry (§2-7). However: (a) the bootstrap *materializes* untracked origin-sourced files into the substituted worktree before classifying (`plane5-bootstrap.sh:65-112`); (b) the platform's turn-end auto-commit demonstrably swept the blocked-fire evidence into the substituted tip itself — d6fd5d6's subject is a UUID-cron string (`git log --oneline -3 d6fd5d6`; reflog 16:56:54Z) `[VERIFIED-FACT]` — the incident-19 auto-sweep class (`worklog.md:10554` `[HISTORICAL]`, `scripts/snapshot-publish.ts:4-9` header).
*Consequence:* the plane-5 design is genuinely safe-by-design against substituted trees (guard precedes everything, remediation refuses). But the *platform's own* automation is not part of that contract: it committed onto the substituted line, creating the durable illusion of a legitimate lineage ("2 ahead"), and the materialized untracked files alter the substituted tree's runtime surface for later booted processes. Post-re-image scheduler registry liveness (jobs 522457/522460) is `[UNVERIFIED]` from this substrate.

---

## 3. Boot-authorization state machine — INTENDED FUTURE ARCHITECTURE (DOCUMENTED ONLY; NOT IMPLEMENTED)

**Design note:** nothing in this section exists in code today; it is the Phase-1 target recorded for owner authorization. It must not be read as a description of current behavior.

**Required chain (fail-closed order):** `SOURCE VERIFICATION → HEAL VERIFICATION → RUNTIME PREFLIGHT → DATABASE VERIFICATION → AUTHORIZED BOOT` (the order already documented at `scripts/plane5-bootstrap.sh:218` and `dev-watchdog.sh:183-186` comments — the machine below makes each link binding rather than advisory).

```
SOURCE VERIFICATION ─→ HEAL VERIFICATION ─→ RUNTIME PREFLIGHT ─→ DATABASE VERIFICATION ─→ AUTHORIZED BOOT
       │                     │                    │                      │                    │
  UNAUTHORIZED        PARTIAL / FAILED        FAILED                FAILED               OVERLAP
  SOURCE — BLOCKED    — BLOCKED               — BLOCKED             — BLOCKED             — BLOCKED
```

**Chain-level rules (all six states share them):**

1. Stages evaluate strictly in order; a stage's verdict is recorded before the next stage starts (no interleaving, no skip-ahead).
2. AUTHORIZED BOOT is reachable **only** from the immediately preceding artifact whose final state is `PASS` or `HEALED AND VERIFIED` with a monotonic `seq` — every other state is terminal for that attempt.
3. A blocked state never transitions to another blocked state without operator action (no PARTIAL→FAILED drift, no aging-out).
4. Any unresolved critical integrity failure anywhere in the chain yields a blocked state — **fail-closed by construction**, never by the absence of a failure.
5. Every state, including the blocked ones, writes the artifact **before** the boot decision point — monitoring consumes outcomes, not absence-of-outcomes.

**Single machine-readable artifact:** `db/boot-state.json` (gitignored operational state, dual-written to `/tmp/boot-state.json`) — a monotonic record: `{ seq, ts, head, origin, gitState, heal: {action, restored, failed, sentinel}, runtime: {ok, issues}, db: {decision, refusal, generation}, state, stage }`. **Monitoring must consume this artifact** — the heartbeat writer, monitor, backstop, and platform readiness endpoint read `state` and `stage`; any non-`PASS`/`HEALED AND VERIFIED` state is an alert condition, never a silent condition.

| State | Entry conditions | Exit conditions | Monitoring artifact content | Fail-closed semantics |
|---|---|---|---|---|
| **PASS** | All four stages evaluated with zero critical findings; gitState ∈ proceed set; heal action `none` (no unstaged deletions); preflight exit 0; DB decision NONE/healthy. | → AUTHORIZED BOOT (next dev exec permitted). | `state:"PASS"` + all stage sub-objects + `seq`. | Any stage error routes to FAILED/PARTIAL — PASS is unreachable with an unresolved critical integrity failure. |
| **HEALED AND VERIFIED** | Heal restored ≥1 file AND **re-verification** passed: fresh unstaged-deletion listing is empty AND every restored path re-hashes to the HEAD blob. | → RUNTIME PREFLIGHT (heal record travels in artifact). | `heal:{action:"restored", restored:[…], failed:[]}` + post-verify digest. | A restore that cannot be re-verified is PARTIAL — never HEALED. Sentinel stand-downs are recorded with reason + expiry and cap the state duration. |
| **PARTIAL — BLOCKED** | Heal `failed>0` (any count), or post-restore re-verification finds residual deletions/tamper. | Operator adjudication only: manual restore, commit the deletion, or a *recorded* sentinel; then the chain restarts from SOURCE VERIFICATION. | `heal:{action:"partial"|"error", failed:[paths], restored:[paths]}` — the partial-exit-0 defect is closed by construction. | No automatic retry may transition PARTIAL→boot; the retry loop may re-run the chain but the state stays blocked until a clean full-chain pass. |
| **FAILED — BLOCKED** | Any stage error: heal CLI error / preflight exit 3 after repair-once / db-selfheal exit 1–2 / bootstrap-stage failure (exit 9/11-16 classes). | Operator remediation; full chain re-run required. | `stage:"runtime-preflight", rc:3, detail:…` (stage-qualified failure record). | The existing fail-closed steps (watchdog `:187-196`, `:204-211`) keep their semantics; the suppressed step (`:180`) joins them. |
| **OVERLAP — BLOCKED** | Repository mutation detected between SOURCE VERIFICATION and AUTHORIZED BOOT: HEAD or worktree digest re-derived at the commit point ≠ digest captured at verification; or a concurrent supervision actor (platform automation, backstop, in-process tick) mutates the tree during the chain. | Full chain restart from SOURCE VERIFICATION on the new digest (the drift-subloop kill+reboot pattern, `dev-watchdog.sh:30-33`, made structural). | `overlap:{expectedHead, observedHead, actorHint}` — closes the Q4 TOCTOU window. | The commit-point re-check is mandatory; a mismatch can never be aged-out or retried into PASS without a fresh chain. |
| **UNAUTHORIZED SOURCE — BLOCKED** | Git classification outside the proceed set (DIVERGED / SOURCE_CODE_AHEAD / BEHIND / REMOTE_UNAVAILABLE / AUTHORITY_UNVERIFIED / dirty-tree BLOCKED), guard exit 1, or verification suppressed by sentinel. | Operator adjudication + sanctioned forward-only realignment (guard's archive+subsumption proofs) or explicit approval; then chain restart. | `gitState`, guard rc, changed-paths classification verbatim (the `--status` payload, `git-drift-guard.ts:57-73`). | Replaces today's "booting local HEAD" advisory (`dev-watchdog.sh:173-175`): an unauthorized source verdict is binding on ignition. |

**Contrast against CURRENT implicit behavior `[VERIFIED-FACT]`:** today boot *proceeds* through the entire gray zone — guard BLOCKED → boot (`:173-175`); heal failure/partial → suppressed (`:180`); no overlap detection at any commit point (§2-4); no artifact exists (§2-3); the six states collapse into one de-facto state ("booted, unverified") whose sole differentiator is whether preflight/DB happened to fail; detection is human-only via `dev.log` prose. The only fail-closed links already present — preflight (`:187-196`), db-selfheal (`:204-211`), bootstrap exits 1/9/11-16 (`plane5-bootstrap.sh`) — prove the intended semantics is *reachable* in this codebase; the machine extends them to the source-integrity and authorization links where the `|| true` currently sits.

### 3.1 Phase-1 remediation backlog (owner-authorized changes ONLY — none performed)

Enumerated so the owner decision register (SEC-P0-DECISIONS-001) can adopt them item-by-item; each maps to a state in §3:

1. **Capture the heal verdict** — `dev-watchdog.sh:180` becomes `HEAL_RC=$?` in the pattern already used at `:170` (drift) and `:206` (selfheal); PARTIAL must exit non-zero (`source-integrity-heal.ts:46-57` — split the `partial` action out of the exit-0 branch). → states PARTIAL/FAILED.
2. **Make the heal result machine-readable** — the CLI writes `db/boot-state.json` (dual `/tmp` copy) instead of stdout-only prose; heartbeat writer, monitor, and backstop consume it (`plane5-backstop-heartbeat.ts:145-148` gains a `source` plane). → artifact contract.
3. **Post-restore re-verification** — after `restoreDeletedTrackedFiles()`, re-run `listUnstagedDeletions()` and hash-compare each restored path to its HEAD blob before the state may be HEALED AND VERIFIED. → closes the Q2/Q3 pair.
4. **Commit-point overlap check** — re-derive `git rev-parse HEAD` + a worktree digest immediately before `next dev` exec (`dev-watchdog.sh:213`) and compare against the values captured at `:169`; mismatch → OVERLAP — BLOCKED, kill-and-reboot through the full chain (the `:30-33` subloop pattern, made structural). → closes Q4.
5. **Bind ignition to the guard verdict** — replace the `:173-175` "booting local HEAD" advisory with UNAUTHORIZED SOURCE — BLOCKED (exit-path mirrors `:207-211`), keeping the sentinel/explicit-approval escape as a *recorded* state, never a silent one. → closes Q9 for the watchdog chain; dev-entrypoint (`scripts/dev-entrypoint.sh:15-23`) already routes platform starts through it.
6. **Generation provenance binding** — fill `chainSha256/customSha256` in the generation manifest (`generation-store.ts:335-353`, fields declared `:66-71` but written null), and add `authorizedHead` to the pointer (`:83-89`). → closes Q8; feeds SEC-P0-IDENT-001 (G).
7. **Suppression-site cleanup** — `:135` (cloud-sync) and `:158/:159` (pkill) gain rc capture with an honest degraded log line; none of them may mask a *missing dependency* class (the d6fd5d6 realization of `:135`, §1.1-S1).

### 3.2 Sequencing note for Phase-1

The order matters: (2) before (1) — otherwise capturing a rc that still conflates PARTIAL with success merely automates the defect; (3) before (4) — the overlap check is meaningless if the verified state itself is unverified; (5) last — binding ignition is the highest-blast-radius change and presumes the earlier links produce trustworthy verdicts. All changes are watchdog/script-layer only; no database or contract change is implied. Rollout verification should use the regression harnesses the authoritative lineage already carries (`tests/plane5-git-state-regression.sh`, `tests/git-drift-quoting.test.ts` — origin-only per SEC-P0-DELTA-001 §7 `[HISTORICAL]`).

---

## 4. Platform re-image interaction

- **The substituted lineage d6fd5d6** — 2 ahead/168 behind origin/main 926ee00, merge-base ff67aa2 (`git rev-list --left-right --count` / `git merge-base`, 13:2xZ) `[VERIFIED-FACT]`; substituted-only commits `9fe4058` (task46 dashboard-audit #5) and `d6fd5d6` (UUID-cron telemetry, subject "c8cbcc8c-3049-4931-8805-e0e547af7155-cron" — `git log --oneline -3 d6fd5d6`) `[VERIFIED-FACT]`. Historically BOOTSTRAP-FAILED / guard BLOCKED: the substituted `backups/plane5/execution-ledger.jsonl` carries exactly ONE entry — `2026-11-10T16:56:44.232Z monitor jobId 516198 FINAL BOOTSTRAP-FAILED bootstrapExit=1 … "[git-drift] BLOCKED: tracked working tree is dirty … genuine unique local content. NO realign."` (`git show d6fd5d6:backups/plane5/execution-ledger.jsonl`) `[VERIFIED-FACT]`; corroborated by worklog.md:10666/10667 (the 21:38Z operator adjudication: 38 local-side paths, one unique-content worklog fragment, archive + realign to then-origin ff2d385) `[HISTORICAL]`.
- **The 2026-11-11T00:20Z re-image — PLATFORM_REIMAGE_STATE_LOSS (DATABASE_AND_SCHEDULER_REGISTRY):** original private scan harness + raw redacted output destroyed (verified absent 11:37Z; digests unrecordable from this substrate) — SEC-P0-ADDENDUM-001 §10.2 / SEC-P0-IRP-001 v1.1 item 8 `[HISTORICAL]`; live databases absent at capture (reflog 29581df note: "DBs absent, no boot — adjudication deferred to approval gate") `[VERIFIED-FACT]`.
- **Reflog evidence (read-only, `git -C /home/z/my-project reflog --date=iso | head -25`, 2026-11-11T13:2xZ) `[VERIFIED-FACT]`** — lineage-replacement events in order: 2026-11-10 16:56:54Z commit d6fd5d6 (UUID-cron); 2026-11-11 00:54:06Z `checkout: moving from main to security/phase-0-baseline`; 00:54:11Z `checkout: … to main` + the Phase-0 forensic baseline commit 29581df (branch-only; "local main restored to substituted ground truth d6fd5d6, origin/main untouched 926ee00"); 00:55:55Z and 00:56:12Z further forced `main ↔ baseline` checkouts ("concurrent platform automation forced git checkout main TWICE"); 00:57:09Z the phase-0 addendum commit ff59515 explicitly recording the double forced-checkout event; 00:57:23Z final `checkout … to main` leaving HEAD = d6fd5d6. Interpretation: the reflog is direct machine evidence that an actor **other than the repository's own tooling** moved HEAD repeatedly during evidence preservation — the same unsynchronized-mutation class as §2-4, realized against the operator's own workflow.

  | Reflog timestamp (UTC) | Entry (abbreviated) | Reading |
  |---|---|---|
  | 2026-11-10 16:56:54 | `commit: c8cbcc8c-…-cron` → d6fd5d6 | platform turn-end auto-commit onto the stale local line (substituted tip born) |
  | 2026-11-11 00:54:06 | `checkout: main → security/phase-0-baseline` | forensic-baseline work begins |
  | 2026-11-11 00:54:11 | `commit: Phase 0 forensic baseline (29581df)`; `checkout: → main` (d6fd5d6) | branch-only evidence commit; local main = substituted ground truth; **first forced checkout** |
  | 2026-11-11 00:55:55 / 00:56:12 | `checkout: main ↔ baseline` (twice) | **second forced checkout** — platform automation during evidence preservation |
  | 2026-11-11 00:57:09 | `commit: phase-0 addendum (ff59515)` recording the double event | the incident itself becomes recorded evidence (F-0-P0-03 corroboration) |
  | 2026-11-11 00:57:23 | `checkout: → main` (d6fd5d6) | resting state: substituted lineage, unchanged since |

- **Interaction with the boot chain:** a re-image of this class leaves (a) a watchdog (`dev-watchdog.sh` present at d6fd5d6) whose heal step is a masked no-op (heal script absent — `|| true` at `:180`, text identical across lineages), (b) no in-process source guard (`git show d6fd5d6:src/instrumentation.ts` contains no `source-integrity` reference — grep returned none) `[VERIFIED-FACT]`, (c) `bun run dev` broken only because dev-entrypoint is absent (availability accident, §2-9), and (d) plane-5 remediation fail-closed against the substituted tree (§2-10). Net: **containment on 2026-11-11 was fortunate, not designed** — the binding control this review recommends (UNAUTHORIZED SOURCE — BLOCKED as an ignition gate) did not exist and did not fire.

---

## 5. Closing note — no modification made; remediation is Phase-1 owner-authorized

**No boot-chain or recovery-script modification was performed in this assignment.** Every command run was read-only (`Read`/`grep`/`wc`/`git show|ls-tree|log|reflog|rev-parse|rev-list|merge-base` on `/home/z/phase0-review-wt` and `/home/z/my-project`); exactly one new documentation file was written — this file. The remediation of the `|| true` suppression sites (`dev-watchdog.sh:135/:158/:159/:180`), the partial-restore exit-0 defect (`source-integrity-heal.ts:46-57`), the generation-store provenance binding (`generation-store.ts:335-353`), and the §3 boot-authorization state machine are **Phase-1 changes requiring explicit owner authorization** (owner decision register: SEC-P0-DECISIONS-001). Nothing in this document should be read as rotated, revoked, remediated, or independently audited — all owner actions remain OPEN.

## 6. Companion documents on this branch (by exact ID/filename)

SEC-P0-EVIDENCE-001 `p0-evidence-preservation-register.md` (A) · SEC-P0-EXPOSURE-001 `public-object-exposure-review-package.md` (B) · SEC-P0-EVMCR-001 `evm-key-compromise-containment-readiness.md` (C) · SEC-P0-SOLCR-001 `solana-key-compromise-containment-readiness.md` (D) · SEC-P0-APIREV-001 `api-authorization-independent-review-package.md` (E) · **this document SEC-P0-BOOT-001 `boot-chain-source-integrity-review.md` (F)** · SEC-P0-IDENT-001 `platform-identity-and-recovery-separation.md` (G — closest companion: re-image/identity lineage and recovery separation) · SEC-P0-HANDOFF-001 `independent-security-reviewer-handoff.md` (H) · SEC-P0-DECISIONS-001 `owner-p0-decision-register.md` (I) · SEC-P0-EXEC-001 `p0-containment-readiness-executive-report.md` (J).

## 7. Facts NOT verified from this substrate ([UNVERIFIED] — reviewer reproduction required)

1. Live process state of the substituted clone (watchdog/server/monitor running or not at read time) — no `ps` probe performed; no boot attempted.
2. Post-re-image scheduler-platform registry state (whether jobs 522457/522460 survived or were re-registered after 2026-11-11T00:20Z).
3. Platform-provider audit logs / boot-script source for the 00:20Z re-image and the 00:54–00:57Z checkout events (attribution of the mutating actor) — owner + platform provider action (SEC-P0-IRP-001 D-9).
4. Whether the platform's turn-end auto-commit would sweep a *blocked* substituted tree again (observed once: d6fd5d6 itself; the plane-5 commit rule refuses unsynced trees, `plane5-run.sh:401-408`, but the platform sweep is outside that rule).
5. Byte-level identity of `dev-watchdog.sh` beyond the four cited sites across lineages (delta doc states "(near-)identical" — the `|| true` lines 135/158/159/180 were verified identical; the remainder is `[HISTORICAL]` per SEC-P0-DELTA-001 §5).
6. Whether platform automation would itself start `dev-watchdog.sh` (and hence the suppressed-heal chain of §4) on the substituted clone — no process-state probe was performed; the 2026-11-11 record shows no boot occurred, but that is an observation of this incident, not a control.
7. Behavior of `db/ALLOW-FILE-DELETIONS` / `db/ALLOW-GIT-REALIGN` / `db/ALLOW-GENESIS-RESET` sentinels in the *current* substrate (existence would be live state; not probed — read-only discipline). Their code semantics are verified (`source-integrity.ts:42-62`; `git-drift-guard.ts:23-26`; `db-selfheal.ts:20-25`).

**Status: verification-support material prepared for the independent reviewer — this document does not close or re-open findings; it enumerates the source-integrity links the reviewer must re-verify on the authoritative baseline (926ee00) and the remediation decisions reserved for Phase-1 owner authorization.**
