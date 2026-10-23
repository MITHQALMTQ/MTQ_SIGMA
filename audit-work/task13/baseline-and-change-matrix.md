# MTQΣ — TASK 13 · STAGE A: BASELINE & CHANGE MATRIX
## Deliverable 2 — audit-work/task13/baseline-and-change-matrix.md

**Mandate:** MTQSIGMA-COO-MANDATE-003 (v3.0). **v2.0 remains the historical baseline; nothing in this document approves or implements v3.0.**
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**
Evidence legend: `VERIFIED` (reproduced this session) · `DEVELOPER-REPORTED` (stated in prior in-repo work, cited) · `SIMULATED` · `PROPOSED` · `UNVERIFIED` · `NOT IMPLEMENTED`.

---

## 0. P0 incident preceding this baseline — T13-INC-001 (VERIFIED)

The mandate message carried an attached private-key file with an instruction to place it in `.env`. **Refused and contained before any other work.** The file was value-safely classified as the **already-known compromised literal C-045-a (R-1)** — not a new key. Full record: `security-incident-private_key-upload` → see `security-incident-private-key-upload-2026-10-22.md` in this directory; approval **D-13.1** opened. **Consequence for this baseline:** the worktree secret gate and one regression test are intentionally RED and stay red until the owner disposes of the file (fail-closed, by design).

---

## 1. Canonical document inventory (mandate Stage A items 1–2) — status per document

| Document | Readable in-repo form | Status |
|---|---|---|
| **v2.0 Consolidated Master Blueprint** (2026-10-19) — the historical baseline for this mandate | `audit-work/blueprint-v2.0.txt` (23,536 lines; pandoc extraction; includes v1.2 + Master Spec v1.0 + Developer Mandate v5.0 + Ext 1–3; §1.5 M1–M13; App. F gates G0–G7) | VERIFIED present. **Not modified by Task 13.** |
| **SSOT v5.0 + extensions v5.1–v5.3** (mandate terms) | `upload/MTQ_SIGMA.rtf` = the mandate document set (MTQSIGMA-SINGLE-SOURCE-OF-TRUTH-006 v5.0 + EXT-1/2/3); three extractions: `audit-work/MTQ_SIGMA-unrtf.txt` (3,148 ln), `MTQ_SIGMA-rtf-extracted.txt` (3,670 ln), `MTQ_SIGMA-rtf-gfm.md` (4,808 ln); implemented by `src/lib/mtq/mandate.ts`, tracked by `docs/MANDATE-COMPLIANCE.md` | VERIFIED present. Mandate-term mapping resolved. |
| Master Monetary Architecture v1.0 (2026-09-08) | `audit-work/blueprint-v1.0.txt` (21,228 ln) **and** `audit-work/v2/blueprint-full.txt` (13,530 ln) — dual extraction of the same docx (**contradiction C-INV-6**: divergent line-number citation systems) | VERIFIED present (duality flagged) |
| Blueprint v1.2 "FINAL CLOSED-LOOP" (2026-09-03) | `audit-work/blueprint-v1.2.txt` (3,271 ln) — legacy 5-currency fixed-quantity family | VERIFIED present, superseded |
| Equation-by-Equation Developer Alignment Specification | `audit-work/v3/eq-by-eq-spec.md` (2,863 ln; RG-01..RG-15; 175-equation audit in `EQUATION-BY-EQUATION-AUDIT-REPORT.md`) | VERIFIED present |
| **MITHQAL v25.3.1 Harmonized** | **NO durable extraction** (one-time /tmp conversion gone). Durable analysis-derived artifacts: `docs/BLUEPRINT-GAP-ANALYSIS.md`, `docs/CORRECTED-BANK-AUDIT.md`, implemented §47–§87 modules | **GAP — binary-only.** A v3.0 redesign quoting MITHQAL verbatim requires a fresh durable extraction (owner action or approved conversion step). |
| Merged editions | `MTQSIGMA-MASTER-BLUEPRINT-V1.0-MERGED.md` / `-FINAL.md` (M1–M9) | VERIFIED present |
| Prior audit deliverables | `audit-work/task10/` (D1–D8), `task11/` (D1–D9 + Task 11.1 corrections), `task12/` (D1–D10 + register + evidence), `v6/`, `v9-task9/`, `docs/MAINNET-AUDIT-REPORT.md` (verdict: NOT mainnet-ready, 12 critical blockers, 2026-09-15) | VERIFIED present (digested in worklog 13-a1) |

**Stage A requirement "do not silently modify v2.0":** honored — no canonical document was edited this session (git delta = new `audit-work/task13/` files + worklog appends only). VERIFIED.

---

## 2. Repository, deployment & services baseline

**Git (VERIFIED):** branch `main` @ `3b26232`; 28 commits, machine-generated UUID subjects; **NO remote** (OWNER-ATT-1 unresolved); no tags; commits unsigned (no GPG config); working tree delta = `worklog.md` + `audit-work/task13/` (new). The Task-12-era "80 file-mode-only unstaged changes" no longer present (recorded; not investigated). Git history still contains both compromised literals in all encodings (Task 12 D3 rewrite plan awaits owner + security-lead approval).

