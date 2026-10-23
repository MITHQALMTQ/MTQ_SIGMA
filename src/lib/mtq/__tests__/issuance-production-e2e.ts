// ============================================================================
// MTQΣ — ISSUANCE PRODUCTION E2E · DETERMINISTIC TEST RUNNER (Task M8-3c-a)
// ============================================================================
// Run (from the repository root):
//   bun src/lib/mtq/__tests__/issuance-production-e2e.ts
//
// THE M8-3b PRODUCTION RUNNER referenced by src/lib/mtq/issuance/
// (instrument-registry.ts / separation-check.ts cite "the production runner's
// SEP assertions") — this file IS that runner. It drives the PRODUCTION
// payment-funded primary-issuance engine (src/lib/mtq/issuance/, promoted from
// the validated MANDATE-007 §4 prototype in commit 0e8a19d, tasks M8-3a/M8-3b)
// and the QUIESCENT registry-based constituency layer (src/lib/mtq/constituency/)
// through every mandated scenario with STABLE ASSERTION IDS:
//
//   S0   Labels & registry honesty (born empty · fail-closed admission · TEST
//        fixtures · per-instance identity · CBDC NOT_CONNECTED · no telemetry)
//   S1   Happy path — spec §14.4 12-step workflow under ALT-4 (exact numbers;
//        machine.assertInvariants() after EVERY phase — INV-A..E)
//   S2   Duplicates & replays (request-id replay · idempotency-key duplicate ·
//        duplicate payment txId — never a second execution; INV-C)
//   S3   Delayed finality — quote expiry → EXPIRED_QUOTE, held-or-refunded
//        (spec §6.3 refund state machine PENDING_REFUND → REFUNDED)
//   S4   Failed payment — never mints; taxonomy recorded; refund queued
//   S5   Reversals (ADOPTED decision 3): pre-issuance → CANCELLED (no mint);
//        post-issuance → RECONCILIATION_BREAK + SUSPENDED (fail-closed);
//        recovery ONLY via the explicit authorized remediation path (INV-D)
//   S6   Authorization (INV-A / ALT-4): no program ⇒ refusal (payment alone
//        NEVER mints); revoked mid-flight; attestation MISSING/STALE/MISMATCH
//        ⇒ pipeline suspended; resumeAfterAttestationSuspension authorized path
//   S7   Invalid instrument / payment (unregistered · wrong network · RETIRED ·
//        SUSPENDED · bad auth tag · amount mismatch · jurisdiction · depeg ·
//        finality-evidence gap — correct terminal + taxonomy each)
//   S8   Supply controls — per-tx / tranche / global caps all fail-closed,
//        no partial mint (step 9 before 9b)
//   S9   Three-book reconciliation (spec §6.5): C1–C4 clean after the run; a
//        forced 1-micro ledger break is DETECTED (reconciliation is real)
//   S10  SEP-01 separation invariant (MANDATORY, spec §2 / MANDATE-004 §7):
//        (a) basket snapshot BYTE-IDENTICAL before/after issuance volume;
//        (b) SOURCE-SCAN test-of-absence — issuance data-path modules import
//            NOTHING from weighting/eligibility modules
//   S11  Ledger & persistence: mapEventToDoc exact flat Prisma IssuanceEvent
//        field set (primitive strings, 6-decimal money); in-memory sink
//        collects ALL events; a DELIBERATELY FAILING sink is DISCLOSED (cursor
//        not advanced, events not lost); retry byte-stable. The real Prisma
//        sink is asserted by type/label ONLY — this runner never touches a DB.
//   S12  CBDC adapter honesty — SIMULATED / NOT CONNECTED; every simulated
//        message labeled; one clearly-labeled SIMULATION-MODE demo issuance
//   S13  Constituency quiescence (M8-3a): genesis 7 at STRATEGIC_PRIOR bp,
//        zero transitions ever, empty-directive lifecycle run, weights match
//        the separation-check snapshot
//   INV  Final machine-level invariant sweep (INV-A..E across ALL machines)
//
// DETERMINISM: fixed simulated clocks (machine clock starts at 0; only
// advanceClock() moves it), BigInt-exact money math, no Date.now() in any
// decision path — the ONLY wall-clock surface is the run banner below (the
// evidence transcript strips it when double-run byte-identity is verified).
// Stdout is byte-identical across runs modulo the "ranAt(UTC)" banner line.
//
// Exits 0 ONLY if every assertion passes; exits 1 otherwise (honest reporting:
// the machine-readable JSON record is written even on failure).
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE
// TRANSACTIONS FORBIDDEN · NOT ACCEPTED.
// Zero on-chain actions, zero network calls, zero key/private-key handling.
// "ISSUED" is a LEDGER RECORD ONLY — no token exists, no chain is touched.
// ============================================================================

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALLOWED_TRANSITIONS,
  AUTH_SCHEME_LABEL,
  D_13_27_STATUS,
  FEE_SCHEDULE_LABEL,
  MACHINE_LABEL,
  QUOTE_POLICY_LABEL,
  STATE_STEP_REFS,
  TERMINAL_STATES,
  TEST_ONLY_AUTH_KEY_LITERAL,
  canonicalPaymentPayload,
  computeSyntheticAuthTag,
  reconcileThreeBooks,
  IssuanceMachine,
  type DepegObservation,
  type IssuanceState,
  type StepResult,
} from "../issuance/issuance-machine";
import {
  REGISTRY_LABEL,
  SEPARATION_INVARIANT_TEXT,
  assertNoWeightingTelemetryFields,
  createPaymentInstrumentRegistry,
  verifyRealRailEvidence,
  type PaymentInstrumentRegistry,
  type RealRailEvidence,
} from "../issuance/instrument-registry";
import {
  ALT4_ADOPTION_LABEL,
  AUTHORIZATION_MODULE_LABEL,
  SYNTHETIC_SIGNATURE_LABEL,
  StubAttester,
} from "../issuance/authorization";
import {
  ISSUANCE_TEST_FIXTURES_LABEL,
  TEST_CBDC_INSTRUMENT,
  TEST_FIXTURE_ROWS,
  TEST_INSTRUMENT,
  installIssuanceTestFixtures,
} from "../issuance/test-fixtures";
import {
  CBDC_ADAPTER_MARKER,
  CBDC_ADAPTER_STATUS,
  SimulatedCbdcAdapter,
  cbdcAdapterHonestyRecord,
} from "../issuance/cbdc-adapter";
import {
  FEE_SCHEDULE,
  QUOTE_POLICY,
  SUPPLY_POLICY,
  fmt6,
  type SupplyPolicy,
} from "../issuance/parameters";
import {
  IssuanceLedger,
  createInMemoryIssuanceEventSink,
  createPrismaIssuanceEventSink,
  mapEventToDoc,
  type IssuanceEventDoc,
  type IssuanceEventSink,
} from "../issuance/ledger";
import {
  SEPARATION_CHECK_LABEL,
  basketSnapshotBytes,
  basketSnapshotsByteIdentical,
  captureBasketSnapshot,
} from "../issuance/separation-check";
import {
  DEFAULT_REGISTRY,
  GENESIS_DOSSIER_REF,
  GENESIS_REGISTRY_ENTRIES,
  createGenesisConstituencyRegistry,
  defaultActiveBasketCount,
  defaultGenesisWeightsBp,
} from "../constituency/registry";
import { LIFECYCLE_PARAMETER_CLASS, defaultLifecycleParameters } from "../constituency/parameters";
import { runLifecycleSimulation } from "../constituency/engine";
import { computeDatasetHash } from "../constituency/serialization";
import type { Dataset, UniverseEntry } from "../constituency/types";
import { ADMISSIBILITY_ENVELOPES, BASE_FIXINGS, MAX_VELOCITY, STRATEGIC_PRIOR } from "../blueprint";

// ----------------------------------------------------------------------------
// Paths (resolved from THIS file — the runner is cwd-independent)
// ----------------------------------------------------------------------------

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(THIS_DIR, "..", "..", "..", "..");
const ISSUANCE_DIR = path.join(REPO_ROOT, "src", "lib", "mtq", "issuance");
const PRISMA_SCHEMA = path.join(REPO_ROOT, "prisma", "schema.prisma");
const EVIDENCE_JSON_PATH = path.join(
  REPO_ROOT,
  "audit-work",
  "task13",
  "evidence",
  "issuance-production-results-mandate008.json",
);
const SCRIPT_ID = "src/lib/mtq/__tests__/issuance-production-e2e.ts";

// ----------------------------------------------------------------------------
// Assertion bookkeeping (stable ids + printed observed values)
// ----------------------------------------------------------------------------

interface AssertionRecord {
  id: string;
  section: string;
  sectionName: string;
  name: string;
  pass: boolean;
  expected: string;
  observed: string;
}

const assertions: AssertionRecord[] = [];
let currentSection = "S0";
let currentSectionName = "";

function section(id: string, title: string): void {
  currentSection = id;
  currentSectionName = title;
  console.log(`\n=== ${id} — ${title} ===`);
}

function track(id: string, name: string, pass: boolean, expected: string, observed: string): void {
  assertions.push({ id, section: currentSection, sectionName: currentSectionName, name, pass, expected, observed });
  console.log(`  ${pass ? "✓" : "✗"} [${id}] ${name}`);
  console.log(`      expected: ${expected}`);
  console.log(`      observed: ${observed}`);
}

function eq(id: string, name: string, actual: unknown, expected: unknown): boolean {
  const a = typeof actual === "bigint" ? actual.toString(10) : String(actual);
  const e = typeof expected === "bigint" ? expected.toString(10) : String(expected);
  track(id, name, a === e, e, a);
  return a === e;
}

function check(id: string, name: string, pass: boolean, observed: string): boolean {
  track(id, name, pass, "true", observed);
  return pass;
}

