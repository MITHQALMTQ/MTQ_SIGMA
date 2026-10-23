// MTQΣ — Canonical 6-State Risk Machine (Master Blueprint v1.0 §21.2–§21.4)
//
// ONE authoritative state function consumed by ALL modules. No module may
// independently implement its own divergent classification logic.
//
// §21.2 The Six Risk States — classification is a pure function of (RR_t, LCR_t):
//
//   State          RR Range          LCR Range       Entry
//   ─────────────────────────────────────────────────────────────────
//   S1 NORMAL      RR ≥ 1.10         LCR ≥ 1.00      both targets hold
//   S2 CAUTION     1.05 ≤ RR < 1.10  LCR ≥ 0.90      RR < 1.10 or LCR < 1.00
//   S3 STRESS      1.02 ≤ RR < 1.05  LCR ≥ 0.80      RR < 1.05 or LCR < 0.90
//   S4 DEFENSIVE   1.00 ≤ RR < 1.02  LCR ≥ 0.70      RR < 1.02 or LCR < 0.80
//   S5 EMERGENCY   RR < 1.00         Any             hard-floor breach ONLY (I2)
//   S6 RECOVERY    RR ≥ 1.05 (rising) LCR ≥ 0.90     from a more restrictive
//                                                   state, after 48h sustained
//                                                   confirmation; ALSO the
//                                                   residual posture when the
//                                                   ratios fail the DEFENSIVE
//                                                   liquidity test while
//                                                   solvency holds (e.g.
//                                                   RR ≥ 1.05 with LCR < 0.70)
//
// "Worse condition binds": if RR says CAUTION but LCR says STRESS, the state
// is STRESS. EMERGENCY (S5) is entered ONLY on the RR hard-floor breach —
// an LCR collapse with solvency intact lands in RECOVERY (the residual
// posture per §21.2's S6 description) or DEFENSIVE, never EMERGENCY.
//
// §21.3 State Transition Logic — one asymmetric rule:
//   Downgrades (more restrictive): IMMEDIATE on breach.
//   Upgrades (less restrictive): ONE step at a time, each requiring the
//   destination state's thresholds to hold continuously for 48h
//   (RECOVERY_CONFIRMATION_PERIOD). The clock resets the moment the
//   destination thresholds fail (a dip back re-arms the full 48h).
//   Ladder: EMERGENCY → DEFENSIVE → STRESS → RECOVERY → CAUTION → NORMAL
//   (RECOVERY ranks between CAUTION and STRESS per §21.2's closing note —
//   its action profile sits there too: 25% mint throttle, 0.30% redeem fee,
//   urgency 2).
//
// Hysteresis implementation notes:
//   - `enteredAt` doubles as the destination-confirmation clock: it resets
//     whenever the state changes OR the destination thresholds fail while
//     waiting (the "sustained, no breach" rule of §21.3).
//   - LCR = Infinity (no circulating supply → no stress demand) maps to NORMAL.
//   - updateState() runs after every mint, redeem, rebalance and price update.

export type RiskState = "NORMAL" | "CAUTION" | "STRESS" | "DEFENSIVE" | "EMERGENCY" | "RECOVERY";

export interface CanonicalState {
  state: RiskState;
  rr: number;
  lcr: number;
  enteredAt: number;
  confirmationPeriodEnds: number | null;  // 48h confirmation window (upgrade path)
  worseCondition: "rr" | "lcr" | "both" | "neither";  // which condition bound
}

// §21.2 severity ranking. RECOVERY sits between CAUTION and STRESS (§21.2).
const SEVERITY: Record<RiskState, number> = {
  NORMAL: 0,
  CAUTION: 1,
  RECOVERY: 2,
  STRESS: 3,
  DEFENSIVE: 4,
  EMERGENCY: 5,
};

// Instantaneous RR-derived state (no hysteresis) — §21.2 RR bands.
function rrInstantaneous(rr: number): RiskState {
  if (rr >= 1.10) return "NORMAL";
  if (rr >= 1.05) return "CAUTION";
  if (rr >= 1.02) return "STRESS";
  if (rr >= 1.00) return "DEFENSIVE";
  return "EMERGENCY";
}

// LCR-derived severity. LCR < 0.70 is NOT EMERGENCY — §21.2's S5 entry is the
// RR hard-floor breach only; an LCR collapse with solvency (RR ≥ 1.05) is the
// RECOVERY residual posture; below that it binds DEFENSIVE.
function lcrDerived(lcr: number): RiskState {
  if (!Number.isFinite(lcr)) return "NORMAL"; // genesis: no circulating supply
  if (lcr >= 1.00) return "NORMAL";
  if (lcr >= 0.90) return "CAUTION";
  if (lcr >= 0.80) return "STRESS";
  if (lcr >= 0.70) return "DEFENSIVE";
  return "DEFENSIVE"; // below the DEFENSIVE liquidity test — handled by residual logic
}

