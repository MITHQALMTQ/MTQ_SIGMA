// MTQΣ — Transaction UX Flow (§60)
// Guided 11-step transaction flow for mint/redeem:
//   Review → Risk/State Check → Estimated Result → Slippage → Network → Gas →
//   Contract → Confirm → Pending → Confirmed → Explorer
//
// For the pilot:
//   - Steps 1-3 are interactive (input amount, see risk/state, see estimate)
//   - Steps 4-11 are shown as "awaiting on-chain confirmation" with
//     what-happens / why / what-you-should-know explanations
//   - Step 8 (Confirm) attempts the actual pilot trial via /api/simulate/mint,
//     and the result is surfaced inline in steps 9-11 so the user can see
//     what the broadcast / confirmation / explorer view WOULD look like.
//
// Design rules: deep-space glassmorphic, gold/emerald/rose accents, tabular
// numerals, "Reference Value" (NOT "MTQ Price"), no USD-peg language.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  ExternalLink,
  AlertCircle,
  Info,
  Gauge,
  Network as NetworkIcon,
  Fuel,
  FileCode,
  Shield,
  Hourglass,
  CircleCheck,
  Compass,
} from "lucide-react";
import { Panel, GlowDot, Pill } from "./primitives";
import { fmtUsd, fmtFixed, fmtNum, fmtRatio } from "./format";
import { MINT_FEE_BPS, SLIPPAGE_TOLERANCE } from "@/lib/mtq/blueprint";
import { STATUS_COLORS } from "@/lib/mtq/brand";
import { CANONICAL_MTQ_ADDRESSES, getChain } from "@/lib/mtq/contracts";
import type { MetricsSnapshot, MintResult } from "@/lib/mtq/engine";
import { ErrorDisplay } from "./ErrorDisplay";

/* ---------- Step metadata (single source of truth for the 11 steps) ---------- */

interface StepDef {
  id: number;
  short: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  what: string;   // what's happening
  why: string;    // why this step exists
  know: string;   // what the user should know
}

