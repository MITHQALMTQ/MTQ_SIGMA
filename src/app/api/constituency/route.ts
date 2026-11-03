// MTQΣ — DYNAMIC CONSTITUENCY MACHINERY API (Task M8-3c-b · surfacing M8-3a;
//  TASK-39 extension — live scoring dossier + approval ledger + V4 status)
// ============================================================================
// A READ-ONLY GET that surfaces the dynamic-membership machinery
// (src/lib/mtq/constituency/ — Task M8-3a) for the Pilot Command Center's
// Constituency section:
//   • the DEFAULT_REGISTRY's 7 genesis entries (code, type, genesis weight bp,
//     lifecycle state) — the ACTIVE basket remains the 7-component genesis set;
//   • the lifecycle-state legend + the T1–T9 transition/directive vocabulary;
//   • the QUIESCENT disclosure (NO transition has ever run);
//   • the LIVE SCORING DOSSIER (TASK-39 feeds.ts — BIS/Frankfurter/Yahoo/
//     gold-api/COMEX/oracle-ledger/OFAC ingestion with per-input statuses,
//     per-leg family witnesses, ≥2-family precondition status);
//   • the PARAMETER APPROVAL LEDGER (TASK-39 approvals.ts — D-13.11/D-13.14
//     pilot-approved by owner directive 2026-11-03, digest-bound);
//   • the V4 CONTRACT LAYER STATUS (TASK-39 — MTQSigmaV4.sol compiled,
//     UNDEPLOYED + the TS reference validator's shadow-mode demonstration);
//   • the honest-limits line (updated: what is now implemented + what remains).
//
// The machinery is IMPORTED READ-ONLY — this route mutates nothing, runs no
// transition, and applies no directive. The dossier build is fail-soft: any
// unreachable feed degrades to a labeled fallback inside the dossier.
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// ============================================================================

import { NextResponse } from "next/server";
import {
  DEFAULT_REGISTRY,
  GENESIS_DOSSIER_REF,
  defaultActiveBasketCount,
  defaultGenesisWeightsBp,
} from "@/lib/mtq/constituency/registry";
import { LIFECYCLE_PARAMETER_CLASS } from "@/lib/mtq/constituency/parameters";
import { SCORING_FEED_DISCLOSURE } from "@/lib/mtq/constituency/types";
import {
  PARAMETER_APPROVAL_LEDGER,
  approvalStatusSummary,
} from "@/lib/mtq/constituency/approvals";
import {
  V4_CONTRACT_STATUS,
  demonstrateV4ReferenceValidation,
} from "@/lib/mtq/constituency/contract-v4";
import { buildLiveScoringDossier } from "@/lib/mtq/constituency/feeds";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;

const QUIESCENT_DISCLOSURE =
  "NO transition has ever run — the ACTIVE basket remains the 7-component genesis set at strategic-prior weights; " +
  "transitions fire only on governance directives with valid rule evidence, and none exists.";

const HONEST_LIMITS =
  "LIVE scoring feeds IMPLEMENTED (BIS WS_XRU + published Triennial wave · Frankfurter ECB · Yahoo vendor · gold-api + COMEX · " +
  "protocol oracle ledger · automated OFAC SDN scan) with per-input statuses and honest residuals (convertibility fixture-fed — " +
  "AREAER SSO-gated; geopolitical exposure declared — counsel gate); the ≥2-independent-family oracle precondition is MET at " +
  "the pilot's off-chain witness layer (2–3 families per leg; §17.10's three-family ON-CHAIN requirement remains open). " +
  "Lifecycle parameters PILOT-APPROVED by owner directive 2026-11-03 (D-13.11/D-13.14 recorded with evidence + parameter digest " +
  "in the approval ledger; PRODUCTION Gate-C ratification remains OPEN). The contract layer is IMPLEMENTED at the source level " +
  "— MTQSigmaV4.sol (registry-based dynamic membership, compiled, UNDEPLOYED) + TS reference validator + design plan; " +
  "deployment is Gate-C / Task-12-gated.";

/** Lifecycle state legend (spec §3 — registry.ts/types.ts LifecycleState). */
const LIFECYCLE_LEGEND: { state: string; role: string }[] = [
  { state: "CANDIDATE", role: "nominated (T1 — requires a provenance dossier); not in the basket" },
  { state: "ELIGIBLE", role: "queue state — passed the T2 rule window; admission is NOT yet weight-bearing" },
  { state: "ACTIVE", role: "the optimization domain — holds weight in the basket" },
  { state: "WATCH", role: "warning band (T4); informational — weight-bearing while watched" },
  { state: "RETIRING", role: "exit glide in progress (T5→T6); weight decays to exactly 0" },
  { state: "EXCLUDED", role: "glide completed at exactly zero (T6 — exclusion-zero invariant)" },
  {
    state: "EMERGENCY-SUSPENDED",
    role: "OVERLAY PATH (T7) — immediate freeze + fail-closed leg-pin; distinct from normal retirement",
  },
];

