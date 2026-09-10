// MTQΣ — Trial Section
// 7 steps for a pilot user: Faucets → Canonical addresses → Mint simulator →
// Redeem simulator → Guided Transaction Flow (§60) → Trial log → Error UX (§61).
// Step progress indicator at the top.
//
// Props: { onNavigate, snapshot }.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, ArrowRight, Droplets, Coins, Flame, ScrollText, Workflow, AlertOctagon } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading } from "@/components/mtq/primitives";
import { MintSimulator } from "@/components/mtq/MintSimulator";
import { RedeemSimulator } from "@/components/mtq/RedeemSimulator";
import { TransactionFlow } from "@/components/mtq/TransactionFlow";
import { ErrorDisplay } from "@/components/mtq/ErrorDisplay";
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
    { n: 5, label: "Guided Flow" },
    { n: 6, label: "Trial log" },
    { n: 7, label: "Error UX" },
  ];
  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center text-[0.68rem] sm:text-[0.78rem] font-mono font-semibold text-mtqs-gold-light">
              {s.n}
            </div>
            <span className="text-[0.55rem] sm:text-[0.62rem] uppercase tracking-[0.1em] sm:tracking-[0.12em] text-white/55/75 text-center leading-tight">
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
        title="Trial Simulator — 7 Steps"
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
          <p className="mt-4 text-[0.72rem] text-white/55 leading-relaxed">
            Run the closed loop end-to-end: fund a testnet wallet from a faucet, copy the canonical
            MTQΣ address, mint MTQΣ against USDC, redeem MTQΣ back into the basket, run the guided
            11-step transaction flow, review your trial history, and explore how the protocol
            surfaces errors. Every step is logged to SQLite for auditability.
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
            <p className="text-[0.72rem] text-white/55/75 mt-1 ml-9">
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
                      className="h-3.5 w-3.5 text-white/55/60 group-hover:text-mtqs-gold-light transition"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="text-sm font-semibold text-white/90 group-hover:text-mtqs-gold-light transition">
                    {f.label}
                  </div>
                  <div className="mt-1 text-[0.68rem] text-white/55 leading-relaxed">
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
            <p className="text-[0.72rem] text-white/55/75 mt-1 ml-9">
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
            <p className="text-[0.72rem] text-white/55/75 mt-1 ml-9">
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
            <p className="text-[0.72rem] text-white/55/75 mt-1 ml-9">
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

      {/* Step 5 — Guided Transaction Flow (§60) */}
      <section aria-labelledby="trial-flow">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center text-[0.72rem] font-mono font-semibold text-mtqs-gold-light">
                5
              </div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Workflow className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                Guided Transaction Flow
              </h3>
            </div>
            <p className="text-[0.72rem] text-white/55/75 mt-1 ml-9">
              11-step guided flow: Review → Risk/State → Estimate → Slippage → Network → Gas → Contract → Confirm → Pending → Confirmed → Explorer. Steps 1-3 are interactive; steps 4-11 are shown as &ldquo;awaiting on-chain confirmation&rdquo; with explanations of what each step would do.
            </p>
          </div>
        </div>
        <Reveal>
          <TransactionFlow
            snapshot={snapshot}
            mode="mint"
            chain={chain}
            setChain={setChain}
          />
        </Reveal>
      </section>

      {/* Step 6 — Trial log */}
      <section aria-labelledby="trial-log">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center text-[0.72rem] font-mono font-semibold text-mtqs-gold-light">
                6
              </div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                Trial Log
              </h3>
            </div>
            <p className="text-[0.72rem] text-white/55/75 mt-1 ml-9">
              Every mint/redeem is stored in SQLite. Most recent first.
            </p>
          </div>
        </div>
        <Reveal>
          <TrialLog trials={trials} loading={trialsLoading} onRefresh={fetchTrials} />
        </Reveal>
      </section>

      {/* Step 7 — Error UX demo (§61) */}
      <ErrorUxDemo snapshot={snapshot} chain={chain} />

      {/* Closing CTA */}
      <Reveal>
        <Panel variant="emerald" className="p-5 sm:p-6 text-center">
          <p className="text-[0.82rem] text-white/55 leading-relaxed max-w-2xl mx-auto mb-4">
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

