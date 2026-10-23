// ============================================================================
// MTQΣ — Dynamic currency-constituency engine — §13 UNAPPROVED DRAFT
//        PARAMETERS (single provenance block)
// ============================================================================
// EVERY named constant in this file is an UNAPPROVED DRAFT parameter per
//   audit-work/task13/currency-constituency-and-weight-transition-spec.md §13
//   (v0.1 PROPOSED — Gate C; owner decisions D-13.11 / D-13.14 remain OPEN).
//   None of these values is canonical, production-approved, validated, or
//   citable as an economic parameter. The executive team (M8-3a, 2026-10-23,
//   owner-delegated) sets NAMED DEFAULTS ONLY — this module never marks an
//   economic parameter production-approved (owner-directive §3 item 4).
//
// PROTOTYPE-CHOICE labels: values marked PROTOTYPE-CHOICE deviate from (or
//   convert) a spec §13 draft because the spec itself leaves the point OPEN.
//   They were carried over from the ALREADY-VALIDATED prototype dataset
//   (audit-work/task13/evidence/dynamic-replacement/inputs-v1.json
//   methodology.prototypeChoices — 13 labeled choices) so the production
//   engine reproduces the validated 15/15 MANDATE-007 §3 demonstration
//   bit-for-bit. Every label below restates the prototype's recorded rationale.
// ============================================================================

import type { LifecycleParameters } from "./types";

// --- §13 parameter class label (verbatim from the validated dataset) --------
export const LIFECYCLE_PARAMETER_CLASS =
  "ALL PARAMETERS UNAPPROVED DRAFT — spec §13 (currency-constituency-and-weight-transition-spec.md v0.1 PROPOSED). Values marked PROTOTYPE-CHOICE deviate from (or convert) a draft and are labeled in methodology.prototypeChoices.";

// --- Basket size (spec §7 / §13 — D-13.11, OPEN) ----------------------------
/** N_max — maximum basket size. Spec §13 draft: "7–15 (initial 7)". */
export const N_MAX_DRAFT = 7;

// --- Scoring thresholds + hysteresis (spec §4.2 / §13 — D-13.11, OPEN) -----
/** θ_in — entry composite threshold (§13 draft 0.75). */
export const THETA_IN_DRAFT = 0.75;
/** θ_out — exit composite threshold (§13 draft 0.65). Strictly below θ_in. */
export const THETA_OUT_DRAFT = 0.65;
/** H — hysteresis band H = θ_in − θ_out (§13 draft 0.10; mandate: entry
 *  threshold strictly above exit). */
export const HYSTERESIS_BAND_H_DRAFT = 0.10;
/** Warning threshold θ_out + H/2 = 0.70 — the T4 warning band, strictly inside
 *  [θ_out, θ_in] (spec §3 T4 row). */
export const WARNING_THRESHOLD_DRAFT = THETA_OUT_DRAFT + HYSTERESIS_BAND_H_DRAFT / 2;

// --- Hard gates (spec §4.2 / §13 — D-13.11, OPEN) ---------------------------
/** L ≥ 0.30 — liquidity hard gate (a composite cannot rescue a failed gate). */
export const HARD_GATE_LIQUIDITY_MIN_DRAFT = 0.30;
/** QD ≥ 0.50 — data-quality hard gate. */
export const HARD_GATE_DATA_QUALITY_MIN_DRAFT = 0.50;
/** CV ≥ 0.50 — convertibility hard gate. */
export const HARD_GATE_CONVERTIBILITY_MIN_DRAFT = 0.50;
/** JR = 1.0 — every binary jurisdictional gate must pass (sanctions, clearing). */
export const HARD_GATE_JURISDICTIONAL_EXACT_DRAFT = 1.0;
/** BA ≥ 0.60 — benchmark-availability hard gate. */
export const HARD_GATE_BENCHMARK_AVAILABILITY_MIN_DRAFT = 0.60;

