// MTQΣ — Full MITHQAL Ecosystem Deploy (one chain at a time)
// Deploys all 9 contracts (MTQ + Governance + Safe + Algorithm + Reserve + Mint +
// Redeem + Oracle + Takaful) + grants roles correctly (MINTER on Mint contract,
// PAUSER on Safe, etc.) to achieve full ecosystem parity on any EVM chain.
//
// Usage: bun run scripts/deploy-ecosystem.ts <chainKey>
//   chainKey ∈ { robinhood, monad, arc }

import { ethers } from "ethers";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import * as solc from "solc";

const env = readFileSync(".env", "utf8");
const km = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m);
if (!km) { console.error("FAIL: DEPLOYER_PRIVATE_KEY not in .env"); process.exit(1); }
const privateKey = km[1];

const CHAINS: Record<string, { name: string; chainId: number; rpc: string; currency: string; explorer: string; addrBase: string }> = {
  robinhood: { name: "Robinhood Chain Testnet", chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", currency: "ETH", explorer: "https://explorer.testnet.chain.robinhood.com", addrBase: "https://explorer.testnet.chain.robinhood.com/address/" },
  monad: { name: "Monad Testnet", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", currency: "MON", explorer: "https://testnet.monadscan.com", addrBase: "https://testnet.monadscan.com/address/" },
  arc: { name: "Arc Testnet", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", currency: "USDC", explorer: "https://testnet.arcscan.app", addrBase: "https://testnet.arcscan.app/address/" },
};

const key = process.argv[2] as keyof typeof CHAINS | undefined;
if (!key || !CHAINS[key]) { console.error(`Usage: bun run scripts/deploy-ecosystem.ts <chainKey>  (one of: ${Object.keys(CHAINS).join(", ")})`); process.exit(1); }
const chain = CHAINS[key];
console.log(`=== MTQΣ FULL ECOSYSTEM DEPLOY → ${chain.name} (chainId ${chain.chainId}) ===`);

// Compile with imports (OpenZeppelin)
const source = readFileSync("contracts/MtqEcosystem.sol", "utf8");

// solcjs import resolver: return OZ source from node_modules
function findImport(path: string): { contents: string } | { error: string } {
  try {
    const p = path.replace("@openzeppelin/contracts/", "node_modules/@openzeppelin/contracts/");
    return { contents: readFileSync(p, "utf8") };
  } catch {
    // try other path forms
    try { return { contents: readFileSync("node_modules/" + path, "utf8") }; } catch { return { error: "File not found: " + path }; }
  }
}

const input = {
  language: "Solidity",
  sources: { "MtqEcosystem.sol": { content: source } },
  settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }, optimizer: { enabled: true, runs: 200 } },
};
console.log("Compiling contracts/MtqEcosystem.sol (with @openzeppelin/contracts)...");
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));
const errs = out.errors?.filter((e: any) => e.severity === "error") || [];
if (errs.length) { for (const e of errs) console.error(e.formattedMessage); process.exit(1); }
console.log("✓ Compiled.");

