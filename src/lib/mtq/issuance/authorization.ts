// ============================================================================
// MTQΣ — ISSUANCE AUTHORIZATION · ALT-4 (Task M8-3b)
// ============================================================================
// D-13.6 EXCEPTION CLAUSE — RECORDED VERBATIM (spec §14.6 REVISION 2, 2026-10-23,
// delegated adoption, decision 1 — the condition any rule-bound programmatic
// element attaches to; this clause is quoted verbatim in this file header by
// mandate, and D-13.6's proposed wording must incorporate it upon owner
// approval — the two records move together):
//
//   "Programmatic issuance under ALT-4 is the single authorized exception to
//   the payment-alone-never-mints rule ONLY within the exact envelope of a
//   recorded, unrevoked authorization program; anything outside that envelope
//   remains unauthorized."
// ============================================================================
// WHAT THIS MODULE IMPLEMENTS (ADOPTED decision 1 — ALT-4 — hybrid + periodic
// attestation, ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION):
//
//   • Issuance programs are EXPLICIT SIGNED AUTHORIZATION RECORDS: programId,
//     instrument(s) (per-instance code+network), per-program caps,
//     per-transaction caps, window (start/end), rules, and a REVOCATION flag.
//     No payment event, settlement message, quote, or replay can create or
//     alter a program record — only the explicit governed act
//     (defineIssuanceProgram / revokeIssuanceProgram on the machine).
//
//   • EVERY ISSUED TRANSITION REQUIRES AN APPLICABLE UNREVOKED AUTHORIZATION
//     RECORD (INV-A — unconditional: a payment event ALONE can NEVER mint).
//     Rule-bound programmatic checking (instrument ∈ program, window,
//     per-tx cap, per-program cap) happens ONLY INSIDE the program envelope;
//     outside the envelope issuance remains unauthorized, always.
//
//   • PERIODIC ATTESTATION HOOK: an independent authorized attester must
//     periodically attest that observed issuance matched the program rule
//     (three-book reconciliation attestation). ATTESTATION FAILURES SUSPEND
//     THE PIPELINE FAIL-CLOSED: a missing, stale, or mismatched attestation
//     blocks authorization, suspends the pipeline, and new requests are
//     rejected fail-closed until an explicit authorized act resumes it.
//     In this pilot the attester is a clearly-labeled STUB (no authorized
//     attester exists — spec §5.2: no committee/role holder exists).
//
// PROVENANCE: ported from the validated MANDATE-007 §4 prototype
// (audit-work/task13/evidence/issuance-state-machine/issuance-state-machine.ts
// — immutable evidence; the prototype kept ALT-1..ALT-4 as unselected stubs
// under the then-OPEN D-13.27; this production module implements the ALT-4
// stub's semantics as the ADOPTED model, per spec §14.6 REVISION 2).
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// Zero on-chain actions, zero network calls, zero key handling.
// ============================================================================

import { fmt6 } from "./parameters";

export const ALT4_ADOPTION_LABEL =
  "ALT-4 — hybrid (rule-bound programmatic issuance inside explicitly authorized programs) + periodic " +
  "attestation — ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION (spec §14.6 REVISION 2, " +
  "decision 1). Adoption confers implementation direction, NOT production economic authorization.";

export const AUTHORIZATION_MODULE_LABEL =
  "PAYMENT→ISSUANCE AUTHORIZATION (ALT-4 ADOPTED, DELEGATED 2026-10-23 — PENDING OWNER RATIFICATION) — " +
  "every ISSUED transition requires an applicable unrevoked authorization program record; a payment event " +
  "ALONE can NEVER create one (INV-A, unconditional).";

// ----------------------------------------------------------------------------
// Issuance programs — explicit signed authorization records
// ----------------------------------------------------------------------------

/** Per-instance instrument identity admitted inside a program envelope. */
export interface ProgramInstrumentRef {
  code: string;
  network: string;
}

export interface IssuanceProgramRecord {
  programId: string;
  /** Explicitly authorized instrument instances (per-instance identity, spec §14.2 rule (a)). */
  instruments: readonly ProgramInstrumentRef[];
  /** Per-program cumulative cap on issued tokens (micro) — fail-closed. */
  perProgramCapMicro: bigint;
  /** Issued inside this program so far (consumed by the machine on authorization). */
  issuedInProgramMicro: bigint;
  /** Per-transaction cap on issued tokens (micro) — fail-closed. */
  perTxCapMicro: bigint;
  /** Authorization window — issuance outside the window is unauthorized. */
  windowStartMs: number;
  windowEndMs: number;
  /** The binding program rule text (quote-policy reference, disclosure obligations). */
  rules: readonly string[];
  /** REVOCATION FLAG — a revoked program authorizes nothing. */
  revoked: boolean;
  revocationReason: string | null;
  /**
   * "Signed" authorization record — in this pilot the signature is a clearly
   * labeled SYNTHETIC TEST-ONLY tag (no real signer/multisig exists); production
   * requires a governance-approved signed record (spec §14.6 decision 1).
   */
  signedBy: string;
  signatureTag: string; // TEST-TAG-<16 hex> in this pilot — NEVER a 64-char hex literal
  signedAtMs: number;
  version: number;
  label: string;
}

