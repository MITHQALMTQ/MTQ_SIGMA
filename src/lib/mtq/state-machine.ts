// MTQΣ — Canonical 6-State Risk Machine (Master Listing 13 / §21.2)
//
// ONE authoritative state function consumed by ALL modules. No module may
// independently implement its own divergent classification logic. Before
// this module existed, the engine had a 5-state `determineStatus` (missing
// S3 STRESS) and the contract had a different 5-state machine. Both were
// out of fidelity with the Master's Listing 13.
//
// The 6 states and their entry conditions (worse of RR/LCR binds):
//
//   State       RR condition              LCR condition
//   ─────────────────────────────────────────────────────────────
//   NORMAL      RR ≥ 1.10               AND  LCR ≥ 1.00
//   CAUTION     1.05 ≤ RR < 1.10        OR   LCR < 1.00       (≥ 0.90)
//   STRESS      1.02 ≤ RR < 1.05        OR   LCR < 0.90       (≥ 0.80)
//   DEFENSIVE   1.00 ≤ RR < 1.02        OR   LCR < 0.80       (≥ 0.70)
//   EMERGENCY   RR < 1.00               OR   LCR < 0.70
//   RECOVERY    entered from EMERGENCY/DEFENSIVE when RR ≥ 1.10 AND LCR ≥ 1.00
//              sustained for 48h (confirmation period per Listing 13).
//              After confirmation, transitions to NORMAL.
//
// Hysteresis rules:
//   - Entry into EMERGENCY is IMMEDIATE (no confirmation — markets don't wait).
//   - Entry into RECOVERY requires 48h confirmation (RR ≥ 1.10 AND LCR ≥ 1.00
//     must hold for the full 48h window).
//   - Exit from RECOVERY to NORMAL requires the 48h to complete.
//   - During RECOVERY, if conditions worsen back to DEFENSIVE/EMERGENCY, the
//     state exits RECOVERY IMMEDIATELY (no hysteresis on getting worse).
//   - During RECOVERY, if conditions are CAUTION/STRESS (intermediate, not
//     NORMAL but not bad), the state STAYS in RECOVERY (we're still in the
//     48h window; the timer doesn't reset).
//
// "Worse condition binds" rule: if RR says CAUTION but LCR says STRESS, the
// state is STRESS. We take the more severe of (rr-derived-state, lcr-derived-state).
//
// Recovery confirmation period (Listing 13): 48 hours.

export type RiskState = "NORMAL" | "CAUTION" | "STRESS" | "DEFENSIVE" | "EMERGENCY" | "RECOVERY";

export interface CanonicalState {
  state: RiskState;
  rr: number;
  lcr: number;
  enteredAt: number;
  confirmationPeriodEnds: number | null;  // for RECOVERY entry/exit (null otherwise)
  worseCondition: "rr" | "lcr" | "both" | "neither";  // which condition bound
}

// Severity ranking (for "worse condition binds"). RECOVERY is excluded —
// it's a transient confirmation state, not a severity level.
const SEVERITY: Record<RiskState, number> = {
  NORMAL: 0,
  CAUTION: 1,
  STRESS: 2,
  DEFENSIVE: 3,
  EMERGENCY: 4,
  RECOVERY: -1, // not a severity level
};

// Instantaneous RR-derived state (no hysteresis).
function rrInstantaneous(rr: number): RiskState {
  if (rr >= 1.10) return "NORMAL";
  if (rr >= 1.05) return "CAUTION";
  if (rr >= 1.02) return "STRESS";
  if (rr >= 1.00) return "DEFENSIVE";
  return "EMERGENCY";
}

// Instantaneous LCR-derived state (no hysteresis).
// LCR = Infinity (no circulating supply → no stress demand) maps to NORMAL.
function lcrInstantaneous(lcr: number): RiskState {
  if (!Number.isFinite(lcr)) return "NORMAL"; // genesis: no circulating supply
  if (lcr >= 1.00) return "NORMAL";
  if (lcr >= 0.90) return "CAUTION";
  if (lcr >= 0.80) return "STRESS";
  if (lcr >= 0.70) return "DEFENSIVE";
  return "EMERGENCY";
}

