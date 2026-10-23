// ============================================================================
// MTQΣ — ISSUANCE LEDGER + EVENT PERSISTENCE (Task M8-3b)
// ============================================================================
// PROVENANCE: new production module completing the MANDATE-007 §4 prototype
// port (audit-work/task13/evidence/issuance-state-machine/ — immutable
// evidence): the prototype's in-memory three books (payment / issuance /
// token) and its step-12 audit publication are preserved in
// issuance-machine.ts; THIS module is the auditability facade — the
// in-memory issuance ledger view (requests, payments, mints, reconciliation)
// plus persistence of EVERY issuance event to Prisma (model IssuanceEvent)
// for auditability.
//
// PERSISTENCE DESIGN (honest, fail-soft-disclosed — pilot convention):
//   • The machine's synchronous event log is the AUTHORITATIVE in-memory
//     record (deterministic; the test runner asserts against it).
//   • This ledger maps every event to a FLAT primitive event doc (the
//     Prisma IssuanceEvent shape: id, requestId, kind, state, instrument,
//     grossAmount, feeAmount, netAmount, quote, issuedAmount, supplyAfter,
//     payload String, createdAt) and flushes docs to a sink.
//   • Sink failures are CAUGHT, DISCLOSED to the caller (never silently
//     swallowed), and the cursor is NOT advanced — unpersisted events are
//     retried on the next flush. Nothing is lost in-memory; the pilot's DB
//     is a durability mirror, not the source of truth (the pilot's fail-soft
//     persistence is a governed-to-be-removed convenience — spec §11).
//   • The Prisma sink is SERVER-SIDE ONLY (dynamic `import("@/lib/db")` per
//     project convention); the deterministic test runner uses an in-memory
//     sink so its outputs stay byte-stable.
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// Zero on-chain actions, zero network calls, zero key handling.
// ============================================================================

import type { EventLogEntry, IssuanceMachine, ReconciliationResult } from "./issuance-machine";
import { reconcileThreeBooks } from "./issuance-machine";
import { fmt6 } from "./parameters";

// ----------------------------------------------------------------------------
// Flat event doc — the exact Prisma IssuanceEvent field set (primitives only)
// ----------------------------------------------------------------------------

export interface IssuanceEventDoc {
  requestId: string;
  /** Event kind (REQUEST · QUOTE · PAYMENT · SETTLEMENT · INSTRUMENT · FEES · NET · AUTHORIZATION · SUPPLY · ISSUED · RECONCILIATION · REVERSAL · REFUND · ATTESTATION · PROGRAM · PIPELINE · FAILURE · OTHER). */
  kind: string;
  /** Issuance state at event time (IssuanceState, or "" for machine-level lifecycle events). */
  state: string;
  /** Instrument identity at event time ("" when not applicable). */
  instrument: string;
  /** Exact 6-decimal fixed-point strings — illustrative units (see parameters.ts provenance). */
  grossAmount: string;
  feeAmount: string;
  netAmount: string;
  quote: string;
  issuedAmount: string;
  supplyAfter: string;
  /** JSON detail (reason codes, labels, observed values) — flattened for auditability. */
  payload: string;
}

/** Map a machine event-log entry to the flat persistence doc. */
export function mapEventToDoc(entry: EventLogEntry): IssuanceEventDoc {
  return {
    requestId: entry.requestId,
    kind: eventKind(entry),
    state: entry.to ?? entry.from ?? "",
    instrument: entry.econ.instrument,
    grossAmount: entry.econ.grossAmount,
    feeAmount: entry.econ.feeAmount,
    netAmount: entry.econ.netAmount,
    quote: entry.econ.quote,
    issuedAmount: entry.econ.issuedAmount,
    supplyAfter: entry.econ.supplyAfter,
    payload: JSON.stringify({
      seq: entry.seq,
      atMs: entry.atMs,
      from: entry.from,
      to: entry.to,
      stepRef: entry.stepRef,
      reasonCode: entry.reasonCode,
      detail: entry.detail,
      taxonomyClass: entry.taxonomyClass,
    }),
  };
}

