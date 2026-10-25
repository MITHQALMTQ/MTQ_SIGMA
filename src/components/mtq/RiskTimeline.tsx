// MTQΣ — Risk Timeline Table (§23)
// Historical risk-state transition table with columns:
//   Date · State · RR · LCR · Trigger · Action · Evidence
// Each row is clickable → expands to show what caused the transition
// (the "worse condition binds" rule, the threshold crossed, the policy
// adjustments applied). Color-coded by state (NORMAL=emerald, CAUTION=amber,
// STRESS=amber/orange, DEFENSIVE=rose, EMERGENCY=rose, RECOVERY=cyan).
//
// For the pilot we synthesise the last 10 transitions based on the current
// engine state — production reads from the RebalancingDecision + DailyStateVector
// audit-trail DB tables (Chapter 24). The synthetic history is deterministic
// per (snapshot.status, snapshot.riskStateEnteredAt) so the table stays stable
// across renders but shifts when the engine's risk state actually changes.
//
// All numeric data uses font-mono tabular-nums. No blue/indigo. Brand palette
// only (gold #EFC268, emerald #00C4DB, rose #ff5d73, amber #ffb84d, cyan #3882F6).

"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Panel, Pill, GlowDot } from "./primitives";
import { fmtRatio } from "./format";
import { STATUS_COLORS } from "@/lib/mtq/brand";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

type RiskStateName =
  | "NORMAL"
  | "CAUTION"
  | "STRESS"
  | "DEFENSIVE"
  | "EMERGENCY"
  | "RECOVERY";

interface RiskTransition {
  id: string;
  date: number; // epoch ms
  fromState: RiskStateName;
  toState: RiskStateName;
  rr: number;
  lcr: number;
  trigger: "RR threshold" | "LCR threshold" | "Both RR + LCR" | "Recovery confirmation" | "Manual override";
  action: string;
  evidence: string;
  detail: {
    worseCondition: "rr" | "lcr" | "both" | "neither";
    thresholdCrossed: string;
    confirmationPeriod?: string;
    policyChanges: string[];
  };
}

// State → tailwind text color (matches brand STATUS_COLORS but in tailwind tokens).
const STATE_TONE: Record<RiskStateName, "emerald" | "amber" | "rose" | "gold"> = {
  NORMAL: "emerald",
  CAUTION: "amber",
  STRESS: "amber",
  DEFENSIVE: "rose",
  EMERGENCY: "rose",
  RECOVERY: "emerald",
};

