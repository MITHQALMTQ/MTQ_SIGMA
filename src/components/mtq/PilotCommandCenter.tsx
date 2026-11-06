// MTQΣ — The Global Digital Asset
// 2026 Futuristic UI: cinematic entry, glassmorphic panels, dynamic sections
// Single-route Next.js 16 client component with View Transitions API
//
// SIDEBAR-UI: reorganized from a top-nav horizontal layout to a sidebar-based
// layout. The sidebar is fixed on the left (desktop) / drawer (mobile).
// The main content area is offset by 280px on desktop to make room for the
// sidebar. The old <Navigation /> horizontal bar has been removed; all
// section routing now happens through the <Sidebar /> component.

"use client";

// NOTE (v7 landing reconstruction): this is the former src/app/page.tsx
// "Pilot Command Center" UI, preserved verbatim as an unrouted component so
// no existing functionality is lost. The / route now renders the truthful
// landing page (see src/app/page.tsx). This component remains compilable
// and can be re-mounted on a route at any time.


import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionConfig } from "framer-motion";

import { Header, LiveTicker } from "@/components/mtq/Header";
import { Footer } from "@/components/mtq/Footer";
import { Sidebar, type SidebarMode } from "@/components/mtq/Sidebar";
import { type SectionId, ALL_SECTIONS } from "@/components/mtq/Navigation";
import { CinematicLoader } from "@/components/mtq/CinematicLoader";
import { MobileBottomNav } from "@/components/mtq/MobileBottomNav";
import { TestnetStatusBar } from "@/components/mtq/TestnetStatusBar";
import { CommandLauncher } from "@/components/mtq/CommandLauncher";
import { SectionHeading, Reveal, Pill, GlowDot, Panel, Stat, MiniBar, Skeleton } from "@/components/mtq/primitives";
// F-46-1 (Task-46 Reserve Vault audit): canonical RR/LCR surface helpers —
// fmtRatio ("∞ — no liability" for the null/Infinity case), rrColor, lcrColor.
// Same convention as the Header ticker, InstitutionalHero and LiveMonetaryState.
import { fmtRatio, rrColor, lcrColor } from "@/components/mtq/format";
import { FaucetPanel } from "@/components/mtq/FaucetPanel";
import { EventExplorer } from "@/components/mtq/EventExplorer";
import { HomeSection } from "@/components/mtq/sections/HomeSection";
import { DashboardSection } from "@/components/mtq/sections/DashboardSection";
import { ContractsSection } from "@/components/mtq/sections/ContractsSection";
import { DocsSection } from "@/components/mtq/sections/DocsSection";
import { InvestorSection } from "@/components/mtq/sections/InvestorSection";
import { PitchSection } from "@/components/mtq/sections/PitchSection";
import { SecuritySection } from "@/components/mtq/sections/SecuritySection";
import { AuthorizationAuditSection } from "@/components/mtq/sections/AuthorizationAuditSection";
import { TestsSection } from "@/components/mtq/sections/TestsSection";
// Dedicated per-tab pages (blueprint v2.0 full-coverage build) — each nav tab
// now renders its own screen instead of reusing a shared section.
import { MintSection } from "@/components/mtq/sections/MintSection";
import { RedeemSection } from "@/components/mtq/sections/RedeemSection";
import { SimulationSection } from "@/components/mtq/sections/SimulationSection";
import { ConstituencySection } from "@/components/mtq/sections/ConstituencySection";
import { IssuanceSection } from "@/components/mtq/sections/IssuanceSection";
import { TransparencySection } from "@/components/mtq/sections/TransparencySection";
import { ValidationResearchSection } from "@/components/mtq/sections/ValidationResearchSection";
import { ArchitectureSection } from "@/components/mtq/sections/ArchitectureSection";
import { NetworksSection } from "@/components/mtq/sections/NetworksSection";
// 40-c — Sovereign Devnet UI sections (Network NOC · Explorer · Wallet · Staking).
import { NetworkSection } from "@/components/mtq/sections/NetworkSection";
import { ExplorerSection } from "@/components/mtq/sections/ExplorerSection";
import { WalletSection } from "@/components/mtq/sections/WalletSection";
import { StakingSection } from "@/components/mtq/sections/StakingSection";
import { DevelopersSection } from "@/components/mtq/sections/DevelopersSection";
import { MandateCompliance } from "@/components/mtq/MandateCompliance";
import { EvidencePackageSection } from "@/components/mtq/EvidencePackageSection";
import { InstitutionalDashboard } from "@/components/mtq/InstitutionalDashboard";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { OracleBoard } from "@/lib/mtq/oracle";
import { ADMISSIBILITY_ENVELOPES } from "@/lib/mtq/blueprint";
import {
  BookOpen,
  Vault as VaultIcon,
  Shield as ShieldIcon,
  RefreshCw,
  Users,
  Scale,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Landmark,
  CircuitBoard,
  Crown,
} from "lucide-react";

const POLL_MS = 4000;

