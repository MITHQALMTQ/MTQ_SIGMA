// MTQΣ — DYNAMIC CONSTITUENCY MACHINERY API (Task M8-3c-b · surfacing M8-3a)
// ============================================================================
// A lightweight READ-ONLY GET that surfaces the QUIESCENT dynamic-membership
// machinery (src/lib/mtq/constituency/ — Task M8-3a) for the Pilot Command
// Center's Constituency section:
//   • the DEFAULT_REGISTRY's 7 genesis entries (code, type, genesis weight bp,
//     lifecycle state) — the ACTIVE basket remains the 7-component genesis set;
//   • the lifecycle-state legend + the T1–T9 transition/directive vocabulary;
//   • the QUIESCENT disclosure (NO transition has ever run);
//   • the honest-limits line (NO live scoring feeds; ALL lifecycle parameters
//     UNAPPROVED DRAFT; contract layer STATIC — V4 design plan PROPOSED).
//
// The machinery is IMPORTED READ-ONLY — this route mutates nothing, runs no
// transition, and applies no directive.
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

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;

const QUIESCENT_DISCLOSURE =
  "NO transition has ever run — the ACTIVE basket remains the 7-component genesis set at strategic-prior weights; " +
  "transitions fire only on governance directives with valid rule evidence, and none exists.";

const HONEST_LIMITS =
  "NO live scoring feeds — deterministic test fixtures only (BIS/AREAER/vendor ingestion does not exist; the " +
  "≥2-independent-family oracle precondition remains UNMET); ALL lifecycle parameters UNAPPROVED DRAFT " +
  "(spec §13 — D-13.11 / D-13.14 OPEN); the contract layer remains STATIC — the V4 dynamic-membership design " +
  "plan is PROPOSED (Gate-C / Task-12-gated).";

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
    return NextResponse.json(
      {
        banner:
          "TESTNET ONLY · SHADOW MODE ENFORCED · MACHINERY QUIESCENT · ALL PARAMETERS UNAPPROVED DRAFT · NOT ACCEPTED",
        module: "src/lib/mtq/constituency/ (Task M8-3a — dynamic-membership machinery, IMPLEMENTED)",
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
        honestLimits: {
          line: HONEST_LIMITS,
          parameterClass: LIFECYCLE_PARAMETER_CLASS,
          scoringFeedDisclosure: SCORING_FEED_DISCLOSURE,
          contractLayer: "STATIC — V4 dynamic-membership design plan PROPOSED (Gate-C / Task-12-gated)",
        },
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Constituency machinery snapshot failed", detail: String(e) },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
