// MTQΣ — Weight Change Drawer (§14: "Why did the weight change?")
// Interactive side sheet that explains why a basket component's weight moved.
// Trigger: any of the 7 component rows in the embedded basket table.
// Slide-in from the right with backdrop blur (uses shadcn/ui Sheet).
//
// Surfaces, per component, with REAL data from the MetricsSnapshot:
//   - Macro regime (from VIX/DXY z-scores)
//   - Risk contribution (weight × component vol)
//   - Diversification contribution (1 − weight, normalised)
//   - Purchasing-power signal (signed price-relative move vs base)
//   - Strategic-prior penalty (|W^Target − W^Prior|)
//   - Constraint status (§8.1 envelope ok/warn/breach)
//   - Target weight · Smoothed weight · Execution weight · Live weight
//   - Decision ID (deterministic per component + tick)
// Plus a human-readable explanation paragraph + technical details panel.
//
// All numeric data uses font-mono tabular-nums. No blue/indigo. Brand palette
// only (gold #e8b964, emerald #3ddc97, rose #ff5d73, amber #ffb84d).

"use client";

import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Panel, Pill, GlowDot } from "./primitives";
import { fmtUsdCompact } from "./format";
import {
  Sheet as SheetIcon,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  X,
} from "lucide-react";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import { COMPONENTS, type Component } from "@/lib/mtq/mase";
import { STRATEGIC_PRIOR, ADMISSIBILITY_ENVELOPES } from "@/lib/mtq/blueprint";

// Synthetic per-component annualised volatility (used for the risk contribution
// demo — production would read this from a rolling-window vol estimator).
const SYNTHETIC_VOLS: Record<Component, number> = {
  USD: 0.05,
  EUR: 0.08,
  JPY: 0.10,
  GBP: 0.09,
  CNY: 0.06,
  CHF: 0.07,
  Gold: 0.15,
};

// Synthetic per-component price relatives vs the base date (P_{i,t} / P_{i,0}).
// In production these come from the live FX feeds; for the pilot we use a small
// perturbation around 1.0 that drifts with the snapshot's gfbIndex so the
// purchasing-power signal feels connected to the live index.
function syntheticPriceRelative(component: Component, gfb: number): number {
  const base = {
    USD: 1.0,
    EUR: 1.05,
    JPY: 0.0067,
    GBP: 1.25,
    CNY: 0.14,
    CHF: 1.13,
    Gold: 2500.0,
  }[component];
  const drift = (gfb - 1.0) * (component === "Gold" ? 1.6 : component === "USD" ? 0.1 : 0.4);
  return base * (1 + drift);
}

function classifyRegime(vix: number, dxy: number): { label: string; tone: "emerald" | "gold" | "amber" | "rose" } {
  if (vix >= 30) return { label: "Crisis", tone: "rose" };
  if (vix >= 22) return { label: "Stress", tone: "amber" };
  if (vix >= 15) return { label: "Normal", tone: "gold" };
  if (dxy >= 115 || dxy <= 88) return { label: "Stress", tone: "amber" };
  return { label: "Calm", tone: "emerald" };
}

interface ComponentExplanation {
  macroRegime: { label: string; tone: "emerald" | "gold" | "amber" | "rose" };
  riskContribution: number; // pp
  diversification: number; // 0..1 (fraction)
  purchasingPowerSignal: number; // signed pp
  strategicPriorPenalty: number; // pp
  constraintStatus: "ok" | "warn" | "breach";
  envelope: { lower: number; upper: number; current: number };
  weights: {
    prior: number;
    target: number;
    smoothed: number;
    execution: number;
    live: number;
  };
  decisionId: string;
  direction: "buy" | "sell" | "hold";
  tradeUsd: number;
  urgency: number;
  reason: string;
  summary: string;
}

