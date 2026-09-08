// MTQΣ — Reserve Vault (§4 + §8)
// Bespoke layered vault visual: core 100% liability + 10% buffer (§8.3).
// Buffer split by BASE/STRESS/EMERGENCY gold ratio. Per-asset net values.
// Plus the Gold Weight gauge (22-30% bounds, 26.25% base, observed vs target).

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, TickNumber, Pill, MiniBar } from "./primitives";
import { fmtUsd, fmtUsdCompact, fmtPct, fmtFixed } from "./format";
import {
  BUFFER_SIZE,
  CORE_GOLD_WEIGHT,
  BUFFER_GOLD_BASE,
  BUFFER_GOLD_STRESS,
  BUFFER_GOLD_EMERGENCY,
  GOLD_WEIGHT_LOWER,
  GOLD_WEIGHT_UPPER,
  BASE_GOLD_WEIGHT,
} from "@/lib/mtq/blueprint";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

const BUFFER_GOLD: Record<string, number> = {
  BASE: BUFFER_GOLD_BASE,
  STRESS: BUFFER_GOLD_STRESS,
  EMERGENCY: BUFFER_GOLD_EMERGENCY,
};

/* Helper — describe an arc segment of a circle */
function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function VaultDiagram({ snapshot }: { snapshot: MetricsSnapshot }) {
  const r = snapshot.reserve;
  const nav = r.nav;
  const fiatPct = r.fiatNet / Math.max(nav, 1e-9);
  const goldPct = r.goldNet / Math.max(nav, 1e-9);

  // For the layered visual: total reserve ring (gold vs fiat), then inner core/buffer split
  const bufferFrac = 0.10; // 10% buffer
  const coreFrac = 0.90; // 90% core
  const bufferGoldRatio = BUFFER_GOLD[snapshot.bufferState] ?? BUFFER_GOLD_BASE;

  // Per-asset breakdown for legend — gold split into PAXG + XAUT
  const perIssuer = snapshot.perIssuer;
  const assets = [
    { k: "USD", v: r.usdNet, color: "#e8b964", token: "USDC" },
    { k: "EUR", v: r.eurNet, color: "#3ddc97", token: "EURC" },
    { k: "GBP", v: r.gbpNet, color: "#9fb0a3", token: "GBP₿" },
    { k: "JPY", v: r.jpyNet, color: "#c9a05a", token: "JPY₿" },
    { k: "CNY", v: r.cnyNet, color: "#7d9082", token: "CNY₿" },
    { k: "CHF", v: r.chfNet, color: "#7ab8a3", token: "CHF₿" },
    { k: "PAXG", v: perIssuer?.paxgUsd ?? r.goldNet / 2, color: "#f5d27a", token: "PAXG (Paxos)" },
    { k: "XAUT", v: perIssuer?.xautUsd ?? r.goldNet / 2, color: "#e0c068", token: "XAUT (Tether)" },
  ];
  const total = assets.reduce((a, b) => a + b.v, 0) || 1;

  return (
    <svg
      viewBox="0 0 320 320"
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Reserve vault composition diagram: total NAV split into gold vs fiat sectors; inner ring shows core (90%) and buffer (10%) split, with the buffer's gold ratio determined by the current Dynamic Buffer state."
    >
      <defs>
        <radialGradient id="mtqs-vault-bg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="rgba(232, 185, 100, 0.05)" />
          <stop offset="100%" stopColor="rgba(232, 185, 100, 0)" />
        </radialGradient>
        <filter id="mtqs-vault-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <rect width="320" height="320" fill="url(#mtqs-vault-bg)" />

      {/* Outer tick ring */}
      <g className="mtqs-spin-slower" style={{ transformOrigin: "160px 160px" }}>
        {[...Array(48)].map((_, i) => {
          const a = (i / 48) * Math.PI * 2;
          const r1 = 148;
          const r2 = i % 4 === 0 ? 140 : 144;
          return (
            <line
              key={i}
              x1={160 + r1 * Math.cos(a)}
              y1={160 + r1 * Math.sin(a)}
              x2={160 + r2 * Math.cos(a)}
              y2={160 + r2 * Math.sin(a)}
              stroke={i % 4 === 0 ? "rgba(232, 185, 100, 0.35)" : "rgba(232, 185, 100, 0.12)"}
              strokeWidth={i % 4 === 0 ? 1 : 0.5}
            />
          );
        })}
      </g>

      {/* Outer ring: per-asset sectors */}
      <g>
        {(() => {
          let acc = 0;
          return assets.map((a, i) => {
            const frac = a.v / total;
            if (frac <= 0) return null;
            const startDeg = acc * 360;
            const endDeg = (acc + frac) * 360;
            acc += frac;
            const path = arc(160, 160, 130, startDeg, endDeg);
            return (
              <motion.path
                key={a.k}
                d={path}
                fill={a.color}
                fillOpacity={0.32}
                stroke={a.color}
                strokeOpacity={0.6}
                strokeWidth={1}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                style={{ transformOrigin: "160px 160px" }}
              />
            );
          });
        })()}
      </g>

      {/* Middle ring: gold vs fiat summary (gold = darker gold arc) */}
      <circle cx="160" cy="160" r="105" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      <circle
        cx="160"
        cy="160"
        r="105"
        fill="none"
        stroke="#f5d27a"
        strokeWidth="6"
        strokeDasharray={`${goldPct * 2 * Math.PI * 105} ${2 * Math.PI * 105}`}
        strokeLinecap="round"
        transform="rotate(-90 160 160)"
        opacity="0.85"
      />
      <circle
        cx="160"
        cy="160"
        r="105"
        fill="none"
        stroke="#7d9082"
        strokeWidth="6"
        strokeDasharray={`${fiatPct * 2 * Math.PI * 105} ${2 * Math.PI * 105}`}
        strokeDashoffset={`-${goldPct * 2 * Math.PI * 105}`}
        strokeLinecap="round"
        transform="rotate(-90 160 160)"
        opacity="0.5"
      />

      {/* Inner ring: core vs buffer split */}
      <circle cx="160" cy="160" r="78" fill="rgba(8,10,12,0.6)" stroke="rgba(232,185,100,0.18)" />
      {/* Buffer arc — 10% of the inner ring */}
      <motion.path
        d={arc(160, 160, 78, 0, bufferFrac * 360)}
        fill="#3ddc97"
        fillOpacity={0.16}
        stroke="#3ddc97"
        strokeOpacity={0.4}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      />
      <text x="160" y="125" textAnchor="middle" fontSize="8" fill="#3ddc97" fontFamily="var(--font-geist-sans), sans-serif" letterSpacing="1.5">
        BUFFER · {(BUFFER_SIZE * 100).toFixed(0)}%
      </text>
      <text x="160" y="137" textAnchor="middle" fontSize="9" fill="#3ddc97" fontFamily="var(--font-geist-mono), monospace">
        {(bufferGoldRatio * 100).toFixed(1)}% Au
      </text>

      {/* Core label */}
      <text x="160" y="172" textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.7)" fontFamily="var(--font-geist-sans), sans-serif" letterSpacing="1.5">
        CORE · {(coreFrac * 100).toFixed(0)}%
      </text>
      <text x="160" y="184" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.85)" fontFamily="var(--font-geist-mono), monospace">
        {(CORE_GOLD_WEIGHT * 100).toFixed(0)}% Au · {((1 - CORE_GOLD_WEIGHT) * 100).toFixed(0)}% fiat
      </text>

      {/* Center NAV readout */}
      <text x="160" y="208" textAnchor="middle" fontSize="7.5" fill="rgba(232,185,100,0.7)" fontFamily="var(--font-geist-sans), sans-serif" letterSpacing="2">
        NET ASSET VALUE
      </text>
      <text x="160" y="222" textAnchor="middle" fontSize="11" fill="#e8b964" fontFamily="var(--font-geist-mono), monospace" fontWeight="700">
        {fmtUsdCompact(nav)}
      </text>

      {/* Buffer state pill (visual) */}
      <text x="160" y="245" textAnchor="middle" fontSize="9" fill={snapshot.bufferState === "EMERGENCY" ? "#ff5d73" : snapshot.bufferState === "STRESS" ? "#ff9f43" : "#3ddc97"} fontFamily="var(--font-geist-mono), monospace" letterSpacing="2" fontWeight="600">
        {snapshot.bufferState}
      </text>
    </svg>
  );
}

