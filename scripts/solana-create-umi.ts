// MTQΣ — Create fresh MTQΣ SPL token WITH Metaplex metadata using UMI natively.
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createSft, findMetadataPda, mplTokenMetadata } from "@metaplex-foundation/mpl-toolbox";
import { keypairIdentity, publicKey } from "@metaplex-foundation/umi";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { mintTo, getOrCreateAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";

const HEX = "58c19e10d4eba7e9d1b467b2288c156c3aac5e9e056c800c9b9b84545db8eb973987ef1837281dccd848a4d5b25ee8b37e280e563882ec968a327516141aeb60";
const web3Kp = Keypair.fromSecretKey(Uint8Array.from(Buffer.from(HEX, "hex")));
console.log("Wallet:", web3Kp.publicKey.toBase58());

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
console.log("SOL balance:", (await conn.getBalance(web3Kp.publicKey)) / 1e9, "SOL");

// Build UMI with the web3.js keypair (umi-bundle-defaults registers eddsa + spl + tokenMetadata)
const umi = createUmi("https://api.devnet.solana.com")
  .use(keypairIdentity({
    publicKey: publicKey(web3Kp.publicKey.toBase58()),
    secretKey: web3Kp.secretKey,
  } as any));

// createSft from mpl-toolbox
const NAME = "MTQΣ";
const SYMBOL = "MTQ";
const URI = "https://mtqs-pilot.local/brand/mtqs-metadata.json";
const DECIMALS = 18;

console.log("\n=== CREATING MTQΣ SPL + METADATA ===");
const { sft, signature } = await createSft(umi, {
  uri: URI,
  name: NAME,
  symbol: SYMBOL,
  decimals: DECIMALS,
  sellerFeeBasisPoints: 0,
  isMutable: true,
  mintAuthority: umi.identity,
  freezeAuthority: umi.identity.publicKey,
  tokenStandard: 0,
}).sendAndConfirm(umi);

console.log("✓ Created. tx:", Buffer.from(signature).toString("base64"));
console.log("  Mint:", sft.mint.address);

// Mint the supply
console.log("\n=== MINTING SUPPLY (10,000,000,000 MTQΣ) ===");
const SUPPLY = 10_000_000_000n * 10n ** BigInt(DECIMALS);
const ata = await getOrCreateAssociatedTokenAccount(conn, web3Kp, new PublicKey(sft.mint.address), web3Kp.publicKey);
const mintTx = await mintTo(conn, web3Kp, new PublicKey(sft.mint.address), ata.address, web3Kp, SUPPLY);
console.log("✓ Minted 10B MTQΣ (tx", mintTx.slice(0,16) + "…)");

console.log("\n=== NEW CANONICAL SOLANA MTQΣ ===");
console.log("Mint:", sft.mint.address);
console.log("Name: MTQΣ (with Σ) ✓");