/* ---------- Step 7 — Error UX demo (§61) ----------
   Lets the user trigger each known error pattern and see how the protocol
   translates it into a human-readable WHAT HAPPENED / WHY / WHAT YOU CAN DO. */
function ErrorUxDemo({ snapshot, chain }: { snapshot: MetricsSnapshot | null; chain: string }) {
  const SAMPLE_ERRORS: { label: string; raw: string; ctx: string }[] = [
    { label: "execution reverted", raw: "execution reverted: MTQSigmaV2: mint paused by §21.3 circuit breaker (state=STRESS) 0xa9059cbb", ctx: "mint" },
    { label: "insufficient funds", raw: "insufficient funds for gas * price + value: address 0xAbC...1234 have 8.21 USDC, need 1000.00 USDC", ctx: "mint" },
    { label: "oracle paused", raw: "oracle consensus paused: only 1 of 3 oracle sources valid (Chainlink stale > 60s)", ctx: "mint" },
    { label: "price out of band", raw: "price out of band: chain-linked I_t = 2.13 exceeds safety band [0.50, 2.00]", ctx: "mint" },
    { label: "mint paused", raw: "mint paused: protocol state = DEFENSIVE — minting suspended by §21.3", ctx: "mint" },
    { label: "user rejected", raw: "user rejected transaction signature", ctx: "mint" },
    { label: "network error", raw: "Network error: fetch failed — ETIMEDOUT", ctx: "mint" },
    { label: "slippage exceeded", raw: "execution reverted: slippage exceeded (settled output 997.42 MTQ < min output 999.00 MTQ)", ctx: "mint" },
    { label: "unknown error", raw: "TypeError: cannot read property 'balance' of undefined at Object.settle", ctx: "mint" },
  ];
  const [active, setActive] = useState(0);

  // If the live snapshot's risk state is paused or oracle paused, surface
  // the corresponding live error too so the user can see the connection.
  const status = snapshot?.status ?? "NORMAL";
  const liveErr = useMemo(() => {
    if (snapshot?.oraclePaused) {
      return {
        label: "LIVE · oracle paused",
        raw: "oracle consensus paused: live snapshot indicates <2 oracle sources valid",
        ctx: "mint",
      };
    }
    if (status === "STRESS" || status === "DEFENSIVE" || status === "EMERGENCY") {
      return {
        label: `LIVE · mint paused (${status})`,
        raw: `mint paused: protocol state = ${status} — minting suspended by §21.3`,
        ctx: "mint",
      };
    }
    return null;
  }, [snapshot, status]);

  const current = liveErr ?? SAMPLE_ERRORS[active];

  return (
    <section aria-labelledby="trial-error-ux">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center text-[0.72rem] font-mono font-semibold text-mtqs-gold-light">
              7
            </div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
              Error UX — Human-Readable Translator
            </h3>
          </div>
          <p className="text-[0.72rem] text-white/55/75 mt-1 ml-9">
            Click any sample error to see how the protocol translates it into
            WHAT HAPPENED · WHY · WHAT YOU CAN DO. The collapsible developer
            section exposes the raw revert and contract selector.
          </p>
        </div>
      </div>
      <Reveal>
        <Panel className="p-5 flex flex-col gap-4">
          {/* Sample error picker */}
          <div className="flex flex-wrap items-center gap-2">
            {SAMPLE_ERRORS.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => setActive(i)}
                aria-pressed={!liveErr && active === i}
                className={`mtqs-focus inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[0.7rem] font-mono transition ${
                  !liveErr && active === i
                    ? "border-mtqs-gold/40 bg-mtqs-gold/[0.1] text-mtqs-gold-light"
                    : "border-white/[0.08] bg-white/[0.02]/[0.02] text-white/65 hover:border-white/[0.16] hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Rendered error */}
          <ErrorDisplay
            rawError={current.raw}
            context={current.ctx}
            chainId={chain}
          />

          <p className="text-[0.65rem] text-white/45 leading-snug">
            Errors are categorized by pattern into <span className="text-mtqs-rose">errors</span>{" "}
            (rose · user/protocol fault), <span className="text-mtqs-amber">warnings</span>{" "}
            (amber · transient / informational), and{" "}
            <span className="text-mtqs-emerald">success</span> (emerald · informational OK).
            Pattern matches are surfaced in the developer section so support can
            reproduce the diagnosis.
          </p>
        </Panel>
      </Reveal>
    </section>
  );
}
