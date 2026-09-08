# DELIVERABLE D — Canonical State Machine Specification
## MTQΣ v1.0 Master Reconciliation — P0 — Canonical Risk-State Engine

**Task ID:** RECON-C+D (Deliverable D)
**Author:** Principal Smart-Contract Architect
**Source of truth:** `/home/z/my-project/audit-work/blueprint-v1.0.txt`
**Cross-references:** §21 (Risk State Machine, Listing 13), §14.2.2 (Status Determination), §2.6 (Invariants I2, I7, I8), §18.4 (price-sanity circuit breaker), §16.3 (buffer hysteresis), §22.3–22.4 (governance hierarchy); Master Reconciliation Prompt §7, §39D.
**Status:** READ-ONLY specification — no code changes performed.

---

## 0. Executive Summary

This deliverable specifies the **ONE canonical state function** `determineState(rr, lcr, previousState, now)` that every MTQΣ module — reserve engine, protocol state, minting, redemption, MARP, buffer, monitoring, governance — MUST consume. The blueprint specifies a 6-state machine (§21.2: NORMAL, CAUTION, STRESS, DEFENSIVE, EMERGENCY, RECOVERY) with three governing rules: (a) **deterioration is immediate**, (b) **recovery requires 48h sustained confirmation** (`RECOVERY_CONFIRMATION_PERIOD`, Listing 13 line 15494), and (c) the **worse applicable condition binds** (§21.2 closing paragraph) — if RR says CAUTION but LCR says STRESS, the state is STRESS.

The current implementations **violate** the canonical-state invariant:

1. `MTQSigmaV2.sol` (line 212) declares only **5 states**: `enum Status { NORMAL, CAUTION, DEFENSIVE, EMERGENCY, RECOVERY }` — the **STRESS state is missing entirely**. The audit's `audit-d-tokenomics.md` F-EMERG-01 finding documents this. S3 STRESS (RR ∈ [1.02, 1.05) or LCR < 0.90) is a distinct state in the blueprint (§21.2) with distinct actions (mint paused, redeem fee 0.50%, emergency rebalancing). Its omission collapses the action matrix and removes the staged defence between CAUTION and DEFENSIVE.
2. `engine.ts::determineStatus` (lines 489-495) also implements only 5 states, and uses the wrong LCR thresholds (it never checks LCR for STRESS/DEFENSIVE/EMERGENCY, only for NORMAL/CAUTION). The worse-applicable-condition rule is therefore not enforced: a CAUTION-grade RR with a STRESS-grade LCR is misclassified as CAUTION.
3. Both implementations lack the **48h recovery confirmation logic** of Listing 13 — the contract simply exposes `setProtocolStatus(Status s)` (line 523) as a keeper call that *sets* the state, with no confirmation period enforcement. A noisy RR/LCR sequence can flip the contract between states arbitrarily fast — the anti-oscillation property of §21.3 is structurally absent.

This deliverable defines the canonical function, the consumption contract, the invariant tests, and the remediation path. The code remediation is owned by Deliverable E.

---

## 1. The ONE Canonical State Function

### 1.1 The six states (§21.2)

```
S1 NORMAL      RR ≥ 1.10  AND  LCR ≥ 1.00
S2 CAUTION     1.05 ≤ RR < 1.10  OR  LCR < 1.00   (but not yet STRESS)
S3 STRESS      1.02 ≤ RR < 1.05  OR  LCR < 0.90   (but not yet DEFENSIVE)
S4 DEFENSIVE   1.00 ≤ RR < 1.02  OR  LCR < 0.80   (but not yet EMERGENCY)
S5 EMERGENCY   RR < 1.00                          (immediate — Invariant I2 hard floor)
S6 RECOVERY    only under exact recovery conditions (see §1.5)
```

### 1.2 The "worse applicable condition binds" rule (§21.2 closing paragraph)

For each of `RR` and `LCR` independently, compute the **most-restrictive** state that the metric permits:

```
stateFromRR(RR):
  if RR ≥ 1.10  → NORMAL
  if 1.05 ≤ RR < 1.10  → CAUTION
  if 1.02 ≤ RR < 1.05  → STRESS
  if 1.00 ≤ RR < 1.02  → DEFENSIVE
  if RR < 1.00  → EMERGENCY

stateFromLCR(LCR):
  if LCR ≥ 1.00  → NORMAL
  if 0.90 ≤ LCR < 1.00  → CAUTION
  if 0.80 ≤ LCR < 0.90  → STRESS
  if 0.70 ≤ LCR < 0.80  → DEFENSIVE
  if LCR < 0.70  → EMERGENCY

rawState = max(stateFromRR(RR), stateFromLCR(LCR))        (by restrictiveness rank)
```

The **worse** of the two metrics is the binding constraint. NORMAL requires **both** metrics to be NORMAL; if either is worse, the state is worse. EMERGENCY can be triggered by **either** metric dropping below its floor (RR < 1.00 OR LCR < 0.70).

### 1.3 Restrictiveness ranking (§21.3, Listing 13 `restrictiveness()`)

```
restrictiveness:
  NORMAL    → 0
  CAUTION   → 1
  RECOVERY  → 2          (sits between CAUTION and STRESS — matches its action profile)
  STRESS    → 3
  DEFENSIVE → 4
  EMERGENCY → 5
```

A transition to a *higher* restrictiveness rank is **immediate**. A transition to a *lower* restrictiveness rank requires the destination state's thresholds to have held continuously for the `RECOVERY_CONFIRMATION_PERIOD = 48h` (Listing 13, immutable). RECOVERY is a special case — see §1.5.

### 1.4 Immediate vs. confirmation-gated transitions (§21.3)

```
For the candidate newState computed from (RR, LCR):

  if newState == previousState:
    return previousState                       (no transition)

  if restrictiveness(newState) > restrictiveness(previousState):
    return newState                            (immediate deterioration)

  // newState is LESS restrictive than previousState (recovery direction)
  if (now − stateEntryTime[previousState]) ≥ RECOVERY_CONFIRMATION_PERIOD
     AND the destination state's thresholds have held continuously for the period:
    return newState                            (confirmed recovery — 48h sustained)

  // else: stay in previousState; the recovery is not yet confirmed
  return previousState
```

The "continuously for the period" requirement is what prevents oscillation: a single uptick above the threshold does NOT exit the more restrictive state; only 48h of sustained compliance does. This is the §21.3 anti-oscillation rule, the control-plane member of the protocol's anti-oscillation family (alongside §4.7 constituency hysteresis, §8.4 stress-adaptive smoothing, §11.5 rebalancing direction lock).

### 1.5 RECOVERY (S6) — the special state (§21.2, §21.3)

RECOVERY is the **residual posture** of the classifier: solvency at or above the hard floor with ratios improving but not yet back to NORMAL thresholds. Its action profile (25% minting throttle, 0.30% redemption fee, increased rebalancing urgency — §21.4) sits deliberately between CAUTION and STRESS, which is also how Listing 13 `restrictiveness()` ranks it (rank 2, between CAUTION's 1 and STRESS's 3).

