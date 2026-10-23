/**
 * MTQΣ — Safe Multi-Sig Deployment & Ownership Transfer Script
 *
 * This script automates the B2 fix: transferring contract ownership from the
 * deployer EOA to governance Safe multi-sigs.
 *
 * Prerequisites:
 *   1. Deploy Safe multi-sigs on each target chain (4/7 Constitutional, 4/7 Emergency,
 *      2/3 Monetary DAO, 4/7 Risk) via https://app.safe.io
 *   2. Set DEPLOYER_PRIVATE_KEY and RPC_URL in .env.local
 *   3. Set the Safe addresses in the configuration below
 *
 * Usage:
 *   bun run scripts/transfer-ownership.ts
 *
 * What it does:
 *   1. Connects to the deployed MTQSigmaV2 contract
 *   2. Grants DEFAULT_ADMIN_ROLE to the Constitutional Safe
 *   3. Grants PAUSER_ROLE to the Emergency Safe
 *   4. Grants KEEPER_ROLE to the keeper hot wallet
 *   5. Grants ORACLE_ROLE to the oracle commit wallet
 *   6. Calls setDao/setRiskCouncil/setEmergencyCouncil/setConstitutionalCouncil
 *   7. Renounces DEFAULT_ADMIN_ROLE from the deployer EOA
 *   8. Verifies the transfer was successful
 *
 * After running this script, the deployer EOA has NO roles on the contract.
 * All admin power is in the Safe multi-sigs.
 */

import { ethers } from "ethers";

// ============================================================
// CONFIGURATION — Update these with your actual Safe addresses
// ============================================================

interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl: string; // from env
  contractAddress: string;
  safes: {
    constitutional: string; // 4/7 — holds DEFAULT_ADMIN + CONSTITUTIONAL council
    emergency: string; // 4/7 — holds PAUSER_ROLE + EMERGENCY council
    monetary: string; // 2/3 — MONETARY DAO council
    risk: string; // 4/7 — RISK council
  };
  keeper: string; // hot wallet — KEEPER_ROLE only
  oracle: string; // oracle committer — ORACLE_ROLE only
}

const CHAINS: ChainConfig[] = [
  {
    name: "Monad Testnet",
    chainId: 10143,
    rpcUrl: process.env.MONAD_RPC ?? "",
    contractAddress: "0x0Ac20360234b4C988a19586CBe55733e18A5982f",
    safes: {
      constitutional: process.env.SAFE_CONSTITUTIONAL_10143 ?? "",
      emergency: process.env.SAFE_EMERGENCY_10143 ?? "",
      monetary: process.env.SAFE_MONETARY_10143 ?? "",
      risk: process.env.SAFE_RISK_10143 ?? "",
    },
    keeper: process.env.KEEPER_ADDRESS ?? "",
    oracle: process.env.ORACLE_ADDRESS ?? "",
  },
  // Add Arc, Robinhood, etc. here
];

// ABI fragments for the role functions
const ABI = [
  "function grantRole(bytes32 role, address account) external",
  "function renounceRole(bytes32 role, address account) external",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function setDao(address) external",
  "function setRiskCouncil(address) external",
  "function setEmergencyCouncil(address) external",
  "function setConstitutionalCouncil(address) external",
  "function DEFAULT_ADMIN_ROLE() external view returns (bytes32)",
  "function PAUSER_ROLE() external view returns (bytes32)",
  "function KEEPER_ROLE() external view returns (bytes32)",
  "function ORACLE_ROLE() external view returns (bytes32)",
];

