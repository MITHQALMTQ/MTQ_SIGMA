// MTQΣ — MASE (Multi-model Adaptive Stability Engine) v1.0 + v2.0 §5/§6 risk estimators
// Implements the candidate models from §6 (in the exact v2.0 forms) and the ensemble
// families of §7.5. Each model computes a weight vector W^Target for the 7 components
// (USD, EUR, JPY, GBP, CNY, CHF, Gold); the ensemble combines them per §7.5's six
// families. The §5.1/§5.4/§5.5/§6.1/§6.2 risk-estimation layer below feeds every
// candidate model (v2.0 blueprint — see the §-map at the top of the risk block).

import { STRATEGIC_PRIOR, ADMISSIBILITY_ENVELOPES, SMOOTHING_RHO_NORMAL, SMOOTHING_RHO_STRESS, MAX_VELOCITY } from "./blueprint";
// M8-3a (2026-10-23, owner-delegated) — conservative registry-aware domain
// adapter (see the adapter block below the WeightVector type). Import is safe
// for the existing engine path: nothing below consumes the registry
// implicitly; the adapter is opt-in for callers/tests.
import { ComponentRegistry, DEFAULT_REGISTRY } from "./constituency/registry";
import type { LifecycleState } from "./constituency/types";

export type Component = "USD" | "EUR" | "JPY" | "GBP" | "CNY" | "CHF" | "Gold";
export const COMPONENTS: Component[] = ["USD", "EUR", "JPY", "GBP", "CNY", "CHF", "Gold"];

export interface PriceData {
  // Returns relative to base date (P_{i,t} / P_{i,0})
  USD: number;  // Always 1.0 (base currency)
  EUR: number;
  JPY: number;
  GBP: number;
  CNY: number;
  CHF: number;
  Gold: number;
}

export interface VolatilityData {
  // Annualized volatility estimates per component (from rolling window)
  USD: number; EUR: number; JPY: number; GBP: number; CNY: number; CHF: number; Gold: number;
}

export interface CorrelationData {
  // 7×7 correlation matrix (compact: upper triangle as flat array)
  // Order: USD, EUR, JPY, GBP, CNY, CHF, Gold
  matrix: number[][];
}

export interface MarketRegime {
  // Regime classification (0=calm, 1=normal, 2=stress, 3=crisis)
  regime: 0 | 1 | 2 | 3;
  vix: number;
  dxy: number;
  goldVol: number;
}

export type WeightVector = Record<Component, number>;

// =============================================================================
// M8-3a (2026-10-23, owner-delegated) — REGISTRY-AWARE DOMAIN ADAPTER
// (conservative integration of the constituency registry into the optimizer).
// =============================================================================
// WHAT IS REGISTRY-AWARE NOW: the optimizer's DOMAIN can be READ from the
// constituency component registry (src/lib/mtq/constituency/registry.ts — the
// Map-keyed stable-ID registry whose ACTIVE set IS the basket membership per
// spec §2/§3). registryMaseDomain() derives the ACTIVE component set from a
// registry and maps it onto this module's fixed Component labels;
// pinNonActiveToZero() projects any WeightVector by pinning every component
// whose registry lifecycle state is not weight-bearing (spec §6 item 1:
// non-ACTIVE slots pinned to exactly 0, excluded from the optimization).
//
// WHAT REMAINS FIXED, PRECISELY (the honest boundary of this integration):
// the Component union, PriceData, VolatilityData, CorrelationData, and
// WeightVector remain the FIXED 7-label domain of mase.ts:10-43 — every model
// and the §7.5/§7.6 ensemble below still optimize over exactly those labels.
// Post-genesis registry members carry NO maseLabel and are reported as
// UNREPRESENTABLE by this adapter: making the optimizer domain itself
// registry-driven (spec §6 item 1 / RESULTS.md §2.3 Phase 2 — "MASE domain
// change: optimization reads the ACTIVE set from the registry") requires
// re-typing every model + the walk-forward OOS ledger (segmentation by
// registryVersion, spec §6 item 5 — UNRESOLVED) and is GATED on Gate B/C +
// D-13.11 + D-13.14, so it is NOT done in M8-3a. With the DEFAULT registry
// (the quiescent 7-component genesis set) this adapter is the IDENTITY: all
// 7 ACTIVE, domain = the full fixed set, nothing pinned — the ensemble's
// behavior is unchanged (the canonical suite is green untouched).
// =============================================================================

/** The fixed-domain label set (compile-time membership check for the bridge). */
const COMPONENTS_LABELS: Record<string, true> = {
  USD: true, EUR: true, JPY: true, GBP: true, CNY: true, CHF: true, Gold: true,
};

export interface RegistryMaseDomainView {
  /** The ACTIVE component labels in the fixed canonical order — the
   *  optimization domain implied by the registry. */
  domain: Component[];
  /** Stable registry ID → fixed MASE label, for every representable member. */
  idToLabel: Record<string, Component>;
  /** Registry members whose ACTIVE status the fixed 7-label domain cannot
   *  express (post-genesis admissions until the Phase-2 domain change). */
  unrepresentableIds: string[];
  /** Current lifecycle state per fixed label (registry view). */
  statusByLabel: Partial<Record<Component, LifecycleState>>;
  /** Honest scope note (machine-readable for callers/tests). */
  scopeNote: string;
}

/** The registry's ACTIVE membership expressed in the fixed MASE domain.
 *  Registry-driven but CONSERVATIVE: read-only; no model below consumes it
 *  implicitly — callers must opt in. */
export function registryMaseDomain(registry: ComponentRegistry = DEFAULT_REGISTRY): RegistryMaseDomainView {
  const idToLabel: Record<string, Component> = {};
  const unrepresentableIds: string[] = [];
  const statusByLabel: Partial<Record<Component, LifecycleState>> = {};
  for (const id of registry.activeIds()) {
    const entry = registry.get(id);
    if (entry.maseLabel != null && entry.maseLabel in COMPONENTS_LABELS) {
      idToLabel[id] = entry.maseLabel as Component;
      statusByLabel[entry.maseLabel as Component] = entry.status;
    } else {
      unrepresentableIds.push(id);
    }
  }
  const domain = COMPONENTS.filter((c) => statusByLabel[c] === "ACTIVE");
  return {
    domain,
    idToLabel,
    unrepresentableIds,
    statusByLabel,
    scopeNote:
      "M8-3a conservative integration: the registry supplies the domain; the fixed Component union/PriceData/WeightVector types remain " +
      "the optimizer's compile-time domain (Phase 2 — the registry-driven MASE retyping — is gated on Gate B/C + D-13.11 + D-13.14 and NOT done).",
  };
}

/** Project a WeightVector onto the registry's weight-bearing membership:
 *  every genesis-label component whose registry state is not weight-bearing
 *  is pinned to exactly 0 (spec §6 item 1 + §5.4); weight-bearing components
 *  keep their value. Identity when the registry is the quiescent genesis set
 *  (all 7 ACTIVE). The caller must re-normalize afterwards when a pin moved
 *  mass (§5.4 pro-rata redistribution is the registry-era convention,
 *  renormalizeExcluding chain-index.ts:546). */
export function pinNonActiveToZero(
  weights: WeightVector,
  registry: ComponentRegistry = DEFAULT_REGISTRY,
): WeightVector {
  const out: WeightVector = { ...weights };
  const view = registryMaseDomain(registry);
  for (const c of COMPONENTS) {
    const status = view.statusByLabel[c];
    const known = status !== undefined;
    const weightBearing =
      status === "ACTIVE" || status === "WATCH" || status === "RETIRING" || status === "EMERGENCY-SUSPENDED";
    if (known && !weightBearing) out[c] = 0;
  }
  return out;
}


// =============================================================================
// v2.0 §5/§6 RISK-ESTIMATION LAYER (Task 8-a — blueprint-v2.0.txt)
// =============================================================================
// Blueprint line map (audit-work/blueprint-v2.0.txt — 23,535 lines):
//   §5.1 Multi-horizon volatility ....... L2451–2475 (σ_i^MH = Σ_h ω_h σ_{i,h})
//   §5.4 Six-regime probability model .... L2537–2563 (W^Regime = Σ P(r|X_t)·W^(r))
//   §5.5 Crisis-risk score ............... L2565–2615 (λ_CVaR,t = λ_0·(1+k·CS_t))
//   §6.1 Correlation matrix .............. L2618–2637 (Σ_t = Cov(R_1,…,R_n))
//   §6.2 Covariance shrinkage ............ L2639–2660 (Σ_robust = λF+(1−λ)Σ̂)
//   §6.3 Minimum variance ................ L2662–2678 (min_w w'Σ_robust,t w)
//   §6.4 ERC explicit objective ........... L2680–2698 (min_w Σ(RC%_i − 1/n)², COO-6)
//   §6.5 Maximum diversification ......... L2700–2715 (max_w (∑w_iσ_i)/√(w'Σw))
//   §6.6 VaR/CVaR + 99% monitor ........... L2717–2736 (VaR_α, CVaR_α at 95/99)
//   §6.7 Drawdown control ................ L2738–2752 (M_t, DD_t, MDD)
//   §6.8 GPP purchasing-power objective ... L2754–2776 (formula surfaced; proxy labeled)
//
// DATA-WINDOW HONESTY (§6.1 L2630–2634: return series are "built from the same
// validated multi-source prices used for index valuation"): the pilot holds NO
// validated 756-day price history in memory. Every estimator below therefore
// runs on a DETERMINISTIC simulated daily series — fixed-seed Gaussian one-
// factor model, disclosed loadings — whose trailing segment is calibrated to
// the live macro state (the former VIX/18.5 single-window baseline now supplies
// the h=30 horizon input) and whose older data reverts toward the static
// baseline vols. The FORMULAS below are the blueprint's, executed exactly; the
// DATA WINDOW is disclosed wherever results are published. Production swaps
// the series, not the math.
// =============================================================================

/** §5.1 — horizons h ∈ {30d, 90d, 252d, 756d} (blueprint L2458–2460). */
export const VOL_HORIZONS = [30, 90, 252, 756] as const;
export type VolHorizon = (typeof VOL_HORIZONS)[number];

/** §5.1 — horizon weights ω_h. "The exact horizon coefficients are validation
 *  parameters: they are candidates in the perturbation study (Section 23.6),
 *  and the selected vector is published with the methodology version"
 *  (blueprint L2465–2469). The PILOT INITIALIZATION VECTOR below is a
 *  DISCLOSED placeholder — NOT canonical — and is normalized so Σω_h = 1
 *  holds exactly (blueprint L2462). */
export const VOL_HORIZON_WEIGHTS: Record<VolHorizon, number> = normalizeWeights({
  30: 0.15,
  90: 0.25,
  252: 0.35,
  756: 0.25,
});

function normalizeWeights(w: Record<VolHorizon, number>): Record<VolHorizon, number> {
  const sum = VOL_HORIZONS.reduce((a, h) => a + (w[h] ?? 0), 0);
  const out = {} as Record<VolHorizon, number>;
  for (const h of VOL_HORIZONS) out[h] = sum > 0 ? (w[h] ?? 0) / sum : 1 / VOL_HORIZONS.length;
  return out;
}

/** §6.2 — shrinkage intensity λ for Σ_robust = λF + (1−λ)Σ̂. "λ is estimated
 *  or calibrated through out-of-sample validation" (blueprint L2646) — the
 *  value below is a DISCLOSED pilot initialization constant, published here
 *  and perturbation-tested per §23.6 before any methodology version adopts
 *  it. NOT canonical. */
export const COVARIANCE_SHRINKAGE_LAMBDA = 0.20;

