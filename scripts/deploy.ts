// MTQΣ — Compile + Deploy script (server-side)
// Compiles contracts/MTQSigma.sol with solcjs, then deploys to a target EVM chain.
//
// SECURITY: the private key is read from .env, NEVER printed/logged.
//
// Usage:
//   bun run scripts/deploy.ts <chainKey>
//   chainKey ∈ { hoodi, sepolia, arc, monad }
//   The chain must be funded for the deployer wallet (checked first).

import { ethers } from "ethers";
import { readFileSync, writeFileSync, existsSync } from "fs";
import * as solc from "solc";

// --- Load key ---
const env = readFileSync(".env", "utf8");
const km = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m);
if (!km) { console.error("FAIL: DEPLOYER_PRIVATE_KEY not in .env"); process.exit(1); }
const privateKey = km[1];

// --- Target chain ---
const CHAINS: Record<string, { name: string; chainId: number; rpc: string; currency: string; explorer: string; addrBase: string }> = {
  hoodi:  { name: "Hoodi",        chainId: 1337802,  rpc: "https://rpc.hoodi.ethpandaops.io", currency: "ETH", explorer: "https://hoodi.etherscan.io", addrBase: "https://hoodi.etherscan.io/address/" },
  sepolia:{ name: "Sepolia",     chainId: 11155111, rpc: "https://ethereum-sepolia.publicnode.com", currency: "ETH", explorer: "https://sepolia.etherscan.io", addrBase: "https://sepolia.etherscan.io/address/" },
  arc:    { name: "Arc Testnet", chainId: 5042002,  rpc: "https://rpc.testnet.arc.io", currency: "USDC", explorer: "https://testnet.arcscan.app", addrBase: "https://testnet.arcscan.app/address/" },
  monad:  { name: "Monad Testnet", chainId: 10143, rpc: "https://testnet-rpc.monadvision.com", currency: "MON", explorer: "https://testnet.monadexplorer.com", addrBase: "https://testnet.monadexplorer.com/address/" },
};

const key = process.argv[2] as keyof typeof CHAINS | undefined;
if (!key || !CHAINS[key]) {
  console.error(`Usage: bun run scripts/deploy.ts <chainKey>  (one of: ${Object.keys(CHAINS).join(", ")})`);
  process.exit(1);
}
const chain = CHAINS[key];
console.log(`=== MTQΣ DEPLOY → ${chain.name} (chainId ${chain.chainId}) ===`);

