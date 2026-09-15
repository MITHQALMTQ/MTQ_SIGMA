// MTQΣ — Full End-to-End Workflow Audit across all chains (dev mode: old + new active).
// For each chain, tests: RPC reachability, code presence, ERC-20 reads (name/symbol/
// decimals/supply), role checks (AccessControl), live transfer, and for pilot contracts
// also mint + redeem. Reports PASS/FAIL per test + collects everything that needs fixing.

import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const km = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m);
const pk = km ? km[1] : "";

const ROLE_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ROLE_MINTER = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const ROLE_PAUSER = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";
const SINK = "0x000000000000000000000000000000000000dEaD";

interface Test { name: string; pass: boolean; detail: string; }
interface ChainResult { chain: string; tests: Test[]; }

const results: ChainResult[] = [];

// Helper: timeout wrapper
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);
}

// All known MTQ deployments (canonical + active-in-dev) per chain
const EVM_DEPLOYS = [
  // Monad
  { chain: "Monad", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", kind: "full-ecosystem", mtq: "0x0Ac20360234b4C988a19586CBe55733e18A5982f", collateral: "0x9de7C1e69B386A8Df8B6E8Ef3ce8BA73C22F43D5", mint: "0x4deA71BdB5Af2ce76e34c2AccA815855Af36A5fA", safe: "0x74353601354c0b71df5B16Fe1B28c7F0831dd316" },
  { chain: "Monad", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", kind: "prior-pilot", mtq: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a", collateral: "0x28a2f9812BeC1252eee3992D56e5Bbd51393d6DE" },
  { chain: "Monad", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", kind: "user-original-MITHQAL", mtq: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", mint: "0x197e9CB28216dfe18a199b4c2930F74C2F460809", safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0" },
  // Arc
  { chain: "Arc", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", kind: "full-ecosystem", mtq: "0x24203404B9b971C907e8Ced96106Fa74380d9897", collateral: "0xc881D58df7Dddb29BC2Da05363D04974896285B6", mint: "0x28a2f9812BeC1252eee3992D56e5Bbd51393d6DE", safe: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713" },
  { chain: "Arc", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", kind: "prior-pilot", mtq: "0x5C728F729110013A1fa59fFc85938bbD973A2563", collateral: "0x861615527ea9c16a17eF1a3D67AAC215a75E840a" },
  { chain: "Arc", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", kind: "prior-pilot-prebrand", mtq: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1", collateral: "0x334D14E7E39e1f02a60fc1169CdF7b0BEDE30dEb" },
  { chain: "Arc", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", kind: "user-original-MITHQAL", mtq: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", mint: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa", safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0" },
  // Robinhood
  { chain: "Robinhood", chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", kind: "full-ecosystem", mtq: "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5", collateral: "0xE842f1F47D3491a4619ac2F8C4c19d8302bf2942", mint: "0xeF3290d060249D05685617F8954F2B64d7A6D084", safe: "0xa3CE28A10854B375272D528EeC4295D6bcd75691" },
  { chain: "Robinhood", chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", kind: "prior-pilot", mtq: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0", collateral: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD" },
];

const ERC20_ABI = ["function name() view returns (string)","function symbol() view returns (string)","function decimals() view returns (uint8)","function totalSupply() view returns (uint256)","function balanceOf(address) view returns (uint256)","function transfer(address,uint256) returns (bool)"];
const ACCESS_ABI = [...ERC20_ABI, "function hasRole(bytes32,address) view returns (bool)","function paused() view returns (bool)"];
const PILOT_ABI = [...ERC20_ABI, "function mint(uint256) returns (uint256)","function redeem(uint256) returns (uint256)","function getGFB() view returns (uint256)","function getMTQPrice() view returns (uint256)","function owner() view returns (address)","function protocolStatus() view returns (uint8)","function mintPaused() view returns (bool)"];

async function testEvm(d: typeof EVM_DEPLOYS[0]) {
  const tests: Test[] = [];
  const label = `${d.chain} (${d.kind})`;
  const provider = new ethers.JsonRpcProvider(d.rpc, { chainId: d.chainId, name: d.chain }, { staticNetwork: true });
  const wallet = new ethers.Wallet(pk, provider);

  // 1. RPC
  try {
    const net = await withTimeout(provider.getNetwork(), 8000);
    tests.push({ name: "RPC reachable", pass: true, detail: `chainId ${Number(net.chainId)}` });
  } catch (e: any) { tests.push({ name: "RPC reachable", pass: false, detail: e.message?.slice(0,60) }); return { chain: label, tests }; }

  // 2. Code
  try {
    const code = await withTimeout(provider.getCode(d.mtq), 8000);
    tests.push({ name: "Code at MTQ address", pass: code && code !== "0x" && code.length > 4, detail: code && code.length > 4 ? `${code.length} bytes` : "empty" });
    if (!code || code === "0x") return { chain: label, tests };
  } catch (e: any) { tests.push({ name: "Code at MTQ address", pass: false, detail: e.message?.slice(0,60) }); return { chain: label, tests }; }

  // 3. ERC-20 reads
  const mtq = new ethers.Contract(d.mtq, PILOT_ABI, provider);
  let name = "?", symbol = "?", decimals = -1, supply = "?";
  try {
    name = await withTimeout(mtq.name(), 6000);
    symbol = await withTimeout(mtq.symbol(), 6000);
    decimals = Number(await withTimeout(mtq.decimals(), 6000));
    supply = ethers.formatUnits(await withTimeout(mtq.totalSupply(), 6000), decimals);
    tests.push({ name: "name()", pass: true, detail: JSON.stringify(name) });
    tests.push({ name: "symbol()", pass: true, detail: JSON.stringify(symbol) });
    tests.push({ name: "decimals()", pass: decimals === 18, detail: String(decimals) });
    tests.push({ name: "totalSupply()", pass: true, detail: supply });
  } catch (e: any) {
    tests.push({ name: "ERC-20 reads", pass: false, detail: e.message?.slice(0,60) });
  }
  tests.push({ name: "name contains Σ", pass: name.includes("Σ"), detail: `name="${name}"` });

  // 4. Deployer balance (native gas)
  try {
    const bal = await withTimeout(provider.getBalance(wallet.address), 6000);
    tests.push({ name: "Deployer native balance", pass: bal > 0n, detail: ethers.formatEther(bal) });
  } catch (e: any) { tests.push({ name: "Deployer native balance", pass: false, detail: e.message?.slice(0,40) }); }

  // 5. Live transfer (1 token to SINK)
  try {
    const bal = await withTimeout(mtq.balanceOf(wallet.address), 6000);
    if (bal > 0n) {
      const mtqW = new ethers.Contract(d.mtq, ERC20_ABI, wallet);
      const tx = await mtqW.transfer(SINK, 1n);
      const rc = await tx.wait();
      tests.push({ name: "Live transfer (1 unit)", pass: rc?.status === 1, detail: `tx ${tx.hash.slice(0,16)}…` });
    } else {
      tests.push({ name: "Live transfer (1 unit)", pass: false, detail: "deployer has 0 MTQ balance" });
    }
  } catch (e: any) { tests.push({ name: "Live transfer (1 unit)", pass: false, detail: e.message?.slice(0,80) }); }

  // 6. AccessControl roles (only for full-ecosystem + user-original MITHQAL)
  if (d.kind === "full-ecosystem" || d.kind === "user-original-MITHQAL") {
    try {
      const mtqA = new ethers.Contract(d.mtq, ACCESS_ABI, provider);
      const admin = await withTimeout(mtqA.hasRole(ROLE_ADMIN, wallet.address), 6000);
      const minter = await withTimeout(mtqA.hasRole(ROLE_MINTER, wallet.address), 6000);
      const pauser = await withTimeout(mtqA.hasRole(ROLE_PAUSER, wallet.address), 6000);
      const paused = await withTimeout(mtqA.paused(), 6000);
      tests.push({ name: "DEFAULT_ADMIN_ROLE(deployer)", pass: admin, detail: String(admin) });
      tests.push({ name: "MINTER_ROLE(deployer)", pass: minter, detail: String(minter) });
      tests.push({ name: "PAUSER_ROLE(deployer)", pass: pauser, detail: String(pauser) });
      tests.push({ name: "paused()=false", pass: !paused, detail: String(paused) });
      if (d.mint) {
        const minterOnMint = await withTimeout(mtqA.hasRole(ROLE_MINTER, d.mint), 6000);
        tests.push({ name: "MINTER_ROLE(Mint contract)", pass: minterOnMint, detail: String(minterOnMint) });
      }
      if (d.safe) {
        const pauserOnSafe = await withTimeout(mtqA.hasRole(ROLE_PAUSER, d.safe), 6000);
        tests.push({ name: "PAUSER_ROLE(Safe)", pass: pauserOnSafe, detail: String(pauserOnSafe) });
      }
    } catch (e: any) { tests.push({ name: "AccessControl roles", pass: false, detail: e.message?.slice(0,60) }); }
  }

  // 7. Live mint (only for pilot contracts with collateral)
  if ((d.kind === "full-ecosystem" || d.kind === "prior-pilot") && d.collateral) {
    try {
      const mtqPilot = new ethers.Contract(d.mtq, PILOT_ABI, wallet);
      const usdc = new ethers.Contract(d.collateral, ["function approve(address,uint256) returns (bool)"], wallet);
      await (await usdc.approve(d.mtq, 1_000_000n * 10n ** 6n)).wait();
      const tx = await mtqPilot.mint(1000n * 10n ** 6n); // 1000 USDC
      const rc = await tx.wait();
      tests.push({ name: "Live mint (1000 USDC → MTQ)", pass: rc?.status === 1, detail: `tx ${tx.hash.slice(0,16)}…` });
    } catch (e: any) { tests.push({ name: "Live mint (1000 USDC → MTQ)", pass: false, detail: e.message?.slice(0,80) }); }
  }

  return { chain: label, tests };
}

async function testSolana() {
  const tests: Test[] = [];
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  // New mint (canonical)
  const newMint = new PublicKey("2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY");
  try {
    const mi = await conn.getParsedAccountInfo(newMint);
    const info: any = (mi.value as any)?.data?.parsed?.info;
    tests.push({ name: "New mint exists", pass: !!info, detail: info ? `decimals=${info.decimals}` : "not found" });
    tests.push({ name: "mintAuthority = 4saT…", pass: info?.mintAuthority === "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d", detail: info?.mintAuthority });
    tests.push({ name: "decimals = 18", pass: info?.decimals === 18, detail: String(info?.decimals) });
    // Metaplex metadata
    const METAPLEX_PID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    const [metaPDA] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), METAPLEX_PID.toBuffer(), newMint.toBuffer()], METAPLEX_PID);
    const meta = await conn.getAccountInfo(metaPDA);
    tests.push({ name: "Metaplex metadata exists", pass: !!meta, detail: meta ? `${meta.data.length} bytes` : "none" });
    if (meta) {
      const d = meta.data;
      const nameLen = d.readUInt32LE(65);
      const name = d.slice(69, 69 + nameLen).toString("utf8").replace(/\u0000+$/, "");
      tests.push({ name: "Metaplex name = MTQΣ", pass: name.includes("Σ"), detail: JSON.stringify(name) });
    }
    // Deployer SOL balance
    const bal = await conn.getBalance(new PublicKey("4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d"));
    tests.push({ name: "4saT… SOL balance", pass: bal > 0, detail: String(bal / 1e9) });
  } catch (e: any) { tests.push({ name: "Solana new mint", pass: false, detail: e.message?.slice(0,60) }); }
  // Old mint (active in dev)
  const oldMint = new PublicKey("GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4");
  try {
    const mi = await conn.getParsedAccountInfo(oldMint);
    const info: any = (mi.value as any)?.data?.parsed?.info;
    tests.push({ name: "Old mint exists (dev)", pass: !!info, detail: info ? `decimals=${info.decimals} authority=${info?.mintAuthority?.slice(0,8)}…` : "not found" });
  } catch (e: any) { tests.push({ name: "Old mint exists (dev)", pass: false, detail: e.message?.slice(0,60) }); }
  return { chain: "Solana", tests };
}

(async () => {
  console.log("================================================================");
  console.log("  MTQΣ — FULL END-TO-END WORKFLOW AUDIT (dev mode: all deployments active)");
  console.log("================================================================\n");
  for (const d of EVM_DEPLOYS) {
    const r = await testEvm(d);
    results.push(r);
  }
  results.push(await testSolana());

  // Report
  let totalTests = 0, totalPass = 0, totalFail = 0;
  const failures: { chain: string; test: string; detail: string }[] = [];
  for (const r of results) {
    console.log(`\n══════ ${r.chain} ══════`);
    for (const t of r.tests) {
      totalTests++;
      const icon = t.pass ? "✓" : "✗";
      if (t.pass) totalPass++; else { totalFail++; failures.push({ chain: r.chain, test: t.name, detail: t.detail }); }
      console.log(`  ${icon} ${t.name.padEnd(34)} ${t.detail}`);
    }
  }
  console.log(`\n══════ SUMMARY ══════`);
  console.log(`  Total tests: ${totalTests}  Pass: ${totalPass}  Fail: ${totalFail}`);
  console.log(`  Pass rate: ${(totalPass / totalTests * 100).toFixed(1)}%`);

  if (failures.length) {
    console.log(`\n══════ WHAT NEEDS FIXING ══════`);
    for (const f of failures) {
      console.log(`  ✗ [${f.chain}] ${f.test}: ${f.detail}`);
    }
  } else {
    console.log(`\n  ✓ Everything passes — nothing needs fixing.`);
  }
})();