**CI (DEVELOPER-REPORTED + structural verification):** 6 workflows in `.github/workflows/`; `ci.yml` Job 0 = `secret-scan` and all downstream jobs `needs:` it (verified in file). **CI-runner execution UNVERIFIED — no remote exists** (identical commands run locally). `ci.yml` references branch `autonoma-integration` which does not exist; `IMPLEMENTATION.md` describes an Autonoma route/branch absent from the tree (stale doc). Pre-commit hook active in this clone (`.githooks/pre-commit` → `secret-scan.ts --staged`).

**DEPLOYED REALITY (crucial for the change matrix; DEVELOPER-REPORTED from `contracts/deployments/*.json` + prior read-only probes):**
- The deployed testnet estate is the **v1.2 five-currency pilot** (`MTQSigma.sol`: USD/EUR/GBP/JPY/CNY weights 0.389/0.278/0.1669/0.1111/0.055, gold reserve-only, MockUSDC flows) **plus the ecosystem modules** (`MtqEcosystem.sol`: MTQ + Mint + Redeem + ReserveVault + Takaful, admin-set prices, 4/7-threshold Safe declared in source) on Monad (10143), Arc (5042002), Robinhood testnets, plus **one Solana SPL mint** (decimals 18 — anomaly; supply = u64 ceiling; mandated 1M physically unrepresentable at 18 decimals).
- The 7-component `MTQSigmaV2.sol` and the permissioned bank-mediated `MTQSigmaV3.sol` are **SOURCE-READY, NOT DEPLOYED** (`contracts/deployments/MTQSigmaV2-PENDING.json`, status `V3_SOURCE_READY_PENDING_DEPLOY`).
- Deployer/sole authority for all recorded deployments: EOA `0x3C3932F865892EFabE45892f453f81B64f6c8d8c` — the **compromised R-1 key**.

**Services (DEVELOPER-REPORTED):** keeper mini-service (port 3040, the only transactional path — `isActionAllowed("keeper-tx-submission")` is the first statement of `runTick`, live-verified observe-only in Task 12); mtq-feed (port 3003, in-memory simulation WS); 6 Inngest functions all read-only; dev-watchdog. **API surface (VERIFIED structurally by grep):** 0 routes construct a Signer/Wallet or broadcast; only 3 routes write the DB (`simulate/mint`, `simulate/redeem`, `mbg/mint-request` — the MBG gateway is explicitly read-only w.r.t. the chain); `onchain/[chain]` + `roles` are view-only probes.

**Environment:** `.env` exists (50 bytes; **no secret-pattern matches** — count-scan, values never read; VERIFIED). `.env.example` documents 25 variable names **including `DEPLOYER_PRIVATE_KEY` ("TESTNET ONLY — HOT WALLET")** — that entry must be removed in the Stage-H cleanup (never with a real value). `15+ scripts/` read `DEPLOYER_PRIVATE_KEY` from `.env` directly (state-changing scripts; several now retired stubs per Task 12).

---

## 3. Token-generation & contract inventory (mandate Stage A item 4; DEVELOPER-REPORTED at Task 12 fresh anchors: Monad 73,243,944 · Arc 68,520,264 · RH 140,748,341 · Solana slot 513,885,476)

- **18 deployed EVM contracts across Monad/Arc/RH** (34/34 owner-table match, `src/lib/mtq/contracts.ts`); **source/build identity UNVERIFIED for all 18** (no local build matches any runtime; Monad Governance 25,819 B exceeds EIP-170; deployed ecosystem bytecode ≠ repo source).
- **Address-book verdict (Task 12 D6, implemented in `address-book-validation.ts`): `ok=false` — 2 BLOCKER cross-chain hex conflicts** (RH "Takaful" `0x1bbC…6177` == Monad "Reserve"; RH "MockUSDC" `0xFd2B…861e` == Arc "Oracle") + flagged: shared-Safe hex reuse (`0xE718…A7D0`, 1/1, sole owner = R-1 EOA, nonce 0), same-hex/different-runtime Governance pair (`0xE35a…Bd66`; two OZ-Governor builds, params 1/1/1/1, proposer/executor auth UNESTABLISHABLE without sources), RH `canonical:true` (explicitly NOT an approval), mainnet rows vs testnet-only posture. **APPROVED-CANONICAL count: 0 — pending by design (C-041/DEC-1..7).**
- **Generations:** gen-A/B/C EVM twins (Tier-2 provenance; gen-A/C self-custody 1M each inside the token contracts, owner-gated `genesisMint` — the exposed key can inflate these); deployed supplies Monad 310.949 / Arc 1,000 (genesis model 1M→Safe DISPROVEN on-chain; Safe holds 0); no on-chain supply cap (`cap()` absent) on either token.
- **Solana:** current mint `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4` (decimals 18, u64-max supply — deliberate `mintTo(u64::MAX)` 2026-08-10; authority wallet `DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3`, full form VERIFIED in `audit-work/MTQ_SIGMA-unrtf.txt:143` + `contracts.ts:109`; custody UNVERIFIED — CKPT-2); superseded mint authority + funded wallet = **C-045-b (R-2)** — 4.98 SOL drainable by any repo holder.
- **Privileged roles:** every gate (admin/minter/pauser/keeper/oracle ownership, Safe ownership, Solana mint/freeze authorities) ultimately resolves to the **single compromised deployer EOA** — the mandate Stage-H requirement "the compromised deployer cannot be treated as a trusted long-term authority" is currently UNMET on-chain; Task 12 D4/D5 unsigned migration packages + D8 approval chain are the standing remediation path.
- **Redeem-module permission finding:** narrowed to a call-graph-scoped proof (Monad Redeem holds token-MINTER with no executable mint path in the recorded code; grant origin unexplained; module role cells E-15/E-16 unprobed) — **OPEN pending governance disposition.**

