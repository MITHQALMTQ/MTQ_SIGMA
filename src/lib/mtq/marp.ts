// MTQΣ — MARP (Monetary Adaptive Rebalancing Protocol) v1.0
// Implements §10 of the Master Blueprint: daily calculation vs actual rebalancing,
// urgency test, no-trade zones, cost-benefit gate, partial corrections.
//
// AUDIT-FIX (equation-by-equation audit, F-2/F-6/F-8 + EQ-077..EQ-089 +
// EQ-173/C.3): the decision hierarchy now implements the FULL §11/§10.7 ladder
// instead of the former 6-level advisory approximation:
//
//   Level 1 — Natural flow (§10.7 / Appendix C.3): net CF_{i,t} against the
//             target gap FIRST. TradeNeeded_i = TargetGap_i − CF_{i,t};
//             if the day's flows cover the gap the market trade is zero.
//   Level 2 — No-trade zone (§10.4/§11.8: θ_base 0.75%, 1.5% crisis widening;
//             §10.5 κ-term decomposition published per decision).
//   Level 3 — Urgency test (§10.2, simplified pilot form; U_min floor).
//   Level 4 — Partial correction sizing (§10.6 STATE-DEPENDENT
//             β_{i,t} = clip(β₀ + β₁·U_i − β₂·Î_i, β_min, 1) on the RESIDUAL
//             gap — the constant β=0.50 form was replaced per v2.0 §10.6).
//   Level 5 — Cost-benefit gate (§10.8/§12.8 — legacy ε=$10 HISTORICAL candidate
//             gate, OD-2 OPEN; cost assembly now the §12.7 exact cost model).
//   Level 6 — Thin-liquidity deferral (§11.4: trade ≤ MAX_POOL_FRACTION ×
//             24h pool depth; crisis factor per §11.6; residual deferred).
//   Level 7 — Daily turnover cap (§7.3: 5% of NAV per day).
//   Level 8 — Direction lock (§11.5.3: 24h whipsaw guard) → EXECUTE.
//
// Levels are advisory only until applyMarpRebalance (engine.ts) enforces the
// same constraints at execution time (defense in depth). Only Level-8
// decisions carry shouldTrade=true.
//
// v2.0 Task 8-b additions (blueprint-v2.0.txt line refs in each section):
//   §10.5 dynamic no-trade thresholds (κ-term scaffold, validation-stage),
//   §10.6 state-dependent β, §11.6+§14.5 crisis-mode execution set,
//   §11.7+§15.7+§12.9 canonical event names + engine-internal event records,
//   §12.3.3 per-asset-class slippage tolerances wired into cost/quote logic,
//   §12.7 exact cost model (Appendix-F: GAS_FALLBACK $50 DISABLED),
//   §15.6.1 pre-trade issuer-concentration enforcement helpers.

import type { WeightVector, Component } from "./mase";
import { COMPONENTS } from "./mase";
import { genesisRegistry } from "./registry";
import {
  NO_TRADE_BAND_BASE,
  MIN_PROFITABILITY_USD,
  MARP_BETA,
  MARP_URGENCY_MIN,
  MAX_POOL_FRACTION,
  MAX_DAILY_TURNOVER,
  DIRECTION_LOCK_HOURS,
  SLIPPAGE_TOLERANCES,
  REBALANCE_FEE_BPS,
} from "./blueprint";
import {
  JS_OBJECTIVE_VERSION,
  PROTECTION_MODEL_VERSION,
  THRESHOLD_POLICY,
  signedImprovement,
  isEligibleForNormalMode,
  grossBenefit,
  protectionMargin,
  netBenefitIsEligible,
  type JsState,
} from "./mandate";

function toE18(x: number): bigint {
  return BigInt(Math.round(x * 1e9)) * 10n ** 9n;
}
function fromE18(x: bigint): number {
  return Number(x) / 1e18;
}

/** The hierarchy level at which a decision is executable (Level 8 — EXECUTE). */
export const MARP_EXECUTE_LEVEL = 8;

// =============================================================================
// §12.3.3 Per-asset-class slippage tolerances — WIRED (Task 8-b gap 1)
// Blueprint v2.0 lines 6949–6978: tolerances are per asset class, reflecting
// liquidity depth and typical spread; governed parameters of the execution
// contract (Risk Council 4/7, 24h timelock, parameter-registry process).
//   Stablecoins (USDC, EURC)  τ_sell = τ_buy = 0.5%  — highly liquid
//   Tokenized Gold (PAXG)      τ_sell = τ_buy = 1.0%  — lower liquidity
//   Minor FX (JPY, CNY)        τ_sell = τ_buy = 1.5%  — thin liquidity
// "In crisis mode the tolerances themselves do not widen; instead execution
//  sizes shrink and liquidity requirements rise" (§12.3.3, line ~6976).
// =============================================================================
export type MarpAssetClass = "STABLECOIN" | "GOLD" | "MINOR_FX";

/** §12.3.3 class of a MARP component. GBP/CHF are NOT enumerated in the v2.0
 *  tolerance table (only Stablecoins / Tokenized Gold / Minor FX (JPY, CNY)
 *  appear); the conservative widest class (MINOR_FX 1.5%) is applied pending
 *  Risk-Council classification — disclosed, never silent. */
export function assetClassFor(component: string): MarpAssetClass {
  if (component === "Gold") return "GOLD";
  if (component === "USD" || component === "EUR") return "STABLECOIN";
  return "MINOR_FX"; // JPY, CNY (per table) + GBP, CHF (conservative pending classification)
}

/** §12.3.3 — the per-class tolerance τ (τ_sell = τ_buy for every class in the
 *  v2.0 table; the two-sided bounds of §12.3.1/§12.3.2 apply it per side). */
export function slippageToleranceFor(assetClass: MarpAssetClass): number {
  switch (assetClass) {
    case "STABLECOIN": return SLIPPAGE_TOLERANCES.STABLECOIN;
    case "GOLD": return SLIPPAGE_TOLERANCES.GOLD;
    case "MINOR_FX": return SLIPPAGE_TOLERANCES.MINOR_FX;
  }
}

// =============================================================================
// §12.7 Gas Estimation and Cost Control — EXACT v2.0 cost model (Task 8-b gap 2)
// Blueprint lines 7145–7187:
//   Gas Price   = oracleGasPrice × 1.2   (20% buffer)
//   Gas Units   = estimatedGas   × 1.1   (10% buffer for L2 variance)
//   Slippage    = tradeValue × (τ / 2)  (half of max slippage for estimation)
//   Router Fee  = tradeValue × 0.001     (0.1% aggregator fee)
//   EstimatedCost = (gasPrice × gasUnits) + slippage + routerFee
// Appendix F (lines 22140–22152) — CONTROLLING on gas: "The earlier
// GAS_FALLBACK value of $50 is a monetary-cost illustration, not a gas price.
// It must never be returned by a function that claims to return wei per gas.
// If the chain's base fee is zero or unavailable and no approved fresh
// gas-price source exists, the normal-mode trade must be rejected or deferred
// unless an explicitly approved conservative fallback policy authorizes an
// accounting-cost estimate. Such a fallback must be recorded with its source,
// value, reason, approved policy version, and effect on eligibility."
//
// The shadow pilot has NO live gas-price oracle feed. Per Appendix F the
// sanctioned path is therefore a RECORDED accounting-cost estimate — never a
// gas price. The basis is the blueprint's own Appendix-F P0-3 sanity-check
// reference (150,000 gas × 30 gwei × $3,000/native = $13.50; the same vector
// is registered as T-09 in mandate.ts GAS_VECTORS), buffered exactly per
// §12.7: $13.50 × 1.2 × 1.1 = $17.82 per trade.
// =============================================================================
export const GAS_COST_MODEL = {
  // §12.7 buffers (operative text):
  priceBuffer: 1.2, // gasPrice = oracleGasPrice × 1.2
  unitsBuffer: 1.1, // gasUnits = estimatedGas × 1.1
  // Recorded accounting-cost fallback (Appendix-F P0-3 required record):
  basisUsd: 13.5, // 150,000 gas × 30 gwei × $3,000/native (Appendix-F sanity check A / T-09)
  routerFeeRate: 0.001, // 0.1% aggregator fee (§12.7 Router Fee)
  get perTradeUsd(): number {
    return this.basisUsd * this.priceBuffer * this.unitsBuffer; // $17.82
  },
  status: "ACCOUNTING-COST ESTIMATE (Appendix-F P0-3) — GAS_FALLBACK $50 DISABLED, never a gas price",
  source: "Appendix-F P0-3 sanity-check reference (150,000 gas × 30 gwei × $3,000/native = $13.50; mandate.ts T-09 vector)",
  reason: "No live gas-price oracle feed exists in the shadow pilot; the flat $50 legacy value is withdrawn as a cost term per Appendix F",
  policyVersion: "pilot-accounting-fallback-v1 (recorded per Appendix-F P0-3: source, value, reason, policy version, effect on eligibility)",
  effectOnEligibility: "Raises EstimatedCost on every gated trade; NetBenefit ≤ EstimatedCost ⇒ the trade is suppressed (§12.7 double test)",
} as const;

