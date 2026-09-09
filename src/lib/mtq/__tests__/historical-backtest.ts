// MTQΣ — §23 Layer 6 Historical Backtest (Deliverable G3)
// =========================================================================
// Task ID:    HIST-BACKTEST + HEALTH-DASHBOARD
// Agent:      full-stack-developer (Quantitative Risk Engineer)
//
// Purpose:
//   The last missing layer of the §23 validation program. Replays 257 days
//   of 2024 ECB/Frankfurter historical daily FX reference rates through the
//   V3-corrected engine (canonical chain-linked index + 6-state risk machine)
//   and verifies:
//     (a) survival: RR ≥ 1.00 (RR_HARD) at every day; and
//     (b) peg stability: P_MTQ ∈ [0.50, 2.00] (§3.5 safety band) at every day.
//
// Methodology:
//   - FX data:        Frankfurter.dev historical time series (ECB reference
//                     rates) — https://api.frankfurter.dev/v1/2024-01-01..2024-12-31?base=USD
//                     Frankfurter returns USD-base rates (1 USD = X foreign);
//                     we invert to USD-per-unit (EUR_USD = 1/rates.EUR, etc.)
//                     to match the engine's convention.
//   - 5 FX pairs:     EUR/USD, GBP/USD, JPY/USD, CNY/USD, CHF/USD (all from
//                     ECB via Frankfurter).
//   - Gold (XAU):     NOT provided by Frankfurter. We use the BASE_FIXINGS
//                     constant ($2,500/oz) for the entire 2024 window.
//                     HONEST ASSUMPTION — see "Gold assumption" section below.
//   - Chain index:    initChainIndex at genesis with STRATEGIC_PRIOR weights
//                     + BASE_FIXINGS; advanceIndex once per day with that
//                     day's FX rates (zero rebalance / no commitWeights — the
//                     backtest exercises the FX chain-linking mechanism
//                     in isolation, holding the strategic prior fixed).
//   - Reserve NAV:    $1.1M genesis deposit split across the 7 components
//                     per STRATEGIC_PRIOR. Token-unit holdings held constant
//                     across the backtest (no rebalancing) — the USD value
//                     of each component moves with FX.
//   - Haircuts:       Applied per blueprint HAIRCUTS (USD 0.5%, EUR 0.7%,
//                     JPY/GBP/CHF 1%, CNY 1.5%, Gold 1%).
//   - Liability:      1,000,000 MTQ circulating × P_MTQ (so L = 1M × I_t).
//   - RR:             NAV / L (Infinity if L = 0).
//   - LCR:            fiatNet / (circ × price × 0.25)  — §4.2.4.
//   - 6-state:        determineState(rr, lcr, prev, enteredAt, ts) — the
//                     canonical Master Listing 13 / §21.2 machine with
//                     RECOVERY 48h hysteresis.
//   - Survival:       RR ≥ 1.00 at every tick (RR_HARD invariant I2).
//   - Peg stability:  P_MTQ ∈ [0.50, 2.00] at every tick (§3.5).
//
// Gold assumption (HONEST):
//   Frankfurter/ECB does not publish XAU. Real 2024 gold moved from ~$2,060
//   (Jan 1) to ~$2,624 (Dec 31), a ~+27% appreciation. We DOCUMENT this and
//   choose to use the constant $2,500 (the BASE_FIXINGS value) for two
//   reasons:
//     1. The task brief explicitly offers this option and states "the backtest
//        is about the FX component movement, not gold."
//     2. Gold shocks are covered in Layer 7 stochastic S5 (+50%) and S6 (−30%)
//        in stress-rerun.ts — Layer 6 is a clean test of the chain-linking
//        mechanism under realistic FX, not gold shocks.
//   The choice is conservative: a constant gold price removes the gold-driven
//   appreciation of the index, so the index's daily moves in this backtest
//   come ONLY from the 5 FX pairs. The §23 Layer 7 stochastic sims cover the
//   gold-shock dimension.
//
// Reproducibility metadata (Master Prompt §25):
//   - parameter_version:   v3-corrected-engine (chain-linked + 6-state)
//   - methodology_version: master-v1.0-listings-1-3-13
//   - data_version:        frankfurter-2024-ecb (257 trading days)
//   - random seed:         N/A (deterministic — no stochastic component)
//   - starting state:      RR = 1.10 (1.1M USD reserve / 1M MTQ circulating),
//                          NORMAL, genesis reserve split across Strategic Prior
//   - path count:          1 (single historical trajectory)
//   - survival definition: RR ≥ 1.00 (RR_HARD) at every day
//   - failure definition:   RR < 1.00 at any day
//
// To run:  `bun src/lib/mtq/__tests__/historical-backtest.ts`
// Output:  audit-work/historical-backtest-results.json + stdout summary
//          audit-work/DELIVERABLE-G3-historical-backtest.md (the report)

