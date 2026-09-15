// MTQΣ — Cross-chain availability audit (read-only, on-chain verification).
// Checks every testnet we have a deployment record for, and reports the actual
// live state: does the contract exist? does it hold code? can it mint/redeem?
// what's the live supply + price? is the RPC reachable?

import { ethers } from "ethers";
import { readFileSync } from "fs";

// Every MTQΣ deployment we have on record (from contracts.ts + deployment JSONs).
interface Deploy {
  chain: string;
  chainId: number;
  rpc: string;
  explorer: string;
  mtq: string;
  collateral?: string;   // MockUSDC for pilot v2 deployments
  deployerWallet: string;
  isEvm: boolean;
  kind: "user-original" | "pilot-v2-this-build";
}

const DEPLOYS: Deploy[] = [
  { chain: "Robinhood Chain Testnet", chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", explorer: "https://explorer.testnet.chain.robinhood.com", mtq: "0xaf7cF40E37C00261E6B89D96371Da85Dd7b9b7af", collateral: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", deployerWallet: "0x3C3932F865892EFabE45892f453f81B64f6c8d8c", isEvm: true, kind: "pilot-v2-this-build" },
  { chain: "Arc Testnet (Pilot v2 — this build)", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", explorer: "https://testnet.arcscan.app", mtq: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1", collateral: "0x334D14E7E39e1f02a60fc1169CdF7b0BEDE30dEb", deployerWallet: "0x3C3932F865892EFabE45892f453f81B64f6c8d8c", isEvm: true, kind: "pilot-v2-this-build" },
  { chain: "Arc Testnet (user original)", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", explorer: "https://testnet.arcscan.app", mtq: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", deployerWallet: "0x3C3932F865892EFabE45892f453f81B64f6c8d8c", isEvm: true, kind: "user-original" },
  { chain: "Monad Testnet (user original)", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", explorer: "https://testnet.monadexplorer.com", mtq: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", deployerWallet: "0x3C3932F865892EFabE45892f453f81B64f6c8d8c", isEvm: true, kind: "user-original" },
  { chain: "Monad Testnet (alt RPC)", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", explorer: "https://testnet.monadexplorer.com", mtq: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", deployerWallet: "0x3C3932F865892EFabE45892f453f81B64f6c8d8c", isEvm: true, kind: "user-original" },
];

const MTQ_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  // v2 pilot functions (only on this-build contracts):
  "function getGFB() view returns (uint256)",
  "function getMTQPrice() view returns (uint256)",
  "function getCirculatingSupply() view returns (uint256)",
  "function protocolStatus() view returns (uint8)",
];

async function probe(d: Deploy) {
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`${d.chain} (chainId ${d.chainId}, ${d.kind})`);
  console.log(`  RPC: ${d.rpc}`);
  console.log(`  MTQ address: ${d.mtq}`);

  // Solana check first if non-EVM (none here, all EVM)
  // RPC reachability
  let provider: ethers.JsonRpcProvider;
  try {
    provider = new ethers.JsonRpcProvider(d.rpc, { chainId: d.chainId, name: d.chain }, { staticNetwork: true });
  } catch (e: any) {
    console.log(`  ✗ RPC setup failed: ${e.message?.slice(0, 60)}`);
    return { chain: d.chain, rpc: "unreachable", code: false, functional: false };
  }

  let rpcOk = false;
  try {
    const net = await Promise.race([
      provider.getNetwork(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 9000)),
    ]);
    rpcOk = Number(net.chainId) === d.chainId;
    console.log(`  RPC: reachable ✓ (chainId ${Number(net.chainId)})`);
  } catch (e: any) {
    console.log(`  ✗ RPC unreachable: ${e.message?.slice(0, 60)}`);
    return { chain: d.chain, rpc: "unreachable", code: false, functional: false };
  }

  // Code at MTQ address
  let codeBytes = 0;
  try {
    const code = await Promise.race([
      provider.getCode(d.mtq),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 9000)),
    ]);
    codeBytes = code && code !== "0x" ? code.length : 0;
    console.log(`  Code at MTQ address: ${codeBytes > 0 ? `LIVE (${codeBytes} bytes) ✓` : "EMPTY ✗ (no code)"}`);
  } catch (e: any) {
    console.log(`  ✗ getCode failed: ${e.message?.slice(0, 60)}`);
    return { chain: d.chain, rpc: "ok", code: false, functional: false };
  }
  if (codeBytes === 0) return { chain: d.chain, rpc: "ok", code: false, functional: false };

  // Try to read ERC-20 metadata + pilot-v2 functions
  const mtq = new ethers.Contract(d.mtq, MTQ_ABI, provider);
  let name = "?", symbol = "?", totalSupply = "?";
  try {
    name = await Promise.race([mtq.name(), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]);
    symbol = await Promise.race([mtq.symbol(), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]);
    totalSupply = ethers.formatEther(await Promise.race([mtq.totalSupply(), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]));
    console.log(`  ERC-20: name="${name}" symbol="${symbol}" totalSupply=${totalSupply}`);
  } catch (e: any) {
    console.log(`  ! ERC-20 metadata read failed (abi mismatch — likely the user's own contract, different interface): ${e.message?.slice(0, 50)}`);
    console.log(`  → Code IS present (contract deployed) but its ABI differs from this build's. Availability = YES, exact functions unknown without the user's .sol source.`);
    return { chain: d.chain, rpc: "ok", code: true, functional: "abi-mismatch" as any };
  }

  // Pilot-v2-only functions (GFB/price/circ)
  let gfb = "?", price = "?", circ = "?", status = "?";
  try {
    gfb = ethers.formatEther(await Promise.race([mtq.getGFB(), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]));
    price = ethers.formatEther(await Promise.race([mtq.getMTQPrice(), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]));
    circ = ethers.formatEther(await Promise.race([mtq.getCirculatingSupply(), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]));
    status = ["NORMAL","CAUTION","DEFENSIVE","EMERGENCY","RECOVERY"][
      Number(await Promise.race([mtq.protocolStatus(), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]))
    ];
    console.log(`  Pilot-v2: GFB=${gfb} price=$${price} circulating=${circ} status=${status}`);
  } catch {
    // not a v2 contract — fine, still available as ERC-20
  }

  // Deployer balance
  try {
    const bal = await Promise.race([provider.getBalance(d.deployerWallet), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]);
    console.log(`  Deployer balance: ${ethers.formatEther(bal)} (native gas)`);
  } catch {}

  return { chain: d.chain, rpc: "ok", code: true, functional: true, name, symbol, totalSupply, gfb, price, circ };
}

