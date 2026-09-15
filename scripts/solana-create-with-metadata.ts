// MTQΣ — Create fresh MTQΣ SPL token WITH Metaplex metadata in one flow via @metaplex-foundation/js createSft.
// 4saT... is the mint authority + payer. Creates mint + metadata atomically.

import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { mintTo, getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import { createSignerFromKeypair, publicKey as umiPubkey } from "@metaplex-foundation/umi";
import { fromWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import bs58 from "bs58";

const HEX = "58c19e10d4eba7e9d1b467b2288c156c3aac5e9e056c800c9b9b84545db8eb973987ef1837281dccd848a4d5b25ee8b37e280e563882ec968a327516141aeb60";

const web3Kp = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(HEX, "hex")));
console.log("Wallet:", web3Kp.publicKey.toBase58());

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
console.log("SOL balance:", (await conn.getBalance(web3Kp.publicKey)) / 1e9, "SOL");

const umiKp = fromWeb3JsKeypair(web3Kp);
const mx = Metaplex.make(conn).use(keypairIdentity(umiKp));
const UMI_PUB = umiPubkey(web3Kp.publicKey.toBase58()); // UMI PublicKey object with .equals()

const NAME = "MTQΣ";
const SYMBOL = "MTQ";
const URI = "https://mtqs-pilot.local/brand/mtqs-metadata.json";
const DECIMALS = 18;

console.log("\n=== CREATING MTQΣ SPL + METADATA (createSft) ===");
console.log("  name:", JSON.stringify(NAME));
console.log("  symbol:", JSON.stringify(SYMBOL));
console.log("  decimals:", DECIMALS);

const { sft, response } = await mx.nfts().createSft({
  uri: URI,
  name: NAME,
  symbol: SYMBOL,
  sellerFeeBasisPoints: 0,
  isMutable: true,
  // creators omitted → SDK defaults to the identity as the sole creator
  decimals: DECIMALS,
  mintAuthority: umiKp,
  freezeAuthority: umiKp,
  tokenStandard: 0, // Fungible
}, { commitment: "confirmed" });

console.log("✓ Created. tx:", response.signature);
console.log("  Mint:", sft.mint.address.toBase58());
console.log("  View: https://explorer.solana.com/tx/" + response.signature + "?cluster=devnet");
console.log("  View mint: https://explorer.solana.com/address/" + sft.mint.address.toBase58() + "?cluster=devnet");

// Mint the initial supply (10 billion)
console.log("\n=== MINTING SUPPLY (10,000,000,000 MTQΣ) ===");
const SUPPLY = 10_000_000_000n * 10n ** BigInt(DECIMALS);
const ata = await getOrCreateAssociatedTokenAccount(conn, web3Kp, sft.mint.address, web3Kp.publicKey);
const mintTx = await mintTo(conn, web3Kp, sft.mint.address, ata.address, kp, SUPPLY);
console.log("✓ Minted 10,000,000,000 MTQΣ to", web3Kp.publicKey.toBase58(), "(tx", mintTx.slice(0, 16) + "…)");

// Read-back the metadata
console.log("\n=== READ-BACK ===");
const loaded = await mx.nfts().findByMint({ mintAddress: sft.mint.address });
console.log("  name:", JSON.stringify(loaded.name), "(has Σ:", loaded.name.includes("Σ"), ")");
console.log("  symbol:", JSON.stringify(loaded.symbol));
console.log("  uri:", loaded.uri);
console.log("  mint:", loaded.mint.address.toBase58());
console.log("  mintAuthority:", loaded.mint.mintAuthority?.toBase58?.() ?? loaded.mint.mintAuthority);

console.log("\n=== FINAL SOLANA BALANCE ===");
console.log("SOL:", (await conn.getBalance(web3Kp.publicKey)) / 1e9, "SOL");

console.log("\n=== NEW CANONICAL SOLANA MTQΣ ===");
console.log("Mint:", sft.mint.address.toBase58());
console.log("Name: MTQΣ (with Σ) ✓");
console.log("Symbol: MTQ");
console.log("Decimals: 18");
console.log("Supply: 10,000,000,000");
console.log("Mint authority: 4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d");
