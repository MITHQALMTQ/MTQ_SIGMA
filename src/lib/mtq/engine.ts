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
  ADMISSIBILITY_ENVELOPES,
  BASE_FIXINGS,
  PRICE_SAFETY_LOWER, PRICE_SAFETY_UPPER,
  MINT_FEE_BPS,
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
  GOVERNANCE_LAYERS, PARAMETER_REGISTRY, type GovernanceLayerName,
  type ProtocolStatus,
  type FxRates,
} from "./blueprint";
import type { FxSnapshot } from "./fx";
import type { OracleBoard, OracleConsensus } from "./oracle";
import { computeConcentration, type AssetRecord, type ConcentrationReport } from "./registry";
import {
  maseEnsemble,
  applyEnvelopes,
  smoothWeights,
  smoothWeightsAdaptive,
  targetVelocity,
  COMPONENTS,
  type PriceData,
  type VolatilityData,
  type MarketRegime,
  type WeightVector,
  type Component,
} from "./mase";
import { marpDecision, type MarpDecision } from "./marp";
import {
  initChainIndex,
  advanceIndex,
  commitWeights,
  getMTQPrice,
  fxToPriceVector,
  strategicPriorToWeights,
  baseFixingsToPrices,
  type ChainIndexState,
} from "./chain-index";
import {
  determineState,
  mintThrottle,
  redeemFee,
  rebalanceUrgency,
  mintingAllowed,
  redemptionAllowed,
  stressLevel,
  type RiskState,
  type CanonicalState,
} from "./state-machine";

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

  // v1.0 MASE 4-state weight system — previous tick's smoothed weights (EMA).
  // Null at genesis → first computeSnapshot falls back to STRATEGIC_PRIOR.
  // advanceMase() (called from the tick loop) updates this once per tick.
  maseSmoothed: WeightVector | null;
  maseLastAt: number;

  // §14.1 Constitutional Separation — index gold vs reserve buffer gold.
  // The same PAXG + XAUT holdings on the legacy `paxg` / `xaut` fields are now
  // physically split (in the accounting) into:
  //   - indexPaxg + indexXaut  → gold LOCKED to back the index Gold weight
  //     (Strategic Prior 26%). Only changes when weights commit via
  //     `commitIndexGold()` (keeper-role equivalent). MARP cannot touch this.
  //   - reservePaxg + reserveXaut → gold in the reserve buffer that MARP
  //     rebalances (sells when gold overweight, buys when gold underweight).
  // The legacy `paxg` / `xaut` fields are retained as TOTALS
  // (= indexPaxg + reservePaxg and indexXaut + reserveXaut) so existing
  // readers continue to work unchanged.
  indexPaxg: number;
  indexXaut: number;
  reservePaxg: number;
  reserveXaut: number;

  // §14.1 execution-path flag — which rebalance path is currently mutating state.
  // 'legacy' (default) = §7 single-direction rebalance; 'marp' = per-component MARP.
  // Driven by the USE_MARP_EXECUTION feature flag in pilot-state.ts::tick().
  // Exposed in the snapshot so the UI can render an A/B badge.
  rebalancePath: 'legacy' | 'marp';

  // === P0-FIX-1: canonical chain-linked index state (Master Listing 3 / §9.2 COO-16) ===
  // The chain-linked index I_t replaces the legacy Laspeyres GFB index.
  // One per engine instance. The tick loop calls advanceIndex() every tick
  // (so I_t reflects the latest FX/gold prices) and commitWeights() on every
  // MASE weight update (so the index reflects the new strategic prior while
  // preserving zero-artificial-return continuity).
  chainIndex: ChainIndexState;

  // === P0-FIX-3: canonical 6-state risk machine (Master Listing 13 / §21.2) ===
  // Persisted across ticks so the hysteresis (RECOVERY 48h confirmation)
  // survives. The tick loop calls determineState() once per tick with the
  // previous state and `now`. `state` is the canonical RiskState (6 states
  // incl. STRESS); the legacy `status` field on the snapshot maps 1:1 to it.
  riskState: {
    state: RiskState;
    enteredAt: number;            // epoch ms when the current state was entered
    confirmationPeriodEnds: number | null; // RECOVERY only — end of 48h window
  };

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
  // P0-FIX: CHF base fixing is 1.13 (was 0.88 — was 28% underweighted). The
  // legacy `chfUsd / 0.88` produced ~28% MORE CHF tokens than the basket
  // intended; the corrected `chfUsd / 1.13` matches the Master Blueprint v1.0
  // and the canonical BASE_FIXINGS.CHF_USD used by the chain-linked index.
  const chf  = chfUsd / BASE_FIXINGS.CHF_USD;  // CHF per $1.13 (Master v1.0)
  // FIX: split gold across 2 issuers (PAXG/Paxos, XAUT/Tether) — 50/50
  const paxg = (goldSpend / goldPrice) * 0.5;
  const xaut = (goldSpend / goldPrice) * 0.5;

  // §14.1 Constitutional Separation — split the genesis gold 50/50 between the
  // index vault (locked, backs the 26% Strategic Prior Gold weight) and the
  // reserve buffer (the gold MARP rebalances). 50/50 was chosen over the
  // "26% to index / 74% to reserve" alternative because:
  //   - At genesis the total gold IS exactly 26% of NAV (deposit × STRATEGIC_PRIOR.Gold).
  //     A 26/74 split would leave index gold at only ~6.8% of NAV — far below
  //     the 26% index weight it is supposed to back, which is misleading.
  //   - A 50/50 split gives both pools meaningful starting capital (13% of NAV
  //     each), so MARP has a real buffer to rebalance AND the index gold is a
  //     meaningful "core" position.
  // The split is an accounting concept; the underlying PAXG + XAUT tokens are
  // the same. commitIndexGold() (keeper-role equivalent) is the only way to
  // move gold between the two pools.
  const indexPaxg = paxg * 0.5;
  const indexXaut = xaut * 0.5;
  const reservePaxg = paxg - indexPaxg;
  const reserveXaut = xaut - indexXaut;

  return {
    usdc,
    usdp,
    usdt,
    eurc, gbp, jpy, cny, chf,
    paxg,
    xaut,
    // §14.1 — index/reserve gold split (50/50 at genesis; index locked)
    indexPaxg,
    indexXaut,
    reservePaxg,
    reserveXaut,
    // §14.1 — default to legacy §7 rebalance path (USE_MARP_EXECUTION flag
    // in pilot-state.ts::tick() flips this to 'marp').
    rebalancePath: 'legacy',
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
    // v1.0 MASE — null until first advanceMase() call; STRATEGIC_PRIOR used as fallback.
    maseSmoothed: null,
    maseLastAt: 0,
    // §14.1 — indexPaxg/indexXaut/reservePaxg/reserveXaut/rebalancePath are
    // initialised above (next to paxg/xaut where the split is computed).
    // === P0-FIX-1: canonical chain-linked index — init at genesis with the
    // Strategic Prior weights and the corrected BASE_FIXINGS (CHF=1.13).
    chainIndex: initChainIndex(
      GFB_BASE_DENOMINATOR,
      strategicPriorToWeights(STRATEGIC_PRIOR),
      baseFixingsToPrices(BASE_FIXINGS),
      Date.now(),
    ),
    // === P0-FIX-3: canonical 6-state risk machine — start in NORMAL at genesis.
    riskState: {
      state: "NORMAL" as RiskState,
      enteredAt: Date.now(),
      confirmationPeriodEnds: null,
    },
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

// --- §14.1 Constitutional Separation helpers ---------------------------------
// Maintain the §14.1 invariant: paxg = indexPaxg + reservePaxg (and same for
// xaut). Index gold is LOCKED (only changes via commitIndexGold); reserve gold
// is the buffer MARP rebalances. These two helpers are the only sanctioned
// ways to keep the splits consistent after any mutation to total gold:

/** Re-derive reserve gold from total − index (call after the legacy path or
 *  concentration optimizer mutates `s.paxg` / `s.xaut` directly). Index gold
 *  stays locked. */
export function syncReserveFromTotal(s: ReserveState): void {
  s.reservePaxg = Math.max(0, s.paxg - s.indexPaxg);
  s.reserveXaut = Math.max(0, s.xaut - s.indexXaut);
}

/** Re-derive total gold from index + reserve (call after the MARP path mutates
 *  `s.reservePaxg` / `s.reserveXaut`). Index gold stays locked. */
export function syncTotalFromReserve(s: ReserveState): void {
  s.paxg = s.indexPaxg + Math.max(0, s.reservePaxg);
  s.xaut = s.indexXaut + Math.max(0, s.reserveXaut);
}

/** §14.1 commitIndexGold — the keeper-role equivalent in the TS engine.
 *  Sets the index gold holdings (PAXG + XAUT) that back the Strategic Prior
 *  Gold weight (26%). Only this function may move gold between the index
 *  vault and the reserve buffer. Recomputes the totals via the §14.1 invariant
 *  (reserve = total − index). Emits an IndexGoldCommitted event-equivalent
 *  (console log — production should emit an on-chain event). */
export function commitIndexGold(
  s: ReserveState,
  indexPaxg: number,
  indexXaut: number,
): { indexPaxg: number; indexXaut: number; reservePaxg: number; reserveXaut: number; totalPaxg: number; totalXaut: number } {
  const safeIndexPaxg = Math.max(0, indexPaxg);
  const safeIndexXaut = Math.max(0, indexXaut);
  s.indexPaxg = safeIndexPaxg;
  s.indexXaut = safeIndexXaut;
  // Reserve = max(0, total − index) — never let reserve go negative even if
  // the keeper over-commits (log a warning in that case).
  if (s.paxg < safeIndexPaxg) {
    console.warn(`[mtq-engine] commitIndexGold: indexPaxg ${safeIndexPaxg.toFixed(4)} > total paxg ${s.paxg.toFixed(4)} — reserve went to 0; total bumped to match index.`);
    s.paxg = safeIndexPaxg;
  }
  if (s.xaut < safeIndexXaut) {
    console.warn(`[mtq-engine] commitIndexGold: indexXaut ${safeIndexXaut.toFixed(4)} > total xaut ${s.xaut.toFixed(4)} — reserve went to 0; total bumped to match index.`);
    s.xaut = safeIndexXaut;
  }
  syncReserveFromTotal(s);
  s.updatedAt = Date.now();
  console.log(`[mtq-engine] IndexGoldCommitted: indexPaxg=${s.indexPaxg.toFixed(4)}, indexXaut=${s.indexXaut.toFixed(4)}, reservePaxg=${s.reservePaxg.toFixed(4)}, reserveXaut=${s.reserveXaut.toFixed(4)}`);
  return {
    indexPaxg: s.indexPaxg,
    indexXaut: s.indexXaut,
    reservePaxg: s.reservePaxg,
    reserveXaut: s.reserveXaut,
    totalPaxg: s.paxg,
    totalXaut: s.xaut,
  };
}

// --- §2 GFB Index (v1.0 — 7-component chain-linked) -------------------------
// GFB_t = Σ_i W^Prior_i × P_{i,t}  (then normalised by GFB_BASE_DENOMINATOR so
// GFB = 1.00 exactly at the base date). The 7 components are the Strategic
// Prior: USD, EUR, JPY, GBP, CNY, CHF, Gold. Gold is now a first-class index
// component (P_Gold = XAU_USD).
//
// DEPRECATED (P0-FIX-1): this is the LEGACY fixed-base Laspeyres index. It
// weights each component by its raw USD notional share (gold contributes
// 99.9% of the index by notional despite a 26% Strategic Prior weight), which
// creates a structural short-gold exposure that crashed the §23 validation
// program (S5: 0% survival, RR crashed to 0.83 in 100% of gold +50% runs).
//
// The CANONICAL chain-linked index lives in `src/lib/mtq/chain-index.ts`. The
// engine's `computeSnapshot` now uses `getMTQPrice(s.chainIndex)` (the
// chain-linked form) for both `gfbIndex` and `mtqPrice`. This legacy
// `computeGfbIndex` is RETAINED for backward compatibility with the
// standalone audit-stress.ts simulations (which need a pure function of fx,
// not the persisted chain index state).
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
// Legacy helper: P_MTQ = GFB_t (since GFB_base is normalised to 1.0).
// DEPRECATED (P0-FIX-1): the canonical P_MTQ is `getMTQPrice(s.chainIndex)`
// from chain-index.ts. This helper is retained for backward compatibility.
export function computeMtqPrice(gfb: number): number {
  // P_MTQ = GFB_t / GFB_base, with GFB_base = 1.0 (normalised)
  return gfb;
}

// === P0-FIX-1: Canonical chain-linked index helpers ===========================
// Advance the chain index one step with the latest FX/gold prices. MUTATES
// `s.chainIndex` (so the next computeSnapshot reads the fresh I_t). Called
// once per tick from the pilot-state tick loop AFTER fetching FX, BEFORE
// the first computeSnapshot.
export function advanceChainIndex(s: ReserveState, fx: FxRates): void {
  const prices = fxToPriceVector(fx);
  const result = advanceIndex(s.chainIndex, prices);
  s.chainIndex = result.state;
}

// Commit the MASE smoothed weights to the chain index (called from
// advanceMase after the new smoothed weights are computed). Computes the
// divisor D_t = B_t^- / B_t^+ that preserves index continuity (zero
// artificial return), updates G_t, and updates prevWeights + prevPrices to
// the new weights and the current FX prices. MUTATES `s.chainIndex`.
export function commitChainIndexWeights(
  s: ReserveState,
  fx: FxRates,
  newWeights: WeightVector,
): { divisor: number; newG: number } {
  const weightsArr = COMPONENTS.map((c) => newWeights[c] ?? 0);
  const pricesArr = fxToPriceVector(fx);
  const r = commitWeights(s.chainIndex, weightsArr, pricesArr, Date.now());
  s.chainIndex = r.state;
  return { divisor: r.divisor, newG: r.newG };
}

// The canonical MTQ reference price: P_MTQ = I_t × PAR (PAR = 1.0).
// Reads from the persisted chain index state (no mutation).
export function getMtqPriceFromState(s: ReserveState): number {
  return getMTQPrice(s.chainIndex);
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

  // §14.1 — index vs reserve gold split (USD net of haircut).
  // Index gold is locked (backs the 26% Strategic Prior Gold weight); reserve
  // gold is the buffer MARP rebalances. The total gold (= index + reserve) is
  // what serves the index weight for MASE/MARP observed-weight purposes.
  const indexPaxgUsd = s.indexPaxg * goldPrice * (1 - HAIRCUTS.XAU);
  const indexXautUsd = s.indexXaut * goldPrice * (1 - HAIRCUTS.XAU);
  const reservePaxgUsd = (s.reservePaxg >= 0 ? s.reservePaxg : Math.max(0, s.paxg - s.indexPaxg)) * goldPrice * (1 - HAIRCUTS.XAU);
  const reserveXautUsd = (s.reserveXaut >= 0 ? s.reserveXaut : Math.max(0, s.xaut - s.indexXaut)) * goldPrice * (1 - HAIRCUTS.XAU);
  const indexGoldNet = indexPaxgUsd + indexXautUsd;
  const reserveGoldNet = reservePaxgUsd + reserveXautUsd;

  return {
    usdGross, eurGross, gbpGross, jpyGross, cnyGross, chfGross, fiatGross,
    goldGross, goldPrice,
    usdNet, eurNet, gbpNet, jpyNet, cnyNet, chfNet, goldNet,
    nav, fiatNet,
    usdcUsd, usdpUsd, usdtUsd, paxgUsd, xautUsd,
    // §14.1 gold split
    indexPaxgUsd, indexXautUsd, reservePaxgUsd, reserveXautUsd,
    indexGoldNet, reserveGoldNet,
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

// --- §4.2.2 Status determination (CANONICAL — 6-state per Master Listing 13) ---
// P0-FIX-3: the canonical classification lives in state-machine.ts. This
// function is a backward-compat wrapper that calls `determineState` with the
// engine's persisted riskState and returns just the state string. The full
// CanonicalState (with enteredAt, confirmationPeriodEnds, worseCondition) is
// returned by `advanceRiskState` and exposed on the snapshot.
//
// NOTE: this wrapper does NOT persist hysteresis state — it computes the
// state purely from the current RR/LCR. The tick loop uses `advanceRiskState`
// (which persists) for the authoritative state. This wrapper is for
// standalone calls (e.g., applyMint/applyRedeem internals) that need a
// state classification from current RR/LCR without mutating persisted state.
export function determineStatus(rr: number, lcr: number): ProtocolStatus {
  // Use a deterministic-state call (no hysteresis) — previous = "NORMAL" with
  // enteredAt = now means RECOVERY confirmation never completes from this
  // call alone; the persisted path (advanceRiskState) is the source of truth.
  // For pure-RR/LCR classification, this matches the Master Listing 13 worse-
  // condition-binds rule exactly.
  const prev: RiskState = "NORMAL";
  const cs = determineState(rr, lcr, prev, Date.now(), Date.now());
  return cs.state;
}

// === P0-FIX-3: advance the canonical risk state (persists hysteresis) ========
// Called once per tick from the pilot-state tick loop AFTER the new RR/LCR
// are computed (post-rebalance, post-concentration-optimizer). Reads the
// previous state + enteredAt from s.riskState; writes the new state back.
// Returns the full CanonicalState (for the snapshot).
export function advanceRiskState(
  s: ReserveState,
  rr: number,
  lcr: number,
  now: number = Date.now(),
): CanonicalState {
  const cs = determineState(
    rr,
    lcr,
    s.riskState.state,
    s.riskState.enteredAt,
    now,
  );
  s.riskState = {
    state: cs.state,
    enteredAt: cs.enteredAt,
    confirmationPeriodEnds: cs.confirmationPeriodEnds,
  };
  return cs;
}

// === P0-FIX-4: parameter → governance layer lookup ===========================
// Returns which of the 4 governance layers (CONSTITUTIONAL, MONETARY, RISK,
// EMERGENCY) owns a given parameter, plus the envelope (if any) and the
// immutable flag. Returns null for unknown parameters.
export function getParameterGovernance(key: string): {
  layer: GovernanceLayerName;
  immutable?: boolean;
  envelope?: readonly number[];
} | null {
  const entry = (PARAMETER_REGISTRY as Record<string, { layer: GovernanceLayerName; immutable?: boolean; envelope?: readonly number[] }>)[key];
  return entry ?? null;
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
    // §14.1 — the sold gold comes from the RESERVE buffer (index gold is locked).
    // Maintain the invariant paxg = indexPaxg + reservePaxg.
    s.reservePaxg = Math.max(0, s.reservePaxg - goldUnits);
    s.usdc += usd;
  } else {
    // buy gold → spend USDC
    s.usdc = Math.max(0, s.usdc - usd);
    const goldUnits = usd / goldPrice;
    s.paxg += goldUnits;
    // §14.1 — the bought gold goes to the RESERVE buffer (index gold is locked).
    s.reservePaxg += goldUnits;
  }
  s.lastTradeDir = decision.direction;
  s.lastTradeAt = Date.now();
  s.dailyTurnoverUsd += usd;
  s.updatedAt = Date.now();
}

// --- §14.1 + §10 MARP per-component rebalance execution ---------------------
// applyMarpRebalance() is the v1.0 production-target rebalance path. Unlike the
// legacy §7 single-direction `applyRebalanceTrade` (which only trades gold ↔
// USDC), this takes the per-component MarpDecision[] (output of marpDecision())
// and applies each "would-execute" trade to the RESERVE holdings — index gold
// is LOCKED per §14.1 and never touched here.
//
// Trade execution model (pilot):
//   - For non-USD components (EUR/JPY/GBP/CNY/CHF/Gold): each trade pairs with
//     USD as the unit of account. A "sell" of component X converts X → USD
//     (split 1/3 across USDC/USDP/USDT, respecting the §5.6 concentration
//     target). A "buy" of component X converts USD → X.
//   - For USD: each trade pairs with Gold (the other deep pool). A "sell" of
//     USD converts USD → Gold (split 50/50 PAXG/XAUT in the RESERVE buffer).
//     A "buy" of USD converts Gold → USD.
//   - For Gold: a "sell" reduces reservePaxg + reserveXaut (50/50); a "buy"
//     increases them. Index gold is never touched.
//
// Constraints enforced (§10):
//   - MAX_DAILY_TURNOVER (5% of NAV) — trades that would breach are skipped.
//   - DIRECTION_LOCK_HOURS (24h) — trades that reverse the last direction
//     within 24h are skipped (whipsaw guard).
//   - Only decisions with shouldTrade=true AND level>=6 are executed
//     (level 1-5 are advisory: no-trade zone / low urgency / cost-benefit
//     fail / turnover cap).
//
// Mutates: s.usdc/usdp/usdt, s.eurc/gbp/jpy/cny/chf, s.reservePaxg/reserveXaut
//          (and re-syncs s.paxg/xaut totals via the §14.1 invariant),
//          s.lastTradeDir/lastTradeAt, s.dailyTurnoverUsd, s.updatedAt.
// Index gold (s.indexPaxg, s.indexXaut) is NEVER touched.
export interface MarpExecDecision {
  shouldTrade: boolean;
  component: string;
  direction: string;
  tradeUsd: number;
  level: number;
}

export interface MarpExecResult {
  appliedCount: number;
  skippedCount: number;
  totalTradeUsd: number;
  path: 'legacy' | 'marp';
  // Per-decision trace: which were applied vs skipped (and why).
  traces: { component: string; direction: string; tradeUsd: number; level: number; applied: boolean; skipReason?: string }[];
}

export function applyMarpRebalance(
  s: ReserveState,
  fx: FxRates,
  decisions: MarpExecDecision[],
): MarpExecResult {
  let appliedCount = 0;
  let skippedCount = 0;
  let totalTradeUsd = 0;
  const traces: MarpExecResult['traces'] = [];

  maybeResetDailyTurnover(s);
  const vals = reserveAssetValues(s, fx);
  const nav = vals.nav;
  if (nav <= 0) {
    // Nothing to do — surface a single skip trace for visibility.
    for (const d of decisions) {
      traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: 'NAV ≤ 0' });
    }
    return { appliedCount: 0, skippedCount: decisions.length, totalTradeUsd: 0, path: 'marp', traces };
  }
  const goldPrice = vals.goldPrice;

  for (const d of decisions) {
    // Level gate: only execute shouldTrade && level >= 6 decisions.
    if (!d.shouldTrade || d.level < 6) {
      skippedCount++;
      traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: `level ${d.level} (advisory)` });
      continue;
    }
    let tradeUsd = d.tradeUsd;
    // Enforce MAX_DAILY_TURNOVER (5% of NAV)
    const remainingDaily = MAX_DAILY_TURNOVER * nav - s.dailyTurnoverUsd;
    if (tradeUsd > remainingDaily) {
      tradeUsd = Math.max(0, remainingDaily);
    }
    if (tradeUsd <= 0) {
      skippedCount++;
      traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: 'daily turnover cap' });
      continue;
    }
    // Direction (+1 buy / -1 sell / 0 hold)
    const dir: 0 | 1 | -1 = d.direction === 'buy' ? 1 : d.direction === 'sell' ? -1 : 0;
    if (dir === 0) {
      skippedCount++;
      traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: 'hold' });
      continue;
    }
    // Enforce DIRECTION_LOCK_HOURS (24h whipsaw guard)
    if (Date.now() - s.lastTradeAt < DIRECTION_LOCK_HOURS * 3_600_000) {
      if ((dir === 1 && s.lastTradeDir === -1) || (dir === -1 && s.lastTradeDir === 1)) {
        skippedCount++;
        traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: 'direction lock (24h whipsaw guard)' });
        continue;
      }
    }

    // Apply the trade to the RESERVE holdings.
    if (d.component === 'Gold') {
      // Gold ↔ USD. Split 50/50 across reservePaxg + reserveXaut.
      const goldUnits = tradeUsd / goldPrice;
      const half = goldUnits / 2;
      if (dir === -1) {
        // sell gold → USD
        s.reservePaxg = Math.max(0, s.reservePaxg - half);
        s.reserveXaut = Math.max(0, s.reserveXaut - half);
        const usdThird = tradeUsd / 3;
        s.usdc += usdThird;
        s.usdp += usdThird;
        s.usdt += usdThird;
      } else {
        // buy gold ← USD
        const usdThird = tradeUsd / 3;
        s.usdc = Math.max(0, s.usdc - usdThird);
        s.usdp = Math.max(0, s.usdp - usdThird);
        s.usdt = Math.max(0, s.usdt - usdThird);
        s.reservePaxg += half;
        s.reserveXaut += half;
      }
      // §14.1 — re-sync total paxg/xaut = index + reserve
      syncTotalFromReserve(s);
    } else if (d.component === 'USD') {
      // USD ↔ Gold. Split 50/50 across reservePaxg + reserveXaut.
      const goldUnits = tradeUsd / goldPrice;
      const half = goldUnits / 2;
      if (dir === -1) {
        // sell USD → gold
        const usdThird = tradeUsd / 3;
        s.usdc = Math.max(0, s.usdc - usdThird);
        s.usdp = Math.max(0, s.usdp - usdThird);
        s.usdt = Math.max(0, s.usdt - usdThird);
        s.reservePaxg += half;
        s.reserveXaut += half;
      } else {
        // buy USD ← gold
        s.reservePaxg = Math.max(0, s.reservePaxg - half);
        s.reserveXaut = Math.max(0, s.reserveXaut - half);
        const usdThird = tradeUsd / 3;
        s.usdc += usdThird;
        s.usdp += usdThird;
        s.usdt += usdThird;
      }
      // §14.1 — re-sync total paxg/xaut = index + reserve
      syncTotalFromReserve(s);
    } else {
      // Non-USD fiat component (EUR/JPY/GBP/CNY/CHF) ↔ USD.
      // Convert tradeUsd to native units via the FX rate.
      const fxRate =
        d.component === 'EUR' ? fx.EUR_USD :
        d.component === 'JPY' ? fx.JPY_USD :
        d.component === 'GBP' ? fx.GBP_USD :
        d.component === 'CNY' ? fx.CNY_USD :
        d.component === 'CHF' ? fx.CHF_USD : 1.0;
      const nativeUnits = tradeUsd / fxRate;
      const usdThird = tradeUsd / 3;
      if (dir === -1) {
        // sell component → USD
        if (d.component === 'EUR') s.eurc = Math.max(0, s.eurc - nativeUnits);
        else if (d.component === 'JPY') s.jpy = Math.max(0, s.jpy - nativeUnits);
        else if (d.component === 'GBP') s.gbp = Math.max(0, s.gbp - nativeUnits);
        else if (d.component === 'CNY') s.cny = Math.max(0, s.cny - nativeUnits);
        else if (d.component === 'CHF') s.chf = Math.max(0, s.chf - nativeUnits);
        s.usdc += usdThird;
        s.usdp += usdThird;
        s.usdt += usdThird;
      } else {
        // buy component ← USD
        s.usdc = Math.max(0, s.usdc - usdThird);
        s.usdp = Math.max(0, s.usdp - usdThird);
        s.usdt = Math.max(0, s.usdt - usdThird);
        if (d.component === 'EUR') s.eurc += nativeUnits;
        else if (d.component === 'JPY') s.jpy += nativeUnits;
        else if (d.component === 'GBP') s.gbp += nativeUnits;
        else if (d.component === 'CNY') s.cny += nativeUnits;
        else if (d.component === 'CHF') s.chf += nativeUnits;
      }
    }

    s.lastTradeDir = dir;
    s.lastTradeAt = Date.now();
    s.dailyTurnoverUsd += tradeUsd;
    totalTradeUsd += tradeUsd;
    appliedCount++;
    traces.push({ component: d.component, direction: d.direction, tradeUsd, level: d.level, applied: true });
  }

  s.updatedAt = Date.now();
  return { appliedCount, skippedCount, totalTradeUsd, path: 'marp', traces };
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
  throttleFactor: number; // 1.0 normal, 0.5 caution, 0.25 recovery, 0 paused
  newCirculatingSupply: number;
  newReserveRatio: number;
}

