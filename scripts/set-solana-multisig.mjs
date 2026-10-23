#!/usr/bin/env node
// ============================================================================
// MTQΣ — RETIRED SCRIPT (fail-closed) — Task 12 §2.1 / §4
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// THIS SCRIPT IS RETIRED AND DOES NOT EXECUTE ANYTHING.
//
// WHAT IT USED TO DO (historical record; original preserved in git history):
//   Loaded the DbFjz…QhXb3 (current Solana mint authority) secret key from the
//   SOL_SECRET_KEY env var, created a Squads 2-of-3 multisig via the
//   @sqds/multisig SDK, and transferred the GAGRdrY6… mint authority to it.
//
// WHY IT IS RETIRED (audit-work/task11/D4-SOLANA-AUTHORITY-PLAN.md §3 + Task 12 §4):
//   1. SQUADS PROGRAM IDENTITY IS UNVERIFIED — the candidate program ID
//      (SMPLecH531NA7dL1u4Yb2uJkg7who9g2mFxpM18i4rL) probed NULL on both
//      devnet and mainnet in Task 11. Nothing is asserted. Any multisig work
//      must first take the program ID + version from OFFICIAL Squads
//      documentation and verify it live on devnet (owner-side; CKPT-8).
//   2. DbFjz KEY CUSTODY IS UNVERIFIED (CKPT-2) — this script was an
//      AI-accessible signing workflow for an authority account; per Task 12
//      §2.1 no such workflow may be provided.
//   3. SetAuthority on the current mint is a BLOCKED action (Task 12 §4:
//      "Any … Solana authority modification" stops for explicit owner
//      approval), gated on SOL-DEC-1 disposition.
//
// REQUIRED PATH FOR ANY FUTURE EXECUTION:
//   audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md →
//   D8-OWNER-APPROVAL-CHECKLIST.md → owner-side tooling in a human-controlled
//   environment with an owner-verified program identity.
// ============================================================================

console.error("REFUSING TO RUN — RETIRED SCRIPT (Task 12 containment):");
console.error("  • Squads program identity UNVERIFIED (Task 11 NULL probe; nothing asserted)");
console.error("  • signing workflow for the current mint authority must be owner-side only");
console.error("  • SetAuthority is a blocked action pending SOL-DEC-1 (owner decision)");
console.error("  See audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md");
process.exit(1);
