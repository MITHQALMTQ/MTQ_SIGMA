// MTQΣ — Error UX (§61)
// Human-readable error translator. Takes a raw error (string | Error | null |
// undefined) and renders a structured card with:
//   - WHAT HAPPENED (plain English description)
//   - WHY (the cause)
//   - WHAT YOU CAN DO (actionable next steps)
//   - Collapsible developer section: raw revert + contract selector
//
// Color system: rose for errors, amber for warnings, emerald for success.
// Pattern-matches common on-chain / pilot errors to a known taxonomy. Falls
// back to a generic "unknown error" with the raw message + Contact support.

"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Bug,
  LifeBuoy,
} from "lucide-react";
import { CANONICAL_MTQ_ADDRESSES } from "@/lib/mtq/contracts";

export type ErrorLevel = "error" | "warning" | "success";

export interface ErrorTranslation {
  level: ErrorLevel;
  title: string;
  whatHappened: string;
  why: string;
  whatYouCanDo: string[];
  /** Optional canonical contract selector (4-byte hex) for developers. */
  contractSelector?: string;
  /** Optional chain hint (so the developer section can resolve the contract). */
  chainId?: string;
  /** Pattern that matched (for diagnostics). */
  matchedPattern?: string;
}

interface ErrorDisplayProps {
  rawError: string | Error | null | undefined;
  /** Optional context the error occurred in (e.g., 'mint' | 'redeem'). */
  context?: string;
  /** Optional chain id (used to resolve the canonical contract address in the
   *  developer collapsible). */
  chainId?: string;
  /** Force a level (overrides pattern inference). */
  level?: ErrorLevel;
  /** Optional override translation (skips pattern inference). */
  translation?: ErrorTranslation;
  /** Optional className to merge with the root panel. */
  className?: string;
}

/* ---------- Pattern taxonomy ---------- */

interface PatternDef {
  pattern: RegExp;
  level: ErrorLevel;
  title: string;
  whatHappened: string;
  why: string;
  whatYouCanDo: string[];
}

