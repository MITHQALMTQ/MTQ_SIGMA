// ============================================================================
// MTQΣ — RETIRED SCRIPT (fail-closed) — see task12 §2.1 / D5
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// THIS SCRIPT IS RETIRED AND DOES NOT EXECUTE ANYTHING.
//
// WHAT IT USED TO DO (historical record; original preserved in git history):
//   Created an MTQ SPL mint + Metaplex metadata (name/symbol/URI) on Solana
//   devnet using the 4saT…cA1d wallet as payer/mint authority/update
//   authority. The C-045-b secret-key literal (fingerprint 58c19e…eb60) was
//   embedded in this file — REDACTED 2026-10-23 by Task 12 K-1.
//
// WHY IT IS RETIRED: same as solana-create-umi.ts — compromised key + a
// blocked new-mint deployment action.
//
// REQUIRED PATH FOR ANY FUTURE EXECUTION:
//   audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md →
//   D8-OWNER-APPROVAL-CHECKLIST.md → new owner-side tooling with a NEWLY
//   generated key in a human-controlled environment.
// ============================================================================

console.error("REFUSING TO RUN — RETIRED SCRIPT (Task 12 K-1 containment):");
console.error("  • embedded a COMPROMISED key (C-045-b, 4saT…cA1d)");
console.error("  • new-mint deployment is a blocked action pending owner approval");
console.error("  See audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md");
process.exit(1);