import {
  initChainIndex,
  advanceIndex,
  getMTQPrice,
  type ChainIndexState,
} from "../chain-index";
import { determineState, type RiskState, type CanonicalState } from "../state-machine";
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
import { writeFileSync } from "fs";
import { join } from "path";

// =========================================================================
// 0.  Reproducibility metadata (Master Prompt §25)
// =========================================================================

const META = {
  deliverable: "G3 — §23 Layer 6 Historical Backtest (V3-corrected engine)",
  task_id: "HIST-BACKTEST+HEALTH-DASHBOARD",
  agent: "full-stack-developer",
  blueprint_version: "MTQΣ Master Monetary Architecture v1.0",
  parameter_version: "v3-corrected-engine",
  methodology_version: "master-v1.0-listings-1-3-13",
  data_version: "frankfurter-2024-ecb",
  data_source: "https://api.frankfurter.dev/v1/2024-01-01..2024-12-31?base=USD",
  starting_state: {
    genesis_deposit_USD: 1_100_000,
    circulating_supply_MTQ: 1_000_000,
    expected_genesis_RR: 1.10,
    initial_risk_state: "NORMAL",
    composition: "7-component Strategic Prior (USD 27% / EUR 20% / JPY 9% / GBP 8% / CNY 5% / CHF 5% / Gold 26%)",
  },
  gold_assumption:
    "Constant $2,500/oz (BASE_FIXINGS.XAU_USD) for entire 2024 window. " +
    "Frankfurter/ECB does not publish XAU. Real 2024 gold moved ~$2,060 → ~$2,624 (+27%). " +
    "Using the constant base fixing keeps the backtest focused on the FX + chain-linking " +
    "mechanism; gold shocks are covered in Layer 7 stochastic S5 (+50%) / S6 (−30%).",
  survival_definition: "RR >= 1.00 (RR_HARD) at every day",
  failure_definition: "RR < 1.00 (RR_HARD) at any day",
  peg_stability_definition: "P_MTQ in [0.50, 2.00] (§3.5 safety band) at every day",
  path_count: 1,
  deterministic: true,
  stochastic: false,
};

// =========================================================================
// 1.  Per-day backtest result row
// =========================================================================

export interface DailyRow {
  date: string;          // ISO date (YYYY-MM-DD)
  I_t: number;           // chain-linked index level (1.0 at genesis)
  P_MTQ: number;         // MTQ reference price = I_t × PAR = I_t (PAR = 1.0)
  NAV: number;           // reserve net asset value (post-haircut, USD)
  liability: number;     // circulating × P_MTQ (USD)
  RR: number;            // NAV / liability
  LCR: number;           // liquid coverage ratio (fiatNet / stressDemand)
  state: RiskState;      // 6-state machine state at this day
  inBand: boolean;       // P_MTQ ∈ [0.50, 2.00]
  survived: boolean;     // RR >= 1.00
}

