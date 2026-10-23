// ============================================================================
// MTQΣ — PAYMENT-FUNDED PRIMARY ISSUANCE · POLICY PARAMETERS (Task M8-3b)
// ============================================================================
// THE NAMED POLICY-PARAMETER BLOCK — one provenance record for every economic
// value used anywhere in the issuance module. Ported from the validated
// MANDATE-007 prototype
// (audit-work/task13/evidence/issuance-state-machine/ — 123/123 assertions ×2
// fresh runs, exit 0; MANDATE-007 §4) and configured with the ADOPTED ALT-4
// decisions (spec §14.6 REVISION 2, 2026-10-23 delegated adoption).
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ PROVENANCE & APPROVAL STATUS OF EVERY ECONOMIC VALUE (ALL UNAPPROVED)  │
// ├─────────────────────────────────────────────────────────────────────────┤
// │ • FEE: 0.10% flat (10 bps). FORM adopted under delegated authority      │
// │   2026-10-23 (spec §14.6 REVISION 2 decision 6) — the VALUE is an       │
// │   ILLUSTRATIVE named default only. Decision D-13.8 remains OPEN for     │
// │   the production value. No fee is charged, collected, or retained       │
// │   anywhere outside this pilot ledger.                                   │
// │ • QUOTE: 2.000000 quote-units per 1.0 token. The §14.5 FORM is          │
// │   adopted (issued = net accepted payment value in the approved quote     │
// │   unit ÷ approved MTQΣ issuance quote); the quote-derivation policy     │
// │   publication remains OPEN. The value is ILLUSTRATIVE — NOT approved    │
// │   economic policy, and an index-derived quote is never a promise of     │
// │   the token's later market value (three-measurement separation).        │
// │ • QUOTE VALIDITY WINDOW: 15 minutes (900,000 ms). ILLUSTRATIVE;        │
// │   D-13.19 parameter values remain UNAPPROVED. Hard-rejected at expiry   │
// │   (finality-before-issuance, adopted decision 2).                       │
// │ • SUPPLY CAPS: per-transaction 500,000.000000 · tranche 1,000,000.000000│
// │   · global max 10,000,000.000000 tokens. ILLUSTRATIVE — D-13.6 supply-  │
// │   cap numbers are deferred to owner approval; the checks themselves     │
// │   are fail-closed.                                                      │
// │ • ROUNDING: round-half-to-even at 6 decimals (banker's rounding).       │
// │   PROPOSED rule (spec §6.1 / D-13.19) — UNAPPROVED.                     │
// │ • DEPEG BANDS (per instrument row, spec §4): NORMAL within 0.30% ·       │
// │   WARN ≥0.30% sustained 1h · SUSPEND ≥1.00% sustained 4h or any 5.00%    │
// │   instantaneous move · EMERGENCY ≥2.50% sustained 24h or issuer          │
// │   redemption suspension. ALL VALUES = D-13.19 parameters, UNAPPROVED.   │
// │ • CONVERSION PRICE (per instrument row): 1.000000 quote-units per        │
// │   1.000000 TEST-USDC-X unit via a SYNTHETIC-ORACLE-BOARD stand-in —     │
// │   never assumed; no live oracle board exists in this integration.       │
// │ • MONEY MATH: 6-decimal fixed point on BigInt (exact, no FP error).      │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION: adoption
// confers implementation direction, NOT production economic authorization.
// The executive team does NOT mark any economic value production-approved.
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · NOT ACCEPTED.
// Zero on-chain actions, zero network calls, zero key handling in this file.
// ============================================================================

/** 6-decimal fixed-point unit (1.000000 = 1,000,000 micro). */
export const MICRO = 1_000_000n;

/** Format a 6-decimal micro amount as an exact decimal string. */
export function fmt6(micro: bigint): string {
  const neg = micro < 0n;
  const abs = neg ? -micro : micro;
  const whole = abs / MICRO;
  const frac = abs % MICRO;
  return `${neg ? "-" : ""}${whole.toString(10)}.${frac.toString(10).padStart(6, "0")}`;
}

