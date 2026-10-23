// ============================================================================
// MTQΣ — PAYMENT-FUNDED PRIMARY ISSUANCE STATE MACHINE (Task M8-3b)
// ============================================================================
// PROVENANCE: ported from the validated MANDATE-007 §4 prototype
// (audit-work/task13/evidence/issuance-state-machine/issuance-state-machine.ts
// — immutable evidence; 123/123 assertions ×2 fresh runs, exit 0, double-run
// deterministic) into the production engine at src/lib/mtq/issuance/,
// implementing the spec §14.4 12-step minting workflow / §14.6 8-stage
// controlled process, with the ADOPTED (DELEGATED) 2026-10-23 decisions of
// spec §14.6 REVISION 2 configured in:
//
//   (1) authorization model = ALT-4 — hybrid + periodic attestation
//       (programs = explicit signed records; INV-A unconditional; attestation
//       failures suspend the pipeline fail-closed);
//   (2) settlement timing = FINALITY-BEFORE-ISSUANCE (issuance only after
//       settlement finality on the funding rail; a payment whose finality
//       arrives after quote expiry → EXPIRED_QUOTE);
//   (3) reversal semantics = pre-issuance → CANCELLED (no mint) /
//       post-issuance → RECONCILIATION_BREAK + pipeline SUSPENDED +
//       fail-closed authorized remediation (honest naming note: the immutable
//       prototype labeled the pre-issuance terminal PAYMENT_REVERSED —
//       production naming follows the adopted decision: CANCELLED);
//   (4) failure recovery = FAIL-CLOSED (no partial states, no
//       retry-without-record, no silent healing; resume only via explicit
//       authorized acts);
//   (5) transaction boundaries = ONE REQUEST = ONE PAYMENT = ONE
//       AUTHORIZATION RECORD = ONE MINT RECORD (atomic, idempotent by request
//       ID; no split mints);
//   (6) fees/quote FORM adopted — every VALUE remains an UNAPPROVED
//       ILLUSTRATIVE named default (see parameters.ts provenance block).
//
// "ISSUED" IS A LEDGER RECORD ONLY — NO ON-CHAIN ACTION, NO NETWORK CALL, NO
// KEY HANDLING, NO REAL TOKEN EXISTS. Zero on-chain actions occur anywhere in
// this module.
//
// THE 21 STATES (§14.4 step mapping in STATE_STEP_REFS):
//   flow: REQUEST_CREATED → QUOTED → PAYMENT_OBSERVED → PAYMENT_AUTHENTIC →
//         SETTLEMENT_FINAL → INSTRUMENT_CHECKED → FEES_CALCULATED →
//         NET_ACCEPTED → AUTHORIZED → SUPPLY_CHECKED → ISSUED → RECONCILED
//   terminal failure states (spec §6.6 taxonomy): DUPLICATE · EXPIRED_QUOTE ·
//         PAYMENT_FAILED · CANCELLED · UNAUTHORIZED · INVALID_INSTRUMENT ·
//         INVALID_PAYMENT · SUPPLY_CAP_EXCEEDED · RECONCILIATION_BREAK
//
// MACHINE-LEVEL INVARIANTS (assertInvariants):
//   INV-A — issuance requires settlement finality AND an applicable unrevoked
//           authorization program record (hard-guarded INSIDE the transition);
//           a payment event ALONE can NEVER reach ISSUED — unconditional.
//   INV-B — failed/unverified payments never mint.
//   INV-C — replays/retries/duplicates never double-mint (1:1:1:1 shape;
//           supply equals Σ mint records).
//   INV-D — every pipeline suspension carries recorded reasons + an OPEN
//           exception; mint records are never silently written off; recovery
//           only via explicit authorized acts (no silent healing).
//   INV-E — honesty sweep: every mint record carries the LEDGER-RECORD-ONLY
//           label, every authorization record carries the ALT-4 adopted-model
//           label, and every fee/quote surface carries the UNAPPROVED/
//           ILLUSTRATIVE labels (construction-time constants re-verified per
//           record instance).
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// ============================================================================

import {
  classifyDepegBand,
  type DepegBand,
  type DepegObservation,
  type PaymentInstrumentRegistry,
} from "./instrument-registry";
import {
  ALT4_ADOPTION_LABEL,
  checkAttestationStatus,
  checkProgramAuthorization,
  syntheticSignatureTag,
  type AttestationRecord,
  type AttestationStatus,
  type AuthorizationDecision,
  type IssuanceProgramRecord,
} from "./authorization";
import {
  FEE_SCHEDULE,
  MICRO,
  QUOTE_POLICY,
  ROUNDING_RULE,
  SUPPLY_POLICY,
  divRoundHalfEven,
  fmt6,
  type FeeSchedule,
  type QuotePolicy,
  type SupplyPolicy,
} from "./parameters";

export type { DepegBand, DepegObservation } from "./instrument-registry";

// ----------------------------------------------------------------------------
// §0 — Honest labels
// ----------------------------------------------------------------------------

export const MACHINE_LABEL =
  "PAYMENT-FUNDED PRIMARY ISSUANCE STATE MACHINE (pilot implementation of spec §14.4 12-step workflow / " +
  "§14.6 8-stage controlled process) — TEST LEDGER ONLY · NEVER ON-CHAIN · ISSUED = LEDGER RECORD ONLY.";

export const D_13_27_STATUS =
  "ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION: ALT-4 (hybrid + periodic attestation), " +
  "finality-before-issuance, pre-issuance reversal → CANCELLED / post-issuance → RECONCILIATION_BREAK + " +
  "SUSPENDED + fail-closed authorized remediation, fail-closed failure recovery, 1:1:1:1 atomic idempotent " +
  "transaction boundaries, fee/quote FORM adopted with VALUES UNAPPROVED (D-13.8 value + §14.5 derivation " +
  "policy publication remain OPEN). Spec §14.6 REVISION 2.";

// ----------------------------------------------------------------------------
// §2 — SYNTHETIC IN-PROCESS AUTHENTICITY SCHEME (step 4a; clearly TEST-ONLY)
// ----------------------------------------------------------------------------

/**
 * TEST-ONLY key literal. NOT a secret, NOT a credential — published on
 * purpose (a real secret would never be committed; this explicitly is not
 * one). In this pilot NO real rail exists, so payment authenticity is
 * demonstrated with an in-process HMAC-STYLE tag. PRODUCTION REQUIRES REAL
 * PER-RAIL SIGNATURE VERIFICATION (spec §6.2) — none exists here.
 */
export const TEST_ONLY_AUTH_KEY_LITERAL = "TEST-ONLY-NOT-A-SECRET";

export const AUTH_SCHEME_LABEL =
  "SYNTHETIC IN-PROCESS AUTHENTICITY SCHEME — an HMAC-STYLE tag computed in-process with a TEST-ONLY literal " +
  "key. NOT cryptographic. Tags are deliberately truncated to 16 hex characters so that no 64-char hex " +
  "literal is ever produced anywhere. PRODUCTION REQUIRES REAL PER-RAIL SIGNATURE VERIFICATION (spec §6.2) — " +
  "no real rail or signature verification exists in this pilot.";

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
// §3 — States (21) + the EXPLICIT transition table
// ----------------------------------------------------------------------------

