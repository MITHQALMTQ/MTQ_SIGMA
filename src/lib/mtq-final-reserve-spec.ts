// ============================================================================
//  MITHQAL — Final Reserve Mathematical Specification (Blueprint v25.3 §§16-46)
//  ----------------------------------------------------------------------------
//  Module ID:   v25.2-mtq-final-reserve-spec-1.0
//  Section:     §§16-46 (50 directive sections consolidated per §29)
//  Source file: `src/lib/mtq-final-reserve-spec.ts`
//
//  This module is the CANONICAL mathematical specification of MITHQAL's
//  reserve, liability, and risk framework. It implements §50 of the master
//  directive (the Final Equation System) and consolidates the equations
//  introduced across §§16-46.
//
//  Authority: These equations are the controlling specification. Where any
//  other document (slide deck, marketing copy, internal memo, prior blueprint
//  version, chat message) conflicts with an equation stated here, THIS SECTION
//  CONTROLS.
//
//  Model-validation status: `CANDIDATE_MODEL_VALIDATION_PENDING` (per §28.7).
//  The equations are internally consistent and all four §49 conflicts have
//  been reconciled. Independent model validation by an external institution
//  is required and has not yet occurred.
//
//  All 4 §49 conflicts reconciled (Conflict-1..Conflict-4):
//    1. Reserve Ratio target     : 120% (historical) → 130% (controlling)
//    2. Sleeve composition       : 15%+5%+2.5% (historical) → 80/18/2 (controlling)
//    3. Digital liquidity target : 3.5% (historical) → 2% normal (controlling)
//    4. Per-currency cap         : 60% (historical) → 20% (controlling)
// ============================================================================

export const FINAL_RESERVE_MODULE_ID = "v25.2-mtq-final-reserve-spec-1.0" as const;
export const FINAL_RESERVE_SECTION_RANGE = "§§16-46" as const;

// ----------------------------------------------------------------------------
// §29 — Reserve policy status
// ----------------------------------------------------------------------------

export type ReservePolicyStatus = "CANDIDATE_MODEL_VALIDATION_PENDING";

export const reservePolicyStatus: ReservePolicyStatus =
  "CANDIDATE_MODEL_VALIDATION_PENDING";

export interface FinalReserveHonestState {
  reserveMathSpecImplemented: true;
  reservePolicyStatus: ReservePolicyStatus;
  conflictsReconciled: 4;
  institutionalModelValidation: false;
  productionAuthorized: false;
}

export function finalReserveHonestState(): FinalReserveHonestState {
  return {
    reserveMathSpecImplemented: true,
    reservePolicyStatus,
    conflictsReconciled: 4,
    institutionalModelValidation: false,
    productionAuthorized: false,
  };
}

export const FINAL_RESERVE_HONEST_STATE = finalReserveHonestState();

// ----------------------------------------------------------------------------
// §26 — Blueprint Conflict Reconciliation (§49) — 4 conflicts, ALL IMPLEMENTED
// ----------------------------------------------------------------------------

export interface ConflictReconciliation {
  id: "Conflict-1" | "Conflict-2" | "Conflict-3" | "Conflict-4";
  conflict: string;
  olderPosition: string;
  controllingPosition: string;
  resolution: string;
  implemented: true;
}

export const CONFLICTS_RECONCILED: ReadonlyArray<ConflictReconciliation> = [
  {
    id: "Conflict-1",
    conflict: "Reserve Ratio target",
    olderPosition: "RR = 120% (1.20)",
    controllingPosition: "RR = 130% (1.30)",
    resolution:
      "Implement 130% as current strategic target. Older 120% treated as historical / non-controlling.",
    implemented: true,
  },
  {
    id: "Conflict-2",
    conflict: "Reserve sleeve composition",
    olderPosition: "15% gold + 5% tokenized gold + 2.5% digital etc. (detailed Portfolio-B table)",
    controllingPosition: "80% fiat / 18% gold / 2% digital",
    resolution:
      "Implement 80/18/2 as controlling. Do NOT implement both. Tokenized gold is conditional separate exposure, not auto-added to 18%.",
    implemented: true,
  },
  {
    id: "Conflict-3",
    conflict: "Digital liquidity target",
    olderPosition: "USDC 2% + USDP 0.5% + EURC 0.5% + BUIDL 0.5% = 3.5%",
    controllingPosition: "Digital normal = 2%",
    resolution:
      "2% is the normal center; individual asset weights are OPTIMIZER OUTPUTS, not hard-coded allocations.",
    implemented: true,
  },
  {
    id: "Conflict-4",
    conflict: "Per-currency constitutional cap",
    olderPosition: "60% cap",
    controllingPosition: "20% cap",
    resolution:
      "Implement 20% per-currency constitutional cap. Older 60% treated as historical / non-controlling.",
    implemented: true,
  },
];

