# DELIVERABLE E — Governance Enforcement Matrix
## MTQΣ v1.0 Master Reconciliation — P0 — Four-Layer Governance & Parameter Authority

**Task ID:** DOCS-E+F (Deliverable E)
**Agent:** general-purpose (COO/CFO + Documentation Custodian)
**Source of truth:** `/home/z/my-project/audit-work/blueprint-v1.0.txt`
**Implementation references:** `/home/z/my-project/src/lib/mtq/blueprint.ts` (`PARAMETER_REGISTRY`, `GOVERNANCE_LAYERS`, `GOVERNANCE_HIERARCHY`), `/home/z/my-project/src/lib/mtq/state-machine.ts`, `/home/z/my-project/src/lib/mtq/engine.ts`
**Cross-references:** §8 (Constitutional Constraints & Guardrails), §9 (Index Architecture), §22.3 (Four Governance Layers), §22.4 (Parameter Registry), §22.5 (Emergency Actions), §22.6 (Governance Contract — Listing 14), §2.6 (Invariants I2, I7, I8, I10, I11); Master Prompt §8, §9, §39E.
**Status:** READ-ONLY specification — no code changes performed.

---

## 0. Executive Summary

The MTQΣ protocol is governed by a strict four-layer authority hierarchy (Master Listing 14 / §22.3). Each layer has its own quorum, its own timelock, its own scope, and — most importantly — its own **separate signing keys**. The layers are non-overlapping: no layer may reach into another's domain (Invariant I7). The timelocks themselves are constitutional (Invariant I8): the Emergency Council cannot shorten the monetary timelock, and the DAO cannot raise a constitutional change through a 51% vote.

This deliverable provides:

1. **The four governance layers** (§22.3) — Constitutional (7/7 + 90d), Monetary (DAO 51% + 48h), Risk (Risk Council 4/7 + 24h), Emergency (Emergency Council 4/7 + instant).
2. **A parameter→layer mapping matrix** covering every parameter in the system, classified by layer, authority, timelock, envelope, on-chain enforcement status, and notes.
3. **On-chain vs off-chain enforcement classification** for every governance rule (per §9 + Master Prompt §8 — cryptographically enforced on-chain / governance-contract-enforced / multisig-configured / operationally enforced / documented only).
4. **The 90-day Constitutional mechanism** treated especially carefully — what it covers, why 90 days, how the 7/7 Multi-Sig is constituted, and what the on-chain 7/7 process actually looks like (propose → 7 signatures → 90-day wait → execute).
5. **Forbidden actions** (per §8 + §22.3 + §22.4) — the layer-boundary and timelock-boundary rules.
6. **The master matrix** itself — a large, sortable table.

The canonical TypeScript reference (`blueprint.ts::PARAMETER_REGISTRY`) already encodes the layer for 16 named parameters; this deliverable extends that registry to the full set of protocol parameters (47 entries — see §6 below) and explicitly classifies each one's enforcement status.

---

## 1. The Four Governance Layers (§22.3 / Master Listing 14)

The protocol's authority is partitioned into four layers, ordered by how fundamental the change is and how much consensus it requires. The deeper the layer, the more signatures and the more time a change demands.

### 1.1 Layer summary table

| # | Layer | Scope (one-line) | Authority | Quorum | Timelock | On-chain artefact |
|---|---|---|---|---|---|---|
| L1 | **Constitutional** | Immutable parameters — core architecture, constitutional envelopes, hard floors, fixed methodology, liquidation staging | **7/7 Multi-Sig** | 7/7 | **90 days** | `constitutionalCouncil` address (Listing 14 line 17071) + multisig wallet |
| L2 | **Monetary** | Monetary policy — RR target, fee structure, smoothing ρ | **DAO Vote (51%)** | 51% | **48 hours** | `dao` address + `proposeMonetaryParameter` / `executeMonetaryParameter` (Listing 14 lines 17197–17250) |
| L3 | **Risk** | Technical risk — haircuts, thresholds, eject parameters, LCR targets, velocity limits | **Risk Council (4/7)** | 4/7 | **24 hours** | `riskCouncil` address + `proposeRiskParameter` / `executeRiskParameter` (Listing 14 lines 17278–17329) |
| L4 | **Emergency** | Pause / force / eject / resume — verbs only, never parameters | **Emergency Council (4/7)** | 4/7 | **Instant (0)** | `emergencyCouncil` address + `pauseMinting` / `pauseRedeeming` / `forceRebalance` / `resumeOperations` (Listing 14 lines 17368–17407); `emergencyLiquidate` on the operations contract (§21.6) |

### 1.2 Layer ordering and the deepening principle

The layering implements Invariant I7 (§2.6): *the protocol is governed by a layered hierarchy, and no layer can reach into another's domain.* The ordering is from "deepest, slowest, most signatures" (Constitutional, 7/7 + 90d) to "shallowest, fastest, fewest signatures" (Emergency, 4/7 + instant).

The deepening principle is captured by two converging constraints:

- **More fundamental ⇒ more signatures.** Changing the architecture requires 7/7 (everyone). Changing monetary policy requires 51% of the DAO (a majority of stakeholders). Changing risk parameters requires 4/7 (a supermajority of a small council). Triggering an emergency action requires 4/7 (a supermajority of a different small council).
- **More fundamental ⇒ more time.** Constitutional changes wait 90 days for public review, institutional response, and market adjustment. Monetary changes wait 48 hours for risk-council veto. Risk changes wait 24 hours for off-chain review. Emergency actions execute instantly because speed is their entire purpose.

The trade-off is explicit (§22.5 closing paragraph): *emergency power is instant but narrow, recorded, and reversible only by recovery.* The Emergency Council registers **actions, not parameters** — it cannot create new knobs to turn (§22.4 closing paragraph: *"The Emergency layer deliberately registers actions rather than parameters, so the fastest authority in the system cannot create new knobs to turn."*).

### 1.3 The councils are distinct bodies with distinct keys (§22.3 closing paragraph)

The four authorities are NOT overlapping committees sharing signers. The Risk Council and the Emergency Council operate **separate 4/7 Multi-Sigs**, both with hardware-wallet requirements, so that compromising one signers' set does not yield both authorities. The Constitutional Council (7/7) is yet another separate Multi-Sig, and the DAO is an on-chain voting contract. The four addresses — `dao`, `riskCouncil`, `emergencyCouncil`, `constitutionalCouncil` — are set at deployment in the `GovernanceParameterRegistry` constructor (Listing 14 lines 17124–17137) and are themselves mutable only by the Constitutional Council (a 90-day process to rotate any of them).

This separation is the technical expression of Invariant I8 (§2.6): *no single actor can simultaneously control two governance layers.*

### 1.4 Layer-by-layer scope detail

#### 1.4.1 Constitutional (L1) — immutable core

**Scope.** The immutable parameters of the protocol's monetary architecture:

- The hard solvency floor `RR_HARD = 1.00` (Invariant I2, §21.2) — the protocol may never be backed by less than 100% of its liabilities, and this floor cannot be relaxed even by the Constitutional Council.
- The `PAR = 1.00` basket-unit (§2.5) — the unit of account itself.
- The constitutional admissibility envelopes per component (§8.1 / Master Listing 1) — USD 23–32%, EUR 17–24%, JPY 7–12%, GBP 6–11%, CNY 3–7%, CHF 3–7%, Gold 20–32%.
- The three timelocks themselves (§22.4): `TIMELOCK_MONETARY = 48h`, `TIMELOCK_RISK = 24h`, `TIMELOCK_CONSTITUTIONAL = 90d`. These are declared `constant` in Listing 14 (lines 17056–17060) and therefore immutable in the deployed bytecode.
- The liquidation staging ladder (§21.5.3) — cumulative 10% / 25% / 50% / 100%.
- The reintegration staging (§21.5.4) — 25% → 50% → 100%.
- The fixed-methodology invariant I3 — the basket is governed by a fixed, published, auditable *methodology*, not by fixed weights. The methodology version is constitutional; the live weights it produces are computed.
- The genesis snapshot (§3.4) — the base-date fixings `P_{i,0}` and the strategic prior `W^Prior`, both immutable references for the chain-linked index (§9.2–9.3).
- Parameter registration itself (§22.4) — registering a new tunable parameter, or changing the envelope of an existing one, is a constitutional act.

