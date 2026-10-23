# MTQΣ — TASK 13 · Fee & Commercial Revenue Model (deliverable 8, Stage G)

**Mandate:** MTQSIGMA-COO-MANDATE-003 (v3.0) Stage G + MTQSIGMA-COO-MANDATE-004 §9 (revenue model; the §9 scenario/unit-economics content lives in the sibling file `revenue-and-unit-economics.md` — this document is the **fee architecture**; both together satisfy §9).
**STATUS: PROPOSED v1 — DRAFT FOR OWNER APPROVAL.** Nothing in this document is chosen, implemented, or authorized. **No fee rate is approved by being written here.** All rates below are UNAPPROVED economic parameters (mandate §2 rule 8: research inputs, never decisions). Approvals: **D-13.8** (fee schedule), **D-13.9** (commercial model), **D-13.24** (new — §5 separation policy).
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

Evidence-status legend (per `README.md`): `VERIFIED` (independently reproduced this session from cited source) · `DEVELOPER-REPORTED` (stated by prior in-repo work, cited) · `SIMULATED` · `PROPOSED` · `UNVERIFIED` · `NOT IMPLEMENTED`. The fee inventory (§1) is **DEVELOPER-REPORTED from `baseline-and-change-matrix.md` §8** unless a row is marked `VERIFIED` (spot-checked from source this session). All design content (§2–§8) is `PROPOSED`. Nothing below advances any release gate (standing rule: docs/tests/typecheck/lint never advance gates).

---

## 0. Purpose & scope

- Define the **v3.0 fee architecture**: what may be charged, for which disclosed service, on which basis, in which asset, to which recipient, under which caps/exemptions/refund rules, with which change governance — all as PROPOSALS mapped to owner decision **D-13.8**.
- Record the **existing fee implementation inventory** from code, not design paragraphs (baseline §8), including the four carried fee defects any v3.0 descendant must fix: (i) fee **commingling** with collateral in V2/v1.2/ecosystem (audit finding T4; contradiction C-INV-10), (ii) V3's obligation-only `feeWallet` with **no sweep function**, (iii) the V2-style vs V3-style **fee-semantics divergence**, (iv) the dead-code 2.00% EMERGENCY redeem row vs the deployed v1.2 divergence (C-INV-4 family).
- State the **prohibited revenue recognitions** (§3, mandate §9 verbatim rules) and the owner's standing profit identity.
- Define **fairness and disclosure rules** (§4) and the **commercial–methodology separation** (§5) that keeps fee income from ever touching basket composition.
- Out of scope (in the sibling revenue file): the four-stream commercial model, low/base/high scenario structure, cost model, unit economics (`revenue-and-unit-economics.md`). Out of scope here per sibling specs: supply operations (`issuance-burn-and-market-mechanism-spec.md`), settlement parameters (D-13.19), payment governance (D-13.18).

---

## 1. Existing fee implementation inventory (DEVELOPER-REPORTED, baseline §8; rows marked VERIFIED were re-read from source this session)

**Honest frame:** fees ARE implemented in code — contrary to any design-docs-only impression — but **only on testnet/simulation surfaces**; no fee is charged anywhere in production because nothing production-side is deployed (deployed estate = v1.2 pilot + ecosystem modules at admin-set prices with MockUSDC flows; V2/V3 are SOURCE-READY, NOT DEPLOYED). Every rate is an UNAPPROVED parameter. **All 18 deployed contract source identities are UNVERIFIED** (baseline §3), so deployed-fee claims inherit that caveat.

### 1.1 Rate inventory (per generation; `VERIFIED` = source re-read this session)

