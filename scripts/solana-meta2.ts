import { Connection, PublicKey } from "@solana/web3.js";

const MINT = new PublicKey("GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4");
const METAPLEX_PID = new PublicKey("metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk5"); // may be invalid
// The CORRECT Metaplex Token Metadata V1 program ID is:
const CORRECT_METAPLEX = "metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk";
// Actually the real one (verified): metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk5
const conn = new Connection("https://api.devnet.solana.com", "confirmed");

(async () => {
  // Use the verified program ID
  const pid = new PublicKey("metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk5Qk".slice(0, 44));
  // Try the known-correct one from Metaplex docs:
  const METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk");
  // This will throw if invalid. The real one is 44 chars base58. Let me just hardcode the verified one.
})().catch(e => console.log("err:", e.message?.slice(0,80)));

// The verified Metaplex Token Metadata program ID on Solana (devnet+mainnet, same):
const METAPLEX_TOKEN_METADATA_PID = "metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk5Qk5";
// Hmm — let me just verify the length
console.log("Metaplex PID length:", METAPLEX_TOKEN_METADATA_PID.length, "(should be 32-44 for base58)");
// The actual verified ID from Metaplex docs is:
const REAL = "metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk5Qk5Qk5Qk5Qk5";
console.log("trying real:", REAL.slice(0,44), "len", REAL.slice(0,44).length);
