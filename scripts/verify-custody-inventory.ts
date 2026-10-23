// MTQΣ CUSTODY INVENTORY PROBE — READ-ONLY ONLY (Evidence Reconciliation
// Directive §3). No private key is read, nothing is signed, no transaction is
// broadcast, no state is changed. Pure eth_chainId / eth_blockNumber /
// eth_getCode / eth_getBalance / eth_call(view) / eth_getLogs / eth_getStorageAt.
//
// Purpose — close four evidence gaps left by audit-work/v5:
//   (1) full-code identity: keccak256+sha256 of entire runtime bytecode for every
//       probed address (v5 recorded only byte-length + 69-byte prefix);
//   (2) deployer EOA native balance (never persisted anywhere);
//   (3) per-candidate supply-holder reconciliation (who holds the supply that is
//       NOT at the Safe and NOT at the deployer — incl. genesisReserve()/reserve
//       getters + balanceOf those addresses);
//   (4) reproducible documentation of the log-access limitation (full-range
//       eth_getLogs refusal) + a bounded-window control probe.
//
// Output: audit-work/v6/custody-inventory-probe.json (+ stdout summary).
import { JsonRpcProvider, Network, keccak256, id as ethersId, zeroPadValue, ContractFunctionExecutionError, type BytesLike } from "ethers";
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";

type Target = { label: string; address: string; note: string };

const SAFE = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0";
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const SINGLETON = "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762";

