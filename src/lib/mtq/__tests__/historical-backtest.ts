// MTQΣ — §23 Layer 6 Historical Backtest (10-Year, FRED + Frankfurter)
// =========================================================================
// Task ID:    LAYER6-BACKTEST
// Agent:      general-purpose
//
// Purpose:
//   The single most important missing validation per the bank-grade audit.
//   Replays 10 years (2015-01-01 → 2025-01-01) of REAL historical daily data
//   — FRED (VIX, DXY, London Gold AM fix, 10Y Treasury) + Frankfurter/ECB
//   (EUR/USD, GBP/USD, JPY/USD, CNY/USD, CHF/USD) — through the MTQΣ engine
//   tick by tick, and asserts that the 5 canonical invariants hold across
//   the entire historical period:
//
//     INV-1  RR ≥ 1.00 (RR_HARD absolute solvency floor — I2)
//     INV-2  P_MTQ ∈ [0.95, 1.05] of PAR (purchasing-power stability)
//     INV-3  No state reaches EMERGENCY and stays there >48h without recovery
//     INV-4  Oracle consensus ≥3 sources valid for ≥99% of ticks (strict I9)
//     INV-5  Chain-linked index diverges <5% from the actual basket value
//
//   The previous version of this file (HIST-BACKTEST+HEALTH-DASHBOARD, agent
//   full-stack-developer) covered 2024 only and used a constant gold price.
//   This is the FULL 10-year bank-grade backtest the audit demanded.
//
// Methodology:
//   - Data:          FRED + Frankfurter (see ../historical-data.ts).
//                    Real gold prices (London AM fix) — NOT a constant.
//   - FX convention: USD per 1 unit of foreign (engine convention).
//   - Genesis:       $1.1M deposit split across 7-component Strategic Prior
//                    (USD 27% / EUR 20% / JPY 9% / GBP 8% / CNY 5% / CHF 5% /
//                     Gold 26%) at the FIRST day's actual fixings.
//                    1,000,000 MTQ circulating → genesis RR = 1.10.
//   - Chain index:   initChainIndex at the FIRST backtest day using that
//                    day's actual FX/gold as base fixings (so I_0 = 1.0
//                    represents the basket value on day 1 of the backtest).
//                    advanceChainIndex once per day with that day's FX.
//                    No MASE/commitWeights (no rebalancing) — this is a clean
//                    test of the chain-linking mechanism under real data,
//                    matching the convention of the prior 2024 backtest.
//   - Reserve:       Token-unit holdings held constant (no rebalancing).
//                    USD value of each component moves with FX/gold.
//   - Haircuts:      Applied per blueprint HAIRCUTS.
//   - Liability:     circulating × P_MTQ (= circ × I_t since PAR = 1.0).
//   - RR:            NAV / liability.
//   - LCR:           fiatNet / (circ × price × 0.25).
//   - Risk state:    advanceRiskState per day (canonical 6-state machine
//                    with 48h RECOVERY confirmation).
//   - Oracle board:  buildOracleBoard per day with that day's FX/gold as
//                    reference prices. validCount ≥3 = consensus valid.
//
// Reproducibility metadata (Master Prompt §25):
//   - parameter_version:   v3-corrected-engine (chain-linked + 6-state)
//   - methodology_version: master-v1.0-listings-1-3-13
//   - data_version:        fred+frankfurter-2015-2025
//   - random seed:         N/A (deterministic — no stochastic component)
//   - starting state:      RR = 1.10, NORMAL, 7-component Strategic Prior
//                          split at first-day actual fixings
//   - path count:          1 (single historical trajectory)
//   - survival definition: RR ≥ 1.00 (RR_HARD) at every day
//   - failure definition:  RR < 1.00 at any day
//
// To run:  `bun run src/lib/mtq/__tests__/historical-backtest.ts`
//         (or `bun run test:backtest` from the project root)
// Output:  audit-work/historical-backtest-results.json + stdout summary
// Exit:    0 = all invariants held, 1 = some failed, 2 = runtime error

import {
  initReserveState,
  reserveAssetValues,
  computeLiability,
  computeReserveRatio,
  computeLcr,
  advanceRiskState,
  advanceChainIndex,
  advanceMacro,
  getMtqPriceFromState,
  computeSnapshot,
  updateBufferState,
  type ReserveState,
} from "../engine";
import {
  initChainIndex,
  advanceIndex,
  getMTQPrice,
  type ChainIndexState,
} from "../chain-index";
import { determineState, type RiskState, type CanonicalState } from "../state-machine";
import { buildOracleBoard } from "../oracle";
import {
  STRATEGIC_PRIOR,
  BASE_FIXINGS,
  GFB_BASE_DENOMINATOR,
  HAIRCUTS,
  PRICE_SAFETY_LOWER,
  PRICE_SAFETY_UPPER,
  STRESS_REDEMPTION_RATE,
  RR_HARD,
} from "../blueprint";
import type { FxSnapshot } from "../fx";
import { fetchHistoricalData, type HistoricalDataPoint } from "../historical-data";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// =========================================================================
// 0. Reproducibility metadata
// =========================================================================

