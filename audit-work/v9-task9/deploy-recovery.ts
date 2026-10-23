// MTQΣ — TASK 9 (part 3): deployment-block recovery + bounded Transfer scans + fixes.
// READ-ONLY (§1). Arc: corrected binary search (EMPTY historical code = valid "not deployed yet").
// Monad: prune-horizon ladder + sampled getLogs scan (100-block cap disclosed). Sentinel modules fix.
// Usage: bun deploy-recovery.ts arc|monad
import { ethers } from "ethers";
import { writeFileSync, appendFileSync, mkdirSync } from "fs";

const EVIDENCE = "/home/z/my-project/audit-work/v9-task9/evidence";
mkdirSync(EVIDENCE, { recursive: true });

const ZERO = "0x0000000000000000000000000000000000000000";
const SENTINEL = "0x0000000000000000000000000000000000000001";
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const IFACE = new ethers.Interface(["function balanceOf(address) view returns (uint256)", "function getModulesPaginated(address start, uint256 pageSize) view returns (address[] array, address next)"]);

const CHAINS: Record<string, any> = {
  arc: { rpc: "https://rpc.testnet.arc.io", mtq: "0x237c3Aa2B79248f86f6523D3890095BCd1996601",
    contracts: { "MTQ.sol": "0x237c3Aa2B79248f86f6523D3890095BCd1996601", "Governance.sol": "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", "Safe.sol": "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0", "Algorithm.sol": "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727", "Reserve.sol": "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471", "Mint.sol": "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa", "Redeem.sol": "0xcAde4594177829597882555Ff57d0e34092daF8e", "Oracle.sol": "0xFd2B8d176bf059287638Db30D02C6651dA02861e", "Takaful.sol": "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0" },
    dupes: [["gen-A 0x826b…63c1", "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1"], ["gen-B 0x2420…d9897", "0x24203404B9b971C907e8Ced96106Fa74380d9897"]] },
  monad: { rpc: "https://testnet-rpc.monad.xyz", mtq: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD",
    contracts: { "MTQ.sol": "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", "Governance.sol": "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", "Safe.sol": "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0", "Algorithm.sol": "0x8839ce50e8D414005518769999c0A5b961D00CB2", "Reserve.sol": "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177", "Mint.sol": "0x197e9CB28216dfe18a199b4c2930F74C2F460809", "Redeem.sol": "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4", "Oracle.sol": "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713", "Takaful.sol": "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19" },
    dupes: [["gen-A 0x5D95…fd4a", "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a"], ["gen-B 0x0Ac2…5982f", "0x0Ac20360234b4C988a19586CBe55733e18A5982f"]] },
};

let REQ_ID = Math.floor(Math.random() * 200000);
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
        if ((res.status === 429 || /rate|limit/i.test(msg)) && i < retries) { await sleep(700 * 2 ** (i - 1)); continue; }
        return { kind: entry.kind, message: msg, attempts };
      }
      entry.kind = "OK"; entry.result = j.result;
      rawLog(entry);
      return { kind: "OK", result: j.result, attempts };
    } catch (e: any) {
      entry.attempts.push({ i, transport: String(e?.message ?? e).slice(0, 120) });
      if (i === retries) { entry.kind = "TRANSPORT_ERROR"; rawLog(entry); return { kind: "TRANSPORT_ERROR", message: String(e?.message ?? e), attempts }; }
      await sleep(700 * i);
    }
  }
  return { kind: "TRANSPORT_ERROR", attempts };
}

const hex = (n: number) => "0x" + n.toString(16);

// Historical code presence. Returns "YES" | "NO" | { error }.
async function codeAt(rpcUrl: string, address: string, block: number): Promise<{ present: boolean | null; kind: string; message?: string }> {
  const r = await rpc(rpcUrl, "eth_getCode", [address, hex(block)]);
  if (r.kind === "OK") return { present: r.result !== "0x" && r.result !== "" && r.result !== null, kind: "OK" };
  if (r.kind === "EMPTY") return { present: false, kind: "OK" };
  return { present: null, kind: r.kind, message: r.message };
}

