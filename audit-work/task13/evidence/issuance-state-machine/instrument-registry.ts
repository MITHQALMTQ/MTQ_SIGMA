// ============================================================================
// MTQΣ — MANDATE-007 §4 · Task 2-b · STEP 1 — NON-PRODUCTION INSTRUMENT REGISTRY
// (prototype of payment-instrument-registry-and-settlement-spec.md §3–§5)
// ============================================================================
// MODULE LABEL: **NON-PRODUCTION PROTOTYPE.** This file prototypes the
// payment-instrument registry data model (spec §3), per-type policy (spec §4),
// and lifecycle state machine (spec §5) of
// `audit-work/task13/payment-instrument-registry-and-settlement-spec.md`
// (STATUS: PROPOSED v1 — NOT APPROVED, NOT IMPLEMENTED). It is NOT the
// production registry, no instrument in it is a real instrument, and nothing
// here admits, connects, or authorizes any real payment rail.
//
// PATHWAY LABELS (honest, per spec §1 label summary):
//   • Stablecoin pathway — evidenced ONLY against ONE clearly identified
//     APPROVED TEST instrument ("TEST-USDC-X", SYNTHETIC). No real stablecoin
//     exists anywhere in this repository (spec §1: test tokens only).
//   • CBDC pathway — "SIMULATED / NOT CONNECTED". No issuing authority, no
//     authorized interface, no institutional connection exists (spec §4/§14.3).
//
// SEPARATION INVARIANT (spec §2 — the load-bearing rule): this registry has
// NO foreign-key, import, event, or telemetry path into basket
// constituency/weighting modules, and carries NO payment-volume telemetry
// field of any kind. Payment volume never determines currency eligibility or
// basket weights (MANDATE-004 §7; prototype analog of test T-PAY-01).
//
// STATE MODEL — prototype states are the task-mandated ANALOG of spec §5
// (CANDIDATE · ACTIVE · SUSPENDED · RETIRED, plus honesty states §5.3):
//   PROPOSED  ↔ spec §5 CANDIDATE   (awaiting admission dossier + approval + notice)
//   APPROVED  ↔ spec §5 ACTIVE      (TEST-ONLY here: admits payment flows in the prototype)
//   RESTRICTED ↔ watch-level restriction (depeg WARN band analog, spec §4)
//   SUSPENDED ↔ spec §5 SUSPENDED   (quoting blocked; in-flight completes per spec §4)
//   REVOKED   ↔ spec §5 RETIRED     (terminal; records preserved append-only)
// Honesty overlay (spec §5.3 — one-way without new evidence): SIMULATED ·
// NOT_CONNECTED. A NOT_CONNECTED row can NEVER be admitted here because no
// verified authorized interface + recorded end-to-end test exists (spec §4).
//
// ALL numeric parameters (depeg bands, review cadence, notice windows) are
// PROPOSED / UNAPPROVED (decision D-13.19, OPEN). Fee rates are placeholders
// owned by decision D-13.8 (OPEN). No fee is charged anywhere.
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// Zero on-chain actions, zero network calls, zero key handling in this file.
// ============================================================================

// ----------------------------------------------------------------------------
// §3 — registry data model (prototype subset; per-INSTRUMENT-INSTANCE rows)
// ----------------------------------------------------------------------------

export const REGISTRY_PROTOTYPE_LABEL =
  "NON-PRODUCTION PROTOTYPE of payment-instrument-registry-and-settlement-spec.md §3–§5 (spec STATUS: PROPOSED — NOT APPROVED, NOT IMPLEMENTED)";

export const SEPARATION_INVARIANT_TEXT =
  "Payment volume or acceptance must NEVER automatically determine currency eligibility or basket weights. " +
  "Accepting a USD-linked stablecoin does not itself justify increasing the USD weight. " +
  "Accepting a euro-linked instrument does not itself justify increasing the EUR weight. " +
  "(spec §2, verbatim obligation of MANDATE-004 §7; prototype test analog: SEP-01 / T-PAY-01)";

