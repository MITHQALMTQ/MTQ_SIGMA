// MTQΣ — Reference Monetary Engine
// TypeScript implementation of the MTQΣ Master Monetary Architecture v1.0.
// This is the single source of truth for the monetary math. Both the Next.js
// API layer and the live WebSocket feed service import from this module.
//
// v1.0 CHANGES (vs the legacy v1.2 engine):
//   - Basket is now the 7-component Strategic Prior (USD/EUR/JPY/GBP/CNY/CHF/Gold)
//     where Gold is a first-class index component (not just reserve collateral).
//   - computeGfbIndex() uses STRATEGIC_PRIOR with the chain-linked denominator
//     GFB_BASE_DENOMINATOR (which already includes CHF + Gold base fixings).
//   - CHF added as a first-class reserve asset (s.chf, fx.CHF_USD).
//   - The legacy §6/§7/§8 buffer/rebalance/MARP logic is retained verbatim for
//     now (it will be replaced by the MASE ensemble in a future task). The old
//     constants (BASE_GOLD_WEIGHT, GOLD_WEIGHT_LOWER/UPPER, ALPHA, BETA, ...)
//     are imported because that legacy code still references them; they are
//     marked SUPERSEDED in blueprint.ts.
//
// Sections implemented:
//   §2  GFB Index (chain-linked, 7 components incl. Gold + CHF)
//   §3  MTQ Reference Price + liability + safety band
//   §4  Reserve NAV (haircuts), Reserve Ratio, Liquidity Coverage Ratio, status
//   §6  Adaptive Macro Engine (VIX/DXY z-scores, EMA-smoothed target gold weight)
//   §7  Rebalancing Engine (cost-benefit, slippage, direction lock, turnover cap)
//   §8  Dynamic Buffer (BASE/STRESS/EMERGENCY, ramp, total target gold weight)
//   §11 Geopolitical Eject (staged ladder)
//   §12 Mint & Redemption (priced against the GFB Index)
//
// Honest reconciliation note (tokenomics, retained from v1.2 for the legacy
// buffer/MARP path):
//   §6 base gold weight 26.25% == §8 BASE total (0.20 core + 0.10×0.625 buffer).
//   We therefore unify: W_target = clamp( base_gold_from_buffer(RR) + θ_smoothed, 22%, 30% ).
//   In EMERGENCY the buffer base is already 30%, so θ cannot push it higher. ✓

import {
  STRATEGIC_PRIOR,
  GFB_BASE_DENOMINATOR,
  PRICE_SAFETY_LOWER, PRICE_SAFETY_UPPER,
  MINT_FEE_BPS, REDEEM_FEE_BPS,
  HAIRCUTS,
  RR_TARGET, RR_STRESS, RR_HARD, LCR_TARGET, STRESS_REDEMPTION_RATE,
  ALPHA, BETA, THETA_MAX,
  BASE_GOLD_WEIGHT, GOLD_WEIGHT_LOWER, GOLD_WEIGHT_UPPER,
  SMOOTHING_LAMBDA, ROLLING_WINDOW_DAYS,
  VIX_MIN, VIX_MAX, DXY_MIN, DXY_MAX,
  SLIPPAGE_TOLERANCE, MAX_DAILY_TURNOVER, MAX_POOL_FRACTION, DIRECTION_LOCK_HOURS,
  LAMBDA_1, LAMBDA_2, LAMBDA_3, LAMBDA_4,
  BUFFER_SIZE, CORE_GOLD_WEIGHT, BUFFER_GOLD_BASE, BUFFER_GOLD_STRESS, BUFFER_GOLD_EMERGENCY, RAMP_DURATION_HOURS,
  EJECT_DEPEG_BAND_LOWER, EJECT_DEPEG_BAND_UPPER,
  PRICE_EVENT_THRESHOLD,
  REINTEGRATION_WEIGHTS, REINTEGRATION_THRESHOLD, REINTEGRATION_REPURCHASE_STAGES,
  TREASURY_SWEEP_THRESHOLD_USD, TREASURY_SWEEP_AUTHORITY,
  type ProtocolStatus,
  type FxRates,
} from "./blueprint";
import type { FxSnapshot } from "./fx";
import type { OracleBoard, OracleConsensus } from "./oracle";
import { computeConcentration, type AssetRecord, type ConcentrationReport } from "./registry";

export interface ReserveState {
  // Token-unit holdings (USD-denominated assets stored as their native units)
  usdc: number; // USDC units (1 USDC = $1)
  usdp: number; // USDP units (1 USDP = $1) — FIX: second USD issuer (Paxos)
  usdt: number; // USDT units (1 USDT = $1) — FIX: third USD issuer (Tether)
  eurc: number; // EURC units (1 EURC = €1 = FX_EUR/USD dollars)
  gbp: number; // GBP-token units
  jpy: number; // JPY-token units
  cny: number; // CNY-token units
  chf: number; // CHF-token units (NEW v1.0 — 5% strategic prior, 3-7% envelope)
  paxg: number; // PAXG units (1 PAXG = 1 troy oz gold = XAU_USD dollars)
  xaut: number; // XAUT units (1 XAUT = 1 troy oz gold) — FIX: second gold issuer (Tether)

  // Supply
  totalSupply: number; // total MTQΣ minted (ERC-20 totalSupply)
  genesisReserve: number; // MTQΣ locked in Genesis Reserve Account (excluded from circulating)

  // Adaptive macro engine state
  vixHistory: number[]; // rolling 90-day VIX samples
  dxyHistory: number[];
  smoothedGoldWeight: number; // EMA-smoothed target gold weight (fraction)

  // Rebalancing engine state
  lastTradeDir: 0 | 1 | -1; // +1 buy gold, -1 sell gold
  lastTradeAt: number; // epoch ms
  dailyTurnoverUsd: number;
  lastTurnoverResetAt: number;

  // Buffer ramp state
  bufferState: "BASE" | "STRESS" | "EMERGENCY";
  rampStartAt: number;
  rampFromRatio: number;
  rampToRatio: number;

  // Geopolitical eject: per-asset peg health (1.0 = perfect peg)
  pegHealth: { USD: number; EUR: number; GBP: number; JPY: number; CNY: number };
  // How long (hours) each asset has been outside the depeg band
  depegHours: { USD: number; EUR: number; GBP: number; JPY: number; CNY: number };
  // Current eject stage per currency (0 = none)
  ejectStage: { USD: number; EUR: number; GBP: number; JPY: number; CNY: number };

  // §11.3 Reintegration: per-currency reintegration score + repurchase stage
  reintegration: {
    [c in "USD" | "EUR" | "GBP" | "JPY" | "CNY"]: {
      timeInBand48h: number;  // fraction of last 48h inside [0.98,1.02]
      liquidityDepth: number; // normalised 0..1 (vs $1M threshold)
      oracleAgreement: number; // 0..1 (valid feeds / 3)
      volatility: number;    // 0..1 (higher = worse)
      score: number;         // R_score
      repurchaseStage: number; // 0=none, 1=25%, 2=50%, 3=100%
    };
  };

  // §13.2 Treasury Sweep
  treasury: {
    hotWalletUsd: number;       // operational hot-wallet surplus stablecoins
    coldTreasuryUsd: number;    // swept cold-treasury balance
    lastSweepAt: number;
    lastSweepAmount: number;
    totalSwept: number;
  };

  // §8.5 First-Loss Waterfall current layer (1..5) + cumulative consumed per layer
  waterfall: {
    currentLayer: 1 | 2 | 3 | 4 | 5;
    operationalSurplus: number; // USD available in layer 1
    consumed: { surplus: number; bufferFiat: number; bufferGold: number; coreFiat: number; coreGold: number };
  };

  // §3.6 PriceUpdated event log (last N events at >0.5% change)
  priceEvents: { ts: number; oldPrice: number; newPrice: number; changePct: number }[];
  lastLoggedPrice: number;

  // Last macro signal sample (for the stochastic walk)
  lastVix: number;
  lastDxy: number;

  updatedAt: number;
}

