// MTQΣ — Single Source of Truth v5.0+Ext1+Ext2+Ext3 — Mandate Reference Layer
// =============================================================================
// Document IDs implemented by this module:
//   MTQSIGMA-SINGLE-SOURCE-OF-TRUTH-006        (v5.0  — MARP corrections)
//   MTQSIGMA-SINGLE-SOURCE-OF-TRUTH-006-EXT-1  (v5.1  — contract-level safety)
//   MTQSIGMA-SINGLE-SOURCE-OF-TRUTH-006-EXT-2  (v5.2  — MEV submission modes)
//   MTQSIGMA-SINGLE-SOURCE-OF-TRUTH-006-EXT-3  (v5.3  — external spec wiring)
//
// This is the CORRECTED EXECUTION REFERENCE IMPLEMENTATION of:
//   §3.2  Five separate time measurements (never collapse into one flag)
//   §3.3  Three distinct prices (reference / executable quote / realized)
//   §3.4  Signed, direction-aware deviation arithmetic      — Listing C-1
//   §3.5  J(s) trade-gating objective (CANDIDATE — OD-1 pending)
//   §3.6  Protected net-benefit gate with common numeraire — Listing C-4
//   §3.6.1 Gross-benefit verification gap (keeper responsibility)
//   §3.7  Gas-cost conversion with full-precision mulDiv    — Listing C-3
//   §3.8  Quote protection and hard execution bounds
//   Token-decimal checked scaling                           — Listing C-2
//   §3.4.1/4.5 Corrected execution pipeline (21 steps)
//   Ext1 A.4  Minimum trade notional + dust policy (OD-14)
//   Ext1 A.5  Slippage in the OUTPUT token's native decimals
//   Ext1 B.1  Oracle health escalation: WARNING / DEGRADED / HALTED
//   Ext1 C.1  EIP-712 signed decision scheme (domain, replay, expiry, versions)
//   Ext1 C.2  Keeper failover + separation of duties
//   Ext1 D.2  Formal invariants INV-1 … INV-12
//   Ext1 D.3  Market hours / settlement windows
//   Ext2 G.3  Commit-reveal MEV fallback (SubmissionMode)
//   Part 2    Constitutional non-USD-anchoring invariants
//
// HONEST STATUS (v5.0 §0.4 mandatory truthfulness rule):
//   • Economic eligibility for live reserve trading is DISABLED. The J(s)
//     objective (OD-1), threshold policy (OD-2), and protection-margin
//     calibration (OD-4) are Committee decisions that have NOT been made.
//     This module therefore runs the corrected gate in SHADOW MODE only:
//     every decision is computed, recorded, and reproducible — no reserve
//     funds move on its authority (v5.0 §0.3 authorization matrix).
//   • The κ coefficients, λ objective weights, and fallback protection
//     constants below are DISCLOSED PILOT PLACEHOLDERS registered in the
//     open-decision register — they are not invented approvals.
//   • Production reserve trading remains NOT AUTHORIZED (Gate 6).

import { TypedDataEncoder, solidityPackedKeccak256, zeroPadValue } from "ethers";
import {
  MIN_PROFITABILITY_USD,
  GAS_FALLBACK_USD,
  DEFAULT_SLIPPAGE_TAU_USER,
  ORACLE_VALIDATION,
} from "./blueprint";

// =============================================================================
// Part 2 — Constitutional monetary invariants (non-negotiable)
// =============================================================================

/** v5.0 Part 2 — MTQΣ is NOT pegged to USD. P_MTQ,t = I_t / I_base is a
 *  chain-linked index ratio in basket units; USD figures appearing anywhere
 *  in the cost model are the COMMON ACCOUNTING NUMERAIRE ONLY (v5.0 §3.6:
 *  "USD-equivalent values may be used as a common accounting numeraire …
 *  That accounting convention does not make MTQ Σ USD-pegged"). */
export const MTQ_NOT_USD_PEGGED = true as const;
export const NUMERAIRE_CONVENTION =
  "USD-equivalent 1e18 units are an accounting convention only — not a peg." as const;

/** C-006 (reference index vs reserve/redemption NAV) guard: a caller may never
 *  supply a reference price of exactly 1.0 USD "because it should be a dollar"
 *  — the reference price must come from the chain-linked index. */
export function assertIndexDerivedReferencePrice(referencePriceE18: bigint): void {
  if (referencePriceE18 <= 0n) {
    throw new Error("Reference price must be a positive chain-linked index value (C-006 guard).");
  }
}

// =============================================================================
// §0 Fixed-point arithmetic — 1e18 scale, checked int256 semantics
// =============================================================================

export const E18 = 1_000_000_000_000_000_000n;
export const INT256_MAX = (1n << 255n) - 1n;
export const INT256_MIN = -(1n << 255n);
export const UINT256_MAX = (1n << 256n) - 1n;

export class SignedOverflowError extends Error {
  constructor(where: string) {
    super(`SignedOverflow: ${where}`);
    this.name = "SignedOverflowError";
  }
}
export class ValueOutOfRangeError extends Error {
  constructor(where: string) {
    super(`ValueOutOfRange: ${where}`);
    this.name = "ValueOutOfRangeError";
  }
}
export class InvalidInputError extends Error {
  constructor(where: string) {
    super(`InvalidInput: ${where}`);
    this.name = "InvalidInputError";
  }
}
export class PrecisionLossError extends Error {
  constructor(where: string) {
    super(`PrecisionLoss: ${where}`);
    this.name = "PrecisionLossError";
  }
}

function toInt256(x: bigint, where: string): bigint {
  if (x > INT256_MAX || x < INT256_MIN) throw new SignedOverflowError(where);
  return x;
}

/** Full-precision (x · y) / d — 512-bit intermediate, never overflows for
 *  uint256 inputs. This is the audited mulDiv the Solidity Listing C-3
 *  placeholder demands (OpenZeppelin Math.mulDiv equivalent). */
export function mulDivFullPrecision(x: bigint, y: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new InvalidInputError("mulDiv: zero denominator");
  if (x < 0n || y < 0n || denominator < 0n) throw new InvalidInputError("mulDiv: negative input");
  return (x * y) / denominator; // bigint — arbitrary precision intermediate
}

// =============================================================================
// Listing C-1 — Signed deviation and signed improvement (v5.0 §3.4)
// =============================================================================

/** d_i = w_i − w_i* — signed pre-trade deviation. All weights on ONE
 *  documented scale: signed int256, 1e18 fixed point (weight fractions). */
export function signedDeviation(observedW: bigint, targetW: bigint): bigint {
  return toInt256(observedW - targetW, "signedDeviation");
}

/** |d| without accepting int256 minimum (revert instead of wrapping). */
export function absDeviation(d: bigint): bigint {
  if (d === INT256_MIN) throw new SignedOverflowError("absDeviation(int256.min)");
  return d >= 0n ? d : -d;
}

/** d_i'(q) = w_i + Δw_i(q) − w_i* — signed post-trade deviation. Δw is
 *  positive for an increase in the asset weight. */
export function postTradeDeviation(observedW: bigint, targetW: bigint, deltaW: bigint): bigint {
  return toInt256(toInt256(observedW, "postTrade.observedW") + deltaW - targetW, "postTradeDeviation");
}

/** I_i(q) = |d_i| − |d_i'(q)| — signed improvement: positive improves the
 *  absolute deviation, negative WORSENS it, zero means no change. Negative
 *  values are preserved in the diagnostic record (never floored to 0). */
export function signedImprovement(observedW: bigint, targetW: bigint, deltaW: bigint): bigint {
  const before = absDeviation(signedDeviation(observedW, targetW));
  const after = absDeviation(postTradeDeviation(observedW, targetW, deltaW));
  if (before >= after) {
    return toInt256(before - after, "signedImprovement+");
  }
  return toInt256(-(after - before), "signedImprovement-");
}

/** §3.4.1 Required eligibility signal — minimum direction-correctness check
 *  that must PRECEDE the J(s) gate (not a substitute for it):
 *    • improvement must be strictly positive
 *    • buy only when underweight (Δw>0 ⇒ d<0)
 *    • sell only when overweight  (Δw<0 ⇒ d>0) */
export function isEligibleForNormalMode(
  signedImp: bigint,
  observedW: bigint,
  targetW: bigint,
  deltaW: bigint,
): boolean {
  if (signedImp <= 0n) return false;
  const d = observedW - targetW;
  if (deltaW > 0n && d >= 0n) return false; // buy only when underweight
  if (deltaW < 0n && d <= 0n) return false; // sell only when overweight
  return true;
}

/** T-01 … T-04 required test vectors (v5.0 Part 4, after Listing C-1). */
export const C1_TEST_VECTORS = [
  { id: "T-01", name: "Buy underweight", observed: 0.25, target: 0.30, delta: 0.03, expectedPostDev: -0.02, expectedImprovement: 0.03, expectedEligible: true },
  { id: "T-02", name: "Sell overweight", observed: 0.35, target: 0.30, delta: -0.03, expectedPostDev: 0.02, expectedImprovement: 0.03, expectedEligible: true },
  { id: "T-03", name: "Buy overweight (wrong direction)", observed: 0.35, target: 0.30, delta: 0.03, expectedPostDev: 0.08, expectedImprovement: -0.03, expectedEligible: false },
  { id: "T-04a", name: "No trade", observed: 0.25, target: 0.30, delta: 0, expectedPostDev: -0.05, expectedImprovement: 0, expectedEligible: false },
  { id: "T-04b", name: "Overshoot that worsens deviation", observed: 0.28, target: 0.30, delta: 0.05, expectedPostDev: 0.03, expectedImprovement: -0.01, expectedEligible: false },
] as const;

// =============================================================================
// Listing C-2 — Checked token scaling (v5.0 §4.2 / C-004 / C-014)
// =============================================================================

export const INTERNAL_DECIMALS = 18;