export type InstrumentType = "STABLECOIN" | "CBDC" | "BANK_RAIL" | "OTHER";

export type PrototypeRegistryState =
  | "PROPOSED" // analog of spec §5 CANDIDATE
  | "APPROVED" // analog of spec §5 ACTIVE  (TEST instrument only — see row label)
  | "RESTRICTED" // watch-level restriction (spec §4 WARN band analog)
  | "SUSPENDED" // analog of spec §5 SUSPENDED
  | "REVOKED"; // analog of spec §5 RETIRED (terminal)

/** Honesty overlay per spec §5.3 — one-way without new evidence. */
export type HonestyState = "SIMULATED" | "NOT_CONNECTED";

/** Confirmation & settlement-finality requirements per rail (spec §6.2). */
export interface ConfirmationPolicy {
  kind:
    | "STABLECOIN_N_CONFIRMATIONS"
    | "CBDC_AUTHORIZED_INTERFACE"
    | "BANK_RAIL_VERIFIED_INTERFACE";
  minConfirmations: number;
  issuerSanityCheckRequired: boolean;
  finalityDefinition: string;
}

/** Depeg bands per spec §4 (values = D-13.19 parameters — ALL UNAPPROVED). */
export interface DepegThresholds {
  warnBps: number; // beyond 0.30% sustained 1h            → WARN
  warnSustainedHours: number;
  suspendSustainedBps: number; // beyond 1.00% sustained 4h          → SUSPEND
  suspendSustainedHours: number;
  suspendInstantBps: number; // any 5.00% instantaneous move     → SUSPEND
  emergencySustainedBps: number; // beyond 2.50% sustained 24h         → EMERGENCY
  emergencySustainedHours: number;
  label: string;
}

/** Quote-unit valuation basis per spec §3 `assetPeg` / §6.1 — never assume 1 token = 1 fiat unit. */
export interface ValuationBasis {
  quoteUnit: string;
  priceSource: string;
  /** Price of 1.0 instrument unit in quote units, 6-decimal fixed point (micro). */
  pricePerUnitMicro: bigint;
  timestampNote: string;
  basisLabel: string;
}

/** Fee class reference — rates live in decision D-13.8 (OPEN); registry stores references only (spec §3). */
export interface FeePolicyRef {
  feeClass: string;
  rateBps: bigint | null; // null = not defined for this instrument
  label: string;
}

export interface IssuerDescriptor {
  legalName: string;
  jurisdiction: string;
  regulationRefs: string[];
}

export interface InstrumentRow {
  instrumentId: string;
  version: number; // every mutation bumps version; history append-only (spec §3)
  code: string;
  type: InstrumentType;
  issuer: IssuerDescriptor;
  network: string; // chain/rail identifier — per-INSTANCE identity, never a ticker alone
  contractAddressOrRailId: string; // SYNTHETIC, deliberately NON-HEX (secret-scan safe)
  decimals: number;
  tokenStandard: string;
  jurisdictionAllowlist: string[]; // ISO-3166 analog (synthetic codes here)
  state: PrototypeRegistryState;
  honestyState: HonestyState; // spec §5.3 honesty overlay
  statusLabel: string; // human honesty label, e.g. "SIMULATED / NOT CONNECTED"
  confirmationPolicy: ConfirmationPolicy;
  valuationBasis: ValuationBasis;
  depegThresholds: DepegThresholds;
  fees: FeePolicyRef;
  evidence: string[]; // spec §3: an ACTIVE row with an empty evidence list is invalid by construction
  reviewCadenceDays: number; // PROPOSED 90 default (D-13.19)
  suspendedAtMs: number | null; // for spec §4 "in-flight settlements complete under existing quotes"
  perInstanceIdentityNote: string; // spec §14.2 rule (a): approval on one network ≠ approval of the same name elsewhere
  history: RegistryTransitionRecord[];
}