export interface ExecutionCostEstimate {
  gasUsd: number;        // §12.7 (gasPrice × 1.2) × (gasUnits × 1.1), accounting basis
  slippageUsd: number;   // §12.7 tradeValue × (τ_class / 2) — the half-τ term
  routerFeeUsd: number;  // §12.7 tradeValue × 0.001 (0.1% aggregator fee)
  protocolFeeUsd: number; // §20.4 rebalancing fee 0.20% — §10.8 Fees_i includes "protocol fees on the leg"
  totalUsd: number;
  halfTau: number;       // τ_class / 2 actually applied
  assetClass: MarpAssetClass;
  gasBasis: typeof GAS_COST_MODEL.status;
}

/** §12.7 exact cost assembly. `tradeUsd` is the candidate trade value in the
 *  approved accounting numeraire (USD); `assetClass` selects the §12.3.3 τ. */
export function estimateExecutionCost(
  tradeUsd: number,
  assetClass: MarpAssetClass,
): ExecutionCostEstimate {
  const halfTau = slippageToleranceFor(assetClass) / 2;
  const gasUsd = GAS_COST_MODEL.perTradeUsd;
  const slippageUsd = tradeUsd * halfTau;
  const routerFeeUsd = tradeUsd * GAS_COST_MODEL.routerFeeRate;
  const protocolFeeUsd = tradeUsd * (REBALANCE_FEE_BPS / 10_000);
  return {
    gasUsd,
    slippageUsd,
    routerFeeUsd,
    protocolFeeUsd,
    totalUsd: gasUsd + slippageUsd + routerFeeUsd + protocolFeeUsd,
    halfTau,
    assetClass,
    gasBasis: GAS_COST_MODEL.status,
  };
}

// =============================================================================
// §11.7 + §12.9 + §15.7 — Canonical event names, canonical skip-reason enums,
// and the engine-internal event log (Task 8-b gap 5).
//
// §11.7 (lines 5613–5658): "Every MARP decision — executed or declined — emits
// a structured event." Event set of Listing 4:
//   RebalanceExecuted  (timestamp, deviation, amount, estimatedCost)
//   RebalanceSkipped   (timestamp, deviation, reason)
//   DailyTurnoverReset (timestamp, previousTurnover)
//   GoldSold / GoldBought (amount, output, execPrice)
//   SlippageWarning    (tradeType, oraclePrice, execPrice, timestamp)
// Skip reasons are enumerable by design: 'No-trade zone' (§10.4), 'Direction
// lock' (§11.5.3), 'Net benefit not positive' (§10.8) and the turnover/
// liquidity truncations.
// §12.9 adds TradeExecuted / TradeSkipped; §15.7 adds the registry set
// (AssetAdded / AssetStateChanged / AssetRemoved / AssetUpdated).
//
// SHADOW-MODE NOTE: the app runs in shadow mode — these "events" are
// ENGINE-INTERNAL AUDIT-LOG RECORDS, not on-chain events. Each record carries
// shadow:true so no consumer can mistake them for contract emissions.
// =============================================================================
export type CanonicalEventName =
  | "RebalanceExecuted"
  | "RebalanceSkipped"
  | "DailyTurnoverReset"
  | "GoldSold"
  | "GoldBought"
  | "SlippageWarning"
  | "TradeExecuted"
  | "TradeSkipped"
  | "AssetAdded"
  | "AssetStateChanged"
  | "AssetRemoved"
  | "AssetUpdated";

/** Canonical skip-reason enum (§11.7). The first five are the §11.7 canonical
 *  set verbatim; the remainder are labeled pilot-ladder extensions mapping
 *  §10.2/§10.6/§10.7 and the Task-8-b pre-trade blocks to the enum space. */
export type CanonicalSkipReason =
  | "No-trade zone" // §11.7/§10.4
  | "Direction lock" // §11.7/§11.5.3
  | "Net benefit not positive" // §11.7/§10.8
  | "Liquidity cap" // §11.7 truncation (§11.4 pool-depth deferral)
  | "Turnover cap" // §11.7 truncation (§11.5.2 daily turnover)
  | "Low urgency" // pilot ladder L3 (§10.2)
  | "Natural flow coverage" // pilot ladder L1 (§10.7)
  | "Zero size" // pilot ladder L4 (§10.6)
  | "Concentration cap" // §15.6.1 pre-trade block
  | "LCR repair priority" // §13.4.3 re-route block during an LCR breach
  | "Hold" // non-trade input
  | "NAV ≤ 0"; // degenerate state

export interface EngineEventRecord {
  name: CanonicalEventName;
  ts: number;
  source: "decision" | "execution" | "quote" | "turnover" | "registry";
  /** §-label of the governing spec section. */
  blueprint: string;
  shadow: true;
  payload: Record<string, number | string | boolean | null>;
}

const ENGINE_EVENT_LOG_CAP = 1024;
const engineEventLog: EngineEventRecord[] = [];

/** Emit an engine-internal canonical event record (shadow mode — internal
 *  audit log, NOT an on-chain event). State-changing records (executions,
 *  repairs, resets, blocks) are also printed to the decision log so the
 *  §24.4 audit trail and dev.log carry the same stream. */
export function emitEngineEvent(
  name: CanonicalEventName,
  payload: Record<string, number | string | boolean | null>,
  meta: { source: EngineEventRecord["source"]; blueprint: string; quiet?: boolean },
): EngineEventRecord {
  const rec: EngineEventRecord = {
    name,
    ts: Date.now(),
    source: meta.source,
    blueprint: meta.blueprint,
    shadow: true,
    payload,
  };
  engineEventLog.unshift(rec);
  if (engineEventLog.length > ENGINE_EVENT_LOG_CAP) engineEventLog.length = ENGINE_EVENT_LOG_CAP;
  if (!meta.quiet && typeof console !== "undefined") {
    console.log(
      `[mtq-engine] §11.7 event: ${name} (${meta.blueprint}, shadow) ${JSON.stringify(rec.payload)}`,
    );
  }
  return rec;
}

/** Most recent engine-internal canonical events (newest first). Ephemeral
 *  in-process ring buffer — the DURABLE decision trail is the §24.4 audit rows
 *  (RebalancingDecision persistence) plus the hash-chained audit tables. */
