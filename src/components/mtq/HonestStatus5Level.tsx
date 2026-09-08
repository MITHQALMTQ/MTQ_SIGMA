// MTQΣ — 5-Level Honest Status Declaration (Master Prompt §22 + §23)
// =========================================================================
//
// Per Master Prompt §22 + §23, the honest status of every feature / gate is
// one of exactly 5 levels, ordered from least to most mature:
//
//   1. SPECIFIED_ONLY        — feature is in the spec but NOT implemented.
//                              The blueprint describes the mechanism; no
//                              on-chain or off-chain code realizes it. (muted)
//
//   2. PARTIAL               — feature is partially implemented. Some pieces
//                              are in place but the feature is not end-to-end
//                              functional. (amber)
//
//   3. IMPLEMENTED_UNVALIDATED — feature is implemented but NOT validated by
//                              tests. The code is present; no test exercises
//                              it. (yellow)
//
//   4. VALIDATED             — feature is validated by tests. The code is
//                              present and a test exercises it; the test
//                              passes. (emerald)
//
//   5. PRODUCTION_AUTHORIZED — feature is approved for production. All
//                              VALIDATED criteria are met + an independent
//                              audit firm has signed off + the relevant
//                              §25.5 validation gates have passed + the
//                              Constitutional Council has issued a deployment
//                              approval. (gold)
//
// The component renders a 22-row table:
//   - 11 honest-status bits (all VALIDATED — implemented + tested by the
//     141-test Layer 1-7 suite; NOT PRODUCTION_AUTHORIZED because the
//     external gates haven't passed).
//   - 11 §25.5 validation gates (1 PARTIAL — Public Testnet Deployment;
//     10 SPECIFIED_ONLY — the external gates are not done).
//
// Summary footer:
//   - 11 features at VALIDATED (not PRODUCTION_AUTHORIZED)
//   - 1 gate at PARTIAL (Public Testnet)
//   - 10 gates at SPECIFIED_ONLY (not done)
//   - 0 gates at PRODUCTION_AUTHORIZED
//   - Final system status: VALIDATED, NOT PRODUCTION_AUTHORIZED — Candidate
//     for Public Testing.
//
// Color system:
//   SPECIFIED_ONLY         → muted (GlowDot gold + muted Pill)
//   PARTIAL               → amber  (GlowDot amber + amber Pill)
//   IMPLEMENTED_UNVALIDATED → yellow (GlowDot gold + amber Pill, hollow)
//   VALIDATED             → emerald (GlowDot emerald + emerald Pill)
//   PRODUCTION_AUTHORIZED → gold   (GlowDot gold + gold Pill, glow)
//
// Wired into:
//   - src/components/mtq/sections/DocsSection.tsx (after ProductionReadinessDashboard)
//   - src/components/mtq/sections/SecuritySection.tsx (after ProductionReadinessDashboard)

"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  FileText,
  Award,
  AlertCircle,
  CheckCircle2,
  Lock,
  ChevronRight,
} from "lucide-react";
import { Panel, Reveal, Pill, GlowDot } from "./primitives";

/* ---------- 5-level status type ---------- */

export type HonestStatus5Level =
  | "SPECIFIED_ONLY"
  | "PARTIAL"
  | "IMPLEMENTED_UNVALIDATED"
  | "VALIDATED"
  | "PRODUCTION_AUTHORIZED";

interface Status5Meta {
  label: string;
  short: string;
  dot: "gold" | "amber" | "emerald" | "rose";
  pillTone: "muted" | "amber" | "emerald" | "gold";
  description: string;
}

const STATUS5_META: Record<HonestStatus5Level, Status5Meta> = {
  SPECIFIED_ONLY: {
    label: "SPECIFIED_ONLY",
    short: "S1",
    dot: "gold",
    pillTone: "muted",
    description: "In the spec but not implemented.",
  },
  PARTIAL: {
    label: "PARTIAL",
    short: "S2",
    dot: "amber",
    pillTone: "amber",
    description: "Partially implemented (some pieces in place).",
  },
  IMPLEMENTED_UNVALIDATED: {
    label: "IMPLEMENTED_UNVALIDATED",
    short: "S3",
    dot: "amber",
    pillTone: "amber",
    description: "Implemented but not validated by tests.",
  },
  VALIDATED: {
    label: "VALIDATED",
    short: "S4",
    dot: "emerald",
    pillTone: "emerald",
    description: "Implemented + validated by tests.",
  },
  PRODUCTION_AUTHORIZED: {
    label: "PRODUCTION_AUTHORIZED",
    short: "S5",
    dot: "gold",
    pillTone: "gold",
    description: "Approved for production (all gates passed).",
  },
};

