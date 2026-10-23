// MTQΣ — TASK 9: Full Contract Authorization Audit (READ-ONLY)
// §1 VERIFICATION-ONLY: eth_call / eth_getCode / eth_getStorageAt / eth_getLogs /
// eth_getBalance / eth_getBlockByNumber + Solana getAccountInfo family. ZERO transactions.
// Every raw JSON-RPC request/response is preserved in evidence/raw.jsonl (with retries).
// Usage: bun full-audit.ts monad|arc|solana|local|duplicates-monad|duplicates-arc
import { ethers } from "ethers";
import { writeFileSync, appendFileSync, mkdirSync, readFileSync, existsSync } from "fs";

const OUT = "/home/z/my-project/audit-work/v9-task9";
const EVIDENCE = `${OUT}/evidence`;
mkdirSync(EVIDENCE, { recursive: true });

const ROLE = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  MINTER_ROLE: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
  PAUSER_ROLE: "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a",
};
const ZERO = "0x0000000000000000000000000000000000000000";
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const SAFE = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0";
const GOV = "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66";

const CHAINS: Record<string, any> = {
  monad: { id: "monad", name: "Monad Testnet", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz",
    explorer: "https://testnet.monadscan.com", contracts: {
      "MTQ.sol": "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD",
      "Governance.sol": "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
      "Safe.sol": "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
      "Algorithm.sol": "0x8839ce50e8D414005518769999c0A5b961D00CB2",
      "Reserve.sol": "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177",
      "Mint.sol": "0x197e9CB28216dfe18a199b4c2930F74C2F460809",
      "Redeem.sol": "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4",
      "Oracle.sol": "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713",
      "Takaful.sol": "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19" } },
  arc: { id: "arc", name: "Arc Testnet", chainId: 5042002, rpc: "https://rpc.testnet.arc.io",
    explorer: "https://testnet.arcscan.app", contracts: {
      "MTQ.sol": "0x237c3Aa2B79248f86f6523D3890095BCd1996601",
      "Governance.sol": "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
      "Safe.sol": "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
      "Algorithm.sol": "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727",
      "Reserve.sol": "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471",
      "Mint.sol": "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa",
      "Redeem.sol": "0xcAde4594177829597882555Ff57d0e34092daF8e",
      "Oracle.sol": "0xFd2B8d176bf059287638Db30D02C6651dA02861e",
      "Takaful.sol": "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0" } },
};

