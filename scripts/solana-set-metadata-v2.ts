// ============================================================================
// MTQΣ — RETIRED SCRIPT (fail-closed) — see task12 §2.1 / D5
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// THIS SCRIPT IS RETIRED AND DOES NOT EXECUTE ANYTHING.
//
// WHAT IT USED TO DO (historical record; original preserved in git history):
//   Second-generation metadata setter (UMI/MPL token-metadata) for MTQ SPL
//   mints on Solana devnet, signing with the 4saT…cA1d wallet. The C-045-b
//   secret-key literal (fingerprint 58c19e…eb60) was embedded in this file —
//   REDACTED 2026-10-23 by Task 12 K-1.
//
// WHY IT IS RETIRED: same as solana-set-metadata.ts — the compromised key
//   must never be loaded in this repository/AI environment.
//
// REQUIRED PATH FOR ANY FUTURE EXECUTION:
//   audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md →
//   D8-OWNER-APPROVAL-CHECKLIST.md (SetAuthority steps first; metadata work
//   only with a destination authority that governance has approved).
// ============================================================================

console.error("REFUSING TO RUN — RETIRED SCRIPT (Task 12 K-1 containment):");
console.error("  • embedded a COMPROMISED key (C-045-b, 4saT…cA1d)");
console.error("  • signing with it requires an owner-controlled session (task11 D4 §4)");
console.error("  See audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md");
process.exit(1);