export function applyMint(
  s: ReserveState,
  fx: FxRates,
  status: ProtocolStatus,
  inputUsd: number,
): MintResult {
  // P0-FIX-1: use the canonical chain-linked index for the MTQ price (the
  // legacy Laspeyres form had a structural short-gold bug — see chain-index.ts).
  const price = getMtqPriceFromState(s);
  if (!priceInSafetyBand(price)) {
    return { ok: false, reason: "MTQ price outside safety band (0.50–2.00 USD); minting paused by circuit breaker.", inputUsd, feeUsd: 0, netUsd: 0, mtqPrice: price, mtqMinted: 0, throttleFactor: 0, newCirculatingSupply: circulatingSupply(s), newReserveRatio: computeReserveRatio(reserveAssetValues(s, fx).nav, computeLiability(s, price)) };
  }
  // P0-FIX-3: use the canonical mint throttle / minting-allowed from
  // state-machine.ts. STRESS now also pauses minting (previously only
  // DEFENSIVE/EMERGENCY did). NORMAL=1.0, CAUTION=0.5, STRESS/DEFENSIVE/EMERGENCY=0 (paused), RECOVERY=0.25.
  if (!mintingAllowed(status)) {
    return { ok: false, reason: `${status}: minting paused by canonical Risk State Machine (§21.3).`, inputUsd, feeUsd: 0, netUsd: 0, mtqPrice: price, mtqMinted: 0, throttleFactor: 0, newCirculatingSupply: circulatingSupply(s), newReserveRatio: computeReserveRatio(reserveAssetValues(s, fx).nav, computeLiability(s, price)) };
  }
  const throttle = mintThrottle(status);
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
  // P0-FIX-2: PRIMARY valuation is now NAV-based (per Master §19.3.2, Invariant I6).
  // grossUsd = inputMtq × NAV_t, where NAV_t = V_net / circulatingSupply.
  // The legacy §3.4.2 (index-priced) valuation is retained in auditGrossUsdIndex
  // for comparison; the §12.2 (NAV-based) valuation is now the canonical settlement.
  grossUsd: number;
  feeBps: number;
  feeUsd: number;
  netUsd: number;
  goldUsd: number;
  goldPaxg: number;
  basket: RedeemBasket[];
  newCirculatingSupply: number;
  newReserveRatio: number;
  // P0-FIX-2: NAV_t used for settlement (V_net / circulatingSupply, fallback P_MTQ at genesis)
  navPerMtq: number;
  // Audit fields (retained from the legacy §3.4.2 vs §12.2 reconciliation)
  auditNavPerToken: number;       // V_net / S (book value per MTQ) — same as navPerMtq
  auditGrossUsdNav: number;      // Y × NAV_per_token (§12.2 — now the CANONICAL settlement)
  auditGrossUsdIndex: number;    // Y × P_MTQ (§3.4.2 — now the AUDIT-ONLY alternative)
  auditDeltaUsd: number;          // §12.2 − §3.4.2 (positive → NAV pays more than index)
  auditNote: string;
}