// Duplicate-MTQ dossier: every prior "MTQ" address generation recorded anywhere in the repo.
const DUPLICATES: Record<string, { label: string; address: string; rpc: string; chainId: number }[]> = {
  monad: [
    { label: "generation-A (contracts/deployments/Monad-Testnet.json 2026-09-06 'MTQSigma')", address: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a", rpc: CHAINS.monad.rpc, chainId: 10143 },
    { label: "generation-B (OD-35-era superseded canonical)", address: "0x0Ac20360234b4C988a19586CBe55733e18A5982f", rpc: CHAINS.monad.rpc, chainId: 10143 },
  ],
  arc: [
    { label: "generation-A (contracts/deployments/Arc-Testnet.json 2026-09-05 'MTQSigma')", address: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1", rpc: CHAINS.arc.rpc, chainId: 5042002 },
    { label: "generation-B (OD-35-era superseded canonical)", address: "0x24203404B9b971C907e8Ced96106Fa74380d9897", rpc: CHAINS.arc.rpc, chainId: 5042002 },
  ],
};

const IFACE = {
  access: new ethers.Interface([
    "function hasRole(bytes32 role, address account) view returns (bool)",
    "function getRoleAdmin(bytes32 role) view returns (bytes32)",
    "function getRoleMemberCount(bytes32 role) view returns (uint256)",
    "function getRoleMember(bytes32 role, uint256 index) view returns (address)",
  ]),
  erc20: new ethers.Interface([
    "function name() view returns (string)", "function symbol() view returns (string)",
    "function decimals() view returns (uint8)", "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)", "function paused() view returns (bool)",
  ]),
  ownable: new ethers.Interface(["function owner() view returns (address)"]),
  safe: new ethers.Interface([
    "function getThreshold() view returns (uint256)", "function getOwners() view returns (address[])",
    "function VERSION() view returns (string)", "function nonce() view returns (uint256)",
    "function getModulesPaginated(address start, uint256 pageSize) view returns (address[] array, address next)",
    "function getGuard() view returns (address)", "function guard() view returns (address)",
    "function masterCopy() view returns (address)",
  ]),
};

const GUARD_SLOT = ethers.id("guard_manager.guard.address");
const SLOT_IMPL = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bc";
const SLOT_ADMIN = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const SLOT_BEACON = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";
const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");

// ---------- RPC layer: raw evidence + classification + retries ----------
let REQ_ID = Math.floor(Math.random() * 100000);
const rawLog = (e: any) => appendFileSync(`${EVIDENCE}/raw.jsonl`, JSON.stringify(e) + "\n");

type CallKind = "OK" | "EVM_REVERT" | "EMPTY" | "RPC_ERROR" | "TRANSPORT_ERROR" | "RATE_LIMITED";
interface CallResult { kind: CallKind; result?: any; message?: string; raw?: any; attempts: any[]; }

const sleep = (ms: number) => new Promise((s) => setTimeout(s, ms));

async function rpc(rpcUrl: string, method: string, params: any[], opts: any = {}): Promise<CallResult> {
  const entry: any = { ts: new Date().toISOString(), rpc: rpcUrl, method, params, attempts: [] };
  const maxRetries: number = opts.retries ?? 3;
  for (let i = 1; i <= maxRetries; i++) {
    const started = Date.now();
    try {
      const res = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++REQ_ID, method, params }),
        signal: AbortSignal.timeout(15000) });
      entry.attempts.push({ i, httpStatus: res.status, ms: Date.now() - started });
      const j: any = await res.json();
      if (j.error) {
        const msg = String(j.error.message ?? JSON.stringify(j.error));
        entry.error = j.error;
        const ratey = res.status === 429 || /rate|too many|limit exceeded/i.test(msg);
        if (ratey && i < maxRetries) { await sleep(700 * 2 ** (i - 1)); continue; }
        const kind: CallKind = /revert/i.test(msg) ? "EVM_REVERT" : "RPC_ERROR";
        entry.kind = kind; rawLog(entry);
        return { kind, message: msg, raw: j.error, attempts: entry.attempts };
      }
      const r = j.result ?? "";
      const kind: CallKind = (r === "0x" || r === "" || r === null) ? "EMPTY" : "OK";
      entry.kind = kind; entry.result = r;
      rawLog(entry);
      return { kind, result: r, attempts: entry.attempts };
    } catch (e: any) {
      entry.attempts.push({ i, transport: String(e?.message ?? e).slice(0, 160), ms: Date.now() - started });
      if (i === maxRetries) { entry.kind = "TRANSPORT_ERROR"; rawLog(entry); return { kind: "TRANSPORT_ERROR", message: String(e?.message ?? e), attempts: entry.attempts }; }
      await sleep(600 * i);
    }
  }
  return { kind: "TRANSPORT_ERROR", attempts: entry.attempts };
}

async function ethCall(rpcUrl: string, to: string, data: string, opts: any = {}): Promise<CallResult> {
  return rpc(rpcUrl, "eth_call", [{ to, data }, "latest"], opts);
}

async function blockNumber(rpcUrl: string): Promise<number | null> {
  const r = await rpc(rpcUrl, "eth_blockNumber", []);
  return r.kind === "OK" ? parseInt(r.result!, 16) : null;
}

async function getCode(rpcUrl: string, address: string, block?: number): Promise<CallResult> {
  return rpc(rpcUrl, "eth_getCode", [address, block === undefined ? "latest" : "0x" + block.toString(16)]);
}

async function codeHash(code: string): Promise<{ sizeBytes: number; keccak256: string }> {
  const bytes = ethers.getBytes(code);
  return { sizeBytes: bytes.length, keccak256: ethers.keccak256(bytes) };
}

function stripMetadata(code: string): string {
  // Solc appends 52 bytes of CBOR metadata at the end; strip for a settings-independent comparison.
  if (code.length >= 106) return "0x" + code.slice(2, code.length - 52);
  return code;
}

async function callDecoded(rpcUrl: string, to: string, iface: ethers.Interface, fn: string, args: any[] = []): Promise<{ kind: CallKind; value?: any; message?: string; raw?: string }> {
  const data = iface.encodeFunctionData(fn, args);
  const r = await ethCall(rpcUrl, to, data);
  if (r.kind !== "OK") return { kind: r.kind, message: r.message ?? r.kind };
  try {
    const dec = iface.decodeFunctionResult(fn, r.result!);
    const v = Array.from(dec as any);
    return { kind: "OK", value: v.length === 1 ? v[0] : v, raw: r.result };
  } catch (e: any) {
    return { kind: "RPC_ERROR" as CallKind, message: "DECODE_FAIL: " + String(e?.message ?? e).slice(0, 120), raw: r.result };
  }
}

