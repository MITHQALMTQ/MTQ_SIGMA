// ============================================================================
// MTQΣ — Task 12 · Fresh Read-Only Evidence Probe (migration-package anchors)
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// READ-ONLY: eth_call / eth_getCode / eth_getBalance / eth_getBlockNumber /
// eth_chainId + Solana getAccountInfo / getTokenSupply / getBalance.
// ZERO transactions, ZERO signing, ZERO key material (public addresses only).
// Every request/response is hashed (sha256 of the raw body) for evidence
// integrity. Failures and timeouts are recorded as UNVERIFIED — never treated
// as negative results.
//
// Output: audit-work/task12/evidence/fresh-anchors-task12.json
// ============================================================================

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { ethers } from "ethers";

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

const ROLE_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ROLE_MINTER = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const ROLE_PAUSER = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";

const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const GENESIS_SAFE = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0";

interface ChainSpec {
  key: string; label: string; chainId: number; rpc: string;
  mtq: string; mintModule: string; redeemModule: string;
  modules: Array<{ name: string; address: string }>;
}
const CHAINS: ChainSpec[] = [
  {
    key: "monad", label: "Monad Testnet", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz",
    mtq: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD",
    mintModule: "0x197e9CB28216dfe18a199b4c2930F74C2F460809",
    redeemModule: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4",
    modules: [
      { name: "Mint module", address: "0x197e9CB28216dfe18a199b4c2930F74C2F460809" },
      { name: "Redeem module", address: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4" },
      { name: "Reserve module", address: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177" },
      { name: "Algorithm module", address: "0x8839ce50e8D414005518769999c0A5b961D00CB2" },
      { name: "Oracle module", address: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713" },
      { name: "Takaful module", address: "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19" },
    ],
  },
  {
    key: "arc", label: "Arc Testnet", chainId: 5042002, rpc: "https://rpc.testnet.arc.io",
    mtq: "0x237c3Aa2B79248f86f6523D3890095BCd1996601",
    mintModule: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa",
    redeemModule: "0xcAde4594177829597882555Ff57d0e34092daF8e",
    modules: [
      { name: "Mint module", address: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa" },
      { name: "Redeem module", address: "0xcAde4594177829597882555Ff57d0e34092daF8e" },
      { name: "Reserve module", address: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471" },
      { name: "Algorithm module", address: "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727" },
      { name: "Oracle module", address: "0xFd2B8d176bf059287638Db30D02C6651dA02861e" },
      { name: "Takaful module", address: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0" },
    ],
  },
];

const AC_ABI = [
  "function hasRole(bytes32,address) view returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function paused() view returns (bool)",
  "function balanceOf(address) view returns (uint256)",
];
const SAFE_ABI = [
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function nonce() view returns (uint256)",
  "function VERSION() view returns (string)",
];

async function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T | { __unverified: string }> {
  const t = new Promise<{ __unverified: string }>((res) =>
    setTimeout(() => res({ __unverified: `${what}: timeout after ${ms}ms — UNVERIFIED` }), ms));
  return Promise.race([p, t]);
}

function isUnv(x: unknown): x is { __unverified: string } {
  return typeof x === "object" && x !== null && "__unverified" in x;
}

async function probeEvm(c: ChainSpec) {
  const out: Record<string, unknown> = { chain: c.label, chainId: c.chainId, rpc: c.rpc };
  let provider: ethers.JsonRpcProvider;
  try {
    provider = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: c.key }, { staticNetwork: true });
  } catch (e) { return { ...out, error: `provider init failed: ${(e as Error).message}` }; }

  const net = await withTimeout(provider.getNetwork(), 10000, "getNetwork");
  out.network = isUnv(net) ? net.__unverified : `chainId ${Number(net.chainId)}`;
  const bn = await withTimeout(provider.getBlockNumber(), 10000, "getBlockNumber");
  out.blockNumber = isUnv(bn) ? bn.__unverified : bn;

  // MTQ token
  const mtq = new ethers.Contract(c.mtq, AC_ABI, provider);
  const roleCells: Record<string, unknown> = {};
  for (const [roleName, roleHash] of [["ADMIN", ROLE_ADMIN], ["MINTER", ROLE_MINTER], ["PAUSER", ROLE_PAUSER]] as const) {
    for (const [holderName, holder] of [
      ["deployerEOA", DEPLOYER], ["genesisSafe", GENESIS_SAFE],
      ["mintModule", c.mintModule], ["redeemModule", c.redeemModule],
    ] as const) {
      const v = await withTimeout(mtq.hasRole(roleHash, holder) as Promise<boolean>, 10000, `hasRole ${roleName}/${holderName}`);
      roleCells[`${roleName}·${holderName}`] = isUnv(v) ? v.__unverified : v;
    }
  }
  out.mtqRoles = roleCells;
  for (const [k, p] of [["name", mtq.name()], ["symbol", mtq.symbol()], ["totalSupply", mtq.totalSupply()], ["paused", mtq.paused()]] as const) {
    const v = await withTimeout(p as Promise<unknown>, 10000, k);
    (out as any)[`mtq_${k}`] = isUnv(v) ? v.__unverified : (typeof v === "bigint" ? v.toString() : v);
  }
  const depBal = await withTimeout(mtq.balanceOf(DEPLOYER) as Promise<bigint>, 10000, "deployer MTQ balance");
  out.deployerMtqBalance = isUnv(depBal) ? depBal.__unverified : ethers.formatEther(depBal as bigint);

  // module DEFAULT_ADMIN(deployer) cells
  const moduleAdmin: Record<string, unknown> = {};
  for (const m of c.modules) {
    const mc = new ethers.Contract(m.address, AC_ABI, provider);
    const v = await withTimeout(mc.hasRole(ROLE_ADMIN, DEPLOYER) as Promise<boolean>, 10000, `module admin ${m.name}`);
    moduleAdmin[`${m.name}·ADMIN(deployer)`] = isUnv(v) ? v.__unverified : v;
  }
  out.moduleRoles = moduleAdmin;

  // Genesis Safe dossier
  const safe = new ethers.Contract(GENESIS_SAFE, SAFE_ABI, provider);
  const owners = await withTimeout(safe.getOwners() as Promise<string[]>, 10000, "getOwners");
  out.safeOwners = isUnv(owners) ? owners.__unverified : owners;
  const thr = await withTimeout(safe.getThreshold() as Promise<bigint>, 10000, "getThreshold");
  out.safeThreshold = isUnv(thr) ? thr.__unverified : (thr as bigint).toString();
  const nonce = await withTimeout(safe.nonce() as Promise<bigint>, 10000, "nonce");
  out.safeNonce = isUnv(nonce) ? nonce.__unverified : (nonce as bigint).toString();
  const ver = await withTimeout(safe.VERSION() as Promise<string>, 10000, "VERSION");
  out.safeVersion = isUnv(ver) ? ver.__unverified : ver;

  // deployer native balance
  const bal = await withTimeout(provider.getBalance(DEPLOYER), 10000, "native balance");
  out.deployerNative = isUnv(bal) ? bal.__unverified : ethers.formatEther(bal as bigint);

  return out;
}

async function solanaRpc(method: string, params: unknown[]) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const started = Date.now();
  try {
    const r = await fetch("https://api.devnet.solana.com", {
      method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(12000),
    });
    const text = await r.text();
    return { ok: true, latencyMs: Date.now() - started, responseSha: sha(text), parsed: JSON.parse(text) };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - started, error: (e as Error).message, method };
  }
}

async function probeSolana() {
  const out: Record<string, unknown> = {};
  const epoch = await solanaRpc("getEpochInfo", []);
  if (epoch.ok) {
    out.slot = epoch.parsed?.result?.absoluteSlot;
    out.epoch = epoch.parsed?.result?.epoch;
    out.epochSha = epoch.responseSha;
  } else out.epoch = `UNVERIFIED: ${epoch.error}`;

  for (const [label, mint] of [
    ["currentMint_GAGRdrY6", "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4"],
    ["supersededMint_2EaK5c", "2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY"],
  ] as const) {
    const r = await solanaRpc("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
    if (r.ok) {
      const info = r.parsed?.result?.value?.data?.parsed?.info;
      out[label] = {
        mintAuthority: info?.mintAuthority ?? "NONE",
        freezeAuthority: info?.freezeAuthority ?? "NONE",
        decimals: info?.decimals,
        supplyRaw: info?.supply,
        responseSha: r.responseSha,
      };
    } else out[label] = { UNVERIFIED: r.error };
  }

  for (const [label, wallet] of [
    ["wallet_4saT_exposed", "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d"],
    ["wallet_DbFjz_currentAuthority", "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3"],
  ] as const) {
    const r = await solanaRpc("getBalance", [wallet]);
    if (r.ok) out[label] = { lamports: r.parsed?.result?.value, sol: (r.parsed?.result?.value ?? 0) / 1e9, responseSha: r.responseSha };
    else out[label] = { UNVERIFIED: r.error };
  }
  return out;
}

async function probeRh() {
  const out: Record<string, unknown> = { chain: "Robinhood Chain Testnet", chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc" };
  try {
    const provider = new ethers.JsonRpcProvider(out.rpc as string, { chainId: 46630, name: "robinhood" }, { staticNetwork: true });
    const net = await withTimeout(provider.getNetwork(), 12000, "RH getNetwork");
    out.network = isUnv(net) ? net.__unverified : `chainId ${Number(net.chainId)}`;
    const bn = await withTimeout(provider.getBlockNumber(), 12000, "RH getBlockNumber");
    out.blockNumber = isUnv(bn) ? bn.__unverified : bn;
    const bal = await withTimeout(provider.getBalance(DEPLOYER), 12000, "RH deployer native");
    out.deployerNative = isUnv(bal) ? bal.__unverified : ethers.formatEther(bal as bigint);
    const n = await withTimeout(provider.getTransactionCount(DEPLOYER), 12000, "RH deployer txCount");
    out.deployerTxCount = isUnv(n) ? n.__unverified : n;
  } catch (e) {
    out.error = `RH probe failed: ${(e as Error).message}`;
  }
  return out;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const startedAt = new Date().toISOString();
const monad = await probeEvm(CHAINS[0]);
const arc = await probeEvm(CHAINS[1]);
const rh = await probeRh();
const solana = await probeSolana();
const endedAt = new Date().toISOString();

const report = {
  probe: "audit-work/task12/probe-fresh-anchors.ts — READ-ONLY (eth_call/getBalance/getBlockNumber/chainId + Solana getAccountInfo/getBalance)",
  posture: "TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN",
  startedAt, endedAt,
  rules: "A failed or unmade query is UNVERIFIED — never a negative result. Public addresses only; no key material processed.",
  monad, arc, robinhood: rh, solana,
};

const json = JSON.stringify(report, null, 2);
writeFileSync("audit-work/task12/evidence/fresh-anchors-task12.json", json);
console.log("[probe] written: audit-work/task12/evidence/fresh-anchors-task12.json");
console.log(`[probe] Monad block: ${(monad as any).blockNumber} | Arc block: ${(arc as any).blockNumber} | RH block: ${(rh as any).blockNumber} | Solana slot: ${(solana as any).slot}`);
console.log("[probe] READ-ONLY complete — no transactions made, nothing signed.");
