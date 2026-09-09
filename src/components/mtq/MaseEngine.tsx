// MTQΣ — MASE Ensemble + 4-State Weights + MARP (§6 / §7 / §8 / §10 — v1.0)
// Surfaces the live Multi-Asset Stochastic Ensemble output: the 6 candidate
// model weight vectors, the equal-weight ensemble target, the per-component
// admissibility envelope status, the four-state weight distinction
// (W^Prior ≠ W^Target ≠ W^Smooth ≠ W^Execution), and the MARP per-component
// rebalancing decisions (urgency, no-trade zone, cost-benefit gate, partial
// correction, daily-turnover cap, execute).
//
// The legacy §6 macro engine (VIX/DXY → θ ±3%) is retained above this section
// as one input to MASE. The legacy §7 rebalance engine (single-direction gold
// trade) is retained below as the live execution path; MARP shown here is the
// v1.0 production target. Both run in parallel so the pilot can be compared.

"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { Panel, Reveal, TickNumber, Pill, GlowDot, MiniBar } from "./primitives";
import { fmtUsdCompact, fmtPct } from "./format";
import {
  STRATEGIC_PRIOR,
  ADMISSIBILITY_ENVELOPES,
  WEIGHT_STATE_DESCRIPTIONS,
  SMOOTHING_LAMBDA,
  MASE_MODELS,
} from "@/lib/mtq/blueprint";
import { COMPONENTS, type Component } from "@/lib/mtq/mase";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

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
      style={{ backgroundColor: isTarget ? `rgba(232,185,100,${opacity + 0.06})` : `rgba(232,185,100,${opacity})` }}
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

/* ---------- Level badge (MARP 6-level hierarchy) ---------- */
function MarpLevelBadge({ level, shouldTrade }: { level: number; shouldTrade: boolean }) {
  const tone = shouldTrade ? "gold" : level <= 1 ? "muted" : "amber";
  const labels: Record<number, string> = {
    1: "L1 · no-trade zone",
    2: "L2 · low urgency",
    3: "L3 · sized",
    4: "L4 · cost-benefit fail",
    5: "L5 · turnover cap",
    6: "L6 · execute",
  };
  return <Pill tone={tone as "gold" | "muted" | "amber"}>{labels[level] ?? `L${level}`}</Pill>;
}

