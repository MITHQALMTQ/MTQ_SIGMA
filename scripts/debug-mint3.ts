import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];
// Robinhood
const p = new ethers.JsonRpcProvider("https://rpc.testnet.chain.robinhood.com/rpc", { chainId: 46630, name: "rh" }, { staticNetwork: true });
const w = new ethers.Wallet(pk, p);
const mint = "0xeF3290d060249D05685617F8954F2B64d7A6D084";
const usdc = "0xE842f1F47D3491a4619ac2F8C4c19d8302bf2942";
const mtq = "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5";
const MINT_ABI = ["function mint(uint256) returns (uint256)","function usdc() view returns (address)","function mtq() view returns (address)","function mtqPriceUsd() view returns (uint256)","function mintFeeBps() view returns (uint256)"];
const mc = new ethers.Contract(mint, MINT_ABI, w);
(async () => {
  console.log("Mint.usdc():", await mc.usdc());
  console.log("Mint.mtq():", await mc.mtq());
  console.log("Mint.mtqPriceUsd():", ethers.formatEther(await mc.mtqPriceUsd()));
  console.log("Mint.mintFeeBps():", await mc.mintFeeBps());
  // Check USDC code + interface
  const code = await p.getCode(usdc);
  console.log("USDC code:", code.length, "bytes");
  const USDC_ABI = ["function name() view returns (string)","function symbol() view returns (string)","function decimals() view returns (uint8)","function balanceOf(address) view returns (uint256)","function allowance(address,address) view returns (uint256)","function approve(address,uint256) returns (bool)","function transferFrom(address,address,uint256) returns (bool)","function transfer(address,uint256) returns (bool)"];
  const u = new ethers.Contract(usdc, USDC_ABI, w);
  try {
    console.log("USDC name:", await u.name());
    console.log("USDC symbol:", await u.symbol());
    console.log("USDC decimals:", await u.decimals());
    console.log("USDC balance(deployer):", ethers.formatUnits(await u.balanceOf(w.address), 6));
    console.log("USDC allowance(deployer→Mint):", ethers.formatUnits(await u.allowance(w.address, mint), 6));
    // Test transferFrom directly
    console.log("\nDirect USDC.transferFrom(deployer → Mint, 1000 USDC)...");
    const tx = await u.transferFrom(w.address, mint, 1000n * 10n**6n);
    const rc = await tx.wait();
    console.log("  ✓ transferFrom SUCCESS (status", rc?.status, ")");
  } catch(e:any) { console.log("  ✗", e.message?.slice(0,150)); }
  // Now try the mint with a static call to get exact revert
  console.log("\nStatic call mint(1000 USDC)...");
  try {
    const data = mc.interface.encodeFunctionData("mint", [1000n * 10n**6n]);
    const r = await p.call({ to: mint, from: w.address, data, gasLimit: 500000n });
    console.log("  static call OK:", r);
  } catch(e:any) { console.log("  static call revert:", e.message?.slice(0,250)); }
})();