---

## 4. Monetary-invariant map (mandate Stage A item 3: invariant → implementation → test → deployment evidence → status)

| Invariant | Implementation (file:line) | Test evidence | On-chain deployment evidence | Status |
|---|---|---|---|---|
| Σ target weights = 1 (hard) | `mandate.ts` INV-7 (L751); `contracts/MTQSigmaV2.sol:518-555` (`submitTargetWeights` requires sum==1e18) | mandate-vectors T-85, genesis seven-step; unit-tested (C-022/T-53) | **IRRELEVANT on-chain: weights machinery (V2/V3) NOT DEPLOYED**; deployed v1.2 has fixed 5 weights | Reference-layer CONFORMANT; on-chain NOT DEPLOYED |
| Per-component envelopes USD 23–32 / EUR 17–24 / JPY 7–12 / GBP 6–11 / CNY 3–7 / CHF 3–7 / Gold 20–32 (%) | `blueprint.ts:78-96`; V2 `:301-302` | eq-audit EQ-062 ✅ | n/a (undeployed) | CONFORMANT (reference) |
| Weight velocity caps 0.50/0.30/0.20% | `blueprint.ts:241-246`; V2 `:305` | EQ-062 noted test-debt F-8 | n/a | CONFORMANT; test-debt recorded |
| Four weight states Prior/Target/Smooth/Execution | `blueprint.ts:98-106` | EQ-001 ✅; three-layer separation held | n/a | CONFORMANT |
| Strategic prior ≠ live weights (27/20/9/8/5/5/26 = anchor only) | `blueprint.ts:119-132` (I3) | EQ-011/013; UI mislabel F-1 documented | n/a | CONFORMANT in engine; presentation violations documented |
| PAR=1.00 immutable; non-USD-peg (P_MTQ = I_t) | `mandate.ts:54-66` | EQ-003 ✅ held — verified live | n/a | CONFORMANT |
| Reserve NAV V_net = Σ Q·P·(1−H), per-asset haircuts | `blueprint.ts:134-160`; `engine.ts:769-844` | EQ-006 ✅; RG-03 PASS (gross/net tension documented) | **Deployed v1.2/ecosystem: NAV is admin-set/USDC-balance based, not this formula** | Reference CONFORMANT; deployed DIVERGES |
| RR tiers 1.10/1.05/1.00 + six-state machine S1–S6 | `blueprint.ts:110-112, 469-489` | EQ-152–154 ✅ 17/17 self-tests | not deployed | CONFORMANT (reference) — **but see contradiction C-INV-1 (RR 1.30 family)** |
| LCR; LCR<1.00 mint-pause | `blueprint.ts:351`; `engine.ts:1903-1905` | EQ-105–107 ✅ | not deployed | CONFORMANT (reference) |
| Redemption proportional to actual basket at NAV (I6) | `engine.ts:2077-2200` (Release_i = net·V_i/V_net); V2 `:1275-1322` | EQ-142–145 ✅ (fee-once) | v1.2 redeem = USDC balance path, not NAV-proportional | Reference CONFORMANT; deployed DIVERGES |
| Fees: mint 0.10%; redeem ladder 0.15/0.50/1.00 (S5 paused, 2.00% EMERGENCY unused)/0.30 recovery; rebalance 0.20% → Operational Wallet, excluded from NAV | `blueprint.ts:162-174, 308-316`; `engine.ts:1908, 2143-2144, 1172-1183` | canonical-invariants fee accrual layer | v1.2: MINT 10bps/REDEEM 15bps (+DEFENSIVE 50/EMERGENCY 200) to vault; V2 commingles fees in reserveVault (audit finding T4/F-FEE-01); V3 feeWallet obligations, **no sweep function exists** | Implemented in reference + contracts; **rate values are UNAPPROVED economic parameters** (mandate §2.8) |
| Genesis: 1.1M USDC → 1M MTQ → Safe | `genesis.ts`; `engine.ts:371-421` | genesis seven-step verify | **DISPROVEN on-chain** (supplies 310.949/1,000; Safe holds 0; no USDC at any recorded address) | Documented; **NOT met on-chain (open)** |
| Gold: index leg (XAU, 20–32%) vs reserve gold (core 20% + buffer) separation (I12) | `blueprint.ts:338-348`; `engine.ts:418-421, 810-819` | EQ-104 (F-4) | n/a | **Accounting-only in pilot** (one physical PAXG+XAUT pot; ~13% index gold vs 26% weight) — must be resolved before production claims |
| MASE (§5–7) | `mase.ts` — **pilot substitute** (equal-α inverse-vol; no covariance/VaR/CVaR/MDD; hard 4-state regime; J(s) eligibility DISABLED; OD-1/OD-5 placeholders) | mandate-vectors (MASE→MARP wiring) | n/a | PARTIAL with 21 NOT-IMPL-GAP items honestly disclosed |
| Oracle quorum/staleness/confidence | Solidity: strict 3-source fail-closed (staleness 60s; conf <1%; dev <2.5%) V2 `:951-1067`/V3 `:1590-1668`; TS: 5 feed states, DEGRADED = mint paused / redeem open (LKG) | scanner + vectors | adapters NOT deployed; TS pilot: **one live upstream per pair with synthetic 3-source witnesses** (§17.10 independence NOT met; disclosed D-oracle-witnesses) | Contracts CONFORMANT-by-design; pilot INDEPENDENCE NOT REAL |

