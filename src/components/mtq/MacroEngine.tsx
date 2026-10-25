// MTQΣ — Adaptive Macro Engine (§6)
// VIX/DXY current + z-score bars (centered 0), raw θ, raw target, EMA-smoothed target.
// All §6 coefficients. VIX/DXY chips mirror the LIVE source state
// (fx.liveVix / fx.liveDxy — emerald when live, amber when the honest
// seeded OU-walk fallback produced the value).

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, TickNumber, Pill, MiniBar } from "./primitives";
import { fmtFixed } from "./format";
import {
  ALPHA,
  BETA,
  THETA_MAX,
  SMOOTHING_LAMBDA,
  ROLLING_WINDOW_DAYS,
  BASE_GOLD_WEIGHT,
  GOLD_WEIGHT_LOWER,
  GOLD_WEIGHT_UPPER,
  VIX_MIN,
  VIX_MAX,
  DXY_MIN,
  DXY_MAX,
} from "@/lib/mtq/blueprint";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

function ZScoreBar({ z }: { z: number }) {
  // z-scores typically -3..+3; render centered bar
  const pct = Math.max(-1, Math.min(1, z / 3));
  const isPos = pct > 0;
  return (
    <div className="relative h-2 rounded-full bg-[#E3EAE6] overflow-hidden">
      <div className="absolute inset-y-0 left-1/2 w-px bg-amber-400/70" />
      <motion.div
        className={`absolute inset-y-0 ${isPos ? "bg-rose-400" : "bg-emerald-400"} rounded-full`}
        style={{ left: isPos ? "50%" : `${50 + pct * 50}%`, width: `${Math.abs(pct) * 50}%` }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.abs(pct) * 50}%` }}
        transition={{ duration: 0.5 }}
      />
    </div>
  );
}

export function MacroEngine({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  if (!snapshot) {
    return <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{[...Array(2)].map((_, i) => <div key={i} className="h-64 animate-pulse rounded-lg bg-[#F7FAF8]" />)}</div>;
  }
  const m = snapshot.macro;

  return (
    <div className="space-y-4">
      <Reveal>
        <Panel className="p-4 sm:p-5 border-mtqs-amber/30">
          <div className="flex items-start gap-3">
            <span className="mtqs-eyebrow shrink-0 text-mtqs-amber">⚠ Pilot Macro Signals — live when reachable</span>
            <p className="text-[0.72rem] text-[#5B6E68] leading-relaxed">
              VIX &amp; DXY are LIVE from no-key sources when reachable — Yahoo Finance (CBOE ^VIX,
              ICE DX-Y.NYB), with FRED (VIXCLS / DTWEXBGS) preferred when the optional key is
              configured — and fall back honestly to a seeded mean-reverting stochastic walk
              when no feed answers (each chip below shows its live/sim state this tick). The §6
              math (z-scores, θ, EMA smoothing, clamping) is fully real.
            </p>
          </div>
        </Panel>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* VIX panel */}
        <Reveal>
          <Panel className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[0.625rem] uppercase tracking-[0.25em] text-[#5B6E68]">VIX · CBOE Volatility Index</span>
              <Pill tone={snapshot.fx.liveVix ? "emerald" : "amber"}>{snapshot.fx.liveVix ? "live" : "sim (fallback)"}</Pill>
            </div>
            <div className="flex items-baseline gap-2">
              <TickNumber value={m.vix} format={(n) => n.toFixed(2)} className="text-3xl font-semibold text-mtqs-gold" />
              <span className="text-xs text-[#5B6E68] font-mono">points</span>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[0.7rem] text-[#5B6E68]">
                <span>μ (90d rolling)</span>
                <span className="font-mono text-mtqs-gold">{m.vixMean.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[0.7rem] text-[#5B6E68]">
                <span>σ</span>
                <span className="font-mono text-mtqs-gold">{m.vixSd.toFixed(3)}</span>
              </div>
              <div className="flex justify-between text-[0.7rem] text-[#5B6E68]">
                <span>z-score</span>
                <span className={`font-mono ${m.zVix > 0 ? "text-mtqs-rose" : "text-mtqs-emerald"}`}>{m.zVix > 0 ? "+" : ""}{m.zVix.toFixed(3)}</span>
              </div>
              <div className="mt-2"><ZScoreBar z={m.zVix} /></div>
              <div className="mt-1 flex justify-between text-[0.6rem] text-[#5B6E68] font-mono">
                <span>−3σ</span><span>0</span><span>+3σ</span>
              </div>
            </div>
          </Panel>
        </Reveal>

        {/* DXY panel */}
        <Reveal delay={0.05}>
          <Panel className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[0.625rem] uppercase tracking-[0.25em] text-[#5B6E68]">DXY · US Dollar Index</span>
              <Pill tone={snapshot.fx.liveDxy ? "emerald" : "amber"}>{snapshot.fx.liveDxy ? "live" : "sim (fallback)"}</Pill>
            </div>
            <div className="flex items-baseline gap-2">
              <TickNumber value={m.dxy} format={(n) => n.toFixed(2)} className="text-3xl font-semibold text-mtqs-gold" />
              <span className="text-xs text-[#5B6E68] font-mono">points</span>
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between text-[0.7rem] text-[#5B6E68]">
                <span>μ (90d rolling)</span>
                <span className="font-mono text-mtqs-gold">{m.dxyMean.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[0.7rem] text-[#5B6E68]">
                <span>σ</span>
                <span className="font-mono text-mtqs-gold">{m.dxySd.toFixed(3)}</span>
              </div>
              <div className="flex justify-between text-[0.7rem] text-[#5B6E68]">
                <span>z-score</span>
                <span className={`font-mono ${m.zDxy > 0 ? "text-mtqs-rose" : "text-mtqs-emerald"}`}>{m.zDxy > 0 ? "+" : ""}{m.zDxy.toFixed(3)}</span>
              </div>
              <div className="mt-2"><ZScoreBar z={m.zDxy} /></div>
              <div className="mt-1 flex justify-between text-[0.6rem] text-[#5B6E68] font-mono">
                <span>−3σ</span><span>0</span><span>+3σ</span>
              </div>
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* θ + target gold weight */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 text-[0.625rem] uppercase tracking-[0.25em] text-[#5B6E68]">
            θ · smoothed gold weight target (§6.4 + §6.6)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
              <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[#5B6E68]">Raw θ</div>
              <TickNumber value={m.rawTheta} format={(n) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(3)}%`} className={`text-xl font-semibold ${m.rawTheta > 0 ? "text-mtqs-rose" : "text-mtqs-emerald"}`} />
              <div className="text-[0.65rem] text-[#5B6E68] mt-1">
                θ = α·zVIX + β·zDXY · clamp ±{(THETA_MAX * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
              <div className="text-[0.65rem] uppercase tracking-[0.2em] text-[#5B6E68]">Raw Target W</div>
              <TickNumber value={m.rawTarget} format={(n) => `${(n * 100).toFixed(2)}%`} className="text-xl font-semibold text-mtqs-gold" />
              <div className="text-[0.65rem] text-[#5B6E68] mt-1">
                W₀ + θ · clamp {BASE_GOLD_WEIGHT * 100}% → [{(GOLD_WEIGHT_LOWER * 100).toFixed(0)}%–{(GOLD_WEIGHT_UPPER * 100).toFixed(0)}%]
              </div>
            </div>
            <div className="rounded-md border border-mtqs-emerald/20 bg-mtqs-emerald/5 p-3">
              <div className="text-[0.65rem] uppercase tracking-[0.2em] text-mtqs-emerald/80">EMA-smoothed Target</div>
              <TickNumber value={m.smoothedTarget} format={(n) => `${(n * 100).toFixed(2)}%`} className="text-xl font-semibold text-mtqs-emerald" />
              <div className="text-[0.65rem] text-[#5B6E68] mt-1">
                λ = {(SMOOTHING_LAMBDA * 100).toFixed(0)}% · {ROLLING_WINDOW_DAYS}d window
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-[0.7rem]">
            <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-2 py-1.5">
              <div className="text-[#5B6E68]">α (VIX sens.)</div><div className="font-mono text-mtqs-gold">{ALPHA.toFixed(2)}</div>
            </div>
            <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-2 py-1.5">
              <div className="text-[#5B6E68]">β (DXY sens.)</div><div className="font-mono text-mtqs-gold">{BETA.toFixed(2)}</div>
            </div>
            <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-2 py-1.5">
              <div className="text-[#5B6E68]">θ_max</div><div className="font-mono text-mtqs-gold">±{(THETA_MAX * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-2 py-1.5">
              <div className="text-[#5B6E68]">λ (EMA)</div><div className="font-mono text-mtqs-gold">{SMOOTHING_LAMBDA.toFixed(2)}</div>
            </div>
            <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-2 py-1.5">
              <div className="text-[#5B6E68]">Bounds</div><div className="font-mono text-mtqs-gold">{(GOLD_WEIGHT_LOWER * 100).toFixed(0)}–{(GOLD_WEIGHT_UPPER * 100).toFixed(0)}%</div>
            </div>
            <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-2 py-1.5">
              <div className="text-[#5B6E68]">VIX range</div><div className="font-mono text-mtqs-gold">{VIX_MIN}–{VIX_MAX}</div>
            </div>
            <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-2 py-1.5">
              <div className="text-[#5B6E68]">DXY range</div><div className="font-mono text-mtqs-gold">{DXY_MIN}–{DXY_MAX}</div>
            </div>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
