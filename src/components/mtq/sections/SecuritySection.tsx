// MTQΣ — Security Section
// 5 panels: Posture · Key management (EXPOSED badges) · Audit findings ·
// Regulatory (US / Sharia) · Disclaimers.
// Props: { onNavigate }.

"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  KeyRound,
  ClipboardCheck,
  Scale,
  FileWarning,
  AlertOctagon,
  CheckCircle2,
  XCircle,
  ArrowRight,
} from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading, Skeleton } from "@/components/mtq/primitives";
import { OnChainMatrix } from "@/components/mtq/OnChainMatrix";
import { AuditFindings } from "@/components/mtq/AuditFindings";
import { ProductionReadinessDashboard } from "@/components/mtq/ProductionReadinessDashboard";
import { HonestStatus5Level } from "@/components/mtq/HonestStatus5Level";
import { DEPLOYER_WALLET, CANONICAL_MTQ_ADDRESSES } from "@/lib/mtq/contracts";
import { BRAND_VOICE } from "@/lib/mtq/brand";
import { shortAddr } from "@/components/mtq/format";
import type { SectionId } from "@/components/mtq/Navigation";

/* ---------- Monte Carlo audit — fetched LIVE from /api/tests ---------- */
interface AuditFinding {
  severity: string;
  title: string;
  detail: string;
}
interface Audit {
  title: string;
  generatedAt: string;
  totalRuns: number;
  overallVerdict: string;
  invariantsTested: string[];
  findings: AuditFinding[];
}
interface TestsResp {
  suites?: unknown[];
  totalRuns?: number;
  audit?: Audit;
  error?: string;
}

/* Severity → pill tone (PASS → emerald · WARN → amber · FAIL → rose) */
function severityTone(severity: string): "emerald" | "amber" | "rose" {
  const s = (severity ?? "").toUpperCase();
  if (s === "PASS") return "emerald";
  if (s === "WARN") return "amber";
  return "rose";
}

