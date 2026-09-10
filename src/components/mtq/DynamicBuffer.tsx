// MTQΣ — Dynamic Buffer (§8) + First-Loss Waterfall (§8.5)
// 3 states BASE/STRESS/EMERGENCY with gold ratios 62.5%/85%/100%.
// Ramp progress + total target gold weight formula. First-Loss Waterfall
// staircase: Surplus → Buffer Fiat → Buffer Gold → Core Fiat → Core Gold.

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, Pill, GlowDot, TickNumber, MiniBar } from "./primitives";
import { fmtUsd, fmtUsdCompact, fmtPct } from "./format";
import {
  BUFFER_SIZE,
  CORE_GOLD_WEIGHT,
  BUFFER_GOLD_BASE,
  BUFFER_GOLD_STRESS,
  BUFFER_GOLD_EMERGENCY,
  RAMP_DURATION_HOURS,
} from "@/lib/mtq/blueprint";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

const BUFFER_STATES = [
  { id: "BASE", gold: BUFFER_GOLD_BASE, label: "BASE", desc: "normal operating", tone: "emerald" as const, total: CORE_GOLD_WEIGHT + BUFFER_SIZE * BUFFER_GOLD_BASE },
  { id: "STRESS", gold: BUFFER_GOLD_STRESS, label: "STRESS", desc: "defensive posture", tone: "amber" as const, total: CORE_GOLD_WEIGHT + BUFFER_SIZE * BUFFER_GOLD_STRESS },
  { id: "EMERGENCY", gold: BUFFER_GOLD_EMERGENCY, label: "EMERGENCY", desc: "force-sell to fiat", tone: "rose" as const, total: CORE_GOLD_WEIGHT + BUFFER_SIZE * BUFFER_GOLD_EMERGENCY },
];

const WATERFALL_LAYERS = [
  { id: 1, name: "Operational Surplus", desc: "fee revenue / buffer surplus", tone: "emerald" as const },
  { id: 2, name: "Buffer Fiat", desc: "buffer's fiat portion", tone: "gold" as const },
  { id: 3, name: "Buffer Gold", desc: "buffer's gold portion", tone: "gold" as const },
  { id: 4, name: "Core Fiat", desc: "core fiat (80% of core)", tone: "amber" as const },
  { id: 5, name: "Core Gold", desc: "core gold (20% of core)", tone: "rose" as const },
];

