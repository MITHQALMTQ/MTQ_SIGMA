// MTQΣ — PAYMENT-FUNDED PRIMARY ISSUANCE API (Task M8-3c-b)
// ============================================================================
// GET  → the honest machine/registry/labels snapshot + the last ~50 persisted
//        IssuanceEvent rows (Prisma durability mirror, fail-soft-disclosed).
// POST → run ONE of the 8 DEMO scenarios on a FRESH issuance machine (fresh
//        registry + TEST-ONLY fixtures + FIXED deterministic clock), driving
//        the §14.4 12-step workflow via the real machine API, then persisting
//        every event through the Prisma sink (fail-soft-disclosed).
//
// THIS ROUTE IS A DEMO SURFACE ON SYNTHETIC FIXTURES ONLY:
//   • "ISSUED" IS A LEDGER RECORD ONLY — NEVER ON-CHAIN. No token contract is
//     involved, no chain action occurs, no network call to any external host,
//     and no key handling exists anywhere in this route.
//   • ALL economic values shown are UNAPPROVED / ILLUSTRATIVE (fee 0.10% =
//     D-13.8 OPEN; quote 2.000000 TU/token = §14.5 FORM adopted, derivation
//     policy OPEN; supply caps D-13.6 deferred; depeg bands D-13.19 UNAPPROVED).
//   • D-13.27 status: ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER
//     RATIFICATION (ALT-4 hybrid + periodic attestation).
//   • CBDC adapter: SIMULATED / NOT CONNECTED — nothing is connected, ever.
//
// DETERMINISM: every scenario run uses the FIXED clockStartMs (1_800_000_000_000)
// and fixed +1_000ms step ticks, so the same scenario produces a byte-identical
// event sequence on every call (the DB rows additionally carry wall-clock
// createdAt stamps — the event content itself is deterministic).
//
// This route is one of the three intended callers of separation-check.ts
// (Pilot Command Center section · this API route · the deterministic test
// runner) — every run captures the basket/constituency snapshot before and
// after and proves byte-identity (payment volume never changes weights).
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE
// TRANSACTIONS FORBIDDEN · NOT ACCEPTED.
// ============================================================================

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import {
  ALLOWED_TRANSITIONS,
  AUTH_SCHEME_LABEL,
  D_13_27_STATUS,
  MACHINE_LABEL,
  STATE_STEP_REFS,
  TERMINAL_STATES,
  canonicalPaymentPayload,
  computeSyntheticAuthTag,
  isTerminal,
  TEST_ONLY_AUTH_KEY_LITERAL,
  IssuanceMachine,
  type EventLogEntry,
  type IssuanceState,
} from "@/lib/mtq/issuance/issuance-machine";
import { ALT4_ADOPTION_LABEL, StubAttester } from "@/lib/mtq/issuance/authorization";
import {
  CBDC_ADAPTER_MARKER,
  CBDC_ADAPTER_STATUS,
  SimulatedCbdcAdapter,
  cbdcAdapterHonestyRecord,
} from "@/lib/mtq/issuance/cbdc-adapter";
import { REGISTRY_LABEL, PaymentInstrumentRegistry } from "@/lib/mtq/issuance/instrument-registry";
import {
  IssuanceLedger,
  createPrismaIssuanceEventSink,
  mapEventToDoc,
} from "@/lib/mtq/issuance/ledger";
import {
  FEE_SCHEDULE,
  QUOTE_POLICY,
  ROUNDING_RULE,
  SUPPLY_POLICY,
  fmt6,
} from "@/lib/mtq/issuance/parameters";
import {
  ISSUANCE_TEST_FIXTURES_LABEL,
  TEST_CBDC_INSTRUMENT,
  TEST_INSTRUMENT,
  installIssuanceTestFixtures,
} from "@/lib/mtq/issuance/test-fixtures";
import {
  SEPARATION_CHECK_LABEL,
  basketSnapshotBytes,
  basketSnapshotsByteIdentical,
  captureBasketSnapshot,
} from "@/lib/mtq/issuance/separation-check";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;

const STATUS_BANNER =
  "TESTNET ONLY · SHADOW MODE ENFORCED · LEDGER RECORDS ONLY — NEVER ON-CHAIN · ECONOMIC VALUES UNAPPROVED / ILLUSTRATIVE · NOT ACCEPTED";

