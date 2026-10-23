// ============================================================================
// MTQΣ — MANDATE-007 §3 · NON-PRODUCTION — deterministic generator for
// inputs-v1.json (the versioned input dataset of the dynamic-replacement
// prototype). ALL DATA IS SYNTHETIC — "SIMULATED — deterministic test
// fixture". NO real-world data. NO network calls. NOT ACCEPTED.
//
// Run:  bun run audit-work/task13/evidence/dynamic-replacement/make-inputs.ts
// The script builds the dataset deterministically, computes
//   datasetHash = sha256(canonicalSerialize(content with datasetHash omitted))
// (base64url-encoded — hex is avoided by design in this directory), embeds
// it, and writes inputs-v1.json. Re-running reproduces a byte-identical file.
// ============================================================================

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalSerialize, computeDatasetHash, compositeScore } from "./constituency-lifecycle";

// ---------------------------------------------------------------------------
// §1 Narrative (SIMULATED — deterministic test fixture)
// ---------------------------------------------------------------------------
// Periods are 30-day months; P0 is the base/genesis period. The narrative:
//   P0     genesis basket {USD, EUR, JPY, GBP}; CHF starts EXCLUDED (prior
//          synthetic history) and is re-nominated via T9 (fresh dossier).
//   P1-P6  CHF completes its 6-period entry window -> T2 (ELIGIBLE) at P6.
//          GBP deteriorates: below the warning threshold at P3 (-> WATCH),
//          below the exit threshold from P4; 4-period exit window completes
//          at P7. JPY dips at P5-P6 (warning band only) and recovers at P7 —
//          WATCH WITHOUT retirement.
//   P7     T5 confirm (GBP -> RETIRING) + T3 confirm (CHF -> ACTIVE, ramp
//          effective P8): the substitution. A premature T3 directive for AUD
//          is REJECTED by the engine (no T2 record) — negative control.
//   P8-P10 joint 3-period glide (linear, derived from Δ): GBP -> 0 (T6 at
//          P10, EXCLUDED at exactly 0); CHF ramps 0 -> target. CHF dips
//          below the warning threshold mid-ramp (P8) -> WATCH, ramp completes
//          (post-completion WATCH, not silent). Price relatives at P8 are ALL
//          exactly 1.0 — the mandated unchanged-price continuity probe at the
//          membership-transition boundary.
//   P10    A T5 directive for healthy USD is REJECTED (no completed exit
//          window) — anti-capture negative control.
//   P11    CHF recovers above the warning threshold -> back to ACTIVE.
//   P12-P13 EUR emergency suspension (T7, data-integrity risk, IMMEDIATE --
//          no pre-announcement by definition, NOT score-driven -- EUR's score
//          is healthy): weight frozen at the pre-trigger committed value from
//          the P12 commit onward and the EUR price leg pinned fail-closed
//          (rel = 1.0) for the suspension periods; cause resolved at P13
//          within T_rein -> T8(a) fast-track reinstatement (ACTIVE from P14,
//          where ordinary velocity/turnover-capped rebalancing resumes).
//   P13-P16 JPY deteriorates persistently below the exit threshold (4
//          consecutive periods) -> T5 confirmed at P16. NO excluded candidate
//          qualifies at that boundary (AUD below θ_in, SGD far below, XXX
//          hard-gate failures) -> retirement WITHOUT substitution; freed
//          weight redistributed pro-rata to survivors (§5.4).
//   P17-P19 3-period exit glide (N is DERIVED by the engine from the endpoint
//          moves and the velocity cap per spec §5.5 — the schedule is
//          data-determined, not asserted); JPY reaches EXACTLY 0 -> T6 at P19.
//          Final basket {USD, EUR, CHF} (3 members).
// ---------------------------------------------------------------------------

const PERIODS = 19; // P0..P19
const IDS = ["CCY-USD", "CCY-EUR", "CCY-JPY", "CCY-GBP", "CCY-CHF", "CCY-AUD", "CCY-SGD", "CCY-XXX"] as const;
type Id = (typeof IDS)[number];

