// MTQΣ — Home Section (UI-REDESIGN)
// Breathtaking home composition built on the new premium primitives.
//
// Layout (top → bottom):
//   1. InstitutionalHero — full-viewport PAR1D centerpiece + live pills
//   2. Quick stats row — 4 StatCards (NAV · RR · MTQ Price · Status)
//   3. What is MTQΣ? — three glass cards (Index / Token / Reserve)
//   4. Tokenized Gold — PAXG / XAUT / Gold Weight gauge
//   5. Constitutional Separation — signature visual
//   6. Live Monetary State — GFB chart + 4 stat tiles + basket display
//   7. Reference Index Chart — time-range chart with markers
//   8. MTQΣ on 4 Testnets — canonical address cards
//   9. Closing call-out — explore the closed-loop architecture
//
// Props: { onNavigate } — used by the hero CTAs.

"use client";

import { useEffect, useRef, useState } from "react";
import {
  SectionHeading,
  Reveal,
  Panel,
  Pill,
  GlowDot,
  BrandPrinciples,
  Skeleton,
  StatCard,
  PremiumCard,
  SectionFade,
  GlowBadge,
} from "@/components/mtq/primitives";
import { InstitutionalHero } from "@/components/mtq/InstitutionalHero";
import { ConstitutionalSeparation } from "@/components/mtq/ConstitutionalSeparation";
import { GfbChart } from "@/components/mtq/GfbChart";
import { ReferenceChart } from "@/components/mtq/ReferenceChart";
import { ParticleField } from "@/components/mtq/ParticleField";
import { BasketValueDisplay } from "@/components/mtq/BasketValueDisplay";
import { BRAND_VOICE, STATUS_COLORS } from "@/lib/mtq/brand";
import { CANONICAL_MTQ_ADDRESSES } from "@/lib/mtq/contracts";
import { fmtFixed, fmtUsdCompact, fmtRatio, shortAddr, copyToClipboard } from "@/components/mtq/format";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { SectionId } from "@/components/mtq/Navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  Activity,
  Coins,
  Layers,
  Shield,
  TrendingUp,
  Scale,
} from "lucide-react";

/* ---------- ClientOnly — defers children until after mount (hydration-safe) ---------- */
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}

/* ---------- What is MTQΣ? — 3 cards ---------- */
const WHAT_IS = [
  {
    icon: Activity,
    eyebrow: "§2 · The Index",
    title: "Adaptive Reference Basket",
    body:
      "A 7-component Strategic Prior basket (USD 27% · EUR 20% · JPY 9% · GBP 8% · CNY 5% · CHF 5% · Gold 26%). Gold is a first-class index component (20-32% admissibility envelope). The Index defines what one MTQΣ is intended to represent — global purchasing power.",
  },
  {
    icon: Coins,
    eyebrow: "§3 · The Token",
    title: "MTQΣ Token",
    body:
      "An ERC-20 (and SPL) unit whose reference value equals the Adaptive Reference Basket. Minted against, and redeemed into, the reserve portfolio — never fiat-printed, never algorithmic.",
  },
  {
    icon: Shield,
    eyebrow: "§4 · The Reserve",
    title: "Reserve Portfolio",
    body:
      "Audited collateral (stablecoins + tokenized gold) held at a 110% Reserve Ratio target. The reserve exists to collateralize the MTQΣ obligation — not to speculate. In v1.0, index gold and reserve gold are mandatorily separate.",
  },
];

