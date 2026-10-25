/**
 * MTQΣ — CANONICAL Testnet Deployment + Full Role Architecture
 * ============================================================
 * Deploys the CANONICAL deployable contract generation:
 *
 *   1. MTQSigmaV2 (V3 audited rewrite — 24,314 B deployed, 30/30 Foundry
 *      tests) with constructor(_usdc). NOT the v3 draft (non-deployable
 *      per audit C-044: 40,408 B > 24,576 B EIP-170).
 *   2. ChainlinkAdapter + PythAdapter + ChronicleAdapter (1,306 /
 *      1,433 / 1,139 B — interface-identical IOracleAdapter).
 *   3. Full genesis sequence: setReserveVault, setGenesisReserve,
 *      seedGenesisWeights, genesisIndex, bootstrapReserveHoldings,
 *      genesisMint.
 *   4. FULL ROLE ARCHITECTURE — every role granted to its designated
 *      holder, per ROLE_ROTATION.md §2.1 (grant-before-revoke) and the
 *      blueprint's Listing 14 governance layers.
 *   5. Live verification: hasRole() read for EVERY (role, holder) pair.
 *   6. Writes contracts/deployments/MTQSigmaV3-<chainId>.json with every
 *      address + every role assignment.
 *
 * Usage (owner-controlled session — see ROLE_ROTATION.md §7):
 *   DEPLOYER_PRIVATE_KEY=... RPC_URL=... bun run scripts/deploy-canonical.ts
 *
 * DRY-RUN (default, no key): prints the complete plan incl. the full
 * role→holder matrix and exits 0 WITHOUT sending any transaction.
 *
 * ⚠️ SECURITY (C-045-a, CRITICAL-PRIVATE-KEY-ROTATION.md):
 *   - The OLD deployer key 0x3C39…c8d8c is COMPROMISED — NEVER use it.
 *     Deploy only with a FRESH key funded from the target testnet faucet.
 *   - The key is read from the environment only (never repo/chat/logs).
 *   - Per the pilot rules the deployer EOA receives DEFAULT_ADMIN_ROLE at
 *     construction; the script then grants every operational role to the
 *     governance holders. Rotating DEFAULT_ADMIN to the Safe (grant →
 *     verify → revoke deployer) is executed ONLY if both SAFE_ADDRESS and
 *     ROTATE_ADMIN=true are provided (grant-before-revoke enforced).
 */

import { ethers } from "ethers";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

// ============================================================
//  Foundry artifact loader (same contract as deploy-v3.ts)
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
      `Run \`forge build\` in /contracts first (solc 0.8.36 + via_ir + runs=1).`,
    );
  }
  const raw = JSON.parse(readFileSync(full, "utf8")) as FoundryArtifact;
  if (!raw?.bytecode?.object || raw.bytecode.object === "0x") {
    throw new Error(`Artifact ${relPath} has empty bytecode — recompile with forge.`);
  }
  return raw;
}

// ============================================================
//  Configuration (all env-driven; every address is explicit)
// ============================================================

interface DeployConfig {
  chainName: string;
  chainId: number;
  rpcUrl: string;
  deployerKey: string | null;

  // Collateral + treasury
  usdcAddress: string;

  // Governance holders — THE ROLE ARCHITECTURE (all required to execute)
  safeAddress: string;          // multi-sig → DEFAULT_ADMIN + PAUSER target
  keeperAddress: string;        // KEEPER_ROLE (MARP keeper / MASE submitter)
  oracleAddress: string;        // ORACLE_ROLE (oracle committee / adapter admin)
  pauserAddress: string;         // PAUSER_ROLE (emergency pauser)
  daoAdminAddress: string;      // ADMIN_ROLE (DAO / timelock)
  daoAddress: string;           // §2.7 governance body: DAO
  riskCouncilAddress: string;   // §2.7 governance body: Risk Council
  emergencyCouncilAddress: string;   // §2.7: Emergency Council
  constitutionalCouncilAddress: string; // §2.7: Constitutional Council (7/7)

