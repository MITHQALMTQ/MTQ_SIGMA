// MTQΣ Blueprint — Master Monetary Architecture v1.0 Constants
// Source of Truth: MTQSigma_Master_Monetary_Architecture_TechnicalDoc_v1.0_2026-09-08.docx
// All numeric values are taken verbatim from the Master Blueprint v1.0.
// v1.2 is SUPERSEDED — all old fixed-quantity basket constants are replaced.

export interface FxRates {
  EUR_USD: number;
  GBP_USD: number;
  JPY_USD: number;
  CNY_USD: number;
  CHF_USD: number; // NEW v1.0 — CHF added as first-class component
  XAU_USD: number; // Gold is now IN the index (not just reserve)
  VIX: number;
  DXY: number;
  fetchedAt: number;
  source: string;
}

// === §3.2 Strategic Prior (NOT Fixed Weight) ===
// W^Prior ≠ W^Target ≠ W^Smooth ≠ W^Execution
// The prior is a soft anchor — deviation penalized, not enforced.
//
// M8-3a (2026-10-23, owner-delegated): the per-component constants in this
// file (STRATEGIC_PRIOR :22-30, BASE_FIXINGS :55-62, ADMISSIBILITY_ENVELOPES
// :78-96, MAX_VELOCITY :241-244) are now ALSO the DEFAULT GENESIS DATA of the
// registry-driven constituency layer — src/lib/mtq/constituency/registry.ts
// seeds each genesis registry record from these exact arrays (weights →
// genesisWeightBp, envelopes → envelope, MAX_VELOCITY → velocityPerPeriod,
// BASE_FIXINGS → baseFixing) and provides the registry-driven lookups
// (lookupEnvelope / lookupVelocityPerPeriod / lookupBaseFixing /
// lookupGenesisWeightBp) that replace fixed-array consumption at the
// membership layer. The arrays themselves remain VERBATIM (byte-identical
// defaults; the canonical suite is green untouched). All values remain the
// Master Blueprint v1.0 constants — constitutional (envelope path), NOT
// approved as registry-era economic parameters (spec §13 — D-13.11/§5.2).
export const STRATEGIC_PRIOR = {
  USD:  0.27,
  EUR:  0.20,
  JPY:  0.09,
  GBP:  0.08,
  CNY:  0.05,
  CHF:  0.05,
  Gold: 0.26,
} as const;

// §3.4 Genesis Weight Initialization — the table carries BOTH the prior
// weight and the USD-equivalent genesis notional per 1 MTQ unit (at genesis
// they coincide by construction: q_i = W^Prior_i in USD-equivalent units at
// the base-date fixings, so the index starts at exactly 1.0000), plus the
// base fixing each notional was struck at (v2.0 §3.4 table, verbatim values).
export const STRATEGIC_PRIOR_TABLE = [
  { component: "USD",  weight: 0.27, token: "USDC (Circle)",                 genesisNotional: 0.27, fixing: "USD 1.00 (base)" },
  { component: "EUR",  weight: 0.20, token: "EURC (Circle)",                 genesisNotional: 0.20, fixing: "EUR/USD 1.0500" },
  { component: "JPY",  weight: 0.09, token: "Registry-Resolved",             genesisNotional: 0.09, fixing: "JPY/USD 0.0067" },
  { component: "GBP",  weight: 0.08, token: "Registry-Resolved",             genesisNotional: 0.08, fixing: "GBP/USD 1.2500" },
  { component: "CNY",  weight: 0.05, token: "Registry-Resolved (CNH)",       genesisNotional: 0.05, fixing: "CNY/USD 0.1400" },
  { component: "CHF",  weight: 0.05, token: "Registry-Resolved",             genesisNotional: 0.05, fixing: "CHF/USD 1.1300" },
  { component: "Gold", weight: 0.26, token: "PAXG / XAUT (registry-resolved)", genesisNotional: 0.26, fixing: "XAU/USD 2,500.00" },
] as const;

// === §3.4 Genesis Weight Initialization ===
// At genesis, each component's USD-equivalent notional equals its strategic prior share.
// Base-date fixings (immutable, used for chain-link normalization P_{i,0}).
//
// P0-FIX (Master Reconciliation audit, AUDIT-D F-CHF-01): CHF base fixing was
// 0.88 in the legacy engine/contract but the Master Blueprint v1.0 specifies 1.13.
// 0.88 USD/CHF understates CHF by ~28% (the Swiss franc is stronger than that).
// Fixed to 1.13 to match the Master Blueprint exactly.
export const BASE_FIXINGS = {
  EUR_USD: 1.0500,
  GBP_USD: 1.2500,
  JPY_USD: 0.0067,
  CNY_USD: 0.1400,
  CHF_USD: 1.1300,   // ~1.13 USD per CHF (Master Blueprint v1.0 — was 0.88, +28% underweighted)
  XAU_USD: 2500.00,   // $2,500/oz at base date
} as const;

// Genesis GFB denominator (for chain-linked index normalization)
// GFB_base = Σ W^Prior_i × P_{i,0} = 0.27×1 + 0.20×1.05 + 0.09×0.0067 + 0.08×1.25 + 0.05×0.14 + 0.05×1.13 + 0.26×2500
// (CHF base fixing is now 1.13 per the Master Blueprint v1.0; was 0.88 in the legacy engine.)
export const GFB_BASE_DENOMINATOR =
  STRATEGIC_PRIOR.USD * 1.0 +
  STRATEGIC_PRIOR.EUR * BASE_FIXINGS.EUR_USD +
  STRATEGIC_PRIOR.JPY * BASE_FIXINGS.JPY_USD +
  STRATEGIC_PRIOR.GBP * BASE_FIXINGS.GBP_USD +
  STRATEGIC_PRIOR.CNY * BASE_FIXINGS.CNY_USD +
  STRATEGIC_PRIOR.CHF * BASE_FIXINGS.CHF_USD +
  STRATEGIC_PRIOR.Gold * BASE_FIXINGS.XAU_USD;

