// MTQΣ — Rebalancing Engine (§7 legacy + §10/§11 MARP execution — A/B dual view)
// Two parallel paths render side-by-side (or via tab toggle on small screens):
//   - Legacy §7 single-direction: observed vs target gold weight, deviation,
//     trade USD. ADVISORY-ONLY display — MARP is the ACTIVE execution path
//     since audit P1-4 (USE_MARP_EXECUTION=true → rebalancePath='marp').
//   - MARP §10/§11 per-component: 7 rows (USD/EUR/JPY/GBP/CNY/CHF/Gold) each with
//     direction / tradeUsd / level / reason + summary "X applied, Y skipped,
//     $Z total". The ACTIVE path — mutates the reserve every tick when its
//     gates pass (feature flag USE_MARP_EXECUTION=true in pilot-state.ts).
// An A/B badge at the top shows which path is currently mutating the reserve.
// §7 coefficients λ1–λ4, slippage, max daily turnover, max pool fraction, 24h
// direction lock, and §10.1 quote-based execution are retained verbatim below.
// AUDIT-FIX RG-10: the unified profitability gate is NetBenefit > ε = $10
// (§12.8, MIN_PROFITABILITY_USD) on both paths.
//
// Task 8-b decision-trail surfaces: the §11.7 canonical event name + skip
// reason per decision; the §13.4.3 LCR floor & liquid-repair posture; the
// §11.6/§14.5 crisis-mode execution set; the §12.3.3 per-class slippage
// tolerances; and the §12.7 exact cost model (GAS_FALLBACK $50 DISABLED per
// Appendix F). All records are engine-internal shadow-mode audit records —
// NOT on-chain events.

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
  SLIPPAGE_TOLERANCES, MAX_DAILY_TURNOVER, MAX_POOL_FRACTION, DIRECTION_LOCK_HOURS,
  AGGREGATOR_QUOTE_PROVIDERS,
  ADMISSIBILITY_ENVELOPES,
  MIN_PROFITABILITY_USD,
  LCR_TARGET,
  REBALANCE_FEE_BPS,
  CONCENTRATION_WARN_PCT, CONCENTRATION_LIMIT_PCT, CONCENTRATION_CRISIS_LIMIT_PCT,
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

/* ---------- §11.7 canonical decision record (local derivation) ------------ */
// The canonical event name + machine-readable skip reason per §11.7. Derived
// from the decision's ladder level (the same mapping the engine applies when
// emitting its engine-internal records — marp.ts canonicalSkipReasonForLevel;
// duplicated here as a tiny local map so the client bundle stays lean).
const CANONICAL_SKIP_BY_LEVEL: Record<number, string> = {
  1: "Natural flow coverage",
  2: "No-trade zone",
  3: "Low urgency",
  4: "Zero size",
  5: "Net benefit not positive",
  6: "Liquidity cap",
  7: "Turnover cap",
  8: "—",
};
function canonicalForDecision(level: number, shouldTrade: boolean): { event: string; reason: string } {
  return shouldTrade
    ? { event: "RebalanceExecuted", reason: CANONICAL_SKIP_BY_LEVEL[8] }
    : { event: "RebalanceSkipped", reason: CANONICAL_SKIP_BY_LEVEL[level] ?? "Hold" };
}

/* ---------- Level badge (MARP 8-level gate pipeline + §10.3 taxonomy) ---------- */
function MarpLevelBadge({ level, shouldTrade, hierarchy }: { level: number; shouldTrade: boolean; hierarchy?: string }) {
  const tone = shouldTrade ? "gold" : level <= 2 ? "muted" : "amber";
  // v2.0-FIX: the labels now match the ACTUAL 8-level ladder implemented in
  // marp.ts (the stale 6-level labels/band were superseded — audit 7-b gap 4).
  const labels: Record<number, string> = {
    1: "L1 · flows cover gap",
    2: "L2 · no-trade zone (≤0.75%)",
    3: "L3 · low urgency",
    4: "L4 · zero size",
    5: "L5 · cost-benefit fail",
    6: "L6 · thin liquidity",
    7: "L7 · turnover cap",
    8: "L8 · execute",
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <Pill tone={tone as "gold" | "muted" | "amber"}>
        {/* Level-8 non-trades are direction-lock holds (§11.5.3), not executes. */}
        {level === 8 && !shouldTrade ? "L8 · direction-lock hold" : labels[level] ?? `L${level}`}
      </Pill>
      {hierarchy ? (
        <span className="text-[0.58rem] uppercase tracking-wider text-white/40">{hierarchy}</span>
      ) : null}
    </span>
  );
}

