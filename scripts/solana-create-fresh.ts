// MTQΣ — Create a FRESH MTQΣ SPL token on Solana devnet using the 4saT... wallet
// as the mint authority, then set Metaplex metadata name="MTQΣ" + emblem.
// The old GAGRdrY6... mint (controlled by DbFjz...) is deprecated in the registry.
//
// Uses @metaplex-foundation/js createSft: creates mint + metadata in one flow.

import { Metaplex, keypairIdentity, tokenStandard } from "@metaplex-foundation/js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createMint, mintTo, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import bs58 from "bs58";

const HEX = "58c19e10d4eba7e9d1b467b2288c156c3aac5e9e056c800c9b9b84545db8eb973987ef1837281dccd848a4d5b25ee8b37e280e563882ec968a327516141aeb60";
const STATED_WALLET = "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d";

console.log("=== KEY VERIFICATION ===");
const hexBytes = Buffer.from(HEX, "hex");
console.log("Hex bytes:", hexBytes.length);
const kp = Keypair.fromSecretKey(Uint8Array.from(hexBytes));
console.log("Derived public key:", kp.publicKey.toBase58());
console.log("Matches 4saT...?", kp.publicKey.toBase58() === STATED_WALLET ? "YES ✓" : "NO ✗");
if (kp.publicKey.toBase58() !== STATED_WALLET) { console.error("ABORT"); process.exit(1); }

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const bal = await conn.getBalance(kp.publicKey);
console.log("SOL balance:", bal / 1e9, "SOL");

// ── Create a fresh SPL mint (decimals=18), 4saT as mint authority ──
console.log("\n=== CREATING FRESH MTQΣ SPL MINT (decimals=18) ===");
const DECIMALS = 18;
const newMint = await createMint(
  conn,
  kp,           // payer
  kp.publicKey, // mint authority = 4saT
  kp.publicKey, // freeze authority = 4saT
  DECIMALS,
);
console.log("✓ New mint created:", newMint.toBase58());

// ── Create the associated token account + mint the supply (10 billion = 10^10 × 10^18) ──
console.log("\n=== MINTING INITIAL SUPPLY (10,000,000,000 MTQΣ) ===");
const ata = await getOrCreateAssociatedTokenAccount(conn, kp, newMint, kp.publicKey);
console.log("Associated token account:", ata.address.toBase58());

const SUPPLY = 10_000_000_000n * 10n ** BigInt(DECIMALS); // 10 billion
const mintTx = await mintTo(conn, kp, newMint, ata.address, kp, SUPPLY);
console.log("✓ Minted", Number(SUPPLY) / 1e18, "MTQΣ to", kp.publicKey.toBase58(), "(tx", mintTx.slice(0, 16) + "…)");

// ── Create the Metaplex metadata: name="MTQΣ", symbol="MTQ", uri=emblem ──
console.log("\n=== CREATING METAPLEX METADATA (name='MTQΣ') ===");
const mx = Metaplex.make(conn).use(keypairIdentity(kp));

const NAME = "MTQΣ";
const SYMBOL = "MTQ";
const URI = "https://mtqs-pilot.local/brand/mtqs-metadata.json";

try {
  // createSft creates the mint + metadata; but we already have a mint. Use findByMint + update instead.
  // Actually, createSft creates a NEW mint. For an existing mint, we need createMetadataAccountV3.
  // Since we just created the mint, let's use the low-level instruction via UMI.
  const { createUmi } = await import("@metaplex-foundation/umi-bundle-defaults");
  const { createMetadataAccountV3, findMetadataPda } = await import("@metaplex-foundation/mpl-token-metadata");
  const { keypairIdentity: umiIdentity, publicKey } = await import("@metaplex-foundation/umi");

  const umi = createUmi("https://api.devnet.solana.com").use(umiIdentity({
    publicKey: publicKey(kp.publicKey.toBase58()),
    secretKey: Uint8Array.from(hexBytes),
  }));

  const mintPkey = publicKey(newMint.toBase58());
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
        name: NAME, symbol: SYMBOL, uri: URI,
        sellerFeeBasisPoints: 0,
        creators: [{ address: umi.identity.publicKey, share: 100, verified: false }],
        collection: null, uses: null,
      },
      isMutable: true, collectionDetails: null,
    },
  });
  const res = await builder.sendAndConfirm(umi);
  console.log("✓ Metadata created. tx:", bs58.encode(Uint8Array.from(res.signature)));
  console.log("  View: https://explorer.solana.com/tx/" + bs58.encode(Uint8Array.from(res.signature)) + "?cluster=devnet");
} catch (e: any) {
  console.error("Metadata creation failed:", e.message?.slice(0, 250));
  console.error("(The mint is still created + supply minted; only the display metadata failed.)");
}

// ── Read-back verification ──
console.log("\n=== READ-BACK ===");
const METAPLEX_PID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const [metaPDA] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), METAPLEX_PID.toBuffer(), newMint.toBuffer()], METAPLEX_PID);
const metaAcct = await conn.getAccountInfo(metaPDA);
console.log("New mint:", newMint.toBase58());
console.log("Metadata PDA:", metaPDA.toBase58());
console.log("Metadata exists:", metaAcct ? "YES ✓" : "NO");
if (metaAcct) {
  const d = metaAcct.data;
  const nameLen = d.readUInt32LE(65);
  const name = d.slice(69, 69 + nameLen).toString("utf8").replace(/\u0000+$/, "");
  console.log("  parsed name:", JSON.stringify(name), "(has Σ:", name.includes("Σ"), ")");
  const symLen = d.readUInt32LE(69 + nameLen);
  const sym = d.slice(73 + nameLen, 73 + nameLen + symLen).toString("utf8").replace(/\u0000+$/, "");
  console.log("  parsed symbol:", JSON.stringify(sym));
}
const mintInfo = await conn.getParsedAccountInfo(newMint);
const info: any = (mintInfo.value as any)?.data?.parsed?.info;
console.log("mintAuthority:", info?.mintAuthority, "(should be 4saT...)");
console.log("decimals:", info?.decimals);
console.log("supply:", info?.supply);

console.log("\n=== DEPLOYER BALANCE AFTER ===");
const balAfter = await conn.getBalance(kp.publicKey);
console.log("SOL balance:", balAfter / 1e9, "SOL (spent:", (bal - balAfter) / 1e9, "SOL)");

console.log("\n=== NEW CANONICAL SOLANA MTQΣ ===");
console.log("Mint:", newMint.toBase58());
console.log("Name: MTQΣ (with Σ)");
console.log("Symbol: MTQ");
console.log("Decimals: 18");
console.log("Supply: 10,000,000,000");
console.log("Mint authority: 4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d");
