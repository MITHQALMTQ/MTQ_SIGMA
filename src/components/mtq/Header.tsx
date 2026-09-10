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
import { NetworkSelector } from "./NetworkSelector";
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
                  <stop offset="0" stop-color="#FCD535"/>
                  <stop offset="0.4" stop-color="#F0B90B"/>
                  <stop offset="0.7" stop-color="#c99700"/>
                  <stop offset="1" stop-color="#9c6f1a"/>
                </linearGradient>
                <linearGradient id="hdr-goldEdge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#FCD535"/>
                  <stop offset="1" stop-color="#9c6f1a"/>
                </linearGradient>
                <filter id="hdr-glow">
                  <feGaussianBlur stdDeviation="0.8" result="blur"/>
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <rect width="64" height="64" rx="14" fill="#06080F"/>
              {/* Hexagonal frame */}
              <polygon points="32,4 56,18 56,46 32,60 8,46 8,18" fill="none" stroke="url(#hdr-gold)" strokeWidth="1" opacity="0.3" filter="url(#hdr-glow)">
                <animate attributeName="opacity" values="0.2;0.4;0.2" dur="4s" repeatCount="indefinite"/>
              </polygon>
              {/* Globe wireframe */}
              <g transform="translate(32 32)" opacity="0.08">
                <circle r="18" fill="none" stroke="#F0B90B" strokeWidth="0.4"/>
                <ellipse rx="18" ry="8" fill="none" stroke="#F0B90B" strokeWidth="0.3"/>
                <ellipse rx="8" ry="18" fill="none" stroke="#F0B90B" strokeWidth="0.3"/>
                <line x1="-18" y1="0" x2="18" y2="0" stroke="#F0B90B" strokeWidth="0.2"/>
                <line x1="0" y1="-18" x2="0" y2="18" stroke="#F0B90B" strokeWidth="0.2"/>
              </g>
              {/* Stylized Z/Sigma */}
              <g transform="translate(32 32)" filter="url(#hdr-glow)">
                <polygon points="-14,-12 14,-12 12,-6 -12,-6" fill="url(#hdr-gold)" stroke="url(#hdr-goldEdge)" strokeWidth="0.5">
                  <animate attributeName="opacity" values="1;0.88;1" dur="3s" repeatCount="indefinite"/>
                </polygon>
                <polygon points="12,-6 14,-12 14,12 12,6" fill="#c99700" stroke="url(#hdr-goldEdge)" strokeWidth="0.4"/>
                <polygon points="12,6 14,12 -14,12 -12,6" fill="url(#hdr-gold)" stroke="url(#hdr-goldEdge)" strokeWidth="0.5">
                  <animate attributeName="opacity" values="1;0.88;1" dur="3s" begin="1.5s" repeatCount="indefinite"/>
                </polygon>
                <polygon points="-14,-12 -12,-6 -12,6 -14,12" fill="#9c6f1a" stroke="url(#hdr-goldEdge)" strokeWidth="0.3"/>
                {/* Central glowing circle */}
                <circle r="3" fill="url(#hdr-gold)" stroke="#FCD535" strokeWidth="0.5">
                  <animate attributeName="r" values="2.8;3.2;2.8" dur="2s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" repeatCount="indefinite"/>
                </circle>
              </g>
              {/* Pulsing emerald solvency line */}
              <line x1="22" y1="54" x2="42" y2="54" stroke="#00D68F" strokeWidth="1" opacity="0.5">
                <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="x1" values="22;24;22" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="x2" values="42;40;42" dur="2s" repeatCount="indefinite"/>
              </line>
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

        {/* Right — Network Selector (§40) */}
        <div className="flex items-center gap-2 shrink-0">
          <NetworkSelector compact={false} />
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
