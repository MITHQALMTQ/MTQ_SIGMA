/**
 * MTQΣ V3 Deployment Script
 *
 * Deploys:
 *   1. MTQSigmaV3 contract
 *   2. ChainlinkAdapter
 *   3. PythAdapter
 *   4. ChronicleAdapter
 *   5. Wires all 3 adapters to V3 via setOracleAdapter
 *   6. Authorizes the first pilot bank
 *   7. Sets the feeWallet
 *   8. Initializes the stability pool asset (USDC)
 *   9. Verifies deployment
 *
 * Usage: bun run scripts/deploy-v3.ts
 * Requires: DEPLOYER_PRIVATE_KEY, RPC_URL in .env.local
 *
 * Safe to dry-run: if no DEPLOYER_PRIVATE_KEY or RPC_URL is set, the script
 * prints exactly what it WOULD do and exits 0 without sending any tx.
 *
 * Optional env vars (override the defaults below):
 *   RPC_URL                 — JSON-RPC endpoint for the target chain
 *   DEPLOYER_PRIVATE_KEY    — deployer EOA private key (hex, 0x-prefixed)
 *   PILOT_BANK_ADDRESS      — address of the first authorized pilot bank
 *   PILOT_BANK_NAME         — display name (default: "Pilot Bank A")
 *   PILOT_BANK_JURISDICTION — ISO 3166-1 alpha-2 (default: "US")
 *   PILOT_BANK_DAILY_CAP_USD — per-day mint cap in USD (default: 1_000_000)
 *   FEE_WALLET_ADDRESS      — fee accrual wallet
 *   STABILITY_ASSET_ADDRESS — USDC (or 6-dec stable) for the stability pool
 *   MTQ_V3_CHAIN_NAME       — display name (default: "Target Chain")
 *   MTQ_V3_CHAIN_ID         — numeric chainId (default: derived from provider)
 *   DEPLOYMENT_OUT_DIR      — where to write the deployment JSON
 *                             (default: contracts/deployments)
 */

import { ethers } from "ethers";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

// ============================================================
//  Foundry artifact loader
// ============================================================

const FOUNDRY_OUT = resolve(__dirname, "..", "contracts", "foundry-out");

interface FoundryArtifact {
  abi: ethers.InterfaceAbi;
  bytecode: { object: string };
}

function loadArtifact(relPath: string): FoundryArtifact {
  const full = join(FOUNDRY_OUT, relPath);
  if (!existsSync(full)) {
    throw new Error(
      `Foundry artifact not found: ${relPath}\n` +
        `Run \`forge build\` in /contracts first to compile MTQSigmaV3 + adapters.`,
    );
  }
  const raw = JSON.parse(readFileSync(full, "utf8")) as FoundryArtifact;
  if (!raw?.bytecode?.object || raw.bytecode.object === "0x") {
    throw new Error(`Artifact ${relPath} has empty bytecode — recompile with forge.`);
  }
  return raw;
}

// ============================================================
//  Configuration
// ============================================================

interface DeployConfig {
  chainName: string;
  chainId: number;
  rpcUrl: string;
  deployerKey: string | null;
  pilotBankAddress: string;
  pilotBankName: string;
  pilotBankJurisdiction: string;
  pilotBankDailyCapUsd: number;
  feeWalletAddress: string;
  stabilityAssetAddress: string;
  outDir: string;
}

function loadConfig(): DeployConfig {
  const rpcUrl = process.env.RPC_URL ?? "";
  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY ?? "";
  const chainIdRaw = process.env.MTQ_V3_CHAIN_ID ?? "";
  return {
    chainName: process.env.MTQ_V3_CHAIN_NAME ?? "Target Chain",
    chainId: chainIdRaw ? Number(chainIdRaw) : 0,
    rpcUrl,
    deployerKey: deployerKey && deployerKey !== "0xyour_testnet_deployer_private_key_here"
      ? deployerKey
      : null,
    pilotBankAddress: process.env.PILOT_BANK_ADDRESS ?? "",
    pilotBankName: process.env.PILOT_BANK_NAME ?? "Pilot Bank A",
    pilotBankJurisdiction: process.env.PILOT_BANK_JURISDICTION ?? "US",
    pilotBankDailyCapUsd: Number(process.env.PILOT_BANK_DAILY_CAP_USD ?? "1000000"),
    feeWalletAddress: process.env.FEE_WALLET_ADDRESS ?? "",
    stabilityAssetAddress: process.env.STABILITY_ASSET_ADDRESS ?? "",
    outDir: process.env.DEPLOYMENT_OUT_DIR ?? resolve(__dirname, "..", "contracts", "deployments"),
  };
}