const PATTERNS: PatternDef[] = [
  {
    pattern: /execution reverted/i,
    level: "error",
    title: "Transaction Failed",
    whatHappened:
      "The smart contract rejected this transaction. This may be due to insufficient balance, paused state, or a safety circuit breaker.",
    why: "A revert is the contract's way of refusing to settle. The most common causes are: the protocol is in a paused state (minting or redemption disabled), the Reference Value has moved outside the 0.50–2.00 safety band, or your wallet's balance is insufficient to cover the deposit plus gas.",
    whatYouCanDo: [
      "Check the Risk / State Check step — if the protocol is in STRESS, DEFENSIVE, or EMERGENCY, wait for it to return to NORMAL, CAUTION, or RECOVERY.",
      "Verify your wallet holds enough testnet USDC plus gas (native token) for the operation.",
      "Open the collapsible developer section below to read the raw revert reason — it usually contains the exact contract guard that failed.",
    ],
  },
  {
    pattern: /insufficient funds|insufficient balance|not enough/i,
    level: "error",
    title: "Insufficient Balance",
    whatHappened:
      "You don't have enough testnet USDC to complete this mint (or enough MTQΣ to complete this redeem).",
    why: "The mint operation requires the deposit amount plus the gas fee in your wallet. If your USDC balance is below the deposit amount, or your native gas balance is below the network fee, the transaction will fail before it reaches the contract.",
    whatYouCanDo: [
      "Visit the Faucets step and claim testnet USDC (Arc Testnet faucet) plus the native gas token for your chosen chain.",
      "Reduce the deposit amount to below your current USDC balance minus a small buffer.",
      "Switch to a different chain where you already have a funded testnet wallet.",
    ],
  },
  {
    pattern: /oracle paused|oracle consensus paused|fewer than.*oracle/i,
    level: "warning",
    title: "Oracle Consensus Paused",
    whatHappened:
      "The protocol has paused operations because fewer than 2 oracle sources are available.",
    why: "MTQΣ's canonical oracle architecture (§9.3) requires at least 2 of the 3 sources (Chainlink, Pyth, Chronicle) to be valid. With fewer than 2, the median/average consensus cannot be safely computed and the protocol suspends mint + rebalance operations to protect existing holders.",
    whatYouCanDo: [
      "Wait for oracle consensus to be restored — the protocol will automatically resume operations when at least 2 sources are valid again.",
      "Check the Oracle Health metric on the overview — it shows the live valid/total source count.",
      "If the issue persists, monitor the Transparency section for the oracle incident report.",
    ],
  },
  {
    pattern: /price out of band|outside safety band|outside the 0\.50|outside.*2\.00/i,
    level: "error",
    title: "Reference Value Outside Safety Band",
    whatHappened:
      "The reference index has moved outside the 0.50–2.00 safety range.",
    why: "The mint circuit breaker (§3) is engaged whenever the chain-linked I_t leaves the constitutional safety band. This prevents minting at a stale or manipulated reference value. The protocol will refuse to settle until the index returns within the band.",
    whatYouCanDo: [
      "Wait for the reference engine to compute a new I_t within the safety band.",
      "Check the Reference Value metric on the overview — if it shows a value outside [0.50, 2.00], the circuit breaker is correctly engaged.",
      "If this is unexpected, monitor the Transparency section for the price-event report and oracle status.",
    ],
  },
  {
    pattern: /mint paused|minting paused|minting is paused/i,
    level: "warning",
    title: "Minting Paused",
    whatHappened:
      "The protocol is in a risk state that suspends minting.",
    why: "The §21.3 circuit breaker pauses minting in STRESS, DEFENSIVE, and EMERGENCY. This protects existing holders from dilution during stress. CAUTION mints at 50% throttle; RECOVERY mints at 25% throttle. Only NORMAL mints at 100% capacity.",
    whatYouCanDo: [
      "Wait for the risk state to transition to NORMAL, CAUTION, or RECOVERY. The Risk Timeline on the Reference section shows recent transitions and their causes.",
      "If you need to exit a position, redemption remains available in all states except EMERGENCY.",
      "Monitor the Risk State metric on the overview for live state transitions.",
    ],
  },
  {
    pattern: /redeem paused|redemption paused/i,
    level: "warning",
    title: "Redemption Paused",
    whatHappened:
      "The protocol is in EMERGENCY state, where redemption is paused by §21.4.",
    why: "Redemption is paused only in EMERGENCY. In all other states (NORMAL, CAUTION, STRESS, DEFENSIVE, RECOVERY), redemption remains available — potentially at a higher fee (DEFENSIVE 1.00%, EMERGENCY 2.00% would apply if redemption were available).",
    whatYouCanDo: [
      "Wait for the protocol to exit EMERGENCY. The Risk Timeline tracks state transitions.",
      "If EMERGENCY persists, monitor the Transparency section for incident reports.",
      "Do not attempt to bypass the pause — there is no valid pathway that avoids the circuit breaker.",
    ],
  },
  {
    pattern: /user rejected|denied transaction signature|rejected the request/i,
    level: "warning",
    title: "Signature Rejected",
    whatHappened:
      "You rejected the signature request in your wallet. No transaction was broadcast.",
    why: "The wallet correctly returned a user-rejection error. Nothing was signed, nothing was sent to the network, and no gas was charged.",
    whatYouCanDo: [
      "If this was intentional, no action is needed — you can dismiss this message.",
      "If you want to proceed, retry the operation and approve the signature request in your wallet.",
    ],
  },
  {
    pattern: /network error|fetch failed|timeout|ETIMEDOUT|ECONNRESET/i,
    level: "warning",
    title: "Network Error",
    whatHappened:
      "The application could not reach the server. The transaction was not submitted.",
    why: "A network connectivity issue prevented the request from completing. This is typically a transient connection issue between your browser and the application server, or between the server and the chain RPC.",
    whatYouCanDo: [
      "Check your internet connection and try again.",
      "If the issue persists, the application server may be temporarily unavailable — wait a moment and retry.",
      "If you were in the middle of a transaction, no on-chain action was taken — your wallet balance is unchanged.",
    ],
  },
  {
    pattern: /slippage|exceeded.*slippage|too much slippage/i,
    level: "warning",
    title: "Slippage Exceeded",
    whatHappened:
      "The Reference Value moved more than the slippage tolerance (1%) between your estimate and the on-chain settlement.",
    why: "MTQΣ's mint contract reverts if the settled output is below the minimum output you specified. This protects you from receiving materially less than the estimate. The 1% tolerance is the protocol default per §10.",
    whatYouCanDo: [
      "Retry the operation — the Reference Value may have settled back within tolerance.",
      "If you want a higher tolerance, contact the pilot administrator (the protocol default is fixed at 1% for safety).",
      "Large deposits move the Reference Value more than small ones — try splitting into smaller mints.",
    ],
  },
];