export interface RegistryTransitionRecord {
  atMs: number;
  action: RegistryActionName;
  fromState: PrototypeRegistryState;
  toState: PrototypeRegistryState;
  evidence: string;
  notice: string; // spec §5.2 notice publication record (window PROPOSED D-13.19)
  version: number;
}

export type RegistryActionName =
  | "ADMIT" // admission: dossier + approval + notice (spec §5)
  | "RESTRICT" // watch-level restriction (spec §4 WARN analog)
  | "SUSPEND_DEPEG" // spec §5 suspension trigger: depeg threshold breach
  | "SUSPEND_ISSUER_EVENT" // spec §5 trigger: freeze/insolvency/regulatory/redemption-suspension
  | "REINSTATE" // requires trigger cleared + observation ≥48h + committee approval (spec §5)
  | "REVOKE"; // retirement — terminal; records preserved (spec §5)

// ----------------------------------------------------------------------------
// §5 (analog) — allowed state-transition table
// ----------------------------------------------------------------------------

export const REGISTRY_TRANSITIONS: Readonly<
  Record<RegistryActionName, Readonly<{ from: readonly PrototypeRegistryState[]; to: PrototypeRegistryState }>>
> = {
  ADMIT: { from: ["PROPOSED"], to: "APPROVED" },
  RESTRICT: { from: ["APPROVED"], to: "RESTRICTED" },
  SUSPEND_DEPEG: { from: ["APPROVED", "RESTRICTED"], to: "SUSPENDED" },
  SUSPEND_ISSUER_EVENT: { from: ["APPROVED", "RESTRICTED"], to: "SUSPENDED" },
  REINSTATE: { from: ["SUSPENDED", "RESTRICTED"], to: "APPROVED" },
  REVOKE: { from: ["PROPOSED", "APPROVED", "RESTRICTED", "SUSPENDED"], to: "REVOKED" },
};

// ----------------------------------------------------------------------------
// §4 — depeg band classification (bands per spec §4; values D-13.19 UNAPPROVED)
// ----------------------------------------------------------------------------

export type DepegBand = "NORMAL" | "WARN" | "SUSPEND" | "EMERGENCY";

export interface DepegObservation {
  deviationBps: number; // |observed − referenced| in bps
  sustainedHours: number; // how long the deviation has persisted
  instantaneousMoveBps: number; // instantaneous move this observation
  issuerRedemptionSuspension?: boolean;
}

export function classifyDepegBand(t: DepegThresholds, obs: DepegObservation): DepegBand {
  // EMERGENCY: beyond 2.50% sustained 24h, or issuer redemption suspension (spec §4 band table)
  if (
    obs.issuerRedemptionSuspension ||
    (obs.sustainedHours >= t.emergencySustainedHours && obs.deviationBps >= t.emergencySustainedBps)
  ) {
    return "EMERGENCY";
  }
  // SUSPEND: beyond 1.00% sustained 4h, or any 5.00% instantaneous move (spec §4 band table)
  if (
    (obs.sustainedHours >= t.suspendSustainedHours && obs.deviationBps >= t.suspendSustainedBps) ||
    obs.instantaneousMoveBps >= t.suspendInstantBps
  ) {
    return "SUSPEND";
  }
  // WARN: beyond 0.30% sustained 1h (spec §4 band table)
  if (obs.sustainedHours >= t.warnSustainedHours && obs.deviationBps >= t.warnBps) {
    return "WARN";
  }
  return "NORMAL";
}

// ----------------------------------------------------------------------------
// Seed rows — SYNTHETIC TEST DATA (no real instrument, issuer, network, or rail)
// ----------------------------------------------------------------------------

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
    "SYNTHETIC deterministic oracle stand-in (no live oracle board exists)",
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

