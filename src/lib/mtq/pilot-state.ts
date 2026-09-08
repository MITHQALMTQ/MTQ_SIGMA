// MTQΣ — In-Process Pilot State (singleton) — v2 (full blueprint coverage)
//
// Runs the live monetary engine inside the persistent Next.js server process.
// A globalThis-guarded singleton holds the canonical ReserveState + FX snapshot.
// A 4s interval advances:
//   §6 macro signals, §9 oracle consensus, §5 registry peg health,
//   §11 eject ladder + §11.3 reintegration score, §7 rebalance, §8 buffer,
//   §3.6 price events, §13.2 treasury sweep.
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
  updatePegHealth,
  updateBufferState,
  advanceMacro,
  advanceMase,
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
} from "./engine";
import { fetchFxSnapshot, type FxSnapshot } from "./fx";
import { buildOracleBoard, oracleFxRates, type OracleBoard } from "./oracle";
import { genesisRegistry, type AssetRecord } from "./registry";

const TICK_MS = 4000;
const SIM_TICK_HOURS = 0.25; // each tick simulates ~15 min of macro time
const STATE_SCHEMA_VERSION = 8; // bump when ReserveState shape changes → singleton rebuilds (v8: maseSmoothed + maseLastAt added per Master Blueprint v1.0 — MASE ensemble + 4-state weights + MARP)

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
  // §6 macro signals (honest stochastic walk)
  const stepped = stepMacroSignals({ vix: store.fx.VIX, dxy: store.fx.DXY });
  store.fx = { ...store.fx, VIX: stepped.vix, DXY: stepped.dxy };
  advanceMacro(store.state, stepped.vix, stepped.dxy, SIM_TICK_HOURS);
  // v1.0: advance MASE 4-state smoothed weights once per tick (after advanceMacro
  // so lastVix/lastDxy are fresh, before the first computeSnapshot so the
  // snapshot reads the freshly-persisted smoothed weights as the EMA prior).
  advanceMase(store.state, store.fx);
  // §5/§11 peg health + eject ladder
  updatePegHealth(store.state, SIM_TICK_HOURS, store.fx);
  // §11.3 reintegration score
  updateReintegration(store.state, store.oracle, SIM_TICK_HOURS);
  // §3.6 price events (0.5% threshold)
  maybePriceEvent(store.state, store.state.lastVix > 0 ? computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry }).mtqPrice : 1);
  // §7 rebalance (skip if oracle paused — §9.3 requires pause on <2 valid feeds)
  const snap0 = computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry });
  if (!store.oracle.anyPaused && !snap0.priceInBand === false) {
    const decision = evaluateRebalance(
      store.state,
      { nav: snap0.nav, goldNet: snap0.reserve.goldNet, fiatNet: snap0.reserve.fiatNet },
      snap0.reserveRatio,
    );
    if (decision.shouldRebalance) {
      applyRebalanceTrade(store.state, decision, store.fx.XAU_USD);
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
  // §13.2 treasury sweep (no fee revenue this tick; fee revenue added on trial)
  maybeTreasurySweep(store.state, 0);
  store.state.updatedAt = Date.now();
  store.tickCount += 1;
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
