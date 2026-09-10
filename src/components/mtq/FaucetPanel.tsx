// MTQΣ — Testnet Faucet Panel (§41)
// Simulated faucet for the MTQΣ pilot. Pilot users pick a testnet network +
// a test asset + a wallet address + a claim amount, then hit Claim. We fire
// the request at /api/simulate/mint (which already mints MTQ against the
// engine, deducts fees, updates RR) — we then surface the engine's response
// plus a deterministic simulated tx hash so the UI feels like a real faucet.
//
// Hard honesty contract (also called out in §41 prompt):
//   - "TESTNET — All assets are simulated. No real value." banner at the top
//   - Simulated tx hashes are deterministic (sha-ish 64-hex) and clearly labelled
//   - Claim button is gated by a 30s cooldown so pilot users can't spam the
//     engine's mint path.
//
// Design rules (2026 deep-space glassmorphic):
//   - mtqs-glass panel, gold border accent on hover/focus.
//   - Strict brand palette (gold / emerald / rose / amber). NO blue/indigo.
//   - tabular-nums on every numeric field.
//   - Responsive: stacked on mobile, side-by-side on desktop.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Wallet,
  Coins,
  Droplets,
  Timer,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Panel, Pill, GlowDot, Reveal } from "./primitives";
import { shortAddr, copyToClipboard, fmtNum, fmtFixed } from "./format";
import {
  ALL_CHAINS,
  CANONICAL_MTQ_ADDRESSES,
  type ChainInfo,
} from "@/lib/mtq/contracts";

/* ---------- Constants ---------- */
const COOLDOWN_SECONDS = 30;
const DEFAULT_CLAIM_AMOUNT = 1000;
const MAX_CLAIM_AMOUNT = 100_000;

/** Testnet-only filter — mainnet chains (Base / Arbitrum) are pending deploy. */
const TESTNET_CHAIN_IDS = ["monad", "arc", "robinhood", "solana"];

/** Per-network faucet asset catalogue. Each asset has a symbol + decimals +
 *  a short description. We surface the canonical mock-collateral (MockUSDC)
 *  on EVM testnets, plus the native gas token. On Solana devnet we only
 *  surface SOL since the SPL faucet is separate. */
interface FaucetAsset {
  symbol: string;
  name: string;
  decimals: number;
  description: string;
}

const ASSETS_BY_CHAIN: Record<string, FaucetAsset[]> = {
  monad: [
    { symbol: "MON", name: "Monad Testnet MON", decimals: 18, description: "Native gas token" },
    { symbol: "MockUSDC", name: "Mock USDC (pilot collateral)", decimals: 6, description: "Pilot collateral · mint MTQ against this" },
    { symbol: "MTQ", name: "MTQΣ test token", decimals: 18, description: "Protocol claim token" },
  ],
  arc: [
    { symbol: "USDC", name: "Arc Testnet USDC", decimals: 18, description: "Native gas token (testnet)" },
    { symbol: "MockUSDC", name: "Mock USDC (pilot collateral)", decimals: 6, description: "Pilot collateral · mint MTQ against this" },
    { symbol: "MTQ", name: "MTQΣ test token", decimals: 18, description: "Protocol claim token" },
  ],
  robinhood: [
    { symbol: "ETH", name: "Robinhood Testnet ETH", decimals: 18, description: "Native gas token" },
    { symbol: "MockUSDC", name: "Mock USDC (pilot collateral)", decimals: 6, description: "Pilot collateral · mint MTQ against this" },
    { symbol: "MTQ", name: "MTQΣ test token", decimals: 18, description: "Protocol claim token" },
  ],
  solana: [
    { symbol: "SOL", name: "Solana Devnet SOL", decimals: 9, description: "Native gas token" },
    { symbol: "MTQ", name: "MTQΣ SPL token", decimals: 18, description: "Protocol claim token" },
  ],
};

const TESTNET_CHAINS: ChainInfo[] = ALL_CHAINS.filter((c) =>
  TESTNET_CHAIN_IDS.includes(c.id),
);

/* ---------- Simulated tx-hash generator (deterministic, 0x + 64 hex) ---------- */
function makeTxHash(seed: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Expand the 32-bit fnv hash into 64 hex chars via a small LCG chain.
  let cur = h >>> 0;
  let hex = "";
  for (let i = 0; i < 64; i++) {
    cur = (Math.imul(cur, 1664525) + 1013904223) >>> 0;
    hex += (cur & 0xf).toString(16);
  }
  return `0x${hex}`;
}

