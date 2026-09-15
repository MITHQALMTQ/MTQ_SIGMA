#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// MTQΣ — Solana devnet: set Metaplex Token Metadata (name="MTQΣ", symbol="MTQ",
// uri=brand emblem). RUN THIS LOCALLY — the secret key must never be pasted in chat.
//
// INSTRUCTIONS (run on YOUR machine, not in the sandbox):
//   1. Install Node 18+ and the deps:  npm i @solana/web3.js @metaplex-foundation/js
//   2. Put your Solana secret key in a local env var (do NOT commit it):
//        # Phantom → Settings → Show Secret Key (a ~88-char base58 string):
//        export SOL_SECRET_KEY="<your ~88-char base58 secret key>"
//        # OR export SOL_KEYPAIR_JSON='[...64-byte array as JSON...]'
//   3. Run:  node set-solana-metadata.mjs
//
// This script:
//   • Loads your Solana keypair from the env var (never logs it).
//   • Connects to Solana devnet.
//   • Uses Metaplex JS SDK to create the Token Metadata for the MTQ mint
//     with name="MTQΣ", symbol="MTQ", uri=<emblem URL or on-chain JSON>.
//   • Prints the transaction signature.
//
// The metadata account costs ~0.003 SOL rent (you have 4.99 SOL — plenty).
// After this, wallets like Phantom and Solana explorers will display "MTQΣ".
// ─────────────────────────────────────────────────────────────────────────────

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Metaplex, keypairIdentity, irysStorage } from "@metaplex-foundation/js";
import bs58 from "bs58";

const MINT = new PublicKey("GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4");
const RPC = "https://api.devnet.solana.com";

// Load secret key from env (NOT hardcoded)
let keypair: Keypair;
if (process.env.SOL_SECRET_KEY) {
  // base58 secret key (~88 chars)
  const bytes = bs58.decode(process.env.SOL_SECRET_KEY);
  if (bytes.length !== 64) { console.error("SOL_SECRET_KEY must decode to 64 bytes (88 base58 chars)"); process.exit(1); }
  keypair = Keypair.fromSecretKey(bytes);
} else if (process.env.SOL_KEYPAIR_JSON) {
  // 64-byte array as JSON
  const arr = JSON.parse(process.env.SOL_KEYPAIR_JSON);
  if (arr.length !== 64) { console.error("SOL_KEYPAIR_JSON must be a 64-byte array"); process.exit(1); }
  keypair = Keypair.fromSecretKey(Uint8Array.from(arr));
} else {
  console.error("ERROR: set SOL_SECRET_KEY or SOL_KEYPAIR_JSON env var first. See script header.");
  process.exit(1);
}

console.log("Loaded Solana keypair. Public key:", keypair.publicKey.toBase58());
const expected = "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3";
if (keypair.publicKey.toBase58() !== expected) {
  console.error(`WARNING: this keypair is NOT the mint authority ${expected}.`);
  console.error("         The metadata create/update will fail unless you are the mint authority.");
  console.error("         Expected:", expected, " Got:", keypair.publicKey.toBase58());
  process.exit(1);
}

const conn = new Connection(RPC, "confirmed");
const mx = Metaplex.make(conn).use(keypairIdentity(keypair)).use(irysStorage());

(async () => {
  console.log("\nCreating/updating Metaplex Token Metadata for mint:", MINT.toBase58());
  // The MTQΣ brand metadata
  const metadata = {
    name: "MTQΣ",
    symbol: "MTQ",
    uri: "https://mtqs-pilot.local/brand/mtqs-metadata.json", // replace with a hosted JSON
    creators: [{ address: keypair.publicKey.toBase58(), share: 100 }],
    sellerFeeBasisPoints: 0,
    isMutable: true,
    collection: null,
    uses: null,
  };

  try {
    const { response } = await mx.nfts().create({
      uri: metadata.uri,
      name: metadata.name,
      symbol: metadata.symbol,
      sellerFeeBasisPoints: metadata.sellerFeeBasisPoints,
      updateAuthority: keypair,
      isMutable: metadata.isMutable,
      tokenStandard: 0, // Fungible
    }, { commitment: "confirmed" });
    console.log("\n✓ Metadata created. Transaction signature:", response.signature);
    console.log("  View: https://explorer.solana.com/tx/" + response.signature + "?cluster=devnet");
  } catch (e: any) {
    // If metadata already exists, try update instead
    if (e.message?.includes("already in use") || e.message?.includes("metadata")) {
      console.log("Metadata already exists; attempting update...");
      const nft = await mx.nfts().findByMint({ mintAddress: MINT });
      const { response } = await mx.nfts().update({
        nftOrSft: nft,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
      }, { commitment: "confirmed" });
      console.log("\n✓ Metadata updated. Transaction signature:", response.signature);
      console.log("  View: https://explorer.solana.com/tx/" + response.signature + "?cluster=devnet");
    } else {
      console.error("FAILED:", e.message || e);
      process.exit(2);
    }
  }
})();

// ── Hosted metadata JSON (host this at the URI above) ─────────────────────────
// Save as mtqs-metadata.json and host on IPFS/Arweave/your domain:
// {
//   "name": "MTQΣ",
//   "symbol": "MTQ",
//   "description": "MTQΣ — The Global Purchasing Power Unit. Closed-loop monetary architecture.",
//   "image": "https://mtqs-pilot.local/brand/mtqs-emblem.png",
//   "decimals": 18,
//   "properties": { "creators": [{ "address": "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3", "share": 100 }] }
// }
