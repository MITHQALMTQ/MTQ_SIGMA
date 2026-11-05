// MTQΣ — §23.3 walk-forward validation + §23.4 purged/embargoed K-fold CV
// (PILOT-SCALE RUN RECORD — internal evidence only).
//
// This module implements a genuine, mechanically leakage-checked pilot-scale
// execution of the two §23 programs the honest-status register lists as
// "documented NOT RUN (leakage-controlled design exists)":
//   §23.3 — rolling walk-forward: 8 folds over the deterministic simulated
//           756-day series (initial train 252d, test 63d, step 63d);
//   §23.4 — purged K-fold CV: K = 5 contiguous test blocks with a 21-day
//           purge and a 10-day embargo around every test block.
//
// ESTIMATOR FAMILY (mirrored exactly): the engine's weight machinery is the
// mase.ts `maseEnsemble` path — §5.1 multi-horizon vols → §6.1 blended
// covariance Σ̂ = Σ_h ω_h·Cov_h → §6.2 shrinkage Σ_robust = λF + (1−λ)Σ̂ → the
// seven §7.5 member models with the buildRiskContext wiring → the 50/50
// Stability (min-var/ERC) blend → the uniform 1/6 family average → the §8.1
// envelope projection the engine applies before publication (engine.ts
// buildMaseSnapshot: applyEnvelopes(maseEnsembleAdaptive(…).target)).
//
// `maseEnsemble` itself derives the FULL 756-day series internally from
// (vols, regime) and cannot be called with a train slice, so the refit below
// REPLICATES its pipeline verbatim on each train slice (same exported
// functions from mase.ts, same context wiring as buildRiskContext with
// corr = null). The replication is line-for-line: multiHorizonVols →
// blendedCovariance → shrinkCovariance → computeCrisisScore →
// classifySixRegimes → the seven models → 1/6 family blend → applyEnvelopes.
// NOTE (scope): in that pipeline `crisis`/`regime6` influence the ensemble
// target only through classifySixRegimes' crisisScore input (the regime
// family); the λ_CVaR,t regime scaling lives in the §7.4 objective, which is
// NOT part of the weight fit being validated here.
//
// HONESTY (§1 standing directive): every number below is a descriptive
// statistic of ONE deterministic simulated exercise over the disclosed
// baseline calibration — never a pass/fail verdict, never a performance
// claim about MTQΣ (§23.1 negative rule), never a §25.5 gate claim.
// Determinism: fixed seeds inside buildSimulatedReturnSeries; the ONLY
// non-deterministic outputs are generatedAt/runtimeMs (wall-clock metadata).
// RUNTIME-ENGINE CAVEAT (disclosed): Math.log/cos/sqrt are ECMA-262
// "implementation-approximated", so runs under different JS engines
// (bun/JSC vs node/V8) agree to ~8 significant digits rather than
// bit-for-bit; same-engine re-runs are exactly identical.

import {
  COMPONENTS,
  applyEnvelopes,
  blendWeights,
  blendedCovariance,
  buildSimulatedReturnSeries,
  classifySixRegimes,
  computeCrisisScore,
  modelCVaR,
  modelEqualRiskContribution,
  modelInstitutional,
  modelMaxDiversification,
  modelMinimumVariance,
  modelPurchasingPower,
  modelRegimeAdaptive,
  multiHorizonVols,
  shrinkCovariance,
} from "./mase";
import type {
  Component,
  MarketRegime,
  PriceData,
  SimReturnSeries,
  VolatilityData,
  WeightVector,
} from "./mase";

// === Disclosed baseline calibration (constants, NOT live market data) ======
// These are the engine's non-VIX-stressed default inputs (engine.ts
// estimateVolsFromState fallbacks / detectRegime at vix = 18.5, dxy = 100):
// vols are the §5.1 h=30 inputs the ensemble path consumes; prices are the
// base-date genesis fixings (all P_{i,t}/P_{i,0} = 1 — the PPP family at its
// base state); regime 1 = normal with vix 18.5 ⇒ VIX factor f = 1, so the
// simulated vol path is stationary at the baseline vols.
const BASELINE_VOLS: VolatilityData = {
  USD: 0.05, EUR: 0.10, JPY: 0.12, GBP: 0.11, CNY: 0.09, CHF: 0.10, Gold: 0.15,
};
const BASELINE_REGIME: MarketRegime = { regime: 1, vix: 18.5, dxy: 100, goldVol: 0.15 };
const BASELINE_PRICES: PriceData = { USD: 1.0, EUR: 1.0, JPY: 1.0, GBP: 1.0, CNY: 1.0, CHF: 1.0, Gold: 1.0 };

