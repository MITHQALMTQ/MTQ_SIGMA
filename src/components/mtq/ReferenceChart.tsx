// MTQΣ — Reference Index Chart (§15)
// Professional reference-index line chart with time-range toggles (1D / 7D / 30D
// / 90D / 1Y / MAX). Built on top of the existing GfbChart SVG approach (aurora
// gradient line + area fill + glow endpoint) and adds:
//   - Time-range toggle pill bar
//   - Synthetic deterministic history per range (seeded mulberry32 PRNG so the
//     shape stays stable across renders; only the final point tracks the live
//     `gfbIndex` from the snapshot).
//   - Weight-change markers (gold) · risk-state transition markers (rose) ·
//     rebalance event markers (emerald) rendered as dots on the line.
//   - Interactive hover tooltip with Date / Reference Index / Price effect /
//     Composition effect / Execution effect breakdown.
//   - Prominent current value label (top-right) and range summary stats
//     (period change, high, low) along the bottom.
//
// All financial data uses font-mono tabular-nums. No blue/indigo. Brand palette
// only (gold #e8b964, emerald #3ddc97, rose #ff5d73, amber #ffb84d).

"use client";

import { useMemo, useRef, useState, useEffect, type MouseEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Panel } from "./primitives";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import { STATUS_COLORS } from "@/lib/mtq/brand";

type RangeKey = "1D" | "7D" | "30D" | "90D" | "1Y" | "MAX";

interface RangeMeta {
  label: RangeKey;
  points: number;
  ms: number; // total span of the range
  short: string;
}

const RANGES: RangeMeta[] = [
  { label: "1D", points: 48, ms: 24 * 3600_000, short: "24h" },
  { label: "7D", points: 56, ms: 7 * 24 * 3600_000, short: "7d" },
  { label: "30D", points: 60, ms: 30 * 24 * 3600_000, short: "30d" },
  { label: "90D", points: 90, ms: 90 * 24 * 3600_000, short: "90d" },
  { label: "1Y", points: 120, ms: 365 * 24 * 3600_000, short: "1y" },
  { label: "MAX", points: 180, ms: 3 * 365 * 24 * 3600_000, short: "max" },
];

// --- Deterministic PRNG (mulberry32) so the synthetic shape is stable ---
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Marker {
  t: number; // 0..1 position along the time axis
  type: "weight" | "risk" | "rebalance";
  label: string;
  detail: string;
}

interface ChartPoint {
  t: number; // 0..1 along the time axis
  v: number; // reference index value
  ts: number; // epoch ms (descending from start to now)
  priceEffect: number; // signed pp contribution
  compositionEffect: number;
  executionEffect: number;
}

interface ReferenceChartProps {
  snapshot?: MetricsSnapshot | null;
  height?: number;
  initialRange?: RangeKey;
}