// --- Deterministic simulated series (stands in for the validated history) ---
/** Series length = the longest §5.1 horizon (756 trading days ≈ 3 years). */
export const SIM_SERIES_DAYS = 756;
/** Half-life (days) at which the simulated vol path reverts from the live
 *  VIX-calibrated level toward the static baseline going back in time.
 *  Disclosed pilot parameter of the DATA, not of any estimator. */
const SIM_VOL_HALF_LIFE_DAYS = 126;
const SIM_FACTOR_SEED = 0x4d54514d; // "MTQM" — fixed: no Math.random anywhere
const SIM_COMPONENT_SEED_BASE = 0x544f5155;

/** One-factor loadings β_i on a common "dollar-strength" factor F_t
 *  (components quoted USD-per-unit fall when the dollar strengthens).
 *  Disclosed pilot structure of the simulated DATA; Implied ρ_ij ≈ β_iβ_j. */
const DOLLAR_FACTOR_BETA: Record<Component, number> = {
  USD: 0.00,
  EUR: -0.55,
  JPY: -0.45,
  GBP: -0.50,
  CNY: -0.30,
  CHF: -0.60,
  Gold: -0.25,
};

/** mulberry32 — small deterministic PRNG (fixed seeds ⇒ identical series on
 *  every call, so repeated snapshots within a tick are idempotent). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a ^ (a >>> 15);
    t = Math.imul(t, 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | a)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller N(0,1) draw from a uniform PRNG (guarded log). */
function gauss(prng: () => number): number {
  let u1 = prng();
  if (u1 < 1e-12) u1 = 1e-12;
  const u2 = prng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export interface SimReturnSeries {
  /** Daily simple returns (fractions) per component, oldest → newest. */
  returns: Record<Component, number[]>;
  days: number;
  disclosure: string;
}

/** Build the deterministic simulated daily return series (see data-window
 *  honesty note above). The trailing segment carries the live VIX regime
 *  (current vols = the engine's h=30 input); older data mean-reverts toward
 *  the static baseline vols with a 126-day half-life. */
export function buildSimulatedReturnSeries(vols: VolatilityData, regime: MarketRegime): SimReturnSeries {
  const f = Math.min(5, Math.max(0.2, regime.vix > 0 ? regime.vix / 18.5 : 1));
  const factorPrng = mulberry32(SIM_FACTOR_SEED);
  const F: number[] = [];
  for (let t = 0; t < SIM_SERIES_DAYS; t++) F.push(gauss(factorPrng));
  const returns = {} as Record<Component, number[]>;
  COMPONENTS.forEach((c, idx) => {
    const prng = mulberry32(SIM_COMPONENT_SEED_BASE + idx * 7919);
    const currentDaily = Math.max(vols[c] ?? 0.1, 1e-6) / Math.sqrt(252);
    const anchorDaily = currentDaily / f;
    const beta = DOLLAR_FACTOR_BETA[c];
    const idio = Math.sqrt(Math.max(0, 1 - beta * beta));
    const arr: number[] = [];
    for (let t = 0; t < SIM_SERIES_DAYS; t++) {
      // vol path: newest sample carries currentDaily, decaying toward anchor
      // going back in time with a 126-day half-life.
      const age = SIM_SERIES_DAYS - 1 - t;
      const vol = anchorDaily + (currentDaily - anchorDaily) * Math.exp(-age / SIM_VOL_HALF_LIFE_DAYS);
      arr.push(vol * (beta * F[t] + idio * gauss(prng)));
    }
    returns[c] = arr;
  });
  return {
    returns,
    days: SIM_SERIES_DAYS,
    disclosure:
      "Deterministic simulated 756-day daily series (fixed-seed one-factor model, loadings disclosed) — trailing segment calibrated to live VIX (h=30 input), older data reverts to static baselines (126d half-life). Stands in for the blueprint's validated multi-source price history (§6.1); production swaps the series, not the formulas.",
  };
}

// --- §5.1 horizon estimators -------------------------------------------------

/** Annualized volatility over the trailing `h` samples (population std × √252,
 * matching estimateVolatility's convention). When fewer than h samples exist
 * the available data is used (the §5.3 "window not full" rule). */
export function horizonVol(returns: number[], h: number): number {
  const n = Math.min(h, returns.length);
  if (n < 2) return 0;
  const win = returns.slice(returns.length - n);
  const mean = win.reduce((a, b) => a + b, 0) / n;
  const variance = win.reduce((a, r) => a + (r - mean) ** 2, 0) / n;
  return Math.sqrt(Math.max(0, variance) * 252);
}

export interface VolHorizonEstimate {
  component: Component;
  /** Annualized σ_{i,h} per trailing window. */
  h30: number; h90: number; h252: number; h756: number;
  /** σ_i^MH = Σ_h ω_h σ_{i,h} — the §5.1 blend that GOVERNS downstream. */
  blended: number;
}

/** §5.1 exact estimator: σ_i^MH = Σ_h ω_h σ_{i,h} with Σω_h = 1 (L2455–2462). */
export function multiHorizonVols(series: SimReturnSeries): {
  perComponent: VolHorizonEstimate[];
  blended: VolatilityData;
} {
  const perComponent: VolHorizonEstimate[] = COMPONENTS.map((c) => {
    const r = series.returns[c];
    const h30 = horizonVol(r, 30);
    const h90 = horizonVol(r, 90);
    const h252 = horizonVol(r, 252);
    const h756 = horizonVol(r, 756);
    const blended =
      VOL_HORIZON_WEIGHTS[30] * h30 +
      VOL_HORIZON_WEIGHTS[90] * h90 +
      VOL_HORIZON_WEIGHTS[252] * h252 +
      VOL_HORIZON_WEIGHTS[756] * h756;
    return { component: c, h30, h90, h252, h756, blended };
  });
  const blended = {} as VolatilityData;
  for (const e of perComponent) blended[e.component] = e.blended;
  return { perComponent, blended };
}

// --- §6.1 multi-horizon covariance -------------------------------------------

/** Population covariance over the trailing h samples, annualized (×252). */
function horizonCov(a: number[], b: number[], h: number): number {
  const n = Math.min(h, a.length, b.length);
  if (n < 2) return 0;
  const ra = a.slice(a.length - n);
  const rb = b.slice(b.length - n);
  const ma = ra.reduce((x, y) => x + y, 0) / n;
  const mb = rb.reduce((x, y) => x + y, 0) / n;
  let acc = 0;
  for (let t = 0; t < n; t++) acc += (ra[t] - ma) * (rb[t] - mb);
  return (acc / n) * 252;
}

/** §6.1 + §6.2[COO-3]: Σ̂ = Σ_h ω_h · Cov_h — the per-horizon covariance
 *  estimates of the §5.1 windows combined with the published ω blend ("the
 *  published methodology version records which per-horizon estimates were
 *  combined and how" — this record IS the ω vector above). */
export function blendedCovariance(series: SimReturnSeries): number[][] {
  const n = COMPONENTS.length;
  const sigmaHat: number[][] = [];
  for (let i = 0; i < n; i++) sigmaHat.push(new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let v = 0;
      for (const h of VOL_HORIZONS) v += VOL_HORIZON_WEIGHTS[h] * horizonCov(series.returns[COMPONENTS[i]], series.returns[COMPONENTS[j]], h);
      sigmaHat[i][j] = v;
      sigmaHat[j][i] = v;
    }
  }
  return sigmaHat;
}

// --- §6.2 shrinkage -----------------------------------------------------------

export interface ShrunkCovariance {
  /** Σ_robust = λF + (1−λ)Σ̂ (annualized). */
  sigmaRobust: number[][];
  /** Correlation matrix derived from Σ_robust (§6.1 output form). */
  corr: CorrelationData;
  /** Mean off-diagonal ρ of Σ̂ (drives the constant-correlation target F). */
  avgOffDiagonal: number;
  shrinkageLambda: number;
  target: string;
}

/** §6.2 exact estimator: Σ_robust = λF + (1−λ)Σ̂ with F the constant-
 *  correlation structured target (ρ̄ from Σ̂, variances preserved) — "a stable
 *  factor/reference matrix … chosen for its stability" (blueprint L2645–2648).
 *  F keeps Σ̂'s diagonal, so √diag(Σ_robust) = √diag(Σ̂), the ω_h VARIANCE
 *  blend. HONEST-LAYER NOTE: the §5.1 standalone blend σ_i^MH = Σ_h ω_h σ_{i,h}
 *  blends STANDARD DEVIATIONS, so (σ^MH)² ≠ diag(Σ̂) (horizon-blend Jensen
 *  gap). The candidate solvers and the §7.4 Risk term therefore consume
 *  Σ_robust DIRECTLY — never a (vols, corr) reconstruction of it — and the
 *  corr matrix published here is the §6.1 correlation VIEW of Σ_robust. */
export function shrinkCovariance(sigmaHat: number[][]): ShrunkCovariance {
  const n = COMPONENTS.length;
  const volsArr: number[] = [];
  for (let i = 0; i < n; i++) volsArr.push(Math.sqrt(Math.max(sigmaHat[i][i], 0)));
  let rhoSum = 0;
  let rhoCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const denom = volsArr[i] * volsArr[j];
      if (denom > 1e-12) {
        rhoSum += sigmaHat[i][j] / denom;
        rhoCount++;
      }
    }
  }
  const rhoBar = rhoCount > 0 ? rhoSum / rhoCount : 0;
  const lambda = COVARIANCE_SHRINKAGE_LAMBDA;
  const sigmaRobust: number[][] = [];
  const corrMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    sigmaRobust.push(new Array(n).fill(0));
    corrMatrix.push(new Array(n).fill(0));
  }
  for (let i = 0; i < n; i++) {
    sigmaRobust[i][i] = sigmaHat[i][i]; // F keeps variances
    corrMatrix[i][i] = 1;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const fTarget = rhoBar * volsArr[i] * volsArr[j];
      const v = lambda * fTarget + (1 - lambda) * sigmaHat[i][j];
      sigmaRobust[i][j] = v;
      sigmaRobust[j][i] = v;
      const denom = volsArr[i] * volsArr[j];
      const rho = denom > 1e-12 ? v / denom : 0;
      corrMatrix[i][j] = rho;
      corrMatrix[j][i] = rho;
    }
  }
  return {
    sigmaRobust,
    corr: { matrix: corrMatrix },
    avgOffDiagonal: rhoBar,
    shrinkageLambda: lambda,
    target: "constant-correlation F (ρ̄ from Σ̂; variances preserved)",
  };
}

// --- Simplex-constrained projected-gradient solvers (§6.3–§6.6) ----------------

/** Euclidean projection onto the probability simplex {w ≥ 0, Σw = 1}
 *  (full-investment + non-negativity — the §7.4/§6.3 constraint set; the
 *  envelope and velocity constraints are applied downstream by the engine:
 *  applyEnvelopes §8.1 + smoothWeightsConstitutional §8.4/§8.3). */
function projectToSimplex(v: number[]): number[] {
  const n = v.length;
  const u = [...v].sort((a, b) => b - a);
  let css = 0;
  let rho = 1;
  for (let i = 0; i < n; i++) {
    css += u[i];
    if (u[i] - (css - 1) / (i + 1) > 0) rho = i + 1;
  }
  const theta = (u.slice(0, rho).reduce((a, b) => a + b, 0) - 1) / rho;
  return v.map((x) => Math.max(0, x - theta));
}

function matVec(m: number[][], v: number[]): number[] {
  return m.map((row, i) => row.reduce((a, x, j) => a + x * v[j], 0));
}

/** §6.3 — min_w w'Σ_robust w subject to full investment + non-negativity.
 *  Projected gradient descent (step 1/(2λ_max) via power iteration; 300
 *  iterations). Deterministic; PILOT SOLVER for the blueprint's exact form —
 *  the production numerical stack is a §23.4 validation deliverable. */