// ----------------------------------------------------------------------------
// §29 — Canonical parameter set (controlling values)
// ----------------------------------------------------------------------------

export const PAR = 1.00 as const; // The unit of account — immutable (§29.2)

export const RESERVE = {
  /** Strategic RR target (Conflict-1 controlling position). */
  RR: 1.30 as const,
  /** Policy floor (stated minimum operating floor). */
  RR_POLICY_FLOOR: 1.05 as const,
  /** Solvency floor (absolute minimum). */
  RR_HARD_FLOOR: 1.00 as const,
  /** Strategic RR target band (lower / upper for tolerance). */
  RR_BAND: { lower: 1.20, upper: 1.40 },

  /** Sleeve composition (Conflict-2 controlling position: 80/18/2). */
  fiat: 0.80 as const,
  gold: 0.18 as const,
  digital: 0.02 as const,

  /** Sleeve corridors (operational flexibility). */
  corridors: {
    fiat: { lower: 0.70, upper: 0.85 },
    bullion: { lower: 0.15, upper: 0.25 },
    digital: { lower: 0.00, upper: 0.05 },
  } as const,

  /** Per-currency constitutional cap (Conflict-4 controlling position). */
  perCurrencyCap: 0.20 as const,

  /** Gold policy. */
  goldPolicy: {
    goldTarget: 0.18 as const,
    silverTarget: 0.00 as const, // conditional, currently 0%
  } as const,

  /** Digital policy (Conflict-3 controlling position). */
  digitalPolicy: {
    D_normal: 0.02 as const,
    D_operational: 0.03 as const,
    D_max: 0.05 as const,
    D_emergency: 0 as const,
  } as const,
} as const;

// ----------------------------------------------------------------------------
// §29.2 — Liability & Supply (E1: L = S × PAR)
// ----------------------------------------------------------------------------

export interface LiabilityComputation {
  S: number;          // MTQ supply (units)
  PAR: typeof PAR;    // 1.0
  L: number;          // liability = S × PAR
}

export function computeLiability(S: number): LiabilityComputation {
  if (!Number.isFinite(S) || S < 0) throw new Error("S must be ≥ 0");
  return { S, PAR, L: S * PAR };
}

// ----------------------------------------------------------------------------
// §29.3 — Reserve Valuation Triplet (E2/E3/E4)
// ----------------------------------------------------------------------------

export interface ReserveAsset {
  assetId: string;
  Q: number;       // quantity
  P: number;       // market price (USD per unit)
  H: number;       // haircut (0–1)
  C: number;       // credit / jurisdiction / operational adjustment (0–1.05)
  S_stress: number; // stress factor (0–1)
}

export interface ReserveValuationTriplet {
  R_m: number; // market reserve (E2)
  R_a: number; // adjusted reserve (E3) — operative numerator for RR
  R_l: number; // stress reserve (E4) — operative numerator for FSCR
}

export function computeReserveValuationTriplet(
  assets: ReserveAsset[],
): ReserveValuationTriplet {
  let R_m = 0;
  let R_a = 0;
  let R_l = 0;
  for (const a of assets) {
    R_m += a.Q * a.P;
    R_a += a.Q * a.P * (1 - a.H) * a.C;
    R_l += a.Q * a.P * (1 - a.H) * a.C * a.S_stress;
  }
  return { R_m, R_a, R_l };
}