function eventKind(entry: EventLogEntry): string {
  const rc = entry.reasonCode;
  if (rc.startsWith("PROGRAM_")) return "PROGRAM";
  if (rc.startsWith("ATTESTATION") || rc.startsWith("PIPELINE_SUSPENDED_ATTESTATION") || rc.startsWith("RESUM")) return "ATTESTATION";
  if (rc.startsWith("REFUND_")) return "REFUND";
  if (rc.startsWith("PIPELINE_") || rc === "SUBMISSION_REJECTED_PIPELINE_SUSPENDED") return "PIPELINE";
  if (rc.startsWith("TRANSITION_REJECTED")) return "TRANSITION_REJECT";
  if (rc === "REQUEST_ACCEPTED" || rc.startsWith("REQUEST_REPLAY") || rc === "DUPLICATE_IDEMPOTENCY_KEY" || rc === "DUPLICATE_KEY_COLLISION") return "REQUEST";
  const to = entry.to;
  if (to === "QUOTED" || to === "EXPIRED_QUOTE") return "QUOTE";
  if (to === "PAYMENT_OBSERVED" || to === "PAYMENT_AUTHENTIC" || to === "PAYMENT_FAILED" || to === "INVALID_PAYMENT" || to === "DUPLICATE") return "PAYMENT";
  if (to === "SETTLEMENT_FINAL") return "SETTLEMENT";
  if (to === "INSTRUMENT_CHECKED" || to === "INVALID_INSTRUMENT") return "INSTRUMENT";
  if (to === "FEES_CALCULATED") return "FEES";
  if (to === "NET_ACCEPTED") return "NET";
  if (to === "AUTHORIZED" || to === "UNAUTHORIZED") return "AUTHORIZATION";
  if (to === "SUPPLY_CHECKED" || to === "SUPPLY_CAP_EXCEEDED") return "SUPPLY";
  if (to === "ISSUED") return "ISSUED";
  if (to === "RECONCILED" || to === "RECONCILIATION_BREAK") return "RECONCILIATION";
  if (to === "CANCELLED" || rc.startsWith("REVERSAL_")) return "REVERSAL";
  return "OTHER";
}

// ----------------------------------------------------------------------------
// Event sink — Prisma (server-side) + in-memory (deterministic tests)
// ----------------------------------------------------------------------------

export interface IssuanceEventSink {
  write(doc: IssuanceEventDoc): Promise<void>;
}

/**
 * SERVER-SIDE ONLY. Prisma-backed sink — persists every issuance event to the
 * IssuanceEvent table via the shared client (`import { db } from "@/lib/db"`).
 * Flat primitive fields only (see prisma/schema.prisma). All money values are
 * exact 6-decimal fixed-point strings in ILLUSTRATIVE units (UNAPPROVED).
 */
export function createPrismaIssuanceEventSink(): IssuanceEventSink {
  return {
    async write(doc: IssuanceEventDoc): Promise<void> {
      const { db } = await import("@/lib/db");
      await db.issuanceEvent.create({
        data: {
          requestId: doc.requestId,
          kind: doc.kind,
          state: doc.state,
          instrument: doc.instrument,
          grossAmount: doc.grossAmount,
          feeAmount: doc.feeAmount,
          netAmount: doc.netAmount,
          quote: doc.quote,
          issuedAmount: doc.issuedAmount,
          supplyAfter: doc.supplyAfter,
          payload: doc.payload,
        },
      });
    },
  };
}

/** Deterministic in-memory sink (test runner / no-DB environments). */
export function createInMemoryIssuanceEventSink(): IssuanceEventSink & { docs: readonly IssuanceEventDoc[] } {
  const docs: IssuanceEventDoc[] = [];
  return {
    docs,
    async write(doc: IssuanceEventDoc): Promise<void> {
      docs.push(doc);
    },
  };
}