/* ---------- Main component ---------- */
export function MaseEngine({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-lg bg-white/[0.03]/[0.03]" />
        ))}
      </div>
    );
  }

  const mase = snapshot.mase;
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
              <p className="mt-1 text-[0.72rem] text-white/40 leading-relaxed max-w-2xl">
                The Multi-Asset Stochastic Ensemble (§6 / §7) runs 6 candidate models, blends them with equal
                weights into a single target, clamps to per-component admissibility envelopes (§8.1), and
                EMA-smooths (λ = {(SMOOTHING_LAMBDA * 100).toFixed(0)}%) toward the constrained target (§8.4).
                MARP (§10) then decides per-component whether the deviation between the smoothed target and
                the observed execution weight justifies a trade (urgency → no-trade zone → cost-benefit gate
                → partial correction → turnover cap → execute). The published weight W<sub>t</sub> is always
                the <span className="text-mtqs-gold">execution weight</span> (I6).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <RegimeBadge regime={regime} />
              <Pill tone={marp && marp.totalTradeUsd > 0 ? "gold" : "muted"}>
                <GlowDot color={marp && marp.totalTradeUsd > 0 ? "gold" : "emerald"} size="h-1.5 w-1.5" />
                MARP total: {marp ? fmtUsdCompact(marp.totalTradeUsd) : "—"}
              </Pill>
            </div>
          </div>
        </Panel>
      </Reveal>

      {/* ===== Section A: MASE candidate models heatmap ===== */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/40">
                §6 / §7 · MASE Candidate Models · 6-model equal-weight ensemble
              </div>
              <div className="text-sm font-semibold text-white/90 mt-1">Per-model weight vectors (W<sup>Target</sup> candidates)</div>
            </div>
            <Pill tone="gold">equal weight = 1/6</Pill>
          </div>
          {mase ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[0.72rem]">
                <thead>
                  <tr className="text-white/40 border-b border-white/[0.06]">
                    <th className="text-left px-2 py-2 font-medium">Model</th>
                    {COMPONENTS.map((c) => (
                      <th key={c} className="text-right px-2 py-2 font-medium font-mono">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mase.models.map((m) => (
                    <tr key={m.id} className="border-b border-white/[0.06] hover:bg-white/[0.03]/[0.01]">
                      <td className="px-2 py-1.5">
                        <div className="flex flex-col">
                          <span className="font-medium text-white/90">{m.name}</span>
                          <span className="text-[0.62rem] text-white/40/60 font-mono">{m.id}</span>
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
            <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-4 text-center text-[0.75rem] text-white/40">
              MASE ensemble not computed yet.
            </div>
          )}
          <p className="mt-3 text-[0.68rem] text-white/40 leading-relaxed">
            Each cell shows that model's recommended weight for the component. The <span className="text-mtqs-gold font-medium">Ensemble Target</span> row
            is the equal-weight average of all 6 models — this becomes W<sup>Target</sup> before envelope constraints are applied.
            Production will use adaptive ensemble weights (model-performance-driven); the pilot uses 1/6 each.
          </p>
        </Panel>
      </Reveal>

      {/* ===== Section B: 4-state weight table ===== */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/40">
                §2.3 · Four-State Weight Distinction
              </div>
              <div className="text-sm font-semibold text-white/90 mt-1">W<sup>Prior</sup> ≠ W<sup>Target</sup> ≠ W<sup>Smooth</sup> ≠ W<sup>Execution</sup></div>
            </div>
            <Pill tone="gold">published = execution (I6)</Pill>
          </div>
          {ws ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[0.74rem]">
                <thead>
                  <tr className="text-white/40 border-b border-white/[0.06]">
                    <th className="text-left px-2 py-2 font-medium">Component</th>
                    <th className="text-right px-2 py-2 font-medium">
                      <span className="font-mono text-mtqs-gold">W<sup>Prior</sup></span>
                      <div className="text-[0.6rem] text-white/40/60 font-normal">soft anchor</div>
                    </th>
                    <th className="text-right px-2 py-2 font-medium">
                      <span className="font-mono text-mtqs-gold">W<sup>Target</sup></span>
                      <div className="text-[0.6rem] text-white/40/60 font-normal">MASE + envelope</div>
                    </th>
                    <th className="text-right px-2 py-2 font-medium">
                      <span className="font-mono text-mtqs-emerald/90">W<sup>Smooth</sup></span>
                      <div className="text-[0.6rem] text-white/40/60 font-normal">EMA λ={(SMOOTHING_LAMBDA * 100).toFixed(0)}%</div>
                    </th>
                    <th className="text-right px-2 py-2 font-medium">
                      <span className="font-mono text-mtqs-rose/90">W<sup>Execution</sup></span>
                      <div className="text-[0.6rem] text-white/40/60 font-normal">observed</div>
                    </th>
                    <th className="text-right px-2 py-2 font-medium">
                      <span className="font-mono text-white/90">Δ Smooth→Exec</span>
                      <div className="text-[0.6rem] text-white/40/60 font-normal">deviation</div>
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
                      <tr key={c} className="border-b border-white/[0.06] hover:bg-white/[0.03]/[0.01]">
                        <td className="px-2 py-2 font-mono font-medium text-mtqs-gold">{c}</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums text-white/40">{(prior * 100).toFixed(2)}%</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums text-mtqs-gold">{(target * 100).toFixed(2)}%</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums text-mtqs-emerald">{(smoothed * 100).toFixed(2)}%</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums text-rose-200">{(execution * 100).toFixed(2)}%</td>
                        <td className={`px-2 py-2 text-right font-mono tabular-nums ${Math.abs(dev) >= 0.005 ? (dev > 0 ? "text-mtqs-rose" : "text-mtqs-emerald") : "text-white/40"}`}>
                          {dev > 0 ? "+" : ""}{(dev * 100).toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-4 text-center text-[0.75rem] text-white/40">
              Weight states not computed yet.
            </div>
          )}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {WEIGHT_STATE_DESCRIPTIONS.map((row) => (
              <div key={row.state} className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2.5">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="font-mono font-semibold text-[0.72rem] text-mtqs-gold">{row.state}</span>
                  <span className="font-mono text-[0.66rem] text-mtqs-emerald/80">{row.symbol}</span>
                </div>
                <div className="text-[0.66rem] text-white/40 leading-snug">{row.meaning}</div>
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
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/40">
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
                    <span className="text-[0.62rem] font-mono text-white/40">
                      [{(e.lower * 100).toFixed(0)}%–{(e.upper * 100).toFixed(0)}%]
                    </span>
                  </div>
                  {/* Envelope bar — lower bound (left), upper bound (right), prior (gold tick), current (colored) */}
                  <div className="relative h-2 rounded-full bg-white/[0.03]/[0.05] overflow-hidden">
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
                  <div className="mt-1 flex justify-between text-[0.6rem] font-mono text-white/40/60">
                    <span>{(e.lower * 100).toFixed(0)}% floor</span>
                    <span>prior {(prior * 100).toFixed(0)}%</span>
                    <span>{(e.upper * 100).toFixed(0)}% cap</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-3 text-[0.68rem] text-white/40 leading-relaxed">
            Each bar shows the execution weight's position within the per-component admissibility envelope. The gold tick marks
            the strategic prior. <span className="text-mtqs-gold font-medium">Near-edge</span> = within 10% of the band width;
            <span className="text-mtqs-rose/90 font-medium"> breach</span> = outside the envelope (would require governance override
            to persist — MASE constrains the target so this should never happen for the smoothed weight).
          </p>
        </Panel>
      </Reveal>

      {/* ===== Section D: MARP decisions ===== */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/40">
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
                  <tr className="text-white/40 border-b border-white/[0.06]">
                    <th className="text-left px-2 py-2 font-medium">Component</th>
                    <th className="text-left px-2 py-2 font-medium">Direction</th>
                    <th className="text-right px-2 py-2 font-medium">Trade USD</th>
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
                          <span className="text-white/40/60">—</span>
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
                          <span className="text-[0.66rem] font-mono text-white/40">{(d.urgency * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="px-2 py-2"><MarpLevelBadge level={d.level} shouldTrade={d.shouldTrade} /></td>
                      <td className="px-2 py-2 text-white/40 text-[0.7rem]">{d.reason}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-mtqs-amber/30 bg-mtqs-amber/5">
                    <td className="px-2 py-2 font-mono font-semibold text-mtqs-gold" colSpan={2}>Σ Total Trade USD</td>
                    <td className="px-2 py-2 text-right font-mono font-semibold text-mtqs-gold">{fmtUsdCompact(marp.totalTradeUsd)}</td>
                    <td className="px-2 py-2" colSpan={3}>
                      <span className="text-[0.66rem] text-white/40">
                        Max daily turnover = 5% of NAV ≈ {fmtUsdCompact(snapshot.nav * 0.05)}. Trades capped at this level (L5).
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-4 text-center text-[0.75rem] text-white/40">
              MARP decisions not computed yet.
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { level: 1, label: "L1 · No-trade zone", desc: "deviation < 0.5%" },
              { level: 2, label: "L2 · Low urgency", desc: "urgency < 5%" },
              { level: 3, label: "L3 · Sized", desc: "50% correction" },
              { level: 4, label: "L4 · Cost-benefit fail", desc: "cost ≥ benefit" },
              { level: 5, label: "L5 · Turnover cap", desc: "capped at 5% NAV" },
              { level: 6, label: "L6 · Execute", desc: "trade fires" },
            ].map((l) => (
              <div key={l.level} className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2">
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-white/40">{l.label}</div>
                <div className="text-[0.66rem] text-white/40 mt-0.5">{l.desc}</div>
              </div>
            ))}
          </div>
        </Panel>
      </Reveal>

      {/* ===== Footer: constants + lineage note ===== */}
      <Reveal>
        <Panel className="p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.66rem] text-white/40">
            <span className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/80">lineage</span>
            <span className="font-mono text-mtqs-gold">prices: P<sub>i,t</sub>/P<sub>i,0</sub></span>
            <span>→</span>
            <span className="font-mono text-mtqs-gold">MASE 6 models</span>
            <span>→</span>
            <span className="font-mono text-mtqs-gold">equal-weight ensemble</span>
            <span>→</span>
            <span className="font-mono text-mtqs-gold">§8.1 envelopes</span>
            <span>→</span>
            <span className="font-mono text-mtqs-emerald/90">EMA smooth (λ={(SMOOTHING_LAMBDA * 100).toFixed(0)}%)</span>
            <span>→</span>
            <span className="font-mono text-rose-200/90">MARP per-component decision</span>
            <span>→</span>
            <span className="font-mono text-white">execution (published)</span>
          </div>
          <p className="mt-2 text-[0.66rem] text-white/40/60 leading-relaxed">
            The legacy §6 single-engine (VIX/DXY → θ ±3%) and §7 single-direction rebalance (displayed in
            the sections above and below this one) are RETAINED in parallel as live pilot paths. MASE + MARP
            shown here is the v1.0 production target. Until MASE is wired into the actual rebalance execution
            (a future task), MARP's "shouldTrade" decisions are advisory — they do not mutate the reserve.
          </p>
        </Panel>
      </Reveal>
    </div>
  );
}