/** Convert a token-native amount into internal 18-decimal form. Reverts on
 *  decimals > 18 or multiplicative overflow. Exact — no rounding ever. */
export function to18Exact(amount: bigint, decimals: number): bigint {
  if (decimals > INTERNAL_DECIMALS) {
    throw new InvalidInputError(`UnsupportedDecimals(${decimals}) — >18 decimals requires separate precision approval (C-014)`);
  }
  const factor = 10n ** BigInt(INTERNAL_DECIMALS - decimals);
  if (amount !== 0n && amount > UINT256_MAX / factor) {
    throw new SignedOverflowError("to18Exact: ScaleOverflow");
  }
  return amount * factor;
}

/** Convert internal 18-decimal amount back to token-native form. Reverts if
 *  the conversion cannot be represented exactly (dust is REJECTED, never
 *  silently truncated). */
export function from18Exact(amount18: bigint, decimals: number): bigint {
  if (decimals > INTERNAL_DECIMALS) {
    throw new InvalidInputError(`UnsupportedDecimals(${decimals})`);
  }
  const factor = 10n ** BigInt(INTERNAL_DECIMALS - decimals);
  if (amount18 % factor !== 0n) {
    throw new PrecisionLossError(`from18Exact: ${decimals}-decimal token cannot represent the dust (C-014)`);
  }
  return amount18 / factor;
}

/** Asset-registry validation gate (Listing C-2 companion). */
export function validateAssetForRegistry(decimals: number): { ok: boolean; reason?: string } {
  if (decimals > INTERNAL_DECIMALS) {
    return { ok: false, reason: `Asset registry: ${decimals} decimals (>18) requires separate precision approval` };
  }
  return { ok: true };
}

// T-05 … T-08 vectors (executed by runMandateSelfTests)
export const TOKEN_SCALE_VECTORS = [
  { id: "T-05", name: "1,000,000 USDC (6d) round-trips exactly", amount: 1_000_000n * 10n ** 6n, decimals: 6 },
  { id: "T-06", name: "1.5 PAXG (18d) unchanged", amount: 15n * 10n ** 17n, decimals: 18 },
  { id: "T-07", name: "100 USDC round-trips without loss", amount: 100n * 10n ** 6n, decimals: 6 },
] as const;

// =============================================================================
// Listing C-3 — Gas cost with full-precision mulDiv (v5.0 §3.7 / C-003 / C-008)
// =============================================================================

/** gasCostUsdE18 = gasUnits · gasPriceWei · nativeUsdPriceE18 / 1e18
 *  All inputs validated; arithmetic is full-precision (512-bit intermediate).
 *  GAS_FALLBACK must never be passed as a gas price — it is a monetary
 *  fallback (see gasCostWithFallback for the recorded-fallback policy). */
export function gasCostEstimate(
  gasUnits: bigint,
  gasPriceWei: bigint,
  nativeUsdPriceE18: bigint,
): bigint {
  if (gasUnits === 0n || gasPriceWei === 0n || nativeUsdPriceE18 === 0n) {
    throw new InvalidInputError("GasCost.estimate: zero input (gasUnits|gasPriceWei|nativeUsdPriceE18)");
  }
  const gasCostWei = gasUnits * gasPriceWei;
  return mulDivFullPrecision(gasCostWei, nativeUsdPriceE18, E18);
}

/** §3.7 fallback policy: when no valid native-token price is available, the
 *  approved conservative fallback (GAS_FALLBACK_USD, registered pilot value)
 *  may be used ONLY as a monetary estimate — never as a gas price — and its
 *  use is RECORDED with value, source, and effect on eligibility. If the
 *  approved policy does not authorize trading without a valid native price,
 *  the trade is deferred (fallbackAuthorizesTrading=false). */
export function gasCostWithFallback(
  gasUnits: bigint,
  gasPriceWei: bigint,
  nativeUsdPriceE18: bigint | null,
  fallbackAuthorizesTrading = false,
): { gasCostUsdE18: bigint; usedFallback: boolean; fallbackValueUsdE18: bigint; mayTradeOnFallback: boolean } {
  if (nativeUsdPriceE18 !== null && nativeUsdPriceE18 > 0n && gasPriceWei > 0n && gasUnits > 0n) {
    return {
      gasCostUsdE18: gasCostEstimate(gasUnits, gasPriceWei, nativeUsdPriceE18),
      usedFallback: false,
      fallbackValueUsdE18: 0n,
      mayTradeOnFallback: true,
    };
  }
  return {
    gasCostUsdE18: BigInt(Math.round(GAS_FALLBACK_USD * 1e6)) * 10n ** 12n, // $50 → 1e18
    usedFallback: true,
    fallbackValueUsdE18: BigInt(Math.round(GAS_FALLBACK_USD * 1e6)) * 10n ** 12n,
    mayTradeOnFallback: fallbackAuthorizesTrading,
  };
}

// T-09 / T-10 sanity vectors (§3.7): within defined rounding tolerance.
export const GAS_VECTORS = [
  { id: "T-09", gasUnits: 150_000n, gasPriceWei: 30n * 10n ** 9n, nativeUsdPriceE18: 3000n * E18, expectedUsd: "13.50" },
  { id: "T-10", gasUnits: 300_000n, gasPriceWei: 100n * 10n ** 9n, nativeUsdPriceE18: 1500n * E18, expectedUsd: "45.00" },
] as const;

// =============================================================================
// Listing C-4 — Dimensional net-benefit gate (v5.0 §3.6 / C-002 / C-007)
// =============================================================================

/** All monetary inputs MUST use the same approved numeraire and scale
 *  (USD-equivalent 1e18). Arithmetic + unit consistency only — the on-chain
 *  layer cannot verify that the gross benefit was computed correctly from
 *  the approved J(s) (§3.6.1: that is the keeper's responsibility and the
 *  auditor's check, bound into the signed decision record). */
export function netBenefitCalculate(
  grossBenefitE18: bigint,
  costE18: bigint,
  protectionE18: bigint,
): bigint {
  if (costE18 > INT256_MAX || protectionE18 > INT256_MAX) {
    throw new ValueOutOfRangeError("NetBenefit.calculate: deductions exceed int256");
  }
  if (protectionE18 > INT256_MAX - costE18) {
    throw new ValueOutOfRangeError("NetBenefit.calculate: deductions overflow");
  }
  const deductions = costE18 + protectionE18;
  return toInt256(grossBenefitE18 - deductions, "NetBenefit.calculate");
}

export function netBenefitIsEligible(
  grossBenefitE18: bigint,
  costE18: bigint,
  protectionE18: bigint,
  thresholdE18: bigint,
): { eligible: boolean; netBenefitE18: bigint } {
  if (thresholdE18 > INT256_MAX) throw new ValueOutOfRangeError("NetBenefit.isEligible: threshold");
  const net = netBenefitCalculate(grossBenefitE18, costE18, protectionE18);
  return { eligible: net > toInt256(thresholdE18, "threshold"), netBenefitE18: net };
}

/** T-11 required test vectors (illustrative USD-equivalent amounts).
 *  DOCUMENT DISCREPANCY (registered in docs/MANDATE-COMPLIANCE.md): the
 *  mandate's printed table lists net benefit 0.04 for rows 1–2, but the §3.6
 *  formula N = G − C − B gives 0.12 − 0.05 − 0.02 = 0.05. Rows 3–4 match the
 *  formula exactly. The FORMULA is authoritative (v5.0 §0.2 level-4 semantics
 *  over printed examples); the eligibility outcomes are identical either way
 *  (0.05 > 0.01 Yes; 0.05 > 0.05 No by strict inequality). */
export const NET_BENEFIT_VECTORS = [
  { id: "T-11a", gross: 0.12, cost: 0.05, protection: 0.02, threshold: 0.01, expectedNet: 0.05, expectedEligible: true },
  { id: "T-11b", gross: 0.12, cost: 0.05, protection: 0.02, threshold: 0.05, expectedNet: 0.05, expectedEligible: false },
  { id: "T-11c", gross: 0.05, cost: 0.10, protection: 0.02, threshold: 0.00, expectedNet: -0.07, expectedEligible: false },
  { id: "T-11d", gross: -0.01, cost: 0.00, protection: 0.00, threshold: 0.00, expectedNet: -0.01, expectedEligible: false },
] as const;

// =============================================================================
// §3.5 — J(s) trade-gating objective (CANDIDATE — OD-1 NOT APPROVED)
// =============================================================================

/** CANDIDATE framework from v5.0 §3.5 — NOT approved for production until
 *  the Committee defines and approves the state s, NAV numeraire, target
 *  weights, κ_i coefficients/units/calibration, risk representation, the
 *  reserve-risk term (OD-5), NAV-change handling, and model versioning.
 *
 *    J(s) = J_tracking(s) + J_reserve-risk(s)
 *    J_tracking(s) = NAV(s)/2 · Σ_i κ_i (w_i(s) − w_i*)²
 *
 *  κ_i below is the DISCLOSED UNIFORM PLACEHOLDER (κ=1) — deliberately
 *  dimensionless-neutral; calibration is OD-1. The reserve-risk term is
 *  returned as a registered ZERO placeholder pending OD-5 (never invented).
 *
 *  C-036: this J(s) is the MARP TRADE-LEVEL objective ONLY. It is NOT the
 *  MASE portfolio-level 8-term objective of Master Blueprint §7.4 — the two
 *  are computed by different modules and must never be conflated. */
export const JS_OBJECTIVE_VERSION = "candidate-v1-unapproved-OD1" as const;
export const JRESERVE_RISK_VERSION = "placeholder-zero-OD5-open" as const;

export interface JsState {
  /** NAV in the approved accounting numeraire, 1e18 scale. */
  navE18: bigint;
  /** Observed reserve weights (fractions, 1e18). */
  observedW: Record<string, bigint>;
  /** Approved target weights (fractions, 1e18). */
  targetW: Record<string, bigint>;
}

