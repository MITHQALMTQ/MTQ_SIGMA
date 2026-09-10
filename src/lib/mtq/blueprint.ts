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
export const STRATEGIC_PRIOR = {
  USD:  0.27,
  EUR:  0.20,
  JPY:  0.09,
  GBP:  0.08,
  CNY:  0.05,
  CHF:  0.05,
  Gold: 0.26,
} as const;

export const STRATEGIC_PRIOR_TABLE = [
  { component: "USD",  weight: 0.27, token: "USDC (Circle)" },
  { component: "EUR",  weight: 0.20, token: "EURC (Circle)" },
  { component: "JPY",  weight: 0.09, token: "Registry-Resolved" },
  { component: "GBP",  weight: 0.08, token: "Registry-Resolved" },
  { component: "CNY",  weight: 0.05, token: "Registry-Resolved (CNH)" },
  { component: "CHF",  weight: 0.05, token: "Registry-Resolved" },
  { component: "Gold", weight: 0.26, token: "PAXG / XAUT (registry-resolved)" },
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
export const CONSTITUTIONAL_INVARIANTS = [
  { id: "I1", description: "PAR = 1.00 basket-unit is immutable.", enforcedBy: "§18.1" },
  { id: "I2", description: "RR_t ≥ 1.00 at all times.", enforcedBy: "§14.2, §22" },
  { id: "I3", description: "The reference basket is governed by a FIXED, PUBLISHED, AUDITABLE METHODOLOGY, not by fixed weights. Live weights computed by MASE under constitutional constraints.", enforcedBy: "§3, §7, §8, §9" },
  { id: "I4", description: "V_net is always calculated with asset-specific haircuts.", enforcedBy: "§14.1" },
  { id: "I5", description: "Minting is always priced against the reference index.", enforcedBy: "§19.2" },
  { id: "I6", description: "The published weight W_t is always the execution weight, not the target or smoothed weight.", enforcedBy: "§24" },
  { id: "I10", description: "Honest status publication is a hard rule.", enforcedBy: "§25" },
  { id: "I11", description: "Daily calculation does not imply daily trading; trading requires economically justified trigger under MARP.", enforcedBy: "§10" },
] as const;

// === §14.1 Haircuts (carried from v1.2 — unchanged) ===
export const HAIRCUTS = {
  USD: 0.005, EUR: 0.007, GBP: 0.01, JPY: 0.01, CNY: 0.015,
  CHF: 0.01,  XAU: 0.01,  T_BILL: 0.02,
} as const;

// === §19.2 Fees (carried from v1.2 + Master Listing 13 state-dependent fees) ===
// The base mint/redeem fee bps are the NORMAL-state defaults. The canonical
// 6-state risk machine (state-machine.ts) provides state-dependent overrides:
//   NORMAL/CAUTION 0.15% (15 bps), STRESS 0.50% (50 bps),
//   DEFENSIVE 1.00% (100 bps), EMERGENCY 2.00% (200 bps), RECOVERY 0.50% (50 bps).
// REDEEM_FEE_STRESS / REDEEM_FEE_DEFENSIVE are separate constants per Listing 13
// (the legacy engine only had a single REDEEM_FEE_BPS; the new state machine
// requires the full ladder).
export const MINT_FEE_BPS = 10;              // 0.10% (NORMAL state default)
export const REDEEM_FEE_BPS = 15;           // 0.15% (NORMAL/CAUTION state default — legacy alias)
export const REDEEM_FEE_NORMAL = 0.0015;     // 0.15% — NORMAL/CAUTION (per Listing 13)
export const REDEEM_FEE_STRESS = 0.005;      // 0.50% — STRESS (per Listing 13)
export const REDEEM_FEE_DEFENSIVE = 0.01;    // 1.00% — DEFENSIVE (per Listing 13)
export const REDEEM_FEE_EMERGENCY = 0.02;     // 2.00% — EMERGENCY (per Listing 13)
export const REDEEM_FEE_RECOVERY = 0.005;    // 0.50% — RECOVERY (per Listing 13)

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

// === §8.4 Smoothing ===
export const SMOOTHING_LAMBDA = 0.20; // 20% EMA weight to new target
export const ROLLING_WINDOW_DAYS = 90;

// === §10 MARP Constants ===
export const SLIPPAGE_TOLERANCE = 0.01; // 1%
export const MAX_DAILY_TURNOVER = 0.05; // 5% of NAV
export const MAX_POOL_FRACTION = 0.10; // 10% of 24h pool depth
export const DIRECTION_LOCK_HOURS = 24;

// === §14.2 Reserve Tiers (carried) ===
export const BUFFER_SIZE = 0.10;
export const CORE_GOLD_WEIGHT = 0.20;
export const BUFFER_GOLD_BASE = 0.625;
export const BUFFER_GOLD_STRESS = 0.85;
export const BUFFER_GOLD_EMERGENCY = 1.00;
export const RAMP_DURATION_HOURS = 24;

// === §14.1 Gold Liquidity (gold is 0% liquid for LCR) ===
export const GOLD_LIQUIDITY_FACTOR = 0.0;

// === §11 Geopolitical Eject ===
export const EJECT_DEPEG_BAND_LOWER = 0.98;
export const EJECT_DEPEG_BAND_UPPER = 1.02;
export const EJECT_STAGES = [
  { stage: 1, sellPct: 0.10, condition: "Depeg detected > 12h" },
  { stage: 2, sellPct: 0.25, condition: "Depeg > 24h OR RR < 1.08" },
  { stage: 3, sellPct: 0.50, condition: "Depeg > 48h OR RR < 1.05" },
  { stage: 4, sellPct: 1.00, condition: "Liquidity collapse OR issuer freeze" },
] as const;

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
  RR_TARGET: { layer: "MONETARY", envelope: [1.05e18, 1.20e18] },
  MINT_FEE_BPS: { layer: "MONETARY", envelope: [0, 100] },
  REDEEM_FEE_NORMAL: { layer: "MONETARY", envelope: [0, 100] },
  REDEEM_FEE_STRESS: { layer: "RISK", envelope: [0, 200] },
  REDEEM_FEE_DEFENSIVE: { layer: "RISK", envelope: [0, 500] },
  LCR_TARGET: { layer: "RISK", envelope: [0.8e18, 1.2e18] },
  HAIRCUTS: { layer: "RISK" },
  DEPEG_WINDOW: { layer: "RISK" },
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

// === §14.1 Risk State Machine (Master Listing 13 / §21.2 — 6 states) ===
// P0-FIX-3: the legacy machine had only 5 states (NORMAL/CAUTION/DEFENSIVE/
// EMERGENCY/RECOVERY); the Master Blueprint v1.0 Listing 13 specifies 6 states
// with S3 STRESS between CAUTION and DEFENSIVE. This file now exports the full
// 6-state ladder; the canonical classification logic lives in state-machine.ts
// (one authoritative function consumed by ALL modules).
//
// STRESS is the new intermediate state (1.02 ≤ RR < 1.05 OR LCR < 0.90). It is
// distinct from CAUTION (1.05 ≤ RR < 1.10) and DEFENSIVE (1.00 ≤ RR < 1.02):
//   - In STRESS, minting is PAUSED (throttle = 0) and the redeem fee is 0.50%
//     (vs CAUTION's 0.15% and DEFENSIVE's 1.00%).
//   - Rebalance urgency is 0.8 (high — start emergency rebalancing preparations).
export type ProtocolStatus = "NORMAL" | "CAUTION" | "STRESS" | "DEFENSIVE" | "EMERGENCY" | "RECOVERY";

export const RISK_STATE_MACHINE = [
  { status: "NORMAL",    minting: "Allowed",            redemption: "Allowed",             rebalancing: "Active",            rrTarget: 1.10 },
  { status: "CAUTION",   minting: "Throttled (50%)",    redemption: "Allowed",             rebalancing: "Active (priority)", rrTarget: 1.08 },
  { status: "STRESS",    minting: "Paused",            redemption: "Allowed (Fee 0.5%)",  rebalancing: "Active (Urgent)",   rrTarget: 1.05 }, // NEW §21.2 S3 STRESS
  { status: "DEFENSIVE", minting: "Paused",             redemption: "Allowed (Fee 1.0%)",  rebalancing: "Active (Emergency)",rrTarget: 1.02 },
  { status: "EMERGENCY", minting: "Paused",             redemption: "Restricted (Fee 2%)", rebalancing: "Active (Force)",    rrTarget: 1.00 },
  { status: "RECOVERY",  minting: "Throttled (25%)",    redemption: "Allowed",             rebalancing: "Active",            rrTarget: 1.08 },
] as const;

// === §25 Honest Status ===
export const HONEST_STATUS = [
  { metric: "Conceptual Architecture", state: "Solid — Master v1.0 specification" },
  { metric: "Mathematical Consistency", state: "Full chain-linked index + VaR/CVaR + MASE ensemble" },
  { metric: "Mint/Redemption", state: "Priced against adaptive reference index (not fixed basket)" },
  { metric: "Oracle Architecture", state: "Canonical multi-source with confidence scoring" },
  { metric: "Gold in Index", state: "Gold IS a first-class index component (20-32% envelope)" },
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
export const REINTEGRATION_WEIGHTS = { w1_TimeInBand: 0.35, w2_LiquidityDepth: 0.25, w3_OracleAgreement: 0.20, w4_OneMinusVolatility: 0.20 };
export const REINTEGRATION_THRESHOLD = 0.80;
export const REINTEGRATION_REPURCHASE_STAGES = [0.25, 0.5, 1.0];
export const AGGREGATOR_QUOTE_PROVIDERS = ["1inch", "Paraswap"];
// NOTE: RAMP_DURATION_HOURS is defined above (§14.2 Reserve Tiers) — retained here
// would be a duplicate; the canonical export is the one next to BUFFER_GOLD_*.
// Legacy alias kept for backward-compat consumers that imported it from this block.
// (no re-declaration — see line ~158)
