import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];
const w = new ethers.Wallet(pk);

// Monad via the working RPC
console.log("=== MONAD TESTNET ===");
try {
  const p = new ethers.JsonRpcProvider("https://testnet-rpc.monad.xyz", { chainId: 10143, name: "monad" }, { staticNetwork: true });
  const bal = await p.getBalance(w.address);
  console.log("  deployer MON balance:", ethers.formatEther(bal));
  const bn = await p.getBlockNumber();
  console.log("  latest block:", bn);
  // check code at user's MTQ (MITHQAL)
  const code = await p.getCode("0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD");
  console.log("  user MTQ code:", code.length > 2 ? `LIVE (${code.length} bytes)` : "empty");
} catch (e:any) { console.log("  err:", e.message?.slice(0,80)); }

// Solana devnet — check deployer SOL balance + the MTQ mint
console.log("\n=== SOLANA DEVNET ===");
try {
  // get deployer SOL balance
  const r = await fetch("https://api.devnet.solana.com", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({jsonrpc:"2.0",id:1,method:"getBalance",params:["DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3"]}),
    signal: AbortSignal.timeout(9000),
  });
  const j = await r.json() as any;
  console.log("  deployer SOL balance:", j?.result?.value, "lamports =", (j?.result?.value||0)/1e9, "SOL");
  // MTQ mint account
  const r2 = await fetch("https://api.devnet.solana.com", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:["GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4",{encoding:"jsonParsed"}]}),
    signal: AbortSignal.timeout(9000),
  });
  const j2 = await r2.json() as any;
  const info = j2?.result?.value?.data?.parsed?.info;
  console.log("  MTQ mint:", info ? `decimals=${info.decimals} supply=${info.supply} mintAuthority=${info.mintAuthority}` : "not found");
} catch (e:any) { console.log("  err:", e.message?.slice(0,80)); }