/* ---------- Default translation (no pattern matched) ---------- */
function defaultTranslation(rawMsg: string): ErrorTranslation {
  return {
    level: "error",
    title: "Unexpected Error",
    whatHappened:
      "An unexpected error occurred while processing this operation. The pilot engine was unable to settle the transaction.",
    why: "The error did not match any of the known on-chain / oracle / risk-state error patterns. The raw error message is preserved in the developer section below for diagnosis.",
    whatYouCanDo: [
      "Copy the raw error from the developer section below.",
      "Contact support with the raw error and a description of what you were doing when it occurred.",
      "Retry the operation after a moment — if the error is transient, it may not recur.",
    ],
    matchedPattern: "default",
  };
}

/* ---------- Pattern matcher ---------- */
function translateError(
  rawError: string | Error | null | undefined,
  context?: string,
  forcedLevel?: ErrorLevel,
  override?: ErrorTranslation,
): ErrorTranslation | null {
  if (override) return override;
  if (rawError == null) return null;
  const rawMsg = typeof rawError === "string" ? rawError : rawError?.message ?? String(rawError);
  if (!rawMsg) return null;

  for (const p of PATTERNS) {
    if (p.pattern.test(rawMsg)) {
      return {
        level: forcedLevel ?? p.level,
        title: p.title,
        whatHappened: p.whatHappened,
        why: p.why,
        whatYouCanDo: p.whatYouCanDo,
        matchedPattern: p.pattern.source,
      };
    }
  }
  return defaultTranslation(rawMsg);
}

/* ---------- Derive a contract selector from the error string ---------- */
function deriveSelector(rawError: string | Error | null | undefined): string | undefined {
  if (rawError == null) return undefined;
  const rawMsg = typeof rawError === "string" ? rawError : rawError?.message ?? String(rawError);
  // Match 4-byte selector (0x followed by 8 hex chars).
  const m = rawMsg.match(/0x[0-9a-fA-F]{8}/);
  return m ? m[0] : undefined;
}

/* ---------- Tone → border / bg / icon ---------- */
function toneStyles(level: ErrorLevel) {
  switch (level) {
    case "error":
      return {
        border: "border-mtqs-rose/40",
        bg: "bg-mtqs-rose/[0.05]",
        text: "text-mtqs-rose",
        icon: AlertCircle,
        label: "ERROR",
      };
    case "warning":
      return {
        border: "border-mtqs-amber/40",
        bg: "bg-mtqs-amber/[0.05]",
        text: "text-mtqs-amber",
        icon: AlertTriangle,
        label: "WARNING",
      };
    case "success":
      return {
        border: "border-mtqs-emerald/40",
        bg: "bg-mtqs-emerald/[0.05]",
        text: "text-mtqs-emerald",
        icon: CheckCircle2,
        label: "OK",
      };
  }
}