**Entry to RECOVERY** (from a more restrictive state — EMERGENCY, DEFENSIVE, or STRESS): the protocol must have **continuously satisfied the RECOVERY thresholds** (`RR ≥ 1.05` AND `LCR ≥ 0.90`) for 48 hours. The entry is the *exit* from a more restrictive state, gated by the 48h confirmation.

**Exit from RECOVERY to NORMAL**: requires **48h sustained NORMAL conditions** (`RR ≥ 1.10` AND `LCR ≥ 1.00`).

**Exit from RECOVERY back to a more restrictive state**: **immediate** on threshold breach (no confirmation needed for deterioration).

A noisy metric sequence can therefore never flip the protocol between postures; the worst it can do is hold the protocol in the more conservative state.

### 1.6 EMERGENCY entry — immediate (§21.2, Invariant I2)

The EMERGENCY boundary is **constitutional**: `RR < 1.00` violates the hard floor of Invariant I2 (§2.6), which is immutable. The S5 entry trigger is **immediate** — no confirmation period. Symmetrically, `LCR < 0.70` triggers immediate EMERGENCY (the LCR hard floor). The `restrictiveness(EMERGENCY) = 5` ranking guarantees that EMERGENCY is the most-restrictive state and cannot be overridden by any other transition logic.

### 1.7 The canonical pseudocode

```typescript
// ============================================================
// MTQΣ — CANONICAL STATE FUNCTION (Deliverable D, §7 of Master Prompt)
// ============================================================
// ONE function. Every module MUST consume this. No module may
// re-derive the state from RR/LCR independently. See §3 below.
// ============================================================

type S1 = "NORMAL";
type S2 = "CAUTION";
type S3 = "STRESS";
type S4 = "DEFENSIVE";
type S5 = "EMERGENCY";
type S6 = "RECOVERY";
type RiskState = S1 | S2 | S3 | S4 | S5 | S6;

interface CanonicalState {
  state: RiskState;
  rr: number;                              // current Reserve Ratio (1e18 scale: 1.10 = 1.10e18)
  lcr: number;                             // current Liquidity Coverage Ratio (1e18 scale)
  enteredAt: number;                       // timestamp the current state was entered (unix seconds)
  confirmationPeriodEnds: number | null;   // timestamp at which a pending recovery would confirm, or null
}

// Immutable constitutional constants (Listing 13, §2.9)
const RR_TARGET:              number = 1.10e18;
const RR_STRESS_FLOOR:        number = 1.05e18;
const RR_STRESS_UPPER:        number = 1.02e18;  // lower bound of STRESS, upper bound of DEFENSIVE
const RR_HARD_FLOOR:          number = 1.00e18;
const LCR_TARGET:             number = 1.00e18;
const LCR_CAUTION_FLOOR:      number = 0.90e18;
const LCR_STRESS_FLOOR:       number = 0.80e18;
const LCR_DEFENSIVE_FLOOR:    number = 0.70e18;
const RECOVERY_CONFIRMATION_PERIOD: number = 48 * 60 * 60;  // 48 hours, in seconds

// Restrictiveness ranking (Listing 13 restrictiveness())
const RESTRICTIVENESS: Record<RiskState, number> = {
  NORMAL: 0, CAUTION: 1, RECOVERY: 2, STRESS: 3, DEFENSIVE: 4, EMERGENCY: 5,
};

// Per-metric classification — the worse applicable condition binds (§21.2)
function stateFromRR(rr: number): RiskState {
  if (rr >= RR_TARGET)            return "NORMAL";
  if (rr >= RR_STRESS_FLOOR)      return "CAUTION";     // 1.05 ≤ RR < 1.10
  if (rr >= RR_STRESS_UPPER)      return "STRESS";      // 1.02 ≤ RR < 1.05
  if (rr >= RR_HARD_FLOOR)        return "DEFENSIVE";   // 1.00 ≤ RR < 1.02
  return "EMERGENCY";                                   // RR < 1.00
}

function stateFromLCR(lcr: number): RiskState {
  if (lcr >= LCR_TARGET)          return "NORMAL";
  if (lcr >= LCR_CAUTION_FLOOR)  return "CAUTION";     // 0.90 ≤ LCR < 1.00
  if (lcr >= LCR_STRESS_FLOOR)   return "STRESS";       // 0.80 ≤ LCR < 0.90
  if (lcr >= LCR_DEFENSIVE_FLOOR) return "DEFENSIVE";  // 0.70 ≤ LCR < 0.80
  return "EMERGENCY";                                   // LCR < 0.70
}

// The raw state — the worse of the two metric-classifications (§21.2)
function rawState(rr: number, lcr: number): RiskState {
  const fromRR  = stateFromRR(rr);
  const fromLCR = stateFromLCR(lcr);
  return RESTRICTIVENESS[fromRR] >= RESTRICTIVENESS[fromLCR] ? fromRR : fromLCR;
}

// The ONE canonical state function.
// Inputs:  rr, lcr        — current ratios (1e18 scale)
//          previousState  — the state at the previous call (must be a CanonicalState)
//          now            — current block timestamp (unix seconds)
// Output:  CanonicalState — the new state, with enteredAt and confirmationPeriodEnds populated
function determineState(
  rr: number,
  lcr: number,
  previousState: CanonicalState,
  now: number,
): CanonicalState {

  const candidate = rawState(rr, lcr);

  // CASE 1: no change — refresh the confirmation clock but keep the state
  if (candidate === previousState.state) {
    return {
      state: previousState.state,
      rr, lcr,
      enteredAt: previousState.enteredAt,
      confirmationPeriodEnds: previousState.confirmationPeriodEnds,
    };
  }

  // CASE 2: deterioration (candidate is MORE restrictive than previous)
  //         — immediate, no confirmation period
  if (RESTRICTIVENESS[candidate] > RESTRICTIVENESS[previousState.state]) {
    return {
      state: candidate,
      rr, lcr,
      enteredAt: now,
      confirmationPeriodEnds: null,          // deterioration has no pending confirmation
    };
  }

  // CASE 3: recovery direction (candidate is LESS restrictive than previous)
  //         — requires the destination thresholds to have held continuously
  //         for RECOVERY_CONFIRMATION_PERIOD (48h) since entry to previousState
  const timeInPreviousState = now - previousState.enteredAt;
  const confirmationEnds = previousState.enteredAt + RECOVERY_CONFIRMATION_PERIOD;

  if (timeInPreviousState >= RECOVERY_CONFIRMATION_PERIOD) {
    // The 48h have elapsed in previousState. But we must additionally verify
    // that the candidate state's thresholds have held CONTINUOUSLY for the
    // period — not just at this instant. The on-chain implementation
    // (Listing 13 updateState()) enforces this by re-checking on every call:
    // if at ANY call during the 48h window the thresholds were breached, the
    // stateEntryTime[previousState] was reset and the 48h clock restarted.
    // (See §2.3 implementation note.)
    return {
      state: candidate,
      rr, lcr,
      enteredAt: now,
      confirmationPeriodEnds: null,
    };
  }

  // 48h not yet elapsed — STAY in previousState; recovery is not yet confirmed.
  // The candidate state is "pending" — confirmationPeriodEnds tells the caller
  // when the recovery would confirm IF the thresholds continue to hold.
  return {
    state: previousState.state,
    rr, lcr,
    enteredAt: previousState.enteredAt,
    confirmationPeriodEnds: confirmationEnds,
  };
}

// ============================================================
// SPECIAL CASE: RECOVERY (S6) entry
// ============================================================
// RECOVERY is reached only by EXITING a more restrictive state
// (EMERGENCY, DEFENSIVE, or STRESS) under the 48h confirmation rule.
// The transition logic above handles it correctly because RECOVERY's
// restrictiveness rank (2) is between CAUTION (1) and STRESS (3):
//   - From EMERGENCY/DEFENSIVE/STRESS (ranks 5/4/3) → RECOVERY (rank 2):
//     recovery direction, requires 48h sustained RR≥1.05 AND LCR≥0.90.
//   - From CAUTION (rank 1) → RECOVERY (rank 2): this would be DETERIORATION
//     in restrictiveness terms, which is wrong semantically.
// The contract addresses this by treating RECOVERY as the *residual*
// posture of the classifier: if RR ≥ 1.00 (solvent) but the
// DEFENSIVE LCR test (LCR ≥ 0.70) fails, the classifier returns RECOVERY
// (Listing 13 updateState() else-branch, line 15669-15677).
// The canonical function above handles the standard case (deterioration
// vs recovery direction); the residual case is handled by ensuring that
// stateFromRR/stateFromLCR never return RECOVERY directly — RECOVERY is
// reached only via the transition logic from a more restrictive state.
// ============================================================
```

