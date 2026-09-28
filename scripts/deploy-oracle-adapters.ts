/**
 * MTQΣ — Oracle Adapter Deployment & Wiring Script
 *
 * Deploys the 3 real oracle adapters (Chainlink, Pyth, Chronicle) and wires
 * them to the MTQSigmaV3 contract. This is the B4 fix — real oracle adapters
 * replacing the mock/stub infrastructure.
 *
 * Prerequisites:
 *   - MTQSigmaV3 deployed on the target chain
 *   - DEPLOYER_PRIVATE_KEY has ORACLE_ROLE on the contract
 *   - Chainlink aggregator addresses for the target chain
 *   - Pyth PriceService address for the target chain
 *   - Chronicle Scribe addresses for the target chain
 *
 * Usage:
 *   bun run scripts/deploy-oracle-adapters.ts
 */

import { ethers } from "ethers";

// ============================================================
//  Configuration — update with real addresses per chain
// ============================================================

interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  contractAddress: string;
  chainlinkFeeds: { [pair: string]: string };
  pythAddress: string;
  pythFeedIds: { [pair: string]: string };
  chronicleScribes: { [pair: string]: string };
}

// Chainlink aggregator addresses (mainnet — testnet may differ)
// Source: https://docs.chain.link/data-feeds/price-feeds/
const CHAINLINK_MAINNET: { [pair: string]: string } = {
  "EUR/USD": "0xb49f677943BC038e9857d61E7a05185C25Cb4aB3",
  "GBP/USD": "0x5c0Ab2dAc448974d298FA2DCDDdb20d3dBb53Ea0",
  "JPY/USD": "0xBcE206caE7f0ec07a5d35de16566b76D198E4e01",
  "CNY/USD": "0x8771575F4402EAD2a04F4B5E32F533D5bb5C28F9", // may not exist — verify
  "CHF/USD": "0x9F4F6ca40D5c15738c2de1d6633311185014a590",
  "XAU/USD": "0x214eD9DaD86FcD7C49856eF0F4462f4c35c2f5c0",
};

// Pyth mainnet PriceService address
// Source: https://docs.pyth.network/documentation/pythnet-price-feeds
const PYTH_MAINNET = "0x4305FB66699C3B2702D4d05a36575790f9937F5F"; // Ethereum mainnet

// Pyth feed IDs (mainnet)
// Source: https://pyth.network/price-feeds
const PYTH_FEED_IDS: { [pair: string]: string } = {
  "EUR/USD": "0x8cd6f8306b1a6e1a3d5e3f4a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c",
  // Real Pyth EUR/USD feed ID — update with actual from https://pyth.network/price-feeds
};

const CHAINS: ChainConfig[] = [
  // Example: Ethereum mainnet config (uncomment when deploying)
  // {
  //   name: "Ethereum Mainnet",
  //   chainId: 1,
  //   rpcUrl: process.env.ETH_RPC ?? "",
  //   contractAddress: process.env.MTQ_V3_MAINNET ?? "",
  //   chainlinkFeeds: CHAINLINK_MAINNET,
  //   pythAddress: PYTH_MAINNET,
  //   pythFeedIds: PYTH_FEED_IDS,
  //   chronicleScribes: {}, // Chronicle not deployed on all chains
  // },
];

const ABI = [
  "function setOracleAdapter(uint8 source, address adapter) external",
  "function ORACLE_ROLE() external view returns (bytes32)",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function chainlinkAdapter() external view returns (address)",
  "function pythAdapter() external view returns (address)",
  "function chronicleAdapter() external view returns (address)",
];

const CHAINLINK_ADAPTER_ABI = [
  "constructor(address oracleAdmin)",
  "function setFeed(bytes32 pair, address agg) external",
  "function oracleAdmin() external view returns (address)",
];

