const rpcs = [
  "https://testnet-rpc.monadvision.com",
  "https://rpc-testnet.monadvision.com",
  "https://testnet-rpc.monadtestnet.com",
  "https://testnet-rpc.monad.xyz",
  "https://rpc.testnet.monad.xyz",
  "https://monad-testnet.publicnode.com",
  "https://endpoints.omniatech.io/v1/monad/testnet/public",
  "https://api.testnet.monad.com",
];
(async () => {
  for (const rpc of rpcs) {
    try {
      const r = await fetch(rpc, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_chainId",params:[]}), signal: AbortSignal.timeout(7000) });
      const j = await r.json() as any;
      console.log(`${rpc} → chainId=${j?.result} (${j?.result?parseInt(j.result,16):"?"})`);
    } catch (e:any) { console.log(`${rpc} → ${e.message?.slice(0,50)}`); }
  }
})();