// ---------- per-contract full battery ----------
async function contractBattery(chain: any, name: string, address: string, accounts: string[], out: any) {
  const rpcUrl = chain.rpc;
  const rec: any = { name, address, explorer: `${chain.explorer}/address/${address}` };

  // 1. code + identity
  const code = await getCode(rpcUrl, address);
  if (code.kind === "EMPTY") {
    rec.deployed = false; rec.codeResult = "EMPTY (0x)"; out.contracts.push(rec);
    console.log(`  [${name}] NOT DEPLOYED (eth_getCode → 0x)`);
    return;
  }
  if (code.kind !== "OK") {
    rec.deployed = "UNVERIFIED"; rec.codeError = code.message; out.contracts.push(rec);
    console.log(`  [${name}] getCode ${code.kind}: ${code.message?.slice(0, 80)}`);
    return;
  }
  rec.deployed = true;
  const ch = await codeHash(code.result!);
  rec.codeSizeBytes = ch.sizeBytes; rec.codeKeccak256 = ch.keccak256;
  rec.codeKeccak256NoMeta = (await codeHash(stripMetadata(code.result!))).keccak256;

  // 2. proxy detection
  rec.proxy = {};
  for (const [slotName, slot] of [["eip1967_implementation", SLOT_IMPL], ["eip1967_admin", SLOT_ADMIN], ["eip1967_beacon", SLOT_BEACON]] as [string, string][]) {
    const s = await rpc(rpcUrl, "eth_getStorageAt", [address, slot, "latest"]);
    const val = s.kind === "OK" ? s.result : null;
    rec.proxy[slotName] = (s.kind === "OK" && val !== "0x" + "0".repeat(64)) ? val : (s.kind === "OK" ? null : `${s.kind}: ${s.message}`);
  }
  const slot0 = await rpc(rpcUrl, "eth_getStorageAt", [address, "0x0", "latest"]);
  rec.proxy.slot0 = slot0.kind === "OK" ? slot0.result : `${slot0.kind}`;
  if (name === "Safe.sol") {
    const mc = await callDecoded(rpcUrl, address, IFACE.safe, "masterCopy", []);
    rec.proxy.safeProxyMasterCopy = mc.kind === "OK" ? String(mc.value) : `${mc.kind}${mc.message ? ": " + mc.message.slice(0, 80) : ""}`;
    rec.proxy.slot0IsMasterCopy = slot0.kind === "OK" && !!rec.proxy.safeProxyMasterCopy && slot0.result?.toLowerCase() === String(rec.proxy.safeProxyMasterCopy).toLowerCase();
  }

  // 3. deployment block (binary search over historical eth_getCode)
  if (out.archiveSupported !== false) {
    const probe = await getCode(rpcUrl, address, Math.max(1, out.latest - 1000));
    if (probe.kind === "RPC_ERROR" || probe.kind === "TRANSPORT_ERROR") {
      out.archiveSupported = false;
      rec.deployBlock = { status: "UNVERIFIED", reason: `historical eth_getCode unsupported: ${probe.message?.slice(0, 140)}` };
      console.log(`  [${name}] archive probe failed → historical state UNVERIFIED for this chain`);
    } else {
      let lo = 1, hi = out.latest, first = out.latest;
      let searched = 0;
      let failed: any = null;
      while (lo < hi) {
        const mid = (lo + hi) >> 1; searched++;
        const c = await getCode(rpcUrl, address, mid);
        if (c.kind !== "OK") { failed = { block: mid, kind: c.kind, message: (c.message ?? "").slice(0, 120), probes: searched }; break; }
        if (c.result === "0x" || c.result === "") lo = mid + 1; else { hi = mid; first = mid; }
      }
      if (failed) rec.deployBlock = { status: "UNVERIFIED", reason: `search aborted at block ${failed.block}: ${failed.kind}`, detail: failed };
      else {
        rec.deployBlock = { status: "FOUND", block: first, probes: searched };
        const blk = await rpc(rpcUrl, "eth_getBlockByNumber", ["0x" + first.toString(16), false]);
        if (blk.kind === "OK" && blk.result) rec.deployBlock.timestamp = new Date(Number(BigInt((blk.result as any).timestamp) * 1000n)).toISOString();
      }
    }
  } else {
    rec.deployBlock = { status: "UNVERIFIED", reason: "archive state unavailable on this RPC (chain-wide)" };
  }

  // 4. role battery — every account × every role, individually
  rec.roles = {};
  for (const [roleName, roleHash] of Object.entries(ROLE)) {
    rec.roles[roleName] = {};
    for (const acc of accounts) {
      const r = await callDecoded(rpcUrl, address, IFACE.access, "hasRole", [roleHash, acc]);
      rec.roles[roleName][acc] = r.kind === "OK" ? (r.value === true ? "TRUE" : "FALSE")
        : (r.kind === "EMPTY" ? "REVERT(empty)" : `${r.kind}${r.message ? ": " + String(r.message).slice(0, 100) : ""}`);
    }
  }
  // 5. role admins + member counts + members
  rec.roleAdmins = {};
  for (const [roleName, roleHash] of Object.entries(ROLE)) {
    const a = await callDecoded(rpcUrl, address, IFACE.access, "getRoleAdmin", [roleHash]);
    rec.roleAdmins[roleName] = a.kind === "OK" ? String(a.value) : `${a.kind}${a.message ? ": " + String(a.message).slice(0, 100) : ""}`;
  }
  rec.roleMemberCounts = {};
  for (const [roleName, roleHash] of Object.entries(ROLE)) {
    const c = await callDecoded(rpcUrl, address, IFACE.access, "getRoleMemberCount", [roleHash]);
    if (c.kind === "OK") {
      const count = Number(c.value);
      rec.roleMemberCounts[roleName] = count;
      if (count > 0 && count <= 20) {
        const members: string[] = [];
        for (let i = 0; i < count; i++) {
          const m = await callDecoded(rpcUrl, address, IFACE.access, "getRoleMember", [roleHash, i]);
          members.push(m.kind === "OK" ? String(m.value) : `${m.kind}`);
        }
        rec.roleMembers = rec.roleMembers || {};
        rec.roleMembers[roleName] = members;
      }
    } else {
      rec.roleMemberCounts[roleName] = `${c.kind}${c.message ? ": " + String(c.message).slice(0, 100) : ""}`;
    }
  }
  // 6. ownership + pause probes
  const own = await callDecoded(rpcUrl, address, IFACE.ownable, "owner", []);
  rec.ownerProbe = own.kind === "OK" ? String(own.value) : `${own.kind}${own.message ? ": " + String(own.message).slice(0, 100) : ""}`;
  const paused = await callDecoded(rpcUrl, address, IFACE.erc20, "paused", []);
  rec.pausedProbe = paused.kind === "OK" ? (paused.value === true ? "TRUE" : "false") : `${paused.kind}${paused.message ? ": " + String(paused.message).slice(0, 100) : ""}`;

  out.contracts.push(rec);
  console.log(`  [${name}] ${ch.sizeBytes}B keccak=${ch.keccak256.slice(0, 18)}… deploy=${rec.deployBlock?.block ?? rec.deployBlock?.status} admin(deployer)=${rec.roles.DEFAULT_ADMIN_ROLE[DEPLOYER]}`);
}