export function getRecentEngineEvents(limit = 64): EngineEventRecord[] {
  return engineEventLog.slice(0, Math.max(0, Math.min(limit, ENGINE_EVENT_LOG_CAP)));
}

// §15.7 (lines 9887–9896): the registry emits four events — AssetAdded
// (currencyCode, tokenAddress, name) on admission; AssetStateChanged
// (currencyCode, newState); AssetRemoved; AssetUpdated. The pilot registry is
// STATIC (genesis-registered; governance admission path not live — registry.ts
// is outside this task's file ownership), so the AssetAdded records are
// replayed ONCE per process from the genesis registry with an explicit replay
// label. AssetStateChanged/AssetRemoved/AssetUpdated fire on governance
// transitions in the registry module — declared here, emitted there.
let registryReplayed = false;
export function replayGenesisRegistryEvents(now = Date.now()): void {
  if (registryReplayed) return;
  registryReplayed = true;
  for (const rec of genesisRegistry(now)) {
    emitEngineEvent(
      "AssetAdded",
      { currencyCode: rec.currencyCode, tokenAddress: rec.tokenAddress, name: rec.name, replay: true },
      {
        source: "registry",
        blueprint: "§15.7 — genesis registry replay (pilot: admissions are static; governance admission path not live)",
        quiet: true,
      },
    );
  }
}

/** Map a MARP ladder level to its canonical skip reason (§11.7 enumeration). */
export function canonicalSkipReasonForLevel(level: number): CanonicalSkipReason {
  switch (level) {
    case 1: return "Natural flow coverage";
    case 2: return "No-trade zone";
    case 3: return "Low urgency";
    case 4: return "Zero size";
    case 5: return "Net benefit not positive";
    case 6: return "Liquidity cap";
    case 7: return "Turnover cap";
    case 8: return "Hold";
    default: return "Hold";
  }
}

// =============================================================================
// §10.5 Dynamic No-Trade Thresholds (blueprint lines 4947–4990) — κ scaffold.
//
// θ_{i,t} = θ_base + κ₁·σ̃_i + κ₂·(1 − L̃_i) + κ₃·Spread̃_i + κ₄·Slippagẽ_i
//
// Each tilde input is normalized to [0,1] against its trailing cross-sectional
// distribution (§4.5 discipline). The κ coefficients are "Risk-Council
// parameters within constitutional envelopes" and §11.8 registers the band as
// "Validation-stage only; not production-authorized" — v2.0 publishes NO
// operative κ values. The scaffold therefore computes every term it has data
// for (σ̃ cross-sectionally across the 7 components) and applies κ = 0 pending
// publication, so θ_dynamic ≡ the deployed band (base 0.75% / crisis 1.5%)
// until the Risk Council publishes the vector. Data gaps (per-component
// liquidity/spread/slippage feeds) are recorded per decision — never silently
// zero-filled as if measured.
// =============================================================================
export const MARP_KAPPA = {
  k1Volatility: 0, // κ₁ — higher volatility widens the band (σ̃ term)
  k2Liquidity: 0, // κ₂ — thinner liquidity widens the band ((1 − L̃) term)
  k3Spread: 0, // κ₃ — wider spreads widen the band
  k4Slippage: 0, // κ₄ — higher expected slippage widens the band
  status: "VALIDATION-STAGE — v2.0 publishes no operative κ values (§10.5/§11.8); zeros are placeholders pending Risk-Council publication, NOT invented calibration",
} as const;

export interface ThetaDecomposition {
  base: number; // θ_base (§11.8) incl. the caller-selected §11.6 crisis widening
  kappaVolatility: number; // κ₁·σ̃_i applied (0 while κ is unpublished)
  kappaLiquidity: number; // κ₂·(1 − L̃_i) applied (data gap recorded)
  kappaSpread: number; // κ₃·Spread̃_i applied (data gap recorded)
  kappaSlippage: number; // κ₄·Slippagẽ_i applied (data gap recorded)
  applied: number; // θ_{i,t} actually used by the §10.4 check
  sigmaTilde: number | null; // cross-sectional normalized volatility, when computable
  crisisWidening: boolean; // §11.6 — Listing 4 doubles the base band in crisis
  dataGaps: string[];
}

/** Cross-sectional min-max normalization of the component volatilities to
 *  [0,1] (the §4.5 discipline referenced by §10.5). Degenerate (all-equal)
 *  inputs normalize to 0 — never NaN. */
export function normalizeCrossSectional(values: Record<Component, number>): Record<Component, number> {
  const vs = COMPONENTS.map((c) => Math.max(0, values[c] ?? 0));
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min;
  const out = {} as Record<Component, number>;
  for (const c of COMPONENTS) out[c] = span > 1e-12 ? (Math.max(0, values[c] ?? 0) - min) / span : 0;
  return out;
}

export function dynamicNoTradeThreshold(
  band: number,
  sigmaTilde: number | null,
  opts?: { liquidityTilde?: number | null; spreadTilde?: number | null; slippageTilde?: number | null },
): ThetaDecomposition {
  const dataGaps: string[] = [];
  const sigmaTerm = sigmaTilde == null ? 0 : MARP_KAPPA.k1Volatility * sigmaTilde;
  if (sigmaTilde == null) dataGaps.push("σ̃: component volatility unavailable");
  const liqTerm = opts?.liquidityTilde == null ? 0 : MARP_KAPPA.k2Liquidity * (1 - opts.liquidityTilde);
  if (opts?.liquidityTilde == null) dataGaps.push("L̃: no per-component 24h-settlement liquidity feed (only the PAXG pool-depth feed exists)");
  const spreadTerm = opts?.spreadTilde == null ? 0 : MARP_KAPPA.k3Spread * opts.spreadTilde;
  if (opts?.spreadTilde == null) dataGaps.push("Spread̃: no per-component venue-spread feed");
  const slipTerm = opts?.slippageTilde == null ? 0 : MARP_KAPPA.k4Slippage * opts.slippageTilde;
  if (opts?.slippageTilde == null) dataGaps.push("Slippagẽ: no per-component slippage-curve feed");
  return {
    base: band,
    kappaVolatility: sigmaTerm,
    kappaLiquidity: liqTerm,
    kappaSpread: spreadTerm,
    kappaSlippage: slipTerm,
    applied: band + sigmaTerm + liqTerm + spreadTerm + slipTerm,
    sigmaTilde,
    crisisWidening: band > NO_TRADE_BAND_BASE + 1e-12,
    dataGaps,
  };
}

// =============================================================================
// §10.6 Partial Rebalancing — STATE-DEPENDENT β (blueprint lines 4990–5029).
//
//   Trade_{i,t} = β_{i,t} × (W_target − W_actual),  0 < β_{i,t} ≤ 1
//   β_{i,t} = clip(β₀ + β₁·U_i − β₂·Î_i, β_min, 1)
//
// "urgency raises the fraction and estimated market impact lowers it, with
//  β_min a constitutional floor that prevents corrections from becoming so
//  partial they never converge." v2.0 publishes the FORM but no coefficient
//  values; the instantiation below is anchored to spec statements:
//   β₀ = MARP_BETA (0.50) — the registered base (PARAMETER_REGISTRY envelope);
//   β₁ = 0.50 — so β → 1.0 at max urgency with zero impact: §10.6 "Level 3
//        risk triggers and Level 5 emergencies are the sanctioned paths to β
//        close to one";
//   β₂ = 0.40 — the impact penalty (validation-stage; a full-pool-cap
//        participation estimate halves a β=0.90 correction);
//   β_min = 0.10 — the PARAMETER_REGISTRY MARP_BETA envelope floor [0.1, 0.9]
//        used as the constitutional-floor anchor.
// All four are labeled validation-stage instantiations pending Risk-Council
// publication (§11.10 "No-trade band … and margin; urgency coefficients" row).
// =============================================================================
export const MARP_BETA_TERMS = {
  beta0: MARP_BETA, // base fraction (registered constant)
  beta1: 0.5, // urgency weight
  beta2: 0.4, // estimated-impact penalty
  betaMin: 0.1, // constitutional floor anchor = PARAMETER_REGISTRY MARP_BETA envelope lower bound
  status: "VALIDATION-STAGE instantiation — v2.0 fixes the §10.6 form, not the coefficients (urgency coefficients are a Risk-Council publication per §11.10)",
} as const;

