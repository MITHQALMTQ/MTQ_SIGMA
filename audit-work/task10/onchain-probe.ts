/**
 * MTQΣ Task 10 — CANONICAL ARCHITECTURE RE-PROBE (READ-ONLY)
 * TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS
 * eth_call / eth_getCode / eth_getStorageAt / eth_getBalance / eth_getTransactionCount /
 * Solana getAccountInfo / getTokenSupply / getTokenLargestAccounts / getTokenAccountsByOwner /
 * getSignaturesForAddress / getTransaction — ZERO transactions sent.
 */
import { writeFileSync, appendFileSync, readFileSync, existsSync } from "node:fs";
import { keccak256, toUtf8Bytes, Interface, JsonRpcProvider, Network } from "ethers";

const EV = (p: string) => "/home/z/my-project/" + p;
const RAWLOG = EV("audit-work/task10/evidence/raw-onchain.jsonl");
const now = () => new Date().toISOString();
const log = (o: any) => appendFileSync(RAWLOG, JSON.stringify({ t: now(), ...o }) + "\n");

const MONAD = "https://testnet-rpc.monad.xyz";
const ARC = "https://rpc.testnet.arc.io";
const RH = "https://rpc.testnet.chain.robinhood.com/rpc";
const SOL = "https://api.devnet.solana.com";

const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const DEAD = "0x000000000000000000000000000000000000dEaD";
const R = { admin: "0x" + "0".repeat(64), minter: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", pauser: "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a" };

const REGISTRY: Record<string, any> = {
  monad: {
    rpc: MONAD, chainId: 10143,
    MTQ: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD",
    Governance: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
    Safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
    Algorithm: "0x8839ce50e8D414005518769999c0A5b961D00CB2",
    Reserve: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177",
    Mint: "0x197e9CB28216dfe18a199b4c2930F74C2F460809",
    Redeem: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4",
    Oracle: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713",
    Takaful: "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19",
    generations: {
      genA: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a",
      genB: "0x0Ac20360234b4C988a19586CBe55733e18A5982f",
    },
  },
  arc: {
    rpc: ARC, chainId: 5042002,
    MTQ: "0x237c3Aa2B79248f86f6523D3890095BCd1996601",
    Governance: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
    Safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
    Algorithm: "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727",
    Reserve: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471",
    Mint: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa",
    Redeem: "0xcAde4594177829597882555Ff57d0e34092daF8e",
    Oracle: "0xFd2B8d176bf059287638Db30D02C6651dA02861e",
    Takaful: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0",
    generations: {
      genA: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1",
      genB: "0x24203404B9b971C907e8Ced96106Fa74380d9897",
      genC: "0x5C728F729110013A1fa59fFc85938bbD973A2563",
    },
  },
};

const ERC20_ABI = ["function name() view returns (string)", "function symbol() view returns (string)", "function decimals() view returns (uint8)", "function totalSupply() view returns (uint256)", "function balanceOf(address) view returns (uint256)", "function cap() view returns (uint256)"];
const AC_ABI = ["function hasRole(bytes32,address) view returns (bool)", "function getRoleAdmin(bytes32) view returns (bytes32)", "function getRoleMemberCount(bytes32) view returns (uint256)", "function paused() view returns (bool)", "function owner() view returns (address)"];
const SAFE_ABI = ["function getThreshold() view returns (uint256)", "function getOwners() view returns (address[])", "function nonce() view returns (uint256)", "function VERSION() view returns (string)", "function getModulesPaginated(address,uint256) view returns (address[],address)", "function getGuard() view returns (address)"];

async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e: any) {
      const msg = String(e?.message ?? e);
      if (i >= tries) { log({ call: label, error: msg, attempts: i, verdict: "ERROR-UNVERIFIED" }); throw e; }
      log({ call: label, error: msg, attempts: i, verdict: "RETRY" });
      await new Promise(r => setTimeout(r, 1500 * i));
    }
  }
}
/** classify a failure: EVM revert vs transport/rate-limit vs missing-fn */
function classify(e: any): string {
  const m = String(e?.message ?? e);
  if (/revert/i.test(m)) return "EVM-REVERT";
  if (/429|rate|limit|timeout|ECONN|fetch|network/i.test(m)) return "TRANSPORT/RATE-LIMIT";
  return "OTHER";
}

