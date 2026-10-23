# MTQΣ — TASK 13 · TEST MATRIX & RESULTS (deliverable 13)

**Status:** Stage A fresh-baseline record + the 2026-10-22 MANDATE-004 verification cycle (complete Layer-1→8 coverage via isolation/chunked execution). Environmental limitations are reported as UNVERIFIED, never PASS.

**Standing rule (unchanged):** no gate is advanced by any green result below; a failing security control is never excused by passing tests; a FAIL is reported as a FAIL.

## 0. Verification environment

- Git baseline at check time: branch `main`, HEAD `7b4c680140c6bf6244a4d3f51677ccbe91415b3c`; working tree initially content-identical to HEAD (44 unstaged files verified **mode-only** via `git diff --shortstat` → "44 files changed, 0 insertions(+), 0 deletions(-)").
- This cycle's only code change: the harness-isolation edit to `src/lib/mtq/__tests__/canonical-invariants.ts` (see §2.1 — selection/chunking only; assertions byte-identical). All other writes are Task 13 documents under `audit-work/task13/`.
- Checks ran with the dev server, keeper, and mtq-feed co-resident (14 bun/node processes).
- No git remote exists; no on-chain probes were re-run this cycle (shadow, read-only posture; latest on-chain anchors remain Task 12's).

## 1. Fresh re-run — 2026-10-22 (commands verbatim; exit codes and timestamps recorded)

| # | Check | Command | Result (exit code) · window (UTC) | Evidence status |
|---|---|---|---|---|
| 1 | Worktree secret scan | `bun run scripts/security/secret-scan.ts` | **FAIL (1)** — exactly 1 finding: `upload/private_key.txt`, rule `known-compromised-literal-C-045-a`, redacted fingerprint `0xdbe1…62d6`; 2,201 files scanned; 14 documented suppressions; all other files clean · 16:03:37–16:03:40 | VERIFIED — truthful red (T13-INC-001); green only after owner disposition D-13.1 |
| 2 | Typecheck | `bun run typecheck` | **PASS (0)** · 16:02:34–16:02:50; re-run **PASS (0)** at 16:36 after the harness edit | VERIFIED |
| 3 | Lint | `bun run lint` | **PASS (0)**, zero findings · 16:02:50–16:03:12; re-run **PASS (0)** at 16:36 after the harness edit | VERIFIED |
| 4 | Full test suite | `bun test` | **36 pass / 1 fail (1)** — 99 expects, 3 files, 2.34s; the single failure is the worktree secret-gate test, red for the same T13-INC-001 cause (fail-closed by design) · 16:03:40–16:03:42 | VERIFIED |
| 5 | No-Neon guardrail | `bun run check:no-neon` | **PASS (0)** — 45 route files, no Neon/Postgres imports · 16:03:12 | VERIFIED |
| 6 | Release gates | `src/lib/mtq/honest-status.ts` (code inspection, carried) | 11 gates G1–G11 all NOT CONDUCTED; `isProductionAuthorized()` false | DEVELOPER-REPORTED (carried; not re-run this cycle) |
| 7 | Release controls | `src/lib/mtq/release-controls.ts` (carried) | 8/8 controls NOT_GRANTED; 10-action default-deny; only `database-write` reachable | DEVELOPER-REPORTED (Task-12 live-verified) |
| 8 | Foundry suites | `forge test` | UNVERIFIABLE — no forge toolchain in sandbox | UNVERIFIED |
| 9 | On-chain re-probe | — | NOT re-run this cycle (shadow, read-only); latest anchors (Task 12): Monad 73,243,944 · Arc 68,520,264 · RH 140,748,341 · Solana slot 513,885,476 | DEVELOPER-REPORTED (carried) |

## 2. Canonical invariants — 2026-10-22 chunked-execution record (full Layer 1–8 coverage this cycle)

### 2.1 Harness change (MANDATE-004 §3 authorization — isolation only; assertions byte-identical)

The suite previously exceeded the 10-minute tool ceiling during Layer 7 (Stage A recorded three documented timeout attempts → UNVERIFIED). Per the mandate ("isolate and optimize the test harness without weakening its assertions"), the harness gained selection/chunking ONLY:

- `--layers=…` / `--layer7=s5|s6|s3|all` — layer/scenario selection; default full run byte-identical to before.
- `--trajs=A-B` — trajectory sub-range for a single scenario (inclusive); writes a partial JSON record `{scenario, trajStart, trajCount, survivors, worstMinRr}` (no secret-shaped data possible by construction) and executes **no** assertions.
- `--merge` — loads partials, proves an **exact cover** of [0, runs) with no overlap/gap (hard exit 2 on any violation), then executes the ORIGINAL scenario assertions, byte-identical, on the merged aggregates.
- Evidence directory: `audit-work/task13/evidence/canonical-layer7/`. Typecheck PASS + lint PASS after the edit (§1 rows 2–3 re-runs).

**Equivalence demonstration (mandate §3: "only if its equivalence is demonstrated"):** each trajectory is a pure function of `(seed, ticks, fxGen)` with freshly-constructed state (`runStressTrajectory` builds its own state per call); seeds are `seedBase + i` over disjoint `i`-ranges, so chunking visits the identical trajectory set with identical RNG streams; `survivors` is exact integer addition and `worstMinRr` is an associative/commutative min, so merged aggregates equal single-run aggregates exactly; assertions execute only on a proven-complete trajectory set. Chunked execution is therefore value-identical to a single-process run.

### 2.2 Run record (all runs: `bun src/lib/mtq/__tests__/canonical-invariants.ts …`; exit codes recorded)

| Run | Arguments | Window (UTC) | Result | Exit |
|---|---|---|---|---|
| Layers 1–6 + 8 | `--layers=1,2,3,4,5,6,8` | 16:09:06–16:10:08 | L1 41/41 · L2 42/42 · L3 25/25 · L4 12/12 · L5 29/29 · L6 3/3 · L8 85/91 → **TOTAL 237/243, 6 FAIL** | 1 |
| Layer 8 alone (determinism check) | `--layers=8` | 16:31:52–16:31:53 | identical 6 failures → order-independent | 1 |
| S5 (gold +50%) full | `--layer7=s5` | 16:36:59–16:43:01 | **PASS** — survival 100.0% (≥95%), worst min RR 1.110 (≥ RR_HARD 1.00) | 0 |
| S6 (gold −30%) full | `--layer7=s6` | 16:58:00–17:04:02 | **PASS** — both assertions held (survival ≥95%; worst min RR ≥1.00); measured headline values were truncated from the captured transcript tail — the exit code + assertion conditions are the recorded result | 0 |
| S3 chunk 1/5 | `--layer7=s3 --trajs=0-39` | 17:04:51–17:11:48 | PARTIAL — 40 trajs, 17 survivors, worstMinRr 0.4354 (`s3-0-40.json`) | 0 |
| S3 chunk 2/5 | `--trajs=40-79` | 17:12:14–17:19:14 | PARTIAL — 13 survivors, worstMinRr 0.4230 (`s3-40-80.json`) | 0 |
| S3 chunk 3/5 | `--trajs=80-119` | 17:19:37–17:26:30 | PARTIAL — 18 survivors, worstMinRr 0.2728 (`s3-80-120.json`) | 0 |
| S3 chunk 4/5 | `--trajs=120-159` | 17:27:10–17:35:09 | PARTIAL — 19 survivors, worstMinRr 0.0759 (`s3-120-160.json`) | 0 |
| S3 chunk 5/5 | `--trajs=160-199` | 17:36:21–17:44:33 | PARTIAL — 18 survivors, worstMinRr 0.4255 (`s3-160-200.json`) | 0 |
| S3 merge | `--layer7=s3 --merge` | 17:45:08 | exact cover of 200/200 verified from 5 partials; survivors 85 → **survival 42.5% > legacy 35.1%**; worst min RR 0.076; both S3 assertions **PASS** | 0 |

### 2.3 The six Layer-8 failures — stale assertions (real finding, not caused by isolation)

| # | Assertion (verbatim name) | Observed mismatch |
|---|---|---|
| 1 | C.1: θ_base = 0.75% (NO_TRADE_BAND_BASE) and the band boundary is strict (<) | code treats θ=0.0075 as in-zone (`inNoTradeZone(0.0075)=true`) |
| 2 | C.3: tradeUsd ≈ β × 0.6%×NAV = $3,000 (partial correction on the residual) | active path computes tradeUsd ≈ 5160 |
| 3 | RG-10 ε boundary: net ≈ +$5 (≤ ε $10) → no-trade; net ≈ +$15 → trade | both nets are large-negative in the current scenario set (premise no longer holds) |
| 4 | RG-10: net benefit $4.79 (positive but ≤ ε) → shouldRebalance=false — the ACTIVE path no longer trades on the bare >0 form | path returns shouldRebalance=true with the unified §12.8-gate reason |
| 5 | RG-10: the rejection reason cites the unified §10.8/§12.8 gate | reason string mismatch (form changed) |
| 6 | §21.5.3: in-band decay 2×dtHours (30h → 10h) → stage 0 → immediate de-escalation | observed stage=0, depegHours=0, startPrice=1 (scenario state differs from the asserted setup) |

**Interpretation (VERIFIED this cycle):** these are assertion-vs-code mismatches encoding superseded parameterization/spec text — the same family as the previously-disclosed stale "Case C raw-USD divisor" assertion (which did **not** appear among this cycle's failures; its honest-status disclosure remains on file). The identical failure set reproduced in two independent runs (Layers 1–6+8, and Layer 8 alone) → deterministic and order-independent; the isolation edit did not cause them (no assertion, scenario body, seed, or threshold was changed — verified by diff review; `runAuditFixSuite` untouched).

**Honest consequence:** the suite's verdict on the current tree is **FAIL (244/250 pass, 6 fail)**. Stage A's carried "last recorded PASS (Task 12)" is not reproducible on this tree and must not be cited (MANDATE-004 §3). Remediation (queued to the Stage-K rewrite; adjudication per the D-13.26 protocol): re-align the six assertions with the current engine parameterization or correct the engine, per owner/validator adjudication — assertions were NOT weakened this cycle.

### 2.4 Suite verdict — 2026-10-22 (supersedes the Stage A "UNVERIFIED — three timeout attempts" record)

- **Layers 1–6: PASS — 152/152** (deterministic economic layers).
- **Layer 7: PASS — 7/7 assertions** (S5 100.0% survival, min RR 1.110; S6 both assertions; S3 42.5% survival vs 35.1% legacy floor, worst min RR 0.076 — completed via 5 chunks + exact-cover merge after single-process runs of S5/S6).
- **Layer 8: 85/91 — FAIL** (6 stale assertions, §2.3).
- **Suite: FAIL on the current tree.** Layers 1–7 are green with full coverage this cycle; the green Layer-8 baseline requires the Stage-K rewrite. No gate effect: no gate may be advanced by these results (standing rule).

## 3. Stage K test families — coverage plan vs current state (updated 2026-10-22)

All families below are **PLANNED** (specified in the produced Stage B–K documents; none implemented, none run). Test-family names follow the producing documents.

| Mandated family | Planned family (document) | Current state |
|---|---|---|
| Basket membership transitions / entry-exit hysteresis / score boundaries | CCY-LC · HYS · SCORE · ANN (deliverable 4 §10) | NONE implemented (constituency static by construction) |
| Component add/retire; weight sum + bounds after every transition | CCY-SUM · CCY-BOUND · VEL · EXCL (deliverable 4 §10); IDX-CONT-* continuity set (deliverable 5 §8) | Partial submission-time checks only; positive-weights-only blocks exits |
| Index continuity at composition changes | IDX-CONT / divisor-adjustment acceptance tests (deliverable 5 §2.2/§8) | NONE (composition cannot change today) |
| Oracle staleness & source disagreement | T-ORC-01…06 + twelve-scenario map (deliverable 10 §9–§10) | Partial (TS five-state; disclosed single-upstream gap; redeem-on-DEGRADED divergence to close under D-13.15) |
| Payment-instrument eligibility/suspension; settlement finality & failed payments | T-PAY-01…03 (deliverable 6 §8) | NONE (no instrument registry) |
| Quote expiry, rounding, refunds, fee calculation | T-FEE-01…06 (deliverable 8 §6); quote-expiry/refund paths in deliverables 6–7 | Partial fee math only |
| Issuance/burn authorization; fee-recipient accounting & treasury permissions | deliverable 7 §6 families + T-FEE (deliverable 8) | Partial (V3 role tests Foundry-only, UNVERIFIABLE here; no sweep exists) |
| Cross-chain supply reconciliation | TC-XC1…7 (deliverable 9 §7) | NONE (no cross-chain model; D-13.10 OPEN) |
| Unauthorized calls & privilege escalation | Foundry adversarial suite (UNVERIFIABLE — no forge) + release-controls 13/13 (PASS, §1 row 4) | Partial |
| Emergency pause, recovery, governance controls | EMER families (deliverable 4 §10) + T-ORC emergency scenarios (deliverable 10 §6/§10) | Partial (state-machine self-tests; keeper guard live) |
| Reference value vs market-price reporting | VAL-TRK tracking metric (deliverable 11 §5/§6) | NONE (no market-price feed) |
| Validation runs (historical + stress windows, 8 mandated metrics) | VAL-* families + pre-registration (deliverable 11 §3–§7; D-13.25/D-13.26 pending) | NONE run — plan only |
| Shadow mode & release-gate enforcement | release-controls suite (13/13 PASS this cycle, §1 row 4) + honest-status gates | **Covered — maintain; never weaken** |

**Posture line: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

## 4. Fresh battery — MANDATE-006 cycle (2026-10-22, 20:41–21:0x UTC; exact commands, exit codes recorded)

**Environment:** HEAD `12dc545` (last commit = the MANDATE-005 docs-only set); worktree delta = this cycle's audit-work/task13 documents only — **the engine, harness, contracts, and all economic source files are byte-identical to the state the six-failure adjudication and the Layer-7 chunked evidence were produced in.** The two renames this cycle (`v3-quantitative-validation-plan.md` → `v3-purchasing-power-validation-plan.md`; `security-remediation-and-migration-readiness.md` → `security-remediation-and-release-gates.md`) are documentation-only (`git mv`, history preserved).

| # | Check | Command | Result (exit) | Evidence status |
|---|---|---|---|---|
| 1 | Worktree secret scan | `bun run security:scan` | **PASS (0)** — 2,221 files, 14 documented suppressions, 0 findings | VERIFIED (D-13.1 deletion stands; worktree clean) |
| 2 | Typecheck | `bun run typecheck` | **PASS (0)** | VERIFIED |
| 3 | Lint | `bun run lint` | **PASS (0)** | VERIFIED |
| 4 | Full test suite | `bun test` | **37 pass / 0 fail (0)** — 99 expects, 3 files | VERIFIED |
| 5 | Layer-8 focused (canonical) | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=8` | **85/91, 6 fail (1)** — byte-identical canonical six (C.1, C.3, RG-10 ×3, §21.5.3) | VERIFIED — `evidence/l8-focused-mandate006-2026-10-22.txt` |
| 6 | Deterministic Layers 1–6+8 | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=1,2,3,4,5,6,8` | L1 41/41 · L2 42/42 · L3 25/25 · L4 12/12 · L5 29/29 · L6 3/3 · L8 85/91 → **237/243, 6 fail (1)** | VERIFIED — `evidence/l-deterministic-mandate006-2026-10-22.txt` |
| 7 | Layer 7 | carried (no source change since the recorded chunked execution) | S5 PASS · S6 PASS · S3 42.5% via 5×40 chunks + exact-cover merge — §2.2 record stands | CARRIED (byte-identical tree) |
| 8 | Release gates / controls | code inspection, carried | 11 gates NOT CONDUCTED; 8/8 controls NOT_GRANTED; `isProductionAuthorized()` false | DEVELOPER-REPORTED (carried) |
| 9 | Foundry suites | `forge test` | UNVERIFIABLE — no forge in sandbox | UNVERIFIED |
| 10 | On-chain re-probe | — | NOT run (shadow, read-only posture); latest anchors remain Task 12's | DEVELOPER-REPORTED (carried) |

**Suite verdict after this cycle (unchanged):** deterministic layers **237/243** (six stale Layer-8 assertions) + Layer-7 **7/7** (carried) = **FAIL (244/250)**. The six proposed corrections (three more-conservative, one stronger, two identical-intent; +3 new invariant-coverage assertions → 253 expected) remain **NOT APPLIED pending the D-13.26 owner/validator review** — consolidated this cycle in `layer8-test-corrections-evidence-pack.md`. No gate is advanced by any row above; a FAIL is reported as a FAIL.

**Posture line: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

## 5. Fresh battery + capability demonstrations — MANDATE-007 cycle (2026-10-22, ~22:05–23:0x UTC; exact commands, exit codes recorded)

| # | Check | Command | Result | Evidence class |
|---|---|---|---|---|
| 1 | Typecheck | `bun run typecheck` | **PASS (exit 0)** — repo-wide incl. both new evidence-space prototype directories | VERIFIED |
| 2 | Lint | `bun run lint` | **PASS (exit 0)** | VERIFIED |
| 3 | Unit/gate suite | `bun test` | **37 pass / 0 fail (exit 0)** — no `*.test.ts` created in evidence space | VERIFIED |
| 4 | Worktree secret scan | `bun run security:scan` | **PASS (exit 0, 0 findings)** — allowlist untouched; no key-shaped strings in prototypes (non-hex test identifiers, base64url digests only) | VERIFIED |
| 5 | Neon check | `bun run check:no-neon` | **PASS (45 routes, exit 0)** | VERIFIED |
| 6 | Canonical — focused Layer 8 | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=8` | **85/91 pass, 6 fail, exit 1** (22:42 UTC) — identical canonical six; log `evidence/l8-focused-mandate007-2026-10-22.txt` | VERIFIED |
| 7 | Canonical — complete applicable suite | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=1,2,3,4,5,6,8` | **237/243 pass, 6 fail, exit 1** (L1–6 all green 152/152); log `evidence/l-deterministic-mandate007-2026-10-22.txt` | VERIFIED |
| 8 | Layer 7 | — | carried (no source change since the recorded chunked execution) | CARRIED |
| 9 | Layer-8 proposed-diff exactness | `bun audit-work/task13/evidence/extract-and-verify-layer8-diffs.ts` | **exit 0 — all six diffs EXACT for the current tree** (30/30 removed lines, 23/23 context lines verified byte-for-byte vs `canonical-invariants.ts`); artifacts `evidence/layer8-d13-26-consolidated-proposed-diff-mandate007.md` + JSON record | VERIFIED |
| 10 | Layer-8 post-correction fixture values (read-only, outside the suite) | `bun audit-work/task13/evidence/l8-d13-26-fixture-verification.ts` | **exit 0 — all parts ✓** (C.1 inclusive + sandwich; C.3 β=0.86/$5,160; RG-10 +$5/+$15; active-path reject +$5.70; §21.5.2 reset/boundary/oscillation); log `evidence/l8-fixture-verification-mandate007-2026-10-22.txt`; MANDATE-005 record preserved at `-mandate005.json` | VERIFIED |
| 11 | Dynamic-replacement end-to-end (NON-PRODUCTION prototype) | `bun run audit-work/task13/evidence/dynamic-replacement/run-dynamic-replacement-e2e.ts` × 2 | **15/15 PASS, exit 0 BOTH runs** (22:37:09Z / 22:37:15Z; results byte-identical) — DR-01..DR-15; exclusion exactly 0 bp; max sum deviation 2.220e-16; composition-only index delta 0.000e+0; dataset sha256-tagged; decision record byte-identical on re-run | VERIFIED (prototype evidence only — NOT a production capability claim) |
| 12 | Issuance end-to-end (NON-PRODUCTION prototype) | `bun run audit-work/task13/evidence/issuance-state-machine/run-issuance-e2e.ts` × 2 | **123/123 PASS, exit 0 BOTH runs** (22:23:22Z / 22:23:28Z; byte-identical outcomes) — happy path (fee 10.00/0.10% ILLUSTRATIVE → net 9,990 → issued 4,995.000000 at quote 2.0), duplicate/delayed/failed/reversed/unauthorized/invalid, supply caps, replay, forced-break reconciliation detection, separation-invariant test-of-absence (basket byte-identical), CBDC SIMULATED path | VERIFIED (prototype evidence only; issuance = LEDGER RECORD ONLY, never on-chain) |

**Suite verdict after this cycle (unchanged):** deterministic layers **237/243** (six stale Layer-8 assertions) + Layer-7 **7/7** (carried) = **FAIL (244/250)** — the six exact proposed diffs are now PRESENTED CONSOLIDATED and verified byte-exact for the current tree (`evidence/layer8-d13-26-consolidated-proposed-diff-mandate007.md`) and remain **NOT APPLIED pending the D-13.26 owner/validator review**. The two prototype end-to-end suites (rows 11–12) are **non-production evidence only**: they demonstrate the mandated behaviors in a prototype environment and advance no gate, confer no production capability claim, and do not alter the canonical verdict. A FAIL is reported as a FAIL; a prototype PASS is reported as exactly what it is.

**Posture line: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

## 6. Fresh battery — D-13.26 APPLICATION cycle (MANDATE-008, 2026-10-23; exact commands, exit codes recorded)

**Trigger:** the owner directive of 23 October 2026 (`owner-directive-2026-10-23-delegated-execution.md` — "make all fixing … needed") approved the D-13.26 review gate for the six Layer-8 re-pins. **Application:** the six corrections (carried by five machine-verified blocks, F4+5 combined) were applied VERBATIM to `src/lib/mtq/__tests__/canonical-invariants.ts` from `evidence/layer8-d13-26-consolidated-proposed-diff-mandate007.md` — mechanical application, zero manual transcription: 30 lines removed, 108 added, 23 context kept, nothing else in the file touched. Pre-application exactness re-verified fresh: `evidence/extract-and-verify-layer8-diffs.ts` → **exit 0** (all removed/context lines byte-exact against the current tree). Full application record: `layer8-six-failures-adjudication.md` §"APPLICATION RECORD (2026-10-23)". The three new invariant-coverage assertions (C.1 end-to-end sandwich · §21.5.2 12h detector boundary · §21.5.2 oscillation reset) are live.

| # | Check | Command | Result (exit) | Evidence status |
|---|---|---|---|---|
| 1 | Proposed-diff exactness vs current tree (pre-application) | `bun audit-work/task13/evidence/extract-and-verify-layer8-diffs.ts` | **exit 0** — six findings EXACT (30/30 removed, 23/23 context lines byte-exact); artifacts regenerated with fresh timestamp (`evidence/layer8-d13-26-consolidated-proposed-diff-mandate007.md` + JSON — content byte-identical to the MANDATE-007 presentation modulo the generation timestamp) | VERIFIED |
| 2 | Canonical — focused Layer 8 (post-application) | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=8` | **94/94 pass, 0 fail, exit 0** (was 85/91, 6 fail) — the six corrected assertions pass (C.1 inclusive ≤; C.3 β=0.86 → $5,160; RG-10 legacy vector +$5/+$15; RG-10 active reject +$5.70; reason contract; §21.5.2 reset) + the three NEW assertions pass; log `evidence/l8-focused-mandate008-2026-10-23.txt` | VERIFIED |
| 3 | Canonical — deterministic Layers 1-6+8 (post-application) | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=1,2,3,4,5,6,8` | L1 41/41 · L2 42/42 · L3 25/25 · L4 12/12 · L5 29/29 · L6 3/3 · L8 94/94 → **246/246 pass, 0 fail, exit 0** (was 237/243, 6 fail; 152 unchanged L1-6 assertions all green); log `evidence/l-deterministic-mandate008-2026-10-23.txt` | VERIFIED |
| 4 | Layer 7 | carried (Layer-7 assertion/scenario bodies and all engine code untouched by the application — test-file Layer-8 hunks only) | S5 PASS · S6 PASS · S3 42.5% via 5×40 chunks + exact-cover merge — §2.2 record stands, **7/7** | CARRIED (valid carry: engine + Layer-7 scenario code byte-identical) |
| 5 | Layer-8 post-correction fixture values (read-only, outside the suite) | `bun audit-work/task13/evidence/l8-d13-26-fixture-verification.ts` | **exit 0** — Parts 1-5 re-confirmed fresh (C.1 inclusive + sandwich; C.3 β-form to the last digit; RG-10 +$5/+$15 legacy vector; active-path reject +$5.70 with branch-reach proof; §21.5.2 reset/boundary/oscillation); JSON record byte-identical to the MANDATE-005 record modulo timestamp; the informational FP-exactness probe line prints ✗ (5/5) — pre-existing, identical to MANDATE-005/007 records, a probe not an assertion; log `evidence/l8-fixture-verification-mandate008-2026-10-23.txt` | VERIFIED |
| 6 | Typecheck | `bun run typecheck` | **PASS (0)** | VERIFIED |
| 7 | Lint | `bun run lint` | **PASS (0)** | VERIFIED |

**Suite verdict after this cycle (supersedes the §5 FAIL verdict — history preserved above):** deterministic Layers 1-6+8 **246/246 PASS** (fresh, exit 0) + Layer-7 **7/7 PASS** (carried) = **253/253 PASS** — the first citable green canonical-suite record since the six-failure finding, achieved by owner-approved re-pins of six obsolete test expectations (no assertion weakened: three more-conservative, one stronger, two identical-intent; +3 new invariant-coverage assertions; suite total 250 → 253). **No gate is advanced by this green result** (standing rule): code-quality evidence only — OD-2 (ε $10 vs 1% margin), β₁/β₂ Risk-Council publication (§11.10), the §12.7 gas basis (Appendix-F P0-3), D-13.25 pre-registration, validator independence, and all RELEASE-GRANTS remain open owner/validation-program items. Passing tests never excuse the standing security blockers (R-1/C-045-b, OWNER-ATT-1, custody, history contamination).

**Posture line: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

## 7. Fresh battery — M8-3 IMPLEMENTATION cycle (engine promotion + production runner, 2026-10-23; exact commands, exit codes recorded)

**Trigger:** the same owner directive of 23 October 2026 (delegated execution). **Scope:** completion of the interrupted M8-3a/M8-3b promotion (the validated MANDATE-007 prototypes ported into the production TS reference engine — src/lib/mtq/constituency/ and src/lib/mtq/issuance/, Prisma IssuanceEvent durability mirror; committed in 0e8a19d) by the M8-3c cycle: the deterministic production runner (the "M8-3b production runner's SEP assertions" referenced by separation-check.ts / instrument-registry.ts — previously missing, now built as src/lib/mtq/__tests__/issuance-production-e2e.ts) and the Pilot Command Center surfaces (Issuance Lab section + /api/issuance + /api/constituency). All runs below were executed fresh at the final tree state by the orchestrator after the two parallel M8-3c workstreams merged.

| # | Check | Command | Result (exit) | Evidence status |
|---|---|---|---|---|
| 1 | Issuance production end-to-end (promoted engine, run 1) | `bun src/lib/mtq/__tests__/issuance-production-e2e.ts` | **225/225 pass, 0 fail, exit 0** (14 sections S0–S13 + INV sweep: registry honesty/fail-closed admission; exact §14.4 happy-path numbers incl. INV-A..E assertInvariants after each of the 12 phases; duplicates/replays/idempotency; delayed-finality EXPIRED_QUOTE + PENDING_REFUND→REFUNDED; failed payment; both reversal paths + authorized remediation loop; full ALT-4 battery (no-program refusal, revocation mid-flight, attestation mismatch suspension + authorized resume); ten invalid-input terminals with taxonomies; all three supply caps fail-closed; three-book C1–C4 + two forced 1-micro break detections; **SEP-01** — basket snapshot byte-identical across 16,733.250000 issuance volume + source-scan (no issuance data-path module imports any weighting/eligibility module); persistence battery (exact Prisma IssuanceEvent field set incl. read-only schema cross-check, disclosed failing sink, cursor-not-advanced, byte-stable retry); CBDC SIMULATED/NOT-CONNECTED honesty + one labeled SIMULATION-MODE demo (issued 2,497.500000); genesis-7 quiescence + empty-directive lifecycle run (0 transitions)); evidence `evidence/issuance-production-mandate008-2026-10-23.txt` + `evidence/issuance-production-results-mandate008.json` | VERIFIED (engine-level pilot — issuance = LEDGER RECORD ONLY, never on-chain; NOT a production capability claim) |
| 2 | Issuance production end-to-end (run 2 — determinism) | same | **225/225 pass, 0 fail, exit 0** — stdout byte-identical modulo the run banner (banner-stripped md5 identical: `e6c2edf672a2806a4c17f1bb792e55a3`); a third orchestrator confirmation run also 225/225, exit 0 | VERIFIED (deterministic) |
| 3 | Canonical — focused Layer 8 (re-confirmed at final tree) | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=8` | **94/94 pass, 0 fail, exit 0** | VERIFIED |
| 4 | Canonical — deterministic Layers 1-6+8 (re-confirmed at final tree) | `bun src/lib/mtq/__tests__/canonical-invariants.ts --layers=1,2,3,4,5,6,8` | **246/246 pass, 0 fail, exit 0** | VERIFIED |
| 5 | Layer 7 | carried (engine + Layer-7 scenario code untouched by the M8-3 cycle — the promotion modules are NEW files; no existing engine file's logic changed) | **7/7** (§2.2 record stands) | CARRIED |
| 6 | Typecheck (final tree) | `bun run typecheck` | **PASS (0 errors)** | VERIFIED |
| 7 | Lint (final tree) | `bun run lint` | **PASS (0 findings)** | VERIFIED |
| 8 | Full bun test (final tree) | `bun test` | **37/37 pass, 0 fail, exit 0** | VERIFIED |
| 9 | API smoke (browser-independent, fresh) | `GET /api/issuance` · `POST /api/issuance` ×8 scenarios · `GET /api/constituency` | all **200**; every scenario `expectedNumbersMet: true` (happy-path 10,000.000000→fee 10.000000→net 9,990.000000→issued 4,995.000000 @ 2.000000, supply 4,995.000000, C1–C4 balanced; duplicate→DUPLICATE; delayed→EXPIRED_QUOTE+refund; failed→PAYMENT_FAILED+refund; reversal-pre→CANCELLED+refund; reversal-post→RECONCILIATION_BREAK+suspension; unauthorized→UNAUTHORIZED; cbdc-simulated→RECONCILED SIMULATION MODE); two identical happy-path runs byte-identical; persistence confirmed (IssuanceEvent rows grew on subsequent GET); unknown scenario → 400 | VERIFIED (deterministic demos on TEST-ONLY synthetic fixtures) |

**Suite verdict after this cycle:** canonical **253/253 PASS** stands (246/246 deterministic fresh + Layer-7 7/7 carried — re-confirmed at the final tree); the issuance production runner adds **225/225 × 2 (exit 0, deterministic)** as engine-level pilot evidence; the constituency machinery is exercised inside that runner (genesis-7 quiescence, empty-directive run) and surfaced read-only via /api/constituency. **No gate is advanced** (standing rule): all economic parameters remain UNAPPROVED/ILLUSTRATIVE (D-13.8 fee value, §14.5 quote derivation, D-13.19 bands, D-13.6 caps), D-13.27 remains PENDING OWNER RATIFICATION, no real instrument is registered anywhere, CBDC stays SIMULATED / NOT CONNECTED, and the contract layer is untouched.

**Engine observations recorded honestly (none is a safety/honesty violation; no engine file was modified):** (a) post-issuance reversal leaves the payment book REVERSED_POST_ISSUANCE so C3 permanently fails and `resolveReconciliationBreak` correctly refuses forever — fail-closed/honest by design, but the pilot exposes no authorized act that can re-balance a reversed entry (post-issuance reversal is an effectively unrecoverable suspension; successful remediation demonstrated only on the correctable forced-break path); (b) two cosmetic ledger doc-comment nits (kind comment lists FAILURE/omits TRANSITION_REJECT; duplicate-idempotency-key events classify as kind PAYMENT); (c) same-requestId resubmission returns REQUEST_REPLAY_DETECTED with the original outcome (spec §6.4-conformant) while DUPLICATE terminal fires for a NEW requestId under an existing idempotency key.

**Posture line: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