// --- Composite aggregation (spec §4.2 draft γ; carried PROTOTYPE-CHOICE) -----
/** Uniform γ = 1/9 over the nine inputs (spec §4.2 draft; RR merged into L so
 *  the weights sum to 1 — PROTOTYPE-CHOICE, spec §4.1 defines RR_i "as L_i"). */
export const COMPOSITE_WEIGHT_MODE_DRAFT =
  "uniform γ = 1/9 over the nine inputs (spec §4.2 draft); RR merged into L (PROTOTYPE-CHOICE)";

// --- Observation windows (spec §13 day drafts → 30-day periods) ------------
/** Scoring-cadence period length (§13: monthly — D-13.11, OPEN). */
export const PERIOD_LENGTH_DAYS_DRAFT = 30;
/** T_obs_entry = 180d (§13 draft). */
export const T_OBS_ENTRY_DAYS_DRAFT = 180;
/** T_obs_exit = 120d (§13 draft). */
export const T_OBS_EXIT_DAYS_DRAFT = 120;
/** T_watch = 30d (§13 draft). */
export const T_WATCH_DAYS_DRAFT = 30;
/** T_ann = ≥30d public pre-announcement for T3/T5 (§13 draft). */
export const T_ANN_DAYS_DRAFT = 30;
/** T_rein = 30d fast-track reinstatement window for T8(a) (§13 draft). */
export const T_REIN_DAYS_DRAFT = 30;
/** Entry persistence = 6 periods (180d ÷ 30d — PROTOTYPE-CHOICE: day-based
 *  windows converted to the 30-day period grid). */
export const ENTRY_PERSISTENCE_PERIODS_DRAFT = T_OBS_ENTRY_DAYS_DRAFT / PERIOD_LENGTH_DAYS_DRAFT; // 6
/** Exit persistence = 4 periods (120d ÷ 30d). */
export const EXIT_PERSISTENCE_PERIODS_DRAFT = T_OBS_EXIT_DAYS_DRAFT / PERIOD_LENGTH_DAYS_DRAFT; // 4
/** WATCH persistence = 1 period (30d ÷ 30d). */
export const WATCH_PERSISTENCE_PERIODS_DRAFT = T_WATCH_DAYS_DRAFT / PERIOD_LENGTH_DAYS_DRAFT; // 1
/** WATCH→ACTIVE recovery = 1 period above the warning threshold —
 *  PROTOTYPE-CHOICE: the recovery rule is not T-numbered in spec §3 (draft:
 *  WATCH is informational per spec §12). */
export const WATCH_RECOVERY_PERIODS_DRAFT = 1;
/** Pre-announcement lag = 1 period (T_ann 30d ÷ 30d). */
export const ANNOUNCEMENT_LAG_PERIODS_DRAFT = T_ANN_DAYS_DRAFT / PERIOD_LENGTH_DAYS_DRAFT; // 1
/** Reinstatement window = 1 period (T_rein 30d ÷ 30d). PROTOTYPE-CHOICE: T8(a)
 *  fast-track uses "suspension duration ≤ T_rein" on the monthly grid (the
 *  spec draft is strict < on days). */
export const REINSTATEMENT_WINDOW_PERIODS_DRAFT = T_REIN_DAYS_DRAFT / PERIOD_LENGTH_DAYS_DRAFT; // 1

// --- Emergency path (spec §3 T7/T8 / §13 — D-13.11, OPEN) ------------------
/** N_em — emergency accelerated-glide bound (§13 draft ≤ 3 periods). */
export const EMERGENCY_GLIDE_MAX_PERIODS_DRAFT = 3;

// --- Velocity / glides (spec §5.5 / §13 — D-13.14, OPEN) -------------------
/** Δ = 0.10/period for ALL components — PROTOTYPE-CHOICE carried over: the
 *  blueprint draft velocities (0.20–0.50%/period, blueprint.ts MAX_VELOCITY)
 *  imply 60–140-period glides for the 23–30% moves a real transition needs,
 *  breaching the draft N ∈ [1,10] bound; the spec's own §5.5 worked derivation
 *  records exactly this UNRESOLVED conflict (D-13.14). The engine therefore
 *  enforces this single draft Δ; per-component velocity classes are carried as
 *  REGISTRY DATA (registry.ts) and are not yet enforced per-component. */