export interface BacktestSummary {
  meta: typeof META;
  totalDays: number;
  gfbIndex: { min: number; max: number; mean: number; final: number };
  rr: { min: number; max: number; mean: number; final: number };
  lcr: { min: number; max: number; mean: number; final: number };
  nav: { min: number; max: number; mean: number; final: number };
  worstStatus: RiskState;
  daysByStatus: Record<RiskState, number>;
  survivalRate: number;        // 1.0 = perfect; fraction of days RR >= 1.00
  pegStabilityPct: number;     // 1.0 = perfect; fraction of days P_MTQ in band
  survived: boolean;           // true if survivalRate == 1.0
  pegStable: boolean;          // true if pegStabilityPct == 1.0
  passed: boolean;             // survived AND pegStable
  daily: DailyRow[];
  generatedAt: number;
  totalRuntimeMs: number;
}

// =========================================================================
// 2.  Genesis holdings (token units) — split $1.1M across Strategic Prior
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

function genesisHoldings(): TokenHoldings {
  // USD-equivalent allocations per Strategic Prior weight.
  const usdUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.USD;  // $297K
  const eurUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.EUR;  // $220K
  const jpyUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.JPY;  //  $99K
  const gbpUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.GBP;  //  $88K
  const cnyUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.CNY;  //  $55K
  const chfUsd  = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.CHF;  //  $55K
  const goldUsd = GENESIS_DEPOSIT_USD * STRATEGIC_PRIOR.Gold; // $286K

  // Convert USD-equivalent to native token units using BASE_FIXINGS so that
  // at genesis, USD value of each component = its Strategic Prior share × $1.1M.
  return {
    usd:  usdUsd  / 1.0,                       // 1 USD = $1
    eur:  eurUsd  / BASE_FIXINGS.EUR_USD,      // 1 EUR = $1.05
    gbp:  gbpUsd  / BASE_FIXINGS.GBP_USD,      // 1 GBP = $1.25
    jpy:  jpyUsd  / BASE_FIXINGS.JPY_USD,      // 1 JPY = $0.0067
    cny:  cnyUsd  / BASE_FIXINGS.CNY_USD,      // 1 CNY = $0.14
    chf:  chfUsd  / BASE_FIXINGS.CHF_USD,      // 1 CHF = $1.13
    gold: goldUsd / BASE_FIXINGS.XAU_USD,      // 1 oz  = $2,500
  };
}

// =========================================================================
// 3.  NAV (post-haircut) — mirrors engine.ts::reserveAssetValues
// =========================================================================

interface FxDay {
  EUR_USD: number;
  GBP_USD: number;
  JPY_USD: number;
  CNY_USD: number;
  CHF_USD: number;
  XAU_USD: number;
}

interface NavResult {
  nav: number;
  fiatNet: number;
  goldNet: number;
}

function navFromHoldings(h: TokenHoldings, fx: FxDay): NavResult {
  // Gross USD value of each component (token units × FX rate).
  const usdGross  = h.usd  * 1.0;
  const eurGross  = h.eur  * fx.EUR_USD;
  const gbpGross  = h.gbp  * fx.GBP_USD;
  const jpyGross  = h.jpy  * fx.JPY_USD;
  const cnyGross  = h.cny  * fx.CNY_USD;
  const chfGross  = h.chf  * fx.CHF_USD;
  const goldGross = h.gold * fx.XAU_USD;
  // Net (post-haircut) — matches HAIRCUTS in blueprint.
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
// 4.  Frankfurter historical time-series fetch (2024)
// =========================================================================

interface FrankfurterDay {
  date: string;
  rates: { EUR: number; GBP: number; JPY: number; CNY: number; CHF: number; [k: string]: number };
}

async function fetchFrankfurter2024(): Promise<FrankfurterDay[]> {
  const url = "https://api.frankfurter.dev/v1/2024-01-01..2024-12-31?base=USD";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
    const data = await res.json() as {
      amount: number;
      base: string;
      start_date: string;
      end_date: string;
      rates: Record<string, Record<string, number>>;
    };
    // Sort by date ascending (Frankfurter returns ascending already, but defensive).
    const days: FrankfurterDay[] = Object.entries(data.rates)
      .map(([date, r]) => ({
        date,
        rates: {
          EUR: Number(r.EUR),
          GBP: Number(r.GBP),
          JPY: Number(r.JPY),
          CNY: Number(r.CNY),
          CHF: Number(r.CHF),
          ...r,
        },
      }))
      .filter((d) => Number.isFinite(d.rates.EUR) && Number.isFinite(d.rates.CHF))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (days.length === 0) throw new Error("Frankfurter returned 0 valid days");
    return days;
  } finally {
    clearTimeout(t);
  }
}

