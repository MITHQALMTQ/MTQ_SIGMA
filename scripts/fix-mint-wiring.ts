// Fix #1: fund deployer with MockUSDC + approve the Mint contract (and MTQ contract)
// on all 3 EVM chains so the full-ecosystem mint() works end-to-end.
import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env", "utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];

const CHAINS = [
  { name: "Monad", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", usdc: "0x9de7C1e69B386A8Df8B6E8Ef3ce8BA73C22F43D5", mint: "0x4deA71BdB5Af2ce76e34c2AccA815855Af36A5fA", mtq: "0x0Ac20360234b4C988a19586CBe55733e18A5982f" },
  { name: "Arc", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", usdc: "0xc881D58df7Dddb29BC2Da05363D04974896285B6", mint: "0x28a2f9812BeC1252eee3992D56e5Bbd51393d6DE", mtq: "0x24203404B9b971C907e8Ced96106Fa74380d9897" },
  { name: "Robinhood", chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", usdc: "0xE842f1F47D3491a4619ac2F8C4c19d8302bf2942", mint: "0xeF3290d060249D05685617F8954F2B64d7A6D084", mtq: "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5" },
];

const USDC_ABI = ["function mint(address,uint256)","function balanceOf(address) view returns (uint256)","function approve(address,uint256) returns (bool)","function allowance(address,address) view returns (uint256)"];
const MTQ_ABI = ["function mint(uint256) returns (uint256)","function balanceOf(address) view returns (uint256)"];

(async () => {
  for (const c of CHAINS) {
    console.log(`\n══════ ${c.name} ══════`);
    const provider = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: c.name }, { staticNetwork: true });
    const w = new ethers.Wallet(pk, provider);
    const usdc = new ethers.Contract(c.usdc, USDC_ABI, w);
    const mtq = new ethers.Contract(c.mtq, MTQ_ABI, w);

    const waitForReceipt = async (tx: any, retries = 5) => {
      for (let i = 0; i < retries; i++) {
        try { return await tx.wait(); } catch (e: any) {
          if (e.message?.includes("Archive error") || e.message?.includes("could not coalesce")) {
            console.log(`    (archive transient, retry ${i+1}/${retries}...)`);
            await new Promise(r => setTimeout(r, 3000));
          } else throw e;
        }
      }
      // final fallback: poll manually
      console.log(`    (falling back to manual polling...)`);
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 3000));
        try { const r = await provider.getTransactionReceipt(tx.hash); if (r) return r; } catch {}
      }
      return null;
    };

    try {
      const usdcBal = await usdc.balanceOf(w.address);
      console.log(`  Deployer USDC balance: ${ethers.formatUnits(usdcBal, 6)}`);

      if (usdcBal < 10_000n * 10n ** 6n) {
        console.log(`  Minting 100,000 MockUSDC to deployer...`);
        const tx1 = await usdc.mint(w.address, 100_000n * 10n ** 6n);
        await waitForReceipt(tx1);
        console.log(`  ✓ Minted USDC (tx ${tx1.hash.slice(0,16)}…). New balance: ${ethers.formatUnits(await usdc.balanceOf(w.address), 6)}`);
      } else { console.log(`  ✓ Sufficient USDC already.`); }

      const allowMint = await usdc.allowance(w.address, c.mint);
      if (allowMint < 50_000n * 10n ** 6n) {
        console.log(`  Approving Mint contract ${c.mint} to spend USDC...`);
        const tx2 = await usdc.approve(c.mint, ethers.MaxUint256);
        await waitForReceipt(tx2);
        console.log(`  ✓ Approved (tx ${tx2.hash.slice(0,16)}…)`);
      } else { console.log(`  ✓ Mint already approved.`); }

      console.log(`  Live mint test: 10,000 USDC → MTQΣ...`);
      const tx3 = await mtq.mint(10_000n * 10n ** 6n);
      const rc = await waitForReceipt(tx3);
      console.log(`  ✓ Mint SUCCESS (tx ${tx3.hash.slice(0,16)}…, status ${rc?.status})`);
      console.log(`    Deployer MTQ balance: ${ethers.formatEther(await mtq.balanceOf(w.address))}`);
    } catch (e: any) {
      console.log(`  ✗ Error: ${e.message?.slice(0,150)}`);
    }
  }
})();