// --- Genesis initialisation (§13.1, v1.0 Master Blueprint) -----------------
// Protocol deposits $1,100,000 → buys the 7-component Strategic Prior basket
// (USD 27% · EUR 20% · JPY 9% · GBP 8% · CNY 5% · CHF 5% · Gold 26%) at oracle
// prices → mints 1,000,000 MTQΣ to the Genesis Reserve Account.
// RR = 1,100,000 / (1,000,000 × 1.00) = 1.10 (110%).
// Genesis supply is LOCKED (excluded from circulating supply).
//
// NOTE on Gold (v1.0): Gold is now BOTH in the GFB Index (26% strategic prior,
// 20-32% admissibility envelope) AND a reserve asset. The 26% gold portion of
// the genesis deposit IS the index gold. The legacy §8 buffer (core 20% +
// 10%×62.5% buffer = 26.25% total) is retained verbatim for the rebalance/MARP
// path — it will be replaced by the MASE ensemble + per-component admissibility
// envelopes in a future task.
export function initReserveState(goldPrice: number): ReserveState {
  const initialUsdDeposit = 1_100_000;

  // v1.0: split the entire deposit across the 7 Strategic Prior components.
  // Each component's USD-equivalent notional = deposit × W^Prior_i. The
  // resulting portfolio is the genesis GFB basket; RR = deposit / supply = 1.10.
  const usdTotal  = initialUsdDeposit * STRATEGIC_PRIOR.USD;  // $297K
  const eurcUsd   = initialUsdDeposit * STRATEGIC_PRIOR.EUR;  // $220K
  const jpyUsd   = initialUsdDeposit * STRATEGIC_PRIOR.JPY;  //  $99K
  const gbpUsd   = initialUsdDeposit * STRATEGIC_PRIOR.GBP;  //  $88K
  const cnyUsd   = initialUsdDeposit * STRATEGIC_PRIOR.CNY;  //  $55K
  const chfUsd   = initialUsdDeposit * STRATEGIC_PRIOR.CHF;  //  $55K (NEW v1.0)
  const goldSpend = initialUsdDeposit * STRATEGIC_PRIOR.Gold; // $286K (Gold is now in the index)

  // FIX: split USD across 3 issuers (USDC/Circle, USDP/Paxos, USDT/Tether) — 1/3 each
  const usdc = usdTotal / 3;
  const usdp = usdTotal / 3;
  const usdt = usdTotal / 3;

  // Convert USD-equivalent fiat holdings into native token units (using the
  // base-date fixings so genesis lands at exactly GFB = 1.00).
  const eurc = eurcUsd / 1.05;            // € per $1.05 at base date
  const gbp  = gbpUsd / 1.25;             // £ per $1.25
  const jpy  = jpyUsd / 0.0067;           // ¥ per $0.0067
  const cny  = cnyUsd / 0.14;             // CNH per $0.14
  const chf  = chfUsd / 0.88;             // CHF per $0.88 (BASE_FIXINGS.CHF_USD)
  // FIX: split gold across 2 issuers (PAXG/Paxos, XAUT/Tether) — 50/50
  const paxg = (goldSpend / goldPrice) * 0.5;
  const xaut = (goldSpend / goldPrice) * 0.5;

  return {
    usdc,
    usdp,
    usdt,
    eurc, gbp, jpy, cny, chf,
    paxg,
    xaut,
    totalSupply: 1_000_000, // Genesis supply
    genesisReserve: 1_000_000, // locked
    vixHistory: seedHistory(18.5, 2.0, ROLLING_WINDOW_DAYS),
    dxyHistory: seedHistory(104.2, 2.5, ROLLING_WINDOW_DAYS),
    smoothedGoldWeight: BASE_GOLD_WEIGHT,
    lastTradeDir: 0,
    lastTradeAt: 0,
    dailyTurnoverUsd: 0,
    lastTurnoverResetAt: Date.now(),
    bufferState: "BASE",
    rampStartAt: 0,
    rampFromRatio: BUFFER_GOLD_BASE,
    rampToRatio: BUFFER_GOLD_BASE,
    pegHealth: { USD: 1, EUR: 1, GBP: 1, JPY: 1, CNY: 1 },
    depegHours: { USD: 0, EUR: 0, GBP: 0, JPY: 0, CNY: 0 },
    ejectStage: { USD: 0, EUR: 0, GBP: 0, JPY: 0, CNY: 0 },
    reintegration: {
      USD: { timeInBand48h: 1, liquidityDepth: 1, oracleAgreement: 1, volatility: 0.02, score: 0, repurchaseStage: 0 },
      EUR: { timeInBand48h: 1, liquidityDepth: 1, oracleAgreement: 1, volatility: 0.02, score: 0, repurchaseStage: 0 },
      GBP: { timeInBand48h: 1, liquidityDepth: 0.5, oracleAgreement: 0.66, volatility: 0.05, score: 0, repurchaseStage: 0 },
      JPY: { timeInBand48h: 1, liquidityDepth: 0.5, oracleAgreement: 0.66, volatility: 0.05, score: 0, repurchaseStage: 0 },
      CNY: { timeInBand48h: 1, liquidityDepth: 0.4, oracleAgreement: 0.66, volatility: 0.08, score: 0, repurchaseStage: 0 },
    },
    treasury: {
      hotWalletUsd: 5_000,    // below sweep threshold initially
      coldTreasuryUsd: 0,
      lastSweepAt: 0,
      lastSweepAmount: 0,
      totalSwept: 0,
    },
    waterfall: {
      currentLayer: 1,
      operationalSurplus: 0,
      consumed: { surplus: 0, bufferFiat: 0, bufferGold: 0, coreFiat: 0, coreGold: 0 },
    },
    priceEvents: [],
    lastLoggedPrice: 1.0,
    lastVix: 18.5,
    lastDxy: 104.2,
    updatedAt: Date.now(),
  };
}

function seedHistory(mean: number, sd: number, n: number): number[] {
  const out: number[] = [];
  let last = mean;
  for (let i = 0; i < n; i++) {
    // simple mean-reverting walk
    const shock = (Math.random() - 0.5) * 2 * sd * 0.3;
    last = last + (mean - last) * 0.1 + shock;
    out.push(Math.max(0.01, last));
  }
  return out;
}

// --- §2 GFB Index (v1.0 — 7-component chain-linked) -------------------------
// GFB_t = Σ_i W^Prior_i × P_{i,t}  (then normalised by GFB_BASE_DENOMINATOR so
// GFB = 1.00 exactly at the base date). The 7 components are the Strategic
// Prior: USD, EUR, JPY, GBP, CNY, CHF, Gold. Gold is now a first-class index
// component (P_Gold = XAU_USD).
export function computeGfbIndex(fx: Pick<FxRates, "EUR_USD" | "GBP_USD" | "JPY_USD" | "CNY_USD" | "CHF_USD" | "XAU_USD">): number {
  // Raw USD value of the basket at time t. USD is the unit of account (price 1.0);
  // every other component contributes its USD-equivalent via its FX rate.
  const numerator =
    STRATEGIC_PRIOR.USD  * 1.0 +
    STRATEGIC_PRIOR.EUR  * fx.EUR_USD +
    STRATEGIC_PRIOR.JPY  * fx.JPY_USD +
    STRATEGIC_PRIOR.GBP  * fx.GBP_USD +
    STRATEGIC_PRIOR.CNY  * fx.CNY_USD +
    STRATEGIC_PRIOR.CHF  * fx.CHF_USD +
    STRATEGIC_PRIOR.Gold * fx.XAU_USD;
  // Normalised: GFB_t = numerator / GFB_BASE_DENOMINATOR  (=1.0 at base date).
  // GFB_BASE_DENOMINATOR is the v1.0 chain-linked denominator (includes Gold
  // and CHF at base fixings — see blueprint.ts).
  return numerator / GFB_BASE_DENOMINATOR;
}

// --- §3 MTQ Reference Price -------------------------------------------------
export function computeMtqPrice(gfb: number): number {
  // P_MTQ = GFB_t / GFB_base, with GFB_base = 1.0 (normalised)
  return gfb;
}

export function priceInSafetyBand(p: number): boolean {
  return p >= PRICE_SAFETY_LOWER && p <= PRICE_SAFETY_UPPER;
}