async function safeCall(p: JsonRpcProvider, abi: string[], addr: string, fn: string, args: any[], label: string): Promise<{ ok: boolean; value?: any; err?: string; cls?: string }> {
  try {
    const i = new Interface(abi);
    const res = await withRetry(async () => {
      const call = await p.call({ to: addr, data: i.encodeFunctionData(fn, args) });
      return i.decodeFunctionResult(fn, call);
    }, label);
    const v = Array.isArray(res) ? (res.length === 1 ? res[0] : res.map((x: any) => typeof x === "bigint" ? x.toString() : String(x))) : res;
    return { ok: true, value: typeof v === "bigint" ? v.toString() : v };
  } catch (e: any) {
    return { ok: false, err: String(e.message ?? e).slice(0, 160), cls: classify(e) };
  }
}

async function rpcRaw(url: string, method: string, params: any[], label: string): Promise<any> {
  return withRetry(async () => {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    const j = await r.json();
    if (j.error) { log({ call: label, jsonrpcError: j.error }); throw new Error(j.error.message ?? JSON.stringify(j.error)); }
    log({ call: label, result: typeof j.result === "string" ? (j.result.length > 400 ? j.result.slice(0, 120) + `…(${j.result.length}ch)` : j.result) : j.result });
    return j.result;
  }, label);
}

function extractSelectors(code: string): string[] {
  const c = code.slice(2);
  const set = new Set<string>();
  for (let i = 0; i + 10 <= c.length;) {
    const op = parseInt(c.slice(i, i + 2), 16);
    if (op === 0x63) { const imm = c.slice(i + 2, i + 10); if (imm.length === 8) set.add("0x" + imm.toLowerCase()); i += 10; continue; }
    // skip push operands
    if (op >= 0x60 && op <= 0x7f) { i += 2 + (op - 0x5f) * 2; continue; }
    // rough data-skip: everything else advances 1 byte
    i += 2;
  }
  return [...set];
}

function selOf(sig: string): string { return keccak256(toUtf8Bytes(sig)).slice(0, 10); }

// local ABI dictionary from foundry artifacts + standard interfaces
function localSigDict(): Record<string, string[]> {
  const dict: Record<string, string[]> = {};
  const add = (sig: string) => { const s = selOf(sig).toLowerCase(); (dict[s] ??= []).push(sig); };
  for (const sig of ["name()", "symbol()", "decimals()", "totalSupply()", "balanceOf(address)", "transfer(address,uint256)", "transferFrom(address,address,uint256)", "approve(address,uint256)", "allowance(address,address)", "cap()", "hasRole(bytes32,address)", "getRoleAdmin(bytes32)", "grantRole(bytes32,address)", "revokeRole(bytes32,address)", "renounceRole(bytes32,address)", "getRoleMember(bytes32)", "getRoleMemberCount(bytes32)", "DEFAULT_ADMIN_ROLE()", "MINTER_ROLE()", "PAUSER_ROLE()", "paused()", "pause()", "unpause()", "owner()", "transferOwnership(address)", "renounceOwnership()", "mint(address,uint256)", "burn(uint256)", "burnFrom(address,uint256)", "getThreshold()", "getOwners()", "nonce()", "VERSION()", "getModulesPaginated(address,uint256)", "getGuard()", "getGenesisReserve()", "genesisReserve()", "gfb()", "getMTQPrice()", "protocolStatus()", "mintPaused()", "redeemPaused()", "getHonestStatus()", "isProductionAuthorized()", "getValidationGates()"]) add(sig);
  try {
    for (const f of ["MTQToken", "Governance", "MintContract", "RedeemContract", "Oracle", "ReserveVault", "Takaful", "AlgorithmEngine", "Safe", "MockUSDC"]) {
      const art = JSON.parse(readFileSync(EV(`contracts/foundry-out/MtqEcosystem.sol/${f}.json`), "utf8"));
      for (const a of art.abi ?? []) if (a.type === "function") add(`${a.name}(${a.inputs.map((i: any) => i.type).join(",")})`);
    }
    for (const f of ["MTQSigma", "MTQSigmaV2", "MTQSigmaV3"]) {
      for (const dir of ["foundry-out/MTQSigma.sol", "foundry-out/MTQSigmaV2.sol", "foundry-out/MTQSigmaV3.sol", "contracts/foundry-out/MTQSigmaV3.sol", "contracts/foundry-out/MTQSigmaV2.sol"]) {
        const p = EV(`${dir}/${f}.json`);
        if (!existsSync(p)) continue;
        const art = JSON.parse(readFileSync(p, "utf8"));
        for (const a of art.abi ?? []) if (a.type === "function") add(`${a.name}(${a.inputs.map((i: any) => i.type).join(",")})`);
      }
    }
  } catch (e: any) { log({ note: "localSigDict partial", err: String(e.message).slice(0, 120) }); }
  return dict;
}
const SIGDICT = localSigDict();

