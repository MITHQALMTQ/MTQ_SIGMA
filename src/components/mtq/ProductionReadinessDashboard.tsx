// MTQΣ — Production Readiness Dashboard (Deliverable J — Master Prompt §39J)
// =========================================================================
//
// Per Master Prompt §39J, the dashboard shows GREEN / AMBER / RED / BLOCKED
// for each subsystem, with the evidence (file + test reference) that backs
// each verdict. It is the single source of truth for the protocol's
// production-readiness state.
//
// Color system (per task spec):
//   GREEN  = emerald Pill + CheckCircle2   → IMPLEMENTED + TESTED
//   AMBER  = amber Pill + AlertTriangle     → PARTIAL / SPECIFIED / REQUIRES EVIDENCE
//   RED    = rose Pill + XCircle            → NOT DONE (external dependency)
//   BLOCKED = muted Pill + Lock             → NOT DONE (blocked by external gate)
//
// Grouping:
//   - Architecture (4 items)
//   - Implementation (8 items)
//   - Validation (3 items)
//   - External Gates (5 items)
//   - Production (3 items)
//
// The 5 production-readiness gates (per COO-RECOMMENDATIONS §9):
//   Gate 1 — Chain-linking ✅ PASS
//   Gate 2 — P0 fixes ✅ PASS (V3 contract source-ready)
//   Gate 3 — §23 validation ✅ PASS (all 7 layers complete: 141 unit + 257 historical + 11 stress)
//   Gate 4 — Independent audit (not started)
//   Gate 5 — Genesis + governance (not started)
//
// Final verdict: "NOT PRODUCTION-AUTHORIZED — Candidate for Public Testing"
// (per §38 stop conditions).
//
// Wired into:
//   - src/components/mtq/sections/DocsSection.tsx (after the AuditFindings panel)
//   - src/components/mtq/sections/SecuritySection.tsx (after the AuditFindings panel)

"use client";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Lock,
  ShieldCheck,
  Gauge,
  ClipboardCheck,
  Building2,
  Rocket,
  ArrowRight,
} from "lucide-react";
import { Panel, Reveal, Pill, GlowDot } from "./primitives";

/* ---------- Subsystem status type ---------- */

type StatusColor = "GREEN" | "AMBER" | "RED" | "BLOCKED";

interface Subsystem {
  name: string;
  status: string;
  color: StatusColor;
  evidence: string;
  category: "Architecture" | "Implementation" | "Validation" | "External Gates" | "Production";
}

/* ---------- Subsystem inventory (per task spec) ---------- */

