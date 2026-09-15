import { ethers } from "ethers";
const RPC = "https://testnet-rpc.monad.xyz";
const provider = new ethers.JsonRpcProvider(RPC, { chainId: 10143, name: "monad" }, { staticNetwork: true });
const MTQ = "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD";
const ABI = ["function name() view returns (string)","function symbol() view returns (uint256)","function totalSupply() view returns (uint256)","function balanceOf(address) view returns (uint256)","function decimals() view returns (uint8)"];
(async () => {
  const mtq = new ethers.Contract(MTQ, ABI, provider);
  try {
    const name = await mtq.name();
    const decimals = await mtq.decimals();
    const totalSupply = await mtq.totalSupply();
    const deployerBal = await mtq.balanceOf("0x3C3932F865892EFabE45892f453f81B64f6c8d8c");
    console.log("MTQ on Monad Testnet:");
    console.log("  name:", name);
    console.log("  decimals:", decimals);
    console.log("  totalSupply:", ethers.formatUnits(totalSupply, decimals), "(raw:", totalSupply.toString(), ")");
    console.log("  deployer balance:", ethers.formatUnits(deployerBal, decimals));
  } catch (e:any) {
    // symbol() returning uint256 suggests a non-standard ABI; try alt
    console.log("  read attempt:", e.message?.slice(0,80));
    // try with symbol as string
    const ABI2 = ["function name() view returns (string)","function symbol() view returns (string)","function totalSupply() view returns (uint256)","function balanceOf(address) view returns (uint256)","function decimals() view returns (uint8)"];
    const mtq2 = new ethers.Contract(MTQ, ABI2, provider);
    try {
      console.log("  name:", await mtq2.name());
      console.log("  symbol:", await mtq2.symbol());
      console.log("  decimals:", await mtq2.decimals());
      console.log("  totalSupply:", ethers.formatUnits(await mtq2.totalSupply(), await mtq2.decimals()));
      console.log("  deployer balance:", ethers.formatUnits(await mtq2.balanceOf("0x3C3932F865892EFabE45892f453f81B64f6c8d8c"), await mtq2.decimals()));
    } catch (e2:any) { console.log("  alt read failed:", e2.message?.slice(0,80)); }
  }
  const bal = await provider.getBalance("0x3C3932F865892EFabE45892f453f81B64f6c8d8c");
  console.log("  deployer native (MON) balance:", ethers.formatEther(bal));
})();
