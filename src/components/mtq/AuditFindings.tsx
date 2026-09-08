// MTQΣ — Audit Findings Panel (top-tier multi-disciplinary audit, surfaced in the UI)
//
// The audit (audit-work/FINAL-TOP-TIER-AUDIT-REPORT.md) produced:
//   - 4 P0 findings (chain-linking, redemption pricing, 6 risk states, 4 governance layers)
//   - 6 Critical + 8 High smart-contract findings
//   - 5 of 11 stress test scenarios FAILED their targets (gold +50% = 0% survival)
//   - 0x7FF honest mask is OVERSTATED; audit-verified honest mask = 0x5A7 (7 of 11 bits truly implemented)
//   - Final composite grade: 65/100
//
// Per the COO Recommendations document (audit-work/COO-RECOMMENDATIONS.md §6 Action B),
// these findings MUST be surfaced in the UI — not as "we passed the audit" but as
// "here is what the audit found, here is what we are doing about it." Transparency is
// the cheapest credibility we can buy.
//
// The panel links to the full audit report (5 documents, 3111 lines total) at audit-work/.

"use client";

import { motion } from "framer-motion";
import { ShieldAlert, FileWarning, FileText, ExternalLink, ArrowRight } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot } from "./primitives";

/* ---------- Audit finding data (canonical, from the final report) ---------- */

interface P0Finding {
  id: string;
  title: string;
  detail: string;
  owner: string;
  deadline: string;
  status: "open" | "in-progress" | "fixed";
}

const P0_FINDINGS: P0Finding[] = [
  {
    id: "P0-1",
    title: "Chain-linking defect — structural short-gold exposure",
    detail:
      "Engine uses a fixed-base Laspeyres index instead of the blueprint's recursive chain-linked formula (§9.2). Gold contributes 99.9% of the GFB numerator by USD notional but only 26% of the reserve. A +50% gold shock crashes RR from 1.10 → 0.83 in 100% of stress runs (0% survival).",
    owner: "CTO",
    deadline: "5 business days",
    status: "open",
  },
  {
    id: "P0-2",
    title: "Redemption priced against P_MTQ, not NAV_t (I6 contradiction)",
    detail:
      "Blueprint §3.4.2 says redeem against GFB index; §19.1/§19.3.2/Invariant I6 say redeem against NAV_t. The implementation chose P_MTQ (arbitrage-safe). Blueprint text must be reconciled — internally contradictory on the second-most-important invariant.",
    owner: "COO + CTO",
    deadline: "5 business days",
    status: "open",
  },
  {
    id: "P0-3",
    title: "Only 5 of 6 risk states — S3 STRESS (1.02 ≤ RR < 1.05) missing",
    detail:
      "Blueprint §21.2 specifies SIX states; engine + contract have FIVE. S3 STRESS is collapsed into DEFENSIVE — redemers are overcharged 2× fee (1.00% instead of 0.50%) under moderate stress.",
    owner: "CTO",
    deadline: "3 business days",
    status: "open",
  },
  {
    id: "P0-4",
    title: "DAO governance has 1 of 4 layers (only Monetary 48h timelock)",
    detail:
      "Blueprint §22.3 specifies FOUR layers (Constitutional 90d 7/7 / Monetary 48h DAO / Risk 24h 4/7 / Emergency instant 4/7). Contract implements ONE. Bit 9 (daoGovernance) in getHonestStatus() is overstated.",
    owner: "COO + governance counsel",
    deadline: "20 business days",
    status: "open",
  },
];

/* ---------- 0x7FF honesty verdict (bit-by-bit) ---------- */

interface BitVerdict {
  bit: number;
  name: string;
  claimed: boolean;
  actuallyImplemented: boolean;
  honest: boolean;
  note: string;
}

const BIT_VERDICTS: BitVerdict[] = [
  { bit: 0, name: "basketHas7Components", claimed: true, actuallyImplemented: true, honest: true, note: "All 7 components in getGFB numerator" },
  { bit: 1, name: "goldIsFirstClassIndex", claimed: true, actuallyImplemented: true, honest: true, note: "Gold in numerator" },
  { bit: 2, name: "chfIsFirstClassIndex", claimed: true, actuallyImplemented: true, honest: true, note: "CHF in numerator" },
  { bit: 3, name: "chainLinkedIndex", claimed: true, actuallyImplemented: false, honest: false, note: "OVERSTATED — fixed-base Laspeyres, not recursive (P0-1)" },
  { bit: 4, name: "maseWeightRegistry", claimed: true, actuallyImplemented: false, honest: false, note: "OVERSTATED — weights committed but never consumed by getGFB (C1)" },
  { bit: 5, name: "admissibilityEnvelopes", claimed: true, actuallyImplemented: true, honest: true, note: "commitWeights reverts on envelope breach" },
  { bit: 6, name: "marpExecution", claimed: true, actuallyImplemented: false, honest: false, note: "OVERSTATED — executeRebalance exists but §10 6-level hierarchy not enforced; RR<1.05 override missing (C4)" },
  { bit: 7, name: "assetRegistry", claimed: true, actuallyImplemented: true, honest: true, note: "IAssetRegistry adapter interface" },
  { bit: 8, name: "multiSourceOracle", claimed: true, actuallyImplemented: true, honest: true, note: "3 adapters, §9.2 validation, §9.3 consensus" },
  { bit: 9, name: "daoGovernance", claimed: true, actuallyImplemented: false, honest: false, note: "OVERSTATED — only Monetary 48h tier (1 of 4 layers) (P0-4)" },
  { bit: 10, name: "honestStatusExposed", claimed: true, actuallyImplemented: true, honest: true, note: "This function exists" },
];

