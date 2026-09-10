// MTQΣ — Closed-Loop Architecture Map
// Animated SVG flow showing the closed loop the blueprint is named for:
//   GFB Index → MTQ Price → Liability ↔ Reserve NAV → Mint/Redeem → back to GFB
// Live values ride along the edges.

"use client";

import { motion } from "framer-motion";
import { fmtFixed, fmtUsdCompact, fmtRatio } from "./format";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

type Node = {
  id: string;
  label: string;
  x: number;
  y: number;
  accent: string;
  glyph: string;
};

const NODES: Record<string, Node> = {
  gfb:   { id: "gfb",   label: "Reference Index",     x: 80,  y: 200, accent: "#e8b964", glyph: "G" },
  price: { id: "price", label: "Reference Value",     x: 320, y: 80,  accent: "#3ddc97", glyph: "P" },
  liab:  { id: "liab",  label: "Liability",      x: 620, y: 200, accent: "#9fb0a3", glyph: "L" },
  nav:   { id: "nav",   label: "Reserve NAV",    x: 320, y: 320, accent: "#f5d27a", glyph: "V" },
  mint:  { id: "mint",  label: "Mint / Redeem",   x: 460, y: 200, accent: "#ff9f43", glyph: "↻" },
};

const EDGES: Array<{ from: string; to: string; label: string; dash?: "fast" | "slow"; reverse?: boolean }> = [
  { from: "gfb",   to: "price", label: "P_MTQ = GFB_t", dash: "fast" },
  { from: "price", to: "liab",  label: "L = S·P_MTQ",   dash: "fast" },
  { from: "liab",  to: "nav",   label: "RR = NAV / L",  dash: "slow" },
  { from: "nav",   to: "mint",  label: "W_target",      dash: "slow" },
  { from: "mint",  to: "price", label: "circuit-break", dash: "fast", reverse: true },
  { from: "gfb",   to: "mint",  label: "index ref",     dash: "slow" },
];

export function ClosedLoopMap({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const edgeValue = (label: string): string => {
    if (!snapshot) return "—";
    if (label === "P_MTQ = GFB_t") return fmtFixed(snapshot.mtqPrice, 4);
    if (label === "L = S·P_MTQ") return fmtUsdCompact(snapshot.liability);
    if (label === "RR = NAV / L")
      return Number.isFinite(snapshot.reserveRatio) ? fmtRatio(snapshot.reserveRatio) : "∞";
    if (label === "W_target") return `${(snapshot.targetGoldWeight * 100).toFixed(2)}%`;
    if (label === "circuit-break") return snapshot.priceInBand ? "in-band" : "BREAKER";
    if (label === "index ref") return fmtFixed(snapshot.gfbIndex, 4);
    return "—";
  };

  const curve = (a: Node, b: Node, reverse?: boolean): string => {
    // small bezier curve between two nodes
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    // perpendicular offset
    const ox = (-dy / len) * 28 * (reverse ? -1 : 1);
    const oy = (dx / len) * 28 * (reverse ? -1 : 1);
    return `M ${a.x} ${a.y} Q ${mx + ox} ${my + oy} ${b.x} ${b.y}`;
  };

  return (
    <div className="w-full overflow-x-auto mtqs-scroll">
      <svg
        viewBox="0 0 700 400"
        preserveAspectRatio="xMidYMid meet"
        className="w-full min-w-[640px] h-auto"
        role="img"
        aria-label="Closed-loop architecture map: Adaptive Reference Basket feeds Reference Value; Reference Value feeds Liability; Liability and Reserve NAV determine the Reserve Ratio; the Mint/Redeem flow feeds back to value, with the Adaptive Reference Basket as the reference."
      >
        <defs>
          <radialGradient id="mtqs-loop-bg" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="rgba(232,185,100,0.06)" />
            <stop offset="100%" stopColor="rgba(232,185,100,0)" />
          </radialGradient>
          <filter id="mtqs-loop-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="700" height="400" fill="url(#mtqs-loop-bg)" />

        {/* Edges */}
        {EDGES.map((e, i) => {
          const a = NODES[e.from];
          const b = NODES[e.to];
          const path = curve(a, b, e.reverse);
          const isFast = e.dash === "fast";
          const midX = (a.x + b.x) / 2 + (e.reverse ? -8 : 8);
          const midY = (a.y + b.y) / 2 - (e.reverse ? -4 : 4);
          return (
            <g key={i}>
              <path
                d={path}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth="1"
              />
              <motion.path
                d={path}
                fill="none"
                stroke={a.accent}
                strokeWidth="1.6"
                strokeLinecap="round"
                className={isFast ? "mtqs-flow-dash" : "mtqs-flow-dash-slow"}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.7 }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
                filter="url(#mtqs-loop-glow)"
              />
              {/* Edge label */}
              <g>
                <rect
                  x={midX - 46}
                  y={midY - 11}
                  width="92"
                  height="22"
                  rx="11"
                  fill="rgba(8, 10, 12, 0.92)"
                  stroke="rgba(232, 185, 100, 0.18)"
                />
                <text
                  x={midX}
                  y={midY + 1}
                  textAnchor="middle"
                  fontSize="9"
                  fill={a.accent}
                  fontFamily="var(--font-geist-mono), monospace"
                  letterSpacing="0.5"
                >
                  {edgeValue(e.label)}
                </text>
                <text
                  x={midX}
                  y={midY + 11}
                  textAnchor="middle"
                  fontSize="6"
                  fill="rgba(255,255,255,0.45)"
                  fontFamily="var(--font-geist-sans), sans-serif"
                  letterSpacing="1.2"
                >
                  {e.label.toUpperCase()}
                </text>
              </g>
            </g>
          );
        })}

        {/* Nodes */}
        {Object.values(NODES).map((n) => (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r="34"
              fill="rgba(8, 10, 12, 0.95)"
              stroke={n.accent}
              strokeWidth="1.5"
              filter="url(#mtqs-loop-glow)"
            />
            <circle cx={n.x} cy={n.y} r="28" fill="none" stroke={n.accent} strokeWidth="0.7" opacity="0.4" />
            <text
              x={n.x}
              y={n.y + 4}
              textAnchor="middle"
              fontSize="18"
              fontFamily="var(--font-geist-mono), monospace"
              fill={n.accent}
              fontWeight="600"
            >
              {n.glyph}
            </text>
            <text
              x={n.x}
              y={n.y + 50}
              textAnchor="middle"
              fontSize="9"
              fill="rgba(255,255,255,0.7)"
              fontFamily="var(--font-geist-sans), sans-serif"
              letterSpacing="2"
            >
              {n.label.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
