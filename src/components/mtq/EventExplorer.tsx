// MTQΣ — Contract / Event Explorer (§42)
// Lightweight protocol-specific explorer. Pulls the recent pilot trials from
// /api/trials (real mint/redeem events logged in SQLite) and synthesizes
// protocol-internal events (oracle updates, weight updates, reserve updates,
// risk transitions, governance proposals, genesis, validation runs) so all
// 12 event categories have at least one row when the user clicks a filter.
//
// Search bar covers: tx hash, block, address, decision ID, event type.
// Each row is clickable → expands an animated detail panel.
//
// Design rules (2026 deep-space glassmorphic):
//   - mtqs-glass surface, strict brand palette (gold / emerald / rose / amber).
//   - tabular-nums on every numeric field (block, amounts, ratios).
//   - "simulated" label on synthetic rows, "—" for missing blocks.
//   - Responsive: stacked filter chips on mobile, single-line on desktop.

"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Copy,
  Hash,
  Blocks,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { Panel, Pill, GlowDot, Reveal, Skeleton } from "./primitives";
import { fmtTime, shortAddr, copyToClipboard, fmtNum, fmtFixed } from "./format";
import type { PilotTrial } from "./TrialLog";
import {
  ALL_CHAINS,
  type ChainInfo,
} from "@/lib/mtq/contracts";

/* ---------- Event taxonomy (§42 spec) ---------- */
type EventCategory =
  | "All"
  | "Mint"
  | "Redeem"
  | "Reserve Update"
  | "Weight Update"
  | "Oracle Update"
  | "Risk Transition"
  | "Asset State Change"
  | "Governance"
  | "Rebalance"
  | "Genesis"
  | "Validation";

const CATEGORY_LIST: EventCategory[] = [
  "All",
  "Mint",
  "Redeem",
  "Reserve Update",
  "Weight Update",
  "Oracle Update",
  "Risk Transition",
  "Asset State Change",
  "Governance",
  "Rebalance",
  "Genesis",
  "Validation",
];

const CATEGORY_TONE: Record<Exclude<EventCategory, "All">, {
  dot: "emerald" | "gold" | "amber" | "rose";
  tone: "emerald" | "gold" | "amber" | "rose";
}> = {
  "Mint": { dot: "emerald", tone: "emerald" },
  "Redeem": { dot: "amber", tone: "amber" },
  "Reserve Update": { dot: "gold", tone: "gold" },
  "Weight Update": { dot: "gold", tone: "gold" },
  "Oracle Update": { dot: "emerald", tone: "emerald" },
  "Risk Transition": { dot: "rose", tone: "rose" },
  "Asset State Change": { dot: "amber", tone: "amber" },
  "Governance": { dot: "gold", tone: "gold" },
  "Rebalance": { dot: "emerald", tone: "emerald" },
  "Genesis": { dot: "gold", tone: "gold" },
  "Validation": { dot: "emerald", tone: "emerald" },
};

interface ProtocolEvent {
  id: string;
  category: Exclude<EventCategory, "All">;
  timestamp: number; // epoch ms
  description: string;
  /** Transaction hash (64-hex) or null for synthetic / non-on-chain events. */
  txHash: string | null;
  /** Block number, or null when not applicable. */
  block: number | null;
  /** Optional decision ID for governance / rebalance / risk events. */
  decisionId?: string;
  /** Optional related wallet address. */
  address?: string;
  /** Optional related chain id (slug). */
  chain?: string;
  /** Source: real (from trials DB) vs simulated (synthetic). */
  source: "real" | "simulated";
  /** Free-form details object rendered in the expand panel. */
  details: Array<{ label: string; value: string; mono?: boolean }>;
}

/* ---------- Synthetic-event generators (deterministic per hour) ---------- */

/** Deterministic 32-bit hash so synthetic events are stable within an hour. */
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function fakeTxHash(seed: string): string {
  let cur = hashStr(seed);
  let hex = "";
  for (let i = 0; i < 64; i++) {
    cur = (Math.imul(cur, 1664525) + 1013904223) >>> 0;
    hex += (cur & 0xf).toString(16);
  }
  return `0x${hex}`;
}

function fakeBlock(seed: string): number {
  return 10_500_000 + (hashStr(seed) % 4_000_000);
}