/** machine.assertInvariants() must PASS (INV-A..E) — throws are caught + reported. */
function invOk(machine: IssuanceMachine): { ok: boolean; message: string } {
  try {
    machine.assertInvariants();
    return { ok: true, message: "assertInvariants() passed (INV-A..E)" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// ----------------------------------------------------------------------------
// Machine factory + ALT-4 governed-act helpers + scenario driver
// ----------------------------------------------------------------------------

const GROSS_10K = 10_000_000_000n; // 10,000.000000 TEST-USDC-X (6-decimal micro)
const PROGRAM_CAP_MICRO = 10_000_000_000_000n; // 10,000,000.000000 tokens — ILLUSTRATIVE program envelope
const PROGRAM_WINDOW_END_MS = 4_102_444_800_000; // year 2100 on the fixed machine clock

const attester = new StubAttester("STUB-ATTESTER-TEST-ONLY");

const allMachines: Array<{ machineId: string; machine: IssuanceMachine; registry: PaymentInstrumentRegistry }> = [];

function newMachine(opts: {
  machineId: string;
  supplyPolicy?: SupplyPolicy;
  cbdcSimulation?: boolean;
  fixtures?: boolean;
}): { machine: IssuanceMachine; registry: PaymentInstrumentRegistry } {
  const registry = createPaymentInstrumentRegistry(0);
  if (opts.fixtures !== false) installIssuanceTestFixtures(registry);
  const machine = new IssuanceMachine({
    machineId: opts.machineId,
    registry,
    supplyPolicy: opts.supplyPolicy ?? SUPPLY_POLICY,
    clockStartMs: 0,
    cbdcSimulationMode: opts.cbdcSimulation ? { enabled: true, label: "SIMULATED — NOT CONNECTED" } : undefined,
  });
  allMachines.push({ machineId: opts.machineId, machine, registry });
  return { machine, registry };
}

/** The ALT-4 explicit governed acts: define a program covering the given instruments. */
function defineProgram(
  machine: IssuanceMachine,
  programId: string,
  instruments: readonly { code: string; network: string }[] = [{ ...TEST_INSTRUMENT }],
): void {
  const res = machine.defineIssuanceProgram({
    programId,
    instruments: instruments.map((i) => ({ ...i })),
    perProgramCapMicro: PROGRAM_CAP_MICRO,
    perTxCapMicro: PROGRAM_CAP_MICRO,
    windowStartMs: 0,
    windowEndMs: PROGRAM_WINDOW_END_MS,
  });
  if (!res.ok) throw new Error(`defineProgram(${programId}) failed: ${res.reasonCode}`);
}

/** Record a FRESH matching periodic attestation (the ALT-4 operational duty). */
function recordFreshAttestation(machine: IssuanceMachine, attestationId: string, matched = true): void {
  const res = machine.recordAttestation(
    attester.attest({
      attestationId,
      nowMs: machine.nowMs,
      matched,
      notes: matched
        ? "observed issuance matched the program rule; three books reconciled (STUB — TEST-ONLY)"
        : "observed issuance DID NOT match the program rule (STUB — TEST-ONLY; deliberate mismatch fixture)",
    }),
  );
  if (!res.ok) throw new Error(`recordAttestation(${attestationId}) failed: ${res.reasonCode}`);
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
  paymentAmountOverride?: bigint;
  stopAfter?: StopPoint;
  /** null = do NOT settle (adversarial callers drive settlement themselves). */
  settle?: {
    status?: "SETTLED" | "FAILED" | "REVERSED" | "TIMEOUT";
    confirmations?: number;
    issuerSanityCheckPassed?: boolean;
    settledAmountMicro?: bigint;
    pegDeviationBps?: number;
    sustainedHours?: number;
    sourceLabel?: string;
    finalityAtMs?: number;
  } | null;
  depegObs?: DepegObservation;
}

/** Drive one request through the §14.4 workflow up to a stop point (stops early on any step failure). */
function drive(machine: IssuanceMachine, o: DriveOpts): { last: StepResult } {
  const stopIdx = STOP_ORDER.indexOf(o.stopAfter ?? "RECONCILED");
  const instrumentCode = o.instrumentCode ?? TEST_INSTRUMENT.code;
  const network = o.network ?? TEST_INSTRUMENT.network;
  const payerId = o.payerId ?? "TEST-PAYER-001";
  const payAmount = o.paymentAmountOverride ?? o.grossMicro;

  let last: StepResult = machine.submitIssuanceRequest({
    requestId: o.requestId,
    idempotencyKey: o.idemKey ?? `IDK-${o.requestId}`,
    instrumentCode,
    network,
    payerId,
    recipientId: "TEST-RECIPIENT-001",
    jurisdiction: o.jurisdiction ?? "TEST-JURISDICTION",
    requestedInstrumentAmountMicro: o.grossMicro,
  });
  if (stopIdx < 1 || !last.ok) return { last };

  last = machine.generateQuote(o.requestId);
  if (stopIdx < 2 || !last.ok) return { last };

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
        payerId,
        amountMicro: payAmount,
        observedAtMs: observedAt,
      }),
    );
  last = machine.observePayment(o.requestId, { paymentTxId: txId, payerId, amountMicro: payAmount, authTag, observedAtMs: observedAt });
  if (stopIdx < 3 || !last.ok) return { last };

  last = machine.verifyPaymentAuthenticity(o.requestId);
  if (stopIdx < 4 || !last.ok) return { last };

  if (o.settle !== null) {
    const s = o.settle ?? { status: "SETTLED" as const };
    last = machine.confirmSettlement(o.requestId, {
      status: s.status ?? "SETTLED",
      confirmations: s.confirmations ?? 3,
      issuerSanityCheckPassed: s.issuerSanityCheckPassed ?? true,
      settledAmountMicro: s.settledAmountMicro ?? payAmount,
      pegDeviationBps: s.pegDeviationBps,
      sustainedHours: s.sustainedHours,
      sourceLabel: s.sourceLabel,
      finalityAtMs: s.finalityAtMs,
    });
    if (!last.ok) return { last };
    last = machine.checkInstrument(o.requestId, o.depegObs);
    if (!last.ok) return { last };
    last = machine.calculateFees(o.requestId);
    if (!last.ok) return { last };
    last = machine.acceptNetValue(o.requestId);
    if (stopIdx < 5 || !last.ok) return { last };
    last = machine.authorize(o.requestId);
    if (stopIdx < 6 || !last.ok) return { last };
    last = machine.checkSupply(o.requestId);
    if (!last.ok) return { last }; // SUPPLY_CHECKED is a pass-through state — only failures stop here
    last = machine.issue(o.requestId);
    if (stopIdx < 7 || !last.ok) return { last };
    last = machine.reconcile(o.requestId);
  }
  return { last };
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main(): Promise<void> {
  const startedAtUTC = new Date().toISOString();
  console.log("MTQΣ — MANDATE-008 · M8-3c-a · ISSUANCE PRODUCTION DETERMINISTIC E2E RUNNER");
  console.log(`ranAt(UTC): ${startedAtUTC}   <-- run banner (the ONLY wall-clock surface; all logic uses the fixed machine clock)`);
  console.log(`machine label: ${MACHINE_LABEL}`);
  console.log(`D-13.27: ${D_13_27_STATUS}`);
  console.log(`auth scheme: ${AUTH_SCHEME_LABEL}`);
  console.log(`separation invariant: ${SEPARATION_INVARIANT_TEXT}`);
  console.log(`registry label: ${REGISTRY_LABEL}`);
  console.log(`adapter status: ${CBDC_ADAPTER_STATUS}`);
  console.log(`posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED`);
  console.log("honest scope: PRODUCTION TS REFERENCE ENGINE evidence only — synthetic TEST-ONLY instruments, LEDGER RECORDS ONLY, never on-chain.\n");

  // =========================================================================
  // S0 — Labels & registry honesty
  // =========================================================================
  section("S0", "Labels & registry honesty (born empty · fail-closed admission · TEST fixtures · per-instance identity · CBDC NOT_CONNECTED · no telemetry)");
  {
    // (1) born empty
    const emptyRegistry = createPaymentInstrumentRegistry(0);
    eq("S0-01", "production registry is BORN EMPTY (rowCount 0)", emptyRegistry.rowCount, 0);
    eq("S0-02", "born-empty registry exposes zero rows", emptyRegistry.allRows().length, 0);
    eq("S0-03", "registry label declares BORN EMPTY + FAIL-CLOSED admission", REGISTRY_LABEL.includes("BORN EMPTY") && REGISTRY_LABEL.includes("FAIL-CLOSED ADMISSION") ? "declared" : "missing", "declared");

    // (2) fail-closed admission refuses a "real-looking" row
    const admitEmpty = emptyRegistry.admitInstrument({
      instrumentId: "USDC-ETHEREUM-REAL-LOOKING",
      evidence: null,
      notes: "real-looking admission dossier (synthetic test attempt)",
    });
    check(
      "S0-04",
      "admission of a real-looking row into the BORN-EMPTY registry REFUSED (no CANDIDATE row exists; fail-closed)",
      !admitEmpty.ok && admitEmpty.reasonCode.startsWith("ADMISSION_BLOCKED_INSTRUMENT_NOT_FOUND"),
      `reasonCode=${admitEmpty.reasonCode}`,
    );
    const vNull = verifyRealRailEvidence(null);
    const fakeRealEvidence = {
      __brand: "REAL-RAIL-EVIDENCE — CANNOT BE PRODUCED IN THIS PILOT",
      perRailSignatureVerificationRecord: "SYNTHETIC per-rail signature verification record (real-looking test attempt)",
      endToEndTestRecord: "SYNTHETIC end-to-end test record (real-looking test attempt)",
      authorizedInterfaceIdentity: "SYNTHETIC authorized interface identity (real-looking test attempt)",
    } as RealRailEvidence;
    const vFake = verifyRealRailEvidence(fakeRealEvidence);
    check(
      "S0-05",
      "verifyRealRailEvidence NEVER verifies in this pilot — null evidence AND a real-looking evidence object BOTH refused (no real rail / no signature verification / no authorized interface exists)",
      !vNull.ok && !vFake.ok,
      `null→${vNull.reason.slice(0, 60)}…; object→${vFake.reason.slice(0, 60)}…`,
    );

    // (3) TEST fixtures install
    const fixtureRegistry = createPaymentInstrumentRegistry(0);
    installIssuanceTestFixtures(fixtureRegistry);
    eq("S0-06", "TEST fixture provider installs exactly the 5 synthetic rows", fixtureRegistry.rowCount, 5);
    eq("S0-07", "fixture provider label declares TEST-ONLY + NO REAL INSTRUMENT", ISSUANCE_TEST_FIXTURES_LABEL.includes("TEST-ONLY") && ISSUANCE_TEST_FIXTURES_LABEL.includes("NO REAL INSTRUMENT IS REGISTERED ANYWHERE") ? "declared" : "missing", "declared");
    const main = fixtureRegistry.findByCodeAndNetwork(TEST_INSTRUMENT.code, TEST_INSTRUMENT.network);
    check(
      "S0-08",
      "TEST-USDC-X @ TEST-CHAIN-1 installed ACTIVE and stamped TEST-ONLY (synthetic identity, non-hex address)",
      main !== undefined &&
        main.state === "ACTIVE" &&
        main.testOnly === true &&
        main.statusLabel.includes("TEST-ONLY") &&
        !/^0x[0-9a-fA-F]{40}$/.test(main.contractAddressOrRailId),
      `state=${main?.state}, testOnly=${main?.testOnly}, address=${main?.contractAddressOrRailId}`,
    );
    check("S0-09", "the ACTIVE test row carries a NON-EMPTY evidence list (spec §3: an ACTIVE row with empty evidence is invalid by construction)", (main?.evidence.length ?? 0) > 0, `evidence entries=${main?.evidence.length}`);

    // (4) admission with a real-looking dossier on the fixture registry ALSO refused
    const admitFixture = fixtureRegistry.admitInstrument({
      instrumentId: "TEST-STBL-001",
      evidence: fakeRealEvidence,
      notes: "real-looking dossier attempt against the ACTIVE test row",
    });
    check(
      "S0-10",
      "admission with a real-looking evidence dossier REFUSED fail-closed even against an existing row (verifyRealRailEvidence can never succeed in this pilot)",
      !admitFixture.ok && admitFixture.reasonCode.startsWith("ADMISSION_BLOCKED_FAIL_CLOSED"),
      `reasonCode=${admitFixture.reasonCode.slice(0, 80)}…`,
    );

    // (5) per-instance identity rule: same code on a different network is a DIFFERENT row
    const chain2 = fixtureRegistry.findByCodeAndNetwork("TEST-USDC-X", "TEST-CHAIN-2 (SYNTHETIC)");
    check(
      "S0-11",
      "per-instance identity rule: the SAME code on TEST-CHAIN-2 is a SEPARATE row that is CANDIDATE (never auto-approved by the TEST-CHAIN-1 row; spec §14.2 rule (a))",
      chain2 !== undefined && chain2.instrumentId !== main?.instrumentId && chain2.state === "CANDIDATE",
      `instrumentId=${chain2?.instrumentId} (vs ${main?.instrumentId}), state=${chain2?.state}`,
    );
    check(
      "S0-12",
      "per-instance lookup by code+network never resolves a ticker alone (TEST-CHAIN-1 lookup → TEST-STBL-001 only)",
      fixtureRegistry.findByCodeAndNetwork("TEST-USDC-X", "TEST-CHAIN-1 (SYNTHETIC)")?.instrumentId === "TEST-STBL-001",
      `resolved=${fixtureRegistry.findByCodeAndNetwork("TEST-USDC-X", "TEST-CHAIN-1 (SYNTHETIC)")?.instrumentId}`,
    );

    // (6) CBDC rows born SIMULATED/NOT_CONNECTED and structurally inadmissible
    const cbdc1 = fixtureRegistry.byId("TEST-CBDC-001");
    const cbdc2 = fixtureRegistry.byId("TEST-CBDC-002");
    check(
      "S0-13",
      "CBDC rows are born CANDIDATE + honestyState NOT_CONNECTED with the SIMULATED / NOT CONNECTED label",
      cbdc1?.state === "CANDIDATE" && cbdc1?.honestyState === "NOT_CONNECTED" && cbdc1?.statusLabel.includes("SIMULATED / NOT CONNECTED") && cbdc2?.honestyState === "NOT_CONNECTED",
      `cbdc1=${cbdc1?.state}/${cbdc1?.honestyState}, cbdc2=${cbdc2?.state}/${cbdc2?.honestyState}`,
    );
    const cbdcAdmit = fixtureRegistry.transition("TEST-CBDC-001", "ADMIT", "attempted admission without a verified authorized interface");
    check(
      "S0-14",
      "CBDC admission is STRUCTURALLY INADMISSIBLE (verified authorized interface + recorded end-to-end test — NEITHER EXISTS; spec §5.3/§4)",
      !cbdcAdmit.ok && cbdcAdmit.reasonCode.startsWith("ADMISSION_BLOCKED_NOT_CONNECTED"),
      `reasonCode=${cbdcAdmit.reasonCode.slice(0, 80)}…`,
    );

    // (7) no weighting-telemetry fields on ANY row (spec §2 structural separation)
    const telemetryOk = fixtureRegistry.allRows().every((r) => assertNoWeightingTelemetryFields(r).ok);
    const fixtureTelemetryOk = TEST_FIXTURE_ROWS.every((r) => assertNoWeightingTelemetryFields(r).ok);
    check(
      "S0-15",
      "NO weighting/eligibility/basket/constituency telemetry fields exist on ANY registry row (installed rows AND frozen fixture definitions)",
      telemetryOk && fixtureTelemetryOk,
      `installedRowsClean=${telemetryOk}, fixtureDefsClean=${fixtureTelemetryOk}`,
    );

    // (8) label constants exposed
    check(
      "S0-16",
      "D-13.27 status label: ALT-4 ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION, with the adopted decision-3 naming (pre-issuance CANCELLED / post-issuance RECONCILIATION_BREAK)",
      D_13_27_STATUS.includes("ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION") && D_13_27_STATUS.includes("ALT-4") && D_13_27_STATUS.includes("CANCELLED") && D_13_27_STATUS.includes("RECONCILIATION_BREAK"),
      D_13_27_STATUS.slice(0, 120) + "…",
    );
    check(
      "S0-17",
      "the 21-state model uses the ADOPTED decision-3 naming: CANCELLED exists, the prototype's PAYMENT_REVERSED terminal does NOT",
      "CANCELLED" in ALLOWED_TRANSITIONS && !("PAYMENT_REVERSED" in ALLOWED_TRANSITIONS) && TERMINAL_STATES.includes("CANCELLED") && !TERMINAL_STATES.includes("PAYMENT_REVERSED" as IssuanceState),
      `states=${Object.keys(ALLOWED_TRANSITIONS).length}, CANCELLED=${"CANCELLED" in ALLOWED_TRANSITIONS}, PAYMENT_REVERSED=${"PAYMENT_REVERSED" in ALLOWED_TRANSITIONS}`,
    );
    eq("S0-18", "21 states in the model (12 flow + 9 terminal failure); every state carries a §14.4 step reference", `${Object.keys(ALLOWED_TRANSITIONS).length}/${TERMINAL_STATES.length}/${Object.keys(STATE_STEP_REFS).length}`, "21/9/21");
    check(
      "S0-19",
      "honesty labels exposed: fee schedule UNAPPROVED (D-13.8), quote policy ILLUSTRATIVE (§14.5), supply policy ILLUSTRATIVE (D-13.6)",
      FEE_SCHEDULE_LABEL.includes("UNAPPROVED") && FEE_SCHEDULE_LABEL.includes("D-13.8") && QUOTE_POLICY_LABEL.includes("ILLUSTRATIVE") && SUPPLY_POLICY.label.includes("ILLUSTRATIVE") && SUPPLY_POLICY.label.includes("fail-closed"),
      `fee=${FEE_SCHEDULE_LABEL.slice(0, 40)}…; quote=${QUOTE_POLICY_LABEL.slice(0, 40)}…; supply=${SUPPLY_POLICY.label.slice(0, 40)}…`,
    );
    check(
      "S0-20",
      "ALT-4 authorization labels exposed (module + adoption + synthetic-signature disclosure; TEST-ONLY auth key literal is published, not secret)",
      AUTHORIZATION_MODULE_LABEL.includes("INV-A") && ALT4_ADOPTION_LABEL.includes("PENDING OWNER RATIFICATION") && SYNTHETIC_SIGNATURE_LABEL.includes("NOT cryptographic") && TEST_ONLY_AUTH_KEY_LITERAL === "TEST-ONLY-NOT-A-SECRET",
      `module+adoption+signature labels present; keyLiteral=${TEST_ONLY_AUTH_KEY_LITERAL}`,
    );
    check(
      "S0-21",
      "ILLUSTRATIVE named defaults verified: fee 0.10% (10bps) · quote 2.000000 TU/token · validity 15 min (900,000ms) · caps 500,000 / 1,000,000 / 10,000,000 tokens",
      FEE_SCHEDULE.rateBps === 10n && QUOTE_POLICY.quoteTUPerTokenMicro === 2_000_000n && QUOTE_POLICY.quoteTtlMs === 900_000 && SUPPLY_POLICY.perTxCapMicro === 500_000_000_000n && SUPPLY_POLICY.trancheCapMicro === 1_000_000_000_000n && SUPPLY_POLICY.globalMaxSupplyMicro === 10_000_000_000_000n,
      `fee=${FEE_SCHEDULE.rateBps}bps, quote=${fmt6(QUOTE_POLICY.quoteTUPerTokenMicro)}, ttl=${QUOTE_POLICY.quoteTtlMs}ms, perTx=${fmt6(SUPPLY_POLICY.perTxCapMicro)}, tranche=${fmt6(SUPPLY_POLICY.trancheCapMicro)}, global=${fmt6(SUPPLY_POLICY.globalMaxSupplyMicro)}`,
    );
    check(
      "S0-22",
      "separation-check label declares the READ-ONLY display/test-side role (the checker lives OUTSIDE the issuance data path)",
      SEPARATION_CHECK_LABEL.includes("READ-ONLY") && SEPARATION_CHECK_LABEL.includes("byte-identical"),
      SEPARATION_CHECK_LABEL.slice(0, 100) + "…",
    );
  }

  // =========================================================================
  // S1 — Happy path (spec §14.4 12-step workflow under ALT-4) — EXACT numbers
  // =========================================================================
  section("S1", "Happy path — spec §14.4 12 steps under ALT-4: gross 10000.000000 TEST-USDC-X → fee 10.000000 → net 9990.000000 → issued 4995.000000 @ quote 2.000000");
  const e2e = newMachine({ machineId: "M-E2E" });
  {
    eq("S1-01", "supply before any issuance", e2e.machine.getSupplySnapshot().totalSupplyMicro, "0.000000");

    // ALT-4 explicit governed acts FIRST (a payment event can never create either)
    const prog = e2e.machine.defineIssuanceProgram({
      programId: "PROG-E2E-001",
      instruments: [{ code: TEST_INSTRUMENT.code, network: TEST_INSTRUMENT.network }],
      perProgramCapMicro: PROGRAM_CAP_MICRO,
      perTxCapMicro: PROGRAM_CAP_MICRO,
      windowStartMs: 0,
      windowEndMs: PROGRAM_WINDOW_END_MS,
    });
    check(
      "S1-02",
      "ALT-4 governed act: issuance program defined (synthetic TEST-TAG signature, never a payment event) with the adoption label",
      prog.ok && /^TEST-TAG-[0-9a-f]{16}$/.test(prog.program?.signatureTag ?? "") && (prog.program?.label ?? "").includes("PENDING OWNER RATIFICATION"),
      `programId=${prog.program?.programId}, signatureTag=${prog.program?.signatureTag}`,
    );
    const dupProg = e2e.machine.defineIssuanceProgram({
      programId: "PROG-E2E-001",
      instruments: [{ code: TEST_INSTRUMENT.code, network: TEST_INSTRUMENT.network }],
      perProgramCapMicro: PROGRAM_CAP_MICRO,
      perTxCapMicro: PROGRAM_CAP_MICRO,
      windowStartMs: 0,
      windowEndMs: PROGRAM_WINDOW_END_MS,
    });
    check("S1-03", "duplicate programId REFUSED (programs are explicit records, not idempotent overwrites)", !dupProg.ok && dupProg.reasonCode === "PROGRAM_ID_ALREADY_EXISTS", `reasonCode=${dupProg.reasonCode}`);
    const att = recordAttestationChecked(e2e.machine, "ATT-E2E-001");
    check("S1-04", "ALT-4 governed act: fresh matching periodic attestation recorded (STUB attester, clearly labeled)", att.ok && e2e.machine.attestationStatus().kind === "OK", `attestationStatus=${e2e.machine.attestationStatus().kind}`);

    // Step-by-step drive with assertInvariants() after EVERY phase
    const R = "S1-R1";
    const steps: Array<() => StepResult> = [
      () => e2e.machine.submitIssuanceRequest({ requestId: R, idempotencyKey: `IDK-${R}`, instrumentCode: TEST_INSTRUMENT.code, network: TEST_INSTRUMENT.network, payerId: "TEST-PAYER-001", recipientId: "TEST-RECIPIENT-001", jurisdiction: "TEST-JURISDICTION", requestedInstrumentAmountMicro: GROSS_10K }),
      () => e2e.machine.generateQuote(R),
      () => e2e.machine.observePayment(R, { paymentTxId: `PAY-TX-${R}`, payerId: "TEST-PAYER-001", amountMicro: GROSS_10K, authTag: computeSyntheticAuthTag(TEST_ONLY_AUTH_KEY_LITERAL, canonicalPaymentPayload({ paymentTxId: `PAY-TX-${R}`, instrumentCode: TEST_INSTRUMENT.code, network: TEST_INSTRUMENT.network, payerId: "TEST-PAYER-001", amountMicro: GROSS_10K, observedAtMs: e2e.machine.nowMs })), observedAtMs: e2e.machine.nowMs }),
      () => e2e.machine.verifyPaymentAuthenticity(R),
      () => e2e.machine.confirmSettlement(R, { status: "SETTLED", confirmations: 3, issuerSanityCheckPassed: true, settledAmountMicro: GROSS_10K }),
      () => e2e.machine.checkInstrument(R),
      () => e2e.machine.calculateFees(R),
      () => e2e.machine.acceptNetValue(R),
      () => e2e.machine.authorize(R),
      () => e2e.machine.checkSupply(R),
      () => e2e.machine.issue(R),
      () => e2e.machine.reconcile(R),
    ];
    const expectedStates: IssuanceState[] = [
      "REQUEST_CREATED", "QUOTED", "PAYMENT_OBSERVED", "PAYMENT_AUTHENTIC", "SETTLEMENT_FINAL",
      "INSTRUMENT_CHECKED", "FEES_CALCULATED", "NET_ACCEPTED", "AUTHORIZED", "SUPPLY_CHECKED", "ISSUED", "RECONCILED",
    ];
    for (let i = 0; i < steps.length; i++) {
      const res = steps[i]();
      const inv = invOk(e2e.machine);
      check(
        `S1-${String(5 + i).padStart(2, "0")}`,
        `step ${i + 1}/12 → ${expectedStates[i]} and machine.assertInvariants() PASSES after the phase (INV-A..E)`,
        res.ok && e2e.machine.getInstanceState(R)?.state === expectedStates[i] && inv.ok,
        `state=${e2e.machine.getInstanceState(R)?.state}, stepOk=${res.ok}, invariants=${inv.ok ? "PASS" : inv.message.slice(0, 80)}`,
      );
    }

    // EXACT numbers
    const quoted = e2e.machine.getEventLog().find((e) => e.requestId === R && e.to === "QUOTED");
    check(
      "S1-17",
      "quote record carries id, price basis, quote-unit conversion, fee line item, spread disclosure and the 15-min validity window (spec §6.1)",
      quoted !== undefined &&
        quoted.detail.includes("quote QUOTE-S1-R1") &&
        quoted.detail.includes("gross 10000.000000 TEST-USDC-X → 10000.000000 TU @ conversion 1.000000") &&
        quoted.detail.includes("issuance quote 2.000000 TU/token") &&
        quoted.detail.includes("fee class FLAT-10BPS (ILLUSTRATIVE) @ 10bps") &&
        quoted.detail.includes("spread 0bps disclosed") &&
        quoted.detail.includes("expires at 900000ms"),
      quoted ? quoted.detail.slice(0, 140) + "…" : "missing",
    );
    const st = e2e.machine.getInstanceState(R);
    eq("S1-18", "fee = 0.10% of gross (EXACT integer math; ILLUSTRATIVE — D-13.8 OPEN)", st?.feeMicro, "10.000000");
    eq("S1-19", "net = gross − fee (step 8)", st?.netTUMicro, "9990.000000");
    eq("S1-20", "issued = net ÷ quote = 9990.000000 ÷ 2.000000 (§14.5 general form)", st?.issuedMicro, "4995.000000");
    eq("S1-21", "gross TU recorded on the instance", st?.grossTUMicro, "10000.000000");
    const mint = e2e.machine.getMintRecord(R);
    check(
      "S1-22",
      "idempotent mint record carries the LEDGER-RECORD-ONLY label (nonce 1, idempotency key, NO on-chain action)",
      mint !== null && mint.nonce === 1 && mint.idempotencyKey === "IDK-S1-R1" && mint.recordOnlyLabel.includes("LEDGER RECORD ONLY") && mint.recordOnlyLabel.includes("NEVER ON-CHAIN") && mint.recordOnlyLabel.includes("no chain action occurs"),
      mint ? `mintId=${mint.mintId}, nonce=${mint.nonce}, label=${mint.recordOnlyLabel.slice(0, 60)}…` : "missing",
    );
    const supply = e2e.machine.getSupplySnapshot();
    eq("S1-23", "supply 0.000000 → 4995.000000 (LEDGER-ONLY counter)", supply.totalSupplyMicro, "4995.000000");
    eq("S1-24", "tranche consumption after the issuance", supply.trancheIssuedMicro, "4995.000000");
    eq("S1-25", "fee ledger total (booked, ILLUSTRATIVE)", supply.feeBookTotalMicro, "10.000000");
    eq("S1-26", "exactly ONE mint record", supply.mintCount, 1);
    check(
      "S1-27",
      "authorization record is ALT-4 under the defined program (INV-A precondition, explicit governed act — never a payment event)",
      st?.hasAuthorizationRecord === true && st?.authorizationProgramId === "PROG-E2E-001" && st?.settlementFinal === true,
      `hasAuth=${st?.hasAuthorizationRecord}, program=${st?.authorizationProgramId}, settlementFinal=${st?.settlementFinal}`,
    );
    const audit = e2e.machine.publishAuditLog();
    const transitions = audit.entries.filter((e) => e.to !== null && e.requestId === R).map((e) => e.to as string);
    eq(
      "S1-28",
      "audit log records the §14.4 step sequence in order (steps 1+3, 2, 4, 4a, 4b, 5, 7, 6+8, 9, 9b, 10, 11)",
      transitions.join(","),
      expectedStates.join(","),
    );
    check(
      "S1-29",
      "audit publication carries a synthetic publication tag (TEST-TAG-<16 hex>, never a 64-char literal) + every entry has a reason code",
      /^TEST-TAG-[0-9a-f]{16}$/.test(audit.publicationTag) && audit.entries.every((e) => e.reasonCode.length > 0),
      `publicationTag=${audit.publicationTag}, entries=${audit.entries.length}`,
    );
    const recon = reconcileThreeBooks(e2e.machine.ledgerSnapshot());
    check("S1-30", "three-book equality after the happy path (C1–C4 all PASS, spec §6.5)", recon.balanced, JSON.stringify(recon.checks.map((c) => `${c.check.split("_")[0]}=${c.passed ? "PASS" : "FAIL"}`)));
    eq(
      "S1-31",
      "book totals agree (payment ledger = issuance ledger = token book + fee ledger)",
      JSON.stringify(recon.bookTotals),
      JSON.stringify({ paymentLedgerSettledCount: "1", issuanceRecordCount: "1", tokenBookSum: "4995.000000", totalSupply: "4995.000000", feeLedgerTotal: "10.000000" }),
    );
  }

  // =========================================================================
  // S2 — Duplicates & replays (INV-C: never a second execution)
  // =========================================================================
  section("S2", "Duplicates & replays — request-id replay · same idempotency key · duplicate payment txId (never a second execution)");
  {
    const m = e2e.machine;
    eq("S2-01", "first issuance completed (RECONCILED, 4995.000000 minted)", m.getInstanceState("S1-R1")?.issuedMicro, "4995.000000");
    const instancesBefore = m.getInstanceCount();

    // (a) SAME requestId resubmitted (with a NEW idempotency key + a new payment would follow)
    const replay = m.submitIssuanceRequest({
      requestId: "S1-R1",
      idempotencyKey: "IDK-S2-REPLAY",
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K,
    });
    check(
      "S2-02",
      "same requestId resubmitted → REPLAY DETECTED: the ORIGINAL outcome is returned, created=false, NO second execution (spec §6.4)",
      !replay.ok && replay.replayDetected && replay.created === false && replay.originalOutcomeRef === "S1-R1" && replay.state === "RECONCILED",
      `replayDetected=${replay.replayDetected}, created=${replay.created}, originalOutcomeRef=${replay.originalOutcomeRef}, state=${replay.state}`,
    );
    const cont1 = m.generateQuote("S1-R1");
    const cont2 = m.observePayment("S1-R1", { paymentTxId: "PAY-TX-S2-NEW", payerId: "TEST-PAYER-001", amountMicro: GROSS_10K, authTag: "TEST-TAG-0000000000000000" });
    check(
      "S2-03",
      "the completed instance cannot continue: quote and new-payment observation both REJECTED (terminal state is immutable)",
      !cont1.ok && !cont2.ok,
      `generateQuote=${cont1.reasonCode.slice(0, 40)}…; observePayment=${cont2.reasonCode.slice(0, 40)}…`,
    );
    eq("S2-04", "instance count UNCHANGED by the replay (no new pipeline instance)", m.getInstanceCount(), instancesBefore);

    // (b) NEW requestId under the SAME idempotency key (with a NEW payment) → DUPLICATE terminal
    const dup = m.submitIssuanceRequest({
      requestId: "S2-R2",
      idempotencyKey: "IDK-S1-R1", // SAME idempotency key as the completed request
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K,
    });
    check(
      "S2-05",
      "same idempotency key + new request/payment after completion → DUPLICATE terminal; original result referenced; still 1 mint (INV-C)",
      !dup.ok && dup.state === "DUPLICATE" && dup.duplicateOf === "S1-R1" && m.getInstanceState("S2-R2") === null,
      `state=${dup.state}, duplicateOf=${dup.duplicateOf}, instanceStored=${m.getInstanceState("S2-R2") !== null}`,
    );

    // (c) duplicate payment txId under a fresh key
    const r3 = m.submitIssuanceRequest({
      requestId: "S2-R3",
      idempotencyKey: "IDK-S2-R3",
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K,
    });
    m.generateQuote("S2-R3");
    const dupTx = m.observePayment("S2-R3", {
      paymentTxId: "PAY-TX-S1-R1", // SAME payment txId as the completed issuance
      payerId: "TEST-PAYER-001",
      amountMicro: GROSS_10K,
      authTag: computeSyntheticAuthTag(
        TEST_ONLY_AUTH_KEY_LITERAL,
        canonicalPaymentPayload({ paymentTxId: "PAY-TX-S1-R1", instrumentCode: TEST_INSTRUMENT.code, network: TEST_INSTRUMENT.network, payerId: "TEST-PAYER-001", amountMicro: GROSS_10K, observedAtMs: m.nowMs }),
      ),
      observedAtMs: m.nowMs,
    });
    check(
      "S2-06",
      "duplicate payment txId REJECTED → DUPLICATE terminal (DUPLICATE_PAYMENT_TX; never a second execution)",
      r3.ok && !dupTx.ok && dupTx.state === "DUPLICATE",
      `submission=${r3.state}; observe=${dupTx.state} (${dupTx.reasonCode.slice(0, 40)}…)`,
    );
    eq("S2-07", "supply UNCHANGED after all duplicate/replay attempts (no double mint)", m.getSupplySnapshot().totalSupplyMicro, "4995.000000");
    eq("S2-08", "still exactly ONE mint record", m.getSupplySnapshot().mintCount, 1);
    check("S2-09", "no ISSUED transition exists for any duplicate request (S2-R2, S2-R3)", m.getEventLog().every((e) => (e.requestId !== "S2-R2" && e.requestId !== "S2-R3") || e.to !== "ISSUED"), `ISSUED transitions for duplicates: ${m.getEventLog().filter((e) => (e.requestId === "S2-R2" || e.requestId === "S2-R3") && e.to === "ISSUED").length}`);
    const inv = invOk(m);
    check("S2-10", "machine-level invariants hold after the duplicate/replay battery (INV-C: idempotency keys map 1:1 to mint records)", inv.ok, inv.ok ? "assertInvariants() passed" : inv.message.slice(0, 90));
  }

  // =========================================================================
  // S3 — Delayed finality (quote expiry → EXPIRED_QUOTE; §6.3 refund machine)
  // =========================================================================
  section("S3", "Delayed finality — settlement finality arrives after the 15-min quote expiry → EXPIRED_QUOTE, NO mint, held-or-refunded (spec §6.3)");
  {
    const { machine } = newMachine({ machineId: "M-DELAY" });
    defineProgram(machine, "PROG-DELAY-001");
    recordFreshAttestation(machine, "ATT-DELAY-001");
    drive(machine, { requestId: "S3-R1", grossMicro: GROSS_10K, stopAfter: "PAYMENT_AUTHENTIC", settle: null });
    machine.advanceClock(901_000); // quote TTL is 900,000ms → finality is 1,000ms late
    const late = machine.confirmSettlement("S3-R1", { status: "SETTLED", confirmations: 3, issuerSanityCheckPassed: true, settledAmountMicro: GROSS_10K });
    check(
      "S3-01",
      "late settlement finality → EXPIRED_QUOTE terminal; NO issuance at a stale quote (finality-before-issuance, adopted decision 2; spec §6.1 hard-reject)",
      !late.ok && late.state === "EXPIRED_QUOTE",
      `state=${late.state}, reason=${late.reasonCode}`,
    );
    eq("S3-02", "taxonomy CONFIRMATION_TIMEOUT recorded on the terminal instance", machine.getInstanceState("S3-R1")?.terminalTaxonomyClass, "CONFIRMATION_TIMEOUT");
    const refunds = machine.getRefundQueue();
    check(
      "S3-03",
      "payment HELD_IN_REFUND_QUEUE (PENDING_REFUND) with the SAME idempotency key (spec §6.3 held-or-refunded)",
      refunds.length === 1 && refunds[0].state === "PENDING_REFUND" && refunds[0].idempotencyKey === "IDK-S3-R1" && refunds[0].reasonCode === "EXPIRED_QUOTE",
      `refunds=${JSON.stringify(refunds.map((r) => `${r.refundId}:${r.state}:key=${r.idempotencyKey}:reason=${r.reasonCode}`))}`,
    );
    const proc = machine.processRefundQueue();
    check("S3-04", "refund state machine completes PENDING_REFUND → REFUNDED (spec §6.3)", proc.processed === 1 && proc.refunds[0].state === "REFUNDED", `processed=${proc.processed}, state=${proc.refunds[0]?.state}`);
    const retry = machine.submitIssuanceRequest({
      requestId: "S3-R2",
      idempotencyKey: "IDK-S3-R1", // retry FORBIDDEN on the same key
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K,
    });
    check("S3-05", "retry on the SAME idempotency key after expiry → DUPLICATE (retry forbidden, spec §6.6)", !retry.ok && retry.state === "DUPLICATE", `state=${retry.state}, reason=${retry.reasonCode.slice(0, 60)}…`);
    eq("S3-06", "supply UNCHANGED (no mint on a stale quote)", machine.getSupplySnapshot().totalSupplyMicro, "0.000000");
    eq("S3-07", "NO mint record exists for the expired request", machine.getMintRecord("S3-R1") === null ? "absent" : "present", "absent");
    const inv = invOk(machine);
    check("S3-08", "machine-level invariants hold after the delayed-finality scenario", inv.ok, inv.ok ? "assertInvariants() passed" : inv.message.slice(0, 90));
  }

  // =========================================================================
  // S4 — Failed payment (never mints)
  // =========================================================================
  section("S4", "Failed payment — settlement status FAILED: never mints, taxonomy recorded, refund queued");
  {
    const { machine } = newMachine({ machineId: "M-FAIL" });
    defineProgram(machine, "PROG-FAIL-001");
    recordFreshAttestation(machine, "ATT-FAIL-001");
    drive(machine, { requestId: "S4-R1", grossMicro: GROSS_10K, stopAfter: "PAYMENT_AUTHENTIC", settle: null });
    const failed = machine.confirmSettlement("S4-R1", { status: "FAILED" });
    check(
      "S4-01",
      "FAILED settlement → PAYMENT_FAILED terminal; a failed payment NEVER mints (spec §14.4 hard rules)",
      !failed.ok && failed.state === "PAYMENT_FAILED",
      `state=${failed.state}, reason=${failed.reasonCode}`,
    );
    const issueAttempt = machine.issue("S4-R1");
    check(
      "S4-02",
      "direct issuance attempt on the failed payment → transition REJECTED by the explicit state machine (cannot skip to ISSUED)",
      !issueAttempt.ok && issueAttempt.reasonCode.startsWith("TRANSITION_REJECTED"),
      `reason=${issueAttempt.reasonCode}`,
    );
    eq("S4-03", "supply UNCHANGED", machine.getSupplySnapshot().totalSupplyMicro, "0.000000");
    eq("S4-04", "NO fee retained on the failed transaction (fee ledger 0.000000; spec §6.3)", machine.getSupplySnapshot().feeBookTotalMicro, "0.000000");
    check(
      "S4-05",
      "failure recorded with the §6.6 taxonomy (CONFIRMATION_TIMEOUT on the terminal instance AND the event log carries the taxonomy class)",
      machine.getInstanceState("S4-R1")?.terminalTaxonomyClass === "CONFIRMATION_TIMEOUT" && machine.getEventLog().some((e) => e.requestId === "S4-R1" && e.to === "PAYMENT_FAILED" && e.taxonomyClass === "CONFIRMATION_TIMEOUT"),
      `instanceTaxonomy=${machine.getInstanceState("S4-R1")?.terminalTaxonomyClass}`,
    );
    check(
      "S4-06",
      "auto-refund queued with the same idempotency key (reason PAYMENT_FAILED, spec §6.3)",
      machine.getRefundQueue().length === 1 && machine.getRefundQueue()[0].reasonCode === "PAYMENT_FAILED" && machine.getRefundQueue()[0].idempotencyKey === "IDK-S4-R1",
      `refunds=${machine.getRefundQueue().length}, reason=${machine.getRefundQueue()[0]?.reasonCode}`,
    );
    check("S4-07", "no ISSUED transition exists anywhere in the log", machine.getEventLog().every((e) => e.to !== "ISSUED"), `ISSUED transitions: ${machine.getEventLog().filter((e) => e.to === "ISSUED").length}`);
    const inv = invOk(machine);
    check("S4-08", "machine-level invariants hold (INV-B: failed/unverified payments never mint)", inv.ok, inv.ok ? "assertInvariants() passed" : inv.message.slice(0, 90));
  }

  // =========================================================================
  // S5 — Reversals (ADOPTED decision 3) + fail-closed authorized remediation
  // =========================================================================
  section("S5", "Reversals — pre-issuance → CANCELLED (no mint); post-issuance → RECONCILIATION_BREAK + SUSPENDED; recovery ONLY via the explicit authorized remediation path (INV-D)");
  {
    // (a) pre-issuance reversal → CANCELLED (adopted decision 3; prototype name PAYMENT_REVERSED is retired)
    const { machine } = newMachine({ machineId: "M-REV" });
    defineProgram(machine, "PROG-REV-001");
    recordFreshAttestation(machine, "ATT-REV-001");
    drive(machine, { requestId: "S5-R1", grossMicro: GROSS_10K, stopAfter: "PAYMENT_AUTHENTIC", settle: null });
    const revA = machine.handleReversalNotice("S5-R1", "SYNTHETIC STABLECOIN RAIL (deterministic simulated settlement record)");
    check(
      "S5-01",
      "reversal BEFORE issuance → CANCELLED terminal (ADOPTED decision 3 naming; the prototype's PAYMENT_REVERSED name is retired); NO mint",
      !revA.ok && revA.state === "CANCELLED",
      `state=${revA.state}, reason=${revA.reasonCode}`,
    );
    eq("S5-02", "pre-issuance reversal taxonomy REVERSAL_BEFORE_ISSUANCE recorded", machine.getInstanceState("S5-R1")?.terminalTaxonomyClass, "REVERSAL_BEFORE_ISSUANCE");
    check(
      "S5-03",
      "auto-refund queued with the same idempotency key for the cancelled request (spec §6.3)",
      machine.getRefundQueue().length === 1 && machine.getRefundQueue()[0].reasonCode === "REVERSAL_BEFORE_ISSUANCE",
      `refunds=${machine.getRefundQueue().length}, reason=${machine.getRefundQueue()[0]?.reasonCode}`,
    );
    eq("S5-04", "supply UNCHANGED by the pre-issuance reversal", machine.getSupplySnapshot().totalSupplyMicro, "0.000000");

    // (b) post-issuance reversal → RECONCILIATION_BREAK + pipeline SUSPENDED (fail-closed)
    drive(machine, { requestId: "S5-R2", grossMicro: GROSS_10K });
    eq("S5-05", "second issuance completes first (RECONCILED, 4995.000000)", machine.getInstanceState("S5-R2")?.issuedMicro, "4995.000000");
    const revB = machine.handleReversalNotice("S5-R2", "SYNTHETIC STABLECOIN RAIL (deterministic simulated settlement record)");
    check(
      "S5-06",
      "reversal AFTER issuance → RECONCILIATION_BREAK + pipeline SUSPENDED (books disagree; spec §6.5/§6.6; adopted decision 3)",
      !revB.ok && revB.state === "RECONCILIATION_BREAK" && machine.pipelineSuspended && machine.suspensionReasons.includes("REVERSAL_AFTER_ISSUANCE:S5-R2"),
      `state=${revB.state}, suspended=${machine.pipelineSuspended}, reasons=${JSON.stringify(machine.suspensionReasons)}`,
    );
    check(
      "S5-07",
      "OPEN exception queued with taxonomy REVERSAL_AFTER_ISSUANCE (no silent write-off)",
      machine.getExceptions().some((e) => e.taxonomyClass === "REVERSAL_AFTER_ISSUANCE" && e.status === "OPEN"),
      `exceptions=${JSON.stringify(machine.getExceptions().map((e) => `${e.exceptionId}:${e.taxonomyClass}:${e.status}`))}`,
    );
    const booksB = machine.ledgerSnapshot();
    eq("S5-08", "payment book entry flagged REVERSED_POST_ISSUANCE (the divergence is visible on the books)", booksB.paymentBookEntries.find((p) => p.requestId === "S5-R2")?.status, "REVERSED_POST_ISSUANCE");
    const mintB = machine.getMintRecord("S5-R2");
    check("S5-09", "mint record PRESERVED after the reversal (no silent write-off, no re-mint)", mintB !== null && mintB.amountMicro === 4_995_000_000n, mintB ? `mintId=${mintB.mintId}, amount=${fmt6(mintB.amountMicro)} (still on the token book)` : "missing");
    eq("S5-10", "supply unchanged by the reversal event (no re-mint)", machine.getSupplySnapshot().totalSupplyMicro, "4995.000000");
    const blocked = machine.submitIssuanceRequest({
      requestId: "S5-R3",
      idempotencyKey: "IDK-S5-R3",
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K,
    });
    check("S5-11", "pipeline SUSPENDED blocks NEW requests fail-closed while the exception is OPEN (no silent healing)", !blocked.ok && blocked.reasonCode === "PIPELINE_SUSPENDED_FAIL_CLOSED", `reason=${blocked.reasonCode}`);
    const rem = machine.resolveReconciliationBreak("TEST-OPERATOR-001", "attempted remediation while the books still diverge");
    check(
      "S5-12",
      "authorized remediation REFUSED while the three books still diverge (C1–C4 re-verified at resolution time; the reversal divergence is REAL — no automatic book adjustment exists or is permitted)",
      !rem.ok && rem.reasonCode === "REMEDIATION_BLOCKED_BOOKS_STILL_DIVERGED",
      `reasonCode=${rem.reasonCode}`,
    );
    check("S5-13", "the machine REMAINS SUSPENDED with the OPEN exception after the refused remediation (fail-closed; no silent healing)", machine.pipelineSuspended && machine.getExceptions().some((e) => e.taxonomyClass === "REVERSAL_AFTER_ISSUANCE" && e.status === "OPEN"), `suspended=${machine.pipelineSuspended}`);
    const invA = invOk(machine);
    check("S5-14", "machine-level invariants hold on the reversal machine (INV-D: suspension carries reasons + an OPEN exception)", invA.ok, invA.ok ? "assertInvariants() passed" : invA.message.slice(0, 90));

    // (c) the FULL authorized-remediation recovery loop on a forced-break machine:
    //     break → reconcile DETECTS → suspended → remediation refused while diverged →
    //     explicit operator book correction (TEST-ONLY harness stands in for the
    //     authorized correction act) → resolveReconciliationBreak SUCCEEDS → resumed.
    const { machine: mRem } = newMachine({ machineId: "M-REMED" });
    defineProgram(mRem, "PROG-REMED-001");
    recordFreshAttestation(mRem, "ATT-REMED-001");
    drive(mRem, { requestId: "S5-C1", grossMicro: GROSS_10K, stopAfter: "ISSUED" });
    mRem.__testOnlyForceLedgerBreak("PAYMENT_BOOK_NET", "S5-C1", 1n); // corrupt ONE book entry by 1 micro
    const rec = mRem.reconcile("S5-C1");
    check(
      "S5-15",
      "forced 1-micro ledger break → reconcile() routes to RECONCILIATION_BREAK + pipeline SUSPENDED + exception queued (fail-closed)",
      rec.state === "RECONCILIATION_BREAK" && mRem.pipelineSuspended && mRem.getExceptions().some((e) => e.taxonomyClass === "RECONCILE_MISMATCH" && e.status === "OPEN"),
      `state=${rec.state}, suspended=${mRem.pipelineSuspended}`,
    );
    const rem1 = mRem.resolveReconciliationBreak("TEST-OPERATOR-001", "remediation attempt BEFORE any book correction");
    check("S5-16", "remediation REFUSED before the books are corrected (C1–C4 must pass at resolution time)", !rem1.ok && rem1.reasonCode === "REMEDIATION_BLOCKED_BOOKS_STILL_DIVERGED", `reasonCode=${rem1.reasonCode}`);
    mRem.__testOnlyForceLedgerBreak("PAYMENT_BOOK_NET", "S5-C1", -1n); // TEST-ONLY harness reversal — stands in for the explicit authorized operator correction of the underlying divergence
    const rem2 = mRem.resolveReconciliationBreak("TEST-OPERATOR-001", "books corrected by the explicit authorized act; C1–C4 re-verified");
    check(
      "S5-17",
      "after the explicit authorized correction, resolveReconciliationBreak SUCCEEDS: exceptions RESOLVED, pipeline RESUMED, mint record PRESERVED (no re-mint, no re-burn, no adjustment)",
      rem2.ok && rem2.reasonCode === "REMEDIATED" && !mRem.pipelineSuspended && !mRem.getExceptions().some((e) => e.status === "OPEN") && mRem.getSupplySnapshot().totalSupplyMicro === "4995.000000",
      `ok=${rem2.ok}, reason=${rem2.reasonCode}, suspended=${mRem.pipelineSuspended}, openExceptions=${mRem.getExceptions().filter((e) => e.status === "OPEN").length}, supply=${mRem.getSupplySnapshot().totalSupplyMicro}`,
    );
    const after = drive(mRem, { requestId: "S5-C2", grossMicro: GROSS_10K });
    check(
      "S5-18",
      "after the authorized remediation the pipeline OPERATES again: a new request completes to RECONCILED (recovery was an explicit act, not silent healing)",
      after.last.ok && after.last.state === "RECONCILED",
      `state=${after.last.state}, reason=${after.last.reasonCode}`,
    );
    const invB = invOk(mRem);
    check("S5-19", "machine-level invariants hold after the full remediation loop (INV-D: resolved exceptions carry the resolver)", invB.ok, invB.ok ? "assertInvariants() passed" : invB.message.slice(0, 90));
  }

  // =========================================================================
  // S6 — Authorization (INV-A / ALT-4): payment alone NEVER mints
  // =========================================================================
  section("S6", "Authorization (INV-A / ALT-4) — no program ⇒ refusal · revoked mid-flight · attestation MISSING/STALE/MISMATCH ⇒ suspended · authorized resumption");
  {
    // (a) payment settles fully but NO program exists
    const a = newMachine({ machineId: "M-AUTH-NO-PROG" });
    recordFreshAttestation(a.machine, "ATT-AUTH-A-001"); // attestation fresh — isolates the PROGRAM gate
    drive(a.machine, { requestId: "S6-A1", grossMicro: GROSS_10K, stopAfter: "NET_ACCEPTED" });
    const stA = a.machine.getInstanceState("S6-A1");
    check(
      "S6-01",
      "payment fully settled + net accepted, but NO authorization program exists and NO authorization record was created (a payment event alone can NEVER create one)",
      stA?.state === "NET_ACCEPTED" && stA.settlementFinal && !stA.hasAuthorizationRecord,
      `state=${stA?.state}, settlementFinal=${stA?.settlementFinal}, hasAuthorization=${stA?.hasAuthorizationRecord}`,
    );
    const authA = a.machine.authorize("S6-A1");
    check(
      "S6-02",
      "authorize() with NO program → UNAUTHORIZED terminal (NO_AUTHORIZATION_PROGRAM — payments alone NEVER mint; INV-A unconditional)",
      !authA.ok && authA.state === "UNAUTHORIZED" && authA.reasonCode.startsWith("NO_AUTHORIZATION_PROGRAM"),
      `state=${authA.state}, reason=${authA.reasonCode}`,
    );
    eq("S6-03", "taxonomy AUTHORIZATION_MISSING recorded on the unauthorized terminal", a.machine.getInstanceState("S6-A1")?.terminalTaxonomyClass, "AUTHORIZATION_MISSING");
    const bypass = a.machine.__testAttemptDirectIssueBypass("S6-A1");
    check("S6-04", "bypass-attempt harness (table skipped) → machine INVARIANT THROWS: ISSUED unreachable without a program record (INV-A hard guard)", bypass.threw && bypass.message.includes("INV-A"), `threw=${bypass.threw}, message=${bypass.message.slice(0, 80)}…`);
    eq("S6-05", "supply UNCHANGED (never reached ISSUED)", a.machine.getSupplySnapshot().totalSupplyMicro, "0.000000");
    check("S6-06", "no ISSUED transition exists anywhere in this machine's log", a.machine.getEventLog().every((e) => e.to !== "ISSUED"), `ISSUED transitions: ${a.machine.getEventLog().filter((e) => e.to === "ISSUED").length}`);
    const invA = invOk(a.machine);
    check("S6-07", "machine-level invariants hold (INV-A: no ISSUED without settlement finality + authorization record)", invA.ok, invA.ok ? "assertInvariants() passed" : invA.message.slice(0, 90));

    // (b) program defined but NO attestation recorded → attestation gate suspends fail-closed
    const b = newMachine({ machineId: "M-AUTH-MISS" });
    defineProgram(b.machine, "PROG-AUTH-B-001");
    drive(b.machine, { requestId: "S6-B1", grossMicro: GROSS_10K, stopAfter: "NET_ACCEPTED" });
    const authB = b.machine.authorize("S6-B1");
    check(
      "S6-08",
      "NO periodic attestation → UNAUTHORIZED (NO_ATTESTATION) AND the pipeline SUSPENDS fail-closed with an OPEN ATTESTATION_FAILURE exception (ALT-4)",
      !authB.ok && authB.state === "UNAUTHORIZED" && authB.reasonCode.startsWith("NO_ATTESTATION") && b.machine.pipelineSuspended && b.machine.getExceptions().some((e) => e.taxonomyClass === "ATTESTATION_FAILURE" && e.status === "OPEN"),
      `state=${authB.state}, reason=${authB.reasonCode.slice(0, 40)}…, suspended=${b.machine.pipelineSuspended}`,
    );

    // (c) program revoked mid-flight → refusal
    const c = newMachine({ machineId: "M-AUTH-REVOKED" });
    defineProgram(c.machine, "PROG-AUTH-C-001");
    recordFreshAttestation(c.machine, "ATT-AUTH-C-001");
    drive(c.machine, { requestId: "S6-C1", grossMicro: GROSS_10K });
    eq("S6-09", "first issuance completes under the program before revocation (4995.000000)", c.machine.getInstanceState("S6-C1")?.issuedMicro, "4995.000000");
    c.machine.revokeIssuanceProgram("PROG-AUTH-C-001", "SYNTHETIC mid-flight revocation (governed act demonstration)");
    drive(c.machine, { requestId: "S6-C2", grossMicro: GROSS_10K, stopAfter: "NET_ACCEPTED" });
    const authC = c.machine.authorize("S6-C2");
    check(
      "S6-10",
      "program REVOKED mid-flight → authorize() REFUSES (ALL_PROGRAMS_REVOKED — a revoked program authorizes nothing)",
      !authC.ok && authC.state === "UNAUTHORIZED" && authC.reasonCode.startsWith("ALL_PROGRAMS_REVOKED"),
      `state=${authC.state}, reason=${authC.reasonCode.slice(0, 50)}…`,
    );
    eq("S6-11", "supply still 4995.000000 after the revoked-program attempt (no second mint)", c.machine.getSupplySnapshot().totalSupplyMicro, "4995.000000");

    // (d) attestation MISMATCH → suspended; recovery ONLY via resumeAfterAttestationSuspension
    const d = newMachine({ machineId: "M-AUTH-MISMATCH" });
    defineProgram(d.machine, "PROG-AUTH-D-001");
    recordFreshAttestation(d.machine, "ATT-AUTH-D-001", false); // MISMATCH fixture
    drive(d.machine, { requestId: "S6-D1", grossMicro: GROSS_10K, stopAfter: "NET_ACCEPTED" });
    const authD = d.machine.authorize("S6-D1");
    check(
      "S6-12",
      "attestation MISMATCH → UNAUTHORIZED (ATTESTATION_MISMATCH) AND the pipeline SUSPENDS fail-closed (adopted decision 1)",
      !authD.ok && authD.state === "UNAUTHORIZED" && authD.reasonCode.startsWith("ATTESTATION_MISMATCH") && d.machine.pipelineSuspended,
      `state=${authD.state}, reason=${authD.reasonCode.slice(0, 40)}…, suspended=${d.machine.pipelineSuspended}`,
    );
    const blockedD = d.machine.submitIssuanceRequest({
      requestId: "S6-D2",
      idempotencyKey: "IDK-S6-D2",
      instrumentCode: TEST_INSTRUMENT.code,
      network: TEST_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: GROSS_10K,
    });
    check("S6-13", "new requests REJECTED while suspended for attestation failure (fail-closed)", !blockedD.ok && blockedD.reasonCode === "PIPELINE_SUSPENDED_FAIL_CLOSED", `reason=${blockedD.reasonCode}`);
    const badResume = d.machine.resumeAfterAttestationSuspension(
      attester.attest({ attestationId: "ATT-AUTH-D-BAD", nowMs: d.machine.nowMs, matched: false, notes: "still mismatched — resumption must be blocked" }),
      "TEST-OPERATOR-001",
    );
    check("S6-14", "resumption BLOCKED with a non-matching attestation (no silent healing; fail-closed recovery)", !badResume.ok && badResume.reasonCode.startsWith("RESUMPTION_BLOCKED"), `reason=${badResume.reasonCode}`);
    const goodResume = d.machine.resumeAfterAttestationSuspension(
      attester.attest({ attestationId: "ATT-AUTH-D-002", nowMs: d.machine.nowMs, matched: true, notes: "fresh matching attestation after review (STUB — TEST-ONLY)" }),
      "TEST-OPERATOR-001",
    );
    check(
      "S6-15",
      "resumeAfterAttestationSuspension with a FRESH matching attestation + explicit operator act → pipeline RESUMED, attestation exception RESOLVED",
      goodResume.ok && goodResume.reasonCode === "RESUMED" && !d.machine.pipelineSuspended && !d.machine.getExceptions().some((e) => e.taxonomyClass === "ATTESTATION_FAILURE" && e.status === "OPEN"),
      `ok=${goodResume.ok}, reason=${goodResume.reasonCode}, suspended=${d.machine.pipelineSuspended}`,
    );
    const afterD = drive(d.machine, { requestId: "S6-D3", grossMicro: GROSS_10K });
    check("S6-16", "after the authorized resumption the pipeline operates again: a new issuance completes to RECONCILED", afterD.last.ok && afterD.last.state === "RECONCILED", `state=${afterD.last.state}, reason=${afterD.last.reasonCode}`);

    // (e) STALE attestation → suspended
    const e = newMachine({ machineId: "M-AUTH-STALE" });
    defineProgram(e.machine, "PROG-AUTH-E-001");
    recordFreshAttestation(e.machine, "ATT-AUTH-E-001");
    drive(e.machine, { requestId: "S6-E1", grossMicro: GROSS_10K, stopAfter: "NET_ACCEPTED" });
    e.machine.advanceClock(604_800_001); // attestation period is 604,800,000ms (1 week, ILLUSTRATIVE)
    eq("S6-17", "attestation status transitions to STALE after the period elapses (machine.attestationStatus())", e.machine.attestationStatus().kind, "STALE");
    const authE = e.machine.authorize("S6-E1");
    check(
      "S6-18",
      "STALE attestation → UNAUTHORIZED (STALE_ATTESTATION) AND the pipeline SUSPENDS fail-closed pending a fresh attestation",
      !authE.ok && authE.state === "UNAUTHORIZED" && authE.reasonCode.startsWith("STALE_ATTESTATION") && e.machine.pipelineSuspended,
      `state=${authE.state}, reason=${authE.reasonCode.slice(0, 40)}…, suspended=${e.machine.pipelineSuspended}`,
    );
    const invSweep = [a.machine, b.machine, c.machine, d.machine, e.machine].every((m) => invOk(m).ok);
    check("S6-19", "machine-level invariants hold across ALL authorization machines (incl. the suspended ones — INV-D reasons + OPEN exceptions)", invSweep, "assertInvariants() passed on all 5 authorization machines");
  }

  // =========================================================================
  // S7 — Invalid instrument / payment (correct terminal + taxonomy each)
  // =========================================================================
  section("S7", "Invalid instrument/payment — unregistered · wrong network · RETIRED · SUSPENDED · bad auth tag · amount mismatch · jurisdiction · depeg · finality-evidence gap");
  {
    // (a) unregistered instrument
    const ma = newMachine({ machineId: "M-INVAL-A" });
    const a = drive(ma.machine, { requestId: "S7-A1", grossMicro: GROSS_10K, instrumentCode: "TEST-NOPE", network: TEST_INSTRUMENT.network, stopAfter: "QUOTED" });
    check("S7-01", "unregistered instrument → INVALID_INSTRUMENT at quote (per-instance lookup, never a ticker alone)", a.last.state === "INVALID_INSTRUMENT" && a.last.reasonCode === "INSTRUMENT_NOT_IN_REGISTRY", `state=${a.last.state}, reason=${a.last.reasonCode}`);
    eq("S7-02", "taxonomy INSTRUMENT_INVALID on the unregistered-instrument terminal", ma.machine.getInstanceState("S7-A1")?.terminalTaxonomyClass, "INSTRUMENT_INVALID");

    // (b) same code, DIFFERENT network instance (per-instance identity)
    const mb = newMachine({ machineId: "M-INVAL-B" });
    const b = drive(mb.machine, { requestId: "S7-B1", grossMicro: GROSS_10K, instrumentCode: "TEST-USDC-X", network: "TEST-CHAIN-2 (SYNTHETIC)", stopAfter: "QUOTED" });
    check("S7-03", "same code on TEST-CHAIN-2 (CANDIDATE instance) → INVALID_INSTRUMENT (per-instance identity, spec §14.2 rule (a))", b.last.state === "INVALID_INSTRUMENT" && b.last.reasonCode === "INSTRUMENT_NOT_ADMITTED_PER_INSTANCE_IDENTITY", `state=${b.last.state}, reason=${b.last.reasonCode}`);

    // (c) RETIRED row (production analog of a revoked instrument)
    const mc = newMachine({ machineId: "M-INVAL-C" });
    const c = drive(mc.machine, { requestId: "S7-C1", grossMicro: GROSS_10K, instrumentCode: "TEST-USDC-Y", network: TEST_INSTRUMENT.network, stopAfter: "QUOTED" });
    check("S7-04", "RETIRED instrument (TEST-USDC-Y) → INVALID_INSTRUMENT (INSTRUMENT_RETIRED; quoting refused, records preserved append-only)", c.last.state === "INVALID_INSTRUMENT" && c.last.reasonCode === "INSTRUMENT_RETIRED", `state=${c.last.state}, reason=${c.last.reasonCode}`);

    // (d) SUSPENDED row (registry-suspended before the quote)
    const md = newMachine({ machineId: "M-INVAL-D" });
    const susp = md.registry.transition("TEST-STBL-001", "SUSPEND_DEPEG", "SYNTHETIC depeg suspension for S7(d)");
    const d = drive(md.machine, { requestId: "S7-D1", grossMicro: GROSS_10K, stopAfter: "QUOTED" });
    check(
      "S7-05",
      "SUSPENDED instrument → INVALID_INSTRUMENT (INSTRUMENT_SUSPENDED_NO_QUOTES; new quotes blocked while in-flight settlements complete under existing quotes, spec §4)",
      susp.ok && susp.row?.state === "SUSPENDED" && d.last.state === "INVALID_INSTRUMENT" && d.last.reasonCode === "INSTRUMENT_SUSPENDED_NO_QUOTES",
      `rowState=${susp.row?.state}, quote=${d.last.state} (${d.last.reasonCode})`,
    );
    check("S7-06", "the suspension published a notice record (windows PROPOSED D-13.19; SYNTHETIC)", md.registry.noticesLog().some((n) => n.action === "SUSPEND_DEPEG"), `notices=${md.registry.noticesLog().length}`);

    // (e) failed authenticity tag
    const me = newMachine({ machineId: "M-INVAL-E" });
    const e = drive(me.machine, { requestId: "S7-E1", grossMicro: GROSS_10K, paymentAuthTagOverride: "TEST-TAG-00000000feedface", stopAfter: "PAYMENT_AUTHENTIC", settle: null });
    check("S7-07", "failed authenticity tag → INVALID_PAYMENT (AUTH_TAG_MISMATCH; production requires real per-rail signature verification — none exists)", e.last.state === "INVALID_PAYMENT" && e.last.reasonCode === "AUTH_TAG_MISMATCH", `state=${e.last.state}, reason=${e.last.reasonCode}`);
    eq("S7-08", "taxonomy FINALITY_EVIDENCE_GAP on the auth-tag failure", me.machine.getInstanceState("S7-E1")?.terminalTaxonomyClass, "FINALITY_EVIDENCE_GAP");

    // (f) payment amount ≠ quoted amount (at step 4a)
    const mf = newMachine({ machineId: "M-INVAL-F" });
    const f = drive(mf.machine, { requestId: "S7-F1", grossMicro: GROSS_10K, paymentAmountOverride: GROSS_10K - 1n, stopAfter: "PAYMENT_AUTHENTIC", settle: null });
    check("S7-09", "payment amount ≠ quoted amount → INVALID_PAYMENT (PAYMENT_QUOTE_MISMATCH)", f.last.state === "INVALID_PAYMENT" && f.last.reasonCode === "PAYMENT_QUOTE_MISMATCH", `state=${f.last.state}, reason=${f.last.reasonCode}`);
    eq("S7-10", "taxonomy PARTIAL_SETTLEMENT on the payment/quote mismatch", mf.machine.getInstanceState("S7-F1")?.terminalTaxonomyClass, "PARTIAL_SETTLEMENT");

    // (g) settled amount ≠ quoted amount (at step 4b)
    const mg = newMachine({ machineId: "M-INVAL-G" });
    drive(mg.machine, { requestId: "S7-G1", grossMicro: GROSS_10K, stopAfter: "PAYMENT_AUTHENTIC", settle: null });
    const g = mg.machine.confirmSettlement("S7-G1", { status: "SETTLED", confirmations: 3, issuerSanityCheckPassed: true, settledAmountMicro: GROSS_10K + 1n });
    check(
      "S7-11",
      "settled amount ≠ quoted amount → INVALID_PAYMENT (SETTLED_AMOUNT_QUOTE_MISMATCH; §6.6 PARTIAL_SETTLEMENT analog)",
      g.state === "INVALID_PAYMENT" && g.reasonCode === "SETTLED_AMOUNT_QUOTE_MISMATCH",
      `state=${g.state}, reason=${g.reasonCode}`,
    );
    check("S7-12", "the difference is HELD in the exception queue and DISCLOSED (no silent write-off)", mg.machine.getExceptions().some((x) => x.taxonomyClass === "PARTIAL_SETTLEMENT" && x.status === "OPEN"), `exceptions=${JSON.stringify(mg.machine.getExceptions().map((x) => `${x.exceptionId}:${x.taxonomyClass}`))}`);

    // (h) jurisdiction not allowed (checks are settlement-time, not quote-time)
    const mh = newMachine({ machineId: "M-INVAL-H" });
    const h = drive(mh.machine, { requestId: "S7-H1", grossMicro: GROSS_10K, jurisdiction: "TEST-JURISDICTION-9", stopAfter: "NET_ACCEPTED" });
    check("S7-13", "jurisdiction outside the instrument allowlist → INVALID_INSTRUMENT at settlement time (JURISDICTION_NOT_ALLOWED; compositional restriction, spec §3)", h.last.state === "INVALID_INSTRUMENT" && h.last.reasonCode === "JURISDICTION_NOT_ALLOWED", `state=${h.last.state}, reason=${h.last.reasonCode}`);

    // (i) depeg EMERGENCY band at settlement time → fail-closed
    const mi = newMachine({ machineId: "M-INVAL-I" });
    const i = drive(mi.machine, { requestId: "S7-I1", grossMicro: GROSS_10K, stopAfter: "NET_ACCEPTED", depegObs: { deviationBps: 300, sustainedHours: 24, instantaneousMoveBps: 0 } });
    check("S7-14", "depeg EMERGENCY band at settlement time → INVALID_INSTRUMENT (DEPEG_EMERGENCY_FAIL_CLOSED; spec §4 suspension + escalation, adopted decision 4)", i.last.state === "INVALID_INSTRUMENT" && i.last.reasonCode === "DEPEG_EMERGENCY_FAIL_CLOSED", `state=${i.last.state}, reason=${i.last.reasonCode}`);
    eq("S7-15", "taxonomy ISSUER_EVENT on the depeg-emergency rejection", mi.machine.getInstanceState("S7-I1")?.terminalTaxonomyClass, "ISSUER_EVENT");

    // (j) finality-evidence gap (insufficient confirmations)
    const mj = newMachine({ machineId: "M-INVAL-J" });
    drive(mj.machine, { requestId: "S7-J1", grossMicro: GROSS_10K, stopAfter: "PAYMENT_AUTHENTIC", settle: null });
    const j = mj.machine.confirmSettlement("S7-J1", { status: "SETTLED", confirmations: 2, issuerSanityCheckPassed: true, settledAmountMicro: GROSS_10K });
    check("S7-16", "insufficient confirmations (2 < N=3) → INVALID_PAYMENT (FINALITY_EVIDENCE_GAP; balance receipt alone is NEVER finality, spec §6.2)", j.state === "INVALID_PAYMENT" && j.reasonCode === "FINALITY_EVIDENCE_GAP", `state=${j.state}, reason=${j.reasonCode}`);
    check("S7-17", "the finality gap is held as an OPEN exception (new obligations for this instrument blocked, spec §6.6)", mj.machine.getExceptions().some((x) => x.taxonomyClass === "FINALITY_EVIDENCE_GAP" && x.status === "OPEN"), `exceptions=${JSON.stringify(mj.machine.getExceptions().map((x) => `${x.exceptionId}:${x.taxonomyClass}`))}`);

    const invMachines = [ma.machine, mb.machine, mc.machine, md.machine, me.machine, mf.machine, mg.machine, mh.machine, mi.machine, mj.machine];
    eq("S7-18", "supply UNCHANGED across ALL invalid-instrument/payment machines (nothing minted)", invMachines.every((m) => m.getSupplySnapshot().totalSupplyMicro === "0.000000") ? "0.000000 on all 10 machines" : "some machine minted", "0.000000 on all 10 machines");
    check("S7-19", "machine-level invariants hold across ALL invalid-instrument/payment machines", invMachines.every((m) => invOk(m).ok), "assertInvariants() passed on all 10 machines");
  }

  // =========================================================================
  // S8 — Supply controls (per-tx / tranche / global caps — fail-closed)
  // =========================================================================
  section("S8", "Supply controls — per-transaction cap · tranche cap · global max supply: each fail-closed (SUPPLY_CAP_EXCEEDED), no partial mint");
  {
    // (a) per-transaction cap
    const ma = newMachine({ machineId: "M-CAP-A" });
    defineProgram(ma.machine, "PROG-CAP-A-001");
    recordFreshAttestation(ma.machine, "ATT-CAP-A-001");
    const a = drive(ma.machine, { requestId: "S8-A1", grossMicro: 1_002_002_000_000n }); // gross 1,002,002.000000 TU
    check(
      "S8-01",
      "per-transaction cap exceeded → SUPPLY_CAP_EXCEEDED (PER_TX_CAP_EXCEEDED); prospective 500499.999000 > per-tx 500000.000000",
      a.last.state === "SUPPLY_CAP_EXCEEDED" && a.last.reasonCode === "PER_TX_CAP_EXCEEDED",
      `state=${a.last.state}, reason=${a.last.reasonCode}`,
    );
    eq("S8-02", "no partial mint on the per-tx cap failure (supply 0.000000, 0 mint records)", `${ma.machine.getSupplySnapshot().totalSupplyMicro}/${ma.machine.getSupplySnapshot().mintCount}`, "0.000000/0");
    check(
      "S8-03",
      "authorization PRECEDED the supply check (§14.4 step 9 before 9b): the capped instance passed through AUTHORIZED before SUPPLY_CAP_EXCEEDED",
      ma.machine.getEventLog().some((e) => e.requestId === "S8-A1" && e.to === "AUTHORIZED") && ma.machine.getEventLog().some((e) => e.requestId === "S8-A1" && e.to === "SUPPLY_CAP_EXCEEDED"),
      "AUTHORIZED transition logged before SUPPLY_CAP_EXCEEDED for S8-A1",
    );

    // (b) tranche cap (tranche sized below the per-tx cap: ILLUSTRATIVE governance choice)
    const mb = newMachine({ machineId: "M-CAP-B", supplyPolicy: { ...SUPPLY_POLICY, trancheId: "T-SMALL-001", trancheCapMicro: 400_000_000_000n } });
    defineProgram(mb.machine, "PROG-CAP-B-001");
    recordFreshAttestation(mb.machine, "ATT-CAP-B-001");
    const b = drive(mb.machine, { requestId: "S8-B1", grossMicro: 1_000_000_000_000n }); // gross 1,000,000.000000 TU → prospective 499,950.000000
    check("S8-04", "tranche cap exceeded → SUPPLY_CAP_EXCEEDED (TRANCHE_CAP_EXCEEDED); prospective 499950.000000 > tranche remaining 400000.000000", b.last.state === "SUPPLY_CAP_EXCEEDED" && b.last.reasonCode === "TRANCHE_CAP_EXCEEDED", `state=${b.last.state}, reason=${b.last.reasonCode}`);
    eq("S8-05", "no partial mint on the tranche cap failure", `${mb.machine.getSupplySnapshot().totalSupplyMicro}/${mb.machine.getSupplySnapshot().mintCount}`, "0.000000/0");

    // (c) global max supply (near-max machine)
    const mc = newMachine({ machineId: "M-CAP-C", supplyPolicy: { ...SUPPLY_POLICY, globalMaxSupplyMicro: 5_000_000_000n } }); // 5,000.000000 tokens
    defineProgram(mc.machine, "PROG-CAP-C-001");
    recordFreshAttestation(mc.machine, "ATT-CAP-C-001");
    drive(mc.machine, { requestId: "S8-C1", grossMicro: GROSS_10K });
    eq("S8-06", "first issuance OK under the 5,000.000000-token global max (4995.000000 minted)", mc.machine.getSupplySnapshot().totalSupplyMicro, "4995.000000");
    const c = drive(mc.machine, { requestId: "S8-C2", grossMicro: 100_000_000n }); // gross 100.000000 TU → prospective 49.950000 > 5.000000 remaining
    check("S8-07", "global max supply exceeded → SUPPLY_CAP_EXCEEDED (GLOBAL_MAX_SUPPLY_EXCEEDED)", c.last.state === "SUPPLY_CAP_EXCEEDED" && c.last.reasonCode === "GLOBAL_MAX_SUPPLY_EXCEEDED", `state=${c.last.state}, reason=${c.last.reasonCode}`);
    eq("S8-08", "supply unchanged by the capped attempt (still 4995.000000 ≤ 5000.000000)", mc.machine.getSupplySnapshot().totalSupplyMicro, "4995.000000");
    eq("S8-09", "taxonomy SUPPLY_CAP on the capped terminals", `${ma.machine.getInstanceState("S8-A1")?.terminalTaxonomyClass}/${mc.machine.getInstanceState("S8-C2")?.terminalTaxonomyClass}`, "SUPPLY_CAP/SUPPLY_CAP");
    const invCaps = [ma.machine, mb.machine, mc.machine].every((m) => invOk(m).ok);
    check("S8-10", "machine-level invariants hold across the supply-control machines (INV-B: a SUPPLY_CAP_EXCEEDED terminal never carries a mint record)", invCaps, "assertInvariants() passed on all 3 cap machines");
  }

  // =========================================================================
  // S9 — Three-book reconciliation (spec §6.5) — clean sweep + real detection
  // =========================================================================
  section("S9", "Three-book reconciliation — C1–C4 clean after the run; a forced 1-micro ledger break is DETECTED (reconciliation is a REAL check)");
  {
    // (a) clean sweep over every un-suspended machine so far
    const sweep = allMachines.filter((x) => !x.machine.pipelineSuspended);
    const unbalanced = sweep.filter((x) => !reconcileThreeBooks(x.machine.ledgerSnapshot()).balanced).map((x) => x.machineId);
    check(
      "S9-01",
      "three-book C1–C4 equality holds on EVERY un-suspended machine after the full run so far (suspended machines carry OPEN exceptions instead)",
      unbalanced.length === 0,
      `swept ${sweep.length} un-suspended machines; unbalanced: ${unbalanced.length === 0 ? "none" : unbalanced.join(", ")}`,
    );
    const reconE2E = reconcileThreeBooks(e2e.machine.ledgerSnapshot());
    eq(
      "S9-02",
      "main-run book totals exact (payment ledger 1 SETTLED · 1 issuance record · token Σ = supply = 4995.000000 · fee ledger 10.000000)",
      JSON.stringify(reconE2E.bookTotals),
      JSON.stringify({ paymentLedgerSettledCount: "1", issuanceRecordCount: "1", tokenBookSum: "4995.000000", totalSupply: "4995.000000", feeLedgerTotal: "10.000000" }),
    );

    // (b) forced break #1 — payment book net altered by 1 micro → C3 FAILS
    const mb = newMachine({ machineId: "M-RECON-B1" });
    defineProgram(mb.machine, "PROG-RECON-B1");
    recordFreshAttestation(mb.machine, "ATT-RECON-B1");
    drive(mb.machine, { requestId: "S9-B1", grossMicro: GROSS_10K, stopAfter: "ISSUED" });
    mb.machine.__testOnlyForceLedgerBreak("PAYMENT_BOOK_NET", "S9-B1", 1n);
    const brokenNet = reconcileThreeBooks(mb.machine.ledgerSnapshot());
    check(
      "S9-03",
      "forced 1-micro PAYMENT-BOOK break DETECTED: C3 value-conservation FAILS while C1/C2/C4 still pass (the failure is localized to the corrupted book)",
      !brokenNet.balanced &&
        brokenNet.checks.find((c) => c.check === "C3_VALUE_CONSERVATION_AND_1TO1_PAYMENT_LINKAGE")?.passed === false &&
        brokenNet.checks.filter((c) => c.passed).length === 3,
      JSON.stringify(brokenNet.checks.map((c) => `${c.check.split("_")[0]}=${c.passed ? "PASS" : "FAIL"}`)),
    );
    const recB = mb.machine.reconcile("S9-B1");
    check(
      "S9-04",
      "machine reconcile() routes the detected break to RECONCILIATION_BREAK + pipeline SUSPENDED + OPEN exception (fail-closed, spec §6.6 RECONCILE_MISMATCH)",
      recB.state === "RECONCILIATION_BREAK" && mb.machine.pipelineSuspended && mb.machine.getExceptions().some((x) => x.taxonomyClass === "RECONCILE_MISMATCH" && x.status === "OPEN"),
      `state=${recB.state}, suspended=${mb.machine.pipelineSuspended}`,
    );
    eq("S9-05", "mint record PRESERVED on the broken machine (no silent write-off)", mb.machine.getSupplySnapshot().totalSupplyMicro, "4995.000000");

    // (c) forced break #2 — token book amount altered by 1 micro → C1 + C2 FAIL
    const mc = newMachine({ machineId: "M-RECON-B2" });
    defineProgram(mc.machine, "PROG-RECON-B2");
    recordFreshAttestation(mc.machine, "ATT-RECON-B2");
    drive(mc.machine, { requestId: "S9-C1", grossMicro: GROSS_10K, stopAfter: "ISSUED" });
    mc.machine.__testOnlyForceLedgerBreak("TOKEN_BOOK_AMOUNT", "S9-C1", 1n);
    const brokenTok = reconcileThreeBooks(mc.machine.ledgerSnapshot());
    check(
      "S9-06",
      "forced 1-micro TOKEN-BOOK break DETECTED: C1 (supply counter vs token book) AND C2 (issuance↔token 1:1 linkage) FAIL",
      !brokenTok.balanced &&
        brokenTok.checks.find((c) => c.check === "C1_TOKEN_BOOK_EQUALS_TOTAL_SUPPLY")?.passed === false &&
        brokenTok.checks.find((c) => c.check === "C2_ISSUANCE_BOOK_LINKS_TOKEN_BOOK_1TO1")?.passed === false,
      JSON.stringify(brokenTok.checks.map((c) => `${c.check.split("_")[0]}=${c.passed ? "PASS" : "FAIL"}`)),
    );
    check(
      "S9-07",
      "the C1 detail discloses the exact 1-micro divergence (token Σ 4995.000001 vs supply 4995.000000)",
      (brokenTok.checks.find((c) => c.check === "C1_TOKEN_BOOK_EQUALS_TOTAL_SUPPLY")?.detail ?? "").includes("4995.000001") && (brokenTok.checks.find((c) => c.check === "C1_TOKEN_BOOK_EQUALS_TOTAL_SUPPLY")?.detail ?? "").includes("4995.000000"),
      brokenTok.checks.find((c) => c.check === "C1_TOKEN_BOOK_EQUALS_TOTAL_SUPPLY")?.detail ?? "missing",
    );
    const recC = mc.machine.reconcile("S9-C1");
    check("S9-08", "the token-book break also routes to RECONCILIATION_BREAK + SUSPENDED (fail-closed on every divergence)", recC.state === "RECONCILIATION_BREAK" && mc.machine.pipelineSuspended, `state=${recC.state}, suspended=${mc.machine.pipelineSuspended}`);
    mc.machine.__testOnlyForceLedgerBreak("TOKEN_BOOK_AMOUNT", "S9-C1", -1n); // TEST-ONLY restoration AFTER detection (the machine REMAINS SUSPENDED with its OPEN exception — detection is already recorded in the log; restoration only lets the final sweep re-verify token-book = supply)
    const invRecon = [mb.machine, mc.machine].every((m) => invOk(m).ok);
    check("S9-09", "machine-level invariants hold on the broken machines (INV-D: suspensions carry reasons + OPEN exceptions)", invRecon, "assertInvariants() passed on both break machines");
  }

  // =========================================================================
  // S10 — SEP-01 separation invariant (MANDATORY — spec §2 / MANDATE-004 §7)
  // =========================================================================
  section("S10", "SEP-01 separation invariant — basket snapshot BYTE-IDENTICAL before/after issuance volume + SOURCE-SCAN test-of-absence");
  {
    // (a) runtime byte-identity: capture the canonical basket snapshot BEFORE any issuance volume
    const before = basketSnapshotBytes();
    const sep = newMachine({ machineId: "M-SEP" });
    defineProgram(sep.machine, "PROG-SEP-001");
    recordFreshAttestation(sep.machine, "ATT-SEP-001");
    const registryBefore = sep.registry.serializeHonestSnapshot();
    const snapBefore = captureBasketSnapshot();
    eq("S10-01", "separation snapshot prior weights are the STRATEGIC_PRIOR fractions (27/20/9/8/5/5/26%)", JSON.stringify(snapBefore.priorWeights), JSON.stringify({ USD: 0.27, EUR: 0.2, JPY: 0.09, GBP: 0.08, CNY: 0.05, CHF: 0.05, Gold: 0.26 }));
    eq("S10-02", "separation snapshot constituency is the canonical genesis ASSET-registry token list (9 rows incl. governance-pending TBD placeholders; the snapshot WEIGHTS remain the 7-component STRATEGIC_PRIOR)", JSON.stringify(snapBefore.constituency), JSON.stringify(["USDC", "USDP", "USDT", "EURC", "TBD", "TBD", "TBD", "PAXG", "XAUT"]));

    // three issuances mirroring the validated prototype amounts: 1,000 + 25,000 + 7,500 gross TU
    const r1 = drive(sep.machine, { requestId: "SEP-R1", grossMicro: 1_000_000_000n });
    const r2 = drive(sep.machine, { requestId: "SEP-R2", grossMicro: 25_000_000_000n });
    const r3 = drive(sep.machine, { requestId: "SEP-R3", grossMicro: 7_500_000_000n });
    eq("S10-03", "issuance 1: gross 1000.000000 → fee 1.000000 → net 999.000000 → issued 499.500000 (RECONCILED)", `${r1.last.state}/${sep.machine.getInstanceState("SEP-R1")?.issuedMicro}`, "RECONCILED/499.500000");
    eq("S10-04", "issuance 2: gross 25000.000000 → fee 25.000000 → net 24975.000000 → issued 12487.500000 (RECONCILED)", `${r2.last.state}/${sep.machine.getInstanceState("SEP-R2")?.issuedMicro}`, "RECONCILED/12487.500000");
    eq("S10-05", "issuance 3: gross 7500.000000 → fee 7.500000 → net 7492.500000 → issued 3746.250000 (RECONCILED)", `${r3.last.state}/${sep.machine.getInstanceState("SEP-R3")?.issuedMicro}`, "RECONCILED/3746.250000");
    eq("S10-06", "supply reaches exactly 16733.250000 across the three issuances (499.500000 + 12487.500000 + 3746.250000)", sep.machine.getSupplySnapshot().totalSupplyMicro, "16733.250000");

    const after = basketSnapshotBytes();
    check(
      "S10-07",
      "basket/constituency snapshot BYTE-IDENTICAL before vs after the issuance volume (payment volume NEVER changes basket eligibility or weights — spec §2, MANDATE-004 §7)",
      basketSnapshotsByteIdentical(before, after),
      `byte-identical=${basketSnapshotsByteIdentical(before, after)} (snapshot length ${before.length} bytes)`,
    );
    eq("S10-08", "payment-instrument registry honesty snapshot UNCHANGED by issuance volume (no auto-admit, no auto-suspend, no telemetry)", sep.registry.serializeHonestSnapshot(), registryBefore);
    const serializedLog = JSON.stringify(sep.machine.getEventLog());
    check(
      "S10-09",
      "issuance event log contains NO basket/weight/eligibility/constituency fields (structural test-of-absence at the data level)",
      !/basket|weight|eligib|constituency/i.test(serializedLog),
      `suspicious tokens present: ${/basket|weight|eligib|constituency/i.test(serializedLog)}`,
    );
    const reconSep = reconcileThreeBooks(sep.machine.ledgerSnapshot());
    check("S10-10", "three-book C1–C4 equality holds after the three SEP issuances (payment ledger 3 · issuance 3 · token Σ = supply 16733.250000 · fee ledger 33.500000)", reconSep.balanced && reconSep.bookTotals.tokenBookSum === "16733.250000" && reconSep.bookTotals.feeLedgerTotal === "33.500000", JSON.stringify(reconSep.bookTotals));

    // (b) SOURCE-SCAN test-of-absence: the issuance DATA-PATH modules import nothing from weighting/eligibility modules
    const dataPathFiles = fs
      .readdirSync(ISSUANCE_DIR)
      .filter((f) => f.endsWith(".ts") && f !== "separation-check.ts")
      .sort();
    const forbiddenRe = /(?:^|\n)\s*(?:import|export)\s[^;\n]*?["']\.\.\/(blueprint|chain-index|registry|mase|constituency)(?:\/[^"']*)?["']/;
    const offenders: string[] = [];
    for (const f of dataPathFiles) {
      const text = fs.readFileSync(path.join(ISSUANCE_DIR, f), "utf8");
      if (forbiddenRe.test(text)) offenders.push(f);
    }
    check(
      "S10-11",
      "SOURCE-SCAN: NO issuance data-path module imports ../blueprint, ../chain-index, ../registry, ../mase or ../constituency (spec §2 structural layer; the machine/registry/authorization/ledger/adapter/parameters/fixtures files are clean)",
      offenders.length === 0,
      `scanned ${dataPathFiles.length} files (${dataPathFiles.join(", ")}); offenders: ${offenders.length === 0 ? "none" : offenders.join(", ")}`,
    );
    const sepCheckText = fs.readFileSync(path.join(ISSUANCE_DIR, "separation-check.ts"), "utf8");
    const sepImports = [...sepCheckText.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'](\.\.\/[a-z-]+)["']/g)].map((m) => ({ names: m[1].split(",").map((s) => s.trim().replace(/^type\s+/, "")).filter((s) => s.length > 0), module: m[2] }));
    const readOnlyAllowlist = new Set(["genesisRegistry", "eligibilityScore", "AssetRecord", "strategicPriorToWeights", "STRATEGIC_PRIOR"]);
    const sepModulesOk = sepImports.every((i) => ["../registry", "../chain-index", "../blueprint"].includes(i.module));
    const sepNamesOk = sepImports.every((i) => i.names.every((n) => readOnlyAllowlist.has(n)));
    check(
      "S10-12",
      "the separation CHECKER (separation-check.ts — display/test side) imports ONLY the known read-only allowlist from the methodology modules (genesisRegistry · eligibilityScore · AssetRecord · strategicPriorToWeights · STRATEGIC_PRIOR)",
      sepModulesOk && sepNamesOk,
      `imports=${JSON.stringify(sepImports)}`,
    );
  }

  // =========================================================================
  // S11 — Ledger & persistence (mapEventToDoc · in-memory sink · failing sink)
  // =========================================================================
  section("S11", "Ledger & persistence — exact flat Prisma IssuanceEvent field set · in-memory sink collects ALL events · failing sink DISCLOSED, cursor not advanced, retry byte-stable");
  {
    const DOC_KEYS = ["requestId", "kind", "state", "instrument", "grossAmount", "feeAmount", "netAmount", "quote", "issuedAmount", "supplyAfter", "payload"].sort().join(",");
    const MONEY_RE = /^(|-?\d+\.\d{6})$/; // "" when not applicable, else exact 6-decimal fixed point
    const KIND_ENUM = new Set([
      "REQUEST", "QUOTE", "PAYMENT", "SETTLEMENT", "INSTRUMENT", "FEES", "NET", "AUTHORIZATION", "SUPPLY",
      "ISSUED", "RECONCILIATION", "REVERSAL", "REFUND", "ATTESTATION", "PROGRAM", "PIPELINE", "FAILURE",
      "TRANSITION_REJECT", "OTHER",
    ]);
    const STATES = new Set([...Object.keys(ALLOWED_TRANSITIONS), ""]);

    // (a) mapEventToDoc over EVERY event emitted so far in the run (machines S0–S10)
    const eventsSoFar = allMachines.flatMap((x) => x.machine.getEventLog());
    const docsSoFar = eventsSoFar.map(mapEventToDoc);
    const fieldSetOk = docsSoFar.every((d) => Object.keys(d).sort().join(",") === DOC_KEYS);
    check(
      "S11-01",
      "mapEventToDoc produces the EXACT flat IssuanceEventDoc field set for EVERY event kind emitted in the run (11 primitive-string fields, no more, no less)",
      fieldSetOk,
      `events=${docsSoFar.length}, fieldSetOk=${fieldSetOk}`,
    );
    const primitivesOk = docsSoFar.every((d) => Object.values(d).every((v) => typeof v === "string"));
    check("S11-02", "every doc value is a PRIMITIVE STRING (flat Prisma shape — no nested objects, no BigInts)", primitivesOk, `primitiveStrings=${primitivesOk}`);
    const moneyOk = docsSoFar.every((d) => [d.grossAmount, d.feeAmount, d.netAmount, d.quote, d.issuedAmount, d.supplyAfter].every((v) => MONEY_RE.test(v)));
    check("S11-03", "every money field is an EXACT 6-decimal fixed-point string (or \"\" when not applicable) — no floating-point noise", moneyOk, `moneyFormat=${moneyOk}`);
    const payloadOk = docsSoFar.every((d) => {
      const p = JSON.parse(d.payload) as Record<string, unknown>;
      return Object.keys(p).sort().join(",") === "atMs,detail,from,reasonCode,seq,stepRef,taxonomyClass,to";
    });
    check("S11-04", "every payload is JSON with the exact flattened detail keys (seq, atMs, from, to, stepRef, reasonCode, detail, taxonomyClass)", payloadOk, `payloadShape=${payloadOk}`);
    const statesOk = docsSoFar.every((d) => STATES.has(d.state));
    check("S11-05", "every doc state is a valid IssuanceState (or \"\" for machine-level lifecycle events)", statesOk, `statesValid=${statesOk}`);
    const kindsEmitted = new Set(docsSoFar.map((d) => d.kind));
    const kindsValid = [...kindsEmitted].every((k) => KIND_ENUM.has(k));
    const REQUIRED_KINDS = ["REQUEST", "QUOTE", "PAYMENT", "SETTLEMENT", "INSTRUMENT", "FEES", "NET", "AUTHORIZATION", "SUPPLY", "ISSUED", "RECONCILIATION", "REVERSAL", "REFUND", "ATTESTATION", "PROGRAM", "PIPELINE", "TRANSITION_REJECT"];
    const kindsCovered = REQUIRED_KINDS.every((k) => kindsEmitted.has(k));
    check(
      "S11-06",
      "kinds coverage: every emitted kind is in the documented enum AND all 17 core kinds are exercised by the run (REQUEST·QUOTE·PAYMENT·SETTLEMENT·INSTRUMENT·FEES·NET·AUTHORIZATION·SUPPLY·ISSUED·RECONCILIATION·REVERSAL·REFUND·ATTESTATION·PROGRAM·PIPELINE·TRANSITION_REJECT)",
      kindsValid && kindsCovered,
      `emitted=${[...kindsEmitted].sort().join("·")} (missing: ${REQUIRED_KINDS.filter((k) => !kindsEmitted.has(k)).join("·") || "none"})`,
    );

    // (b) doc field set matches the Prisma IssuanceEvent model exactly (read-only schema cross-check)
    const schemaText = fs.readFileSync(PRISMA_SCHEMA, "utf8");
    const modelBlock = schemaText.split("model IssuanceEvent {")[1]?.split("\n}")[0] ?? "";
    const modelFields = modelBlock
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("@@"))
      .map((l) => l.split(/\s+/)[0])
      .sort();
    const docFieldsPlusPrismaGenerated = [...DOC_KEYS.split(","), "createdAt", "id"].sort();
    eq(
      "S11-07",
      "the doc field set + Prisma-generated (id, createdAt) equals the prisma/schema.prisma IssuanceEvent model field set EXACTLY",
      JSON.stringify(modelFields),
      JSON.stringify(docFieldsPlusPrismaGenerated),
    );

    // (c) in-memory sink collects ALL events (count == machine event-log count)
    const ledger = new IssuanceLedger(e2e.machine);
    const sink = createInMemoryIssuanceEventSink();
    const pendingCount = ledger.pendingEventDocs().length;
    const flush1 = await ledger.flush(sink);
    check(
      "S11-08",
      "in-memory sink: pending docs count == machine event-log count and the flush writes them ALL (nothing skipped, nothing doubled)",
      pendingCount === e2e.machine.getEventLog().length && sink.docs.length === pendingCount && flush1.written === pendingCount && flush1.error === null,
      `pending=${pendingCount}, eventLog=${e2e.machine.getEventLog().length}, sinkDocs=${sink.docs.length}, written=${flush1.written}`,
    );

    // (d) a DELIBERATELY FAILING sink: failure is DISCLOSED, cursor NOT advanced, events NOT lost
    const failingSeen: IssuanceEventDoc[] = [];
    const failingSink: IssuanceEventSink = {
      async write(doc: IssuanceEventDoc): Promise<void> {
        failingSeen.push(doc);
        throw new Error("DELIBERATE TEST SINK FAILURE — persistence failure must be disclosed, never silently swallowed");
      },
    };
    const ledger2 = new IssuanceLedger(e2e.machine);
    const failFlush = await ledger2.flush(failingSink);
    check(
      "S11-09",
      "flush with a DELIBERATELY FAILING sink returns written=0 and a NON-NULL error (the failure is DISCLOSED to the caller — never swallowed)",
      failFlush.written === 0 && failFlush.error !== null && failFlush.error.includes("DELIBERATE TEST SINK FAILURE"),
      `written=${failFlush.written}, error=${failFlush.error}`,
    );
    eq("S11-10", "cursor NOT advanced after the failed flush (every event is still pending)", ledger2.pendingEventDocs().length, pendingCount);
    const sink2 = createInMemoryIssuanceEventSink();
    const retryFlush = await ledger2.flush(sink2);
    check("S11-11", "retry flush succeeds and writes EVERY event (events were NOT lost by the earlier failure)", retryFlush.written === pendingCount && sink2.docs.length === pendingCount, `written=${retryFlush.written}, docs=${sink2.docs.length}`);
    const retryFlush2 = await ledger2.flush(sink2);
    check("S11-12", "a further flush with nothing pending writes 0 (no double-write; cursor advanced exactly once)", retryFlush2.written === 0 && retryFlush2.error === null, `written=${retryFlush2.written}, error=${retryFlush2.error}`);
    check(
      "S11-13",
      "retry docs are BYTE-STABLE: the retried docs serialize identically to (a) the direct mapEventToDoc of the machine log and (b) the doc the failing sink was asked to write",
      JSON.stringify(sink2.docs) === JSON.stringify(e2e.machine.getEventLog().map(mapEventToDoc)) && failingSeen.length >= 1 && JSON.stringify(failingSeen[0]) === JSON.stringify(sink2.docs[0]),
      `byteStable=${JSON.stringify(sink2.docs) === JSON.stringify(e2e.machine.getEventLog().map(mapEventToDoc))}, firstDocIdentical=${failingSeen.length >= 1 && JSON.stringify(failingSeen[0]) === JSON.stringify(sink2.docs[0])}`,
    );

    // (e) the ledger VIEW (auditability facade)
    const view = ledger.view();
    check(
      "S11-14",
      "IssuanceLedger.view() reflects the run (requests · payments · mints with the LEDGER-RECORD-ONLY label · reconciliation balanced · supply snapshot)",
      view.mints.length === 1 && view.mints[0].recordOnlyLabel.includes("NEVER ON-CHAIN") && view.reconciliation.balanced && view.supply.totalSupplyMicro === "4995.000000",
      `mints=${view.mints.length}, supply=${view.supply.totalSupplyMicro}, balanced=${view.reconciliation.balanced}`,
    );

    // (f) the real Prisma sink is asserted BY TYPE/LABEL ONLY — never invoked from this runner (no DB touch)
    check(
      "S11-15",
      "createPrismaIssuanceEventSink EXISTS as the server-side sink factory (type-checked by reference only — this deterministic runner never invokes it and never touches the Prisma DB)",
      typeof createPrismaIssuanceEventSink === "function",
      `typeof=${typeof createPrismaIssuanceEventSink} (NOT invoked)`,
    );
  }

  // =========================================================================
  // S12 — CBDC adapter honesty (SIMULATED / NOT CONNECTED)
  // =========================================================================
  section("S12", "CBDC adapter honesty — SIMULATED / NOT CONNECTED · every simulated message labeled · ONE clearly-labeled SIMULATION-MODE demo issuance");
  {
    eq("S12-01", "adapter status is the literal SIMULATED / NOT CONNECTED", CBDC_ADAPTER_STATUS, "SIMULATED / NOT CONNECTED");
    eq("S12-02", "adapter marker is the literal SIMULATED — NOT CONNECTED", CBDC_ADAPTER_MARKER, "SIMULATED — NOT CONNECTED");

    const probe = new SimulatedCbdcAdapter({ nowMs: () => 0 });
    const honesty = cbdcAdapterHonestyRecord(probe);
    check(
      "S12-03",
      "adapter honesty record documents all NINE §7.4 concerns + the honest limitations, and the real-adapter gate axes are ALL false",
      honesty.concerns.length === 9 && honesty.limitations.length === 6 && honesty.realAdapterGate.authorizedInterfaceVerified === false && honesty.realAdapterGate.endToEndIntegrationTested === false && honesty.realAdapterGate.admissionDossierAnnexExists === false,
      `concerns=${honesty.concerns.length}, limitations=${honesty.limitations.length}, gate=${JSON.stringify(honesty.realAdapterGate)}`,
    );

    // (a) normal mode: CBDC quotes REFUSED (spec §6.2: absent interface ⇒ no quotes at all)
    const strict = newMachine({ machineId: "M-CBDC-STRICT" });
    const refused = drive(strict.machine, { requestId: "S12-A1", grossMicro: 5_000_000_000n, instrumentCode: TEST_CBDC_INSTRUMENT.code, network: TEST_CBDC_INSTRUMENT.network, stopAfter: "QUOTED" });
    check(
      "S12-04",
      "normal mode (no SIMULATION MODE): CBDC quotes REFUSED while NOT CONNECTED (INVALID_INSTRUMENT / CBDC_NOT_CONNECTED_NO_QUOTES; spec §4 admission requires a verified authorized interface + recorded end-to-end test — NEITHER EXISTS)",
      refused.last.state === "INVALID_INSTRUMENT" && refused.last.reasonCode === "CBDC_NOT_CONNECTED_NO_QUOTES",
      `state=${refused.last.state}, reason=${refused.last.reasonCode}`,
    );

    // (b) SIMULATION MODE — one clearly-labeled demo issuance driven by simulated adapter messages
    const sim = newMachine({ machineId: "M-CBDC-SIM", cbdcSimulation: true });
    defineProgram(sim.machine, "PROG-CBDC-SIM-001", [{ code: TEST_CBDC_INSTRUMENT.code, network: TEST_CBDC_INSTRUMENT.network }]);
    recordFreshAttestation(sim.machine, "ATT-CBDC-SIM-001");
    const adapter = new SimulatedCbdcAdapter({ nowMs: () => sim.machine.nowMs });
    const registryBeforeSim = sim.registry.serializeHonestSnapshot();
    const t0 = sim.machine.nowMs;
    const init = adapter.initiatePayment({ txId: "CBDC-SIM-TX-001", amountMicro: 5_000_000_000n, payerId: "TEST-PAYER-001", instrumentCode: TEST_CBDC_INSTRUMENT.code, correlationRef: "S12-B1" });
    check("S12-05", "every simulated message carries simulation:true + the SIMULATED — NOT CONNECTED marker (initiation)", init.simulation === true && init.marker === CBDC_ADAPTER_MARKER && init.status === "INITIATED", `simulation=${init.simulation}, marker=${init.marker}, status=${init.status}`);
    const verified = adapter.verifyPayment("CBDC-SIM-TX-001");
    const settledMsg = adapter.querySettlementStatus("CBDC-SIM-TX-001");
    check(
      "S12-06",
      "verification and settlement-status messages carry the same labels; the SETTLED message carries the interface's own finality signal (finality-at timestamp, §7.4 concern 7)",
      verified.simulation === true && verified.marker === CBDC_ADAPTER_MARKER && settledMsg.simulation === true && settledMsg.marker === CBDC_ADAPTER_MARKER && settledMsg.status === "SETTLED" && settledMsg.finalityAtMs !== null,
      `verified=${verified.status}, settled=${settledMsg.status}, finalityAtMs=${settledMsg.finalityAtMs}`,
    );
    sim.machine.submitIssuanceRequest({
      requestId: "S12-B1",
      idempotencyKey: "IDK-S12-B1",
      instrumentCode: TEST_CBDC_INSTRUMENT.code,
      network: TEST_CBDC_INSTRUMENT.network,
      payerId: "TEST-PAYER-001",
      recipientId: "TEST-RECIPIENT-001",
      jurisdiction: "TEST-JURISDICTION",
      requestedInstrumentAmountMicro: 5_000_000_000n,
    });
    const q = sim.machine.generateQuote("S12-B1");
    check("S12-07", "SIMULATION-MODE quote generated for the simulated CBDC descriptor (labeled — NOT an integration)", q.ok && q.state === "QUOTED", `state=${q.state}, reason=${q.reasonCode}`);
    sim.machine.observePayment("S12-B1", { paymentTxId: "CBDC-SIM-TX-001", payerId: "TEST-PAYER-001", amountMicro: 5_000_000_000n, authTag: init.authTag ?? "", observedAtMs: t0 });
    sim.machine.verifyPaymentAuthenticity("S12-B1");
    const cs = sim.machine.confirmSettlement("S12-B1", { status: "SETTLED", settledAmountMicro: 5_000_000_000n, sourceLabel: `${adapter.adapterId} (${CBDC_ADAPTER_MARKER})`, finalityAtMs: settledMsg.finalityAtMs ?? sim.machine.nowMs });
    check("S12-08", "the machine accepts the simulated interface's finality signal IN SIMULATION MODE ONLY (labeled source required)", cs.ok && cs.state === "SETTLEMENT_FINAL", `state=${cs.state}, reason=${cs.reasonCode}`);
    const settleDetail = sim.machine.getEventLog().find((e) => e.requestId === "S12-B1" && e.to === "SETTLEMENT_FINAL")?.detail ?? "";
    check("S12-09", "the settlement record discloses the SIMULATED — NOT CONNECTED finality basis", settleDetail.includes("SIMULATED — NOT CONNECTED"), settleDetail.slice(0, 120) + "…");
    sim.machine.checkInstrument("S12-B1");
    sim.machine.calculateFees("S12-B1");
    sim.machine.acceptNetValue("S12-B1");
    sim.machine.authorize("S12-B1");
    sim.machine.checkSupply("S12-B1");
    const issued = sim.machine.issue("S12-B1");
    const recon = sim.machine.reconcile("S12-B1");
    check(
      "S12-10",
      "SIMULATION-MODE demo issuance completes end-to-end to RECONCILED (gross 5000.000000 → fee 5.000000 → net 4995.000000 → issued 2497.500000)",
      issued.ok && recon.ok && sim.machine.getInstanceState("S12-B1")?.issuedMicro === "2497.500000",
      `issued=${sim.machine.getInstanceState("S12-B1")?.issuedMicro}, state=${sim.machine.getInstanceState("S12-B1")?.state}`,
    );
    const simLabels = sim.machine.getInstanceState("S12-B1")?.simulationLabels ?? [];
    check(
      "S12-11",
      "the SIMULATION-MODE instance carries the full label set (SIMULATION-MODE QUOTE · SIMULATED — NOT CONNECTED · NOT-an-integration disclosure)",
      simLabels.includes("SIMULATION-MODE QUOTE (SIMULATED — NOT CONNECTED)") && simLabels.includes("SIMULATED — NOT CONNECTED") && simLabels.some((l) => l.includes("NOT an integration")),
      `labels=${JSON.stringify(simLabels)}`,
    );
    const cbdcRowAfter = sim.registry.byId("TEST-CBDC-001");
    check(
      "S12-12",
      "the registry is UNCHANGED by the simulation run: the CBDC row is still CANDIDATE / NOT_CONNECTED (the demo is NOT an integration and admits nothing) and the honesty snapshot is byte-identical",
      cbdcRowAfter?.state === "CANDIDATE" && cbdcRowAfter?.honestyState === "NOT_CONNECTED" && sim.registry.serializeHonestSnapshot() === registryBeforeSim,
      `row=${cbdcRowAfter?.state}/${cbdcRowAfter?.honestyState}, snapshotIdentical=${sim.registry.serializeHonestSnapshot() === registryBeforeSim}`,
    );

    // (c) duplicate prevention at the adapter (§7.4 concern 6)
    const dupInit = adapter.initiatePayment({ txId: "CBDC-SIM-TX-001", amountMicro: 5_000_000_000n, payerId: "TEST-PAYER-001", instrumentCode: TEST_CBDC_INSTRUMENT.code, correlationRef: "S12-B1" });
    check(
      "S12-13",
      "duplicate txId initiation PREVENTED at the adapter (duplicatePrevented flag + FAILED status; the original message is returned — never a second execution)",
      dupInit.duplicatePrevented && dupInit.status === "FAILED" && dupInit.marker === CBDC_ADAPTER_MARKER,
      `duplicatePrevented=${dupInit.duplicatePrevented}, status=${dupInit.status}, reason=${dupInit.reasonCode}`,
    );
    const unknown = adapter.verifyPayment("CBDC-SIM-TX-UNKNOWN");
    check("S12-14", "unknown txId → FAILED (TX_NOT_FOUND) with the marker (no verification is possible for an unknown transaction)", unknown.status === "FAILED" && unknown.reasonCode === "TX_NOT_FOUND" && unknown.marker === CBDC_ADAPTER_MARKER, `status=${unknown.status}, reason=${unknown.reasonCode}`);

    // (d) duplicate prevention at the MACHINE (second request observing the same CBDC txId)
    const dup2 = newMachine({ machineId: "M-CBDC-DUP", cbdcSimulation: true });
    defineProgram(dup2.machine, "PROG-CBDC-DUP-001", [{ code: TEST_CBDC_INSTRUMENT.code, network: TEST_CBDC_INSTRUMENT.network }]);
    recordFreshAttestation(dup2.machine, "ATT-CBDC-DUP-001");
    const ad2 = new SimulatedCbdcAdapter({ nowMs: () => dup2.machine.nowMs });
    const init2 = ad2.initiatePayment({ txId: "CBDC-SIM-TX-002", amountMicro: 5_000_000_000n, payerId: "TEST-PAYER-001", instrumentCode: TEST_CBDC_INSTRUMENT.code, correlationRef: "S12-D1" });
    driveCbdcSim(dup2.machine, ad2, "S12-D1", "CBDC-SIM-TX-002", init2.authTag ?? "");
    eq("S12-15", "first CBDC-sim issuance mints 2497.500000", dup2.machine.getSupplySnapshot().totalSupplyMicro, "2497.500000");
    const dupObs = driveCbdcSim(dup2.machine, ad2, "S12-D2", "CBDC-SIM-TX-002", init2.authTag ?? "");
    check("S12-16", "a second request observing the SAME CBDC txId → DUPLICATE terminal (no double mint)", dupObs.state === "DUPLICATE", `state=${dupObs.state}, reason=${dupObs.reasonCode.slice(0, 40)}…`);
    eq("S12-17", "supply UNCHANGED by the duplicate (still exactly one 2497.500000 mint)", dup2.machine.getSupplySnapshot().totalSupplyMicro, "2497.500000");

    // (e) reconciliation statement (§7.4 concern 9 — labeled synthetic)
    const stmt = adapter.buildReconciliationStatement(["S12-B1"]);
    check(
      "S12-18",
      "the provider-side reconciliation statement carries simulation:true + the marker + the correlation entries (a REAL reconciliation interface does not exist — spec §14.3 concern 9)",
      stmt.simulation === true && stmt.marker === CBDC_ADAPTER_MARKER && stmt.entries.some((en) => en.txId === "CBDC-SIM-TX-001"),
      `simulation=${stmt.simulation}, marker=${stmt.marker}, entries=${stmt.entries.length}`,
    );
    const invSim = invOk(sim.machine).ok && invOk(dup2.machine).ok;
    check("S12-19", "machine-level invariants hold on the CBDC simulation machines (INV-E labels intact on the simulated mint)", invSim, "assertInvariants() passed on both simulation machines");
  }

  // =========================================================================
  // S13 — Constituency quiescence (M8-3a)
  // =========================================================================
  section("S13", "Constituency quiescence — genesis 7 at STRATEGIC_PRIOR bp · zero transitions ever · empty-directive lifecycle run · weights match the separation snapshot");
  {
    eq("S13-01", "DEFAULT_REGISTRY contains exactly the 7 genesis components", DEFAULT_REGISTRY.size(), 7);
    eq("S13-02", "genesis stable IDs (ascending)", JSON.stringify(DEFAULT_REGISTRY.ids()), JSON.stringify(["CCY-CHF", "CCY-CNY", "CCY-EUR", "CCY-GBP", "CCY-JPY", "CCY-USD", "CCY-XAU"]));
    eq("S13-03", "genesis display codes (USD/EUR/JPY/GBP/CNY/CHF/Gold-XAU)", JSON.stringify(DEFAULT_REGISTRY.entries().map((e) => e.displayCode)), JSON.stringify(["CHF", "CNY", "EUR", "GBP", "JPY", "USD", "XAU"]));
    check(
      "S13-04",
      "every genesis member is at its genesis lifecycle state ACTIVE (the quiescent state; no transition has ever run)",
      DEFAULT_REGISTRY.countByStatus("ACTIVE") === 7 && defaultActiveBasketCount() === 7 && DEFAULT_REGISTRY.entries().every((e) => e.status === "ACTIVE"),
      `active=${DEFAULT_REGISTRY.countByStatus("ACTIVE")}/${DEFAULT_REGISTRY.size()}`,
    );
    const genesisBp = defaultGenesisWeightsBp();
    eq("S13-05", "genesis weights sum to EXACTLY 10000 bp", Object.values(genesisBp).reduce((a, b) => a + b, 0), 10000);
    eq(
      "S13-06",
      "genesis weights in bp are the STRATEGIC_PRIOR shares (CHF 500 · CNY 500 · EUR 2000 · GBP 800 · JPY 900 · USD 2700 · XAU/Gold 2600)",
      JSON.stringify(genesisBp),
      JSON.stringify({ "CCY-CHF": 500, "CCY-CNY": 500, "CCY-EUR": 2000, "CCY-GBP": 800, "CCY-JPY": 900, "CCY-USD": 2700, "CCY-XAU": 2600 }),
    );
    const priorBp = {
      USD: Math.round(STRATEGIC_PRIOR.USD * 10000),
      EUR: Math.round(STRATEGIC_PRIOR.EUR * 10000),
      JPY: Math.round(STRATEGIC_PRIOR.JPY * 10000),
      GBP: Math.round(STRATEGIC_PRIOR.GBP * 10000),
      CNY: Math.round(STRATEGIC_PRIOR.CNY * 10000),
      CHF: Math.round(STRATEGIC_PRIOR.CHF * 10000),
      Gold: Math.round(STRATEGIC_PRIOR.Gold * 10000),
    };
    const registryPriorMatch =
      genesisBp["CCY-USD"] === priorBp.USD && genesisBp["CCY-EUR"] === priorBp.EUR && genesisBp["CCY-JPY"] === priorBp.JPY &&
      genesisBp["CCY-GBP"] === priorBp.GBP && genesisBp["CCY-CNY"] === priorBp.CNY && genesisBp["CCY-CHF"] === priorBp.CHF && genesisBp["CCY-XAU"] === priorBp.Gold;
    check("S13-07", "registry genesis weights equal the blueprint STRATEGIC_PRIOR × 10000 (byte-identical defaults — the registry-era replacement of the fixed arrays)", registryPriorMatch, `registry={${Object.entries(genesisBp).sort().map(([k, v]) => `${k}:${v}`).join(",")}}`);
    const envMatch = DEFAULT_REGISTRY.entries().every((e) => {
      const key = e.displayCode === "XAU" ? "Gold" : e.displayCode;
      return e.envelope.min === ADMISSIBILITY_ENVELOPES[key as keyof typeof ADMISSIBILITY_ENVELOPES].lower && e.envelope.max === ADMISSIBILITY_ENVELOPES[key as keyof typeof ADMISSIBILITY_ENVELOPES].upper;
    });
    check("S13-08", "registry envelopes equal the blueprint ADMISSIBILITY_ENVELOPES (constitutional defaults carried as genesis data)", envMatch, `envelopesMatch=${envMatch}`);
    const velMatch = DEFAULT_REGISTRY.entries().every((e) => {
      const key = e.displayCode === "XAU" ? "Gold" : e.displayCode;
      return e.velocityPerPeriod === MAX_VELOCITY[key];
    });
    check("S13-09", "registry velocity classes equal the blueprint MAX_VELOCITY values", velMatch, `velocityMatch=${velMatch}`);
    const fixingOf = (code: string): number =>
      code === "USD" ? 1.0 : code === "EUR" ? BASE_FIXINGS.EUR_USD : code === "JPY" ? BASE_FIXINGS.JPY_USD : code === "GBP" ? BASE_FIXINGS.GBP_USD : code === "CNY" ? BASE_FIXINGS.CNY_USD : code === "CHF" ? BASE_FIXINGS.CHF_USD : BASE_FIXINGS.XAU_USD;
    const fixMatch = DEFAULT_REGISTRY.entries().every((e) => e.baseFixing === fixingOf(e.displayCode));
    check("S13-10", "registry base fixings equal the blueprint BASE_FIXINGS (incl. CHF 1.13 and XAU 2500 — Master Blueprint v1.0)", fixMatch, `fixingsMatch=${fixMatch}`);
    check(
      "S13-11",
      "every genesis record cites the genesis dossier ref and carries the fixed 7-label MASE bridge (no post-genesis registration exists)",
      DEFAULT_REGISTRY.entries().every((e) => e.dossierRef === GENESIS_DOSSIER_REF && e.maseLabel !== null),
      `dossier+MASE labels intact on all ${DEFAULT_REGISTRY.size()} records`,
    );

    // the quiescent registry weights match the separation-check snapshot's weights
    const snap = captureBasketSnapshot();
    const snapMatch =
      Math.round(snap.priorWeights.USD * 10000) === genesisBp["CCY-USD"] &&
      Math.round(snap.priorWeights.EUR * 10000) === genesisBp["CCY-EUR"] &&
      Math.round(snap.priorWeights.JPY * 10000) === genesisBp["CCY-JPY"] &&
      Math.round(snap.priorWeights.GBP * 10000) === genesisBp["CCY-GBP"] &&
      Math.round(snap.priorWeights.CNY * 10000) === genesisBp["CCY-CNY"] &&
      Math.round(snap.priorWeights.CHF * 10000) === genesisBp["CCY-CHF"] &&
      Math.round(snap.priorWeights.Gold * 10000) === genesisBp["CCY-XAU"];
    check("S13-12", "the QUIESCENT registry weights match the separation-check snapshot's weights (the snapshot IS the genesis basket; payment volume never touched it)", snapMatch, `snapshotWeights={${Object.entries(snap.priorWeights).map(([k, v]) => `${k}:${v}`).join(",")}}`);

    // runLifecycleSimulation with an EMPTY directives dataset → ZERO transitions
    const universe: UniverseEntry[] = GENESIS_REGISTRY_ENTRIES.map((e) => ({
      registryId: e.registryId,
      id: e.id,
      displayCode: e.displayCode,
      name: e.name,
      componentType: e.componentType,
      initialStatus: e.status,
      priorHistoryNote: "genesis member (QUIESCENT production default — no governance directive has ever been applied)",
      dossierRef: e.dossierRef,
      envelope: { ...e.envelope },
      velocityPerPeriod: e.velocityPerPeriod,
    }));
    const dataset: Dataset = {
      datasetId: "QUIESCENT-GENESIS-EMPTY-DIRECTIVES-V1",
      dataClass: "TEST FIXTURE (deterministic; NO live scoring feeds — types.ts SCORING_FEED_DISCLOSURE)",
      datasetHash: "",
      datasetHashNote: "sha256(canonicalSerialize(dataset minus datasetHash)) — computed by the runner (deterministic)",
      methodology: {
        version: "QUIESCENT-GENESIS-EMPTY-DIRECTIVES-V1",
        provenance: "src/lib/mtq/constituency (M8-3a production port; genesis quiescence probe)",
        posture: "TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED",
        dataLabel: "SYNTHETIC TEST FIXTURE — no live feed exists",
        specCitations: ["spec §2 (component registry)", "spec §3 (T1–T9 lifecycle)"],
        prototypeChoices: [],
      },
      parameters: defaultLifecycleParameters(),
      universe,
      genesis: { weightsBp: defaultGenesisWeightsBp(), note: "genesis 7 at STRATEGIC_PRIOR bp — quiescent default (spec §13 parameters UNAPPROVED DRAFT)" },
      periods: [], // EMPTY directives + EMPTY scoring dataset — the quiescent probe
    };
    dataset.datasetHash = computeDatasetHash(dataset);
    const decision = runLifecycleSimulation(dataset); // hash verification ENFORCED (default)
    check(
      "S13-13",
      "runLifecycleSimulation on an EMPTY-directives dataset (hash-verified) produces ZERO transition-ledger entries — no directive ⇒ no transition ever fires (quiescent by default)",
      decision.transitions.length === 0 && decision.directiveOutcomes.length === 0 && decision.glidePlans.length === 0 && decision.universeEvaluations.length === 0,
      `transitions=${decision.transitions.length}, directives=${decision.directiveOutcomes.length}, glides=${decision.glidePlans.length}, universeEvals=${decision.universeEvaluations.length}`,
    );
    eq("S13-14", "the quiescent run commits ZERO periods and records ZERO divisor events (no weight-vector change, no chain-link adjustment)", `${decision.commits.length}/${decision.divisorRecords.length}`, "0/0");
    check(
      "S13-15",
      "final states after the quiescent run: all 7 members ACTIVE at their genesis bp (the machinery exists but never fires without evidence-checked directives)",
      Object.keys(decision.finalStates).length === 7 && Object.values(decision.finalStates).every((f) => f.state === "ACTIVE") && decision.finalStates["CCY-USD"].weightBp === 2700 && decision.finalStates["CCY-XAU"].weightBp === 2600,
      `finalBasketIds=${decision.summary.finalBasketIds.length}, periodsRun=${decision.summary.periodsRun}`,
    );
    eq("S13-16", "the decision record carries the verified dataset hash (the quiescence probe is reproducible from versioned inputs)", decision.datasetHash, computeDatasetHash(dataset));
    check(
      "S13-17",
      "constituency parameters remain UNAPPROVED DRAFT (spec §13 label) and the lifecycle parameter class is disclosed",
      LIFECYCLE_PARAMETER_CLASS.includes("ALL PARAMETERS UNAPPROVED DRAFT") && dataset.parameters.parameterClass === LIFECYCLE_PARAMETER_CLASS,
      LIFECYCLE_PARAMETER_CLASS.slice(0, 80) + "…",
    );
    check(
      "S13-18",
      "a FRESH genesis registry equals the DEFAULT_REGISTRY (module-level state was never mutated by this run — the default is pure data)",
      JSON.stringify(createGenesisConstituencyRegistry().entries()) === JSON.stringify(DEFAULT_REGISTRY.entries()),
      "createGenesisConstituencyRegistry() entries byte-identical to DEFAULT_REGISTRY entries",
    );
  }

  // =========================================================================
  // INV — final machine-level invariant sweep (INV-A..E across ALL machines)
  // =========================================================================
  section("INV", "Final machine-level invariant sweep — INV-A..INV-E across ALL scenario machines + full-run doc-format re-check");
  {
    const violations: string[] = [];
    for (const { machineId, machine } of allMachines) {
      const inv = invOk(machine);
      if (!inv.ok) violations.push(`${machineId}: ${inv.message}`);
    }
    check(
      "INV-01",
      "INV-A/INV-B/INV-C/INV-E structural sweep: machine.assertInvariants() passes on EVERY scenario machine (no ISSUED without finality+program; no mint on failure terminals; 1:1:1:1 idempotency; labels intact)",
      violations.length === 0,
      violations.length === 0 ? `assertInvariants() passed on all ${allMachines.length} machines` : violations.join("; ").slice(0, 160),
    );
    const mintSweep = allMachines.map((x) => ({ id: x.machineId, mints: x.machine.getSupplySnapshot().mintCount }));
    const totalMints = mintSweep.reduce((a, b) => a + b.mints, 0);
    eq("INV-02", "total mint records across the entire run (happy path 1 + reversal 1 + remediation 2 + revoked-machine 1 + resumption 1 + global-cap 1 + break-detection 2 + SEP 3 + CBDC sim 2 = 14; every other machine 0)", totalMints, 14);
    const invCSweep = allMachines.every((x) => {
      const snap = x.machine.ledgerSnapshot();
      const tokenSum = snap.tokenBook.reduce((acc, t) => acc + t.amountMicro, 0n);
      return tokenSum === snap.totalSupplyMicro;
    });
    check("INV-03", "INV-C sweep: on EVERY machine the token book Σ equals the supply counter (supply = Σ mint records; replays never double-mint)", invCSweep, `tokenBook=supply on all ${allMachines.length} machines`);
    const suspended = allMachines.filter((x) => x.machine.pipelineSuspended);
    const invD = suspended.every(
      (x) => x.machine.suspensionReasons.length > 0 && x.machine.getExceptions().some((e) => e.status === "OPEN"),
    );
    check(
      "INV-04",
      "INV-D sweep: EVERY suspended machine carries recorded suspension reasons + an OPEN exception (fail-closed; no silent healing anywhere in the run)",
      invD,
      `suspended machines: ${JSON.stringify(suspended.map((x) => `${x.machineId}:${x.machine.suspensionReasons.length} reasons`))}`,
    );
    const invE = allMachines.every((x) => {
      const snap = x.machine.ledgerSnapshot();
      return snap.issuanceRecords.every((i) => i.authorizationId.startsWith("AUTH-") && i.programId.startsWith("PROG-"));
    });
    check("INV-05", "INV-E sweep: EVERY issuance-book record carries a real ALT-4 authorization reference (authorizationId AUTH-… under a defined program)", invE, `authorization references intact across ${allMachines.reduce((a, x) => a + x.machine.ledgerSnapshot().issuanceRecords.length, 0)} issuance records`);

    // full-run doc-format re-check over the COMPLETE event union (incl. S12 machines)
    const allEvents = allMachines.flatMap((x) => x.machine.getEventLog());
    const DOC_KEYS = ["requestId", "kind", "state", "instrument", "grossAmount", "feeAmount", "netAmount", "quote", "issuedAmount", "supplyAfter", "payload"].sort().join(",");
    const MONEY_RE = /^(|-?\d+\.\d{6})$/;
    const docsAll = allEvents.map(mapEventToDoc);
    check(
      "INV-06",
      "full-run persistence re-check: mapEventToDoc field set + primitive strings + 6-decimal money format hold over the COMPLETE event union (every machine, every kind)",
      docsAll.every((d) => Object.keys(d).sort().join(",") === DOC_KEYS && Object.values(d).every((v) => typeof v === "string") && [d.grossAmount, d.feeAmount, d.netAmount, d.quote, d.issuedAmount, d.supplyAfter].every((v) => MONEY_RE.test(v))),
      `events=${docsAll.length} across ${allMachines.length} machines`,
    );
  }

  // =========================================================================
  // Summary + assertion table + machine-readable record + exit code
  // =========================================================================
  const passCount = assertions.filter((a) => a.pass).length;
  const failCount = assertions.length - passCount;
  const failedList = assertions.filter((a) => !a.pass).map((a) => a.id);
  const exitCode = failCount === 0 ? 0 : 1;
  const endedAtUTC = new Date().toISOString();

  const sectionOrder: string[] = [];
  const sectionNames = new Map<string, string>();
  for (const a of assertions) {
    if (!sectionOrder.includes(a.section)) {
      sectionOrder.push(a.section);
      sectionNames.set(a.section, a.sectionName);
    }
  }

  console.log("\n============================================================");
  console.log("ASSERTION TABLE");
  console.log("============================================================");
  for (const s of sectionOrder) {
    const rows = assertions.filter((a) => a.section === s);
    const p = rows.filter((a) => a.pass).length;
    const f = rows.length - p;
    const name = sectionNames.get(s) ?? "";
    const pad = ".".repeat(Math.max(2, 66 - s.length - name.length));
    console.log(`  ${s}  ${name} ${pad} ${p}/${rows.length}${f > 0 ? ` (${f} FAIL)` : ""}`);
  }
  console.log("------------------------------------------------------------");
  console.log(`  TOTAL: ${passCount}/${assertions.length} PASS, ${failCount} FAIL`);
  if (failedList.length > 0) {
    console.log("  FAILED IDS: " + failedList.join(", "));
  }
  console.log(`\n  RESULT: ${passCount}/${assertions.length} PASS`);
  console.log(`  exitCode: ${exitCode}`);

  console.log("\nHonest status: PRODUCTION TS REFERENCE ENGINE evidence only (promoted MANDATE-007 prototypes, commit 0e8a19d).");
  console.log("  Stablecoin pathway: evidenced ONLY against the synthetic TEST-ONLY fixture TEST-USDC-X (registry otherwise BORN EMPTY; admission fail-closed).");
  console.log(`  CBDC pathway: ${CBDC_ADAPTER_STATUS} — labeled simulated messages only; no authorized interface exists (real-adapter gate axes all false).`);
  console.log("  Authorization: ALT-4 ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION; programs/attestations are TEST-ONLY synthetic records.");
  console.log("  Fee/quote/supply-cap VALUES are ILLUSTRATIVE/UNAPPROVED (D-13.8 / §14.5 publication / D-13.19 / D-13.6 OPEN); FORM adopted under delegation.");
  console.log("  Constituency: QUIESCENT genesis 7 — no transition has ever run; payment volume never changes weights or eligibility (SEP-01).");
  console.log("  ISSUED = LEDGER RECORD ONLY — zero on-chain actions, zero network calls, zero key handling in this run.");
  console.log("Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED");

  // machine-readable record (append-per-run ledger; stdout stays deterministic)
  const runRecord = {
    startedAtUTC,
    endedAtUTC,
    command: "bun src/lib/mtq/__tests__/issuance-production-e2e.ts",
    deterministic: true,
    determinismBasis: "fixed machine clock (clockStartMs 0; advanceClock only) · BigInt-exact money math · no Date.now() in any decision path (the run banner is the only wall-clock surface)",
    totals: { pass: passCount, fail: failCount, total: assertions.length },
    perSection: sectionOrder.map((s) => {
      const rows = assertions.filter((a) => a.section === s);
      return { section: s, name: sectionNames.get(s) ?? "", pass: rows.filter((a) => a.pass).length, fail: rows.filter((a) => !a.pass).length, total: rows.length };
    }),
    exitCode,
    failedAssertionIds: failedList,
    machines: allMachines.length,
    keyObservedNumbers: {
      happyPath: {
        grossInstrument: "10000.000000 TEST-USDC-X",
        conversion: "1.000000 TU per TEST-USDC-X (SYNTHETIC-ORACLE-BOARD stand-in)",
        feeBps: "10 (0.10% flat — ILLUSTRATIVE, D-13.8 OPEN)",
        feeTU: "10.000000",
        netTU: "9990.000000",
        quote: "2.000000 TU per token (ILLUSTRATIVE — spec §14.5; derivation policy publication OPEN)",
        issued: "4995.000000",
        supplyBefore: "0.000000",
        supplyAfter: "4995.000000",
      },
      duplicatesReplays: "replay detected / DUPLICATE terminal / duplicate payment txId — supply unchanged, exactly 1 mint (INV-C)",
      delayedFinality: "EXPIRED_QUOTE (taxonomy CONFIRMATION_TIMEOUT); refund PENDING_REFUND → REFUNDED; retry on the same key forbidden",
      reversals: "pre-issuance → CANCELLED (no mint); post-issuance → RECONCILIATION_BREAK + SUSPENDED + OPEN exception; remediation refused while books diverge; full remediation loop succeeds after the explicit authorized correction",
      authorization: "no program ⇒ NO_AUTHORIZATION_PROGRAM; no attestation ⇒ NO_ATTESTATION + suspended; mismatch ⇒ suspended + authorized resumption; stale ⇒ suspended; revoked mid-flight ⇒ ALL_PROGRAMS_REVOKED",
      supplyCaps: "PER_TX_CAP_EXCEEDED / TRANCHE_CAP_EXCEEDED / GLOBAL_MAX_SUPPLY_EXCEEDED — all fail-closed, no partial mint",
      sep01: { issuances: "1000 + 25000 + 7500 gross TU", issued: ["499.500000", "12487.500000", "3746.250000"], supplyAfter: "16733.250000", basketSnapshot: "BYTE-IDENTICAL before/after", sourceScan: "issuance data-path modules import no weighting/eligibility module" },
      cbdcSimulation: { status: CBDC_ADAPTER_STATUS, demoIssued: "2497.500000 (SIMULATION-MODE demo only; registry row remained NOT_CONNECTED)", realAdapterGate: "authorizedInterfaceVerified=false · endToEndIntegrationTested=false · admissionDossierAnnexExists=false" },
      quiescence: { genesisComponents: 7, weightsBp: "2700/2000/900/800/500/500/2600 (sum 10000)", transitionsEver: 0, emptyDirectiveRun: "0 transitions · 0 commits · 0 divisor records" },
    },
    honestNotes: [
      "PRODUCTION TS REFERENCE ENGINE evidence only — LEDGER RECORDS ONLY, never on-chain; zero network calls; zero key handling.",
      "All instruments are SYNTHETIC TEST-ONLY fixtures (TEST-USDC-X & co.); the production registry is BORN EMPTY with fail-closed admission.",
      "Fee/quote/supply-cap VALUES are ILLUSTRATIVE/UNAPPROVED (D-13.8 value, §14.5 derivation publication, D-13.19, D-13.6 numbers all OPEN); only the FORM is adopted (delegated, pending ratification).",
      "CBDC adapter is SIMULATED / NOT CONNECTED; the SIMULATION-MODE demo is not an integration and admits nothing.",
      "Constituency layer is QUIESCENT: genesis 7 at STRATEGIC_PRIOR weights; no lifecycle transition has ever run.",
      "The deterministic runner uses the in-memory event sink; the Prisma sink is asserted by type/label only (no DB is touched).",
    ],
    posture: "TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED",
  };

  let existingRuns: unknown[] = [];
  try {
    const raw = fs.readFileSync(EVIDENCE_JSON_PATH, "utf8");
    const parsed = JSON.parse(raw) as { script?: string; runs?: unknown[] };
    if (parsed && parsed.script === SCRIPT_ID && Array.isArray(parsed.runs)) existingRuns = parsed.runs;
  } catch {
    existingRuns = [];
  }
  const jsonRecord = {
    script: SCRIPT_ID,
    task: "MANDATE-008 · M8-3c-a — deterministic production e2e runner for the promoted issuance + constituency modules (M8-3a/M8-3b)",
    evidenceTranscript: "audit-work/task13/evidence/issuance-production-mandate008-2026-10-23.txt",
    posture: runRecord.posture,
    runs: [...existingRuns, runRecord],
  };
  fs.writeFileSync(EVIDENCE_JSON_PATH, JSON.stringify(jsonRecord, (_k, v) => (typeof v === "bigint" ? v.toString(10) : v), 2) + "\n");
  console.log(`\nJSON record written (append-per-run evidence ledger): ${path.relative(REPO_ROOT, EVIDENCE_JSON_PATH)}`);

  process.exit(exitCode);
}

