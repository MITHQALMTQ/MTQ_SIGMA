// ============================================================================
// MTQΣ — ISSUANCE TEST FIXTURE PROVIDER (Task M8-3b)
// ============================================================================
// ██ TEST-ONLY — TEST-ONLY — TEST-ONLY — TEST-ONLY — TEST-ONLY — TEST-ONLY ██
//
// This file is the CLEARLY SEPARATED TEST FIXTURE PROVIDER for the payment-
// funded primary issuance pilot. It is the ONLY code path that installs rows
// into the otherwise-EMPTY production payment-instrument registry, and every
// row it installs is:
//   • SYNTHETIC — no real stablecoin, issuer, network, bank rail, or CBDC
//     exists anywhere in it (the registry's fail-closed admission path
//     refuses everything real; no real rail/signature verification exists
//     in this pilot);
//   • stamped TEST-ONLY in `testOnly` and in the row's statusLabel;
//   • installed with an explicit acknowledgment literal that names the
//     honesty ("TEST-ONLY SYNTHETIC FIXTURE — NOT A REAL INSTRUMENT").
//
// The fixtures exist ONLY for the Pilot Command Center demo and the
// deterministic test runner. The synthetic instrument identity is deliberately
// NON-HEX (secret-scan safe; cannot be confused with a real contract address).
//
// PROVENANCE: ported from the validated MANDATE-007 §4 prototype
// (audit-work/task13/evidence/issuance-state-machine/instrument-registry.ts —
// immutable evidence) and relabeled for the production registry's spec §5
// states (CANDIDATE · ACTIVE · SUSPENDED · RETIRED + honesty overlay).
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// Zero on-chain actions, zero network calls, zero key handling.
// ============================================================================

import {
  type ConfirmationPolicy,
  type DepegThresholds,
  type InstrumentRow,
  type PaymentInstrumentRegistry,
  type ValuationBasis,
} from "./instrument-registry";

export const ISSUANCE_TEST_FIXTURES_LABEL =
  "TEST-ONLY FIXTURE PROVIDER — supplies SYNTHETIC instruments (TEST-USDC-X & co.) for the Pilot Command " +
  "Center demo and the deterministic test runner ONLY. NO REAL INSTRUMENT IS REGISTERED ANYWHERE.";

/** The ONE synthetic TEST instrument for the stablecoin pathway. */
export const TEST_INSTRUMENT = { code: "TEST-USDC-X", network: "TEST-CHAIN-1 (SYNTHETIC)" } as const;

/** The synthetic CBDC instrument descriptor (SIMULATION-MODE demos only). */
export const TEST_CBDC_INSTRUMENT = { code: "TEST-CBDC-1", network: "SIMULATED-CBDC-RAIL-1 (SYNTHETIC)" } as const;

const ACK: "TEST-ONLY SYNTHETIC FIXTURE — NOT A REAL INSTRUMENT" =
  "TEST-ONLY SYNTHETIC FIXTURE — NOT A REAL INSTRUMENT";

// spec §4 depeg bands (values = D-13.19 parameters — ALL UNAPPROVED)
const DEPEG_THRESHOLDS_TEST: DepegThresholds = {
  warnBps: 30,
  warnSustainedHours: 1,
  suspendSustainedBps: 100,
  suspendSustainedHours: 4,
  suspendInstantBps: 500,
  emergencySustainedBps: 250,
  emergencySustainedHours: 24,
  label:
    "PROPOSED depeg bands per spec §4 (values = D-13.19 parameters — ALL UNAPPROVED): " +
    "NORMAL within 0.30% · WARN ≥0.30% sustained 1h · SUSPEND ≥1.00% sustained 4h or any 5.00% instant · " +
    "EMERGENCY ≥2.50% sustained 24h or issuer redemption suspension",
};

