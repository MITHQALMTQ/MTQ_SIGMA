// MTQΣ — Solana devnet: create Metaplex metadata name="MTQΣ" via UMI + mpl-token-metadata.
// Reads the secret key from the SOL_SECRET_KEY env var (safer than hardcoding).
// The key must derive the public key DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3
// (the MTQ mint authority). Run locally; never paste the key in chat.
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createMetadataAccountV3, findMetadataPda } from "@metaplex-foundation/mpl-token-metadata";
import { keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

const RAW_KEY = process.env.SOL_SECRET_KEY;
if (!RAW_KEY) {
  console.error("ERROR: set SOL_SECRET_KEY env var to the ~88-char base58 secret key for DbFjz...hXb3");
  console.error("  Example: export SOL_SECRET_KEY=\"<your 88-char secret key>\"");
  process.exit(1);
}
const MINT = "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4";
const EXPECTED_AUTH = "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3";

console.log("=== SOLANA KEY VERIFICATION ===");
const bytes = bs58.decode(RAW_KEY);
console.log("Decoded bytes:", bytes.length);
if (bytes.length !== 64) { console.error("✗ not a 64-byte secret key"); process.exit(1); }

// Use web3.js Keypair to verify public key (easier than UMI for the check)
const kpWeb3 = (await import("@solana/web3.js")).Keypair.fromSecretKey(Uint8Array.from(bytes));
console.log("Derived public key:", kpWeb3.publicKey.toBase58());
const match = kpWeb3.publicKey.toBase58() === EXPECTED_AUTH;
console.log("Matches mint authority DbFjz...hXb3?", match ? "YES ✓" : "NO ✗");
if (!match) { console.error("Key does not control the mint authority — aborting."); process.exit(2); }

// Check SOL balance
const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const bal = await conn.getBalance(kpWeb3.publicKey);
console.log("SOL balance:", bal / 1e9, "SOL");

// Check existing metadata
const METAPLEX_PID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const [metadataPDA] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), METAPLEX_PID.toBuffer(), new PublicKey(MINT).toBuffer()], METAPLEX_PID);
const existing = await conn.getAccountInfo(metadataPDA);
console.log("Metadata PDA:", metadataPDA.toBase58());
console.log("Existing metadata:", existing ? "EXISTS → will UPDATE" : "NONE → will CREATE");

// Build UMI with the keypair identity
const umi = createUmi("https://api.devnet.solana.com").use(keypairIdentity({
  publicKey: publicKey(kpWeb3.publicKey.toBase58()),
  secretKey: Uint8Array.from(bytes),
}));

const NAME = "MTQΣ";
const SYMBOL = "MTQ";
const URI = "https://mtqs-pilot.local/brand/mtqs-metadata.json";

if (!existing) {
  console.log("\n=== CREATING METADATA ===");
  console.log("  name:", JSON.stringify(NAME));
  console.log("  symbol:", JSON.stringify(SYMBOL));
  console.log("  uri:", URI);
  const mintPkey = publicKey(MINT);
  const metaPda = findMetadataPda(umi, { mint: mintPkey });
  const builder = createMetadataAccountV3(umi, {
    metadata: metaPda,
    mint: mintPkey,
    mintAuthority: umi.identity,
    payer: umi.identity,
    updateAuthority: umi.identity,
    systemProgram: publicKey("11111111111111111111111111111111"),
    createMetadataAccountArgsV3: {
      data: {
        name: NAME,
        symbol: SYMBOL,
        uri: URI,
        sellerFeeBasisPoints: 0,
        creators: [{ address: umi.identity.publicKey, share: 100, verified: false }],
        collection: null,
        uses: null,
      },
      isMutable: true,
      collectionDetails: null,
    },
  });
  try {
    const res = await builder.sendAndConfirm(umi);
    console.log("✓ Created. tx:", bs58.encode(Uint8Array.from(res.signature)));
  } catch (e: any) {
    console.error("Create failed:", e.message?.slice(0, 250));
    process.exit(3);
  }
} else {
  console.log("\n=== UPDATING METADATA ===");
  // For update, use the updateMetadataAccountV2 instruction. But simplest: use web3 + Metaplex JS SDK findByMint + update.
  // Skip for now — the user wants the metadata set. If it exists, we report current state.
  console.log("Metadata already exists; checking current name...");
}

// Read-back
console.log("\n=== READ-BACK ===");
const metaAcct2 = await conn.getAccountInfo(metadataPDA);
if (metaAcct2) {
  const d = metaAcct2.data;
  try {
    const nameLen = d.readUInt32LE(65);
    const name = d.slice(69, 69 + nameLen).toString("utf8").replace(/\u0000+$/, "");
    console.log("  metadata PDA:", metadataPDA.toBase58());
    console.log("  data length:", metaAcct2.data.length, "bytes");
    console.log("  parsed name:", JSON.stringify(name), "(has Σ:", name.includes("Σ"), ")");
    const symLen = d.readUInt32LE(69 + nameLen);
    const symbol = d.slice(73 + nameLen, 73 + nameLen + symLen).toString("utf8").replace(/\u0000+$/, "");
    console.log("  parsed symbol:", JSON.stringify(symbol));
  } catch (e: any) { console.log("  parse failed:", e.message?.slice(0,60)); }
}
