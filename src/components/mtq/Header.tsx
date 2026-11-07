// MTQΣ — Header (fresh light redesign)
// Clean sticky white header with the coin-badge BrandMark, ink wordmark,
// tagline, and a color-coded live status pill. Below it sits the live
// ticker strip (GFB / MTQ / NAV / RR / LCR / STATUS / BUFFER / ORACLE) —
// preserved verbatim from the prior implementation so the data layer is untouched.
//
// Design language: fresh light — white surface, hairline border, soft shadow.

"use client";

import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
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
      /* F-57: sticky pinning moved to the single wrapper in PCC — this
         element is now a plain flow child (its old `sticky top-7 z-50`
         is owned by the wrapper, which can never mis-stack).
         F-59: bg-white/95 → bg-white — the 5% translucency let page
         content bleed through the pinned header as faint ghost text
         (VLM-flagged); opaque is also cheaper (no per-frame compositing
         of the tall content beneath). */
      className="border-b border-[#E3EAE6] bg-white shadow-[0_1px_12px_rgba(14,31,27,0.05)]"
      role="banner"
    >

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
            <span className="text-[0.66rem] sm:text-[0.7rem] tracking-[0.14em] uppercase text-[#5B6E68] truncate">
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
              /* TASK-37 R1 — mirrored entry/exit language: this control pairs
                 with the landing's "Launch App" (.lp-btn-launch) so the
                 landing→app→landing loop reads as ONE design language:
                 same teal-on-white tint, same #BEE3DD hairline border, same
                 0.8rem radius, same hover bloom. ArrowLeft (not LogOut —
                 this is a view switch, not a session end). */
              className="hidden sm:inline-flex items-center gap-1.5 rounded-[0.8rem] border border-[#BEE3DD] bg-white px-[1.05rem] h-[2.1rem] text-[0.78rem] font-semibold text-[#0F766E] hover:border-[#0D9488] hover:bg-[#E7F4F1] hover:shadow-[0_2px_10px_rgba(13,148,136,0.12)] transition-all"
              aria-label="Back to the landing site"
              title="Back to the landing site"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Back to Landing
            </button>
          ) : null}
          {/* TASK-37 cascade fix: phone-hide is CSS-owned (the unlayered
              .mtqs-status-pill display beat Tailwind's layered
              `hidden sm:inline-flex`, so the pill rendered on phones). */}
          <div
            className="mtqs-status-pill"
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
  tone: "default" | "gold" | "emerald" | "rose" | "amber" = "default",
  /* F-59: responsive disclosure — secondary stats (LCR, BUFFER) hide below
     xl (1280px) so the primary five (GFB · MTQ · NAV · RR · ORACLE) always
     fit without clipping at mid-size windows (the 1143px owner screenshot);
     same progressive-disclosure pattern as the status bar (md/lg gates). */
  visibility: "" | "hidden xl:flex" = ""
) => ({
  label,
  value,
  tone,
  visibility,
});

export function LiveTicker({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  if (!snapshot) {
    return (
      <div
        className="border-b border-[#E3EAE6] mtqs-glass"
        aria-hidden="true"
      >
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-4 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-3 w-32 animate-pulse rounded bg-[#F0F5F2]" />
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

  // TASK-38 / F-38-1: `reserveRatio`/`lcr` arrive as `null` when the engine
  // computes Infinity (JSON.stringify(Infinity) → null) — i.e. zero circulating
  // liability, the FULLY-RESERVED healthiest state. `null >= threshold` is
  // always false in JS, so the previous chain fell through to "rose"/"amber"
  // and rendered "∞ — no liability" in the DANGER color. Guard the non-finite
  // case first and classify it emerald (same convention as every other RR
  // surface: hero pill, QuickStatsRow, sidebar capsule).
  const toneByRr = !Number.isFinite(snapshot.reserveRatio)
    ? "emerald"
    : snapshot.reserveRatio >= 1.1 ? "emerald" : snapshot.reserveRatio >= 1.05 ? "amber" : snapshot.reserveRatio >= 1.0 ? "amber" : "rose";
  const toneByLcr = !Number.isFinite(snapshot.lcr)
    ? "emerald"
    : snapshot.lcr >= 1.0 ? "emerald" : "amber";
  const toneByPrice = snapshot.priceInBand ? "emerald" : "rose";

  const items = [
    tickerItem("GFB", <TickNumber value={snapshot.gfbIndex} format={(n) => fmtFixed(n, 4)} className="text-mtqs-gold" />, "gold"),
    tickerItem("MTQ", (
      <span className="flex items-center gap-1">
        <TickNumber value={snapshot.mtqPrice} format={(n) => fmtFixed(n, 4)} className={toneByPrice === "emerald" ? "text-mtqs-emerald" : "text-mtqs-rose"} />
        <span className={`text-[0.6rem] font-medium ${snapshot.priceInBand ? "text-mtqs-emerald/90" : "text-mtqs-rose/90"}`}>
          {snapshot.priceInBand ? "in-band" : "BREAKER"}
        </span>
      </span>
    ), toneByPrice),
    tickerItem("NAV", <TickNumber value={snapshot.nav} format={fmtUsdCompact} />, "default"),
    tickerItem("RR", <span className={toneByRr === "emerald" ? "text-mtqs-emerald" : toneByRr === "amber" ? "text-mtqs-amber" : "text-mtqs-rose"}>{rrTxt}</span>, toneByRr),
    tickerItem("LCR", <span className={toneByLcr === "emerald" ? "text-mtqs-emerald" : "text-mtqs-amber"}>{lcrTxt}</span>, toneByLcr, "hidden xl:flex"),
    tickerItem("STATUS", <span className="uppercase tracking-wider text-[#0E1F1B]">{snapshot.status}</span>, "default"),
    tickerItem("BUFFER", <span className="text-mtqs-gold">{snapshot.bufferState}</span>, "gold", "hidden xl:flex"),
    tickerItem(
      "ORACLE",
      <span className={snapshot.oracleFailed ? "text-mtqs-rose" : snapshot.oracleDegraded ? "text-mtqs-amber" : "text-mtqs-emerald"}>{oracleText}</span>,
      snapshot.oracleFailed ? "rose" : snapshot.oracleDegraded ? "amber" : "emerald",
    ),
  ];

  return (
    <div
      /* F-57: sticky pinning owned by the PCC wrapper (see task57) — the
         old hardcoded top-[85px]/sm:top-[97px] offsets are the ROOT CAUSE
         of the fuzzy-ticker defect (they assumed a 69px header). */
      className="border-b border-[#E3EAE6] mtqs-glass"
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
              /* F-59: 8-stat row measured 1168px natural vs ~1072px content
                 column at a 1440px viewport → the ORACLE value clipped ~96px
                 (VLM-flagged twice). Adaptive densification: tighter item
                 padding + label tracking + label→value gap reclaim ~108px so
                 the full row fits without wrap at every ≥lg viewport, while
                 overflow-x-auto stays as the mobile escape hatch. Secondary
                 stats (LCR · BUFFER) additionally hide below xl. */
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-2.5 border-r border-[#E3EAE6] last:border-r-0 shrink-0 ${it.visibility}`}
            >
              <span className="text-[0.6rem] sm:text-[0.62rem] uppercase tracking-[0.12em] sm:tracking-[0.14em] font-semibold text-[#5B6E68] whitespace-nowrap">
                {it.label}
              </span>
              <span className="font-mono tabular-nums text-[0.75rem] sm:text-[0.8rem] font-medium whitespace-nowrap">
                {it.value}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