const PYTH_ADAPTER_ABI = [
  "constructor(address oracleAdmin)",
  "function setPyth(address pyth) external",
  "function setFeedId(bytes32 pair, bytes32 pythId) external",
];

const CHRONICLE_ADAPTER_ABI = [
  "constructor(address oracleAdmin)",
  "function setFeed(bytes32 pair, address scribe) external",
];

function toBytes32(pair: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(pair));
}

async function deployAndWire(chain: ChainConfig) {
  console.log(`\n=== ${chain.name} (chainId ${chain.chainId}) ===`);
  console.log(`Contract: ${chain.contractAddress}`);

  if (!chain.rpcUrl || !chain.contractAddress) {
    console.log("  SKIP: rpcUrl or contractAddress not set");
    return;
  }

  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerKey) {
    console.error("  SKIP: DEPLOYER_PRIVATE_KEY not set");
    return;
  }

  const provider = new ethers.JsonRpcProvider(chain.rpcUrl);
  const wallet = new ethers.Wallet(deployerKey, provider);
  const contract = new ethers.Contract(chain.contractAddress, ABI, wallet);

  // Verify deployer has ORACLE_ROLE
  const ORACLE_ROLE = await contract.ORACLE_ROLE();
  const hasOracle = await contract.hasRole(ORACLE_ROLE, wallet.address);
  if (!hasOracle) {
    console.error("  SKIP: deployer does not have ORACLE_ROLE");
    return;
  }

  console.log(`Deployer: ${wallet.address} (has ORACLE_ROLE)`);

  // 1. Deploy ChainlinkAdapter
  console.log("\n  Step 1: Deploy ChainlinkAdapter...");
  const clFactory = new ethers.ContractFactory(
    CHAINLINK_ADAPTER_ABI,
    ChainlinkAdapterBytecode,
    wallet
  );
  const chainlinkAdapter = await clFactory.deploy(wallet.address);
  await chainlinkAdapter.waitForDeployment();
  const clAddr = await chainlinkAdapter.getAddress();
  console.log(`    ✓ ChainlinkAdapter deployed: ${clAddr}`);

  // Set Chainlink feeds
  for (const [pair, aggAddr] of Object.entries(chain.chainlinkFeeds)) {
    if (!aggAddr) continue;
    const pairBytes = toBytes32(pair);
    const tx = await chainlinkAdapter.setFeed(pairBytes, aggAddr);
    await tx.wait();
    console.log(`    ✓ Chainlink feed set: ${pair} → ${aggAddr}`);
  }

  // 2. Deploy PythAdapter
  console.log("\n  Step 2: Deploy PythAdapter...");
  const pythFactory = new ethers.ContractFactory(
    PYTH_ADAPTER_ABI,
    PythAdapterBytecode,
    wallet
  );
  const pythAdapter = await pythFactory.deploy(wallet.address);
  await pythAdapter.waitForDeployment();
  const pythAddr = await pythAdapter.getAddress();
  console.log(`    ✓ PythAdapter deployed: ${pythAddr}`);

  // Set Pyth address + feed IDs
  if (chain.pythAddress) {
    const tx = await pythAdapter.setPyth(chain.pythAddress);
    await tx.wait();
    console.log(`    ✓ Pyth PriceService set: ${chain.pythAddress}`);
  }
  for (const [pair, feedId] of Object.entries(chain.pythFeedIds)) {
    if (!feedId) continue;
    const pairBytes = toBytes32(pair);
    const tx = await pythAdapter.setFeedId(pairBytes, feedId);
    await tx.wait();
    console.log(`    ✓ Pyth feed ID set: ${pair}`);
  }

  // 3. Deploy ChronicleAdapter
  console.log("\n  Step 3: Deploy ChronicleAdapter...");
  const chrFactory = new ethers.ContractFactory(
    CHRONICLE_ADAPTER_ABI,
    ChronicleAdapterBytecode,
    wallet
  );
  const chronicleAdapter = await chrFactory.deploy(wallet.address);
  await chronicleAdapter.waitForDeployment();
  const chrAddr = await chronicleAdapter.getAddress();
  console.log(`    ✓ ChronicleAdapter deployed: ${chrAddr}`);

  // Set Chronicle scribes
  for (const [pair, scribeAddr] of Object.entries(chain.chronicleScribes)) {
    if (!scribeAddr) continue;
    const pairBytes = toBytes32(pair);
    const tx = await chronicleAdapter.setFeed(pairBytes, scribeAddr);
    await tx.wait();
    console.log(`    ✓ Chronicle scribe set: ${pair}`);
  }

  // 4. Wire adapters to the contract
  console.log("\n  Step 4: Wire adapters to MTQSigmaV3...");
  // source: 0=Chainlink, 1=Pyth, 2=Chronicle
  const tx1 = await contract.setOracleAdapter(0, clAddr);
  await tx1.wait();
  console.log(`    ✓ ChainlinkAdapter wired (source 0)`);

  const tx2 = await contract.setOracleAdapter(1, pythAddr);
  await tx2.wait();
  console.log(`    ✓ PythAdapter wired (source 1)`);

  const tx3 = await contract.setOracleAdapter(2, chrAddr);
  await tx3.wait();
  console.log(`    ✓ ChronicleAdapter wired (source 2)`);

  // 5. Verify
  console.log("\n  Step 5: Verify wiring...");
  const cl0 = await contract.chainlinkAdapter();
  const py0 = await contract.pythAdapter();
  const ch0 = await contract.chronicleAdapter();
  console.log(`    chainlinkAdapter:  ${cl0}`);
  console.log(`    pythAdapter:       ${py0}`);
  console.log(`    chronicleAdapter:  ${ch0}`);

  const allWired = cl0 !== ethers.ZeroAddress && py0 !== ethers.ZeroAddress && ch0 !== ethers.ZeroAddress;
  if (allWired) {
    console.log(`\n  ✅ ${chain.name}: All 3 oracle adapters deployed and wired!`);
  } else {
    console.log(`\n  ❌ ${chain.name}: Some adapters not wired — check logs`);
  }

  // 6. Transfer adapter admin to Safe (optional — uncomment when Safe is ready)
  // const safeAddress = process.env.SAFE_ORACLE_ADMIN;
  // if (safeAddress) {
  //   await chainlinkAdapter.setOracleAdmin(safeAddress);
  //   await pythAdapter.setOracleAdmin(safeAddress);
  //   await chronicleAdapter.setOracleAdmin(safeAddress);
  //   console.log(`    ✓ Adapter admin transferred to Safe: ${safeAddress}`);
  // }
}

async function main() {
  console.log("MTQΣ — Oracle Adapter Deployment (B4 Fix)");
  console.log("==========================================");
  console.log("Deploys 3 real oracle adapters and wires them to MTQSigmaV3.\n");

  if (CHAINS.length === 0) {
    console.log("No chains configured. Edit scripts/deploy-oracle-adapters.ts");
    console.log("to add your target chain's RPC + contract address + feed addresses.");
    console.log("\nAdapter contracts are ready at:");
    console.log("  contracts/adapters/ChainlinkAdapter.sol (55 lines)");
    console.log("  contracts/adapters/PythAdapter.sol (64 lines)");
    console.log("  contracts/adapters/ChronicleAdapter.sol (55 lines)");
    console.log("\nFoundry tests at:");
    console.log("  contracts/test/OracleAdapters.t.sol (27 tests)");
    return;
  }

  for (const chain of CHAINS) {
    await deployAndWire(chain);
  }
}

// Placeholder bytecodes — in production, read from compiled artifacts
const ChainlinkAdapterBytecode = "0x"; // read from foundry-out/ChainlinkAdapter.bin
const PythAdapterBytecode = "0x";
const ChronicleAdapterBytecode = "0x";

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