/* ---------- Row model ---------- */

interface HonestRow {
  kind: "feature" | "gate";
  index: number;          // bit # (0..10) or gate # (1..11)
  name: string;           // feature name (camelCase) or gate name (Title Case)
  sourceSection: string;  // § reference(s)
  status: HonestStatus5Level;
  evidence: string;       // test name + result, or "not run", or "external gate not done"
  artifactVersion: string;
  evidenceHash: string;   // deterministic hash placeholder
}

const ARTIFACT_VERSION = "v3-source-ready";

// Deterministic evidence-hash placeholder (matches Deliverable I convention).
// sha256("file_path:line_range_or_label") truncated to 10 hex chars.
function hash(label: string): string {
  // Tiny deterministic hash so the column is stable across renders. NOT
  // cryptographically secure — it's an evidence-fingerprint placeholder
  // per Deliverable I.
  let h = 0x811c9dc5;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/* ---------- The 11 honest-status bits (all VALIDATED) ---------- */

const HONEST_BITS: HonestRow[] = [
  {
    kind: "feature", index: 0,
    name: "basketHas7Components",
    sourceSection: "§3.2 / §8.1 / Listing 1",
    status: "VALIDATED",
    evidence: "L1 PASS (chain-linked unit tests · 7-component numerator)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("MTQSigmaV2.sol:219:enum_Component"),
  },
  {
    kind: "feature", index: 1,
    name: "goldIsFirstClassIndex",
    sourceSection: "§3.3 / §8.1 / Listing 1",
    status: "VALIDATED",
    evidence: "L1 PASS + L7 PASS (S5/S6/S3 — chain-linked gold shock)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("MTQSigmaV2.sol:428:PRIOR_GOLD_x_fxXAU"),
  },
  {
    kind: "feature", index: 2,
    name: "chfIsFirstClassIndex",
    sourceSection: "§3.2 / §8.1 / Listing 1",
    status: "VALIDATED",
    evidence: "L1 PASS + L2 PASS (BASE_FIXINGS · CHF 0.88 → 1.13 corrected)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("MTQSigmaV2.sol:427:PRIOR_CHF_x_fxCHF"),
  },
  {
    kind: "feature", index: 3,
    name: "chainLinkedIndex",
    sourceSection: "§9.2 / §9.3 / Listing 3",
    status: "VALIDATED",
    evidence: "L1 PASS (5 tests) + L2 PASS (4 tests) + L7 PASS (S5 0% → 100%)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("chain-index.ts:advanceIndex+commitWeights"),
  },
  {
    kind: "feature", index: 4,
    name: "maseWeightRegistry",
    sourceSection: "§7 / §7.7 / §8.5 / §26.2 / Listing 2",
    status: "VALIDATED",
    evidence: "L1 PASS + L2 PASS (MASE envelopes) + L3 PASS (index reads MASE)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("MTQSigmaV2.sol:245:WeightRegistry+commitWeights"),
  },
  {
    kind: "feature", index: 5,
    name: "admissibilityEnvelopes",
    sourceSection: "§8.1 / §22.4 / Listing 2",
    status: "VALIDATED",
    evidence: "L2 PASS (envelope tests) + L5 PASS (envelope enforcement)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("MTQSigmaV2.sol:226:ENV_LOWER_UPPER+assertEnvelope"),
  },
  {
    kind: "feature", index: 6,
    name: "marpExecution",
    sourceSection: "§10 / §10.3 / §10.4 / §10.6 / §10.8 / §11.5.3 / Listing 4 / Listing 5",
    status: "VALIDATED",
    evidence: "L2 + L3 + L4 + L5 PASS (6-level trigger, RR<1.05 override, trades≤7)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("MTQSigmaV2.sol:603:executeRebalance"),
  },
  {
    kind: "feature", index: 7,
    name: "assetRegistry",
    sourceSection: "§5 / §14.1 / Listing 6",
    status: "VALIDATED",
    evidence: "L2 PASS (USD/Gold/EUR haircuts) + L4 PASS (NAV < gross)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("MTQSigmaV2.sol:86:IAssetRegistry+855:getReserveNetAssetValue"),
  },
  {
    kind: "feature", index: 8,
    name: "multiSourceOracle",
    sourceSection: "§9.2 / §9.3 / §17.3.4 / Listing 9",
    status: "VALIDATED",
    evidence: "L2 PASS (7 oracle tests) + L5 PASS (4 failure + deviation discard)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("MTQSigmaV2.sol:688:getOracleConsensus+setOracleAdapter"),
  },
  {
    kind: "feature", index: 9,
    name: "daoGovernance",
    sourceSection: "§22.3 / §22.4 / §22.5 / §22.6 / Listing 14",
    status: "VALIDATED",
    evidence: "L3 PASS (4 layer-ownership) + L5 PASS (PAR immutable + envelopes)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("blueprint.ts:GOVERNANCE_LAYERS+PARAMETER_REGISTRY"),
  },
  {
    kind: "feature", index: 10,
    name: "honestStatusExposed",
    sourceSection: "§2.6 (I10) / §25 / §25.7 (Listing 15) / §26.2",
    status: "VALIDATED",
    evidence: "L3 PASS (snapshot consistency) + Production Readiness Dashboard",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("MTQSigmaV2.sol:1030:getHonestStatus+getHonestStatusMask"),
  },
];

/* ---------- The 11 §25.5 validation gates (1 PARTIAL + 10 SPECIFIED_ONLY) ---------- */

const VALIDATION_GATES: HonestRow[] = [
  {
    kind: "gate", index: 1,
    name: "Smart Contract Audit",
    sourceSection: "§25.5 / Gate 4",
    status: "SPECIFIED_ONLY",
    evidence: "NOT DONE — no independent audit firm engaged (AUDIT-A/B/C/D are internal)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("gate:1:smart_contract_audit"),
  },
  {
    kind: "gate", index: 2,
    name: "Independent Model Validation",
    sourceSection: "§25.5 / Gate 3",
    status: "SPECIFIED_ONLY",
    evidence: "NOT DONE — §23 program incomplete (Layer 6 backtest needs 10y data)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("gate:2:independent_model_validation"),
  },
  {
    kind: "gate", index: 3,
    name: "Sharia Certification",
    sourceSection: "§25.5 / External",
    status: "SPECIFIED_ONLY",
    evidence: "NOT DONE — external fatwa not yet issued",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("gate:3:sharia_certification"),
  },
  {
    kind: "gate", index: 4,
    name: "Legal Opinion",
    sourceSection: "§25.5 / External",
    status: "SPECIFIED_ONLY",
    evidence: "NOT DONE — external counsel not commissioned",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("gate:4:legal_opinion"),
  },
  {
    kind: "gate", index: 5,
    name: "Public Testnet Deployment",
    sourceSection: "§25.5 / Gate 5",
    status: "PARTIAL",
    evidence: "PARTIAL — v1.2 pilot deployed on Monad/Arc/Solana devnet; v1.0 V3 pending",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("gate:5:public_testnet_deployment"),
  },
  {
    kind: "gate", index: 6,
    name: "Penetration Testing",
    sourceSection: "§25.5 / External",
    status: "SPECIFIED_ONLY",
    evidence: "NOT DONE — external pentest not commissioned",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("gate:6:penetration_testing"),
  },
  {
    kind: "gate", index: 7,
    name: "Institutional Review",
    sourceSection: "§25.5 / External",
    status: "SPECIFIED_ONLY",
    evidence: "NOT DONE — no central bank / regulator / institution engaged",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("gate:7:institutional_review"),
  },
  {
    kind: "gate", index: 8,
    name: "Liquidity Bootstrapping",
    sourceSection: "§25.5 / Post-mainnet",
    status: "SPECIFIED_ONLY",
    evidence: "NOT DONE — genesis ceremony (1M MTQ @ 1.1M USDC) not yet executed",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("gate:8:liquidity_bootstrapping"),
  },
  {
    kind: "gate", index: 9,
    name: "Governance Launch",
    sourceSection: "§25.5 / Post-mainnet",
    status: "SPECIFIED_ONLY",
    evidence: "NOT DONE — 4 governance bodies not yet operational (multisig ceremonies pending)",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("gate:9:governance_launch"),
  },
  {
    kind: "gate", index: 10,
    name: "Community Stress Test",
    sourceSection: "§25.5 / Public testnet",
    status: "SPECIFIED_ONLY",
    evidence: "NOT DONE — 30-day community stress test not started",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("gate:10:community_stress_test"),
  },
  {
    kind: "gate", index: 11,
    name: "Mainnet Deployment Approval",
    sourceSection: "§25.5 / Constitutional Council 7/7",
    status: "SPECIFIED_ONLY",
    evidence: "NOT DONE — blocked by Gates 1–10; no 7/7 Constitutional vote",
    artifactVersion: ARTIFACT_VERSION,
    evidenceHash: hash("gate:11:mainnet_deployment_approval"),
  },
];

const ALL_ROWS: HonestRow[] = [...HONEST_BITS, ...VALIDATION_GATES];

/* ---------- 5-level status pill ---------- */

function Status5Pill({ status }: { status: HonestStatus5Level }) {
  const meta = STATUS5_META[status];
  return (
    <Pill tone={meta.pillTone}>
      <GlowDot color={meta.dot} size="h-1.5 w-1.5" />
      <span className="font-mono uppercase tracking-[0.08em] text-[0.62rem]">
        {meta.label}
      </span>
    </Pill>
  );
}

/* ---------- Section icon ---------- */

function KindIcon({ kind }: { kind: "feature" | "gate" }) {
  return kind === "feature" ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald/80" aria-hidden="true" />
  ) : (
    <Lock className="h-3.5 w-3.5 text-mtqs-gold/70" aria-hidden="true" />
  );
}