export interface BetaRecord {
  applied: number; // β_{i,t} actually used
  raw: number; // β₀ + β₁·U − β₂·Î before clipping
  urgency: number;
  impactEstimate: number; // Î_i ∈ [0,1] — normalized participation estimate
  clippedAt: "min" | "max" | null;
}

/** Î_i — normalized participation estimate: the share of the permissable
 *  pool footprint the FULL correction would consume (|residual| against
 *  MAX_POOL_FRACTION × 24h pool depth). 0 when the pool-depth feed is absent
 *  (recorded, not guessed). */
export function impactEstimateFor(
  residualUsd: number,
  poolDepthUsd: number,
): number {
  if (poolDepthUsd <= 0) return 0;
  return Math.max(0, Math.min(1, Math.abs(residualUsd) / (MAX_POOL_FRACTION * poolDepthUsd)));
}

export function stateDependentBeta(urgency: number, impactEstimate: number): BetaRecord {
  const raw = MARP_BETA_TERMS.beta0 + MARP_BETA_TERMS.beta1 * urgency - MARP_BETA_TERMS.beta2 * impactEstimate;
  let clippedAt: BetaRecord["clippedAt"] = null;
  let applied = raw;
  if (applied < MARP_BETA_TERMS.betaMin) {
    applied = MARP_BETA_TERMS.betaMin;
    clippedAt = "min";
  }
  if (applied > 1) {
    applied = 1;
    clippedAt = "max";
  }
  return { applied, raw, urgency, impactEstimate, clippedAt };
}

// === §10.6 legacy pure helper (kept verbatim for back-compat consumers) ====
// Don't correct the full deviation in one trade — correct β of the RESIDUAL
// gap (after §10.7 natural-flow netting). The doc's Appendix C.2 walk-through
// uses β = 0.40 as a worked example; the deployed BASE constant is 0.50 and
// the ACTIVE pipeline now uses the state-dependent form above (§10.6 v2.0).
export function partialCorrection(
  deviation: number,
  correctionFactor: number = MARP_BETA,
): number {
  return deviation * correctionFactor;
}

// =============================================================================
// §11.6 + §14.5 Crisis-mode execution set (lines 5552–5612, 8844–8908) —
// decision outputs of the MARP evaluation (Task 8-b gap 4).
//
// §11.6 table (Normal → Crisis):
//   No-trade band      base dynamic band      → Widened (Listing 4 doubles it)
//   Trade size         liquidity-capped β     → shrunk toward smaller, staged
//   Liquidity req.     10% of 24h pool depth   → raised; deeper-venue requirements
//   Direction lock     24h enforced           → overridable when RR_t < 1.05
//   Oracle confirm.    standard quorum        → increased
//   Objective priority balanced J terms       → reserve preservation over tracking
// §14.5 adds the same five coordinated changes and notes: "The crisis posture
// is entered and exited through the risk-state model of Chapter 21."
// The modulation is one-directional: crisis only makes execution more
// conservative. v2.0 publishes NO operative numbers for the shrink/venue rows
// ("may be reduced", "may increase") — the factors below are labeled pilot
// instantiations of the "may" clauses, pending Risk-Council publication.
// Pilot mapping: CrisisScore_t (§5.5) is symbolic (disclosed in
// honest-status D-regime-classifier); the crisis posture is mapped to the
// canonical risk state (STRESS/DEFENSIVE/EMERGENCY) — the same mechanical
// trigger the caller already uses to double the band (§11.6/Listing 4).
// =============================================================================
export const CRISIS_EXECUTION_SET = {
  bandWideningFactor: 2, // §11.6 — Listing 4 doubles the base band (NO_TRADE_BAND_STRESS at the caller)
  sizeShrinkFactor: 0.5, // §11.6/§14.5 "execution size may be reduced" — pilot instantiation
  poolFractionFactor: 0.5, // §11.6 "liquidity requirements may increase" — pilot instantiation (10% → 5% of depth)
  venueRequirement: "DEEP-VENUE-ONLY", // §11.6/§14.5 — only deeper venues qualify
  objectivePriority: "RESERVE-PRESERVATION", // §14.5 — preservation over tracking fidelity
  status: "PILOT instantiation of the §11.6/§14.5 'may' clauses — v2.0 publishes no operative shrink/venue numbers; Risk-Council publication pending (§11.10)",
} as const;

export interface CrisisModeRecord {
  active: boolean;
  sizeShrinkFactor: number;
  poolFractionFactor: number;
  venueRequirement: string;
  objectivePriority: string;
  note: string;
}

// =============================================================================
// §15.6.1 Issuer-concentration PRE-TRADE enforcement helpers (lines 9768–9796,
// Task 8-b gap 7). "Enforcement happens before execution, not after: the
// Rebalancing Engine checks this constraint before executing any trade that
// would increase exposure to an issuer that already exceeds 25% of the
// reserve, and any trade that would breach 30% is blocked outright. The 25%
// soft checkpoint and 30% hard block create a warning band in which
// accumulation is possible only in the direction of reduction. A 4-of-7 Risk
// Council vote can temporarily raise the limit to 35% during a liquidity
// crisis" (24h timelock + disclosure).
// Pilot issuer mapping (registry.ts): CIRCLE = USDC + EURC · PAXOS = USDP +
// PAXG · TETHER = USDT + XAUT. GBP/JPY/CNY/CHF instruments are TBD-issuer —
// no mapped-issuer exposure to check (recorded as a data note, not a pass).
// =============================================================================
export type IssuerId = "CIRCLE" | "PAXOS" | "TETHER";

export interface IssuerShares {
  CIRCLE: number;
  PAXOS: number;
  TETHER: number;
}

export interface IssuerHoldings {
  usdcUsd: number;
  usdpUsd: number;
  usdtUsd: number;
  eurcUsd: number;
  paxgUsd: number;
  xautUsd: number;
  nav: number;
}

export function issuerSharesFrom(h: IssuerHoldings): IssuerShares {
  const nav = h.nav > 0 ? h.nav : 1;
  return {
    CIRCLE: (h.usdcUsd + h.eurcUsd) / nav,
    PAXOS: (h.usdpUsd + h.paxgUsd) / nav,
    TETHER: (h.usdtUsd + h.xautUsd) / nav,
  };
}

/** §15.6.1 warning-band rule on a single acquiring issuer:
 *   blocked iff (pre > warnCap) && (post > pre)  — accumulation toward an
///  over-checkpoint issuer — or iff post > hardCap (outright block). */
export function issuerAcquisitionBlocked(
  issuer: IssuerId,
  pre: IssuerShares,
  acquireUsd: number,
  nav: number,
  warnCap: number,
  hardCap: number,
): { blocked: boolean; pre: number; post: number; reason: CanonicalSkipReason | null } {
  if (acquireUsd <= 0 || nav <= 0) return { blocked: false, pre: pre[issuer], post: pre[issuer], reason: null };
  const postShare = pre[issuer] + acquireUsd / nav;
  if (postShare > hardCap) {
    return { blocked: true, pre: pre[issuer], post: postShare, reason: "Concentration cap" };
  }
  if (pre[issuer] > warnCap && postShare > pre[issuer]) {
    return { blocked: true, pre: pre[issuer], post: postShare, reason: "Concentration cap" };
  }
  return { blocked: false, pre: pre[issuer], post: postShare, reason: null };
}

