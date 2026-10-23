// ============================================================================
// MTQΣ — MANDATE-007 §4 · Task 2-b · STEP 3 — CBDC ADAPTER INTERFACE
// (SIMULATED / NOT CONNECTED — spec §14.3 / MANDATE-006 §7.4)
// ============================================================================
// MODULE LABEL: **SIMULATED / NOT CONNECTED.** This file specifies the CBDC
// adapter interface required by `payment-instrument-registry-and-settlement-spec.md`
// §14.3 (nine MANDATE-006 §7.4 concern areas) and provides ONE clearly-labeled
// SIMULATED implementation so the issuance state machine can be exercised with
// simulated messages "until an actual authorized interface is available"
// (MANDATE-007 §4, verbatim instruction).
//
// INTEGRATION LIMITATIONS — STATED HONESTLY (all VERIFIED-by-absence):
//   • NO issuing authority exists or is engaged for any CBDC;
//   • NO authorized technical interface exists (no endpoint, no message
//     standard, no access grant, no test environment);
//   • NO institutional connection exists (no participating-institution
//     permissioning, no accounts);
//   • therefore NO end-to-end integration test against a real interface is
//     POSSIBLE — the real-adapter gate (spec §14.3: the nine-§7.4-field
//     adapter contract is a REQUIRED ANNEX of any CBDC admission dossier)
//     CANNOT be met: that annex DOES NOT EXIST for any CBDC.
// Per spec §4: every CBDC row is born NOT CONNECTED and may leave that state
// ONLY on (i) a verified authorized interface and (ii) a recorded end-to-end
// test — NEITHER EXISTS. No CBDC integration is claimed anywhere.
//
// Every simulated message this adapter produces carries:
//   `simulation: true` and the marker "SIMULATED — NOT CONNECTED".
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// Zero on-chain actions, zero network calls, zero key handling.
// ============================================================================

import { computeSyntheticAuthTag, TEST_ONLY_AUTH_KEY_LITERAL, canonicalPaymentPayload } from "./issuance-state-machine";

export const CBDC_ADAPTER_STATUS = "SIMULATED / NOT CONNECTED" as const;
export const CBDC_ADAPTER_MARKER = "SIMULATED — NOT CONNECTED" as const;

// ----------------------------------------------------------------------------
// §7.4 concern descriptors (documented members of the adapter contract)
// ----------------------------------------------------------------------------

export interface CbdcConcernDescriptor {
  /** Which of the nine MANDATE-006 §7.4 concern areas this member documents. */
  readonly concernNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  readonly concernName: string;
  /** What the requirement demands (spec §14.3 restatement). */
  readonly requirement: string;
  /** The HONEST current status of this concern for every CBDC. */
  readonly currentStatus: string;
  /** Evidence backing the status (or its verified absence). */
  readonly evidence: string;
}

// ----------------------------------------------------------------------------
// Simulated message shape (spec-labeled)
// ----------------------------------------------------------------------------

export type CbdcMessageStatus = "INITIATED" | "VERIFIED" | "SETTLED" | "FAILED" | "REVERSED" | "TIMEOUT";

export interface CbdcSimulatedMessage {
  /** ALWAYS true on every message this adapter produces (mandate requirement). */
  readonly simulation: true;
  /** ALWAYS the literal marker (mandate requirement). */
  readonly marker: "SIMULATED — NOT CONNECTED";
  readonly issuingAuthority: string;
  readonly txId: string;
  readonly status: CbdcMessageStatus;
  /** finality-at timestamp (ms on the simulated machine clock; null unless SETTLED). */
  readonly finalityAtMs: number | null;
  readonly amountMicro: string | null;
  readonly instrument: { code: string; rail: string; type: "CBDC" };
  readonly correlationRef: string;
  readonly reasonCode: string;
  /** Set when a duplicate transaction identifier was refused (§7.4 concern 6). */
  readonly duplicatePrevented: boolean;
  /** Synthetic authenticity tag over the canonical payment payload (TEST-ONLY scheme). */
  readonly authTag: string | null;
  readonly notes: string;
}

// ----------------------------------------------------------------------------
// §7.4 concern 9 — reconciliation statement shape
// ----------------------------------------------------------------------------