const HONEST_MASK = "0x5A7"; // audit-verified (7 of 11 bits truly implemented)
const CLAIMED_MASK = "0x7FF"; // contract's overstatement

/* ---------- Stress test headline results ---------- */

interface StressResult {
  id: string;
  scenario: string;
  survival: number;
  target: number;
  verdict: "PASS" | "PARTIAL" | "FAIL" | "CATASTROPHIC";
}

const STRESS_HEADLINE: StressResult[] = [
  { id: "S5", scenario: "Gold +50% shock (§23.8.1)", survival: 0.0, target: 95, verdict: "CATASTROPHIC" },
  { id: "S3", scenario: "Cauchy fat-tailed (§23.5)", survival: 35.1, target: 85, verdict: "FAIL" },
  { id: "S4", scenario: "Regime-switching (§23.5)", survival: 57.3, target: 90, verdict: "FAIL" },
  { id: "S2", scenario: "Parametric Gaussian (§23.5)", survival: 84.4, target: 99, verdict: "FAIL" },
  { id: "S1", scenario: "Historical block bootstrap (§23.5)", survival: 89.0, target: 95, verdict: "PARTIAL" },
  { id: "S6", scenario: "Gold -30% shock (§23.8.1)", survival: 100.0, target: 95, verdict: "PASS" },
  { id: "S7", scenario: "Oracle disagreement (§23.8.5)", survival: 100.0, target: 100, verdict: "PASS" },
  { id: "S8", scenario: "EUR -10% depeg + eject ladder (§23.9)", survival: 100.0, target: 100, verdict: "PASS" },
  { id: "S9", scenario: "Redemption run, 1000 redemptions (§23.10)", survival: 100.0, target: 100, verdict: "PASS" },
  { id: "S10", scenario: "Reserve stress equation combined (§23.11)", survival: 100.0, target: 100, verdict: "PASS" },
  { id: "S11", scenario: "Parameter perturbation (§23.6)", survival: 51.5, target: 90, verdict: "PARTIAL" },
];

/* ---------- Verdict color helpers ---------- */

function verdictTone(v: StressResult["verdict"]): "emerald" | "amber" | "rose" {
  if (v === "PASS") return "emerald";
  if (v === "PARTIAL") return "amber";
  return "rose";
}

function verdictText(v: StressResult["verdict"]): string {
  return v;
}

/* ---------- The component ---------- */