  // Genesis economics
  reserveVaultAddress: string;  // USDC collateral vault (H5: != 0)
  genesisReserveAddress: string; // locked genesis MTQ holder
  genesisMintAmount: string;    // 18-dec wei (default 1,000,000 MTQ)
  bootstrapNavUsd: string;      // 18-dec USD (default 1,100,000)

  // Post-deploy admin rotation (grant-before-revoke)
  rotateAdmin: boolean;

  outDir: string;
}

const env = (k: string): string => (process.env[k] ?? "").trim();

function loadConfig(): DeployConfig {
  return {
    chainName: env("MTQ_V3_CHAIN_NAME") || "Target Testnet",
    chainId: env("MTQ_V3_CHAIN_ID") ? Number(env("MTQ_V3_CHAIN_ID")) : 0,
    rpcUrl: env("RPC_URL"),
    deployerKey: env("DEPLOYER_PRIVATE_KEY") || null,

    usdcAddress: env("USDC_ADDRESS"),

    safeAddress: env("SAFE_ADDRESS"),
    keeperAddress: env("KEEPER_ADDRESS"),
    oracleAddress: env("ORACLE_ADDRESS"),
    pauserAddress: env("PAUSER_ADDRESS"),
    daoAdminAddress: env("DAO_ADMIN_ADDRESS"),
    daoAddress: env("DAO_ADDRESS"),
    riskCouncilAddress: env("RISK_COUNCIL_ADDRESS"),
    emergencyCouncilAddress: env("EMERGENCY_COUNCIL_ADDRESS"),
    constitutionalCouncilAddress: env("CONSTITUTIONAL_COUNCIL_ADDRESS"),

    reserveVaultAddress: env("RESERVE_VAULT_ADDRESS"),
    genesisReserveAddress: env("GENESIS_RESERVE_ADDRESS"),
    genesisMintAmount: env("GENESIS_MINT_AMOUNT") || "1000000000000000000000000", // 1M × 1e18
    bootstrapNavUsd: env("BOOTSTRAP_NAV_USD") || "1100000000000000000000000",     // $1.1M × 1e18

    rotateAdmin: env("ROTATE_ADMIN") === "true" && !!env("SAFE_ADDRESS"),

    outDir: env("DEPLOYMENT_OUT_DIR") || resolve(__dirname, "..", "contracts", "deployments"),
  };
}

// ============================================================
//  Minimal ABIs (full ABIs live in the artifacts)
// ============================================================

const CORE_ABI = [
  "constructor(address _usdc)",
  "function setReserveVault(address v) external",
  "function setGenesisReserve(address g) external",
  "function seedGenesisWeights() external",
  "function genesisIndex() external",
  "function bootstrapReserveHoldings(uint256[7] calldata holdings) external",
  "function genesisMint(uint256 amount) external",
  "function setOracleAdapter(uint8 source, address adapter) external",
  "function grantRole(bytes32 role, address account) external",
  "function revokeRole(bytes32 role, address account) external",
  "function hasRole(bytes32 role, address account) external view returns (bool)",
  "function setDao(address a) external",
  "function setRiskCouncil(address a) external",
  "function setEmergencyCouncil(address a) external",
  "function setConstitutionalCouncil(address a) external",
  "function DEFAULT_ADMIN_ROLE() external view returns (bytes32)",
  "function ADMIN_ROLE() external view returns (bytes32)",
  "function MINTER_ROLE() external view returns (bytes32)",
  "function PAUSER_ROLE() external view returns (bytes32)",
  "function KEEPER_ROLE() external view returns (bytes32)",
  "function ORACLE_ROLE() external view returns (bytes32)",
  "function paused() external view returns (bool)",
  "function getMTQPrice() external view returns (uint256)",
  "function indexValue() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "function getHonestStatus() external view returns (uint256, uint8, uint8, string memory, bytes32)",
] as const;

const ADAPTER_ABI = [
  "constructor(address _oracleAdmin)",
  "function oracleAdmin() external view returns (address)",
] as const;

// ============================================================
//  Helpers
// ============================================================

function banner(line: string): void {
  const bar = "=".repeat(Math.max(8, 70 - line.length));
  console.log(`\n${bar} ${line} ${bar}`);
}

