import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];
const CHAINS = [
  { name: "Robinhood", chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", usdc: "0xE842f1F47D3491a4619ac2F8C4c19d8302bf2942", mint: "0xeF3290d060249D05685617F8954F2B64d7A6D084" },
];
const USDC_ABI = ["function approve(address,uint256) returns (bool)","function allowance(address,address) view returns (uint256)"];
const MINT_ABI = ["function mint(uint256) returns (uint256)"];
for (const c of CHAINS) {
  const p = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: c.name }, { staticNetwork: true });
  const w = new ethers.Wallet(pk, p);
  const u = new ethers.Contract(c.usdc, USDC_ABI, w);
  const mc = new ethers.Contract(c.mint, MINT_ABI, w);
  // Reset allowance to a specific large-but-not-max value
  console.log("Resetting allowance to 1,000,000 USDC (not MaxUint256)...");
  await (await u.approve(c.mint, 1_000_000n * 10n**6n)).wait();
  console.log("New allowance:", ethers.formatUnits(await u.allowance(w.address, c.mint), 6));
  // Try mint
  try {
    console.log("mint(10000 USDC)...");
    const tx = await mc.mint(10_000n * 10n**6n);
    const rc = await tx.wait();
    console.log("✓ mint SUCCESS (status", rc?.status, ")");
  } catch(e:any) { console.log("✗", e.message?.slice(0,150)); }
}
