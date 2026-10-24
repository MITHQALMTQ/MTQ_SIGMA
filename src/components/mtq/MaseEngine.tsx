// MTQΣ — MASE Ensemble + 4-State Weights + MARP (§6 / §7 / §8 / §10 — v1.0)
// Surfaces the live Multi-Asset Stochastic Ensemble output: the 7 candidate
// models across the six §7.5 families (Stability blends Min-Variance + ERC),
// the family-weight ensemble target (uniform 1/6 cold start → adaptive §7.6
// softmax once OOS samples accumulate), the per-component admissibility
// envelope status, the four-state weight distinction
// (W^Prior ≠ W^Target ≠ W^Smooth ≠ W^Execution), and the MARP per-component
// 8-level gate pipeline (natural flows, no-trade zone, urgency, zero size,
// cost-benefit, thin liquidity, turnover cap, execute).
//
// The legacy §6 macro engine (VIX/DXY → θ ±3%) is retained above this section
// as one input to MASE. The legacy §7 rebalance engine (single-direction gold
// trade) is retained below as an ADVISORY display — MARP (§10/§11) is now the
// ACTIVE execution path (USE_MARP_EXECUTION=true, audit P1-4; rebalancePath
// = 'marp'). Both render in parallel so the pilot can be compared.

"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { Panel, Reveal, TickNumber, Pill, GlowDot, MiniBar, Stat } from "./primitives";
import { fmtUsdCompact, fmtPct } from "./format";
import {
  STRATEGIC_PRIOR,
  ADMISSIBILITY_ENVELOPES,
  WEIGHT_STATE_DESCRIPTIONS,
  SMOOTHING_LAMBDA,
  MASE_MODELS,
} from "@/lib/mtq/blueprint";
import { COMPONENTS, type Component } from "@/lib/mtq/mase";
import type { MetricsSnapshot, MaseSnapshotRiskExtras } from "@/lib/mtq/engine";

/** v2.0 Task 8-a — the §5/§6 risk-estimator extras the engine attaches to the
 *  mase snapshot block structurally (MaseSnapshotRiskExtras). The base type
 *  doesn't declare them (interface region owned by another agent), so this
 *  intersection is the honest read-side contract. */
type MaseFull = NonNullable<MetricsSnapshot["mase"]> & MaseSnapshotRiskExtras;

/* ---------- Regime badge ---------- */
function RegimeBadge({ regime }: { regime: 0 | 1 | 2 | 3 }) {
  const labels: Record<number, { label: string; tone: "emerald" | "gold" | "amber" | "rose" }> = {
    0: { label: "Calm", tone: "emerald" },
    1: { label: "Normal", tone: "gold" },
    2: { label: "Stress", tone: "amber" },
    3: { label: "Crisis", tone: "rose" },
  };
  const l = labels[regime] ?? labels[1];
  return (
    <Pill tone={l.tone}>
      <GlowDot color={l.tone === "emerald" ? "emerald" : l.tone === "gold" ? "gold" : l.tone === "amber" ? "amber" : "rose"} size="h-1.5 w-1.5" />
      regime: {l.label}
    </Pill>
  );
}

/* ---------- Weight heatmap cell ---------- */
function WeightCell({ value, isTarget }: { value: number; isTarget?: boolean }) {
  // Color intensity ∝ weight. Gold = warm gold, others = neutral amber.
  const pct = Math.max(0, Math.min(100, value * 100));
  const opacity = 0.06 + (pct / 100) * 0.32; // 0.06 → 0.38
  return (
    <td
      className={`px-2 py-1.5 text-right font-mono tabular-nums ${isTarget ? "text-mtqs-gold font-semibold" : "text-white"}`}
      style={{ backgroundColor: isTarget ? `rgba(43,171,251,${opacity + 0.06})` : `rgba(43,171,251,${opacity})` }}
    >
      {(value * 100).toFixed(2)}%
    </td>
  );
}

/* ---------- Envelope status badge ---------- */
function EnvelopeStatusBadge({ status }: { status: "ok" | "warn" | "breach" }) {
  if (status === "ok") {
    return (
      <Pill tone="emerald">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        in band
      </Pill>
    );
  }
  if (status === "warn") {
    return (
      <Pill tone="amber">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        near edge
      </Pill>
    );
  }
  return (
    <Pill tone="rose">
      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
      breach
    </Pill>
  );
}

/* ---------- Direction badge for MARP ---------- */
function MarpDirectionBadge({ direction, shouldTrade }: { direction: string; shouldTrade: boolean }) {
  if (!shouldTrade || direction === "hold") {
    return (
      <Pill tone="muted">
        <Minus className="h-3 w-3" aria-hidden="true" />
        hold
      </Pill>
    );
  }
  if (direction === "buy") {
    return (
      <Pill tone="emerald">
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        buy
      </Pill>
    );
  }
  return (
    <Pill tone="rose">
      <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
      sell
    </Pill>
  );
}

/* ---------- Level badge (MARP 8-level gate pipeline — matches marp.ts;
            same labels as RebalanceEngine, audit 7-b gap 4 correction) ---------- */