// --- §4 Reserve NAV / RR / LCR ----------------------------------------------
// USD value of each holding (gross), then apply haircuts for NAV.
export function reserveAssetValues(s: ReserveState, fx: FxRates) {
  const usdGross = (s.usdc + s.usdp + s.usdt) * 1.0; // USDC + USDP + USDT combined
  const eurGross = s.eurc * fx.EUR_USD;
  const gbpGross = s.gbp * fx.GBP_USD;
  const jpyGross = s.jpy * fx.JPY_USD;
  const cnyGross = s.cny * fx.CNY_USD;
  const chfGross = s.chf * fx.CHF_USD; // NEW v1.0 — CHF is a first-class reserve component
  const fiatGross = usdGross + eurGross + gbpGross + jpyGross + cnyGross + chfGross;

  // §4.1 Note on Gold: use the more conservative of reference vs executable.
  const goldRef = fx.XAU_USD;
  const goldExec = fx.XAU_USD * 0.995;
  const goldPrice = Math.min(goldRef, goldExec);
  const goldGross = (s.paxg + s.xaut) * goldPrice; // PAXG + XAUT combined

  // Net values (after haircuts)
  const usdNet = usdGross * (1 - HAIRCUTS.USD);
  const eurNet = eurGross * (1 - HAIRCUTS.EUR);
  const gbpNet = gbpGross * (1 - HAIRCUTS.GBP);
  const jpyNet = jpyGross * (1 - HAIRCUTS.JPY);
  const cnyNet = cnyGross * (1 - HAIRCUTS.CNY);
  const chfNet = chfGross * (1 - HAIRCUTS.CHF); // NEW v1.0
  const goldNet = goldGross * (1 - HAIRCUTS.XAU);

  const nav = usdNet + eurNet + gbpNet + jpyNet + cnyNet + chfNet + goldNet;
  const fiatNet = usdNet + eurNet + gbpNet + jpyNet + cnyNet + chfNet;

  // Per-issuer breakdown (for concentration visualization)
  const usdcUsd = s.usdc * 1.0 * (1 - HAIRCUTS.USD);
  const usdpUsd = s.usdp * 1.0 * (1 - HAIRCUTS.USD);
  const usdtUsd = s.usdt * 1.0 * (1 - HAIRCUTS.USD);
  const paxgUsd = s.paxg * goldPrice * (1 - HAIRCUTS.XAU);
  const xautUsd = s.xaut * goldPrice * (1 - HAIRCUTS.XAU);

  return {
    usdGross, eurGross, gbpGross, jpyGross, cnyGross, chfGross, fiatGross,
    goldGross, goldPrice,
    usdNet, eurNet, gbpNet, jpyNet, cnyNet, chfNet, goldNet,
    nav, fiatNet,
    usdcUsd, usdpUsd, usdtUsd, paxgUsd, xautUsd,
  };
}

export function circulatingSupply(s: ReserveState): number {
  return Math.max(0, s.totalSupply - s.genesisReserve);
}

export function computeLiability(s: ReserveState, price: number): number {
  return circulatingSupply(s) * price;
}

export function computeReserveRatio(nav: number, liability: number): number {
  if (liability <= 0) return Infinity; // no circulating supply → fully reserved
  return nav / liability;
}

export function computeLcr(s: ReserveState, vals: { fiatNet: number }, price: number): number {
  const liquidAssets = vals.fiatNet; // stablecoins = 100% liquid; gold = 0%
  const circSupply = circulatingSupply(s);
  const stressDemand = circSupply * price * STRESS_REDEMPTION_RATE;
  if (stressDemand <= 0) return Infinity;
  return liquidAssets / stressDemand;
}

// --- §4.2.2 Status determination --------------------------------------------
export function determineStatus(rr: number, lcr: number): ProtocolStatus {
  if (rr >= RR_TARGET && lcr >= LCR_TARGET) return "NORMAL";
  if (rr >= RR_STRESS && lcr >= 0.9) return "CAUTION";
  if (rr >= RR_HARD) return "DEFENSIVE";
  if (rr < RR_HARD) return "EMERGENCY";
  return "RECOVERY";
}

// --- §6 Adaptive Macro Engine -----------------------------------------------
function rollingStats(hist: number[]): { mean: number; sd: number } {
  const filled = hist.filter((x) => x > 0);
  if (filled.length === 0) return { mean: 0, sd: 0 };
  const mean = filled.reduce((a, b) => a + b, 0) / filled.length;
  const variance = filled.reduce((a, b) => a + (b - mean) * (b - mean), 0) / filled.length;
  return { mean, sd: Math.sqrt(variance) };
}

export function computeZScores(s: ReserveState, vix: number, dxy: number) {
  const v = rollingStats(s.vixHistory);
  const d = rollingStats(s.dxyHistory);
  const eps = 1e-9;
  const zVix = v.sd > eps ? (vix - v.mean) / (v.sd + eps) : 0;
  const zDxy = d.sd > eps ? (dxy - d.mean) / (d.sd + eps) : 0;
  return { zVix, zDxy, vixMean: v.mean, vixSd: v.sd, dxyMean: d.mean, dxySd: d.sd };
}

export function computeRawTargetTheta(zVix: number, zDxy: number): number {
  const theta = ALPHA * zVix + BETA * zDxy;
  return clampSym(theta, -THETA_MAX, THETA_MAX);
}

export function computeRawTargetGoldWeight(zVix: number, zDxy: number): number {
  const theta = computeRawTargetTheta(zVix, zDxy);
  return clamp(BASE_GOLD_WEIGHT + theta, GOLD_WEIGHT_LOWER, GOLD_WEIGHT_UPPER);
}

export function smoothGoldWeight(prev: number, target: number): number {
  if (prev <= 0) return target;
  return SMOOTHING_LAMBDA * target + (1 - SMOOTHING_LAMBDA) * prev;
}

// --- §8 Dynamic Buffer -------------------------------------------------------
export function bufferBaseGoldRatio(rr: number): number {
  if (rr >= RR_TARGET) return BUFFER_GOLD_BASE; // 62.5% → total 26.25%
  if (rr >= RR_STRESS) return BUFFER_GOLD_STRESS; // 85% → total 28.5%
  return BUFFER_GOLD_EMERGENCY; // 100% → total 30%
}

export function currentBufferGoldRatio(s: ReserveState): number {
  if (s.bufferState === "EMERGENCY") return BUFFER_GOLD_EMERGENCY;
  if (s.rampStartAt === 0) {
    return s.bufferState === "BASE" ? BUFFER_GOLD_BASE : BUFFER_GOLD_STRESS;
  }
  const elapsedH = (Date.now() - s.rampStartAt) / 3_600_000;
  if (elapsedH >= RAMP_DURATION_HOURS) return s.rampToRatio;
  const progress = elapsedH / RAMP_DURATION_HOURS;
  const from = s.rampFromRatio;
  const to = s.rampToRatio;
  return from + (to - from) * progress;
}

export function bufferBaseFromRatio(rr: number): "BASE" | "STRESS" | "EMERGENCY" {
  if (rr >= RR_TARGET) return "BASE";
  if (rr >= RR_STRESS) return "STRESS";
  return "EMERGENCY";
}

// Unified target gold weight (tokenomics reconciliation):
// W_target = clamp( buffer_base_gold(RR) + θ_smoothed , 22%, 30% )
export function computeTargetGoldWeight(s: ReserveState, rr: number): number {
  const bufferBase = currentBufferGoldRatio(s); // ∈ {0.625, ~0.85, 1.0} with ramp
  const baseFromBuffer = CORE_GOLD_WEIGHT + BUFFER_SIZE * bufferBase; // 0.20 + 0.10*b
  const target = baseFromBuffer + s.smoothedGoldWeight - BASE_GOLD_WEIGHT; // apply θ = smoothed - base
  return clamp(target, GOLD_WEIGHT_LOWER, GOLD_WEIGHT_UPPER);
}

// --- §7 Rebalancing decision (simplified cost-benefit) ----------------------
export interface RebalanceDecision {
  shouldRebalance: boolean;
  direction: 0 | 1 | -1;
  observedGoldWeight: number;
  targetGoldWeight: number;
  deviation: number; // observed - target (signed)
  tradeUsd: number;
  reason: string;
}

export function maybeResetDailyTurnover(s: ReserveState): void {
  if (Date.now() - s.lastTurnoverResetAt >= 86_400_000) {
    s.dailyTurnoverUsd = 0;
    s.lastTurnoverResetAt = Date.now();
  }
}