export function ReferenceChart({
  snapshot,
  height = 260,
  initialRange = "30D",
}: ReferenceChartProps) {
  const [range, setRange] = useState<RangeKey>(initialRange);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const gfb = snapshot?.gfbIndex ?? 1.0;
  const meta = RANGES.find((r) => r.label === range) ?? RANGES[2];

  // Generate deterministic synthetic history per range.
  const { data, markers, stats } = useMemo(() => {
    const seed =
      range.charCodeAt(0) * 7919 +
      range.length * 104729 +
      Math.floor(Date.now() / (60 * 60_000)); // shape shifts hourly for realism
    const rand = mulberry32(seed);
    const pts: ChartPoint[] = [];
    const now = Date.now();
    const baseVol =
      range === "1D" ? 0.0015 :
      range === "7D" ? 0.003 :
      range === "30D" ? 0.006 :
      range === "90D" ? 0.012 :
      range === "1Y" ? 0.025 : 0.04;
    // Choose a stable starting value around 0.97..1.03 so the walk ends near gfb.
    const drift = (gfb - 1.0) * 0.6;
    let v = gfb - drift + (rand() - 0.5) * baseVol * 4;
    let priceAcc = 0;
    let compAcc = 0;
    let execAcc = 0;
    for (let i = 0; i < meta.points; i++) {
      const t = i / (meta.points - 1);
      const ts = now - Math.round((1 - t) * meta.ms);
      const shock = (rand() - 0.5) * baseVol;
      const trend = drift * (t * 0.4);
      v = v + shock + trend * (1 / meta.points);
      // Decompose the move into three signed effects (synthetic).
      const price = shock * 0.7 + trend * (1 / meta.points) * 0.6;
      const comp = shock * 0.2;
      const exec = shock * 0.1 - trend * (1 / meta.points) * 0.05;
      priceAcc += price;
      compAcc += comp;
      execAcc += exec;
      pts.push({
        t,
        v,
        ts,
        priceEffect: priceAcc,
        compositionEffect: compAcc,
        executionEffect: execAcc,
      });
    }
    // Force the last point to be the live gfbIndex so the right edge tracks reality.
    pts[pts.length - 1].v = gfb;

    // Synthetic markers along the chart.
    const mlist: Marker[] = [];
    const states: ("NORMAL" | "CAUTION" | "STRESS" | "RECOVERY")[] = [
      "NORMAL",
      "NORMAL",
      "CAUTION",
      "STRESS",
      "RECOVERY",
      "NORMAL",
    ];
    // Risk-state transitions: 4-6 across the range.
    const numRisk = 4 + Math.floor(rand() * 3);
    for (let i = 0; i < numRisk; i++) {
      const tt = 0.1 + (i / numRisk) * 0.85 + (rand() - 0.5) * 0.05;
      const s = states[Math.floor(rand() * states.length)];
      mlist.push({
        t: tt,
        type: "risk",
        label: `Risk → ${s}`,
        detail: `LCR drawdown or VIX spike triggered an automated transition into ${s}. Mint throttle / redeem fee adjusted by the §14.1 policy row.`,
      });
    }
    // Rebalance events (MARP per-component trades): 5-8 across the range.
    const numReb = 5 + Math.floor(rand() * 4);
    for (let i = 0; i < numReb; i++) {
      const tt = 0.08 + (i / numReb) * 0.9 + (rand() - 0.5) * 0.04;
      mlist.push({
        t: tt,
        type: "rebalance",
        label: "MARP rebalance",
        detail: "Per-component MARP (§10) trade executed: deviation exceeded the no-trade zone (L6), 50% partial correction applied, capped at 5% NAV daily turnover.",
      });
    }
    // Weight-change events (MASE target recomputation): 3-5 across the range.
    const numW = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < numW; i++) {
      const tt = 0.15 + (i / numW) * 0.8 + (rand() - 0.5) * 0.04;
      mlist.push({
        t: tt,
        type: "weight",
        label: "Weight recompute",
        detail: "MASE ensemble (§6/§7) recomputed W^Target under the per-component admissibility envelopes (§8.1); EMA λ=20% smoothing applied (§8.4).",
      });
    }
    mlist.sort((a, b) => a.t - b.t);

    // Period stats.
    const firstV = pts[0].v;
    const lastV = pts[pts.length - 1].v;
    const change = lastV - firstV;
    const changePct = (change / firstV) * 100;
    const high = Math.max(...pts.map((p) => p.v));
    const low = Math.min(...pts.map((p) => p.v));
    return {
      data: pts,
      markers: mlist,
      stats: { change, changePct, high, low, firstV, lastV },
    };
  }, [range, gfb, meta.points, meta.ms]);

  // --- Layout constants ---
  const width = 100;
  const h = height;
  const padTop = 8;
  const padBot = 18; // space for x-axis hint markers
  const plotH = h - padTop - padBot;
  const minV = Math.min(...data.map((d) => d.v));
  const maxV = Math.max(...data.map((d) => d.v));
  const range01 = maxV - minV || 0.001;
  const pad = range01 * 0.2;
  const yMin = minV - pad;
  const yMax = maxV + pad;
  const yRange = yMax - yMin;

  const xFor = (t: number) => t * width;
  const yFor = (v: number) => padTop + plotH - ((v - yMin) / yRange) * plotH;

  // Line path
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(d.t).toFixed(2)} ${yFor(d.v).toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${width} ${padTop + plotH} L 0 ${padTop + plotH} Z`;

  // Hover handling — find the nearest point to cursor x.
  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const xRel = (e.clientX - rect.left) / rect.width; // 0..1
    if (xRel < 0 || xRel > 1) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(xRel * (data.length - 1))));
    setHoverIdx(idx);
  };
  const handleLeave = () => setHoverIdx(null);

  // Auto-clear hover after 6s of inactivity to avoid stale tooltips.
  useEffect(() => {
    if (hoverIdx == null) return;
    const id = setTimeout(() => setHoverIdx(null), 6000);
    return () => clearTimeout(id);
  }, [hoverIdx]);

  const markerColor = (type: Marker["type"]) =>
    type === "weight" ? "#e8b964" : type === "risk" ? "#ff5d73" : "#3ddc97";

  const hover = hoverIdx != null ? data[hoverIdx] : null;
  const hoverMarkers =
    hoverIdx != null
      ? markers.filter((m) => Math.abs(m.t - data[hoverIdx!].t) < 1.5 / data.length)
      : [];

  // Range bar (toggle)
  const RangeBar = (
    <div
      role="tablist"
      aria-label="Reference chart time range"
      className="inline-flex items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.03] p-0.5"
    >
      {RANGES.map((r) => {
        const active = r.label === range;
        return (
          <button
            key={r.label}
            role="tab"
            aria-selected={active}
            aria-label={`Show ${r.label} reference index history`}
            onClick={() => setRange(r.label)}
            className={`px-2.5 sm:px-3 py-1 text-[0.7rem] font-mono tabular-nums rounded-full transition-colors mtqs-focus ${
              active
                ? "bg-mtqs-gold/20 text-mtqs-gold border border-mtqs-gold/30"
                : "text-white/55 hover:text-white border border-transparent"
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );

  if (!snapshot) {
    return (
      <Panel className="p-5">
        <div className="flex items-center justify-between mb-3">{RangeBar}</div>
        <div
          className="w-full animate-pulse rounded-md bg-white/[0.04]"
          style={{ height: `${h}px` }}
          aria-hidden="true"
        />
      </Panel>
    );
  }

  const changePositive = stats.change >= 0;

  return (
    <Panel className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
            §15 · Reference Index · chain-linked I_t
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-mono tabular-nums text-2xl sm:text-3xl font-semibold mtqs-gold-text">
              {gfb.toFixed(4)}
            </span>
            <span
              className={`font-mono tabular-nums text-sm ${
                changePositive ? "text-mtqs-emerald" : "text-mtqs-rose"
              }`}
              aria-label={`Period change ${changePositive ? "up" : "down"} ${stats.changePct.toFixed(2)} percent`}
            >
              {changePositive ? "▲" : "▼"} {Math.abs(stats.changePct).toFixed(2)}% · {meta.short}
            </span>
          </div>
        </div>
        {RangeBar}
      </div>

      {/* Chart SVG */}
      <div className="relative w-full select-none" style={{ height: `${h}px` }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${h}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          role="img"
          aria-label={`Reference index chart over the last ${meta.short}`}
        >
          <defs>
            <linearGradient id="mtqs-ref-aurora" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#e8b964" stopOpacity="0.55" />
              <stop offset="40%" stopColor="#3ddc97" stopOpacity="0.8" />
              <stop offset="80%" stopColor="#e8b964" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ff5d73" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="mtqs-ref-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8b964" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#e8b964" stopOpacity="0" />
            </linearGradient>
            <filter id="mtqs-ref-glow">
              <feGaussianBlur stdDeviation="0.4" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Y grid lines */}
          {[0.2, 0.4, 0.6, 0.8].map((p) => (
            <line
              key={p}
              x1="0"
              y1={padTop + plotH * p}
              x2={width}
              y2={padTop + plotH * p}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="0.1"
            />
          ))}

          {/* Area fill */}
          <motion.path
            d={areaPath}
            fill="url(#mtqs-ref-area)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          />
          {/* Line */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="url(#mtqs-ref-aurora)"
            strokeWidth="0.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#mtqs-ref-glow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />

          {/* Markers */}
          {markers.map((m, i) => {
            const yOnLine = (() => {
              // Find nearest data point at m.t and use its v
              const idx = Math.round(m.t * (data.length - 1));
              return yFor(data[idx].v);
            })();
            const color = markerColor(m.type);
            return (
              <g key={`${m.type}-${i}`}>
                <motion.circle
                  cx={xFor(m.t)}
                  cy={yOnLine}
                  r="0.7"
                  fill={color}
                  fillOpacity="0.85"
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth="0.05"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.04 }}
                />
                {/* Marker stick */}
                <line
                  x1={xFor(m.t)}
                  y1={yOnLine}
                  x2={xFor(m.t)}
                  y2={padTop + plotH}
                  stroke={color}
                  strokeOpacity="0.18"
                  strokeWidth="0.1"
                />
              </g>
            );
          })}

          {/* Live endpoint */}
          <motion.circle
            cx={xFor(1)}
            cy={yFor(gfb)}
            r="0.9"
            fill="#e8b964"
            filter="url(#mtqs-ref-glow)"
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 2, repeat: Infinity, delay: 1.2 }}
          />

          {/* Hover crosshair + active dot */}
          {hover && (
            <g>
              <line
                x1={xFor(hover.t)}
                y1={padTop}
                x2={xFor(hover.t)}
                y2={padTop + plotH}
                stroke="rgba(232,185,100,0.45)"
                strokeWidth="0.15"
                strokeDasharray="0.6 0.6"
              />
              <circle
                cx={xFor(hover.t)}
                cy={yFor(hover.v)}
                r="1"
                fill="#e8b964"
                stroke="rgba(0,0,0,0.5)"
                strokeWidth="0.1"
              />
            </g>
          )}
        </svg>

        {/* Tooltip overlay (HTML, positioned in px via percentages) */}
        <AnimatePresence>
          {hover && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              className="pointer-events-none absolute top-2 z-10 max-w-[15rem] rounded-lg border border-mtqs-gold/25 bg-[#0b0f0e]/95 backdrop-blur-md p-3 text-[0.7rem] shadow-xl"
              style={{
                left: `${hover.t * 100}%`,
                transform: `translateX(${hover.t > 0.7 ? "calc(-100% - 8px)" : "8px"})`,
              }}
              role="tooltip"
            >
              <div className="font-mono text-[0.62rem] text-white/55 uppercase tracking-[0.18em]">
                {new Date(hover.ts).toLocaleString("en-US", {
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="mt-1 font-mono tabular-nums text-base text-mtqs-gold">
                {hover.v.toFixed(4)}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[0.66rem]">
                <div>
                  <div className="text-white/55 uppercase tracking-wider">Price</div>
                  <div
                    className={`font-mono tabular-nums ${
                      hover.priceEffect >= 0 ? "text-mtqs-emerald" : "text-mtqs-rose"
                    }`}
                  >
                    {hover.priceEffect >= 0 ? "+" : "−"}
                    {Math.abs(hover.priceEffect * 100).toFixed(3)}pp
                  </div>
                </div>
                <div>
                  <div className="text-white/55 uppercase tracking-wider">Comp.</div>
                  <div
                    className={`font-mono tabular-nums ${
                      hover.compositionEffect >= 0 ? "text-mtqs-emerald" : "text-mtqs-rose"
                    }`}
                  >
                    {hover.compositionEffect >= 0 ? "+" : "−"}
                    {Math.abs(hover.compositionEffect * 100).toFixed(3)}pp
                  </div>
                </div>
                <div>
                  <div className="text-white/55 uppercase tracking-wider">Exec.</div>
                  <div
                    className={`font-mono tabular-nums ${
                      hover.executionEffect >= 0 ? "text-mtqs-emerald" : "text-mtqs-rose"
                    }`}
                  >
                    {hover.executionEffect >= 0 ? "+" : "−"}
                    {Math.abs(hover.executionEffect * 100).toFixed(3)}pp
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[0.62rem] text-white/55 leading-snug">
                <span className="text-mtqs-gold/80">Price</span> = currency &amp; gold moves ·{" "}
                <span className="text-mtqs-gold/80">Composition</span> = weight rebalance ·{" "}
                <span className="text-mtqs-gold/80">Execution</span> = MARP slippage.
              </div>
              {hoverMarkers.length > 0 && (
                <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1">
                  {hoverMarkers.slice(0, 3).map((m, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span
                        className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: markerColor(m.type) }}
                      />
                      <span className="text-[0.64rem] text-white/75 leading-snug">
                        <span className="font-semibold text-white">{m.label}</span>
                        <span className="text-white/55"> — {m.detail}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Current value tag */}
        <div className="absolute top-1.5 right-1.5 flex flex-col items-end pointer-events-none">
          <div className="text-[0.6rem] text-white/55 uppercase tracking-wider">Live</div>
          <div className="font-mono tabular-nums text-sm font-semibold mtqs-gold-text">
            {gfb.toFixed(4)}
          </div>
        </div>
      </div>

      {/* Period stats row */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Period Change" value={`${changePositive ? "+" : "−"}${Math.abs(stats.changePct).toFixed(2)}%`} tone={changePositive ? "emerald" : "rose"} />
        <Stat label="Period Δ" value={`${changePositive ? "+" : "−"}${Math.abs(stats.change).toFixed(4)}`} tone={changePositive ? "emerald" : "rose"} />
        <Stat label="Range High" value={stats.high.toFixed(4)} tone="gold" />
        <Stat label="Range Low" value={stats.low.toFixed(4)} tone="gold" />
      </div>

      {/* Marker legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.66rem] text-white/55">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#e8b964" }} />
          Weight recompute (MASE target)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#ff5d73" }} />
          Risk-state transition (§14.1)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#3ddc97" }} />
          MARP rebalance event (§10)
        </span>
        <span className="text-white/55/60 hidden sm:inline">
          Synthetic pilot history · live endpoint tracks the engine&apos;s chain-linked I_t.
        </span>
      </div>

      {snapshot && snapshot.status && (
        <div
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.62rem]"
          style={{
            backgroundColor: STATUS_COLORS[snapshot.status]?.bg ?? "rgba(255,255,255,0.04)",
            color: STATUS_COLORS[snapshot.status]?.color ?? "#fff",
          }}
          aria-label={`Current risk state ${snapshot.status}`}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[snapshot.status]?.color ?? "#fff" }}
          />
          <span className="font-mono uppercase tracking-wider">{snapshot.status}</span>
        </div>
      )}
    </Panel>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "rose" | "gold";
}) {
  const toneClass =
    tone === "emerald" ? "text-mtqs-emerald" : tone === "rose" ? "text-mtqs-rose" : "text-mtqs-gold";
  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.03] p-2.5">
      <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">{label}</div>
      <div className={`mt-1 font-mono tabular-nums text-sm font-semibold ${toneClass}`}>
        {value}
      </div>
    </div>
  );
}