function makeBlockNumber(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return 10_000_000 + (Math.abs(h) % 5_000_000);
}

/* ---------- Address validation (EVM 0x + 40 hex, or Solana base58 32-44) ---------- */
function isValidAddress(addr: string, chain: ChainInfo): boolean {
  if (!addr) return false;
  if (chain.isEvm) return /^0x[a-fA-F0-9]{40}$/.test(addr);
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr);
}

/* ---------- FaucetPanel ---------- */
export function FaucetPanel() {
  // Chain selection (testnet only). Default: monad. Persist to localStorage.
  const [chainId, setChainId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const s = window.localStorage.getItem("mtqs-faucet-chain");
      if (s && TESTNET_CHAIN_IDS.includes(s)) return s;
    }
    return "monad";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mtqs-faucet-chain", chainId);
    }
  }, [chainId]);

  const chain = useMemo<ChainInfo>(
    () => TESTNET_CHAINS.find((c) => c.id === chainId) ?? TESTNET_CHAINS[0],
    [chainId],
  );
  const assets = ASSETS_BY_CHAIN[chain.id] ?? [];
  const [assetSymbol, setAssetSymbol] = useState<string>(assets[0]?.symbol ?? "MockUSDC");
  // Reset asset when chain changes
  useEffect(() => {
    const list = ASSETS_BY_CHAIN[chain.id] ?? [];
    if (!list.some((a) => a.symbol === assetSymbol)) {
      setAssetSymbol(list[0]?.symbol ?? "MockUSDC");
    }
  }, [chain.id, assetSymbol]);
  const asset = assets.find((a) => a.symbol === assetSymbol) ?? assets[0];

  const [wallet, setWallet] = useState<string>("");
  const [amount, setAmount] = useState<number>(DEFAULT_CLAIM_AMOUNT);
  const [pending, setPending] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [lastTx, setLastTx] = useState<{
    hash: string;
    block: number;
    chain: ChainInfo;
    assetSymbol: string;
    amount: number;
    wallet: string;
    mtqMinted?: number;
    mtqPrice?: number;
    newCirculating?: number;
    gfbIndex?: number;
    reserveRatio?: number;
    ok: boolean;
    reason?: string;
    timestamp: number;
  } | null>(null);

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cooldown ticker — fires once per second, decrements remaining, clears at 0.
  useEffect(() => {
    if (cooldownRemaining <= 0) {
      if (cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
      return;
    }
    if (!cooldownRef.current) {
      cooldownRef.current = setInterval(() => {
        setCooldownRemaining((r) => Math.max(0, r - 1));
      }, 1000);
    }
    return () => {
      if (cooldownRemaining - 1 <= 0 && cooldownRef.current) {
        clearInterval(cooldownRef.current);
        cooldownRef.current = null;
      }
    };
  }, [cooldownRemaining]);

  const walletValid = isValidAddress(wallet, chain);
  const amountValid = Number.isFinite(amount) && amount > 0 && amount <= MAX_CLAIM_AMOUNT;
  const canClaim = !pending && cooldownRemaining === 0 && walletValid && amountValid;

  const handleClaim = useCallback(async () => {
    if (!canClaim) {
      if (!walletValid) toast.error("Enter a valid wallet address for the selected network");
      else if (!amountValid) toast.error(`Amount must be between 0 and ${MAX_CLAIM_AMOUNT.toLocaleString()}`);
      return;
    }
    setPending(true);
    try {
      // Hit /api/simulate/mint — this mints MTQ against the engine (real state
      // change), deducts the 0.10% mint fee, updates RR + circulating supply.
      // The faucet pretends the user deposited `amount` of MockUSDC and got
      // back MTQ; we surface the engine's response alongside the simulated
      // tx hash + block.
      const res = await fetch("/api/simulate/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          chain: chain.id,
          wallet,
        }),
      });
      const data = await res.json();
      const ok = Boolean(data?.ok) && Boolean(data?.mint?.ok);
      const seed = `${chain.id}-${wallet}-${amount}-${assetSymbol}-${Date.now()}`;
      const txHash = makeTxHash(seed);
      const block = makeBlockNumber(seed);
      const mint = data?.mint ?? {};
      const snapshot = data?.snapshot ?? {};

      setLastTx({
        hash: txHash,
        block,
        chain,
        assetSymbol,
        amount,
        wallet,
        mtqMinted: mint.mtqMinted,
        mtqPrice: mint.mtqPrice ?? snapshot.mtqPrice,
        newCirculating: mint.newCirculatingSupply ?? mint.newCirculating,
        gfbIndex: snapshot.gfbIndex,
        reserveRatio: snapshot.reserveRatio,
        ok,
        reason: data?.error ?? mint.reason,
        timestamp: Date.now(),
      });

      if (ok) {
        toast.success("Faucet claim simulated", {
          description: `${assetSymbol} sent · tx ${shortAddr(txHash, 6, 6)}`,
        });
        // Start cooldown only on success
        setCooldownRemaining(COOLDOWN_SECONDS);
      } else {
        toast.error("Faucet claim rejected", {
          description: data?.error ?? mint.reason ?? "Engine rejected the mint",
        });
      }
    } catch (e) {
      toast.error("Faucet request failed", { description: String(e).slice(0, 120) });
    } finally {
      setPending(false);
    }
  }, [canClaim, amount, chain, wallet, assetSymbol, walletValid, amountValid]);

  const canonicalEntry = CANONICAL_MTQ_ADDRESSES[chain.id];
  const canonicalAddr = canonicalEntry?.address ?? "";
  const explorerBase = chain.explorerTxBase ?? chain.explorer;

  return (
    <Reveal>
      <Panel className="p-5 sm:p-6">
        {/* ===== Header + TESTNET honesty banner ===== */}
        <div className="flex flex-col gap-3 mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Droplets className="h-5 w-5 text-mtqs-gold" />
              <h3 className="text-base font-semibold text-white">
                Testnet Faucet
              </h3>
              <Pill tone="gold" className="font-mono tabular-nums">§41</Pill>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone="emerald">
                <GlowDot color="emerald" size="h-1.5 w-1.5" />
                simulated
              </Pill>
            </div>
          </div>
          {/* Hard honesty banner */}
          <div
            role="note"
            className="flex items-start gap-2 rounded-md border border-mtqs-amber/30 bg-mtqs-amber/[0.06] px-3 py-2 text-[0.72rem] text-mtqs-amber/95"
          >
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div>
              <span className="font-semibold uppercase tracking-wider">TESTNET</span>
              <span className="mx-1.5 text-mtqs-amber/60">·</span>
              All assets are simulated. No real value. Claims mint MTQ against
              the live pilot engine — fees + reserve ratio are real state changes.
            </div>
          </div>
        </div>

        {/* ===== Form grid ===== */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Network selector (testnet only) */}
          <div className="space-y-1.5">
            <label
              htmlFor="faucet-network"
              className="text-[0.65rem] uppercase tracking-[0.22em] text-white/55"
            >
              Network
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TESTNET_CHAINS.map((c) => {
                const active = c.id === chain.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setChainId(c.id)}
                    aria-pressed={active}
                    className={`mtqs-focus inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[0.72rem] font-medium transition ${
                      active
                        ? "border-mtqs-gold/40 bg-mtqs-gold/10 text-mtqs-gold"
                        : "border-white/[0.08] bg-white/[0.03]/[0.02] text-white/70 hover:border-mtqs-gold/25 hover:text-white"
                    }`}
                  >
                    <GlowDot color={active ? "gold" : "emerald"} size="h-1.5 w-1.5" />
                    <span className="whitespace-nowrap">{c.label}</span>
                    <span className="font-mono tabular-nums text-[0.62rem] text-white/55">
                      {String(c.chainId)}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Chain meta row */}
            <div className="text-[0.65rem] text-white/55 mt-1 flex items-center gap-2 flex-wrap">
              <span className="font-mono text-mtqs-gold/70">
                RPC {chain.rpcUrl.replace(/^https?:\/\//, "")}
              </span>
              {canonicalAddr && (
                <span className="font-mono text-mtqs-gold/60">
                  · MTQΣ {shortAddr(canonicalAddr, 6, 6)}
                </span>
              )}
            </div>
          </div>

          {/* Test asset selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="faucet-asset"
              className="text-[0.65rem] uppercase tracking-[0.22em] text-white/55"
            >
              Test Asset
            </label>
            <div className="flex flex-wrap gap-1.5">
              {assets.map((a) => {
                const active = a.symbol === assetSymbol;
                return (
                  <button
                    key={a.symbol}
                    type="button"
                    onClick={() => setAssetSymbol(a.symbol)}
                    aria-pressed={active}
                    className={`mtqs-focus inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[0.72rem] font-medium transition ${
                      active
                        ? "border-mtqs-emerald/40 bg-mtqs-emerald/10 text-mtqs-emerald"
                        : "border-white/[0.08] bg-white/[0.03]/[0.02] text-white/70 hover:border-mtqs-emerald/25 hover:text-white"
                    }`}
                  >
                    <Coins className="h-3 w-3" />
                    {a.symbol}
                  </button>
                );
              })}
            </div>
            {asset && (
              <div className="text-[0.65rem] text-white/55 mt-1">
                {asset.name} · {asset.description}
              </div>
            )}
          </div>

          {/* Wallet address input */}
          <div className="space-y-1.5 md:col-span-2">
            <label
              htmlFor="faucet-wallet"
              className="text-[0.65rem] uppercase tracking-[0.22em] text-white/55"
            >
              Wallet Address
            </label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/45" />
              <input
                id="faucet-wallet"
                type="text"
                value={wallet}
                onChange={(e) => setWallet(e.target.value.trim())}
                placeholder={
                  chain.isEvm
                    ? "0x… (40 hex chars)"
                    : "Solana base58 address (32–44 chars)"
                }
                spellCheck={false}
                autoComplete="off"
                aria-invalid={wallet.length > 0 && !walletValid}
                className={`mtqs-focus w-full rounded-md border bg-white/[0.03]/[0.02] pl-9 pr-3 py-2 font-mono text-xs text-white placeholder:text-white/30 transition ${
                  wallet.length === 0
                    ? "border-white/[0.08]"
                    : walletValid
                    ? "border-mtqs-emerald/40"
                    : "border-mtqs-rose/50"
                } focus:outline-none focus:border-mtqs-gold/50`}
              />
              {wallet.length > 0 && (
                <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[0.62rem] font-mono ${walletValid ? "text-mtqs-emerald" : "text-mtqs-rose"}`}>
                  {walletValid ? "valid" : "invalid"}
                </span>
              )}
            </div>
          </div>

          {/* Claim amount input */}
          <div className="space-y-1.5 md:col-span-2">
            <label
              htmlFor="faucet-amount"
              className="text-[0.65rem] uppercase tracking-[0.22em] text-white/55"
            >
              Claim Amount ({asset?.symbol ?? ""})
            </label>
            <div className="flex items-center gap-2">
              <input
                id="faucet-amount"
                type="number"
                value={amount}
                min={1}
                max={MAX_CLAIM_AMOUNT}
                step={1}
                onChange={(e) => setAmount(Number(e.target.value))}
                className={`mtqs-focus w-full rounded-md border bg-white/[0.03]/[0.02] px-3 py-2 font-mono tabular-nums text-xs text-white transition ${
                  amountValid ? "border-white/[0.08]" : "border-mtqs-rose/50"
                } focus:outline-none focus:border-mtqs-gold/50`}
              />
              {/* Quick-pick chips */}
              <div className="flex items-center gap-1.5 shrink-0">
                {[100, 1000, 10000].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAmount(v)}
                    className="mtqs-focus rounded-md border border-white/[0.08] bg-white/[0.03]/[0.02] px-2 py-1.5 font-mono tabular-nums text-[0.65rem] text-white/70 hover:border-mtqs-gold/30 hover:text-mtqs-gold transition"
                  >
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[0.62rem] text-white/45">
              Max {MAX_CLAIM_AMOUNT.toLocaleString()} {asset?.symbol ?? ""} per claim ·
              cooldown {COOLDOWN_SECONDS}s after each successful claim
            </div>
          </div>
        </div>

        {/* ===== Claim button + cooldown ===== */}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={handleClaim}
            disabled={!canClaim}
            aria-busy={pending}
            className={`mtqs-focus inline-flex items-center justify-center gap-2 rounded-md border px-5 py-2.5 text-sm font-semibold transition w-full sm:w-auto ${
              canClaim
                ? "border-mtqs-gold/40 bg-mtqs-gold/10 text-mtqs-gold hover:bg-mtqs-gold/20 hover:border-mtqs-gold/60"
                : "border-white/[0.08] bg-white/[0.03]/[0.02] text-white/40 cursor-not-allowed"
            }`}
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Claiming…
              </>
            ) : cooldownRemaining > 0 ? (
              <>
                <Timer className="h-4 w-4" />
                Available in {cooldownRemaining}s
              </>
            ) : (
              <>
                <Droplets className="h-4 w-4" />
                Claim {amount.toLocaleString()} {asset?.symbol ?? ""}
              </>
            )}
          </button>
          <div className="text-[0.7rem] text-white/55">
            {pending
              ? "Submitting to pilot engine…"
              : cooldownRemaining > 0
              ? `Cooldown active · ${cooldownRemaining}s remaining`
              : walletValid
              ? "Ready to claim"
              : "Enter a valid wallet address to enable claim"}
          </div>
        </div>

        {/* ===== Simulated tx result ===== */}
        <AnimatePresence>
          {lastTx && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-5"
            >
              <div
                role="status"
                className={`rounded-md border p-4 ${
                  lastTx.ok
                    ? "border-mtqs-emerald/30 bg-mtqs-emerald/[0.04]"
                    : "border-mtqs-rose/40 bg-mtqs-rose/[0.06]"
                }`}
              >
                {/* Status row */}
                <div className="flex items-center gap-2 mb-2">
                  {lastTx.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-mtqs-emerald" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-mtqs-rose" />
                  )}
                  <span className={`text-sm font-semibold ${lastTx.ok ? "text-mtqs-emerald" : "text-mtqs-rose"}`}>
                    {lastTx.ok ? "Claim simulated" : "Claim rejected"}
                  </span>
                  <span className="text-[0.62rem] uppercase tracking-wider text-white/55 ml-auto">
                    {new Date(lastTx.timestamp).toLocaleTimeString("en-US")}
                  </span>
                </div>

                {lastTx.ok ? (
                  <>
                    {/* Tx hash row */}
                    <div className="flex items-center gap-2 mb-2 text-[0.72rem]">
                      <span className="uppercase tracking-[0.18em] text-white/55 shrink-0">
                        Tx Hash
                      </span>
                      <span className="font-mono text-mtqs-gold truncate">
                        {shortAddr(lastTx.hash, 10, 10)}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await copyToClipboard(lastTx.hash);
                          if (ok) toast.success("Copied tx hash", { description: shortAddr(lastTx.hash) });
                          else toast.error("Copy failed");
                        }}
                        aria-label="Copy tx hash"
                        className="mtqs-focus text-mtqs-gold/70 hover:text-mtqs-gold transition shrink-0"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                      <a
                        href={`${explorerBase}${lastTx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open simulated tx on explorer (will not exist)"
                        className="mtqs-focus text-mtqs-gold/70 hover:text-mtqs-gold transition shrink-0 inline-flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="hidden sm:inline">explorer</span>
                      </a>
                      <span className="ml-auto font-mono tabular-nums text-white/55 shrink-0">
                        block #{lastTx.block.toLocaleString()}
                      </span>
                    </div>
                    {/* Engine response row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[0.7rem]">
                      <div>
                        <div className="uppercase tracking-[0.18em] text-white/45">Asset</div>
                        <div className="font-mono tabular-nums text-white">
                          {fmtNum(lastTx.amount, 2)} {lastTx.assetSymbol}
                        </div>
                      </div>
                      {Number.isFinite(lastTx.mtqMinted) && (
                        <div>
                          <div className="uppercase tracking-[0.18em] text-white/45">MTQ Minted</div>
                          <div className="font-mono tabular-nums text-mtqs-gold">
                            {fmtNum(lastTx.mtqMinted, 4)}
                          </div>
                        </div>
                      )}
                      {Number.isFinite(lastTx.mtqPrice) && (
                        <div>
                          <div className="uppercase tracking-[0.18em] text-white/45">MTQ Price</div>
                          <div className="font-mono tabular-nums text-mtqs-gold/80">
                            {fmtFixed(lastTx.mtqPrice, 4)}
                          </div>
                        </div>
                      )}
                      {Number.isFinite(lastTx.reserveRatio) && (() => {
                        const rr = lastTx.reserveRatio ?? 0;
                        return (
                          <div>
                            <div className="uppercase tracking-[0.18em] text-white/45">RR post</div>
                            <div className={`font-mono tabular-nums ${rr >= 1.05 ? "text-mtqs-emerald" : "text-mtqs-amber"}`}>
                              {(rr * 100).toFixed(2)}%
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="mt-3 text-[0.62rem] text-white/45 italic">
                      Simulated transaction · hash is deterministic per claim · no
                      on-chain broadcast. The mint path through the engine is real.
                    </div>
                  </>
                ) : (
                  <div className="text-[0.72rem] text-mtqs-rose/90">
                    <span className="font-semibold">Reason:</span> {lastTx.reason ?? "Engine rejected the claim"}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Panel>
    </Reveal>
  );
}

