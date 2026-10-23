// MTQΣ — TASK 9 (part 2): recursive Transfer-log scan + genesis/deployment recovery
// + Governance/Safe hasRole reproducibility re-check. READ-ONLY (§1): eth_getLogs,
// eth_getTransactionReceipt, eth_getBlockByNumber, eth_call only.
// Usage: bun log-scan.ts monad|arc
import { ethers } from "ethers";
import { writeFileSync, appendFileSync, mkdirSync } from "fs";

const EVIDENCE = "/home/z/my-project/audit-work/v9-task9/evidence";
mkdirSync(EVIDENCE, { recursive: true });

const ZERO = "0x0000000000000000000000000000000000000000";
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const IFACE = new ethers.Interface(["function hasRole(bytes32 role, address account) view returns (bool)", "function balanceOf(address) view returns (uint256)"]);
const ROLE_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ROLE_MINTER = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const ROLE_PAUSER = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";

const CHAINS: Record<string, any> = {
  monad: { rpc: "https://testnet-rpc.monad.xyz", mtq: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", gov: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0" },
  arc: { rpc: "https://rpc.testnet.arc.io", mtq: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", gov: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0" },
};

let REQ_ID = Math.floor(Math.random() * 100000);
const rawLog = (e: any) => appendFileSync(`${EVIDENCE}/raw.jsonl`, JSON.stringify(e) + "\n");
const sleep = (ms: number) => new Promise((s) => setTimeout(s, ms));

async function rpc(rpcUrl: string, method: string, params: any[], retries = 3): Promise<{ kind: string; result?: any; message?: string; attempts: number }> {
  const entry: any = { ts: new Date().toISOString(), rpc: rpcUrl, method, params, attempts: [] };
  let attempts = 0;
  for (let i = 1; i <= retries; i++) {
    attempts++;
    try {
      const res = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++REQ_ID, method, params }), signal: AbortSignal.timeout(20000) });
      entry.attempts.push({ i, httpStatus: res.status });
      const j: any = await res.json();
      if (j.error) {
        const msg = String(j.error.message ?? JSON.stringify(j.error));
        entry.error = j.error; entry.kind = /revert/i.test(msg) ? "EVM_REVERT" : "RPC_ERROR"; rawLog(entry);
        return { kind: entry.kind, message: msg, attempts };
      }
      entry.kind = j.result === null ? "EMPTY" : "OK"; entry.result = j.result ?? null;
      rawLog(entry);
      return { kind: entry.kind, result: j.result, attempts };
    } catch (e: any) {
      entry.attempts.push({ i, transport: String(e?.message ?? e).slice(0, 120) });
      if (i === retries) { entry.kind = "TRANSPORT_ERROR"; rawLog(entry); return { kind: "TRANSPORT_ERROR", message: String(e?.message ?? e), attempts }; }
      await sleep(700 * i);
    }
  }
  return { kind: "TRANSPORT_ERROR", attempts };
}

const hex = (n: number) => "0x" + n.toString(16);

// Divide-and-conquer eth_getLogs: try [from..to]; on range/result RPC errors split in half.
async function getLogsDoC(rpcUrl: string, address: string, from: number, to: number, topics: string[] | null, stats: any): Promise<any[]> {
  const q: any = { address, fromBlock: hex(from), toBlock: hex(to) };
  if (topics) q.topics = topics;
  const r = await rpc(rpcUrl, "eth_getLogs", [q]);
  stats.calls++;
  if (r.kind === "OK") return (r.result ?? []) as any[];
  if (r.kind === "TRANSPORT_ERROR") { stats.unresolvedLeaves++; stats.errors.push({ from, to, kind: r.kind, message: r.message }); return []; }
  // RPC_ERROR / EVM_REVERT: split if the range is still big
  const range = to - from + 1;
  if (range > 2000) {
    const mid = from + Math.floor(range / 2) - 1;
    return [...await getLogsDoC(rpcUrl, address, from, mid, topics, stats), ...await getLogsDoC(rpcUrl, address, mid + 1, to, topics, stats)];
  }
  stats.unresolvedLeaves++; stats.errors.push({ from, to, kind: r.kind, message: (r.message ?? "").slice(0, 160) });
  return [];
}

async function ethCall(rpcUrl: string, to: string, data: string) {
  const r = await rpc(rpcUrl, "eth_call", [{ to, data }, "latest"]);
  if (r.kind !== "OK") return { kind: r.kind, message: r.message };
  try {
    const dec = IFACE.decodeFunctionResult(data.slice(0, 10) === "0x70a08231" ? "balanceOf" : "hasRole", r.result);
    return { kind: "OK", value: dec[0] };
  } catch { return { kind: "DECODE_FAIL" }; }
}