export function evaluateRebalance(
  s: ReserveState,
  vals: { nav: number; goldNet: number; fiatNet: number },
  rr: number,
): RebalanceDecision {
  const nav = vals.nav;
  if (nav <= 0) {
    return { shouldRebalance: false, direction: 0, observedGoldWeight: 0, targetGoldWeight: 0, deviation: 0, tradeUsd: 0, reason: "NAV ≤ 0" };
  }
  const observed = vals.goldNet / nav;
  const target = computeTargetGoldWeight(s, rr);
  const deviation = observed - target;

  if (Math.abs(deviation) < 0.005) {
    return { shouldRebalance: false, direction: 0, observedGoldWeight: observed, targetGoldWeight: target, deviation, tradeUsd: 0, reason: "Within tolerance (<0.5%)" };
  }

  // Direction lock (overridden in stress)
  const inStress = rr < RR_STRESS;
  if (!inStress && Date.now() - s.lastTradeAt < DIRECTION_LOCK_HOURS * 3_600_000) {
    if ((deviation > 0 && s.lastTradeDir === -1) || (deviation < 0 && s.lastTradeDir === 1)) {
      return { shouldRebalance: false, direction: 0, observedGoldWeight: observed, targetGoldWeight: target, deviation, tradeUsd: 0, reason: "Direction lock (24h whipsaw guard)" };
    }
  }

  // Trade sizing
  const surplusUsd = Math.abs(deviation) * nav;
  const poolDepth24h = 4_000_000; // assumed PAXG/USDC 24h depth for the pilot
  const maxByPool = MAX_POOL_FRACTION * poolDepth24h;
  let tradeUsd = Math.min(surplusUsd, maxByPool);
  maybeResetDailyTurnover(s);
  const remainingDaily = MAX_DAILY_TURNOVER * nav - s.dailyTurnoverUsd;
  if (tradeUsd > remainingDaily) tradeUsd = Math.max(0, remainingDaily);

  // Cost-benefit (simplified): estimate cost ~ 0.1% slippage + $50 gas equiv
  const estCost = tradeUsd * 0.001 + 50;
  const benefit = Math.abs(deviation) * nav * LAMBDA_1 + (rr < RR_TARGET ? (1 / Math.max(rr, 0.5)) * nav * LAMBDA_3 : 0);
  const direction = deviation > 0 ? -1 : 1; // excess gold → sell; deficit → buy

  if (benefit <= estCost) {
    return { shouldRebalance: false, direction: 0, observedGoldWeight: observed, targetGoldWeight: target, deviation, tradeUsd: 0, reason: `Cost (${estCost.toFixed(0)}) ≥ benefit (${benefit.toFixed(0)})` };
  }
  return { shouldRebalance: true, direction, observedGoldWeight: observed, targetGoldWeight: target, deviation, tradeUsd, reason: "Benefit > cost; executing" };
}

// Apply a rebalance trade in USD terms (mutates state).
export function applyRebalanceTrade(s: ReserveState, decision: RebalanceDecision, goldPrice: number): void {
  if (!decision.shouldRebalance) return;
  const usd = decision.tradeUsd;
  if (decision.direction === -1) {
    // sell gold → buy USDC (simplified: convert to USDC)
    const goldUnits = usd / goldPrice;
    s.paxg = Math.max(0, s.paxg - goldUnits);
    s.usdc += usd;
  } else {
    // buy gold → spend USDC
    s.usdc = Math.max(0, s.usdc - usd);
    const goldUnits = usd / goldPrice;
    s.paxg += goldUnits;
  }
  s.lastTradeDir = decision.direction;
  s.lastTradeAt = Date.now();
  s.dailyTurnoverUsd += usd;
  s.updatedAt = Date.now();
}

// --- §11 Geopolitical Eject -------------------------------------------------
export function updatePegHealth(s: ReserveState, dtHours: number, fx: FxRates) {
  // Simulated per-asset peg drift (honest: labelled as simulated in UI).
  // Stablecoins should sit at 1.0; we apply a tiny mean-reverting shock.
  const drift = (cur: number, amp: number) => {
    const shock = (Math.random() - 0.5) * 2 * amp;
    return Math.max(0.9, Math.min(1.1, cur + (1 - cur) * 0.05 + shock));
  };
  s.pegHealth.USD = drift(s.pegHealth.USD, 0.0005);
  s.pegHealth.EUR = drift(s.pegHealth.EUR, 0.0008);
  s.pegHealth.GBP = drift(s.pegHealth.GBP, 0.0012);
  s.pegHealth.JPY = drift(s.pegHealth.JPY, 0.0012);
  s.pegHealth.CNY = drift(s.pegHealth.CNY, 0.0018);

  const currencies: (keyof typeof s.pegHealth)[] = ["USD", "EUR", "GBP", "JPY", "CNY"];
  for (const c of currencies) {
    const p = s.pegHealth[c];
    const outside = p < EJECT_DEPEG_BAND_LOWER || p > EJECT_DEPEG_BAND_UPPER;
    if (outside) {
      s.depegHours[c] += dtHours;
    } else {
      s.depegHours[c] = Math.max(0, s.depegHours[c] - dtHours * 0.5);
    }
    // Staged ladder
    const h = s.depegHours[c];
    let stage = 0;
    if (h > 48) stage = 3;
    else if (h > 24) stage = 2;
    else if (h > 12) stage = 1;
    if (h > 96 || p < 0.9 || p > 1.1) stage = 4;
    s.ejectStage[c] = stage;
  }
}

// --- §12 Mint & Redemption --------------------------------------------------
export interface MintResult {
  ok: boolean;
  reason?: string;
  inputUsd: number;
  feeUsd: number;
  netUsd: number;
  mtqPrice: number;
  mtqMinted: number;
  throttleFactor: number; // 1.0 normal, 0.5 caution
  newCirculatingSupply: number;
  newReserveRatio: number;
}

export function applyMint(
  s: ReserveState,
  fx: FxRates,
  status: ProtocolStatus,
  inputUsd: number,
): MintResult {
  const gfb = computeGfbIndex(fx);
  const price = computeMtqPrice(gfb);
  if (!priceInSafetyBand(price)) {
    return { ok: false, reason: "MTQ price outside safety band (0.50–2.00 USD); minting paused by circuit breaker.", inputUsd, feeUsd: 0, netUsd: 0, mtqPrice: price, mtqMinted: 0, throttleFactor: 0, newCirculatingSupply: circulatingSupply(s), newReserveRatio: computeReserveRatio(reserveAssetValues(s, fx).nav, computeLiability(s, price)) };
  }
  if (status === "DEFENSIVE" || status === "EMERGENCY") {
    return { ok: false, reason: `${status}: minting paused by Risk State Machine.`, inputUsd, feeUsd: 0, netUsd: 0, mtqPrice: price, mtqMinted: 0, throttleFactor: 0, newCirculatingSupply: circulatingSupply(s), newReserveRatio: computeReserveRatio(reserveAssetValues(s, fx).nav, computeLiability(s, price)) };
  }
  const throttle = status === "CAUTION" ? 0.5 : status === "RECOVERY" ? 0.25 : 1.0;
  const feeUsd = inputUsd * (MINT_FEE_BPS / 10_000);
  const netUsd = inputUsd - feeUsd;
  const minted = (netUsd / price) * throttle;

  // Mutate reserve: deposit USDC (split across 3 USD issuers per concentration policy),
  // mint MTQ to user (circulating supply rises). The concentration rebalancer in the
  // tick loop will re-optimize the split if any issuer exceeds 25%.
  const usdThird = netUsd / 3;
  s.usdc += usdThird;
  s.usdp += usdThird;
  s.usdt += usdThird;
  s.treasury.hotWalletUsd += feeUsd; // fee revenue → hot wallet (§13.2 sweep target)
  s.totalSupply += minted;
  s.updatedAt = Date.now();

  const vals = reserveAssetValues(s, fx);
  const newRr = computeReserveRatio(vals.nav, computeLiability(s, price));
  return {
    ok: true,
    inputUsd,
    feeUsd,
    netUsd,
    mtqPrice: price,
    mtqMinted: minted,
    throttleFactor: throttle,
    newCirculatingSupply: circulatingSupply(s),
    newReserveRatio: newRr,
  };
}

export interface RedeemBasket {
  currency: string;
  token: string;
  usdValue: number;
  nativeAmount: number;
  weight: number;
}

export interface RedeemResult {
  ok: boolean;
  reason?: string;
  inputMtq: number;
  mtqPrice: number;
  // §3.4.2 primary valuation (index-priced) — the arbitrage-safe version
  grossUsd: number;
  feeBps: number;
  feeUsd: number;
  netUsd: number;
  goldUsd: number;
  goldPaxg: number;
  basket: RedeemBasket[];
  newCirculatingSupply: number;
  newReserveRatio: number;
  // Honest audit: §12.2 alternative valuation (Y × NAV_per_token = V_net/S)
  // The blueprint is internally inconsistent between §3.4.2 and §12.2.
  // We compute both and surface the difference; primary settlement uses §3.4.2.
  auditNavPerToken: number;       // V_net / S (book value per MTQ)
  auditGrossUsdNav: number;       // Y × NAV_per_token (§12.2 literal)
  auditDeltaUsd: number;          // §12.2 − §3.4.2 (positive → §12.2 pays more → drains buffer)
  auditNote: string;
}