const STEPS: StepDef[] = [
  {
    id: 1,
    short: "Review",
    title: "Review",
    icon: Info,
    what: "You are reviewing the exact deposit, fee, net deposit, expected output, and minimum output before any signature is requested.",
    why: "A signed transaction cannot be undone. Review is the moment to catch a wrong amount, wrong chain, or wrong recipient.",
    know: "Numbers update live from the reference engine. The fee is the published mint fee (0.10% in NORMAL state). Net deposit = input − fee. Expected output uses the live Reference Value.",
  },
  {
    id: 2,
    short: "Risk / State",
    title: "Risk / State Check",
    icon: Shield,
    what: "The protocol's canonical risk state machine is read on-chain. Minting is allowed only in NORMAL, CAUTION (50% throttle), and RECOVERY (25% throttle).",
    why: "Minting is paused in STRESS, DEFENSIVE, and EMERGENCY by the §21.3 circuit breaker. This protects existing holders from dilution during stress.",
    know: "If the state is paused, this step will refuse to confirm. The pilot will surface the cause (state + oracle health) and recommend waiting for the protocol to return to a non-paused state.",
  },
  {
    id: 3,
    short: "Estimate",
    title: "Estimated Result",
    icon: Gauge,
    what: "The computed MTQΣ amount you will receive, given the live Reference Value, the mint fee, and the current throttle factor.",
    why: "You must know what you will receive before signing. The estimate is non-binding — the on-chain result will be settled by the contract.",
    know: "Estimate = (net deposit / Reference Value) × throttle. Slippage tolerance (1%) protects you from a moving Reference Value between sign and confirm.",
  },
  {
    id: 4,
    short: "Slippage",
    title: "Slippage",
    icon: Gauge,
    what: "The maximum acceptable deviation between the estimated output and the on-chain settled output, expressed as a fraction of expected.",
    why: "The Reference Value updates continuously. A slippage tolerance prevents the transaction from settling at a value materially worse than the estimate.",
    know: "Pilot default is 1% (the protocol's slippage tolerance per §10). If the on-chain Reference Value moves more than 1% against you, the contract will revert.",
  },
  {
    id: 5,
    short: "Network",
    title: "Network",
    icon: NetworkIcon,
    what: "The target chain is selected and its RPC endpoint is checked. The transaction is prepared for broadcast to that chain's mempool.",
    why: "MTQΣ is deployed on multiple testnets. Selecting the wrong chain is the most common cross-chain mistake — this step makes the choice explicit.",
    know: "The pilot supports Monad Testnet, Arc Testnet, Robinhood Testnet, and Solana Devnet. Each has a canonical MTQΣ address listed in the contracts registry.",
  },
  {
    id: 6,
    short: "Gas",
    title: "Gas",
    icon: Fuel,
    what: "Gas price is fetched from the network, gas limit is estimated for the mint call, and total gas cost is shown in the native token.",
    why: "A failed transaction still costs gas. Knowing the gas cost up front lets you decide whether the mint is worth it.",
    know: "On Monad, gas is paid in MON. On Arc, in ETH-equivalent. On Solana, in SOL. Use the relevant faucet if your balance is too low.",
  },
  {
    id: 7,
    short: "Contract",
    title: "Contract",
    icon: FileCode,
    what: "The MTQΣ contract address on the selected chain is read from the canonical registry. The transaction's calldata is built against this address.",
    why: "Address poisoning has stolen millions. The canonical address is the only address that should ever receive a mint call.",
    know: "Verify the address against the contracts registry before signing. The pilot will display the full canonical address and a link to its block explorer.",
  },
  {
    id: 8,
    short: "Confirm",
    title: "Confirm",
    icon: CheckCircle2,
    what: "Final review of every parameter before signing. After you confirm, the transaction is signed and broadcast.",
    why: "This is the last human checkpoint. Once signed, the transaction is irreversible.",
    know: "Confirm only if every prior step's value matches your intent. The pilot will execute the trial via the simulation engine so you can observe the full lifecycle.",
  },
  {
    id: 9,
    short: "Pending",
    title: "Pending",
    icon: Hourglass,
    what: "The signed transaction is in the mempool, awaiting inclusion in a block.",
    why: "Block space is finite. The transaction will be included when the network accepts the gas price.",
    know: "Pending time depends on gas price and network congestion. The pilot will show a simulated pending state followed by the simulated confirmation.",
  },
  {
    id: 10,
    short: "Confirmed",
    title: "Confirmed",
    icon: CircleCheck,
    what: "The transaction has been included in a block. The MTQΣ amount is now credited to your wallet.",
    why: "Once confirmed, the mint is settled. The reference engine updates the reserve and circulating supply.",
    know: "The pilot's simulation engine finalizes the trial at this step. The result is recorded to the SQLite trial log for auditability.",
  },
  {
    id: 11,
    short: "Explorer",
    title: "Explorer",
    icon: Compass,
    what: "The transaction hash is opened on the chain's block explorer so you can independently verify inclusion, block, and logs.",
    why: "Don't trust, verify. The explorer is the source of truth for on-chain state — not the application UI.",
    know: "Pilot trials produce a deterministic simulation hash. The explorer link opens the canonical MTQΣ address page where you can verify the contract.",
  },
];

/* ---------- Live estimate from snapshot ---------- */
interface Estimate {
  inputUsd: number;
  feeUsd: number;
  netUsd: number;
  mtqPrice: number;
  throttleFactor: number;
  expectedMtq: number;
  minOutput: number;
  mintingAllowed: boolean;
}

