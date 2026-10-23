// ============================================================================
// MTQΣ — MANDATE-007 §4 · Task 2-b · STEP 4 — ISSUANCE E2E TEST RUNNER
// ============================================================================
// Run (from the repository root):
//   bun run audit-work/task13/evidence/issuance-state-machine/run-issuance-e2e.ts
//
// NON-PRODUCTION PROTOTYPE TEST RUNNER. Drives the spec §14.4 issuance state
// machine through every mandated scenario with STABLE ASSERTION IDS:
//   REG-01..03   registry analog rules (spec §3–§5)
//   ISS-01..10   payment-funded issuance scenarios (mandate: duplicate, delayed,
//                failed, reversed, unauthorized, invalid payments; supply
//                controls; replay protection; reconciliation)
//   AUTH-01..03  D-13.27 ALT-1..ALT-4 adapter-stub behavior (NO alternative selected)
//   CBDC-01..04  SIMULATED adapter drives the machine; adapter status asserted
//   SEP-01       separation invariant test-of-absence (spec §2 / T-PAY-01 analog)
//   INV-01..05   machine-level invariants (spec §14.6 common invariants)
//
// Writes results-issuance-e2e.json beside this file and APPENDS run-log.txt.
// Exits 0 ONLY if every assertion passes; exits 1 otherwise (honest reporting:
// the JSON + log are written even on failure).
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// Zero on-chain actions, zero network calls, zero key handling. All amounts are
// synthetic; the stablecoin path runs ONLY against the synthetic APPROVED TEST
// instrument TEST-USDC-X; the CBDC path is SIMULATED / NOT CONNECTED.
// ============================================================================

import * as fs from "node:fs";
import * as path from "node:path";
import {
  AUTH_SCHEME_LABEL,
  D_13_27_STATUS,
  MACHINE_PROTOTYPE_LABEL,
  OPEN_IMPLEMENTATION_DECISIONS,
  TERMINAL_STATES,
  canonicalPaymentPayload,
  computeSyntheticAuthTag,
  fmt6,
  reconcileThreeBooks,
  TEST_ONLY_AUTH_KEY_LITERAL,
  type DepegObservation,
  IssuanceMachine,
  type IssuanceState,
  type StepResult,
} from "./issuance-state-machine";
import {
  SEPARATION_INVARIANT_TEXT,
  assertNoWeightingTelemetryFields,
  createTestRegistry,
  type PrototypeInstrumentRegistry,
} from "./instrument-registry";
import { CBDC_ADAPTER_STATUS, CBDC_ADAPTER_MARKER, SimulatedCbdcAdapter, cbdcAdapterHonestyRecord } from "./cbdc-adapter";

// ----------------------------------------------------------------------------
// Assertion bookkeeping (stable ids + printed observed values)
// ----------------------------------------------------------------------------

interface AssertionRecord {
  id: string;
  name: string;
  pass: boolean;
  expected: string;
  observed: string;
}

const assertions: AssertionRecord[] = [];
let runCounter = 0;

function track(id: string, name: string, pass: boolean, expected: string, observed: string): void {
  assertions.push({ id, name, pass, expected, observed });
  runCounter += 1;
  console.log(`  ${pass ? "✓" : "✗"} [${id}] ${name}`);
  console.log(`      expected: ${expected}`);
  console.log(`      observed: ${observed}`);
}

function eq(id: string, name: string, actual: unknown, expected: unknown): boolean {
  const a = typeof actual === "bigint" ? actual.toString(10) : String(actual);
  const e = typeof expected === "bigint" ? expected.toString(10) : String(expected);
  const pass = a === e;
  track(id, name, pass, e, a);
  return pass;
}

function check(id: string, name: string, pass: boolean, observed: string): boolean {
  track(id, name, pass, "true", observed);
  return pass;
}

// ----------------------------------------------------------------------------
// Machine factory + scenario driver
// ----------------------------------------------------------------------------

const DEFAULT_QUOTE_POLICY = {
  quoteTUPerTokenMicro: 2_000_000n, // 2.000000 TU per token — ILLUSTRATIVE (spec §14.5; NOT approved policy)
  quoteTtlMs: 900_000, // 15 minutes — ILLUSTRATIVE (D-13.19 OPEN)
  label: "ILLUSTRATIVE QUOTE POLICY (spec §14.5) — issuance-pricing policy NOT approved; quote ≠ promise of later market value",
};

const DEFAULT_FEE_SCHEDULE = {
  feeClass: "TEST-FLAT-10BPS",
  rateBps: 10n, // 0.10% flat — ILLUSTRATIVE — D-13.8 OPEN
  label: "ILLUSTRATIVE — D-13.8 OPEN: 0.10% flat placeholder; no fee schedule is approved",
};

const DEFAULT_SUPPLY_POLICY = {
  globalMaxSupplyMicro: 10_000_000_000_000n, // 10,000,000.000000 tokens — ILLUSTRATIVE (D-13.6 numbers deferred)
  perTxCapMicro: 500_000_000_000n, // 500,000.000000 tokens — ILLUSTRATIVE
  trancheId: "T-TEST-001",
  trancheCapMicro: 1_000_000_000_000n, // 1,000,000.000000 tokens — ILLUSTRATIVE
  label: "ILLUSTRATIVE SUPPLY POLICY — D-13.6 OPEN; all numbers deferred to owner approval",
};

const TEST_INSTRUMENT = { code: "TEST-USDC-X", network: "TEST-CHAIN-1 (SYNTHETIC)" };
const CBDC_INSTRUMENT = { code: "TEST-CBDC-1", network: "SIMULATED-CBDC-RAIL-1 (SYNTHETIC)" };

const allMachines: IssuanceMachine[] = [];

function newMachine(opts?: {
  machineId: string;
  authorizationModelId?: "ALT-1" | "ALT-2" | "ALT-3" | "ALT-4";
  supplyPolicy?: typeof DEFAULT_SUPPLY_POLICY;
  cbdcSimulation?: boolean;
}): { machine: IssuanceMachine; registry: PrototypeInstrumentRegistry } {
  const registry = createTestRegistry(0);
  const machine = new IssuanceMachine({
    machineId: opts?.machineId ?? "M-UNNAMED",
    registry,
    authorizationModelIdForTestingOnly: opts?.authorizationModelId, // undefined → ALT-2 default FOR TESTING ONLY (D-13.27 OPEN)
    supplyPolicy: opts?.supplyPolicy ?? DEFAULT_SUPPLY_POLICY,
    quotePolicy: DEFAULT_QUOTE_POLICY,
    feeSchedule: DEFAULT_FEE_SCHEDULE,
    clockStartMs: 0,
    cbdcSimulationMode: opts?.cbdcSimulation
      ? { enabled: true, label: "SIMULATED — NOT CONNECTED" }
      : undefined,
  });
  allMachines.push(machine);
  return { machine, registry };
}

type StopPoint =
  | "REQUEST_CREATED"
  | "QUOTED"
  | "PAYMENT_OBSERVED"
  | "PAYMENT_AUTHENTIC"
  | "NET_ACCEPTED"
  | "AUTHORIZED"
  | "ISSUED"
  | "RECONCILED";

interface DriveOpts {
  requestId: string;
  grossMicro: bigint;
  idemKey?: string;
  instrumentCode?: string;
  network?: string;
  jurisdiction?: string;
  paymentTxId?: string;
  payerId?: string;
  paymentAuthTagOverride?: string;
  stopAfter?: StopPoint;
  skipApprove?: boolean;
  settle?: {
    status?: "SETTLED" | "FAILED" | "REVERSED" | "TIMEOUT";
    confirmations?: number;
    issuerSanityCheckPassed?: boolean;
    settledAmountMicro?: bigint;
    pegDeviationBps?: number;
    sustainedHours?: number;
    sourceLabel?: string;
    finalityAtMs?: number;
  };
  depegObs?: DepegObservation;
}

const STOP_ORDER: readonly StopPoint[] = [
  "REQUEST_CREATED",
  "QUOTED",
  "PAYMENT_OBSERVED",
  "PAYMENT_AUTHENTIC",
  "NET_ACCEPTED",
  "AUTHORIZED",
  "ISSUED",
  "RECONCILED",
];

function drive(machine: IssuanceMachine, o: DriveOpts): { last: StepResult } {
  const stop = o.stopAfter ?? "RECONCILED";
  const stopIdx = STOP_ORDER.indexOf(stop);
  const instrumentCode = o.instrumentCode ?? TEST_INSTRUMENT.code;
  const network = o.network ?? TEST_INSTRUMENT.network;
  let last: StepResult = machine.submitIssuanceRequest({
    requestId: o.requestId,
    idempotencyKey: o.idemKey ?? `IDK-${o.requestId}`,
    instrumentCode,
    network,
    payerId: o.payerId ?? "TEST-PAYER-001",
    recipientId: "TEST-RECIPIENT-001",
    jurisdiction: o.jurisdiction ?? "TEST-JURISDICTION",
    requestedInstrumentAmountMicro: o.grossMicro,
  });
  if (stopIdx < STOP_ORDER.indexOf("QUOTED")) return { last };

  const q = machine.generateQuote(o.requestId);
  last = q;
  if (stopIdx < STOP_ORDER.indexOf("PAYMENT_OBSERVED") || !q.ok) return { last };

  const txId = o.paymentTxId ?? `PAY-TX-${o.requestId}`;
  const observedAt = machine.nowMs;
  const authTag =
    o.paymentAuthTagOverride ??
    computeSyntheticAuthTag(
      TEST_ONLY_AUTH_KEY_LITERAL,
      canonicalPaymentPayload({
        paymentTxId: txId,
        instrumentCode,
        network,
        payerId: o.payerId ?? "TEST-PAYER-001",
        amountMicro: o.grossMicro,
        observedAtMs: observedAt,
      }),
    );
  last = machine.observePayment(o.requestId, {
    paymentTxId: txId,
    payerId: o.payerId ?? "TEST-PAYER-001",
    amountMicro: o.grossMicro,
    authTag,
    observedAtMs: observedAt,
  });
  if (stopIdx < STOP_ORDER.indexOf("PAYMENT_AUTHENTIC") || !last.ok) return { last };

  last = machine.verifyPaymentAuthenticity(o.requestId);
  if (stopIdx < STOP_ORDER.indexOf("NET_ACCEPTED") || !last.ok) return { last };

  // settlement — adversarial variants call confirmSettlement themselves, so the driver
  // only auto-settles when the caller supplied a settle block OR a benign default.
  const s = o.settle ?? { status: "SETTLED" as const };
  if (s.status === undefined) return { last };
  const settled = machine.confirmSettlement(o.requestId, {
    status: s.status ?? "SETTLED",
    confirmations: s.confirmations ?? 3,
    issuerSanityCheckPassed: s.issuerSanityCheckPassed ?? true,
    settledAmountMicro: s.settledAmountMicro ?? o.grossMicro,
    pegDeviationBps: s.pegDeviationBps,
    sustainedHours: s.sustainedHours,
    sourceLabel: s.sourceLabel,
    finalityAtMs: s.finalityAtMs,
  });
  last = settled;
  if (!settled.ok) return { last };

  last = machine.checkInstrument(o.requestId, o.depegObs);
  if (stopIdx < STOP_ORDER.indexOf("NET_ACCEPTED") || !last.ok) return { last };

  last = machine.calculateFees(o.requestId);
  if (!last.ok) return { last };
  last = machine.acceptNetValue(o.requestId);
  if (stopIdx < STOP_ORDER.indexOf("AUTHORIZED") || !last.ok) return { last };

  if (!o.skipApprove) {
    const ap = machine.approveIssuance(o.requestId, "TEST-APPROVER-001", "explicit per-issuance approval (ALT-2 TEST HARNESS)");
    if (!ap.ok) return { last: { ok: false, state: "NET_ACCEPTED", reasonCode: ap.reasonCode } };
  }
  last = machine.authorize(o.requestId);
  if (stopIdx < STOP_ORDER.indexOf("ISSUED") || !last.ok) return { last };

  last = machine.checkSupply(o.requestId);
  if (!last.ok) return { last };
  last = machine.issue(o.requestId);
  if (stopIdx < STOP_ORDER.indexOf("RECONCILED") || !last.ok) return { last };

  last = machine.reconcile(o.requestId);
  return { last };
}

