// Verify the hex key against the 4saT... wallet and check on-chain state.
import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import bs58 from "bs58";

const HEX = "58c19e10d4eba7e9d1b467b2288c156c3aac5e9e056c800c9b9b84545db8eb973987ef1837281dccd848a4d5b25ee8b37e280e563882ec968a327516141aeb60";
const MINT = new PublicKey("GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4");
const STATED_WALLET = "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d";
const STATED_AUTH = "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3";

console.log("=== HEX KEY VERIFICATION ===");
console.log("Hex length:", HEX.length, "chars →", HEX.length / 2, "bytes");

// Try a few interpretations
const hexBytes = Buffer.from(HEX, "hex");
console.log("Decoded bytes:", hexBytes.length);

// 1. If 64 bytes → full secret key (32-byte seed + 32-byte pubkey)
if (hexBytes.length === 64) {
  console.log("\n1) As full 64-byte secret key:");
  try {
    const kp1 = Keypair.fromSecretKey(Uint8Array.from(hexBytes));
    console.log("   → public key:", kp1.publicKey.toBase58());
    console.log("   matches 4saT...?", kp1.publicKey.toBase58() === STATED_WALLET ? "YES ✓" : "NO");
    console.log("   matches DbFjz... (mint authority)?", kp1.publicKey.toBase58() === STATED_AUTH ? "YES ✓✓" : "NO ✗");
  } catch (e: any) { console.log("   fromSecretKey failed:", e.message?.slice(0, 80)); }
}

// 2. If 32 bytes → use as seed
if (hexBytes.length === 32) {
  console.log("\n2) As 32-byte seed:");
  const kp2 = Keypair.fromSeed(Uint8Array.from(hexBytes));
  console.log("   → public key:", kp2.publicKey.toBase58());
}

// 3. The hex is 128 chars = 64 bytes. Split into two 32-byte halves:
//    first 32 = seed, last 32 = pubkey (Solana keypair JSON format)
if (hexBytes.length === 64) {
  console.log("\n3) Split: first 32 bytes (seed) + last 32 bytes (pubkey):");
  const seed = hexBytes.slice(0, 32);
  const pubpart = hexBytes.slice(32, 64);
  console.log("   seed pubkey via fromSeed:", Keypair.fromSeed(Uint8Array.from(seed)).publicKey.toBase58());
  console.log("   last-32-bytes as pubkey:", new PublicKey(Uint8Array.from(pubpart)).toBase58());
  console.log("   last-32 matches 4saT...?", new PublicKey(Uint8Array.from(pubpart)).toBase58() === STATED_WALLET ? "YES ✓" : "NO");
  console.log("   last-32 matches DbFjz...?", new PublicKey(Uint8Array.from(pubpart)).toBase58() === STATED_AUTH ? "YES ✓✓" : "NO ✗");
}

// 4. Convert the hex key to base58 (some tools export Solana keys as base58 not hex)
if (hexBytes.length === 64) {
  console.log("\n4) The 64 bytes as base58:", bs58.encode(hexBytes));
  console.log("   (compare to the earlier '2mvV...' key)");
}

// 5. ON-CHAIN CHECK — what is the actual mintAuthority + balance?
console.log("\n=== ON-CHAIN STATE ===");
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const mintAcct = await conn.getParsedAccountInfo(MINT);
const info: any = (mintAcct.value as any)?.data?.parsed?.info;
console.log("MTQ mint:", MINT.toBase58());
console.log("  on-chain mintAuthority:", info?.mintAuthority);
console.log("  freezeAuthority:", info?.freezeAuthority);
console.log("  decimals:", info?.decimals);
console.log("  supply:", info?.supply);

const bal4saT = await conn.getBalance(new PublicKey(STATED_WALLET));
console.log("\n4saT... SOL balance:", bal4saT / 1e9, "SOL");
const balDbFjz = await conn.getBalance(new PublicKey(STATED_AUTH));
console.log("DbFjz... SOL balance:", balDbFjz / 1e9, "SOL");

// 6. HONEST CONCLUSION
console.log("\n=== HONEST CONCLUSION ===");
const hexKp = hexBytes.length === 64 ? Keypair.fromSecretKey(Uint8Array.from(hexBytes)) : null;
if (hexKp) {
  const derived = hexKp.publicKey.toBase58();
  if (derived === STATED_AUTH) {
    console.log("✓ This hex key IS the MTQ mint authority (DbFjz...hXb3). I can set the metadata.");
  } else if (derived === STATED_WALLET) {
    console.log("This hex key derives 4saT... (which has 5 SOL) — but that is NOT the MTQ mint authority (DbFjz...).");
    console.log("I cannot set the MTQ metadata with this key. The mint authority is a DIFFERENT wallet (DbFjz...).");
  } else {
    console.log("This hex key derives a different wallet entirely:", derived);
  }
}