// The canonical state function. The worse applicable solvency/liquidity
// condition binds; hysteresis is applied for RECOVERY entry/exit.
//
// Args:
//   rr:                          current reserve ratio
//   lcr:                         current liquidity coverage ratio
//   previousState:               the state at the previous tick
//   enteredAt:                   epoch ms when the previous state was entered
//   now:                         current epoch ms
//   recoveryConfirmationPeriodMs: 48h default per Listing 13
export function determineState(
  rr: number,
  lcr: number,
  previousState: RiskState,
  enteredAt: number,
  now: number,
  recoveryConfirmationPeriodMs: number = 48 * 60 * 60 * 1000,
): CanonicalState {
  // Step 1: instantaneous target — worse of RR/LCR binds.
  const rrState = rrInstantaneous(rr);
  const lcrState = lcrInstantaneous(lcr);
  const instantaneous: RiskState =
    SEVERITY[rrState] >= SEVERITY[lcrState] ? rrState : lcrState;
  let worseCondition: "rr" | "lcr" | "both" | "neither" = "neither";
  if (instantaneous !== "NORMAL") {
    if (rrState === instantaneous && lcrState === instantaneous) worseCondition = "both";
    else if (rrState === instantaneous) worseCondition = "rr";
    else worseCondition = "lcr";
  }

  // Step 2: apply hysteresis for RECOVERY entry/exit.
  const inRecovery = previousState === "RECOVERY";
  const recoveryWindowEnd = inRecovery ? enteredAt + recoveryConfirmationPeriodMs : null;
  let finalState: RiskState = instantaneous;
  let confirmationPeriodEnds: number | null = null;
  let newEnteredAt = enteredAt;

  if (instantaneous === "NORMAL") {
    // Healthy conditions. Check if we need to go through RECOVERY first.
    if (previousState === "EMERGENCY" || previousState === "DEFENSIVE") {
      // Enter RECOVERY (start the 48h confirmation clock).
      finalState = "RECOVERY";
      newEnteredAt = now;
      confirmationPeriodEnds = now + recoveryConfirmationPeriodMs;
    } else if (inRecovery) {
      // Already in RECOVERY — check if 48h have passed.
      if (recoveryWindowEnd !== null && now >= recoveryWindowEnd) {
        // Confirmation complete → transition to NORMAL.
        finalState = "NORMAL";
        newEnteredAt = now;
        confirmationPeriodEnds = null;
      } else {
        // Still in the 48h window — stay in RECOVERY.
        finalState = "RECOVERY";
        confirmationPeriodEnds = recoveryWindowEnd;
      }
    } else {
      // Already NORMAL, stay NORMAL (no transition).
      finalState = "NORMAL";
      if (previousState !== "NORMAL") newEnteredAt = now;
    }
  } else if (instantaneous === "CAUTION" || instantaneous === "STRESS") {
    // Intermediate conditions.
    if (inRecovery) {
      // Stay in RECOVERY during the confirmation window even if conditions
      // dip slightly. We don't reset the timer (only worse-than-RECOVERY
      // conditions reset it; see the DEFENSIVE/EMERGENCY branch below).
      finalState = "RECOVERY";
      confirmationPeriodEnds = recoveryWindowEnd;
    } else {
      // Transition to the intermediate state.
      finalState = instantaneous;
      if (previousState !== instantaneous) newEnteredAt = now;
    }
  } else {
    // instantaneous is DEFENSIVE or EMERGENCY — worse state.
    // Transition immediately (no hysteresis on getting worse).
    finalState = instantaneous;
    if (previousState !== instantaneous) newEnteredAt = now;
  }

  return {
    state: finalState,
    rr,
    lcr,
    enteredAt: newEnteredAt,
    confirmationPeriodEnds,
    worseCondition,
  };
}