const SUBSYSTEMS: Subsystem[] = [
  // === Architecture (4 items) ===
  {
    name: "Chain-linked index",
    status: "IMPLEMENTED + TESTED",
    color: "GREEN",
    evidence: "chain-index.ts + S5 test passed (100% survival, was 0% with Laspeyres)",
    category: "Architecture",
  },
  {
    name: "MASE weight registry",
    status: "PARTIAL (TS engine only)",
    color: "AMBER",
    evidence: "mase.ts implements ensemble but not the full Listing 2 registry contract",
    category: "Architecture",
  },
  {
    name: "NAV-based redemption",
    status: "IMPLEMENTED + TESTED",
    color: "GREEN",
    evidence: "engine.ts::applyRedeem uses NAV_t = V_net / S_circ (Layer 1 test passed)",
    category: "Architecture",
  },
  {
    name: "6-state risk machine",
    status: "IMPLEMENTED + TESTED",
    color: "GREEN",
    evidence: "state-machine.ts + 6 states verified (Layer 1 + Layer 2 tests passed)",
    category: "Architecture",
  },

  // === Implementation (8 items) ===
  {
    name: "4 governance layers",
    status: "SPECIFIED (interface only)",
    color: "AMBER",
    evidence: "blueprint.ts has the constants (GOVERNANCE_LAYERS + PARAMETER_REGISTRY); contract not yet updated",
    category: "Implementation",
  },
  {
    name: "Oracle consensus",
    status: "IMPLEMENTED + TESTED",
    color: "GREEN",
    evidence: "oracle.ts + §9.2/§9.3 validation (Layer 2 tests passed — median/average/paused)",
    category: "Implementation",
  },
  {
    name: "Asset registry",
    status: "PARTIAL",
    color: "AMBER",
    evidence: "registry.ts has 9 assets (3 USD + 1 EUR + 3 governance-pending + 2 gold); contract adapter only",
    category: "Implementation",
  },
  {
    name: "MARP execution",
    status: "PARTIAL",
    color: "AMBER",
    evidence: "engine.ts has applyMarpRebalance; feature-flagged off (USE_MARP_EXECUTION in pilot-state.ts)",
    category: "Implementation",
  },
  {
    name: "Dynamic buffer",
    status: "IMPLEMENTED",
    color: "GREEN",
    evidence: "engine.ts::updateBufferState (BASE/STRESS/EMERGENCY transitions verified)",
    category: "Implementation",
  },
  {
    name: "Honest status",
    status: "REQUIRES EVIDENCE",
    color: "AMBER",
    evidence: "getHonestStatus claims 0x7FF; audit verified 0x5A7 (7 of 11 bits); needs deployment + test evidence",
    category: "Implementation",
  },
  {
    name: "CHF base fixing",
    status: "FIXED",
    color: "GREEN",
    evidence: "0.88 → 1.13 (matches Master Blueprint v1.0 — AUDIT-D F-CHF-01 fixed)",
    category: "Implementation",
  },
  {
    name: "Weight velocity limits",
    status: "IMPLEMENTED",
    color: "GREEN",
    evidence: "mase.ts::targetVelocity + smoothWeightsAdaptive (§8.4 + §7.4 — whip-saw guard)",
    category: "Implementation",
  },

  // === Validation (3 items) ===
  {
    name: "Stress-adaptive smoothing",
    status: "IMPLEMENTED",
    color: "GREEN",
    evidence: "mase.ts::smoothWeightsAdaptive (rho 0.50/0.75 in STRESS/CAUTION; Layer 2 test passed)",
    category: "Validation",
  },
  {
    name: "Index/NAV divergence",
    status: "IMPLEMENTED + MONITORED",
    color: "GREEN",
    evidence: "engine.ts::indexNavDivergence (normal/monitor/stress thresholds 5%/10% — surfaced in snapshot)",
    category: "Validation",
  },
  {
    name: "Layer 6 historical backtest (§23.2-§23.4)",
    status: "DONE",
    color: "GREEN",
    evidence: "257-day 2024 ECB/Frankfurter historical backtest — 100% survival, 100% peg stability, RR min 1.0897 (8.97% above hard floor). Gold held constant (Frankfurter doesn't publish XAU); gold shocks covered in Layer 7.",
    category: "Validation",
  },

  // === External Gates (5 items) ===
  {
    name: "Smart-contract audit",
    status: "NOT DONE",
    color: "RED",
    evidence: "No independent audit firm engaged yet (OpenZeppelin / Trail of Bits / Certora target)",
    category: "External Gates",
  },
  {
    name: "Independent model validation",
    status: "PARTIAL",
    color: "AMBER",
    evidence: "§23 validation program COMPLETE (all 7 layers: 141 unit + 257 historical + 11 stress tests pass). Independent third-party validation (§23.2-§23.4 walk-forward + purged/leakage-controlled) still needed for production.",
    category: "External Gates",
  },
  {
    name: "Sharia certification",
    status: "NOT DONE",
    color: "BLOCKED",
    evidence: "External dependency — independent fatwa from a recognised Sharia board required",
    category: "External Gates",
  },
  {
    name: "Legal opinion",
    status: "NOT DONE",
    color: "BLOCKED",
    evidence: "External dependency — independent legal opinion on regulatory status (US/EU/CH)",
    category: "External Gates",
  },
  {
    name: "Penetration testing",
    status: "NOT DONE",
    color: "RED",
    evidence: "External dependency — independent security firm for web + contract pentest",
    category: "External Gates",
  },

  // === Production (6 items) ===
  {
    name: "Public testnet deployment",
    status: "DONE (v1.2 pilot)",
    color: "AMBER",
    evidence: "v1.2 pilot deployed (Monad 10143, Arc 5042002, Solana devnet); v1.0 contract pending",
    category: "Production",
  },
  {
    name: "Institutional review",
    status: "NOT DONE",
    color: "RED",
    evidence: "External dependency — independent institutional review (treasury, custody, market-making)",
    category: "Production",
  },
  {
    name: "Liquidity bootstrapping",
    status: "NOT DONE",
    color: "BLOCKED",
    evidence: "Post-mainnet — requires all 5 gates to pass first",
    category: "Production",
  },
  {
    name: "Governance launch",
    status: "NOT DONE",
    color: "BLOCKED",
    evidence: "Post-mainnet — 4 governance timelocks must be deployed and tested before governance handover",
    category: "Production",
  },
  {
    name: "Community stress test",
    status: "NOT DONE",
    color: "RED",
    evidence: "Public testnet phase — community-run stress tests (bug bounties, red-team invitations)",
    category: "Production",
  },
  {
    name: "Mainnet deployment approval",
    status: "NOT DONE",
    color: "BLOCKED",
    evidence: "All 5 production-readiness gates must pass first; COO + CTO + governance multi-sig sign-off required",
    category: "Production",
  },
];

