import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const km = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)!;
const pk = km[1];
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.io",{chainId:5042002,name:"Arc"},{staticNetwork:true});
const w = new ethers.Wallet(pk, provider);
const MTQ = "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1";
const USDC = "0x334D14E7E39e1f02a60fc1169CdF7b0BEDE30dEb";
const MTQ_ABI = ["function getMTQPrice() view returns (uint256)","function getCirculatingSupply() view returns (uint256)","function balanceOf(address) view returns (uint256)","function redeem(uint256) returns (uint256)","function protocolStatus() view returns (uint8)"];
const USDC_ABI = ["function balanceOf(address) view returns (uint256)","function approve(address,uint256) returns (bool)"];
const mtq = new ethers.Contract(MTQ, MTQ_ABI, w);
const usdc = new ethers.Contract(USDC, USDC_ABI, w);
async function main(){
  console.log("=== PRE-REDEEM ===");
  console.log("MTQ price: $", ethers.formatEther(await mtq.getMTQPrice()));
  console.log("Circ supply:", ethers.formatEther(await mtq.getCirculatingSupply()), "MTQ");
  console.log("Deployer MTQ:", ethers.formatEther(await mtq.balanceOf(w.address)), "MTQ");
  console.log("Deployer USDC:", ethers.formatUnits(await usdc.balanceOf(w.address),6), "USDC");
  // Redeem 5,000 MTQ → USDC = 5000 × 1.0 × (1−0.0015) = 4,992.5 USDC
  console.log("\n=== LIVE REDEEM: 5,000 MTQ → USDC ===");
  const tx = await mtq.redeem(ethers.parseEther("5000"));
  console.log("tx:", tx.hash);
  const rc = await tx.wait();
  console.log("mined, status:", rc?.status===1?"SUCCESS ✓":"FAILED ✗");
  console.log("\n=== POST-REDEEM ===");
  console.log("Circ supply:", ethers.formatEther(await mtq.getCirculatingSupply()), "MTQ");
  console.log("Deployer MTQ:", ethers.formatEther(await mtq.balanceOf(w.address)), "MTQ");
  console.log("Deployer USDC:", ethers.formatUnits(await usdc.balanceOf(w.address),6), "USDC");
  console.log("\nExpected: ~4,992.5 USDC returned (= 5,000 × $1.00 × 0.9985). Circ drops to 4,990.");
}
main().catch(e=>{console.error(e.message||e);process.exit(2);});