/**
 * THE ONE APPROVED TEST INSTRUMENT for the stablecoin pathway (MANDATE-007 §4:
 * "a clearly identified approved test instrument for the stablecoin pathway").
 * Identity is deliberately NON-HEX and SYNTHETIC — it cannot be confused with,
 * or function as, a real contract address.
 */
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
  state: "APPROVED",
  honestyState: "SIMULATED",
  statusLabel:
    "APPROVED TEST INSTRUMENT (SYNTHETIC) — the ONE approved test instrument for the stablecoin-pathway " +
    "prototype demonstration. NOT a real stablecoin; the issuer, network, and contract identity are synthetic fixtures.",
  confirmationPolicy: stablecoinConfirmations(3),
  valuationBasis: TEST_VALUATION_BASIS,
  depegThresholds: DEPEG_THRESHOLDS_TEST,
  fees: {
    feeClass: "TEST-FLAT-10BPS",
    rateBps: 10n,
    label:
      "ILLUSTRATIVE — D-13.8 OPEN. 0.10% flat placeholder rate for the prototype only. " +
      "No fee schedule is approved; no fee is charged anywhere; rates are owned by decision D-13.8.",
  },
  evidence: [
    "SYNTHETIC TEST FIXTURE — the admission evidence is itself synthetic (no real dossier, attestation, " +
      "contract audit, or liquidity evidence exists or is implied). Spec §3 requires an ACTIVE row to carry " +
      "verifiable evidence citations; in this NON-PRODUCTION prototype the evidence list states the opposite: " +
      "nothing real backs this row.",
  ],
  reviewCadenceDays: 90,
  suspendedAtMs: null,
  perInstanceIdentityNote:
    "Per-instance identity rule (spec §14.2 rule (a)): approval of this code on TEST-CHAIN-1 does NOT approve " +
    "any similarly named instrument on any other network — see row TEST-STBL-002.",
  history: [],
};

/**
 * Second instance of the SAME code on a DIFFERENT network — deliberately
 * PROPOSED (NOT auto-approved) to demonstrate the per-instance identity rule
 * (spec §14.2 rule (a); "same name on another network is NOT auto-approved").
 */
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
  state: "PROPOSED", // NOT auto-approved by the TEST-CHAIN-1 row
  honestyState: "SIMULATED",
  statusLabel:
    "PROPOSED — same instrument code on a different network instance. NOT auto-approved (per-instance identity " +
    "rule, spec §14.2 rule (a)); requires its own admission dossier. Quoting is refused in the prototype.",
  confirmationPolicy: stablecoinConfirmations(3),
  valuationBasis: TEST_VALUATION_BASIS,
  depegThresholds: DEPEG_THRESHOLDS_TEST,
  fees: {
    feeClass: "TEST-FLAT-10BPS",
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
    "contract identity) and remains PROPOSED. Auto-approval from the TEST-CHAIN-1 row is structurally impossible.",
  history: [],
};