/** The input the programmatic rule evaluates — assembled by the machine from its own state. */
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
  programId: IssuanceProgramRecord["programId"] | null;
  reasonCode: string;
  scopeEvidence: string;
}

// ----------------------------------------------------------------------------
// Periodic attestation — the ALT-4 operational duty (fail-closed)
// ----------------------------------------------------------------------------

export interface AttestationRecord {
  attestationId: string;
  attestedAtMs: number;
  /** Attestation period (ms) — an attestation older than its period is STALE. */
  periodMs: number;
  /** True when observed issuance matched the program rule + three books reconciled. */
  matched: boolean;
  attester: string;
  notes: string;
}

export type AttestationStatusKind = "OK" | "MISSING" | "STALE" | "MISMATCH";

export interface AttestationStatus {
  kind: AttestationStatusKind;
  ok: boolean;
  reasonCode: string;
  detail: string;
}

/**
 * Check attestation freshness/match. Any MISSING / STALE / MISMATCH outcome
 * blocks authorization AND (per the adopted decision) suspends the pipeline
 * fail-closed — the machine enforces the suspension side effect.
 */
export function checkAttestationStatus(attestation: AttestationRecord | null, nowMs: number): AttestationStatus {
  if (!attestation) {
    return {
      kind: "MISSING",
      ok: false,
      reasonCode: "NO_ATTESTATION — hybrid program requires a fresh attestation (ALT-4)",
      detail: "no periodic attestation has been recorded; issuance is suspended fail-closed pending one",
    };
  }
  const age = nowMs - attestation.attestedAtMs;
  if (age > attestation.periodMs) {
    return {
      kind: "STALE",
      ok: false,
      reasonCode: "STALE_ATTESTATION — issuance suspension pending fresh governance attestation (ALT-4)",
      detail: `attestation ${attestation.attestationId} age ${age}ms > period ${attestation.periodMs}ms`,
    };
  }
  if (!attestation.matched) {
    return {
      kind: "MISMATCH",
      ok: false,
      reasonCode: "ATTESTATION_MISMATCH — automatic issuance suspension pending review (ALT-4)",
      detail: `attestation ${attestation.attestationId} reported mismatch`,
    };
  }
  return {
    kind: "OK",
    ok: true,
    reasonCode: "ATTESTATION_FRESH",
    detail: `attestation ${attestation.attestationId} fresh (age ${age}ms ≤ period ${attestation.periodMs}ms) and matched`,
  };
}

/** The authorized-attester contract (spec §14.6 decision 1: periodic independent attestation). */
export interface Attester {
  readonly attesterId: string;
  readonly label: string;
  readonly isStub: boolean;
  attest(input: { attestationId: string; nowMs: number; matched: boolean; notes: string }): AttestationRecord;
}

/**
 * STUB ATTESTER — CLEARLY LABELED. No authorized independent attester exists
 * in this pilot (no committee, no role holder — spec §5.2: "DOES NOT
 * EXIST"). This stub exists ONLY so the attestation hook is executable in
 * the Pilot Command Center demo and the deterministic test runner. Production
 * requires a governance-appointed independent attester signing real
 * three-book attestations.
 */
export class StubAttester implements Attester {
  readonly attesterId: string;
  readonly label =
    "STUB ATTESTER (TEST-ONLY) — no authorized independent attester exists in this pilot; " +
    "production requires a governance-appointed attester (spec §5.2/§14.6 decision 1)";
  readonly isStub = true;

  constructor(attesterId = "STUB-ATTESTER-TEST-ONLY") {
    this.attesterId = attesterId;
  }

  attest(input: { attestationId: string; nowMs: number; matched: boolean; notes: string }): AttestationRecord {
    return {
      attestationId: input.attestationId,
      attestedAtMs: input.nowMs,
      periodMs: 604_800_000, // one week — ILLUSTRATIVE (spec §14.6: "e.g., weekly"); D-13.19 UNAPPROVED
      matched: input.matched,
      attester: `${this.attesterId} (STUB — TEST-ONLY)`,
      notes: input.notes,
    };
  }
}

