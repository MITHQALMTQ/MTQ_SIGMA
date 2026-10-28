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
import { DevelopersSection } from "@/components/mtq/sections/DevelopersSection";
import { MandateCompliance } from "@/components/mtq/MandateCompliance";
import { EvidencePackageSection } from "@/components/mtq/EvidencePackageSection";
import { InstitutionalDashboard } from "@/components/mtq/InstitutionalDashboard";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { OracleBoard } from "@/lib/mtq/oracle";
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
const fmtRatio = (n: number | null | undefined, d = 2): string =>
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
  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch("/api/gfb", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/oracle", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]).then(([g, o]) => {
      if (!mounted) return;
      if (g && typeof g.gfbIndex === "number") setGfb(g);
      if (o && Array.isArray(o.pairs)) setOracle(o as OracleBoard);
      setLoading(false);
    });
    return () => { mounted = false; };
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
                      <MiniBar value={c.weight} max={0.30} colorClass="bg-mtqs-gold" className="mb-1" />
                      {liveW != null ? (
                        <MiniBar value={liveW} max={0.30} colorClass="bg-mtqs-emerald" className="mb-1" />
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
                      {price != null ? `$${price.toFixed(price < 2 ? 4 : 2)}` : "—"}
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
              (USD 27 · EUR 20 · Gold 26 · JPY 9 · GBP 8 · CNY 5 · CHF 5). Prices on this board are recorded from the
              canonical oracle board at section open (one-shot read — the live 4s stream renders in the Dashboard).
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
              {oracle?.anyPaused ? "any paused (I9 halt)" : "6 pairs · recorded at open"}
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
                          {p.finalPrice > 0 ? `$${p.finalPrice.toFixed(p.finalPrice < 2 ? 4 : 2)}` : "—"}
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
                <span className={`text-2xl font-mono tabular-nums ${snapshot && snapshot.reserveRatio < 1.05 ? "text-mtqs-rose" : "text-emerald-600"}`}>
                  {snapshot ? fmtRatio(snapshot.reserveRatio) : <Skeleton className="h-7 w-20 inline-block" />}
                </span>
              } sub={`target ≥ ${(1.10 * 100).toFixed(0)}% · hard floor ${(1.00 * 100).toFixed(0)}%`} />
            </Panel>
            <Panel className="p-5">
              <Stat label="LCR (liquidity coverage)" value={
                <span className={`text-2xl font-mono tabular-nums ${snapshot && snapshot.lcr < 1.0 ? "text-mtqs-rose" : "text-emerald-600"}`}>
                  {snapshot ? fmtRatio(snapshot.lcr) : <Skeleton className="h-7 w-20 inline-block" />}
                </span>
              } sub={`target ≥ ${(1.00 * 100).toFixed(0)}%`} />
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
const RISK_TONE: Record<string, "emerald" | "amber" | "rose"> = {
  NORMAL: "emerald",
  CAUTION: "amber",
  STRESS: "amber",
  DEFENSIVE: "rose",
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
                  applied: <span className="font-mono text-[#33544C]">{snapshot.marpExecution.appliedCount}</span>
                  {" · "}skipped: <span className="font-mono text-[#33544C]">{snapshot.marpExecution.skippedCount}</span>
                  {" · "}Σ trade: <span className="font-mono text-[#33544C]">{fmtUsd(snapshot.marpExecution.totalTradeUsd)}</span>
                </span>
              )}
            </div>
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
                applied decisions mutate the pilot ledger; no on-chain settlement occurs.
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
  { name: "Constitutional", icon: Crown, authority: "Multi-Sig 7/7", timelock: "90 days", scope: "Immutable parameters · core architecture · envelopes · hard floors · liquidation staging", tone: "gold" as const },
  { name: "Monetary DAO",   icon: Landmark, authority: "DAO Vote 51%", timelock: "48 hours", scope: "RR target · fee structure · smoothing parameters", tone: "emerald" as const },
  { name: "Risk Council",   icon: ShieldIcon, authority: "Council 4/7", timelock: "24 hours", scope: "Haircuts · thresholds · eject parameters · LCR targets", tone: "amber" as const },
  { name: "Emergency Council", icon: AlertTriangle, authority: "Council 4/7", timelock: "instant", scope: "Pause operations · force rebalance · emergency eject", tone: "rose" as const },
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

export function PilotCommandCenter({ onExit }: { onExit?: () => void }) {
  // Restore the last visited section (session persistence) so launching from
  // the landing page or refreshing keeps the user where they were.
  const [section, setSection] = useState<SectionId>(() => {
    if (typeof window === "undefined") return "overview";
    try {
      const saved = window.sessionStorage.getItem(SECTION_KEY);
      if (saved && ALL_SECTIONS.some((s) => s.id === saved)) {
        return saved as SectionId;
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
                      <MandateCompliance />
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
                  {section === "architecture" && (
                    <ArchitectureSection onNavigate={handleNavigate} snapshot={snapshot} />
                  )}
                  {section === "docs" && (
                    <DocsSection onNavigate={handleNavigate} snapshot={snapshot} />
                  )}
                  {section === "security" && <SecuritySection onNavigate={handleNavigate} />}
                  {section === "contracts" && <ContractsSection onNavigate={handleNavigate} />}
                  {section === "authorization" && <AuthorizationAuditSection />}
                  {section === "networks" && (
                    <NetworksSection onNavigate={handleNavigate} snapshot={snapshot} />
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
                    </div>
                  )}
                  {section === "pitch" && <PitchSection onNavigate={handleNavigate} />}

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