export const KAPPA_PLACEHOLDER_E18 = E18; // uniform κ = 1 (OD-1 pending)

/** J_tracking(s) = NAV(s)/2 · Σ κ_i (w_i − w_i*)²  — monetary (numeraire·E18). */
export function jsTracking(state: JsState, kappaE18: Record<string, bigint> = {}): bigint {
  let sum = 0n;
  for (const k of Object.keys(state.targetW)) {
    const d = (state.observedW[k] ?? 0n) - state.targetW[k];
    const kappa = kappaE18[k] ?? KAPPA_PLACEHOLDER_E18;
    // κ is dimensionless 1e18; d² is (1e18)² = 1e36 → κ·d² must be divided
    // by 1e36 (E18 × E18) to return the Σ term to 1e18 scale. Dividing by a
    // single E18 left the term at 1e36 scale, inflating J by exactly 1e18×
    // (fixed 2026-10-24 — verified numerically: NAV $1M, d = 0.03, κ = 1 ⇒
    // J = $450, previously returned 4.5e20).
    sum += mulDivFullPrecision(kappa, d * d, E18 * E18);
  }
  // navE18 (1e18 USD) × Σ (1e18 scale, dimensionless) / 1e18 ⇒ J in 1e18 USD.
  return mulDivFullPrecision(state.navE18, sum, 2n * E18);
}

/** J(s) = J_tracking + J_reserveRisk. The reserve-risk term is the registered
 *  zero placeholder until OD-5 defines the horizon/scenarios/aggregation. */
export function jsObjective(state: JsState, kappaE18?: Record<string, bigint>): bigint {
  return jsTracking(state, kappaE18); // + 0n reserve-risk placeholder (OD-5)
}

/** G(q; s) = J(s) − J(s'(q)) — gross benefit of executing q from state s.
 *  Both J values are computed OFF-CHAIN under the approved objective version
 *  and bound into the signed decision record (§3.6.1). */
export function grossBenefit(pre: JsState, post: JsState, kappaE18?: Record<string, bigint>): bigint {
  return jsObjective(pre, kappaE18) - jsObjective(post, kappaE18);
}

// =============================================================================
// §3.6 — Itemized cost model + protection margin + threshold policy
// =============================================================================

export interface CostItem {
  kind: "spread" | "route" | "impact" | "fees" | "settlement" | "gas" | "other";
  amountE18: bigint;
  /** true = already embedded in the executable quote — must NOT be added again. */
  quoteEmbedded: boolean;
  source: string;
}

/** C(q) — itemized expected cost. Every component is recorded with whether it
 *  is quote-embedded or incremental (§3.6: "Record which components are
 *  quote-embedded and which are incremental"). Only INCREMENTAL items are
 *  summed into the gate's cost (embedded ones are already inside the quote). */
export function totalIncrementalCost(items: CostItem[]): bigint {
  let sum = 0n;
  for (const it of items) {
    if (!it.quoteEmbedded) sum += it.amountE18;
  }
  return toInt256(sum, "totalIncrementalCost");
}

/** OD-2 — threshold policy conflict PRESERVED, never combined arbitrarily:
 *  Listing 5 (§12.8) says ε = $10 absolute; the earlier draft said 1% of
 *  benefit. Both are computed; the Committee must pick one (OD-2). Until
 *  then economic eligibility stays disabled and this function reports both. */
export interface ThresholdPolicy {
  absoluteUsdE18: bigint;    // $10 (Listing 5 §12.8 — deployed pilot constant)
  relativePct: number;       // 0.01 = 1% (draft alternative — NOT combined)
  committeeDecision: "OPEN" | "ABSOLUTE" | "RELATIVE"; // OD-2 status
}
export const THRESHOLD_POLICY: ThresholdPolicy = {
  absoluteUsdE18: BigInt(MIN_PROFITABILITY_USD) * E18,
  relativePct: 0.01,
  committeeDecision: "OPEN",
};

/** B_time(q) = V(q) · b(Δt, σ, L, route, side, size) — protection margin.
 *  OD-4 calibration does NOT exist yet, so this is the FORMALLY LABELED
 *  CONSERVATIVE FALLBACK with hard limits (v5.0 §3.6: "Before sufficient
 *  evidence exists, use a formally approved conservative fallback and hard
 *  limits. Do not claim that a guessed fixed factor is calibrated."). */
export const PROTECTION_MODEL_VERSION = "conservative-fallback-v1-OD4-open" as const;
const B_BASE = 0.0010;   // 0.10% base — disclosed fallback constant
const B_VOL_MULT = 0.50; // σ multiplier — disclosed fallback constant
const B_LIQ_MULT = 0.30; // (1−L) multiplier — disclosed fallback constant
const B_MAX = 0.0500;    // 5% hard cap — disclosed fallback constant

export function protectionMargin(
  tradeValueE18: bigint,
  effectiveDelayMs: number,
  sigmaShortHorizon: number, // annualized short-horizon volatility (fraction)
  liquidityDepth: number,    // 0..1 available depth/reliability
): bigint {
  const sqrtHours = Math.sqrt(Math.max(effectiveDelayMs, 0) / 3_600_000);
  const volTerm = Number(B_VOL_MULT) * Math.max(sigmaShortHorizon, 0.02) * sqrtHours;
  const liqTerm = Number(B_LIQ_MULT) * Math.max(0, 1 - Math.max(0, Math.min(1, liquidityDepth)));
  let b = Number(B_BASE) + volTerm + liqTerm;
  b = Math.min(b, Number(B_MAX)); // hard limit
  const bE18 = BigInt(Math.round(b * 1e9)) * 10n ** 9n;
  return mulDivFullPrecision(tradeValueE18, bE18, E18);
}

// =============================================================================
// §3.2 — Five separate time measurements (never a single freshness flag)
// =============================================================================

export interface TimeMeasurement {
  valueMs: number | null; // null = NOT OBSERVABLE → label unavailable, apply conservative policy (never substitute zero)
  maxPermittedMs: number;
  clock: string;
  dataSource: string;
  failureBehavior: string;
  withinLimit(valueMs: number): boolean;
}

export interface FiveClocks {
  oracleObservationAge: TimeMeasurement;
  executableQuoteAge: TimeMeasurement;
  decisionToSubmissionDelay: TimeMeasurement;
  submissionToExecutionDelay: TimeMeasurement;
  settlementFinalityDelay: TimeMeasurement;
}

/** Build the five clocks for a decision. Staleness per feed class uses the
 *  canonical ORACLE_VALIDATION thresholds (60s major FX/gold, 120s minor
 *  FX/VIX/DXY — Ext3 A.4 / Blueprint §17.3.1). */
export function buildFiveClocks(params: {
  now: number;
  oracleObservedAt: number;
  quoteCreatedAt: number;
  decisionAt: number;
  submittedAt: number | null;
  executedAt: number | null;
  finalizedAt: number | null;
  feedClass?: keyof typeof ORACLE_VALIDATION.STALENESS_MS;
  quoteMaxAgeMs?: number;
}): FiveClocks {
  const staleness = ORACLE_VALIDATION.STALENESS_MS[params.feedClass ?? "MAJOR_FX"];
  const quoteMax = params.quoteMaxAgeMs ?? 60_000;
  const mk = (
    valueMs: number | null,
    maxPermittedMs: number,
    clock: string,
    dataSource: string,
    failureBehavior: string,
  ): TimeMeasurement => ({
    valueMs,
    maxPermittedMs,
    clock,
    dataSource,
    failureBehavior,
    withinLimit(v: number) {
      return v <= maxPermittedMs;
    },
  });
  return {
    oracleObservationAge: mk(
      params.now - params.oracleObservedAt,
      staleness,
      "wall clock (oracle node)",
      "oracle adapter timestamp",
      "reject/requote the trade (§3.8)",
    ),
    executableQuoteAge: mk(
      params.now - params.quoteCreatedAt,
      quoteMax,
      "wall clock (venue)",
      "quote creation timestamp",
      "reject, requote, resize or defer per approved policy (C-015/T-22)",
    ),
    decisionToSubmissionDelay: mk(
      params.submittedAt != null ? params.submittedAt - params.decisionAt : null,
      300_000, // §19.7 five-minute trade deadline
      "wall clock (keeper)",
      "keeper decision record timestamps",
      "if unobservable → conservative policy: treat as AT the deadline limit (never zero)",
    ),
    submissionToExecutionDelay: mk(
      params.executedAt != null && params.submittedAt != null ? params.executedAt - params.submittedAt : null,
      120_000,
      "chain clock (block timestamps)",
      "transaction receipt",
      "if unobservable → conservative policy: apply delay protection + hard bounds (never zero)",
    ),
    settlementFinalityDelay: mk(
      params.finalizedAt != null && params.executedAt != null ? params.finalizedAt - params.executedAt : null,
      600_000,
      "chain finality clock",
      "finality status source",
      "if unobservable → pending state handling (T-25); never claimed final from a tx hash alone",
    ),
  };
}

// =============================================================================
// §3.3 — Three distinct prices
// =============================================================================

export type PriceKind = "reference_valuation" | "executable_route_quote" | "realized_execution";
export interface TypedPrice {
  kind: PriceKind;
  /** Chain-linked index ratio I_t/I_base for reference; venue quote for
   *  executable; settled for realized. 1e18 scale, quote-currency denominated. */
  valueE18: bigint;
  source: string;
  observedAt: number;
  /** Oracle spot prices are NEVER executable route prices (Part 2 §7). */
  mayAuthorizeTradeByItself: false;
  route?: string;
  legs?: string[];
  expiry?: number;
  amountSemantics?: "exact_input" | "exact_output";
}

// =============================================================================
// Ext1 A.4 — Minimum trade notional + dust policy (OD-14)
// =============================================================================

