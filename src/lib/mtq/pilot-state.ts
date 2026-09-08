// MTQΣ — In-Process Pilot State (singleton) — v2 (full blueprint coverage)
//
// Runs the live monetary engine inside the persistent Next.js server process.
// A globalThis-guarded singleton holds the canonical ReserveState + FX snapshot.
// A 4s interval advances:
//   §6 macro signals, §9 oracle consensus, §5 registry peg health,
//   §11 eject ladder + §11.3 reintegration score, §7 rebalance, §8 buffer,
//   §3.6 price events, §13.2 treasury sweep.
//
// P0-FIX (Master Reconciliation): the tick loop now also advances:
//   - chain-linked index (advanceChainIndex every tick — §9.2 COO-16)
//   - canonical 6-state risk machine (advanceRiskState every tick — §21.2)
//     These two are persisted in s.chainIndex and s.riskState respectively
//     so the chain-link continuity (G_t) and the RECOVERY 48h hysteresis
//     survive across ticks.
//
// Why in-process: the sandbox reaps separately-spawned processes at the end of
// the tool call that launched them. The Next.js dev server is the one managed,
// persistent process — so the engine lives here for reliability.

import {
  initReserveState,
  computeSnapshot,
  applyMint,
  applyRedeem,
  evaluateRebalance,
  applyRebalanceTrade,
  applyMarpRebalance,
  updatePegHealth,
  updateBufferState,
  advanceMacro,
  advanceMase,
  advanceChainIndex,
  advanceRiskState,
  stepMacroSignals,
  updateReintegration,
  maybeTreasurySweep,
  maybePriceEvent,
  rebalanceForConcentration,
  reserveAssetValues,
  type ReserveState,
  type MetricsSnapshot,
  type MintResult,
  type RedeemResult,
  type RebalanceDecision,
  type MarpExecDecision,
} from "./engine";
import { fetchFxSnapshot, type FxSnapshot } from "./fx";
import { buildOracleBoard, oracleFxRates, type OracleBoard } from "./oracle";
import { genesisRegistry, type AssetRecord } from "./registry";
import {
  persistDailyStateVector,
  persistRebalancingDecision,
  persistOracleSamples,
  persistMarpDecisions,
  pruneAuditTrail,
} from "./audit-trail";

const TICK_MS = 4000;
const SIM_TICK_HOURS = 0.25; // each tick simulates ~15 min of macro time
// bump when ReserveState / PilotStore shape changes → singleton rebuilds.
// v9:  added `lastDailyVectorAt` + `lastOracleSampleAt` for Chapter 24 audit-trail
//   persistence throttling (DailyStateVector / RebalancingDecision / OracleSample).
// v10: §14.1 — added `indexPaxg` / `indexXaut` / `reservePaxg` / `reserveXaut` /
//   `rebalancePath` to ReserveState (constitutional separation of index gold
//   from reserve buffer gold + feature-flagged MARP execution path).
// v11: P0-FIX-1 + P0-FIX-3 — added `chainIndex` (canonical chain-linked index
//   state per §9.2 COO-16: I_t, G_t, prevWeights, prevPrices, baseDenominator)
//   and `riskState` (canonical 6-state risk machine per §21.2: state,
//   enteredAt, confirmationPeriodEnds for RECOVERY 48h hysteresis). The tick
//   loop now advances both every tick.
// v12: live VIX/DXY — don't overwrite live Yahoo values with stepMacroSignals
// v13: AUDIT-RETENTION — added `lastMarpAdvisoryAt` (throttle MARP advisory
//   persistence to 60s, was 4s — was writing 7 rows/tick → 85,984 rows in 67min)
//   and `lastPruneAt` (cap audit-trail row counts via pruneAuditTrail every
//   300s — RebalancingDecision ≤10k, DailyStateVector ≤5k, OracleSample ≤5k).
const STATE_SCHEMA_VERSION = 13;
// §14.1 MARP execution feature flag — toggle to switch the rebalance execution
// path. Default false (legacy §7 single-direction) for pilot stability; the
// MARP per-component path is the v1.0 production target. The UI renders an
// A/B badge so the pilot can compare both paths side-by-side. Flip to `true`
// to activate the per-component MARP execution path.
const USE_MARP_EXECUTION = false;
// AUDIT-RETENTION: prune the audit-trail tables at most every 5 minutes.
// Calling pruneAuditTrail on every tick would lock the DB for ~ms every 4s;
// 5min is well below the time it takes the tables to grow past their caps
// post-prune (even at 7 rows/tick × 75 ticks = 525 rows between prunes for
// RebalancingDecision — well under the 10k cap).
const AUDIT_PRUNE_INTERVAL_MS = 300_000;

