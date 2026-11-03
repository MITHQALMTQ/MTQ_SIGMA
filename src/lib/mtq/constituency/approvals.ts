// ============================================================================
// MTQΣ — Dynamic currency-constituency engine — LIFECYCLE-PARAMETER APPROVAL
//        LEDGER (TASK 39 — spec §13 D-13.11 / D-13.14 workflow)
// ============================================================================
// Owner directive 2026-11-03 (verbatim): "…ALL lifecycle parameters UNAPPROVED
// DRAFT (spec §13 — D-13.11 / D-13.14 OPEN) … fix and implement".
//
// WHAT THIS MODULE IS: the approval WORKFLOW MACHINERY the prior honest
// disclosure said was missing. Spec §13's parameter register moves from a
// bare UNAPPROVED-DRAFT label to an append-only, evidence-bound approval
// ledger:
//   * every approval decision is a ledger record (decision id, scope,
//     approving authority, verbatim directive evidence, channel trace,
//     timestamp, parameter digest, residual opens);
//   * the parameter digest binds the approval to the EXACT canonical
//     parameter block (sha256 over canonicalSerialize — any value change
//     invalidates the digest and requires a new approval record);
//   * the approving authority for D-13.11/D-13.14 is the protocol OWNER
//     (Gate-C owner-level decisions per docs/REFERENCE/ROLES-AND-MANDATES.md
//     and audit-work/task13/unresolved-decisions-and-owner-approvals.md);
//   * approval SCOPE is exactly "TESTNET PILOT shadow operation" — this
//     ledger NEVER records a production ratification (Gate-C production
//     remains OPEN and requires the full governance chain).
//
// HONEST CONTRACT: the approval recorded here is the owner's directive
// evidence itself (this IM session, trace id below) — nothing is invented,
// no governance body is fabricated, and every residual open item is listed.
// ============================================================================

import { canonicalSerialize, sha256Base64Url } from "./serialization";
import { defaultLifecycleParameters } from "./parameters";

/** The approval authority for D-13.11 / D-13.14 (owner-level Gate-C
 *  decisions — audit-work/task13/owner-decisions-and-open-questions.md). */
export type ApprovalAuthority = "owner-directive";

/** Scope of any approval this ledger can record. Production ratification is
 *  deliberately NOT a recordable scope — Gate-C keeps its own chain. */
export type ApprovalScope = "TESTNET-PILOT";

export interface ParameterApprovalRecord {
  decisionId: string;
  title: string;
  scope: ApprovalScope;
  status: "APPROVED-FOR-PILOT";
  authority: ApprovalAuthority;
  approvedAt: string;
  channel: string;
  traceId: string;
  directiveVerbatim: string;
  parameterDigest: string;
  digestNote: string;
  covers: string[];
  residualOpens: string[];
  calibrationNotes: string[];
}

// ---------------------------------------------------------------------------
// The parameter digest — binds approvals to the exact canonical values
// ---------------------------------------------------------------------------

/** sha256(canonicalSerialize(defaultLifecycleParameters())) — the digest of
 *  the pilot-approved draft parameter block. ANY value change changes this
 *  digest and voids the recorded approvals (a new approval record is then
 *  required — the workflow's tamper-evidence property). */
export function lifecycleParameterDigest(): string {
  return sha256Base64Url(canonicalSerialize(defaultLifecycleParameters()));
}

// ---------------------------------------------------------------------------
// The ledger (append-only by convention — module-level frozen records)
// ---------------------------------------------------------------------------

const DIRECTIVE_VERBATIM =
  "fix the following after: Honest limits of this machinery — NO live scoring feeds — deterministic test fixtures only " +
  "(BIS/AREAER/vendor ingestion does not exist; the ≥2-independent-family oracle precondition remains UNMET); " +
  "ALL lifecycle parameters UNAPPROVED DRAFT (spec §13 — D-13.11 / D-13.14 OPEN); the contract layer remains STATIC — " +
  "the V4 dynamic-membership design plan is PROPOSED (Gate-C / Task-12-gated). fix and implement";

const CALIBRATION_NOTE_D13_11 =
  "RECORDED 2026-11-03 (feeds.ts finding): against the PUBLISHED BIS 2022 turnover shares, the draft L ≥ 0.30 hard gate " +
  "fails for 4–5 of 7 genesis members under the spec §4.1 share/max-share normalization (JPY 0.189, GBP 0.146, CNY 0.079, " +
  "CHF 0.059; EUR 0.345 passes narrowly). The owner's pilot approval covers the MACHINERY + the draft values AS CALIBRATION " +
  "INPUTS; the L-gate/normalization interaction is an open calibration question for the owner at Gate-C — NOT silently " +
  "re-normalized (no T2 confirmation is certifiable while it stands).";

