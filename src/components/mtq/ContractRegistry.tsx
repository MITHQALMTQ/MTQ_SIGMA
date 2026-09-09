// MTQΣ — Contract Registry (3 testnets: Monad, Arc, Solana)
// Tabs per chain, chain metadata, contract table with copy + explorer links.

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Panel, Reveal, Pill, GlowDot } from "./primitives";
import { fmtUsdCompact, shortAddr, copyToClipboard } from "./format";
import {
  ALL_CHAINS,
  DEPLOYER_WALLET,
  buildExplorerAddressUrl,
  type ChainInfo,
} from "@/lib/mtq/contracts";

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

function ChainTab({ chain, active, onClick }: { chain: ChainInfo; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`mtqs-focus relative px-4 py-2.5 text-sm font-medium transition ${
        active
          ? "text-mtqs-gold"
          : "text-muted-foreground hover:text-muted-foreground"
      }`}
      aria-pressed={active}
    >
      {chain.label}
      {active && (
        <motion.div
          layoutId="chain-tab-underline"
          className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent"
        />
      )}
    </button>
  );
}

function ChainPanel({ chain }: { chain: ChainInfo }) {
  return (
    <div className="space-y-4">
      {/* Chain metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[0.72rem]">
        <div className="rounded-md border border-border bg-black/[0.02] p-2.5">
          <div className="text-muted-foreground">Chain ID</div>
          <div className="font-mono text-mtqs-gold">{String(chain.chainId)}</div>
        </div>
        <div className="rounded-md border border-border bg-black/[0.02] p-2.5">
          <div className="text-muted-foreground">Native Currency</div>
          <div className="font-mono text-mtqs-gold">{chain.nativeCurrency}</div>
        </div>
        <div className="rounded-md border border-border bg-black/[0.02] p-2.5 sm:col-span-2">
          <div className="text-muted-foreground">RPC URL</div>
          <div className="font-mono text-mtqs-gold truncate text-[0.7rem]">{chain.rpcUrl}</div>
        </div>
        <div className="rounded-md border border-border bg-black/[0.02] p-2.5">
          <div className="text-muted-foreground">Deployer Wallet</div>
          <div className="font-mono text-mtqs-gold flex items-center gap-1.5">
            {shortAddr(chain.wallet, 6, 4)}
            <CopyButton value={chain.wallet} label="deployer wallet" />
          </div>
        </div>
        <div className="rounded-md border border-border bg-black/[0.02] p-2.5">
          <div className="text-muted-foreground">Explorer</div>
          <a
            href={chain.explorer}
            target="_blank"
            rel="noopener noreferrer"
            className="text-mtqs-gold hover:text-amber-100 underline-offset-4 hover:underline"
          >
            open ↗
          </a>
        </div>
        <div className="rounded-md border border-border bg-black/[0.02] p-2.5 sm:col-span-2">
          <div className="text-muted-foreground">Network</div>
          <div className="text-mtqs-gold">{chain.network}</div>
        </div>
      </div>

      {/* Chain-specific notes */}
      {chain.id === "arc" && (
        <div className="rounded-md border border-mtqs-amber/20 bg-mtqs-amber/5 p-2.5 text-[0.7rem] text-mtqs-gold/85">
          Note: Arc Testnet uses USDC (18 decimals) as its native gas currency, not ETH-equivalent.
        </div>
      )}
      {chain.id === "solana" && (
        <div className="rounded-md border border-mtqs-amber/20 bg-mtqs-amber/5 p-2.5 text-[0.7rem] text-mtqs-gold/85">
          Note: Solana devnet deployment is a single SPL mint (MTQ). Solana is a non-EVM chain with a different testnet environment.
        </div>
      )}

      {/* Contracts table */}
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-[0.72rem]">
          <thead className="bg-black/[0.02] text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Contract</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Symbol</th>
              <th className="text-left px-3 py-2 font-medium">Address</th>
              <th className="text-right px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {chain.contracts.map((c, i) => {
              const url = buildExplorerAddressUrl(chain, c.address);
              return (
                <tr key={c.address} className={`border-t border-border ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                  <td className="px-3 py-2.5">
                    <div className="text-foreground/90">{c.name}</div>
                    {c.note && <div className="text-[0.62rem] text-muted-foreground/60 mt-0.5">{c.note}</div>}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-mtqs-gold/80 hidden sm:table-cell">{c.symbol}</td>
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ContractRegistry() {
  const [activeId, setActiveId] = useState<string>(ALL_CHAINS[0].id);
  const active = ALL_CHAINS.find((c) => c.id === activeId) ?? ALL_CHAINS[0];

  return (
    <div className="space-y-3">
      <Reveal>
        <Panel className="p-1">
          {/* Tabs */}
          <div className="relative flex border-b border-border">
            {ALL_CHAINS.map((c) => (
              <ChainTab
                key={c.id}
                chain={c}
                active={c.id === activeId}
                onClick={() => setActiveId(c.id)}
              />
            ))}
          </div>
          {/* Active panel */}
          <div className="p-4 sm:p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
              >
                <ChainPanel chain={active} />
              </motion.div>
            </AnimatePresence>
          </div>
        </Panel>
      </Reveal>

      <Reveal delay={0.05}>
        <Panel className="p-3.5">
          <div className="flex items-start gap-2 text-[0.7rem] text-muted-foreground">
            <GlowDot color="gold" size="h-1.5 w-1.5" className="mt-1.5" />
            <p className="leading-relaxed">
              Honest note: the pilot is a faithful reference implementation of the blueprint math that also surfaces the real deployed contract addresses for verification. We do not pretend to read on-chain state from these contracts in the pilot; the live monetary engine runs in-process (§3-§14) so the dashboard is robust to testnet RPC reliability.
            </p>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
