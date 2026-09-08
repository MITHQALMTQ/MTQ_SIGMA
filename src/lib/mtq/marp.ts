// MTQΣ — MARP (Monetary Adaptive Rebalancing Protocol) v1.0
// Implements §10 of the Master Blueprint: daily calculation vs actual rebalancing,
// urgency test, no-trade zones, cost-benefit gate, partial corrections.

import type { WeightVector, Component } from "./mase";
import { COMPONENTS } from "./mase";

export interface MarpDecision {
  shouldTrade: boolean;
  component: Component;
  direction: "buy" | "sell" | "hold";
  tradeUsd: number;
  urgency: number;       // 0..1
  reason: string;
  level: number;          // 1..6 (MARP hierarchy level)
}

// === §10.1 Daily Calculation vs Actual Rebalancing ===
// Calculate every day but trade only on justified urgency.

// === §10.2 Rebalancing Urgency ===
// Urgency = f(deviation, reserveRatio, volatility)
export function computeUrgency(
  deviation: number,      // |observed - target| weight deviation
  reserveRatio: number,  // current RR
  volatility: number,     // component volatility
): number {
  // Base urgency from deviation
  const devUrgency = Math.min(1, deviation / 0.05); // 5% deviation = max urgency
  // Reserve ratio urgency (lower RR = more urgent)
  const rrUrgency = reserveRatio < 1.10 ? (1.10 - reserveRatio) / 0.10 : 0;
  // Volatility penalty (high vol = less urgent to trade, more urgent to hold)
  const volFactor = 1 - Math.min(0.5, volatility * 2);
  return Math.max(0, Math.min(1, (devUrgency + rrUrgency) * volFactor));
}

// === §10.4 No-Trade Zone ===
// If deviation is below the no-trade threshold, don't trade.
export function inNoTradeZone(
  deviation: number,
  threshold: number = 0.005,  // 0.5% no-trade band
): boolean {
  return Math.abs(deviation) < threshold;
}

// === §10.8 Cost-Benefit Gate ===
// Trade only if expected benefit > estimated cost.
export function costBenefitGate(
  deviation: number,
  nav: number,
  tradeUsd: number,
  slippage: number = 0.001,  // 0.1% estimated
  gasCost: number = 50,       // ~$50 gas
): { pass: boolean; benefit: number; cost: number; netBenefit: number } {
  const benefit = Math.abs(deviation) * nav * 0.4; // 40% of deviation value
  const cost = tradeUsd * slippage + gasCost;
  const netBenefit = benefit - cost;
  return { pass: netBenefit > 0, benefit, cost, netBenefit };
}

// === §10.5 Partial Corrections ===
// Don't correct the full deviation in one trade — use a correction factor.
export function partialCorrection(
  deviation: number,
  correctionFactor: number = 0.5,  // correct 50% of deviation per trade
): number {
  return deviation * correctionFactor;
}

// === §10 MARP Main Decision ===
// For each component, decide whether to trade and how much.
export function marpDecision(
  observed: WeightVector,
  target: WeightVector,
  nav: number,
  reserveRatio: number,
  volatilities: Record<Component, number>,
): MarpDecision[] {
  const decisions: MarpDecision[] = [];

  for (const c of COMPONENTS) {
    const deviation = observed[c] - target[c];
    const absDev = Math.abs(deviation);
    const vol = volatilities[c] ?? 0.10;

    // Level 1: No-trade zone check
    if (inNoTradeZone(deviation)) {
      decisions.push({ shouldTrade: false, component: c, direction: "hold", tradeUsd: 0, urgency: 0, reason: "No-trade zone (deviation < 0.5%)", level: 1 });
      continue;
    }

    // Level 2: Urgency test
    const urgency = computeUrgency(deviation, reserveRatio, vol);
    if (urgency < 0.05) {
      decisions.push({ shouldTrade: false, component: c, direction: "hold", tradeUsd: 0, urgency, reason: `Low urgency (${(urgency * 100).toFixed(1)}%)`, level: 2 });
      continue;
    }

    // Level 3: Partial correction sizing
    const correction = partialCorrection(deviation);
    const tradeUsd = Math.abs(correction) * nav;

    // Level 4: Cost-benefit gate
    const gate = costBenefitGate(deviation, nav, tradeUsd);
    if (!gate.pass) {
      decisions.push({ shouldTrade: false, component: c, direction: "hold", tradeUsd: 0, urgency, reason: `Cost (${gate.cost.toFixed(0)}) ≥ benefit (${gate.benefit.toFixed(0)})`, level: 4 });
      continue;
    }

    // Level 5: Daily turnover check (max 5% of NAV per day)
    if (tradeUsd > nav * 0.05) {
      // Cap at 5% and defer the rest
      const cappedUsd = nav * 0.05;
      decisions.push({
        shouldTrade: true,
        component: c,
        direction: deviation > 0 ? "sell" : "buy",
        tradeUsd: cappedUsd,
        urgency,
        reason: `Capped at 5% NAV (would trade ${(tradeUsd / 1000).toFixed(0)}K, capped to ${(cappedUsd / 1000).toFixed(0)}K)`,
        level: 5,
      });
      continue;
    }

    // Level 6: Execute
    decisions.push({
      shouldTrade: true,
      component: c,
      direction: deviation > 0 ? "sell" : "buy",
      tradeUsd,
      urgency,
      reason: `Benefit (${gate.benefit.toFixed(0)}) > cost (${gate.cost.toFixed(0)}), urgency ${(urgency * 100).toFixed(1)}%`,
      level: 6,
    });
  }

  return decisions;
}

// === Natural Cash-Flow Preference (§10.6) ===
// Prefer using natural cash flows (mints, redemptions) over explicit trades.
export function naturalCashFlowPreference(
  pendingMintUsd: number,
  pendingRedeemUsd: number,
  deviation: WeightVector,
): { reducesTrade: boolean; naturalFlowUsd: number } {
  // If there's a mint pending, it adds USDC → can be used to buy underweight assets
  // If there's a redeem pending, it removes assets → can be used to sell overweight
  const totalNatural = pendingMintUsd + pendingRedeemUsd;
  return {
    reducesTrade: totalNatural > 0,
    naturalFlowUsd: totalNatural,
  };
}