function MarpLevelBadge({ level, shouldTrade }: { level: number; shouldTrade: boolean }) {
  const tone = shouldTrade ? "gold" : level <= 2 ? "muted" : "amber";
  const labels: Record<number, string> = {
    1: "L1 · flows cover gap",
    2: "L2 · no-trade zone (≤0.75%)",
    3: "L3 · low urgency",
    4: "L4 · zero size",
    5: "L5 · cost-benefit fail",
    6: "L6 · thin liquidity",
    7: "L7 · turnover cap",
    8: "L8 · execute",
  };
  return <Pill tone={tone as "gold" | "muted" | "amber"}>{labels[level] ?? `L${level}`}</Pill>;
}

/* ---------- Main component ---------- */
export function MaseEngine({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-lg bg-white/[0.03]" />
        ))}
      </div>
    );
  }

  const mase = snapshot.mase;
  // v2.0 §5/§6 extras (blendedVols · riskEstimators · lambdaVector · tailRisk).
  const maseX = (mase ?? null) as MaseFull | null;
  const risk = maseX?.riskEstimators ?? null;
  const tail = maseX?.tailRisk ?? null;
  const lambdaVector = maseX?.lambdaVector ?? null;
  const ws = snapshot.weightStates;
  const marp = snapshot.marp;
  const envelopes = snapshot.envelopes;

  // Regime inference from observed MASE target — recompute from macro VIX
  // (the engine uses fx.VIX for regime detection inside buildMaseSnapshot).
  const vix = snapshot.macro.vix;
  const dxy = snapshot.macro.dxy;
  let regime: 0 | 1 | 2 | 3 = 1;
  if (vix >= 30) regime = 3;
  else if (vix >= 22) regime = 2;
  else if (vix >= 15) regime = 1;
  else regime = 0;
  if ((dxy >= 115 || dxy <= 88) && regime < 2) regime = 2;

  // Aggregate envelope status counts
  const envCounts = envelopes.reduce(
    (acc, e) => {
      acc[e.status] += 1;
      return acc;
    },
    { ok: 0, warn: 0, breach: 0 } as Record<"ok" | "warn" | "breach", number>,
  );

  return (
    <div className="space-y-4">
      {/* ===== Header: regime + summary + MARP total ===== */}
      <Reveal>
        <Panel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white/90">MASE Ensemble + 4-State Weights + MARP (v1.0)</div>
              <p className="mt-1 text-[0.72rem] text-white/55 leading-relaxed max-w-2xl">
                The Multi-Asset Stochastic Ensemble (§6 / §7) runs 7 candidate models across 6 §7.5 families,
                blends them with the <span className="text-mtqs-gold">§7.6 adaptive softmax</span> α<sub>m</sub> = e^(−η·Score<sub>m</sub>)/Σe^(−η·Score<sub>k</sub>)
                (walk-forward OOS scores — lower risk score = greater weight), clamps to per-component admissibility
                envelopes (§8.1), and EMA-smooths (ρ = 0.50/0.75 by stress level) toward the constrained target (§8.4).
                MARP (§10) then decides per-component whether the deviation between the smoothed target and
                the observed execution weight justifies a trade — with the v5.0 corrected-gate record attached
                in shadow mode. The published weight W<sub>t</sub> is always the
                <span className="text-mtqs-gold">execution weight</span> (the §2.3 four-state rule:
                W<sup>Prior</sup> ≠ W<sup>Target</sup> ≠ W<sup>Smooth</sup> ≠ W<sup>Execution</sup>).
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <RegimeBadge regime={regime} />
                <Pill tone={marp && marp.totalTradeUsd > 0 ? "gold" : "muted"}>
                  <GlowDot color={marp && marp.totalTradeUsd > 0 ? "gold" : "emerald"} size="h-1.5 w-1.5" />
                  MARP total: {marp ? fmtUsdCompact(marp.totalTradeUsd) : "—"}
                </Pill>
              </div>
              {/* AUDIT-FIX F-5 — honest regime classifier label (v2.0 update):
                the §5.4 six-regime probability model is now LIVE (below); the
                hard 4-state classifier is retained for state decisions only. */}
              <span className="max-w-[16rem] text-right text-[0.6rem] leading-snug text-white/45">
                State badge: 4-state classifier (state decisions only) — the §5.4
                six-regime probability model + CrisisScore are live below
              </span>
            </div>
          </div>
        </Panel>
      </Reveal>

      {/* ===== Section A: MASE candidate models heatmap ===== */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
                §6 / §7 · MASE Candidate Models · §7.6 adaptive softmax ensemble
              </div>
              <div className="text-sm font-semibold text-white/90 mt-1">Per-model weight vectors (W<sup>Target</sup> candidates)</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={mase?.adaptive ? "emerald" : "muted"}>
                {mase?.adaptive ? `adaptive α · ${mase.oosSamples} OOS samples` : "cold start · uniform α = 1/6"}
              </Pill>
              <Pill tone="muted">η = 3 · e^(−η·Score) — lower score = greater weight</Pill>
            </div>
          </div>
          {mase ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[0.72rem]">
                <thead>
                  <tr className="text-white/55 border-b border-white/[0.06]">
                    <th className="text-left px-2 py-2 font-medium">Model</th>
                    {COMPONENTS.map((c) => (
                      <th key={c} className="text-right px-2 py-2 font-medium font-mono">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mase.models.map((m) => (
                    <tr key={m.id} className="border-b border-white/[0.06] hover:bg-white/[0.01]">
                      <td className="px-2 py-1.5">
                        <div className="flex flex-col">
                          <span className="font-medium text-white/90">{m.name}</span>
                          <span className="text-[0.62rem] text-white/60 font-mono">
                            {m.id}{mase?.alphas?.[m.id] != null ? ` · α=${(mase.alphas[m.id] * 100).toFixed(1)}%` : ""}
                          </span>
                        </div>
                      </td>
                      {COMPONENTS.map((c) => (
                        <WeightCell key={c} value={m.weights[c] ?? 0} />
                      ))}
                    </tr>
                  ))}
                  {/* Ensemble target row (highlighted) */}
                  <tr className="border-t-2 border-mtqs-amber/30 bg-mtqs-amber/5">
                    <td className="px-2 py-2">
                      <div className="flex flex-col">
                        <span className="font-semibold text-mtqs-gold">Ensemble Target</span>
                        <span className="text-[0.62rem] text-mtqs-gold/70 font-mono">W<sup>Target</sup> · pre-envelope</span>
                      </div>
                    </td>
                    {COMPONENTS.map((c) => (
                      <WeightCell key={c} value={mase.ensembleTarget[c] ?? 0} isTarget />
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[0.75rem] text-white/55">
              MASE ensemble not computed yet.
            </div>
          )}
          <p className="mt-3 text-[0.68rem] text-white/55 leading-relaxed">
            Each cell shows that model's recommended weight for the component; α is the §7.6 softmax weight from
            walk-forward OOS scoring (models are scored on their PREVIOUS proposals against realized returns —
            leakage-controlled by construction). The <span className="text-mtqs-gold font-medium">Ensemble Target</span> row
            is the α-weighted average — this becomes W<sup>Target</sup> before envelope constraints are applied.
            {mase && !mase.adaptive && " Cold start: uniform α = 1/6 until the first OOS samples accumulate."}
          </p>
          {mase?.objective && mase.objective.length > 0 && (
            <div className="mt-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-[0.625rem] uppercase tracking-[0.2em] text-white/55">§7.4 · 8-term MASE objective on the constrained target</span>
                <Pill tone="muted">{mase.objectiveVersion}</Pill>
                <Pill tone="gold">total = {mase.objectiveTotal.toFixed(4)}</Pill>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mase.objective.map((t) => (
                  <span key={t.id} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[0.62rem] text-white/70">
                    <span className="text-white/90">{t.id}</span> λ={t.lambda.toFixed(3)} · {t.value.toFixed(4)}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[0.6rem] leading-snug text-white/45">
                C-036 separation: this is the MASE portfolio objective — NOT the MARP trade-gate J(s) of v5.0 §3.5
                (candidate, OD-1 open). λ base is the disclosed uniform placeholder (1/8, OD-1/OD-31 calibration
                pending); λ<sub>CVaR,t</sub> = λ<sub>0</sub>·(1 + k·CrisisScore<sub>t</sub>) is regime-scaled per §5.5 — applied CVaR λ
                = {lambdaVector?.CVaR != null ? lambdaVector.CVaR.toFixed(4) : "—"} (k = 1.0 pilot).
              </p>
            </div>
          )}
        </Panel>
      </Reveal>

      {/* ===== Section A2 (v2.0): §5 Input Signals & Regime Model ===== */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
                §5 · Input Signals and Regime Model (v2.0)
              </div>
              <div className="text-sm font-semibold text-white/90 mt-1">
                Multi-horizon volatility σ<sup>MH</sup> · six-regime probabilities p<sub>t</sub> · CrisisScore<sub>t</sub>
              </div>
            </div>
            {risk && <Pill tone="muted">{risk.version}</Pill>}
          </div>
          {risk ? (
            <div className="space-y-5">
              {/* §5.1 multi-horizon volatility */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[0.72rem] font-semibold text-mtqs-gold">
                    §5.1 · σ<sub>i</sub><sup>MH</sup> = Σ<sub>h</sub> ω<sub>h</sub> σ<sub>i,h</sub> over h ∈ 30d · 90d · 252d · 756d (Σω<sub>h</sub> = 1)
                  </span>
                  {risk.volHorizonWeights.map((hw) => (
                    <Pill key={hw.horizon} tone="gold">ω<sub>{hw.horizon}d</sub> = {(hw.weight * 100).toFixed(0)}%</Pill>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[0.72rem]">
                    <thead>
                      <tr className="text-white/55 border-b border-white/[0.06]">
                        <th className="text-left px-2 py-2 font-medium">Component</th>
                        <th className="text-right px-2 py-2 font-medium font-mono">σ<sub>30d</sub></th>
                        <th className="text-right px-2 py-2 font-medium font-mono">σ<sub>90d</sub></th>
                        <th className="text-right px-2 py-2 font-medium font-mono">σ<sub>252d</sub></th>
                        <th className="text-right px-2 py-2 font-medium font-mono">σ<sub>756d</sub></th>
                        <th className="text-right px-2 py-2 font-medium font-mono text-mtqs-gold">σ<sup>MH</sup> (governs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {risk.volHorizons.map((v) => (
                        <tr key={v.component} className="border-b border-white/[0.06] hover:bg-white/[0.01]">
                          <td className="px-2 py-1.5 font-mono font-medium text-mtqs-gold">{v.component}</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-white/55">{(v.h30 * 100).toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-white/55">{(v.h90 * 100).toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-white/55">{(v.h252 * 100).toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-white/55">{(v.h756 * 100).toFixed(2)}%</td>
                          <td className="px-2 py-1.5 text-right font-mono tabular-nums text-mtqs-gold font-semibold">{(v.blended * 100).toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[0.6rem] leading-snug text-white/45">
                  Data window (disclosed): {risk.dataWindow.disclosure} The ω<sub>h</sub> vector is the
                  published pilot initialization (§23.6 perturbation candidates — NOT canonical).
                </p>
              </div>

              {/* §5.4 six-regime probability model */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[0.72rem] font-semibold text-mtqs-gold">
                    §5.4 · p<sub>t</sub> = [P(N), P(I), P(D), P(S), P(L), P(G)]
                  </span>
                  <Pill tone="muted">{risk.regime6.classifierVersion}</Pill>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {risk.regime6.probabilities.map((p) => (
                    <div key={p.regime} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
                      <div className="flex items-baseline justify-between gap-1 mb-1">
                        <span className="text-[0.64rem] font-medium text-white/85">{p.regime}</span>
                        <span className="font-mono text-[0.68rem] tabular-nums text-mtqs-gold">{(p.probability * 100).toFixed(1)}%</span>
                      </div>
                      <MiniBar value={p.probability} max={1} colorClass="bg-amber-400" height="h-1" aria-hidden="true" />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[0.6rem] leading-snug text-white/45">
                  W<sup>Regime</sup> = Σ<sub>r</sub> P(r|X<sub>t</sub>)·W<sup>(r)</sup> — §8.1-projected before ensemble entry (the
                  Regime-Adaptive row in the candidate table above). {risk.regime6.disclosure}
                </p>
              </div>

              {/* §5.5 crisis score */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[0.72rem] font-semibold text-mtqs-gold">
                    §5.5 · CrisisScore<sub>t</sub> → λ<sub>CVaR,t</sub> = λ<sub>CVaR,0</sub>·(1 + k·CrisisScore<sub>t</sub>)
                  </span>
                  <Pill tone={risk.crisis.score >= 0.7 ? "rose" : risk.crisis.score >= 0.4 ? "amber" : "emerald"}>
                    CrisisScore<sub>t</sub> = {(risk.crisis.score * 100).toFixed(1)}%
                  </Pill>
                  <Pill tone="gold">
                    λ<sub>CVaR,t</sub> = {risk.crisis.lambdaCvar0.toFixed(4)}·(1 + {risk.crisis.k.toFixed(1)}·{risk.crisis.score.toFixed(3)})
                    = <span className="font-semibold">{risk.crisis.lambdaCvarT.toFixed(4)}</span>
                  </Pill>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
                  {risk.crisis.inputs.map((i) => (
                    <div
                      key={i.name}
                      className={`rounded-md border p-1.5 ${i.available ? "border-white/[0.06] bg-white/[0.02]" : "border-white/[0.04] bg-white/[0.01] opacity-60"}`}
                    >
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="text-[0.58rem] text-white/70">{i.name}</span>
                        <span className="font-mono text-[0.58rem] tabular-nums text-white/85">
                          {i.available ? `${(i.evidence * 100).toFixed(0)}%` : "no feed"}
                        </span>
                      </div>
                      <div className="text-[0.52rem] text-white/40">w = {(i.weight * 100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[0.6rem] leading-snug text-white/45">
                  λ<sub>CVaR,t</sub> scales the §7.4 tail-risk term live (applied λ shown in the objective box).
                  {risk.crisis.disclosure}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[0.75rem] text-white/55">
              §5 risk estimators not computed yet.
            </div>
          )}
        </Panel>
      </Reveal>

      {/* ===== Section B: 4-state weight table ===== */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
                §2.3 · Four-State Weight Distinction
              </div>
              <div className="text-sm font-semibold text-white/90 mt-1">W<sup>Prior</sup> ≠ W<sup>Target</sup> ≠ W<sup>Smooth</sup> ≠ W<sup>Execution</sup></div>
            </div>
            <Pill tone="gold">published = execution (§2.3)</Pill>
          </div>
          {ws ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[0.74rem]">
                <thead>
                  <tr className="text-white/55 border-b border-white/[0.06]">
                    <th className="text-left px-2 py-2 font-medium">Component</th>
                    <th className="text-right px-2 py-2 font-medium">
                      <span className="font-mono text-mtqs-gold">W<sup>Prior</sup></span>
                      <div className="text-[0.6rem] text-white/60 font-normal">soft anchor</div>
                    </th>
                    <th className="text-right px-2 py-2 font-medium">
                      <span className="font-mono text-mtqs-gold">W<sup>Target</sup></span>
                      <div className="text-[0.6rem] text-white/60 font-normal">MASE + envelope</div>
                    </th>
                    <th className="text-right px-2 py-2 font-medium">
                      <span className="font-mono text-mtqs-emerald/90">W<sup>Smooth</sup></span>
                      <div className="text-[0.6rem] text-white/60 font-normal">ρ = 0.50 / 0.75 stress-adaptive (§8.4)</div>
                    </th>
                    <th className="text-right px-2 py-2 font-medium">
                      <span className="font-mono text-mtqs-rose/90">W<sup>Execution</sup></span>
                      <div className="text-[0.6rem] text-white/60 font-normal">observed</div>
                    </th>
                    <th className="text-right px-2 py-2 font-medium">
                      <span className="font-mono text-white/90">Δ Smooth→Exec</span>
                      <div className="text-[0.6rem] text-white/60 font-normal">deviation</div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPONENTS.map((c) => {
                    const prior = ws.prior[c] ?? 0;
                    const target = ws.target[c] ?? 0;
                    const smoothed = ws.smoothed[c] ?? 0;
                    const execution = ws.execution[c] ?? 0;
                    const dev = execution - smoothed;
                    return (
                      <tr key={c} className="border-b border-white/[0.06] hover:bg-white/[0.01]">
                        <td className="px-2 py-2 font-mono font-medium text-mtqs-gold">{c}</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums text-white/55">{(prior * 100).toFixed(2)}%</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums text-mtqs-gold">{(target * 100).toFixed(2)}%</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums text-mtqs-emerald">{(smoothed * 100).toFixed(2)}%</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums text-rose-200">{(execution * 100).toFixed(2)}%</td>
                        <td className={`px-2 py-2 text-right font-mono tabular-nums ${Math.abs(dev) >= 0.005 ? (dev > 0 ? "text-mtqs-rose" : "text-mtqs-emerald") : "text-white/55"}`}>
                          {dev > 0 ? "+" : ""}{(dev * 100).toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[0.75rem] text-white/55">
              Weight states not computed yet.
            </div>
          )}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {WEIGHT_STATE_DESCRIPTIONS.map((row) => (
              <div key={row.state} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="font-mono font-semibold text-[0.72rem] text-mtqs-gold">{row.state}</span>
                  <span className="font-mono text-[0.66rem] text-mtqs-emerald/80">{row.symbol}</span>
                </div>
                <div className="text-[0.66rem] text-white/55 leading-snug">{row.meaning}</div>
              </div>
            ))}
          </div>
        </Panel>
      </Reveal>

      {/* ===== Section C: Admissibility envelopes ===== */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
                §8.1 · Per-Component Admissibility Envelopes
              </div>
              <div className="text-sm font-semibold text-white/90 mt-1">Live envelope status · execution weight vs constitutional bounds</div>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone="emerald">
                <GlowDot color="emerald" size="h-1.5 w-1.5" />
                {envCounts.ok} in band
              </Pill>
              <Pill tone="amber">
                <GlowDot color="amber" size="h-1.5 w-1.5" />
                {envCounts.warn} near edge
              </Pill>
              <Pill tone="rose">
                <GlowDot color="rose" size="h-1.5 w-1.5" />
                {envCounts.breach} breach
              </Pill>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {envelopes.map((e) => {
              const prior = STRATEGIC_PRIOR[e.component as Component] ?? 0;
              const range = e.upper - e.lower;
              const priorPct = ((prior - e.lower) / range) * 100;
              const curPct = ((e.current - e.lower) / range) * 100;
              const barColor =
                e.status === "breach" ? "bg-rose-400"
                : e.status === "warn" ? "bg-amber-400"
                : "bg-emerald-400";
              return (
                <motion.div
                  key={e.component}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`rounded-md border p-3 ${
                    e.status === "breach"
                      ? "border-rose-400/40 bg-rose-500/[0.05]"
                      : e.status === "warn"
                      ? "border-mtqs-amber/30 bg-mtqs-amber/5"
                      : "border-mtqs-emerald/20 bg-emerald-500/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono font-semibold text-[0.78rem] text-mtqs-gold">{e.component}</span>
                    <EnvelopeStatusBadge status={e.status} />
                  </div>
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <TickNumber value={e.current} format={(n) => `${(n * 100).toFixed(2)}%`} className="text-base font-semibold text-white" />
                    <span className="text-[0.62rem] font-mono text-white/55">
                      [{(e.lower * 100).toFixed(0)}%–{(e.upper * 100).toFixed(0)}%]
                    </span>
                  </div>
                  {/* Envelope bar — lower bound (left), upper bound (right), prior (gold tick), current (colored) */}
                  <div className="relative h-2 rounded-full bg-white/[0.05] overflow-hidden">
                    {/* Prior marker */}
                    <div
                      className="absolute top-0 bottom-0 w-px bg-amber-300/70"
                      style={{ left: `${Math.max(0, Math.min(100, priorPct))}%` }}
                      aria-label={`prior at ${(prior * 100).toFixed(1)}%`}
                    />
                    {/* Current marker — bar from lower bound to current position */}
                    <motion.div
                      className={`absolute top-0 bottom-0 ${barColor} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, Math.min(100, curPct))}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[0.6rem] font-mono text-white/60">
                    <span>{(e.lower * 100).toFixed(0)}% floor</span>
                    <span>prior {(prior * 100).toFixed(0)}%</span>
                    <span>{(e.upper * 100).toFixed(0)}% cap</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-3 text-[0.68rem] text-white/55 leading-relaxed">
            Each bar shows the execution weight's position within the per-component admissibility envelope. The gold tick marks
            the strategic prior. <span className="text-mtqs-gold font-medium">Near-edge</span> = within 10% of the band width;
            <span className="text-mtqs-rose/90 font-medium"> breach</span> = outside the envelope (would require governance override
            to persist — MASE constrains the target so this should never happen for the smoothed weight).
          </p>
        </Panel>
      </Reveal>

      {/* ===== Section C2 (v2.0): §6 Risk Estimation ===== */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
                §6 · Risk Estimation and Candidate Provenance (v2.0)
              </div>
              <div className="text-sm font-semibold text-white/90 mt-1">
                Correlation matrix Σ<sub>robust</sub> · shrinkage · VaR/CVaR · drawdown
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="emerald">§6.3 min-var · §6.4 ERC · §6.5 max-div · §6.6 CVaR — exact solvers</Pill>
              <Pill tone="muted">regime family: §5.4 mixture</Pill>
            </div>
          </div>
          {risk ? (
            <div className="space-y-5">
              {/* §6.1 + §6.2 correlation + shrinkage */}
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-[0.72rem] font-semibold text-mtqs-gold">
                    §6.1/§6.2 · Σ<sub>robust</sub> = λ·F + (1−λ)·Σ̂ — correlation matrix as consumed by every solver
                  </span>
                  <Pill tone="muted">λ<sub>shrink</sub> = {risk.correlation.shrinkageLambda.toFixed(2)}</Pill>
                  <Pill tone="muted">F: {risk.correlation.target}</Pill>
                  <Pill tone="gold">ρ̄ = {risk.correlation.avgOffDiagonal.toFixed(3)}</Pill>
                </div>
                <div className="overflow-x-auto">
                  <table className="text-[0.62rem] font-mono tabular-nums">
                    <tbody>
                      <tr>
                        <td className="px-1.5 py-1" />
                        {COMPONENTS.map((c) => (
                          <td key={c} className="px-1.5 py-1 text-center text-white/55">{c}</td>
                        ))}
                      </tr>
                      {COMPONENTS.map((rowC, i) => (
                        <tr key={rowC}>
                          <td className="px-1.5 py-1 text-white/55">{rowC}</td>
                          {COMPONENTS.map((colC, j) => {
                            const rho = risk.correlation.matrix[i]?.[j] ?? 0;
                            const intensity = 0.03 + Math.abs(rho) * 0.32;
                            const bg =
                              i === j
                                ? "rgba(239,194,104,0.10)"
                                : rho >= 0
                                  ? `rgba(255,184,77,${intensity.toFixed(3)})`
                                  : `rgba(0,196,219,${intensity.toFixed(3)})`;
                            return (
                              <td
                                key={colC}
                                className="px-1.5 py-1 text-center rounded-sm"
                                style={{ backgroundColor: bg }}
                                title={`ρ(${rowC},${colC}) = ${rho.toFixed(4)}`}
                              >
                                <span className={i === j ? "text-mtqs-gold" : rho >= 0 ? "text-amber-100" : "text-emerald-200"}>
                                  {rho.toFixed(2)}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[0.6rem] leading-snug text-white/45">
                  {risk.correlation.horizonBlend}. Positive ρ → amber, negative ρ → emerald, diagonal = 1. Every
                  candidate solver and the §7.4 Risk term read Σ<sub>robust</sub> <span className="text-white/70">directly</span> — this
                  matrix is its correlation view. §5.1 σ<sup>MH</sup> governs the standalone vols (max-div numerator,
                  MARP); its square differs from diag(Σ̂) by the horizon-blend Jensen gap, disclosed — which is
                  why the objective consumes Σ<sub>robust</sub> and never a (σ<sup>MH</sup>, ρ) reconstruction.
                </p>
              </div>

              {/* §6.6 tail risk + §6.7 drawdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[0.72rem] font-semibold text-mtqs-gold">
                      §6.6 · VaR<sub>α</sub> / CVaR<sub>α</sub> on the constrained target
                    </span>
                    {tail && tail.monitor99 && <Pill tone="amber">99% level monitored</Pill>}
                  </div>
                  {tail ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Stat label="VaR 95%" value={`${(tail.var95 * 100).toFixed(2)}%`} sub="daily loss quantile" />
                      <Stat label="CVaR 95%" value={`${(tail.cvar95 * 100).toFixed(2)}%`} sub="minimized (§6.6)" />
                      <Stat label="VaR 99%" value={`${(tail.var99 * 100).toFixed(2)}%`} sub="severe scenario" />
                      <Stat label="CVaR 99%" value={`${(tail.cvar99 * 100).toFixed(2)}%`} sub="monitored" />
                    </div>
                  ) : (
                    <div className="text-[0.7rem] text-white/55">Tail figures pending the first scoring window.</div>
                  )}
                  <p className="mt-2 text-[0.6rem] leading-snug text-white/45">
                    {tail ? tail.convention : ""} — the engine minimizes CVaR<sub>95</sub> and monitors CVaR<sub>99</sub> per §6.6.
                  </p>
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[0.72rem] font-semibold text-mtqs-gold">
                      §6.7 · Drawdown control — M<sub>t</sub>, DD<sub>t</sub> = V<sub>t</sub>/M<sub>t</sub> − 1, MDD
                    </span>
                    {tail && <Pill tone={tail.mdd <= -0.1 ? "rose" : "amber"}>MDD = {(tail.mdd * 100).toFixed(2)}%</Pill>}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="MDD (simulated window)" value={tail ? `${(tail.mdd * 100).toFixed(2)}%` : "—"} sub="minₜ DDₜ over the window" />
                    <Stat label="Window" value={tail ? `${tail.windowDays}d` : "—"} sub="simulated-historical profile" />
                  </div>
                  <p className="mt-2 text-[0.6rem] leading-snug text-white/45">
                    Constitutional MDD envelope VALUE: not published in the blueprint (the §23.7 model-selection
                    criterion weights MDD) and Monte-Carlo drawdown profiles are not run in the pilot — envelope
                    enforcement is surfacing-only, disclosed.
                  </p>
                </div>
              </div>

              {/* §6.8 GPP */}
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[0.72rem] font-semibold text-mtqs-gold">
                    §6.8 · Global Purchasing Power objective — formula + proxy status
                  </span>
                  <Pill tone="amber">proxy in pilot</Pill>
                </div>
                <div className="font-mono text-[0.66rem] text-white/85">{risk.gpp.formula}</div>
                <div className="font-mono text-[0.62rem] text-white/55 mt-1">{risk.gpp.objective}</div>
                <p className="mt-1.5 text-[0.6rem] leading-snug text-white/45">{risk.gpp.status}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[0.75rem] text-white/55">
              §6 risk estimators not computed yet.
            </div>
          )}
        </Panel>
      </Reveal>

      {/* ===== Section D: MARP decisions ===== */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
                §10 · MARP · Monetary Adaptive Rebalancing Protocol
              </div>
              <div className="text-sm font-semibold text-white/90 mt-1">Per-component rebalance decision · daily calculation vs actual trade</div>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone={marp && marp.totalTradeUsd > 0 ? "gold" : "emerald"}>
                <GlowDot color={marp && marp.totalTradeUsd > 0 ? "gold" : "emerald"} size="h-1.5 w-1.5" />
                {marp && marp.totalTradeUsd > 0 ? "trades pending" : "all in no-trade zone"}
              </Pill>
              {marp && (
                <Pill tone="muted">
                  total: {fmtUsdCompact(marp.totalTradeUsd)}
                </Pill>
              )}
            </div>
          </div>
          {marp ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[0.72rem]">
                <thead>
                  <tr className="text-white/55 border-b border-white/[0.06]">
                    <th className="text-left px-2 py-2 font-medium">Component</th>
                    <th className="text-left px-2 py-2 font-medium">Direction</th>
                    <th className="text-right px-2 py-2 font-medium">Trade USD</th>
                    {/* AUDIT-FIX §10.7 — measured natural-flow ledger CF_{i,t} */}
                    <th className="text-right px-2 py-2 font-medium">
                      CF netted
                      <div className="text-[0.58rem] font-normal text-white/60">§10.7 · USD</div>
                    </th>
                    <th className="text-left px-2 py-2 font-medium w-32">Urgency</th>
                    <th className="text-left px-2 py-2 font-medium">Level</th>
                    <th className="text-left px-2 py-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {marp.decisions.map((d) => (
                    <tr key={d.component} className={`border-b border-white/[0.06] ${d.shouldTrade ? "bg-amber-500/[0.03]" : ""}`}>
                      <td className="px-2 py-2 font-mono font-semibold text-mtqs-gold">{d.component}</td>
                      <td className="px-2 py-2"><MarpDirectionBadge direction={d.direction} shouldTrade={d.shouldTrade} /></td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {d.shouldTrade ? (
                          <span className="text-mtqs-gold font-medium">{fmtUsdCompact(d.tradeUsd)}</span>
                        ) : (
                          <span className="text-white/60">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-mono tabular-nums">
                        {Math.abs(d.naturalFlowUsd) >= 0.5 ? (
                          <span className={d.naturalFlowUsd > 0 ? "text-mtqs-emerald" : "text-mtqs-rose"}>
                            {d.naturalFlowUsd > 0 ? "+" : "−"}
                            {fmtUsdCompact(Math.abs(d.naturalFlowUsd))}
                          </span>
                        ) : (
                          <span className="text-white/60">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <MiniBar
                            value={d.urgency}
                            max={1}
                            colorClass={d.urgency >= 0.5 ? "bg-rose-400" : d.urgency >= 0.2 ? "bg-amber-400" : "bg-emerald-400"}
                            height="h-1.5"
                            className="w-20"
                          />
                          <span className="text-[0.66rem] font-mono text-white/55">{(d.urgency * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-2 py-2"><MarpLevelBadge level={d.level} shouldTrade={d.shouldTrade} /></td>
                      <td className="px-2 py-2 text-white/55 text-[0.7rem]">{d.reason}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-mtqs-amber/30 bg-mtqs-amber/5">
                    <td className="px-2 py-2 font-mono font-semibold text-mtqs-gold" colSpan={2}>Σ Total Trade USD</td>
                    <td className="px-2 py-2 text-right font-mono font-semibold text-mtqs-gold">{fmtUsdCompact(marp.totalTradeUsd)}</td>
                    <td className="px-2 py-2" colSpan={4}>
                      <span className="text-[0.66rem] text-white/55">
                        Max daily turnover = 5% of NAV ≈ {fmtUsdCompact(snapshot.nav * 0.05)}. Trades capped at this level (L5).
                        NetBenefit gate: trade fires iff NetBenefit &gt; ε = $10 (§12.8, unified RG-10).
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[0.75rem] text-white/55">
              MARP decisions not computed yet.
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {[/* 8-level gate pipeline legend — matches marp.ts + RebalanceEngine */
              { level: 1, label: "L1 · Natural flows", desc: "CF nets the gap (§10.7)" },
              { level: 2, label: "L2 · No-trade zone", desc: "deviation ≤ 0.75% (§10.4/§11.8)" },
              { level: 3, label: "L3 · Low urgency", desc: "U < U_min 5% (§10.2)" },
              { level: 4, label: "L4 · Zero size", desc: "β·residual = 0 (§10.6)" },
              { level: 5, label: "L5 · Cost-benefit fail", desc: "legacy ε gate (OD-2 OPEN)" },
              { level: 6, label: "L6 · Thin liquidity", desc: "≤ 10% of 24h depth (§11.4)" },
              { level: 7, label: "L7 · Turnover cap", desc: "≤ 5% NAV/day (§7.3)" },
              { level: 8, label: "L8 · Execute", desc: "direction lock passed (§11.5.3)" },
            ].map((l) => (
              <div key={l.level} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-white/55">{l.label}</div>
                <div className="text-[0.66rem] text-white/55 mt-0.5">{l.desc}</div>
              </div>
            ))}
          </div>
        </Panel>
      </Reveal>

      {/* ===== Footer: constants + lineage note ===== */}
      <Reveal>
        <Panel className="p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.66rem] text-white/55">
            <span className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/80">lineage</span>
            <span className="font-mono text-mtqs-gold">prices: P<sub>i,t</sub>/P<sub>i,0</sub></span>
            <span>→</span>
            <span className="font-mono text-mtqs-gold">§5.1 σ^MH blend</span>
            <span>→</span>
            <span className="font-mono text-mtqs-gold">MASE 7 models (§6 exact solvers + §5.4 regime mixture)</span>
            <span>→</span>
            <span className="font-mono text-mtqs-gold">§7.6 softmax ensemble</span>
            <span>→</span>
            <span className="font-mono text-mtqs-gold">§8.1 envelopes</span>
            <span>→</span>
            <span className="font-mono text-mtqs-emerald/90">EMA smooth (λ={(SMOOTHING_LAMBDA * 100).toFixed(0)}%)</span>
            <span>→</span>
            <span className="font-mono text-rose-200/90">MARP per-component decision</span>
            <span>→</span>
            <span className="font-mono text-white">execution (published)</span>
          </div>
          <p className="mt-2 text-[0.66rem] text-white/60 leading-relaxed">
            The legacy §6 single-engine (VIX/DXY → θ ±3%) and §7 single-direction rebalance (displayed in
            the sections above and below this one) are RETAINED in parallel as pilot comparisons.
            <span className="text-white/75"> MARP (§10/§11) is now the ACTIVE execution path</span> —
            USE_MARP_EXECUTION=true (audit P1-4), rebalancePath = <span className="font-mono text-mtqs-gold">marp</span>;
            the legacy §7 view is advisory only. Honest v2.0 disclosures: §5.1 multi-horizon σ^MH, §5.4 six-regime
            probabilities, §5.5 CrisisScore→λ<sub>CVaR,t</sub>, §6.1/§6.2 correlation + shrinkage, the §6.3/§6.4/§6.5/§6.6 exact
            candidate solvers, §6.6 VaR/CVaR (95 minimized · 99 monitored) and §6.7 MDD are all COMPUTED — from a
            deterministic simulated 756-day series (disclosed data window; production consumes the validated
            multi-source prices). Remaining substitutes, honestly labeled: §6.8 GPP/PPError proxy (RG-07 — no
            CPI-basket feed, formula surfaced above), classifier / ω / λ / k pilot initializations (validation-stage),
            the 4-state classifier retained for state decisions, Monte-Carlo drawdown profiles not run, uniform λ
            base (OD-1/OD-31 calibration pending).
          </p>
        </Panel>
      </Reveal>
    </div>
  );
}
