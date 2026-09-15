const RPC = "https://testnet-rpc.monad.xyz";
const MTQ = "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD";
const GOV = "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66";
const SAFE = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0";
const ALGO = "0x8839ce50e8D414005518769999c0A5b961D00CB2";
const RESERVE = "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177";
const MINT = "0x197e9CB28216dfe18a199b4c2930F74C2F460809";
const REDEEM = "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4";
const ORACLE = "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713";
const TAKAFUL = "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19";

async function rpc(method: string, params: any[]) {
  const r = await fetch(RPC, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({jsonrpc:"2.0",id:1,method,params}), signal: AbortSignal.timeout(10000) });
  const j = await r.json() as any;
  return j?.result ?? j?.error;
}

(async () => {
  console.log("=== MONAD TESTNET via https://testnet-rpc.monad.xyz (chainId 10143) ===\n");
  const cid = await rpc("eth_chainId", []);
  console.log("chainId:", cid, `(decimal ${parseInt(cid,16)})`);
  const bn = await rpc("eth_blockNumber", []);
  console.log("latest block:", bn, `(${parseInt(bn,16)})`);
  const bal = await rpc("eth_getBalance", ["0x3C3932F865892EFabE45892f453f81B64f6c8d8c","latest"]);
  console.log("deployer balance:", bal, "wei");
  
  console.log("\n=== USER'S DEPLOYED CONTRACTS — CODE CHECK ===");
  const contracts: Record<string,string> = { MTQ, GOV, SAFE, ALGO, RESERVE, MINT, REDEEM, ORACLE, TAKAFUL };
  let liveCount = 0;
  for (const [name, addr] of Object.entries(contracts)) {
    const code = await rpc("eth_getCode", [addr, "latest"]);
    if (typeof code === "string" && code.startsWith("0x")) {
      const bytes = code.length;
      const live = bytes > 2;
      if (live) liveCount++;
      console.log(`  ${name.padEnd(10)} ${addr} → ${live ? "LIVE ("+bytes+" bytes code) ✓" : "EMPTY ✗"}`);
    } else {
      console.log(`  ${name.padEnd(10)} ${addr} → error: ${code}`);
    }
  }
  console.log(`\n${liveCount}/9 user contracts have code on Monad Testnet.`);
})();