function logStep(n: number, msg: string): void { console.log(`\n  Step ${n}: ${msg}`); }
function logOk(msg: string): void { console.log(`    ✓ ${msg}`); }

function addrOrPlaceholder(a: string, name: string): string {
  return a || `<${name}>`;
}

/** The blueprint's Strategic Prior — used for the genesis reserve split. */
function strategicPriorSplit(navWei: bigint): bigint[] {
  const W = [27n, 20n, 9n, 8n, 5n, 5n, 26n]; // USD EUR JPY GBP CNY CHF GOLD (percent)
  const total = W.reduce((a, b) => a + b, 0n); // 100
  return W.map((w) => (navWei * w) / total);
}

// ============================================================
//  DRY RUN — the complete plan, zero transactions
// ============================================================

function dryRun(cfg: DeployConfig): number {
  banner("DRY RUN — canonical deployment plan (no transactions)");
  console.log("\n  Target chain:      " + `${cfg.chainName} (chainId ${cfg.chainId || "?"})`);
  console.log("  RPC URL:           " + (cfg.rpcUrl || "(unset)"));
  console.log("  Deployer:          (fresh funded key — NEVER the compromised 0x3C39…c8d8c)");
  console.log("\n  Would deploy:");
  console.log("    1. MTQSigmaV2(_usdc)          — canonical contract (24,314 B runtime)");
  console.log("       constructor grants DEFAULT_ADMIN_ROLE to the deployer (P1)");
  console.log("    2. ChainlinkAdapter(deployer) — oracle adapter slot 0 (1,306 B)");
  console.log("    3. PythAdapter(deployer)      — oracle adapter slot 1 (1,433 B)");
  console.log("    4. ChronicleAdapter(deployer) — oracle adapter slot 2 (1,139 B)");
  console.log("\n  Genesis sequence (one-shot, ordered):");
  console.log(`    5.  setReserveVault(${addrOrPlaceholder(cfg.reserveVaultAddress, "RESERVE_VAULT_ADDRESS")})`);
  console.log(`    6.  setGenesisReserve(${addrOrPlaceholder(cfg.genesisReserveAddress, "GENESIS_RESERVE_ADDRESS")})`);
  console.log("    7.  seedGenesisWeights()        — Strategic Prior [27/20/9/8/5/5/26]%");
  console.log("    8.  genesisIndex()              — I_0 = 1.0000, P_MTQ = $1.00");
  console.log(`    9.  bootstrapReserveHoldings(NAV=${cfg.bootstrapNavUsd} split at Strategic Prior)`);
  console.log(`    10. genesisMint(${cfg.genesisMintAmount} wei = 1,000,000 MTQ locked to genesis reserve)`);
  console.log("    11. setOracleAdapter(0/1/2, chainlink/pyth/chronicle)");
  console.log("\n  ROLE ARCHITECTURE — grantRole for every (role → holder):");
  console.log(`    12. KEEPER_ROLE            → ${addrOrPlaceholder(cfg.keeperAddress, "KEEPER_ADDRESS")}            (MARP keeper · MASE submitter · index advancer)`);
  console.log(`    13. ORACLE_ROLE            → ${addrOrPlaceholder(cfg.oracleAddress, "ORACLE_ADDRESS")}            (oracle committee · adapter feeds admin)`);
  console.log(`    14. PAUSER_ROLE            → ${addrOrPlaceholder(cfg.pauserAddress, "PAUSER_ADDRESS")}            (emergency pause/unpause)`);
  console.log(`    15. ADMIN_ROLE             → ${addrOrPlaceholder(cfg.daoAdminAddress, "DAO_ADMIN_ADDRESS")}             (DAO timelock · operational admin)`);
  console.log("        Governance bodies (§2.7, onlyConstitutionalCouncil setters):");
  console.log(`    16. setDao(${addrOrPlaceholder(cfg.daoAddress, "DAO_ADDRESS")})`);
  console.log(`    17. setRiskCouncil(${addrOrPlaceholder(cfg.riskCouncilAddress, "RISK_COUNCIL_ADDRESS")})`);
  console.log(`    18. setEmergencyCouncil(${addrOrPlaceholder(cfg.emergencyCouncilAddress, "EMERGENCY_COUNCIL_ADDRESS")})`);
  console.log(`    19. setConstitutionalCouncil(${addrOrPlaceholder(cfg.constitutionalCouncilAddress, "CONSTITUTIONAL_COUNCIL_ADDRESS")})`);
  console.log(`\n  Admin rotation (grant-before-revoke): ${cfg.rotateAdmin ? "WILL rotate DEFAULT_ADMIN → Safe" : "SKIPPED (set ROTATE_ADMIN=true + SAFE_ADDRESS to execute)"}`);
  if (cfg.rotateAdmin) {
    console.log("    20. grantRole(DEFAULT_ADMIN_ROLE, Safe)  → verify hasRole → ONLY THEN");
    console.log("    21. revokeRole(DEFAULT_ADMIN_ROLE, deployer) → verify gone");
  }
  console.log("\n  Verification battery (read-only): hasRole × every pair, paused()==false,");
  console.log("  getMTQPrice()==1e18, indexValue()==1e18, totalSupply()==1M×1e18,");
  console.log("  getHonestStatus().mask==0x7FF");
  console.log(`\n  Writes: ${join(cfg.outDir, "MTQSigmaV3-" + (cfg.chainId || "<chainId>") + ".json")}`);
  console.log("\n  To execute, set: RPC_URL, DEPLOYER_PRIVATE_KEY (FRESH funded key),");
  console.log("  USDC_ADDRESS + all 10 governance/genesis address env vars.");
  console.log("  NEVER use the compromised 0x3C39…c8d8c key (C-045-a).");
  return 0;
}