// === §8.1 Constitutional Admissibility Envelopes ===
// Per-component hard bounds — no optimizer output may cross these.
export const ADMISSIBILITY_ENVELOPES = {
  USD:  { lower: 0.23, upper: 0.32 },
  EUR:  { lower: 0.17, upper: 0.24 },
  JPY:  { lower: 0.07, upper: 0.12 },
  GBP:  { lower: 0.06, upper: 0.11 },
  CNY:  { lower: 0.03, upper: 0.07 },
  CHF:  { lower: 0.03, upper: 0.07 },
  Gold: { lower: 0.20, upper: 0.32 },
} as const;

export const ENVELOPES_TABLE = [
  { component: "USD",  lower: "23%", upper: "32%", prior: "27%" },
  { component: "EUR",  lower: "17%", upper: "24%", prior: "20%" },
  { component: "JPY",  lower: "7%",  upper: "12%", prior: "9%" },
  { component: "GBP",  lower: "6%",  upper: "11%", prior: "8%" },
  { component: "CNY",  lower: "3%",  upper: "7%",  prior: "5%" },
  { component: "CHF",  lower: "3%",  upper: "7%",  prior: "5%" },
  { component: "Gold", lower: "20%", upper: "32%", prior: "26%" },
] as const;

// === §2.3 Four-State Weight Distinction ===
export type WeightState = "prior" | "target" | "smoothed" | "execution";

export const WEIGHT_STATE_DESCRIPTIONS = [
  { state: "Strategic Prior", symbol: "W^Prior",     meaning: "Long-term starting preference; a soft stabilizing anchor only.", producedBy: "Research program; governance-approved methodology version." },
  { state: "Target",          symbol: "W^Target",    meaning: "Current mathematical optimum before constraints are applied.", producedBy: "MASE ensemble (Chapter 7)." },
  { state: "Smoothed",        symbol: "W^Smooth",     meaning: "Risk-controlled transition toward the constrained target.", producedBy: "Stress-adaptive smoothing (Section 8.4)." },
  { state: "Execution",       symbol: "W^Execution",  meaning: "Actual trade decision after cost, liquidity and reserve testing.", producedBy: "MARP (Chapters 10-11)." },
] as const;

// === §2.5 Core Variables ===
export const PAR = 1.00; // The unit of account — immutable
export const RR_TARGET = 1.10; // 110% — target reserve ratio
export const RR_STRESS = 1.05; // 105% — stress floor
export const RR_HARD = 1.00;   // 100% — hard solvency floor (I2)
export const LCR_TARGET = 1.00;
export const STRESS_REDEMPTION_RATE = 0.25; // 25% of circulating supply in 30 days

// === §2.6 Constitutional Invariants (Hard Rules) ===
// Full I1–I12 ladder, verbatim from the Master Blueprint v1.0 §2.6.
// I3 and I12 are the keystones of v2.0 (methodology-not-weights; gold separation).
export const CONSTITUTIONAL_INVARIANTS = [
  { id: "I1", description: "PAR = 1.00 basket-unit is immutable.", enforcedBy: "§18.1" },
  { id: "I2", description: "RR_t ≥ 1.00 at all times.", enforcedBy: "§14.2, §22" },
  { id: "I3", description: "The reference basket is governed by a FIXED, PUBLISHED, AUDITABLE METHODOLOGY, not by fixed weights. Live weights are computed by MASE under constitutional constraints; the methodology changes only through constitutional governance.", enforcedBy: "§3, §7, §8, §9" },
  { id: "I4", description: "V_net,t is always calculated with asset-specific haircuts.", enforcedBy: "§14.1" },
  { id: "I5", description: "Minting is always priced against P_MTQ,t (the adaptive index), never against a fixed USD peg.", enforcedBy: "§19.2" },
  { id: "I6", description: "Redemption is always priced against NAV_t, never against a fixed USD peg.", enforcedBy: "§19.3" },
  { id: "I7", description: "The protocol is governed by a layered hierarchy (Constitutional, Monetary, Risk, Emergency).", enforcedBy: "§22.3" },
  { id: "I8", description: "No single actor can unilaterally change monetary policy, risk parameters, or emergency controls; no governance body may set individual live weights by discretion.", enforcedBy: "§22.3–22.4" },
  { id: "I9", description: "All oracle prices must pass timestamp, confidence, and deviation checks; the canonical gold price requires an independent-source quorum.", enforcedBy: "§17.3–17.7" },
  { id: "I10", description: "The protocol must be honest about its status; validation-gate status is published on-chain.", enforcedBy: "§25" },
  { id: "I11", description: "Daily calculation does not imply daily trading; trading requires an economically justified trigger under MARP rules.", enforcedBy: "§10.1" },
  { id: "I12", description: "Gold reference allocation and gold reserve allocation are separate; no reserve asset may be used for secondary-market price support.", enforcedBy: "§13.3, §13.6" },
] as const;

// === §14.1.1 Constitutional Haircut Table (v1.2 table retained as default) ===
// VERBATIM from the Master Blueprint §14.1.1:
//   USD stablecoin (USDC, USDP)   0.5%   — extremely liquid; regulated
//   EUR stablecoin (EURC)         0.7%   — highly liquid; slightly lower depth
//   GBP stablecoin                1.0%   — lower on-chain liquidity
//   JPY stablecoin                1.0%   — lower on-chain liquidity
//   CNY stablecoin (offshore CNH) 1.5%   — limited liquidity; offshore constraints
//   Tokenized Gold (PAXG, XAUT)  1.0%   — custody spread (0.5%) + DEX slippage (0.5%)
//   Tokenized T-Bills (BUIDL)    2.0%   — interest-rate + redemption delay risk
// NOTE (audit 2026-10-19): a previous local edit differentiated PAXG 0.8% /
// XAUT 1.2% — differentiation is a RISK-COUNCIL act (4/7 + 24h timelock,
// §14.1.1), NOT a silent code decision. Reverted both to the constitutional
// 1.0% (§14.3: "the tokenized-gold haircut of 1.0% prices the residual custody
// spread and DEX slippage even for admitted instruments"). The per-issuer keys
// are retained structurally (haircuts feed per-instrument NAV per §14.3) but
// carry identical constitutional values until a governed change differentiates
// them. CHF (new in v1.0, absent from the v1.2 table) is assigned 1.0% per the
// "lower on-chain liquidity" class (GBP/JPY) — invariant I4 requires every
// reserve asset to carry an asset-specific haircut.
export const HAIRCUTS = {
  USD: 0.005, EUR: 0.007, GBP: 0.01, JPY: 0.01, CNY: 0.015,
  CHF: 0.01,  XAU: 0.01,  T_BILL: 0.02,
  // Per-issuer tokenized-gold haircuts — both at the constitutional 1.0%
  // (§14.1.1 "Tokenized Gold PAXG, XAUT — 1.0%").
  PAXG: 0.010,   // 1.0% — Paxos Gold (NYDFS-regulated, monthly attestations)
  XAUT: 0.010,   // 1.0% — Tether Gold
} as const;