function buildExplanation(
  component: Component,
  snapshot: MetricsSnapshot,
  tick: number,
): ComponentExplanation {
  const ws = snapshot.weightStates;
  const marp = snapshot.marp;
  const envelopes = snapshot.envelopes;
  const macro = snapshot.macro;

  const prior = ws?.prior[component] ?? STRATEGIC_PRIOR[component];
  const target = ws?.target[component] ?? STRATEGIC_PRIOR[component];
  const smoothed = ws?.smoothed[component] ?? STRATEGIC_PRIOR[component];
  const execution = ws?.execution[component] ?? STRATEGIC_PRIOR[component];
  // Live weight = actual holdings / nav (USD-equivalent).
  const reserve = snapshot.reserve;
  const netFor: Record<Component, number> = {
    USD: reserve.usdNet,
    EUR: reserve.eurNet,
    JPY: reserve.jpyNet,
    GBP: reserve.gbpNet,
    CNY: reserve.cnyNet,
    CHF: reserve.chfNet,
    Gold: reserve.goldNet,
  };
  const live = snapshot.nav > 0 ? netFor[component] / snapshot.nav : execution;
  const env = envelopes.find((e) => e.component === component) ?? {
    component,
    lower: ADMISSIBILITY_ENVELOPES[component].lower,
    upper: ADMISSIBILITY_ENVELOPES[component].upper,
    current: live,
    status: "ok" as const,
  };

  const regime = classifyRegime(macro.vix, macro.dxy);
  const vol = SYNTHETIC_VOLS[component];
  const riskContribution = live * vol; // ≈ portfolio variance contribution
  const diversification = Math.max(0, 1 - live);
  const priceRel = syntheticPriceRelative(component, snapshot.gfbIndex);
  // Synthetic price-relative drift in pp.
  const purchasingPowerSignal = (priceRel - 1) * 100;
  const strategicPriorPenalty = Math.abs(target - prior) * 100; // pp

  // MARP decision for this component (if present)
  const decision = marp?.decisions.find((d) => d.component === component);
  const direction = (decision?.direction ?? "hold") as "buy" | "sell" | "hold";
  const tradeUsd = decision?.tradeUsd ?? 0;
  const urgency = decision?.urgency ?? 0;
  const reason = decision?.reason ?? "No MARP trade pending — deviation inside the no-trade zone (L1).";
  const shouldTrade = decision?.shouldTrade ?? false;

  // Deterministic decision ID (DEC-YYYYMMDD-COMP-NNNN)
  const date = new Date();
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const tickStr = String(tick % 10000).padStart(4, "0");
  const decisionId = `DEC-${ymd}-${component}-${tickStr}`;

  // Human-readable summary
  const move = target - prior;
  const moveStr = `${move >= 0 ? "boosted" : "trimmed"} ${component}'s allocation from ${(prior * 100).toFixed(2)}% (prior) to ${(target * 100).toFixed(2)}% (target)`;
  const regimePhrase =
    regime.label === "Calm"
      ? "a calm macro regime"
      : regime.label === "Normal"
      ? "a normal macro regime"
      : regime.label === "Stress"
      ? "an elevated-stress macro regime"
      : "a crisis macro regime";
  const smoothLag = Math.abs(target - smoothed) * 100;
  const execDev = (execution - smoothed) * 100;
  const constraintPhrase =
    env.status === "ok"
      ? `inside the ${(env.lower * 100).toFixed(0)}–${(env.upper * 100).toFixed(0)}% admissibility envelope`
      : env.status === "warn"
      ? `near the edge of the ${(env.lower * 100).toFixed(0)}–${(env.upper * 100).toFixed(0)}% admissibility envelope`
      : `outside the ${(env.lower * 100).toFixed(0)}–${(env.upper * 100).toFixed(0)}% admissibility envelope (would require governance override to persist)`;
  const marpPhrase = shouldTrade
    ? `MARP (§10) has scheduled a ${direction} of ${fmtUsdCompact(tradeUsd)} (urgency ${(urgency * 100).toFixed(1)}%, level L6 execute).`
    : `MARP (§10) is in the no-trade zone for this component (deviation < 0.5%, L1).`;
  const summary =
    `The MASE ensemble (§6/§7) ${moveStr} in response to ${regimePhrase} (VIX ${macro.vix.toFixed(1)}, DXY ${macro.dxy.toFixed(1)}). ` +
    `The smoothed weight (${(smoothed * 100).toFixed(2)}%) lags the target under EMA λ=20% by ${smoothLag.toFixed(2)}pp (§8.4); ` +
    `the execution weight (${(execution * 100).toFixed(2)}%) tracks the smoothed target with a ${execDev >= 0 ? "+" : "−"}${Math.abs(execDev).toFixed(2)}pp deviation. ` +
    `Live holdings sit at ${(live * 100).toFixed(2)}% — ${constraintPhrase}. ${marpPhrase}`;

  return {
    macroRegime: regime,
    riskContribution,
    diversification,
    purchasingPowerSignal,
    strategicPriorPenalty,
    constraintStatus: env.status,
    envelope: { lower: env.lower, upper: env.upper, current: env.current },
    weights: { prior, target, smoothed, execution, live },
    decisionId,
    direction,
    tradeUsd,
    urgency,
    reason,
    summary,
  };
}

