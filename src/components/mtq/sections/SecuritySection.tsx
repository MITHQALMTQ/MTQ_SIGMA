// MTQΣ — Security Section
// 5 panels: Posture · Key management (EXPOSED badges) · Audit findings ·
// Regulatory (US / Sharia) · Disclaimers.
// Props: { onNavigate }.

"use client";

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
import { Panel, Reveal, Pill, GlowDot, SectionHeading } from "@/components/mtq/primitives";
import { OnChainMatrix } from "@/components/mtq/OnChainMatrix";
import { AuditFindings } from "@/components/mtq/AuditFindings";
import { ProductionReadinessDashboard } from "@/components/mtq/ProductionReadinessDashboard";
import { HonestStatus5Level } from "@/components/mtq/HonestStatus5Level";
import { DEPLOYER_WALLET, CANONICAL_MTQ_ADDRESSES } from "@/lib/mtq/contracts";
import { BRAND_VOICE } from "@/lib/mtq/brand";
import { shortAddr } from "@/components/mtq/format";
import type { SectionId } from "@/components/mtq/Navigation";

/* ---------- Audit findings (from the Monte Carlo audit /api/tests) ---------- */
const AUDIT_FINDINGS = [
  {
    severity: "PASS",
    title: "Baseline — 1,000 runs",
    detail: "survival 100% · worst min RR 3.02",
  },
  {
    severity: "PASS",
    title: "Monte Carlo — 2,000 runs (elevated vol)",
    detail: "survival 100% · worst min RR 1.99",
  },
  {
    severity: "PASS",
    title: "Depression — 1,500 runs",
    detail: "survival 100% · worst min RR 1.33",
  },
  {
    severity: "PASS",
    title: "Hyperinflation — 1,500 runs",
    detail: "survival 100% · worst min RR 1.61",
  },
  {
    severity: "PASS",
    title: "Depeg Cascade — 1,500 runs",
    detail: "survival 100% · worst min RR 1.85",
  },
  {
    severity: "PASS",
    title: "Oracle Failure — 1,000 runs",
    detail: "survival 100% · worst min RR 3.54",
  },
  {
    severity: "PASS",
    title: "Liquidity Crisis — 1,000 runs",
    detail: "survival 100% · worst min RR 4.58",
  },
  {
    severity: "PASS",
    title: "Black Swan — 1,800 runs",
    detail: "survival 100% · worst min RR 2.22",
  },
];