export interface ReserveTripletNAV {
  NAV_m: number; // R_m / S (market NAV — typically ~1.30)
  NAV_l: number; // R_a / S (adjusted NAV — typically ~1.22)
  NAV_s: number; // R_l / S (stress NAV — typically ~1.14)
}

export function computeReserveNAV(
  triplet: ReserveValuationTriplet,
  S: number,
): ReserveTripletNAV {
  if (S <= 0) return { NAV_m: 0, NAV_l: 0, NAV_s: 0 };
  return {
    NAV_m: triplet.R_m / S,
    NAV_l: triplet.R_a / S,
    NAV_s: triplet.R_l / S,
  };
}

// ----------------------------------------------------------------------------
// §29.4 — Reserve Ratio / FSCR / LCR (E5/E6/E7)
// ----------------------------------------------------------------------------

export interface ReserveRatioComputation {
  RR: number;      // R_a / L
  FSCR: number;    // R_l / L
  LCR: number;     // HQLA / NetOutflow_30d
  status:
    | "STRATEGIC"
    | "NORMAL"
    | "DEFENSIVE"
    | "EMERGENCY";
}

export function computeReserveRatio(
  R_a: number,
  R_l: number,
  L: number,
  HQLA: number,
  netOutflow30d: number,
): ReserveRatioComputation {
  const RR = L > 0 ? R_a / L : 0;
  const FSCR = L > 0 ? R_l / L : 0;
  const LCR = netOutflow30d > 0 ? HQLA / netOutflow30d : Infinity;
  let status: ReserveRatioComputation["status"];
  if (RR < RESERVE.RR_POLICY_FLOOR) status = "EMERGENCY";
  else if (RR < 1.10) status = "DEFENSIVE";
  else if (RR < RESERVE.RR) status = "NORMAL";
  else status = "STRATEGIC";
  return { RR, FSCR, LCR, status };
}

// ----------------------------------------------------------------------------
// §29.5 — Currency structural weight, momentum, mean-reversion, EWMA (E8–E13)
// ----------------------------------------------------------------------------

export interface CurrencyInputs {
  code: string;
  COFER: number;  // IMF COFER share (0–1)
  SWIFT: number;  // SWIFT payment traffic share (0–1)
  BIS: number;    // BIS Triennial FX turnover share (0–1)
  P_now: number;  // spot price vs. USD (current)
  P_12m: number;  // spot price 12 months ago
  LTA: number;    // long-term target allocation (0–1)
  sigma: number;  // EWMA standard deviation (per E11)
  liquidityScore: number; // raw liquidity score
}