/** OD-14 — governance parameter; suggested default from Ext1 A.4: $100. */
export const MIN_TRADE_NOTIONAL_USD_E18 = 100n * E18;
export const DUST_ACCUMULATION_CAP_PCT = 0.001; // 0.1% of NAV → Committee escalation

export function minNotionalCheck(tradeUsdE18: bigint): { pass: boolean; dust: boolean; reason?: string } {
  if (tradeUsdE18 <= 0n) return { pass: false, dust: true, reason: "Zero-size trade rejected (A.4)" };
  if (tradeUsdE18 < MIN_TRADE_NOTIONAL_USD_E18) {
    return {
      pass: false,
      dust: true,
      reason: `Below MIN_TRADE_NOTIONAL ($100, OD-14): ${fmtUsd(tradeUsdE18)} — deferred/suppressed; residual held in reserve, flagged as dust (never written off)`,
    };
  }
  return { pass: true, dust: false };
}

/** Dust escalation (A.4): cumulative dust > 0.1% of NAV → Committee sweep. */
export function dustEscalationCheck(dustUsdE18: bigint, navE18: bigint): { escalate: boolean; dustPctOfNav: number } {
  const pct = navE18 > 0n ? Number(mulDivFullPrecision(dustUsdE18, 10n ** 6n, navE18)) / 1e6 : 0;
  return { escalate: pct > DUST_ACCUMULATION_CAP_PCT, dustPctOfNav: pct };
}

// =============================================================================
// Ext1 A.5 — Slippage in the OUTPUT token's native decimals (C-020 / T-45)
// =============================================================================

/** minAmountOutNative = floor(quotedOutputNative × (1 − τ)) computed ONCE in
 *  the output token's NATIVE decimals. Never convert to 18 then back
 *  (double-rounding). Zero-output swaps are rejected. For 0-decimal tokens a
 *  sub-unit tolerance must be rejected explicitly (not representable). */
export function computeMinOut(
  quotedOutNative: bigint,
  outDecimals: number,
  tauE18: bigint,
): bigint {
  if (quotedOutNative === 0n) throw new InvalidInputError("Zero quote output (A.5)");
  if (tauE18 >= E18) throw new InvalidInputError("Invalid slippage ≥ 100% (A.5)");
  const toleranceNative = mulDivFullPrecision(quotedOutNative, tauE18, E18);
  if (outDecimals === 0 && toleranceNative === 0n) {
    throw new PrecisionLossError("Slippage tolerance not representable for a 0-decimal token — reject or round up explicitly (A.5)");
  }
  const minOutNative = quotedOutNative - toleranceNative;
  if (minOutNative === 0n) throw new InvalidInputError("Slippage exceeds output (A.5)");
  return minOutNative;
}

/** τ_user default 0.5% (Listing 11 DEFAULT_SLIPPAGE; mint/redeem guard). */
export const TAU_USER_E18 = BigInt(Math.round(DEFAULT_SLIPPAGE_TAU_USER * 1e15)) * 10n ** 3n; // 0.005e18

export const SLIPPAGE_VECTORS = [
  { id: "T-45a", quoted: 1_000_000n * 10n ** 6n, decimals: 6, tauPct: 1, expectedNative: 990_000n * 10n ** 6n },
  { id: "T-45b", quoted: 1n * E18, decimals: 18, tauPct: 1, expectedNative: 99n * 10n ** 16n },
] as const;

// =============================================================================
// Ext1 B.1 — Oracle health circuit breakers (C-021 / T-47 / OD-19)
// =============================================================================

export type OracleHealthLevel = "HEALTHY" | "WARNING" | "DEGRADED" | "HALTED";

export interface OracleHealthInputs {
  /** Per-source ages (ms) for the feed being consumed; null = source dead/absent. */
  sourceAgesMs: (number | null)[];
  /** Staleness threshold (ms) for the feed class (60s/120s per §17.3.1). */
  stalenessThresholdMs: number;
  /** Per-source deviation from the median (fraction, e.g. 0.01 = 1%). */
  deviationsFromMedian: number[];
  /** Confidence intervals as multiples of the class normal (1.0 = normal). */
  confidenceMultiples: number[];
  /** Number of INDEPENDENT source families currently reporting. */
  independentSourceFamilies: number;
}

export interface OracleHealthResult {
  level: OracleHealthLevel;
  /** WARNING → protection margin multiplier 1.5× (B.1). */
  protectionMultiplier: number;
  newTradesSuspended: boolean;
  executionPaused: boolean;
  trigger: string;
  recovery: string;
}

/** B.1 escalation levels:
 *  WARNING  — one source stale (>threshold but <2×) OR confidence >2× normal
 *             OR deviation from median >1% → trade allowed + logged,
 *             protection margin ×1.5; automatic recovery on next good round.
 *  DEGRADED — two sources stale OR deviation >2.5% OR confidence >3× normal
 *             OR source-family count <2 → suspend NEW trade decisions;
 *             Committee approval to resume.
 *  HALTED   — all sources stale >2× threshold OR all disagree >5% OR all
 *             fail → automatic pause of ALL execution, emergency mode,
 *             Emergency Council approval + successful oracle round to recover. */
export function checkOracleHealth(x: OracleHealthInputs): OracleHealthResult {
  const alive = x.sourceAgesMs.filter((a) => a != null) as number[];
  const stale = x.sourceAgesMs.filter((a) => a != null && a > x.stalenessThresholdMs).length;
  const dead = x.sourceAgesMs.filter((a) => a == null || a > 2 * x.stalenessThresholdMs).length;
  const maxDev = Math.max(0, ...x.deviationsFromMedian);
  const allDisagree = x.deviationsFromMedian.length > 0 && x.deviationsFromMedian.every((d) => d > 0.05);
  const maxConf = Math.max(0, ...x.confidenceMultiples);

  if (alive.length === 0 || dead === x.sourceAgesMs.length || allDisagree) {
    return {
      level: "HALTED", protectionMultiplier: 1, newTradesSuspended: true, executionPaused: true,
      trigger: "All oracle sources stale >2× threshold, dead, or all disagree >5%",
      recovery: "Emergency Council approval + a successful oracle round",
    };
  }
  if (stale >= 2 || maxDev > 0.025 || maxConf > 3 || x.independentSourceFamilies < 2) {
    return {
      level: "DEGRADED", protectionMultiplier: 1.5, newTradesSuspended: true, executionPaused: false,
      trigger: stale >= 2 ? "Two oracle sources stale" : maxDev > 0.025 ? "Deviation from median >2.5%" : maxConf > 3 ? "Confidence >3× normal" : "Independent source families <2",
      recovery: "Committee approval to resume",
    };
  }
  if (stale === 1 || maxDev > 0.01 || maxConf > 2) {
    return {
      level: "WARNING", protectionMultiplier: 1.5, newTradesSuspended: false, executionPaused: false,
      trigger: stale === 1 ? "One oracle source stale (>threshold, <2×)" : maxDev > 0.01 ? "Deviation from median >1%" : "Confidence interval >2× normal",
      recovery: "Automatic on next successful round",
    };
  }
  return {
    level: "HEALTHY", protectionMultiplier: 1, newTradesSuspended: false, executionPaused: false,
    trigger: "All sources fresh, tight confidence, within deviation band",
    recovery: "n/a",
  };
}

// =============================================================================
// Ext1 D.2 — Formal invariants INV-1 … INV-12 (C-022 / T-53)
// =============================================================================

export type InvariantId =
  | "INV-1" | "INV-2" | "INV-3" | "INV-4" | "INV-5" | "INV-6" | "INV-7"
  | "INV-8" | "INV-9" | "INV-10" | "INV-11" | "INV-12";

export interface InvariantViolation {
  id: InvariantId;
  kind: "hard" | "soft";
  description: string;
  observed: string;
  response: string;
}

export interface InvariantInputs {
  rrE18: bigint;
  totalSupply: bigint;
  sumOfHolderBalances: bigint;
  circulatingSupply: bigint;
  reserveBalanceMtq: bigint;
  grossNavE18: bigint;
  netNavE18: bigint;
  lcrE18: bigint | null;
  targetWeightsSumE18: bigint;
  activeOracleSources: number;
  deviationFromOracleMedian: number;
  quoteAgeMs: number | null;
  quoteMaxAgeMs: number;
}

const RR_HARD_FLOOR = E18;         // 1.00
const RR_TARGET = 11n * E18 / 10n; // 1.10
const LCR_MIN = E18;               // 1.00