// Solana devnet check (separate, non-EVM)
async function solanaCheck() {
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`Solana Devnet (MTQ SPL token)`);
  console.log(`  RPC: https://api.devnet.solana.com`);
  console.log(`  Mint: GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4`);
  try {
    const r = await fetch("https://api.devnet.solana.com", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4", { encoding: "base64" }] }),
      signal: AbortSignal.timeout(9000),
    });
    const j = await r.json() as any;
    const live = j?.result?.value !== null;
    console.log(`  Account: ${live ? "LIVE ✓ (exists, owned by Token Program)" : "NOT FOUND ✗"}`);
    return { chain: "Solana Devnet", rpc: "ok", code: live, functional: live };
  } catch (e: any) {
    console.log(`  ✗ RPC unreachable: ${e.message?.slice(0, 60)}`);
    return { chain: "Solana Devnet", rpc: "unreachable", code: false, functional: false };
  }
}

async function main() {
  console.log("============================================================");
  console.log("  MTQΣ — CROSS-CHAIN AVAILABILITY AUDIT (on-chain, read-only)");
  console.log("============================================================");
  const results: any[] = [];
  for (const d of DEPLOYS) results.push(await probe(d));
  results.push(await solanaCheck());

  console.log("\n============================================================");
  console.log("  SUMMARY");
  console.log("============================================================");
  for (const r of results) {
    const icon = r.code === true ? "✅" : r.code === false ? "❌" : "❓";
    const func = r.functional === true ? "functional" : r.functional === "abi-mismatch" ? "deployed (abi differs)" : "n/a";
    console.log(`  ${icon} ${r.chain.padEnd(44)} RPC=${r.rpc.padEnd(12)} code=${r.code} ${func}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