// ============================================================
//  ABIs (minimal fragments — full ABIs live in the artifacts)
// ============================================================

const V3_ABI = [
  "constructor()",
  "function setOracleAdapter(uint8 source, address adapter) external",
  "function authorizeBank(address bank, string name, string jurisdiction, uint256 dailyCap) external",
  "function setFeeWallet(address wallet) external",
  "function setStabilityAsset(address asset) external",
  "function chainlinkAdapter() external view returns (address)",
  "function pythAdapter() external view returns (address)",
  "function chronicleAdapter() external view returns (address)",
  "function feeWallet() external view returns (address)",
  "function stabilityAsset() external view returns (address)",
  "function getBank(address bank) external view returns (tuple(address bankAddress, string name, string jurisdiction, bool isAuthorized, uint256 dailyMintCap, uint256 dailyMintUsed, uint256 dailyMintResetAt, uint256 authorizedAt))",
  "function authorizedBankCount() external view returns (uint256)",
  "function DEFAULT_ADMIN_ROLE() external view returns (bytes32)",
  "function ORACLE_ROLE() external view returns (bytes32)",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function paused() external view returns (bool)",
] as const;

const ADAPTER_ABI = [
  "constructor(address oracleAdmin)",
  "function oracleAdmin() external view returns (address)",
] as const;

// ============================================================
//  Helpers
// ============================================================

function banner(line: string): void {
  const bar = "=".repeat(Math.max(8, 72 - line.length));
  console.log(`\n${bar} ${line} ${bar}`);
}

function logStep(n: number, msg: string): void {
  console.log(`\n  Step ${n}: ${msg}`);
}

function logOk(msg: string): void {
  console.log(`    \u2713 ${msg}`);
}