export function solveMinVariance(sigma: number[][], iters = 300): number[] {
  const n = sigma.length;
  let v = new Array(n).fill(1 / Math.sqrt(n));
  let lamMax = 0;
  for (let k = 0; k < 12; k++) {
    const y = matVec(sigma, v);
    const ny = Math.sqrt(y.reduce((a, b) => a + b * b, 0)) || 1;
    lamMax = ny;
    v = y.map((x) => x / ny);
  }
  const step = 1 / (2 * Math.max(lamMax, 1e-12));
  let w = projectToSimplex(new Array(n).fill(1 / n));
  for (let t = 0; t < iters; t++) {
    const grad = matVec(sigma, w).map((g) => 2 * g);
    const next = projectToSimplex(w.map((x, i) => x - step * grad[i]));
    const delta = next.reduce((a, b, i) => a + Math.abs(b - w[i]), 0);
    w = next;
    if (delta < 1e-11) break;
  }
  return w;
}

/** §6.4 — the COO-6 explicit form "the form the optimizer actually solves":
 *  min_w Σ_i (RC%_i − 1/n)² with RC_i = w_i(Σw)_i, RC%_i = RC_i/Σ_j RC_j
 *  (blueprint L2681–2685). Projected (normalized) gradient descent, warm-
 *  started from inverse-vol. Deterministic PILOT SOLVER. */
export function solveEqualRiskContribution(sigma: number[][], warm: number[], iters = 500): number[] {
  const n = sigma.length;
  let w = projectToSimplex(warm.map((x) => Math.max(x, 0)));
  const invN = 1 / n;
  for (let t = 0; t < iters; t++) {
    const sw = matVec(sigma, w);
    const S = w.reduce((a, wi, i) => a + wi * sw[i], 0);
    if (S <= 1e-18) break;
    const rcPct = w.map((wi, i) => (wi * sw[i]) / S);
    const grad = new Array(n).fill(0);
    for (let k = 0; k < n; k++) {
      let acc = 0;
      for (let i = 0; i < n; i++) {
        const dRc = ((k === i ? sw[i] : 0) + w[i] * sigma[i][k]) / S - (w[i] * sw[i]) * ((2 * sw[k]) / (S * S));
        acc += 2 * (rcPct[i] - invN) * dRc;
      }
      grad[k] = acc;
    }
    const norm = Math.sqrt(grad.reduce((a, b) => a + b * b, 0));
    if (norm < 1e-13) break;
    const step = 0.06 * Math.pow(0.995, t);
    const next = projectToSimplex(w.map((x, i) => x - (step * grad[i]) / norm));
    const delta = next.reduce((a, b, i) => a + Math.abs(b - w[i]), 0);
    w = next;
    if (delta < 1e-11) break;
  }
  return w;
}

/** §6.5 — max_w (∑_i w_iσ_i)/√(w'Σw): gradient ascent on the diversification
 *  ratio with simplex projection, warm-started from inverse-vol. */
export function solveMaxDiversification(sigma: number[][], volsArr: number[], warm: number[], iters = 500): number[] {
  const n = sigma.length;
  let w = projectToSimplex(warm.map((x) => Math.max(x, 0)));
  for (let t = 0; t < iters; t++) {
    const sw = matVec(sigma, w);
    const S = w.reduce((a, wi, i) => a + wi * sw[i], 0);
    if (S <= 1e-18) break;
    const N = w.reduce((a, wi, i) => a + wi * volsArr[i], 0);
    const grad = new Array(n).fill(0);
    for (let k = 0; k < n; k++) {
      grad[k] = volsArr[k] / Math.sqrt(S) - (N * sw[k]) / (S * Math.sqrt(S));
    }
    const norm = Math.sqrt(grad.reduce((a, b) => a + b * b, 0));
    if (norm < 1e-13) break;
    const step = 0.06 * Math.pow(0.995, t);
    const next = projectToSimplex(w.map((x, i) => x + (step * grad[i]) / norm));
    const delta = next.reduce((a, b, i) => a + Math.abs(b - w[i]), 0);
    w = next;
    if (delta < 1e-11) break;
  }
  return w;
}

/** §6.6 — min_w CVaR_95(w): historical expected shortfall of the basket over
 *  the scoring window (loss convention L = −R, daily). Projected subgradient
 *  descent: the tail set is recomputed each step and w ascends the mean
 *  return of the worst 5% of days (= descends the tail loss). Warm-started
 *  from the strategic prior. */
export function solveMinCvar(returns: Record<Component, number[]>, warm: WeightVector, iters = 400): number[] {
  const comps = COMPONENTS;
  const n = comps.length;
  const T = returns[comps[0]]?.length ?? 0;
  if (T < 40) return projectToSimplex(comps.map((c) => warm[c]));
  const tailN = Math.max(1, Math.floor(T * 0.05));
  let w = projectToSimplex(comps.map((c) => warm[c]));
  for (let t = 0; t < iters; t++) {
    const rs: number[] = [];
    for (let k = 0; k < T; k++) {
      let r = 0;
      for (let i = 0; i < n; i++) r += w[i] * (returns[comps[i]][k] ?? 0);
      rs.push(r);
    }
    const order = rs.map((r, idx) => [r, idx] as const).sort((a, b) => a[0] - b[0]);
    const dir = new Array(n).fill(0);
    for (let k = 0; k < tailN; k++) {
      const idx = order[k][1];
      for (let i = 0; i < n; i++) dir[i] += returns[comps[i]][idx] ?? 0;
    }
    for (let i = 0; i < n; i++) dir[i] /= tailN;
    const norm = Math.sqrt(dir.reduce((a, b) => a + b * b, 0));
    if (!Number.isFinite(norm) || norm < 1e-13) break;
    const step = 0.15 / (1 + 0.02 * t);
    const next = projectToSimplex(w.map((x, i) => x + (step * dir[i]) / norm));
    const delta = next.reduce((a, b, i) => a + Math.abs(b - w[i]), 0);
    w = next;
    if (delta < 1e-10) break;
  }
  return w;
}

// --- §6.6/§6.7 risk figures (VaR/CVaR + MDD) ---------------------------------

export interface MaseRiskFigures {
  /** VaR_α = inf{l : P(L ≤ l) ≥ α} — historical quantile of daily basket loss. */
  var95: number;
  var99: number;
  /** CVaR_α = E[L | L ≥ VaR_α] — expected loss conditional on breaching. */
  cvar95: number;
  cvar99: number;
  /** §6.7 MDD = min_t DD_t over the simulated window (≤ 0). */
  mdd: number;
  windowDays: number;
  /** Pilot loss convention (fixed per methodology version per §6.6): L = −R, daily horizon. */
  convention: string;
  /** The 99% level is published as the §6.6 severe-scenario monitor. */
  monitor99: boolean;
}

/** §6.6 + §6.7 exact estimators on a candidate weight vector w: historical
 *  VaR/CVaR at 95/99 and the drawdown profile of the basket value path
 *  (V_t, running peak M_t, DD_t = V_t/M_t − 1, MDD = min DD_t). */
export function computeRiskFigures(
  w: WeightVector,
  returns: Partial<Record<Component, number[]>>,
): MaseRiskFigures | null {
  const len = Math.max(...COMPONENTS.map((c) => returns[c]?.length ?? 0));
  if (len < 40) return null;
  const rs: number[] = [];
  for (let t = 0; t < len; t++) {
    let r = 0;
    for (const c of COMPONENTS) r += (w[c] ?? 0) * (returns[c]?.[t] ?? 0);
    rs.push(r);
  }
  // Losses L = −R (loss positive), sorted ascending for the quantile form.
  const losses = rs.map((r) => -r).sort((a, b) => a - b);
  const n = losses.length;
  const varAt = (alpha: number): number => {
    let k = Math.ceil(alpha * n) - 1;
    if (k < 0) k = 0;
    if (k >= n) k = n - 1;
    return losses[k];
  };
  const cvarAt = (varA: number): number => {
    const tail = losses.filter((l) => l >= varA);
    if (tail.length === 0) return varA;
    return tail.reduce((a, b) => a + b, 0) / tail.length;
  };
  const var95 = varAt(0.95);
  const var99 = varAt(0.99);
  // §6.7 drawdown profile over the full window.
  let v = 1;
  let m = 1;
  let mdd = 0;
  for (const r of rs) {
    v *= 1 + r;
    if (v > m) m = v;
    const dd = v / m - 1;
    if (dd < mdd) mdd = dd;
  }
  return {
    var95,
    var99,
    cvar95: cvarAt(var95),
    cvar99: cvarAt(var99),
    mdd,
    windowDays: n,
    convention: "L = −R basket (loss positive) · daily horizon · historical quantiles over the disclosed simulated window",
    monitor99: true,
  };
}

// --- §5.4 six-regime probability model -----------------------------------------

export type SixRegime = "Normal" | "Inflation" | "Deflation" | "Stress" | "Liquidity" | "Geopolitical";
export const SIX_REGIMES: SixRegime[] = ["Normal", "Inflation", "Deflation", "Stress", "Liquidity", "Geopolitical"];

export interface Regime6State {
  /** p_t = [P(N), P(I), P(D), P(S), P(L), P(G)] — softmax, Σ = 1. */
  probabilities: { regime: SixRegime; probability: number }[];
  /** The standardized inputs consumed (§5.4 L2553–2555), with sources. */
  inputs: { input: string; value: number; source: string }[];
  /** W^Regime = Σ_r P(r|X_t)·W^(r) (pre-projection mixture). */
  mixture: WeightVector;
  /** §5.4 rule 1: W^Regime projected onto the admissible set (§8.1) BEFORE it
   *  can influence the ensemble. */
  projected: WeightVector;
  classifierVersion: string;
  disclosure: string;
}

/** W^(r) — the optimized weight vector per regime (blueprint L2558–2560).
 *  PILOT: the §5.4 governed classifier's parameters and the per-regime W^(r)
 *  are "validation-stage values" (L2556) — the tilts below are DISCLOSED
 *  pilot vectors around the strategic prior, to be replaced by the §23
 *  research program's calibrated classifier + optimized W^(r). NOT canonical. */
function tiltedPrior(mults: Partial<Record<Component, number>>): WeightVector {
  const raw = COMPONENTS.map((c) => STRATEGIC_PRIOR[c] * (mults[c] ?? 1));
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const out = {} as WeightVector;
  COMPONENTS.forEach((c, i) => (out[c] = raw[i] / sum));
  return out;
}

const REGIME6_VECTORS: Record<SixRegime, WeightVector> = {
  Normal: tiltedPrior({}),
  Inflation: tiltedPrior({ Gold: 1.25, CHF: 1.05, CNY: 0.8 }),
  Deflation: tiltedPrior({ USD: 1.1, JPY: 1.1, Gold: 0.9 }),
  Stress: tiltedPrior({ Gold: 1.3, CHF: 1.25, JPY: 1.1, GBP: 0.85, CNY: 0.7 }),
  Liquidity: tiltedPrior({ USD: 1.25, CNY: 0.75, GBP: 0.9 }),
  Geopolitical: tiltedPrior({ Gold: 1.4, CHF: 1.15, CNY: 0.8, GBP: 0.9 }),
};

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** §5.4 — the six-regime probability model. PILOT GOVERNED CLASSIFIER
 *  (disclosed): softmax over per-regime evidence activations built from the
 *  standardized inputs. The blueprint fixes the regime LIST and the
 *  probability/mixture CONSTRUCTION (L2545–2560) but the classifier's
 *  parameters are validation-stage — the activation signatures below are
 *  DISCLOSED pilot values. Inputs unavailable in the pilot (liquidity-stress
 *  measures, inflation surprises, geopolitical indicators) contribute their
 *  prior anchors only — mirroring the §5.3 unavailable-feed convention — so
 *  P(Inflation/Liquidity/Geopolitical) are prior-anchored placeholders until
 *  those feeds exist. Anchor-normalized z̃ stand-ins (μ/σ_ref disclosed) are
 *  used because the rolling-90d §5.3 z-scores are not threaded through the
 *  MASE call path (both engine call sites must derive identical outputs). */