/** A REVOKED test instrument (analog of spec §5 RETIRED) — used by test ISS-07 (revoked-instrument rejection). */
const REVOKED_TEST_INSTRUMENT: InstrumentRow = {
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
  state: "REVOKED",
  honestyState: "SIMULATED",
  statusLabel:
    "REVOKED (analog of spec §5 RETIRED) — removed from quoting; records preserved append-only. " +
    "Used to demonstrate revocation is enforced at instrument-check time.",
  confirmationPolicy: stablecoinConfirmations(3),
  valuationBasis: TEST_VALUATION_BASIS,
  depegThresholds: DEPEG_THRESHOLDS_TEST,
  fees: { feeClass: "TEST-FLAT-10BPS", rateBps: 10n, label: "ILLUSTRATIVE — D-13.8 OPEN" },
  evidence: ["SYNTHETIC TEST FIXTURE — revocation-history demonstration row."],
  reviewCadenceDays: 90,
  suspendedAtMs: null,
  perInstanceIdentityNote: "Per-instance identity rule applies (spec §14.2 rule (a)).",
  history: [
    {
      atMs: 0,
      action: "REVOKE",
      fromState: "APPROVED",
      toState: "REVOKED",
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
    state: "PROPOSED",
    honestyState: "NOT_CONNECTED",
    statusLabel: "SIMULATED / NOT CONNECTED",
    confirmationPolicy: {
      kind: "CBDC_AUTHORIZED_INTERFACE",
      minConfirmations: 0,
      issuerSanityCheckRequired: false,
      finalityDefinition:
        "The authorized interface's own finality signal, recorded with its message (spec §6.2). " +
        "NO AUTHORIZED INTERFACE EXISTS — therefore NO quotes at all (spec §4); simulated adapter messages " +
        "are labeled SIMULATED / NOT CONNECTED and cannot back an APPROVED row.",
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

/** Seed rows (frozen; the registry class deep-copies them per instance). */
export const SEED_REGISTRY_ROWS: readonly InstrumentRow[] = [
  APPROVED_TEST_INSTRUMENT,
  OTHER_NETWORK_INSTANCE,
  REVOKED_TEST_INSTRUMENT,
  CBDC_ROW_1,
  CBDC_ROW_2,
];

// ----------------------------------------------------------------------------
// §5 (analog) — registry class: transitions, notice records, honesty gates
// ----------------------------------------------------------------------------

export interface RegistryTransitionResult {
  ok: boolean;
  reasonCode: string;
  row?: InstrumentRow;
}

export class PrototypeInstrumentRegistry {
  readonly label = REGISTRY_PROTOTYPE_LABEL;
  private rows: Map<string, InstrumentRow>; // key = instrumentId
  private notices: RegistryTransitionRecord[] = [];
  private clockMs: number;

  constructor(clockStartMs: number, rows?: readonly InstrumentRow[]) {
    this.clockMs = clockStartMs;
    this.rows = new Map();
    for (const r of rows ?? SEED_REGISTRY_ROWS) {
      this.rows.set(r.instrumentId, structuredCloneRow(r));
    }
  }

  get nowMs(): number {
    return this.clockMs;
  }
  advanceClock(deltaMs: number): void {
    this.clockMs += deltaMs;
  }

  /** Lookup by per-instance identity: code + network (spec §3 — never a ticker alone). */
  findByCodeAndNetwork(code: string, network: string): InstrumentRow | undefined {
    return [...this.rows.values()].find((r) => r.code === code && r.network === network);
  }
  byId(instrumentId: string): InstrumentRow | undefined {
    return this.rows.get(instrumentId);
  }
  allRows(): readonly InstrumentRow[] {
    return [...this.rows.values()].map((r) => structuredCloneRow(r));
  }
  noticesLog(): readonly RegistryTransitionRecord[] {
    return [...this.notices];
  }

  /**
   * Apply a lifecycle transition per the analog table. FAIL-CLOSED special rules:
   *  - a NOT_CONNECTED row (honesty state, spec §5.3) can NEVER be ADMITTED here
   *    (no verified authorized interface + end-to-end test exists);
   *  - REINSTATE requires a completed observation period (PROPOSED ≥48h, spec §5)
   *    recorded in the evidence string;
   *  - every transition is published as a notice record (windows PROPOSED D-13.19).
   */
  transition(
    instrumentId: string,
    action: RegistryActionName,
    evidence: string,
    opts?: { observationHoursCompleted?: number },
  ): RegistryTransitionResult {
    const row = this.rows.get(instrumentId);
    if (!row) return { ok: false, reasonCode: "INSTRUMENT_NOT_FOUND" };
    const rule = REGISTRY_TRANSITIONS[action];
    if (!rule.from.includes(row.state)) {
      return {
        ok: false,
        reasonCode: `TRANSITION_NOT_ALLOWED_${action}_FROM_${row.state}`,
      };
    }
    if (action === "ADMIT" && row.honestyState === "NOT_CONNECTED") {
      return {
        ok: false,
        reasonCode:
          "ADMISSION_BLOCKED_NOT_CONNECTED — spec §5.3/§4: a NOT_CONNECTED row may become APPROVED only via a " +
          "verified authorized interface AND a recorded end-to-end test. NEITHER EXISTS.",
      };
    }
    if (action === "REINSTATE") {
      const hours = opts?.observationHoursCompleted ?? 0;
      if (hours < 48) {
        return {
          ok: false,
          reasonCode: `REINSTATEMENT_BLOCKED_OBSERVATION_PERIOD — ${hours}h < PROPOSED 48h (spec §5; V3 RECOVERY_CONFIRMATION_PERIOD analog, UNDEPLOYED)`,
        };
      }
    }
    const fromState = row.state;
    const next: InstrumentRow = structuredCloneRow(row);
    next.version = row.version + 1;
    next.state = rule.to;
    if (action === "SUSPEND_DEPEG" || action === "SUSPEND_ISSUER_EVENT") next.suspendedAtMs = this.clockMs;
    if (action === "REINSTATE") next.suspendedAtMs = null;
    const record: RegistryTransitionRecord = {
      atMs: this.clockMs,
      action,
      fromState,
      toState: rule.to,
      evidence,
      notice:
        action === "SUSPEND_DEPEG" || action === "SUSPEND_ISSUER_EVENT"
          ? "emergency suspension notice — published within 1h (PROPOSED, D-13.19) — SYNTHETIC record"
          : "state-transition notice — published within 24h (PROPOSED, D-13.19) — SYNTHETIC record",
      version: next.version,
    };
    next.history = [...next.history, record];
    this.notices.push(record);
    this.rows.set(instrumentId, next);
    return { ok: true, reasonCode: `OK_${action}`, row: structuredCloneRow(next) };
  }

  /** Serialized honesty snapshot (used by SEP-01 byte-identity checks). */
  serializeHonestSnapshot(): string {
    const snapshot = {
      label: this.label,
      rows: this.allRows().map((r) => ({
        instrumentId: r.instrumentId,
        code: r.code,
        network: r.network,
        state: r.state,
        honestyState: r.honestyState,
        statusLabel: r.statusLabel,
        version: r.version,
      })),
      notices: this.noticesLog().map((n) => `${n.atMs}:${n.action}:${n.fromState}->${n.toState}:v${n.version}`),
    };
    return JSON.stringify(snapshot);
  }
}

/** Fresh registry factory with deterministic simulated clock (test isolation). */
export function createTestRegistry(clockStartMs = 0): PrototypeInstrumentRegistry {
  return new PrototypeInstrumentRegistry(clockStartMs);
}

/**
 * TEST-OF-ABSENCE helper (SEP-01 / spec §2 structural layer): the registry
 * data model must expose NO field that could carry payment-volume telemetry
 * into weighting/eligibility inputs. This walks the serialized schema of a
 * row and fails if any key matches weighting/eligibility vocabulary.
 */
export function assertNoWeightingTelemetryFields(row: InstrumentRow): { ok: boolean; offendingKeys: string[] } {
  const serialized = JSON.stringify(row, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  const flatKeys: string[] = [];
  const walk = (obj: unknown) => {
    if (obj && typeof obj === "object") {
      for (const [k, v] of Object.entries(obj)) {
        flatKeys.push(k);
        walk(v);
      }
    }
  };
  walk(row);
  const offenders = flatKeys.filter((k) => /weight|eligib|basket|constituency|mase|index/i.test(k));
  return { ok: offenders.length === 0 && !/weight|eligib|basket volume|telemetry/i.test(serialized), offendingKeys: offenders };
}

// structuredCloneRow — deep copy without BigInt JSON pitfalls.
function structuredCloneRow(r: InstrumentRow): InstrumentRow {
  return JSON.parse(
    JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? `BIGINT:${v.toString()}` : v)),
    (_k, v) => {
      if (typeof v === "string" && v.startsWith("BIGINT:")) return BigInt(v.slice(7));
      return v;
    },
  ) as InstrumentRow;
}