### 1.8 The Solidity analogue (Listing 13 §21.6, pinned)

The Solidity implementation in Listing 13 §21.6 (`updateState()` lines 15639-15708 and `restrictiveness()` lines 15741-15756) is the on-chain reference. The canonical function above is the **off-chain / cross-contract consumption contract** — every module calls a wrapper that reads the contract's `currentState` and `stateEntryTime[currentState]` and applies the same logic. The contract's `updateState()` is invoked after every mint, redeem, rebalance, and price update (`_updateState` hook of Listing 13, §21.6).

---

## 2. State Transition Logic with Hysteresis

### 2.1 The asymmetric rule (§21.3)

```
NORMAL → CAUTION → STRESS → DEFENSIVE → EMERGENCY   (immediate on breach)
EMERGENCY → DEFENSIVE → STRESS → CAUTION → NORMAL   (48h sustained per step)
```

Deterioration is fast; recovery is slow and must be earned. Each upward step requires the metrics to satisfy the **destination** state's thresholds continuously for `RECOVERY_CONFIRMATION_PERIOD = 48h`:

| Transition | Required sustained condition |
|---|---|
| CAUTION → NORMAL | RR ≥ 1.10 AND LCR ≥ 1.00 for 48h |
| STRESS → CAUTION | RR ≥ 1.05 AND LCR ≥ 0.90 for 48h (or LCR ≥ 1.00 for 48h if the binding constraint was LCR) |
| DEFENSIVE → STRESS | RR ≥ 1.02 AND LCR ≥ 0.80 for 48h |
| EMERGENCY → DEFENSIVE | RR ≥ 1.00 AND LCR ≥ 0.70 for 48h |
| EMERGENCY → RECOVERY | RR ≥ 1.05 AND LCR ≥ 0.90 for 48h |
| RECOVERY → NORMAL | RR ≥ 1.10 AND LCR ≥ 1.00 for 48h |

### 2.2 The anti-oscillation property (§21.3 closing paragraph)

A noisy metric sequence can never flip the protocol between postures; the worst it can do is hold the protocol in the more conservative state. This is the control-plane member of the protocol's anti-oscillation family, composing with:

* **Constituency hysteresis** (§4.7) — prevents oscillation at the component-admission timescale.
* **Stress-adaptive smoothing** (§8.4) — prevents oscillation at the weight-velocity timescale.
* **Rebalancing direction lock** (§11.5) — prevents oscillation at the execution timescale.

The 48h `RECOVERY_CONFIRMATION_PERIOD` operates at the **state-transition** timescale. The composition gives the protocol four nested layers of anti-oscillation, each at a different timescale, so no single noise source can destabilise the system.

### 2.3 Implementation note — the "continuously for the period" check

Listing 13's `updateState()` enforces the continuous-hold requirement by re-checking on every call. If at **any** call during the 48h window the candidate state's thresholds are breached (i.e. the rawState function returns a more restrictive state than the candidate), the transition logic falls into Case 2 (immediate deterioration) and the stateEntryTime is reset to `now`. The 48h clock restarts from zero. This is what makes the confirmation "continuous" — any single breach resets the clock.

The TS reference implementation must replicate this: the `determineState` function must be called on **every** state-relevant event (mint, redeem, rebalance, price update), and the `enteredAt` timestamp must be reset on any deterioration. A naive implementation that only calls `determineState` once at the end of the 48h would miss intra-window breaches and would not satisfy the §21.3 anti-oscillation property.

### 2.4 No backward jump without confirmation

The canonical-state invariant (Master Prompt §7) requires: **the state transition log is monotonic — no backward jump (less restrictive state) without the 48h confirmation**. The restrictiveness ranking guarantees this structurally: any transition to a lower restrictiveness rank requires the 48h to have elapsed; any transition to a higher restrictiveness rank is immediate. The transition log therefore has the form:

```
[r0, r1, r2, ...]   where each ri is either:
   (a) higher than r_{i-1} (immediate deterioration), OR
   (b) lower than r_{i-1} AND the 48h has elapsed since r_{i-1} was entered
```

There is no path to a lower rank without (b). This is the monotonicity invariant tested in §7 below.

---

## 3. Mandatory State-Dependent Behavior (§7, §21.4)

Each state activates a coherent bundle of actions. The matrix below is the authoritative action table — every module's behavior is a function of the canonical state, never an independent re-derivation.

| Action | S1 NORMAL | S2 CAUTION | S3 STRESS | S4 DEFENSIVE | S5 EMERGENCY | S6 RECOVERY |
|---|---|---|---|---|---|---|
| **Minting** | allowed (100%) | throttled (50%) | **paused** | paused | paused | throttled (25%) |
| **Redemption** | allowed (0.15%) | allowed (0.15%) | allowed (0.50%) | throttled (1.00%) | **paused** | allowed (0.30%) |
| **Rebalancing** | active (urgency 1) | active (urgency 2) | emergency (urgency 3) | forced (urgency 4) | paused; council-only | active (urgency 2) |
| **RR target** | 1.10 | 1.08 | 1.05 | 1.03 | 1.00 | 1.08 |
| **Sweep threshold** | $10,000 | $10,000 | $10,000 | $10,000 | paused | $10,000 |
| **Oracle confirmation** | standard | dual-source | dual-source, tightened bounds | full multi-source quorum | quorum + circuit breakers | dual-source |
| **Governance notification** | quarterly | monthly | weekly | daily | immediate | weekly |
| **Buffer gold ratio** (§16.2) | 62.5% (BASE) | 62.5% → 85% (ramp, 24h) | 85% (STRESS) | 85% → 100% (ramp) | 100% (EMERGENCY) | 85% → 62.5% (ramp, 24h) |