/* ---------- Single row ---------- */

function HonestRowView({ row, index }: { row: HonestRow; index: number }) {
  const meta = STATUS5_META[row.status];
  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(0.4, index * 0.015) }}
      className={`border-t border-white/[0.05] ${index % 2 ? "bg-white/[0.01]" : ""}`}
    >
      <td className="px-3 py-2.5 align-top">
        <div className="flex items-start gap-2">
          <KindIcon kind={row.kind} />
          <div className="min-w-0">
            <div className="font-mono text-[0.72rem] text-foreground/90 break-all leading-tight">
              {row.name}
            </div>
            <div className="text-[0.6rem] text-muted-foreground/60 mt-0.5">
              {row.kind === "feature" ? `Bit ${row.index}` : `Gate ${row.index}`}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 align-top">
        <span className="font-mono text-[0.66rem] text-mtqs-gold/75 break-all">
          {row.sourceSection}
        </span>
      </td>
      <td className="px-3 py-2.5 align-top">
        <Status5Pill status={row.status} />
        <div className="text-[0.6rem] text-muted-foreground/60 mt-1 leading-snug">
          {meta.description}
        </div>
      </td>
      <td className="px-3 py-2.5 align-top">
        <span className="text-[0.7rem] text-muted-foreground/85 leading-snug block">
          {row.evidence}
        </span>
      </td>
      <td className="px-3 py-2.5 align-top">
        <span className="font-mono text-[0.66rem] text-muted-foreground/75">
          {row.artifactVersion}
        </span>
      </td>
      <td className="px-3 py-2.5 align-top">
        <span className="font-mono text-[0.64rem] text-mtqs-gold/60 break-all">
          {row.evidenceHash}
        </span>
      </td>
    </motion.tr>
  );
}

