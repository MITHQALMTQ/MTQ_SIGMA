// ============================================================================
// MTQΣ — RETIRED SCRIPT (fail-closed) — see task12 §2.1 / D5
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// THIS SCRIPT IS RETIRED AND DOES NOT EXECUTE ANYTHING.
//
// WHAT IT USED TO DO (historical record; original preserved in git history):
//   Created a FRESH MTQΣ SPL mint on Solana devnet using the 4saT…cA1d wallet
//   (whose secret key literal, incident C-045-b fingerprint 58c19e…eb60, was
//   embedded in this file — REDACTED 2026-10-23 by Task 12 K-1) as payer,
//   mint authority AND freeze authority, then minted an initial supply of
//   10,000,000,000 MTQ at decimals=18 via Metaplex + @solana/spl-token.
//
// WHY IT MUST NEVER RUN AS WRITTEN (audit-work/task11/D4-SOLANA-AUTHORITY-PLAN.md §2):
//   1. The signing key is the COMPROMISED C-045-b key — any use requires the
//      owner-controlled session described in D4 §4, never this repo/AI env.
//   2. The supply plan (10^10 whole × 10^18 raw = 10^28 raw) is PHYSICALLY
//      UNREPRESENTABLE in SPL Token's u64 supply — mintTo would REVERT on-chain.
//   3. Decimals=18 conflicts with the mandate-scale supply (max ~18.45 whole
//      tokens); any fresh-mint decision requires the ECONOMIC approval of a
//      decimals value ≤ 9 first (Task 11 D4 §2 table; DEC-3) and is blocked
//      pending SOL-DEC-1/S-4 disposition in
//      audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md.
//
// REQUIRED PATH FOR ANY FUTURE EXECUTION:
//   Owner approval (D8-OWNER-APPROVAL-CHECKLIST.md) → economic decimals
//   decision (DEC-3) → new owner-side script using a NEWLY generated key in a
//   human-controlled environment. No AI-accessible signing workflow for the
//   compromised accounts will be provided (Task 12 §2.1).
// ============================================================================

console.error("╔════════════════════════════════════════════════════════════════════╗");
console.error("║  REFUSING TO RUN — RETIRED SCRIPT (Task 12 K-1 containment)          ║");
console.error("╠════════════════════════════════════════════════════════════════════╣");
console.error("║  • embedded a COMPROMISED key (C-045-b, 4saT…cA1d)                  ║");
console.error("║  • 10B×10^18 raw supply is u64-UNREPRESENTABLE (would revert)        ║");
console.error("║  • decimals decision pending economic approval (DEC-3)               ║");
console.error("║  See audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md     ║");
console.error("╚════════════════════════════════════════════════════════════════════╝");
process.exit(1);
