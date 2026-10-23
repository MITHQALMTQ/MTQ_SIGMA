// MTQΣ — Premium PAR1D Header (UI-REDESIGN · platform-unified)
// Sticky glassmorphic header with the coin-badge BrandMark, cyan-gradient
// wordmark, tagline, and a color-coded live status pill. Below it sits the live
// ticker strip (GFB / MTQ / NAV / RR / LCR / STATUS / BUFFER / ORACLE) —
// preserved verbatim from the prior implementation so the data layer is untouched.
//
// Design language: platform-unified (landing reference) — midnight glass,
// cyan → violet gradient bottom border, status pill colored by STATUS_COLORS.

"use client";

import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { GlowDot, Pill, TickNumber } from "./primitives";
import { fmtFixed, fmtUsdCompact, fmtRatio, statusColor } from "./format";
import { BRAND_VOICE, STATUS_COLORS } from "@/lib/mtq/brand";
import { BrandMark } from "@/components/landing/BrandMark";
import { NetworkSelector } from "./NetworkSelector";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

export function Header({
  snapshot,
  error,
  onExit,
}: {
  snapshot: MetricsSnapshot | null;
  error?: string | null;
  onExit?: () => void;
}) {
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
      className="sticky top-7 z-50 border-b border-white/[0.06] backdrop-blur-xl bg-[#020D1F]/70 saturate-150"
      role="banner"
    >
      {/* Platform cyan→violet gradient bottom border */}
      <div
        className="absolute inset-x-0 -bottom-px h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(43,171,251,0.55) 20%, rgba(141,211,255,0.85) 50%, rgba(43,171,251,0.55) 80%, transparent 100%)",
        }}
        aria-hidden="true"
      />
      {/* Subtle inner glow line (1px cyan halo above the border) */}
      <div
        className="absolute inset-x-0 top-full h-8 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(43,171,251,0.10), transparent)",
        }}
        aria-hidden="true"
      />

      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 pl-14 pr-4 sm:pr-6 md:px-6 lg:px-8 py-3">
        {/* Left — coin-badge BrandMark + wordmark + tagline */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0" role="img" aria-label="MTQΣ logo mark">
            <BrandMark size={42} />
          </span>
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

        {/* Right — landing exit + live status pill + Network Selector */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {onExit ? (
            <button
              onClick={onExit}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[0.72rem] font-medium text-white/60 hover:text-white hover:border-white/25 hover:bg-white/[0.06] transition-colors"
              aria-label="Back to the landing site"
              title="Back to the landing site"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden />
              Landing
            </button>
          ) : null}
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
        className="sticky top-[85px] sm:top-[97px] z-40 border-b border-white/[0.06] mtqs-glass backdrop-blur"
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
    : "∞ — no liability";
  const lcrTxt = Number.isFinite(snapshot.lcr)
    ? fmtRatio(snapshot.lcr)
    : "∞ — no liability";
  // v2.0 §17.7 — three-state oracle display: FAILED (all ops pause) /
  // DEGRADED (mint+rebalance held, redemption OPEN) / NORMAL.
  const oracleText = snapshot.oracleFailed
    ? "FAILED"
    : snapshot.oracleDegraded
      ? `${snapshot.oracle?.pairs.filter((p) => !p.paused).length ?? 0}/${snapshot.oracle?.pairs.length ?? 0} · DEGRADED (redeem open)`
      : `${snapshot.oracle?.pairs.filter((p) => !p.paused).length ?? 0}/${snapshot.oracle?.pairs.length ?? 0} LIVE`;

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
    tickerItem(
      "ORACLE",
      <span className={snapshot.oracleFailed ? "text-mtqs-rose" : snapshot.oracleDegraded ? "text-mtqs-amber" : "text-mtqs-emerald"}>{oracleText}</span>,
      snapshot.oracleFailed ? "rose" : snapshot.oracleDegraded ? "amber" : "emerald",
    ),
  ];

  return (
    <div
      className="sticky top-[85px] sm:top-[97px] z-40 border-b border-white/[0.06] mtqs-glass backdrop-blur"
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
