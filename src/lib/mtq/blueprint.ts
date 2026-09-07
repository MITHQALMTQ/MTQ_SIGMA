// MTQΣ Blueprint — Immutable Constants & Reference Types
// Source of Truth: MTQΣ_Blueprint.docx v1.2 (FINAL CLOSED-LOOP)
// All numeric values are taken verbatim from the blueprint sections §2, §3, §4, §6, §7, §8.

export interface FxRates {
  EUR_USD: number; // USD per 1 EUR
  GBP_USD: number; // USD per 1 GBP
  JPY_USD: number; // USD per 1 JPY
  CNY_USD: number; // USD per 1 CNY (offshore CNH)
  XAU_USD: number; // USD per 1 troy oz gold (PAXG reference)
  VIX: number; // CBOE Volatility Index (points)
  DXY: number; // US Dollar Index (points)
  fetchedAt: number; // epoch ms
  source: string;
}

// §2.1 — Fixed basket quantities (q_i), expressed in USD-equivalent at base date.
// Immutable except by constitutional governance (7/7 Multi-Sig, 90-day timelock).
export const Q_USD = 0.389;
export const Q_EUR = 0.278;
export const Q_GBP = 0.1669;
export const Q_JPY = 0.1111;
export const Q_CNY = 0.055;

// §2.3 — Base FX fixings (Jan 1, 2026 00:00 UTC, genesis oracles). Used ONLY to normalise the index.
export const BASE_EUR_USD = 1.05;
export const BASE_GBP_USD = 1.25;
export const BASE_JPY_USD = 0.0067;
export const BASE_CNY_USD = 0.14;

// GFB_base denominator (raw basket value at base date), precomputed:
// 0.389*1.00 + 0.278*1.05 + 0.1669*1.25 + 0.1111*0.0067 + 0.055*0.14
export const GFB_BASE_DENOMINATOR =
  Q_USD * 1.0 +
  Q_EUR * BASE_EUR_USD +
  Q_GBP * BASE_GBP_USD +
  Q_JPY * BASE_JPY_USD +
  Q_CNY * BASE_CNY_USD; // ≈ 0.89796937

// §3 — MTQ reference price safety band (circuit breakers)
export const PRICE_SAFETY_LOWER = 0.5; // 0.50 USD
export const PRICE_SAFETY_UPPER = 2.0; // 2.00 USD

// §3.4 — Fees
export const MINT_FEE_BPS = 10; // 0.10%  (1 - 0.001)
export const REDEEM_FEE_BPS = 15; // 0.15%

// §4.1.1 — Constitutional haircut table (H_j)
export const HAIRCUTS = {
  USD: 0.005, // USDC, USDP — 0.5%
  EUR: 0.007, // EURC — 0.7%
  GBP: 0.01, // Registry-resolved — 1.0%
  JPY: 0.01, // 1.0%
  CNY: 0.015, // 1.5%
  XAU: 0.01, // PAXG, XAUT — 1.0%
  T_BILL: 0.02, // BUIDL (if approved) — 2.0%
} as const;

// §4.2.1 — Reserve Ratio constitutional tiers
export const RR_TARGET = 1.1; // 110% — normal operating buffer
export const RR_STRESS = 1.05; // 105% — defensive posture
export const RR_HARD = 1.0; // 100% — must never breach

// §4.3 — Liquidity Coverage Ratio
export const LCR_TARGET = 1.0;
export const STRESS_REDEMPTION_RATE = 0.25; // 25% of circulating supply in 30 days

// §4.3.1 — Liquid assets definition: stablecoins 100% liquid, gold 0% for LCR
export const GOLD_LIQUIDITY_FACTOR = 0.0;

// §6.4 — Adaptive Macro Engine coefficients
export const ALPHA = 0.15; // VIX sensitivity
export const BETA = 0.1; // DXY sensitivity
export const THETA_MAX = 0.03; // ±3% max shift per cycle

// §6.5 — Base gold weight & bounds
export const BASE_GOLD_WEIGHT = 0.2625; // 26.25%
export const GOLD_WEIGHT_LOWER = 0.22; // 22%
export const GOLD_WEIGHT_UPPER = 0.3; // 30%