function GoldWeightGauge({ snapshot }: { snapshot: MetricsSnapshot }) {
  const lower = GOLD_WEIGHT_LOWER * 100;
  const upper = GOLD_WEIGHT_UPPER * 100;
  const base = BASE_GOLD_WEIGHT * 100;
  const obs = (snapshot.observedGoldWeight ?? 0) * 100;
  const tgt = (snapshot.targetGoldWeight ?? 0) * 100;
  const range = upper - lower;
  const obsPct = Math.max(0, Math.min(100, ((obs - lower) / range) * 100));
  const tgtPct = Math.max(0, Math.min(100, ((tgt - lower) / range) * 100));
  const basePct = ((base - lower) / range) * 100;
  const stateColor = snapshot.bufferState === "EMERGENCY" ? "bg-rose-400" : snapshot.bufferState === "STRESS" ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground/80">
          Gold Weight (§6.5 + §8)
        </span>
        <span className="text-[0.7rem] text-muted-foreground/70 font-mono">
          bounds {lower.toFixed(0)}–{upper.toFixed(0)}% · base {base.toFixed(2)}%
        </span>
      </div>
      <div className="relative h-10 rounded-md border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        {/* bounds track */}
        <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-amber-400/5 via-emerald-400/5 to-amber-400/5" />
        {/* lower bound zone (red zone below 22%) */}
        <div className="absolute inset-y-0 left-0 w-2 bg-rose-500/15" />
        <div className="absolute inset-y-0 right-0 w-2 bg-rose-500/15" />

        {/* base line */}
        <div className="absolute inset-y-0" style={{ left: `${basePct}%` }}>
          <div className="h-full w-px bg-amber-300/40" />
          <span className="absolute -top-0.5 -translate-x-1/2 text-[0.55rem] text-amber-300/80 font-mono">base</span>
        </div>

        {/* observed marker */}
        <motion.div
          className="absolute inset-y-0"
          initial={{ left: "0%" }}
          animate={{ left: `${obsPct}%` }}
          transition={{ duration: 0.6 }}
        >
          <div className={`h-full w-1.5 ${stateColor} rounded-sm`} />
          <div className="absolute -top-0 -translate-x-1/2 -translate-y-full mtqs-glow">
            <div className={`text-[0.6rem] font-mono font-semibold ${snapshot.bufferState === "EMERGENCY" ? "text-rose-300" : snapshot.bufferState === "STRESS" ? "text-amber-300" : "text-emerald-300"} whitespace-nowrap`}>
              obs {obs.toFixed(2)}%
            </div>
          </div>
        </motion.div>

        {/* target marker */}
        <motion.div
          className="absolute inset-y-0"
          initial={{ left: "0%" }}
          animate={{ left: `${tgtPct}%` }}
          transition={{ duration: 0.6 }}
        >
          <div className="h-full w-px bg-amber-300" />
          <div className="absolute bottom-0 -translate-x-1/2 translate-y-full">
            <div className="text-[0.6rem] font-mono font-semibold text-amber-200 whitespace-nowrap">tgt {tgt.toFixed(2)}%</div>
          </div>
        </motion.div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-[0.7rem] text-muted-foreground/80">
        <span>observed <span className="font-mono text-amber-200">{obs.toFixed(2)}%</span></span>
        <span>target <span className="font-mono text-amber-200">{tgt.toFixed(2)}%</span></span>
        <span>buffer-state <Pill tone={snapshot.bufferState === "EMERGENCY" ? "rose" : snapshot.bufferState === "STRESS" ? "amber" : "emerald"}>{snapshot.bufferState}</Pill></span>
        <span>buffer Au <span className="font-mono text-amber-200">{(snapshot.bufferGoldRatio * 100).toFixed(2)}%</span></span>
      </div>
      <p className="mt-2 text-[0.7rem] text-muted-foreground/70 leading-relaxed">
        Total target gold weight formula: <span className="font-mono text-amber-200">W_target = clamp(0.20 + 0.10·B_gold(RR) + θ_smoothed, 22%, 30%)</span>
      </p>
    </div>
  );
}