function shortAddr(a: string): string {
  if (!a) return "(unset)";
  return a;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
//  Dry-run mode (no private key / no RPC)
// ============================================================

function dryRunPrint(cfg: DeployConfig): void {
  banner("DRY RUN");
  console.log("No DEPLOYER_PRIVATE_KEY or RPC_URL set — printing what would happen.\n");
  console.log(`  Target chain:        ${cfg.chainName} (chainId ${cfg.chainId || "?"})`);
  console.log(`  RPC URL:             ${cfg.rpcUrl || "(unset)"}`);
  console.log(`  Deployer:            (would be derived from DEPLOYER_PRIVATE_KEY)`);
  console.log("");
  console.log("  Would deploy:");
  console.log("    1. MTQSigmaV3(admin = msg.sender)");
  console.log("       constructor() — no args; admin auto-granted DEFAULT_ADMIN_ROLE");
  console.log("    2. ChainlinkAdapter(admin = msg.sender)");
  console.log("    3. PythAdapter(admin = msg.sender)");
  console.log("    4. ChronicleAdapter(admin = msg.sender)");
  console.log("");
  console.log("  Then would call on V3 (deployer has DEFAULT_ADMIN = all roles):");
  console.log("    setOracleAdapter(0, chainlinkAddr)");
  console.log("    setOracleAdapter(1, pythAddr)");
  console.log("    setOracleAdapter(2, chronicleAddr)");
  console.log(`    authorizeBank(${shortAddr(cfg.pilotBankAddress) || "<PILOT_BANK_ADDRESS>"}, "${cfg.pilotBankName}", "${cfg.pilotBankJurisdiction}", ${cfg.pilotBankDailyCapUsd}e18)`);
  console.log(`    setFeeWallet(${shortAddr(cfg.feeWalletAddress) || "<FEE_WALLET_ADDRESS>"})`);
  console.log(`    setStabilityAsset(${shortAddr(cfg.stabilityAssetAddress) || "<STABILITY_ASSET_ADDRESS>"})`);
  console.log("");
  console.log("  Then would verify wiring + write a deployment JSON to:");
  console.log(`    ${join(cfg.outDir, "MTQSigmaV3-<chainId>.json")}`);
  console.log("");
  console.log("Set DEPLOYER_PRIVATE_KEY + RPC_URL + the 3 address env vars to execute.");
}

// ============================================================
//  Main deployment flow
// ============================================================

async function deploy(cfg: DeployConfig): Promise<number> {
  banner(`MTQΣ V3 Deployment — ${cfg.chainName}`);

  // Load artifacts (compiles if missing)
  const v3Art = loadArtifact("MTQSigmaV3.sol/MTQSigmaV3.json");
  const clArt = loadArtifact("ChainlinkAdapter.sol/ChainlinkAdapter.json");
  const pyArt = loadArtifact("PythAdapter.sol/PythAdapter.json");
  const chArt = loadArtifact("ChronicleAdapter.sol/ChronicleAdapter.json");

  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const wallet = new ethers.Wallet(cfg.deployerKey!, provider);

  // Resolve chainId from the provider if not set
  const network = await provider.getNetwork();
  const chainId = cfg.chainId || Number(network.chainId);
  console.log(`  Network:    ${cfg.chainName} (chainId ${chainId})`);
  console.log(`  RPC:        ${cfg.rpcUrl}`);
  console.log(`  Deployer:   ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`  Balance:    ${ethers.formatEther(balance)} ETH`);

  if (balance === 0n) {
    console.error("\n  ABORT: deployer balance is 0 — fund the wallet first.");
    return 1;
  }

  // --- Pre-flight: required address env vars ---
  const missing: string[] = [];
  if (!cfg.pilotBankAddress || !ethers.isAddress(cfg.pilotBankAddress)) missing.push("PILOT_BANK_ADDRESS");
  if (!cfg.feeWalletAddress || !ethers.isAddress(cfg.feeWalletAddress)) missing.push("FEE_WALLET_ADDRESS");
  if (!cfg.stabilityAssetAddress || !ethers.isAddress(cfg.stabilityAssetAddress)) missing.push("STABILITY_ASSET_ADDRESS");
  if (missing.length > 0) {
    console.error(`\n  ABORT: missing/invalid env var(s): ${missing.join(", ")}`);
    console.error("  Set them in .env.local before running the deployment.");
    return 1;
  }

  const deployment: Record<string, unknown> = {
    chain: cfg.chainName,
    chainId,
    rpc: cfg.rpcUrl,
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
    contracts: {} as Record<string, { address: string; tx: string }>,
  };

  // ============================================================
  // Step 1: Deploy MTQSigmaV3
  // ============================================================
  logStep(1, "Deploy MTQSigmaV3...");
  const v3Factory = new ethers.ContractFactory(v3Art.abi, v3Art.bytecode.object, wallet);
  const v3Deployed = await v3Factory.deploy();
  await v3Deployed.waitForDeployment();
  const v3Addr = await v3Deployed.getAddress();
  const v3Tx = v3Deployed.deploymentTransaction()?.hash ?? "";
  logOk(`MTQSigmaV3 deployed:  ${v3Addr}`);
  logOk(`tx:                   ${v3Tx}`);
  (deployment.contracts as Record<string, { address: string; tx: string }>).MTQSigmaV3 = { address: v3Addr, tx: v3Tx };

  const v3 = new ethers.Contract(v3Addr, V3_ABI, wallet);

  // Verify deployer has DEFAULT_ADMIN_ROLE (constructor grants it to msg.sender)
  const DEFAULT_ADMIN = await v3.DEFAULT_ADMIN_ROLE();
  const hasAdmin = await v3.hasRole(DEFAULT_ADMIN, wallet.address);
  if (!hasAdmin) {
    console.error("  ABORT: deployer does not have DEFAULT_ADMIN_ROLE post-deploy (constructor bug?).");
    return 1;
  }
  logOk(`Deployer has DEFAULT_ADMIN_ROLE (acts as ORACLE_ROLE + Constitutional Council for setup)`);

  // ============================================================
  // Step 2: Deploy ChainlinkAdapter(admin = deployer)
  // ============================================================
  logStep(2, "Deploy ChainlinkAdapter...");
  const clFactory = new ethers.ContractFactory(clArt.abi, clArt.bytecode.object, wallet);
  const cl = await clFactory.deploy(wallet.address);
  await cl.waitForDeployment();
  const clAddr = await cl.getAddress();
  const clTx = cl.deploymentTransaction()?.hash ?? "";
  logOk(`ChainlinkAdapter deployed: ${clAddr}`);
  logOk(`tx:                        ${clTx}`);
  (deployment.contracts as Record<string, { address: string; tx: string }>).ChainlinkAdapter = { address: clAddr, tx: clTx };

  // ============================================================
  // Step 3: Deploy PythAdapter(admin = deployer)
  // ============================================================
  logStep(3, "Deploy PythAdapter...");
  const pyFactory = new ethers.ContractFactory(pyArt.abi, pyArt.bytecode.object, wallet);
  const py = await pyFactory.deploy(wallet.address);
  await py.waitForDeployment();
  const pyAddr = await py.getAddress();
  const pyTx = py.deploymentTransaction()?.hash ?? "";
  logOk(`PythAdapter deployed: ${pyAddr}`);
  logOk(`tx:                    ${pyTx}`);
  (deployment.contracts as Record<string, { address: string; tx: string }>).PythAdapter = { address: pyAddr, tx: pyTx };

  // ============================================================
  // Step 4: Deploy ChronicleAdapter(admin = deployer)
  // ============================================================
  logStep(4, "Deploy ChronicleAdapter...");
  const chFactory = new ethers.ContractFactory(chArt.abi, chArt.bytecode.object, wallet);
  const ch = await chFactory.deploy(wallet.address);
  await ch.waitForDeployment();
  const chAddr = await ch.getAddress();
  const chTx = ch.deploymentTransaction()?.hash ?? "";
  logOk(`ChronicleAdapter deployed: ${chAddr}`);
  logOk(`tx:                        ${chTx}`);
  (deployment.contracts as Record<string, { address: string; tx: string }>).ChronicleAdapter = { address: chAddr, tx: chTx };

  // ============================================================
  // Step 5: Wire adapters to V3
  //   source: 0=Chainlink, 1=Pyth, 2=Chronicle
  //   setOracleAdapter is onlyRole(ORACLE_ROLE); deployer (DEFAULT_ADMIN) qualifies.
  // ============================================================
  logStep(5, "Wire 3 oracle adapters to MTQSigmaV3 via setOracleAdapter...");
  const tx1 = await v3.setOracleAdapter(0, clAddr);
  await tx1.wait();
  logOk(`setOracleAdapter(0, ${clAddr})  [Chainlink]  tx=${tx1.hash}`);

  const tx2 = await v3.setOracleAdapter(1, pyAddr);
  await tx2.wait();
  logOk(`setOracleAdapter(1, ${pyAddr})  [Pyth]       tx=${tx2.hash}`);

  const tx3 = await v3.setOracleAdapter(2, chAddr);
  await tx3.wait();
  logOk(`setOracleAdapter(2, ${chAddr})  [Chronicle]  tx=${tx3.hash}`);

  // ============================================================
  // Step 6: Authorize the pilot bank
  //   authorizeBank is onlyConstitutionalCouncil; deployer (DEFAULT_ADMIN) qualifies.
  // ============================================================
  logStep(6, "Authorize the pilot bank...");
  const dailyCapWei = BigInt(Math.round(cfg.pilotBankDailyCapUsd)) * 10n ** 18n;
  const tx4 = await v3.authorizeBank(
    cfg.pilotBankAddress,
    cfg.pilotBankName,
    cfg.pilotBankJurisdiction,
    dailyCapWei,
  );
  await tx4.wait();
  logOk(`authorizeBank(${cfg.pilotBankAddress}, "${cfg.pilotBankName}", "${cfg.pilotBankJurisdiction}", ${cfg.pilotBankDailyCapUsd}e18)  tx=${tx4.hash}`);

  // ============================================================
  // Step 7: Set the fee wallet
  // ============================================================
  logStep(7, "Set the fee wallet...");
  const tx5 = await v3.setFeeWallet(cfg.feeWalletAddress);
  await tx5.wait();
  logOk(`setFeeWallet(${cfg.feeWalletAddress})  tx=${tx5.hash}`);

  // ============================================================
  // Step 8: Initialize the stability pool asset (USDC)
  // ============================================================
  logStep(8, "Initialize the stability pool asset (USDC)...");
  const tx6 = await v3.setStabilityAsset(cfg.stabilityAssetAddress);
  await tx6.wait();
  logOk(`setStabilityAsset(${cfg.stabilityAssetAddress})  tx=${tx6.hash}`);

  // ============================================================
  // Step 9: Verify deployment
  // ============================================================
  logStep(9, "Verify deployment...");
  const vCl = await v3.chainlinkAdapter();
  const vPy = await v3.pythAdapter();
  const vCh = await v3.chronicleAdapter();
  const vFee = await v3.feeWallet();
  const vAsset = await v3.stabilityAsset();
  const bankCount = await v3.authorizedBankCount();
  const bank = await v3.getBank(cfg.pilotBankAddress);
  const paused = await v3.paused();

  logOk(`chainlinkAdapter  = ${vCl}`);
  logOk(`pythAdapter       = ${vPy}`);
  logOk(`chronicleAdapter  = ${vCh}`);
  logOk(`feeWallet         = ${vFee}`);
  logOk(`stabilityAsset    = ${vAsset}`);
  logOk(`authorizedBanks   = ${bankCount.toString()}`);
  logOk(`pilot bank record = { authorized: ${bank.isAuthorized}, dailyCap: ${ethers.formatEther(bank.dailyMintCap)} USD, jurisdiction: "${bank.jurisdiction}" }`);
  logOk(`paused            = ${paused}`);

  const wiringOk =
    vCl.toLowerCase() === clAddr.toLowerCase() &&
    vPy.toLowerCase() === pyAddr.toLowerCase() &&
    vCh.toLowerCase() === chAddr.toLowerCase() &&
    vFee.toLowerCase() === cfg.feeWalletAddress.toLowerCase() &&
    vAsset.toLowerCase() === cfg.stabilityAssetAddress.toLowerCase() &&
    bank.isAuthorized === true &&
    bankCount === 1n;

  deployment.verify = {
    chainlinkAdapter: vCl,
    pythAdapter: vPy,
    chronicleAdapter: vCh,
    feeWallet: vFee,
    stabilityAsset: vAsset,
    authorizedBankCount: bankCount.toString(),
    pilotBankAuthorized: bank.isAuthorized,
    paused,
    wiringOk,
  };

  // ============================================================
  // Step 10: Save deployment JSON
  // ============================================================
  logStep(10, "Save deployment JSON...");
  if (!existsSync(cfg.outDir)) {
    mkdirSync(cfg.outDir, { recursive: true });
  }
  const outFile = join(cfg.outDir, `MTQSigmaV3-${chainId}.json`);
  writeFileSync(outFile, JSON.stringify(deployment, null, 2) + "\n", "utf8");
  logOk(`Deployment JSON written: ${outFile}`);

  // Final summary
  banner("DEPLOYMENT SUMMARY");
  console.log(`  MTQSigmaV3:         ${v3Addr}`);
  console.log(`  ChainlinkAdapter:   ${clAddr}`);
  console.log(`  PythAdapter:        ${pyAddr}`);
  console.log(`  ChronicleAdapter:   ${chAddr}`);
  console.log(`  Pilot bank:         ${cfg.pilotBankAddress} (authorized, cap ${cfg.pilotBankDailyCapUsd} USD/day)`);
  console.log(`  Fee wallet:         ${cfg.feeWalletAddress}`);
  console.log(`  Stability asset:    ${cfg.stabilityAssetAddress}`);
  console.log(`  Wiring OK:          ${wiringOk}`);
  console.log(`  Deployment JSON:    ${outFile}`);
  console.log("");
  if (!wiringOk) {
    console.error("  WARNING: wiring verification failed — review the verify block above.");
    return 1;
  }
  console.log("  MTQΣ V3 deployment complete. Pilot bank authorized; oracle adapters wired.");
  console.log("");
  console.log("  NEXT STEPS (production hardening — NOT done by this script):");
  console.log("    - Deploy 4 Safe multi-sigs (Constitutional/Emergency/Monetary/Risk)");
  console.log("    - Run scripts/transfer-ownership.ts to move DEFAULT_ADMIN to the Safe");
  console.log("    - Wire real Chainlink/Pyth/Chronicle feed addresses via deploy-oracle-adapters.ts");
  console.log("    - Engage external security audit (G8) before any mainnet authorization");
  console.log("");
  console.log("  REMINDER: V3 is NOT production-authorized until all 11 §25.5 validation gates pass.");

  return 0;
}

// ============================================================
//  Entry point
// ============================================================

async function main(): Promise<void> {
  banner("MTQΣ V3 Deployment Script");
  console.log("  Deploys MTQSigmaV3 + 3 oracle adapters + wires them + authorizes pilot bank.");
  console.log("  Safe to dry-run: missing DEPLOYER_PRIVATE_KEY / RPC_URL → prints plan only.\n");

  const cfg = loadConfig();

  // Dry-run if no key or no RPC
  if (!cfg.deployerKey || !cfg.rpcUrl) {
    dryRunPrint(cfg);
    return;
  }

  try {
    const rc = await deploy(cfg);
    process.exit(rc);
  } catch (e) {
    console.error("\nDEPLOYMENT FAILED:");
    console.error(e instanceof Error ? e.stack || e.message : e);
    process.exit(1);
  }
}

main();
