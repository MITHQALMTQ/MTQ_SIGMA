# T01-T88-RECONCILIATION — Full-Stack Integration Reconciliation Report (T-80)

| | |
|---|---|
| **Mandate ref** | Test Matrix **T-80** — "Full-stack integration — T-01..T-79 pass; deployment register; reconciliation report" (Ext-2 Part N consolidated by Ext-3 Part G: "All 88 tests (T-01 through T-88) must pass or have documented accepted risk.") |
| **Compiled** | 2026-10-19 (UTC), Ext-3 closure task 3-d |
| **Register source** | `src/lib/mtq/mandate-register.ts` — **all 88 statuses below are read VERBATIM from the register; nothing was renumbered or re-statused by this report.** Register status changes are the orchestrator's to fold in afterward. |
| **Companion** | `docs/DEPLOYMENT-RECORD.md` (OD-36 — the "deployment register" half of T-80's expected result) |
| **Method** | Each register row gets a one-line evidence pointer: the runnable suite + check name (canonical-invariants.ts Layers 1–8, mandate-vectors.ts vectors, e2e/stress/backtest/retention suites), the implementing code location, or the honest remainder ("requires live chain / Committee"). Suite evidence was re-run fresh for this report (§1). |

---

## §1 Suite-run results (fresh run, 2026-10-19 15:38–15:40 UTC, sandbox, dev server + keeper live, no test code written)

| # | Command | Exit | Count | Duration |
|---|---|---|---|---|
| 1 | `bun run src/lib/mtq/__tests__/canonical-invariants.ts` | 0 | **250/250 pass, 0 fail** (L1 41 · L2 42 · L3 25 · L4 12 · L5 29 · L6 3 · L7 7 · L8 91) | 0.757 s |
| 2 | `bun run src/lib/mtq/__tests__/mandate-vectors.ts` | 0 | **66 passed, 0 failed** | 0.101 s |
| 3 | `bun run src/lib/mtq/__tests__/e2e-integration.ts` | 0 | **26/26 checks passed, 0 failed** | 1.020 s |
| 4 | `bun run src/lib/mtq/__tests__/stress-rerun.ts` | 0 | **11/11 scenarios pass, 0 fail** | 3.467 s |
| 5 | `bun run src/lib/mtq/__tests__/historical-backtest.ts` | 0 | **PASS — 5/5 Layer 6 invariants held across 2,562 trading days** | 2.687 s |
| 6 | `bun run src/lib/mtq/__tests__/audit-retention-test.ts` | 0 | **TEST PASSED** (10,000-row cap enforced; 4,410 rows pruned; live state restored) | 3.115 s |
| 7 | `bunx tsc --noEmit` | 0 | 0 errors | 3.426 s |
| 8 | `bun run lint` | **1** | **2 errors, 0 warnings — VERBATIM:** `contracts/out-v3/eip712-verify.cjs:1:14 — @typescript-eslint/no-require-imports`; `scripts/verify-safe.ts:898:10 — @typescript-eslint/no-require-imports` (both are untracked Ext-3-session artifacts: 3-b's EIP-712 verify utility and 3-a's read-only verification script; not fixed per task boundary — resolution is the orchestrator's) | 18.987 s |

Not runnable in this sandbox: `contracts/MTQSigmaV2.t.sol` + `contracts/test/MTQSigmaV3.t.sol` (Foundry suites — no `forge` binary); their September 2026 JS-mirror stand-in is recorded at `src/lib/mtq/onchain-test-results.json`.

---

## §2 Evidence mapping — T-01 … T-88 (one line per register row; statuses verbatim)

Abbreviations: **CI** = canonical-invariants.ts (Layer·check name) · **MV** = mandate-vectors.ts (vector label) · **E2E** = e2e-integration.ts (step) · **SR** = stress-rerun.ts · **HB** = historical-backtest.ts · **ART** = audit-retention-test.ts.

| Test | Status (register, verbatim) | Evidence — where it lives |
|---|---|---|
| **T-01** Buy underweight asset | implemented+unit-tested | MV "C-1 vector obs=0.25 tgt=0.30" (buy underweight: post −0.02, I(q)=+0.03, eligible=true) + mandate.ts C1_TEST_VECTORS |
| **T-02** Sell overweight asset | implemented+unit-tested | MV "C-1 vector obs=0.35 tgt=0.30" (sell overweight: post +0.02, I(q)=+0.03, eligible=true) |
| **T-03** Wrong-direction trade | implemented+unit-tested | MV "C-1 negative improvement preserved (T-03)" + wrong-direction case (post +0.08, I(q)=−0.03, ineligible) + mandate.ts isEligibleForNormalMode |
| **T-04** Overshoot that worsens deviation | implemented+unit-tested | MV C-1 cases T-04a (no trade → I=0, ineligible) / T-04b (overshoot → imp −0.01, ineligible; C-012/C-040 resolutions) |
| **T-05** Exact-input and exact-output routes | implemented | engine.ts DEFAULT_SLIPPAGE guards (register codeRef); enforced live by CI L8 "§19.4.1: mint with minOutMtq just above the expected minted → ok=false" + "§19.4.2: redeem with declared minOutUsd > the computed net value → ok=false" |
| **T-06** USDC 6-decimal round-trip | implemented+unit-tested | MV "T-05 USDC 6d exact round-trip" + "T-07 100 USDC round-trip" (Listing C-2 block — suite labels follow the v5.0 document numbering, see §4 discrepancy D-3) + mandate.ts TOKEN_SCALE_VECTORS |
| **T-07** PAXG 18-decimal round-trip | implemented+unit-tested | MV "T-06 PAXG 18d unchanged" (to18Exact/from18Exact identity) + mandate.ts TOKEN_SCALE_VECTORS |
| **T-08** Precision-loss conversion | implemented+unit-tested | MV "T-08 precision-loss dust rejected" + "T-08b >18 decimals rejected" + mandate.ts from18Exact (PrecisionLoss, C-014) |
| **T-09** Gas: 150k × 30 gwei × $3,000 | implemented+unit-tested | MV "T-09 gas $13.50" (gasCostEstimate full-precision mulDiv; C-008) |
| **T-10** Gas: 300k × 100 gwei × $1,500 | implemented+unit-tested | MV "T-10 gas $45.00" + mandate.ts GAS_VECTORS |
| **T-11** Fresh route quote + fresh oracle | implemented+unit-tested | MV T-11a–d (net = 0.05 per the §3.6 FORMULA — document discrepancy D-1; strict ε inequality; negative net/gross rejected) + mandate.ts runMarpPipeline step gates |
| **T-12** Stale executable quote | implemented | mandate.ts pipeline step 7 (register codeRef); CI L8 "§19.7: mint with an expired quote → ok=false, reason cites the §19.7 deadline, no supply mutation" |
| **T-13** Fresh quote but stale oracle | implemented | mandate.ts pipeline step 9; staleness enforcement by CI L2/L5 strict-I9 rows ("Oracle: 1 valid feed → paused") |
| **T-14** Adverse movement quote→inclusion | implemented | engine.ts slippage guards; CI L8 "§19.4.2: the failed redemption mutates NOTHING" (hard bound enforced, revert) |
| **T-15** Order exceeds pool depth / cap | implemented | marp.ts Level 6 (register codeRef); CI L2 "MARP: Level 7 turnover cap (5% NAV) defers the excess on the executing Level-8 decision" |
| **T-16** Quote-embedded fee | implemented | mandate.ts CostItem.quoteEmbedded; exercised by CI L8 C.4 cost vector ("benefit = $1,200 and cost = $1,700") |
| **T-17** Fee outside quote | implemented | mandate.ts totalIncrementalCost (added exactly once); CI L8 RG-10 rows (ε applied to full net incl. costs) |
| **T-18** Partial fill | implemented | marp.ts deferredUsd residual; CI L8 C.3 residual rows ("residualGapUsd ≈ −0.6%×NAV" recomputed on current state) |
| **T-19** Reverted transaction | implemented | mandate.ts finalityState; CI L8 "§19.4.2: the failed redemption mutates NOTHING (totalSupply, circulating supply and flow ledger unchanged)" |
| **T-20** Oracle-source disagreement | implemented | oracle.ts consensus + mandate.ts health (register codeRef); CI L2 truth table (median(3)/2-feed strict pause/override average) + L5 "deviation > 2.5% → spiked feed discarded" |
| **T-21** Estimated vs realized costs | implemented | engine.ts execCostLedger; CI L8 "§20.4: execCostLedger.feesUsd records the same fee (the §9.5 cost effect feeds attribution)" |
| **T-22** Quote-age boundary | implemented | mandate.ts INV-12 (register codeRef; hard boundary in checkInvariants — quoteAgeMs vs quoteMaxAgeMs); CI L8 §19.7 expired-quote row |
| **T-23** Decision-to-submission delay | implemented | mandate.ts clocks.decisionToSubmissionDelay (five-clock module with per-clock failure policies, C-009) |
| **T-24** Submission-to-execution delay | implemented | mandate.ts clocks.submissionToExecutionDelay (delay protection + hard bounds) |
| **T-25** Settlement/finality delay | implemented | mandate.ts clocks.settlementFinalityDelay + finalityState (pending/final/reverted handling) |
| **T-26** Wrong quote asset/side/amount semantics | implemented | mandate.ts TypedPrice.amountSemantics (pipeline quote validation) |
| **T-27** Invalid/manipulated route response | implemented | mandate.ts pipeline quote validation (register codeRef; rejected by validation + authorization) |
| **T-28** Overflow / signed-arithmetic boundaries | implemented+unit-tested | mandate.ts SignedOverflowError (int256.min guard — no wraparound); exercised via runMandateSelfTests() 23-vector module self-test (MV: "runMandateSelfTests all pass (23 vectors)") |
| **T-29** Fee-on-transfer / nonstandard token | implemented | Ext-1 A.2 pattern in contracts/MTQSigmaV3.sol (safely rejected unless approved) |
| **T-30** Emergency mode | implemented | state-machine.ts EMERGENCY (only pre-approved risk-reducing actions; mint+redeem paused); CI L1 "Policy: mintingAllowed(STRESS)=false" + "redemptionAllowed(EMERGENCY)=false" + E2E Step 9 (stress mint ok=false, throttle 0, STRESS reason) |
| **T-31** Unauthorized keeper / invalid signature | implemented | mandate.ts authorizedSigners + EIP-712 digest (register codeRef); MV "T-51 keeper==submitter rejected" (separation of duties) |
| **T-32** Parameter/model version mismatch | implemented+unit-tested | MV "T-50 matching versions accepted" + "T-50 stale parameter set rejected" (validateDecisionVersions quarantine) |
| **T-33** Wrong target/parameter chain | implemented | mandate.ts EIP-712 chainId domain (cross-chain replay impossible — digest binds block.chainid) |
| **T-34** Pause and kill switch | implemented | state-machine pausing + mandate HALTED; CI L8 "§17.8: feed age 125s > 2×60s staleness → feedState 'HALTED'" + E2E oracle-pause path (zero-price board → anyPaused=true) |
| **T-35** Role rotation | implemented | ROLE_ROTATION.md §5.2 nine-step procedure + scripts/audit-fix-roles.ts rehearsal (register codeRef); HONEST: live rotation BLOCKED per ROLE_ROTATION.md §8 (OD-35 1/1 Safe finding + C-041 canonical-token declaration pending) — final-assignment verification is on-chain-pending, not yet produced |
| **T-36** Residual after failed/partial execution | implemented | marp.ts deferredUsd (recomputed with current state + fresh quotes); CI L8 C.3 recompute rows |
| **T-37** Netting of opposing flows | implemented | marp.ts netNaturalFlow; CI L8 "C.3: netNaturalFlow(−1.5%×NAV, +0.9%×NAV) → residual −0.6%×NAV, netted +0.9%×NAV" + direction-rule rows |
| **T-38** Reserve-solvency boundary | implemented | mandate.ts INV-1 (register codeRef); CI L7 "S5/S6 worst min RR ≥ 1.00 (RR_HARD)" + HB INV-1 (min RR 1.076006, failing ticks 0 across 2,562 days) |
| **T-39** Oracle fallback | implemented | mandate.ts gasCostWithFallback (recorded-fallback policy) + oracle.ts degraded mode; CI L2 "2 valid feeds + override → average method (degraded)" |
| **T-40** Decision replay | implemented+unit-tested | MV "T-50 replay rejected" (DecisionReplayRegistry.consume one-shot) + mandate.ts EIP-712 digest registry |
| **T-41** Reentrancy via malicious token | implemented | contracts/MTQSigmaV3.sol inline ReentrancyGuard (nonReentrant on mint/redeem/executeRebalance — H1/H2); CI L5 CONTRACT AUDIT VECTOR row flags the on-chain audit duty ("contract audit must verify reentrancy guard in mint() and redeem() (ERC-777 hooks)") |
| **T-42** USDT-style approve / FOT / residual allowance | implemented | Ext-1 A.2 pattern in contracts (approve reset; FOT rejected; no residual) — MTQSigmaV3.sol |
| **T-43** Multi-leg swap: leg-2 failure | implemented | Ext-1 A.3 in-flight policy (single-tx atomic multi-hop preferred; held with follow-up deadline; C-019) |
| **T-44** Dust below minimum notional | implemented+unit-tested | mandate.ts minNotionalCheck ($100 min + 0.1%-of-NAV dust escalation); exercised via runMandateSelfTests() module vectors (MV asserts all 23 pass); CI L5 "mint $1 → rejected by MIN_MINT = 1 MTQ (§19.7, constitutional)" row is the constitutional 1-MTQ floor — distinct guard, both implemented |
| **T-45** 1% slippage on 6d and 18d tokens | implemented+unit-tested | MV T-45a ("1% on 1M USDC(6d) = 990,000") + T-45b ("1% on 1 PAXG(18d) = 0.99") + T-45c (0-decimal rejection) — computeMinOut in native output decimals (C-020) |
| **T-46** Rescue stuck tokens | implemented | Ext-1 A.6 rescueToken contract-side spec (Safe-only + timelock; reserve assets excluded; allowlist enforced; OD-20) |
| **T-47** Oracle health escalation | implemented+unit-tested | MV T-47 block (all fresh → HEALTHY; one stale → WARNING ×1.5 protection; two stale → DEGRADED suspend; all >2× stale → HALTED pause) |
| **T-48** Aggregator failover | implemented | Ext-1 B.2 / OD-17 spec in mandate.ts (one failover per decision; both quotes logged; better-quote policy; AggregatorUnavailable rejection) |
| **T-49** Selective pause | implemented | engine.ts eject/peg pause paths; CI L8 §21.5.3 pause-rule rows + L5 paused-feed rows (only the paused asset's trades rejected) |
| **T-50** EIP-712 signed decisions | implemented+unit-tested | MV T-50 rows (replay rejected; matching versions accepted; stale parameter set rejected) + mandate.ts tradeDecisionDigest + DecisionReplayRegistry |
| **T-51** Keeper failover | implemented+unit-tested | MV T-51 rows (valid separation accepted; keeper==submitter rejected; backup activates after 30 min; emergency keeper only in emergency mode) |
| **T-52** Reserve state recomputation | implemented | engine.ts computeSnapshot per tick; CI L3 "Cross: snapshot.RR = computeReserveRatio" + "snapshot.LCR = computeLcr" + "snapshot.chainIndex.I_t === s.chainIndex.I_t (same object)" |
| **T-53** Formal invariants | implemented+unit-tested | MV T-53 rows (RR 0.98 → INV-1 HARD violation; LCR 0.9 → INV-8 SOFT violation; healthy state → no violations) + mandate.ts checkInvariants (INV-1..12, C-022) |
| **T-54** Market hours | implemented | mandate.ts marketHoursAdjustment (PAXG/XAUT London window: protection ×2, size ×0.5; blackout → reject; OD-18) |
| **T-55** Contract initialization | implemented | contracts/MTQSigmaV3.sol one-shot initializers (_disableInitializers posture per Ext-1 E.1) + ROLE_ROTATION.md end-state; HONEST: on the deployed testnets ADMIN is still the deployer EOA (OD-35 finding) — admin-on-Safe is the procedure's target, not current on-chain state |
| **T-56** Deployment ordering | implemented | scripts/deploy-ecosystem.ts dependency-ordered 9-contract sequence (register codeRef); executed 2026-09-06 as rehearsal on 3 testnets — contracts/deployments/*.json (OD-36 §3) |
| **T-57** Upgradeability path | satisfied-by-document | UPGRADEABILITY.md (Option A immutable + 5-step migration; UUPS optional for MARP logic only; 7/7 Constitutional Council + 90-day timelock; Committee approval pending — OD-16) |
| **T-58** Mock environment | implemented | contracts/test/MTQSigmaV3.t.sol + MockUSDC mocks (register codeRef); HONEST: cannot run in sandbox (no forge); compile-verified via the solcjs 0.8.36 pipeline; JS-mirror fuzz results recorded at src/lib/mtq/onchain-test-results.json (2026-09-07) |
| **T-59** Decision replay (deterministic) | implemented+unit-tested | MV "T-50 replay rejected" (deterministic consume) + "T-50 stale parameter set rejected" (tampered decision detected) |
| **T-60** Combined invariants + circuit breaker | implemented | mandate.ts checkOracleHealth + checkInvariants (register codeRef); CI L8 §17.9 correlation-warning rows + §17.8 HALTED row + MV T-47 escalation |
| **T-61** NAV computation | implemented+unit-tested | CI L1 "NAV: NAV_per_MTQ = V_net / S_circ" + L2 haircut rows (USD 0.5% / Gold 1% / EUR 0.7%) + L4 "NAV = gross × (1 − blended haircut)" (Listing E-1) |
| **T-62** RR computation | implemented+unit-tested | CI L1 state-function rows 17–28 (NORMAL/CAUTION/STRESS(new)/STRESS-LCR-binds/DEFENSIVE/EMERGENCY/RECOVERY + 48h confirmation ladder + hysteresis) + state-machine.ts determineState (Listing E-2 three-floor RR) |
| **T-63** LCR computation | implemented+unit-tested | engine.ts computeLcr (stablecoin-only liquid assets, 25% 30-day stress demand, Listing E-3); CI L1 "State: RR=1.20, LCR=0.65 → RECOVERY (§21.2 residual — solvency holds, liquidity fails)" |
| **T-64** Buffer state transitions | implemented+unit-tested | engine.ts updateBufferState; CI L2 "Buffer: RR=1.10 → BASE / 1.06 → STRESS / 1.02 → EMERGENCY" (Listing E-4; 24h ramps) |
| **T-65** First-loss waterfall | implemented+unit-tested | engine.ts applyLoss (line 2751); E2E Steps 7–8 (direct first-loss applied → STRESS; RR invariant held under stress) + SR S10 combined shock (survival 100%) |
| **T-66** Reserve stress scenarios | implemented+unit-tested | SR S1–S11 — **run 2026-10-19: 11/11 pass** (S5 gold +50% survival 100% vs ≥95%; S6 gold −30% 100%; S3 Cauchy 80.4% vs >35.1%; S9 redemption run 100%; S10 combined 100%) |
| **T-67** Daily state vector | implemented+unit-tested | pilot-state.ts DailyStateVector (persisted + hashed, Listing E-6; ART run 2026-10-19 shows 207 live DSV rows, 7y retention) + I11 ("daily calculation does not imply daily trading") via CI L2 no-trade-zone row + L8 C.1 rows |
| **T-68** Asset admission | implemented+unit-tested | registry.ts (8 criteria / 4 states, Listing E-7) + CI L8 §15.6.1/§15.6.2 concentration rows (hardCap 30% constitutional / 35% crisis / per-instrument C_max flags EURC > 30% / CIRCLE breach) |
| **T-69** De-peg and eject | implemented+unit-tested | CI L8 §21.5.3 eject-ladder rows (RR coupling h<24h; stage 3 at RR<1.05; pause rule 5%; in-band decay 2×dtHours immediate stand-down) + §21.5.4 reintegration rows (0.80/24h → 0.85/48h → 0.90/72h reverse ladder; persistence re-measured) — engine.ts updatePegHealth/updateReintegration (Listing E-8) |
| **T-70** Treasury operations | implemented+unit-tested | engine.ts maybeTreasurySweep (line 2733; wired per tick + on every fee accrual, pilot-state.ts:513/645/653) + CI L4 "mint/redeem fee accrues to treasury hot wallet" rows; HONEST: the 4/7-Safe-gated replenishment and 7/7 transfers remain blocked by the OD-35 1/1 Safe finding (gating modeled in blueprint.ts GOVERNANCE_LAYERS) |
| **T-71** MEV protection | implemented+unit-tested | MV T-71 rows (wrong mode rejected; commit accepted; double commit rejected; early reveal rejected; valid reveal accepted; reveal replay rejected; mismatched reveal rejected) + mandate.ts CommitRevealRegistry (Listing E-10) |
| **T-72** Token edge cases | implemented | registry.ts review loop (paused → out of LCR, kept in NAV at discount; blacklist → auto-pause + escalate; codehash change → WATCH) per Ext-2 H.1–H.4 |
| **T-73** Log retention | implemented+unit-tested | **ART run 2026-10-19: TEST PASSED** (10,000-row cap enforced; 5 prune iterations deleted 4,410; immutable append + retention 10y decisions/7y vectors/3y oracles; live state restored to 2,410 rows; OD-21) |
| **T-74** Emergency response | implemented | audit-work governance deliverables (DELIVERABLE-E-governance-enforcement.md: P1–P4 classifications, escalation matrix, 7 runbooks; OD-22) |
| **T-75** Combined system shadow | shadow-observed | pilot-state tick + marp.ts mandate shadow records — every Level-4 candidate carries a signedImprovement/directionEligible/shadowOnly record; MV "T-81 shadow-only until OD-1/OD-2 approve" (economic eligibility DISABLED pending OD-1/OD-2 — shadow, not acceptance) |
| **T-76** Oracle health → reserve → eject cascade | implemented | engine peg/eject under oracle gating; CI L8 §21.5.3 pause-rule × oracle-state rows + §17.8 HALTED feed-state rows + MV T-47 (degradation interacts with the ladder, never bypasses it) |
| **T-77** Rollback | implemented | UPGRADEABILITY.md migration plan (Option A path preserves state across migration; other paths not accidentally enabled) |
| **T-78** Emergency Council authority | implemented | blueprint.ts GOVERNANCE_LAYERS (Emergency Council 4/7-gated actions modeled; TIMELOCK_EMERGENCY=0 in PARAMETER_REGISTRY); HONEST: live 4/7 Emergency Council not constituted (OD-3) and the only Safe is 1/1 (OD-35) |
| **T-79** Governance parameter change | implemented+unit-tested | blueprint.ts PARAMETER_REGISTRY + CI L3 ownership rows ("PAR owned by CONSTITUTIONAL (immutable)"; "RR_TARGET owned by MONETARY (with envelope)"; "HAIRCUTS owned by RISK"; "PAUSE_MINT owned by EMERGENCY"; "unknown parameter → null") + CI L5 "RR_TARGET has an envelope (cannot set outside [1.05, 1.20])" |
| **T-80** Full-stack integration | **not-demonstrated** (register-verbatim at compilation time) | **THIS REPORT** (the reconciliation-report component) + **docs/DEPLOYMENT-RECORD.md** (the deployment-register component) + §1 suite table (the T-01..T-79 reference-layer component); the FULL-GATE-RUN component (live on-chain gate execution + Committee sign-off) remains not-demonstrated — requires live chain / Committee. Status label is the orchestrator's to fold. |
| **T-81** MASE weights → MARP targets | implemented+unit-tested | MV T-81 block (8-term §7.4 objective; λ placeholder sums to 1; softmax e^(−η·Score) direction — lower score → higher α; α sums to 1; leakage-controlled walk-forward OOS; MARP decisions carry the shadow record; C-036 J(s) ≠ MASE-objective separation) |
| **T-82** Mint flow | implemented+unit-tested | engine.ts applyMint (X_net/P_MTQ, fee to wallet, state update — OD-32); CI L1 "Mint: MTQ_minted = X_net / P_MTQ × throttle" + "Mint: fee_usd = X × MINT_FEE_BPS/10000" + L2 throttle rows (NORMAL 1.0 / CAUTION 0.5 / STRESS paused / EMERGENCY paused) + E2E Steps 1–5 |
| **T-83** Redeem flow (full basket) | implemented+unit-tested | engine.ts applyRedeem (burn, proportional basket release, fee, state update); CI L1 "Redeem: grossUsd = Y × NAV_t (I6 + §19.3.2, not P_MTQ)" + L3 "Cross: redeem grossUsd = Y × NAV_t" + L5 B9 full-circ redemption rows (no holding ever negative; Σ released = netUsd) + E2E Step 6 |
| **T-84** Redeem flow (single asset) | implemented | RedeemSimulator single-asset option (router converts; minAmountOut enforced) — register codeRef |
| **T-85** Genesis event | implemented+unit-tested | MV T-85 rows (7 steps complete; INDEX_BASE_DENOMINATOR = 1.0000; seven-component basket; 1M MTQ to GENESIS_RESERVE_SAFE; GenesisVerification + GenesisCompleted events; verifyIndexBase rejects a bad fixing [supersedes verifyGFBBase]; genesis aborts on invalid fixings) — genesis.ts executeGenesisSequence (OD-33) + contracts/MTQSigmaV3.sol on-chain `verifyIndexBase()` view (added post-suite; compiled solcjs 0.8.36 zero errors, +89 B runtime — redeployment pending, so no unit-test row yet) |
| **T-86** Oracle feed configuration | implemented+unit-tested | oracle.ts consensus board + oracle-feeds.ts per-chain feed registry (OD-34) + CI L2/L5 truth-table rows (median(3)/average(2) override/paused(<2) strict I9; deviation 2.5% breaker; §17.8 staleness classes 60s/120s; §17.9 correlation registry) |
| **T-87** Safe configuration check | **demonstrated-failed** | audit-work/v5/SAFE-VERIFICATION.md §2/§3 (+ safe-verification.json machine evidence): live read-only reads on BOTH chains 2026-10-19 (Monad block 72,421,819 / Arc block 68,031,046) — threshold=1, owners=[deployer EOA 0x3C39…8d8c], VERSION "1.4.1", nonce=0, modules=0, guard=address(0): **expected 4/7 NOT MET** (OD-35 VERIFIED-FAILED critical finding; Gate 5 blocked; re-run scripts/verify-safe.ts after reconfiguration) |
| **T-88** MTQ token standard | implemented | contracts/MTQSigmaV3.sol §1.b (EIP-2612 permit + ERC-20 Votes checkpoint delegation inline, IERC-5805/IERC-6372) + contracts/TOKEN-STANDARD.md (solcjs 0.8.36, zero errors; storage layout preserved — 4 appended slots; EIP-170 FLAG: runtime 40,500 B > 24,576 after the +89 B Ext-3 A.3 verifyIndexBase() view; EIP-712 digests verified vs ethers reference; NOT deployed, NOT audited, no Foundry tests yet) — register codeRef |

---

## §3 Rollup cross-check (registerRollups(), executed 2026-10-19)

```
$ bun -e "const m = await import('./src/lib/mtq/mandate-register.ts'); console.log(JSON.stringify(m.registerRollups(), null, 1))"
{
 "odTotal": 38,
 "odOpen": 7,
 "odByStatus": { "OPEN": 7, "IMPLEMENTED-PENDING-APPROVAL": 8, "implemented": 15,
                "deferred-G7": 2, "deferred-G5": 2, "SATISFIED-BY-DOCUMENT": 3, "VERIFIED-FAILED": 1 },
 "conflictsTotal": 42,
 "conflictsResolvedByCode": 42,
 "testsTotal": 88,
 "testsUnitTested": 37,
 "testsImplemented": 47,
 "testsShadow": 1,
 "testsNotDemonstrated": 1,
 "testsDemonstratedFailed": 1,
 "testsDeferred": 1,
 "testByStatus": { "implemented+unit-tested": 37, "implemented": 47, "satisfied-by-document": 1,
                   "shadow-observed": 1, "not-demonstrated": 1, "demonstrated-failed": 1 }
}
```

**Independent row-tally from this reconciliation (§2, counted by hand from the verbatim register):**

| Status | Register rollup | §2 tally | Match |
|---|---|---|---|
| implemented+unit-tested | 37 | 37 | ✓ |
| implemented | 47 | 47 | ✓ |
| satisfied-by-document (T-57) | 1 | 1 | ✓ |
| shadow-observed (T-75) | 1 | 1 | ✓ |
| not-demonstrated (T-80) | 1 | 1 | ✓ |
| demonstrated-failed (T-87) | 1 | 1 | ✓ |
| **Total** | **88** | **88** | ✓ |

**No discrepancy** between the reconciliation tally and `registerRollups()` — the 88 rows in §2 are exactly the register's 88 rows, unmodified. (For context, the OD rollups: 7 OPEN / 8 implemented-pending-approval / 15 implemented / 2+2 deferred-G5/G7 / 3 satisfied-by-document / 1 VERIFIED-FAILED — the register has already folded the 3-a OD-35 evidence; conflicts C-001..C-042, all 42 with codeRef.)

### Honest summary reading

- **37 of 88 rows are unit-tested** with fresh 2026-10-19 passing runs (canonical-invariants 250/250, mandate-vectors 66/66, e2e 26/26, stress 11/11, backtest PASS, retention PASS).
- **47 rows are implemented** in the reference layer with code evidence but no dedicated frozen test vector (their behavior is indirectly exercised by the suites above; per-file/line pointers in §2).
- **1 row is satisfied-by-document** (T-57 upgradeability — Committee approval pending).
- **1 row is shadow-observed** (T-75 combined system — runs in shadow mode with economic eligibility disabled pending OD-1/OD-2).
- **1 row is demonstrated-FAILED with live-chain evidence** (T-87 — the demonstration ran and produced a negative result: the Safe is 1/1, not 4/7; this is the project's most important honest status and blocks Gate 5).
- **1 row is not-demonstrated** (T-80 — this report closes its reconciliation-report and deployment-register components at reference-layer scope; the full gate run remains not-demonstrated).

---

## §4 Discrepancies observed during reconciliation (recorded, NOT fixed — register/docs are the orchestrator's to edit)

1. **D-1 (suite count)**: the task brief expected ~248 canonical-invariant checks; the observed suite reports **250/250** (Layer 8 grew to 91 rows in the audit-fix suite). Recorded as observed; not a register discrepancy.
2. **D-2 (stale OD-36 register note)**: mandate-register.ts OD-36 still says "Local repo single-commit fb6bb6c"; observed HEAD is `c6ec946afcebf641ca62c6018d54d6bd348f08c8` (multi-commit history, branch `main`, no remote). The corrected facts are in docs/DEPLOYMENT-RECORD.md §1.
3. **D-3 (T-05..T-08 numbering divergence)**: the v5.0 document's own test matrix (which mandate-vectors.ts follows: "T-05..T-08 — Listing C-2 checked token scaling") numbers the decimal round-trips T-05..T-08, while the consolidated Ext-3 register assigns T-05 to "Exact-input and exact-output routes" and shifts the round-trips to T-06..T-08. Evidence for both assignments exists (§2 rows T-05 through T-08); recorded so nobody mis-cites the vector labels.
4. **D-4 (lint regression from session artifacts)**: `bun run lint` exits 1 on `scripts/verify-safe.ts:898` and `contracts/out-v3/eip712-verify.cjs:1` (`no-require-imports`). Both files are untracked Ext-3-session artifacts; the repo linted clean at the c6ec946 baseline. Not fixed per task boundary; recommended fix is an import-style change or eslint file-scoped override (orchestrator/project-owner action).
5. **D-5 (register-vs-reality, already folded)**: OD-34's note says Robinhood's Oracle.sol is "unprobed" while Monad/Arc oracles are code-verified-present — matching the actual probe coverage in safe-verification.json (19 probes, Monad+Arc only). Consistent; no action.

---

## §5 Honest scope statement (what this reconciliation does and does NOT certify)

**This reconciliation covers the REFERENCE LAYER ONLY**: the TypeScript simulation engine (`src/lib/mtq/*`), the consolidated registers (`mandate-register.ts`), the compiled-but-undeployed V3 Solidity sources (`contracts/MTQSigmaV3.sol` + solcjs pipeline), and the documentation/evidence set (`docs/`, `audit-work/`, `contracts/deployments/`).

It is **NOT a full gate run**:

- **No on-chain gate execution** — no testnet transaction was broadcast by this task; the only live-chain reads on record are the read-only OD-35 verification (2026-10-19) and the September 2026 invariant reads. The corrected execution layer runs in SHADOW MODE (economic eligibility disabled pending OD-1/OD-2).
- **No Committee approvals** — the Committee is not constituted (OD-3); OD-4/OD-12/OD-13/OD-14/OD-18/OD-19/OD-24/OD-31 remain IMPLEMENTED-PENDING-APPROVAL; OD-1/OD-2/OD-11/OD-29/OD-30 remain OPEN.
- **The 8 Gate-2 exit layers remain as recorded in the mandate documents** (Ext-3 Part G supersedes Ext-2 Part N): Layer 1 Reference index · Layer 2 Reserve valuation · Layer 3 Asset governance · Layer 4 MARP execution · Layer 5 Operational safety · Layer 6 Reporting · Layer 7 Governance and emergency · Layer 8 External specifications integrated. "All 88 tests (T-01 through T-88) must pass or have documented accepted risk" — the accepted-risk documentation for the failing/not-demonstrated rows lives in the OD/conflict registers (C-040/C-041/C-042; OD-3/OD-35) and in §4 above.
- Gate 5 remains **blocked** by the OD-35 critical finding (1/1 deployer-controlled Safe), by the absence of a constituted Committee, and by the absent third-party security audit (docs/DEPLOYMENT-RECORD.md §7).

**Recommended closure path for T-80's remaining component** (orchestrator/Committee-owned, in order): (1) fix D-4 lint regressions and commit the Ext-3 working tree; (2) constitute the Committee (OD-3) and decide OD-1/OD-2 to un-shadow economic eligibility; (3) resolve C-041 (canonical MTQ contract declaration); (4) reconfigure the Safe to genuine 4/7 and re-run `scripts/verify-safe.ts` for VERIFIED 4/7; (5) deploy the corrected V3 contracts (noting the EIP-170 module-split decision) and run the Foundry suites in the protocol owner's environment; (6) execute the full Gate-2 gate run on-chain with Committee sign-off — at which point T-80 can honestly be re-labeled from "reference-layer reconciliation" to "full-stack demonstrated".

---

*Every claim in this report is traceable to: a fresh suite run (§1), a verbatim register row (src/lib/mtq/mandate-register.ts), or a named artifact (audit-work/v5/SAFE-VERIFICATION.md, contracts/TOKEN-STANDARD.md, docs/DEPLOYMENT-RECORD.md). No register row, source file, or contract was modified by this task.*