const STATE_HEX: Record<RiskStateName, string> = {
  NORMAL: STATUS_COLORS.NORMAL.color,
  CAUTION: STATUS_COLORS.CAUTION.color,
  STRESS: STATUS_COLORS.STRESS.color,
  DEFENSIVE: STATUS_COLORS.DEFENSIVE.color,
  EMERGENCY: STATUS_COLORS.EMERGENCY.color,
  RECOVERY: STATUS_COLORS.RECOVERY.color,
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a 10-row synthetic history ending in the engine's current state.
// The history is anchored to snapshot.riskStateEnteredAt so it changes when
// the engine actually transitions (not on every tick).
function buildHistory(snapshot: MetricsSnapshot): RiskTransition[] {
  const current = snapshot.status as RiskStateName;
  const enteredAt = snapshot.riskStateEnteredAt || Date.now();
  // Seed by current state + enteredAt hour so the synthetic history stays
  // stable within a single state episode.
  const seed =
    current.charCodeAt(0) * 31 +
    current.length * 17 +
    Math.floor(enteredAt / (60 * 60_000));
  const rand = mulberry32(seed);

  // Walk backward through plausible prior states (worse → better direction
  // reversed: most recent is at top). Build 10 transitions; the last row
  // always lands at the current state.
  const states: RiskStateName[] = [
    "NORMAL",
    "CAUTION",
    "STRESS",
    "DEFENSIVE",
    "EMERGENCY",
    "RECOVERY",
  ];
  const severity: Record<RiskStateName, number> = {
    NORMAL: 0,
    CAUTION: 1,
    STRESS: 2,
    DEFENSIVE: 3,
    EMERGENCY: 4,
    RECOVERY: -1,
  };

  // Build a chain ending at the current state.
  const chain: RiskStateName[] = [current];
  let prev = current;
  for (let i = 0; i < 9; i++) {
    // Pick a random previous state with severity <= current ± 2.
    const candidates = states.filter((s) => {
      if (s === "RECOVERY" && prev !== "DEFENSIVE" && prev !== "EMERGENCY")
        return false;
      const d = Math.abs(severity[s] - severity[prev]);
      return d > 0 && d <= 2;
    });
    if (candidates.length === 0) {
      chain.unshift(prev === "NORMAL" ? "CAUTION" : "NORMAL");
    } else {
      chain.unshift(candidates[Math.floor(rand() * candidates.length)]);
    }
    prev = chain[0];
  }

  // Build transitions from chain.
  const now = Date.now();
  const transitions: RiskTransition[] = [];
  for (let i = 0; i < chain.length; i++) {
    const toState = chain[i];
    const fromState = i === 0 ? chain[i] : chain[i - 1];
    // Spread timestamps across the last 30 days.
    const ts = now - (chain.length - 1 - i) * (rand() * 2 + 1) * 3600_000 * 12;
    // RR/LCR consistent with the toState severity (rough bands).
    const rrBand: Record<RiskStateName, [number, number]> = {
      NORMAL: [1.12, 1.35],
      CAUTION: [1.06, 1.11],
      STRESS: [1.02, 1.06],
      DEFENSIVE: [1.0, 1.03],
      EMERGENCY: [0.92, 1.0],
      RECOVERY: [1.10, 1.20],
    };
    const lcrBand: Record<RiskStateName, [number, number]> = {
      NORMAL: [1.05, 1.5],
      CAUTION: [0.92, 1.0],
      STRESS: [0.82, 0.92],
      DEFENSIVE: [0.72, 0.82],
      EMERGENCY: [0.55, 0.72],
      RECOVERY: [1.0, 1.15],
    };
    const [rrLo, rrHi] = rrBand[toState];
    const [lcrLo, lcrHi] = lcrBand[toState];
    const rr = rrLo + rand() * (rrHi - rrLo);
    const lcr = lcrLo + rand() * (lcrHi - lcrLo);

    const worseCondition: "rr" | "lcr" | "both" | "neither" =
      rr < 1.10 && lcr < 1.0
        ? "both"
        : rr < 1.10
        ? "rr"
        : lcr < 1.0
        ? "lcr"
        : "neither";

    let trigger: RiskTransition["trigger"];
    let thresholdCrossed: string;
    if (toState === "RECOVERY") {
      trigger = "Recovery confirmation";
      thresholdCrossed = "RR ≥ 1.05 (rising) AND LCR ≥ 0.90 sustained for 48h confirmation window (§21.2 S6)";
    } else if (worseCondition === "both") {
      trigger = "Both RR + LCR";
      thresholdCrossed = `RR ${rr.toFixed(3)} < 1.10 AND LCR ${lcr.toFixed(3)} < 1.00 (worse condition binds → ${toState})`;
    } else if (worseCondition === "rr") {
      trigger = "RR threshold";
      thresholdCrossed = `RR ${rr.toFixed(3)} crossed into the ${toState} band`;
    } else if (worseCondition === "lcr") {
      trigger = "LCR threshold";
      thresholdCrossed = `LCR ${lcr.toFixed(3)} crossed into the ${toState} band`;
    } else {
      trigger = "Manual override";
      thresholdCrossed = "Risk Council 4/7 governance vote (§22.3 risk-tier timelock 24h)";
    }

    // Action taken (the policy row for each state from §21.4 — verified against
    // state-machine.ts: mint fee is state-independent 0.10% (§19.7); mint
    // throttle S2 50% · S3/S4/S5 paused · S6 25%; redemption PAUSED in S5;
    // rebalancing PAUSED in S5 (council-only); treasury sweep PAUSED in S5).
    const actionMap: Record<RiskStateName, string> = {
      NORMAL: "Mint 0.10% fee · redeem 0.15% fee · no throttle · rebalance urgency 1 (normal)",
      CAUTION: "Mint 0.10% fee · redeem 0.15% fee · 50% mint throttle · rebalance urgency 2",
      STRESS: "Mint PAUSED · redeem 0.50% fee · rebalance urgency 3 (emergency rebalance)",
      DEFENSIVE: "Mint PAUSED · redeem 1.00% fee · rebalance urgency 4 (forced rebalance)",
      EMERGENCY: "Mint paused · redemption PAUSED · rebalancing PAUSED (council-only) · treasury sweep paused · immediate governance notification",
      RECOVERY: "Mint 25% throttle · redeem 0.30% fee · rebalance urgency 2 · 48h step confirmation",
    };
    const action = actionMap[toState];

    // Evidence summary
    const evidence =
      toState === "RECOVERY"
        ? `Conditions improved back to RR ≥ 1.05 (rising) AND LCR ≥ 0.90 (§21.2 S6). Entered RECOVERY at ${new Date(ts).toISOString().slice(0, 16)}Z; confirmation period ends in 48h.`
        : toState === "EMERGENCY"
        ? `Immediate entry — markets don't wait. RR=${rr.toFixed(3)}, LCR=${lcr.toFixed(3)}. Treasury sweep PAUSED (§21.4 EMERGENCY row); risk Council 4/7 notified; circuit-breaker armed if Reference Value exits [0.50, 2.00].`
        : `Worse-condition-binds rule (§21.2): RR-derived state (${rrBandStatus(rr)}) vs LCR-derived state (${lcrBandStatus(lcr)}) → ${toState} (EMERGENCY only from RR < 1.00; LCR < 0.70 with solvency → residual RECOVERY). Confirmation: immediate (RR/LCR instantaneous).`;

    const policyChanges: string[] = [];
    if (toState !== "NORMAL") policyChanges.push(`mint throttle applied (§21.4 policy row)`);
    if (toState === "EMERGENCY") policyChanges.push("treasury sweep PAUSED (§21.4 EMERGENCY row)");
    if (toState === "EMERGENCY") policyChanges.push("governance notification fired (§21.4 immediate tier)");
    if (toState === "RECOVERY") policyChanges.push("48h confirmation window started (§21.2 S6 hysteresis)");
    if (toState !== "NORMAL" && toState !== "RECOVERY" && toState !== "EMERGENCY") policyChanges.push(`rebalance urgency raised to ${(severity[toState] * 0.25).toFixed(2)} (§21.4)`);

    transitions.push({
      id: `RT-${i}-${toState}-${ts}`,
      date: ts,
      fromState,
      toState,
      rr,
      lcr,
      trigger,
      action,
      evidence,
      detail: {
        worseCondition,
        thresholdCrossed,
        confirmationPeriod: toState === "RECOVERY" ? "48h" : undefined,
        policyChanges,
      },
    });
  }
  // Most recent first.
  return transitions.reverse();
}

function rrBandStatus(rr: number): RiskStateName {
  if (rr >= 1.10) return "NORMAL";
  if (rr >= 1.05) return "CAUTION";
  if (rr >= 1.02) return "STRESS";
  if (rr >= 1.00) return "DEFENSIVE";
  return "EMERGENCY";
}
function lcrBandStatus(lcr: number): RiskStateName {
  // §21.2: LCR < 0.70 is NOT EMERGENCY — S5 entry is the RR hard-floor breach
  // only. An LCR collapse with solvency (RR ≥ 1.05) is the residual RECOVERY
  // posture; below that it binds DEFENSIVE (mirrors lcrDerived in
  // state-machine.ts — never EMERGENCY).
  if (!Number.isFinite(lcr)) return "NORMAL";
  if (lcr >= 1.0) return "NORMAL";
  if (lcr >= 0.9) return "CAUTION";
  if (lcr >= 0.8) return "STRESS";
  return "DEFENSIVE";
}

interface RiskTimelineProps {
  snapshot: MetricsSnapshot | null;
  /** Maximum rows to render. */
  limit?: number;
}

export function RiskTimeline({ snapshot, limit = 10 }: RiskTimelineProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const history = useMemo(() => {
    if (!snapshot) return [];
    return buildHistory(snapshot).slice(0, limit);
  }, [snapshot, limit]);

  const toggle = (id: string) => setExpanded((cur) => (cur === id ? null : id));

  return (
    <Panel className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[0.625rem] uppercase tracking-[0.25em] text-[#5B6E68]">
            §23 · Risk Timeline
          </div>
          <div className="text-sm font-semibold text-[#0E1F1B] mt-1">
            Risk-State Transition History
          </div>
          <p className="mt-1 text-[0.72rem] text-[#5B6E68] leading-relaxed max-w-2xl">
            The 6-state protocol posture (§14.1) over time. Each row is a state transition with its
            trigger, the policy action applied, and the supporting evidence. Click any row to expand
            the cause attribution. Pilot data is synthetic (deterministic per state episode);
            production reads from the Chapter 24 audit-trail DB tables.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            {history.length} transitions
          </Pill>
          <Pill tone={snapshot?.status === "NORMAL" ? "emerald" : "rose"}>
            <GlowDot color={snapshot?.status === "NORMAL" ? "emerald" : "rose"} size="h-1.5 w-1.5" />
            current: {snapshot?.status ?? "—"}
          </Pill>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.66rem] text-[#5B6E68]">
        {(["NORMAL", "CAUTION", "STRESS", "DEFENSIVE", "EMERGENCY", "RECOVERY"] as const).map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: STATE_HEX[s] }}
            />
            <span className="font-mono uppercase tracking-wider">{s}</span>
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-[#E3EAE6]">
        <table className="w-full text-[0.72rem]">
          <caption className="sr-only">
            Risk-state transition history — click any row to expand the cause attribution
          </caption>
          <thead className="bg-[#F7FAF8] text-[#5B6E68]">
            <tr>
              <th className="text-left px-3 py-2 font-medium w-10"></th>
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">State</th>
              <th className="text-right px-3 py-2 font-medium">RR</th>
              <th className="text-right px-3 py-2 font-medium">LCR</th>
              <th className="text-left px-3 py-2 font-medium">Trigger</th>
              <th className="text-left px-3 py-2 font-medium">Action</th>
              <th className="text-left px-3 py-2 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-[0.78rem] text-[#5B6E68]">
                  Snapshot not loaded — risk history unavailable.
                </td>
              </tr>
            ) : (
              history.map((t, i) => {
                const isOpen = expanded === t.id;
                const tone = STATE_TONE[t.toState];
                const hex = STATE_HEX[t.toState];
                return (
                  <FragmentRow
                    key={t.id}
                    t={t}
                    isOpen={isOpen}
                    onToggle={() => toggle(t.id)}
                    tone={tone}
                    hex={hex}
                    isCurrent={i === 0}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-[0.66rem] text-[#5B6E68] italic">
        Synthetic pilot history · deterministic per (current state, enteredAt hour). Production will
        replace this with rows from the RebalancingDecision + DailyStateVector audit-trail DB tables
        (Chapter 24).
      </div>
    </Panel>
  );
}

function FragmentRow({
  t,
  isOpen,
  onToggle,
  tone,
  hex,
  isCurrent,
}: {
  t: RiskTransition;
  isOpen: boolean;
  onToggle: () => void;
  tone: "emerald" | "amber" | "rose" | "gold";
  hex: string;
  isCurrent: boolean;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={isOpen}
        aria-label={`Expand risk transition to ${t.toState} on ${new Date(t.date).toLocaleString()}`}
        className={`border-b border-[#E3EAE6] cursor-pointer hover:bg-[#F0F7F4] focus-visible:bg-[#F0F7F4] focus-visible:outline-none transition-colors ${
          isCurrent ? "bg-mtqs-gold/[0.04]" : ""
        }`}
      >
        <td className="px-3 py-2 text-[#5B6E68]">
          <motion.span
            animate={{ rotate: isOpen ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="inline-block"
            aria-hidden="true"
          >
            ▸
          </motion.span>
        </td>
        <td className="px-3 py-2 font-mono tabular-nums text-[#0E1F1B] whitespace-nowrap">
          {new Date(t.date).toLocaleString("en-US", {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {isCurrent && (
            <span className="ml-1.5 text-[0.6rem] uppercase tracking-wider text-mtqs-gold">
              · now
            </span>
          )}
        </td>
        <td className="px-3 py-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.66rem] font-mono uppercase tracking-wider"
            style={{
              color: hex,
              backgroundColor: `${hex}1f`,
              border: `1px solid ${hex}55`,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: hex }}
            />
            {t.toState}
            {t.fromState !== t.toState && (
              <span className="text-[#5B6E68] font-normal normal-case tracking-normal">
                ← {t.fromState}
              </span>
            )}
          </span>
        </td>
        <td className="px-3 py-2 text-right font-mono tabular-nums text-[#0E1F1B]">
          {fmtRatio(t.rr)}
        </td>
        <td className="px-3 py-2 text-right font-mono tabular-nums text-[#0E1F1B]">
          {Number.isFinite(t.lcr) ? t.lcr.toFixed(3) : "∞"}
        </td>
        <td className="px-3 py-2 text-[#33544C]">{t.trigger}</td>
        <td className="px-3 py-2 text-[#5B6E68] text-[0.66rem] max-w-[20rem] truncate" title={t.action}>
          {t.action}
        </td>
        <td className="px-3 py-2 text-[#5B6E68] text-[0.66rem] max-w-[22rem] truncate" title={t.evidence}>
          {t.evidence}
        </td>
      </tr>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.tr
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="bg-[#F7FAF8]"
          >
            <td colSpan={8} className="px-4 pb-4 pt-1">
              <div className="ml-6 rounded-md border border-[#E3EAE6] bg-white p-3 space-y-3">
                <div>
                  <div className="text-[0.62rem] uppercase tracking-[0.18em] text-mtqs-gold/80 mb-1">
                    Cause Attribution
                  </div>
                  <div className="text-[0.74rem] text-[#0E1F1B] leading-relaxed">
                    {t.evidence}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[0.7rem]">
                  <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-2.5">
                    <div className="text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68] mb-1">
                      Worse Condition Binds (§14.1)
                    </div>
                    <div className="font-mono text-mtqs-gold">
                      {t.detail.worseCondition === "neither"
                        ? "neither (improvement)"
                        : t.detail.worseCondition}
                    </div>
                  </div>
                  <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-2.5">
                    <div className="text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68] mb-1">
                      Threshold Crossed
                    </div>
                    <div className="font-mono text-[#0E1F1B] text-[0.66rem] leading-snug">
                      {t.detail.thresholdCrossed}
                    </div>
                  </div>
                </div>

                {t.detail.confirmationPeriod && (
                  <div className="rounded-md border border-mtqs-emerald/20 bg-mtqs-emerald/5 p-2.5 text-[0.7rem]">
                    <span className="text-mtqs-emerald font-mono uppercase tracking-wider">
                      Confirmation period
                    </span>
                    <span className="text-[#5B6E68]"> · {t.detail.confirmationPeriod} hysteresis window (RECOVERY only)</span>
                  </div>
                )}

                <div>
                  <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[#5B6E68] mb-1">
                    Policy Changes Applied
                  </div>
                  {t.detail.policyChanges.length === 0 ? (
                    <div className="text-[0.72rem] text-[#5B6E68] italic">
                      No policy changes (transition was to the same state, or the prior state was already at this posture).
                    </div>
                  ) : (
                    <ul className="space-y-1 text-[0.72rem] text-[#0E1F1B]">
                      {t.detail.policyChanges.map((p, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-mtqs-gold mt-0.5" aria-hidden="true">•</span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-2.5">
                  <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[#5B6E68] mb-1">
                    Action (§14.1 policy row)
                  </div>
                  <div className="text-[0.72rem] text-[#0E1F1B] leading-relaxed font-mono">
                    {t.action}
                  </div>
                </div>
              </div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}