/** Water-fill an USD-stablecoin acquisition across USDC/USDP/USDT so that the
 *  receiving issuers equalize (minimizing the maximum post-trade share) while
 *  issuers ALREADY above the 25% checkpoint receive NOTHING (the §15.6.1
 *  warning band allows accumulation only in the direction of reduction).
 *  Returns null when no routing can respect the caps — INCLUDING the all-
 *  issuers-over-checkpoint corner: when every issuer already exceeds the 25%
 *  soft checkpoint, ANY acquisition increases an over-checkpoint issuer's
 *  exposure, which §15.6.1 forbids outright ("accumulation is possible only
 *  in the direction of reduction"). There is then no admissible routing and
 *  the trade is blocked — the residual re-enters tomorrow's evaluation
 *  (§12.4 staged execution). */
export function routeStablecoinAcquisition(
  pre: IssuerShares,
  amountUsd: number,
  nav: number,
  warnCap: number,
  hardCap: number,
): { usdc: number; usdp: number; usdt: number } | null {
  if (amountUsd <= 0) return { usdc: 0, usdp: 0, usdt: 0 };
  const candidates: { issuer: IssuerId; share: number }[] = [
    { issuer: "CIRCLE", share: pre.CIRCLE },
    { issuer: "PAXOS", share: pre.PAXOS },
    { issuer: "TETHER", share: pre.TETHER },
  ];
  const pool = candidates.filter((c) => c.share <= warnCap);
  if (pool.length === 0) return null; // §15.6.1: no issuer may receive while over the checkpoint
  // Water-fill to equalized post shares: x = (Σ share_i·nav + amount) / (n·nav)
  const totalPreUsd = pool.reduce((a, c) => a + c.share * nav, 0);
  const equalizedShare = (totalPreUsd + amountUsd) / (pool.length * nav);
  if (equalizedShare > hardCap) {
    // Even the most even split breaches the hard cap — cannot route.
    return null;
  }
  const alloc: Record<IssuerId, number> = { CIRCLE: 0, PAXOS: 0, TETHER: 0 };
  for (const c of pool) {
    const targetUsd = equalizedShare * nav - c.share * nav;
    alloc[c.issuer] = Math.max(0, targetUsd);
  }
  // Numerical tidy-up: absorb rounding remainder into the largest allocation.
  const sum = alloc.CIRCLE + alloc.PAXOS + alloc.TETHER;
  if (sum > 0 && Math.abs(sum - amountUsd) > 1e-6) {
    const largest = (["CIRCLE", "PAXOS", "TETHER"] as IssuerId[]).reduce((a, b) => (alloc[a] >= alloc[b] ? a : b));
    alloc[largest] += amountUsd - sum;
  }
  return { usdc: alloc.CIRCLE, usdp: alloc.PAXOS, usdt: alloc.TETHER };
}

/** Water-fill a gold acquisition across PAXG (PAXOS) / XAUT (TETHER) under the
 *  same §15.6.1 warning-band discipline as routeStablecoinAcquisition — over-
 *  checkpoint issuers receive NOTHING; if BOTH gold issuers already exceed
 *  the 25% checkpoint there is no admissible routing (block, §15.6.1). */
export function routeGoldAcquisition(
  pre: IssuerShares,
  amountUsd: number,
  nav: number,
  warnCap: number,
  hardCap: number,
): { paxg: number; xaut: number } | null {
  if (amountUsd <= 0) return { paxg: 0, xaut: 0 };
  const candidates: { issuer: IssuerId; share: number }[] = [
    { issuer: "PAXOS", share: pre.PAXOS },
    { issuer: "TETHER", share: pre.TETHER },
  ];
  const pool = candidates.filter((c) => c.share <= warnCap);
  if (pool.length === 0) return null; // §15.6.1: no issuer may receive while over the checkpoint
  const totalPreUsd = pool.reduce((a, c) => a + c.share * nav, 0);
  const equalizedShare = (totalPreUsd + amountUsd) / (pool.length * nav);
  if (equalizedShare > hardCap) return null;
  const alloc: Record<IssuerId, number> = { CIRCLE: 0, PAXOS: 0, TETHER: 0 };
  for (const c of pool) {
    alloc[c.issuer] = Math.max(0, equalizedShare * nav - c.share * nav);
  }
  const sum = alloc.PAXOS + alloc.TETHER;
  if (sum > 0 && Math.abs(sum - amountUsd) > 1e-6) {
    const largest = alloc.PAXOS >= alloc.TETHER ? "PAXOS" : "TETHER";
    alloc[largest] += amountUsd - sum;
  }
  return { paxg: alloc.PAXOS, xaut: alloc.TETHER };
}

// === §10.1 Daily Calculation vs Actual Rebalancing ===
// Calculate every day but trade only on justified urgency (Invariant I11:
// continuously recalculated ≠ continuously traded).

// === §10.2 Rebalancing Urgency — SIMPLIFIED PILOT SUBSTITUTE (RG-15 label) ===
// Urgency = f(deviation, reserveRatio, volatility). The blueprint's §10.2
// function with coefficients a–e is SYMBOLIC (validation-stage); the pilot's
// form below is a disclosed substitute ("Simplified pilot"), NOT canonical:
//   devUrgency  = min(1, |dev| / 5%)
//   rrUrgency   = (1.10 − RR)/0.10 when RR < 1.10 (else 0)
//   volFactor   = 1 − min(0.5, vol×2)   (high vol → hold, don't chase)
// The U_min = 0.05 floor is likewise a pilot constant (MARP_URGENCY_MIN,
// registered in PARAMETER_REGISTRY).
export function computeUrgency(
  deviation: number,      // |observed - target| weight deviation (signed input tolerated)
  reserveRatio: number,  // current RR
  volatility: number,     // component volatility
): number {
  // Base urgency from deviation MAGNITUDE — symmetric for over- and
  // underweight legs (§10.2; AUDIT-FIX: the former signed form clamped
  // underweight urgency to 0 whenever RR ≥ 1.10, permanently holding
  // underweight corrections at Level 3 — the doc contract always said
  // "|observed − target|").
  const devUrgency = Math.min(1, Math.abs(deviation) / 0.05); // 5% deviation = max urgency
  // Reserve ratio urgency (lower RR = more urgent)
  const rrUrgency = reserveRatio < 1.10 ? (1.10 - reserveRatio) / 0.10 : 0;
  // Volatility penalty (high vol = less urgent to trade, more urgent to hold)
  const volFactor = 1 - Math.min(0.5, volatility * 2);
  return Math.max(0, Math.min(1, (devUrgency + rrUrgency) * volFactor));
}

// === §10.4 No-Trade Zone (§11.8 band constants) ===
// If deviation is below the no-trade threshold, don't trade.
// θ_base = 0.75% (§11.8 / Listing 4 noTradeBand — validation-stage);
// the band widens to 1.5% under crisis (§11.6 — Listing 4 doubles the base
// band when the crisis oracle exceeds its threshold). The §10.5 κ-terms are
// layered on top via dynamicNoTradeThreshold() in marpDecision.
export function inNoTradeZone(
  deviation: number,
  threshold: number = NO_TRADE_BAND_BASE, // 0.75% base band (§11.8)
): boolean {
  // §10.4: "Trade_i = 0 if D_i,t ≤ θ_i,t" — the boundary itself is inside the
  // zone (D == θ does not trade). v2.0-FIX: the former strict `<` traded at
  // exactly D = θ; `≤` restores the Listing 4 contract-level check.
  return Math.abs(deviation) <= threshold;
}

