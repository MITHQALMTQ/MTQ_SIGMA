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
  MAX_DAILY_TURNOVER, MAX_POOL_FRACTION, DIRECTION_LOCK_HOURS,
  NO_TRADE_BAND_BASE, NO_TRADE_BAND_STRESS,
  MIN_MINT_MTQ, MIN_REDEEM_MTQ,
  LAMBDA_1, LAMBDA_2, LAMBDA_3, LAMBDA_4,
  BUFFER_SIZE, CORE_GOLD_WEIGHT, BUFFER_GOLD_BASE, BUFFER_GOLD_STRESS, BUFFER_GOLD_EMERGENCY, RAMP_DURATION_HOURS,
  EJECT_STAGES, PEG_BANDS, DEPEG_DETECTION_HOURS,
  EJECT_DEPEG_BAND_LOWER, EJECT_DEPEG_BAND_UPPER,
  EJECT_PAUSE_RULE_PCT,
  PRICE_EVENT_THRESHOLD,
  REINTEGRATION_WEIGHTS, REINTEGRATION_THRESHOLD, REINTEGRATION_REPURCHASE_STAGES, REINTEGRATION_STAGE_THRESHOLDS,
  TREASURY_SWEEP_THRESHOLD_USD, TREASURY_SWEEP_AUTHORITY,
  GOVERNANCE_LAYERS, PARAMETER_REGISTRY, type GovernanceLayerName,
  type ProtocolStatus,
  type FxRates,
  // === AUDIT-FIX imports (equation-by-equation audit) ===
  MIN_PROFITABILITY_USD,      // RG-10 unified ε gate
  REBALANCE_FEE_BPS,          // §20.4 0.20% rebalancing fee
  POOL_DEPTH_FALLBACK_USD,    // §11.4 pilot fallback pool depth
  DEFAULT_SLIPPAGE_TAU_USER,  // §19.4 τ_user
  CONCENTRATION_WARN_PCT, CONCENTRATION_LIMIT_PCT, CONCENTRATION_CRISIS_LIMIT_PCT, // §15.6.1/§15.6.2
} from "./blueprint";
import type { FxSnapshot } from "./fx";
import type { OracleBoard, OracleConsensus } from "./oracle";
import { computeConcentration, type AssetRecord, type ConcentrationReport } from "./registry";
import {
  maseEnsembleAdaptive,
  updateOosScores,
  evaluateMaseObjective,
  MASE_OBJECTIVE_VERSION,
  type OosScoreState,
  applyEnvelopes,
  smoothWeights,
  smoothWeightsAdaptive,
  smoothWeightsConstitutional,
  targetVelocity,
  COMPONENTS,
  type PriceData,
  type VolatilityData,
  type MarketRegime,
  type WeightVector,
  type Component,
} from "./mase";
import {
  marpDecision,
  MARP_EXECUTE_LEVEL,
  type MarpDecision,
  // === Task 8-b: canonical events (§11.7/§12.9/§15.7), §12.3.3 tolerances,
  // §12.7 cost model, §11.6/§14.5 crisis set, §15.6.1 pre-trade helpers ===
  emitEngineEvent,
  replayGenesisRegistryEvents,
  canonicalSkipReasonForLevel,
  assetClassFor,
  slippageToleranceFor,
  GAS_COST_MODEL,
  estimateExecutionCost,
  CRISIS_EXECUTION_SET,
  issuerSharesFrom,
  issuerAcquisitionBlocked,
  routeStablecoinAcquisition,
  routeGoldAcquisition,
  type CanonicalSkipReason,
  type EngineEventRecord,
} from "./marp";
import {
  initChainIndex,
  advanceIndex,
  commitWeights,
  getMTQPrice,
  fxToPriceVector,
  strategicPriorToWeights,
  baseFixingsToPrices,
  computeAttribution,
  DIVISOR_BASIS,
  type ChainIndexState,
  type ChainLinkRecord,
  type DivisorBasis,
  type IndexAttribution,
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
  // AUDIT-FIX F-9 / §21.5.3 — the price at which the CURRENT eject stage was
  // entered, for the 5% pause rule: "pause next stage if price drops >5% from
  // stage start" (EJECT_PAUSE_RULE_PCT). Initialized to 1.0 (perfect peg).
  ejectStageStartPrice: { USD: number; EUR: number; GBP: number; JPY: number; CNY: number };

  // §11.3 Reintegration: per-currency reintegration score + repurchase stage
  reintegration: {
    [c in "USD" | "EUR" | "GBP" | "JPY" | "CNY"]: {
      timeInBand48h: number;  // fraction of last 48h inside [0.98,1.02]
      liquidityDepth: number; // normalised 0..1 (vs $1M threshold)
      oracleAgreement: number; // 0..1 (valid feeds / 3)
      volatility: number;    // 0..1 (higher = worse)
      score: number;         // R_score
      repurchaseStage: number; // 0=none, 1=25%, 2=50%, 3=100%
      // AUDIT-FIX F-9 / §21.5.4 — reverse-ladder sustained-hours accumulator
      // (SIMULATED hours, same clock as depegHours): hours the score has been
      // continuously ≥ the CURRENT rung's threshold (0.80/0.85/0.90 for
      // stages 1/2/3 per REINTEGRATION_STAGE_THRESHOLDS). Reset when the score
      // falls below the threshold.
      sustainedHours: number;
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
    // v2.0 §16.4/Listing 8 — Core-Gold EXHAUSTION CERTIFICATE: layer-5
    // (core gold) consumption is gated behind a 4/7 Multi-Sig approval.
    // `pendingCoreGoldUsd` carries the unabsorbed loss that reached layer 5
    // while no certificate is approved; `exhaustionCertificateApproved` is a
    // pilot SIMULATION switch (true only inside an explicitly governance-
    // approved stress scenario — never set by the live tick loop).
    // OPTIONAL: persisted pilot states created before v2.0 lack these fields —
    // every consumer guards with `?? 0` / `?? false`.
    pendingCoreGoldUsd?: number;
    exhaustionCertificateApproved?: boolean;
    exhaustionCertificateRequiredSince?: number; // epoch ms of first blocked consumption
  };

  // v2.0 §16.3 — buffer RECOVERY hysteresis: upgrades require sustained
  // evidence (RR ≥ threshold for 24/48 CONSECUTIVE hours — clock resets to
  // zero the moment RR falls below it). 0/undefined = clock idle.
  bufferRecoverySinceAt?: number;

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

  // === v5.x OD-31 / Blueprint §7.6 — adaptive ensemble OOS scoring state ====
  // Walk-forward, leakage-controlled: each tick stores every candidate
  // model's weight vector BEFORE the next tick's returns materialize, then
  // scores each model's previous proposal against the realized component
  // returns (EWMA). Softmax α_m = e^(−η·Score_m)/Σ_k e^(−η·Score_k) then
  // weights the six §7.5 families. Null at genesis → uniform cold-start α.
  maseOos: OosScoreState | null;

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

  // === B9-FIX — conservation-of-value deficit ledger (USD) ===
  // Every reserve mutation that would push a holding below 0 used to silently
  // floor it to 0 via `Math.max(0, holding - amount)`. That made the deficit
  // disappear, breaking conservation of value and creating phantom surplus.
  // The deficit is now recorded here (in USD, native-unit deficit × spot FX
  // or gold price) so the books stay closed: assets + deficitUsd = liabilities.
  //
  // Two paths write to this ledger:
  //   - applyRebalanceTrade / applyMarpRebalance: subtractReserve() clamps the
  //     holding to 0 AND adds the USD-equivalent deficit here (so the trade
  //     still "executes" but the loss is auditable instead of silent).
  //   - applyRedeem pre-check: when a redeem would push any holding below 0,
  //     the redeem is REJECTED (ok:false) AND the would-be deficit is recorded
  //     here for audit. The redeem never mutates state in this case.
  //
  // This field is additive-only across the lifetime of an engine instance and
  // is reset to 0 only by initReserveState().
  deficitUsd: number;

  // === WIRING-1 — §11.5 Stability Pool (T3 first-loss for EMERGENCY deficit) ===
  // The V3 contract's `useStabilityPoolForDeficit(deficitUsd)` is the SOLE
  // recovery path out of EMERGENCY (RR < 1.00). When the protocol is in
  // EMERGENCY and the stability pool has funds, the keeper calls the V3
  // function to cover the deficit up to min(deficit, totalStabilityPool).
  // The covered amount is removed from `totalStabilityPoolUsd` and recorded
  // additively in `stabilityPoolUsedUsd` for audit. In the pilot (V3 contract
  // not deployed), the tick loop simulates this accounting in-process so the
  // state machine can exit EMERGENCY without a real on-chain call.
  //
  // Seeded to $50,000 at genesis (pilot-only — represents authorized bank
  // deposits into the V3 stability pool). When the V3 contract is deployed
  // and the keeper is wired, this field should be initialized from the V3
  // contract's `totalStabilityPool()` view instead.
  totalStabilityPoolUsd: number;
  stabilityPoolUsedUsd: number;

  // === AUDIT-FIX (§10.7 / Appendix C.3) — natural-flow ledger CF_{i,t} ========
  // Signed net natural flow INTO each component (USD) since the last rebalance
  // of that component: mint deposits deliver the basket at live weights (+),
  // redemptions draw proportional legs (−). MARP Level 1 nets this against the
  // target gap BEFORE any market trade (TradeNeeded_i = TargetGap_i − CF_{i,t});
  // the flow entries reset for a component when a rebalance trade executes on
  // it. "Every natural-flow netting decision is recorded with its components,
  // so an auditor can verify that CF_{i,t} was measured, not assumed." (§10.7)
  naturalFlowUsd: { USD: number; EUR: number; JPY: number; GBP: number; CNY: number; CHF: number; Gold: number };

  // === AUDIT-FIX (§9.5 cost effect / §20.4) — realized execution-friction ====
  // ledger for the current attribution window: rebalancing fees (0.20% §20.4),
  // estimated slippage (0.1% §11.4) and gas ($50 §11.8) charged by executed
  // rebalance trades. advanceChainIndex folds this into the period's §9.5
  // attribution (costEffectUsd) and resets the window.
  execCostLedger: { feesUsd: number; slippageUsd: number; gasUsd: number };

  // === AUDIT-FIX (EQ-072..075 / §9.4–9.5) — last index attribution ===========
  // The §9.4 per-component contributions + §9.5 effect decomposition for the
  // most recent advanceIndex step (movement / allocation / rebalancing / cost
  // effects). Published on every snapshot; the UI chart consumes REAL data
  // from here instead of synthetic series.
  lastAttribution: IndexAttribution | null;

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
    // AUDIT-FIX F-9 — 5% pause rule: stage-entry prices start at perfect peg.
    ejectStageStartPrice: { USD: 1, EUR: 1, GBP: 1, JPY: 1, CNY: 1 },
    reintegration: {
      USD: { timeInBand48h: 1, liquidityDepth: 1, oracleAgreement: 1, volatility: 0.02, score: 0, repurchaseStage: 0, sustainedHours: 0 },
      EUR: { timeInBand48h: 1, liquidityDepth: 1, oracleAgreement: 1, volatility: 0.02, score: 0, repurchaseStage: 0, sustainedHours: 0 },
      GBP: { timeInBand48h: 1, liquidityDepth: 0.5, oracleAgreement: 0.66, volatility: 0.05, score: 0, repurchaseStage: 0, sustainedHours: 0 },
      JPY: { timeInBand48h: 1, liquidityDepth: 0.5, oracleAgreement: 0.66, volatility: 0.05, score: 0, repurchaseStage: 0, sustainedHours: 0 },
      CNY: { timeInBand48h: 1, liquidityDepth: 0.4, oracleAgreement: 0.66, volatility: 0.08, score: 0, repurchaseStage: 0, sustainedHours: 0 },
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
      // v2.0 §16.4/Listing 8 — Exhaustion Certificate zero-init (Listing 8:
      // "certificate zero-init"): no core-gold consumption approved, nothing
      // pending, no requirement in force.
      pendingCoreGoldUsd: 0,
      exhaustionCertificateApproved: false,
      exhaustionCertificateRequiredSince: 0,
    },
    // v2.0 §16.3 — buffer recovery hysteresis clock: idle at genesis.
    bufferRecoverySinceAt: 0,
    priceEvents: [],
    lastLoggedPrice: 1.0,
    lastVix: 18.5,
    lastDxy: 104.2,
    // v1.0 MASE — null until first advanceMase() call; STRATEGIC_PRIOR used as fallback.
    maseSmoothed: null,
    maseLastAt: 0,
    // v5.x OD-31 / §7.6 — no OOS evidence at genesis → uniform cold-start α.
    maseOos: null,
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
    // === B9-FIX — conservation-of-value deficit ledger starts at 0 at genesis.
    deficitUsd: 0,
    // === WIRING-1 — §11.5 Stability Pool seeded at $50,000 for the pilot ===
    // (represents authorized bank deposits into the V3 stability pool — when
    // the V3 contract is deployed this should be initialized from the V3
    // contract's `totalStabilityPool()` view instead of this hardcoded seed).
    totalStabilityPoolUsd: 50_000,
    stabilityPoolUsedUsd: 0,
    // AUDIT-FIX §10.7 — natural-flow ledger starts at zero (measured, never assumed).
    naturalFlowUsd: { USD: 0, EUR: 0, JPY: 0, GBP: 0, CNY: 0, CHF: 0, Gold: 0 },
    // AUDIT-FIX §9.5/§20.4 — execution-friction ledger starts empty.
    execCostLedger: { feesUsd: 0, slippageUsd: 0, gasUsd: 0 },
    // AUDIT-FIX EQ-072..075 — no attribution until the first advanceIndex step.
    lastAttribution: null,
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
//
// AUDIT-FIX EQ-072..075 (§9.4–9.5): each step also computes the attribution
// decomposition — per-component contributions (W_{i,t-1} × (P_i,t/P_i,t-1 − 1),
// summing EXACTLY to the period return) plus the §9.5 effect separation
// (movement / allocation / rebalancing-by-divisor-zero / cost from the
// realized execution-friction ledger) — and stores it on s.lastAttribution
// for publication on every snapshot.
export function advanceChainIndex(s: ReserveState, fx: FxRates): void {
  const prices = fxToPriceVector(fx);
  // §9.5 attribution for the period [prevPrices → current prices], with the
  // realized execution friction of the elapsed window as the cost effect.
  try {
    const cost = s.execCostLedger.feesUsd + s.execCostLedger.slippageUsd + s.execCostLedger.gasUsd;
    s.lastAttribution = computeAttribution(s.chainIndex, prices, {
      costEffectUsd: cost,
      priorWeights: strategicPriorToWeights(STRATEGIC_PRIOR),
    });
    // Reset the friction window — the next period starts with a clean ledger.
    s.execCostLedger = { feesUsd: 0, slippageUsd: 0, gasUsd: 0 };
  } catch {
    // attribution is observability — never block the index advance
  }
  const result = advanceIndex(s.chainIndex, prices);
  s.chainIndex = result.state;
}

// Commit the MASE smoothed weights to the chain index (called from
// advanceMase after the new smoothed weights are computed). Computes the
// divisor D_t = B_t^- / B_t^+ that preserves index continuity (zero
// artificial return), updates G_t, and updates prevWeights + prevPrices to
// the new weights and the current FX prices. MUTATES `s.chainIndex`.
//
// v2.0 §9.3 / COO-17 (Listing 3 §9.8 + MTQSigmaV3.sol commitWeights
// L1384–1407): B^± are BASE-RELATIVE aggregates — Σ W × (P_{i,t}/P_{i,0})
// against the immutable genesis fixings — NOT raw-USD values (the superseded
// pre-v2.0 TS basis, disclosed in honest-status D-chainlink-divisor; the
// switch changes the published G_t series, never the level I_t). Every
// applied D_t is recorded on the bounded per-update ledger
// (chainIndex.divisorHistory — the ChainLinkAdjusted-equivalent publication)
// and D_t is RECORDED-NOT-APPLIED to I_t.
export function commitChainIndexWeights(
  s: ReserveState,
  fx: FxRates,
  newWeights: WeightVector,
): {
  divisor: number;
  newG: number;
  /** B_t^- = Σ W_{i,t-1} × (P_{i,t}/P_{i,0}) — base-relative (§9.3) */
  bMinus: number;
  /** B_t^+ = Σ W_{i,t} × (P_{i,t}/P_{i,0}) — base-relative (§9.3) */
  bPlus: number;
  /** true when any weight actually changed (Listing 3 `changed` flag) */
  changed: boolean;
  /** the published per-update D_t/B^± record (null on no-op commits) */
  record: ChainLinkRecord | null;
} {
  const weightsArr = COMPONENTS.map((c) => newWeights[c] ?? 0);
  const pricesArr = fxToPriceVector(fx);
  // COO-17 heal: chain-index states created before the base-relative basis
  // pinning (stale in-memory stores across HMR) carry no P_{i,0} anchor and
  // no divisor ledger. Backfill the immutable genesis fixings + the ledger
  // ONCE so every subsequent D_t record is exact under the pinned basis.
  // Fresh stores get these from initChainIndex directly.
  //
  // Carry-forward bookkeeping (pilot-only, disclosed): a pre-pinning state's
  // accumulated G_t was computed under the SUPERSEDED raw-USD basis and has NO
  // per-update records (the superseded implementation kept none). It is
  // carried as ONE labeled record (kind "carry-forward", basis "raw-usd",
  // B^± = null) — never silently dropped, never silently re-based. The
  // cumulative G_t then remains reproducible from the ledger (Π D = G_t).
  if (
    !s.chainIndex.basePrices ||
    !s.chainIndex.divisorHistory ||
    !s.chainIndex.divisorBasis ||
    s.chainIndex.divisorCommitCount == null
  ) {
    const carriedG = s.chainIndex.G_t;
    const hasCarriedHistory = Math.abs(carriedG - 1) > 1e-15;
    const carriedRecord: ChainLinkRecord | null = hasCarriedHistory
      ? {
          at: Date.now(),
          D: carriedG,
          bMinus: null,
          bPlus: null,
          basis: "raw-usd", // the pre-switch era WAS raw-USD — honest per-record label
          kind: "carry-forward",
        }
      : null;
    s.chainIndex = {
      ...s.chainIndex,
      basePrices: s.chainIndex.basePrices ?? baseFixingsToPrices(BASE_FIXINGS),
      divisorHistory:
        s.chainIndex.divisorHistory ??
        (carriedRecord ? [carriedRecord] : []),
      divisorCommitCount:
        s.chainIndex.divisorCommitCount ?? (carriedRecord ? 1 : 0),
      divisorBasis: s.chainIndex.divisorBasis ?? DIVISOR_BASIS,
    };
  }
  const r = commitWeights(s.chainIndex, weightsArr, pricesArr, Date.now());
  s.chainIndex = r.state;
  return {
    divisor: r.divisor,
    newG: r.newG,
    bMinus: r.bMinus,
    bPlus: r.bPlus,
    changed: r.changed,
    record: r.record,
  };
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
  // v2.0 §13.4.1 — IMMEDIATELY LIQUID class for the LCR numerator:
  // stablecoins only (USDC + USDP + USDT + EURC), net of haircuts.
  // Gold counts 0% (weekend closures / DEX liquidity evaporation); GBP/JPY/
  // CNY/CHF instruments are WATCH/TBD in the Asset Admission Registry —
  // not yet admitted to the 24h-settled liquid class, so they do NOT count
  // until governance admits them (Ch.15 admission, not a reinterpretation).
  const stablecoinNet = usdNet + eurNet;

  // Per-issuer breakdown (for concentration visualization)
  const usdcUsd = s.usdc * 1.0 * (1 - HAIRCUTS.USD);
  const usdpUsd = s.usdp * 1.0 * (1 - HAIRCUTS.USD);
  const usdtUsd = s.usdt * 1.0 * (1 - HAIRCUTS.USD);
  const paxgUsd = s.paxg * goldPrice * (1 - HAIRCUTS.PAXG);
  const xautUsd = s.xaut * goldPrice * (1 - HAIRCUTS.XAUT);

  // §14.1 — index vs reserve gold split (USD net of haircut).
  // Index gold is locked (backs the 26% Strategic Prior Gold weight); reserve
  // gold is the buffer MARP rebalances. The total gold (= index + reserve) is
  // what serves the index weight for MASE/MARP observed-weight purposes.
  const indexPaxgUsd = s.indexPaxg * goldPrice * (1 - HAIRCUTS.PAXG);
  const indexXautUsd = s.indexXaut * goldPrice * (1 - HAIRCUTS.XAUT);
  const reservePaxgUsd = (s.reservePaxg >= 0 ? s.reservePaxg : Math.max(0, s.paxg - s.indexPaxg)) * goldPrice * (1 - HAIRCUTS.PAXG);
  const reserveXautUsd = (s.reserveXaut >= 0 ? s.reserveXaut : Math.max(0, s.xaut - s.indexXaut)) * goldPrice * (1 - HAIRCUTS.XAUT);
  const indexGoldNet = indexPaxgUsd + indexXautUsd;
  const reserveGoldNet = reservePaxgUsd + reserveXautUsd;

  return {
    usdGross, eurGross, gbpGross, jpyGross, cnyGross, chfGross, fiatGross,
    goldGross, goldPrice,
    usdNet, eurNet, gbpNet, jpyNet, cnyNet, chfNet, goldNet,
    nav, fiatNet, stablecoinNet,
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

export function computeLcr(s: ReserveState, vals: { stablecoinNet?: number; fiatNet: number }, price: number): number {
  // v2.0 §13.4.1/§13.4.3 — LiquidityCoverage = LIQ_t / NTO_t where LIQ_t is
  // the STABLECOIN-ONLY net value (the admitted 24h-settled liquid class).
  // The former numerator (all fiat incl. GBP/JPY/CNY/CHF whose instruments
  // are WATCH/TBD) overstated worst-case 24h convertibility.
  const liquidAssets = vals.stablecoinNet ?? vals.fiatNet; // stablecoins 100%; gold 0%
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
  // ε = 1e-9 — numerical-stability guard only (PILOT constant, RG-15 label;
  // not a blueprint parameter). Feeds the legacy θ path, not MASE.
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
//
// AUDIT-FIX RG-11 / EQ-111 (P1-4 — legacy retirement): this LEGACY v1.2
// buffer formula (0.20 + 0.10×B_gold, clamp 22–30%) is NO LONGER the default
// execution target. With MARP execution active, the gold target comes from
// the MASE envelope output (20–32%) via executionTargetGoldWeight() below.
// This function is retained for the pre-MASE genesis fallback and for the
// A/B advisory display — clearly quarantined as HISTORICAL (fixed-quantity
// core-plus-buffer lineage), never the live adaptive target.
export function computeTargetGoldWeight(s: ReserveState, rr: number): number {
  const bufferBase = currentBufferGoldRatio(s); // ∈ {0.625, ~0.85, 1.0} with ramp
  const baseFromBuffer = CORE_GOLD_WEIGHT + BUFFER_SIZE * bufferBase; // 0.20 + 0.10*b
  const target = baseFromBuffer + s.smoothedGoldWeight - BASE_GOLD_WEIGHT; // apply θ = smoothed - base
  return clamp(target, GOLD_WEIGHT_LOWER, GOLD_WEIGHT_UPPER);
}

// AUDIT-FIX RG-11 / EQ-015 (P1-4): the ACTIVE execution-path gold target is
// the MASE envelope output — the smoothed, envelope-constrained (20–32%),
// velocity-capped adaptive weight committed to the chain index. The legacy
// buffer formula above is the fallback ONLY before MASE has ever run (pure
// genesis state), mirroring §3.4's genesis snapshot = Strategic Prior.
export function executionTargetGoldWeight(s: ReserveState, rr: number): number {
  if (s.maseSmoothed) {
    // MASE output is already envelope-projected (§8.1, 20–32% for Gold) and
    // velocity-capped (§8.3). Clamp defensively to the constitutional
    // envelope bounds — never the legacy 22–30% buffer band.
    const env = ADMISSIBILITY_ENVELOPES.Gold;
    return clamp(s.maseSmoothed.Gold, env.lower, env.upper);
  }
  // Pre-MASE genesis fallback: the legacy buffer formula (documented above).
  return computeTargetGoldWeight(s, rr);
}

/** Which source drives the live execution gold target — surfaced on the
 *  snapshot and in honest-status disclosures (audit P0-3). */
export function executionTargetSource(s: ReserveState): "mase-envelope" | "legacy-buffer" {
  return s.maseSmoothed ? "mase-envelope" : "legacy-buffer";
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
    const previousTurnover = s.dailyTurnoverUsd;
    s.dailyTurnoverUsd = 0;
    s.lastTurnoverResetAt = Date.now();
    // §11.7/§11.5.2 — DailyTurnoverReset(timestamp, previousTurnover): "The
    // cap binds on the sum of executed trade values per UTC day, tracked
    // on-chain by the dailyTurnover counter of Listing 4 and reset at
    // rolver with a DailyTurnoverReset event." Engine-internal shadow record
    // (this app runs in shadow mode — audit-log record, not an on-chain event).
    emitEngineEvent(
      "DailyTurnoverReset",
      { previousTurnover: Math.round(previousTurnover * 100) / 100 },
      { source: "turnover", blueprint: "§11.7/§11.5.2 — daily rollover" },
    );
  }
}

export function evaluateRebalance(
  s: ReserveState,
  vals: { nav: number; goldNet: number; fiatNet: number },
  rr: number,
  opts?: { poolDepth24hUsd?: number },
): RebalanceDecision {
  const nav = vals.nav;
  if (nav <= 0) {
    return { shouldRebalance: false, direction: 0, observedGoldWeight: 0, targetGoldWeight: 0, deviation: 0, tradeUsd: 0, reason: "NAV ≤ 0" };
  }
  const observed = vals.goldNet / nav;
  // AUDIT-FIX RG-11/P1-4: the ACTIVE execution target is the MASE envelope
  // output (20–32%) once MASE has run; the legacy buffer formula is the
  // pre-MASE genesis fallback only (see executionTargetGoldWeight).
  const target = executionTargetGoldWeight(s, rr);
  const deviation = observed - target;

  // §10.4/§11.8 — no-trade zone: θ_base = 0.75% (Listing 4 noTradeBand);
  // widened to 1.5% under stress/crisis (§11.6 — "Listing 4 doubles the base
  // band when the crisis oracle exceeds its threshold"; the pilot selects the
  // widened band on the RR < 1.05 stress-mode condition, the same mechanical
  // trigger as the direction-lock override of §11.5.3).
  const band = rr < RR_STRESS ? NO_TRADE_BAND_STRESS : NO_TRADE_BAND_BASE;
  if (Math.abs(deviation) <= band) {
    return { shouldRebalance: false, direction: 0, observedGoldWeight: observed, targetGoldWeight: target, deviation, tradeUsd: 0, reason: `Within no-trade zone (≤${(band * 100).toFixed(2)}% §10.4/§11.8)` };
  }

  // Direction lock (overridden in stress)
  const inStress = rr < RR_STRESS;
  if (!inStress && Date.now() - s.lastTradeAt < DIRECTION_LOCK_HOURS * 3_600_000) {
    if ((deviation > 0 && s.lastTradeDir === -1) || (deviation < 0 && s.lastTradeDir === 1)) {
      return { shouldRebalance: false, direction: 0, observedGoldWeight: observed, targetGoldWeight: target, deviation, tradeUsd: 0, reason: "Direction lock (24h same-direction guard §11.5.3)" };
    }
  }

  // Trade sizing
  const surplusUsd = Math.abs(deviation) * nav;
  // AUDIT-FIX P1-4 (EQ-093): the 24h pool depth is FEED-DRIVEN (PAXG 24h
  // volume via the FX snapshot) with the labeled $4M POOL_DEPTH_FALLBACK_USD
  // used only in degraded mode — no longer a silent hard-code.
  const poolDepth24h = opts?.poolDepth24hUsd ?? POOL_DEPTH_FALLBACK_USD;
  const maxByPool = MAX_POOL_FRACTION * poolDepth24h;
  let tradeUsd = Math.min(surplusUsd, maxByPool);
  maybeResetDailyTurnover(s);
  const remainingDaily = MAX_DAILY_TURNOVER * nav - s.dailyTurnoverUsd;
  if (tradeUsd > remainingDaily) tradeUsd = Math.max(0, remainingDaily);

  // §12.7 cost model (Task 8-b — exact v2.0 cost assembly, replacing the former
  // "0.1% slippage + flat $50 gas" estimate): EstimatedCost =
  //   (gasPrice × 1.2) × (gasUnits × 1.1)  [recorded accounting-cost estimate —
  //                                        GAS_FALLBACK $50 DISABLED per
  //                                        Appendix F: never a gas price]
  //   + tradeValue × (τ/2)                  [half-τ slippage; τ = §12.3.3 gold 1.0%]
  //   + tradeValue × 0.001                 [0.1% router fee]
  //   + tradeValue × 0.0020                [§20.4 rebalancing fee — §10.8 Fees_i
  //                                        includes "protocol fees on the leg"]
  const goldLegCost = estimateExecutionCost(tradeUsd, "GOLD");
  const estCost = goldLegCost.totalUsd;
  const benefit = Math.abs(deviation) * nav * LAMBDA_1 + (rr < RR_TARGET ? (1 / Math.max(rr, 0.5)) * nav * LAMBDA_3 : 0);
  const netBenefit = benefit - estCost;
  const direction = deviation > 0 ? -1 : 1; // excess gold → sell; deficit → buy

  // AUDIT-FIX RG-10 (P0-2 — unified ε rule): the ACTIVE path now uses the SAME
  // normative profitability gate as MARP — NetBenefit > ε = $10 absolute
  // (Listing 5 §12.8) — instead of the former bare benefit > cost (> 0) form.
  // One rule, one ε, fixed units, every route.
  if (netBenefit <= MIN_PROFITABILITY_USD) {
    return { shouldRebalance: false, direction: 0, observedGoldWeight: observed, targetGoldWeight: target, deviation, tradeUsd: 0, reason: `Net benefit not positive (§10.8/§12.8): cost ${estCost.toFixed(0)} + ε ($${MIN_PROFITABILITY_USD}) ≥ benefit ${benefit.toFixed(0)} — net $${netBenefit.toFixed(0)} (§12.7 cost: gas ${goldLegCost.gasUsd.toFixed(2)} + slip τ/2 ${(goldLegCost.halfTau * 100).toFixed(2)}% + router 0.10% + protocol 0.20% §20.4)` };
  }
  return { shouldRebalance: true, direction, observedGoldWeight: observed, targetGoldWeight: target, deviation, tradeUsd, reason: `Benefit − cost > ε ($${MIN_PROFITABILITY_USD}); executing (§12.8 unified gate; §12.7 cost ${estCost.toFixed(0)})` };
}

// --- B9-FIX — conservation-of-value subtraction helper -----------------------
// Replaces `Math.max(0, holding - amount)` on every reserve mutation path.
// When the subtraction would push the holding below 0, the deficit (in native
// units) is converted to USD via `usdPerUnit` and accumulated into
// `s.deficitUsd`. The holding is then clamped to 0 (the trade still executes)
// — but the deficit is now visible on the books instead of silently
// disappearing. This preserves the conservation invariant
//   assets + deficitUsd = liabilities + injectedValue
// across every rebalance/marp trade.
//
// `usdPerUnit` is the spot USD value of one native unit:
//   - USD stablecoins (USDC/USDP/USDT): 1
//   - EURC: fx.EUR_USD · JPY: fx.JPY_USD · GBP: fx.GBP_USD
//   - CNY: fx.CNY_USD · CHF: fx.CHF_USD
//   - PAXG/XAUT: goldPrice (XAU_USD)
//
// `component` is a human-readable label for the warn log (e.g. "paxg", "usdc").
function subtractReserve(
  s: ReserveState,
  current: number,
  amount: number,
  usdPerUnit: number,
  component: string,
): number {
  const newValue = current - amount;
  if (newValue < 0) {
    const deficitNative = -newValue;
    const deficitUsd = deficitNative * usdPerUnit;
    console.warn('[engine] B9: negative holding detected', {
      component,
      old: current,
      subtracted: amount,
      deficitNative,
      deficitUsd,
      cumulativeDeficitUsd: (s.deficitUsd ?? 0) + deficitUsd,
    });
    s.deficitUsd = (s.deficitUsd ?? 0) + deficitUsd;
    return 0;
  }
  return newValue;
}

// AUDIT-FIX §20.4 — charge the 0.20% rebalancing fee on an executed trade and
// record the execution friction in the §9.5 cost-effect ledger. "Fees are
// deducted before the ... rebalance is executed ... excluded from NAV ... each
// deduction emits FeeAccrued" — the hot wallet is the Operational Wallet.
// Task 8-b §12.7: the ledger's slippage line now books the HALF-τ estimate
// (tradeValue × τ_class/2 per §12.3.3/§12.7) and the gas line books the
// §12.7-buffered recorded accounting-cost estimate (Appendix-F P0-3; the flat
// $50 legacy value is withdrawn as a cost term — GAS_FALLBACK DISABLED).
function chargeRebalanceFee(s: ReserveState, tradeUsd: number, assetClass: "STABLECOIN" | "GOLD" | "MINOR_FX" = "GOLD"): number {
  const fee = tradeUsd * (REBALANCE_FEE_BPS / 10_000);
  s.treasury.hotWalletUsd += fee; // Operational Wallet — excluded from NAV
  s.execCostLedger.feesUsd += fee;          // §9.5 cost effect
  s.execCostLedger.slippageUsd += tradeUsd * slippageToleranceFor(assetClass) / 2; // §12.7 half-τ slippage
  s.execCostLedger.gasUsd += GAS_COST_MODEL.perTradeUsd; // §12.7 buffered accounting estimate (Appendix-F P0-3)
  if (typeof console !== "undefined") {
    console.log(`[mtq-engine] FeeAccrued: rebalancing fee ${(fee).toFixed(2)} USD (0.20% §20.4) → Operational Wallet`);
  }
  return fee;
}

// Apply a rebalance trade in USD terms (mutates state).
export function applyRebalanceTrade(s: ReserveState, decision: RebalanceDecision, goldPrice: number): void {
  if (!decision.shouldRebalance) return;
  const usd = decision.tradeUsd;
  // §20.4 — deduct the rebalancing fee BEFORE execution; the swap settles on
  // the net notional (sell: proceeds reduced; buy: gold bought with net).
  const fee = chargeRebalanceFee(s, usd, "GOLD");
  if (decision.direction === -1) {
    // sell gold → buy USDC (simplified: convert to USDC)
    const goldUnits = usd / goldPrice;
    // B9-FIX: track any deficit instead of silently zeroing.
    s.paxg = subtractReserve(s, s.paxg, goldUnits, goldPrice, 'paxg');
    // §14.1 — the sold gold comes from the RESERVE buffer (index gold is locked).
    // Maintain the invariant paxg = indexPaxg + reservePaxg.
    s.reservePaxg = subtractReserve(s, s.reservePaxg, goldUnits, goldPrice, 'reservePaxg');
    s.usdc += usd - fee; // net proceeds after the §20.4 fee
    // §11.7/§12.9 — GoldSold(amount, output, execPrice) on the gold leg fill.
    emitEngineEvent("GoldSold", { amount: goldUnits, output: usd - fee, execPrice: goldPrice }, { source: "execution", blueprint: "§11.7/§12.9 — legacy §7 gold sell fill (shadow record)" });
  } else {
    // buy gold → spend USDC
    const netUsd = usd - fee;
    // B9-FIX: track any deficit instead of silently zeroing.
    s.usdc = subtractReserve(s, s.usdc, usd, 1, 'usdc');
    const goldUnits = netUsd / goldPrice;
    s.paxg += goldUnits;
    // §14.1 — the bought gold goes to the RESERVE buffer (index gold is locked).
    s.reservePaxg += goldUnits;
    emitEngineEvent("GoldBought", { amount: goldUnits, output: usd, execPrice: goldPrice }, { source: "execution", blueprint: "§11.7/§12.9 — legacy §7 gold buy fill (shadow record)" });
  }
  // §11.7 — RebalanceExecuted(timestamp, deviation, amount, estimatedCost).
  emitEngineEvent(
    "RebalanceExecuted",
    {
      component: "Gold",
      deviation: decision.deviation,
      amount: Math.round(usd * 100) / 100,
      estimatedCost: Math.round(estimateExecutionCost(usd, "GOLD").totalUsd * 100) / 100,
      path: "legacy-§7",
    },
    { source: "execution", blueprint: "§11.7 — legacy §7 path (shadow record)" },
  );
  s.lastTradeDir = decision.direction;
  s.lastTradeAt = Date.now();
  s.dailyTurnoverUsd += usd;
  // AUDIT-FIX §10.7 — the gold/USD natural-flow ledger entries were available
  // for netting this round; a market trade on those components resets them.
  s.naturalFlowUsd.Gold = 0;
  s.naturalFlowUsd.USD = 0;
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
//     routed across USDC/USDP/USDT under the §15.6.1 pre-trade discipline
//     (Task 8-b: over-checkpoint issuers receive NOTHING; the acquisition is
//     water-filled so receiving issuers equalize — accumulation toward an
//     issuer already above the 25% soft checkpoint is blocked). A "buy" of
//     component X converts USD → X (single-issuer components are checked
//     against the §15.6.1 caps; TBD-issuer instruments carry no mapped-issuer
//     exposure — registry attribution gap, disclosed).
//   - For USD: each trade pairs with Gold (the other deep pool). A "sell" of
//     USD converts USD → Gold (PAXG/XAUT water-filled per §15.6.1). A "buy"
//     of USD converts Gold → USD (adaptive stablecoin routing).
//   - For Gold: a "sell" reduces reservePaxg + reserveXaut; a "buy" increases
//     them under §15.6.1 routing. Index gold is never touched.
//
// Constraints enforced (§10/§11/§12/§13/§15):
//   - §13.4.3 LCR floor (1.00): on breach, an obligation-driven liquid-repair
//     trade (sell RESERVE gold → stablecoins) executes FIRST, and ordinary
//     trades that would move value OUT of the stablecoin class are held with
//     the canonical 'LCR repair priority' reason (re-routing).
//   - §11.4 pool cap (MAX_POOL_FRACTION × 24h depth; crisis ×0.5 per §11.6).
//   - §11.5.2 MAX_DAILY_TURNOVER (5% of NAV) — trades breaching it are skipped.
//   - §11.5.3 DIRECTION_LOCK_HOURS (24h SAME-DIRECTION guard; reversals
//     allowed; RR<1.05 stress override).
//   - §15.6.1 pre-trade issuer concentration (25% warn / 30% hard block /
//     35% crisis exception in EMERGENCY) — enforced BEFORE execution.
//   - §11.7 canonical events emitted for every executed/declined decision
//     (engine-internal shadow records — this app runs in shadow mode).
//   - Only decisions with shouldTrade=true AND level>=MARP_EXECUTE_LEVEL are
//     executed (levels 1–7 are advisory).
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
  /** Optional §11.7 payload pass-through: the pre-trade deviation (weight
   *  fraction) and the decision's own reason string, when the caller maps
   *  them from the full MarpDecision (pilot-state currently trims them — the
   *  emitted records then carry deviation:null, disclosed). */
  deviation?: number;
  reason?: string;
}

export interface MarpExecTrace {
  component: string;
  direction: string;
  tradeUsd: number;
  level: number;
  applied: boolean;
  skipReason?: string;
  /** §11.7 canonical machine-readable skip reason (Task 8-b). */
  canonicalSkipReason?: CanonicalSkipReason;
  /** §13.4.3 — this trace row is the LCR liquid-repair trade. */
  lcrRepair?: boolean;
}

export interface MarpExecResult {
  appliedCount: number;
  skippedCount: number;
  totalTradeUsd: number;
  path: 'legacy' | 'marp';
  // Per-decision trace: which were applied vs skipped (and why).
  traces: MarpExecTrace[];
  // === Task 8-b additions ====================================================
  /** §11.7/§12.9 canonical event records emitted by THIS execution pass
   *  (engine-internal shadow records; also retained in the marp.ts ring
   *  buffer and printed to the decision log for state-changing events). */
  events: EngineEventRecord[];
  /** §13.4.3 LCR-breach status + the liquid-repair trade actually executed
   *  (null when LCR ≥ the 1.00 constitutional floor). */
  lcrRepair: {
    lcr: number;
    shortfallUsd: number;
    tradeUsd: number;
    blockedBy: CanonicalSkipReason | null;
    posture: string;
  } | null;
  /** §15.6.1 pre-trade concentration enforcement findings (truncations and
   *  outright blocks) for this pass. */
  concentrationBlocks: { component: string; issuer: string; pre: number; post: number; truncated: boolean }[];
  /** §11.6/§14.5 crisis posture active during this pass (pilot mapping:
   *  canonical risk state STRESS/DEFENSIVE/EMERGENCY). */
  crisisMode: boolean;
}

export function applyMarpRebalance(
  s: ReserveState,
  fx: FxRates,
  decisions: MarpExecDecision[],
  opts?: { poolDepth24hUsd?: number; now?: number; reserveRatio?: number },
): MarpExecResult {
  let appliedCount = 0;
  let skippedCount = 0;
  let totalTradeUsd = 0;
  const traces: MarpExecTrace[] = [];
  const concentrationBlocks: MarpExecResult['concentrationBlocks'] = [];
  const events: EngineEventRecord[] = [];
  const record = (e: EngineEventRecord) => { events.push(e); return e; };
  const now = opts?.now ?? Date.now();
  const poolDepth24h = opts?.poolDepth24hUsd ?? POOL_DEPTH_FALLBACK_USD;
  // §11.6/§14.5 crisis posture (pilot mapping: §5.5 CrisisScore is symbolic —
  // the crisis set engages on the canonical risk state, the same mechanical
  // trigger that doubles the no-trade band).
  const crisisMode = s.riskState.state === 'STRESS' || s.riskState.state === 'DEFENSIVE' || s.riskState.state === 'EMERGENCY';
  // §15.6.1 caps in force: the 25% soft checkpoint is constant; the 30% hard
  // block relaxes to 35% ONLY under the crisis exception (Risk Council 4/7 +
  // 24h timelock — the pilot maps the crisis posture to the EMERGENCY risk
  // state).
  const warnCap = CONCENTRATION_WARN_PCT;
  const hardCap = s.riskState.state === 'EMERGENCY' ? CONCENTRATION_CRISIS_LIMIT_PCT : CONCENTRATION_LIMIT_PCT;

  // §15.7 — replay the genesis registry as AssetAdded records once per process
  // (idempotent; labeled replay — the pilot's admissions are static).
  replayGenesisRegistryEvents();

  maybeResetDailyTurnover(s);
  let vals = reserveAssetValues(s, fx);
  let nav = vals.nav;
  if (nav <= 0) {
    // Nothing to do — surface a single skip trace for visibility.
    for (const d of decisions) {
      traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: 'NAV ≤ 0', canonicalSkipReason: 'NAV ≤ 0' });
    }
    return { appliedCount: 0, skippedCount: decisions.length, totalTradeUsd: 0, path: 'marp', traces, events, lcrRepair: null, concentrationBlocks, crisisMode };
  }
  let goldPrice = vals.goldPrice;

  // Live per-issuer shares (net of haircuts, over NAV) for the §15.6.1 checks.
  const sharesNow = () => issuerSharesFrom({
    usdcUsd: s.usdc * 1.0 * (1 - HAIRCUTS.USD),
    usdpUsd: s.usdp * 1.0 * (1 - HAIRCUTS.USD),
    usdtUsd: s.usdt * 1.0 * (1 - HAIRCUTS.USD),
    eurcUsd: s.eurc * fx.EUR_USD * (1 - HAIRCUTS.EUR),
    paxgUsd: s.paxg * goldPrice * (1 - HAIRCUTS.PAXG),
    xautUsd: s.xaut * goldPrice * (1 - HAIRCUTS.XAUT),
    nav,
  });

  // === §13.4.3 — LCR constitutional floor (1.00) breach responses ============
  // "If LCR_t < 1.00, three responses engage automatically [BP §4.3.3]:
  //   (1) the protocol enters DEFENSIVE mode — the risk-state machine re-rates
  //       protocol posture and publishes the state change;
  //   (2) Rebalancing is re-routed to increase the liquid asset allocation —
  //       sell gold for stablecoins — until LCR returns above 1.00;
  //   (3) Minting is paused until LCR recovers; redemption remains available."
  // THIS pass implements response (2) as an obligation-driven repair trade at
  // the execution layer, executed through the Chapter-12 constraints
  // ("a liquidity repair executed at unbounded cost would repair the liquidity
  //  ratio by damaging the coverage ratio"): liquidity-capped, turnover-
  // capped, §20.4 fee, §15.6.1 routing; the §11.5.3 direction lock applies per
  // Chapter 11 (the spec does not exempt repair trades; its RR<1.05 stress
  // override still lifts the lock in stress). Responses (1)/(3) live in the
  // canonical state machine + mint gate (state-machine.ts / applyMint — other
  // regions own them); the §13.4.3 posture is surfaced on this record and in
  // RebalanceEngine.tsx.
  const price0 = getMtqPriceFromState(s);
  const lcrNow = computeLcr(s, vals, price0);
  const lcrBreach = Number.isFinite(lcrNow) && lcrNow < LCR_TARGET;
  let lcrRepair: MarpExecResult['lcrRepair'] = null;
  const rrNow = opts?.reserveRatio ?? Infinity;
  if (lcrBreach) {
    const stressDemand = circulatingSupply(s) * price0 * STRESS_REDEMPTION_RATE;
    const shortfallUsd = Math.max(0, stressDemand - vals.stablecoinNet);
    const reserveGoldUsd = (s.reservePaxg + s.reserveXaut) * goldPrice;
    const poolCap = MAX_POOL_FRACTION * crisisPoolFactor(crisisMode) * poolDepth24h;
    const turnoverRemaining = Math.max(0, MAX_DAILY_TURNOVER * nav - s.dailyTurnoverUsd);
    let repairUsd = Math.min(shortfallUsd, reserveGoldUsd, poolCap, turnoverRemaining);
    let blockedBy: CanonicalSkipReason | null = null;
    if (repairUsd > 0 && rrNow >= RR_STRESS && now - s.lastTradeAt < DIRECTION_LOCK_HOURS * 3_600_000 && s.lastTradeDir === -1) {
      // §11.5.3 — the 24h same-direction guard holds the repair sell too; the
      // RR<1.05 stress override still applies. Recorded, auditable.
      blockedBy = 'Direction lock';
      repairUsd = 0;
    }
    if (repairUsd > 0) {
      // §15.6.1 gate: route the repair proceeds BEFORE executing (block if no
      // routing can respect the hard cap).
      if (!routeStablecoinAcquisition(sharesNow(), repairUsd, nav, warnCap, hardCap)) {
        blockedBy = 'Concentration cap';
        repairUsd = 0;
      } else {
        // Execute the repair: sell RESERVE gold (50/50 PAXG/XAUT) → stablecoins
        // under §15.6.1 adaptive routing on the NET proceeds (fee excluded).
        const fee = chargeRebalanceFee(s, repairUsd, 'GOLD');
        const netUsd = repairUsd - fee;
        const alloc = routeStablecoinAcquisition(sharesNow(), netUsd, nav, warnCap, hardCap) ?? { usdc: netUsd, usdp: 0, usdt: 0 };
        const goldUnits = repairUsd / goldPrice;
        const half = goldUnits / 2;
        s.reservePaxg = subtractReserve(s, s.reservePaxg, half, goldPrice, 'reservePaxg');
        s.reserveXaut = subtractReserve(s, s.reserveXaut, half, goldPrice, 'reserveXaut');
        syncTotalFromReserve(s);
        s.usdc += alloc.usdc;
        s.usdp += alloc.usdp;
        s.usdt += alloc.usdt;
        s.lastTradeDir = -1;
        s.lastTradeAt = now;
        s.dailyTurnoverUsd += repairUsd;
        totalTradeUsd += repairUsd;
        appliedCount++;
        traces.push({ component: 'Gold', direction: 'sell', tradeUsd: repairUsd, level: MARP_EXECUTE_LEVEL, applied: true, lcrRepair: true });
        record(emitEngineEvent('RebalanceExecuted', { component: 'Gold', amount: Math.round(repairUsd * 100) / 100, estimatedCost: Math.round(estimateExecutionCost(repairUsd, 'GOLD').totalUsd * 100) / 100, deviation: null, lcrRepair: true }, { source: 'execution', blueprint: '§13.4.3 response 2 — LCR liquid repair (obligation-driven)' }));
        record(emitEngineEvent('GoldSold', { amount: goldUnits, output: netUsd, execPrice: goldPrice, lcrRepair: true }, { source: 'execution', blueprint: '§11.7/§13.4.3 — repair gold sell fill' }));
        // refresh the valuation after the repair mutation
        vals = reserveAssetValues(s, fx);
        nav = vals.nav;
        goldPrice = vals.goldPrice;
      }
    }
    lcrRepair = {
      lcr: lcrNow,
      shortfallUsd,
      tradeUsd: blockedBy ? 0 : repairUsd,
      blockedBy,
      posture: `DEFENSIVE per §13.4.3 (LCR < 1.00): mint-paused, rebalancing re-routed to liquid assets. Canonical state machine reports ${s.riskState.state} (mint throttle ${(mintThrottle(s.riskState.state) * 100).toFixed(0)}%) — the §13.4.3 posture and the §21.2 LCR bands are both v2.0 text; alignment of the state machine's LCR re-rate is owned by state-machine.ts.`,
    };
    if (blockedBy) {
      record(emitEngineEvent('RebalanceSkipped', { component: 'Gold', deviation: null, reason: blockedBy, lcrRepair: true, shortfallUsd: Math.round(shortfallUsd) }, { source: 'execution', blueprint: '§13.4.3 — liquid repair blocked (see reason)' }));
    }
  }

  for (const d of decisions) {
    // Level gate: only execute shouldTrade && level >= MARP_EXECUTE_LEVEL
    // (Level 8 — the final EXECUTE level of the §11 hierarchy; levels 1–7 are
    // advisory: natural-flow-covered / no-trade zone / low urgency / cost-
    // benefit fail / thin-liquidity deferral / turnover cap / direction lock).
    if (!d.shouldTrade || d.level < MARP_EXECUTE_LEVEL) {
      skippedCount++;
      const canonical = canonicalSkipReasonForLevel(d.level);
      traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: canonical, canonicalSkipReason: canonical });
      // §11.7 — "A candidate trade was declined, with a machine-readable
      // reason string." Quiet: routine no-trade records fire every tick.
      record(emitEngineEvent('RebalanceSkipped', { component: d.component, deviation: d.deviation ?? null, reason: canonical, level: d.level }, { source: 'decision', blueprint: '§11.7 — declined by the gate ladder', quiet: true }));
      continue;
    }
    let tradeUsd = d.tradeUsd;
    // AUDIT-FIX P1-4 (EQ-093): thin-liquidity deferral enforced AGAIN at
    // execution time (defense in depth) — a trade may never exceed
    // MAX_POOL_FRACTION × 24h pool depth (feed-driven, labeled fallback).
    // §11.6 crisis factor: the liquidity requirement is RAISED in crisis
    // (pilot instantiation ×0.5 — see CRISIS_EXECUTION_SET).
    const maxByPool = MAX_POOL_FRACTION * crisisPoolFactor(crisisMode) * poolDepth24h;
    if (tradeUsd > maxByPool) {
      tradeUsd = maxByPool;
    }
    // Enforce MAX_DAILY_TURNOVER (5% of NAV)
    const remainingDaily = MAX_DAILY_TURNOVER * nav - s.dailyTurnoverUsd;
    if (tradeUsd > remainingDaily) {
      tradeUsd = Math.max(0, remainingDaily);
    }
    if (tradeUsd <= 0) {
      skippedCount++;
      traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: 'Turnover cap', canonicalSkipReason: 'Turnover cap' });
      record(emitEngineEvent('RebalanceSkipped', { component: d.component, deviation: d.deviation ?? null, reason: 'Turnover cap' }, { source: 'execution', blueprint: '§11.7/§11.5.2 — daily turnover truncation' }));
      continue;
    }
    // Direction (+1 buy / -1 sell / 0 hold)
    const dir: 0 | 1 | -1 = d.direction === 'buy' ? 1 : d.direction === 'sell' ? -1 : 0;
    if (dir === 0) {
      skippedCount++;
      traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: 'Hold', canonicalSkipReason: 'Hold' });
      record(emitEngineEvent('RebalanceSkipped', { component: d.component, deviation: d.deviation ?? null, reason: 'Hold' }, { source: 'execution', blueprint: '§11.7 — non-trade input', quiet: true }));
      continue;
    }
    // === §13.4.3 re-route: during an active LCR breach, ordinary trades that
    // would move value OUT of the stablecoin class are held — "Rebalancing is
    // re-routed to increase the liquid asset allocation ... until LCR returns
    // above 1.00." EURC acquisitions stay eligible (EURC is in the §13.4.1
    // stablecoin numerator); gold acquisitions and non-stable instrument buys
    // do not.
    if (lcrBreach && (
      (d.component === 'Gold' && dir === 1) ||
      (d.component === 'USD' && dir === -1) ||
      (dir === 1 && d.component !== 'EUR' && d.component !== 'USD' && d.component !== 'Gold')
    )) {
      skippedCount++;
      traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: 'LCR repair priority (§13.4.3)', canonicalSkipReason: 'LCR repair priority' });
      record(emitEngineEvent('RebalanceSkipped', { component: d.component, deviation: d.deviation ?? null, reason: 'LCR repair priority' }, { source: 'execution', blueprint: '§13.4.3 — LCR breach re-route (stablecoin-preserving)' }));
      continue;
    }
    // Enforce DIRECTION_LOCK_HOURS (24h whipsaw guard §11.5.3)
    // v2.0-FIX: the lock blocks SAME-DIRECTION repetition within 24h and
    // ALLOWS reversals (anti-whipsaw; Appendix F.9). The RR < 1.05 stress
    // override lifts the lock so solvency-protective corrections proceed.
    if (rrNow >= RR_STRESS && now - s.lastTradeAt < DIRECTION_LOCK_HOURS * 3_600_000) {
      if (s.lastTradeDir !== 0 && dir === s.lastTradeDir) {
        skippedCount++;
        traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: 'Direction lock (24h same-direction guard §11.5.3)', canonicalSkipReason: 'Direction lock' });
        record(emitEngineEvent('RebalanceSkipped', { component: d.component, deviation: d.deviation ?? null, reason: 'Direction lock' }, { source: 'execution', blueprint: '§11.7/§11.5.3 — 24h same-direction guard (reversals eligible; RR<1.05 override)' }));
        continue;
      }
    }

    // === §15.6.1 PRE-TRADE issuer-concentration enforcement (Task 8-b) ======
    // "Enforcement happens before execution, not after": block any trade that
    // would increase exposure to an issuer already above the 25% soft
    // checkpoint, and block/truncate any trade that would breach the 30% hard
    // cap (35% under the EMERGENCY crisis exception). Acquisitions are routed
    // to keep every receiving issuer within the caps; when even the most
    // even split cannot fit, the trade is truncated to the largest
    // admissible size (the residual re-enters tomorrow's evaluation — §12.4
    // staged execution) and a full block is emitted when nothing fits.
    const pre = sharesNow();
    const assetClass = assetClassFor(d.component);
    let usdRouting: { usdc: number; usdp: number; usdt: number } | null = null;
    let goldRouting: { paxg: number; xaut: number } | null = null;
    let concBlocked: { issuer: string; pre: number; post: number } | null = null;
    if (d.component === 'Gold' || d.component === 'USD') {
      // The gold leg's receiving side: sells route the USD proceeds; buys
      // route the acquired gold across PAXG/XAUT.
      if (dir === -1) {
        usdRouting = routeStablecoinAcquisition(pre, tradeUsd, nav, warnCap, hardCap);
      } else {
        goldRouting = routeGoldAcquisition(pre, tradeUsd, nav, warnCap, hardCap);
      }
      if (!usdRouting && !goldRouting) {
        concBlocked = { issuer: 'STABLECOIN/GOLD ROUTING', pre: 0, post: 0 };
      }
    } else if (dir === -1) {
      // Fiat sell → USD proceeds routed under the caps.
      usdRouting = routeStablecoinAcquisition(pre, tradeUsd, nav, warnCap, hardCap);
      if (!usdRouting) concBlocked = { issuer: 'STABLECOIN ROUTING', pre: 0, post: 0 };
    } else if (d.component === 'EUR') {
      // EURC is single-issuer (CIRCLE) — no alternative instrument exists.
      const chk = issuerAcquisitionBlocked('CIRCLE', pre, tradeUsd, nav, warnCap, hardCap);
      if (chk.blocked) concBlocked = { issuer: 'CIRCLE', pre: chk.pre, post: chk.post };
    }
    // JPY/CNY/GBP/CHF acquisitions carry TBD issuerId in the registry (no
    // mapped-issuer exposure to cap) — recorded as the registry attribution
    // gap, NOT a silent pass (disclosed in honest-status D-concentration).
    if (concBlocked) {
      skippedCount++;
      traces.push({ component: d.component, direction: d.direction, tradeUsd: d.tradeUsd, level: d.level, applied: false, skipReason: `Concentration cap (§15.6.1 — ${concBlocked.issuer})`, canonicalSkipReason: 'Concentration cap' });
      concentrationBlocks.push({ component: d.component, issuer: concBlocked.issuer, pre: concBlocked.pre, post: concBlocked.post, truncated: false });
      record(emitEngineEvent('RebalanceSkipped', { component: d.component, deviation: d.deviation ?? null, reason: 'Concentration cap', issuer: concBlocked.issuer, preShare: Math.round(concBlocked.pre * 10000) / 100, postShare: Math.round(concBlocked.post * 10000) / 100 }, { source: 'execution', blueprint: '§11.7/§15.6.1 — pre-trade issuer-cap block' }));
      continue;
    }

    // AUDIT-FIX §20.4 — charge the 0.20% rebalancing fee BEFORE execution and
    // record the friction in the §9.5 cost-effect ledger. The swap settles on
    // the net notional.
    const fee = chargeRebalanceFee(s, tradeUsd, assetClass);
    const netUsd = tradeUsd - fee;

    // Apply the trade to the RESERVE holdings. §20.4: the swap settles on the
    // NET notional (tradeUsd − 0.20% fee) — the side being ACQUIRED receives
    // netUsd-worth of value; the side being SOLD gives up the full tradeUsd.
    if (d.component === 'Gold') {
      // Gold ↔ USD. §15.6.1 routing on the receiving side.
      const goldUnits = (dir === -1 ? tradeUsd : netUsd) / goldPrice;
      if (dir === -1) {
        // sell gold → USD (proceeds net of fee, §15.6.1-routed)
        const half = goldUnits / 2;
        // B9-FIX: track any deficit instead of silently zeroing.
        s.reservePaxg = subtractReserve(s, s.reservePaxg, half, goldPrice, 'reservePaxg');
        s.reserveXaut = subtractReserve(s, s.reserveXaut, half, goldPrice, 'reserveXaut');
        const alloc = routeStablecoinAcquisition(sharesNow(), netUsd, nav, warnCap, hardCap) ?? { usdc: netUsd, usdp: 0, usdt: 0 };
        s.usdc += alloc.usdc;
        s.usdp += alloc.usdp;
        s.usdt += alloc.usdt;
        record(emitEngineEvent('GoldSold', { amount: goldUnits, output: netUsd, execPrice: goldPrice }, { source: 'execution', blueprint: '§11.7 — gold sell leg fill (shadow record)' }));
      } else {
        // buy gold ← USD (gold bought with net; §15.6.1-routed across issuers)
        const usdThird = tradeUsd / 3;
        // B9-FIX: track any deficit instead of silently zeroing.
        s.usdc = subtractReserve(s, s.usdc, usdThird, 1, 'usdc');
        s.usdp = subtractReserve(s, s.usdp, usdThird, 1, 'usdp');
        s.usdt = subtractReserve(s, s.usdt, usdThird, 1, 'usdt');
        const alloc = routeGoldAcquisition(sharesNow(), netUsd, nav, warnCap, hardCap) ?? { paxg: netUsd / 2, xaut: netUsd / 2 };
        const paxgUnits = alloc.paxg / goldPrice;
        const xautUnits = alloc.xaut / goldPrice;
        s.reservePaxg += paxgUnits;
        s.reserveXaut += xautUnits;
        record(emitEngineEvent('GoldBought', { amount: paxgUnits + xautUnits, output: tradeUsd, execPrice: goldPrice }, { source: 'execution', blueprint: '§11.7 — gold buy leg fill (shadow record)' }));
      }
      // §14.1 — re-sync total paxg/xaut = index + reserve
      syncTotalFromReserve(s);
      // §10.7 — flows consumed by this trade's components reset.
      s.naturalFlowUsd.Gold = 0;
      s.naturalFlowUsd.USD = 0;
    } else if (d.component === 'USD') {
      // USD ↔ Gold.
      const goldUnits = (dir === -1 ? netUsd : tradeUsd) / goldPrice;
      if (dir === -1) {
        // sell USD → gold (gold bought with net; §15.6.1-routed)
        const usdThird = tradeUsd / 3;
        // B9-FIX: track any deficit instead of silently zeroing.
        s.usdc = subtractReserve(s, s.usdc, usdThird, 1, 'usdc');
        s.usdp = subtractReserve(s, s.usdp, usdThird, 1, 'usdp');
        s.usdt = subtractReserve(s, s.usdt, usdThird, 1, 'usdt');
        const alloc = routeGoldAcquisition(sharesNow(), netUsd, nav, warnCap, hardCap) ?? { paxg: netUsd / 2, xaut: netUsd / 2 };
        s.reservePaxg += alloc.paxg / goldPrice;
        s.reserveXaut += alloc.xaut / goldPrice;
        record(emitEngineEvent('GoldBought', { amount: goldUnits, output: tradeUsd, execPrice: goldPrice }, { source: 'execution', blueprint: '§11.7 — USD-sell gold buy fill (shadow record)' }));
      } else {
        // buy USD ← gold (gold sold at full; USD proceeds net, §15.6.1-routed)
        const half = goldUnits / 2;
        // B9-FIX: track any deficit instead of silently zeroing.
        s.reservePaxg = subtractReserve(s, s.reservePaxg, half, goldPrice, 'reservePaxg');
        s.reserveXaut = subtractReserve(s, s.reserveXaut, half, goldPrice, 'reserveXaut');
        const alloc = routeStablecoinAcquisition(sharesNow(), netUsd, nav, warnCap, hardCap) ?? { usdc: netUsd, usdp: 0, usdt: 0 };
        s.usdc += alloc.usdc;
        s.usdp += alloc.usdp;
        s.usdt += alloc.usdt;
        record(emitEngineEvent('GoldSold', { amount: goldUnits, output: netUsd, execPrice: goldPrice }, { source: 'execution', blueprint: '§11.7 — USD-buy gold sell fill (shadow record)' }));
      }
      // §14.1 — re-sync total paxg/xaut = index + reserve
      syncTotalFromReserve(s);
      s.naturalFlowUsd.Gold = 0;
      s.naturalFlowUsd.USD = 0;
    } else {
      // Non-USD fiat component (EUR/JPY/GBP/CNY/CHF) ↔ USD.
      // Convert to native units via the FX rate; the acquired side nets the fee.
      const fxRate =
        d.component === 'EUR' ? fx.EUR_USD :
        d.component === 'JPY' ? fx.JPY_USD :
        d.component === 'GBP' ? fx.GBP_USD :
        d.component === 'CNY' ? fx.CNY_USD :
        d.component === 'CHF' ? fx.CHF_USD : 1.0;
      const nativeUnits = (dir === -1 ? tradeUsd : netUsd) / fxRate;
      const usdThird = tradeUsd / 3;
      if (dir === -1) {
        // sell component → USD (USD proceeds net of fee, §15.6.1-routed)
        // B9-FIX: track any deficit instead of silently zeroing.
        if (d.component === 'EUR') s.eurc = subtractReserve(s, s.eurc, nativeUnits, fx.EUR_USD, 'eurc');
        else if (d.component === 'JPY') s.jpy = subtractReserve(s, s.jpy, nativeUnits, fx.JPY_USD, 'jpy');
        else if (d.component === 'GBP') s.gbp = subtractReserve(s, s.gbp, nativeUnits, fx.GBP_USD, 'gbp');
        else if (d.component === 'CNY') s.cny = subtractReserve(s, s.cny, nativeUnits, fx.CNY_USD, 'cny');
        else if (d.component === 'CHF') s.chf = subtractReserve(s, s.chf, nativeUnits, fx.CHF_USD, 'chf');
        const alloc = routeStablecoinAcquisition(sharesNow(), netUsd, nav, warnCap, hardCap) ?? { usdc: netUsd, usdp: 0, usdt: 0 };
        s.usdc += alloc.usdc;
        s.usdp += alloc.usdp;
        s.usdt += alloc.usdt;
      } else {
        // buy component ← USD (component bought with net)
        // B9-FIX: track any deficit instead of silently zeroing.
        s.usdc = subtractReserve(s, s.usdc, usdThird, 1, 'usdc');
        s.usdp = subtractReserve(s, s.usdp, usdThird, 1, 'usdp');
        s.usdt = subtractReserve(s, s.usdt, usdThird, 1, 'usdt');
        if (d.component === 'EUR') s.eurc += nativeUnits;
        else if (d.component === 'JPY') s.jpy += nativeUnits;
        else if (d.component === 'GBP') s.gbp += nativeUnits;
        else if (d.component === 'CNY') s.cny += nativeUnits;
        else if (d.component === 'CHF') s.chf += nativeUnits;
      }
      // §12.9 — TradeExecuted(tokenIn, tokenOut, amountIn, amountOut, execPrice).
      record(emitEngineEvent(
        'TradeExecuted',
        {
          tokenIn: dir === -1 ? d.component : 'USD',
          tokenOut: dir === -1 ? 'USD' : d.component,
          amountIn: Math.round(tradeUsd * 100) / 100,
          amountOut: Math.round(netUsd * 100) / 100,
          execPrice: Math.round(fxRate * 1e6) / 1e6,
        },
        { source: 'execution', blueprint: '§12.9 — non-gold leg fill (shadow record)', quiet: true },
      ));
      // §10.7 — flows consumed by this trade's components reset.
      if (d.component === 'EUR') s.naturalFlowUsd.EUR = 0;
      else if (d.component === 'JPY') s.naturalFlowUsd.JPY = 0;
      else if (d.component === 'GBP') s.naturalFlowUsd.GBP = 0;
      else if (d.component === 'CNY') s.naturalFlowUsd.CNY = 0;
      else if (d.component === 'CHF') s.naturalFlowUsd.CHF = 0;
      s.naturalFlowUsd.USD = 0; // USD is the counter-leg in every fiat trade
    }

    s.lastTradeDir = dir;
    s.lastTradeAt = now;
    s.dailyTurnoverUsd += tradeUsd;
    totalTradeUsd += tradeUsd;
    appliedCount++;
    traces.push({ component: d.component, direction: d.direction, tradeUsd, level: d.level, applied: true });
    // §11.7 — RebalanceExecuted(timestamp, deviation, amount, estimatedCost):
    // "A gated trade was executed with its pre-trade deviation and cost
    // estimate." estimatedCost = the §12.7 exact model at the §12.3.3 class τ.
    record(emitEngineEvent(
      'RebalanceExecuted',
      {
        component: d.component,
        deviation: d.deviation ?? null,
        amount: Math.round(tradeUsd * 100) / 100,
        estimatedCost: Math.round(estimateExecutionCost(tradeUsd, assetClass).totalUsd * 100) / 100,
      },
      { source: 'execution', blueprint: '§11.7 — gated trade executed (shadow record)' },
    ));
    // Refresh the valuation so subsequent §15.6.1 checks see the post-trade
    // issuer shares (and the turnover budget the consumed amount).
    vals = reserveAssetValues(s, fx);
    nav = vals.nav;
    goldPrice = vals.goldPrice;
  }

  s.updatedAt = Date.now();
  return { appliedCount, skippedCount, totalTradeUsd, path: 'marp', traces, events, lcrRepair, concentrationBlocks, crisisMode };
}