const TEST_VALUATION_BASIS: ValuationBasis = {
  quoteUnit: "TEST-QUOTE-UNIT (TU)",
  priceSource: "SYNTHETIC-ORACLE-BOARD (deterministic in-process reference — deliverable-10 dependency stand-in)",
  pricePerUnitMicro: 1_000_000n, // 1.000000 TU per 1.000000 TEST-USDC-X — a LIVE PRICE READ analog, never assumed
  timestampNote: "priced at quote time and re-checked at settlement time (spec §6.1/§6.2)",
  basisLabel:
    "Quote-unit valuation basis per spec §3 assetPeg / §6.1 — NEVER assume 1 token = 1 fiat unit; " +
    "SYNTHETIC deterministic oracle stand-in (no live oracle board exists in this integration)",
};

function stablecoinConfirmations(min: number): ConfirmationPolicy {
  return {
    kind: "STABLECOIN_N_CONFIRMATIONS",
    minConfirmations: min,
    issuerSanityCheckRequired: true,
    finalityDefinition:
      `N=${min} confirmations (per-chain parameter, D-13.19) AND issuer sanity check (no freeze event, attestation current). ` +
      "Balance receipt alone is NEVER finality (spec §6.2).",
  };
}

/** TEST-USDC-X on TEST-CHAIN-1 — the ONE ACTIVE test instrument (TEST-ONLY, synthetic). */
const APPROVED_TEST_INSTRUMENT: InstrumentRow = {
  instrumentId: "TEST-STBL-001",
  version: 1,
  code: "TEST-USDC-X",
  type: "STABLECOIN",
  issuer: {
    legalName: "TEST-ISSUER (SYNTHETIC)",
    jurisdiction: "TEST-JURISDICTION",
    regulationRefs: ["TEST-REG-REF-000 (SYNTHETIC — no real regulation reference exists)"],
  },
  network: "TEST-CHAIN-1 (SYNTHETIC)",
  contractAddressOrRailId: "0xTESTUSDCX0000NOTAREALCONTRACT", // NON-HEX ON PURPOSE (deliberately not a real address)
  decimals: 6,
  tokenStandard: "ERC-20-LIKE (SYNTHETIC — no real token standard instance)",
  jurisdictionAllowlist: ["TEST-JURISDICTION", "TEST-JURISDICTION-2"],
  state: "ACTIVE",
  honestyState: "SIMULATED",
  statusLabel:
    "TEST-ONLY · APPROVED TEST INSTRUMENT (SYNTHETIC) — the ONE active test instrument for the stablecoin-pathway " +
    "demonstration. NOT a real stablecoin; the issuer, network, and contract identity are synthetic fixtures; no " +
    "real rail or signature verification exists in this pilot.",
  testOnly: true,
  confirmationPolicy: stablecoinConfirmations(3),
  valuationBasis: TEST_VALUATION_BASIS,
  depegThresholds: DEPEG_THRESHOLDS_TEST,
  fees: {
    feeClass: "FLAT-10BPS (ILLUSTRATIVE)",
    rateBps: 10n,
    label: "ILLUSTRATIVE — D-13.8 OPEN. 0.10% flat named default for the pilot only. No fee schedule is approved.",
  },
  evidence: [
    "SYNTHETIC TEST FIXTURE — the admission evidence is itself synthetic (no real dossier, attestation, contract " +
      "audit, or liquidity evidence exists or is implied). Spec §3 requires an ACTIVE row to carry verifiable " +
      "evidence citations; in this TEST-ONLY fixture the evidence list states the opposite: nothing real backs " +
      "this row.",
  ],
  reviewCadenceDays: 90,
  suspendedAtMs: null,
  perInstanceIdentityNote:
    "Per-instance identity rule (spec §14.2 rule (a)): approval of this code on TEST-CHAIN-1 does NOT approve " +
    "any similarly named instrument on any other network — see row TEST-STBL-002.",
  history: [],
};

