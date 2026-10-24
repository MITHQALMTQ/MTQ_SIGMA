/// <reference types="bun-types" />
// ============================================================================
// MTQΣ — Task 12 · Address-Book Validation tests
// ============================================================================
// UPDATED 2026-10-24 (owner-directed registry cleanup): the owner ordered the
// non-current contract generations REMOVED from the registry ("check all
// contracts… delete what is not used, keep what is being used") — Robinhood
// Chain (46630), the Base/Arbitrum pending-deploy placeholders, the superseded
// canonical map and the MTQSigmaV2 status blob are gone from contracts.ts.
// These tests assert the POST-CLEANUP invariants: the registry is exactly the
// owner's "WHAT YOU HAVE NOW" set (Monad 9 + Arc 9 + Solana 1), the remaining
// cross-chain same-hex rows (Governance + Safe on Monad/Arc) are still
// surfaced as findings, and no auto-selection of a canonical generation
// happens in code. The pre-cleanup assertions (Robinhood contamination
// blockers, Base/Arbitrum placeholder findings, superseded-map retention)
// documented the pre-cleanup registry and were retired WITH the rows — the
// owner's deletion order, recorded in the worklog, is the authority for both.
// ============================================================================

import { describe, expect, test } from "bun:test";
import { validateAddressBook } from "@/lib/mtq/address-book-validation";
import { ALL_CHAINS, CANONICAL_MTQ_ADDRESSES } from "@/lib/mtq/contracts";

describe("address-book validation — post-cleanup registry shape (owner-directed)", () => {
  const v = validateAddressBook();

  test("the registry contains EXACTLY the owner's current set: 3 networks, 19 entries", () => {
    expect(ALL_CHAINS.length).toBe(3);
    expect(ALL_CHAINS.map((c) => c.id).sort()).toEqual(["arc", "monad", "solana"]);
    expect(ALL_CHAINS.reduce((a, c) => a + c.contracts.length, 0)).toBe(19);
    // 9 contracts on each EVM chain, 1 SPL mint on Solana.
    expect(ALL_CHAINS.find((c) => c.id === "monad")!.contracts.length).toBe(9);
    expect(ALL_CHAINS.find((c) => c.id === "arc")!.contracts.length).toBe(9);
    expect(ALL_CHAINS.find((c) => c.id === "solana")!.contracts.length).toBe(1);
  });

  test("the removed chains/generations are gone (Robinhood, Base, Arbitrum, superseded, zero-address rows)", () => {
    expect(ALL_CHAINS.some((c) => c.id === "robinhood")).toBe(false);
    expect(
      ALL_CHAINS.some((c) => {
        const id = Number(c.chainId);
        return id === 46630 || id === 8453 || id === 42161;
      }),
    ).toBe(false);
    expect(Object.keys(CANONICAL_MTQ_ADDRESSES).sort()).toEqual(["arc", "monad", "solana"]);
    // No zero-address placeholder rows remain anywhere.
    const zero = "0x0000000000000000000000000000000000000000";
    expect(ALL_CHAINS.every((c) => c.contracts.every((e) => e.address && e.address !== zero))).toBe(true);
  });

  test("the blocker-class contamination findings are resolved (ok=true, 0 blockers)", () => {
    // The former BLOCKERs came from the Robinhood hex-collision rows the
    // owner ordered removed; with those rows gone, zero open blockers is the
    // honest state — not a fabricated green.
    expect(v.summary.ok).toBe(true);
    expect(v.summary.blockerCount).toBe(0);
  });

  test("the remaining cross-chain same-hex rows (Governance + Safe on Monad/Arc) are still surfaced", () => {
    const hexFindings = v.findings.filter((f) => f.rule === "cross-chain-hex-reuse");
    expect(hexFindings.length).toBe(2); // governance + safe
    expect(hexFindings.every((f) => f.severity === "MAJOR")).toBe(true);
    const gov = hexFindings.find((f) => f.message.toLowerCase().includes("governance"));
    const safe = hexFindings.find((f) => f.message.toLowerCase().includes("safe"));
    expect(gov).toBeDefined();
    expect(safe).toBeDefined();
    expect(gov!.message.includes("monad") && gov!.message.includes("arc")).toBe(true);
    expect(safe!.message.includes("monad") && safe!.message.includes("arc")).toBe(true);
  });

  test("duplicate-conflict rows keep per-chain evidence (nothing auto-merged)", () => {
    const dupes = v.classifications.filter((c) => c.classification === "DUPLICATE-CONFLICT");
    expect(dupes.length).toBe(4); // governance×2 + safe×2 across Monad/Arc
    expect(dupes.every((d) => d.reason.includes("per-chain verification required"))).toBe(true);
  });
});

describe("address-book validation — no auto-selection (unchanged discipline)", () => {
  const v = validateAddressBook();

  test("NO deployment is classified APPROVED-CANONICAL", () => {
    expect(v.summary.approvedCanonicalCount).toBe(0);
    expect(v.summary.canonicalDecisionPending).toBe(true);
  });

  test("the three canonical candidates are classified as CANDIDATES with explicit non-approval reasoning", () => {
    const candidates = v.classifications.filter((c) => c.classification === "CANONICAL-CANDIDATE");
    expect(candidates.length).toBe(3); // monad, arc, solana
    expect(candidates.every((c) => c.reason.includes("NOT governance-approved"))).toBe(true);
  });

  test("the summary states the canonical decision is reserved to humans and the cleanup was an owner decision", () => {
    expect(v.summary.note.includes("NO canonical generation is selected")).toBe(true);
    expect(v.summary.note.includes("reserved to humans")).toBe(true);
    expect(v.summary.note.includes("owner-directed cleanup")).toBe(true);
  });
});