export function classifySixRegimes(args: {
  regime: MarketRegime;
  avgCorrelation: number;
  crisisScore: number;
}): Regime6State {
  const zVix = (args.regime.vix - 18.5) / (6.0 + 1e-9); // μ_ref = 18.5, σ_ref = 6.0 (disclosed)
  const zDxy = (args.regime.dxy - 104.2) / (3.0 + 1e-9); // μ_ref = 104.2, σ_ref = 3.0 (disclosed)
  const corrLevel = Math.max(-1, Math.min(1, args.avgCorrelation));
  const inputs = [
    { input: "z̃^VIX (anchor-normalized)", value: zVix, source: "live VIX vs μ=18.5/σ=6.0" },
    { input: "z̃^DXY (anchor-normalized)", value: zDxy, source: "live DXY vs μ=104.2/σ=3.0" },
    { input: "CrossAssetCorrelation", value: corrLevel, source: "§6.1/§6.2 ρ̄ from Σ̂" },
    { input: "CrisisScore", value: args.crisisScore, source: "§5.5 score" },
    { input: "LiquidityStress", value: 0, source: "NO FEED — neutral (prior-anchored)" },
    { input: "InflationSurprise", value: 0, source: "NO FEED — neutral (prior-anchored)" },
    { input: "GeopoliticalIndicators", value: 0, source: "NO FEED — neutral (prior-anchored)" },
  ];
  const s: Record<SixRegime, number> = {
    Normal: 1.0,
    Inflation: 0.3 - 0.35 * zDxy,
    Deflation: 0.25 + 0.4 * zDxy,
    Stress: 0.15 + 0.9 * Math.max(0, zVix) + 0.8 * Math.max(0, corrLevel - 0.25) + 0.6 * args.crisisScore,
    Liquidity: 0.15,
    Geopolitical: 0.1,
  };
  const exps = SIX_REGIMES.map((r) => Math.exp(s[r]));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  const probabilities = SIX_REGIMES.map((r, i) => ({ regime: r, probability: exps[i] / sum }));
  const mixture = {} as WeightVector;
  for (const c of COMPONENTS) mixture[c] = 0;
  for (const { regime: r, probability: p } of probabilities) {
    const wv = REGIME6_VECTORS[r];
    for (const c of COMPONENTS) mixture[c] += p * wv[c];
  }
  return {
    probabilities,
    inputs,
    mixture,
    projected: applyEnvelopes(mixture),
    classifierVersion: "six-regime pilot governed classifier v1 (validation-stage parameters)",
    disclosure:
      "§5.4 exact regime list + softmax probability construction + probability-weighted mixture W^Regime = Σ P(r|X_t)·W^(r) with §8.1 projection before ensemble entry. Classifier parameters and per-regime W^(r) are DISCLOSED pilot values (validation-stage per the blueprint); liquidity/inflation/geopolitical evidence is neutral (no feeds) so those three probabilities are prior-anchored placeholders.",
  };
}

// --- §5.5 crisis-risk score ------------------------------------------------------

export interface CrisisScoreState {
  /** CrisisScore_t ∈ [0,1] (pilot aggregation). */
  score: number;
  /** The §5.5 evidence inputs (L2569) with their pilot contributions. */
  inputs: { name: string; evidence: number; weight: number; available: boolean }[];
  /** λ_CVaR,t = λ_CVaR,0·(1 + k·CrisisScore_t) — §5.5 exact coupling (L2572–2574). */
  lambdaCvar0: number;
  k: number;
  lambdaCvarT: number;
  version: string;
  disclosure: string;
}

/** §5.5 — CrisisScore_t = f(FXVol, CrossAssetCorrelation, LiquidityStress,
 *  InflationShock, CreditStress, MarketDrawdown, GeopoliticalIndicators)
 *  (blueprint L2567–2569) with the λ coupling λ_CVaR,t = λ_CVaR,0·(1+k·CS)
 *  (L2571–2574) implemented EXACTLY. f(·) itself is a research-program
 *  deliverable — the aggregation below is a DISCLOSED pilot form over the
 *  available inputs; the four inputs with no pilot feed contribute zero
 *  evidence (bounded pilot score ≤ 0.60), honestly labeled. k and λ_0 are
 *  "Risk-Council parameters within constitutional envelopes" — pilot
 *  initialization values k = 1.0, λ_0 = 1/8 (the uniform placeholder λ). */
export function computeCrisisScore(args: {
  sigmaRobust: number[][];
  blendedVols: VolatilityData;
  vixFactor: number;
  avgCorrelation: number;
  series: SimReturnSeries;
}): CrisisScoreState {
  const comps = COMPONENTS;
  const n = comps.length;
  // §5.5 FXVol: σ of the strategic-prior basket under Σ_robust vs the same
  // quantity at the VIX-anchor baseline (scaling all vols by 1/f scales the
  // quadratic form by 1/f² — so this ratio reduces to f, computed explicitly
  // here from the published basket-vol numbers).
  let q = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) q += STRATEGIC_PRIOR[comps[i]] * STRATEGIC_PRIOR[comps[j]] * args.sigmaRobust[i][j];
  }
  const basketVol = Math.sqrt(Math.max(q, 0));
  const anchorBasketVol = args.vixFactor > 1e-9 ? basketVol / args.vixFactor : basketVol;
  const fxVolEvidence = clamp01(basketVol / Math.max(anchorBasketVol, 1e-12) - 1);
  // §5.5 CrossAssetCorrelation: correlation-convergence evidence from ρ̄.
  const corrEvidence = clamp01((args.avgCorrelation - 0.1) / 0.45);
  // §5.5 MarketDrawdown: current drawdown of the prior-weighted basket over
  // the trailing 90 simulated days.
  const T90 = Math.min(90, args.series.days);
  let v = 1;
  let peak = 1;
  for (let t = args.series.days - T90; t < args.series.days; t++) {
    let r = 0;
    for (const c of comps) r += STRATEGIC_PRIOR[c] * (args.series.returns[c][t] ?? 0);
    v *= 1 + r;
    if (v > peak) peak = v;
  }
  const ddNow = peak > 0 ? Math.min(0, v / peak - 1) : 0;
  const inputs = [
    { name: "FXVol", evidence: fxVolEvidence, weight: 0.3, available: true },
    { name: "CrossAssetCorrelation", evidence: corrEvidence, weight: 0.2, available: true },
    { name: "LiquidityStress", evidence: 0, weight: 0.1, available: false },
    { name: "InflationShock", evidence: 0, weight: 0.1, available: false },
    { name: "CreditStress", evidence: 0, weight: 0.1, available: false },
    { name: "MarketDrawdown", evidence: clamp01(-ddNow), weight: 0.1, available: true },
    { name: "GeopoliticalIndicators", evidence: 0, weight: 0.1, available: false },
  ];
  const score = clamp01(inputs.reduce((a, i) => a + i.weight * i.evidence, 0));
  const lambdaCvar0 = MASE_LAMBDA_PLACEHOLDER.CVaR;
  const k = 1.0;
  const lambdaCvarT = lambdaCvar0 * (1 + k * score);
  return {
    score,
    inputs,
    lambdaCvar0,
    k,
    lambdaCvarT,
    version: "crisis-score pilot f(·) v1 (validation-stage aggregation)",
    disclosure:
      "§5.5 exact λ coupling λ_CVaR,t = λ_CVaR,0·(1 + k·CrisisScore_t) is LIVE in the §7.4 objective. f(·) is a disclosed pilot aggregation over the available evidence (FXVol from Σ_robust vs the VIX-anchor basket vol; CrossAssetCorrelation from §6.1 ρ̄; MarketDrawdown from the trailing-90d basket drawdown on the simulated window). LiquidityStress/InflationShock/CreditStress/Geopolitical have NO pilot feeds → zero evidence → pilot score bounded ≤ 0.60. λ_0 = 1/8, k = 1.0 are pilot initialization values pending the Risk Council's constitutional-envelope calibration.",
  };
}

// --- §6.8 GPP (formula surfaced; proxy labeled — no CPI-basket feed) -------------

export interface GppObjectiveState {
  formula: string;
  objective: string;
  status: string;
}

export const GPP_OBJECTIVE: GppObjectiveState = {
  formula: "GPP_t = f(GlobalCPI, Food, Energy, TradeGoods, OtherRelevantConsumptionWeights) · PPError_t = R_MTQ,t − R_GPP,t",
  objective: "min E[(PPError_t)²] and/or MAE(PPError) — squared-vs-absolute choice is a validation result (§6.8 L2768–2772)",
  status:
    "PROXY IN PILOT: no GlobalCPI/Food/Energy/TradeGoods feeds exist in the pilot — the §7.4 PPError term keeps the disclosed RG-07 proxy (equal-share tracking error); the construction weights are methodology parameters to be published with the first CPI-basket feed.",
};

// --- Assembled risk context + estimator payload ---------------------------------

export interface MaseModelContext {
  /** Simulated daily return series (deterministic; disclosed window). */
  returns: Record<Component, number[]> | null;
  /** §6.2 Σ_robust (annualized) — the covariance every §6.3/§6.4/§6.5 solver
   *  consumes; null when the caller supplied a correlation matrix instead. */
  sigmaRobust: number[][] | null;
  /** §5.4 six-regime mixture state (regime family consumes the projection). */
  regime6: Regime6State | null;
  /** §5.5 crisis state. */
  crisis: CrisisScoreState | null;
}

export interface MaseRiskEstimatorState {
  version: string;
  // §5.1
  volHorizonWeights: { horizon: VolHorizon; weight: number }[];
  volHorizons: VolHorizonEstimate[];
  // §5.4
  regime6: Regime6State;
  // §5.5
  crisis: CrisisScoreState;
  // §6.1/§6.2
  corr: CorrelationData;
  /** §6.2 Σ_robust (annualized 7×7) — the matrix every candidate solver and
   *  the §7.4 Risk term consume DIRECTLY; `corr`/`correlation.matrix` are its
   *  correlation VIEW (diag = 1 by construction). Published so the exact
   *  objective inputs are auditable end-to-end. */
  sigmaRobust: number[][];
  correlation: {
    matrix: number[][];
    avgOffDiagonal: number;
    shrinkageLambda: number;
    target: string;
    horizonBlend: string;
    externallySupplied: boolean;
  };
  // §6.8 (formula surfaced; proxy labeled)
  gpp: GppObjectiveState;
  // Data-window honesty
  dataWindow: { days: number; disclosure: string };
  // The simulated series itself (feeds the §7.4 objective's CVaR term).
  series: { returns: Record<Component, number[]>; days: number };
}

interface MaseRiskContext {
  /** §5.1 σ^MH — GOVERNS every downstream risk figure. */
  blended: VolatilityData;
  /** Correlation matrix the models consume (§6.1/§6.2-derived, or caller-supplied). */
  corrData: CorrelationData | null;
  /** Σ the solvers consume (null only when caller supplied corr without robust Σ). */
  sigmaRobust: number[][] | null;
  modelCtx: MaseModelContext;
  riskEstimators: MaseRiskEstimatorState;
  lambdaVector: Record<string, number>;
  vixFactor: number;
}

