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
  // AUDIT-FIX F-10 (DRY on the EQ-136 identity): the tick loop previously
  // re-implemented L/RR/LCR inline; it now uses the canonical engine helpers.
  computeReserveRatio,
  computeLiability,
  computeLcr,
  getMtqPriceFromState,
  type ReserveState,
  type MetricsSnapshot,
  type MintResult,
  type RedeemResult,
  type RebalanceDecision,
  type MarpExecDecision,
  type MintGuardOpts,
  type RedeemGuardOpts,
} from "./engine";
import { fetchFxSnapshot, type FxSnapshot } from "./fx";
import { STRATEGIC_PRIOR } from "./blueprint";
import type { WeightVector } from "./mase";
import {
  buildOracleBoard,
  fetchOnChainOraclePrices,
  oracleFxRates,
  type OnChainOraclePrices,
  type OracleBoard,
} from "./oracle";
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
// v14: WIRING-1 — added `totalStabilityPoolUsd` / `stabilityPoolUsedUsd` to
//   ReserveState (§11.5 stability pool wiring). The tick loop now (a) reads
//   on-chain oracle adapter prices via `fetchOnChainOraclePrices` for each
//   pair and passes them to `buildOracleBoard` (replacing the synthetic
//   witness path when the V3 contract is deployed), and (b) detects EMERGENCY
//   state + non-empty stability pool and triggers deficit coverage (mirrors
//   the V3 contract's `useStabilityPoolForDeficit` keeper call).
const STATE_SCHEMA_VERSION = 18;
// v17→18 (16-fix-C): comment-only probe bump — retires the v17 store so the
//   concurrent-boot single-flight test below runs against the real rebuild
//   path (stale store + parallel first requests). No state-shape change.
// v17 (FIX 16d-001/16d-002/16d-003 — data-integrity pass, 2026-10-23):
//   - The §24.2/§24.4 hash chain is now CANONICAL (audit-trail.ts v2.1):
//     numeric payload leaves are canonicalized to 15 significant digits
//     before hashing and the same canonical values are written to the hashed
//     columns — rows verify EXACTLY from stored data (v2.0 hashed raw
//     in-memory doubles, which the Prisma→SQLite wire path rounds to ~16
//     digits, so 95.6%/99.2% of rows failed recomputation).
//   - MARP advisory rows are threaded onto the same RebalancingDecision
//     chain (no more NULL-hash rows / genesis resets).
//   - ensureStore is now SINGLE-FLIGHT (a globalThis in-flight promise set
//     synchronously before any await) — concurrent first requests can no
//     longer each construct a store + start a tick loop (16d-002: 3 loops
//     were observed born within 3ms, writing contradictory same-second rows
//     at 2.8× rate). Stale-store teardown clears every registered interval.
//   The bump forces dev-server hot reload to retire any store built by the
//   pre-v2.1 module code (its tick closure still hashes raw doubles).
// v16 (AUDIT-FIX — equation-by-equation audit implementation pass):
//   - ReserveState gained `ejectStageStartPrice` (§21.5.3 5% pause rule),
//     `reintegration.sustainedHours` (§21.5.4 reverse-ladder rungs),
//     `naturalFlowUsd` (§10.7 CF ledger), `execCostLedger` (§9.5 cost effect)
//     and `lastAttribution` (§9.4–9.5 attribution).
//   - USE_MARP_EXECUTION flips to TRUE (audit P1-4): the legacy §7 auto-exec
//     path is RETIRED — the per-component MARP path (with natural-flow
//     netting, thin-liquidity deferral, direction lock and the unified ε=$10
//     profitability gate) is now the active execution route. The legacy
//     evaluateRebalance remains ADVISORY ONLY (§24.2 audit rows + A/B badge).
//   - updatePegHealth now receives the live RR (§21.5.3 RR-coupled eject
//     triggers); the tick loop computes snap0 BEFORE peg-health updates.
//   - §17.9 correlation-warning hold: MARP execution is skipped while any
//     pair carries an active SOURCE_CORRELATION_WARNING.
// v15 (AUDIT FIX D3): the singleton now initializes the chain index WITHOUT
// the init-time weight commit — the index anchors at the immutable BASE_FIXINGS
// (§3.4) so P_MTQ measures the true base-date→today basket level and is
// restart-invariant (§24.1 deterministic reproducibility). Also primes
// maseSmoothed = Strategic Prior (§3.4 genesis snapshot) and validates the
// CHF/USD oracle pair (AUDIT FIX D2, I9).
// §14.1 MARP execution feature flag — AUDIT P1-4: NOW TRUE. The per-component
// MARP path (v1.0 production target) is the ACTIVE execution route; the legacy
// §7 single-direction path no longer auto-executes (its decision is still
// evaluated each tick as an ADVISORY row for the §24.2 audit trail and the
// UI A/B badge). All trades remain SIMULATED pilot bookkeeping — this flag
// changes the DECISION ROUTE, not the production-authorization posture
// (still NOT PRODUCTION-AUTHORIZED; all 11 §25.5 gates still not conducted).
const USE_MARP_EXECUTION = true;
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
  // 16d-002 fix: single-flight guard — the in-flight store-construction
  // promise. Set SYNCHRONOUSLY before any await so concurrent callers during
  // boot/hot-reload share ONE construction (previously each concurrent first
  // request built its own store and started its own 4s tick loop; loser
  // intervals were never cleared and wrote contradictory same-second rows).
  var __MTQ_PILOT_INIT__: Promise<PilotStore> | undefined;
  // 16d-002 defense-in-depth: every interval handle startLoop ever created in
  // this process. Teardown clears them ALL, so even a pathological double
  // start (or a store overwritten mid-race by a stale module copy) cannot
  // leave an orphaned tick loop running.
  var __MTQ_PILOT_LOOPS__: Set<NodeJS.Timeout> | undefined;
}