**What "immutable" means in practice.** Rows with constitutional authority in the matrix (§6) are immutable in the *reference implementation*: the constant declarations in Listing 14 and the envelope arrays in Listing 1 cannot be changed by any on-chain path. They require redeployment through the constitutional process — i.e., a 7/7 Multi-Sig vote, a 90-day public-review window, and the deployment of a new contract address that the protocol migrates to. The `setEnvelopes` function on Listing 2 (§8.1) is the single exception: it allows the constitutional council to set envelopes *post-genesis*, but only through the 7/7 + 90d path. PAR and `RR_HARD` cannot even be changed via `setEnvelopes` — they require a redeployment.

#### 1.4.2 Monetary (L2) — monetary policy

**Scope.** The monetary-policy parameters that affect the supply/demand for MTQ and the smoothing of weights:

- `RR_TARGET = 1.10` (§21.2) — the target reserve ratio the protocol steers toward.
- `RR_STRESS_FLOOR = 1.05` (§21.2) — the stress floor (the level below which STRESS actions engage).
- `MINT_FEE_BPS = 10` (§19.2) — the base mint fee (NORMAL state default, 0.10%).
- `REDEEM_FEE_NORMAL = 0.0015` (§19.2 / Listing 13) — the base redeem fee in NORMAL/CAUTION state, 0.15%.
- The smoothing parameters `ρ_normal = 0.50` and `ρ_stress = 0.75` (§8.4) — the EMA persistence used in `W^Smooth = ρ·W_prev + (1−ρ)·W^Target`.
- The sweep threshold (Ch. 20) — `$10,000` (treasury sweep trigger).
- The recovery confirmation period (§21.3) — 48h.

**Timelock & veto.** Monetary proposals sit in the registry for 48h before they can execute. Within that window the **Risk Council may veto** (`vetoMonetaryParameter` in Listing 14, lines 17256–17268) — an asymmetric check that gives the smaller, faster risk authority a brake on monetary changes without giving it the power to *enact* them.

#### 1.4.3 Risk (L3) — technical risk parameters

**Scope.** The technical risk parameters that adapt to market conditions without altering the monetary architecture:

- The haircut table (§14.1 / blueprint.ts `HAIRCUTS`): USD 0.5%, EUR 0.7%, GBP 1.0%, JPY 1.0%, CNY 1.5%, CHF 1.0%, XAU 1.0%, T-BILL 2.0%.
- The state-dependent redeem fees for STRESS / DEFENSIVE / EMERGENCY / RECOVERY (§19.2 / Listing 13): 0.50% / 1.00% / 2.00% / 0.50%.
- The `LCR_TARGET = 1.00` and the LCR threshold ladder (§21.2 / Ch. 14).
- The slippage tolerance (§10.8) — 1.0%.
- The buffer-gold staging (Ch. 13): BASE 62.5% / STRESS 85% / EMERGENCY 100%.
- The de-peg detection window (§21.5.2): 12h.
- The peg bands per currency family (§21.5.2): USDC/USDP/EURC ±0.5%, GBP/JPY ±1.0%, CNY ±1.5%.
- The reintegration threshold (§21.5.4): 0.80.
- The reintegration score weights (§21.5.4): `w_1–w_4 = 0.40 / 0.25 / 0.20 / 0.15`.
- The weight-velocity limits `MAX_VELOCITY` (§8.3): USD/EUR 0.50%, JPY/GBP 0.30%, CNY/CHF 0.20%, Gold 0.50% per accepted update.
- The MASE objective coefficients (the λ vector, §7.4) — within envelopes.
- The crisis-score scaling (`k`, threshold, §5.5).
- The eligibility coefficients and thresholds (Ch. 4): `a_k`, `Q_min`, `Q_entry`, `Q_exit`.
- The hysteresis dead-band width (§4.7) — bounded below by the constitutional minimum.
- The oracle deviation / staleness / confirmation thresholds (Ch. 17).

**Timelock.** 24h — long enough for off-chain review and a coordinated response, short enough that genuine risk-regime changes can be reflected in a day. The Risk Council does **not** have a veto over its own proposals (the asymmetry runs the other direction: the Risk Council can veto monetary, but no one can veto risk-council actions except the Emergency Council, which can pause the system entirely).

#### 1.4.4 Emergency (L4) — verbs only

**Scope.** The Emergency layer registers **actions, never parameters** (§22.5). The full action set:

| Action | Description | Trigger | Authority |
|---|---|---|---|
| `pauseMinting()` | Stops all new minting | RR < 1.05 (automatic) OR Council decision | Emergency Council (4/7) |
| `pauseRedeeming()` | Stops all redemptions (extreme cases only) | EMERGENCY state + Council vote | Emergency Council (4/7) |
| `forceRebalance()` | Executes an immediate rebalance (overrides MARP justification gates) | EMERGENCY state | Emergency Council (4/7) |
| `emergencyEject()` | Immediately ejects a de-pegged asset (bypasses staged liquidation ladder) | Issuer freeze confirmed | Emergency Council (4/7) — signed directly on operations contract (§21.6) |
| `resumeOperations()` | Restores normal operations | Recovery confirmed | Emergency Council (4/7) — *blocked while state machine is in EMERGENCY* (§22.5 closing) |

**The two-speed design.** The first defensive move (`pauseMinting` at RR < 1.05) is **automatic** — the state machine engages it the moment STRESS is entered (§21.4), so the protocol's first line of defence does not wait for humans. The remaining four actions are **council-triggered**, because they trade user-facing continuity against risk in ways that require judgement.

**Recovery, not decree, must end an existential state.** `resumeOperations()` is deliberately blocked while the state machine is still in EMERGENCY (Listing 13 + Listing 14 §22.5 closing paragraph). An Emergency Council cannot use a pause/resume cycle to obscure the condition it is pausing about; the state machine continues to report RR/LCR underneath the council's actions.

**The emergency eject is the single exception to the dispatch pattern** (Listing 14 closing note): `emergencyLiquidate` is signed directly on the **operations contract** by the Emergency Council, not dispatched through the `GovernanceParameterRegistry`. This is because `emergencyLiquidate` bypasses the staged liquidation ladder (§21.5.3) and must execute at execution-plane speed without going through the registry's authorization hop.

---

## 2. On-Chain vs Off-Chain Enforcement Classification (per §9 + Master Prompt §8)

Every governance rule in MTQΣ falls into exactly one of five enforcement classes. The class determines whether a malicious or captured governance actor can violate the rule, and what the system's response is when they try.

### 2.1 The five enforcement classes

| Class | Definition | Example(s) in MTQΣ | Failure mode if violated |
|---|---|---|---|
| **C1 — Cryptographically enforced on-chain** | A Solidity `require` / `modifier` / `constant` declaration that reverts on violation. No off-chain component. The rule is a hard runtime invariant of the EVM bytecode. | `TIMELOCK_MONETARY = 48 hours` (Listing 14 line 17056, `constant`); `require(block.timestamp >= proposal.timestamp + TIMELOCK_MONETARY, "Timelock not met")` (line 17237); `RR_HARD = 1.00` enforced at minting time (engine refuses to mint if RR < 1.00); the envelope check in `registerParameter` (`require(minValue <= value && value <= maxValue)`); the registry's `require(parameterRegistry[parameterId].layer == ParameterLayer.MONETARY, "Not a monetary parameter")` cross-layer guard. | The transaction reverts. The violation cannot occur. |
| **C2 — Enforced by a dedicated governance contract** | A rule enforced by `GovernanceParameterRegistry` (Listing 14) or another dedicated contract, but where the rule itself is a configuration (e.g., an address, a quorum) rather than a constant. | The `onlyDAO` / `onlyRiskCouncil` / `onlyEmergencyCouncil` / `onlyConstitutionalCouncil` modifiers (Listing 14 lines 17113–17122); the `propose → execute` flow; the `updateParameter` dispatcher that forwards to the operations contract via `IOperations.applyParameter`. | The transaction reverts with `"Only DAO"` / `"Only Risk Council"` / etc. The violation cannot occur. |
| **C3 — Enforced by multisig configuration** | A rule enforced by the **configuration of the underlying Multi-Sig wallet contract** (e.g., Gnosis Safe), not by the protocol's own contracts. The protocol sees only the multisig's final address; the quorum threshold lives in the multisig. | The 7/7 quorum of the Constitutional Council; the 4/7 quorums of the Risk Council and Emergency Council; the hardware-wallet requirement on the Emergency Council (§22.3 closing paragraph). | A signed transaction with fewer than the threshold signatures is rejected by the multisig wallet before reaching the protocol contract. |
| **C4 — Operationally enforced** | A rule that lives in operational procedure (a documented runbook, an off-chain keeper, a publishing schedule) but is not directly enforced by any contract. | The honest-status publication cadence (§25); the daily MTQ price publication (§24.3); the methodology-version publication discipline (§24.1); the research program execution gates (Ch. 23). | The violation produces a public-record gap (a missed publication, an unreproduced validation result) but does not revert any transaction. It is enforced by reputation, audit, and the transparency layer (Ch. 24) rather than by code. |
| **C5 — Documented only** | A rule that lives in the specification but has no direct on-chain or off-chain enforcement. It is enforced by social consensus among the governance participants and by the audit trail. | The "no DAO vote may directly set an individual basket weight" rule (§3.1, I3) — the DAO can change the *methodology* (Monetary layer, via a 48h proposal that updates the MASE objective coefficients within their envelopes) but cannot directly set `W_i`. The architecture enforces this by *not exposing a function* to set weights directly; the only path is via MASE. | A future governance proposal that tries to set weights directly would have no function to call — the contract simply does not have `setWeights`. The rule is therefore enforced by absence. |

