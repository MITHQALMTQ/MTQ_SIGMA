// Verify the relationship between the pasted key and the MTQ mint authority.
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import bs58 from "bs58";

const MINT = new PublicKey("GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4");
const STATED_AUTH = "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3";

const SEED_B58 = "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d";
const FULL_KEY_B58 = "2mvVkN5N9PTjTMq7vFdsmFD5ztbCHZRMKk1r2f9yAHbEN7UXsmEsBEB8q56d6Hc85KRsrej4M59jmb5nSWzFj13V";

console.log("=== VERIFYING THE RELATIONSHIP ===\n");

// 1. The FULL secret key from the previous message (88 base58 chars → 64 bytes)
const fullBytes = bs58.decode(FULL_KEY_B58);
console.log("Full secret key from previous message:");
console.log("  decoded length:", fullBytes.length, "bytes");
const kpFull = Keypair.fromSecretKey(fullBytes);
console.log("  → public key:", kpFull.publicKey.toBase58());

// 2. Using the seed (as the user's new code does)
const seed = bs58.decode(SEED_B58);  // 32 bytes
console.log("\nUsing the 32-byte seed via Keypair.fromSeed():");
console.log("  seed decoded length:", seed.length, "bytes");
const kpSeed = Keypair.fromSeed(seed);
console.log("  → public key:", kpSeed.publicKey.toBase58());

// 3. Are they the same?
console.log("\nMatch? full-secret-key == from-seed?", kpFull.publicKey.equals(kpSeed.publicKey) ? "YES ✓" : "NO ✗ (different keypairs)");

// 4. Check the seed pubkey against the MTQ mint authority
console.log("\nDoes the fromSeed public key (7poG...) match the MTQ mint authority (DbFjz...)?", kpSeed.publicKey.toBase58() === STATED_AUTH ? "YES ✓" : "NO ✗");

// 5. Verify what the ACTUAL on-chain mint authority is right now
console.log("\n=== ON-CHAIN CHECK ===");
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const mintAcct = await conn.getParsedAccountInfo(MINT);
const info: any = (mintAcct.value as any)?.data?.parsed?.info;
console.log("Mint:", MINT.toBase58());
console.log("  on-chain mintAuthority:", info?.mintAuthority);
console.log("  matches the fromSeed pubkey 7poG...?", info?.mintAuthority === kpSeed.publicKey.toBase58() ? "YES ✓✓ — this key CAN set the metadata" : "NO ✗");

// 6. Check the SOL balance of the fromSeed key
const bal = await conn.getBalance(kpSeed.publicKey);
console.log("\nSOL balance of the fromSeed pubkey:", bal / 1e9, "SOL");

// 7. HONEST EXPLANATION
console.log("\n=== HONEST EXPLANATION ===");
console.log("The 88-char base58 string '2mvV...' is a FULL Solana secret key (64 bytes: 32-byte seed + 32-byte pubkey).");
console.log("Its derived public key is:", kpFull.publicKey.toBase58());
console.log("The user's new code takes the 44-char address '4saT...' (which is itself a public key) and uses it as a SEED (32 bytes) for Keypair.fromSeed().");
console.log("This produces a DIFFERENT keypair with public key:", kpSeed.publicKey.toBase58());
console.log("NEITHER of these keypairs is the MTQ mint authority (DbFjz...hXb3).");
console.log("To set the MTQ Metaplex metadata, we need the secret key that derives DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3.");
