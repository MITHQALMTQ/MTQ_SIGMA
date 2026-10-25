// MTQΣ — Redeem Simulator (§12.2 — engine doctrine, P0-FIX-2)
// Burn MTQ → release the proportional basket, priced at NAV_t = V_net/S
// (§19.3.2 Step 2 / invariant I6 — the engine's canonical settlement since
// the 2026-10-19 blueprint audit). The audit sub-panel compares the paid
// NAV-based gross against the legacy §3.4.2 index quote (Y × P_MTQ), which
// is now the audit-only alternative; the Δ is the premium actually paid.

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Panel, GlowDot, Pill } from "./primitives";
import { fmtUsd, fmtUsdCompact, fmtFixed, fmtNum, fmtRatio } from "./format";
import { REDEEM_FEE_BY_STATUS } from "@/components/mtq/status-tone";
import type { MetricsSnapshot, RedeemResult } from "@/lib/mtq/engine";
import { ALL_CHAINS } from "@/lib/mtq/contracts";

interface RedeemApiResp {
  ok: boolean;
  redeem?: RedeemResult;
  snapshot: MetricsSnapshot;
  error?: string;
}

export function RedeemSimulator({
  snapshot,
  chain,
  setChain,
  wallet,
  setWallet,
  onAfterTrial,
}: {
  snapshot: MetricsSnapshot | null;
  chain: string;
  setChain: (s: string) => void;
  wallet: string;
  setWallet: (s: string) => void;
  onAfterTrial: () => void;
}) {
  const [amount, setAmount] = useState("100");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);

  async function submit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid MTQ amount");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/simulate/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, chain, wallet: wallet || undefined }),
      });
      const data = (await res.json()) as RedeemApiResp;
      if (data.ok && data.redeem) {
        if (data.redeem.ok) {
          setResult(data.redeem);
          toast.success(`Redeemed ${data.redeem.inputMtq} MTQΣ`, {
            description: `net ${fmtUsd(data.redeem.netUsd)} · fee ${(data.redeem.feeBps / 100).toFixed(2)}% · ${data.redeem.basket.length} assets released`,
          });
        } else {
          setResult(data.redeem);
          toast.warning(`Redeem rejected — ${data.redeem.reason ?? "engine refused"}`);
        }
      } else {
        toast.error(`Redeem failed — ${data.error ?? "unknown error"}`);
      }
    } catch (e) {
      toast.error(`Network error — ${String(e)}`);
    } finally {
      setPending(false);
      onAfterTrial();
    }
  }

  /* §21.4 state-dependent fee — mirrors engine redeemFee() exactly
     (state-machine.ts): S1/S2 0.15% · S3 0.50% · S4 1.00% · S6 0.30%;
     S5 EMERGENCY → redemption is PAUSED (null — the legacy 2.00%
     Listing-13 constant is never charged). Shared map imported from
     status-tone.tsx (same one RedeemSection's §21.4 table renders). */
  const currentStatus = snapshot?.status ?? "NORMAL";
  const feeFraction: number | null = REDEEM_FEE_BY_STATUS[currentStatus];

  return (
    <Panel className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-[#0E1F1B]">Redeem Simulator</div>
          <div className="text-[0.7rem] text-[#5B6E68]">burn MTQΣ → release basket</div>
        </div>
        {feeFraction === null ? (
          <Pill tone="rose">§12 · {currentStatus}: redemption PAUSED (§21.4)</Pill>
        ) : (
          <Pill tone="gold">§12 · fee {(feeFraction * 100).toFixed(2)}% ({currentStatus})</Pill>
        )}
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-[0.625rem] uppercase tracking-[0.22em] text-[#5B6E68]">Input · MTQΣ</span>
          <div className="mt-1 flex items-center rounded-md border border-[#E3EAE6] bg-[#F7FAF8] focus-within:border-mtqs-gold/40 transition">
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              min={0}
              onChange={(e) => setAmount(e.target.value)}
              disabled={pending}
              className="flex-1 bg-transparent px-3 py-2.5 font-mono text-lg text-[#0E1F1B] outline-none disabled:opacity-50"
              aria-label="MTQ amount to redeem"
            />
            <span className="pr-3 text-[#5B6E68] text-xs font-mono">MTQ</span>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[0.625rem] uppercase tracking-[0.22em] text-[#5B6E68]">Chain</span>
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              disabled={pending}
              className="mt-1 w-full rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-2.5 py-2 text-sm text-[#0E1F1B] outline-none focus:border-mtqs-gold/40 disabled:opacity-50"
              aria-label="Chain"
            >
              {ALL_CHAINS.map((c) => (
                <option key={c.id} value={c.id} className="mtqs-glass">
                  {c.label} ({c.nativeCurrency})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[0.625rem] uppercase tracking-[0.22em] text-[#5B6E68]">Wallet (optional)</span>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              disabled={pending}
              placeholder="0x…"
              className="mt-1 w-full rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-2.5 py-2 text-xs font-mono text-[#0E1F1B] outline-none focus:border-mtqs-gold/40 placeholder:text-[#7A8C86] disabled:opacity-50"
              aria-label="Optional pilot wallet address"
            />
          </label>
        </div>

        <button
          onClick={submit}
          disabled={pending}
          className="mtqs-focus w-full rounded-md bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-2.5 text-sm font-semibold text-[#1a1208] shadow-lg shadow-amber-500/15 transition hover:from-amber-200 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Redeem MTQΣ"
        >
          {pending ? "Redeeming…" : "Redeem MTQΣ"}
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={`rounded-lg border p-4 ${result.ok ? "border-mtqs-emerald/30 bg-mtqs-emerald/5" : "border-mtqs-rose/30 bg-mtqs-rose/5"}`}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[0.7rem] uppercase tracking-[0.22em] text-[#5B6E68]">
                  {result.ok ? "Redeem executed" : "Redeem rejected"}
                </div>
                {result.ok ? <Pill tone="emerald"><GlowDot color="emerald" size="h-1.5 w-1.5" /> ok</Pill> : <Pill tone="rose"><GlowDot color="rose" size="h-1.5 w-1.5" /> rejected</Pill>}
              </div>
              {result.reason && (
                <div className="mb-2 text-[0.75rem] text-mtqs-rose/90">{result.reason}</div>
              )}

              <div className="grid grid-cols-2 gap-2.5 text-[0.75rem]">
                <Row label="Input MTQ" value={fmtNum(result.inputMtq, 4)} />
                <Row label="Reference Value" value={fmtFixed(result.mtqPrice, 4)} tone="gold" />
                <Row label="Gross USD (NAV_t · §12.2)" value={fmtUsd(result.grossUsd)} tone="emerald" />
                <Row label={`Fee (${(result.feeBps / 100).toFixed(2)}%)`} value={fmtUsd(result.feeUsd)} tone="rose" />
                <Row label="Net USD" value={fmtUsd(result.netUsd)} tone="gold" />
                <Row label="Gold portion" value={`${fmtUsdCompact(result.goldUsd)} · ${fmtNum(result.goldPaxg, 4)} PAXG`} />
                <Row label="New circulating" value={fmtNum(result.newCirculatingSupply, 2)} />
                <Row label="New RR" value={Number.isFinite(result.newReserveRatio) ? fmtRatio(result.newReserveRatio) : "∞"} />
              </div>

              {/* Released basket */}
              {result.ok && result.basket.length > 0 && (
                <div className="mt-3">
                  <div className="text-[0.65rem] uppercase tracking-[0.22em] text-[#5B6E68] mb-1.5">Released Basket</div>
                  <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
                    <table className="w-full text-[0.7rem]">
                      <thead className="bg-[#F7FAF8] text-[#5B6E68]">
                        <tr>
                          <th className="text-left px-2 py-1.5 font-medium">Currency</th>
                          <th className="text-left px-2 py-1.5 font-medium">Token</th>
                          <th className="text-right px-2 py-1.5 font-medium">Native</th>
                          <th className="text-right px-2 py-1.5 font-medium">USD</th>
                          <th className="text-right px-2 py-1.5 font-medium">Weight</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.basket.map((b, i) => (
                          <tr key={b.currency} className={`border-t border-[#E3EAE6] ${i % 2 ? "bg-[#FAFCFA]" : ""}`}>
                            <td className="px-2 py-1.5 font-mono">{b.currency}</td>
                            <td className="px-2 py-1.5 font-mono text-mtqs-gold">{b.token}</td>
                            <td className="px-2 py-1.5 font-mono text-right">{fmtNum(b.nativeAmount, b.currency === "JPY" ? 0 : 4)}</td>
                            <td className="px-2 py-1.5 font-mono text-right text-mtqs-gold">{fmtUsd(b.usdValue)}</td>
                            <td className="px-2 py-1.5 font-mono text-right text-[#5B6E68]">{(b.weight * 100).toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* HONEST AUDIT SUB-PANEL — the engine's actual doctrine
                  (P0-FIX-2 / §19.3.2 Step 2 / invariant I6): redemption
                  settles at NAV_t; the §3.4.2 index quote is the audit-only
                  comparison; the Δ IS the premium actually paid. */}
              <div className="mt-3 rounded-md border border-mtqs-emerald/30 bg-mtqs-emerald/5 p-3">
                <div className="flex items-start gap-2 mb-2">
                  <GlowDot color="emerald" size="h-2 w-2" className="mt-1" />
                  <div className="text-[0.7rem] font-semibold text-mtqs-emerald">
                    Honest Audit · settles at NAV_t (§12.2) vs §3.4.2 index
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[0.72rem] mb-2">
                  <div className="rounded-md border border-mtqs-emerald/30 bg-mtqs-emerald/[0.08] p-2">
                    <div className="text-[#5B6E68]">NAV per token (§12.2 · SETTLEMENT)</div>
                    <div className="font-mono text-mtqs-emerald">{fmtUsd(result.auditNavPerToken)}</div>
                    <div className="text-[0.6rem] text-[#5B6E68]">V_net / S · the price actually paid</div>
                  </div>
                  <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-2">
                    <div className="text-[#5B6E68]">Gross paid (Y × NAV_per_token)</div>
                    <div className="font-mono text-mtqs-emerald">{fmtUsd(result.auditGrossUsdNav)}</div>
                    <div className="text-[0.6rem] text-[#5B6E68]">the settlement amount (this run)</div>
                  </div>
                  <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-2">
                    <div className="text-[#5B6E68]">Δ vs §3.4.2 (NAV − index)</div>
                    <div className="font-mono text-mtqs-emerald">{fmtUsd(result.auditDeltaUsd)}</div>
                    <div className="text-[0.6rem] text-[#5B6E68]">premium actually paid over Y × P_MTQ</div>
                  </div>
                </div>
                <p className="text-[0.72rem] text-[#5B6E68] leading-relaxed">
                  The engine settles redemption at <span className="font-mono">NAV_per_token = V_net/S</span>{" "}
                  (§19.3.2 Step 2, invariant I6 — P0-FIX-2, 2026-10-19 audit): at RR &gt; 100% this pays
                  redeemers the <span className="font-semibold">book value</span> of the token. The legacy
                  §3.4.2 index-priced figure (Y × <span className="font-mono">P_MTQ</span>) is retained
                  as the <span className="font-semibold text-mtqs-emerald">audit-only comparison</span>;
                  the Δ above is the premium actually paid over the index quote in this run. The
                  risk-state machine (fees, throttles, §21.4 pause) governs the extraction rate.
                </p>
                <details className="mt-2 text-[0.68rem] text-[#5B6E68]">
                  <summary className="cursor-pointer text-mtqs-emerald/85">Full audit note</summary>
                  <p className="mt-1 leading-relaxed">{result.auditNote}</p>
                </details>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

function Row({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "rose" | "gold" | "emerald" }) {
  const color = tone === "rose" ? "text-mtqs-rose" : tone === "gold" ? "text-mtqs-gold" : tone === "emerald" ? "text-mtqs-emerald" : "text-[#0E1F1B]";
  return (
    <div>
      <div className="text-[#5B6E68] text-[0.65rem] uppercase tracking-[0.18em]">{label}</div>
      <div className={`font-mono ${color}`}>{value}</div>
    </div>
  );
}