const CHAINS: {
  key: string; name: string; rpc: string; chainId: number;
  candidates: { tag: "A" | "B" | "C"; label: string; address: string }[];
  extras: Target[];
}[] = [
  {
    key: "monad", name: "Monad Testnet", rpc: "https://testnet-rpc.monad.xyz", chainId: 10143,
    candidates: [
      { tag: "A", label: "v5.0 §5.1 record — live name 'MITHQAL'", address: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD" },
      { tag: "B", label: "CANONICAL_MTQ_ADDRESSES + Ecosystem-JSON — live name 'MTQΣ'", address: "0x0Ac20360234b4C988a19586CBe55733e18A5982f" },
      { tag: "C", label: "deployment-JSON MTQSigma — live name 'MTQΣ'", address: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a" },
    ],
    extras: [
      { label: "recorded 'Safe' claim (Ecosystem-JSON) — proven NOT a Safe", address: "0x74353601354c0b71df5B16Fe1B28c7F0831dd316", note: "0/7 Safe reads revert" },
      { label: "Oracle (recorded)", address: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713", note: "same hex as Arc Ecosystem-JSON 'Safe'" },
      { label: "Governance (recorded)", address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", note: "same hex recorded on Arc too" },
      { label: "Safe singleton (slot-0)", address: SINGLETON, note: "Gnosis Safe v1.4.1 mastercopy" },
    ],
  },
  {
    key: "arc", name: "Arc Testnet", rpc: "https://rpc.testnet.arc.io", chainId: 5042002,
    candidates: [
      { tag: "A", label: "v5.0 §5.1 record — live name 'MITHQAL'", address: "0x237c3Aa2B79248f86f6523D3890095BCd1996601" },
      { tag: "B", label: "CANONICAL_MTQ_ADDRESSES + Ecosystem-JSON — live name 'MTQΣ'", address: "0x24203404B9b971C907e8Ced96106Fa74380d9897" },
      { tag: "C", label: "deployment-JSON MTQSigma — live name 'MTQ Sigma'", address: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1" },
    ],
    extras: [
      { label: "recorded 'Safe' claim (Ecosystem-JSON) — proven NOT a Safe", address: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713", note: "0/7 Safe reads revert; same hex as Monad 'Oracle'" },
      { label: "Oracle (recorded)", address: "0xFd2B8d176bf059287638Db30D02C6651dA02861e", note: "same hex as Robinhood MockUSDC" },
      { label: "Governance (recorded)", address: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", note: "same hex as Monad 'Governance'" },
      { label: "Safe singleton (slot-0)", address: SINGLETON, note: "Gnosis Safe v1.4.1 mastercopy" },
    ],
  },
];

const ERC20 = {
  totalSupply: ethersId("totalSupply()").slice(0, 10),
  balanceOf: ethersId("balanceOf(address)").slice(0, 10),
  name: ethersId("name()").slice(0, 10),
  symbol: ethersId("symbol()").slice(0, 10),
  decimals: ethersId("decimals()").slice(0, 10),
};
// Candidate-C family (MTQSigma.sol) stores the genesis reserve; try common getters.
const RESERVE_GETTERS = ["genesisReserve()", "reserveVault()", "owner()", "treasury()"].map((s) => ({
  sig: s, selector: ethersId(s).slice(0, 10),
}));
const TRANSFER_TOPIC = ethersId("Transfer(address,address,uint256)");

const sha256hex = (data: BytesLike) => createHash("sha256").update(Buffer.from(String(data).slice(2), "hex")).digest("hex");

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 800): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) { lastErr = e; if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs * (i + 1))); }
  }
  throw lastErr;
}

async function rawCall(provider: JsonRpcProvider, to: string, selector: string, attemptErr?: boolean): Promise<string> {
  const data = await provider.send("eth_call", [{ to, data: selector }, "latest"]);
  return typeof data === "string" ? data : JSON.stringify(data);
}

function decodeUint(hex: string): bigint | null {
  const h = String(hex).trim();
  if (!h.startsWith("0x") || h.length < 3) return null;
  try { return BigInt(h); } catch { return null; }
}
function decodeAddress(hex: string): string | null {
  const h = String(hex).trim();
  if (!h.startsWith("0x") || h.length !== 66) return null;
  return "0x" + h.slice(26).toLowerCase();
}
function decodeString(hex: string): string | null {
  try {
    const h = String(hex).trim();
    if (!h.startsWith("0x")) return null;
    const offset = Number(BigInt("0x" + h.slice(2, 66)));
    if (offset !== 32) return null;
    const len = Number(BigInt("0x" + h.slice(66, 130)));
    if (len <= 0 || len > 64) return null;
    return Buffer.from(h.slice(130, 130 + len * 2), "hex").toString("utf8");
  } catch { return null; }
}

const out: Record<string, unknown> = {
  purpose: "MTQΣ custody inventory probe — Evidence Reconciliation Directive §3 (read-only)",
  generatedAt: new Date().toISOString(),
  mode: "READ-ONLY ONLY — eth_chainId/eth_blockNumber/eth_getCode/eth_getBalance/eth_call(view)/eth_getLogs/eth_getStorageAt; no keys, no signing, no broadcast, no state change",
  safeAddress: SAFE,
  deployerEoa: DEPLOYER,
  chains: [] as unknown[],
};

for (const chain of CHAINS) {
  const provider = new JsonRpcProvider(chain.rpc, new Network(chain.name, chain.chainId), { staticNetwork: true, batchMaxCount: 1 });
  const chainReport: Record<string, unknown> = { key: chain.key, name: chain.name, rpc: chain.rpc, expectedChainId: chain.chainId };

  // chainId assert
  const chainIdHex = await withRetry(() => provider.send("eth_chainId", []));
  const chainId = parseInt(chainIdHex, 16);
  chainReport.chainIdMatch = chainId === chain.chainId;
  const blockNumberHex = await withRetry(() => provider.send("eth_blockNumber", []));
  const blockNumber = parseInt(blockNumberHex, 16);
  chainReport.blockNumber = blockNumber;

  // code identity (full-bytecode hash) for SAFE + singleton + candidates + extras
  const codeTargets: Target[] = [
    { label: "Genesis Reserve Safe (proxy)", address: SAFE, note: "sole genuine Safe in any repo record" },
    ...chain.candidates.map(c => ({ label: `candidate ${c.tag} — ${c.label}`, address: c.address, note: "live token" })),
    ...chain.extras,
  ];
  const codeIdentity: Record<string, unknown>[] = [];
  for (const t of codeTargets) {
    const code = await withRetry(() => provider.send("eth_getCode", [t.address, "latest"]));
    const bytes = Math.max(0, (String(code).length - 2) / 2);
    codeIdentity.push({
      label: t.label, address: t.address, note: t.note,
      codeBytes: bytes,
      codeKeccak256: bytes > 0 ? keccak256(code as BytesLike) : null,
      codeSha256: bytes > 0 ? sha256hex(code as BytesLike) : null,
      prefix69: bytes > 0 ? String(code).slice(0, 138 + 2) : null,
    });
  }
  chainReport.codeIdentity = codeIdentity;

  // native balances (never previously persisted for the deployer)
  chainReport.nativeBalances = {
    safe: await withRetry(() => provider.send("eth_getBalance", [SAFE, "latest"])),
    deployer: await withRetry(() => provider.send("eth_getBalance", [DEPLOYER, "latest"])),
  };

  // per-candidate holder reconciliation
  const holders: Record<string, unknown>[] = [];
  for (const c of chain.candidates) {
    const rec: Record<string, unknown> = { tag: c.tag, label: c.label, address: c.address };
    try { rec.name = decodeString(await withRetry(() => rawCall(provider, c.address, ERC20.name))); } catch (e) { rec.name = `ERR:${(e as Error).message.slice(0, 60)}`; }
    try { rec.symbol = decodeString(await withRetry(() => rawCall(provider, c.address, ERC20.symbol))); } catch (e) { rec.symbol = `ERR:${(e as Error).message.slice(0, 60)}`; }
    try { rec.decimals = decodeUint(await withRetry(() => rawCall(provider, c.address, ERC20.decimals)))?.toString() ?? null; } catch { rec.decimals = null; }
    try { rec.totalSupply = decodeUint(await withRetry(() => rawCall(provider, c.address, ERC20.totalSupply)))?.toString() ?? null; } catch (e) { rec.totalSupply = `ERR:${(e as Error).message.slice(0, 60)}`; }
    const bal = (who: string) => withRetry(() => provider.send("eth_call", [{ to: c.address, data: ERC20.balanceOf + zeroPadValue(who, 32).slice(2) }, "latest"])).then(decodeUint).catch(e => null);
    rec.balanceSafe = (await bal(SAFE))?.toString() ?? null;
    rec.balanceDeployer = (await bal(DEPLOYER))?.toString() ?? null;
    // reserve/owner getters — reconcile the non-deployer, non-Safe remainder
    const foundReserves: Record<string, unknown>[] = [];
    for (const g of RESERVE_GETTERS) {
      try {
        const ret = await withRetry(() => rawCall(provider, c.address, g.selector));
        const addr = decodeAddress(ret);
        if (addr) {
          const balAddr = (await bal(addr))?.toString() ?? null;
          foundReserves.push({ getter: g.sig, address: addr, balance: balAddr });
        }
      } catch { /* getter not exposed — skip silently */ }
    }
    rec.reserveGetters = foundReserves;
    // supply − deployer − safe remainder (in raw wei units, BigInt math when numeric)
    try {
      const ts = BigInt(String(rec.totalSupply)), ds = BigInt(String(rec.balanceDeployer)), sf = BigInt(String(rec.balanceSafe));
      const known = ds + sf;
      let otherKnown = 0n;
      for (const r of foundReserves) { if (typeof r.balance === "string" && /^\d+$/.test(r.balance)) otherKnown += BigInt(r.balance); }
      rec.remainderNotAtSafeOrDeployer = { rawWei: (ts - known).toString(), atDiscoveredReserves: otherKnown.toString(), unexplained: (ts - known - otherKnown).toString() };
    } catch { rec.remainderNotAtSafeOrDeployer = null; }
    holders.push(rec);
  }
  chainReport.candidates = holders;

  // log-access limitation probes (read-only)
  const logs: Record<string, unknown> = {};
  // (a) reproduce the full-range refusal for the Safe's own logs
  try {
    const r = await withRetry(() => provider.send("eth_getLogs", [{ address: SAFE, fromBlock: "0x0", toBlock: "latest" }]), 1);
    logs.fullRangeSafeOwnLogs = { accepted: true, count: Array.isArray(r) ? r.length : null };
  } catch (e) { logs.fullRangeSafeOwnLogs = { accepted: false, error: String((e as Error)?.message ?? e).slice(0, 200) }; }
  // (b) bounded window control: Transfer(to=SAFE) on candidate B over last 100k blocks
  const boundedFrom = "0x" + Math.max(0, blockNumber - 100_000).toString(16);
  try {
    const r = await provider.send("eth_getLogs", [{ address: chain.candidates[1].address, topics: [TRANSFER_TOPIC, null, zeroPadValue(SAFE, 32)], fromBlock: boundedFrom, toBlock: "latest" }]);
    logs.boundedWindowTransferToSafe_candidateB = { accepted: true, window: `+${blockNumber - parseInt(boundedFrom, 16)} blocks`, count: Array.isArray(r) ? r.length : null, sample: Array.isArray(r) && r.length ? r.slice(0, 3) : [] };
  } catch (e) { logs.boundedWindowTransferToSafe_candidateB = { accepted: false, error: String((e as Error)?.message ?? e).slice(0, 200) }; }
  // (c) full-range for candidate B transfers (record refusal verbatim)
  try {
    const r = await withRetry(() => provider.send("eth_getLogs", [{ address: chain.candidates[1].address, topics: [TRANSFER_TOPIC], fromBlock: "0x0", toBlock: "latest" }]), 1);
    logs.fullRangeTransfer_candidateB = { accepted: true, count: Array.isArray(r) ? r.length : null };
  } catch (e) { logs.fullRangeTransfer_candidateB = { accepted: false, error: String((e as Error)?.message ?? e).slice(0, 200) }; }
  chainReport.logAccess = logs;

  (out.chains as unknown[]).push(chainReport);
  // summary line
  console.log(`\n=== ${chain.name} @ block ${blockNumber} (chainId ${chainId} ${chainId === chain.chainId ? "✓" : "MISMATCH"}) ===`);
  for (const h of holders) {
    const r = h as Record<string, unknown>;
    console.log(`  candidate ${r.tag} ${r.address}: supply=${r.totalSupply} safe=${r.balanceSafe} deployer=${r.balanceDeployer} reserves=${JSON.stringify(r.reserveGetters)}`);
  }
  console.log(`  native: safe=${(chainReport.nativeBalances as Record<string, string>).safe} deployer=${(chainReport.nativeBalances as Record<string, string>).deployer}`);
}

mkdirSync("audit-work/v6", { recursive: true });
writeFileSync("audit-work/v6/custody-inventory-probe.json", JSON.stringify(out, null, 2));
console.log("\nwrote audit-work/v6/custody-inventory-probe.json");