// === §19.7 / §21.4 Fee schedule (state-dependent redemption fee ladder) ===
// Mint fee is state-INDEPENDENT: F_mint = 0.10% (§19.7; Risk Council 4/7).
// Redemption fee is state-dependent per §21.4's action matrix:
//   S1 NORMAL 0.15% · S2 CAUTION 0.15% · S3 STRESS 0.50% · S4 DEFENSIVE 1.00%
//   S5 EMERGENCY — redemption PAUSED (no fee applies)
//   S6 RECOVERY 0.30%
export const MINT_FEE_BPS = 10;              // 0.10% (§19.7 — constant across states)
export const REDEEM_FEE_BPS = 15;           // 0.15% (NORMAL/CAUTION state default — legacy alias)
export const REDEEM_FEE_NORMAL = 0.0015;     // 0.15% — S1 NORMAL / S2 CAUTION (§21.4)
export const REDEEM_FEE_STRESS = 0.005;      // 0.50% — S3 STRESS (§21.4)
export const REDEEM_FEE_DEFENSIVE = 0.01;    // 1.00% — S4 DEFENSIVE (§21.4)
export const REDEEM_FEE_EMERGENCY = 0.02;    // UNUSED — redemption is PAUSED in S5 EMERGENCY (§21.4); value retained only as the legacy Listing-13 constant
export const REDEEM_FEE_RECOVERY = 0.003;    // 0.30% — S6 RECOVERY (§21.4)

// === §19.7 Mint/Redeem guards ===
export const MIN_MINT_MTQ = 1;               // 1 MTQ — constitutional (immutable)
export const MIN_REDEEM_MTQ = 1;             // 1 MTQ — constitutional (immutable)
export const DEFAULT_USER_SLIPPAGE = 0.005;  // τ_user = 0.5% default slippage tolerance (§19.7)
export const TRADE_DEADLINE_MINUTES = 5;     // 5-minute trade deadline — constitutional (immutable)

// === §20.1.2 Genesis constants (constitutional — documentation-grade) ===
export const GENESIS_DEPOSIT_USDC = 1_100_000;  // 110% coverage at genesis
export const GENESIS_SUPPLY_MTQ = 1_000_000;   // non-circulating Genesis Reserve (excluded from L_t)

// === §12.3.3 Per-asset-class execution slippage tolerances (Risk Council 4/7) ===
export const SLIPPAGE_TOLERANCES = {
  STABLECOIN: 0.005,   // 0.5% — USDC, EURC (highly liquid; tight spread)
  GOLD: 0.010,         // 1.0% — PAXG (lower liquidity; higher spread)
  MINOR_FX: 0.015,     // 1.5% — JPY, CNY instruments (thin liquidity; wider spread)
} as const;

// === §17.3 Oracle validation bounds (per feed class; Risk Council 4/7) ===
export const ORACLE_VALIDATION = {
  STALENESS_MS: {
    MAJOR_FX: 60_000,   // EUR/USD, GBP/USD (§17.3.1)
    MINOR_FX: 120_000,  // JPY/USD, CNY/USD
    GOLD: 60_000,       // PAXG/XAU — never older than the currencies it aggregates with
    VIX_DXY: 120_000,   // index-like signals
  },
  CONFIDENCE_MAX_PCT: {
    MAJOR_FX: 0.005,    // 0.5% — EUR/USD (§17.3.2)
    MINOR_FX: 0.010,    // 1.0% — JPY/USD, CNY/USD
    GOLD: 0.010,        // 1.0% — PAXG
    VIX_DXY: 0.020,     // 2.0% — VIX, DXY
  },
  DEVIATION_MAX_PCT: 0.025, // 2.5% from median (§17.3.3) — circuit breaker
} as const;

// === §3.5 Price Safety Band (circuit breakers — carried) ===
export const PRICE_SAFETY_LOWER = 0.50;
export const PRICE_SAFETY_UPPER = 2.00;
export const PRICE_EVENT_THRESHOLD = 0.005; // 0.5% change for PriceUpdated event

// === §6 MASE Candidate Models ===
export const MASE_MODELS = [
  { id: "minvar",  name: "Minimum Variance",          desc: "Minimize portfolio variance against robust covariance estimate." },
  { id: "erc",     name: "Equal Risk Contribution",   desc: "Risk parity — each component contributes equally to portfolio risk." },
  { id: "maxdiv",  name: "Maximum Diversification",   desc: "Maximize the diversification ratio." },
  { id: "cvar",    name: "Tail Risk (CVaR)",          desc: "Minimize conditional value-at-risk at 95th percentile." },
  { id: "ppp",     name: "Purchasing-Power",           desc: "Track purchasing-power parity across currencies." },
  { id: "regime",  name: "Regime-Adaptive",           desc: "Switch model emphasis based on detected market regime." },
] as const;