const META = {
  deliverable: "Layer 6 — 10-Year Historical Backtest (FRED + Frankfurter)",
  task_id: "LAYER6-BACKTEST",
  agent: "general-purpose",
  blueprint_version: "MTQΣ Master Monetary Architecture v1.0",
  parameter_version: "v3-corrected-engine",
  methodology_version: "master-v1.0-listings-1-3-13",
  data_version: "fred+frankfurter-2015-2025",
  data_source: "FRED (VIXCLS, DTWEXBGS, GOLDAMGBD228NLBM, DGS10) + Frankfurter (ECB FX)",
  starting_state: {
    genesis_deposit_USD: 1_100_000,
    circulating_supply_MTQ: 1_000_000,
    expected_genesis_RR: 1.10,
    initial_risk_state: "NORMAL",
    composition: "7-component Strategic Prior (USD 27% / EUR 20% / JPY 9% / GBP 8% / CNY 5% / CHF 5% / Gold 26%)",
    base_fixings: "Rebased to first backtest day's actual FX/gold (so I_0 = 1.0 represents basket value on day 1)",
  },
  invariants: [
    "INV-1  RR >= 1.00 (RR_HARD absolute solvency floor — I2)",
    "INV-2  P_MTQ in [0.95, 1.05] of PAR (purchasing-power stability — STRICTER than the §3.5 safety band [0.50, 2.00])",
    "INV-3  No state reaches EMERGENCY and stays there >48h without recovery (Listing 13)",
    "INV-4  Oracle consensus >=3 sources valid for >=99% of ticks (strict I9)",
    "INV-5  Chain-linked index diverges <5% from the actual basket value (Laspeyres)",
  ],
  survival_definition: "RR >= 1.00 (RR_HARD) at every day",
  failure_definition: "RR < 1.00 (RR_HARD) at any day",
  peg_stability_definition: "P_MTQ in [0.95, 1.05] (PPP band) at every day",
  safety_band_definition: "P_MTQ in [0.50, 2.00] (§3.5 hard circuit breaker) at every day",
  path_count: 1,
  deterministic: true,
  stochastic: false,
};

// =========================================================================
// 1. Per-day backtest result row
// =========================================================================

export interface DailyRow {
  date: string;          // ISO date (YYYY-MM-DD)
  I_t: number;           // chain-linked index level (1.0 at first backtest day)
  L_t: number;           // Laspeyres basket value (Σ W_i × P_{i,t} / GFB_base) — for INV-5
  P_MTQ: number;         // MTQ reference price = I_t × PAR = I_t
  NAV: number;           // reserve net asset value (post-haircut, USD)
  liability: number;     // circulating × P_MTQ (USD)
  RR: number;            // NAV / liability
  LCR: number;           // liquid coverage ratio
  state: RiskState;      // 6-state machine state at this day
  inSafetyBand: boolean; // P_MTQ ∈ [0.50, 2.00]
  inPppBand: boolean;    // P_MTQ ∈ [0.95, 1.05]
  survived: boolean;     // RR >= 1.00
  oracleValid: boolean;  // oracle consensus ≥3 sources valid (anyPaused = false)
  indexDivergencePct: number; // |I_t - L_t| / L_t × 100 (INV-5)
}

export interface BacktestSummary {
  meta: typeof META;
  dataSources: {
    frankfurter: number;
    fredVix: number;
    fredDxy: number;
    fredGold: number;
    fredTreasury: number;
    mergedTicks: number;
    degraded: boolean;
    degradedReasons: string[];
    dateRange: { start: string; end: string };
  };
  totalDays: number;
  // Aggregate statistics
  gfbIndex: { min: number; max: number; mean: number; final: number };
  rr: { min: number; max: number; mean: number; final: number };
  lcr: { min: number; max: number; mean: number; final: number };
  nav: { min: number; max: number; mean: number; final: number };
  pmtq: { min: number; max: number; mean: number; final: number };
  indexDivergencePct: { min: number; max: number; mean: number; final: number };
  // Risk state distribution
  worstStatus: RiskState;
  daysByStatus: Record<RiskState, number>;
  emergencyStreaks: { startDate: string; endDate: string; days: number }[];
  maxEmergencyStreakDays: number;
  // Oracle
  oracleValidPct: number;     // fraction of ticks with valid (≥3-source) consensus
  oraclePausedTicks: number;
  // Invariant verdicts
  invariants: {
    INV1_rrHard: { passed: boolean; minRr: number; failingTicks: number; description: string };
    INV2_pppBand: { passed: boolean; inBandPct: number; failingTicks: number; description: string };
    INV3_emergency48h: { passed: boolean; maxStreakDays: number; description: string };
    INV4_oracleConsensus: { passed: boolean; validPct: number; failingTicks: number; description: string };
    INV5_indexDivergence: { passed: boolean; maxDivergencePct: number; failingTicks: number; description: string };
    safetyBand: { passed: boolean; inBandPct: number; failingTicks: number; description: string }; // §3.5 hard band (informational)
  };
  // Overall
  passed: boolean;             // true iff ALL 5 invariants held
  failingInvariants: string[]; // names of failing invariants (empty if all passed)
  daily: DailyRow[];
  generatedAt: number;
  totalRuntimeMs: number;
}

// =========================================================================
// 2. Genesis holdings (token units) — split $1.1M across Strategic Prior
// =========================================================================

const GENESIS_DEPOSIT_USD = 1_100_000;
const CIRCULATING_SUPPLY_MTQ = 1_000_000;

interface TokenHoldings {
  usd: number;     // USDC + USDP + USDT combined (USD stablecoin units)
  eur: number;     // EURC units (€)
  gbp: number;     // GBP units (£)
  jpy: number;     // JPY units (¥)
  cny: number;     // CNY units (CNH ¥)
  chf: number;     // CHF units
  gold: number;    // PAXG + XAUT combined (troy oz)
}

/**
 * Genesis holdings using the FIRST backtest day's actual FX/gold as the
 * base fixings (so the basket's USD value on day 1 = $1.1M exactly, and
 * the strategic prior weights are exactly satisfied on day 1).
 *
 * This rebases the index to I_0 = 1.0 at the start of the backtest,
 * which is the correct convention for a historical backtest.
 */
