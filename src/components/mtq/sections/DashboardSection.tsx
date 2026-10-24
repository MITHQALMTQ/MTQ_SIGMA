// MTQΣ — Dashboard Section
// Renders all 27 existing MTQ components (26 imported + shared BrandPrinciples)
// in the original page.tsx order.
// Fetches snapshot, oracle, registry, trials on mount (with 4s polling for snapshot).
// Shows a boot skeleton during the first fetch.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { SectionHeading, Reveal, Panel, Pill, GlowDot, BrandPrinciples, Skeleton } from "@/components/mtq/primitives";
import { ConstitutionalSeparation } from "@/components/mtq/ConstitutionalSeparation";
import { SystemHealth } from "@/components/mtq/SystemHealth";
import { LiveMonetaryState } from "@/components/mtq/LiveMonetaryState";
import { LiveDataProvenance } from "@/components/mtq/LiveDataProvenance";
import { ClosedLoopMap } from "@/components/mtq/ClosedLoopMap";
import { OracleConsensus } from "@/components/mtq/OracleConsensus";
import { AssetRegistry } from "@/components/mtq/AssetRegistry";
import { ReserveVault } from "@/components/mtq/ReserveVault";
import { MacroEngine } from "@/components/mtq/MacroEngine";
import { MaseEngine } from "@/components/mtq/MaseEngine";
import { RebalanceEngine } from "@/components/mtq/RebalanceEngine";
import { DynamicBuffer } from "@/components/mtq/DynamicBuffer";
import { EjectReintegration } from "@/components/mtq/EjectReintegration";
import { TreasurySweep } from "@/components/mtq/TreasurySweep";
import { PriceEvents } from "@/components/mtq/PriceEvents";
import { RiskStateMachine } from "@/components/mtq/RiskStateMachine";
import { GfbBasket, GoldInReserve } from "@/components/mtq/GfbBasket";
import { TrialLog, type PilotTrial } from "@/components/mtq/TrialLog";
import { HonestStatus } from "@/components/mtq/HonestStatus";
import { AIPolicyBriefing } from "@/components/mtq/AIPolicyBriefing";
import { RiskSignals } from "@/components/mtq/RiskSignals";
import { ParameterRegistry } from "@/components/mtq/ParameterRegistry";
import { ReproducibilityPanel } from "@/components/mtq/ReproducibilityPanel";
import { WeightChangeDrawer } from "@/components/mtq/WeightChangeDrawer";
import { RiskTimeline } from "@/components/mtq/RiskTimeline";

import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { OracleBoard } from "@/lib/mtq/oracle";
import type { AssetRecord, ConcentrationReport } from "@/lib/mtq/registry";
import { ALL_CHAINS } from "@/lib/mtq/contracts";
import { fmtRatio } from "@/components/mtq/format";
import type { SectionId } from "@/components/mtq/Navigation";

const POLL_MS = 4000;

interface RegistryResp {
  criteria: { id: string; label: string; desc: string }[];
  assets: AssetRecord[];
  concentration: ConcentrationReport[] | null;
}

/* ---------- ClientOnly (hydration-safe wrapper for ConstitutionalSeparation) ---------- */
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return <>{children}</>;
}

/* ---------- Section wrapper (consistent spacing + scroll anchor) ---------- */
function Section({
  id,
  eyebrow,
  title,
  right,
  children,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32" aria-labelledby={`section-${id}`}>
      <SectionHeading eyebrow={eyebrow} title={title} right={right} />
      {children}
    </section>
  );
}

/* ---------- Boot skeleton ---------- */
function BootSkeleton() {
  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <Skeleton className="aspect-[16/10] w-full max-w-[640px] mx-auto lg:mx-0 rounded-xl" />
        <Skeleton className="aspect-square w-full max-w-[520px] mx-auto rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="text-[0.7rem] uppercase tracking-[0.25em] text-white/60">
          Initialising Global Digital Asset…
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-mtqs-gold/40 to-transparent" />
      </div>
    </div>
  );
}