export type IssuanceState =
  | "REQUEST_CREATED" // §14.4 steps 1+3 — instrument selection + explicit user issuance request
  | "QUOTED" // §14.4 step 2 — quote id, price basis, validity-window expiry, quote-unit conversion
  | "PAYMENT_OBSERVED" // payment event intake (pre-4a)
  | "PAYMENT_AUTHENTIC" // §14.4 step 4a — payment authenticity verification
  | "SETTLEMENT_FINAL" // §14.4 step 4b — rail-specific finality (spec §6.2; finality-before-issuance)
  | "INSTRUMENT_CHECKED" // §14.4 step 5 — instrument/jurisdiction/depeg checks AT SETTLEMENT TIME
  | "FEES_CALCULATED" // §14.4 step 7 — fee schedule UNAPPROVED (D-13.8 value OPEN)
  | "NET_ACCEPTED" // §14.4 steps 6+8 — quote-unit conversion + net accepted payment value
  | "AUTHORIZED" // §14.4 step 9 — ALT-4 program record (explicit; payment alone NEVER authorizes)
  | "SUPPLY_CHECKED" // §14.4 step 9b — per-tx + tranche + global caps (fail-closed)
  | "ISSUED" // §14.4 step 10 — idempotent mint record (LEDGER RECORD ONLY — NEVER ON-CHAIN)
  | "RECONCILED" // §14.4 step 11 — three-book reconciliation (spec §6.5)
  // ---- terminal failure states (spec §6.6 exception taxonomy) ----
  | "DUPLICATE" // duplicate idempotency key / payment txId (spec §6.4, §6.6 DUPLICATE_KEY_COLLISION)
  | "EXPIRED_QUOTE" // finality after quote expiry (adopted decision 2; §6.6 CONFIRMATION_TIMEOUT analog)
  | "PAYMENT_FAILED" // settlement FAILED / TIMEOUT / finality-evidence gap (spec §6.3, §6.6)
  | "CANCELLED" // reversal BEFORE issuance → cancel, no mint (adopted decision 3)
  | "UNAUTHORIZED" // settlement final but NO applicable program (INV-A — payment alone never mints)
  | "INVALID_INSTRUMENT" // not in registry / REVOKED→RETIRED analog / other-network / jurisdiction / depeg
  | "INVALID_PAYMENT" // authenticity-tag failure / amount mismatch (§6.6 PARTIAL_SETTLEMENT analog)
  | "SUPPLY_CAP_EXCEEDED" // per-tx / tranche / global cap (step 9b, fail-closed)
  | "RECONCILIATION_BREAK"; // three-book divergence (§6.5/§6.6; also reversal AFTER issuance)

export const TERMINAL_STATES: readonly IssuanceState[] = [
  "DUPLICATE",
  "EXPIRED_QUOTE",
  "PAYMENT_FAILED",
  "CANCELLED",
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
  REQUEST_CREATED: "§14.4 steps 1+3 (instrument selection; explicit user issuance request) · §14.6 stage 1",
  QUOTED: "§14.4 step 2 (quote calculation, §14.5 form + validity window) · §14.6 stage 5 form",
  PAYMENT_OBSERVED: "§14.4 step 4 (payment event intake) · §14.6 stage 2",
  PAYMENT_AUTHENTIC: "§14.4 step 4a (payment authenticity verification) · §14.6 stage 2",
  SETTLEMENT_FINAL: "§14.4 step 4b (settlement-finality confirmation, spec §6.2; finality-before-issuance) · §14.6 stage 3",
  INSTRUMENT_CHECKED: "§14.4 step 5 (instrument/jurisdiction/depeg checks at settlement time) · §14.6 stage 3",
  FEES_CALCULATED: "§14.4 step 7 (fee calculation — D-13.8 value OPEN, ILLUSTRATIVE) · §14.6 stage 6",
  NET_ACCEPTED: "§14.4 steps 6+8 (quote-unit conversion; net accepted payment value) · §14.6 stages 5+6",
  AUTHORIZED: "§14.4 step 9 (ALT-4 authorization program record) · §14.6 stage 4",
  SUPPLY_CHECKED: "§14.4 step 9b (supply-limit checks — fail-closed) · §14.6 stage 7",
  ISSUED: "§14.4 step 10 (token issuance — idempotent LEDGER RECORD ONLY, NEVER ON-CHAIN)",
  RECONCILED: "§14.4 step 11 (payment & issuance reconciliation, spec §6.5) · §14.6 stage 8",
  DUPLICATE: "§14.4 step 12 (failure path) — spec §6.4/§6.6 DUPLICATE_KEY_COLLISION",
  EXPIRED_QUOTE: "§14.4 step 12 (failure path) — spec §6.1/§6.6 CONFIRMATION_TIMEOUT analog; adopted decision 2",
  PAYMENT_FAILED: "§14.4 step 12 (failure path) — spec §6.3/§6.6",
  CANCELLED: "§14.4 step 12 (failure path) — spec §6.3 reversal before issuance; adopted decision 3 (no mint)",
  UNAUTHORIZED: "§14.4 step 12 (failure path) — INV-A: payment alone never mints (ALT-4 program envelope)",
  INVALID_INSTRUMENT: "§14.4 step 12 (failure path) — step 5 rejection",
  INVALID_PAYMENT: "§14.4 step 12 (failure path) — step 4a/4b rejection (§6.6 PARTIAL_SETTLEMENT analog)",
  SUPPLY_CAP_EXCEEDED: "§14.4 step 12 (failure path) — step 9b fail-closed",
  RECONCILIATION_BREAK: "§14.4 step 12 (failure path) — spec §6.5/§6.6 RECONCILE_MISMATCH; adopted decision 3",
};

/** EXPLICIT transition table — the state machine core. */
export const ALLOWED_TRANSITIONS: Readonly<Record<IssuanceState, readonly IssuanceState[]>> = {
  REQUEST_CREATED: ["QUOTED", "INVALID_INSTRUMENT", "DUPLICATE"],
  QUOTED: ["PAYMENT_OBSERVED", "EXPIRED_QUOTE", "CANCELLED", "DUPLICATE"],
  PAYMENT_OBSERVED: ["PAYMENT_AUTHENTIC", "INVALID_PAYMENT", "DUPLICATE", "CANCELLED"],
  PAYMENT_AUTHENTIC: ["SETTLEMENT_FINAL", "PAYMENT_FAILED", "EXPIRED_QUOTE", "INVALID_PAYMENT", "CANCELLED"],
  SETTLEMENT_FINAL: ["INSTRUMENT_CHECKED", "INVALID_INSTRUMENT", "INVALID_PAYMENT", "CANCELLED"],
  INSTRUMENT_CHECKED: ["FEES_CALCULATED", "CANCELLED"],
  FEES_CALCULATED: ["NET_ACCEPTED", "CANCELLED"],
  NET_ACCEPTED: ["AUTHORIZED", "UNAUTHORIZED", "CANCELLED"],
  AUTHORIZED: ["SUPPLY_CHECKED", "SUPPLY_CAP_EXCEEDED", "CANCELLED"],
  SUPPLY_CHECKED: ["ISSUED", "SUPPLY_CAP_EXCEEDED", "CANCELLED"],
  ISSUED: ["RECONCILED", "RECONCILIATION_BREAK"],
  RECONCILED: ["RECONCILIATION_BREAK"],
  DUPLICATE: [],
  EXPIRED_QUOTE: [],
  PAYMENT_FAILED: [],
  CANCELLED: [],
  UNAUTHORIZED: [],
  INVALID_INSTRUMENT: [],
  INVALID_PAYMENT: [],
  SUPPLY_CAP_EXCEEDED: [],
  RECONCILIATION_BREAK: [],
};

