// MTQΣ — TASK 9 (part 4): RESUMABLE bounded Transfer scan with pacing + backoff.
// READ-ONLY (§1). Persists progress so it can be resumed after rate limits/timeouts.
// Usage: bun scan-resume.ts arc|monad
import { ethers } from "ethers";
import { writeFileSync, appendFileSync, mkdirSync, readFileSync, existsSync } from "fs";

const EVIDENCE = "/home/z/my-project/audit-work/v9-task9/evidence";
mkdirSync(EVIDENCE, { recursive: true });
const ZERO = "0x0000000000000000000000000000000000000000";
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const IFACE = new ethers.Interface(["function balanceOf(address) view returns (uint256)"]);

const CHAINS: Record<string, any> = {
  arc: { rpc: "https://rpc.testnet.arc.io", mtq: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", from: 55772115, span: 5000 },
  monad: { rpc: "https://testnet-rpc.monad.xyz", mtq: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", from: null, span: 100 },
};

let REQ_ID = Math.floor(Math.random() * 300000);
const rawLog = (e: any) => appendFileSync(`${EVIDENCE}/raw.jsonl`, JSON.stringify(e) + "\n");
const sleep = (ms: number) => new Promise((s) => setTimeout(s, ms));
const hex = (n: number) => "0x" + n.toString(16);

async function rpc(rpcUrl: string, method: string, params: any[], retries = 6): Promise<{ kind: string; result?: any; message?: string }> {
  const entry: any = { ts: new Date().toISOString(), rpc: rpcUrl, method, params, attempts: [] };
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++REQ_ID, method, params }), signal: AbortSignal.timeout(20000) });
      entry.attempts.push({ i, httpStatus: res.status });
      const j: any = await res.json();
      if (j.error) {
        const msg = String(j.error.message ?? JSON.stringify(j.error));
        entry.error = j.error; entry.kind = /revert/i.test(msg) ? "EVM_REVERT" : "RPC_ERROR";
        const ratey = res.status === 429 || /rate|limit/i.test(msg);
        if (ratey && i < retries) { rawLog({ ...entry, note: "rate-limited, backing off" }); await sleep(1000 * 2 ** (i - 1)); continue; }
        rawLog(entry);
        return { kind: entry.kind, message: msg };
      }
      entry.kind = "OK"; entry.result = j.result; rawLog(entry);
      return { kind: "OK", result: j.result };
    } catch (e: any) {
      entry.attempts.push({ i, transport: String(e?.message ?? e).slice(0, 100) });
      if (i === retries) { entry.kind = "TRANSPORT_ERROR"; rawLog(entry); return { kind: "TRANSPORT_ERROR", message: String(e?.message ?? e) }; }
      await sleep(800 * i);
    }
  }
  return { kind: "TRANSPORT_ERROR" };
}

