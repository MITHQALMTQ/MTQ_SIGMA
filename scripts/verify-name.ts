import { ethers } from "ethers";
import { readFileSync } from "fs";
const env = readFileSync(".env","utf8");
const pk = env.match(/^DEPLOYER_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/m)![1];

const RPC = "https://rpc.testnet.chain.robinhood.com/rpc";
const MTQ = "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0";
const provider = new ethers.JsonRpcProvider(RPC, { chainId: 46630, name: "robinhood" }, { staticNetwork: true });
const w = new ethers.Wallet(pk, provider);
const ABI = ["function name() view returns (string)","function symbol() view returns (string)","function decimals() view returns (uint8)","function totalSupply() view returns (uint256)","function balanceOf(address) view returns (uint256)","function brandIconUri() view returns (string)","function transfer(address,uint256) returns (bool)","function mint(uint256) returns (uint256)","function redeem(uint256) returns (uint256)","function getGFB() view returns (uint256)","function getMTQPrice() view returns (uint256)","function getCirculatingSupply() view returns (uint256)"];
const mtq = new ethers.Contract(MTQ, ABI, w);

(async () => {
  const name = await mtq.name();
  const symbol = await mtq.symbol();
  const decimals = await mtq.decimals();
  const supply = ethers.formatUnits(await mtq.totalSupply(), decimals);
  const icon = await mtq.brandIconUri();
  console.log("=== NEW MTQΣ CONTRACT ON ROBINHOOD ===");
  console.log("Address:", MTQ);
  console.log("name():", JSON.stringify(name), "(bytes:", Buffer.from(name, "utf8").length, "— contains Σ:", name.includes("Σ"), ")");
  console.log("symbol():", JSON.stringify(symbol));
  console.log("decimals():", decimals);
  console.log("totalSupply():", supply, symbol);
  console.log("brandIconUri():", icon);

  // Live mint test
  console.log("\n=== LIVE MINT (10,000 USDC → MTQΣ) ===");
  const USDC = "0xFd2B8d176bf059287638Db30D02C6651dA02861e";
  const usdc = new ethers.Contract(USDC, ["function approve(address,uint256) returns (bool)"], w);
  await (await usdc.approve(MTQ, ethers.MaxUint256)).wait();
  const t1 = await mtq.mint(10_000n * 10n**6n);
  const r1 = await t1.wait();
  console.log("mint tx:", t1.hash, "status:", r1?.status===1?"✓":"✗");
  console.log("GFB:", ethers.formatEther(await mtq.getGFB()), "price $", ethers.formatEther(await mtq.getMTQPrice()));
  console.log("circulating:", ethers.formatEther(await mtq.getCirculatingSupply()), symbol);

  // Live redeem
  console.log("\n=== LIVE REDEEM (1,000 MTQΣ → USDC) ===");
  const t2 = await mtq.redeem(ethers.parseEther("1000"));
  const r2 = await t2.wait();
  console.log("redeem tx:", t2.hash, "status:", r2?.status===1?"✓":"✗");
  console.log("circulating after:", ethers.formatEther(await mtq.getCirculatingSupply()), symbol);
})();