/** TEST-USDC-X on TEST-CHAIN-2 — a CANDIDATE row of the SAME code on a DIFFERENT network (per-instance identity rule). */
const OTHER_NETWORK_INSTANCE: InstrumentRow = {
  instrumentId: "TEST-STBL-002",
  version: 1,
  code: "TEST-USDC-X", // SAME code + name …
  network: "TEST-CHAIN-2 (SYNTHETIC)", // … DIFFERENT network instance
  type: "STABLECOIN",
  issuer: {
    legalName: "TEST-ISSUER (SYNTHETIC)",
    jurisdiction: "TEST-JURISDICTION",
    regulationRefs: ["TEST-REG-REF-000 (SYNTHETIC)"],
  },
  contractAddressOrRailId: "0xTESTUSDCXCHAIN2NOTAREALCONTRACT", // NON-HEX ON PURPOSE
  decimals: 6,
  tokenStandard: "ERC-20-LIKE (SYNTHETIC)",
  jurisdictionAllowlist: ["TEST-JURISDICTION"],
  state: "CANDIDATE", // NOT admitted (fail-closed admission; per-instance identity, spec §14.2 rule (a))
  honestyState: "SIMULATED",
  statusLabel:
    "TEST-ONLY · CANDIDATE — same instrument code on a different network instance. NOT auto-approved (per-instance " +
    "identity rule, spec §14.2 rule (a)); requires its own verified admission dossier. Quoting is refused.",
  testOnly: true,
  confirmationPolicy: stablecoinConfirmations(3),
  valuationBasis: TEST_VALUATION_BASIS,
  depegThresholds: DEPEG_THRESHOLDS_TEST,
  fees: {
    feeClass: "FLAT-10BPS (ILLUSTRATIVE)",
    rateBps: 10n,
    label: "ILLUSTRATIVE — D-13.8 OPEN (same placeholder class as TEST-STBL-001)",
  },
  evidence: [
    "SYNTHETIC TEST FIXTURE — exists to demonstrate that the registry is per-instance (spec §3: one row per " +
      "instrument instance; same stablecoin on two networks = two rows, each with its own contract identity " +
      "and finality profile).",
  ],
  reviewCadenceDays: 90,
  suspendedAtMs: null,
  perInstanceIdentityNote:
    "This row shares the code and name of TEST-STBL-001 but is a DIFFERENT instance (different network + " +
    "contract identity) and remains CANDIDATE. Auto-approval from the TEST-CHAIN-1 row is structurally impossible.",
  history: [],
};

/** TEST-USDC-Y — a RETIRED test instrument (spec §5 RETIRED analog; used by the invalid-instrument demos). */
const RETIRED_TEST_INSTRUMENT: InstrumentRow = {
  instrumentId: "TEST-STBL-003",
  version: 2,
  code: "TEST-USDC-Y",
  type: "STABLECOIN",
  issuer: {
    legalName: "TEST-ISSUER-B (SYNTHETIC)",
    jurisdiction: "TEST-JURISDICTION",
    regulationRefs: ["TEST-REG-REF-001 (SYNTHETIC)"],
  },
  network: "TEST-CHAIN-1 (SYNTHETIC)",
  contractAddressOrRailId: "0xTESTUSDCY0000NOTAREALCONTRACT", // NON-HEX ON PURPOSE
  decimals: 6,
  tokenStandard: "ERC-20-LIKE (SYNTHETIC)",
  jurisdictionAllowlist: ["TEST-JURISDICTION"],
  state: "RETIRED",
  honestyState: "SIMULATED",
  statusLabel:
    "TEST-ONLY · RETIRED — removed from quoting; records preserved append-only. Used to demonstrate retirement " +
    "is enforced at instrument-check time.",
  testOnly: true,
  confirmationPolicy: stablecoinConfirmations(3),
  valuationBasis: TEST_VALUATION_BASIS,
  depegThresholds: DEPEG_THRESHOLDS_TEST,
  fees: { feeClass: "FLAT-10BPS (ILLUSTRATIVE)", rateBps: 10n, label: "ILLUSTRATIVE — D-13.8 OPEN" },
  evidence: ["SYNTHETIC TEST FIXTURE — retirement-history demonstration row."],
  reviewCadenceDays: 90,
  suspendedAtMs: null,
  perInstanceIdentityNote: "Per-instance identity rule applies (spec §14.2 rule (a)).",
  history: [
    {
      atMs: 0,
      action: "RETIRE",
      fromState: "ACTIVE",
      toState: "RETIRED",
      evidence: "SYNTHETIC TEST FIXTURE — retirement demonstration (records preserved).",
      notice: "SYNTHETIC notice record — published 24h window PROPOSED (D-13.19); no real notice was published.",
      version: 2,
    },
  ],
};