export function ReserveVault({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  if (!snapshot) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="aspect-square animate-pulse rounded-lg bg-white/[0.03]" />
        <div className="h-48 animate-pulse rounded-lg bg-white/[0.03]" />
      </div>
    );
  }
  const r = snapshot.reserve;
  const perIssuer = snapshot.perIssuer;
  const assets = [
    { k: "USD", v: r.usdNet, color: "#e8b964", token: "USDC" },
    { k: "EUR", v: r.eurNet, color: "#3ddc97", token: "EURC" },
    { k: "GBP", v: r.gbpNet, color: "#9fb0a3", token: "GBP₿" },
    { k: "JPY", v: r.jpyNet, color: "#c9a05a", token: "JPY₿" },
    { k: "CNY", v: r.cnyNet, color: "#7d9082", token: "CNY₿" },
    { k: "CHF", v: r.chfNet, color: "#7ab8a3", token: "CHF₿" },
    { k: "PAXG", v: perIssuer?.paxgUsd ?? r.goldNet / 2, color: "#f5d27a", token: "PAXG (Paxos)" },
    { k: "XAUT", v: perIssuer?.xautUsd ?? r.goldNet / 2, color: "#e0c068", token: "XAUT (Tether)" },
  ];
  const total = assets.reduce((a, b) => a + b.v, 0) || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground/80">Vault Composition</span>
            <Pill tone="gold">§4 + §8.3</Pill>
          </div>
          <VaultDiagram snapshot={snapshot} />
        </Panel>
      </Reveal>

      <div className="space-y-4">
        <Reveal delay={0.05}>
          <Panel className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground/80">Per-Asset Net Values</span>
              <span className="text-[0.7rem] text-muted-foreground/70 font-mono">after haircut</span>
            </div>
            <div className="space-y-2.5">
              {assets.map((a, i) => (
                <div key={a.k} className="flex items-center gap-3">
                  <span className="w-12 font-mono text-sm font-semibold text-foreground/90">{a.k}</span>
                  <div className="flex-1">
                    <MiniBar
                      value={a.v}
                      max={total}
                      colorClass=""
                      height="h-2"
                    />
                  </div>
                  <span className="w-20 text-right text-[0.7rem] font-mono text-amber-200">
                    {fmtUsdCompact(a.v)}
                  </span>
                  <span className="w-10 text-right text-[0.65rem] font-mono text-muted-foreground/70">
                    {((a.v / total) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>

        <Reveal delay={0.1}>
          <Panel className="p-5">
            <GoldWeightGauge snapshot={snapshot} />
          </Panel>
        </Reveal>
      </div>
    </div>
  );
}