// === §8.4 Stress-Adaptive Smoothing (constitutional ρ values) ===
// W^Smooth = ρ·W_prev + (1−ρ)·W^Target, with ρ selected by the stress flag
// (sourced from the crisis-score path, threshold 0.70; conservative default
// to stress when the score is unavailable — §8.4).
export const SMOOTHING_RHO_NORMAL = 0.50;  // ρ = 0.50 (normal) → 50% adoption of the target per update
export const SMOOTHING_RHO_STRESS = 0.75;  // ρ = 0.75 (stress) → 25% adoption (slower in stressed markets)
export const CRISIS_SCORE_STRESS_THRESHOLD = 0.70; // crisis-score threshold that selects ρ_stress (§8.4/§5.5)
// DEPRECATED legacy alias (was 0.20 — did not match the blueprint's ρ ladder).
// Retained only for backward-compat imports; do not use in new code.
export const SMOOTHING_LAMBDA = 1 - SMOOTHING_RHO_NORMAL; // = 0.50 target-adoption fraction (normal)
export const ROLLING_WINDOW_DAYS = 90;

// === §8.3 Weight-Velocity Constraint (per accepted update; Risk Council 4/7) ===
// |w_i,t − w_i,t−1| ≤ Δ_i for the published (smoothed) weight series.
// Deployed MAX_VELOCITY arrays of Listing 1/Listing 2:
//   USD and EUR 0.50% · JPY and GBP 0.30% · CNY and CHF 0.20% · Gold 0.50%
export const MAX_VELOCITY: Record<string, number> = {
  USD: 0.005, EUR: 0.005, JPY: 0.003, GBP: 0.003,
  CNY: 0.002, CHF: 0.002, Gold: 0.005,
} as const;

// === §10 MARP Constants ===
export const SLIPPAGE_TOLERANCE = 0.01; // 1%
export const MAX_DAILY_TURNOVER = 0.05; // 5% of NAV
export const MAX_POOL_FRACTION = 0.10; // 10% of 24h pool depth
export const DIRECTION_LOCK_HOURS = 24;

// === §11.8 No-Trade Band (validation-stage; Risk Council 4/7) ===
// Listing 4 (§11.11): noTradeBand = 0.75% base; noTradeBandStress = 1.5%
// (the crisis-oracle widening of §11.6 — "Listing 4 doubles the base band
// when the crisis oracle exceeds its threshold"). θ_base is the §10.5 static
// base; the full dynamic form θ_{i,t} = θ_base + κ₁σ̃ + κ₂(1−L̃) + κ₃Spread̃ +
// κ₄Slippagẽ is a research-program deliverable (the κ vector is
// validation-stage per §10.5) — the pilot implements the base + crisis
// widening only, which is the deployed Listing-4 behavior.
export const NO_TRADE_BAND_BASE = 0.0075;    // θ_base = 0.75% (§11.8 / Listing 4)
export const NO_TRADE_BAND_STRESS = 0.015;   // 1.5% — crisis widening (§11.6)

// === §12.8 Minimum Profitability Guard (MIN_PROFITABILITY) — RG-10 UNIFIED ===
// The §10.8 cost-benefit gate requires NetBenefit > ε; Listing 5 initializes
// minProfitability to $10 (§12.8). The pilot's gate uses this absolute floor.
//
// RG-10 GOVERNANCE DECISION RECORD (equation-by-equation audit, F-2):
//   The blueprint fixes ε twice with different units — Listing 4 (§11.11)
//   BENEFIT_MARGIN 1% (relative) vs Listing 5 (§12.8) MIN_PROFITABILITY $10
//   (absolute) vs §12.5's bare `>0` form. The CODE now uses ONE normative rule
//   on EVERY execution route (legacy §7 and MARP §10/§11 alike):
//     execute iff  NetBenefit = Benefit − Cost > MIN_PROFITABILITY_USD ($10)
//   Rationale: Listing 5 is the operative initialization the §10.8/§12.8 text
//   describes ("a candidate trade must clear the ε-threshold, not merely break
//   even"); the $10 absolute form is scale-free with respect to trade size and
//   matches the reference implementation. Listing 4's 1% relative margin and
//   §12.5's `>0` form are recorded here as REJECTED VARIANTS pending the
//   governance truth-table ratification (see audit-work/v3 decision records).
export const MIN_PROFITABILITY_USD = 10;

// === §10.6 Partial-Correction β (MARP_BETA) — Risk Council 4/7 ===
// β = 0.50 per trade (the doc's Appendix C.2 walk-through uses β = 0.40 as a
// WORKED EXAMPLE; the deployed constant is 0.50 — Appendix C.2's −0.96pp is
// the example arithmetic, the pilot's −1.20pp with β=0.50 is asserted in the
// canonical suite). Registered in PARAMETER_REGISTRY (audit F-6: ungoverned
// constants must be registered).
export const MARP_BETA = 0.50;

// === §10.2 Urgency floor (U_min) — pilot approximation, labeled (RG-15) ===
// Skip trades whose computed urgency U < 0.05. The §10.2 urgency function
// f(deviation, RR, volatility) with coefficients a–e is symbolic in the
// blueprint (validation-stage); the pilot's simplified form is a DISCLOSED
// SUBSTITUTE ("Simplified pilot"), and the 0.05 floor is a pilot constant,
// not a canonical value.
export const MARP_URGENCY_MIN = 0.05;

// === §10.8 / §11.8 Execution-cost constants — RISK layer, registered ===
// GAS_FALLBACK_USD: per-trade gas estimate ($50, Listing 5 §11.8 fallback).
// POOL_DEPTH_FALLBACK_USD: PAXG/USDC 24h pool-depth fallback used ONLY when
//   the live pool-depth feed (PAXG 24h volume via Yahoo Finance, wired in
//   fx.ts) is unavailable. Clearly labeled PILOT FALLBACK — the audit's
//   "replace $4M hard-coded pool depth with feed data" is implemented by
//   feeding the live volume through, with this constant as the degraded-mode
//   fallback (never silently used when the feed is live).
export const GAS_FALLBACK_USD = 50;
export const POOL_DEPTH_FALLBACK_USD = 4_000_000;

