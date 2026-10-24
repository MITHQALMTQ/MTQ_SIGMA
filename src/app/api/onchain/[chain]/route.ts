import { NextResponse } from "next/server";
import { ethers } from "ethers";
import { CANONICAL_MTQ_ADDRESSES } from "@/lib/mtq/contracts";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
export const dynamic = "force-dynamic";
const ABI = ["function name() view returns (string)","function symbol() view returns (string)","function decimals() view returns (uint8)","function totalSupply() view returns (uint256)","function hasRole(bytes32,address) view returns (bool)","function paused() view returns (bool)"];
// 2026-10-24 owner-directed registry cleanup: chain 46630 (Robinhood) removed —
// CANONICAL_MTQ_ADDRESSES no longer carries it, so the RPC map stays in sync.
const RPC: Record<number,string> = { 10143: "https://testnet-rpc.monad.xyz", 5042002: "https://rpc.testnet.arc.io" };
const RA = "0x0000000000000000000000000000000000000000000000000000000000000000";
const RM = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const RP = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";
export async function GET(req: Request, { params }: { params: Promise<{ chain: string }> }) {
  // [16a-007 fix, Task 16-fix-A] Per-IP rate limit — "rpc" bucket, 30
  // req/IP/min. This route fans out to ~10 external RPC calls per request
  // and previously had no limiter at all (amplification surface).
  const rl = await rateLimit(getClientIP(req), "rpc");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
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
    } catch (e: any) {
      // [16a-007 fix] Generic 502 — provider URLs/latencies/error text are
      // never echoed to the client; full detail stays in the server log.
      console.error("[api/onchain] upstream RPC failure:", e?.message);
      return NextResponse.json({ error: "Upchain RPC unavailable" }, { status: 502 });
    }
  }
  if (cp === "solana") {
    const solMint = CANONICAL_MTQ_ADDRESSES.solana.address; // GAGRdrY6…jxS4 (owner-provided "WHAT YOU HAVE NOW")
    try {
      const r = await fetch("https://api.devnet.solana.com",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:[solMint,{encoding:"jsonParsed"}]}),signal:AbortSignal.timeout(9000)});
      const j = await r.json() as any; const info = j?.result?.value?.data?.parsed?.info;
      // SPL mint accounts carry no name on-chain (name lives in off-chain
      // metadata) — return the verified facts only, do not claim a name.
      return NextResponse.json({ chain:"Solana Devnet", chainId:"devnet", contract: { address:solMint, codePresent:!!info, name:"MTQ (SPL)", symbol:"MTQ", decimals:info?.decimals??18, mintAuthority:info?.mintAuthority, nameHasSigma:false }, verifiedAt:new Date().toISOString() });
    } catch (e: any) {
      // [16a-007 fix] Generic 502 — no upstream URL/latency leakage.
      console.error("[api/onchain] Solana devnet failure:", e?.message);
      return NextResponse.json({ error: "Upchain RPC unavailable" }, { status: 502 });
    }
  }
  return NextResponse.json({ error: "Unknown chain" }, { status: 404 });
}
