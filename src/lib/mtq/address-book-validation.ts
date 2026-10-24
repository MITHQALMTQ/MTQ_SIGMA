// ============================================================================
// MTQΣ — Task 12 §5 · Address-Book Validation & Deployment Inventory
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// Implements the mandated distinctions WITHOUT ever auto-selecting a canonical
// token generation:
//   • CANONICAL-CANDIDATE   — a deployment proposed as canonical (e.g. by the
//                             owner's "WHAT YOU HAVE NOW" summary) but NOT yet
//                             approved by governance.
//   • CURRENT-UNAPPROVED   — live, wired, but not governance-approved.
//   • SUPERSEDED            — classification reserved for provenance rows.
//                             (2026-10-24 owner-directed registry cleanup: the
//                             superseded-generation rows were REMOVED from the
//                             registry per the owner's explicit "delete what is
//                             not used" instruction; history is preserved in
//                             git + the audit registers, so no row currently
//                             carries this classification.)
//   • DUPLICATE-CONFLICT   — the same deployment hex appearing on multiple
//                             chains or in conflicting roles — requires
//                             per-chain independent verification before the
//                             rows can be treated as distinct verified objects.
//   • UNVERIFIED           — missing address / zero-address placeholders /
//                             missing chainId / unpinned evidence.
//   • APPROVED-CANONICAL    — an explicit governance declaration. NOTHING in
//                             this repository has this status today; it can
//                             only be set by the owner/governance process.
//
// Validation REJECTS (as findings, not as mutations):
//   missing chain IDs · conflicting canonical entries · duplicate deployments
//   presented as authoritative · unsupported network aliases · inconsistent
//   cross-chain mappings. The underlying records in contracts.ts are NEVER
//   deleted or rewritten by this module — findings reflect the registry as
//   it exists. (2026-10-24: the owner explicitly ordered the non-current
//   generations REMOVED from the registry; that disposition was executed in
//   contracts.ts, not by this validator. Task 12 §5's "do not delete
//   conflicting evidence to achieve a green result" still binds THIS module:
//   it deletes nothing and surfaces exactly what the registry contains.)
// ============================================================================

import {
  ALL_CHAINS,
  CANONICAL_MTQ_ADDRESSES,
  type ChainInfo,
} from "./contracts";

// ---------------------------------------------------------------------------
// §1  Classification types
// ---------------------------------------------------------------------------

export type DeploymentClassification =
  | "CANONICAL-CANDIDATE"
  | "CURRENT-UNAPPROVED"
  | "SUPERSEDED"
  | "DUPLICATE-CONFLICT"
  | "UNVERIFIED"
  | "APPROVED-CANONICAL";

export type FindingSeverity = "BLOCKER" | "MAJOR" | "MINOR" | "INFO";

export interface ValidationFinding {
  id: string;
  severity: FindingSeverity;
  rule: string;
  message: string;
  subject?: string;
}

export interface DeploymentClassificationRow {
  chain: string;
  chainId: number | string;
  name: string;
  address: string;
  classification: DeploymentClassification;
  reason: string;
}

export interface AddressBookValidation {
  summary: {
    ok: boolean;
    blockerCount: number;
    majorCount: number;
    candidateCount: number;
    approvedCanonicalCount: number;
    canonicalDecisionPending: boolean;
    note: string;
  };
  findings: ValidationFinding[];
  classifications: DeploymentClassificationRow[];
}