/* ---------- Summary footer ---------- */

function SummaryFooter({ rows }: { rows: HonestRow[] }) {
  // Count by status × kind
  const counts: Record<HonestStatus5Level, { feature: number; gate: number }> = {
    SPECIFIED_ONLY: { feature: 0, gate: 0 },
    PARTIAL: { feature: 0, gate: 0 },
    IMPLEMENTED_UNVALIDATED: { feature: 0, gate: 0 },
    VALIDATED: { feature: 0, gate: 0 },
    PRODUCTION_AUTHORIZED: { feature: 0, gate: 0 },
  };
  for (const r of rows) {
    counts[r.status][r.kind]++;
  }

  const levels: HonestStatus5Level[] = [
    "SPECIFIED_ONLY",
    "PARTIAL",
    "IMPLEMENTED_UNVALIDATED",
    "VALIDATED",
    "PRODUCTION_AUTHORIZED",
  ];

  return (
    <div className="mt-4 rounded-md border border-mtqs-gold/25 bg-mtqs-gold/[0.04] p-4 mtqs-glow">
      <div className="flex items-start gap-2 mb-3">
        <Award className="h-4 w-4 text-mtqs-gold/85 mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/85 mb-0.5">
            5-Level Honest Status Summary
          </div>
          <div className="text-[0.72rem] text-muted-foreground/85 leading-snug">
            11 honest-status bits + 11 §25.5 validation gates = 22 rows total
          </div>
        </div>
      </div>

      {/* Per-status breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-3">
        {levels.map((lvl) => {
          const meta = STATUS5_META[lvl];
          const f = counts[lvl].feature;
          const g = counts[lvl].gate;
          const total = f + g;
          return (
            <div
              key={lvl}
              className="rounded-md border border-white/[0.07] bg-white/[0.02] p-2.5"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <GlowDot color={meta.dot} size="h-1.5 w-1.5" />
                <span className="font-mono uppercase tracking-[0.08em] text-[0.58rem] text-foreground/85">
                  {meta.label}
                </span>
              </div>
              <div className="font-mono text-base text-foreground/95">
                {total}
                <span className="text-[0.65rem] text-muted-foreground/70 ml-1">
                  / 22
                </span>
              </div>
              <div className="text-[0.6rem] text-muted-foreground/70 mt-0.5">
                {f} feature{f === 1 ? "" : "s"} · {g} gate{g === 1 ? "" : "s"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Final verdict */}
      <div className="rounded-md border border-mtqs-emerald/30 bg-mtqs-emerald/[0.04] p-3 mb-2">
        <div className="flex items-start gap-2">
          <ShieldCheck className="h-4 w-4 text-mtqs-emerald/80 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-[0.62rem] uppercase tracking-[0.2em] text-mtqs-emerald/85 mb-0.5">
              Final System Status
            </div>
            <div className="font-mono text-sm text-[#6ff0c0] mb-1">
              VALIDATED, NOT PRODUCTION_AUTHORIZED
            </div>
            <div className="text-[0.7rem] text-muted-foreground/85 leading-snug">
              Candidate for Public Testing per §25.4 / §38 — the 11 honest-status
              bits are all implemented + validated by the 141-test Layer 1-7
              suite, but the 11 §25.5 validation gates have not passed (1
              PARTIAL — Public Testnet; 10 NOT DONE — external). The protocol
              MAY proceed to public testnet (Gate 5) but MUST NOT be deployed
              to mainnet until all 11 §25.5 gates pass and the Constitutional
              Council issues a 7/7 deployment approval.
            </div>
          </div>
        </div>
      </div>

      {/* Counts */}
      <div className="text-[0.66rem] text-muted-foreground/80 leading-relaxed">
        <span className="font-mono text-mtqs-emerald/85">11 features at VALIDATED</span>
        {" · "}
        <span className="font-mono text-mtqs-amber/85">1 gate at PARTIAL</span>
        {" · "}
        <span className="font-mono text-muted-foreground/85">10 gates at SPECIFIED_ONLY</span>
        {" · "}
        <span className="font-mono text-mtqs-gold/85">0 gates at PRODUCTION_AUTHORIZED</span>
      </div>
    </div>
  );
}

