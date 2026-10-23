// ============================================================================
// MTQΣ — MANDATE-007 §4 · Task 2-b · STEP 2 — ISSUANCE STATE MACHINE
// (NON-PRODUCTION prototype of the spec §14.4 12-step minting workflow)
// ============================================================================
// MODULE LABEL: **NON-PRODUCTION PROTOTYPE — NOT A LIVE ISSUANCE SYSTEM.**
// This file prototypes the minting-workflow state machine specified at
// `audit-work/task13/payment-instrument-registry-and-settlement-spec.md` §14.4
// (12-step mapping of MANDATE-006 §7.5) as an EXPLICIT state machine, plus the
// spec §6 settlement requirements it consumes (§6.1 quotes/expiry, §6.2
// per-rail finality, §6.3 refunds, §6.4 idempotency keys, §6.5 three-book
// reconciliation, §6.6 exception taxonomy).
//
// "ISSUED" IN THIS PROTOTYPE IS A LEDGER RECORD ONLY — NO ON-CHAIN ACTION, NO
// NETWORK CALL, NO KEY HANDLING, NO REAL TOKEN EXISTS. Zero on-chain actions
// are performed anywhere in this file.
//
// D-13.27 (OPEN): the payment→issuance authorization model. NO ALTERNATIVE IS
// SELECTED. Four adapter stubs ALT-1..ALT-4 are provided (spec §14.6); the
// prototype defaults to ALT-2 (approval-per-issuance) FOR TESTING ONLY — the
// default exists ONLY so the tests can demonstrate the COMMON INVARIANTS; it
// is NOT a selection and D-13.27 REMAINS OPEN.
//
// COMMON INVARIANTS under EVERY alternative (spec §14.6) — enforced here as
// machine-level invariants and asserted by run-issuance-e2e.ts:
//   (INV-A) settlement finality AND an explicit authorization record BOTH
//           precede issuance — a payment event ALONE can NEVER reach ISSUED;
//   (INV-B) failed/unverified payments never mint;
//   (INV-C) replays/retries/duplicates never double-mint (idempotency, spec §6.4);
//   (INV-D) reversal after issuance → RECONCILIATION exception + pipeline
//           SUSPENDED flag — no silent re-mint, no silent write-off;
//   (INV-E) settlement timing, reversal semantics, failure recovery, and
//           issuance transaction boundaries remain OPEN implementation
//           decisions (encoded as TODO-decision constants, D-13.27/spec §6).
//
// 7-LAYER FINALITY VOCABULARY (read-only reference: src/lib/mtq/finality.ts,
// src/lib/finality-before-mint.ts — NOT imported, cited for vocabulary only):
// this prototype encodes the payment-specific subset — L1 request
// validation/idempotency/replay protection, L2 workflow state machine, L3
// policy (instrument/jurisdiction/depeg/supply), L4 AUTHORIZATION record,
// L5 ledger states, L6 single-commit record writes (in-memory analog). L7
// (smart-contract finality gate) is DELIBERATELY ABSENT: no smart contract is
// involved, no chain action occurs, and none is simulated as an on-chain act.
//
// THREE-BOOK VOCABULARY (read-only reference: src/lib/three-book-separation.ts):
// the prototype's reconciliation is the PAYMENT-LAYER three-way check of spec
// §6.5 (initiator/payment book vs acquirer/issuance book vs token book) — a
// structural analog of, and deliberately distinct from, the corporate Book A/B/C.
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// ============================================================================

import {
  classifyDepegBand,
  type DepegBand,
  type DepegObservation,
  type PrototypeInstrumentRegistry,
} from "./instrument-registry";

export type { DepegBand, DepegObservation } from "./instrument-registry";

// ----------------------------------------------------------------------------
// §0 — Honest labels & OPEN implementation decisions (INV-E)
// ----------------------------------------------------------------------------

export const MACHINE_PROTOTYPE_LABEL =
  "NON-PRODUCTION PROTOTYPE of spec §14.4 (12-step minting workflow) + spec §6 settlement requirements. " +
  "Issuance is a LEDGER RECORD ONLY — NO ON-CHAIN ACTION, NO NETWORK CALL, NO REAL TOKEN."

export const D_13_27_STATUS =
  "OPEN — NO ALTERNATIVE IS SELECTED. ALT-1 (authorized-issuance window) · ALT-2 (approval-per-issuance) · " +
  "ALT-3 (rule-bound programmatic issuance — requires an explicit D-13.6 exception clause) · ALT-4 (hybrid + " +
  "periodic attestation) all remain OPEN under decision D-13.27. This prototype implements the COMMON " +
  "INVARIANTS under every alternative and defaults to ALT-2 FOR TESTING ONLY — NOT a selection."

/** TODO-decision constants — OPEN implementation decisions encoded per INV-E. */
export interface OpenImplementationDecision {
  decisionId: string;
  open: true;
  summary: string;
  specRefs: string[];
  prototypeChoiceLabeled: string;
}

export const OPEN_IMPLEMENTATION_DECISIONS: readonly OpenImplementationDecision[] = [
  {
    decisionId: "DEC-SETTLEMENT-TIMING",
    open: true,
    summary:
      "When must settlement finality arrive relative to quote expiry, and how are late-but-settled payments handled " +
      "(held vs refunded)? Quote expiry is hard-enforced before settlement confirmation in this prototype; delayed " +
      "settlement lands in EXPIRED_QUOTE with the payment queued for refund (spec §6.3 same-key auto-refund) — " +
      "the held-vs-refunded choice itself is OPEN.",
    specRefs: ["D-13.27", "spec §6.1 (quote expiry — hard-rejected after expiry)", "spec §6.6 CONFIRMATION_TIMEOUT", "spec §6.3"],
    prototypeChoiceLabeled:
      "PROTOTYPE CHOICE (LABELED, NOT APPROVED): expiry checked at settlement confirmation; delayed payment → " +
      "HELD_IN_REFUND_QUEUE (refund state machine per spec §6.3)",
  },
  {
    decisionId: "DEC-REVERSAL-SEMANTICS",
    open: true,
    summary:
      "What are the semantics of a payment reversal that arrives after issuance (re-mint? claw-back? burn? " +
      "operator adjudication?) — none are defined; the prototype fail-closes: RECONCILIATION exception + pipeline " +
      "SUSPENDED, mint record preserved, NO silent re-mint, NO silent write-off.",
    specRefs: ["D-13.27", "spec §6.3", "spec §6.5", "spec §6.6 RECONCILE_MISMATCH", "spec §14.4 step 12"],
    prototypeChoiceLabeled:
      "PROTOTYPE CHOICE (LABELED, NOT APPROVED): fail-closed suspension + exception queue; adjudication left OPEN",
  },
  {
    decisionId: "DEC-FAILURE-RECOVERY",
    open: true,
    summary:
      "How are failed/expired/unauthorized payments recovered (auto-refund timing, retry policy, compensation " +
      "authority)? The prototype queues refunds deterministically and forbids retry on the same idempotency key; " +
      "the real recovery process is OPEN.",
    specRefs: ["D-13.27", "spec §6.3", "spec §6.6", "issuance-burn-and-market-mechanism-spec.md §2.8"],
    prototypeChoiceLabeled:
      "PROTOTYPE CHOICE (LABELED, NOT APPROVED): PENDING_REFUND → REFUNDED same-key refund queue; retry on same key forbidden",
  },
  {
    decisionId: "DEC-ISSUANCE-TRANSACTION-BOUNDARIES",
    open: true,
    summary:
      "Where are the atomic transaction boundaries when payment settlement and token issuance live in different " +
      "systems (spec §14.4 hard rules: safe state machine + idempotency + exception handling + compensating " +
      "process are mandatory)? The prototype performs each step as a single in-memory commit (L6 analog); real " +
      "cross-system boundaries are OPEN.",
    specRefs: ["D-13.27", "spec §14.4 hard rules", "spec §6.6", "finality-before-mint.ts L6 (vocabulary reference)"],
    prototypeChoiceLabeled:
      "PROTOTYPE CHOICE (LABELED, NOT APPROVED): per-step single-commit records; no cross-system atomicity is claimed",
  },
];

// ----------------------------------------------------------------------------
// §1 — Fixed-point money helpers (6-decimal micro units, BigInt-exact)
// ----------------------------------------------------------------------------

export const MICRO = 1_000_000n;

/** Format a 6-decimal micro amount as an exact decimal string. */
export function fmt6(micro: bigint): string {
  const neg = micro < 0n;
  const abs = neg ? -micro : micro;
  const whole = abs / MICRO;
  const frac = abs % MICRO;
  return `${neg ? "-" : ""}${whole.toString(10)}.${frac.toString(10).padStart(6, "0")}`;
}

/** Round-half-to-even BigInt division (banker's rounding — PROPOSED rule, spec §6.1/D-13.19). */
export function divRoundHalfEven(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new Error("divRoundHalfEven: non-positive divisor");
  if (a < 0n) throw new Error("prototype uses non-negative amounts only");
  const q = a / b;
  const r = a % b;
  const twice = r * 2n;
  if (twice > b) return q + 1n;
  if (twice < b) return q;
  return q % 2n === 0n ? q : q + 1n;
}

// ----------------------------------------------------------------------------
// §2 — SYNTHETIC IN-PROCESS AUTHENTICITY SCHEME (step 4a; clearly TEST-ONLY)
// ----------------------------------------------------------------------------

/**
 * TEST-ONLY key literal. This is NOT a secret, NOT a credential, and NOT used
 * for anything except the in-process synthetic authenticity demonstration. It
 * is published in this source file on purpose (a real secret would never be
 * committed; this literal is explicitly not one). Production payment
 * authenticity requires REAL signature verification per rail (spec §6.2) —
 * e.g. stablecoin rail message signatures / issuer attestations, or the CBDC
 * authorized-interface verification — none of which exist here.
 */
export const TEST_ONLY_AUTH_KEY_LITERAL = "TEST-ONLY-NOT-A-SECRET";

export const AUTH_SCHEME_LABEL =
  "SYNTHETIC IN-PROCESS AUTHENTICITY SCHEME — an HMAC-STYLE tag computed in-process with a TEST-ONLY literal key. " +
  "NOT cryptographic. Tags are deliberately truncated to 16 hex characters so that no 64-char hex literal is ever " +
  "produced anywhere in this prototype. PRODUCTION REQUIRES REAL PER-RAIL SIGNATURE VERIFICATION (spec §6.2)."

/** FNV-1a 64-bit (in-process, deterministic, non-cryptographic). */
function fnv1a64(input: string): bigint {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < input.length; i++) {
    h ^= BigInt(input.charCodeAt(i) & 0xff);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h;
}

/** Synthetic HMAC-style tag: "TEST-TAG-" + exactly 16 hex chars (never 64). */
export function computeSyntheticAuthTag(key: string, canonicalPayload: string): string {
  const mixed = fnv1a64(`${key}|${canonicalPayload}`) ^ fnv1a64(`${canonicalPayload}|${key}`);
  return `TEST-TAG-${mixed.toString(16).padStart(16, "0")}`;
}

/** Canonical payment payload for the synthetic tag (spec §6.4-style canonical fields). */
export function canonicalPaymentPayload(p: {
  paymentTxId: string;
  instrumentCode: string;
  network: string;
  payerId: string;
  amountMicro: bigint;
  observedAtMs: number;
}): string {
  return [
    p.paymentTxId,
    p.instrumentCode,
    p.network,
    p.payerId,
    p.amountMicro.toString(10),
    p.observedAtMs.toString(10),
  ].join("|");
}

// ----------------------------------------------------------------------------
// §3 — States (mapped to spec §14.4 step numbers) + transition table
// ----------------------------------------------------------------------------

export type IssuanceState =
  | "REQUEST_CREATED" // §14.4 steps 1 & 3 — instrument selection + user issuance request
  | "QUOTED" // §14.4 step 2 — quote id, price basis, expiry, quote-unit conversion
  | "PAYMENT_OBSERVED" // payment event intake (pre-4a)
  | "PAYMENT_AUTHENTIC" // §14.4 step 4a — authenticity verification
  | "SETTLEMENT_FINAL" // §14.4 step 4b — rail-specific finality (spec §6.2)
  | "INSTRUMENT_CHECKED" // §14.4 step 5 — instrument/jurisdiction/depeg checks AT SETTLEMENT TIME (not just quote time)
  | "FEES_CALCULATED" // §14.4 step 7 — fee schedule UNAPPROVED (D-13.8) — illustrative placeholder rates
  | "NET_ACCEPTED" // §14.4 steps 6 & 8 — quote-unit conversion + net accepted payment value
  | "AUTHORIZED" // §14.4 step 9 — an EXPLICIT authorization record MUST exist (D-13.27 pluggable model)
  | "SUPPLY_CHECKED" // §14.4 step 9b — tranche cap + global max supply + per-tx cap (fail-closed)
  | "ISSUED" // §14.4 step 10 — idempotent mint record (LEDGER RECORD ONLY)
  | "RECONCILED" // §14.4 step 11 — three-book reconciliation (spec §6.5)
  // ---- terminal failure states (mapped to the spec §6.6 exception taxonomy) ----
  | "DUPLICATE" // duplicate idempotency key / payment txId (spec §6.4, §6.6 DUPLICATE_KEY_COLLISION)
  | "EXPIRED_QUOTE" // delayed payment: settlement after quote expiry (spec §6.1; §6.6 CONFIRMATION_TIMEOUT analog)
  | "PAYMENT_FAILED" // settlement FAILED / TIMEOUT / finality-evidence gap (spec §6.3, §6.6)
  | "PAYMENT_REVERSED" // reversal before issuance → cancel, no mint (spec §6.3)
  | "UNAUTHORIZED" // settlement final but NO authorization record (D-13.27 — payment alone never mints)
  | "INVALID_INSTRUMENT" // not in registry / REVOKED / other-network instance / jurisdiction / depeg (step 5)
  | "INVALID_PAYMENT" // authenticity-tag failure / amount mismatch (§6.6 PARTIAL_SETTLEMENT analog)
  | "SUPPLY_CAP_EXCEEDED" // tranche / global-max / per-tx cap (step 9b, fail-closed)
  | "RECONCILIATION_BREAK"; // three-book divergence (§6.5/§6.6 RECONCILE_MISMATCH; also reversal-after-issuance)

