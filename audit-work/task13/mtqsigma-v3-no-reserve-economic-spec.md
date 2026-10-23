# MTQΣ — TASK 13 · v3.0 No-Conventional-Reserve Economic Specification — MASTER ARCHITECTURE & CHANGE PLAN (deliverable 3, Stage B)

**File:** `audit-work/task13/mtqsigma-v3-no-reserve-economic-spec.md` — required by MTQSIGMA-COO-MANDATE-004 §4 (modules A–L, each with existing implementation / intended v3.0 behavior / dependencies / breaking changes / migration implications / tests / risks / acceptance criteria). This file **replaces the Stage-A placeholder stub in full (filename unchanged)**. Sibling to the Stage B decision paper `economic-model-options.md`; cites the Stage C–K specs for depth instead of duplicating them. Date: 2026-10-22.

**STATUS: PROPOSED (v1) — REPLACEMENT PROGRAM; GATED ON GATE-B OWNER DECISIONS (D-13.3…D-13.7).** No economic model, parameter, or policy is approved by this document. Nothing herein is implemented, deployed, or authorized.

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

**Evidence-status legend** (per `README.md`): `VERIFIED` (independently reproduced with cited evidence) · `DEVELOPER-REPORTED` (stated by prior in-repo work, cited, not re-executed) · `SIMULATED` (synthetic/reference data, labeled) · `PROPOSED` (design requiring approval) · `UNVERIFIED` (could not be confirmed; environmental limits are UNVERIFIED, never PASS) · `NOT IMPLEMENTED`.

**Forbidden-claim compliance:** this document never describes the floating-token model as a stablecoin and never implies that an index formula guarantees, targets, stabilizes, or defends any market price. Reference value ≠ market price everywhere. No collateralization, redemption, or stability claim is made for any design that lacks a real facility with real assets, counterparties, capital, and legal enforceability — none exists in the record today.

---

## 0. How to read this document — the architecture is CONDITIONAL

1. **Nothing is chosen here.** The v3.0 economics are conditional on the owner's economic-model selection at **Gate B** (decisions **D-13.3 what MTQΣ is · D-13.4 economic family · D-13.5 stability objective · D-13.6 supply policy · D-13.7 redemption mechanism** — all OPEN; register `unresolved-decisions-and-owner-approvals.md` §A). The decision paper `economic-model-options.md` compares four models: **M1** floating market-priced token + separately published adaptive reference index; **M2** index-linked instrument with explicit legal obligations; **M3** enforceable redemption facility (a reserve by another name — flagged by the paper as contradicting the no-reserve objective); **M4** two-layer architecture (neutral index service + separately governed payment instrument). Its §10 recommendation (M1 as token architecture + M4 structural separation) is **ADVISORY ONLY** and is not adopted by this document.
2. **Branch rule.** Wherever a module's design differs by model, this document presents a **branch table labeled [M1]/[M2]/[M3]/[M4]** — never a selection. Where a module is model-independent (index math, oracle quality, registry mechanics), it is written once and marked so.
3. **Replacement-program rule** (mandate §4, verbatim obligation): *"Treat v3.0 as a replacement program where the evidence indicates that reserve-backed assumptions are structurally embedded. Do not simply rename reserve variables or delete collateral checks without defining the resulting economic and legal model."* §3 is the mechanism-by-mechanism removal plan; §4 is the legal consequence map; §2.A defines what holders own under each model *before* anything is deleted.
4. **Parameter rule.** Every parameter referenced is explicitly **UNAPPROVED**. Existing code constants are cited as facts about the existing system; v3.0 draft values live only in sibling-spec parameter annexes and require owner approval. No figure in this document is invented; no figure herein is a decision.
5. **Gate rule.** No release gate is advanced by documentation, typecheck, lint, or tests (README rule 3; Task 10 D8 / Task 11 D9 / Task 12 D10). The 11 §25.5 gates are all NOT CONDUCTED and the 8 release controls are all NOT_GRANTED (`honest-status.ts:37-117`; `release-controls.ts`; baseline §9) — fail-closed by design.
6. **Precedence.** Where a sibling spec is cited, that spec is the depth source; where this document and a sibling appear to conflict, the conflict is flagged, never silently resolved in either direction.
7. **Document map** — mandate §4 module → the sibling spec that owns the depth (this document stays the umbrella and cites rather than duplicates):

| Module | Depth source (sibling spec, all under `audit-work/task13/`)
|---|---|
| A | `economic-model-options.md` §5–§8 (ten comparison dimensions per model) |
| B, C, D | `currency-constituency-and-weight-transition-spec.md` (deliverable 4) + `reference-index-and-gold-methodology.md` (deliverable 5) |
| E, F | deliverable 5 §4 (gold) and §5 (GPP) |
| G | `oracle-and-emergency-state-spec.md` (deliverable 10) |
| H | `issuance-burn-and-market-mechanism-spec.md` (deliverable 7) |
| I | `payment-instrument-registry-and-settlement-spec.md` (deliverable 6); fee depth → `fee-and-commercial-revenue-model.md` (deliverable 8, in draft) |
| J | `cross-chain-supply-and-authority-review.md` (deliverable 9) + `security-remediation-and-migration-readiness.md` (deliverable 12) |
| K | `fee-and-commercial-revenue-model.md` + `revenue-and-unit-economics.md` (referenced by filename; content NOT invented here) |
| L | `quantitative-validation-plan.md` (deliverable 11, placeholder) + `test-matrix-and-results.md` §3 |

  Cross-cutting: the decision surface is `unresolved-decisions-and-owner-approvals.md` §A (D-13.1–D-13.12) plus the wave-1 decisions D-13.13–D-13.21 opened inside the sibling specs and consolidated in §6/§9 below.

---

## 1. Existing system — the "structurally embedded reserve" finding (baseline §6)

### 1.1 Deployed estate (DEVELOPER-REPORTED at the Task 12 fresh read-only anchors: Monad 10143 block 73,243,944 · Arc 5042002 block 68,520,264 · RH 46630 block 140,748,341 · Solana devnet slot 513,885,476; hashed evidence `audit-work/task12/evidence/fresh-anchors-task12.json`; not re-probed this cycle)

- **On-chain reality = the v1.2 five-currency pilot** (`contracts/MTQSigma.sol`: USD 0.389 / EUR 0.278 / GBP 0.1669 / JPY 0.1111 / CNY 0.055; gold reserve-only; MockUSDC flows; **admin-set prices**) **plus the `MtqEcosystem.sol` modules** (MTQ + Mint + Redeem + ReserveVault [USDC+PAXG] + Oracle + Algorithm + Takaful + Governance + Safe) across three EVM testnets, **plus one Solana SPL mint** (decimals **18 — anomaly**; supply field = u64 ceiling 2⁶⁴−1, a deliberate `mintTo(u64::MAX)`; mandated 1M physically unrepresentable at 18 decimals — SOL-DEC-1 / DEC-3 OPEN). Deployed supplies: Monad 310.949 / Arc 1,000 / RH gen-B ≈1,001,000; **no on-chain supply cap** on either v1.2 token; gen-A/C self-custody 1M pots with owner-gated `genesisMint`.
- **V2/V3 are source-ready, NOT deployed** (`contracts/deployments/MTQSigmaV2-PENDING.json`, status `V3_SOURCE_READY_PENDING_DEPLOY`): the 7-component `MTQSigmaV2.sol` and the bank-mediated `MTQSigmaV3.sol` face **no live-constraint**; the deployed v1.2 estate is the live constraint. The genesis story (1.1M USDC → 1M MTQ → Safe) is **DISPROVEN on-chain** (Safes are 1-of-1 owned by the deployer EOA, nonce 0, hold ZERO assets; no USDC at any recorded address).

  | Chain / generation | Token | Supply | Cap | Authority reality (DEVELOPER-REPORTED, deliverable 9 §1) |
  |---|---|---|---|---|
  | Monad 10143 | v1.2 pilot (MITHQAL, 18 dec) | 310.949 | none (`cap()` absent) | ADMIN/MINTER/PAUSER → deployer EOA + 1/1 Safe owned by it; Redeem module holds token-MINTER (anomaly E-15/16, OPEN) |
  | Arc 5042002 | v1.2 pilot (oldest of 4 Arc generations) | 1,000 | none | ADMIN → deployer only; Safe holds PAUSER only (Monad/Arc asymmetry) |
  | Robinhood 46630 | gen-B twin (provenance tier) | ≈1,001,000 (figure divergence flagged) | none | ADMIN+MINTER+PAUSER on deployer; the "Safe (Multi-Sig, 4/7)" row is NOT a genuine Safe (Safe ABI reads revert) |
  | Solana devnet | current SPL mint (decimals 18) | u64 ceiling 2⁶⁴−1 (deliberate `mintTo(u64::MAX)`) | n/a | mint authority = single key, custody UNVERIFIED (CKPT-2); superseded-mint authority = C-045-b/R-2, wallet drainable |
  | gen-A/C pots (EVM) | self-custody genesis inside the token | 1M each | none | owner-gated `genesisMint` — the exposed key can inflate them (XR-10; power survives EOA role revocation) |
- **All authorities resolve to one compromised EOA** — deployer `0x3C39…d8c` = the **R-1 key (C-045-a)**, compromised and fully privileged at the anchors; Solana superseded-mint authority = **C-045-b (R-2)**, 4.98 SOL drainable by any repository holder. All 18 deployed EVM contract source/build identities are UNVERIFIED; address-book verdict `ok=false` (2 BLOCKER cross-chain hex conflicts); APPROVED-CANONICAL count = 0. Task 12 D4 (EVM Safe-B 4-of-7, grant-before-revoke) / D5 (Solana evacuate-then-revoke) migration packages are **execution-ready, UNSIGNED**; the D8 approval chain gates every on-chain step (deliverable 9 §5; deliverable 12 §6).

