// MTQΣ — Sticky header + live ticker strip
// Brand: the wordmark "MTQΣ" is rendered in Cormorant Garamond (font-display)
// with the gold ingot logo-mark to its left, the emblem to the right of the
// brand stack, and the tagline + status declaration below. The status pill
// uses STATUS_COLORS (brand.ts) for status-dependent bg/border/label.

"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { GlowDot, Pill, TickNumber } from "./primitives";
import { fmtFixed, fmtUsdCompact, fmtRatio, statusColor } from "./format";
import { BRAND_VOICE, BRAND_ASSETS, STATUS_COLORS } from "@/lib/mtq/brand";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

export function Header({
  snapshot,
  oracleValidCount,
  oracleTotalCount,
  oracleAnyPaused,
  error,
}: {
  snapshot: MetricsSnapshot | null;
  oracleValidCount?: number;
  oracleTotalCount?: number;
  oracleAnyPaused?: boolean;
  error?: string | null;
}) {
  oracleValidCount = oracleValidCount ?? 0;
  oracleTotalCount = oracleTotalCount ?? 0;
  oracleAnyPaused = oracleAnyPaused ?? false;
  error = error ?? null;
  const status = snapshot?.status ?? "NORMAL";
  const sc = statusColor(status);
  const scBrand = STATUS_COLORS[status] ?? STATUS_COLORS.NORMAL;

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/[0.06] bg-transparent/85 backdrop-blur-xl"
      role="banner"
    >
      <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-mtqs-gold/40 to-transparent" />
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3">
        {/* Left — logo-mark + wordmark + tagline */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    {/* Animated Logo-mark — original Σ-gold-ingot with glow + pulsing emerald line */}
          <div className="relative h-9 w-9 sm:h-11 sm:w-11 shrink-0" aria-label="MTQΣ logo mark — animated gold sigma ingot">
            <svg viewBox="0 0 64 64" className="w-full h-full" role="img" aria-label="MTQΣ animated logo">
              <defs>
                <linearGradient id="hdr-gold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#f4d58d"/>
                  <stop offset="0.5" stop-color="#e8b964"/>
                  <stop offset="1" stop-color="#b8861f"/>
                </linearGradient>
                <linearGradient id="hdr-goldEdge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#f9e6b0"/>
                  <stop offset="1" stop-color="#9c6f1a"/>
                </linearGradient>
                <filter id="hdr-glow">
                  <feGaussianBlur stdDeviation="1" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <rect width="64" height="64" rx="14" fill="#06080F"/>
              {/* Subtle rotating glow ring */}
              <g transform="translate(32 32)" opacity="0.12">
                <circle r="24" fill="none" stroke="url(#hdr-gold)" strokeWidth="0.5">
                  <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="10s" repeatCount="indefinite"/>
                </circle>
              </g>
              {/* Original Σ-gold-ingot design with animation */}
              <g transform="translate(12 12)" filter="url(#hdr-glow)">
                <polygon points="4,4 36,4 30,14 10,14" fill="url(#hdr-gold)" stroke="url(#hdr-goldEdge)" strokeWidth="0.8">
                  <animate attributeName="opacity" values="1;0.88;1" dur="3s" repeatCount="indefinite"/>
                </polygon>
                <polygon points="22,16 30,14 20,20 14,20" fill="#d4a84a" stroke="url(#hdr-goldEdge)" strokeWidth="0.6"/>
                <polygon points="22,16 14,20 10,14" fill="#c99a3a" opacity="0.9"/>
                <polygon points="4,36 36,36 30,26 10,26" fill="url(#hdr-gold)" stroke="url(#hdr-goldEdge)" strokeWidth="0.8">
                  <animate attributeName="opacity" values="1;0.88;1" dur="3s" begin="1.5s" repeatCount="indefinite"/>
                </polygon>
                <polygon points="22,24 30,26 20,20 14,20" fill="#d4a84a" stroke="url(#hdr-goldEdge)" strokeWidth="0.6"/>
                <polygon points="22,24 14,20 10,26 18,26" fill="#b8861f" opacity="0.95"/>
                {/* Pulsing emerald solvency line */}
                <rect x="14" y="38" width="12" height="1.6" rx="0.8" fill="#00D68F">
                  <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="width" values="12;14;12" dur="2s" repeatCount="indefinite"/>
                </rect>
              </g>
            </svg>
          </div>
          {/* Version + honest badge */}
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <Pill tone="gold" className="font-mono tabular-nums">Σ-v1.2</Pill>
              <GlowDot color="gold" size="h-2 w-2" />
            </div>
            <span className="text-[0.6rem] text-white/55 tracking-wide">
              {BRAND_VOICE.statusDeclaration}
            </span>
          </div>

          {/* Error pill */}
          {error ? (
            <Pill tone="rose" className="hidden lg:inline-flex">feed error</Pill>
          ) : null}
        </div>
      </div>
    </header>
  );
}