export function applyRedeem(
  s: ReserveState,
  fx: FxRates,
  status: ProtocolStatus,
  inputMtq: number,
): RedeemResult {
  // P0-FIX-1: use the canonical chain-linked index for P_MTQ.
  const price = getMtqPriceFromState(s);
  const circ = circulatingSupply(s);
  // Pre-settlement reserve values (used to compute NAV_t and the audit fields).
  const vals0 = reserveAssetValues(s, fx);
  // P0-FIX-2 (Master §19.3.2, Invariant I6): NAV-based redemption.
  //   NAV_t = V_net / circulatingSupply; grossUsd = inputMtq × NAV_t
  //
  // Genesis fallback: at genesis (or any time circulatingSupply = 0), NAV_t
  // is undefined (division by zero). We fall back to P_MTQ in this case:
  //   - At genesis, there is no circulating MTQ to redeem (the inputMtq > circ
  //     guard below catches this case explicitly).
  //   - In practice the fallback is exercised only when the protocol has not
  //     yet minted any circulating supply — the redemption would fail with
  //     "insufficient supply" before reaching the NAV computation.
  //   - After the first mint, circulating supply > 0 and NAV_t = V_net / S_circ
  //     will be very high (e.g. $42/MTQ when RR = 2400%) — this is CORRECT:
  //     redeeming 1 MTQ returns $42 worth of reserve, which IS the actual
  //     value of the token. The Index/NAV divergence analysis (§12) surfaces
  //     when this matters (e.g. when NAV_per_MTQ diverges from P_MTQ by >5%
  //     → "monitor" status; >10% → "stress").
  const navPerMtq = circ > 0 ? vals0.nav / circ : price;
  // Honest audit fields (computed pre-settlement so they exist on the error path too).
  // P0-FIX-2: the primary settlement now uses NAV (§12.2 — formerly audit-only).
  // The legacy §3.4.2 (index-priced) is now the AUDIT-ONLY alternative.
  const auditNavPerToken = navPerMtq;
  const auditGrossUsdNav = inputMtq * navPerMtq;
  const auditGrossUsdIndex = inputMtq * price;
  const auditNote =
    "P0-FIX-2 (Master §19.3.2, Invariant I6): redemption is now priced against " +
    "NAV_t = V_net / circulatingSupply (the §12.2 form, formerly audit-only). " +
    "The legacy §3.4.2 (redeem at P_MTQ) is now the AUDIT-ONLY alternative " +
    "(auditGrossUsdIndex). At RR>100% the NAV pays redeemers MORE than the index " +
    "price (auditDeltaUsd > 0), which IS the intent: the redeemer receives the " +
    "actual book value of their token, not just the index-tracked price. The " +
    "§12 Index/NAV divergence analysis surfaces when this gap becomes material " +
    "(>5% monitor, >10% stress).";
  if (inputMtq > circ) {
    return { ok: false, reason: "Insufficient circulating supply for this redemption in pilot state.", inputMtq, mtqPrice: price, grossUsd: 0, feeBps: 0, feeUsd: 0, netUsd: 0, goldUsd: 0, goldPaxg: 0, basket: [], newCirculatingSupply: circ, newReserveRatio: computeReserveRatio(vals0.nav, computeLiability(s, price)), navPerMtq, auditNavPerToken, auditGrossUsdNav, auditGrossUsdIndex, auditDeltaUsd: auditGrossUsdNav - auditGrossUsdIndex, auditNote };
  }
  // P0-FIX-3: §21.4 — redemption is PAUSED in EMERGENCY (the reconciliation
  // resolves the §16.2 vs §21.4 contradiction in favour of §21.4: pause).
  if (!redemptionAllowed(status)) {
    return { ok: false, reason: `${status}: redemption paused per §21.4 (canonical Risk State Machine).`, inputMtq, mtqPrice: price, grossUsd: 0, feeBps: 0, feeUsd: 0, netUsd: 0, goldUsd: 0, goldPaxg: 0, basket: [], newCirculatingSupply: circ, newReserveRatio: computeReserveRatio(vals0.nav, computeLiability(s, price)), navPerMtq, auditNavPerToken, auditGrossUsdNav, auditGrossUsdIndex, auditDeltaUsd: auditGrossUsdNav - auditGrossUsdIndex, auditNote };
  }
  // P0-FIX-3: state-dependent fee from the canonical 6-state risk machine.
  // NORMAL/CAUTION 0.15% (15 bps), STRESS 0.50% (50 bps), DEFENSIVE 1.00%
  // (100 bps), EMERGENCY 2.00% (200 bps), RECOVERY 0.50% (50 bps).
  const feeFraction = redeemFee(status);
  const feeBps = Math.round(feeFraction * 10_000);
  // P0-FIX-2: grossUsd is now NAV-based (was index-based in the legacy engine).
  const grossUsd = inputMtq * navPerMtq;
  const feeUsd = grossUsd * feeFraction;
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
  // §14.1 — gold released to the redeemer comes from the RESERVE buffer first
  // (index gold is locked). syncReserveFromTotal re-derives reserve = total − index
  // so the invariant paxg = indexPaxg + reservePaxg is preserved.
  syncReserveFromTotal(s);
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
    navPerMtq,
    auditNavPerToken,
    auditGrossUsdNav,
    auditGrossUsdIndex,
    auditDeltaUsd: auditGrossUsdNav - auditGrossUsdIndex,
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
    // §14.1 — index gold vs reserve buffer gold (USD net of haircut).
    // goldNet = indexGoldNet + reserveGoldNet (TOTAL gold serves the index weight;
    // only reserveGoldNet is MARP-rebalanced).
    indexGoldNet: number;
    reserveGoldNet: number;
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
  depegHours: ReserveState["depegHours"];
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
  // v1.0: MASE + 4-state weights + MARP
  mase: {
    models: { id: string; name: string; weights: Record<string, number> }[];
    ensembleTarget: Record<string, number>;
  } | null;
  weightStates: {
    prior: Record<string, number>;
    target: Record<string, number>;
    smoothed: Record<string, number>;
    execution: Record<string, number>;
  } | null;
  marp: {
    decisions: { shouldTrade: boolean; component: string; direction: string; tradeUsd: number; urgency: number; reason: string; level: number }[];
    totalTradeUsd: number;
  } | null;
  // §14.1 — per-component MARP execution summary (read-only projection of what
  // MARP WOULD do this tick; the actual mutation happens in applyMarpRebalance()
  // only when USE_MARP_EXECUTION=true in pilot-state.ts). The UI shows this
  // alongside the legacy §7 single-direction decision for A/B comparison.
  marpExecution: {
    appliedCount: number;     // # of decisions with shouldTrade && level >= 6
    skippedCount: number;     // # of decisions skipped (no-trade zone / low urgency / cost-benefit fail / turnover cap / direction lock)
    totalTradeUsd: number;    // Σ tradeUsd for the would-execute decisions
    path: 'legacy' | 'marp';   // which execution path is currently mutating state (mirrors s.rebalancePath)
  } | null;
  // §14.1 — which rebalance execution path is currently active. Reads from
  // s.rebalancePath (set by the feature flag in pilot-state.ts::tick()). The
  // UI renders this as an A/B badge ("Legacy §7 active" / "MARP active").
  rebalancePath: 'legacy' | 'marp';
  envelopes: { component: string; lower: number; upper: number; current: number; status: "ok" | "warn" | "breach" }[];

  // === P0-FIX-1: canonical chain-linked index (Master Listing 3 / §9.2 COO-16) ===
  // The full chain index state — exposed so the UI / auditors can verify I_t,
  // G_t, the prior weights/prices, and the baseDenominator. The MTQ price
  // (mtqPrice / gfbIndex) is now derived from chainIndex.I_t, NOT from the
  // legacy Laspeyres computeGfbIndex.
  chainIndex: {
    I_t: number;
    G_t: number;
    prevWeights: number[];     // [USD, EUR, JPY, GBP, CNY, CHF, Gold]
    prevPrices: number[];      // [USD, EUR, JPY, GBP, CNY, CHF, Gold]
    baseDenominator: number;
    lastUpdate: number;
  };

  // === P0-FIX-3: canonical 6-state risk machine (Master Listing 13 / §21.2) ===
  // The full canonical state — `state` is the same value as `status` above
  // (kept for backward compat), plus the hysteresis fields (enteredAt,
  // confirmationPeriodEnds) and the diagnostics (worseCondition, mintThrottle,
  // redeemFeePct, rebalanceUrgency, mintingAllowed, redemptionAllowed).
  riskState: RiskState;
  riskStateEnteredAt: number;
  riskStateConfirmationEnds: number | null;
  riskStateWorseCondition: "rr" | "lcr" | "both" | "neither";
  mintThrottle: number;
  redeemFeePct: number;        // fraction, e.g. 0.0015 = 0.15%
  rebalanceUrgency: number;
  mintingAllowed: boolean;
  redemptionAllowed: boolean;

  // === P0-FIX-2: Index/NAV divergence analysis (Master §12) ===
  // Monitor NAV_per_MTQ - P_MTQ. Flag if divergence > 5% (monitor), > 10% (stress).
  // At RR > 100% the NAV exceeds the index price (the buffer surplus shows up as
  // a higher NAV per token). This is the expected behaviour — the analysis
  // surfaces when the gap becomes material enough to warrant attention.
  indexNavDivergence: {
    navPerMtq: number;         // V_net / S_circ (fallback P_MTQ at genesis)
    pMtq: number;              // canonical chain-linked P_MTQ
    divergence: number;        // NAV_per_MTQ - P_MTQ (signed)
    divergencePct: number;     // |divergence| / P_MTQ × 100
    threshold: number;         // 5% monitor / 10% stress — the active threshold
    status: "normal" | "monitor" | "stress";
  };

  // === P0-FIX-4: 4 governance layers (Master Listing 14 / §22.3) ===
  // The 4-layer hierarchy (CONSTITUTIONAL/MONETARY/RISK/EMERGENCY) with each
  // layer's authority, timelock, and scope. Plus the parameter → layer
  // registry (which layer owns which parameter, and the envelope where
  // applicable). The TS reference exposes the metadata; the contract will
  // implement the actual 4 timelocks.
  governanceLayers: typeof GOVERNANCE_LAYERS;
  parameterRegistry: typeof PARAMETER_REGISTRY;
}