// State-dependent mint throttle (fraction of normal capacity, 0 = paused).
// Per Listing 13 / §21.3:
//   NORMAL 1.0, CAUTION 0.5, STRESS 0 (paused), DEFENSIVE 0 (paused),
//   EMERGENCY 0 (paused), RECOVERY 0.25
export function mintThrottle(state: RiskState): number {
  switch (state) {
    case "NORMAL": return 1.0;
    case "CAUTION": return 0.5;
    case "STRESS": return 0;        // paused
    case "DEFENSIVE": return 0;     // paused
    case "EMERGENCY": return 0;     // paused
    case "RECOVERY": return 0.25;
  }
}

// State-dependent redeem fee (fraction, e.g. 0.0015 = 0.15%).
// Per Listing 13 / §19.2:
//   NORMAL/CAUTION 0.0015, STRESS 0.005, DEFENSIVE 0.01, EMERGENCY 0.02,
//   RECOVERY 0.005
export function redeemFee(state: RiskState): number {
  switch (state) {
    case "NORMAL": return 0.0015;
    case "CAUTION": return 0.0015;
    case "STRESS": return 0.005;
    case "DEFENSIVE": return 0.01;
    case "EMERGENCY": return 0.02;
    case "RECOVERY": return 0.005;
  }
}

// State-dependent rebalance urgency (0-1). Per §10 + Listing 13:
//   NORMAL 0.3, CAUTION 0.5, STRESS 0.8, DEFENSIVE 1.0, EMERGENCY 1.0, RECOVERY 0.6
export function rebalanceUrgency(state: RiskState): number {
  switch (state) {
    case "NORMAL": return 0.3;
    case "CAUTION": return 0.5;
    case "STRESS": return 0.8;
    case "DEFENSIVE": return 1.0;
    case "EMERGENCY": return 1.0;
    case "RECOVERY": return 0.6;
  }
}

// Is minting allowed? Per Listing 13 / §21.3, minting is paused in
// STRESS, DEFENSIVE, and EMERGENCY.
export function mintingAllowed(state: RiskState): boolean {
  return state !== "STRESS" && state !== "DEFENSIVE" && state !== "EMERGENCY";
}

// Is redemption allowed? Per §21.4, redemption is paused in EMERGENCY.
// (The reconciliation resolves the §16.2 vs §21.4 contradiction in favour of
// §21.4: pause redemption in EMERGENCY.)
export function redemptionAllowed(state: RiskState): boolean {
  return state !== "EMERGENCY";
}

// Map RiskState to a 0-4 stress-level integer (used by mase.ts's
// velocity + stress-adaptive smoothing). RECOVERY counts as CAUTION
// (we're recovering — move with caution speed).
export function stressLevel(state: RiskState): number {
  switch (state) {
    case "NORMAL": return 0;
    case "CAUTION": return 1;
    case "STRESS": return 2;
    case "DEFENSIVE": return 3;
    case "EMERGENCY": return 4;
    case "RECOVERY": return 1; // similar to CAUTION
  }
}

