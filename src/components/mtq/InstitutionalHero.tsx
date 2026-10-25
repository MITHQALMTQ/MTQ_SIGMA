// MTQΣ — Institutional Hero (UI-REDESIGN)
// Breathtaking full-viewport hero. The PAR1D emblem is rendered as a large
// glowing centerpiece with a pulsing gold halo (mtqs-logo-par1d), surrounded
// by a CSS-only gold-dust particle field (mtqs-particle-bg). A massive gold
// gradient wordmark "MTQΣ" anchors the composition, with the Cormorant
// subtitle "The Global Digital Asset" below.
//
// Live status pills (RR, NAV, Status, VIX, DXY) are derived from the
// /api/metrics snapshot. Two CTAs ("Explore the Protocol" + "View Dashboard")
// drive section navigation via onNavigate.
//
// The previous "institutional terminal" data block (Reference Value, Par,
// clickable metric chips) is preserved as a compact "Protocol Snapshot"
// panel directly under the hero band — same data, more elegant surface.
//
// All existing prop contracts (snapshot, onNavigate) and the SectionId type
// are preserved.

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Activity,
  Sparkles,
  LayoutDashboard,
} from "lucide-react";
import {
  GlowDot,
  Skeleton,
  PremiumCard,
} from "./primitives";
import { fmtFixed, fmtRatio, fmtNum, fmtTime, fmtUsdCompact } from "./format";
import { STATUS_COLORS, BRAND_VOICE } from "@/lib/mtq/brand";
import { BrandMark } from "@/components/landing/BrandMark";
import { PAR } from "@/lib/mtq/blueprint";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { SectionId } from "./Navigation";

/* ---------- Terminal status strip (live + clock) ---------- */
function TerminalStrip({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const status = snapshot?.status ?? "NORMAL";
  const sb = STATUS_COLORS[status] ?? STATUS_COLORS.NORMAL;
  const oracleOk = snapshot ? !snapshot.oraclePaused : true;
  const oracleValidCount = snapshot?.oracle?.pairs.filter((p) => !p.paused).length ?? null;
  const oracleTotal = snapshot?.oracle?.pairs.length ?? null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.62rem] font-mono uppercase tracking-[0.18em] text-[#5B6E68] border-b border-[#E3EAE6] pb-2.5"
      aria-label="Terminal status"
    >
      <span className="inline-flex items-center gap-1.5">
        <GlowDot color={oracleOk ? "emerald" : "rose"} size="h-1.5 w-1.5" />
        <span className="text-[#0E1F1B]">testnet · live</span>
      </span>
      <span className="text-[#9AA9A3]">·</span>
      <span className="inline-flex items-center gap-1.5">
        <GlowDot color={oracleOk ? "emerald" : "rose"} size="h-1.5 w-1.5" />
        <span>
          oracle {oracleValidCount != null && oracleTotal != null ? `${oracleValidCount}/${oracleTotal}` : oracleOk ? "ok" : "paused"}
        </span>
      </span>
      <span className="text-[#9AA9A3]">·</span>
      <span className="inline-flex items-center gap-1.5" style={{ color: sb.color }}>
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: sb.color }}
          aria-hidden="true"
        />
        <span>{sb.label}</span>
      </span>
      <span className="text-[#9AA9A3] ml-auto hidden sm:inline">·</span>
      <span className="ml-auto sm:ml-0 inline-flex items-center gap-1.5 tabular-nums">
        <Clock className="h-3 w-3" aria-hidden="true" />
        <span>{now != null ? fmtTime(now) : "—"}</span>
      </span>
    </div>
  );
}

/* ---------- Live status pill (small, used in the pill row) ---------- */
function LivePill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "gold" | "emerald" | "rose" | "amber" | "neutral";
}) {
  const toneCls =
    tone === "gold"
      ? "text-mtqs-gold border-mtqs-gold/30 bg-mtqs-gold/[0.08]"
      : tone === "emerald"
      ? "text-mtqs-emerald border-mtqs-emerald/30 bg-mtqs-emerald/[0.08]"
      : tone === "rose"
      ? "text-mtqs-rose border-mtqs-rose/30 bg-mtqs-rose/[0.08]"
      : tone === "amber"
      ? "text-mtqs-amber border-mtqs-amber/30 bg-mtqs-amber/[0.08]"
      : "text-[#0E1F1B] border-[#E3EAE6] bg-[#F7FAF8]";
  const dotColor =
    tone === "gold" ? "#0D9488" : tone === "emerald" ? "#14B8A6" : tone === "rose" ? "#E11D48" : tone === "amber" ? "#D97706" : "#5B6E68";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.7rem] font-mono tabular-nums ${toneCls}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full mtqs-pulse-dot"
        style={{ backgroundColor: dotColor, color: dotColor }}
        aria-hidden="true"
      />
      <span className="uppercase tracking-[0.18em] text-[#5B6E68]">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

