// MTQΣ — Honest Status Declaration (§25, v1.0 Master) + Honest Audit Findings
// Brand v2: shows ALL 4 reconciliation findings (F1 redemption price
// contradiction = fixed, F2 genesis issuer concentration breach = fixed,
// F3 VIX/DXY now LIVE from Yahoo Finance = fixed, F4 Sharia not certified =
// informational) with severity-coded badges (fixed=emerald, outstanding=amber,
// informational=neutral). Also renders HONEST_STATUS, UNSUPPORTED_CLAIMS
// (v1.0 — replaces the legacy v1.2 REMOVED_CLAIMS table), and the canonical
// redemption policy text from snapshot.redemptionPolicy.
//
// The Honest Audit panel now leads with the brand voice (sovereign, calm,
// collateralized) — no longer rose-only. Both findings F1 + F2 are surfaced as
// resolved/fixed, with the live per-issuer breakdown shown inline.

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, Pill, GlowDot } from "./primitives";
import { HONEST_STATUS, UNSUPPORTED_CLAIMS } from "@/lib/mtq/blueprint";
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
            ? "border-mtqs-rose/40 bg-mtqs-rose/5 text-mtqs-rose"
            : r.status === "warn"
            ? "border-mtqs-amber/40 bg-mtqs-amber/5 text-mtqs-amber"
            : "border-mtqs-emerald/40 bg-mtqs-emerald/5 text-mtqs-emerald";
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
      ? "border-mtqs-emerald/40 bg-mtqs-emerald/5"
      : finding.severity === "outstanding"
      ? "border-mtqs-amber/40 bg-mtqs-amber/5"
      : "border-white/[0.06] bg-white/[0.03]/[0.02]";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className={`rounded-md border p-4 ${tone}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-start gap-2">
          <span className="font-mono text-xs text-white/40 shrink-0 mt-0.5">
            #{index + 1}
          </span>
          <div className="text-sm font-semibold text-white leading-snug">
            {finding.title}
          </div>
        </div>
        <SeverityBadge severity={finding.severity} />
      </div>
      <p className="text-[0.75rem] text-white/40 leading-relaxed">
        {finding.description}
      </p>
      {finding.resolution && (
        <p className="mt-2 text-[0.72rem] text-white/40 leading-relaxed">
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
              <div className="text-base font-semibold text-white mb-1">
                MTQΣ v1.0 (Master Blueprint) — {BRAND_VOICE.statusDeclaration}
              </div>
              <p className="text-[0.82rem] text-white/40 leading-relaxed">
                {BRAND_VOICE.coreObjective} The system is {BRAND_VOICE.designConstraint.toLowerCase()}.
                This pilot is a faithful reference implementation of the closed-loop blueprint
                math, not a deployed production system.
              </p>
            </div>
          </div>

          {/* HONEST_STATUS table */}
          <div className="overflow-hidden rounded-md border border-white/[0.06]">
            <table className="w-full text-[0.75rem]">
              <thead className="bg-white/[0.03]/[0.02] text-white/40/75">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Metric</th>
                  <th className="text-left px-3 py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {HONEST_STATUS.map((row, i) => (
                  <tr key={row.metric} className={`border-t border-white/[0.06] ${i % 2 ? "bg-white/[0.03]/[0.01]" : ""}`}>
                    <td className="px-3 py-2 text-white/40">{row.metric}</td>
                    <td className="px-3 py-2 text-white/90 font-mono">{row.state}</td>
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
              <div className="text-base font-semibold text-white">Honest Audit Findings</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {fixedCount > 0 && <Pill tone="emerald">{fixedCount} fixed</Pill>}
              {outstandingCount > 0 && <Pill tone="amber">{outstandingCount} outstanding</Pill>}
              {informationalCount > 0 && <Pill tone="muted">{informationalCount} informational</Pill>}
            </div>
          </div>

          {findings.length === 0 ? (
            <div className="rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-4 text-center text-[0.75rem] text-white/40">
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
            <div className="mt-4 rounded-md border border-mtqs-emerald/30 bg-mtqs-emerald/5 p-3">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-emerald/80 mb-1">
                §12.2 vs §3.4.2 — Redemption Policy (Reconciled)
              </div>
              <div className="font-mono text-sm text-mtqs-emerald">
                {snapshot.redemptionPolicy.canonical}
              </div>
              <div className="mt-1 text-[0.7rem] text-white/40 leading-relaxed">
                {snapshot.redemptionPolicy.reason}
              </div>
              <div className="mt-1 text-[0.65rem] text-white/40/60 italic">
                Informational: {snapshot.redemptionPolicy.informational}
              </div>
            </div>
          )}

          <p className="mt-3 text-[0.72rem] text-white/40 leading-relaxed">
            These are honest findings surfaced by the pilot. As of the V3 reconciliation pass:
            F1 (§12.2 vs §3.4.2 redemption contradiction), F2 (issuer concentration breach), and
            F3 (VIX/DXY now LIVE from Yahoo Finance) are all <span className="text-mtqs-emerald font-medium">fixed</span>;
            F4 (Sharia not certified) remains <span className="text-mtqs-gold font-medium">informational</span> (requires independent scholarly review).
            The live status of each finding is read from the engine snapshot above — not hardcoded.
          </p>
        </Panel>
      </Reveal>

      {/* UNSUPPORTED_CLAIMS table (v1.0 — replaces the legacy v1.2 REMOVED_CLAIMS) */}
      <Reveal>
        <Panel className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-white/90">Claims NOT Supported (§25.3 — v1.0)</div>
              <div className="text-[0.7rem] text-white/40">v1.0 added “Fixed composition”, “Guaranteed outcomes”, “Final optimal percentages” — the methodology is fixed, the outcomes are not</div>
            </div>
          </div>
          <div className="overflow-hidden rounded-md border border-white/[0.06]">
            <table className="w-full text-[0.72rem]">
              <thead className="bg-white/[0.03]/[0.02] text-white/40">
                <tr>
                  <th className="text-left px-3 py-2 font-medium w-1/2">Claim</th>
                  <th className="text-left px-3 py-2 font-medium w-1/2">Reason NOT Supported</th>
                </tr>
              </thead>
              <tbody>
                {UNSUPPORTED_CLAIMS.map((row, i) => (
                  <motion.tr
                    key={row.claim}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03 }}
                    className={`border-t border-white/[0.06] ${i % 2 ? "bg-white/[0.03]/[0.01]" : ""}`}
                  >
                    <td className="px-3 py-2.5">
                      <span className="line-through text-mtqs-rose/70 font-mono">{row.claim}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-white/40">{row.reason}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[0.7rem] text-white/40 leading-relaxed">
            §25.3 v1.0 added three new unsupported claims that the legacy v1.2 had not explicitly disclaimed:
            <span className="text-mtqs-gold font-medium"> “Fixed composition”</span>,
            <span className="text-mtqs-gold font-medium"> “Guaranteed outcomes”</span>, and
            <span className="text-mtqs-gold font-medium"> “Final optimal percentages”</span>.
            The composition is <span className="italic">adaptive</span> (MASE ensemble + admissibility envelopes);
            the methodology is fixed but the outcomes are not. No percentage is final until the validation
            program (Chapter 23) completes.
          </p>
        </Panel>
      </Reveal>
    </div>
  );
}