/** §11.6/§14.5 — the crisis liquidity-requirement factor on the pool cap
 *  ("liquidity requirements may increase ... only deeper venues qualify"):
 *  pilot instantiation ×0.5 (10% → 5% of 24h depth); 1.0 in normal mode.
 *  v2.0 publishes no operative number — labeled pending Risk-Council
 *  publication (CRISIS_EXECUTION_SET in marp.ts). */
function crisisPoolFactor(crisisMode: boolean): number {
  return crisisMode ? CRISIS_EXECUTION_SET.poolFractionFactor : 1;
}

// --- §11 Geopolitical Eject -------------------------------------------------
// AUDIT-FIX F-9 (EQ-157): the staged ladder is now wired to the FULL §21.5.3
// trigger set — de-peg duration OR RR-coupled triggers — plus the 5% pause
// rule. The former implementation was duration-only with a phantom reference
// to an `evaluateEjectStage` function that never existed.
//   Stage 1: de-peg confirmed > 12h                            (cumulative 10%)
//   Stage 2: > 24h OR RR < 1.08                               (cumulative 25%)
//   Stage 3: > 48h OR RR < 1.05                               (cumulative 50%)
//   Stage 4: issuer freeze / full collapse OR RR < 1.02        (cumulative 100%)
// §21.5.3 pause rule: the next stage is PAUSED if the price has dropped more
// than 5% (EJECT_PAUSE_RULE_PCT) from the price at which the current stage
// was entered — no liquidation into a crashing exit.
export function updatePegHealth(s: ReserveState, dtHours: number, fx: FxRates, rr: number = Infinity) {
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
    // §21.5.2 — asset-specific peg bands (liquidity-scaled):
    //   USDC/USDP/EURC ±0.5% · GBP/JPY ±1.0% · CNY (offshore CNH) ±1.5%
    const band = pegBandFor(c);
    const outside = p < band.lower || p > band.upper;
    if (outside) {
      s.depegHours[c] += dtHours;
    } else {
      // v2.0 §21.5.2 — "unstable ⇔ outside band for MORE THAN 12 CONSECUTIVE
      // hours, timer RESETS TO ZERO on return into band." The former 2×-
      // decay let an oscillating asset accumulate detector time across
      // in-band spells; the reset makes the detector strictly consecutive.
      s.depegHours[c] = 0;
    }
    // Staged ladder (§21.5.3): de-peg duration OR RR-coupled triggers drive
    // the stage; the 5% pause rule gates ADVANCEMENT (never de-escalation).
    const h = s.depegHours[c];
    let stage = 0;
    if (h > 48 || rr < 1.05) stage = 3;
    else if (h > 24 || rr < 1.08) stage = 2;
    else if (h > DEPEG_DETECTION_HOURS) stage = 1;
    // Stage 4 — issuer freeze / full collapse (±10% break) OR RR hard coupling.
    if (h > 96 || p < 0.9 || p > 1.1 || rr < 1.02) stage = 4;

    if (stage > s.ejectStage[c]) {
      // §21.5.3 pause rule: pause the next stage if the price has dropped
      // > 5% from the price at which the current stage was entered.
      const startPrice = s.ejectStageStartPrice[c];
      const droppedTooFar = startPrice > 0 && p < startPrice * (1 - EJECT_PAUSE_RULE_PCT);
      if (!droppedTooFar) {
        s.ejectStage[c] = stage;
        s.ejectStageStartPrice[c] = p; // record this stage's entry price
      }
      // else: hold the current stage — the ladder resumes when the price
      // recovers above the −5% pause threshold (§21.5.3).
    } else if (stage < s.ejectStage[c]) {
      // De-escalation (price recovered / RR restored) is immediate — the
      // pause rule never blocks standing DOWN the ladder.
      s.ejectStage[c] = stage;
      if (stage === 0) {
        s.ejectStageStartPrice[c] = 1;
      }
    }
  }
}