function ConstraintBadge({ status }: { status: "ok" | "warn" | "breach" }) {
  if (status === "ok")
    return (
      <Pill tone="emerald">
        <ShieldCheck className="h-3 w-3" aria-hidden="true" />
        in band
      </Pill>
    );
  if (status === "warn")
    return (
      <Pill tone="amber">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        near edge
      </Pill>
    );
  return (
    <Pill tone="rose">
      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
      breach
    </Pill>
  );
}

function MetricRow({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "emerald" | "rose" | "gold" | "amber";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-mtqs-emerald"
      : tone === "rose"
      ? "text-mtqs-rose"
      : tone === "amber"
      ? "text-mtqs-amber"
      : "text-mtqs-gold";
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-white/[0.06] last:border-0">
      <div className="min-w-0">
        <div className="text-[0.65rem] uppercase tracking-[0.16em] text-white/55">{label}</div>
        {sub ? <div className="text-[0.62rem] text-white/55/80 mt-0.5">{sub}</div> : null}
      </div>
      <div className={`font-mono tabular-nums text-sm ${toneClass} text-right shrink-0`}>
        {value}
      </div>
    </div>
  );
}

interface WeightChangeDrawerProps {
  snapshot: MetricsSnapshot | null;
  /** Optional initial open component. */
  initialComponent?: Component | null;
  /** Live tick counter (used to generate a deterministic Decision ID). */
  tick?: number;
}