// ---------- MTQ token extras ----------
async function tokenExtras(chain: any, out: any) {
  const rpcUrl = chain.rpc;
  const mtq = chain.contracts["MTQ.sol"];
  const t: any = { address: mtq };
  for (const fn of ["name", "symbol", "decimals", "totalSupply"]) {
    const r = await callDecoded(rpcUrl, mtq, IFACE.erc20, fn, []);
    t[fn] = r.kind === "OK" ? String(r.value) : `${r.kind}${r.message ? ": " + String(r.message).slice(0, 100) : ""}`;
  }
  t.balances = {};
  for (const acc of [DEPLOYER, ...Object.values(chain.contracts)] as string[]) {
    const b = await callDecoded(rpcUrl, mtq, IFACE.erc20, "balanceOf", [acc]);
    t.balances[acc] = b.kind === "OK" ? b.value?.toString() : `${b.kind}`;
  }
  const natives: any = {};
  for (const acc of [DEPLOYER, ...Object.values(chain.contracts)] as string[]) {
    const nb = await rpc(rpcUrl, "eth_getBalance", [acc, "latest"]);
    natives[acc] = nb.kind === "OK" ? BigInt(nb.result!).toString() : `${nb.kind}`;
  }
  t.nativeBalancesWei = natives;
  out.token = t;
  console.log(`  MTQ ${t.name}/${t.symbol} supply=${t.totalSupply}`);
}

