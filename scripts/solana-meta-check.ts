// MTQΣ — Solana devnet: check Metaplex metadata state for the MTQ mint.
// Honest constraint: the user provided an EVM private key (0x...), not a Solana
// keypair. We CANNOT sign Solana transactions without the Solana keypair for
// DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3. This script is read-only.
import { Connection, PublicKey } from "@solana/web3.js";

const MINT = new PublicKey("GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4");
const METAPLEX_PID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const RPC = "https://api.devnet.solana.com";

(async () => {
  const conn = new Connection(RPC, "confirmed");

  // Derive the Metaplex metadata PDA for this mint
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METAPLEX_PID.toBuffer(), MINT.toBuffer()],
    METAPLEX_PID,
  );
  console.log("=== SOLANA MTQ MINT — METAPLEX METADATA CHECK ===");
  console.log("Mint:", MINT.toBase58());
  console.log("Metaplex program ID:", METAPLEX_PID.toBase58());
  console.log("Derived metadata PDA:", metadataPDA.toBase58());

  const metaAcct = await conn.getAccountInfo(metadataPDA);
  if (metaAcct) {
    console.log("\nMetadata account: EXISTS ✓");
    console.log("  owner:", metaAcct.owner.toBase58(), "(Metaplex program:", METAPLEX_PID.toBase58(), "=>", metaAcct.owner.equals(METAPLEX_PID) ? "✓" : "✗");
    console.log("  data length:", metaAcct.data.length, "bytes");
    console.log("  lamports (rent):", metaAcct.lamports, "(", metaAcct.lamports / 1e9, "SOL)");
    // Decode the Metaplex metadata (V1): key(1) + updateAuth key(2+32) + mint(2+32) + name(2+...) + symbol(2+...) + uri(2+...)
    // Simple parse: name starts at byte 65 (1 + 2 + 32 + 2 + 32 + 2)
    try {
      const d = metaAcct.data;
      const nameLen = d.readUInt32LE(65); // actually it's u32 LE for the name length at offset 65
      const name = d.slice(69, 69 + nameLen).toString("utf8").replace(/\u0000+$/, "");
      const symLen = d.readUInt32LE(69 + nameLen);
      const symbol = d.slice(73 + nameLen, 73 + nameLen + symLen).toString("utf8").replace(/\u0000+$/, "");
      console.log("  parsed name:", JSON.stringify(name));
      console.log("  parsed symbol:", JSON.stringify(symbol));
    } catch (e: any) {
      console.log("  parse failed:", e.message?.slice(0, 80));
    }
  } else {
    console.log("\nMetadata account: NONE ✗");
    console.log("  → To display 'MTQΣ' in wallets, a metadata account must be CREATED (needs the Solana keypair + ~0.003 SOL rent).");
  }

  // Deployer balance
  const deployer = new PublicKey("DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3");
  const bal = await conn.getBalance(deployer);
  console.log("\nSolana deployer (DbFjz...hXb3) balance:", bal / 1e9, "SOL");

  console.log("\n=== HONEST ASSESSMENT ===");
  console.log("1. The SPL mint symbol 'MTQ' is IMMUTABLE (set at mint creation, cannot be changed).");
  console.log("2. The Metaplex metadata (name/symbol/uri display layer) CAN be created/updated — BUT it requires the Solana keypair for DbFjz...hXb3 (the mint authority).");
  console.log("3. The user provided an EVM private key (0x...), NOT a Solana keypair. We CANNOT sign Solana transactions here.");
  console.log("4. REQUIRED FROM USER: the Solana keypair (base58 secret key array) for DbFjz...hXb3 to set the on-chain metadata name='MTQΣ'.");
  console.log("   Without it, the Solana MTQ token's on-chain name cannot be updated. Off-chain UI branding (showing MTQΣ + emblem) still applies.");
})();