// ============================================================
//  Main
// ============================================================

async function main(): Promise<number> {
  const cfg = loadConfig();
  if (!cfg.deployerKey || !cfg.rpcUrl) {
    return dryRun(cfg);
  }

  banner(`MTQΣ CANONICAL Deployment — ${cfg.chainName}`);

  // Pre-flight: every address env var must be set and non-zero.
  const required: [string, string][] = [
    ["USDC_ADDRESS", cfg.usdcAddress],
    ["KEEPER_ADDRESS", cfg.keeperAddress],
    ["ORACLE_ADDRESS", cfg.oracleAddress],
    ["PAUSER_ADDRESS", cfg.pauserAddress],
    ["DAO_ADMIN_ADDRESS", cfg.daoAdminAddress],
    ["DAO_ADDRESS", cfg.daoAddress],
    ["RISK_COUNCIL_ADDRESS", cfg.riskCouncilAddress],
    ["EMERGENCY_COUNCIL_ADDRESS", cfg.emergencyCouncilAddress],
    ["CONSTITUTIONAL_COUNCIL_ADDRESS", cfg.constitutionalCouncilAddress],
    ["RESERVE_VAULT_ADDRESS", cfg.reserveVaultAddress],
    ["GENESIS_RESERVE_ADDRESS", cfg.genesisReserveAddress],
  ];
  const missing = required.filter(([, v]) => !v || !/^0x[a-fA-F0-9]{40}$/.test(v)).map(([k]) => k);
  if (missing.length > 0) {
    console.error(`\n  Missing/invalid address env vars: ${missing.join(", ")}`);
    console.error("  The role architecture is explicit by design — no silent defaults.");
    return 1;
  }

  const provider = new ethers.JsonRpcProvider(cfg.rpcUrl);
  const wallet = new ethers.Wallet(cfg.deployerKey, provider);
  const net = await provider.getNetwork();
  const deployer = wallet.address;
  const balance = await provider.getBalance(deployer);
  console.log(`\n  Chain ID:   ${net.chainId.toString()}${cfg.chainId && Number(net.chainId) !== cfg.chainId ? ` (WARNING: expected ${cfg.chainId})` : ""}`);
  console.log(`  Deployer:   ${deployer}`);
  console.log(`  Balance:    ${ethers.formatEther(balance)} native`);
  if (balance === 0n) {
    console.error("  Deployer has ZERO balance — fund it from the testnet faucet first.");
    return 1;
  }

  // Guard: the compromised key must NEVER sign (C-045-a).
  const COMPROMISED = "0x3c3932f865892efabe45892f453f81b64f6c8d8c";
  if (deployer.toLowerCase() === COMPROMISED) {
    console.error("\n  ✗ ABORT: this is the COMPROMISED deployer key (C-045-a).");
    console.error("    Deploying with it would place the entire new estate under a");
    console.error("    publicly-exposed key. Use a FRESH funded key. Never this one.");
    return 1;
  }

  const core = loadArtifact("MTQSigmaV2.sol/MTQSigmaV2.json");
  const cl = loadArtifact("ChainlinkAdapter.sol/ChainlinkAdapter.json");
  const pyth = loadArtifact("PythAdapter.sol/PythAdapter.json");
  const chron = loadArtifact("ChronicleAdapter.sol/ChronicleAdapter.json");

  const Core = new ethers.ContractFactory(core.abi, core.bytecode.object, wallet);
  const Adapter = new ethers.ContractFactory(cl.abi, cl.bytecode.object, wallet);

  async function send(label: string, txPromise: Promise<ethers.ContractTransactionResponse>): Promise<ethers.ContractTransactionResponse> {
    const tx = await txPromise;
    process.stdout.write(`    → ${label} (tx ${tx.hash.slice(0, 18)}…) `);
    await tx.wait();
    console.log("✓");
    return tx;
  }

  // ---- Deploys ----
  logStep(1, "Deploy MTQSigmaV2 (canonical, 24,314 B runtime)");
  const mtq = (await (await Core.deploy(cfg.usdcAddress)).waitForDeployment()) as ethers.Contract;
  const mtqAddr = await mtq.getAddress();
  logOk(`MTQSigmaV2 @ ${mtqAddr}`);

  logStep(2, "Deploy ChainlinkAdapter");
  const chainlink = (await (await Adapter.deploy(deployer)).waitForDeployment()) as ethers.Contract;
  logOk(`ChainlinkAdapter @ ${await chainlink.getAddress()}`);

  logStep(3, "Deploy PythAdapter");
  const PythAdapter = new ethers.ContractFactory(pyth.abi, pyth.bytecode.object, wallet);
  const pythAdapter = (await (await PythAdapter.deploy(deployer)).waitForDeployment()) as ethers.Contract;
  logOk(`PythAdapter @ ${await pythAdapter.getAddress()}`);

  logStep(4, "Deploy ChronicleAdapter");
  const ChronAdapter = new ethers.ContractFactory(chron.abi, chron.bytecode.object, wallet);
  const chronAdapter = (await (await ChronAdapter.deploy(deployer)).waitForDeployment()) as ethers.Contract;
  logOk(`ChronicleAdapter @ ${await chronAdapter.getAddress()}`);

  // ---- Genesis sequence (ordered, one-shot) ----
  logStep(5, "setReserveVault");
  await send("setReserveVault", mtq.setReserveVault(cfg.reserveVaultAddress));

  logStep(6, "setGenesisReserve");
  await send("setGenesisReserve", mtq.setGenesisReserve(cfg.genesisReserveAddress));

  logStep(7, "seedGenesisWeights + genesisIndex");
  await send("seedGenesisWeights", mtq.seedGenesisWeights());
  await send("genesisIndex", mtq.genesisIndex());

  logStep(8, "bootstrapReserveHoldings (Strategic Prior split of NAV)");
  const holdings = strategicPriorSplit(BigInt(cfg.bootstrapNavUsd));
  await send("bootstrapReserveHoldings", mtq.bootstrapReserveHoldings(holdings));

  logStep(9, `genesisMint (${cfg.genesisMintAmount} wei)`);
  await send("genesisMint", mtq.genesisMint(cfg.genesisMintAmount));

  logStep(10, "Wire oracle adapters (slots 0/1/2)");
  await send("setOracleAdapter(0)", mtq.setOracleAdapter(0, await chainlink.getAddress()));
  await send("setOracleAdapter(1)", mtq.setOracleAdapter(1, await pythAdapter.getAddress()));
  await send("setOracleAdapter(2)", mtq.setOracleAdapter(2, await chronAdapter.getAddress()));

  // ---- ROLE ARCHITECTURE (explicit, per ROLE_ROTATION.md §2.1) ----
  const KEEPER = await mtq.KEEPER_ROLE();
  const ORACLE = await mtq.ORACLE_ROLE();
  const PAUSER = await mtq.PAUSER_ROLE();
  const ADMIN = await mtq.ADMIN_ROLE();
  const DEFAULT_ADMIN = await mtq.DEFAULT_ADMIN_ROLE();

  logStep(11, "grantRole — KEEPER / ORACLE / PAUSER / ADMIN");
  await send("KEEPER_ROLE → " + cfg.keeperAddress, mtq.grantRole(KEEPER, cfg.keeperAddress));
  await send("ORACLE_ROLE → " + cfg.oracleAddress, mtq.grantRole(ORACLE, cfg.oracleAddress));
  await send("PAUSER_ROLE → " + cfg.pauserAddress, mtq.grantRole(PAUSER, cfg.pauserAddress));
  await send("ADMIN_ROLE → " + cfg.daoAdminAddress, mtq.grantRole(ADMIN, cfg.daoAdminAddress));

  logStep(12, "Set the 4 governance bodies (§2.7)");
  await send("setDao", mtq.setDao(cfg.daoAddress));
  await send("setRiskCouncil", mtq.setRiskCouncil(cfg.riskCouncilAddress));
  await send("setEmergencyCouncil", mtq.setEmergencyCouncil(cfg.emergencyCouncilAddress));
  await send("setConstitutionalCouncil", mtq.setConstitutionalCouncil(cfg.constitutionalCouncilAddress));

  // ---- Optional grant-before-revoke admin rotation ----
  if (cfg.rotateAdmin) {
    logStep(13, `Rotate DEFAULT_ADMIN → Safe ${cfg.safeAddress} (grant → verify → revoke)`);
    await send("grantRole(DEFAULT_ADMIN, Safe)", mtq.grantRole(DEFAULT_ADMIN, cfg.safeAddress));
    const safeHolds = await mtq.hasRole(DEFAULT_ADMIN, cfg.safeAddress);
    if (!safeHolds) throw new Error("Safe does not hold DEFAULT_ADMIN after grant — ABORT before revoke (grant-before-revoke rule).");
    logOk("verified Safe holds DEFAULT_ADMIN");
    await send("revokeRole(DEFAULT_ADMIN, deployer)", mtq.revokeRole(DEFAULT_ADMIN, deployer));
    const still = await mtq.hasRole(DEFAULT_ADMIN, deployer);
    if (still) throw new Error("Deployer STILL holds DEFAULT_ADMIN after revoke — rotation incomplete!");
    logOk("verified deployer holds NO admin role");
  }

  // ---- Verification battery ----
  logStep(14, "Verification battery (read-only)");
  const checks: { check: string; ok: boolean }[] = [];
  const pairs: [string, string, string][] = [
    ["KEEPER_ROLE", KEEPER, cfg.keeperAddress],
    ["ORACLE_ROLE", ORACLE, cfg.oracleAddress],
    ["PAUSER_ROLE", PAUSER, cfg.pauserAddress],
    ["ADMIN_ROLE", ADMIN, cfg.daoAdminAddress],
    ["DEFAULT_ADMIN_ROLE", DEFAULT_ADMIN, cfg.rotateAdmin ? cfg.safeAddress : deployer],
  ];
  for (const [name, role, holder] of pairs) {
    const ok = await mtq.hasRole(role, holder);
    checks.push({ check: `hasRole(${name}, ${holder}) = true`, ok });
  }
  checks.push({ check: "paused() == false", ok: !(await mtq.paused()) });
  checks.push({ check: "getMTQPrice() == 1e18", ok: (await mtq.getMTQPrice()) === 10n ** 18n });
  checks.push({ check: "indexValue() == 1e18", ok: (await mtq.indexValue()) === 10n ** 18n });
  checks.push({ check: `totalSupply() == ${cfg.genesisMintAmount}`, ok: (await mtq.totalSupply()) === BigInt(cfg.genesisMintAmount) });
  const status = await mtq.getHonestStatus();
  checks.push({ check: "getHonestStatus().mask == 0x7FF", ok: status[0] === 0x7ffn });
  let allOk = true;
  for (const c of checks) {
    console.log(`    ${c.ok ? "✓" : "✗"} ${c.check}`);
    if (!c.ok) allOk = false;
  }

  // ---- Deployment record ----
  const record = {
    contract: "MTQSigmaV2",
    generation: "canonical-deployable (V3 audited rewrite)",
    network: cfg.chainName,
    chainId: Number(net.chainId),
    deployedAt: new Date().toISOString(),
    deployer,
    deployerNote:
      cfg.rotateAdmin
        ? "fresh key; DEFAULT_ADMIN rotated to Safe post-genesis (grant-before-revoke verified)"
        : "fresh key; DEFAULT_ADMIN still on deployer EOA — ROTATE to the 4/7 Safe before any public use (RUNBOOK §6)",
    addresses: {
      mtqSigmaV3: mtqAddr,
      chainlinkAdapter: await chainlink.getAddress(),
      pythAdapter: await pythAdapter.getAddress(),
      chronicleAdapter: await chronAdapter.getAddress(),
      usdc: cfg.usdcAddress,
      reserveVault: cfg.reserveVaultAddress,
      genesisReserve: cfg.genesisReserveAddress,
    },
    roles: {
      DEFAULT_ADMIN_ROLE: cfg.rotateAdmin ? cfg.safeAddress : deployer,
      ADMIN_ROLE: cfg.daoAdminAddress,
      KEEPER_ROLE: cfg.keeperAddress,
      ORACLE_ROLE: cfg.oracleAddress,
      PAUSER_ROLE: cfg.pauserAddress,
      MINTER_ROLE: "n/a — mint() has no MINTER gate; genesisMint one-shot (C5)",
    },
    governanceBodies: {
      dao: cfg.daoAddress,
      riskCouncil: cfg.riskCouncilAddress,
      emergencyCouncil: cfg.emergencyCouncilAddress,
      constitutionalCouncil: cfg.constitutionalCouncilAddress,
    },
    genesis: {
      weights: "Strategic Prior [27,20,9,8,5,5,26]% (seedGenesisWeights)",
      index: "I_0 = 1.0000 (genesisIndex), P_MTQ = $1.00 in band [0.50, 2.00]",
      bootstrapNavUsd: cfg.bootstrapNavUsd,
      genesisMintWei: cfg.genesisMintAmount,
    },
    compile: {
      solc: "0.8.36",
      viaIR: true,
      optimizerRuns: 1,
      bytecodeHash: "none",
      runtimeBytes: 24314,
      eip170Limit: 24576,
      tests: "30/30 MTQSigmaV2.t.sol + 26/26 draft workflow/stability (forge, this repo)",
    },
    verification: checks,
  };
  const outPath = join(cfg.outDir, `MTQSigmaV3-${Number(net.chainId)}.json`);
  mkdirSync(cfg.outDir, { recursive: true });
  writeFileSync(outPath, JSON.stringify(record, null, 2));
  console.log(`\n  Deployment record → ${outPath}`);

  banner(allOk ? "DEPLOYMENT COMPLETE — all verifications passed" : "DEPLOYMENT COMPLETE — SOME VERIFICATIONS FAILED (see record)");
  console.log(`
  MTQSigmaV3 (canonical): ${mtqAddr}
  ChainlinkAdapter:       ${await chainlink.getAddress()}
  PythAdapter:            ${await pythAdapter.getAddress()}
  ChronicleAdapter:      ${await chronAdapter.getAddress()}
  Roles: KEEPER→${cfg.keeperAddress} ORACLE→${cfg.oracleAddress} PAUSER→${cfg.pauserAddress} ADMIN→${cfg.daoAdminAddress} DEFAULT_ADMIN→${cfg.rotateAdmin ? cfg.safeAddress : deployer + " (ROTATE!)"}`);
  return allOk ? 0 : 2;
}

main().then((code) => process.exit(code)).catch((e) => {
  console.error("\n✗ Deployment failed:", (e as Error).message);
  process.exit(1);
});
