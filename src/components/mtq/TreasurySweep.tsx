// MTQΣ — Treasury Sweep (§13.2)
// Hot-wallet balance, cold-treasury balance, last sweep, total swept,
// $10,000 threshold, 4/7 Multi-Sig authority. Visual fill as hot approaches threshold.

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, Pill, GlowDot, TickNumber, MiniBar } from "./primitives";
import { fmtUsd, fmtUsdCompact, fmtAgo, fmtTime } from "./format";
import { TREASURY_SWEEP_THRESHOLD_USD, TREASURY_SWEEP_AUTHORITY } from "@/lib/mtq/blueprint";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

export function TreasurySweep({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  if (!snapshot) {
    return <div className="h-44 animate-pulse rounded-lg bg-white/[0.03]" />;
  }
  const t = snapshot.treasury;
  const fillPct = Math.min(1, t.hotWalletUsd / TREASURY_SWEEP_THRESHOLD_USD);
  const nearThreshold = t.hotWalletUsd >= TREASURY_SWEEP_THRESHOLD_USD * 0.7;
  const overThreshold = t.hotWalletUsd >= TREASURY_SWEEP_THRESHOLD_USD;

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground/90">Treasury Sweep (§13.2)</div>
          <div className="text-[0.7rem] text-muted-foreground/70">hot-wallet surplus → 4/7 Multi-Sig Cold Treasury</div>
        </div>
        <Pill tone={overThreshold ? "rose" : nearThreshold ? "amber" : "emerald"}>
          <GlowDot color={overThreshold ? "rose" : nearThreshold ? "amber" : "emerald"} size="h-1.5 w-1.5" />
          {overThreshold ? "sweep triggered" : nearThreshold ? "approaching threshold" : "below threshold"}
        </Pill>
      </div>

      {/* Hot wallet fill visual */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">Hot Wallet</span>
          <TickNumber value={t.hotWalletUsd} format={fmtUsd} className={`font-mono text-sm font-semibold ${overThreshold ? "text-rose-300" : nearThreshold ? "text-amber-200" : "text-emerald-200"}`} />
        </div>
        <div className="relative h-4 rounded-md border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <motion.div
            className={`absolute inset-y-0 left-0 ${overThreshold ? "bg-rose-400" : nearThreshold ? "bg-amber-400" : "bg-emerald-400"}`}
            initial={{ width: 0 }}
            animate={{ width: `${fillPct * 100}%` }}
            transition={{ duration: 0.5 }}
          />
          {/* Threshold tick */}
          <div className="absolute inset-y-0 w-px bg-rose-400/60" style={{ left: "100%", transform: "translateX(-1px)" }} />
          <div className="absolute inset-y-0 w-px bg-amber-400/50" style={{ left: "70%" }} />
        </div>
        <div className="mt-1 flex justify-between text-[0.6rem] font-mono text-muted-foreground/60">
          <span>$0</span>
          <span>70% ({fmtUsdCompact(TREASURY_SWEEP_THRESHOLD_USD * 0.7)})</span>
          <span>${(TREASURY_SWEEP_THRESHOLD_USD / 1000).toFixed(0)}K threshold</span>
        </div>
      </div>

      {/* Cold treasury + sweep history */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[0.75rem]">
        <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-2.5">
          <div className="text-muted-foreground/70 text-[0.65rem] uppercase tracking-[0.18em]">Cold Treasury</div>
          <div className="font-mono text-amber-200 text-sm font-semibold">{fmtUsd(t.coldTreasuryUsd)}</div>
        </div>
        <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-2.5">
          <div className="text-muted-foreground/70 text-[0.65rem] uppercase tracking-[0.18em]">Last Sweep</div>
          <div className="font-mono text-amber-200 text-sm">
            {t.lastSweepAt > 0 ? (
              <>
                {fmtUsdCompact(t.lastSweepAmount)} · {fmtAgo(t.lastSweepAt)}
              </>
            ) : (
              <span className="text-muted-foreground/60">no sweep yet</span>
            )}
          </div>
        </div>
        <div className="rounded-md border border-white/[0.05] bg-white/[0.02] p-2.5">
          <div className="text-muted-foreground/70 text-[0.65rem] uppercase tracking-[0.18em]">Total Swept</div>
          <div className="font-mono text-amber-200 text-sm font-semibold">{fmtUsd(t.totalSwept)}</div>
        </div>
      </div>

      <p className="mt-3 text-[0.72rem] text-muted-foreground/70 leading-relaxed">
        Authority: <span className="font-mono text-amber-200">{TREASURY_SWEEP_AUTHORITY}</span>. When the hot-wallet surplus stablecoins exceed <span className="font-mono text-amber-200">{fmtUsd(TREASURY_SWEEP_THRESHOLD_USD)}</span>, the excess is swept to the cold treasury (keeping a $5,000 operating float).
      </p>
    </Panel>
  );
}
