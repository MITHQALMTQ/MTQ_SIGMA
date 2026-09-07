// MTQΣ — Oracle Consensus (§9)
// Per-pair visual: 3 feed chips with validity, method, final price, spread bps, confidence.
// PAUSED banner if any pair <2 valid feeds.

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, GlowDot, Pill, TickNumber } from "./primitives";
import { fmtFixed, fmtAgo } from "./format";
import {
  ORACLE_STALENESS_MS,
  ORACLE_CONFIDENCE_MAX_PCT,
  ORACLE_DEVIATION_MAX_PCT,
} from "@/lib/mtq/blueprint";
import type { OracleBoard, OracleFeed, OracleConsensus as OracleConsensusType } from "@/lib/mtq/oracle";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

const FEED_COLORS: Record<string, { dot: string; text: string; border: string; bg: string; label: string }> = {
  CHAINLINK: { dot: "bg-amber-400", text: "text-amber-200", border: "border-amber-400/40", bg: "bg-amber-500/[0.06]", label: "Chainlink" },
  PYTH: { dot: "bg-emerald-400", text: "text-emerald-200", border: "border-emerald-400/40", bg: "bg-emerald-500/[0.06]", label: "Pyth" },
  CHRONICLE: { dot: "bg-rose-400", text: "text-rose-200", border: "border-rose-400/40", bg: "bg-rose-500/[0.06]", label: "Chronicle" },
};

