// MTQΣ — Trial Section
// 5 steps for a pilot user: Faucets → Canonical addresses → Mint simulator →
// Redeem simulator → Trial log. Step progress indicator at the top.
//
// Props: { onNavigate, snapshot }.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, ArrowRight, Droplets, Coins, Flame, ScrollText } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading } from "@/components/mtq/primitives";
import { MintSimulator } from "@/components/mtq/MintSimulator";
import { RedeemSimulator } from "@/components/mtq/RedeemSimulator";
import { TrialLog, type PilotTrial } from "@/components/mtq/TrialLog";
import { shortAddr, copyToClipboard } from "@/components/mtq/format";
import { CANONICAL_MTQ_ADDRESSES, ALL_CHAINS } from "@/lib/mtq/contracts";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { SectionId } from "@/components/mtq/Navigation";
import { toast } from "sonner";

/* ---------- Faucet list (per testnet) ---------- */
const FAUCETS: { chain: string; label: string; url: string; note: string }[] = [
  { chain: "Monad Testnet", label: "Monad Faucet", url: "https://faucet.monad.xyz/", note: "Free MON for testnet gas" },
  { chain: "Arc Testnet", label: "Arc Faucet", url: "https://faucet.arc.io/", note: "Free USDC (18 decimals) for gas + collateral" },
  { chain: "Solana Devnet", label: "Solana Devnet Faucet", url: "https://faucet.solana.com/", note: "Free SOL for SPL token ops" },
  { chain: "Robinhood Testnet", label: "Robinhood Faucet", url: "https://explorer.testnet.chain.robinhood.com/faucet", note: "Free testnet ETH-equivalent" },
];