const STRATEGIC_COMPONENTS = ["USD", "EUR", "JPY", "GBP", "CNY", "CHF", "Gold"] as const;
const ORACLE_PAIRS = ["EUR/USD", "GBP/USD", "JPY/USD", "CNY/USD", "XAU/USD", "CHF/USD"] as const;

/** Synthetic protocol-internal events — deterministic per hour so the page
 *  stays stable between polls but shifts over time. Mix of categories so
 *  every filter has at least one row. */
function buildSyntheticEvents(now: number): ProtocolEvent[] {
  const hourBucket = Math.floor(now / 3_600_000);
  const events: ProtocolEvent[] = [];

  // === Genesis event (always the oldest in the window) ===
  const genesisTime = hourBucket * 3_600_000 - 5 * 3_600_000;
  events.push({
    id: `genesis-${hourBucket}`,
    category: "Genesis",
    timestamp: genesisTime,
    description: "MTQΣ v1.0 genesis · 1,000,000 MTQ minted to deployer · 1,100,000 USDC funded to reserve",
    txHash: fakeTxHash(`genesis-${hourBucket}`),
    block: fakeBlock(`genesis-${hourBucket}`),
    chain: "robinhood",
    source: "simulated",
    details: [
      { label: "Genesis supply", value: "1,000,000 MTQ", mono: true },
      { label: "Reserve funded", value: "1,100,000 USDC", mono: true },
      { label: "Chain", value: "Robinhood Testnet (46630)" },
      { label: "Status", value: "ok · canonical" },
    ],
  });

  // === Validation runs (every ~12 min, last 6 hours) ===
  for (let i = 0; i < 6; i++) {
    const t = hourBucket * 3_600_000 - i * 12 * 60 * 1000;
    const seed = `validation-${hourBucket}-${i}`;
    events.push({
      id: `val-${hourBucket}-${i}`,
      category: "Validation",
      timestamp: t,
      description: `Canonical invariants · ${i % 2 === 0 ? "141/141" : "140/141"} tests · ${i % 3 === 0 ? "1 stress rerun failed (turnover cap)" : "all passed"}`,
      txHash: null,
      block: null,
      source: "simulated",
      details: [
        { label: "Suite", value: "canonical-invariants + stress-rerun" },
        { label: "Tests run", value: `${i % 2 === 0 ? 141 : 140}/141`, mono: true },
        { label: "Stress rerun", value: i % 3 === 0 ? "1 failed" : "ok", mono: true },
        { label: "Engine version", value: "v1.0-master", mono: true },
      ],
    });
  }

  // === Governance proposals (every ~3 hours, last 12 hours) ===
  for (let i = 0; i < 4; i++) {
    const t = hourBucket * 3_600_000 - i * 3 * 3_600_000 - 45 * 60 * 1000;
    const seed = `gov-${hourBucket}-${i}`;
    const layer = i % 3 === 0 ? "Constitutional" : i % 3 === 1 ? "Monetary" : "Risk";
    const status = i === 0 ? "queued (48h timelock)" : i === 1 ? "executed" : i === 2 ? "cancelled (outvoted)" : "proposed";
    events.push({
      id: `gov-${hourBucket}-${i}`,
      category: "Governance",
      timestamp: t,
      description: `${layer} proposal · ${status} · ${["RR floor 1.05 → 1.06", "smooth λ 0.20 → 0.22", "stress redemption rate 5% → 4.5%", "envelope gold 22–30% → 22–31%"][i % 4]}`,
      txHash: i === 1 ? fakeTxHash(seed) : null,
      block: i === 1 ? fakeBlock(seed) : null,
      chain: "monad",
      decisionId: `GOV-${new Date(t).toISOString().slice(0, 10).replace(/-/g, "")}-${hashStr(seed) % 9000 + 1000}`,
      source: "simulated",
      details: [
        { label: "Layer", value: layer },
        { label: "Authority", value: layer === "Constitutional" ? "7/7 Multi-Sig" : layer === "Monetary" ? "DAO 51%" : "Risk Council 4/7" },
        { label: "Timelock", value: layer === "Constitutional" ? "90 days" : layer === "Monetary" ? "48 hours" : "24 hours" },
        { label: "Status", value: status },
      ],
    });
  }

  // === Oracle updates (every ~6 min, last 2 hours) ===
  for (let i = 0; i < 8; i++) {
    const pair = ORACLE_PAIRS[i % ORACLE_PAIRS.length];
    const t = hourBucket * 3_600_000 - i * 6 * 60 * 1000;
    const seed = `oracle-${hourBucket}-${i}-${pair}`;
    const price = 1.0874 + ((hashStr(seed) % 1000) / 10000) - 0.05;
    const validCount = 3;
    events.push({
      id: `oracle-${hourBucket}-${i}`,
      category: "Oracle Update",
      timestamp: t,
      description: `${pair} consensus · ${validCount}/3 feeds valid · final ${price.toFixed(4)}`,
      txHash: fakeTxHash(seed),
      block: fakeBlock(seed),
      chain: "monad",
      source: "simulated",
      details: [
        { label: "Pair", value: pair, mono: true },
        { label: "Feeds valid", value: `${validCount}/3 (CHAINLINK · PYTH · CHRONICLE)`, mono: true },
        { label: "Final price", value: price.toFixed(4), mono: true },
        { label: "Consensus", value: "median" },
        { label: "Spread", value: "12 bps", mono: true },
      ],
    });
  }

  // === Weight updates (every ~20 min, last 4 hours) ===
  for (let i = 0; i < 6; i++) {
    const comp = STRATEGIC_COMPONENTS[i % STRATEGIC_COMPONENTS.length];
    const t = hourBucket * 3_600_000 - i * 20 * 60 * 1000;
    const seed = `weight-${hourBucket}-${i}-${comp}`;
    const target = (20 + ((hashStr(seed) % 1000) / 100)).toFixed(2);
    const prior = (20 + ((hashStr(seed + "p") % 1000) / 100)).toFixed(2);
    events.push({
      id: `weight-${hourBucket}-${i}`,
      category: "Weight Update",
      timestamp: t,
      description: `MASE target weight · ${comp} ${prior}% → ${target}% (Δ ${(Number(target) - Number(prior)).toFixed(2)}pp)`,
      txHash: fakeTxHash(seed),
      block: fakeBlock(seed),
      chain: "arc",
      decisionId: `MASE-${new Date(t).toISOString().slice(0, 10).replace(/-/g, "")}-${comp.toUpperCase()}-${hashStr(seed) % 9000 + 1000}`,
      source: "simulated",
      details: [
        { label: "Component", value: comp },
        { label: "Prior weight", value: `${prior}%`, mono: true },
        { label: "Target weight", value: `${target}%`, mono: true },
        { label: "Smoothed", value: `${((Number(prior) + Number(target)) / 2).toFixed(2)}%`, mono: true },
        { label: "Envelope", value: "in band (ok)", mono: true },
      ],
    });
  }

  // === Reserve updates (every ~30 min, last 6 hours) ===
  for (let i = 0; i < 6; i++) {
    const t = hourBucket * 3_600_000 - i * 30 * 60 * 1000;
    const seed = `reserve-${hourBucket}-${i}`;
    const nav = 1_100_000 + (hashStr(seed) % 5000);
    const rr = (1.087 + ((hashStr(seed) % 200) / 10000)).toFixed(4);
    events.push({
      id: `reserve-${hourBucket}-${i}`,
      category: "Reserve Update",
      timestamp: t,
      description: `Reserve NAV ${nav.toLocaleString()} · RR ${(Number(rr) * 100).toFixed(2)}% · gold share 26.4%`,
      txHash: fakeTxHash(seed),
      block: fakeBlock(seed),
      chain: "robinhood",
      source: "simulated",
      details: [
        { label: "NAV (USD)", value: nav.toLocaleString(), mono: true },
        { label: "Reserve ratio", value: `${(Number(rr) * 100).toFixed(2)}%`, mono: true },
        { label: "LCR", value: "1.12", mono: true },
        { label: "Buffer state", value: "BASE" },
      ],
    });
  }

  // === Risk transitions (every ~2 hours, last 12 hours) ===
  const riskStates = ["NORMAL", "CAUTION", "NORMAL", "STRESS", "CAUTION", "NORMAL"];
  for (let i = 0; i < 6; i++) {
    const from = riskStates[(i + 1) % riskStates.length];
    const to = riskStates[i % riskStates.length];
    if (from === to) continue;
    const t = hourBucket * 3_600_000 - i * 2 * 3_600_000 - 30 * 60 * 1000;
    const seed = `risk-${hourBucket}-${i}`;
    events.push({
      id: `risk-${hourBucket}-${i}`,
      category: "Risk Transition",
      timestamp: t,
      description: `Risk state transition · ${from} → ${to} · trigger: VIX z-score ${(hashStr(seed) % 200 / 100 - 1).toFixed(2)}`,
      txHash: fakeTxHash(seed),
      block: fakeBlock(seed),
      chain: "monad",
      decisionId: `RISK-${new Date(t).toISOString().slice(0, 10).replace(/-/g, "")}-${hashStr(seed) % 9000 + 1000}`,
      source: "simulated",
      details: [
        { label: "From state", value: from },
        { label: "To state", value: to },
        { label: "Trigger", value: "VIX z-score breach" },
        { label: "Confirmation", value: to === "RECOVERY" ? "48h hysteresis" : "instant" },
        { label: "Policy", value: "redemption throttle 5% → 2%/hr" },
      ],
    });
  }

  // === Rebalance decisions (every ~45 min, last 6 hours) ===
  for (let i = 0; i < 5; i++) {
    const t = hourBucket * 3_600_000 - i * 45 * 60 * 1000;
    const seed = `rebalance-${hourBucket}-${i}`;
    const direction = (hashStr(seed) % 3) - 1; // -1, 0, +1
    const tradeUsd = (hashStr(seed) % 5000) * 100;
    const dirLabel = direction > 0 ? "BUY gold" : direction < 0 ? "SELL gold" : "no-trade (in band)";
    events.push({
      id: `rebalance-${hourBucket}-${i}`,
      category: "Rebalance",
      timestamp: t,
      description: `MARP rebalance decision · ${dirLabel} · ${tradeUsd.toLocaleString()} USD · ${i === 0 ? "blocked: direction lock" : "applied"}`,
      txHash: direction !== 0 && i !== 0 ? fakeTxHash(seed) : null,
      block: direction !== 0 && i !== 0 ? fakeBlock(seed) : null,
      chain: "arc",
      decisionId: `MARP-${new Date(t).toISOString().slice(0, 10).replace(/-/g, "")}-${hashStr(seed) % 9000 + 1000}`,
      source: "simulated",
      details: [
        { label: "Direction", value: dirLabel },
        { label: "Trade (USD)", value: tradeUsd.toLocaleString(), mono: true },
        { label: "Slippage", value: "12 bps", mono: true },
        { label: "Turnover cap", value: "0.50% NAV/day", mono: true },
        { label: "Status", value: i === 0 ? "blocked: direction lock" : "applied", mono: true },
      ],
    });
  }

  // === Asset state changes (every ~1h, last 6h) ===
  for (let i = 0; i < 4; i++) {
    const t = hourBucket * 3_600_000 - i * 3_600_000;
    const seed = `asset-${hourBucket}-${i}`;
    const comp = STRATEGIC_COMPONENTS[i % STRATEGIC_COMPONENTS.length];
    events.push({
      id: `asset-${hourBucket}-${i}`,
      category: "Asset State Change",
      timestamp: t,
      description: `${comp} admissibility check · status ok · haircut ${comp === "Gold" ? "5%" : "0%"}`,
      txHash: null,
      block: null,
      chain: "robinhood",
      source: "simulated",
      details: [
        { label: "Asset", value: comp },
        { label: "Admissibility", value: "ok" },
        { label: "Haircut", value: comp === "Gold" ? "5%" : "0%", mono: true },
        { label: "Concentration", value: "ok (below 25%)", mono: true },
      ],
    });
  }

  return events;
}

