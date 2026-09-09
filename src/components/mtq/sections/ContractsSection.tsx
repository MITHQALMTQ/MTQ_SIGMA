// MTQΣ — Contracts Section
// Chain tabs (4 from ALL_CHAINS) · Canonical MTQΣ card (gold, CANONICAL_MTQ_ADDRESSES)
// · Ecosystem contracts table (with search filter) · Copy buttons + explorer links.
//
// Props: { onNavigate }.

"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, ArrowRight } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot } from "@/components/mtq/primitives";
import { shortAddr, copyToClipboard } from "@/components/mtq/format";
import {
  ALL_CHAINS,
  CANONICAL_MTQ_ADDRESSES,
  buildExplorerAddressUrl,
  type ChainInfo,
} from "@/lib/mtq/contracts";
import type { SectionId } from "@/components/mtq/Navigation";

/* ---------- Copy button ---------- */
function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        const ok = await copyToClipboard(value);
        if (ok) toast.success(`Copied ${label}`, { description: shortAddr(value) });
        else toast.error("Copy failed");
      }}
      className="text-[0.65rem] font-mono text-mtqs-gold/70 hover:text-mtqs-gold transition px-1.5 py-0.5 rounded border border-transparent hover:border-mtqs-amber/30"
      aria-label={`Copy ${label}`}
    >
      copy
    </button>
  );
}

/* ---------- Chain tab ---------- */
function ChainTab({ chain, active, onClick }: { chain: ChainInfo; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`mtqs-focus relative px-4 py-2.5 text-sm font-medium transition ${
        active ? "text-mtqs-gold" : "text-white/40 hover:text-white/40"
      }`}
      aria-pressed={active}
    >
      {chain.label}
      {active && (
        <motion.div
          layoutId="mtqs-contracts-tab-underline"
          className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent"
        />
      )}
    </button>
  );
}