/* ---------- Legend strip ---------- */

function Status5Legend() {
  const levels: HonestStatus5Level[] = [
    "SPECIFIED_ONLY",
    "PARTIAL",
    "IMPLEMENTED_UNVALIDATED",
    "VALIDATED",
    "PRODUCTION_AUTHORIZED",
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-3">
      {levels.map((lvl, i) => {
        const meta = STATUS5_META[lvl];
        return (
          <div key={lvl} className="flex items-center gap-1.5">
            <span className="font-mono text-[0.55rem] text-muted-foreground/50 mr-0.5">
              {i + 1}.
            </span>
            <GlowDot color={meta.dot} size="h-1.5 w-1.5" />
            <span className="font-mono uppercase tracking-[0.08em] text-[0.6rem] text-foreground/80">
              {meta.label}
            </span>
            {i < levels.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/30 ml-1" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Main component ---------- */

export function HonestStatus5Level() {
  return (
    <div className="space-y-4">
      <Reveal>
        <Panel className="p-5 sm:p-6 mtqs-glow">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-mtqs-gold/15 border border-mtqs-gold/30 p-2 mt-0.5">
                <FileText className="h-5 w-5 text-mtqs-gold/85" aria-hidden="true" />
              </div>
              <div>
                <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75 mb-1">
                  §22 + §23 + §25 · 5-Level Honest Status
                </div>
                <div className="text-base font-semibold text-foreground/95">
                  Honest Status Declaration — 5-Level System
                </div>
                <div className="text-[0.74rem] text-muted-foreground/85 mt-1 leading-relaxed max-w-3xl">
                  Per Master Prompt §22 + §23, every feature and every §25.5
                  validation gate is classified into exactly one of 5 levels —
                  SPECIFIED_ONLY, PARTIAL, IMPLEMENTED_UNVALIDATED, VALIDATED,
                  PRODUCTION_AUTHORIZED. The table below shows all 22 rows
                  (11 honest-status bits + 11 §25.5 gates) with their evidence
                  chain, artifact version, and a deterministic evidence-hash
                  placeholder. This is the canonical declaration of the
                  protocol&apos;s honest status.
                </div>
              </div>
            </div>
            <Pill tone="gold">
              <GlowDot color="gold" size="h-1.5 w-1.5" />
              0x7FF · 11/11 VALIDATED
            </Pill>
          </div>

          {/* Legend */}
          <Status5Legend />

          {/* Table */}
          <div className="overflow-hidden rounded-md border border-white/[0.08]">
            <div className="max-h-[28rem] overflow-y-auto mtqs-scroll">
              <table className="w-full text-[0.72rem]">
                <thead className="bg-white/[0.02] text-muted-foreground/75 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-[22%]">
                      Feature / Gate
                    </th>
                    <th className="text-left px-3 py-2 font-medium w-[16%]">
                      Source §
                    </th>
                    <th className="text-left px-3 py-2 font-medium w-[18%]">
                      Status
                    </th>
                    <th className="text-left px-3 py-2 font-medium w-[26%]">
                      Evidence
                    </th>
                    <th className="text-left px-3 py-2 font-medium w-[8%]">
                      Artifact
                    </th>
                    <th className="text-left px-3 py-2 font-medium w-[10%]">
                      Hash
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Features section header */}
                  <tr className="bg-mtqs-emerald/[0.03] border-t border-mtqs-emerald/20">
                    <td
                      colSpan={6}
                      className="px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-emerald/80"
                    >
                      <CheckCircle2 className="inline h-3 w-3 mr-1.5 align-text-bottom" aria-hidden="true" />
                      11 Honest-Status Bits (all VALIDATED — implemented + tested by the 141-test Layer 1-7 suite)
                    </td>
                  </tr>
                  {HONEST_BITS.map((row, i) => (
                    <HonestRowView key={`f-${row.index}`} row={row} index={i} />
                  ))}
                  {/* Gates section header */}
                  <tr className="bg-mtqs-gold/[0.03] border-t border-mtqs-gold/20">
                    <td
                      colSpan={6}
                      className="px-3 py-1.5 text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/80"
                    >
                      <Lock className="inline h-3 w-3 mr-1.5 align-text-bottom" aria-hidden="true" />
                      11 §25.5 Validation Gates (1 PARTIAL · 10 SPECIFIED_ONLY · 0 PRODUCTION_AUTHORIZED)
                    </td>
                  </tr>
                  {VALIDATION_GATES.map((row, i) => (
                    <HonestRowView key={`g-${row.index}`} row={row} index={i + 11} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary footer */}
          <SummaryFooter rows={ALL_ROWS} />

          {/* Footnote */}
          <div className="mt-3 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-mtqs-amber/80 mt-0.5 shrink-0" aria-hidden="true" />
            <p className="text-[0.66rem] text-muted-foreground/75 leading-relaxed">
              The 11 honest-status bits are VALIDATED (implemented + tested by
              the 141-test Layer 1-7 suite — see Deliverable G + Deliverable
              G2). They are NOT PRODUCTION_AUTHORIZED because the §25.5
              external gates (smart-contract audit, independent model
              validation, Sharia certification, legal opinion, etc.) have
              not been passed. The artifact version is{" "}
              <span className="font-mono text-mtqs-gold/85">v3-source-ready</span>{" "}
              (the V3 contract source; the deployed artifact will be tagged{" "}
              <span className="font-mono text-mtqs-gold/85">v3-deployed-arc</span>{" "}
              after deployment). The evidence hash is a deterministic
              fingerprint placeholder per Deliverable I — production will
              replace it with a cryptographic SHA-256 of the deployed
              bytecode + the test-result JSON.
            </p>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
