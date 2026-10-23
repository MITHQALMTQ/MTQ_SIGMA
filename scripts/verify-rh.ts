import { ethers } from "ethers";
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.chain.robinhood.com/rpc", { chainId: 46630, name: "robinhood" }, { staticNetwork: true });
const MTQ = "0xaf7cF40E37C00261E6B89D96371Da85Dd7b9b7af";
const USDC = "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD";
async function main(){
  for (const [n,a] of Object.entries({MTQ:MTQ, MockUSDC:USDC})) {
    const code = await provider.getCode(a);
    const live = code && code !== "0x" && code.length > 4;
    console.log(`  ${n} ${a} → ${live ? 'LIVE ('+code.length+' bytes code)' : 'EMPTY'}`);
  }
  // Read live state from MTQ
  const mtq = new ethers.Contract(MTQ, ["function getGFB() view returns (uint256)","function getMTQPrice() view returns (uint256)","function getCirculatingSupply() view returns (uint256)","function totalSupply() view returns (uint256)"], provider);
  console.log("  Live GFB:", ethers.formatEther(await mtq.getGFB()));
  console.log("  Live MTQ Price: $", ethers.formatEther(await mtq.getMTQPrice()));
  console.log("  Live Total Supply:", ethers.formatEther(await mtq.totalSupply()), "MTQ");
  console.log("  Live Circulating Supply:", ethers.formatEther(await mtq.getCirculatingSupply()), "MTQ");
  const deployer = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
  console.log("  Deployer balance:", ethers.formatEther(await provider.getBalance(deployer)), "ETH");
}
main().catch(e=>{console.error(e.message||e);process.exit(1);});
