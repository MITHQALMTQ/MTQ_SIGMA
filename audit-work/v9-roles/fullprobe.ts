// Task 8-e.3 — AUTHORITATIVE full role matrix, every call individual (no batching),
// 2 attempts on transport errors only. READ-ONLY eth_call. Fixes batch false-negatives.
import { ethers } from "ethers";
import { writeFileSync } from "fs";

const iface = new ethers.Interface(["function hasRole(bytes32 role, address account) view returns (bool)", "function paused() view returns (bool)"]);
const hr = (role: string, account: string) => iface.encodeFunctionData("hasRole", [role, account]);
const PAUSED = iface.encodeFunctionData("paused", []);
const ROLES: Record<string, string> = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000",
  MINTER_ROLE: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6",
  PAUSER_ROLE: "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a",
};
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const SAFE = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0";
const GOV = "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66";

const CHAINS = [
  { id: "monad", name: "Monad Testnet", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", contracts: {
    "MTQ.sol": "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", "Governance.sol": "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
    "Safe (Multi-Sig)": "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0", "Algorithm.sol": "0x8839ce50e8D414005518769999c0A5b961D00CB2",
    "Reserve.sol": "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177", "Mint.sol": "0x197e9CB28216dfe18a199b4c2930F74C2F460809",
    "Redeem.sol": "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4", "Oracle.sol": "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713",
    "Takaful.sol": "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19" } },
  { id: "arc", name: "Arc Testnet", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", contracts: {
    "MTQ.sol": "0x237c3Aa2B79248f86f6523D3890095BCd1996601", "Governance.sol": "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
    "Safe (Multi-Sig)": "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0", "Algorithm.sol": "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727",
    "Reserve.sol": "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471", "Mint.sol": "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa",
    "Redeem.sol": "0xcAde4594177829597882555Ff57d0e34092daF8e", "Oracle.sol": "0xFd2B8d176bf059287638Db30D02C6651dA02861e",
    "Takaful.sol": "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0" } },
];

async function callOnce(rpc: string, to: string, data: string) {
  try {
    const res = await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }), signal: AbortSignal.timeout(12000) });
    const j = await res.json() as any;
    if (j.error) return { ok: true, verdict: "REVERT", detail: String(j.error.message || j.error).slice(0, 200) };
    const r: string = j.result ?? "";
    if (r.length >= 66) return { ok: true, verdict: r.slice(-2) === "01" ? "TRUE" : "FALSE", detail: r };
    return { ok: true, verdict: "MALFORMED", detail: r };
  } catch { return { ok: false, verdict: "TIMEOUT", detail: "" }; }
}

async function call(rpc: string, to: string, data: string) {
  for (let i = 0; i < 2; i++) { const r = await callOnce(rpc, to, data); if (r.ok) return r; await new Promise(s => setTimeout(s, 600)); }
  return { ok: true, verdict: "UNREACHABLE", detail: "2 transport failures" };
}

async function main() {
  const report: any = { probe: "MTQΣ Task 8-e.3 — authoritative individual role matrix", mode: "VERIFICATION-ONLY (§1) — eth_call reads only", roleHashes: ROLES, accounts: { deployer: DEPLOYER, safe: SAFE, governance: GOV }, chains: [] };
  const md: string[] = ["# MTQΣ Task 8-e — Authoritative Live Role Verification (individual eth_call, READ-ONLY)", "", `Probed: ${new Date().toISOString()} · §1 VERIFICATION-ONLY — hasRole()/paused() view calls only.`, ""];
  for (const chain of CHAINS) {
    const bn = await fetch(chain.rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }) }).then(r => r.json());
    const rows: any[] = [];
    for (const [cname, addr] of Object.entries(chain.contracts)) {
      for (const [rlabel, rhash] of Object.entries(ROLES)) {
        const d = await call(chain.rpc, addr, hr(rhash, DEPLOYER));
        rows.push({ contract: cname, address: addr, role: rlabel, account: DEPLOYER, label: "deployer", verdict: d.verdict, detail: d.detail });
        if (cname === "MTQ.sol") {
          for (const [al, acct] of [["safe", SAFE], ["governance", GOV]] as [string, string][]) {
            const s = await call(chain.rpc, addr, hr(rhash, acct));
            rows.push({ contract: cname, address: addr, role: rlabel, account: acct, label: al, verdict: s.verdict, detail: s.detail });
          }
        }
      }
    }
    const p = await call(chain.rpc, chain.contracts["MTQ.sol"], PAUSED);
    rows.push({ contract: "MTQ.sol", address: chain.contracts["MTQ.sol"], role: "paused()", account: "-", label: "-", verdict: p.verdict, detail: p.detail });
    report.chains.push({ id: chain.id, name: chain.name, chainId: chain.chainId, rpc: chain.rpc, blockNumber: parseInt(bn.result, 16), probedAt: new Date().toISOString(), results: rows });
    md.push(`## ${chain.name} (chainId ${chain.chainId}) — block ${parseInt(bn.result, 16)}`, "", "| Contract | Role | Account | hasRole |", "|---|---|---|---|");
    for (const r of rows) md.push(`| ${r.contract} | ${r.role} | ${r.label} | ${r.verdict === "TRUE" ? "true" : r.verdict === "FALSE" ? "false" : r.verdict} |`);
    md.push("");
  }
  writeFileSync("/home/z/my-project/audit-work/v9-roles/role-matrix-authoritative.json", JSON.stringify(report, null, 2));
  writeFileSync("/home/z/my-project/audit-work/v9-roles/ROLE-VERIFICATION.md", md.join("\n"));
  console.log(md.join("\n"));
}
main().catch(e => { console.error(e); process.exit(1); });