async function main(chainId: string) {
  const chain = CHAINS[chainId];
  const rpcUrl = chain.rpc;
  const out: any = { probe: `MTQΣ Task 9 — ${chainId} Transfer-log scan + genesis recovery`, startedAt: new Date().toISOString() };
  const bn = await rpc(rpcUrl, "eth_blockNumber", []);
  const latest = parseInt(bn.result, 16);
  out.block = latest;

  const stats: any = { calls: 0, unresolvedLeaves: 0, errors: [] };
  const logs = await getLogsDoC(rpcUrl, chain.mtq, 1, latest, [TRANSFER_TOPIC], stats);
  out.scanStats = { method: "divide-and-conquer eth_getLogs (block 1 → latest)", ...stats };
  const decoded = logs.map((lg) => ({
    blockNumber: parseInt(lg.blockNumber, 16),
    txHash: lg.transactionHash,
    logIndex: lg.logIndex,
    from: ("0x" + lg.topics[1].slice(26)).toLowerCase(),
    to: ("0x" + lg.topics[2].slice(26)).toLowerCase(),
    value: BigInt(lg.data).toString(),
  })).sort((a, b) => a.blockNumber - b.blockNumber || String(a.logIndex).localeCompare(String(b.logIndex)));
  out.logCount = decoded.length;
  out.logs = decoded.slice(0, 500);
  out.mints = decoded.filter((d) => d.from === ZERO);
  out.burns = decoded.filter((d) => d.to === ZERO);
  const holders = new Set<string>();
  for (const d of decoded) { if (d.from !== ZERO) holders.add(d.from); if (d.to !== ZERO) holders.add(d.to); }
  out.holderCandidates = [...holders];

  // Deployment recovery: receipt of the first mint tx — if it's the contract-creation tx, deployBlock found.
  out.deploymentRecovery = [];
  for (const m of out.mints.slice(0, 3)) {
    const rc = await rpc(rpcUrl, "eth_getTransactionReceipt", [m.txHash]);
    if (rc.kind === "OK" && rc.result) {
      const receipt = rc.result;
      const isCreation = receipt.to === null && (receipt.contractAddress ?? "").toLowerCase() === chain.mtq.toLowerCase();
      const blk = await rpc(rpcUrl, "eth_getBlockByNumber", [receipt.blockNumber, false]);
      out.deploymentRecovery.push({
        txHash: m.txHash, blockNumber: parseInt(receipt.blockNumber, 16),
        txFrom: receipt.from, txTo: receipt.to ?? null, contractAddress: receipt.contractAddress ?? null,
        isContractCreationTx: isCreation, status: receipt.status,
        blockTimestamp: blk.kind === "OK" && blk.result ? new Date(Number(BigInt(blk.result.timestamp) * 1000n)).toISOString() : null,
      });
      if (isCreation) {
        out.mtqDeployBlock = parseInt(receipt.blockNumber, 16);
        out.mtqDeployTimestamp = out.deploymentRecovery[out.deploymentRecovery.length - 1].blockTimestamp;
        out.mtqDeployTx = m.txHash;
      }
    } else out.deploymentRecovery.push({ txHash: m.txHash, kind: rc.kind, message: (rc.message ?? "").slice(0, 140) });
  }

  // Holder balances + supply reconciliation
  const bal: Record<string, string> = {};
  let sum = 0n;
  for (const h of out.holderCandidates) {
    const r = await ethCall(rpcUrl, chain.mtq, IFACE.encodeFunctionData("balanceOf", [h]));
    if (r.kind === "OK") { bal[h] = r.value.toString(); if (bal[h] !== "0") sum += BigInt(bal[h]); } else bal[h] = `${r.kind}`;
  }
  out.holderBalances = bal;
  const tsR = await ethCall(rpcUrl, chain.mtq, IFACE.encodeFunctionData("balanceOf", [chain.mtq])); // self-balance (self-custody check)
  if (tsR.kind === "OK") out.tokenSelfBalance = tsR.value.toString();
  out.supplyReconciliation = { method: "Σ balanceOf(log-derived holders, nonzero)", sumOfHolderBalances: sum.toString(), holderCount: out.holderCandidates.length, closesAgainstTotalSupply: null, note: "compare vs totalSupply from chain inventory JSON" };

  // Governance/Safe hasRole reproducibility re-check (2 rounds, raw preserved in raw.jsonl)
  const recheck: any[] = [];
  for (const target of [["Governance", chain.gov], ["Safe", chain.safe]] as [string, string][]) {
    for (const role of [["admin", ROLE_ADMIN], ["minter", ROLE_MINTER], ["pauser", ROLE_PAUSER]] as [string, string][]) {
      const rounds: string[] = [];
      for (let i = 1; i <= 2; i++) {
        const r = await ethCall(rpcUrl, target[1], IFACE.encodeFunctionData("hasRole", [role[1], DEPLOYER]));
        rounds.push(r.kind === "OK" ? String(r.value) : `${r.kind}${r.message ? ": " + r.message.slice(0, 90) : ""}`);
      }
      recheck.push({ target: target[0], address: target[1], role: role[0], account: DEPLOYER, round1: rounds[0], round2: rounds[1], consistent: rounds[0] === rounds[1] });
    }
  }
  out.hasRoleReproducibility = recheck;

  out.finishedAt = new Date().toISOString();
  writeFileSync(`${EVIDENCE}/${chainId}-logscan.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ chain: chainId, block: latest, logCount: out.logCount, mints: out.mints.length, burns: out.burns.length, holders: out.holderCandidates.length, deployBlock: out.mtqDeployBlock ?? "UNRECOVERED", sumHolders: sum.toString(), selfBalance: out.tokenSelfBalance ?? null, recheckSample: recheck.slice(0, 2) }, null, 2));
}

const which = process.argv[2];
if (which === "monad" || which === "arc") await main(which);
else console.log("usage: bun log-scan.ts monad|arc");