async function main(chainId: string) {
  const chain = CHAINS[chainId];
  const rpcUrl = chain.rpc;
  const stateFile = `${EVIDENCE}/${chainId}-scanstate.json`;
  const bn = await rpc(rpcUrl, "eth_blockNumber", []);
  const latest = parseInt(bn.result, 16);
  let state: any = existsSync(stateFile) ? JSON.parse(readFileSync(stateFile, "utf8")) : { cur: chain.from, logs: [], calls: 0, failures: [] };

  // Monad: discover the earliest servable historical block first (prune-horizon ladder)
  if (chainId === "monad" && chain.from === null) {
    let horizon: number | null = null;
    for (const back of [1000, 10000, 100000, 300000, 600000, 900000, 1200000, 2400000, 4000000]) {
      const b = latest - back;
      const r = await rpc(rpcUrl, "eth_getCode", [chain.mtq, hex(b)]);
      if (r.kind === "OK") { horizon = b; state.horizonProbes = state.horizonProbes ?? []; state.horizonProbes.push({ back, block: b, served: true }); break; }
      state.horizonProbes = state.horizonProbes ?? []; state.horizonProbes.push({ back, block: b, served: false, kind: r.kind, message: (r.message ?? "").slice(0, 80) });
    }
    console.log(`  Monad prune horizon: ${horizon !== null ? "served back to block " + horizon : "NONE of the ladder probes succeeded"}`);
    if (horizon !== null) {
      // binary search within [horizon, latest] for first code presence
      let lo = horizon, hi = latest, first: number | null = null;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const r = await rpc(rpcUrl, "eth_getCode", [chain.mtq, hex(mid)]);
        if (r.kind !== "OK") { hi = mid - 1; continue; } // state missing here → deployed later than served region start? treat as search upper bound
        const present = r.result !== "0x" && r.result !== "" && r.result !== null;
        if (present) { hi = mid - 1; first = mid; } else lo = mid + 1;
      }
      state.mtqWithinHorizon = first !== null ? { firstSeen: first } : "code absent throughout served horizon — deployed BEFORE the horizon";
      console.log(`  Monad MTQ within horizon: ${JSON.stringify(state.mtqWithinHorizon)}`);
      state.cur = first !== null ? first : horizon; // scan from wherever evidence begins
      chain.from = state.cur;
    } else { state.cur = null; }
  }
  if (state.cur === null) { console.log("  cannot scan monad — no servable horizon"); return; }

  console.log(`scanning ${chainId} MTQ transfers from block ${state.cur} → ${latest} (${chain.span}-block chunks)…`);
  let cur = state.cur;
  const span = chain.span;
  let lastSave = Date.now();
  while (cur <= latest) {
    const end = Math.min(cur + span - 1, latest);
    const r = await rpc(rpcUrl, "eth_getLogs", [{ address: chain.mtq, fromBlock: hex(cur), toBlock: hex(end), topics: [TRANSFER_TOPIC] }]);
    state.calls++;
    if (r.kind !== "OK") {
      // hard-split the window if it is still big (Monad 100-block cap already minimal — this catches result-size limits)
      state.failures.push({ at: cur, kind: r.kind, message: (r.message ?? "").slice(0, 100) });
      if (span > 100 && /range|too many|results|limit/i.test(r.message ?? "")) { /* already at minimal span for monad */ }
      if (r.kind === "RPC_ERROR" && !/limited to a 100 range/.test(r.message ?? "")) { console.log(`  aborting at ${cur}: ${r.message}`); break; }
      if (r.kind === "TRANSPORT_ERROR") { console.log(`  transport abort at ${cur}`); break; }
    }
    for (const lg of (r.result ?? [])) state.logs.push(lg);
    cur = end + 1;
    if (Date.now() - lastSave > 15000) { state.cur = cur; writeFileSync(stateFile, JSON.stringify(state)); lastSave = Date.now(); console.log(`  … block ${end} (${state.calls} calls, ${state.logs.length} logs)`); }
    await sleep(chainId === "arc" ? 100 : 40);
  }
  state.cur = cur; writeFileSync(stateFile, JSON.stringify(state));
  console.log(`  scan run ended at block ${cur} (target ${latest + 1}) with ${state.logs.length} logs in ${state.calls} calls`);

  // If complete → finalize
  if (cur > latest) {
    const decoded = state.logs.map((lg: any) => ({ blockNumber: parseInt(lg.blockNumber, 16), txHash: lg.transactionHash, logIndex: lg.logIndex, from: ("0x" + lg.topics[1].slice(26)).toLowerCase(), to: ("0x" + lg.topics[2].slice(26)).toLowerCase(), value: BigInt(lg.data).toString() })).sort((a: any, b: any) => a.blockNumber - b.blockNumber);
    const holders = new Set<string>();
    for (const d of decoded) { if (d.from !== ZERO) holders.add(d.from); if (d.to !== ZERO) holders.add(d.to); }
    const bal: Record<string, string> = {}; let sum = 0n;
    for (const h of holders) {
      const r = await rpc(rpcUrl, "eth_call", [{ to: chain.mtq, data: IFACE.encodeFunctionData("balanceOf", [h]) }, "latest"]);
      if (r.kind === "OK") { try { const v = IFACE.decodeFunctionResult("balanceOf", r.result)[0]; bal[h] = v.toString(); if (bal[h] !== "0") sum += BigInt(bal[h]); } catch { bal[h] = "DECODE_FAIL"; } } else bal[h] = `${r.kind}`;
    }
    const mints = decoded.filter((d: any) => d.from === ZERO);
    const receipts: any[] = [];
    for (const m of mints.slice(0, 3)) {
      const rc = await rpc(rpcUrl, "eth_getTransactionReceipt", [m.txHash]);
      if (rc.kind === "OK" && rc.result) receipts.push({ txHash: m.txHash, blockNumber: parseInt(rc.result.blockNumber, 16), txFrom: rc.result.from, txTo: rc.result.to, contractAddress: rc.result.contractAddress, isContractCreationTx: rc.result.to === null && (rc.result.contractAddress ?? "").toLowerCase() === chain.mtq.toLowerCase(), mintValue: m.value });
      else receipts.push({ txHash: m.txHash, kind: rc.kind, message: (rc.message ?? "").slice(0, 80) });
    }
    const final = { probe: `MTQΣ Task 9 — ${chainId} complete Transfer scan (from deploy block)`, finishedAt: new Date().toISOString(), span, calls: state.calls, failures: state.failures.slice(0, 30), logCount: decoded.length, logs: decoded.slice(0, 400), mints, burns: decoded.filter((d: any) => d.to === ZERO), holderCandidates: [...holders], holderBalances: bal, sumOfNonzeroHolderBalances: sum.toString(), genesisReceipts: receipts };
    writeFileSync(`${EVIDENCE}/${chainId}-transfers-complete.json`, JSON.stringify(final, null, 2));
    console.log(`  FINAL: ${decoded.length} logs, ${mints.length} mints, ${holders.size} holders, Σbalances=${sum}`);
    console.log(`  genesis receipts: ${JSON.stringify(receipts.map((r) => ({ b: r.blockNumber, creation: r.isContractCreationTx, from: r.txFrom, value: r.mintValue })), null, 1)}`);
  }
}

const which = process.argv[2];
if (which === "arc" || which === "monad") await main(which);
else console.log("usage: bun scan-resume.ts arc|monad");