// §2 normalized-input profiles (all values in [0,1]; SIMULATED). Order of the
// nine keys matches ScoreInputs: liquidity, dataQuality, convertibility,
// jurisdictionalRestrictions, currencyControl, benchmarkAvailability,
// volatility, diversification, geopoliticalExposure.
const PROFILES: Record<Id, number[]> = {
  "CCY-USD": [0.95, 0.95, 0.90, 1.0, 0.90, 0.95, 0.85, 0.55, 0.85],
  "CCY-EUR": [0.90, 0.93, 0.90, 1.0, 0.90, 0.95, 0.82, 0.60, 0.82],
  "CCY-JPY": [0.80, 0.88, 0.85, 1.0, 0.82, 0.90, 0.72, 0.68, 0.75],
  "CCY-GBP": [0.82, 0.85, 0.84, 1.0, 0.80, 0.88, 0.74, 0.66, 0.70],
  "CCY-CHF": [0.55, 0.85, 0.82, 1.0, 0.80, 0.85, 0.84, 0.45, 0.50],
  "CCY-AUD": [0.52, 0.78, 0.75, 1.0, 0.72, 0.72, 0.68, 0.45, 0.32],
  "CCY-SGD": [0.46, 0.74, 0.70, 1.0, 0.68, 0.70, 0.64, 0.38, 0.33],
  // deliberately insufficient candidate: hard-gate failures by construction
  // (JR = 0 — sanctions gate failed; QD 0.40 < 0.50; BA 0.40 < 0.60)
  "CCY-XXX": [0.45, 0.40, 0.55, 0.0, 0.50, 0.40, 0.30, 0.40, 0.20],
};

// §3 per-period deltas applied to all profile inputs EXCEPT
// jurisdictionalRestrictions (a binary min-over-gates value is never shifted —
// it stays exactly 1.0, or exactly 0.0 for CCY-XXX).
const DELTAS: Record<Id, number[]> = {
  // periods 1..19
  "CCY-USD": [0.01, 0.01, 0, 0, 0.01, 0, 0, 0.01, 0, 0, 0.01, 0, 0, 0.01, 0, 0, 0.01, 0, 0],
  "CCY-EUR": [0, 0.01, 0, 0, 0.01, 0, 0, 0.01, 0, 0, 0.01, 0, 0, 0.01, 0, 0, 0.01, 0, 0],
  "CCY-JPY": [0, 0, 0, 0, -0.15, -0.15, -0.05, 0, 0, 0, 0, 0, -0.21, -0.22, -0.23, -0.24, -0.25, -0.26, -0.27],
  "CCY-GBP": [-0.09, -0.10, -0.13, -0.19, -0.20, -0.21, -0.22, -0.23, -0.24, -0.25, -0.26, -0.27, -0.28, -0.29, -0.30, -0.31, -0.32, -0.33, -0.34],
  "CCY-CHF": [0.02, 0.04, 0.03, 0.05, 0.04, 0.06, 0.06, -0.06, -0.05, -0.05, 0.03, 0.04, 0.04, 0.05, 0.06, 0.06, 0.06, 0.07, 0.07],
  "CCY-AUD": [0.01, 0.02, 0.02, 0.03, 0.04, 0.05, 0.06, 0.06, 0.06, 0.07, 0.07, 0.07, 0.07, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08],
  "CCY-SGD": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "CCY-XXX": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};

const SCORE_KEYS = [
  "liquidity",
  "dataQuality",
  "convertibility",
  "jurisdictionalRestrictions",
  "currencyControl",
  "benchmarkAvailability",
  "volatility",
  "diversification",
  "geopoliticalExposure",
] as const;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function scoreInputsAt(id: Id, period: number): Record<string, number> {
  const profile = PROFILES[id];
  const delta = period === 0 ? 0 : DELTAS[id][period - 1];
  const out: Record<string, number> = {};
  for (let k = 0; k < SCORE_KEYS.length; k++) {
    const key = SCORE_KEYS[k];
    if (key === "jurisdictionalRestrictions") {
      out[key] = profile[k]; // binary — never shifted
    } else {
      out[key] = clamp01(profile[k] + delta);
    }
  }
  return out;
}