// === §10.8 Cost-Benefit Gate (with §12.8 minimum profitability) — RG-10 ===
// Trade only if expected benefit exceeds estimated cost by the ε margin.
// COST ASSEMBLY (Task 8-b): the §12.7 exact cost model — half-τ slippage
// (§12.3.3 per-class τ), 0.1% router fee, §20.4 protocol fee, and the
// buffered gas accounting estimate (Appendix-F P0-3; the legacy flat $50 is
// withdrawn as a cost term).
// BENEFIT/ε NOTE (Appendix F.5): the legacy λ₁-weighted benefit form and the
// ε=$10 absolute margin are HISTORICAL CANDIDATES (OD-2 OPEN — $10 vs the 1%
// baseline conflict unresolved; "neither is an operative default" and
// normal-mode economic execution remains disabled). The controlling candidate
// (Appendix-F protected gate N(q;s)=G−C−B_time>ε(q)) runs in SHADOW on every
// decision via the mandate block. Signature kept back-compat: positional
// slippage/gas overrides still pin explicit values (worked-example vectors).
export function costBenefitGate(
  deviation: number,
  nav: number,
  tradeUsd: number,
  slippageOrOpts?: number | { assetClass?: MarpAssetClass },
  gasCost?: number,
): { pass: boolean; benefit: number; cost: number; netBenefit: number; estimate?: ExecutionCostEstimate } {
  const benefit = Math.abs(deviation) * nav * 0.4; // λ₁-weighted deviation value (§10.9 J term)
  let estimate: ExecutionCostEstimate | undefined;
  let cost: number;
  if (typeof slippageOrOpts === "number") {
    // Legacy positional form (explicit slippage fraction + optional gas):
    cost = tradeUsd * slippageOrOpts + (gasCost ?? GAS_COST_MODEL.perTradeUsd);
  } else {
    // §12.7 exact cost model (default path — per-asset-class τ/2 + fees).
    const assetClass = slippageOrOpts?.assetClass ?? "GOLD";
    estimate = estimateExecutionCost(tradeUsd, assetClass);
    cost = estimate.totalUsd;
  }
  const netBenefit = benefit - cost;
  return { pass: netBenefit > MIN_PROFITABILITY_USD, benefit, cost, netBenefit, estimate };
}

// === §10.7 Natural-Flow Netting (Level 1 — Appendix C.3) =====================
// TradeNeeded_(i) = TargetGap_(i) − CF_(i,t) ;  Trade_(i) = f(TradeNeeded_(i))
//
// CF_{i,t} is the SIGNED net natural flow into component i since the last
// rebalance (mint inflows delivered in basket proportions, redemption
// outflows, fee accruals — measured by the engine, never assumed). Only the
// gap-closing direction nets: an inflow to an OVERWEIGHT component does not
// create a trade need, and an outflow from an underweight one increases none.
//
// C.3 worked example (asserted in the canonical suite): a +1.5% underweight
// with +0.9% of natural inflow leaves only 0.6% for external execution.
export function netNaturalFlow(
  gapUsd: number,        // signed target gap in USD (observed − target) × NAV
  naturalFlowUsd: number, // signed CF_{i,t} in USD (positive = into component)
): { residualUsd: number; nettedUsd: number } {
  if (gapUsd > 0 && naturalFlowUsd < 0) {
    // Overweight (must sell); outflow reduces holdings → nets the gap.
    const netted = Math.min(gapUsd, -naturalFlowUsd);
    return { residualUsd: gapUsd - netted, nettedUsd: netted };
  }
  if (gapUsd < 0 && naturalFlowUsd > 0) {
    // Underweight (must buy); inflow adds holdings → nets the gap.
    const netted = Math.min(-gapUsd, naturalFlowUsd);
    return { residualUsd: gapUsd + netted, nettedUsd: netted };
  }
  return { residualUsd: gapUsd, nettedUsd: 0 };
}

// === §10 MARP Main Decision ===
// For each component, decide whether to trade and how much — through the full
// 8-level hierarchy documented in the header.
export interface MarpDecision {
  shouldTrade: boolean;
  component: Component;
  direction: "buy" | "sell" | "hold";
  tradeUsd: number;
  urgency: number;       // 0..1
  reason: string;
  level: number;          // 1..8 (MARP hierarchy level)
  // === §10.3 Six-Level Intervention Taxonomy (v2.0) ==========================
  // The §10.3 classification (Monitor / Natural flow / Drift / Risk /
  // Structural / Emergency) is the decision doctrine layer published with
  // every decision (blueprint v2.0 §10.3; "the level is selected per
  // component per day as the highest level whose trigger condition is met").
  // It complements — does not replace — the 8-level gate pipeline above.
  hierarchy: "0-Monitor" | "1-Natural flow" | "2-Drift trigger" | "3-Risk trigger" | "4-Structural change" | "5-Emergency";
  // === §10.7 natural-flow netting audit fields (EQ-084/C.3) =================
  // "Every natural-flow netting decision is recorded with its components, so
  //  an auditor can verify that CF_{i,t} was measured, not assumed."
  naturalFlowUsd: number;   // CF_{i,t} — signed net natural flow into component i
  gapUsd: number;           // TargetGap_i × NAV (signed)
  residualGapUsd: number;   // TradeNeeded_i = TargetGap_i − CF_{i,t} (signed, ≥ 0 in gap direction)
  deferredUsd: number;      // residual NOT executable this round (pool-depth/turnover caps)
  // === §11.7 canonical decision-record fields (Task 8-b) =====================
  // "Every MARP decision — executed or declined — emits a structured event"
  // with a machine-readable reason string. These fields carry the canonical
  // record on the decision object (engine-internal audit record, shadow mode).
  canonicalEvent: "RebalanceExecuted" | "RebalanceSkipped";
  canonicalSkipReason: CanonicalSkipReason | null;
  // === §10.6 state-dependent β record ========================================
  beta: BetaRecord;
  // === §10.5 dynamic-θ decomposition (κ terms) ===============================
  theta: ThetaDecomposition;
  // === §11.6/§14.5 crisis-mode execution set — decision outputs ==============
  crisis: CrisisModeRecord;
  // === v5.0 mandate SHADOW gate (Listings C-1/C-4 + §3.5 candidate J(s)) ====
  // The corrected direction-aware arithmetic and the dimensional net-benefit
  // gate run ALONGSIDE the legacy §10/§11 ladder on every decision. SHADOW
  // ONLY: economic eligibility for live trading stays disabled until the
  // Committee approves OD-1 (J(s)) and OD-2 (threshold) — the record exists
  // so Gate 2 shadow evidence is collected from day one (v5.0 §0.3).
  mandate?: {
    signedImprovement: number;  // I(q) = |d| − |d'| (fraction; negative = worsens)
    directionEligible: boolean; // §3.4.1 isEligibleForNormalMode
    grossBenefitUsd: number;    // G(q;s) = J(s) − J(s'(q)) [candidate J(s)]
    costUsd: number;            // itemized incremental cost C(q) — §12.7 model
    protectionUsd: number;      // B_time conservative fallback (OD-4 open)
    netBenefitUsd: number;      // N = G − C − B
    thresholdUsd: number;       // ε candidate: $10 absolute (OD-2 OPEN)
    netBenefitEligible: boolean;// N > ε
    shadowOnly: true;
    objectiveVersion: string;
    protectionModelVersion: string;
  };
}