**Prior-audit economic test assets:** 10-year backtest (2015→2025, INV-1..INV-5), 11-scenario stress rerun (fixed seeds), 12-step e2e cycle, canonical-invariants Layers 1–8, Foundry suites (V2 30 tests; V3 LIQ-MGMT 14) **UNVERIFIABLE in sandbox (no forge)**.

---

## 5. THE CHANGE MATRIX — every v3.0 Stage requirement vs current state

Severity: `BLOCKER` (contradicts v3.0 architecture) · `MAJOR` · `MINOR`. Disposition per mandate §16: **I** = implement now (safe, repo-level) · **G** = gate on owner approval (never silently chosen).

### Stage B — no-conventional-reserve monetary model (deliverable 3)

| Requirement | Current state (evidence) | Gap / change required | Severity | Disposition |
|---|---|---|---|---|
| Explicit statement of what MTQΣ IS (basket-referenced asset / purchasing-power unit / algorithmic token / hybrid) | No such statement exists; four families coexist un-reconciled: v1.0/v2.0 adaptive-reserve (7-comp, RR 1.10), MITHQAL 11-currency bank model (RR 1.30, 80/18/2), v1.2 5-currency pilot (deployed), V3 non-custodial bank-mediated (source-ready) — contradictions **C-INV-1/2/3/4** (§11) | New spec with the 10 mandated clauses (reference unit meaning, valuation formula + numeraire, market-price distinction, stability objective, benchmark datasets, inflation/FX/gold treatment, supply policy, no-reserve consequences, holder claims); alternatives + trade-offs, NOT a silent choice | **BLOCKER** | **G (Gate B)**; spec drafted as PROPOSAL next cycle |
| Remove reserve-dependence from economics | Reserve concept is **load-bearing in ~15 modules** (§6 below): RR/FSCR/LCR ladder, PBC→ABC→DMCE issuance-capacity chain, PoR, genesis funding, NAV-proportional redemption, MARP reserve trades, stability-pool deficit cover, on-chain reserveHeldUsd mirrors | Replace-or-delete plan per module; issuance capacity currently has NO alternative mechanism (nothing else computes it) | **BLOCKER** | G (Gate B), then I |
| No undocumented assumption that "the algorithm provides liquidity/redemption" | Current claims regime (honest-status 16 disclosures) does NOT make this claim; but V2/v1.2 redeem pays from vault balances (real testnet USDC/MockUSDC) | Ensure v3.0 interface language cannot promise redemption at reference value absent mechanism | MAJOR | I (spec + UI copy) |

### Stage C — expandable currency constituency engine (deliverable 4)

| Requirement | Current state | Gap / change | Severity | Disposition |
|---|---|---|---|---|
| Versioned, registry-based component model with configurable max size | Basket fixed at 7 **by construction**: `bytes3[7] COMPONENTS` (V2:298), `enum Component` (V2:335), immutable `Q_*`/`BASE_*` constants (V2:277-291), `length !== 7` guard (`chain-index.ts:236-241`), literal union type + 7-entry records (`mase.ts:10-11`, `currency.ts:5-23`), 6-leg oracle board (`oracle.ts:685-742`), 7-slot reserve mirror | New registry schema (stable IDs, metadata, eligibility scores, states CANDIDATE→ELIGIBLE→ACTIVE→WATCH→RETIRING→EXCLUDED, versions, governance refs); config max-size; **contract redesign, not parameterization** | **BLOCKER** | G (design) → I (TS reference layer); contracts only with deployment approval |
| Eligibility scoring with hysteresis, thresholds as symbols, normalization, emergency-separate-from-normal | **Does not exist** — codebase attests "Constituency is STATIC… §4 eligibility scoring not live" (`honest-status.ts:245`); inert candidate lists only (`RESERVE_CURRENCY_UNIVERSE` 11 ccy, `DIGITAL_UNIVERSE` 7 stablecoins in `mtq-final-reserve-spec.ts:397-419`) | Full scoring spec + implementation + recorded decisions | **BLOCKER** | G → I |
| Weight-transition rules (complete target vector, sum-to-one + bounds at every step, redistribution, transition lifecycle, emergency feasibility) | Partial: sum-to-one + envelopes + velocity enforced at submission (V2:518-555; **positive-weights-only — a departure cannot reach 0**); no addition/retirement transitions, no hysteresis, no emergency path | Transition engine + tests proving validity of every intermediate vector; emergency rules distinct from score-driven retirement | **BLOCKER** | G → I |

### Stage D — MASE completion, gold methodology, index continuity (deliverable 5)