export interface CbdcReconciliationStatement {
  readonly simulation: true;
  readonly marker: "SIMULATED — NOT CONNECTED";
  readonly statementRef: string;
  readonly entries: { txId: string; status: CbdcMessageStatus; amountMicro: string; correlationRef: string }[];
  readonly notes: string;
}

// ----------------------------------------------------------------------------
// The adapter interface — nine §7.4 concern areas as documented members
// ----------------------------------------------------------------------------

export interface CbdcAdapter {
  readonly adapterId: string;
  /** §7.4 status label. */
  readonly status: typeof CBDC_ADAPTER_STATUS;

  // §7.4 concern 1 — issuing authority and jurisdiction
  readonly issuingAuthorityAndJurisdiction: CbdcConcernDescriptor;
  // §7.4 concern 2 — eligible participating institutions
  readonly eligibleParticipatingInstitutions: CbdcConcernDescriptor;
  // §7.4 concern 3 — permissioning and account requirements
  readonly permissioningAndAccountRequirements: CbdcConcernDescriptor;
  // §7.4 concern 4 — authorized technical interface
  readonly authorizedTechnicalInterface: CbdcConcernDescriptor;
  // §7.4 concern 5 — payment initiation, verification, and settlement-status queries
  readonly paymentOperations: CbdcConcernDescriptor;

  // §7.4 concern 5 — payment initiation, verification, and settlement-status queries
  initiatePayment(input: {
    txId: string;
    amountMicro: bigint;
    payerId: string;
    instrumentCode: string;
    correlationRef: string;
  }): CbdcSimulatedMessage;
  verifyPayment(txId: string): CbdcSimulatedMessage;
  querySettlementStatus(txId: string): CbdcSimulatedMessage;

  // §7.4 concern 6 — transaction identifiers and duplicate prevention
  readonly transactionIdentifierScheme: CbdcConcernDescriptor;

  // §7.4 concern 7 — finality, failure, reversal, dispute, and timeout behavior
  readonly finalityFailureReversalDisputeTimeoutSemantics: CbdcConcernDescriptor;

  // §7.4 concern 8 — privacy and audit requirements
  readonly privacyAndAuditRequirements: CbdcConcernDescriptor;

  // §7.4 concern 9 — reconciliation with the payment provider and MTQΣ issuance records
  buildReconciliationStatement(correlationRefs: string[]): CbdcReconciliationStatement;

  /**
   * The real-adapter gate (spec §14.3): an authorized interface verified AND a
   * recorded end-to-end integration test. Must be FALSE for every adapter that
   * is not actually connected.
   */
  readonly realAdapterGate: {
    authorizedInterfaceVerified: false;
    endToEndIntegrationTested: false;
    admissionDossierAnnexExists: false;
    status: typeof CBDC_ADAPTER_STATUS;
  };
}

// ----------------------------------------------------------------------------
// The SIMULATED adapter (clearly labeled; drives the state machine in tests)
// ----------------------------------------------------------------------------

const NOT_CONNECTED_EVIDENCE =
  "VERIFIED-BY-ABSENCE (Stage A source/infra censuses; spec §1 'CBDCs: NOT CONNECTED'): no authorized interface, " +
  "no test environment, no institutional agreement, and no end-to-end integration exist anywhere in this repository.";

function concern(
  concernNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  concernName: string,
  requirement: string,
): CbdcConcernDescriptor {
  return {
    concernNumber,
    concernName,
    requirement,
    currentStatus: `NOT CONNECTED — does not exist for any CBDC. ${CBDC_ADAPTER_STATUS}.`,
    evidence: NOT_CONNECTED_EVIDENCE,
  };
}

export interface SimulatedCbdcAdapterOptions {
  adapterId?: string;
  /** Simulated clock source (wired to the issuance machine's clock for determinism). */
  nowMs: () => number;
}

export class SimulatedCbdcAdapter implements CbdcAdapter {
  readonly adapterId: string;
  readonly status = CBDC_ADAPTER_STATUS;