function covarianceFromCorrAndVols(corr: CorrelationData, vols: VolatilityData): number[][] {
  const volsArr = COMPONENTS.map((c) => vols[c] ?? 0.1);
  return corr.matrix.map((row, i) => row.map((rho, j) => rho * volsArr[i] * volsArr[j]));
}

/** Build the full §5/§6 risk context from the engine inputs. Deterministic —
 *  identical inputs ⇒ identical outputs (idempotent per tick). */
export function buildRiskContext(
  vols: VolatilityData,
  corr: CorrelationData | null,
  regime: MarketRegime,
): MaseRiskContext {
  const series = buildSimulatedReturnSeries(vols, regime);
  const mh = multiHorizonVols(series);
  const blended = mh.blended;
  const sigmaHat = blendedCovariance(series);
  const shrunk = shrinkCovariance(sigmaHat);
  const vixFactor = Math.min(5, Math.max(0.2, regime.vix > 0 ? regime.vix / 18.5 : 1));
  const crisis = computeCrisisScore({
    sigmaRobust: shrunk.sigmaRobust,
    blendedVols: blended,
    vixFactor,
    avgCorrelation: shrunk.avgOffDiagonal,
    series,
  });
  const regime6 = classifySixRegimes({ regime, avgCorrelation: shrunk.avgOffDiagonal, crisisScore: crisis.score });
  // When the caller supplies a correlation matrix, it wins for the models
  // (treated as already-robust); production paths pass null and consume the
  // internally-estimated §6.1/§6.2 matrix.
  const externallySupplied = corr != null;
  const corrData: CorrelationData | null = corr ?? shrunk.corr;
  const sigmaRobust: number[][] | null = corr ? covarianceFromCorrAndVols(corr, blended) : shrunk.sigmaRobust;
  const modelCtx: MaseModelContext = {
    returns: series.returns,
    sigmaRobust,
    regime6,
    crisis,
  };
  const riskEstimators: MaseRiskEstimatorState = {
    version: "risk-estimators v2 §5.1/§5.4/§5.5/§6.1–6.8 pilot-1",
    volHorizonWeights: VOL_HORIZONS.map((h) => ({ horizon: h, weight: VOL_HORIZON_WEIGHTS[h] })),
    volHorizons: mh.perComponent,
    regime6,
    crisis,
    corr: corrData ?? shrunk.corr,
    sigmaRobust: sigmaRobust ?? shrunk.sigmaRobust,
    correlation: {
      matrix: (corrData ?? shrunk.corr).matrix,
      avgOffDiagonal: shrunk.avgOffDiagonal,
      shrinkageLambda: shrunk.shrinkageLambda,
      target: shrunk.target,
      horizonBlend: "Σ̂ = Σ_h ω_h·Cov_h over the §5.1 horizons (ω published above; §6.2 COO-3 multi-horizon record)",
      externallySupplied,
    },
    gpp: GPP_OBJECTIVE,
    dataWindow: { days: series.days, disclosure: series.disclosure },
    series: { returns: series.returns, days: series.days },
  };
  const lambdaVector: Record<string, number> = { ...MASE_LAMBDA_PLACEHOLDER };
  // §5.5 — λ_CVaR,t is regime-scaled (the ONE term the blueprint scales live).
  lambdaVector.CVaR = crisis.lambdaCvarT;
  return { blended, corrData, sigmaRobust, modelCtx, riskEstimators, lambdaVector, vixFactor };
}

function vectorToWeights(v: number[]): WeightVector {
  const out = {} as WeightVector;
  const sum = v.reduce((a, b) => a + (Number.isFinite(b) ? Math.max(0, b) : 0), 0);
  if (sum > 0) {
    COMPONENTS.forEach((c, i) => (out[c] = Math.max(0, Number.isFinite(v[i]) ? v[i] : 0) / sum));
  } else {
    for (const c of COMPONENTS) out[c] = 1 / COMPONENTS.length;
  }
  return out;
}

function inverseVolVector(vols: VolatilityData): number[] {
  return COMPONENTS.map((c) => 1 / Math.max(vols[c] ?? 0.1, 0.005));
}

// === Model 1: Minimum Variance (§6.3) ===
// EXACT FORM: min_w w'Σ_robust w s.t. full investment + non-negativity —
// solved by projected gradient against the §6.2 robust covariance (envelope /
// velocity constraints apply downstream, §8.1/§8.3). When no risk context is
// supplied, falls back to the DISCLOSED inverse-volatility pilot substitute.
export function modelMinimumVariance(
  vols: VolatilityData,
  _prices: PriceData,
  _corr: CorrelationData | null,
  ctx?: MaseModelContext,
): WeightVector {
  if (ctx?.sigmaRobust) {
    return vectorToWeights(solveMinVariance(ctx.sigmaRobust));
  }
  const invVols: Record<Component, number> = {
    USD: 1 / Math.max(vols.USD, 0.01),
    EUR: 1 / Math.max(vols.EUR, 0.01),
    JPY: 1 / Math.max(vols.JPY, 0.01),
    GBP: 1 / Math.max(vols.GBP, 0.01),
    CNY: 1 / Math.max(vols.CNY, 0.01),
    CHF: 1 / Math.max(vols.CHF, 0.01),
    Gold: 1 / Math.max(vols.Gold, 0.01),
  };
  const sum = Object.values(invVols).reduce((a, b) => a + b, 0);
  return {
    USD: invVols.USD / sum, EUR: invVols.EUR / sum, JPY: invVols.JPY / sum,
    GBP: invVols.GBP / sum, CNY: invVols.CNY / sum, CHF: invVols.CHF / sum,
    Gold: invVols.Gold / sum,
  };
}

// === Model 2: Equal Risk Contribution / Risk Parity (§6.4) ===
// EXACT COO-6 FORM — "the form the optimizer actually solves" (blueprint
// L2681–2685): min_w Σ_i (RC%_i − 1/n)² with RC_i = w_i(Σw)_i and
// RC%_i = RC_i/Σ_j RC_j, solved against Σ_robust (§6.2) by projected gradient
// with simplex constraints (envelope/velocity constraints apply downstream).
// When no risk context is supplied, falls back to the DISCLOSED equal-weight
// (1/N) pilot substitute.
export function modelEqualRiskContribution(
  vols: VolatilityData,
  _prices: PriceData,
  _corr: CorrelationData | null,
  ctx?: MaseModelContext,
): WeightVector {
  if (ctx?.sigmaRobust) {
    return vectorToWeights(solveEqualRiskContribution(ctx.sigmaRobust, inverseVolVector(vols)));
  }
  const w = 1 / COMPONENTS.length;
  return { USD: w, EUR: w, JPY: w, GBP: w, CNY: w, CHF: w, Gold: w };
}

// === Model 3: Maximum Diversification (§6.5) ===
// EXACT FORM: max_w (∑_i w_iσ_i)/√(w'Σw) — the diversification ratio
// (blueprint L2702–2705), gradient-ascent with simplex projection against
// Σ_robust (§6.2). When no risk context is supplied, falls back to the
// DISCLOSED prior/vol pilot heuristic.
export function modelMaxDiversification(
  vols: VolatilityData,
  _prices: PriceData,
  _corr: CorrelationData | null,
  ctx?: MaseModelContext,
): WeightVector {
  if (ctx?.sigmaRobust) {
    const volsArr = COMPONENTS.map((c) => vols[c] ?? 0.1);
    return vectorToWeights(solveMaxDiversification(ctx.sigmaRobust, volsArr, inverseVolVector(vols)));
  }
  // Without a full correlation matrix, approximate with inverse-vol * prior tilt
  const prior = STRATEGIC_PRIOR;
  const volsArr = [vols.USD, vols.EUR, vols.JPY, vols.GBP, vols.CNY, vols.CHF, vols.Gold];
  const priorArr = [prior.USD, prior.EUR, prior.JPY, prior.GBP, prior.CNY, prior.CHF, prior.Gold];
  // Diversification weight ∝ prior / vol
  const raw = priorArr.map((p, i) => p / Math.max(volsArr[i], 0.01));
  const sum = raw.reduce((a, b) => a + b, 0);
  return {
    USD: raw[0] / sum, EUR: raw[1] / sum, JPY: raw[2] / sum, GBP: raw[3] / sum,
    CNY: raw[4] / sum, CHF: raw[5] / sum, Gold: raw[6] / sum,
  };
}

// === Model 4: Tail Risk / CVaR (§6.6) ===
// EXACT FORM: min_w CVaR_95(w) with CVaR_99 monitored (blueprint L2725–2728)
// — the historical expected shortfall of the candidate basket over the
// disclosed simulated window (L = −R, daily), minimized by projected
// subgradient descent. The regime-dependent λ_CVaR,t multiplier (§5.5) scales
// this candidate's influence in the composite §7.4 objective. When no return
// series is supplied, falls back to the DISCLOSED safe-haven heuristic tilt.
export function modelCVaR(
  vols: VolatilityData,
  _prices: PriceData,
  _corr: CorrelationData | null,
  regime?: MarketRegime,
  ctx?: MaseModelContext,
): WeightVector {
  if (ctx?.returns) {
    return vectorToWeights(solveMinCvar(ctx.returns, STRATEGIC_PRIOR as WeightVector));
  }
  const r = regime?.regime ?? 1;
  // In stress/crisis, shift toward gold + CHF (safe havens)
  const stressMult = r >= 2 ? 1.3 : 1.0;
  const prior = STRATEGIC_PRIOR;
  const raw = {
    USD: prior.USD * 0.9,
    EUR: prior.EUR * 0.9,
    JPY: prior.JPY * 1.1, // JPY safe haven
    GBP: prior.GBP * 0.8,
    CNY: prior.CNY * 0.7, // EM risk
    CHF: prior.CHF * stressMult * 1.2, // CHF safe haven
    Gold: prior.Gold * stressMult, // Gold safe haven
  };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  return {
    USD: raw.USD / sum, EUR: raw.EUR / sum, JPY: raw.JPY / sum, GBP: raw.GBP / sum,
    CNY: raw.CNY / sum, CHF: raw.CHF / sum, Gold: raw.Gold / sum,
  };
}

// === Model 5: Purchasing-Power Parity (§6.7) ===
// Track purchasing-power parity across currencies.
// Simplified: weight by inverse of deviation from PPP fair value.
//
// ⚠ AUDIT RG-07 WARNING (equation-by-equation audit, EQ-027) — SEEDING RISK:
//   The blueprint's §5.2/§6.7 GPR is GPR_i = P_{i,t-1}/P_{i,t} − 1 (gold price
//   quoted IN currency i; direction convention deferred to the methodology
//   version). This pilot proxy uses the OPPOSITE quote direction and a
//   "buy depreciated" heuristic. It must NOT seed the §5.2/§6.7 production
//   implementation — the canonical GPR estimator is a research-program
//   deliverable. Labeled SUBSTITUTE, not canonical.
export function modelPurchasingPower(
  _vols: VolatilityData,
  prices: PriceData,
  _corr: CorrelationData | null,
): WeightVector {
  // Without PPP fair-value data, approximate: weight toward currencies
  // that have depreciated (lower price = better purchasing power value)
  const prior = STRATEGIC_PRIOR;
  const priceDevs: Record<Component, number> = {
    USD: 1.0, // base
    EUR: prices.EUR,
    JPY: prices.JPY,
    GBP: prices.GBP,
    CNY: prices.CNY,
    CHF: prices.CHF,
    Gold: prices.Gold,
  };
  // Weight ∝ prior / price (buy undervalued)
  const raw: Record<Component, number> = {
    USD: prior.USD / priceDevs.USD,
    EUR: prior.EUR / Math.max(priceDevs.EUR, 0.01),
    JPY: prior.JPY / Math.max(priceDevs.JPY, 0.001),
    GBP: prior.GBP / Math.max(priceDevs.GBP, 0.01),
    CNY: prior.CNY / Math.max(priceDevs.CNY, 0.01),
    CHF: prior.CHF / Math.max(priceDevs.CHF, 0.01),
    Gold: prior.Gold / Math.max(priceDevs.Gold, 0.01),
  };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  return {
    USD: raw.USD / sum, EUR: raw.EUR / sum, JPY: raw.JPY / sum, GBP: raw.GBP / sum,
    CNY: raw.CNY / sum, CHF: raw.CHF / sum, Gold: raw.Gold / sum,
  };
}