export function applyRedeem(
  s: ReserveState,
  fx: FxRates,
  status: ProtocolStatus,
  inputMtq: number,
): RedeemResult {
  const gfb = computeGfbIndex(fx);
  const price = computeMtqPrice(gfb);
  const circ = circulatingSupply(s);
  // Honest audit fields (computed pre-settlement so they exist on the error path too)
  const vals0 = reserveAssetValues(s, fx);
  const auditNavPerToken = circ > 0 ? vals0.nav / circ : 0;
  const auditGrossUsdNav = inputMtq * auditNavPerToken;
  const auditNote = "Blueprint §3.4.2 (redeem at P_MTQ) vs §12.2 (redeem at NAV_per_token=V_net/S) conflict. At RR>100% the §12.2 literal pays redeemers MORE than §3.4.2, draining the buffer surplus via arbitrage. We settle on the arbitrage-safe §3.4.2 value; the §12.2 figure is shown for audit only.";
  if (inputMtq > circ) {
    return { ok: false, reason: "Insufficient circulating supply for this redemption in pilot state.", inputMtq, mtqPrice: price, grossUsd: 0, feeBps: 0, feeUsd: 0, netUsd: 0, goldUsd: 0, goldPaxg: 0, basket: [], newCirculatingSupply: circ, newReserveRatio: computeReserveRatio(vals0.nav, computeLiability(s, price)), auditNavPerToken, auditGrossUsdNav, auditDeltaUsd: auditGrossUsdNav, auditNote };
  }
  // Fee by status (§14.1): NORMAL/CAUTION 0.15%, DEFENSIVE 0.5%, EMERGENCY 2%
  let feeBps = REDEEM_FEE_BPS;
  if (status === "DEFENSIVE") feeBps = 50;
  if (status === "EMERGENCY") feeBps = 200;
  const grossUsd = inputMtq * price; // redemption is priced against the GFB Index (§3.4.2)
  const feeUsd = grossUsd * (feeBps / 10_000);
  const netUsd = grossUsd - feeUsd;

  // Release actual reserve composition proportionally (§12.2):
  // gold portion = netUsd * W_target (legacy v1.2 buffer-derived target —
  // retained until the MASE ensemble replaces it). fiat portion split per the
  // 6 non-gold Strategic Prior components (USD/EUR/JPY/GBP/CNY/CHF) renormalised
  // to the non-gold total.
  const vals = reserveAssetValues(s, fx);
  const rr = computeReserveRatio(vals.nav, computeLiability(s, price));
  const wGold = computeTargetGoldWeight(s, rr);
  const goldUsd = netUsd * wGold;
  const fiatUsd = netUsd * (1 - wGold);
  const goldPrice = vals.goldPrice;
  const goldPaxg = goldUsd / goldPrice;

  // v1.0: Strategic Prior weights for the 6 non-gold components, renormalised
  // to the non-gold total (0.27 + 0.20 + 0.09 + 0.08 + 0.05 + 0.05 = 0.74).
  const basketFiatTotal =
    STRATEGIC_PRIOR.USD + STRATEGIC_PRIOR.EUR + STRATEGIC_PRIOR.JPY +
    STRATEGIC_PRIOR.GBP + STRATEGIC_PRIOR.CNY + STRATEGIC_PRIOR.CHF;
  const w = (k: keyof typeof STRATEGIC_PRIOR) => STRATEGIC_PRIOR[k] / basketFiatTotal;
  const basket: RedeemBasket[] = [
    { currency: "USD", token: "USDC", usdValue: fiatUsd * w("USD"), nativeAmount: fiatUsd * w("USD"), weight: STRATEGIC_PRIOR.USD },
    { currency: "EUR", token: "EURC", usdValue: fiatUsd * w("EUR"), nativeAmount: (fiatUsd * w("EUR")) / fx.EUR_USD, weight: STRATEGIC_PRIOR.EUR },
    { currency: "JPY", token: "JPY₿", usdValue: fiatUsd * w("JPY"), nativeAmount: (fiatUsd * w("JPY")) / fx.JPY_USD, weight: STRATEGIC_PRIOR.JPY },
    { currency: "GBP", token: "GBP₿", usdValue: fiatUsd * w("GBP"), nativeAmount: (fiatUsd * w("GBP")) / fx.GBP_USD, weight: STRATEGIC_PRIOR.GBP },
    { currency: "CNY", token: "CNY₿", usdValue: fiatUsd * w("CNY"), nativeAmount: (fiatUsd * w("CNY")) / fx.CNY_USD, weight: STRATEGIC_PRIOR.CNY },
    { currency: "CHF", token: "CHF₿", usdValue: fiatUsd * w("CHF"), nativeAmount: (fiatUsd * w("CHF")) / fx.CHF_USD, weight: STRATEGIC_PRIOR.CHF }, // NEW v1.0
  ];

  // Mutate reserve: burn MTQ from circulating (reduce totalSupply), release assets
  // USD released proportionally across USDC + USDP + USDT; gold across PAXG + XAUT
  s.totalSupply -= inputMtq;
  const usdRelease = basket[0].nativeAmount;
  const usdThirdRelease = usdRelease / 3;
  s.usdc = Math.max(0, s.usdc - usdThirdRelease);
  s.usdp = Math.max(0, s.usdp - usdThirdRelease);
  s.usdt = Math.max(0, s.usdt - usdThirdRelease);
  s.eurc = Math.max(0, s.eurc - basket[1].nativeAmount);
  s.jpy  = Math.max(0, s.jpy  - basket[2].nativeAmount);
  s.gbp  = Math.max(0, s.gbp  - basket[3].nativeAmount);
  s.cny  = Math.max(0, s.cny  - basket[4].nativeAmount);
  s.chf  = Math.max(0, s.chf  - basket[5].nativeAmount); // NEW v1.0
  // Gold released 50/50 PAXG + XAUT
  const goldHalf = goldPaxg / 2;
  s.paxg = Math.max(0, s.paxg - goldHalf);
  s.xaut = Math.max(0, s.xaut - goldHalf);
  s.treasury.hotWalletUsd += feeUsd; // fee revenue → hot wallet
  s.updatedAt = Date.now();

  const newVals = reserveAssetValues(s, fx);
  const newRr = computeReserveRatio(newVals.nav, computeLiability(s, price));
  return {
    ok: true,
    inputMtq,
    mtqPrice: price,
    grossUsd,
    feeBps,
    feeUsd,
    netUsd,
    goldUsd,
    goldPaxg,
    basket,
    newCirculatingSupply: circulatingSupply(s),
    newReserveRatio: newRr,
    auditNavPerToken: circ > 0 ? vals0.nav / circ : 0,
    auditGrossUsdNav,
    auditDeltaUsd: auditGrossUsdNav - grossUsd,
    auditNote,
  };
}

// --- Aggregate snapshot -----------------------------------------------------
export interface MetricsSnapshot {
  fetchedAt: number;
  source: string;
  fx: FxSnapshot;
  gfbIndex: number;
  mtqPrice: number;
  priceInBand: boolean;
  reserve: {
    usdNet: number; eurNet: number; gbpNet: number; jpyNet: number; cnyNet: number; chfNet: number; goldNet: number;
    fiatNet: number; nav: number; goldPrice: number;
  };
  liability: number;
  nav: number;
  reserveRatio: number;
  lcr: number;
  status: ProtocolStatus;
  circulatingSupply: number;
  totalSupply: number;
  genesisReserve: number;
  bufferState: ReserveState["bufferState"];
  bufferGoldRatio: number;
  targetGoldWeight: number;
  observedGoldWeight: number;
  macro: {
    vix: number; dxy: number; zVix: number; zDxy: number;
    vixMean: number; vixSd: number; dxyMean: number; dxySd: number;
    rawTheta: number; rawTarget: number; smoothedTarget: number;
  };
  rebalance: RebalanceDecision;
  pegHealth: ReserveState["pegHealth"];
  ejectStage: ReserveState["ejectStage"];
  // New sections (v2 — full blueprint coverage)
  oracle: OracleBoard | null;
  oraclePaused: boolean;
  registry: AssetRecord[] | null;
  concentration: ConcentrationReport[] | null;
  reintegration: ReserveState["reintegration"];
  treasury: ReserveState["treasury"];
  waterfall: ReserveState["waterfall"];
  priceEvents: ReserveState["priceEvents"];
  // Brand v2: reconciliation + per-issuer holdings
  reconciliation: ReconciliationFinding[];
  redemptionPolicy: typeof REDEMPTION_POLICY;
  perIssuer: { usdcUsd: number; usdpUsd: number; usdtUsd: number; eurcUsd: number; paxgUsd: number; xautUsd: number } | null;
}