/** Spec §6.6 exception taxonomy classes for terminal outcomes. */
export type ExceptionTaxonomyClass =
  | "DUPLICATE_KEY_COLLISION"
  | "CONFIRMATION_TIMEOUT"
  | "REORG_ROLLBACK"
  | "FINALITY_EVIDENCE_GAP"
  | "RECONCILE_MISMATCH"
  | "ISSUER_EVENT"
  | "PARTIAL_SETTLEMENT"
  | "REVERSAL_AFTER_ISSUANCE"
  | "REVERSAL_BEFORE_ISSUANCE"
  | "SUPPLY_CAP"
  | "AUTHORIZATION_MISSING"
  | "INSTRUMENT_INVALID"
  | "ATTESTATION_FAILURE";

// ----------------------------------------------------------------------------
// §4 — Records
// ----------------------------------------------------------------------------

export const QUOTE_POLICY_LABEL = QUOTE_POLICY.label;
export const FEE_SCHEDULE_LABEL = FEE_SCHEDULE.label;

export interface QuoteRecord {
  quoteId: string;
  instrumentCode: string;
  network: string;
  side: "ISSUANCE";
  grossInstrumentAmountMicro: bigint;
  conversionPricePerUnitMicro: bigint; // instrument unit → quote unit (SYNTHETIC-ORACLE-BOARD basis)
  grossTUMicroPreview: bigint; // step-6 preview; re-derived at NET_ACCEPTED
  quoteTUPerTokenMicro: bigint; // issuance quote: quote units per 1.0 token (§14.5)
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
  /** ALT-4 — the ONLY adopted model (ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION). */
  modelId: "ALT-4";
  programId: string;
  decision: "APPROVED";
  scopeEvidence: string;
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
  programId: string;
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
  status: "OPEN" | "RESOLVED";
  resolvedBy?: string;
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

/** Economic fields captured at event time (flat, exact 6-decimal strings) — persisted via ledger.ts. */
export interface EventEcon {
  instrument: string;
  grossAmount: string;
  feeAmount: string;
  netAmount: string;
  quote: string;
  issuedAmount: string;
  supplyAfter: string;
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
  econ: EventEcon;
}

// ----------------------------------------------------------------------------
// §6 — Machine configuration (values: parameters.ts — ALL ILLUSTRATIVE/UNAPPROVED)
// ----------------------------------------------------------------------------

export interface IssuanceMachineConfig {
  machineId: string;
  registry: PaymentInstrumentRegistry;
  supplyPolicy?: SupplyPolicy;
  quotePolicy?: QuotePolicy;
  feeSchedule?: FeeSchedule;
  clockStartMs: number;
  /**
   * CBDC SIMULATION MODE (spec §14.3/§14.4 note: test with labeled simulated
   * messages "until an actual authorized interface is available"). When
   * enabled, the machine admits the SIMULATED CBDC instrument descriptor for
   * SIMULATION-DEMO issuances ONLY. It does NOT connect anything, does NOT
   * change any registry row's NOT_CONNECTED honesty state, and is NOT an
   * integration.
   */
  cbdcSimulationMode?: { enabled: boolean; label: "SIMULATED — NOT CONNECTED" };
}

export class MachineInvariantViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MachineInvariantViolation";
  }
}