/* ---------- Main component ---------- */
export function ErrorDisplay({
  rawError,
  context,
  chainId,
  level,
  translation,
  className = "",
}: ErrorDisplayProps) {
  const [devOpen, setDevOpen] = useState(false);

  const resolved = useMemo(
    () => translateError(rawError, context, level, translation),
    [rawError, context, level, translation],
  );

  if (!resolved) return null;

  const tone = toneStyles(resolved.level);
  const Icon = tone.icon;
  const rawMsg = rawError
    ? typeof rawError === "string"
      ? rawError
      : rawError instanceof Error
      ? `${rawError.name}: ${rawError.message}${rawError.stack ? `\n${rawError.stack}` : ""}`
      : String(rawError)
    : "";
  const selector = translation?.contractSelector ?? deriveSelector(rawError);
  const contractInfo = chainId ? CANONICAL_MTQ_ADDRESSES[chainId] : undefined;

  return (
    <div
      role={resolved.level === "error" ? "alert" : "status"}
      aria-live={resolved.level === "error" ? "assertive" : "polite"}
      className={`rounded-lg border ${tone.border} ${tone.bg} p-4 sm:p-5 ${className}`}
    >
      {/* Title row */}
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 shrink-0 ${tone.text}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[0.62rem] font-mono uppercase tracking-[0.22em] ${tone.text}`}>
              {tone.label}
            </span>
            {context ? (
              <span className="text-[0.62rem] uppercase tracking-[0.18em] text-white/45">
                · {context}
              </span>
            ) : null}
            {resolved.matchedPattern && resolved.matchedPattern !== "default" ? (
              <span className="text-[0.62rem] font-mono text-white/35">
                · pattern: {resolved.matchedPattern}
              </span>
            ) : null}
          </div>
          <h3 className={`mt-1 text-base font-semibold ${tone.text}`}>{resolved.title}</h3>
        </div>
      </div>

      {/* WHAT HAPPENED */}
      <div className="mt-4 space-y-3">
        <div>
          <div className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55 mb-1">
            What happened
          </div>
          <p className="text-[0.82rem] text-white/80 leading-relaxed">{resolved.whatHappened}</p>
        </div>

        {/* WHY */}
        <div>
          <div className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55 mb-1">
            Why
          </div>
          <p className="text-[0.82rem] text-white/65 leading-relaxed">{resolved.why}</p>
        </div>

        {/* WHAT YOU CAN DO */}
        <div>
          <div className="text-[0.62rem] uppercase tracking-[0.22em] text-white/55 mb-1.5">
            What you can do
          </div>
          <ol className="space-y-1.5">
            {resolved.whatYouCanDo.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-[0.82rem] text-white/75 leading-relaxed">
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${tone.border} ${tone.text} text-[0.6rem] font-mono`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Developer collapsible */}
      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <button
          type="button"
          onClick={() => setDevOpen((v) => !v)}
          aria-expanded={devOpen}
          className="mtqs-focus inline-flex items-center gap-1.5 text-[0.68rem] font-mono uppercase tracking-[0.18em] text-white/55 hover:text-white/80 transition"
        >
          {devOpen ? (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <Bug className="h-3.5 w-3.5" aria-hidden="true" />
          For developers · raw error {selector ? `· ${selector}` : ""}
        </button>

        {devOpen ? (
          <div className="mt-2 space-y-2 text-[0.72rem]">
            <pre className="overflow-x-auto rounded-md border border-white/[0.06] bg-black/30 p-3 font-mono text-white/75 leading-relaxed whitespace-pre-wrap break-words">
{rawMsg || "(no raw message)"}
            </pre>

            {selector ? (
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02]/[0.02] p-3">
                <div className="text-[0.62rem] uppercase tracking-[0.18em] text-white/55 mb-1">
                  Contract selector
                </div>
                <div className="font-mono text-mtqs-gold break-all">{selector}</div>
                {contractInfo ? (
                  <div className="mt-2 text-[0.72rem] text-white/55">
                    Likely canonical contract on {contractInfo.chain}:{" "}
                    <span className="font-mono text-mtqs-gold break-all">{contractInfo.address}</span>{" "}
                    —{" "}
                    <a
                      href={contractInfo.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-mtqs-emerald hover:underline"
                    >
                      view on explorer ↗
                    </a>
                  </div>
                ) : (
                  <div className="mt-2 text-[0.72rem] text-white/45">
                    Pass <code className="font-mono text-white/70">chainId</code> to resolve the canonical contract address.
                  </div>
                )}
              </div>
            ) : null}

            <div className="flex items-center gap-1.5 text-[0.72rem] text-white/55">
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                Contact support with the raw error above. Include the operation you were attempting
                {context ? ` (${context})` : ""} and a short description of what you observed.
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