export function computeSnapshot(s: ReserveState, fx: FxSnapshot, ctx?: { oracle?: OracleBoard | null; registry?: AssetRecord[] | null }): MetricsSnapshot {
  const gfb = computeGfbIndex(fx);
  const price = computeMtqPrice(gfb);
  const vals = reserveAssetValues(s, fx);
  const nav = vals.nav;
  const liability = computeLiability(s, price);
  const rr = computeReserveRatio(nav, liability);
  const lcr = computeLcr(s, vals, price);
  const status = determineStatus(rr, lcr);
  const observedGold = nav > 0 ? vals.goldNet / nav : 0;
  const targetGold = computeTargetGoldWeight(s, rr);
  const z = computeZScores(s, fx.VIX, fx.DXY);
  const rawTheta = computeRawTargetTheta(z.zVix, z.zDxy);
  const rawTarget = clamp(BASE_GOLD_WEIGHT + rawTheta, GOLD_WEIGHT_LOWER, GOLD_WEIGHT_UPPER);
  const decision = evaluateRebalance(s, vals, rr);

  // Oracle + registry passed from the pilot-state tick (may be null on cold start)
  const oracle = ctx?.oracle ?? null;
  const registry = ctx?.registry ?? null;
  let concentration: ConcentrationReport[] | null = null;
  if (registry) {
    // Per-asset (tokenAddress-keyed) holdings → correct issuer attribution.
    // Uses the ACTUAL per-asset net values (post optimizer), not a theoretical
    // split, so it reflects the §5.6 concentration optimizer's real allocation.
    concentration = computeConcentration(registry, {
      USDC: vals.usdcUsd ?? 0,
      USDP: vals.usdpUsd ?? 0,
      USDT: vals.usdtUsd ?? 0,
      EURC: vals.eurNet, // EUR is single-issuer (EURC/Circle) until a 2nd EUR asset is admitted
      GBP: vals.gbpNet, JPY: vals.jpyNet, CNY: vals.cnyNet,
      PAXG: vals.paxgUsd ?? 0,
      XAUT: vals.xautUsd ?? 0,
    });
  }

  return {
    fetchedAt: fx.fetchedAt,
    source: fx.source,
    fx,
    gfbIndex: gfb,
    mtqPrice: price,
    priceInBand: priceInSafetyBand(price),
    reserve: {
      usdNet: vals.usdNet, eurNet: vals.eurNet, gbpNet: vals.gbpNet, jpyNet: vals.jpyNet, cnyNet: vals.cnyNet,
      chfNet: vals.chfNet,
      goldNet: vals.goldNet, fiatNet: vals.fiatNet, nav: vals.nav, goldPrice: vals.goldPrice,
    },
    liability,
    nav,
    reserveRatio: rr,
    lcr,
    status,
    circulatingSupply: circulatingSupply(s),
    totalSupply: s.totalSupply,
    genesisReserve: s.genesisReserve,
    bufferState: s.bufferState,
    bufferGoldRatio: currentBufferGoldRatio(s),
    targetGoldWeight: targetGold,
    observedGoldWeight: observedGold,
    macro: {
      vix: fx.VIX, dxy: fx.DXY,
      zVix: z.zVix, zDxy: z.zDxy,
      vixMean: z.vixMean, vixSd: z.vixSd, dxyMean: z.dxyMean, dxySd: z.dxySd,
      rawTheta, rawTarget, smoothedTarget: s.smoothedGoldWeight,
    },
    rebalance: decision,
    pegHealth: s.pegHealth,
    ejectStage: s.ejectStage,
    oracle,
    oraclePaused: oracle?.anyPaused ?? false,
    registry,
    concentration,
    reintegration: s.reintegration,
    treasury: s.treasury,
    waterfall: s.waterfall,
    priceEvents: s.priceEvents,
    reconciliation: getReconciliationFindings(s, { usdcUsd: vals.usdcUsd ?? 0, usdpUsd: vals.usdpUsd ?? 0, usdtUsd: vals.usdtUsd ?? 0, paxgUsd: vals.paxgUsd ?? 0, xautUsd: vals.xautUsd ?? 0, nav: vals.nav, eurNet: vals.eurNet }),
    redemptionPolicy: REDEMPTION_POLICY,
    perIssuer: { usdcUsd: vals.usdcUsd ?? 0, usdpUsd: vals.usdpUsd ?? 0, usdtUsd: vals.usdtUsd ?? 0, eurcUsd: vals.eurNet, paxgUsd: vals.paxgUsd ?? 0, xautUsd: vals.xautUsd ?? 0 },
  };
}