export const TERMINAL_STATES: readonly IssuanceState[] = [
  "DUPLICATE",
  "EXPIRED_QUOTE",
  "PAYMENT_FAILED",
  "PAYMENT_REVERSED",
  "UNAUTHORIZED",
  "INVALID_INSTRUMENT",
  "INVALID_PAYMENT",
  "SUPPLY_CAP_EXCEEDED",
  "RECONCILIATION_BREAK",
];

export function isTerminal(s: IssuanceState): boolean {
  return TERMINAL_STATES.includes(s);
}

/** Spec §14.4 step references per state (printed in the audit log; step 12 = publication). */
export const STATE_STEP_REFS: Readonly<Record<IssuanceState, string>> = {
  REQUEST_CREATED: "§14.4 steps 1+3 (instrument selection; user issuance request)",
  QUOTED: "§14.4 step 2 (quote calculation and expiry)",
  PAYMENT_OBSERVED: "§14.4 step 4 (payment event intake)",
  PAYMENT_AUTHENTIC: "§14.4 step 4a (payment authenticity verification)",
  SETTLEMENT_FINAL: "§14.4 step 4b (settlement-finality confirmation, spec §6.2)",
  INSTRUMENT_CHECKED: "§14.4 step 5 (instrument/jurisdiction/depeg checks at settlement time)",
  FEES_CALCULATED: "§14.4 step 7 (fee calculation — rates UNAPPROVED, D-13.8 OPEN)",
  NET_ACCEPTED: "§14.4 steps 6+8 (quote-unit conversion; net accepted payment value)",
  AUTHORIZED: "§14.4 step 9 (issuance authorization — explicit record required; D-13.27 OPEN)",
  SUPPLY_CHECKED: "§14.4 step 9b (supply-limit checks — fail-closed)",
  ISSUED: "§14.4 step 10 (token issuance — idempotent LEDGER RECORD ONLY)",
  RECONCILED: "§14.4 step 11 (payment & issuance reconciliation, spec §6.5)",
  DUPLICATE: "§14.4 step 12 (failure path) — spec §6.4/§6.6 DUPLICATE_KEY_COLLISION",
  EXPIRED_QUOTE: "§14.4 step 12 (failure path) — spec §6.1/§6.6 CONFIRMATION_TIMEOUT analog",
  PAYMENT_FAILED: "§14.4 step 12 (failure path) — spec §6.3/§6.6",
  PAYMENT_REVERSED: "§14.4 step 12 (failure path) — spec §6.3 (reversal before issuance)",
  UNAUTHORIZED: "§14.4 step 12 (failure path) — D-13.27: payment alone never mints",
  INVALID_INSTRUMENT: "§14.4 step 12 (failure path) — step 5 rejection",
  INVALID_PAYMENT: "§14.4 step 12 (failure path) — step 4a/4b rejection (§6.6 PARTIAL_SETTLEMENT analog)",
  SUPPLY_CAP_EXCEEDED: "§14.4 step 12 (failure path) — step 9b fail-closed",
  RECONCILIATION_BREAK: "§14.4 step 12 (failure path) — spec §6.5/§6.6 RECONCILE_MISMATCH",
};

/** EXPLICIT transition table — the state machine core. */
export const ALLOWED_TRANSITIONS: Readonly<Record<IssuanceState, readonly IssuanceState[]>> = {
  REQUEST_CREATED: ["QUOTED", "INVALID_INSTRUMENT", "DUPLICATE"],
  QUOTED: ["PAYMENT_OBSERVED", "EXPIRED_QUOTE", "PAYMENT_REVERSED", "DUPLICATE"],
  PAYMENT_OBSERVED: ["PAYMENT_AUTHENTIC", "INVALID_PAYMENT", "DUPLICATE", "PAYMENT_REVERSED"],
  PAYMENT_AUTHENTIC: ["SETTLEMENT_FINAL", "PAYMENT_FAILED", "EXPIRED_QUOTE", "INVALID_PAYMENT", "PAYMENT_REVERSED"],
  SETTLEMENT_FINAL: ["INSTRUMENT_CHECKED", "INVALID_INSTRUMENT", "INVALID_PAYMENT", "PAYMENT_REVERSED"],
  INSTRUMENT_CHECKED: ["FEES_CALCULATED", "PAYMENT_REVERSED"],
  FEES_CALCULATED: ["NET_ACCEPTED", "PAYMENT_REVERSED"],
  NET_ACCEPTED: ["AUTHORIZED", "UNAUTHORIZED", "PAYMENT_REVERSED"],
  AUTHORIZED: ["SUPPLY_CHECKED", "SUPPLY_CAP_EXCEEDED", "PAYMENT_REVERSED"],
  SUPPLY_CHECKED: ["ISSUED", "SUPPLY_CAP_EXCEEDED", "PAYMENT_REVERSED"],
  ISSUED: ["RECONCILED", "RECONCILIATION_BREAK"],
  RECONCILED: ["RECONCILIATION_BREAK"],
  DUPLICATE: [],
  EXPIRED_QUOTE: [],
  PAYMENT_FAILED: [],
  PAYMENT_REVERSED: [],
  UNAUTHORIZED: [],
  INVALID_INSTRUMENT: [],
  INVALID_PAYMENT: [],
  SUPPLY_CAP_EXCEEDED: [],
  RECONCILIATION_BREAK: [],
};

/** spec §6.6 exception taxonomy classes for terminal outcomes. */
export type ExceptionTaxonomyClass =
  | "DUPLICATE_KEY_COLLISION"
  | "CONFIRMATION_TIMEOUT"
  | "REORG_ROLLBACK"
  | "FINALITY_EVIDENCE_GAP"
  | "RECONCILE_MISMATCH"
  | "ISSUER_EVENT"
  | "PARTIAL_SETTLEMENT"
  | "REVERSAL_AFTER_ISSUANCE"
  | "SUPPLY_CAP"
  | "AUTHORIZATION_MISSING"
  | "INSTRUMENT_INVALID";

// ----------------------------------------------------------------------------
// §4 — Records (quote / payment / settlement / authorization / mint / books)
// ----------------------------------------------------------------------------

export const QUOTE_POLICY_LABEL =
  "ILLUSTRATIVE QUOTE POLICY — spec §14.5: MTQΣ issued = net accepted payment value in the approved quote unit ÷ " +
  "approved MTQΣ issuance quote. The exact issuance-pricing policy remains subject to EXPLICIT OWNER APPROVAL; " +
  "the formula is illustrative, not approved economic policy; an index-derived quote does NOT guarantee the " +
  "token will later trade at that value (three-measurement separation)."

export const FEE_SCHEDULE_LABEL =
  "ILLUSTRATIVE — D-13.8 OPEN: 0.10% flat placeholder. The fee schedule (rates, recipients, exemptions, caps, " +
  "change governance) is UNAPPROVED; no fee is charged anywhere outside this non-production prototype."

export interface QuoteRecord {
  quoteId: string;
  instrumentCode: string;
  network: string;
  side: "ISSUANCE";
  grossInstrumentAmountMicro: bigint;
  conversionPricePerUnitMicro: bigint; // instrument unit → quote unit (SYNTHETIC-ORACLE-BOARD basis)
  grossTUMicroPreview: bigint; // step-6 preview; re-derived at NET_ACCEPTED
  quoteTUPerTokenMicro: bigint; // issuance quote: quote units per 1.0 token
  feeClass: string;
  feeRateBps: bigint;
  spreadDisclosureBps: bigint; // explicit line item (no undisclosed spread, spec §6.1)
  roundingRule: string;
  createdAtMs: number;
  expiresAtMs: number;
  syntheticQuoteTag: string; // quotes are replay-protected (spec §6.1: signed + replay-protected)
  labels: string[];
}

export interface PaymentRecord {
  paymentTxId: string;
  instrumentCode: string;
  network: string;
  payerId: string;
  amountMicro: bigint;
  observedAtMs: number;
  authTag: string;
  canonicalPayload: string;
}

export interface SettlementRecord {
  status: "SETTLED" | "FAILED" | "REVERSED" | "TIMEOUT";
  confirmations: number | null;
  issuerSanityCheckPassed: boolean | null;
  settledAmountMicro: bigint | null;
  finalityAtMs: number | null;
  sourceLabel: string;
  depegBand: DepegBand;
  pegDeviationBps: number;
  sustainedHours: number;
  finalityBasisLabel: string;
}

export interface AuthorizationRecord {
  authorizationId: string;
  requestId: string;
  modelId: AltId;
  decision: "APPROVED";
  approverOrScope: string;
  decidedAtMs: number;
  evidenceRefs: string[];
  label: string;
}

export interface MintRecord {
  mintId: string;
  nonce: number; // monotonic mint nonce (replay protection, spec §6.4)
  idempotencyKey: string;
  requestId: string;
  quoteId: string;
  recipientId: string;
  amountMicro: bigint;
  issuedAtMs: number;
  recordOnlyLabel: string;
}

export interface PaymentBookEntry {
  requestId: string;
  paymentTxId: string;
  grossTUMicro: bigint;
  feeMicro: bigint;
  netTUMicro: bigint;
  status: "SETTLED" | "REVERSED_POST_ISSUANCE";
}

export interface IssuanceBookEntry {
  requestId: string;
  mintId: string;
  issuedMicro: bigint;
  feeMicro: bigint;
  netTUMicro: bigint;
  grossTUMicro: bigint;
  authorizationId: string;
  quoteId: string;
}

export interface TokenBookEntry {
  mintId: string;
  requestId: string;
  recipientId: string;
  amountMicro: bigint;
}

export interface ExceptionRecord {
  exceptionId: string;
  requestId: string | null;
  taxonomyClass: ExceptionTaxonomyClass;
  reasonCode: string;
  openedAtMs: number;
  status: "OPEN";
  notes: string;
}

export interface RefundRecord {
  refundId: string;
  requestId: string;
  paymentTxId: string;
  idempotencyKey: string; // SAME key as the original operation (spec §6.3)
  grossInstrumentAmountMicro: bigint;
  reasonCode: string;
  state: "PENDING_REFUND" | "REFUNDED";
  createdAtMs: number;
}

export interface EventLogEntry {
  seq: number;
  atMs: number;
  requestId: string;
  from: IssuanceState | null;
  to: IssuanceState | null;
  stepRef: string;
  reasonCode: string;
  detail: string;
  taxonomyClass: ExceptionTaxonomyClass | null;
}

// ----------------------------------------------------------------------------
// §5 — D-13.27 authorization-model stubs (ALT-1..ALT-4; NONE SELECTED)
// ----------------------------------------------------------------------------

export type AltId = "ALT-1" | "ALT-2" | "ALT-3" | "ALT-4";

export interface AuthorizationDecisionInput {
  requestId: string;
  instrumentCode: string;
  network: string;
  netTUMicro: bigint;
  prospectiveIssuedMicro: bigint;
  atMs: number;
}

export interface AuthorizationDecision {
  approved: boolean;
  reasonCode: string;
  scopeEvidence: string;
}

export interface AuthorizationModelStub {
  readonly altId: AltId;
  readonly label: string;
  readonly d1327Status: "OPEN — NOT SELECTED (D-13.27)";
  readonly notes: string;
  decide(input: AuthorizationDecisionInput): AuthorizationDecision;
}

/** ALT-1 — Authorized-issuance-window model (spec §14.6 ALT-1). STUB — NOT SELECTED. */
export class Alt1WindowModel implements AuthorizationModelStub {
  readonly altId = "ALT-1" as const;
  readonly label =
    "ALT-1 — authorized-issuance-window: governance pre-authorizes tranches (per-tranche token caps, quote policy, " +
    "eligible instruments, window duration, disclosure). Payments settled inside an active window mint against the " +
    "tranche; payments OUTSIDE any window are held-or-refunded, NEVER minted. STUB FOR TESTING — NOT SELECTED."
  readonly d1327Status = "OPEN — NOT SELECTED (D-13.27)" as const;
  readonly notes =
    "Consistent with D-13.6 as worded (each window = an explicit governed act). Friction: governance cadence " +
    "scales with demand. THIS STUB DEMONSTRATES: no active window ⇒ NO authorization ⇒ payment alone never mints."
  constructor(private readonly windows: readonly IssuanceWindow[]) {}
  decide(input: AuthorizationDecisionInput): AuthorizationDecision {
    const w = this.windows.find(
      (x) =>
        x.active &&
        input.atMs >= x.startMs &&
        input.atMs <= x.endMs &&
        x.instruments.some((i) => i.code === input.instrumentCode && i.network === input.network) &&
        x.remainingCapMicro >= input.prospectiveIssuedMicro,
    );
    if (!w) {
      return {
        approved: false,
        reasonCode: "NO_ACTIVE_ISSUANCE_WINDOW — payments outside any authorized window NEVER mint (ALT-1)",
        scopeEvidence: "none",
      };
    }
    return {
      approved: true,
      reasonCode: "APPROVED_WITHIN_ACTIVE_WINDOW",
      scopeEvidence: `window ${w.windowId} (tranche cap ${fmt6(w.trancheCapMicro)} TU-equiv, disclosure recorded)`,
    };
  }
}

/** ALT-2 — Approval-per-issuance model (spec §14.6 ALT-2). STUB — DEFAULT FOR TESTING ONLY. */
export class Alt2ApprovalPerIssuanceModel implements AuthorizationModelStub {
  readonly altId = "ALT-2" as const;
  readonly label =
    "ALT-2 — approval-per-issuance: EVERY issuance requires an explicit authority action AFTER settlement evidence " +
    "is recorded (issuance request queue → authorized signer/multisig approval → mint). STUB FOR TESTING — " +
    "DEFAULT FOR TESTING ONLY — NOT SELECTED (D-13.27 OPEN)."
  readonly d1327Status = "OPEN — NOT SELECTED (D-13.27)" as const;
  readonly notes =
    "Strongest control; slowest; closest to 'controlled, authorized operation' in the narrowest sense. " +
    "THIS STUB DEMONSTRATES the payment-alone-never-mints invariant most directly: no approval record ⇒ " +
    "NO authorization ⇒ UNAUTHORIZED terminal."
  constructor(private readonly approvals: ReadonlyMap<string, { approverId: string; note: string; approvedAtMs: number }>) {}
  decide(input: AuthorizationDecisionInput): AuthorizationDecision {
    const rec = this.approvals.get(input.requestId);
    if (!rec) {
      return {
        approved: false,
        reasonCode: "NO_AUTHORIZATION_RECORD — a payment event alone can NEVER create one (ALT-2, D-13.27)",
        scopeEvidence: "none",
      };
    }
    return {
      approved: true,
      reasonCode: "APPROVED_PER_ISSUANCE",
      scopeEvidence: `explicit approval by ${rec.approverId} at ${rec.approvedAtMs}ms (note: ${rec.note})`,
    };
  }
}

