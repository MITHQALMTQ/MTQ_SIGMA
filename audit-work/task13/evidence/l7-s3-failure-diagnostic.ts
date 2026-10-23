// MTQΣ — Task 13 closeout · Layer 7 S3 failure-mechanism diagnostic (READ-ONLY ANALYSIS)
// =================================================================================
// PURPOSE (closeout Priority 3): characterize the 115 FAILING S3 (Cauchy fat-tail)
// trajectories — when they breach the RR_HARD=1.00 floor, under what gold-path
// conditions, and how deep — plus a faithfulness cross-check of the chunked
// record. This file is ANALYSIS ONLY: it changes no engine code, no harness
// assertion, and no evidence partial. It re-runs trajectory range 120..159
// (chunk 4 — the worst-min-RR chunk) with per-tick instrumentation and verifies
// its aggregate against the recorded partial `s3-120-160.json`
// (survivors=19, worstMinRr=0.07585525867923032).
//
// Equivalence: trajectory bodies (setup, fx generator, step loop) are copied
// VERBATIM from src/lib/mtq/__tests__/canonical-invariants.ts (S3, seedBase
// 3000 + i, 90 ticks); only per-tick RECORDING was added (no behavior change).
//
// Run: bun audit-work/task13/evidence/l7-s3-failure-diagnostic.ts
// Output: l7-s3-failure-diagnostic.json (beside this file — NOT in
// canonical-layer7/, whose s3-*.json namespace is owned by the merge tool).
// =================================================================================

import {
  initReserveState,
  applyMint,
  advanceChainIndex,
  advanceMase,
  getMtqPriceFromState,
  reserveAssetValues,
  computeLiability,
  computeReserveRatio,
  computeLcr,
  advanceRiskState,
  computeSnapshot,
  updateBufferState,
  type ReserveState,
} from "../../../src/lib/mtq/engine";
import { BASE_FIXINGS, STRATEGIC_PRIOR, HAIRCUTS } from "../../../src/lib/mtq/blueprint";
import type { FxSnapshot } from "../../../src/lib/mtq/fx";
import * as fs from "node:fs";
import * as path from "node:path";