/** The T1–T9 transition/directive vocabulary (spec §3; engine.ts enforces T3/T5/T7/T8/T9 directives). */
const TRANSITIONS: { id: string; name: string; kind: "rule-driven" | "governance directive" }[] = [
  { id: "T1", name: "Nomination → CANDIDATE (register() path; provenance dossier required)", kind: "rule-driven" },
  { id: "T2", name: "Entry persistence window + hard gates + hysteresis (CANDIDATE → ELIGIBLE)", kind: "rule-driven" },
  { id: "T3", name: "CONFIRM admission (ELIGIBLE → ACTIVE) — evidence-checked directive", kind: "governance directive" },
  { id: "T4", name: "Warning band (ACTIVE → WATCH) — automatic", kind: "rule-driven" },
  { id: "T5", name: "Exit persistence window + CONFIRM retirement (WATCH → RETIRING) — evidence-checked directive", kind: "governance directive" },
  { id: "T6", name: "Glide completion → EXCLUDED at exactly zero (exclusion-zero invariant)", kind: "rule-driven" },
  { id: "T7", name: "EMERGENCY-SUSPENSION — immediate freeze + fail-closed leg-pin", kind: "governance directive" },
  { id: "T8", name: "RESOLUTION — fast-track reinstatement window", kind: "governance directive" },
  { id: "T9", name: "RENOMINATION after prior exclusion — fresh dossier; full T1→T2→T3 cycle required", kind: "governance directive" },
];

export async function GET() {
  try {
    const entries = DEFAULT_REGISTRY.entries();
    const weightsBp = defaultGenesisWeightsBp();
    const genesisWeightSumBp = entries.reduce((acc, e) => acc + e.genesisWeightBp, 0);
    // TASK-39: live scoring dossier (fail-soft — labeled fallbacks inside).
    let scoringDossier: Awaited<ReturnType<typeof buildLiveScoringDossier>> | null = null;
    let scoringError: string | null = null;
    try {
      scoringDossier = await buildLiveScoringDossier();
    } catch (e) {
      // [P2-class] no exception detail in public responses.
      console.error("[api/constituency] scoring dossier build failed", {
        errorType: e instanceof Error ? e.name : typeof e,
      });
      scoringError = "scoring dossier build failed (labeled outage — not silently omitted)";
    }
    // TASK-39: V4 reference-layer shadow demonstration (pure, deterministic).
    const v4Demo = demonstrateV4ReferenceValidation();
    return NextResponse.json(
      {
        banner:
          "TESTNET ONLY · SHADOW MODE ENFORCED · MACHINERY QUIESCENT · PARAMETERS PILOT-APPROVED (owner directive 2026-11-03) · NOT ACCEPTED",
        module: "src/lib/mtq/constituency/ (Task M8-3a — dynamic-membership machinery, IMPLEMENTED; TASK-39 — live feeds + approvals + V4)",
        quiescent: {
          disclosure: QUIESCENT_DISCLOSURE,
          activeBasketCount: defaultActiveBasketCount(),
          transitionsEverRun: 0,
          directivesEverApplied: 0,
        },
        genesisRegistry: {
          dossierRef: GENESIS_DOSSIER_REF,
          genesisWeightSumBp,
          entries: entries.map((e) => ({
            registryId: e.registryId,
            id: e.id,
            code: e.displayCode,
            name: e.name,
            componentType: e.componentType,
            maseLabel: e.maseLabel,
            lifecycleState: e.status,
            genesisWeightBp: e.genesisWeightBp,
            envelope: { minPct: e.envelope.min * 100, maxPct: e.envelope.max * 100 },
            velocityPerPeriodPct: e.velocityPerPeriod * 100,
            baseFixingUsd: e.baseFixing,
            dossierRef: e.dossierRef,
          })),
          weightsBp,
        },
        lifecycleLegend: LIFECYCLE_LEGEND,
        transitions: TRANSITIONS,
        scoringDossier: scoringDossier ?? { error: scoringError ?? "unavailable" },
        approvals: {
          summary: approvalStatusSummary(),
          ledger: PARAMETER_APPROVAL_LEDGER,
        },
        contractLayerV4: {
          status: V4_CONTRACT_STATUS,
          shadowDemonstration: v4Demo,
        },
        honestLimits: {
          line: HONEST_LIMITS,
          parameterClass: LIFECYCLE_PARAMETER_CLASS,
          scoringFeedDisclosure: SCORING_FEED_DISCLOSURE,
          contractLayer:
            "IMPLEMENTED (source level) — MTQSigmaV4.sol registry-based dynamic membership: compiled solc 0.8.36 · deployed bytecode 8,445 B (EIP-170 OK) · UNDEPLOYED (Gate-C / Task-12-gated) · TS reference validator verified 4/4 shadow cases · design plan status IMPLEMENTED",
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (e) {
    // [P2-class fix] no exception detail in public responses.
    console.error("[api/constituency] snapshot failed", {
      errorType: e instanceof Error ? e.name : typeof e,
    });
    return NextResponse.json(
      { error: "Constituency machinery snapshot failed" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
