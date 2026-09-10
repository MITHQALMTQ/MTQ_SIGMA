// MTQΣ — Institutional Hero (§8-9)
// Replaces the cinematic marketing hero with an institutional terminal overview.
// Design language: deep-space glassmorphic, gold/emerald/rose accents, tabular
// numerals, "Reference Value" (NOT "MTQ Price"), no USD-peg language, no "$X".
//
// Layout (top to bottom):
//   1. Terminal status strip (live / oracle / clock)
//   2. Wordmark "MTQΣ" (display) + subheadline + supporting paragraph
//   3. Three CTAs: Explore the Reference · Enter Testnet · View Transparency
//   4. Reference Value block — big tabular number + "PAR 1.00 basket-unit"
//   5. Row of 6 clickable metric chips (each navigates to its section)
//
// The hero deliberately reads like an operating terminal — not a marketing page.

"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, Clock, Activity } from "lucide-react";
import { Panel, GlowDot, Pill, Skeleton } from "./primitives";
import { fmtFixed, fmtRatio, fmtNum, fmtTime } from "./format";
import { STATUS_COLORS } from "@/lib/mtq/brand";
import { PAR } from "@/lib/mtq/blueprint";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { SectionId } from "./Navigation";

/* ---------- Terminal status strip (live + clock) ---------- */
function TerminalStrip({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const [now, setNow] = useState<number | null>(null);
  // Live clock — initialize on mount then tick every second. The initial
  // null avoids a hydration mismatch (server has no Date.now()).
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
      <span
        className="inline-flex items-center gap-1.5"
        style={{ color: sb.color }}
      >
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

/* ---------- Clickable metric chip ----------
   Each chip: small label, tabular value, tone, chevron, navigates on click.
   role="button" + keyboard activation per WAI-ARIA. */
function MetricChip({
  label,
  value,
  tone,
  hint,
  onClick,
  targetLabel,
}: {
  label: string;
  value: string;
  tone: "gold" | "emerald" | "rose" | "amber" | "neutral";
  hint?: string;
  onClick: () => void;
  targetLabel: string;
}) {
  const toneClass = new Map([
    ["gold", "text-mtqs-gold"],
    ["emerald", "text-mtqs-emerald"],
    ["rose", "text-mtqs-rose"],
    ["amber", "text-mtqs-amber"],
    ["neutral", "text-white"],
  ]).get(tone) ?? "text-white";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} — ${value} — open ${targetLabel}`}
      className="mtqs-focus group flex h-full w-full flex-col gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]/[0.03] p-3 text-left transition hover:border-mtqs-gold/30 hover:bg-mtqs-gold/[0.04] focus-visible:border-mtqs-gold/40"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[0.6rem] uppercase tracking-[0.2em] text-white/55">
          {label}
        </span>
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-white/30 transition group-hover:translate-x-0.5 group-hover:text-mtqs-gold"
          aria-hidden="true"
        />
      </div>
      <div className={`font-mono tabular-nums text-base font-semibold ${toneClass}`}>
        {value}
      </div>
      {hint ? (
        <div className="text-[0.62rem] text-white/45 leading-snug">{hint}</div>
      ) : null}
    </button>
  );
}

/* ---------- Reference Value block (no "$X" — just the number) ---------- */
function ReferenceValueBlock({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const value = snapshot ? fmtFixed(snapshot.mtqPrice, 4) : null;
  const inBand = snapshot?.priceInBand ?? true;
  const valueTone = !snapshot ? "text-white" : inBand ? "mtqs-gold-text" : "text-mtqs-rose";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Panel className="p-5">
        <div className="flex items-center gap-1.5 mb-3">
          <GlowDot color="gold" size="h-1.5 w-1.5" />
          <span className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-gold/80">
            Reference Value
          </span>
        </div>
        {value ? (
          <div className="flex items-baseline gap-2">
            <span
              className={`font-mono tabular-nums text-4xl sm:text-5xl font-semibold ${valueTone}`}
            >
              {value}
            </span>
            <span className="text-[0.72rem] text-white/55 font-mono">basket-unit</span>
          </div>
        ) : (
          <Skeleton className="h-12 w-32" />
        )}
        <div className="mt-2 text-[0.7rem] text-white/55">
          Chain-linked I<sub>t</sub> · 4s poll · {inBand ? "in safety band" : "outside safety band"}
        </div>
      </Panel>
      <Panel variant="emerald" className="p-5">
        <div className="flex items-center gap-1.5 mb-3">
          <GlowDot color="emerald" size="h-1.5 w-1.5" />
          <span className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-emerald/85">
            Par
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono tabular-nums text-4xl sm:text-5xl font-semibold text-mtqs-emerald">
            {fmtFixed(PAR, 2)}
          </span>
          <span className="text-[0.72rem] text-white/55 font-mono">basket-unit</span>
        </div>
        <div className="mt-2 text-[0.7rem] text-white/55">
          Immutable unit of account · §18.1 · Constitutional
        </div>
      </Panel>
    </div>
  );
}

/* ---------- Main component ---------- */
export function InstitutionalHero({
  snapshot,
  onNavigate,
}: {
  snapshot: MetricsSnapshot | null;
  onNavigate: (id: SectionId) => void;
}) {
  // Snapshot-derived metrics for the chip row.
  const gfbIndex = snapshot ? fmtFixed(snapshot.gfbIndex, 4) : null;

  // Live Weight State — summarize the 4-state weight ladder into a short tag.
  const weightState = (() => {
    if (!snapshot?.weightStates) return null;
    const ex = snapshot.weightStates.execution;
    if (!ex) return null;
    // Pick the largest-weight component for the headline (sm sign of life).
    const entries = Object.entries(ex) as [string, number][];
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
    const top = sorted[0];
    return `${top[0]} ${(top[1] * 100).toFixed(1)}%`;
  })();

  const rrTxt = snapshot && Number.isFinite(snapshot.reserveRatio)
    ? fmtRatio(snapshot.reserveRatio)
    : "—";
  const rrTone =
    !snapshot || !Number.isFinite(snapshot.reserveRatio)
      ? "emerald"
      : snapshot.reserveRatio >= 1.1
      ? "emerald"
      : snapshot.reserveRatio >= 1.05
      ? "amber"
      : "rose";

  const lcrTxt = snapshot && Number.isFinite(snapshot.lcr)
    ? fmtRatio(snapshot.lcr)
    : "—";
  const lcrTone =
    !snapshot || !Number.isFinite(snapshot.lcr)
      ? "emerald"
      : snapshot.lcr >= 1.0
      ? "emerald"
      : "amber";

  const status = snapshot?.status ?? "NORMAL";
  const sb = STATUS_COLORS[status] ?? STATUS_COLORS.NORMAL;

  const oracleValid = snapshot?.oracle?.pairs.filter((p) => !p.paused).length ?? null;
  const oracleTotal = snapshot?.oracle?.pairs.length ?? null;
  const oracleTxt = oracleValid != null && oracleTotal != null ? `${oracleValid}/${oracleTotal}` : "—";
  const oracleTone = snapshot?.oraclePaused ? "rose" : "emerald";

  return (
    <section
      aria-labelledby="hero-institutional"
      className="relative"
    >
      <Panel className="relative overflow-hidden p-5 sm:p-7 lg:p-8 mtqs-glow-gold">
        {/* Terminal grid backdrop */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          aria-hidden="true"
          style={{
            backgroundImage:
              "linear-gradient(rgba(232,185,100,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(232,185,100,0.4) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent 80%)",
          }}
        />

        {/* Terminal status strip */}
        <TerminalStrip snapshot={snapshot} />

        {/* Wordmark + copy */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.05 }}
          className="relative mt-6 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6 lg:gap-10"
        >
          <div className="space-y-4">
            <h1
              className="mtqs-display mtqs-gold-text text-6xl sm:text-7xl lg:text-8xl leading-none"
              style={{ fontWeight: 600 }}
            >
              MTQΣ
            </h1>
            <p className="mtqs-display text-lg sm:text-xl text-amber-100/85 leading-snug max-w-xl">
              A neutral, adaptive global purchasing-power reference unit.
            </p>
            <p className="text-[0.82rem] sm:text-[0.9rem] text-white/55 leading-relaxed max-w-2xl">
              MTQΣ is defined by a transparent methodology spanning eligible
              currencies and gold, an adaptive weighting system, constitutional
              constraints, reserve collateralization, risk controls and
              auditable execution.
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => onNavigate("reference")}
                className="mtqs-focus inline-flex items-center gap-2 rounded-md bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-2.5 text-sm font-semibold text-[#1a1208] shadow-lg shadow-amber-500/15 transition hover:from-amber-200 hover:to-amber-400"
                aria-label="Explore the Reference — open the Reference section"
              >
                Explore the Reference
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate("mint")}
                className="mtqs-focus inline-flex items-center gap-2 rounded-md border border-mtqs-gold/30 bg-mtqs-gold/[0.06] px-4 py-2.5 text-sm font-semibold text-mtqs-gold-light transition hover:border-mtqs-gold/50 hover:bg-mtqs-gold/[0.1]"
                aria-label="Enter Testnet — open the Mint section"
              >
                Enter Testnet
              </button>
              <button
                type="button"
                onClick={() => onNavigate("transparency")}
                className="mtqs-focus inline-flex items-center gap-2 rounded-md border border-white/[0.1] bg-white/[0.02]/[0.03] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-mtqs-emerald/40 hover:text-white"
                aria-label="View Transparency — open the Transparency section"
              >
                View Transparency
              </button>
            </div>
          </div>

          {/* Right-side quick-status digest (live protocol snapshot) */}
          <div className="lg:border-l lg:border-white/[0.06] lg:pl-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55">
                Protocol Snapshot
              </span>
              <Pill tone={status === "NORMAL" ? "emerald" : status === "CAUTION" || status === "RECOVERY" ? "amber" : "rose"}>
                <GlowDot
                  color={status === "NORMAL" ? "emerald" : status === "CAUTION" || status === "RECOVERY" ? "amber" : "rose"}
                  size="h-1.5 w-1.5"
                />
                {sb.label}
              </Pill>
            </div>
            <dl className="grid grid-cols-2 gap-2.5 text-[0.78rem]">
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02]/[0.02] px-3 py-2">
                <dt className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55">Reference Index</dt>
                <dd className="font-mono tabular-nums text-mtqs-gold">
                  {gfbIndex ?? <Skeleton className="h-4 w-16" />}
                </dd>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02]/[0.02] px-3 py-2">
                <dt className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55">Reserve NAV</dt>
                <dd className="font-mono tabular-nums text-white">
                  {snapshot ? fmtNum(snapshot.nav, 0) : <Skeleton className="h-4 w-16" />}
                </dd>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02]/[0.02] px-3 py-2">
                <dt className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55">Circulating</dt>
                <dd className="font-mono tabular-nums text-white">
                  {snapshot ? fmtNum(snapshot.circulatingSupply, 0) : <Skeleton className="h-4 w-16" />}
                </dd>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02]/[0.02] px-3 py-2">
                <dt className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55">Minting</dt>
                <dd
                  className={`font-mono tabular-nums ${
                    snapshot?.mintingAllowed ? "text-mtqs-emerald" : "text-mtqs-rose"
                  }`}
                >
                  {snapshot ? (snapshot.mintingAllowed ? "allowed" : "paused") : <Skeleton className="h-4 w-16" />}
                </dd>
              </div>
            </dl>
            <p className="text-[0.68rem] text-white/45 leading-snug">
              All values are computed live by the reference engine and reconciled
              against the blueprint. Reporting currencies are external accounting
              only — the protocol does not peg to any single currency.
            </p>
          </div>
        </motion.div>

        {/* Reference Value + PAR block */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.15 }}
          className="relative mt-6"
        >
          <ReferenceValueBlock snapshot={snapshot} />
        </motion.div>

        {/* Clickable metric chips row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, delay: 0.25 }}
          className="relative mt-3"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <MetricChip
              label="Reference Index"
              value={gfbIndex ?? "—"}
              tone="gold"
              hint="Chain-linked I_t · open Reference"
              targetLabel="Reference"
              onClick={() => onNavigate("reference")}
            />
            <MetricChip
              label="Live Weight State"
              value={weightState ?? "—"}
              tone="gold"
              hint="Execution weights · open Reference"
              targetLabel="Reference"
              onClick={() => onNavigate("reference")}
            />
            <MetricChip
              label="Reserve Ratio"
              value={rrTxt}
              tone={rrTone}
              hint="NAV / liability · open Reserve"
              targetLabel="Reserve"
              onClick={() => onNavigate("reserve")}
            />
            <MetricChip
              label="Liquidity Coverage"
              value={lcrTxt}
              tone={lcrTone}
              hint="LCR · open Reserve"
              targetLabel="Reserve"
              onClick={() => onNavigate("reserve")}
            />
            <MetricChip
              label="Risk State"
              value={sb.label}
              tone={status === "NORMAL" ? "emerald" : status === "CAUTION" || status === "RECOVERY" ? "amber" : "rose"}
              hint="§21 state machine · open Risk"
              targetLabel="Risk"
              onClick={() => onNavigate("risk")}
            />
            <MetricChip
              label="Oracle Health"
              value={oracleTxt}
              tone={oracleTone}
              hint="Valid sources · open Reference"
              targetLabel="Reference"
              onClick={() => onNavigate("reference")}
            />
          </div>
        </motion.div>

        {/* Footer disclaimer — institutional tone */}
        <div className="relative mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-[0.66rem] text-white/45">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-mtqs-gold/70" aria-hidden="true" />
            Candidate for public testing — not production-authorized
          </span>
          <span className="font-mono">
            v1.0 · reference engine · {snapshot ? `t ${Math.floor((snapshot.fetchedAt ?? Date.now()) / 1000)}` : "—"}
          </span>
        </div>
      </Panel>

      {/* sr-only landmark */}
      <h2 id="hero-institutional" className="sr-only">
        MTQΣ — Institutional Terminal Overview
      </h2>
    </section>
  );
}