// === Inline self-test (runnable) =============================================
// To run: `bun -e 'import("./src/lib/mtq/state-machine").then(m => m.runSelfTest())'`
export function runSelfTest(): { pass: boolean; reason: string } {
  // Case 1: NORMAL at genesis (RR=1.10, LCR=∞ → NORMAL).
  let s = determineState(1.10, Infinity, "NORMAL", 0, 0);
  if (s.state !== "NORMAL") return { pass: false, reason: `1: expected NORMAL, got ${s.state}` };
  // Case 2: RR=1.07 → CAUTION (RR-only binds).
  s = determineState(1.07, 1.5, "NORMAL", 0, 0);
  if (s.state !== "CAUTION") return { pass: false, reason: `2: expected CAUTION, got ${s.state}` };
  // Case 3: RR=1.04, LCR=1.5 → STRESS (RR-only binds).
  s = determineState(1.04, 1.5, "NORMAL", 0, 0);
  if (s.state !== "STRESS") return { pass: false, reason: `3: expected STRESS, got ${s.state}` };
  // Case 4: RR=1.01, LCR=1.5 → DEFENSIVE.
  s = determineState(1.01, 1.5, "NORMAL", 0, 0);
  if (s.state !== "DEFENSIVE") return { pass: false, reason: `4: expected DEFENSIVE, got ${s.state}` };
  // Case 5: RR=0.99, LCR=1.5 → EMERGENCY (immediate).
  s = determineState(0.99, 1.5, "NORMAL", 0, 0);
  if (s.state !== "EMERGENCY") return { pass: false, reason: `5: expected EMERGENCY, got ${s.state}` };
  // Case 6: LCR=0.85, RR=1.20 → STRESS (LCR binds; RR is NORMAL).
  s = determineState(1.20, 0.85, "NORMAL", 0, 0);
  if (s.state !== "STRESS") return { pass: false, reason: `6: expected STRESS (LCR binds), got ${s.state}` };
  // Case 7: RR=1.10, LCR=1.10 from EMERGENCY → enter RECOVERY.
  s = determineState(1.10, 1.10, "EMERGENCY", 0, 1000);
  if (s.state !== "RECOVERY") return { pass: false, reason: `7: expected RECOVERY, got ${s.state}` };
  if (s.confirmationPeriodEnds !== 1000 + 48 * 60 * 60 * 1000) {
    return { pass: false, reason: `7: confirmationPeriodEnds wrong: ${s.confirmationPeriodEnds}` };
  }
  // Case 8: After 47h in RECOVERY, RR/LCR still NORMAL → stay RECOVERY.
  s = determineState(1.10, 1.10, "RECOVERY", 0, 47 * 60 * 60 * 1000);
  if (s.state !== "RECOVERY") return { pass: false, reason: `8: expected RECOVERY (still in 48h), got ${s.state}` };
  // Case 9: After 49h in RECOVERY, RR/LCR still NORMAL → NORMAL.
  s = determineState(1.10, 1.10, "RECOVERY", 0, 49 * 60 * 60 * 1000);
  if (s.state !== "NORMAL") return { pass: false, reason: `9: expected NORMAL after 48h, got ${s.state}` };
  // Case 10: In RECOVERY, conditions worsen to EMERGENCY → exit immediately.
  s = determineState(0.99, 1.10, "RECOVERY", 0, 1000);
  if (s.state !== "EMERGENCY") return { pass: false, reason: `10: expected EMERGENCY (exit RECOVERY), got ${s.state}` };
  // Case 11: mintingAllowed / redemptionAllowed / mintThrottle / redeemFee
  if (!mintingAllowed("NORMAL")) return { pass: false, reason: "11a: mintingAllowed(NORMAL) should be true" };
  if (mintingAllowed("STRESS")) return { pass: false, reason: "11b: mintingAllowed(STRESS) should be false" };
  if (!redemptionAllowed("NORMAL")) return { pass: false, reason: "11c: redemptionAllowed(NORMAL) should be true" };
  if (redemptionAllowed("EMERGENCY")) return { pass: false, reason: "11d: redemptionAllowed(EMERGENCY) should be false" };
  if (mintThrottle("CAUTION") !== 0.5) return { pass: false, reason: `11e: mintThrottle(CAUTION)=${mintThrottle("CAUTION")} expected 0.5` };
  if (redeemFee("EMERGENCY") !== 0.02) return { pass: false, reason: `11f: redeemFee(EMERGENCY)=${redeemFee("EMERGENCY")} expected 0.02` };
  if (redeemFee("STRESS") !== 0.005) return { pass: false, reason: `11g: redeemFee(STRESS)=${redeemFee("STRESS")} expected 0.005` };
  return { pass: true, reason: "state-machine self-test PASS: 11 cases verified" };
}

try {
  const r = runSelfTest();
  if (!r.pass && typeof console !== "undefined") {
    console.error(`[state-machine] SELF-TEST FAIL: ${r.reason}`);
  }
} catch (e) {
  if (typeof console !== "undefined") console.error("[state-machine] self-test error:", e);
}
