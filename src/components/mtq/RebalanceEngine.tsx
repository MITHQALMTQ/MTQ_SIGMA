// MTQΣ — Rebalancing Engine (§7 legacy + §14.1 MARP execution — A/B dual view)
// Two parallel paths render side-by-side (or via tab toggle on small screens):
//   - Legacy §7 single-direction: observed vs target gold weight, deviation,
//     trade USD. The path actually mutating state when USE_MARP_EXECUTION=false.
//   - MARP §10 per-component: 7 rows (USD/EUR/JPY/GBP/CNY/CHF/Gold) each with
//     direction / tradeUsd / level / reason + summary "X applied, Y skipped,
//     $Z total". The v1.0 production target — only mutates state when
//     USE_MARP_EXECUTION=true (feature flag in pilot-state.ts).
// An A/B badge at the top shows which path is currently mutating the reserve.
// §7 coefficients λ1–λ4, slippage, max daily turnover, max pool fraction, 24h
// direction lock, and §10.1 quote-based execution are retained verbatim below.

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Info,
} from "lucide-react";
import { Panel, Reveal, TickNumber, Pill, GlowDot, MiniBar } from "./primitives";
import { fmtUsd, fmtPct, fmtUsdCompact } from "./format";
import {
  LAMBDA_1, LAMBDA_2, LAMBDA_3, LAMBDA_4,
  SLIPPAGE_TOLERANCE, MAX_DAILY_TURNOVER, MAX_POOL_FRACTION, DIRECTION_LOCK_HOURS,
  AGGREGATOR_QUOTE_PROVIDERS,
} from "@/lib/mtq/blueprint";
import type { MetricsSnapshot, RebalanceDecision } from "@/lib/mtq/engine";

function DirectionBadge({ dir }: { dir: 0 | 1 | -1 }) {
  if (dir === 0) return <Pill tone="muted">no trade</Pill>;
  if (dir === 1) return <Pill tone="emerald"><GlowDot color="emerald" size="h-1.5 w-1.5" /> buy gold (+1)</Pill>;
  return <Pill tone="rose"><GlowDot color="rose" size="h-1.5 w-1.5" /> sell gold (−1)</Pill>;
}

/* ---------- Direction badge for MARP per-component decisions ---------- */
function MarpDirectionBadge({ direction, shouldTrade }: { direction: string; shouldTrade: boolean }) {
  if (!shouldTrade || direction === "hold") {
    return (
      <Pill tone="muted">
        <Minus className="h-3 w-3" aria-hidden="true" />
        hold
      </Pill>
    );
  }
  if (direction === "buy") {
    return (
      <Pill tone="emerald">
        <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
        buy
      </Pill>
    );
  }
  return (
    <Pill tone="rose">
      <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
      sell
    </Pill>
  );
}

/* ---------- Level badge (MARP 6-level hierarchy) ---------- */
function MarpLevelBadge({ level, shouldTrade }: { level: number; shouldTrade: boolean }) {
  const tone = shouldTrade ? "gold" : level <= 1 ? "muted" : "amber";
  const labels: Record<number, string> = {
    1: "L1 · no-trade zone",
    2: "L2 · low urgency",
    3: "L3 · sized",
    4: "L4 · cost-benefit fail",
    5: "L5 · turnover cap",
    6: "L6 · execute",
  };
  return <Pill tone={tone as "gold" | "muted" | "amber"}>{labels[level] ?? `L${level}`}</Pill>;
}

type RebalanceTab = "legacy" | "marp";