// §4 deterministic price relatives (per-period, vs previous period; SIMULATED
// small moves in [0.999, 1.001]; USD is the base currency, always 1.0).
// P0 anchors the base (all 1.0). P8 — the membership-transition boundary —
// has ALL relatives exactly 1.0 (the mandated unchanged-price condition for
// the composition-only continuity assertion).
function priceRelativeAt(id: Id, period: number): number {
  if (id === "CCY-USD") return 1.0;
  if (period === 0) return 1.0;
  if (period === 8) return 1.0; // unchanged-price boundary (see §1 narrative)
  const idx = IDS.indexOf(id);
  const tick = ((period * 7 + idx * 3) % 11) - 5; // −5..+5, integer, deterministic
  return 1 + 0.001 * (tick / 5);
}

// §5 governance directives (SIMULATED — deterministic test fixture; the
// engine independently ENFORCES every evidence precondition and REJECTS
// directives that lack the required rule records).
type Directive = Record<string, unknown>;
const DIRECTIVES: Directive[] = [
  { index: 1, period: 0, type: "T9-RENOMINATION", componentId: "CCY-CHF", effectivePeriod: 1, authority: "SIMULATED Economic Authority nomination + Risk Council docket (2-of-7 recorded quorum; deterministic fixture)", dossierRef: "SIM-DOSSIER-CCY-CHF-RE-NOM-2026-10 (fresh provenance dossier, SIMULATED)", note: "CHF was EXCLUDED in a prior synthetic registry epoch; T9 re-nomination opens a full fresh T1→T2→T3 cycle" },
  { index: 2, period: 7, type: "T3-CONFIRM", componentId: "CCY-CHF", effectivePeriod: 8, authority: "SIMULATED Monetary Authority proposal + constitutional ratification (fixture)" },
  { index: 3, period: 7, type: "T3-CONFIRM", componentId: "CCY-AUD", effectivePeriod: 8, authority: "SIMULATED premature admission attempt (negative control — the engine must REJECT: no T2 record, score below θ_in, entry window never opened)" },
  { index: 4, period: 7, type: "T5-CONFIRM", componentId: "CCY-GBP", effectivePeriod: 8, authority: "SIMULATED Risk Council 4-of-7 confirmation of the rule-completed retirement docket (fixture)" },
  { index: 5, period: 10, type: "T5-CONFIRM", componentId: "CCY-USD", effectivePeriod: 11, authority: "SIMULATED unsupported retirement attempt (negative control — the engine must REJECT: no exit-window docket, USD score healthy)" },
  { index: 6, period: 12, type: "T7-EMERGENCY-SUSPENSION", componentId: "CCY-EUR", effectivePeriod: 12, authority: "SIMULATED Emergency Council 2-of-3 quorum (immediate; no pre-announcement by definition)", cause: "DATA-INTEGRITY-RISK: SIMULATED oracle feed integrity failure on the EUR leg (deliverable-10 emergency class; deterministic fixture)", note: "post-hoc disclosure within 24h (recorded at period 12); IMMEDIATE per spec §3 T7 — weight frozen at the pre-trigger committed value and the EUR price leg pinned fail-closed from the period-12 commit onward" },
  { index: 7, period: 13, type: "T8-RESOLUTION", componentId: "CCY-EUR", effectivePeriod: 14, authority: "SIMULATED joint Emergency Council + Risk Council resolution (fixture)", causeResolved: true, note: "feed integrity restored; SIMULATED evidence ref INTEG-EUR-13" },
  { index: 8, period: 16, type: "T5-CONFIRM", componentId: "CCY-JPY", effectivePeriod: 17, authority: "SIMULATED Risk Council 4-of-7 confirmation of the rule-completed retirement docket (fixture)" },
];

