// MTQΣ — Network Selector Dropdown (§40)
// Compact Binance-style network selector for the active testnet network.
// Shows network name, chain ID, and live/dead status dot. On select, calls
// the parent callback AND persists to localStorage so the choice survives
// reloads. Also surfaces the canonical MTQΣ contract address for the
// selected network below the trigger (read from ALL_CHAINS).
//
// Design rules (2026 deep-space glassmorphic):
//   - Strict brand palette only (gold / emerald / rose / amber). NO blue/indigo.
//   - mtqs-glass surface, gold border accents on the open state.
//   - tabular-nums on every numeric field (chain IDs, addresses use mono).
//   - Live networks get an emerald dot; pending deployments get an amber dot;
//     Solana (non-EVM) gets an emerald dot but tagged "devnet".

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DropdownMenu,
 DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Check, ExternalLink, Copy } from "lucide-react";
import { Pill, GlowDot } from "./primitives";
import { shortAddr, copyToClipboard } from "./format";
import { toast } from "sonner";
import {
  ALL_CHAINS,
  CANONICAL_MTQ_ADDRESSES,
  buildExplorerAddressUrl,
  type ChainInfo,
} from "@/lib/mtq/contracts";

const STORAGE_KEY = "mtqs-active-network";

/** Heuristic live/dead classification — base it on whether the canonical
 *  MTQΣ token contract has a non-zero address. Mainnet "pending deploy"
 *  rows get amber ("pending"). Testnets get emerald ("live"). Solana is
 *  special-cased (non-EVM but live on devnet). */
function networkStatus(chain: ChainInfo): "live" | "pending" | "devnet" {
  if (chain.id === "solana") return "devnet";
  const canonical = CANONICAL_MTQ_ADDRESSES[chain.id];
  const hasCanonical = canonical && canonical.address && !/^0x0+$/.test(canonical.address);
  // Pending-deploy placeholder contracts on Base / Arbitrum
  const hasZeroContract =
    chain.contracts.length > 0 && /^0x0+$/.test(chain.contracts[0].address);
  if (hasCanonical) return "live";
  if (hasZeroContract) return "pending";
  return "live";
}

function statusTone(s: "live" | "pending" | "devnet"): {
  dot: "emerald" | "amber" | "gold";
  label: string;
  tone: "emerald" | "amber" | "gold";
} {
  if (s === "live") return { dot: "emerald", label: "live", tone: "emerald" };
  if (s === "pending") return { dot: "amber", label: "pending", tone: "amber" };
  return { dot: "gold", label: "devnet", tone: "gold" };
}

interface NetworkSelectorProps {
  /** Initial network id (slug). Falls back to localStorage, then "monad". */
  initialChainId?: string;
  /** Fired whenever the user selects a new network. */
  onChange?: (chain: ChainInfo) => void;
  /** Compact mode hides the contract-address row beneath the trigger. */
  compact?: boolean;
  className?: string;
}

