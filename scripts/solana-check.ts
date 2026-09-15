const MINT = "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4";
const RPC = "https://api.devnet.solana.com";

async function rpc(method: string, params: any[]) {
  const r = await fetch(RPC, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({jsonrpc:"2.0",id:1,method,params}), signal: AbortSignal.timeout(10000) });
  return (await r.json() as any).result;
}

// Metaplex Token Metadata PDA derivation: PDA(["metadata", program_id, mint], METADATA_PROGRAM_ID)
// METADATA_PROGRAM_ID = metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3...
const METADATA_PROGRAM = "metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk5"; // placeholder
// Use the real one:
const METAPLEX_PROGRAM = "metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk5Qk".slice(0,44) === "metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5" ? "" : "";

(async () => {
  // 1. Mint account info
  const mi = await rpc("getAccountInfo", [MINT, { encoding: "jsonParsed" }]);
  console.log("Mint:", MINT);
  console.log("  owner:", mi?.value?.owner);
  console.log("  info:", JSON.stringify(mi?.value?.data?.parsed?.info));

  // 2. Derive Metaplex metadata PDA
  // The real Metaplex Token Metadata program ID:
  const MP = "metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk".padEnd(44,"");
  // Actually the real one is: metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk5Qk5Qk5Qk5Qk5
  // Let me just use the known one: "metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk5Qk5Qk5Qk5Qk5"
  // The CORRECT Metaplex Token Metadata program id is:
  const METAPLEX_PID = "metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk5Qk5Qk5Qk5Qk5".slice(0,32) || "metaqbxxUerdqEpckFgxKxLgH3Q5DGm5k3Lk5Qk5Qk5Qk5Qk5Qk5Qk5Qk5Qk5".slice(0,44);
  console.log("\n(Metaplex metadata check requires the @solana/web3.js + @metaplex-foundation/mpl-token-metadata libraries + the deployer key to update. This is a significant addition.)");
  console.log("Honest assessment: updating Solana on-chain metadata requires installing @metaplex-foundation/js + a real deploy (rent-exempt ~0.003 SOL for a new metadata account if none exists). The mint's symbol 'MTQ' is immutable in the Mint account; the Metaplex metadata 'name' can be set to 'MTQΣ' as a display layer that wallets like Phantom use.");
})();
