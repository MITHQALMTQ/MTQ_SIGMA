// ============================================================================
// MTQΣ — RETIRED SCRIPT (fail-closed) — see task12 §2.1 / D2
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// THIS SCRIPT IS RETIRED AND DOES NOT EXECUTE ANYTHING.
//
// TASK-12 NEW FINDING (recorded in audit-work/task12/D2-SECRET-CONTAINMENT-STATUS.md):
//   This file embedded the compromised Solana 4saT…cA1d secret key (incident
//   C-045-b) in BASE58 form (seed‖pubkey, 88 chars, fingerprint 2mvV…j13V) —
//   a SEVENTH worktree copy that the Task 10/11 census MISSED (its base58
//   sweep reported "none"). It was found by the Task 12 secret scanner and
//   REDACTED 2026-10-23 (embedded-pubkey identification — only the public
//   address 4saT…cA1d was used to identify the material; the secret value was
//   never printed). The original is preserved in git history.
//
// WHY IT IS RETIRED: key-verification requires handling the key — prohibited
//   in this repository/AI environment (Task 12 §2.1). The derivation is
//   already recorded in Task 10/11 evidence. The read-only audit function
//   (mint/wallet state by PUBLIC address) lives in scripts/verify-hex-key.ts
//   (rewritten public-address-based) and the Task 12 fresh probe.
// ============================================================================

console.error("REFUSING TO RUN — RETIRED SCRIPT (Task 12 K-1 containment):");
console.error("  • embedded the COMPROMISED C-045-b key in BASE58 form (2mvV…j13V)");
console.error("  • key verification is retired (no key handling in this repo/AI environment)");
console.error("  See audit-work/task12/D2-SECRET-CONTAINMENT-STATUS.md");
process.exit(1);
