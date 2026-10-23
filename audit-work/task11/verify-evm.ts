/**
 * MTQΣ Task 11 — FRESH READ-ONLY EVM VERIFICATION (Monad · Arc · Robinhood)
 * TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
 *
 * Task 11 §3: fresh verification scripts that report ONLY redacted identifiers and
 * public on-chain data, recording UTC timestamps, chain IDs, block heights, RPC
 * endpoint identity, REQUEST/RESPONSE HASHES, failures and retry counts.
 *
 * Methods used (all read-only):
 *   eth_chainId · eth_blockNumber · eth_getBlockByNumber · eth_getCode ·
 *   eth_getStorageAt · eth_call · eth_getBalance · eth_getTransactionCount
 * ZERO transactions are sent. A revert is recorded as an ERROR (never as a
 * negative result). Transport/rate-limit failures are retried and counted.
 */
import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { keccak256, toUtf8Bytes, Interface } from "ethers";

const T11 = "/home/z/my-project/audit-work/task11";
const RAWLOG = `${T11}/evidence/raw-task11-evm.jsonl`;
mkdirSync(`${T11}/evidence`, { recursive: true });

const now = () => new Date().toISOString();
const stats = { requests: 0, retries: 0, failures: 0, reverts: 0, calls: 0 };

// ---------------------------------------------------------------- raw RPC with request/response hashes
async function rpc(url: string, method: string, params: any[], label: string, tries = 4): Promise<any> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const reqHash = keccak256(toUtf8Bytes(body)).slice(0, 26);
  for (let i = 1; ; i++) {
    try {
      stats.requests++;
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      const text = await res.text();
      const resHash = keccak256(toUtf8Bytes(text)).slice(0, 26);
      let j: any;
      try { j = JSON.parse(text); } catch { throw new Error(`non-JSON response (${text.length}ch)`); }
      if (j.error) {
        appendFileSync(RAWLOG, JSON.stringify({ t: now(), call: label, reqHash, resHash, jsonrpcError: j.error, attempt: i }) + "\n");
        if (String(j.error.message ?? "").match(/429|rate|limit/i) && i < tries) { stats.retries++; await sleep(1200 * i); continue; }
        throw new Error(j.error.message ?? JSON.stringify(j.error));
      }
      appendFileSync(RAWLOG, JSON.stringify({ t: now(), call: label, reqHash, resHash, ok: true, result: typeof j.result === "string" && j.result.length > 200 ? `${j.result.slice(0, 66)}…(${j.result.length}ch)` : j.result }) + "\n");
      return j.result;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (i >= tries) {
        stats.failures++;
        appendFileSync(RAWLOG, JSON.stringify({ t: now(), call: label, reqHash, error: msg.slice(0, 200), attempt: i, verdict: "FAILED-UNVERIFIED" }) + "\n");
        throw e;
      }
      stats.retries++;
      appendFileSync(RAWLOG, JSON.stringify({ t: now(), call: label, reqHash, error: msg.slice(0, 200), attempt: i, verdict: "RETRY" }) + "\n");
      await sleep(1000 * i);
    }
  }
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const classify = (m: string) => /revert/i.test(m) ? "EVM-REVERT" : /429|rate|limit|timeout|ECONN|network|fetch/i.test(m) ? "TRANSPORT" : "OTHER";

/** eth_call via Interface; returns {ok,value} | {ok:false,err,cls} — revert = ERROR, not a negative */
async function call(url: string, abi: string[], to: string, fn: string, args: any[], label: string): Promise<any> {
  try {
    const iface = new Interface(abi);
    const data = iface.encodeFunctionData(fn, args);
    const res = await rpc(url, "eth_call", [{ to, data }, "latest"], label);
    stats.calls++;
    const dec = iface.decodeFunctionResult(fn, res);
    const v = Array.isArray(dec) ? (dec.length === 1 ? dec[0] : dec.map(x => (typeof x === "bigint" ? x.toString() : String(x)))) : dec;
    return { ok: true, value: typeof v === "bigint" ? v.toString() : v };
  } catch (e: any) {
    const m = String(e?.message ?? e);
    if (classify(m) === "EVM-REVERT") stats.reverts++;
    return { ok: false, err: m.slice(0, 140), cls: classify(m) };
  }
}