// ----------------------------------------------------------------------------
// The in-memory issuance ledger — auditability facade over the machine
// ----------------------------------------------------------------------------

export interface LedgerViewRequest {
  requestId: string;
  state: string;
  terminalReasonCode: string | null;
  instrument: string;
  hasMintRecord: boolean;
  issuedAmount: string | null;
  authorizationProgramId: string | null;
}

export interface LedgerView {
  requests: readonly LedgerViewRequest[];
  payments: { requestId: string; paymentTxId: string; grossTU: string; feeTU: string; netTU: string; status: string }[];
  mints: { mintId: string; requestId: string; recipientId: string; amount: string; nonce: number; programId: string; recordOnlyLabel: string }[];
  reconciliation: ReconciliationResult;
  supply: ReturnType<IssuanceMachine["getSupplySnapshot"]>;
}

export class IssuanceLedger {
  private cursorSeq = 0;

  constructor(private readonly machine: IssuanceMachine) {}

  /** Docs for every event not yet persisted (cursor-based; no loss, no double-write). */
  pendingEventDocs(): IssuanceEventDoc[] {
    return this.machine
      .getEventLog()
      .filter((e) => e.seq > this.cursorSeq)
      .map(mapEventToDoc);
  }

  /**
   * Flush every pending event doc through the sink. On sink failure the
   * cursor is NOT advanced and the error is returned (disclosed, retried on
   * the next flush — never silently swallowed, never lost).
   */
  async flush(sink: IssuanceEventSink): Promise<{ written: number; error: string | null }> {
    const pending = this.pendingEventDocs();
    if (pending.length === 0) return { written: 0, error: null };
    try {
      for (const doc of pending) {
        await sink.write(doc);
      }
      const lastSeq = Number(JSON.parse(pending[pending.length - 1].payload).seq as number);
      this.cursorSeq = Math.max(this.cursorSeq, lastSeq);
      return { written: pending.length, error: null };
    } catch (e) {
      return { written: 0, error: e instanceof Error ? e.message : String(e) };
    }
  }

  /** The in-memory issuance ledger view (requests / payments / mints / reconciliation). */
  view(): LedgerView {
    const machine = this.machine;
    const snap = machine.ledgerSnapshot();
    return {
      requests: machine.allRequestIds().map((requestId) => {
        const st = machine.getInstanceState(requestId);
        return {
          requestId,
          state: st?.state ?? "UNKNOWN",
          terminalReasonCode: st?.terminalReasonCode ?? null,
          instrument: st?.instrument ?? "",
          hasMintRecord: st?.hasMintRecord ?? false,
          issuedAmount: st?.issuedMicro ?? null,
          authorizationProgramId: st?.authorizationProgramId ?? null,
        };
      }),
      payments: snap.paymentBookEntries.map((p) => ({
        requestId: p.requestId,
        paymentTxId: p.paymentTxId,
        grossTU: fmt6(p.grossTUMicro),
        feeTU: fmt6(p.feeMicro),
        netTU: fmt6(p.netTUMicro),
        status: p.status,
      })),
      mints: [...snap.tokenBook.values()].map((t) => {
        const rec = machine.getMintRecord(t.requestId);
        const issuance = snap.issuanceRecords.find((i) => i.requestId === t.requestId);
        return {
          mintId: t.mintId,
          requestId: t.requestId,
          recipientId: t.recipientId,
          amount: fmt6(t.amountMicro),
          nonce: rec?.nonce ?? 0,
          programId: issuance?.programId ?? "n/a",
          recordOnlyLabel: rec?.recordOnlyLabel ?? "LEDGER RECORD ONLY — NEVER ON-CHAIN",
        };
      }),
      reconciliation: reconcileThreeBooks(snap),
      supply: machine.getSupplySnapshot(),
    };
  }
}