/** ALT-3 — Rule-bound programmatic issuance (spec §14.6 ALT-3). STUB — NOT SELECTED. */
export class Alt3RuleBoundProgramModel implements AuthorizationModelStub {
  readonly altId = "ALT-3" as const;
  readonly label =
    "ALT-3 — rule-bound programmatic issuance: governance approves a BINDING issuance rule (quote derivation, " +
    "per-period/per-transaction caps, instrument list, circuit breakers, disclosure events) and the program mints " +
    "within the rule. STUB FOR TESTING — NOT SELECTED."
  readonly d1327Status = "OPEN — NOT SELECTED (D-13.27)" as const;
  readonly notes =
    "⚠ ALT-3 requires an EXPLICIT EXCEPTION CLAUSE in the D-13.6 wording (the rule-bound program IS an " +
    "operational-metric response, pre-authorized): D-13.6 must be revised/excepted by the same owner decision " +
    "that adopts ALT-3. Caps/circuit-breakers must be fail-closed (enforced in this stub)."
  constructor(private readonly rule: IssuanceRule | null) {}
  decide(input: AuthorizationDecisionInput): AuthorizationDecision {
    if (!this.rule) {
      return {
        approved: false,
        reasonCode: "NO_BOUND_RULE — no pre-authorized program exists ⇒ no authorization (ALT-3)",
        scopeEvidence: "none",
      };
    }
    if (this.rule.circuitBreakerArmed) {
      return {
        approved: false,
        reasonCode: "CIRCUIT_BREAKER_ARMED — fail-closed (ALT-3)",
        scopeEvidence: `rule ${this.rule.ruleId} breaker armed`,
      };
    }
    const instrumentOk = this.rule.instruments.some(
      (i) => i.code === input.instrumentCode && i.network === input.network,
    );
    if (!instrumentOk) {
      return {
        approved: false,
        reasonCode: "INSTRUMENT_NOT_IN_BOUND_RULE (ALT-3, fail-closed)",
        scopeEvidence: `rule ${this.rule.ruleId} instrument list`,
      };
    }
    if (input.prospectiveIssuedMicro > this.rule.perTxCapMicro) {
      return { approved: false, reasonCode: "PER_TX_RULE_CAP_EXCEEDED (ALT-3, fail-closed)", scopeEvidence: `rule ${this.rule.ruleId}` };
    }
    if (this.rule.issuedInPeriodMicro + input.prospectiveIssuedMicro > this.rule.perPeriodCapMicro) {
      return {
        approved: false,
        reasonCode: "PERIOD_RULE_CAP_EXCEEDED (ALT-3, fail-closed)",
        scopeEvidence: `rule ${this.rule.ruleId}: issued ${fmt6(this.rule.issuedInPeriodMicro)} of ${fmt6(this.rule.perPeriodCapMicro)}`,
      };
    }
    return {
      approved: true,
      reasonCode: "APPROVED_WITHIN_BOUND_RULE",
      scopeEvidence: `rule ${this.rule.ruleId} (per-tx cap ${fmt6(this.rule.perTxCapMicro)}, period cap ${fmt6(this.rule.perPeriodCapMicro)})`,
    };
  }
}

/** ALT-4 — Hybrid: authorized program + periodic attestation (spec §14.6 ALT-4). STUB — NOT SELECTED. */
export class Alt4HybridAttestationModel implements AuthorizationModelStub {
  readonly altId = "ALT-4" as const;
  readonly label =
    "ALT-4 — hybrid: ALT-3 machinery PLUS a mandatory periodic (e.g. weekly) governance attestation that observed " +
    "issuance matched the rule; any mismatch → automatic issuance suspension pending review. STUB FOR TESTING — " +
    "NOT SELECTED."
  readonly d1327Status = "OPEN — NOT SELECTED (D-13.27)" as const;
  readonly notes =
    "Middle ground; adds an operational duty. THIS STUB DEMONSTRATES: stale/missing attestation ⇒ NO authorization."
  constructor(
    private readonly rule: IssuanceRule | null,
    private readonly latestAttestation: AttestationRecord | null,
  ) {}
  decide(input: AuthorizationDecisionInput): AuthorizationDecision {
    const ruleCheck = new Alt3RuleBoundProgramModel(this.rule).decide(input);
    if (!ruleCheck.approved) return ruleCheck;
    if (!this.latestAttestation) {
      return {
        approved: false,
        reasonCode: "NO_ATTESTATION — hybrid program requires a fresh attestation (ALT-4)",
        scopeEvidence: "none",
      };
    }
    const age = input.atMs - this.latestAttestation.attestedAtMs;
    if (age > this.latestAttestation.periodMs) {
      return {
        approved: false,
        reasonCode: "STALE_ATTESTATION — issuance suspended pending fresh governance attestation (ALT-4)",
        scopeEvidence: `attestation ${this.latestAttestation.attestationId} age ${age}ms > period ${this.latestAttestation.periodMs}ms`,
      };
    }
    if (!this.latestAttestation.matched) {
      return {
        approved: false,
        reasonCode: "ATTESTATION_MISMATCH — automatic issuance suspension pending review (ALT-4)",
        scopeEvidence: `attestation ${this.latestAttestation.attestationId} reported mismatch`,
      };
    }
    return {
      approved: true,
      reasonCode: "APPROVED_WITHIN_RULE_AND_FRESH_ATTESTATION",
      scopeEvidence: `rule ${this.rule?.ruleId} + attestation ${this.latestAttestation.attestationId}`,
    };
  }
}

/** ALT-1 harness type — governance-authorized issuance window (TEST FIXTURE). */
export interface IssuanceWindow {
  windowId: string;
  startMs: number;
  endMs: number;
  instruments: { code: string; network: string }[];
  trancheCapMicro: bigint;
  consumedMicro: bigint;
  remainingCapMicro: bigint;
  active: boolean;
  disclosure: string;
}

/** ALT-3/ALT-4 harness type — governance-bound issuance rule (TEST FIXTURE). */
export interface IssuanceRule {
  ruleId: string;
  instruments: { code: string; network: string }[];
  perPeriodCapMicro: bigint;
  perTxCapMicro: bigint;
  issuedInPeriodMicro: bigint;
  circuitBreakerArmed: boolean;
}

/** ALT-4 harness type — periodic governance attestation (TEST FIXTURE). */
export interface AttestationRecord {
  attestationId: string;
  attestedAtMs: number;
  periodMs: number;
  matched: boolean;
}

// ----------------------------------------------------------------------------
// §6 — Supply policy & machine configuration (ALL VALUES ILLUSTRATIVE/UNAPPROVED)
// ----------------------------------------------------------------------------

export interface SupplyPolicy {
  globalMaxSupplyMicro: bigint; // ILLUSTRATIVE — D-13.6 numbers deferred to owner approval
  perTxCapMicro: bigint;
  trancheId: string;
  trancheCapMicro: bigint;
  label: string;
}

export interface QuotePolicy {
  quoteTUPerTokenMicro: bigint; // issuance quote: quote units per 1.0 token
  quoteTtlMs: number;
  label: string;
}

export interface FeeSchedule {
  feeClass: string;
  rateBps: bigint;
  label: string;
}

export interface IssuanceMachineConfig {
  machineId: string;
  registry: PrototypeInstrumentRegistry;
  /** D-13.27: which stub drives the explicit authorization step. Default ALT-2 FOR TESTING ONLY — NOT a selection. */
  authorizationModelIdForTestingOnly?: AltId;
  supplyPolicy: SupplyPolicy;
  quotePolicy: QuotePolicy;
  feeSchedule: FeeSchedule;
  clockStartMs: number;
  /**
   * CBDC SIMULATION MODE (mandate: "test it with labeled simulated messages until an actual authorized interface
   * is available"). When enabled, the machine admits the SIMULATED CBDC instrument descriptor for
   * SIMULATION-DEMO issuances only. It does NOT connect anything, does NOT change any registry row's
   * NOT_CONNECTED honesty state, and is NOT an integration.
   */
  cbdcSimulationMode?: { enabled: boolean; label: "SIMULATED — NOT CONNECTED" };
}

// ----------------------------------------------------------------------------
// §7 — Machine invariant violation (hard guard)
// ----------------------------------------------------------------------------

export class MachineInvariantViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MachineInvariantViolation";
  }
}

// ----------------------------------------------------------------------------
// §8 — The issuance state machine
// ----------------------------------------------------------------------------

export interface IssuanceRequestInput {
  requestId: string;
  idempotencyKey: string; // spec §6.4 — every settlement operation carries one
  instrumentCode: string;
  network: string;
  payerId: string;
  recipientId: string;
  jurisdiction: string;
  requestedInstrumentAmountMicro: bigint;
}

export interface StepResult {
  ok: boolean;
  state: IssuanceState;
  reasonCode: string;
  detail?: string;
  observed?: Record<string, string>;
}

export interface SubmissionResult extends StepResult {
  created: boolean;
  replayDetected: boolean;
  duplicateOf?: string;
  originalOutcomeRef?: string;
}

interface IssuanceInstance {
  requestId: string;
  idempotencyKey: string;
  instrumentCode: string;
  network: string;
  payerId: string;
  recipientId: string;
  jurisdiction: string;
  requestedInstrumentAmountMicro: bigint;
  state: IssuanceState;
  terminalReasonCode: string | null;
  terminalTaxonomyClass: ExceptionTaxonomyClass | null;
  quote: QuoteRecord | null;
  payment: PaymentRecord | null;
  settlement: SettlementRecord | null;
  settlementFinal: boolean;
  grossTUMicro: bigint | null;
  feeMicro: bigint | null;
  netTUMicro: bigint | null;
  authorizationRecord: AuthorizationRecord | null;
  prospectiveIssuedMicro: bigint | null;
  issuedMicro: bigint | null;
  inFlightDisclosure: string | null;
  simulationLabels: string[];
}

export class IssuanceMachine {
  readonly config: IssuanceMachineConfig;
  readonly label = MACHINE_PROTOTYPE_LABEL;
  readonly d1327Status = D_13_27_STATUS;
  readonly authSchemeLabel = AUTH_SCHEME_LABEL;
  private clockMs: number;
  private seq = 0;
  private instances = new Map<string, IssuanceInstance>();
  private eventLog: EventLogEntry[] = [];
  private idempotencyRegistry = new Map<string, { requestId: string; canonicalPayload: string; completed: boolean }>();
  private paymentTxRegistry = new Map<string, string>(); // paymentTxId → requestId
  private mintRecords = new Map<string, MintRecord>(); // mintId → record
  private mintRegistryByIdemKey = new Map<string, string>(); // idempotencyKey → mintId (1:1)
  private mintNonceCounter = 0;
  private totalSupplyMicro = 0n;
  private trancheIssuedMicro = 0n;
  private paymentBook = new Map<string, PaymentBookEntry>(); // requestId → entry
  private issuanceBook = new Map<string, IssuanceBookEntry>(); // requestId → entry
  private tokenBook = new Map<string, TokenBookEntry>(); // mintId → entry
  private feeBookTotalMicro = 0n;
  private exceptions: ExceptionRecord[] = [];
  private refundQueue: RefundRecord[] = [];
  private approvals = new Map<string, { approverId: string; note: string; approvedAtMs: number }>();
  private windows: IssuanceWindow[] = [];
  private rule: IssuanceRule | null = null;
  private attestation: AttestationRecord | null = null;
  pipelineSuspended = false;
  suspensionReasons: string[] = [];

  constructor(config: IssuanceMachineConfig) {
    this.config = config;
    this.clockMs = config.clockStartMs;
  }

  // ---- infrastructure -----------------------------------------------------

  get nowMs(): number {
    return this.clockMs;
  }
  advanceClock(deltaMs: number): void {
    this.clockMs += deltaMs;
    this.config.registry.advanceClock(deltaMs);
  }

  private log(
    requestId: string,
    from: IssuanceState | null,
    to: IssuanceState | null,
    reasonCode: string,
    detail: string,
    taxonomyClass: ExceptionTaxonomyClass | null = null,
  ): void {
    this.seq += 1;
    this.eventLog.push({
      seq: this.seq,
      atMs: this.clockMs,
      requestId,
      from,
      to,
      stepRef: to ? STATE_STEP_REFS[to] : from ? STATE_STEP_REFS[from] : "§14.4 step 12",
      reasonCode,
      detail,
      taxonomyClass,
    });
  }

  /**
   * The EXPLICIT state-machine transition. Validates the transition table;
   * on ISSUED additionally enforces INV-A as a HARD machine-level guard.
   *
   * Result semantics: `ok` = the step ADVANCED THE FLOW TOWARD ISSUANCE — a
   * transition into a TERMINAL FAILURE state returns ok:false (with `performed`
   * = true so callers know the state change actually happened); a table
   * rejection returns ok:false with performed:false.
   */
  private transition(
    inst: IssuanceInstance,
    to: IssuanceState,
    reasonCode: string,
    detail: string,
    taxonomyClass: ExceptionTaxonomyClass | null = null,
  ): { ok: boolean; reasonCode: string; performed: boolean } {
    if (isTerminal(inst.state)) {
      this.log(inst.requestId, inst.state, null, "TRANSITION_REJECTED_TERMINAL", `terminal state is immutable; attempted ${to}`);
      return { ok: false, reasonCode: "TRANSITION_REJECTED_TERMINAL_STATE_IMMUTABLE", performed: false };
    }
    if (!ALLOWED_TRANSITIONS[inst.state].includes(to)) {
      this.log(
        inst.requestId,
        inst.state,
        null,
        "TRANSITION_REJECTED",
        `${inst.state} → ${to} is not in the transition table (state machine is explicit; no skipping)`,
      );
      return { ok: false, reasonCode: `TRANSITION_REJECTED_${inst.state}_TO_${to}`, performed: false };
    }
    if (to === "ISSUED") {
      // INV-A hard guard — defense in depth beyond the transition table.
      if (!(inst.settlementFinal && inst.authorizationRecord !== null && inst.state === "SUPPLY_CHECKED" && !this.pipelineSuspended)) {
        throw new MachineInvariantViolation(
          "INV-A VIOLATION ATTEMPTED: transition to ISSUED requires BOTH settlement finality AND an explicit " +
            "authorization record (and SUPPLY_CHECKED state, and a non-suspended pipeline). A payment event alone " +
            "can NEVER reach ISSUED (spec §14.4 hard rules; D-13.27 common invariants).",
        );
      }
    }
    const from = inst.state;
    inst.state = to;
    if (isTerminal(to)) {
      inst.terminalReasonCode = reasonCode;
      inst.terminalTaxonomyClass = taxonomyClass;
    }
    this.log(inst.requestId, from, to, reasonCode, detail, taxonomyClass);
    // ok = advanced-the-flow (false when the destination is a terminal FAILURE state);
    // performed = the state change actually happened; reasonCode = the SEMANTIC reason.
    return { ok: !isTerminal(to), reasonCode, performed: true };
  }