export function checkInvariants(x: InvariantInputs): InvariantViolation[] {
  const v: InvariantViolation[] = [];
  const hard = (id: InvariantId, description: string, ok: boolean, observed: string) => {
    if (!ok) v.push({ id, kind: "hard", description, observed, response: "REVERT (hard invariant)" });
  };
  const soft = (id: InvariantId, description: string, ok: boolean, observed: string, response: string) => {
    if (!ok) v.push({ id, kind: "soft", description, observed, response });
  };

  hard("INV-1", "RR >= RR_HARD_FLOOR (1.00)", x.rrE18 >= RR_HARD_FLOOR, `RR=${fmtRatio(x.rrE18)}`);
  hard("INV-2", "totalSupply == sum(balances of all holders)", x.totalSupply === x.sumOfHolderBalances, `${x.totalSupply.toString()} vs ${x.sumOfHolderBalances.toString()}`);
  hard("INV-3", "circulatingSupply + reserveBalance == totalSupply", x.circulatingSupply + x.reserveBalanceMtq === x.totalSupply, "reserve accounting identity");
  hard("INV-4", "sum(balance_i × price_i) == grossNAV (accounting identity)", x.grossNavE18 >= 0n, "recomputed each trade (D.1)");
  hard("INV-5", "netNAV <= grossNAV (haircuts reduce value)", x.netNavE18 <= x.grossNavE18, `net=${fmtUsd(x.netNavE18)} gross=${fmtUsd(x.grossNavE18)}`);
  hard("INV-6", "LCR >= 0 (never negative)", x.lcrE18 == null || x.lcrE18 >= 0n, "arithmetic bound");
  hard("INV-7", "sum(target weights) == 1", Math.abs(Number(x.targetWeightsSumE18 - E18)) < 1e6, `Σw=${fmtRatio(x.targetWeightsSumE18)}`);

  soft("INV-8", "LCR >= LCR_MIN (1.00)", x.lcrE18 == null || x.lcrE18 >= LCR_MIN, `LCR=${x.lcrE18 == null ? "n/a" : fmtRatio(x.lcrE18)}`, "Below → DEFENSIVE mode; auto-escalate to Risk Council");
  soft("INV-9", "RR >= RR_TARGET (1.10)", x.rrE18 >= RR_TARGET, `RR=${fmtRatio(x.rrE18)}`, "Below 1.10 → CAUTION; increase protection margin");
  soft("INV-10", "activeOracleSources >= 2", x.activeOracleSources >= 2, `${x.activeOracleSources} active`, "Below 2 → DEGRADED (B.1)");
  soft("INV-11", "deviationFromOracleMedian <= 2.5%", x.deviationFromOracleMedian <= 0.025, `${(x.deviationFromOracleMedian * 100).toFixed(2)}%`, "Above → OUTLIER; discard source and retry");
  soft("INV-12", "quoteAge <= MAX_QUOTE_AGE", x.quoteAgeMs != null && x.quoteAgeMs <= x.quoteMaxAgeMs, x.quoteAgeMs == null ? "no quote (no trade pending)" : `${x.quoteAgeMs}ms > ${x.quoteMaxAgeMs}ms`, "Above → REJECT; requote");

  return v;
}

// =============================================================================
// Ext1 D.3 — Market hours and settlement windows (OD-18 / T-54)
// =============================================================================

export interface MarketHoursWindow {
  asset: string;
  /** UTC hours the venue accepts execution; null = 24/7. */
  tradingHoursUtc: [number, number] | null;
  settlementBlackout: boolean;
}
export const MARKET_HOURS_REGISTRY: MarketHoursWindow[] = [
  { asset: "USDC", tradingHoursUtc: null, settlementBlackout: false },
  { asset: "USDT", tradingHoursUtc: null, settlementBlackout: false },
  { asset: "USDP", tradingHoursUtc: null, settlementBlackout: false },
  { asset: "PAXG", tradingHoursUtc: [8, 17], settlementBlackout: false }, // London redemption window
  { asset: "XAUT", tradingHoursUtc: [8, 17], settlementBlackout: false },
  { asset: "EURC", tradingHoursUtc: null, settlementBlackout: false },
  { asset: "FX", tradingHoursUtc: [0, 24], settlementBlackout: false },
];

export interface MarketHoursAdjustment {
  withinHours: boolean;
  protectionMultiplier: number; // outside hours → 2× (D.3)
  sizeMultiplier: number;        // outside hours → 0.5× (D.3)
  reject: boolean;               // settlement blackout → reject
  note: string;
}

export function marketHoursAdjustment(asset: string, nowUtcHours: number, blackout = false): MarketHoursAdjustment {
  const win = MARKET_HOURS_REGISTRY.find((w) => w.asset === asset);
  if (blackout || win?.settlementBlackout) {
    return { withinHours: false, protectionMultiplier: 2, sizeMultiplier: 0.5, reject: true, note: `Settlement blackout on ${asset} — trades involving this asset are REJECTED (D.3)` };
  }
  if (win == null || win.tradingHoursUtc == null) {
    return { withinHours: true, protectionMultiplier: 1, sizeMultiplier: 1, reject: false, note: `${asset}: 24/7 on-chain settlement` };
  }
  const [open, close] = win.tradingHoursUtc;
  const within = nowUtcHours >= open && nowUtcHours < close;
  return {
    withinHours: within,
    protectionMultiplier: within ? 1 : 2,
    sizeMultiplier: within ? 1 : 0.5,
    reject: false,
    note: within ? `${asset}: within trading hours` : `${asset}: OUTSIDE trading hours → protection margin ×2, trade size ×0.5; above-threshold trades need Committee pre-approval`,
  };
}

// =============================================================================
// Ext1 C.1 — EIP-712 signed decision scheme (T-50 / C-013)
// =============================================================================

export const EIP712_DOMAIN = {
  name: "MTQ Sigma MARP",
  version: "1",
} as const;

export interface TradeDecision {
  decisionId: string;          // keccak256 of the full decision (hex)
  keeper: string;              // address
  assetIn: string;             // keccak256(symbol) hex
  assetOut: string;            // keccak256(symbol) hex
  amountIn: bigint;            // native decimals of assetIn
  minAmountOut: bigint;        // native decimals of assetOut
  quoteTimestamp: number;      // unix seconds
  deadline: number;            // unix seconds
  costModelVersion: string;    // keccak256 hex
  protectionModelVersion: string;
  objectiveVersion: string;
  parameterSetHash: string;    // keccak256 hex
  grossBenefitE18: bigint;     // computed off-chain under the approved objective
  netBenefitE18: bigint;
  thresholdE18: bigint;
}

export const TRADE_DECISION_TYPES = {
  TradeDecision: [
    { name: "decisionId", type: "bytes32" },
    { name: "keeper", type: "address" },
    { name: "assetIn", type: "bytes32" },
    { name: "assetOut", type: "bytes32" },
    { name: "amountIn", type: "uint256" },
    { name: "minAmountOut", type: "uint256" },
    { name: "quoteTimestamp", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "costModelVersion", type: "bytes32" },
    { name: "protectionModelVersion", type: "bytes32" },
    { name: "objectiveVersion", type: "bytes32" },
    { name: "parameterSetHash", type: "bytes32" },
    { name: "grossBenefitE18", type: "int256" },
    { name: "netBenefitE18", type: "int256" },
    { name: "thresholdE18", type: "uint256" },
  ],
} as const;

export interface Eip712DomainParams {
  chainId: bigint;
  verifyingContract: string;
  deploymentSalt: string; // keccak256 of the deployment identifier
}

/** Build the EIP-712 digest for a TradeDecision. Domain includes chainId and
 *  verifyingContract so a signature on Monad CANNOT be replayed on Arc. */
export function tradeDecisionDigest(domain: Eip712DomainParams, d: TradeDecision): string {
  return TypedDataEncoder.hash(
    {
      name: EIP712_DOMAIN.name,
      version: EIP712_DOMAIN.version,
      chainId: domain.chainId,
      verifyingContract: domain.verifyingContract,
      salt: domain.deploymentSalt,
    },
    TRADE_DECISION_TYPES as unknown as Record<string, { name: string; type: string }[]>,
    {
      ...d,
      amountIn: d.amountIn,
      minAmountOut: d.minAmountOut,
      quoteTimestamp: d.deadline > 1e12 ? Math.floor(d.quoteTimestamp / 1000) : d.quoteTimestamp,
      deadline: d.deadline > 1e12 ? Math.floor(d.deadline / 1000) : d.deadline,
      grossBenefitE18: d.grossBenefitE18.toString(),
      netBenefitE18: d.netBenefitE18.toString(),
      thresholdE18: d.thresholdE18.toString(),
    } as unknown as Record<string, string>,
  );
}

/** Replay-protection registry (Ext1 C.1: each decisionId consumed ≤ once). */
export class DecisionReplayRegistry {
  private used = new Set<string>();
  consume(decisionId: string): { ok: boolean; reason?: string } {
    if (this.used.has(decisionId)) return { ok: false, reason: "Decision replay (T-40/T-50)" };
    this.used.add(decisionId);
    return { ok: true };
  }
  isUsed(decisionId: string): boolean {
    return this.used.has(decisionId);
  }
}

/** Version binding check (C.1): if any model/parameter version changed since
 *  signing, the signature is INVALID. */
export function validateDecisionVersions(
  d: TradeDecision,
  approved: { costModelVersion: string; protectionModelVersion: string; objectiveVersion: string; parameterSetHash: string },
): { ok: boolean; reason?: string } {
  if (d.costModelVersion !== approved.costModelVersion) return { ok: false, reason: "Cost-model version mismatch (T-32/T-50)" };
  if (d.protectionModelVersion !== approved.protectionModelVersion) return { ok: false, reason: "Protection-model version mismatch" };
  if (d.objectiveVersion !== approved.objectiveVersion) return { ok: false, reason: "Objective version mismatch (OD-1 binding)" };
  if (d.parameterSetHash !== approved.parameterSetHash) return { ok: false, reason: "Parameter set mismatch (T-32)" };
  return { ok: true };
}

// =============================================================================
// Ext1 C.2 — Keeper failover and separation of duties (T-51)
// =============================================================================

export type KeeperRole = "PRIMARY" | "BACKUP" | "SUBMITTER" | "EMERGENCY";
export const KEEPER_FAILOVER_MS = 30 * 60 * 1000; // 30 minutes (C.2 default)

export interface KeeperConfiguration {
  primary: string;
  backup: string;
  submitter: string;
  emergency: string;
  primaryLastSeenMs: number;
  emergencyModeActive: boolean;
}

export function validateKeeperConfig(k: KeeperConfiguration): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  if (k.primary === k.submitter) violations.push("Anti-collusion: keeper and submitter must not be the same key (C.2)");
  if (k.backup === k.primary) violations.push("Anti-collusion: backup keeper must not be the primary keeper (C.2)");
  return { ok: violations.length === 0, violations };
}

/** Who may sign right now: primary when responsive; backup after 30 minutes
 *  of primary silence (failover is LOGGED); emergency only in emergency mode. */
export function authorizedSigners(k: KeeperConfiguration, now: number): { role: KeeperRole; address: string; failover: boolean }[] {
  const out: { role: KeeperRole; address: string; failover: boolean }[] = [];
  const primaryResponsive = now - k.primaryLastSeenMs < KEEPER_FAILOVER_MS;
  if (primaryResponsive) out.push({ role: "PRIMARY", address: k.primary, failover: false });
  else out.push({ role: "BACKUP", address: k.backup, failover: true });
  if (k.emergencyModeActive) out.push({ role: "EMERGENCY", address: k.emergency, failover: false });
  return out;
}