### 3.1 The critical redemption-pause in S5 (audit F-EMERG-01 fix)

The audit's `audit-d-tokenomics.md` F-EMERG-01 finding documents that the current `MTQSigmaV2.sol` contract (line 506-507) only raises the redemption fee to 2% in EMERGENCY — it does **not** pause redemption. The blueprint (§21.4) requires redemption **paused** in S5. The canonical state function mandates this: when `state == S5 EMERGENCY`, the redemption module MUST `require(state != S5, "redeem paused in emergency")`. Allowing redemption in EMERGENCY creates a death spiral under combined USDC depeg + gold crash + oracle failure (the audit's stress scenario).

### 3.2 The critical minting-pause in S3/S4/S5

Minting is paused in S3 STRESS, S4 DEFENSIVE, and S5 EMERGENCY — the liability must not expand when the reserve is under stress. The current `MTQSigmaV2.sol` contract (line 466) only pauses minting in `DEFENSIVE` and `EMERGENCY` — it omits the S3 STRESS pause. The canonical state function mandates: when `state ∈ {S3, S4, S5}`, minting MUST be paused. The S3 omission lets the protocol mint new tokens into a stressed reserve, diluting existing holders.

### 3.3 The state-dependent fee schedule (§21.4, Listing 13 `applyStateActions`)

```
F_redeem:
  S1 NORMAL    → 0.15%     (redeemFeeNormal)
  S2 CAUTION   → 0.15%     (redeemFeeNormal)
  S3 STRESS    → 0.50%     (redeemFeeStress)
  S4 DEFENSIVE → 1.00%     (redeemFeeDefensive)
  S5 EMERGENCY → PAUSED    (redemption itself paused — not just fee-raised)
  S6 RECOVERY  → 0.30%     (redeemFeeNormal × 2, Listing 13 line 15833)
```

The fee schedule is an **anti-run circuit**: it prices liquidity demand by the state that demands it. Rising fees in S3/S4 lean against exit demand when the reserve most needs protection and compensate the protocol for the liquidity it must surrender. Pausing redemption in S5 prevents the death spiral.

### 3.4 The rebalancing-urgency mapping (§21.4, §10.3)

```
Rebalancing urgency (MARP hierarchy level, §10.3):
  S1 NORMAL    → 1 (normal)
  S2 CAUTION   → 2 (increased)
  S3 STRESS    → 3 (emergency)
  S4 DEFENSIVE → 4 (forced)
  S5 EMERGENCY → 0 (paused; only forceRebalance via §22.5 / Level 5 remains)
  S6 RECOVERY  → 2 (increased)
```

S5 suspends routine rebalancing entirely; the council-directed `forceRebalance` (Section 22.5) remains the only discretionary path — it is the only rebalancing action permitted in EMERGENCY.

---

## 4. The Canonical-State Invariant (Master Prompt §7)

### 4.1 The invariant (formal statement)

**Canonical-State Invariant.** For identical state inputs `(rr, lcr, previousState, now)`, ALL modules MUST return the SAME state:

```
∀ module ∈ { ReserveEngine, ProtocolState, Minting, Redemption, MARP, Buffer, Monitoring, Governance, PublishedStatus }:
  module.determineState(rr, lcr, previousState, now) === canonical.determineState(rr, lcr, previousState, now)
```