/**
 * Round-half-to-even BigInt division (banker's rounding — PROPOSED rule,
 * spec §6.1 / D-13.19, UNAPPROVED). Exact integer money math, no FP error.
 */
export function divRoundHalfEven(a: bigint, b: bigint): bigint {
  if (b <= 0n) throw new Error("divRoundHalfEven: non-positive divisor");
  if (a < 0n) throw new Error("issuance module uses non-negative amounts only");
  const q = a / b;
  const r = a % b;
  const twice = r * 2n;
  if (twice > b) return q + 1n;
  if (twice < b) return q;
  return q % 2n === 0n ? q : q + 1n;
}

// ----------------------------------------------------------------------------
// Fee schedule — D-13.8 (FORM adopted; VALUE UNAPPROVED / ILLUSTRATIVE)
// ----------------------------------------------------------------------------

export interface FeeSchedule {
  feeClass: string;
  rateBps: bigint;
  label: string;
}

export const FEE_SCHEDULE: FeeSchedule = {
  feeClass: "FLAT-10BPS (ILLUSTRATIVE)",
  rateBps: 10n, // 0.10% flat — ILLUSTRATIVE — D-13.8 OPEN
  label:
    "ILLUSTRATIVE — D-13.8 OPEN: 0.10% flat named default. The fee schedule (rates, recipients, exemptions, " +
    "caps, change governance) is UNAPPROVED; FORM adopted (delegated) 2026-10-23 pending owner ratification. " +
    "No fee is charged or retained anywhere outside this pilot ledger.",
};

// ----------------------------------------------------------------------------
// Quote policy — §14.5 FORM adopted; derivation policy + values UNAPPROVED
// ----------------------------------------------------------------------------

export interface QuotePolicy {
  /** Issuance quote: quote units per 1.0 token (§14.5 general form divisor). */
  quoteTUPerTokenMicro: bigint;
  /** Quote validity window (hard-reject after expiry — adopted decision 2). */
  quoteTtlMs: number;
  label: string;
}

export const QUOTE_POLICY: QuotePolicy = {
  quoteTUPerTokenMicro: 2_000_000n, // 2.000000 TU per token — ILLUSTRATIVE (spec §14.5)
  quoteTtlMs: 900_000, // 15 minutes — ILLUSTRATIVE (D-13.19 OPEN)
  label:
    "ILLUSTRATIVE QUOTE POLICY (spec §14.5) — issued = net accepted payment value in the approved quote unit ÷ " +
    "approved MTQΣ issuance quote. The quote-derivation policy publication remains OPEN; the formula is " +
    "illustrative, not approved economic policy; an index-derived quote does NOT guarantee the token will " +
    "later trade at that value (three-measurement separation). Validity window 15 min — ILLUSTRATIVE (D-13.19).",
};

// ----------------------------------------------------------------------------
// Supply policy — D-13.6 numbers deferred; checks fail-closed
// ----------------------------------------------------------------------------

export interface SupplyPolicy {
  globalMaxSupplyMicro: bigint;
  perTxCapMicro: bigint;
  trancheId: string;
  trancheCapMicro: bigint;
  label: string;
}

export const SUPPLY_POLICY: SupplyPolicy = {
  globalMaxSupplyMicro: 10_000_000_000_000n, // 10,000,000.000000 tokens — ILLUSTRATIVE
  perTxCapMicro: 500_000_000_000n, // 500,000.000000 tokens — ILLUSTRATIVE
  trancheId: "TRANCHE-TEST-001",
  trancheCapMicro: 1_000_000_000_000n, // 1,000,000.000000 tokens — ILLUSTRATIVE
  label:
    "ILLUSTRATIVE SUPPLY POLICY — D-13.6 supply-cap numbers are deferred to owner approval; every cap check " +
    "is fail-closed (an issuance that would exceed any cap is rejected and never minted).",
};

/** Rounding rule string quoted on every quote record (spec §6.1, PROPOSED). */
export const ROUNDING_RULE = "ROUND_HALF_TO_EVEN @ 6 decimals (PROPOSED, spec §6.1 / D-13.19 — UNAPPROVED)";