export interface CurrencyWeights {
  code: string;
  C: number;  // structural weight component (E8)
  M: number;  // momentum factor (E9), clamped [0.95, 1.05]
  R: number;  // mean-reversion factor (E10), clamped [0.98, 1.02]
  A: number;  // volatility attenuation (E12), in [0.5, 1.0]
  K: number;  // K-factor (E13)
  L: number;  // liquidity overlay (E14), clamped [0.95, 1.05]
  W_raw: number;     // raw weight (E15) = C × K × L
  W_norm: number;    // normalized weight (proportional)
  W_final: number;   // final weight (post per-currency cap, re-normalized)
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function computeCurrencyWeights(
  inputs: CurrencyInputs[],
  medianLiquidity?: number,
): CurrencyWeights[] {
  const median =
    medianLiquidity ??
    (() => {
      const sorted = [...inputs].map((i) => i.liquidityScore).sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)] ?? 0;
    })();

  const results: CurrencyWeights[] = inputs.map((i) => {
    const C = 0.50 * i.COFER + 0.40 * i.SWIFT + 0.10 * i.BIS; // E8
    const M = clamp(i.P_now / i.P_12m, 0.95, 1.05);          // E9
    const R = clamp(1 + 0.05 * (i.LTA - C), 0.98, 1.02);     // E10
    // E12 — volatility attenuation (piecewise-linear).
    const sigma = i.sigma;
    let A: number;
    if (sigma <= 0.02) A = 1.0;
    else if (sigma >= 0.05) A = 0.5;
    else A = 1 - (sigma - 0.02) / 0.03;
    const K = 1 + A * (M * R - 1);                            // E13
    const L = clamp(1 + 0.02 * (i.liquidityScore - median), 0.95, 1.05); // E14
    const W_raw = C * K * L;                                  // E15
    return { code: i.code, C, M, R, A, K, L, W_raw, W_norm: 0, W_final: 0 };
  });

  // Normalize (proportional).
  const sumRaw = results.reduce((s, r) => s + r.W_raw, 0);
  for (const r of results) r.W_norm = sumRaw > 0 ? r.W_raw / sumRaw : 0;

  // Apply per-currency cap (Conflict-4 controlling position = 20%).
  // Iterate cap-and-renormalize to converge (max 5 iterations).
  let capped = results.map((r) => ({ ...r, W_final: r.W_norm }));
  for (let iter = 0; iter < 5; iter++) {
    let over = false;
    const sumUncapped = capped
      .filter((r) => r.W_final < RESERVE.perCurrencyCap)
      .reduce((s, r) => s + r.W_final, 0);
    const totalCapped = capped
      .filter((r) => r.W_final >= RESERVE.perCurrencyCap)
      .reduce((s, r) => s + RESERVE.perCurrencyCap, 0);
    const remaining = 1 - totalCapped;
    for (const r of capped) {
      if (r.W_final >= RESERVE.perCurrencyCap) {
        if (r.W_final > RESERVE.perCurrencyCap + 1e-9) over = true;
        r.W_final = RESERVE.perCurrencyCap;
      } else if (sumUncapped > 0) {
        r.W_final = (r.W_final / sumUncapped) * remaining;
      }
    }
    if (!over) break;
  }

  return capped;
}

// ----------------------------------------------------------------------------
// §29.7 — Sleeve composition check (80/18/2 + corridors)
// ----------------------------------------------------------------------------

export interface SleeveComposition {
  fiat: number;
  gold: number;
  digital: number;
  withinCorridors: boolean;
  breaches: string[];
}

export function checkSleeveComposition(
  fiat: number,
  gold: number,
  digital: number,
): SleeveComposition {
  const breaches: string[] = [];
  const sum = fiat + gold + digital;
  if (Math.abs(sum - 1) > 1e-6) breaches.push(`sleeves sum to ${sum}, expected 1.0`);
  if (fiat < RESERVE.corridors.fiat.lower || fiat > RESERVE.corridors.fiat.upper) {
    breaches.push(`fiat ${fiat.toFixed(4)} outside corridor [${RESERVE.corridors.fiat.lower}, ${RESERVE.corridors.fiat.upper}]`);
  }
  if (gold < RESERVE.corridors.bullion.lower || gold > RESERVE.corridors.bullion.upper) {
    breaches.push(`gold ${gold.toFixed(4)} outside corridor [${RESERVE.corridors.bullion.lower}, ${RESERVE.corridors.bullion.upper}]`);
  }
  if (digital < RESERVE.corridors.digital.lower || digital > RESERVE.corridors.digital.upper) {
    breaches.push(`digital ${digital.toFixed(4)} outside corridor [${RESERVE.corridors.digital.lower}, ${RESERVE.corridors.digital.upper}]`);
  }
  return { fiat, gold, digital, withinCorridors: breaches.length === 0, breaches };
}

// ----------------------------------------------------------------------------
// §29 — Digital Reserve Quality Score (DRQS) — 7.5 core, 6 conditional
// ----------------------------------------------------------------------------

export interface DigitalUniverseEntry {
  assetId: string;
  name: string;
  issuer: string;
  DRQS: number;          // 0–10 quality score
  targetWeight: number;  // optimizer output (0 until assigned)
  conditional: boolean;  // true = conditional (DRQS ≥ 6); false = core (DRQS ≥ 7.5)
}

export const DRQS_CORE_THRESHOLD = 7.5 as const;
export const DRQS_CONDITIONAL_THRESHOLD = 6.0 as const;

