import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.io", { chainId: 5042002, name: "arc" }, { staticNetwork: true });
const MTQ = "0x5C728F729110013A1fa59fFc85938bbD973A2563";
const ABI = ["function name() view returns (string)","function symbol() view returns (string)","function decimals() view returns (uint8)","function brandIconUri() view returns (string)"];
const mtq = new ethers.Contract(MTQ, ABI, provider);
(async () => {
  console.log("Arc branded contract:");
  console.log("  address:", MTQ);
  console.log("  name():", JSON.stringify(await mtq.name()), "(has Σ:", (await mtq.name()).includes("Σ"), ")");
  console.log("  symbol():", JSON.stringify(await mtq.symbol()));
  console.log("  decimals():", await mtq.decimals());
  console.log("  brandIconUri():", await mtq.brandIconUri());
})();