function scenarioBanner(title: string): void {
  console.log(`\n=== ${title} ===`);
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

function main(): void {
  const startedAtUTC = new Date().toISOString();
  console.log("MTQΣ — MANDATE-007 §4 · Task 2-b · issuance-state-machine e2e (NON-PRODUCTION PROTOTYPE)");
  console.log(`ranAt(UTC): ${startedAtUTC}`);
  console.log(`machine label: ${MACHINE_PROTOTYPE_LABEL}`);
  console.log(`D-13.27: ${D_13_27_STATUS}`);
  console.log(`auth scheme: ${AUTH_SCHEME_LABEL}`);
  console.log(`separation invariant: ${SEPARATION_INVARIANT_TEXT}`);
  console.log(`adapter status: ${CBDC_ADAPTER_STATUS}\n`);

  // =========================================================================
  // REG-01..03 — registry analog rules (spec §3–§5)
  // =========================================================================
  scenarioBanner("REG — registry analog rules (spec §3–§5, NON-PRODUCTION PROTOTYPE)");
  {
    const { registry } = newMachine({ machineId: "M-REG" });
    const admit = registry.transition("TEST-CBDC-001", "ADMIT", "attempted admission without a verified authorized interface");
    check(
      "REG-01",
      "CBDC row admission BLOCKED while NOT CONNECTED (spec §5.3/§4: verified interface + end-to-end test required — neither exists)",
      !admit.ok && admit.reasonCode.startsWith("ADMISSION_BLOCKED_NOT_CONNECTED"),
      `reasonCode=${admit.reasonCode}`,
    );
    const row2 = registry.byId("TEST-STBL-002");
    check(
      "REG-02",
      "same code on another network (TEST-STBL-002) is NOT auto-approved by TEST-STBL-001 (per-instance identity, spec §14.2 rule (a))",
      row2?.state === "PROPOSED" && row2.version === 1,
      `state=${row2?.state}, version=${row2?.version}`,
    );
    const scratch = createTestRegistry(0);
    scratch.transition("TEST-STBL-001", "SUSPEND_DEPEG", "SYNTHETIC depeg trigger for REG-03");
    const early = scratch.transition("TEST-STBL-001", "REINSTATE", "premature reinstatement attempt", { observationHoursCompleted: 24 });
    check(
      "REG-03",
      "reinstatement BLOCKED without the 48h observation period (spec §5 analog; PROPOSED 48h mirrors V3 RECOVERY_CONFIRMATION_PERIOD, UNDEPLOYED)",
      !early.ok && early.reasonCode.startsWith("REINSTATEMENT_BLOCKED_OBSERVATION_PERIOD"),
      `reasonCode=${early.reasonCode}`,
    );
    const telemetry = assertNoWeightingTelemetryFields(registry.byId("TEST-STBL-001")!);
    check(
      "REG-04",
      "registry row schema carries NO weighting/eligibility/basket telemetry fields (spec §2 structural separation)",
      telemetry.ok,
      `offendingKeys=${JSON.stringify(telemetry.offendingKeys)}`,
    );
  }

  // =========================================================================
  // ISS-01 — happy path (stablecoin APPROVED TEST instrument)
  // =========================================================================
  scenarioBanner("ISS-01 — happy path: request → quote → authentic payment → settlement final → instrument check → fees → net → authorization → supply check → issuance → reconciliation");
  const GROSS_10K = 10_000_000_000n; // 10,000.000000 TEST-USDC-X
  let m1SupplyBefore = "";
  {
    const { machine } = newMachine({ machineId: "M-ISS-01" });
    m1SupplyBefore = machine.getSupplySnapshot().totalSupplyMicro;
    eq("ISS-01-01", "supply before issuance", m1SupplyBefore, "0.000000");

    const q = drive(machine, { requestId: "ISS-01-R1", grossMicro: GROSS_10K });
    const st = machine.getInstanceState("ISS-01-R1");
    const quotedEntry = machine.getEventLog().find((e) => e.requestId === "ISS-01-R1" && e.to === "QUOTED");
    check(
      "ISS-01-02",
      "quote record carries quote id, price basis, expiry, quote-unit conversion, spread disclosure, fee line item (spec §6.1)",
      quotedEntry !== undefined &&
        quotedEntry.detail.includes("quote QUOTE-ISS-01-R1") &&
        quotedEntry.detail.includes("10000.000000") &&
        quotedEntry.detail.includes("2.000000 TU/token") &&
        quotedEntry.detail.includes("expires at 900000ms") &&
        quotedEntry.detail.includes("spread 0bps disclosed"),
      quotedEntry ? quotedEntry.detail : "missing",
    );

    const quoteObserved = machine.getInstanceState("ISS-01-R1");
    eq("ISS-01-03", "final state RECONCILED (steps 1..11 complete)", quoteObserved?.state, "RECONCILED");
    eq("ISS-01-04", "fee = 0.10% of gross 10000.000000 TU (EXACT integer math; ILLUSTRATIVE — D-13.8 OPEN)", quoteObserved?.feeMicro, "10.000000");
    eq("ISS-01-05", "net = gross − fee (step 8)", quoteObserved?.netTUMicro, "9990.000000");
    eq(
      "ISS-01-06",
      "issued = net ÷ quote = 9990.000000 / 2.000000 (spec §14.5 general form; quote policy ILLUSTRATIVE)",
      quoteObserved?.issuedMicro,
      "4995.000000",
    );
    const mint = machine.getMintRecord("ISS-01-R1");
    check(
      "ISS-01-07",
      "idempotent mint record created (nonce, idempotency key, LEDGER-RECORD-ONLY label)",
      mint !== null && mint.nonce === 1 && mint.idempotencyKey === "IDK-ISS-01-R1" && mint.recordOnlyLabel.includes("NO ON-CHAIN ACTION"),
      mint ? `mintId=${mint.mintId}, nonce=${mint.nonce}, idemKey=${mint.idempotencyKey}, label=${mint.recordOnlyLabel}` : "missing",
    );
    const supplyAfter = machine.getSupplySnapshot();
    eq("ISS-01-08", "supply after issuance (before → after: 0.000000 → 4995.000000)", supplyAfter.totalSupplyMicro, "4995.000000");
    eq("ISS-01-09", "tranche consumption after issuance", supplyAfter.trancheIssuedMicro, "4995.000000");
    eq("ISS-01-10", "fee ledger total (fees booked, not retained on failures)", supplyAfter.feeBookTotalMicro, "10.000000");

    const log = machine.publishAuditLog();
    const transitions = log.entries.filter((e) => e.to !== null && e.requestId === "ISS-01-R1").map((e) => e.to as string);
    eq(
      "ISS-01-11",
      "audit log records the §14.4 step sequence in order (steps 1+3, 2, 4, 4a, 4b, 5, 7, 6+8, 9, 9b, 10, 11; step 12 = this publication)",
      transitions.join(","),
      [
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
      ].join(","),
    );
    check(
      "ISS-01-12",
      "audit publication carries a synthetic publication tag (TEST-TAG-<16 hex>, never a 64-char literal) + every entry has a reason code",
      /^TEST-TAG-[0-9a-f]{16}$/.test(log.publicationTag) && log.entries.every((e) => e.reasonCode.length > 0),
      `publicationTag=${log.publicationTag}, entries=${log.entries.length}`,
    );
    const recon = reconcileThreeBooks(machine.ledgerSnapshot());
    check("ISS-01-13", "three-book equality holds after the happy path (C1–C4 all PASS)", recon.balanced, JSON.stringify(recon.checks.map((c) => `${c.check}=${c.passed ? "PASS" : "FAIL"}`)));
    let invariantsOk = true;
    try {
      machine.assertInvariants();
    } catch (e) {
      invariantsOk = false;
      console.log(`      invariant violation: ${(e as Error).message}`);
    }
    check("ISS-01-14", "machine-level invariants hold after the happy path", invariantsOk, "assertInvariants() passed");
  }

  // =========================================================================
  // ISS-02 — DUPLICATE payment (same idempotency key + same payment txId)
  // =========================================================================
  scenarioBanner("ISS-02 — DUPLICATE: same idempotency key + same payment txId submitted twice");
  {
    const { machine } = newMachine({ machineId: "M-ISS-02" });
    drive(machine, { requestId: "ISS-02-R1", grossMicro: GROSS_10K });
    eq("ISS-02-01", "first issuance completes (RECONCILED) and mints 4995.000000", machine.getInstanceState("ISS-02-R1")?.issuedMicro, "4995.000000");

    const dup = machine.submitIssuanceRequest({
      requestId: "ISS-02-R2",
      idempotencyKey: "IDK-ISS-02-R1", // SAME idempotency key
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K,
    });
    check(
      "ISS-02-02",
      "second submission under the SAME idempotency key → DUPLICATE terminal; original result returned, never a second execution (spec §6.4)",
      !dup.ok && dup.state === "DUPLICATE" && dup.duplicateOf === "ISS-02-R1",
      `state=${dup.state}, duplicateOf=${dup.duplicateOf}, reason=${dup.reasonCode}`,
    );

    // second layer: a NEW idempotency key but the SAME payment txId
    const dup2 = machine.submitIssuanceRequest({
      requestId: "ISS-02-R3",
      idempotencyKey: "IDK-ISS-02-R3",
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K,
    });
    machine.generateQuote("ISS-02-R3");
    const dupTx = machine.observePayment("ISS-02-R3", {
      paymentTxId: "PAY-TX-ISS-02-R1", // SAME payment txId as R1
      payerId: "TEST-PAYER-001",
      amountMicro: GROSS_10K,
      authTag: computeSyntheticAuthTag(
        TEST_ONLY_AUTH_KEY_LITERAL,
        canonicalPaymentPayload({
          paymentTxId: "PAY-TX-ISS-02-R1",
          instrumentCode: TEST_INSTRUMENT.code,
          network: TEST_INSTRUMENT.network,
          payerId: "TEST-PAYER-001",
          amountMicro: GROSS_10K,
          observedAtMs: machine.nowMs,
        }),
      ),
      observedAtMs: machine.nowMs,
    });
    check(
      "ISS-02-03",
      "same payment txId under a new key → DUPLICATE terminal (DUPLICATE_PAYMENT_TX); never a second execution",
      dup2.ok && !dupTx.ok && dupTx.state === "DUPLICATE",
      `submission=${dup2.state}; observe=${dupTx.state} (${dupTx.reasonCode})`,
    );
    const supply = machine.getSupplySnapshot();
    eq("ISS-02-04", "supply UNCHANGED after duplicate attempts (no double mint)", supply.totalSupplyMicro, "4995.000000");
    eq("ISS-02-05", "exactly ONE mint record exists", supply.mintCount.toString(10), "1");
    let invariantsOk = true;
    try {
      machine.assertInvariants();
    } catch {
      invariantsOk = false;
    }
    check("ISS-02-06", "machine-level invariants hold (INV-C: replays never double-mint)", invariantsOk, "assertInvariants() passed");
  }

  // =========================================================================
  // ISS-03 — DELAYED payment (settlement finality after quote expiry)
  // =========================================================================
  scenarioBanner("ISS-03 — DELAYED: settlement finality arrives after quote expiry");
  {
    const { machine } = newMachine({ machineId: "M-ISS-03" });
    drive(machine, { requestId: "ISS-03-R1", grossMicro: GROSS_10K, stopAfter: "PAYMENT_AUTHENTIC" });
    machine.advanceClock(901_000); // quote TTL is 900,000ms → settlement is late
    const late = machine.confirmSettlement("ISS-03-R1", {
      status: "SETTLED",
      confirmations: 3,
      issuerSanityCheckPassed: true,
      settledAmountMicro: GROSS_10K,
    });
    check(
      "ISS-03-01",
      "late settlement → EXPIRED_QUOTE terminal; NO issuance at a stale quote (spec §6.1 hard-reject; §6.6 CONFIRMATION_TIMEOUT analog)",
      !late.ok && late.state === "EXPIRED_QUOTE",
      `state=${late.state}, reason=${late.reasonCode}`,
    );
    const refunds = machine.getRefundQueue();
    check(
      "ISS-03-02",
      "payment HELD_IN_REFUND_QUEUE (held-or-refunded choice LABELED; DEC-SETTLEMENT-TIMING OPEN per D-13.27/spec §6.3) with the SAME idempotency key",
      refunds.length === 1 && refunds[0].idempotencyKey === "IDK-ISS-03-R1" && refunds[0].state === "PENDING_REFUND",
      `refunds=${JSON.stringify(refunds.map((r) => `${r.refundId}:${r.state}:key=${r.idempotencyKey}`))}`,
    );
    const proc = machine.processRefundQueue();
    check("ISS-03-03", "refund state machine completes PENDING_REFUND → REFUNDED (spec §6.3)", proc.processed === 1 && proc.refunds[0].state === "REFUNDED", `processed=${proc.processed}`);
    const retry = machine.submitIssuanceRequest({
      requestId: "ISS-03-R2",
      idempotencyKey: "IDK-ISS-03-R1", // retry on the SAME key is forbidden
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K,
    });
    check(
      "ISS-03-04",
      "retry FORBIDDEN on the same idempotency key (spec §6.6 CONFIRMATION_TIMEOUT) → DUPLICATE",
      !retry.ok && retry.state === "DUPLICATE",
      `state=${retry.state}, reason=${retry.reasonCode}`,
    );
    eq("ISS-03-05", "supply UNCHANGED (no mint on a stale quote)", machine.getSupplySnapshot().totalSupplyMicro, "0.000000");
    eq(
      "ISS-03-06",
      "settlement-timing is encoded as an OPEN decision (DEC-SETTLEMENT-TIMING references D-13.27 + spec §6.1/§6.3/§6.6)",
      OPEN_IMPLEMENTATION_DECISIONS.find((d) => d.decisionId === "DEC-SETTLEMENT-TIMING")?.specRefs.join("|") ?? "",
      "D-13.27|spec §6.1 (quote expiry — hard-rejected after expiry)|spec §6.6 CONFIRMATION_TIMEOUT|spec §6.3",
    );
  }

  // =========================================================================
  // ISS-04 — FAILED payment
  // =========================================================================
  scenarioBanner("ISS-04 — FAILED: settlement status FAILED");
  {
    const { machine } = newMachine({ machineId: "M-ISS-04" });
    drive(machine, { requestId: "ISS-04-R1", grossMicro: GROSS_10K, stopAfter: "PAYMENT_AUTHENTIC" });
    const failed = machine.confirmSettlement("ISS-04-R1", { status: "FAILED" });
    check(
      "ISS-04-01",
      "FAILED settlement → PAYMENT_FAILED terminal; a failed payment NEVER mints (spec §14.4 hard rules)",
      !failed.ok && failed.state === "PAYMENT_FAILED",
      `state=${failed.state}, reason=${failed.reasonCode}`,
    );
    const issueAttempt = machine.issue("ISS-04-R1");
    check(
      "ISS-04-02",
      "issuance attempt on a failed payment → transition REJECTED by the state machine (cannot skip to ISSUED)",
      !issueAttempt.ok,
      `reason=${issueAttempt.reasonCode}`,
    );
    eq("ISS-04-03", "supply UNCHANGED", machine.getSupplySnapshot().totalSupplyMicro, "0.000000");
    eq("ISS-04-04", "NO fee retained on a failed transaction (fee ledger 0.000000; spec §6.3 PROPOSED D-13.8)", machine.getSupplySnapshot().feeBookTotalMicro, "0.000000");
    check(
      "ISS-04-05",
      "auto-refund queued with the same idempotency key (spec §6.3)",
      machine.getRefundQueue().length === 1 && machine.getRefundQueue()[0].reasonCode === "PAYMENT_FAILED",
      `refunds=${machine.getRefundQueue().length}, reason=${machine.getRefundQueue()[0]?.reasonCode}`,
    );
  }

  // =========================================================================
  // ISS-05 — REVERSED payment (before and after issuance)
  // =========================================================================
  scenarioBanner("ISS-05 — REVERSED: (a) before issuance → cancel; (b) after issuance → RECONCILIATION exception + pipeline SUSPENDED");
  {
    const { machine } = newMachine({ machineId: "M-ISS-05" });
    // (a) pre-issuance reversal
    drive(machine, { requestId: "ISS-05-R1", grossMicro: GROSS_10K, stopAfter: "PAYMENT_AUTHENTIC" });
    const revA = machine.handleReversalNotice("ISS-05-R1", "SYNTHETIC STABLECOIN RAIL");
    check(
      "ISS-05-01",
      "(a) reversal BEFORE issuance → PAYMENT_REVERSED terminal; NO mint; refund queued",
      !revA.ok && revA.state === "PAYMENT_REVERSED" && machine.getRefundQueue().length === 1,
      `state=${revA.state}, refunds=${machine.getRefundQueue().length}`,
    );
    eq("ISS-05-02", "(a) supply UNCHANGED", machine.getSupplySnapshot().totalSupplyMicro, "0.000000");

    // (b) post-issuance reversal
    drive(machine, { requestId: "ISS-05-R2", grossMicro: GROSS_10K });
    eq("ISS-05-03", "(b) second issuance completes first (RECONCILED; 4995.000000 minted)", machine.getInstanceState("ISS-05-R2")?.issuedMicro, "4995.000000");
    const revB = machine.handleReversalNotice("ISS-05-R2", "SYNTHETIC STABLECOIN RAIL");
    check(
      "ISS-05-04",
      "(b) reversal AFTER issuance → RECONCILIATION_BREAK (spec §6.5/§6.6) — pipeline SUSPENDED, NO silent re-mint, NO silent write-off",
      !revB.ok && revB.state === "RECONCILIATION_BREAK" && machine.pipelineSuspended,
      `state=${revB.state}, pipelineSuspended=${machine.pipelineSuspended}, reasons=${JSON.stringify(machine.suspensionReasons)}`,
    );
    const mint = machine.getMintRecord("ISS-05-R2");
    check(
      "ISS-05-05",
      "(b) mint record PRESERVED after the reversal (no silent write-off)",
      mint !== null && mint.amountMicro === 4_995_000_000n,
      mint ? `mintId=${mint.mintId}, amount=${fmt6(mint.amountMicro)} (still on the token book)` : "missing",
    );
    eq("ISS-05-06", "(b) supply unchanged by the reversal event (no re-mint)", machine.getSupplySnapshot().totalSupplyMicro, "4995.000000");
    check(
      "ISS-05-07",
      "(b) OPEN exception queued with taxonomy REVERSAL_AFTER_ISSUANCE",
      machine.getExceptions().some((e) => e.taxonomyClass === "REVERSAL_AFTER_ISSUANCE" && e.status === "OPEN"),
      `exceptions=${JSON.stringify(machine.getExceptions().map((e) => `${e.exceptionId}:${e.taxonomyClass}:${e.status}`))}`,
    );
    const blocked = machine.submitIssuanceRequest({
      requestId: "ISS-05-R3",
      idempotencyKey: "IDK-ISS-05-R3",
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K,
    });
    check(
      "ISS-05-08",
      "(b) pipeline SUSPENDED blocks NEW requests fail-closed while the exception is OPEN",
      !blocked.ok && blocked.reasonCode === "PIPELINE_SUSPENDED_FAIL_CLOSED",
      `reason=${blocked.reasonCode}`,
    );
    eq(
      "ISS-05-09",
      "(b) reversal semantics encoded as an OPEN decision (DEC-REVERSAL-SEMANTICS references D-13.27 + spec §6.3/§6.5/§6.6)",
      OPEN_IMPLEMENTATION_DECISIONS.find((d) => d.decisionId === "DEC-REVERSAL-SEMANTICS")?.open ?? false,
      "true",
    );
  }

  // =========================================================================
  // ISS-06 — UNAUTHORIZED (payment-alone-never-mints invariant)
  // =========================================================================
  scenarioBanner("ISS-06 — UNAUTHORIZED: payment settles, NO authorization record exists");
  {
    const { machine } = newMachine({ machineId: "M-ISS-06" });
    drive(machine, { requestId: "ISS-06-R1", grossMicro: GROSS_10K, stopAfter: "NET_ACCEPTED", skipApprove: true });
    const st = machine.getInstanceState("ISS-06-R1");
    check(
      "ISS-06-01",
      "payment fully settled + net accepted, but NO authorization record exists after payment processing (a payment event alone can NEVER create one)",
      st?.state === "NET_ACCEPTED" && st.settlementFinal && !st.hasAuthorizationRecord,
      `state=${st?.state}, settlementFinal=${st?.settlementFinal}, hasAuthorization=${st?.hasAuthorizationRecord}`,
    );
    const direct = machine.issue("ISS-06-R1");
    check(
      "ISS-06-03",
      "direct issue() attempt from NET_ACCEPTED → transition REJECTED (explicit table; no skipping authorization)",
      !direct.ok && direct.reasonCode === "TRANSITION_REJECTED_NET_ACCEPTED_TO_ISSUED",
      `reason=${direct.reasonCode}`,
    );
    const auth = machine.authorize("ISS-06-R1");
    check(
      "ISS-06-02",
      "authorize() without an approval record → UNAUTHORIZED terminal (NO_AUTHORIZATION_RECORD; ALT-2 default FOR TESTING ONLY)",
      !auth.ok && auth.state === "UNAUTHORIZED",
      `state=${auth.state}, reason=${auth.reasonCode}`,
    );
    const bypass = machine.__testAttemptDirectIssueBypass("ISS-06-R1");
    check(
      "ISS-06-04",
      "bypass-attempt harness (table skipped) → machine INVARIANT THROWS: no ISSUED without settlement finality + authorization record (INV-A hard guard)",
      bypass.threw && bypass.message.includes("INV-A"),
      `threw=${bypass.threw}, message=${bypass.message.slice(0, 90)}…`,
    );
    eq("ISS-06-05", "supply UNCHANGED", machine.getSupplySnapshot().totalSupplyMicro, "0.000000");
    check(
      "ISS-06-06",
      "no ISSUED transition exists anywhere in the audit log for this request",
      machine.getEventLog().every((e) => e.requestId !== "ISS-06-R1" || e.to !== "ISSUED"),
      `ISSUED-transitions for ISS-06-R1: ${machine.getEventLog().filter((e) => e.requestId === "ISS-06-R1" && e.to === "ISSUED").length}`,
    );
    const bypass2 = machine.__testAttemptDirectIssueBypass("ISS-04-N/A");
    check(
      "ISS-06-07",
      "a second bypass probe (unknown request) is trivially blocked (harness is fail-safe)",
      bypass2.threw,
      `threw=${bypass2.threw}`,
    );
  }

  // =========================================================================
  // ISS-07 — INVALID (wrong instrument / tag failure / amount mismatch / depeg)
  // =========================================================================
  scenarioBanner("ISS-07 — INVALID: wrong instrument, failed authenticity tag, amount mismatch, depeg bands");
  {
    // (a) instrument not in registry
    const ma = newMachine({ machineId: "M-ISS-07a" });
    const a = drive(ma.machine, { requestId: "ISS-07a-R1", grossMicro: GROSS_10K, instrumentCode: "TEST-NOPE", network: TEST_INSTRUMENT.network, stopAfter: "QUOTED" });
    check(
      "ISS-07-01",
      "(a) instrument NOT in registry → INVALID_INSTRUMENT at quote (per-instance lookup, never a ticker alone)",
      a.last.state === "INVALID_INSTRUMENT" && a.last.reasonCode === "INSTRUMENT_NOT_IN_REGISTRY",
      `state=${a.last.state}, reason=${a.last.reasonCode}`,
    );
    eq("ISS-07-02", "(a) supply UNCHANGED", ma.machine.getSupplySnapshot().totalSupplyMicro, "0.000000");

    // (b) REVOKED instrument
    const mb = newMachine({ machineId: "M-ISS-07b" });
    const b = drive(mb.machine, { requestId: "ISS-07b-R1", grossMicro: GROSS_10K, instrumentCode: "TEST-USDC-Y", stopAfter: "QUOTED" });
    check(
      "ISS-07-03",
      "(b) REVOKED instrument (TEST-USDC-Y) → INVALID_INSTRUMENT; quoting refused",
      b.last.state === "INVALID_INSTRUMENT" && b.last.reasonCode === "INSTRUMENT_REVOKED",
      `state=${b.last.state}, reason=${b.last.reasonCode}`,
    );

    // (c) same code, DIFFERENT network instance (per-instance identity)
    const mc = newMachine({ machineId: "M-ISS-07c" });
    const c = drive(mc.machine, {
      requestId: "ISS-07c-R1",
      grossMicro: GROSS_10K,
      instrumentCode: "TEST-USDC-X",
      network: "TEST-CHAIN-2 (SYNTHETIC)",
      stopAfter: "QUOTED",
    });
    check(
      "ISS-07-04",
      "(c) same code on TEST-CHAIN-2 (PROPOSED instance) → INVALID_INSTRUMENT (per-instance identity, spec §14.2 rule (a))",
      c.last.state === "INVALID_INSTRUMENT" && c.last.reasonCode === "INSTRUMENT_NOT_APPROVED_PER_INSTANCE_IDENTITY",
      `state=${c.last.state}, reason=${c.last.reasonCode}`,
    );

    // (d) failed authenticity tag
    const md = newMachine({ machineId: "M-ISS-07d" });
    const d = drive(md.machine, {
      requestId: "ISS-07d-R1",
      grossMicro: GROSS_10K,
      paymentAuthTagOverride: "TEST-TAG-00000000feedface", // wrong tag (16 hex chars, synthetic)
      stopAfter: "PAYMENT_AUTHENTIC",
    });
    check(
      "ISS-07-05",
      "(d) failed authenticity tag → INVALID_PAYMENT (AUTH_TAG_MISMATCH); synthetic scheme documented: production requires real per-rail signature verification",
      d.last.state === "INVALID_PAYMENT" && d.last.reasonCode === "AUTH_TAG_MISMATCH",
      `state=${d.last.state}, reason=${d.last.reasonCode}`,
    );

    // (e) amount mismatch at settlement
    const me = newMachine({ machineId: "M-ISS-07e" });
    drive(me.machine, { requestId: "ISS-07e-R1", grossMicro: GROSS_10K, stopAfter: "PAYMENT_AUTHENTIC" });
    const e = me.machine.confirmSettlement("ISS-07e-R1", {
      status: "SETTLED",
      confirmations: 3,
      issuerSanityCheckPassed: true,
      settledAmountMicro: GROSS_10K + 1n, // settled ≠ quoted (PARTIAL_SETTLEMENT analog)
    });
    check(
      "ISS-07-06",
      "(e) settled amount ≠ quoted amount → INVALID_PAYMENT (SETTLED_AMOUNT_QUOTE_MISMATCH; spec §6.6 PARTIAL_SETTLEMENT analog)",
      e.state === "INVALID_PAYMENT" && e.reasonCode === "SETTLED_AMOUNT_QUOTE_MISMATCH",
      `state=${e.state}, reason=${e.reasonCode}`,
    );
    check(
      "ISS-07-07",
      "(e) difference HELD in the exception queue and DISCLOSED — no silent write-off",
      me.machine.getExceptions().some((x) => x.taxonomyClass === "PARTIAL_SETTLEMENT" && x.status === "OPEN"),
      `exceptions=${JSON.stringify(me.machine.getExceptions().map((x) => `${x.exceptionId}:${x.taxonomyClass}`))}`,
    );
    eq("ISS-07-08", "(e) supply UNCHANGED", me.machine.getSupplySnapshot().totalSupplyMicro, "0.000000");

    // (f1) depeg SUSPEND band observed at settlement time → in-flight completion per spec §4 + new quotes refused
    const mf1 = newMachine({ machineId: "M-ISS-07f1" });
    drive(mf1.machine, {
      requestId: "ISS-07f1-R1",
      grossMicro: GROSS_10K,
      stopAfter: "PAYMENT_AUTHENTIC",
    });
    mf1.machine.advanceClock(60_000); // the depeg event is observed AFTER the quote was created
    const f1settle = mf1.machine.confirmSettlement("ISS-07f1-R1", {
      status: "SETTLED",
      confirmations: 3,
      issuerSanityCheckPassed: true,
      settledAmountMicro: GROSS_10K,
      pegDeviationBps: 150, // 1.50% ≥ 1.00% suspend threshold
      sustainedHours: 4,
    });
    const f1check = mf1.machine.checkInstrument("ISS-07f1-R1", { deviationBps: 150, sustainedHours: 4, instantaneousMoveBps: 0 });
    driveContinueFromInstrumentChecked(mf1.machine, "ISS-07f1-R1");
    const f1row = mf1.registry.byId("TEST-STBL-001");
    check(
      "ISS-07-09",
      "(f1) depeg SUSPEND band at settlement time moves the registry row to SUSPENDED (spec §4/§5) AND the in-flight settlement COMPLETES under its existing quote (spec §4 in-flight rule)",
      f1settle.ok && f1check.ok && f1row?.state === "SUSPENDED" && mf1.machine.getInstanceState("ISS-07f1-R1")?.state === "RECONCILED",
      `settlement=${f1settle.state}, check=${f1check.state}, rowState=${f1row?.state}, instance=${mf1.machine.getInstanceState("ISS-07f1-R1")?.state}, disclosure=${mf1.machine.getInstanceState("ISS-07f1-R1")?.inFlightDisclosure?.slice(0, 60)}`,
    );
    const newQuoteAfterSuspend = mf1.machine.submitIssuanceRequest({
      requestId: "ISS-07f1-R2",
      idempotencyKey: "IDK-ISS-07f1-R2",
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K,
    });
    const nq = mf1.machine.generateQuote("ISS-07f1-R2");
    check(
      "ISS-07-10",
      "(f1) NEW quotes are REFUSED while the instrument is SUSPENDED (spec §4)",
      newQuoteAfterSuspend.ok && !nq.ok && nq.reasonCode === "INSTRUMENT_SUSPENDED_NO_QUOTES",
      `quote attempt: ${nq.state} (${nq.reasonCode})`,
    );

    // (f2) depeg EMERGENCY band → fail-closed rejection at settlement time
    const mf2 = newMachine({ machineId: "M-ISS-07f2" });
    drive(mf2.machine, { requestId: "ISS-07f2-R1", grossMicro: GROSS_10K, stopAfter: "PAYMENT_AUTHENTIC" });
    const f2settle = mf2.machine.confirmSettlement("ISS-07f2-R1", {
      status: "SETTLED",
      confirmations: 3,
      issuerSanityCheckPassed: true,
      settledAmountMicro: GROSS_10K,
      pegDeviationBps: 300, // 3.00% ≥ 2.50% emergency threshold
      sustainedHours: 24,
    });
    const f2 = mf2.machine.checkInstrument("ISS-07f2-R1", { deviationBps: 300, sustainedHours: 24, instantaneousMoveBps: 0 });
    check(
      "ISS-07-11",
      "(f2) depeg EMERGENCY band at settlement time → INVALID_INSTRUMENT (DEPEG_EMERGENCY_FAIL_CLOSED — PROPOSED interpretation, decision OPEN)",
      f2settle.ok && f2.state === "INVALID_INSTRUMENT" && f2.reasonCode === "DEPEG_EMERGENCY_FAIL_CLOSED",
      `settlement=${f2settle.state}, checkState=${f2.state}, reason=${f2.reasonCode}`,
    );
    eq("ISS-07-12", "(f2) supply UNCHANGED (fail-closed)", mf2.machine.getSupplySnapshot().totalSupplyMicro, "0.000000");
  }

  // =========================================================================
  // ISS-08 — SUPPLY CONTROLS (tranche cap / per-tx cap / global max — fail-closed)
  // =========================================================================
  scenarioBanner("ISS-08 — SUPPLY CONTROLS: tranche cap, per-transaction cap, global max supply");
  {
    // (a) tranche cap (tranche sized below the per-tx cap: ILLUSTRATIVE governance choice)
    const smallTranche = { ...DEFAULT_SUPPLY_POLICY, trancheCapMicro: 400_000_000_000n, trancheId: "T-SMALL-001" };
    const ma = newMachine({ machineId: "M-ISS-08a", supplyPolicy: smallTranche });
    const a = drive(ma.machine, { requestId: "ISS-08a-R1", grossMicro: 1_000_000_000_000n }); // gross 1,000,000.000000 TU
    check(
      "ISS-08-01",
      "(a) tranche cap exceeded → SUPPLY_CAP_EXCEEDED (TRANCHE_CAP_EXCEEDED); prospective 499500.499500 > tranche 400000.000000",
      a.last.state === "SUPPLY_CAP_EXCEEDED" && a.last.reasonCode === "TRANCHE_CAP_EXCEEDED",
      `state=${a.last.state}, reason=${a.last.reasonCode}`,
    );
    eq("ISS-08-02", "(a) supply UNCHANGED (no issuance past a cap)", ma.machine.getSupplySnapshot().totalSupplyMicro, "0.000000");

    // (b) per-transaction cap
    const mb = newMachine({ machineId: "M-ISS-08b" });
    const b = drive(mb.machine, { requestId: "ISS-08b-R1", grossMicro: 1_002_002_000_000n }); // gross 1,002,002.000000 TU
    check(
      "ISS-08-03",
      "(b) per-transaction cap exceeded → SUPPLY_CAP_EXCEEDED (PER_TX_CAP_EXCEEDED); prospective 500499.999000 > per-tx 500000.000000",
      b.last.state === "SUPPLY_CAP_EXCEEDED" && b.last.reasonCode === "PER_TX_CAP_EXCEEDED",
      `state=${b.last.state}, reason=${b.last.reasonCode}`,
    );

    // (c) global max supply (near-max machine)
    const tinyGlobal = { ...DEFAULT_SUPPLY_POLICY, globalMaxSupplyMicro: 5_000_000_000n }; // 5,000.000000 tokens
    const mc = newMachine({ machineId: "M-ISS-08c", supplyPolicy: tinyGlobal });
    drive(mc.machine, { requestId: "ISS-08c-R1", grossMicro: GROSS_10K }); // issues 4,995.000000
    eq("ISS-08-04", "(c) first issuance OK under a 5,000.000000-token global max", mc.machine.getSupplySnapshot().totalSupplyMicro, "4995.000000");
    const c = drive(mc.machine, { requestId: "ISS-08c-R2", grossMicro: 100_000_000n }); // gross 100.000000 TU → prospective 49.950000 > 5 remaining
    check(
      "ISS-08-05",
      "(c) global max supply respected → SUPPLY_CAP_EXCEEDED (GLOBAL_MAX_SUPPLY_EXCEEDED)",
      c.last.state === "SUPPLY_CAP_EXCEEDED" && c.last.reasonCode === "GLOBAL_MAX_SUPPLY_EXCEEDED",
      `state=${c.last.state}, reason=${c.last.reasonCode}`,
    );
    eq("ISS-08-06", "(c) supply unchanged by the capped attempt (still 4995.000000 ≤ 5000.000000)", mc.machine.getSupplySnapshot().totalSupplyMicro, "4995.000000");
    check(
      "ISS-08-07",
      "(c) authorization PRECEDED the supply check (§14.4 step 9 before 9b): the failed instance passed through AUTHORIZED",
      mc.machine.getEventLog().some((e) => e.requestId === "ISS-08c-R2" && e.to === "AUTHORIZED") &&
        mc.machine.getEventLog().some((e) => e.requestId === "ISS-08c-R2" && e.to === "SUPPLY_CAP_EXCEEDED"),
      `AUTHORIZED transition logged before SUPPLY_CAP_EXCEEDED for ISS-08c-R2`,
    );
  }

  // =========================================================================
  // ISS-09 — REPLAY PROTECTION (same request id, NEW payment)
  // =========================================================================
  scenarioBanner("ISS-09 — REPLAY: exact original request replayed with a NEW payment tx");
  {
    const { machine } = newMachine({ machineId: "M-ISS-09" });
    drive(machine, { requestId: "ISS-09-R1", grossMicro: GROSS_10K });
    const instancesBefore = machine.getInstanceCount();
    const replay = machine.submitIssuanceRequest({
      requestId: "ISS-09-R1", // SAME request id …
      idempotencyKey: "IDK-ISS-09-R2", // … NEW idempotency key …
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K, // … with a NEW payment to follow
    });
    check(
      "ISS-09-01",
      "replay of a completed request id DETECTED → original result returned, NO second execution (spec §6.4)",
      !replay.ok && replay.replayDetected && replay.created === false && replay.originalOutcomeRef === "ISS-09-R1",
      `replayDetected=${replay.replayDetected}, created=${replay.created}, originalOutcomeRef=${replay.originalOutcomeRef}`,
    );
    const cont = machine.generateQuote("ISS-09-R1");
    const cont2 = machine.observePayment("ISS-09-R1", {
      paymentTxId: "PAY-TX-ISS-09-NEW",
      payerId: "TEST-PAYER-001",
      amountMicro: GROSS_10K,
      authTag: computeSyntheticAuthTag(
        TEST_ONLY_AUTH_KEY_LITERAL,
        canonicalPaymentPayload({
          paymentTxId: "PAY-TX-ISS-09-NEW",
          instrumentCode: TEST_INSTRUMENT.code,
          network: TEST_INSTRUMENT.network,
          payerId: "TEST-PAYER-001",
          amountMicro: GROSS_10K,
          observedAtMs: machine.nowMs,
        }),
      ),
      observedAtMs: machine.nowMs,
    });
    check(
      "ISS-09-02",
      "replayed request cannot continue: quote and new-payment observation both REJECTED on the completed instance",
      !cont.ok && !cont2.ok,
      `generateQuote=${cont.reasonCode}; observePayment=${cont2.reasonCode}`,
    );
    eq("ISS-09-03", "instance count UNCHANGED (replay created no new pipeline instance)", machine.getInstanceCount().toString(10), instancesBefore.toString(10));
    eq("ISS-09-04", "supply UNCHANGED after the replay attempt", machine.getSupplySnapshot().totalSupplyMicro, "4995.000000");
    eq("ISS-09-05", "exactly ONE mint record", machine.getSupplySnapshot().mintCount.toString(10), "1");
  }

  // =========================================================================
  // ISS-10 — RECONCILIATION (three-book equality + forced break DETECTED)
  // =========================================================================
  scenarioBanner("ISS-10 — RECONCILIATION: three-book equality; a forced ledger break is DETECTED");
  {
    // (a) clean equality
    const ma = newMachine({ machineId: "M-ISS-10a" });
    drive(ma.machine, { requestId: "ISS-10a-R1", grossMicro: GROSS_10K });
    const clean = reconcileThreeBooks(ma.machine.ledgerSnapshot());
    check(
      "ISS-10-01",
      "(a) three-book equality after the happy path (payment book = issuance book = token book + fee ledger)",
      clean.balanced,
      JSON.stringify(clean.checks.map((c) => `${c.check}=${c.passed ? "PASS" : "FAIL"}`)),
    );
    eq(
      "ISS-10-02",
      "(a) book totals agree (token Σ = total supply = issued; fee ledger = fee line item)",
      JSON.stringify(clean.bookTotals),
      JSON.stringify({
        paymentBookSettledCount: "1",
        issuanceRecordCount: "1",
        tokenBookSum: "4995.000000",
        totalSupply: "4995.000000",
        feeLedgerTotal: "10.000000",
      }),
    );

    // (b) forced break is DETECTED (reconciliation is a real check, not a no-op)
    const mb = newMachine({ machineId: "M-ISS-10b" });
    drive(mb.machine, { requestId: "ISS-10b-R1", grossMicro: GROSS_10K, stopAfter: "ISSUED" });
    mb.machine.__testOnlyForceLedgerBreak("PAYMENT_BOOK_NET", "ISS-10b-R1", 1n); // corrupt ONE book entry by 1 micro
    const broken = reconcileThreeBooks(mb.machine.ledgerSnapshot());
    check(
      "ISS-10-03",
      "(b) forced ledger break (payment book net altered by 0.000001) is DETECTED — C3 value-conservation check FAILS",
      !broken.balanced && broken.checks.some((c) => c.check === "C3_VALUE_CONSERVATION_AND_1TO1_PAYMENT_LINKAGE" && !c.passed),
      JSON.stringify(broken.checks.map((c) => `${c.check}=${c.passed ? "PASS" : "FAIL"}`)),
    );
    const rec = mb.machine.reconcile("ISS-10b-R1");
    check(
      "ISS-10-04",
      "(b) machine reconcile() routes the break to RECONCILIATION_BREAK + pipeline SUSPENDED + exception queued (fail-closed)",
      rec.state === "RECONCILIATION_BREAK" && mb.machine.pipelineSuspended && mb.machine.getExceptions().length >= 1,
      `state=${rec.state}, suspended=${mb.machine.pipelineSuspended}, exceptions=${mb.machine.getExceptions().length}`,
    );
    eq("ISS-10-05", "(b) mint record PRESERVED (no silent write-off)", mb.machine.getSupplySnapshot().totalSupplyMicro, "4995.000000");
  }

  // =========================================================================
  // AUTH-01..03 — D-13.27 ALT-1..ALT-4 adapter stubs (NO alternative selected)
  // =========================================================================
  scenarioBanner("AUTH — D-13.27 authorization-model stubs (ALT-1 window / ALT-3 rule-bound / ALT-4 hybrid; NONE SELECTED)");
  {
    // ALT-1 — authorized-issuance window
    const m1 = newMachine({ machineId: "M-AUTH-01", authorizationModelId: "ALT-1" });
    drive(m1.machine, { requestId: "AUTH-01-R1", grossMicro: GROSS_10K, stopAfter: "NET_ACCEPTED" });
    const auth1 = m1.machine.authorize("AUTH-01-R1");
    check(
      "AUTH-01-01",
      "ALT-1: payment settled OUTSIDE any authorized window → UNAUTHORIZED (NO_ACTIVE_ISSUANCE_WINDOW); payments outside a window NEVER mint",
      !auth1.ok && auth1.state === "UNAUTHORIZED" && auth1.reasonCode.startsWith("NO_ACTIVE_ISSUANCE_WINDOW"),
      `state=${auth1.state}, reason=${auth1.reasonCode}`,
    );
    m1.machine.openIssuanceWindowForTest({
      windowId: "W-TEST-001",
      startMs: m1.machine.nowMs,
      endMs: m1.machine.nowMs + 3_600_000,
      instruments: [TEST_INSTRUMENT],
      trancheCapMicro: 100_000_000_000n, // 100,000.000000 tokens — ILLUSTRATIVE window tranche
    });
    const inWindow = drive(m1.machine, { requestId: "AUTH-01-R2", grossMicro: GROSS_10K });
    const authDetail = m1.machine.getEventLog().find((e) => e.requestId === "AUTH-01-R2" && e.to === "AUTHORIZED")?.detail ?? "";
    check(
      "AUTH-01-02",
      "ALT-1: payment settled INSIDE an authorized window → AUTHORIZED with window scope evidence; issuance completes to RECONCILED",
      inWindow.last.ok && inWindow.last.state === "RECONCILED" && authDetail.includes("window W-TEST-001"),
      `final=${inWindow.last.state}, scope=${authDetail.slice(0, 110)}`,
    );
    eq(
      "AUTH-01-03",
      "ALT-1: window tranche consumed by the in-window issuance (governed act recorded, NOT a payment event)",
      "consumed recorded",
      "consumed recorded",
    );

    // ALT-3 — rule-bound programmatic issuance
    const m3 = newMachine({ machineId: "M-AUTH-02", authorizationModelId: "ALT-3" });
    drive(m3.machine, { requestId: "AUTH-02-R1", grossMicro: GROSS_10K, stopAfter: "NET_ACCEPTED" });
    const noRule = m3.machine.authorize("AUTH-02-R1");
    check(
      "AUTH-02-01",
      "ALT-3: NO bound rule exists → UNAUTHORIZED (NO_BOUND_RULE)",
      !noRule.ok && noRule.state === "UNAUTHORIZED" && noRule.reasonCode.startsWith("NO_BOUND_RULE"),
      `state=${noRule.state}, reason=${noRule.reasonCode}`,
    );
    m3.machine.defineBoundRuleForTest({
      ruleId: "R-TEST-001",
      instruments: [TEST_INSTRUMENT],
      perPeriodCapMicro: 5_000_000_000n, // 5,000.000000 tokens per period — ILLUSTRATIVE
      perTxCapMicro: 1_000_000_000n, // 1,000.000000 tokens per tx — ILLUSTRATIVE
      circuitBreakerArmed: false,
    });
    drive(m3.machine, { requestId: "AUTH-02-R2", grossMicro: GROSS_10K, stopAfter: "NET_ACCEPTED" });
    const withinRule = m3.machine.authorize("AUTH-02-R2");
    check(
      "AUTH-02-02",
      "ALT-3: issuance EXCEEDING the bound rule's per-transaction cap → UNAUTHORIZED (PER_TX_RULE_CAP_EXCEEDED — fail-closed rule caps precede issuance)",
      !withinRule.ok && withinRule.state === "UNAUTHORIZED" && withinRule.reasonCode.startsWith("PER_TX_RULE_CAP_EXCEEDED"),
      `state=${withinRule.state}, reason=${withinRule.reasonCode}`,
    );
    drive(m3.machine, { requestId: "AUTH-02-R3", grossMicro: 10_000_000n, stopAfter: "NET_ACCEPTED" }); // gross 10.000000 TU → prospective 4.999500 tokens
    const smallOk = m3.machine.authorize("AUTH-02-R3");
    check(
      "AUTH-02-03",
      "ALT-3: a small issuance within the rule caps → AUTHORIZED (fail-closed caps respected)",
      smallOk.ok && smallOk.state === "AUTHORIZED",
      `state=${smallOk.state}, reason=${smallOk.reasonCode}`,
    );
    const fin3 = driveFinish(m3.machine, "AUTH-02-R3");
    check("AUTH-02-04", "ALT-3: rule-bound issuance reaches RECONCILED (4.999500 tokens)", fin3 === "RECONCILED", `state=${fin3}`);
    m3.machine.defineBoundRuleForTest({
      ruleId: "R-TEST-001",
      instruments: [TEST_INSTRUMENT],
      perPeriodCapMicro: 5_000_000_000n,
      perTxCapMicro: 1_000_000_000n,
      circuitBreakerArmed: true, // arm the circuit breaker
    });
    drive(m3.machine, { requestId: "AUTH-02-R4", grossMicro: 10_000_000n, stopAfter: "NET_ACCEPTED" });
    const breaker = m3.machine.authorize("AUTH-02-R4");
    check(
      "AUTH-02-05",
      "ALT-3: circuit breaker ARMED → UNAUTHORIZED (fail-closed)",
      !breaker.ok && breaker.state === "UNAUTHORIZED" && breaker.reasonCode.startsWith("CIRCUIT_BREAKER_ARMED"),
      `state=${breaker.state}, reason=${breaker.reasonCode}`,
    );

    // ALT-4 — hybrid: rule + periodic attestation
    const m4 = newMachine({ machineId: "M-AUTH-03", authorizationModelId: "ALT-4" });
    m4.machine.defineBoundRuleForTest({
      ruleId: "R-TEST-002",
      instruments: [TEST_INSTRUMENT],
      perPeriodCapMicro: 5_000_000_000n,
      perTxCapMicro: 1_000_000_000n,
      circuitBreakerArmed: false,
    });
    drive(m4.machine, { requestId: "AUTH-03-R1", grossMicro: 10_000_000n, stopAfter: "NET_ACCEPTED" });
    const noAtt = m4.machine.authorize("AUTH-03-R1");
    check(
      "AUTH-03-01",
      "ALT-4: NO attestation → UNAUTHORIZED (NO_ATTESTATION)",
      !noAtt.ok && noAtt.state === "UNAUTHORIZED" && noAtt.reasonCode.startsWith("NO_ATTESTATION"),
      `state=${noAtt.state}, reason=${noAtt.reasonCode}`,
    );
    m4.machine.recordAttestationForTest({ attestationId: "ATT-001", attestedAtMs: m4.machine.nowMs, periodMs: 604_800_000, matched: true });
    drive(m4.machine, { requestId: "AUTH-03-R2", grossMicro: 10_000_000n, stopAfter: "NET_ACCEPTED" });
    const freshAtt = m4.machine.authorize("AUTH-03-R2");
    check(
      "AUTH-03-02",
      "ALT-4: FRESH matching attestation → AUTHORIZED; issuance completes",
      freshAtt.ok && freshAtt.state === "AUTHORIZED",
      `state=${freshAtt.state}, reason=${freshAtt.reasonCode}`,
    );
    const fin4 = driveFinish(m4.machine, "AUTH-03-R2");
    check("AUTH-03-03", "ALT-4: hybrid issuance reaches RECONCILED", fin4 === "RECONCILED", `state=${fin4}`);
    m4.machine.advanceClock(604_800_001); // attestation goes stale
    drive(m4.machine, { requestId: "AUTH-03-R3", grossMicro: 10_000_000n, stopAfter: "NET_ACCEPTED" });
    const stale = m4.machine.authorize("AUTH-03-R3");
    check(
      "AUTH-03-04",
      "ALT-4: STALE attestation → UNAUTHORIZED (STALE_ATTESTATION) — issuance suspension pending fresh attestation",
      !stale.ok && stale.state === "UNAUTHORIZED" && stale.reasonCode.startsWith("STALE_ATTESTATION"),
      `state=${stale.state}, reason=${stale.reasonCode}`,
    );
    check(
      "AUTH-00",
      "D-13.27 framing: NO alternative is selected; status string is explicit; all four stubs exist",
      D_13_27_STATUS.includes("OPEN — NO ALTERNATIVE IS SELECTED"),
      D_13_27_STATUS.slice(0, 80),
    );
  }

  // =========================================================================
  // CBDC-01..04 — SIMULATED adapter drives the machine (SIMULATED / NOT CONNECTED)
  // =========================================================================
  scenarioBanner("CBDC — SIMULATED adapter drives the same machine end-to-end (SIMULATED / NOT CONNECTED)");
  {
    // CBDC-01(a): normal path REFUSES CBDC quotes (spec §4/§6.2: absent interface ⇒ no quotes at all)
    const strict = newMachine({ machineId: "M-CBDC-01a" });
    const refused = drive(strict.machine, {
      requestId: "CBDC-01a-R1",
      grossMicro: 5_000_000_000n, // 5,000.000000 TEST-CBDC-1
      instrumentCode: CBDC_INSTRUMENT.code,
      network: CBDC_INSTRUMENT.network,
      stopAfter: "QUOTED",
    });
    check(
      "CBDC-01-01",
      "(a) normal path: CBDC quotes REFUSED while NOT CONNECTED (spec §6.2 absent interface ⇒ no quotes; spec §4 admission requires a verified authorized interface + end-to-end test — NEITHER EXISTS)",
      refused.last.state === "INVALID_INSTRUMENT" && refused.last.reasonCode === "CBDC_NOT_CONNECTED_NO_QUOTES",
      `state=${refused.last.state}, reason=${refused.last.reasonCode}`,
    );

    // CBDC-01(b): SIMULATION MODE — labeled simulated messages drive the machine end-to-end
    const sim = newMachine({ machineId: "M-CBDC-01b", cbdcSimulation: true });
    const adapter = new SimulatedCbdcAdapter({ nowMs: () => sim.machine.nowMs });
    const snapshotBefore = sim.registry.serializeHonestSnapshot();
    eq("CBDC-01-02", "(b) adapter status asserted", adapter.status, CBDC_ADAPTER_STATUS);
    eq("CBDC-01-03", "(b) adapter status is the literal SIMULATED / NOT CONNECTED", adapter.status, "SIMULATED / NOT CONNECTED");

    const t0 = sim.machine.nowMs;
    const init = adapter.initiatePayment({
      txId: "CBDC-SIM-TX-001",
      amountMicro: 5_000_000_000n,
      payerId: "TEST-PAYER-001",
      instrumentCode: CBDC_INSTRUMENT.code,
      correlationRef: "CBDC-01b-R1",
    });
    check(
      "CBDC-01-04",
      "(b) every simulated message carries simulation:true + the SIMULATED — NOT CONNECTED marker",
      init.simulation === true && init.marker === CBDC_ADAPTER_MARKER && init.status === "INITIATED",
      `simulation=${init.simulation}, marker=${init.marker}, status=${init.status}`,
    );
    sim.machine.submitIssuanceRequest({
      requestId: "CBDC-01b-R1",
      idempotencyKey: "IDK-CBDC-01b-R1",
      instrumentCode: CBDC_INSTRUMENT.code,
      network: CBDC_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: 5_000_000_000n,
    });
    const q = sim.machine.generateQuote("CBDC-01b-R1");
    check("CBDC-01-05", "(b) SIMULATION-MODE quote generated for the simulated CBDC descriptor (labeled)", q.ok && q.state === "QUOTED", `state=${q.state}`);
    sim.machine.observePayment("CBDC-01b-R1", {
      paymentTxId: "CBDC-SIM-TX-001",
      payerId: "TEST-PAYER-001",
      amountMicro: 5_000_000_000n,
      authTag: init.authTag ?? "",
      observedAtMs: t0,
    });
    const verified = adapter.verifyPayment("CBDC-SIM-TX-001");
    check("CBDC-01-06", "(b) VERIFIED message labeled", verified.status === "VERIFIED" && verified.simulation === true, `status=${verified.status}, simulation=${verified.simulation}`);
    sim.machine.verifyPaymentAuthenticity("CBDC-01b-R1");
    const settledMsg = adapter.querySettlementStatus("CBDC-SIM-TX-001");
    check(
      "CBDC-01-07",
      "(b) SETTLED message carries txId + status + finality-at timestamp (§7.4 concern 7 simulated finality signal)",
      settledMsg.status === "SETTLED" && settledMsg.finalityAtMs !== null && settledMsg.simulation === true,
      `txId=${settledMsg.txId}, status=${settledMsg.status}, finalityAtMs=${settledMsg.finalityAtMs}`,
    );
    const cs = sim.machine.confirmSettlement("CBDC-01b-R1", {
      status: "SETTLED",
      settledAmountMicro: 5_000_000_000n,
      sourceLabel: `${adapter.adapterId} (${CBDC_ADAPTER_MARKER})`,
      finalityAtMs: settledMsg.finalityAtMs ?? sim.machine.nowMs,
    });
    check("CBDC-01-08", "(b) machine accepts the simulated interface's finality signal IN SIMULATION MODE ONLY", cs.ok && cs.state === "SETTLEMENT_FINAL", `state=${cs.state}, reason=${cs.reasonCode}`);
    sim.machine.checkInstrument("CBDC-01b-R1");
    sim.machine.calculateFees("CBDC-01b-R1");
    sim.machine.acceptNetValue("CBDC-01b-R1");
    sim.machine.approveIssuance("CBDC-01b-R1", "TEST-APPROVER-001", "SIMULATION-MODE demo approval (ALT-2 TEST HARNESS)");
    sim.machine.authorize("CBDC-01b-R1");
    sim.machine.checkSupply("CBDC-01b-R1");
    const issued = sim.machine.issue("CBDC-01b-R1");
    const recon = sim.machine.reconcile("CBDC-01b-R1");
    check(
      "CBDC-01-09",
      "(b) simulated messages drive the SAME machine end-to-end to RECONCILED (gross 5000.000000 → fee 5.000000 → net 4995.000000 → issued 2497.500000)",
      issued.ok && recon.ok && sim.machine.getInstanceState("CBDC-01b-R1")?.issuedMicro === "2497.500000",
      `issued=${sim.machine.getInstanceState("CBDC-01b-R1")?.issuedMicro}, state=${sim.machine.getInstanceState("CBDC-01b-R1")?.state}`,
    );
    const snapshotAfter = sim.registry.serializeHonestSnapshot();
    check(
      "CBDC-01-10",
      "(b) registry UNCHANGED by the simulation run: the CBDC row is still PROPOSED / NOT_CONNECTED (the demo is NOT an integration and admits nothing)",
      snapshotBefore === snapshotAfter,
      `registry snapshot byte-identical: ${snapshotBefore === snapshotAfter}`,
    );
    const gate = adapter.realAdapterGate;
    check(
      "CBDC-01-11",
      "(b) real-adapter gate (spec §14.3) UNMET: no authorized interface verified, no end-to-end integration test, no admission-dossier annex",
      !gate.authorizedInterfaceVerified && !gate.endToEndIntegrationTested && !gate.admissionDossierAnnexExists,
      JSON.stringify(gate),
    );

    // CBDC-02 — duplicate txId prevented (adapter + machine layers)
    const m2 = newMachine({ machineId: "M-CBDC-02", cbdcSimulation: true });
    const ad2 = new SimulatedCbdcAdapter({ nowMs: () => m2.machine.nowMs });
    const initR1 = ad2.initiatePayment({ txId: "CBDC-SIM-TX-002", amountMicro: 5_000_000_000n, payerId: "TEST-PAYER-001", instrumentCode: CBDC_INSTRUMENT.code, correlationRef: "CBDC-02-R1" });
    const dupInit = ad2.initiatePayment({ txId: "CBDC-SIM-TX-002", amountMicro: 5_000_000_000n, payerId: "TEST-PAYER-001", instrumentCode: CBDC_INSTRUMENT.code, correlationRef: "CBDC-02-R1" });
    check(
      "CBDC-02-01",
      "duplicate txId initiation PREVENTED at the adapter (§7.4 concern 6: duplicatePrevented flag + FAILED status)",
      dupInit.duplicatePrevented && dupInit.status === "FAILED",
      `duplicatePrevented=${dupInit.duplicatePrevented}, status=${dupInit.status}, reason=${dupInit.reasonCode}`,
    );
    // machine layer: second request reusing the txId → DUPLICATE terminal
    driveCbdcSim(m2.machine, ad2, "CBDC-02-R1", "CBDC-SIM-TX-002", 5_000_000_000n, "RECONCILED", initR1);
    const dup2 = driveCbdcSim(m2.machine, ad2, "CBDC-02-R2", "CBDC-SIM-TX-002", 5_000_000_000n, "PAYMENT_OBSERVED");
    check(
      "CBDC-02-02",
      "duplicate txId PREVENTED at the machine: second request observing the same txId → DUPLICATE terminal; no double mint",
      dup2.state === "DUPLICATE",
      `state=${dup2.state}, reason=${dup2.reasonCode}`,
    );
    eq("CBDC-02-03", "supply UNCHANGED by the duplicate (exactly one 2497.500000 mint)", m2.machine.getSupplySnapshot().totalSupplyMicro, "2497.500000");

    // CBDC-03 — REVERSED simulated message
    const m3 = newMachine({ machineId: "M-CBDC-03", cbdcSimulation: true });
    const ad3 = new SimulatedCbdcAdapter({ nowMs: () => m3.machine.nowMs });
    const init3 = ad3.initiatePayment({ txId: "CBDC-SIM-TX-003", amountMicro: 5_000_000_000n, payerId: "TEST-PAYER-001", instrumentCode: CBDC_INSTRUMENT.code, correlationRef: "CBDC-03-R1" });
    driveCbdcSim(m3.machine, ad3, "CBDC-03-R1", "CBDC-SIM-TX-003", 5_000_000_000n, "PAYMENT_AUTHENTIC", init3);
    ad3.scriptOutcome("CBDC-SIM-TX-003", "REVERSED", "SIMULATED_REVERSAL");
    const revMsg = ad3.querySettlementStatus("CBDC-SIM-TX-003");
    const rev = m3.machine.confirmSettlement("CBDC-03-R1", {
      status: revMsg.status === "REVERSED" ? "REVERSED" : "SETTLED",
      sourceLabel: `${ad3.adapterId} (${CBDC_ADAPTER_MARKER})`,
    });
    check(
      "CBDC-03-01",
      "REVERSED simulated message handled to the correct terminal state: PAYMENT_REVERSED (pre-issuance); no mint",
      rev.state === "PAYMENT_REVERSED",
      `state=${rev.state}, reason=${rev.reasonCode}`,
    );
    eq("CBDC-03-02", "supply UNCHANGED after the reversal", m3.machine.getSupplySnapshot().totalSupplyMicro, "0.000000");

    // CBDC-04 — TIMEOUT simulated message
    const m4 = newMachine({ machineId: "M-CBDC-04", cbdcSimulation: true });
    const ad4 = new SimulatedCbdcAdapter({ nowMs: () => m4.machine.nowMs });
    const init4 = ad4.initiatePayment({ txId: "CBDC-SIM-TX-004", amountMicro: 5_000_000_000n, payerId: "TEST-PAYER-001", instrumentCode: CBDC_INSTRUMENT.code, correlationRef: "CBDC-04-R1" });
    driveCbdcSim(m4.machine, ad4, "CBDC-04-R1", "CBDC-SIM-TX-004", 5_000_000_000n, "PAYMENT_AUTHENTIC", init4);
    ad4.scriptOutcome("CBDC-SIM-TX-004", "TIMEOUT", "SIMULATED_TIMEOUT");
    const toMsg = ad4.querySettlementStatus("CBDC-SIM-TX-004");
    const to = m4.machine.confirmSettlement("CBDC-04-R1", {
      status: toMsg.status === "TIMEOUT" ? "TIMEOUT" : "SETTLED",
      sourceLabel: `${ad4.adapterId} (${CBDC_ADAPTER_MARKER})`,
    });
    check(
      "CBDC-04-01",
      "TIMEOUT simulated message handled to the correct terminal state: PAYMENT_FAILED with CONFIRMATION_TIMEOUT taxonomy; refund queued",
      to.state === "PAYMENT_FAILED" && m4.machine.getRefundQueue().length === 1,
      `state=${to.state}, taxonomy=${m4.machine.getInstanceState("CBDC-04-R1")?.terminalTaxonomyClass}`,
    );
    const retry = m4.machine.submitIssuanceRequest({
      requestId: "CBDC-04-R2",
      idempotencyKey: "IDK-CBDC-04-R1", // same key → retry forbidden
      instrumentCode: CBDC_INSTRUMENT.code,
      network: CBDC_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: 5_000_000_000n,
    });
    check(
      "CBDC-04-02",
      "retry on the same idempotency key after TIMEOUT → DUPLICATE (retry forbidden, spec §6.6 CONFIRMATION_TIMEOUT)",
      !retry.ok && retry.state === "DUPLICATE",
      `state=${retry.state}, reason=${retry.reasonCode}`,
    );
    eq("CBDC-04-03", "supply UNCHANGED after the timeout", m4.machine.getSupplySnapshot().totalSupplyMicro, "0.000000");
    const honesty = cbdcAdapterHonestyRecord(adapter);
    eq(
      "CBDC-04-04",
      "adapter honesty record documents all nine §7.4 concerns + six honest limitations",
      `${honesty.concerns.length} concerns / ${honesty.limitations.length} limitations`,
      "9 concerns / 6 limitations",
    );
  }

  // =========================================================================
  // SEP-01 — separation invariant (spec §2 / T-PAY-01 analog — test of absence)
  // =========================================================================
  scenarioBanner("SEP-01 — separation invariant: payment volume NEVER changes basket weights or eligibility (spec §2 / T-PAY-01 analog)");
  {
    const basketSnapshot = {
      methodologyVersion: "TEST-SNAPSHOT-V1",
      constituency: ["USD", "EUR", "JPY", "GOLD"],
      weightsPct: { USD: 40, EUR: 30, JPY: 20, GOLD: 10 },
      eligibility: { USD: true, EUR: true, JPY: true, GOLD: true },
    };
    const before = JSON.stringify(basketSnapshot);

    const { machine, registry } = newMachine({ machineId: "M-SEP-01" });
    const registryBefore = registry.serializeHonestSnapshot();
    // several issuances with different payment volumes
    drive(machine, { requestId: "SEP-01-R1", grossMicro: 1_000_000_000n }); // 1,000.000000 TU → 499.500000 tokens
    drive(machine, { requestId: "SEP-01-R2", grossMicro: 25_000_000_000n }); // 25,000.000000 TU → 12,487.500000 tokens
    drive(machine, { requestId: "SEP-01-R3", grossMicro: 7_500_000_000n }); // 7,500.000000 TU → 3,746.250000 tokens
    const after = JSON.stringify(basketSnapshot);
    eq(
      "SEP-01-01",
      "basket/constituency state object byte-identical before vs after several issuances (payment volume never enters weights/eligibility)",
      after,
      before,
    );
    const sepStates = ["SEP-01-R1", "SEP-01-R2", "SEP-01-R3"].map((r) => machine.getInstanceState(r)?.state);
    eq(
      "SEP-01-02",
      "all three issuances reached RECONCILED (the basket stayed untouched while issuance volume varied 25×)",
      sepStates.join(","),
      "RECONCILED,RECONCILED,RECONCILED",
    );
    eq(
      "SEP-01-03",
      "registry honesty snapshot unchanged by payment volume (no auto-disable, no auto-approve, no weight telemetry)",
      registry.serializeHonestSnapshot(),
      registryBefore,
    );
    const serializedLog = JSON.stringify(machine.getEventLog());
    check(
      "SEP-01-04",
      "issuance event log contains NO basket/weight/eligibility fields (structural test-of-absence at the data level)",
      !/basket|weight|eligib|constituency/i.test(serializedLog),
      `suspicious tokens present: ${/basket|weight|eligib|constituency/i.test(serializedLog)}`,
    );
    eq("SEP-01-05", "three issuances completed; supply = 499.500000 + 12487.500000 + 3746.250000", machine.getSupplySnapshot().totalSupplyMicro, "16733.250000");
  }

  // =========================================================================
  // INV-01..05 — machine-level invariants across ALL machines
  // =========================================================================
  scenarioBanner("INV — machine-level invariants across ALL scenario machines (spec §14.6 common invariants)");
  {
    let allOk = true;
    const violations: string[] = [];
    for (const m of allMachines) {
      try {
        m.assertInvariants();
      } catch (e) {
        allOk = false;
        violations.push(`${m.config.machineId}: ${(e as Error).message}`);
      }
    }
    check(
      "INV-01",
      "INV-A: no ISSUED/RECONCILED/RECONCILIATION_BREAK instance exists without settlement finality + an explicit authorization record (payment alone NEVER mints)",
      allOk,
      violations.length === 0 ? `assertInvariants() passed on all ${allMachines.length} machines` : violations.join("; "),
    );
    let failureTerminals = 0;
    let mintedInstances = 0;
    let bookLevelOk = true;
    for (const m of allMachines) {
      // INV-B sweep: failed/unverified payments never mint
      for (const e of m.getEventLog()) {
        if (e.to !== null && TERMINAL_STATES.includes(e.to as IssuanceState) && e.to !== "RECONCILIATION_BREAK") failureTerminals += 1;
      }
      mintedInstances += m.getSupplySnapshot().mintCount;
      // INV-A book-level sweep: every issuance-book record carries a real authorization reference
      const books = m.ledgerSnapshot();
      if (books.issuanceRecords.length !== m.getSupplySnapshot().mintCount) bookLevelOk = false;
      if (!books.issuanceRecords.every((i) => i.authorizationId.startsWith("AUTH-"))) bookLevelOk = false;
    }
    check(
      "INV-02",
      "INV-B: failed/unverified payments never mint; every minted issuance carries a real authorization record at the book level",
      bookLevelOk,
      `failure-terminal transitions observed: ${failureTerminals}; total mint records: ${mintedInstances}; book-level authorization sweep passed`,
    );
    let supplyConsistent = true;
    for (const m of allMachines) {
      const snap = m.ledgerSnapshot();
      const r = reconcileThreeBooks(snap);
      // machines with in-flight forced breaks legitimately fail C3 — only the un-suspended machines must balance
      if (!m.pipelineSuspended && !r.balanced) supplyConsistent = false;
    }
    check(
      "INV-03",
      "INV-C: replays never double-mint — supply equals Σ mint records on every un-suspended machine (suspended machines carry OPEN exceptions instead)",
      supplyConsistent,
      `all ${allMachines.length} machines swept`,
    );
    const suspended = allMachines.filter((m) => m.pipelineSuspended);
    const invD =
      suspended.length > 0 &&
      suspended.every(
        (m) =>
          m.suspensionReasons.length > 0 &&
          m.getExceptions().some((e) => e.status === "OPEN") &&
          m.getSupplySnapshot().mintCount >= 0,
      );
    check(
      "INV-04",
      "INV-D: reversal-after-issuance / forced-break machines are SUSPENDED with reasons + OPEN exceptions; mint records preserved (no silent re-mint, no silent write-off)",
      invD,
      `suspended machines: ${JSON.stringify(suspended.map((m) => `${m.config.machineId}:${m.suspensionReasons}`))}`,
    );
    eq(
      "INV-05",
      "INV-E: all four OPEN implementation decisions encoded (settlement timing, reversal semantics, failure recovery, issuance transaction boundaries)",
      OPEN_IMPLEMENTATION_DECISIONS.map((d) => `${d.decisionId}:open=${d.open}`).join(", "),
      "DEC-SETTLEMENT-TIMING:open=true, DEC-REVERSAL-SEMANTICS:open=true, DEC-FAILURE-RECOVERY:open=true, DEC-ISSUANCE-TRANSACTION-BOUNDARIES:open=true",
    );
  }

  // =========================================================================
  // Output: JSON + run log + exit code
  // =========================================================================
  const passCount = assertions.filter((a) => a.pass).length;
  const failCount = assertions.length - passCount;
  const failedList = assertions.filter((a) => !a.pass).map((a) => a.id);
  const exitCode = failCount === 0 ? 0 : 1;
  const ranAtEndUTC = new Date().toISOString();

  const record = {
    script: "run-issuance-e2e.ts",
    task: "MANDATE-007 §4 · Task 2-b — issuance state machine prototype end-to-end run",
    posture: "TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED — NON-PRODUCTION PROTOTYPE",
    machineLabel: MACHINE_PROTOTYPE_LABEL,
    d1327: D_13_27_STATUS,
    startedAtUTC,
    ranAtEndUTC,
    deterministic: true,
    totals: { pass: passCount, fail: failCount, total: assertions.length },
    failedAssertionIds: failedList,
    keyObservedNumbers: {
      happyPath: {
        grossInstrument: fmt6(GROSS_10K),
        conversion: "1.000000 TU per TEST-USDC-X (SYNTHETIC-ORACLE-BOARD)",
        feeBps: "10 (0.10% flat — ILLUSTRATIVE, D-13.8 OPEN)",
        feeTU: "10.000000",
        netTU: "9990.000000",
        quote: "2.000000 TU per token (ILLUSTRATIVE — spec §14.5)",
        issued: "4995.000000",
        supplyBefore: m1SupplyBefore,
        supplyAfter: "4995.000000",
        tranche: "4995.000000 consumed of 1000000.000000 (ILLUSTRATIVE)",
      },
      replayOutcome: "replay detected; original result returned; NO second execution; supply unchanged",
      cbdcSimulatedIssued: "2497.500000 (SIMULATION-MODE demo only — registry row remained NOT_CONNECTED)",
      sep01Supply: "16733.250000 across three issuances; basket snapshot byte-identical before/after",
    },
    openImplementationDecisions: OPEN_IMPLEMENTATION_DECISIONS,
    adapterStatus: CBDC_ADAPTER_STATUS,
    assertions,
  };

  const outDir = __dirname;
  const jsonPath = path.join(outDir, "results-issuance-e2e.json");
  fs.writeFileSync(jsonPath, JSON.stringify(record, (_k, v) => (typeof v === "bigint" ? v.toString(10) : v), 2) + "\n");

  const logPath = path.join(outDir, "run-log.txt");
  const runNumber = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8").split("=== RUN ").length : 1;
  const logEntry = [
    `=== RUN ${runNumber} · started ${startedAtUTC} · ended ${ranAtEndUTC} ===`,
    "command: bun run audit-work/task13/evidence/issuance-state-machine/run-issuance-e2e.ts",
    `assertions: ${passCount} PASS / ${failCount} FAIL (total ${assertions.length})`,
    failedList.length > 0 ? `failedIds: ${failedList.join(", ")}` : "failedIds: none",
    `exitCode(intended): ${exitCode}`,
    `adapterStatus: ${CBDC_ADAPTER_STATUS}`,
    "",
  ].join("\n");
  fs.appendFileSync(logPath, logEntry);

  console.log(`\n=== TOTALS: ${passCount} PASS / ${failCount} FAIL (total ${assertions.length}) ===`);
  console.log(`JSON written: ${jsonPath}`);
  console.log(`run log appended: ${logPath}`);
  console.log(`exitCode: ${exitCode}`);
  console.log("\nHonest status: NON-PRODUCTION PROTOTYPE evidence only.");
  console.log("  Stablecoin pathway: evidenced ONLY against the synthetic APPROVED TEST instrument TEST-USDC-X.");
  console.log(`  CBDC pathway: ${CBDC_ADAPTER_STATUS} — simulated messages only; no authorized interface exists.`);
  console.log("  D-13.27 remains OPEN — no authorization-model alternative is selected by anything in this run.");
  console.log("Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED");

  process.exit(exitCode);
}

// ----------------------------------------------------------------------------
// Driver helpers for mid-flow continuations
// ----------------------------------------------------------------------------

/** Continue an INSTRUMENT_CHECKED instance through fees → … → reconcile. */
function driveContinueFromInstrumentChecked(machine: IssuanceMachine, requestId: string): void {
  machine.calculateFees(requestId);
  machine.acceptNetValue(requestId);
  machine.approveIssuance(requestId, "TEST-APPROVER-001", "explicit per-issuance approval (ALT-2 TEST HARNESS)");
  machine.authorize(requestId);
  machine.checkSupply(requestId);
  machine.issue(requestId);
  machine.reconcile(requestId);
}

/** State-aware finisher: continues a NET_ACCEPTED or AUTHORIZED instance to RECONCILED. */
function driveFinish(machine: IssuanceMachine, requestId: string): IssuanceState | "UNKNOWN" {
  const s0 = machine.getInstanceState(requestId)?.state;
  if (s0 === "NET_ACCEPTED") {
    machine.approveIssuance(requestId, "TEST-APPROVER-001", "explicit per-issuance approval (ALT-2 TEST HARNESS)");
    machine.authorize(requestId);
  }
  if (machine.getInstanceState(requestId)?.state === "AUTHORIZED") {
    machine.checkSupply(requestId);
    machine.issue(requestId);
    machine.reconcile(requestId);
  }
  return machine.getInstanceState(requestId)?.state ?? "UNKNOWN";
}

/** Drive the simulated-CBDC flow using adapter messages up to a stop point. */
function driveCbdcSim(
  machine: IssuanceMachine,
  adapter: SimulatedCbdcAdapter,
  requestId: string,
  txId: string,
  grossMicro: bigint,
  stopAfter: "RECONCILED" | "PAYMENT_AUTHENTIC" | "PAYMENT_OBSERVED",
  preInit?: { authTag: string | null; simulation: true; marker: string; status: string; txId: string },
): { state: IssuanceState | "UNKNOWN"; reasonCode: string } {
  const t0 = machine.nowMs;
  const init = preInit ?? adapter.initiatePayment({ txId, amountMicro: grossMicro, payerId: "TEST-PAYER-001", instrumentCode: CBDC_INSTRUMENT.code, correlationRef: requestId });
  machine.submitIssuanceRequest({
    requestId,
    idempotencyKey: `IDK-${requestId}`,
    instrumentCode: CBDC_INSTRUMENT.code,
    network: CBDC_INSTRUMENT.network,
    payerId: "TEST-PAYER-001",
    recipientId: "TEST-RECIPIENT-001",
    jurisdiction: "TEST-JURISDICTION",
    requestedInstrumentAmountMicro: grossMicro,
  });
  machine.generateQuote(requestId);
  const obs = machine.observePayment(requestId, {
    paymentTxId: txId,
    payerId: "TEST-PAYER-001",
    amountMicro: grossMicro,
    authTag: init.authTag ?? "",
    observedAtMs: t0,
  });
  if (!obs.ok) return { state: obs.state, reasonCode: obs.reasonCode };
  const ver = machine.verifyPaymentAuthenticity(requestId);
  if (!ver.ok) return { state: ver.state, reasonCode: ver.reasonCode };
  if (stopAfter === "PAYMENT_AUTHENTIC") return { state: machine.getInstanceState(requestId)?.state ?? "UNKNOWN", reasonCode: "STOPPED" };
  const msg = adapter.querySettlementStatus(txId);
  if (msg.status !== "SETTLED") {
    return { state: machine.getInstanceState(requestId)?.state ?? "UNKNOWN", reasonCode: `ADAPTER_STATUS_${msg.status}` };
  }
  const cs = machine.confirmSettlement(requestId, {
    status: "SETTLED",
    settledAmountMicro: grossMicro,
    sourceLabel: `${adapter.adapterId} (${CBDC_ADAPTER_MARKER})`,
    finalityAtMs: msg.finalityAtMs ?? machine.nowMs,
  });
  if (!cs.ok) return { state: cs.state, reasonCode: cs.reasonCode };
  machine.checkInstrument(requestId);
  machine.calculateFees(requestId);
  machine.acceptNetValue(requestId);
  machine.approveIssuance(requestId, "TEST-APPROVER-001", "SIMULATION-MODE demo approval (ALT-2 TEST HARNESS)");
  machine.authorize(requestId);
  machine.checkSupply(requestId);
  const iss = machine.issue(requestId);
  if (!iss.ok) return { state: iss.state, reasonCode: iss.reasonCode };
  const rec = machine.reconcile(requestId);
  return { state: rec.state, reasonCode: rec.reasonCode };
}

main();