/* ---------- The 5 production-readiness gates (per COO-RECOMMENDATIONS §9) ---------- */

interface Gate {
  number: number;
  name: string;
  status: "PASS" | "IN_PROGRESS" | "NOT_STARTED" | "DONE";
  detail: string;
}

const GATES: Gate[] = [
  {
    number: 1,
    name: "Chain-linking",
    status: "PASS",
    detail: "Chain-linked index implemented + tested (S5 survival 0% → 100%; Layer 1-7 test suite 141/141 pass)",
  },
  {
    number: 2,
    name: "P0 fixes",
    status: "PASS",
    detail: "All 4 P0 fixes applied in BOTH the TS engine (chain-index.ts, state-machine.ts, NAV redemption, 6 states, 4 governance layers) AND the V3 contract source (MTQSigmaV2.sol, 1467 lines, compiles clean with solcjs). V3 is source-ready pending deploy (needs testnet ETH).",
  },
  {
    number: 3,
    name: "§23 validation",
    status: "PASS",
    detail: "All 7 layers complete: L1 40 unit tests + L2 36 module tests + L3 24 invariant tests + L4 12 economic tests + L5 19 adversarial tests (141/141 pass) + L6 257-day historical backtest (100% survival, 100% peg stability) + L7 11 stochastic stress tests (S5 0%→100%). Independent third-party validation (§23.2-§23.4) still needed for production.",
  },
  {
    number: 4,
    name: "Independent audit",
    status: "NOT_STARTED",
    detail: "No independent audit firm engaged yet (OpenZeppelin / Trail of Bits / Certora target). The 30-test Foundry suite is source-ready (compilation errors fixed); the protocol owner must run `forge test` on their own machine.",
  },
  {
    number: 5,
    name: "Genesis + governance",
    status: "NOT_STARTED",
    detail: "V3 contract not deployed (needs testnet ETH). 4 governance timelocks are implemented in the V3 contract source but not deployed. Genesis ceremony (7/7 Constitutional Multi-Sig signer selection) pending.",
  },
];

/* ---------- Status badge helper ---------- */

function StatusBadge({ color, status }: { color: StatusColor; status: string }) {
  if (color === "GREEN") {
    return (
      <Pill tone="emerald">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        {status}
      </Pill>
    );
  }
  if (color === "AMBER") {
    return (
      <Pill tone="amber">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        {status}
      </Pill>
    );
  }
  if (color === "RED") {
    return (
      <Pill tone="rose">
        <XCircle className="h-3 w-3" aria-hidden="true" />
        {status}
      </Pill>
    );
  }
  // BLOCKED = muted Pill + Lock
  return (
    <Pill tone="muted">
      <Lock className="h-3 w-3" aria-hidden="true" />
      {status}
    </Pill>
  );
}

/* ---------- Category icon helper ---------- */

function CategoryIcon({ category }: { category: Subsystem["category"] }) {
  const cls = "h-4 w-4 text-mtqs-gold/75 shrink-0";
  switch (category) {
    case "Architecture":
      return <ShieldCheck className={cls} aria-hidden="true" />;
    case "Implementation":
      return <Gauge className={cls} aria-hidden="true" />;
    case "Validation":
      return <ClipboardCheck className={cls} aria-hidden="true" />;
    case "External Gates":
      return <Building2 className={cls} aria-hidden="true" />;
    case "Production":
      return <Rocket className={cls} aria-hidden="true" />;
  }
}

/* ---------- Summary counts ---------- */

function countByColor(subsystems: Subsystem[]): Record<StatusColor, number> {
  const out: Record<StatusColor, number> = { GREEN: 0, AMBER: 0, RED: 0, BLOCKED: 0 };
  for (const s of subsystems) out[s.color]++;
  return out;
}

/* ---------- The component ---------- */

