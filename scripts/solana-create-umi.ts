// ============================================================================
// MTQΣ — RETIRED SCRIPT (fail-closed) — see task12 §2.1 / D5
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// THIS SCRIPT IS RETIRED AND DOES NOT EXECUTE ANYTHING.
//
// WHAT IT USED TO DO (historical record; original preserved in git history):
//   Created an MTQ SPL mint on Solana devnet via the UMI/Metaplex stack using
//   the 4saT…cA1d wallet as payer/authority. The C-045-b secret-key literal
//   (fingerprint 58c19e…eb60) was embedded in this file — REDACTED 2026-10-23
//   by Task 12 K-1.
//
// WHY IT IS RETIRED:
//   1. The signing key is the COMPROMISED C-045-b key — any use requires the
//      owner-controlled session described in task11 D4 §4, never this repo.
//   2. Creating a new mint is a BLOCKED action (Task 12 §4: no new token
//      deployment without owner + economic approval, incl. the DEC-3
//      decimals decision and SOL-DEC-1 disposition).
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