/* ---------- Quick stats row — 4 StatCards (NAV, RR, MTQ Price, Status) ---------- */
function QuickStatsRow({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const rrTxt =
    snapshot && Number.isFinite(snapshot.reserveRatio)
      ? fmtRatio(snapshot.reserveRatio)
      : "∞";
  const rrTone: "gold" | "emerald" | "rose" | "neutral" =
    !snapshot || !Number.isFinite(snapshot.reserveRatio)
      ? "emerald"
      : snapshot.reserveRatio >= 1.1
      ? "emerald"
      : snapshot.reserveRatio >= 1.05
      ? "gold"
      : "rose";
  const rrTrend: "up" | "down" | "neutral" =
    rrTone === "emerald" ? "up" : rrTone === "rose" ? "down" : "neutral";

  const status = snapshot?.status ?? "NORMAL";
  const sb = STATUS_COLORS[status] ?? STATUS_COLORS.NORMAL;
  const statusTone: "gold" | "emerald" | "rose" | "neutral" =
    status === "NORMAL"
      ? "emerald"
      : status === "CAUTION" || status === "RECOVERY"
      ? "gold"
      : "rose";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        icon={TrendingUp}
        label="Reserve NAV"
        tone="gold"
        trendDirection="neutral"
        trend="liability collateral"
        value={snapshot ? fmtUsdCompact(snapshot.nav) : null}
      />
      <StatCard
        icon={Scale}
        label="Reserve Ratio"
        tone={rrTone}
        trendDirection={rrTrend}
        trend={snapshot?.reserveRatio != null && snapshot.reserveRatio >= 1.1 ? "above target" : "below target"}
        value={rrTxt}
      />
      <StatCard
        icon={Coins}
        label="MTQ Reference Value"
        tone={snapshot?.priceInBand ? "emerald" : "rose"}
        trendDirection={snapshot?.priceInBand ? "up" : "down"}
        trend={snapshot?.priceInBand ? "in safety band" : "outside band"}
        value={snapshot ? fmtFixed(snapshot.mtqPrice, 4) : null}
      />
      <StatCard
        icon={Shield}
        label="Protocol Status"
        tone={statusTone}
        trendDirection={status === "NORMAL" ? "up" : status === "EMERGENCY" || status === "DEFENSIVE" ? "down" : "neutral"}
        trend="§21 state machine"
        value={sb.label}
      />
    </div>
  );
}

/* ---------- Live stats band (GFB / Price / NAV / RR) ---------- */
function LiveStatsBand({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const rrTxt = snapshot && Number.isFinite(snapshot.reserveRatio)
    ? fmtRatio(snapshot.reserveRatio)
    : "—";
  const rrTone =
    !snapshot || !Number.isFinite(snapshot.reserveRatio)
      ? "text-mtqs-emerald"
      : snapshot.reserveRatio >= 1.1
      ? "text-mtqs-emerald"
      : snapshot.reserveRatio >= 1.05
      ? "text-mtqs-amber"
      : "text-mtqs-rose";

  const stats = [
    { label: "Reference Index", value: snapshot ? fmtFixed(snapshot.gfbIndex, 4) : null, tone: "text-mtqs-gold-light" },
    { label: "Reference Value", value: snapshot ? fmtFixed(snapshot.mtqPrice, 4) : null, tone: snapshot?.priceInBand ? "text-mtqs-emerald" : "text-mtqs-rose" },
    { label: "Reserve NAV", value: snapshot ? fmtUsdCompact(snapshot.nav) : null, tone: "text-white" },
    { label: "Reserve Ratio", value: snapshot ? rrTxt : null, tone: rrTone },
  ];

  return (
    <div className="space-y-6">
      <div className="relative">
        <ParticleField count={20} />
        <GfbChart snapshot={snapshot} height={160} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Panel key={s.label} className="p-4 sm:p-5">
          <div className="flex items-center gap-1.5 mb-2">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            <span className="text-[0.6rem] uppercase tracking-[0.22em] text-white/55">
              {s.label}
            </span>
          </div>
          {s.value ? (
            <div className={`font-mono tabular-nums text-xl sm:text-2xl font-semibold ${s.tone}`}>
              {s.value}
            </div>
          ) : (
            <Skeleton className="h-7 w-24" />
          )}
        </Panel>
      ))}
      </div>
      <BasketValueDisplay snapshot={snapshot} />
    </div>
  );
}