// ---------------------------------------------------------------- registries (public addresses only)
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const DEAD = "0x000000000000000000000000000000000000dEaD";
const ROLE = {
  admin: "0x" + "0".repeat(64),
  minter: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
  pauser: "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a",
};
const MODULES = ["Algorithm", "Reserve", "Mint", "Redeem", "Oracle", "Takaful"] as const;
const MODULE_ABIS = ["Algorithm", "Reserve", "Mint", "Redeem", "Oracle", "Takaful"];

const REG: Record<string, any> = {
  monad: {
    rpc: "https://testnet-rpc.monad.xyz", chainIdHex: "0x279f",
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
    rpc: "https://rpc.testnet.arc.io", chainIdHex: "0x4cef52",
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
  robinhood: {
    rpc: "https://rpc.testnet.chain.robinhood.com/rpc", chainIdHex: "0xb626",
    MTQToken: "0xAF5B85658d074e071BbF392395a2ddA9B644C5A5",
    MTQSigma: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0",
    Safe: "0xa3CE28A10854B375272D528EeC4295D6bcd75691",
    Governance: "0x80FF03DAD374E1f2f5C110F355B7a448Aa732B56",
  },
};

const ERC20 = ["function name() view returns (string)", "function symbol() view returns (string)",
  "function decimals() view returns (uint8)", "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)", "function cap() view returns (uint256)",
  "function allowance(address,address) view returns (uint256)"];
const AC = ["function hasRole(bytes32,address) view returns (bool)",
  "function getRoleAdmin(bytes32) view returns (bytes32)", "function paused() view returns (bool)",
  "function owner() view returns (address)"];
const SAFE = ["function getThreshold() view returns (uint256)", "function getOwners() view returns (address[])",
  "function nonce() view returns (uint256)", "function VERSION() view returns (string)",
  "function getModulesPaginated(address,uint256) view returns (address[],address)",
  "function getGuard() view returns (address)", "function getFallbackHandler() view returns (address)"];
const GOV = ["function votingDelay() view returns (uint256)", "function votingPeriod() view returns (uint256)",
  "function proposalThreshold() view returns (uint256)", "function quorumNumerator() view returns (uint256)",
  "function name() view returns (string)", "function version() view returns (string)",
  "function proposalCount() view returns (uint256)"];
const EIP1967 = {
  impl: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  admin: "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
  beacon: "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50",
};

const selContains = (code: string, sel: string) => code.toLowerCase().includes(sel.toLowerCase());
const ACCOUNTS = (r: any) => [DEPLOYER, r.Safe, r.Governance, ...MODULE_ABIS.map(m => r[m]), DEAD];

const out: any = { task: "task11-fresh-evm-verification", startedAt: now(), networks: {}, stats: null as any };

async function main() {
  for (const chainKey of ["monad", "arc", "robinhood"]) {
    const r = REG[chainKey];
    const url = r.rpc;
    const net: any = { rpcEndpoint: url, probes: {} };
    out.networks[chainKey] = net;

    // 1. chain identity + block anchors
    const cid = await rpc(url, "eth_chainId", [], `${chainKey}:chainId`);
    net.chainId = cid; net.chainIdAssertOk = cid === r.chainIdHex;
    const bn = await rpc(url, "eth_blockNumber", [], `${chainKey}:blockNumber`);
    net.blockHeightStart = parseInt(bn, 16);
    const blk: any = await rpc(url, "eth_getBlockByNumber", [bn, false], `${chainKey}:blockByNumber`);
    net.blockTimestamp = new Date(parseInt(blk.timestamp, 16) * 1000).toISOString();

    if (chainKey === "robinhood") {
      // third-chain provenance re-verification only
      for (const c of ["MTQToken", "MTQSigma", "Safe", "Governance"]) {
        const code = await rpc(url, "eth_getCode", [r[c], "latest"], `rh:getCode:${c}`);
        net.probes[c] = {
          addr: r[c], codeSize: (code.length - 2) / 2,
          runtimeKeccak: keccak256(toUtf8Bytes(String(code))),
          selectorScan: { mint_40c10f19: selContains(code, "40c10f19"), burn_42966c68: selContains(code, "42966c68") },
        };
      }
      net.probes.MTQToken.totalSupply = await call(url, ERC20, r.MTQToken, "totalSupply", [], "rh:MTQToken.totalSupply");
      net.probes.MTQToken.name = await call(url, ERC20, r.MTQToken, "name", [], "rh:MTQToken.name");
      net.probes.MTQToken.balanceOf_deployer = await call(url, ERC20, r.MTQToken, "balanceOf", [DEPLOYER], "rh:MTQToken.balanceOf.deployer");
      net.probes.Safe = { ...net.probes.Safe, ...(await safeDossier(url, r.Safe, chainKey)) };
      net.deployer = {
        nativeBalance: await rpc(url, "eth_getBalance", [DEPLOYER, "latest"], "rh:deployer.balance"),
        txCount: parseInt(await rpc(url, "eth_getTransactionCount", [DEPLOYER, "latest"], "rh:deployer.nonce"), 16),
      };
      const bnEnd = await rpc(url, "eth_blockNumber", [], "rh:blockNumber-end");
      net.blockHeightEnd = parseInt(bnEnd, 16);
      continue;
    }

    // 2. bytecode identity + proxy slots for the current estate (9 contracts)
    net.contracts = {};
    for (const c of ["MTQ", "Governance", "Safe", ...MODULES]) {
      const code = String(await rpc(url, "eth_getCode", [r[c], "latest"], `${chainKey}:getCode:${c}`));
      const slots: any = {};
      for (const [slotName, slot] of Object.entries(EIP1967)) {
        slots[slotName] = await rpc(url, "eth_getStorageAt", [r[c], slot, "latest"], `${chainKey}:slot:${c}:${slotName}`);
      }
      const safeSlot0 = c === "Safe" ? await rpc(url, "eth_getStorageAt", [r[c], "0x0", "latest"], `${chainKey}:slot:${c}:safeSingleton`) : null;
      net.contracts[c] = {
        addr: r[c], codeSize: (code.length - 2) / 2, runtimeKeccak: keccak256(toUtf8Bytes(code)),
        eip1967: slots, ...(safeSlot0 ? { safeSingletonSlot0: safeSlot0 } : {}),
        selectorScan: {
          mint_40c10f19: selContains(code, "40c10f19"),
          burn_42966c68: selContains(code, "42966c68"),
          transferFrom_23b872dd: selContains(code, "23b872dd"),
          approve_095ea7b3: selContains(code, "095ea7b3"),
        },
      };
    }

    // 3. token metadata + supply + paused + cap
    const t = net.contracts.MTQ;
    t.name = await call(url, ERC20, r.MTQ, "name", [], `${chainKey}:MTQ.name`);
    t.symbol = await call(url, ERC20, r.MTQ, "symbol", [], `${chainKey}:MTQ.symbol`);
    t.decimals = await call(url, ERC20, r.MTQ, "decimals", [], `${chainKey}:MTQ.decimals`);
    t.totalSupply = await call(url, ERC20, r.MTQ, "totalSupply", [], `${chainKey}:MTQ.totalSupply`);
    t.paused = await call(url, AC, r.MTQ, "paused", [], `${chainKey}:MTQ.paused`);
    t.cap = await call(url, ERC20, r.MTQ, "cap", [], `${chainKey}:MTQ.cap`);

    // 4. role matrix on the token (deployer · Safe · Governance · Mint · Reserve · Redeem)
    t.roles = {};
    for (const [rn, rh] of Object.entries(ROLE)) {
      for (const acc of ["DEPLOYER", "Safe", "Governance", "Mint", "Reserve", "Redeem"]) {
        const addr = acc === "DEPLOYER" ? DEPLOYER : r[acc];
        t.roles[`${rn}:${acc}`] = await call(url, AC, r.MTQ, "hasRole", [rh, addr], `${chainKey}:MTQ.hasRole.${rn}.${acc}`);
      }
      t.roles[`${rn}:adminOfRole`] = await call(url, AC, r.MTQ, "getRoleAdmin", [rh], `${chainKey}:MTQ.getRoleAdmin.${rn}`);
    }

    // 5. module AC surfaces: DEFAULT_ADMIN + MINTER for deployer / Safe / Governance
    for (const m of MODULES) {
      const mm = net.contracts[m];
      mm.roles = {};
      for (const [rn, rh] of Object.entries(ROLE)) {
        mm.roles[`${rn}:DEPLOYER`] = await call(url, AC, r[m], "hasRole", [rh, DEPLOYER], `${chainKey}:${m}.hasRole.${rn}.deployer`);
        mm.roles[`${rn}:Safe`] = await call(url, AC, r[m], "hasRole", [rh, r.Safe], `${chainKey}:${m}.hasRole.${rn}.safe`);
      }
      const adminRoleConst = await call(url, AC, r[m], "getRoleAdmin", [ROLE.admin], `${chainKey}:${m}.getRoleAdmin.ADMIN`);
      mm.roles["DEFAULT_ADMIN:adminOfRole"] = adminRoleConst;
    }

    // 6. Safe dossier
    net.safe = await safeDossier(url, r.Safe, chainKey);
    net.safe.nativeBalance = await rpc(url, "eth_getBalance", [r.Safe, "latest"], `${chainKey}:safe.balance`);
    net.safe.tokenBalance = await call(url, ERC20, r.MTQ, "balanceOf", [r.Safe], `${chainKey}:safe.MTQ.balance`);
    net.safe.generationBalances = {};
    for (const [g, ga] of Object.entries(r.generations) as [string, string][]) {
      net.safe.generationBalances[g] = await call(url, ERC20, ga, "balanceOf", [r.Safe], `${chainKey}:safe.${g}.balance`);
    }

    // 7. ALLOWANCES (first-time probe) — both directions between deployer and every estate contract
    net.allowances = {};
    for (const c of ["Safe", "Governance", ...MODULES, "DEAD"]) {
      const addr = c === "DEAD" ? DEAD : r[c];
      net.allowances[`deployer->${c}`] = await call(url, ERC20, r.MTQ, "allowance", [DEPLOYER, addr], `${chainKey}:allowance.deployer.${c}`);
      net.allowances[`${c}->deployer`] = await call(url, ERC20, r.MTQ, "allowance", [addr, DEPLOYER], `${chainKey}:allowance.${c}.deployer`);
    }

    // 8. holders census on the current token
    net.holders = {};
    for (const acc of ACCOUNTS(r)) {
      net.holders[acc] = await call(url, ERC20, r.MTQ, "balanceOf", [acc], `${chainKey}:balanceOf:${acc.slice(0, 10)}`);
    }
    net.selfBalance = await call(url, ERC20, r.MTQ, "balanceOf", [r.MTQ], `${chainKey}:balanceOf:self`);

    // 9. generations fresh
    net.generations = {};
    for (const [g, ga] of Object.entries(r.generations) as [string, string][]) {
      const gg: any = { addr: ga };
      gg.name = await call(url, ERC20, ga, "name", [], `${chainKey}:${g}.name`);
      gg.symbol = await call(url, ERC20, ga, "symbol", [], `${chainKey}:${g}.symbol`);
      gg.totalSupply = await call(url, ERC20, ga, "totalSupply", [], `${chainKey}:${g}.totalSupply`);
      gg.balanceOf_deployer = await call(url, ERC20, ga, "balanceOf", [DEPLOYER], `${chainKey}:${g}.balanceOf.deployer`);
      gg.balanceOf_self = await call(url, ERC20, ga, "balanceOf", [ga], `${chainKey}:${g}.balanceOf.self`);
      gg.balanceOf_dead = await call(url, ERC20, ga, "balanceOf", [DEAD], `${chainKey}:${g}.balanceOf.dead`);
      gg.owner = await call(url, AC, ga, "owner", [], `${chainKey}:${g}.owner`);
      gg.paused = await call(url, AC, ga, "paused", [], `${chainKey}:${g}.paused`);
      gg.hasRole = {
        admin_deployer: await call(url, AC, ga, "hasRole", [ROLE.admin, DEPLOYER], `${chainKey}:${g}.hasRole.admin.deployer`),
        minter_deployer: await call(url, AC, ga, "hasRole", [ROLE.minter, DEPLOYER], `${chainKey}:${g}.hasRole.minter.deployer`),
      };
      const code = String(await rpc(url, "eth_getCode", [ga, "latest"], `${chainKey}:getCode:${g}`));
      gg.codeSize = (code.length - 2) / 2;
      gg.runtimeKeccak = keccak256(toUtf8Bytes(code));
      net.generations[g] = gg;
    }

    // 10. Governor parameters (fresh)
    net.governor = {};
    for (const fn of ["votingDelay", "votingPeriod", "proposalThreshold", "quorumNumerator", "name", "version", "proposalCount"]) {
      net.governor[fn] = await call(url, GOV, r.Governance, fn, [], `${chainKey}:gov.${fn}`);
    }

    // 11. deployer native + nonce
    net.deployer = {
      nativeBalance: await rpc(url, "eth_getBalance", [DEPLOYER, "latest"], `${chainKey}:deployer.balance`),
      txCount: parseInt(await rpc(url, "eth_getTransactionCount", [DEPLOYER, "latest"], `${chainKey}:deployer.nonce`), 16),
    };

    const bnEnd = await rpc(url, "eth_blockNumber", [], `${chainKey}:blockNumber-end`);
    net.blockHeightEnd = parseInt(bnEnd, 16);
    console.log(`[${chainKey}] done @ block ${net.blockHeightEnd}`);
  }

  out.finishedAt = now();
  out.stats = { ...stats, note: "reverts are counted as errors and never treated as negative results" };
  writeFileSync(`${T11}/evidence/onchain-evm-task11.json`, JSON.stringify(out, null, 1));
  console.log("STATS", JSON.stringify(out.stats));
  console.log(`Evidence: ${T11}/evidence/onchain-evm-task11.json`);
}

async function safeDossier(url: string, safe: string, chainKey: string) {
  const d: any = { addr: safe };
  d.threshold = await call(url, SAFE, safe, "getThreshold", [], `${chainKey}:safe.threshold`);
  d.owners = await call(url, SAFE, safe, "getOwners", [], `${chainKey}:safe.owners`);
  d.nonce = await call(url, SAFE, safe, "nonce", [], `${chainKey}:safe.nonce`);
  d.VERSION = await call(url, SAFE, safe, "VERSION", [], `${chainKey}:safe.VERSION`);
  d.modules = await call(url, SAFE, safe, "getModulesPaginated", ["0x0000000000000000000000000000000000000001", 10], `${chainKey}:safe.modules`);
  d.guard = await call(url, SAFE, safe, "getGuard", [], `${chainKey}:safe.guard`);
  d.fallbackHandler = await call(url, SAFE, safe, "getFallbackHandler", [], `${chainKey}:safe.fallbackHandler`);
  return d;
}

main().catch(e => { console.error("FATAL", e); process.exit(1); });
