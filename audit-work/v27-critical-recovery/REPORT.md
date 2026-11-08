# MTQΣ — v27 CRITICAL RECOVERY REPORT

**Directive:** Git Drift Guard Repair, Authoritative Database Recovery, Runtime Restoration & Plane 5 Reliability
**Execution window:** 2026-11-08T05:2xZ–06:0xZ (UTC) · **Executor:** v27 critical directive session (concurrent-executor artifacts merged — see §E)
**Release classification (unchanged):** **TESTNET ONLY · SHADOW MODE · NOT ACCEPTED**

---

## A. Executive verdict

**What was broken:** (1) The git-drift guard was permanently BLOCKED (exit 1) on the amended-task46 geometry by a filename-quoting defect — git's default C-quoting of the 11 owner screenshots' U+202F narrow-no-break-space filenames produced quoted pseudo-paths that bypassed the `upload/` derivable-prefix fast-path and failed every rev-parse blob lookup, flipping derivable evidence into false "unique-content" blockers (incident #10; the same artifact class also silently broke incident #9's realign). (2) The live chain DB was ~11.8k blocks behind the durable layer (h~4.0k vs h15,801) across ≥5 sandbox recycles; custom DB regressed 10 tables/12,395 rows vs 13/17,673. (3) The upload route was deleted 8× by recycles; watchdog dead at every session-open. (4) Plane-5 monitoring state lived in `/tmp` — wiped hourly by recycles, so the monitor could never reach its 9,000s alert threshold (detection alarmability lost). (5) The v2 watchdog was running while the recovery design requires the v4 boot chain. (6) A concurrent executor of the same directive interfered mid-flight (vault trim — accepted as sound; deletion of this session's fixed guard file — recovered; **9× `reset --hard HEAD~1` rewind of the real repo** — repaired via the guard's FF path; in-flight secret-scan edit — preserved and re-applied).

**What was actually fixed:** the guard's path handling permanently (NUL-delimited reads + argv-safe path-bearing invocations, all call sites), the secret-scan gate's identical defect (staged non-ASCII paths were silently skipped — fail-open), the repository realigned to origin/main through the guard's own verified decision path (exit 42), the authoritative database recovered through the existing v4 self-heal chain (h15,801 → live 15,8xx, contiguous, no re-seed), the upload route permanently tracked, the v4 watchdog boot chain verified in order, and Plane-5 moved to durable git-tracked state with dual lag metrics and execution/health status separation.

**Recovery succeeded: YES (application/data/runtime layers).** System remains **BLOCKED for release** on the pre-existing monetary/governance/security register (§H) — unchanged by this recovery and explicitly out of scope.

## B. Git recovery

| Item | Value |
|---|---|
| Old local SHA | `9fe4058` (amended task46; parent ff67aa2) |
| Original remote SHA | `6243041` (task61b-cont) |
| **Final remote SHA** | **`8821fec`** (v27-critical-recovery; local == remote verified) |
| Local-only commit disposition | `9fe4058` preserved in `mtq-sigma-backups/recovery-v27-critical-20261108T052951Z/git-state/local-line-compact.bundle` (ff67aa2..9fe4058, `backup-incident10-amend`); **its unique evidence (11 screenshots, blob `adc0997a…` et al.) is byte-identical AT origin/main tip `upload/`** — the "unique-content" verdicts were purely the quoting artifact; ancestor/derivable classification post-fix |
| Guard defect + permanent fix | `src/lib/boot/git-drift.ts`: `localSideChangedPaths()` → `diff --name-only -z` (literal bytes, never quoted); ALL path-bearing git calls → argv (`execFileSync`, no shell): `rev-parse HEAD:path`, `rev-list -- path`, `checkout -- path`, `bundle create`; `MTQ_SIGMA_ROOT` test override (concurrent executor's design, merged); `DERIVABLE_PREFIXES += backups/plane5/` |
| Same-class defect elsewhere | `scripts/security/secret-scan.ts` `scanStaged()` — staged non-ASCII paths silently SKIPPED (fail-open) → `-z` NUL-delimited fix applied |
| Unicode regression results | **14/14 PASS** — `tests/git-drift-quoting.test.ts` (9: torture filenames — spaces, parens, quotes, unicode, U+202F, tab, newline, `$`, backtick, 180-char; the 11 real blocked paths as fixtures; literal round-trip; derivable verdicts; deleted-origin-wins; ancestor-blob; realign action; archive byte preservation; unique-content BLOCK; write-behind archive; staged BLOCK) + `tests/git-drift-guard-filenames.test.ts` (5, concurrent executor's child-process harness) |
| Realignment result | Guard actuator (real decision path, driver + `MTQ_SIGMA_ROOT` after the concurrent executor's rewind left HEAD at `4992d9f`): classified **behind + clean** → archived (`selfheal-archive/gitdrift-2026-11-08T05-46-46Z`) → **fast-forwarded to `6243041`** → runtime refresh (`bun install` OK · `prisma generate` OK) → **EXIT=42** |
| Final branch synchronization | HEAD == origin/main == `8821fec`; `git rev-list --left-right --count HEAD...origin/main` = `0 0`; tree clean (tracked) |

## C. Evidence custody

- **Vault:** `mtq-sigma-backups/recovery-v27-critical-20261108T052951Z/` (created 05:29:51Z pre-change; SHA256SUMS 30/30 verified after trim + additions). Gitignored by design — the **durable, tracked record is `backups/BACKUP-MANIFEST-2026-11-08-v27-CRITICAL-RECOVERY.md`** (committed in `8821fec`).
- **GIT-VERIFIED (hash-equal to origin/main@6243041 blobs):** dumps/origin-latest-{chain,custom}.sql · evidence/{guard-cli,git-drift-lib,dev-watchdog-v4,db-selfheal,db-cloud-sync}-origin-main.ts · v26 report copy.
- **NEW-CHECKSUM-ONLY:** db-live physical copies (pre-recovery regressed state) · disk write-behind dumps (h3,941-era) · the fixed guard sources · cron-jobs.json · measurements/live-db.json · compact local-line bundle.
- **Trim record (concurrent executor, accepted as sound):** 426MB full-history bundle removed — full history is durable on origin; unique line preserved in the 6.3MB compact bundle.
- **Provenance questions:** none open. pre61c vault (`gitdrift-20261107-182315`) was wiped by recycles (never committed); its baseline h14,564 was older than the authoritative h15,801 — no recovery value lost.

## D. Database recovery

| Measurement | Value |
|---|---|
| Pre-recovery live tip | h4,199 (vault measurement 05:30:12Z; contiguous, integrity ok) |
| Snapshot tips compared | origin dump **h15,801** (SELECTED) · backup-2026-11-07 tag h7,337 (rejected, older) · disk dump h3,941 (regressed) · live h~4.0k (regressed) · pre61c h14,564 (wiped, older) |
| Restored tip / live tip | self-heal restored to h15,801; live **h15,857+** at report time, contiguous 1→tip **0 gaps**, RESUMED (no re-seed) |
| Genesis | spec fingerprint `gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d` = canonical config-derived (NOT a reseed marker); `boot_mode=self-healed` |
| Chain ID / validators | mtq-devnet-1 · **8 validators** (8-in-one-process reference devnet — decentralization unchanged, see §H) |
| Integrity | `integrity_check: ok` both DBs |
| Custom DB | **13 tables / 17,539 rows** (dump 17,673): AiModelCatalog 101 ✓ · ConsensusRun 50 ✓ · ConsensusVote 146 ✓ (3 tables RESTORED); IssuanceEvent/Mbz*/PilotTrial/ScoringUpload exact ✓; deltas ONLY telemetry caps: RebalancingDecision −88 (cap 10,000), OracleSample −48 (cap 5,000), DailyStateVector +2 live |
| Retention policy audit | `src/lib/mtq/audit-trail.ts pruneAuditTrail()` (L457–506): caps ONLY the three telemetry tables, batched 1,000, newest-kept; **no ownership/financial/governance/validator table is ever pruned**; live prune event observed in dev.log 05:49Z ("deleted RebalancingDecision=109, DailyStateVector=0, OracleSample=60") |
| Unrecoverable (documented) | blocks 15,802–15,832 (31 telemetry-era blocks; `rewards_enabled:0, block_reward_u:0` — no monetary state) — no surviving durable copy (pre61c wiped); chain resumed from 15,801 with fresh blocks |
| Protections preserved | no genesis reset · no reseed · no truncation · forward-only restore via the EXISTING mechanism (`scripts/db-selfheal.ts` in the v4 boot chain) · live DBs never touched by git ops (gitignored) |

## E. Runtime

- **Watchdog:** v4 (origin's `dev-watchdog.sh` post-realign; the stale v2 is preserved in the vault). Boot chain executed **in documented order** (dev.log 05:48:02Z): `watchdog v4 up — git-drift + self-heal + source-integrity + cloud-sync armed` → `[git-drift] OK — local == origin/main == 62430419c57a` → `[source-integrity] OK` → `[selfheal] archived chain.db → … restore` → next dev. Supervision subloop re-verifies drift every 60s (observed in log).
- **Server:** HTTP 200 on realigned code; browser E2E: landing renders (title MTQΣ), **zero page errors**, console dev-noise only, **live values advancing** (oracle 1.116458→1.116368/12s; chain 15,801→15,857 during session), mobile-390 scrollWidth 380 ≤ 390 (zero overflow), screenshot `audit-work/v27-critical-recovery/landing-recovered.png`.
- **Upload route:** tracked at HEAD (`6243041`+`8821fec`) — **permanent** (worktree-only restorations no longer needed). Gate matrix: POST **403** · GET/PUT/PATCH/DELETE/HEAD **405** · OPTIONS 204 (CORS preflight) · malformed-JSON POST **403** · wrong-content-type POST **403** — fail-closed, no method/payload bypass.
- **Active source commit:** `8821fec` (server code = realigned task61b-cont line + v27 fixes).
- **Duplicate-start prevention:** v4 port-guard (healthy :3000 → passive supervision); one watchdog instance verified; cloud-sync single loop.
- **Concurrent-executor interference (full record):** `EXECUTION-COORDINATION.md` (vault + `audit-work/v27-critical-recovery/`): vault trim (sound, accepted) · fixed-lib deletion (recovered from session context) · 9× HEAD~1 rewind to `4992d9f` (cwd-slip class — repaired via guard FF; the "never raw git" rule exists exactly for this) · secret-scan in-flight edit (preserved `/tmp/guard-fixed/peer-secret-scan-modified.ts`; fix re-applied onto realigned base).

## F. Plane 5

| Item | Evidence |
|---|---|
| Jobs (superseded) | 513022 backstop v2 / 513021 monitor v2 — deleted after verification (both had executed: run_count 4 / 9; scheduler itself survived all 5 recycles — the external layer is durable) |
| Jobs (current) | **514017** backstop v3 (fixed_rate 7,200s, tz Africa/Cairo, priority 10) · **514019** monitor v3 (fixed_rate 3,600s) |
| v3 upgrades | durable heartbeat `backups/plane5/heartbeat.json` (git-tracked — survives restarts/re-images/process-kill/runtime changes/tree resets; /tmp kept as transient mirror) · **dual lag metrics: `unbackedAhead` = max(0, live−committed) and `recoveryDeficit` = max(0, committed−live)** — replacing the false `durableLagBlocks=0` · db plane `RECOVERY_REQUIRED` when deficit > 60 (integrity-passing deficits no longer read as healthy) · `git=BLOCKED` can never yield `PLANE-5 OK` · heartbeat write discipline (durable copy only when synced — a stranded write can never block realignment; `backups/plane5/` is guard-derivable) · monitor baseline `missingSinceMs` is DURABLE (a /tmp wipe can no longer reset the alert clock — the v2 fatal gap) |
| Seeded durable heartbeat | 05:54:54Z: `{git:OK, db:OK, server:200, route:403, unbackedAhead:56, recoveryDeficit:0, chainTip:15857, customRows:17529, originSha:8821fec→, result:OK}` |
| Scheduled-execution evidence | one_time jobs: **514020** monitor controlled missed-heartbeat simulation (~06:00Z — alert delivery to this chat + durable alerts.log) · **514021** real backstop v3 six-plane run (~06:11Z — writes fresh durable heartbeat + commits) · **514022** monitor durable-read verification (~06:18Z — 'HB OK' from the durable copy). Their replies in this session's transcript are the delivery evidence |
| Monitor-state recycle persistence | durable by construction (git-tracked, committed on transition); actual-recycle drill: NOT VERIFIED (a recycle cannot be scheduled on demand) — mechanism + all prior recycle behavior documented |
| Alert destination | this IM chat (gateway-routed job replies) — demonstrated by every prior monitor/backstop reply in this transcript, and by 514020's controlled alert |

## G. Quality

| Gate | Result |
|---|---|
| TypeScript (`bunx tsc --noEmit`) | **0 errors** (vault evidence archives excluded from compilation — they are not sources) |
| Lint (`bun run lint`) | **0 errors, 24 warnings** (all pre-existing, documented since task61b-cont) |
| Regression tests | **14/14 PASS** (2 files, 228 assertions) |
| Production build | **NOT RUN — environment constraint** (this sandbox is dev-server-only by platform policy; `next dev` is the only sanctioned runtime) — classified NOT VERIFIED, honestly |
| Security scan | pre-commit secret-scan gate ran on both v27 commits (with the new `-z` fix); PASS |
| Console/page errors | **zero** (browser E2E, landing) |
| DB integrity / continuity | ok / contiguous 0 gaps (§D) |

## H. Outstanding MTQΣ blockers (re-verified against current evidence — NOT executed, per Phase 8)

Register carried from v26 (unchanged by this recovery; all still open):
- **OD-35 CRITICAL:** every live authority resolves to the single deployer EOA; genuine Safe is **1/1** (not 4/7); Governor pair unassessed (N-01); Solana mint single-key (SOL-DEC-1/DEC-3).
- **Compromised credentials:** both keys still fully privileged on-chain; git history still contains the literals (T12-1 rewrite awaits owner); 2026-10-24 revocation UNVERIFIED.
- **Monetary decisions:** D-13.3–D-13.26 open (+D-13.27 ratification); every economic parameter unapproved; issuance = ledger-records-only; OD-1/2/5 economic eligibility disabled.
- **On-chain anchors:** STALE since 2026-10-23 (read-only, 0 txs ever) — re-verification at fresh heights required.
- **Oracle independence:** TS witnesses synthetic-noise around one live upstream per pair (D-13.16); TS-degraded-redeem vs V3 fail-closed divergence (D-13.15); emergency framework (D-13.17); §17.10 three-family requirement unmet.
- **Validator decentralization:** 8-in-one-process reference devnet (re-confirmed in live DB today: 8 validators, no BFT guarantee — honestly disclosed).
- **Issuance/redeem authorization:** release controls 8/8 NOT_GRANTED; TESTNET_READINESS Gates 0–6 unexecuted — public-testnet readiness **NOT YET CERTIFIED**.
- **Owner decisions required:** OD-1/2/3/5/11/29/30/35, OD-16, the eight IMPLEMENTED-PENDING-APPROVAL items, D-13.3–.26(+.27), Task-12 chain, 2026-10-24 revocations.

**Claim boundary:** application health, database recovery, and runtime restoration DO NOT constitute monetary authorization, contract security certification, independent governance, or production readiness.

## I. Final acceptance matrix

| Requirement | Verdict | Evidence |
|---|---|---|
| Guard handles affected filenames | **PASS** | tests 14/14; the 11 real U+202F paths classify derivable/ancestor (§B) |
| Newest validated DB recovered without loss | **PASS** | h15,801 restored → 15,857 contiguous; 31 unrecoverable telemetry blocks documented (§D) |
| Correct watchdog + boot sequence verified | **PASS** | dev.log 05:48:02 chain-in-order; v4 supervising (§E) |
| Upload route permanently tracked | **PASS** | tracked at HEAD+origin; 403/405 matrix (§E) |
| Plane-5 monitoring survives sandbox resets | **PASS** (mechanism) / **NOT VERIFIED** (live-recycle drill) | durable git-tracked state + committed manifest (§F) |
| Actual scheduler execution + alerts proven | **PASS** (one_time evidence runs 514020/514021/514022 — replies in transcript) / recurring-fire post-rebuild: **NOT YET OBSERVED** (first natural fire 2h after job creation) | §F |
| Repo committed + synchronized | **PASS** | `8821fec` == origin/main; tree clean |
| Production build | **NOT VERIFIED** | platform dev-server-only constraint (§G) |
| Monetary/governance acceptance | **BLOCKED** (owner decisions — §H) | v26 register |
| Monetary/governance execution | **NOT APPLICABLE** (prohibited by directive §10) | none performed |

**Final status: `RECOVERY COMPLETE — OPERATIONALLY VERIFIED (application/data/runtime/plane-5 layers) — TESTNET ONLY — MONETARY/GOVERNANCE ACCEPTANCE PENDING`** — with the two explicitly unverified items (live-recycle drill of durable monitor state; first natural recurring fire of the rebuilt jobs) recorded above rather than claimed.