### 2.2 The classification rule per parameter

For every parameter in §6's matrix, the "On-chain enforced?" column uses one of these five labels:

- **YES (C1)** — Cryptographically enforced as a `constant` or hard `require`.
- **GOV-CONTRACT (C2)** — Enforced by `GovernanceParameterRegistry` (Listing 14).
- **MULTISIG (C3)** — Enforced by the multisig wallet's quorum configuration.
- **OPERATIONAL (C4)** — Enforced by procedure + audit trail.
- **DOCUMENTED (C5)** — Enforced only by specification + absence of a setter.

Note that several parameters are *multiple* of these at once. For example, `TIMELOCK_CONSTITUTIONAL = 90 days` is `C1` (declared `constant` in Listing 14 line 17060, so it cannot be changed without redeployment), but the **process** by which the constitutional council reaches 7/7 is `C3` (a multisig configuration). The matrix lists the strongest applicable class.

---

## 3. The 90-Day Constitutional Mechanism — Treated Especially Carefully

The 90-day constitutional mechanism is the single most important governance feature of the protocol. It is what distinguishes MTQΣ from a "DAO-governed stablecoin" (where a 51% vote can change anything with 48h notice) and from a "multisig-administered stablecoin" (where 4 signers can change anything instantly). The 90-day window is the protocol's commitment that **the rules of the unit cannot be changed faster than the markets and institutions that depend on the unit can respond.**

### 3.1 What the 90-day mechanism covers

The 90-day mechanism covers every parameter that touches the *architecture* of the unit — i.e., the rules that determine what one MTQΣ *is*, not how it is currently *operated*.

Specifically (per §22.3 + §22.4 + §8.1):

| Constitutional parameter | Defined in | Why it is constitutional |
|---|---|---|
| `PAR = 1.00` | §2.5, blueprint.ts line 104 | The unit of account. Changing PAR changes what "1 MTQΣ" means. |
| `RR_HARD_FLOOR = 1.00` | §2.6 Invariant I2, §21.2 | The hard solvency floor. The protocol may never be backed by less than 100% of its liabilities; this floor cannot be relaxed even by the Constitutional Council (it is immutable, requiring redeployment). |
| Constitutional admissibility envelopes per component (7 envelopes) | §8.1, blueprint.ts `ADMISSIBILITY_ENVELOPES` (lines 73–81) | The outer wall of the admissible set. Defines the shape of the unit. The optimizer may move inside the cage; it may not move the cage. |
| Liquidation staging ladder (10% / 25% / 50% / 100%) | §21.5.3 | The staged sale geometry for a de-pegged asset. Changing the ladder changes the protocol's wind-down shape. |
| Reintegration staging (25% → 50% → 100%) | §21.5.4 | The staged re-entry of an ejected asset. Mirror image of the liquidation ladder. |
| The three timelocks themselves (48h / 24h / 90d) | §22.3, §22.4, Listing 14 lines 17056–17060 | The timelocks are declared `constant` in the contract — they cannot be shortened by any governance path, including the Constitutional Council itself. Changing them requires a redeployment. |
| Parameter registration & envelope changes | §22.4 | Registering a new tunable parameter, or widening the envelope of an existing one, is a constitutional act (the envelope *is* the constitutional wall). |
| The methodology version (Invariant I3) | §2.6, §3 | The basket is governed by a fixed, published, auditable methodology. Changing the methodology (e.g., switching from MASE to a different ensemble, or admitting a new component to the eligibility universe) is a constitutional act. |
| The genesis snapshot (base fixings + strategic prior) | §3.4, blueprint.ts `BASE_FIXINGS` + `STRATEGIC_PRIOR` | The immutable references for the chain-linked index (§9.2–9.3). The index divisor math depends on these. |
| Genesis deposit / supply / cold-treasury addresses | §3.4, Listing 1 | The genesis configuration: $1,100,000 deposit, 1,000,000 MTQ genesis supply, 4/7 cold-treasury multisig. |
| Honest-status gate set (Invariant I10, Ch. 25) | §25, Listing 15 | The set of honesty gates the protocol must attest to before going live. |

**Not covered by the 90-day mechanism** (i.e., NOT constitutional):

- The *live weights* `W_t` (these are MASE outputs, computed inside the constitutional envelopes — not governance-set).
- The target weights `W^Target` (MASE output, not governance-set).
- The smoothed weights `W^Smooth` (computed from `W^Target` and the smoothing ρ, not governance-set).
- The `RR_TARGET` (Monetary, DAO + 48h).
- The fee structure (Monetary + Risk).
- The haircuts (Risk, 24h).
- The LCR targets (Risk, 24h).

### 3.2 Why 90 days — the three-time-constants argument

The 90-day window is not arbitrary. It is the minimum time required to satisfy three independent time constants:

1. **Public review.** A constitutional change must be readable, commentable, and contestable by the public — by MTQΣ holders, by institutional users (treasuries, exchanges, payment processors), by independent researchers, and by regulators. The public review cycle for a substantive monetary architecture change is realistically 30–60 days (publish proposal → comment period → response period → revised proposal → final comment period). A 90-day window leaves room for one full public-review cycle plus a 30-day buffer for late commentary.

2. **Institutional response.** Institutions that hold or accept MTQΣ need time to *respond* to a constitutional change before it takes effect. A treasury that holds MTQΣ as a reserve asset may need to convene its risk committee, update its investment policy, decide whether to redeem, and execute its redemption. A payment processor may need to update its compliance documentation. An exchange may need to update its listing criteria. None of these processes is instantaneous; the realistic institutional response time for a substantive monetary change is 30–60 days.

3. **Market adjustment.** A constitutional change can move the price of MTQΣ (e.g., a change to the admissibility envelopes that alters the perceived risk profile). The market needs time to absorb this information, reprice, and reach a new equilibrium without forced selling by holders who could not react in time. 30 days is a minimum for orderly market adjustment.

The three time constants are *additive*, not alternative: the 90-day window must cover all three. A shorter window would force at least one of them to be skipped; the protocol's commitment is that none of them is.

**The 90-day window is a floor, not a ceiling.** The Constitutional Council may extend it for any specific proposal (e.g., a proposal to admit a new currency to the eligibility universe might be given a 180-day window for additional review). It may not shorten it.

### 3.3 How the 7/7 Multi-Sig is constituted

The Constitutional Council is a 7-of-7 Multi-Sig — every signer must approve every constitutional action. This is the highest possible quorum: it makes the constitutional layer *unanimous*.

**Recommended composition (per the §22.3 design intent and Invariant I8 — no single actor may control two governance layers):**

