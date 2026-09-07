// MTQΣ — Deployment Verification Script (server-side, read-only)
// Verifies: key↔wallet match, wallet balances on candidate testnets, and
// that the existing Monad/Arc/Solana deployments are live (code exists).
//
// SECURITY: the private key is read from .env (DEPLOYER_PRIVATE_KEY) and is
// NEVER printed, logged, or transmitted. Only the derived ADDRESS is shown.

import { ethers } from "ethers";
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const m = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m);
if (!m) {
  console.error("FAIL: DEPLOYER_PRIVATE_KEY not found in .env");
  process.exit(1);
}
const privateKey = m[1];

// --- 1. Key ↔ wallet verification ---
const wallet = new ethers.Wallet(privateKey);
const derived = wallet.address;
const stated = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const match = derived.toLowerCase() === stated.toLowerCase();
console.log("=== 1. KEY ↔ WALLET ===");
console.log(`Derived address: ${derived}`);
console.log(`Stated wallet:   ${stated}`);
console.log(`Match: ${match ? "YES ✓ (key controls this wallet)" : "NO ✗ (key does NOT match this wallet)"}`);

if (!match) {
  console.error("\nABORT: the provided private key does not control the stated wallet. Deployment would send funds to the wrong account. Stopping before any on-chain action.");
  process.exit(2);
}

// --- 2. Probe balances on candidate "Robin Hood" testnets ---
console.log("\n=== 2. WALLET BALANCES (candidate 'Robin Hood' chains) ===");
const chains = [
  { name: "Hoodi (Ethereum testnet, replaced Holesky)", chainId: 1337802, rpc: "https://ethereum-hoodi.publicnode.com" },
  { name: "Hoodi (alt RPC)", chainId: 1337802, rpc: "https://rpc.hoodi.ethpandaops.io" },
  { name: "Sepolia", chainId: 11155111, rpc: "https://ethereum-sepolia.publicnode.com" },
  { name: "Holesky (deprecated)", chainId: 17000, rpc: "https://ethereum-holesky.publicnode.com" },
  { name: "Monad Testnet (existing)", chainId: 10143, rpc: "https://testnet-rpc.monadvision.com" },
  { name: "Arc Testnet (existing)", chainId: 5042002, rpc: "https://rpc.testnet.arc.io" },
];

const funded: string[] = [];
for (const c of chains) {
  try {
    const provider = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: c.name }, { staticNetwork: true });
    const balanceP = new Promise<string>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("timeout")), 9000);
      provider.getBalance(derived).then((b) => { clearTimeout(to); resolve(ethers.formatEther(b)); }).catch((e) => { clearTimeout(to); reject(e); });
    });
    const netP = new Promise<number>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("timeout")), 9000);
      provider.getNetwork().then((n) => { clearTimeout(to); resolve(Number(n.chainId)); }).catch((e) => { clearTimeout(to); reject(e); });
    });
    const [eth, actualChainId] = await Promise.all([balanceP, netP]);
    const hasFunds = parseFloat(eth) > 0;
    console.log(`  ${c.name.padEnd(46)} chainId=${actualChainId} balance=${eth} ${hasFunds ? "← FUNDED" : ""}`);
    if (hasFunds) funded.push(`${c.name} (chainId ${actualChainId})`);
  } catch (e: any) {
    console.log(`  ${c.name.padEnd(46)} UNREACHABLE (${e.message?.slice(0, 40) || "error"})`);
  }
}
console.log(`\nFunded chains for this wallet: ${funded.length ? funded.join("; ") : "NONE detected"}`);

// --- 3. Verify existing deployments are live (getCode) ---
console.log("\n=== 3. EXISTING DEPLOYMENTS — LIVE CHECK ===");
const evmDeployments = [
  { chain: "Monad Testnet", chainId: 10143, rpc: "https://testnet-rpc.monadvision.com", mtq: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", reserve: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177", oracle: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713" },
  { chain: "Arc Testnet", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", mtq: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", reserve: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471", oracle: "0xFd2B8d176bf059287638Db30D02C6651dA02861e" },
];
for (const d of evmDeployments) {
  try {
    const provider = new ethers.JsonRpcProvider(d.rpc, { chainId: d.chainId, name: d.chain }, { staticNetwork: true });
    for (const [label, addr] of Object.entries({ MTQ: d.mtq, RESERVE: d.reserve, ORACLE: d.oracle })) {
      try {
        const codeP = new Promise<string>((resolve, reject) => {
          const to = setTimeout(() => reject(new Error("timeout")), 9000);
          provider.getCode(addr).then((c) => { clearTimeout(to); resolve(c); }).catch((e) => { clearTimeout(to); reject(e); });
        });
        const code = await codeP;
        const live = code && code !== "0x" && code.length > 4;
        console.log(`  ${d.chain} ${label} ${addr} → ${live ? `LIVE (${code.length} bytes code)` : "EMPTY (no code)"}`);
      } catch (e: any) {
        console.log(`  ${d.chain} ${label} ${addr} → UNREACHABLE (${e.message?.slice(0, 40)})`);
      }
    }
  } catch (e: any) {
    console.log(`  ${d.chain}: setup error (${e.message?.slice(0, 50) || "error"})`);
  }
}

// --- 4. Solana devnet MTQ token live check ---
console.log("\n=== 4. SOLANA DEVNET — MTQ SPL TOKEN ===");
try {
  const r = await fetch("https://api.devnet.solana.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4", { encoding: "base64" }] }),
    signal: AbortSignal.timeout(9000),
  });
  const j = await r.json() as any;
  const live = j?.result?.value !== null;
  console.log(`  MTQ SPL mint GAGRdrY6...jxS4 → ${live ? "LIVE (account exists)" : "NOT FOUND"}`);
} catch (e: any) {
  console.log(`  Solana devnet: UNREACHABLE (${e.message?.slice(0, 60) || "error"})`);
}

console.log("\n=== DONE ===");
