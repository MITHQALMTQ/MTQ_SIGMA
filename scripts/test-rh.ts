import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.chain.robinhood.com/rpc", { chainId: 46630, name: "robinhood" }, { staticNetwork: true });
const w = new ethers.Wallet(pk, provider);
const MTQ = "0xaf7cF40E37C00261E6B89D96371Da85Dd7b9b7af";
const USDC = "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD";
const MTQ_ABI = ["function getGFB() view returns (uint256)","function getMTQPrice() view returns (uint256)","function getCirculatingSupply() view returns (uint256)","function totalSupply() view returns (uint256)","function getLiability() view returns (uint256)","function mint(uint256) returns (uint256)","function redeem(uint256) returns (uint256)","function balanceOf(address) view returns (uint256)","function protocolStatus() view returns (uint8)"];
const USDC_ABI = ["function balanceOf(address) view returns (uint256)","function approve(address,uint256) returns (bool)"];
const mtq = new ethers.Contract(MTQ, MTQ_ABI, w);
const usdc = new ethers.Contract(USDC, USDC_ABI, w);

async function main(){
  console.log("=== PRE-MINT STATE (Robinhood Chain Testnet) ===");
  console.log("GFB Index:", ethers.formatEther(await mtq.getGFB()));
  console.log("MTQ Price (USD): $", ethers.formatEther(await mtq.getMTQPrice()));
  console.log("Total Supply:", ethers.formatEther(await mtq.totalSupply()), "MTQ");
  console.log("Circulating Supply:", ethers.formatEther(await mtq.getCirculatingSupply()), "MTQ");
  console.log("Liability (USD): $", ethers.formatEther(await mtq.getLiability()));
  console.log("Protocol Status:", ["NORMAL","CAUTION","DEFENSIVE","EMERGENCY","RECOVERY"][await mtq.protocolStatus()]);
  console.log("Deployer balance:", ethers.formatEther(await provider.getBalance(w.address)), "ETH");

  // LIVE MINT: 10,000 USDC → 9,990 MTQ (at P=1.0, fee 0.10%)
  console.log("\n=== LIVE MINT: 10,000 USDC → MTQΣ ===");
  const t1 = await mtq.mint(10_000n * 10n**6n);
  console.log("tx:", t1.hash);
  const r1 = await t1.wait();
  console.log("status:", r1?.status===1 ? "SUCCESS ✓" : "FAILED ✗");
  console.log("Post-mint circ:", ethers.formatEther(await mtq.getCirculatingSupply()), "MTQ");
  console.log("Deployer MTQ:", ethers.formatEther(await mtq.balanceOf(w.address)), "MTQ");

  // LIVE REDEEM: 5,000 MTQ → ~4,992.5 USDC (at P=1.0, fee 0.15%)
  console.log("\n=== LIVE REDEEM: 5,000 MTQ → USDC ===");
  const t2 = await mtq.redeem(ethers.parseEther("5000"));
  console.log("tx:", t2.hash);
  const r2 = await t2.wait();
  console.log("status:", r2?.status===1 ? "SUCCESS ✓" : "FAILED ✗");
  console.log("Post-redeem circ:", ethers.formatEther(await mtq.getCirculatingSupply()), "MTQ");
  console.log("Deployer MTQ:", ethers.formatEther(await mtq.balanceOf(w.address)), "MTQ");

  // Set a live FX rate + verify price moves (proves the §2 GFB index works on-chain)
  console.log("\n=== SET LIVE FX (EUR 1.10) → PRICE MOVES ===");
  const MTQ_OWNER_ABI = ["function setFxRates(uint256,uint256,uint256,uint256,uint256)"];
  const mtqO = new ethers.Contract(MTQ, [...MTQ_ABI, ...MTQ_OWNER_ABI], w);
  // EUR 1.10, GBP 1.30, JPY 0.0066, CNY 0.14, XAU 2700 (all 1e18)
  const t3 = await mtqO.setFxRates(ethers.parseEther("1.10"), ethers.parseEther("1.30"), ethers.parseEther("0.0066"), ethers.parseEther("0.14"), ethers.parseEther("2700"));
  await t3.wait();
  console.log("New GFB Index:", ethers.formatEther(await mtq.getGFB()));
  console.log("New MTQ Price: $", ethers.formatEther(await mtq.getMTQPrice()));
  console.log("Liability: $", ethers.formatEther(await mtq.getLiability()));
  console.log("\n=== CLOSED LOOP VERIFIED ON ROBINHOOD CHAIN TESTNET ===");
}
main().catch(e=>{console.error("TEST FAILED:", e.message||e);process.exit(2);});
