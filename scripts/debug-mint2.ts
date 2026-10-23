import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];
const c = { chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", mtq: "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5", mint: "0xeF3290d060249D05685617F8954F2B64d7A6D084", usdc: "0xFd2B8d176bf059287638Db30D02C6651dA02861e", deployer: "0x3C3932F865892EFabE45892f453f81B64f6c8d8c" };
const p = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: "robinhood" }, { staticNetwork: true });
const w = new ethers.Wallet(pk, p);
const MINT_ABI = ["function mint(uint256) returns (uint256)","function mtqPriceUsd() view returns (uint256)","function mintFeeBps() view returns (uint256)","function usdc() view returns (address)","function mtq() view returns (address)","function DEFAULT_ADMIN_ROLE() view returns (bytes32)","function hasRole(bytes32,address) view returns (bool)"];
const mint = new ethers.Contract(c.mint, MINT_ABI, w);
(async () => {
  console.log("Mint contract mtq():", await mint.mtq());
  console.log("Mint contract usdc():", await mint.usdc());
  console.log("Mint contract mtqPriceUsd:", ethers.formatEther(await mint.mtqPriceUsd()));
  console.log("Mint contract mintFeeBps:", await mint.mintFeeBps());
  // Check if the MockUSDC is actually the same one the Mint contract expects
  console.log("Expected USDC:", c.usdc, "Mint's USDC:", await mint.usdc(), "match?", (await mint.usdc()).toLowerCase() === c.usdc.toLowerCase());
  // Try a tiny mint (1 USDC) to see if it's an amount issue
  try {
    console.log("\nTrying mint(1 USDC)...");
    const tx = await mint.mint(1n * 10n ** 6n);
    const rc = await tx.wait();
    console.log("  ✓ mint(1) SUCCESS (status", rc?.status, ")");
  } catch (e:any) {
    // try static call to get the revert reason
    console.log("  ✗ mint(1) FAILED:", e.message?.slice(0,200));
    try {
      const data = mint.interface.encodeFunctionData("mint", [1n * 10n ** 6n]);
      const r = await p.call({ to: c.mint, from: c.deployer, data });
      console.log("  static call result:", r);
    } catch (e2:any) {
      console.log("  static call error:", e2.message?.slice(0,200));
    }
  }
})();