export function computeSnapshot(s: ReserveState, fx: FxSnapshot, ctx?: { oracle?: OracleBoard | null; registry?: AssetRecord[] | null }): MetricsSnapshot {
  // P0-FIX-1: the MTQ price comes from the canonical chain-linked index
  // (state.chainIndex.I_t), NOT from the legacy Laspeyres computeGfbIndex.
  // The legacy computeGfbIndex is retained as a deprecated export for the
  // standalone audit-stress sims (which don't have persisted state).
  const price = getMtqPriceFromState(s);
  const gfb = price; // gfbIndex now mirrors the chain-linked I_t (P_MTQ = I_t × PAR = I_t)
  const vals = reserveAssetValues(s, fx);
  const nav = vals.nav;
  const liability = computeLiability(s, price);
  const rr = computeReserveRatio(nav, liability);
  const lcr = computeLcr(s, vals, price);
  // P0-FIX-3: the snapshot's `status` field comes from the PERSISTED canonical
  // state (s.riskState.state) — this preserves the RECOVERY hysteresis (the
  // 48h confirmation window). The legacy `determineStatus(rr, lcr)` is a
  // stateless wrapper that doesn't preserve hysteresis.
  const status: ProtocolStatus = s.riskState.state;
  const canonicalState: RiskState = s.riskState.state;
  // Canonical-state-derived policy fields (one source of truth).
  const mintThrottleVal = mintThrottle(canonicalState);
  const redeemFeePctVal = redeemFee(canonicalState);
  const rebalanceUrgencyVal = rebalanceUrgency(canonicalState);
  const mintingAllowedVal = mintingAllowed(canonicalState);
  const redemptionAllowedVal = redemptionAllowed(canonicalState);
  // P0-FIX-2: Index/NAV divergence analysis (§12).
  // NAV_per_MTQ = V_net / circulatingSupply (fallback P_MTQ at genesis).
  // divergence = NAV_per_MTQ - P_MTQ (signed).
  // divergencePct = |divergence| / P_MTQ × 100.
  // status = "normal" (<5%), "monitor" (5-10%), "stress" (>10%).
  const circ = circulatingSupply(s);
  const navPerMtq = circ > 0 ? nav / circ : price;
  const divergence = navPerMtq - price;
  const divergencePct = price > 0 ? (Math.abs(divergence) / price) * 100 : 0;
  const divergenceStatus: "normal" | "monitor" | "stress" =
    divergencePct > 10 ? "stress" :
    divergencePct > 5  ? "monitor" :
    "normal";
  const divergenceThreshold = divergenceStatus === "stress" ? 10 : divergenceStatus === "monitor" ? 5 : 0;
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

  // --- v1.0 MASE + 4-state weights + MARP (computed fresh per snapshot, READ-ONLY) ---
  // The previous tick's smoothed weights are stored in `s.maseSmoothed` (updated
  // by `advanceMase()` in the tick loop). computeSnapshot uses that as the EMA
  // prior — it does NOT mutate state, so multiple calls within a single tick
  // return the same value (idempotent).
  const maseData = buildMaseSnapshot(s, fx, vals, nav, rr);

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
      // §14.1 — index/reserve gold split
      indexGoldNet: vals.indexGoldNet,
      reserveGoldNet: vals.reserveGoldNet,
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
    depegHours: s.depegHours,
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
    // v1.0: MASE + 4-state weights + MARP + admissibility envelope status
    mase: maseData.mase,
    weightStates: maseData.weightStates,
    marp: maseData.marp,
    // §14.1 — per-component MARP execution summary (read-only projection of
    // what MARP WOULD do this tick; the actual mutation happens in
    // applyMarpRebalance() only when USE_MARP_EXECUTION=true).
    marpExecution: maseData.marpExecution,
    // §14.1 — which rebalance path is currently mutating state ('legacy' | 'marp').
    rebalancePath: s.rebalancePath,
    envelopes: maseData.envelopes,
    // === P0-FIX-1: canonical chain-linked index state ===
    chainIndex: {
      I_t: s.chainIndex.I_t,
      G_t: s.chainIndex.G_t,
      prevWeights: s.chainIndex.prevWeights,
      prevPrices: s.chainIndex.prevPrices,
      baseDenominator: s.chainIndex.baseDenominator,
      lastUpdate: s.chainIndex.lastUpdate,
    },
    // === P0-FIX-3: canonical 6-state risk machine ===
    riskState: canonicalState,
    riskStateEnteredAt: s.riskState.enteredAt,
    riskStateConfirmationEnds: s.riskState.confirmationPeriodEnds,
    riskStateWorseCondition:
      // Derive the worseCondition from the current RR/LCR vs the state's bands.
      // (The persisted state doesn't carry this; it's a snapshot diagnostic.)
      determineState(rr, lcr, canonicalState, s.riskState.enteredAt, Date.now()).worseCondition,
    mintThrottle: mintThrottleVal,
    redeemFeePct: redeemFeePctVal,
    rebalanceUrgency: rebalanceUrgencyVal,
    mintingAllowed: mintingAllowedVal,
    redemptionAllowed: redemptionAllowedVal,
    // === P0-FIX-2: Index/NAV divergence analysis ===
    indexNavDivergence: {
      navPerMtq,
      pMtq: price,
      divergence,
      divergencePct,
      threshold: divergenceThreshold,
      status: divergenceStatus,
    },
    // === P0-FIX-4: 4 governance layers + parameter registry ===
    governanceLayers: GOVERNANCE_LAYERS,
    parameterRegistry: PARAMETER_REGISTRY,
  };
}