// ---------- Safe battery ----------
async function safeBattery(chain: any, out: any) {
  const rpcUrl = chain.rpc;
  const safe = chain.contracts["Safe.sol"];
  const s: any = { address: safe };
  for (const fn of ["getThreshold", "nonce"]) {
    const r = await callDecoded(rpcUrl, safe, IFACE.safe, fn, []);
    s[fn] = r.kind === "OK" ? Number(r.value) : `${r.kind}${r.message ? ": " + String(r.message).slice(0, 120) : ""}`;
  }
  const owners = await callDecoded(rpcUrl, safe, IFACE.safe, "getOwners", []);
  s.owners = owners.kind === "OK" ? owners.value.map((o: any) => String(o)) : `${owners.kind}${owners.message ? ": " + String(owners.message).slice(0, 120) : ""}`;
  const ver = await callDecoded(rpcUrl, safe, IFACE.safe, "VERSION", []);
  s.version = ver.kind === "OK" ? String(ver.value) : `${ver.kind}${ver.message ? ": " + String(ver.message).slice(0, 120) : ""}`;
  const mods = await callDecoded(rpcUrl, safe, IFACE.safe, "getModulesPaginated", [ZERO, 10]);
  if (mods.kind === "OK") {
    const [arr, next] = mods.value as any[];
    s.modules = arr.map((m: any) => String(m)); s.modulesNext = String(next);
  } else s.modules = `${mods.kind}${mods.message ? ": " + String(mods.message).slice(0, 120) : ""}`;
  const g = await rpc(rpcUrl, "eth_getStorageAt", [safe, GUARD_SLOT, "latest"]);
  s.guardSlot = g.kind === "OK" ? (g.result === "0x" + "0".repeat(64) ? "address(0) — NO GUARD" : g.result) : `${g.kind}`;
  for (const fn of ["getGuard", "guard"]) {
    const r = await callDecoded(rpcUrl, safe, IFACE.safe, fn, []);
    s[fn] = r.kind === "OK" ? String(r.value) : `${r.kind}${r.message ? ": " + String(r.message).slice(0, 100) : ""}`;
  }
  out.safe = s;
  console.log(`  Safe: threshold=${s.getThreshold} owners=${Array.isArray(s.owners) ? s.owners.length : s.owners} v=${s.version} nonce=${s.nonce} guard=${s.guardSlot?.slice(0, 20)}`);
}

// ---------- Transfer log scan ----------
async function scanTransfers(chain: any, out: any) {
  const rpcUrl = chain.rpc;
  const mtq = chain.contracts["MTQ.sol"];
  const mtqRec = out.contracts.find((c: any) => c.name === "MTQ.sol");
  if (!mtqRec?.deployBlock?.block) { out.transfers = { status: "SKIPPED", reason: "deploy block unavailable" }; return; }
  const from = mtqRec.deployBlock.block, to = out.latest;
  let chunk = 50000; let cur = from;
  const logs: any[] = []; let chunksTried = 0; let halvings = 0;
  while (cur <= to) {
    const end = Math.min(cur + chunk - 1, to);
    const r = await rpc(rpcUrl, "eth_getLogs", [{ address: mtq, fromBlock: "0x" + cur.toString(16), toBlock: "0x" + end.toString(16), topics: [TRANSFER_TOPIC] }]);
    chunksTried++;
    if (r.kind === "RPC_ERROR") {
      if (chunk > 2000 && /range|limit|too many|results/i.test(r.message ?? "")) { chunk = Math.floor(chunk / 2); halvings++; continue; }
      out.transfers = { status: "ABORTED", reason: r.message, atBlock: cur, chunksTried, halvings }; return;
    }
    if (r.kind === "TRANSPORT_ERROR") { out.transfers = { status: "ABORTED", reason: r.message, atBlock: cur, chunksTried, halvings }; return; }
    for (const lg of ((r.result as any[]) ?? [])) logs.push(lg);
    cur = end + 1;
    await sleep(120);
  }
  const decoded = logs.map((lg) => {
    const from_ = ("0x" + lg.topics[1].slice(26)).toLowerCase();
    const to_ = ("0x" + lg.topics[2].slice(26)).toLowerCase();
    return { blockNumber: parseInt(lg.blockNumber, 16), txHash: lg.transactionHash, logIndex: lg.logIndex, from: from_, to: to_, value: BigInt(lg.data).toString() };
  });
  const mints = decoded.filter((d) => d.from === ZERO);
  const burns = decoded.filter((d) => d.to === ZERO);
  const holders = new Set<string>();
  for (const d of decoded) { if (d.from !== ZERO) holders.add(d.from); if (d.to !== ZERO) holders.add(d.to); }
  out.transfers = { status: "COMPLETE", fromBlock: from, toBlock: to, chunksTried, halvings, logCount: decoded.length, mintCount: mints.length, burnCount: burns.length, mints, burns, holderCandidateCount: holders.size, holderCandidates: [...holders].slice(0, 40), logs: decoded.slice(0, 300) };
  console.log(`  Transfers: ${decoded.length} logs (${mints.length} mints, ${burns.length} burns, ${holders.size} holder candidates)`);
}