function computeEstimate(amount: number, snapshot: MetricsSnapshot | null): Estimate | null {
  if (!snapshot || !Number.isFinite(amount) || amount <= 0) return null;
  const feeUsd = amount * (MINT_FEE_BPS / 10_000);
  const netUsd = amount - feeUsd;
  const mtqPrice = snapshot.mtqPrice > 0 ? snapshot.mtqPrice : 1;
  const status = snapshot.status;
  const throttle =
    status === "NORMAL" ? 1.0 :
    status === "CAUTION" ? 0.5 :
    status === "RECOVERY" ? 0.25 :
    0;
  const allowed =
    status !== "STRESS" && status !== "DEFENSIVE" && status !== "EMERGENCY";
  const expectedMtq = (netUsd / mtqPrice) * throttle;
  const minOutput = expectedMtq * (1 - SLIPPAGE_TOLERANCE);
  return {
    inputUsd: amount,
    feeUsd,
    netUsd,
    mtqPrice,
    throttleFactor: throttle,
    expectedMtq,
    minOutput,
    mintingAllowed: allowed,
  };
}

/* ---------- Helper: small data row ---------- */
function DataRow({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "gold" | "emerald" | "rose" | "amber";
  hint?: string;
}) {
  const toneClass = new Map([
    ["default", "text-white"],
    ["gold", "text-mtqs-gold"],
    ["emerald", "text-mtqs-emerald"],
    ["rose", "text-mtqs-rose"],
    ["amber", "text-mtqs-amber"],
  ]).get(tone) ?? "text-white";
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <div className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55">{label}</div>
        {hint ? <div className="text-[0.62rem] text-white/45">{hint}</div> : null}
      </div>
      <div className={`font-mono tabular-nums text-sm ${toneClass}`}>{value}</div>
    </div>
  );
}

/* ---------- Awaiting step placeholder (steps 4-11) ---------- */
function AwaitingPanel({ step }: { step: StepDef }) {
  const Icon = step.icon;
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]/[0.02] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02]/[0.02]">
          <Icon className="h-4 w-4 text-white/55" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55">
              Step {step.id} · {step.title}
            </span>
            <Pill tone="amber">
              <GlowDot color="amber" size="h-1.5 w-1.5" />
              awaiting on-chain confirmation
            </Pill>
          </div>
          <p className="text-[0.78rem] text-white/75 leading-relaxed">{step.what}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[0.72rem]">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.01]/[0.02] p-3">
          <div className="text-[0.62rem] uppercase tracking-[0.2em] text-mtqs-emerald/85 mb-1">Why</div>
          <p className="text-white/65 leading-relaxed">{step.why}</p>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.01]/[0.02] p-3">
          <div className="text-[0.62rem] uppercase tracking-[0.2em] text-mtqs-gold/85 mb-1">What you should know</div>
          <p className="text-white/65 leading-relaxed">{step.know}</p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Result of the actual pilot trial (steps 9-11) ---------- */