// === Program configuration (pilot-scale, disclosed) =========================
export const WF_CONFIG = {
  /** §23.3 rolling walk-forward: train [0, 252 + k·63), test [252 + k·63, 252 + (k+1)·63). */
  initialTrainDays: 252,
  testDays: 63,
  stepDays: 63,
  folds: 8,
} as const;

export const PURGED_CONFIG = {
  k: 5,
  /** PURGE = 21 days (the OOS label horizon actually used in scoring). */
  purgeDays: 21,
  /** EMBARGO = 10 days. */
  embargoDays: 10,
  /** Exclusion zone per fold: the CLOSED interval [testStart−PURGE, testEnd+EMBARGO]
   *  clamped to the series bounds — the strict reading, so both the half-open
   *  train-set rule and the closed-set leakage assertion hold mechanically. */
} as const;

/** Purged K-fold block split: floor(756/5) = 151 days per block, the 1-day
 *  trailing remainder absorbed by the last block → 151/151/151/151/152. */
function purgedBlockBoundaries(n: number, k: number): [number, number][] {
  const base = Math.floor(n / k);
  const blocks: [number, number][] = [];
  let start = 0;
  for (let i = 0; i < k; i++) {
    const size = i === k - 1 ? n - start : base; // last block absorbs remainder
    blocks.push([start, start + size]);
    start += size;
  }
  return blocks;
}

// === Types (the committed-evidence JSON contract) ============================

/** The eight per-fold metrics (all disclosed conventions, see METRIC_NOTES). */
export interface WfMetricSet {
  /** Annualized OOS portfolio vol: √252 · population std of daily r_p (engine convention). */
  oosVolAnnualized: number;
  /** Annualized equal-weight benchmark vol over the same test days. */
  benchmarkEwVol: number;
  /** OOS Sharpe: mean(daily r_p)/std(daily r_p), rf = 0 — daily frequency, NOT annualized. */
  oosSharpe: number;
  /** Annualized tracking error vs equal-weight: √252 · std(r_p − r_ew). */
  trackingErrorVsEW: number;
  /** Max drawdown of the cumulative product path over the test window (≤ 0). */
  oosMaxDrawdown: number;
  /** Σ|w_k − w_{k−1}|/2 (fold 0 measured vs static equal weights 1/7). */
  weightTurnover: number;
  /** Portfolio vol estimated on the TRAIN window with the fold's held weights. */
  inSampleVol: number;
  /** oosVolAnnualized / inSampleVol. */
  overfitRatio: number;
}

export interface WfFoldRecord extends WfMetricSet {
  fold: number;
  /** Train index ranges as half-open [start, end) day intervals (1 for
   *  walk-forward; 1–2 disjoint ranges for purged folds). */
  trainRanges: [number, number][];
  /** Test block as a half-open [start, end) day interval. */
  testRange: [number, number];
  trainDays: number;
  testDays: number;
  /** The OOS-scored weights (§8.1 envelope-projected ensemble target). */
  weights: WeightVector;
  /** The raw §7.5 uniform-family ensemble target BEFORE the §8.1 projection. */
  ensembleTarget: WeightVector;
}

export interface WfAggregate {
  folds: number;
  /** Total out-of-sample days scored across folds (concatenated OOS record). */
  oosDaysScored: number;
  mean: WfMetricSet;
  median: WfMetricSet;
}

export interface LeakageFoldCheck {
  fold: number;
  testRange: [number, number];
  /** Closed exclusion zone [lo, hi] actually enforced (clamped to bounds). */
  exclusionZone: [number, number];
  trainDays: number;
  /** Days removed by purge+embargo+test (series length − trainDays). */
  excludedDays: number;
  /** |train ∩ exclusionZone| — MUST be 0; a non-zero count throws. */
  trainIntersectionWithZone: number;
  ok: boolean;
}