| Requirement | Current state | Gap / change | Severity | Disposition |
|---|---|---|---|---|
| Full MASE mathematical definitions (covariance multi-horizon, risk parity, tail risk, tracking error, turnover, penalties, regime detection, priors) | Pilot substitute only (equal-α inverse-vol; hard 4-state; 21 NOT-IMPL-GAP) | Complete methodology + calibration process; **do not claim ensemble effectiveness untested** | MAJOR | G → I |
| Gold component: admissibility, pricing, bounds, confidence, staleness, emergency; no "guaranteed floor" language | Gold = XAU index leg 6 (envelope 20–32%; price source gold-api.com single live family; PAXG/XAUT are reserve instruments + depth feed, NOT the price source; FRED London fix discontinued → Yahoo GC=F for history) | Gold methodology spec; source-independence requirement unmet (same oracle finding) | MAJOR | G → I |
| Chain-linked index continuity with divisor adjustment; composition change ≠ artificial gain/loss; separate publication of index level, reference value, market price, deviation, freshness, component/weight version | Chain-linked index EXISTS (`chain-index.ts`, COO-17 base-relative basis, divisor D_t; backtest asserts <15% vs Laspeyres; genesis seven-step verifyIndexBase) — **but composition-change continuity tests do not exist because composition cannot change** (static 7) | Continuity test suite for add/retire transitions; publication surface for the 6 values; **index continuity ≠ exchange-price continuity disclosure** | MAJOR (tests BLOCKER for Stage C) | I (tests, once Stage C spec lands) |

### Stage E — payment-instrument registry separate from basket (deliverable 6)

| Requirement | Current state | Gap / change | Severity | Disposition |
|---|---|---|---|---|
| Independent registry for accepted payment instruments (stablecoins/CBDCs/bank rails) with full metadata | **Does not exist.** Only registry is the asset registry whose members ARE basket instruments (USDC/USDP/USDT/EURC/GBP-TBD/JPY-TBD/CNY-TBD/PAXG/XAUT, `registry.ts:57-115`); bank machinery (bank-registry 1 SIMULATED pilot bank; three-book; finality-7) is institution-level, not instrument-level | New registry + separation invariant (payment volume must not alter weights; membership changes must not auto-disable instruments) | **BLOCKER** | G (design) → I |
| Stablecoin verification (contract identity, issuer/redemption info, finality vs balance receipt, depeg rules); CBDC = authorized interfaces only, SIMULATED/NOT CONNECTED labels | MockUSDC on testnets (6 decimals); V3 stability pool = sole USDC custody; settlement = off-chain obligations (`RedeemSettlement` events); all bank/settlement = SIMULATED reference data (disclosed) | Spec + labels; no real stablecoin/CBDC settlement exists or is claimed | MAJOR | G → I |

### Stage F — issuance/burn/purchase/redesign (deliverable 7)

| Requirement | Current state | Gap / change | Severity | Disposition |
|---|---|---|---|---|
| Six distinct operations (acquisition / secondary purchase / issuance / burn / redemption / transfer-cross-chain) with per-operation spec | Conflated: TS `applyMint` = USDC-gated basket purchase (LCR-paused); V2 `mint` has NO role gate (USDC is the gate) while `MINTER_ROLE` is declared-but-unenforced; V3 = bank-mediated + keeper, caps $500K/tx, 5% DMCE, circuit breaker 10%; v1.2 deployed = permissionless-with-USDC at admin-set prices; `genesisMint` owner-gated on gen-A/C (**R-1 can inflate**) | Distinct-operation spec; role separation, caps, timelocks; **fix the declared-but-unenforced `MINTER_ROLE` in any V2 descendant**; retire or govern genesisMint | **BLOCKER** | G (Gate E) |
| No unapproved minting role creating unlimited supply; no redemption promise at reference value without mechanism | Every authority resolves to the compromised EOA today; deployed tokens have **no supply cap**; redemption exists only as vault-balance/testnet flows | Cross-links to Stage H authority migration (Task 12 D4/D5) + supply policy (Stage B) | **BLOCKER** | G (carried CKPT chain) |

### Stage G — honest revenue architecture (deliverable 8)

| Requirement | Current state | Gap / change | Severity | Disposition |
|---|---|---|---|---|
| Disclosed configurable fees with basis/asset/recipient/exemptions/caps/disclosure; rates = unapproved parameters | Fees exist in code (mint 0.10% everywhere; redeem ladder; rebalance 0.20%): V3 separates feeWallet obligations (**no sweep function**); V2/v1.2 commingle fees with collateral (T4 finding); no exemptions/caps anywhere; no treasury policy code | Fee spec with all mandated fields; treasury wallet design (independently controlled); double-charge prohibition; **no fee is charged on mainnet — nothing is deployed production-side** | MAJOR | G → I |
| Revenue streams B/C/D (payment services, institutional software/APIs, research/licensing) + fairness rules + profit measurement incl. owner's "operating result = revenue − all operating costs" | **Not implemented anywhere.** Owner's COO-message "two-part business / three revenue engines" steer recorded as PROPOSED input (unapproved, unvalidated); no customer-evidence artifacts exist | Commercial model with editable assumptions; validate willingness-to-pay BEFORE building; disclosure rules (no yield/promises; minted tokens ≠ revenue; reference value ≠ revenue entry) | MAJOR | G → I (model + docs first) |

### Stage H — cross-chain supply, security, authority (deliverable 9)