  // §7.4 concern 1 — issuing authority and jurisdiction
  readonly issuingAuthorityAndJurisdiction: CbdcConcernDescriptor = concern(
    1,
    "Issuing authority and jurisdiction",
    "The adapter contract must name the CBDC's issuing authority (central bank / monetary authority) and its jurisdiction, " +
      "and the MTQΣ-side eligibility determination that relies on it (spec §14.3; MANDATE-006 §7.4).",
  );
  // §7.4 concern 2 — eligible participating institutions
  readonly eligibleParticipatingInstitutions: CbdcConcernDescriptor = concern(
    2,
    "Eligible participating institutions",
    "The adapter contract must specify which institutions are eligible to participate in the CBDC system and which " +
      "of them MTQΣ may transact through (spec §14.3).",
  );
  // §7.4 concern 3 — permissioning and account requirements
  readonly permissioningAndAccountRequirements: CbdcConcernDescriptor = concern(
    3,
    "Permissioning and account requirements",
    "The adapter contract must specify the permissioning and account requirements MTQΣ must satisfy to hold, send, " +
      "or receive the CBDC (spec §14.3).",
  );
  // §7.4 concern 4 — authorized technical interface
  readonly authorizedTechnicalInterface: CbdcConcernDescriptor = concern(
    4,
    "Authorized technical interface",
    "The adapter contract must document the authorized technical interface (API/message standard, endpoint identity, " +
      "access grant, authentication scheme) — a REQUIRED ANNEX of any CBDC admission dossier (spec §14.3).",
  );
  // §7.4 concern 6 — transaction identifiers and duplicate prevention
  readonly transactionIdentifierScheme: CbdcConcernDescriptor = concern(
    6,
    "Transaction identifiers and duplicate prevention",
    "The adapter contract must define transaction identifiers and a duplicate-prevention scheme binding MTQΣ issuance " +
      "records to unique payment transactions (spec §14.3). The SIMULATED adapter implements a txId uniqueness registry " +
      "so duplicate prevention can be TESTED with simulated messages.",
  );
  // §7.4 concern 7 — finality/failure/reversal/dispute/timeout semantics
  readonly finalityFailureReversalDisputeTimeoutSemantics: CbdcConcernDescriptor = concern(
    7,
    "Finality, failure, reversal, dispute, and timeout behavior",
    "The adapter contract must define finality, failure, reversal, dispute, and timeout semantics of the CBDC system " +
      "(spec §14.3; spec §6.2: the authorized interface's own finality signal). The SIMULATED adapter exposes the " +
      "statuses INITIATED/VERIFIED/SETTLED/FAILED/REVERSED/TIMEOUT with a finality-at timestamp on SETTLED.",
  );
  // §7.4 concern 8 — privacy and audit requirements
  readonly privacyAndAuditRequirements: CbdcConcernDescriptor = concern(
    8,
    "Privacy and audit requirements",
    "The adapter contract must define the privacy protections and audit-record requirements of the CBDC interface " +
      "(spec §14.3). The SIMULATED adapter produces fully-labeled synthetic messages suitable for audit-trail testing only.",
  );

  readonly realAdapterGate = {
    authorizedInterfaceVerified: false,
    endToEndIntegrationTested: false,
    admissionDossierAnnexExists: false,
    status: CBDC_ADAPTER_STATUS,
  } as const;

  /** The simulated CBDC instrument descriptor (matches registry row TEST-CBDC-001). */
  readonly simulatedInstrument = {
    code: "TEST-CBDC-1",
    rail: "SIMULATED-CBDC-RAIL-1 (SYNTHETIC)",
    type: "CBDC" as const,
    label: `${CBDC_ADAPTER_MARKER} — simulated instrument descriptor; the registry row remains NOT_CONNECTED`,
  };

  private readonly nowMs: () => number;
  private readonly initiated = new Map<
    string,
    { amountMicro: bigint; payerId: string; correlationRef: string; outcome: CbdcMessageStatus; reasonCode: string }
  >();

  constructor(opts: SimulatedCbdcAdapterOptions) {
    this.adapterId = opts.adapterId ?? "SIMULATED-CBDC-ADAPTER-1";
    this.nowMs = opts.nowMs;
  }

  /** TEST FIXTURE: script an adverse outcome for a txId (REVERSED/TIMEOUT/FAILED demonstrations). */
  scriptOutcome(txId: string, outcome: CbdcMessageStatus, reasonCode: string): void {
    const rec = this.initiated.get(txId);
    if (rec) {
      rec.outcome = outcome;
      rec.reasonCode = reasonCode;
    }
  }