// Instantaneous raw classification (worse condition binds; EMERGENCY only
// from RR < 1.00; residual RECOVERY when LCR fails the DEFENSIVE test while
// solvency holds).
function instantaneous(rr: number, lcr: number): RiskState {
  if (rr < 1.00) return "EMERGENCY"; // S5 entry: hard-floor breach ONLY (I2)
  const rrState = rrInstantaneous(rr); // ∈ {NORMAL, CAUTION, STRESS, DEFENSIVE}
  const lcrState = lcrDerived(lcr);
  if (!Number.isFinite(lcr) || lcr >= 0.70) {
    // worse of RR/LCR binds
    return SEVERITY[rrState] >= SEVERITY[lcrState] ? rrState : lcrState;
  }
  // LCR < 0.70: fails the DEFENSIVE liquidity test while solvency holds.
  // Residual posture (§21.2 S6): RECOVERY if RR ≥ 1.05, else DEFENSIVE.
  if (rr >= 1.05) return "RECOVERY";
  return "DEFENSIVE";
}

// One step up the ladder (less restrictive) from a state; null at NORMAL.
function stepUp(state: RiskState): RiskState | null {
  switch (state) {
    case "EMERGENCY": return "DEFENSIVE";
    case "DEFENSIVE": return "STRESS";
    case "STRESS": return "RECOVERY";
    case "RECOVERY": return "CAUTION";
    case "CAUTION": return "NORMAL";
    case "NORMAL": return null;
  }
}

// §21.3 destination thresholds — "remain above the destination state's
// threshold continuously for 48 consecutive hours":
//   48h at RR ≥ 1.00 to leave EMERGENCY, RR ≥ 1.02 to leave DEFENSIVE,
//   RR ≥ 1.05 (with LCR ≥ 0.90) to leave STRESS into RECOVERY, and
//   RR ≥ 1.10 (with LCR ≥ 1.00) to leave CAUTION into NORMAL.
function destinationHolds(dest: RiskState, rr: number, lcr: number): boolean {
  switch (dest) {
    case "DEFENSIVE": return rr >= 1.00;
    case "STRESS": return rr >= 1.02;
    case "RECOVERY": return rr >= 1.05 && (lcr >= 0.90 || !Number.isFinite(lcr));
    case "CAUTION": return rr >= 1.05 && (lcr >= 0.90 || !Number.isFinite(lcr));
    case "NORMAL": return rr >= 1.10 && (lcr >= 1.00 || !Number.isFinite(lcr));
    case "EMERGENCY": return false;
  }
}

// The canonical state function (§21.2 classification + §21.3 hysteresis).
//
// Args:
//   rr:                          current reserve ratio
//   lcr:                         current liquidity coverage ratio
//   previousState:               the state at the previous tick
//   enteredAt:                   epoch ms when the current state was entered
//                                (also serves as the destination-confirmation clock)
//   now:                         current epoch ms
//   recoveryConfirmationPeriodMs: 48h default (§2.9 / §21.3)
export function determineState(
  rr: number,
  lcr: number,
  previousState: RiskState,
  enteredAt: number,
  now: number,
  recoveryConfirmationPeriodMs: number = 48 * 60 * 60 * 1000,
): CanonicalState {
  const raw = instantaneous(rr, lcr);

  // Which condition bound (diagnostic only).
  let worseCondition: "rr" | "lcr" | "both" | "neither" = "neither";
  if (raw !== "NORMAL") {
    const rrState = rr < 1.00 ? "EMERGENCY" : rrInstantaneous(rr);
    const lcrState = lcrDerived(lcr);
    if (rrState === raw && lcrState === raw) worseCondition = "both";
    else if (rrState === raw) worseCondition = "rr";
    else if (lcrState === raw) worseCondition = "lcr";
    else worseCondition = "lcr"; // residual-RECOVERY / LCR-collapse paths
  }

  // Step 1: degradation (or same-level dip) is IMMEDIATE and resets the clock.
  //   - raw more severe than previous → take raw now.
  //   - raw equally severe (a dip back while waiting to climb) → stay, but the
  //     destination thresholds failed → reset the confirmation clock.
  if (SEVERITY[raw] >= SEVERITY[previousState]) {
    const state = SEVERITY[raw] > SEVERITY[previousState] ? raw : previousState;
    return {
      state,
      rr,
      lcr,
      enteredAt: now,
      confirmationPeriodEnds: state === "RECOVERY" ? null : null,
      worseCondition,
    };
  }

  // Step 2: upgrade path — one step at a time, 48h sustained at the
  // destination's thresholds (§21.3). The clock (enteredAt) resets whenever
  // the destination thresholds fail.
  const dest = stepUp(previousState);
  if (dest !== null && destinationHolds(dest, rr, lcr)) {
    const elapsed = now - enteredAt;
    if (elapsed >= recoveryConfirmationPeriodMs) {
      return {
        state: dest,
        rr,
        lcr,
        enteredAt: now,
        confirmationPeriodEnds: null,
        worseCondition,
      };
    }
    // Holding the destination thresholds but not yet 48h — keep the clock.
    return {
      state: previousState,
      rr,
      lcr,
      enteredAt,
      confirmationPeriodEnds: enteredAt + recoveryConfirmationPeriodMs,
      worseCondition,
    };
  }
  // Destination thresholds not currently held — stay and reset the clock.
  return {
    state: previousState,
    rr,
    lcr,
    enteredAt: now,
    confirmationPeriodEnds: now + recoveryConfirmationPeriodMs,
    worseCondition,
  };
}