interface PilotStore {
  state: ReserveState;
  fx: FxSnapshot;
  oracle: OracleBoard;
  registry: AssetRecord[];
  ready: boolean;
  schemaVersion: number;
  interval: NodeJS.Timeout | null;
  startedAt: number;
  tickCount: number;
  // Chapter 24 audit-trail throttle timestamps (epoch ms). 0 = never persisted.
  // Reset to 0 on schema rebuild so the first post-rebuild tick writes a row.
  lastDailyVectorAt: number;
  lastOracleSampleAt: number;
  // v13 AUDIT-RETENTION: throttle MARP advisory persistence to 60s (was 4s —
  // was writing 7 rows/tick → 85,984 rows in 67min). 0 = never persisted.
  lastMarpAdvisoryAt: number;
  // v13 AUDIT-RETENTION: timestamp of the last pruneAuditTrail() call.
  // 0 = never pruned. pruneAuditTrail() is called once every 5 min from the
  // tick loop (caps RebalancingDecision ≤10k, DailyStateVector ≤5k, OracleSample ≤5k).
  lastPruneAt: number;
}

declare global {
  var __MTQ_PILOT__: PilotStore | undefined;
}

async function ensureStore(): Promise<PilotStore> {
  // If a previous store exists with an out-of-date schema, tear down its interval
  // (its tick closure references stale module code) before rebuilding.
  const prev = globalThis.__MTQ_PILOT__;
  if (prev && prev.schemaVersion !== STATE_SCHEMA_VERSION) {
    if (prev.interval) clearInterval(prev.interval);
    prev.ready = false;
  }
  if (globalThis.__MTQ_PILOT__ && globalThis.__MTQ_PILOT__.ready && globalThis.__MTQ_PILOT__.schemaVersion === STATE_SCHEMA_VERSION) {
    return globalThis.__MTQ_PILOT__;
  }
  const fx = await fetchFxSnapshot(true);
  const state = initReserveState(fx.XAU_USD);
  // v1.0: prime MASE smoothed weights at genesis so the first snapshot has a
  // non-null prev-smoothed for the EMA. Without this the very first snapshot
  // would fall back to STRATEGIC_PRIOR and the smoothed weights would jump
  // one tick earlier than intended.
  advanceMase(state, fx);
  const registry = genesisRegistry();
  const oracle = buildOracleBoard({
    EUR_USD: fx.EUR_USD, GBP_USD: fx.GBP_USD, JPY_USD: fx.JPY_USD, CNY_USD: fx.CNY_USD, XAU_USD: fx.XAU_USD,
  });
  const store: PilotStore = {
    state,
    fx,
    oracle,
    registry,
    ready: true,
    schemaVersion: STATE_SCHEMA_VERSION,
    interval: null,
    startedAt: Date.now(),
    tickCount: 0,
    lastDailyVectorAt: 0,
    lastOracleSampleAt: 0,
    lastMarpAdvisoryAt: 0,
    lastPruneAt: 0,
  };
  globalThis.__MTQ_PILOT__ = store;
  startLoop(store);
  return store;
}

function startLoop(store: PilotStore) {
  if (store.interval) return;
  store.interval = setInterval(async () => {
    try {
      await tick(store);
    } catch (e) {
      console.error("[mtq-pilot] tick error:", e);
    }
  }, TICK_MS);
  store.interval.unref?.();
}

