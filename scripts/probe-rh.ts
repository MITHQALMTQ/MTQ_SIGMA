import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const km = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)!;
const pk = km[1];
const wallet = new ethers.Wallet(pk);

const rpc = "https://rpc.testnet.chain.robinhood.com/rpc";
const chainId = 46630;
console.log("=== ROBINHOOD CHAIN TESTNET PROBE ===");
console.log("RPC:", rpc);
console.log("Deployer:", wallet.address);

const provider = new ethers.JsonRpcProvider(rpc, { chainId, name: "robinhood" }, { staticNetwork: true });

async function tryFetch(label, fn, timeoutMs=10000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(), timeoutMs);
    const r = await Promise.race([fn(), new Promise((_,rej)=>ctrl.signal.onabort=()=>rej(new Error("timeout")))]);
    clearTimeout(t);
    return r;
  } catch (e) { return new Error(e.message?.slice(0,80)||String(e)); }
}

(async () => {
  // 1. chainId check via raw RPC
  console.log("\n--- Raw RPC: eth_chainId ---");
  try {
    const r = await fetch(rpc, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_chainId",params:[]}), signal: AbortSignal.timeout(10000) });
    const j = await r.json() as any;
    console.log("  eth_chainId:", j.result, "(hex →", parseInt(j.result,16), ")");
  } catch(e:any) { console.log("  eth_chainId FAILED:", e.message?.slice(0,80)); }

  // 2. gas price
  console.log("\n--- Raw RPC: eth_gasPrice ---");
  try {
    const r = await fetch(rpc, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_gasPrice",params:[]}), signal: AbortSignal.timeout(10000) });
    const j = await r.json() as any;
    console.log("  eth_gasPrice:", j.result, "(wei) →", j.result ? ethers.formatEther(BigInt(j.result)) : "?", "ETH");
  } catch(e:any) { console.log("  eth_gasPrice FAILED:", e.message?.slice(0,80)); }

  // 3. balance via ethers
  console.log("\n--- Wallet balance (ethers) ---");
  const bal = await tryFetch("balance", () => provider.getBalance(wallet.address));
  if (bal instanceof Error) console.log("  FAILED:", bal.message);
  else console.log("  Balance:", ethers.formatEther(bal), "ETH");

  // 4. network
  console.log("\n--- Network (ethers) ---");
  const net = await tryFetch("network", () => provider.getNetwork());
  if (net instanceof Error) console.log("  FAILED:", net.message);
  else console.log("  Network:", net.name, "chainId:", Number(net.chainId));

  // 5. block number
  console.log("\n--- Block number ---");
  const bn = await tryFetch("block", () => provider.getBlockNumber());
  if (bn instanceof Error) console.log("  FAILED:", bn.message);
  else console.log("  Latest block:", bn);
})();