// Tear down a stale pilot store (schema bump / hot reload): clear every
// registered tick-loop interval + the store's own handle, drop the store and
// the in-flight-init guard so the next caller rebuilds with fresh code.
function teardownStaleStore(prev: PilotStore): void {
  if (prev.interval) clearInterval(prev.interval);
  const loops = globalThis.__MTQ_PILOT_LOOPS__;
  if (loops) {
    for (const t of loops) clearInterval(t);
    loops.clear();
  }
  prev.ready = false;
  if (globalThis.__MTQ_PILOT__ === prev) globalThis.__MTQ_PILOT__ = undefined;
  globalThis.__MTQ_PILOT_INIT__ = undefined;
  console.log(
    `[mtq-pilot] stale pilot store torn down (schema v${prev.schemaVersion} ≠ v${STATE_SCHEMA_VERSION}) — ` +
    `tick-loop intervals cleared; rebuilding singleton with current module code`,
  );
}

// Build a fresh store (NO side effects on globalThis — the caller installs
// the result). Extracted from ensureStore so the single-flight wrapper below
// is the ONLY construction path.
async function buildStore(): Promise<PilotStore> {
  const fx = await fetchFxSnapshot(true);
  const state = initReserveState(fx.XAU_USD);
  // AUDIT FIX D3 (§3.4/§9.2/§24.1): do NOT call advanceMase() here. The old
  // init-time advanceMase() committed the first MASE weights to the chain
  // index via commitChainIndexWeights(), which set prevPrices = CURRENT live
  // prices BEFORE the first advanceIndex() — silently re-anchoring the index
  // to process-start prices and discarding the immutable BASE_FIXINGS. The
  // result was P_MTQ ≈ 1.00 at every restart instead of the basket's true
  // base-date→today level (§18.1: I_base is fixed at the genesis base date;
  // §3.4: base fixings "are never updated"; §24.1: deterministic
  // reproducibility — the level must be restart-invariant).
  //
  // Instead: prime the MASE EMA state WITHOUT touching the chain index.
  // §3.4's genesis snapshot supplies the initial condition — the smoothed
  // weights at genesis ARE the Strategic Prior ("the genesis snapshot ... it
  // provides the initial condition for the weight-velocity constraints").
  // The first tick then runs advanceChainIndex() FIRST (measuring the full
  // base-fixings→live price return, I_t = Σ W·P_t/P_0) and commits weights
  // AFTER, preserving §9.3's zero-artificial-return continuity.
  state.maseSmoothed = { ...STRATEGIC_PRIOR } as WeightVector;
  state.maseLastAt = Date.now();
  const registry = genesisRegistry();
  const oracle = buildOracleBoard({
    EUR_USD: fx.EUR_USD, GBP_USD: fx.GBP_USD, JPY_USD: fx.JPY_USD, CNY_USD: fx.CNY_USD,
    CHF_USD: fx.CHF_USD, XAU_USD: fx.XAU_USD, // AUDIT FIX D2: CHF validated per I9
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
  return store;
}

async function ensureStore(): Promise<PilotStore> {
  // Fast path: a ready store built by current-schema code.
  const cur = globalThis.__MTQ_PILOT__;
  if (cur && cur.ready && cur.schemaVersion === STATE_SCHEMA_VERSION) {
    return cur;
  }
  // Stale store (schema bump / hot-reload residue): tear it down — clearing
  // its interval(s) BEFORE any await, so no orphan loop survives the rebuild.
  if (cur) teardownStaleStore(cur);
  // 16d-002 fix — SINGLE-FLIGHT: claim the construction slot synchronously.
  // The first caller sets __MTQ_PILOT_INIT__ BEFORE awaiting anything; every
  // concurrent caller observes the in-flight promise and awaits the SAME
  // store instead of racing to build its own (which is what created up to 3
  // parallel tick loops). On rejection the slot is released so a later
  // request can retry; all awaiters still see the error.
  if (!globalThis.__MTQ_PILOT_INIT__) {
    const init = buildStore().then((store) => {
      globalThis.__MTQ_PILOT__ = store;
      startLoop(store);
      return store;
    });
    globalThis.__MTQ_PILOT_INIT__ = init;
    init.catch(() => {
      if (globalThis.__MTQ_PILOT_INIT__ === init) {
        globalThis.__MTQ_PILOT_INIT__ = undefined;
      }
    });
  }
  return globalThis.__MTQ_PILOT_INIT__;
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
  if (!globalThis.__MTQ_PILOT_LOOPS__) globalThis.__MTQ_PILOT_LOOPS__ = new Set();
  globalThis.__MTQ_PILOT_LOOPS__.add(store.interval);
  // 16d-002 defensive evidence line: exactly ONE start per (re)build. If this
  // ever appears twice without an intervening teardown log, a regression
  // reintroduced the create-race — investigate.
  console.log(
    `[mtq-pilot] engine tick loop started (schema v${store.schemaVersion}, ` +
    `tick ${TICK_MS}ms, single-flight guard active)`,
  );
}

async function tick(store: PilotStore) {
  // §9 oracle: refresh FX then build the consensus board
  store.fx = await fetchFxSnapshot(false);
  // WIRING-1: read on-chain adapter prices (Chainlink / Pyth / Chronicle) for
  // each pair the engine needs. When the V3 contract is deployed
  // (MTQ_V3_CONTRACT_ADDRESS + RPC_URL env vars set), this calls each adapter's
  // getPrice(bytes32 pair) view function and feeds the real prices into the
  // consensus pipeline (replacing the synthetic witnesses). When the V3
  // contract is NOT configured, fetchOnChainOraclePrices returns all-nulls for
  // every pair and buildOracleBoard falls back to the existing synthetic
  // witness path unchanged.
  // AUDIT FIX D2: CHF/USD joins the on-chain adapter roster (I9).
  const onChainByPair: Record<string, OnChainOraclePrices> = {};
  const pairs = ["EUR/USD", "GBP/USD", "JPY/USD", "CNY/USD", "CHF/USD", "XAU/USD"] as const;
  const onChainResults = await Promise.all(pairs.map((p) => fetchOnChainOraclePrices(p).catch(() => ({
    chainlink: null, pyth: null, chronicle: null,
  } as OnChainOraclePrices))));
  for (let i = 0; i < pairs.length; i++) {
    onChainByPair[pairs[i]] = onChainResults[i];
  }
  store.oracle = buildOracleBoard(
    {
      EUR_USD: store.fx.EUR_USD, GBP_USD: store.fx.GBP_USD, JPY_USD: store.fx.JPY_USD, CNY_USD: store.fx.CNY_USD,
      CHF_USD: store.fx.CHF_USD, XAU_USD: store.fx.XAU_USD, // AUDIT FIX D2: CHF validated per I9
    },
    { onChainByPair },
  );
  // v2.0 §17.7 — DEGRADED boards still publish usable (LKG / 2-source)
  // values: refresh FX from the oracle whenever the board is NOT FAILED.
  if (!store.oracle.anyFailed) {
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
  // AUDIT-FIX F-9 tick reorder: compute snap0 BEFORE the peg-health update so
  // the §21.5.3 RR-coupled eject triggers receive the live reserve ratio (the
  // same post-index/post-MASE snapshot the rest of the tick consumes).
  const snap0 = computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry });
  // §5/§11 peg health + eject ladder — with the §21.5.3 RR-coupled triggers
  // (stage 2 RR<1.08 · stage 3 RR<1.05 · stage 4 RR<1.02) and the 5% pause rule.
  updatePegHealth(store.state, SIM_TICK_HOURS, store.fx, snap0.reserveRatio);
  // §11.3 reintegration score (§21.5.4 reverse-ladder rungs inside)
  updateReintegration(store.state, store.oracle, SIM_TICK_HOURS);
  // §3.6 price events (0.5% threshold)
  maybePriceEvent(store.state, snap0.mtqPrice);
  // §7/§10 rebalance (skip if oracle paused — §9.3 strict I9 requires pause on
  // <3 valid feeds for any pair; governance override degrades to 2-source but
  // rebalance is still skipped to avoid acting on a sub-quorum price).
  // AUDIT-FIX §17.9 (3rd consumer): persistent SOURCE_CORRELATION_WARNINGs
  // hold MARP rebalancing paused until the correlation resolves.
  const rebalanceHeld = store.oracle.correlationWarning;
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
    // AUDIT P1-4: MARP is now the ACTIVE execution route; §17.9 correlation
    // warnings hold it paused. Decisions arrive pre-netted (§10.7 flows) and
    // pre-gated (8-level hierarchy) from the snapshot; pool depth is FEED-driven.
    // v2.0 §17.7 — rebalancing pauses in DEGRADED and FAILED oracle states
    // (mint+rebalance pause); only FAILED additionally closes redemption.
    if (!store.oracle.anyFailed && !store.oracle.anyDegraded && !rebalanceHeld && snap0.priceInBand) {
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
        const result = applyMarpRebalance(
          store.state,
          store.fx,
          marpDecisions,
          { poolDepth24hUsd: store.fx.xauPoolDepth24hUsd, reserveRatio: snap0.reserveRatio },
        );
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
    // §24.2 — the legacy §7 single-direction decision is still EVALUATED each
    // tick, but with MARP active it is ADVISORY ONLY (never applied). The row
    // is logged so the A/B comparison stays reconstructible from the audit trail.
    if (!store.oracle.anyFailed && !store.oracle.anyDegraded && snap0.priceInBand) {
      const advisory = evaluateRebalance(
        store.state,
        { nav: snap0.nav, goldNet: snap0.reserve.goldNet, fiatNet: snap0.reserve.fiatNet },
        snap0.reserveRatio,
        { poolDepth24hUsd: store.fx.xauPoolDepth24hUsd },
      );
      rebalanceAudit = {
        decision: { ...advisory, reason: `${advisory.reason} [advisory — MARP execution active (audit P1-4)]` },
        navUsd: snap0.nav,
        reserveRatio: snap0.reserveRatio,
        observedGoldWeight: snap0.observedGoldWeight,
        targetGoldWeight: snap0.targetGoldWeight,
        deviationPct: Math.abs(advisory.deviation) * 100,
        applied: false,
      };
    }
    // Legacy single-direction path — runs ONLY when MARP execution is OFF
    // (v2.0 §17.7 oracle gating: rebalancing pauses in DEGRADED and FAILED).
    } else if (!store.oracle.anyFailed && !store.oracle.anyDegraded && snap0.priceInBand) {
      const decision = evaluateRebalance(
        store.state,
        { nav: snap0.nav, goldNet: snap0.reserve.goldNet, fiatNet: snap0.reserve.fiatNet },
        snap0.reserveRatio,
        { poolDepth24hUsd: store.fx.xauPoolDepth24hUsd },
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
    // AUDIT-FIX F-10 (DRY on the EQ-136 shared identity): the tick loop now
    // uses the canonical engine helpers (computeLiability / computeReserveRatio
    // / computeLcr / getMtqPriceFromState) instead of re-implementing the
    // L = S_circ × P, RR = V_net/L, LCR = fiatNet/(L × 0.25) math inline.
    const postVals = reserveAssetValues(store.state, store.fx);
    const postNav = postVals.nav;
    const postPrice = getMtqPriceFromState(store.state);
    const postLiability = computeLiability(store.state, postPrice);
    const postRr = computeReserveRatio(postNav, postLiability);
    const postLcr = computeLcr(store.state, postVals, postPrice);
    advanceRiskState(store.state, postRr, postLcr, Date.now());

    // WIRING-1 — §11.5 Stability Pool (T3 first-loss for EMERGENCY deficit).
    // Mirrors the V3 contract's `useStabilityPoolForDeficit(deficitUsd)`
    // keeper call. When the protocol is in EMERGENCY (RR < 1.00) AND the
    // stability pool has funds, cover the deficit up to
    // min(deficit, totalStabilityPool). The covered amount is removed from
    // `totalStabilityPoolUsd` and recorded additively in `stabilityPoolUsedUsd`
    // for audit. In production this is an ethers contract call (keeper role);
    // in the pilot we simulate the accounting in-process so the state machine
    // can exit EMERGENCY on the next tick (when RR ≥ 1.0 again because the
    // coverage effectively reduces the deficit). The on-chain call would
    // revert Err100_NotEmergencyState if not in EMERGENCY — the state check
    // above guards the same condition here.
    if (store.state.riskState.state === 'EMERGENCY' && store.state.totalStabilityPoolUsd > 0) {
      const deficit = Math.max(0, postLiability - postNav);
      if (deficit > 0) {
        try {
          const cover = Math.min(deficit, store.state.totalStabilityPoolUsd);
          console.log(
            `[mtq-pilot] EMERGENCY: stability pool covering deficit: ` +
            `$${cover.toFixed(2)} of $${deficit.toFixed(2)} ` +
            `(pool was $${store.state.totalStabilityPoolUsd.toFixed(2)})`,
          );
          store.state.stabilityPoolUsedUsd = (store.state.stabilityPoolUsedUsd ?? 0) + cover;
          store.state.totalStabilityPoolUsd -= cover;
        } catch (e) {
          console.error('[mtq-pilot] stability pool call failed:', e);
        }
      }
    }
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
  // AUDIT-FIX EQ-146/147 (§19.4 transaction guards): passed through to the
  // engine. minOutMtq (mint, §19.4.1) / minOutUsd (redeem, §19.4.2) and the
  // §19.7 5-minute quote deadline are enforced INSIDE applyMint/applyRedeem.
  minOutMtq?: number;
  minOutUsd?: number;
  quoteExpiresAt?: number;
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
  // v2.0 §17.7 oracle operation gating (supersedes the prior strict-I9 all-pause
  // at <3 feeds — reconciliation documented in oracle.ts):
  //   FAILED   (quorum lost, anyFailed)      → MINT and REDEEM both blocked.
  //   DEGRADED (2-source path | Confidence < C_MIN | correlation warning)
  //            → MINT blocked; REDEMPTION REMAINS AVAILABLE (§17.7 "mint+
  //              rebalance pause, redemption AVAILABLE" — exit-first doctrine;
  //              redemption prices against the board's published LKG/filtered
  //              values). Rebalance is gated separately in the tick loop.
  const isMint = req.type === "MINT";
  const blocked = isMint
    ? store.oracle.anyFailed || store.oracle.anyDegraded
    : store.oracle.anyFailed;
  if (blocked) {
    const mode = store.oracle.anyFailed
      ? "FAILED (quorum lost — <2 valid feeds)"
      : "DEGRADED (§17.7 — mint held; redemption remains available)";
    return {
      ok: false,
      snapshot: getSnapshotSync(store),
      error: `Oracle ${mode}. ${req.type} suspended per §17.7.`,
    };
  }
  const snap = computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry });
  if (req.type === "MINT") {
    if (!(req.amount > 0)) return { ok: false, snapshot: snap, error: "Invalid amount" };
    const guards: MintGuardOpts = {};
    if (req.minOutMtq != null) guards.minOutMtq = req.minOutMtq;
    if (req.quoteExpiresAt != null) guards.quoteExpiresAt = req.quoteExpiresAt;
    const res = applyMint(store.state, store.fx, snap.status, req.amount, guards);
    // Fee revenue → §13.2 treasury sweep
    maybeTreasurySweep(store.state, res.ok ? res.feeUsd : 0);
    return { ok: res.ok, mint: res, snapshot: computeSnapshot(store.state, store.fx, { oracle: store.oracle, registry: store.registry }), error: res.reason };
  } else {
    if (!(req.amount > 0)) return { ok: false, snapshot: snap, error: "Invalid amount" };
    const guards: RedeemGuardOpts = {};
    if (req.minOutUsd != null) guards.minOutUsd = req.minOutUsd;
    if (req.quoteExpiresAt != null) guards.quoteExpiresAt = req.quoteExpiresAt;
    const res = applyRedeem(store.state, store.fx, snap.status, req.amount, guards);
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

// (16-fix-C single-flight live probe marker — comment-only touch to force a hot-reload re-init for the concurrent-boot test; no semantic change)