// === §20.4 Rebalancing Fee (fee table: "Rebalancing Fee 0.20% → Operational
// Wallet"). "Fees are deducted before the ... rebalance is executed. They are
// not part of the reserve collateral and are excluded from NAV ... the
// rebalancing fee interacts with the MARP cost-benefit gates (Chapter 11) as
// an explicit cost of execution. Each deduction emits FeeAccrued."
// Audit F-6/EQ-151: previously ABSENT — now charged on every executed
// rebalance trade (legacy §7 and MARP §10/§11 paths alike) to the treasury
// hot wallet (excluded from NAV, same accounting as mint/redeem fees).
export const REBALANCE_FEE_BPS = 20; // 0.20%

// === §19.4 Transaction Guards (minOut / τ_user / deadline) — EQ-146/147 ===
// §19.4.1: minMTQOut guard — revert if MTQ_minted < minMTQOut; default
//   minMTQOut = (X_net / P_MTQ) × (1 − τ_user).
// §19.4.2: full-basket redemption takes the minAssetOut form — revert if the
//   net redemption value falls below the user's declared minimum.
// τ_user defaults to 0.005 (0.5%) — the DEFAULT_SLIPPAGE constant of Listing 11.
// §19.7: 5-minute trade deadline — if the transaction is not executed within
//   the deadline the whole operation reverts.
export const DEFAULT_SLIPPAGE_TAU_USER = 0.005; // τ_user = 0.5% (Listing 11)
export const QUOTE_DEADLINE_MINUTES = 5;        // §19.7 5-minute deadline

// === §17.9 Cross-Source Correlation Detection — Risk Council 4/7 ===
// "If two sources deviate by more than 1.5% from each other for 3 consecutive
// updates, the protocol flags SOURCE_CORRELATION_WARNING and temporarily
// switches to using the median of all three... The correlation warning counter
// resets to zero whenever the pair deviation falls back inside the threshold."
// (CORRELATION_THRESHOLD = 0.015e18 in Listing 9; warning after 3 consecutive.)
export const ORACLE_CORRELATION_THRESHOLD = 0.015; // 1.5% pairwise deviation
export const ORACLE_CORRELATION_WARNING_AFTER = 3; // consecutive updates

// === §16 Dynamic Buffer (NOT §14.2 — the buffer chapter is 16 in v1.0) ===
// v1.2-simulated initialization values retained per §16.2's fidelity note:
//   BASE (RR ≥ 1.10): B_gold 62.5% · STRESS (1.05 ≤ RR < 1.10): 85% · EMERGENCY (RR < 1.05): 100%
//   W_gold,total = W_gold,core + 0.10 × B_gold (20% core baseline → 26.25/28.5/30.0%)
//   BASE↔STRESS transitions ramp linearly over 24h; STRESS→EMERGENCY is immediate.
export const BUFFER_SIZE = 0.10;
export const CORE_GOLD_WEIGHT = 0.20;
export const BUFFER_GOLD_BASE = 0.625;
export const BUFFER_GOLD_STRESS = 0.85;
export const BUFFER_GOLD_EMERGENCY = 1.00;
export const RAMP_DURATION_HOURS = 24;

// === §14.1 Gold Liquidity (gold is 0% liquid for LCR) ===
export const GOLD_LIQUIDITY_FACTOR = 0.0;

// === §11 Geopolitical Eject (§21.5 in the doc — staged liquidation ladder) ===
// Peg bands are ASSET-SPECIFIC per §21.5.2 (liquidity-scaled, 12h consecutive window):
export const PEG_BANDS = {
  USDC: { lower: 0.995, upper: 1.005 },   // extremely liquid — tight ±0.5% band
  USDP: { lower: 0.995, upper: 1.005 },
  EURC: { lower: 0.995, upper: 1.005 },   // highly liquid — tight band
  GBP:  { lower: 0.990, upper: 1.010 },   // lower liquidity — wider ±1% band
  JPY:  { lower: 0.990, upper: 1.010 },
  CNY:  { lower: 0.985, upper: 1.015 },   // limited liquidity — widest ±1.5% band
} as const;
export const DEPEG_DETECTION_HOURS = 12; // consecutive-hours window (timer resets on return in-band)

// Staged liquidation ladder (§21.5.3) — cumulative sell %, constitutional shape:
export const EJECT_STAGES = [
  { stage: 1, sellPct: 0.10, condition: "De-peg confirmed for more than 12 hours" },
  { stage: 2, sellPct: 0.25, condition: "De-peg for more than 24 hours OR RR < 1.08" },
  { stage: 3, sellPct: 0.50, condition: "De-peg for more than 48 hours OR RR < 1.05" },
  { stage: 4, sellPct: 1.00, condition: "Issuer freeze confirmed OR RR < 1.02" },
] as const;
export const EJECT_PAUSE_RULE_PCT = 0.05; // §21.5.3: pause next stage if price drops >5% from stage start

// Legacy generic band (superseded by PEG_BANDS) — kept for backward-compat imports.
export const EJECT_DEPEG_BAND_LOWER = 0.98;
export const EJECT_DEPEG_BAND_UPPER = 1.02;

// === §22.3 Four Governance Layers (Master Listing 14 / §22.3) — P0-FIX-4 ===
// The legacy engine only had the Monetary (48h DAO) layer. The Master Blueprint
// specifies 4 governance layers, each with its own authority, timelock, and
// scope. The TS reference exposes the layer metadata; the contract will
// implement the actual 4 timelocks.
export const GOVERNANCE_LAYERS = {
  CONSTITUTIONAL: {
    authority: "7/7 Multi-Sig",
    timelock: 90 * 24 * 60 * 60 * 1000,  // 90 days
    scope: "Immutable parameters (core architecture, envelopes, hard floors, liquidation staging)",
  },
  MONETARY: {
    authority: "DAO Vote 51%",
    timelock: 48 * 60 * 60 * 1000,  // 48 hours
    scope: "RR target, fee structure, smoothing parameters",
  },
  RISK: {
    authority: "Risk Council 4/7",
    timelock: 24 * 60 * 60 * 1000,  // 24 hours
    scope: "Haircuts, thresholds, eject parameters, LCR targets",
  },
  EMERGENCY: {
    authority: "Emergency Council 4/7",
    timelock: 0,  // instant
    scope: "Pause operations, force rebalance, emergency eject",
  },
} as const;