// ----------------------------------------------------------------------------
// §7 — The issuance state machine
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
  readonly label = MACHINE_LABEL;
  readonly d1327Status = D_13_27_STATUS;
  readonly authSchemeLabel = AUTH_SCHEME_LABEL;
  private readonly supplyPolicy: SupplyPolicy;
  private readonly quotePolicy: QuotePolicy;
  private readonly feeSchedule: FeeSchedule;
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
  private programRecords = new Map<string, IssuanceProgramRecord>();
  private attestation: AttestationRecord | null = null;
  pipelineSuspended = false;
  suspensionReasons: string[] = [];

  constructor(config: IssuanceMachineConfig) {
    this.config = config;
    this.clockMs = config.clockStartMs;
    this.supplyPolicy = config.supplyPolicy ?? SUPPLY_POLICY;
    this.quotePolicy = config.quotePolicy ?? QUOTE_POLICY;
    this.feeSchedule = config.feeSchedule ?? FEE_SCHEDULE;
  }

  // ---- infrastructure -----------------------------------------------------

  get nowMs(): number {
    return this.clockMs;
  }
  advanceClock(deltaMs: number): void {
    this.clockMs += deltaMs;
    this.config.registry.advanceClock(deltaMs);
  }

  private econSnapshot(requestId: string | null, issuedOverride?: bigint): EventEcon {
    const inst = requestId ? this.instances.get(requestId) : undefined;
    const issued = issuedOverride !== undefined ? issuedOverride : inst?.issuedMicro;
    return {
      instrument: inst ? `${inst.instrumentCode} @ ${inst.network}` : "",
      grossAmount: inst?.grossTUMicro !== null && inst?.grossTUMicro !== undefined ? fmt6(inst.grossTUMicro) : "",
      feeAmount: inst?.feeMicro !== null && inst?.feeMicro !== undefined ? fmt6(inst.feeMicro) : "",
      netAmount: inst?.netTUMicro !== null && inst?.netTUMicro !== undefined ? fmt6(inst.netTUMicro) : "",
      quote: inst?.quote ? fmt6(inst.quote.quoteTUPerTokenMicro) : "",
      issuedAmount: issued !== null && issued !== undefined ? fmt6(issued) : "",
      supplyAfter: fmt6(this.totalSupplyMicro),
    };
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
      econ: this.econSnapshot(requestId),
    });
  }

  /**
   * The EXPLICIT state-machine transition. Validates the transition table;
   * on ISSUED additionally enforces INV-A as a HARD machine-level guard.
   *
   * Result semantics: `ok` = the step ADVANCED THE FLOW TOWARD ISSUANCE — a
   * transition into a TERMINAL FAILURE state returns ok:false (with
   * `performed` = true so callers know the state change actually happened);
   * a table rejection returns ok:false with performed:false.
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
      if (
        !(
          inst.settlementFinal &&
          inst.authorizationRecord !== null &&
          inst.state === "SUPPLY_CHECKED" &&
          !this.pipelineSuspended
        )
      ) {
        throw new MachineInvariantViolation(
          "INV-A VIOLATION ATTEMPTED: transition to ISSUED requires BOTH settlement finality AND an applicable " +
            "unrevoked ALT-4 authorization program record (and SUPPLY_CHECKED state, and a non-suspended " +
            "pipeline). A payment event alone can NEVER reach ISSUED (spec §14.4 hard rules; §14.6 REVISION 2 " +
            "decision 1; D-13.6 exception clause).",
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
    return { ok: !isTerminal(to), reasonCode, performed: true };
  }

  // ---- ALT-4 governed acts: issuance programs + periodic attestation ------

  /**
   * THE EXPLICIT GOVERNED ACT that creates an authorization program record
   * (spec §14.6 decision 1). This is the ONLY code path that creates
   * programs. Payment events, settlement messages, quotes, and replays can
   * NEVER create or alter a program record. The "signature" on the record is
   * a SYNTHETIC TEST-ONLY tag in this pilot (no governance signer exists).
   */
  defineIssuanceProgram(input: {
    programId: string;
    instruments: { code: string; network: string }[];
    perProgramCapMicro: bigint;
    perTxCapMicro: bigint;
    windowStartMs: number;
    windowEndMs: number;
    rules?: string[];
    signedBy?: string;
  }): { ok: boolean; reasonCode: string; program?: IssuanceProgramRecord } {
    if (this.programRecords.has(input.programId)) {
      return { ok: false, reasonCode: "PROGRAM_ID_ALREADY_EXISTS" };
    }
    if (input.windowEndMs < input.windowStartMs) {
      return { ok: false, reasonCode: "INVALID_PROGRAM_WINDOW" };
    }
    if (input.perProgramCapMicro <= 0n || input.perTxCapMicro <= 0n || input.instruments.length === 0) {
      return { ok: false, reasonCode: "INVALID_PROGRAM_PARAMETERS" };
    }
    const canonical = [
      input.programId,
      input.instruments.map((i) => `${i.code}@${i.network}`).join(","),
      input.perProgramCapMicro.toString(10),
      input.perTxCapMicro.toString(10),
      input.windowStartMs.toString(10),
      input.windowEndMs.toString(10),
    ].join("|");
    const record: IssuanceProgramRecord = {
      programId: input.programId,
      instruments: input.instruments.map((i) => ({ ...i })),
      perProgramCapMicro: input.perProgramCapMicro,
      issuedInProgramMicro: 0n,
      perTxCapMicro: input.perTxCapMicro,
      windowStartMs: input.windowStartMs,
      windowEndMs: input.windowEndMs,
      rules:
        input.rules ??
        [
          "Rule-bound programmatic issuance ONLY inside this program envelope (ALT-4; D-13.6 exception clause).",
          "Finality-before-issuance (adopted decision 2): issuance only after settlement finality on the funding rail.",
          "Quote per §14.5 FORM with validity window; quote-derivation policy publication remains OPEN.",
          "Fees per D-13.8 FORM — value ILLUSTRATIVE, UNAPPROVED.",
          "Every ISSUED transition still requires this unrevoked record (INV-A unconditional).",
        ],
      revoked: false,
      revocationReason: null,
      signedBy:
        input.signedBy ??
        "TEST-GOVERNANCE (SYNTHETIC — NO GOVERNANCE SIGNER EXISTS IN THIS PILOT)",
      signatureTag: syntheticSignatureTag(canonical),
      signedAtMs: this.clockMs,
      version: 1,
      label:
        `ALT-4 ISSUANCE PROGRAM RECORD (TEST-ONLY in this pilot — synthetic signature; production requires a ` +
        `governance-approved signed record). ${ALT4_ADOPTION_LABEL}`,
    };
    this.programRecords.set(record.programId, record);
    this.log(
      "PROGRAM-" + record.programId,
      null,
      null,
      "PROGRAM_DEFINED",
      `ALT-4 explicit governed act: program ${record.programId} defined (instruments ${record.instruments
        .map((i) => `${i.code}@${i.network}`)
        .join(", ")}; per-tx cap ${fmt6(record.perTxCapMicro)}; program cap ${fmt6(record.perProgramCapMicro)}; ` +
        `window ${record.windowStartMs}..${record.windowEndMs}ms; signed by ${record.signedBy} — a GOVERNED act, ` +
        "never a payment event)",
    );
    return { ok: true, reasonCode: "PROGRAM_DEFINED", program: { ...record } };
  }

  /** The explicit governed act that revokes a program — a revoked program authorizes nothing. */
  revokeIssuanceProgram(programId: string, reason: string): { ok: boolean; reasonCode: string } {
    const record = this.programRecords.get(programId);
    if (!record) return { ok: false, reasonCode: "PROGRAM_NOT_FOUND" };
    record.revoked = true;
    record.revocationReason = reason;
    record.version += 1;
    this.log(
      `PROGRAM-${programId}`,
      null,
      null,
      "PROGRAM_REVOKED",
      `ALT-4 explicit governed act: program ${programId} REVOKED (${reason}); anything outside an unrevoked ` +
        "envelope remains unauthorized (D-13.6 exception clause)",
    );
    return { ok: true, reasonCode: "PROGRAM_REVOKED" };
  }

  programs(): readonly IssuanceProgramRecord[] {
    return [...this.programRecords.values()].map((p) => ({ ...p, instruments: p.instruments.map((i) => ({ ...i })) }));
  }

  /**
   * Record a periodic attestation (the ALT-4 operational duty). The record is
   * produced by an Attester — in this pilot the clearly-labeled STUB
   * (authorization.ts StubAttester); production requires a governance-
   * appointed independent attester.
   */
  recordAttestation(record: AttestationRecord): { ok: boolean; reasonCode: string } {
    this.attestation = { ...record };
    this.log(
      "ATTESTATION",
      null,
      null,
      record.matched ? "ATTESTATION_RECORDED_MATCHED" : "ATTESTATION_RECORDED_MISMATCH",
      `periodic attestation ${record.attestationId} recorded by ${record.attester}: matched=${record.matched} ` +
        `(period ${record.periodMs}ms, attested at ${record.attestedAtMs}ms) — attestation failures suspend the ` +
        "pipeline fail-closed (ALT-4; spec §14.6 decision 1)",
      record.matched ? null : "ATTESTATION_FAILURE",
    );
    return { ok: true, reasonCode: "ATTESTATION_RECORDED" };
  }

  currentAttestation(): AttestationRecord | null {
    return this.attestation ? { ...this.attestation } : null;
  }

  attestationStatus(): AttestationStatus {
    return checkAttestationStatus(this.attestation, this.clockMs);
  }

  /** Fail-closed suspension on attestation failure (adopted decision 1 + fail-closed recovery). */
  private suspendForAttestation(status: AttestationStatus): void {
    this.pipelineSuspended = true;
    this.suspensionReasons.push(`ATTESTATION_${status.kind}`);
    this.exceptions.push({
      exceptionId: `EXC-ATTESTATION-${this.seq + 1}`,
      requestId: null,
      taxonomyClass: "ATTESTATION_FAILURE",
      reasonCode: status.reasonCode,
      openedAtMs: this.clockMs,
      status: "OPEN",
      notes: `attestation ${status.kind} — pipeline suspended fail-closed: ${status.detail}`,
    });
    this.log(
      "ATTESTATION",
      null,
      null,
      "PIPELINE_SUSPENDED_ATTESTATION",
      `attestation ${status.kind} — pipeline SUSPENDED fail-closed pending a fresh matching attestation + an ` +
        "explicit authorized resumption act (no silent healing)",
      "ATTESTATION_FAILURE",
    );
  }

  /**
   * EXPLICIT AUTHORIZED RESUMPTION after an attestation suspension (fail-closed
   * recovery — no silent healing). Requires BOTH a fresh matching attestation
   * AND an explicit operator act. Clears ONLY attestation suspension reasons;
   * reconciliation breaks and post-issuance reversals stay suspended until
   * their own authorized remediation path runs. TEST-ONLY harness in this
   * pilot — no real operator exists.
   */
  resumeAfterAttestationSuspension(
    freshAttestation: AttestationRecord,
    operatorId: string,
  ): { ok: boolean; reasonCode: string } {
    if (!this.pipelineSuspended) return { ok: false, reasonCode: "PIPELINE_NOT_SUSPENDED" };
    const status = checkAttestationStatus(freshAttestation, this.clockMs);
    if (!status.ok || !freshAttestation.matched) {
      return { ok: false, reasonCode: `RESUMPTION_BLOCKED_${status.kind}` };
    }
    const hasNonAttestationReasons = this.suspensionReasons.some((r) => !r.startsWith("ATTESTATION_"));
    this.attestation = { ...freshAttestation };
    this.suspensionReasons = this.suspensionReasons.filter((r) => !r.startsWith("ATTESTATION_"));
    const attestationExceptions = this.exceptions.filter(
      (e) => e.taxonomyClass === "ATTESTATION_FAILURE" && e.status === "OPEN",
    );
    for (const e of attestationExceptions) {
      e.status = "RESOLVED";
      e.resolvedBy = operatorId;
    }
    if (this.suspensionReasons.length === 0) {
      this.pipelineSuspended = false;
    }
    this.log(
      "ATTESTATION",
      null,
      null,
      hasNonAttestationReasons ? "RESUMPTION_PARTIAL" : "PIPELINE_RESUMED",
      `explicit authorized act by ${operatorId} (TEST-ONLY in this pilot — no real operator exists): fresh ` +
        `matching attestation ${freshAttestation.attestationId} accepted; attestation suspension cleared` +
        (hasNonAttestationReasons
          ? `; pipeline REMAINS SUSPENDED for non-attestation reasons (${this.suspensionReasons.join(", ")})`
          : "; pipeline resumed"),
    );
    return { ok: true, reasonCode: hasNonAttestationReasons ? "RESUMED_PARTIAL" : "RESUMED" };
  }

  /**
   * FAIL-CLOSED AUTHORIZED REMEDIATION for a reconciliation break / post-
   * issuance reversal (adopted decisions 3+4): resolution requires an
   * EXPLICIT authorized reconciliation decision with the three-book C1–C4
   * match re-verified at resolution time. NO automatic re-mint, re-burn, or
   * adjustment — the mint record stays on the books; only the exception is
   * closed and the suspension lifted. TEST-ONLY harness in this pilot.
   */
  resolveReconciliationBreak(operatorId: string, remediationNote: string): { ok: boolean; reasonCode: string; checks?: ReconciliationCheckResult[] } {
    if (!this.pipelineSuspended) return { ok: false, reasonCode: "PIPELINE_NOT_SUSPENDED" };
    const result = reconcileThreeBooks(this.ledgerSnapshot());
    if (!result.balanced) {
      this.log(
        "RECONCILIATION",
        null,
        null,
        "REMEDIATION_BLOCKED_BOOKS_STILL_DIVERGED",
        `authorized remediation by ${operatorId} REFUSED: three-book C1–C4 re-check FAILED — ` +
          result.checks.filter((c) => !c.passed).map((c) => `${c.check} (${c.detail})`).join("; "),
        "RECONCILE_MISMATCH",
      );
      return { ok: false, reasonCode: "REMEDIATION_BLOCKED_BOOKS_STILL_DIVERGED", checks: result.checks };
    }
    this.suspensionReasons = this.suspensionReasons.filter(
      (r) => !r.startsWith("RECONCILIATION_BREAK:") && !r.startsWith("REVERSAL_AFTER_ISSUANCE:"),
    );
    const openRecon = this.exceptions.filter(
      (e) =>
        (e.taxonomyClass === "RECONCILE_MISMATCH" || e.taxonomyClass === "REVERSAL_AFTER_ISSUANCE") &&
        e.status === "OPEN",
    );
    for (const e of openRecon) {
      e.status = "RESOLVED";
      e.resolvedBy = operatorId;
    }
    if (this.suspensionReasons.length === 0) {
      this.pipelineSuspended = false;
    }
    this.log(
      "RECONCILIATION",
      null,
      null,
      this.pipelineSuspended ? "REMEDIATION_PARTIAL" : "PIPELINE_RESUMED",
      `explicit authorized reconciliation decision by ${operatorId} (TEST-ONLY in this pilot): C1–C4 all PASS; ` +
        `exception(s) closed (${openRecon.length}); mint records PRESERVED — no re-mint, no re-burn, no ` +
        `adjustment (${remediationNote})`,
    );
    return { ok: true, reasonCode: this.pipelineSuspended ? "REMEDIATED_PARTIAL" : "REMEDIATED", checks: result.checks };
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

    // REPLAY at the request-id level: the same requestId can never execute twice (spec §6.4).
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
      // fail-closed (adopted decision 4): no new requests while the pipeline is suspended
      this.log(
        input.requestId,
        null,
        null,
        "SUBMISSION_REJECTED_PIPELINE_SUSPENDED",
        "issuance pipeline is SUSPENDED (reconciliation exception / attestation failure / forced break); new " +
          "requests are rejected fail-closed (adopted decision 4 — no partial states, no silent healing)",
        "RECONCILE_MISMATCH",
      );
      return { ok: false, created: false, replayDetected: false, state: "REQUEST_CREATED", reasonCode: "PIPELINE_SUSPENDED_FAIL_CLOSED" };
    }

    // IDEMPOTENCY-KEY registry: a second submission under an existing key NEVER executes twice (spec §6.4).
    const prior = this.idempotencyRegistry.get(input.idempotencyKey);
    if (prior) {
      const samePayload = prior.canonicalPayload === canonical;
      const inst: IssuanceInstance = this.newInstance(input);
      const reason = samePayload
        ? "DUPLICATE_IDEMPOTENCY_KEY — returns the original result; never a second execution (spec §6.4)"
        : "DUPLICATE_KEY_COLLISION — same idempotency key with a DIFFERENT payload: second submission rejected + " +
          "alert raised, never executed twice (spec §6.6)";
      const tr = this.transition(inst, "DUPLICATE", reason, `duplicate of request ${prior.requestId}`, "DUPLICATE_KEY_COLLISION");
      if (!tr.performed) return { ok: false, created: false, replayDetected: false, state: inst.state, reasonCode: tr.reasonCode };
      return {
        ok: false,
        created: true,
        replayDetected: false,
        state: "DUPLICATE",
        reasonCode: reason,
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
      "§14.4 steps 1+3 / §14.6 stage 1: instrument selection recorded (per-instance identity: code+network, " +
        `never a ticker alone) + EXPLICIT user issuance request created (idempotency key ${input.idempotencyKey}, ` +
        "spec §6.4) — a request record must exist BEFORE any payment is evaluated; no spontaneous mint",
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
      simulationLabels: ["TEST LEDGER ONLY", "LEDGER RECORDS ONLY — NEVER ON-CHAIN"],
    };
  }

  private requireInstance(requestId: string): IssuanceInstance | null {
    return this.instances.get(requestId) ?? null;
  }

  // ---- §14.4 step 2 — quote generation (spec §6.1; §14.5 FORM; validity window) ----

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
        "quote refused: instrument (code+network) not found in the registry — per-instance lookup, never a ticker " +
          "alone (spec §14.2 rule (a)); the production registry is BORN EMPTY and admission is fail-closed",
        "INSTRUMENT_INVALID",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }

    // Honesty-state gate FIRST (spec §5.3): NOT_CONNECTED rows quote only in labeled SIMULATION MODE.
    const simEnabled = this.config.cbdcSimulationMode?.enabled ?? false;
    if (row.honestyState === "NOT_CONNECTED") {
      if (!simEnabled) {
        const t = this.transition(
          inst,
          "INVALID_INSTRUMENT",
          "CBDC_NOT_CONNECTED_NO_QUOTES",
          "quote refused: CBDC row is SIMULATED / NOT CONNECTED — spec §6.2: absent interface ⇒ NO quotes at " +
            "all; spec §4: admission requires a verified authorized interface + recorded end-to-end test " +
            "(NEITHER EXISTS)",
          "INSTRUMENT_INVALID",
        );
        return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
      }
      // SIMULATION-MODE quote admission (labeled): tests with labeled simulated messages "until an actual
      // authorized interface is available" — NOT an integration; the registry row stays NOT_CONNECTED.
      inst.simulationLabels.push("SIMULATION-MODE QUOTE (SIMULATED — NOT CONNECTED)");
    } else if (row.state === "RETIRED") {
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        "INSTRUMENT_RETIRED",
        "quote refused: instrument RETIRED (spec §5 — records preserved append-only)",
        "INSTRUMENT_INVALID",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    } else if (row.state === "SUSPENDED" || row.state === "CANDIDATE") {
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        row.state === "SUSPENDED"
          ? "INSTRUMENT_SUSPENDED_NO_QUOTES"
          : "INSTRUMENT_NOT_ADMITTED_PER_INSTANCE_IDENTITY",
        row.state === "SUSPENDED"
          ? "quote refused: instrument SUSPENDED (spec §4/§5); new quotes blocked while in-flight settlements complete under existing quotes"
          : "quote refused: CANDIDATE row not admitted (fail-closed admission; per-instance identity, spec §14.2 rule (a))",
        "INSTRUMENT_INVALID",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    if (inst.requestedInstrumentAmountMicro <= 0n) {
      const t = this.transition(inst, "INVALID_INSTRUMENT", "NON_POSITIVE_AMOUNT", "quote refused: amount must be positive", "INSTRUMENT_INVALID");
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }

    const grossTU = divRoundHalfEven(inst.requestedInstrumentAmountMicro * row.valuationBasis.pricePerUnitMicro, MICRO);
    const quote: QuoteRecord = {
      quoteId: `QUOTE-${requestId}`,
      instrumentCode: inst.instrumentCode,
      network: inst.network,
      side: "ISSUANCE",
      grossInstrumentAmountMicro: inst.requestedInstrumentAmountMicro,
      conversionPricePerUnitMicro: row.valuationBasis.pricePerUnitMicro,
      grossTUMicroPreview: grossTU,
      quoteTUPerTokenMicro: this.quotePolicy.quoteTUPerTokenMicro,
      feeClass: this.feeSchedule.feeClass,
      feeRateBps: this.feeSchedule.rateBps,
      spreadDisclosureBps: 0n,
      roundingRule: ROUNDING_RULE,
      createdAtMs: this.clockMs,
      expiresAtMs: this.clockMs + this.quotePolicy.quoteTtlMs,
      syntheticQuoteTag: computeSyntheticAuthTag(
        TEST_ONLY_AUTH_KEY_LITERAL,
        `QUOTE|${requestId}|${inst.requestedInstrumentAmountMicro.toString(10)}|${grossTU.toString(10)}|${this.quotePolicy.quoteTUPerTokenMicro.toString(10)}`,
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
        `TU/token (§14.5 FORM — ILLUSTRATIVE); fee class ${quote.feeClass} @ ${quote.feeRateBps.toString(10)}bps ` +
        `(ILLUSTRATIVE — D-13.8 OPEN); spread ${quote.spreadDisclosureBps.toString(10)}bps disclosed; validity ` +
        `window expires at ${quote.expiresAtMs}ms (TTL ${this.quotePolicy.quoteTtlMs}ms — ILLUSTRATIVE); ` +
        `${AUTH_SCHEME_LABEL}`,
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
    // Duplicate payment txId across the WHOLE machine: never accept the same payment twice (spec §6.4).
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

  // ---- §14.4 step 4b — settlement finality per rail (spec §6.2; adopted decision 2) ----

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

    // QUOTE-EXPIRY gate FIRST — FINALITY-BEFORE-ISSUANCE (adopted decision 2):
    // no issuance at a stale quote; a payment whose finality arrives after the
    // quote validity window expires → EXPIRED_QUOTE + held-or-refunded (§6.3).
    if (this.clockMs > quote.expiresAtMs) {
      const t = this.transition(
        inst,
        "EXPIRED_QUOTE",
        "QUOTE_EXPIRED_BEFORE_FINALITY",
        `settlement finality arrived after quote expiry (${this.clockMs}ms > ${quote.expiresAtMs}ms) — no issuance ` +
          "at a stale quote (finality-before-issuance, adopted decision 2; spec §6.1 hard-reject). Payment is " +
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
      sourceLabel: msg.sourceLabel ?? "SYNTHETIC STABLECOIN RAIL (deterministic simulated settlement record — NO REAL RAIL EXISTS)",
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
        `depeg band at settlement: ${depegBand} — FINALITY-BEFORE-ISSUANCE (adopted decision 2)`,
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
      inst.inFlightDisclosure = "SIMULATION-MODE ADMISSION (SIMULATED — NOT CONNECTED): registry row stays NOT_CONNECTED; NOT an integration";
      const t = this.transition(
        inst,
        "INSTRUMENT_CHECKED",
        "INSTRUMENT_CHECK_PASSED_SIMULATION_MODE",
        `SIMULATION-MODE admission for the simulated CBDC descriptor (${row.code} @ ${row.network}); registry row ` +
          `remains ${row.state}/${row.honestyState} — NOT admitted, NOT connected; jurisdiction ${inst.jurisdiction} OK in simulation`,
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    if (row.state === "RETIRED") {
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        "INSTRUMENT_RETIRED_AT_SETTLEMENT_TIME",
        "re-check at settlement time: instrument RETIRED since the quote — rejected (step 5 checks are settlement-time, not just quote-time)",
        "INSTRUMENT_INVALID",
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode };
    }
    if (row.state === "SUSPENDED") {
      // spec §4 in-flight rule: in-flight settlements COMPLETE under existing quotes.
      if (quote.createdAtMs < (row.suspendedAtMs ?? Infinity)) {
        inst.inFlightDisclosure = "IN_FLIGHT_COMPLETION (spec §4: instrument suspended while this settlement was in flight; existing quotes complete)";
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
    if (row.state === "CANDIDATE") {
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        "INSTRUMENT_NOT_ADMITTED_PER_INSTANCE_IDENTITY",
        "re-check at settlement time: per-instance identity (spec §14.2 rule (a)) — this network instance is NOT admitted",
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
      // Fail-closed interpretation (labeled): spec §4 routes EMERGENCY to suspension + escalation;
      // the machine fails closed for the in-flight payment too (adopted decision 4).
      const t = this.transition(
        inst,
        "INVALID_INSTRUMENT",
        "DEPEG_EMERGENCY_FAIL_CLOSED",
        `depeg band EMERGENCY at settlement time (deviation ${obs.deviationBps}bps sustained ${obs.sustainedHours}h) — ` +
          "FAIL-CLOSED: rejected (spec §4 'suspension + escalation'; adopted decision 4)",
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

  // ---- §14.4 step 7 — fee calculation (D-13.8 value OPEN — ILLUSTRATIVE) ----

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

  // ---- §14.4 step 9 — ALT-4 authorization (spec §14.6 decision 1) ----

  /**
   * Authorization under the ADOPTED ALT-4 model. The attestation status is
   * checked FIRST (fail-closed: an attestation failure suspends the pipeline),
   * then the program envelope (rule-bound programmatic checking happens ONLY
   * inside the envelope). A payment event ALONE can never create a program,
   * an attestation, or an authorization record — INV-A, unconditional.
   */
  authorize(requestId: string): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state !== "NET_ACCEPTED") {
      this.log(requestId, inst.state, null, "STEP_REJECTED", `authorize requires NET_ACCEPTED (got ${inst.state})`);
      return { ok: false, state: inst.state, reasonCode: `STEP_REJECTED_STATE_${inst.state}` };
    }
    const quote = inst.quote;
    if (!quote || inst.netTUMicro === null) return { ok: false, state: inst.state, reasonCode: "INTERNAL_RECORDS_MISSING" };

    // (1) PERIODIC ATTESTATION — failures suspend the pipeline fail-closed.
    const attStatus = this.attestationStatus();
    if (!attStatus.ok) {
      this.suspendForAttestation(attStatus);
      const t = this.transition(
        inst,
        "UNAUTHORIZED",
        attStatus.reasonCode,
        `ALT-4 periodic attestation gate FAILED (${attStatus.kind}): ${attStatus.detail}. Pipeline SUSPENDED ` +
          "fail-closed pending a fresh matching attestation + an explicit authorized resumption act (no silent healing).",
        "ATTESTATION_FAILURE",
      );
      return { ok: t.ok, state: inst.state, reasonCode: attStatus.reasonCode };
    }

    // (2) PROGRAM ENVELOPE — rule-bound programmatic checking ONLY inside the envelope.
    const prospective = divRoundHalfEven(inst.netTUMicro * MICRO, quote.quoteTUPerTokenMicro);
    inst.prospectiveIssuedMicro = prospective;
    const decision: AuthorizationDecision = checkProgramAuthorization(this.programs(), {
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
        `no authorization under the ADOPTED ALT-4 model: ${decision.reasonCode}. The invariant is unconditional: ` +
          "a payment event alone NEVER mints; anything outside the exact envelope of a recorded, unrevoked " +
          "authorization program remains unauthorized (D-13.6 exception clause).",
        "AUTHORIZATION_MISSING",
      );
      return { ok: t.ok, state: inst.state, reasonCode: decision.reasonCode };
    }
    // Program bookkeeping of the governed envelope (per-program cap consumption).
    const program = this.programRecords.get(decision.programId ?? "");
    if (program) {
      program.issuedInProgramMicro += prospective;
      program.version += 1;
    }
    const auth: AuthorizationRecord = {
      authorizationId: `AUTH-${requestId}`,
      requestId,
      modelId: "ALT-4",
      programId: decision.programId ?? "n/a",
      decision: "APPROVED",
      scopeEvidence: decision.scopeEvidence,
      decidedAtMs: this.clockMs,
      evidenceRefs: [decision.reasonCode, ALT4_ADOPTION_LABEL],
      label: `ALT-4 authorization record under program ${decision.programId} (${ALT4_ADOPTION_LABEL})`,
    };
    inst.authorizationRecord = auth;
    const t = this.transition(
      inst,
      "AUTHORIZED",
      "ISSUANCE_AUTHORIZED",
      `explicit ALT-4 authorization record ${auth.authorizationId} created under program ${auth.programId} ` +
        `(scope: ${decision.scopeEvidence}); attestation ${attStatus.kind}=${attStatus.detail}. This record is an ` +
        "EXPLICIT governed act, never a payment event — INV-A unconditional.",
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
    const sp = this.supplyPolicy;
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

  // ---- §14.4 step 10 — token issuance (idempotent LEDGER RECORD ONLY — NEVER ON-CHAIN) ----

  issue(requestId: string): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    // 1:1:1:1 idempotency: a re-issue on the SAME request returns the ORIGINAL mint
    // record — never a second mint (spec §6.4; adopted decision 5).
    const mintId = `MINT-${requestId}`;
    const existing = this.mintRecords.get(mintId);
    if (existing) {
      this.log(
        requestId,
        inst.state,
        null,
        "IDEMPOTENT_REISSUE_RETURNED_ORIGINAL",
        `mint ${mintId} already exists — returning the ORIGINAL mint record; no second mint (spec §6.4; 1:1:1:1)`,
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
        "INV-A VIOLATION ATTEMPTED (issue): settlement finality + an applicable unrevoked ALT-4 authorization " +
          "program record + non-suspended pipeline are ALL required before issuance. A payment event alone can " +
          "NEVER mint (spec §14.4; §14.6 REVISION 2 decision 1).",
      );
    }
    if (inst.prospectiveIssuedMicro === null || inst.netTUMicro === null || inst.feeMicro === null || inst.grossTUMicro === null) {
      return { ok: false, state: inst.state, reasonCode: "INTERNAL_RECORDS_MISSING" };
    }
    this.mintNonceCounter += 1;
    const amount = inst.prospectiveIssuedMicro; // exact: issued = net ÷ quote (§14.5 general form)
    const record: MintRecord = {
      mintId,
      nonce: this.mintNonceCounter,
      idempotencyKey: inst.idempotencyKey,
      requestId,
      quoteId: inst.quote?.quoteId ?? "n/a",
      recipientId: inst.recipientId,
      amountMicro: amount,
      issuedAtMs: this.clockMs,
      recordOnlyLabel:
        "LEDGER RECORD ONLY — NEVER ON-CHAIN (TEST LEDGER; no token contract is involved, no chain action occurs)",
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
      programId: inst.authorizationRecord?.programId ?? "n/a",
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
      `mint record ${mintId} (nonce ${record.nonce}, idempotency key ${inst.idempotencyKey}): ${fmt6(amount)} tokens ` +
        `to ${inst.recipientId} = net ${fmt6(inst.netTUMicro)} TU ÷ quote ${fmt6(inst.quote?.quoteTUPerTokenMicro ?? 0n)} ` +
        `(§14.5 general form — quote policy ILLUSTRATIVE). ${record.recordOnlyLabel}`,
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
        programId: inst.authorizationRecord?.programId ?? "n/a",
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
        `three-book equality (payment ledger vs issuance ledger vs supply counter + fee ledger): ${result.checks
          .map((c) => `${c.check}=PASS`)
          .join("; ")} (spec §6.5 — C1–C4)`,
      );
      return { ok: t.ok, state: inst.state, reasonCode: t.reasonCode, observed: result.bookTotals };
    }
    const failed = result.checks.filter((c) => !c.passed).map((c) => `${c.check} (${c.detail})`).join("; ");
    const t = this.transition(
      inst,
      "RECONCILIATION_BREAK",
      "THREE_BOOK_DIVERGENCE",
      `three-book reconciliation FAILED: ${failed}. Fail-closed: pipeline SUSPENDED; exception queued; NO silent ` +
        "re-mint; NO silent write-off; resolution ONLY via the explicit authorized reconciliation decision " +
        "(adopted decisions 3+4)",
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

  // ---- reversal handling (spec §6.3; ADOPTED decision 3) ----

  handleReversalNotice(requestId: string, sourceLabel = "settlement rail"): StepResult {
    const inst = this.requireInstance(requestId);
    if (!inst) return { ok: false, state: "REQUEST_CREATED", reasonCode: "REQUEST_NOT_FOUND" };
    if (inst.state === "ISSUED" || inst.state === "RECONCILED") {
      // Post-issuance reversal → RECONCILIATION_BREAK + pipeline SUSPENDED + fail-closed
      // authorized remediation; mint record PRESERVED (no silent write-off, no re-mint).
      const t = this.transition(
        inst,
        "RECONCILIATION_BREAK",
        "REVERSAL_AFTER_ISSUANCE",
        `payment reversal arrived AFTER issuance (${sourceLabel}). ADOPTED decision 3: RECONCILIATION_BREAK + ` +
          "pipeline SUSPENDED + fail-closed authorized remediation — the books disagree; resolution requires an " +
          "explicit authorized reconciliation decision (three-book C1–C4 match verified); NO automatic re-mint, " +
          "re-burn, or adjustment; the mint record is PRESERVED.",
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
            "no re-mint; pipeline suspended pending the authorized reconciliation decision (adopted decision 3)",
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
    // Pre-issuance reversal → CANCELLED (terminal; no mint; refund queued with the same idempotency key).
    const t = this.transition(
      inst,
      "CANCELLED",
      "REVERSAL_BEFORE_ISSUANCE",
      `payment reversal arrived BEFORE issuance (${sourceLabel}) — ADOPTED decision 3: the request CANCELS; NO ` +
        "mint occurs; auto-refund queued with the same idempotency key (spec §6.3)",
      "REVERSAL_BEFORE_ISSUANCE",
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

  // ---- refunds (spec §6.3 refund state machine; adopted decision 4) ----

  /** PENDING_REFUND → REFUNDED (deterministic in-process completion; recovery is fail-closed — no retry on the same key). */
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
            "same-key refund per spec §6.3; no fee retained on the failed transaction; retry forbidden on the same key",
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

  // ---- snapshots (read-only views for the API + tests) ----

  allRequestIds(): readonly string[] {
    return [...this.instances.keys()];
  }

  getInstanceState(requestId: string): {
    state: IssuanceState;
    terminalReasonCode: string | null;
    terminalTaxonomyClass: ExceptionTaxonomyClass | null;
    settlementFinal: boolean;
    hasAuthorizationRecord: boolean;
    authorizationProgramId: string | null;
    hasMintRecord: boolean;
    instrument: string;
    issuedMicro: string | null;
    netTUMicro: string | null;
    feeMicro: string | null;
    grossTUMicro: string | null;
    prospectiveIssuedMicro: string | null;
    inFlightDisclosure: string | null;
    simulationLabels: string[];
    quoteExpiresAtMs: number | null;
  } | null {
    const inst = this.requireInstance(requestId);
    if (!inst) return null;
    return {
      state: inst.state,
      terminalReasonCode: inst.terminalReasonCode,
      terminalTaxonomyClass: inst.terminalTaxonomyClass,
      settlementFinal: inst.settlementFinal,
      hasAuthorizationRecord: inst.authorizationRecord !== null,
      authorizationProgramId: inst.authorizationRecord?.programId ?? null,
      hasMintRecord: this.mintRecords.has(`MINT-${requestId}`),
      instrument: `${inst.instrumentCode} @ ${inst.network}`,
      issuedMicro: inst.issuedMicro !== null ? fmt6(inst.issuedMicro) : null,
      netTUMicro: inst.netTUMicro !== null ? fmt6(inst.netTUMicro) : null,
      feeMicro: inst.feeMicro !== null ? fmt6(inst.feeMicro) : null,
      grossTUMicro: inst.grossTUMicro !== null ? fmt6(inst.grossTUMicro) : null,
      prospectiveIssuedMicro: inst.prospectiveIssuedMicro !== null ? fmt6(inst.prospectiveIssuedMicro) : null,
      inFlightDisclosure: inst.inFlightDisclosure,
      simulationLabels: [...inst.simulationLabels],
      quoteExpiresAtMs: inst.quote?.expiresAtMs ?? null,
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
    const sp = this.supplyPolicy;
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
   * TEST-ONLY bypass-attempt harness (mirrors the finality-before-mint §84
   * bypass-route vocabulary): attempts to force the internal transition to
   * ISSUED SKIPPING the transition table, so the tests can prove the
   * machine-level ISSUED invariant (INV-A) throws regardless. Must ALWAYS
   * report blocked for any instance lacking settlement finality + an
   * applicable authorization record.
   */
  __testAttemptDirectIssueBypass(requestId: string): { threw: boolean; message: string } {
    const inst = this.requireInstance(requestId);
    if (!inst) return { threw: true, message: "REQUEST_NOT_FOUND (trivially blocked)" };
    try {
      if (
        !(inst.settlementFinal && inst.authorizationRecord !== null && inst.state === "SUPPLY_CHECKED" && !this.pipelineSuspended)
      ) {
        throw new MachineInvariantViolation(
          "INV-A: bypass attempt blocked — no settlement finality + unrevoked ALT-4 authorization record pair ⇒ ISSUED unreachable",
        );
      }
      // A fully-authorized instance is legitimately issuable — the harness reports no violation found.
      return { threw: false, message: "instance is legitimately issuable (guards satisfied) — nothing to block" };
    } catch (e) {
      return { threw: true, message: e instanceof Error ? e.message : String(e) };
    }
  }

  /**
   * TEST-ONLY forced ledger break: corrupts ONE internal book entry to prove
   * reconciliation is a REAL check, not a no-op. Labeled TEST-ONLY.
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
      // INV-A — issuance requires settlement finality AND an applicable unrevoked ALT-4 authorization record.
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
        [
          "PAYMENT_FAILED",
          "EXPIRED_QUOTE",
          "UNAUTHORIZED",
          "INVALID_PAYMENT",
          "DUPLICATE",
          "SUPPLY_CAP_EXCEEDED",
          "CANCELLED",
          "INVALID_INSTRUMENT",
        ].includes(inst.state) &&
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
      throw new MachineInvariantViolation("INV-C broken: idempotency-key→mint registry size mismatch (1:1:1:1 violated)");
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
    // INV-D — every suspension carries recorded reasons + an OPEN exception (until
    // explicitly resolved); mint records are never silently written off.
    if (this.pipelineSuspended && this.suspensionReasons.length === 0) {
      throw new MachineInvariantViolation("INV-D broken: pipeline suspended without a recorded reason");
    }
    if (this.pipelineSuspended && !this.exceptions.some((e) => e.status === "OPEN")) {
      throw new MachineInvariantViolation("INV-D broken: pipeline suspended without an OPEN exception");
    }
    // INV-E — honesty sweep: every mint record carries the LEDGER-RECORD-ONLY label;
    // every authorization record carries the ALT-4 adopted-model label; every fee/quote
    // surface carries the UNAPPROVED/ILLUSTRATIVE labels.
    for (const m of this.mintRecords.values()) {
      if (!m.recordOnlyLabel.includes("NEVER ON-CHAIN")) {
        throw new MachineInvariantViolation(`INV-E broken: mint ${m.mintId} missing the LEDGER-RECORD-ONLY label`);
      }
    }
    for (const inst of this.instances.values()) {
      if (inst.authorizationRecord && (inst.authorizationRecord.modelId !== "ALT-4" || !inst.authorizationRecord.label.includes("PENDING OWNER RATIFICATION"))) {
        throw new MachineInvariantViolation(`INV-E broken: authorization ${inst.authorizationRecord.authorizationId} missing the ALT-4 adopted-model label`);
      }
    }
    if (!FEE_SCHEDULE.label.includes("UNAPPROVED") || !QUOTE_POLICY.label.includes("ILLUSTRATIVE")) {
      throw new MachineInvariantViolation("INV-E broken: fee/quote honesty labels missing (parameters.ts)");
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

  // C1 — supply counter vs token book (the §6.5 token-ledger analog)
  checks.push({
    check: "C1_TOKEN_BOOK_EQUALS_TOTAL_SUPPLY",
    passed: tokenSum === snap.totalSupplyMicro,
    detail: `token book Σ ${fmt6(tokenSum)} vs total supply ${fmt6(snap.totalSupplyMicro)}`,
  });
  // C2 — issuance ledger vs token book 1:1 linkage (the §6.5 acquirer-ledger analog)
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
      valueBreaks.push(`${i.requestId}: payment ledger ≠ issuance ledger`);
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
      paymentLedgerSettledCount: snap.paymentBookEntries.filter((p) => p.status === "SETTLED").length.toString(10),
      issuanceRecordCount: snap.issuanceRecords.length.toString(10),
      tokenBookSum: fmt6(tokenSum),
      totalSupply: fmt6(snap.totalSupplyMicro),
      feeLedgerTotal: fmt6(snap.feeBookTotalMicro),
    },
  };
}
