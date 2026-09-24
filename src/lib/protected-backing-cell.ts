// ============================================================================
//  MITHQAL — Protected Backing Cell (PBC) (Blueprint v25.3 §47)
//  ----------------------------------------------------------------------------
//  Module ID:   v25.2-protected-backing-cell-1.0
//  Section:     §47
//  Source file: `src/lib/protected-backing-cell.ts`
//
//  The Protected Backing Cell (PBC) is the canonical data structure by which
//  a bank- or institution-side asset is identified, earmarked, verified, and
//  allocated to support MTQ issuance. It is the structural mechanism by which
//  MITHQAL enforces the non-custodial principle: MITHQAL does NOT own or
//  custody the backing assets — the bank holds the assets in its existing
//  custody infrastructure; MITHQAL only verifies, applies constitutional
//  rules, calculates issuance capacity, authorizes issuance, reconciles, and
//  monitors systemic risk.
//
//  Central invariant — the anti-double-count rule:
//    "A single backing must NEVER support multiple MTQ obligations; a
//     Protected Backing Cell may be allocated to at most one mtqObligationId
//     at a time."
//
//  Central formula (§47):
//    AvailableBacking = RecognizedBacking
//                     − EncumberedBacking
//                     − AlreadyAllocatedBacking
//
//  Honest state (§74):
//    protectedBackingModelImplemented = true
//    protectedBackingLiveCells         = 0   // NO live cell has been
//                                            // contracted; every reference
//                                            // cell is SIMULATED / SPECIFIED.
//
//  The model is APPROVED CANDIDATE FOR CONTROLLED TESTING — NOT
//  PRODUCTION-AUTHORIZED.
// ============================================================================

export const PBC_MODULE_ID = "v25.2-protected-backing-cell-1.0" as const;
export const PBC_SECTION = 47 as const;
export const PBC_FORMULA =
  "AvailableBacking = RecognizedBacking − EncumberedBacking − AlreadyAllocatedBacking" as const;
export const PBC_ANTI_DOUBLE_COUNT_RULE =
  "A single backing must never support multiple MTQ obligations; a Protected Backing Cell may be allocated to at most one mtqObligationId at a time.";

// ----------------------------------------------------------------------------
// §14.2 / §14.3 — Asset, custodian, jurisdiction, evidence, legal schemas
// ----------------------------------------------------------------------------

export type AssetType =
  | "fiat-cash"
  | "fiat-sovereign"
  | "gold-physical-allocated"
  | "gold-physical-unallocated"
  | "tokenized-gold"
  | "silver"
  | "digital-stablecoin"
  | "digital-treasury"
  | "money-market-fund";

export interface ProtectedBackingAsset {
  type: AssetType;
  name: string;
  currency?: string;     // ISO 4217 for fiat / stablecoins
  isin?: string;         // for sovereign / money-market instruments
  tokenId?: string;      // contract address for tokenized assets
  chain?: string;        // chain id for tokenized assets
}

export type LegalStatus =
  | "CLEARED"
  | "CONFIRMED"
  | "PENDING_REVIEW"
  | "DISPUTED"
  | "ENCUMBERED_LEGAL"
  | "LIQUIDATED";

export type EncumbranceStatus =
  | "FREE"
  | "PARTIALLY_ENCUMBERED"
  | "ENCUMBERED"
  | "FROZEN"
  | "PLEDGED_TO_MITHQAL"
  | "PENDING_RELEASE";

export type AllocationStatus =
  | "UNALLOCATED"
  | "ALLOCATED"
  | "PARTIALLY_ALLOCATED"
  | "RESERVED"
  | "RELEASED";

export type CustodianTier =
  | "TIER1_REGULATED_BANK"
  | "TIER2_SPECIALIST_CUSTODIAN"
  | "TIER3_TRUST_COMPANY"
  | "TIER4_SELF_CUSTODY"
  | "TIER_UNKNOWN";

export type JurisdictionRisk =
  | "APPROVED"
  | "WATCH"
  | "SANCTIONED"
  | "UNKNOWN";