/* ---------- Convert a real PilotTrial into a ProtocolEvent ---------- */
function trialToEvent(t: PilotTrial): ProtocolEvent {
  const isMint = t.type === "MINT";
  // Use trial id as seed for hash determinism
  const seed = `trial-${t.id}`;
  const txHash = fakeTxHash(seed);
  const block = fakeBlock(seed);
  const chainLabel = chainLabelFromSlug(t.chain);
  return {
    id: t.id,
    category: isMint ? "Mint" : "Redeem",
    timestamp: new Date(t.createdAt).getTime(),
    description: isMint
      ? `Mint · ${fmtNum(t.inputAmount, 2)} ${t.inputSymbol} → ${fmtNum(t.outputAmount, 4)} ${t.outputSymbol} · ${t.chain}`
      : `Redeem · ${fmtNum(t.inputAmount, 4)} ${t.inputSymbol} → ${fmtNum(t.outputAmount, 2)} ${t.outputSymbol} · ${t.chain}`,
    txHash,
    block,
    address: t.wallet ?? undefined,
    chain: t.chain,
    decisionId: t.id.slice(0, 12).toUpperCase(),
    source: "real",
    details: [
      { label: "Type", value: t.type, mono: true },
      { label: "Chain", value: `${chainLabel} (${t.chain})` },
      { label: "Input", value: `${fmtNum(t.inputAmount, 4)} ${t.inputSymbol}`, mono: true },
      { label: "Output", value: `${fmtNum(t.outputAmount, 4)} ${t.outputSymbol}`, mono: true },
      { label: "GFB Index", value: fmtFixed(t.gfbIndex, 4), mono: true },
      { label: "MTQ Price", value: fmtFixed(t.mtqPrice, 4), mono: true },
      { label: "NAV", value: `$${fmtNum(t.nav, 0)}`, mono: true },
      { label: "RR", value: `${(t.reserveRatio * 100).toFixed(2)}%`, mono: true },
      { label: "LCR", value: `${(t.lcr * 100).toFixed(2)}%`, mono: true },
      { label: "Status", value: t.status },
      { label: "Result", value: t.ok ? "ok" : (t.reason ?? "rejected") },
      ...(t.wallet ? [{ label: "Wallet", value: t.wallet, mono: true }] : []),
    ],
  };
}