function PilotExecutionResult({
  result,
  chainId,
  error,
}: {
  result: MintResult | null;
  chainId: string;
  error: string | null;
}) {
  const info = CANONICAL_MTQ_ADDRESSES[chainId];
  if (error) {
    return (
      <div className="rounded-lg border border-mtqs-rose/30 bg-mtqs-rose/[0.06] p-4">
        <div className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-rose/85 mb-2">
          Pilot Execution — Error
        </div>
        <ErrorDisplay rawError={error} context="mint" />
      </div>
    );
  }
  if (!result) return null;
  return (
    <div
      className={`rounded-lg border p-4 ${
        result.ok
          ? "border-mtqs-emerald/30 bg-mtqs-emerald/[0.06]"
          : "border-mtqs-rose/30 bg-mtqs-rose/[0.06]"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55">
          Pilot Execution — {result.ok ? "Settled" : "Rejected"}
        </div>
        {result.ok ? (
          <Pill tone="emerald">
            <GlowDot color="emerald" size="h-1.5 w-1.5" />
            ok
          </Pill>
        ) : (
          <Pill tone="rose">
            <GlowDot color="rose" size="h-1.5 w-1.5" />
            rejected
          </Pill>
        )}
      </div>
      {result.reason ? (
        <div className="mb-2 text-[0.78rem] text-mtqs-rose/90">{result.reason}</div>
      ) : null}
      <div className="grid grid-cols-2 gap-2 text-[0.78rem]">
        <DataRow label="Input" value={fmtUsd(result.inputUsd)} />
        <DataRow label={`Fee (${(MINT_FEE_BPS / 100).toFixed(2)}%)`} value={fmtUsd(result.feeUsd)} tone="rose" />
        <DataRow label="Net deposit" value={fmtUsd(result.netUsd)} />
        <DataRow label="Reference Value" value={fmtFixed(result.mtqPrice, 4)} tone="gold" />
        <DataRow label="MTQΣ minted" value={fmtNum(result.mtqMinted, 4)} tone="gold" />
        <DataRow
          label="New RR"
          value={Number.isFinite(result.newReserveRatio) ? fmtRatio(result.newReserveRatio) : "∞"}
          tone="emerald"
        />
      </div>
      {result.ok && info ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3 text-[0.72rem]">
          <span className="text-white/55">Verify on explorer:</span>
          <a
            href={info.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="mtqs-focus inline-flex items-center gap-1.5 rounded-md border border-mtqs-emerald/30 bg-mtqs-emerald/[0.06] px-2.5 py-1 text-mtqs-emerald transition hover:bg-mtqs-emerald/[0.1]"
          >
            {info.chain}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- The main component ---------- */

type FlowMode = "mint" | "redeem";

export function TransactionFlow({
  snapshot,
  mode = "mint",
  chain,
  setChain,
}: {
  snapshot: MetricsSnapshot | null;
  mode?: FlowMode;
  chain: string;
  setChain: (s: string) => void;
}) {
  const [activeStep, setActiveStep] = useState<number>(1);
  const [amount, setAmount] = useState<string>("1000");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<MintResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const est = useMemo(() => computeEstimate(Number(amount), snapshot), [amount, snapshot]);
  const status = snapshot?.status ?? "NORMAL";
  const sb = STATUS_COLORS[status] ?? STATUS_COLORS.NORMAL;
  const mintingAllowed = snapshot?.mintingAllowed ?? true;
  const oracleOk = snapshot ? !snapshot.oraclePaused : true;
  const inBand = snapshot?.priceInBand ?? true;

  // The first 3 steps are interactive; steps 4-11 are read-only awaiting.
  const canGoBack = activeStep > 1;
  const canGoNext = activeStep < 3;

  async function confirmAndExecute() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/simulate/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), chain }),
      });
      const data = (await res.json()) as { ok: boolean; mint?: MintResult; error?: string };
      if (data.ok && data.mint) {
        setResult(data.mint);
        if (!data.mint.ok && data.mint.reason) setError(data.mint.reason);
        setActiveStep(9); // jump to Pending (9) which then surfaces Confirmed/Explorer
      } else {
        setError(data.error ?? "Unknown error from mint API");
      }
    } catch (e) {
      setError(String(e));
    } finally {
      if (mountedRef.current) setPending(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setActiveStep(1);
  }

  const chainInfo = getChain(chain);
  const contractInfo = CANONICAL_MTQ_ADDRESSES[chain];

  return (
    <Panel className="p-5 sm:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm font-semibold text-white/90">
            Transaction Flow · {mode === "mint" ? "Mint" : "Redeem"}
          </div>
          <div className="text-[0.7rem] text-white/55">
            11-step guided flow · steps 1-3 interactive · steps 4-11 awaiting on-chain confirmation
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Pill tone="gold">§60 · guided flow</Pill>
          <Pill tone={status === "NORMAL" ? "emerald" : status === "CAUTION" || status === "RECOVERY" ? "amber" : "rose"}>
            <GlowDot
              color={status === "NORMAL" ? "emerald" : status === "CAUTION" || status === "RECOVERY" ? "amber" : "rose"}
              size="h-1.5 w-1.5"
            />
            {sb.label}
          </Pill>
        </div>
      </div>

      {/* Stepper — horizontal scroll on mobile, full row on desktop */}
      <div className="overflow-x-auto -mx-1 px-1 mtqs-no-scrollbar" role="tablist" aria-label="Transaction flow steps">
        <ol className="flex items-center gap-1 min-w-max">
          {STEPS.map((s, i) => {
            const isActive = s.id === activeStep;
            const isComplete = s.id < activeStep;
            const isAwaiting = s.id > 3 && s.id > activeStep;
            const Icon = s.icon;
            const tone =
              isActive
                ? "border-mtqs-gold/50 bg-mtqs-gold/[0.12] text-mtqs-gold-light"
                : isComplete
                ? "border-mtqs-emerald/40 bg-mtqs-emerald/[0.08] text-mtqs-emerald"
                : isAwaiting
                ? "border-white/[0.08] bg-white/[0.02]/[0.02] text-white/55"
                : "border-white/[0.1] bg-white/[0.02]/[0.02] text-white/70";
            return (
              <li key={s.id} className="flex items-center">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Step ${s.id} · ${s.title}`}
                  onClick={() => setActiveStep(s.id)}
                  className={`mtqs-focus flex flex-col items-center gap-1.5 rounded-md border px-3 py-2 transition ${tone}`}
                >
                  <span className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="text-[0.62rem] font-mono">{String(s.id).padStart(2, "0")}</span>
                  </span>
                  <span className="text-[0.62rem] uppercase tracking-[0.16em] whitespace-nowrap">{s.short}</span>
                </button>
                {i < STEPS.length - 1 ? (
                  <div
                    className={`h-px w-5 sm:w-8 ${
                      isComplete ? "bg-mtqs-emerald/40" : "bg-white/[0.06]"
                    }`}
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Active step detail */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStep}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {/* STEP 1 — REVIEW */}
          {activeStep === 1 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-mtqs-gold/20 bg-mtqs-gold/[0.04] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
                  <span className="text-[0.7rem] font-semibold text-mtqs-gold-light">
                    Step 1 · Review — full breakdown before signature
                  </span>
                </div>
                <p className="text-[0.75rem] text-white/65 leading-relaxed">
                  {STEPS[0].what} {STEPS[0].know}
                </p>
              </div>

              {/* Input row */}
              <label className="block">
                <span className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55">
                  Input · USDC
                </span>
                <div className="mt-1 flex items-center rounded-md border border-white/[0.06] bg-white/[0.02]/[0.02] focus-within:border-mtqs-gold/40 transition">
                  <span className="pl-3 text-mtqs-gold font-mono text-sm">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    min={0}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={pending}
                    className="flex-1 bg-transparent px-2 py-2.5 font-mono text-lg text-white outline-none disabled:opacity-50"
                    aria-label="USDC amount to mint"
                  />
                  <span className="pr-3 text-white/55 text-xs font-mono">USDC</span>
                </div>
              </label>

              {/* Breakdown */}
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02]/[0.02] p-4">
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55 mb-2">
                  Review · breakdown
                </div>
                <div className="divide-y divide-white/[0.04]">
                  <DataRow label="Deposit" value={est ? fmtUsd(est.inputUsd) : "—"} tone="gold" />
                  <DataRow
                    label={`Mint fee (${(MINT_FEE_BPS / 100).toFixed(2)}%)`}
                    value={est ? fmtUsd(est.feeUsd) : "—"}
                    tone="rose"
                    hint="Paid to protocol treasury (§13.2 sweep target)"
                  />
                  <DataRow label="Net deposit" value={est ? fmtUsd(est.netUsd) : "—"} tone="emerald" />
                  <DataRow
                    label="Reference Value"
                    value={snapshot ? fmtFixed(snapshot.mtqPrice, 4) : "—"}
                    tone="gold"
                    hint="Chain-linked I_t · live"
                  />
                  <DataRow
                    label="Expected MTQΣ output"
                    value={est ? fmtNum(est.expectedMtq, 4) : "—"}
                    tone="gold"
                  />
                  <DataRow
                    label="Minimum output (after 1% slippage)"
                    value={est ? fmtNum(est.minOutput, 4) : "—"}
                    hint="Contract reverts if settled output is below this"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 — RISK / STATE CHECK */}
          {activeStep === 2 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-mtqs-emerald/20 bg-mtqs-emerald/[0.04] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-mtqs-emerald" aria-hidden="true" />
                  <span className="text-[0.7rem] font-semibold text-mtqs-emerald">
                    Step 2 · Risk / State Check — §21.3 circuit breaker
                  </span>
                </div>
                <p className="text-[0.75rem] text-white/65 leading-relaxed">
                  {STEPS[1].what} {STEPS[1].know}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02]/[0.02] p-3">
                  <div className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55">Risk State</div>
                  <div
                    className="font-mono tabular-nums text-base"
                    style={{ color: sb.color }}
                  >
                    {sb.label}
                  </div>
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02]/[0.02] p-3">
                  <div className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55">Minting</div>
                  <div
                    className={`font-mono tabular-nums text-base ${
                      mintingAllowed ? "text-mtqs-emerald" : "text-mtqs-rose"
                    }`}
                  >
                    {mintingAllowed ? "allowed" : "paused"}
                  </div>
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02]/[0.02] p-3">
                  <div className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55">Throttle</div>
                  <div className="font-mono tabular-nums text-base text-white">
                    {est ? `${(est.throttleFactor * 100).toFixed(0)}%` : "—"}
                  </div>
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02]/[0.02] p-3">
                  <div className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55">Oracle</div>
                  <div
                    className={`font-mono tabular-nums text-base ${
                      oracleOk ? "text-mtqs-emerald" : "text-mtqs-rose"
                    }`}
                  >
                    {oracleOk ? "ok" : "paused"}
                  </div>
                </div>
              </div>

              {!mintingAllowed ? (
                <div className="rounded-md border border-mtqs-rose/30 bg-mtqs-rose/[0.06] p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-mtqs-rose shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-[0.78rem] text-mtqs-rose/90">
                      <span className="font-semibold">Minting paused.</span>{" "}
                      The protocol is in <span className="font-mono">{sb.label}</span> — the §21.3
                      circuit breaker suspends minting to protect existing holders. Wait for the
                      protocol to return to NORMAL, CAUTION, or RECOVERY before confirming.
                    </div>
                  </div>
                </div>
              ) : null}

              {!oracleOk ? (
                <div className="rounded-md border border-mtqs-rose/30 bg-mtqs-rose/[0.06] p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-mtqs-rose shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-[0.78rem] text-mtqs-rose/90">
                      <span className="font-semibold">Oracle consensus paused.</span>{" "}
                      Fewer than 2 oracle sources are available. Minting is suspended by §9.3
                      until oracle consensus is restored.
                    </div>
                  </div>
                </div>
              ) : null}

              {!inBand ? (
                <div className="rounded-md border border-mtqs-rose/30 bg-mtqs-rose/[0.06] p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-mtqs-rose shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="text-[0.78rem] text-mtqs-rose/90">
                      <span className="font-semibold">Reference Value outside safety band.</span>{" "}
                      The chain-linked I_t has moved outside the 0.50–2.00 safety range. The
                      mint circuit breaker is engaged.
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border border-white/[0.06] bg-white/[0.01]/[0.02] p-3 text-[0.72rem] text-white/60 leading-relaxed">
                <span className="text-mtqs-gold/85">Why: </span>
                {STEPS[1].why}
              </div>
            </div>
          )}

          {/* STEP 3 — ESTIMATED RESULT */}
          {activeStep === 3 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-mtqs-gold/20 bg-mtqs-gold/[0.04] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Gauge className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
                  <span className="text-[0.7rem] font-semibold text-mtqs-gold-light">
                    Step 3 · Estimated Result — what you will receive
                  </span>
                </div>
                <p className="text-[0.75rem] text-white/65 leading-relaxed">
                  {STEPS[2].what} {STEPS[2].know}
                </p>
              </div>

              <div className="rounded-lg border border-mtqs-gold/30 bg-mtqs-gold/[0.06] p-5 text-center">
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-mtqs-gold/85 mb-2">
                  Expected MTQΣ Output
                </div>
                <div className="font-mono tabular-nums text-4xl sm:text-5xl font-semibold mtqs-gold-text">
                  {est ? fmtNum(est.expectedMtq, 4) : "—"}
                </div>
                <div className="mt-2 text-[0.72rem] text-white/55 font-mono">
                  min output {est ? fmtNum(est.minOutput, 4) : "—"} MTQ · 1% slippage tolerance
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[0.78rem]">
                <DataRow label="Reference Value" value={snapshot ? fmtFixed(snapshot.mtqPrice, 4) : "—"} tone="gold" />
                <DataRow label="Net deposit" value={est ? fmtUsd(est.netUsd) : "—"} />
                <DataRow label="Throttle" value={est ? `${(est.throttleFactor * 100).toFixed(0)}%` : "—"} tone="amber" />
              </div>
            </div>
          )}

          {/* STEPS 4-7 — awaiting steps */}
          {activeStep >= 4 && activeStep <= 7 ? (
            <AwaitingPanel step={STEPS[activeStep - 1]} />
          ) : null}

          {/* STEP 8 — CONFIRM */}
          {activeStep === 8 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-mtqs-emerald/20 bg-mtqs-emerald/[0.04] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-mtqs-emerald" aria-hidden="true" />
                  <span className="text-[0.7rem] font-semibold text-mtqs-emerald">
                    Step 8 · Confirm — final review before signature
                  </span>
                </div>
                <p className="text-[0.75rem] text-white/65 leading-relaxed">
                  {STEPS[7].what} {STEPS[7].know}
                </p>
              </div>

              {/* Final review summary */}
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02]/[0.02] p-4">
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55 mb-2">
                  You are signing
                </div>
                <div className="divide-y divide-white/[0.04]">
                  <DataRow label="Operation" value={mode === "mint" ? "Mint MTQΣ" : "Redeem MTQΣ"} />
                  <DataRow label="Chain" value={chainInfo?.label ?? chain} />
                  <DataRow label="Contract" value={contractInfo ? contractInfo.address.slice(0, 10) + "…" + contractInfo.address.slice(-6) : "—"} tone="gold" />
                  <DataRow label="Deposit" value={est ? fmtUsd(est.inputUsd) : "—"} tone="gold" />
                  <DataRow label="Fee" value={est ? fmtUsd(est.feeUsd) : "—"} tone="rose" />
                  <DataRow label="Net deposit" value={est ? fmtUsd(est.netUsd) : "—"} />
                  <DataRow label="Reference Value" value={snapshot ? fmtFixed(snapshot.mtqPrice, 4) : "—"} tone="gold" />
                  <DataRow label="Expected MTQΣ" value={est ? fmtNum(est.expectedMtq, 4) : "—"} tone="gold" />
                  <DataRow label="Min output (1% slippage)" value={est ? fmtNum(est.minOutput, 4) : "—"} />
                </div>
              </div>

              <button
                type="button"
                disabled={pending || !mintingAllowed || !oracleOk || !inBand || !est}
                onClick={confirmAndExecute}
                className="mtqs-focus inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-2.5 text-sm font-semibold text-[#1a1208] shadow-lg shadow-amber-500/15 transition hover:from-amber-200 hover:to-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Confirm transaction — execute via pilot simulation engine"
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Submitting…
                  </>
                ) : (
                  <>
                    Confirm Transaction
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
              <p className="text-[0.65rem] text-white/45 leading-snug text-center">
                The pilot executes this via the simulation engine so you can observe the
                full lifecycle. On mainnet, this button would sign and broadcast the
                transaction to the selected chain's mempool.
              </p>
            </div>
          )}

          {/* STEP 9 — PENDING */}
          {activeStep === 9 && (
            <div className="space-y-3">
              <AwaitingPanel step={STEPS[8]} />
              <PilotExecutionResult result={result} chainId={chain} error={error} />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStep(10)}
                  className="mtqs-focus inline-flex items-center gap-1.5 text-[0.72rem] text-mtqs-emerald/80 hover:text-mtqs-emerald transition"
                >
                  Skip to Confirmed
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="mtqs-focus inline-flex items-center gap-1.5 text-[0.72rem] text-white/55 hover:text-white transition"
                >
                  Reset flow
                </button>
              </div>
            </div>
          )}

          {/* STEP 10 — CONFIRMED */}
          {activeStep === 10 && (
            <div className="space-y-3">
              <AwaitingPanel step={STEPS[9]} />
              <PilotExecutionResult result={result} chainId={chain} error={error} />
              <button
                type="button"
                onClick={() => setActiveStep(11)}
                className="mtqs-focus inline-flex items-center gap-1.5 text-[0.72rem] text-mtqs-emerald/80 hover:text-mtqs-emerald transition"
              >
                Open in Explorer
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          {/* STEP 11 — EXPLORER */}
          {activeStep === 11 && (
            <div className="space-y-3">
              <AwaitingPanel step={STEPS[10]} />
              <PilotExecutionResult result={result} chainId={chain} error={error} />
              {contractInfo ? (
                <a
                  href={contractInfo.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mtqs-focus inline-flex w-full items-center justify-center gap-2 rounded-md border border-mtqs-emerald/30 bg-mtqs-emerald/[0.06] px-4 py-2.5 text-sm font-semibold text-mtqs-emerald transition hover:bg-mtqs-emerald/[0.1]"
                >
                  <Compass className="h-4 w-4" aria-hidden="true" />
                  Open {contractInfo.chain} Explorer
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              ) : null}
              <button
                type="button"
                onClick={reset}
                className="mtqs-focus inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.02]/[0.02] px-4 py-2.5 text-sm font-medium text-white/80 transition hover:border-mtqs-gold/30 hover:text-white"
              >
                Reset flow
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation footer */}
      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <button
          type="button"
          onClick={() => setActiveStep((s) => Math.max(1, s - 1))}
          disabled={!canGoBack && activeStep === 1}
          className="mtqs-focus inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02]/[0.02] px-3 py-2 text-[0.75rem] font-medium text-white/75 transition hover:border-white/[0.16] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous step"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back
        </button>
        <div className="text-[0.65rem] text-white/45 font-mono">
          step {String(activeStep).padStart(2, "0")} / 11 · {STEPS[activeStep - 1].title}
        </div>
        {canGoNext ? (
          <button
            type="button"
            onClick={() => setActiveStep((s) => Math.min(11, s + 1))}
            className="mtqs-focus inline-flex items-center gap-1.5 rounded-md border border-mtqs-gold/30 bg-mtqs-gold/[0.06] px-3 py-2 text-[0.75rem] font-semibold text-mtqs-gold-light transition hover:bg-mtqs-gold/[0.1]"
            aria-label="Next step"
          >
            Next
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : activeStep < 8 ? (
          <button
            type="button"
            onClick={() => setActiveStep(8)}
            className="mtqs-focus inline-flex items-center gap-1.5 rounded-md border border-mtqs-gold/30 bg-mtqs-gold/[0.06] px-3 py-2 text-[0.75rem] font-semibold text-mtqs-gold-light transition hover:bg-mtqs-gold/[0.1]"
            aria-label="Jump to Confirm"
          >
            Go to Confirm
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 text-[0.75rem] text-white/45">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            awaiting
          </span>
        )}
      </div>
    </Panel>
  );
}
