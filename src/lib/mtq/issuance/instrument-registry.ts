// ============================================================================
// MTQΣ — PAYMENT-INSTRUMENT REGISTRY · PRODUCTION PILOT MODULE (Task M8-3b)
// ============================================================================
// PROVENANCE: ported from the validated MANDATE-007 §4 prototype
// (audit-work/task13/evidence/issuance-state-machine/instrument-registry.ts —
// immutable evidence; 123/123 assertions ×2 fresh runs, exit 0) into the
// production engine at src/lib/mtq/issuance/, implementing
// `audit-work/task13/payment-instrument-registry-and-settlement-spec.md`
// §3 (registry data model), §4 (per-type policy / depeg bands), §5 (state
// machine & governance), §14.2 (per-instance identity rules) — under the
// ADOPTED (DELEGATED) 2026-10-23 decisions of spec §14.6 REVISION 2.
//
// HONEST REGISTRY STATUS — READ FIRST:
//   • This registry is BORN EMPTY. No real stablecoin, issuer, network, bank
//     rail, or CBDC is registered here, and none can be: this pilot has NO
//     real rail verification, NO signature verification, and NO authorized
//     interface (spec §1: "test tokens only"; spec §5.3 honesty states).
//   • ADMISSION IS FAIL-CLOSED: `admitInstrument()` demands a verified
//     real-rail evidence dossier (per-rail signature verification + recorded
//     end-to-end test — spec §6.2/§14.3). NO such evidence can exist in this
//     pilot, so the production admission path ALWAYS refuses. A NOT_CONNECTED
//     row (honesty overlay, spec §5.3 — every CBDC row) is structurally
//     inadmissible: it may leave that state ONLY on (i) a verified authorized
//     interface and (ii) a recorded end-to-end test against the real
//     interface. NEITHER EXISTS.
//   • The ONLY way rows enter this registry in the pilot is the clearly
//     separated TEST FIXTURE PROVIDER (src/lib/mtq/issuance/test-fixtures.ts),
//     which installs SYNTHETIC TEST-ONLY rows (TEST-USDC-X & co.) for the
//     Pilot Command Center demo and the deterministic test runner. Every
//     fixture row is stamped TEST-ONLY and carries no real identity.
//
// SEPARATION INVARIANT (spec §2 — the load-bearing rule): this registry has
// NO foreign-key, import, event, or telemetry path into basket
// constituency/weighting modules, and carries NO payment-volume telemetry
// field of any kind. Payment volume never determines currency eligibility or
// basket weights (MANDATE-004 §7; test analog: the separation-check helper
// and the M8-3b production runner's SEP assertions).
//
// STATE MODEL — production states are the spec §5 states verbatim:
//   CANDIDATE · ACTIVE · SUSPENDED · RETIRED, plus the spec §5.3 honesty
//   overlay (SIMULATED · NOT_CONNECTED — one-way without new evidence).
//
// ALL numeric parameters (depeg bands, review cadence, notice windows,
// reinstatement observation period) are PROPOSED / UNAPPROVED (decision
// D-13.19, OPEN). Fee classes reference D-13.8 (OPEN — value ILLUSTRATIVE).
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// Zero on-chain actions, zero network calls, zero key handling.
// ============================================================================

import { fmt6 } from "./parameters";

export const REGISTRY_LABEL =
  "PAYMENT-INSTRUMENT REGISTRY (pilot implementation of payment-instrument-registry-and-settlement-spec.md " +
  "§3–§5) — BORN EMPTY · FAIL-CLOSED ADMISSION · NO REAL INSTRUMENT IS REGISTERED";

export const SEPARATION_INVARIANT_TEXT =
  "Payment volume or acceptance must NEVER automatically determine currency eligibility or basket weights. " +
  "Accepting a USD-linked stablecoin does not itself justify increasing the USD weight. " +
  "Accepting a euro-linked instrument does not itself justify increasing the EUR weight. " +
  "(spec §2, verbatim obligation of MANDATE-004 §7; test analog: separation-check.ts + the production runner's " +
  "SEP assertions / T-PAY-01 family)";

export type InstrumentType = "STABLECOIN" | "CBDC" | "BANK_RAIL" | "OTHER";

/** Spec §5 lifecycle states (production states, verbatim). */
export type PaymentRegistryState = "CANDIDATE" | "ACTIVE" | "SUSPENDED" | "RETIRED";