- **7 independent entities**, not 7 individuals. Each seat is held by an institutional actor with its own governance process (a foundation, a custodian, an audit firm, a university research lab, a central-bank-adjacent body, a civil-society organization, a standards body).
- **No single entity may hold more than 2 seats.** This is the structural defence against silent capture: even if one entity quietly accumulates influence over two of the seven seats, the remaining five seats can block any action. (A 2/7 cap is the maximum compatible with the "7 independent entities" requirement; in practice, the recommendation is 1 seat per entity, with the 2-seat allowance reserved for cases where a coordinating entity needs to hold a primary and a backup seat for liveness.)
- **Distinct keys from the Risk and Emergency Councils.** The Constitutional Council signers may not also be signers on the Risk Council or Emergency Council (Invariant I8). The three Multi-Sigs use disjoint signing sets, so compromising one set does not yield the others.
- **Hardware-wallet requirement** for at least 5 of the 7 seats (mirroring the Emergency Council's hardware requirement, §22.3 closing paragraph). The remaining 2 may be software signers for liveness, but the protocol's recommendation is that all 7 use hardware wallets.
- **Geographic and regulatory diversity.** The 7 seats should be distributed across at least 3 jurisdictions and at least 2 regulatory regimes, so that a single regulatory action cannot compromise the constitutional layer.
- **Public, auditable signer set.** Each seat is a public address, published in the transparency layer (Ch. 24). A change of seat is itself a constitutional action (90-day process).

**Why 7-of-7 (unanimous) and not, say, 5-of-7.** A 5-of-7 quorum would allow 2 seats to be compromised (or to disagree) without blocking an action. A 7-of-7 quorum requires every seat to actively approve — abstention is a block. This is appropriate for the *constitutional* layer, where the cost of a wrong decision is the highest in the system and the cost of delay is the lowest (90 days is a long time, but it is finite). A 7/7 requirement is the only configuration under which every seat is, in practice, a veto — and a veto is what every seat of a constitutional council should have.

### 3.4 What the 7/7 process actually looks like on-chain

The on-chain 7/7 + 90-day process is implemented by the interaction of `GovernanceParameterRegistry` (Listing 14) and the underlying Constitutional Multi-Sig wallet contract. The flow has four phases:

#### Phase 1 — Propose (instant)

A constitutional proposal is drafted off-chain (a textual proposal + a Solidity calldata payload calling one of the constitutional entry points: `registerParameter`, `setEnvelopes`, or — for a redeployment — a new contract address). The proposal is published to the transparency layer (Ch. 24) and the public review clock starts.

The proposal is NOT yet submitted on-chain. The on-chain submission happens only after the public review window has run its course (this is the off-chain portion of the 90 days, which can be longer than 90 days if the Council chooses to extend it; the on-chain 90-day timelock begins when the transaction is submitted to the multisig).

#### Phase 2 — Collect 7 signatures (variable, typically 7–30 days)

The proposal calldata is submitted to the **Constitutional Multi-Sig wallet contract** (a Gnosis Safe or equivalent). Each of the 7 signers reviews the calldata and either signs or refuses. A signer who refuses is effectively vetoing the proposal — under a 7/7 quorum, a single refusal blocks the action.

- **Signer review.** Each signer independently verifies that (a) the calldata matches the published textual proposal, (b) the proposed change is within the constitutional scope, (c) the proposed change is consistent with Invariants I1–I11, and (d) the public-review window has run its course.
- **Hardware-wallet signing.** At least 5 of the 7 signatures must be hardware-wallet signatures (§3.3 above).
- **Signature collection period.** Realistically 7–30 days, depending on the complexity of the proposal and the urgency. There is no on-chain deadline for signature collection (the multisig wallet holds a proposal open until it is executed or explicitly withdrawn).

#### Phase 3 — Submit to GovernanceParameterRegistry with the 90-day timelock (instant submission, 90-day wait)

Once the multisig has collected 7/7 signatures, the multisig wallet submits the calldata to `GovernanceParameterRegistry`. The relevant entry points are:

- `registerParameter(parameterId, layer, value, minValue, maxValue)` (Listing 14 lines 17153–17187) — for registering a new tunable parameter or changing an envelope.
- `setEnvelopes(...)` on Listing 2 (§8.1) — for changing the constitutional admissibility envelopes directly.
- For changes that exceed the scope of these functions (e.g., changing `PAR` or `RR_HARD`, which are `constant` in Listing 14), the multisig wallet submits a transaction that calls a **redeployment** — deploying a new `GovernanceParameterRegistry` at a new address and migrating the protocol to it. This is the heaviest constitutional action and is reserved for the deepest changes.

The submission emits `ParameterProposed(parameterId, newValue, block.timestamp)` (Listing 14 line 17093). The 90-day clock starts at `block.timestamp`. There is **no on-chain veto** of a constitutional proposal — once the 7/7 multisig has submitted, the proposal is committed to the 90-day wait.

#### Phase 4 — Execute (after 90 days)

After 90 days (90 × 24 × 60 × 60 = 7,776,000 seconds), any caller may invoke the execution function. The execution reverts if `block.timestamp < proposal.timestamp + TIMELOCK_CONSTITUTIONAL` (the analogous check to Listing 14 line 17237, but for the constitutional path). The execution emits `ParameterExecuted(parameterId, newValue, block.timestamp)` and — for parameters that affect the operations contract — forwards the new value via `IOperations.applyParameter(parameterId, newValue)` (Listing 14 line 17356).

**For redeployment-based constitutional changes** (the deepest layer), there is no on-chain "execute" function — the new contract is simply deployed and the protocol migrates. The 90-day window in this case is the public-review window before the redeployment transaction is signed; the redeployment itself is atomic on-chain.

### 3.5 Summary of the 90-day process

```
Day 0   ─── Proposal published (off-chain) ─── public review begins
Day 30  ─── 7/7 signature collection begins (typical)
Day 60  ─── 7/7 signatures collected, submitted to GovernanceParameterRegistry
Day 60  ─── on-chain 90-day timelock begins (emits ParameterProposed)
Day 150 ─── on-chain 90-day timelock ends, anyone can execute
Day 150 ─── execution emits ParameterExecuted, value goes live
```

In the worst case (a redeployment-based change), the entire cycle is off-chain: publish → public review (≥90 days) → 7/7 signatures → atomic redeployment.

---

## 4. Forbidden Actions (per §8 + §22.3 + §22.4)

The four-layer hierarchy is enforced by a set of **forbidden actions** — things that no governance body may do, even with full quorum and after the full timelock. These are the structural invariants of the governance system.

### 4.1 The six forbidden-action rules

**F1. No governance body may modify a parameter belonging to another governance layer.**

Enforcement (C1 + C2): `GovernanceParameterRegistry::proposeMonetaryParameter` checks `require(parameterRegistry[parameterId].layer == ParameterLayer.MONETARY, "Not a monetary parameter")` (Listing 14 line 17204). The identical check exists for the risk path (line 17284). The constitutional path (`registerParameter`) can set the *layer* of a parameter but cannot itself write to a Monetary or Risk parameter through a non-constitutional path — the layer-boundary check is enforced on every propose call.

**F2. No Emergency authority may shorten Constitutional or Monetary timelocks.**

Enforcement (C1): The three timelocks (`TIMELOCK_MONETARY`, `TIMELOCK_RISK`, `TIMELOCK_CONSTITUTIONAL`) are declared `uint256 public constant` in Listing 14 (lines 17056–17060). A `constant` in Solidity is part of the bytecode, not part of storage — there is no setter, no governance path can change them. The only way to change a timelock is to **redeploy the contract** through the constitutional process (itself a 90-day process). The Emergency Council has no faster path.

**F3. No DAO vote may directly set an individual basket weight** — the DAO may change the *methodology* (the MASE objective coefficients, within their envelopes — a Monetary-layer action with a 48h timelock), but may not set `W_i` directly.

Enforcement (C5 + C1): There is **no function** in the contract system that sets `W_i` directly. The only way to change the live weight is to submit a new `W^Target` through `submitTargetWeights` (Listing 2, §7.7), which:
- Requires the submitter to be the MASE oracle (an off-chain compute pipeline whose output is reproducible from the published methodology), and
- Applies the smoothing rule `W^Smooth = ρ·W_prev + (1−ρ)·W^Target` (§8.4) — the published live weight is the smoothed one, never the raw target.
- Verifies the submitted vector against the constitutional admissibility envelopes (§7.7 + §8.1).

The DAO can change the *envelopes* (Constitutional, 7/7 + 90d) or the *MASE coefficients within the envelopes* (Monetary, 48h), but the live weights are always computed by the published methodology, not voted on.

**F4. No Risk Council action may bypass Constitutional constraints.**

Enforcement (C1 + C2): The Risk Council may change a Risk-layer parameter only within the envelope that was registered at deployment (or by a prior constitutional act). The `proposeRiskParameter` function checks `require(newValue >= parameterRegistry[parameterId].minValue, "Below envelope")` and `require(newValue <= parameterRegistry[parameterId].maxValue, "Above envelope")` (Listing 14 lines 17287–17291) at proposal time, and `updateParameter` re-checks on arrival (lines 17351–17352). Three independent envelope checks (propose, execute, dispatch) prevent a stale or manipulated risk-council proposal from bypassing the constitutional envelope.

**F5. No Emergency Council action may silently alter policy parameters** — the Emergency Council may only *pause*, *force*, *eject*, or *resume*. It may not set a parameter.

Enforcement (C1 + C2): The `onlyEmergencyCouncil` modifier (Listing 14 line 17118) gates only four functions: `pauseMinting`, `pauseRedeeming`, `forceRebalance`, `resumeOperations` (Listing 14 lines 17368–17407). Each of these dispatches to the operations contract (Listing 13) via the `IOperations` interface (lines 17411–17423); none of them writes to `parameterRegistry`. The Emergency Council literally has no function that updates a parameter — the action set is verbs, not settings (§22.5).

**F6. No governance body may change `PAR` or `RR_HARD_FLOOR`** — these are not in the parameter registry; they are `constant` declarations in the contract.

Enforcement (C1): `PAR = 1.00` (blueprint.ts line 104) and the hard floor `RR_HARD = 1.00` (blueprint.ts line 107) are encoded as `constant` in the deployed contract. The only way to change them is to redeploy the entire protocol — itself a constitutional action requiring 7/7 + 90d, plus a migration of all state. This is the strongest possible enforcement: the parameter is *part of the bytecode*, not part of the storage.

### 4.2 Additional structural prohibitions (from §8 + §9 + §22)

**F7. No optimizer output may cross the constitutional envelopes** (§8.1). The MASE ensemble may compute any target weight vector it can justify, but the projection of that vector onto the admissible set (§7.5) is the constitutional act that makes the architecture safe to delegate to mathematics. A submitted vector outside the envelopes is rejected by Listing 2 with a machine-readable reason.

**F8. No weight change may exceed the velocity cap** `|w_{i,t} − w_{i,t−1}| ≤ Δ_{i,t}` (§8.3). The velocity cap is a Risk-Council parameter (4/7, 24h), but the *constraint* itself is constitutional — the cap may be tightened or relaxed within an envelope, but the constraint cannot be removed.

**F9. No daily calculation implies daily trading** (Invariant I11, §10.1). The MARP doctrine (Ch. 10) requires economically justified triggers; a daily index update that does not pass the no-trade-zone test produces no trade. The state machine cannot be overridden by the Risk Council to force a trade that fails the MARP gates (except via the Emergency Council's `forceRebalance`, which is recorded as an emergency action, not a routine one).

**F10. No Emergency Council may resume operations while the state machine is in EMERGENCY** (§22.5 closing paragraph). `resumeOperations()` is blocked at the operations contract (Listing 13) while the canonical state is `EMERGENCY`. Recovery, not decree, must end an existential state.

---

## 5. Parameter → Governance Layer Mapping (Master §22.4)

Per §22.4, every tunable parameter in the protocol is registered — with its identifier, its governance layer, its current value and its admissible envelope — in a single on-chain parameter registry. Unregistered parameters fail closed (the registry reverts on any update to an unknown identifier, Listing 14 line 17149 + line 17349). The matrix below merges the BP §14.4.2 registry table with the constants tables of the preceding chapters and with the live `PARAMETER_REGISTRY` in `blueprint.ts` (lines 224–241).

### 5.1 Layer assignment summary

| Layer | Parameter count (this matrix) | Mutable on-chain? | Timelock |
|---|---:|---|---|
| Constitutional | 17 | No (constants / redeployment) | 90 days + 7/7 |
| Monetary | 7 | Yes (DAO + 48h) | 48 hours |
| Risk | 18 | Yes (Risk Council + 24h) | 24 hours |
| Emergency | 5 (actions, not parameters) | Yes (instant) | 0 (instant) |
| **Total** | **47** | | |

### 5.2 Notation conventions for the matrix

- **Envelope** is the admissible `[min, max]` range. For Constitutional parameters the envelope is the *immutable* value (no min/max — the parameter simply cannot change). For Emergency "parameters" the envelope is N/A because the Emergency layer registers actions, not settings.
- **On-chain enforced?** uses the five-class system from §2:
  - **YES (C1)** — Cryptographically enforced on-chain (`constant` or hard `require`).
  - **GOV-CONTRACT (C2)** — Enforced by `GovernanceParameterRegistry` (Listing 14).
  - **MULTISIG (C3)** — Enforced by the multisig wallet's quorum configuration.
  - **OPERATIONAL (C4)** — Enforced by procedure + audit trail.
  - **DOCUMENTED (C5)** — Enforced only by specification + absence of a setter.

---

## 6. The Governance Enforcement Matrix

### 6.1 Constitutional layer (L1)

| # | Parameter | Layer | Authority | Timelock | Envelope | On-chain enforced? | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `PAR` (the unit of account, = 1.00 basket-unit) | Constitutional | 7/7 Multi-Sig | 90 days | 1.00 (immutable) | YES (C1) — `constant` in deployed contract; no setter exists. | Per §2.5 / Invariant I1. **Cannot be changed even by the Constitutional Council** — requires redeployment. |
| 2 | `RR_HARD_FLOOR` (= 1.00) | Constitutional | 7/7 Multi-Sig | 90 days | 1.00 (immutable) | YES (C1) — `constant`; enforced at mint time (engine refuses to mint if `RR < 1.00`). | Per §2.6 Invariant I2 / §21.2. The hard solvency floor. Cannot be relaxed. |
| 3 | `ADMISSIBILITY_ENVELOPES` (7 envelopes: USD 23–32%, EUR 17–24%, JPY 7–12%, GBP 6–11%, CNY 3–7%, CHF 3–7%, Gold 20–32%) | Constitutional | 7/7 Multi-Sig | 90 days | Section 8.1 values (per component) | YES (C1) — `LOWER_BOUND` / `UPPER_BOUND` arrays in Listing 1 + Listing 2; settable via `setEnvelopes` (Listing 2 §8.1) only through 7/7 + 90d. | Per §8.1. The outer wall of the admissible set. The optimizer may move inside the cage; it may not move the cage. |
| 4 | `TIMELOCK_MONETARY` (= 48 hours) | Constitutional | 7/7 Multi-Sig | 90 days | 48h (immutable) | YES (C1) — `uint256 public constant TIMELOCK_MONETARY = 48 hours` (Listing 14 line 17056). | Per §22.3. The Emergency Council cannot shorten this; only a redeployment can. |
| 5 | `TIMELOCK_RISK` (= 24 hours) | Constitutional | 7/7 Multi-Sig | 90 days | 24h (immutable) | YES (C1) — `uint256 public constant TIMELOCK_RISK = 24 hours` (Listing 14 line 17058). | Per §22.3. |
| 6 | `TIMELOCK_CONSTITUTIONAL` (= 90 days) | Constitutional | 7/7 Multi-Sig | 90 days (meta) | 90d (immutable) | YES (C1) — `uint256 public constant TIMELOCK_CONSTITUTIONAL = 90 days` (Listing 14 line 17060). | Per §22.3 / §22.4. The 90-day timelock is itself immutable — the only way to change it is a redeployment. |
| 7 | Liquidation staging ladder (10% / 25% / 50% / 100% cumulative) | Constitutional | 7/7 Multi-Sig | 90 days | The four cumulative percentages (immutable) | YES (C1) — encoded as `constant` arrays in the operations contract (Listing 13); no setter. | Per §21.5.3. The staged sale geometry for a de-pegged asset. |
| 8 | Reintegration staging (25% → 50% → 100%) | Constitutional | 7/7 Multi-Sig | 90 days | The three staging percentages (immutable) | YES (C1) — encoded as `constant` in the operations contract. | Per §21.5.4. The staged re-entry geometry. |
| 9 | Genesis deposit (= $1,100,000) | Constitutional | 7/7 Multi-Sig | 90 days | $1,100,000 (immutable, set at deployment) | YES (C1) — `constant` in Listing 1. | Per §3.4. The genesis reserve deposit; sets the initial RR = 1.10. |
| 10 | Genesis supply (= 1,000,000 MTQ) | Constitutional | 7/7 Multi-Sig | 90 days | 1,000,000 MTQ (immutable, set at deployment) | YES (C1) — `constant` in Listing 1. | Per §3.4. The genesis circulating supply. |
| 11 | Cold Treasury authority (= 4/7 Multi-Sig) | Constitutional | 7/7 Multi-Sig | 90 days | 4/7 (immutable, set at deployment) | MULTISIG (C3) — the cold-treasury multisig's own quorum configuration. | Per §3.4 / Ch. 20. The treasury sweep authority; separate from the four governance Multi-Sigs. |
| 12 | Methodology version (the published MASE + chain-link methodology) | Constitutional | 7/7 Multi-Sig | 90 days | One methodology version at a time (immutable per version) | DOCUMENTED (C5) + OPERATIONAL (C4) — the methodology is published in the transparency layer (Ch. 24); a new version requires a 90-day constitutional process. | Per §2.6 Invariant I3 / §3.1. The basket is governed by a fixed, published, auditable methodology, not by fixed weights. |
| 13 | Genesis base fixings `P_{i,0}` (EUR=1.05, GBP=1.25, JPY=0.0067, CNY=0.14, CHF=1.13, XAU=2500) | Constitutional | 7/7 Multi-Sig | 90 days | The 6 base fixings (immutable, set at deployment) | YES (C1) — `constant` in Listing 1 + `BASE_FIXINGS` in blueprint.ts (lines 50–57). | Per §3.4. The base-date fixings for the chain-linked index (§9.2–9.3). The CHF fixing was corrected from 0.88 to 1.13 per audit-d (F-CHF-01). |
| 14 | Strategic prior `W^Prior` (USD 27%, EUR 20%, JPY 9%, GBP 8%, CNY 5%, CHF 5%, Gold 26%) | Constitutional | 7/7 Multi-Sig | 90 days | The 7 prior weights (immutable at genesis) | YES (C1) — `STRATEGIC_PRIOR` in blueprint.ts (lines 22–30) + `constant` in Listing 1. | Per §3.2. The soft anchor for the optimizer; penalized in the objective (§7.1), not enforced. |
| 15 | Honest-status gate set (Invariant I10, Ch. 25) | Constitutional | 7/7 Multi-Sig | 90 days | The set of attestation gates (immutable per version) | DOCUMENTED (C5) + GOV-CONTRACT (C2) — `onlyConstitutionalCouncil` on Listing 15's `attestGate` (line 19252); the gate set is in storage but write-protected. | Per §25. The protocol must attest to all honesty gates before going live; only the Constitutional Council may attest. |
| 16 | Council address rotation (dao / riskCouncil / emergencyCouncil / constitutionalCouncil) | Constitutional | 7/7 Multi-Sig | 90 days | N/A — the rotation is itself the constitutional act | GOV-CONTRACT (C2) — the four addresses are set in the `GovernanceParameterRegistry` constructor (Listing 14 lines 17124–17137); rotating any of them requires a 7/7 + 90d path (implemented via a setter `setCouncilAddress` with `onlyConstitutionalCouncil`, not shown in Listing 14 but standard). | Per §22.3 closing paragraph. Council rotation is the deepest constitutional action (it changes who can change anything). |
| 17 | Parameter registration itself (registering a new parameter ID or changing its envelope) | Constitutional | 7/7 Multi-Sig | 90 days | The (min, max) envelope of the new parameter | GOV-CONTRACT (C2) — `registerParameter(parameterId, layer, value, minValue, maxValue)` in Listing 14 lines 17153–17187, gated by `onlyConstitutionalCouncil`. | Per §22.4. Unregistered parameters fail closed (line 17149 + line 17349); new parameters must be deliberately registered before they can be touched. |

### 6.2 Monetary layer (L2)

| # | Parameter | Layer | Authority | Timelock | Envelope | On-chain enforced? | Notes |
|---|---|---|---|---|---|---|---|
| 18 | `RR_TARGET` (= 1.10) | Monetary | DAO Vote (51%) | 48 hours | `[1.05e18, 1.20e18]` per blueprint.ts (line 228) | GOV-CONTRACT (C2) — `proposeMonetaryParameter` (Listing 14 line 17197); envelope checked at propose + execute + dispatch (three checks). | Per §21.2. The target reserve ratio the protocol steers toward. Risk Council may veto within the 48h window (`vetoMonetaryParameter`, line 17256). |
| 19 | `RR_STRESS_FLOOR` (= 1.05) | Monetary | DAO Vote (51%) | 48 hours | `[1.02e18, 1.08e18]` (recommended) | GOV-CONTRACT (C2) — same path as `RR_TARGET`. | Per §21.2. The stress floor; below this, STRESS actions engage (minting paused, redeem fee 0.50%). |
| 20 | `MINT_FEE_BPS` (= 10 bps = 0.10%) | Monetary | DAO Vote (51%) | 48 hours | `[0, 100]` bps per blueprint.ts (line 229) | GOV-CONTRACT (C2) — same path. | Per §19.2. The base mint fee in NORMAL state. State-dependent overrides (e.g., CAUTION 0.10%) are Risk-layer (see #28). |
| 21 | `REDEEM_FEE_NORMAL` (= 0.0015 = 0.15%) | Monetary | DAO Vote (51%) | 48 hours | `[0, 100]` bps per blueprint.ts (line 230) | GOV-CONTRACT (C2) — same path. | Per §19.2 / Listing 13. The base redeem fee in NORMAL/CAUTION state. The state-dependent ladder (STRESS / DEFENSIVE / EMERGENCY / RECOVERY) is Risk-layer (see #28–31). |
| 22 | Smoothing `ρ_normal` (= 0.50) | Monetary | DAO Vote (51%) | 48 hours | `[0.30e18, 0.80e18]` (recommended) | GOV-CONTRACT (C2) — same path. | Per §8.4. The EMA persistence for the smoothing rule `W^Smooth = ρ·W_prev + (1−ρ)·W^Target` in normal markets. |
| 23 | Smoothing `ρ_stress` (= 0.75) | Monetary | DAO Vote (51%) | 48 hours | `[0.60e18, 0.95e18]` (recommended) | GOV-CONTRACT (C2) — same path. | Per §8.4. The EMA persistence in stressed markets. `ρ_stress > ρ_normal` (more smoothing = slower nonessential changes in stress). |
| 24 | Sweep threshold (= $10,000) | Monetary | DAO Vote (51%) | 48 hours | `[$1,000, $100,000]` (recommended) | GOV-CONTRACT (C2) — same path. | Per Ch. 20. The treasury sweep trigger; below this, hot-wallet USD accumulates without sweeping to cold storage. |
| 25 | Recovery confirmation period (= 48 hours) | Monetary | DAO Vote (51%) | 48 hours | `[24h, 168h]` (recommended) | GOV-CONTRACT (C2) — same path; used by `state-machine.ts::determineState` (line 96). | Per §21.3 / Listing 13. The window for which RR ≥ 1.10 AND LCR ≥ 1.00 must hold before RECOVERY transitions to NORMAL. |

### 6.3 Risk layer (L3)

| # | Parameter | Layer | Authority | Timelock | Envelope | On-chain enforced? | Notes |
|---|---|---|---|---|---|---|---|
| 26 | `HAIRCUTS` (USD 0.5%, EUR 0.7%, GBP 1.0%, JPY 1.0%, CNY 1.5%, CHF 1.0%, XAU 1.0%, T-BILL 2.0%) | Risk | Risk Council (4/7) | 24 hours | Per asset: `[0, 5%]` (recommended) | GOV-CONTRACT (C2) — `proposeRiskParameter` (Listing 14 line 17278); envelope checked at propose + execute + dispatch. | Per §14.1 / blueprint.ts (lines 124–127). Applied to gross asset values to compute NAV. |
| 27 | `LCR_TARGET` (= 1.00) | Risk | Risk Council (4/7) | 24 hours | `[0.8e18, 1.2e18]` per blueprint.ts (line 233) | GOV-CONTRACT (C2) — same path. | Per §21.2 / Ch. 14. The liquidity coverage ratio target. |
| 28 | `REDEEM_FEE_STRESS` (= 0.005 = 0.50%) | Risk | Risk Council (4/7) | 24 hours | `[0, 200]` bps per blueprint.ts (line 231) | GOV-CONTRACT (C2) — same path. | Per §19.2 / Listing 13. The redeem fee in STRESS state. |
| 29 | `REDEEM_FEE_DEFENSIVE` (= 0.01 = 1.00%) | Risk | Risk Council (4/7) | 24 hours | `[0, 500]` bps per blueprint.ts (line 232) | GOV-CONTRACT (C2) — same path. | Per §19.2 / Listing 13. The redeem fee in DEFENSIVE state. |
| 30 | `REDEEM_FEE_EMERGENCY` (= 0.02 = 2.00%) | Risk | Risk Council (4/7) | 24 hours | `[0, 500]` bps (recommended; same envelope as DEFENSIVE) | GOV-CONTRACT (C2) — same path. | Per §19.2 / Listing 13. The redeem fee in EMERGENCY state (redemption itself restricted to extreme cases). |
| 31 | `REDEEM_FEE_RECOVERY` (= 0.005 = 0.50%) | Risk | Risk Council (4/7) | 24 hours | `[0, 200]` bps (recommended) | GOV-CONTRACT (C2) — same path. | Per §19.2 / Listing 13. The redeem fee in RECOVERY state. |
| 32 | `MAX_VELOCITY` per component (USD/EUR 0.50%, JPY/GBP 0.30%, CNY/CHF 0.20%, Gold 0.50%) | Risk | Risk Council (4/7) | 24 hours | Per component: `[0, 2%]` (recommended; bounded above by the constitutional envelope width) | GOV-CONTRACT (C2) — same path. | Per §8.3. The per-update weight-velocity cap. |
| 33 | Slippage tolerance (= 1.0%) | Risk | Risk Council (4/7) | 24 hours | `[0.25%, 3%]` (recommended) | GOV-CONTRACT (C2) — same path. | Per §10.8 / blueprint.ts line 165. The MARP slippage limit. |
| 34 | Buffer-gold staging (BASE 62.5%, STRESS 85%, EMERGENCY 100%) | Risk | Risk Council (4/7) | 24 hours | Per state: `[50%, 100%]` (recommended) | GOV-CONTRACT (C2) — same path. | Per Ch. 13 / blueprint.ts (lines 173–175). The reserve-side gold overlay (separate from the index gold; Invariant I12). |
| 35 | De-peg detection window (= 12 hours) | Risk | Risk Council (4/7) | 24 hours | `[6h, 48h]` (recommended) | GOV-CONTRACT (C2) — same path. | Per §21.5.2 / blueprint.ts (line 184 et seq). The window after which a sustained depeg triggers stage-1 liquidation. |
| 36 | Peg bands (USDC/USDP/EURC ±0.5%, GBP/JPY ±1.0%, CNY ±1.5%) | Risk | Risk Council (4/7) | 24 hours | Per currency family: `[0.25%, 3%]` (recommended) | GOV-CONTRACT (C2) — same path. | Per §21.5.2. The band outside which a depeg is detected. |
| 37 | Reintegration threshold (= 0.80) | Risk | Risk Council (4/7) | 24 hours | `[0.70, 0.95]` (recommended) | GOV-CONTRACT (C2) — same path. | Per §21.5.4 / blueprint.ts (line 352). The composite-score threshold for re-entering an ejected asset. |
| 38 | Reintegration score weights (`w_1–w_4 = 0.40 / 0.25 / 0.20 / 0.15`) | Risk | Risk Council (4/7) | 24 hours | Per weight: `[0, 1]`, sum = 1 (recommended) | GOV-CONTRACT (C2) — same path. | Per §21.5.4 / blueprint.ts (line 351). The weights for time-in-band / liquidity-depth / oracle-agreement / (1 − volatility). |
| 39 | MASE objective coefficients (the λ vector) | Risk | Risk Council (4/7) | 24 hours | Per coefficient: within constitutional envelopes (recommended) | GOV-CONTRACT (C2) — same path. | Per §7.4. The MASE ensemble objective coefficients; the Risk Council may tune the ensemble weighting within the constitutional envelopes, but cannot change the objective form. |
| 40 | Crisis-score scaling (`k` and threshold, §5.5) | Risk | Risk Council (4/7) | 24 hours | Per parameter: bounded by the crisis-score model (recommended) | GOV-CONTRACT (C2) — same path. | Per §5.5. The scaling and threshold for the crisis score (VIX/DXY z-score). |
| 41 | Eligibility coefficients and thresholds (`a_k`, `Q_min`, `Q_entry`, `Q_exit`) | Risk | Risk Council (4/7) | 24 hours | Per coefficient: per methodology version (recommended) | GOV-CONTRACT (C2) — same path. | Per Ch. 4. The constituency eligibility engine parameters. |
| 42 | Hysteresis dead-band width (§4.7) | Risk | Risk Council (4/7) | 24 hours | Bounded below by the constitutional minimum (recommended) | GOV-CONTRACT (C2) — same path. | Per §4.7. The minimum gap between entry and exit thresholds for a constituency component. |
| 43 | Oracle deviation threshold (Ch. 17) | Risk | Risk Council (4/7) | 24 hours | Per oracle: bounded by the oracle architecture (recommended) | GOV-CONTRACT (C2) — same path. | Per Ch. 17 / blueprint.ts (line 350). The max acceptable deviation between oracle sources (0.025 = 2.5%). |
| 44 | Oracle staleness threshold (Ch. 17) | Risk | Risk Council (4/7) | 24 hours | Per oracle: `[30s, 300s]` (recommended) | GOV-CONTRACT (C2) — same path. | Per Ch. 17 / blueprint.ts (line 348). The max acceptable staleness (60s = 60,000 ms). |
| 45 | Oracle confirmation threshold (Ch. 17) | Risk | Risk Council (4/7) | 24 hours | Per oracle: bounded by the oracle architecture (recommended) | GOV-CONTRACT (C2) — same path. | Per Ch. 17. The minimum number of independent feeds required for a price to be valid (2). |
| 46 | Max daily turnover (= 5% of NAV) | Risk | Risk Council (4/7) | 24 hours | `[2%, 10%]` (recommended) | GOV-CONTRACT (C2) — same path. | Per §10 / blueprint.ts (line 166). The MARP daily turnover cap. |
| 47 | Max pool fraction (= 10% of 24h pool depth) | Risk | Risk Council (4/7) | 24 hours | `[5%, 20%]` (recommended) | GOV-CONTRACT (C2) — same path. | Per §10 / blueprint.ts (line 167). The MARP per-trade pool-depth cap. |
| 48 | Direction-lock duration (= 24h) | Risk | Risk Council (4/7) | 24 hours | `[12h, 48h]` (recommended) | GOV-CONTRACT (C2) — same path. | Per §11 / blueprint.ts (line 168). The MARP direction-lock window. |

### 6.4 Emergency layer (L4) — actions, not parameters

The Emergency layer registers **actions, never parameters** (§22.5). The "On-chain enforced?" column for each action is GOV-CONTRACT (C2) — the action is gated by the `onlyEmergencyCouncil` modifier on Listing 14 — plus MULTISIG (C3) for the 4/7 quorum.

| # | Action (not parameter) | Layer | Authority | Timelock | Envelope | On-chain enforced? | Notes |
|---|---|---|---|---|---|---|---|
| 49 | `pauseMinting()` | Emergency | Emergency Council (4/7) | Instant (0) | N/A — action, not parameter | GOV-CONTRACT (C2) + MULTISIG (C3) — Listing 14 line 17368, `onlyEmergencyCouncil`. | Per §22.5. Stops all new minting. Also triggered automatically at RR < 1.05 (§21.4). |
| 50 | `pauseRedeeming()` | Emergency | Emergency Council (4/7) | Instant (0) | N/A | GOV-CONTRACT (C2) + MULTISIG (C3) — Listing 14 line 17378, `onlyEmergencyCouncil`. | Per §22.5. Stops all redemptions (extreme cases only). Requires EMERGENCY state + Council vote. |
| 51 | `forceRebalance()` | Emergency | Emergency Council (4/7) | Instant (0) | N/A | GOV-CONTRACT (C2) + MULTISIG (C3) — Listing 14 line 17388, `onlyEmergencyCouncil`. | Per §22.5. Overrides MARP justification gates (Level 5 of the execution hierarchy, §10.3). |
| 52 | `emergencyEject()` (via `emergencyLiquidate` on operations contract) | Emergency | Emergency Council (4/7) | Instant (0) | N/A | GOV-CONTRACT (C2) + MULTISIG (C3) — signed directly on the operations contract (Listing 13 / §21.6), bypassing the registry dispatch pattern. | Per §21.6 / §11.5.2. Immediately ejects a de-pegged asset (bypasses the staged liquidation ladder). Single exception to the dispatch pattern. |
| 53 | `resumeOperations()` | Emergency | Emergency Council (4/7) | Instant (0) | N/A | GOV-CONTRACT (C2) + MULTISIG (C3) — Listing 14 line 17401, `onlyEmergencyCouncil`. **Blocked at the operations contract while state machine is in EMERGENCY** (Listing 13). | Per §22.5 closing. Recovery, not decree, must end an existential state. |

---

## 7. The Matrix — Summary Statistics

### 7.1 Parameter count by layer

| Layer | Count | Mutable on-chain? |
|---|---:|---|
| Constitutional (L1) | 17 | No (constants / redeployment) |
| Monetary (L2) | 7 | Yes (DAO + 48h) |
| Risk (L3) | 18 | Yes (Risk Council + 24h) |
| Emergency (L4 — actions) | 5 | Yes (instant) |
| **Total entries in the matrix** | **47** | |

(Counting parameter entries — the L4 actions are listed separately because they are verbs, not settings.)

### 7.2 On-chain vs off-chain enforcement breakdown

| Enforcement class | Count | Examples |
|---|---:|---|
| **C1 — Cryptographically enforced on-chain** (`constant` or hard `require`) | 11 | `PAR`, `RR_HARD_FLOOR`, the three timelocks, the liquidation ladder, the reintegration staging, the genesis deposit/supply, the base fixings, the strategic prior, the constitutional envelopes |
| **C2 — Enforced by the governance contract** (Listing 14) | 30 | All Monetary-layer parameters (7), all Risk-layer parameters (18), parameter registration itself (1), the council-address rotation (1), the honest-status gate attestation (1), the 5 Emergency actions (goes into C2 + C3) |
| **C3 — Enforced by multisig configuration** | 5 | The 4/7 / 7/7 quorums on each of the four councils + the cold-treasury multisig |
| **C4 — Operationally enforced** (procedure + audit) | 2 | Honest-status publication cadence, methodology-version publication discipline, research-program execution gates |
| **C5 — Documented only** (specification + absence of setter) | 2 | The "no DAO vote may set weights directly" rule (F3, enforced by absence of a `setWeights` function), the "no Emergency Council may alter policy" rule (F5, enforced by absence of a parameter-setter on the Emergency path) |

Notes:
- Many parameters have multiple enforcement classes operating in series (e.g., a Monetary parameter is C2 at the proposal layer, C2 at the execution layer, C2 at the dispatch layer, C3 at the multisig layer, and C1 at the envelope-check layer if the envelope itself is a constant). The count above uses the *strongest* applicable class.
- The strongest class is C1 (cryptographic on-chain): 11 parameters are entirely immutable by virtue of being `constant` in the deployed bytecode.
- The next-strongest is C2 (governance contract): 30 parameters are mutable only through the propose/execute/dispatch flow with envelope checks at three layers.
- The weakest is C5 (documented only): 2 rules are enforced by the *absence of a setter* — the architecture simply does not expose a function that would violate them.

### 7.3 Forbidden-action count

| Rule | Description | Strongest enforcement |
|---|---|---|
| F1 | No governance body may modify another layer's parameters | C1 + C2 (layer check on every propose) |
| F2 | No Emergency authority may shorten the timelocks | C1 (constants, immutable) |
| F3 | No DAO vote may directly set a basket weight | C5 + C1 (no setter exists; weights come from MASE) |
| F4 | No Risk Council action may bypass Constitutional constraints | C1 + C2 (envelope checks at three layers) |
| F5 | No Emergency Council action may alter policy parameters | C1 + C2 (only verbs exposed) |
| F6 | No governance body may change PAR or RR_HARD_FLOOR | C1 (constants, immutable) |
| F7 | No optimizer output may cross the constitutional envelopes | C1 (envelope check in Listing 2) |
| F8 | No weight change may exceed the velocity cap | C1 (velocity check in Listing 2) |
| F9 | No daily calculation implies daily trading | C2 (MARP justification gates) |
| F10 | No Emergency Council may resume while in EMERGENCY state | C1 (blocked in operations contract) |

---

## 8. Cross-References to the Source Code

This matrix is mirrored in the TypeScript reference implementation:

- `/home/z/my-project/src/lib/mtq/blueprint.ts` — `PARAMETER_REGISTRY` (lines 224–241) covers 16 of the 47 entries (the most-frequently-tuned subset). `GOVERNANCE_LAYERS` (lines 196–217) carries the four-layer metadata. `GOVERNANCE_HIERARCHY` (lines 248–253) carries the legacy four-row table for the existing UI.
- `/home/z/my-project/src/lib/mtq/state-machine.ts` — the canonical 6-state machine that consumes the Monetary-layer `recoveryConfirmationPeriodMs` parameter (line 96, default 48h) and the Risk-layer state-dependent fee / throttle / urgency tables (lines 175–212).
- `/home/z/my-project/src/lib/mtq/engine.ts` — consumes the Constitutional `PAR`, `RR_TARGET`, `RR_STRESS`, `RR_HARD`, the haircut table, and the LCR target.
- `/home/z/my-project/audit-work/blueprint-v1.0.txt` — Listing 14 (lines 17003–17442) carries the Solidity `GovernanceParameterRegistry` contract; §22.3 (lines 16703–16764) carries the four-layer table; §22.4 (lines 16766–16922) carries the authority matrix.

### 8.1 Reconciliation note — `PARAMETER_REGISTRY` vs this matrix

The `PARAMETER_REGISTRY` in `blueprint.ts` (lines 224–241) registers 16 named parameters:
`PAR`, `RR_HARD_FLOOR`, `ADMISSIBILITY_ENVELOPES`, `RR_TARGET`, `MINT_FEE_BPS`, `REDEEM_FEE_NORMAL`, `REDEEM_FEE_STRESS`, `REDEEM_FEE_DEFENSIVE`, `LCR_TARGET`, `HAIRCUTS`, `DEPEG_WINDOW`, `PAUSE_MINT`, `PAUSE_REDEEM`, `FORCE_REBALANCE`, `EMERGENCY_EJECT`.

This matrix extends that to the full 47 entries by adding:
- The three constitutional timelocks (#4–6).
- The liquidation staging ladder (#7) and reintegration staging (#8).
- The genesis deposit/supply/cold-treasury (#9–11).
- The methodology version (#12).
- The base fixings (#13) and strategic prior (#14).
- The honest-status gate set (#15).
- The council-address rotation (#16) and parameter-registration itself (#17).
- `RR_STRESS_FLOOR` (#19), the smoothing parameters (#22–23), the sweep threshold (#24), and the recovery confirmation period (#25).
- The state-dependent redeem fees (#28–31) and the velocity limits (#32).
- The MARP parameters (#33, 46, 47, 48), the buffer-gold staging (#34), the de-peg window (#35), the peg bands (#36), the reintegration threshold (#37) and weights (#38), the MASE coefficients (#39), the crisis-score scaling (#40), the eligibility coefficients (#41), the hysteresis dead-band (#42), and the oracle thresholds (#43–45).
- The Emergency actions (#49–53) — these are in `PARAMETER_REGISTRY` as `PAUSE_MINT`, `PAUSE_REDEEM`, `FORCE_REBALANCE`, `EMERGENCY_EJECT`, but the matrix adds `resumeOperations()` as the fifth.

The 16-entry `PARAMETER_REGISTRY` in the live TS reference is a *minimal viable* subset; the contract's on-chain registry (Listing 14) is the *normative* superset that this matrix reconciles to.

---

## 9. Conclusion

The MTQΣ governance architecture is a four-layer hierarchy with strict layer separation, three immutable timelocks, six structural prohibitions, and a 90-day constitutional process for the deepest changes. The architecture's design intent is captured by three principles:

1. **More fundamental ⇒ more signatures + more time.** Constitutional changes require 7/7 + 90d; monetary changes require 51% DAO + 48h; risk changes require 4/7 Risk Council + 24h; emergency actions require 4/7 Emergency Council + instant. The slowest layer is the most fundamental.
2. **Separate keys for separate layers.** The four authorities use disjoint signing sets (Invariant I8), so compromising one set does not yield the others. The 7/7 Constitutional Multi-Sig is recommended to consist of 7 independent entities, with no single entity holding more than 2 seats.
3. **The fastest layer has the narrowest scope.** The Emergency Council can only act on five verbs — pause, force, eject, resume, (and the auto-pause at RR < 1.05) — and may not set parameters (Forbidden Action F5). The narrow scope is the price paid for instant execution.

The matrix in §6 — 47 entries covering the four layers — is the single normative reference for parameter governance across the protocol. Any parameter not listed has no update path at all (Listing 14 fails closed on unknown IDs, line 17349). The on-chain enforcement breakdown in §7.2 shows that 11 parameters are cryptographically immutable (C1), 30 are enforced by the governance contract (C2), 5 are enforced by multisig configuration (C3), 2 are operationally enforced (C4), and 2 are documented-only (C5, enforced by absence of a setter).

The 90-day constitutional mechanism (§3) is the protocol's commitment that the rules of the unit cannot be changed faster than the markets and institutions that depend on the unit can respond. It is the single most important governance feature of the system, and it is enforced by three independent mechanisms: the `constant` declaration of `TIMELOCK_CONSTITUTIONAL` (C1), the 7/7 Multi-Sig configuration (C3), and the structural absence of any faster path (C5 + C1 — there is no `setTimelock` function).

---

**Deliverable E — End.**