### 1.2 The reserve-dependent TS reference economics — what is structurally embedded (baseline §6, cited)

Reserve-dependence is **TOTAL** in the TypeScript reference economics (~15 modules); every mechanism below collapses without the reserve concept:

| Reserve-dependent mechanism | Where (evidence) | What it does today |
|---|---|---|
| RR solvency ladder | `blueprint.ts:110-112,469-489` (1.10/1.05/1.00) vs `mtq-final-reserve-spec.ts` + `MTQSigmaV3.sol:255` (1.30/1.05/1.00) — **C-INV-1** | Keys the six-state machine S1–S6, mint throttles, LCR pause |
| Issuance capacity chain **PBC→ABC→DMCE** | `protected-backing-cell.ts` (`maxMtqIssuanceUsd = availableBacking/1.30`), `available-backing-certificate.ts` (V3 BM-11 gate), DMCE 5% | **The ONLY mechanism that computes issuance capacity** (nothing else does) |
| NAV-proportional redemption | `engine.ts:2077-2200` (I6); V2 `:1275-1322`; EQ-142–145 | Prices mint/redeem off reserve net asset value |
| Proof-of-reserve | `proof-of-reserve.ts` (Chainlink PoR stub THROWS — NOT IMPLEMENTED; pilot synthesizes attestation with `verified=false`) | Status/attestation surface |
| Genesis funding | `genesis.ts` (1.1M USDC → 1M MTQ, RR 1.10, 7 fixings) | Origin story — DISPROVEN on-chain |
| MARP reserve trades + stability pool | `engine.ts` reserveAssetValues haircuts; V3 stability pool = sole USDC custody, EMERGENCY deficit cover | Rebalancing + crisis backstop |
| `finality-before-mint` L3 | `finality-before-mint.ts:15-33` (L3 = reserve sufficiency) | 7-layer mint gate |
| On-chain mirrors | V2 `reserveVault` + `reserveHeldUsd[7]` + `getReserveRatio/getLCR`; v1.2/ecosystem vault-balance economics | Contract-side reserve accounting |

**What breaks if the reserve is deleted without replacement (baseline §6 "What breaks"):** issuance capacity (undefined), mint/redeem pricing (NAV-based → undefined), solvency states (S1–S6 keyed on RR), LCR pause, MARP, PoR surface, V3 BM-11 workflow gate, genesis story, redemption itself. **A no-reserve v3.0 must supply a replacement for each mechanism or remove the operation honestly with its consequences documented (mandate §4.9 rule)** — this is §3's table and the D-13.6/D-13.7 warning.

### 1.3 The four un-reconciled economic families (baseline §11)

v1.0/v2.0 adaptive 7-component (RR 1.10) · MITHQAL v25.3.1 11-currency bank model (RR 1.30, 80/18/2) · deployed v1.2 5-currency pilot · V3 non-custodial bank-mediated — contradictions **C-INV-1** (RR 1.10 vs 1.30), **C-INV-2** (7 vs 11 vs 5 components), **C-INV-3** (six-state vs five-state), **C-INV-4** (EMERGENCY redemption paused vs 2.00% fee row). The basket is fixed at 7 **by construction** (baseline §7: `bytes3[7]`, `length !== 7` guards, positive-weights-only `submitTargetWeights` — a departure can never reach 0). Fees are implemented in code (mint 0.10% everywhere; redeem ladder 0.15/0.50/1.00% + 2.00% EMERGENCY-paused + 0.30% recovery; rebalance 0.20%; V2/v1.2 commingle fees with collateral; V3 feeWallet has **no sweep function**) — all UNAPPROVED parameters (baseline §8). Oracle reality: one live upstream per pair with synthetic 3-source witnesses (§17.10 independence NOT met, disclosed); TS DEGRADED = mint paused / **redeem open on last-known-good** (fail-open divergence — deliverable 10 §5).

---

## 2. Module-by-module v3.0 architecture (mandate §4, modules A–L)

Reading key: every module below uses the same eight facets — (a) existing implementation [evidence status]; (b) intended v3.0 behavior [PROPOSED; branched where model-dependent]; (c) dependencies; (d) breaking changes; (e) migration implications; (f) tests (Stage K families, `test-matrix-and-results.md` §3 + the named families in the sibling specs); (g) risks; (h) acceptance criteria. "No register gate letter yet" marks decisions opened by wave-1 specs that `unresolved-decisions-and-owner-approvals.md` §A (which covers D-13.1–D-13.12) does not yet carry — flagged for the orchestrator, never invented.

### 2.A Module A — Monetary object definition and holder rights

- **(a) Existing:** no statement of what MTQΣ is exists anywhere in the record (BLOCKER, baseline §5 Stage B row 1); four families coexist un-reconciled (§1.3); the deployed v1.2 pilot transacts at admin-set prices against MockUSDC (DEVELOPER-REPORTED, deliverable 9 §1) — it implies nothing defensible about holder rights.
- **(b) Intended v3.0 (PROPOSED — the branch table the mandate requires; mirrors `economic-model-options.md` §5–§8 D1–D4; NOTHING below is chosen):**

| Facet | [M1] Floating token + published index | [M2] Index-linked obligations | [M3] Redemption facility | [M4] Two-layer index service + instrument |
|---|---|---|---|---|
| Object definition | Transferable token, market-priced, no backing/peg/band; index published separately as a statistic | Instrument whose named legal obligor owes index-defined payments | Token redeemable at reference value through a real facility | Layer A: neutral index service (no holders, no obligations); Layer B: separately governed instrument(s) |
| Holders OWN | On-ledger balance; transferability; voluntary acceptance-layer utility | Contractual claim on the obligor (enforceability unproven) | Redeemable claim, strength = the legal structure behind it | Layer A: nothing (dataset users at most license rights); Layer B: per instrument, its own D1 |
| Holders do NOT own | Any asset claim, redemption right, balance-sheet claim, basket entitlement, or market-price≈reference guarantee | Basket assets absent perfected security; anything surviving obligor insolvency above unsecured creditor | Facility assets absent perfected security/bankruptcy remoteness; haircut/gate protection | Any claim against the index; the index owes nobody a payment or a price |
| Redemption (D2) | **Unavailable at protocol level**; secondary exits at market's discretion | Conditional/optional per contract | Available if uncapped; conditional if gated | Index: N/A; instrument: OPEN per instrument |
| Supply (D3) | Per D-13.6 (fixed / elastic rule / tranches); capacity chain DELETED | Obligor issuance mirrored on-chain; proof-of-issuance needed | Mint against facility inflow; PBC→ABC→DMCE REBUILT | Index: no supply; instrument per its issuer |
| Price↔reference alignment (D4) | **None, structurally** — voluntary conventions, narrative anchoring, acceptance-layer quoting only | Obligor hedge + solvency; deviation normal, not a defect | Redemption arbitrage; breaks under runs/gates | Voluntary referencing; index enforces nothing |

  **Mandatory M1 preamble (decision paper §5, binding here):** the floating model is **NOT a stablecoin**; market price may deviate from the reference index **arbitrarily — any magnitude, either direction, any duration**; nothing in the index formula stabilizes, targets, supports, or defends the market price. **Mandatory M3 warning:** every honest component of a redemption facility (assets, counterparties, liquidity, capital, enforceability) is a conventional reserve under another name; choosing M3 means the owner revises the no-reserve objective itself (a recorded objective change, not an implementation step).
- **(c) Dependencies:** D-13.3, D-13.4, D-13.5, D-13.6, D-13.7 (Gate B); modules B, H, I, K; §3/§4 of this document.
- **(d) Breaking changes:** every deployed mint/redeem surface (v1.2 priced mint/redeem; V2 vault-balance redeem) is semantically incompatible with M1/M4; the claims register (`claims-and-honest-status.md`) must be re-baselined to the selected row; marketing/UI language fixed by the row choice and not repairable retroactively.
- **(e) Migration:** new-contract program in every branch (no proxy exists in the estate; EIP-1967 slots UNSET — deliverable 9 §1.6); the v1.2 pilot's disposition (re-label as testnet-only legacy / disable mint+redeem / decommission) is **new decision D-13.22** (§9); **no on-chain step of any kind precedes the Task 12 D4/D5/D8 authority migration** (deliverable 12 §6) — today every "issuer" authority is the compromised EOA, which is disqualifying for M2/M3 in particular (decision paper §4 fact 3).
- **(f) Tests:** Stage K families "reference value vs market-price reporting" (NONE today — test-matrix §3) and "shadow mode & release-gate enforcement" (covered — release-controls 13/13; maintain, never weaken); honesty-surface assertions per issuance-burn §6.8 (no redemption-promise language while D-13.7(a) holds).
- **(g) Risks:** expectation/litigation risk (participants impute a peg that does not exist) vs relevance risk (markets ignore the index) — the two M1/M4 failure modes (decision paper §5 D8); M2 obligor credit risk + securities characterization; M3 run/gate distributional risk + highest-value attack surface behind a currently compromised key.
- **(h) Acceptance (NOT met today):** D-13.3/4/5/7 recorded; this §2.A table collapses to a single approved row; counsel memo on the selected row's claims BEFORE any public use; the interface-language audit (deliverable 7 §6.8) passes; no gate advanced by the document itself.

### 2.B Module B — Reference-basket methodology and constituent eligibility