  // ---- §14.4 steps 1 & 3 — request creation (+ idempotency/replay, spec §6.4) ----

  submitIssuanceRequest(input: IssuanceRequestInput): SubmissionResult {
    const canonical = [
      input.requestId,
      input.idempotencyKey,
      input.instrumentCode,
      input.network,
      input.payerId,
      input.recipientId,
      input.jurisdiction,
      input.requestedInstrumentAmountMicro.toString(10),
    ].join("|");

    // REPLAY at the request-id level (ISS-09): the same requestId can never execute twice.
    const existing = this.instances.get(input.requestId);
    if (existing) {
      this.log(
        input.requestId,
        existing.state,
        null,
        "REQUEST_REPLAY_DETECTED",
        "exact original issuance request replayed (same requestId); duplicate submission returns the original " +
          "result — never a second execution (spec §6.4)",
        "DUPLICATE_KEY_COLLISION",
      );
      return {
        ok: false,
        created: false,
        replayDetected: true,
        state: existing.state,
        reasonCode: "REQUEST_REPLAY_DETECTED — original result returned; NO second execution (spec §6.4)",
        detail: `original state: ${existing.state}${existing.terminalReasonCode ? ` (${existing.terminalReasonCode})` : ""}`,
        originalOutcomeRef: existing.requestId,
      };
    }

    if (this.pipelineSuspended) {
      // fail-closed (INV-D side effect)
      this.log(
        input.requestId,
        null,
        null,
        "SUBMISSION_REJECTED_PIPELINE_SUSPENDED",
        "issuance pipeline is SUSPENDED (reconciliation exception / forced break); new requests are rejected fail-closed",
        "RECONCILE_MISMATCH",
      );
      return { ok: false, created: false, replayDetected: false, state: "REQUEST_CREATED", reasonCode: "PIPELINE_SUSPENDED_FAIL_CLOSED" };
    }

    // IDEMPOTENCY-KEY registry (ISS-02): a second submission under an existing key NEVER executes twice.
    const prior = this.idempotencyRegistry.get(input.idempotencyKey);
    if (prior) {
      const samePayload = prior.canonicalPayload === canonical;
      const inst: IssuanceInstance = this.newInstance(input);
      const reasons: string[] = [
        samePayload
          ? "DUPLICATE_IDEMPOTENCY_KEY — returns the original result; never a second execution (spec §6.4)"
          : "DUPLICATE_KEY_COLLISION — same idempotency key with a DIFFERENT payload: second submission rejected + " +
            "alert raised, never executed twice (spec §6.6)",
      ];
      const tr = this.transition(inst, "DUPLICATE", reasons[0], `duplicate of request ${prior.requestId}`, "DUPLICATE_KEY_COLLISION");
      if (!tr.performed) return { ok: false, created: false, replayDetected: false, state: inst.state, reasonCode: tr.reasonCode };
      return {
        ok: false,
        created: true,
        replayDetected: false,
        state: "DUPLICATE",
        reasonCode: reasons[0],
        detail: `duplicate of ${prior.requestId}`,
        duplicateOf: prior.requestId,
        originalOutcomeRef: prior.requestId,
      };
    }

    const inst = this.newInstance(input);
    this.instances.set(input.requestId, inst);
    this.idempotencyRegistry.set(input.idempotencyKey, { requestId: input.requestId, canonicalPayload: canonical, completed: false });
    this.log(
      input.requestId,
      null,
      "REQUEST_CREATED",
      "REQUEST_ACCEPTED",
      "§14.4 steps 1+3: instrument selection recorded (per-instance identity: code+network, never a ticker " +
        `alone) + user issuance request created (idempotency key ${input.idempotencyKey}, spec §6.4)`,
    );
    return { ok: true, created: true, replayDetected: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_ACCEPTED" };
  }

  private newInstance(input: IssuanceRequestInput): IssuanceInstance {
    return {
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      instrumentCode: input.instrumentCode,
      network: input.network,
      payerId: input.payerId,
      recipientId: input.recipientId,
      jurisdiction: input.jurisdiction,
      requestedInstrumentAmountMicro: input.requestedInstrumentAmountMicro,
      state: "REQUEST_CREATED",
      terminalReasonCode: null,
      terminalTaxonomyClass: null,
      quote: null,
      payment: null,
      settlement: null,
      settlementFinal: false,
      grossTUMicro: null,
      feeMicro: null,
      netTUMicro: null,
      authorizationRecord: null,
      prospectiveIssuedMicro: null,
      issuedMicro: null,
      inFlightDisclosure: null,
      simulationLabels: ["NON-PRODUCTION PROTOTYPE", "LEDGER RECORDS ONLY — NO ON-CHAIN ACTION"],
    };
  }

  private requireInstance(requestId: string): IssuanceInstance | null {
    return this.instances.get(requestId) ?? null;
  }

  // ---- §14.4 step 2 — quote generation (spec §6.1) ----

  generateQuote(requestId: string): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "REQUEST_CREATED") {
      this.log(requestId, inst.state, null, "STEP_REJECTED", `generateQuote requires REQUEST_CREATED (got ${inst.state})`);
      return { ok: false, state: inst.state, reasonCode: `STEP_REJECTED_STATE_${inst.state}` };
    }

    const row = this.config.registry.findByCodeAndNetwork(inst.instrumentCode, inst.network);
    if (!row) {
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        "INSTRUMENT_NOT_IN_REGISTRY",
        "quote refused: instrument (code+network) not found in the registry — per-instance lookup, never a ticker alone",
        "INSTRUMENT_INVALID",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }

    // Honesty-state gate FIRST (spec §5.3): NOT_CONNECTED rows quote only in SIMULATION MODE.
    const simEnabled = this.config.cbdcSimulationMode?.enabled ?? false;
    if (row.honestyState === "NOT_CONNECTED") {
      if (!simEnabled) {
        const t = this.transition(
          inst,
          "INVALID_INSTRUMENT",
          "CBDC_NOT_CONNECTED_NO_QUOTES",
          "quote refused: CBDC row is SIMULATED / NOT CONNECTED — spec §6.2: absent interface ⇒ NO quotes at all; " +
            "spec §4: admission requires a verified authorized interface + recorded end-to-end test (NEITHER EXISTS)",
          "INSTRUMENT_INVALID",
        );
        return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
      }
      // SIMULATION-MODE quote admission (labeled): the mandate instructs testing with labeled simulated
      // messages until an actual authorized interface is available. This is NOT an integration and does
      // NOT change the row's NOT_CONNECTED status.
      inst.simulationLabels.push("SIMULATION-MODE QUOTE (SIMULATED — NOT CONNECTED)");
    } else if (row.state === "REVOKED") {
      const t = this.transition(inst, "INVALID_INSTRUMENT", "INSTRUMENT_REVOKED", "quote refused: instrument REVOKED (records preserved)", "INSTRUMENT_INVALID");
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    } else if (row.state === "SUSPENDED" || row.state === "PROPOSED") {
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        row.state === "SUSPENDED" ? "INSTRUMENT_SUSPENDED_NO_QUOTES" : "INSTRUMENT_NOT_APPROVED_PER_INSTANCE_IDENTITY",
        row.state === "SUSPENDED"
          ? "quote refused: instrument SUSPENDED (spec §4/§5); new quotes blocked while in-flight settlements complete under existing quotes"
          : "quote refused: same code on a DIFFERENT network instance is NOT auto-approved (per-instance identity, spec §14.2 rule (a))",
        "INSTRUMENT_INVALID",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    if (inst.requestedInstrumentAmountMicro <= 0n) {
      const t = this.transition(inst, "INVALID_INSTRUMENT", "NON_POSITIVE_AMOUNT", "quote refused: amount must be positive", "INSTRUMENT_INVALID");
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }

    const fee = this.config.feeSchedule;
    const grossTU = divRoundHalfEven(inst.requestedInstrumentAmountMicro * row.valuationBasis.pricePerUnitMicro, MICRO);
    const quote: QuoteRecord = {
      quoteId: `QUOTE-${requestId}`,
      instrumentCode: inst.instrumentCode,
      network: inst.network,
      side: "ISSUANCE",
      grossInstrumentAmountMicro: inst.requestedInstrumentAmountMicro,
      conversionPricePerUnitMicro: row.valuationBasis.pricePerUnitMicro,
      grossTUMicroPreview: grossTU,
      quoteTUPerTokenMicro: this.config.quotePolicy.quoteTUPerTokenMicro,
      feeClass: fee.feeClass,
      feeRateBps: fee.rateBps,
      spreadDisclosureBps: 0n,
      roundingRule: "ROUND_HALF_TO_EVEN @ 6 decimals (PROPOSED, spec §6.1 / D-13.19)",
      createdAtMs: this.clockMs,
      expiresAtMs: this.clockMs + this.config.quotePolicy.quoteTtlMs,
      syntheticQuoteTag: computeSyntheticAuthTag(
        TEST_ONLY_AUTH_KEY_LITERAL,
        `QUOTE|${requestId}|${inst.requestedInstrumentAmountMicro.toString(10)}|${grossTU.toString(10)}|${this.config.quotePolicy.quoteTUPerTokenMicro.toString(10)}`,
      ),
      labels: [QUOTE_POLICY_LABEL, FEE_SCHEDULE_LABEL, `valuation basis: ${row.valuationBasis.basisLabel}`],
    };
    inst.quote = quote;
    if (row.honestyState === "NOT_CONNECTED" && this.config.cbdcSimulationMode?.enabled) {
      inst.simulationLabels.push("SIMULATED — NOT CONNECTED", "SIMULATION-MODE DEMO — NOT an integration; registry row unchanged");
    }
    const t = this.transition(
      inst,
      "QUOTED",
      "QUOTE_GENERATED",
      `quote ${quote.quoteId}: gross ${fmt6(quote.grossInstrumentAmountMicro)} ${inst.instrumentCode} → ${fmt6(grossTU)} ` +
        `TU @ conversion ${fmt6(quote.conversionPricePerUnitMicro)}; issuance quote ${fmt6(quote.quoteTUPerTokenMicro)} ` +
        `TU/token; fee class ${quote.feeClass} @ ${quote.feeRateBps.toString(10)}bps (ILLUSTRATIVE — D-13.8 OPEN); ` +
        `spread ${quote.spreadDisclosureBps.toString(10)}bps disclosed; expires at ${quote.expiresAtMs}ms ` +
        `(TTL ${this.config.quotePolicy.quoteTtlMs}ms); quote policy ILLUSTRATIVE (spec §14.5)`,
    );
    return {
      ok: t.ok,
      state: inst.state,
      reasonCode: t.reasonCode,
      observed: {
        quoteId: quote.quoteId,
        grossInstrumentAmount: fmt6(quote.grossInstrumentAmountMicro),
        grossTUPreview: fmt6(quote.grossTUMicroPreview),
        quoteTUPerToken: fmt6(quote.quoteTUPerTokenMicro),
        expiresAtMs: quote.expiresAtMs.toString(10),
      },
    };
  }

  // ---- payment event intake (pre-4a) + duplicate-payment-tx protection ----