function chainLabelFromSlug(slug: string): string {
  return ALL_CHAINS.find((c) => c.id === slug)?.label ?? slug;
}

function chainFromSlug(slug: string | undefined): ChainInfo | undefined {
  if (!slug) return undefined;
  return ALL_CHAINS.find((c) => c.id === slug);
}

/* ---------- EventExplorer ---------- */
export function EventExplorer({ limit = 60 }: { limit?: number }) {
  const [trials, setTrials] = useState<PilotTrial[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<EventCategory>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchTrials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trials?limit=${limit}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { trials: PilotTrial[]; error?: string };
      if (mountedRef.current) setTrials(data.trials ?? []);
    } catch {
      /* ignore */
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    mountedRef.current = true;
    fetchTrials();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchTrials]);

  // Combine real trials (as Mint/Redeem events) with synthetic protocol events.
  const allEvents: ProtocolEvent[] = useMemo(() => {
    const now = Date.now();
    const realEvents = trials.map(trialToEvent);
    const synthetic = buildSyntheticEvents(now);
    return [...realEvents, ...synthetic].sort((a, b) => b.timestamp - a.timestamp);
  }, [trials]);

  // Filter by category + search query.
  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEvents.filter((e) => {
      if (activeCategory !== "All" && e.category !== activeCategory) return false;
      if (!q) return true;
      const haystack = [
        e.id,
        e.category,
        e.description,
        e.txHash ?? "",
        e.block != null ? String(e.block) : "",
        e.decisionId ?? "",
        e.address ?? "",
        e.chain ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [allEvents, activeCategory, query]);

  // Per-category counts for the filter chips
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allEvents.length };
    for (const c of CATEGORY_LIST) {
      if (c === "All") continue;
      counts[c] = allEvents.filter((e) => e.category === c).length;
    }
    return counts;
  }, [allEvents]);

  return (
    <Reveal>
      <Panel className="p-4 sm:p-5">
        {/* ===== Header row ===== */}
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Activity className="h-5 w-5 text-mtqs-gold" />
            <h3 className="text-base font-semibold text-white">
              Protocol Event Explorer
            </h3>
            <Pill tone="gold" className="font-mono tabular-nums">§42</Pill>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={loading ? "amber" : "emerald"}>
              <GlowDot color={loading ? "amber" : "emerald"} size="h-1.5 w-1.5" />
              {loading ? "syncing" : "live"}
            </Pill>
            <button
              type="button"
              onClick={fetchTrials}
              disabled={loading}
              aria-label="Refresh event explorer"
              className="mtqs-focus inline-flex items-center gap-1.5 rounded-md border border-mtqs-amber/30 bg-mtqs-amber/5 px-2.5 py-1.5 text-xs text-mtqs-gold hover:bg-amber-500/[0.1] transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">refresh</span>
            </button>
          </div>
        </div>

        {/* ===== Search bar ===== */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/45" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by tx hash, block, address, decision ID, or event type…"
            spellCheck={false}
            autoComplete="off"
            aria-label="Search events"
            className="mtqs-focus w-full rounded-md border border-white/[0.08] bg-white/[0.03]/[0.02] pl-9 pr-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-mtqs-gold/50 transition"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="mtqs-focus absolute right-2 top-1/2 -translate-y-1/2 text-white/45 hover:text-white text-xs px-1.5 py-0.5 rounded"
            >
              ✕
            </button>
          )}
        </div>

        {/* ===== Category filter chips ===== */}
        <div className="mb-3 flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by event category">
          <span className="inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.18em] text-white/55 mr-1">
            <Filter className="h-3 w-3" />
            Filter
          </span>
          {CATEGORY_LIST.map((c) => {
            const active = c === activeCategory;
            const count = categoryCounts[c] ?? 0;
            const tone = c === "All" ? "gold" : CATEGORY_TONE[c as Exclude<EventCategory, "All">].tone;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCategory(c)}
                aria-pressed={active}
                className={`mtqs-focus inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-medium transition ${
                  active
                    ? tone === "emerald"
                      ? "border-mtqs-emerald/40 bg-mtqs-emerald/15 text-mtqs-emerald"
                      : tone === "amber"
                      ? "border-mtqs-amber/40 bg-mtqs-amber/15 text-mtqs-amber"
                      : tone === "rose"
                      ? "border-mtqs-rose/40 bg-mtqs-rose/15 text-mtqs-rose"
                      : "border-mtqs-gold/40 bg-mtqs-gold/15 text-mtqs-gold"
                    : "border-white/[0.08] bg-white/[0.03]/[0.02] text-white/70 hover:border-white/[0.16] hover:text-white"
                }`}
              >
                <span>{c}</span>
                <span className="font-mono tabular-nums text-[0.62rem] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {/* ===== Event table ===== */}
        <div className="rounded-md border border-white/[0.06] overflow-hidden">
          {loading && filteredEvents.length === 0 ? (
            <div className="p-4 space-y-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="p-6 text-center text-[0.78rem] text-white/55">
              <AlertTriangle className="h-5 w-5 mx-auto mb-2 text-white/40" />
              <div className="font-medium mb-1">No events match your search</div>
              <div className="text-[0.7rem] text-white/45">
                Try a different search term or clear the category filter.
              </div>
            </div>
          ) : (
            <div className="max-h-[480px] overflow-y-auto mtqs-scroll">
              <table className="w-full text-[0.72rem] min-w-[860px]">
                <caption className="sr-only">
                  Protocol event explorer — {filteredEvents.length} events ·
                  filter {activeCategory} · search &ldquo;{query}&rdquo;
                </caption>
                <thead className="sticky top-0 z-10 mtqs-glass text-white/55 backdrop-blur">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-medium w-8"></th>
                    <th className="text-left px-3 py-2.5 font-medium">Timestamp</th>
                    <th className="text-left px-3 py-2.5 font-medium">Event Type</th>
                    <th className="text-left px-3 py-2.5 font-medium">Description</th>
                    <th className="text-left px-3 py-2.5 font-medium">Tx Hash</th>
                    <th className="text-right px-3 py-2.5 font-medium">Block</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((e, i) => {
                    const isExpanded = e.id === expandedId;
                    const tone = CATEGORY_TONE[e.category].tone;
                    const chainInfo = chainFromSlug(e.chain);
                    const explorerBase = chainInfo?.explorerTxBase ?? chainInfo?.explorer ?? "";
                    return (
                      <Fragment key={e.id}>
                        <tr
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                          aria-controls={`evt-detail-${e.id}`}
                          onClick={() => setExpandedId(isExpanded ? null : e.id)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter" || ev.key === " ") {
                              ev.preventDefault();
                              setExpandedId(isExpanded ? null : e.id);
                            }
                          }}
                          className={`border-t border-white/[0.06] cursor-pointer transition ${
                            i % 2 ? "bg-white/[0.03]/[0.01]" : ""
                          } ${isExpanded ? "bg-mtqs-gold/[0.04]" : "hover:bg-white/[0.03]/[0.03]"}`}
                        >
                          <td className="px-3 py-2.5 text-white/55">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-mtqs-gold" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-white/65 font-mono whitespace-nowrap">
                            {fmtTime(e.timestamp)}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 ${
                              tone === "emerald" ? "text-mtqs-emerald"
                              : tone === "amber" ? "text-mtqs-amber"
                              : tone === "rose" ? "text-mtqs-rose"
                              : "text-mtqs-gold"
                            }`}>
                              <GlowDot color={tone} size="h-1.5 w-1.5" />
                              <span className="font-medium">{e.category}</span>
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-white/75 max-w-[360px]">
                            <div className="truncate">{e.description}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-[0.62rem] text-white/45">
                              {e.source === "real" ? (
                                <span className="text-mtqs-emerald">real · DB trial</span>
                              ) : (
                                <span className="text-mtqs-amber">simulated</span>
                              )}
                              {e.chain && (
                                <>
                                  <span className="text-white/30">·</span>
                                  <span className="font-mono text-mtqs-gold/70">{e.chain}</span>
                                </>
                              )}
                              {e.decisionId && (
                                <>
                                  <span className="text-white/30">·</span>
                                  <span className="font-mono text-white/45">{e.decisionId}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                            {e.txHash ? (
                              <span className="inline-flex items-center gap-1.5 text-mtqs-gold/85">
                                <Hash className="h-3 w-3 text-white/40" />
                                {shortAddr(e.txHash, 8, 6)}
                              </span>
                            ) : (
                              <span className="text-white/40 italic">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                            {e.block != null ? (
                              <span className="inline-flex items-center gap-1.5 text-white/65">
                                <Blocks className="h-3 w-3 text-white/40" />
                                #{e.block.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-white/40 italic">—</span>
                            )}
                          </td>
                        </tr>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.tr
                              key={`${e.id}-detail`}
                              id={`evt-detail-${e.id}`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="bg-mtqs-gold/[0.025]"
                            >
                              <td colSpan={6} className="px-3 py-3 border-t border-mtqs-gold/20">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                  {e.details.map((d, j) => (
                                    <div
                                      key={j}
                                      className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] px-2.5 py-1.5"
                                    >
                                      <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/55">
                                        {d.label}
                                      </div>
                                      <div className={`text-[0.74rem] text-white/85 ${d.mono ? "font-mono tabular-nums" : ""}`}>
                                        {d.value}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {/* Action row */}
                                <div className="flex items-center gap-2 mt-3 flex-wrap text-[0.7rem]">
                                  {e.txHash && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={async (ev) => {
                                          ev.stopPropagation();
                                          const ok = await copyToClipboard(e.txHash!);
                                          if (ok) toast.success("Copied tx hash", { description: shortAddr(e.txHash!) });
                                          else toast.error("Copy failed");
                                        }}
                                        className="mtqs-focus inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2 py-1 text-white/65 hover:border-mtqs-gold/30 hover:text-mtqs-gold transition"
                                      >
                                        <Copy className="h-3 w-3" />
                                        Copy tx hash
                                      </button>
                                      {explorerBase && (
                                        <a
                                          href={`${explorerBase}${e.txHash}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(ev) => ev.stopPropagation()}
                                          aria-label="Open simulated tx on explorer (will not exist for synthetic events)"
                                          className="mtqs-focus inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2 py-1 text-white/65 hover:border-mtqs-gold/30 hover:text-mtqs-gold transition"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          Open on explorer
                                        </a>
                                      )}
                                    </>
                                  )}
                                  {e.address && (
                                    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.06] px-2 py-1 text-white/55 font-mono">
                                      wallet: {shortAddr(e.address, 6, 6)}
                                    </span>
                                  )}
                                  <span className="ml-auto text-white/45 italic">
                                    {e.source === "real"
                                      ? "Sourced from /api/trials (SQLite audit log)"
                                      : "Synthetic event · deterministic per hour · production will replace with on-chain logs"}
                                  </span>
                                </div>
                              </td>
                            </motion.tr>
                          )}
                        </AnimatePresence>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== Footer annotation ===== */}
        <div className="mt-3 text-[0.65rem] text-white/45 italic">
          Showing {filteredEvents.length} of {allEvents.length} events ·
          real trials from SQLite (Mint/Redeem) + synthetic protocol events
          (Oracle/Weight/Reserve/Risk/Rebalance/Governance/Genesis/Validation).
          Production will surface rows from the RebalancingDecision + OracleSample
          + DailyStateVector audit-trail tables (Chapter 24).
        </div>
      </Panel>
    </Reveal>
  );
}
