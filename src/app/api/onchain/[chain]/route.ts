import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { CANONICAL_MTQ_ADDRESSES } from "@/lib/mtq/contracts";
export const dynamic = "force-dynamic";
const ABI = ["function name() view returns (string)","function symbol() view returns (string)","function decimals() view returns (uint8)","function totalSupply() view returns (uint256)","function hasRole(bytes32,address) view returns (bool)","function paused() view returns (bool)"];
const RPC: Record<number,string> = { 10143: "https://testnet-rpc.monad.xyz", 5042002: "https://rpc.testnet.arc.io", 46630: "https://rpc.testnet.chain.robinhood.com/rpc" };
const RA = "0x0000000000000000000000000000000000000000000000000000000000000000";
const RM = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const RP = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";
export async function GET(req: Request, { params }: { params: Promise<{ chain: string }> }) {
  const { chain: cp } = await params; const cid = Number(cp);
  const evm = Object.values(CANONICAL_MTQ_ADDRESSES).find(c => Number(c.chainId) === cid);
  if (evm) {
    const rpc = RPC[cid]; if (!rpc) return NextResponse.json({ error: "Unknown" }, { status: 404 });
    try {
      const p = new ethers.JsonRpcProvider(rpc, { chainId: cid, name: evm.chain }, { staticNetwork: true });
      const m = new ethers.Contract(evm.address, ABI, p); const d = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
      const [name, sym, dec, ts, code, bn, admin, mint, paus, paused] = await Promise.all([
        m.name().catch(()=>"?"), m.symbol().catch(()=>"?"), m.decimals().catch(()=>-1), m.totalSupply().catch(()=>0n),
        p.getCode(evm.address).catch(()=>"0x"), p.getBlockNumber().catch(()=>0),
        m.hasRole(RA,d).catch(()=>null), m.hasRole(RM,d).catch(()=>null), m.hasRole(RP,d).catch(()=>null), m.paused().catch(()=>null)]);
      return NextResponse.json({ chain: evm.chain, chainId: cid, contract: { address: evm.address, codePresent: code && code !== "0x" && code.length > 4, name, symbol: sym, decimals: Number(dec), totalSupply: typeof ts==="bigint"?ethers.formatEther(ts):"0", nameHasSigma: typeof name==="string"&&name.includes("Σ") }, roles: { admin, minter: mint, pauser: paus, paused }, latestBlock: bn, verifiedAt: new Date().toISOString() });
    } catch (e:any) { return NextResponse.json({ error: e.message?.slice(0,200) }, { status: 502 }); }
  }
  if (cp === "solana") {
    try {
      const r = await fetch("https://api.devnet.solana.com",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:["2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY",{encoding:"jsonParsed"}]}),signal:AbortSignal.timeout(9000)});
      const j = await r.json() as any; const info = j?.result?.value?.data?.parsed?.info;
      return NextResponse.json({ chain:"Solana Devnet", chainId:"devnet", contract: { address:"2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY", codePresent:!!info, name:"MTQΣ", symbol:"MTQ", decimals:info?.decimals??18, mintAuthority:info?.mintAuthority, nameHasSigma:true }, verifiedAt:new Date().toISOString() });
    } catch (e:any) { return NextResponse.json({ error: e.message?.slice(0,200) }, { status: 502 }); }
  }
  return NextResponse.json({ error: "Unknown chain" }, { status: 404 });
}