/** Spec §5.3 honesty overlay — one-way without new evidence. */
export type HonestyState = "SIMULATED" | "NOT_CONNECTED";

/** Confirmation & settlement-finality requirements per rail (spec §6.2). */
export interface ConfirmationPolicy {
  kind: "STABLECOIN_N_CONFIRMATIONS" | "CBDC_AUTHORIZED_INTERFACE" | "BANK_RAIL_VERIFIED_INTERFACE";
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
  suspendInstantBps: number; // any 5.00% instantaneous move    → SUSPEND
  emergencySustainedBps: number; // beyond 2.50% sustained 24h         → EMERGENCY
  emergencySustainedHours: number;
  label: string;
}

/** Quote-unit valuation basis per spec §3 assetPeg / §6.1 — never assume 1 token = 1 fiat unit. */
export interface ValuationBasis {
  quoteUnit: string;
  priceSource: string;
  /** Price of 1.0 instrument unit in quote units, 6-decimal fixed point (micro). */
  pricePerUnitMicro: bigint;
  timestampNote: string;
  basisLabel: string;
}

/** Fee class reference — rates live in D-13.8 (OPEN); the registry stores references only (spec §3). */
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
  network: string; // chain/rail identifier — PER-INSTANCE identity, never a ticker alone (spec §3)
  contractAddressOrRailId: string; // SYNTHETIC in this pilot — deliberately NON-HEX (secret-scan safe)
  decimals: number;
  tokenStandard: string;
  jurisdictionAllowlist: string[];
  state: PaymentRegistryState;
  honestyState: HonestyState; // spec §5.3 honesty overlay
  statusLabel: string; // human honesty label
  /** True only for rows installed by the TEST FIXTURE PROVIDER (never in production rows). */
  testOnly: boolean;
  confirmationPolicy: ConfirmationPolicy;
  valuationBasis: ValuationBasis;
  depegThresholds: DepegThresholds;
  fees: FeePolicyRef;
  evidence: string[]; // spec §3: an ACTIVE row with an empty evidence list is invalid by construction
  reviewCadenceDays: number; // PROPOSED 90 default (D-13.19)
  suspendedAtMs: number | null; // spec §4 "in-flight settlements complete under existing quotes"
  perInstanceIdentityNote: string; // spec §14.2 rule (a)
  history: RegistryTransitionRecord[];
}

export interface RegistryTransitionRecord {
  atMs: number;
  action: RegistryActionName;
  fromState: PaymentRegistryState;
  toState: PaymentRegistryState;
  evidence: string;
  notice: string; // spec §5.2 notice publication record (windows PROPOSED D-13.19)
  version: number;
}

export type RegistryActionName =
  | "ADMIT" // admission: dossier + approval + notice (spec §5) — FAIL-CLOSED in this pilot
  | "SUSPEND_DEPEG" // spec §5 trigger: depeg threshold breach (spec §4 bands)
  | "SUSPEND_ISSUER_EVENT" // spec §5 trigger: freeze/insolvency/regulatory/redemption-suspension
  | "REINSTATE" // trigger cleared + observation ≥48h + committee approval (spec §5) — no committee exists
  | "RETIRE"; // spec §5 RETIRED — terminal; records preserved append-only

// ----------------------------------------------------------------------------
// §5 — allowed state-transition table (production spec §5.1)
// ----------------------------------------------------------------------------

export const REGISTRY_TRANSITIONS: Readonly<
  Record<RegistryActionName, Readonly<{ from: readonly PaymentRegistryState[]; to: PaymentRegistryState }>>
> = {
  ADMIT: { from: ["CANDIDATE"], to: "ACTIVE" },
  SUSPEND_DEPEG: { from: ["ACTIVE"], to: "SUSPENDED" },
  SUSPEND_ISSUER_EVENT: { from: ["ACTIVE"], to: "SUSPENDED" },
  REINSTATE: { from: ["SUSPENDED"], to: "ACTIVE" },
  RETIRE: { from: ["CANDIDATE", "ACTIVE", "SUSPENDED"], to: "RETIRED" },
};

// ----------------------------------------------------------------------------
// §4 — depeg band classification (bands per spec §4; values D-13.19 UNAPPROVED)
// ----------------------------------------------------------------------------

export type DepegBand = "NORMAL" | "WARN" | "SUSPEND" | "EMERGENCY";

