import { ethers } from "ethers";

const MTQ = "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD";
const RESERVE = "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177";
const ORACLE = "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713";

// Try multiple Monad RPC endpoints
const rpcs = [
  "https://testnet-rpc.monadvision.com",
  "https://rpc-testnet.monadvision.com",
  "https://testnet-rpc.monadtestnet.com",
  "https://monad-testnet.g.alchemy.com/v2/demo",
  "https://rpc.monad-testnet.g.alchemy.com/v2/demo",
  "wss://testnet-rpc.monadvision.com",
];

const ADDRS = { MTQ, RESERVE, ORACLE };

async function rawRpc(rpc: string, method: string, params: any[]) {
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(9000),
  });
  const j = await r.json() as any;
  return j?.result ?? j?.error;
}

(async () => {
  console.log("=== MONAD TESTNET — deep probe (multiple RPCs, raw eth_getCode) ===\n");
  for (const rpc of rpcs) {
    console.log(`RPC: ${rpc}`);
    try {
      // chainId
      const cid = await rawRpc(rpc, "eth_chainId", []);
      console.log(`  eth_chainId: ${cid} (decimal: ${typeof cid === "string" && cid.startsWith("0x") ? parseInt(cid, 16) : cid})`);
      if (typeof cid !== "string" || !cid.startsWith("0x")) { console.log("  (no valid chainId, skipping)"); continue; }

      // latest block
      const bn = await rawRpc(rpc, "eth_blockNumber", []);
      console.log(`  eth_blockNumber: ${bn} (${typeof bn === "string" && bn.startsWith("0x") ? parseInt(bn, 16) : "?"})`);

      // deployer balance
      const bal = await rawRpc(rpc, "eth_getBalance", ["0x3C3932F865892EFabE45892f453f81B64f6c8d8c", "latest"]);
      console.log(`  deployer balance: ${bal} (${typeof bal === "string" && bal.startsWith("0x") ? ethers.formatEther(BigInt(bal)) + " MON" : "?"})`);

      // getCode for each contract
      for (const [label, addr] of Object.entries(ADDRS)) {
        try {
          const code = await rawRpc(rpc, "eth_getCode", [addr, "latest"]);
          if (typeof code === "string" && code.startsWith("0x")) {
            const bytes = code.length;
            const live = bytes > 2;
            console.log(`  ${label} ${addr}: ${live ? `LIVE (${bytes} bytes code) ✓` : "EMPTY ✗ (no code)"}`);
          } else {
            console.log(`  ${label} ${addr}: error/code=${code}`);
          }
        } catch (e: any) {
          console.log(`  ${label} getCode failed: ${e.message?.slice(0, 50)}`);
        }
      }
    } catch (e: any) {
      console.log(`  UNREACHABLE: ${e.message?.slice(0, 80)}`);
    }
    console.log("");
  }
})();