/* ---------- EXPOSED badge (key management) ---------- */
function ExposedBadge({ label, value, exposed }: { label: string; value: string; exposed: boolean }) {
  return (
    <div
      className={`rounded-md border p-3 ${
        exposed
          ? "border-mtqs-rose/40 bg-mtqs-rose/5"
          : "border-mtqs-emerald/40 bg-mtqs-emerald/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[0.6rem] uppercase tracking-[0.18em] text-white/75">
          {label}
        </span>
        {exposed ? (
          <Pill tone="rose">
            <AlertOctagon className="h-3 w-3" aria-hidden="true" />
            EXPOSED
          </Pill>
        ) : (
          <Pill tone="emerald">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            secured
          </Pill>
        )}
      </div>
      <div className="font-mono text-[0.72rem] text-mtqs-gold break-all">{value}</div>
    </div>
  );
}

export function SecuritySection({ onNavigate: _onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const canonicalCount = Object.keys(CANONICAL_MTQ_ADDRESSES).length;

  // Live Monte Carlo audit (/api/tests) — no hardcoded findings or verdict.
  const [audit, setAudit] = useState<Audit | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const load = async () => {
      try {
        const res = await fetch("/api/tests", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as TestsResp;
        if (!json.audit) throw new Error("audit missing from /api/tests response");
        if (mountedRef.current) {
          setAudit(json.audit);
          setAuditError(null);
        }
      } catch (e) {
        if (mountedRef.current) setAuditError(String(e).slice(0, 200));
      } finally {
        if (mountedRef.current) setAuditLoading(false);
      }
    };
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const findings = audit?.findings ?? [];
  const invariants = audit?.invariantsTested ?? [];
  const totalRuns = audit?.totalRuns ?? 0;
  const verdict = audit?.overallVerdict ?? null;
  const isPass = (verdict ?? "").toUpperCase().startsWith("PASS");
  const allPass = findings.length > 0 && findings.every((f) => f.severity === "PASS");

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="honest · security posture"
        title="Security — Posture, Keys, Audit, Regulatory"
        className="mb-0"
        right={
          auditLoading ? (
            <Pill tone="muted">
              <GlowDot color="gold" size="h-1.5 w-1.5" />
              audit loading…
            </Pill>
          ) : auditError ? (
            <Pill tone="rose">
              <GlowDot color="rose" size="h-1.5 w-1.5" />
              audit unavailable
            </Pill>
          ) : (
            <Pill tone={allPass ? "emerald" : "rose"}>
              <GlowDot color={allPass ? "emerald" : "rose"} size="h-1.5 w-1.5" />
              {allPass ? "audit PASS" : "audit FAIL"}
            </Pill>
          )
        }
      />

      {/* On-Chain vs Off-Chain Implementation Matrix — near top of Security */}
      <OnChainMatrix />

      {/* Top-Tier Audit Findings — second thing, so security-conscious readers see the verdict */}
      <Reveal>
        <AuditFindings />
      </Reveal>

      {/* Production Readiness Dashboard (Deliverable J — §39J) — GREEN/AMBER/RED/BLOCKED for every subsystem */}
      <Reveal>
        <ProductionReadinessDashboard />
      </Reveal>

      {/* 5-Level Honest Status (Master Prompt §22 + §23) — 22 rows: 11 honest-status bits + 11 §25.5 validation gates */}
      <Reveal>
        <HonestStatus5Level />
      </Reveal>

      {/* Intro */}
      <Reveal>
        <Panel className="p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[0.82rem] text-white/55 leading-relaxed">
              {BRAND_VOICE.statusDeclaration}. The security section is intentionally honest: it
              surfaces what is secured, what is exposed by the pilot design, what the Monte Carlo
              audit found, and the regulatory posture (US + Sharia). Nothing here is production-claim.
            </p>
          </div>
        </Panel>
      </Reveal>

      {/* Panel 1 — Posture */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">01 · posture</div>
            <h3 className="mt-2 text-base font-semibold text-white">Security Posture</h3>
          </div>
          <Pill tone="amber">
            <GlowDot color="amber" size="h-1.5 w-1.5" />
            testnet · not production
          </Pill>
        </div>
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/75 mb-1">
                Deployment status
              </div>
              <div className="text-sm text-white/90 font-medium">
                {canonicalCount} canonical MTQΣ contracts live
              </div>
              <div className="mt-1 text-[0.7rem] text-white/55 leading-relaxed">
                Monad · Arc · Robinhood · Solana testnets. Bytecode verified per chain in the
                Investor section.
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/75 mb-1">
                Reference engine
              </div>
              <div className="text-sm text-white/90 font-medium">In-process · TypeScript</div>
              <div className="mt-1 text-[0.7rem] text-white/55 leading-relaxed">
                The live dashboard runs the blueprint math in-process; it does not depend on testnet
                RPC for its monetary logic, so it is robust to RPC unreliability.
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/75 mb-1">
                Attack surface
              </div>
              <div className="text-sm text-white/90 font-medium">Read-only GET API</div>
              <div className="mt-1 text-[0.7rem] text-white/55 leading-relaxed">
                All public endpoints are GET. Mint/Redeem POST endpoints simulate; they do not move
                real testnet funds in the dashboard.
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/75 mb-1">
                Constitution — design target
              </div>
              <div className="text-sm text-white/90 font-medium">7/7 Multi-Sig · 90d timelock</div>
              <div className="mt-1 text-[0.7rem] text-white/55 leading-relaxed">
                <span className="text-mtqs-amber/90">DESIGN TARGET — not current state.</span> The pilot
                Safe is 1/1 deployer-controlled (OD-35 CRITICAL — see Key Management below). Target
                design: basket quantities (qᵢ) change only via constitutional governance. Risk
                thresholds via Risk Council (4/7 · 24h). Emergency via Multi-Sig (4/7 · instant).
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/75 mb-1">
                Oracle consensus — design target
              </div>
              <div className="text-sm text-white/90 font-medium">3 sources · 3-of-3 valid (design)</div>
              <div className="mt-1 text-[0.7rem] text-white/55 leading-relaxed">
                <span className="text-mtqs-amber/90">DESIGN TARGET — not current state.</span> Design:
                Chainlink + Pyth + Chronicle per pair; any deviation &gt; 2.5% or staleness &gt; 60s
                pauses mint + rebalance (§9.2). Current pilot: the runtime board runs off-chain feed
                families only (Frankfurter ECB + gold-api + Yahoo/FRED macro, with synthetic
                witnesses completing the consensus structure — OD-34).
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-white/75 mb-1">
                Geopolitical eject
              </div>
              <div className="text-sm text-white/90 font-medium">Staged 10 / 25 / 50 / 100%</div>
              <div className="mt-1 text-[0.7rem] text-white/55 leading-relaxed">
                Depeg &gt; 12h triggers staged liquidation of the affected currency; reintegration
                requires R_score &gt; 0.80 (§11.3).
              </div>
            </Panel>
          </div>
        </Reveal>
      </section>

      {/* Panel 2 — Key management (EXPOSED badges) */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">02 · key management</div>
            <h3 className="mt-2 text-base font-semibold text-white">Key Management</h3>
          </div>
          <Pill tone="rose">
            <AlertOctagon className="h-3 w-3" aria-hidden="true" />
            pilot · key rotated post-session
          </Pill>
        </div>
        <Reveal>
          <Panel className="p-5">
            <div className="flex items-start gap-3 mb-4">
              <KeyRound className="h-5 w-5 text-mtqs-rose/80 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-[0.78rem] text-white/55 leading-relaxed">
                The pilot was deployed with a single deployer private key (held in .env, gitignored).
                For the pilot this is honestly exposed; for production the protocol requires a 4/7
                Multi-Sig (Safe) on every chain. The key was transmitted via chat and must be rotated
                after this session.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ExposedBadge
                label="Deployer wallet (pilot)"
                value={DEPLOYER_WALLET}
                exposed
              />
              <ExposedBadge
                label="Deployer private key"
                value="server-side .env (gitignored) · rotate post-session"
                exposed
              />
              <ExposedBadge
                label="Multi-Sig (production target)"
                value="Safe · 4/7 threshold · cold treasury"
                exposed={false}
              />
              <ExposedBadge
                label="Oracle keys"
                value="Chainlink + Pyth + Chronicle (3 independent operators)"
                exposed={false}
              />
            </div>
            <div className="mt-3 text-[0.68rem] text-white/55 leading-relaxed">
              Production target: every role on every canonical MTQΣ contract (ADMIN, MINTER,
              PAUSER) is held by the 4/7 Safe, not by an EOA. The Investor Verification section reads
              on-chain role assignments live for each chain.
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* Panel 3 — Audit findings */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">03 · audit</div>
            <h3 className="mt-2 text-base font-semibold text-white">Monte Carlo Audit Findings</h3>
          </div>
          <Pill tone={auditError ? "rose" : allPass ? "emerald" : "rose"}>
            <ClipboardCheck className="h-3 w-3" aria-hidden="true" />
            {auditLoading
              ? "loading…"
              : auditError
              ? "unavailable"
              : `${totalRuns.toLocaleString()} runs · ${findings.length} suites`}
          </Pill>
        </div>
        <Reveal>
          <Panel className="p-5">
            {auditLoading ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ClipboardCheck className="h-4 w-4 text-mtqs-gold animate-pulse" aria-hidden="true" />
                  <span className="text-[0.78rem] text-white/55">
                    Loading Monte Carlo audit from /api/tests…
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-16 rounded-md" />
                  ))}
                </div>
              </div>
            ) : auditError ? (
              <div className="rounded-md border border-mtqs-rose/30 bg-mtqs-rose/5 p-3">
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-mtqs-rose mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <div className="text-sm font-semibold text-white/90 mb-1">
                      Monte Carlo audit data unavailable — nothing is fabricated
                    </div>
                    <div className="font-mono text-[0.72rem] text-mtqs-rose/80">{auditError}</div>
                    <div className="mt-1 text-[0.7rem] text-white/55 leading-relaxed">
                      No findings, invariants, or verdict are shown because the live /api/tests
                      response could not be loaded. Run the suite yourself in the Tests section.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
            <div
              className={`mb-4 rounded-md border p-3 ${
                isPass
                  ? "border-mtqs-emerald/30 bg-mtqs-emerald/5"
                  : "border-mtqs-rose/30 bg-mtqs-rose/5"
              }`}
            >
              <div
                className={`text-[0.6rem] uppercase tracking-[0.22em] mb-1 ${
                  isPass ? "text-mtqs-emerald/85" : "text-mtqs-rose/85"
                }`}
              >
                Overall verdict
              </div>
              <div
                className={`font-mono text-sm ${isPass ? "text-mtqs-emerald" : "text-mtqs-rose"}`}
              >
                {verdict ?? "No verdict available."}
              </div>
            </div>
            <div className="mb-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-mtqs-gold/75 mb-2">
                Invariants tested
              </div>
              <div className="flex flex-wrap gap-1.5">
                {invariants.map((inv) => (
                  <span
                    key={inv}
                    className="inline-flex items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-[0.62rem] font-mono text-white/55"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5 text-mtqs-emerald" aria-hidden="true" />
                    {inv}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-white/[0.06]">
              <div className="max-h-72 overflow-y-auto mtqs-scroll">
                <table className="w-full text-[0.72rem]">
                  <thead className="bg-white/[0.02] text-white/55 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Suite</th>
                      <th className="text-right px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findings.map((f, i) => {
                      const sev = severityTone(f.severity);
                      return (
                        <tr
                          key={f.title + i}
                          className={`border-t border-white/[0.06] ${i % 2 ? "bg-white/[0.01]" : ""}`}
                        >
                          <td className="px-3 py-2.5">
                            <div className="text-white/90">{f.title}</div>
                            <div className="text-[0.62rem] text-white/60 mt-0.5 font-mono">
                              {f.detail}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Pill tone={sev}>
                              {sev === "emerald" ? (
                                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              ) : sev === "amber" ? (
                                <AlertOctagon className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <XCircle className="h-3 w-3" aria-hidden="true" />
                              )}
                              {f.severity}
                            </Pill>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
              </>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-[0.7rem] text-white/55">
                Run the live suite yourself in the Tests section.
              </div>
              <button
                onClick={() => _onNavigate("validation")}
                className="inline-flex items-center gap-1.5 text-[0.75rem] text-mtqs-gold/85 hover:text-mtqs-gold-light transition"
              >
                Open Tests
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* Panel 4 — Regulatory (US / Sharia) */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">04 · regulatory</div>
            <h3 className="mt-2 text-base font-semibold text-white">Regulatory Posture (US + Sharia)</h3>
          </div>
          <Scale className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
        </div>
        <Reveal>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
                  United States
                </span>
              </div>
              <h4 className="text-sm font-semibold text-white/90 mb-2">US posture (pilot)</h4>
              <ul className="space-y-1.5 text-[0.74rem] text-white/55 leading-relaxed">
                <li className="flex gap-2">
                  <XCircle className="h-3.5 w-3.5 text-mtqs-rose shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Not a registered security. The pilot does not solicit US investment.</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    OFAC / EU / UN sanctions compliance required for every reserve issuer on the
                    legacy v1/v2 reserve path (§5.2 #4; the v3.0 no-conventional-reserve objective
                    has no reserve issuers — Gate B open).
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Issuer authorization + redemption right required (§5.2 #1-#2).</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Qualified custody required for tokenized gold (§5.2 #3).</span>
                </li>
                <li className="flex gap-2">
                  <AlertOctagon className="h-3.5 w-3.5 text-mtqs-amber shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Production launch requires US counsel opinion + state money-transmitter analysis.</span>
                </li>
              </ul>
            </Panel>

            <Panel className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
                  Sharia (design)
                </span>
              </div>
              <h4 className="text-sm font-semibold text-white/90 mb-2">Sharia posture (design)</h4>
              <ul className="space-y-1.5 text-[0.74rem] text-white/55 leading-relaxed">
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Interest-free: MTQΣ is non-yield-bearing by design (no riba).</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Asset-referencing: MTQΣ references a real-world asset basket — issued against
                    settled payment under the v3.0 no-conventional-reserve objective (Gate B open).
                    It is NOT collateralized by a reserve; the pilot ledger is simulated (G8) with
                    internal audit only (G1). The legacy v1/v2 path was reserve-collateralized
                    (simulated pilot reserve).
                  </span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Non-speculative: mint/redeem priced against the GFB Index, no leverage.</span>
                </li>
                <li className="flex gap-2">
                  <AlertOctagon className="h-3.5 w-3.5 text-mtqs-amber shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Independent Sharia review board certification is the explicit ask (F4
                    informational finding — see Docs).
                  </span>
                </li>
                <li className="flex gap-2">
                  <XCircle className="h-3.5 w-3.5 text-mtqs-rose shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    The earlier draft&apos;s claim of automatic Sharia compliance was removed (§15.1) and
                    replaced with &ldquo;designed for Sharia review.&rdquo; The design is interest-free,
                    asset-referencing, and non-speculative — independent scholarly review remains the
                    explicit ask (F4 informational finding).
                  </span>
                </li>
              </ul>
              {/* §2.8 Sharia Compliance Roadmap (v1.2 → v2.0) — Task 8-int: the
                  blueprint's 5-phase table (L1933–1977) surfaced verbatim.
                  Until Phase 5 completes, MTQΣ is NOT certified Sharia-compliant. */}
              <div className="mt-4">
                <h5 className="text-[0.78rem] font-semibold text-white/85 mb-1">
                  Compliance roadmap — §2.8 (5 phases, v2.0 verbatim)
                </h5>
                <p className="text-[0.7rem] text-white/45 mb-3">
                  Until Phase 5 is complete, MTQΣ is <span className="text-mtqs-rose">NOT certified</span> as
                  Sharia-compliant. The adaptive-weighting change does not alter this roadmap; it widens the
                  review scope (MASE inputs are non-interest market observables; reserve instrument
                  eligibility remains governed by Chapter 15).
                </p>
                <div className="overflow-hidden rounded-md border border-white/[0.06]">
                  <table className="w-full text-[0.7rem]">
                    <thead className="bg-white/[0.03] text-white/55">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Phase</th>
                        <th className="text-left px-3 py-2 font-medium">Timeline</th>
                        <th className="text-left px-3 py-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["1", "Q4 2026", "Engage an independent Sharia advisory firm with AAOIFI-qualified scholars."],
                        ["2", "Q1 2027", "Complete a full review of all reserve assets (USDC, EURC, PAXG, XAUT and any successor instruments admitted under Chapter 15) and their custody structures."],
                        ["3", "Q2 2027", "Publish a fatwa confirming the protocol's compliance or identify necessary changes."],
                        ["4", "Q3 2027", "Implement any required changes (e.g., replacing USDC with a Sharia-certified stablecoin)."],
                        ["5", "Q4 2027", "Update the honest status to reflect the certification."],
                      ].map(([phase, timeline, action], i) => (
                        <tr key={phase} className={`border-t border-white/[0.06] ${i % 2 ? "bg-white/[0.02]" : ""}`}>
                          <td className="px-3 py-2 font-mono text-mtqs-gold">{phase}</td>
                          <td className="px-3 py-2 text-white/75 whitespace-nowrap">{timeline}</td>
                          <td className="px-3 py-2 text-white/55">{action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>
          </div>
        </Reveal>
      </section>

      {/* Panel 5 — Disclaimers */}
      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">05 · disclaimers</div>
            <h3 className="mt-2 text-base font-semibold text-white">Disclaimers</h3>
          </div>
          <FileWarning className="h-4 w-4 text-mtqs-amber/80" aria-hidden="true" />
        </div>
        <Reveal>
          <Panel className="p-5">
            <ol className="space-y-2.5 text-[0.76rem] text-white/55 leading-relaxed">
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">01.</span>
                <span>
                  <strong className="text-white/90">{BRAND_VOICE.statusDeclaration}.</strong>{" "}
                  The MTQΣ pilot is a faithful reference implementation of the blueprint math, not a
                  deployed production system.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">02.</span>
                <span>
                  <strong className="text-white/90">Not a security.</strong> Nothing on this site
                  is an offer to sell or a solicitation to buy any security, token, or financial
                  instrument.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">03.</span>
                <span>
                  <strong className="text-white/90">Not financial advice.</strong> The dashboard
                  is a reference for protocol engineers, not investment advice for token holders.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">04.</span>
                <span>
                  <strong className="text-white/90">Testnet only.</strong> Canonical MTQΣ
                  contracts are deployed on testnets only ({canonicalCount} chains). Testnet tokens
                  have no monetary value.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">05.</span>
                <span>
                  <strong className="text-white/90">Sharia — designed for review, not certified.</strong>{" "}
                  {BRAND_VOICE.designConstraint}. The F4 informational finding remains open until an
                  independent Sharia board certifies the design.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">06.</span>
                <span>
                  <strong className="text-white/90">Past Monte Carlo results do not guarantee future resilience.</strong>{" "}
                  The {totalRuns > 0 ? `${totalRuns.toLocaleString()}-run ` : ""}Monte Carlo audit is a
                  design confidence signal; real-world stress may differ.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">07.</span>
                <span>
                  <strong className="text-white/90">Key rotation.</strong> The pilot deployer
                  key ({shortAddr(DEPLOYER_WALLET, 8, 6)}) was transmitted via chat; rotate it after
                  this session. Production uses 4/7 Multi-Sig only.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">08.</span>
                <span>
                  <strong className="text-white/90">Engine runs in-process.</strong> The live
                  dashboard computes the blueprint math in-process for robustness; it does not read
                  on-chain state from the canonical contracts. The Investor section reads on-chain
                  metadata (bytecode, name/symbol/decimals, roles) separately.
                </span>
              </li>
            </ol>
          </Panel>
        </Reveal>
      </section>

      {/* Closing */}
      <Reveal>
        <Panel className="p-5 sm:p-6 text-center">
          <p className="text-[0.82rem] text-white/55 leading-relaxed max-w-2xl mx-auto mb-4">
            Security posture is honestly disclosed: pilot-grade, key-rotation-pending, Sharia
            review-pending, audit-PASS. For the full reconciliation, see Docs; for live on-chain
            verification, see Investors.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => _onNavigate("investors")}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-[0.78rem] font-medium text-white hover:border-mtqs-gold/30 hover:text-white transition"
            >
              On-Chain Verification
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={() => _onNavigate("docs")}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-[0.78rem] font-medium text-white hover:border-mtqs-gold/30 hover:text-white transition"
            >
              Reconciliation Docs
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