| Requirement | Current state | Gap / change | Severity | Disposition |
|---|---|---|---|---|
| Canonical network/contract registry + explicit cross-chain supply model + reconcile supply across networks + prove no duplicate-supply paths | Three EVM testnets + Solana; **no cross-chain supply model exists** (no lock-and-mint/bridge code; each chain independently deployed; gen-A/C 1M self-custody pots); address book ok=false; canonical UNSELECTED | Supply-model decision (D-13.10; corrected from a prior mislabel of D-13.12, which is the gold-component disposition — orchestrator correction 2026-10-22); consolidate Task 12 D4/D5/D6/D8 into the deliverable-9 review; **no "own blockchain" claims** (none made) | **BLOCKER** | G (model) + carried approvals |
| Compromised deployer not a trusted long-term authority; unsigned migration packages + multisig design | Task 12 D4 (Safe-B 4-of-7, grant-before-revoke, handover window disclosed, blockers: signers unbound/factory policy/ECON-DEC-2/destinations) + D5 (S-1..S-7; evacuate-then-revoke) exist UNSIGNED; **not executed**; both keys remain fully privileged at fresh anchors | Execution remains approval-gated (D8 chain: OWNER-ATT-1 → T12-1/3 → CKPT-2/3/4 → 5/6 → 7); T13-INC-001 adds a copy-location class but no new key | **BLOCKER (carried)** | G — unchanged |
| Estate not claimed "secured" merely because working tree is clean | Honest: clean-scan caveats everywhere; history still contains literals; remote/CI/backups/clones/uploads UNVERIFIED | Maintain; re-run census after D-13.1 | MAJOR | I (status quo maintained) |

### Stage I — oracle & economic failure handling (deliverable 10)

| Requirement | Current state | Gap / change | Severity | Disposition |
|---|---|---|---|---|
| Fail-closed behavior for 12 scenarios (stale prices, source disagreement, manipulation, gold disruption, depeg, CBDC outage, congestion/reorg, x-chain delay/replay, abrupt admission/removal, deviation, constraint-violating model output, governance compromise); reference-data outages separated from payment-instrument outages | Contracts: strict-3 fail-closed quorum (staleness 60s, conf 1%, dev 2.5%) — by design, NOT DEPLOYED; TS pilot: mint fail-closed / **redeem fail-open on DEGRADED (LKG)** — a disclosed divergence; single live upstream per pair (independence NOT met); no depeg/bridge/reorg/governance-compromise handlers exist | Emergency-state spec covering all 12 with the restricted-state definitions; separate suspension scopes | **BLOCKER** (re: fail-open redeem) | G → I |
| No silent stale-price reuse; no dangerous rebalance on deterministic success | TS staleness bounds exist (60/120s classes); MARP rebalance has no oracle-emergency interlock in pilot | Wire emergency states into rebalance path | MAJOR | I |

### Stage J — independent quantitative validation (deliverable 11)

| Requirement | Current state | Gap / change | Severity | Disposition |
|---|---|---|---|---|
| Reproducible pipeline vs baselines (fixed-weight basket, single-currency, gold-static, purchasing-power), multi-window + crisis testing, leakage-controlled split, 9+ measurement families | 10-yr backtest (2015–2025) + 11-scenario stress + Monte-Carlo (stale 5-currency economics) exist; **no leakage-controlled split, no purchasing-power benchmark, no train/val/test discipline, no sensitivity suite** | Build pipeline; do not select on calibration data; no simulation proves future stability | MAJOR | I (research tooling — safe) |

### Stage K — tests & acceptance (deliverable 13)

| Requirement | Current state | Gap | Severity | Disposition |
|---|---|---|---|---|
| 17 mandated test families (membership transitions, hysteresis, score boundaries, weight sum/bounds after every transition, index continuity, oracle staleness/disagreement, instrument suspension, settlement finality, quote expiry/rounding/refunds, issuance/burn authorization, fee accounting, cross-chain supply reconciliation, privilege escalation, emergency pause/recovery, reference-vs-market reporting, shadow-mode enforcement) | Partial: sum-to-one/envelopes/velocity, oracle classes, release-controls 13/13, address-book 12/12, scanner 12/12, shadow-mode enforcement (release-controls + honest-status), e2e/stress/backtest exist; **constituency/hysteresis/continuity/finality families cannot exist until Stages C/E land**; known-stale Case C divisor assertion documented; Foundry suites UNVERIFIABLE in sandbox | Implement as the specs land; verify economic invariants, not execution; environmental limits = UNVERIFIED | MAJOR | I (incremental) |

---

## 6. Reserve-dependent assumption inventory (mandate Stage A item 5) — code, with what breaks if removed