async function tick(store: PilotStore) {
  // §9 oracle: refresh FX then build the consensus board
  store.fx = await fetchFxSnapshot(false);
  store.oracle = buildOracleBoard({
    EUR_USD: store.fx.EUR_USD, GBP_USD: store.fx.GBP_USD, JPY_USD: store.fx.JPY_USD, CNY_USD: store.fx.CNY_USD, XAU_USD: store.fx.XAU_USD,
  });
  // If oracle paused (<2 valid feeds for any pair), use validated FX from oracle; else use raw
  if (!store.oracle.anyPaused) {
    const ofx = oracleFxRates(store.oracle);
    store.fx = { ...store.fx, ...ofx };
  }
  // §6 macro signals — HONEST: only step the signals that are NOT live.
  // If fetchFxSnapshot returned live VIX/DXY (from Yahoo Finance), USE THEM
  // DIRECTLY — never overwrite real market data with a stochastic walk.
  // If the live fetch failed (fallback to simulatedDxy/simulatedVix), THEN
  // apply stepMacroSignals to add tick-level movement for the §6 macro engine
  // (the fetchFxSnapshot OU walk is deterministic per UTC day, so it doesn't
  // move within a day — stepMacroSignals adds the intra-day tick movement).
  const liveVix = store.fx.liveVix === true;
  const liveDxy = store.fx.liveDxy === true;
  let vixForEngine = store.fx.VIX;
  let dxyForEngine = store.fx.DXY;
  if (!liveVix || !liveDxy) {
    const stepped = stepMacroSignals({ vix: store.fx.VIX, dxy: store.fx.DXY });
    if (!liveVix) vixForEngine = stepped.vix;
    if (!liveDxy) dxyForEngine = stepped.dxy;
    store.fx = {
      ...store.fx,
      ...(liveVix ? {} : { VIX: vixForEngine }),
      ...(liveDxy ? {} : { DXY: dxyForEngine }),
    };
  }
  advanceMacro(store.state, vixForEngine, dxyForEngine, SIM_TICK_HOURS);
  // P0-FIX-1: advance the canonical chain-linked index ONE step with the
  // latest FX/gold prices (§9.2 COO-16). This MUST happen BEFORE advanceMase
  // (which calls commitChainIndexWeights internally to commit any new
  // MASE smoothed weights — preserving zero-artificial-return continuity)
  // and BEFORE the first computeSnapshot (so the snapshot reads the fresh
  // I_t as the MTQ price).
  try {
    advanceChainIndex(store.state, store.fx);
  } catch (e) {
    console.error('[mtq-pilot] chain index advance error:', e);
  }
  // v1.0: advance MASE 4-state smoothed weights once per tick (after advanceMacro
  // so lastVix/lastDxy are fresh, before the first computeSnapshot so the
  // snapshot reads the freshly-persisted smoothed weights as the EMA prior).
  // P0-FIX-1: advanceMase now also commits the new smoothed weights to the
  // chain index (via commitChainIndexWeights) — this updates G_t (the
  // cumulative chain-link factor) and prevWeights / prevPrices.
  advanceMase(store.state, store.fx);
  // §5/§11 peg health + eject ladder
  updatePegHealth(store.state, SIM_TICK_HOURS, store.fx);
  // §11.3 reintegration score
  updateReintegration(store.state, store.oracle, SIM_TICK_HOURS);
  // §3.6 price events (0.5% threshold)
  maybePriceEvent(store.state, store.state.lastVix > 0 ? computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry }).mtqPrice : 1);
  // §7 rebalance (skip if oracle paused — §9.3 requires pause on <2 valid feeds)
  const snap0 = computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry });
  // Stash the (decision + pre/post-trade state) so the §24.2 audit row is
  // written AFTER the tickCount increment — keeps all audit rows on the same
  // tickCount value. `null` when no rebalance was evaluated this tick (oracle
  // paused OR price outside band → no decision was made → nothing to log).
  let rebalanceAudit:
    | {
        decision: RebalanceDecision;
        navUsd: number;
        reserveRatio: number;
        observedGoldWeight: number;
        targetGoldWeight: number;
        deviationPct: number;
        applied: boolean;
        postTrade?: {
          preGoldNet: number;
          postGoldNet: number;
          preFiatNet: number;
          postFiatNet: number;
          postReserveRatio: number;
          postObservedGoldWeight: number;
        };
      }
    | null = null;
  // §14.1 — feature flag: choose between legacy §7 and new MARP execution path.
  // Sets `store.state.rebalancePath` so the snapshot (and the UI A/B badge)
  // reflect the active path. Idempotent per tick — the value only changes if
  // USE_MARP_EXECUTION is recompiled (which triggers a singleton rebuild).
  store.state.rebalancePath = USE_MARP_EXECUTION ? 'marp' : 'legacy';
  if (USE_MARP_EXECUTION) {
    // §14.1 + §10 MARP per-component execution (v1.0 production target).
    // Index gold (s.indexPaxg + s.indexXaut) is LOCKED — only reserve gold
    // (s.reservePaxg + s.reserveXaut) and the fiat pools are MARP-rebalanced.
    // Apply inside try/catch so a MARP failure doesn't break the tick loop.
    if (!store.oracle.anyPaused && snap0.priceInBand) {
      try {
        // Map the snapshot's trimmed marp.decisions to MarpExecDecision[]
        // (applyMarpRebalance accepts the trimmed format).
        const marpDecisions: MarpExecDecision[] = (snap0.marp?.decisions ?? []).map((d) => ({
          shouldTrade: d.shouldTrade,
          component: d.component,
          direction: d.direction,
          tradeUsd: d.tradeUsd,
          level: d.level,
        }));
        const result = applyMarpRebalance(store.state, store.fx, marpDecisions);
        if (result.appliedCount > 0) {
          console.log(
            `[mtq-pilot] MARP execution: ${result.appliedCount} applied, ` +
            `${result.skippedCount} skipped, $${result.totalTradeUsd.toFixed(0)} total`,
          );
        }
      } catch (e) {
        console.error('[mtq-pilot] MARP execution error:', e);
      }
    }
  } else if (!store.oracle.anyPaused && !snap0.priceInBand === false) {
    const decision = evaluateRebalance(
      store.state,
      { nav: snap0.nav, goldNet: snap0.reserve.goldNet, fiatNet: snap0.reserve.fiatNet },
      snap0.reserveRatio,
    );
    const preGoldNet = snap0.reserve.goldNet;
    const preFiatNet = snap0.reserve.fiatNet;
    if (decision.shouldRebalance) {
      applyRebalanceTrade(store.state, decision, store.fx.XAU_USD);
      // Recompute post-trade snapshot for the audit-trail row.
      const snapPost = computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry });
      rebalanceAudit = {
        decision,
        navUsd: snap0.nav,
        reserveRatio: snap0.reserveRatio,
        observedGoldWeight: snap0.observedGoldWeight,
        targetGoldWeight: snap0.targetGoldWeight,
        deviationPct: Math.abs(decision.deviation) * 100,
        applied: true,
        postTrade: {
          preGoldNet,
          postGoldNet: snapPost.reserve.goldNet,
          preFiatNet,
          postFiatNet: snapPost.reserve.fiatNet,
          postReserveRatio: snapPost.reserveRatio,
          postObservedGoldWeight: snapPost.observedGoldWeight,
        },
      };
    } else {
      // Decision evaluated, but no trade executed — still log it (§24.2
      // requires every rebalance decision, including the "no" ones).
      rebalanceAudit = {
        decision,
        navUsd: snap0.nav,
        reserveRatio: snap0.reserveRatio,
        observedGoldWeight: snap0.observedGoldWeight,
        targetGoldWeight: snap0.targetGoldWeight,
        deviationPct: Math.abs(decision.deviation) * 100,
        applied: false,
      };
    }
  }
  // §8 buffer state
  updateBufferState(store.state, snap0.reserveRatio);
  // FIX: §5.6 concentration rebalancing — multi-issuer optimizer (Circle/Paxos/Tether)
  const vals = reserveAssetValues(store.state, store.fx);
  rebalanceForConcentration(store.state, {
    usdcUsd: vals.usdcUsd ?? 0,
    usdpUsd: vals.usdpUsd ?? 0,
    usdtUsd: vals.usdtUsd ?? 0,
    paxgUsd: vals.paxgUsd ?? 0,
    xautUsd: vals.xautUsd ?? 0,
    nav: vals.nav,
    eurNet: vals.eurNet,
  });
  // P0-FIX-3: advance the canonical 6-state risk machine (§21.2). Called
  // AFTER the rebalance + concentration optimizer so the new state reflects
  // the post-tick RR/LCR (the rebalance may have moved gold ↔ USD, changing
  // the reserve ratio). This persists hysteresis (the RECOVERY 48h
  // confirmation window) in s.riskState; the next computeSnapshot reads
  // s.riskState.state as the canonical status.
  try {
    const postVals = reserveAssetValues(store.state, store.fx);
    const postNav = postVals.nav;
    const postPrice = postNav > 0 ? store.state.chainIndex.I_t : 1;
    const postLiability = Math.max(0, (store.state.totalSupply - store.state.genesisReserve) * postPrice);
    const postRr = postLiability > 0 ? postNav / postLiability : Infinity;
    const postLcr = postLiability > 0
      ? postVals.fiatNet / (postLiability * 0.25)
      : Infinity;
    advanceRiskState(store.state, postRr, postLcr, Date.now());
  } catch (e) {
    console.error('[mtq-pilot] risk state advance error:', e);
  }
  // §13.2 treasury sweep (no fee revenue this tick; fee revenue added on trial)
  maybeTreasurySweep(store.state, 0);
  store.state.updatedAt = Date.now();
  store.tickCount += 1;

  // --- Chapter 24 audit-trail persistence (logging-only; never breaks tick) ---
  // §24.2 — RebalancingDecision (every evaluated decision, applied or not).
  if (rebalanceAudit) {
    try {
      await persistRebalancingDecision(
        store.tickCount,
        rebalanceAudit.decision,
        rebalanceAudit.navUsd,
        rebalanceAudit.reserveRatio,
        rebalanceAudit.observedGoldWeight,
        rebalanceAudit.targetGoldWeight,
        rebalanceAudit.deviationPct,
        rebalanceAudit.applied,
        rebalanceAudit.postTrade,
      );
    } catch (e) {
      console.error("[audit-trail] persistRebalancingDecision:", e);
    }
  }
  // §24.1 — DailyStateVector (throttled 30s; final post-tick snapshot).
  try {
    const finalSnap = computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry });
    store.lastDailyVectorAt = await persistDailyStateVector(finalSnap, store.tickCount, store.lastDailyVectorAt);
    // §10 + §24.2 — MARP per-component decisions (advisory rows; only when
    // the snapshot actually has a marp block — true once advanceMase has run).
    // v13 AUDIT-RETENTION: throttled to 60s (was 4s — was writing 7 rows/tick).
    try {
      store.lastMarpAdvisoryAt = await persistMarpDecisions(
        store.tickCount,
        finalSnap,
        store.lastMarpAdvisoryAt,
      );
    } catch (e) {
      console.error("[audit-trail] persistMarpDecisions:", e);
    }
  } catch (e) {
    console.error("[audit-trail] persistDailyStateVector:", e);
  }
  // §24.3 — OracleSample (throttled 30s; one row per pair, batched in a tx).
  try {
    store.lastOracleSampleAt = await persistOracleSamples(store.oracle, store.tickCount, store.lastOracleSampleAt);
  } catch (e) {
    console.error("[audit-trail] persistOracleSamples:", e);
  }
  // v13 AUDIT-RETENTION — prune the audit-trail tables once every 5 min.
  // Caps RebalancingDecision ≤10k, DailyStateVector ≤5k, OracleSample ≤5k.
  // Skipped on the very first tick (lastPruneAt = 0 → runs prune immediately
  // so any pre-existing overflow from a prior version is cleaned up before
  // we accumulate more rows).
  try {
    const nowMs = Date.now();
    if (nowMs - store.lastPruneAt > AUDIT_PRUNE_INTERVAL_MS) {
      const pruned = await pruneAuditTrail();
      store.lastPruneAt = nowMs;
      if (pruned.rebalancingDecision || pruned.dailyStateVector || pruned.oracleSample) {
        console.log(
          `[audit-trail] prune: deleted ` +
          `RebalancingDecision=${pruned.rebalancingDecision}, ` +
          `DailyStateVector=${pruned.dailyStateVector}, ` +
          `OracleSample=${pruned.oracleSample}`,
        );
      }
    }
  } catch (e) {
    console.error("[audit-trail] pruneAuditTrail:", e);
  }
}

