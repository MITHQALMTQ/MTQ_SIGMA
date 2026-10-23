import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import bs58 from "bs58";

const RAW = "GM2MK9ZVkwpegY9q9aMatF1BnafV476LZkMwKJAjzhoJ";
console.log("=== SOLANA KEY VERIFICATION ===");
console.log("Length of pasted key:", RAW.length, "characters");

// Decode to see how many bytes
try {
  const bytes = bs58.decode(RAW);
  console.log("Decoded bytes:", bytes.length);
  if (bytes.length === 32) {
    console.log("→ This is a Solana PUBLIC KEY (32 bytes / 44 base58 chars), NOT a secret key.");
    const pub = new PublicKey(bytes);
    console.log("Public key:", pub.toBase58());
    console.log("Matches your stated mint-authority wallet DbFjz...hXb3?", pub.toBase58() === "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3" ? "YES" : "NO — it's a different address");
    console.log("\nA Solana SECRET key is ~88 base58 characters (64 bytes: 32-byte seed + 32-byte pubkey).");
    console.log("You sent a 44-char string = a public key. I cannot sign with a public key.");
  } else if (bytes.length === 64) {
    console.log("→ This IS a Solana SECRET keypair (64 bytes). Loading...");
    const kp = Keypair.fromSecretKey(bytes);
    console.log("Derived public key:", kp.publicKey.toBase58());
  } else {
    console.log("→ Unrecognized byte length — neither a pubkey (32) nor a secret key (64).");
  }
} catch (e: any) {
  console.log("decode failed:", e.message?.slice(0, 80));
}

// Check SOL balance of the pasted address (treating it as a public key)
try {
  const pub = new PublicKey(RAW);
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const bal = await conn.getBalance(pub);
  console.log("\nSOL balance of pasted address:", bal / 1e9, "SOL");
  console.log("Mint authority wallet DbFjz...hXb3 SOL balance:");
  const bal2 = await conn.getBalance(new PublicKey("DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3"));
  console.log("  ", bal2 / 1e9, "SOL");
} catch (e:any) { console.log("balance check failed:", e.message?.slice(0,80)); }