/* ---------- Main breathtaking hero ---------- */
export function InstitutionalHero({
  snapshot,
  onNavigate,
}: {
  snapshot: MetricsSnapshot | null;
  onNavigate: (id: SectionId) => void;
}) {
  // Snapshot-derived metrics for the live status pills
  const rrTxt =
    snapshot && Number.isFinite(snapshot.reserveRatio)
      ? fmtRatio(snapshot.reserveRatio)
      : "∞";
  const rrTone: "emerald" | "amber" | "rose" =
    !snapshot || !Number.isFinite(snapshot.reserveRatio)
      ? "emerald"
      : snapshot.reserveRatio >= 1.1
      ? "emerald"
      : snapshot.reserveRatio >= 1.05
      ? "amber"
      : "rose";

  const navTxt = snapshot ? fmtUsdCompact(snapshot.nav) : "—";
  const status = snapshot?.status ?? "NORMAL";
  const sb = STATUS_COLORS[status] ?? STATUS_COLORS.NORMAL;
  const statusTone: "gold" | "emerald" | "rose" | "amber" =
    status === "NORMAL"
      ? "emerald"
      : status === "CAUTION" || status === "RECOVERY"
      ? "amber"
      : "rose";

  const vixTxt = snapshot?.macro?.vix != null ? fmtFixed(snapshot.macro.vix, 2) : "—";
  const vixTone: "gold" | "emerald" | "rose" | "amber" =
    !snapshot?.macro?.vix
      ? "gold"
      : snapshot.macro.vix < 18
      ? "emerald"
      : snapshot.macro.vix < 25
      ? "amber"
      : "rose";

  const dxyTxt = snapshot?.macro?.dxy != null ? fmtFixed(snapshot.macro.dxy, 2) : "—";
  const dxyTone: "gold" | "emerald" | "rose" | "amber" =
    !snapshot?.macro?.dxy
      ? "gold"
      : snapshot.macro.dxy < 100
      ? "emerald"
      : snapshot.macro.dxy < 108
      ? "amber"
      : "rose";

  const gfbIndex = snapshot ? fmtFixed(snapshot.gfbIndex, 4) : null;

  return (
    <section
      aria-labelledby="hero-institutional"
      className="relative"
    >
      {/* ===== Breathtaking full-viewport hero band ===== */}
      <div className="relative overflow-hidden rounded-2xl mtqs-glass-premium mtqs-hero-bg mtqs-particle-bg">
        {/* Pulsing radial glow behind the logo */}
        <div
          className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(13,148,136,0.14) 0%, rgba(13,148,136,0.05) 35%, transparent 70%)",
            filter: "blur(8px)",
          }}
          aria-hidden="true"
        />

        {/* Terminal status strip */}
        <div className="relative p-5 sm:p-7 lg:p-8 pb-0">
          <TerminalStrip snapshot={snapshot} />
        </div>

        {/* Hero centerpiece: brand emblem + wordmark + subtitle */}
        <div className="relative px-5 sm:px-7 lg:px-8 pt-6 sm:pt-10 pb-8 sm:pb-12 flex flex-col items-center text-center">
          {/* Coin-badge BrandMark — large, glowing, platform-unified */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, filter: "blur(16px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-6"
          >
            <span
              role="img"
              aria-label="MTQΣ official logo — coin-badge emblem with faceted M and cyan-violet neon ring"
              className="mtqs-logo-par1d"
            >
              <BrandMark size={224} glow />
            </span>
          </motion.div>

          {/* Massive cyan-gradient wordmark */}
          <motion.h1
            initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="mtqs-display mtqs-gold-gradient-text font-semibold leading-none"
            style={{ fontSize: "clamp(3.5rem, 12vw, 9rem)" }}
          >
            MTQΣ
          </motion.h1>

          {/* Montserrat subtitle (brand board primary font) */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-3 sm:mt-4 mtqs-display text-lg sm:text-2xl lg:text-3xl text-amber-700 tracking-[0.08em] uppercase"
          >
            The Global Digital Asset
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-2 text-[0.72rem] sm:text-[0.8rem] text-[#7A8C86] tracking-[0.22em] uppercase"
          >
            Asset-Referencing Basket · No-Conventional-Reserve Design · Transparent Methodology
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-3 text-[0.82rem] sm:text-[0.9rem] text-[#5B6E68] leading-relaxed max-w-2xl"
          >
            A neutral, adaptive global purchasing-power reference unit — defined by
            a transparent methodology spanning eligible currencies and gold, an
            adaptive weighting system, constitutional constraints, oracle risk
            controls and auditable execution.
          </motion.p>

          {/* CTA row */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <button
              type="button"
              onClick={() => onNavigate("reference")}
              className="mtqs-cta-gold"
              aria-label="Explore the Protocol — open the Reference section"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Explore the Protocol
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate("portfolio")}
              className="mtqs-cta-outline"
              aria-label="View Dashboard — open the Dashboard section"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              View Dashboard
            </button>
          </motion.div>

          {/* Live status pills: RR, NAV, Status, VIX, DXY */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3"
          >
            <LivePill label="RR" value={rrTxt} tone={rrTone} />
            <LivePill label="NAV" value={navTxt} tone="gold" />
            <LivePill label="Status" value={sb.label} tone={statusTone} />
            <LivePill label="VIX" value={vixTxt} tone={vixTone} />
            <LivePill label="DXY" value={dxyTxt} tone={dxyTone} />
          </motion.div>
        </div>

        {/* Footer disclaimer — institutional tone */}
        <div className="relative px-5 sm:px-7 lg:px-8 pb-5 sm:pb-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#E3EAE6] pt-3 text-[0.66rem] text-[#7A8C86]">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-mtqs-gold/70" aria-hidden="true" />
            {BRAND_VOICE.statusDeclaration}
          </span>
          <span className="font-mono">
            v1.0 · reference engine · {snapshot ? `t ${Math.floor((snapshot.fetchedAt ?? Date.now()) / 1000)}` : "—"}
          </span>
        </div>
      </div>

      {/* ===== Compact Protocol Snapshot — preserves the prior data panel ===== */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
      >
        {/* Gold Anchor — the constitutional anchor quote (grams per MTQΣ) */}
        <PremiumCard className="p-4" style={{ borderColor: "rgba(13,148,136,0.25)" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <span aria-hidden="true" className="text-sm">🥇</span>
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-gold/80">
              Gold Anchor
            </span>
          </div>
          {snapshot?.holdings ? (
            <div className="font-mono tabular-nums text-2xl font-semibold mtqs-gold-gradient-text">
              {snapshot.holdings.perMtq.goldGrams >= 1
                ? `${snapshot.holdings.perMtq.goldGrams.toFixed(4)} g`
                : `${(snapshot.holdings.perMtq.goldGrams * 1000).toFixed(4)} mg`}
            </div>
          ) : (
            <Skeleton className="h-7 w-24" />
          )}
          <div className="mt-1 text-[0.7rem] text-[#5B6E68]">of gold / MTQΣ · pilot-ledger reference (simulated · legacy v1/v2)</div>
        </PremiumCard>

        {/* Reference Index */}
        <PremiumCard className="p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-gold/80">
              Reference Index
            </span>
          </div>
          {gfbIndex ? (
            <div className="font-mono tabular-nums text-2xl font-semibold mtqs-gold-gradient-text">
              {gfbIndex}
            </div>
          ) : (
            <Skeleton className="h-7 w-24" />
          )}
          <div className="mt-1 text-[0.7rem] text-[#5B6E68]">Chain-linked I<sub>t</sub> · 4s poll</div>
        </PremiumCard>

        {/* Reference Value */}
        <PremiumCard className="p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <GlowDot color="emerald" size="h-1.5 w-1.5" />
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-emerald/80">
              Reference Value
            </span>
          </div>
          {snapshot ? (
            <div
              className={`font-mono tabular-nums text-2xl font-semibold ${
                snapshot.priceInBand ? "text-mtqs-emerald" : "text-mtqs-rose"
              }`}
            >
              {fmtFixed(snapshot.mtqPrice, 4)}
            </div>
          ) : (
            <Skeleton className="h-7 w-24" />
          )}
          <div className="mt-1 text-[0.7rem] text-[#5B6E68]">
            {snapshot?.priceInBand ? "in safety band" : "outside band"}
          </div>
        </PremiumCard>

        {/* Pilot Ledger NAV (legacy v1/v2 reserve-path accounting) */}
        <PremiumCard className="p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-gold/80">
              Pilot Ledger NAV
            </span>
          </div>
          {snapshot ? (
            <div className="font-mono tabular-nums text-2xl font-semibold text-[#0E1F1B]">
              {fmtNum(snapshot.nav, 0)}
            </div>
          ) : (
            <Skeleton className="h-7 w-24" />
          )}
          <div className="mt-1 text-[0.7rem] text-[#5B6E68]">legacy v1/v2 reserve-path accounting</div>
        </PremiumCard>

        {/* Par */}
        <PremiumCard className="p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <GlowDot color="emerald" size="h-1.5 w-1.5" />
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-emerald/80">
              Par
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono tabular-nums text-2xl font-semibold text-mtqs-emerald">
              {fmtFixed(PAR, 2)}
            </span>
            <span className="text-[0.7rem] text-[#5B6E68] font-mono">basket-unit</span>
          </div>
          <div className="mt-1 text-[0.7rem] text-[#5B6E68]">Immutable · §18.1</div>
        </PremiumCard>
      </motion.div>

      {/* sr-only landmark */}
      <h2 id="hero-institutional" className="sr-only">
        MTQΣ — Institutional Terminal Overview
      </h2>
    </section>
  );
}
