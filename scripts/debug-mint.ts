import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];
const c = { chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", mtq: "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5", mint: "0xeF3290d060249D05685617F8954F2B64d7A6D084", usdc: "0xFd2B8d176bf059287638Db30D02C6651dA02861e", deployer: "0x3C3932F865892EFabE45892f453f81B64f6c8d8c" };
const p = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: "robinhood" }, { staticNetwork: true });
const w = new ethers.Wallet(pk, p);
const MTQ_ABI = ["function name() view returns (string)","function paused() view returns (bool)","function hasRole(bytes32,address) view returns (bool)","function balanceOf(address) view returns (uint256)","function totalSupply() view returns (uint256)","function owner() view returns (address)","function mint(address,uint256) returns (bool)"];
const mtq = new ethers.Contract(c.mtq, MTQ_ABI, w);
const MINTER = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
(async () => {
  console.log("MTQ name:", await mtq.name());
  console.log("MTQ paused:", await mtq.paused());
  console.log("MINTER_ROLE(deployer):", await mtq.hasRole(MINTER, c.deployer));
  console.log("MINTER_ROLE(Mint contract):", await mtq.hasRole(MINTER, c.mint));
  console.log("MTQ totalSupply:", ethers.formatEther(await mtq.totalSupply()));
  console.log("MTQ balance(deployer):", ethers.formatEther(await mtq.balanceOf(c.deployer)));
  // Try calling mtq.mint directly (deployer has MINTER_ROLE)
  try {
    console.log("\nDirect mtq.mint(deployer, 1000)...");
    const tx = await mtq.mint(c.deployer, ethers.parseEther("1000"));
    const rc = await tx.wait();
    console.log("  ✓ direct mint SUCCESS (status", rc?.status, ")");
    console.log("  new balance:", ethers.formatEther(await mtq.balanceOf(c.deployer)));
  } catch (e:any) { console.log("  ✗ direct mint FAILED:", e.message?.slice(0,150)); }

  // Now try the MintContract.mint — does it have USDC allowance?
  const USDC_ABI = ["function allowance(address,address) view returns (uint256)","function balanceOf(address) view returns (uint256)"];
  const usdc = new ethers.Contract(c.usdc, USDC_ABI, w);
  console.log("\nUSDC allowance(deployer → Mint contract):", ethers.formatUnits(await usdc.allowance(c.deployer, c.mint), 6));
  console.log("USDC balance(deployer):", ethers.formatUnits(await usdc.balanceOf(c.deployer), 6));
})();