export function ProductionReadinessDashboard() {
  const counts = countByColor(SUBSYSTEMS);
  const categories: Subsystem["category"][] = [
    "Architecture",
    "Implementation",
    "Validation",
    "External Gates",
    "Production",
  ];

  return (
    <Reveal>
      <Panel className="p-5 sm:p-6 mtqs-glow">
        {/* Header */}
        <div className="mb-5">
          <div className="flex items-start gap-3 mb-2">
            <ShieldCheck className="h-5 w-5 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
                §39J · Production Readiness Dashboard
              </div>
              <h3 className="mt-1 text-base font-semibold text-foreground/95">
                MTQΣ Subsystem Status — GREEN / AMBER / RED / BLOCKED
              </h3>
            </div>
          </div>
          <p className="text-[0.78rem] text-muted-foreground/85 leading-relaxed pl-8">
            Per Master Prompt §39J, every subsystem is rated with its production-readiness color
            and the evidence that backs the verdict. The dashboard is the single source of truth
            for the protocol&apos;s production-readiness state.{" "}
            <span className="text-mtqs-rose/90 font-medium">Final verdict: NOT PRODUCTION-AUTHORIZED — Candidate for Public Testing.</span>
          </p>
        </div>

        {/* Summary chips */}
        <div className="mb-5 flex flex-wrap items-center gap-1.5">
          <Pill tone="emerald">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            {counts.GREEN} GREEN
          </Pill>
          <Pill tone="amber">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {counts.AMBER} AMBER
          </Pill>
          <Pill tone="rose">
            <XCircle className="h-3 w-3" aria-hidden="true" />
            {counts.RED} RED
          </Pill>
          <Pill tone="muted">
            <Lock className="h-3 w-3" aria-hidden="true" />
            {counts.BLOCKED} BLOCKED
          </Pill>
          <Pill tone="gold">{SUBSYSTEMS.length} subsystems total</Pill>
        </div>

        {/* Per-category subsystem tables */}
        <div className="space-y-5">
          {categories.map((cat) => {
            const items = SUBSYSTEMS.filter((s) => s.category === cat);
            return (
              <div key={cat}>
                {/* Category header */}
                <div className="mb-2 flex items-center gap-2">
                  <CategoryIcon category={cat} />
                  <h4 className="text-sm font-semibold text-foreground/90">{cat}</h4>
                  <span className="text-[0.65rem] text-muted-foreground/70 font-mono">
                    ({items.length} items)
                  </span>
                </div>
                {/* Subsystem rows */}
                <div className="overflow-hidden rounded-md border border-white/[0.07]">
                  <div className="hidden sm:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,3fr)] gap-2 px-3 py-2 bg-white/[0.03] text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/70">
                    <div>Subsystem</div>
                    <div>Status</div>
                    <div>Evidence</div>
                  </div>
                  <div className="max-h-80 overflow-y-auto mtqs-scroll">
                    {items.map((s, i) => (
                      <motion.div
                        key={`${cat}-${s.name}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: i * 0.03 }}
                        className={`border-t border-white/[0.05] px-3 py-2.5 ${i % 2 ? "bg-white/[0.01]" : ""}`}
                      >
                        {/* Desktop layout */}
                        <div className="hidden sm:grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.4fr)_minmax(0,3fr)] gap-2 items-center">
                          <div className="text-[0.78rem] font-medium text-foreground/95 leading-snug">
                            {s.name}
                          </div>
                          <div>
                            <StatusBadge color={s.color} status={s.status} />
                          </div>
                          <div className="text-[0.72rem] text-muted-foreground/85 leading-snug">
                            {s.evidence}
                          </div>
                        </div>
                        {/* Mobile layout */}
                        <div className="sm:hidden space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[0.78rem] font-medium text-foreground/95 leading-snug flex-1">
                              {s.name}
                            </div>
                            <StatusBadge color={s.color} status={s.status} />
                          </div>
                          <div className="text-[0.7rem] text-muted-foreground/85 leading-snug">
                            {s.evidence}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* The 5 production-readiness gates (per COO-RECOMMENDATIONS §9) */}
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2">
            <GlowDot color="gold" size="h-2 w-2" />
            <h4 className="text-sm font-semibold text-foreground/90">
              5 Production-Readiness Gates (COO-RECOMMENDATIONS §9)
            </h4>
          </div>
          <p className="text-[0.72rem] text-muted-foreground/80 mb-3 leading-relaxed">
            All 5 gates must pass before any mainnet deployment approval. Gate 1 (chain-linking)
            is the only one complete. The protocol is honestly a strong pilot — but{" "}
            <span className="text-mtqs-rose/90 font-medium">NOT production-authorized</span>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {GATES.map((g) => {
              const tone =
                g.status === "PASS" ? "emerald" :
                g.status === "DONE" ? "emerald" :
                g.status === "IN_PROGRESS" ? "amber" :
                "rose";
              const icon = g.status === "PASS" || g.status === "DONE" ? (
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              ) : g.status === "IN_PROGRESS" ? (
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              );
              return (
                <Panel key={g.number} className="p-4">
                  <div className="flex items-start gap-2 mb-1.5">
                    <span className="font-mono text-[0.7rem] text-mtqs-gold/80 font-semibold shrink-0 mt-0.5">
                      Gate {g.number}
                    </span>
                    <div className="flex-1">
                      <div className="text-[0.82rem] font-semibold text-foreground/95 leading-snug">
                        {g.name}
                      </div>
                    </div>
                    <Pill tone={tone}>
                      {icon}
                      {g.status}
                    </Pill>
                  </div>
                  <p className="text-[0.7rem] text-muted-foreground/85 leading-relaxed">
                    {g.detail}
                  </p>
                </Panel>
              );
            })}
          </div>
        </div>

        {/* Final verdict */}
        <div className="mt-6 rounded-md border border-mtqs-rose/30 bg-mtqs-rose/[0.05] p-4">
          <div className="flex items-start gap-2.5">
            <XCircle className="h-5 w-5 text-mtqs-rose/85 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-1.5">
              <div className="text-sm font-semibold text-foreground/95">
                Final verdict: NOT PRODUCTION-AUTHORIZED — Candidate for Public Testing
              </div>
              <p className="text-[0.74rem] text-muted-foreground/90 leading-relaxed">
                Per Master §38 stop conditions, the protocol may proceed to public testnet
                testing but <span className="text-mtqs-rose/90 font-medium">MUST NOT be deployed to mainnet</span> until
                all 5 production-readiness gates pass. <span className="text-emerald-200/90 font-medium">3 of 5 gates now PASS</span>:
                Gate 1 (chain-linking), Gate 2 (P0 fixes — V3 contract source-ready), Gate 3 (§23 validation — all 7 layers complete:
                141 unit + 257 historical + 11 stress tests pass). The remaining gates require:
                an independent smart-contract audit by a top-tier firm (Gate 4), and the
                genesis ceremony + 4 governance timelocks deployed (Gate 5).
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Pill tone="rose">
                  <XCircle className="h-3 w-3" aria-hidden="true" />
                  mainnet BLOCKED
                </Pill>
                <Pill tone="amber">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  public testnet CANDIDATE
                </Pill>
                <Pill tone="emerald">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  TS reference engine verified
                </Pill>
              </div>
            </div>
          </div>
        </div>

        {/* Footer — link to the test suite + audit reports */}
        <div className="mt-4 rounded-md border border-mtqs-gold/25 bg-mtqs-gold/[0.04] p-3.5">
          <div className="flex items-start gap-2.5">
            <ClipboardCheck className="h-4 w-4 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="text-[0.74rem] text-muted-foreground/90 leading-relaxed space-y-1">
              <p>
                <span className="text-mtqs-gold/90 font-medium">Evidence package — </span>
                The 141-test Layer 1-7 canonical invariants suite is at{" "}
                <span className="font-mono text-amber-200/90">src/lib/mtq/__tests__/canonical-invariants.ts</span>{" "}
                (run via <span className="font-mono text-amber-200/90">bun src/lib/mtq/__tests__/canonical-invariants.ts</span>).
              </p>
              <p>
                <span className="text-mtqs-gold/90 font-medium">Test report — </span>
                The full Layer 1-7 test report is at{" "}
                <span className="font-mono text-amber-200/90">audit-work/DELIVERABLE-G-test-suite.md</span>{" "}
                (141/141 pass, S5 survival 100%, S6 survival 100%, S3 survival 39.5%).
              </p>
              <p className="pt-1">
                <span className="text-mtqs-gold/90 font-medium">COO verdict — </span>
                3 of 5 gates PASS (chain-linking + P0 fixes + §23 validation all complete). The protocol owner must now:
                deploy V3 to testnet (Gate 5), engage an independent audit firm (Gate 4), and complete the
                genesis ceremony with 7/7 Constitutional Multi-Sig signers. Do not sign off on mainnet until all 5 gates pass.
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </Reveal>
  );
}