// Cinematic section transitions — tuned 2026-10-24: the previous 0.5s
// full-page blur(12px) on EVERY nav switch blanked the screen and was GPU-heavy
// on large sections; now 0.28s with a light 6px blur (still cinematic, far
// snappier and cheaper).
const sectionVariants = {
  initial: { opacity: 0, scale: 0.985, filter: "blur(6px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 1.015, filter: "blur(4px)" },
};

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT-FIX-1 — 5 differentiated sidebar sections.
// Each was previously rendering <DashboardSection /> (duplicate content). Now
// each renders distinct, relevant content from existing API routes.
// ─────────────────────────────────────────────────────────────────────────────

const fmtUsd = (n: number | null | undefined): string => {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
};
const fmtPct = (n: number | null | undefined, d = 1): string =>
  n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(d)}%`;

// GFB Index 7-component basket — matches the canonical strategic prior.
const GFB_COMPONENTS = [
  { key: "USD", weight: 0.27 },
  { key: "EUR", weight: 0.20 },
  { key: "Gold", weight: 0.26 },
  { key: "JPY", weight: 0.09 },
  { key: "GBP", weight: 0.08 },
  { key: "CNY", weight: 0.05 },
  { key: "CHF", weight: 0.05 },
] as const;

// Canonical component order of the chain-index weight arrays (liveWeights from
// /api/gfb = chainIndex.prevWeights = [USD, EUR, JPY, GBP, CNY, CHF, Gold]).
const LIVE_WEIGHT_ORDER: Record<string, number> = {
  USD: 0, EUR: 1, JPY: 2, GBP: 3, CNY: 4, CHF: 5, Gold: 6,
};

// F-45-1 (Task-45 Reference Index audit): bar scale = the widest §8.1
// constitutional upper envelope (32% — USD and Gold). The old hardcoded
// max=0.30 SATURATED the live bar whenever a weight reached its envelope
// bound (live USD sat at exactly 32.0% during the audit, rendering at 100%
// width — visually indistinguishable from 0.30). Sourcing the scale from
// ADMISSIBILITY_ENVELOPES keeps it constitutionally grounded.
const ENVELOPE_BAR_MAX = Math.max(
  ...Object.values(ADMISSIBILITY_ENVELOPES).map((e) => e.upper),
);

// F-45-2 (Task-45 Reference Index audit): sub-0.1 quotes (JPY/USD ≈ 0.0063)
// need 6dp to show four significant figures; the old `p < 2 ? 4 : 2`
// rendered "$0.0063" — two sig figs, a ~0.2% visual rounding on a reference
// terminal. Shared by the basket cards AND the oracle consensus table so the
// precision convention stays unified (Task-38 convention discipline).
const fmtRefPrice = (p: number): string =>
  `$${p.toFixed(p < 0.1 ? 6 : p < 2 ? 4 : 2)}`;

// FIX 1.1 — `reference` section: GFB Index composition + live oracle consensus.
//   Fetches /api/gfb (the 7-component basket) + /api/oracle (consensus board).
//   AUDIT-FIX F-1: the basket cards show the STRATEGIC PRIOR (§3.2) side-by-side
//   with the live MASE smoothed weight W^Smooth — the prior is a genesis soft
//   anchor, NOT the live/constitutional composition (Invariant I3).
function ReferenceSection() {
  const [gfb, setGfb] = useState<{
    gfbIndex: number;
    mtqPrice: number;
    priceInBand: boolean;
    components: Record<string, { weight: number; price: number | null }>;
    methodology: string;
    // AUDIT-FIX F-1 — live chain-index weights [USD,EUR,JPY,GBP,CNY,CHF,Gold]
    // and the MASE smoothed target record (the adaptive live weights).
    liveWeights?: number[] | null;
    smoothedWeights?: Record<string, number> | null;
  } | null>(null);
  const [oracle, setOracle] = useState<OracleBoard | null>(null);
  const [loading, setLoading] = useState(true);
  // TASK-38 — LIVE POLL (owner directive 2026-11-03: "the attached part is not
  // updating live"). This section previously took a ONE-SHOT read at section
  // open (empty-deps useEffect), so every number on the board froze until the
  // user re-opened the section — visually indistinguishable from a dead feed.
  // The data path was always live (fx.ts live feeds → engine 4s tick →
  // /api/gfb); only the UI read was one-shot (verified 2026-11-03: two /api/gfb
  // reads 9s apart returned advancing timestamp, index 1.17281→1.17291, EUR
  // 1.12175→1.12151, Gold 3946.60→3947.82). Now the board re-reads /api/gfb +
  // /api/oracle on the SAME 4s cadence as the Dashboard's snapshot stream
  // (POLL_MS), skips polls while the tab is hidden (engine keeps ticking
  // server-side — no data lost), refreshes immediately on visibility return,
  // and keeps last-good values on a failed poll (never blanks a live board).
  // Honest granularity note: FX-backed component prices advance on the
  // engine's 60s FX-cache TTL (live Frankfurter/gold-api cadence); the
  // chain-linked index and oracle consensus re-sample every poll.
  const [polledAt, setPolledAt] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true;
    const poll = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const [g, o] = await Promise.all([
          fetch("/api/gfb", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
          fetch("/api/oracle", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        ]);
        if (!mounted) return;
        if (g && typeof g.gfbIndex === "number") setGfb(g);
        if (o && Array.isArray(o.pairs)) setOracle(o as OracleBoard);
        setPolledAt(Date.now());
        setLoading(false);
      } catch {
        /* keep last-good values; the next poll retries */
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return (
    <div className="space-y-10">
      <section id="reference-gfb" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§9 · GFB INDEX"
          title="Global Fiat Basket — Reference Index"
          right={
            <Pill tone={gfb?.priceInBand ? "emerald" : "amber"}>
              <GlowDot color={gfb?.priceInBand ? "emerald" : "amber"} size="h-1.5 w-1.5" />
              {gfb?.priceInBand ? "in safety band" : "outside band"}
            </Pill>
          }
        />
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            <Panel className="p-5">
              <Stat label="GFB Index" value={
                <span className="text-2xl font-mono tabular-nums text-mtqs-gold-light">
                  {gfb ? gfb.gfbIndex.toFixed(4) : loading ? <Skeleton className="h-7 w-24 inline-block" /> : "—"}
                </span>
              } sub="chain-linked recursive · §9.2" />
            </Panel>
            <Panel className="p-5">
              <Stat label="P_MTQ (USD)" value={
                <span className="text-2xl font-mono tabular-nums text-[#0E1F1B]">
                  {gfb ? `$${gfb.mtqPrice.toFixed(4)}` : loading ? <Skeleton className="h-7 w-24 inline-block" /> : "—"}
                </span>
              } sub="1 MTQ = basket PAR" />
            </Panel>
            <Panel className="p-5">
              <Stat label="Methodology" value={
                <span className="text-[0.72rem] text-[#33544C] leading-snug block">
                  {gfb?.methodology ?? "Chain-linked recursive (§9.2 COO-16)"}
                </span>
              } sub="public good · not financial advice" />
            </Panel>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <Panel className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[#0E1F1B]">7-Component Basket · Strategic Prior (§3.2)</h3>
              {/* TASK-38 — visible liveness: pulsing dot + poll cadence + last-read
                  clock so a user can SEE the board stream instead of inferring it. */}
              <span className="ml-auto inline-flex items-center gap-1.5 font-mono text-[0.6rem] text-[#5B6E68]">
                <GlowDot color="emerald" size="h-1.5 w-1.5" />
                live · 4s{polledAt ? ` · read ${new Date(polledAt).toLocaleTimeString()}` : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {GFB_COMPONENTS.map((c) => {
                const live = gfb?.components?.[c.key];
                const price = live?.price;
                // AUDIT-FIX F-1 — live W^Smooth (MASE) next to the W^Prior soft anchor.
                // Prefer the smoothed record; fall back to the operative chain weights.
                const smoothW = gfb?.smoothedWeights?.[c.key];
                const chainW =
                  gfb?.liveWeights && LIVE_WEIGHT_ORDER[c.key] != null
                    ? gfb.liveWeights[LIVE_WEIGHT_ORDER[c.key]]
                    : undefined;
                const liveW =
                  smoothW != null && Number.isFinite(smoothW)
                    ? smoothW
                    : chainW != null && Number.isFinite(chainW)
                    ? chainW
                    : null;
                const delta = liveW != null ? liveW - c.weight : null;
                return (
                  <div key={c.key} className="rounded-lg border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[0.78rem] text-mtqs-gold">{c.key}</span>
                      <span
                        className="text-[0.6rem] text-[#5B6E68] font-mono"
                        aria-label={`${c.key} strategic prior weight ${(c.weight * 100).toFixed(1)} percent`}
                      >
                        P {(c.weight * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-2">
                      <MiniBar value={c.weight} max={ENVELOPE_BAR_MAX} colorClass="bg-mtqs-gold" className="mb-1" />
                      {liveW != null ? (
                        <MiniBar value={liveW} max={ENVELOPE_BAR_MAX} colorClass="bg-mtqs-emerald" className="mb-1" />
                      ) : (
                        <div className="mb-1 text-[0.6rem] font-mono text-[#7A8C86]">live —</div>
                      )}
                    </div>
                    <div className="font-mono text-[0.68rem] text-[#33544C]">
                      {liveW != null ? (
                        <>
                          <span className="text-mtqs-emerald">L {(liveW * 100).toFixed(1)}%</span>
                          {delta != null && Math.abs(delta) >= 0.0005 && (
                            <span className={delta > 0 ? "text-mtqs-amber" : "text-mtqs-rose"}>
                              {" "}({delta > 0 ? "+" : "−"}{Math.abs(delta * 100).toFixed(1)}pp)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[#7A8C86]">live W^Smooth —</span>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-[0.72rem] text-[#33544C]">
                      {price != null ? fmtRefPrice(price) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-[0.65rem] text-[#5B6E68] leading-relaxed">
              <span className="text-mtqs-gold/80">P</span> = W<sup>Prior</sup> · the genesis soft-anchor (§3.2) — deviation is
              penalized, never enforced. <span className="text-mtqs-emerald/90">L</span> = live W<sup>Smooth</sup> · the MASE
              ensemble output (§7). Methodology is fixed; weights are <span className="text-[#33544C]">ADAPTIVE</span> (Invariant I3).
              Live weights are published in the 4-state table (MASE section) and via /api/gfb. Sum of prior weights = 100%
              (USD 27 · EUR 20 · Gold 26 · JPY 9 · GBP 8 · CNY 5 · CHF 5). Live weights are constitutionally
              envelope-bounded per component (§8.1 — e.g. USD 23–32%, Gold 20–32%; the bar scale is the widest
              upper bound). Prices stream live from the canonical oracle board on a 4s poll (TASK-38); FX reference
              marks advance at the engine's 60s live-FX cache granularity (Frankfurter/gold-api refresh cadence).
            </div>
          </Panel>
        </Reveal>
      </section>

      <section id="reference-oracle" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§9.2 · ORACLE CONSENSUS"
          title="Oracle Consensus Board"
          right={
            <Pill tone={oracle?.anyPaused ? "rose" : "emerald"}>
              <GlowDot color={oracle?.anyPaused ? "rose" : "emerald"} size="h-1.5 w-1.5" />
              {oracle?.anyPaused ? "any paused (I9 halt)" : "6 pairs · live 4s poll"}
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            {loading && !oracle ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : oracle ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[0.78rem]">
                  <thead>
                    <tr className="text-[0.62rem] uppercase tracking-widest text-[#5B6E68] border-b border-[#E3EAE6]">
                      <th className="text-left font-medium py-2 pr-4">Pair</th>
                      <th className="text-right font-medium py-2 px-3">Final Price</th>
                      <th className="text-right font-medium py-2 px-3">Valid</th>
                      <th className="text-left font-medium py-2 px-3">Method</th>
                      <th className="text-right font-medium py-2 px-3">Spread (bps)</th>
                      <th className="text-left font-medium py-2 pl-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {oracle.pairs.map((p) => (
                      <tr key={p.pair} className="border-b border-[#EDF2EF] last:border-b-0">
                        <td className="py-2 pr-4 text-mtqs-gold">{p.pair}</td>
                        <td className="py-2 px-3 text-right text-[#0E1F1B]">
                          {p.finalPrice > 0 ? fmtRefPrice(p.finalPrice) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right text-[#33544C]">{p.validCount}/3</td>
                        <td className="py-2 px-3 text-[#33544C]">{p.method}</td>
                        <td className="py-2 px-3 text-right text-[#33544C]">{p.spreadBps.toFixed(1)}</td>
                        <td className="py-2 pl-3">
                          {p.paused ? (
                            <Pill tone="rose"><XCircle className="h-3 w-3" />paused</Pill>
                          ) : p.governanceOverride ? (
                            <Pill tone="amber"><AlertTriangle className="h-3 w-3" />override</Pill>
                          ) : (
                            <Pill tone="emerald"><CheckCircle2 className="h-3 w-3" />ok</Pill>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-[0.78rem] text-[#5B6E68]">Oracle board unavailable.</div>
            )}
            <div className="mt-3 text-[0.65rem] text-[#5B6E68] leading-relaxed">
              v2.0 §17.2 quorum (Invariant I9, consolidated): ≥ 2 valid feeds from ≥ 2 distinct source
              families. 3 valid → outlier-filtered mean with the median as validity anchor (§17.5, method
              “filtered-mean”); 2 valid → DEGRADED — mint + rebalance paused, redemption AVAILABLE (§17.7);
              &lt; 2 valid → FAILED — all operations pause, final price 0. Override = legacy I9 escape hatch
              (constitutional §22.3 only; retained as a no-op field in the pilot engine).
            </div>
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}

// FIX 1.2 — `reserve` section: NAV, RR, LCR + USD/EUR/JPY/GBP/CNY/CHF/Gold breakdown.
//   Reads the parent-polled snapshot (no extra fetch needed; data is already live).
function ReserveSection({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const r = snapshot?.reserve;
  const breakdown = r ? [
    { key: "USD", value: r.usdNet, color: "bg-emerald-400" },
    { key: "EUR", value: r.eurNet, color: "bg-mtqs-gold" },
    { key: "Gold", value: r.goldNet, color: "bg-amber-400" },
    { key: "JPY", value: r.jpyNet, color: "bg-rose-400" },
    { key: "GBP", value: r.gbpNet, color: "bg-sky-400" },
    { key: "CNY", value: r.cnyNet, color: "bg-red-400" },
    { key: "CHF", value: r.chfNet, color: "bg-purple-400" },
  ] : [];
  const total = breakdown.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;

  return (
    <div className="space-y-10">
      <section id="reserve-vault" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§4 · RESERVE VAULT"
          title="Reserve Composition & Solvency"
          right={
            <Pill tone={snapshot ? "emerald" : "amber"}>
              <GlowDot color={snapshot ? "emerald" : "amber"} size="h-1.5 w-1.5" />
              {snapshot ? "live · 4s poll" : "loading"}
            </Pill>
          }
        />
        <Reveal>
          {/* 16f-005: legacy v1/v2 qualifier strip (Task-15 style) — the §4 vault
              below is the pilot ledger's legacy reserve accounting, retained
              labeled under the v3.0 no-conventional-reserve objective. */}
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[0.7rem] leading-relaxed text-[#5B6E68]">
            <span className="font-semibold text-mtqs-amber">Legacy v1/v2 pilot-ledger path.</span>{" "}
            The §4 vault below is the pilot ledger&apos;s legacy reserve accounting, retained labeled —
            under the v3.0 no-conventional-reserve objective (Gate B, D-13.3–D-13.7 open) there is
            no conventional reserve collateralizing MTQΣ; the index is published as a separate
            measuring service, not a backing pool.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Panel className="p-5">
              <Stat label="NAV (net asset value)" value={
                <span className="text-2xl font-mono tabular-nums text-mtqs-gold-light">
                  {snapshot ? fmtUsd(snapshot.nav) : <Skeleton className="h-7 w-20 inline-block" />}
                </span>
              } sub="post-haircut USD" />
            </Panel>
            <Panel className="p-5">
              <Stat label="Reserve Ratio (RR)" value={
                // F-46-1: null RR = Infinity = zero circulating liability — the
                // fully-reserved state. Canonical rrColor (null→emerald; rose
                // is EMERGENCY RR<1.00 ONLY per §21.2 — the old inline
                // `< 1.05 → rose` painted the amber CAUTION/STRESS bands as
                // danger AND coerced null<1.05→true, rendering the healthiest
                // state in ROSE (the F-38-1 class, missed here in Task 38).
                <span className={`text-2xl font-mono tabular-nums ${rrColor(snapshot?.reserveRatio)}`}>
                  {snapshot ? fmtRatio(snapshot.reserveRatio) : <Skeleton className="h-7 w-20 inline-block" />}
                </span>
              } sub={
                snapshot && !Number.isFinite(snapshot.reserveRatio)
                  ? "no circulating liability — fully reserved"
                  : `target ≥ ${(1.10 * 100).toFixed(0)}% · hard floor ${(1.00 * 100).toFixed(0)}%`
              } />
            </Panel>
            <Panel className="p-5">
              <Stat label="LCR (liquidity coverage)" value={
                // F-46-1: same convention — null LCR = ∞ (no liability to
                // cover) → emerald; finite < 1.0 is AMBER (liquidity stress),
                // never rose (matching lcrColor and §21.2: only RR < 1.00 is
                // the red EMERGENCY state).
                <span className={`text-2xl font-mono tabular-nums ${lcrColor(snapshot?.lcr)}`}>
                  {snapshot ? fmtRatio(snapshot.lcr) : <Skeleton className="h-7 w-20 inline-block" />}
                </span>
              } sub={
                snapshot && !Number.isFinite(snapshot.lcr)
                  ? "no circulating liability — fully reserved"
                  : `target ≥ ${(1.00 * 100).toFixed(0)}%`
              } />
            </Panel>
            <Panel className="p-5">
              <Stat label="Liability (MTQ supply × P)" value={
                <span className="text-2xl font-mono tabular-nums text-[#0E1F1B]">
                  {snapshot ? fmtUsd(snapshot.liability) : <Skeleton className="h-7 w-20 inline-block" />}
                </span>
              } sub={`circulating: ${snapshot ? snapshot.circulatingSupply.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"} MTQ`} />
            </Panel>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <Panel className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <VaultIcon className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[#0E1F1B]">Reserve Breakdown · 7 Asset Classes</h3>
            </div>
            {!r ? (
              <div className="space-y-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : (
              <div className="space-y-2.5">
                {breakdown.map((b) => (
                  <div key={b.key} className="grid grid-cols-[3rem_1fr_5rem] items-center gap-3">
                    <span className="font-mono text-[0.75rem] text-mtqs-gold">{b.key}</span>
                    <MiniBar value={Math.max(0, b.value)} max={total} colorClass={b.color} height="h-2.5" />
                    <span className="font-mono text-[0.72rem] text-[#33544C] text-right">
                      {fmtUsd(b.value)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 text-[0.65rem] text-[#5B6E68]">
              <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-3 py-2">
                <span className="text-[#7A8C86]">Fiat net:</span>{" "}
                <span className="font-mono text-[#33544C]">{r ? fmtUsd(r.fiatNet) : "—"}</span>
              </div>
              <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-3 py-2">
                <span className="text-[#7A8C86]">Gold price (XAU):</span>{" "}
                <span className="font-mono text-[#33544C]">{r ? `$${r.goldPrice.toFixed(2)}` : "—"}</span>
              </div>
              <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-3 py-2">
                <span className="text-[#7A8C86]">Index gold (locked):</span>{" "}
                <span className="font-mono text-[#33544C]">{r ? fmtUsd(r.indexGoldNet) : "—"}</span>
              </div>
              <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-3 py-2">
                <span className="text-[#7A8C86]">Reserve gold (MARP):</span>{" "}
                <span className="font-mono text-[#33544C]">{r ? fmtUsd(r.reserveGoldNet) : "—"}</span>
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}

// FIX 1.3 — `risk` section: 6-state risk machine + VIX/DXY + canonical thresholds.
//   Reads the parent-polled snapshot.
// F-47-1: DEFENSIVE = amber, NOT rose — the F-38-1/F-46-1 canonical convention
//   (rose = EMERGENCY §21.2 hard-floor breach ONLY) applies to the state ladder
//   too: DEFENSIVE (RR 1.00–1.02, solvency intact) painted rose was visually
//   indistinguishable from EMERGENCY on the ladder + header pill. Matches the
//   canonical status-tone.tsx and RiskStateMachine maps.
const RISK_TONE: Record<string, "emerald" | "amber" | "rose"> = {
  NORMAL: "emerald",
  CAUTION: "amber",
  STRESS: "amber",
  DEFENSIVE: "amber",
  EMERGENCY: "rose",
  RECOVERY: "amber",
};
const RISK_BANDS = [
  { state: "NORMAL",    rr: "≥ 1.10",   lcr: "≥ 1.00" },
  { state: "CAUTION",   rr: "1.05–1.10", lcr: "≥ 0.90" },
  { state: "STRESS",    rr: "1.02–1.05", lcr: "≥ 0.80" },
  { state: "DEFENSIVE", rr: "1.00–1.02", lcr: "≥ 0.70" },
  { state: "EMERGENCY", rr: "< 1.00",   lcr: "any (RR hard-floor breach ONLY)" },
  { state: "RECOVERY",  rr: "≥ 1.05 (rising)", lcr: "≥ 0.90 (48h sustained confirm)" },
] as const;
// ^ mirrors src/lib/mtq/state-machine.ts §21.2 exactly: EMERGENCY = RR < 1.00
//   ONLY (LCR any — an LCR collapse with solvency intact is RECOVERY/DEFENSIVE,
//   never EMERGENCY); RECOVERY = RR ≥ 1.05 rising + LCR ≥ 0.90 after 48h
//   confirmation (and the residual posture when liquidity fails the DEFENSIVE
//   test while solvency holds).

function RiskSection({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const state = snapshot?.riskState ?? "NORMAL";
  const tone = RISK_TONE[state] ?? "amber";
  const m = snapshot?.macro;

  return (
    <div className="space-y-10">
      <section id="risk-machine" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§21 · 6-STATE RISK MACHINE"
          title="Canonical Risk State Machine"
          right={
            <Pill tone={tone}>
              <GlowDot color={tone} size="h-1.5 w-1.5" />
              {state}
            </Pill>
          }
        />
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Panel className="p-5">
              <Stat label="Current State" value={
                <span className={`text-2xl font-mono tabular-nums ${tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-mtqs-amber" : "text-mtqs-rose"}`}>
                  {state}
                </span>
              } sub={snapshot ? `entered: ${new Date(snapshot.riskStateEnteredAt).toLocaleTimeString()}` : "—"} />
            </Panel>
            <Panel className="p-5">
              <Stat label="VIX (volatility)" value={
                <span className="text-2xl font-mono tabular-nums text-[#0E1F1B]">
                  {m ? m.vix.toFixed(2) : <Skeleton className="h-7 w-20 inline-block" />}
                </span>
              } sub={`z-score: ${m ? m.zVix.toFixed(2) : "—"}`} />
            </Panel>
            <Panel className="p-5">
              <Stat label="DXY (dollar index)" value={
                <span className="text-2xl font-mono tabular-nums text-[#0E1F1B]">
                  {m ? m.dxy.toFixed(2) : <Skeleton className="h-7 w-20 inline-block" />}
                </span>
              } sub={`z-score: ${m ? m.zDxy.toFixed(2) : "—"}`} />
            </Panel>
            <Panel className="p-5">
              <Stat label="Worse Condition Binding" value={
                <span className="text-base font-mono text-[#33544C] uppercase">
                  {snapshot ? snapshot.riskStateWorseCondition : "—"}
                </span>
              } sub="rr vs lcr · worse binds" />
            </Panel>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <Panel className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldIcon className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[#0E1F1B]">State Ladder · RR &amp; LCR Bands</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {RISK_BANDS.map((b) => {
                const isActive = b.state === state;
                const t = RISK_TONE[b.state] ?? "amber";
                return (
                  <div
                    key={b.state}
                    className={`rounded-lg border p-3 transition-colors ${
                      isActive
                        ? t === "emerald"
                          ? "border-emerald-400/40 bg-emerald-400/8"
                          : t === "amber"
                          ? "border-mtqs-amber/40 bg-mtqs-amber/8"
                          : "border-mtqs-rose/40 bg-mtqs-rose/8"
                        : "border-[#E3EAE6] bg-[#F7FAF8]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`font-mono text-[0.82rem] font-semibold ${isActive ? (t === "emerald" ? "text-emerald-600" : t === "amber" ? "text-mtqs-amber" : "text-mtqs-rose") : "text-[#33544C]"}`}>
                        {b.state}
                      </span>
                      {isActive && <GlowDot color={t} size="h-1.5 w-1.5" />}
                    </div>
                    <div className="text-[0.68rem] text-[#5B6E68] font-mono space-y-0.5">
                      <div>RR: <span className="text-[#33544C]">{b.rr}</span></div>
                      <div>LCR: <span className="text-[#33544C]">{b.lcr}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>
        </Reveal>
        <Reveal delay={0.1}>
          <Panel className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[#0E1F1B]">Active Policy Diagnostics</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-[0.7rem]">
              <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                <div className="text-[0.6rem] uppercase tracking-widest text-[#5B6E68]">Mint Capacity</div>
                <div className="font-mono text-[#0E1F1B] mt-1">{snapshot ? fmtPct(snapshot.mintThrottle) : "—"}</div>
                <div className="text-[0.55rem] text-[#7A8C86] mt-0.5">100% = unthrottled · 0% = paused</div>
              </div>
              <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                <div className="text-[0.6rem] uppercase tracking-widest text-[#5B6E68]">Redeem Fee</div>
                <div className="font-mono text-[#0E1F1B] mt-1">{snapshot ? fmtPct(snapshot.redeemFeePct, 3) : "—"}</div>
              </div>
              <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                <div className="text-[0.6rem] uppercase tracking-widest text-[#5B6E68]">Rebalance Urgency</div>
                <div className="font-mono text-[#0E1F1B] mt-1">{snapshot ? snapshot.rebalanceUrgency.toFixed(2) : "—"}</div>
              </div>
              <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                <div className="text-[0.6rem] uppercase tracking-widest text-[#5B6E68]">Minting</div>
                <div className={`font-mono mt-1 ${snapshot?.mintingAllowed ? "text-emerald-600" : "text-mtqs-rose"}`}>
                  {snapshot ? (snapshot.mintingAllowed ? "ALLOWED" : "HALTED") : "—"}
                </div>
              </div>
              <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                <div className="text-[0.6rem] uppercase tracking-widest text-[#5B6E68]">Redemption</div>
                <div className={`font-mono mt-1 ${snapshot?.redemptionAllowed ? "text-emerald-600" : "text-mtqs-rose"}`}>
                  {snapshot ? (snapshot.redemptionAllowed ? "ALLOWED" : "HALTED") : "—"}
                </div>
              </div>
              <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                <div className="text-[0.6rem] uppercase tracking-widest text-[#5B6E68]">Confirmation Ends</div>
                <div className="font-mono text-[#0E1F1B] mt-1">
                  {snapshot?.riskStateConfirmationEnds ? new Date(snapshot.riskStateConfirmationEnds).toLocaleString() : "—"}
                </div>
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}

// FIX 1.4 — `rebalancing` section: last rebalance decision (direction / tradeUsd /
//   reason / applied) + MARP per-component projection.
function RebalancingSection({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const d = snapshot?.rebalance;
  const dirLabel = d ? (d.direction === 1 ? "BUY GOLD" : d.direction === -1 ? "SELL GOLD" : "NO TRADE") : "—";
  const dirTone: "emerald" | "rose" | "muted" =
    d?.direction === 1 ? "emerald" : d?.direction === -1 ? "rose" : "muted";
  const marp = snapshot?.marp;

  return (
    <div className="space-y-10">
      <section id="rebalancing-decision" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§7 · REBALANCING ENGINE"
          title="Last Rebalance Decision"
          right={
            <Pill tone={dirTone === "muted" ? "default" : dirTone}>
              <GlowDot color={dirTone === "muted" ? "amber" : dirTone} size="h-1.5 w-1.5" />
              {dirLabel}
            </Pill>
          }
        />
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Panel className="p-5">
              <Stat label="Direction" value={
                <span className={`text-xl font-mono ${d?.direction === 1 ? "text-emerald-600" : d?.direction === -1 ? "text-mtqs-rose" : "text-[#33544C]"}`}>
                  {dirLabel}
                </span>
              } sub={d?.shouldRebalance ? "should execute" : "no-trade zone"} />
            </Panel>
            <Panel className="p-5">
              <Stat label="Trade Size (USD)" value={
                <span className="text-2xl font-mono tabular-nums text-mtqs-gold-light">
                  {d ? fmtUsd(d.tradeUsd) : <Skeleton className="h-7 w-20 inline-block" />}
                </span>
              } sub="after slippage + turnover cap" />
            </Panel>
            <Panel className="p-5">
              <Stat label="Observed Gold Wt" value={
                <span className="text-2xl font-mono tabular-nums text-[#0E1F1B]">
                  {d ? fmtPct(d.observedGoldWeight) : <Skeleton className="h-7 w-20 inline-block" />}
                </span>
              } sub="reserve + index gold / NAV · legacy §6.5/§8 buffer path (v1/v2)" />
            </Panel>
            <Panel className="p-5">
              <Stat label="Target Gold Wt" value={
                <span className="text-2xl font-mono tabular-nums text-[#0E1F1B]">
                  {d ? fmtPct(d.targetGoldWeight) : <Skeleton className="h-7 w-20 inline-block" />}
                </span>
              } sub={`deviation: ${d ? fmtPct(Math.abs(d.deviation)) : "—"}`} />
            </Panel>
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <Panel className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[#0E1F1B]">Decision Reason</h3>
            </div>
            <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-4 font-mono text-[0.78rem] text-[#33544C] leading-relaxed">
              {d ? d.reason : "Awaiting first snapshot…"}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.65rem] text-[#5B6E68]">
              <span>Execution path:</span>
              <Pill tone={snapshot?.rebalancePath === "marp" ? "emerald" : "amber"}>
                {snapshot?.rebalancePath === "marp" ? "MARP active" : "Legacy §7 active"}
              </Pill>
              {snapshot?.marpExecution && (
                <span>
                  eligible this tick: <span className="font-mono text-[#33544C]">{snapshot.marpExecution.appliedCount}</span>
                  {" · "}Σ approved: <span className="font-mono text-[#33544C]">{fmtUsd(snapshot.marpExecution.totalTradeUsd)}</span>
                  <span className="text-[#7A8C86]"> (pre-execution projection)</span>
                </span>
              )}
            </div>
            {/* F-50-1 — the REAL last execution pass, distinct from the projection above */}
            {snapshot?.marpExecution?.lastPass && (
              <div
                data-testid="marp-last-pass"
                className="mt-2 rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-3 py-2 text-[0.65rem] text-[#5B6E68] leading-relaxed"
              >
                <span className="uppercase tracking-[0.16em] text-[#7A8C86]">Last execution pass</span>
                {" · "}
                {snapshot.marpExecution.lastPass.heldBy ? (
                  <span className="text-mtqs-amber">held — {snapshot.marpExecution.lastPass.heldBy}</span>
                ) : (
                  <>
                    applied <span className="font-mono text-[#33544C]">{snapshot.marpExecution.lastPass.appliedCount}</span>
                    {" · "}skipped <span className="font-mono text-[#33544C]">{snapshot.marpExecution.lastPass.skippedCount}</span>
                    {" · "}Σ executed <span className="font-mono text-[#33544C]">{fmtUsd(snapshot.marpExecution.lastPass.totalTradeUsd)}</span>
                    {snapshot.marpExecution.lastPass.turnoverCapped.length > 0 && (
                      <span className="text-mtqs-amber">
                        {" · "}§11.5.2 turnover-capped: {snapshot.marpExecution.lastPass.turnoverCapped.join(", ")}
                      </span>
                    )}
                  </>
                )}
                {" · "}<span className="text-[#7A8C86]">{new Date(snapshot.marpExecution.lastPass.at).toLocaleTimeString()}</span>
              </div>
            )}
          </Panel>
        </Reveal>
        {marp && marp.decisions.length > 0 && (
          <Reveal delay={0.1}>
            <Panel className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <CircuitBoard className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">MARP Per-Component Projection (§10)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[0.75rem]">
                  <thead>
                    <tr className="text-[0.6rem] uppercase tracking-widest text-[#5B6E68] border-b border-[#E3EAE6]">
                      <th className="text-left font-medium py-2 pr-3">Component</th>
                      <th className="text-left font-medium py-2 px-3">Direction</th>
                      <th className="text-right font-medium py-2 px-3">Trade USD</th>
                      <th className="text-right font-medium py-2 px-3">Urgency</th>
                      <th className="text-left font-medium py-2 px-3">Level</th>
                      <th className="text-left font-medium py-2 pl-3">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {marp.decisions.map((dec) => (
                      <tr key={dec.component} className="border-b border-[#EDF2EF] last:border-b-0">
                        <td className="py-2 pr-3 text-mtqs-gold">{dec.component}</td>
                        <td className="py-2 px-3 text-[#33544C]">{dec.direction}</td>
                        <td className="py-2 px-3 text-right text-[#33544C]">{fmtUsd(dec.tradeUsd)}</td>
                        <td className="py-2 px-3 text-right text-[#33544C]">{dec.urgency.toFixed(2)}</td>
                        <td className="py-2 px-3 text-[#33544C]">L{dec.level}</td>
                        <td className="py-2 pl-3 text-[#33544C] text-[0.7rem]">{dec.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-[0.65rem] text-[#5B6E68]">
                Σ MARP trade: <span className="font-mono text-[#33544C]">{fmtUsd(marp.totalTradeUsd)}</span>
                {" · "}MARP is the <span className="text-[#33544C]">ACTIVE execution path</span> in the simulated pilot
                (<code className="font-mono text-mtqs-gold">USE_MARP_EXECUTION=true</code> · testnet shadow mode) —
                eligible decisions mutate the pilot ledger <span className="text-[#33544C]">at execution time</span>, subject to the
                §11.5.2 daily-turnover budget (5% NAV), §11.5.3 direction locks and §11.4 liquidity caps — the
                “last execution pass” line above reports what actually executed; no on-chain settlement occurs.
              </div>
            </Panel>
          </Reveal>
        )}
      </section>
    </div>
  );
}

// FIX 1.5 — `governance` section: 4 councils + honest status.
//   Fetches /api/honest-status.
interface HonestStatusResp {
  protocol: string;
  status: string;
  isProductionAuthorized: boolean;
  implementedMask: number;
  authorizedMask: number;
  version: string;
  gateSummary?: { passed: number; total: number; remaining: number; productionReady: boolean };
  validationGates?: Array<{ id: string; name: string; description: string; passed: boolean; evidence: string }>;
  disclaimer?: string;
  computedAt: string;
}

const COUNCILS = [
  // F-52-1 (Task-52 audit): authority strings now mirror the canonical
  // GOVERNANCE_HIERARCHY (blueprint.ts §22) exactly — the Emergency layer is
  // a Multi-Sig (4/7), NOT a "Council" (this card previously said "Council
  // 4/7", disagreeing with the Risk State tab's canonical hierarchy cards and
  // the Security/Architecture tabs).
  { name: "Constitutional", icon: Crown, authority: "Multi-Sig 7/7", timelock: "90 days", scope: "Immutable parameters · core architecture · envelopes · hard floors · liquidation staging", tone: "gold" as const },
  { name: "Monetary DAO",   icon: Landmark, authority: "DAO Vote 51%", timelock: "48 hours", scope: "RR target · fee structure · smoothing parameters", tone: "emerald" as const },
  { name: "Risk Council",   icon: ShieldIcon, authority: "Council 4/7", timelock: "24 hours", scope: "Haircuts · thresholds · eject parameters · LCR targets", tone: "amber" as const },
  { name: "Emergency Council", icon: AlertTriangle, authority: "Multi-Sig 4/7", timelock: "instant", scope: "Pause operations · force rebalance · emergency eject", tone: "rose" as const },
];

function GovernanceSection() {
  const [honest, setHonest] = useState<HonestStatusResp | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    fetch("/api/honest-status", { cache: "no-store" })
      .then((r) => {
        // 16c-004 fix: a 429/503 body is {error,…} — storing it as the
        // honest-status payload left the pill reading "loading" forever.
        // Guard so the honest "unavailable" branch renders instead (and
        // any last-good data is kept — there is none in this one-shot fetch).
        if (!r.ok) throw new Error(`honest-status ${r.status}`);
        return r.json();
      })
      .then((j: HonestStatusResp) => { if (mounted) setHonest(j); })
      .catch(() => { /* keep last-good / render the honest unavailable state */ })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-10">
      <section id="governance-councils" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§22 · GOVERNANCE"
          title="4-Council Governance Architecture"
          right={
            <Pill tone="gold">
              <Scale className="h-3 w-3" />
              layered timelocks
            </Pill>
          }
        />
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {COUNCILS.map((c) => {
              const Icon = c.icon;
              const toneCls =
                c.tone === "gold" ? "border-mtqs-gold/30 bg-mtqs-gold/[0.06]" :
                c.tone === "emerald" ? "border-emerald-400/30 bg-emerald-400/[0.05]" :
                c.tone === "amber" ? "border-mtqs-amber/30 bg-mtqs-amber/[0.05]" :
                "border-mtqs-rose/30 bg-mtqs-rose/[0.05]";
              const iconCls =
                c.tone === "gold" ? "text-mtqs-gold" :
                c.tone === "emerald" ? "text-emerald-600" :
                c.tone === "amber" ? "text-mtqs-amber" :
                "text-mtqs-rose";
              return (
                <Panel key={c.name} className={`p-5 ${toneCls}`}>
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex items-center justify-center rounded-md border border-[#E3EAE6] bg-[#F0F7F4] p-2 ${iconCls}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-semibold text-[#0E1F1B]">{c.name}</h3>
                        <Pill tone={c.tone === "gold" ? "gold" : c.tone === "emerald" ? "emerald" : c.tone === "amber" ? "amber" : "rose"}>
                          {c.authority}
                        </Pill>
                      </div>
                      <div className="mt-1 text-[0.68rem] uppercase tracking-widest text-[#5B6E68]">
                        Timelock: <span className="font-mono text-[#33544C]">{c.timelock}</span>
                      </div>
                      <p className="mt-2 text-[0.75rem] text-[#33544C] leading-relaxed">{c.scope}</p>
                    </div>
                  </div>
                </Panel>
              );
            })}
          </div>
          {/* 16f-011: same OD-3 qualifier EventExplorer's governance rows carry —
              the 4 councils are SPECIFIED, none is constituted. */}
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[0.7rem] leading-relaxed text-[#5B6E68]">
            <span className="font-semibold text-mtqs-amber">SPECIFIED — NOT OPERATIONAL (OD-3 open).</span>{" "}
            These four layers are the blueprint&apos;s governance specification. No council is constituted
            and no signer is live (G9 NOT CONDUCTED) — no governance action has ever been executed.
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <Panel className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[#0E1F1B]">Authority Hierarchy</h3>
            </div>
            <div className="text-[0.72rem] text-[#33544C] leading-relaxed">
              Each parameter is owned by exactly one governance layer (§22.4 parameter registry).
              Constitutional parameters are <span className="text-mtqs-gold">immutable</span> (cannot be changed post-genesis) —
              including <code className="font-mono text-mtqs-gold">RR_TARGET = 1.10</code> and the RR hard floor
              (RR_TARGET is Constitutional per the v2.0 §14.6.3 correction; the former “Monetary” classification
              was a v1.x row). The other 3 layers may change their parameters within constitutional envelopes
              (e.g. <code className="font-mono text-mtqs-gold">LCR_TARGET ∈ [0.80, 1.20]</code>,
              <code className="font-mono text-mtqs-gold"> MIN_PROFITABILITY_USD ∈ [0, 1000]</code>).
              Emergency Council actions are instant (no timelock) — pause / force rebalance / emergency eject.
            </div>
          </Panel>
        </Reveal>
      </section>

      <section id="governance-honest" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§25.5 · HONEST STATUS"
          title="Honest Validation Gate Status"
          right={
            <Pill tone={honest?.isProductionAuthorized ? "emerald" : "rose"}>
              <GlowDot color={honest?.isProductionAuthorized ? "emerald" : "rose"} size="h-1.5 w-1.5" />
              {/* 16c-004: never show "loading" once the fetch settled — say
                  "unavailable" honestly when the endpoint did not answer. */}
              {honest?.status ?? (loading ? "loading" : "unavailable")}
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            {loading && !honest ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : honest ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                    <div className="text-[0.6rem] uppercase tracking-widest text-[#5B6E68]">Production Ready</div>
                    <div className={`font-mono text-base mt-1 ${honest.isProductionAuthorized ? "text-emerald-600" : "text-mtqs-rose"}`}>
                      {honest.isProductionAuthorized ? "YES" : "NO"}
                    </div>
                  </div>
                  <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                    <div className="text-[0.6rem] uppercase tracking-widest text-[#5B6E68]">Gates Passed</div>
                    <div className="font-mono text-base mt-1 text-[#0E1F1B]">
                      {honest.gateSummary ? `${honest.gateSummary.passed}/${honest.gateSummary.total}` : "—"}
                    </div>
                  </div>
                  <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                    <div className="text-[0.6rem] uppercase tracking-widest text-[#5B6E68]">Implemented Mask</div>
                    <div className="font-mono text-base mt-1 text-mtqs-gold">0x{honest.implementedMask.toString(16).toUpperCase()}</div>
                  </div>
                  <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                    <div className="text-[0.6rem] uppercase tracking-widest text-[#5B6E68]">Authorized Mask</div>
                    <div className="font-mono text-base mt-1 text-mtqs-rose">0x{honest.authorizedMask.toString(16).toUpperCase()}</div>
                  </div>
                </div>
                {honest.validationGates && honest.validationGates.length > 0 && (
                  <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] overflow-hidden">
                    <div className="max-h-72 overflow-y-auto mtqs-scroll">
                      {honest.validationGates.map((g, i) => (
                        <div key={g.id} className={`flex items-start gap-3 px-3 py-2.5 ${i % 2 ? "bg-[#FAFCFA]" : ""} border-t border-[#E3EAE6] first:border-t-0`}>
                          {g.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-mtqs-rose shrink-0 mt-0.5" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[0.7rem] text-mtqs-gold/85">{g.id}</span>
                              <span className="text-[0.78rem] text-[#0E1F1B] font-medium">{g.name}</span>
                            </div>
                            <div className="text-[0.7rem] text-[#5B6E68] mt-0.5">{g.description}</div>
                            {g.evidence && <div className="text-[0.65rem] text-[#7A8C86] mt-1 font-mono">{g.evidence}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[0.7rem] text-[#33544C] leading-relaxed">
                  <span className="text-mtqs-amber font-medium">Disclaimer: </span>
                  {honest.disclaimer ?? "MTQΣ testnet honest status — NOT PRODUCTION-AUTHORIZED."}
                </div>
                <div className="text-[0.62rem] text-[#7A8C86] font-mono">
                  version: {honest.version} · computed: {honest.computedAt}
                </div>
              </div>
            ) : (
              <div className="text-[0.78rem] text-[#5B6E68]">Honest status unavailable.</div>
            )}
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}

const SECTION_KEY = "mtqs.section";

/* T47 consolidation — sections removed from the registry live on under their
   merged parents. Any stale persisted id (sessionStorage written before the
   consolidation, or an old launch link) is redirected to its new home BEFORE
   the ALL_SECTIONS validation, so no visitor can ever restore a dead section. */
const LEGACY_SECTION_REDIRECT: Record<string, SectionId> = {
  networks: "contracts",
  architecture: "docs",
  pitch: "investors",
};

export function PilotCommandCenter({ onExit }: { onExit?: () => void }) {
  // Restore the last visited section (session persistence) so launching from
  // the landing page or refreshing keeps the user where they were.
  const [section, setSection] = useState<SectionId>(() => {
    if (typeof window === "undefined") return "overview";
    try {
      const saved = window.sessionStorage.getItem(SECTION_KEY);
      const mapped = saved ? LEGACY_SECTION_REDIRECT[saved] ?? saved : null;
      if (mapped && ALL_SECTIONS.some((s) => s.id === mapped)) {
        return mapped as SectionId;
      }
    } catch {
      /* storage unavailable — fall back to overview */
    }
    return "overview";
  });
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // COMMAND-RAIL: desktop sidebar layout mode ("full" labels | "rail" icons).
  // Persisted so the terminal remembers the operator's preference; the main
  // content margin transitions in lock-step via data-sidebar-mode.
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(() => {
    if (typeof window === "undefined") return "full";
    try {
      return window.localStorage.getItem("mtqs.sidebar-rail") === "1"
        ? "rail"
        : "full";
    } catch {
      return "full";
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "mtqs.sidebar-rail",
        sidebarMode === "rail" ? "1" : "0",
      );
    } catch {
      /* non-fatal */
    }
  }, [sidebarMode]);

  const handleSidebarMode = useCallback((m: SidebarMode) => {
    setSidebarMode(m);
  }, []);

  const fetchSnapshot = useCallback(async () => {
    // PERF: skip polling while the tab is hidden — the engine tick keeps
    // running server-side, so data is never lost, just not re-fetched.
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch("/api/metrics", { cache: "no-store" });
      if (!res.ok) throw new Error(`metrics ${res.status}`);
      const data = (await res.json()) as MetricsSnapshot;
      if (!mountedRef.current) return;
      setSnapshot(data);
      setError(null);
    } catch (e) {
      if (mountedRef.current) setError(String(e));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchSnapshot();
    const id = setInterval(fetchSnapshot, POLL_MS);
    // Refresh immediately when the tab becomes visible again (data may be
    // up to POLL_MS × N stale after a hidden period).
    const onVisible = () => {
      if (!document.hidden) fetchSnapshot();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchSnapshot]);

  // Scroll to top on section change (cinematic reset)
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [section]);

  // Persist the active section for refresh/relaunch continuity.
  useEffect(() => {
    try {
      window.sessionStorage.setItem(SECTION_KEY, section);
    } catch {
      /* non-fatal */
    }
  }, [section]);

  const handleNavigate = useCallback((id: SectionId) => {
    setSection(id);
  }, []);

  // Live oracle status (derived once for the Header) — removed 2026-10-23
  // (Task 14-fix-a): the Header never rendered these props (the LiveTicker
  // below it computes its own oracle text from the snapshot), so the dead
  // computation + dead props were deleted.

  return (
    <>
      <CinematicLoader />
      {/* Cmd+K Command Launcher — global keyboard-driven command palette (§59) */}
      <CommandLauncher onNavigate={handleNavigate} />

      <MotionConfig reducedMotion="user" transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
        {/* overflow-x-clip (NOT overflow-hidden): a fully-hidden ancestor
            creates a scroll container that silently BREAKS position:sticky
            for the TestnetStatusBar + Header + LiveTicker — all three
            scrolled away instead of pinning. overflow-x-clip still prevents
            horizontal overflow from decorative layers while keeping the
            vertical sticky behavior intact (fixed 2026-10-24). */}
        <div className="relative min-h-screen flex flex-col overflow-x-clip mtqs-space-bg mtqs-cinematic-page">
          {/* Futuristic grid backdrop */}
          <div className="pointer-events-none fixed inset-0 mtqs-grid-bg" aria-hidden="true" />

          {/* ─── SIDEBAR (full ↔ rail on desktop, drawer on mobile) ─── */}
          <Sidebar
            active={section}
            onChange={handleNavigate}
            snapshot={snapshot}
            error={error}
            mode={sidebarMode}
            onModeChange={handleSidebarMode}
            onExit={onExit}
          />

          {/* ─── MAIN CONTENT AREA (offset follows the sidebar mode) ─── */}
          <div
            className="mtqs-main-with-sidebar relative z-10 flex flex-col flex-1 min-w-0"
            data-sidebar-mode={sidebarMode}
          >
            {/* Top status bar (single instance) */}
            <TestnetStatusBar snapshot={snapshot} />

            {/* PAR1D Header — brand + status pill + NetworkSelector */}
            <Header
              snapshot={snapshot}
              error={error}
              onExit={onExit}
            />

            {/* Live ticker strip */}
            <LiveTicker snapshot={snapshot} />

            {/* Main content with cinematic transitions */}
            <main
              id="mtqs-main"
              className="relative z-10 flex-1 mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-16 md:pb-0"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={section}
                  variants={sectionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* ─── PRIMARY ─────────────────────────────────────────── */}
                  {section === "overview" && <HomeSection onNavigate={handleNavigate} snapshot={snapshot} />}
                  {section === "network" && <NetworkSection />}
                  {section === "explorer" && <ExplorerSection />}
                  {section === "reference" && <ReferenceSection />}
                  {section === "reserve" && <ReserveSection snapshot={snapshot} />}
                  {section === "risk" && <RiskSection snapshot={snapshot} />}
                  {section === "rebalancing" && <RebalancingSection snapshot={snapshot} />}
                  {section === "transparency" && (
                    <TransparencySection onNavigate={handleNavigate} snapshot={snapshot} />
                  )}
                  {section === "governance" && <GovernanceSection />}
                  {section === "validation" && (
                    <div className="space-y-10">
                      <ValidationResearchSection onNavigate={handleNavigate} snapshot={snapshot} />
                      <TestsSection onNavigate={handleNavigate} />
                    </div>
                  )}
                  {section === "evidence" && (
                    <div className="space-y-10">
                      {/* Evidence Reconciliation & Pre-Remediation Control Directive — review-only package (NOT ACCEPTED) */}
                      <EvidencePackageSection />
                    </div>
                  )}
                  {section === "developers" && (
                    <DevelopersSection onNavigate={handleNavigate} snapshot={snapshot} />
                  )}

                  {/* ─── USER OPERATIONS ─────────────────────────────────── */}
                  {section === "mint" && (
                    <MintSection onNavigate={handleNavigate} snapshot={snapshot} />
                  )}
                  {section === "redeem" && (
                    <RedeemSection onNavigate={handleNavigate} snapshot={snapshot} />
                  )}
                  {section === "wallet" && <WalletSection onNavigate={handleNavigate} />}
                  {section === "staking" && <StakingSection onNavigate={handleNavigate} />}
                  {section === "portfolio" && <DashboardSection snapshot={snapshot} onNavigate={handleNavigate} />}
                  {section === "activity" && (
                    <div className="space-y-10">
                      <section id="activity-explorer" className="scroll-mt-32">
                        <SectionHeading
                          eyebrow="§42 · explorer"
                          title="Protocol Event Explorer"
                          right={
                            <Pill tone="emerald">
                              <GlowDot color="emerald" size="h-1.5 w-1.5" />
                              live + synthetic
                            </Pill>
                          }
                        />
                        <Reveal>
                          <EventExplorer limit={60} />
                        </Reveal>
                      </section>
                    </div>
                  )}

                  {/* ─── SUPPORTING ──────────────────────────────────────── */}
                  {section === "simulation" && (
                    <SimulationSection onNavigate={handleNavigate} snapshot={snapshot} />
                  )}
                  {section === "constituency" && (
                    <ConstituencySection onNavigate={handleNavigate} snapshot={snapshot} />
                  )}
                  {section === "issuance" && (
                    <IssuanceSection onNavigate={handleNavigate} snapshot={snapshot} />
                  )}
                  {section === "docs" && (
                    <div className="space-y-10">
                      {/* T47: the former Architecture tab (Blueprint v2.0 Ch 26 +
                          appendices — final declarations, two-engine hierarchy,
                          Four Weight States, deployment checklist, glossary)
                          renders under the Docs reference — one blueprint tab. */}
                      <DocsSection onNavigate={handleNavigate} snapshot={snapshot} />
                      <ArchitectureSection onNavigate={handleNavigate} snapshot={snapshot} />
                    </div>
                  )}
                  {section === "security" && <SecuritySection onNavigate={handleNavigate} />}
                  {section === "authorization" && (
                    <div className="space-y-10">
                      {/* T47: MandateCompliance moved here from Validation — its
                          OD-35 Safe custody evidence, role/authorization register
                          and OD/C/T registers belong with the authorization audit
                          (its OD-34 oracle content complements Contracts & Chains). */}
                      <AuthorizationAuditSection />
                      <MandateCompliance />
                    </div>
                  )}
                  {section === "contracts" && (
                    <div className="space-y-10">
                      {/* T47: the former Networks tab renders under the contract
                          registry — chain metadata (RPC / explorer / deployer /
                          canonical addresses) renders once in the registry above;
                          the OD-34 oracle deployment registry, chain policy notes
                          and §1.7 verification banner render below. */}
                      <ContractsSection onNavigate={handleNavigate} />
                      <NetworksSection onNavigate={handleNavigate} snapshot={snapshot} />
                    </div>
                  )}
                  {section === "faucet" && (
                    <div className="space-y-10">
                      <section id="faucet-panel" className="scroll-mt-32">
                        <SectionHeading
                          eyebrow="§41 · testnet"
                          title="Testnet Faucet"
                          right={
                            <Pill tone="amber">
                              <GlowDot color="amber" size="h-1.5 w-1.5" />
                              simulated · no real value
                            </Pill>
                          }
                        />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <Reveal>
                            <FaucetPanel />
                          </Reveal>
                          <Reveal delay={0.05}>
                            <div className="space-y-4">
                              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                                <h3 className="text-sm font-semibold text-mtqs-amber mb-2 flex items-center gap-2">
                                  <GlowDot color="amber" size="h-2 w-2" />
                                  What this faucet does
                                </h3>
                                <ul className="text-[0.78rem] text-[#33544C] space-y-2 leading-relaxed list-disc list-inside">
                                  <li>Picks a testnet network + test asset + wallet address + claim amount. The asset selection is <span className="text-mtqs-amber">cosmetic</span> — every claim is processed as a USD-equivalent test value through the USDC mint path (the trial log records it as USDC).</li>
                                  <li>Calls <code className="font-mono text-mtqs-gold">/api/simulate/mint</code> which mints MTQ against the live pilot engine — fees, RR, and circulating supply are real state changes.</li>
                                  <li>Generates a deterministic simulated tx hash + block number so the UI feels like a real faucet. No on-chain broadcast.</li>
                                  <li>30-second cooldown after each successful claim — prevents spamming the engine&apos;s mint path.</li>
                                  <li>All assets are simulated. <span className="text-mtqs-rose font-medium">No real value.</span></li>
                                </ul>
                              </div>
                              <div className="rounded-xl border border-[#E3EAE6] bg-[#F7FAF8] p-5">
                                <h3 className="text-sm font-semibold text-[#0E1F1B] mb-2">Available test assets</h3>
                                <div className="grid grid-cols-2 gap-2 text-[0.72rem]">
                                  <div className="rounded-md border border-[#E3EAE6] px-2 py-1.5">
                                    <div className="font-mono text-mtqs-gold">MON</div>
                                    <div className="text-[#5B6E68]">Monad testnet</div>
                                  </div>
                                  <div className="rounded-md border border-[#E3EAE6] px-2 py-1.5">
                                    <div className="font-mono text-mtqs-gold">MockUSDC</div>
                                    <div className="text-[#5B6E68]">pilot collateral</div>
                                  </div>
                                  <div className="rounded-md border border-[#E3EAE6] px-2 py-1.5">
                                    <div className="font-mono text-mtqs-gold">SOL</div>
                                    <div className="text-[#5B6E68]">Solana devnet</div>
                                  </div>
                                  <div className="rounded-md border border-[#E3EAE6] px-2 py-1.5">
                                    <div className="font-mono text-mtqs-gold">MTQ</div>
                                    <div className="text-[#5B6E68]">protocol claim</div>
                                  </div>
                                  <div className="rounded-md border border-[#E3EAE6] px-2 py-1.5">
                                    <div className="font-mono text-mtqs-gold">USDC</div>
                                    <div className="text-[#5B6E68]">Arc testnet</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Reveal>
                        </div>
                      </section>
                    </div>
                  )}

                  {/* ─── INSTITUTIONAL (Dashboard = InstitutionalDashboard) ─── */}
                  {section === "investors" && (
                    <div className="space-y-10">
                      <section id="institutional-dashboard" className="scroll-mt-32">
                        <SectionHeading
                          eyebrow="UPSCALE-1 · for banks + institutional users"
                          title="Institutional Dashboard"
                          right={
                            <Pill tone="amber">
                              <GlowDot color="amber" size="h-1.5 w-1.5" />
                              14 blueprint modules · live API
                            </Pill>
                          }
                        />
                        <InstitutionalDashboard />
                      </section>
                      <InvestorSection onNavigate={handleNavigate} snapshot={snapshot} />
                      {/* T47: the restricted Pitch Deck renders here — a
                          fundraising deck is not pilot functionality, but stays
                          reachable on the investors surface for owner demos. */}
                      <PitchSection onNavigate={handleNavigate} />
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </main>

            {/* Footer (sticky-bottom via mt-auto on the flex column) */}
            <Footer onExit={onExit} />
          </div>

          {/* Mobile bottom nav (5 most important sections) */}
          <MobileBottomNav active={section} onNavigate={handleNavigate} />
        </div>
      </MotionConfig>
    </>
  );
}