// State-dependent mint throttle (fraction of normal capacity, 0 = paused).
// §21.4 action matrix: S1 1.0 · S2 0.5 · S3 0 · S4 0 · S5 0 · S6 0.25.
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
// §21.4 redemption row: S1/S2 0.15% · S3 0.50% · S4 1.00% · S6 0.30%.
// S5 EMERGENCY: redemption is PAUSED — the fee is unreachable (the legacy
// Listing-13 2.00% value is retained in blueprint.ts REDEEM_FEE_EMERGENCY
// only as a documented, unused constant).
export function redeemFee(state: RiskState): number {
  switch (state) {
    case "NORMAL": return 0.0015;
    case "CAUTION": return 0.0015;
    case "STRESS": return 0.005;
    case "DEFENSIVE": return 0.01;
    case "EMERGENCY": return 0.02; // unreachable — redemption paused (§21.4)
    case "RECOVERY": return 0.003; // 0.30% per §21.4 S6
  }
}

// State-dependent rebalance urgency (0–1, mapped from §21.4's 1–4 ladder).
//   S1 urgency 1 (0.25) · S2 urgency 2 (0.5) · S3 urgency 3 (0.75) ·
//   S4 urgency 4 (1.0) · S5 PAUSED (0 — only council-directed forceRebalance,
//   §10.3 Level 5) · S6 urgency 2 (0.5).
export function rebalanceUrgency(state: RiskState): number {
  switch (state) {
    case "NORMAL": return 0.25;
    case "CAUTION": return 0.5;
    case "STRESS": return 0.75;
    case "DEFENSIVE": return 1.0;
    case "EMERGENCY": return 0; // routine rebalancing paused (§21.4)
    case "RECOVERY": return 0.5;
  }
}

// Is minting allowed? §21.4: paused in STRESS, DEFENSIVE and EMERGENCY.
export function mintingAllowed(state: RiskState): boolean {
  return state !== "STRESS" && state !== "DEFENSIVE" && state !== "EMERGENCY";
}

// Is redemption allowed? §21.4: paused in EMERGENCY (exit stays open in
// every other state — the exit-first principle).
export function redemptionAllowed(state: RiskState): boolean {
  return state !== "EMERGENCY";
}