const NARRATIVES: Record<number, string> = {
  0: "genesis/base: basket {USD,EUR,JPY,GBP}; CHF prior-EXCLUDED, T9 re-nomination",
  1: "CHF entry window 1/6; GBP deterioration begins",
  2: "CHF 2/6; GBP above warning band still",
  3: "CHF 3/6; GBP breaches warning threshold → T4 WATCH",
  4: "CHF 4/6; GBP breaches exit threshold (exit window 1/4)",
  5: "CHF 5/6; GBP 2/4; JPY temporary dip into warning band → T4 WATCH (no exit breach)",
  6: "CHF 6/6 → T2 ELIGIBLE; GBP 3/4; JPY still in warning band",
  7: "GBP exit window 4/4 → T5 confirmed (RETIRING); CHF T3 confirmed (ramp effective P8); JPY recovers → ACTIVE; AUD premature T3 REJECTED; substitution evaluated",
  8: "joint glide 1/3: GBP decaying, CHF ramping from 0; CHF mid-ramp dip below warning → T4 WATCH (ramp immutable); ALL price relatives = 1.0 (unchanged-price boundary)",
  9: "joint glide 2/3; CHF still in warning band (post-completion WATCH will persist)",
  10: "joint glide 3/3 completes: GBP EXCLUDED at exactly 0 (T6), CHF ramp completes; USD T5 attempt REJECTED (no docket)",
  11: "CHF recovers above warning → back to ACTIVE (temporary episodes do not reverse retirement — GBP stays EXCLUDED)",
  12: "EUR EMERGENCY-SUSPENDED (T7, data-integrity risk; score healthy — not score-driven); IMMEDIATE: weight frozen at the pre-trigger committed value from this commit, EUR price leg pinned fail-closed (rel = 1.0)",
  13: "EUR weight still frozen + price leg still pinned (suspension period); cause resolved at P13 → T8(a) fast-track reinstatement (duration 1 ≤ T_rein 1; ACTIVE from P14); JPY exit-window breach 1/4 → T4 WATCH",
  14: "JPY exit window 2/4; EUR resumes normal treatment",
  15: "JPY exit window 3/4",
  16: "JPY exit window 4/4 → T5 confirmed (RETIRING, glide effective P17); NO candidate qualifies → no substitution (AUD below θ_in; SGD far below; XXX hard-gate failures)",
  17: "JPY exit glide 1/3 (pro-rata §5.4 redistribution to survivors; N=3 DERIVED by the engine from the endpoint moves and Δ per §5.5)",
  18: "JPY exit glide 2/3",
  19: "JPY exit glide 3/3 completes → EXCLUDED at exactly 0 (T6); final basket {USD, EUR, CHF} (3 members)",
};

// ---------------------------------------------------------------------------
// §6 assemble the dataset
// ---------------------------------------------------------------------------