// ---------- holder balance verification ----------
async function holderBalances(chain: any, out: any) {
  if (out.transfers?.status !== "COMPLETE") return;
  const rpcUrl = chain.rpc; const mtq = chain.contracts["MTQ.sol"];
  const verified: Record<string, string> = {};
  for (const h of out.transfers.holderCandidates) {
    const b = await callDecoded(rpcUrl, mtq, IFACE.erc20, "balanceOf", [h]);
    verified[h] = b.kind === "OK" ? b.value?.toString() : `${b.kind}`;
  }
  let sum = 0n;
  for (const v of Object.values(verified)) if (typeof v === "string" && /^\d+$/.test(v)) sum += BigInt(v);
  out.holderBalances = verified;
  out.supplyReconciliation = { totalSupply: out.token.totalSupply, sumOfVerifiedHolderBalances: sum.toString(), closes: out.token.totalSupply === sum.toString(), note: "holder set derived from complete Transfer log scan (all candidates verified)" };
  console.log(`  Supply reconciliation: totalSupply=${out.token.totalSupply} Σholders=${sum} closes=${out.token.totalSupply === sum}`);
}

// ---------- per-chain driver ----------
async function auditChain(chainId: string) {
  const chain = CHAINS[chainId];
  const out: any = { probe: `MTQΣ Task 9 — ${chain.name} full authorization audit`, mode: "VERIFICATION-ONLY (§1) — read-only eth_call/eth_getCode/eth_getStorageAt/eth_getLogs; no transactions", startedAt: new Date().toISOString(), chain: { id: chain.id, name: chain.name, expectedChainId: chain.chainId, rpc: chain.rpc } };
  const cid = await rpc(chain.rpc, "eth_chainId", []);
  out.chain.reportedChainId = cid.kind === "OK" ? parseInt(cid.result!, 16) : `${cid.kind}`;
  out.chain.chainIdMatches = out.chain.reportedChainId === chain.chainId;
  const bn = await blockNumber(chain.rpc);
  out.latest = bn; out.archiveSupported = null; out.contracts = [];
  console.log(`\n=== ${chain.name} — chainId=${out.chain.reportedChainId} block=${bn} ===`);
  const accounts = [DEPLOYER, SAFE, GOV, ...Object.values(chain.contracts)] as string[];
  const uniqAccounts = [...new Set(accounts.map((a) => a))];
  for (const [name, addr] of Object.entries(chain.contracts) as [string, string][]) {
    await contractBattery(chain, name, addr, uniqAccounts, out);
  }
  await tokenExtras(chain, out);
  await safeBattery(chain, out);
  await scanTransfers(chain, out);
  await holderBalances(chain, out);
  // REVERT double-check (retry evidence for role reverts, per Task 9 §B)
  const reverts: any[] = [];
  for (const c of out.contracts) for (const [rn, accounts_] of Object.entries<any>(c.roles ?? {})) {
    for (const [acc, v] of Object.entries(accounts_)) {
      if (String(v).startsWith("REVERT") || String(v).startsWith("RPC_ERROR") || String(v).startsWith("EMPTY")) {
        const again = await callDecoded(chain.rpc, c.address, IFACE.access, "hasRole", [ROLE[rn], acc]);
        reverts.push({ contract: c.name, role: rn, account: acc, first: v, second: again.kind === "OK" ? (again.value === true ? "TRUE" : "FALSE") : `${again.kind}` });
      }
    }
  }
  out.revertRecheck = reverts;
  out.finishedAt = new Date().toISOString();
  writeFileSync(`${EVIDENCE}/${chain.id}-inventory.json`, JSON.stringify(out, null, 2));
  console.log(`→ evidence/${chain.id}-inventory.json written (${out.contracts.length} contracts, ${reverts.length} revert re-checks)`);
}