/** recordAttestation wrapper that returns the machine's result (helper for S1). */
function recordAttestationChecked(machine: IssuanceMachine, attestationId: string): { ok: boolean; reasonCode: string } {
  return machine.recordAttestation(
    attester.attest({
      attestationId,
      nowMs: machine.nowMs,
      matched: true,
      notes: "observed issuance matched the program rule; three books reconciled (STUB — TEST-ONLY)",
    }),
  );
}

/** Drive a simulated-CBDC flow using adapter messages (S12 helper — one clearly-labeled SIMULATION-MODE path). */
function driveCbdcSim(
  machine: IssuanceMachine,
  adapter: SimulatedCbdcAdapter,
  requestId: string,
  txId: string,
  authTag: string,
): { state: IssuanceState | "UNKNOWN"; reasonCode: string } {
  const t0 = machine.nowMs;
  machine.submitIssuanceRequest({
    requestId,
    idempotencyKey: `IDK-${requestId}`,
    instrumentCode: TEST_CBDC_INSTRUMENT.code,
    network: TEST_CBDC_INSTRUMENT.network,
    payerId: "TEST-PAYER-001",
    recipientId: "TEST-RECIPIENT-001",
    jurisdiction: "TEST-JURISDICTION",
    requestedInstrumentAmountMicro: 5_000_000_000n,
  });
  machine.generateQuote(requestId);
  const obs = machine.observePayment(requestId, { paymentTxId: txId, payerId: "TEST-PAYER-001", amountMicro: 5_000_000_000n, authTag, observedAtMs: t0 });
  if (!obs.ok) return { state: obs.state, reasonCode: obs.reasonCode };
  const ver = machine.verifyPaymentAuthenticity(requestId);
  if (!ver.ok) return { state: ver.state, reasonCode: ver.reasonCode };
  const msg = adapter.querySettlementStatus(txId);
  if (msg.status !== "SETTLED") return { state: machine.getInstanceState(requestId)?.state ?? "UNKNOWN", reasonCode: `ADAPTER_STATUS_${msg.status}` };
  const cs = machine.confirmSettlement(requestId, {
    status: "SETTLED",
    settledAmountMicro: 5_000_000_000n,
    sourceLabel: `${adapter.adapterId} (${CBDC_ADAPTER_MARKER})`,
    finalityAtMs: msg.finalityAtMs ?? machine.nowMs,
  });
  if (!cs.ok) return { state: cs.state, reasonCode: cs.reasonCode };
  machine.checkInstrument(requestId);
  machine.calculateFees(requestId);
  machine.acceptNetValue(requestId);
  machine.authorize(requestId);
  machine.checkSupply(requestId);
  const iss = machine.issue(requestId);
  if (!iss.ok) return { state: iss.state, reasonCode: iss.reasonCode };
  const rec = machine.reconcile(requestId);
  return { state: rec.state, reasonCode: rec.reasonCode };
}

main();