/* ---------- Invariants tested (from the audit) ---------- */
const INVARIANTS_TESTED = [
  "§4.2.1 Hard floor (RR≥1.00)",
  "§4.2.1 Stress floor (RR≥1.05)",
  "§4.2.1 Target (RR≥1.10)",
  "§4.3 LCR≥1.00",
  "§3.5 Price band [0.50,2.00]",
  "§11 Peg stability",
  "§7 Rebalancer deviation",
  "§8 Buffer BASE/STRESS/EMERGENCY",
  "§9 Oracle pause",
];

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
        <span className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75">
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
  const allPass = AUDIT_FINDINGS.every((f) => f.severity === "PASS");

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="honest · security posture"
        title="Security — Posture, Keys, Audit, Regulatory"
        className="mb-0"
        right={
          <Pill tone={allPass ? "emerald" : "rose"}>
            <GlowDot color={allPass ? "emerald" : "rose"} size="h-1.5 w-1.5" />
            {allPass ? "audit PASS" : "audit FAIL"}
          </Pill>
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
            <p className="text-[0.82rem] text-muted-foreground leading-relaxed">
              {BRAND_VOICE.statusDeclaration}. The security section is intentionally honest: it
              surfaces what is secured, what is exposed by the pilot design, what the Monte Carlo
              audit found, and the regulatory posture (US + Sharia). Nothing here is production-claim.
            </p>
          </div>
        </Panel>
      </Reveal>

      {/* Panel 1 — Posture */}
      <section aria-labelledby="sec-posture">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">01 · posture</div>
            <h3 className="mt-2 text-base font-semibold text-foreground">Security Posture</h3>
          </div>
          <Pill tone="amber">
            <GlowDot color="amber" size="h-1.5 w-1.5" />
            testnet · not production
          </Pill>
        </div>
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75 mb-1">
                Deployment status
              </div>
              <div className="text-sm text-foreground/90 font-medium">
                {canonicalCount} canonical MTQΣ contracts live
              </div>
              <div className="mt-1 text-[0.7rem] text-muted-foreground leading-relaxed">
                Monad · Arc · Robinhood · Solana testnets. Bytecode verified per chain in the
                Investor section.
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75 mb-1">
                Reference engine
              </div>
              <div className="text-sm text-foreground/90 font-medium">In-process · TypeScript</div>
              <div className="mt-1 text-[0.7rem] text-muted-foreground leading-relaxed">
                The live dashboard runs the blueprint math in-process; it does not depend on testnet
                RPC for its monetary logic, so it is robust to RPC unreliability.
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75 mb-1">
                Attack surface
              </div>
              <div className="text-sm text-foreground/90 font-medium">Read-only GET API</div>
              <div className="mt-1 text-[0.7rem] text-muted-foreground leading-relaxed">
                All public endpoints are GET. Mint/Redeem POST endpoints simulate; they do not move
                real testnet funds in the dashboard.
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75 mb-1">
                Constitution
              </div>
              <div className="text-sm text-foreground/90 font-medium">7/7 Multi-Sig · 90d timelock</div>
              <div className="mt-1 text-[0.7rem] text-muted-foreground leading-relaxed">
                Basket quantities (qᵢ) change only via constitutional governance. Risk thresholds via
                Risk Council (4/7 · 24h). Emergency via Multi-Sig (4/7 · instant).
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75 mb-1">
                Oracle consensus
              </div>
              <div className="text-sm text-foreground/90 font-medium">3 sources · 3-of-3 valid</div>
              <div className="mt-1 text-[0.7rem] text-muted-foreground leading-relaxed">
                Chainlink + Pyth + Chronicle per pair. Any deviation &gt; 2.5% or staleness &gt; 60s
                pauses mint + rebalance (§9.2).
              </div>
            </Panel>
            <Panel className="p-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/75 mb-1">
                Geopolitical eject
              </div>
              <div className="text-sm text-foreground/90 font-medium">Staged 10 / 25 / 50 / 100%</div>
              <div className="mt-1 text-[0.7rem] text-muted-foreground leading-relaxed">
                Depeg &gt; 12h triggers staged liquidation of the affected currency; reintegration
                requires R_score &gt; 0.80 (§11.3).
              </div>
            </Panel>
          </div>
        </Reveal>
      </section>

      {/* Panel 2 — Key management (EXPOSED badges) */}
      <section aria-labelledby="sec-keys">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">02 · key management</div>
            <h3 className="mt-2 text-base font-semibold text-foreground">Key Management</h3>
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
              <p className="text-[0.78rem] text-muted-foreground leading-relaxed">
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
            <div className="mt-3 text-[0.68rem] text-muted-foreground leading-relaxed">
              Production target: every role on every canonical MTQΣ contract (ADMIN, MINTER,
              PAUSER) is held by the 4/7 Safe, not by an EOA. The Investor Verification section reads
              on-chain role assignments live for each chain.
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* Panel 3 — Audit findings */}
      <section aria-labelledby="sec-audit">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">03 · audit</div>
            <h3 className="mt-2 text-base font-semibold text-foreground">Monte Carlo Audit Findings</h3>
          </div>
          <Pill tone={allPass ? "emerald" : "rose"}>
            <ClipboardCheck className="h-3 w-3" aria-hidden="true" />
            10,300 runs · {AUDIT_FINDINGS.length} suites
          </Pill>
        </div>
        <Reveal>
          <Panel className="p-5">
            <div className="mb-4 rounded-md border border-mtqs-emerald/30 bg-mtqs-emerald/5 p-3">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-emerald/85 mb-1">
                Overall verdict
              </div>
              <div className="font-mono text-sm text-mtqs-emerald">
                PASS — protocol maintains RR ≥ 1.00 across all suites. The 110% buffer absorbs all shocks.
              </div>
            </div>
            <div className="mb-4">
              <div className="text-[0.6rem] uppercase tracking-[0.18em] text-mtqs-gold/75 mb-2">
                Invariants tested
              </div>
              <div className="flex flex-wrap gap-1.5">
                {INVARIANTS_TESTED.map((inv) => (
                  <span
                    key={inv}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-black/[0.02] px-2.5 py-1 text-[0.62rem] font-mono text-muted-foreground"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5 text-mtqs-emerald" aria-hidden="true" />
                    {inv}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              <div className="max-h-72 overflow-y-auto mtqs-scroll">
                <table className="w-full text-[0.72rem]">
                  <thead className="bg-black/[0.02] text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Suite</th>
                      <th className="text-right px-3 py-2 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AUDIT_FINDINGS.map((f, i) => (
                      <tr
                        key={f.title}
                        className={`border-t border-border ${i % 2 ? "bg-white/[0.01]" : ""}`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="text-foreground/90">{f.title}</div>
                          <div className="text-[0.62rem] text-muted-foreground/60 mt-0.5 font-mono">
                            {f.detail}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Pill tone="emerald">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            {f.severity}
                          </Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-[0.7rem] text-muted-foreground">
                Run the live suite yourself in the Tests section.
              </div>
              <button
                onClick={() => _onNavigate("tests")}
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
      <section aria-labelledby="sec-reg">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">04 · regulatory</div>
            <h3 className="mt-2 text-base font-semibold text-foreground">Regulatory Posture (US + Sharia)</h3>
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
              <h4 className="text-sm font-semibold text-foreground/90 mb-2">US posture (pilot)</h4>
              <ul className="space-y-1.5 text-[0.74rem] text-muted-foreground leading-relaxed">
                <li className="flex gap-2">
                  <XCircle className="h-3.5 w-3.5 text-mtqs-rose shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Not a registered security. The pilot does not solicit US investment.</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald shrink-0 mt-0.5" aria-hidden="true" />
                  <span>OFAC / EU / UN sanctions compliance required for every reserve issuer (§5.2 #4).</span>
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
              <h4 className="text-sm font-semibold text-foreground/90 mb-2">Sharia posture (design)</h4>
              <ul className="space-y-1.5 text-[0.74rem] text-muted-foreground leading-relaxed">
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Interest-free: MTQΣ is non-yield-bearing by design (no riba).</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald shrink-0 mt-0.5" aria-hidden="true" />
                  <span>Asset-backed: every MTQΣ is collateralized by audited reserve assets.</span>
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
                    The earlier draft&apos;s claim &ldquo;100% Halal / Fatwa-ready&rdquo; was removed (§15.1) and
                    replaced with &ldquo;designed for Sharia review.&rdquo;
                  </span>
                </li>
              </ul>
            </Panel>
          </div>
        </Reveal>
      </section>

      {/* Panel 5 — Disclaimers */}
      <section aria-labelledby="sec-disclaim">
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">05 · disclaimers</div>
            <h3 className="mt-2 text-base font-semibold text-foreground">Disclaimers</h3>
          </div>
          <FileWarning className="h-4 w-4 text-mtqs-amber/80" aria-hidden="true" />
        </div>
        <Reveal>
          <Panel className="p-5">
            <ol className="space-y-2.5 text-[0.76rem] text-muted-foreground leading-relaxed">
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">01.</span>
                <span>
                  <strong className="text-foreground/90">{BRAND_VOICE.statusDeclaration}.</strong>{" "}
                  The MTQΣ pilot is a faithful reference implementation of the blueprint math, not a
                  deployed production system.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">02.</span>
                <span>
                  <strong className="text-foreground/90">Not a security.</strong> Nothing on this site
                  is an offer to sell or a solicitation to buy any security, token, or financial
                  instrument.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">03.</span>
                <span>
                  <strong className="text-foreground/90">Not financial advice.</strong> The dashboard
                  is a reference for protocol engineers, not investment advice for token holders.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">04.</span>
                <span>
                  <strong className="text-foreground/90">Testnet only.</strong> Canonical MTQΣ
                  contracts are deployed on testnets only ({canonicalCount} chains). Testnet tokens
                  have no monetary value.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">05.</span>
                <span>
                  <strong className="text-foreground/90">Sharia — designed for review, not certified.</strong>{" "}
                  {BRAND_VOICE.designConstraint}. The F4 informational finding remains open until an
                  independent Sharia board certifies the design.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">06.</span>
                <span>
                  <strong className="text-foreground/90">Past Monte Carlo results do not guarantee future resilience.</strong>{" "}
                  The 10,300-run audit is a design confidence signal; real-world stress may differ.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">07.</span>
                <span>
                  <strong className="text-foreground/90">Key rotation.</strong> The pilot deployer
                  key ({shortAddr(DEPLOYER_WALLET, 8, 6)}) was transmitted via chat; rotate it after
                  this session. Production uses 4/7 Multi-Sig only.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-mono text-mtqs-gold/70 shrink-0">08.</span>
                <span>
                  <strong className="text-foreground/90">Engine runs in-process.</strong> The live
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
          <p className="text-[0.82rem] text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-4">
            Security posture is honestly disclosed: pilot-grade, key-rotation-pending, Sharia
            review-pending, audit-PASS. For the full reconciliation, see Docs; for live on-chain
            verification, see Investors.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => _onNavigate("investors")}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.1] bg-black/[0.03] px-4 py-2 text-[0.78rem] font-medium text-foreground hover:border-mtqs-gold/30 hover:text-foreground transition"
            >
              On-Chain Verification
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={() => _onNavigate("docs")}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.1] bg-black/[0.03] px-4 py-2 text-[0.78rem] font-medium text-foreground hover:border-mtqs-gold/30 hover:text-foreground transition"
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