/* ---------- Testnet cards (4 canonical MTQΣ addresses) ---------- */
function TestnetCards() {
  const entries = Object.entries(CANONICAL_MTQ_ADDRESSES);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {entries.map(([id, info]) => (
        <PremiumCard key={id} className="p-4 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-white/55">
                {info.chain}
              </div>
              <div className="mtqs-display mtqs-gold-gradient-text text-base font-semibold leading-none mt-1">
                MTQΣ
              </div>
            </div>
            <GlowBadge variant="gold" className="font-mono">cid {String(info.chainId)}</GlowBadge>
          </div>
          <div className="font-mono text-[0.72rem] text-mtqs-gold break-all leading-relaxed">
            {info.address}
          </div>
          <div className="mt-auto flex items-center justify-between pt-1">
            <button
              onClick={async (e) => {
                e.preventDefault();
                const ok = await copyToClipboard(info.address);
                if (ok) toast.success(`Copied ${info.chain} MTQΣ address`, { description: shortAddr(info.address, 8, 6) });
                else toast.error("Copy failed");
              }}
              className="text-[0.65rem] font-mono text-mtqs-gold/70 hover:text-mtqs-gold transition"
            >
              copy
            </button>
            <a
              href={info.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.65rem] text-mtqs-emerald/80 hover:text-mtqs-emerald transition"
            >
              explorer ↗
            </a>
          </div>
        </PremiumCard>
      ))}
    </div>
  );
}

