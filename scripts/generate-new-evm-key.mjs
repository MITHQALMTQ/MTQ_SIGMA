#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// MTQΣ — EVM deployer key rotation helper (testnet).
//
// WHY: The current EVM private key (0xdbe17f8d…) has been pasted in chat multiple
// times. Anything sent in chat should be treated as EXPOSED. Before any mainnet
// move, generate a FRESH key, deploy contracts with it, and abandon the old key.
//
// This script:
//   1. Generates a fresh EVM keypair (locally, never sent anywhere).
//   2. Prints the new address + the new private key (for you to store securely).
//   3. Shows the exact steps to fund the new key on each testnet faucet.
//   4. Shows the deploy commands to run with the new key.
//
// RUN THIS LOCALLY:
//   npm i ethers
//   node generate-new-evm-key.mjs
//
// Then:
//   1. Fund the new address on each testnet faucet (Monad/Arc/Robinhood).
//   2. Put the new key in a local .env: DEPLOYER_PRIVATE_KEY=<new key>
//   3. Run: bun run scripts/deploy-ecosystem.ts monad
//          bun run scripts/deploy-ecosystem.ts arc
//          bun run scripts/deploy-ecosystem.ts robinhood
//   4. Update src/lib/mtq/contracts.ts with the new addresses.
//   5. Destroy the old key. Move any tokens on the old address to the new one.
// ─────────────────────────────────────────────────────────────────────────────

import { ethers } from "ethers";

console.log("=== MTQΣ — EVM KEY ROTATION (testnet) ===\n");

// Generate a fresh keypair
const newWallet = ethers.Wallet.createRandom();
console.log("NEW EVM keypair generated (locally — never sent anywhere):");
console.log("  Address:     ", newWallet.address);
console.log("  Private key: ", newWallet.privateKey);
console.log("  Mnemonic:    ", newWallet.mnemonic?.phrase);
console.log("\n⚠️  STORE THESE SECURELY. Do NOT paste in chat. Do NOT commit to git.");
console.log("    Put the private key in a local .env file with restricted permissions.");

console.log("\n=== NEXT STEPS ===");
console.log("1. Fund the new address on each testnet:");
console.log("   • Monad Testnet faucet:    https://faucet.monad.xyz (or the official Monad testnet faucet)");
console.log("   • Arc Testnet faucet:      https://faucet.testnet.arc.io");
console.log("   • Robinhood Testnet faucet: https://faucet.testnet.chain.robinhood.com (if available)");
console.log("");
console.log("2. Put the new key in a local .env:");
console.log("   DEPLOYER_PRIVATE_KEY=<paste the new private key here>");
console.log("");
console.log("3. Deploy the full ecosystem to each chain:");
console.log("   bun run scripts/deploy-ecosystem.ts monad");
console.log("   bun run scripts/deploy-ecosystem.ts arc");
console.log("   bun run scripts/deploy-ecosystem.ts robinhood");
console.log("");
console.log("4. Update src/lib/mtq/contracts.ts with the new addresses from each deployment.");
console.log("");
console.log("5. Destroy the OLD key (0xdbe17f8d…). Move any tokens on the old address to the new one first.");
console.log("");
console.log("=== WHY ===");
console.log("The old key was transmitted via chat multiple times. In security best practice,");
console.log("any key transmitted over a communication channel must be treated as compromised.");
console.log("Rotating before mainnet is mandatory; doing it now on testnet costs nothing and");
console.log("builds the habit. DO NOT reuse the old key for mainnet.");