const DEMO_DISCLAIMER =
  "SCENARIO DEMO ON SYNTHETIC TEST FIXTURES — this run executed the REAL issuance state machine against TEST-ONLY " +
  "synthetic instruments (TEST-USDC-X / TEST-CBDC-1) on a fixed deterministic clock. \u201cISSUED\u201d IS A LEDGER " +
  "RECORD ONLY — NEVER ON-CHAIN: no token contract is involved, no chain action occurs, no network call is made, " +
  "and no real payment exists. All economic values are UNAPPROVED / ILLUSTRATIVE. The DB is a durability mirror " +
  "(fail-soft-disclosed); the machine\u2019s in-memory event log is authoritative.";

const AUDIT_NOTE =
  "The DB (Prisma model IssuanceEvent) is the DURABILITY MIRROR — persistence is fail-soft-disclosed (a write " +
  "failure is returned, never swallowed). The machine\u2019s synchronous in-memory event log is the AUTHORITATIVE record.";

// ---------------------------------------------------------------------------
// Deterministic demo constants
// ---------------------------------------------------------------------------

const CLOCK_START_MS = 1_800_000_000_000; // fixed clock → reproducible outputs
const STEP_MS = 1_000; // one deterministic tick between §14.4 steps
const GROSS_INSTRUMENT_MICRO = 10_000_000_000n; // 10,000.000000 TEST units
const PAYER_ID = "TEST-PAYER-001";
const RECIPIENT_ID = "TEST-RECIPIENT-001";
const JURISDICTION = "TEST-JURISDICTION";

// The expected happy-path numbers (asserted in the drive logic; 6-decimal strings).
const EXPECTED_NUMBERS = {
  gross: "10000.000000",
  fee: "10.000000",
  net: "9990.000000",
  quote: "2.000000",
  issued: "4995.000000",
  supplyAfterSingleMint: "4995.000000",
} as const;

const HAPPY_PATH_STATES: IssuanceState[] = [
  "REQUEST_CREATED",
  "QUOTED",
  "PAYMENT_OBSERVED",
  "PAYMENT_AUTHENTIC",
  "SETTLEMENT_FINAL",
  "INSTRUMENT_CHECKED",
  "FEES_CALCULATED",
  "NET_ACCEPTED",
  "AUTHORIZED",
  "SUPPLY_CHECKED",
  "ISSUED",
  "RECONCILED",
];

const SCENARIOS = [
  "happy-path",
  "duplicate",
  "delayed-finality",
  "failed-payment",
  "reversal-pre",
  "reversal-post",
  "unauthorized",
  "cbdc-simulated",
] as const;
type Scenario = (typeof SCENARIOS)[number];

const SCENARIO_DESCRIPTIONS: Record<Scenario, string> = {
  "happy-path":
    "Full §14.4 12-step workflow: request → quote → payment → authenticity → finality → instrument check → fees → " +
    "net → ALT-4 authorization → supply → ISSUED (ledger record) → three-book reconciliation.",
  duplicate:
    "A completed issuance is replayed: a second request arrives under the SAME idempotency key — INV-C: never a " +
    "second execution (spec §6.4/§6.6).",
  "delayed-finality":
    "Settlement finality arrives AFTER the 15-min quote expiry — finality-before-issuance (adopted decision 2): " +
    "EXPIRED_QUOTE + held-in-refund-queue.",
  "failed-payment":
    "The rail reports settlement FAILED — a failed payment NEVER mints (INV-B): PAYMENT_FAILED + auto-refund with " +
    "the same idempotency key.",
  "reversal-pre":
    "A payment reversal arrives BEFORE issuance — adopted decision 3: CANCELLED, no mint, refund queued with the same key.",
  "reversal-post":
    "A payment reversal arrives AFTER issuance — adopted decision 3: RECONCILIATION_BREAK + pipeline SUSPENDED + " +
    "fail-closed authorized remediation (mint record preserved).",
  unauthorized:
    "Settlement is final but NO ALT-4 program exists — INV-A unconditional: a payment event alone NEVER mints " +
    "(D-13.6 exception clause).",
  "cbdc-simulated":
    "SIMULATION-MODE demo on the simulated CBDC rail (SIMULATED / NOT CONNECTED — no authorized interface exists; " +
    "the registry row stays NOT_CONNECTED).",
};

// ---------------------------------------------------------------------------
// Shared payloads
// ---------------------------------------------------------------------------

