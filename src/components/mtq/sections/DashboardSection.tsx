// MTQΣ — Dashboard Section
// Renders all 22 existing MTQ components in the original page.tsx order.
// Fetches snapshot, oracle, registry, trials on mount (with 4s polling for snapshot).
// Shows a boot skeleton during the first fetch.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { Starfield, SectionHeading, Reveal, Panel, Pill, GlowDot, BrandPrinciples, Skeleton } from "@/components/mtq/primitives";
import { ConstitutionalSeparation } from "@/components/mtq/ConstitutionalSeparation";
import { LiveMonetaryState } from "@/components/mtq/LiveMonetaryState";
import { ClosedLoopMap } from "@/components/mtq/ClosedLoopMap";
import { OracleConsensus } from "@/components/mtq/OracleConsensus";
import { AssetRegistry } from "@/components/mtq/AssetRegistry";
import { ReserveVault } from "@/components/mtq/ReserveVault";
import { MacroEngine } from "@/components/mtq/MacroEngine";
import { RebalanceEngine } from "@/components/mtq/RebalanceEngine";
import { MintSimulator } from "@/components/mtq/MintSimulator";
import { RedeemSimulator } from "@/components/mtq/RedeemSimulator";
import { DynamicBuffer } from "@/components/mtq/DynamicBuffer";
import { EjectReintegration } from "@/components/mtq/EjectReintegration";
import { TreasurySweep } from "@/components/mtq/TreasurySweep";
import { PriceEvents } from "@/components/mtq/PriceEvents";
import { ContractRegistry } from "@/components/mtq/ContractRegistry";
import { RiskStateMachine } from "@/components/mtq/RiskStateMachine";
import { GfbBasket } from "@/components/mtq/GfbBasket";
import { TrialLog, type PilotTrial } from "@/components/mtq/TrialLog";
import { HonestStatus } from "@/components/mtq/HonestStatus";

import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { OracleBoard } from "@/lib/mtq/oracle";
import type { AssetRecord, ConcentrationReport } from "@/lib/mtq/registry";

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
        <div className="text-[0.7rem] uppercase tracking-[0.25em] text-muted-foreground/60">
          Initialising Monetary Observatory…
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-mtqs-gold/40 to-transparent" />
      </div>
    </div>
  );
}