/* ---------- Canonical MTQΣ gold card ---------- */
function CanonicalCard({ chainId }: { chainId: string }) {
  const info = CANONICAL_MTQ_ADDRESSES[chainId];
  if (!info) return null;
  return (
    <Panel className="p-5 sm:p-6 mtqs-glow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
            Source of Truth · {info.chain}
          </div>
          <h3 className="mtqs-display mtqs-gold-text text-2xl font-semibold mt-1">
            MTQΣ Canonical Token
          </h3>
        </div>
        <Pill tone="gold" className="font-mono">cid {String(info.chainId)}</Pill>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[0.72rem]">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2.5">
          <div className="text-white/40">Name</div>
          <div className="font-mono text-mtqs-gold">{info.name}</div>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2.5">
          <div className="text-white/40">Symbol</div>
          <div className="font-mono text-mtqs-gold">{info.symbol}</div>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2.5">
          <div className="text-white/40">Decimals</div>
          <div className="font-mono text-mtqs-gold">{info.decimals}</div>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2.5">
          <div className="text-white/40">Chain ID</div>
          <div className="font-mono text-mtqs-gold">{String(info.chainId)}</div>
        </div>
      </div>
      <div className="mt-3 rounded-md border border-mtqs-gold/25 bg-mtqs-gold/[0.05] p-3">
        <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75 mb-1">
          Contract address
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="font-mono text-sm text-amber-100 break-all">{info.address}</span>
          <div className="flex items-center gap-2 shrink-0">
            <CopyButton value={info.address} label="MTQΣ address" />
            <a
              href={info.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.65rem] text-mtqs-emerald/80 hover:text-mtqs-emerald transition"
            >
              explorer ↗
            </a>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------- Ecosystem contracts table (with search) ---------- */
function EcosystemTable({ chain, query }: { chain: ChainInfo; query: string }) {
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!q) return chain.contracts;
    return chain.contracts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [chain, q]);

  return (
    <div className="overflow-hidden rounded-md border border-white/[0.06]">
      <div className="max-h-96 overflow-y-auto mtqs-scroll">
        <table className="w-full text-[0.72rem]">
          <thead className="bg-white/[0.03]/[0.02] text-white/40 sticky top-0 backdrop-blur">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Contract</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Symbol</th>
              <th className="text-left px-3 py-2 font-medium">Address</th>
              <th className="text-right px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-white/40/60">
                  No contracts match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              rows.map((c, i) => {
                const url = buildExplorerAddressUrl(chain, c.address);
                return (
                  <tr
                    key={c.address}
                    className={`border-t border-white/[0.06] ${i % 2 ? "bg-white/[0.03]/[0.01]" : ""}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="text-white/90">{c.name}</div>
                      {c.note && (
                        <div className="text-[0.62rem] text-white/40/60 mt-0.5">{c.note}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-mtqs-gold/80 hidden sm:table-cell">
                      {c.symbol}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-mtqs-gold">
                      <span title={c.address}>{shortAddr(c.address, 8, 6)}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <CopyButton value={c.address} label={c.name} />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-[0.65rem] text-mtqs-emerald/80 hover:text-mtqs-emerald transition"
                      >
                        explorer ↗
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ContractsSection({ onNavigate: _onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const [activeId, setActiveId] = useState<string>(ALL_CHAINS[0].id);
  const [query, setQuery] = useState("");
  const active = ALL_CHAINS.find((c) => c.id === activeId) ?? ALL_CHAINS[0];

  // Canonical chain id map — All 4 canonical MTQΣ addresses
  const canonicalChainIds: Record<string, string> = {
    monad: "monad",
    arc: "arc",
    "arc-pilot-v2": "arc", // shares Arc canonical
    solana: "solana",
    robinhood: "robinhood",
  };
  const canonicalKey = canonicalChainIds[active.id] ?? "monad";

  return (
    <div className="space-y-10">
      {/* Section heading */}
      <div>
        <div className="flex items-end justify-between gap-4 mb-5">
          <div className="space-y-1.5 min-w-0">
            <span className="mtqs-eyebrow">Deployments · 4 testnets</span>
            <h2 className="text-lg sm:text-xl font-medium tracking-tight text-white">
              Contract Registry &amp; Canonical MTQΣ
            </h2>
          </div>
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            {ALL_CHAINS.length} chains · {ALL_CHAINS.reduce((a, c) => a + c.contracts.length, 0)} contracts
          </Pill>
        </div>
      </div>

      {/* Canonical MTQΣ card (always reflects the active chain's canonical address) */}
      <Reveal>
        <CanonicalCard chainId={canonicalKey} />
      </Reveal>

      {/* Chain tabs */}
      <Reveal delay={0.05}>
        <Panel className="p-1">
          <div className="relative flex border-b border-white/[0.06] overflow-x-auto mtqs-no-scrollbar">
            {ALL_CHAINS.map((c) => (
              <ChainTab
                key={c.id}
                chain={c}
                active={c.id === activeId}
                onClick={() => {
                  setActiveId(c.id);
                  setQuery("");
                }}
              />
            ))}
          </div>

          {/* Chain metadata strip */}
          <div className="p-4 sm:p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[0.72rem]">
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2.5">
                    <div className="text-white/40">Chain ID</div>
                    <div className="font-mono text-mtqs-gold">{String(active.chainId)}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2.5">
                    <div className="text-white/40">Native Currency</div>
                    <div className="font-mono text-mtqs-gold">{active.nativeCurrency}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2.5 sm:col-span-2">
                    <div className="text-white/40">RPC URL</div>
                    <div className="font-mono text-mtqs-gold truncate text-[0.7rem]">{active.rpcUrl}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2.5">
                    <div className="text-white/40">Deployer Wallet</div>
                    <div className="font-mono text-mtqs-gold flex items-center gap-1.5">
                      {shortAddr(active.wallet, 6, 4)}
                      <CopyButton value={active.wallet} label="deployer wallet" />
                    </div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2.5">
                    <div className="text-white/40">Explorer</div>
                    <a
                      href={active.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-mtqs-gold hover:text-amber-100 underline-offset-4 hover:underline"
                    >
                      open ↗
                    </a>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-2.5 sm:col-span-2">
                    <div className="text-white/40">Network</div>
                    <div className="text-mtqs-gold">{active.network}</div>
                  </div>
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40/60"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Filter ${active.contracts.length} ecosystem contracts by name, symbol, or address…`}
                    className="w-full rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] pl-9 pr-3 py-2 text-[0.78rem] text-white placeholder:text-white/40/50 focus:outline-none focus:border-mtqs-gold/40 focus:bg-white/[0.03]/[0.04] transition"
                    aria-label="Filter contracts"
                  />
                </div>

                {/* Ecosystem contracts table */}
                <EcosystemTable chain={active} query={query} />
              </motion.div>
            </AnimatePresence>
          </div>
        </Panel>
      </Reveal>

      {/* Honest note */}
      <Reveal delay={0.1}>
        <Panel className="p-4">
          <div className="flex items-start gap-2 text-[0.7rem] text-white/40">
            <GlowDot color="gold" size="h-1.5 w-1.5" className="mt-1.5" />
            <p className="leading-relaxed">
              The canonical MTQΣ address per chain is the source-of-truth token contract.
              Ecosystem contracts (Governance, Safe, Algorithm, Reserve, Mint, Redeem, Oracle,
              Takaful) are the surrounding protocol layer deployed by the same wallet. Visit the
              Trial section to mint and redeem against these contracts in the simulator.
            </p>
          </div>
          <div className="mt-3">
            <button
              onClick={() => _onNavigate("trial")}
              className="inline-flex items-center gap-1.5 text-[0.75rem] text-mtqs-gold/85 hover:text-mtqs-gold-light transition"
            >
              Open Trial simulator
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