// --- §6/§7/§8.4/§10 v1.0 MASE + 4-state weights + MARP ---------------------
// The Multi-Asset Stochastic Ensemble (§6/§7) runs 6 candidate models, blends
// them into a single target weight vector, clamps to per-component
// admissibility envelopes (§8.1), and EMA-smooths toward the constrained target
// (§8.4). MARP (§10) then decides per-component whether the deviation between
// the smoothed target and the observed execution weight justifies a trade
// (urgency test → no-trade zone → cost-benefit gate → partial correction →
// daily-turnover cap → execute).
//
// `advanceMase(s, fx)` is called ONCE per tick from the pilot-state tick loop.
// It is the only function that mutates `s.maseSmoothed`. `buildMaseSnapshot()`
// is a pure helper used by `computeSnapshot()` — it recomputes target/smoothed/
// MARP from the current fx + vals using the persisted prev-smoothed as the EMA
// prior, so multiple computeSnapshot calls within a single tick return the
// same value (idempotent).

interface MaseSnapshotData {
  mase: NonNullable<MetricsSnapshot["mase"]>;
  weightStates: NonNullable<MetricsSnapshot["weightStates"]>;
  marp: NonNullable<MetricsSnapshot["marp"]>;
  // §14.1 — read-only projection of what MARP WOULD do this tick.
  marpExecution: NonNullable<MetricsSnapshot["marpExecution"]>;
  envelopes: MetricsSnapshot["envelopes"];
}