export function DashboardSection() {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const [oracle, setOracle] = useState<OracleBoard | null>(null);
  const [registry, setRegistry] = useState<RegistryResp | null>(null);
  const [trials, setTrials] = useState<PilotTrial[]>([]);
  const [trialsLoading, setTrialsLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  const [chain, setChain] = useState("monad");
  const [wallet, setWallet] = useState("");

  const mountedRef = useRef(true);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics", { cache: "no-store" });
      if (!res.ok) throw new Error(`metrics ${res.status}`);
      const data = (await res.json()) as MetricsSnapshot;
      if (!mountedRef.current) return;
      setSnapshot(data);
    } catch {
      /* keep last good */
    } finally {
      if (mountedRef.current && firstLoad) setFirstLoad(false);
    }
  }, [firstLoad]);

  const fetchOracle = useCallback(async () => {
    try {
      const res = await fetch("/api/oracle", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as OracleBoard;
      if (mountedRef.current) setOracle(data);
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

  // Initial fetch + polling (snapshot + oracle every 4s)
  useEffect(() => {
    mountedRef.current = true;
    fetchMetrics();
    fetchOracle();
    fetchRegistry();
    fetchTrials();
    const id = setInterval(() => {
      fetchMetrics();
      fetchOracle();
    }, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchMetrics, fetchOracle]);

  const onAfterTrial = useCallback(() => {
    fetchMetrics();
    fetchOracle();
    fetchTrials();
  }, [fetchMetrics, fetchOracle, fetchTrials]);

  const oracleValidCount = oracle?.pairs.reduce((a, p) => a + (p.paused ? 0 : p.validCount), 0) ?? 0;
  const oracleTotalCount = oracle ? oracle.pairs.length * 3 : 0;
  const oracleAnyPaused = snapshot?.oraclePaused ?? oracle?.anyPaused ?? false;

  if (firstLoad && !snapshot) {
    return (
      <div className="space-y-4">
        <SectionHeading eyebrow="Live · booting" title="Monetary Observatory Dashboard" />
        <BootSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {/* ===== 1 — Constitutional Separation ===== */}
      <Section
        id="hero"
        eyebrow="§1.1 · Core Objective"
        title="MTQΣ — Closed-Loop Monetary Architecture"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-center">
          <Reveal>
            <Panel className="p-5 sm:p-6 h-full">
              <h3 className="mtqs-display text-2xl font-semibold text-foreground/95 mb-3">
                The Global Purchasing Power Unit
              </h3>
              <p className="text-[0.82rem] text-muted-foreground/85 leading-relaxed mb-4">
                The GFB Index defines what one MTQΣ is intended to represent. The reserve
                portfolio exists to collateralize that obligation. Mint and redeem flows
                arbitrage back to the price, with the GFB Index as the immutable reference.
              </p>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3 text-[0.72rem] text-muted-foreground/80">
                <div className="font-mono text-mtqs-gold-light mb-1">§1.1 · Core Objective</div>
                Status: {snapshot?.status ?? "NORMAL"} · RR {(snapshot?.reserveRatio ?? 0).toFixed(4)} · NAV {(snapshot?.nav ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
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

      {/* ===== 3 — Closed-Loop Architecture Map ===== */}
      <Section id="loop" eyebrow="§1 · §3 · §4 · §12" title="Closed-Loop Architecture Map">
        <Reveal>
          <Panel className="p-4 sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
              <p className="text-[0.78rem] text-muted-foreground/85 leading-relaxed max-w-2xl">
                The GFB Index feeds the MTQ Reference Price; the price multiplied by circulating
                supply gives the protocol liability. The Reserve NAV backs that liability at the
                Reserve Ratio. Mint and Redeem flows arbitrage back to the price, with the GFB
                Index as the immutable reference. Live values ride along each edge.
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

      {/* ===== 8 — Rebalancing Engine ===== */}
      <Section id="rebalance" eyebrow="§7" title="Rebalancing Engine">
        <RebalanceEngine snapshot={snapshot} />
      </Section>

      {/* ===== 9 — Mint + Redeem Simulators ===== */}
      <Section id="simulate" eyebrow="§12 · interactive" title="Mint & Redeem Simulators">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Reveal>
            <MintSimulator
              snapshot={snapshot}
              chain={chain}
              setChain={setChain}
              wallet={wallet}
              setWallet={setWallet}
              onAfterTrial={onAfterTrial}
            />
          </Reveal>
          <Reveal delay={0.05}>
            <RedeemSimulator
              snapshot={snapshot}
              chain={chain}
              setChain={setChain}
              wallet={wallet}
              setWallet={setWallet}
              onAfterTrial={onAfterTrial}
            />
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

      {/* ===== 14 — Contract Registry ===== */}
      <Section id="contracts" eyebrow="deployments" title="Contract Registry · 4 Testnets">
        <ContractRegistry />
      </Section>

      {/* ===== 15 — Risk State + Governance ===== */}
      <Section id="risk" eyebrow="§14" title="Risk State Machine & Governance">
        <RiskStateMachine snapshot={snapshot} />
      </Section>

      {/* ===== 16 — GFB Basket ===== */}
      <Section id="basket" eyebrow="§2" title="GFB Basket Reference">
        <GfbBasket />
      </Section>

      {/* ===== 17 — Trial Log ===== */}
      <Section id="trials" eyebrow="audit" title="Pilot Trial Log">
        <TrialLog trials={trials} loading={trialsLoading} onRefresh={fetchTrials} />
      </Section>

      {/* ===== 18 — Honest Status Declaration ===== */}
      <Section id="honest" eyebrow="§15 · honesty" title="Honest Status Declaration">
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-0 mtqs-pattern-bg rounded-xl"
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