// === Model 6: Institutional (§7.5 "Institutional" family) ===
// The institutionally-informed family: weights tilt toward the currencies
// with the strongest institutional fundamentals — reserve relevance (IMF
// COFER share), trade/payment usage, and liquidity depth (BIS Triennial).
// Pilot approximation: the strategic prior IS the published intersection of
// those institutional inputs (§3.2), so this family anchors to the prior with
// a mild safe-haven tilt under stress. Production consumes the live COFER/
// BIS data feeds (§4.3) and re-derives the score quarterly.
export function modelInstitutional(
  vols: VolatilityData,
  _prices: PriceData,
  corr: CorrelationData | null,
  regime?: MarketRegime,
): WeightVector {
  const r = regime?.regime ?? 1;
  const stressMult = r >= 2 ? 1.15 : 1.0;
  const prior = STRATEGIC_PRIOR;
  const raw = {
    USD: prior.USD,                        // deepest reserve/trade/liquidity score
    EUR: prior.EUR,                        // #2 reserve share
    JPY: prior.JPY * 1.05,                 // safe-haven + top reserve share
    GBP: prior.GBP,
    CNY: prior.CNY * 0.9,                  // reserve share growing, but capital controls
    CHF: prior.CHF * stressMult,           // safe-haven institutional tilt
    Gold: prior.Gold * stressMult,         // central-bank accumulation trend
  };
  const sum = Object.values(raw).reduce((a, b) => a + b, 0);
  return {
    USD: raw.USD / sum, EUR: raw.EUR / sum, JPY: raw.JPY / sum, GBP: raw.GBP / sum,
    CNY: raw.CNY / sum, CHF: raw.CHF / sum, Gold: raw.Gold / sum,
  };
}

// === Model 7: Regime-Adaptive (§7.5 "Regime" family → §5.4 wiring) ===
// v2.0 §5.4: the regime family is the probability-weighted mixture
// W^Regime = Σ_r P(r|X_t)·W^(r), projected onto the admissible set (§8.1)
// before it can influence the ensemble (blueprint L2558–2562). When the
// six-regime context is supplied it IS the family output; the hard 4-state
// classifier is retained (per the blueprint's wiring) only for STATE-level
// decisions elsewhere (stress tilts inside other models, display). The
// fallback below keeps the DISCLOSED 4-state switch for the no-context path.
export function modelRegimeAdaptive(
  vols: VolatilityData,
  prices: PriceData,
  corr: CorrelationData | null,
  regime: MarketRegime,
  ctx?: MaseModelContext,
): WeightVector {
  if (ctx?.regime6) {
    return ctx.regime6.projected;
  }
  const r = regime.regime;
  if (r === 0) {
    // Calm: favor min-variance
    return modelMinimumVariance(vols, prices, corr);
  } else if (r === 1) {
    // Normal: blend max-div + PPP
    const md = modelMaxDiversification(vols, prices, corr);
    const pp = modelPurchasingPower(vols, prices, corr);
    return blendWeights(md, pp, 0.5);
  } else if (r === 2) {
    // Stress: favor CVaR
    return modelCVaR(vols, prices, corr, regime);
  } else {
    // Crisis: heavily favor CVaR + gold.
    // ⚠ PILOT APPROXIMATION (RG-15 label, EQ-032): the 0.50 crisis-gold vector
    // below is an INVENTED pilot constant — the blueprint's §5.4/§5.5 regime
    // model (six-regime probabilities + CrisisScore + crisis gold allocation
    // f(·)) is symbolic/validation-stage. Disclosed substitute, NOT canonical.
    const cvar = modelCVaR(vols, prices, corr, regime);
    const gold = { USD: 0.15, EUR: 0.10, JPY: 0.07, GBP: 0.06, CNY: 0.04, CHF: 0.08, Gold: 0.50 } as WeightVector;
    return blendWeights(cvar, gold, 0.5);
  }
}

// === Ensemble Combination (§7.5 — SIX families) ===
// The doc's ensemble members are the six §7.5 families:
//   W^Stability (min-variance / risk-parity) · W^Diversification · W^TailRisk ·
//   W^PurchasingPower · W^Institutional · W^Regime
// Stability covers both Minimum-Variance and ERC ("the minimum-variance /
// risk-parity family"), so the family weight is the 50/50 blend of the two
// models. Individual model outputs are still exposed for the UI/audit.
// In the pilot: equal-weight ensemble (1/6 per family). Production: adaptive
// softmax weights per §7.6 (Score_m = f(OOSRisk, CVaR, PPError, Turnover,
// Robustness)).
//
// v2.0 §5/§6 wiring (Task 8-a): the ensemble FIRST builds the §5/§6 risk
// context — §5.1 σ^MH multi-horizon blend (GOVERNS all vols below), §6.1/§6.2
// Σ_robust + correlation matrix, §5.4 six-regime mixture, §5.5 CrisisScore —
// and every candidate model then consumes it (exact solvers for §6.3/§6.4/
// §6.5/§6.6; §5.4 mixture for the regime family). The context is returned so
// buildMaseSnapshot/advanceMase derive IDENTICAL pipelines (idempotence).
export function maseEnsemble(
  vols: VolatilityData,
  prices: PriceData,
  corr: CorrelationData | null,
  regime: MarketRegime,
): {
  target: WeightVector;
  models: { id: string; name: string; weights: WeightVector }[];
  /** §5.1 σ^MH — the blend that governed every risk figure in this pass. */
  blendedVols: VolatilityData;
  /** §5.1/§5.4/§5.5/§6.1/§6.2/§6.8 estimator payload (published for the UI). */
  riskEstimators: MaseRiskEstimatorState;
  /** §7.4 λ vector — uniform pilot base with the §5.5 regime-scaled λ_CVaR,t. */
  lambdaVector: Record<string, number>;
} {
  const rc = buildRiskContext(vols, corr, regime);
  const minvar = modelMinimumVariance(rc.blended, prices, rc.corrData, rc.modelCtx);
  const erc = modelEqualRiskContribution(rc.blended, prices, rc.corrData, rc.modelCtx);
  // §7.5: the Stability family = minimum-variance / risk-parity (50/50 blend)
  const stability = blendWeights(minvar, erc, 0.5);
  const models = [
    { id: "minvar", name: "Minimum Variance (§6.3)", weights: minvar },
    { id: "erc", name: "Equal Risk Contribution (§6.4)", weights: erc },
    { id: "maxdiv", name: "Maximum Diversification (§6.5)", weights: modelMaxDiversification(rc.blended, prices, rc.corrData, rc.modelCtx) },
    { id: "cvar", name: "Tail Risk · CVaR (§6.6)", weights: modelCVaR(rc.blended, prices, rc.corrData, regime, rc.modelCtx) },
    { id: "ppp", name: "Purchasing-Power (§6.8 proxy)", weights: modelPurchasingPower(rc.blended, prices, rc.corrData) },
    { id: "institutional", name: "Institutional", weights: modelInstitutional(rc.blended, prices, rc.corrData, regime) },
    { id: "regime", name: "Regime-Adaptive (§5.4 mixture)", weights: modelRegimeAdaptive(rc.blended, prices, rc.corrData, regime, rc.modelCtx) },
  ];

  // The six §7.5 families, equal-weighted in the pilot.
  const families: WeightVector[] = [
    stability,
    models[2].weights, // Diversification
    models[3].weights, // TailRisk
    models[4].weights, // PurchasingPower
    models[5].weights, // Institutional
    models[6].weights, // Regime
  ];
  const ensembleWeight = 1 / families.length;
  const target: WeightVector = { USD: 0, EUR: 0, JPY: 0, GBP: 0, CNY: 0, CHF: 0, Gold: 0 };
  for (const f of families) {
    for (const c of COMPONENTS) {
      target[c] += f[c] * ensembleWeight;
    }
  }

  return {
    target,
    models,
    blendedVols: rc.blended,
    riskEstimators: rc.riskEstimators,
    lambdaVector: rc.lambdaVector,
  };
}

// === Envelope Constraint (§8.1) ===
// Clamp each component to its admissibility envelope, renormalize to sum to
// 1, and REPEAT (alternating projection onto the box ∩ simplex set) until the
// vector is feasible. A single clamp+renormalize pass can leave components
// slightly outside their envelopes (the renormalization pushes clamped
// components back over their bounds); iterating converges — the envelopes'
// lower bounds sum to 79% and uppers to 125%, so the feasible polytope has a
// large interior and the projection is well-conditioned.
// PILOT NUMERICS (RG-15 label): maxIterations = 12 and the 1e-9 feasibility
// tolerance are implementation numerics, not blueprint parameters.
export function applyEnvelopes(weights: WeightVector, maxIterations: number = 12): WeightVector {
  const result: WeightVector = { ...weights };
  for (let iter = 0; iter < maxIterations; iter++) {
    // 1. Clamp to envelopes.
    let clampedAny = false;
    for (const c of COMPONENTS) {
      const env = ADMISSIBILITY_ENVELOPES[c];
      const clamped = Math.max(env.lower, Math.min(env.upper, result[c]));
      if (clamped !== result[c]) clampedAny = true;
      result[c] = clamped;
    }
    // 2. Renormalize to sum to 1.
    const sum = Object.values(result).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      for (const c of COMPONENTS) result[c] /= sum;
    }
    // 3. Convergence: feasible AND sums to 1.
    const feasible = COMPONENTS.every((c) => {
      const env = ADMISSIBILITY_ENVELOPES[c];
      return result[c] >= env.lower - 1e-9 && result[c] <= env.upper + 1e-9;
    });
    if (feasible && !clampedAny) break;
  }
  return result;
}

// === §8.4 Stress-Adaptive Smoothing (CONSTITUTIONAL) ===
// W^Smooth = ρ·W_prev + (1−ρ)·W^Target with the deployed ρ ladder:
//   ρ_normal = 0.50 (Listing 2 smoothingRhoNormal)  → 50% target adoption
//   ρ_stress = 0.75 (Listing 2 smoothingRhoStress)  → 25% target adoption
// The stress flag is sourced from the crisis-score path (threshold 0.70;
// conservative default to stress when the score is unavailable — §8.4).
// "Smoothing does not change the target — it paces adoption": risk-reducing
// corrections under crisis are handled by the MARP execution layer, which is
// NOT slowed by ρ.
export function smoothWeights(
  prevSmoothed: WeightVector,
  target: WeightVector,
  lambda: number = 1 - SMOOTHING_RHO_NORMAL,
): WeightVector {
  const result: WeightVector = { USD: 0, EUR: 0, JPY: 0, GBP: 0, CNY: 0, CHF: 0, Gold: 0 };
  for (const c of COMPONENTS) {
    result[c] = lambda * target[c] + (1 - lambda) * (prevSmoothed[c] ?? STRATEGIC_PRIOR[c]);
  }
  return result;
}