export const VELOCITY_PER_PERIOD_DRAFT = 0.10;
/** N_ret glide bound [1, 10] periods (§13 draft — D-13.14). */
export const GLIDE_BOUND_PERIODS_DRAFT: [number, number] = [1, 10];

// --- Envelopes + aggregate caps (spec §5.2 / §13 — D-13.14, OPEN) -----------
/** Envelope floor 0.10 — PROTOTYPE-CHOICE: the blueprint 7-component envelopes
 *  (blueprint.ts ADMISSIBILITY_ENVELOPES — maxima summing to 75% over 4
 *  members) and the spec §13 w_cap 0.35 draft are INFEASIBLE for 3–4-member
 *  baskets (sum of maxima < 100%). */
export const ENVELOPE_MIN_DRAFT = 0.10;
/** Envelope ceiling 0.40 — PROTOTYPE-CHOICE (same infeasibility rationale). */
export const ENVELOPE_MAX_DRAFT = 0.40;
/** Single-component cap 0.40 — PROTOTYPE-CHOICE over the §13 w_cap 0.35 draft
 *  (infeasible at N=3 with the required floor headroom). */
export const SINGLE_COMPONENT_CAP_DRAFT = 0.40;
/** HHI cap 0.40 — PROTOTYPE-CHOICE over the §13 HHI_max 0.35 draft: 0.35
 *  presumes N≈7; at N=3 the minimum achievable HHI is 1/3 ≈ 0.3333. The
 *  N-dependence of HHI_max is flagged as a D-13.14 input. */
export const HHI_CAP_DRAFT = 0.40;
/** T_cap — aggregate weight turnover per rebalance period (§13 draft 2.0% —
 *  D-13.14). PROTOTYPE-CHOICE: enforced on NORMAL rebalances; SCHEDULED GLIDES
 *  ARE EXEMPT (a glide moves the retiring component by construction more than
 *  2%/period — the spec leaves the T_cap × glide interaction OPEN, §6/§12). */
export const WEIGHT_TURNOVER_CAP_PER_PERIOD_DRAFT = 0.02;

// --- Smoothing (carried constitutional ρ — re-ratify at Gate C) -------------
/** ρ = 0.50 normal adoption (blueprint.ts SMOOTHING_RHO_NORMAL — carried
 *  constitutional value; spec §13 requires re-ratification at Gate C). */
export const SMOOTHING_RHO_DRAFT = 0.50;

// --- Rounding + tolerances (spec §5.3 / §13 — D-13.14, OPEN) ----------------
/** Off-chain float sum tolerance (§13 D-13.14 draft; matches the existing
 *  genesis precedent genesis.ts 1e-9). */
export const SUM_TOLERANCE_DRAFT = 1e-9;
/** Zero-artificial-return identity tolerance |D_t·B^+ − B^-| (deliverable-5
 *  §2.3 draft reconciliation tolerance). */
export const INDEX_EQUIVALENCE_TOLERANCE_DRAFT = 1e-12;
/** Composition-only index-continuity tolerance (MANDATE-007 §3 ≤ 1e-9). */
export const INDEX_CONTINUITY_TOLERANCE_DRAFT = 1e-9;
/** bp quantum (spec §5.3: weights published and committed in basis points —
 *  D-13.14). */
export const BP_QUANTUM_DRAFT = 1e-4;

// --- Time base (dataset epoch — SIMULATED fixed epoch, no wall-clock) ------
/** Fixed epoch for period timestamps (the validated dataset's epoch; keeps
 *  every record wall-clock-free and byte-reproducible). */
export const FIXED_EPOCH_ISO_DRAFT = "2026-11-01T00:00:00.000Z";