export function RebalanceEngine({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  // Default the tab to whichever path is currently mutating state (snapshot.rebalancePath).
  // The user can still toggle to inspect the other path's view.
  const [tab, setTab] = useState<RebalanceTab>(snapshot?.rebalancePath ?? "legacy");

  if (!snapshot) {
    return <div className="h-64 animate-pulse rounded-lg bg-white/[0.03]" />;
  }

  const d: RebalanceDecision = snapshot.rebalance;
  const activePath = snapshot.rebalancePath;
  const marp = snapshot.marp;
  const marpExec = snapshot.marpExecution;
  // §14.1 — index/reserve gold split (USD net of haircut). Both pools back the
  // 26% Strategic Prior Gold weight; only reserve gold is MARP-rebalanced.
  const indexGoldNet = snapshot.reserve.indexGoldNet ?? 0;
  const reserveGoldNet = snapshot.reserve.reserveGoldNet ?? 0;

  return (
    <div className="space-y-4">
      {/* ===== A/B badge + tab toggle ===== */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground/80">
                §7 + §14.1 · Rebalance Execution · A/B dual view
              </div>
              <div className="text-sm font-semibold text-foreground/90 mt-1">
                Legacy §7 single-direction vs MARP §10 per-component
              </div>
              <div className="text-[0.7rem] text-muted-foreground/70 mt-1">
                Both paths compute live every tick; only one mutates the reserve (per the feature flag).
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone={activePath === "marp" ? "gold" : "emerald"}>
                <GlowDot color={activePath === "marp" ? "gold" : "emerald"} size="h-1.5 w-1.5" />
                {activePath === "marp" ? "MARP active" : "Legacy §7 active"}
              </Pill>
            </div>
          </div>

          {/* Tab toggle */}
          <div className="inline-flex rounded-md border border-white/[0.08] bg-white/[0.02] p-1 mb-1">
            <button
              type="button"
              onClick={() => setTab("legacy")}
              className={`px-3 py-1.5 text-[0.72rem] font-medium rounded-[5px] transition-colors ${
                tab === "legacy"
                  ? "bg-mtqs-emerald/15 text-mtqs-emerald border border-mtqs-emerald/30"
                  : "text-muted-foreground/70 hover:text-foreground/90 border border-transparent"
              }`}
              aria-pressed={tab === "legacy"}
            >
              Legacy §7 (single-direction)
            </button>
            <button
              type="button"
              onClick={() => setTab("marp")}
              className={`px-3 py-1.5 text-[0.72rem] font-medium rounded-[5px] transition-colors ${
                tab === "marp"
                  ? "bg-mtqs-gold/15 text-[#f5d27a] border border-mtqs-gold/30"
                  : "text-muted-foreground/70 hover:text-foreground/90 border border-transparent"
              }`}
              aria-pressed={tab === "marp"}
            >
              MARP §10 (per-component)
            </button>
          </div>

          {/* Honest note */}
          <div className="mt-3 flex items-start gap-2 rounded-md border border-mtqs-gold/20 bg-mtqs-gold/[0.04] p-3">
            <Info className="h-3.5 w-3.5 mt-0.5 text-[#f5d27a] shrink-0" aria-hidden="true" />
            <p className="text-[0.7rem] text-muted-foreground/80 leading-relaxed">
              MARP is the v1.0 production target. Legacy §7 is retained as a pilot fallback.
              Toggle the feature flag <span className="font-mono text-[#f5d27a]">USE_MARP_EXECUTION</span> in{" "}
              <span className="font-mono text-[#f5d27a]">src/lib/mtq/pilot-state.ts</span> to switch the
              active execution path (default: <span className="font-mono">false</span> → legacy).
              The A/B badge above reflects the currently active path; the tab toggle is view-only.
            </p>
          </div>
        </Panel>
      </Reveal>

      {tab === "legacy" ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          <Reveal>
            <Panel className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-foreground/90">Rebalance Decision (§7.5)</div>
                  <div className="text-[0.7rem] text-muted-foreground/70">{d.reason}</div>
                </div>
                <DirectionBadge dir={d.direction} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">Observed W</div>
                  <TickNumber value={d.observedGoldWeight} format={(n) => `${(n * 100).toFixed(2)}%`} className="text-lg font-semibold text-amber-200" />
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">Target W</div>
                  <TickNumber value={d.targetGoldWeight} format={(n) => `${(n * 100).toFixed(2)}%`} className="text-lg font-semibold text-emerald-200" />
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">Deviation</div>
                  <TickNumber
                    value={d.deviation}
                    format={(n) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(2)}%`}
                    className={`text-lg font-semibold ${Math.abs(d.deviation) >= 0.005 ? (d.deviation > 0 ? "text-rose-300" : "text-emerald-300") : "text-muted-foreground"}`}
                  />
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground/70">Trade USD</div>
                  <TickNumber value={d.shouldRebalance ? d.tradeUsd : 0} format={fmtUsdCompact} className="text-lg font-semibold text-amber-200" />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem]">
                <span className="text-muted-foreground/80">decision:</span>
                {d.shouldRebalance
                  ? <Pill tone="emerald">EXECUTING</Pill>
                  : <Pill tone="muted">no trade</Pill>}
                <span className="text-muted-foreground/80">·</span>
                <span className="text-muted-foreground/80">direction:</span>
                <span className="font-mono text-amber-200">{d.direction === 0 ? "0 (hold)" : d.direction === 1 ? "+1 buy Au" : "−1 sell Au"}</span>
                {activePath !== "legacy" && (
                  <Pill tone="muted">
                    <Info className="h-3 w-3" aria-hidden="true" />
                    not mutating state (MARP active)
                  </Pill>
                )}
              </div>
            </Panel>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Reveal>
              <Panel className="p-5">
                <div className="mb-3 text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground/80">
                  §7.3 Objective Function Coefficients
                </div>
                <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-muted-foreground/70">λ₁ · Deviation</div>
                    <div className="font-mono text-amber-200 text-lg">{LAMBDA_1.toFixed(2)}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-muted-foreground/70">λ₂ · Cost</div>
                    <div className="font-mono text-amber-200 text-lg">{LAMBDA_2.toFixed(2)}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-muted-foreground/70">λ₃ · Urgency</div>
                    <div className="font-mono text-amber-200 text-lg">{LAMBDA_3.toFixed(2)}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-muted-foreground/70">λ₄ · Turnover</div>
                    <div className="font-mono text-amber-200 text-lg">{LAMBDA_4.toFixed(2)}</div>
                  </div>
                </div>
                <p className="mt-3 text-[0.7rem] text-muted-foreground/70 leading-relaxed">
                  Objective J = λ₁·|dev| − λ₂·cost + λ₃·urgency − λ₄·turnover. Trade executes only when benefit &gt; cost.
                </p>
              </Panel>
            </Reveal>

            <Reveal delay={0.05}>
              <Panel className="p-5">
                <div className="mb-3 text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground/80">
                  §7.4 + §7.6 Execution Constraints
                </div>
                <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-muted-foreground/70">Slippage τ</div>
                    <div className="font-mono text-amber-200">{(SLIPPAGE_TOLERANCE * 100).toFixed(2)}%</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-muted-foreground/70">Max daily turnover</div>
                    <div className="font-mono text-amber-200">{(MAX_DAILY_TURNOVER * 100).toFixed(0)}% NAV</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-muted-foreground/70">Max pool fraction</div>
                    <div className="font-mono text-amber-200">{(MAX_POOL_FRACTION * 100).toFixed(0)}% 24h depth</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-muted-foreground/70">Direction lock</div>
                    <div className="font-mono text-amber-200">{DIRECTION_LOCK_HOURS}h</div>
                  </div>
                </div>
                <p className="mt-3 text-[0.7rem] text-muted-foreground/70 leading-relaxed">
                  §10.1 Quote-based execution: fetch route quote from <span className="font-mono text-amber-200">{AGGREGATOR_QUOTE_PROVIDERS.join(" / ")}</span> with two-sided bounds at <span className="font-mono text-amber-200">oracle ± τ</span>; trade executes only if the quoted rate falls within the bound.
                </p>
              </Panel>
            </Reveal>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4"
        >
          {/* ===== MARP execution summary ===== */}
          <Reveal>
            <Panel className="p-5">
              <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-[0.625rem] uppercase tracking-[0.25em] text-muted-foreground/80">
                    §14.1 + §10 · MARP · Per-component execution (v1.0 production target)
                  </div>
                  <div className="text-sm font-semibold text-foreground/90 mt-1">
                    7 components · daily calculation vs actual trade
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {marpExec && (
                    <>
                      <Pill tone={marpExec.appliedCount > 0 ? "gold" : "emerald"}>
                        <GlowDot color={marpExec.appliedCount > 0 ? "gold" : "emerald"} size="h-1.5 w-1.5" />
                        {marpExec.appliedCount > 0
                          ? `${marpExec.appliedCount} would-execute`
                          : "all in no-trade zone"}
                      </Pill>
                      <Pill tone="muted">{marpExec.skippedCount} skipped</Pill>
                      <Pill tone="muted">total: {fmtUsdCompact(marpExec.totalTradeUsd)}</Pill>
                    </>
                  )}
                </div>
              </div>

              {/* §14.1 — index/reserve gold split summary */}
              <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div className="rounded-md border border-mtqs-gold/20 bg-mtqs-gold/[0.04] p-2.5">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em] text-[#f5d27a]/80">Index gold (locked)</div>
                  <TickNumber value={indexGoldNet} format={fmtUsdCompact} className="text-base font-semibold text-[#f5d27a]" />
                  <div className="text-[0.62rem] text-muted-foreground/60 mt-0.5">backs 26% Strategic Prior Gold weight</div>
                </div>
                <div className="rounded-md border border-mtqs-emerald/20 bg-mtqs-emerald/[0.04] p-2.5">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em] text-mtqs-emerald/80">Reserve gold (MARP buffer)</div>
                  <TickNumber value={reserveGoldNet} format={fmtUsdCompact} className="text-base font-semibold text-mtqs-emerald" />
                  <div className="text-[0.62rem] text-muted-foreground/60 mt-0.5">rebalanced by MARP per-component</div>
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground/70">Total gold</div>
                  <TickNumber value={snapshot.reserve.goldNet} format={fmtUsdCompact} className="text-base font-semibold text-amber-200" />
                  <div className="text-[0.62rem] text-muted-foreground/60 mt-0.5">index + reserve (= observed Gold weight)</div>
                </div>
              </div>

              {marp ? (
                <div className="overflow-x-auto max-h-96 mtqs-scroll rounded-md border border-white/[0.06]">
                  <table className="w-full text-[0.72rem]">
                    <thead className="sticky top-0 bg-background/95 backdrop-blur z-10">
                      <tr className="text-muted-foreground/70 border-b border-white/[0.06]">
                        <th className="text-left px-2 py-2 font-medium">Component</th>
                        <th className="text-left px-2 py-2 font-medium">Direction</th>
                        <th className="text-right px-2 py-2 font-medium">Trade USD</th>
                        <th className="text-left px-2 py-2 font-medium w-28">Urgency</th>
                        <th className="text-left px-2 py-2 font-medium">Level</th>
                        <th className="text-left px-2 py-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marp.decisions.map((d) => (
                        <tr key={d.component} className={`border-b border-white/[0.04] ${d.shouldTrade ? "bg-amber-500/[0.03]" : ""}`}>
                          <td className="px-2 py-2 font-mono font-semibold text-amber-200">{d.component}</td>
                          <td className="px-2 py-2"><MarpDirectionBadge direction={d.direction} shouldTrade={d.shouldTrade} /></td>
                          <td className="px-2 py-2 text-right font-mono tabular-nums">
                            {d.shouldTrade ? (
                              <span className="text-amber-200 font-medium">{fmtUsdCompact(d.tradeUsd)}</span>
                            ) : (
                              <span className="text-muted-foreground/60">—</span>
                            )}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <MiniBar
                                value={d.urgency}
                                max={1}
                                colorClass={d.urgency >= 0.5 ? "bg-rose-400" : d.urgency >= 0.2 ? "bg-amber-400" : "bg-emerald-400"}
                                height="h-1.5"
                                className="w-16"
                              />
                              <span className="text-[0.66rem] font-mono text-muted-foreground/80">{(d.urgency * 100).toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-2 py-2"><MarpLevelBadge level={d.level} shouldTrade={d.shouldTrade} /></td>
                          <td className="px-2 py-2 text-muted-foreground/80 text-[0.7rem]">{d.reason}</td>
                        </tr>
                      ))}
                      {marpExec && (
                        <tr className="border-t-2 border-amber-400/30 bg-amber-500/[0.04]">
                          <td className="px-2 py-2 font-mono font-semibold text-amber-200" colSpan={2}>Σ MARP execution summary</td>
                          <td className="px-2 py-2 text-right font-mono font-semibold text-amber-200">{fmtUsdCompact(marpExec.totalTradeUsd)}</td>
                          <td className="px-2 py-2" colSpan={3}>
                            <span className="text-[0.66rem] text-muted-foreground/70">
                              {marpExec.appliedCount} applied · {marpExec.skippedCount} skipped · path = {marpExec.path}
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[0.75rem] text-muted-foreground/70">
                  MARP decisions not computed yet.
                </div>
              )}

              {/* 6-level hierarchy legend */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { level: 1, label: "L1 · No-trade zone", desc: "deviation < 0.5%" },
                  { level: 2, label: "L2 · Low urgency", desc: "urgency < 5%" },
                  { level: 3, label: "L3 · Sized", desc: "50% correction" },
                  { level: 4, label: "L4 · Cost-benefit fail", desc: "cost ≥ benefit" },
                  { level: 5, label: "L5 · Turnover cap", desc: "capped at 5% NAV" },
                  { level: 6, label: "L6 · Execute", desc: "trade fires" },
                ].map((l) => (
                  <div key={l.level} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
                    <div className="text-[0.66rem] font-medium text-amber-200">{l.label}</div>
                    <div className="text-[0.62rem] text-muted-foreground/60 mt-0.5">{l.desc}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[0.66rem] text-muted-foreground/60 leading-relaxed">
                Max daily turnover = 5% of NAV ≈ {fmtUsdCompact(snapshot.nav * 0.05)}. 24h direction lock prevents whipsaw.
                Index gold (PAXG + XAUT locked to back the 26% Strategic Prior Gold weight) is NEVER touched by MARP —
                only the reserve buffer gold is rebalanced.
              </p>
            </Panel>
          </Reveal>
        </motion.div>
      )}
    </div>
  );
}
