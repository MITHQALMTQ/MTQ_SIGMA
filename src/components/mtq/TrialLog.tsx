// MTQΣ — Pilot Trial Log
// Audit table of mint/redeem trials (SQLite via Prisma). Scrollable with custom scrollbar.

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Panel, Reveal, Pill, GlowDot } from "./primitives";
import { fmtUsd, fmtFixed, fmtRatio, fmtTime, fmtNum } from "./format";

export interface PilotTrial {
  id: string;
  type: "MINT" | "REDEEM";
  chain: string;
  inputAmount: number;
  inputSymbol: string;
  outputAmount: number;
  outputSymbol: string;
  gfbIndex: number;
  mtqPrice: number;
  nav: number;
  reserveRatio: number;
  lcr: number;
  status: string;
  basketJson?: string | null;
  ok: boolean;
  reason?: string | null;
  wallet?: string | null;
  createdAt: string;
}

export function TrialLog({
  trials,
  loading,
  onRefresh,
}: {
  trials: PilotTrial[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 400);
  }

  return (
    <Reveal>
      <Panel className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground/90">Pilot Trial Log</div>
            <div className="text-[0.7rem] text-muted-foreground/70">
              {trials.length} trial{trials.length === 1 ? "" : "s"} · most recent first · stored in SQLite
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="mtqs-focus inline-flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-500/[0.06] px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-500/[0.1] transition disabled:opacity-50"
            aria-label="Refresh trial log"
          >
            <motion.span
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={refreshing ? { duration: 0.6, repeat: Infinity, ease: "linear" } : { duration: 0 }}
            >
              ↻
            </motion.span>
            refresh
          </button>
        </div>

        {trials.length === 0 ? (
          <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-6 text-center text-[0.75rem] text-muted-foreground/70">
            <div className="font-medium mb-1">No trials yet</div>
            <div className="text-[0.7rem] text-muted-foreground/60">
              Run a mint or redeem simulation above. Each trial is logged for auditability with full market context.
            </div>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto mtqs-scroll rounded-md border border-white/[0.06]">
            <table className="w-full text-[0.7rem] min-w-[860px]">
              <thead className="sticky top-0 z-10 bg-[#0b0f0e] text-muted-foreground/70 backdrop-blur">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Time</th>
                  <th className="text-left px-3 py-2 font-medium">Type</th>
                  <th className="text-left px-3 py-2 font-medium">Chain</th>
                  <th className="text-left px-3 py-2 font-medium">Input → Output</th>
                  <th className="text-right px-3 py-2 font-medium">GFB</th>
                  <th className="text-right px-3 py-2 font-medium">Price</th>
                  <th className="text-right px-3 py-2 font-medium">NAV</th>
                  <th className="text-right px-3 py-2 font-medium">RR</th>
                  <th className="text-right px-3 py-2 font-medium">LCR</th>
                  <th className="text-left px-3 py-2 font-medium">Status</th>
                  <th className="text-left px-3 py-2 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {trials.map((t, i) => {
                  const isMint = t.type === "MINT";
                  return (
                    <motion.tr
                      key={t.id}
                      initial={{ opacity: 0, y: -2 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.2) }}
                      className={`border-t border-white/[0.04] ${i % 2 ? "bg-white/[0.01]" : ""} ${!t.ok ? "bg-rose-500/[0.04]" : ""}`}
                    >
                      <td className="px-3 py-2 text-muted-foreground/70 font-mono whitespace-nowrap">{fmtTime(t.createdAt)}</td>
                      <td className="px-3 py-2">
                        <span className={`font-mono font-semibold ${isMint ? "text-emerald-300" : "text-amber-300"}`}>
                          {isMint ? "MINT" : "REDEEM"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-amber-200/90">{t.chain}</td>
                      <td className="px-3 py-2 font-mono">
                        <span className="text-muted-foreground/80">{fmtNum(t.inputAmount, 2)} {t.inputSymbol}</span>
                        <span className="mx-1 text-muted-foreground/50">→</span>
                        <span className="text-amber-200">{fmtNum(t.outputAmount, 4)} {t.outputSymbol}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground/80">{fmtFixed(t.gfbIndex, 4)}</td>
                      <td className="px-3 py-2 text-right font-mono text-amber-200/80">${fmtFixed(t.mtqPrice, 4)}</td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground/80">{fmtUsd(t.nav)}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        <span className={t.reserveRatio >= 1.1 ? "text-emerald-300" : t.reserveRatio >= 1.05 ? "text-amber-300" : "text-rose-300"}>
                          {Number.isFinite(t.reserveRatio) ? fmtRatio(t.reserveRatio) : "∞"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground/80">
                        {Number.isFinite(t.lcr) ? fmtRatio(t.lcr) : "∞"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono text-[0.65rem]">{t.status}</span>
                      </td>
                      <td className="px-3 py-2">
                        {t.ok ? (
                          <Pill tone="emerald"><GlowDot color="emerald" size="h-1.5 w-1.5" /> ok</Pill>
                        ) : (
                          <Pill tone="rose">
                            <GlowDot color="rose" size="h-1.5 w-1.5" />
                            <span className="truncate max-w-[160px]">{t.reason ?? "rejected"}</span>
                          </Pill>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Reveal>
  );
}
