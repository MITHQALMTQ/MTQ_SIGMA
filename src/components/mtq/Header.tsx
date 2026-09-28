// MTQΣ — Premium PAR1D Header (UI-REDESIGN)
// Sticky glassmorphic header with the PAR1D emblem, gold-gradient wordmark,
// tagline, and a color-coded live status pill. Below it sits the live ticker
// strip (GFB / MTQ / NAV / RR / LCR / STATUS / BUFFER / ORACLE) — preserved
// verbatim from the prior implementation so the data layer is untouched.
//
// Design language: deeper glass (backdrop-blur-xl), gold gradient bottom
// border, status pill colored by STATUS_COLORS (brand.ts). No blue/indigo.

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
  const statusTone =
    status === "NORMAL"
      ? "emerald"
      : status === "CAUTION" || status === "RECOVERY"
      ? "amber"
      : "rose";
  const statusPillStyle: React.CSSProperties = {
    color: scBrand.color,
    borderColor: `${scBrand.color}55`,
    background: `${scBrand.color}14`,
  };

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-[#06080F]/70 saturate-150"
      role="banner"
    >
      {/* Gold gradient bottom border */}
      <div
        className="absolute inset-x-0 -bottom-px h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(240,185,11,0.55) 20%, rgba(255,244,212,0.85) 50%, rgba(240,185,11,0.55) 80%, transparent 100%)",
        }}
        aria-hidden="true"
      />
      {/* Subtle inner glow line (1px gold halo above the border) */}
      <div
        className="absolute inset-x-0 top-full h-8 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(240,185,11,0.10), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 py-3">
        {/* Left — PAR1D emblem + wordmark + tagline */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="relative h-10 w-10 sm:h-11 sm:w-11 shrink-0 rounded-lg overflow-hidden bg-black mtqs-logo-container"
            style={{
              boxShadow:
                "0 0 0 1px rgba(240,185,11,0.30), 0 0 18px rgba(240,185,11,0.22)",
            }}
            aria-label="MTQΣ logo mark"
          >
            <Image
              src={BRAND_ASSETS.logoCanonical}
              alt="MTQΣ official logo — luxury hexagonal Σ emblem with gold on obsidian"
              fill
              sizes="44px"
              className="object-contain mtqs-logo-image"
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className="mtqs-display mtqs-gold-gradient-text text-xl sm:text-2xl font-semibold leading-none"
                style={{ fontWeight: 600 }}
              >
                MTQΣ
              </span>
              <Pill tone="gold" className="font-mono tabular-nums hidden sm:inline-flex">
                Σ-v1.2
              </Pill>
            </div>
            <span className="text-[0.62rem] sm:text-[0.66rem] tracking-[0.18em] uppercase text-white/55 truncate">
              {BRAND_VOICE.tagline}
            </span>
          </div>

          {error ? (
            <Pill tone="rose" className="hidden lg:inline-flex ml-2">feed error</Pill>
          ) : null}
        </div>

        {/* Right — live status pill + Network Selector */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className="mtqs-status-pill hidden sm:inline-flex"
            style={statusPillStyle}
            aria-label={`Protocol status: ${scBrand.label}`}
          >
            <GlowDot color={statusTone === "emerald" ? "emerald" : statusTone === "amber" ? "amber" : "rose"} size="h-1.5 w-1.5" />
            <span>{scBrand.label}</span>
          </div>
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
            <div key={i} className="h-3 w-32 animate-pulse rounded bg-white/[0.04]" />
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
