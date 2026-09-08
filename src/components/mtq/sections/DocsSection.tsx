// MTQΣ — Docs Section (Master Monetary Architecture v1.0)
// Reference documentation for the v1.0 Master Blueprint:
//   1. Strategic Prior (STRATEGIC_PRIOR_TABLE — 7 components incl. Gold + CHF)
//   2. Admissibility Envelopes (ENVELOPES_TABLE — per-component hard bounds)
//   3. Four-State Weights (WEIGHT_STATE_DESCRIPTIONS — Prior/Target/Smooth/Execution)
//   4. MASE Ensemble (MASE_MODELS — 6 candidate models)
//   5. Constitutional Invariants (CONSTITUTIONAL_INVARIANTS — I1–I11)
//   6. Risk State Machine (RISK_STATE_MACHINE — 5 states)
//   7. Governance Hierarchy (GOVERNANCE_HIERARCHY — 4 tiers)
//   8. Honest Status (HONEST_STATUS)
//   9. Unsupported Claims (UNSUPPORTED_CLAIMS — incl. new v1.0 entries)
//  10. Reconciliation: v1.2 → v1.0 (RECONCILIATION_CHANGES)
//  11. Reconciliation Findings (snapshot.reconciliation — live honest audit)
//
// Props: { onNavigate, snapshot }.

"use client";

import { motion } from "framer-motion";
import { BookOpen, ArrowRight, ScrollText } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading } from "@/components/mtq/primitives";
import { GfbBasket } from "@/components/mtq/GfbBasket";
import { RiskStateMachine } from "@/components/mtq/RiskStateMachine";
import { HonestStatus } from "@/components/mtq/HonestStatus";
import { OnChainMatrix } from "@/components/mtq/OnChainMatrix";
import { BlueprintQA } from "@/components/mtq/BlueprintQA";
import { AuditFindings } from "@/components/mtq/AuditFindings";
import {
  STRATEGIC_PRIOR_TABLE,
  ENVELOPES_TABLE,
  WEIGHT_STATE_DESCRIPTIONS,
  MASE_MODELS,
  CONSTITUTIONAL_INVARIANTS,
  RECONCILIATION_CHANGES,
  RISK_STATE_MACHINE,
  GOVERNANCE_HIERARCHY,
  HONEST_STATUS,
  UNSUPPORTED_CLAIMS,
} from "@/lib/mtq/blueprint";
import { GOVERNANCE_TIERS, STATUS_COLORS } from "@/lib/mtq/brand";
import type { MetricsSnapshot, ReconciliationFinding } from "@/lib/mtq/engine";
import type { SectionId } from "@/components/mtq/Navigation";