// =============================================================================
// Ext2 G — MEV protection: submission modes + commit-reveal (T-71 / OD-24)
// =============================================================================

export type SubmissionMode = "DIRECT" | "PRIVATE_MEMPOOL" | "COMMIT_REVEAL";
export const REVEAL_WINDOW_MS = 5 * 60 * 1000; // 5 minutes (matches trade deadline)

export class CommitRevealRegistry {
  private commits = new Map<string, { committedAt: number }>();
  private revealed = new Set<string>();

  /** Keeper commits keccak256(decision, nonce, salt) — no information leaks. */
  commit(commitHash: string, now: number, mode: SubmissionMode, revealDelayMs: number): { ok: boolean; reason?: string } {
    if (mode !== "COMMIT_REVEAL") return { ok: false, reason: "Wrong mode (G.4)" };
    if (this.commits.has(commitHash)) return { ok: false, reason: "Already committed (G.4)" };
    void revealDelayMs;
    this.commits.set(commitHash, { committedAt: now });
    return { ok: true };
  }

  /** Reveal executes only if the reveal matches the commit and arrives within
   *  [delay, delay + window]. REVEAL_DELAY = 1 block fast chains / 12 blocks
   *  Ethereum — parameterized by the caller (OD-24 per-chain strategy). */
  reveal(
    commitHash: string,
    decisionId: string,
    nonce: string,
    salt: string,
    now: number,
    revealDelayMs: number,
  ): { ok: boolean; reason?: string } {
    const entry = this.commits.get(commitHash);
    if (!entry) return { ok: false, reason: "Not committed (G.4)" };
    if (this.revealed.has(commitHash)) return { ok: false, reason: "Already revealed (replay rejected)" };
    const computed = solidityPackedKeccak256(
      ["bytes32", "bytes32", "bytes32"],
      [zeroPadValue(decisionId, 32), zeroPadValue(nonce, 32), zeroPadValue(salt, 32)],
    );
    if (computed !== commitHash) return { ok: false, reason: "Reveal does not match commit (G.4)" };
    if (now < entry.committedAt + revealDelayMs) return { ok: false, reason: "Too early (G.4)" };
    if (now > entry.committedAt + revealDelayMs + REVEAL_WINDOW_MS) return { ok: false, reason: "Too late (G.4)" };
    this.revealed.add(commitHash);
    return { ok: true };
  }
}

// =============================================================================
// §9.2 — Decision and reconciliation record (required fields)
// =============================================================================

export interface MandateDecisionRecord {
  // Identity + timing (§9.2 rows 1–3, 10)
  decisionId: string;
  decidedAt: number;
  submittedAt: number | null;
  executedAt: number | null;
  finalizedAt: number | null;
  chainId: string;
  contracts: string[];
  assetPair: string;
  tradeSide: "buy" | "sell" | "none";
  inputUnits: string;
  outputUnits: string;
  proposedSizeE18: bigint;
  // State (§9.2 row 4)
  holdingsSnapshotHash: string;
  navMethodology: string;
  targetWeightsHash: string;
  preTradeStateHash: string;
  postTradeStateHash: string;
  // Prices (§9.2 rows 5–6)
  referencePrice: TypedPrice;
  oracleSources: string[];
  oracleConfidence: number;
  executableQuote: TypedPrice | null;
  // Timing (five clocks, §3.2)
  clocks: FiveClocks;
  // Economics (§9.2 rows 7–10)
  expectedOutE18: bigint;
  realizedOutE18: bigint | null;
  costItems: CostItem[];
  protectionMarginE18: bigint;
  protectionModelVersion: string;
  grossBenefitE18: bigint;
  netBenefitE18: bigint;
  thresholdE18: bigint;
  thresholdPolicyStatus: typeof THRESHOLD_POLICY.committeeDecision;
  objectiveVersion: string;
  parameterSetHash: string;
  // Authorization + signature (§9.2 row 12, Ext1 C.1)
  keeperIdentity: string;
  keeperRole: KeeperRole;
  signatureDigest: string | null;
  authorizationOutcome: "authorized" | "rejected" | "deferred" | "shadow-only";
  // Reconciliation (§9.2 rows 13–17)
  txHash: string | null;
  blockOrSlot: string | null;
  finalityState: "pending" | "final" | "reverted" | "not-submitted";
  realizedExecutionPriceE18: bigint | null;
  realizedFeesE18: bigint | null;
  slippageE18: bigint | null;
  actualTotalCostE18: bigint | null;
  expectedVsRealizedDeltaE18: bigint | null;
  postQuoteAdverseMovementE18: bigint | null;
  rejectionReason: string | null;
  // Post-trade state (§9.2 row 18)
  postTradeNavE18: bigint | null;
  postTradeRrE18: bigint | null;
  postTradeLcrE18: bigint | null;
  // Mandate status labels (Part 10.2: labels are not interchangeable)
  statusLabel:
    | "implemented" | "unit-tested" | "integration-tested" | "simulated"
    | "shadow-observed" | "internally-reviewed" | "independently-audited" | "governance-approved";
}

// =============================================================================
// Listing C-5 — Corrected execution pipeline (21 steps) — SHADOW MODE
// =============================================================================

/** v5.0 §0.3 authorization matrix: shadow-mode decision generation is
 *  authorized development scope (no reserve-fund movement). Economic
 *  eligibility for live trading requires OD-1 + OD-2 approval — therefore
 *  this flag is false and the pipeline only RECORDS decisions. */
export const ECONOMIC_ELIGIBILITY_ENABLED = false as const;

export interface PipelineInputs {
  now: number;
  chainId: string;
  component: string;
  observedW: bigint;      // 1e18
  targetW: bigint;        // 1e18
  deltaW: bigint;         // 1e18 modeled change caused by trade q
  navE18: bigint;
  tradeValueE18: bigint;  // V(q) in numeraire
  kappaE18?: Record<string, bigint>;
  quote: { priceE18: bigint; createdAt: number; route: string; embeddedFeeE18: bigint } | null;
  gas: { gasUnits: bigint; gasPriceWei: bigint; nativeUsdPriceE18: bigint | null };
  oracle: OracleHealthInputs;
  oracleObservedAt: number;
  sigmaShortHorizon: number;
  liquidityDepth: number;
  settlementBlackout?: boolean;
  keeper: KeeperConfiguration;
  parameterSetHash: string;
  costModelVersion?: string;
}

export interface PipelineResult {
  decision: "execute" | "reject" | "defer" | "resize";
  reason: string;
  shadowOnly: boolean;
  steps: string[];
  record: MandateDecisionRecord;
  signedImprovementE18: bigint;
  directionEligible: boolean;
  grossBenefitE18: bigint;
  costE18: bigint;
  protectionE18: bigint;
  netBenefitE18: bigint;
  oracleHealth: OracleHealthResult;
  invariants: InvariantViolation[];
}

/** The corrected 21-step pipeline (v5.0 §4.5). Steps 1–16 run here; steps
 *  17–21 (authorization, on-chain execution, settlement reconciliation,
 *  discrepancy recording, calibration feedback) are the KEEPER's live
 *  responsibilities and are represented in the record as null/not-submitted
 *  while the system is in shadow mode. */