- **(a) Existing:** the only registry is the **asset registry whose members ARE the basket instruments** (`registry.ts:57-115`, 9 instruments; admission criteria are reserve/basket criteria — VERIFIED, deliverable 6 §1); strategic prior 27/20/9/8/5/5/26 = anchor only (`blueprint.ts:22-30`); chain-linked index machinery is real and self-tested (`chain-index.ts`, VERIFIED) but composition is static; MASE is a pilot substitute (equal-α inverse-vol; 21 NOT-IMPL-GAP disclosed).
- **(b) Intended v3.0 (PROPOSED):** retain the chain-linked return-space index `I_t = I_{t-1}·Σ W_{i,t-1}·(P_{i,t}/P_{i,t-1})` with the base-relative divisor at every commit (deliverable 5 §2.1 Option A — the draft, not a choice; the recursion does NOT change in v3.0; the component set becomes registry-driven). Constituents = registry records with eligibility scoring, hysteresis, and provenance tiers (deliverable 4 §2–§4). Reference value `P_MTQ = I_t × PAR` (PAR = 1.00, `chain-index.ts:223-229`) with the numeraire/denomination fixed by D-13.3 — [M1]/[M4]: published statistic only; [M2]/[M3]: the same number becomes an obligation/facility input, which changes its legal weight, not its arithmetic. Scoring consumes only exogenous, provenance-tiered inputs (liquidity, data quality, convertibility, jurisdictional restrictions, currency-control exposure, benchmark availability, volatility, diversification, exogenous economy-wide FX-use relevance, geopolitical exposure — deliverable 4 §4.1); **MTQΣ-internal payment volume is FORBIDDEN as an input** (INV-SEP-1).
- **(c) Dependencies:** D-13.3, D-13.4, D-13.5, D-13.11, D-13.12, D-13.13, D-13.14; modules C/D/E/F/G.
- **(d) Breaking changes:** `length !== 7` guards, `bytes3[7]` arrays, enum, immutable Q_*/BASE_* constants, 6-leg oracle board all replaced by registry-driven shapes (baseline §7; deliverable 4 §9 — contract redesign, not parameterization); the fixed-basket `setEnvelopes` cannot change count — replaced by per-record bounds + N_max.
- **(e) Migration:** registry-era V2/V3 descendants are new contracts (no upgrade path in the estate); the divisor machinery survives (deliverable 5 §9); v1.2's fixed-5 weights cannot be migrated into a registry index (different family — D-13.4); authority sequencing per D-13.22 + Task 12 chain.
- **(f) Tests:** CCY-LC-1..9, CCY-SCORE-1, CCY-DET-1 (membership/score/determinism families — NONE today); IDX-SUM-1, IDX-CONT-1..5, IDX-PUB-1, IDX-REV-1, IDX-BASIS-1, IDX-DISC-1 (deliverable 5 §8).
- **(g) Risks:** methodology capture (interested instruments steering admission — deliverable 4 §11); divisor-ledger integrity (in-memory pilot ledger today — `honest-status.ts:251(b)`); stale Case C divisor assertion (must be fixed before Stage K runs); the <15%-vs-Laspeyres backtest is DEVELOPER-REPORTED for the OLD fixed-7 family and must NOT be cited for a new constituency.
- **(h) Acceptance:** deliverable 4 §14 + deliverable 5 §13 approval lists recorded; IDX/CCY families green in their designated evidence classes; the six-value publication surface live with IDX-DISC-1 emitted; nothing claimed beyond evidence.

### 2.C Module C — Adaptive currency constituency and component entry, exit, and emergency suspension