const get = (name: string) => {
  const c = out.contracts["MtqEcosystem.sol"][name];
  return { abi: c.abi, byte: "0x" + c.evm.bytecode.object };
};
const C: Record<string, { abi: any; byte: string }> = {
  MTQToken: get("MTQToken"),
  Governance: get("Governance"),
  Safe: get("Safe"),
  AlgorithmEngine: get("AlgorithmEngine"),
  ReserveVault: get("ReserveVault"),
  MintContract: get("MintContract"),
  RedeemContract: get("RedeemContract"),
  Oracle: get("Oracle"),
  Takaful: get("Takaful"),
};
// Reuse the MockUSDC from MTQSigma.sol compilation? No — include it here.
const mockSrc = `
pragma solidity ^0.8.20;
contract MockUSDC {
  string public constant name = "USD Coin (Mock Pilot)";
  string public constant symbol = "USDC";
  uint8 public constant decimals = 6;
  uint256 public totalSupply;
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;
  address public owner;
  event Transfer(address indexed from, address indexed to, uint256 v);
  event Approval(address indexed o, address indexed s, uint256 v);
  constructor() { owner = msg.sender; }
  function transfer(address to, uint256 a) external returns (bool) { balanceOf[msg.sender]-=a; balanceOf[to]+=a; emit Transfer(msg.sender,to,a); return true; }
  function approve(address s, uint256 a) external returns (bool) { allowance[msg.sender][s]=a; emit Approval(msg.sender,s,a); return true; }
  function transferFrom(address f, address t, uint256 a) external returns (bool) { uint256 al=allowance[f][msg.sender]; if(al!=type(uint256).max){allowance[f][msg.sender]=al-a;} balanceOf[f]-=a; balanceOf[t]+=a; emit Transfer(f,t,a); return true; }
  function mint(address to, uint256 a) external { require(msg.sender==owner); totalSupply+=a; balanceOf[to]+=a; emit Transfer(address(0),to,a); }
}`;
const mockInput = { language: "Solidity", sources: { "Mock.sol": { content: mockSrc } }, settings: { outputSelection: { "*": { "*": ["abi","evm.bytecode.object"] } } } };
const mockOut = JSON.parse(solc.compile(JSON.stringify(mockInput)));
C.MockUSDC = { abi: mockOut.contracts["Mock.sol"]["MockUSDC"].abi, byte: "0x" + mockOut.contracts["Mock.sol"]["MockUSDC"].evm.bytecode.object };

const provider = new ethers.JsonRpcProvider(chain.rpc, { chainId: chain.chainId, name: chain.name }, { staticNetwork: true });
const wallet = new ethers.Wallet(privateKey, provider);
console.log(`Deployer: ${wallet.address}`);
const bal = await provider.getBalance(wallet.address);
console.log(`Balance: ${ethers.formatEther(bal)} ${chain.currency}`);
if (bal === 0n) { console.error(`✗ NO FUNDS on ${chain.name}. Get testnet ${chain.currency}.`); process.exit(3); }

const deploy = async (name: string, factory: { abi: any; byte: string }, ...args: any[]) => {
  console.log(`\nDeploying ${name}...`);
  const f = new ethers.ContractFactory(factory.abi, factory.byte, wallet);
  const c = await f.deploy(...args);
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`✓ ${name}: ${addr} (tx ${c.deploymentTransaction()?.hash?.slice(0,18)}…)`);
  return addr;
};

// 1. MockUSDC (collateral)
const usdcAddr = await deploy("MockUSDC", C.MockUSDC);
const usdc = new ethers.Contract(usdcAddr, C.MockUSDC.abi, wallet);

// 2. MTQ token
const mtqAddr = await deploy("MTQToken", C.MTQToken);
const mtq = new ethers.Contract(mtqAddr, C.MTQToken.abi, wallet);

// 3. Governance
const govAddr = await deploy("Governance", C.Governance);

// 4. Safe (Multi-Sig)
const safeAddr = await deploy("Safe", C.Safe);

// 5. Algorithm Engine
const algoAddr = await deploy("AlgorithmEngine", C.AlgorithmEngine);

// 6. Reserve Vault (needs usdc + paxg; use usdc for both as pilot)
const reserveAddr = await deploy("ReserveVault", C.ReserveVault, usdcAddr, usdcAddr);

// 7. Mint contract (needs usdc + mtq)
const mintAddr = await deploy("MintContract", C.MintContract, usdcAddr, mtqAddr);

// 8. Redeem contract (needs usdc + mtq)
const redeemAddr = await deploy("RedeemContract", C.RedeemContract, usdcAddr, mtqAddr);

// 9. Oracle
const oracleAddr = await deploy("Oracle", C.Oracle);