/** Estimate per-component annualized volatility from the engine's macro state.
 *  Pilot approximation: scale baseline vols by VIX / 18.5 (the "normal" VIX
 *  baseline), so a 30 VIX roughly doubles estimated vols and a 12 VIX halves
 *  them. Production should use a rolling covariance from real price history. */
function estimateVolsFromState(s: ReserveState): VolatilityData {
  const vix = s.lastVix > 0 ? s.lastVix : 18.5;
  const f = vix / 18.5;
  return {
    USD: 0.05 * f,
    EUR: 0.10 * f,
    JPY: 0.12 * f,
    GBP: 0.11 * f,
    CNY: 0.09 * f,
    CHF: 0.10 * f,
    Gold: 0.15 * f,
  };
}

/** Detect the market regime from VIX (primary) + DXY (secondary).
 *  0 = calm, 1 = normal, 2 = stress, 3 = crisis.
 *  VIX thresholds: <15 calm, <22 normal, <30 stress, ≥30 crisis.
 *  DXY extremes (<88 or >115) bump the regime up to ≥ stress. */
function detectRegime(vix: number, dxy: number, goldVol: number): MarketRegime {
  let r: 0 | 1 | 2 | 3 = 1;
  if (vix >= 30) r = 3;
  else if (vix >= 22) r = 2;
  else if (vix >= 15) r = 1;
  else r = 0;
  if ((dxy >= 115 || dxy <= 88) && r < 2) r = 2;
  return { regime: r, vix, dxy, goldVol };
}