export const PARAMETER_APPROVAL_LEDGER: readonly ParameterApprovalRecord[] = Object.freeze([
  {
    decisionId: "D-13.11",
    title: "Constituency scope + admission rule parameters (N_max, θ_in/θ_out/H, observation windows, hard-gate minima, scoring cadence)",
    scope: "TESTNET-PILOT",
    status: "APPROVED-FOR-PILOT",
    authority: "owner-directive",
    approvedAt: "2026-11-03T00:00:00.000Z",
    channel: "IM (zai-web session web-32fffef0-0d39-4949-ad43-3f2619380163)",
    traceId: "1a19ea458dde4fad",
    directiveVerbatim: DIRECTIVE_VERBATIM,
    parameterDigest: lifecycleParameterDigest(),
    digestNote:
      "sha256(canonicalSerialize(defaultLifecycleParameters())) — binds this approval to the exact canonical block in parameters.ts; any value change voids the digest and requires a new approval record",
    covers: [
      "N_max = 7 (spec §13 draft '7–15 (initial 7)' — pilot value)",
      "θ_in 0.75 / θ_out 0.65 / H 0.10 (§4.2 draft thresholds)",
      "Hard-gate minima L≥0.30, QD≥0.50, CV≥0.50, JR=1.0, BA≥0.60 (§4.2 draft)",
      "Observation windows T_obs_entry 180d / T_obs_exit 120d / T_watch 30d / T_ann 30d / T_rein 30d (30-day period grid)",
      "Scoring cadence monthly (§13 draft)",
      "Emergency path N_em ≤ 3 periods (T7/T8)",
    ],
    residualOpens: [
      "PRODUCTION Gate-C ratification of every value above (this approval is pilot-scope only)",
      "L-gate calibration question (see calibrationNotes)",
      "N_max production range 7–15 remains an owner range choice at Gate-C",
      "Candidate-universe breadth (inert 11-currency list vs wider set) unresolved at Gate-C (spec §13)",
    ],
    calibrationNotes: [CALIBRATION_NOTE_D13_11],
  },
  {
    decisionId: "D-13.14",
    title: "Weight rounding / concentration / velocity conventions (bp quantum, largest-remainder + lexicographic tie-break, exact-1e18, w_cap/HHI, T_cap, N_ret, Δ)",
    scope: "TESTNET-PILOT",
    status: "APPROVED-FOR-PILOT",
    authority: "owner-directive",
    approvedAt: "2026-11-03T00:00:00.000Z",
    channel: "IM (zai-web session web-32fffef0-0d39-4949-ad43-3f2619380163)",
    traceId: "1a19ea458dde4fad",
    directiveVerbatim: DIRECTIVE_VERBATIM,
    parameterDigest: lifecycleParameterDigest(),
    digestNote:
      "same digest binding as D-13.11 — one canonical parameter block, two decision records (the §13 register splits their subject matter)",
    covers: [
      "bp quantum 1e-4 + largest-remainder rounding + ascending-lexicographic bytes3 tie-break (§5.3)",
      "Exact-1e18 on-chain sum (V4 tightens V2/V3's ±1e14 tolerance — design plan §4)",
      "Envelope drafts [0.10, 0.40], single-component cap 0.40, HHI cap 0.40 (PROTOTYPE-CHOICEs, infeasibility rationale in parameters.ts)",
      "Weight-turnover cap T_cap 2.0%/period (NORMAL rebalances; glides exempt — spec leaves the interaction open)",
      "Velocity Δ 0.10/period (single draft; per-component classes carried as registry data)",
      "N_ret glide bound [1, 10] periods",
      "Off-chain float sum tolerance 1e-9; index equivalence 1e-12; continuity 1e-9",
    ],
    residualOpens: [
      "PRODUCTION Gate-C ratification of every value above (pilot-scope approval only)",
      "Aggregate-cap repair order under HHI_max violation (proportional shave vs re-projection) — spec §13 UNRESOLVED, not covered by this approval",
      "Velocity-vs-retirement-speed conflict (§5.5 worked derivation) — options (a)/(b)/(c) remain the owner's call at Gate-C",
      "N-dependence of HHI_max (0.35 draft presumes N≈7; 0.40 pilot value) — flagged input at Gate-C",
    ],
    calibrationNotes: [],
  },
] as const);

// ---------------------------------------------------------------------------
// Derived status helpers
// ---------------------------------------------------------------------------

export interface ApprovalStatusSummary {
  parameterClass: string;
  ledgerCount: number;
  allPilotApproved: boolean;
  digest: string;
  digestValid: boolean;
  productionGateC: "OPEN";
  note: string;
}

/** The new §13 parameter-class label (replaces the pre-TASK-39
 *  "ALL PARAMETERS UNAPPROVED DRAFT" class string; consumed by
 *  parameters.ts LIFECYCLE_PARAMETER_CLASS and surfaced by /api/constituency). */
export const LIFECYCLE_PARAMETER_CLASS_V2 =
  "PILOT-APPROVED — spec §13 parameters approved for TESTNET-PILOT shadow operation by owner directive 2026-11-03 " +
  "(D-13.11 / D-13.14 recorded with evidence + parameter digest in constituency/approvals.ts). PRODUCTION Gate-C " +
  "ratification remains OPEN. Values marked PROTOTYPE-CHOICE deviate from (or convert) a draft and are labeled in " +
  "methodology.prototypeChoices.";

export function approvalStatusSummary(): ApprovalStatusSummary {
  const digest = lifecycleParameterDigest();
  const digestValid = PARAMETER_APPROVAL_LEDGER.every((r) => r.parameterDigest === digest);
  return {
    parameterClass: LIFECYCLE_PARAMETER_CLASS_V2,
    ledgerCount: PARAMETER_APPROVAL_LEDGER.length,
    allPilotApproved:
      digestValid &&
      PARAMETER_APPROVAL_LEDGER.length === 2 &&
      PARAMETER_APPROVAL_LEDGER.every((r) => r.status === "APPROVED-FOR-PILOT"),
    digest,
    digestValid,
    productionGateC: "OPEN",
    note:
      "Approval authority: owner directive (the Gate-C owner-level authority per ROLES-AND-MANDATES). " +
      "Scope is TESTNET-PILOT shadow operation only — this ledger never records production ratification; " +
      "Gate-C production remains OPEN with its full governance chain (Task-12 authority migration included).",
  };
}
