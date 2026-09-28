// MTQΣ — Institutional Hero (UI-REDESIGN)
// Breathtaking full-viewport hero. The PAR1D emblem is rendered as a large
// glowing centerpiece with a pulsing gold halo (mtqs-logo-par1d), surrounded
// by a CSS-only gold-dust particle field (mtqs-particle-bg). A massive gold
// gradient wordmark "MTQΣ" anchors the composition, with the Cormorant
// subtitle "The Global Purchasing Power Unit" below.
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
import Image from "next/image";
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
import { STATUS_COLORS, BRAND_ASSETS, BRAND_VOICE } from "@/lib/mtq/brand";
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
      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.62rem] font-mono uppercase tracking-[0.18em] text-white/55 border-b border-white/[0.06] pb-2.5"
      aria-label="Terminal status"
    >
      <span className="inline-flex items-center gap-1.5">
        <GlowDot color={oracleOk ? "emerald" : "rose"} size="h-1.5 w-1.5" />
        <span className="text-white/80">testnet · live</span>
      </span>
      <span className="text-white/20">·</span>
      <span className="inline-flex items-center gap-1.5">
        <GlowDot color={oracleOk ? "emerald" : "rose"} size="h-1.5 w-1.5" />
        <span>
          oracle {oracleValidCount != null && oracleTotal != null ? `${oracleValidCount}/${oracleTotal}` : oracleOk ? "ok" : "paused"}
        </span>
      </span>
      <span className="text-white/20">·</span>
      <span className="inline-flex items-center gap-1.5" style={{ color: sb.color }}>
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: sb.color }}
          aria-hidden="true"
        />
        <span>{sb.label}</span>
      </span>
      <span className="text-white/20 ml-auto hidden sm:inline">·</span>
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
      : "text-white/80 border-white/15 bg-white/[0.04]";
  const dotColor =
    tone === "gold" ? "#F0B90B" : tone === "emerald" ? "#00D68F" : tone === "rose" ? "#FF4D6D" : tone === "amber" ? "#FFB84D" : "#FFFFFF";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[0.7rem] font-mono tabular-nums ${toneCls}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full mtqs-pulse-dot"
        style={{ backgroundColor: dotColor, color: dotColor }}
        aria-hidden="true"
      />
      <span className="uppercase tracking-[0.18em] text-white/55">{label}</span>
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
              "radial-gradient(circle, rgba(240,185,11,0.18) 0%, rgba(240,185,11,0.06) 35%, transparent 70%)",
            filter: "blur(8px)",
          }}
          aria-hidden="true"
        />

        {/* Terminal status strip */}
        <div className="relative p-5 sm:p-7 lg:p-8 pb-0">
          <TerminalStrip snapshot={snapshot} />
        </div>

        {/* Hero centerpiece: PAR1D logo + wordmark + subtitle */}
        <div className="relative px-5 sm:px-7 lg:px-8 pt-6 sm:pt-10 pb-8 sm:pb-12 flex flex-col items-center text-center">
          {/* PAR1D emblem — large, glowing, pulsing */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, filter: "blur(16px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative mb-6"
          >
            <div
              className="relative h-40 w-40 sm:h-52 sm:w-52 lg:h-64 lg:w-64 mtqs-logo-par1d rounded-3xl"
              aria-label="MTQΣ official logo — PAR1D luxury emblem"
            >
              <Image
                src={BRAND_ASSETS.logoCanonical}
                alt="MTQΣ official logo — luxury hexagonal shield emblem with gold Σ on obsidian"
                fill
                sizes="(min-width: 1024px) 256px, (min-width: 640px) 208px, 160px"
                className="object-contain"
                style={{ objectFit: "contain" }}
                priority
              />
            </div>
          </motion.div>

          {/* Massive gold-gradient wordmark */}
          <motion.h1
            initial={{ opacity: 0, y: 12, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="mtqs-display mtqs-gold-gradient-text font-semibold leading-none"
            style={{ fontSize: "clamp(3.5rem, 12vw, 9rem)" }}
          >
            MTQΣ
          </motion.h1>

          {/* Cormorant subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-3 sm:mt-4 mtqs-display italic text-lg sm:text-2xl lg:text-3xl text-amber-100/85 tracking-wide"
          >
            The Global Purchasing Power Unit
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-3 text-[0.82rem] sm:text-[0.9rem] text-white/55 leading-relaxed max-w-2xl"
          >
            A neutral, adaptive global purchasing-power reference unit — defined by
            a transparent methodology spanning eligible currencies and gold, an
            adaptive weighting system, constitutional constraints, reserve
            collateralization, risk controls and auditable execution.
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
              onClick={() => onNavigate("dashboard")}
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
        <div className="relative px-5 sm:px-7 lg:px-8 pb-5 sm:pb-6 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[0.66rem] text-white/45">
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
        className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      >
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
          <div className="mt-1 text-[0.7rem] text-white/55">Chain-linked I<sub>t</sub> · 4s poll</div>
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
          <div className="mt-1 text-[0.7rem] text-white/55">
            {snapshot?.priceInBand ? "in safety band" : "outside band"}
          </div>
        </PremiumCard>

        {/* Reserve NAV */}
        <PremiumCard className="p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-gold/80">
              Reserve NAV
            </span>
          </div>
          {snapshot ? (
            <div className="font-mono tabular-nums text-2xl font-semibold text-white">
              {fmtNum(snapshot.nav, 0)}
            </div>
          ) : (
            <Skeleton className="h-7 w-24" />
          )}
          <div className="mt-1 text-[0.7rem] text-white/55">Liability collateral</div>
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
            <span className="text-[0.7rem] text-white/55 font-mono">basket-unit</span>
          </div>
          <div className="mt-1 text-[0.7rem] text-white/55">Immutable · §18.1</div>
        </PremiumCard>
      </motion.div>

      {/* sr-only landmark */}
      <h2 id="hero-institutional" className="sr-only">
        MTQΣ — Institutional Terminal Overview
      </h2>
    </section>
  );
}