export type ProtectedBackingEvidenceState =
  | "DESIGNED"
  | "DESIGNED_PENDING"
  | "IMPLEMENTED"
  | "IMPLEMENTED_PENDING"
  | "INTEGRATED"
  | "INTEGRATED_PENDING"
  | "TESTED"
  | "TESTED_PENDING"
  | "SANDBOX_VALIDATED"
  | "SANDBOX_VALIDATED_PENDING"
  | "INSTITUTIONALLY_VALIDATED"
  | "INSTITUTIONALLY_VALIDATED_PENDING"
  | "PRODUCTION_READY";

export type AttestationKind =
  | "custodian_attestation"
  | "independent_audit"
  | "legal_opinion"
  | "regulator_no_objection"
  | "smart_contract_proof"
  | "off_chain_receipt";

export interface ProtectedBackingAttestation {
  kind: AttestationKind;
  attester: string;
  at: string;            // ISO 8601 timestamp
  evidenceHash: string;  // SHA-256 / multihash reference
  simulated: boolean;    // true if SIMULATED; false only when a real institution attests
}

export interface ProtectedBackingEvidence {
  evidenceState: ProtectedBackingEvidenceState;
  attestations: ProtectedBackingAttestation[];
  lastTransitionAt: string;  // ISO 8601 timestamp
  simulated: boolean;
}

// ----------------------------------------------------------------------------
// §14.2 — The 17 canonical fields
// ----------------------------------------------------------------------------
//
//  1.  backingId
//  2.  institutionId
//  3.  asset (ProtectedBackingAsset)
//  4.  quantity
//  5.  valuation
//  6.  haircut
//  7.  legalStatus
//  8.  custodian
//  9.  jurisdiction
//  10. encumbranceStatus
//  11. allocationStatus
//  12. utilizedAmount
//  13. availableAmount (computed)
//  14. evidence (ProtectedBackingEvidence)
//  15. verificationTimestamp
//  16. effectiveDate
//  17. expiry
//
// Plus operational companion fields (§14.3): encumberedAmount,
// allocatedObligationIds, custodianTier, jurisdictionRisk, simulated.

export interface ProtectedBackingCell {
  // ---- 17 canonical fields (§14.2) ----
  backingId: string;
  institutionId: string;
  asset: ProtectedBackingAsset;
  quantity: number;
  valuation: number;
  haircut: number;
  legalStatus: LegalStatus;
  custodian: string;
  jurisdiction: string;
  encumbranceStatus: EncumbranceStatus;
  allocationStatus: AllocationStatus;
  utilizedAmount: number;
  availableAmount: number; // computed via computeAvailableBacking
  evidence: ProtectedBackingEvidence;
  verificationTimestamp: string;
  effectiveDate: string;
  expiry: string;
  // ---- operational companion fields (§14.3) ----
  encumberedAmount: number;
  allocatedObligationIds: string[];
  custodianTier: CustodianTier;
  jurisdictionRisk: JurisdictionRisk;
  simulated: boolean;
}

// ----------------------------------------------------------------------------
// §14.4 — The §47 formula
// ----------------------------------------------------------------------------