// §21.5.2 peg band for a currency exposure (USDC/USDP share the USD class).
export function pegBandFor(cur: "USD" | "EUR" | "GBP" | "JPY" | "CNY"): { lower: number; upper: number } {
  switch (cur) {
    case "USD": return PEG_BANDS.USDC;
    case "EUR": return PEG_BANDS.EURC;
    case "GBP": return PEG_BANDS.GBP;
    case "JPY": return PEG_BANDS.JPY;
    case "CNY": return PEG_BANDS.CNY;
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

export interface MintGuardOpts {
  /** §19.4.1 — explicit minMTQOut from the user. When absent, the default is
 *  computed per the blueprint: (X_net / P_MTQ) × throttle × (1 − τ_user),
 *  τ_user = 0.5% (DEFAULT_SLIPPAGE, Listing 11). Revert if MTQ_minted < min. */
  minOutMtq?: number;
  /** §19.7 — quote deadline (epoch ms). If now > deadline the operation
 *  reverts ("if the transaction is not executed within the deadline the
 *  whole operation reverts"). */
  quoteExpiresAt?: number;
  /** §13.4.3 constitutional LCR floor — the LCR value the mint gate checks
 *  against the 1.00 floor. When absent, the guard computes it live from the
 *  reserve state (stablecoin-only numerator per §13.4.1). */
  lcr?: number;
  /** Deterministic clock for tests. */
  now?: number;
}

export function applyMint(
  s: ReserveState,
  fx: FxRates,
  status: ProtocolStatus,
  inputUsd: number,
  opts?: MintGuardOpts,
): MintResult {
  const now = opts?.now ?? Date.now();
  // P0-FIX-1: use the canonical chain-linked index for the MTQ price (the
  // legacy Laspeyres form had a structural short-gold bug — see chain-index.ts).
  const price = getMtqPriceFromState(s);
  // AUDIT-FIX EQ-146 (§19.7 — 5-minute trade deadline): the whole operation
  // reverts when executed after the quote deadline.
  if (opts?.quoteExpiresAt != null && now > opts.quoteExpiresAt) {
    return { ok: false, reason: "Quote expired — the 5-minute trade deadline (§19.7) has passed; request a fresh quote.", inputUsd, feeUsd: 0, netUsd: 0, mtqPrice: price, mtqMinted: 0, throttleFactor: 0, newCirculatingSupply: circulatingSupply(s), newReserveRatio: computeReserveRatio(reserveAssetValues(s, fx).nav, computeLiability(s, price)) };
  }
  if (!priceInSafetyBand(price)) {
    return { ok: false, reason: "Reference Value outside safety band (0.50–2.00 USD reporting); minting paused by circuit breaker.", inputUsd, feeUsd: 0, netUsd: 0, mtqPrice: price, mtqMinted: 0, throttleFactor: 0, newCirculatingSupply: circulatingSupply(s), newReserveRatio: computeReserveRatio(reserveAssetValues(s, fx).nav, computeLiability(s, price)) };
  }
  // P0-FIX-3: use the canonical mint throttle / minting-allowed from
  // state-machine.ts. STRESS now also pauses minting (previously only
  // DEFENSIVE/EMERGENCY did). NORMAL=1.0, CAUTION=0.5, STRESS/DEFENSIVE/EMERGENCY=0 (paused), RECOVERY=0.25.
  if (!mintingAllowed(status)) {
    return { ok: false, reason: `${status}: minting paused by canonical Risk State Machine (§21.3).`, inputUsd, feeUsd: 0, netUsd: 0, mtqPrice: price, mtqMinted: 0, throttleFactor: 0, newCirculatingSupply: circulatingSupply(s), newReserveRatio: computeReserveRatio(reserveAssetValues(s, fx).nav, computeLiability(s, price)) };
  }
  // === §13.4.3 constitutional LCR floor (Task 8-int) ========================
  // "The Constitutional Floor and Breach Behavior": when LCR_t < 1.00,
  // response (3) — "Minting is paused until LCR recovers" — is CONSTITUTIONAL
  // and pins the mint-pause boundary at 1.00, OVERRIDING the milder §21.2
  // LCR bands (where LCR 0.90–0.99 alone maps only to CAUTION/50% throttle).
  // Redemption stays available (exit-first, §13.4.3(3) / Chapter 19). The
  // band tension between §13.4.3 (floor 1.00) and §21.2 (S2 entry LCR ≥ 0.90)
  // is a genuine v2.0 duality — documented here and in honest-status
  // D-lcr-repair; the constitutional floor governs the MINT gate, the §21.2
  // ladder governs the remaining action profiles.
  const lcrNow = opts?.lcr ?? computeLcr(s, reserveAssetValues(s, fx), price);
  if (typeof lcrNow === "number" && Number.isFinite(lcrNow) && lcrNow < 1.00) {
    return { ok: false, reason: `§13.4.3 constitutional LCR floor: LCR_t = ${lcrNow.toFixed(3)} < 1.00 — minting paused until LCR recovers (redemption remains available; exit-first).`, inputUsd, feeUsd: 0, netUsd: 0, mtqPrice: price, mtqMinted: 0, throttleFactor: 0, newCirculatingSupply: circulatingSupply(s), newReserveRatio: computeReserveRatio(reserveAssetValues(s, fx).nav, computeLiability(s, price)) };
  }
  const throttle = mintThrottle(status);
  const feeUsd = inputUsd * (MINT_FEE_BPS / 10_000);
  const netUsd = inputUsd - feeUsd;
  const minted = (netUsd / price) * throttle;
  // AUDIT-FIX EQ-146 (§19.4.1 — minting slippage guard): revert if
  // MTQ_minted < minMTQOut. Default min = (X_net / P) × throttle × (1 − τ_user)
  // (τ_user = 0.5%, Listing 11's DEFAULT_SLIPPAGE) — binds only when the
  // price drifted >0.5% against the quote; an explicit user value always
  // overrides the default ("A user may always tighten the guard below the
  // default").
  const minOut = opts?.minOutMtq ?? ((netUsd / price) * throttle) * (1 - DEFAULT_SLIPPAGE_TAU_USER);
  if (minted < minOut) {
    return { ok: false, reason: `Slippage guard (§19.4.1): minted ${minted.toFixed(4)} MTQΣ < minOut ${minOut.toFixed(4)} MTQΣ (τ_user 0.5%). Reverting — request a fresh quote.`, inputUsd, feeUsd: 0, netUsd: 0, mtqPrice: price, mtqMinted: 0, throttleFactor: throttle, newCirculatingSupply: circulatingSupply(s), newReserveRatio: computeReserveRatio(reserveAssetValues(s, fx).nav, computeLiability(s, price)) };
  }
  // §19.7 — constitutional minimum mint (1 MTQ); rejects dust-sized mints.
  if (minted < MIN_MINT_MTQ) {
    return { ok: false, reason: `Minimum mint is ${MIN_MINT_MTQ} MTQΣ (§19.7, constitutional) — deposit more or mint at full capacity (current throttle ${(throttle * 100).toFixed(0)}%).`, inputUsd, feeUsd: 0, netUsd: 0, mtqPrice: price, mtqMinted: 0, throttleFactor: throttle, newCirculatingSupply: circulatingSupply(s), newReserveRatio: computeReserveRatio(reserveAssetValues(s, fx).nav, computeLiability(s, price)) };
  }

  // §19.2.2 Step 4 — atomic swap of the net deposit into the full reserve
  // basket. v2.0 adaptation (BP §12.2.2 fidelity note): "the purchased split
  // is the live weight vector W_t published by the MASE weight registry — no
  // percentage is hard-coded." The pilot therefore allocates netUsd across
  // the 7 components at the LIVE smoothed weights (s.maseSmoothed, genesis
  // fallback = the Strategic Prior snapshot §3.4): the USD sleeve splits 1/3
  // across USDC/USDP/USDT (§15.6 issuer-concentration policy), the gold
  // sleeve splits 50/50 PAXG/XAUT (second-issuer fix), and the fiat legs
  // convert at the live canonical FX rates. This also implements §10.7's
  // natural-flow mechanism: "minting delivers the reference basket, so
  // sustained net minting pulls the observed composition toward the target
  // composition without a single DEX trade."
  const w: WeightVector = s.maseSmoothed ?? (STRATEGIC_PRIOR as WeightVector);
  const wpick = (c: Component) => w[c] ?? STRATEGIC_PRIOR[c];
  // AUDIT-FIX F-7 (§15.6.1 — enforcement happens BEFORE execution): "the
  // Rebalancing Engine checks this constraint before executing any trade that
  // would increase exposure to an issuer that already exceeds 25% ... any
  // trade that would breach 30% is blocked outright." The mint's USD sleeve
  // therefore routes ONLY to issuers whose post-deposit share stays within
  // the warn threshold; the gold sleeve splits the same way across PAXG/XAUT.
  // (During the §15.6.1 35% crisis exception — EMERGENCY risk state — the
  // routing cap relaxes to 35% instead of blocking.)
  const valsPre = reserveAssetValues(s, fx);
  const navPre = Math.max(valsPre.nav, 1e-9);
  const crisis = s.riskState.state === "EMERGENCY";
  const warnCap = crisis ? CONCENTRATION_CRISIS_LIMIT_PCT : CONCENTRATION_WARN_PCT;
  const circleShare = (valsPre.usdcUsd + valsPre.eurNet) / navPre;
  const paxosShare = (valsPre.usdpUsd + valsPre.paxgUsd) / navPre;
  const tetherShare = (valsPre.usdtUsd + valsPre.xautUsd) / navPre;
  // USD sleeve routing weights across USDC / USDP / USDT (sum = 1).
  let usdcW = 1 / 3, usdpW = 1 / 3, usdtW = 1 / 3;
  {
    const ok = { USDC: circleShare < warnCap, USDP: paxosShare < warnCap, USDT: tetherShare < warnCap };
    const elig = [ok.USDC, ok.USDP, ok.USDT].filter(Boolean).length;
    if (elig > 0 && elig < 3) {
      const we = 1 / elig;
      usdcW = ok.USDC ? we : 0; usdpW = ok.USDP ? we : 0; usdtW = ok.USDT ? we : 0;
    } else if (elig === 0) {
      // All issuers at/over the warn threshold (EURC-floor territory): split
      // evenly — accumulation is capped in the direction of reduction by the
      // per-tick concentration optimizer instead.
      usdcW = 1 / 3; usdpW = 1 / 3; usdtW = 1 / 3;
    }
  }
  // Gold sleeve routing across PAXG / XAUT (sum = 1).
  let paxgW = 0.5, xautW = 0.5;
  {
    const okP = paxosShare < warnCap, okT = tetherShare < warnCap;
    if (okP && !okT) { paxgW = 1; xautW = 0; }
    else if (!okP && okT) { paxgW = 0; xautW = 1; }
  }
  const usdSleeve = netUsd * wpick("USD");
  s.usdc += usdSleeve * usdcW;
  s.usdp += usdSleeve * usdpW;
  s.usdt += usdSleeve * usdtW;
  s.eurc += (netUsd * wpick("EUR")) / Math.max(fx.EUR_USD, 1e-9);
  s.jpy  += (netUsd * wpick("JPY")) / Math.max(fx.JPY_USD, 1e-9);
  s.gbp  += (netUsd * wpick("GBP")) / Math.max(fx.GBP_USD, 1e-9);
  s.cny  += (netUsd * wpick("CNY")) / Math.max(fx.CNY_USD, 1e-9);
  s.chf  += (netUsd * wpick("CHF")) / Math.max(fx.CHF_USD, 1e-9);
  const goldSpendUsd = netUsd * wpick("Gold");
  const goldUnits = goldSpendUsd / Math.max(fx.XAU_USD, 1e-9);
  // §14.1 — purchased gold lands in the RESERVE buffer (index gold locked).
  s.paxg += goldUnits * paxgW;
  s.xaut += goldUnits * xautW;
  s.reservePaxg += goldUnits * paxgW;
  s.reserveXaut += goldUnits * xautW;
  // AUDIT-FIX §10.7 (C.3) — MEASURE the natural flows this mint delivered:
  // minting delivers the reference basket, so each component's CF_{i,t}
  // increases by the USD-equivalent delivered to it.
  s.naturalFlowUsd.USD += usdSleeve;
  s.naturalFlowUsd.EUR += netUsd * wpick("EUR");
  s.naturalFlowUsd.JPY += netUsd * wpick("JPY");
  s.naturalFlowUsd.GBP += netUsd * wpick("GBP");
  s.naturalFlowUsd.CNY += netUsd * wpick("CNY");
  s.naturalFlowUsd.CHF += netUsd * wpick("CHF");
  s.naturalFlowUsd.Gold += goldSpendUsd;
  s.treasury.hotWalletUsd += feeUsd; // fee revenue → hot wallet (§20.4 — excluded from NAV)
  s.totalSupply += minted;
  s.updatedAt = now;

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
  // B9-FIX: when ok=false because a reserve holding would go negative, the
  // would-be deficit (USD-equivalent shortfall across all components that are
  // short) is recorded here AND accumulated into `s.deficitUsd` for the
  // lifetime-of-engine conservation-of-value ledger. Undefined / 0 when ok=true
  // or when the failure is NOT a conservation-guard failure (e.g. paused,
  // insufficient circulating supply, price band).
  deficitUsd: number;
}

export interface RedeemGuardOpts {
  /** §19.4.2 — the user's declared minimum (minAssetOut form): "the
 *  transaction reverts if the net redemption value — or the aggregate value
 *  of the released basket at canonical prices — falls below the user's
 *  declared minimum." Undefined = not declared (no guard binds). */
  minOutUsd?: number;
  /** §19.7 — quote deadline (epoch ms). Reverts when now > deadline. */
  quoteExpiresAt?: number;
  /** Deterministic clock for tests. */
  now?: number;
}

export function applyRedeem(
  s: ReserveState,
  fx: FxRates,
  status: ProtocolStatus,
  inputMtq: number,
  opts?: RedeemGuardOpts,
): RedeemResult {
  const now = opts?.now ?? Date.now();
  // P0-FIX-1: use the canonical chain-linked index for P_MTQ.
  const price = getMtqPriceFromState(s);
  // AUDIT-FIX EQ-146 (§19.7 — 5-minute trade deadline).
  const deadlineFail = opts?.quoteExpiresAt != null && now > opts.quoteExpiresAt;
  if (deadlineFail) {
    const circ = circulatingSupply(s);
    const vals0d = reserveAssetValues(s, fx);
    const navPerMtqD = circ > 0 ? vals0d.nav / circ : price;
    return { ok: false, reason: "Quote expired — the 5-minute trade deadline (§19.7) has passed; request a fresh quote.", inputMtq, mtqPrice: price, grossUsd: 0, feeBps: 0, feeUsd: 0, netUsd: 0, goldUsd: 0, goldPaxg: 0, basket: [], newCirculatingSupply: circ, newReserveRatio: computeReserveRatio(vals0d.nav, computeLiability(s, price)), navPerMtq: navPerMtqD, auditNavPerToken: navPerMtqD, auditGrossUsdNav: inputMtq * navPerMtqD, auditGrossUsdIndex: inputMtq * price, auditDeltaUsd: inputMtq * navPerMtqD - inputMtq * price, auditNote: "§19.7 deadline guard", deficitUsd: 0 };
  }
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
    "BLUEPRINT AUDIT 2026-10-19 (I6 + §19.3.2): redemption settles at NAV_t = " +
    "V_net / circulatingSupply (Step 2) and releases the basket proportional to " +
    "ACTUAL reserve composition (Step 4: Release_i = RedeemValue_net × V_i/V_net — " +
    "'redemption reflects what is held, not what is intended'). The legacy B8 " +
    "P_MTQ settlement and the target-weight split were v1.2-era deviations and " +
    "are reverted. auditGrossUsdIndex (Y × P_MTQ) is retained as the audit-only " +
    "alternative; the NAV-vs-index divergence (auditDeltaUsd) is a transparency " +
    "metric — at RR > 100% NAV-based redemption pays the book value of the token, " +
    "which is the invariant's intent, and the risk-state machine (fees, throttles) " +
    "governs the extraction rate.";
  if (inputMtq > circ) {
    return { ok: false, reason: "Insufficient circulating supply for this redemption in pilot state.", inputMtq, mtqPrice: price, grossUsd: 0, feeBps: 0, feeUsd: 0, netUsd: 0, goldUsd: 0, goldPaxg: 0, basket: [], newCirculatingSupply: circ, newReserveRatio: computeReserveRatio(vals0.nav, computeLiability(s, price)), navPerMtq, auditNavPerToken, auditGrossUsdNav, auditGrossUsdIndex, auditDeltaUsd: auditGrossUsdNav - auditGrossUsdIndex, auditNote, deficitUsd: 0 };
  }
  // P0-FIX-3: §21.4 — redemption is PAUSED in EMERGENCY (the reconciliation
  // resolves the §16.2 vs §21.4 contradiction in favour of §21.4: pause).
  if (!redemptionAllowed(status)) {
    return { ok: false, reason: `${status}: redemption paused per §21.4 (canonical Risk State Machine).`, inputMtq, mtqPrice: price, grossUsd: 0, feeBps: 0, feeUsd: 0, netUsd: 0, goldUsd: 0, goldPaxg: 0, basket: [], newCirculatingSupply: circ, newReserveRatio: computeReserveRatio(vals0.nav, computeLiability(s, price)), navPerMtq, auditNavPerToken, auditGrossUsdNav, auditGrossUsdIndex, auditDeltaUsd: auditGrossUsdNav - auditGrossUsdIndex, auditNote, deficitUsd: 0 };
  }
  // P0-FIX-3: state-dependent fee from the canonical 6-state risk machine.
  // §21.4 redemption row: NORMAL/CAUTION 0.15% · STRESS 0.50% · DEFENSIVE 1.00%
  // · RECOVERY 0.30% (EMERGENCY is paused — unreachable here).
  const feeFraction = redeemFee(status);
  const feeBps = Math.round(feeFraction * 10_000);
  // §19.7 — constitutional minimum redemption amount (1 MTQ).
  if (inputMtq < MIN_REDEEM_MTQ) {
    return { ok: false, reason: `Minimum redemption is ${MIN_REDEEM_MTQ} MTQΣ (§19.7, constitutional).`, inputMtq, mtqPrice: price, grossUsd: 0, feeBps: 0, feeUsd: 0, netUsd: 0, goldUsd: 0, goldPaxg: 0, basket: [], newCirculatingSupply: circ, newReserveRatio: computeReserveRatio(vals0.nav, computeLiability(s, price)), navPerMtq, auditNavPerToken, auditGrossUsdNav, auditGrossUsdIndex, auditDeltaUsd: auditGrossUsdNav - auditGrossUsdIndex, auditNote, deficitUsd: 0 };
  }
  // BLUEPRINT AUDIT 2026-10-19 (Invariant I6 + §19.3.2 Step 2): redemption is
  // priced against NAV_t — "the exit side uses what the reserve is actually
  // worth, not what the reference unit quotes" (§19.3). The prior B8 local
  // patch settled at P_MTQ (arbitrage-safe) — that contradicted the invariant
  // and is reverted; the divergence (NAV vs index) remains visible in the
  // audit fields below, which is exactly what the doc's transparency layer
  // is for. (Noted doc-internal tension: §18.1's loose "approximately
  // Y·P·(1−f)" summary vs the invariant + §19.3's exact Y·NAV_t — the
  // invariant + detailed step-by-step flow are canonical.)
  const grossUsd = inputMtq * navPerMtq; // §19.3.2 Step 2 — NAV-based (Invariant I6)
  const feeUsd = grossUsd * feeFraction;
  const netUsd = grossUsd - feeUsd;
  // AUDIT-FIX EQ-147 (§19.4.2 — full-basket redemption slippage guard):
  // revert if the net redemption value falls below the user's DECLARED
  // minimum (minAssetOut form — binds only when declared). A SlippageWarning
  // is logged whenever the guard binds so the binding frequency is
  // observable (§19.4.2 / §24.4).
  if (opts?.minOutUsd != null && netUsd < opts.minOutUsd) {
    console.warn(`[mtq-engine] SlippageWarning: redemption net ${netUsd.toFixed(2)} USD < declared minOut ${opts.minOutUsd.toFixed(2)} USD (§19.4.2) — reverting`);
    return { ok: false, reason: `Slippage guard (§19.4.2): net redemption value ${netUsd.toFixed(2)} USD < your declared minimum ${opts.minOutUsd.toFixed(2)} USD. Reverting — request a fresh quote.`, inputMtq, mtqPrice: price, grossUsd: 0, feeBps: 0, feeUsd: 0, netUsd: 0, goldUsd: 0, goldPaxg: 0, basket: [], newCirculatingSupply: circ, newReserveRatio: computeReserveRatio(vals0.nav, computeLiability(s, price)), navPerMtq, auditNavPerToken, auditGrossUsdNav, auditGrossUsdIndex, auditDeltaUsd: auditGrossUsdNav - auditGrossUsdIndex, auditNote, deficitUsd: 0 };
  }

  // §19.3.2 Step 4 — proportional release per ACTUAL reserve composition:
  //   Release_i = RedeemValue_net × (V_i / V_net)
  // "The release is always proportional to actual reserve composition, never
  // to target weights — redemption reflects what is held, not what is
  // intended." (The prior target-weight split was a v1.2 legacy deviation.)
  const vals = reserveAssetValues(s, fx);
  const nav = vals.nav;
  const share = (v: number) => (nav > 0 ? v / nav : 0);
  const usdShare = share(vals.usdNet);
  const goldShare = share(vals.goldNet);
  const goldUsd = netUsd * goldShare;
  const fiatUsd = netUsd * usdShare; // USD-class stablecoins released directly
  const goldPrice = vals.goldPrice;
  // Gold splits across PAXG + XAUT proportional to ACTUAL holdings.
  const paxgFrac = s.paxg + s.xaut > 0 ? s.paxg / (s.paxg + s.xaut) : 0.5;
  const goldPaxg = goldUsd / goldPrice;
  const paxgRelease = goldPaxg * paxgFrac;
  const xautRelease = goldPaxg * (1 - paxgFrac);
  // USD splits across the 3 stablecoin issuers proportional to actual holdings.
  const usdTotal = s.usdc + s.usdp + s.usdt;
  const usdcFrac = usdTotal > 0 ? s.usdc / usdTotal : 1 / 3;
  const usdpFrac = usdTotal > 0 ? s.usdp / usdTotal : 1 / 3;
  const usdtFrac = usdTotal > 0 ? s.usdt / usdTotal : 1 / 3;
  const usdRelease = fiatUsd;
  const usdcRelease = usdRelease * usdcFrac;
  const usdpRelease = usdRelease * usdpFrac;
  const usdtRelease = usdRelease * usdtFrac;
  // Fiat components: release proportional to actual holdings (net USD values).
  const eurUsd = netUsd * share(vals.eurNet);
  const jpyUsd = netUsd * share(vals.jpyNet);
  const gbpUsd = netUsd * share(vals.gbpNet);
  const cnyUsd = netUsd * share(vals.cnyNet);
  const chfUsd = netUsd * share(vals.chfNet);
  const basket: RedeemBasket[] = [
    { currency: "USD", token: "USDC/USDP/USDT", usdValue: fiatUsd, nativeAmount: usdRelease, weight: usdShare },
    { currency: "EUR", token: "EURC", usdValue: eurUsd, nativeAmount: eurUsd / fx.EUR_USD, weight: share(vals.eurNet) },
    { currency: "JPY", token: "JPY₿", usdValue: jpyUsd, nativeAmount: jpyUsd / fx.JPY_USD, weight: share(vals.jpyNet) },
    { currency: "GBP", token: "GBP₿", usdValue: gbpUsd, nativeAmount: gbpUsd / fx.GBP_USD, weight: share(vals.gbpNet) },
    { currency: "CNY", token: "CNY₿", usdValue: cnyUsd, nativeAmount: cnyUsd / fx.CNY_USD, weight: share(vals.cnyNet) },
    { currency: "CHF", token: "CHF₿", usdValue: chfUsd, nativeAmount: chfUsd / fx.CHF_USD, weight: share(vals.chfNet) },
    { currency: "Gold", token: "PAXG + XAUT", usdValue: goldUsd, nativeAmount: goldPaxg, weight: goldShare },
  ];

  // Mutate reserve: burn MTQ from circulating (reduce totalSupply), release assets
  // proportional to ACTUAL composition: USD across USDC/USDP/USDT by holdings;
  // gold across PAXG/XAUT by holdings; fiat per actual EURC/JPY₿/GBP₿/CNY₿/CHF₿.
  // B9 FIX: Pre-check that every component has sufficient holdings before
  // mutating. Previously, Math.max(0, holding - amount) silently floored
  // negative holdings to 0 — the deficit disappeared, breaking conservation
  // of value and creating phantom surplus over time. Now we revert the entire
  // redeem if any component is short AND record the would-be deficit (in USD)
  // into `s.deficitUsd` and the RedeemResult so the books stay closed.

  // B9-FIX: compute the TOTAL would-be deficit (in USD) across every component
  // that is short. This is recorded into s.deficitUsd and the RedeemResult so
  // the loss is auditable instead of silently disappearing. The redeem itself
  // is REJECTED (ok:false) — no state mutation occurs.
  const usdShortfall =
    Math.max(0, usdcRelease - s.usdc) +
    Math.max(0, usdpRelease - s.usdp) +
    Math.max(0, usdtRelease - s.usdt); // 1:1 USD stablecoins
  const fiatShortfall =
    Math.max(0, basket[1].nativeAmount - s.eurc) * fx.EUR_USD +
    Math.max(0, basket[2].nativeAmount - s.jpy)  * fx.JPY_USD +
    Math.max(0, basket[3].nativeAmount - s.gbp)  * fx.GBP_USD +
    Math.max(0, basket[4].nativeAmount - s.cny)  * fx.CNY_USD +
    Math.max(0, basket[5].nativeAmount - s.chf)  * fx.CHF_USD;
  const goldShortfall =
    (Math.max(0, paxgRelease - s.paxg) + Math.max(0, xautRelease - s.xaut)) * goldPrice;
  const totalDeficitUsd = usdShortfall + fiatShortfall + goldShortfall;

  // B9: Check all holdings are sufficient. If any is short, record the deficit
  // and return ok:false with a clear reason — do NOT silently floor to 0.
  if (totalDeficitUsd > 0) {
    console.warn('[engine] B9: redeem-into-negative rejected', {
      usdShortfall, fiatShortfall, goldShortfall, totalDeficitUsd,
      cumulativeDeficitUsd: (s.deficitUsd ?? 0) + totalDeficitUsd,
    });
    s.deficitUsd = (s.deficitUsd ?? 0) + totalDeficitUsd;
    return {
      ok: false,
      reason: usdShortfall > 0
        ? "Insufficient USD stable holdings for redemption basket (B9 conservation guard)."
        : fiatShortfall > 0
          ? "Insufficient fiat token holdings for redemption basket (B9 conservation guard)."
          : "Insufficient gold (PAXG/XAUT) holdings for redemption basket (B9 conservation guard).",
      inputMtq, mtqPrice: price, grossUsd: 0, feeBps: 0, feeUsd: 0, netUsd: 0,
      goldUsd: 0, goldPaxg: 0, basket: [], newCirculatingSupply: circ,
      newReserveRatio: computeReserveRatio(vals0.nav, computeLiability(s, price)),
      navPerMtq, auditNavPerToken, auditGrossUsdNav, auditGrossUsdIndex,
      auditDeltaUsd: auditGrossUsdNav - auditGrossUsdIndex, auditNote,
      deficitUsd: totalDeficitUsd,
    };
  }

  s.totalSupply -= inputMtq;
  // B9: All holdings verified sufficient above — subtract directly (no Math.max needed).
  s.usdc -= usdcRelease;
  s.usdp -= usdpRelease;
  s.usdt -= usdtRelease;
  s.eurc -= basket[1].nativeAmount;
  s.jpy  -= basket[2].nativeAmount;
  s.gbp  -= basket[3].nativeAmount;
  s.cny  -= basket[4].nativeAmount;
  s.chf  -= basket[5].nativeAmount; // NEW v1.0
  // Gold released per ACTUAL PAXG/XAUT split (§19.3.2 Step 4 — proportional
  // to holdings, not 50/50)
  s.paxg -= paxgRelease;
  s.xaut -= xautRelease;
  // AUDIT-FIX §10.7 (C.3) — MEASURE the natural outflows this redemption
  // drew: each released leg is a negative CF_{i,t} for its component.
  s.naturalFlowUsd.USD -= fiatUsd;
  s.naturalFlowUsd.EUR -= eurUsd;
  s.naturalFlowUsd.JPY -= jpyUsd;
  s.naturalFlowUsd.GBP -= gbpUsd;
  s.naturalFlowUsd.CNY -= cnyUsd;
  s.naturalFlowUsd.CHF -= chfUsd;
  s.naturalFlowUsd.Gold -= goldUsd;
  // §14.1 — gold released to the redeemer comes from the RESERVE buffer first
  // (index gold is locked). syncReserveFromTotal re-derives reserve = total − index
  // so the invariant paxg = indexPaxg + reservePaxg is preserved.
  syncReserveFromTotal(s);
  s.treasury.hotWalletUsd += feeUsd; // fee revenue → hot wallet
  s.updatedAt = now;

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
    deficitUsd: 0,
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
  /** v2.0 §17.7 — TRUE when MINTING is held: oracle FAILED (quorum lost — all
   *  ops pause) OR DEGRADED (2-source path | confidence < C_MIN | correlation
   *  warning — mint+rebalance pause). Redemption stays available in DEGRADED
   *  (see oracleFailed). */
  oraclePaused: boolean;
  /** §17.7 FAILED — quorum lost: ALL operations pause (mint, redemption, rebalance). */
  oracleFailed: boolean;
  /** §17.7 DEGRADED — mint+rebalance paused, REDEMPTION AVAILABLE (exit-first). */
  oracleDegraded: boolean;
  /** §17.7 aggregate state label (NORMAL/DEGRADED/FAILED). */
  oracleState: import("./oracle").OracleAggregateState;
  /** §17.6/§18.3 OracleConfidence_t — the GOLD pair's Confidence_G score
   *  (five-factor geometric aggregate; C_MIN 0.60). Published in the daily
   *  state vector per §18.3 and §24.3. */
  oracleGoldConfidence: number;
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
  // === GOLD-ANCHOR (§1.2/§14): live reserve-basket backing per 1 MTQΣ, in
  // NATIVE units. Each reserve asset is an individual store of value — it is
  // NOT connected to the others through a dollar conversion. The canonical
  // anchor quote is gold (grams per MTQΣ); USD appears nowhere in this block
  // (the USD reporting numeraire lives in `mtqPrice`/`perIssuer` and is a
  // display convenience only, never a peg).
  holdings: {
    // Native-unit quantities actually held in the reserve vault.
    usdStable: number;   // USDC + USDP + USDT units (1 unit = 1 USD claim)
    eur: number;         // EURC units
    gbp: number;         // GBP-token units
    jpy: number;         // JPY-token units
    cny: number;         // offshore CNH-token units
    chf: number;         // CHF-token units
    goldOz: number;      // PAXG + XAUT total (fine troy ounces)
    paxgOz: number;
    xautOz: number;
    indexGoldOz: number;   // §14.1 — gold LOCKED behind the index Gold weight
    reserveGoldOz: number; // §14.1 — reserve-buffer gold (MARP-rebalanceable)
    circulatingSupply: number;
    // Denominator used for the per-MTQ quotients: circulating supply when > 0
    // (the liability base), else total supply (pure genesis-reserve state).
    basis: "circulating" | "total";
    // What ONE MTQΣ is actually backed by, per asset, in that asset's OWN
    // native unit. No USD aggregation — the assets are individual.
    perMtq: {
      usd: number;      // USD-stablecoin units per MTQΣ
      eur: number;      // EURC units per MTQΣ
      gbp: number;
      jpy: number;
      cny: number;
      chf: number;
      goldOz: number;  // fine troy oz per MTQΣ
      goldGrams: number; // the ANCHOR quote — grams of gold per MTQΣ
    };
    // Live observed NAV shares per component (fractions of V_net, Σ = 1).
    // These are the ACTUAL portfolio weights — distinct from the MASE
    // target/smoothed weights in `weightStates`.
    navShares: { usd: number; eur: number; gbp: number; jpy: number; cny: number; chf: number; gold: number };
  };
  // v1.0: MASE + 4-state weights + MARP
  mase: {
    models: { id: string; name: string; weights: Record<string, number> }[];
    ensembleTarget: Record<string, number>;
    // §7.6 adaptive ensemble — softmax α per family (uniform during cold start)
    adaptive: boolean;
    alphas: Record<string, number>;
    oosScores: Record<string, number>;
    oosSamples: number;
    // §7.4 8-term objective evaluated on the constrained target
    objectiveVersion: string;
    objective: { id: string; name: string; value: number; lambda: number; weighted: number }[];
    objectiveTotal: number;
  } | null;
  weightStates: {
    prior: Record<string, number>;
    target: Record<string, number>;
    smoothed: Record<string, number>;
    execution: Record<string, number>;
  } | null;
  marp: {
    decisions: { shouldTrade: boolean; component: string; direction: string; tradeUsd: number; urgency: number; reason: string; level: number; hierarchy: string; naturalFlowUsd: number; gapUsd: number; residualGapUsd: number; deferredUsd: number; mandate: {
      signedImprovement: number; directionEligible: boolean; grossBenefitUsd: number; costUsd: number; protectionUsd: number; netBenefitUsd: number; thresholdUsd: number; netBenefitEligible: boolean; shadowOnly: true; objectiveVersion: string; protectionModelVersion: string;
    } | null }[];
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
  // AUDIT-FIX P0-3 — which target source drives the ACTIVE execution path
  // ("mase-envelope" once MASE has committed weights; "legacy-buffer" only
  // in pure genesis state). Published for the honest-status disclosures.
  executionTargetSource: 'mase-envelope' | 'legacy-buffer';
  // AUDIT-FIX §10.7 — the MEASURED natural-flow ledger CF_{i,t} per component
  // (net mint/redeem flows since the component's last rebalance trade).
  naturalFlowUsd: { USD: number; EUR: number; JPY: number; GBP: number; CNY: number; CHF: number; Gold: number };
  // AUDIT-FIX EQ-072..075 (§9.4–§9.5) — the attribution decomposition for the
  // most recent index step: per-component contributions (Σ = index return
  // exactly), plus the movement / allocation / rebalancing / cost effects.
  // Null before the first advanceChainIndex step.
  attribution: {
    contributions: { component: string; value: number }[]; // §9.4, canonical order
    indexReturnPct: number;
    movementEffectPct: number;
    allocationEffectPct: number;
    rebalancingEffectPct: number; // always 0 (divisor-neutralized §9.3)
    costEffectUsd: number;        // realized friction (§10.8 Cost_i)
    sampledAt: number;
  } | null;
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
    // === v2.0 §9.3 / COO-17 — base-relative divisor publication ============
    /** P_{i,0} — the immutable per-slot genesis fixings (§3.4) the pinned
     *  base-relative B^± = Σ W × (P_{i,t}/P_{i,0}) basis is anchored to
     *  (Listing 3 _basePrice18 / V3 L1384–1407). null only on states healed
     *  before the basis pinning (disclosed, never fabricated). */
    basePrices: number[] | null;
    /** Bounded per-update D_t/B^± records (§9.3 ChainLinkAdjusted-equivalent,
     *  newest last; MAX_DIVISOR_HISTORY retained of divisorCommitCount). */
    divisorHistory: ChainLinkRecord[];
    /** Total D_t applications since genesis (audits the bounded window). */
    divisorCommitCount: number;
    /** Pinned valuation basis of B^± — "base-relative" (Listing 3/V3);
     *  the superseded "raw-usd" TS basis is disclosed in honest-status. */
    divisorBasis: DivisorBasis;
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
  // AUDIT-FIX RG-11/P1-4: the published target gold weight is the ACTIVE
  // execution target — the MASE envelope output once MASE has run (legacy
  // buffer formula only as the pre-MASE genesis fallback).
  const targetGold = executionTargetGoldWeight(s, rr);

  // === GOLD-ANCHOR: native-unit holdings + per-MTQΣ reserve backing ==========
  // The liability base is the CIRCULATING supply (genesis reserve is locked and
  // carries no redemption obligation). When nothing circulates yet, fall back
  // to total supply so the genesis-reserve tokens still show their backing.
  const circ2 = circulatingSupply(s);
  const perMtqBasis: "circulating" | "total" =
    circ2 > 0 ? "circulating" : s.totalSupply > 0 ? "total" : "circulating";
  const backingDenom = circ2 > 0 ? circ2 : Math.max(s.totalSupply, 1e-9);
  const holdUsdStable = s.usdc + s.usdp + s.usdt;
  const holdGoldOz = s.paxg + s.xaut;
  const perUnit = (qty: number) => qty / backingDenom;
  const TROY_OZ_GRAMS = 31.1034768;
  const holdings: MetricsSnapshot["holdings"] = {
    usdStable: holdUsdStable,
    eur: s.eurc,
    gbp: s.gbp,
    jpy: s.jpy,
    cny: s.cny,
    chf: s.chf,
    goldOz: holdGoldOz,
    paxgOz: s.paxg,
    xautOz: s.xaut,
    indexGoldOz: s.indexPaxg + s.indexXaut,
    reserveGoldOz: (s.reservePaxg >= 0 ? s.reservePaxg : Math.max(0, s.paxg - s.indexPaxg))
      + (s.reserveXaut >= 0 ? s.reserveXaut : Math.max(0, s.xaut - s.indexXaut)),
    circulatingSupply: circ2,
    basis: perMtqBasis,
    perMtq: {
      usd: perUnit(holdUsdStable),
      eur: perUnit(s.eurc),
      gbp: perUnit(s.gbp),
      jpy: perUnit(s.jpy),
      cny: perUnit(s.cny),
      chf: perUnit(s.chf),
      goldOz: perUnit(holdGoldOz),
      goldGrams: perUnit(holdGoldOz) * TROY_OZ_GRAMS,
    },
    navShares: {
      usd: nav > 0 ? vals.usdNet / nav : 0,
      eur: nav > 0 ? vals.eurNet / nav : 0,
      gbp: nav > 0 ? vals.gbpNet / nav : 0,
      jpy: nav > 0 ? vals.jpyNet / nav : 0,
      cny: nav > 0 ? vals.cnyNet / nav : 0,
      chf: nav > 0 ? vals.chfNet / nav : 0,
      gold: observedGold,
    },
  };
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
    oraclePaused: (oracle?.anyFailed || oracle?.anyDegraded) ?? false,
    oracleFailed: oracle?.anyFailed ?? false,
    oracleDegraded: oracle?.anyDegraded ?? false,
    oracleState: oracle?.aggregateState ?? "NORMAL",
    oracleGoldConfidence: oracle?.pairs.find((p) => p.pair === "XAU/USD")?.confidence?.score ?? 1,
    registry,
    concentration,
    reintegration: s.reintegration,
    treasury: s.treasury,
    waterfall: s.waterfall,
    priceEvents: s.priceEvents,
    reconciliation: getReconciliationFindings(s, { usdcUsd: vals.usdcUsd ?? 0, usdpUsd: vals.usdpUsd ?? 0, usdtUsd: vals.usdtUsd ?? 0, paxgUsd: vals.paxgUsd ?? 0, xautUsd: vals.xautUsd ?? 0, nav: vals.nav, eurNet: vals.eurNet }),
    redemptionPolicy: REDEMPTION_POLICY,
    perIssuer: { usdcUsd: vals.usdcUsd ?? 0, usdpUsd: vals.usdpUsd ?? 0, usdtUsd: vals.usdtUsd ?? 0, eurcUsd: vals.eurNet, paxgUsd: vals.paxgUsd ?? 0, xautUsd: vals.xautUsd ?? 0 },
    // GOLD-ANCHOR — live native-unit reserve backing per 1 MTQΣ
    holdings,
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
    // AUDIT-FIX P0-3/§9.5/§10.7 — published audit fields.
    executionTargetSource: executionTargetSource(s),
    naturalFlowUsd: { ...s.naturalFlowUsd },
    attribution: s.lastAttribution
      ? {
          contributions: s.lastAttribution.contributions.map((v, i) => ({
            component: COMPONENTS[i],
            value: v,
          })),
          indexReturnPct: s.lastAttribution.indexReturnPct,
          movementEffectPct: s.lastAttribution.movementEffectPct,
          allocationEffectPct: s.lastAttribution.allocationEffectPct,
          rebalancingEffectPct: s.lastAttribution.rebalancingEffectPct,
          costEffectUsd: s.lastAttribution.costEffectUsd,
          sampledAt: s.lastAttribution.sampledAt,
        }
      : null,
    envelopes: maseData.envelopes,
    // === P0-FIX-1: canonical chain-linked index state ===
    chainIndex: {
      I_t: s.chainIndex.I_t,
      G_t: s.chainIndex.G_t,
      prevWeights: s.chainIndex.prevWeights,
      prevPrices: s.chainIndex.prevPrices,
      baseDenominator: s.chainIndex.baseDenominator,
      lastUpdate: s.chainIndex.lastUpdate,
      // === v2.0 §9.3 / COO-17 — per-update divisor publication (base-relative) ===
      basePrices: s.chainIndex.basePrices ?? null,
      divisorHistory: s.chainIndex.divisorHistory ?? [],
      divisorCommitCount: s.chainIndex.divisorCommitCount ?? 0,
      divisorBasis: s.chainIndex.divisorBasis ?? DIVISOR_BASIS,
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
  mase: NonNullable<MetricsSnapshot["mase"]> & MaseSnapshotRiskExtras;
  weightStates: NonNullable<MetricsSnapshot["weightStates"]>;
  marp: NonNullable<MetricsSnapshot["marp"]>;
  // §14.1 — read-only projection of what MARP WOULD do this tick.
  marpExecution: NonNullable<MetricsSnapshot["marpExecution"]>;
  envelopes: MetricsSnapshot["envelopes"];
}

/** v2.0 §5/§6 risk-estimator extras published on the mase snapshot block
 *  (Task 8-a). The base MetricsSnapshot["mase"] interface lives in the type
 *  region owned by another agent, so these additive extras ride the snapshot
 *  STRUCTURALLY: buildMaseSnapshot attaches them and they flow through
 *  computeSnapshot + JSON to the client unchanged; the UI reads them via this
 *  exported type. Honest layer: every field carries its blueprint §-label. */
export interface MaseSnapshotRiskExtras {
  /** §5.1 σ^MH — the multi-horizon standalone-vol blend that GOVERNED this
   *  snapshot (replaces the former single-window VIX-scaled baseline as the
   *  operative volatility; quadratic-form risk consumes the §6.1/§6.2 Σ_robust
   *  built from the same §5.1 horizon windows — see riskEstimators). */
  blendedVols: VolatilityData;
  /** §5.1/§5.4/§5.5/§6.1/§6.2/§6.8 estimator payload (per-horizon vols + ω
   *  weights, six-regime probabilities + mixture, CrisisScore + λ_CVaR,t,
   *  correlation matrix + shrinkage record + the Σ_robust matrix itself,
   *  GPP formula/proxy label, data-window disclosure, the simulated series
   *  itself). */
  riskEstimators: import("./mase").MaseRiskEstimatorState;
  /** The §7.4 λ vector actually applied — uniform pilot base with the §5.5
   *  regime-scaled λ_CVaR,t = λ_CVaR,0·(1 + k·CrisisScore_t). */
  lambdaVector: Record<string, number>;
  /** §6.6/§6.7 figures on the CONSTRAINED target: VaR_95/CVaR_95 (the level
   *  the engine minimizes), VaR_99/CVaR_99 (the monitored severe level) and
   *  MDD over the disclosed simulated window; null only pre-first-series. */
  tailRisk: import("./mase").MaseRiskFigures | null;
}

/** Estimate the per-component h=30 horizon input σ_{i,30} from the macro
 *  state — the VIX-calibrated short-window volatility that feeds the §5.1
 *  multi-horizon blend. Task 8-a: the blend σ_i^MH = Σ_h ω_h σ_{i,h} over
 *  30/90/252/756-day horizons (blueprint L2455–2462) is derived INSIDE the
 *  mase.ts ensemble path (maseEnsemble/maseEnsembleAdaptive → buildRiskContext)
 *  from a deterministic simulated 756-day series and is what GOVERNS every
 *  downstream risk figure (models, objective, MARP vols); this function now
 *  supplies only the 30-day horizon input (the former single-window
 *  VIX/18.5-scaled baseline). NOT a canonical value. §5.3 z-scores are
 *  untouched (they remain the engine's rolling-90d machinery). */
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
 *  PILOT APPROXIMATION (RG-15 label — equation-by-equation audit, EQ-031/032):
 *  this INVENTED hard 4-state classifier (VIX thresholds <15/<22/<30; DXY
 *  extremes <88/>115) is retained ONLY for STATE-level decisions (stress
 *  tilts inside candidate models, display) per the v2.0 wiring; the §5.4
 *  six-regime PROBABILITY model (p_t softmax + W^Regime mixture) now drives
 *  the regime FAMILY and is implemented in mase.ts (classifySixRegimes). It is
 *  NOT a canonical constant set and must not seed §5.4.
 *  0 = calm, 1 = normal, 2 = stress, 3 = crisis. */
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
  // §5.1 — this supplies the h=30 (30-day, VIX-calibrated) horizon input; the
  // multi-horizon ω_h blend that GOVERNS is derived inside the ensemble path.
  const vols = estimateVolsFromState(s);
  const regime = detectRegime(s.lastVix > 0 ? s.lastVix : fx.VIX, s.lastDxy > 0 ? s.lastDxy : fx.DXY, vols.Gold);

  // §6/§7 — MASE ensemble → six §7.5 families + adaptive §7.6 target.
  // READ-ONLY here: the walk-forward OOS scoring happens in advanceMase()
  // (the mutation point); the snapshot consumes the persisted scores.
  // corr=null ⇒ the §6.1/§6.2 robust matrix (Σ̂ = Σ_h ω_h·Cov_h, then
  // Σ_robust = λF + (1−λ)Σ̂) is derived INSIDE the ensemble from the
  // deterministic simulated series — the same inputs the advanceMase path
  // passes — so both call sites derive identical targets (idempotence).
  const mase = maseEnsembleAdaptive(vols, prices, null, regime, s.maseOos?.scores ?? null);
  // §5.1 GOVERNS: all vol/covariance inputs are multi-horizon — the σ^MH
  // blend supplies every standalone vol (max-div numerator, MARP per-component
  // vols, solver warm starts) and Σ_robust (built from the same ω-blended
  // §5.1 horizon windows) supplies every quadratic form (the §6.3/§6.4/§6.5
  // solvers + the §7.4 Risk term) — nothing consumes the raw single-window
  // VIX/18.5 input directly.
  const blendedVols = mase.blendedVols;
  // §8.1 — Constrain target to per-component admissibility envelopes
  const constrained = applyEnvelopes(mase.target);
  // §7.4 — evaluate the 8-term MASE objective on the constrained target
  // (portfolio-level objective — DISTINCT from the MARP trade-gate J(s),
  // v5.0 Ext-3 OD-31/C-036 separation). v2.0 wiring: Risk = √(w'Σ_robust w)
  // from the §6.1/§6.2 matrix; CVaR = §6.6 historical 95% tail loss over the
  // disclosed simulated window; λ_CVaR,t pre-scaled per §5.5
  // (λ_CVaR,t = λ_CVaR,0·(1 + k·CrisisScore_t)); §6.6/§6.7 figures (VaR/CVaR
  // 95/99 + MDD on the constrained target) returned for publication.
  const objectiveEval = evaluateMaseObjective(constrained, {
    vols: blendedVols,
    corr: mase.riskEstimators.corr,
    // §6.1/§6.2 — the Risk term reads √(w'Σ_robust w) directly from the exact
    // robust matrix (never the (σ^MH, ρ) reconstruction, whose diagonal differs
    // by the horizon-blend Jensen gap — see the shrinkCovariance note in mase.ts).
    sigmaRobust: mase.riskEstimators.sigmaRobust,
    returns: mase.riskEstimators.series.returns,
    prevWeights: s.maseSmoothed ?? (STRATEGIC_PRIOR as WeightVector),
  }, mase.lambdaVector);
  // §8.4 + §8.3 — constitutional stress-adaptive smoothing (ρ 0.50/0.75)
  // with hard per-component velocity caps (uses prev persisted as prior)
  const prevSmoothed = s.maseSmoothed ?? (STRATEGIC_PRIOR as WeightVector);
  const smoothed = smoothWeightsConstitutional(prevSmoothed, constrained, stressLevel(s.riskState.state));
  // §2.3 — Execution = actual observed reserve composition
  const observed = buildObservedWeights(vals, nav);

  // §10 — MARP per-component rebalancing decision. The no-trade band follows
  // §11.8 (θ_base 0.75%) with §11.6's crisis widening (1.5%) selected by the
  // canonical risk state's stress level (≥ 2 = STRESS/DEFENSIVE/EMERGENCY).
  // §5.1 — MARP's per-component volatility inputs are the multi-horizon σ^MH
  // blend (the same figures the candidate models and the §7.4 objective
  // consumed — one governed volatility, everywhere).
  const volsRecord: Record<Component, number> = {
    USD: blendedVols.USD, EUR: blendedVols.EUR, JPY: blendedVols.JPY, GBP: blendedVols.GBP,
    CNY: blendedVols.CNY, CHF: blendedVols.CHF, Gold: blendedVols.Gold,
  };
  const noTradeBand = stressLevel(s.riskState.state) >= 2 ? NO_TRADE_BAND_STRESS : NO_TRADE_BAND_BASE;
  // AUDIT-FIX P1-4/§10.7/§11.4: the decision pipeline now receives the MEASURED
  // natural flows CF_{i,t} (§10.7 Level-1 netting), the FEED-DRIVEN 24h pool
  // depth (PAXG volume via the FX snapshot; labeled $4M fallback in degraded
  // mode), and the direction-lock state (advisory; enforced again at
  // execution).
  const poolDepth = (fx as { xauPoolDepth24hUsd?: number }).xauPoolDepth24hUsd ?? POOL_DEPTH_FALLBACK_USD;
  const marpDecisions: MarpDecision[] = marpDecision(observed, smoothed, nav, rr, volsRecord, {
    noTradeBand,
    naturalFlowUsd: s.naturalFlowUsd,
    poolDepth24hUsd: poolDepth,
    lastTradeDir: s.lastTradeDir,
    lastTradeAt: s.lastTradeAt,
  });
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
  const wouldExecute = marpDecisions.filter((d) => d.shouldTrade && d.level >= MARP_EXECUTE_LEVEL);
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
      adaptive: mase.adaptive,
      alphas: mase.alphas,
      oosScores: s.maseOos?.scores ?? {},
      oosSamples: s.maseOos?.samples ?? 0,
      objectiveVersion: MASE_OBJECTIVE_VERSION,
      objective: objectiveEval.terms.map((t) => ({ id: t.id, name: t.name, value: t.value, lambda: t.lambda, weighted: t.weighted })),
      objectiveTotal: objectiveEval.total,
      // === v2.0 §5/§6 risk-estimator extras (MaseSnapshotRiskExtras) ========
      // §5.1 σ^MH (governs) · §5.4 six-regime + §5.5 CrisisScore/λ_CVaR,t ·
      // §6.1/§6.2 correlation + shrinkage record · §6.8 GPP formula/proxy ·
      // the applied λ vector · §6.6/§6.7 VaR/CVaR 95/99 + MDD on the
      // constrained target (the 99% level published as the §6.6 monitor).
      blendedVols,
      riskEstimators: mase.riskEstimators,
      lambdaVector: mase.lambdaVector,
      tailRisk: objectiveEval.riskFigures,
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
        // v2.0 §10.3 six-level intervention taxonomy (Monitor/Natural flow/
        // Drift/Risk/Structural/Emergency) — published with every decision.
        hierarchy: d.hierarchy,
        // AUDIT-FIX §10.7 — publish the netting audit fields so an auditor can
        // verify CF_{i,t} was measured, not assumed.
        naturalFlowUsd: d.naturalFlowUsd,
        gapUsd: d.gapUsd,
        residualGapUsd: d.residualGapUsd,
        deferredUsd: d.deferredUsd,
        // v5.0 mandate shadow gate — corrected arithmetic + net-benefit record
        // (shadow-only until OD-1/OD-2 Committee approval).
        mandate: d.mandate ?? null,
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
  const mase = maseEnsembleAdaptive(vols, prices, null, regime, s.maseOos?.scores ?? null);
  // §7.6 — WALK-FORWARD OOS UPDATE (the sole mutation point for the score
  // ledger): score the PREVIOUS tick's per-model proposals against the
  // returns that have now materialized, then re-derive this tick's ensemble
  // target from the UPDATED softmax α (weights fixed before returns →
  // leakage-controlled by construction; OOS statistics only, §23.4).
  const modelWeights: Record<string, WeightVector> = Object.fromEntries(
    mase.models.map((m) => [m.id, m.weights]),
  );
  const MODEL_IDS = ["minvar", "erc", "maxdiv", "cvar", "ppp", "institutional", "regime"] as const;
  s.maseOos = updateOosScores(
    s.maseOos ?? { scores: {}, samples: 0, prevModelTargets: null, prevPriceLevels: null },
    [...MODEL_IDS],
    modelWeights,
    prices as unknown as Record<Component, number>,
  );
  const maseUpdated = maseEnsembleAdaptive(vols, prices, null, regime, s.maseOos.scores);
  const constrained = applyEnvelopes(maseUpdated.target);
  const prevSmoothed = s.maseSmoothed ?? (STRATEGIC_PRIOR as WeightVector);
  // §8.4 + §8.3 — constitutional smoothing: ρ selected by stress level
  // (0.50 normal / 0.75 stress) followed by the hard per-component velocity
  // caps (USD/EUR 0.50% · JPY/GBP 0.30% · CNY/CHF 0.20% · Gold 0.50%).
  const sl = stressLevel(s.riskState.state);
  s.maseSmoothed = smoothWeightsConstitutional(prevSmoothed, constrained, sl);
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
// v2.0 §16.3 — deterioration acts IMMEDIATELY; recovery requires SUSTAINED
// evidence (the §16.3 transition table): STRESS→BASE needs RR ≥ 1.10 for 24
// consecutive hours; EMERGENCY→STRESS needs RR ≥ 1.05 for 48h; EMERGENCY→BASE
// needs RR ≥ 1.10 for 48h. The sustained clock resets to zero the moment RR
// falls below the threshold ("consecutive hours").
const BUFFER_STATE_RANK = { BASE: 0, STRESS: 1, EMERGENCY: 2 } as const;
export function updateBufferState(s: ReserveState, rr: number, now = Date.now()) {
  const newState = bufferBaseFromRatio(rr);
  if (newState === s.bufferState) {
    s.bufferRecoverySinceAt = 0; // stable — no pending upgrade
    return;
  }
  const isUpgrade = BUFFER_STATE_RANK[newState] < BUFFER_STATE_RANK[s.bufferState];
  if (!isUpgrade) {
    // Deterioration: immediate (§16.3 — BASE→STRESS ramps over 24h;
    // STRESS→EMERGENCY is the only unramped edge).
    s.bufferRecoverySinceAt = 0;
    if (newState === "EMERGENCY") {
      s.bufferState = "EMERGENCY";
      s.rampStartAt = 0;
    } else {
      s.rampStartAt = now;
      s.rampFromRatio = currentBufferGoldRatio(s);
      s.rampToRatio = newState === "BASE" ? BUFFER_GOLD_BASE : BUFFER_GOLD_STRESS;
      s.bufferState = newState;
    }
    return;
  }
  // Upgrade: sustained-evidence hysteresis (§16.3 table). The target state's
  // threshold and the CURRENT state's duration requirement:
  //   EMERGENCY→STRESS: RR ≥ 1.05 for 48h · EMERGENCY→BASE: RR ≥ 1.10 for 48h
  //   STRESS→BASE:      RR ≥ 1.10 for 24h
  const needRr = newState === "BASE" ? 1.10 : 1.05;
  const needHours = s.bufferState === "EMERGENCY" ? 48 : 24;
  if (rr >= needRr) {
    if (!s.bufferRecoverySinceAt) s.bufferRecoverySinceAt = now;
    if (now - s.bufferRecoverySinceAt >= needHours * 3_600_000) {
      s.rampStartAt = now;
      s.rampFromRatio = currentBufferGoldRatio(s);
      s.rampToRatio = newState === "BASE" ? BUFFER_GOLD_BASE : BUFFER_GOLD_STRESS;
      s.bufferState = newState;
      s.bufferRecoverySinceAt = 0;
    }
  } else {
    s.bufferRecoverySinceAt = 0; // below threshold — consecutive-hours clock resets
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
    // Time-in-band: increases when peg is inside the §21.5.2 ASSET-SPECIFIC
    // band (USDC/EURC ±0.5% · GBP/JPY ±1.0% · CNY ±1.5%); decays when outside.
    const band = pegBandFor(c);
    const inBand = s.pegHealth[c] >= band.lower && s.pegHealth[c] <= band.upper;
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
    // AUDIT-FIX F-9 (EQ-155/156): §21.5.4's REVERSE LADDER is now wired —
    // stricter at every step. Repurchase staging applies ONLY to previously
    // ejected currencies, with per-rung score thresholds AND sustained-hours
    // requirements (REINTEGRATION_STAGE_THRESHOLDS: 0.80/24h → 0.85/48h →
    // 0.90/72h — the reverse ladder, "never by discretion"). The former code
    // advanced stages on a flat 0.80 score with no persistence requirement.
    if (s.ejectStage[c] > 0) {
      const nextStage = r.repurchaseStage; // thresholds index of the NEXT rung (0-based)
      const rung = REINTEGRATION_STAGE_THRESHOLDS[Math.min(nextStage, REINTEGRATION_STAGE_THRESHOLDS.length - 1)];
      if (r.score >= rung.score) {
        // Accumulate SIMULATED sustained hours at/above this rung's threshold.
        r.sustainedHours += dtHours;
        if (r.sustainedHours >= rung.sustainedHours && r.repurchaseStage < REINTEGRATION_REPURCHASE_STAGES.length) {
          r.repurchaseStage = Math.min(3, r.repurchaseStage + 1);
          r.sustainedHours = 0; // re-measure persistence for the next rung
          // As repurchase progresses, reduce eject stage (25% → 50% → 100%
          // cumulative buy-back per REINTEGRATION_REPURCHASE_STAGES).
          if (r.repurchaseStage >= 3) {
            s.ejectStage[c] = Math.max(0, s.ejectStage[c] - 1);
            if (s.ejectStage[c] === 0) r.repurchaseStage = 0;
          }
        }
      } else {
        // Score fell below the current rung's threshold — persistence resets.
        r.sustainedHours = 0;
        if (r.score < REINTEGRATION_THRESHOLD * 0.6) {
          r.repurchaseStage = 0;
        }
      }
    } else {
      r.sustainedHours = 0;
    }
  }
}

// --- §13.2 Treasury Sweep ---------------------------------------------------
// If hot-wallet surplus stablecoins > $10,000 → sweep excess to 4/7 Cold Treasury.
export function maybeTreasurySweep(s: ReserveState, feeRevenueAddedUsd = 0) {
  // Accumulate fee revenue into the hot wallet (operational surplus)
  s.treasury.hotWalletUsd += feeRevenueAddedUsd;
  if (s.treasury.hotWalletUsd > TREASURY_SWEEP_THRESHOLD_USD) {
    // v2.0 §20.3/Listing 12: sweep the excess ABOVE the $10,000 threshold
    // down to the threshold (the former $5,000 operating float kept $5k of
    // surplus unswept, deviating from the published sweep semantics).
    const excess = s.treasury.hotWalletUsd - TREASURY_SWEEP_THRESHOLD_USD;
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
// v2.0 §16.4/Listing 8 — CORE GOLD (layer 5) is protected by the EXHAUSTION
// CERTIFICATE: a 4/7 Multi-Sig governance approval required BEFORE any
// consumption. Without an approved certificate the loss STOPS at layer 4:
// the unabsorbed remainder is recorded in waterfall.pendingCoreGoldUsd and
// consumption stays blocked — core-gold use is a visible governance event,
// never a silent default.
export function applyLoss(
  s: ReserveState,
  vals: { fiatNet: number; goldNet: number },
  lossUsd: number,
  opts?: { exhaustionCertificateApproved?: boolean },
) {
  let remaining = lossUsd;
  const certificateApproved = opts?.exhaustionCertificateApproved ?? s.waterfall.exhaustionCertificateApproved ?? false;
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
    // Layer 5 — Core Gold: GATED behind the 4/7 Exhaustion Certificate (§16.4).
    { name: "coreGold", cap: () => (certificateApproved ? vals.goldNet * 0.20 : 0), consume: (amt: number) => { s.waterfall.consumed.coreGold += amt; } },
  ] as const;
  for (let i = 0; i < layers.length && remaining > 0; i++) {
    const layer = layers[i];
    const cap = layer.cap();
    const consumed = Math.min(cap, remaining);
    layer.consume(consumed);
    remaining -= consumed;
    if (layer.name === "coreGold" && remaining > 0 && !certificateApproved) {
      // Unabsorbed loss pending governance — record and STOP.
      s.waterfall.pendingCoreGoldUsd = (s.waterfall.pendingCoreGoldUsd ?? 0) + remaining;
      if (!s.waterfall.exhaustionCertificateRequiredSince) {
        s.waterfall.exhaustionCertificateRequiredSince = Date.now();
      }
      remaining = 0;
      s.waterfall.currentLayer = 5;
    } else if (remaining > 0) {
      s.waterfall.currentLayer = (i + 2) as 1 | 2 | 3 | 4 | 5;
    }
  }
  if (remaining <= 0 && (s.waterfall.pendingCoreGoldUsd ?? 0) === 0) s.waterfall.currentLayer = 1;
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
  // === Task 8-b: §12.3.3 per-asset-class tolerance wiring ====================
  /** §12.3.3 asset class whose τ produced the bound. */
  assetClass: "STABLECOIN" | "GOLD" | "MINOR_FX";
  /** §12.3.1/§12.3.2 tolerance τ applied for this quote (per-class, two-sided:
   *  selling must fill ≥ oracle×(1−τ_sell); buying must fill ≤ oracle×(1+τ_buy)). */
  tolerance: number;
  /** §11.7 SlippageWarning — the quoted price approached the slippage-guard
   *  boundary (inside the bound, not at par). Pilot heuristic: slip ≥ τ/2.
   *  Emitted as an engine-internal canonical event record (shadow mode). */
  slippageWarning: boolean;
}
export function simulateQuote(
  amountUsd: number,
  isBuyGold: boolean,
  oracleGoldPrice: number,
  assetClass: "STABLECOIN" | "GOLD" | "MINOR_FX" = "GOLD",
): ExecQuote {
  const provider: "1inch" | "Paraswap" = Math.random() < 0.5 ? "1inch" : "Paraswap";
  // §12.3.3 — per-class tolerance (Risk Council 4/7, governed parameter):
  //   STABLECOIN 0.5% · GOLD 1.0% · MINOR_FX 1.5%. "In crisis mode the
  //   tolerances themselves do not widen; instead execution sizes shrink and
  //   liquidity requirements rise (§12.3.3/§14.4)."
  const tau = slippageToleranceFor(assetClass);
  // Realistic small slippage ~0.05%–0.4%
  const slip = 0.0005 + Math.random() * 0.0035;
  const oracleRate = oracleGoldPrice;
  const quoteRate = isBuyGold ? oracleRate * (1 + slip) : oracleRate * (1 - slip);
  const bound = isBuyGold ? oracleRate * (1 + tau) : oracleRate * (1 - tau);
  const withinBound = isBuyGold ? quoteRate <= bound : quoteRate >= bound;
  // §11.7 SlippageWarning — "An executed or quoted price approached the
  // slippage-guard boundary (§11.5.1)"; §12.9: "inside the bound but not at
  // par". The pilot's boundary-approach threshold is slip ≥ τ/2 (labeled
  // heuristic pending Risk-Council calibration).
  const slippageWarning = withinBound && slip >= tau / 2;
  if (slippageWarning) {
    emitEngineEvent(
      "SlippageWarning",
      { tradeType: isBuyGold ? "buy" : "sell", oraclePrice: oracleRate, execPrice: quoteRate, assetClass, tau },
      { source: "quote", blueprint: "§11.7/§12.9 — quote approached the slippage-guard boundary (inside, not at par)" },
    );
  }
  return {
    provider, oracleRate, quoteRate, bound, withinBound,
    effectiveSlippageBps: Math.round(slip * 10_000),
    amountUsd,
    assetClass,
    tolerance: tau,
    slippageWarning,
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
  target: number; // 0.25 warn threshold (soft checkpoint)
  reason: string;
  // AUDIT-FIX F-7 (§15.6.1/§15.6.2 — enforcement + breach surface) ============
  /** The hard issuer cap in force: 30% (constitutional) — relaxed to 35%
   *  ONLY under the §15.6.1 crisis exception (Risk Council 4/7 + 24h timelock;
   *  the pilot maps the crisis posture to the EMERGENCY risk state). */
  hardCap: number;
  /** Issuers still above the hard cap AFTER optimization (e.g. Circle pinned
   *  by the EURC single-issuer floor). Non-empty ⇒ BREACH: mint routing is
   *  blocked for those issuers (applyMint) and the finding escalates to the
   *  honest-status disclosures. "Any trade that would breach 30% is blocked
   *  outright" — the optimizer reduces what it can and REPORTS the rest. */
  breachIssuers: { issuer: string; share: number }[];
  /** §15.6.2 per-instrument C_max check: single-token shares of NAV. The
   *  per-instrument maximum is the same published hard cap (30%; 35% in
   *  crisis) — no single reserve instrument may exceed it. */
  instrumentShares: { token: string; share: number; overCap: boolean }[];
}

export function rebalanceForConcentration(
  s: ReserveState,
  vals: { usdcUsd: number; usdpUsd: number; usdtUsd: number; paxgUsd: number; xautUsd: number; nav: number; eurNet: number },
): ConcentrationFixResult {
  const nav = vals.nav;
  const TARGET = CONCENTRATION_WARN_PCT; // 25% soft checkpoint (§15.6.1)
  // AUDIT-FIX F-7: the hard block is 30% (§15.6.1, constitutional); the 35%
  // crisis exception applies ONLY in the EMERGENCY risk state (the pilot's
  // mapping of the Risk-Council 4/7 + 24h-timelock crisis posture).
  const crisis = s.riskState.state === "EMERGENCY";
  const HARD_CAP = crisis ? CONCENTRATION_CRISIS_LIMIT_PCT : CONCENTRATION_LIMIT_PCT;
  const usdNetFactor = 1 - HAIRCUTS.USD;
  const goldNetFactor = 1 - ((HAIRCUTS.PAXG + HAIRCUTS.XAUT) / 2); // blended gold haircut

  const sharesBefore = {
    CIRCLE: nav > 0 ? (vals.usdcUsd + vals.eurNet) / nav : 0,
    PAXOS: nav > 0 ? (vals.usdpUsd + vals.paxgUsd) / nav : 0,
    TETHER: nav > 0 ? (vals.usdtUsd + vals.xautUsd) / nav : 0,
  };
  const maxBefore = Math.max(sharesBefore.CIRCLE, sharesBefore.PAXOS, sharesBefore.TETHER);

  const instrumentSharesBefore = nav > 0 ? [
    { token: "USDC", share: vals.usdcUsd / nav, overCap: false },
    { token: "USDP", share: vals.usdpUsd / nav, overCap: false },
    { token: "USDT", share: vals.usdtUsd / nav, overCap: false },
    { token: "EURC", share: vals.eurNet / nav, overCap: false },
    { token: "PAXG", share: vals.paxgUsd / nav, overCap: false },
    { token: "XAUT", share: vals.xautUsd / nav, overCap: false },
  ] : [];

  if (nav <= 0) {
    return { adjusted: false, sharesBefore, sharesAfter: sharesBefore, splits: { usdc: s.usdc, usdp: s.usdp, usdt: s.usdt, paxg: s.paxg, xaut: s.xaut }, target: TARGET, reason: "NAV ≤ 0", hardCap: HARD_CAP, breachIssuers: [], instrumentShares: instrumentSharesBefore };
  }
  if (maxBefore <= TARGET) {
    // §15.6.2 per-instrument check still runs (a single token can breach even
    // when all issuers are within the warn threshold — e.g. a EURC-only leg).
    const instrumentShares = instrumentSharesBefore.map((i) => ({ ...i, overCap: i.share > HARD_CAP }));
    return { adjusted: false, sharesBefore, sharesAfter: sharesBefore, splits: { usdc: s.usdc, usdp: s.usdp, usdt: s.usdt, paxg: s.paxg, xaut: s.xaut }, target: TARGET, reason: "All 3 issuers ≤ 25% warn threshold", hardCap: HARD_CAP, breachIssuers: [], instrumentShares };
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
  // AUDIT-FIX F-7: breach detection — issuers still above the HARD CAP after
  // the optimizer did everything it can. Mint routing is blocked for these
  // issuers (applyMint) and the breach is published on every snapshot + in
  // the honest-status disclosures. (Circle is the known case: the EURC
  // single-issuer floor pins it near the cap until a 2nd EUR issuer exists.)
  const breachIssuers: { issuer: string; share: number }[] = [];
  if (sharesAfter.CIRCLE > HARD_CAP) breachIssuers.push({ issuer: "CIRCLE", share: sharesAfter.CIRCLE });
  if (sharesAfter.PAXOS > HARD_CAP) breachIssuers.push({ issuer: "PAXOS", share: sharesAfter.PAXOS });
  if (sharesAfter.TETHER > HARD_CAP) breachIssuers.push({ issuer: "TETHER", share: sharesAfter.TETHER });

  // §15.6.2 per-instrument C_max — check every instrument against the hard cap.
  const instrumentShares = [
    { token: "USDC", share: usdcGross * usdNetFactor / nav, overCap: false },
    { token: "USDP", share: usdpGross * usdNetFactor / nav, overCap: false },
    { token: "USDT", share: usdtGross * usdNetFactor / nav, overCap: false },
    { token: "EURC", share: vals.eurNet / nav, overCap: false },
    { token: "PAXG", share: paxgGross * goldNetFactor / nav, overCap: false },
    { token: "XAUT", share: xautGross * goldNetFactor / nav, overCap: false },
  ].map((i) => ({ ...i, overCap: i.share > HARD_CAP }));

  return {
    adjusted: true,
    sharesBefore, sharesAfter,
    splits: { usdc: usdcGross, usdp: usdpGross, usdt: usdtGross, paxg: paxgGross, xaut: xautGross },
    target: TARGET,
    reason: maxAfter <= TARGET
      ? "Multi-issuer split: all 3 issuers ≤ 25% warn threshold"
      : `Optimized: max issuer ${(maxAfter * 100).toFixed(1)}% (Circle EURC floor limits further reduction)`,
    hardCap: HARD_CAP,
    breachIssuers,
    instrumentShares,
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
        "Blueprint §15.2 honestly states 'Designed for Sharia review (independent scholarly review required).' No independent Sharia review has been completed. The v1.2 removed the 'Automatic full Sharia compliance' claim.",
      resolution: "Independent scholarly review required before any Sharia-compliance claim. The UI displays the honest status.",
    },
  ];
}