// 10. Takaful
const takafulAddr = await deploy("Takaful", C.Takaful, usdcAddr);

// ─── Role wiring ───
console.log(`\n=== ROLE WIRING ===`);
// Grant MINTER_ROLE on MTQ to the Mint contract (so it can mint on user deposit)
const MINTER_ROLE = ethers.id("MINTER_ROLE");
const PAUSER_ROLE = ethers.id("PAUSER_ROLE");
let tx = await mtq.grantRole(MINTER_ROLE, mintAddr);
await tx.wait();
console.log(`✓ Granted MINTER_ROLE on MTQ → Mint contract (${mintAddr})`);
// Grant PAUSER_ROLE on MTQ to the Safe (Multi-Sig)
tx = await mtq.grantRole(PAUSER_ROLE, safeAddr);
await tx.wait();
console.log(`✓ Granted PAUSER_ROLE on MTQ → Safe (${safeAddr})`);

// Fund the Mint contract with USDC so it can release on redemption flows (pilot)
tx = await usdc.mint(mintAddr, 1_100_000n * 10n ** 6n);
await tx.wait();
console.log(`✓ Funded Mint contract with 1,100,000 USDC`);

// Mint initial MTQ supply to deployer (genesis)
tx = await mtq.mint(wallet.address, 1_000_000n * 10n ** 18n);
await tx.wait();
console.log(`✓ Minted 1,000,000 MTQ to deployer (genesis)`);

// Read-back
console.log(`\n=== READ-BACK ===`);
console.log(`  MTQ name(): "${await mtq.name()}" (has Σ: ${(await mtq.name()).includes("\u03A3") || (await mtq.name()).includes("Σ")})`);
console.log(`  MTQ symbol(): "${await mtq.symbol()}"`);
console.log(`  MTQ decimals(): ${await mtq.decimals()}`);
console.log(`  MTQ totalSupply(): ${ethers.formatEther(await mtq.totalSupply())} MTQ`);
console.log(`  Deployer MTQ balance: ${ethers.formatEther(await mtq.balanceOf(wallet.address))} MTQ`);
console.log(`  DEFAULT_ADMIN_ROLE(deployer): ${await mtq.hasRole("0x" + "0".repeat(64), wallet.address)}`);
console.log(`  MINTER_ROLE(deployer): ${await mtq.hasRole(MINTER_ROLE, wallet.address)}`);
console.log(`  MINTER_ROLE(Mint contract): ${await mtq.hasRole(MINTER_ROLE, mintAddr)}`);
console.log(`  PAUSER_ROLE(deployer): ${await mtq.hasRole(PAUSER_ROLE, wallet.address)}`);
console.log(`  PAUSER_ROLE(Safe): ${await mtq.hasRole(PAUSER_ROLE, safeAddr)}`);
console.log(`  paused(): ${await mtq.paused()}`);

const record = {
  chain: chain.name, chainId: chain.chainId, deployedAt: new Date().toISOString(), deployer: wallet.address,
  contracts: {
    MTQToken: mtqAddr, Governance: govAddr, Safe: safeAddr, AlgorithmEngine: algoAddr,
    ReserveVault: reserveAddr, MintContract: mintAddr, RedeemContract: redeemAddr,
    Oracle: oracleAddr, Takaful: takafulAddr, MockUSDC: usdcAddr,
  },
  roles: {
    DEFAULT_ADMIN: wallet.address, MINTER_on_Mint: mintAddr, PAUSER_on_Safe: safeAddr,
  },
};
const outPath = `contracts/deployments/${chain.name.replace(/\s+/g, "-")}-Ecosystem.json`;
mkdirSync("contracts/deployments", { recursive: true });
writeFileSync(outPath, JSON.stringify(record, null, 2));
console.log(`\n✓ Deployment record → ${outPath}`);
console.log(`\n=== ECOSYSTEM DEPLOY SUCCESS on ${chain.name} ===`);