**Reference TS layer:** `proof-of-reserve.ts` (RR= backing/liability; custodian allowlist; Chainlink PoR stub THROWS "not yet wired"; pilot fallback synthesizes attestation with hard-coded 80/18/0.02 composition) · `protected-backing-cell.ts` (§47 AvailableBacking = Recognized − Encumbered − Allocated; 11 eligibility checks; 4 SIMULATED cells; `maxMtqIssuanceUsd = availableBacking/1.30`) · `mtq-final-reserve-spec.ts` (**the controlling MITHQAL-family canon**: RR 130/105/100; sleeves 80/18/2; per-currency cap 20%; DMCE grossCapacity = verifiedBacking/1.30; DRQS; TGRS/BRI/SAE) · `available-backing-certificate.ts` (ABC → V3 BM-11 gate) · `genesis.ts` (1.1M USDC genesis funding; RR 1.10) · `engine.ts` (ReserveState 10-token vault incl. PAXG/XAUT; $1.1M split; 50/50 index/reserve gold; NAV/LCR; applyMint = basket acquisition; applyRedeem = proportional liquidation; MARP gold↔stablecoin trades) · `finality-before-mint.ts` (7-layer gate whose L3 input is reserve sufficiency).

**Contracts:** V2 `reserveVault` + `reserveHeldUsd[7]` mirror + `getReserveRatio/getLCR` + USDC-pull mint + proportional redeem; V3 non-custodial mirror + stability pool (sole USDC custody, EMERGENCY deficit cover); v1.2/ecosystem vault-balance economics.

**Docs/blueprint:** RR-decay solvency model (DELIVERABLE-F), genesis funding, gold reserve core+buffer, redemption-at-NAV (I6), custody attestations, 1.30-canon vs 1.10-blueprint (**C-INV-1**).

**What breaks:** issuance capacity (PBC→ABC→DMCE is the ONLY mechanism computing it), mint/redeem pricing (NAV-based), solvency states (S1–S6 keyed on RR), LCR pause, MARP, PoR status surface, V3 workflow BM-11 gate, genesis story. A no-reserve v3.0 must supply a replacement for each or remove the operation honestly (mandate §4.9: the absence must be documented with its consequences for redemption/liquidity/holder risk).

## 7. Fixed-size-basket assumption inventory (mandate Stage A item 6)

Seven-component hard-coding: `blueprint.ts:22-30` (prior), `:55-62` (fixings incl. CHF 1.13 fix, XAU 2500), `:78-96` (envelopes), `:241-246` (velocity); `chain-index.ts:236-241` (`!== 7` throw), prior vector `:856`; `mase.ts:10-11`; `currency.ts:5-23`; `genesis.ts:120-128`; `registry.ts:57-115`; `oracle.ts:685-742` (6 legs); V2/V3 `bytes3[7]`, `uint256[7]`, enum, immutable constants, `submitTargetWeights` **positive-weights-only**, `setEnvelopes` cannot change count; all loops `i < 7`; deployed v1.2 = 5-currency fixed (gold reserve-only); gold position hard-coded at index 6 with envelope [0.20, 0.32] + legacy 26.25%±3% clamps (`MtqEcosystem.sol:143,159` targetGoldWeight 0.2625 range [0.22,0.30]); stale 5-currency artifacts flagged (`monte-carlo.ts:6`, `scripts/audit-basket.ts`) — must not be mistaken for the design.

## 8. Fee implementation inventory (mandate Stage A item 7 — from code, not design paragraphs)

VERIFIED from source: mint 0.10% (V2 `:709`, V3 `:523`, v1.2 `MINT_FEE_BPS=10`, ecosystem `mintFeeBps=10`, TS `MINT_FEE_BPS 10`); redeem ladder 0.15/0.50/1.00% + EMERGENCY 2.00% (paused) + RECOVERY 0.30% (TS `:168-174`; V2 `:710-716, 796-803`); v1.2 DEFENSIVE 50 / EMERGENCY 200 bps; rebalance 0.20% (`blueprint.ts:316`, `marp.ts:168`); fee-change governance: V2 constitutional-parameter path with per-layer timelocks (90d/48h/24h/0) and registration-time envelopes — **no absolute fee cap, no exemptions, no transfer fee anywhere**; recipients: V2/v1.2 → reserveVault (commingled — audit T4), V3 → feeWallet obligation ledger (**no sweep/claim function exists**), ecosystem → Mint/Redeem contracts hold the USDC; events carry `feeUsd`; TS treasury sweep = constants only (`TREASURY_SWEEP_THRESHOLD_USD=10_000`, authority "4/7 Multi-Sig Cold Treasury"), **no sweep execution code**. **All rates remain UNAPPROVED economic parameters** (mandate §2.8).

## 9. Fresh security & release-gate re-run (2026-10-22 — commands, results, honest interpretation)