/** Build PriceData (P_{i,t} / P_{i,0}) from current FX rates + base fixings. */
function buildPriceData(fx: Pick<FxRates, "EUR_USD" | "GBP_USD" | "JPY_USD" | "CNY_USD" | "CHF_USD" | "XAU_USD">): PriceData {
  return {
    USD: 1.0,
    EUR: fx.EUR_USD / BASE_FIXINGS.EUR_USD,
    JPY: fx.JPY_USD / BASE_FIXINGS.JPY_USD,
    GBP: fx.GBP_USD / BASE_FIXINGS.GBP_USD,
    CNY: fx.CNY_USD / BASE_FIXINGS.CNY_USD,
    CHF: fx.CHF_USD / BASE_FIXINGS.CHF_USD,
    Gold: fx.XAU_USD / BASE_FIXINGS.XAU_USD,
  };
}

/** Build the observed execution-weight vector from the actual reserve composition.
 *  §14.1 note: the Gold component's observed weight uses the TOTAL gold
 *  (= indexPaxg + indexXaut + reservePaxg + reserveXaut, USD-net). Both the
 *  index gold (locked) and the reserve gold (MARP-rebalanced) serve the
 *  Strategic Prior Gold weight (26%) — but only the RESERVE gold is available
 *  for MARP to rebalance. The index gold is locked and only changes when
 *  commitIndexGold() is called (keeper-role equivalent). */
function buildObservedWeights(
  vals: ReturnType<typeof reserveAssetValues>,
  nav: number,
): WeightVector {
  if (nav <= 0) {
    return { USD: 0, EUR: 0, JPY: 0, GBP: 0, CNY: 0, CHF: 0, Gold: 0 };
  }
  return {
    USD: vals.usdNet / nav,
    EUR: vals.eurNet / nav,
    JPY: vals.jpyNet / nav,
    GBP: vals.gbpNet / nav,
    CNY: vals.cnyNet / nav,
    CHF: vals.chfNet / nav,
    // §14.1 — gold weight = TOTAL gold (index + reserve) / NAV. Both pools
    // back the 26% Strategic Prior Gold weight; only reserve is MARP-rebalanced.
    Gold: vals.goldNet / nav,
  };
}

/** Pure helper — computes the MASE + 4-state + MARP + envelope snapshot data.
 *  Reads `s.maseSmoothed` (does NOT mutate). */