// ---- PRNG + helpers (verbatim from canonical-invariants.ts) --------------------
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rng: () => number, mean = 0, sd = 1): number {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function cauchy(rng: () => number, location = 0, scale = 1): number {
  return location + scale * Math.tan(Math.PI * (rng() - 0.5));
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function makeFx(opts: {
  EUR?: number; GBP?: number; JPY?: number; CNY?: number; CHF?: number;
  XAU?: number; VIX?: number; DXY?: number;
} = {}): FxSnapshot {
  return {
    EUR_USD: opts.EUR ?? BASE_FIXINGS.EUR_USD,
    GBP_USD: opts.GBP ?? BASE_FIXINGS.GBP_USD,
    JPY_USD: opts.JPY ?? BASE_FIXINGS.JPY_USD,
    CNY_USD: opts.CNY ?? BASE_FIXINGS.CNY_USD,
    CHF_USD: opts.CHF ?? BASE_FIXINGS.CHF_USD,
    XAU_USD: opts.XAU ?? BASE_FIXINGS.XAU_USD,
    VIX: opts.VIX ?? 18.5,
    DXY: opts.DXY ?? 104.2,
    fetchedAt: Date.now(),
    source: "l7-s3-failure-diagnostic",
    degraded: false,
  };
}

// ---- Trajectory bodies (verbatim from canonical-invariants.ts) ------------------
function redistributeToStrategicPrior(s: ReserveState, fx: FxSnapshot): void {
  const vals = reserveAssetValues(s, fx);
  const navNet = vals.nav;
  if (navNet <= 0) return;
  const usdNetTarget = navNet * STRATEGIC_PRIOR.USD;
  const eurNetTarget = navNet * STRATEGIC_PRIOR.EUR;
  const jpyNetTarget = navNet * STRATEGIC_PRIOR.JPY;
  const gbpNetTarget = navNet * STRATEGIC_PRIOR.GBP;
  const cnyNetTarget = navNet * STRATEGIC_PRIOR.CNY;
  const chfNetTarget = navNet * STRATEGIC_PRIOR.CHF;
  const goldNetTarget = navNet * STRATEGIC_PRIOR.Gold;
  const usdGrossTotal = usdNetTarget / (1 - HAIRCUTS.USD);
  const eurGross = eurNetTarget / (1 - HAIRCUTS.EUR) / fx.EUR_USD;
  const jpyGross = jpyNetTarget / (1 - HAIRCUTS.JPY) / fx.JPY_USD;
  const gbpGross = gbpNetTarget / (1 - HAIRCUTS.GBP) / fx.GBP_USD;
  const cnyGross = cnyNetTarget / (1 - HAIRCUTS.CNY) / fx.CNY_USD;
  const chfGross = chfNetTarget / (1 - HAIRCUTS.CHF) / fx.CHF_USD;
  const goldGrossTotal = goldNetTarget / (1 - HAIRCUTS.XAU) / fx.XAU_USD;
  s.usdc = usdGrossTotal / 3;
  s.usdp = usdGrossTotal / 3;
  s.usdt = usdGrossTotal / 3;
  s.eurc = eurGross;
  s.jpy = jpyGross;
  s.gbp = gbpGross;
  s.cny = cnyGross;
  s.chf = chfGross;
  s.paxg = goldGrossTotal / 2;
  s.xaut = goldGrossTotal / 2;
  s.indexPaxg = s.paxg / 2;
  s.indexXaut = s.xaut / 2;
  s.reservePaxg = s.paxg / 2;
  s.reserveXaut = s.xaut / 2;
  s.updatedAt = Date.now();
}

function setupInitialStateForStress(initialMintUsd = 9_000_000): { state: ReserveState; fx: FxSnapshot } {
  const fx = makeFx();
  const s = initReserveState(BASE_FIXINGS.XAU_USD);
  advanceChainIndex(s, fx);
  advanceMase(s, fx);
  const snap0 = computeSnapshot(s, fx);
  applyMint(s, fx, snap0.status, initialMintUsd);
  redistributeToStrategicPrior(s, fx);
  return { state: s, fx };
}

interface FxGenPrev { EUR: number; GBP: number; JPY: number; CNY: number; CHF: number; XAU: number; VIX: number; DXY: number; }

// S3 fxGen — verbatim from canonical-invariants.ts (seedBase 3000, 90 ticks)
function s3FxGen(rng: () => number, _t: number, prev: FxGenPrev): FxGenPrev {
  const shockEUR = cauchy(rng, 0, 0.005);
  const shockGBP = cauchy(rng, 0, 0.005);
  const shockJPY = cauchy(rng, 0, 0.006);
  const shockCNY = cauchy(rng, 0, 0.004);
  const shockCHF = cauchy(rng, 0, 0.005);
  const shockXAU = cauchy(rng, 0, 0.015);
  return {
    EUR: Math.max(0.4, prev.EUR * (1 + shockEUR)),
    GBP: Math.max(0.5, prev.GBP * (1 + shockGBP)),
    JPY: Math.max(0.003, prev.JPY * (1 + shockJPY)),
    CNY: Math.max(0.06, prev.CNY * (1 + shockCNY)),
    CHF: Math.max(0.4, prev.CHF * (1 + shockCHF)),
    XAU: Math.max(500, prev.XAU * (1 + shockXAU)),
    VIX: clamp(prev.VIX + cauchy(rng, 0, 1.0), 10, 80),
    DXY: clamp(prev.DXY + cauchy(rng, 0, 0.3), 80, 120),
  };
}

interface DiagTrajectory {
  index: number; // 120..159
  seed: number;
  survived: boolean;
  minRr: number;
  minTick: number;
  xauRelAtMin: number;      // XAU at the min-RR tick / base 2500
  navAtMin: number;
  liabAtMin: number;
  worstStatus: string;
  finalStatus: string;
  xauTroughRel: number;     // min cumulative XAU/base over the trajectory
  maxAdverseXauTick: number; // most negative per-tick XAU relative move
  ticksBelowFloor: number;  // count of ticks with rr < 1.00
}

function runDiagTrajectory(i: number, ticks: number): DiagTrajectory {
  const seed = 3000 + i;
  const { state: s } = setupInitialStateForStress();
  const rng = mulberry32(seed);
  let cur: FxGenPrev = {
    EUR: BASE_FIXINGS.EUR_USD, GBP: BASE_FIXINGS.GBP_USD, JPY: BASE_FIXINGS.JPY_USD,
    CNY: BASE_FIXINGS.CNY_USD, CHF: BASE_FIXINGS.CHF_USD, XAU: BASE_FIXINGS.XAU_USD,
    VIX: 18.5, DXY: 104.2,
  };
  let minRr = Infinity;
  let minTick = -1;
  let navAtMin = NaN, liabAtMin = NaN, xauRelAtMin = NaN;
  let worstStatus = "NORMAL";
  let finalStatus = "NORMAL";
  let xauTroughRel = 1.0;
  let maxAdverseXauTick = 0;
  let ticksBelowFloor = 0;
  const STATUS_RANK_LOCAL: Record<string, number> = {
    NORMAL: 0, CAUTION: 1, RECOVERY: 1, STRESS: 2, DEFENSIVE: 3, EMERGENCY: 4,
  };
  for (let t = 0; t < ticks; t++) {
    const prevXau = cur.XAU;
    cur = s3FxGen(rng, t, cur);
    const tickMove = cur.XAU / prevXau - 1;
    if (tickMove < maxAdverseXauTick) maxAdverseXauTick = tickMove;
    const xauRel = cur.XAU / BASE_FIXINGS.XAU_USD;
    if (xauRel < xauTroughRel) xauTroughRel = xauRel;
    const fx = makeFx({ EUR: cur.EUR, GBP: cur.GBP, JPY: cur.JPY, CNY: cur.CNY, CHF: cur.CHF, XAU: cur.XAU, VIX: cur.VIX, DXY: cur.DXY });
    // stepEngineCanonical (verbatim body)
    s.dailyTurnoverUsd = 0;
    s.lastTurnoverResetAt = Date.now();
    s.lastTradeAt = 0;
    advanceChainIndex(s, fx);
    advanceMase(s, fx);
    const price = getMtqPriceFromState(s);
    const vals = reserveAssetValues(s, fx);
    const nav = vals.nav;
    const liab = computeLiability(s, price);
    const rr = computeReserveRatio(nav, liab);
    const lcr = computeLcr(s, vals, price);
    const cs = advanceRiskState(s, Number.isFinite(rr) ? rr : 1.10, Number.isFinite(lcr) ? lcr : 1.10, Date.now());
    finalStatus = cs.state;
    if (STATUS_RANK_LOCAL[cs.state] > (STATUS_RANK_LOCAL[worstStatus] ?? 0)) worstStatus = cs.state;
    updateBufferState(s, Number.isFinite(rr) ? rr : 1.10);
    // /stepEngineCanonical
    if (Number.isFinite(rr) && rr < 1.00) ticksBelowFloor++;
    if (Number.isFinite(rr) && rr < minRr) {
      minRr = rr; minTick = t; navAtMin = nav; liabAtMin = liab; xauRelAtMin = xauRel;
    }
  }
  return {
    index: i, seed,
    survived: Number.isFinite(minRr) ? minRr >= 1.00 : true,
    minRr: Number.isFinite(minRr) ? minRr : 999,
    minTick, xauRelAtMin, navAtMin, liabAtMin,
    worstStatus, finalStatus, xauTroughRel, maxAdverseXauTick, ticksBelowFloor,
  };
}

// ---- Execute chunk 4 (120..159) + faithfulness check ---------------------------
// Range overridable for incremental execution: L7_START / L7_END (inclusive).
const START = Number(process.env.L7_START ?? 120);
const END = Number(process.env.L7_END ?? 159); // inclusive
const TICKS = 90;
const FULL_CHUNK = START === 120 && END === 159; // only the full chunk may be compared to the recorded partial
const RECORDED_SURVIVORS = 19;
const RECORDED_WORST = 0.07585525867923032;

const t0 = Date.now();
const rows: DiagTrajectory[] = [];
for (let i = START; i <= END; i++) {
  rows.push(runDiagTrajectory(i, TICKS));
  if ((i - START + 1) % 8 === 0) console.error(`  [diag] ${(i - START + 1)}/${END - START + 1} trajectories…`);
}
const survivors = rows.filter((r) => r.survived).length;
const worstMinRr = Math.min(...rows.map((r) => r.minRr));
const failures = rows.filter((r) => !r.survived);

const faithfulness = {
  comparableToRecordedPartial: FULL_CHUNK,
  survivorsMatch: FULL_CHUNK ? survivors === RECORDED_SURVIVORS : null,
  worstMatch: FULL_CHUNK ? Math.abs(worstMinRr - RECORDED_WORST) < 1e-12 : null,
  recordedSurvivors: RECORDED_SURVIVORS,
  recordedWorstMinRr: RECORDED_WORST,
  measuredSurvivors: survivors,
  measuredWorstMinRr: worstMinRr,
};

// ---- Failure-mechanism summary ---------------------------------------------------
const sorted = [...failures].sort((a, b) => a.minRr - b.minRr);
const median = (xs: number[]): number => xs.length === 0 ? NaN : (xs.length % 2 ? xs[(xs.length - 1) / 2] : (xs[xs.length / 2 - 1] + xs[xs.length / 2]) / 2);
const breachTicks = failures.map((f) => f.minTick).sort((a, b) => a - b);
const xauAtBreach = failures.map((f) => f.xauRelAtMin).sort((a, b) => a - b);
const xauTrough = failures.map((f) => f.xauTroughRel).sort((a, b) => a - b);
const survivorMargins = rows.filter((r) => r.survived).map((r) => r.minRr - 1.0).sort((a, b) => a - b);

const summary = {
  ranRange: [START, END] as const,
  ticks: TICKS,
  seedBase: 3000,
  wallClockSeconds: (Date.now() - t0) / 1000,
  survivors,
  failures: failures.length,
  worstMinRr,
  breachTick: { min: breachTicks[0] ?? null, median: median(breachTicks), max: breachTicks[breachTicks.length - 1] ?? null },
  xauRelAtBreach: { min: xauAtBreach[0] ?? null, median: median(xauAtBreach), max: xauAtBreach[xauAtBreach.length - 1] ?? null },
  xauTroughRel: { min: xauTrough[0] ?? null, median: median(xauTrough) },
  worstStatusCounts: failures.reduce<Record<string, number>>((m, f) => { m[f.worstStatus] = (m[f.worstStatus] ?? 0) + 1; return m; }, {}),
  survivorMarginAboveFloor: { min: survivorMargins[0] ?? null, median: median(survivorMargins), max: survivorMargins[survivorMargins.length - 1] ?? null },
  deepestFailures: sorted.slice(0, 8),
};

const out = { generatedAt: new Date().toISOString(), note: "ANALYSIS ONLY — no assertions, no engine/harness changes; trajectory bodies verbatim from canonical-invariants.ts (S3)", faithfulness, summary, trajectories: rows };
const outFile = path.join(import.meta.dir, `l7-s3-failure-diagnostic${FULL_CHUNK ? "" : `-range-${START}-${END}`}.json`);
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n");
console.log(`\n[diag] range ${START}..${END}: survivors=${survivors} · worstMinRr=${worstMinRr.toFixed(6)}`);
console.log(`[diag] faithfulness: fullChunk=${FULL_CHUNK} · survivorsMatch=${faithfulness.survivorsMatch} · worstMatch=${faithfulness.worstMatch}`);
console.log(`[diag] failures in range: ${failures.length} · breach tick median=${summary.breachTick.median} · XAU at breach median=${summary.xauRelAtBreach.median?.toFixed(3)}× base · XAU trough median=${summary.xauTroughRel.median?.toFixed(3)}×`);
console.log(`[diag] deepest: ${sorted.slice(0, 3).map((f) => `#${f.index}(minRr=${f.minRr.toFixed(4)}, tick=${f.minTick}, xau=${f.xauRelAtMin.toFixed(3)}×)`).join(" · ")}`);
console.log(`[diag] written: ${outFile}`);
process.exit(!FULL_CHUNK || (faithfulness.survivorsMatch && faithfulness.worstMatch) ? 0 : 3);