type RebalanceTab = "legacy" | "marp";

export function RebalanceEngine({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  // Default the tab to whichever path is currently mutating state (snapshot.rebalancePath).
  // The user can still toggle to inspect the other path's view.
  // AUDIT-FIX B6 (Task 14): the initial state below only captures the path at
  // mount; if the component mounts before the first snapshot arrives (null), it
  // used to stick to "legacy" forever. Adjust during render (React-endorsed
  // derived-state pattern — no effects, no refs) whenever the live path changes,
  // until the user has picked a tab themselves.
  const livePath = snapshot?.rebalancePath;
  const [{ picked: userPickedTab, tab }, setTabState] = useState<{
    picked: boolean;
    tab: RebalanceTab;
  }>({ picked: false, tab: livePath ?? "legacy" });
  const [lastSyncedPath, setLastSyncedPath] = useState(livePath);
  if (livePath !== lastSyncedPath) {
    setLastSyncedPath(livePath);
    if (!userPickedTab && (livePath === "marp" || livePath === "legacy")) {
      setTabState({ picked: userPickedTab, tab: livePath });
    }
  }
  const setTab = (next: RebalanceTab) => setTabState({ picked: true, tab: next });

  if (!snapshot) {
    return <div className="h-64 animate-pulse rounded-lg bg-white/[0.03]" />;
  }

  const d: RebalanceDecision = snapshot.rebalance;
  const activePath = snapshot.rebalancePath;
  const marp = snapshot.marp;
  const marpExec = snapshot.marpExecution;
  // Task 8-b — §13.4.3 LCR-breach posture + §11.6/§14.5 crisis-posture
  // derivation (client-side, from the snapshot's canonical fields).
  const lcr = snapshot.lcr;
  const lcrBreach = Number.isFinite(lcr) && lcr < LCR_TARGET;
  const crisisActive = snapshot.status === "STRESS" || snapshot.status === "DEFENSIVE" || snapshot.status === "EMERGENCY";
  // AUDIT-FIX P0-3/P1-4 — which target source drives the ACTIVE execution path.
  const targetSource = snapshot.executionTargetSource;
  const goldEnv = ADMISSIBILITY_ENVELOPES.Gold;
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
              <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
                §7 + §10/§11 · Rebalance Execution · A/B dual view
              </div>
              <div className="text-sm font-semibold text-white/90 mt-1">
                Legacy §7 single-direction vs MARP §10/§11 per-component
              </div>
              <div className="text-[0.7rem] text-white/55 mt-1">
                Both paths compute live every tick; only one mutates the simulated pilot ledger (per the feature flag).
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Pill tone={activePath === "marp" ? "gold" : "emerald"}>
                  <GlowDot color={activePath === "marp" ? "gold" : "emerald"} size="h-1.5 w-1.5" />
                  {activePath === "marp" ? "MARP ACTIVE (§10/§11 — audit P1-4)" : "Legacy §7 ACTIVE"}
                </Pill>
                {/* AUDIT-FIX P0-3 — surface the ACTIVE target source */}
                <Pill tone={targetSource === "mase-envelope" ? "gold" : "amber"}>
                  Gold target: {targetSource === "mase-envelope" ? `MASE envelope ${(goldEnv.lower * 100).toFixed(0)}–${(goldEnv.upper * 100).toFixed(0)}%` : "legacy buffer (§8)"}
                </Pill>
              </div>
              <span className="text-right text-[0.6rem] leading-snug text-white/45">
                Legacy profitability gate: NetBenefit &gt; ε = ${MIN_PROFITABILITY_USD} — HISTORICAL candidate (Appendix F.5:
                the $10 minimum vs the legacy 1% margin CONFLICT under OD-2, which is OPEN; normal-mode economic
                execution stays DISABLED until the Committee approves the threshold policy. The controlling
                candidate — the Appendix-F protected gate N(q;s) = G − C − B_time &gt; ε(q) — runs in SHADOW on every decision.)
              </span>
            </div>
          </div>

          {/* Tab toggle */}
          <div className="inline-flex rounded-md border border-white/[0.06] bg-white/[0.02] p-1 mb-1">
            <button
              type="button"
              onClick={() => setTab("legacy")}
              className={`px-3 py-1.5 text-[0.72rem] font-medium rounded-[5px] transition-colors ${
                tab === "legacy"
                  ? "bg-mtqs-emerald/15 text-mtqs-emerald border border-mtqs-emerald/30"
                  : "text-white/55 hover:text-white/90 border border-transparent"
              }`}
              aria-pressed={tab === "legacy"}
            >
              {activePath === "marp" ? "Legacy §7 (advisory only)" : "Legacy §7 (single-direction)"}
            </button>
            <button
              type="button"
              onClick={() => setTab("marp")}
              className={`px-3 py-1.5 text-[0.72rem] font-medium rounded-[5px] transition-colors ${
                tab === "marp"
                  ? "bg-mtqs-gold/15 text-mtqs-gold border border-mtqs-gold/30"
                  : "text-white/55 hover:text-white/90 border border-transparent"
              }`}
              aria-pressed={tab === "marp"}
            >
              {activePath === "marp" ? "MARP §10/§11 (ACTIVE path)" : "MARP §10 (per-component)"}
            </button>
          </div>

          {/* Honest note */}
          <div className="mt-3 flex items-start gap-2 rounded-md border border-mtqs-gold/20 bg-mtqs-gold/5 p-3">
            <Info className="h-3.5 w-3.5 mt-0.5 text-mtqs-gold shrink-0" aria-hidden="true" />
            <p className="text-[0.7rem] text-white/55 leading-relaxed">
              <span className="text-white/80">MARP (§10/§11) is the ACTIVE execution path</span> —{" "}
              <span className="font-mono text-mtqs-gold">USE_MARP_EXECUTION=true</span> (audit P1-4),
              rebalancePath = <span className="font-mono text-mtqs-gold">marp</span>. The legacy §7 view
              is <span className="text-white/80">advisory only</span> — it no longer mutates the reserve.
              The execution target source is{" "}
              <span className="font-mono text-mtqs-gold">{targetSource}</span>
              {targetSource === "mase-envelope"
                ? ` (gold envelope ${(goldEnv.lower * 100).toFixed(0)}–${(goldEnv.upper * 100).toFixed(0)}% from the MASE smoothed output)`
                : " (legacy §8 buffer formula — pre-MASE genesis fallback)"}.
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
                  <div className="text-sm font-semibold text-white/90">Rebalance Decision (§7.5 — legacy{activePath === "marp" ? ", advisory only" : ""})</div>
                  <div className="text-[0.7rem] text-white/55">{d.reason}</div>
                </div>
                <div className="flex items-center gap-2">
                  {activePath === "marp" && (
                    <Pill tone="muted">
                      <Info className="h-3 w-3" aria-hidden="true" />
                      Legacy §7 (advisory only)
                    </Pill>
                  )}
                  <DirectionBadge dir={d.direction} />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-white/55">Observed W</div>
                  <TickNumber value={d.observedGoldWeight} format={(n) => `${(n * 100).toFixed(2)}%`} className="text-lg font-semibold text-mtqs-gold" />
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-white/55">Target W</div>
                  <TickNumber value={d.targetGoldWeight} format={(n) => `${(n * 100).toFixed(2)}%`} className="text-lg font-semibold text-mtqs-emerald" />
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-white/55">Deviation</div>
                  <TickNumber
                    value={d.deviation}
                    format={(n) => `${n > 0 ? "+" : ""}${(n * 100).toFixed(2)}%`}
                    className={`text-lg font-semibold ${Math.abs(d.deviation) >= 0.005 ? (d.deviation > 0 ? "text-mtqs-rose" : "text-mtqs-emerald") : "text-white/55"}`}
                  />
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-[0.65rem] uppercase tracking-[0.2em] text-white/55">Trade USD</div>
                  <TickNumber value={d.shouldRebalance ? d.tradeUsd : 0} format={fmtUsdCompact} className="text-lg font-semibold text-mtqs-gold" />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem]">
                <span className="text-white/55">decision:</span>
                {d.shouldRebalance
                  ? <Pill tone="emerald">WOULD EXECUTE (advisory)</Pill>
                  : <Pill tone="muted">no trade</Pill>}
                <span className="text-white/55">·</span>
                <span className="text-white/55">direction:</span>
                <span className="font-mono text-mtqs-gold">{d.direction === 0 ? "0 (hold)" : d.direction === 1 ? "+1 buy Au" : "−1 sell Au"}</span>
                {activePath !== "legacy" && (
                  <Pill tone="muted">
                    <Info className="h-3 w-3" aria-hidden="true" />
                    advisory only — MARP is the active path (§10/§11)
                  </Pill>
                )}
              </div>
            </Panel>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Reveal>
              <Panel className="p-5">
                <div className="mb-3 text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
                  §10.9 Legacy Objective Coefficients — NON-OPERATIVE (Appendix F)
                </div>
                <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">λ₁ · Deviation</div>
                    <div className="font-mono text-mtqs-gold text-lg">{LAMBDA_1.toFixed(2)}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">λ₂ · Cost</div>
                    <div className="font-mono text-mtqs-gold text-lg">{LAMBDA_2.toFixed(2)}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">λ₃ · Urgency</div>
                    <div className="font-mono text-mtqs-gold text-lg">{LAMBDA_3.toFixed(2)}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">λ₄ · Turnover</div>
                    <div className="font-mono text-mtqs-gold text-lg">{LAMBDA_4.toFixed(2)}</div>
                  </div>
                </div>
                <p className="mt-3 text-[0.7rem] text-white/55 leading-relaxed">
                  LEGACY J(ΔW) = λ₁·|dev| − λ₂·cost + λ₃·urgency − λ₄·turnover — v2.0 §10.9/App. F.18 declare this
                  mixed-unit form HISTORICAL and NON-NORMATIVE; the 0.40/0.30/0.20/0.10 vector is UNAPPROVED and
                  “must not gate trades”. The controlling candidate is the Appendix-F protected gate
                  N(q;s) = G(q;s) − C(q) − B_time(q) &gt; ε(q) (common numeraire; SHADOW until OD-1/OD-2 close).
                  Values shown are the historical illustration only.
                </p>
              </Panel>
            </Reveal>

            <Reveal delay={0.05}>
              <Panel className="p-5">
                <div className="mb-3 text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
                  §7.4 + §7.6 Execution Constraints
                </div>
                <div className="grid grid-cols-2 gap-2 text-[0.75rem]">
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">Slippage τ (§12.3.3 per class)</div>
                    <div className="font-mono text-mtqs-gold text-[0.72rem] leading-snug">
                      stable {(SLIPPAGE_TOLERANCES.STABLECOIN * 100).toFixed(1)}% · gold {(SLIPPAGE_TOLERANCES.GOLD * 100).toFixed(1)}% · minor-FX {(SLIPPAGE_TOLERANCES.MINOR_FX * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">Max daily turnover</div>
                    <div className="font-mono text-mtqs-gold">{(MAX_DAILY_TURNOVER * 100).toFixed(0)}% NAV</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">Max pool fraction</div>
                    <div className="font-mono text-mtqs-gold">{(MAX_POOL_FRACTION * 100).toFixed(0)}% 24h depth</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">Direction lock</div>
                    <div className="font-mono text-mtqs-gold">{DIRECTION_LOCK_HOURS}h</div>
                  </div>
                </div>
                <p className="mt-3 text-[0.7rem] text-white/55 leading-relaxed">
                  §10.1 Quote-based execution: fetch route quote from <span className="font-mono text-mtqs-gold">{AGGREGATOR_QUOTE_PROVIDERS.join(" / ")}</span> with two-sided bounds at <span className="font-mono text-mtqs-gold">oracle ± τ_class</span> per §12.3.1/§12.3.2 (τ per §12.3.3 asset class — stablecoin 0.5%, gold 1.0%, minor FX 1.5%); the trade executes only within the bound, and a quote ≥ τ/2 inside the bound emits the §11.7 SlippageWarning record (engine-internal, shadow mode).
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
                  <div className="text-[0.625rem] uppercase tracking-[0.25em] text-white/55">
                    §14.1 + §10 · MARP · Per-component execution (ACTIVE path — audit P1-4)
                  </div>
                  <div className="text-sm font-semibold text-white/90 mt-1">
                    7 components · daily calculation vs actual trade
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {crisisActive && (
                    <Pill tone="amber">
                      <GlowDot color="amber" size="h-1.5 w-1.5" />
                      §11.6/§14.5 crisis posture active ({snapshot.status})
                    </Pill>
                  )}
                  {marpExec && (
                    <>
                      <Pill tone={marpExec.appliedCount > 0 ? "gold" : "emerald"}>
                        <GlowDot color={marpExec.appliedCount > 0 ? "gold" : "emerald"} size="h-1.5 w-1.5" />
                        {marpExec.appliedCount > 0
                          ? activePath === "marp"
                            ? `${marpExec.appliedCount} executing`
                            : `${marpExec.appliedCount} would-execute`
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
                <div className="rounded-md border border-mtqs-gold/20 bg-mtqs-gold/5 p-2.5">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em] text-mtqs-gold/80">Index gold (locked)</div>
                  <TickNumber value={indexGoldNet} format={fmtUsdCompact} className="text-base font-semibold text-mtqs-gold" />
                  <div className="text-[0.62rem] text-white/60 mt-0.5">backs 26% Strategic Prior Gold weight</div>
                </div>
                <div className="rounded-md border border-mtqs-emerald/20 bg-mtqs-emerald/5 p-2.5">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em] text-mtqs-emerald/80">Reserve gold (MARP buffer)</div>
                  <TickNumber value={reserveGoldNet} format={fmtUsdCompact} className="text-base font-semibold text-mtqs-emerald" />
                  <div className="text-[0.62rem] text-white/60 mt-0.5">rebalanced by MARP per-component</div>
                </div>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                  <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55">Total gold</div>
                  <TickNumber value={snapshot.reserve.goldNet} format={fmtUsdCompact} className="text-base font-semibold text-mtqs-gold" />
                  <div className="text-[0.62rem] text-white/60 mt-0.5">index + reserve (= observed Gold weight)</div>
                </div>
              </div>

              {marp ? (
                <div className="overflow-x-auto max-h-96 mtqs-scroll rounded-md border border-white/[0.06]">
                  <table className="w-full text-[0.72rem]">
                    <thead className="sticky top-0 bg-transparent/95 backdrop-blur z-10">
                      <tr className="text-white/55 border-b border-white/[0.06]">
                        <th className="text-left px-2 py-2 font-medium">Component</th>
                        <th className="text-left px-2 py-2 font-medium">Direction</th>
                        <th className="text-right px-2 py-2 font-medium">Trade USD</th>
                        <th className="text-left px-2 py-2 font-medium w-28">Urgency</th>
                        <th className="text-left px-2 py-2 font-medium">Level</th>
                        <th className="text-left px-2 py-2 font-medium">§11.7 event</th>
                        <th className="text-left px-2 py-2 font-medium">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marp.decisions.map((d) => (
                        <tr key={d.component} className={`border-b border-white/[0.06] ${d.shouldTrade ? "bg-amber-500/[0.03]" : ""}`}>
                          <td className="px-2 py-2 font-mono font-semibold text-mtqs-gold">{d.component}</td>
                          <td className="px-2 py-2"><MarpDirectionBadge direction={d.direction} shouldTrade={d.shouldTrade} /></td>
                          <td className="px-2 py-2 text-right font-mono tabular-nums">
                            {d.shouldTrade ? (
                              <span className="text-mtqs-gold font-medium">{fmtUsdCompact(d.tradeUsd)}</span>
                            ) : (
                              <span className="text-white/60">—</span>
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
                              <span className="text-[0.66rem] font-mono text-white/55">{(d.urgency * 100).toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="px-2 py-2"><MarpLevelBadge level={d.level} shouldTrade={d.shouldTrade} hierarchy={(d as { hierarchy?: string }).hierarchy} /></td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            {(() => {
                              const c = canonicalForDecision(d.level, d.shouldTrade);
                              return (
                                <span className="flex flex-col gap-0.5">
                                  <span className={`font-mono text-[0.62rem] ${d.shouldTrade ? "text-mtqs-emerald" : "text-white/55"}`}>
                                    {c.event}
                                  </span>
                                  {!d.shouldTrade && c.reason !== "—" && (
                                    <span className="text-[0.6rem] text-white/70" title="§11.7 canonical machine-readable skip reason">
                                      “{c.reason}”
                                    </span>
                                  )}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-2 py-2 text-white/55 text-[0.7rem]">{d.reason}</td>
                        </tr>
                      ))}
                      {marpExec && (
                        <tr className="border-t-2 border-mtqs-amber/30 bg-mtqs-amber/5">
                          <td className="px-2 py-2 font-mono font-semibold text-mtqs-gold" colSpan={2}>Σ MARP execution summary</td>
                          <td className="px-2 py-2 text-right font-mono font-semibold text-mtqs-gold">{fmtUsdCompact(marpExec.totalTradeUsd)}</td>
                          <td className="px-2 py-2" colSpan={4}>
                            <span className="text-[0.66rem] text-white/55">
                              {marpExec.appliedCount} applied · {marpExec.skippedCount} skipped · path = {marpExec.path}
                            </span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[0.75rem] text-white/55">
                  MARP decisions not computed yet.
                </div>
              )}

              {/* 8-level gate pipeline legend (matches marp.ts) + §10.3 taxonomy */}
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { level: 1, label: "L1 · Natural flows", desc: "CF nets the gap (§10.7)" },
                  { level: 2, label: "L2 · No-trade zone", desc: "deviation ≤ 0.75% (§10.4/§11.8)" },
                  { level: 3, label: "L3 · Low urgency", desc: "U < U_min 5% (§10.2)" },
                  { level: 4, label: "L4 · Zero size", desc: "β·residual = 0 (§10.6)" },
                  { level: 5, label: "L5 · Cost-benefit fail", desc: "legacy ε gate (OD-2 OPEN)" },
                  { level: 6, label: "L6 · Thin liquidity", desc: "≤ 10% of 24h depth (§11.4)" },
                  { level: 7, label: "L7 · Turnover cap", desc: "≤ 5% NAV/day (§7.3)" },
                  { level: 8, label: "L8 · Execute", desc: "direction lock passed (§11.5.3)" },
                ].map((l) => (
                  <div key={l.level} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2">
                    <div className="text-[0.66rem] font-medium text-mtqs-gold">{l.label}</div>
                    <div className="text-[0.62rem] text-white/60 mt-0.5">{l.desc}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[0.66rem] text-white/60 leading-relaxed">
                §10.3 doctrine overlay: every decision also carries the six-level intervention taxonomy —
                Monitor / Natural flow / Drift / Risk / Structural / Emergency — shown next to each badge.
                Direction lock (§11.5.3): 24h SAME-DIRECTION guard (v2.0 fix — reversals remain eligible; RR &lt; 1.05 override).
              </p>
              <p className="mt-3 text-[0.66rem] text-white/60 leading-relaxed">
                Max daily turnover = 5% of NAV ≈ {fmtUsdCompact(snapshot.nav * 0.05)}. 24h direction lock prevents whipsaw.
                Index gold (PAXG + XAUT locked to back the 26% Strategic Prior Gold weight) is NEVER touched by MARP —
                only the reserve buffer gold is rebalanced.
              </p>

              {/* ===== Task 8-b: §13.4.3 LCR floor + §11.6/§14.5 crisis set ===== */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* §13.4.3 — LCR constitutional floor & liquid repair */}
                <div className={`rounded-md border p-3 ${lcrBreach ? "border-rose-400/40 bg-rose-500/[0.07]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55">§13.4.3 — LCR floor &amp; liquid repair</div>
                    <Pill tone={lcrBreach ? "rose" : "emerald"}>
                      <GlowDot color={lcrBreach ? "rose" : "emerald"} size="h-1.5 w-1.5" />
                      {lcrBreach ? "breach — repair active" : "floor held"}
                    </Pill>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[0.72rem]">
                    <div>
                      <div className="text-white/55">LCR (stablecoin-only §13.4.1)</div>
                      <div className={`font-mono font-semibold ${lcrBreach ? "text-rose-200" : "text-mtqs-emerald"}`}>
                        {Number.isFinite(lcr) ? `${lcr.toFixed(3)}` : "∞ — no liability"}
                      </div>
                    </div>
                    <div>
                      <div className="text-white/55">Constitutional floor</div>
                      <div className="font-mono font-semibold text-mtqs-gold">{LCR_TARGET.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-white/55">Canonical state (§21.2)</div>
                      <div className="font-mono font-semibold text-white/80">{snapshot.status}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-[0.64rem] text-white/55 leading-relaxed">
                    On LCR &lt; {LCR_TARGET.toFixed(2)} the execution layer re-routes: an obligation-driven repair
                    (sell RESERVE gold → stablecoins, sized to the shortfall vs the 25%/30-day stress demand) executes
                    FIRST under the Chapter-12 constraints, and stablecoin-outflow trades are held
                    (“LCR repair priority”). §13.4.3 also mandates DEFENSIVE re-rate + mint-pause — canonical state machine
                    reports mint capacity {(snapshot.mintThrottle * 100).toFixed(0)}% available
                    {snapshot.mintingAllowed ? " (minting allowed)" : " (minting paused)"}; the state-machine LCR re-rate is owned
                    by state-machine.ts. Redemption remains available (§13.4.3).
                  </p>
                </div>

                {/* §11.6 + §14.5 — crisis-mode execution set */}
                <div className={`rounded-md border p-3 ${crisisActive ? "border-mtqs-amber/40 bg-amber-500/[0.06]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[0.65rem] uppercase tracking-[0.18em] text-white/55">§11.6 + §14.5 — crisis-mode execution set</div>
                    <Pill tone={crisisActive ? "amber" : "emerald"}>
                      <GlowDot color={crisisActive ? "amber" : "emerald"} size="h-1.5 w-1.5" />
                      {crisisActive ? "CRISIS POSTURE" : "normal mode"}
                    </Pill>
                  </div>
                  <table className="w-full text-[0.64rem]">
                    <thead>
                      <tr className="text-white/45 border-b border-white/[0.06]">
                        <th className="text-left py-1 font-medium">Parameter</th>
                        <th className="text-left py-1 font-medium">Normal</th>
                        <th className="text-left py-1 font-medium">Crisis</th>
                      </tr>
                    </thead>
                    <tbody className="text-white/70">
                      {[
                        ["No-trade band θ (§10.5/§11.6)", "0.75% base + κ-terms", "×2 widened (1.5%)"],
                        ["Trade size (§11.6)", "β-sized, liquidity-capped", "shrunk ×0.5, staged"],
                        ["Liquidity req. (§11.4)", "10% of 24h depth", "raised — 5% cap, deep-venue only"],
                        ["Direction lock (§11.5.3)", "24h same-dir guard", "RR < 1.05 override"],
                        ["Objective priority (§14.5)", "balanced J terms", "reserve preservation"],
                      ].map(([p, n, c]) => (
                        <tr key={p} className={`border-b border-white/[0.04] ${crisisActive ? "bg-amber-500/[0.03]" : ""}`}>
                          <td className="py-1 pr-2 text-white/55">{p}</td>
                          <td className="py-1 pr-2 font-mono">{n}</td>
                          <td className="py-1 font-mono">{c}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-[0.62rem] text-white/70 leading-relaxed">
                    Pilot mapping: the §5.5 CrisisScore is symbolic — the crisis posture engages on the canonical risk
                    state (STRESS/DEFENSIVE/EMERGENCY), the same mechanical trigger that doubles the band. The ×0.5
                    size-shrink and pool-cap factors are labeled pilot instantiations of the §11.6/§14.5 “may” clauses
                    (no operative number is published); tolerances do NOT widen in crisis (§12.3.3).
                  </p>
                </div>
              </div>

              {/* ===== Task 8-b: §12.3.3 tolerances + §12.7 cost model ===== */}
              <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="mb-2 text-[0.65rem] uppercase tracking-[0.18em] text-white/55">
                    §12.3.3 — per-asset-class slippage tolerances (wired)
                  </div>
                  <table className="w-full text-[0.64rem]">
                    <tbody className="text-white/70">
                      <tr className="border-b border-white/[0.04]">
                        <td className="py-1 text-white/55">Stablecoins (USDC, EURC)</td>
                        <td className="py-1 font-mono text-mtqs-gold">τ_sell = τ_buy = {(SLIPPAGE_TOLERANCES.STABLECOIN * 100).toFixed(1)}%</td>
                      </tr>
                      <tr className="border-b border-white/[0.04]">
                        <td className="py-1 text-white/55">Tokenized gold (PAXG/XAUT)</td>
                        <td className="py-1 font-mono text-mtqs-gold">τ_sell = τ_buy = {(SLIPPAGE_TOLERANCES.GOLD * 100).toFixed(1)}%</td>
                      </tr>
                      <tr className="border-b border-white/[0.04]">
                        <td className="py-1 text-white/55">Minor FX (JPY, CNY)</td>
                        <td className="py-1 font-mono text-mtqs-gold">τ_sell = τ_buy = {(SLIPPAGE_TOLERANCES.MINOR_FX * 100).toFixed(1)}%</td>
                      </tr>
                      <tr>
                        <td className="py-1 text-white/55">GBP / CHF (not enumerated)</td>
                        <td className="py-1 font-mono text-mtqs-gold">conservative minor-FX class, pending classification</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-2 text-[0.62rem] text-white/70 leading-relaxed">
                    Two-sided corridor per §12.3.1/§12.3.2 (sell ≥ oracle×(1−τ), buy ≤ oracle×(1+τ)); Risk Council 4/7
                    with 24h timelock (§11.10). In crisis the tolerances do not widen — sizes shrink and liquidity
                    requirements rise (§12.3.3).
                  </p>
                </div>

                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="mb-2 text-[0.65rem] uppercase tracking-[0.18em] text-white/55">
                    §12.7 — exact cost model (operative on every gate)
                  </div>
                  <div className="space-y-1 text-[0.66rem] text-white/70">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/55">Gas = (oracleGasPrice × 1.2) × (est. gas × 1.1)</span>
                      <span className="font-mono text-mtqs-gold">$17.82/trade*</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/55">Slippage = tradeValue × (τ_class / 2)</span>
                      <span className="font-mono text-mtqs-gold">half-τ, per class</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/55">Router fee = tradeValue × 0.001</span>
                      <span className="font-mono text-mtqs-gold">0.10%</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-white/55">Protocol fee (§20.4, §10.8 Fees_i)</span>
                      <span className="font-mono text-mtqs-gold">{(REBALANCE_FEE_BPS / 100).toFixed(2)}%</span>
                    </div>
                  </div>
                  <p className="mt-2 text-[0.62rem] text-white/70 leading-relaxed">
                    *Recorded accounting-cost estimate (Appendix-F P0-3): no live gas oracle in the shadow pilot;
                    basis 150,000 gas × 30 gwei × $3,000/native = $13.50 buffered ×1.32. GAS_FALLBACK $50 is
                    DISABLED — “a monetary-cost illustration, not a gas price … must never be returned by a function
                    that claims to return wei per gas” (Appendix F). §15.6.1 pre-trade concentration
                    ({(CONCENTRATION_WARN_PCT * 100).toFixed(0)}% warn / {(CONCENTRATION_LIMIT_PCT * 100).toFixed(0)}% hard block /
                    {(CONCENTRATION_CRISIS_LIMIT_PCT * 100).toFixed(0)}% EMERGENCY exception) is enforced BEFORE
                    execution with adaptive issuer routing.
                  </p>
                </div>
              </div>

              {/* ===== Task 8-b: §11.7/§12.9/§15.7 canonical event taxonomy ===== */}
              <div className="mt-3 rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mb-2 text-[0.65rem] uppercase tracking-[0.18em] text-white/55">
                  §11.7 + §12.9 + §15.7 — canonical event set (engine-internal shadow records)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 text-[0.62rem]">
                  {[
                    { name: "RebalanceExecuted", payload: "ts, deviation, amount, estCost", src: "§11.7 execution" },
                    { name: "RebalanceSkipped", payload: "ts, deviation, reason", src: "§11.7 execution/decision" },
                    { name: "DailyTurnoverReset", payload: "ts, previousTurnover", src: "§11.7 rollover" },
                    { name: "GoldSold / GoldBought", payload: "amount, output, execPrice", src: "§11.7 gold fills" },
                    { name: "SlippageWarning", payload: "tradeType, oracle, exec, ts", src: "§11.7/§12.9 quote path" },
                    { name: "TradeExecuted / TradeSkipped", payload: "legs, amounts, execPrice", src: "§12.9 non-gold fills" },
                    { name: "AssetAdded", payload: "currency, token, name", src: "§15.7 registry (genesis replay)" },
                    { name: "AssetStateChanged / Removed / Updated", payload: "currency, field/state", src: "§15.7 registry module" },
                  ].map((e) => (
                    <div key={e.name} className="rounded border border-white/[0.05] bg-white/[0.02] px-2 py-1.5">
                      <div className="font-mono text-mtqs-gold">{e.name}</div>
                      <div className="text-white/45 mt-0.5">{e.payload}</div>
                      <div className="text-white/35 mt-0.5">{e.src}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[0.62rem] text-white/70 leading-relaxed">
                  Every MARP decision — executed or declined — emits a canonical record with a machine-readable skip
                  reason (“No-trade zone” §10.4 · “Direction lock” §11.5.3 · “Net benefit not positive” §10.8 ·
                  turnover/liquidity truncations §11.5.2/§11.4 · §15.6.1 “Concentration cap” · §13.4.3 “LCR repair
                  priority”). Shadow mode: these are engine-internal audit-log records (ring buffer + execution result
                  + decision log), NOT on-chain events; the durable trail is the §24.4 audit rows.
                </p>
              </div>
            </Panel>
          </Reveal>
        </motion.div>
      )}
    </div>
  );
}