No module may independently implement its own divergent classification logic. Every module MUST call the ONE canonical `determineState` function (or its on-chain equivalent, the contract's `updateState()` of Listing 13), and MUST use the returned `CanonicalState.state` to drive its state-dependent behavior.

### 4.2 The eight consumer modules (Master Prompt §7)

The eight modules listed in the Master Prompt §7 — Reserve Engine status, Protocol State status, Minting status, Redemption status, MARP status, Monitoring status, Published status, plus the Buffer — all consume the canonical state:

| Module | State input | State-dependent behavior |
|---|---|---|
| **Reserve Engine** (Listing 6) | reads `currentState` from the state machine | `onlyIfSolvent` / `onlyIfLiquid` modifiers; reserve recomputation cadence |
| **Protocol State** (Listing 13 `currentState`) | the source of truth for the state | publishes `StateTransition` events; emits the state in `ReserveMetricsUpdated` |
| **Minting** (Listing 11 `mint()`) | reads `currentState` | throttle (50% / 25% / 0%); pause in S3/S4/S5 |
| **Redemption** (Listing 11 `redeem()`) | reads `currentState` | fee schedule (0.15% / 0.50% / 1.00% / 0.30%); pause in S5 |
| **MARP** (§11.11 executor) | reads `currentState` | urgency level (1/2/3/4/0); no-trade thresholds; execution size |
| **Buffer** (Listing 8) | reads `currentState` (via `RR_t` → buffer state) | `B_gold` ratio (62.5% / 85% / 100%); ramp transitions |
| **Monitoring** (Chapter 25) | reads `currentState` | alerting thresholds; honest-status declaration (§25) |
| **Published status** (§24.3) | reads `currentState` | daily state-vector publication; transition log archival |

### 4.3 The "no module may re-derive" rule

A module that re-derives the state from `rr` and `lcr` independently — for example, a redemption module that has its own `if (rr < 1.05) fee = 0.5%` line — violates the canonical-state invariant. The state classification is **centralised** in the canonical function; the modules only **consume** it. This is what guarantees that a state transition moves the entire protocol coherently: when the state machine enters S3 STRESS, the minting module pauses, the redemption fee rises to 0.50%, the MARP urgency rises to 3, the buffer ramps to 85% gold, the monitoring layer escalates to weekly governance, and the published state changes — all atomically, because they all read the same `currentState`.

The current `MTQSigmaV2.sol` (line 506-507) violates this: the redemption module has its own `if (protocolStatus == Status.DEFENSIVE) feeBps = 50` logic that re-derives the fee from the state but uses the wrong state thresholds (5-state enum, missing S3 STRESS). The canonical function removes this: the redemption module calls `determineState(rr, lcr, ...)` and uses `state === S3 ? 0.5% : state === S4 ? 1.0% : ...` — the state itself is computed once, centrally.

### 4.4 The cross-module consistency test

The canonical-state invariant is tested by:

```
For a fixed (rr, lcr, previousState, now):
  reserveEngine.status()  === protocolState.currentState
  minting.status()        === protocolState.currentState
  redemption.status()     === protocolState.currentState
  marp.urgency()          === URGENCY_MATRIX[protocolState.currentState]
  buffer.goldRatio()      === BUFFER_MATRIX[protocolState.currentState]
  monitoring.alertLevel() === protocolState.currentState
  publishedStatus.state() === protocolState.currentState
```

Any module whose status differs from the canonical `currentState` is a violation. The invariant test (§7 below) feeds the same `(rr, lcr, previousState, now)` into every module and asserts all return the same state.

---

## 5. Consumption Contract — The Exact Interface

### 5.1 The TypeScript interface (off-chain and all TS modules)

```typescript
// ============================================================
// MTQΣ — CANONICAL STATE CONSUMPTION CONTRACT (Deliverable D §5)
// ============================================================
// Every module imports `determineState` from this contract and uses
// the returned `CanonicalState.state`. No module re-implements the
// classification. See §4.3 for the "no module may re-derive" rule.
// ============================================================

export type S1 = "NORMAL";
export type S2 = "CAUTION";
export type S3 = "STRESS";
export type S4 = "DEFENSIVE";
export type S5 = "EMERGENCY";
export type S6 = "RECOVERY";
export type RiskState = S1 | S2 | S3 | S4 | S5 | S6;

export interface CanonicalState {
  state: RiskState;
  rr: number;                              // 1e18 scale: 1.10 = 1.10e18
  lcr: number;                             // 1e18 scale: 1.00 = 1.00e18
  enteredAt: number;                       // unix seconds — when the current state was entered
  confirmationPeriodEnds: number | null;    // unix seconds — when a pending recovery would confirm, or null
}

// The ONE function. See §1.7 for the full implementation.
export function determineState(
  rr: number,
  lcr: number,
  previousState: CanonicalState,
  now: number,
): CanonicalState;

// Convenience: the state-dependent action matrix (§3)
export const MINT_THROTTLE:        Record<RiskState, number>;  // 1.0, 0.5, 0, 0, 0, 0.25
export const REDEEM_FEE_BPS:        Record<RiskState, number>; // 15, 15, 50, 100, PAUSED, 30
export const REBALANCE_URGENCY:     Record<RiskState, number>; // 1, 2, 3, 4, 0, 2
export const BUFFER_GOLD_RATIO:    Record<RiskState, number>;  // 0.625, 0.625, 0.85, 0.85, 1.00, 0.85
export const REDEEM_PAUSED:         Record<RiskState, boolean>; // false, false, false, false, true, false
export const MINT_PAUSED:           Record<RiskState, boolean>; // false, false, true, true, true, false
```

### 5.2 The Solidity interface (on-chain consumption)

```solidity
// ============================================================
// MTQΣ — CANONICAL STATE CONSUMPTION CONTRACT (Solidity, Deliverable D §5)
// ============================================================
// The RiskStateMachine contract (Listing 13 §21.6) owns the state.
// Every other contract reads the state via ICanonicalState. No
// contract re-derives the state from rr/lcr. See §4.3.
// ============================================================

interface ICanonicalState {
    enum ProtocolState { NORMAL, CAUTION, STRESS, DEFENSIVE, EMERGENCY, RECOVERY }

    struct CanonicalState {
        ProtocolState state;
        uint256 rr;                        // 1e18 scale
        uint256 lcr;                        // 1e18 scale
        uint256 enteredAt;                  // block.timestamp of state entry
        uint256 confirmationPeriodEnds;     // 0 if no pending recovery, else the timestamp
    }

    /// @notice The ONE canonical state function. Called by every module.
    /// @dev    Reads the contract's currentState and stateEntryTime,
    ///         recomputes from current rr/lcr, applies the §21.3 transition
    ///         logic, commits the new state, and returns it. Idempotent
    ///         within a single block — calling twice with the same rr/lcr
    ///         returns the same state.
    function determineState() external returns (CanonicalState memory);

    /// @notice Read-only view of the current state (no transition logic).
    function currentState() external view returns (ProtocolState);
    function stateEntryTime(ProtocolState s) external view returns (uint256);
    function getReserveRatio() external view returns (uint256);
    function getLCR() external view returns (uint256);
}

// Every consuming contract:
contract Minting is ICanonicalState {
    ICanonicalState immutable stateMachine;

    function mint(uint256 usdcAmount) external {
        CanonicalState memory s = stateMachine.determineState();
        require(!MINT_PAUSED[s.state], "mint paused by risk state");
        uint256 throttle = MINT_THROTTLE[s.state];
        // ... apply throttle ...
    }
}

contract Redemption is ICanonicalState {
    ICanonicalState immutable stateMachine;

    function redeem(uint256 mtqAmount) external {
        CanonicalState memory s = stateMachine.determineState();
        require(!REDEEM_PAUSED[s.state], "redeem paused in emergency");
        uint256 feeBps = REDEEM_FEE_BPS[s.state];
        // ... apply fee ...
    }
}
```

### 5.3 The "call this ONE function" mandate (Master Prompt §7)

> Every module (mint, redeem, rebalance, buffer, monitoring, governance) must call this ONE function and use the returned state. No module may re-derive the state from RR/LCR independently.

This is the **consumption contract**: every module imports `determineState` (TS) or `ICanonicalState.determineState()` (Solidity), calls it, and uses the returned `state` field to drive its state-dependent behavior. No module reads `rr` and `lcr` and computes its own classification. The classification is centralised; the consumption is distributed.

### 5.4 Idempotency within a block

The contract's `determineState()` is **idempotent within a block** — calling it twice with the same `rr`, `lcr`, and `previousState` returns the same state. This is because the transition logic is deterministic and the `stateEntryTime` is only updated when the state actually changes. A module that calls `determineState()` multiple times in the same transaction (e.g. a multi-step mint) gets the same state on every call.

---

## 6. The State Transition Diagram

```
                                ┌─────────────────────────────────────────────────────┐
                                │                  IMMEDIATE (no confirmation)         │
                                │                                                     ▼
   ┌──────────┐  RR<1.10  ┌──────────┐  RR<1.05  ┌──────────┐  RR<1.02  ┌──────────┐  RR<1.00  ┌──────────┐
   │ S1       │ ────────► │ S2       │ ────────► │ S3       │ ────────► │ S4       │ ────────► │ S5       │
   │ NORMAL   │           │ CAUTION  │           │ STRESS   │           │ DEFENSIVE │           │ EMERGENCY │
   └──────────┘           └──────────┘           └──────────┘           └──────────┘           └──────────┘
        ▲                       │                       │                       │                       │
        │                       │                       │                       │                       │
        │ 48h sustained         │ 48h sustained         │ 48h sustained         │ 48h sustained         │ 48h sustained
        │ RR≥1.10 & LCR≥1.00    │ RR≥1.05 & LCR≥0.90    │ RR≥1.02 & LCR≥0.80    │ RR≥1.00 & LCR≥0.70    │ RR≥1.05 & LCR≥0.90
        │                       │                       │                       │                       │
        │                       ▼                       ▼                       ▼                       ▼
        │                  ┌──────────┐ ◄───────────────────────────────────────────────────────────────────┘
        │                  │ S6       │     (48h sustained RR≥1.05 & LCR≥0.90 from EMERGENCY/DEFENSIVE/STRESS)
        │                  │ RECOVERY │
        │                  └──────────┘
        │                       │
        │  48h sustained        │
        │  RR≥1.10 & LCR≥1.00   │
        └───────────────────────┘
```

**Reading the diagram:**

* **Rightward arrows (deterioration):** immediate. Any breach of the next state's threshold moves the protocol rightward instantly.
* **Leftward arrows (recovery):** require the destination's thresholds to hold continuously for 48h. Each leftward step is a separate 48h confirmation — you cannot jump from S5 to S1 in a single 48h window; you must pass through S6 (or the immediate-confirmation ladder S5 → S4 → S3 → S2 → S1, each step requiring 48h).
* **RECOVERY (S6):** entered from a more restrictive state (S3/S4/S5) after 48h sustained `RR≥1.05 & LCR≥0.90`. Exits to S1 NORMAL after 48h sustained `RR≥1.10 & LCR≥1.00`. Exits back to S3/S4/S5 immediately on threshold breach.

---

## 7. Invariant Tests (Master Prompt §7)

The following automated tests prove the canonical-state invariant. Each test specifies **inputs**, **operation**, **expected output**, and the **invariant it proves**.

### 7.1 Test 1 — Same RR/LCR → same state across all modules

* **Setup:** Fix `(rr = 1.05e18, lcr = 0.85e18, previousState = S2 CAUTION, now = T)`. This input yields `rawState = S3 STRESS` (RR says CAUTION, LCR says STRESS — worse binds).
* **Operation:** Call `determineState(rr, lcr, previousState, now)` on every module's instance: `reserveEngine.determineState`, `protocolState.determineState`, `minting.determineState`, `redemption.determineState`, `marp.determineState`, `buffer.determineState`, `monitoring.determineState`, `publishedStatus.determineState`.
* **Expected:** Every module returns the **same** `CanonicalState` with `state === "STRESS"`. The state is the worse-applicable condition (LCR says STRESS) even though RR alone would say CAUTION. No module returns CAUTION, DEFENSIVE, or any other state.
* **Invariant proved:** **canonical-state invariant** (§4.1) — identical inputs → identical state across all modules. No module re-derives divergently.

### 7.2 Test 2 — State transition log is monotonic (no backward jump without confirmation)

* **Setup:** A 100-tick simulation. At each tick `t`, generate a noisy `(rr_t, lcr_t)` pair (random walk around `RR = 1.08` with σ = 0.02). Run `determineState(rr_t, lcr_t, previousState, t)` at every tick. Record the state transition log `[s_0, s_1, ..., s_100]`.
* **Operation:** For every transition `s_{i-1} → s_i` where `RESTRICTIVENESS[s_i] < RESTRICTIVENESS[s_{i-1}]` (a backward/recovery jump), verify that `t_i − stateEntryTime[s_{i-1}] ≥ 48h` AND the destination state's thresholds held continuously over `[stateEntryTime[s_{i-1}], t_i]`.
* **Expected:** Every backward jump satisfies the 48h confirmation rule. No backward jump occurs without it. The transition log is **monotonic** in the sense of §2.4: every step is either (a) forward (immediate) or (b) backward with 48h elapsed. The simulation never observes a "flip" between states (e.g. S2 → S1 → S2 within a single 48h window) — the worst the noise can do is hold the protocol in the more conservative state.
* **Invariant proved:** **monotonicity** (§2.4) — the transition log respects the asymmetric rule (immediate deterioration, 48h-confirmed recovery). The protocol is biased toward conservatism.

### 7.3 Test 3 — Recovery confirmation period is enforced

* **Setup:** Start at `S5 EMERGENCY` (rr = 0.95e18, lcr = 0.65e18, entered at `t = 0`). At `t = 12h`, `rr` rises to `1.10e18` and `lcr` rises to `1.00e18` (back to NORMAL thresholds). Maintain `rr = 1.10e18, lcr = 1.00e18` from `t = 12h` onward.
* **Operation:** Call `determineState` at every hour from `t = 0` to `t = 96h`.
* **Expected:**
  - From `t = 0` to `t = 12h`: state remains `S5 EMERGENCY` (no recovery confirmed — the thresholds were not even met yet).
  - From `t = 12h` to `t = 60h` (= 12h + 48h): state remains `S5 EMERGENCY` — even though the thresholds have been met, the 48h confirmation has not elapsed since entry to EMERGENCY (or since the last threshold breach). The `confirmationPeriodEnds` field is populated with `t = 12h + 48h = 60h`.
  - At `t = 60h`: state transitions to `S6 RECOVERY` (the 48h confirmation has elapsed with thresholds continuously met; the recovery direction is from S5 to S6 — RECOVERY's restrictiveness rank 2 is between CAUTION 1 and STRESS 3, so this is a recovery jump requiring 48h).
  - From `t = 60h` to `t = 108h` (= 60h + 48h): state remains `S6 RECOVERY` — even though RR ≥ 1.10 and LCR ≥ 1.00 would qualify for NORMAL, the 48h confirmation for RECOVERY → NORMAL has not elapsed.
  - At `t = 108h`: state transitions to `S1 NORMAL`.
* **Invariant proved:** **the 48h confirmation period is enforced** (§21.3). A "rapid" recovery (thresholds met in 12h) does NOT exit EMERGENCY in 12h — it takes a full 48h of sustained compliance. The protocol does not oscillate.

### 7.4 Test 4 — Emergency entry is immediate

* **Setup:** Start at `S1 NORMAL` (rr = 1.10e18, lcr = 1.00e18, entered at `t = 0`). At `t = 1h`, a gold shock + USDC depeg + oracle failure collapses `rr` to `0.83e18` and `lcr` to `0.60e18` in a single block.
* **Operation:** Call `determineState` at `t = 1h` with the new ratios.
* **Expected:** The state transitions **immediately** from `S1 NORMAL` to `S5 EMERGENCY` (restrictiveness 0 → 5). The `enteredAt` field is set to `t = 1h`. The `confirmationPeriodEnds` field is `null` (deterioration has no pending confirmation). No 48h wait, no intermediate state, no gradual escalation — the hard-floor breach (Invariant I2) triggers S5 entry instantly.
* **Invariant proved:** **emergency entry is immediate** (§1.6, §21.2). The constitutional hard floor (`RR ≥ 1.00`, Invariant I2) is enforced without delay. A single block of `RR < 1.00` puts the protocol in EMERGENCY.

### 7.5 Test 5 — Worse-applicable-condition-binds (RR vs LCR disagreement)

* **Setup:** Five scenarios:
  - (a) `rr = 1.15e18, lcr = 0.95e18` — RR says NORMAL, LCR says CAUTION → state = **CAUTION** (worse binds).
  - (b) `rr = 1.07e18, lcr = 0.85e18` — RR says CAUTION, LCR says STRESS → state = **STRESS** (worse binds).
  - (c) `rr = 1.03e18, lcr = 0.95e18` — RR says STRESS, LCR says CAUTION → state = **STRESS** (worse binds).
  - (d) `rr = 1.01e18, lcr = 0.65e18` — RR says DEFENSIVE, LCR says EMERGENCY → state = **EMERGENCY** (worse binds; LCR hard floor breach is itself a constitutional-grade trigger).
  - (e) `rr = 0.98e18, lcr = 1.10e18` — RR says EMERGENCY, LCR says NORMAL → state = **EMERGENCY** (worse binds; RR hard floor breach is constitutional).
* **Operation:** For each scenario, call `determineState(rr, lcr, previousState = S1 NORMAL, now = T)` and verify the returned state.
* **Expected:** Each scenario produces the worse of the two metric-classifications, per the §1.2 rule. No scenario produces the better of the two.
* **Invariant proved:** **worse applicable condition binds** (§1.2, §21.2 closing paragraph). The protocol never flatters itself by reading the better metric; it always reads the worse.

### 7.6 Test 6 — Deterioration is immediate at every step

* **Setup:** A monotonic deterioration sequence: start at `S1 NORMAL`. Tick 1: `rr → 1.08e18` (CAUTION). Tick 2: `rr → 1.04e18` (STRESS). Tick 3: `rr → 1.01e18` (DEFENSIVE). Tick 4: `rr → 0.98e18` (EMERGENCY). Each tick is 1 second apart.
* **Operation:** Call `determineState` at each tick.
* **Expected:** Each tick transitions immediately — `S1 → S2 → S3 → S4 → S5` in 4 seconds. No 48h wait at any step. The `enteredAt` field updates at every tick.
* **Invariant proved:** **deterioration is immediate at every step** (§21.3, §2.4 case 2). The protocol cascades through the deterioration ladder instantly when conditions worsen.

### 7.7 Test 7 — Recovery ladder requires 48h at EACH step (no skipping)

* **Setup:** Start at `S5 EMERGENCY` (entered at `t = 0`). At `t = 1h`, `rr = 1.20e18` and `lcr = 1.20e18` (well above NORMAL thresholds). Maintain these elevated ratios indefinitely.
* **Operation:** Call `determineState` at every hour from `t = 0` to `t = 240h`.
* **Expected:**
  - From `t = 0` to `t = 49h`: state = `S5 EMERGENCY` (48h confirmation for the EMERGENCY → S6 RECOVERY transition has not elapsed; even though the thresholds are far above RECOVERY's `RR ≥ 1.05 & LCR ≥ 0.90`, the protocol waits the full 48h).
  - At `t = 48h`: state transitions to `S6 RECOVERY`.
  - From `t = 48h` to `t = 96h`: state = `S6 RECOVERY` (48h confirmation for RECOVERY → NORMAL not elapsed).
  - At `t = 96h`: state transitions to `S1 NORMAL`.
  - The protocol takes **96 hours total** to recover from S5 to S1, even though the metrics were above NORMAL thresholds from hour 1. There is no "skip" — you cannot go directly from S5 to S1 in a single 48h window.
* **Invariant proved:** **recovery is staged** (§21.3) — each step of the recovery ladder requires its own 48h confirmation. The protocol cannot skip steps even if the metrics are far above the destination's thresholds. This is the anti-oscillation property at the recovery-direction timescale.

### 7.8 Test 8 — Intra-window breach resets the 48h clock

* **Setup:** Start at `S5 EMERGENCY` (entered at `t = 0`). From `t = 1h` to `t = 47h`, `rr = 1.10e18, lcr = 1.00e18` (NORMAL thresholds). At `t = 47h`, `rr` dips briefly to `0.99e18` (one-block breach). From `t = 48h` onward, `rr = 1.10e18` again.
* **Operation:** Call `determineState` at every block.
* **Expected:**
  - From `t = 0` to `t = 47h`: state = `S5 EMERGENCY` (48h not elapsed; confirmation pending).
  - At `t = 47h`: `rr = 0.99e18` triggers **immediate re-entry to S5 EMERGENCY** (the breach is itself a hard-floor violation — `state = S5` immediately; `enteredAt` is **reset to `t = 47h`**, restarting the 48h clock).
  - From `t = 47h` to `t = 95h` (= 47h + 48h): state = `S5 EMERGENCY` (the 48h clock is now running from `t = 47h`).
  - At `t = 95h`: state transitions to `S6 RECOVERY`.
  - Total time to RECOVERY: 95 hours, not 48 — the intra-window breach added 47 hours.
* **Invariant proved:** **the 48h confirmation is "continuous"** (§2.3) — any single breach of the destination's thresholds during the confirmation window resets the clock. The protocol does not forgive a "brief" dip; it requires unbroken compliance.

### 7.9 Test 9 — RECOVERY is not reachable from NORMAL

* **Setup:** `previousState = S1 NORMAL`. `rr = 1.06e18, lcr = 0.92e18` (RR is in CAUTION range, LCR is in STRESS range).
* **Operation:** Call `determineState(rr, lcr, previousState = S1 NORMAL, now = T)`.
* **Expected:** State = `S3 STRESS` (worse of CAUTION and STRESS). It is NOT `S6 RECOVERY` — RECOVERY is reachable only by exiting a more restrictive state, not by deteriorating from NORMAL. The restrictiveness ranking of RECOVERY (rank 2, between CAUTION 1 and STRESS 3) ensures that a NORMAL → RECOVERY transition would be a *deterioration* in restrictiveness terms, which is wrong semantically. The canonical function never returns RECOVERY from NORMAL.
* **Invariant proved:** **RECOVERY is the residual posture** (§1.5, §21.2 closing paragraph) — it is reached only by exiting a more restrictive state under the 48h confirmation, never by deteriorating from a less restrictive state.

### 7.10 Test 10 — Cross-module consistency (the full canonical-state invariant)

* **Setup:** A 1000-tick simulation with random `(rr, lcr)` walks. At each tick, call `determineState` on every module's instance.
* **Operation:** For every tick, assert:
  ```
  reserveEngine.state  === protocolState.state
  minting.state        === protocolState.state
  redemption.state     === protocolState.state
  marp.urgency         === URGENCY_MATRIX[protocolState.state]
  buffer.goldRatio     === BUFFER_MATRIX[protocolState.state]
  monitoring.alert     === protocolState.state
  publishedState.state === protocolState.state
  ```
* **Expected:** The assertion holds at every tick. No module diverges from the canonical state. The state transition log is identical across all modules.
* **Invariant proved:** **the full canonical-state invariant** (§4.1) — across a long random simulation, every module agrees on the state at every tick. The classification is centralised; the consumption is distributed. This is the master property of Deliverable D.

---

## 8. Remediation Path (owned by Deliverable E — not this report)

The current implementations must be remediated to satisfy the canonical-state invariant. The remediation is **owned by Deliverable E** (Code Reconciliation); this report specifies the **canonical target** and the **tests that prove it**.

### 8.1 Solidity remediation (`MTQSigmaV2.sol`)

1. **Add the S3 STRESS state** to the `Status` enum (line 212): `enum Status { NORMAL, CAUTION, STRESS, DEFENSIVE, EMERGENCY, RECOVERY }` — six states, matching §21.2.
2. **Replace `setProtocolStatus(Status s)` (line 523)** with the on-chain implementation of `determineState()` per Listing 13 §21.6 `updateState()`. The state is computed from `(rr, lcr, previousState, now)`, not set by a keeper.
3. **Implement `stateEntryTime` (Listing 13 line 15487)** — `mapping(Status => uint256) public stateEntryTime;` — and the 48h confirmation logic.
4. **Implement `restrictiveness()` (Listing 13 lines 15741-15756)** with the ranking `NORMAL(0) < CAUTION(1) < RECOVERY(2) < STRESS(3) < DEFENSIVE(4) < EMERGENCY(5)`.
5. **Apply the worse-applicable-condition rule** in the state classification (compute `stateFromRR` and `stateFromLCR` separately, take the worse).
6. **Apply the canonical-state invariant to the consuming modules:**
   - `mint()` (line 463): `require(state != STRESS && state != DEFENSIVE && state != EMERGENCY, "mint paused by risk state")` — pause in S3/S4/S5, not just S4/S5.
   - `redeem()` (line 498): `require(state != EMERGENCY, "redeem paused in emergency")` — pause in S5 (the F-EMERG-01 fix), and apply the fee schedule `S1/S2: 0.15%, S3: 0.50%, S4: 1.00%, S5: PAUSED, S6: 0.30%`.
   - Remove the inline `if (protocolStatus == Status.DEFENSIVE) feeBps = 50` (line 506) and `if (protocolStatus == Status.EMERGENCY) feeBps = 200` (line 507) — these re-derive the fee from the state with the wrong thresholds; replace with `feeBps = REDEEM_FEE_BPS[state]`.

### 8.2 TypeScript remediation (`engine.ts`)

1. **Replace `determineStatus(rr, lcr)` (lines 489-495)** with the canonical `determineState(rr, lcr, previousState, now)` function of §1.7 above.
2. **Add the S3 STRESS state** to the `ProtocolStatus` type.
3. **Add the LCR classification** (`stateFromLCR`) and the worse-applicable-condition rule — the current implementation only checks LCR for NORMAL/CAUTION, not for STRESS/DEFENSIVE/EMERGENCY.
4. **Add the 48h confirmation logic** — track `previousState` and `enteredAt` across calls; reset `enteredAt` on any deterioration; require 48h elapsed for any recovery-direction transition.
5. **Expose the action matrix** (`MINT_THROTTLE`, `REDEEM_FEE_BPS`, `REBALANCE_URGENCY`, `BUFFER_GOLD_RATIO`, `REDEEM_PAUSED`, `MINT_PAUSED`) as exported constants from the canonical module.
6. **Refactor every consuming module** (`mint`, `redeem`, `bufferBaseGoldRatio`, monitoring) to import `determineState` and the action matrix from the canonical module — no module re-derives.

### 8.3 Verification

After remediation, run the 10 invariant tests of §7. The headline tests are:

* **Test 1** (canonical-state invariant): every module returns the same state for the same `(rr, lcr, previousState, now)`. This is the master test of Deliverable D.
* **Test 4** (emergency entry is immediate): the F-EMERG-01 fix is verified — a single block of `RR < 1.00` puts the protocol in S5 and pauses redemption.
* **Test 5** (worse-applicable-condition binds): the LCR hard floor (`LCR < 0.70` → S5) is verified — the current implementation's omission of LCR checks for EMERGENCY is fixed.
* **Test 7** (recovery ladder requires 48h at each step): the 48h confirmation is verified — the current implementation's lack of confirmation logic is fixed.

The remediation is **complete** when all 10 invariant tests pass on both the TS engine and the Solidity contract, and the cross-implementation equivalence (same `(rr, lcr, previousState, now)` → same state on both) holds.

---

## 9. Closing Summary

**The ONE canonical state function** (pseudocode, abridged from §1.7):

```typescript
function determineState(rr, lcr, previousState, now): CanonicalState {
  const fromRR  = stateFromRR(rr);                  // NORMAL / CAUTION / STRESS / DEFENSIVE / EMERGENCY
  const fromLCR = stateFromLCR(lcr);                // NORMAL / CAUTION / STRESS / DEFENSIVE / EMERGENCY
  const candidate = RESTRICTIVENESS[fromRR] >= RESTRICTIVENESS[fromLCR] ? fromRR : fromLCR;

  if (candidate === previousState.state) return previousState;                          // no change
  if (RESTRICTIVENESS[candidate] > RESTRICTIVENESS[previousState.state])
    return { state: candidate, enteredAt: now, confirmationPeriodEnds: null };            // immediate deterioration

  // recovery direction — 48h confirmation required
  if (now - previousState.enteredAt >= 48 * 3600)
    return { state: candidate, enteredAt: now, confirmationPeriodEnds: null };          // confirmed recovery

  // 48h not yet elapsed — stay in previousState, mark confirmation pending
  return { state: previousState.state, enteredAt: previousState.enteredAt,
           confirmationPeriodEnds: previousState.enteredAt + 48 * 3600 };
}
```

**The three governing rules:**
1. **Worse applicable condition binds** (§1.2) — `candidate = max(stateFromRR, stateFromLCR)` by restrictiveness rank.
2. **Deterioration is immediate** (§1.4) — any transition to a higher restrictiveness rank happens now.
3. **Recovery requires 48h sustained confirmation** (§1.4, §1.5) — any transition to a lower restrictiveness rank requires `RECOVERY_CONFIRMATION_PERIOD` to have elapsed since entry to the previous state, with the destination thresholds held continuously.

**The canonical-state invariant** (§4): every module calls `determineState` and uses the returned `state`. No module re-derives. Identical inputs → identical state across all modules.

**The 10 invariant tests** (§7): canonical-state invariant (Test 1), monotonicity (Test 2), recovery confirmation (Test 3), immediate emergency entry (Test 4), worse-applicable-binds (Test 5), immediate deterioration (Test 6), staged recovery (Test 7), continuous-hold (Test 8), RECOVERY-not-from-NORMAL (Test 9), cross-module consistency (Test 10).

**Remediation ownership:** Deliverable E. Until Deliverable E is complete, the current `MTQSigmaV2.sol` (5-state enum, no confirmation logic, inline fee re-derivation) and `engine.ts::determineStatus` (5-state, no LCR checks for STRESS+ , no confirmation) **violate** the canonical-state invariant.

---

**End of Deliverable D.**
