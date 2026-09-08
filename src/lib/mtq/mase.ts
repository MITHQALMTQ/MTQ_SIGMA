// MTQΣ — MASE (Multi-model Adaptive Stability Engine) v1.0
// Implements the 6 candidate models from §6 of the Master Blueprint.
// Each model computes a weight vector W^Target for the 7 components
// (USD, EUR, JPY, GBP, CNY, CHF, Gold) based on different objectives.
// The ensemble then combines them with adaptive weights.

import { STRATEGIC_PRIOR, ADMISSIBILITY_ENVELOPES } from "./blueprint";

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

// === Model 1: Minimum Variance (§6.3) ===
// Minimize portfolio variance against robust covariance estimate.
// Simplified pilot: inverse-volatility weighting (approximation of min-variance).
export function modelMinimumVariance(
  vols: VolatilityData,
  _prices: PriceData,
  _corr: CorrelationData | null,
): WeightVector {
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
// Each component contributes equally to portfolio risk.
// Simplified: equal weight (1/N) — true ERC requires iterative solving.
export function modelEqualRiskContribution(
  _vols: VolatilityData,
  _prices: PriceData,
  _corr: CorrelationData | null,
): WeightVector {
  const w = 1 / COMPONENTS.length;
  return { USD: w, EUR: w, JPY: w, GBP: w, CNY: w, CHF: w, Gold: w };
}

// === Model 3: Maximum Diversification (§6.5) ===
// Maximize the diversification ratio.
// Simplified: weight by inverse correlation to the basket.
export function modelMaxDiversification(
  vols: VolatilityData,
  _prices: PriceData,
  corr: CorrelationData | null,
): WeightVector {
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
// Minimize conditional value-at-risk at 95th percentile.
// Simplified: overweight gold + CHF (safe havens) in stress, underweight risk currencies.
export function modelCVaR(
  vols: VolatilityData,
  _prices: PriceData,
  _corr: CorrelationData | null,
  regime?: MarketRegime,
): WeightVector {
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

// === Model 6: Regime-Adaptive (§6.8) ===
// Switch model emphasis based on detected market regime.
export function modelRegimeAdaptive(
  vols: VolatilityData,
  prices: PriceData,
  corr: CorrelationData | null,
  regime: MarketRegime,
): WeightVector {
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
    // Crisis: heavily favor CVaR + gold
    const cvar = modelCVaR(vols, prices, corr, regime);
    const gold = { USD: 0.15, EUR: 0.10, JPY: 0.07, GBP: 0.06, CNY: 0.04, CHF: 0.08, Gold: 0.50 } as WeightVector;
    return blendWeights(cvar, gold, 0.5);
  }
}

// === Ensemble Combination (§7) ===
// Combine model outputs with adaptive ensemble weights.
// In the pilot: equal-weight ensemble (each model gets 1/6 weight).
// Production: ensemble weights adapt based on model performance.
export function maseEnsemble(
  vols: VolatilityData,
  prices: PriceData,
  corr: CorrelationData | null,
  regime: MarketRegime,
): { target: WeightVector; models: { id: string; name: string; weights: WeightVector }[] } {
  const models = [
    { id: "minvar", name: "Minimum Variance", weights: modelMinimumVariance(vols, prices, corr) },
    { id: "erc", name: "Equal Risk Contribution", weights: modelEqualRiskContribution(vols, prices, corr) },
    { id: "maxdiv", name: "Maximum Diversification", weights: modelMaxDiversification(vols, prices, corr) },
    { id: "cvar", name: "Tail Risk (CVaR)", weights: modelCVaR(vols, prices, corr, regime) },
    { id: "ppp", name: "Purchasing-Power", weights: modelPurchasingPower(vols, prices, corr) },
    { id: "regime", name: "Regime-Adaptive", weights: modelRegimeAdaptive(vols, prices, corr, regime) },
  ];

  // Equal-weight ensemble
  const ensembleWeight = 1 / models.length;
  const target: WeightVector = { USD: 0, EUR: 0, JPY: 0, GBP: 0, CNY: 0, CHF: 0, Gold: 0 };
  for (const m of models) {
    for (const c of COMPONENTS) {
      target[c] += m.weights[c] * ensembleWeight;
    }
  }

  return { target, models };
}

// === Envelope Constraint (§8.1) ===
// Clamp each component to its admissibility envelope.
export function applyEnvelopes(weights: WeightVector): WeightVector {
  const result: WeightVector = { ...weights };
  for (const c of COMPONENTS) {
    const env = ADMISSIBILITY_ENVELOPES[c];
    result[c] = Math.max(env.lower, Math.min(env.upper, result[c]));
  }
  // Renormalize to sum to 1
  const sum = Object.values(result).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const c of COMPONENTS) result[c] /= sum;
  }
  return result;
}

// === Stress-Adaptive Smoothing (§8.4) ===
// EMA smoothing toward the constrained target.
export function smoothWeights(
  prevSmoothed: WeightVector,
  target: WeightVector,
  lambda: number = 0.20,
): WeightVector {
  const result: WeightVector = { USD: 0, EUR: 0, JPY: 0, GBP: 0, CNY: 0, CHF: 0, Gold: 0 };
  for (const c of COMPONENTS) {
    result[c] = lambda * target[c] + (1 - lambda) * (prevSmoothed[c] ?? STRATEGIC_PRIOR[c]);
  }
  return result;
}

// === Helper: blend two weight vectors ===
export function blendWeights(a: WeightVector, b: WeightVector, weightB: number): WeightVector {
  const result: WeightVector = { USD: 0, EUR: 0, JPY: 0, GBP: 0, CNY: 0, CHF: 0, Gold: 0 };
  for (const c of COMPONENTS) {
    result[c] = a[c] * (1 - weightB) + b[c] * weightB;
  }
  return result;
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