function FeedChip({ feed, now }: { feed: OracleFeed; now: number }) {
  const c = FEED_COLORS[feed.source];
  const valid = feed.valid;
  const confPct = ((feed.confidence * 2) / Math.max(feed.price, 1e-9)) * 100;
  const ageMs = now - feed.timestamp;
  return (
    <div
      className={`group relative flex flex-col gap-1 rounded-md border px-2 py-1.5 ${valid ? `${c.border} ${c.bg}` : "border-rose-500/30 bg-rose-500/[0.04]"}`}
      title={
        valid
          ? `${c.label} · valid · conf ±${(confPct).toFixed(2)}% · age ${(ageMs / 1000).toFixed(1)}s`
          : `${c.label} · DISCARDED · ${feed.discardReason ?? "unknown reason"}`
      }
    >
      <div className="flex items-center gap-1.5">
        <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${valid ? c.dot : "bg-rose-500"}`} />
        <span className={`text-[0.625rem] font-semibold tracking-wider ${valid ? c.text : "text-rose-300"}`}>
          {feed.source}
        </span>
        {!valid && <span className="text-[0.55rem] text-rose-300/80">discarded</span>}
      </div>
      <div className={`font-mono tabular-nums text-[0.75rem] ${valid ? "text-foreground" : "text-rose-300/60 line-through"}`}>
        {feed.price < 0.01 ? feed.price.toFixed(6) : feed.price < 10 ? feed.price.toFixed(5) : feed.price.toFixed(2)}
      </div>
      <div className="text-[0.55rem] text-muted-foreground/70 font-mono">
        ±{confPct.toFixed(2)}% · {(ageMs / 1000).toFixed(0)}s
      </div>
    </div>
  );
}

function PairRow({ pair, index }: { pair: OracleConsensusType; index: number }) {
  const methodTone = pair.paused ? "rose" : pair.method === "median" ? "emerald" : pair.method === "average" ? "amber" : "muted";
  const finalTone = pair.paused ? "rose" : "gold";
  const fmtPrice = (p: number) =>
    p < 0.01 ? p.toFixed(6) : p < 10 ? p.toFixed(5) : p < 100 ? p.toFixed(4) : p.toFixed(2);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.04 }}
      className={`rounded-lg border p-3 sm:p-4 ${
        pair.paused
          ? "border-rose-500/30 bg-rose-500/[0.04]"
          : "border-white/[0.06] bg-white/[0.015]"
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        {/* Pair name */}
        <div className="lg:w-28 shrink-0 flex items-center justify-between lg:justify-start gap-2">
          <span className="font-mono text-base font-semibold text-foreground/90">{pair.pair}</span>
          {pair.paused && <Pill tone="rose">PAUSED</Pill>}
        </div>

        {/* 3 feeds */}
        <div className="flex gap-2 flex-1">
          {pair.feeds.map((f) => (
            <FeedChip key={f.source} feed={f} now={pair.sampledAt} />
          ))}
        </div>

        {/* Right — method, final, spread */}
        <div className="lg:w-64 shrink-0 grid grid-cols-3 gap-2 lg:text-right">
          <div>
            <div className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground/70">Method</div>
            <Pill tone={methodTone as "rose" | "emerald" | "amber" | "muted"} className="mt-0.5">
              {pair.method}
            </Pill>
          </div>
          <div>
            <div className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground/70">Final</div>
            <div className={`mt-0.5 font-mono tabular-nums text-sm font-semibold ${finalTone === "gold" ? "mtqs-gold-text" : "text-rose-300"}`}>
              {pair.paused ? "—" : fmtPrice(pair.finalPrice)}
            </div>
          </div>
          <div>
            <div className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground/70">Spread</div>
            <div className="mt-0.5 font-mono tabular-nums text-sm text-amber-200">
              {pair.spreadBps > 0 ? `${pair.spreadBps} bps` : "—"}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function OracleConsensus({
  snapshot,
  oracle,
}: {
  snapshot: MetricsSnapshot | null;
  oracle: OracleBoard | null;
}) {
  const board = oracle ?? snapshot?.oracle ?? null;
  const paused = snapshot?.oraclePaused ?? board?.anyPaused ?? false;
  const validTotal = board?.pairs.reduce((acc, p) => acc + p.validCount, 0) ?? 0;
  const maxValid = board ? board.pairs.length * 3 : 0;

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <Reveal>
        <Panel className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <GlowDot color={paused ? "rose" : "emerald"} />
              <div>
                <div className="text-sm font-semibold text-foreground/90">
                  Oracle Consensus Board
                </div>
                <div className="text-[0.7rem] text-muted-foreground/70">
                  {board ? `${validTotal}/${maxValid} feeds valid · sampled ${fmtAgo(board.sampledAt)}` : "loading…"}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={paused ? "rose" : "emerald"}>
                {paused ? "PAUSED — §9.3" : "All pairs healthy"}
              </Pill>
              <span className="text-[0.7rem] text-muted-foreground/70 font-mono">
                {board?.pairs.length ?? 0} pairs
              </span>
            </div>
          </div>

          {/* Legend of validation rules */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[0.7rem]">
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <div className="text-muted-foreground/70">§9.2.1 · Staleness</div>
              <div className="font-mono text-amber-200">≤ {ORACLE_STALENESS_MS / 1000}s</div>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <div className="text-muted-foreground/70">§9.2.3 · Confidence</div>
              <div className="font-mono text-amber-200">&lt; {(ORACLE_CONFIDENCE_MAX_PCT * 100).toFixed(1)}%</div>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <div className="text-muted-foreground/70">§9.2.4 · Deviation</div>
              <div className="font-mono text-amber-200">&lt; {(ORACLE_DEVIATION_MAX_PCT * 100).toFixed(1)}% from median</div>
            </div>
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
              <div className="text-muted-foreground/70">§9.3 · Quorum</div>
              <div className="font-mono text-amber-200">≥ 2 valid feeds / pair</div>
            </div>
          </div>
        </Panel>
      </Reveal>

      {/* PAUSED banner */}
      {paused && (
        <Reveal>
          <Panel variant="rose" className="p-4 sm:p-5 mtqs-glow-rose">
            <div className="flex items-start gap-3">
              <GlowDot color="rose" size="h-3 w-3" className="mt-1" />
              <div>
                <div className="text-sm font-semibold text-rose-200 mb-1">
                  ORACLE PAUSED — minting & rebalancing suspended (§9.3)
                </div>
                <div className="text-[0.75rem] text-rose-200/80">
                  At least one pair has &lt;2 valid feeds. The protocol halts mint operations and rebalancing until quorum is restored. Redeeming remains allowed at the live reference price.
                </div>
              </div>
            </div>
          </Panel>
        </Reveal>
      )}

      {/* Per-pair rows */}
      {board ? (
        <div className="space-y-2.5">
          {board.pairs.map((p, i) => (
            <Reveal key={p.pair} delay={i * 0.03}>
              <PairRow pair={p} index={i} />
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-white/[0.03]" />
          ))}
        </div>
      )}

      {/* Honest note */}
      <Reveal>
        <Panel className="p-4 border-amber-400/15">
          <div className="flex items-start gap-2 text-[0.72rem] text-muted-foreground/85">
            <span className="mtqs-eyebrow shrink-0">Honest Note</span>
            <p className="leading-relaxed">
              Pyth & Chronicle are modelled as independent synthetic witnesses around the live ECB/gold reference price for pilot validation of the §9 consensus pipeline. The validation rules (staleness, confidence, deviation, quorum) and median/average selection logic are exercised exactly as specified; only the underlying witness quotes are simulated. In production, these would be replaced by real Chainlink/Pyth/Chronicle on-chain feeds.
            </p>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