const dataset = {
  datasetId: "MTQSIGMA-DR-INPUTS-v1",
  dataClass:
    "SIMULATED — deterministic test fixture. Every field is synthetic. NO real-world data, NO live oracle input, NO network access. NON-PRODUCTION.",
  datasetHash: "", // placeholder — computed below over the content WITHOUT this field
  datasetHashNote:
    "datasetHash = sha256(canonicalSerialize(this JSON with the top-level datasetHash field omitted)), base64url-encoded. base64url (not hex) is used throughout this evidence directory by design: bare 64-hex literals are treated as credential-shaped by this repository's secret scanner, and no digest is ever emitted in hex here.",
  methodology: {
    version: "CCY-LIFECYCLE-PROTOTYPE-v0.1",
    provenance:
      "implements currency-constituency-and-weight-transition-spec.md v0.1 PROPOSED (Task 13 deliverable 4, Stage C) §2-§5 and reference-index-and-gold-methodology.md §2.2; ALL PARAMETERS UNAPPROVED DRAFT — spec §13",
    posture: "TESTNET ONLY · SHADOW MODE ENFORCED · NON-PRODUCTION PROTOTYPE · NOT ACCEPTED",
    dataLabel: "SIMULATED — deterministic test fixture (no real-world data)",
    specCitations: [
      "currency-constituency-and-weight-transition-spec.md §2 (registry model: versioned records, stable IDs, content-hash registry version)",
      "currency-constituency-and-weight-transition-spec.md §3 (lifecycle states CANDIDATE→ELIGIBLE→ACTIVE→WATCH→RETIRING→EXCLUDED + EMERGENCY-SUSPENDED overlay; T1-T9)",
      "currency-constituency-and-weight-transition-spec.md §4 (normalized [0,1] inputs; composite γ=1/9; hard gates; θ_in/θ_out/H hysteresis; §4.3 recording obligation)",
      "currency-constituency-and-weight-transition-spec.md §5 (§5.1 pipeline; §5.2 floors/caps; §5.3 bp largest-remainder rounding + 1e-9 sum tolerance; §5.4 exclusion-zero + pro-rata redistribution; §5.5 linear glides with derived N; §5.6 lifecycle semantics)",
      "reference-index-and-gold-methodology.md §2.2 (composition-change procedure: rel vs genesis fixings; B^-; B^+; D_t = B^-/B^+)",
      "currency-constituency-and-dynamic-replacement-validation.md §4 (ten mandatory behaviors) + §7 (mandated acceptance-test scenarios)",
    ],
    prototypeChoices: [
      "PROTOTYPE-CHOICE (spec leaves OPEN): RR_i merged into L_i so uniform γ=1/9 (spec §4.2 draft) sums to 1 — §4.1 lists ten rows but defines RR_i 'as L_i'",
      "PROTOTYPE-CHOICE (spec leaves OPEN): day-based windows converted to 30-day periods (T_obs_entry 180d→6, T_obs_exit 120d→4, T_watch 30d→1, T_ann 30d→1, T_rein 30d→1)",
      "PROTOTYPE-CHOICE (spec leaves OPEN): WATCH→ACTIVE recovery rule (T4R) — not T-numbered in spec §3; requires score ≥ warning threshold for 1 period; draft: WATCH is informational (spec §12)",
      "PROTOTYPE-CHOICE (spec leaves OPEN): T8(a) fast-track uses 'suspension duration ≤ T_rein' on a monthly grid (spec draft is strict < on days)",
      "PROTOTYPE-CHOICE (spec leaves OPEN): ELIGIBLE-decay rule T2-EXPIRY (exit breach for a full entry window while queued) — implemented, NOT exercised by this dataset",
      "PROTOTYPE-CHOICE (spec leaves OPEN): per-component velocity Δ = 0.10/period for ALL components — the blueprint draft velocities (0.20-0.50%/period, blueprint.ts:241-244) imply 60-140-period glides for the 23-30% moves this fixture needs, breaching the draft N∈[1,10] bound; the spec's own §5.5 worked derivation records exactly this conflict and leaves it UNRESOLVED (D-13.14)",
      "PROTOTYPE-CHOICE (spec leaves OPEN): envelope [0.10, 0.40] and single-component cap 0.40 — the blueprint 7-component envelopes (blueprint.ts:78-86: max sum 75% over 4 members) and the spec §13 w_cap 0.35 draft are INFEASIBLE for 3-4-member baskets (sum of maxima < 100%; at N=3 the minimum achievable HHI is 1/3 = 0.3333, leaving ~5% headroom over perfect equality)",
      "PROTOTYPE-CHOICE (spec leaves OPEN): HHI cap 0.40 — the spec §13 draft HHI_max 0.35 presumes N≈7; at N=3 the min-max HHI is 1/3, so 0.35 is near-infeasible (see prior row); N-dependence of HHI_max is flagged as a D-13.14 input",
      "PROTOTYPE-CHOICE (spec leaves OPEN): aggregate weight-turnover cap T_cap 0.02 (spec §13 draft) is enforced on NORMAL rebalances; SCHEDULED GLIDES ARE EXEMPT (a glide moves the retiring component by construction more than 2%/period) — the spec leaves the T_cap × glide interaction OPEN (§6, §12)",
      "PROTOTYPE-CHOICE (spec leaves OPEN): entrants inside an entry ramp are exempt from the positive floor until ramp completion (an entry ramp necessarily starts at 0, below any positive floor) — spec §5.2/§5.5 interaction left OPEN; the EXCLUSION side is NOT exempt: exclusion-zero wins over floors per §5.4",
      "PROTOTYPE-CHOICE (spec leaves OPEN): the MASE ensemble is NOT re-implemented; a deterministic score-squared target stand-in over the ACTIVE set fills the W^Target slot (spec §5.1 step 1). NO effectiveness claim is made about the stand-in — the transition machinery, not the optimizer, is the mandate's subject",
      "PROTOTYPE-CHOICE (spec leaves OPEN): emergency suspension is IMMEDIATE per spec §3 T7 (no pre-announcement by definition) — the weight freezes at the pre-trigger committed value from the directive period's commit onward and the suspended component's price relative is pinned at 1.0 for the suspension periods (fail-closed: a non-VALID leg never advances the index — reference-index-and-gold-methodology.md §8); the spec §5.6 mid-glide freeze alternative is implemented but not exercised by this dataset (disclosed in RESULTS.md)",
      "PROTOTYPE-CHOICE (spec leaves OPEN): pre-announcement quiescence — a T5-confirmed retiree is pinned at its current committed weight until its glide starts",
    ],
  },
  parameters: {
    parameterClass: "ALL PARAMETERS UNAPPROVED DRAFT — spec §13 (currency-constituency-and-weight-transition-spec.md v0.1 PROPOSED). Values marked PROTOTYPE-CHOICE deviate from (or convert) a draft and are labeled in methodology.prototypeChoices.",
    nMax: 7,
    thetaIn: 0.75,
    thetaOut: 0.65,
    hysteresisBandH: 0.1,
    warningThreshold: 0.7,
    hardGates: { liquidityMin: 0.3, dataQualityMin: 0.5, convertibilityMin: 0.5, jurisdictionalRestrictionsExact: 1.0, benchmarkAvailabilityMin: 0.6 },
    compositeWeightMode: "uniform γ = 1/9 over the nine inputs (spec §4.2 draft); RR merged into L (PROTOTYPE-CHOICE)",
    entryPersistencePeriods: 6,
    exitPersistencePeriods: 4,
    watchPersistencePeriods: 1,
    watchRecoveryPeriods: 1,
    announcementLagPeriods: 1,
    reinstatementWindowPeriods: 1,
    emergencyGlideMaxPeriods: 3,
    velocityPerPeriod: 0.1,
    glideBoundPeriods: [1, 10],
    envelopeMin: 0.1,
    envelopeMax: 0.4,
    singleComponentCap: 0.4,
    hhiCap: 0.4,
    weightTurnoverCapPerPeriod: 0.02,
    smoothingRho: 0.5,
    sumTolerance: 1e-9,
    indexEquivalenceTolerance: 1e-12,
    indexContinuityTolerance: 1e-9,
    bpQuantum: 0.0001,
    periodLengthDays: 30,
    fixedEpochIso: "2026-11-01T00:00:00.000Z",
    targetFunction: "score-squared shares over the ACTIVE+WATCH domain (deterministic MASE stand-in — PROTOTYPE-CHOICE; MASE NOT re-implemented)",
  },
  universe: [
    { registryId: 1, id: "CCY-USD", displayCode: "USD", name: "Simulated US Dollar", componentType: "FIAT", initialStatus: "ACTIVE", priorHistoryNote: "SIMULATED genesis incumbent", dossierRef: "SIM-DOSSIER-USD", envelope: { min: 0.1, max: 0.4 }, velocityPerPeriod: 0.1 },
    { registryId: 2, id: "CCY-EUR", displayCode: "EUR", name: "Simulated Euro", componentType: "FIAT", initialStatus: "ACTIVE", priorHistoryNote: "SIMULATED genesis incumbent; T7 emergency-suspension episode P12-P13 (data-integrity risk, SIMULATED cause; score healthy throughout — not score-driven) with T8(a) fast-track reinstatement within T_rein", dossierRef: "SIM-DOSSIER-EUR", envelope: { min: 0.1, max: 0.4 }, velocityPerPeriod: 0.1 },
    { registryId: 3, id: "CCY-JPY", displayCode: "JPY", name: "Simulated Japanese Yen", componentType: "FIAT", initialStatus: "ACTIVE", priorHistoryNote: "SIMULATED genesis incumbent; temporary deterioration at P5-P7 (WATCH, recovered); persistent deterioration P13-P16 (retirement without substitution)", dossierRef: "SIM-DOSSIER-JPY", envelope: { min: 0.1, max: 0.4 }, velocityPerPeriod: 0.1 },
    { registryId: 4, id: "CCY-GBP", displayCode: "GBP", name: "Simulated British Pound", componentType: "FIAT", initialStatus: "ACTIVE", priorHistoryNote: "SIMULATED genesis incumbent; deteriorates below warning (P3) then below exit threshold (P4-P7); retiring incumbent of the substitution cycle", dossierRef: "SIM-DOSSIER-GBP", envelope: { min: 0.1, max: 0.4 }, velocityPerPeriod: 0.1 },
    { registryId: 5, id: "CCY-CHF", displayCode: "CHF", name: "Simulated Swiss Franc", componentType: "FIAT", initialStatus: "EXCLUDED", priorHistoryNote: "SIMULATED backstory: ACTIVE in a prior synthetic registry epoch, EXCLUDED via T5/T6 before this dataset window; re-nominated at P0 via T9 with a fresh dossier (the 'previously excluded candidate' of the mandated narrative)", dossierRef: "SIM-DOSSIER-CCY-CHF-RE-NOM-2026-10", envelope: { min: 0.1, max: 0.4 }, velocityPerPeriod: 0.1 },
    { registryId: 6, id: "CCY-AUD", displayCode: "AUD", name: "Simulated Australian Dollar", componentType: "FIAT", initialStatus: "CANDIDATE", priorHistoryNote: "SIMULATED candidate; scores rise but never reach θ_in within the window; a premature T3 attempt at P7 is REJECTED by the engine (negative control)", dossierRef: "SIM-DOSSIER-AUD", envelope: { min: 0.1, max: 0.4 }, velocityPerPeriod: 0.1 },
    { registryId: 7, id: "CCY-SGD", displayCode: "SGD", name: "Simulated Singapore Dollar", componentType: "FIAT", initialStatus: "CANDIDATE", priorHistoryNote: "SIMULATED quiet candidate; gates pass but composite stays far below θ_in for the whole window", dossierRef: "SIM-DOSSIER-SGD", envelope: { min: 0.1, max: 0.4 }, velocityPerPeriod: 0.1 },
    { registryId: 8, id: "CCY-XXX", displayCode: "XXX", name: "Simulated Insufficient Candidate (obviously-fake identifier)", componentType: "FIAT", initialStatus: "CANDIDATE", priorHistoryNote: "SIMULATED deliberately insufficient candidate: jurisdictional-restrictions hard gate = 0.0 (sanctions gate failed), data-quality 0.40 < 0.50, benchmark-availability 0.40 < 0.60, composite far below θ_in — must be rejected at every evaluation", dossierRef: "SIM-DOSSIER-XXX-REJECTED", envelope: { min: 0.1, max: 0.4 }, velocityPerPeriod: 0.1 },
  ],
  genesis: {
    weightsBp: {
      "CCY-USD": 3000,
      "CCY-EUR": 2800,
      "CCY-JPY": 1200,
      "CCY-GBP": 3000,
      "CCY-CHF": 0,
      "CCY-AUD": 0,
      "CCY-SGD": 0,
      "CCY-XXX": 0,
    },
    note: "SIMULATED genesis vector: 4 incumbents summing to exactly 10000 bp. Registry-based membership: the basket is the set of ACTIVE registry records — no fixed-size array, no slot positions.",
  },
  periods: [] as unknown[],
};

