// MTQΣ — Solana devnet: set Metaplex Token Metadata name="MTQΣ", symbol="MTQ",
// URI=brand emblem. No new mint → no duplication. The SPL Mint's symbol is
// immutable, but wallets (Phantom) display the Metaplex metadata name+symbol.
import { Metaplex, keypairIdentity, toBigInt } from "@metaplex-foundation/js";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";

const MINT = new PublicKey("GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4");
const RPC = "https://api.devnet.solana.com";

// Load the deployer keypair. The Solana wallet is DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3.
// We need the Solana keypair bytes — the user gave us an EVM private key, NOT a Solana keypair.
// Check if we have a Solana keypair available.

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const mintInfo = await conn.getParsedAccountInfo(MINT);
  console.log("Mint:", MINT.toBase58());
  console.log("  owner:", (mintInfo.value as any)?.owner?.toBase58?.() ?? (mintInfo.value as any)?.owner);
  const info = (mintInfo.value as any)?.data?.parsed?.info;
  console.log("  mintAuthority:", info?.mintAuthority);
  console.log("  decimals:", info?.decimals);

  // Check if a Metaplex metadata PDA already exists
  const [metadataPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), new PublicKey("metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk"), MINT],
    new PublicKey("metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk"),
  );
  console.log("\nMetadata PDA:", metadataPDA.toBase58());
  const metaAcct = await conn.getAccountInfo(metadataPDA);
  console.log("  existing metadata:", metaAcct ? `EXISTS (${metaAcct.data.length} bytes)` : "NONE (would need to be created)");

  // Check deployer SOL balance
  const deployerSol = new PublicKey("DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3");
  const bal = await conn.getBalance(deployerSol);
  console.log("\nSolana deployer SOL balance:", bal / 1e9, "SOL");

  console.log("\n--- HONEST STATUS ---");
  console.log("To update/create the Metaplex metadata to name='MTQΣ' we need the Solana keypair for DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3.");
  console.log("The user provided an EVM private key (0x...), NOT a Solana keypair (which is a 64-byte array / base58 secret).");
  console.log("Without the Solana keypair, we CANNOT sign the metadata update/create transaction on Solana.");
  console.log("The SPL mint's symbol 'MTQ' is immutable anyway; only the Metaplex metadata name (display layer) can be set to 'MTQΣ'.");
  console.log("REQUIRED FROM USER: the Solana keypair (base58 or byte array) for DbFjz...hXb3, OR a new funded Solana wallet we control to create a fresh branded mint.");
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