async function openchainLookup(sels: string[]): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  try {
    const q = sels.map(s => `function=${s}`).join("&");
    const r = await fetch(`https://api.openchain.xyz/signature-database/v1/lookup?${q}`, { signal: AbortSignal.timeout(8000) });
    const j = await r.json() as any;
    for (const s of sels) { const names = (j?.result?.function?.[s] ?? []).map((x: any) => x.name); if (names.length) out[s] = names; }
    log({ call: "openchain-lookup", ok: true, resolved: Object.keys(out).length, asked: sels.length });
  } catch (e: any) { log({ call: "openchain-lookup", ok: false, err: String(e.message).slice(0, 100) }); }
  return out;
}

const EIP1967 = { impl: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", admin: "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103", beacon: "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50" };

async function probeChain(key: "monad" | "arc") {
  const cfg = REGISTRY[key];
  const p = new JsonRpcProvider(cfg.rpc, new Network(key, cfg.chainId));
  const out: any = { chain: key, startedAt: now() };
  const netChainId = await withRetry(() => p.send("eth_chainId", []), `${key}:eth_chainId`);
  const bn = await withRetry(() => p.getBlockNumber(), `${key}:blockNumber`);
  const blk = await withRetry(() => p.getBlock(bn), `${key}:getBlock(${bn})`);
  out.chainId = netChainId; out.assertChainId = parseInt(netChainId, 16) === cfg.chainId; out.block = bn; out.blockTs = new Date(Number(blk?.timestamp) * 1000).toISOString();

  // bytecode identity + selectors + proxy slots for all 9
  out.contracts = {};
  const unknownSelectors = new Set<string>();
  for (const [name, addr] of Object.entries({ ...cfg, generations: undefined } as any).filter(([k, v]) => typeof v === "string" && v.startsWith("0x")) as [string, string][]) {
    const code = await withRetry(() => p.send("eth_getCode", [addr, "latest"]), `${key}:${name}:eth_getCode`);
    const size = (code.length - 2) / 2;
    const kh = keccak256(code);
    const sels = extractSelectors(code);
    const resolved: Record<string, string[]> = {};
    for (const s of sels) { const local = SIGDICT[s]; if (local) resolved[s] = local; else unknownSelectors.add(s); }
    const slots: Record<string, string> = {};
    for (const [slotName, slot] of Object.entries(EIP1967)) {
      try { const v = await withRetry(() => p.send("eth_getStorageAt", [addr, slot, "latest"]), `${key}:${name}:slot:${slotName}`); slots[slotName] = v; } catch { slots[slotName] = "UNREACHABLE"; }
    }
    const slot0 = await withRetry(() => p.send("eth_getStorageAt", [addr, "0x" + "0".repeat(64), "latest"]), `${key}:${name}:slot:0`);
    out.contracts[name] = { addr, codeSize: size, runtimeKeccak: kh, selectors: sels, resolvedSelectors: resolved, eip1967: slots, slot0, deployed: size > 0 };
  }
  // generations (tokens)
  out.generations = {};
  for (const [g, addr0] of Object.entries(cfg.generations as Record<string, string>)) {
    const addr = addr0;
    const erc = new Interface(ERC20_ABI);
    const gout: any = { addr };
    const code = await withRetry(() => p.send("eth_getCode", [addr, "latest"]), `${key}:gen:${g}:eth_getCode`);
    gout.codeSize = (code.length - 2) / 2; gout.runtimeKeccak = keccak256(code); gout.deployed = gout.codeSize > 0;
    for (const fn of ["name", "symbol", "decimals", "totalSupply", "cap"]) gout[fn] = await safeCall(p, ERC20_ABI, addr, fn, [], `${key}:gen:${g}:${fn}`);
    gout.balanceOfDeployer = await safeCall(p, ERC20_ABI, addr, "balanceOf", [DEPLOYER], `${key}:gen:${g}:bal:deployer`);
    gout.balanceOfDead = await safeCall(p, ERC20_ABI, addr, "balanceOf", [DEAD], `${key}:gen:${g}:bal:dead`);
    out.generations[g] = gout;
  }

  // MTQ deep probe
  const mtq = cfg.MTQ;
  out.mtq = {};
  for (const fn of ["name", "symbol", "decimals", "totalSupply", "cap"]) out.mtq[fn] = await safeCall(p, ERC20_ABI, mtq, fn, [], `${key}:MTQ:${fn}`);
  out.mtq.paused = await safeCall(p, AC_ABI, mtq, "paused", [], `${key}:MTQ:paused`);
  const dec = out.mtq.decimals?.ok ? Number(out.mtq.decimals.value) : 18;
  for (const [who, waddr] of Object.entries({ deployer: DEPLOYER, dead: DEAD, safe: cfg.Safe, governance: cfg.Governance, mintModule: cfg.Mint, reserveModule: cfg.Reserve, redeemModule: cfg.Redeem, algorithm: cfg.Algorithm, oracle: cfg.Oracle, takaful: cfg.Takaful, zero: "0x0000000000000000000000000000000000000000" })) {
    out.mtq[`balanceOf_${who}`] = await safeCall(p, ERC20_ABI, mtq, "balanceOf", [waddr as string], `${key}:MTQ:bal:${who}`);
  }
  // role matrix
  out.roles = {};
  for (const [roleName, roleHash] of Object.entries(R)) {
    out.roles[roleName] = {};
    for (const [acct, aaddr] of Object.entries({ deployer: DEPLOYER, safe: cfg.Safe, governance: cfg.Governance, mintModule: cfg.Mint, reserveModule: cfg.Reserve, redeemModule: cfg.Redeem })) {
      out.roles[roleName][acct] = await safeCall(p, AC_ABI, mtq, "hasRole", [roleHash, aaddr as string], `${key}:MTQ:hasRole:${roleName}:${acct}`);
    }
    out.roles[`${roleName}_admin`] = await safeCall(p, AC_ABI, mtq, "getRoleAdmin", [roleHash], `${key}:MTQ:getRoleAdmin:${roleName}`);
    out.roles[`${roleName}_memberCount`] = await safeCall(p, AC_ABI, mtq, "getRoleMemberCount", [roleHash], `${key}:MTQ:memberCount:${roleName}`);
  }
  // modules admin re-verify
  out.moduleAdmin = {};
  for (const m of ["Algorithm", "Reserve", "Mint", "Redeem", "Oracle", "Takaful"]) {
    const addr = (cfg as any)[m];
    out.moduleAdmin[m] = {
      admin_deployer: await safeCall(p, AC_ABI, addr, "hasRole", [R.admin, DEPLOYER], `${key}:${m}:hasRole:admin:deployer`),
      minter_deployer: await safeCall(p, AC_ABI, addr, "hasRole", [R.minter, DEPLOYER], `${key}:${m}:hasRole:minter:deployer`),
      pauser_deployer: await safeCall(p, AC_ABI, addr, "hasRole", [R.pauser, DEPLOYER], `${key}:${m}:hasRole:pauser:deployer`),
      paused: await safeCall(p, AC_ABI, addr, "paused", [], `${key}:${m}:paused`),
      owner: await safeCall(p, ["function owner() view returns (address)"], addr, "owner", [], `${key}:${m}:owner`),
    };
  }
  // Safe deep
  out.safe = {};
  for (const fn of ["getThreshold", "getOwners", "nonce", "VERSION", "getGuard"]) out.safe[fn] = await safeCall(p, SAFE_ABI, cfg.Safe, fn, [], `${key}:Safe:${fn}`);
  const sentinel = "0x0000000000000000000000000000000000000001";
  out.safe.modules = await safeCall(p, SAFE_ABI, cfg.Safe, "getModulesPaginated", [sentinel, "0x" + "f".repeat(40)], `${key}:Safe:modules`);
  // Governance probes (basic view attempts from generic governance ABI)
  out.governance = {};
  for (const sig of ["function proposalCount() view returns (uint256)", "function votingDelay() view returns (uint256)", "function quorumNumerator() view returns (uint256)"]) {
    const nm = sig.match(/function (\w+)\(/)![1];
    out.governance[nm] = await safeCall(p, [sig], cfg.Governance, nm, [], `${key}:Governance:${nm}`);
  }
  // deployer account state
  out.deployer = {
    txCount: await withRetry(() => p.send("eth_getTransactionCount", [DEPLOYER, "latest"]), `${key}:deployer:nonce`),
    balance: await withRetry(() => p.send("eth_getBalance", [DEPLOYER, "latest"]), `${key}:deployer:balance`),
  };
  out.safeNativeBal = await withRetry(() => p.send("eth_getBalance", [cfg.Safe, "latest"]), `${key}:safe:balance`);
  out.finishedAt = now();
  (out as any)._unknownSelectors = [...unknownSelectors];
  return out;
}

async function robinhoodProbe() {
  const out: any = { chain: "robinhood", startedAt: now() };
  try {
    const cid = await withRetry(async () => {
      const r = await fetch(RH, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }), signal: AbortSignal.timeout(8000) });
      const j = await r.json(); if (j.error) throw new Error(j.error.message); return j.result;
    }, "rh:eth_chainId", 2);
    out.chainId = cid;
    const p = new JsonRpcProvider(RH, new Network("robinhood", 46630));
    out.block = await withRetry(() => p.getBlockNumber(), "rh:block", 2);
    for (const [n, a] of Object.entries({ MTQToken: "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5", MTQSigma: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0", Safe: "0xa3CE28A10854B375272D528EeC4295D6bcd75691", Governance: "0x80FF03DAD374E1f2f5C110F355B7a448Aa732B56" })) {
      const code = await withRetry(() => p.send("eth_getCode", [a, "latest"]), `rh:${n}:code`, 2);
      out[n] = { addr: a, codeSize: (code.length - 2) / 2, keccak: keccak256(code) };
      if (n === "Safe" && (code.length - 2) / 2 > 0) {
        out.Safe.threshold = await safeCall(p, SAFE_ABI, a, "getThreshold", [], "rh:Safe:getThreshold");
        out.Safe.owners = await safeCall(p, SAFE_ABI, a, "getOwners", [], "rh:Safe:getOwners");
        out.Safe.nonce = await safeCall(p, SAFE_ABI, a, "nonce", [], "rh:Safe:nonce");
      }
      if (n === "MTQToken" && (code.length - 2) / 2 > 0) {
        out.MTQToken.totalSupply = await safeCall(p, ERC20_ABI, a, "totalSupply", [], "rh:MTQToken:totalSupply");
        out.MTQToken.name = await safeCall(p, ERC20_ABI, a, "name", [], "rh:MTQToken:name");
      }
    }
  } catch (e: any) { out.unreachable = String(e.message).slice(0, 140); out.verdict = "RPC-UNREACHABLE/DEAD — all Robinhood claims UNVERIFIED"; }
  out.finishedAt = now();
  return out;
}

const MODE = process.argv[2] ?? "all";

async function solanaProbe() {
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const sol = async (method: string, params: any[], label: string) => {
    await sleep(700); // pace the public devnet RPC
    return withRetry(async () => {
      const r = await fetch(SOL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json() as any;
      if (j.error) throw new Error(j.error.message);
      log({ call: label, resultKeys: j.result ? Object.keys(j.result) : null, slot: j.result?.slot, brief: JSON.stringify(j.result).slice(0, 180) });
      return j.result;
    }, label, 6);
  };
  const out: any = { chain: "solana", startedAt: now() };
  const MINT = "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4";
  const DEAD_OLD = "2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY";
  const AUTH = "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3";
  const EXPOSED = "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d";

  const info = await sol("getAccountInfo", [MINT, { encoding: "base64", commitment: "confirmed" }], "sol:mint:getAccountInfo");
  const b58 = (b: Buffer) => { const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"; let n = 0n; for (const x of b) n = n * 256n + BigInt(x); let s = ""; while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; } for (const x of b) { if (x !== 0) break; s = "1" + s; } return s; };
  if (info?.value?.data?.[0]) {
    const raw = Buffer.from(info.value.data[0], "base64");
    // SPL Token Program Mint layout (82 bytes):
    // 0:u32 mintAuthorityOption | 4:pubkey mintAuthority | 36:u64 supply | 44:u8 decimals | 45:bool isInitialized
    // 46:u32 freezeAuthorityOption | 50:pubkey freezeAuthority
    const mintAuthOpt = raw.readUInt32LE(0);
    const freezeOpt = raw.readUInt32LE(46);
    out.mint = {
      exists: true, ownerProgram: info.value.owner, lamports: info.value.lamports, dataLen: raw.length,
      mintAuthorityOption: mintAuthOpt, mintAuthority: mintAuthOpt ? b58(raw.subarray(4, 36)) : null,
      freezeAuthorityOption: freezeOpt, freezeAuthority: freezeOpt ? b58(raw.subarray(50, 82)) : null,
      decimals: raw.readUInt8(44),
      isInitialized: raw.readUInt8(45) === 1,
      supplyRaw: raw.readBigUInt64LE(36).toString(),
      supplyRawHex: raw.subarray(36, 44).toString("hex"),
      u64Ceiling: raw.readBigUInt64LE(36) === 18446744073709551615n,
    };
  } else out.mint = { exists: false };
  const ts = await sol("getTokenSupply", [MINT, { commitment: "confirmed" }], "sol:getTokenSupply");
  out.tokenSupply = ts?.value ? { amount: ts.value.amount, decimals: ts.value.decimals, uiAmount: ts.value.uiAmount } : null;
  const la = await sol("getTokenLargestAccounts", [MINT, { commitment: "confirmed" }], "sol:getTokenLargestAccounts");
  out.largestAccounts = la?.value?.topAccounts?.map((a: any) => ({ address: a.address, amount: a.amount, decimals: a.decimals })) ?? null;
  // holdings of exposed wallet + authority wallet
  for (const [w, wl] of Object.entries({ exposed_4saT: EXPOSED, authority_DbFjz: AUTH })) {
    out[`holdings_${w}`] = {};
    out[`holdings_${w}`].byMint = await sol("getTokenAccountsByOwner", [wl, { mint: MINT }, { encoding: "jsonParsed", commitment: "confirmed" }], `sol:${w}:byMint`);
    const byProg = await sol("getTokenAccountsByOwner", [wl, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9S666QoqWvNm" }, { encoding: "jsonParsed", commitment: "confirmed" }], `sol:${w}:byProgram`);
    out[`holdings_${w}`].allTokenAccounts = (byProg?.value ?? []).map((a: any) => ({ mint: a.account.data.parsed?.info?.mint, amount: a.account.data.parsed?.info?.tokenAmount?.uiAmountString, owner: a.account.data.parsed?.info?.owner }));
    out[`holdings_${w}`].solBalance = await sol("getBalance", [wl, { commitment: "confirmed" }], `sol:${w}:balance`);
  }
  // transaction history of mint + exposed wallet
  const mintSigs = await sol("getSignaturesForAddress", [MINT, { limit: 40 }], "sol:mint:signatures");
  out.mintTxHistory = (mintSigs ?? []).map((s: any) => ({ sig: s.signature.slice(0, 16), ts: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null, err: s.err }));
  if (out.mintTxHistory.length) {
    const oldest = [...(mintSigs ?? [])].sort((a: any, b: any) => (a.blockTime ?? 0) - (b.blockTime ?? 0))[0];
    try {
      const tx = await sol("getTransaction", [oldest.signature, { maxSupportedTransactionVersion: 0, encoding: "json" }], "sol:mint:oldestTx");
      out.mintCreationTx = tx ? {
        slot: tx.slot, blockTime: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
        feePayer: tx.transaction?.message?.accountKeys?.[0] ?? null,
        accounts: tx.transaction?.message?.accountKeys?.slice(0, 8),
        logSummary: tx.meta?.logMessages?.slice(0, 6),
        err: tx.meta?.err,
      } : null;
    } catch (e: any) { out.mintCreationTx = { err: String(e.message).slice(0, 120) }; }
  }
  const expSigs = await sol("getSignaturesForAddress", [EXPOSED, { limit: 40 }], "sol:4saT:signatures");
  out.exposedWalletHistory = (expSigs ?? []).map((s: any) => ({ sig: s.signature.slice(0, 16), ts: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null, err: s.err }));
  // superseded mint
  const oldInfo = await sol("getAccountInfo", [DEAD_OLD, { encoding: "base64", commitment: "confirmed" }], "sol:oldMint:getAccountInfo");
  if (oldInfo?.value?.data?.[0]) {
    const raw = Buffer.from(oldInfo.value.data[0], "base64");
    const opt = (o: number, pkOff: number) => { const v = raw.readUInt32LE(o); return v ? b58(raw.subarray(pkOff, pkOff + 32)) : null; };
    out.supersededMint = { exists: true, ownerProgram: oldInfo.value.owner, dataLen: raw.length, decimals: raw.length >= 45 ? raw.readUInt8(44) : null, supply: raw.length >= 44 ? raw.readBigUInt64LE(36).toString() : null, mintAuthority: opt(0, 4), freezeAuthority: opt(46, 50) };
  } else out.supersededMint = { exists: oldInfo?.value !== null };
  out.finishedAt = now();
  return out;
}

// ---------- run ----------
(async () => {
  if (MODE !== "solana") writeFileSync(RAWLOG, `# task10 on-chain probe (read-only) — start ${now()}
`);
  else appendFileSync(RAWLOG, `# task10 solana stage — start ${now()}
`);
  const result: any = { meta: { generatedAt: now(), mode: "READ-ONLY", banner: "TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS" } };

  if (MODE === "all" || MODE === "evm") {
    result.monad = await probeChain("monad");
    result.arc = await probeChain("arc");
    const unk = [...new Set([...(result.monad._unknownSelectors ?? []), ...(result.arc._unknownSelectors ?? [])])];
    const oc = await openchainLookup(unk);
    result.selectorResolution = { unknownCount: unk.length, resolvedByOpenchain: oc, note: "openchain resolves public registries; unresolved selectors remain UNVERIFIED (could be custom functions)" };
    writeFileSync(EV("audit-work/task10/evidence/onchain-evm.json"), JSON.stringify({ monad: result.monad, arc: result.arc, selectorResolution: result.selectorResolution }, null, 2));
    console.log("EVM stage written: audit-work/task10/evidence/onchain-evm.json");
  }
  if (MODE === "all" || MODE === "rh") {
    result.robinhood = await robinhoodProbe();
    writeFileSync(EV("audit-work/task10/evidence/onchain-robinhood.json"), JSON.stringify(result.robinhood, null, 2));
    console.log("Robinhood stage written: " + JSON.stringify(result.robinhood).slice(0, 300));
  }
  if (MODE === "all" || MODE === "solana") {
    result.solana = await solanaProbe();
    writeFileSync(EV("audit-work/task10/evidence/onchain-solana.json"), JSON.stringify(result.solana, null, 2));
    console.log("Solana stage written: audit-work/task10/evidence/onchain-solana.json");
  }
  if (MODE === "all") {
    const p = EV("audit-work/task10/evidence/onchain-probe.json");
    writeFileSync(p, JSON.stringify(result, null, 2));
    console.log(`written ${p}`);
  }

  // compact digest
  const src: any = MODE === "solana" ? { monad: JSON.parse(readFileSync(EV("audit-work/task10/evidence/onchain-evm.json"), "utf8")).monad, arc: JSON.parse(readFileSync(EV("audit-work/task10/evidence/onchain-evm.json"), "utf8")).arc, solana: result.solana } : result;
  const dig: any = {};
  for (const ch of ["monad", "arc"]) {
    const r: any = (src as any)[ch];
    if (!r) continue;
    dig[ch] = {
      chainId: r.chainId, ok: r.assertChainId, block: r.block, ts: r.blockTs,
      mtq: { name: r.mtq.name?.value, symbol: r.mtq.symbol?.value, decimals: r.mtq.decimals?.value, totalSupply: r.mtq.totalSupply?.value, cap: r.mtq.cap?.ok ? r.mtq.cap.value : "revert", paused: r.mtq.paused?.value },
      balances: Object.fromEntries(Object.entries(r.mtq).filter(([k]) => k.startsWith("balanceOf_")).map(([k, v]: any) => [k, v.ok ? v.value : `ERR:${v.cls}`])),
      roles: r.roles, moduleAdmin: r.moduleAdmin,
      safe: Object.fromEntries(Object.entries(r.safe).map(([k, v]: any) => [k, v?.ok ? v.value : `ERR:${v?.cls ?? "?"}`])),
      governanceCode: { size: r.contracts.Governance.codeSize, keccak: r.contracts.Governance.runtimeKeccak },
      safeCode: { size: r.contracts.Safe.codeSize, keccak: r.contracts.Safe.runtimeKeccak },
      deployer: r.deployer, generations: r.generations,
    };
  }
  console.log(JSON.stringify(dig, null, 1).slice(0, 9000));
  const s: any = (src as any).solana;
  if (s) console.log("\n=== SOLANA ===\nmint:", JSON.stringify(s.mint), "\nsupply:", JSON.stringify(s.tokenSupply), "\nlargest:", JSON.stringify(s.largestAccounts?.slice(0, 5)),
    "\n4saT holdings(all):", JSON.stringify(s.holdings_exposed_4saT?.allTokenAccounts?.slice(0, 8)), "\nDbFjz holdings(all):", JSON.stringify(s.holdings_authority_DbFjz?.allTokenAccounts?.slice(0, 8)),
    "\nmintTx:", JSON.stringify(s.mintTxHistory?.slice(0, 10)), "\ncreation:", JSON.stringify(s.mintCreationTx),
    "\n4saT history:", JSON.stringify(s.exposedWalletHistory?.slice(0, 10)), "\nsuperseded:", JSON.stringify(s.supersededMint));
  const rh: any = (src as any).robinhood;
  if (rh) console.log("\n=== ROBINHOOD ===\n" + JSON.stringify(rh, null, 1).slice(0, 1200));
})();