export interface AvailableBackingComputation {
  recognizedBacking: number;
  encumberedBacking: number;
  alreadyAllocatedBacking: number;
  availableBacking: number;
  nonNegative: boolean;
  formula: typeof PBC_FORMULA;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function computeAvailableBacking(
  cell: ProtectedBackingCell,
): AvailableBackingComputation {
  const recognizedBacking = round2(cell.valuation * (1 - cell.haircut));
  const encumberedBacking = clamp(round2(cell.encumberedAmount), 0, recognizedBacking);
  const alreadyAllocatedBacking = clamp(round2(cell.utilizedAmount), 0, recognizedBacking);
  const rawAvailable = round2(
    recognizedBacking - encumberedBacking - alreadyAllocatedBacking,
  );
  const availableBacking = Math.max(0, rawAvailable);
  return {
    recognizedBacking,
    encumberedBacking,
    alreadyAllocatedBacking,
    availableBacking,
    nonNegative: rawAvailable >= 0,
    formula: PBC_FORMULA,
  };
}

// ----------------------------------------------------------------------------
// §14.5 — Anti-double-count rule (enforced at mutation + audit layers)
// ----------------------------------------------------------------------------

export interface DoubleCountViolation {
  backingId: string;
  institutionId: string;
  allocatedObligationIds: string[];
  violation: string;
}

export function verifyNoDoubleCount(
  cells: ProtectedBackingCell[],
): DoubleCountViolation[] {
  const violations: DoubleCountViolation[] = [];
  for (const cell of cells) {
    const distinct = new Set(cell.allocatedObligationIds);
    if (distinct.size > 1) {
      violations.push({
        backingId: cell.backingId,
        institutionId: cell.institutionId,
        allocatedObligationIds: [...cell.allocatedObligationIds],
        violation:
          `backing ${cell.backingId} supports ${distinct.size} distinct MTQ obligations ` +
          `(${Array.from(distinct).join(", ")}); anti-double-count rule violated`,
      });
    }
  }
  return violations;
}

// ----------------------------------------------------------------------------
// §14.5.2 / §14.6 — allocateBacking (mutation-time enforcement)
// ----------------------------------------------------------------------------

export interface AllocationResult {
  ok: boolean;
  reason: string;
  cell: ProtectedBackingCell;
  allocatedAmount?: number;
  mtqObligationId?: string;
}

export function allocateBacking(
  cell: ProtectedBackingCell,
  amount: number,
  mtqObligationId: string,
): AllocationResult {
  if (amount <= 0) {
    return { ok: false, reason: "amount must be positive", cell };
  }
  if (!mtqObligationId || mtqObligationId.trim() === "") {
    return { ok: false, reason: "mtqObligationId is required", cell };
  }

  // Anti-double-count: a cell may support AT MOST ONE distinct obligation.
  const existingOther = cell.allocatedObligationIds.find(
    (id) => id !== mtqObligationId,
  );
  if (existingOther !== undefined) {
    return {
      ok: false,
      reason:
        `anti-double-count violation: backing ${cell.backingId} is already ` +
        `allocated to MTQ obligation '${existingOther}'; cannot also support '${mtqObligationId}'`,
      cell,
    };
  }

  const avail = computeAvailableBacking(cell);
  const newUtilized = round2(cell.utilizedAmount + amount);
  if (newUtilized > avail.availableBacking + 1e-6) {
    return {
      ok: false,
      reason:
        `insufficient available backing: requested ${amount} ` +
        `(would bring utilized to ${newUtilized}); available = ${avail.availableBacking}`,
      cell,
    };
  }

  const updated: ProtectedBackingCell = {
    ...cell,
    utilizedAmount: newUtilized,
    availableAmount: round2(avail.availableBacking - amount),
    allocatedObligationIds:
      cell.allocatedObligationIds.includes(mtqObligationId)
        ? cell.allocatedObligationIds
        : [...cell.allocatedObligationIds, mtqObligationId],
    allocationStatus:
      newUtilized >= avail.recognizedBacking - avail.encumberedBacking
        ? "ALLOCATED"
        : "PARTIALLY_ALLOCATED",
  };
  return {
    ok: true,
    reason: "allocated",
    cell: updated,
    allocatedAmount: amount,
    mtqObligationId,
  };
}

// ----------------------------------------------------------------------------
// §14.7 — releaseAllocation
// ----------------------------------------------------------------------------

export interface ReleaseResult {
  ok: boolean;
  reason: string;
  cell: ProtectedBackingCell;
  releasedAmount?: number;
  mtqObligationId?: string;
}

export function releaseAllocation(
  cell: ProtectedBackingCell,
  mtqObligationId: string,
): ReleaseResult {
  if (!cell.allocatedObligationIds.includes(mtqObligationId)) {
    return {
      ok: false,
      reason: `cell ${cell.backingId} is not allocated to '${mtqObligationId}'`,
      cell,
    };
  }
  const released = cell.utilizedAmount;
  const updated: ProtectedBackingCell = {
    ...cell,
    utilizedAmount: 0,
    availableAmount: computeAvailableBacking({ ...cell, utilizedAmount: 0 }).availableBacking,
    allocatedObligationIds: cell.allocatedObligationIds.filter(
      (id) => id !== mtqObligationId,
    ),
    allocationStatus: "RELEASED",
  };
  return {
    ok: true,
    reason: "released",
    cell: updated,
    releasedAmount: released,
    mtqObligationId,
  };
}

// ----------------------------------------------------------------------------
// §14.10 — Eligibility rules (11 checks)
// ----------------------------------------------------------------------------

export type ProtectedBackingCellStatusColor = "amber" | "emerald" | "red" | "gray";

export interface ProtectedBackingCellStatus {
  status:
    | "ELIGIBLE"
    | "ELIGIBLE_WITH_CONDITIONS"
    | "PENDING_VERIFICATION"
    | "INELIGIBLE"
    | "EXPIRED"
    | "LIQUIDATED";
  color: ProtectedBackingCellStatusColor;
  reasons: string[];
}

const EVIDENCE_STATE_RANK: Record<ProtectedBackingEvidenceState, number> = {
  DESIGNED: 0,
  DESIGNED_PENDING: 0,
  IMPLEMENTED: 1,
  IMPLEMENTED_PENDING: 1,
  INTEGRATED: 2,
  INTEGRATED_PENDING: 2,
  TESTED: 3,
  TESTED_PENDING: 3,
  SANDBOX_VALIDATED: 4,
  SANDBOX_VALIDATED_PENDING: 4,
  INSTITUTIONALLY_VALIDATED: 5,
  INSTITUTIONALLY_VALIDATED_PENDING: 5,
  PRODUCTION_READY: 6,
};

export function isEligibleAsBacking(cell: ProtectedBackingCell): ProtectedBackingCellStatus {
  const reasons: string[] = [];

  if (cell.legalStatus !== "CLEARED" && cell.legalStatus !== "CONFIRMED") {
    reasons.push(`legalStatus=${cell.legalStatus}; must be CLEARED or CONFIRMED`);
  }
  if (EVIDENCE_STATE_RANK[cell.evidence.evidenceState] < EVIDENCE_STATE_RANK.INTEGRATED) {
    reasons.push(`evidenceState=${cell.evidence.evidenceState}; must be ≥ INTEGRATED`);
  }
  const nowMs = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const verifiedAt = Date.parse(cell.verificationTimestamp);
  if (!Number.isFinite(verifiedAt)) {
    reasons.push("verificationTimestamp missing/invalid");
  } else if (verifiedAt > nowMs + 60_000) {
    reasons.push("verificationTimestamp is in the future");
  } else if (nowMs - verifiedAt > ninetyDaysMs) {
    reasons.push("verificationTimestamp is stale (> 90 days)");
  }
  const expiryMs = Date.parse(cell.expiry);
  if (!Number.isFinite(expiryMs) || expiryMs <= nowMs) {
    reasons.push("expiry must be in the future");
  }
  const effectiveMs = Date.parse(cell.effectiveDate);
  if (!Number.isFinite(effectiveMs)) {
    reasons.push("effectiveDate missing/invalid");
  } else if (effectiveMs > nowMs + 24 * 60 * 60 * 1000) {
    reasons.push("effectiveDate is more than 1 day in the future");
  }
  if (cell.custodianTier === "TIER4_SELF_CUSTODY" || cell.custodianTier === "TIER_UNKNOWN") {
    reasons.push(`custodianTier=${cell.custodianTier}; must NOT be self-custody or unknown`);
  }
  if (cell.jurisdictionRisk !== "APPROVED") {
    reasons.push(`jurisdictionRisk=${cell.jurisdictionRisk}; must be APPROVED`);
  }
  if (cell.encumbranceStatus === "FROZEN" || cell.encumbranceStatus === "ENCUMBERED") {
    reasons.push(`encumbranceStatus=${cell.encumbranceStatus}; must NOT be FROZEN or ENCUMBERED`);
  }
  if (cell.haircut < 0 || cell.haircut > 0.20) {
    reasons.push(`haircut=${cell.haircut}; must be in [0, 0.20]`);
  }
  if (!(cell.quantity > 0)) reasons.push("quantity must be positive");
  if (!(cell.valuation > 0)) reasons.push("valuation must be positive");
  if (new Set(cell.allocatedObligationIds).size > 1) {
    reasons.push("anti-double-count violation: cell supports > 1 obligation");
  }

  if (cell.legalStatus === "LIQUIDATED") {
    return { status: "LIQUIDATED", color: "red", reasons };
  }
  if (reasons.length === 0) {
    return { status: "ELIGIBLE", color: "emerald", reasons: [] };
  }
  if (reasons.some((r) => r.startsWith("expiry"))) {
    return { status: "EXPIRED", color: "red", reasons };
  }
  if (reasons.some((r) => r.startsWith("evidenceState") || r.startsWith("verificationTimestamp"))) {
    return { status: "PENDING_VERIFICATION", color: "amber", reasons };
  }
  return { status: "INELIGIBLE", color: "red", reasons };
}

// ----------------------------------------------------------------------------
// §14.9 — Evidence package generation
// ----------------------------------------------------------------------------

export interface ProtectedBackingEvidencePackage {
  evidencePackageId: string;
  generatedAt: string;
  module: typeof PBC_MODULE_ID;
  section: typeof PBC_SECTION;
  cellCount: number;
  totals: {
    recognizedBacking: number;
    encumberedBacking: number;
    alreadyAllocatedBacking: number;
    availableBacking: number;
  };
  doubleCountViolations: DoubleCountViolation[];
  perCell: Array<{
    backingId: string;
    institutionId: string;
    evidenceState: ProtectedBackingEvidenceState;
    simulated: boolean;
    availableBacking: number;
    eligibility: ProtectedBackingCellStatus;
    attestations: ProtectedBackingAttestation[];
  }>;
  honestState: ReturnType<typeof protectedBackingHonestState>;
  formula: typeof PBC_FORMULA;
  antiDoubleCountRule: string;
}

export function generateProtectedBackingEvidence(
  cells: ProtectedBackingCell[],
): ProtectedBackingEvidencePackage {
  const violations = verifyNoDoubleCount(cells);
  let recognized = 0;
  let encumbered = 0;
  let allocated = 0;
  let available = 0;
  for (const c of cells) {
    const a = computeAvailableBacking(c);
    recognized += a.recognizedBacking;
    encumbered += a.encumberedBacking;
    allocated += a.alreadyAllocatedBacking;
    available += a.availableBacking;
  }
  return {
    evidencePackageId: `pbc-evidence-${Date.now().toString(36)}`,
    generatedAt: new Date().toISOString(),
    module: PBC_MODULE_ID,
    section: PBC_SECTION,
    cellCount: cells.length,
    totals: {
      recognizedBacking: round2(recognized),
      encumberedBacking: round2(encumbered),
      alreadyAllocatedBacking: round2(allocated),
      availableBacking: round2(available),
    },
    doubleCountViolations: violations,
    perCell: cells.map((c) => ({
      backingId: c.backingId,
      institutionId: c.institutionId,
      evidenceState: c.evidence.evidenceState,
      simulated: c.simulated,
      availableBacking: computeAvailableBacking(c).availableBacking,
      eligibility: isEligibleAsBacking(c),
      attestations: c.evidence.attestations,
    })),
    honestState: protectedBackingHonestState(),
    formula: PBC_FORMULA,
    antiDoubleCountRule: PBC_ANTI_DOUBLE_COUNT_RULE,
  };
}

// ----------------------------------------------------------------------------
// §14.9.3 — Honest state declaration (§74)
// ----------------------------------------------------------------------------

export interface ProtectedBackingHonestState {
  protectedBackingModelImplemented: true;
  protectedBackingLiveCells: 0;
}

export function protectedBackingHonestState(): ProtectedBackingHonestState {
  return {
    protectedBackingModelImplemented: true,
    protectedBackingLiveCells: 0,
  };
}

// ----------------------------------------------------------------------------
// §14.11 — 4 SIMULATED reference cells (0 live cells)
// ----------------------------------------------------------------------------

const REF_TIMESTAMP = "2026-08-22T00:00:00.000Z";
const REF_EFFECTIVE = "2025-01-15";
const REF_EXPIRY = "2027-01-15";

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Reference cell 1 — USD cash (HQLA-1). */
export const PBC_REFERENCE_USD_CASH: ProtectedBackingCell = {
  backingId: "pbc-usd-cash-001",
  institutionId: "inst-bank-ny-001",
  asset: { type: "fiat-cash", name: "USD demand deposit (HQLA-1 cash)", currency: "USD" },
  quantity: 65_000_000,
  valuation: 65_000_000,
  haircut: 0.00,
  legalStatus: "CLEARED",
  custodian: "SIMULATED — regulated US bank custodian (NY)",
  jurisdiction: "US-NY",
  encumbranceStatus: "PLEDGED_TO_MITHQAL",
  allocationStatus: "UNALLOCATED",
  utilizedAmount: 0,
  availableAmount: 65_000_000,
  evidence: {
    evidenceState: "TESTED",
    attestations: [
      { kind: "custodian_attestation", attester: "SIMULATED bank treasury", at: daysAgoIso(5), evidenceHash: "0x" + "a".repeat(64), simulated: true },
      { kind: "independent_audit", attester: "SIMULATED Big-4 audit firm", at: daysAgoIso(12), evidenceHash: "0x" + "b".repeat(64), simulated: true },
    ],
    lastTransitionAt: REF_TIMESTAMP,
    simulated: true,
  },
  verificationTimestamp: daysAgoIso(5),
  effectiveDate: REF_EFFECTIVE,
  expiry: REF_EXPIRY,
  encumberedAmount: 0,
  allocatedObligationIds: [],
  custodianTier: "TIER1_REGULATED_BANK",
  jurisdictionRisk: "APPROVED",
  simulated: true,
};

/** Reference cell 2 — Allocated physical gold (LBMA Good Delivery). */
export const PBC_REFERENCE_XAU_ALLOCATED: ProtectedBackingCell = {
  backingId: "pbc-xau-allocated-001",
  institutionId: "inst-bullion-custodian-lon-001",
  asset: { type: "gold-physical-allocated", name: "Allocated physical gold (Good Delivery bars)" },
  quantity: 12_000,
  valuation: 23_400_000,
  haircut: 0.02,
  legalStatus: "CONFIRMED",
  custodian: "SIMULATED — LBMA bullion custodian (London vault)",
  jurisdiction: "GB-ENG",
  encumbranceStatus: "PLEDGED_TO_MITHQAL",
  allocationStatus: "UNALLOCATED",
  utilizedAmount: 0,
  availableAmount: 22_932_000,
  evidence: {
    evidenceState: "TESTED",
    attestations: [
      { kind: "custodian_attestation", attester: "SIMULATED vault operator", at: daysAgoIso(7), evidenceHash: "0x" + "c".repeat(64), simulated: true },
      { kind: "legal_opinion", attester: "SIMULATED London counsel", at: daysAgoIso(18), evidenceHash: "0x" + "d".repeat(64), simulated: true },
      { kind: "independent_audit", attester: "SIMULATED LBMA auditor", at: daysAgoIso(20), evidenceHash: "0x" + "e".repeat(64), simulated: true },
    ],
    lastTransitionAt: REF_TIMESTAMP,
    simulated: true,
  },
  verificationTimestamp: daysAgoIso(7),
  effectiveDate: REF_EFFECTIVE,
  expiry: REF_EXPIRY,
  encumberedAmount: 0,
  allocatedObligationIds: [],
  custodianTier: "TIER2_SPECIALIST_CUSTODIAN",
  jurisdictionRisk: "APPROVED",
  simulated: true,
};

/** Reference cell 3 — USDC (regulated stablecoin). */
export const PBC_REFERENCE_USDC: ProtectedBackingCell = {
  backingId: "pbc-usdc-001",
  institutionId: "inst-stablecoin-issuer-001",
  asset: { type: "digital-stablecoin", name: "USDC (regulated stablecoin)", currency: "USDC" },
  quantity: 2_600_000,
  valuation: 2_600_000,
  haircut: 0.03,
  legalStatus: "CONFIRMED",
  custodian: "SIMULATED — regulated money-transmitter / issuer",
  jurisdiction: "US-NY",
  encumbranceStatus: "PLEDGED_TO_MITHQAL",
  allocationStatus: "UNALLOCATED",
  utilizedAmount: 0,
  availableAmount: 2_522_000,
  evidence: {
    evidenceState: "TESTED",
    attestations: [
      { kind: "smart_contract_proof", attester: "SIMULATED on-chain proof-of-reserves", at: daysAgoIso(2), evidenceHash: "0x" + "f".repeat(64), simulated: true },
      { kind: "off_chain_receipt", attester: "SIMULATED issuer attestation report", at: daysAgoIso(3), evidenceHash: "0x" + "10".repeat(32), simulated: true },
      { kind: "regulator_no_objection", attester: "SIMULATED NYDFS-regulated issuer", at: daysAgoIso(30), evidenceHash: "0x" + "11".repeat(32), simulated: true },
    ],
    lastTransitionAt: REF_TIMESTAMP,
    simulated: true,
  },
  verificationTimestamp: daysAgoIso(2),
  effectiveDate: REF_EFFECTIVE,
  expiry: REF_EXPIRY,
  encumberedAmount: 0,
  allocatedObligationIds: [],
  custodianTier: "TIER2_SPECIALIST_CUSTODIAN",
  jurisdictionRisk: "APPROVED",
  simulated: true,
};

/** Reference cell 4 — US Treasury Bill (3-month). */
export const PBC_REFERENCE_UST: ProtectedBackingCell = {
  backingId: "pbc-ust-001",
  institutionId: "inst-bank-ny-001",
  asset: {
    type: "fiat-sovereign",
    name: "US Treasury Bill (3-month)",
    currency: "USD",
    isin: "US9127973C91", // SIMULATED ISIN
  },
  quantity: 39_000_000,
  valuation: 39_000_000,
  haircut: 0.01,
  legalStatus: "CLEARED",
  custodian: "SIMULATED — regulated US bank custody",
  jurisdiction: "US-NY",
  encumbranceStatus: "PARTIALLY_ENCUMBERED",
  allocationStatus: "UNALLOCATED",
  utilizedAmount: 0,
  availableAmount: 36_610_000,
  evidence: {
    evidenceState: "TESTED",
    attestations: [
      { kind: "custodian_attestation", attester: "SIMULATED bank custody ops", at: daysAgoIso(4), evidenceHash: "0x" + "12".repeat(32), simulated: true },
      { kind: "independent_audit", attester: "SIMULATED custody auditor", at: daysAgoIso(15), evidenceHash: "0x" + "13".repeat(32), simulated: true },
    ],
    lastTransitionAt: REF_TIMESTAMP,
    simulated: true,
  },
  verificationTimestamp: daysAgoIso(4),
  effectiveDate: REF_EFFECTIVE,
  expiry: REF_EXPIRY,
  encumberedAmount: 2_000_000,
  allocatedObligationIds: [],
  custodianTier: "TIER1_REGULATED_BANK",
  jurisdictionRisk: "APPROVED",
  simulated: true,
};

/** All 4 SIMULATED reference cells (none live). */
export const PBC_REFERENCE_CELLS: ProtectedBackingCell[] = [
  PBC_REFERENCE_USD_CASH,
  PBC_REFERENCE_XAU_ALLOCATED,
  PBC_REFERENCE_USDC,
  PBC_REFERENCE_UST,
];

/** Live cell count — currently 0 (per §74 honest state). */
export const protectedBackingLiveCells = 0 as const;

// ----------------------------------------------------------------------------
// §14.11.5 — Aggregated reference state
// ----------------------------------------------------------------------------

export interface ProtectedBackingAggregatedState {
  cellCount: number;
  liveCellCount: number;
  totals: ProtectedBackingEvidencePackage["totals"];
  maxMtqIssuanceUsd: number; // total available / 1.30 (130% strategic RR)
  finalStatus: string;
  finalStatusColor: ProtectedBackingCellStatusColor;
}

export function generateProtectedBackingCellReport(
  cells: ProtectedBackingCell[] = PBC_REFERENCE_CELLS,
): ProtectedBackingAggregatedState {
  const evidence = generateProtectedBackingEvidence(cells);
  const maxMtq = evidence.totals.availableBacking / 1.30;
  return {
    cellCount: cells.length,
    liveCellCount: 0,
    totals: evidence.totals,
    maxMtqIssuanceUsd: round2(maxMtq),
    finalStatus:
      "APPROVED CANDIDATE FOR CONTROLLED TESTING — NOT PRODUCTION-AUTHORIZED " +
      "(model implemented; 0 live cells; all reference cells SIMULATED)",
    finalStatusColor: "amber",
  };
}

// ----------------------------------------------------------------------------
// §47 honest-state invariants (re-exported for cross-module consumption)
// ----------------------------------------------------------------------------

export const PROTECTED_BACKING_HONEST_STATE = protectedBackingHonestState();