function labelsPayload() {
  return {
    banner: STATUS_BANNER,
    registryLabel: REGISTRY_LABEL,
    machineLabel: MACHINE_LABEL,
    d1327Status: D_13_27_STATUS,
    alt4Adoption: ALT4_ADOPTION_LABEL,
    authScheme: AUTH_SCHEME_LABEL,
    cbdcAdapterStatus: CBDC_ADAPTER_STATUS,
    cbdcAdapterMarker: CBDC_ADAPTER_MARKER,
    feeScheduleLabel: FEE_SCHEDULE.label,
    quotePolicyLabel: QUOTE_POLICY.label,
    supplyPolicyLabel: SUPPLY_POLICY.label,
    fixturesLabel: ISSUANCE_TEST_FIXTURES_LABEL,
    separationLabel: SEPARATION_CHECK_LABEL,
  };
}

function economicsPayload() {
  return {
    fee: {
      rateBps: FEE_SCHEDULE.rateBps.toString(10),
      feeClass: FEE_SCHEDULE.feeClass,
      label: FEE_SCHEDULE.label,
    },
    quote: {
      tuPerToken: fmt6(QUOTE_POLICY.quoteTUPerTokenMicro),
      validityWindowMinutes: QUOTE_POLICY.quoteTtlMs / 60_000,
      label: QUOTE_POLICY.label,
    },
    supply: {
      perTxCap: fmt6(SUPPLY_POLICY.perTxCapMicro),
      trancheId: SUPPLY_POLICY.trancheId,
      trancheCap: fmt6(SUPPLY_POLICY.trancheCapMicro),
      globalMax: fmt6(SUPPLY_POLICY.globalMaxSupplyMicro),
      label: SUPPLY_POLICY.label,
    },
    roundingRule: ROUNDING_RULE,
  };
}

/** Fresh registry with the TEST-ONLY synthetic fixtures installed (server-side). */
function registrySnapshot() {
  const registry = new PaymentInstrumentRegistry(CLOCK_START_MS);
  installIssuanceTestFixtures(registry);
  return {
    label: REGISTRY_LABEL,
    fixturesLabel: ISSUANCE_TEST_FIXTURES_LABEL,
    bornEmptyNote:
      "BORN EMPTY — the production payment-instrument registry is born empty and admission is FAIL-CLOSED " +
      "(spec §5: a verified real-rail evidence dossier is required and NONE can exist in this pilot). The rows " +
      "below are TEST-ONLY synthetic fixtures installed for this demo — NO REAL INSTRUMENT IS REGISTERED ANYWHERE.",
    rows: registry.allRows().map((r) => ({
      instrumentId: r.instrumentId,
      code: r.code,
      type: r.type,
      network: r.network,
      issuer: { legalName: r.issuer.legalName, jurisdiction: r.issuer.jurisdiction },
      state: r.state,
      honestyState: r.honestyState,
      statusLabel: r.statusLabel,
      testOnly: r.testOnly,
      jurisdictionAllowlist: [...r.jurisdictionAllowlist],
      confirmation: {
        kind: r.confirmationPolicy.kind,
        finalityDefinition: r.confirmationPolicy.finalityDefinition,
      },
      valuation: {
        quoteUnit: r.valuationBasis.quoteUnit,
        pricePerUnit: fmt6(r.valuationBasis.pricePerUnitMicro),
        basisLabel: r.valuationBasis.basisLabel,
      },
      fees: {
        feeClass: r.fees.feeClass,
        rateBps: r.fees.rateBps === null ? null : r.fees.rateBps.toString(10),
        label: r.fees.label,
      },
      depegBandsLabel: r.depegThresholds.label,
      perInstanceIdentityNote: r.perInstanceIdentityNote,
    })),
  };
}

function statesPayload() {
  const all = Object.keys(STATE_STEP_REFS) as IssuanceState[];
  return {
    all,
    terminal: TERMINAL_STATES,
    happyPath: HAPPY_PATH_STATES,
    stepRefs: STATE_STEP_REFS,
    transitions: ALLOWED_TRANSITIONS,
  };
}

function separationSnapshotPayload() {
  const snap = captureBasketSnapshot();
  return {
    label: SEPARATION_CHECK_LABEL,
    methodologyVersion: snap.methodologyVersion,
    weightsPct: snap.weightsPct,
    constituency: snap.constituency,
    byteStable: basketSnapshotsByteIdentical(basketSnapshotBytes(), basketSnapshotBytes()),
  };
}

function cbdcPayload() {
  const adapter = new SimulatedCbdcAdapter({
    adapterId: "SIMULATED-CBDC-ADAPTER-SNAPSHOT",
    nowMs: () => CLOCK_START_MS,
  });
  const rec = cbdcAdapterHonestyRecord(adapter);
  return {
    status: CBDC_ADAPTER_STATUS,
    marker: CBDC_ADAPTER_MARKER,
    realAdapterGate: rec.realAdapterGate,
    limitations: rec.limitations,
  };
}