| Fee | v1.2 pilot (DEPLOYED) | Ecosystem modules (DEPLOYED) | V2 (source-ready) | V3 (source-ready) | TS reference layer |
|---|---|---|---|---|---|
| Mint | 0.10% `MINT_FEE_BPS=10` (`MTQSigma.sol:64` VERIFIED) | 0.10% `mintFeeBps=10` (`MtqEcosystem.sol:188` VERIFIED) | 0.10% `mintFee=0.001e18` (`:709` VERIFIED) | 0.10% `mintFee=0.001e18` (`:523` VERIFIED) | 0.10% `MINT_FEE_BPS=10` (`blueprint.ts:168` VERIFIED; §19.7 state-independent) |
| Redeem NORMAL | 0.15% `REDEEM_FEE_BPS=15` (`:65` VERIFIED) | 0.15% `redeemFeeBps=15` (`:213` VERIFIED) | 0.15% (`:710`, `:798` VERIFIED) | 0.15% (`:524`, `:1495`) | 0.15% (`blueprint.ts:170`) |
| Redeem STRESS | — (no stress rung in v1.2) | — | 0.50% (`:713`, `:799`) | 0.50% (`:526`, `:1496`) | 0.50% (`blueprint.ts:171`) |
| Redeem DEFENSIVE | 0.50% = 50 bps (`:179` VERIFIED — **v1.2's "defensive" equals TS "stress"**) | — | 1.00% (`:714`, `:800`) | 1.00% (`:527`, `:1497`) | 1.00% (`blueprint.ts:172`) |
| Redeem EMERGENCY | **2.00% = 200 bps and redemption stays OPEN** (`:180` VERIFIED) — the only live 2.00% rung | — | 2.00% (`:801` VERIFIED) **but DEAD CODE** — `redemptionAllowed` returns false in EMERGENCY (`:808-810` VERIFIED) | 2.00% (`:1498` VERIFIED) **DEAD CODE** — `:1502-1504` VERIFIED | 2.00% marked "UNUSED — redemption is PAUSED in S5" (`blueprint.ts:173` VERIFIED; `engine.ts:2135-2138` VERIFIED pauses) |
| Redeem RECOVERY | — | — | **0.50% (stress rate) (`:802` VERIFIED)** | **0.50% (`:1499` VERIFIED)** | **0.30% (`blueprint.ts:174`) — TS-only value; both contracts diverge from it** |
| Rebalance | — | — | — | — | 0.20% `REBALANCE_FEE_BPS=20` (`blueprint.ts:316` VERIFIED; §20.4 "→ Operational Wallet"; `marp.ts:151` `protocolFeeUsd` VERIFIED) |
| Transfer fee | **None anywhere** (baseline §8; VERIFIED absence — adding one is D-13.8-gated) | None | None | None | None |

**C-INV-4 divergence, stated precisely (VERIFIED both sides):** the TS reference, V2, and V3 all *pause* redemption in EMERGENCY, making their 2.00% row dead code; the **deployed v1.2 pilot keeps redemption open at 2.00%**. A v3.0 must reconcile this (pause vs fee-raise are different safety philosophies) inside D-13.8 + deliverable 10's emergency-state spec.

**Newly verified nuance (this session, adds to the register):** the RECOVERY rung is **0.30% only in the TS reference**; V2 (`:802`) and V3 (`:1499`) both return the STRESS rate (0.50%) for RECOVERY. The "RECOVERY 0.30%" figure must therefore not be quoted as a system-wide fact. Also v1.2's ladder (15/50/200) maps to different rungs than the reference ladder (15/50/100 + paused emergency + 30 recovery) — same names, different economics.

### 1.2 Fee-semantics divergence (VERIFIED; must be normalized under D-13.8)

- **Deduct-from-payment** (fee reduces what the payer's money buys): v1.2 `MTQSigma.sol:153-154` VERIFIED; ecosystem `MtqEcosystem.sol:199-200` VERIFIED; **V2** `MTQSigmaV2.sol:1253-1257` VERIFIED (`feeUsd` subtracted before computing minted tokens); **TS reference** `engine.ts:1908-1910` VERIFIED (`netUsd = inputUsd − feeUsd; minted = netUsd/price × throttle`).
- **On-top obligation** (fee does NOT reduce what the payer receives; it accrues as a separate obligation): **V3** `MTQSigmaV3.sol:1043-1046` VERIFIED (`accumulatedFees += amountUsd·mintFee/1e18`, minted quantity unaffected) and redeem `:1133-1140` VERIFIED.
- Consequence: the same "0.10% mint fee" costs the payer different amounts depending on generation. Deliverable 7 §3.4 makes the fee-application order (fee → net → quantity, rounded per the declared rule) a single v3.0 rule; **D-13.8 must pick the semantics** and both must be stated on every quote.

### 1.3 Fee recipients & treasury reality per generation

| Generation | Fee recipient | Reality (status) |
|---|---|---|
| v1.2 (deployed) | `reserveVault` — "receives USDC collateral + fees" (`MTQSigma.sol:82` VERIFIED) | **Commingled with collateral** — audit finding T4; C-INV-10 |
| Ecosystem Mint/Redeem (deployed) | The module contracts themselves hold the USDC (VERIFIED `:199-227`) | Commingled module balances; no treasury separation |
| V2 (source-ready) | `reserveVault` — mint pulls the FULL `usdcAmount` including the fee (`MTQSigmaV2.sol:1250` VERIFIED) | **Commingled** (T4/F-FEE-01; C-INV-10) — must be fixed in any V2 descendant |
| V3 (source-ready) | `feeWallet` obligation + `accumulatedFees` counter (`:464`, `:467` VERIFIED); `FeesCollected` event (`:470`); `Err102_FeeWalletNotSet` (`:148`); `setFeeWallet` gated `onlyConstitutionalCouncil` (`:2151` VERIFIED) | **Obligation-only, NO sweep/claim/withdraw function exists** (VERIFIED absence this session; baseline §8) — fees are tracked but cannot be collected |
| TS reference | Fees accrue to `treasury.hotWalletUsd` — "Operational Wallet — excluded from NAV" (`engine.ts:1174` VERIFIED; canonical-invariants asserts the §20.4 routing) | In-engine accounting only; **no external treasury wallet/custody exists anywhere** |

**TS treasury-sweep nuance (correction to a Stage-A phrasing):** baseline §8 and the deliverable-8 stub say "no sweep execution code exists." Precisely (VERIFIED): `engine.ts:3337-3353` (`maybeTreasurySweep`, §13.2) DOES implement an in-engine sweep — hot-wallet surplus above `TREASURY_SWEEP_THRESHOLD_USD = 10_000` (`blueprint.ts:566` VERIFIED) moves to a `coldTreasuryUsd` state field, authority labeled "4/7 Multi-Sig Cold Treasury" (`blueprint.ts:567` VERIFIED). This is **state-model simulation only**: no on-chain sweep, no external wallet, no custody, no 4/7 cold-treasury institution exists. The inventory correction is recorded here and in the final report; the substantive conclusion (nothing collectable exists end-to-end) is unchanged.

### 1.4 Fee-change governance that exists today (DEVELOPER-REPORTED baseline §8; key lines VERIFIED)

- **V2 constitutional-parameter path:** `PARAM_MINT_FEE`, `PARAM_REDEEM_FEE_NORMAL/STRESS/DEFENSIVE` (`MTQSigmaV2.sol:856-859` VERIFIED) with a governed setter (`:938-941` VERIFIED) under per-layer timelocks (90d constitutional / 48h monetary / 24h risk / 0 execution — DEVELOPER-REPORTED, baseline §8) and registration-time envelopes.
- **TS `PARAMETER_REGISTRY` envelopes** (`blueprint.ts:416-419` VERIFIED): `MINT_FEE_BPS` [0,100] · `REDEEM_FEE_NORMAL` [0,100] · `REDEEM_FEE_STRESS` [0,200] · `REDEEM_FEE_DEFENSIVE` [0,500] bps; `REBALANCE_FEE_BPS` [0,100] (`:443` VERIFIED); MONETARY-layer changes via "DAO Vote (51%)" with 48h timelock (`:464` VERIFIED).
- **Gaps (all generations):** **no absolute fee cap** (envelopes bound registration, not lifetime totals), **no exemptions**, **no refund-of-fee-on-failure rule**, **no public fee-schedule publication surface**, and **no transfer fee** anywhere.

### 1.5 Fee flow per operation, per generation (DEVELOPER-REPORTED; consolidates issuance spec §2/§4 fee rows)

| Operation | v1.2 (deployed) | Ecosystem (deployed) | V2 (source) | V3 (source) | TS reference |
|---|---|---|---|---|---|
| Primary acquisition | fee 10 bps **deducted from payment**; USDC (incl. fee) → vault (`:153-166` VERIFIED) | fee 10 bps deducted; USDC held by module (`:199-203` VERIFIED) | fee deducted from payment; **full amount incl. fee pulled to `reserveVault`** (`:1250-1257` VERIFIED) | fee **on-top obligation** to `feeWallet`, minted quantity unaffected (`:1043-1046` VERIFIED) | fee deducted; `netUsd = inputUsd − feeUsd` (`engine.ts:1908-1910` VERIFIED) |
| Redemption | fee by status (15/50/200 bps) **deducted from gross before payout** (`:178-193` VERIFIED) | fee 15 bps deducted (`:223-227` VERIFIED) | ladder fee deducted; USDC paid from vault | ladder fee → `accumulatedFees` obligation (`:1133-1140` VERIFIED) | ladder fee deducted from gross (`engine.ts:2143-2144` VERIFIED) |
| Rebalance (reserve trade) | — | — | — | — | 0.20% → `hotWalletUsd` "Operational Wallet — excluded from NAV" (`engine.ts:1172-1183` VERIFIED); **dies with the reserve under no-reserve models** |
| Refunds | none — atomic revert only | none | none | **reject-event only; no refund path** (VERIFIED absence) | revert-only |
| Fee events | `Mint(…, feeUsd, …)` / `Redeem(…, feeUsd, …)` (`:90-91` VERIFIED) | `Mint(…, fee, …)` / `Redeem(…, fee, …)` | same shape | `FeesCollected(mintFees, redeemFees, total, feeWallet)` (`:470` VERIFIED) | `FeeAccrued` console trace (rebalance) |

**Accounting consequence (audit finding, carried):** under V2/v1.2/ecosystem the fee is *indistinguishable from collateral* on-chain (one balance, no fee sub-ledger) — commingling is not merely a policy smell, it is unauditable revenue. V3 fixed the *ledger* separation but left the money uncollectable (no sweep). A v3.0 must fix both at once.

### 1.6 What does NOT exist today (fee-relevant absences)

No dedicated fee ledger with separation guarantees (issuance spec §2 ledger table lists the fee ledger as absent/partial); no sweep/treasury withdrawal path (V3/external); no exemption or discount machinery; no fee-refund path on failed transactions (issuance spec §2.8 records the absence); no published fee schedule; no per-transaction fee line-item quote artifact (payment spec §6.1 is the PROPOSED design); **no service-fee billing for any Stream 2–4 product** (none of those products exists — `revenue-and-unit-economics.md` §6). All rates remain UNAPPROVED economic parameters (mandate §2 rule 8).

---

## 2. v3.0 fee design (PROPOSED — no rate, recipient, cap, or exemption is chosen by this section)

### 2.1 Design principles

1. **Every fee is a disclosed line item.** Each fee-bearing operation presents, **before the user commits**: fee name, rate, basis (what the rate multiplies), asset of denomination, recipient class, and change-governance reference. Quote artifacts carry itemized fee lines that **sum exactly to the total** (payment spec §6.1; T-PAY-03).
2. **One fee per operation — no double charging.** A conversion/settlement is charged once per economic operation; composite operations (e.g., instrument conversion + settlement + issuance) itemize each leg separately and never charge twice for two technical legs of one economic operation unless separately disclosed, genuinely distinct, and approved (stub Stream A rule; payment spec §2 layer 3, cited as the controlling no-double-charge design; issuance spec §2.7 mandates normalizing the V2-vs-V3 semantics under D-13.8).
3. **No hidden spreads.** Any spread between the conversion source and the applied rate is an explicit, capped, disclosed quote line (payment spec §6.1); the conversion source (oracle board aggregate + method + timestamp) is named on every quote (D-13.19 cross-ref).
4. **Fees must not compromise basket independence.** **Fee revenue never influences currency eligibility, weights, envelopes, or admission/retirement decisions** — enforced organizationally (§5) and as a code invariant: no data path from fee ledgers/revenue telemetry into constituency/MASE/weight modules, tested by the Stage K separation property test (payment spec T-PAY-01 pattern: synthetic payment-volume surges assert bit-identical weights/eligibility).
5. **Fees attach to services actually provided.** No fee attaches to an operation that was not performed (e.g., no fee on a failed transaction — PROPOSED default: full fee refund on failure, fee-on-failure policy explicitly owned by D-13.8); no fee on index computation itself (reconstitution/rebalancing of a *published index* is a calculation, not a chargeable service to a customer).
6. **A fee denominated in a volatile token is not automatically cash.** Recognition discipline per §3: fee revenue is recognized as revenue when the service is provided, but its cash value is realized only on conversion, with conversion costs deducted (no assumed reference value as income).

### 2.2 Fee surface per Gate B economic model (cross-ref `economic-model-options.md` — the fee set depends on D-13.3…D-13.7)

| Gate B model (paper §5–§8) | Protocol-level fee surface that could honestly exist |
|---|---|
| M1 — floating token + published index (advisory lean) | Acquisition/issuance fee **only if** D-13.6 selects a payment-gated supply policy; **no redemption fee** (D-13.7(a): no facility exists); **no rebalance fee** (MARP reserve trades are deleted); payment-acceptance/settlement service fees (Stream 1) where the acceptance layer genuinely operates |
| M2 — index-linked obligor instrument | Fees are **contractual obligor terms** (prospectus-class disclosure; fee netted per obligation formula) — a legal-document question, not a parameter question |
| M3 — redemption facility | The full mint/redeem ladder is meaningful — but M3 **contradicts the no-reserve objective** (paper §7 warning); its fee income creates a documented over-issuance incentive (paper M3-D8) |
| M4 — two-layer (index service + separately governed instrument) | **The index layer has NO protocol fees** — only service/licensing fees (Streams 2–4); the instrument layer carries its own economics per its own later decision |

**Design consequence (PROPOSED):** under the advisory M1/M4 direction, the existing redeem-fee ladder and the 0.20% rebalance fee are **dead design** (no redemption facility; no reserve trades), and the v3.0 fee schedule reduces to: acquisition/issuance fee (conditional on D-13.6), payment/settlement service fees (conditional on the acceptance layer existing), and commercial service fees (Streams 2–4). This document does not choose the model; it flags that **D-13.8 cannot be answered coherently before D-13.6/D-13.7 fix which operations exist.**

### 2.3 Dedicated fee treasury & sweep mechanics (PROPOSED; all values UNAPPROVED, D-13.8)

- A **dedicated fee ledger** separate from: the token ledger, any basket/index computation state, the payment-instrument ledger, and the settlement ledger (issuance spec §2 ledger universe). Nothing else posts to it; it posts to nothing else.
- A **fee treasury wallet/venue SEPARATE from any basket/index/payment-settlement ledger**, controlled by a **post-migration authority** (never the compromised R-1 EOA — Task 12 D4/D5 chain must complete first; today every authority resolves to R-1, which is disqualifying for any live fee collection).
- **Sweep mechanics with three controls, all owner-approved values (D-13.8):**
  1. **Timelock** between sweep authorization and execution (published window; cancellation emits an event);
  2. **Cap** per sweep and/or per period (absolute bound, unlike today's registration-time envelopes);
  3. **Disclosure**: every sweep publishes (amount, source ledger, destination, authorization reference, timestamps) — the `FeesCollected`/`maybeTreasurySweep` patterns are the accounting ancestors, but nothing collectable exists today (§1.3).
- **Fee-recipient authorization:** recipient changes are governance actions with timelock + public notice (V3's `setFeeWallet` Constitutional-Council gate is the pattern; today's council does not exist — G9 NOT CONDUCTED).

### 2.4 Fee-schedule change governance (PROPOSED)

All fee parameters live in a **public parameter registry** (V2's `PARAM_MINT_FEE`… pattern extended) with: registration-time envelopes **plus an absolute cap**, per-parameter timelock, **public notice period before effectivity**, versioned schedule publication (§4), and an on-chain/recorded event for every change. Emergency fee changes ride the deliverable-10 emergency framework (never an ad-hoc EOA action).

### 2.5 Fee event & record design (PROPOSED)

Every fee-bearing operation emits a fee record with: operation id (deterministic in operation content — issuance spec §10's request-id discipline), fee name, rate, basis, asset, amount, recipient ledger reference, semantics (`FEE-SEMANTICS`), and quote reference. Planned event set: `FeeCharged(operationId, feeClass, rate, basis, amount, asset, feeLedgerRef)` · `FeeRefunded(operationId, amount, reasonCode)` · `FeeSwept(amount, threshold, timelockRef, destination, authorizedBy)` · `FeeRecipientChanged(old, new, timelockRef, noticeRef)` · `FeeScheduleVersionPublished(version, effectiveAt, changeList)`. These extend the existing `FeesCollected`/`Mint(…, feeUsd, …)` payload shapes (§1.5) into a complete, reconcilable fee sub-ledger: the daily reconciliation (issuance spec §2 pattern) asserts Σ events = fee-ledger balance = published-schedule expectation, with mismatches freezing the affected operation class fail-closed.

### 2.6 UNAPPROVED DRAFT PARAMETERS (Annex-style; every value awaits D-13.8; none is a proposal until the owner approves it)

| Symbol | Meaning | Draft status (NOT a proposal) | Maps to |
|---|---|---|---|
| `FEE-MINT` | primary-acquisition/issuance fee rate & basis | exists only if D-13.6 selects payment-gated issuance; current code fact 0.10% is UNAPPROVED | D-13.6 + D-13.8 |
| `FEE-REDEEM-*` | redeem ladder (normal/stress/defensive/recovery/emergency-policy) | exists only under a D-13.7(b) facility; current 0.15/0.50/1.00/0.30/2.00% rows are UNAPPROVED code facts; **EMERGENCY semantics (pause vs 2.00%) must be reconciled** (C-INV-4) | D-13.7 + D-13.8 |
| `FEE-REBALANCE` | reserve-trade rebalance fee | dead under no-reserve models; current 0.20% is an UNAPPROVED code fact | D-13.4 + D-13.8 |
| `FEE-SETTLEMENT` / `FEE-CONVERSION` | payment-acceptance & settlement-orchestration service fees | new; exists only where the acceptance layer genuinely operates (payment spec §1: today all SIMULATED/NOT CONNECTED) | D-13.8 (+ D-13.18/19) |
| `FEE-SVC-*` | Stream 2–4 service-fee classes (API/subscription/licensing/support) | pricing bases live in `revenue-and-unit-economics.md` §1; adoption checkboxes there §7 | D-13.9 |
| `FEE-SEMANTICS` | deduct-from-payment vs on-top obligation; fee application order | normalizes the §1.2 divergence | D-13.8 (+ issuance spec §3.4) |
| `FEE-CAP-ABS` | absolute lifetime/per-period fee cap | none exists today (§1.4 gap) | D-13.8 |
| `SWEEP-THRESHOLD` / `SWEEP-TIMELOCK` / `SWEEP-CAP` | fee-treasury sweep controls | TS in-engine $10K threshold is a code fact, not a proposal | D-13.8 |
| `EXEMPTION-CLASSES` | who may be exempted/discounted, under what published rule | none exist; owner decision with disclosure (§4.4) | D-13.8 (+ D-13.9 for commercial discounts) |
| `FEE-ON-FAILURE` | fee retained/refunded on failed transactions | PROPOSED default: full refund; today no rule exists (issuance spec §2.8 absence) | D-13.8 |

---

## 3. Prohibited revenue recognitions (MANDATE-004 §9 rules — verbatim obligations; restated as accounting law for this program)

1. **"Do not count token issuance as business revenue merely because tokens were created."** Minting tokens creates a supply-side ledger entry, never income. `genesisMint` pots, minted balances, and treasury holdings of MTQ are not revenue at any reference value.
2. **"Do not count hypothetical token appreciation or unrealized token value as operating profit."** Unrealized token value is excluded from operating profit entirely — it may appear, at most, as a clearly-labeled non-operating memorandum item under an owner-approved accounting policy, never as operating result.
3. **"Do not count network gas paid to validators as protocol revenue."** Gas, router/aggregator fees (e.g., `marp.ts:136` 0.1% router fee — a cited third-party cost), relayer/bridge/LP/gateway costs are **third-party costs**, presented as costs (or pass-throughs, netted), never as gross-then-net "revenue".
4. **Reference value is not income.** A published index or reference value for MTQ is a measurement, not a bid, not an asset value, and not a revenue entry; treasury tokens are never counted at an assumed reference value as cash income (stub rule; `claims-and-honest-status.md`).

**Accounting identities (owner's standing formula, adopted verbatim):**

> **Operating result = revenue − all operating costs.**

- **Revenue** is recognized **only when a service is actually provided** (mandate §9), i.e., consideration received or receivable under an enforceable obligation for a delivered service (transaction executed, settlement orchestrated, API served, license granted, support delivered), measured per contract, net of refunds; customer funds held in course of settlement are liabilities, never revenue or working capital absent lawful disclosed authorization (stub rule).
- **All operating costs** are the full deduction list of `revenue-and-unit-economics.md` §3: payment processing, conversion, settlement, security, custody (where custody-adjacent services exist), data licensing, infrastructure, compliance, support, payroll, refunds, and other actual costs.
- **Presentation rule:** pass-through third-party costs are never presented gross as revenue (gross-vs-net discipline; `revenue-and-unit-economics.md` §3 presentation discipline).

---

## 4. Fairness rules & disclosure requirements (PROPOSED)

1. **Published fee schedule.** A versioned, public schedule (every fee, basis, asset, recipient class, cap, exemption class, change-governance reference) with effective dates and change history; the deployed/active parameter set must be reconcilable to the published schedule at all times.
2. **Per-transaction disclosure.** Quotes and confirmations itemize every fee line (name, rate, basis, asset, amount) **before commitment**; the total equals the sum of the lines exactly (T-PAY-03); stress-state-dependent fees (any ladder) display the current state and the fee that would apply, with reference to the state-machine disclosure (deliverable 10).
3. **Refunds of fees on failed transactions.** PROPOSED default: a failed/expired/unconfirmed operation refunds the fee together with the principal, on the same idempotency key (payment spec §6.3); any deviation (e.g., a disclosed administrative fee on failure) is an explicit D-13.8 sub-decision — never a silent retention.
4. **Exemption policy as owner decision.** Exemptions/discounts (institutional, promotional, hardship, related-party) exist only as published classes approved by the owner; commercial discounts belong to the operating company (§5) but every material class is disclosed; **no secret discounts, no undisclosed conflicts** (mandate §9 wording).
5. **No fee that compromises basket independence** (§2.1 rule 4) and **no fee on an operation not actually performed** (§2.1 rule 5). Fee-income dependence on volumes the system does not honestly have is itself a disclosure item (`revenue-and-unit-economics.md` §6).
6. **No yield/appreciation/stable-redemption promises** priced or implied by any fee schedule (stub rule; forbidden-claims register).

### 4.1 Disclosure-artifact checklist (PROPOSED; each artifact is a Stage K acceptance object)

| Artifact | Must contain | Tested by |
|---|---|---|
| Published fee schedule (web/docs, versioned) | every fee class, rate, basis, asset, recipient class, cap, exemption class, change-governance reference, effective dates, full change history | T-FEE-05 |
| Quote (pre-commitment) | itemized fee lines + spread line + conversion source + expiry + total; lines sum exactly to total | T-PAY-03 / T-FEE-01 |
| Confirmation/receipt (post-execution) | executed fee amounts per line, fee assets, operation id, fee-event reference | T-FEE-01/05 |
| Failure/refund notice | reason code, refunded principal + fee, idempotency key, timeline | T-FEE-04 |
| Treasury/sweep report | each sweep: amount, source ledger, destination, authorization + timelock references, disclosure timestamps | T-FEE-02/03 |
| Change notices | old→new values, registry reference, notice period, effective time | T-FEE-05 |
| Fee-transparency report (periodic, PROPOSED) | gross fees by class/asset, refunds, third-party pass-through costs, net fee revenue, outstanding fee receivables/obligations — the stub's profit-measurement field list | §3 identity; `revenue-and-unit-economics.md` §3 |

---

## 5. Commercial separation (PROPOSED; adoption requested as **D-13.24**)

**The separation (organizational):** the **operating company** owns commercial decisions — pricing, discounts, enterprise contracts, marketing, sales — while the **methodology publisher** owns basket decisions — currency eligibility, weights, envelopes, admission/retirement, index publication. These are different decisions with different conflict profiles, and they must not share a decision-maker.

- **Disjoint governance:** no person may hold both a commercial decision role and a methodology decision role; this extends deliverable 6's payment-operator/index-publisher disjointness (D-13.18) to the whole commercial layer (Streams 1–4).
- **Conflict-of-interest controls:** no sale of preferential access to unpublished monetary decisions (weights, admission, retirement are announced only through the published methodology process — never to paying clients first); **no client influence on basket composition**, disclosed or not; the index methodology is **never priced, and never influenced, by commercial relationships** (mandate §9: "maintain separation between the operating company's commercial decisions and the methodology that determines basket composition").
- **Related-party transaction rules:** any contract between the operating company and the methodology publisher (or any affiliate, officer, or owner-related entity) requires arm's-length terms, prior disclosure, owner approval, and inclusion in an annual related-party register reviewable by the independent reviewer (CKPT-9 pending — none engaged today).
- **Code invariant (PROPOSED, tested):** no import/data path from commercial/fee/revenue ledgers into eligibility-scoring, weight-transition, or index-computation modules; the T-PAY-01 property-test pattern (synthetic commercial-volume surge ⇒ weights/eligibility bit-identical) generalizes to a Stage K fee-family test (§6, T-FEE-06).
- **Honest starting point:** today the separation holds **by absence** — no councils exist (G9 NOT CONDUCTED), no customers exist, no methodology is live; the rules above must exist **before** the first commercial contract, not after.

---

## 6. Tests required (Stage K fee families — NOT IMPLEMENTED; planned evidence only; environmental limits recorded UNVERIFIED, never PASS)

- **T-FEE-01 fee-calculation accuracy:** rate applied on the approved basis with the approved semantics (`FEE-SEMANTICS`) and rounding order (issuance spec §3.3–3.4); ladder mapping per state incl. the dead-EMERGENCY-row reconciliation (C-INV-4) and the RECOVERY divergence (§1.1); fee lines sum exactly to totals.
- **T-FEE-02 fee-recipient accounting:** fees post to the fee ledger/recipient only — **no commingling regression against T4/C-INV-10** (issuance spec §6.3); `accumulatedFees`-style counters reconcile to events; sweep posts exactly the authorized amount within cap after timelock; recipient-change events fire.
- **T-FEE-03 treasury permissions:** only the authorized post-migration treasury authority can sweep; the R-1/compromised-signer path is rejected (tested against a revoked/rotated signer set — blocked until the Task 12 D8 chain executes); timelock elapsibility and cancellation behavior.
- **T-FEE-04 refund paths:** no fee retained on failed/expired transactions (default rule); refund idempotency (same key ⇒ original result); fee-reversal entries post against the fee ledger; refund-backlog threshold behavior (issuance spec §2.8).
- **T-FEE-05 disclosure surfaces:** quote/confirmation artifacts carry itemized fee lines; the published schedule version reconciles to the active parameter registry; stress-state fee disclosure present.
- **T-FEE-06 separation invariant:** synthetic fee-revenue/commercial-volume injection leaves weights, eligibility scores, and index outputs bit-identical (T-PAY-01 generalization; §5 code invariant).
- All suites are **planned evidence only**; no test in this repository exercises v3.0 fee collection, sweep, or fee-schedule governance today; Foundry-dependent variants are UNVERIFIABLE in this sandbox (no forge).

---

## 7. Risks (PROPOSED analysis; none claimed mitigated)

| # | Risk | Severity | Control (PROPOSED; all open) |
|---|---|---|---|
| FR-1 | **Fee commingling recurrence** in any V2/v1.2 descendant (T4/C-INV-10) | HIGH | T-FEE-02 regression; dedicated fee ledger design (§2.3) |
| FR-2 | **Uncollectable fees** — V3-style obligation ledger without sweep becomes a growing unfulfilled obligation (also an accounting/liability question) | HIGH | §2.3 sweep mechanics; D-13.8 |
| FR-3 | **Sweep-authority compromise** — today every authority resolves to the compromised R-1 EOA; any live fee collection before authority migration is unsafe and unauthorized | HIGH | Task 12 D4/D5/D8 precondition; T-FEE-03 |
| FR-4 | **Parameter-governance capture** — fee-rate changes via governance (48h MONETARY timelock etc.) without an absolute cap or notice discipline | MEDIUM | §2.4 registry + absolute cap + notice; T-FEE-05 |
| FR-5 | **Hidden spread / double charging** creeping into composite operations (payment + settlement + issuance legs) | HIGH | §2.1 rules 2–3; payment spec §6.1/T-PAY-03; D-13.19 |
| FR-6 | **Fee-driven basket distortion** — commercial incentives leaking into eligibility/weights (mandate's named failure mode) | HIGH | §5 separation + T-FEE-06/T-PAY-01 |
| FR-7 | **Fee-on-failure retention** eroding trust (and refund backlog as hidden liability) | MEDIUM | §4.3 default full refund; issuance spec §2.8 thresholds |
| FR-8 | **Volatile-denomination accounting** — fees taken in volatile tokens booked at assumed values overstate revenue | MEDIUM | §2.1 rule 6; realization discipline (§3) |
| FR-9 | **Regulatory reclassification** — transaction/settlement fees may characterize the operator as a money transmitter/VASP or the fee as regulated consideration (jurisdiction-dependent; no list exists) | MEDIUM–HIGH | Flagged for counsel, never answered here; `revenue-and-unit-economics.md` §1 compliance rows |
| FR-10 | **Over-issuance incentive** if fee income scales with issuance volume (economic-model-options M1-D8/M3-D8) | HIGH | D-13.6 caps/timelocks; reconciliation freeze (issuance spec §2.3) |

---

## 8. Acceptance criteria (for a future owner gate — NONE met today)

1. **D-13.8 approved**: rates, bases, semantics (`FEE-SEMANTICS`), recipients, treasury authority, sweep values (threshold/timelock/cap), exemption classes, fee-on-failure rule, absolute cap, change governance — this spec revised from branches to a single approved schedule.
2. A dedicated fee ledger + treasury with §2.3 controls implemented and T-FEE-01…T-FEE-06 green in their designated evidence classes (deployed-estate variants UNVERIFIED until fresh anchors).
3. Published versioned fee schedule live and reconcilable to the active parameter registry.
4. Authority migration complete (Task 12 D4/D5/D8 chain + RELEASE-GRANTS) so fee collection/sweep authorities are post-migration signers; the compromised-EOA path provably rejected.
5. Interface honesty audit: quotes itemize fees pre-transaction; no fee-on-unperformed-operation; no yield/redemption/appreciation implication anywhere in fee copy.
6. Commercial separation (§5) adopted (D-13.24) with the related-party register and conflict controls in force before the first commercial contract.

---

## 9. Owner approvals required (all OPEN — checkboxes unchecked)

- [ ] **D-13.8 (existing; Gate E)** — fee schedule: every `FEE-*`/`SWEEP-*`/`EXEMPTION-*`/`FEE-ON-FAILURE`/`FEE-SEMANTICS` value in §2.6; recipients and treasury authority (post-migration); absolute cap; exemptions; refund-on-failure default; change governance (registry + timelock + notice); the C-INV-4 EMERGENCY reconciliation; the RECOVERY-rung normalization. *Approver: Owner (+ Economic Authority). Writing any rate in this document approves nothing.*
- [ ] **D-13.9 (existing)** — commercial model validation for Streams 1–4 (willingness-to-pay evidence before build-out; pricing-basis checkboxes per stream live in `revenue-and-unit-economics.md` §7). *Approver: Owner (business).*
- [ ] **D-13.24 (NEW, opened by this document)** — commercial–methodology separation & conflict-of-interest policy (§5): disjoint governance roles, no preferential access to unpublished monetary decisions, no client influence on basket composition, related-party transaction rules, annual independent review. *Approver: Owner; interacts with D-13.18 (payment-layer disjointness) without replacing it.*
- Interacting OPEN decisions (not re-opened here): **D-13.6/D-13.7** (which fee-bearing operations exist at all — §2.2), **D-13.4/D-13.5** (model/objective), **D-13.18** (payment governance), **D-13.19** (settlement parameters incl. quote fee-line fields), **D-13.20/D-13.21** (burn taxonomy / secondary-market posture), **D-13.1** (uploaded key disposition — the worktree secret gate stays RED until it resolves), and the carried Task 12 authority chain (OWNER-ATT-1 → … → CKPT-9, RELEASE-GRANTS) which precedes ANY live fee operation.

---

## 10. What is NOT implemented (explicit; nothing here is capability)

- No v3.0 fee ledger, treasury, sweep function, exemption machinery, refund-of-fee path, published schedule, or per-transaction fee disclosure surface exists: **NOT IMPLEMENTED** (all §2/§4 design is PROPOSED).
- V3 `feeWallet` remains obligation-only with **no sweep/claim**; V2/v1.2/ecosystem remain **commingled**; the TS in-engine sweep moves state fields only — no external treasury exists (§1.3).
- **No fee is charged on mainnet** — nothing is deployed production-side; deployed-estate fee behavior belongs to the v1.2 pilot + ecosystem modules (admin-set prices, MockUSDC) and inherits the 18-contract source-identity UNVERIFIED caveat.
- No Stream 2–4 service-fee billing, no commercial contracts, no customers, no revenue exist anywhere in the record (`revenue-and-unit-economics.md` §6).
- Foundry suites UNVERIFIABLE in this sandbox (no forge); canonical-invariants last recorded PASS at Task 12, UNVERIFIED this cycle; no Stage K fee test exists.
- Zero on-chain actions, zero code changes, zero key handling in producing this document; `upload/` and `.env` were never opened (zero-key-handling discipline maintained).

---

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED**