// Parameter → governance layer mapping (per §22.4)
// Each parameter is owned by exactly one governance layer. Constitutional
// parameters are immutable (cannot be changed post-genesis). The other 3
// layers can change their parameters within an envelope (specified as a
// [min, max] range in 1e18 equivalent units where applicable).
export const PARAMETER_REGISTRY = {
  PAR: { layer: "CONSTITUTIONAL", immutable: true },
  RR_HARD_FLOOR: { layer: "CONSTITUTIONAL", immutable: true },
  ADMISSIBILITY_ENVELOPES: { layer: "CONSTITUTIONAL", immutable: true },
  RR_TARGET: { layer: "CONSTITUTIONAL", immutable: true }, // v2.0 §14.6.3 (line ~9374): RR_TARGET 1.10e18 — Constitutional (7/7 Multi-Sig); the former MONETARY classification was a v1.x row (Task 8-b fix)
  MINT_FEE_BPS: { layer: "MONETARY", envelope: [0, 100] },
  REDEEM_FEE_NORMAL: { layer: "MONETARY", envelope: [0, 100] },
  REDEEM_FEE_STRESS: { layer: "RISK", envelope: [0, 200] },
  REDEEM_FEE_DEFENSIVE: { layer: "RISK", envelope: [0, 500] },
  LCR_TARGET: { layer: "RISK", envelope: [0.8e18, 1.2e18] },
  HAIRCUTS: { layer: "RISK" },
  DEPEG_WINDOW: { layer: "RISK" },
  // --- AUDIT F-6 registrations (equation-by-equation audit): previously
  // ungoverned constants now each owned by exactly one governance layer ---
  MIN_PROFITABILITY_USD: { layer: "RISK", envelope: [0, 1000] },      // §12.8 ε ($10)
  // === Task 8-b §12.3.3 wiring: the per-asset-class slippage tolerances are
  // GOVERNED parameters of the execution layer ("changed through the
  // parameter-registry process with publication (§22.3), rather than
  // compile-time constants") — Risk Council 4/7, 24h timelock (§11.10 row
  // "Slippage tolerance τ; turnover cap; pool fraction"). =====================
  SLIPPAGE_TOLERANCES: { layer: "RISK", envelope: [0.001e18, 0.03e18] }, // §12.3.3 per-class τ (0.5%/1.0%/1.5%)
  // === Task 8-int §2.9 registration: MAX_VELOCITY (max per-component weight
  // velocity, §8.3 caps 0.5%/0.5%/0.3%/0.3%/0.2%/0.2%/0.5%) is a governed
  // parameter — "Max weight velocity MAX_VELOCITY … Risk Council (4/7)"
  // (v2.0 §2.9 constants table). Registered so no execution constant stays
  // ungoverned (audit F-6 discipline). Values live in §8.3 VELOCITY_CAPS.
  MAX_VELOCITY: { layer: "RISK", envelope: [0.001e18, 0.01e18] }, // per day, §8.3 caps
  MARP_BETA: { layer: "RISK", envelope: [0.1e18, 0.9e18] },          // §10.6 β (0.50)
  MARP_URGENCY_MIN: { layer: "RISK", envelope: [0, 0.5e18] },        // §10.2 U_min (0.05)
  LAMBDA_1_DEVIATION_VALUE: { layer: "RISK", envelope: [0, 1e18] },  // §10.9 λ₁ (0.40)
  GAS_FALLBACK_USD: { layer: "RISK", envelope: [0, 500] },           // §11.8 gas ($50)
  POOL_DEPTH_24H: { layer: "RISK", envelope: [0, 100e18] },          // §11.4 pool depth (feed + $4M fallback)
  REBALANCE_FEE_BPS: { layer: "MONETARY", envelope: [0, 100] },      // §20.4 0.20%
  REDEEM_SLIPPAGE_TAU_USER: { layer: "RISK", envelope: [0, 0.05e18] }, // §19.4 τ_user (0.5%)
  QUOTE_DEADLINE_MINUTES: { layer: "RISK", envelope: [1, 60] },      // §19.7 5-min deadline
  ORACLE_CORRELATION_THRESHOLD: { layer: "RISK", envelope: [0.005e18, 0.05e18] }, // §17.9 1.5%
  CONCENTRATION_WARN_PCT: { layer: "RISK", envelope: [0.1e18, 0.3e18] },  // §15.6.1 25%
  CONCENTRATION_LIMIT_PCT: { layer: "CONSTITUTIONAL", immutable: true }, // §15.6.1 30% hard block
  CONCENTRATION_CRISIS_LIMIT_PCT: { layer: "RISK", envelope: [0.3e18, 0.4e18] }, // §15.6.1 35% crisis (4/7 + 24h)
  // EMERGENCY actions
  PAUSE_MINT: { layer: "EMERGENCY" },
  PAUSE_REDEEM: { layer: "EMERGENCY" },
  FORCE_REBALANCE: { layer: "EMERGENCY" },
  EMERGENCY_EJECT: { layer: "EMERGENCY" },
} as const;

// Type alias for the governance layer names (used by engine.ts's
// getParameterGovernance helper).
export type GovernanceLayerName = keyof typeof GOVERNANCE_LAYERS;

// === §14.2 Governance Hierarchy (legacy table, retained for the existing UI) ===
export const GOVERNANCE_HIERARCHY = [
  { scope: "Constitutional (methodology, envelopes)", authority: "Multi-Sig (7/7)", timelock: "90 days" },
  { scope: "Monetary (fees, RR target)", authority: "DAO Vote (51%)", timelock: "48h" },
  { scope: "Risk (haircuts, thresholds)", authority: "Risk Council (4/7)", timelock: "24h" },
  { scope: "Emergency (pause/eject)", authority: "Multi-Sig (4/7)", timelock: "Instant" },
] as const;