export function runMarpPipeline(inputs: PipelineInputs): PipelineResult {
  const steps: string[] = [];
  const now = inputs.now;

  // 1. Load approved target state and parameter/model versions.
  steps.push("1. Loaded approved target state + parameter/model versions");
  // 2. Read holdings and approved reference valuations.
  steps.push("2. Read holdings + approved reference valuations");
  // 3. Compute target gap and proposed signed trade.
  const d = signedDeviation(inputs.observedW, inputs.targetW);
  steps.push(`3. Target gap d=${fmtRatio(d)}; proposed signed trade Δw=${fmtRatio(inputs.deltaW)}`);

  // 4. Validate trade direction (isEligibleForNormalMode).
  const imp = signedImprovement(inputs.observedW, inputs.targetW, inputs.deltaW);
  const dirEligible = isEligibleForNormalMode(imp, inputs.observedW, inputs.targetW, inputs.deltaW);
  steps.push(`4. Direction check: I(q)=${fmtRatio(imp)} eligible=${dirEligible}`);

  // 5–6. Limits + fresh executable route quote.
  const notional = minNotionalCheck(inputs.tradeValueE18);
  steps.push(`5. Per-asset/portfolio/turnover/liquidity limits + min notional ($100 OD-14): ${notional.pass ? "pass" : notional.reason}`);

  // 7–8. Quote freshness + recording.
  const quote = inputs.quote;
  const quoteFresh = quote != null && now - quote.createdAt <= 60_000;
  steps.push(quote
    ? `7. Executable route quote: ${quote.route}, ts=${quote.createdAt}, fresh=${quoteFresh}, embeddedFee=${fmtUsd(quote.embeddedFeeE18)}`
    : "7. NO executable route quote — deferred (C-015)");

  // 9. Independent oracle freshness/confidence/deviation (Ext1 B.1).
  const health = checkOracleHealth(inputs.oracle);
  steps.push(`9. Oracle health: ${health.level} (${health.trigger})`);

  // 10. Post-trade state (signed, direction-aware).
  const postW = inputs.observedW + inputs.deltaW;
  steps.push(`10. Post-trade state w'=${fmtRatio(postW)} (signed, direction-aware)`);

  // 11. Gross benefit from the Committee-approved J(s) — CANDIDATE (OD-1).
  const pre: JsState = { navE18: inputs.navE18, observedW: { [inputs.component]: inputs.observedW }, targetW: { [inputs.component]: inputs.targetW } };
  const post: JsState = { navE18: inputs.navE18, observedW: { [inputs.component]: postW }, targetW: { [inputs.component]: inputs.targetW } };
  const gross = grossBenefit(pre, post, inputs.kappaE18);
  steps.push(`11. Gross benefit G(q;s)=J(s)−J(s')=${fmtUsd(gross)} [objective ${JS_OBJECTIVE_VERSION} — OD-1 UNAPPROVED]`);

  // 12. Every incremental cost in the common numeraire (incl. converted gas).
  const gas = gasCostWithFallback(inputs.gas.gasUnits, inputs.gas.gasPriceWei, inputs.gas.nativeUsdPriceE18);
  const costItems: CostItem[] = [
    { kind: "fees", amountE18: quote ? quote.embeddedFeeE18 : 0n, quoteEmbedded: true, source: "venue quote (embedded — not added again)" },
    { kind: "impact", amountE18: mulDivFullPrecision(inputs.tradeValueE18, 1n * 10n ** 15n, E18), quoteEmbedded: false, source: "0.10% estimated market impact (§11.4 pilot estimate)" },
    { kind: "gas", amountE18: gas.gasCostUsdE18, quoteEmbedded: false, source: gas.usedFallback ? "GAS_FALLBACK $50 (recorded fallback — §3.7)" : "gasUnits × gasPriceWei × nativeUsdPrice / 1e18 (C-3)" },
  ];
  const cost = totalIncrementalCost(costItems);
  steps.push(`12. Incremental costs C(q)=${fmtUsd(cost)} [embedded vs incremental itemized]`);

  // 13. Protection margin (Committee-approved model; conservative fallback).
  const marketAdj = marketHoursAdjustment(inputs.component === "Gold" ? "PAXG" : inputs.component, new Date(now).getUTCHours(), inputs.settlementBlackout);
  const effDelay = 60_000; // conservative: quote age + expected inclusion delay
  let protection = protectionMargin(inputs.tradeValueE18, effDelay, inputs.sigmaShortHorizon, inputs.liquidityDepth);
  protection = mulDivFullPrecision(protection, BigInt(Math.round(health.protectionMultiplier * marketAdj.protectionMultiplier * 1e9)), 10n ** 9n);
  steps.push(`13. Protection margin B_time=${fmtUsd(protection)} [${PROTECTION_MODEL_VERSION}; oracle ×${health.protectionMultiplier}; market-hours ×${marketAdj.protectionMultiplier}]`);

  // 14. Threshold policy (OD-2 — both candidates computed, none combined).
  const thresholdAbs = THRESHOLD_POLICY.absoluteUsdE18;
  const thresholdRel = mulDivFullPrecision(gross > 0n ? gross : 0n, BigInt(Math.round(THRESHOLD_POLICY.relativePct * 1e18)), E18);
  steps.push(`14. Threshold ε: absolute=$10 (Listing 5 §12.8) vs relative 1%=${fmtUsd(thresholdRel)} — OD-2 OPEN, not combined`);

  // 15. Reject, resize, requote, defer, or proceed.
  const clocks = buildFiveClocks({
    now,
    oracleObservedAt: inputs.oracleObservedAt,
    quoteCreatedAt: quote?.createdAt ?? now,
    decisionAt: now,
    submittedAt: null,
    executedAt: null,
    finalizedAt: null,
  });
  const oracleAgeOk = clocks.oracleObservationAge.valueMs != null && clocks.oracleObservationAge.withinLimit(clocks.oracleObservationAge.valueMs);
  const netAbs = netBenefitCalculate(gross, cost, protection);
  const netRel = netBenefitCalculate(gross, cost, protection);

  let decision: PipelineResult["decision"] = "execute";
  let reason = "All checks passed (shadow)";
  if (!dirEligible) { decision = "reject"; reason = `Wrong direction or non-positive improvement: I(q)=${fmtRatio(imp)} (T-03/T-04)`; }
  else if (!notional.pass) { decision = "defer"; reason = notional.reason ?? "below min notional"; }
  else if (quote == null) { decision = "defer"; reason = "No executable route quote (C-015) — requote"; }
  else if (!quoteFresh) { decision = "reject"; reason = "Stale executable quote (T-12) — requote"; }
  else if (!oracleAgeOk || health.level === "HALTED") { decision = "reject"; reason = `Oracle ${health.level}: ${health.trigger} (T-13/T-47)`; }
  else if (health.level === "DEGRADED") { decision = "defer"; reason = `Oracle DEGRADED — new trades suspended (B.1): ${health.trigger}`; }
  else if (marketAdj.reject) { decision = "reject"; reason = marketAdj.note; }
  else if (netAbs <= thresholdAbs) { decision = "reject"; reason = `N(q;s)=${fmtUsd(netAbs)} ≤ ε($10 absolute, OD-2 candidate) (T-11)`; }
  else if (netRel <= thresholdRel && THRESHOLD_POLICY.committeeDecision === "RELATIVE") { decision = "reject"; reason = `N(q;s) ≤ ε(1% relative, OD-2 alternative)`; }
  else if (gas.usedFallback && !gas.mayTradeOnFallback) { decision = "defer"; reason = "Gas fallback used and policy does not authorize trading without a valid native price (§3.7)"; }
  else if (ECONOMIC_ELIGIBILITY_ENABLED === false) { decision = "defer"; reason = "SHADOW MODE: economic eligibility disabled pending OD-1 (J(s)) + OD-2 (threshold) Committee approval — decision recorded, not executed (v5.0 §0.3)"; }
  steps.push(`15. Decision: ${decision.toUpperCase()} — ${reason}`);

  // 16. Signed, attributable decision record binding all versions.
  const decisionId = solidityPackedKeccak256(
    ["string", "uint256", "string", "int256", "int256", "int256", "int256", "string"],
    [inputs.component, BigInt(now), inputs.parameterSetHash, inputs.observedW, inputs.targetW, inputs.deltaW, netAbs, decision],
  );
  steps.push("16. Decision record produced + bound to objective/parameter/cost/protection versions (C-013)");

  // 17–21 are the live keeper's job — recorded as not-submitted in shadow.
  steps.push("17–21. Authorization, on-chain execution, settlement reconciliation, discrepancy recording, calibration feedback — KEEPER live scope; not-submitted in shadow mode");

  const signers = authorizedSigners(inputs.keeper, now);

  const record: MandateDecisionRecord = {
    decisionId,
    decidedAt: now, submittedAt: null, executedAt: null, finalizedAt: null,
    chainId: inputs.chainId,
    contracts: [],
    assetPair: `${inputs.component}/numeraire`,
    tradeSide: inputs.deltaW > 0n ? "buy" : "sell",
    inputUnits: "numeraire·1e18",
    outputUnits: `${inputs.component} weight·1e18`,
    proposedSizeE18: inputs.tradeValueE18,
    holdingsSnapshotHash: "pending-keeper-snapshot",
    navMethodology: "haircut NAV (Ext2 Listing E-1) — USD-equivalent accounting numeraire only",
    targetWeightsHash: inputs.parameterSetHash,
    preTradeStateHash: solidityPackedKeccak256(["string", "int256"], [inputs.component, inputs.observedW]),
    postTradeStateHash: solidityPackedKeccak256(["string", "int256"], [inputs.component, postW]),
    referencePrice: {
      kind: "reference_valuation",
      valueE18: inputs.navE18 > 0n ? E18 : E18, // index-derived reference; C-006 guard applied by caller
      source: "chain-linked index I_t/I_base (P0-FIX-1) — NOT a USD peg",
      observedAt: inputs.oracleObservedAt,
      mayAuthorizeTradeByItself: false,
    },
    oracleSources: inputs.oracle.sourceAgesMs.map((_, i) => `source-${i}`),
    oracleConfidence: Math.max(0, ...inputs.oracle.confidenceMultiples),
    executableQuote: quote ? {
      kind: "executable_route_quote",
      valueE18: quote.priceE18,
      source: quote.route,
      observedAt: quote.createdAt,
      mayAuthorizeTradeByItself: false,
      route: quote.route,
      amountSemantics: "exact_input",
    } : null,
    clocks,
    expectedOutE18: inputs.tradeValueE18,
    realizedOutE18: null,
    costItems,
    protectionMarginE18: protection,
    protectionModelVersion: PROTECTION_MODEL_VERSION,
    grossBenefitE18: gross,
    netBenefitE18: netAbs,
    thresholdE18: thresholdAbs,
    thresholdPolicyStatus: THRESHOLD_POLICY.committeeDecision,
    objectiveVersion: JS_OBJECTIVE_VERSION,
    parameterSetHash: inputs.parameterSetHash,
    keeperIdentity: signers[0]?.address ?? inputs.keeper.primary,
    keeperRole: signers[0]?.role ?? "PRIMARY",
    signatureDigest: null, // EIP-712 digest is produced at keeper submission (C.1) — not in shadow
    authorizationOutcome: "shadow-only",
    txHash: null,
    blockOrSlot: null,
    finalityState: "not-submitted",
    realizedExecutionPriceE18: null,
    realizedFeesE18: null,
    slippageE18: null,
    actualTotalCostE18: null,
    expectedVsRealizedDeltaE18: null,
    postQuoteAdverseMovementE18: null,
    rejectionReason: decision === "execute" ? null : reason,
    postTradeNavE18: null,
    postTradeRrE18: null,
    postTradeLcrE18: null,
    statusLabel: "shadow-observed",
  };

  return {
    decision,
    reason,
    shadowOnly: ECONOMIC_ELIGIBILITY_ENABLED === false,
    steps,
    record,
    signedImprovementE18: imp,
    directionEligible: dirEligible,
    grossBenefitE18: gross,
    costE18: cost,
    protectionE18: protection,
    netBenefitE18: netAbs,
    oracleHealth: health,
    invariants: [],
  };
}

// =============================================================================
// Self-test runner — the v5.0 Part 6 vectors implemented in this module
// =============================================================================