export interface MarpDecisionOpts {
  /** §11.8 no-trade band override (caller selects the 1.5% crisis band per
   *  §11.6 when the stress level is ≥ 2). Defaults to θ_base 0.75%. */
  noTradeBand?: number;
  /** §11.6/§14.5 crisis-mode override. Defaults to the caller's own mechanical
   *  crisis trigger (band widened past θ_base) — the pilot maps the §5.5
   *  CrisisScore to the canonical risk state (STRESS/DEFENSIVE/EMERGENCY). */
  crisisMode?: boolean;
  /** §10.7 natural flows CF_{i,t} (signed USD into each component since the
   *  last rebalance — measured by the engine from mint/redeem activity). */
  naturalFlowUsd?: Partial<Record<Component, number>>;
  /** §11.4 24h pool depth (USD) for the thin-liquidity deferral. Falls back
   *  to POOL_DEPTH_FALLBACK_USD ($4M, labeled pilot fallback) when absent. */
  poolDepth24hUsd?: number;
  /** §11.5.3 direction-lock state (advisory at decision level; enforced again
   *  at execution in applyMarpRebalance). lastTradeDir: +1 buy / −1 sell / 0. */
  lastTradeDir?: number;
  lastTradeAt?: number;
  /** Fixed clock for deterministic tests (epoch ms). */
  now?: number;
}