/** CBDC rows — born NOT CONNECTED; may leave that state ONLY via a verified authorized interface + recorded end-to-end test (spec §4). */
function cbdcRow(instrumentId: string, code: string, rail: string): InstrumentRow {
  return {
    instrumentId,
    version: 1,
    code,
    type: "CBDC",
    issuer: {
      legalName: "NO ISSUING AUTHORITY EXISTS (SYNTHETIC ROW)",
      jurisdiction: "TEST-JURISDICTION",
      regulationRefs: [],
    },
    network: rail,
    contractAddressOrRailId: `RAIL-ID-${code} (SYNTHETIC — NOT AN ADDRESS, NOT A RAIL)`,
    decimals: 6,
    tokenStandard: "N/A — no authorized technical interface exists",
    jurisdictionAllowlist: ["TEST-JURISDICTION"],
    state: "CANDIDATE",
    honestyState: "NOT_CONNECTED",
    statusLabel: "TEST-ONLY · SIMULATED / NOT CONNECTED",
    testOnly: true,
    confirmationPolicy: {
      kind: "CBDC_AUTHORIZED_INTERFACE",
      minConfirmations: 0,
      issuerSanityCheckRequired: false,
      finalityDefinition:
        "The authorized interface's own finality signal, recorded with its message (spec §6.2). " +
        "NO AUTHORIZED INTERFACE EXISTS — therefore NO quotes at all (spec §4); simulated adapter messages " +
        "are labeled SIMULATED / NOT CONNECTED and cannot back an admitted row.",
    },
    valuationBasis: {
      quoteUnit: "TEST-QUOTE-UNIT (TU)",
      priceSource: "UNDEFINED — no authorized CBDC interface exists to source a price",
      pricePerUnitMicro: 1_000_000n,
      timestampNote: "N/A — no quotes are produced for CBDC rows outside SIMULATION MODE",
      basisLabel: "SYNTHETIC stand-in used ONLY inside labeled SIMULATION-MODE demonstrations",
    },
    depegThresholds: DEPEG_THRESHOLDS_TEST,
    fees: { feeClass: "UNDEFINED — D-13.8 OPEN", rateBps: null, label: "No CBDC fee schedule exists (D-13.8 OPEN)" },
    evidence: [
      "NONE — per spec §5.3, a NOT_CONNECTED row carries no admission evidence; admission requires (i) a verified " +
        "authorized interface (contract/endpoint identity + access grant) and (ii) a recorded end-to-end test " +
        "against the real interface. NEITHER EXISTS. The spec §14.3 admission-dossier annex (nine §7.4 fields) " +
        "does not exist for any CBDC.",
    ],
    reviewCadenceDays: 90,
    suspendedAtMs: null,
    perInstanceIdentityNote: "Per-instance identity rule applies (spec §14.2 rule (a)).",
    history: [],
  };
}

const CBDC_ROW_1 = cbdcRow("TEST-CBDC-001", "TEST-CBDC-1", "SIMULATED-CBDC-RAIL-1 (SYNTHETIC)");
const CBDC_ROW_2 = cbdcRow("TEST-CBDC-002", "TEST-CBDC-2", "SIMULATED-CBDC-RAIL-2 (SYNTHETIC)");

/** The TEST fixture rows (frozen definitions; installed per-registry by the provider below). */
export const TEST_FIXTURE_ROWS: readonly InstrumentRow[] = [
  APPROVED_TEST_INSTRUMENT,
  OTHER_NETWORK_INSTANCE,
  RETIRED_TEST_INSTRUMENT,
  CBDC_ROW_1,
  CBDC_ROW_2,
];

/**
 * Install the TEST-ONLY synthetic fixtures into an (otherwise empty) registry.
 * Every row is stamped TEST-ONLY by the registry's installRowForTest(). This
 * is the ONLY code path that puts rows in the pilot registry — the production
 * admission path is fail-closed (no real rail evidence can exist).
 */
export function installIssuanceTestFixtures(registry: PaymentInstrumentRegistry): void {
  for (const row of TEST_FIXTURE_ROWS) {
    registry.installRowForTest(row, ACK);
  }
}