// === §8.3 Weight-Velocity Constraint (CONSTITUTIONAL — hard cap) ===
// |w_i,t − w_i,t−1| ≤ Δ_i for the published (smoothed) weight series.
// Deployed MAX_VELOCITY arrays (Listing 1 / Listing 2):
//   USD & EUR 0.50% · JPY & GBP 0.30% · CNY & CHF 0.20% · Gold 0.50%
// per accepted update. Clamped deltas are renormalized to sum to 1; the
// renormalization is re-clamped once (two passes converge for practical
// weight vectors — the envelopes' lower bounds sum to 79%, so feasibility
// is guaranteed with margin).
export function applyVelocityCaps(
  prev: WeightVector,
  next: WeightVector,
  maxVelocity: Record<string, number> = MAX_VELOCITY,
): WeightVector {
  const clamped: WeightVector = { USD: 0, EUR: 0, JPY: 0, GBP: 0, CNY: 0, CHF: 0, Gold: 0 };
  for (const c of COMPONENTS) {
    const delta = (next[c] ?? 0) - (prev[c] ?? 0);
    const cap = maxVelocity[c] ?? 0.005;
    clamped[c] = (prev[c] ?? 0) + Math.max(-cap, Math.min(cap, delta));
  }
  // Renormalize (sum-to-one constraint) then re-clamp once.
  const sum = Object.values(clamped).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const c of COMPONENTS) clamped[c] /= sum;
    for (const c of COMPONENTS) {
      const delta = clamped[c] - (prev[c] ?? 0);
      const cap = maxVelocity[c] ?? 0.005;
      clamped[c] = (prev[c] ?? 0) + Math.max(-cap, Math.min(cap, delta));
    }
    const sum2 = Object.values(clamped).reduce((a, b) => a + b, 0);
    if (sum2 > 0) for (const c of COMPONENTS) clamped[c] /= sum2;
  }
  return clamped;
}

// Max component-wise |Δ| between prev and target (diagnostic velocity measure).
export function targetVelocity(prev: WeightVector, target: WeightVector): number {
  let maxDelta = 0;
  for (const c of COMPONENTS) {
    const d = Math.abs((target[c] ?? 0) - (prev[c] ?? 0));
    if (d > maxDelta) maxDelta = d;
  }
  return maxDelta;
}

// Constitutional smoothing (§8.4 + §8.3): stress-adaptive ρ selection followed
// by the hard per-component velocity caps. `stressLevel` is 0–4 from the risk
// state machine (≥2 selects ρ_stress; the conservative default when the
// crisis-score is unavailable).
export function smoothWeightsConstitutional(
  prevSmoothed: WeightVector,
  target: WeightVector,
  stressLevel: number = 0,
): WeightVector {
  const rho = stressLevel >= 2 ? SMOOTHING_RHO_STRESS : SMOOTHING_RHO_NORMAL;
  const smoothed = smoothWeights(prevSmoothed, target, 1 - rho);
  return applyVelocityCaps(prevSmoothed, smoothed);
}

// Backward-compat wrapper — the legacy adaptive form. Now delegates to the
// constitutional §8.4 implementation: ρ by stress level + hard velocity caps
// (the legacy velocity-dampening heuristic is superseded by §8.3's hard cap).
export function smoothWeightsAdaptive(
  prevSmoothed: WeightVector,
  target: WeightVector,
  _lambda: number = 1 - SMOOTHING_RHO_NORMAL,
  _velocity: number = 0,
  stressLevel: number = 0,
): WeightVector {
  return smoothWeightsConstitutional(prevSmoothed, target, stressLevel);
}

// === Helper: blend two weight vectors ===
export function blendWeights(a: WeightVector, b: WeightVector, weightB: number): WeightVector {
  const result: WeightVector = { USD: 0, EUR: 0, JPY: 0, GBP: 0, CNY: 0, CHF: 0, Gold: 0 };
  for (const c of COMPONENTS) {
    result[c] = a[c] * (1 - weightB) + b[c] * weightB;
  }
  return result;
}

// =============================================================================
// §7.4 The Full MASE Objective — 8-term portfolio-level objective
// =============================================================================
// min_(w) [ λ₁ Risk + λ₂ CVaR + λ₃ PPError + λ₄ CorrRisk + λ₅ Turnover
//           + λ₆ StrategicDrift + λ₇ Concentration + λ₈ LiquidityRisk ]
//
// C-036 SEPARATION (v5.0 Ext-3 OD-31): this is the MASE PORTFOLIO objective —
// it is NOT the MARP trade-level gating objective J(s) of v5.0 §3.5
// (implemented in mandate.ts as JS_OBJECTIVE_VERSION "candidate-v1"). The two
// are computed by different modules, live at different layers (weight target
// selection vs trade eligibility), and must never be conflated.
//
// The λ vector: "Risk-Council parameters within constitutional envelopes,
// published with every methodology version, and perturbation-tested;
// λ_CVaR,t is additionally regime-scaled (§5.5)." The PILOT PLACEHOLDER base
// is the uniform vector (1/8 each) — a DISCLOSED substitute until the Risk
// Council publishes the calibrated λ; registered in the mandate open-decision
// register under OD-1/OD-31. Task 8-a: the ONE regime-scaled term the blueprint
// specifies — λ_CVaR,t = λ_CVaR,0·(1 + k·CrisisScore_t) (§5.5 L2571–2574) — is
// now applied LIVE by the engine (buildRiskContext → lambdaVector), so the
// CVaR λ published per snapshot is the scaled value while the other seven
// remain the uniform pilot base.

export const MASE_OBJECTIVE_VERSION = "8term-v2-pilot-uniform-lambda-plus-5.5-regime-scaled-cvar" as const;

export interface MaseObjectiveTerm {
  id: string;
  name: string;
  value: number;      // raw term value
  lambda: number;     // weight applied
  weighted: number;   // value × lambda
}

export interface MaseObjectiveContext {
  /** Per-component return series (fractions) for the scoring window — used by
   *  Risk/CVaR; when absent, terms are labeled estimate-unavailable and scored 0
   *  with an explicit flag (never silently guessed). */
  returns?: Partial<Record<Component, number[]>>;
  vols: VolatilityData;
  corr: CorrelationData | null;
  prevWeights: WeightVector;   // for Turnover
  strategicPrior?: WeightVector; // for StrategicDrift (defaults STRATEGIC_PRIOR)
  liquidityScores?: Partial<Record<Component, number>>; // 0..1 depth scores
  /** §6.1/§6.2 Σ_robust (annualized 7×7). When present, the λ₁ Risk term reads
   *  √(w'Σ_robust w) DIRECTLY — the exact matrix every candidate solver
   *  consumes. Without it the term falls back to the DISCLOSED (vols, corr)
   *  reconstruction (see the shrinkCovariance honest-layer note: σ^MH² ≠
   *  diag(Σ̂), so the fallback is NOT the exact §6.2 matrix). */
  sigmaRobust?: number[][] | null;
}

export const MASE_LAMBDA_PLACEHOLDER: Record<string, number> = {
  Risk: 1 / 8, CVaR: 1 / 8, PPError: 1 / 8, CorrRisk: 1 / 8,
  Turnover: 1 / 8, StrategicDrift: 1 / 8, Concentration: 1 / 8, LiquidityRisk: 1 / 8,
};

/** Evaluate the 8-term objective for a candidate weight vector. Structural
 *  implementation per Blueprint §7.4; term estimators are DISCLOSED PILOT
 *  FORMS (labeled per-term), pending the research program's calibration.
 *  v2.0 Task 8-a: Risk reads √(w'Σ_robust w) directly from the §6.1/§6.2
 *  matrix when supplied (fallback: the disclosed (vols, corr)
 *  reconstruction); CVaR follows the §6.6 estimator (historical 95% tail
 *  loss, L = −R daily) over the disclosed simulated window; λ_CVaR,t arrives
 *  pre-scaled per §5.5 via the `lambda` record; §6.6/§6.7 figures (VaR/CVaR
 *  95/99 + MDD) are computed on the candidate and returned for publication. */
export function evaluateMaseObjective(
  w: WeightVector,
  ctx: MaseObjectiveContext,
  lambda: Record<string, number> = MASE_LAMBDA_PLACEHOLDER,
): { terms: MaseObjectiveTerm[]; total: number; regimeScaledCvar: boolean; riskFigures: MaseRiskFigures | null } {
  const terms: MaseObjectiveTerm[] = [];
  const push = (id: string, name: string, value: number) => {
    const lam = lambda[id] ?? 0;
    terms.push({ id, name, value, lambda: lam, weighted: value * lam });
  };

  // λ₁ Risk — √(w'Σ_robust w), read DIRECTLY from the §6.1/§6.2 robust matrix
  // when supplied (the same Σ_robust the §6.3/§6.4/§6.5 solvers consume —
  // §6.1: "the engine never consumes the raw estimate directly; it consumes
  // the robust shrunk estimator of Section 6.2"). Disclosed fallback for
  // no-matrix callers: the (vols, corr) reconstruction (diagonal-vol when no
  // correlation is supplied) — labeled, never presented as the exact matrix.
  let variance = 0;
  if (ctx.sigmaRobust) {
    for (let i = 0; i < COMPONENTS.length; i++) {
      for (let j = 0; j < COMPONENTS.length; j++) {
        variance += (w[COMPONENTS[i]] ?? 0) * (w[COMPONENTS[j]] ?? 0) * (ctx.sigmaRobust[i]?.[j] ?? 0);
      }
    }
  } else {
    for (const c of COMPONENTS) {
      variance += (w[c] ?? 0) ** 2 * (ctx.vols[c] ?? 0.1) ** 2;
    }
    if (ctx.corr?.matrix) {
      for (let i = 0; i < COMPONENTS.length; i++) {
        for (let j = 0; j < COMPONENTS.length; j++) {
          if (i === j) continue;
          const rho = ctx.corr.matrix[i]?.[j] ?? 0;
          variance += w[COMPONENTS[i]] * w[COMPONENTS[j]] * (ctx.vols[COMPONENTS[i]] ?? 0.1) * (ctx.vols[COMPONENTS[j]] ?? 0.1) * rho;
        }
      }
    }
  }
  push("Risk", "Portfolio volatility √(w'Σ_robust w) (§6.1/§6.2)", Math.sqrt(Math.max(0, variance)));

  // λ₂ CVaR — §6.6 estimator on the candidate basket over the scoring window:
  // CVaR_95 = E[L | L ≥ VaR_95], L = −R daily (convention fixed per §6.6).
  // When a return series is available: realized basket returns, worst 5% mean.
  let cvar = 0;
  if (ctx.returns) {
    const rs: number[] = [];
    const len = Math.max(...COMPONENTS.map((c) => ctx.returns?.[c]?.length ?? 0));
    for (let t = 0; t < len; t++) {
      let r = 0;
      for (const c of COMPONENTS) {
        r += (w[c] ?? 0) * (ctx.returns?.[c]?.[t] ?? 0);
      }
      rs.push(r);
    }
    if (rs.length >= 20) {
      const sorted = [...rs].sort((a, b) => a - b);
      const tailN = Math.max(1, Math.floor(sorted.length * 0.05));
      cvar = -sorted.slice(0, tailN).reduce((a, b) => a + b, 0) / tailN;
    }
  }
  push("CVaR", "95% CVaR — historical tail loss (§6.6)", cvar);
  // §5.5 — regime scaling is now LIVE in the λ record itself: the engine
  // passes λ_CVaR,t = λ_CVaR,0·(1 + k·CrisisScore_t); this flag reports whether
  // that scaling is currently active (λ_CVaR,t above the uniform base).
  const regimeScaled = (lambda.CVaR ?? 0) > (MASE_LAMBDA_PLACEHOLDER.CVaR ?? 0) + 1e-12;

  // λ₃ PPError — purchasing-power tracking error proxy: deviation of the
  // candidate from the PPP-fair basket (pilot proxy: equal-weight 1/7 target;
  // the canonical GPR estimator is a research deliverable — RG-07).
  const ppTarget = 1 / COMPONENTS.length;
  let ppErr = 0;
  for (const c of COMPONENTS) ppErr += Math.abs((w[c] ?? 0) - ppTarget);
  push("PPError", "PPError tracking error (RG-07 proxy — §6.8 GPP pending CPI feeds)", ppErr / 2);

  // λ₄ CorrRisk — average pairwise correlation contribution (fragility of
  // concentrated correlations); 0 when no matrix is supplied (labeled, not guessed).
  let corrRisk = 0;
  if (ctx.corr?.matrix) {
    let sum = 0, n = 0;
    for (let i = 0; i < COMPONENTS.length; i++) {
      for (let j = i + 1; j < COMPONENTS.length; j++) {
        sum += Math.abs(ctx.corr.matrix[i]?.[j] ?? 0) * w[COMPONENTS[i]] * w[COMPONENTS[j]];
        n++;
      }
    }
    corrRisk = n > 0 ? sum / n : 0;
  }
  push("CorrRisk", "Correlation fragility (|ρ|·w_i·w_j mean)", corrRisk);

  // λ₅ Turnover — Σ|w_i − w_prev,i| vs the previous published weights.
  let turnover = 0;
  for (const c of COMPONENTS) turnover += Math.abs((w[c] ?? 0) - (ctx.prevWeights[c] ?? 0));
  push("Turnover", "Turnover vs previous weights", turnover);

  // λ₆ StrategicDrift — distance from the strategic prior (recognizability).
  const prior = ctx.strategicPrior ?? STRATEGIC_PRIOR;
  let drift = 0;
  for (const c of COMPONENTS) drift += Math.abs((w[c] ?? 0) - prior[c]);
  push("StrategicDrift", "Distance from strategic prior", drift);

  // λ₇ Concentration — HHI of the candidate weights.
  let hhi = 0;
  for (const c of COMPONENTS) hhi += (w[c] ?? 0) ** 2;
  push("Concentration", "HHI concentration", hhi);

  // λ₈ LiquidityRisk — 1 minus the liquidity-weighted depth score.
  let liq = 0, wsum = 0;
  for (const c of COMPONENTS) {
    const l = ctx.liquidityScores?.[c];
    if (l != null) {
      liq += (w[c] ?? 0) * (1 - l);
      wsum += w[c] ?? 0;
    }
  }
  push("LiquidityRisk", "Depth-weighted illiquidity", wsum > 0 ? liq / wsum : 0);

  // §6.6 + §6.7 — VaR/CVaR at 95/99 (99% = monitor) and the MDD of the
  // candidate over the scoring window, computed per the exact formulas.
  const riskFigures = ctx.returns ? computeRiskFigures(w, ctx.returns) : null;

  const total = terms.reduce((a, t) => a + t.weighted, 0);
  return { terms, total, regimeScaledCvar: regimeScaled, riskFigures };
}