export function marpDecision(
  observed: WeightVector,
  target: WeightVector,
  nav: number,
  reserveRatio: number,
  volatilities: Record<Component, number>,
  opts?: MarpDecisionOpts,
): MarpDecision[] {
  const decisions: MarpDecision[] = [];
  const band = opts?.noTradeBand ?? NO_TRADE_BAND_BASE;
  const now = opts?.now ?? Date.now();
  const poolDepth = opts?.poolDepth24hUsd ?? 0;
  // §11.6/§14.5 — crisis-mode selection (pilot mapping: see CRISIS_EXECUTION_SET).
  const crisisMode = opts?.crisisMode ?? band > NO_TRADE_BAND_BASE + 1e-12;
  const crisis: CrisisModeRecord = {
    active: crisisMode,
    sizeShrinkFactor: crisisMode ? CRISIS_EXECUTION_SET.sizeShrinkFactor : 1,
    poolFractionFactor: crisisMode ? CRISIS_EXECUTION_SET.poolFractionFactor : 1,
    venueRequirement: crisisMode ? CRISIS_EXECUTION_SET.venueRequirement : "STANDARD",
    objectivePriority: crisisMode ? CRISIS_EXECUTION_SET.objectivePriority : "BALANCED",
    note: CRISIS_EXECUTION_SET.status,
  };
  // §11.4 pool cap, tightened by the §11.6 crisis factor when active.
  const maxByPool = MAX_POOL_FRACTION * crisis.poolFractionFactor * poolDepth;
  // §10.5 — cross-sectional σ̃ normalization (the §4.5 discipline).
  const sigmaTilde = normalizeCrossSectional(volatilities);

  for (const c of COMPONENTS) {
    const deviation = observed[c] - target[c];
    const absDev = Math.abs(deviation);
    const vol = volatilities[c] ?? 0.10;
    const gapUsd = deviation * nav;
    const cf = opts?.naturalFlowUsd?.[c] ?? 0;
    // --- Level 1: Natural-flow netting (§10.7 — flows first, cheapest) ------
    const netting = netNaturalFlow(gapUsd, cf);
    const residualUsd = netting.residualUsd;
    const assetClass = assetClassFor(c);

    // --- §10.5 dynamic no-trade threshold decomposition --------------------
    const theta = dynamicNoTradeThreshold(band, sigmaTilde[c] ?? null);

    // --- §10.6 β pre-computation (needs urgency + impact estimate) ----------
    const urgencyShadow = computeUrgency(deviation, reserveRatio, vol);
    const impactTilde = impactEstimateFor(residualUsd, poolDepth);
    const betaRec = stateDependentBeta(urgencyShadow, impactTilde);

    // --- v5.0 mandate SHADOW gate (Listing C-1 + C-4 + §3.5 candidate J(s)).
    // Runs on the WOULD-BE β-sized trade so the corrected-gate record exists
    // even when the legacy ladder holds. SHADOW ONLY (OD-1/OD-2 open).
    // Cost assembly = the §12.7 exact model (Task 8-b); the flat $50 legacy
    // gas value is withdrawn per Appendix F.
    const navSafe = nav > 0 ? nav : 1;
    const wouldBeTradeUsd = Math.abs(residualUsd) * betaRec.applied * (crisis.active ? crisis.sizeShrinkFactor : 1);
    const deltaWE18 = residualUsd === 0
      ? 0n
      : toE18(((residualUsd > 0 ? -1 : 1) * wouldBeTradeUsd) / navSafe);
    const obsE = toE18(observed[c]);
    const tgtE = toE18(target[c]);
    const impE = signedImprovement(obsE, tgtE, deltaWE18);
    const dirOk = isEligibleForNormalMode(impE, obsE, tgtE, deltaWE18);
    const preState: JsState = { navE18: toE18(navSafe), observedW: { [c]: obsE }, targetW: { [c]: tgtE } };
    const postState: JsState = { navE18: toE18(navSafe), observedW: { [c]: obsE + deltaWE18 }, targetW: { [c]: tgtE } };
    const grossE = grossBenefit(preState, postState);
    // §12.7 cost estimate on the would-be trade (per-asset-class half-τ + fees
    // + buffered gas accounting estimate). The mandate protection margin keeps
    // its own conservative B_time model (OD-4 open).
    const shadowCost = estimateExecutionCost(wouldBeTradeUsd, assetClass);
    const costE = toE18(shadowCost.totalUsd);
    const protE = protectionMargin(toE18(wouldBeTradeUsd), 60_000, vol, 0.8);
    const mGate = netBenefitIsEligible(grossE, costE, protE, THRESHOLD_POLICY.absoluteUsdE18);
    const shadow = {
      signedImprovement: fromE18(impE),
      directionEligible: dirOk,
      grossBenefitUsd: fromE18(grossE),
      costUsd: fromE18(costE),
      protectionUsd: fromE18(protE),
      netBenefitUsd: fromE18(mGate.netBenefitE18),
      thresholdUsd: fromE18(THRESHOLD_POLICY.absoluteUsdE18),
      netBenefitEligible: mGate.eligible,
      shadowOnly: true as const,
      objectiveVersion: JS_OBJECTIVE_VERSION,
      protectionModelVersion: PROTECTION_MODEL_VERSION,
    };

    const base = {
      naturalFlowUsd: cf,
      gapUsd,
      residualGapUsd: residualUsd,
      deferredUsd: 0,
      mandate: shadow,
      beta: betaRec,
      theta,
      crisis,
    };

    const hold = (
      level: number,
      reason: string,
      skipReason: CanonicalSkipReason,
      urgency = 0,
      hierarchy?: MarpDecision["hierarchy"],
    ) =>
      decisions.push({
        shouldTrade: false, component: c, direction: "hold", tradeUsd: 0,
        urgency, reason, level,
        hierarchy: hierarchy ?? "0-Monitor",
        canonicalEvent: "RebalanceSkipped",
        canonicalSkipReason: skipReason,
        ...base, residualGapUsd: residualUsd,
      });

    // --- §10.3 six-level taxonomy classification for THIS component ----------
    // Level 0 Monitor is the default posture (deviation inside the no-trade
    // zone). Escalation: natural-flow coverage (L1), plain drift breach
    // (L2), risk deterioration — RR below the 1.10 target with the risk term
    // of the urgency score carrying the dominant weight (L3), and the
    // emergency posture is a governance-declared state (§13.7) — the pilot
    // marks it from the solvency metrics actually available here (hard-floor
    // proximity). Structural changes (constituency/methodology ramps, §4.6)
    // enter via decision inputs rather than daily drift, so they are not
    // produced by this daily loop.
    const hierarchyForTrade: MarpDecision["hierarchy"] =
      reserveRatio < 1.00 ? "5-Emergency"
      : reserveRatio < 1.10 ? "3-Risk trigger"
      : "2-Drift trigger";

    if (Math.abs(residualUsd) < 1e-9) {
      hold(1, `Natural flow coverage (§10.7): CF=${cf.toFixed(0)}USD netted ${netting.nettedUsd.toFixed(0)}USD of ${gapUsd.toFixed(0)}USD — market trade = 0`, "Natural flow coverage", 0, "1-Natural flow");
      continue;
    }

    // --- Level 2: No-trade zone (§10.4/§11.8 — θ_base 0.75%, 1.5% crisis;
    //     §10.5 κ-terms decomposed in the reason string) ----------------------
    if (inNoTradeZone(deviation, theta.applied)) {
      const kappaSum = theta.kappaVolatility + theta.kappaLiquidity + theta.kappaSpread + theta.kappaSlippage;
      hold(
        2,
        `No-trade zone (§10.4/§11.8): deviation ≤ θ ${(theta.applied * 100).toFixed(2)}% = θ_base ${(theta.base * 100).toFixed(2)}% + κ ${(kappaSum * 100).toFixed(2)}pp (§10.5 validation-stage, unpublished κ ⇒ 0)${theta.crisisWidening ? " — crisis widening ×2 (§11.6)" : ""} — Level 0 Monitor`,
        "No-trade zone",
        0,
        "0-Monitor",
      );
      continue;
    }

    // --- Level 3: Urgency test (§10.2 — simplified pilot form) --------------
    const urgency = computeUrgency(deviation, reserveRatio, vol);
    if (urgency < MARP_URGENCY_MIN) {
      hold(3, `Low urgency (${(urgency * 100).toFixed(1)}% < U_min ${(MARP_URGENCY_MIN * 100).toFixed(0)}%) (§10.2)`, "Low urgency", urgency);
      continue;
    }

    // --- Level 4: Partial correction sizing (§10.6 state-dependent β on the
    //     RESIDUAL; §11.6 crisis size shrink with the residual deferred) ----
    const beta = stateDependentBeta(urgency, impactTilde);
    const crisisShrunk = crisis.active ? crisis.sizeShrinkFactor : 1;
    const correctionFraction = residualUsd / navSafe * beta.applied * crisisShrunk;
    let tradeUsd = Math.abs(correctionFraction * nav);
    if (tradeUsd <= 0) {
      hold(4, "Zero size (§10.6): β-sized correction = 0", "Zero size", urgency);
      continue;
    }

    // --- Level 5: Cost-benefit gate (§10.8/§12.8 — legacy ε gate; §12.7 cost) -
    const gate = costBenefitGate(deviation, nav, tradeUsd, { assetClass });
    if (!gate.pass) {
      hold(
        5,
        `Net benefit not positive (§10.8/§12.8): benefit ${gate.benefit.toFixed(0)} ≤ cost ${gate.cost.toFixed(0)} + ε $${MIN_PROFITABILITY_USD} — §12.7 cost = gas ${gate.estimate?.gasUsd.toFixed(2) ?? "-"} + slip τ/2 ${(100 * (gate.estimate?.halfTau ?? 0)).toFixed(2)}% + router 0.1% + protocol 0.20%`,
        "Net benefit not positive",
        urgency,
      );
      continue;
    }

    // --- Level 6: Thin-liquidity deferral (§11.4 — ≤ MAX_POOL_FRACTION ×
    //     24h depth, crisis-tightened per §11.6) ----------------------------
    let deferredUsd = 0;
    if (poolDepth > 0 && tradeUsd > maxByPool) {
      deferredUsd = tradeUsd - maxByPool;
      tradeUsd = maxByPool;
      if (tradeUsd <= 0) {
        hold(6, `Liquidity cap (§11.4): pool depth ${poolDepth.toFixed(0)}USD; cap ${(maxByPool).toFixed(0)}USD${crisis.active ? " (crisis ×0.5 §11.6)" : ""} — deferred`, "Liquidity cap", urgency);
        continue;
      }
    }

    // --- Level 7: Daily turnover check (§7.3 — max 5% of NAV per day) -------
    const turnoverCap = MAX_DAILY_TURNOVER * nav;
    if (tradeUsd > turnoverCap) {
      deferredUsd += tradeUsd - turnoverCap;
      tradeUsd = turnoverCap;
    }
    if (tradeUsd <= 0) {
      hold(7, "Turnover cap (§11.5.2): daily 5%-of-NAV budget exhausted", "Turnover cap", urgency);
      continue;
    }

    // --- Level 8: Direction lock (§11.5.3 — 24h whipsaw guard) → EXECUTE ----
    // v2.0-FIX (CRITICAL): the direction lock is the ANTI-WHIPSAW control
    // (§11.5.3 + Appendix F.9: "The direction lock is the anti-whipsaw
    // control"). It blocks SAME-DIRECTION repetition within 24h and ALLOWS
    // reversals — the former implementation here held opposite-direction
    // (reversal) trades and passed same-direction repeats, exactly backwards.
    // Stress override (§11.5.3 / Listing 4): when RR < 1.05 the lock does not
    // apply, so solvency-protective corrections are never blocked.
    const dir: 1 | -1 = deviation > 0 ? -1 : 1; // overweight → sell; underweight → buy
    const lastDir = opts?.lastTradeDir ?? 0;
    const lastAt = opts?.lastTradeAt ?? 0;
    if (lastDir !== 0 && reserveRatio >= 1.05 && now - lastAt < DIRECTION_LOCK_HOURS * 3_600_000 &&
        dir === lastDir) {
      hold(8, `Direction lock (§11.5.3): 24h same-direction guard — reversal to ${dir === 1 ? "buy" : "sell"} remains eligible`, "Direction lock", urgency);
      continue;
    }

    decisions.push({
      shouldTrade: true,
      component: c,
      direction: deviation > 0 ? "sell" : "buy",
      tradeUsd,
      urgency,
      reason: `L1 flows netted ${netting.nettedUsd.toFixed(0)}USD; benefit (${gate.benefit.toFixed(0)}) > cost+ε (${gate.cost.toFixed(0)} §12.7); urgency ${(urgency * 100).toFixed(1)}%; β=${beta.applied.toFixed(2)} (§10.6: clip(${MARP_BETA_TERMS.beta0.toFixed(2)}+${MARP_BETA_TERMS.beta1.toFixed(2)}·U−${MARP_BETA_TERMS.beta2.toFixed(2)}·Î, β_min ${MARP_BETA_TERMS.betaMin.toFixed(2)}))${crisis.active ? `; CRISIS SET §11.6/§14.5: size ×${crisis.sizeShrinkFactor}, pool cap ×${crisis.poolFractionFactor}, ${crisis.venueRequirement}, ${crisis.objectivePriority}` : ""}${deferredUsd > 0 ? `; deferred ${deferredUsd.toFixed(0)}USD (liquidity/turnover)` : ""}`,
      level: MARP_EXECUTE_LEVEL,
      hierarchy: hierarchyForTrade,
      canonicalEvent: "RebalanceExecuted",
      canonicalSkipReason: null,
      naturalFlowUsd: cf,
      gapUsd,
      residualGapUsd: residualUsd,
      deferredUsd,
      beta,
      theta,
      crisis,
      mandate: shadow,
    });
  }

  return decisions;
}
