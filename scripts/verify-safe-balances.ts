// ============================================================================
// MTQΣ — read-only custody balance + transaction-history probe (OD-35 suppt)
// ----------------------------------------------------------------------------
// Independent Post-Implementation Verification Mandate §2 supplement:
// SAFE-VERIFICATION.md §6.8 honestly recorded that the Safe's token balances
// and transaction history were NOT read. This probe closes that gap.
//
// READ-ONLY: eth_chainId, eth_blockNumber, eth_call, eth_getLogs only.
// No keys, no signing, no broadcast, no state change.
//
// Token candidates are taken VERBATIM from audit-work/v5/safe-verification.json
// codeProbes (repo records) — no address is invented here.
// Output: audit-work/v5/safe-balance-probe.json
// Run:   bun run scripts/verify-safe-balances.ts
// ============================================================================
import { ethers } from "ethers";
import { writeFileSync } from "fs";

const SAFE = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0";
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c"; // on-chain sole owner (SAFE-VERIFICATION §2)

const CHAINS = [
  {
    id: "monad",
    name: "Monad Testnet",
    rpc: "https://testnet-rpc.monad.xyz",
    chainId: 10143,
    tokens: [
      { label: "candidateA-v5.0-§5.1 (MITHQAL)", address: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD" },
      { label: "candidateB-canonical-map+ecosystem (MTQΣ)", address: "0x0Ac20360234b4C988a19586CBe55733e18A5982f" },
      { label: "candidateC-deployment-json (MTQΣ)", address: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a" },
    ],
  },
  {
    id: "arc",
    name: "Arc Testnet",
    rpc: "https://rpc.testnet.arc.io",
    chainId: 5042002,
    tokens: [
      { label: "candidateA-v5.0-§5.1 (MITHQAL)", address: "0x237c3Aa2B79248f86f6523D3890095BCd1996601" },
      { label: "candidateB-canonical-map+ecosystem (MTQΣ)", address: "0x24203404B9b971C907e8Ced96106Fa74380d9897" },
      { label: "candidateC-deployment-json (MTQ Sigma)", address: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1" },
    ],
  },
] as const;

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function symbol() view returns (string)",
];

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 3): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  let lastErr = "";
  for (let i = 1; i <= attempts; i++) {
    try {
      return { ok: true, value: await fn() };
    } catch (e: any) {
      lastErr = String(e?.shortMessage ?? e?.message ?? e);
      if (i < attempts) await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
  return { ok: false, error: `${label}: ${lastErr}` };
}

function fmt(x: bigint | null): string {
  if (x === null) return "n/a";
  return ethers.formatUnits(x, 18);
}

async function probeChain(chain: (typeof CHAINS)[number]) {
  const out: any = { name: chain.name, expectedChainId: chain.chainId };
  const provider = new ethers.JsonRpcProvider(chain.rpc, { chainId: chain.chainId, name: chain.name }, { staticNetwork: true, batchMaxCount: 1 });

  const chainId = await withRetry("eth_chainId", () => provider.send("eth_chainId", []));
  if (!chainId.ok || parseInt(chainId.value as string, 16) !== chain.chainId) {
    out.fatal = `chainId mismatch: ${chainId.ok ? chainId.value : chainId.error}`;
    return out;
  }
  out.chainIdVerified = true;

  const bn = await withRetry("eth_blockNumber", () => provider.send("eth_blockNumber", []));
  out.blockNumber = bn.ok ? parseInt(bn.value as string, 16) : `error: ${bn.error}`;

  // Native balance of the Safe (has anything of native value ever arrived?)
  const native = await withRetry("eth_getBalance(SAFE)", () => provider.getBalance(SAFE));
  out.safeNativeBalance = native.ok ? fmt(native.value as bigint) : `error: ${native.error}`;

  // Token balances: Safe + deployer for each candidate
  out.tokenProbes = [];
  for (const t of chain.tokens) {
    const c = new ethers.Contract(t.address, ERC20_ABI, provider);
    const [sym, tsup, bSafe, bDep] = await Promise.all([
      withRetry("symbol", () => c.symbol() as Promise<string>),
      withRetry("totalSupply", () => c.totalSupply() as Promise<bigint>),
      withRetry("balanceOf(SAFE)", () => c.balanceOf(SAFE) as Promise<bigint>),
      withRetry("balanceOf(deployer)", () => c.balanceOf(DEPLOYER) as Promise<bigint>),
    ]);
    out.tokenProbes.push({
      label: t.label,
      address: t.address,
      symbol: sym.ok ? sym.value : `error: ${sym.error}`,
      totalSupply: tsup.ok ? fmt(tsup.value as bigint) : `error: ${tsup.error}`,
      safeBalance: bSafe.ok ? fmt(bSafe.value as bigint) : `error: ${bSafe.error}`,
      deployerBalance: bDep.ok ? fmt(bDep.value as bigint) : `error: ${bDep.error}`,
      raw: {
        totalSupply: tsup.ok ? (tsup.value as bigint).toString() : null,
        safe: bSafe.ok ? (bSafe.value as bigint).toString() : null,
        deployer: bDep.ok ? (bDep.value as bigint).toString() : null,
      },
    });
  }

  // Transaction history: (a) the Safe's OWN event logs; (b) transfers TO the
  // Safe on each candidate token. Full-range getLogs may be refused by the RPC
  // — the verbatim error is recorded either way (evidence, not a crash).
  const ownLogs = await withRetry("eth_getLogs(SAFE, all topics, fromBlock=0)", () =>
    provider.send("eth_getLogs", [{ address: SAFE, fromBlock: "0x0", toBlock: "latest" }]));
  out.safeOwnLogs = ownLogs.ok
    ? { count: (ownLogs.value as any[]).length, sample: (ownLogs.value as any[]).slice(0, 5) }
    : { count: null, error: ownLogs.error };

  const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
  const paddedSafe = "0x000000000000000000000000" + SAFE.slice(2).toLowerCase();
  out.transfersToSafe = [];
  for (const t of chain.tokens) {
    const logs = await withRetry(`eth_getLogs(${t.label} Transfer→SAFE, fromBlock=0)`, () =>
      provider.send("eth_getLogs", [{ address: t.address, topics: [TRANSFER_TOPIC, null, paddedSafe], fromBlock: "0x0", toBlock: "latest" }]));
    out.transfersToSafe.push({
      label: t.label,
      address: t.address,
      count: logs.ok ? (logs.value as any[]).length : null,
      first: logs.ok ? (logs.value as any[])[0]?.blockNumber ?? null : null,
      last: logs.ok ? (logs.value as any[])?.slice(-1)[0]?.blockNumber ?? null : null,
      error: logs.ok ? null : logs.error,
    });
  }
  return out;
}

(async () => {
  const result: any = {
    generatedAt: new Date().toISOString(),
    script: "scripts/verify-safe-balances.ts",
    mode: "READ-ONLY (eth_call/eth_getLogs/eth_getBalance — no keys, no signing, no broadcast)",
    safe: SAFE,
    deployerEoaOnChainOwner: DEPLOYER,
    chains: {},
  };
  for (const chain of CHAINS) {
    result.chains[chain.id] = await probeChain(chain);
  }
  writeFileSync("audit-work/v5/safe-balance-probe.json", JSON.stringify(result, null, 2));

  // Human summary
  for (const [id, c] of Object.entries<any>(result.chains)) {
    console.log(`\n=== ${c.name} (chainId verified, block ${c.blockNumber}) ===`);
    console.log(`  Safe native balance: ${c.safeNativeBalance}`);
    for (const t of c.tokenProbes) {
      console.log(`  ${t.label} [${t.symbol}]`);
      console.log(`    totalSupply     = ${t.totalSupply}`);
      console.log(`    balanceOf(SAFE) = ${t.safeBalance}`);
      console.log(`    balanceOf(dplyr)= ${t.deployerBalance}`);
    }
    console.log(`  Safe own logs (all topics, genesis→latest): ${c.safeOwnLogs.count ?? c.safeOwnLogs.error}`);
    for (const x of c.transfersToSafe) {
      console.log(`  Transfers→SAFE on ${x.label}: ${x.count ?? x.error}${x.count ? ` (first=${x.first} last=${x.last})` : ""}`);
    }
  }
  console.log("\nEvidence written: audit-work/v5/safe-balance-probe.json");
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