// === §21.2/§21.4 Six-State Risk Machine (S1–S6) — the authoritative table ===
// Classification: pure function of (RR_t, LCR_t), worse metric binds.
//   S1 NORMAL    RR ≥ 1.10, LCR ≥ 1.00   S2 CAUTION   1.05≤RR<1.10, LCR ≥ 0.90
//   S3 STRESS    1.02≤RR<1.05, LCR ≥ 0.80  S4 DEFENSIVE 1.00≤RR<1.02, LCR ≥ 0.70
//   S5 EMERGENCY RR < 1.00 (hard-floor breach only — LCR any)
//   S6 RECOVERY  RR ≥ 1.05 (rising), LCR ≥ 0.90 — residual/climb-back posture
// Actions per §21.4 (fee/urgency/sweep/oracle-confirmation/notification rows):
export type ProtocolStatus = "NORMAL" | "CAUTION" | "STRESS" | "DEFENSIVE" | "EMERGENCY" | "RECOVERY";

export const RISK_STATE_MACHINE = [
  { status: "NORMAL",    minting: "Allowed",           redemption: "Allowed (0.15%)",          rebalancing: "Active (urgency 1)",        rrTarget: 1.10, lcrBand: "LCR ≥ 1.00", oracle: "Standard validation",            notification: "Quarterly", sweep: "$10,000" },
  { status: "CAUTION",   minting: "Throttled (50%)",   redemption: "Allowed (0.15%)",          rebalancing: "Active (urgency 2)",        rrTarget: 1.08, lcrBand: "LCR ≥ 0.90", oracle: "Dual-source confirmation",       notification: "Monthly",   sweep: "$10,000" },
  { status: "STRESS",    minting: "Paused",           redemption: "Allowed (0.50%)",          rebalancing: "Active — emergency (urgency 3)", rrTarget: 1.05, lcrBand: "LCR ≥ 0.80", oracle: "Dual-source, tightened bounds",  notification: "Weekly",    sweep: "$10,000" },
  { status: "DEFENSIVE", minting: "Paused",           redemption: "Allowed (1.00%)",          rebalancing: "Active — forced (urgency 4)",   rrTarget: 1.03, lcrBand: "LCR ≥ 0.70", oracle: "Full multi-source quorum",       notification: "Daily",     sweep: "$10,000" },
  { status: "EMERGENCY", minting: "Paused",           redemption: "PAUSED",                    rebalancing: "PAUSED (council-directed only)", rrTarget: 1.00, lcrBand: "Any",   oracle: "Quorum + circuit breakers",      notification: "Immediate", sweep: "Paused" },
  { status: "RECOVERY",  minting: "Throttled (25%)",   redemption: "Allowed (0.30%)",          rebalancing: "Active (urgency 2)",        rrTarget: 1.08, lcrBand: "LCR ≥ 0.90", oracle: "Dual-source confirmation",       notification: "Weekly",    sweep: "$10,000" },
] as const;

// RECOVERY_CONFIRMATION_PERIOD = 48h (§2.9/§21.3) — every upward step requires
// 48h sustained at the destination state's threshold; degradation is immediate.
export const RECOVERY_CONFIRMATION_PERIOD_HOURS = 48;

// === §25 Honest Status ===
// AUDIT F-5 (equation-by-equation audit): the two former lines overclaimed —
// "VaR/CVaR + MASE ensemble" (no VaR/CVaR/MDD estimator exists in the pilot)
// and "confidence scoring" (the §17.6 Confidence_G aggregate is not computed).
// Both are corrected to describe what is actually implemented; the full
// itemized pilot-substitution list lives in honest-status.ts
// (getPilotDisclosures) and is published by /api/honest-status.
export const HONEST_STATUS = [
  { metric: "Conceptual Architecture", state: "Solid — Master v1.0 specification" },
  { metric: "Mathematical Consistency", state: "Chain-linked index verified end-to-end; MASE/MARP are pilot substitutes (no VaR/CVaR/MDD/covariance estimators yet — §5–7 symbolic forms not filled with guesses)" },
  { metric: "Mint/Redemption", state: "Priced against adaptive reference index (not fixed basket); settles at NAV per §19.3.2 with §19.4 minOut/τ_user guards" },
  { metric: "Oracle Architecture", state: "Multi-source validation pipeline (§17.3 checks + median quorum + §17.9 correlation counter); pilot witnesses are synthetic over one upstream feed; §17.6 confidence aggregate NOT yet computed" },
  { metric: "Gold in Index", state: "Gold IS a first-class index component (20-32% envelope); index/reserve gold separation is accounting-only in the pilot (EQ-104 disclosed compromise)" },
  { metric: "Sharia Status", state: "Designed for Sharia review (independent scholarly review required)" },
  { metric: "Production Authorization", state: "NO — validation program (Chapter 23) is a precondition" },
] as const;

// === §25.3 Claims NOT Supported ===
export const UNSUPPORTED_CLAIMS = [
  { claim: '"Automatic full Sharia compliance"', reason: "Requires independent scholarly review from a recognised Sharia board (not yet obtained)." },
  { claim: '"σ_NAV = 4.34%"', reason: "Preliminary simulation; methodology, dataset, confidence intervals not disclosed." },
  { claim: '"Immune to all market shocks"', reason: "Cannot be claimed without full validation program (Chapter 23)." },
  { claim: '"1 MTQ = 1 Big Mac"', reason: "Replaced with 'targets global purchasing-power index.'" },
  { claim: '"Optimal"', reason: "No weight is optimal until it survives the research program." },
  { claim: '"Fixed composition"', reason: "v1.0: composition is ADAPTIVE — no fixed weights." },
  { claim: '"Guaranteed outcomes"', reason: "v1.0: methodology is fixed, outcomes are not." },
  { claim: '"Final optimal percentages"', reason: "No percentage is final until validation completes." },
  // v2.0 §25.3 additions (rows 9–11 of the consolidated unsupported-claims table)
  { claim: '"94/100 Utility Score"', reason: "Prior-architecture marketing figure; not evidence for MTQΣ (M10)." },
  { claim: '"4x rebalances per year"', reason: "Unverified frequency claim from the superseded design; MARP trades only on justified urgency (M7)." },
  { claim: '"World\'s first" (any superlative)', reason: "Cannot be substantiated; comparative claims require evidence per §25.6." },
  { claim: '"MTQ Σ holds 27% USD, 26% gold" (as composition)', reason: "Those figures are the STRATEGIC PRIOR (soft anchor §3.2), not holdings; live weights differ in general (M2/I3)." },
] as const;