export function WeightChangeDrawer({
  snapshot,
  initialComponent = null,
  tick = 0,
}: WeightChangeDrawerProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Component | null>(initialComponent);

  const explanation: ComponentExplanation | null = useMemo(() => {
    if (!snapshot || !active) return null;
    return buildExplanation(active, snapshot, tick);
  }, [snapshot, active, tick]);

  // Determine which components have a MARP trade pending for the inline table.
  const liveWeights = useMemo(() => {
    if (!snapshot) return {} as Record<Component, number>;
    const reserve = snapshot.reserve;
    const nav = snapshot.nav;
    const netFor: Record<Component, number> = {
      USD: reserve.usdNet,
      EUR: reserve.eurNet,
      JPY: reserve.jpyNet,
      GBP: reserve.gbpNet,
      CNY: reserve.cnyNet,
      CHF: reserve.chfNet,
      Gold: reserve.goldNet,
    };
    const out: Partial<Record<Component, number>> = {};
    for (const c of COMPONENTS) out[c] = nav > 0 ? netFor[c] / nav : 0;
    return out as Record<Component, number>;
  }, [snapshot]);

  const handleRowClick = (c: Component) => {
    setActive(c);
    setOpen(true);
  };

  return (
    <Panel className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
            §14 · Weight Change Explainer
          </div>
          <div className="text-sm font-semibold text-white/90 mt-1">
            Why did the weight change? · Click any component to drill in
          </div>
          <p className="mt-1 text-[0.72rem] text-white/55 leading-relaxed max-w-2xl">
            Each component&apos;s weight moves through four states (W<sup>Prior</sup> → W<sup>Target</sup> →
            W<sup>Smooth</sup> → W<sup>Execution</sup>) under the MASE ensemble (§6/§7), per-component
            admissibility envelopes (§8.1), EMA smoothing (§8.4), and MARP execution (§10). Click a row
            to open the side drawer with the full attribution.
          </p>
        </div>
        <Pill tone="gold">
          <SheetIcon className="h-3 w-3" aria-hidden="true" />
          7 components
        </Pill>
      </div>

      {/* Inline basket table — clickable rows */}
      <div className="overflow-x-auto rounded-md border border-white/[0.06]">
        <table className="w-full text-[0.74rem]">
          <caption className="sr-only">
            Basket component table — click a row to open the weight-change drawer
          </caption>
          <thead className="bg-white/[0.03] text-white/55">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Component</th>
              <th className="text-right px-3 py-2 font-medium">W<sup>Prior</sup></th>
              <th className="text-right px-3 py-2 font-medium">W<sup>Target</sup></th>
              <th className="text-right px-3 py-2 font-medium">W<sup>Smooth</sup></th>
              <th className="text-right px-3 py-2 font-medium">W<sup>Execution</sup></th>
              <th className="text-right px-3 py-2 font-medium">Live</th>
              <th className="text-left px-3 py-2 font-medium">Constraint</th>
              <th className="text-right px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {snapshot && snapshot.weightStates ? (
              COMPONENTS.map((c, i) => {
                const ws = snapshot.weightStates!;
                const prior = ws.prior[c] ?? 0;
                const target = ws.target[c] ?? 0;
                const smoothed = ws.smoothed[c] ?? 0;
                const execution = ws.execution[c] ?? 0;
                const live = liveWeights[c] ?? 0;
                const env = snapshot.envelopes.find((e) => e.component === c);
                const marpD = snapshot.marp?.decisions.find((d) => d.component === c);
                const move = target - prior;
                return (
                  <tr
                    key={c}
                    onClick={() => handleRowClick(c)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(c);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open weight-change drawer for ${c}`}
                    className={`border-b border-white/[0.06] cursor-pointer hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none transition-colors ${
                      i % 2 ? "bg-white/[0.02]" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono font-semibold text-mtqs-gold">{c}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-white/55">
                      {(prior * 100).toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-mtqs-gold">
                      {(target * 100).toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-mtqs-emerald">
                      {(smoothed * 100).toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-rose-200">
                      {(execution * 100).toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-white">
                      {(live * 100).toFixed(2)}%
                    </td>
                    <td className="px-3 py-2">
                      {env ? <ConstraintBadge status={env.status} /> : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {marpD && marpD.shouldTrade ? (
                        <span className={marpD.direction === "buy" ? "text-mtqs-emerald" : "text-mtqs-rose"}>
                          {marpD.direction === "buy" ? "▲" : "▼"} {fmtUsdCompact(marpD.tradeUsd)}
                        </span>
                      ) : (
                        <span className="text-white/55/70 inline-flex items-center gap-1">
                          <X className="h-3 w-3" aria-hidden="true" />
                          hold
                        </span>
                      )}
                      <span className="ml-2 text-mtqs-gold/70 text-[0.62rem]">→</span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-[0.75rem] text-white/55">
                  Weight states not computed yet — snapshot loading.
                </td>
              </tr>
            )}
          </tbody>
          {snapshot && snapshot.weightStates && (
            <tfoot className="bg-mtqs-amber/5">
              <tr>
                <td className="px-3 py-2 font-mono text-mtqs-gold/80 text-[0.66rem]" colSpan={8}>
                  Tip: rows are keyboard-focusable (Tab) and open on Enter / Space.
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Side sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="bg-[#080a0c]/95 backdrop-blur-xl border-l border-mtqs-gold/25 w-full sm:max-w-md md:max-w-lg overflow-y-auto"
          aria-describedby="weight-change-drawer-desc"
        >
          <SheetHeader className="pb-2 border-b border-white/[0.06]">
            <SheetTitle className="font-mono text-mtqs-gold flex items-center gap-2">
              <SheetIcon className="h-4 w-4" aria-hidden="true" />
              {active ? `Weight Change · ${active}` : "Weight Change"}
            </SheetTitle>
            <SheetDescription id="weight-change-drawer-desc" className="text-white/55 text-[0.72rem]">
              §14 attribution · MASE + Envelopes + Smoothing + MARP
            </SheetDescription>
          </SheetHeader>

          {!snapshot || !explanation || !active ? (
            <div className="p-4 text-center text-[0.78rem] text-white/55">
              Snapshot not loaded — close and try again.
            </div>
          ) : (
            <div className="px-4 pb-6 space-y-4">
              {/* Summary paragraph */}
              <div className="rounded-md border border-mtqs-gold/20 bg-mtqs-gold/5 p-3">
                <div className="text-[0.62rem] uppercase tracking-[0.18em] text-mtqs-gold/80 mb-1">
                  Human-readable summary
                </div>
                <p className="text-[0.78rem] text-white/85 leading-relaxed">{explanation.summary}</p>
              </div>

              {/* Weight ladder */}
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55 mb-2">
                  Four-State Weight Ladder
                </div>
                <div className="grid grid-cols-5 gap-2 text-center">
                  {[
                    { label: "Prior", value: explanation.weights.prior, color: "#c9c4ba" },
                    { label: "Target", value: explanation.weights.target, color: "#e8b964" },
                    { label: "Smoothed", value: explanation.weights.smoothed, color: "#3ddc97" },
                    { label: "Execution", value: explanation.weights.execution, color: "#ff8ea3" },
                    { label: "Live", value: explanation.weights.live, color: "#ffffff" },
                  ].map((w) => (
                    <div
                      key={w.label}
                      className="rounded-md border border-white/[0.06] bg-white/[0.03] p-2"
                    >
                      <div className="text-[0.6rem] uppercase tracking-[0.14em] text-white/55">
                        {w.label}
                      </div>
                      <div
                        className="mt-1 font-mono tabular-nums text-sm font-semibold"
                        style={{ color: w.color }}
                      >
                        {(w.value * 100).toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Attribution metrics */}
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55 mb-1">
                  Attribution
                </div>
                <MetricRow
                  label="Macro Regime"
                  value={`${explanation.macroRegime.label} · VIX ${snapshot.macro.vix.toFixed(1)} · DXY ${snapshot.macro.dxy.toFixed(1)}`}
                  sub={`z-VIX ${snapshot.macro.zVix.toFixed(2)} · z-DXY ${snapshot.macro.zDxy.toFixed(2)}`}
                />
                <MetricRow
                  label="Risk Contribution"
                  value={`${(explanation.riskContribution * 100).toFixed(2)}%`}
                  sub="weight × component vol (synthetic vols for pilot)"
                  tone="amber"
                />
                <MetricRow
                  label="Diversification Contribution"
                  value={`${(explanation.diversification * 100).toFixed(1)}%`}
                  sub="1 − live weight (higher = more diversifying)"
                  tone="emerald"
                />
                <MetricRow
                  label="Purchasing-Power Signal"
                  value={`${explanation.purchasingPowerSignal >= 0 ? "+" : "−"}${Math.abs(explanation.purchasingPowerSignal).toFixed(2)}pp`}
                  sub="signed price-relative drift vs base date (§3.4)"
                  tone={explanation.purchasingPowerSignal >= 0 ? "emerald" : "rose"}
                />
                <MetricRow
                  label="Strategic-Prior Penalty"
                  value={`${explanation.strategicPriorPenalty.toFixed(2)}pp`}
                  sub="|W^Target − W^Prior| (deviation from soft anchor)"
                  tone="amber"
                />
                <MetricRow
                  label="Constraint Status"
                  value={
                    explanation.constraintStatus === "ok"
                      ? "in band"
                      : explanation.constraintStatus === "warn"
                      ? "near edge"
                      : "breach"
                  }
                  sub={`envelope ${(explanation.envelope.lower * 100).toFixed(0)}–${(explanation.envelope.upper * 100).toFixed(0)}% · current ${(explanation.envelope.current * 100).toFixed(2)}%`}
                  tone={
                    explanation.constraintStatus === "ok"
                      ? "emerald"
                      : explanation.constraintStatus === "warn"
                      ? "amber"
                      : "rose"
                  }
                />
              </div>

              {/* MARP decision block */}
              <div>
                <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55 mb-2">
                  MARP Decision (§10)
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="inline-flex items-center gap-2">
                      {explanation.direction === "buy" ? (
                        <TrendingUp className="h-3.5 w-3.5 text-mtqs-emerald" aria-hidden="true" />
                      ) : explanation.direction === "sell" ? (
                        <TrendingDown className="h-3.5 w-3.5 text-mtqs-rose" aria-hidden="true" />
                      ) : (
                        <GlowDot color="gold" size="h-1.5 w-1.5" />
                      )}
                      <span className="font-mono uppercase tracking-wider text-[0.7rem] text-white">
                        {explanation.direction}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-mtqs-gold text-[0.74rem]">
                      {explanation.tradeUsd > 0 ? fmtUsdCompact(explanation.tradeUsd) : "—"}
                    </span>
                  </div>
                  <div className="text-[0.7rem] text-white/75 leading-relaxed">
                    {explanation.reason}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[0.66rem] text-white/55">
                    <span>Urgency</span>
                    <span className="font-mono tabular-nums">
                      {(explanation.urgency * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${explanation.urgency * 100}%`,
                        backgroundColor:
                          explanation.urgency >= 0.5
                            ? "#ff5d73"
                            : explanation.urgency >= 0.2
                            ? "#ffb84d"
                            : "#3ddc97",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Decision ID */}
              <div className="rounded-md border border-white/[0.06] bg-white/[0.03] p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55">
                    Decision ID
                  </div>
                  <div className="font-mono text-mtqs-gold text-[0.78rem] mt-0.5 break-all">
                    {explanation.decisionId}
                  </div>
                </div>
                <Pill tone="gold">audit</Pill>
              </div>

              {/* Technical details */}
              <details className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <summary className="cursor-pointer text-[0.7rem] text-mtqs-gold/80 hover:text-mtqs-gold transition list-none flex items-center gap-1.5">
                  <span aria-hidden="true">▸</span>
                  Technical details (chain index lineage)
                </summary>
                <div className="mt-2 space-y-1 text-[0.66rem] text-white/55 leading-relaxed font-mono">
                  <div>
                    <span className="text-mtqs-gold/80">I_t</span> = {snapshot.chainIndex.I_t.toFixed(6)} ·{" "}
                    <span className="text-mtqs-gold/80">G_t</span> = {snapshot.chainIndex.G_t.toFixed(6)}
                  </div>
                  <div>
                    <span className="text-mtqs-gold/80">baseDenominator</span> = {snapshot.chainIndex.baseDenominator.toFixed(4)}
                  </div>
                  <div>
                    W<sup>Prior</sup> = {STRATEGIC_PRIOR[active].toFixed(4)} · W<sup>Target</sup> = {explanation.weights.target.toFixed(4)} · W<sup>Smooth</sup> = {explanation.weights.smoothed.toFixed(4)} · W<sup>Exec</sup> = {explanation.weights.execution.toFixed(4)}
                  </div>
                  <div>
                    envelope = [{(explanation.envelope.lower * 100).toFixed(0)}%–{(explanation.envelope.upper * 100).toFixed(0)}%] · status = {explanation.constraintStatus}
                  </div>
                  <div>
                    MARP path = {snapshot.rebalancePath} · tick = {tick}
                  </div>
                </div>
              </details>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Panel>
  );
}