async function transferOwnership(chain: ChainConfig) {
  console.log(`\n=== ${chain.name} (chainId ${chain.chainId}) ===`);
  console.log(`Contract: ${chain.contractAddress}`);

  if (!chain.rpcUrl) {
    console.error("  SKIP: RPC URL not set");
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

  console.log(`Deployer: ${wallet.address}`);

  // Get role hashes
  const DEFAULT_ADMIN = await contract.DEFAULT_ADMIN_ROLE();
  const PAUSER = await contract.PAUSER_ROLE();
  const KEEPER = await contract.KEEPER_ROLE();
  const ORACLE = await contract.ORACLE_ROLE();

  // Verify deployer currently has DEFAULT_ADMIN
  const hasAdmin = await contract.hasRole(DEFAULT_ADMIN, wallet.address);
  if (!hasAdmin) {
    console.log("  Deployer no longer has DEFAULT_ADMIN_ROLE — already transferred.");
    return;
  }

  // Step 1: Grant roles to Safes
  console.log("\n  Step 1: Granting roles to Safe multi-sigs...");

  if (chain.safes.constitutional) {
    console.log(`    Granting DEFAULT_ADMIN → ${chain.safes.constitutional}`);
    const tx = await contract.grantRole(DEFAULT_ADMIN, chain.safes.constitutional);
    await tx.wait();
    console.log(`    ✓ confirmed: ${tx.hash}`);
  }

  if (chain.safes.emergency) {
    console.log(`    Granting PAUSER → ${chain.safes.emergency}`);
    const tx = await contract.grantRole(PAUSER, chain.safes.emergency);
    await tx.wait();
    console.log(`    ✓ confirmed: ${tx.hash}`);
  }

  if (chain.keeper) {
    console.log(`    Granting KEEPER → ${chain.keeper} (HOT WALLET)`);
    const tx = await contract.grantRole(KEEPER, chain.keeper);
    await tx.wait();
    console.log(`    ✓ confirmed: ${tx.hash}`);
  }

  if (chain.oracle) {
    console.log(`    Granting ORACLE → ${chain.oracle}`);
    const tx = await contract.grantRole(ORACLE, chain.oracle);
    await tx.wait();
    console.log(`    ✓ confirmed: ${tx.hash}`);
  }

  // Step 2: Set governance council addresses (B1 fix)
  console.log("\n  Step 2: Setting governance council addresses (B1 fix)...");

  if (chain.safes.constitutional) {
    console.log(`    setConstitutionalCouncil → ${chain.safes.constitutional}`);
    const tx = await contract.setConstitutionalCouncil(chain.safes.constitutional);
    await tx.wait();
    console.log(`    ✓ confirmed: ${tx.hash}`);
  }

  if (chain.safes.monetary) {
    console.log(`    setDao → ${chain.safes.monetary}`);
    const tx = await contract.setDao(chain.safes.monetary);
    await tx.wait();
    console.log(`    ✓ confirmed: ${tx.hash}`);
  }

  if (chain.safes.risk) {
    console.log(`    setRiskCouncil → ${chain.safes.risk}`);
    const tx = await contract.setRiskCouncil(chain.safes.risk);
    await tx.wait();
    console.log(`    ✓ confirmed: ${tx.hash}`);
  }

  if (chain.safes.emergency) {
    console.log(`    setEmergencyCouncil → ${chain.safes.emergency}`);
    const tx = await contract.setEmergencyCouncil(chain.safes.emergency);
    await tx.wait();
    console.log(`    ✓ confirmed: ${tx.hash}`);
  }

  // Step 3: Renounce DEFAULT_ADMIN from deployer
  console.log("\n  Step 3: Renouncing DEFAULT_ADMIN_ROLE from deployer...");
  const tx = await contract.renounceRole(DEFAULT_ADMIN, wallet.address);
  await tx.wait();
  console.log(`    ✓ confirmed: ${tx.hash}`);

  // Step 4: Verify
  console.log("\n  Step 4: Verification...");
  const deployerStillHasAdmin = await contract.hasRole(DEFAULT_ADMIN, wallet.address);
  const safeHasAdmin = chain.safes.constitutional
    ? await contract.hasRole(DEFAULT_ADMIN, chain.safes.constitutional)
    : false;

  console.log(`    Deployer has DEFAULT_ADMIN: ${deployerStillHasAdmin} (should be false)`);
  console.log(`    Safe has DEFAULT_ADMIN:     ${safeHasAdmin} (should be true)`);

  if (!deployerStillHasAdmin && safeHasAdmin) {
    console.log(`\n  ✅ ${chain.name}: Ownership successfully transferred to Safe multi-sig!`);
  } else {
    console.log(`\n  ❌ ${chain.name}: Transfer may have failed — verify manually!`);
  }
}

async function main() {
  console.log("MTQΣ — Safe Multi-Sig Ownership Transfer (B2 Fix)");
  console.log("=================================================");
  console.log("This script transfers contract ownership from the deployer EOA");
  console.log("to governance Safe multi-sigs. After this, the deployer key");
  console.log("has NO control over the protocol.\n");

  for (const chain of CHAINS) {
    await transferOwnership(chain);
  }

  console.log("\n=== DONE ===");
  console.log("Next steps:");
  console.log("1. Verify the Safe addresses can call admin functions");
  console.log("2. Rotate the deployer key (it's now powerless but should still be rotated)");
  console.log("3. Delete upload/private_key.txt");
  console.log("4. Update CRITICAL-PRIVATE-KEY-ROTATION.md with completion date");
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
