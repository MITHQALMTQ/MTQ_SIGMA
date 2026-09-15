#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// MTQΣ — Solana devnet: set up a Squads multisig (2-of-3) on the MTQ mint authority.
// RUN THIS LOCALLY — the secret key must never be pasted in chat.
//
// WHY: Currently the MTQ SPL mint has a single-key mintAuthority (DbFjz…hXb3).
// If that one key is lost/compromised, the entire supply is at risk. A Squads
// multisig (2-of-3) means any 2 of 3 designated signers must approve mints/changes.
//
// PREREQUISITES (run on YOUR machine):
//   npm i @solana/web3.js @sqds/multisig @solana/spl-token
//
// INSTRUCTIONS:
//   1. Export SOL_SECRET_KEY (the ~88-char base58 secret for DbFjz…hXb3):
//        export SOL_SECRET_KEY="<your ~88-char base58 secret key>"
//   2. Set the 3 signer addresses (you + 2 trusted co-signers):
//        export SOL_SIGNER_1="<your Solana address>"
//        export SOL_SIGNER_2="<co-signer 1 Solana address>"
//        export SOL_SIGNER_3="<co-signer 2 Solana address>"
//   3. Run:  node set-solana-multisig.mjs
//
// This script:
//   • Creates a Squads multisig (2-of-3 threshold) on devnet
//   • Transfers the MTQ mintAuthority to the multisig
//   • After this, minting requires 2-of-3 multisig approval
// ─────────────────────────────────────────────────────────────────────────────

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { Squads, getTxPda } from "@sqds/multisig";
import { AuthorityType, setAuthority } from "@solana/spl-token";
import bs58 from "bs58";

const MINT = new PublicKey("GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4");
const RPC = "https://api.devnet.solana.com";
const EXPECTED_AUTHORITY = "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3";
const THRESHOLD = 2; // 2-of-3

// Load secret key
const sk = process.env.SOL_SECRET_KEY;
if (!sk) { console.error("ERROR: set SOL_SECRET_KEY env var (~88-char base58 secret)"); process.exit(1); }
const bytes = bs58.decode(sk);
if (bytes.length !== 64) { console.error("SOL_SECRET_KEY must decode to 64 bytes"); process.exit(1); }
const creator = Keypair.fromSecretKey(bytes);
if (creator.publicKey.toBase58() !== EXPECTED_AUTHORITY) {
  console.error(`This keypair is NOT the mint authority ${EXPECTED_AUTHORITY}.`); process.exit(1);
}

const s1 = process.env.SOL_SIGNER_1, s2 = process.env.SOL_SIGNER_2, s3 = process.env.SOL_SIGNER_3;
if (!s1 || !s2 || !s3) { console.error("ERROR: set SOL_SIGNER_1, SOL_SIGNER_2, SOL_SIGNER_3 env vars"); process.exit(1); }

const conn = new Connection(RPC, "confirmed");
console.log("Creating Squads multisig (2-of-3) on Solana devnet...");
console.log("  Creator (current mint authority):", creator.publicKey.toBase58());
console.log("  Signer 1:", s1);
console.log("  Signer 2:", s2);
console.log("  Signer 3:", s3);
console.log("  Threshold:", THRESHOLD, "of 3");

// Create the multisig
const squads = await Squads.create({
  connection: conn,
  creator,
  members: [new PublicKey(s1), new PublicKey(s2), new PublicKey(s3)],
  threshold: THRESHOLD,
});
console.log("\n✓ Squads multisig created:", squads.multisigPda.toBase58());

// Transfer mint authority to the multisig
console.log("\nTransferring MTQ mintAuthority to the multisig...");
const tx = await setAuthority(
  conn,
  creator,           // payer + current authority
  MINT,              // mint
  AuthorityType.MintTokens, // mint authority
  squads.multisigPda, // new authority = multisig
  creator             // current authority
);
console.log("✓ Mint authority transferred to multisig. tx:", tx);
console.log("  View: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");

// Verify
const mintInfo = await conn.getParsedAccountInfo(MINT);
const newAuth = (mintInfo.value as any)?.data?.parsed?.info?.mintAuthority;
console.log("\nNew mintAuthority:", newAuth);
console.log("Matches multisig?", newAuth === squads.multisigPda.toBase58() ? "✓ YES" : "✗ NO");

console.log("\n=== DONE ===");
console.log("Minting MTQ on Solana now requires 2-of-3 multisig approval.");
console.log("Multisig PDA (save this):", squads.multisigPda.toBase58());