export interface DepegObservation {
  deviationBps: number; // |observed − referenced| in bps
  sustainedHours: number; // how long the deviation has persisted
  instantaneousMoveBps: number; // instantaneous move in this observation
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
// Verified real-rail evidence — the admission gate (spec §6.2/§14.3). Honest
// status: NO such evidence can exist in this pilot, so admission is closed.
// ----------------------------------------------------------------------------

/**
 * The evidence a REAL admission would require (spec §6.2 per-rail finality +
 * spec §14.3 real-adapter gate). In this pilot NO real rail exists, NO
 * signature verification exists, and NO authorized interface exists, so this
 * type has NO constructor that can produce a verified instance.
 */
export interface RealRailEvidence {
  readonly __brand: "REAL-RAIL-EVIDENCE — CANNOT BE PRODUCED IN THIS PILOT";
  readonly perRailSignatureVerificationRecord: string;
  readonly endToEndTestRecord: string;
  readonly authorizedInterfaceIdentity: string;
}

export interface AdmissionDossier {
  instrumentId: string;
  evidence: RealRailEvidence | null;
  notes: string;
}

export interface RegistryTransitionResult {
  ok: boolean;
  reasonCode: string;
  row?: InstrumentRow;
}

// ----------------------------------------------------------------------------
// The production registry — BORN EMPTY
// ----------------------------------------------------------------------------

export class PaymentInstrumentRegistry {
  readonly label = REGISTRY_LABEL;
  private rows = new Map<string, InstrumentRow>(); // key = instrumentId — EMPTY at construction
  private notices: RegistryTransitionRecord[] = [];
  private clockMs: number;

  constructor(clockStartMs: number) {
    this.clockMs = clockStartMs;
  }

  get nowMs(): number {
    return this.clockMs;
  }
  advanceClock(deltaMs: number): void {
    this.clockMs += deltaMs;
  }

