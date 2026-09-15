// MTQΣ — Set Metaplex metadata for the fresh Solana mint using a precise raw
// createMetadataAccountV3 instruction. The mint 2EaK5cQt... already exists
// with 4saT... as mint authority. This sets the display name to "MTQΣ".
//
// createMetadataAccountV3 layout (Metaplex Token Metadata V3):
//   Discriminator: u8 = 33
//   DataV2 (Borsh):
//     name: string (u32 LE len + utf8)
//     symbol: string
//     uri: string
//     sellerFeeBasisPoints: u16 LE
//     creators: Option<vec<Creator>>  — 0 = None, 1 = Some(u32 LE count + array)
//       Creator: { address: [32], verified: bool (1 byte), share: u8 }
//     collection: Option<Collection> — 0 = None, 1 = Some([32] key + bool verified)
//     uses: Option<Uses> — 0 = None, 1 = Some(method u8 + remaining u64 + u64)
//   isMutable: bool (1 byte)
//   collectionDetails: Option<CollectionDetails> — 0 = None, 1 = Some(...)

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, SYSVAR_RENT_PUBKEY, TransactionInstruction } from "@solana/web3.js";

const HEX = "58c19e10d4eba7e9d1b467b2288c156c3aac5e9e056c800c9b9b84545db8eb973987ef1837281dccd848a4d5b25ee8b37e280e563882ec968a327516141aeb60";
const MINT = new PublicKey("2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY");
const METAPLEX_PID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

const kp = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(HEX, "hex")));
console.log("Wallet:", kp.publicKey.toBase58());

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const [metaPDA] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), METAPLEX_PID.toBuffer(), MINT.toBuffer()], METAPLEX_PID);
console.log("Metadata PDA:", metaPDA.toBase58());

const borshString = (s: string): Buffer => {
  const b = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length, 0);
  return Buffer.concat([len, b]);
};

const NAME = "MTQΣ";
const SYMBOL = "MTQ";
const URI = "https://mtqs-pilot.local/brand/mtqs-metadata.json";

const dataV2 = Buffer.concat([
  borshString(NAME),                                // name
  borshString(SYMBOL),                              // symbol
  borshString(URI),                                  // uri
  Buffer.from([0, 0]),                              // sellerFeeBasisPoints u16 LE = 0
  // creators: Option = Some(1) + vec(1) + Creator{ address(32), verified(u8=false=0), share(u8=100) }
  Buffer.from([1]),                                  // Option: Some
  Buffer.from([1, 0, 0, 0]),                          // vec length u32 LE = 1
  kp.publicKey.toBuffer(),                            // creator address (32 bytes)
  Buffer.from([0]),                                  // verified = false
  Buffer.from([100]),                                 // share = 100 (u8)
  Buffer.from([0]),                                  // collection: Option None
  Buffer.from([0]),                                  // uses: Option None
]);

const data = Buffer.concat([
  Buffer.from([33]),  // discriminator u8 = 33
  dataV2,
  Buffer.from([1]),   // isMutable = true
  Buffer.from([0]),   // collectionDetails: Option None
]);

const keys = [
  { pubkey: metaPDA, isSigner: false, isWritable: true },
  { pubkey: MINT, isSigner: false, isWritable: false },
  { pubkey: kp.publicKey, isSigner: true, isWritable: false }, // mint authority (signs)
  { pubkey: kp.publicKey, isSigner: true, isWritable: true },  // payer (signs)
  { pubkey: kp.publicKey, isSigner: false, isWritable: false }, // update authority
  { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
];

const ix = new TransactionInstruction({ programId: METAPLEX_PID, keys, data });
const tx = new Transaction().add(ix);
const { blockhash } = await conn.getLatestBlockhash();
tx.recentBlockhash = blockhash;
tx.feePayer = kp.publicKey;

console.log("\nSending createMetadataAccountV3 (raw)...");
try {
  const sig = await sendAndConfirmTransaction(conn, tx, [kp], { commitment: "confirmed" });
  console.log("✓ tx:", sig);
  console.log("  View: https://explorer.solana.com/tx/" + sig + "?cluster=devnet");
} catch (e: any) {
  console.error("FAILED:", e.message?.slice(0, 200));
  if (e.logs) console.error("LOGS (last 5):", e.logs.slice(-5));
  process.exit(2);
}

// Read-back
const metaAcct = await conn.getAccountInfo(metaPDA);
if (metaAcct) {
  const d = metaAcct.data;
  const nameLen = d.readUInt32LE(65);
  const name = d.slice(69, 69 + nameLen).toString("utf8").replace(/\u0000+$/, "");
  console.log("\n=== READ-BACK ===");
  console.log("  metadata PDA:", metaPDA.toBase58(), "(", d.length, "bytes)");
  console.log("  parsed name:", JSON.stringify(name), "(has Σ:", name.includes("Σ"), ")");
  const symLen = d.readUInt32LE(69 + nameLen);
  const sym = d.slice(73 + nameLen, 73 + nameLen + symLen).toString("utf8").replace(/\u0000+$/, "");
  console.log("  parsed symbol:", JSON.stringify(sym));
}