// ---------- duplicates dossier ----------
async function auditDuplicates(chainId: string) {
  const dupes = DUPLICATES[chainId];
  const out: any = { probe: `MTQΣ Task 9 — ${chainId} duplicate-MTQ dossier`, startedAt: new Date().toISOString(), entries: [] };
  const bn = await blockNumber(CHAINS[chainId].rpc); out.block = bn;
  for (const d of dupes) {
    const code = await getCode(d.rpc, d.address);
    const rec: any = { ...d };
    if (code.kind === "OK" && code.result !== "0x" && code.result !== "") {
      rec.deployed = true;
      const ch = await codeHash(code.result);
      rec.codeSizeBytes = ch.sizeBytes; rec.codeKeccak256 = ch.keccak256;
      for (const fn of ["name", "symbol", "decimals", "totalSupply"]) {
        const r = await callDecoded(d.rpc, d.address, IFACE.erc20, fn, []);
        rec[fn] = r.kind === "OK" ? String(r.value) : `${r.kind}`;
      }
      const ownerBal = await callDecoded(d.rpc, d.address, IFACE.erc20, "balanceOf", [DEPLOYER]);
      rec.deployerBalance = ownerBal.kind === "OK" ? ownerBal.value?.toString() : `${ownerBal.kind}`;
    } else rec.deployed = code.kind === "EMPTY" ? false : `${code.kind}`;
    out.entries.push(rec);
    console.log(`  [${d.label}] ${rec.deployed === true ? `${rec.codeSizeBytes}B ${rec.name}/${rec.symbol} supply=${rec.totalSupply} deployerBal=${rec.deployerBalance}` : `deployed=${rec.deployed}`}`);
  }
  writeFileSync(`${EVIDENCE}/${chainId}-duplicates.json`, JSON.stringify(out, null, 2));
  console.log(`→ evidence/${chainId}-duplicates.json written`);
}