// §6.6 — EMA smoothing
export const SMOOTHING_LAMBDA = 0.2; // 20%
export const ROLLING_WINDOW_DAYS = 90;

// §6.2 — Signal plausible ranges (validation)
export const VIX_MIN = 10;
export const VIX_MAX = 80;
export const DXY_MIN = 80;
export const DXY_MAX = 120;

// §7.4 / §7.6 — Rebalancing & execution
export const SLIPPAGE_TOLERANCE = 0.01; // 1%
export const MAX_DAILY_TURNOVER = 0.05; // 5% of NAV
export const MAX_POOL_FRACTION = 0.1; // 10% of 24h pool depth
export const DIRECTION_LOCK_HOURS = 24;

// §7.3 — Objective function coefficients
export const LAMBDA_1 = 0.4; // Deviation
export const LAMBDA_2 = 0.3; // Cost
export const LAMBDA_3 = 0.2; // Urgency
export const LAMBDA_4 = 0.1; // Turnover

// §8 — Dynamic Buffer
export const BUFFER_SIZE = 0.1; // 10% of liability
export const CORE_GOLD_WEIGHT = 0.2; // 20% of core is gold
export const BUFFER_GOLD_BASE = 0.625; // BASE state
export const BUFFER_GOLD_STRESS = 0.85; // STRESS state
export const BUFFER_GOLD_EMERGENCY = 1.0; // EMERGENCY state
export const RAMP_DURATION_HOURS = 24;

// §11 — Geopolitical Eject staged liquidation ladder
export const EJECT_DEPEG_BAND_LOWER = 0.98;
export const EJECT_DEPEG_BAND_UPPER = 1.02;
export const EJECT_STAGES = [
  { stage: 1, sellPct: 0.1, condition: "Depeg detected > 12h" },
  { stage: 2, sellPct: 0.25, condition: "Depeg > 24h OR RR < 1.08" },
  { stage: 3, sellPct: 0.5, condition: "Depeg > 48h OR RR < 1.05" },
  { stage: 4, sellPct: 1.0, condition: "Liquidity collapse OR issuer freeze" },
] as const;

// §14.1 — Risk State Machine
export type ProtocolStatus =
  | "NORMAL"
  | "CAUTION"
  | "DEFENSIVE"
  | "EMERGENCY"
  | "RECOVERY";

export interface StatusPolicy {
  status: ProtocolStatus;
  minting: string;
  redemption: string;
  rebalancing: string;
  rrTarget: number;
}

export const RISK_STATE_MACHINE: StatusPolicy[] = [
  { status: "NORMAL", minting: "Allowed", redemption: "Allowed", rebalancing: "Active", rrTarget: RR_TARGET },
  { status: "CAUTION", minting: "Throttled (50%)", redemption: "Allowed", rebalancing: "Active (priority)", rrTarget: 1.08 },
  { status: "DEFENSIVE", minting: "Paused", redemption: "Allowed (Fee 0.5%)", rebalancing: "Active (Emergency)", rrTarget: RR_STRESS },
  { status: "EMERGENCY", minting: "Paused", redemption: "Restricted (Fee 2%)", rebalancing: "Active (Force)", rrTarget: RR_HARD },
  { status: "RECOVERY", minting: "Throttled (25%)", redemption: "Allowed", rebalancing: "Active", rrTarget: 1.08 },
];

// §14.2 — Governance hierarchy
export const GOVERNANCE_HIERARCHY = [
  { scope: "Constitutional (GFB q_i)", authority: "Multi-Sig (7/7)", timelock: "90 days" },
  { scope: "Monetary (RR Target, Fees)", authority: "DAO Vote (51%)", timelock: "48h" },
  { scope: "Risk (Thresholds, Haircuts)", authority: "Risk Council (4/7)", timelock: "24h" },
  { scope: "Emergency (Pause/Eject)", authority: "Multi-Sig (4/7)", timelock: "Instant" },
] as const;