export function AuditFindings() {
  const claimedCount = BIT_VERDICTS.filter((b) => b.claimed).length;
  const honestCount = BIT_VERDICTS.filter((b) => b.honest).length;
  const overstatedCount = claimedCount - honestCount;
  const failedStressCount = STRESS_HEADLINE.filter((s) => s.verdict === "FAIL" || s.verdict === "CATASTROPHIC").length;
  const partialStressCount = STRESS_HEADLINE.filter((s) => s.verdict === "PARTIAL").length;
  const passedStressCount = STRESS_HEADLINE.filter((s) => s.verdict === "PASS").length;

  return (
    <Reveal>
      <Panel className="p-5 sm:p-6 mtqs-glow">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-start gap-3 mb-2">
            <ShieldAlert className="h-5 w-5 text-mtqs-rose/80 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-rose/75">
                Honest · Top-Tier Audit Findings
              </div>
              <h3 className="mt-1 text-base font-semibold text-foreground/95">
                v1.0 Master Blueprint — Multi-Disciplinary Audit (Final Grade 65/100)
              </h3>
            </div>
          </div>
          <p className="text-[0.78rem] text-muted-foreground/85 leading-relaxed pl-8">
            The audit was conducted in 4 parallel streams (static code, smart contract, stress tests, tokenomics) —
            3,111 lines across 5 reports. The protocol is honestly a <span className="text-amber-200/90 font-medium">strong pilot</span>,
            <span className="text-mtqs-rose/90 font-medium"> NOT production-authorized</span>. The 4 P0 findings below
            must be fixed before any mainnet deployment. The full audit is at{" "}
            <span className="font-mono text-amber-200/90">audit-work/FINAL-TOP-TIER-AUDIT-REPORT.md</span>.
          </p>
        </div>

        {/* Summary chips */}
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <Pill tone="rose">
            <ShieldAlert className="h-3 w-3" aria-hidden="true" />
            4 P0 findings (open)
          </Pill>
          <Pill tone="rose">6 Critical contract findings</Pill>
          <Pill tone="amber">8 High contract findings</Pill>
          <Pill tone="rose">{failedStressCount} stress tests FAIL</Pill>
          <Pill tone="amber">{partialStressCount} PARTIAL</Pill>
          <Pill tone="emerald">{passedStressCount} PASS</Pill>
          <Pill tone="rose">
            0x7FF → {HONEST_MASK} (overstated by {overstatedCount} bits)
          </Pill>
        </div>

        {/* P0 findings list */}
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <FileWarning className="h-4 w-4 text-mtqs-rose/80" aria-hidden="true" />
            <h4 className="text-sm font-semibold text-foreground/90">P0 findings — must fix before mainnet</h4>
          </div>
          <div className="space-y-2.5">
            {P0_FINDINGS.map((f, i) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                className="rounded-md border border-mtqs-rose/30 bg-mtqs-rose/[0.04] p-3"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs text-mtqs-rose/90 font-semibold shrink-0 mt-0.5">
                      {f.id}
                    </span>
                    <div className="text-[0.82rem] font-semibold text-foreground/95 leading-snug">
                      {f.title}
                    </div>
                  </div>
                  <Pill tone="rose" className="shrink-0 text-[0.55rem]">
                    open
                  </Pill>
                </div>
                <p className="text-[0.72rem] text-muted-foreground/85 leading-relaxed mb-1.5">
                  {f.detail}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-muted-foreground/70 font-mono">
                  <span>
                    <span className="text-mtqs-gold/80">owner:</span> {f.owner}
                  </span>
                  <span>
                    <span className="text-mtqs-gold/80">deadline:</span> {f.deadline}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* 0x7FF honesty verdict table */}
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <GlowDot color="rose" size="h-2 w-2" />
            <h4 className="text-sm font-semibold text-foreground/90">
              0x7FF honest mask — bit-by-bit audit verdict
            </h4>
          </div>
          <p className="text-[0.72rem] text-muted-foreground/80 mb-2 leading-relaxed">
            The contract claims <span className="font-mono text-amber-200/90">{CLAIMED_MASK}</span> (all 11 bits). The audit
            verified only <span className="font-mono text-emerald-200/90">{HONEST_MASK}</span> ({honestCount} of 11 bits
            truly implemented). <span className="text-mtqs-rose/90 font-medium">{overstatedCount} bits are OVERSTATED</span>{" "}
            and must either be earned by fixing the underlying implementations or downgraded in{" "}
            <span className="font-mono text-amber-200/90">getHonestStatus()</span>.
          </p>
          <div className="overflow-hidden rounded-md border border-white/[0.07]">
            <div className="hidden sm:grid grid-cols-[44px_minmax(0,1.5fr)_minmax(0,2fr)_80px] gap-2 px-3 py-2 bg-white/[0.03] text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/70">
              <div>Bit</div>
              <div>Name</div>
              <div>Audit Note</div>
              <div>Verdict</div>
            </div>
            <div className="max-h-72 overflow-y-auto mtqs-scroll">
              {BIT_VERDICTS.map((b, i) => (
                <div
                  key={b.bit}
                  className={`border-t border-white/[0.05] px-3 py-2 ${i % 2 ? "bg-white/[0.01]" : ""} ${
                    b.honest
                      ? "border-l-2 border-l-mtqs-emerald/40"
                      : "border-l-2 border-l-mtqs-rose/50"
                  }`}
                >
                  <div className="hidden sm:grid grid-cols-[44px_minmax(0,1.5fr)_minmax(0,2fr)_80px] gap-2 items-center">
                    <div className="font-mono text-[0.7rem] text-muted-foreground/70">{b.bit}</div>
                    <div className="font-mono text-[0.72rem] text-foreground/90">{b.name}</div>
                    <div className="text-[0.68rem] text-muted-foreground/85 leading-snug">{b.note}</div>
                    <div>
                      {b.honest ? (
                        <Pill tone="emerald" className="text-[0.55rem]">honest</Pill>
                      ) : (
                        <Pill tone="rose" className="text-[0.55rem]">overstated</Pill>
                      )}
                    </div>
                  </div>
                  {/* Mobile */}
                  <div className="sm:hidden space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[0.65rem] text-muted-foreground/60">bit {b.bit}</span>
                      <span className="font-mono text-[0.72rem] text-foreground/90">{b.name}</span>
                      {b.honest ? (
                        <Pill tone="emerald" className="text-[0.5rem] ml-auto">honest</Pill>
                      ) : (
                        <Pill tone="rose" className="text-[0.5rem] ml-auto">overstated</Pill>
                      )}
                    </div>
                    <div className="text-[0.68rem] text-muted-foreground/85 leading-snug">{b.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stress test headline */}
        <div className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <GlowDot color="amber" size="h-2 w-2" />
            <h4 className="text-sm font-semibold text-foreground/90">
              Stress tests — §23 validation program (11 scenarios, 18,450 trajectories)
            </h4>
          </div>
          <div className="overflow-hidden rounded-md border border-white/[0.07]">
            <div className="hidden sm:grid grid-cols-[44px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 px-3 py-2 bg-white/[0.03] text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/70">
              <div>#</div>
              <div>Scenario</div>
              <div>Survival</div>
              <div>Target</div>
              <div>Verdict</div>
            </div>
            <div className="max-h-80 overflow-y-auto mtqs-scroll">
              {STRESS_HEADLINE.map((s, i) => (
                <div
                  key={s.id}
                  className={`border-t border-white/[0.05] px-3 py-2 ${i % 2 ? "bg-white/[0.01]" : ""} ${
                    s.verdict === "PASS"
                      ? "border-l-2 border-l-mtqs-emerald/40"
                      : s.verdict === "PARTIAL"
                      ? "border-l-2 border-l-mtqs-amber/40"
                      : "border-l-2 border-l-mtqs-rose/50"
                  }`}
                >
                  <div className="hidden sm:grid grid-cols-[44px_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 items-center">
                    <div className="font-mono text-[0.7rem] text-muted-foreground/70">{s.id}</div>
                    <div className="text-[0.74rem] text-foreground/90 leading-snug">{s.scenario}</div>
                    <div className="font-mono text-[0.74rem] tabular-nums text-foreground/90">
                      {s.survival.toFixed(1)}%
                    </div>
                    <div className="font-mono text-[0.72rem] tabular-nums text-muted-foreground/70">
                      ≥ {s.target}%
                    </div>
                    <div>
                      <Pill tone={verdictTone(s.verdict)} className="text-[0.55rem]">
                        {verdictText(s.verdict)}
                      </Pill>
                    </div>
                  </div>
                  {/* Mobile */}
                  <div className="sm:hidden space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[0.65rem] text-muted-foreground/60">{s.id}</span>
                      <span className="text-[0.74rem] text-foreground/90 leading-snug flex-1">{s.scenario}</span>
                      <Pill tone={verdictTone(s.verdict)} className="text-[0.5rem]">
                        {verdictText(s.verdict)}
                      </Pill>
                    </div>
                    <div className="font-mono text-[0.7rem] tabular-nums text-muted-foreground/80">
                      survival {s.survival.toFixed(1)}% · target ≥ {s.target}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer with link to full report */}
        <div className="rounded-md border border-mtqs-gold/25 bg-mtqs-gold/[0.04] p-3.5">
          <div className="flex items-start gap-2.5">
            <FileText className="h-4 w-4 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="text-[0.74rem] text-muted-foreground/90 leading-relaxed space-y-1">
              <p>
                <span className="text-mtqs-gold/90 font-medium">Full audit report</span> — 5 documents, 3,111 lines:
              </p>
              <ul className="ml-4 space-y-0.5 font-mono text-[0.68rem] text-amber-200/80">
                <li>audit-work/FINAL-TOP-TIER-AUDIT-REPORT.md (347 lines, synthesis)</li>
                <li>audit-work/audit-a-static-code.md (453 lines, engine vs blueprint)</li>
                <li>audit-work/audit-b-smart-contract.md (1198 lines, MTQSigmaV2.sol)</li>
                <li>audit-work/audit-c-stress-tests.md (461 lines, §23 validation)</li>
                <li>audit-work/audit-d-tokenomics.md (652 lines, CFO view)</li>
                <li>audit-work/COO-RECOMMENDATIONS.md (COO action plan)</li>
              </ul>
              <p className="pt-1.5">
                <span className="text-mtqs-gold/90 font-medium">COO verdict:</span> Fix the 4 P0 findings in the next 30 days,
                re-run §23 in the next 90 days, engage an independent audit firm in parallel. Do not sign off on mainnet
                until all 5 production-readiness gates pass. The protocol is honestly a strong pilot, and the audit is
                the cheapest insurance we will ever buy.
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </Reveal>
  );
}