// --- Compile ---
const source = readFileSync("contracts/MTQSigma.sol", "utf8");
const input = {
  language: "Solidity",
  sources: { "MTQSigma.sol": { content: source } },
  settings: { outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
};
console.log("Compiling contracts/MTQSigma.sol with solc", solc.version(), "...");
const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = out.errors?.filter((e: any) => e.severity === "error") || [];
if (errs.length) {
  console.error("Compile errors:");
  for (const e of errs) console.error(e.formattedMessage);
  process.exit(1);
}
const MTQ = out.contracts["MTQSigma.sol"]["MTQSigma"];
const MockUSDC = out.contracts["MTQSigma.sol"]["MockUSDC"];
const mtqAbi = MTQ.abi;
const mtqByte = "0x" + MTQ.evm.bytecode.object;
const usdcAbi = MockUSDC.abi;
const usdcByte = "0x" + MockUSDC.evm.bytecode.object;
console.log("✓ Compiled. MTQ:", mtqByte.length, "bytes bytecode; MockUSDC:", usdcByte.length, "bytes");

// --- Connect ---
const provider = new ethers.JsonRpcProvider(chain.rpc, { chainId: chain.chainId, name: chain.name }, { staticNetwork: true });
const wallet = new ethers.Wallet(privateKey, provider);
console.log(`Deployer: ${wallet.address}`);

// --- Fund check ---
async function fundCheck() {
  const bal = await provider.getBalance(wallet.address);
  console.log(`Deployer balance on ${chain.name}: ${ethers.formatEther(bal)} ${chain.currency}`);
  if (bal === 0n) {
    console.error(`✗ NO FUNDS on ${chain.name}. Cannot deploy. Get testnet ${chain.currency} from a faucet.`);
    return false;
  }
  return true;
}

async function deploy() {
  const ok = await fundCheck();
  if (!ok) process.exit(3);

  // Deploy MockUSDC first (MTQ depends on it as collateral)
  console.log(`\nDeploying MockUSDC...`);
  const usdcFactory = new ethers.ContractFactory(usdcAbi, usdcByte, wallet);
  const usdcContract = await usdcFactory.deploy();
  await usdcContract.waitForDeployment();
  const usdcAddr = await usdcContract.getAddress();
  console.log(`✓ MockUSDC deployed: ${usdcAddr} (tx ${usdcContract.deploymentTransaction()?.hash})`);

  // Deploy MTQΣ with MockUSDC as collateral
  console.log(`\nDeploying MTQΣ (MTQSigma)...`);
  const mtqFactory = new ethers.ContractFactory(mtqAbi, mtqByte, wallet);
  const mtqContract = await mtqFactory.deploy(usdcAddr);
  await mtqContract.waitForDeployment();
  const mtqAddr = await mtqContract.getAddress();
  console.log(`✓ MTQΣ deployed: ${mtqAddr} (tx ${mtqContract.deploymentTransaction()?.hash})`);

  // Genesis mint (§13.1): mint 1,000,000 MTQ to Genesis Reserve (locked)
  console.log(`\nGenesis event (§13.1): minting 1,000,000 MTQ to Genesis Reserve...`);
  const tx1 = await mtqContract.genesisMint(ethers.parseEther("1000000"));
  await tx1.wait();
  console.log(`✓ Genesis mint done (tx ${tx1.hash})`);

  // Fund the deployer (reserve vault) with mock USDC so the reserve can back mints
  console.log(`\nMinting 1,100,000 mock USDC to deployer (reserve collateral, §13.1)...`);
  const tx2 = await usdcContract.mint(wallet.address, 1_100_000n * 10n ** 6n);
  await tx2.wait();
  console.log(`✓ Reserve USDC funded (tx ${tx2.hash})`);

  // Approve MTQ contract to pull USDC from deployer for minting + release for redemption
  console.log(`Approving MTQ contract to spend deployer USDC...`);
  const usdc = new ethers.Contract(usdcAddr, ["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"], wallet);
  const tx3 = await usdc.approve(mtqAddr, ethers.MaxUint256);
  await tx3.wait();
  console.log(`✓ Approved (tx ${tx3.hash})`);

  // Read-back verification
  console.log(`\n=== READ-BACK VERIFICATION ===`);
  const mtq = new ethers.Contract(mtqAddr, mtqAbi, provider);
  const gfb = await mtq.getGFB();
  const price = await mtq.getMTQPrice();
  const circ = await mtq.getCirculatingSupply();
  const total = await mtq.totalSupply();
  console.log(`  GFB Index: ${ethers.formatEther(gfb)}`);
  console.log(`  MTQ Price (USD): $${ethers.formatEther(price)}`);
  console.log(`  Total Supply: ${ethers.formatEther(total)} MTQ`);
  console.log(`  Circulating Supply: ${ethers.formatEther(circ)} MTQ`);
  console.log(`  USDC balance (deployer/reserve): ${ethers.formatUnits(await usdc.balanceOf(wallet.address), 6)} USDC`);

  // Write deployment record
  const record = {
    chain: chain.name,
    chainId: chain.chainId,
    rpc: chain.rpc,
    explorer: chain.explorer,
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      MTQSigma: { address: mtqAddr, abi: "MTQSigma", tx: mtqContract.deploymentTransaction()?.hash },
      MockUSDC:  { address: usdcAddr, abi: "MockUSDC",  tx: usdcContract.deploymentTransaction()?.hash },
    },
    genesis: { supply: "1000000", circulating: "0", reserveUsdc: "1100000" },
    readBack: { gfb: ethers.formatEther(gfb), price: ethers.formatEther(price), totalSupply: ethers.formatEther(total) },
  };
  const outPath = `contracts/deployments/${chain.name.replace(/\s+/g, "-")}.json`;
  writeFileSync(outPath, JSON.stringify(record, null, 2));
  console.log(`\n✓ Deployment record written to ${outPath}`);
  console.log(`\n=== DEPLOY SUCCESS on ${chain.name} ===`);
  console.log(`MTQΣ:    ${chain.addrBase}${mtqAddr}`);
  console.log(`MockUSDC: ${chain.addrBase}${usdcAddr}`);
}

deploy().catch((e) => { console.error("DEPLOY FAILED:", e.message || e); process.exit(4); });