  /** Number of registered rows — 0 at boot for the production registry (fail-closed honesty). */
  get rowCount(): number {
    return this.rows.size;
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
   * PRODUCTION ADMISSION (spec §5 admission path) — FAIL-CLOSED, always, in
   * this pilot. Admission requires a verified real-rail evidence dossier
   * (per-rail signature verification + a recorded end-to-end test, spec
   * §6.2/§14.3). NO real rail and NO signature verification exist in this
   * pilot, so `verifyRealRailEvidence` can never return ok:true here and no
   * instrument — real stablecoin, bank rail, or CBDC — can EVER be admitted
   * through this path. This is the honest, structural form of fail-closed
   * admission.
   */
  admitInstrument(dossier: AdmissionDossier): RegistryTransitionResult {
    const row = this.rows.get(dossier.instrumentId);
    if (!row) {
      return {
        ok: false,
        reasonCode:
          "ADMISSION_BLOCKED_INSTRUMENT_NOT_FOUND — a CANDIDATE row must exist before admission; the " +
          "production registry is BORN EMPTY and no instrument is registered",
      };
    }
    const verification = verifyRealRailEvidence(dossier.evidence);
    if (!verification.ok) {
      return { ok: false, reasonCode: `ADMISSION_BLOCKED_FAIL_CLOSED — ${verification.reason}` };
    }
    // Unreachable in this pilot (verifyRealRailEvidence never succeeds); kept
    // structurally so a future verified dossier flows through the SAME
    // transition table + notice discipline.
    return this.transition(dossier.instrumentId, "ADMIT", dossier.notes);
  }

  /**
   * Apply a lifecycle transition per the spec §5 table. FAIL-CLOSED rules:
   *  - ADMIT is routed through admitInstrument() (verified evidence only);
   *  - a NOT_CONNECTED row (honesty overlay, spec §5.3) can NEVER be admitted
   *    here (no verified authorized interface + recorded end-to-end test exists);
   *  - REINSTATE requires a completed observation period (PROPOSED ≥48h, spec
   *    §5) recorded in the evidence string — and a payment-admission committee
   *    that DOES NOT EXIST (G9 NOT CONDUCTED; honest-status.ts) would have to
   *    approve it: recorded in the notice, not claimed;
   *  - every transition publishes a notice record (windows PROPOSED D-13.19).
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
      return { ok: false, reasonCode: `TRANSITION_NOT_ALLOWED_${action}_FROM_${row.state}` };
    }
    if (action === "ADMIT" && row.honestyState === "NOT_CONNECTED") {
      return {
        ok: false,
        reasonCode:
          "ADMISSION_BLOCKED_NOT_CONNECTED — spec §5.3/§4: a NOT_CONNECTED row may become ACTIVE only via a " +
          "verified authorized interface AND a recorded end-to-end test. NEITHER EXISTS.",
      };
    }
    if (action === "ADMIT" && row.honestyState === "SIMULATED") {
      // A SIMULATED row is an honesty-state row (spec §5.3 — one-way without new
      // evidence). Its machinery is synthetic; the full admission path with a
      // verified real-rail dossier is the only exit, via admitInstrument().
      return {
        ok: false,
        reasonCode:
          "ADMISSION_BLOCKED_SIMULATED — spec §5.3: a SIMULATED row may become ACTIVE only via the full " +
          "admission path with verified real-rail evidence (spec §6.2). No real rail exists in this pilot.",
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
          ? "emergency suspension notice — published within 1h (PROPOSED, D-13.19) — no payment-admission committee exists (G9 NOT CONDUCTED); SYNTHETIC record"
          : "state-transition notice — published within 24h (PROPOSED, D-13.19) — no payment-admission committee exists (G9 NOT CONDUCTED); SYNTHETIC record",
      version: next.version,
    };
    next.history = [...next.history, record];
    this.notices.push(record);
    this.rows.set(instrumentId, next);
    return { ok: true, reasonCode: `OK_${action}`, row: structuredCloneRow(next) };
  }

  /**
   * TEST FIXTURE PROVIDER ENTRY POINT — NOT a production admission path.
   * Only src/lib/mtq/issuance/test-fixtures.ts calls this, with SYNTHETIC
   * TEST-ONLY rows for the Pilot Command Center demo and the deterministic
   * test runner. Every row installed here is stamped TEST-ONLY forever and
   * carries no real identity (synthetic non-hex address, synthetic issuer).
   */
  installRowForTest(row: InstrumentRow, acknowledgment: "TEST-ONLY SYNTHETIC FIXTURE — NOT A REAL INSTRUMENT"): InstrumentRow {
    if (acknowledgment !== "TEST-ONLY SYNTHETIC FIXTURE — NOT A REAL INSTRUMENT") {
      throw new Error("installRowForTest: explicit TEST-ONLY acknowledgment required");
    }
    const stamped = structuredCloneRow(row);
    stamped.testOnly = true;
    if (!stamped.statusLabel.includes("TEST-ONLY")) {
      stamped.statusLabel = `TEST-ONLY · ${stamped.statusLabel}`;
    }
    this.rows.set(stamped.instrumentId, stamped);
    return structuredCloneRow(stamped);
  }

  /** Serialized honesty snapshot (used by separation byte-identity checks). */
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

/**
 * The real-rail evidence verifier. HONEST STATUS: returns ok:false ALWAYS in
 * this pilot — no real rail, no signature verification, and no authorized
 * interface exist (spec §1/§4/§14.3), so no dossier can be verified. This is
 * the fail-closed admission gate in executable form.
 */
export function verifyRealRailEvidence(evidence: RealRailEvidence | null): { ok: boolean; reason: string } {
  if (!evidence) {
    return {
      ok: false,
      reason: "NO REAL-RAIL EVIDENCE EXISTS — this pilot has no real payment rail, no signature verification, and no authorized interface (spec §6.2/§14.3)",
    };
  }
  return {
    ok: false,
    reason: "REAL-RAIL EVIDENCE CANNOT BE VERIFIED IN THIS PILOT — no verifier for any real rail exists",
  };
}

/**
 * Fresh EMPTY registry factory (the production registry's only constructor
 * story: born empty, fail-closed admission, TEST fixtures installed
 * separately by the test-fixtures provider when the demo requires them).
 */
export function createPaymentInstrumentRegistry(clockStartMs: number): PaymentInstrumentRegistry {
  return new PaymentInstrumentRegistry(clockStartMs);
}

/**
 * TEST-OF-ABSENCE helper (spec §2 structural layer): the registry data model
 * must expose NO field that could carry payment-volume telemetry into
 * weighting/eligibility inputs. Walks the serialized schema of a row and fails
 * if any key matches weighting/eligibility vocabulary.
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

/** Format helper re-export for display surfaces (exact 6-decimal strings). */
export { fmt6 };

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