// period rows
for (let p = 0; p <= PERIODS; p++) {
  const scores: Record<string, Record<string, number>> = {};
  const rels: Record<string, number> = {};
  for (const id of IDS) {
    scores[id] = scoreInputsAt(id, p);
    rels[id] = priceRelativeAt(id, p);
  }
  const dirs = DIRECTIVES.filter((d) => d.period === p);
  dataset.periods.push({
    period: p,
    timestampIso: new Date(Date.parse("2026-11-01T00:00:00.000Z") + p * 30 * 24 * 3600 * 1000).toISOString(),
    narrative: NARRATIVES[p] ?? "",
    scores,
    priceRelative: rels,
    integrityRiskFlags: p === 12 ? ["CCY-EUR"] : [],
    integrityRiskResolved: p === 13 ? ["CCY-EUR"] : [],
    governanceDirectives: dirs,
  });
}

// embed the datasetHash (hash-of-content-with-hash-field-omitted)
(dataset as Record<string, unknown>).datasetHash = computeDatasetHash(dataset);

const outPath = join(import.meta.dir, "inputs-v1.json");
writeFileSync(outPath, JSON.stringify(dataset, null, 2) + "\n", "utf8");

// console verification table (for the run log; not part of the dataset)
console.log(`wrote ${outPath}`);
console.log(`datasetHash (base64url of sha256): ${dataset.datasetHash as string}`);
console.log("");
console.log("composite scores by period (engine formula γ=1/9; JR exempt from deltas):");
const header = ["period", ...IDS].map((s) => String(s).replace("CCY-", "").padStart(6)).join(" | ");
console.log(header);
for (let p = 0; p <= PERIODS; p++) {
  const row = [String(p).padStart(6)];
  for (const id of IDS) {
    const s = compositeScore(scoreInputsAt(id, p) as never);
    row.push(s.toFixed(4).padStart(6));
  }
  console.log(row.join(" | "));
}
console.log("");
console.log("narrative checkpoints:");
const checks: Array<[number, Id, string]> = [
  [3, "CCY-GBP", "< warning 0.70 (T4)"],
  [4, "CCY-GBP", "< exit 0.65 (window opens)"],
  [7, "CCY-GBP", "< exit 0.65 (window 4/4 complete)"],
  [5, "CCY-JPY", "< warning 0.70 but > exit 0.65 (temporary)"],
  [7, "CCY-JPY", ">= warning 0.70 (recovery)"],
  [6, "CCY-CHF", ">= theta_in 0.75 (entry window 6/6)"],
  [8, "CCY-CHF", "< warning 0.70 mid-ramp, > exit 0.65"],
  [10, "CCY-CHF", "< warning 0.70 at completion (post-completion WATCH)"],
  [11, "CCY-CHF", ">= warning 0.70 (recovery to ACTIVE)"],
  [12, "CCY-EUR", "healthy (T7 is NOT score-driven)"],
  [13, "CCY-JPY", "< exit 0.65 (window opens)"],
  [16, "CCY-JPY", "< exit 0.65 (window 4/4)"],
  [16, "CCY-AUD", "< theta_in 0.75 (no substitution)"],
];
for (const [p, id, label] of checks) {
  const s = compositeScore(scoreInputsAt(id, p) as never);
  console.log(`  P${p} ${id}: ${s.toFixed(5)} — expected ${label}`);
}