export interface LeakageCheck {
  verified: boolean;
  purgeDays: number;
  embargoDays: number;
  method: string;
  /** §23.4 purged K-fold mechanical checks. */
  perFold: LeakageFoldCheck[];
  /** §23.3 walk-forward mechanical checks (train ∩ test = ∅ per fold). */
  walkForward: {
    perFold: { fold: number; trainRange: [number, number]; testRange: [number, number]; trainIntersectionWithTest: number; ok: boolean }[];
  };
}

export interface WalkForwardResults {
  program: string;
  generatedAt: number;
  runtimeMs: number;
  config: Record<string, unknown>;
  walkForward: { folds: WfFoldRecord[]; aggregate: WfAggregate };
  purgedKfold: { folds: WfFoldRecord[]; aggregate: WfAggregate };
  leakageCheck: LeakageCheck;
  disclosure: string;
}

export const WF_METRIC_KEYS = [
  "oosVolAnnualized",
  "benchmarkEwVol",
  "oosSharpe",
  "trackingErrorVsEW",
  "oosMaxDrawdown",
  "weightTurnover",
  "inSampleVol",
  "overfitRatio",
] as const;

// === Small math helpers (population conventions, matching mase.ts) =========

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/** Population std (mase.ts horizonVol/estimateVolatility convention: ÷n). */
function populationStd(xs: number[]): number {
  if (xs.length < 1) return 0;
  const m = mean(xs);
  return Math.sqrt(Math.max(0, xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length));
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Min drawdown of the cumulative product path V_t = Π(1 + r_s) (≤ 0). */
function maxDrawdownPath(rs: number[]): number {
  let v = 1;
  let peak = 1;
  let mdd = 0;
  for (const r of rs) {
    v *= 1 + r;
    if (v > peak) peak = v;
    const dd = peak > 0 ? v / peak - 1 : 0;
    if (dd < mdd) mdd = dd;
  }
  return mdd;
}

function equalWeights(): WeightVector {
  const w = {} as WeightVector;
  for (const c of COMPONENTS) w[c] = 1 / COMPONENTS.length;
  return w;
}

/** Turnover Σ|w_a − w_b|/2 between two weight vectors. */
function turnoverBetween(a: WeightVector, b: WeightVector): number {
  return COMPONENTS.reduce((acc, c) => acc + Math.abs((a[c] ?? 0) - (b[c] ?? 0)), 0) / 2;
}

function rangeIndices(start: number, endExclusive: number): number[] {
  const out: number[] = [];
  for (let t = start; t < endExclusive; t++) out.push(t);
  return out;
}

// === Series slicing (the leakage boundary discipline lives here) ===========

/** Contiguous [start, endExclusive) slice of the full series. */
function sliceSeries(series: SimReturnSeries, start: number, endExclusive: number): SimReturnSeries {
  const returns = {} as Record<Component, number[]>;
  for (const c of COMPONENTS) returns[c] = series.returns[c].slice(start, endExclusive);
  return { returns, days: endExclusive - start, disclosure: series.disclosure };
}

/** Concatenation of kept days (indices ascending). For §23.4 purged folds the
 *  TRAIN set is this non-contiguous union; the covariance/vol estimators are
 *  then computed over the concatenated kept days — the leakage-controlled
 *  estimator. HONEST-LAYER NOTE: the §5.1 horizon windows are measured in KEPT
 *  SAMPLES over this purged union, not calendar days — a disclosed pilot-scale
 *  approximation (production §23.4 re-derives calendar-true windows from the
 *  validated multi-source history). */
function concatSeries(series: SimReturnSeries, indices: number[]): SimReturnSeries {
  const returns = {} as Record<Component, number[]>;
  for (const c of COMPONENTS) {
    const src = series.returns[c];
    returns[c] = indices.map((t) => src[t] ?? 0);
  }
  return { returns, days: indices.length, disclosure: series.disclosure };
}

// === The estimator-family refit (mirrors maseEnsemble on a train slice) =====

function fitEnsembleOnSeries(
  trainSeries: SimReturnSeries,
  prices: PriceData,
  regime: MarketRegime,
): { ensembleTarget: WeightVector; heldWeights: WeightVector } {
  // buildRiskContext (corr = null path), verbatim, on the TRAIN slice:
  const mh = multiHorizonVols(trainSeries);
  const blended = mh.blended; // §5.1 σ^MH governs every downstream vol figure
  const sigmaHat = blendedCovariance(trainSeries); // §6.1 Σ̂ = Σ_h ω_h·Cov_h
  const shrunk = shrinkCovariance(sigmaHat); // §6.2 Σ_robust = λF + (1−λ)Σ̂
  const vixFactor = Math.min(5, Math.max(0.2, regime.vix > 0 ? regime.vix / 18.5 : 1));
  const crisis = computeCrisisScore({
    sigmaRobust: shrunk.sigmaRobust,
    blendedVols: blended,
    vixFactor,
    avgCorrelation: shrunk.avgOffDiagonal,
    series: trainSeries,
  });
  const regime6 = classifySixRegimes({
    regime,
    avgCorrelation: shrunk.avgOffDiagonal,
    crisisScore: crisis.score,
  });
  // The model context maseEnsemble hands every member (returns = TRAIN slice).
  const modelCtx = { returns: trainSeries.returns, sigmaRobust: shrunk.sigmaRobust, regime6, crisis };

  // The seven §7.5 member models with maseEnsemble's exact argument wiring:
  const minvar = modelMinimumVariance(blended, prices, shrunk.corr, modelCtx);
  const erc = modelEqualRiskContribution(blended, prices, shrunk.corr, modelCtx);
  const maxdiv = modelMaxDiversification(blended, prices, shrunk.corr, modelCtx);
  const cvar = modelCVaR(blended, prices, shrunk.corr, regime, modelCtx);
  const ppp = modelPurchasingPower(blended, prices, shrunk.corr);
  const institutional = modelInstitutional(blended, prices, shrunk.corr, regime);
  const regimeAdaptive = modelRegimeAdaptive(blended, prices, shrunk.corr, regime, modelCtx);

  // §7.5 family assembly: Stability = 50/50 min-var/ERC; the six families are
  // combined with the uniform pilot weight 1/6 each (the engine's cold-start
  // §7.5 form — no adaptive §7.6 α inside a single fold's fit).
  const stability = blendWeights(minvar, erc, 0.5);
  const families: WeightVector[] = [stability, maxdiv, cvar, ppp, institutional, regimeAdaptive];
  const ensembleWeight = 1 / families.length;
  const ensembleTarget: WeightVector = { USD: 0, EUR: 0, JPY: 0, GBP: 0, CNY: 0, CHF: 0, Gold: 0 };
  for (const f of families) {
    for (const c of COMPONENTS) ensembleTarget[c] += f[c] * ensembleWeight;
  }
  // §8.1 — the engine's publication step (engine.ts applies applyEnvelopes to
  // the ensemble target before any downstream consumption). The walk-forward
  // OOS portfolio is scored on THIS constrained vector — the weights the
  // engine would actually publish for that window.
  return { ensembleTarget, heldWeights: applyEnvelopes(ensembleTarget) };
}

// === Fold evaluation ========================================================

function portfolioReturnsAt(weights: WeightVector, series: SimReturnSeries, indices: number[]): number[] {
  return indices.map((t) => COMPONENTS.reduce((acc, c) => acc + weights[c] * (series.returns[c][t] ?? 0), 0));
}

function evaluateFold(params: {
  held: WeightVector;
  testIndices: number[];
  fullSeries: SimReturnSeries;
  trainSeries: SimReturnSeries;
  prevHeld: WeightVector;
}): WfMetricSet {
  const { held, testIndices, fullSeries, trainSeries, prevHeld } = params;
  const ew = equalWeights();
  const rsOos = portfolioReturnsAt(held, fullSeries, testIndices);
  const rsEw = portfolioReturnsAt(ew, fullSeries, testIndices);
  const diff = rsOos.map((r, t) => r - rsEw[t]);
  const oosVolAnnualized = Math.sqrt(252) * populationStd(rsOos);
  const inSampleVol = Math.sqrt(252) * populationStd(portfolioReturnsAt(held, trainSeries, rangeIndices(0, trainSeries.days)));
  const oosStd = populationStd(rsOos);
  return {
    oosVolAnnualized,
    benchmarkEwVol: Math.sqrt(252) * populationStd(rsEw),
    oosSharpe: oosStd > 1e-12 ? mean(rsOos) / oosStd : 0,
    trackingErrorVsEW: Math.sqrt(252) * populationStd(diff),
    oosMaxDrawdown: maxDrawdownPath(rsOos),
    weightTurnover: turnoverBetween(held, prevHeld),
    inSampleVol,
    overfitRatio: inSampleVol > 1e-12 ? oosVolAnnualized / inSampleVol : 0,
  };
}

function aggregateFolds(folds: WfFoldRecord[], oosDaysScored: number): WfAggregate {
  const mk = (fn: (xs: number[]) => number): WfMetricSet => {
    const out = {} as WfMetricSet;
    for (const key of WF_METRIC_KEYS) {
      out[key] = fn(folds.map((f) => f[key] as number));
    }
    return out;
  };
  return {
    folds: folds.length,
    oosDaysScored,
    mean: mk(mean),
    median: mk(median),
  };
}

// === §23.3 rolling walk-forward (8 folds) ====================================

function runWalkForward(series: SimReturnSeries): {
  folds: WfFoldRecord[];
  aggregate: WfAggregate;
  leakage: LeakageCheck["walkForward"];
} {
  const folds: WfFoldRecord[] = [];
  const wfLeakage: LeakageCheck["walkForward"] = { perFold: [] };
  let prevHeld = equalWeights(); // fold 0's turnover baseline: static equal weights
  for (let k = 0; k < WF_CONFIG.folds; k++) {
    const trainEnd = WF_CONFIG.initialTrainDays + k * WF_CONFIG.stepDays;
    const testStart = trainEnd;
    const testEnd = testStart + WF_CONFIG.testDays;
    // Mechanical leakage check: train [0, trainEnd) ∩ test [testStart, testEnd) = ∅.
    const intersection = rangeIndices(0, trainEnd).filter((t) => t >= testStart && t < testEnd).length;
    if (intersection !== 0) {
      throw new Error(`§23.3 walk-forward leakage detected in fold ${k}: ${intersection} train day(s) inside the test window`);
    }
    wfLeakage.perFold.push({
      fold: k,
      trainRange: [0, trainEnd],
      testRange: [testStart, testEnd],
      trainIntersectionWithTest: intersection,
      ok: true,
    });
    // Fit on the TRAIN slice only, then score the TEST slice with held weights.
    const trainSeries = sliceSeries(series, 0, trainEnd);
    const { ensembleTarget, heldWeights } = fitEnsembleOnSeries(trainSeries, BASELINE_PRICES, BASELINE_REGIME);
    const metrics = evaluateFold({
      held: heldWeights,
      testIndices: rangeIndices(testStart, testEnd),
      fullSeries: series,
      trainSeries,
      prevHeld,
    });
    folds.push({
      fold: k,
      trainRanges: [[0, trainEnd]],
      testRange: [testStart, testEnd],
      trainDays: trainEnd,
      testDays: testEnd - testStart,
      weights: heldWeights,
      ensembleTarget,
      ...metrics,
    });
    prevHeld = heldWeights;
  }
  const oosDaysScored = folds.reduce((a, f) => a + f.testDays, 0);
  return { folds, aggregate: aggregateFolds(folds, oosDaysScored), leakage: wfLeakage };
}

// === §23.4 purged + embargoed K-fold CV (K = 5) ==============================

function runPurgedKfold(series: SimReturnSeries): {
  folds: WfFoldRecord[];
  aggregate: WfAggregate;
  leakage: LeakageFoldCheck[];
} {
  const n = series.days;
  const blocks = purgedBlockBoundaries(n, PURGED_CONFIG.k);
  const folds: WfFoldRecord[] = [];
  const perFold: LeakageFoldCheck[] = [];
  let prevHeld = equalWeights(); // fold 0's turnover baseline: static equal weights
  for (let k = 0; k < blocks.length; k++) {
    const [testStart, testEnd] = blocks[k];
    // Closed exclusion zone [testStart − PURGE, testEnd + EMBARGO], clamped to
    // the series bounds. Strict (closed) reading — the mechanical assertion
    // train ∩ [testStart−PURGE, testEnd+EMBARGO] = ∅ is checked against this
    // exact zone, so the half-open train rule holds a fortiori.
    const zoneLo = Math.max(0, testStart - PURGED_CONFIG.purgeDays);
    const zoneHi = Math.min(n - 1, testEnd + PURGED_CONFIG.embargoDays);
    const allDays = rangeIndices(0, n);
    const trainIndices = allDays.filter((t) => t < zoneLo || t > zoneHi);
    // MECHANICAL leakage verification (never narrative): count the actual
    // intersection of the train index set with the closed zone; non-zero ⇒ throw.
    const intersection = trainIndices.filter((t) => t >= zoneLo && t <= zoneHi).length;
    if (intersection !== 0) {
      throw new Error(
        `§23.4 purged K-fold leakage detected in fold ${k}: ${intersection} train day(s) inside the exclusion zone [${zoneLo}, ${zoneHi}]`,
      );
    }
    // Sanity: the test block itself must be entirely inside the excluded zone.
    const testInsideZone = rangeIndices(testStart, testEnd).every((t) => t >= zoneLo && t <= zoneHi);
    if (!testInsideZone) {
      throw new Error(`§23.4 purged K-fold fold ${k}: test block [${testStart}, ${testEnd}) not fully covered by the exclusion zone`);
    }
    perFold.push({
      fold: k,
      testRange: [testStart, testEnd],
      exclusionZone: [zoneLo, zoneHi],
      trainDays: trainIndices.length,
      excludedDays: n - trainIndices.length,
      trainIntersectionWithZone: intersection,
      ok: true,
    });
    // Fit on the purged train UNION (non-contiguous), score the test block.
    const trainSeries = concatSeries(series, trainIndices);
    const { ensembleTarget, heldWeights } = fitEnsembleOnSeries(trainSeries, BASELINE_PRICES, BASELINE_REGIME);
    const metrics = evaluateFold({
      held: heldWeights,
      testIndices: rangeIndices(testStart, testEnd),
      fullSeries: series,
      trainSeries,
      prevHeld,
    });
    // Compact 1–2 range representation of the kept-day union for the record.
    const trainRanges: [number, number][] = [];
    let cursor = 0;
    while (cursor < trainIndices.length) {
      const start = trainIndices[cursor];
      let end = start;
      while (cursor + 1 < trainIndices.length && trainIndices[cursor + 1] === end + 1) {
        cursor++;
        end++;
      }
      trainRanges.push([start, end + 1]);
      cursor++;
    }
    folds.push({
      fold: k,
      trainRanges,
      testRange: [testStart, testEnd],
      trainDays: trainIndices.length,
      testDays: testEnd - testStart,
      weights: heldWeights,
      ensembleTarget,
      ...metrics,
    });
    prevHeld = heldWeights;
  }
  const oosDaysScored = folds.reduce((a, f) => a + f.testDays, 0);
  return { folds, aggregate: aggregateFolds(folds, oosDaysScored), leakage: perFold };
}

// === Program entry ===========================================================

export const WF_DISCLOSURE =
  "PILOT-SCALE RUN RECORD — internal evidence only. This record is a pilot-scale execution of §23.3 rolling walk-forward validation (8 folds, 252d initial train / 63d test / 63d step) and §23.4 purged/embargoed K-fold cross-validation (K=5, 21-day purge, 10-day embargo, mechanically verified empty train/test intersection) over the engine's deterministic simulated 756-day daily return series (fixed-seed one-factor model, disclosed loadings, disclosed baseline calibration — NOT live market data). It is NOT the production §23.3/§23.4 program, which requires ≥10 years of validated multi-source market data and the full §23.12 evidence sequence. No §25.5 validation gate is claimed as passed by this record. All figures are descriptive statistics of this simulated exercise only — never pass/fail claims, and never performance claims about MTQΣ (§23.1 negative rule: Perf(old architecture) ⇏ Perf(MTQΣ)).";

/** Run the full pilot-scale §23.3 + §23.4 program. Deterministic except for
 *  generatedAt/runtimeMs wall-clock metadata. Throws on any detected leakage. */
export function runWalkForwardProgram(): WalkForwardResults {
  const t0 = Date.now();
  const series = buildSimulatedReturnSeries(BASELINE_VOLS, BASELINE_REGIME);
  if (series.days !== 756) {
    throw new Error(`§23.3/§23.4 pilot expects the 756-day series, got ${series.days}`);
  }
  const wf = runWalkForward(series);
  const pk = runPurgedKfold(series);
  const runtimeMs = Date.now() - t0;
  const leakageCheck: LeakageCheck = {
    verified: wf.leakage.perFold.every((c) => c.ok) && pk.leakage.every((c) => c.ok),
    purgeDays: PURGED_CONFIG.purgeDays,
    embargoDays: PURGED_CONFIG.embargoDays,
    method: "mechanical index-set intersection: |train ∩ [testStart−PURGE, testEnd+EMBARGO]| counted per fold (must be 0 — the program throws otherwise); walk-forward additionally asserts |train ∩ test| = 0 per fold",
    perFold: pk.leakage,
    walkForward: wf.leakage,
  };
  if (!leakageCheck.verified) {
    throw new Error("§23.3/§23.4 leakage check FAILED — results are not publishable");
  }
  return {
    program: "MTQΣ §23.3/§23.4 walk-forward + purged K-fold CV (pilot-scale)",
    generatedAt: Date.now(),
    runtimeMs,
    config: {
      series: {
        source: "src/lib/mtq/mase.ts buildSimulatedReturnSeries — deterministic simulated series",
        days: series.days,
        model: "fixed-seed one-factor (dollar-strength) daily model, disclosed loadings",
        baselineVols: BASELINE_VOLS,
        baselineRegime: BASELINE_REGIME,
        baselinePrices: BASELINE_PRICES,
        calibrationNote:
          "disclosed baseline calibration constants (the engine's non-VIX-stressed defaults) — NOT live market data; vix=18.5 ⇒ VIX factor 1 ⇒ stationary vol path at the baseline vols",
        disclosure: series.disclosure,
      },
      walkForward: { ...WF_CONFIG, scheme: "rolling: fold k trains on [0, 252+k·63), tests on [252+k·63, 252+(k+1)·63); weights fitted on train only and held fixed inside the fold (daily rebalancing to fixed fractions)" },
      purgedKfold: {
        ...PURGED_CONFIG,
        blockSizes: [151, 151, 151, 151, 152],
        blockSplit: "floor(756/5)=151 per block; the 1-day trailing remainder is absorbed by the last block",
        exclusionZone: "closed [testStart−21, testEnd+10] clamped to series bounds (strict reading: satisfies both the half-open train-set rule and the closed-set leakage assertion)",
        estimatorNote:
          "covariance/vol estimators are refit on the concatenation of kept days (the purged union) — the leakage-controlled estimator; §5.1 horizon windows are measured in kept samples over the union, a disclosed pilot-scale approximation of the calendar-true production windows",
      },
      estimatorFamily: {
        replication:
          "maseEnsemble cannot be called with a sliced series (it derives the full 756-day series internally), so its pipeline is replicated verbatim on each train slice from the same exported mase.ts functions: multiHorizonVols → blendedCovariance → shrinkCovariance → computeCrisisScore → classifySixRegimes → 7 member models → 50/50 Stability blend → uniform 1/6 family average",
        heldWeights: "§8.1 envelope-projected ensemble target (the engine publication step — engine.ts applies applyEnvelopes to the ensemble target); §8.4/§8.3 smoothing/velocity need persisted engine state and are NOT simulated inside a fold (weights held fixed per fold — pilot design)",
        adaptiveAlpha: "none — uniform §7.5 1/6 family weights (the engine's cold-start form; §7.6 adaptive α requires the engine's persisted OOS ledger)",
      },
      metrics: {
        vol: "annualized √252 · population std (engine convention: mase.ts horizonVol/estimateVolatility)",
        oosSharpe: "mean(daily r_p)/std(daily r_p), rf=0 — daily frequency, NOT annualized",
        trackingErrorVsEW: "annualized std of r_p − r_ew (equal-weight benchmark)",
        oosMaxDrawdown: "min drawdown of the cumulative product path over the fold's test window",
        weightTurnover: "Σ|w_k − w_{k−1}|/2 between consecutive folds' held weights; fold 0 vs static equal weights 1/7",
        inSampleVol: "annualized portfolio vol on the train window under the fold's held weights",
        overfitRatio: "oosVolAnnualized / inSampleVol",
      },
    },
    walkForward: { folds: wf.folds, aggregate: wf.aggregate },
    purgedKfold: { folds: pk.folds, aggregate: pk.aggregate },
    leakageCheck,
    disclosure: WF_DISCLOSURE,
  };
}