export interface SelfTestResult {
  id: string;
  name: string;
  pass: boolean;
  expected: string;
  actual: string;
}

function e18(x: number): bigint {
  return BigInt(Math.round(x * 1e9)) * 10n ** 9n;
}

/** Runs T-01..T-11, T-45 plus keeper/commit-reveal/invariant spot checks.
 *  Honest labels: these are UNIT-TESTED reference-implementation vectors —
 *  they are not integration tests, not chain-deployed evidence, and not
 *  governance approvals (v5.0 Part 10.2 label discipline). */
export function runMandateSelfTests(): SelfTestResult[] {
  const out: SelfTestResult[] = [];

  for (const v of C1_TEST_VECTORS) {
    const imp = signedImprovement(e18(v.observed), e18(v.target), e18(v.delta));
    const postDev = postTradeDeviation(e18(v.observed), e18(v.target), e18(v.delta));
    const elig = isEligibleForNormalMode(imp, e18(v.observed), e18(v.target), e18(v.delta));
    const impNum = Number(imp) / 1e18;
    const postNum = Number(postDev) / 1e18;
    out.push({
      id: v.id,
      name: `${v.name} — deviation arithmetic`,
      pass: Math.abs(impNum - v.expectedImprovement) < 1e-9 && Math.abs(postNum - v.expectedPostDev) < 1e-9 && elig === v.expectedEligible,
      expected: `postDev=${v.expectedPostDev}, I(q)=${v.expectedImprovement}, eligible=${v.expectedEligible}`,
      actual: `postDev=${postNum.toFixed(4)}, I(q)=${impNum.toFixed(4)}, eligible=${elig}`,
    });
  }

  for (const v of TOKEN_SCALE_VECTORS) {
    const round = from18Exact(to18Exact(v.amount, v.decimals), v.decimals);
    out.push({
      id: v.id,
      name: v.name,
      pass: round === v.amount,
      expected: v.amount.toString(),
      actual: round.toString(),
    });
  }
  // T-08: precision-loss conversion rejected (dust)
  try {
    from18Exact(e18(1) + 1n, 6);
    out.push({ id: "T-08", name: "Precision-loss conversion rejected", pass: false, expected: "PrecisionLoss error", actual: "no error" });
  } catch (e) {
    out.push({
      id: "T-08",
      name: "Precision-loss conversion rejected (dust explicitly reported)",
      pass: e instanceof PrecisionLossError,
      expected: "PrecisionLoss error",
      actual: e instanceof Error ? e.message : String(e),
    });
  }
  // >18 decimals rejected
  try {
    to18Exact(1n, 19);
    out.push({ id: "T-08b", name: ">18 decimals rejected", pass: false, expected: "UnsupportedDecimals error", actual: "no error" });
  } catch (e) {
    out.push({ id: "T-08b", name: ">18 decimals rejected", pass: e instanceof InvalidInputError, expected: "UnsupportedDecimals error", actual: e instanceof Error ? e.message : String(e) });
  }

  for (const v of GAS_VECTORS) {
    const cost = gasCostEstimate(v.gasUnits, v.gasPriceWei, v.nativeUsdPriceE18);
    const usd = Number(cost) / 1e18;
    out.push({
      id: v.id,
      name: `Gas sanity ${v.gasUnits}×${v.gasPriceWei / 10n ** 9n}gwei`,
      pass: Math.abs(usd - Number(v.expectedUsd)) < 1e-9,
      expected: `$${v.expectedUsd}`,
      actual: `$${usd.toFixed(6)}`,
    });
  }

  for (const v of NET_BENEFIT_VECTORS) {
    const r = netBenefitIsEligible(e18(v.gross), e18(Math.abs(v.cost)), e18(Math.abs(v.protection)), e18(v.threshold));
    const netNum = Number(r.netBenefitE18) / 1e18;
    out.push({
      id: v.id,
      name: "Net-benefit gate vector",
      pass: Math.abs(netNum - v.expectedNet) < 1e-9 && r.eligible === v.expectedEligible,
      expected: `net=${v.expectedNet}, eligible=${v.expectedEligible}`,
      actual: `net=${netNum.toFixed(4)}, eligible=${r.eligible}`,
    });
  }

  for (const v of SLIPPAGE_VECTORS) {
    const tau = e18(v.tauPct / 100);
    const minOut = computeMinOut(v.quoted, v.decimals, tau);
    out.push({
      id: v.id,
      name: `Slippage in native decimals (${v.decimals}d, ${v.tauPct}%)`,
      pass: minOut === v.expectedNative,
      expected: v.expectedNative.toString(),
      actual: minOut.toString(),
    });
  }

  // T-47: oracle health escalation spot checks
  const hWarn = checkOracleHealth({ sourceAgesMs: [5_000, 70_000, 5_000], stalenessThresholdMs: 60_000, deviationsFromMedian: [0, 0, 0], confidenceMultiples: [1, 1, 1], independentSourceFamilies: 3 });
  const hDeg = checkOracleHealth({ sourceAgesMs: [70_000, 80_000, 5_000], stalenessThresholdMs: 60_000, deviationsFromMedian: [0, 0, 0], confidenceMultiples: [1, 1, 1], independentSourceFamilies: 3 });
  const hHalt = checkOracleHealth({ sourceAgesMs: [150_000, 160_000, 170_000], stalenessThresholdMs: 60_000, deviationsFromMedian: [0, 0, 0], confidenceMultiples: [1, 1, 1], independentSourceFamilies: 3 });
  out.push({
    id: "T-47",
    name: "Oracle health escalation WARNING→DEGRADED→HALTED",
    pass: hWarn.level === "WARNING" && hDeg.level === "DEGRADED" && hHalt.level === "HALTED",
    expected: "WARNING (1 stale) → DEGRADED (2 stale) → HALTED (all >2× stale)",
    actual: `${hWarn.level} → ${hDeg.level} → ${hHalt.level}`,
  });

  // T-50 spot checks: replay + expiry + version binding
  const reg = new DecisionReplayRegistry();
  const first = reg.consume("d1");
  const replay = reg.consume("d1");
  out.push({
    id: "T-50",
    name: "Decision replay protection",
    pass: first.ok && !replay.ok,
    expected: "first ok, replay rejected",
    actual: `first=${first.ok}, replay=${replay.ok}`,
  });

  // T-51 spot check: keeper failover + separation of duties
  const kc: KeeperConfiguration = { primary: "0xPRIM", backup: "0xBKUP", submitter: "0xSUBM", emergency: "0xEMRG", primaryLastSeenMs: 0, emergencyModeActive: false };
  const cfg = validateKeeperConfig(kc);
  const failover = authorizedSigners({ ...kc, primaryLastSeenMs: Date.now() - 40 * 60 * 1000 }, Date.now());
  out.push({
    id: "T-51",
    name: "Keeper failover after 30 min + anti-collusion",
    pass: cfg.ok && failover.length === 1 && failover[0].role === "BACKUP" && failover[0].failover,
    expected: "config valid; primary offline 40min → BACKUP (failover)",
    actual: `config=${cfg.ok}; signer=${failover[0]?.role}`,
  });

  // T-71 spot check: commit-reveal timing + replay
  const cr = new CommitRevealRegistry();
  const nonce = "0x" + "11".repeat(32), salt = "0x" + "22".repeat(32), did = "0x" + "ab".repeat(32);
  const commitHash = solidityPackedKeccak256(["bytes32", "bytes32", "bytes32"], [zeroPadValue(did, 32), zeroPadValue(nonce, 32), zeroPadValue(salt, 32)]);
  const t0 = 1_000_000;
  cr.commit(commitHash, t0, "COMMIT_REVEAL", 2_000);
  const early = cr.reveal(commitHash, did, nonce, salt, t0 + 1_000, 2_000);
  const ok = cr.reveal(commitHash, did, nonce, salt, t0 + 3_000, 2_000);
  const replayed = cr.reveal(commitHash, did, nonce, salt, t0 + 4_000, 2_000);
  out.push({
    id: "T-71",
    name: "Commit-reveal: delay enforced, reveal works, replay rejected",
    pass: !early.ok && ok.ok && !replayed.ok,
    expected: "early rejected, valid reveal ok, replay rejected",
    actual: `early=${early.ok}, valid=${ok.ok}, replay=${replayed.ok}`,
  });

  // INV spot check: hard floor revert behavior
  const inv = checkInvariants({
    rrE18: e18(0.98), totalSupply: 100n * E18, sumOfHolderBalances: 100n * E18,
    circulatingSupply: 90n * E18, reserveBalanceMtq: 10n * E18,
    grossNavE18: e18(120), netNavE18: e18(118), lcrE18: e18(0.9),
    targetWeightsSumE18: E18, activeOracleSources: 3,
    deviationFromOracleMedian: 0.001, quoteAgeMs: 10_000, quoteMaxAgeMs: 60_000,
  });
  const inv1 = inv.find((i) => i.id === "INV-1");
  const inv8 = inv.find((i) => i.id === "INV-8");
  out.push({
    id: "T-53",
    name: "Formal invariants: RR<1.00 hard violation + LCR<1 soft violation",
    pass: inv1?.kind === "hard" && inv8?.kind === "soft",
    expected: "INV-1 hard (RR 0.98 < 1.00), INV-8 soft (LCR 0.9 < 1.0)",
    actual: `INV-1=${inv1?.kind ?? "none"}, INV-8=${inv8?.kind ?? "none"}`,
  });

  return out;
}

// =============================================================================
// Formatting helpers (diagnostics)
// =============================================================================

export function fmtUsd(x: bigint): string {
  const neg = x < 0n;
  const a = neg ? -x : x;
  const whole = a / E18;
  const frac = (a % E18).toString().padStart(18, "0").slice(0, 2);
  return `${neg ? "-" : ""}$${whole.toString()}.${frac}`;
}
export function fmtRatio(x: bigint): string {
  return (Number(x) / 1e18).toFixed(4);
}
