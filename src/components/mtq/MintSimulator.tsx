// MTQΣ — Mint Simulator (§12.1)
// Pilot users simulate Mint: deposit USDC → mint MTQΣ = X·(1−fee)/P_MTQ.

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Panel, Reveal, GlowDot, Pill, TickNumber } from "./primitives";
import { fmtUsd, fmtFixed, fmtNum, fmtRatio } from "./format";
import { MINT_FEE_BPS } from "@/lib/mtq/blueprint";
import type { MetricsSnapshot, MintResult } from "@/lib/mtq/engine";
import { ALL_CHAINS } from "@/lib/mtq/contracts";

interface MintApiResp {
  ok: boolean;
  mint?: MintResult;
  snapshot: MetricsSnapshot;
  error?: string;
}

export function MintSimulator({
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
  const [amount, setAmount] = useState("1000");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<MintResult | null>(null);
  const oraclePaused = snapshot?.oraclePaused ?? false;

  async function submit() {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid USDC amount");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/simulate/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, chain, wallet: wallet || undefined }),
      });
      const data = (await res.json()) as MintApiResp;
      if (data.ok && data.mint) {
        if (data.mint.ok) {
          setResult(data.mint);
          toast.success(`Minted ${data.mint.mtqMinted.toFixed(4)} MTQΣ`, {
            description: `${fmtUsd(amt)} USDC → ${fmtUsd(data.mint.netUsd)} net @ ${fmtFixed(data.mint.mtqPrice, 4)}`,
          });
        } else {
          setResult(data.mint);
          toast.warning(`Mint rejected — ${data.mint.reason ?? "engine refused"}`);
        }
      } else {
        toast.error(`Mint failed — ${data.error ?? "unknown error"}`);
      }
    } catch (e) {
      toast.error(`Network error — ${String(e)}`);
    } finally {
      setPending(false);
      onAfterTrial();
    }
  }

  const feeBps = MINT_FEE_BPS;

  return (
    <Panel className="p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground/90">Mint Simulator</div>
          <div className="text-[0.7rem] text-muted-foreground/70">deposit USDC → mint MTQΣ</div>
        </div>
        <Pill tone="gold">§12.1 · fee {(feeBps / 100).toFixed(2)}%</Pill>
      </div>

      {oraclePaused && (
        <div className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2.5">
          <div className="flex items-center gap-2 text-rose-200">
            <GlowDot color="rose" size="h-2 w-2" />
            <span className="text-sm font-medium">Minting suspended — oracle consensus paused (§9.3)</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <label className="block">
          <span className="text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground/80">Input · USDC</span>
          <div className="mt-1 flex items-center rounded-md border border-white/[0.08] bg-white/[0.02] focus-within:border-amber-400/40 transition">
            <span className="pl-3 text-amber-200 font-mono text-sm">$</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              min={0}
              onChange={(e) => setAmount(e.target.value)}
              disabled={pending || oraclePaused}
              className="flex-1 bg-transparent px-2 py-2.5 font-mono text-lg text-foreground outline-none disabled:opacity-50"
              aria-label="USDC amount to mint"
            />
            <span className="pr-3 text-muted-foreground/70 text-xs font-mono">USDC</span>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground/80">Chain</span>
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              disabled={pending}
              className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 text-sm text-foreground outline-none focus:border-amber-400/40 disabled:opacity-50"
              aria-label="Chain"
            >
              {ALL_CHAINS.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0b0f0e]">
                  {c.label} ({c.nativeCurrency})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground/80">Wallet (optional)</span>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              disabled={pending}
              placeholder="0x…"
              className="mt-1 w-full rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-2 text-xs font-mono text-foreground outline-none focus:border-amber-400/40 placeholder:text-muted-foreground/40 disabled:opacity-50"
              aria-label="Optional pilot wallet address"
            />
          </label>
        </div>

        <button
          onClick={submit}
          disabled={pending || oraclePaused}
          className="mtqs-focus w-full rounded-md bg-gradient-to-b from-amber-300 to-amber-500 px-4 py-2.5 text-sm font-semibold text-[#1a1208] shadow-lg shadow-amber-500/15 transition hover:from-amber-200 hover:to-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Mint MTQΣ"
        >
          {pending ? "Minting…" : "Mint MTQΣ"}
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
            <div className={`rounded-lg border p-4 ${result.ok ? "border-emerald-400/30 bg-emerald-500/[0.04]" : "border-rose-400/30 bg-rose-500/[0.04]"}`}>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-[0.7rem] uppercase tracking-[0.22em] text-muted-foreground/80">
                  {result.ok ? "Mint executed" : "Mint rejected"}
                </div>
                {result.ok ? <Pill tone="emerald"><GlowDot color="emerald" size="h-1.5 w-1.5" /> ok</Pill> : <Pill tone="rose"><GlowDot color="rose" size="h-1.5 w-1.5" /> rejected</Pill>}
              </div>
              {result.reason && (
                <div className="mb-2 text-[0.75rem] text-rose-200/90">{result.reason}</div>
              )}
              <div className="grid grid-cols-2 gap-2.5 text-[0.75rem]">
                <Row label="Input" value={fmtUsd(result.inputUsd)} />
                <Row label={`Fee (${(feeBps / 100).toFixed(2)}%)`} value={fmtUsd(result.feeUsd)} tone="rose" />
                <Row label="Net deposit" value={fmtUsd(result.netUsd)} />
                <Row label="MTQ price" value={`$${fmtFixed(result.mtqPrice, 4)}`} tone="gold" />
                <Row label="Throttle factor" value={`${(result.throttleFactor * 100).toFixed(0)}%`} />
                <Row label="New RR" value={Number.isFinite(result.newReserveRatio) ? fmtRatio(result.newReserveRatio) : "∞"} />
              </div>
              <div className="mt-3 rounded-md border border-amber-400/30 bg-amber-500/[0.08] p-3">
                <div className="text-[0.625rem] uppercase tracking-[0.22em] text-amber-200/80">MTQΣ Minted</div>
                <TickNumber
                  value={result.mtqMinted}
                  format={(n) => fmtNum(n, 4)}
                  className="text-2xl font-bold mtqs-gold-text"
                />
                <span className="ml-1 text-sm text-muted-foreground/70 font-mono">MTQ</span>
                <div className="mt-1 text-[0.7rem] text-muted-foreground/70">
                  New circulating supply: <span className="font-mono text-amber-200">{fmtNum(result.newCirculatingSupply, 2)}</span> MTQ
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

function Row({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "rose" | "gold" | "emerald" }) {
  const color = tone === "rose" ? "text-rose-300" : tone === "gold" ? "text-amber-200" : tone === "emerald" ? "text-emerald-200" : "text-foreground";
  return (
    <div>
      <div className="text-muted-foreground/85 text-[0.65rem] uppercase tracking-[0.18em]">{label}</div>
      <div className={`font-mono ${color}`}>{value}</div>
    </div>
  );
}