// ---------------------------------------------------------------------------
// §2  Validation rules
// ---------------------------------------------------------------------------

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** Known TESTNET chains by explicit id (the owner's current deployment set). */
const TESTNET_CHAIN_IDS = new Set([10143, 5042002]);

function hexOf(addr: string): string {
  return addr.toLowerCase();
}

/**
 * Build a per-address cross-chain map to detect the same hex deployed on
 * multiple chains or in conflicting roles (Task 10 CORR-2 findings).
 */
function buildAddressIndex(rows: DeploymentClassificationRow[]) {
  const byHex = new Map<string, DeploymentClassificationRow[]>();
  for (const r of rows) {
    if (!r.address || r.address === ZERO_ADDRESS) continue;
    const k = hexOf(r.address);
    const list = byHex.get(k) ?? [];
    list.push(r);
    byHex.set(k, list);
  }
  return byHex;
}

export function validateAddressBook(): AddressBookValidation {
  const findings: ValidationFinding[] = [];
  const classifications: DeploymentClassificationRow[] = [];

  // ---- §2.1 Per-chain structural validation -------------------------------
  for (const chain of ALL_CHAINS as ChainInfo[]) {
    // Missing chainId
    if (chain.chainId === undefined || chain.chainId === null || chain.chainId === "") {
      findings.push({
        id: `AB-chainId-${chain.id}`,
        severity: "BLOCKER",
        rule: "missing-chain-id",
        message: `Chain '${chain.id}' (${chain.label}) has no chainId — all deployments on it are UNVERIFIED.`,
      });
    }

    // Mainnet chains listed while posture is TESTNET-ONLY → deployments forbidden
    const isNumeric = typeof chain.chainId === "number";
    if (isNumeric && !TESTNET_CHAIN_IDS.has(chain.chainId as number)) {
      findings.push({
        id: `AB-testnet-only-${chain.id}`,
        severity: "MAJOR",
        rule: "testnet-only-posture-vs-mainnet-rows",
        message: `Chain '${chain.label}' (id ${chain.chainId}) is a MAINNET network listed in the address book while the posture is TESTNET-ONLY. Any deployment row on it is UNVERIFIED and deployment remains an unauthorized action (Task 12 §10).`,
        subject: chain.id,
      });
    }

    // Zero-address / pending-deploy rows
    for (const c of chain.contracts) {
      if (!c.address || c.address === ZERO_ADDRESS) {
        findings.push({
          id: `AB-zero-${chain.id}-${c.name}`,
          severity: "MAJOR",
          rule: "zero-address-placeholder",
          message: `Chain '${chain.id}': contract '${c.name}' has a zero/empty address (pending deploy) — UNVERIFIED, must never be presented as a deployment.`,
        });
        classifications.push({
          chain: chain.id, chainId: chain.chainId, name: c.name,
          address: c.address || ZERO_ADDRESS, classification: "UNVERIFIED",
          reason: "zero-address / pending-deploy placeholder",
        });
      }
    }
  }

  // ---- §2.2 Canonical-candidate map validation -----------------------------
  const canonicalEntries = Object.entries(CANONICAL_MTQ_ADDRESSES);
  for (const [slug, entry] of canonicalEntries) {
    if (!entry.address) {
      findings.push({
        id: `AB-canonical-missing-${slug}`,
        severity: "MAJOR",
        rule: "canonical-entry-missing-address",
        message: `CANONICAL_MTQ_ADDRESSES['${slug}'] has no address — treated as UNVERIFIED.`,
      });
    }
    // Conflicting duplicate canonical rows (two candidates on the same chain)
    const sameChain = canonicalEntries.filter(
      ([, e]) => e.chainId === entry.chainId && e.address !== entry.address,
    );
    if (sameChain.length > 0) {
      findings.push({
        id: `AB-canonical-conflict-${slug}`,
        severity: "BLOCKER",
        rule: "conflicting-canonical-entries",
        message: `Chain ${entry.chain} (id ${entry.chainId}) has MULTIPLE canonical candidates (${entry.address} and ${sameChain.map(([, e]) => e.address).join(", ")}) — duplicate deployments presented as authoritative; governance must resolve (no auto-selection).`,
      });
    }
    classifications.push({
      chain: slug, chainId: entry.chainId, name: entry.name,
      address: entry.address,
      classification: "CANONICAL-CANDIDATE",
      reason: "owner-declared current generation (Task 10 'WHAT YOU HAVE NOW'); NOT governance-approved; canonical selection is reserved to humans",
    });
  }

  // ---- §2.3 `canonical: true` flags in the per-chain tables ---------------
  for (const chain of ALL_CHAINS as ChainInfo[]) {
    for (const c of chain.contracts) {
      if (c.canonical === true) {
        findings.push({
          id: `AB-canonical-flag-${chain.id}-${c.name}`,
          severity: "MAJOR",
          rule: "explicit-canonical-flag-without-governance-approval",
          message: `Chain '${chain.id}': contract '${c.name}' (${c.address}) carries an explicit canonical=true flag, but NO governance approval of canonical selection exists. Recorded as a CANDIDATE ONLY — the flag must not be treated as approval (Task 12 §5: do not automatically select a canonical token generation).`,
        });
      }
    }
  }

  // ---- §2.4 Superseded generations -----------------------------------------
  // 2026-10-24 owner-directed cleanup: the superseded-generation rows were
  // REMOVED from the registry (contracts.ts) per the owner's explicit
  // "delete what is not used" instruction, so no SUPERSEDED rows are
  // classified here anymore. The classification type is retained for
  // interface stability; the historical evidence lives in git history and
  // the audit registers (task9-audit / task10-containment /
  // mandate-register / evidence_package).

  // ---- §2.5 Cross-chain hex reuse (duplicate/conflict detection) -----------
  const allRows: DeploymentClassificationRow[] = [];
  for (const chain of ALL_CHAINS as ChainInfo[]) {
    for (const c of chain.contracts) {
      allRows.push({
        chain: chain.id, chainId: chain.chainId, name: c.name,
        address: c.address,
        classification: "CURRENT-UNAPPROVED",
        reason: "live deployment listed in the registry; contract source/build identity UNVERIFIED until reconciled to compiler settings + source (Task 12 §5)",
      });
    }
  }
  const byHex = buildAddressIndex(allRows);
  for (const [hex, rows] of byHex) {
    if (rows.length < 2) continue;
    const chainsDesc = rows.map(r => `${r.chain}:'${r.name}'`).join(" + ");
    // Same-hex deployments across chains are legitimate (same-nonce EOA deploy)
    // but each is a distinct contract requiring per-chain verification; and
    // role conflicts (e.g. one row named Takaful, another Reserve) are
    // recorded as conflicts, never silently merged.
    const names = new Set(rows.map(r => r.name));
    findings.push({
      id: `AB-hex-reuse-${hex.slice(0, 10)}`,
      severity: names.size > 1 ? "BLOCKER" : "MAJOR",
      rule: "cross-chain-hex-reuse",
      message:
        `Deployment hex 0x${hex.slice(0, 8)}… appears on MULTIPLE chains/rows: ${chainsDesc}. ` +
        (names.size > 1
          ? "The SAME hex carries DIFFERENT roles/names across chains — an address-book conflict that must be resolved per-chain by independent verification (evidence preserved on all sides; nothing auto-merged)."
          : "Same-nonce EOA deployment reuse — each row must still be verified per chain before being treated as authoritative."),
    });
    for (const r of rows) {
      classifications.push({
        ...r,
        classification: "DUPLICATE-CONFLICT",
        reason: `hex reused across ${rows.length} rows (${chainsDesc}) — per-chain verification required before authoritative use`,
      });
    }
  }

  // De-duplicate classifications (a row may have been pushed twice)
  const seen = new Set<string>();
  const deduped = classifications.filter(r => {
    const k = `${r.chain}|${r.address}|${r.name}|${r.classification}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const blockers = findings.filter(f => f.severity === "BLOCKER").length;
  const majors = findings.filter(f => f.severity === "MAJOR").length;
  const approvedCanonical = deduped.filter(r => r.classification === "APPROVED-CANONICAL").length;
  const candidates = deduped.filter(r => r.classification === "CANONICAL-CANDIDATE").length;

  return {
    summary: {
      // Post-cleanup (2026-10-24): the BLOCKER-class contamination rows
      // (Robinhood hex collisions) were removed from the registry by the
      // owner's explicit instruction, so ok=true is now the honest state;
      // the remaining MAJOR findings (Governance/Safe same-hex on
      // Monad+Arc) still require per-chain verification, and canonical
      // approval remains pending.
      ok: blockers === 0,
      blockerCount: blockers,
      majorCount: majors,
      candidateCount: candidates,
      approvedCanonicalCount: approvedCanonical,
      canonicalDecisionPending: approvedCanonical === 0,
      note:
        "NO canonical generation is selected by this validator. Candidates exist; governance approval is pending. " +
        "Findings reflect the registry as it exists: the 2026-10-24 owner-directed cleanup removed the " +
        "non-current generations (Robinhood chain, Base/Arbitrum placeholders, superseded map) from the registry " +
        "itself — an owner decision, not a validator mutation. The remaining findings (cross-chain same-hex rows " +
        "for Governance + Safe on Monad/Arc) are surfaced, not merged; per-chain verification remains required " +
        "before any row is treated as authoritative, and canonical selection is reserved to humans.",
    },
    findings,
    classifications: deduped,
  };
}