export async function getSnapshot(): Promise<MetricsSnapshot> {
  const store = await ensureStore();
  return computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry });
}

export async function getOracle(): Promise<OracleBoard> {
  const store = await ensureStore();
  return store.oracle;
}

export async function getRegistry(): Promise<AssetRecord[]> {
  const store = await ensureStore();
  return store.registry;
}

export interface TrialReq {
  type: "MINT" | "REDEEM";
  amount: number;
  chain?: string;
  wallet?: string;
}

export interface TrialResp {
  ok: boolean;
  mint?: MintResult;
  redeem?: RedeemResult;
  snapshot: MetricsSnapshot;
  error?: string;
}

export async function applyTrial(req: TrialReq): Promise<TrialResp> {
  const store = await ensureStore();
  // §9.3: if oracle paused, minting is blocked
  if (store.oracle.anyPaused && req.type === "MINT") {
    return { ok: false, snapshot: getSnapshotSync(store), error: "Oracle consensus paused (<2 valid feeds). Minting suspended per §9.3." };
  }
  const snap = computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry });
  if (req.type === "MINT") {
    if (!(req.amount > 0)) return { ok: false, snapshot: snap, error: "Invalid amount" };
    const res = applyMint(store.state, store.fx, snap.status, req.amount);
    // Fee revenue → §13.2 treasury sweep
    maybeTreasurySweep(store.state, res.ok ? res.feeUsd : 0);
    return { ok: res.ok, mint: res, snapshot: computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry }), error: res.reason };
  } else {
    if (!(req.amount > 0)) return { ok: false, snapshot: snap, error: "Invalid amount" };
    const res = applyRedeem(store.state, store.fx, snap.status, req.amount);
    maybeTreasurySweep(store.state, res.ok ? res.feeUsd : 0);
    return { ok: res.ok, redeem: res, snapshot: computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry }), error: res.reason };
  }
}

function getSnapshotSync(store: PilotStore): MetricsSnapshot {
  return computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry });
}

export async function getFx(): Promise<FxSnapshot> {
  return fetchFxSnapshot(false);
}

export function isReady(): boolean {
  return !!globalThis.__MTQ_PILOT__?.ready;
}