// Convert Frankfurter's USD-base rates to engine convention (USD per 1 foreign).
// Frankfurter returns 1 USD = r.EUR euros → EUR_USD = 1 / r.EUR.
function frankfurterToFxDay(d: FrankfurterDay, xauUsd: number): FxDay {
  return {
    EUR_USD: 1 / d.rates.EUR,
    GBP_USD: 1 / d.rates.GBP,
    JPY_USD: 1 / d.rates.JPY,
    CNY_USD: 1 / d.rates.CNY,
    CHF_USD: 1 / d.rates.CHF,
    XAU_USD: xauUsd, // constant — see gold_assumption above
  };
}

// =========================================================================
// 5.  Severity ranking for "worst status" computation
// =========================================================================

const SEVERITY: Record<RiskState, number> = {
  NORMAL: 0,
  RECOVERY: 1, // confirmation state — counts as mild
  CAUTION: 1,
  STRESS: 2,
  DEFENSIVE: 3,
  EMERGENCY: 4,
};

// =========================================================================
// 6.  The backtest runner
// =========================================================================

export async function runHistoricalBacktest(): Promise<BacktestSummary> {
  const t0 = Date.now();
  console.log("[historical-backtest] Fetching Frankfurter 2024 time series…");
  const frankfurterDays = await fetchFrankfurter2024();
  console.log(`[historical-backtest] Got ${frankfurterDays.length} trading days ` +
    `(${frankfurterDays[0].date} → ${frankfurterDays[frankfurterDays.length - 1].date}).`);

  // Genesis holdings + chain index state.
  const holdings = genesisHoldings();
  let chain: ChainIndexState = initChainIndex(
    GFB_BASE_DENOMINATOR,
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
      1.0,                      // USD (always 1.0)
      BASE_FIXINGS.EUR_USD,
      BASE_FIXINGS.JPY_USD,
      BASE_FIXINGS.GBP_USD,
      BASE_FIXINGS.CNY_USD,
      BASE_FIXINGS.CHF_USD,
      BASE_FIXINGS.XAU_USD,
    ],
    0,
  );

  // 6-state machine hysteresis state. Start in NORMAL at genesis.
  let prevState: RiskState = "NORMAL";
  let prevEnteredAt = 0; // 0 = genesis (will be replaced on first transition)
  // We advance the machine one day per Frankfurter day. "1 day = 1 tick"
  // is the standard convention for historical backtests.
  const RECOVERY_CONFIRMATION_MS = 48 * 60 * 60 * 1000; // 48h per Listing 13

  // Per-day rows.
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
  let survivedDays = 0;
  let inBandDays = 0;

  for (let i = 0; i < frankfurterDays.length; i++) {
    const day = frankfurterDays[i];
    const fx = frankfurterToFxDay(day, BASE_FIXINGS.XAU_USD);

    // --- advance the chain-linked index with this day's FX prices ---
    // The chain index uses prevWeights = STRATEGIC_PRIOR (held constant for
    // this backtest — no commitWeights calls). advanceIndex updates I_t and
    // rotates prevPrices forward so the next day's advance uses t→t+1 prices.
    const advance = advanceIndex(
      chain,
      [
        1.0,            // USD
        fx.EUR_USD,
        fx.JPY_USD,
        fx.GBP_USD,
        fx.CNY_USD,
        fx.CHF_USD,
        fx.XAU_USD,
      ],
    );
    chain = advance.state;
    const I_t = chain.I_t;
    const P_MTQ = getMTQPrice(chain);

    // --- NAV (post-haircut) ---
    const navRes = navFromHoldings(holdings, fx);
    const nav = navRes.nav;

    // --- liability = circulating × P_MTQ ---
    const liability = CIRCULATING_SUPPLY_MTQ * P_MTQ;

    // --- RR + LCR ---
    const rr = liability > 0 ? nav / liability : Infinity;
    const stressDemand = CIRCULATING_SUPPLY_MTQ * P_MTQ * STRESS_REDEMPTION_RATE;
    const lcr = stressDemand > 0 ? navRes.fiatNet / stressDemand : Infinity;

    // --- 6-state machine (with RECOVERY hysteresis) ---
    // Time advances 1 day per Frankfurter day (24h ticks). The machine's
    // RECOVERY confirmation (48h) therefore requires 2 consecutive NORMAL
    // days from DEFENSIVE/EMERGENCY.
    const ts = (i + 1) * 24 * 60 * 60 * 1000; // synthetic monotonic timestamp
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

    // --- safety band + survival ---
    const inBand = P_MTQ >= PRICE_SAFETY_LOWER && P_MTQ <= PRICE_SAFETY_UPPER;
    const survived = rr >= RR_HARD;

    // --- stats accumulators ---
    if (SEVERITY[cs.state] > worstSeverity) {
      worstSeverity = SEVERITY[cs.state];
      worstStatus = cs.state;
    }
    daysByStatus[cs.state] += 1;
    if (survived) survivedDays += 1;
    if (inBand) inBandDays += 1;

    daily.push({
      date: day.date,
      I_t,
      P_MTQ,
      NAV: nav,
      liability,
      RR: rr,
      LCR: lcr,
      state: cs.state,
      inBand,
      survived,
    });
  }

  // --- aggregate statistics ---
  const n = daily.length;
  const gfbValues = daily.map((d) => d.I_t);
  const rrValues = daily.map((d) => d.RR);
  const lcrValues = daily.map((d) => d.LCR);
  const navValues = daily.map((d) => d.NAV);

  function fin(arr: number[]): { min: number; max: number; mean: number; final: number } {
    // Treat Infinity as +∞ (excluded from min/max — RR is Infinity only if
    // liability = 0, which never happens in this backtest since P_MTQ > 0).
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

  const survivalRate = n > 0 ? survivedDays / n : 0;
  const pegStabilityPct = n > 0 ? inBandDays / n : 0;
  const survived = survivalRate >= 1.0;
  const pegStable = pegStabilityPct >= 1.0;
  const passed = survived && pegStable;

  const summary: BacktestSummary = {
    meta: META,
    totalDays: n,
    gfbIndex: gfbStats,
    rr: rrStats,
    lcr: lcrStats,
    nav: navStats,
    worstStatus,
    daysByStatus,
    survivalRate,
    pegStabilityPct,
    survived,
    pegStable,
    passed,
    daily,
    generatedAt: Date.now(),
    totalRuntimeMs: Date.now() - t0,
  };

  return summary;
}

