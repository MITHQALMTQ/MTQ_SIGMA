// MTQΣ — Docs Section
// Reference documentation: GFB basket (BASKET_TABLE) · Risk state machine
// (RISK_STATE_MACHINE) · Governance hierarchy (GOVERNANCE_HIERARCHY) ·
// Honest status (HONEST_STATUS) · Removed claims (REMOVED_CLAIMS) ·
// Reconciliation findings (snapshot.reconciliation).
//
// Props: { onNavigate, snapshot }.

"use client";

import { motion } from "framer-motion";
import { BookOpen, ArrowRight, ScrollText } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading } from "@/components/mtq/primitives";
import { GfbBasket } from "@/components/mtq/GfbBasket";
import { RiskStateMachine } from "@/components/mtq/RiskStateMachine";
import { HonestStatus } from "@/components/mtq/HonestStatus";
import {
  BASKET_TABLE,
  RISK_STATE_MACHINE,
  GOVERNANCE_HIERARCHY,
  HONEST_STATUS,
  REMOVED_CLAIMS,
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
        <div className="max-h-80 overflow-y-auto mtqs-scroll">
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
        eyebrow="§1 · §2 · §14 · §15 · reference"
        title="Documentation — Blueprint Reference"
        right={
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            v1.2 · FINAL
          </Pill>
        }
      />

      {/* Intro */}
      <Reveal>
        <Panel className="p-5">
          <div className="flex items-start gap-3">
            <BookOpen className="h-5 w-5 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[0.82rem] text-muted-foreground/85 leading-relaxed">
              The MTQΣ Blueprint v1.2 is the source of truth for the closed-loop monetary
              architecture. This section surfaces the immutable constants, the 5-state risk
              machine, the 4-tier governance hierarchy, the honest status declaration, and the
              claims that were removed (with what replaced them). Where the engine computes live
              values, the engine values are shown alongside the constants.
            </p>
          </div>
        </Panel>
      </Reveal>

      {/* 1. GFB Basket (BASKET_TABLE) */}
      <section aria-labelledby="docs-gfb">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§2 · The Index</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">GFB Basket Reference</h3>
          </div>
        </div>
        <Reveal>
          <GfbBasket />
        </Reveal>
        {/* Explicit BASKET_TABLE quick-reference */}
        <Reveal delay={0.05}>
          <div className="mt-4">
            <RefTable
              title="Basket Constants (§2.1.1)"
              subtitle="Immutable quantities — change requires 7/7 Multi-Sig + 90-day timelock"
              headers={["Currency", "Asset", "Quantity (qᵢ)", "Weight"]}
              rows={BASKET_TABLE.map((row) => [
                <span key="currency" className="font-mono text-amber-200">{row.currency}</span>,
                <span key="asset" className="text-foreground/85">{row.asset}</span>,
                <span key="quantity" className="font-mono text-amber-200">{row.quantity.toFixed(4)}</span>,
                <span key="weight" className="font-mono text-muted-foreground/80">{(row.weight * 100).toFixed(2)}%</span>,
              ])}
            />
          </div>
        </Reveal>
      </section>

      {/* 2. Risk State Machine (RISK_STATE_MACHINE) */}
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

      {/* 3. Governance hierarchy (GOVERNANCE_HIERARCHY) */}
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

      {/* 4. Honest Status (HONEST_STATUS) */}
      <section aria-labelledby="docs-honest">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§15 · Honesty</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Honest Status Declaration</h3>
          </div>
        </div>
        <Reveal>
          <HonestStatus snapshot={snapshot} />
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-4">
            <RefTable
              title="Honest Status Table (§15.2)"
              subtitle="State of each conceptual dimension of the protocol"
              headers={["Metric", "State"]}
              rows={HONEST_STATUS.map((row) => [
                <span key="metric" className="text-muted-foreground/85">{row.metric}</span>,
                <span key="state" className="font-mono text-foreground/90">{row.state}</span>,
              ])}
            />
          </div>
        </Reveal>
      </section>

      {/* 5. Removed claims (REMOVED_CLAIMS) */}
      <section aria-labelledby="docs-removed">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">§15.1 · Transparency</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Removed Claims</h3>
          </div>
        </div>
        <Reveal>
          <RefTable
            title="Removed Claims (§15.1)"
            subtitle="What was over-claimed in earlier drafts and what replaced it"
            headers={["Removed Claim", "Replaced With"]}
            rows={REMOVED_CLAIMS.map((row) => [
              <span key="removed" className="line-through text-mtqs-rose/70 font-mono">{row.removed}</span>,
              <span key="replaced" className="text-[#6ff0c0]/90 font-mono">{row.replaced}</span>,
            ])}
          />
        </Reveal>
      </section>

      {/* 6. Reconciliation findings (snapshot.reconciliation) */}
      <section aria-labelledby="docs-findings">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">v1.2 · Reconciliation</div>
            <h3 className="mt-2 text-base font-semibold text-foreground/95">Reconciliation Findings</h3>
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