  private make(
    partial: Omit<CbdcSimulatedMessage, "simulation" | "marker" | "issuingAuthority" | "duplicatePrevented">,
    duplicatePrevented = false,
  ): CbdcSimulatedMessage {
    return {
      ...partial,
      simulation: true,
      marker: CBDC_ADAPTER_MARKER,
      issuingAuthority: "TEST-CBDC-AUTHORITY (SYNTHETIC — NO ISSUING AUTHORITY EXISTS)",
      duplicatePrevented,
    };
  }

  // §7.4 concern 5 — payment initiation, verification, settlement-status queries ----

  readonly paymentOperations: CbdcConcernDescriptor = concern(
    5,
    "Payment initiation, verification, and settlement-status queries",
    "The adapter contract must support payment initiation, payment verification, and settlement-status queries against " +
      "the authorized interface (spec §14.3). The SIMULATED adapter implements initiatePayment/verifyPayment/" +
      "querySettlementStatus producing labeled simulated messages.",
  );

  initiatePayment(input: {
    txId: string;
    amountMicro: bigint;
    payerId: string;
    instrumentCode: string;
    correlationRef: string;
  }): CbdcSimulatedMessage {
    // §7.4 concern 6 — duplicate prevention: a txId initiates exactly once.
    if (this.initiated.has(input.txId)) {
      return this.make(
        {
          txId: input.txId,
          status: "FAILED",
          finalityAtMs: null,
          amountMicro: null,
          instrument: { code: input.instrumentCode, rail: this.simulatedInstrument.rail, type: "CBDC" },
          correlationRef: input.correlationRef,
          reasonCode: "DUPLICATE_TX_ID_PREVENTED (§7.4 concern 6)",
          authTag: null,
          notes: `duplicate initiation refused for txId ${input.txId}; the ORIGINAL message is returned to the caller — never a second execution`,
        },
        true,
      );
    }
    this.initiated.set(input.txId, {
      amountMicro: input.amountMicro,
      payerId: input.payerId,
      correlationRef: input.correlationRef,
      outcome: "SETTLED", // default scripted outcome (TEST FIXTURE); adverse outcomes via scriptOutcome()
      reasonCode: "SIMULATED_DEFAULT_OUTCOME",
    });
    const authTag = computeSyntheticAuthTag(
      TEST_ONLY_AUTH_KEY_LITERAL,
      canonicalPaymentPayload({
        paymentTxId: input.txId,
        instrumentCode: input.instrumentCode,
        network: this.simulatedInstrument.rail,
        payerId: input.payerId,
        amountMicro: input.amountMicro,
        observedAtMs: this.nowMs(),
      }),
    );
    return this.make({
      txId: input.txId,
      status: "INITIATED",
      finalityAtMs: null,
      amountMicro: input.amountMicro.toString(10),
      instrument: { code: input.instrumentCode, rail: this.simulatedInstrument.rail, type: "CBDC" },
      correlationRef: input.correlationRef,
      reasonCode: "SIMULATED_INITIATED",
      authTag,
      notes: `${CBDC_ADAPTER_MARKER} — simulated initiation message; no CBDC system was contacted (none exists)`,
    });
  }

  verifyPayment(txId: string): CbdcSimulatedMessage {
    const rec = this.initiated.get(txId);
    if (!rec) {
      return this.make({
        txId,
        status: "FAILED",
        finalityAtMs: null,
        amountMicro: null,
        instrument: { code: this.simulatedInstrument.code, rail: this.simulatedInstrument.rail, type: "CBDC" },
        correlationRef: "UNKNOWN_TX",
        reasonCode: "TX_NOT_FOUND",
        authTag: null,
        notes: `${CBDC_ADAPTER_MARKER} — unknown txId; no verification possible`,
      });
    }
    return this.make({
      txId,
      status: "VERIFIED",
      finalityAtMs: null,
      amountMicro: rec.amountMicro.toString(10),
      instrument: { code: this.simulatedInstrument.code, rail: this.simulatedInstrument.rail, type: "CBDC" },
      correlationRef: rec.correlationRef,
      reasonCode: "SIMULATED_VERIFIED",
      authTag: null,
      notes: `${CBDC_ADAPTER_MARKER} — simulated verification message`,
    });
  }

