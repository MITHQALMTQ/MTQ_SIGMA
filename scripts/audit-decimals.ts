// MTQΣ — Cross-chain decimals + live transfer test audit.
// Reads the actual `decimals()`, `name()`, `symbol()`, `totalSupply()` from every
// deployed MTQ contract, then performs a live self-transfer (and on pilot-v2
// contracts a live mint+redeem) to prove the token is functional on each chain.

import { ethers } from "ethers";
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

interface Chain {
  key: string; label: string; chainId: number; rpc: string; explorer: string;
  mtq: string; collateral?: string; kind: "user-original" | "pilot-v2";
}

const CHAINS: Chain[] = [
  { key: "robinhood", label: "Robinhood Chain Testnet (46630)", chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", explorer: "https://explorer.testnet.chain.robinhood.com", mtq: "0xaf7cF40E37C00261E6B89D96371Da85Dd7b9b7af", collateral: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", kind: "pilot-v2" },
  { key: "arc-v2", label: "Arc Testnet — Pilot v2 (5042002)", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", explorer: "https://testnet.arcscan.app", mtq: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1", collateral: "0x334D14E7E39e1f02a60fc1169CdF7b0BEDE30dEb", kind: "pilot-v2" },
  { key: "arc-user", label: "Arc Testnet — user original (5042002)", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", explorer: "https://testnet.arcscan.app", mtq: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", kind: "user-original" },
  { key: "monad", label: "Monad Testnet — user original (10143)", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", explorer: "https://testnet.monadexplorer.com", mtq: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", kind: "user-original" },
];

const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const TEST_RECIPIENT = "0x000000000000000000000000000000000000dEaD"; // burn-style sink for safe transfer test

(async () => {
  console.log("================================================================");
  console.log("  MTQΣ — ON-CHAIN DECIMALS + LIVE FUNCTIONAL TEST");
  console.log("================================================================\n");

  for (const c of CHAINS) {
    console.log(`\n─── ${c.label} ───`);
    console.log(`  MTQ address: ${c.mtq}`);
    console.log(`  Explorer:    ${c.explorer}/address/${c.mtq}`);

    let provider: ethers.JsonRpcProvider;
    let wallet: ethers.Wallet;
    try {
      provider = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: c.key }, { staticNetwork: true });
      wallet = new ethers.Wallet(pk, provider);
    } catch (e: any) {
      console.log(`  ✗ provider setup failed: ${e.message?.slice(0, 80)}`);
      continue;
    }

    // RPC reachability
    try {
      const net = await Promise.race([provider.getNetwork(), new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 9000))]);
      console.log(`  RPC: ✓ reachable, chainId ${Number(net.chainId)}`);
    } catch (e: any) {
      console.log(`  ✗ RPC unreachable: ${e.message?.slice(0, 80)}`);
      continue;
    }

    // Code present?
    try {
      const code = await Promise.race([provider.getCode(c.mtq), new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 9000))]);
      if (!code || code === "0x") { console.log(`  ✗ no code at MTQ address`); continue; }
      console.log(`  Code: ✓ LIVE (${code.length} bytes)`);
    } catch (e: any) {
      console.log(`  ✗ getCode failed: ${e.message?.slice(0, 80)}`);
      continue;
    }

    const mtq = new ethers.Contract(c.mtq, ERC20_ABI, wallet);

    // --- Read name/symbol/decimals/supply ---
    let name = "?", symbol = "?", decimals = -1, totalSupply = "?", deployerBal = "?";
    try {
      name = await Promise.race([mtq.name(), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]);
      symbol = await Promise.race([mtq.symbol(), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]);
      decimals = Number(await Promise.race([mtq.decimals(), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]));
      const ts = await Promise.race([mtq.totalSupply(), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]);
      totalSupply = ethers.formatUnits(ts, decimals);
      const db = await Promise.race([mtq.balanceOf(DEPLOYER), new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000))]);
      deployerBal = ethers.formatUnits(db, decimals);
    } catch (e: any) {
      console.log(`  ✗ ERC-20 read failed: ${e.message?.slice(0, 80)}`);
      continue;
    }

    console.log(`\n  === ON-CHAIN TOKEN METADATA ===`);
    console.log(`  name:        ${name}`);
    console.log(`  symbol:      ${symbol}`);
    console.log(`  decimals:    ${decimals}  ← the decimal number you asked for`);
    console.log(`  totalSupply: ${totalSupply} ${symbol}`);
    console.log(`  deployer balance: ${deployerBal} ${symbol}`);

    // --- Live transfer test: send 1 smallest unit to the burn sink ---
    // This proves the token is transferable on-chain (ERC-20 functional).
    try {
      const oneUnit = BigInt(10) ** BigInt(decimals); // 1.0 token (in smallest unit)
      const deployerBalBig = await mtq.balanceOf(DEPLOYER);
      if (deployerBalBig >= oneUnit) {
        console.log(`\n  === LIVE TRANSFER TEST: send 1.0 ${symbol} to ${TEST_RECIPIENT} ===`);
        const tx = await mtq.transfer(TEST_RECIPIENT, oneUnit);
        console.log(`  tx: ${tx.hash}`);
        const rc = await tx.wait();
        console.log(`  status: ${rc?.status === 1 ? "SUCCESS ✓" : "FAILED ✗"}`);
        const sinkBal = await mtq.balanceOf(TEST_RECIPIENT);
        console.log(`  recipient ${TEST_RECIPIENT} now holds: ${ethers.formatUnits(sinkBal, decimals)} ${symbol} ✓`);
        console.log(`  view: ${c.explorer}/tx/${tx.hash}`);
      } else {
        console.log(`\n  ! deployer has insufficient balance for 1.0 ${symbol} transfer test (balance ${deployerBal}); skipping transfer`);
      }
    } catch (e: any) {
      console.log(`  ✗ transfer test failed: ${e.message?.slice(0, 100)}`);
    }

    // --- Pilot-v2 only: live mint + redeem test (proves the monetary closed loop) ---
    if (c.kind === "pilot-v2" && c.collateral) {
      console.log(`\n  === PILOT-v2 CLOSED-LOOP TEST (mint + redeem) ===`);
      const USDC_ABI = ["function balanceOf(address) view returns (uint256)", "function approve(address,uint256) returns (bool)"];
      const PILOT_ABI = [
        ...ERC20_ABI,
        "function getGFB() view returns (uint256)",
        "function getMTQPrice() view returns (uint256)",
        "function mint(uint256) returns (uint256)",
        "function redeem(uint256) returns (uint256)",
        "function getCirculatingSupply() view returns (uint256)",
      ];
      const usdc = new ethers.Contract(c.collateral, USDC_ABI, wallet);
      const mtqPilot = new ethers.Contract(c.mtq, PILOT_ABI, wallet);
      try {
        // Approve + mint 1,000 USDC → ~999 MTQ
        const mintAmount = 1_000n * 10n ** 6n;
        await (await usdc.approve(c.mtq, ethers.MaxUint256)).wait();
        const t1 = await mtqPilot.mint(mintAmount);
        const r1 = await t1.wait();
        const gfb = ethers.formatEther(await mtqPilot.getGFB());
        const price = ethers.formatEther(await mtqPilot.getMTQPrice());
        const circ = ethers.formatEther(await mtqPilot.getCirculatingSupply());
        const minted = parseFloat(circ);
        console.log(`  mint(1000 USDC): tx ${t1.hash.slice(0,18)}... status=${r1?.status===1?"✓":"✗"}`);
        console.log(`    GFB=${gfb} price=$${price} circulating=${circ} MTQ`);
        // Redeem 100 MTQ → ~$99.85 USDC
        const t2 = await mtqPilot.redeem(BigInt(100) * 10n ** 18n);
        const r2 = await t2.wait();
        const circ2 = ethers.formatEther(await mtqPilot.getCirculatingSupply());
        console.log(`  redeem(100 MTQ): tx ${t2.hash.slice(0,18)}... status=${r2?.status===1?"✓":"✗"}  circulating=${circ2} MTQ`);
        console.log(`  Closed loop verified on ${c.key} ✓`);
      } catch (e: any) {
        console.log(`  ✗ pilot closed-loop test failed: ${e.message?.slice(0, 100)}`);
      }
    } else if (c.kind === "user-original") {
      console.log(`\n  (user-original contract — only ERC-20 transfer tested; mint/redeem ABI differs, source not provided)`);
    }
  }

  // Solana
  console.log(`\n─── Solana Devnet — MTQ SPL Token ───`);
  console.log(`  Mint: GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4`);
  try {
    const r = await fetch("https://api.devnet.solana.com", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: ["GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4", { encoding: "jsonParsed" }] }),
      signal: AbortSignal.timeout(9000),
    });
    const j = await r.json() as any;
    const info = j?.result?.value?.data?.parsed?.info;
    if (info) {
      console.log(`  SPL mint authority: ${info.mintAuthority ?? "null (revoked)"}`);
      console.log(`  SPL supply (raw): ${info.supply}`);
      console.log(`  SPL decimals: ${info.decimals}  ← the decimal number you asked for (Solana)`);
      console.log(`  SPL token program: ${j?.result?.value?.owner}`);
      console.log(`  isNative: ${info.isNative}`);
    } else {
      console.log(`  account exists but parsed info unavailable`);
    }
  } catch (e: any) {
    console.log(`  ✗ Solana RPC failed: ${e.message?.slice(0, 80)}`);
  }
})();