// §2.1.1 — Basket display table
export const BASKET_TABLE = [
  { currency: "USD", asset: "USDC (Circle)", quantity: Q_USD, weight: 0.389 },
  { currency: "EUR", asset: "EURC (Circle)", quantity: Q_EUR, weight: 0.278 },
  { currency: "GBP", asset: "Registry-Resolved (§5)", quantity: Q_GBP, weight: 0.1669 },
  { currency: "JPY", asset: "Registry-Resolved (§5)", quantity: Q_JPY, weight: 0.1111 },
  { currency: "CNY", asset: "Registry-Resolved (CNH, §5)", quantity: Q_CNY, weight: 0.055 },
] as const;

// §15.2 — Honest status table
export const HONEST_STATUS = [
  { metric: "Conceptual Architecture", state: "Solid" },
  { metric: "Mathematical Consistency", state: "Fixed in v1.2 (Dimensionally coherent)" },
  { metric: "Mint/Redemption", state: "Fixed (Priced against GFB)" },
  { metric: "Oracle Architecture", state: "Specified (Timestamp + Confidence)" },
  { metric: "Geopolitical Eject", state: "Staged (10/25/50/100%)" },
  { metric: "Sharia Status", state: "Designed for Sharia review (Independent review required)" },
  { metric: "Production Authorization", state: "NO (Candidate for testnet)" },
] as const;

// §15.1 — Removed claims (transparency)
export const REMOVED_CLAIMS = [
  { removed: '"100% Halal / Fatwa-ready"', replaced: '"Designed for Sharia review." (independent review required)' },
  { removed: '"94/100 Utility Score"', replaced: "Removed. (Not mathematically demonstrated.)" },
  { removed: '"σNAV = 4.34%"', replaced: "Removed. (Replaced with design target.)" },
  { removed: '"Crisis-Proof"', replaced: '"designed to resist depeg."' },
  { removed: '"1 MTQ = 1 Big Mac"', replaced: '"targets global purchasing power index."' },
  { removed: '"Optimal"', replaced: '"candidate parameterization."' },
] as const;

// §3.6 — PriceUpdated event threshold (0.5% change)
export const PRICE_EVENT_THRESHOLD = 0.005; // 0.5%

// §9 — Oracle architecture
export const ORACLE_STALENESS_MS = 60_000;        // §9.2.1
export const ORACLE_CONFIDENCE_MAX_PCT = 0.01;    // §9.2.3
export const ORACLE_DEVIATION_MAX_PCT = 0.025;    // §9.2.4

// §11.3 — Reintegration Score weights (anti-gaming)
// R_score = w1·TimeInBand(48h) + w2·LiquidityDepth + w3·OracleAgreement + w4·(1−Volatility)
// All inputs normalised to [0,1]; threshold >0.80 → staged re-purchase 25%→50%→100%.
export const REINTEGRATION_WEIGHTS = {
  w1_TimeInBand: 0.35,
  w2_LiquidityDepth: 0.25,
  w3_OracleAgreement: 0.20,
  w4_OneMinusVolatility: 0.20,
} as const;
export const REINTEGRATION_THRESHOLD = 0.80;
export const REINTEGRATION_REPURCHASE_STAGES = [0.25, 0.5, 1.0] as const; // 25% → 50% → 100%

// §13.2 — Treasury Sweep
export const TREASURY_SWEEP_THRESHOLD_USD = 10_000; // hot-wallet surplus trigger
export const TREASURY_SWEEP_AUTHORITY = "4/7 Multi-Sig Cold Treasury";

// §5 — Registry governance
export const REGISTRY_TIMELOCK_HOURS = 48;       // §5.10
export const CONCENTRATION_LIMIT_PCT = 0.30;    // §5.6 / §5.2 #8
export const CONCENTRATION_WARN_PCT = 0.25;      // §5.6 warn threshold
export const CONCENTRATION_CRISIS_LIMIT_PCT = 0.35; // §5.6 governance override (4/7, 24h)

// §10 — Execution
export const AGGREGATOR_QUOTE_PROVIDERS = ["1inch", "Paraswap"] as const;