export function NetworkSelector({
  initialChainId,
  onChange,
  compact = false,
  className = "",
}: NetworkSelectorProps) {
  const [selectedId, setSelectedId] = useState<string>(() => {
    if (initialChainId) return initialChainId;
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && ALL_CHAINS.some((c) => c.id === stored)) return stored;
    }
    return "monad";
  });

  // Keep localStorage in sync + emit onChange. We do this in an effect so the
  // first render's state (which reads from localStorage) doesn't fire a spurious
  // onChange to the parent.
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, selectedId);
    }
  }, [selectedId]);

  const selected = useMemo<ChainInfo>(
    () => ALL_CHAINS.find((c) => c.id === selectedId) ?? ALL_CHAINS[0],
    [selectedId],
  );

  const handleChange = useCallback(
    (chain: ChainInfo) => {
      setSelectedId(chain.id);
      onChange?.(chain);
    },
    [onChange],
  );

  const selectedStatus = networkStatus(selected);
  const selectedTone = statusTone(selectedStatus);
  const canonicalEntry = CANONICAL_MTQ_ADDRESSES[selected.id];
  const canonicalAddr = canonicalEntry?.address ?? selected.contracts[0]?.address ?? "";
  const canonicalExplorer = canonicalEntry?.explorer ?? buildExplorerAddressUrl(selected, canonicalAddr);

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Select network — current ${selected.label}`}
            className="mtqs-focus group inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03]/[0.04] px-2.5 sm:px-3 py-1.5 text-xs hover:border-mtqs-gold/40 hover:bg-white/[0.03]/[0.06] transition"
          >
            <GlowDot
              color={selectedTone.dot}
              size="h-2 w-2"
              className="shrink-0"
            />
            <span className="font-medium text-white/85 whitespace-nowrap">
              {selected.label}
            </span>
            <span className="hidden sm:inline-flex items-center rounded-full border border-white/[0.08] bg-black/40 px-1.5 py-0.5 font-mono tabular-nums text-[0.6rem] text-white/55">
              {String(selected.chainId)}
            </span>
            <ChevronDown className="h-3 w-3 text-white/55 group-data-[state=open]:rotate-180 transition-transform" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[280px] sm:min-w-[320px] border-mtqs-gold/25 bg-[#080a0c]/95 backdrop-blur-xl p-0"
        >
          <DropdownMenuLabel className="flex items-center justify-between gap-2 px-3 py-2 text-[0.65rem] uppercase tracking-[0.2em] text-white/55">
            <span>Select Network</span>
            <span className="font-mono tabular-nums text-mtqs-gold/80">
              {ALL_CHAINS.length} chains
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/[0.06]" />
          <div className="max-h-80 overflow-y-auto mtqs-scroll py-1">
            {ALL_CHAINS.map((chain) => {
              const st = networkStatus(chain);
              const tone = statusTone(st);
              const isSel = chain.id === selectedId;
              return (
                <DropdownMenuItem
                  key={chain.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    handleChange(chain);
                  }}
                  className="group flex items-center gap-3 px-3 py-2 text-xs cursor-pointer focus:bg-mtqs-gold/10 focus:text-white outline-none"
                  aria-selected={isSel}
                >
                  <GlowDot
                    color={tone.dot}
                    size="h-2 w-2"
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white/85 truncate">
                        {chain.label}
                      </span>
                      {isSel && (
                        <Check className="h-3 w-3 text-mtqs-gold shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[0.65rem]">
                      <span className="font-mono tabular-nums text-white/55">
                        Chain {String(chain.chainId)}
                      </span>
                      <span className="text-white/30">·</span>
                      <span className={tone.tone === "emerald" ? "text-mtqs-emerald" : tone.tone === "amber" ? "text-mtqs-amber" : "text-mtqs-gold"}>
                        {tone.label}
                      </span>
                      <span className="text-white/30">·</span>
                      <span className="text-white/55">
                        {chain.isEvm ? "EVM" : "non-EVM"}
                      </span>
                    </div>
                  </div>
                  <Pill tone={tone.tone} className="ml-auto shrink-0 text-[0.6rem]">
                    {chain.nativeCurrency}
                  </Pill>
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Contract address row (hidden in compact mode) */}
      {!compact && canonicalAddr && (
        <div className="flex items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] px-2.5 py-1.5 text-[0.65rem]">
          <span className="uppercase tracking-[0.18em] text-white/55 whitespace-nowrap">
            MTQΣ
          </span>
          <span className="font-mono text-mtqs-gold truncate">
            {shortAddr(canonicalAddr, 6, 6)}
          </span>
          <button
            type="button"
            onClick={async () => {
              const ok = await copyToClipboard(canonicalAddr);
              if (ok) toast.success("Copied MTQΣ address", { description: shortAddr(canonicalAddr) });
              else toast.error("Copy failed");
            }}
            aria-label="Copy MTQΣ address"
            className="mtqs-focus text-mtqs-gold/70 hover:text-mtqs-gold transition"
          >
            <Copy className="h-3 w-3" />
          </button>
          <a
            href={canonicalExplorer}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open MTQΣ on ${selected.label} explorer`}
            className="ml-auto mtqs-focus text-mtqs-gold/70 hover:text-mtqs-gold transition inline-flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">explorer</span>
          </a>
        </div>
      )}
    </div>
  );
}