- **(a) Existing:** constituency is STATIC by construction (`honest-status.ts:245` — the codebase's own attestation; baseline §5 Stage C); inert candidate universes only (`RESERVE_CURRENCY_UNIVERSE` 11 ccy, `DIGITAL_UNIVERSE` 7 stablecoins, `mtq-final-reserve-spec.ts:397-419`); positive-weights-only submission means **no exit can ever be expressed on-chain** (V2:526/V3:1317).
- **(b) Intended v3.0 (PROPOSED — model-independent):** versioned component registry; lifecycle CANDIDATE→ELIGIBLE→ACTIVE→WATCH→RETIRING→EXCLUDED with T1–T9 transitions, rule-driven T2/T4, governance-confirmed T3/T5/T8, and a **distinct emergency path T7/T8** (Emergency Council or oracle-emergency interlock; post-hoc ≤24h disclosure — no pre-announcement by definition); eligibility scoring with normalized inputs, hard gates, hysteresis H = θ_in − θ_out > 0; separation invariant INV-SEP-1 (payment volume NEVER an input). Full state machine, scoring dimensions, and alternatives: deliverable 4 §2–§4, §8.
- **(c) Dependencies:** D-13.11 (max size N_max), D-13.14 (rounding/concentration conventions), D-13.12 (gold), D-13.13 (GPP leg, if adopted); modules D/B/G; deliverable 10 for the emergency interlock.
- **(d) Breaking changes:** zero-weight exits must become expressible (positive-only submit rewritten); registry replaces fixed arrays everywhere; governance surface gains new proposal/timelock types (admission, retirement).
- **(e) Migration:** TS reference layer first (safe, repo-level); registry-era contracts only with deployment approval after the authority chain; the deployed v1.2 5-currency basket is NOT a member of any registry family (D-13.4).
- **(f) Tests:** CCY-LC-1..9, CCY-HYS-1, CCY-SCORE-1, CCY-SUM-1/CCY-BOUND-1/CCY-VEL-1 (after EVERY transition and glide intermediate), CCY-EXCL-1 (excluded ⇒ exactly 0), CCY-SEP-1, CCY-EMER-1, CCY-ANN-1 (test-matrix §3 rows 1–2; NONE exist today).
- **(g) Risks:** score-input capture; oscillation without hysteresis discipline; velocity-vs-retirement-speed conflict (deliverable 4 §5.5 — explicitly UNRESOLVED, a D-13.14 input); emergency-path abuse (T7 authority must be post-migration).
- **(h) Acceptance:** deliverable 4 §14 approvals recorded (D-13.11/D-13.14 among them); CCY families green; every admission/retirement carries a provenance-complete dossier; no transition advances any release gate by itself.

### 2.D Module D — Weight calculation, normalization, bounds, and index continuity

- **(a) Existing:** sum-to-one + envelopes + velocity enforced at submission (V2:518-555; EQ-062); envelopes per blueprint.ts:78-96; velocity caps 0.50/0.30/0.20% (existing constants, cited); on-chain commit tolerance ±1e14 (V2:638/V3:1388); zero-artificial-return divisor algebra proven for weight-only changes (`chain-index.ts:850-894` self-test) — **but composition-change continuity tests cannot exist because composition cannot change** (baseline §5 Stage D row 3).
- **(b) Intended v3.0 (PROPOSED — model-independent):** pipeline MASE→admissibility projection→transition overlay→bp-quantization with largest-remainder tie-breaking (lexicographic by stable ID)→exact-sum commit; excluded components exactly 0; glide paths with sum/bounds/velocity at every intermediate; divisor record at every T3/T5/T6/T7 boundary so composition change creates **no artificial gain or loss** (deliverable 4 §5; deliverable 5 §2.2 — proof by construction). Exact bp-sum replaces the ±1e14 tolerance (D-13.14).
- **(c) Dependencies:** D-13.14 (the whole rounding/sum/precision convention is a NEW decision), D-13.11; modules B/C/E; deliverable 5 §8 for the joint continuity tests.
- **(d) Breaking changes:** commit-tolerance tightening to exact; on-chain/off-chain reconciliation rule (draft |I_off−I_on| ≤ 1e-12 relative — UNAPPROVED, D-13.14); positive-only submit removed (see C).
- **(e) Migration:** keeper commitment path must round (bp) rather than the contract; Case C stale assertion updated first; IDX-CONT-3-class tests unwritable until the Stage C registry lands (the two specs are a pair — deliverable 5 §12).
- **(f) Tests:** IDX-CONT-1..5 (continuity incl. add-from-zero/remove-to-zero), IDX-SUM-1, IDX-ENV-1/IDX-VEL-1, IDX-PREC-1 (≥10⁶-step drift bound — environmental-UNVERIFIED candidate in this sandbox), CCY-SUM/BOUND/VEL joint.
- **(g) Risks:** long-horizon float64↔1e18 drift currently UNMEASURED (the §9.3 reconciliation never ran — `honest-status.ts:251(c)`); rounding determinism across two layers; divisor-ledger loss (in-memory today).
- **(h) Acceptance:** D-13.14 recorded; continuity families green in TS reference layer with deterministic seeds; on-chain variants only under a Foundry runner (sandbox execution UNVERIFIABLE — never PASS without a runner).

### 2.E Module E — Gold pricing, custody assumptions if applicable, market conventions, and data quality

- **(a) Existing:** gold = index leg 6, envelope 20–32%, base fixing XAU 2500 (`blueprint.ts:61,85`); live price family gold-api.com XAU spot with metalpriceapi demo fallback; history via FRED London fix (discontinued 2024) → Yahoo GC=F proxy → constant-2500 terminal default (VERIFIED, deliverable 5 §1); PAXG/XAUT are **reserve instruments + depth feeds, NOT the price source**; index-gold vs reserve-gold separation is **ACCOUNTING-ONLY** (one PAXG+XAUT pot — `honest-status.ts:229-234`, F-4); legacy 26.25%±3% clamps in the deployed ecosystem.
- **(b) Intended v3.0 (PROPOSED — branch on D-13.12):** gold disposition is an owner decision with three live options: **index leg only** (custody N/A by construction — a pure index leg holds nothing; data-quality/staleness/confidence per GOLD class 60s/1.0% and IDX-GOLD-1) / **instrument admissibility rules** (gold-backed tokens admitted only as payment/constituency instruments under their own evidence) / **retirement**. No "guaranteed floor" language anywhere (mandate Stage D). [M3]-only branch: a facility holding gold instruments re-imports custody/haircut/audit questions (decision paper §7 — reserve-by-another-name warning applies).
- **(c) Dependencies:** D-13.12 (gates B/C), D-13.13 (a GPP leg would consume a slot), D-13.16 (≥2-independent-families for the gold leg — NOT met today).
- **(d) Breaking changes:** single-live-upstream gold pricing cannot survive the independence standard; the constant-2500 fallback may only ever publish as DEGRADED-labeled display (IDX-GOLD-1); legacy clamps retire with the v1.2 family.
- **(e) Migration:** no custody exists to migrate in the M1/M4 "index leg only" branch (custody question is honestly N/A); the accounting-only separation finding (F-4) must be resolved before ANY production gold claim (baseline §4 gold row).
- **(f) Tests:** IDX-GOLD-1 (gold-feed failure cannot advance the index on a stale leg); T-ORC-01/02 gold-class cells; deliverable 5 §8 gold rows.
- **(g) Risks:** source-family capture of the gold price; GC=F basis behavior UNVERIFIED; index-gold/reserve-gold conflation recurring through PAXG depth feeds.
- **(h) Acceptance:** D-13.12 recorded; ≥2 verifiably independent gold price families live with provenance records (currently NOT met — precondition, not result); no floor/stability language in any gold artifact.

### 2.F Module F — Global purchasing-power methodology and input datasets

- **(a) Existing:** MASE has a `ppp` model family (`blueprint.ts:216-223`) and a §6.8 GPP/PPError **proxy** (`honest-status.ts:221` — NO GlobalCPI feeds exist); walk-forward validation NOT RUN (D-validation).
- **(b) Intended v3.0 (PROPOSED — branch on D-13.13, OPENED by deliverable 5 §5):** **Option A** GPP as a published pseudo-leg (national CPIs rebased, published weight vector a_j, carry-forward ≤2 cycles draft, publication-lag discipline — no lookahead; methodology events on CPI rebases) / **Option B** GPP as a MASE objective only / **Option C** exclude from initial composition (deliverable 5's draft — the machinery cost is honest and front-loaded). All three preserved; none chosen.
- **(c) Dependencies:** D-13.13 (Gate B/C per deliverable 5 §13; depends on D-13.5), D-13.11 (slot consumption), D-13.14 (envelope/velocity class for a leg).
- **(d) Breaking changes:** Option A adds a componentType GPP_LEG with a reduced scoring dimension set (no FX market — no §4.1 scoring applies); CPI publication lag (~4–6 weeks) requires reference-month timestamping — a new data-discipline class for the pipeline.
- **(e) Migration:** additive — no existing dataset or feed is displaced; the §6.8 proxy must be retired or re-labeled when real feeds land.
- **(f) Tests:** data-failure incidence family (deliverable 5 §7 metrics — CPI missing rows, carry-forward flags); leakage discipline shared with Stage J (no lookahead — the index must never use a CPI value dated before its publication date).
- **(g) Risks:** benchmark-regime and dataset-revision risk; aggregation-weight contestability (a_j is published and owner-decided — never silent); objective drift if D-13.5 selects purchasing-power preservation while Option C excludes the leg.
- **(h) Acceptance:** D-13.13 recorded with the a_j vector and carry rule; coverage table (who reported/carried/dropped) published with every aggregate; no GPP effectiveness claim without the Stage J benchmark arm.

### 2.G Module G — Oracle independence, manipulation resistance, stale data, and incident handling

- **(a) Existing:** TS five-state feed machine, per-class bounds, §17.6 confidence (C_MIN 0.60), LKG-on-DEGRADED (VERIFIED, `oracle.ts`); **one live upstream per pair + synthetic witnesses — §17.10 independence NOT met** (disclosed, `honest-status.ts:224-228`); **DEGRADED redeem fail-open** (`pilot-state.ts:625-648` — the KNOWN DIVERGENCE); V3 strict-3 fail-closed quorum (source-ready, NOT deployed); adapters COMPILED NOT DEPLOYED; deployed pilot oracles are admin-set with unpublished ABIs (compromised-authority-controlled price surface — XR-9).
- **(b) Intended v3.0 (PROPOSED — model-independent):** ≥3 truly independent upstream families per pair with provenance recording and a concentration prohibition (D-13.16); **fail-closed four-state operation table — DEGRADED/FAILED reject mint AND redeem AND payment quotes; LKG display-only** (D-13.15; the v3.0 target deliberately FAILS against current TS behavior — the divergence must be closed as a published supersession of v2.0 §17.7, never silently); 12-scenario emergency coverage with reference-data outages separated from payment-instrument outages (D-13.17); full surface: deliverable 10 §2–§6.
- **(c) Dependencies:** D-13.15, D-13.16, D-13.17 (all opened by deliverable 10; no register gate letters yet — flagged); modules B/D/E/H/I; A-1..A-7 attack enumeration (deliverable 10 §3).
- **(d) Breaking changes:** exit-first LKG redeem removed (TS breaking change vs its own documented reconciliation); synthetic-witness path retired from any pricing role; per-pair independence re-provisioning (contracting ≥2 additional real families per pair — a procurement dependency, not a code patch).
- **(e) Migration:** oracle remediation is required under EVERY economic model (decision paper §4 fact 5); adapter deployment decisions belong to the post-migration authority; the env-gated on-chain read path (WIRING-1) must become fail-closed (no synthetic fallback in deployment posture).
- **(f) Tests:** T-ORC-01..06 (staleness/disagreement; fail-closed pricing — will initially FAIL against current TS by design; emergency pause/recovery; reference-vs-market reporting; independence/provenance; adversarial red team — NOT CONDUCTED).
- **(g) Risks:** A-1 single-source spoofing currently effective (witnesses derive from one upstream); A-2 cross-pair correlation; A-6 synthetic-witness self-deception; a compromised price surface on the deployed estate today. **No manipulation resistance is claimed anywhere.**
- **(h) Acceptance:** deliverable 10 §14: ≥3 independent families live per pair; four-state table implemented in the pricing path; T-ORC-01..05 green; T-ORC-06 red team executed with findings dispositioned — the precondition for ANY manipulation-resistance claim.

### 2.H Module H — Token supply, issuance, burning, transfer, and authorization rules

- **(a) Existing:** operations are CONFLATED (baseline §5 Stage F): v1.2/V2 `mint()` permissionless-with-USDC (V2 `MINTER_ROLE` declared but NEVER enforced); V3 bank-mediated 16-step workflow (keeper BM-02..14 → executeMint) with $500K/tx caps, DMCE 5%, 10% circuit breaker; v1.2 `genesisMint` owner-gated on gen-A/C — **the exposed R-1 key can inflate supply today**; no supply cap on deployed tokens; burn exists only inside redeem (ecosystem self-burn aside); Solana u64-max at 18 decimals; no timelock on any issuance anywhere.
- **(b) Intended v3.0 (PROPOSED — branch table, deliverable 7 §2):** six+ distinct operations (acquisition / secondary / issuance / burn / redemption / transfer-cross-chain / settlement / refunds) each with authorization, accounting entries (named ledger double-entry universe), events with typed `burnType`/`policyId`, replay protection, idempotency, timelocks, reconciliation, caps. Branches: **D-13.6** supply policy (A fixed post-migration / B rule-governed elastic with published caps+timelocks / C governance-voted tranches — with PBC→ABC→DMCE deleted, capacity is UNDEFINED until one is chosen); **D-13.7** redemption (a none-promised — then the operation does not exist and the interface must say so / b specified facility = the M3 branch); **D-13.20** burn taxonomy (holder self-burn / redemption burn / policy burn — never conflated); **D-13.21** secondary-market posture (external-only vs project-facilitated venue with its own license review). [M3]-only: the facility rebuilds PBC→ABC→DMCE — flagged as contradicting the objective (§2.A).
- **(c) Dependencies:** D-13.6, D-13.7 (Gates B/E), D-13.8, D-13.10, D-13.20, D-13.21 (no register gate letters yet for D-13.20/21 — flagged); modules A/G/J; Task 12 D4/D5/D8 — **all executor roles must be post-migration authorities, never the compromised EOA**.
- **(d) Breaking changes:** issuance priced from a reference value requires the full §3 policy block (quote currency, valuation timestamp, rounding, fees, expiry, authorization — an illustrative `net value / reference price = quantity` is NOT a policy, mandate §8); the unenforced MINTER_ROLE must be enforced or removed in any V2 descendant; fee-order normalized (V2/v1.2 deduct-before vs V3 obligation-on-top differ — an inconsistency deliverable 7 §2.7 records); Solana cannot carry any supply statement until SOL-DEC-1/DEC-3 resolve.
- **(e) Migration:** new contracts in every branch (caps/timelocks/taxonomy are structural); v1.2 decommission question = **D-13.22**; operation history is event-log-only and cannot be re-interpreted into v3.0 ledgers (semantics differ — deliverable 7 §5.6).
- **(f) Tests:** deliverable 7 §6 families 1–8 (issuance authorization incl. a fixed-supply negative test; burn taxonomy; fee-recipient accounting with a T4 commingling regression; quote expiry/rounding/refunds; replay/idempotency; reconciliation; emergency-cap integrity incl. split/batch bypass; honesty surfaces). Evidence classes: source-level VERIFIED; deployed-contract variants UNVERIFIED until fresh anchors; simulations SIMULATED.
- **(g) Risks:** over-issuance (today's uncapped mints and R-1-inflatable pots are the live failure class); authorization confusion smuggling supply changes through "payment" paths; false redemption expectation from reference-value pricing; settlement orphaning (V3 obligations have no on-chain aging/refund path).
- **(h) Acceptance:** deliverable 7 §8 — decisions recorded; all nine mandated fields filled per operation (no "not defined until D-13.x" placeholders left); families green; release-control grants exist and authorities are post-migration; interface honesty audit passes.

### 2.I Module I — Payment instruments, settlement, fees, refunds, and reconciliation

- **(a) Existing:** **no payment-instrument registry exists** — the only registry's members ARE basket instruments (`registry.ts:57-115`); bank machinery is institution-level and SIMULATED (1 pilot bank at a deterministic dev key, $1M/day); MBG gateway = real code, chain-read-only, three auth paths incl. a testnet bypass; V3 settlement = off-chain `RedeemSettlement` event obligations (source-ready); three-book/systemic-exposure/bank-default = SIMULATED reference data; stablecoins on testnet = MockUSDC-class tokens; CBDCs NOT CONNECTED; finality production-unready (`finalityProductionReady: false`).
- **(b) Intended v3.0 (PROPOSED — model-independent as a layer; its economics branch at the instrument level under [M4]):** an independent instrument-instance registry (per-instance fields: instrumentId+version, type STABLECOIN/CBDC/BANK_RAIL/OTHER, issuer, network/contract identity, decimals, jurisdiction allow/deny lists, assetPeg + pricing source — **never assume 1 token = 1 fiat unit**, counterparty/custody, restrictions, confirmationPolicy, depegThresholds, state incl. one-way honesty states SIMULATED + NOT CONNECTED, reviewCadence, evidence citations, fee-class references — deliverable 6 §3); **the separation invariant** — payment volume/membership NEVER determines eligibility or weights (four-layer enforcement, deliverable 6 §2; INV-SEP-1/CCY-SEP-1/T-PAY-01); per-type policies (stablecoin finality ≠ balance receipt; CBDC only via verified authorized interface + end-to-end test); quoting with expiry, spread disclosure, itemized fees, declared rounding; settlement finality per rail; refunds/idempotency/reconciliation with fail-closed exception thresholds. Fees as a whole are D-13.8-gated (all rates UNAPPROVED).
- **(c) Dependencies:** D-13.8 (Gate E), D-13.18 (separation invariant + payment-layer governance — opened by deliverable 6 §10; no register gate letter yet), D-13.19 (settlement parameter set: depeg bands, quote expiry, confirmations, rounding, refund timing, reconciliation cadence); modules G/H; deliverable 10 for the emergency interlock and peg-pair class.
- **(d) Breaking changes:** the asset registry loses its implicit payment role; `MBG_TESTNET_BYPASS` cannot survive into any non-SIMULATED path (R-P4); bank+settlement roles must separate (V3 collapses them today); fee-recipient commingling (T4) fixed by the dedicated fee ledger.
- **(e) Migration:** additive design — no real instrument exists to migrate; the pilot bank registers as SIMULATED; every CBDC row is born NOT CONNECTED; authority sequencing per deliverable 12 (payment operators disjoint from index publisher from day one — D-13.18).
- **(f) Tests:** T-PAY-01/02/03 (separation-invariant property test — synthetic payment-volume surge ⇒ scores/weights bit-identical; finality/reorg/refund/reconciliation; quote expiry/rounding/fees) — NONE exist (test-matrix §3 rows 5–6).
- **(g) Risks:** R-P1 circular self-admission if the invariant leaks; testnet-bypass survival; three-book mismatch under real rails; implying index endorsement from acceptance (M4 brand risk — D-13.23).
- **(h) Acceptance:** deliverable 6 §12 — MANDATE-004 §7 clauses implemented with every ACTIVE row evidence-cited; T-PAY-01/02/03 green; D-13.8/D-13.18/D-13.19 recorded; one verified end-to-end settlement against a real (non-MockUSDC) instrument OR the capability explicitly remains SIMULATED with no ACTIVE rows.

### 2.J Module J — Cross-chain supply integrity and authority security

- **(a) Existing:** three EVM testnets + Solana independently deployed; **no cross-chain supply model exists** (no bridge/lock-and-mint code); 18 deployed EVM contracts with UNVERIFIED source identity; every authority → R-1/R-2; gen-A/C 1M self-custody pots; Solana u64-max/decimals-18 structural non-conformance (1M unrepresentable); address book `ok=false` with 2 BLOCKER hex conflicts; mainnet placeholder rows + still-documented `DEPLOYER_PRIVATE_KEY` env name (Stage-H cleanup item, never with a real value); D4/D5 migration packages UNSIGNED.
- **(b) Intended v3.0 (PROPOSED — branch on D-13.10):** supply model options single-canonical-ledger / chain-specific caps / lock-and-mint / burn-and-mint / other — each must PROVE duplicate-supply prevention and oracle consistency (deliverable 9 §3); the **compromised deployer cannot remain a trusted authority in any model** — Task 12 D4 (Safe-B 4-of-7, grant-before-revoke, deployer-strip last) and D5 (evacuate-then-revoke) executed under D8 with D9/CKPT-9 independent verification are a precondition to every on-chain step of this program; no "own blockchain" claims (none made).
- **(c) Dependencies:** D-13.10 (register: Gate G), D-13.22 (estate disposition), carried SOL-DEC-1 / DEC-3 / ECON-DEC-2 / DEC-1..7 / OWNER-ATT-1 → RELEASE-GRANTS chain (deliverable 12 §8); modules H/G; module A (which model makes supply meaningful at all — under [M4] the index layer has no supply by construction).
- **(d) Breaking changes:** any supply statement excludes Solana until SOL-DEC-1/DEC-3 resolve; address-book BLOCKERs must be resolved by per-chain verification before any canonical claim (APPROVED-CANONICAL stays 0 until governance selects); gen-era pots must be explicitly in/out of every census per the chosen model's census rule.
- **(e) Migration:** the full chain in deliverable 12 §6 (OWNER-ATT-1 → T12-1/T12-3 → CKPT-3/4 → CKPT-5/6 → CKPT-7 → T12-8/T-4.4 → D9/CKPT-9 → RELEASE-GRANTS); the unavoidable handover window is disclosed (XR-1 — no risk-free sequence exists); repository cleanup is never containment.
- **(f) Tests:** TC-XC1..XC7 (registry↔anchor reconciliation; aggregate accounting invariant per model; duplicate-supply-path proofs with the Monad Redeem-MINTER anomaly as the permanent negative fixture; representation/overflow vectors; oracle consistency across chains; authority-ledger coupling incl. post-rotation zero-privilege regression; address-book invariants — the 12/12 suite is the only standing piece) — NONE of the supply family exists (test-matrix §3 row 8).
- **(g) Risks:** XR-1..XR-10 register (handover-window race; invisible per-chain inflation; u64/decimals; hex-conflict contamination; unverifiable sources; evacuation irreversibility; remote/CI exposure UNVERIFIED; mainnet placeholders; compromised price surfaces; R-1-inflatable pots surviving EOA revocation).
- **(h) Acceptance:** deliverable 9 §9 — D-13.10 decided with duplicate-supply analysis recorded; D4/D5 executed with D9 evidence; fresh re-probe reconciles §1 cell-by-cell; BLOCKERs resolved and canonical selected only via governance; the TC-XC family green at fresh anchors.

### 2.K Module K — Sustainable revenue, financial controls, and operating costs

- **(a) Existing:** fees are implemented in code but ALL rates are UNAPPROVED (baseline §8: mint 0.10%; redeem ladder; rebalance 0.20%; no exemptions/caps/transfer fees; V2/v1.2 commingle; V3 feeWallet obligation-only with **no sweep function**); treasury constants only (`TREASURY_SWEEP_THRESHOLD_USD=10_000`, "4/7 Multi-Sig Cold Treasury" — no sweep code exists); **revenue engines B/C/D are NOT IMPLEMENTED anywhere**; the owner's "two-part business / three revenue engines" steer is recorded as an UNVALIDATED PROPOSED input (D-13.9); no customer-evidence artifact exists.
- **(b) Intended v3.0 (PROPOSED — cited to the in-draft revenue documents by filename, content NOT invented here):** the fee & commercial model is being drafted in parallel in **`fee-and-commercial-revenue-model.md`** (deliverable 8; on-disk status at production time of this document: placeholder recording Streams A disclosed protocol fees / B payment services / C institutional software-APIs / D research-licensing, fairness rules, and the owner's operating-result definition = revenue − all operating costs) and **`revenue-and-unit-economics.md`** (in drafting; not on disk at the time of writing — no content may be inferred from this reference). Branch on model: [M1]/[M4] revenue is services/licensing/acceptance-layer fees only — minted tokens ≠ revenue, reference value ≠ revenue entry, no yield/appreciation promises; [M2]/[M3] obligor/facility economics require capital plans and hedge budgets that no document in this repository currently contains.
- **(c) Dependencies:** D-13.8 (fee schedule — Gate E), D-13.9 (commercial model validation — register: "Gate H-adjacent"); modules H/I; Stage J (willingness-to-pay validated BEFORE build-out).
- **(d) Breaking changes:** fee commingling ends (dedicated fee ledger, independently controlled treasury — none exists); double-charge prohibition; sweep function must exist before any fee is collected for real.
- **(e) Migration:** none of the fee code is production-reachable today (nothing is deployed production-side); the operating-company/token-funds separation is organizational and must exist before the first real fee.
- **(f) Tests:** fee-recipient accounting & treasury-permission family (test-matrix §3 row 7 — partial: fee math tested, no sweep exists); quote-expiry/rounding/refund family rows shared with deliverable 7 §6.
- **(g) Risks:** mistaking reference value or minted tokens for revenue; unvalidated willingness-to-pay; fee income creating over-issuance incentives (decision paper §5 D8); validator gas is never MTQΣ revenue (deliverable 8 scope note).
- **(h) Acceptance:** D-13.8/D-13.9 recorded; the versioned fee schedule published before any real fee; profit measured per the owner's definition with refunds/chargebacks/third-party costs netted; every revenue figure labeled SCENARIO until validated — nothing in this module is a revenue claim.

### 2.L Module L — Quantitative validation, security assurance, governance, and release gates

- **(a) Existing:** 10-yr backtest + 11 fixed-seed stress + Monte-Carlo exist but test the OLD reserve-based family (must NOT be cited for any v3.0 model — decision paper §13); no leakage-controlled split, no purchasing-power benchmark, no sensitivity suite; canonical-invariants re-run UNVERIFIED this cycle (three documented environmental kills — test-matrix §2); Foundry UNVERIFIABLE in sandbox (no forge); 11 §25.5 gates all NOT CONDUCTED; 8 release controls NOT_GRANTED (fail-closed, grants only via the owner-authored file outside git); CI chain real but unexercised (no remote — OWNER-ATT-1).
- **(b) Intended v3.0 (PROPOSED):** reproducible validation pipeline vs mandated baselines (fixed-basket, single-currency, gold-static, purchasing-power per D-13.5/D-13.13) with multi-window + crisis testing, leakage-controlled splits, and the mandated metric families (performance; volatility; maximum drawdown; tracking behavior vs the declared objective; turnover; concentration HHI over time; data-failure incidence per leg — oracle outages, missing CPI rows, gold-source fallbacks; parameter sensitivity — deliverable 5 §7) — to be specified in `quantitative-validation-plan.md` (deliverable 11, placeholder on disk); security assurance via the Task 12 D9/CKPT-9 independent-review chain; governance per §5 below; release-gate structure fail-closed with the standing rule that documentation/typecheck/lint/tests advance nothing. [M1]/[M4]-specific: the honest D9 test is that the system never claims price alignment — no simulation can or should claim it (decision paper §5 D9).
- **(c) Dependencies:** D-13.5 (benchmark set), D-13.13; modules A–K (validation consumes all of them); Stage K family build-out (test-matrix §3 plan).
- **(d) Breaking changes:** old-family backtests formally retired as evidence (preserved as history); the stale Case C assertion must be fixed before any Stage K run; results recorded UNVERIFIED under environmental limits — never PASS.
- **(e) Migration:** additive research tooling (safe, repo-level); any on-chain validation requires post-migration authorities.
- **(f) Tests:** the entire test-matrix §3 plan (12 families) + named CCY-*/IDX-*/T-PAY-*/T-ORC-*/TC-XC* suites + deliverable 7 §6 — all NOT IMPLEMENTED as v3.0 evidence today.
- **(g) Risks:** calibration-data selection bias; simulation ≠ future stability (no simulation proves it — mandate Stage J); gate-decay via green-washing (mitigated by the never-advanced-by-tests rule); environmental limits misread as PASS.
- **(h) Acceptance:** deliverable 11 produced and executed on approved objectives; independent reviewer commissioned (CKPT-9) and findings dispositioned; every gate verdict produced by the process that owns it — this document advances nothing.

### 2.APPENDIX — Stage-B ten-clause cross-check (mandate clauses → where this document satisfies them)

| # | Mandated clause (stub scope) | Where |
|---|---|---|
| 1 | What MTQΣ is | §2.A branch table (D-13.3) |
| 2 | Reference-unit meaning/denomination; valuation formula; numeraire | §2.A/§2.B (`P_MTQ = I_t × PAR`; numeraire fixed by D-13.3) |
| 3 | Role of each currency and the gold component | §2.B/§2.E (D-13.12) |
| 4 | Reference-value calculation vs market price (distinct quantities) | §2.B/§2.L + deliverable 5 §3 (six-value publication; IDX-DISC-1) |
| 5 | Stability objective | §2.A/§2.L (D-13.5; index-quality objectives only under [M1]/[M4]) |
| 6 | Benchmark datasets, publication frequencies, coverage, normalization, revision policy | §2.B/§2.F + deliverable 5 §2.3 |
| 7 | Treatment of inflation, FX moves, gold moves, unavailable data, structural breaks | §2.B/§2.E/§2.F/§2.G |
| 8 | Supply policy + interaction with the objective | §2.H (D-13.6) |
| 9 | Absence of a conventional reserve + consequences for redemption/liquidity/holder risk | §1.2, §3, §2.A/§2.H (D-13.7) |
| 10 | Exact claims that can and cannot be made to holders | §4 (per-model) + §2.A |

---

## 3. Reserve-dependence removal plan (baseline §6 inventory → v3.0 disposition)

**Warning (mandate §4.9 / D-13.6 / D-13.7):** deleting a reserve-dependent mechanism without a replacement does not make the system "no-reserve" — it makes the operation **UNDEFINED**. Issuance capacity currently exists ONLY as PBC→ABC→DMCE; redemption exists ONLY as NAV-proportional/vault-balance flows. Deletion without a chosen replacement policy (D-13.6) and redemption posture (D-13.7) leaves supply and exit undefined — a silent hazard, not a simplification. Every "removed" row below must therefore land with either a named replacement or the operation's honest removal from the interface.

| Reserve-dependent mechanism (baseline §6) | v3.0 disposition (PROPOSED) | Consequence / owner decision |
|---|---|---|
| RR ladder 1.10 vs 1.30 canon (C-INV-1) + six-state machine S1–S6 | **REMOVED** under [M1]/[M4] (no reserve to be solvent against); **REBUILT** under [M3] (facility buffer — sizes from owner-commissioned modeling, no figures exist) | Solvency semantics vanish ⇒ risk states must be re-keyed on oracle/emergency states (D-13.17); D-13.4 retires one family |
| PBC→ABC→DMCE issuance capacity (`maxMtqIssuanceUsd = availableBacking/1.30`) | **REPLACED-BY** the D-13.6 supply policy (A fixed / B elastic rule / C tranches) under [M1]/[M2]/[M4]; **REBUILT** under [M3] | Issuance is UNDEFINED until D-13.6 — the single most dangerous deletion in the program |
| NAV-proportional redemption (I6, EQ-142–145) + v1.2/V2 vault-balance redeem | **REMOVED** under D-13.7(a) ([M1]/[M4] default) — interface must state redemption is NOT provided; **REPLACED-BY** a specified facility under D-13.7(b) = [M3] (assets/counterparties/capital/enforceability enumerated, decision paper §7) | Exit liquidity becomes a disclosure item, not a mechanism, under (a) |
| Proof-of-reserve (`proof-of-reserve.ts`; Chainlink stub THROWS) | **REMOVED** under [M1]/[M4] (nothing to attest); under [M3] **REPLACED-BY** a PoR-style attestation design (none exists — NOT IMPLEMENTED) | PoR status surface retires or becomes a facility dependency |
| Genesis funding story (1.1M USDC → 1M MTQ; DISPROVEN on-chain) | **REMOVED** as economics; retained as a falsified historical record | New-contract program defines its own initialization under D-13.6; on-chain reality never matches the story (baseline §4 genesis row) |
| MARP reserve trades (gold↔stablecoin) | **REMOVED** ([M1]/[M4]: no reserve to trade); under [M3] becomes facility treasury operations (separate role, license review) | Rebalance economics re-scoped to index-weight transitions (deliverable 4 §5) |
| V3 stability pool (sole USDC custody; EMERGENCY deficit cover) | **REMOVED** under [M1]/[M4]; **REQUIRES-OWNER-DECISION** under [M2]/[M3] (capital plan, custody, who bears losses) | No backstop exists after removal — crisis behavior is publication + pause only (D-13.17) |
| `finality-before-mint` L3 reserve-sufficiency layer | **REPLACED-BY** the D-13.6/D-13.7 policy gates + supply-policy ledger checks (deliverable 7 §2.7) | The other six finality layers survive; L3's replacement must be defined before any real mint path exists |
| LCR/FSCR machinery (`blueprint.ts:351`; `engine.ts:1903-1905` LCR<1.00 mint-pause) | **REMOVED** under [M1]/[M4] (no reserve liquidity to ratio); **REBUILT** under [M3] as facility-liquidity gates | Mint gating must be re-keyed on the D-13.15/17 oracle/emergency states instead |
| Custodian allowlist + custody attestations (`proof-of-reserve.ts` custodian list; blueprint custody sections) | **REMOVED** under [M1]/[M4]; **REQUIRES-OWNER-DECISION** under [M2]/[M3] (real custodians do not exist — decision paper §4 fact 6) | Custody attestation claims must disappear from all surfaces until real custodians exist |
| Sleeve structure 80/18/2 + 20% per-ccy cap + DRQS/TGRS/SAE (`mtq-final-reserve-spec.ts`) | **REMOVED** under [M1]/[M4] (no sleeves without a reserve); under [M2]/[M3] facility composition becomes an owner-commissioned modeling task | D-13.4 retires the MITHQAL canon (C-INV-1) or the objective changes |
| TS `ReserveState` 10-token vault + $1.1M split + 50/50 index/reserve gold (`engine.ts` initReserveState) | **REMOVED** (dies with the reserve concept) | F-4 (accounting-only gold separation) closes by REMOVAL under [M1]/[M4] — an honest closure, not a fix |
| On-chain `reserveVault`/`reserveHeldUsd[7]`/`getReserveRatio`/`getLCR` | **REMOVED** in any new contract (V2/V3 are undeployed — no live constraint) | Deployed v1.2/ecosystem vaults remain until D-13.22 disposition |
| Solana reserve-era artifacts (superseded mint, funded authority wallet) | **REQUIRES-OWNER-DECISION** — carried SOL-DEC-1 S-1..S-4 / T12-8 evacuation (independent of the economic model) | Supply statements exclude Solana until DEC-3 resolves (deliverable 9 §1.4) |

---

## 4. Legal-model consequences (per model branch; questions for qualified counsel — NO conclusions asserted; this document is not legal advice)

Standing fact: **no issuer entity, license, counsel engagement, jurisdiction list, or real counterparty exists anywhere in the record** (decision paper §4 fact 6) — every item below is therefore currently unscopeable, and written opinions from qualified counsel in each target jurisdiction are REQUIRED before any public offering, marketing, acceptance-layer operation, or third-party reliance on a published index (decision paper §15).

- **[M1] Floating token + published index.** CAN be claimed: an on-ledger transferable token; a published, versioned, reproducible index methodology; deviation reporting. CANNOT be claimed: backing, collateralization, redemption, peg, stability, any price target ("stable/value" marketing words are prohibited — claims register §B). Counsel questions: token characterization per jurisdiction (commodity/none/other); whether publishing an index while operating a referencing token creates implied-claim/misrepresentation exposure; benchmark-administrator regimes if the index gains usage; AML/money-transmission for the acceptance layer.
- **[M2] Index-linked obligations.** CAN be claimed: a contractual claim against a named obligor with a defined formula, tolerance, remedies, and insolvency rank — once drafted and opined. CANNOT be claimed (until the obligor exists and is hedged): payment certainty, protection above unsecured-creditor rank, protocol-level rights. Counsel questions: near-certain securities characterization if offered publicly; prospectus/licensing; derivative classification; insolvency ranking; cross-border offering rules; enforceability per jurisdiction — all blocking (no obligor entity exists).
- **[M3] Redemption facility.** CAN be claimed: redemption at reference value **only while the facility is live, capitalized, and legally enforceable** — and only with assets, counterparties, gates, haircuts, and the run-distribution rule disclosed. CANNOT be claimed: unconditional redemption, gate/haircut protection, geographic uniformity. Counsel questions: money-transmission/e-money licensing; securities characterization of a redeemable instrument; custody rules; bankruptcy remoteness/perfected interest; AML program for redeemers; consumer-protection duties around gates; cross-border redemption restrictions. **Objective warning stands: this branch is a conventional reserve by another name.**
- **[M4] Two-layer index service + instrument.** Index layer CAN claim: a neutral published dataset with methodology, versioning, freshness, and a no-promises disclaimer. Index layer CANNOT claim: any obligation to any instrument, endorsement, price. Instrument layer claims are that instrument's own D7 questions (could itself be M1/M2/M3 — decided separately per instrument). Counsel questions: benchmark-administrator exposure if widely used; data/IP/fintech service regimes; regulatory separation reduces contagion but closes nothing per-instrument. Brand attachment (which layer carries the MTQ name) is **new decision D-13.23** — a product decision with legal-marketing consequences, only meaningful if [M4] is selected.

---

## 5. Governance architecture (PROPOSED — separation, timelocks, emergency authorities, gates)

### 5.1 Three-role separation (the [M4] structural rule, proposed as the v3.0 default under every model)

| Role | Owns | Must NEVER own | Exists today? |
|---|---|---|---|
| **Index/methodology publisher** (Layer A) | Methodology versions, constituency registry, weight commits, the six-value publication surface | Payment-volume telemetry; any instrument registry state; token supply powers | TS reference layer runs it in shadow mode only |
| **Token issuer / supply executor** (Layers under [M1]/[M2]/[M3]; under [M4] = each instrument's operator) | D-13.6 supply-policy execution, D-13.20 burns, caps/timelock execution | Index methodology; admission decisions | **NO** — every current "issuer" authority is the compromised R-1 EOA (disqualifying) |
| **Payment operator** (Stage E) | Instrument admission/suspension operations, quoting, settlement, refunds | Weights, eligibility scores, MASE inputs (D-13.18 disjointness) | **NO** — 1 SIMULATED pilot bank; no committee (G9 NOT CONDUCTED) |

Supporting councils named by the sibling specs (none exist — all personnel questions are owner decisions): Economic Authority (nominations, D-13.6 advisories), Risk Council (4/7 confirmations, T2/T5), Constitutional layer (membership ratification, envelopes), Emergency Council (2-of-3, T7), payment-admission committee + emergency suspension officer (deliverable 6 §5.2), independent reviewer (CKPT-9). Role holders are named by the owner; the D-13.2 protocol and the Task 12 ⟨OWNER-1..7⟩ ceremony chain govern all key handling.

**Model branch on separation:** under [M1] the token-issuer seat may collapse into the operator; under [M4] the index publisher MUST be organizationally disjoint from every instrument operator (decision paper §8 D8 — capture and free-riding controls); under [M2]/[M3] the obligor/facility entity is a fourth, legally distinct seat defined by counsel. In every branch the index publisher receives no payment telemetry (structural rule 1 of deliverable 6 §2).

### 5.2 Parameter-change timelocks

Existing in-code precedent: V2 constitutional-parameter path with per-layer timelocks (90d/48h/24h/0) and registration-time envelopes (baseline §8 — cited as fact, values UNAPPROVED for v3.0). PROPOSED v3.0 rule set: every economic parameter (weights/envelopes/velocity via deliverable 4 governance; fee classes via D-13.8; D-13.19 settlement parameters; D-13.16 oracle bounds; D-13.17 emergency thresholds) changes only via a published proposal → timelock → execution path whose durations are owner-approved per layer; no absolute fee cap or exemption exists today and adding them is D-13.8-gated; emergency parameters follow §5.3.

### 5.3 Emergency authorities (deliverable 10 §4.4/§6, D-13.17)

Emergency Council (2-of-3) or automatic interlocks enter EMERGENCY on recorded evidence (oracle FAILED/HALTED, depeg, sanctions freeze, settlement breach, governance compromise — a live fact today given R-1/R-2); T7 emergency-suspension is **distinct from normal retirement** in authority, evidence, notice (none; post-hoc ≤24h), and speed; EMERGENCY redemption is PAUSED and the legacy 2.00% code row is unreachable dead code to be deleted (C-INV-4 closure, D-13.17); disclosure clocks 1h initial / 72h full report (PROPOSED); per-chain state publication within a defined window — **structurally impossible today** (no bridge/messaging; D-13.10 dependency). Interim posture: release-controls keep every chain action DENIED (VERIFIED default posture).

### 5.4 Release-gate structure (fail-closed)

11 §25.5 gates all NOT CONDUCTED (`honest-status.ts:37-117`); 8 release controls × 10 actions, all NOT_GRANTED, grants ONLY via the owner-authored authorization file outside git (`release-controls.ts`, VERIFIED); keeper transaction path guarded first-in-tick (live-verified Task 12); worktree secret gate intentionally RED pending D-13.1 (T13-INC-001 — truthful red, not a regression). **Standing rule, restated: no gate is ever advanced by documentation, typecheck, lint, or tests — including this document.**

---

## 6. Decision dependency graph (D-13.3…D-13.23 → modules → gates → blocked steps)

Gate letters are cited from register §A where it speaks (D-13.1–D-13.12); D-13.13–D-13.21 were opened by the wave-1 sibling specs and carry **no register gate letters yet** (register §A predates them — flagged for the orchestrator; stage-of-source noted instead, never invented).

| Decision | Question (short) | Gate (register §A / source) | Modules | Blocks (implementation step) |
|---|---|---|---|---|
| D-13.3 | What MTQΣ is | **Gate B** | A, §2.B, H, §4 | EVERY economic implementation; the claims register |
| D-13.4 | Economic family / clean-slate | **Gate B** | §1.3, A, all | Every v3.0 build target; retiring a family invalidates its docs/tests/contracts |
| D-13.5 | Stability objective | **Gate B** | A, F, L | Stage J benchmark set; GPP relevance |
| D-13.6 | Supply policy + issuer authority | **Gates B/E** | H, J, §3 | ALL issuance code; capacity definition (undefined without it) |
| D-13.7 | Redemption: none-promised vs facility | **Gates B/E** | A, H, I, §3 | All exit-path code + interface language; selects the model column |
| D-13.8 | Fee schedule | **Gate E** (register) | H, I, K | Any real fee; sweep/treasury build |
| D-13.9 | Commercial model validation | **Gate H-adjacent** (register) | K | Revenue build-out; willingness-to-pay evidence first |
| D-13.10 | Cross-chain supply model | **Gate G** (register) | J, H | Any multi-chain supply claim; TC-XC2..6 cases; emergency cross-chain consistency |
| D-13.11 | Max basket size + admission | **Gate C** | B, C, D, F | Registry schema; T3 admissions; IDX-CONT-3 writability |
| D-13.12 | Gold disposition | **Gates B/C** | B, E, F | Gold leg admissibility/pricing rules; F-4 closure |
| D-13.13 | GPP inclusion (Option A/B/C) | Gate B/C (deliverable 5 §13) | F, B, L | GPP feeds; a_j vector; benchmark arms |
| D-13.14 | Rounding/precision/sum conventions | Gate C (deliverable 5 §13) | C, D | bp quantization; exact-sum commits; reconciliation tolerance |
| D-13.15 | Fail-closed DEGRADED redeem | no register letter (deliverable 10, Stage I) | G, H, I | Pricing-path change (breaks current TS behavior by design) |
| D-13.16 | Oracle independence standard | no register letter (deliverable 10) | G, B, E | All pricing/publication validity; ≥3-family procurement |
| D-13.17 | Emergency framework | no register letter (deliverable 10) | G, C, I, §5.3 | Emergency states, disclosure clocks, C-INV-4 deletion |
| D-13.18 | Payment separation invariant + governance | no register letter (deliverable 6, Stage E) | I, §5.1 | Registry build; T-PAY-01 writability |
| D-13.19 | Settlement parameter set | no register letter (deliverable 6) | I | Depeg bands, quote expiry, confirmations, refunds, cadence |
| D-13.20 | Burn taxonomy & authorization | no register letter (deliverable 7, Stage F) | H, §3 | Burn events/roles; caps; re-issue rules |
| D-13.21 | Secondary-market posture | no register letter (deliverable 7) | H, A | Venue role, license review; §2.2 reconciliation claims |
| **D-13.22 (NEW)** | Deployed v1.2 estate disposition (re-label testnet-only legacy / disable mint+redeem / decommission) | Gate B-dependent (this document §2.A/§2.H; interacts with D-13.4/D-13.10) | A, H, J | Any honest estate statement; migration sequencing; decommission execution |
| **D-13.23 (NEW)** | Brand attachment under [M4] (index layer vs instrument layer) | Gate B-conditional (only if M4 selected; decision paper §12 open question) | A, I, K, §4 | Product/marketing claims; endorsement-disclaimer wording |
| Carried chain | Task 12 D8: OWNER-ATT-1 → T12-1/3 → CKPT-2/3/4 → CKPT-5/6/7 → T12-8/T-4.4 → SOL-DEC-1/DEC-3/ECON-DEC-2 → DEC-1..7 → CKPT-9 → RELEASE-GRANTS | security (deliverable 12 §8) | ALL | **Every on-chain step, under every model, before anything else** |

Sequencing rules (decision paper §2 note + §11): **D-13.3 precedes** D-13.4/5/6/7 (the claims question gates the rest); D-13.4 is effectively settled by the D-13.7 model row; D-13.6 and D-13.10 must be consistent (the two supply rules cannot contradict); no implementation row runs before the Task 12 D8 authority chain — the graph's spine is security-ordered, not document-ordered.

```
GATE B (D-13.3 ─► D-13.4 ─► D-13.5 ─► D-13.6 ─► D-13.7)  ◄── this document is itself gated here
   │
   ├─► §2.A object/rights branch table ─► §4 claims map ─► claims-register re-baseline
   ├─► §3 removal plan ─► [M3 branch rebuilds PBC/ABC/DMCE] ─► §2.H supply ops (D-13.20/D-13.21)
   │        └─ D-13.22 (v1.2 estate disposition)
   ├─► §2.B/§2.C/§2.D index core ◄── GATE C: D-13.11, D-13.14   (deliverables 4+5 are a pair)
   │        └─ D-13.12 gold ─► §2.E   D-13.13 GPP ─► §2.F (Option A/B/C preserved)
   ├─► §2.G oracle/emergency ◄── D-13.15/16/17 (register letters pending — flagged)
   ├─► §2.I payment layer ◄── GATE E: D-13.8; D-13.18/D-13.19; GATE H-adjacent: D-13.9 ─► §2.K revenue
   └─► §2.J cross-chain ◄── GATE G: D-13.10; D-13.23 ([M4]-conditional)
            │
   ALL ──► Task 12 D8 authority chain (unsigned) ──► ANY on-chain step
   ALL ──► §2.L validation/gates ──► Stage K families ──► verdicts only by gate-owning processes
```

---

## 7. Assumptions & unresolved questions

- **Assumptions (each falsifiable, none approved):** (1) the no-conventional-reserve objective is a hard constraint — if the owner would accept a reserve by another name, [M3] becomes viable and that is a recorded objective change (decision paper §12); (2) an Economic Authority and councils will be appointed (persons unknown); (3) target jurisdictions will eventually be named (none exist — all §4 legal questions unscopeable until then); (4) oracle multi-source independence is achievable (currently NOT met); (5) the sandbox environmental limits (Foundry, CI runner, long-horizon runs) are environmental, not evidential.
- **Unresolved (beyond the decision table):** the Takaful module's economic role is undefined under all four models (decision paper §12); who funds index publication under [M1]/[M4] (Stage G engines B/C/D NOT IMPLEMENTED); who operates the publication surface day-to-day (an operational seat no sibling spec assigns); placement of the mandatory IDX-DISC-1 "index continuity ≠ exchange-price continuity" disclosure across wallet/explorer/API surfaces (unassigned); the deviation-reporting surface (no market-price feed exists); Solana disposition per model; the velocity-vs-retirement-speed interaction (deliverable 4 §5.5); the register-letter gap for D-13.13–D-13.21; the register's D-13.9 "Gate H-adjacent" / D-13.10 "Gate G" letters vs the stage letters of deliverables 8/9 — flagged, not silently corrected.

## 8. What has NOT been tested / implemented (explicit — the honest close-out)

- **No v3.0 code exists.** Every design element in this document is PROPOSED; no module A–L has been implemented, deployed, or authorized. The deployed estate is untouched and remains the divergent v1.2 pilot under compromised authorities.
- **No model simulated:** the existing backtests/stress suites test the OLD reserve-based family and must not be cited as evidence for any v3.0 model (decision paper §13). No run modeling, tracking-error backtest, or adoption evidence exists.
- **No legal opinion obtained; no counsel engaged; no regulator contacted; no obligor entity, license, counterparty, or jurisdiction list exists.**
- **Not implemented anywhere:** publication surface (all six values), market-price feed/deviation metric, GPP feeds, persisted divisor/publication ledger, payment-instrument registry, settlement/refund machinery, fee sweep, supply-policy ledger, burned-supply ledger, cross-chain supply model, emergency councils, provenance recording.
- **NOT RUN this cycle:** on-chain re-probes (latest anchors remain Task 12's); Foundry suites (no forge — UNVERIFIABLE); CI-runner execution (no remote); canonical-invariants re-run (three environmental kills — recorded UNVERIFIED, never PASS).
- **Zero on-chain actions, zero key handling** (`upload/` and `.env` never opened; zero-key-handling discipline maintained); the worktree secret gate remains intentionally RED pending D-13.1. Nothing in this document advances any gate.

## 9. Owner approvals required (all OPEN — open checkboxes; nothing may be inferred from this document)

**This document itself is gated on Gate B. It selects nothing; it only lays out what each selection would mean.**

- [ ] **D-13.3** — what MTQΣ is (a basket-referenced digital asset / b purchasing-power reference unit / c algorithmically managed monetary token / d hybrid) — Gate B
- [ ] **D-13.4** — which economic family survives, or clean-slate per the selected model — Gate B
- [ ] **D-13.5** — stability objective (USD / basket / global purchasing-power / other defined objective; index-quality objectives only under [M1]/[M4]) — Gate B
- [ ] **D-13.6** — supply policy + issuance authority/caps/timelocks — Gates B/E
- [ ] **D-13.7** — redemption: (a) none promised, or (b) specified facility (accepting the §2.A M3 warnings) — Gates B/E
- [ ] **D-13.8** — fee schedule, recipients, treasury authority, exemptions, caps, change governance — Gate E
- [ ] **D-13.9** — commercial model validation (customer evidence before build) — Gate H-adjacent (register)
- [ ] **D-13.10** — cross-chain supply model — Gate G (register)
- [ ] **D-13.11** — configurable max basket size + admission rules — Gate C
- [ ] **D-13.12** — gold disposition (index leg only / instrument rules / retirement) — Gates B/C
- [ ] **D-13.13** — GPP inclusion (Option A leg / B objective / C exclude) — Gate B/C (deliverable 5)
- [ ] **D-13.14** — rounding/precision/sum/concentration conventions — Gate C (deliverables 4+5)
- [ ] **D-13.15** — fail-closed DEGRADED redeem (incl. the queue-and-reprice alternative) — deliverable 10
- [ ] **D-13.16** — oracle independence standard + per-class bounds — deliverable 10
- [ ] **D-13.17** — emergency framework (triggers, states, disclosure clocks, C-INV-4 deletion) — deliverable 10
- [ ] **D-13.18** — payment separation invariant + payment-layer governance adoption — deliverable 6
- [ ] **D-13.19** — settlement parameter set (bands, expiry, confirmations, rounding, refunds, cadence) — deliverable 6
- [ ] **D-13.20** — burn taxonomy & authorization — deliverable 7
- [ ] **D-13.21** — secondary-market posture (external-only vs project-facilitated venue) — deliverable 7
- [ ] **D-13.22 (NEW, opened by this document)** — deployed v1.2 estate disposition: (i) re-label as testnet-only legacy with mint/redeem disabled at the interface level, (ii) decommission-and-replace after authority migration, or (iii) leave as-is with expanded disclosures — interacts with D-13.4/D-13.10; NO on-chain variant executes before the Task 12 D8 chain
- [ ] **D-13.23 (NEW, opened by this document)** — brand attachment under [M4]: which layer carries the MTQΣ name (index service vs instrument vs both-with-disclaimers) — only meaningful if D-13.3/D-13.4 land in the [M4] family; marketing-law consequences per §4
- [ ] **Carried:** D-13.1 (uploaded key file disposition — the only item blocking a green worktree secret gate), D-13.2 (key-handling protocol), and the full Task 12 D8 chain per deliverable 12 §8 — precondition to every on-chain step listed anywhere above.

Every parameter referenced anywhere in this document — fee rates, RR values, thresholds, envelopes, caps, windows, tolerances — is **UNAPPROVED** and remains an owner decision. Advisory recommendations cited from the decision paper (M1 + M4 separation) are advisory only.

---

## 10. Mandate §4 self-audit (for orchestrator review — a self-check advances no gate)

| Mandate §4 requirement | Where satisfied in this document |
|---|---|
| Complete architecture and change plan, modules A–L | §2.A–§2.L, one section per mandated module in mandate order, each with facets (a)–(h) |
| Per module: existing implementation | facet (a), evidence-cited to baseline §2–§8 and deliverables 4–12 with statuses |
| Per module: intended v3.0 behavior | facet (b); branch tables at A (M1–M4), E (D-13.12), F (D-13.13), H (D-13.6/7/20/21), J (D-13.10), K (model-dependent revenue) — never a selection |
| Per module: dependencies | facet (c) — other modules + decision IDs |
| Per module: breaking changes / migration / tests / risks / acceptance | facets (d)–(h); tests cite `test-matrix-and-results.md` §3 + the named CCY-*/IDX-*/T-PAY-*/T-ORC-*/TC-XC* families |
| Migration implications incl. deployed-v1.2 decommission + compromised-authority sequencing | facets (e) throughout; **D-13.22** (estate disposition) opened; Task 12 D4/D5/D8 chain cited as the spine (deliverables 9/12) |
| Replacement-program rule (no silent renames/deletions) | §0.3 + §3 (mechanism-by-mechanism disposition table with the UNDEFINED-operations warning) |
| Structurally-embedded-reserve evidence | §1.2 (baseline §6 inventory reproduced with file citations) |
| Resulting economic AND legal model defined before deletion | §2.A (holder rights per model) + §4 (claims map per model) + §3 (consequences column) |
| Conditional on owner model selection | §0.1–§0.2; every branch preserved OPEN; §9 checkboxes all unchecked |
| No stablecoin description; no index-guarantees-price implication | Header compliance note, §0.4, §2.A M1 preamble, §4 — negated-usage only (read-back verified this session) |

---

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED**