export const DIGITAL_UNIVERSE: ReadonlyArray<DigitalUniverseEntry> = [
  { assetId: "USDC", name: "USD Coin", issuer: "Circle", DRQS: 8.5, targetWeight: 0, conditional: false },
  { assetId: "USDP", name: "Pax Dollar", issuer: "Paxos", DRQS: 8.2, targetWeight: 0, conditional: false },
  { assetId: "EURC", name: "Euro Coin", issuer: "Circle", DRQS: 7.8, targetWeight: 0, conditional: false },
  { assetId: "PYUSD", name: "PayPal USD", issuer: "Paxos / PayPal", DRQS: 7.6, targetWeight: 0, conditional: false },
  { assetId: "BUIDL", name: "BlackRock USD Institutional Digital Liquidity Fund", issuer: "BlackRock / Securitize", DRQS: 7.5, targetWeight: 0, conditional: false },
  { assetId: "DAI", name: "Dai", issuer: "MakerDAO", DRQS: 6.5, targetWeight: 0, conditional: true },
  { assetId: "USDT", name: "Tether", issuer: "Tether Limited", DRQS: 6.2, targetWeight: 0, conditional: true },
];

export function isDigitalEligible(entry: DigitalUniverseEntry): boolean {
  return entry.conditional
    ? entry.DRQS >= DRQS_CONDITIONAL_THRESHOLD
    : entry.DRQS >= DRQS_CORE_THRESHOLD;
}

// ----------------------------------------------------------------------------
// §29.5 — Reserve-eligible currency universe (11 currencies per §29.5)
// ----------------------------------------------------------------------------

export const RESERVE_CURRENCY_UNIVERSE: ReadonlyArray<string> = [
  "USD", "EUR", "CHF", "JPY", "GBP", "SGD", "AED", "SAR", "CNY", "CAD", "AUD",
];

// ----------------------------------------------------------------------------
// §29.11 / §29.12 / §29.13 — Auxiliary indices (TGRS / BRI / DRQS / SAE)
// ----------------------------------------------------------------------------

export interface TokenizedGoldReserveScore {
  assetId: string;
  TGRS: number; // 0–10
}

export interface BullionResilienceIndex {
  physicalGoldPct: number;
  tokenizedGoldPct: number;
  BRI: number; // 0–10 (higher = more resilient)
}

export function computeBullionResilienceIndex(
  physicalGoldPct: number,
  tokenizedGoldPct: number,
): BullionResilienceIndex {
  // BRI: weighted toward physical gold (physical is more resilient than tokenized).
  const BRI = clamp(physicalGoldPct * 10 + tokenizedGoldPct * 6, 0, 10);
  return { physicalGoldPct, tokenizedGoldPct, BRI };
}

export interface StablecoinRiskAdjustedExposure {
  grossExposure: number;
  avgDRQS: number;
  SAE: number; // risk-adjusted exposure = gross × (avgDRQS / 10)
}

export function computeStablecoinRiskAdjustedExposure(
  grossExposure: number,
  avgDRQS: number,
): StablecoinRiskAdjustedExposure {
  return {
    grossExposure,
    avgDRQS,
    SAE: grossExposure * (avgDRQS / 10),
  };
}

// ----------------------------------------------------------------------------
// §29.8 — Stress test scenarios (§45 what-if scenarios)
// ----------------------------------------------------------------------------

export interface StressScenario {
  id: string;
  name: string;
  description: string;
  rrFloorTested: number; // expected RR floor under this scenario
}

export const STRESS_SCENARIOS: ReadonlyArray<StressScenario> = [
  { id: "A", name: "USD 20% decline", description: "USD falls 20% vs. basket; tests USD-heavy reserve.", rrFloorTested: 1.05 },
  { id: "B", name: "Gold 30% fall", description: "Gold price falls 30%; tests 18% gold sleeve.", rrFloorTested: 1.05 },
  { id: "C", name: "Stablecoin de-peg", description: "A major stablecoin de-pegs by 10%; tests 2% digital sleeve.", rrFloorTested: 1.10 },
  { id: "D", name: "Combined stress", description: "USD decline + gold fall + stablecoin de-peg simultaneously.", rrFloorTested: 1.00 },
  { id: "E", name: "Redemption run", description: "25% of circulating supply redeemed in 30 days.", rrFloorTested: 1.05 },
];