// Corrected binary search: EMPTY historical = "not yet deployed" (valid).
async function findDeployBlock(rpcUrl: string, address: string, latest: number): Promise<any> {
  let lo = 1, hi = latest;
  let first: number | null = null;
  let probes = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1; probes++;
    const c = await codeAt(rpcUrl, address, mid);
    if (c.present === null) return { status: "UNVERIFIED", probes, reason: `${c.kind}${c.message ? ": " + c.message.slice(0, 120) : ""} at block ${mid}` };
    if (c.present) { hi = mid - 1; first = mid; } else lo = mid + 1;
  }
  if (first === null) return { status: "NOT_DEPLOYED", probes };
  const blk = await rpc(rpcUrl, "eth_getBlockByNumber", [hex(first), false]);
  return { status: "FOUND", block: first, probes, timestamp: blk.kind === "OK" && blk.result ? new Date(Number(BigInt(blk.result.timestamp) * 1000n)).toISOString() : null };
}

async function main(chainId: string) {
  const chain = CHAINS[chainId];
  const rpcUrl = chain.rpc;
  const out: any = { probe: `MTQΣ Task 9 — ${chainId} deployment-block recovery + bounded Transfer scan`, startedAt: new Date().toISOString() };
  const bn = await rpc(rpcUrl, "eth_blockNumber", []);
  const latest = parseInt(bn.result, 16);
  out.latest = latest;

  // ---- 1. deploy blocks (corrected search) for all registry contracts + duplicate generations
  out.deployBlocks = {};
  for (const [name, addr] of Object.entries(chain.contracts) as [string, string][]) {
    out.deployBlocks[name] = await findDeployBlock(rpcUrl, addr, latest);
    console.log(`  [${name}] deploy=${JSON.stringify(out.deployBlocks[name]).slice(0, 110)}`);
  }
  out.duplicateDeployBlocks = {};
  for (const [label, addr] of chain.dupes) {
    out.duplicateDeployBlocks[label] = await findDeployBlock(rpcUrl, addr, latest);
    console.log(`  [${label}] deploy=${JSON.stringify(out.duplicateDeployBlocks[label]).slice(0, 110)}`);
  }

  // ---- 2. Safe modules with the proper sentinel (both chains use the same Safe address)
  const mods = await rpc(rpcUrl, "eth_call", [{ to: chain.contracts["Safe.sol"], data: IFACE.encodeFunctionData("getModulesPaginated", [SENTINEL, 10]) }, "latest"]);
  if (mods.kind === "OK") {
    try { const d = IFACE.decodeFunctionResult("getModulesPaginated", mods.result); out.safeModules = { array: d[0].map((x: any) => String(x)), next: String(d[1]) }; }
    catch { out.safeModules = { kind: "DECODE_FAIL", raw: String(mods.result).slice(0, 100) }; }
  } else out.safeModules = { kind: mods.kind, message: mods.message };

  // ---- 3. getLogs range-cap discovery
  const capProbes: any = {};
  for (const span of [50000, 10000, 5000, 2000, 1000, 500, 100]) {
    const from = Math.max(1, latest - span);
    const r = await rpc(rpcUrl, "eth_getLogs", [{ address: chain.mtq, fromBlock: hex(from), toBlock: hex(latest), topics: [TRANSFER_TOPIC] }]);
    capProbes[span] = r.kind === "OK" ? "OK" : String(r.message).slice(0, 80);
    if (r.kind === "OK") { out.getLogsWorkingSpan = span; break; }
  }
  out.getLogsCapProbes = capProbes;

  // ---- 4. bounded Transfer scan
  const mtqDeploy = out.deployBlocks["MTQ.sol"];
  if (mtqDeploy?.status === "FOUND" && out.getLogsWorkingSpan) {
    const from = mtqDeploy.block, to = latest;
    let span = out.getLogsWorkingSpan;
    const logs: any[] = [];
    let calls = 0, cur = from;
    while (cur <= to) {
      const end = Math.min(cur + span - 1, to);
      const r = await rpc(rpcUrl, "eth_getLogs", [{ address: chain.mtq, fromBlock: hex(cur), toBlock: hex(end), topics: [TRANSFER_TOPIC] }]);
      calls++;
      if (r.kind !== "OK") { out.transferScan = { status: "ABORTED", atBlock: cur, message: r.message, calls }; break; }
      for (const lg of (r.result ?? [])) logs.push(lg);
      cur = end + 1;
      if (calls % 50 === 0) { console.log(`    … scanned to block ${end} (${calls} calls, ${logs.length} logs)`); process.stdout.write(""); }
    }
    if (!out.transferScan) {
      const decoded = logs.map((lg) => ({ blockNumber: parseInt(lg.blockNumber, 16), txHash: lg.transactionHash, logIndex: lg.logIndex, from: ("0x" + lg.topics[1].slice(26)).toLowerCase(), to: ("0x" + lg.topics[2].slice(26)).toLowerCase(), value: BigInt(lg.data).toString() })).sort((a, b) => a.blockNumber - b.blockNumber);
      const holders = new Set<string>();
      for (const d of decoded) { if (d.from !== ZERO) holders.add(d.from); if (d.to !== ZERO) holders.add(d.to); }
      out.transferScan = { status: "COMPLETE", method: `bounded scan from deploy block ${from} with ${span}-block chunks`, calls, logCount: decoded.length, logs: decoded.slice(0, 400), mints: decoded.filter((d) => d.from === ZERO), burns: decoded.filter((d) => d.to === ZERO), holderCandidates: [...holders] };
      // holder balances + reconciliation
      const bal: Record<string, string> = {}; let sum = 0n;
      for (const h of out.transferScan.holderCandidates) {
        const r = await rpc(rpcUrl, "eth_call", [{ to: chain.mtq, data: IFACE.encodeFunctionData("balanceOf", [h]) }, "latest"]);
        if (r.kind === "OK") { try { const v = IFACE.decodeFunctionResult("balanceOf", r.result)[0]; bal[h] = v.toString(); if (bal[h] !== "0") sum += BigInt(bal[h]); } catch { bal[h] = "DECODE_FAIL"; } } else bal[h] = `${r.kind}`;
      }
      out.transferScan.holderBalances = bal;
      out.transferScan.sumOfNonzeroHolderBalances = sum.toString();
      // first-mint receipt → deployment/genesis evidence
      const receipts: any[] = [];
      for (const m of out.transferScan.mints.slice(0, 3)) {
        const rc = await rpc(rpcUrl, "eth_getTransactionReceipt", [m.txHash]);
        if (rc.kind === "OK" && rc.result) {
          const isCreation = rc.result.to === null && (rc.result.contractAddress ?? "").toLowerCase() === chain.mtq.toLowerCase();
          receipts.push({ txHash: m.txHash, blockNumber: parseInt(rc.result.blockNumber, 16), txFrom: rc.result.from, txTo: rc.result.to, contractAddress: rc.result.contractAddress, isContractCreationTx: isCreation, mintValue: m.value });
        } else receipts.push({ txHash: m.txHash, kind: rc.kind, message: (rc.message ?? "").slice(0, 100) });
      }
      out.transferScan.genesisReceipts = receipts;
    }
  } else {
    out.transferScan = { status: "SKIPPED", reason: `deploy block ${JSON.stringify(mtqDeploy).slice(0, 90)}; getLogs span ${out.getLogsWorkingSpan}` };
  }

  // ---- 5. native re-probes (fix the rate-limit gaps from part 1, esp. Arc USDC custody)
  out.nativeBalances = {};
  for (const acc of [DEPLOYER, ...Object.values(chain.contracts)] as string[]) {
    const r = await rpc(rpcUrl, "eth_getBalance", [acc, "latest"], 4);
    out.nativeBalances[acc] = r.kind === "OK" ? BigInt(r.result).toString() : `${r.kind}${r.message ? ": " + r.message.slice(0, 60) : ""}`;
  }

  out.finishedAt = new Date().toISOString();
  writeFileSync(`${EVIDENCE}/${chainId}-deploy-recovery.json`, JSON.stringify(out, null, 2));
  console.log(`\n→ evidence/${chainId}-deploy-recovery.json`);
  console.log(JSON.stringify({ deploy: Object.fromEntries(Object.entries(out.deployBlocks).map(([k, v]: any) => [k, v.block ?? v.status])), modules: out.safeModules, span: out.getLogsWorkingSpan, scan: out.transferScan?.status, scanCalls: out.transferScan?.calls, logs: out.transferScan?.logCount, mints: out.transferScan?.mints?.length, holders: out.transferScan?.holderCandidates?.length, sum: out.transferScan?.sumOfNonzeroHolderBalances, native: { deployer: out.nativeBalances[DEPLOYER] } }, null, 2));
}

const which = process.argv[2];
if (which === "arc" || which === "monad") await main(which);
else console.log("usage: bun deploy-recovery.ts arc|monad");