export function HomeSection({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/metrics", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as MetricsSnapshot;
        if (!cancelled && mountedRef.current) setSnapshot(data);
      } catch {
        /* ignore — keep last good snapshot */
      }
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      mountedRef.current = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="space-y-16">
      {/* ===== Institutional Hero (§8-9) — breathtaking PAR1D centerpiece ===== */}
      <InstitutionalHero snapshot={snapshot} onNavigate={onNavigate} />

      {/* Brand principles under hero */}
      <div className="-mt-8 flex justify-center">
        <BrandPrinciples />
      </div>

      {/* ===== Quick stats row — 4 StatCards (NAV, RR, MTQ Price, Status) ===== */}
      <SectionFade>
        <section aria-labelledby="home-quick-stats">
          <h2 id="home-quick-stats" className="sr-only">Quick protocol stats</h2>
          <QuickStatsRow snapshot={snapshot} />
        </section>
      </SectionFade>

      {/* ===== What is MTQΣ? ===== */}
      <SectionFade>
        <section aria-labelledby="home-what">
          <SectionHeading eyebrow="§1.1 · The Three Pillars" title="What is MTQΣ?" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {WHAT_IS.map((c, i) => {
              const Icon = c.icon;
              return (
                <Reveal key={c.title} delay={i * 0.05}>
                  <PremiumCard className="p-5 sm:p-6 h-full flex flex-col gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="inline-flex items-center justify-center rounded-md border border-mtqs-gold/25 bg-mtqs-gold/10 p-2">
                        <Icon className="h-4 w-4 text-mtqs-gold-light" aria-hidden="true" />
                      </div>
                      <span className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
                        {c.eyebrow}
                      </span>
                    </div>
                    <h3 className="mtqs-display text-xl font-semibold text-white">{c.title}</h3>
                    <p className="text-[0.78rem] text-white/55 leading-relaxed">{c.body}</p>
                  </PremiumCard>
                </Reveal>
              );
            })}
          </div>
        </section>
      </SectionFade>

      {/* ===== Tokenized Gold (PAXG + XAUT) — visible upfront ===== */}
      <SectionFade>
        <section aria-labelledby="home-gold">
          <SectionHeading eyebrow="§3.2 + §4 + §8 · Bullion" title="Tokenized Gold — in BOTH the Index and the Reserve" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PAXG card — GOLD TINTED */}
            <Reveal delay={0}>
              <div className="p-5 rounded-[20px] h-full" style={{ background: 'rgba(232,185,100,0.4)', border: '1px solid rgba(232,185,100,0.4)', boxShadow: '0 0 20px rgba(232,185,100,0.1)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f5d27a, #e8b964)', boxShadow: '0 0 12px rgba(232,185,100,0.3)' }}>
                    <span className="text-lg">🥇</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-amber-100">PAXG</div>
                    <div className="text-[0.65rem] text-mtqs-gold/60">Paxos Gold</div>
                  </div>
                </div>
                <div className="text-2xl font-mono mtqs-gold-text">
                  {snapshot ? fmtUsdCompact(snapshot.perIssuer?.paxgUsd ?? (snapshot.reserve.goldNet / 2)) : "—"}
                </div>
                <div className="text-[0.7rem] text-mtqs-gold/60 mt-1">
                  1 PAXG = 1 troy oz gold · {snapshot ? `$${fmtFixed(snapshot.reserve.goldPrice, 0)}` : "—"}/oz
                </div>
                <div className="mt-2 text-[0.7rem] text-mtqs-gold/50">
                  Haircut: 1.0% · Issuer: Paxos
                </div>
              </div>
            </Reveal>
            {/* XAUT card — GOLD TINTED */}
            <Reveal delay={0.05}>
              <div className="p-5 rounded-[20px] h-full" style={{ background: 'rgba(208,160,79,0.35)', border: '1px solid rgba(208,160,79,0.35)', boxShadow: '0 0 20px rgba(208,160,79,0.08)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #e0c068, #d4a44f)', boxShadow: '0 0 12px rgba(208,160,79,0.3)' }}>
                    <span className="text-lg">🥇</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-amber-100">XAUT</div>
                    <div className="text-[0.65rem] text-mtqs-gold/60">Tether Gold</div>
                  </div>
                </div>
                <div className="text-2xl font-mono mtqs-gold-text">
                  {snapshot ? fmtUsdCompact(snapshot.perIssuer?.xautUsd ?? (snapshot.reserve.goldNet / 2)) : "—"}
                </div>
                <div className="text-[0.7rem] text-mtqs-gold/60 mt-1">
                  1 XAUT = 1 troy oz gold · {snapshot ? `$${fmtFixed(snapshot.reserve.goldPrice, 0)}` : "—"}/oz
                </div>
                <div className="mt-2 text-[0.7rem] text-mtqs-gold/50">
                  Haircut: 1.0% · Issuer: Tether
                </div>
              </div>
            </Reveal>
            {/* Gold Weight gauge card */}
            <Reveal delay={0.1}>
              <Panel variant="emerald" className="p-5 h-full">
                <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55 mb-3">Gold Weight (§6.5 + §8, legacy buffer path)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[0.65rem] text-white/55">Observed</div>
                    <div className="text-xl font-mono text-mtqs-gold">{snapshot ? `${(snapshot.observedGoldWeight * 100).toFixed(2)}%` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[0.65rem] text-white/55">Target</div>
                    <div className="text-xl font-mono text-mtqs-emerald">{snapshot ? `${(snapshot.targetGoldWeight * 100).toFixed(2)}%` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[0.65rem] text-white/55">Buffer State</div>
                    <div className="text-sm font-mono text-mtqs-gold">{snapshot?.bufferState ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-[0.65rem] text-white/55">Buffer Au</div>
                    <div className="text-sm font-mono text-mtqs-gold">{snapshot ? `${(snapshot.bufferGoldRatio * 100).toFixed(1)}%` : "—"}</div>
                  </div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-500/60 to-amber-300/80" style={{ width: `${(snapshot?.observedGoldWeight ?? 0) * 100 / 30 * 100}%` }} />
                </div>
                <div className="flex justify-between text-[0.6rem] text-white/55 mt-1">
                  <span>20% envelope floor</span>
                  <span>32% envelope ceiling</span>
                </div>
                <div className="mt-2 text-[0.65rem] text-white/55">
                  Total gold net: <span className="font-mono text-mtqs-gold">{snapshot ? fmtUsdCompact(snapshot.reserve.goldNet) : "—"}</span>
                </div>
              </Panel>
            </Reveal>
          </div>
          <p className="mt-3 text-[0.7rem] text-white/55 max-w-3xl">
            Gold is in <span className="text-mtqs-gold font-medium">BOTH</span> the Adaptive Reference Basket (26% Strategic Prior,
            20-32% admissibility envelope per §8.1) <span className="italic">and</span> the reserve portfolio
            (§4, §8.3). In v1.0 these two roles are <span className="text-mtqs-gold font-medium">mandatorily
            separate</span> per §14.1: the index gold defines what 1 MTQ represents (purchasing power); the
            reserve gold is sized by obligations, liquidity, custody, and redemption risk — not by the
            index weight. The pilot&apos;s current state uses the same physical PAXG + XAUT holdings for
            both roles (the legacy §6/§7/§8 buffer path retained until the MASE ensemble replaces it);
            a future task will physically separate them. The §6 Adaptive Macro Engine adjusts the
            target ±3pp based on VIX/DXY z-scores; the §7 Rebalancing Engine trades toward the target
            with 24h direction lock + 1% slippage protection.
          </p>
        </section>
      </SectionFade>

      {/* ===== Constitutional Separation (ClientOnly — hydration-safe) ===== */}
      <SectionFade>
        <section aria-labelledby="home-constitutional">
          <SectionHeading
            eyebrow="§1.1 · Signature Visual"
            title="Constitutional Separation"
            right={<GlowBadge variant="gold">A · B · C</GlowBadge>}
          />
          <Reveal>
            <PremiumCard className="p-5 sm:p-6">
              <p className="mb-4 text-[0.78rem] text-white/55 leading-relaxed max-w-2xl">
                The Adaptive Reference Basket defines what one MTQΣ is intended to represent. The reserve
                portfolio exists to collateralize that obligation. The two are constitutionally
                separate: the reserve cannot dilute the index, and the index cannot be redefined
                to mask a reserve shortfall.
              </p>
              <ClientOnly>
                <ConstitutionalSeparation snapshot={snapshot} />
              </ClientOnly>
              <noscript>
                <p className="text-[0.72rem] text-white/55">
                  The Constitutional Separation diagram requires JavaScript to render.
                </p>
              </noscript>
            </PremiumCard>
          </Reveal>
        </section>
      </SectionFade>

      {/* ===== Live stats band ===== */}
      <SectionFade>
        <section aria-labelledby="home-stats">
          <SectionHeading
            eyebrow="Live · 4s poll"
            title="Live Monetary State"
            right={
              <Pill tone={snapshot?.oraclePaused ? "rose" : "emerald"}>
                <GlowDot color={snapshot?.oraclePaused ? "rose" : "emerald"} size="h-1.5 w-1.5" />
                {snapshot?.oraclePaused ? "oracle paused" : "oracle live"}
              </Pill>
            }
          />
          <LiveStatsBand snapshot={snapshot} />
        </section>
      </SectionFade>

      {/* ===== Reference Index Chart (§15) — time range + markers + tooltips ===== */}
      <SectionFade>
        <section aria-labelledby="home-refchart">
          <SectionHeading
            eyebrow="§15 · time ranges"
            title="Reference Index Chart"
            right={
              <GlowBadge variant="gold">
                <GlowDot color="gold" size="h-1.5 w-1.5" />
                chain-linked I_t
              </GlowBadge>
            }
          />
          <Reveal>
            <PremiumCard className="p-4 sm:p-5">
              <ReferenceChart snapshot={snapshot} height={260} />
            </PremiumCard>
          </Reveal>
        </section>
      </SectionFade>

      {/* ===== 4 testnet cards ===== */}
      <SectionFade>
        <section aria-labelledby="home-testnets">
          <SectionHeading
            eyebrow="Canonical Deployments"
            title="MTQΣ on 4 Testnets"
            right={
              <button
                onClick={() => onNavigate("contracts")}
                className="inline-flex items-center gap-1.5 text-[0.72rem] text-mtqs-gold/80 hover:text-mtqs-gold-light transition"
              >
                Full registry
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            }
          />
          <TestnetCards />
        </section>
      </SectionFade>

      {/* ===== Closing — explore call-out ===== */}
      <SectionFade>
        <section aria-labelledby="home-explore">
          <Reveal>
            <PremiumCard className="p-6 sm:p-8 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Layers className="h-5 w-5 text-mtqs-emerald" aria-hidden="true" />
                <h3 className="mtqs-display text-2xl font-semibold text-white">
                  Explore the closed-loop architecture
                </h3>
              </div>
              <p className="text-[0.82rem] text-white/55 leading-relaxed max-w-2xl mx-auto mb-5">
                {BRAND_VOICE.designConstraint}. {BRAND_VOICE.statusDeclaration}. Every metric on this
                site is computed live by the reference engine and reconciled against the blueprint.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {([
                  { id: "dashboard", label: "Dashboard" },
                  { id: "docs", label: "Docs" },
                  { id: "investors", label: "Investors" },
                  { id: "tests", label: "Tests" },
                ] as const).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onNavigate(c.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-[0.78rem] font-medium text-white hover:border-mtqs-gold/30 hover:text-white transition"
                  >
                    {c.label}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </PremiumCard>
          </Reveal>
        </section>
      </SectionFade>
    </div>
  );
}