// --- W^Target stand-in (carried PROTOTYPE-CHOICE) --------------------------
/** The MASE ensemble is NOT part of this module: a deterministic score-squared
 *  target stand-in fills the "W^Target over the ACTIVE set" slot (spec §5.1
 *  step 1) so the TRANSITION MACHINERY is what is exercised. NO effectiveness
 *  claim is made about the stand-in (spec §6 item 1 / RESULTS §2.3 Phase 2
 *  owns the real domain change — gated, not done here). */
export const TARGET_FUNCTION_DRAFT =
  "score-squared shares over the ACTIVE+WATCH domain (deterministic MASE stand-in — PROTOTYPE-CHOICE; MASE NOT re-implemented)";

// ---------------------------------------------------------------------------
// The assembled UNAPPROVED DRAFT parameter block (canonicalLifecycleParameters
// == the validated dataset's parameters block, asserted by the production
// runner so the demonstrated behavior exercises exactly these constants).
// ---------------------------------------------------------------------------
export function defaultLifecycleParameters(): LifecycleParameters {
  return {
    parameterClass: LIFECYCLE_PARAMETER_CLASS,
    nMax: N_MAX_DRAFT,
    thetaIn: THETA_IN_DRAFT,
    thetaOut: THETA_OUT_DRAFT,
    hysteresisBandH: HYSTERESIS_BAND_H_DRAFT,
    warningThreshold: WARNING_THRESHOLD_DRAFT,
    hardGates: {
      liquidityMin: HARD_GATE_LIQUIDITY_MIN_DRAFT,
      dataQualityMin: HARD_GATE_DATA_QUALITY_MIN_DRAFT,
      convertibilityMin: HARD_GATE_CONVERTIBILITY_MIN_DRAFT,
      jurisdictionalRestrictionsExact: HARD_GATE_JURISDICTIONAL_EXACT_DRAFT,
      benchmarkAvailabilityMin: HARD_GATE_BENCHMARK_AVAILABILITY_MIN_DRAFT,
    },
    compositeWeightMode: COMPOSITE_WEIGHT_MODE_DRAFT,
    entryPersistencePeriods: ENTRY_PERSISTENCE_PERIODS_DRAFT,
    exitPersistencePeriods: EXIT_PERSISTENCE_PERIODS_DRAFT,
    watchPersistencePeriods: WATCH_PERSISTENCE_PERIODS_DRAFT,
    watchRecoveryPeriods: WATCH_RECOVERY_PERIODS_DRAFT,
    announcementLagPeriods: ANNOUNCEMENT_LAG_PERIODS_DRAFT,
    reinstatementWindowPeriods: REINSTATEMENT_WINDOW_PERIODS_DRAFT,
    emergencyGlideMaxPeriods: EMERGENCY_GLIDE_MAX_PERIODS_DRAFT,
    velocityPerPeriod: VELOCITY_PER_PERIOD_DRAFT,
    glideBoundPeriods: [...GLIDE_BOUND_PERIODS_DRAFT] as [number, number],
    envelopeMin: ENVELOPE_MIN_DRAFT,
    envelopeMax: ENVELOPE_MAX_DRAFT,
    singleComponentCap: SINGLE_COMPONENT_CAP_DRAFT,
    hhiCap: HHI_CAP_DRAFT,
    weightTurnoverCapPerPeriod: WEIGHT_TURNOVER_CAP_PER_PERIOD_DRAFT,
    smoothingRho: SMOOTHING_RHO_DRAFT,
    sumTolerance: SUM_TOLERANCE_DRAFT,
    indexEquivalenceTolerance: INDEX_EQUIVALENCE_TOLERANCE_DRAFT,
    indexContinuityTolerance: INDEX_CONTINUITY_TOLERANCE_DRAFT,
    bpQuantum: BP_QUANTUM_DRAFT,
    periodLengthDays: PERIOD_LENGTH_DAYS_DRAFT,
    fixedEpochIso: FIXED_EPOCH_ISO_DRAFT,
    targetFunction: TARGET_FUNCTION_DRAFT,
  };
}