// ----------------------------------------------------------------------------
// ALT-4 program-envelope check — rule-bound programmatic checking happens
// ONLY inside the program envelope (spec §14.6 decision 1)
// ----------------------------------------------------------------------------

/**
 * Evaluate whether an applicable, unrevoked authorization program covers the
 * prospective issuance. Order of checks (all fail-closed):
 *   1. at least one program record exists;
 *   2. a program that is NOT REVOKED;
 *   3. the program window contains `atMs`;
 *   4. the instrument INSTANCE (code+network) is in the program's list
 *      (per-instance identity — approval on one network ≠ approval elsewhere);
 *   5. per-transaction cap;
 *   6. per-program cumulative cap.
 * The attestation status is checked SEPARATELY (and first) by the machine —
 * an attestation failure suspends the pipeline regardless of programs.
 */
export function checkProgramAuthorization(
  programs: readonly IssuanceProgramRecord[],
  input: AuthorizationDecisionInput,
): AuthorizationDecision {
  if (programs.length === 0) {
    return {
      approved: false,
      programId: null,
      reasonCode: "NO_AUTHORIZATION_PROGRAM — no issuance program exists; payments alone NEVER mint (ALT-4, INV-A)",
      scopeEvidence: "none",
    };
  }
  const candidates = programs.filter((p) => !p.revoked);
  if (candidates.length === 0) {
    return {
      approved: false,
      programId: null,
      reasonCode: "ALL_PROGRAMS_REVOKED — no unrevoked authorization program applies; issuance unauthorized",
      scopeEvidence: programs.map((p) => `${p.programId} (revoked: ${p.revocationReason ?? "n/a"})`).join("; "),
    };
  }
  for (const program of candidates) {
    if (input.atMs < program.windowStartMs || input.atMs > program.windowEndMs) {
      continue; // window closed for this program — try the next
    }
    const instrumentOk = program.instruments.some((i) => i.code === input.instrumentCode && i.network === input.network);
    if (!instrumentOk) {
      continue; // instrument instance not in this program's envelope
    }
    if (input.prospectiveIssuedMicro > program.perTxCapMicro) {
      return {
        approved: false,
        programId: program.programId,
        reasonCode: "PER_TX_PROGRAM_CAP_EXCEEDED (ALT-4, fail-closed)",
        scopeEvidence: `program ${program.programId}: prospective ${fmt6(input.prospectiveIssuedMicro)} > per-tx cap ${fmt6(program.perTxCapMicro)}`,
      };
    }
    if (program.issuedInProgramMicro + input.prospectiveIssuedMicro > program.perProgramCapMicro) {
      return {
        approved: false,
        programId: program.programId,
        reasonCode: "PER_PROGRAM_CAP_EXCEEDED (ALT-4, fail-closed)",
        scopeEvidence: `program ${program.programId}: issued ${fmt6(program.issuedInProgramMicro)} + ${fmt6(input.prospectiveIssuedMicro)} > cap ${fmt6(program.perProgramCapMicro)}`,
      };
    }
    return {
      approved: true,
      programId: program.programId,
      reasonCode: "APPROVED_WITHIN_PROGRAM_ENVELOPE",
      scopeEvidence:
        `program ${program.programId} (per-tx cap ${fmt6(program.perTxCapMicro)}, program cap ` +
        `${fmt6(program.perProgramCapMicro)}, window ${program.windowStartMs}..${program.windowEndMs}ms)`,
    };
  }
  return {
    approved: false,
    programId: null,
    reasonCode:
      "NO_APPLICABLE_PROGRAM — no unrevoked program covers this instrument instance and window; " +
      "issuance outside the envelope is unauthorized (D-13.6 exception clause)",
    scopeEvidence: "none",
  };
}

/**
 * FNV-1a 64-bit (in-process, deterministic, non-cryptographic) — used ONLY to
 * derive the SYNTHETIC TEST-ONLY signature tag on program records. The tag is
 * deliberately truncated to 16 hex characters so no 64-char hex literal is
 * ever produced anywhere. Production program records require REAL governance
 * signatures (multisig) — none exists here.
 */
export function syntheticSignatureTag(canonical: string): string {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < canonical.length; i++) {
    h ^= BigInt(canonical.charCodeAt(i) & 0xff);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return `TEST-TAG-${h.toString(16).padStart(16, "0")}`;
}

export const SYNTHETIC_SIGNATURE_LABEL =
  "SYNTHETIC TEST-ONLY SIGNATURE SCHEME — the program-record 'signature' is an in-process tag over canonical " +
  "fields, deliberately truncated to 16 hex chars (never a 64-char literal), computed with a TEST-ONLY key. " +
  "NOT cryptographic. Production ALT-4 program records require governance-approved signed records (multisig) " +
  "— none exists in this pilot.";
