/// <reference types="bun-types" />
// ============================================================================
// MTQΣ — Task 12 · Address-Book Validation tests
// ============================================================================
// Asserts the KNOWN contamination facts from the Task 10/11 audits as durable
// invariants of the validator (they must never silently disappear), plus the
// no-auto-selection and evidence-preservation rules.
// ============================================================================

import { describe, expect, test } from "bun:test";
import { validateAddressBook } from "@/lib/mtq/address-book-validation";
import { SUPERSEDED_CANONICAL_MTQ } from "@/lib/mtq/contracts";

describe("address-book validation — contamination facts are surfaced, not hidden", () => {
  const v = validateAddressBook();

  test("the validator does NOT report a fake-green 'ok'", () => {
    // Known blockers exist (cross-chain hex conflicts) → ok=false is the honest state.
    expect(v.summary.ok).toBe(false);
    expect(v.summary.blockerCount).toBeGreaterThan(0);
  });

  test("RH 'Takaful' hex == Monad 'Reserve' hex is flagged as a BLOCKER conflict", () => {
    const f = v.findings.find(f =>
      f.rule === "cross-chain-hex-reuse" &&
      f.message.includes("1bbcd78e") === false &&
      f.subject === undefined &&
      f.message.toLowerCase().includes("takaful") &&
      f.message.toLowerCase().includes("reserve"),
    );
    expect(f).toBeDefined();
    expect(f!.severity).toBe("BLOCKER");
  });

  test("RH 'MockUSDC' hex == Arc 'Oracle' hex is flagged (conflicting roles across chains)", () => {
    const f = v.findings.find(f =>
      f.rule === "cross-chain-hex-reuse" &&
      f.message.toLowerCase().includes("mockusdc") &&
      f.message.toLowerCase().includes("oracle"),
    );
    expect(f).toBeDefined();
    expect(f!.severity).toBe("BLOCKER");
  });

  test("the shared Safe address on Monad+Arc is surfaced (requires per-chain verification)", () => {
    const f = v.findings.find(f =>
      f.rule === "cross-chain-hex-reuse" &&
      f.message.toLowerCase().includes("safe") &&
      f.message.includes("monad") && f.message.includes("arc"),
    );
    expect(f).toBeDefined();
  });

  test("Governance same-hex different-build on Monad vs Arc is surfaced", () => {
    const f = v.findings.find(f =>
      f.rule === "cross-chain-hex-reuse" &&
      f.message.toLowerCase().includes("governance"),
    );
    expect(f).toBeDefined();
  });

  test("the owner-declared canonical:true flag on Robinhood is flagged as NOT an approval", () => {
    const f = v.findings.find(f => f.rule === "explicit-canonical-flag-without-governance-approval");
    expect(f).toBeDefined();
    expect(f!.message.includes("robinhood")).toBe(true);
  });

  test("mainnet chains (Base/Arbitrum) listed while posture is testnet-only are flagged", () => {
    const fs = v.findings.filter(f => f.rule === "testnet-only-posture-vs-mainnet-rows");
    expect(fs.length).toBeGreaterThanOrEqual(2); // base + arbitrum
  });

  test("zero-address pending-deploy rows are flagged as UNVERIFIED", () => {
    const fs = v.findings.filter(f => f.rule === "zero-address-placeholder");
    expect(fs.length).toBeGreaterThanOrEqual(2); // base + arbitrum MTQΣ pending rows
  });
});

describe("address-book validation — no auto-selection, provenance preserved", () => {
  const v = validateAddressBook();

  test("NO deployment is classified APPROVED-CANONICAL", () => {
    expect(v.summary.approvedCanonicalCount).toBe(0);
    expect(v.summary.canonicalDecisionPending).toBe(true);
  });

  test("canonical candidates are classified as CANDIDATES with explicit non-approval reasoning", () => {
    const candidates = v.classifications.filter(c => c.classification === "CANONICAL-CANDIDATE");
    expect(candidates.length).toBe(4); // monad, arc, robinhood, solana
    expect(candidates.every(c => c.reason.includes("NOT governance-approved"))).toBe(true);
  });

  test("superseded generations are RETAINED (traceability), never deleted", () => {
    const superseded = v.classifications.filter(c => c.classification === "SUPERSEDED");
    expect(superseded.length).toBe(3); // monad 0x0Ac2…, arc 0x2420…, solana 2EaK…
    // And the source data itself is untouched:
    expect(SUPERSEDED_CANONICAL_MTQ.monad).toBe("0x0Ac20360234b4C988a19586CBe55733e18A5982f");
    expect(SUPERSEDED_CANONICAL_MTQ.arc).toBe("0x24203404B9b971C907e8Ced96106Fa74380d9897");
    expect(SUPERSEDED_CANONICAL_MTQ.solana).toBe("2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY");
  });

  test("duplicate-conflict rows keep per-chain evidence (nothing auto-merged)", () => {
    const dupes = v.classifications.filter(c => c.classification === "DUPLICATE-CONFLICT");
    expect(dupes.length).toBeGreaterThanOrEqual(6); // reserve/takaful, oracle/mockusdc, safe×2, governance×2
  });

  test("the summary states the canonical decision is reserved to humans", () => {
    expect(v.summary.note.includes("NO canonical generation is selected")).toBe(true);
    expect(v.summary.note.includes("never deleted")).toBe(true);
  });
});
