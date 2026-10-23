// MTQΣ — Live mint test against the freshly deployed Arc contract.
// Proves the deployed contract is fully functional (not just bytecode).

import { ethers } from "ethers";
import { readFileSync } from "fs";

const env = readFileSync(".env", "utf8");
const km = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m);
if (!km) { console.error("FAIL: no key"); process.exit(1); }
const privateKey = km[1];

const rpc = "https://rpc.testnet.arc.io";
const chainId = 5042002;
const MTQ_ADDR = "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1";
const USDC_ADDR = "0x334D14E7E39e1f02a60fc1169CdF7b0BEDE30dEb";

const provider = new ethers.JsonRpcProvider(rpc, { chainId, name: "Arc" }, { staticNetwork: true });
const wallet = new ethers.Wallet(privateKey, provider);

const MTQ_ABI = [
  "function getGFB() view returns (uint256)",
  "function getMTQPrice() view returns (uint256)",
  "function getMTQPriceWithGuard() view returns (uint256)",
  "function getCirculatingSupply() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function getLiability() view returns (uint256)",
  "function mint(uint256) returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function protocolStatus() view returns (uint8)",
];
const USDC_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function mint(address,uint256)",
];

async function main() {
  const mtq = new ethers.Contract(MTQ_ADDR, MTQ_ABI, wallet);
  const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, wallet);

  console.log("=== PRE-MINT STATE ===");
  console.log("GFB Index:", ethers.formatEther(await mtq.getGFB()));
  console.log("MTQ Price (USD): $", ethers.formatEther(await mtq.getMTQPrice()));
  console.log("Total Supply:", ethers.formatEther(await mtq.totalSupply()), "MTQ");
  console.log("Circulating Supply:", ethers.formatEther(await mtq.getCirculatingSupply()), "MTQ");
  console.log("Liability (USD): $", ethers.formatEther(await mtq.getLiability()));
  console.log("Protocol Status:", ["NORMAL","CAUTION","DEFENSIVE","EMERGENCY","RECOVERY"][await mtq.protocolStatus()]);

  // Live mint: 10,000 USDC → MTQ at P_MTQ=1.0 → ~9,990 MTQ (after 0.10% fee)
  const mintAmount = 10_000n * 10n ** 6n; // 10,000 USDC (6 dec)
  console.log("\n=== LIVE MINT: 10,000 USDC → MTQΣ ===");
  const tx = await mtq.mint(mintAmount);
  console.log("tx:", tx.hash);
  const rc = await tx.wait();
  console.log("mined, status:", rc?.status === 1 ? "SUCCESS ✓" : "FAILED ✗");

  console.log("\n=== POST-MINT STATE ===");
  console.log("Circulating Supply:", ethers.formatEther(await mtq.getCirculatingSupply()), "MTQ");
  console.log("Deployer MTQ balance:", ethers.formatEther(await mtq.balanceOf(wallet.address)), "MTQ");
  console.log("Liability (USD): $", ethers.formatEther(await mtq.getLiability()));
  // Expected: 9990 MTQ minted (10000 × 0.999 / 1.0), circ = 9990, liability = 9990 USD
  console.log("\nExpected: ~9,990 MTQ minted (= 10,000 × 0.999 / $1.00). Matches if balance ≈ 9,990.");
}
main().catch((e) => { console.error("TEST FAILED:", e.message || e); process.exit(2); });
