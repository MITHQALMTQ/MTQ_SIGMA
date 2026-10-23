import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];
const CHAINS = [
  { name: "Monad", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", usdc: "0x9de7C1e69B386A8Df8B6E8Ef3ce8BA73C22F43D5", mint: "0x4deA71BdB5Af2ce76e34c2AccA815855Af36A5fA", mtq: "0x0Ac20360234b4C988a19586CBe55733e18A5982f" },
  { name: "Arc", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", usdc: "0xc881D58df7Dddb29BC2Da05363D04974896285B6", mint: "0x28a2f9812BeC1252eee3992D56e5Bbd51393d6DE", mtq: "0x24203404B9b971C907e8Ced96106Fa74380d9897" },
  { name: "Robinhood", chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", usdc: "0xE842f1F47D3491a4619ac2F8C4c19d8302bf2942", mint: "0xeF3290d060249D05685617F8954F2B64d7A6D084", mtq: "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5" },
];
const USDC_ABI = ["function approve(address,uint256) returns (bool)","function allowance(address,address) view returns (uint256)","function balanceOf(address) view returns (uint256)","function mint(address,uint256)"];
const MINT_ABI = ["function mint(uint256) returns (uint256)"];
const MTQ_ABI = ["function balanceOf(address) view returns (uint256)"];
const wait = async (tx:any, p:any, retries=5) => {
  for (let i=0;i<retries;i++) { try { return await tx.wait(); } catch(e:any){ if(e.message?.includes("Archive")||e.message?.includes("coalesce")){await new Promise(r=>setTimeout(r,3000));} else throw e; } }
  for (let i=0;i<15;i++){ await new Promise(r=>setTimeout(r,3000)); try{const r=await p.getTransactionReceipt(tx.hash); if(r)return r;}catch{} } return null;
};
for (const c of CHAINS) {
  console.log(`\n══════ ${c.name} ══════`);
  const p = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: c.name }, { staticNetwork: true });
  const w = new ethers.Wallet(pk, p);
  const u = new ethers.Contract(c.usdc, USDC_ABI, w);
  const mc = new ethers.Contract(c.mint, MINT_ABI, w);
  const mtq = new ethers.Contract(c.mtq, MTQ_ABI, w);
  try {
    // Fund deployer USDC if needed
    let bal = await u.balanceOf(w.address);
    if (bal < 10000n*10n**6n) {
      console.log("  Minting 100,000 MockUSDC to deployer...");
      await wait(await u.mint(w.address, 100_000n*10n**6n), p);
    }
    // Reset allowance to a specific (non-MaxUint256) value
    console.log("  Setting allowance to 1,000,000 USDC...");
    await wait(await u.approve(c.mint, 1_000_000n*10n**6n), p);
    // Live mint
    console.log("  Live mint(10,000 USDC → MTQΣ)...");
    const tx = await mc.mint(10_000n*10n**6n);
    const rc = await wait(tx, p);
    if (rc?.status === 1) {
      console.log(`  ✓ mint SUCCESS (tx ${tx.hash.slice(0,16)}…)`);
      console.log(`    Deployer MTQ balance: ${ethers.formatEther(await mtq.balanceOf(w.address))}`);
    } else { console.log(`  ✗ mint failed (status ${rc?.status})`); }
  } catch(e:any) { console.log(`  ✗ Error: ${e.message?.slice(0,120)}`); }
}
