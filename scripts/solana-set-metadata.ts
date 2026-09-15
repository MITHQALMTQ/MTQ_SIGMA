// MTQΣ — Set Metaplex metadata for the freshly created Solana mint using raw
// createMetadataAccountV3 instruction (no UMI serializer dependency).
import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { createMetadataAccountV3Instruction } from "@metaplex-foundation/mpl-token-metadata";
import bs58 from "bs58";

const HEX = "58c19e10d4eba7e9d1b467b2288c156c3aac5e9e056c800c9b9b84545db8eb973987ef1837281dccd848a4d5b25ee8b37e280e563882ec968a327516141aeb60";
const NEW_MINT = new PublicKey("2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY");
const METAPLEX_PID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const kp = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(HEX, "hex")));
console.log("Wallet:", kp.publicKey.toBase58());

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const [metaPDA] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), METAPLEX_PID.toBuffer(), NEW_MINT.toBuffer()], METAPLEX_PID);
const existing = await conn.getAccountInfo(metaPDA);
console.log("Metadata PDA:", metaPDA.toBase58(), existing ? "(EXISTS)" : "(NONE — will create)");

// Build the instruction using the mpl-token-metadata instruction factory with a minimal context.
// The function expects a Kinobi context. Let's construct a minimal one.
// Actually, createMetadataAccountV3Instruction from mpl-token-metadata v3+ returns an
// Instruction object (not a TransactionInstruction). Let me build the raw instruction manually.

// createMetadataAccountV3 discriminator = 33 (u8)
// Data layout:
//   u8 discriminator (33)
//   DataV2:
//     string name (4-byte LE length + utf8 bytes, padded to 32-byte aligned? No — Metaplex uses Borsh string)
//     string symbol
//     string uri
//     u16 sellerFeeBasisPoints
//     option<vec<Creator>> creators (0 = none, 1 = present + vec)
//     option<bool> collection (0/1)
//     option<Uses> uses (0/1)
//   bool isMutable
//   option<CollectionDetails> collectionDetails (0/1)

// Borsh string = u32 LE length + utf8 bytes (no padding)
function borshString(s: string): Buffer {
  const b = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length, 0);
  return Buffer.concat([len, b]);
}

const NAME = "MTQΣ";
const SYMBOL = "MTQ";
const URI = "https://mtqs-pilot.local/brand/mtqs-metadata.json";

const dataV2 = Buffer.concat([
  borshString(NAME),
  borshString(SYMBOL),
  borshString(URI),
  Buffer.from([0, 0]), // sellerFeeBasisPoints u16 = 0
  Buffer.from([1]),    // creators: option = Some(1)
  Buffer.from([1, 0, 0, 0]), // vec length = 1 (u32 LE)
  kp.publicKey.toBuffer(), // creator address (32 bytes)
  Buffer.from([0]),    // verified = false
  Buffer.from([100, 0]), // share u8 = 100
  Buffer.from([0]),    // collection: None
  Buffer.from([0]),    // uses: None
]);

const data = Buffer.concat([
  Buffer.from([33]), // discriminator u8 = 33
  dataV2,
  Buffer.from([1]),  // isMutable = true
  Buffer.from([0]),  // collectionDetails: None
]);

const keys = [
  { pubkey: metaPDA, isSigner: false, isWritable: true },
  { pubkey: NEW_MINT, isSigner: false, isWritable: false },
  { pubkey: kp.publicKey, isSigner: true, isWritable: false }, // mint authority (signs)
  { pubkey: kp.publicKey, isSigner: true, isWritable: true },  // payer (signs)
  { pubkey: kp.publicKey, isSigner: false, isWritable: false }, // update authority
  { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
];

import { TransactionInstruction } from "@solana/web3.js";
const ix = new TransactionInstruction({ programId: METAPLEX_PID, keys, data });

const tx = new Transaction().add(ix);
const { blockhash } = await conn.getLatestBlockhash();
tx.recentBlockhash = blockhash;
tx.feePayer = kp.publicKey;

console.log("\nSending createMetadataAccountV3...");
try {
  const sig = await sendAndConfirmTransaction(conn, tx, [kp], { commitment: "confirmed" });
  console.log("✓ tx:", sig);
  console.log("  View: https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
} catch (e: any) {
  console.error("FAILED:", e.message?.slice(0, 300));
  // logs often contain the program error
  if (e.logs) { console.error("LOGS:", e.logs.slice(-5)); }
  process.exit(2);
}

// Read-back
const metaAcct = await conn.getAccountInfo(metaPDA);
if (metaAcct) {
  const d = metaAcct.data;
  const nameLen = d.readUInt32LE(65);
  const name = d.slice(69, 69 + nameLen).toString("utf8").replace(/\u0000+$/, "");
  console.log("\n=== READ-BACK ===");
  console.log("  metadata PDA:", metaPDA.toBase58(), "(", metaAcct.data.length, "bytes)");
  console.log("  parsed name:", JSON.stringify(name), "(has Σ:", name.includes("Σ"), ")");
  const symLen = d.readUInt32LE(69 + nameLen);
  const sym = d.slice(73 + nameLen, 73 + nameLen + symLen).toString("utf8").replace(/\u0000+$/, "");
  console.log("  parsed symbol:", JSON.stringify(sym));
}