/* ---------- Step indicator ---------- */
function StepIndicator() {
  const steps = [
    { n: 1, label: "Faucets" },
    { n: 2, label: "Canonical addresses" },
    { n: 3, label: "Mint" },
    { n: 4, label: "Redeem" },
    { n: 5, label: "Trial log" },
  ];
  return (
    <div className="grid grid-cols-5 gap-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="h-8 w-8 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center text-[0.78rem] font-mono font-semibold text-mtqs-gold-light">
              {s.n}
            </div>
            <span className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.12em] text-white/40/75 text-center">
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="h-px flex-1 bg-gradient-to-r from-mtqs-gold/30 to-mtqs-gold/10 -translate-y-2" />
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Canonical addresses step ---------- */
function CanonicalAddresses() {
  const entries = Object.entries(CANONICAL_MTQ_ADDRESSES);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {entries.map(([id, info]) => (
        <Panel key={id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
              {info.chain}
            </div>
            <Pill tone="gold" className="font-mono">{info.symbol}</Pill>
          </div>
          <div className="font-mono text-[0.72rem] text-amber-100 break-all leading-relaxed mb-2">
            {info.address}
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={async (e) => {
                e.preventDefault();
                const ok = await copyToClipboard(info.address);
                if (ok) toast.success(`Copied ${info.chain} MTQΣ`, { description: shortAddr(info.address, 8, 6) });
                else toast.error("Copy failed");
              }}
              className="text-[0.65rem] font-mono text-mtqs-gold/70 hover:text-mtqs-gold transition"
            >
              copy address
            </button>
            <a
              href={info.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[0.65rem] text-mtqs-emerald/80 hover:text-mtqs-emerald transition"
            >
              explorer
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </Panel>
      ))}
    </div>
  );
}

export function TrialSection({
  onNavigate: _onNavigate,
  snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  const [chain, setChain] = useState("monad");
  const [wallet, setWallet] = useState("");
  const [trials, setTrials] = useState<PilotTrial[]>([]);
  const [trialsLoading, setTrialsLoading] = useState(false);
  const mountedRef = useRef(true);

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

  useEffect(() => {
    mountedRef.current = true;
    fetchTrials();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchTrials]);

  const onAfterTrial = useCallback(() => {
    fetchTrials();
  }, [fetchTrials]);

  return (
    <div className="space-y-12">
      <SectionHeading
        eyebrow="§12 · interactive pilot"
        title="Trial Simulator — 5 Steps"
        right={
          <Pill tone={snapshot?.oraclePaused ? "rose" : "emerald"}>
            <GlowDot color={snapshot?.oraclePaused ? "rose" : "emerald"} size="h-1.5 w-1.5" />
            {snapshot?.oraclePaused ? "oracle paused" : "oracle live"}
          </Pill>
        }
      />

      {/* Step indicator */}
      <Reveal>
        <Panel className="p-4 sm:p-5">
          <StepIndicator />
          <p className="mt-4 text-[0.72rem] text-white/40 leading-relaxed">
            Run the closed loop end-to-end: fund a testnet wallet from a faucet, copy the canonical
            MTQΣ address, mint MTQΣ against USDC, redeem MTQΣ back into the basket, and review your
            trial history. Every step is logged to SQLite for auditability.
          </p>
        </Panel>
      </Reveal>

      {/* Step 1 — Faucets */}
      <section aria-labelledby="trial-faucets">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center text-[0.72rem] font-mono font-semibold text-mtqs-gold-light">
                1
              </div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Droplets className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                Faucets
              </h3>
            </div>
            <p className="text-[0.72rem] text-white/40/75 mt-1 ml-9">
              Fund your testnet wallet before minting or redeeming.
            </p>
          </div>
        </div>
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {FAUCETS.map((f) => (
              <a
                key={f.url}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block"
              >
                <Panel className="p-4 h-full hover:border-mtqs-gold/40 transition">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
                      {f.chain}
                    </div>
                    <ExternalLink
                      className="h-3.5 w-3.5 text-white/40/60 group-hover:text-mtqs-gold-light transition"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="text-sm font-semibold text-white/90 group-hover:text-mtqs-gold-light transition">
                    {f.label}
                  </div>
                  <div className="mt-1 text-[0.68rem] text-white/40 leading-relaxed">
                    {f.note}
                  </div>
                </Panel>
              </a>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Step 2 — Canonical addresses */}
      <section aria-labelledby="trial-canonical">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center text-[0.72rem] font-mono font-semibold text-mtqs-gold-light">
                2
              </div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Coins className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                Canonical MTQΣ Addresses
              </h3>
            </div>
            <p className="text-[0.72rem] text-white/40/75 mt-1 ml-9">
              The source-of-truth token contract on each testnet. Verify on the explorer before minting.
            </p>
          </div>
        </div>
        <Reveal>
          <CanonicalAddresses />
        </Reveal>
      </section>

      {/* Step 3 — Mint simulator */}
      <section aria-labelledby="trial-mint">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center text-[0.72rem] font-mono font-semibold text-mtqs-gold-light">
                3
              </div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Coins className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                Mint Simulator
              </h3>
            </div>
            <p className="text-[0.72rem] text-white/40/75 mt-1 ml-9">
              Deposit USDC → mint MTQΣ = X·(1−0.001)/P_MTQ (§12.1, fee 0.10%).
            </p>
          </div>
        </div>
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
      </section>

      {/* Step 4 — Redeem simulator */}
      <section aria-labelledby="trial-redeem">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center text-[0.72rem] font-mono font-semibold text-mtqs-gold-light">
                4
              </div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Flame className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                Redeem Simulator
              </h3>
            </div>
            <p className="text-[0.72rem] text-white/40/75 mt-1 ml-9">
              Burn MTQΣ → release the basket (§3.4.2 canonical, arbitrage-safe) + 0.15% fee.
            </p>
          </div>
        </div>
        <Reveal>
          <RedeemSimulator
            snapshot={snapshot}
            chain={chain}
            setChain={setChain}
            wallet={wallet}
            setWallet={setWallet}
            onAfterTrial={onAfterTrial}
          />
        </Reveal>
      </section>

      {/* Step 5 — Trial log */}
      <section aria-labelledby="trial-log">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center text-[0.72rem] font-mono font-semibold text-mtqs-gold-light">
                5
              </div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                Trial Log
              </h3>
            </div>
            <p className="text-[0.72rem] text-white/40/75 mt-1 ml-9">
              Every mint/redeem is stored in SQLite. Most recent first.
            </p>
          </div>
        </div>
        <Reveal>
          <TrialLog trials={trials} loading={trialsLoading} onRefresh={fetchTrials} />
        </Reveal>
      </section>

      {/* Closing CTA */}
      <Reveal>
        <Panel variant="emerald" className="p-5 sm:p-6 text-center">
          <p className="text-[0.82rem] text-white/40 leading-relaxed max-w-2xl mx-auto mb-4">
            Trial complete. Review the full reconciliation in the Docs section, or explore the
            contract registry to verify each deployment on-chain.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => _onNavigate("docs")}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03]/[0.03] px-4 py-2 text-[0.78rem] font-medium text-white hover:border-mtqs-gold/30 hover:text-white transition"
            >
              View Docs
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={() => _onNavigate("contracts")}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03]/[0.03] px-4 py-2 text-[0.78rem] font-medium text-white hover:border-mtqs-gold/30 hover:text-white transition"
            >
              Contract Registry
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