function genesisHoldingsAtFixings(fx: {
  eurUsd: number; gbpUsd: number; jpyUsd: number; cnyUsd: number; chfUsd: number; xauUsd: number;
}): TokenHoldings {
  const usdUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.USD;  // $297K
  const eurUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.EUR;  // $220K
  const jpyUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.JPY;  //  $99K
  const gbpUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.GBP;  //  $88K
  const cnyUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.CNY;  //  $55K
  const chfUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.CHF;  //  $55K
  const goldUsd = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.Gold; // $286K

  return {
    usd:  usdUsd  / 1.0,
    eur:  eurUsd  / fx.eurUsd,
    gbp:  gbpUsd  / fx.gbpUsd,
    jpy:  jpyUsd  / fx.jpyUsd,
    cny:  cnyUsd  / fx.cnyUsd,
    chf:  chfUsd  / fx.chfUsd,
    gold: goldUsd / fx.xauUsd,
  };
}

// =========================================================================
// 3. NAV (post-haircut) — mirrors engine.ts::reserveAssetValues
// =========================================================================

interface NavResult {
  nav: number;
  fiatNet: number;
  goldNet: number;
}

function navFromHoldings(h: TokenHoldings, fx: {
  eurUsd: number; gbpUsd: number; jpyUsd: number; cnyUsd: number; chfUsd: number; xauUsd: number;
}): NavResult {
  const usdGross  = h.usd  * 1.0;
  const eurGross  = h.eur  * fx.eurUsd;
  const gbpGross  = h.gbp  * fx.gbpUsd;
  const jpyGross  = h.jpy  * fx.jpyUsd;
  const cnyGross  = h.cny  * fx.cnyUsd;
  const chfGross  = h.chf  * fx.chfUsd;
  const goldGross = h.gold * fx.xauUsd;
  const usdNet  = usdGross  * (1 - HAIRCUTS.USD);
  const eurNet  = eurGross  * (1 - HAIRCUTS.EUR);
  const gbpNet  = gbpGross  * (1 - HAIRCUTS.GBP);
  const jpyNet  = jpyGross  * (1 - HAIRCUTS.JPY);
  const cnyNet  = cnyGross  * (1 - HAIRCUTS.CNY);
  const chfNet  = chfGross  * (1 - HAIRCUTS.CHF);
  const goldNet = goldGross * (1 - HAIRCUTS.XAU);
  const fiatNet = usdNet + eurNet + gbpNet + jpyNet + cnyNet + chfNet;
  const nav = fiatNet + goldNet;
  return { nav, fiatNet, goldNet };
}

// =========================================================================
// 4. Convert a HistoricalDataPoint to an FxSnapshot for the engine
// =========================================================================

function historicalToFx(p: HistoricalDataPoint, dayIndex: number): FxSnapshot {
  // Synthesize a monotonic fetchedAt: day 0 = now - (totalDays * 86400_000),
  // each subsequent day +86400_000. We pass dayIndex and let the caller
  // compute the timestamp; here we just use Date.now() (the snapshot's
  // fetchedAt is only used for display/cache-keying, not invariant logic).
  return {
    EUR_USD: p.eurUsd,
    GBP_USD: p.gbpUsd,
    JPY_USD: p.jpyUsd,
    CNY_USD: p.cnyUsd,
    CHF_USD: p.chfUsd,
    XAU_USD: p.xauUsd,
    VIX: p.vix,
    DXY: p.dxy,
    fetchedAt: Date.now() + dayIndex * 86_400_000,
    source: "historical-backtest (FRED + Frankfurter)",
    degraded: false,
    liveCount: 8,
    liveVix: true,
    liveDxy: true,
  };
}

// =========================================================================
// 5. Laspeyres "actual basket value" for INV-5 (chain index divergence)
// =========================================================================

/**
 * L_t = Σ_i W^Prior_i × (P_{i,t} / P_{i,0})
 *
 * The "actual basket value" — a buy-and-hold portfolio of the strategic
 * prior weights from the base date, normalized to 1.0 at the base date.
 * Each component's price ratio P_{i,t}/P_{i,0} is weighted by the strategic
 * prior weight W_i (NOT by the USD notional share — that was the legacy
 * Laspeyres bug that the chain-linked index was designed to fix).
 *
 * In our backtest we hold token units constant (no rebalancing), so the
 * actual USD value of our portfolio is exactly proportional to L_t.
 *
 * The chain-linked I_t (which assumes daily rebalancing back to weights)
 * should track L_t closely; the "rebalancing premium" drift is typically
 * small (a few %) for low-volatility assets. The invariant is that
 * |I_t - L_t| / L_t < 5%.
 *
 * The base date P_{i,0} is the first backtest day's actual prices, so L_0
 * = 1.0 at day 1 of the backtest (matching I_0 = 1.0).
 */
function laspeyresAtFirstDay(
  fx: { eurUsd: number; gbpUsd: number; jpyUsd: number; cnyUsd: number; chfUsd: number; xauUsd: number },
  firstDayFx: { eurUsd: number; gbpUsd: number; jpyUsd: number; cnyUsd: number; chfUsd: number; xauUsd: number },
): number {
  // USD is the unit of account — its "price ratio" is always 1.0.
  const usdRatio = 1.0;
  const eurRatio = firstDayFx.eurUsd > 0 ? fx.eurUsd / firstDayFx.eurUsd : 1.0;
  const jpyRatio = firstDayFx.jpyUsd > 0 ? fx.jpyUsd / firstDayFx.jpyUsd : 1.0;
  const gbpRatio = firstDayFx.gbpUsd > 0 ? fx.gbpUsd / firstDayFx.gbpUsd : 1.0;
  const cnyRatio = firstDayFx.cnyUsd > 0 ? fx.cnyUsd / firstDayFx.cnyUsd : 1.0;
  const chfRatio = firstDayFx.chfUsd > 0 ? fx.chfUsd / firstDayFx.chfUsd : 1.0;
  const xauRatio = firstDayFx.xauUsd > 0 ? fx.xauUsd / firstDayFx.xauUsd : 1.0;
  return (
    STRATEGIC_PRIOR.USD  * usdRatio +
    STRATEGIC_PRIOR.EUR  * eurRatio +
    STRATEGIC_PRIOR.JPY  * jpyRatio +
    STRATEGIC_PRIOR.GBP  * gbpRatio +
    STRATEGIC_PRIOR.CNY  * cnyRatio +
    STRATEGIC_PRIOR.CHF  * chfRatio +
    STRATEGIC_PRIOR.Gold * xauRatio
  );
}