export function DynamicBuffer({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 animate-pulse rounded-lg bg-white/[0.03]/[0.03]" />
        <div className="h-64 animate-pulse rounded-lg bg-white/[0.03]/[0.03]" />
      </div>
    );
  }

  const current = snapshot.bufferState;
  const wf = snapshot.waterfall;
  const layerConsumed = [wf.consumed.surplus, wf.consumed.bufferFiat, wf.consumed.bufferGold, wf.consumed.coreFiat, wf.consumed.coreGold];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Buffer state card */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white/90">Dynamic Buffer (§8.3)</div>
              <div className="text-[0.7rem] text-white/55">buffer gold ratio by protocol status</div>
            </div>
            <Pill tone={current === "EMERGENCY" ? "rose" : current === "STRESS" ? "amber" : "emerald"}>
              <GlowDot color={current === "EMERGENCY" ? "rose" : current === "STRESS" ? "amber" : "emerald"} size="h-1.5 w-1.5" />
              {current}
            </Pill>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {BUFFER_STATES.map((s) => {
              const isActive = current === s.id;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-lg border p-3 ${
                    isActive
                      ? s.tone === "emerald"
                        ? "border-mtqs-emerald/40 bg-emerald-500/[0.08] mtqs-glow-emerald"
                        : s.tone === "amber"
                        ? "border-mtqs-amber/40 bg-amber-500/[0.08]"
                        : "border-rose-400/40 bg-rose-500/[0.08] mtqs-glow-rose"
                      : "border-white/[0.06] bg-white/[0.03]/[0.02]"
                  }`}
                >
                  <div className={`text-[0.7rem] font-semibold ${isActive ? (s.tone === "emerald" ? "text-mtqs-emerald" : s.tone === "amber" ? "text-mtqs-gold" : "text-rose-200") : "text-white/55"}`}>
                    {s.label}
                  </div>
                  <div className="mt-1 font-mono text-lg text-mtqs-gold">{(s.gold * 100).toFixed(1)}%</div>
                  <div className="text-[0.65rem] text-white/55">{s.desc}</div>
                  <div className="mt-1.5 text-[0.6rem] text-white/55/60">
                    total W ≈ <span className="font-mono text-mtqs-gold">{(s.total * 100).toFixed(2)}%</span>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="mt-4 rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[0.65rem] uppercase tracking-[0.2em] text-white/55">Buffer Gold Ratio (live)</div>
              <TickNumber value={snapshot.bufferGoldRatio} format={(n) => `${(n * 100).toFixed(2)}%`} className="font-mono text-mtqs-gold text-sm font-semibold" />
            </div>
            <MiniBar
              value={snapshot.bufferGoldRatio}
              max={1}
              colorClass={current === "EMERGENCY" ? "bg-rose-400" : current === "STRESS" ? "bg-amber-400" : "bg-emerald-400"}
              height="h-2"
            />
          </div>

          <p className="mt-3 text-[0.7rem] text-white/55 leading-relaxed">
            Total target gold weight formula: <span className="font-mono text-mtqs-gold">W_target = 0.20 + 0.10·B_gold(RR) + θ_smoothed</span> clamped to [22%, 30%]. Ramp duration: {RAMP_DURATION_HOURS}h.
          </p>
        </Panel>
      </Reveal>

      {/* First-Loss Waterfall */}
      <Reveal delay={0.05}>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white/90">First-Loss Waterfall (§8.5)</div>
              <div className="text-[0.7rem] text-white/55">5-layer loss absorption order</div>
            </div>
            <Pill tone={wf.currentLayer >= 4 ? "rose" : wf.currentLayer >= 2 ? "amber" : "emerald"}>
              layer {wf.currentLayer} active
            </Pill>
          </div>

          <div className="flex flex-col gap-2">
            {WATERFALL_LAYERS.map((layer, i) => {
              const consumed = layerConsumed[i] ?? 0;
              const isActive = wf.currentLayer === layer.id;
              const stairOffset = i * 18; // visual staircase indent
              return (
                <motion.div
                  key={layer.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.06 }}
                  className={`relative rounded-md border p-2.5 pl-3 ${
                    isActive
                      ? layer.tone === "emerald"
                        ? "border-mtqs-emerald/40 bg-emerald-500/[0.08]"
                        : layer.tone === "gold"
                        ? "border-mtqs-amber/40 bg-amber-500/[0.08]"
                        : layer.tone === "amber"
                        ? "border-mtqs-amber/40 bg-mtqs-amber/5"
                        : "border-rose-400/40 bg-rose-500/[0.08] mtqs-glow-rose"
                      : "border-white/[0.06] bg-white/[0.03]/[0.015]"
                  }`}
                  style={{ marginLeft: `${stairOffset}px` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-mono text-xs font-semibold ${isActive ? "text-mtqs-gold" : "text-white/55"}`}>
                        L{layer.id}
                      </span>
                      <span className={`text-xs font-medium truncate ${isActive ? "text-white/90" : "text-white/55"}`}>
                        {layer.name}
                      </span>
                      {isActive && <GlowDot color="amber" size="h-1.5 w-1.5" />}
                    </div>
                    <span className="text-[0.65rem] font-mono text-white/55 shrink-0">
                      {consumed > 0 ? `consumed ${fmtUsdCompact(consumed)}` : "intact"}
                    </span>
                  </div>
                  <div className="text-[0.6rem] text-white/55/60 mt-0.5">{layer.desc}</div>
                </motion.div>
              );
            })}
          </div>

          <p className="mt-3 text-[0.7rem] text-white/55 leading-relaxed">
            Losses flow top → bottom. Surplus absorbs first, then buffer fiat, buffer gold, core fiat (80% of core), and finally core gold (20% of core — the deepest, never-breach layer).
          </p>
        </Panel>
      </Reveal>
    </div>
  );
}