// ----------------------------------------------------------------------------
// §29 — Simulator baseline (illustrative operational RR)
// ----------------------------------------------------------------------------

export const SIMULATOR_BASELINE = {
  RR: 1.2365,            // operational RR (~123.65% — below 130% strategic target)
  NAV_m: 1.30,           // max NAV (corresponds to strategic RR target)
  probRRBelow130: 0.7843, // Monte Carlo probability of RR < 130%
} as const;

// ----------------------------------------------------------------------------
// §29 — DMCE (Dynamic Monetary Control Equation) — bank issuance capacity
// ----------------------------------------------------------------------------

export interface DMCEInputs {
  verifiedBackingUsd: number;   // bank's verified Protected Backing Cell
  systemicRiskAdjustment: number; // 0–1 multiplier from §52 systemic exposure engine
  jurisdictionalAdjustment: number; // 0–1 multiplier from §49 legal framework
  policyThrottle: number;        // 0–1 multiplier from §21 risk state machine
  rrBuffer: number;              // (RR - 1.0) — buffer above solvency floor
}

export interface DMCEOutput {
  grossCapacity: number; // verifiedBackingUsd / 1.30 (130% strategic target)
  netCapacity: number;   // gross × systemic × jurisdictional × policy throttle
  components: {
    systemic: number;
    jurisdictional: number;
    policy: number;
  };
  note: string;
}

export function computeDMCE(inputs: DMCEInputs): DMCEOutput {
  const grossCapacity = inputs.verifiedBackingUsd / RESERVE.RR;
  const systemic = clamp(inputs.systemicRiskAdjustment, 0, 1);
  const jurisdictional = clamp(inputs.jurisdictionalAdjustment, 0, 1);
  const policy = clamp(inputs.policyThrottle, 0, 1);
  const netCapacity = grossCapacity * systemic * jurisdictional * policy;
  return {
    grossCapacity,
    netCapacity,
    components: { systemic, jurisdictional, policy },
    note:
      "DMCE = (verifiedBacking / 1.30) × systemic × jurisdictional × policy. " +
      "REFERENCE contract — the §52 systemic exposure engine surfaces the systemic-risk context.",
  };
}

// ----------------------------------------------------------------------------
// §29 — Final reserve report
// ----------------------------------------------------------------------------

export interface FinalReserveReport {
  moduleId: typeof FINAL_RESERVE_MODULE_ID;
  sectionRange: typeof FINAL_RESERVE_SECTION_RANGE;
  reserve: typeof RESERVE;
  conflictsReconciled: ReadonlyArray<ConflictReconciliation>;
  reserveCurrencyUniverse: ReadonlyArray<string>;
  digitalUniverse: ReadonlyArray<DigitalUniverseEntry>;
  stressScenarios: ReadonlyArray<StressScenario>;
  simulatorBaseline: typeof SIMULATOR_BASELINE;
  honestState: FinalReserveHonestState;
  finalStatus: string;
  finalStatusColor: "amber";
}

export function generateFinalReserveReport(): FinalReserveReport {
  return {
    moduleId: FINAL_RESERVE_MODULE_ID,
    sectionRange: FINAL_RESERVE_SECTION_RANGE,
    reserve: RESERVE,
    conflictsReconciled: CONFLICTS_RECONCILED,
    reserveCurrencyUniverse: RESERVE_CURRENCY_UNIVERSE,
    digitalUniverse: DIGITAL_UNIVERSE,
    stressScenarios: STRESS_SCENARIOS,
    simulatorBaseline: SIMULATOR_BASELINE,
    honestState: finalReserveHonestState(),
    finalStatus:
      "CANDIDATE_MODEL_VALIDATION_PENDING — 4/4 §49 conflicts reconciled — " +
      "130%/80-18-2/20%-cap controlling — independent model validation NOT yet performed",
    finalStatusColor: "amber",
  };
}