  querySettlementStatus(txId: string): CbdcSimulatedMessage {
    const rec = this.initiated.get(txId);
    if (!rec) {
      return this.make({
        txId,
        status: "FAILED",
        finalityAtMs: null,
        amountMicro: null,
        instrument: { code: this.simulatedInstrument.code, rail: this.simulatedInstrument.rail, type: "CBDC" },
        correlationRef: "UNKNOWN_TX",
        reasonCode: "TX_NOT_FOUND",
        authTag: null,
        notes: `${CBDC_ADAPTER_MARKER} — unknown txId; no settlement status exists`,
      });
    }
    return this.make({
      txId,
      status: rec.outcome,
      finalityAtMs: rec.outcome === "SETTLED" ? this.nowMs() : null,
      amountMicro: rec.amountMicro.toString(10),
      instrument: { code: this.simulatedInstrument.code, rail: this.simulatedInstrument.rail, type: "CBDC" },
      correlationRef: rec.correlationRef,
      reasonCode: rec.outcome === "SETTLED" ? "SIMULATED_SETTLED" : rec.reasonCode,
      authTag: null,
      notes:
        rec.outcome === "SETTLED"
          ? `${CBDC_ADAPTER_MARKER} — simulated settlement message carrying the interface's own finality signal (spec §6.2): SETTLED with finality-at timestamp`
          : `${CBDC_ADAPTER_MARKER} — simulated adverse settlement message (${rec.outcome}); handled by the issuance machine to the correct terminal state`,
    });
  }

  // §7.4 concern 9 — reconciliation with the payment provider and MTQΣ issuance records ----

  buildReconciliationStatement(correlationRefs: string[]): CbdcReconciliationStatement {
    return {
      simulation: true,
      marker: CBDC_ADAPTER_MARKER,
      statementRef: `SIMULATED-CBDC-STATEMENT-${this.nowMs()}`,
      entries: [...this.initiated.entries()]
        .filter(([, rec]) => correlationRefs.includes(rec.correlationRef))
        .map(([txId, rec]) => ({
          txId,
          status: rec.outcome,
          amountMicro: rec.amountMicro.toString(10),
          correlationRef: rec.correlationRef,
        })),
        notes:
        `${CBDC_ADAPTER_MARKER} — SIMULATED provider-side reconciliation statement. A REAL reconciliation interface ` +
        "with the payment provider does not exist (spec §14.3 concern 9); this synthetic statement exists ONLY so the " +
        "issuance machine's reconciliation step can be exercised with labeled simulated messages.",
    };
  }
}

/** Convenience: the honest status of every CBDC concern, as a printable record. */
export function cbdcAdapterHonestyRecord(adapter: CbdcAdapter) {
  return {
    adapterId: adapter.adapterId,
    status: adapter.status,
    concerns: [
      adapter.issuingAuthorityAndJurisdiction,
      adapter.eligibleParticipatingInstitutions,
      adapter.permissioningAndAccountRequirements,
      adapter.authorizedTechnicalInterface,
      adapter.paymentOperations,
      adapter.transactionIdentifierScheme,
      adapter.finalityFailureReversalDisputeTimeoutSemantics,
      adapter.privacyAndAuditRequirements,
      concern(9, "Reconciliation interface", "The adapter contract must support reconciliation with the payment provider and MTQΣ issuance records (spec §14.3)."),
    ],
    realAdapterGate: adapter.realAdapterGate,
    limitations: [
      "NO issuing authority exists or is engaged for any CBDC.",
      "NO authorized technical interface exists (endpoint identity, message standard, access grant — none).",
      "NO institutional connection exists (no participating-institution permissioning, no accounts).",
      "NO end-to-end integration test against a real interface is POSSIBLE — none exists to test against.",
      "The spec §14.3 admission-dossier annex (nine §7.4 fields) DOES NOT EXIST for any CBDC.",
      "Per spec §4: CBDC rows may leave NOT CONNECTED only via (i) a verified authorized interface and (ii) a recorded end-to-end test — NEITHER EXISTS.",
    ],
  };
}
