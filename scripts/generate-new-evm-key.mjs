#!/usr/bin/env node
// ============================================================================
// MTQΣ — Fresh EVM keypair generator (Task 12 §2.1 hardening)
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// HARDENED per Task 12 §2.1 ("Ensure output … cannot accidentally print secret
// values"): the ORIGINAL version of this script printed the new private key
// AND mnemonic to stdout — exactly the disclosure class that caused incident
// PI-3 (argv/transcript emission). This version:
//
//   • NEVER prints secrets to stdout/stderr (no transcript emission path).
//   • Writes the keypair to a file with 0600 permissions in the CURRENT
//     directory, whose name is printed (the NAME is not a secret).
//   • Refuses to run unless an explicit human acknowledgement flag is set
//     ("I-understand-this-prints-to-a-local-file-only") — a soft guard
//     against casual/AI-context execution.
//   • Still must be run OWNER-SIDE. An exposed key stays compromised no matter
//     where it is stored; generating a NEW key is only useful as part of the
//     approved rotation (audit-work/task12/D4-EVM-AUTHORITY-MIGRATION-PACKAGE.md).
//
// RUN (owner-side):
//   node generate-new-evm-key.mjs --ack-I-understand-this-prints-to-a-local-file-only
// ============================================================================

import { ethers } from "ethers";
import { writeFileSync, chmodSync, unlinkSync, existsSync } from "node:fs";

const ACK = "--ack-I-understand-this-prints-to-a-local-file-only";
if (!process.argv.includes(ACK)) {
  console.error("Refusing to run without the explicit acknowledgement flag:");
  console.error(`  node generate-new-evm-key.mjs ${ACK}`);
  console.error("This tool writes a NEW keypair to a local 0600 file and never prints secrets.");
  console.error("Owner-side use only. Rotation procedure: audit-work/task12/D4-EVM-AUTHORITY-MIGRATION-PACKAGE.md");
  process.exit(1);
}

const w = ethers.Wallet.createRandom();
const OUT = ".fresh-evm-keypair-DO-NOT-COMMIT.txt";

if (existsSync(OUT)) {
  console.error(`Refusing to overwrite existing ${OUT} — move or delete it first (never paste its contents anywhere).`);
  process.exit(1);
}

// Write with 0600 perms. Address (public) also included for bookkeeping.
writeFileSync(OUT, [
  `MTQΣ fresh EVM keypair — generated ${new Date().toISOString()}`,
  `Address (PUBLIC): ${w.address}`,
  `PrivateKey: ${w.privateKey}`,
  w.mnemonic ? `Mnemonic: ${w.mnemonic.phrase}` : "",
  ``,
  `STORE SECURELY (hardware wallet or password manager). Do NOT paste in chat,`,
  `do NOT commit, do NOT add to .env files shared with tools. This file is`,
  `already gitignored by name; delete it after secure storage.`,
  ``,
].join("\n"), { mode: 0o600 });
chmodSync(OUT, 0o600);

console.log("Fresh keypair generated.");
console.log(`  Address (public): ${w.address}`);
console.log(`  Secrets written to: ${OUT} (mode 0600) — NOT printed here by design.`);
console.log("Next steps (owner-side, per the migration package):");
console.log("  1. Store the key securely; delete the file.");
console.log("  2. Fund the address on the target testnet faucet.");
console.log("  3. Use it ONLY inside the approved rotation sequence");
console.log("     (audit-work/task12/D4-EVM-AUTHORITY-MIGRATION-PACKAGE.md — never inside");
console.log("      this repository or any AI environment).");