// PERF (2026-10-24): accepts an optional parent snapshot from the Pilot
// Command Center (which already polls /api/metrics every 4s for the whole
// terminal). When provided, this section reuses it (metrics + the embedded
// oracle board — MetricsSnapshot.oracle IS the full OracleBoard) and drops
// its own duplicate 4s metrics/oracle pollers. Registry + trials remain
// section-local one-shot fetches. Standalone use keeps full self-polling.
export function DashboardSection({
  snapshot: parentSnapshot,
  onNavigate,
}: {
  snapshot?: MetricsSnapshot | null;
  onNavigate?: (id: SectionId) => void;
} = {}) {
  const [ownSnapshot, setOwnSnapshot] = useState<MetricsSnapshot | null>(null);
  const [ownOracle, setOwnOracle] = useState<OracleBoard | null>(null);
  const [registry, setRegistry] = useState<RegistryResp | null>(null);
  const [trials, setTrials] = useState<PilotTrial[]>([]);
  const [trialsLoading, setTrialsLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  const mountedRef = useRef(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics", { cache: "no-store" });
      if (!res.ok) throw new Error(`metrics ${res.status}`);
      const data = (await res.json()) as MetricsSnapshot;
      if (!mountedRef.current) return;
      setOwnSnapshot(data);
    } catch {
      /* keep last good */
    } finally {
      // Idempotent flip (setFirstLoad(false) is safe to repeat) — keeps this
      // callback STABLE so the polling effect below doesn't re-run and
      // double-fetch whenever firstLoad toggles.
      if (mountedRef.current) setFirstLoad(false);
    }
  }, []);

  const fetchOracle = useCallback(async () => {
    try {
      const res = await fetch("/api/oracle", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as OracleBoard;
      if (mountedRef.current) setOwnOracle(data);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchRegistry = useCallback(async () => {
    try {
      const res = await fetch("/api/registry", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as RegistryResp;
      if (mountedRef.current) setRegistry(data);
    } catch {
      /* ignore */
    }
  }, []);

  const fetchTrials = useCallback(async () => {
    setTrialsLoading(true);
    try {
      const res = await fetch("/api/trials?limit=50", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { trials: PilotTrial[] };
      if (mountedRef.current) setTrials(data.trials ?? []);
    } catch {
      /* ignore */
    } finally {
      if (mountedRef.current) setTrialsLoading(false);
    }
  }, []);

  // Initial fetch + polling — in shared mode the PCC parent supplies metrics
  // (incl. the embedded oracle board); only registry + trials are fetched here.
  // Standalone mode keeps the original 4s metrics+oracle self-polling, paused
  // while the tab is hidden.
  useEffect(() => {
    mountedRef.current = true;
    if (!parentSnapshot) {
      fetchMetrics();
      fetchOracle();
    }
    fetchRegistry();
    fetchTrials();
    const id = parentSnapshot
      ? undefined
      : setInterval(() => {
          if (!document.hidden) {
            fetchMetrics();
            fetchOracle();
          }
        }, POLL_MS);
    return () => {
      mountedRef.current = false;
      if (id) clearInterval(id);
    };
  }, [fetchMetrics, fetchOracle, parentSnapshot]);

  // Shared parent snapshot is authoritative when present (metrics + oracle).
  const snapshot = parentSnapshot ?? ownSnapshot;
  const oracle = parentSnapshot?.oracle ?? ownOracle;

  const oracleValidCount = oracle?.pairs.reduce((a, p) => a + (p.paused ? 0 : p.validCount), 0) ?? 0;
  const oracleTotalCount = oracle ? oracle.pairs.length * 3 : 0;
  const oracleAnyPaused = snapshot?.oraclePaused ?? oracle?.anyPaused ?? false;

  if (firstLoad && !snapshot) {
    return (
      <div className="space-y-4">
        <SectionHeading eyebrow="Live · booting" title="Global Digital Asset Dashboard" />
        <BootSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {/* ===== 0 — Live System Health (8 subsystems at a glance) ===== */}
      <SystemHealth snapshot={snapshot} />

      {/* ===== 1 — Constitutional Separation ===== */}
      <Section
        id="hero"
        eyebrow="§1.1 · Core Objective"
        title="MTQΣ — Closed-Loop Monetary Architecture"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          <Reveal>
            <Panel className="p-5 sm:p-6 h-full">
              <h3 className="mtqs-display text-2xl font-semibold text-white mb-3">
                The Global Digital Asset
              </h3>
              <p className="text-[0.82rem] text-white/55 leading-relaxed mb-4">
                {/* 16f-003: the Home twin of this intro was reframed in Task 15 — this
                    Portfolio copy now carries the same legacy v1/v2 qualifier. */}
                Legacy §1.1 exhibit (v1/v2, kept labeled): the Adaptive Reference Basket defines
                what one MTQΣ represents, and the reserve portfolio existed to collateralize that
                obligation — mint and redeem flows arbitrage back to the reference value. Under the
                v3.0 no-conventional-reserve objective this is superseded: the index is a published
                measuring service, not a backing pool; payment-funded issuance replaces reserve
                collateralization (Gate B, D-13.3–D-13.7 open).
              </p>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-[0.72rem] text-white/55">
                <div className="font-mono text-mtqs-gold-light mb-1">§1.1 · Core Objective</div>
                Status: {snapshot?.status ?? "NORMAL"} · RR{" "}
                {snapshot && Number.isFinite(snapshot.reserveRatio) ? fmtRatio(snapshot.reserveRatio) : "∞ — no liability"} ·
                NAV {(snapshot?.nav ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-4">
                <BrandPrinciples />
              </div>
            </Panel>
          </Reveal>
          <Reveal delay={0.1}>
            <ClientOnly>
              <ConstitutionalSeparation snapshot={snapshot} />
            </ClientOnly>
          </Reveal>
        </div>
      </Section>

      {/* ===== 2 — Live Monetary State ===== */}
      <Section
        id="state"
        eyebrow="§2 · §3 · §4"
        title="Live Monetary State"
        right={
          <div className="hidden sm:flex items-center gap-2">
            <Pill tone={snapshot?.oraclePaused ? "rose" : "emerald"}>
              <GlowDot color={snapshot?.oraclePaused ? "rose" : "emerald"} size="h-1.5 w-1.5" />
              {snapshot?.oraclePaused ? "oracle paused" : "oracle live"}
            </Pill>
            <Pill tone={snapshot?.priceInBand ? "emerald" : "rose"}>
              <GlowDot color={snapshot?.priceInBand ? "emerald" : "rose"} size="h-1.5 w-1.5" />
              {snapshot?.priceInBand ? "in safety band" : "circuit breaker"}
            </Pill>
          </div>
        }
      >
        <LiveMonetaryState snapshot={snapshot} />
      </Section>

      {/* ===== 2b — Live Data Provenance (8/8 live verification) ===== */}
      <LiveDataProvenance />

      {/* ===== 3 — Closed-Loop Architecture Map ===== */}
      <Section id="loop" eyebrow="§1 · §3 · §4 · §12" title="Closed-Loop Architecture Map">
        <Reveal>
          <Panel className="p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
              <p className="text-[0.78rem] text-white/55 leading-relaxed max-w-2xl">
                {/* 16f-003: same legacy v1/v2 qualifier as the intro above. */}
                Legacy v1/v2 closed-loop exhibit (kept labeled): the Adaptive Reference Basket feeds
                the Reference Value; the value multiplied by circulating supply gives the protocol
                liability, and the Reserve NAV backs that liability at the Reserve Ratio. Under the
                v3.0 no-conventional-reserve objective the index is published separately from any
                backing pool (Gate B, D-13.3–D-13.7 open). Live values ride along each edge.
              </p>
              <Pill tone="gold">signature visual</Pill>
            </div>
            <ClosedLoopMap snapshot={snapshot} />
          </Panel>
        </Reveal>
      </Section>

      {/* ===== 4 — Oracle Consensus ===== */}
      <Section
        id="oracle"
        eyebrow="§9"
        title="Oracle Consensus Board"
        right={
          <Pill tone={oracleAnyPaused ? "rose" : "emerald"}>
            <GlowDot color={oracleAnyPaused ? "rose" : "emerald"} size="h-1.5 w-1.5" />
            {oracleAnyPaused ? "paused" : "live"}
          </Pill>
        }
      >
        <OracleConsensus snapshot={snapshot} oracle={oracle} />
      </Section>

      {/* ===== 5 — Asset Admission Registry ===== */}
      <Section id="registry" eyebrow="§5" title="Asset Admission Registry">
        <AssetRegistry
          registry={registry?.assets ?? snapshot?.registry ?? null}
          concentration={registry?.concentration ?? snapshot?.concentration ?? null}
          perIssuer={snapshot?.perIssuer ?? null}
        />
      </Section>

      {/* ===== 6 — Reserve Vault composition ===== */}
      <Section id="vault" eyebrow="§4 + §8" title="Reserve Vault Composition">
        <ReserveVault snapshot={snapshot} />
      </Section>

      {/* ===== 7 — Adaptive Macro Engine ===== */}
      <Section id="macro" eyebrow="§6" title="Adaptive Macro Engine">
        <MacroEngine snapshot={snapshot} />
      </Section>

      {/* ===== 7b — MASE Ensemble + 4-State Weights + MARP (v1.0) ===== */}
      <Section
        id="mase"
        eyebrow="§6 · §7 · §8 · §10 · v1.0"
        title="MASE Ensemble + 4-State Weights + MARP"
        right={
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            v1.0 production target
          </Pill>
        }
      >
        <MaseEngine snapshot={snapshot} />
      </Section>

      {/* ===== 7c — Weight Change Drawer (§14) — click any component to drill in ===== */}
      <Section
        id="weight-explainer"
        eyebrow="§14 · interactive"
        title="Why did the weight change? · Click any component"
        right={
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            attribution drawer
          </Pill>
        }
      >
        <WeightChangeDrawer
          snapshot={snapshot}
          tick={Math.floor((snapshot?.fetchedAt ?? Date.now()) / 4000)}
        />
      </Section>

      {/* ===== 8 — Rebalancing Engine ===== */}
      <Section id="rebalance" eyebrow="§7" title="Rebalancing Engine">
        <RebalanceEngine snapshot={snapshot} />
      </Section>

      {/* ===== 9 — User Operations (grouped — full simulators live in the
          dedicated Mint / Redeem sections; this compact panel links to them
          instead of duplicating the interactive blocks) ===== */}
      <Section id="simulate" eyebrow="§12 · interactive" title="Mint & Redeem Operations">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Reveal>
            <Panel className="p-5 h-full flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <GlowDot color="emerald" size="h-2 w-2" />
                  Mint Simulator
                </h3>
                <Pill tone="amber">testnet · simulated</Pill>
              </div>
              <p className="text-[0.78rem] text-white/55 leading-relaxed">
                Mint MTQΣ against the live pilot engine with real state changes — fees, reference rate,
                and reserve ratio update on every trial.
              </p>
              {onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate("mint")}
                  className="mt-auto self-start rounded-md border border-mtqs-gold/30 bg-mtqs-gold/[0.06] px-3 py-1.5 text-[0.75rem] font-medium text-mtqs-gold transition-colors hover:bg-mtqs-gold/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mtqs-gold/60"
                >
                  Open Mint simulator →
                </button>
              ) : (
                <span className="mt-auto text-[0.72rem] text-white/40">Terminal → Operations → Mint Simulator</span>
              )}
            </Panel>
          </Reveal>
          <Reveal delay={0.05}>
            <Panel className="p-5 h-full flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <GlowDot color="emerald" size="h-2 w-2" />
                  Redeem Simulator
                </h3>
                <Pill tone="amber">testnet · simulated</Pill>
              </div>
              <p className="text-[0.78rem] text-white/55 leading-relaxed">
                Redeem MTQΣ at NAV settlement against the live pilot engine — fee policy follows the
                §14.1 risk-state row.
              </p>
              {onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate("redeem")}
                  className="mt-auto self-start rounded-md border border-mtqs-gold/30 bg-mtqs-gold/[0.06] px-3 py-1.5 text-[0.75rem] font-medium text-mtqs-gold transition-colors hover:bg-mtqs-gold/[0.12] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mtqs-gold/60"
                >
                  Open Redeem simulator →
                </button>
              ) : (
                <span className="mt-auto text-[0.72rem] text-white/40">Terminal → Operations → Redeem Simulator</span>
              )}
            </Panel>
          </Reveal>
        </div>
      </Section>

      {/* ===== 10 — Dynamic Buffer + Waterfall ===== */}
      <Section id="buffer" eyebrow="§8" title="Dynamic Buffer & First-Loss Waterfall">
        <DynamicBuffer snapshot={snapshot} />
      </Section>

      {/* ===== 11 — Eject + Reintegration ===== */}
      <Section id="eject" eyebrow="§11" title="Geopolitical Eject & Reintegration">
        <EjectReintegration snapshot={snapshot} />
      </Section>

      {/* ===== 12 — Treasury Sweep ===== */}
      <Section id="treasury" eyebrow="§13.2" title="Treasury Sweep">
        <TreasurySweep snapshot={snapshot} />
      </Section>

      {/* ===== 13 — Price Events ===== */}
      <Section id="price-events" eyebrow="§3.6" title="Price Events Log">
        <Reveal>
          <PriceEvents snapshot={snapshot} />
        </Reveal>
      </Section>

      {/* ===== 14 — Contract Registry (compact pointer — full registry + live role
            matrix render in the Contracts section; ContractRegistry.tsx removed as a
            near-duplicate per Task 14 grouping) ===== */}
      <Section id="contracts" eyebrow="deployments" title="Contract Registry · Summary">
        <Reveal>
          <Panel className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[0.85rem] text-white/90">
                  {ALL_CHAINS.length} networks ·{" "}
                  {ALL_CHAINS.reduce((a, c) => a + c.contracts.length, 0)} registry entries ·
                  3 testnets live (Monad · Arc · Solana devnet) — registry contains only the
                  owner-declared current deployments
                </div>
                <p className="mt-1.5 text-[0.7rem] text-white/55 leading-relaxed max-w-2xl">
                  Compact pointer — canonical MTQΣ addresses, per-chain ecosystem contracts, explorer
                  links and the LIVE AccessControl role matrix render in the dedicated Contracts
                  section. Pilot note: the monetary engine runs in-process; on-chain state is read for
                  verification only (testnet · shadow mode).
                </p>
              </div>
              {onNavigate ? (
                <button
                  onClick={() => onNavigate("contracts")}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/[0.06] px-4 py-2 text-[0.75rem] font-medium text-mtqs-gold-light hover:bg-mtqs-gold/[0.12] transition"
                >
                  Open Contracts registry
                  <span aria-hidden="true">→</span>
                </button>
              ) : (
                <span className="shrink-0 text-[0.7rem] text-white/45">
                  Full registry: Contracts section
                </span>
              )}
            </div>
          </Panel>
        </Reveal>
      </Section>

      {/* ===== 15 — Risk State + Governance ===== */}
      <Section id="risk" eyebrow="§14" title="Risk State Machine & Governance">
        <RiskStateMachine snapshot={snapshot} />
      </Section>

      {/* ===== 15b — Risk Timeline (§23) — historical risk-state transitions ===== */}
      <Section
        id="risk-timeline"
        eyebrow="§23 · history"
        title="Risk Timeline · State Transitions"
        right={
          <Pill tone={snapshot?.status === "NORMAL" ? "emerald" : "rose"}>
            <GlowDot color={snapshot?.status === "NORMAL" ? "emerald" : "rose"} size="h-1.5 w-1.5" />
            current: {snapshot?.status ?? "—"}
          </Pill>
        }
      >
        <RiskTimeline snapshot={snapshot} limit={10} />
      </Section>

      {/* ===== 15c — Parameter Registry (§37) + Reproducibility (§34) ===== */}
      <Section
        id="parameter-registry"
        eyebrow="§37 · §34 · institutional"
        title="Parameter Registry & Reproducibility"
        right={
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            16 parameters · 4 lineage
          </Pill>
        }
      >
        <ParameterRegistry />
        <div className="mt-6">
          <ReproducibilityPanel snapshot={snapshot} />
        </div>
      </Section>

      {/* ===== 16 — GFB Basket ===== */}
      <Section id="basket" eyebrow="§2" title="Adaptive Reference Basket">
        <GfbBasket />
        <GoldInReserve snapshot={snapshot} />
      </Section>

      {/* ===== 17 — Trial Log ===== */}
      <Section id="trials" eyebrow="audit" title="Pilot Trial Log">
        <TrialLog trials={trials} loading={trialsLoading} onRefresh={fetchTrials} />
      </Section>

      {/* ===== 17a — AI Policy Briefing (COO AI · Gemini) ===== */}
      <Section id="ai-briefing" eyebrow="AI · advisory" title="AI Monetary Policy Briefing · COO AI">
        <AIPolicyBriefing />
      </Section>

      {/* ===== 17b — AI Risk Signals (Groq) ===== */}
      <Section id="ai-risk" eyebrow="AI · advisory" title="Live Risk Monitor · AI Signals">
        <RiskSignals />
      </Section>

      {/* ===== 18 — Honest Status Declaration ===== */}
      <Section id="honest" eyebrow="§15 · honesty" title="Honest Status Declaration">
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-0  rounded-xl"
            aria-hidden="true"
          />
          <div className="relative">
            <HonestStatus snapshot={snapshot} />
          </div>
        </div>
      </Section>
    </div>
  );
}