// === RECONCILIATION: v1.2 → v1.0 Changes ===
export const RECONCILIATION_CHANGES = [
  { area: "Basket Definition", v1_2: "Fixed q_i (5 currencies, no gold)", v1_0: "Adaptive W_t (7 components incl. Gold + CHF)" },
  { area: "Weight States", v1_2: "Single target (26.25% + θ ±3%)", v1_0: "Four states: Prior, Target, Smoothed, Execution" },
  { area: "Weighting Engine", v1_2: "Adaptive Macro Engine (VIX/DXY)", v1_0: "MASE ensemble (5+ models)" },
  { area: "Gold in Index", v1_2: "Gold NOT in index (reserve only)", v1_0: "Gold IS in index (20-32% envelope)" },
  { area: "Constituency", v1_2: "Fixed 5 currencies", v1_0: "Eligibility engine over expandable universe" },
  { area: "Index Formula", v1_2: "Simple GFB_t / GFB_base", v1_0: "Chain-linked: NAV_t = G_t × Σ W_i × (P_i/P_{i,0})" },
  { area: "Rebalancing", v1_2: "Trigger + 24h direction lock", v1_0: "MARP: daily calc, urgency, no-trade zones, 6-level hierarchy" },
  { area: "Constraints", v1_2: "Gold clamped 22-30%", v1_0: "Per-component admissibility envelopes" },
  { area: "Reserve Gold", v1_2: "Core 20% + buffer 62.5%", v1_0: "Mandatorily separate from index gold" },
  { area: "Validation", v1_2: "Monte Carlo only", v1_0: "Full research program (backtest 2010+, walk-forward, stress)" },
  { area: "CHF", v1_2: "Not included", v1_0: "5% prior, 3-7% envelope" },
] as const;

// === Legacy constants retained for backward compat (v1.2 → superseded) ===
// These are kept ONLY for the testnet pilot's existing deployed contracts.
// The new engine uses STRATEGIC_PRIOR + ADMISSIBILITY_ENVELOPES instead.
export const Q_USD = 0.389;   // SUPERSEDED — use STRATEGIC_PRIOR.USD
export const Q_EUR = 0.278;   // SUPERSEDED — use STRATEGIC_PRIOR.EUR
export const Q_GBP = 0.1669;  // SUPERSEDED — use STRATEGIC_PRIOR.GBP
export const Q_JPY = 0.1111;  // SUPERSEDED — use STRATEGIC_PRIOR.JPY
export const Q_CNY = 0.055;    // SUPERSEDED — use STRATEGIC_PRIOR.CNY
export const BASE_EUR_USD = 1.05;
export const BASE_GBP_USD = 1.25;
export const BASE_JPY_USD = 0.0067;
export const BASE_CNY_USD = 0.14;
export const BASE_GOLD_WEIGHT = 0.2625;   // SUPERSEDED — use STRATEGIC_PRIOR.Gold
export const GOLD_WEIGHT_LOWER = 0.22;    // SUPERSEDED — use ADMISSIBILITY_ENVELOPES.Gold.lower
export const GOLD_WEIGHT_UPPER = 0.30;    // SUPERSEDED — use ADMISSIBILITY_ENVELOPES.Gold.upper
export const ALPHA = 0.15;                 // SUPERSEDED — MASE replaces single-engine approach
export const BETA = 0.10;                  // SUPERSEDED
export const THETA_MAX = 0.03;             // SUPERSEDED
export const LAMBDA_1 = 0.40;              // SUPERSEDED — MASE ensemble weights
export const LAMBDA_2 = 0.30;              // SUPERSEDED
export const LAMBDA_3 = 0.20;              // SUPERSEDED
export const LAMBDA_4 = 0.10;              // SUPERSEDED
export const VIX_MIN = 10;
export const VIX_MAX = 80;
export const DXY_MIN = 80;
export const DXY_MAX = 120;
export const TREASURY_SWEEP_THRESHOLD_USD = 10_000;
export const TREASURY_SWEEP_AUTHORITY = "4/7 Multi-Sig Cold Treasury";
export const REGISTRY_TIMELOCK_HOURS = 48;
export const CONCENTRATION_LIMIT_PCT = 0.30;
export const CONCENTRATION_WARN_PCT = 0.25;
export const CONCENTRATION_CRISIS_LIMIT_PCT = 0.35;
export const ORACLE_STALENESS_MS = 60_000;
export const ORACLE_CONFIDENCE_MAX_PCT = 0.01;
export const ORACLE_DEVIATION_MAX_PCT = 0.025;
export const REINTEGRATION_WEIGHTS = { w1_TimeInBand: 0.40, w2_LiquidityDepth: 0.25, w3_OracleAgreement: 0.20, w4_OneMinusVolatility: 0.15 };
export const REINTEGRATION_THRESHOLD = 0.80;
// §21.5.4 reverse ladder: stricter at every step (score sustained for 24/48/72h)
export const REINTEGRATION_REPURCHASE_STAGES = [0.25, 0.5, 1.0];
export const REINTEGRATION_STAGE_THRESHOLDS = [
  { stage: 1, cumulativeBuyPct: 0.25, score: 0.80, sustainedHours: 24 },
  { stage: 2, cumulativeBuyPct: 0.50, score: 0.85, sustainedHours: 48 },
  { stage: 3, cumulativeBuyPct: 1.00, score: 0.90, sustainedHours: 72 },
] as const;
export const AGGREGATOR_QUOTE_PROVIDERS = ["1inch", "Paraswap"];
// NOTE: RAMP_DURATION_HOURS is defined above (§14.2 Reserve Tiers) — retained here
// would be a duplicate; the canonical export is the one next to BUFFER_GOLD_*.
// Legacy alias kept for backward-compat consumers that imported it from this block.
// (no re-declaration — see line ~158)