  observePayment(
    requestId: string,
    payment: {
      paymentTxId: string;
      payerId: string;
      amountMicro: bigint;
      authTag: string;
      observedAtMs?: number;
    },
  ): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "QUOTED") {
      this.log(requestId, inst.state, null, "STEP_REJECTED", `observePayment requires QUOTED (got ${inst.state})`);
      return { ok: false, state: inst.state, reasonCode: `STEP_REJECTED_STATE_${inst.state}` };
    }
    const observedAt = payment.observedAtMs ?? this.clockMs;
    // Duplicate payment txId across the WHOLE machine (ISS-02): never accept the same payment twice.
    const priorOwner = this.paymentTxRegistry.get(payment.paymentTxId);
    if (priorOwner) {
      const t = this.transition(
        inst,
        "DUPLICATE",
        "DUPLICATE_PAYMENT_TX",
        `payment txId ${payment.paymentTxId} already observed on request ${priorOwner}; duplicate submission returns ` +
          "the original result — never a second execution (spec §6.4/§6.6)",
        "DUPLICATE_KEY_COLLISION",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode, detail: `duplicate of ${priorOwner}` };
    }
    const record: PaymentRecord = {
      paymentTxId: payment.paymentTxId,
      instrumentCode: inst.instrumentCode,
      network: inst.network,
      payerId: payment.payerId,
      amountMicro: payment.amountMicro,
      observedAtMs: observedAt,
      authTag: payment.authTag,
      canonicalPayload: canonicalPaymentPayload({
        paymentTxId: payment.paymentTxId,
        instrumentCode: inst.instrumentCode,
        network: inst.network,
        payerId: payment.payerId,
        amountMicro: payment.amountMicro,
        observedAtMs: observedAt,
      }),
    };
    inst.payment = record;
    this.paymentTxRegistry.set(payment.paymentTxId, requestId);
    const t = this.transition(inst, "PAYMENT_OBSERVED", "PAYMENT_OBSERVED", `payment txId ${payment.paymentTxId} observed (pre-4a intake)`);
    return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
  }

  // ---- §14.4 step 4a — payment authenticity verification (SYNTHETIC scheme) ----

  verifyPaymentAuthenticity(requestId: string): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "PAYMENT_OBSERVED") {
      this.log(requestId, inst.state, null, "STEP_REJECTED", `verifyPaymentAuthenticity requires PAYMENT_OBSERVED (got ${inst.state})`);
      return { ok: false, state: inst.state, reasonCode: `STEP_REJECTED_STATE_${inst.state}` };
    }
    const pay = inst.payment;
    const quote = inst.quote;
    if (!pay || !quote) {
      const t = this.transition(inst, "INVALID_PAYMENT", "PAYMENT_RECORDS_MISSING", "internal records missing", "FINALITY_EVIDENCE_GAP");
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    // (i) SYNTHETIC authenticity tag (in-process, TEST-ONLY scheme).
    const expected = computeSyntheticAuthTag(TEST_ONLY_AUTH_KEY_LITERAL, pay.canonicalPayload);
    if (pay.authTag !== expected) {
      const t = this.transition(
        inst,
        "INVALID_PAYMENT",
        "AUTH_TAG_MISMATCH",
        `synthetic authenticity tag mismatch (expected ${expected}, got ${pay.authTag}). ${AUTH_SCHEME_LABEL}`,
        "FINALITY_EVIDENCE_GAP",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    // (ii) payment must match the request/quote identity and amount.
    if (pay.amountMicro !== quote.grossInstrumentAmountMicro || pay.payerId !== inst.payerId) {
      const t = this.transition(
        inst,
        "INVALID_PAYMENT",
        "PAYMENT_QUOTE_MISMATCH",
        `payment amount/payer does not match the quote (amount ${fmt6(pay.amountMicro)} vs quoted ${fmt6(quote.grossInstrumentAmountMicro)})`,
        "PARTIAL_SETTLEMENT",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    const t = this.transition(
      inst,
      "PAYMENT_AUTHENTIC",
      "PAYMENT_AUTHENTIC",
      `synthetic tag verified (${expected}); payment matches quote identity and amount (${AUTH_SCHEME_LABEL})`,
    );
    return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
  }

  // ---- §14.4 step 4b — settlement finality per rail (spec §6.2) ----

  confirmSettlement(
    requestId: string,
    msg: {
      status: "SETTLED" | "FAILED" | "REVERSED" | "TIMEOUT";
      confirmations?: number;
      issuerSanityCheckPassed?: boolean;
      settledAmountMicro?: bigint;
      finalityAtMs?: number;
      sourceLabel?: string;
      pegDeviationBps?: number;
      sustainedHours?: number;
    },
  ): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "PAYMENT_AUTHENTIC") {
      this.log(requestId, inst.state, null, "STEP_REJECTED", `confirmSettlement requires PAYMENT_AUTHENTIC (got ${inst.state})`);
      return { ok: false, state: inst.state, reasonCode: `STEP_REJECTED_STATE_${inst.state}` };
    }
    const quote = inst.quote;
    const pay = inst.payment;
    if (!quote || !pay) return { ok: false, state: inst.state, reasonCode: "INTERNAL_RECORDS_MISSING" };
    const row = this.config.registry.findByCodeAndNetwork(inst.instrumentCode, inst.network);

    // QUOTE-EXPIRY gate FIRST (DEC-SETTLEMENT-TIMING OPEN; spec §6.1 hard-reject after expiry).
    if (this.clockMs > quote.expiresAtMs) {
      const t = this.transition(
        inst,
        "EXPIRED_QUOTE",
        "QUOTE_EXPIRED_BEFORE_FINALITY",
        `settlement finality arrived after quote expiry (${this.clockMs}ms > ${quote.expiresAtMs}ms) — no issuance at ` +
          "a stale quote. OPEN DECISION (DEC-SETTLEMENT-TIMING, D-13.27/spec §6.6 CONFIRMATION_TIMEOUT): payment is " +
          "HELD_IN_REFUND_QUEUE (auto-refund, same idempotency key per spec §6.3); retry forbidden on the same key.",
        "CONFIRMATION_TIMEOUT",
      );
      if (t.performed) {
        this.refundQueue.push({
          refundId: `RFND-${requestId}`,
          requestId,
          paymentTxId: pay.paymentTxId,
          idempotencyKey: inst.idempotencyKey,
          grossInstrumentAmountMicro: pay.amountMicro,
          reasonCode: "EXPIRED_QUOTE",
          state: "PENDING_REFUND",
          createdAtMs: this.clockMs,
        });
      }
      return { ok: false, state: inst.state, reasonCode: t.reasonCode };
    }

    const depeg: DepegObservation = {
      deviationBps: msg.pegDeviationBps ?? 0,
      sustainedHours: msg.sustainedHours ?? 0,
      instantaneousMoveBps: 0,
    };

    if (msg.status === "FAILED") {
      const t = this.transition(
        inst,
        "PAYMENT_FAILED",
        "SETTLEMENT_STATUS_FAILED",
        "settlement status FAILED — failed payment NEVER mints (spec §14.4 hard rules); auto-refund queued with the " +
          "same idempotency key; NO fee retained on a failed transaction (spec §6.3, PROPOSED D-13.8)",
        "CONFIRMATION_TIMEOUT",
      );
      if (t.performed) {
        this.refundQueue.push({
          refundId: `RFND-${requestId}`,
          requestId,
          paymentTxId: pay.paymentTxId,
          idempotencyKey: inst.idempotencyKey,
          grossInstrumentAmountMicro: pay.amountMicro,
          reasonCode: "PAYMENT_FAILED",
          state: "PENDING_REFUND",
          createdAtMs: this.clockMs,
        });
      }
      return { ok: false, state: inst.state, reasonCode: t.reasonCode };
    }
    if (msg.status === "TIMEOUT") {
      const t = this.transition(
        inst,
        "PAYMENT_FAILED",
        "SETTLEMENT_STATUS_TIMEOUT",
        "settlement status TIMEOUT (spec §6.6 CONFIRMATION_TIMEOUT): transfer unconfirmed before deadline — refund; " +
          "retry FORBIDDEN on the same idempotency key",
        "CONFIRMATION_TIMEOUT",
      );
      if (t.performed) {
        this.refundQueue.push({
          refundId: `RFND-${requestId}`,
          requestId,
          paymentTxId: pay.paymentTxId,
          idempotencyKey: inst.idempotencyKey,
          grossInstrumentAmountMicro: pay.amountMicro,
          reasonCode: "CONFIRMATION_TIMEOUT",
          state: "PENDING_REFUND",
          createdAtMs: this.clockMs,
        });
      }
      return { ok: false, state: inst.state, reasonCode: t.reasonCode };
    }
    if (msg.status === "REVERSED") {
      return this.handleReversalNotice(requestId, msg.sourceLabel ?? "settlement message");
    }
    if (msg.status !== "SETTLED") {
      const t = this.transition(inst, "INVALID_PAYMENT", "UNKNOWN_SETTLEMENT_STATUS", `status ${msg.status}`, "FINALITY_EVIDENCE_GAP");
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }

    // status === SETTLED — verify the rail-specific finality definition (spec §6.2).
    const policy = row?.confirmationPolicy;
    const finalityAt = msg.finalityAtMs ?? this.clockMs;
    if (!policy) {
      const t = this.transition(inst, "INVALID_PAYMENT", "FINALITY_POLICY_MISSING", "no confirmation policy on the instrument row", "FINALITY_EVIDENCE_GAP");
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    if (policy.kind === "STABLECOIN_N_CONFIRMATIONS") {
      const confirmationsOk = (msg.confirmations ?? -1) >= policy.minConfirmations;
      const sanityOk = msg.issuerSanityCheckPassed === true;
      if (!confirmationsOk || !sanityOk) {
        const t = this.transition(
          inst,
          "INVALID_PAYMENT",
          "FINALITY_EVIDENCE_GAP",
          `stablecoin finality requires N=${policy.minConfirmations} confirmations AND issuer sanity check ` +
            `(observed: confirmations=${msg.confirmations ?? "missing"}, issuerSanity=${msg.issuerSanityCheckPassed ?? "missing"}). ` +
            "Balance receipt alone is NEVER finality (spec §6.2).",
          "FINALITY_EVIDENCE_GAP",
        );
        if (t.performed) {
          this.exceptions.push({
            exceptionId: `EXC-${requestId}-GAP`,
            requestId,
            taxonomyClass: "FINALITY_EVIDENCE_GAP",
            reasonCode: "FINALITY_EVIDENCE_GAP",
            openedAtMs: this.clockMs,
            status: "OPEN",
            notes: "finality evidence missing/malformed — held in exception queue; new obligations for this instrument blocked (spec §6.6)",
          });
        }
        return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
      }
    } else if (policy.kind === "CBDC_AUTHORIZED_INTERFACE") {
      if (!this.config.cbdcSimulationMode?.enabled || !msg.sourceLabel) {
        const t = this.transition(
          inst,
          "INVALID_PAYMENT",
          "CBDC_FINALITY_SIGNAL_UNAVAILABLE",
          "CBDC finality is the authorized interface's own finality signal (spec §6.2) — NO authorized interface " +
            "exists; without the SIMULATION-MODE label a SETTLED message is not acceptable evidence",
          "FINALITY_EVIDENCE_GAP",
        );
        return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
      }
    }

    // Amount check: settled amount must equal the quoted amount (spec §6.6 PARTIAL_SETTLEMENT analog).
    const settledAmount = msg.settledAmountMicro ?? pay.amountMicro;
    if (settledAmount !== quote.grossInstrumentAmountMicro) {
      const t = this.transition(
        inst,
        "INVALID_PAYMENT",
        "SETTLED_AMOUNT_QUOTE_MISMATCH",
        `amount settled (${fmt6(settledAmount)}) ≠ quoted amount (${fmt6(quote.grossInstrumentAmountMicro)}) — ` +
          "PARTIAL_SETTLEMENT analog: difference held in the exception queue and DISCLOSED; no silent write-off; " +
          "retry forbidden on the same key (spec §6.6)",
        "PARTIAL_SETTLEMENT",
      );
      if (t.performed) {
        this.exceptions.push({
          exceptionId: `EXC-${requestId}-PARTIAL`,
          requestId,
          taxonomyClass: "PARTIAL_SETTLEMENT",
          reasonCode: "SETTLED_AMOUNT_QUOTE_MISMATCH",
          openedAtMs: this.clockMs,
          status: "OPEN",
          notes: `difference ${fmt6(settledAmount - quote.grossInstrumentAmountMicro)} held in queue; disclosed; no silent write-off`,
        });
      }
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }

    const depegBand = row ? classifyDepegBand(row.depegThresholds, depeg) : "NORMAL";
    const settlement: SettlementRecord = {
      status: "SETTLED",
      confirmations: msg.confirmations ?? null,
      issuerSanityCheckPassed: msg.issuerSanityCheckPassed ?? null,
      settledAmountMicro: settledAmount,
      finalityAtMs: finalityAt,
      sourceLabel: msg.sourceLabel ?? "SYNTHETIC STABLECOIN RAIL (deterministic simulated settlement record)",
      depegBand,
      pegDeviationBps: depeg.deviationBps,
      sustainedHours: depeg.sustainedHours,
      finalityBasisLabel:
        policy.kind === "STABLECOIN_N_CONFIRMATIONS"
          ? `stablecoin finality: ${policy.finalityDefinition}`
          : "CBDC simulated-interface finality signal (SIMULATED — NOT CONNECTED; no authorized interface exists)",
    };
    inst.settlement = settlement;
    inst.settlementFinal = true;
    const t = this.transition(
      inst,
      "SETTLEMENT_FINAL",
      "SETTLEMENT_FINALITY_CONFIRMED",
      `rail-specific finality confirmed per ${settlement.finalityBasisLabel}; finality-at ${finalityAt}ms; ` +
        `depeg band at settlement: ${depegBand}`,
    );
    return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
  }

  // ---- §14.4 step 5 — instrument/jurisdiction/depeg checks AT SETTLEMENT TIME ----

  checkInstrument(requestId: string, depegObs?: DepegObservation): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "SETTLEMENT_FINAL") {
      this.log(requestId, inst.state, null, "STEP_REJECTED", `checkInstrument requires SETTLEMENT_FINAL (got ${inst.state})`);
      return { ok: false, state: inst.state, reasonCode: `STEP_REJECTED_STATE_${inst.state}` };
    }
    const quote = inst.quote;
    if (!quote) return { ok: false, state: inst.state, reasonCode: "INTERNAL_RECORDS_MISSING" };

    // Re-check the registry at settlement time (checks are not quote-time-only).
    const row = this.config.registry.findByCodeAndNetwork(inst.instrumentCode, inst.network);
    if (!row) {
      const t = this.transition(inst, "INVALID_INSTRUMENT", "INSTRUMENT_NOT_IN_REGISTRY", "re-check at settlement time: row missing", "INSTRUMENT_INVALID");
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    // Honesty-state gate FIRST (spec §5.3): a NOT_CONNECTED row passes step 5 ONLY in SIMULATION MODE
    // (labeled simulated messages until an actual authorized interface is available — NOT an integration;
    // the registry row is NOT admitted and stays NOT_CONNECTED).
    const simEnabled = this.config.cbdcSimulationMode?.enabled ?? false;
    if (row.honestyState === "NOT_CONNECTED") {
      if (!simEnabled) {
        const t = this.transition(
          inst,
          "INVALID_INSTRUMENT",
          "CBDC_NOT_CONNECTED",
          "re-check at settlement time: CBDC row SIMULATED / NOT CONNECTED — no authorized interface exists",
          "INSTRUMENT_INVALID",
        );
        return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
      }
      inst.inFlightDisclosure =
        "SIMULATION-MODE ADMISSION (SIMULATED — NOT CONNECTED): registry row stays NOT_CONNECTED; NOT an integration";
      const t = this.transition(
        inst,
        "INSTRUMENT_CHECKED",
        "INSTRUMENT_CHECK_PASSED_SIMULATION_MODE",
        `SIMULATION-MODE admission for the simulated CBDC descriptor (${row.code} @ ${row.network}); registry row ` +
          `remains ${row.state}/${row.honestyState} — NOT admitted, NOT connected; jurisdiction ${inst.jurisdiction} OK in simulation`,
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    if (row.state === "REVOKED") {
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        "INSTRUMENT_REVOKED_AT_SETTLEMENT_TIME",
        "re-check at settlement time: instrument REVOKED since the quote — rejected (step 5 checks are settlement-time, not just quote-time)",
        "INSTRUMENT_INVALID",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    if (row.state === "SUSPENDED") {
      // spec §4 in-flight rule: in-flight settlements COMPLETE under existing quotes.
      if (quote.createdAtMs < (row.suspendedAtMs ?? Infinity)) {
        inst.inFlightDisclosure =
          "IN_FLIGHT_COMPLETION (spec §4: instrument suspended while this settlement was in flight; existing quotes complete)";
        const t = this.transition(
          inst,
          "INSTRUMENT_CHECKED",
          "INSTRUMENT_CHECK_PASSED_IN_FLIGHT",
          `instrument suspended at ${row.suspendedAtMs}ms AFTER quote creation — in-flight completion per spec §4 ` +
            `(disclosure: ${inst.inFlightDisclosure})`,
        );
        return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
      }
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        "INSTRUMENT_SUSPENDED_AT_SETTLEMENT_TIME",
        "re-check at settlement time: instrument SUSPENDED and the quote post-dates the suspension — rejected",
        "INSTRUMENT_INVALID",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    if (row.state === "PROPOSED") {
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        "INSTRUMENT_NOT_APPROVED_PER_INSTANCE_IDENTITY",
        "re-check at settlement time: per-instance identity (spec §14.2 rule (a)) — this network instance is NOT approved",
        "INSTRUMENT_INVALID",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    if (!row.jurisdictionAllowlist.includes(inst.jurisdiction)) {
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        "JURISDICTION_NOT_ALLOWED",
        `jurisdiction ${inst.jurisdiction} not in the instrument's allowlist [${row.jurisdictionAllowlist.join(", ")}] (compositional restriction, spec §3)`,
        "INSTRUMENT_INVALID",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }

    // Depeg band at settlement time (spec §4 bands; values D-13.19 UNAPPROVED).
    const obs: DepegObservation = depegObs ?? { deviationBps: 0, sustainedHours: 0, instantaneousMoveBps: 0 };
    const band = classifyDepegBand(row.depegThresholds, obs);
    if (band === "EMERGENCY") {
      // PROPOSED interpretation (labeled): spec §4 routes EMERGENCY to suspension + escalation; the prototype
      // FAILS CLOSED for the in-flight payment too. OPEN under D-13.19/D-13.27.
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        "DEPEG_EMERGENCY_FAIL_CLOSED",
        `depeg band EMERGENCY at settlement time (deviation ${obs.deviationBps}bps sustained ${obs.sustainedHours}h) — ` +
          "FAIL-CLOSED: rejected. PROPOSED interpretation (spec §4 'suspension + escalation'); decision OPEN (D-13.19/D-13.27)",
        "ISSUER_EVENT",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    if (band === "SUSPEND") {
      // Suspend the instrument NOW (spec §5 trigger), then apply the spec §4 in-flight rule.
      const res = this.config.registry.transition(
        row.instrumentId,
        "SUSPEND_DEPEG",
        `SYNTHETIC depeg evidence: deviation ${obs.deviationBps}bps sustained ${obs.sustainedHours}h (spec §4 SUSPEND band)`,
      );
      if (res.ok && quote.createdAtMs < (res.row?.suspendedAtMs ?? Infinity)) {
        inst.inFlightDisclosure =
          "IN_FLIGHT_COMPLETION (spec §4: instrument moved to SUSPENDED by this observation; existing-quote settlements complete)";
        const t = this.transition(
          inst,
          "INSTRUMENT_CHECKED",
          "INSTRUMENT_CHECK_PASSED_IN_FLIGHT_DEPEG_SUSPEND",
          `instrument suspended at ${res.row?.suspendedAtMs}ms AFTER quote creation — in-flight completion per spec ` +
            "§4 (in-flight settlements complete under existing quotes); NEW quotes are refused while SUSPENDED",
        );
        return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
      }
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        "DEPEG_SUSPEND_BAND",
        `depeg band SUSPEND at settlement time (deviation ${obs.deviationBps}bps sustained ${obs.sustainedHours}h) and ` +
          "the quote does not qualify for in-flight completion — rejected",
        "INSTRUMENT_INVALID",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    const depegNote =
      band === "WARN"
        ? "depeg band WARN at settlement time — completed with depeg warning disclosure (spec §4)"
        : "depeg band NORMAL at settlement time";
    if (band === "WARN") inst.inFlightDisclosure = "DEPEG_WARN_DISCLOSURE (spec §4: new quotes carry a depeg warning)";
    const t = this.transition(
      inst,
      "INSTRUMENT_CHECKED",
      "INSTRUMENT_CHECK_PASSED",
      `instrument ${row.instrumentId} (${row.code} @ ${row.network}) state ${row.state}; jurisdiction OK; ${depegNote}`,
    );
    return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
  }

  // ---- §14.4 step 7 — fee calculation (rates UNAPPROVED — D-13.8 OPEN) ----

  calculateFees(requestId: string): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "INSTRUMENT_CHECKED") {
      this.log(requestId, inst.state, null, "STEP_REJECTED", `calculateFees requires INSTRUMENT_CHECKED (got ${inst.state})`);
      return { ok: false, state: inst.state, reasonCode: `STEP_REJECTED_STATE_${inst.state}` };
    }
    const quote = inst.quote;
    if (!quote) return { ok: false, state: inst.state, reasonCode: "INTERNAL_RECORDS_MISSING" };
    const grossTU = divRoundHalfEven(inst.requestedInstrumentAmountMicro * quote.conversionPricePerUnitMicro, MICRO);
    const feeMicro = divRoundHalfEven(grossTU * quote.feeRateBps, 10_000n);
    inst.grossTUMicro = grossTU;
    inst.feeMicro = feeMicro;
    const t = this.transition(
      inst,
      "FEES_CALCULATED",
      "FEES_CALCULATED",
      `fee = ${fmt6(feeMicro)} TU (${quote.feeRateBps.toString(10)}bps of gross ${fmt6(grossTU)} TU) — ${FEE_SCHEDULE_LABEL}`,
    );
    return {
      ok: t.ok,
      state: inst.state,
      reasonCode: t.reasonCode,
      observed: { feeTU: fmt6(feeMicro), grossTU: fmt6(grossTU), feeBps: quote.feeRateBps.toString(10) },
    };
  }

  // ---- §14.4 steps 6 & 8 — quote-unit conversion + net accepted value ----

  acceptNetValue(requestId: string): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "FEES_CALCULATED") {
      this.log(requestId, inst.state, null, "STEP_REJECTED", `acceptNetValue requires FEES_CALCULATED (got ${inst.state})`);
      return { ok: false, state: inst.state, reasonCode: `STEP_REJECTED_STATE_${inst.state}` };
    }
    const quote = inst.quote;
    if (!quote || inst.grossTUMicro === null || inst.feeMicro === null) {
      return { ok: false, state: inst.state, reasonCode: "INTERNAL_RECORDS_MISSING" };
    }
    // step 6 — conversion into the approved quote unit (re-derived from the quote's valuation basis; deterministic)
    const convertedGrossTU = divRoundHalfEven(inst.requestedInstrumentAmountMicro * quote.conversionPricePerUnitMicro, MICRO);
    if (convertedGrossTU !== inst.grossTUMicro) {
      const t = this.transition(
        inst,
        "INVALID_PAYMENT",
        "CONVERSION_RECOMPUTE_MISMATCH",
        "step-6 conversion re-derivation differs from the quote preview — rejected",
        "PARTIAL_SETTLEMENT",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    // step 8 — net accepted payment value = gross − fee (exact integer math)
    const netTU = convertedGrossTU - inst.feeMicro;
    if (netTU <= 0n) {
      const t = this.transition(inst, "INVALID_PAYMENT", "NON_POSITIVE_NET_VALUE", `net ${fmt6(netTU)} TU ≤ 0`, "PARTIAL_SETTLEMENT");
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    inst.netTUMicro = netTU;
    const t = this.transition(
      inst,
      "NET_ACCEPTED",
      "NET_VALUE_ACCEPTED",
      `step 6: ${fmt6(inst.requestedInstrumentAmountMicro)} ${inst.instrumentCode} → ${fmt6(convertedGrossTU)} TU ` +
        `(conversion ${fmt6(quote.conversionPricePerUnitMicro)}); step 8: net = gross − fee = ${fmt6(convertedGrossTU)} − ` +
        `${fmt6(inst.feeMicro)} = ${fmt6(netTU)} TU`,
    );
    return {
      ok: t.ok,
      state: inst.state,
      reasonCode: t.reasonCode,
      observed: { grossTU: fmt6(convertedGrossTU), feeTU: fmt6(inst.feeMicro), netTU: fmt6(netTU) },
    };
  }

  // ---- §14.4 step 9 — explicit authorization (D-13.27 pluggable model) ----

  private authorizationModel(): AuthorizationModelStub {
    const alt = this.config.authorizationModelIdForTestingOnly ?? "ALT-2";
    switch (alt) {
      case "ALT-1":
        return new Alt1WindowModel(this.windows);
      case "ALT-3":
        return new Alt3RuleBoundProgramModel(this.rule);
      case "ALT-4":
        return new Alt4HybridAttestationModel(this.rule, this.attestation);
      default:
        return new Alt2ApprovalPerIssuanceModel(this.approvals);
    }
  }

  /**
   * ALT-2 harness: the EXPLICIT operator approval act. THIS IS THE ONLY CODE
   * PATH THAT CREATES APPROVALS. Payment events, settlement messages, quotes,
   * and replays can NEVER create an authorization record — that is the
   * structural form of the payment-alone-never-mints invariant (INV-A).
   */
  approveIssuance(requestId: string, approverId: string, note: string): { ok: boolean; reasonCode: string } {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "NET_ACCEPTED") {
      this.log(requestId, inst.state, null, "APPROVAL_REJECTED", `approveIssuance requires NET_ACCEPTED (got ${inst.state})`);
      return { ok: false, reasonCode: `APPROVAL_REJECTED_STATE_${inst.state}` };
    }
    if (this.approvals.has(requestId)) return { ok: false, reasonCode: "ALREADY_APPROVED" };
    this.approvals.set(requestId, { approverId, note, approvedAtMs: this.clockMs });
    this.log(requestId, inst.state, null, "EXPLICIT_APPROVAL_RECORDED", `ALT-2 TEST HARNESS: explicit approval by ${approverId} — a GOVERNANCE/OPERATOR act, never a payment event`);
    return { ok: true, reasonCode: "APPROVAL_RECORDED" };
  }

  /** ALT-1 harness: open a governance-authorized issuance window (TEST FIXTURE — simulates the governed act). */
  openIssuanceWindowForTest(w: {
    windowId: string;
    startMs: number;
    endMs: number;
    instruments: { code: string; network: string }[];
    trancheCapMicro: bigint;
  }): void {
    this.windows.push({
      ...w,
      consumedMicro: 0n,
      remainingCapMicro: w.trancheCapMicro,
      active: true,
      disclosure: `ALT-1 TEST HARNESS window ${w.windowId} — pre-authorized tranche (per-tranche cap, quote policy, eligible instruments, window duration, disclosure). NOT SELECTED (D-13.27 OPEN).`,
    });
  }

  /** ALT-3/ALT-4 harness: define a governance-bound issuance rule (TEST FIXTURE). */
  defineBoundRuleForTest(r: {
    ruleId: string;
    instruments: { code: string; network: string }[];
    perPeriodCapMicro: bigint;
    perTxCapMicro: bigint;
    circuitBreakerArmed: boolean;
  }): void {
    this.rule = { ...r, issuedInPeriodMicro: 0n };
  }

  /** ALT-4 harness: record a periodic governance attestation (TEST FIXTURE). */
  recordAttestationForTest(a: { attestationId: string; attestedAtMs: number; periodMs: number; matched: boolean }): void {
    this.attestation = { ...a };
  }

  authorize(requestId: string): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "NET_ACCEPTED") {
      this.log(requestId, inst.state, null, "STEP_REJECTED", `authorize requires NET_ACCEPTED (got ${inst.state})`);
      return { ok: false, state: inst.state, reasonCode: `STEP_REJECTED_STATE_${inst.state}` };
    }
    const quote = inst.quote;
    if (!quote || inst.netTUMicro === null) return { ok: false, state: inst.state, reasonCode: "INTERNAL_RECORDS_MISSING" };
    const model = this.authorizationModel();
    const prospective = divRoundHalfEven(inst.netTUMicro * MICRO, quote.quoteTUPerTokenMicro);
    inst.prospectiveIssuedMicro = prospective;
    const decision = model.decide({
      requestId,
      instrumentCode: inst.instrumentCode,
      network: inst.network,
      netTUMicro: inst.netTUMicro,
      prospectiveIssuedMicro: prospective,
      atMs: this.clockMs,
    });
    if (!decision.approved) {
      const t = this.transition(
        inst,
        "UNAUTHORIZED",
        decision.reasonCode,
        `no authorization under model ${model.altId}: ${decision.reasonCode}. D-13.27 OPEN — no alternative is ` +
          "selected; the invariant is the same under every alternative: a payment event alone NEVER mints.",
        "AUTHORIZATION_MISSING",
      );
      return { ok: t.ok, state: inst.state, reasonCode: decision.reasonCode };
    }
    // model-specific bookkeeping of the governed act (TEST-FIXTURE consumption)
    if (model.altId === "ALT-1") {
      const w = this.windows.find(
        (x) =>
          x.active &&
          this.clockMs >= x.startMs &&
          this.clockMs <= x.endMs &&
          x.instruments.some((i) => i.code === inst.instrumentCode && i.network === inst.network) &&
          x.remainingCapMicro >= prospective,
      );
      if (w) {
        w.consumedMicro += prospective;
        w.remainingCapMicro -= prospective;
      }
    }
    if (model.altId === "ALT-3" || model.altId === "ALT-4") {
      if (this.rule) this.rule.issuedInPeriodMicro += prospective;
    }
    const auth: AuthorizationRecord = {
      authorizationId: `AUTH-${requestId}`,
      requestId,
      modelId: model.altId,
      decision: "APPROVED",
      approverOrScope: decision.scopeEvidence,
      decidedAtMs: this.clockMs,
      evidenceRefs: [decision.reasonCode, model.label],
      label: `TEST-ONLY authorization record under ${model.altId} (${model.d1327Status}) — the model alternative is NOT SELECTED; D-13.27 remains OPEN`,
    };
    inst.authorizationRecord = auth;
    const t = this.transition(
      inst,
      "AUTHORIZED",
      "ISSUANCE_AUTHORIZED",
      `explicit authorization record ${auth.authorizationId} created under model ${model.altId} (scope: ${decision.scopeEvidence}); ` +
        "D-13.27 OPEN — ALT-1..ALT-4 remain unselected; this record is an EXPLICIT act, never a payment event",
    );
    return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
  }

  // ---- §14.4 step 9b — supply-limit checks (fail-closed) ----

  checkSupply(requestId: string): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "AUTHORIZED") {
      this.log(requestId, inst.state, null, "STEP_REJECTED", `checkSupply requires AUTHORIZED (got ${inst.state})`);
      return { ok: false, state: inst.state, reasonCode: `STEP_REJECTED_STATE_${inst.state}` };
    }
    const quote = inst.quote;
    if (!quote || inst.prospectiveIssuedMicro === null || inst.netTUMicro === null) {
      return { ok: false, state: inst.state, reasonCode: "INTERNAL_RECORDS_MISSING" };
    }
    const sp = this.config.supplyPolicy;
    const prospective = inst.prospectiveIssuedMicro;
    const fail = (reasonCode: string, taxonomy: ExceptionTaxonomyClass, detail: string): StepResult => {
      const t = this.transition(inst, "SUPPLY_CAP_EXCEEDED", reasonCode, detail, taxonomy);
      return { ok: false, state: inst.state, reasonCode: t.reasonCode };
    };
    if (this.pipelineSuspended) {
      return fail("PIPELINE_SUSPENDED_FAIL_CLOSED", "RECONCILE_MISMATCH", "issuance pipeline SUSPENDED — supply check fail-closed");
    }
    if (prospective > sp.perTxCapMicro) {
      return fail(
        "PER_TX_CAP_EXCEEDED",
        "SUPPLY_CAP",
        `prospective issuance ${fmt6(prospective)} > per-transaction cap ${fmt6(sp.perTxCapMicro)} (ILLUSTRATIVE cap; D-13.6 numbers deferred)`,
      );
    }
    const trancheRemaining = sp.trancheCapMicro - this.trancheIssuedMicro;
    if (prospective > trancheRemaining) {
      return fail(
        "TRANCHE_CAP_EXCEEDED",
        "SUPPLY_CAP",
        `prospective issuance ${fmt6(prospective)} > tranche ${sp.trancheId} remaining ${fmt6(trancheRemaining)} of ${fmt6(sp.trancheCapMicro)} (ILLUSTRATIVE; D-13.6 numbers deferred)`,
      );
    }
    const globalRemaining = sp.globalMaxSupplyMicro - this.totalSupplyMicro;
    if (prospective > globalRemaining) {
      return fail(
        "GLOBAL_MAX_SUPPLY_EXCEEDED",
        "SUPPLY_CAP",
        `prospective issuance ${fmt6(prospective)} > global max-supply remaining ${fmt6(globalRemaining)} of ${fmt6(sp.globalMaxSupplyMicro)} (ILLUSTRATIVE; D-13.6 numbers deferred)`,
      );
    }
    const t = this.transition(
      inst,
      "SUPPLY_CHECKED",
      "SUPPLY_CHECKS_PASSED",
      `caps OK (ILLUSTRATIVE policy — ${sp.label}): per-tx ${fmt6(prospective)} ≤ ${fmt6(sp.perTxCapMicro)}; tranche ` +
        `${fmt6(this.trancheIssuedMicro)} + ${fmt6(prospective)} ≤ ${fmt6(sp.trancheCapMicro)}; global ${fmt6(this.totalSupplyMicro)} ` +
        `+ ${fmt6(prospective)} ≤ ${fmt6(sp.globalMaxSupplyMicro)}`,
    );
    return {
      ok: t.ok,
      state: inst.state,
      reasonCode: t.reasonCode,
      observed: { prospectiveIssued: fmt6(prospective), supplyBefore: fmt6(this.totalSupplyMicro) },
    };
  }

  // ---- §14.4 step 10 — token issuance (idempotent LEDGER RECORD ONLY) ----

  issue(requestId: string): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    // Idempotent re-issue on the SAME request returns the original mint record — never a second mint (spec §6.4).
    const mintId = `MINT-${requestId}`;
    const existing = this.mintRecords.get(mintId);
    if (existing) {
      this.log(
        requestId,
        inst.state,
        null,
        "IDEMPOTENT_REISSUE_RETURNED_ORIGINAL",
        `mint ${mintId} already exists — returning the ORIGINAL mint record; no second mint (spec §6.4)`,
      );
      return {
        ok: true,
        state: inst.state,
        reasonCode: "IDEMPOTENT_REISSUE_RETURNED_ORIGINAL",
        observed: { mintId, amount: fmt6(existing.amountMicro), nonce: existing.nonce.toString(10) },
      };
    }
    if (inst.state !== "SUPPLY_CHECKED") {
      this.log(
        requestId,
        inst.state,
        null,
        "TRANSITION_REJECTED",
        `issue() requires SUPPLY_CHECKED (got ${inst.state}) — the state machine cannot skip authorization/supply steps`,
      );
      return { ok: false, state: inst.state, reasonCode: `TRANSITION_REJECTED_${inst.state}_TO_ISSUED` };
    }
    // INV-A hard guard (defense in depth; also enforced inside transition()).
    if (!(inst.settlementFinal && inst.authorizationRecord !== null && !this.pipelineSuspended)) {
      throw new MachineInvariantViolation(
        "INV-A VIOLATION ATTEMPTED (issue): settlement finality + explicit authorization record + non-suspended " +
          "pipeline are ALL required before issuance. A payment event alone can NEVER mint (spec §14.4; D-13.27).",
      );
    }
    if (inst.prospectiveIssuedMicro === null || inst.netTUMicro === null || inst.feeMicro === null || inst.grossTUMicro === null) {
      return { ok: false, state: inst.state, reasonCode: "INTERNAL_RECORDS_MISSING" };
    }
    this.mintNonceCounter += 1;
    const amount = inst.prospectiveIssuedMicro; // exact: issued = net ÷ quote (spec §14.5 general form)
    const record: MintRecord = {
      mintId,
      nonce: this.mintNonceCounter,
      idempotencyKey: inst.idempotencyKey,
      requestId,
      quoteId: inst.quote?.quoteId ?? "n/a",
      recipientId: inst.recipientId,
      amountMicro: amount,
      issuedAtMs: this.clockMs,
      recordOnlyLabel: "LEDGER RECORD ONLY — NO ON-CHAIN ACTION (non-production prototype; no token contract is involved)",
    };
    this.mintRecords.set(mintId, record);
    this.mintRegistryByIdemKey.set(inst.idempotencyKey, mintId);
    this.tokenBook.set(mintId, { mintId, requestId, recipientId: inst.recipientId, amountMicro: amount });
    this.totalSupplyMicro += amount;
    this.trancheIssuedMicro += amount;
    this.feeBookTotalMicro += inst.feeMicro;
    this.issuanceBook.set(requestId, {
      requestId,
      mintId,
      issuedMicro: amount,
      feeMicro: inst.feeMicro,
      netTUMicro: inst.netTUMicro,
      grossTUMicro: inst.grossTUMicro,
      authorizationId: inst.authorizationRecord?.authorizationId ?? "n/a",
      quoteId: record.quoteId,
    });
    this.paymentBook.set(requestId, {
      requestId,
      paymentTxId: inst.payment?.paymentTxId ?? "n/a",
      grossTUMicro: inst.grossTUMicro,
      feeMicro: inst.feeMicro,
      netTUMicro: inst.netTUMicro,
      status: "SETTLED",
    });
    inst.issuedMicro = amount;
    const t = this.transition(
      inst,
      "ISSUED",
      "ISSUED_LEDGER_RECORD_CREATED",
      `mint record ${mintId} (nonce ${record.nonce}, idempotency key ${inst.idempotencyKey}): ${fmt6(amount)} tokens to ` +
        `${inst.recipientId} = net ${fmt6(inst.netTUMicro)} TU ÷ quote ${fmt6(inst.quote?.quoteTUPerTokenMicro ?? 0n)} ` +
        `(spec §14.5 general form — quote policy ILLUSTRATIVE). ${record.recordOnlyLabel}`,
    );
    return {
      ok: t.ok,
      state: inst.state,
      reasonCode: t.reasonCode,
      observed: {
        mintId,
        nonce: record.nonce.toString(10),
        issuedAmount: fmt6(amount),
        supplyAfter: fmt6(this.totalSupplyMicro),
        trancheConsumed: fmt6(this.trancheIssuedMicro),
      },
    };
  }

  // ---- §14.4 step 11 — three-book reconciliation (spec §6.5) ----

  reconcile(requestId: string): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "ISSUED") {
      this.log(requestId, inst.state, null, "STEP_REJECTED", `reconcile requires ISSUED (got ${inst.state})`);
      return { ok: false, state: inst.state, reasonCode: `STEP_REJECTED_STATE_${inst.state}` };
    }
    const snap = this.ledgerSnapshot();
    const result = reconcileThreeBooks(snap);
    if (result.balanced) {
      const t = this.transition(
        inst,
        "RECONCILED",
        "THREE_BOOK_RECONCILED",
        `three-book equality (payment book vs issuance book vs token book + fee ledger): ${result.checks
          .map((c) => `${c.check}=PASS`)
          .join("; ")} (spec §6.5; prototype analog of three-book-separation.ts vocabulary)`,
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    const failed = result.checks.filter((c) => !c.passed).map((c) => `${c.check} (${c.detail})`).join("; ");
    const t = this.transition(
      inst,
      "RECONCILIATION_BREAK",
      "THREE_BOOK_DIVERGENCE",
      `three-book reconciliation FAILED: ${failed}. Fail-closed: pipeline SUSPENDED; exception queued; NO silent re-mint; ` +
        "NO silent write-off (spec §6.5/§6.6 RECONCILE_MISMATCH)",
      "RECONCILE_MISMATCH",
    );
    if (t.performed) {
      this.pipelineSuspended = true;
      this.suspensionReasons.push(`RECONCILIATION_BREAK:${requestId}`);
      this.exceptions.push({
        exceptionId: `EXC-${requestId}-RECON`,
        requestId,
        taxonomyClass: "RECONCILE_MISMATCH",
        reasonCode: "THREE_BOOK_DIVERGENCE",
        openedAtMs: this.clockMs,
        status: "OPEN",
        notes: `reconciliation divergence detected: ${failed}`,
      });
    }
    return { ok: false, state: inst.state, reasonCode: t.reasonCode };
  }

  // ---- reversal handling (spec §6.3; DEC-REVERSAL-SEMANTICS OPEN) ----

  handleReversalNotice(requestId: string, sourceLabel = "settlement rail"): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state === "ISSUED" || inst.state === "RECONCILED") {
      // INV-D: reversal AFTER issuance → RECONCILIATION exception + pipeline SUSPENDED; no silent re-mint/write-off.
      const t = this.transition(
        inst,
        "RECONCILIATION_BREAK",
        "REVERSAL_AFTER_ISSUANCE",
        `payment reversal arrived AFTER issuance (${sourceLabel}). OPEN DECISION (DEC-REVERSAL-SEMANTICS, D-13.27/spec §6.3): ` +
          "the prototype FAIL-CLOSES — RECONCILIATION exception + pipeline SUSPENDED; the mint record is PRESERVED " +
          "(no silent write-off); NO re-mint; adjudication is left OPEN.",
        "REVERSAL_AFTER_ISSUANCE",
      );
      if (t.performed) {
        this.pipelineSuspended = true;
        this.suspensionReasons.push(`REVERSAL_AFTER_ISSUANCE:${requestId}`);
        this.exceptions.push({
          exceptionId: `EXC-${requestId}-REVPOST`,
          requestId,
          taxonomyClass: "REVERSAL_AFTER_ISSUANCE",
          reasonCode: "REVERSAL_AFTER_ISSUANCE",
          openedAtMs: this.clockMs,
          status: "OPEN",
          notes:
            "reversal after issuance — reconciliation exception OPEN; mint record preserved (no write-off); " +
            "no re-mint; pipeline suspended pending adjudication (decision OPEN)",
        });
        const pb = this.paymentBook.get(requestId);
        if (pb) pb.status = "REVERSED_POST_ISSUANCE";
      }
      return { ok: false, state: inst.state, reasonCode: t.reasonCode };
    }
    if (isTerminal(inst.state)) {
      this.log(requestId, inst.state, null, "REVERSAL_IGNORED_TERMINAL", "reversal notice on a terminal instance — no state change");
      return { ok: false, state: inst.state, reasonCode: "REVERSAL_IGNORED_TERMINAL" };
    }
    // pre-issuance reversal → cancel, no mint, refund queued (same idempotency key, spec §6.3)
    const t = this.transition(
      inst,
      "PAYMENT_REVERSED",
      "REVERSAL_BEFORE_ISSUANCE",
      `payment reversal arrived BEFORE issuance (${sourceLabel}) — cancel; NO mint; auto-refund queued with the same ` +
        "idempotency key (spec §6.3)",
      "REVERSAL_AFTER_ISSUANCE",
    );
    if (t.performed && inst.payment) {
      this.refundQueue.push({
        refundId: `RFND-${requestId}`,
        requestId,
        paymentTxId: inst.payment.paymentTxId,
        idempotencyKey: inst.idempotencyKey,
        grossInstrumentAmountMicro: inst.payment.amountMicro,
        reasonCode: "REVERSAL_BEFORE_ISSUANCE",
        state: "PENDING_REFUND",
        createdAtMs: this.clockMs,
      });
    }
    return { ok: false, state: inst.state, reasonCode: t.reasonCode };
  }

  // ---- refunds (spec §6.3 refund state machine) ----

  /** PENDING_REFUND → REFUNDED (deterministic in-process completion; recovery process OPEN — DEC-FAILURE-RECOVERY). */
  processRefundQueue(): { processed: number; refunds: RefundRecord[] } {
    let processed = 0;
    for (const r of this.refundQueue) {
      if (r.state === "PENDING_REFUND") {
        r.state = "REFUNDED";
        processed += 1;
        this.log(
          r.requestId,
          null,
          null,
          "REFUND_COMPLETED",
          `refund ${r.refundId} (payment ${r.paymentTxId}, idempotency key ${r.idempotencyKey}) → REFUNDED; ` +
            "same-key refund per spec §6.3; no fee retained on the failed transaction",
        );
      }
    }
    return { processed, refunds: [...this.refundQueue] };
  }

  // ---- §14.4 step 12 — failure recovery + audit publication ----

  publishAuditLog(): { machineId: string; publishedAtMs: number; entries: readonly EventLogEntry[]; publicationTag: string } {
    const canonical = this.eventLog.map((e) => `${e.seq}|${e.requestId}|${e.from}|${e.to}|${e.reasonCode}`).join(";");
    return {
      machineId: this.config.machineId,
      publishedAtMs: this.clockMs,
      entries: [...this.eventLog],
      publicationTag: computeSyntheticAuthTag(TEST_ONLY_AUTH_KEY_LITERAL, canonical),
    };
  }

  // ---- snapshots (read-only views for tests) ----

  getInstanceState(requestId: string): {
    state: IssuanceState;
    terminalReasonCode: string | null;
    terminalTaxonomyClass: ExceptionTaxonomyClass | null;
    settlementFinal: boolean;
    hasAuthorizationRecord: boolean;
    hasMintRecord: boolean;
    issuedMicro: string | null;
    netTUMicro: string | null;
    feeMicro: string | null;
    prospectiveIssuedMicro: string | null;
    inFlightDisclosure: string | null;
    simulationLabels: string[];
  } | null {
    const inst = this.requireInstance(requestId);
    if (!inst) return null;
    return {
      state: inst.state,
      terminalReasonCode: inst.terminalReasonCode,
      terminalTaxonomyClass: inst.terminalTaxonomyClass,
      settlementFinal: inst.settlementFinal,
      hasAuthorizationRecord: inst.authorizationRecord !== null,
      hasMintRecord: this.mintRecords.has(`MINT-${requestId}`),
      issuedMicro: inst.issuedMicro !== null ? fmt6(inst.issuedMicro) : null,
      netTUMicro: inst.netTUMicro !== null ? fmt6(inst.netTUMicro) : null,
      feeMicro: inst.feeMicro !== null ? fmt6(inst.feeMicro) : null,
      prospectiveIssuedMicro: inst.prospectiveIssuedMicro !== null ? fmt6(inst.prospectiveIssuedMicro) : null,
      inFlightDisclosure: inst.inFlightDisclosure,
      simulationLabels: [...inst.simulationLabels],
    };
  }

  getMintRecord(requestId: string): { mintId: string; nonce: number; idempotencyKey: string; amountMicro: bigint; recordOnlyLabel: string } | null {
    const rec = this.mintRecords.get(`MINT-${requestId}`);
    return rec ? { ...rec } : null;
  }

  getSupplySnapshot(): {
    totalSupplyMicro: string;
    trancheIssuedMicro: string;
    trancheCapMicro: string;
    globalMaxSupplyMicro: string;
    perTxCapMicro: string;
    mintCount: number;
    feeBookTotalMicro: string;
  } {
    const sp = this.config.supplyPolicy;
    return {
      totalSupplyMicro: fmt6(this.totalSupplyMicro),
      trancheIssuedMicro: fmt6(this.trancheIssuedMicro),
      trancheCapMicro: fmt6(sp.trancheCapMicro),
      globalMaxSupplyMicro: fmt6(sp.globalMaxSupplyMicro),
      perTxCapMicro: fmt6(sp.perTxCapMicro),
      mintCount: this.mintRecords.size,
      feeBookTotalMicro: fmt6(this.feeBookTotalMicro),
    };
  }

  getExceptions(): readonly ExceptionRecord[] {
    return [...this.exceptions];
  }
  getRefundQueue(): readonly RefundRecord[] {
    return [...this.refundQueue];
  }
  getInstanceCount(): number {
    return this.instances.size;
  }
  getEventLog(): readonly EventLogEntry[] {
    return [...this.eventLog];
  }

  ledgerSnapshot(): LedgerSnapshot {
    return {
      paymentBookEntries: [...this.paymentBook.values()].map((e) => ({ ...e })),
      issuanceRecords: [...this.issuanceBook.values()].map((e) => ({ ...e })),
      tokenBook: [...this.tokenBook.values()].map((e) => ({ ...e })),
      totalSupplyMicro: this.totalSupplyMicro,
      feeBookTotalMicro: this.feeBookTotalMicro,
    };
  }

  /**
   * TEST-ONLY bypass-attempt harness (mirrors the §84 10-route bypass harness
   * vocabulary of finality-before-mint.ts): attempts to force the internal
   * transition to ISSUED SKIPPING the transition table, so the tests can
   * prove the machine-level ISSUED invariant (INV-A) throws regardless.
   * Must ALWAYS throw MachineInvariantViolation for any instance lacking
   * settlement finality + explicit authorization.
   */
  __testAttemptDirectIssueBypass(requestId: string): { threw: boolean; message: string } {
    const inst = this.requireInstance(requestId);
    if (!inst) return { threw: true, message: "REQUEST_NOT_FOUND (trivially blocked)" };
    try {
      if (!(inst.settlementFinal && inst.authorizationRecord !== null && inst.state === "SUPPLY_CHECKED" && !this.pipelineSuspended)) {
        throw new MachineInvariantViolation(
          "INV-A: bypass attempt blocked — no settlement finality + explicit authorization record pair ⇒ ISSUED unreachable",
        );
      }
      // A fully-authorized instance is legitimately issuable — the bypass harness reports no violation found.
      return { threw: false, message: "instance is legitimately issuable (guards satisfied) — nothing to block" };
    } catch (e) {
      return { threw: true, message: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * TEST-ONLY forced ledger break (ISS-10): corrupts ONE internal book entry to
   * prove reconciliation is a REAL check, not a no-op. Labeled TEST-ONLY.
   */
  __testOnlyForceLedgerBreak(kind: "PAYMENT_BOOK_NET" | "TOKEN_BOOK_AMOUNT", requestId: string, deltaMicro: bigint): { ok: boolean } {
    if (kind === "PAYMENT_BOOK_NET") {
      const e = this.paymentBook.get(requestId);
      if (!e) return { ok: false };
      e.netTUMicro += deltaMicro;
      return { ok: true };
    }
    const iss = this.issuanceBook.get(requestId);
    if (!iss) return { ok: false };
    const tok = this.tokenBook.get(iss.mintId);
    if (!tok) return { ok: false };
    tok.amountMicro += deltaMicro;
    return { ok: true };
  }

  // ---- machine-level invariants (INV-A..INV-E) ----

  /** Throws MachineInvariantViolation if ANY machine-level invariant is broken. */
  assertInvariants(): void {
    for (const inst of this.instances.values()) {
      const mint = this.mintRecords.get(`MINT-${inst.requestId}`);
      // INV-A — issuance requires settlement finality AND an explicit authorization record.
      // (RECONCILIATION_BREAK instances always descend from ISSUED/RECONCILED, i.e. from a minted
      // instance, so the same preconditions must hold for them too.)
      if (inst.state === "ISSUED" || inst.state === "RECONCILED" || inst.state === "RECONCILIATION_BREAK") {
        if (!inst.settlementFinal || inst.authorizationRecord === null) {
          throw new MachineInvariantViolation(
            `INV-A broken for ${inst.requestId}: state ${inst.state} without settlement finality + authorization record`,
          );
        }
      }
      // INV-B — failed/unverified payments never mint.
      if (
        ["PAYMENT_FAILED", "EXPIRED_QUOTE", "UNAUTHORIZED", "INVALID_PAYMENT", "DUPLICATE", "SUPPLY_CAP_EXCEEDED", "PAYMENT_REVERSED", "INVALID_INSTRUMENT"].includes(
          inst.state,
        ) &&
        mint !== undefined
      ) {
        throw new MachineInvariantViolation(`INV-B broken for ${inst.requestId}: terminal ${inst.state} but a mint record exists`);
      }
      if (inst.state === "PAYMENT_FAILED" && inst.settlementFinal) {
        throw new MachineInvariantViolation(`INV-B broken for ${inst.requestId}: PAYMENT_FAILED yet settlementFinal=true`);
      }
    }
    // INV-C — replays never double-mint: idempotency keys map 1:1 to mint records; supply equals Σ mint records.
    if (this.mintRegistryByIdemKey.size !== this.mintRecords.size) {
      throw new MachineInvariantViolation("INV-C broken: idempotency-key→mint registry size mismatch");
    }
    let sum = 0n;
    for (const m of this.mintRecords.values()) {
      if (this.mintRegistryByIdemKey.get(m.idempotencyKey) !== m.mintId) {
        throw new MachineInvariantViolation(`INV-C broken: mint ${m.mintId} not registered under its idempotency key`);
      }
      sum += m.amountMicro;
    }
    if (sum !== this.totalSupplyMicro) {
      throw new MachineInvariantViolation("INV-C broken: totalSupply ≠ Σ mint records");
    }
    // INV-D — suspension always carries a reason + an OPEN exception; mint records are never silently written off.
    if (this.pipelineSuspended && this.suspensionReasons.length === 0) {
      throw new MachineInvariantViolation("INV-D broken: pipeline suspended without a recorded reason");
    }
    if (this.pipelineSuspended && !this.exceptions.some((e) => e.status === "OPEN")) {
      throw new MachineInvariantViolation("INV-D broken: pipeline suspended without an OPEN reconciliation exception");
    }
    // INV-E — the OPEN decision constants must all be flagged open.
    if (!OPEN_IMPLEMENTATION_DECISIONS.every((d) => d.open)) {
      throw new MachineInvariantViolation("INV-E broken: an implementation decision is marked closed (must remain OPEN)");
    }
  }
}

// ----------------------------------------------------------------------------
// §9 — PURE three-book reconciliation (spec §6.5) — a REAL check, not a no-op
// ----------------------------------------------------------------------------

export interface LedgerSnapshot {
  paymentBookEntries: PaymentBookEntry[];
  issuanceRecords: IssuanceBookEntry[];
  tokenBook: TokenBookEntry[];
  totalSupplyMicro: bigint;
  feeBookTotalMicro: bigint;
}

export interface ReconciliationCheckResult {
  check: string;
  passed: boolean;
  detail: string;
}

export interface ReconciliationResult {
  balanced: boolean;
  checks: ReconciliationCheckResult[];
  bookTotals: Record<string, string>;
}

export function reconcileThreeBooks(snap: LedgerSnapshot): ReconciliationResult {
  const tokenSum = snap.tokenBook.reduce((acc, t) => acc + t.amountMicro, 0n);
  const issuanceSum = snap.issuanceRecords.reduce((acc, i) => acc + i.issuedMicro, 0n);
  const feeSum = snap.issuanceRecords.reduce((acc, i) => acc + i.feeMicro, 0n);
  const checks: ReconciliationCheckResult[] = [];

  // C1 — token book vs total supply (spec §6.5 on-chain/token-ledger analog)
  checks.push({
    check: "C1_TOKEN_BOOK_EQUALS_TOTAL_SUPPLY",
    passed: tokenSum === snap.totalSupplyMicro,
    detail: `token book Σ ${fmt6(tokenSum)} vs total supply ${fmt6(snap.totalSupplyMicro)}`,
  });
  // C2 — issuance book vs token book 1:1 linkage (spec §6.5 acquirer-ledger analog)
  const orphanMints = snap.tokenBook.filter((t) => !snap.issuanceRecords.some((i) => i.mintId === t.mintId && i.issuedMicro === t.amountMicro));
  checks.push({
    check: "C2_ISSUANCE_BOOK_LINKS_TOKEN_BOOK_1TO1",
    passed: issuanceSum === tokenSum && orphanMints.length === 0,
    detail: `issuance Σ ${fmt6(issuanceSum)} vs token Σ ${fmt6(tokenSum)}; orphan mint entries: ${orphanMints.length}`,
  });
  // C3 — value conservation per issuance: fee + net = gross; every settled payment links 1:1 to an issuance
  const valueBreaks: string[] = [];
  for (const i of snap.issuanceRecords) {
    if (i.feeMicro + i.netTUMicro !== i.grossTUMicro) valueBreaks.push(`${i.requestId}: fee+net≠gross`);
    const pay = snap.paymentBookEntries.find((p) => p.requestId === i.requestId);
    if (!pay || pay.status !== "SETTLED") valueBreaks.push(`${i.requestId}: no SETTLED payment entry`);
    else if (pay.netTUMicro !== i.netTUMicro || pay.feeMicro !== i.feeMicro || pay.grossTUMicro !== i.grossTUMicro) {
      valueBreaks.push(`${i.requestId}: payment book ≠ issuance book`);
    }
  }
  const orphanPayments = snap.paymentBookEntries.filter((p) => p.status === "SETTLED" && !snap.issuanceRecords.some((i) => i.requestId === p.requestId));
  if (orphanPayments.length > 0) valueBreaks.push(`${orphanPayments.length} settled payment(s) without an issuance record`);
  checks.push({
    check: "C3_VALUE_CONSERVATION_AND_1TO1_PAYMENT_LINKAGE",
    passed: valueBreaks.length === 0,
    detail: valueBreaks.length === 0 ? "fee + net = gross for every issuance; payments link 1:1" : valueBreaks.join("; "),
  });
  // C4 — fee ledger equals Σ fee line items (no double charging, no undisclosed spread — spec §2/§6.1)
  checks.push({
    check: "C4_FEE_LEDGER_EQUALS_SUM_OF_LINE_ITEMS",
    passed: feeSum === snap.feeBookTotalMicro,
    detail: `fee ledger ${fmt6(snap.feeBookTotalMicro)} vs Σ fee line items ${fmt6(feeSum)}`,
  });

  return {
    balanced: checks.every((c) => c.passed),
    checks,
    bookTotals: {
      paymentBookSettledCount: snap.paymentBookEntries.filter((p) => p.status === "SETTLED").length.toString(10),
      issuanceRecordCount: snap.issuanceRecords.length.toString(10),
      tokenBookSum: fmt6(tokenSum),
      totalSupply: fmt6(snap.totalSupplyMicro),
      feeLedgerTotal: fmt6(snap.feeBookTotalMicro),
    },
  };
}