// =============================================================================
// §7.6 Adaptive Model Weights — softmax over OOS scores
// =============================================================================
// Score_(m,t) = f(OOSRisk, CVaR, PPError, Turnover, Robustness) —
// OUT-OF-SAMPLE statistics only, "the same leakage-controlled validation
// discipline as the research program (§23.4) so the ensemble cannot reward
// in-sample overfitting."
//
//   α_(m,t) = e^(−η·Score_m) / Σ_k e^(−η·Score_k)
//
// DIRECTION (reconciliation gate "softmax score direction"): the exponent is
// NEGATIVE — the score is a RISK score, so LOWER score = BETTER model =
// GREATER weight. "Score orientation chosen so that better models receive
// greater weight."
//
// The PILOT SCORE ESTIMATOR below is a DISCLOSED leak-controlled form: each
// tick, every model's PREVIOUS-tick weight vector is scored against the
// realized component returns of the elapsed tick (weights are fixed before
// the returns materialize — walk-forward by construction, no leakage). The
// functional form f(·) itself is a research-program deliverable; the pilot
// uses EWMA next-period basket risk + turnover penalty + robustness bonus.

export const ENSEMBLE_TEMPERATURE_ETA = 3.0; // η — pilot value; bounds influence-shift speed (§7.6)

export interface OosScoreState {
  /** EWMA next-period OOS risk score per model (lower = better). */
  scores: Record<string, number>;
  /** Number of walk-forward samples accumulated. */
  samples: number;
  /** Last tick's per-model weight vectors (fixed BEFORE the returns realized). */
  prevModelTargets: Record<string, Record<string, number>> | null;
  /** Last tick's price levels P_{i,t}/P_{i,0} per component. */
  prevPriceLevels: Record<string, number> | null;
}

const OOS_EWMA_ALPHA = 0.20; // 20% new-sample weight (disclosed pilot constant)

/** Update a model's EWMA OOS score from one walk-forward observation:
 * the model's previous-tick basket return vs realized component returns. */
export function updateOosScores(
  state: OosScoreState,
  modelIds: string[],
  modelWeights: Record<string, WeightVector>,
  priceLevelsNow: Record<Component, number>,
): OosScoreState {
  const next: OosScoreState = {
    scores: { ...state.scores },
    samples: state.samples + 1,
    prevModelTargets: {},
    prevPriceLevels: { ...priceLevelsNow },
  };
  for (const id of modelIds) {
    next.prevModelTargets![id] = { ...modelWeights[id] } as Record<string, number>;
  }

  if (state.prevModelTargets && state.prevPriceLevels) {
    for (const id of modelIds) {
      const wPrev = state.prevModelTargets[id];
      if (!wPrev) continue;
      // Realized next-period basket return of the model's previous proposal.
      let rModel = 0;
      for (const c of COMPONENTS) {
        const p0 = state.prevPriceLevels[c];
        const p1 = priceLevelsNow[c];
        if (p0 && p1 && p0 > 0) {
          rModel += (wPrev[c] ?? 0) * (p1 / p0 - 1);
        }
      }
      // Score = OOSRisk (squared return — risk orientation) + Turnover penalty.
      const turnover = COMPONENTS.reduce((a, c) => a + Math.abs((modelWeights[id]?.[c] ?? 0) - (wPrev[c] ?? 0)), 0);
      const sample = rModel * rModel + 0.10 * turnover;
      const prev = state.scores[id] ?? sample;
      next.scores[id] = OOS_EWMA_ALPHA * sample + (1 - OOS_EWMA_ALPHA) * prev;
    }
  }
  return next;
}

/** §7.6 softmax: α_m = e^(−η·Score_m) / Σ e^(−η·Score_k). Returns uniform
 * weights when scores are insufficient (first ticks — no OOS evidence yet). */
export function adaptiveEnsembleWeights(
  scores: Record<string, number>,
  modelIds: string[],
  eta: number = ENSEMBLE_TEMPERATURE_ETA,
): { alphas: Record<string, number>; adaptive: boolean } {
  const have = modelIds.filter((id) => scores[id] != null && Number.isFinite(scores[id]));
  if (have.length < modelIds.length || have.length === 0) {
    const u = 1 / modelIds.length;
    return { alphas: Object.fromEntries(modelIds.map((id) => [id, u])), adaptive: false };
  }
  const exps = Object.fromEntries(
    modelIds.map((id) => [id, Math.exp(-eta * scores[id])]),
  );
  const sum = Object.values(exps).reduce((a, b) => a + b, 0);
  const alphas = Object.fromEntries(modelIds.map((id) => [id, exps[id] / sum]));
  return { alphas, adaptive: true };
}

/** §7.5 + §7.6 ensemble: six families combined with ADAPTIVE softmax α when
 * OOS scores exist (walk-forward updated by the engine each tick), uniform
 * 1/6 otherwise (the pre-§7.6 pilot behavior, retained as the cold-start
 * fallback). Every member is admissibility-projected AFTER averaging (§8.1).
 * Task 8-a: the §5/§6 risk-estimator context derived inside maseEnsemble is
 * passed through (blendedVols / riskEstimators / lambdaVector) so the engine
 * can wire the exact estimators into the §7.4 objective and the UI without a
 * second derivation pass (identical objects — idempotent). */
export function maseEnsembleAdaptive(
  vols: VolatilityData,
  prices: PriceData,
  corr: CorrelationData | null,
  regime: MarketRegime,
  oosScores?: Record<string, number> | null,
): {
  target: WeightVector;
  models: { id: string; name: string; weights: WeightVector }[];
  alphas: Record<string, number>;
  adaptive: boolean;
  /** §5.1 σ^MH — the blend that governed every risk figure in this pass. */
  blendedVols: VolatilityData;
  /** §5.1/§5.4/§5.5/§6.1/§6.2/§6.8 estimator payload (published for the UI). */
  riskEstimators: MaseRiskEstimatorState;
  /** §7.4 λ vector — uniform pilot base with the §5.5 regime-scaled λ_CVaR,t. */
  lambdaVector: Record<string, number>;
} {
  const base = maseEnsemble(vols, prices, corr, regime);
  // Family ids (§7.5): stability covers minvar+erc; the rest are 1:1.
  const familyModelIds = ["minvar", "erc", "maxdiv", "cvar", "ppp", "institutional", "regime"];
  const { alphas, adaptive } = adaptiveEnsembleWeights(oosScores ?? {}, familyModelIds);

  // Stability family = 50/50 blend of minvar + erc (§7.5), weighted by the
  // softmax average of the two members' α (documented pilot mapping).
  const stabilityAlpha = (alphas.minvar + alphas.erc) / 2;
  const familyWeights: { id: string; w: WeightVector; alpha: number }[] = [
    { id: "stability", w: blendWeights(base.models[0].weights, base.models[1].weights, 0.5), alpha: stabilityAlpha },
    { id: "maxdiv", w: base.models[2].weights, alpha: alphas.maxdiv },
    { id: "cvar", w: base.models[3].weights, alpha: alphas.cvar },
    { id: "ppp", w: base.models[4].weights, alpha: alphas.ppp },
    { id: "institutional", w: base.models[5].weights, alpha: alphas.institutional },
    { id: "regime", w: base.models[6].weights, alpha: alphas.regime },
  ];
  const alphaSum = familyWeights.reduce((a, f) => a + f.alpha, 0) || 1;
  const target: WeightVector = { USD: 0, EUR: 0, JPY: 0, GBP: 0, CNY: 0, CHF: 0, Gold: 0 };
  for (const f of familyWeights) {
    const a = f.alpha / alphaSum;
    for (const c of COMPONENTS) target[c] += f.w[c] * a;
  }
  return {
    target,
    models: base.models,
    alphas,
    adaptive,
    blendedVols: base.blendedVols,
    riskEstimators: base.riskEstimators,
    lambdaVector: base.lambdaVector,
  };
}

// === Helper: generate synthetic volatility data from price history ===
export function estimateVolatility(
  priceHistory: { EUR: number; JPY: number; GBP: number; CNY: number; CHF: number; Gold: number }[],
): VolatilityData {
  if (priceHistory.length < 2) {
    return { USD: 0.08, EUR: 0.10, JPY: 0.12, GBP: 0.11, CNY: 0.09, CHF: 0.10, Gold: 0.15 };
  }
  const calcVol = (returns: number[]) => {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance * 252); // annualized
  };
  const returns = (key: keyof typeof priceHistory[0]) => {
    return priceHistory.slice(1).map((p, i) => Math.log(p[key] / priceHistory[i][key]));
  };
  return {
    USD: 0.05, // USD is base, low vol
    EUR: calcVol(returns("EUR")),
    JPY: calcVol(returns("JPY")),
    GBP: calcVol(returns("GBP")),
    CNY: calcVol(returns("CNY")),
    CHF: calcVol(returns("CHF")),
    Gold: calcVol(returns("Gold")),
  };
}
