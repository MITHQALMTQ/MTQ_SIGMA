// MTQΣ — Honest Status Declaration (§15) + Honest Audit Findings
// Brand v2: shows ALL 4 reconciliation findings (F1 redemption price
// contradiction = fixed, F2 genesis issuer concentration breach = fixed,
// F3 VIX/DXY simulated = informational, F4 Sharia not certified =
// informational) with severity-coded badges (fixed=emerald, outstanding=amber,
// informational=neutral). Also renders HONEST_STATUS, REMOVED_CLAIMS, and the
// canonical redemption policy text from snapshot.redemptionPolicy.
//
// The Honest Audit panel now leads with the brand voice (sovereign, calm,
// collateralized) — no longer rose-only. Both findings F1 + F2 are surfaced as
// resolved/fixed, with the live per-issuer breakdown shown inline.

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, Pill, GlowDot } from "./primitives";
import { HONEST_STATUS, REMOVED_CLAIMS } from "@/lib/mtq/blueprint";
import { BRAND_VOICE } from "@/lib/mtq/brand";
import { fmtUsd } from "./format";
import type { MetricsSnapshot, ReconciliationFinding } from "@/lib/mtq/engine";

/* ---------- Severity badge (fixed / outstanding / informational) ---------- */
function SeverityBadge({ severity }: { severity: ReconciliationFinding["severity"] }) {
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

/* ---------- Per-issuer mini-row (for F2 concentration finding) ---------- */
function IssuerBreakdown({ snapshot }: { snapshot: MetricsSnapshot }) {
  const reports = snapshot.concentration ?? [];
  if (reports.length === 0) return null;
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
      {reports.map((r) => {
        const tone =
          r.status === "breach"
            ? "border-mtqs-rose/40 bg-mtqs-rose/[0.06] text-[#ff8ea3]"
            : r.status === "warn"
            ? "border-mtqs-amber/40 bg-mtqs-amber/[0.06] text-[#ffd07a]"
            : "border-mtqs-emerald/40 bg-mtqs-emerald/[0.06] text-[#6ff0c0]";
        return (
          <div key={r.issuer} className={`rounded-md border px-2.5 py-1.5 ${tone}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold">{r.issuer}</span>
              <span className="font-mono text-[0.65rem] uppercase tracking-wider">
                {r.status}
              </span>
            </div>
            <div className="mt-0.5 font-mono text-sm">
              {(r.sharePct * 100).toFixed(2)}% · {fmtUsd(r.usdValue)}
            </div>
            <div className="text-[0.6rem] opacity-80 font-mono">
              warn {(r.warnPct * 100).toFixed(0)}% · limit {(r.limitPct * 100).toFixed(0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Single finding card ---------- */
function FindingCard({ finding, index, snapshot }: { finding: ReconciliationFinding; index: number; snapshot: MetricsSnapshot | null }) {
  const tone =
    finding.severity === "fixed"
      ? "border-mtqs-emerald/40 bg-mtqs-emerald/[0.06]"
      : finding.severity === "outstanding"
      ? "border-mtqs-amber/40 bg-mtqs-amber/[0.06]"
      : "border-white/[0.08] bg-white/[0.02]";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`rounded-md border p-4 ${tone}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2">
          <span className="font-mono text-xs text-muted-foreground/70 shrink-0 mt-0.5">
            #{index + 1}
          </span>
          <div className="text-sm font-semibold text-foreground/95 leading-snug">
            {finding.title}
          </div>
        </div>
        <SeverityBadge severity={finding.severity} />
      </div>
      <p className="text-[0.75rem] text-muted-foreground/85 leading-relaxed">
        {finding.description}
      </p>
      {finding.resolution && (
        <p className="mt-2 text-[0.72rem] text-foreground/75 leading-relaxed">
          <span className="text-mtqs-gold/80 uppercase tracking-[0.18em] text-[0.6rem] font-medium mr-1">
            Resolution
          </span>
          {finding.resolution}
        </p>
      )}
      {/* Inline per-issuer breakdown for the F2 concentration finding */}
      {finding.id === "F2-circle-concentration" && snapshot && (
        <IssuerBreakdown snapshot={snapshot} />
      )}
    </motion.div>
  );
}

export function HonestStatus({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const findings = snapshot?.reconciliation ?? [];
  const fixedCount = findings.filter((f) => f.severity === "fixed").length;
  const outstandingCount = findings.filter((f) => f.severity === "outstanding").length;
  const informationalCount = findings.filter((f) => f.severity === "informational").length;

  return (
    <div className="space-y-4">
      {/* Main honest declaration — calm, sovereign, brand-led */}
      <Reveal>
        <Panel className="p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <GlowDot color="gold" size="h-3 w-3" className="mt-1" />
            <div>
              <div className="text-base font-semibold text-foreground/95 mb-1">
                MTQΣ v1.2 — {BRAND_VOICE.statusDeclaration}
              </div>
              <p className="text-[0.82rem] text-muted-foreground/85 leading-relaxed">
                {BRAND_VOICE.coreObjective} The system is {BRAND_VOICE.designConstraint.toLowerCase()}.
                This pilot is a faithful reference implementation of the closed-loop blueprint
                math, not a deployed production system.
              </p>
            </div>
          </div>

          {/* HONEST_STATUS table */}
          <div className="overflow-hidden rounded-md border border-white/[0.08]">
            <table className="w-full text-[0.75rem]">
              <thead className="bg-white/[0.02] text-muted-foreground/75">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Metric</th>
                  <th className="text-left px-3 py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {HONEST_STATUS.map((row, i) => (
                  <tr key={row.metric} className={`border-t border-white/[0.05] ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                    <td className="px-3 py-2 text-muted-foreground/80">{row.metric}</td>
                    <td className="px-3 py-2 text-foreground/90 font-mono">{row.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>

      {/* Honest Audit Findings — all 4 with severity badges */}
      <Reveal>
        <Panel className="p-5 sm:p-6 mtqs-glow">
          <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <GlowDot color="gold" size="h-3 w-3" />
              <div className="text-base font-semibold text-foreground/95">Honest Audit Findings</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {fixedCount > 0 && <Pill tone="emerald">{fixedCount} fixed</Pill>}
              {outstandingCount > 0 && <Pill tone="amber">{outstandingCount} outstanding</Pill>}
              {informationalCount > 0 && <Pill tone="muted">{informationalCount} informational</Pill>}
            </div>
          </div>

          {findings.length === 0 ? (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-center text-[0.75rem] text-muted-foreground/70">
              Loading audit findings…
            </div>
          ) : (
            <div className="space-y-3">
              {findings.map((f, i) => (
                <FindingCard key={f.id} finding={f} index={i} snapshot={snapshot} />
              ))}
            </div>
          )}

          {/* Redemption policy reconciliation block */}
          {snapshot?.redemptionPolicy && (
            <div className="mt-4 rounded-md border border-mtqs-emerald/30 bg-mtqs-emerald/[0.04] p-3">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-emerald/80 mb-1">
                §12.2 vs §3.4.2 — Redemption Policy (Reconciled)
              </div>
              <div className="font-mono text-sm text-[#6ff0c0]">
                {snapshot.redemptionPolicy.canonical}
              </div>
              <div className="mt-1 text-[0.7rem] text-muted-foreground/80 leading-relaxed">
                {snapshot.redemptionPolicy.reason}
              </div>
              <div className="mt-1 text-[0.65rem] text-muted-foreground/60 italic">
                Informational: {snapshot.redemptionPolicy.informational}
              </div>
            </div>
          )}

          <p className="mt-3 text-[0.72rem] text-muted-foreground/70 leading-relaxed">
            These are honest findings surfaced by the pilot. Both F1 (§12.2 vs §3.4.2) and
            F2 (issuer concentration breach) are <span className="text-[#6ff0c0] font-medium">fixed</span>;
            F3 (VIX/DXY simulated) and F4 (Sharia not certified) remain informational.
          </p>
        </Panel>
      </Reveal>

      {/* REMOVED_CLAIMS table */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground/90">Removed Claims (§15.1)</div>
              <div className="text-[0.7rem] text-muted-foreground/70">transparency on what was over-claimed in earlier drafts and what replaced it</div>
            </div>
          </div>
          <div className="overflow-hidden rounded-md border border-white/[0.07]">
            <table className="w-full text-[0.72rem]">
              <thead className="bg-white/[0.02] text-muted-foreground/70">
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-1/2">Removed Claim</th>
                  <th className="text-left px-3 py-2 font-medium w-1/2">Replaced With</th>
                </tr>
              </thead>
              <tbody>
                {REMOVED_CLAIMS.map((row, i) => (
                  <motion.tr
                    key={row.removed}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                    className={`border-t border-white/[0.05] ${i % 2 ? "bg-white/[0.01]" : ""}`}
                  >
                    <td className="px-3 py-2.5">
                      <span className="line-through text-mtqs-rose/70 font-mono">{row.removed}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[#6ff0c0]/90 font-mono">{row.replaced}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