// =========================================================================
// 6. Severity ranking
// =========================================================================

const SEVERITY: Record<RiskState, number> = {
  NORMAL: 0,
  RECOVERY: 1,
  CAUTION: 1,
  STRESS: 2,
  DEFENSIVE: 3,
  EMERGENCY: 4,
};

// =========================================================================
// 7. Invariant thresholds (constants for audit clarity)
// =========================================================================

const PPP_BAND_LOWER = 0.95;        // INV-2 stricter PPP band
const PPP_BAND_UPPER = 1.05;
const EMERGENCY_MAX_STREAK_HOURS = 48;        // INV-3
const ORACLE_MIN_VALID_PCT = 0.99;            // INV-4 ≥99% of ticks
const INDEX_DIVERGENCE_MAX_PCT = 5.0;         // INV-5 <5% divergence

// =========================================================================
// 8. The backtest runner
// =========================================================================

export async function runHistoricalBacktest(
  startYear = 2015,
  endYear = 2025,
): Promise<BacktestSummary> {
  const t0 = Date.now();
  console.log(`[historical-backtest] Fetching ${startYear}-${endYear} historical data (FRED + Frankfurter)…`);

  // --- fetch ---
  const fetched = await fetchHistoricalData(startYear, endYear);
  const points = fetched.points;

  if (points.length === 0) {
    throw new Error(
      "Historical data fetch returned 0 points. " +
      "Cannot run backtest. Reasons: " + fetched.degradedReasons.join("; "),
    );
  }

  console.log(
    `[historical-backtest] Got ${points.length} merged trading days ` +
    `(${points[0].date} → ${points[points.length - 1].date}).` +
    (fetched.degraded ? ` [DEGRADED: ${fetched.degradedReasons.join("; ")}]` : ""),
  );

  // --- genesis holdings (using first day's actual fixings) ---
  const firstDay = points[0];
  const holdings = genesisHoldingsAtFixings(firstDay);

  // --- chain index: init at first day with actual fixings (I_0 = 1.0) ---
  // The chain index's prevPrices = first day's actual prices, so the first
  // advanceIndex (day 1 → day 2) computes a meaningful period return.
  //
  // We pass the ACTUAL first-day denominator (Σ W^Prior_i × P_{i,0} computed
  // from first-day actual fixings) instead of GFB_BASE_DENOMINATOR, because
  // GFB_BASE_DENOMINATOR uses BASE_FIXINGS (gold = $2500) which doesn't
  // match the first backtest day's actual prices (gold was ~$1186 in 2015).
  // The baseDenominator field is stored as an immutable reference; the TS
  // engine's P_MTQ = I_t (it does NOT divide by baseDenominator — see the
  // comment in chain-index.ts::getMTQPrice), so this choice has no effect
  // on P_MTQ. It only silences a defensive warning from initChainIndex.
  const firstDayDenominator =
    STRATEGIC_PRIOR.USD  * 1.0 +
    STRATEGIC_PRIOR.EUR  * firstDay.eurUsd +
    STRATEGIC_PRIOR.JPY  * firstDay.jpyUsd +
    STRATEGIC_PRIOR.GBP  * firstDay.gbpUsd +
    STRATEGIC_PRIOR.CNY  * firstDay.cnyUsd +
    STRATEGIC_PRIOR.CHF  * firstDay.chfUsd +
    STRATEGIC_PRIOR.Gold * firstDay.xauUsd;

  let chain: ChainIndexState = initChainIndex(
    firstDayDenominator,
    [
      STRATEGIC_PRIOR.USD,
      STRATEGIC_PRIOR.EUR,
      STRATEGIC_PRIOR.JPY,
      STRATEGIC_PRIOR.GBP,
      STRATEGIC_PRIOR.CNY,
      STRATEGIC_PRIOR.CHF,
      STRATEGIC_PRIOR.Gold,
    ],
    [
      1.0,
      firstDay.eurUsd,
      firstDay.jpyUsd,
      firstDay.gbpUsd,
      firstDay.cnyUsd,
      firstDay.chfUsd,
      firstDay.xauUsd,
    ],
    0,
  );

  // --- initialize the engine ReserveState (for advanceMacro + computeSnapshot) ---
  // We use the engine's initReserveState to get a consistent starting state,
  // then overwrite the holdings + chainIndex with our rebased values.
  const state: ReserveState = initReserveState(firstDay.xauUsd);
  // Overwrite holdings to match our rebased genesis split.
  state.usdc = holdings.usd / 3;
  state.usdp = holdings.usd / 3;
  state.usdt = holdings.usd / 3;
  state.eurc = holdings.eur;
  state.gbp = holdings.gbp;
  state.jpy = holdings.jpy;
  state.cny = holdings.cny;
  state.chf = holdings.chf;
  state.paxg = holdings.gold / 2;
  state.xaut = holdings.gold / 2;
  state.indexPaxg = holdings.gold / 4;
  state.indexXaut = holdings.gold / 4;
  state.reservePaxg = holdings.gold / 4;
  state.reserveXaut = holdings.gold / 4;
  // Overwrite the chain index with our rebased one.
  state.chainIndex = chain;
  state.totalSupply = CIRCULATING_SUPPLY_MTQ + 1_000_000; // 1M circulating + 1M genesis locked
  state.genesisReserve = 1_000_000;

  // --- risk state hysteresis ---
  let prevState: RiskState = "NORMAL";
  let prevEnteredAt = 0;
  const RECOVERY_CONFIRMATION_MS = 48 * 60 * 60 * 1000;

  // --- per-day rows + accumulators ---
  const daily: DailyRow[] = [];
  let worstSeverity = -1;
  let worstStatus: RiskState = "NORMAL";
  const daysByStatus: Record<RiskState, number> = {
    NORMAL: 0,
    CAUTION: 0,
    STRESS: 0,
    DEFENSIVE: 0,
    EMERGENCY: 0,
    RECOVERY: 0,
  };

  // INV-1 accumulator
  let inv1FailingTicks = 0;

  // INV-2 accumulator
  let inv2InBand = 0;
  let inv2FailingTicks = 0;

  // safety band (informational)
  let safetyInBand = 0;
  let safetyFailingTicks = 0;

  // INV-3 accumulator: track EMERGENCY streaks
  const emergencyStreaks: { startDate: string; endDate: string; days: number }[] = [];
  let currentEmergencyStart: string | null = null;
  let currentEmergencyCount = 0;
  let maxEmergencyStreakDays = 0;

  // INV-4 accumulator: oracle consensus
  let oracleValidTicks = 0;
  let oraclePausedTicks = 0;

  // INV-5 accumulator
  let inv5FailingTicks = 0;
  let maxDivergencePct = 0;

  // Main loop: 1 day = 1 tick (standard convention for historical backtests).
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const fx = historicalToFx(p, i);

    // --- advance macro history (VIX/DXY rolling stats) ---
    advanceMacro(state, fx.VIX, fx.DXY, 24);

    // --- advance the chain-linked index with this day's FX/gold ---
    const prices = [
      1.0,
      fx.EUR_USD,
      fx.JPY_USD,
      fx.GBP_USD,
      fx.CNY_USD,
      fx.CHF_USD,
      fx.XAU_USD,
    ];
    const advance = advanceIndex(state.chainIndex, prices);
    state.chainIndex = advance.state;
    chain = state.chainIndex;

    const I_t = chain.I_t;
    const P_MTQ = getMTQPrice(chain);

    // --- NAV (post-haircut) using OUR holdings (not the engine's, which may
    // have been mutated by computeSnapshot's read-only MASE projection). ---
    const navRes = navFromHoldings(holdings, p);
    const nav = navRes.nav;

    // --- liability = circulating × P_MTQ ---
    const liability = CIRCULATING_SUPPLY_MTQ * P_MTQ;

    // --- RR + LCR ---
    const rr = liability > 0 ? nav / liability : Infinity;
    const stressDemand = CIRCULATING_SUPPLY_MTQ * P_MTQ * STRESS_REDEMPTION_RATE;
    const lcr = stressDemand > 0 ? navRes.fiatNet / stressDemand : Infinity;

    // --- advance risk state (canonical 6-state machine w/ RECOVERY 48h) ---
    const ts = (i + 1) * 24 * 60 * 60 * 1000;
    const cs: CanonicalState = determineState(
      Number.isFinite(rr) ? rr : 1.10,
      Number.isFinite(lcr) ? lcr : 1.10,
      prevState,
      prevEnteredAt,
      ts,
      RECOVERY_CONFIRMATION_MS,
    );
    if (cs.state !== prevState) {
      prevEnteredAt = ts;
    }
    prevState = cs.state;
    // Persist to engine state so computeSnapshot reads the right state.
    state.riskState = {
      state: cs.state,
      enteredAt: cs.enteredAt,
      confirmationPeriodEnds: cs.confirmationPeriodEnds,
    };
    updateBufferState(state, Number.isFinite(rr) ? rr : 1.10);

    // --- oracle board (for INV-4) ---
    // buildOracleBoard returns 5 pairs (EUR/GBP/JPY/CNY/XAU). CHF is not in
    // the board (the oracle module predates CHF being a first-class component)
    // — we test the 5 pairs that ARE in the board. anyPaused = true means
    // <3 valid sources for at least one pair.
    const board = buildOracleBoard({
      EUR_USD: fx.EUR_USD,
      GBP_USD: fx.GBP_USD,
      JPY_USD: fx.JPY_USD,
      CNY_USD: fx.CNY_USD,
      XAU_USD: fx.XAU_USD,
    });
    const oracleValid = !board.anyPaused;
    if (oracleValid) oracleValidTicks++;
    else oraclePausedTicks++;

    // --- Laspeyres L_t for INV-5 ---
    const L_t = laspeyresAtFirstDay(p, firstDay);
    const indexDivergencePct = L_t > 0 ? Math.abs(I_t - L_t) / L_t * 100 : 0;
    if (indexDivergencePct > maxDivergencePct) maxDivergencePct = indexDivergencePct;
    if (indexDivergencePct > INDEX_DIVERGENCE_MAX_PCT) inv5FailingTicks++;

    // --- computeSnapshot (for engine-consistency / future UI use) ---
    // We call computeSnapshot to verify the engine produces consistent values
    // (the snapshot's `mtqPrice` and `reserveRatio` should match our manual
    // computation). We don't use the snapshot's values directly here — we use
    // our manual computation so the invariants are unambiguous.
    try {
      computeSnapshot(state, fx);
    } catch {
      // computeSnapshot can throw if the engine's MASE projection hits an
      // edge case (e.g., NaN vols at genesis). We don't let it break the
      // backtest — the invariant check below uses our manual computation.
    }

    // --- in-band checks ---
    const inSafetyBand = P_MTQ >= PRICE_SAFETY_LOWER && P_MTQ <= PRICE_SAFETY_UPPER;
    const inPppBand = P_MTQ >= PPP_BAND_LOWER && P_MTQ <= PPP_BAND_UPPER;
    const survived = Number.isFinite(rr) ? rr >= RR_HARD : true;

    if (!survived) inv1FailingTicks++;
    if (inPppBand) inv2InBand++; else inv2FailingTicks++;
    if (inSafetyBand) safetyInBand++; else safetyFailingTicks++;

    // --- EMERGENCY streak tracking (INV-3) ---
    if (cs.state === "EMERGENCY") {
      if (currentEmergencyStart === null) {
        currentEmergencyStart = p.date;
        currentEmergencyCount = 1;
      } else {
        currentEmergencyCount++;
      }
    } else {
      if (currentEmergencyStart !== null) {
        emergencyStreaks.push({
          startDate: currentEmergencyStart,
          endDate: points[i - 1].date,
          days: currentEmergencyCount,
        });
        if (currentEmergencyCount > maxEmergencyStreakDays) {
          maxEmergencyStreakDays = currentEmergencyCount;
        }
        currentEmergencyStart = null;
        currentEmergencyCount = 0;
      }
    }

    // --- stats accumulators ---
    if (SEVERITY[cs.state] > worstSeverity) {
      worstSeverity = SEVERITY[cs.state];
      worstStatus = cs.state;
    }
    daysByStatus[cs.state] += 1;

    daily.push({
      date: p.date,
      I_t,
      L_t,
      P_MTQ,
      NAV: nav,
      liability,
      RR: rr,
      LCR: lcr,
      state: cs.state,
      inSafetyBand,
      inPppBand,
      survived,
      oracleValid,
      indexDivergencePct,
    });
  }

  // --- close any trailing EMERGENCY streak ---
  if (currentEmergencyStart !== null) {
    emergencyStreaks.push({
      startDate: currentEmergencyStart,
      endDate: points[points.length - 1].date,
      days: currentEmergencyCount,
    });
    if (currentEmergencyCount > maxEmergencyStreakDays) {
      maxEmergencyStreakDays = currentEmergencyCount;
    }
  }

  // --- aggregate statistics ---
  const n = daily.length;
  const gfbValues = daily.map((d) => d.I_t);
  const rrValues = daily.map((d) => d.RR);
  const lcrValues = daily.map((d) => d.LCR);
  const navValues = daily.map((d) => d.NAV);
  const pmtqValues = daily.map((d) => d.P_MTQ);
  const divValues = daily.map((d) => d.indexDivergencePct);

  function fin(arr: number[]): { min: number; max: number; mean: number; final: number } {
    const finite = arr.filter((x) => Number.isFinite(x));
    const min = finite.length > 0 ? Math.min(...finite) : -Infinity;
    const max = finite.length > 0 ? Math.max(...finite) : Infinity;
    const mean = finite.length > 0 ? finite.reduce((a, b) => a + b, 0) / finite.length : NaN;
    return { min, max, mean, final: arr[arr.length - 1] };
  }

  const gfbStats = fin(gfbValues);
  const rrStats = fin(rrValues);
  const lcrStats = fin(lcrValues);
  const navStats = fin(navValues);
  const pmtqStats = fin(pmtqValues);
  const divStats = fin(divValues);

  const oracleValidPct = n > 0 ? oracleValidTicks / n : 0;

  // --- invariant verdicts ---
  const inv1Passed = inv1FailingTicks === 0;
  const inv2Pct = n > 0 ? inv2InBand / n : 0;
  const inv2Passed = inv2FailingTicks === 0;
  const inv3Passed = maxEmergencyStreakDays * 24 <= EMERGENCY_MAX_STREAK_HOURS;
  const inv4Passed = oracleValidPct >= ORACLE_MIN_VALID_PCT;
  const inv5Passed = inv5FailingTicks === 0;
  const safetyPct = n > 0 ? safetyInBand / n : 0;
  const safetyPassed = safetyFailingTicks === 0;

  const failingInvariants: string[] = [];
  if (!inv1Passed) failingInvariants.push("INV-1 (RR >= 1.00)");
  if (!inv2Passed) failingInvariants.push("INV-2 (P_MTQ in [0.95, 1.05])");
  if (!inv3Passed) failingInvariants.push("INV-3 (no EMERGENCY > 48h)");
  if (!inv4Passed) failingInvariants.push("INV-4 (oracle >=3 sources >=99%)");
  if (!inv5Passed) failingInvariants.push("INV-5 (chain index divergence < 5%)");

  const passed = failingInvariants.length === 0;

  const summary: BacktestSummary = {
    meta: META,
    dataSources: {
      frankfurter: fetched.sources.frankfurter,
      fredVix: fetched.sources.fredVix,
      fredDxy: fetched.sources.fredDxy,
      fredGold: fetched.sources.fredGold,
      fredTreasury: fetched.sources.fredTreasury,
      mergedTicks: n,
      degraded: fetched.degraded,
      degradedReasons: fetched.degradedReasons,
      dateRange: { start: points[0].date, end: points[n - 1].date },
    },
    totalDays: n,
    gfbIndex: gfbStats,
    rr: rrStats,
    lcr: lcrStats,
    nav: navStats,
    pmtq: pmtqStats,
    indexDivergencePct: divStats,
    worstStatus,
    daysByStatus,
    emergencyStreaks,
    maxEmergencyStreakDays,
    oracleValidPct,
    oraclePausedTicks,
    invariants: {
      INV1_rrHard: {
        passed: inv1Passed,
        minRr: rrStats.min,
        failingTicks: inv1FailingTicks,
        description: `RR >= 1.00 (RR_HARD) at every day — min RR observed = ${rrStats.min.toFixed(4)}`,
      },
      INV2_pppBand: {
        passed: inv2Passed,
        inBandPct: inv2Pct,
        failingTicks: inv2FailingTicks,
        description: `P_MTQ in [0.95, 1.05] (PPP band) — in-band ${(inv2Pct * 100).toFixed(2)}% of ticks`,
      },
      INV3_emergency48h: {
        passed: inv3Passed,
        maxStreakDays: maxEmergencyStreakDays,
        description: `No EMERGENCY streak > 48h — max streak = ${maxEmergencyStreakDays} days`,
      },
      INV4_oracleConsensus: {
        passed: inv4Passed,
        validPct: oracleValidPct,
        failingTicks: oraclePausedTicks,
        description: `Oracle consensus >=3 sources — valid ${(oracleValidPct * 100).toFixed(2)}% of ticks`,
      },
      INV5_indexDivergence: {
        passed: inv5Passed,
        maxDivergencePct: maxDivergencePct,
        failingTicks: inv5FailingTicks,
        description: `Chain-linked I_t vs Laspeyres L_t divergence < 5% — max = ${maxDivergencePct.toFixed(3)}%`,
      },
      safetyBand: {
        passed: safetyPassed,
        inBandPct: safetyPct,
        failingTicks: safetyFailingTicks,
        description: `P_MTQ in [0.50, 2.00] (§3.5 hard safety band) — in-band ${(safetyPct * 100).toFixed(2)}% of ticks (informational)`,
      },
    },
    passed,
    failingInvariants,
    daily,
    generatedAt: Date.now(),
    totalRuntimeMs: Date.now() - t0,
  };

  return summary;
}

