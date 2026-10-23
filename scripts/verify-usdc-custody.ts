// MTQΣ USDC CUSTODY PROBE — READ-ONLY ONLY (Evidence Reconciliation Directive §3).
// The prior verification round closed with: "custody of the 1.1M USDC genesis
// deposit is likewise NOT evidenced anywhere in this repo". This probe reads
// the recorded MockUSDC contracts and every recorded candidate holder
// (deployer EOA, Genesis Safe, Ecosystem MintContract / ReserveVault, and the
// deployment-JSON MTQSigma contracts) on Monad + Arc.
// eth_call(view) only — no keys, no signing, no broadcast, no state change.
// Output: audit-work/v6/usdc-custody-probe.json
import { JsonRpcProvider, Network, id as ethersId, zeroPadValue } from "ethers";
import { writeFileSync } from "node:fs";

const SAFE = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0";
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const ERC20 = {
  totalSupply: ethersId("totalSupply()").slice(0, 10),
  balanceOf: ethersId("balanceOf(address)").slice(0, 10),
  name: ethersId("name()").slice(0, 10),
  symbol: ethersId("symbol()").slice(0, 10),
  decimals: ethersId("decimals()").slice(0, 10),
};

const CHAINS = [
  {
    key: "monad", name: "Monad Testnet", rpc: "https://testnet-rpc.monad.xyz", chainId: 10143,
    usdc: "0x28a2f9812BeC1252eee3992D56e5Bbd51393d6DE", // Monad-Testnet.json "MockUSDC"
    holders: [
      { label: "deployer EOA", address: DEPLOYER },
      { label: "Genesis Reserve Safe", address: SAFE },
      { label: "Ecosystem MintContract (JSON)", address: "0x4deA71BdB5Af2ce76e34c2AccA815855Af36A5fA" },
      { label: "Ecosystem ReserveVault (JSON)", address: "0xC472c5122B07935C66b1Ca956456e7574eae11bF" },
      { label: "contracts.ts Mint", address: "0x197e9CB28216dfe18a199b4c2930F74C2F460809" },
      { label: "contracts.ts Reserve", address: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177" },
      { label: "MTQSigma candidate C (deployment JSON)", address: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a" },
    ],
  },
  {
    key: "arc", name: "Arc Testnet", rpc: "https://rpc.testnet.arc.io", chainId: 5042002,
    usdc: "0x334D14E7E39e1f02a60fc1169CdF7b0BEDE30dEb", // Arc-Testnet.json "MockUSDC"
    holders: [
      { label: "deployer EOA", address: DEPLOYER },
      { label: "Genesis Reserve Safe", address: SAFE },
      { label: "Ecosystem MintContract (JSON)", address: "0x28a2f9812BeC1252eee3992D56e5Bbd51393d6DE" }, // note: same hex as Monad MockUSDC (C-042)
      { label: "Ecosystem ReserveVault (JSON)", address: "0x5EDb5e9d65691b654c906869dFFF2a6B9279c499" },
      { label: "contracts.ts Mint", address: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa" },
      { label: "contracts.ts Reserve", address: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471" },
      { label: "MTQSigma candidate C (deployment JSON)", address: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1" },
    ],
  },
];

function decodeUint(hex: string): string | null { try { return BigInt(String(hex).trim()).toString(); } catch { return null; } }
function decodeString(hex: string): string | null {
  try {
    const h = String(hex).trim();
    if (!h.startsWith("0x") || h.length < 130) return null;
    const len = Number(BigInt("0x" + h.slice(66, 130)));
    if (len <= 0 || len > 64) return null;
    return Buffer.from(h.slice(130, 130 + len * 2), "hex").toString("utf8");
  } catch { return null; }
}

const out: Record<string, unknown> = {
  purpose: "USDC-side custody probe — Evidence Reconciliation Directive §3 (read-only)",
  generatedAt: new Date().toISOString(),
  mode: "READ-ONLY eth_call(view) only",
  chains: [],
};

for (const chain of CHAINS) {
  const provider = new JsonRpcProvider(chain.rpc, new Network(chain.name, chain.chainId), { staticNetwork: true, batchMaxCount: 1 });
  const chainId = parseInt(await provider.send("eth_chainId", []), 16);
  const blockNumber = parseInt(await provider.send("eth_blockNumber", []), 16);
  const call = (to: string, data: string) => provider.send("eth_call", [{ to, data }, "latest"]);
  const rec: Record<string, unknown> = { key: chain.key, name: chain.name, usdc: chain.usdc, chainIdMatch: chainId === chain.chainId, blockNumber };
  try { rec.usdcName = decodeString(await call(chain.usdc, ERC20.name)); } catch (e) { rec.usdcName = `ERR:${(e as Error).message.slice(0, 60)}`; }
  try { rec.usdcSymbol = decodeString(await call(chain.usdc, ERC20.symbol)); } catch { rec.usdcSymbol = null; }
  try { rec.usdcDecimals = decodeUint(await call(chain.usdc, ERC20.decimals)); } catch { rec.usdcDecimals = null; }
  try { rec.usdcTotalSupply = decodeUint(await call(chain.usdc, ERC20.totalSupply)); } catch (e) { rec.usdcTotalSupply = `ERR:${(e as Error).message.slice(0, 60)}`; }
  const balances: Record<string, unknown>[] = [];
  for (const h of chain.holders) {
    let bal: string | null = null;
    try { bal = decodeUint(await call(chain.usdc, ERC20.balanceOf + zeroPadValue(h.address, 32).slice(2))); } catch (e) { bal = `ERR:${(e as Error).message.slice(0, 60)}`; }
    balances.push({ label: h.label, address: h.address, balanceRaw: bal });
  }
  rec.holders = balances;
  (out.chains as unknown[]).push(rec);
  console.log(`\n=== ${chain.name} @ block ${blockNumber} — USDC ${chain.usdc} name=${rec.usdcName} symbol=${rec.usdcSymbol} dec=${rec.usdcDecimals} supply=${rec.usdcTotalSupply}`);
  for (const b of balances) console.log(`   ${b.label.padEnd(42)} ${(b as { balanceRaw: string | null }).balanceRaw}`);
}

writeFileSync("audit-work/v6/usdc-custody-probe.json", JSON.stringify(out, null, 2));
console.log("\nwrote audit-work/v6/usdc-custody-probe.json");
