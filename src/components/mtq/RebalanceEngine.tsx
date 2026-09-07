// MTQΣ — Rebalancing Engine (§7)
// Decision (direction +1 buy gold / −1 sell gold, deviation, tradeUsd,
// shouldRebalance, reason), §7 coefficients λ1–λ4, slippage, max daily
// turnover, max pool fraction, 24h direction lock. Quote-based execution §10.1.

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, TickNumber, Pill, GlowDot } from "./primitives";
import { fmtUsd, fmtPct, fmtFixed, fmtUsdCompact } from "./format";
import {
  LAMBDA_1, LAMBDA_2, LAMBDA_3, LAMBDA_4,
  SLIPPAGE_TOLERANCE, MAX_DAILY_TURNOVER, MAX_POOL_FRACTION, DIRECTION_LOCK_HOURS,
  AGGREGATOR_QUOTE_PROVIDERS,
} from "@/lib/mtq/blueprint";
import type { MetricsSnapshot, RebalanceDecision } from "@/lib/mtq/engine";

function DirectionBadge({ dir }: { dir: 0 | 1 | -1 }) {
  if (dir === 0) return <Pill tone="muted">no trade</Pill>;
  if (dir === 1) return <Pill tone="emerald"><GlowDot color="emerald" size="h-1.5 w-1.5" /> buy gold (+1)</Pill>;
  return <Pill tone="rose"><GlowDot color="rose" size="h-1.5 w-1.5" /> sell gold (−1)</Pill>;
}

export function RebalanceEngine({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  if (!snapshot) {
    return <div className="h-64 animate-pulse rounded-lg bg-white/[0.03]" />;
  }
  const d: RebalanceDecision = snapshot.rebalance;

  return (
    <div className="space-y-4">
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground/90">Rebalance Decision (§7.5)</div>
              <div className="text-[0.7rem] text-muted-foreground/70">{d.reason}</div>
            </div>
            <DirectionBadge dir={d.direction} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">Observed W</div>
              <TickNumber value={d.observedGoldWeight} format={(n) => `${(n * 100).toFixed(2)}%`} className="text-lg font-semibold text-amber-200" />
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">Target W</div>
              <TickNumber value={d.targetGoldWeight} format={(n) => `${(n * 100).toFixed(2)}%`} className="text-lg font-semibold text-emerald-200" />
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">Deviation</div>
              <TickNumber
                value={d.deviation}
                format={(n) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(2)}%`}
                className={`text-lg font-semibold ${Math.abs(d.deviation) >= 0.005 ? (d.deviation > 0 ? "text-rose-300" : "text-emerald-300") : "text-muted-foreground"}`}
              />
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">Trade USD</div>
              <TickNumber value={d.shouldRebalance ? d.tradeUsd : 0} format={fmtUsdCompact} className="text-lg font-semibold text-amber-200" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem]">
            <span className="text-muted-foreground/80">decision:</span>
            {d.shouldRebalance
              ? <Pill tone="emerald">EXECUTING</Pill>
              : <Pill tone="muted">no trade</Pill>}
            <span className="text-muted-foreground/80">·</span>
            <span className="text-muted-foreground/80">direction:</span>
            <span className="font-mono text-amber-200">{d.direction === 0 ? "0 (hold)" : d.direction === 1 ? "+1 buy Au" : "−1 sell Au"}</span>
          </div>
        </Panel>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Reveal>
          <Panel className="p-5">
            <div className="mb-3 text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground/80">
              §7.3 Objective Function Coefficients
            </div>
            <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-muted-foreground/70">λ₁ · Deviation</div>
                <div className="font-mono text-amber-200 text-lg">{LAMBDA_1.toFixed(2)}</div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-muted-foreground/70">λ₂ · Cost</div>
                <div className="font-mono text-amber-200 text-lg">{LAMBDA_2.toFixed(2)}</div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-muted-foreground/70">λ₃ · Urgency</div>
                <div className="font-mono text-amber-200 text-lg">{LAMBDA_3.toFixed(2)}</div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-muted-foreground/70">λ₄ · Turnover</div>
                <div className="font-mono text-amber-200 text-lg">{LAMBDA_4.toFixed(2)}</div>
              </div>
            </div>
            <p className="mt-3 text-[0.7rem] text-muted-foreground/70 leading-relaxed">
              Objective J = λ₁·|dev| − λ₂·cost + λ₃·urgency − λ₄·turnover. Trade executes only when benefit &gt; cost.
            </p>
          </Panel>
        </Reveal>

        <Reveal delay={0.05}>
          <Panel className="p-5">
            <div className="mb-3 text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground/80">
              §7.4 + §7.6 Execution Constraints
            </div>
            <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-muted-foreground/70">Slippage τ</div>
                <div className="font-mono text-amber-200">{(SLIPPAGE_TOLERANCE * 100).toFixed(2)}%</div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-muted-foreground/70">Max daily turnover</div>
                <div className="font-mono text-amber-200">{(MAX_DAILY_TURNOVER * 100).toFixed(0)}% NAV</div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-muted-foreground/70">Max pool fraction</div>
                <div className="font-mono text-amber-200">{(MAX_POOL_FRACTION * 100).toFixed(0)}% 24h depth</div>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                <div className="text-muted-foreground/70">Direction lock</div>
                <div className="font-mono text-amber-200">{DIRECTION_LOCK_HOURS}h</div>
              </div>
            </div>
            <p className="mt-3 text-[0.7rem] text-muted-foreground/70 leading-relaxed">
              §10.1 Quote-based execution: fetch route quote from <span className="font-mono text-amber-200">{AGGREGATOR_QUOTE_PROVIDERS.join(" / ")}</span> with two-sided bounds at <span className="font-mono text-amber-200">oracle ± τ</span>; trade executes only if the quoted rate falls within the bound.
            </p>
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