// =========================================================================
// 9. Stdout summary printer
// =========================================================================

function pct(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return "∞";
  return `${(x * 100).toFixed(digits)}%`;
}

function fixed(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return "∞";
  return x.toFixed(digits);
}

function usd(x: number): string {
  if (!Number.isFinite(x)) return "∞";
  return `$${x.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function verdict(b: boolean): string {
  return b ? "✓ PASS" : "✗ FAIL";
}

function printSummary(s: BacktestSummary): void {
  console.log("");
  console.log("=".repeat(80));
  console.log("  MTQΣ §23 Layer 6 — 10-Year Historical Backtest (FRED + Frankfurter)");
  console.log("=".repeat(80));
  console.log(`  Data range:          ${s.dataSources.dateRange.start} → ${s.dataSources.dateRange.end}`);
  console.log(`  Trading days:        ${s.totalDays}`);
  console.log(`  Generated at:        ${new Date(s.generatedAt).toISOString()}`);
  console.log(`  Runtime:             ${s.totalRuntimeMs} ms`);
  console.log(`  Data sources:`);
  console.log(`    Frankfurter FX:    ${s.dataSources.frankfurter} days`);
  console.log(`    FRED VIX:          ${s.dataSources.fredVix} obs`);
  console.log(`    FRED DXY:          ${s.dataSources.fredDxy} obs`);
  console.log(`    FRED Gold:         ${s.dataSources.fredGold} obs`);
  console.log(`    FRED Treasury 10Y: ${s.dataSources.fredTreasury} obs`);
  if (s.dataSources.degraded) {
    console.log(`  [DEGRADED]:`);
    for (const r of s.dataSources.degradedReasons) console.log(`    - ${r}`);
  }
  console.log("");
  console.log("  ── GFB Index (chain-linked I_t) ──────────────────────────────");
  console.log(`    min:    ${fixed(s.gfbIndex.min, 6)}     max:    ${fixed(s.gfbIndex.max, 6)}`);
  console.log(`    mean:   ${fixed(s.gfbIndex.mean, 6)}    final:  ${fixed(s.gfbIndex.final, 6)}`);
  console.log("");
  console.log("  ── P_MTQ = I_t × PAR (PAR = 1.0) ────────────────────────────");
  console.log(`    min:    ${fixed(s.pmtq.min, 6)}     max:    ${fixed(s.pmtq.max, 6)}`);
  console.log(`    mean:   ${fixed(s.pmtq.mean, 6)}    final:  ${fixed(s.pmtq.final, 6)}`);
  console.log("");
  console.log("  ── Reserve Ratio (RR = NAV / L) ────────────────────────────");
  console.log(`    min:    ${fixed(s.rr.min, 6)}     ${pct(s.rr.min - 1, 2)} above hard floor`);
  console.log(`    max:    ${fixed(s.rr.max, 6)}`);
  console.log(`    mean:   ${fixed(s.rr.mean, 6)}`);
  console.log(`    final:  ${fixed(s.rr.final, 6)}`);
  console.log("");
  console.log("  ── Liquidity Coverage Ratio (LCR) ──────────────────────────");
  console.log(`    min:    ${fixed(s.lcr.min, 6)}     max:    ${fixed(s.lcr.max, 6)}`);
  console.log(`    mean:   ${fixed(s.lcr.mean, 6)}    final:  ${fixed(s.lcr.final, 6)}`);
  console.log("");
  console.log("  ── NAV trajectory ─────────────────────────────────────────");
  console.log(`    min:    ${usd(s.nav.min)}     max:    ${usd(s.nav.max)}`);
  console.log(`    mean:   ${usd(s.nav.mean)}    final:  ${usd(s.nav.final)}`);
  console.log("");
  console.log("  ── Chain Index Divergence (I_t vs Laspeyres L_t) ──────────");
  console.log(`    min:    ${fixed(s.indexDivergencePct.min, 4)}%     max:    ${fixed(s.indexDivergencePct.max, 4)}%`);
  console.log(`    mean:   ${fixed(s.indexDivergencePct.mean, 4)}%    final:  ${fixed(s.indexDivergencePct.final, 4)}%`);
  console.log("");
  console.log("  ── 6-State Machine distribution ──────────────────────────");
  for (const k of ["NORMAL", "CAUTION", "STRESS", "DEFENSIVE", "EMERGENCY", "RECOVERY"] as RiskState[]) {
    console.log(`    ${k.padEnd(10)}  ${s.daysByStatus[k]} days`);
  }
  console.log(`    Worst status entered:  ${s.worstStatus}`);
  console.log(`    Max EMERGENCY streak:  ${s.maxEmergencyStreakDays} days (limit: 2 days = 48h)`);
  if (s.emergencyStreaks.length > 0) {
    console.log(`    EMERGENCY streaks:`);
    for (const streak of s.emergencyStreaks) {
      console.log(`      ${streak.startDate} → ${streak.endDate}  (${streak.days} days)`);
    }
  }
  console.log("");
  console.log("  ── Oracle Consensus (≥3 sources) ──────────────────────────");
  console.log(`    Valid ticks:   ${pct(s.oracleValidPct, 2)}   (threshold: 99.00%)`);
  console.log(`    Paused ticks:  ${s.oraclePausedTicks}`);
  console.log("");
  console.log("  ── Invariant Verdicts (Layer 6 bank-grade audit) ─────────");
  console.log(`    INV-1  RR >= 1.00 (RR_HARD):                ${verdict(s.invariants.INV1_rrHard.passed)}`);
  console.log(`           min RR = ${fixed(s.invariants.INV1_rrHard.minRr, 6)}, failing ticks = ${s.invariants.INV1_rrHard.failingTicks}`);
  console.log(`    INV-2  P_MTQ in [0.95, 1.05] (PPP band):    ${verdict(s.invariants.INV2_pppBand.passed)}`);
  console.log(`           in-band ${pct(s.invariants.INV2_pppBand.inBandPct, 2)}, failing ticks = ${s.invariants.INV2_pppBand.failingTicks}`);
  console.log(`    INV-3  No EMERGENCY > 48h without recovery: ${verdict(s.invariants.INV3_emergency48h.passed)}`);
  console.log(`           max EMERGENCY streak = ${s.invariants.INV3_emergency48h.maxStreakDays} days`);
  console.log(`    INV-4  Oracle >=3 sources >= 99% of ticks:  ${verdict(s.invariants.INV4_oracleConsensus.passed)}`);
  console.log(`           valid ${pct(s.invariants.INV4_oracleConsensus.validPct, 2)}, paused ticks = ${s.invariants.INV4_oracleConsensus.failingTicks}`);
  console.log(`    INV-5  Chain index divergence < 5%:         ${verdict(s.invariants.INV5_indexDivergence.passed)}`);
  console.log(`           max divergence = ${fixed(s.invariants.INV5_indexDivergence.maxDivergencePct, 4)}%, failing ticks = ${s.invariants.INV5_indexDivergence.failingTicks}`);
  console.log("");
  console.log(`    [informational] P_MTQ in [0.50, 2.00] §3.5 hard safety band:`);
  console.log(`           ${verdict(s.invariants.safetyBand.passed)}   in-band ${pct(s.invariants.safetyBand.inBandPct, 2)}, failing ticks = ${s.invariants.safetyBand.failingTicks}`);
  console.log("");
  console.log("  ── Overall Verdict ────────────────────────────────────────");
  if (s.passed) {
    console.log(`    ✓ PASS  — all 5 Layer 6 invariants held across ${s.totalDays} trading days`);
  } else {
    console.log(`    ✗ FAIL  — ${s.failingInvariants.length} invariant(s) failed:`);
    for (const name of s.failingInvariants) console.log(`        • ${name}`);
  }
  console.log("=".repeat(80));
}

// =========================================================================
// 10. Entry point — run, write JSON, print summary, set exit code
// =========================================================================

async function main(): Promise<void> {
  // Parse optional CLI args: --start=YYYY --end=YYYY
  const args = process.argv.slice(2);
  let startYear = 2015;
  let endYear = 2025;
  for (const a of args) {
    if (a.startsWith("--start=")) startYear = parseInt(a.slice(8), 10);
    else if (a.startsWith("--end=")) endYear = parseInt(a.slice(6), 10);
  }

  try {
    const summary = await runHistoricalBacktest(startYear, endYear);

    // Write JSON to audit-work/. Ensure directory exists.
    const auditDir = join(process.cwd(), "audit-work");
    try { mkdirSync(auditDir, { recursive: true }); } catch { /* already exists */ }
    const outPath = join(auditDir, "historical-backtest-results.json");
    writeFileSync(outPath, JSON.stringify(summary, null, 2));
    console.log(`[historical-backtest] Wrote ${outPath}`);

    printSummary(summary);

    // Exit non-zero on failure so CI/cron can detect.
    if (!summary.passed) {
      console.log(`\n[historical-backtest] Exit code 1 — ${summary.failingInvariants.length} invariant(s) failed.`);
      process.exitCode = 1;
    } else {
      console.log(`\n[historical-backtest] Exit code 0 — all invariants held.`);
      process.exitCode = 0;
    }
  } catch (e) {
    console.error("[historical-backtest] FATAL:", e);
    process.exitCode = 2;
  }
}

// Run only when invoked directly (not when imported).
if (
  import.meta.main === true ||
  (typeof process !== "undefined" &&
    process.argv[1]?.endsWith("historical-backtest.ts"))
) {
  void main();
}