// =========================================================================
// 7.  Stdout summary printer
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

function printSummary(s: BacktestSummary): void {
  console.log("");
  console.log("=".repeat(72));
  console.log("  MTQΣ §23 Layer 6 Historical Backtest (Deliverable G3)");
  console.log("=".repeat(72));
  console.log(`  Data source:        ${s.meta.data_source}`);
  console.log(`  Trading days:       ${s.totalDays}`);
  console.log(`  Generated at:       ${new Date(s.generatedAt).toISOString()}`);
  console.log(`  Runtime:            ${s.totalRuntimeMs} ms`);
  console.log("");
  console.log("  ── GFB Index (chain-linked I_t) ──────────────────────────────");
  console.log(`    min:    ${fixed(s.gfbIndex.min, 6)}`);
  console.log(`    max:    ${fixed(s.gfbIndex.max, 6)}`);
  console.log(`    mean:   ${fixed(s.gfbIndex.mean, 6)}`);
  console.log(`    final:  ${fixed(s.gfbIndex.final, 6)}`);
  console.log("");
  console.log("  ── Reserve Ratio (RR = NAV / L) ────────────────────────────");
  console.log(`    min:    ${fixed(s.rr.min, 6)}     ${pct(s.rr.min - 1, 2)} above hard floor`);
  console.log(`    max:    ${fixed(s.rr.max, 6)}`);
  console.log(`    mean:   ${fixed(s.rr.mean, 6)}`);
  console.log(`    final:  ${fixed(s.rr.final, 6)}`);
  console.log("");
  console.log("  ── Liquidity Coverage Ratio (LCR) ──────────────────────────");
  console.log(`    min:    ${fixed(s.lcr.min, 6)}`);
  console.log(`    max:    ${fixed(s.lcr.max, 6)}`);
  console.log(`    mean:   ${fixed(s.lcr.mean, 6)}`);
  console.log(`    final:  ${fixed(s.lcr.final, 6)}`);
  console.log("");
  console.log("  ── NAV trajectory ─────────────────────────────────────────");
  console.log(`    min:    ${usd(s.nav.min)}`);
  console.log(`    max:    ${usd(s.nav.max)}`);
  console.log(`    mean:   ${usd(s.nav.mean)}`);
  console.log(`    final:  ${usd(s.nav.final)}`);
  console.log("");
  console.log("  ── 6-State Machine distribution ──────────────────────────");
  for (const k of ["NORMAL", "CAUTION", "STRESS", "DEFENSIVE", "EMERGENCY", "RECOVERY"] as RiskState[]) {
    console.log(`    ${k.padEnd(10)}  ${s.daysByStatus[k]} days`);
  }
  console.log(`    Worst status entered:  ${s.worstStatus}`);
  console.log("");
  console.log("  ── Pass/Fail verdict ──────────────────────────────────────");
  console.log(`    Survival rate (RR >= 1.00 every day):  ${pct(s.survivalRate, 2)}   ${s.survived ? "✓ PASS" : "✗ FAIL"}`);
  console.log(`    Peg stability (P_MTQ in [0.50, 2.00]):  ${pct(s.pegStabilityPct, 2)}   ${s.pegStable ? "✓ PASS" : "✗ FAIL"}`);
  console.log("");
  console.log(`    OVERALL VERDICT:  ${s.passed ? "✓ PASS  (survival + peg stability both hold)" : "✗ FAIL  (survival OR peg stability failed)"}`);
  console.log("");
  console.log("  ── Gold assumption (honest) ───────────────────────────────");
  console.log(`    ${s.meta.gold_assumption}`);
  console.log("=".repeat(72));
}

// =========================================================================
// 8.  Entry point — run, write JSON, print summary
// =========================================================================

async function main(): Promise<void> {
  try {
    const summary = await runHistoricalBacktest();
    // Write JSON to audit-work/.
    const outPath = join(process.cwd(), "audit-work", "historical-backtest-results.json");
    writeFileSync(outPath, JSON.stringify(summary, null, 2));
    console.log(`[historical-backtest] Wrote ${outPath}`);
    printSummary(summary);
    // Exit non-zero on failure so CI/cron can detect.
    if (!summary.passed) {
      process.exitCode = 1;
    }
  } catch (e) {
    console.error("[historical-backtest] FATAL:", e);
    process.exitCode = 2;
  }
}

// Run only when invoked directly (not when imported).
if (import.meta.main === true || (typeof process !== "undefined" && process.argv[1]?.endsWith("historical-backtest.ts"))) {
  void main();
}