function buildMaseSnapshot(
  s: ReserveState,
  fx: FxSnapshot,
  vals: ReturnType<typeof reserveAssetValues>,
  nav: number,
  rr: number,
): MaseSnapshotData {
  const prices = buildPriceData(fx);
  const vols = estimateVolsFromState(s);
  const regime = detectRegime(s.lastVix > 0 ? s.lastVix : fx.VIX, s.lastDxy > 0 ? s.lastDxy : fx.DXY, vols.Gold);

  // §6/§7 — MASE ensemble → 6 candidate models + target weight vector
  const mase = maseEnsemble(vols, prices, null, regime);
  // §8.1 — Constrain target to per-component admissibility envelopes
  const constrained = applyEnvelopes(mase.target);
  // §8.4 — EMA-smooth toward the constrained target (uses prev persisted as prior)
  const prevSmoothed = s.maseSmoothed ?? (STRATEGIC_PRIOR as WeightVector);
  const smoothed = smoothWeights(prevSmoothed, constrained);
  // §2.3 — Execution = actual observed reserve composition
  const observed = buildObservedWeights(vals, nav);

  // §10 — MARP per-component rebalancing decision
  const volsRecord: Record<Component, number> = {
    USD: vols.USD, EUR: vols.EUR, JPY: vols.JPY, GBP: vols.GBP,
    CNY: vols.CNY, CHF: vols.CHF, Gold: vols.Gold,
  };
  const marpDecisions: MarpDecision[] = marpDecision(observed, smoothed, nav, rr, volsRecord);
  const totalTradeUsd = marpDecisions
    .filter((d) => d.shouldTrade)
    .reduce((a, d) => a + d.tradeUsd, 0);

  // §14.1 — per-component MARP execution summary (READ-ONLY projection).
  // appliedCount = # of decisions with shouldTrade && level >= 6 (would-execute).
  // skippedCount  = # of decisions held back (no-trade zone / low urgency /
  //                 cost-benefit fail / turnover cap / sub-level-6).
  // totalTradeUsd = Σ tradeUsd for the would-execute decisions.
  // path = which execution path is currently mutating state (mirrors s.rebalancePath).
  // NOTE: this is what MARP WOULD do based on the current decisions. The actual
  // mutation happens in applyMarpRebalance() only when USE_MARP_EXECUTION=true
  // in pilot-state.ts. applyMarpRebalance may further skip decisions that
  // breach MAX_DAILY_TURNOVER or DIRECTION_LOCK_HOURS at execution time.
  const wouldExecute = marpDecisions.filter((d) => d.shouldTrade && d.level >= 6);
  const marpExecution = {
    appliedCount: wouldExecute.length,
    skippedCount: marpDecisions.length - wouldExecute.length,
    totalTradeUsd: wouldExecute.reduce((a, d) => a + d.tradeUsd, 0),
    path: s.rebalancePath,
  };

  // §8.1 — Admissibility envelope status per component
  // "warn" = within 10% of the band edge; "breach" = outside the envelope.
  const envelopes = COMPONENTS.map((c) => {
    const env = ADMISSIBILITY_ENVELOPES[c];
    const current = observed[c];
    const lower = env.lower;
    const upper = env.upper;
    const margin = (upper - lower) * 0.1;
    let status: "ok" | "warn" | "breach" = "ok";
    if (current < lower || current > upper) status = "breach";
    else if (current < lower + margin || current > upper - margin) status = "warn";
    return { component: c, lower, upper, current, status };
  });

  return {
    mase: {
      models: mase.models.map((m) => ({
        id: m.id,
        name: m.name,
        weights: m.weights as Record<string, number>,
      })),
      ensembleTarget: mase.target as Record<string, number>,
    },
    weightStates: {
      prior: STRATEGIC_PRIOR as Record<string, number>,
      target: constrained as Record<string, number>,
      smoothed: smoothed as Record<string, number>,
      execution: observed as Record<string, number>,
    },
    marp: {
      decisions: marpDecisions.map((d) => ({
        shouldTrade: d.shouldTrade,
        component: d.component,
        direction: d.direction,
        tradeUsd: d.tradeUsd,
        urgency: d.urgency,
        reason: d.reason,
        level: d.level,
      })),
      totalTradeUsd,
    },
    // §14.1 — MARP execution summary (read-only projection; mirrors s.rebalancePath).
    marpExecution,
    envelopes,
  };
}

/** Advance MASE state once per tick. Mutates `s.maseSmoothed` (EMA prior for
 *  the next tick) and `s.chainIndex` (commits the new weights to preserve
 *  zero-artificial-return continuity per Master §9.2 COO-16). Called from
 *  the pilot-state tick loop, AFTER advanceMacro (so lastVix/lastDxy are
 *  fresh) and BEFORE the first computeSnapshot of the tick (so the snapshot
 *  reads the freshly-persisted smoothed weights).
 *
 *  P0-FIX-1 (chain-linking): the new smoothed weights are committed to the
 *    chain index via commitChainIndexWeights(). This updates G_t (the
 *    cumulative chain-link factor) and the prevWeights / prevPrices used by
 *    the next advanceIndex() call. The divisor D_t = B_t^- / B_t^+ ensures
 *    the rebalance creates ZERO artificial index return.
 *
 *  P0-FIX-3 + §8.4/§7.4 (velocity + stress-adaptive smoothing): the EMA
 *    smoothing now uses smoothWeightsAdaptive() with the canonical risk
 *    state's stress level and the target velocity (max component-wise |Δ|
 *    between the previous smoothed and the new constrained target). In
 *    stress states (STRESS/DEFENSIVE/EMERGENCY), the smoothing slows by 50%
 *    to avoid chasing volatile prices. Fast target jumps (|Δ| > 5%) are
 *    damped by up to 50% (whip-saw guard). */
export function advanceMase(s: ReserveState, fx: FxRates): void {
  const prices = buildPriceData(fx);
  const vols = estimateVolsFromState(s);
  const regime = detectRegime(
    s.lastVix > 0 ? s.lastVix : fx.VIX,
    s.lastDxy > 0 ? s.lastDxy : fx.DXY,
    vols.Gold,
  );
  const mase = maseEnsemble(vols, prices, null, regime);
  const constrained = applyEnvelopes(mase.target);
  const prevSmoothed = s.maseSmoothed ?? (STRATEGIC_PRIOR as WeightVector);
  // §8.4 + §7.4 — velocity + stress-adaptive smoothing.
  const velocity = targetVelocity(prevSmoothed, constrained);
  const sl = stressLevel(s.riskState.state);
  s.maseSmoothed = smoothWeightsAdaptive(prevSmoothed, constrained, SMOOTHING_LAMBDA, velocity, sl);
  s.maseLastAt = Date.now();
  // P0-FIX-1 — commit the new smoothed weights to the chain index. This
  // computes the divisor D_t = B_t^- / B_t^+ that preserves index continuity
  // (zero artificial return), updates G_t, and updates prevWeights +
  // prevPrices for the next advanceIndex() call. Wrapped in try/catch so a
  // chain-index commit failure doesn't break the tick loop.
  try {
    commitChainIndexWeights(s, fx, s.maseSmoothed);
  } catch (e) {
    if (typeof console !== "undefined") console.error("[mtq-engine] chain index commit error:", e);
  }
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
  // §14.1 — concentration optimizer re-splits the TOTAL PAXG/XAUT pool across
  // issuers; the index gold (locked) keeps its PAXG/XAUT split, so we re-derive
  // the reserve split as (total − index). This preserves the invariant
  // paxg = indexPaxg + reservePaxg (and same for xaut).
  syncReserveFromTotal(s);

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
      title: "VIX & DXY are now LIVE from Yahoo Finance (resolved)",
      severity: "fixed",
      description:
        "VIX is live from Yahoo Finance ^VIX (CBOE volatility index). DXY is live from Yahoo Finance DX-Y.NYB (the ICE US Dollar Index), with Frankfurter self-calc using the official geometric weighted formula as fallback. Both signals now use real market data, not simulation. All 8 macro signals (EUR/GBP/JPY/CNY/CHF/XAU/VIX/DXY) are live.",
      resolution: "VIX fetched live via query1/2.finance.yahoo.com/v8/finance/chart/^VIX. DXY fetched live via query1/2.finance.yahoo.com/v8/finance/chart/DX-Y.NYB. Fallback chain: Yahoo → Frankfurter self-calc (DXY only, official geometric formula) → seeded OU walk (last resort). liveCount=8/8 when all live sources succeed.",
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