// Map RiskState to a 0–4 stress-level integer (used by mase.ts's
// stress-adaptive smoothing ρ selection). RECOVERY counts as CAUTION.
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
  const H48 = 48 * 60 * 60 * 1000;
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
  // Case 5: RR=0.99, LCR=1.5 → EMERGENCY (immediate — hard-floor breach only).
  s = determineState(0.99, 1.5, "NORMAL", 0, 0);
  if (s.state !== "EMERGENCY") return { pass: false, reason: `5: expected EMERGENCY, got ${s.state}` };
  // Case 6: LCR=0.85, RR=1.20 → STRESS (LCR binds; RR is NORMAL).
  s = determineState(1.20, 0.85, "NORMAL", 0, 0);
  if (s.state !== "STRESS") return { pass: false, reason: `6: expected STRESS (LCR binds), got ${s.state}` };
  // Case 6b: §21.2 residual — RR=1.06, LCR=0.65 → RECOVERY (solvency holds,
  // liquidity fails the DEFENSIVE test) — NOT EMERGENCY.
  s = determineState(1.06, 0.65, "NORMAL", 0, 0);
  if (s.state !== "RECOVERY") return { pass: false, reason: `6b: expected RECOVERY (residual), got ${s.state}` };
  // Case 6c: LCR collapse with RR=0.99 → still EMERGENCY (RR hard floor rules).
  s = determineState(0.99, 0.60, "NORMAL", 0, 0);
  if (s.state !== "EMERGENCY") return { pass: false, reason: `6c: expected EMERGENCY, got ${s.state}` };
  // Case 7: EMERGENCY with metrics recovered to RECOVERY band (RR 1.06,
  // LCR 0.95): stepwise ladder — after 48h at RR ≥ 1.00 → DEFENSIVE (one step).
  s = determineState(1.06, 0.95, "EMERGENCY", 0, H48 + 1000);
  if (s.state !== "DEFENSIVE") return { pass: false, reason: `7: expected DEFENSIVE (one step up after 48h), got ${s.state}` };
  // Case 7b: same but only 47h elapsed → stay EMERGENCY.
  s = determineState(1.06, 0.95, "EMERGENCY", 0, H48 - 3600_000);
  if (s.state !== "EMERGENCY") return { pass: false, reason: `7b: expected EMERGENCY (47h < 48h), got ${s.state}` };
  // Case 8: DEFENSIVE with RR ≥ 1.02 held 48h → STRESS.
  s = determineState(1.03, 1.2, "DEFENSIVE", 0, H48 + 1000);
  if (s.state !== "STRESS") return { pass: false, reason: `8: expected STRESS (one step up), got ${s.state}` };
  // Case 9: STRESS with RR ≥ 1.05 + LCR ≥ 0.90 held 48h → RECOVERY.
  s = determineState(1.06, 0.95, "STRESS", 0, H48 + 1000);
  if (s.state !== "RECOVERY") return { pass: false, reason: `9: expected RECOVERY (one step up), got ${s.state}` };
  // Case 10: RECOVERY held 48h at CAUTION thresholds → CAUTION.
  s = determineState(1.06, 0.95, "RECOVERY", 0, H48 + 1000);
  if (s.state !== "CAUTION") return { pass: false, reason: `10: expected CAUTION (one step up), got ${s.state}` };
  // Case 10b: CAUTION held 48h at RR ≥ 1.10 + LCR ≥ 1.00 → NORMAL.
  s = determineState(1.11, 1.05, "CAUTION", 0, H48 + 1000);
  if (s.state !== "NORMAL") return { pass: false, reason: `10b: expected NORMAL (one step up), got ${s.state}` };
  // Case 11: while waiting in CAUTION, a dip resets the clock (enteredAt → now).
  s = determineState(1.06, 1.05, "CAUTION", 0, H48 - 1000);
  if (s.state !== "CAUTION") return { pass: false, reason: `11: expected CAUTION (dip), got ${s.state}` };
  if (s.enteredAt !== H48 - 1000) return { pass: false, reason: `11: expected clock reset (enteredAt=now), got ${s.enteredAt}` };
  // Case 12: mintingAllowed / redemptionAllowed / mintThrottle / redeemFee.
  if (!mintingAllowed("NORMAL")) return { pass: false, reason: "12a: mintingAllowed(NORMAL) should be true" };
  if (mintingAllowed("STRESS")) return { pass: false, reason: "12b: mintingAllowed(STRESS) should be false" };
  if (!redemptionAllowed("NORMAL")) return { pass: false, reason: "12c: redemptionAllowed(NORMAL) should be true" };
  if (redemptionAllowed("EMERGENCY")) return { pass: false, reason: "12d: redemptionAllowed(EMERGENCY) should be false" };
  if (mintThrottle("CAUTION") !== 0.5) return { pass: false, reason: `12e: mintThrottle(CAUTION)=${mintThrottle("CAUTION")} expected 0.5` };
  if (redeemFee("STRESS") !== 0.005) return { pass: false, reason: `12f: redeemFee(STRESS)=${redeemFee("STRESS")} expected 0.005` };
  if (redeemFee("RECOVERY") !== 0.003) return { pass: false, reason: `12g: redeemFee(RECOVERY)=${redeemFee("RECOVERY")} expected 0.003 (§21.4 S6 0.30%)` };
  if (rebalanceUrgency("EMERGENCY") !== 0) return { pass: false, reason: `12h: rebalanceUrgency(EMERGENCY)=${rebalanceUrgency("EMERGENCY")} expected 0 (paused §21.4)` };
  return { pass: true, reason: "state-machine self-test PASS: 17 cases verified" };
}

try {
  const r = runSelfTest();
  if (!r.pass && typeof console !== "undefined") {
    console.error(`[state-machine] SELF-TEST FAIL: ${r.reason}`);
  }
} catch (e) {
  if (typeof console !== "undefined") console.error("[state-machine] self-test error:", e);
}