/* ---------- Live ticker strip ---------- */
const tickerItem = (
  label: string,
  value: React.ReactNode,
  tone: "default" | "gold" | "emerald" | "rose" | "amber" = "default"
) => ({
  label,
  value,
  tone,
});

export function LiveTicker({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  if (!snapshot) {
    return (
      <div
        className="sticky top-[57px] sm:top-[69px] z-40 border-b border-white/[0.06] mtqs-glass backdrop-blur"
        aria-hidden="true"
      >
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-4 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-3 w-32 animate-pulse rounded bg-white/[0.03]/[0.04]" />
          ))}
        </div>
      </div>
    );
  }

  const rrTxt = Number.isFinite(snapshot.reserveRatio)
    ? fmtRatio(snapshot.reserveRatio)
    : "∞ — fully reserved";
  const lcrTxt = Number.isFinite(snapshot.lcr)
    ? fmtRatio(snapshot.lcr)
    : "∞ — fully reserved";
  const oracleText = snapshot.oraclePaused
    ? "PAUSED"
    : `${snapshot.oracle?.pairs.filter((p) => !p.paused).length ?? 0}/${snapshot.oracle?.pairs.length ?? 0}`;

  const toneByRr = snapshot.reserveRatio >= 1.1 ? "emerald" : snapshot.reserveRatio >= 1.05 ? "amber" : snapshot.reserveRatio >= 1.0 ? "amber" : "rose";
  const toneByLcr = snapshot.lcr >= 1.0 ? "emerald" : "amber";
  const toneByPrice = snapshot.priceInBand ? "emerald" : "rose";

  const items = [
    tickerItem("GFB", <TickNumber value={snapshot.gfbIndex} format={(n) => fmtFixed(n, 4)} className="text-mtqs-gold" />, "gold"),
    tickerItem("MTQ", (
      <span className="flex items-center gap-1">
        <TickNumber value={snapshot.mtqPrice} format={(n) => fmtFixed(n, 4)} className={toneByPrice === "emerald" ? "text-mtqs-emerald" : "text-mtqs-rose"} />
        <span className={`text-[0.6rem] ${snapshot.priceInBand ? "text-mtqs-emerald/70" : "text-mtqs-rose/80"}`}>
          {snapshot.priceInBand ? "in-band" : "BREAKER"}
        </span>
      </span>
    ), toneByPrice),
    tickerItem("NAV", <TickNumber value={snapshot.nav} format={fmtUsdCompact} />, "default"),
    tickerItem("RR", <span className={toneByRr === "emerald" ? "text-mtqs-emerald" : toneByRr === "amber" ? "text-mtqs-amber" : "text-mtqs-rose"}>{rrTxt}</span>, toneByRr),
    tickerItem("LCR", <span className={toneByLcr === "emerald" ? "text-mtqs-emerald" : "text-mtqs-amber"}>{lcrTxt}</span>, toneByLcr),
    tickerItem("STATUS", <span className="uppercase tracking-wider text-white/90">{snapshot.status}</span>, "default"),
    tickerItem("BUFFER", <span className="text-mtqs-gold">{snapshot.bufferState}</span>, "gold"),
    tickerItem("ORACLE", <span className={snapshot.oraclePaused ? "text-mtqs-rose" : "text-mtqs-emerald"}>{oracleText}</span>, snapshot.oraclePaused ? "rose" : "emerald"),
  ];

  return (
    <div
      className="sticky top-[57px] sm:top-[69px] z-40 border-b border-white/[0.06] mtqs-glass backdrop-blur"
      role="region"
      aria-label="Live monetary ticker"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Responsive ticker: horizontal scroll on all sizes, tighter padding on mobile.
            The 8 metrics stay on one line on desktop (≥1024px) and scroll horizontally
            on mobile/tablet. Each item is shrink-0 so the row never wraps (which would
            create uneven height). The mtqs-no-scrollbar class hides the scrollbar for
            a clean look; users can still swipe-scroll on touch. */}
        <div className="flex items-stretch overflow-x-auto mtqs-no-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0">
          {items.map((it, i) => (
            <motion.div
              key={it.label}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03 }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 border-r border-white/[0.06] last:border-r-0 shrink-0"
            >
              <span className="text-[0.55rem] sm:text-[0.6rem] uppercase tracking-[0.18em] sm:tracking-[0.22em] text-white/55 whitespace-nowrap">
                {it.label}
              </span>
              <span className="font-mono tabular-nums text-[0.72rem] sm:text-[0.8rem] font-medium whitespace-nowrap">
                {it.value}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