// ---------- Solana ----------
async function auditSolana() {
  const RPC = "https://api.devnet.solana.com";
  const MINT = "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4";
  const WALLET = "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3";
  const OLD = "2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY"; // superseded OD-35-era mint (provenance)
  const out: any = { probe: "MTQΣ Task 9 — Solana devnet read-only audit", startedAt: new Date().toISOString(), rpc: RPC };
  const b58 = (buf: Buffer) => { const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; let n = 0n; for (const b of buf) n = n * 256n + BigInt(b); let s = ""; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; } let pad = 0; for (const b of buf) { if (b === 0) pad++; else break; } return "1".repeat(pad) + s; };
  const ai = await rpc(RPC, "getAccountInfo", [MINT, { encoding: "base64" }]);
  if (ai.kind === "OK" && ai.result?.value?.data) {
    const raw = Buffer.from(ai.result.value.data[0], "base64");
    const parseMint = (buf: Buffer) => ({
      mintAuthorityOption: buf.readUInt32LE(0) === 1 ? "SET" : "NONE",
      mintAuthority: buf.readUInt32LE(0) === 1 ? b58(buf.subarray(4, 36)) : null,
      supplyRaw: buf.readBigUInt64LE(36).toString(),
      decimals: buf.readUInt8(44),
      isInitialized: buf.readUInt8(45) === 1,
      freezeAuthorityOption: buf.readUInt32LE(46) === 1 ? "SET" : "NONE",
      freezeAuthority: buf.readUInt32LE(46) === 1 ? b58(buf.subarray(50, 82)) : null,
      dataLen: buf.length,
    });
    out.mintAccount = { kind: "OK", ownerProgram: ai.result.value.owner, lamports: ai.result.value.lamports, parsed: parseMint(raw), raw: ai.result.value.data };
  } else out.mintAccount = { kind: ai.kind, message: ai.message };
  const ts = await rpc(RPC, "getTokenSupply", [MINT]);
  out.tokenSupply = ts.kind === "OK" ? ts.result.value : `${ts.kind}${ts.message ? ": " + ts.message : ""}`;
  const wa = await rpc(RPC, "getAccountInfo", [WALLET, { encoding: "base64" }]);
  out.walletAccount = wa.kind === "OK" && wa.result?.value ? { owner: wa.result.value.owner, lamports: wa.result.value.lamports, dataLen: Buffer.from(wa.result.value.data[0], "base64").length } : `${wa.kind}${wa.message ? ": " + wa.message : ""}`;
  const ta = await rpc(RPC, "getTokenAccountsByOwner", [WALLET, { mint: MINT }, { encoding: "jsonParsed" }]);
  out.walletTokenAccounts = ta.kind === "OK" ? { count: ta.result.value.length, accounts: ta.result.value.map((a: any) => ({ mint: a.account.data.parsed?.info?.mint, owner: a.account.data.parsed?.info?.owner, amount: a.account.data.parsed?.info?.tokenAmount?.uiAmountString, program: a.account.owner })) } : `${ta.kind}${ta.message ? ": " + ta.message : ""}`;
  const sigs = await rpc(RPC, "getSignaturesForAddress", [MINT, { limit: 10 }]);
  out.mintSignatures = sigs.kind === "OK" ? { count: sigs.result.length, latest: sigs.result.slice(0, 5).map((s: any) => ({ signature: String(s.signature).slice(0, 16) + "…", slot: s.slot, err: s.err })) } : `${sigs.kind}${sigs.message ? ": " + sigs.message : ""}`;
  const oldAi = await rpc(RPC, "getAccountInfo", [OLD, { encoding: "base64" }]);
  out.supersededMintPresence = oldAi.kind === "OK" ? (oldAi.result?.value ? "ACCOUNT EXISTS" : "NOT FOUND (closed/never at this address)") : `${oldAi.kind}`;
  out.finishedAt = new Date().toISOString();
  writeFileSync(`${EVIDENCE}/solana-inventory.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ mint: out.mintAccount?.parsed ?? out.mintAccount, supply: out.tokenSupply?.uiAmountString, walletTA: out.walletTokenAccounts?.count, superseded: out.supersededMintPresence }, null, 2));
}

// ---------- local build identity ----------
async function auditLocal() {
  const out: any = { probe: "MTQΣ Task 9 — local source/build identity", startedAt: new Date().toISOString() };
  const files = [
    ["contracts/foundry-out/MTQSigma.sol/MTQSigma.json", "MTQSigma V1 (foundry-out)"],
    ["contracts/foundry-out/MTQSigmaV2.sol/MTQSigmaV2.json", "MTQSigmaV2 (foundry-out)"],
    ["contracts/foundry-out/MTQSigmaV3.sol/MTQSigmaV3.json", "MTQSigmaV3 (foundry-out)"],
  ] as [string, string][];
  out.localBuilds = [];
  for (const [f, label] of files) {
    if (!existsSync(f)) { out.localBuilds.push({ label, file: f, status: "FILE NOT FOUND" }); continue; }
    const j = JSON.parse(readFileSync(f, "utf8"));
    const deployed: string = j.deployedBytecode?.object ?? j.deployedBytecode ?? j.bytecode?.object ?? "";
    const size = ethers.getBytes(deployed).length;
    out.localBuilds.push({ label, file: f, deployedBytes: size, keccak256: ethers.keccak256(ethers.getBytes(deployed)), keccak256NoMeta: ethers.keccak256(ethers.getBytes(stripMetadata(deployed))), compiler: j.compiler?.version ?? null });
  }
  const keyFile = "scripts/verify-key-and-audit-roles.ts";
  out.c045KeyExposure = { file: keyFile, exists: existsSync(keyFile) };
  if (out.c045KeyExposure.exists) {
    const txt = readFileSync(keyFile, "utf8");
    out.c045KeyExposure.literalHex64Count = (txt.match(/0x[0-9a-fA-F]{64}/g) ?? []).length;
    out.c045KeyExposure.containsPrivateKeyLiteral = /private|PRIVATE/i.test(txt) && (txt.match(/0x[0-9a-fA-F]{64}/g) ?? []).length > 0;
    out.c045KeyExposure.note = "presence reported WITHOUT exposing any key material (§1)";
  }
  out.finishedAt = new Date().toISOString();
  writeFileSync(`${EVIDENCE}/local-identity.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}

const which = process.argv[2] ?? "none";
if (which === "monad") await auditChain("monad");
else if (which === "arc") await auditChain("arc");
else if (which === "solana") await auditSolana();
else if (which === "local") await auditLocal();
else if (which === "duplicates-monad") await auditDuplicates("monad");
else if (which === "duplicates-arc") await auditDuplicates("arc");
else console.log("usage: bun full-audit.ts monad|arc|solana|local|duplicates-monad|duplicates-arc");
console.log("\nDONE — evidence in audit-work/v9-task9/evidence/");