// --- helpers ----------------------------------------------------------------
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function clampSym(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Advance macro history (call ~ every tick; dtHours is simulated elapsed)
export function advanceMacro(s: ReserveState, vix: number, dxy: number, dtHours: number) {
  const v = clamp(vix, VIX_MIN, VIX_MAX);
  const d = clamp(dxy, DXY_MIN, DXY_MAX);
  s.lastVix = v;
  s.lastDxy = d;
  s.vixHistory.push(v);
  s.dxyHistory.push(d);
  if (s.vixHistory.length > ROLLING_WINDOW_DAYS) s.vixHistory.shift();
  if (s.dxyHistory.length > ROLLING_WINDOW_DAYS) s.dxyHistory.shift();
  const vStats = rollingStats(s.vixHistory);
  const dStats = rollingStats(s.dxyHistory);
  const zVix = vStats.sd > 1e-9 ? (v - vStats.mean) / (vStats.sd + 1e-9) : 0;
  const zDxy = dStats.sd > 1e-9 ? (d - dStats.mean) / (dStats.sd + 1e-9) : 0;
  const rawTarget = computeRawTargetGoldWeight(zVix, zDxy);
  s.smoothedGoldWeight = smoothGoldWeight(s.smoothedGoldWeight, rawTarget);
}

// Stochastic macro walk (honest: simulated pilot macro signals)
export function stepMacroSignals(prev: { vix: number; dxy: number }): { vix: number; dxy: number } {
  const vix = clamp(prev.vix + (Math.random() - 0.5) * 1.2 + (18 - prev.vix) * 0.02, VIX_MIN, VIX_MAX);
  const dxy = clamp(prev.dxy + (Math.random() - 0.5) * 0.8 + (104 - prev.dxy) * 0.02, DXY_MIN, DXY_MAX);
  return { vix, dxy };
}

// Update buffer state + ramp on RR change (call after metrics recompute)
export function updateBufferState(s: ReserveState, rr: number) {
  const newState = bufferBaseFromRatio(rr);
  if (newState === s.bufferState) return;
  if (newState === "EMERGENCY") {
    s.bufferState = "EMERGENCY";
    s.rampStartAt = 0;
  } else {
    s.rampStartAt = Date.now();
    s.rampFromRatio = currentBufferGoldRatio(s);
    s.rampToRatio = newState === "BASE" ? BUFFER_GOLD_BASE : BUFFER_GOLD_STRESS;
    s.bufferState = newState;
  }
}

// --- §11.3 Reintegration Score (Anti-Gaming) --------------------------------
// R_score = w1·TimeInBand(48h) + w2·LiquidityDepth + w3·OracleAgreement + w4·(1−Volatility)
// All inputs normalised to [0,1]; threshold >0.80 → staged re-purchase 25%→50%→100%.
export function updateReintegration(
  s: ReserveState,
  board: OracleBoard | null,
  dtHours: number,
) {
  const currencies: ("USD" | "EUR" | "GBP" | "JPY" | "CNY")[] = ["USD", "EUR", "GBP", "JPY", "CNY"];
  for (const c of currencies) {
    const r = s.reintegration[c];
    // Time-in-band: increases when peg is inside [0.98,1.02]; decays when outside.
    const inBand = s.pegHealth[c] >= EJECT_DEPEG_BAND_LOWER && s.pegHealth[c] <= EJECT_DEPEG_BAND_UPPER;
    // dtHours is simulated elapsed; we approximate 48h window fraction.
    if (inBand) {
      r.timeInBand48h = Math.min(1, r.timeInBand48h + dtHours / 48);
    } else {
      r.timeInBand48h = Math.max(0, r.timeInBand48h - dtHours / 48);
    }
    // Liquidity depth: randomised around per-currency baseline (honest: simulated).
    const base = c === "USD" ? 1.0 : c === "EUR" ? 0.95 : c === "CNY" ? 0.4 : 0.5;
    r.liquidityDepth = clamp(base + (Math.random() - 0.5) * 0.1, 0, 1);
    // Oracle agreement: valid feeds / 3 (from oracle board if present, else last known)
    if (board) {
      const pairMap: Record<string, string> = { USD: "—", EUR: "EUR/USD", GBP: "GBP/USD", JPY: "JPY/USD", CNY: "CNY/USD" };
      const cons = board.pairs.find((p) => p.pair === pairMap[c]);
      if (cons) {
        r.oracleAgreement = cons.validCount / 3;
        // Volatility from oracle spread (bps → fraction)
        r.volatility = clamp(cons.spreadBps / 100, 0, 1);
      }
    }
    // R_score
    r.score =
      REINTEGRATION_WEIGHTS.w1_TimeInBand * r.timeInBand48h +
      REINTEGRATION_WEIGHTS.w2_LiquidityDepth * r.liquidityDepth +
      REINTEGRATION_WEIGHTS.w3_OracleAgreement * r.oracleAgreement +
      REINTEGRATION_WEIGHTS.w4_OneMinusVolatility * (1 - r.volatility);
    // Repurchase staging: only for currencies that were previously ejected
    if (s.ejectStage[c] > 0 && r.score > REINTEGRATION_THRESHOLD) {
      r.repurchaseStage = Math.min(3, r.repurchaseStage + 1);
      // As repurchase progresses, reduce eject stage
      if (r.repurchaseStage >= 3) {
        s.ejectStage[c] = Math.max(0, s.ejectStage[c] - 1);
        if (s.ejectStage[c] === 0) r.repurchaseStage = 0;
      }
    } else if (r.score < REINTEGRATION_THRESHOLD * 0.6) {
      r.repurchaseStage = 0;
    }
  }
}

// --- §13.2 Treasury Sweep ---------------------------------------------------
// If hot-wallet surplus stablecoins > $10,000 → sweep excess to 4/7 Cold Treasury.
export function maybeTreasurySweep(s: ReserveState, feeRevenueAddedUsd = 0) {
  // Accumulate fee revenue into the hot wallet (operational surplus)
  s.treasury.hotWalletUsd += feeRevenueAddedUsd;
  if (s.treasury.hotWalletUsd > TREASURY_SWEEP_THRESHOLD_USD) {
    const excess = s.treasury.hotWalletUsd - 5_000; // keep $5k operating float
    if (excess > 0) {
      s.treasury.hotWalletUsd -= excess;
      s.treasury.coldTreasuryUsd += excess;
      s.treasury.lastSweepAt = Date.now();
      s.treasury.lastSweepAmount = excess;
      s.treasury.totalSwept += excess;
    }
  }
}

// --- §8.5 First-Loss Waterfall ----------------------------------------------
// 5 layers: (1) Operational Surplus → (2) Buffer Fiat → (3) Buffer Gold →
// (4) Core Fiat → (5) Core Gold. Apply a loss; track consumed per layer.
export function applyLoss(s: ReserveState, vals: { fiatNet: number; goldNet: number }, lossUsd: number) {
  let remaining = lossUsd;
  s.waterfall.consumed.surplus = 0; // reset for this loss event tracking is cumulative; we add
  const layers = [
    { name: "surplus", cap: () => s.treasury.hotWalletUsd + s.waterfall.operationalSurplus, consume: (amt: number) => {
      const fromSurplus = Math.min(s.treasury.hotWalletUsd, amt);
      s.treasury.hotWalletUsd -= fromSurplus;
      s.waterfall.operationalSurplus -= Math.min(s.waterfall.operationalSurplus, amt - fromSurplus);
      s.waterfall.consumed.surplus += amt;
    } },
    { name: "bufferFiat", cap: () => vals.fiatNet * 0.10 * (1 - currentBufferGoldRatio(s)), consume: (amt: number) => { s.waterfall.consumed.bufferFiat += amt; } },
    { name: "bufferGold", cap: () => vals.goldNet * 0.10 * currentBufferGoldRatio(s), consume: (amt: number) => { s.waterfall.consumed.bufferGold += amt; } },
    { name: "coreFiat", cap: () => vals.fiatNet * 0.80, consume: (amt: number) => { s.waterfall.consumed.coreFiat += amt; } },
    { name: "coreGold", cap: () => vals.goldNet * 0.20, consume: (amt: number) => { s.waterfall.consumed.coreGold += amt; } },
  ] as const;
  for (let i = 0; i < layers.length && remaining > 0; i++) {
    const layer = layers[i];
    const cap = layer.cap();
    const consumed = Math.min(cap, remaining);
    layer.consume(consumed);
    remaining -= consumed;
    if (remaining > 0) s.waterfall.currentLayer = (i + 2) as 1 | 2 | 3 | 4 | 5;
  }
  if (remaining <= 0) s.waterfall.currentLayer = 1;
}

// --- §3.6 PriceUpdated events (0.5% change threshold) -----------------------
export function maybePriceEvent(s: ReserveState, newPrice: number) {
  if (s.lastLoggedPrice <= 0) { s.lastLoggedPrice = newPrice; return; }
  const diff = Math.abs(newPrice - s.lastLoggedPrice);
  const changePct = diff / s.lastLoggedPrice;
  if (changePct >= PRICE_EVENT_THRESHOLD) {
    s.priceEvents.unshift({ ts: Date.now(), oldPrice: s.lastLoggedPrice, newPrice, changePct });
    if (s.priceEvents.length > 20) s.priceEvents.pop();
    s.lastLoggedPrice = newPrice;
  }
}

// --- §10.1 Quote-based execution (route quote simulation) -------------------
export interface ExecQuote {
  provider: "1inch" | "Paraswap";
  oracleRate: number;
  quoteRate: number;
  bound: number;        // oracleRate × (1∓τ)
  withinBound: boolean;
  effectiveSlippageBps: number;
  amountUsd: number;
}
export function simulateQuote(amountUsd: number, isBuyGold: boolean, oracleGoldPrice: number): ExecQuote {
  const provider: "1inch" | "Paraswap" = Math.random() < 0.5 ? "1inch" : "Paraswap";
  // Realistic small slippage ~0.05%–0.4%
  const slip = 0.0005 + Math.random() * 0.0035;
  const oracleRate = oracleGoldPrice;
  const quoteRate = isBuyGold ? oracleRate * (1 + slip) : oracleRate * (1 - slip);
  const bound = isBuyGold ? oracleRate * (1 + SLIPPAGE_TOLERANCE) : oracleRate * (1 - SLIPPAGE_TOLERANCE);
  const withinBound = isBuyGold ? quoteRate <= bound : quoteRate >= bound;
  return {
    provider, oracleRate, quoteRate, bound, withinBound,
    effectiveSlippageBps: Math.round(slip * 10_000),
    amountUsd,
  };
}

// --- FIX: §5.6 Concentration Rebalancing -------------------------------------
// Adjusts the USDC/USDP split to bring the maximum issuer share under the
// --- FIX: §5.6 Multi-Issuer Concentration Optimizer -------------------------
// 3 issuers: CIRCLE (USDC + EURC), PAXOS (USDP + PAXG), TETHER (USDT + XAUT).
// EURC is fixed to Circle (no second EUR issuer yet). GBP/JPY/CNY are TBD.
// The optimizer adjusts the splittable pools (USDC/USDP/USDT, PAXG/XAUT) to
// minimize the maximum issuer share, targeting ≤ 25% (warn threshold,
// headroom under the 30% hard limit).
export interface ConcentrationFixResult {
  adjusted: boolean;
  sharesBefore: { CIRCLE: number; PAXOS: number; TETHER: number };
  sharesAfter: { CIRCLE: number; PAXOS: number; TETHER: number };
  splits: { usdc: number; usdp: number; usdt: number; paxg: number; xaut: number };
  target: number; // 0.25
  reason: string;
}

export function rebalanceForConcentration(
  s: ReserveState,
  vals: { usdcUsd: number; usdpUsd: number; usdtUsd: number; paxgUsd: number; xautUsd: number; nav: number; eurNet: number },
): ConcentrationFixResult {
  const nav = vals.nav;
  const TARGET = 0.25;
  const usdNetFactor = 1 - HAIRCUTS.USD;
  const goldNetFactor = 1 - HAIRCUTS.XAU;

  const sharesBefore = {
    CIRCLE: nav > 0 ? (vals.usdcUsd + vals.eurNet) / nav : 0,
    PAXOS: nav > 0 ? (vals.usdpUsd + vals.paxgUsd) / nav : 0,
    TETHER: nav > 0 ? (vals.usdtUsd + vals.xautUsd) / nav : 0,
  };
  const maxBefore = Math.max(sharesBefore.CIRCLE, sharesBefore.PAXOS, sharesBefore.TETHER);

  if (nav <= 0) {
    return { adjusted: false, sharesBefore, sharesAfter: sharesBefore, splits: { usdc: s.usdc, usdp: s.usdp, usdt: s.usdt, paxg: s.paxg, xaut: s.xaut }, target: TARGET, reason: "NAV ≤ 0" };
  }
  if (maxBefore <= TARGET) {
    return { adjusted: false, sharesBefore, sharesAfter: sharesBefore, splits: { usdc: s.usdc, usdp: s.usdp, usdt: s.usdt, paxg: s.paxg, xaut: s.xaut }, target: TARGET, reason: "All issuers ≤ 25% warn threshold" };
  }

  // Total splittable pools (in gross token units)
  const totalUsdGross = s.usdc + s.usdp + s.usdt;
  const totalGoldGross = s.paxg + s.xaut;

  // Circle's floor = EURC (fixed). Circle's USDC budget = max(0, TARGET×NAV − EURC_usd)
  const circleUsdNetBudget = Math.max(0, TARGET * nav - vals.eurNet);
  const usdcGross = Math.min(totalUsdGross, circleUsdNetBudget / usdNetFactor);
  const remainingUsdGross = Math.max(0, totalUsdGross - usdcGross);

  // Split remaining USD equally between USDP (Paxos) and USDT (Tether)
  const usdpGross = remainingUsdGross / 2;
  const usdtGross = remainingUsdGross / 2;

  // Now balance gold between PAXG (Paxos) and XAUT (Tether) so both ≤ 25%.
  // Clean approach: split gold 50/50 by default; only deviate if one issuer
  // would breach the 25% cap. This guarantees a real split (the previous
  // min-budget logic could dump all gold into one issuer when budgets were
  // asymmetric or when one issuer's USD share was already small).
  const paxosUsdNet = usdpGross * usdNetFactor;
  const tetherUsdNet = usdtGross * usdNetFactor;
  const halfGoldGross = totalGoldGross / 2;
  let paxgGross = halfGoldGross;
  let xautGross = halfGoldGross;
  // Cap check 1: Paxos = USDP_net + PAXG_net ≤ TARGET×NAV
  const paxosWithHalf = paxosUsdNet + halfGoldGross * goldNetFactor;
  if (paxosWithHalf > TARGET * nav) {
    const maxPaxgNet = Math.max(0, TARGET * nav - paxosUsdNet);
    paxgGross = Math.min(halfGoldGross, maxPaxgNet / goldNetFactor);
    xautGross = totalGoldGross - paxgGross;
  }
  // Cap check 2: Tether = USDT_net + XAUT_net ≤ TARGET×NAV
  const tetherWithXaut = tetherUsdNet + xautGross * goldNetFactor;
  if (tetherWithXaut > TARGET * nav) {
    const maxXautNet = Math.max(0, TARGET * nav - tetherUsdNet);
    xautGross = Math.min(xautGross, maxXautNet / goldNetFactor);
    paxgGross = totalGoldGross - xautGross;
  }

  s.usdc = usdcGross;
  s.usdp = usdpGross;
  s.usdt = usdtGross;
  s.paxg = paxgGross;
  s.xaut = xautGross;

  const sharesAfter = {
    CIRCLE: (usdcGross * usdNetFactor + vals.eurNet) / nav,
    PAXOS: (usdpGross * usdNetFactor + paxgGross * goldNetFactor) / nav,
    TETHER: (usdtGross * usdNetFactor + xautGross * goldNetFactor) / nav,
  };

  const maxAfter = Math.max(sharesAfter.CIRCLE, sharesAfter.PAXOS, sharesAfter.TETHER);
  return {
    adjusted: true,
    sharesBefore, sharesAfter,
    splits: { usdc: usdcGross, usdp: usdpGross, usdt: usdtGross, paxg: paxgGross, xaut: xautGross },
    target: TARGET,
    reason: maxAfter <= TARGET
      ? "Multi-issuer split: all 3 issuers ≤ 25% warn threshold"
      : `Optimized: max issuer ${(maxAfter * 100).toFixed(1)}% (Circle EURC floor limits further reduction)`,
  };
}

// --- FIX: §12.2 vs §3.4.2 Reconciliation --------------------------------------
// The blueprint is internally inconsistent: §3.4.2 prices redemption at P_MTQ
// (index price — arbitrage-safe), §12.2 at NAV_per_token = V_net/S (book value
// per token — would drain the buffer surplus at RR>100%).
// CANONICAL POLICY: §3.4.2 is the settlement price. §12.2's NAV_per_token is
// an INFORMATIONAL "book value per token" metric, NOT a settlement price.
export const REDEMPTION_POLICY = {
  canonical: "§3.4.2 — Redeem at P_MTQ (index price, arbitrage-safe)",
  informational: "§12.2 — NAV per token (book value, informational only, NOT settlement)",
  reason:
    "At RR>100%, §12.2's Y×(V_net/S) pays redeemers MORE than the index price, " +
    "draining the 10% buffer surplus via arbitrage. §3.4.2's Y×P_MTQ preserves " +
    "the buffer and is economically correct. The pilot settles on §3.4.2 and " +
    "surfaces §12.2's figure as an informational book-value metric only.",
  status: "RECONCILED — §3.4.2 adopted as canonical",
} as const;

// --- Reconciliation status (for the Honest Audit panel) ---------------------
export interface ReconciliationFinding {
  id: string;
  title: string;
  severity: "fixed" | "outstanding" | "informational";
  description: string;
  resolution?: string;
}

export function getReconciliationFindings(s: ReserveState, vals: { usdcUsd: number; usdpUsd: number; usdtUsd: number; paxgUsd: number; xautUsd: number; nav: number; eurNet: number }): ReconciliationFinding[] {
  const circleUsd = vals.usdcUsd + vals.eurNet;
  const paxosUsd = vals.usdpUsd + vals.paxgUsd;
  const tetherUsd = vals.usdtUsd + vals.xautUsd;
  const circleShare = vals.nav > 0 ? circleUsd / vals.nav : 0;
  const paxosShare = vals.nav > 0 ? paxosUsd / vals.nav : 0;
  const tetherShare = vals.nav > 0 ? tetherUsd / vals.nav : 0;
  const maxShare = Math.max(circleShare, paxosShare, tetherShare);
  const maxIssuer = circleShare === maxShare ? "Circle" : paxosShare === maxShare ? "Paxos" : "Tether";
  return [
    {
      id: "F1-redemption-contradiction",
      title: "§12.2 vs §3.4.2 redemption price contradiction",
      severity: "fixed",
      description:
        "Blueprint §3.4.2 prices redemption at P_MTQ (index price); §12.2 at NAV_per_token (V_net/S). At RR>100% these diverge, and §12.2 would drain the buffer surplus via arbitrage.",
      resolution:
        "§3.4.2 adopted as the canonical settlement price. §12.2's NAV-per-token retained as an informational 'book value per token' metric, clearly labelled as non-settlement.",
    },
    {
      id: "F2-circle-concentration",
      title: "Genesis issuer concentration breach (§5.6)",
      severity: maxShare > 0.30 ? "outstanding" : maxShare > 0.25 ? "outstanding" : "fixed",
      description:
        `The §5.4.2 genesis mapping (USD→USDC, EUR→EURC, both Circle) placed Circle at ~54% of NAV, breaching the §5.6 30% issuer limit. Fix: admitted USDP (Paxos) + USDT (Tether) as 2nd/3rd USD issuers and XAUT (Tether) as 2nd gold issuer; the §5.6 optimizer now splits USD 3-way and gold 50/50. Current max issuer = ${maxIssuer} at ${(maxShare * 100).toFixed(1)}% of NAV (Circle ${(circleShare * 100).toFixed(1)}% / Paxos ${(paxosShare * 100).toFixed(1)}% / Tether ${(tetherShare * 100).toFixed(1)}%).`,
      resolution:
        maxShare > 0.25
          ? `Multi-issuer optimizer running. Max issuer ${maxIssuer} at ${(maxShare * 100).toFixed(1)}% still above 25% warn threshold — optimizer continues to re-split each tick. EUR remains single-issuer (EURC/Circle) until a 2nd regulated EUR stablecoin is admitted.`
          : "All 3 issuers (Circle/Paxos/Tether) now ≤ 25% warn threshold. USD diversified 3-way (USDC/USDP/USDT) and gold 2-way (PAXG/XAUT). EUR still single-issuer (EURC/Circle) — monitored.",
    },
    {
      id: "F3-vix-dxy-simulated",
      title: "VIX & DXY are simulated pilot signals",
      severity: "informational",
      description:
        "No free no-key REST feed exists for VIX/DXY. The pilot simulates them via a labelled stochastic mean-reverting walk to exercise the §6 Adaptive Macro Engine pipeline. FX (EUR/GBP/JPY/CNY) and gold (XAU) are LIVE from free APIs.",
      resolution: "Labelled 'SIMULATED PILOT MACRO SIGNALS' in the UI. Production requires paid VIX/DXY oracle subscriptions (CBOE/Chainlink).",
    },
    {
      id: "F4-sharia-status",
      title: "Sharia compliance not yet certified",
      severity: "informational",
      description:
        "Blueprint §15.2 honestly states 'Designed for Sharia review (independent review required).' No fatwa has been issued. The v1.2 removed the '100% Halal / Fatwa-ready' claim.",
      resolution: "Independent scholarly review required before any Sharia-compliance claim. The UI displays the honest status.",
    },
  ];
}