| Check | Result | Interpretation |
|---|---|---|
| `bun run security:scan` (worktree, 2,183 files) | **FAIL — 1 finding** (`upload/private_key.txt`, rule `known-compromised-literal-C-045-a`; 14 documented suppressions; all other files clean) | **Truthful red caused by T13-INC-001.** Gate works as designed; green resumes only after D-13.1. NOT a regression. |
| `bun run security:scan -- --path upload/private_key.txt` (scanner CLI `--path`) | FAIL (same single finding, value-redacted) | Classification evidence; value never printed |
| `bun run typecheck` | **PASS** (exit 0) | No type drift |
| `bun run lint` | **PASS** (exit 0) | Zero findings |
| `bun test` (the 37-test security suite: scanner regression + release-controls + address-book) | **36 pass / 1 fail** — failure = "worktree currently PASSES the gate" test | Same single cause; 12/12 scanner behavioral cases pass; release-controls 13/13; address-book 12/12 |
| `bun run check:no-neon` | **PASS** (45 routes) | No Neon/Postgres imports in API layer |
| `bun src/lib/mtq/__tests__/canonical-invariants.ts` | First run exceeded the 420s command window during Layer 7 (stochastic, fixed seeds) under sandbox contention; background re-run launched — final status in `test-matrix-and-results.md` | Environmental limitation recorded honestly; last recorded PASS (exit 0) at Task 12 with zero source changes since |
| Foundry suites (`forge test`) | **UNVERIFIABLE in sandbox (no forge)** | Recorded as UNVERIFIED, never PASS |
| Release gates (11 × §25.5, `honest-status.ts:37-117`) | All `passed:false` (NOT CONDUCTED); `isProductionAuthorized()` false on testnet | Unchanged; no gate advanced by any result above |
| Release controls (`release-controls.ts`) | 8/8 NOT_GRANTED; only `database-write` reachable in default posture | Task-12 fail-closed posture maintained; keeper guard live-verified (Task 12) |
| On-chain re-probe | **NOT re-run this session** (last fresh anchors: Task 12 — Monad 73,243,944 · Arc 68,520,264 · RH 140,748,341 · Solana slot 513,885,476; hashed evidence) | Next re-anchor due when deliverable 9 work begins |

## 10. Unknowns (explicit), with severity

1. **UNVERIFIED:** remote/hosted repo, CI logs, backups, clones, session-storage retention (OWNER-ATT-1) — CRITICAL carry; today's incident proves the chat/upload channel itself is a live exposure path. 2. **UNVERIFIED:** all 18 contract source identities; Governor proposer/executor auth; SafeProxy canonical comparison; DbFjz custody (CKPT-2); Squads identity (NULL probe); CI-runner execution; historical commit signatures; MITHQAL v25.3.1 verbatim text (binary-only). 3. **OPEN findings:** Redeem-module MINTER grant origin; E-15/E-16 role cells; genesis model vs on-chain reality; oracle source-family independence; canonical selection (0 approved). 4. **NEW this session:** `upload/private_key.txt` disposition (D-13.1) and host-level access control over the root-owned upload directory.

## 11. Cross-document contradiction register (v3.0 must resolve; from 13-a1 digest)

| ID | Contradiction | Impact |
|---|---|---|
| C-INV-1 | RR target **1.10** (`blueprint.ts:110`, v1.0/v2.0 family) vs **1.30e18** (`MTQSigmaV3.sol:255`, `mtq-final-reserve-spec.ts:80,122`, MITHQAL family) | Highest-impact economic fork |
| C-INV-2 | 7-component adaptive basket (v1.0/v2.0) vs 11-currency MITHQAL (80/18/2) vs deployed 5-currency v1.2 | Basket-model fork |
| C-INV-3 | Six-state (S1–S6) vs five-status risk machines (blueprint self-conflict; V2 implements 5) | State-machine fork |
| C-INV-4 | EMERGENCY redemption PAUSED (S5) vs legacy 2.00% EMERGENCY fee row | Emergency semantics |
| C-INV-5 | §17.2 median-of-3 vs §17.5 outlier-mean vs §17.4 gold median (superseded at v2.0 §17.5 — disclosed) | Oracle aggregation |
| C-INV-6 | Dual extractions of the v1.0 docx with divergent line-citation systems | Citation hygiene |
| C-INV-7 | Honest-status mask 0x7FF (11-bit, MERGED M9) vs 0xFFF (12-bit) vs V3 code 0x3FFF with a "0xFFF — 12 bits" header comment (code-vs-comment bug, VERIFIED by 13-a2) | Doc bug to fix in v3.0 rewrite |
| C-INV-8 | "R-1/R-2" namespace collision (Task 11.1 risk matrix vs Task 10 D7 remediation IDs vs v6 register) | Register hygiene |
| C-INV-9 | Early-session record "key stays in .env" vs census-era ".env clean" (early placement removed before censuses; historical record preserved) | Historical record note |
| C-INV-10 | V2 contract commingles fees with collateral (breaks §20.2/§20.4) while the reference engine conforms | Contract-design fix required in any V2 descendant |

## 12. Recommended disposition & required approvals (nothing auto-executed)

- **Implement now (safe, repo-level, next cycles):** Stage B–J PROPOSAL documents with alternatives (never silent choices); constituency-registry schema + scoring + transition design; index-continuity test suite; payment-instrument registry design; emergency-state spec; quantitative-validation pipeline; `.env.example` `DEPLOYER_PRIVATE_KEY` entry removal (documentation of a forbidden pattern); doc-bug fixes (C-INV-7 comment, stale IMPLEMENTATION.md/autonoma references).
- **Owner-approval-gated (never implemented silently):** every monetary semantic (Gate B); every fee rate; supply/decimals/canonical decisions (DEC-3/SOL-DEC-1/DEC-1..7 carried); all on-chain migration execution (Task 12 D8 chain); git-history rewrite (T12-1); disposition of the uploaded key file (D-13.1); any live pilot (Gate I).
- **Standing carries unchanged:** both keys REAL + fully privileged; history unwritten; remote unverified; Task 12 D4/D5 execution-ready-unsigned.

*Stage A ends here. Stages B–J specification drafting (deliverables 3–12) proceeds next as PROPOSALS with explicit alternatives, per mandate §16.*
