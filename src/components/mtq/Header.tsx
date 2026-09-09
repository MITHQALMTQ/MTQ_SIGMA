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
  oracleValidCount: number;
  oracleTotalCount: number;
  oracleAnyPaused: boolean;
  error: string | null;
}) {
  const status = snapshot?.status ?? "NORMAL";
  const sc = statusColor(status);
  const scBrand = STATUS_COLORS[status] ?? STATUS_COLORS.NORMAL;

  return (
    <header
      className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-xl"
      role="banner"
    >
      <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-mtqs-gold/40 to-transparent" />
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3">
        {/* Left — logo-mark + wordmark + tagline */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {/* Logo-mark — the Σ-gold-ingot */}
          <div className="relative h-9 w-9 sm:h-11 sm:w-11 shrink-0 mtqs-glow rounded-md overflow-hidden">
            <Image
              src={BRAND_ASSETS.logoMark}
              alt="MTQΣ logo mark — a faceted gold ingot sculpted as the Greek sigma"
              fill
              sizes="44px"
              className="object-contain"
              priority
            />
          </div>
          {/* Wordmark + tagline stack */}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className="mtqs-display mtqs-gold-text text-xl sm:text-2xl font-semibold leading-none"
                aria-label="MTQ Sigma"
              >
                MTQΣ
              </span>
              <span
                className="hidden sm:inline text-[0.6rem] uppercase tracking-[0.25em] text-mtqs-gold/70"
                aria-hidden="true"
              >
                Global Purchasing Power Unit
              </span>
            </div>
            <p className="truncate text-[0.65rem] sm:text-[0.7rem] text-muted-foreground tracking-[0.08em] mt-0.5">
              {BRAND_VOICE.tagline} · Closed-Loop Monetary Architecture
            </p>
          </div>
        </div>

        {/* Right — status + version + badges */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Oracle indicator */}
          <div
            className={`hidden md:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] ${
              oracleAnyPaused
                ? "border-mtqs-rose/40 bg-mtqs-rose/10 text-mtqs-rose"
                : "border-mtqs-emerald/30 bg-mtqs-emerald/10 text-mtqs-emerald"
            }`}
            title={oracleAnyPaused ? "Oracle consensus paused (§9.3)" : `${oracleValidCount} of ${oracleTotalCount} oracle feeds valid`}
            aria-label={oracleAnyPaused ? "Oracle paused" : `Oracle ${oracleValidCount} of ${oracleTotalCount} feeds valid`}
          >
            <GlowDot color={oracleAnyPaused ? "rose" : "emerald"} size="h-1.5 w-1.5" />
            <span className="font-mono tabular-nums">
              {oracleAnyPaused ? "ORACLE PAUSED" : `ORACLE ${oracleValidCount}/${oracleTotalCount}`}
            </span>
          </div>

          {/* Status pill — brand STATUS_COLORS */}
          <div
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem]"
            style={{
              color: scBrand.color,
              backgroundColor: scBrand.bg,
              borderColor: `${scBrand.color}55`,
            }}
            aria-label={`Protocol status: ${scBrand.label}`}
          >
            <GlowDot
              color={
                status === "NORMAL"
                  ? "emerald"
                  : status === "CAUTION"
                  ? "amber"
                  : status === "DEFENSIVE"
                  ? "rose"
                  : status === "EMERGENCY"
                  ? "rose"
                  : "gold"
              }
              size="h-1.5 w-1.5"
            />
            <span className="font-mono tabular-nums tracking-wider">{scBrand.label}</span>
          </div>

          {/* Version + honest badge */}
          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <Pill tone="gold" className="font-mono tabular-nums">Σ-v1.2</Pill>
              <GlowDot color="gold" size="h-2 w-2" />
            </div>
            <span className="text-[0.6rem] text-muted-foreground tracking-wide">
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
        className="sticky top-[57px] sm:top-[69px] z-40 border-b border-border bg-card/90 backdrop-blur"
        aria-hidden="true"
      >
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-4 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-3 w-32 animate-pulse rounded bg-black/[0.04]" />
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
        <TickNumber value={snapshot.mtqPrice} format={(n) => `$${fmtFixed(n, 4)}`} className={toneByPrice === "emerald" ? "text-mtqs-emerald" : "text-mtqs-rose"} />
        <span className={`text-[0.6rem] ${snapshot.priceInBand ? "text-mtqs-emerald/70" : "text-mtqs-rose/80"}`}>
          {snapshot.priceInBand ? "in-band" : "BREAKER"}
        </span>
      </span>
    ), toneByPrice),
    tickerItem("NAV", <TickNumber value={snapshot.nav} format={fmtUsdCompact} />, "default"),
    tickerItem("RR", <span className={toneByRr === "emerald" ? "text-mtqs-emerald" : toneByRr === "amber" ? "text-mtqs-amber" : "text-mtqs-rose"}>{rrTxt}</span>, toneByRr),
    tickerItem("LCR", <span className={toneByLcr === "emerald" ? "text-mtqs-emerald" : "text-mtqs-amber"}>{lcrTxt}</span>, toneByLcr),
    tickerItem("STATUS", <span className="uppercase tracking-wider text-foreground/90">{snapshot.status}</span>, "default"),
    tickerItem("BUFFER", <span className="text-mtqs-gold">{snapshot.bufferState}</span>, "gold"),
    tickerItem("ORACLE", <span className={snapshot.oraclePaused ? "text-mtqs-rose" : "text-mtqs-emerald"}>{oracleText}</span>, snapshot.oraclePaused ? "rose" : "emerald"),
  ];

  return (
    <div
      className="sticky top-[57px] sm:top-[69px] z-40 border-b border-border bg-card/92 backdrop-blur"
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
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 border-r border-border last:border-r-0 shrink-0"
            >
              <span className="text-[0.55rem] sm:text-[0.6rem] uppercase tracking-[0.18em] sm:tracking-[0.22em] text-muted-foreground whitespace-nowrap">
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