/* ---------- Reference table shell ---------- */
function RefTable({
  title,
  subtitle,
  headers,
  rows,
}: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-foreground/90">{title}</div>
          {subtitle && (
            <div className="text-[0.7rem] text-muted-foreground/70">{subtitle}</div>
          )}
        </div>
        <GlowDot color="gold" size="h-1.5 w-1.5" className="mt-1.5" />
      </div>
      <div className="overflow-hidden rounded-md border border-white/[0.07]">
        <div className="max-h-96 overflow-y-auto mtqs-scroll">
          <table className="w-full text-[0.74rem]">
            <thead className="bg-white/[0.02] text-muted-foreground/70 sticky top-0">
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className={`text-left px-3 py-2 font-medium ${i === headers.length - 1 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={`border-t border-white/[0.05] ${ri % 2 ? "bg-white/[0.01]" : ""}`}
                >
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-3 py-2.5 ${ci === row.length - 1 ? "text-right" : ""}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Panel>
  );
}

/* ---------- Severity badge ---------- */
function FindingSeverityBadge({ severity }: { severity: ReconciliationFinding["severity"] }) {
  if (severity === "fixed") {
    return (
      <Pill tone="emerald">
        <GlowDot color="emerald" size="h-1.5 w-1.5" />
        fixed
      </Pill>
    );
  }
  if (severity === "outstanding") {
    return (
      <Pill tone="amber">
        <GlowDot color="amber" size="h-1.5 w-1.5" />
        outstanding
      </Pill>
    );
  }
  return (
    <Pill tone="muted">
      <GlowDot color="gold" size="h-1.5 w-1.5" />
      informational
    </Pill>
  );
}

export function DocsSection({
  onNavigate: _onNavigate,
  snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  const findings = snapshot?.reconciliation ?? [];

  return (
    <div className="space-y-12">
      <SectionHeading
        eyebrow="§2 · §3 · §7 · §8 · §14 · §25 · reference"
        title="Documentation — Master Blueprint v1.0"
        right={
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            v1.0 · Master
          </Pill>
        }
      />

      {/* On-Chain vs Off-Chain Implementation Matrix — FIRST thing in Docs */}
      <OnChainMatrix />

      {/* AI Blueprint Q&A — second thing, so visitors can ask questions about the matrix above */}
      <Reveal>
        <BlueprintQA />
      </Reveal>

      {/* Top-Tier Audit Findings — third thing, so visitors see the honest audit verdict immediately */}
      <Reveal>
        <AuditFindings />
      </Reveal>

      {/* Intro */}
      <Reveal>
        <Panel className="p-5">
          <div className="flex items-start gap-3">
            <BookOpen className="h-5 w-5 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[0.82rem] text-muted-foreground/85 leading-relaxed">
              The MTQΣ Master Monetary Architecture v1.0 is the source of truth for the closed-loop
              monetary architecture. This section surfaces the 7-component Strategic Prior, per-component
              admissibility envelopes, the four-state weight system, the MASE ensemble, the constitutional
              invariants, the 5-state risk machine, the 4-tier governance hierarchy, the honest status
              declaration, the claims NOT supported (incl. the new v1.0 entries), and the v1.2 → v1.0
              reconciliation table. The legacy v1.2 fixed-quantity basket (BASKET_TABLE) and removed-claims
              table (REMOVED_CLAIMS) are SUPERSEDED — see the reconciliation block at the bottom.
            </p>
          </div>
        </Panel>
      </Reveal>

      {/* 1. Strategic Prior + GFB Basket (STRATEGIC_PRIOR_TABLE) */}
      <section aria-labelledby="docs-gfb">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§3.2 · Strategic Prior</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">GFB Index — 7-Component Strategic Prior</h3>
          </div>
        </div>
        <Reveal>
          <GfbBasket />
        </Reveal>
        {/* Explicit STRATEGIC_PRIOR_TABLE quick-reference */}
        <Reveal delay={0.05}>
          <div className="mt-4">
            <RefTable
              title="Strategic Prior (§3.2 — v1.0)"
              subtitle="Adaptive W^Prior — deviation penalised, not enforced. Live weights computed by MASE under constitutional envelopes."
              headers={["Component", "Token (Registry-Resolved)", "W^Prior"]}
              rows={STRATEGIC_PRIOR_TABLE.map((row) => [
                <span key="component" className="font-mono text-amber-200">{row.component}</span>,
                <span key="token" className="text-foreground/85">{row.token}</span>,
                <span key="weight" className="font-mono text-amber-200">{(row.weight * 100).toFixed(2)}%</span>,
              ])}
            />
          </div>
        </Reveal>
      </section>

      {/* 2. Admissibility Envelopes (ENVELOPES_TABLE) */}
      <section aria-labelledby="docs-envelopes">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§8.1 · Admissibility</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Per-Component Admissibility Envelopes</h3>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone="emerald">
              <GlowDot color="emerald" size="h-1.5 w-1.5" />
              live in Dashboard
            </Pill>
            <Pill tone="gold">hard bounds</Pill>
          </div>
        </div>
        <Reveal>
          <RefTable
            title="Admissibility Envelopes (§8.1)"
            subtitle="No MASE optimizer output may cross these per-component hard bounds. The prior sits inside every envelope. The Dashboard's MASE section now shows the live status of each component's execution weight against its envelope (ok / near edge / breach)."
            headers={["Component", "Lower Bound", "Upper Bound", "Strategic Prior"]}
            rows={ENVELOPES_TABLE.map((row) => [
              <span key="component" className="font-mono text-amber-200">{row.component}</span>,
              <span key="lower" className="font-mono text-rose-300/90">{row.lower}</span>,
              <span key="upper" className="font-mono text-rose-300/90">{row.upper}</span>,
              <span key="prior" className="font-mono text-emerald-200/90">{row.prior}</span>,
            ])}
          />
        </Reveal>
      </section>

      {/* 3. Four-State Weights (WEIGHT_STATE_DESCRIPTIONS) */}
      <section aria-labelledby="docs-weight-states">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§2.3 · Weight States</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Four-State Weight Distinction</h3>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone="emerald">
              <GlowDot color="emerald" size="h-1.5 w-1.5" />
              live in Dashboard
            </Pill>
            <Pill tone="gold">W^Prior ≠ W^Target ≠ W^Smooth ≠ W^Execution</Pill>
          </div>
        </div>
        <Reveal>
          <RefTable
            title="Four-State Weight System (§2.3)"
            subtitle="Each published weight W_t is the EXECUTION weight (I6) — never the target or smoothed weight. The Dashboard's MASE section now renders the live 4-state table per component (USD/EUR/JPY/GBP/CNY/CHF/Gold), with the smoothed→execution deviation flagged in green/red."
            headers={["State", "Symbol", "Meaning", "Produced By"]}
            rows={WEIGHT_STATE_DESCRIPTIONS.map((row) => [
              <span key="state" className="font-mono font-semibold text-amber-200">{row.state}</span>,
              <span key="symbol" className="font-mono text-emerald-200/90">{row.symbol}</span>,
              <span key="meaning" className="text-muted-foreground/85">{row.meaning}</span>,
              <span key="producedBy" className="text-muted-foreground/80">{row.producedBy}</span>,
            ])}
          />
        </Reveal>
      </section>

      {/* 4. MASE Ensemble (MASE_MODELS) */}
      <section aria-labelledby="docs-mase">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§6 / §7 · MASE</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">MASE Candidate Models</h3>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone="emerald">
              <GlowDot color="emerald" size="h-1.5 w-1.5" />
              live in Dashboard
            </Pill>
            <Pill tone="gold">6-model ensemble</Pill>
          </div>
        </div>
        <Reveal>
          <RefTable
            title="MASE Ensemble (§6 / §7)"
            subtitle="The Multi-Asset Stochastic Ensemble runs 6 candidate models and combines them with equal weights (pilot) / adaptive weights (production target). The Dashboard's 'MASE Ensemble + 4-State Weights + MARP' section now shows these models' live weight vectors, the equal-weight ensemble target, the per-component admissibility envelope status, the four-state weight distinction (Prior → Target → Smoothed → Execution), and the per-component MARP rebalancing decisions."
            headers={["ID", "Model", "Description"]}
            rows={MASE_MODELS.map((row) => [
              <span key="id" className="font-mono text-amber-200">{row.id}</span>,
              <span key="name" className="font-semibold text-foreground/95">{row.name}</span>,
              <span key="desc" className="text-muted-foreground/85">{row.desc}</span>,
            ])}
          />
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-4">
            <Panel className="p-4 border-emerald-400/20">
              <div className="flex items-start gap-3">
                <ArrowRight className="h-4 w-4 text-mtqs-emerald/80 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="text-sm font-semibold text-foreground/90 mb-1">Live MASE data now in the Dashboard</div>
                  <p className="text-[0.78rem] text-muted-foreground/85 leading-relaxed">
                    The <button
                      onClick={() => _onNavigate("dashboard")}
                      className="font-mono text-mtqs-emerald/90 hover:text-mtqs-emerald underline-offset-2 hover:underline"
                    >
                      Dashboard
                    </button> now renders a dedicated <span className="text-amber-200/90 font-medium">MASE Ensemble + 4-State Weights + MARP</span> section
                    (between the Adaptive Macro Engine and the Rebalancing Engine) showing the live output of all 6 candidate models,
                    the equal-weight ensemble target, the four-state weight table (W<sup>Prior</sup> → W<sup>Target</sup> → W<sup>Smooth</sup> → W<sup>Execution</sup>),
                    the per-component admissibility envelope status (ok / warn / breach), and the MARP per-component rebalancing decisions
                    (direction, trade USD, urgency, level, reason). The legacy §6 single-engine (VIX/DXY → θ ±3%) and §7 single-direction
                    rebalance are retained in parallel as live pilot paths; MASE + MARP is the v1.0 production target.
                  </p>
                </div>
              </div>
            </Panel>
          </div>
        </Reveal>
      </section>

      {/* 5. Constitutional Invariants (CONSTITUTIONAL_INVARIANTS) */}
      <section aria-labelledby="docs-invariants">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§2.6 · Hard Rules</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Constitutional Invariants</h3>
          </div>
          <Pill tone="gold">I1–I11</Pill>
        </div>
        <Reveal>
          <RefTable
            title="Constitutional Invariants (§2.6)"
            subtitle="Hard rules — cannot be relaxed by governance. v1.0 added I6 (execution weight is the published weight), I10 (honest status), I11 (daily calc ≠ daily trade)."
            headers={["ID", "Description", "Enforced By"]}
            rows={CONSTITUTIONAL_INVARIANTS.map((row) => [
              <span key="id" className="font-mono text-amber-200">{row.id}</span>,
              <span key="description" className="text-muted-foreground/85">{row.description}</span>,
              <span key="enforcedBy" className="font-mono text-emerald-200/80">{row.enforcedBy}</span>,
            ])}
          />
        </Reveal>
      </section>

      {/* 6. Risk State Machine (RISK_STATE_MACHINE) */}
      <section aria-labelledby="docs-risk">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§14.1 · Risk</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Risk State Machine &amp; Governance</h3>
          </div>
        </div>
        <Reveal>
          <RiskStateMachine snapshot={snapshot} />
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-4">
            <RefTable
              title="Risk State Machine (§14.1)"
              subtitle="5 states · Minting/Redemption/Rebalancing policy per state · RR target"
              headers={["Status", "Minting", "Redemption", "Rebalancing", "RR Target"]}
              rows={RISK_STATE_MACHINE.map((row) => {
                const sc = STATUS_COLORS[row.status] ?? STATUS_COLORS.NORMAL;
                return [
                  <span
                    key="status"
                    className="inline-flex items-center gap-1.5 font-mono font-semibold"
                    style={{ color: sc.color }}
                  >
                    <GlowDot
                      color={
                        row.status === "NORMAL"
                          ? "emerald"
                          : row.status === "CAUTION"
                          ? "amber"
                          : row.status === "RECOVERY"
                          ? "gold"
                          : "rose"
                      }
                      size="h-1.5 w-1.5"
                    />
                    {row.status}
                  </span>,
                  <span key="minting" className="text-foreground/85">{row.minting}</span>,
                  <span key="redemption" className="text-foreground/85">{row.redemption}</span>,
                  <span key="rebalancing" className="text-foreground/85">{row.rebalancing}</span>,
                  <span key="rr" className="font-mono text-amber-200">{(row.rrTarget * 100).toFixed(0)}%</span>,
                ];
              })}
            />
          </div>
        </Reveal>
      </section>

      {/* 7. Governance hierarchy (GOVERNANCE_HIERARCHY) */}
      <section aria-labelledby="docs-gov">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§14.2 · Authority</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Governance Hierarchy</h3>
          </div>
        </div>
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {GOVERNANCE_HIERARCHY.map((row, i) => {
              const tierKey = (
                ["constitutional", "monetary", "risk", "emergency"] as const
              )[i];
              const tier = GOVERNANCE_TIERS[tierKey];
              return (
                <Panel key={row.scope} className="p-4" style={{ boxShadow: tier.glow }}>
                  <div
                    className="text-[0.6rem] uppercase tracking-[0.18em] mb-2"
                    style={{ color: tier.color }}
                  >
                    Tier {i + 1}
                  </div>
                  <div className="text-sm font-semibold text-foreground/95 mb-1.5">{row.scope}</div>
                  <div className="font-mono text-[0.72rem]" style={{ color: tier.color }}>
                    {row.authority}
                  </div>
                  <div className="mt-2 text-[0.68rem] text-muted-foreground/75">
                    Timelock: <span className="font-mono text-foreground/85">{row.timelock}</span>
                  </div>
                  <div className="mt-1 text-[0.62rem] text-muted-foreground/60">{tier.label}</div>
                </Panel>
              );
            })}
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <RefTable
            title="Governance Hierarchy (§14.2)"
            subtitle="4 tiers · escalating authority + descending timelock"
            headers={["Scope", "Authority", "Timelock"]}
            rows={GOVERNANCE_HIERARCHY.map((row) => [
              <span key="scope" className="text-foreground/90">{row.scope}</span>,
              <span key="authority" className="font-mono text-amber-200">{row.authority}</span>,
              <span key="timelock" className="font-mono text-amber-200">{row.timelock}</span>,
            ])}
          />
        </Reveal>
      </section>

      {/* 8. Honest Status (HONEST_STATUS) — delegated to HonestStatus component */}
      <section aria-labelledby="docs-honest">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§25 · Honesty</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Honest Status Declaration</h3>
          </div>
        </div>
        <Reveal>
          <HonestStatus snapshot={snapshot} />
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-4">
            <RefTable
              title="Honest Status Table (§25.2 — v1.0)"
              subtitle="State of each conceptual dimension of the protocol — updated for Master v1.0"
              headers={["Metric", "State"]}
              rows={HONEST_STATUS.map((row) => [
                <span key="metric" className="text-muted-foreground/85">{row.metric}</span>,
                <span key="state" className="font-mono text-foreground/90">{row.state}</span>,
              ])}
            />
          </div>
        </Reveal>
      </section>

      {/* 9. Unsupported Claims (UNSUPPORTED_CLAIMS) — v1.0 table replaces the v1.2 REMOVED_CLAIMS */}
      <section aria-labelledby="docs-unsupported">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§25.3 · Transparency</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Claims NOT Supported</h3>
          </div>
          <Pill tone="amber">v1.0 adds 3 new</Pill>
        </div>
        <Reveal>
          <RefTable
            title="Claims NOT Supported (§25.3 — v1.0)"
            subtitle="v1.0 added: 'Fixed composition', 'Guaranteed outcomes', 'Final optimal percentages'. The legacy v1.2 REMOVED_CLAIMS table is SUPERSEDED — see the reconciliation block below."
            headers={["Claim", "Reason NOT Supported"]}
            rows={UNSUPPORTED_CLAIMS.map((row) => [
              <span key="claim" className="line-through text-mtqs-rose/70 font-mono">{row.claim}</span>,
              <span key="reason" className="text-muted-foreground/85">{row.reason}</span>,
            ])}
          />
        </Reveal>
      </section>

      {/* 10. Reconciliation: v1.2 → v1.0 (RECONCILIATION_CHANGES) */}
      <section aria-labelledby="docs-reconciliation-changes">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">v1.2 → v1.0</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Reconciliation — v1.2 (superseded) vs Master v1.0</h3>
          </div>
          <Pill tone="gold">11 areas</Pill>
        </div>
        <Reveal>
          <RefTable
            title="v1.2 → v1.0 Reconciliation Changes"
            subtitle="Each row shows the superseded v1.2 approach vs the new v1.0 approach. The legacy engine constants are retained for backward-compat (marked SUPERSEDED in blueprint.ts)."
            headers={["Area", "v1.2 (Superseded)", "v1.0 (Master)"]}
            rows={RECONCILIATION_CHANGES.map((row) => [
              <span key="area" className="font-semibold text-amber-200">{row.area}</span>,
              <span key="v1_2" className="text-muted-foreground/70 line-through">{row.v1_2}</span>,
              <span key="v1_0" className="text-emerald-200/90">{row.v1_0}</span>,
            ])}
          />
        </Reveal>
      </section>

      {/* 11. Reconciliation findings (snapshot.reconciliation) — live honest audit */}
      <section aria-labelledby="docs-findings">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">Live · Honest Audit</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Reconciliation Findings (Live)</h3>
          </div>
          <Pill tone={findings.length ? "emerald" : "muted"}>
            <GlowDot color={findings.length ? "emerald" : "gold"} size="h-1.5 w-1.5" />
            {findings.length} finding{findings.length === 1 ? "" : "s"}
          </Pill>
        </div>
        <Reveal>
          <Panel className="p-5 mtqs-glow">
            {findings.length === 0 ? (
              <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[0.75rem] text-muted-foreground/70">
                <ScrollText className="h-5 w-5 mx-auto mb-2 opacity-50" aria-hidden="true" />
                No reconciliation findings loaded. Visit the Dashboard to fetch the live snapshot.
              </div>
            ) : (
              <div className="space-y-3">
                {findings.map((f, i) => {
                  const tone =
                    f.severity === "fixed"
                      ? "border-mtqs-emerald/40 bg-mtqs-emerald/[0.06]"
                      : f.severity === "outstanding"
                      ? "border-mtqs-amber/40 bg-mtqs-amber/[0.06]"
                      : "border-white/[0.08] bg-white/[0.02]";
                  return (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      className={`rounded-md border p-4 ${tone}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-start gap-2">
                          <span className="font-mono text-xs text-muted-foreground/70 shrink-0 mt-0.5">
                            #{i + 1}
                          </span>
                          <div className="text-sm font-semibold text-foreground/95 leading-snug">
                            {f.title}
                          </div>
                        </div>
                        <FindingSeverityBadge severity={f.severity} />
                      </div>
                      <p className="text-[0.75rem] text-muted-foreground/85 leading-relaxed">
                        {f.description}
                      </p>
                      {f.resolution && (
                        <p className="mt-2 text-[0.72rem] text-foreground/75 leading-relaxed">
                          <span className="text-mtqs-gold/80 uppercase tracking-[0.18em] text-[0.6rem] font-medium mr-1">
                            Resolution
                          </span>
                          {f.resolution}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </Panel>
        </Reveal>
      </section>

      {/* Closing */}
      <Reveal>
        <Panel className="p-5 sm:p-6 text-center">
          <p className="text-[0.82rem] text-muted-foreground/85 leading-relaxed max-w-2xl mx-auto mb-4">
            Blueprint reference complete. See the engine in action in the Dashboard, or review the
            contract registry to verify each deployment on-chain.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => _onNavigate("dashboard")}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-[0.78rem] font-medium text-foreground/85 hover:border-mtqs-gold/30 hover:text-foreground transition"
            >
              Live Dashboard
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={() => _onNavigate("investors")}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-[0.78rem] font-medium text-foreground/85 hover:border-mtqs-gold/30 hover:text-foreground transition"
            >
              Investor endpoints
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
