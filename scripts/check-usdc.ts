import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x0-9a-fA-F]{64})/m)?.[1] || env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];
const p = new ethers.JsonRpcProvider("https://rpc.testnet.chain.robinhood.com/rpc", { chainId: 46630, name: "rh" }, { staticNetwork: true });
const w = new ethers.Wallet(pk, p);
const usdc = "0xE842f1F47D3491a4619ac2F8C4c19d8302bf2942";
const USDC_ABI = ["function balanceOf(address) view returns (uint256)","function totalSupply() view returns (uint256)","function owner() view returns (address)"];
const u = new ethers.Contract(usdc, USDC_ABI, w);
(async () => {
  const b = await u.balanceOf(w.address);
  console.log("Deployer USDC balance (raw):", b.toString());
  console.log("Deployer USDC balance (formatted):", ethers.formatUnits(b, 6));
  console.log("Total supply:", ethers.formatUnits(await u.totalSupply(), 6));
  console.log("Owner:", await u.owner());
  // Try a simple transfer (not transferFrom)
  const TRANSFER_ABI = ["function transfer(address,uint256) returns (bool)"];
  const ut = new ethers.Contract(usdc, TRANSFER_ABI, w);
  try {
    console.log("\nDirect USDC.transfer(Mint, 1000)...");
    const tx = await ut.transfer("0xeF3290d060249D05685617F8954F2B64d7A6D084", 1000n * 10n**6n);
    const rc = await tx.wait();
    console.log("  ✓ transfer SUCCESS (status", rc?.status, ")");
  } catch(e:any) { console.log("  ✗ transfer FAILED:", e.message?.slice(0,150)); }
})();