async function eventsPayload() {
  try {
    const [rows, total] = await Promise.all([
      db.issuanceEvent.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
      db.issuanceEvent.count(),
    ]);
    return {
      rows: rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        requestId: r.requestId,
        kind: r.kind,
        state: r.state,
        instrument: r.instrument,
        grossAmount: r.grossAmount,
        feeAmount: r.feeAmount,
        netAmount: r.netAmount,
        quote: r.quote,
        issuedAmount: r.issuedAmount,
        supplyAfter: r.supplyAfter,
      })),
      totalPersisted: total,
      dbError: null as string | null,
    };
  } catch (e) {
    return {
      rows: [],
      totalPersisted: 0,
      dbError: e instanceof Error ? e.message : String(e),
    };
  }
}

// ---------------------------------------------------------------------------
// GET — the snapshot
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const events = await eventsPayload();
    return NextResponse.json(
      {
        banner: STATUS_BANNER,
        labels: labelsPayload(),
        economics: economicsPayload(),
        registry: registrySnapshot(),
        states: statesPayload(),
        separation: separationSnapshotPayload(),
        cbdc: cbdcPayload(),
        events,
        auditNote: AUDIT_NOTE,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Issuance snapshot failed", detail: String(e) },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — the deterministic scenario runner (demo on synthetic fixtures ONLY)
// ---------------------------------------------------------------------------

function tick(machine: IssuanceMachine): void {
  machine.advanceClock(STEP_MS);
}

function buildMachine(scenario: Scenario): IssuanceMachine {
  const registry = new PaymentInstrumentRegistry(CLOCK_START_MS);
  installIssuanceTestFixtures(registry);
  const config: {
    machineId: string;
    registry: PaymentInstrumentRegistry;
    clockStartMs: number;
    cbdcSimulationMode?: { enabled: boolean; label: "SIMULATED — NOT CONNECTED" };
  } = {
    machineId: `ISSUANCE-DEMO-${scenario.toUpperCase()}`,
    registry,
    clockStartMs: CLOCK_START_MS,
  };
  if (scenario === "cbdc-simulated") {
    config.cbdcSimulationMode = { enabled: true, label: "SIMULATED — NOT CONNECTED" };
  }
  return new IssuanceMachine(config);
}

function recordStubAttestation(machine: IssuanceMachine, notes: string): void {
  const attester = new StubAttester();
  machine.recordAttestation(
    attester.attest({
      attestationId: "ATT-DEMO-001",
      nowMs: machine.nowMs,
      matched: true,
      notes,
    }),
  );
}

/** The EXPLICIT governed acts (ALT-4): program record + fresh stub attestation. */
function setupGovernedActs(
  machine: IssuanceMachine,
  instrument: { code: string; network: string },
): void {
  machine.defineIssuanceProgram({
    programId: "PROG-DEMO-001",
    instruments: [{ code: instrument.code, network: instrument.network }],
    perProgramCapMicro: SUPPLY_POLICY.trancheCapMicro,
    perTxCapMicro: SUPPLY_POLICY.perTxCapMicro,
    windowStartMs: CLOCK_START_MS,
    windowEndMs: CLOCK_START_MS + 86_400_000,
  });
  recordStubAttestation(
    machine,
    "STUB attestation (TEST-ONLY — no authorized independent attester exists in this pilot) recorded for the " +
      "Pilot Command Center demo run; production requires a governance-appointed attester.",
  );
}

function requestInput(
  requestId: string,
  idempotencyKey: string,
  instrument: { code: string; network: string },
) {
  return {
    requestId,
    idempotencyKey,
    instrumentCode: instrument.code,
    network: instrument.network,
    payerId: PAYER_ID,
    recipientId: RECIPIENT_ID,
    jurisdiction: JURISDICTION,
    requestedInstrumentAmountMicro: GROSS_INSTRUMENT_MICRO,
  };
}

/** §14.4 steps 1→4a (request → quote → payment → authenticity) on the synthetic stablecoin rail. */
function driveToPaymentAuthentic(
  machine: IssuanceMachine,
  requestId: string,
  idempotencyKey: string,
): void {
  const instrument = TEST_INSTRUMENT;
  machine.submitIssuanceRequest(requestInput(requestId, idempotencyKey, instrument));
  tick(machine);
  machine.generateQuote(requestId);
  tick(machine);
  const observedAtMs = machine.nowMs;
  const canonical = canonicalPaymentPayload({
    paymentTxId: "PAY-DEMO-001",
    instrumentCode: instrument.code,
    network: instrument.network,
    payerId: PAYER_ID,
    amountMicro: GROSS_INSTRUMENT_MICRO,
    observedAtMs,
  });
  machine.observePayment(requestId, {
    paymentTxId: "PAY-DEMO-001",
    payerId: PAYER_ID,
    amountMicro: GROSS_INSTRUMENT_MICRO,
    authTag: computeSyntheticAuthTag(TEST_ONLY_AUTH_KEY_LITERAL, canonical),
    observedAtMs,
  });
  tick(machine);
  machine.verifyPaymentAuthenticity(requestId);
}

/** §14.4 step 4b — happy settlement finality on the synthetic stablecoin rail. */
function confirmSettled(machine: IssuanceMachine, requestId: string): void {
  tick(machine);
  machine.confirmSettlement(requestId, {
    status: "SETTLED",
    confirmations: 3,
    issuerSanityCheckPassed: true,
    settledAmountMicro: GROSS_INSTRUMENT_MICRO,
    finalityAtMs: machine.nowMs,
    sourceLabel: "SYNTHETIC STABLECOIN RAIL (deterministic demo settlement record — NO REAL RAIL EXISTS)",
  });
}

/** §14.4 steps 5→11 (instrument check → fees → net → ALT-4 authorization → supply → issue → reconcile). */
function driveHappyTail(machine: IssuanceMachine, requestId: string): void {
  tick(machine);
  machine.checkInstrument(requestId);
  tick(machine);
  machine.calculateFees(requestId);
  tick(machine);
  machine.acceptNetValue(requestId);
  tick(machine);
  machine.authorize(requestId);
  tick(machine);
  machine.checkSupply(requestId);
  tick(machine);
  machine.issue(requestId);
  tick(machine);
  machine.reconcile(requestId);
}

interface ScenarioOutcome {
  finalRequestId: string;
  /** The request whose economics carry the scenario's numbers (the original for replays/duplicates). */
  numbersRequestId: string;
  cbdcMessages: unknown[];
}

function driveScenario(scenario: Scenario, machine: IssuanceMachine): ScenarioOutcome {
  const instrument = scenario === "cbdc-simulated" ? TEST_CBDC_INSTRUMENT : TEST_INSTRUMENT;
  const cbdcMessages: unknown[] = [];

  switch (scenario) {
    case "happy-path": {
      setupGovernedActs(machine, instrument);
      driveToPaymentAuthentic(machine, "REQ-DEMO-001", "IDEM-DEMO-001");
      confirmSettled(machine, "REQ-DEMO-001");
      driveHappyTail(machine, "REQ-DEMO-001");
      return { finalRequestId: "REQ-DEMO-001", numbersRequestId: "REQ-DEMO-001", cbdcMessages };
    }
    case "duplicate": {
      setupGovernedActs(machine, instrument);
      // First: a full successful issuance under IDEM-DEMO-001.
      driveToPaymentAuthentic(machine, "REQ-DEMO-001", "IDEM-DEMO-001");
      confirmSettled(machine, "REQ-DEMO-001");
      driveHappyTail(machine, "REQ-DEMO-001");
      // Then: a SECOND request reusing the SAME idempotency key → DUPLICATE (INV-C).
      // The engine never registers a second instance ("never a second execution") —
      // the DUPLICATE transition is recorded in the event log for REQ-DEMO-002.
      machine.submitIssuanceRequest(requestInput("REQ-DEMO-002", "IDEM-DEMO-001", instrument));
      return { finalRequestId: "REQ-DEMO-002", numbersRequestId: "REQ-DEMO-001", cbdcMessages };
    }
    case "delayed-finality": {
      setupGovernedActs(machine, instrument);
      driveToPaymentAuthentic(machine, "REQ-DEMO-001", "IDEM-DEMO-001");
      // Finality arrives AFTER the quote validity window expires (15 min ILLUSTRATIVE TTL).
      machine.advanceClock(QUOTE_POLICY.quoteTtlMs + 60_000);
      machine.confirmSettlement("REQ-DEMO-001", {
        status: "SETTLED",
        confirmations: 3,
        issuerSanityCheckPassed: true,
        settledAmountMicro: GROSS_INSTRUMENT_MICRO,
        finalityAtMs: machine.nowMs,
        sourceLabel: "SYNTHETIC STABLECOIN RAIL (deterministic demo settlement record — NO REAL RAIL EXISTS)",
      });
      machine.processRefundQueue();
      return { finalRequestId: "REQ-DEMO-001", numbersRequestId: "REQ-DEMO-001", cbdcMessages };
    }
    case "failed-payment": {
      setupGovernedActs(machine, instrument);
      driveToPaymentAuthentic(machine, "REQ-DEMO-001", "IDEM-DEMO-001");
      tick(machine);
      machine.confirmSettlement("REQ-DEMO-001", {
        status: "FAILED",
        sourceLabel: "SYNTHETIC STABLECOIN RAIL (deterministic demo settlement record — NO REAL RAIL EXISTS)",
      });
      machine.processRefundQueue();
      return { finalRequestId: "REQ-DEMO-001", numbersRequestId: "REQ-DEMO-001", cbdcMessages };
    }
    case "reversal-pre": {
      setupGovernedActs(machine, instrument);
      driveToPaymentAuthentic(machine, "REQ-DEMO-001", "IDEM-DEMO-001");
      confirmSettled(machine, "REQ-DEMO-001");
      tick(machine);
      machine.checkInstrument("REQ-DEMO-001");
      tick(machine);
      machine.calculateFees("REQ-DEMO-001");
      tick(machine);
      machine.acceptNetValue("REQ-DEMO-001");
      // Reversal notice BEFORE issuance → CANCELLED (adopted decision 3).
      machine.handleReversalNotice(
        "REQ-DEMO-001",
        "SYNTHETIC STABLECOIN RAIL (demo pre-issuance reversal notice)",
      );
      machine.processRefundQueue();
      return { finalRequestId: "REQ-DEMO-001", numbersRequestId: "REQ-DEMO-001", cbdcMessages };
    }
    case "reversal-post": {
      setupGovernedActs(machine, instrument);
      driveToPaymentAuthentic(machine, "REQ-DEMO-001", "IDEM-DEMO-001");
      confirmSettled(machine, "REQ-DEMO-001");
      driveHappyTail(machine, "REQ-DEMO-001");
      // Reversal notice AFTER issuance → RECONCILIATION_BREAK + SUSPENDED (adopted decision 3).
      machine.handleReversalNotice(
        "REQ-DEMO-001",
        "SYNTHETIC STABLECOIN RAIL (demo post-issuance reversal notice)",
      );
      return { finalRequestId: "REQ-DEMO-001", numbersRequestId: "REQ-DEMO-001", cbdcMessages };
    }
    case "unauthorized": {
      // NO program is defined (only the stub attestation is recorded) — the
      // authorization gate must fail on the PROGRAM ENVELOPE (INV-A).
      recordStubAttestation(
        machine,
        "STUB attestation recorded; NO ALT-4 program exists — the payment alone must NOT authorize issuance.",
      );
      driveToPaymentAuthentic(machine, "REQ-DEMO-001", "IDEM-DEMO-001");
      confirmSettled(machine, "REQ-DEMO-001");
      tick(machine);
      machine.checkInstrument("REQ-DEMO-001");
      tick(machine);
      machine.calculateFees("REQ-DEMO-001");
      tick(machine);
      machine.acceptNetValue("REQ-DEMO-001");
      tick(machine);
      machine.authorize("REQ-DEMO-001"); // → UNAUTHORIZED (NO_AUTHORIZATION_PROGRAM)
      return { finalRequestId: "REQ-DEMO-001", numbersRequestId: "REQ-DEMO-001", cbdcMessages };
    }
    case "cbdc-simulated": {
      setupGovernedActs(machine, instrument);
      const adapter = new SimulatedCbdcAdapter({
        adapterId: "SIMULATED-CBDC-ADAPTER-DEMO",
        nowMs: () => machine.nowMs,
      });
      const requestId = "REQ-DEMO-001";
      machine.submitIssuanceRequest(requestInput(requestId, "IDEM-DEMO-001", instrument));
      tick(machine);
      machine.generateQuote(requestId); // SIMULATION-MODE quote admission (row stays NOT_CONNECTED)
      tick(machine);
      const initiatedAtMs = machine.nowMs;
      const initiated = adapter.initiatePayment({
        txId: "CBDC-TX-DEMO-001",
        amountMicro: GROSS_INSTRUMENT_MICRO,
        payerId: PAYER_ID,
        instrumentCode: instrument.code,
        correlationRef: requestId,
      });
      cbdcMessages.push(initiated);
      machine.observePayment(requestId, {
        paymentTxId: "CBDC-TX-DEMO-001",
        payerId: PAYER_ID,
        amountMicro: GROSS_INSTRUMENT_MICRO,
        authTag: initiated.authTag ?? "",
        observedAtMs: initiatedAtMs,
      });
      tick(machine);
      machine.verifyPaymentAuthenticity(requestId);
      tick(machine);
      const settled = adapter.querySettlementStatus("CBDC-TX-DEMO-001");
      cbdcMessages.push(settled);
      machine.confirmSettlement(requestId, {
        status: "SETTLED",
        settledAmountMicro: GROSS_INSTRUMENT_MICRO,
        finalityAtMs: settled.finalityAtMs ?? machine.nowMs,
        sourceLabel: `SIMULATED-CBDC-ADAPTER-DEMO — ${CBDC_ADAPTER_MARKER} (simulated interface finality signal, spec §6.2; NO authorized interface exists)`,
      });
      driveHappyTail(machine, requestId);
      return { finalRequestId: requestId, numbersRequestId: requestId, cbdcMessages };
    }
  }
}

function expectedNumbersCheck(machine: IssuanceMachine, numbersRequestId: string) {
  const inst = machine.getInstanceState(numbersRequestId);
  const events = machine.getEventLog();
  const supply = machine.getSupplySnapshot();
  const quoteObserved =
    [...events]
      .reverse()
      .find((e) => e.requestId === numbersRequestId && e.econ.quote !== "")?.econ.quote ?? null;
  const checks = {
    gross: inst?.grossTUMicro != null ? inst.grossTUMicro === EXPECTED_NUMBERS.gross : null,
    fee: inst?.feeMicro != null ? inst.feeMicro === EXPECTED_NUMBERS.fee : null,
    net: inst?.netTUMicro != null ? inst.netTUMicro === EXPECTED_NUMBERS.net : null,
    quote: quoteObserved != null ? quoteObserved === EXPECTED_NUMBERS.quote : null,
    issued: inst?.issuedMicro != null ? inst.issuedMicro === EXPECTED_NUMBERS.issued : null,
    supplyAfter:
      supply.mintCount > 0
        ? supply.totalSupplyMicro === EXPECTED_NUMBERS.supplyAfterSingleMint
        : null,
  };
  const met = Object.values(checks).every((c) => c === null || c === true);
  return {
    checks,
    met,
    observed: {
      gross: inst?.grossTUMicro ?? null,
      fee: inst?.feeMicro ?? null,
      net: inst?.netTUMicro ?? null,
      quote: quoteObserved,
      issued: inst?.issuedMicro ?? null,
      supplyAfter: supply.totalSupplyMicro,
      mintCount: supply.mintCount,
    },
  };
}

async function runScenario(scenario: Scenario) {
  // SEP separation proof — snapshot BEFORE the run (byte-identity basis).
  const separationBefore = basketSnapshotBytes();

  const machine = buildMachine(scenario);
  const { finalRequestId, numbersRequestId, cbdcMessages } = driveScenario(scenario, machine);

  // SEP separation proof — snapshot AFTER the run.
  const separationAfter = basketSnapshotBytes();

  const events: EventLogEntry[] = machine.getEventLog().map((e) => ({ ...e, econ: { ...e.econ } }));
  const ledger = new IssuanceLedger(machine);
  const view = ledger.view();
  const finalInst = machine.getInstanceState(finalRequestId);
  // A duplicate submission never registers a second instance ("never a second
  // execution") — in that case the terminal state is derived from the last
  // event-log transition recorded for the final request.
  const lastFinalEvent = [...events].reverse().find((e) => e.requestId === finalRequestId && e.to !== null) ?? null;
  const finalState: IssuanceState | "UNKNOWN" =
    finalInst?.state ?? (lastFinalEvent?.to as IssuanceState | undefined) ?? "UNKNOWN";
  const expected = expectedNumbersCheck(machine, numbersRequestId);
  const programs = machine.programs();
  const attestation = machine.currentAttestation();

  // Persist EVERY event to the DB (fail-soft-disclosed).
  const persistence = await ledger.flush(createPrismaIssuanceEventSink());

  return {
    scenario,
    scenarioDescription: SCENARIO_DESCRIPTIONS[scenario],
    machineId: machine.config.machineId,
    clockStartMs: CLOCK_START_MS,
    cbdcSimulationMode: machine.config.cbdcSimulationMode?.enabled ?? false,
    finalRequestId,
    finalState,
    finalStateIsTerminal: finalState !== "UNKNOWN" && isTerminal(finalState),
    terminalReasonCode: finalInst?.terminalReasonCode ?? (finalInst === null ? (lastFinalEvent?.reasonCode ?? null) : null),
    terminalTaxonomyClass:
      finalInst?.terminalTaxonomyClass ?? (finalInst === null ? (lastFinalEvent?.taxonomyClass ?? null) : null),
    pipelineSuspended: machine.pipelineSuspended,
    suspensionReasons: [...machine.suspensionReasons],
    events,
    eventDocs: events.map(mapEventToDoc),
    ledgerView: view,
    mintRecord: view.mints.length > 0 ? view.mints[view.mints.length - 1] : null,
    exceptions: machine.getExceptions(),
    refundQueue: machine.getRefundQueue().map((r) => ({
      refundId: r.refundId,
      requestId: r.requestId,
      paymentTxId: r.paymentTxId,
      idempotencyKey: r.idempotencyKey,
      grossInstrumentAmount: fmt6(r.grossInstrumentAmountMicro),
      reasonCode: r.reasonCode,
      state: r.state,
      createdAtMs: r.createdAtMs,
    })),
    programs: programs.map((p) => ({
      programId: p.programId,
      instruments: p.instruments.map((i) => `${i.code} @ ${i.network}`),
      perTxCap: fmt6(p.perTxCapMicro),
      perProgramCap: fmt6(p.perProgramCapMicro),
      issuedInProgram: fmt6(p.issuedInProgramMicro),
      windowStartMs: p.windowStartMs,
      windowEndMs: p.windowEndMs,
      revoked: p.revoked,
      signedBy: p.signedBy,
      rules: [...p.rules],
      label: p.label,
    })),
    attestation: attestation
      ? {
          attestationId: attestation.attestationId,
          matched: attestation.matched,
          attester: attestation.attester,
          periodMs: attestation.periodMs,
          notes: attestation.notes,
        }
      : null,
    attestationStatus: machine.attestationStatus(),
    separation: {
      label: SEPARATION_CHECK_LABEL,
      byteIdenticalBeforeAfter: basketSnapshotsByteIdentical(separationBefore, separationAfter),
      snapshotBytesLength: separationBefore.length,
      note:
        "basket/constituency snapshot captured READ-ONLY from the methodology modules before and after the run — " +
        "byte-identical proves payment volume never changes basket eligibility or weights (spec §2 separation invariant).",
    },
    expectedNumbers: {
      expected: EXPECTED_NUMBERS,
      checks: expected.checks,
      observed: expected.observed,
      met: expected.met,
    },
    cbdcMessages,
    persistence: {
      written: persistence.written,
      error: persistence.error,
      disclosed:
        persistence.error === null
          ? `all ${persistence.written} events persisted to the IssuanceEvent durability mirror`
          : `DB WRITE FAILED (fail-soft-disclosed): ${persistence.error} — the in-memory event log remains authoritative and the cursor was NOT advanced (retried on the next flush)`,
    },
  };
}

export async function POST(req: Request) {
  try {
    // [16a-003 fix, Task 16-fix-A] Per-IP rate limit on the DEMO runner —
    // dedicated "issuance" bucket, 6 req/IP/min. Every run persists ~14
    // IssuanceEvent rows to the durability mirror (the documented 4th pilot
    // write surface); the unauthenticated hammer is now bounded. The
    // endpoint stays fully functional for the Issuance Lab demo.
    const rl = await rateLimit(getClientIP(req), "issuance");
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)),
            ),
            "X-RateLimit-Remaining": "0",
            ...NO_STORE_HEADERS,
          },
        },
      );
    }
    const body = await req.json().catch(() => ({}));
    const scenario = typeof body.scenario === "string" ? body.scenario : "";
    if (!SCENARIOS.includes(scenario as Scenario)) {
      return NextResponse.json(
        { error: `scenario must be one of [${SCENARIOS.join(", ")}]` },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    const run = await runScenario(scenario as Scenario);
    return NextResponse.json(
      {
        banner: STATUS_BANNER,
        demoDisclaimer: DEMO_DISCLAIMER,
        labels: labelsPayload(),
        run,
        auditNote: AUDIT_NOTE,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (e) {
    // [16a-004-class fix, Task 16-fix-A] Generic error body — no String(e)
    // leakage to the client; full detail stays in the server log.
    console.error("[api/issuance POST] internal error:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
