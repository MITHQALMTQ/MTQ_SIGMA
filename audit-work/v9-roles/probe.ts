// MTQΣ — Task 8-e: READ-ONLY contract role probe (no transactions, no state changes).
// Verifies AccessControl roles across ALL deployed contracts on Monad + Arc testnets
// for the owner's reference accounts. eth_call only (hasRole is a view function).
import { ethers } from "ethers";
import { writeFileSync, mkdirSync } from "fs";

const ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
const MINTER = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const PAUSER = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const SAFE = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0";
const GOVERNANCE = "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66";

const iface = new ethers.Interface([
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function paused() view returns (bool)",
]);
const hasRoleData = (role: string, account: string) =>
  iface.encodeFunctionData("hasRole", [role, account]);
const PAUSED_DATA = iface.encodeFunctionData("paused", []);

type Probe = { contract: string; address: string; role: string; account: string; label: string };

const CHAINS = [
  {
    id: "monad", name: "Monad Testnet", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz",
    contracts: {
      "MTQ.sol": "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD",
      "Governance.sol": "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
      "Safe (Multi-Sig)": "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
      "Algorithm.sol": "0x8839ce50e8D414005518769999c0A5b961D00CB2",
      "Reserve.sol": "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177",
      "Mint.sol": "0x197e9CB28216dfe18a199b4c2930F74C2F460809",
      "Redeem.sol": "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4",
      "Oracle.sol": "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713",
      "Takaful.sol": "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19",
    },
  },
  {
    id: "arc", name: "Arc Testnet", chainId: 5042002, rpc: "https://rpc.testnet.arc.io",
    contracts: {
      "MTQ.sol": "0x237c3Aa2B79248f86f6523D3890095BCd1996601",
      "Governance.sol": "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
      "Safe (Multi-Sig)": "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
      "Algorithm.sol": "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727",
      "Reserve.sol": "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471",
      "Mint.sol": "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa",
      "Redeem.sol": "0xcAde4594177829597882555Ff57d0e34092daF8e",
      "Oracle.sol": "0xFd2B8d176bf059287638Db30D02C6651dA02861e",
      "Takaful.sol": "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0",
    },
  },
];

const ROLES: Record<string, string> = { DEFAULT_ADMIN_ROLE: ADMIN, MINTER_ROLE: MINTER, PAUSER_ROLE: PAUSER };

async function rpcBatch(url: string, calls: { jsonrpc: string; id: number; method: string; params: unknown[] }[]) {
  const out: Record<number, { result?: string; error?: { message: string } }> = {};
  const CHUNK = 40;
  for (let i = 0; i < calls.length; i += CHUNK) {
    const slice = calls.slice(i, i + CHUNK);
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slice), signal: AbortSignal.timeout(30000),
    });
    const json = (await res.json()) as { id: number; result?: string; error?: { message: string } }[];
    for (const item of Array.isArray(json) ? json : [json]) out[item.id] = { result: item.result, error: item.error };
  }
  return out;
}

async function main() {
  const report: any = {
    probe: "MTQΣ Task 8-e — AccessControl role verification (READ-ONLY eth_call)",
    mode: "VERIFICATION-ONLY · §1 · no transactions, no state changes",
    roleHashes: ROLES,
    accounts: { deployer: DEPLOYER, safe: SAFE, governance: GOVERNANCE },
    chains: [] as any[],
  };
  for (const chain of CHAINS) {
    const probes: Probe[] = [];
    const calls: { jsonrpc: string; id: number; method: string; params: unknown[] }[] = [];
    let id = 1;
    const extraAccounts: Record<string, string> = { safe: SAFE, governance: GOVERNANCE };
    for (const [cname, addr] of Object.entries(chain.contracts)) {
      for (const [rlabel, rhash] of Object.entries(ROLES)) {
        // All contracts: deployer account (the owner's reference queries)
        probes.push({ contract: cname, address: addr, role: rlabel, account: DEPLOYER, label: "deployer" });
        calls.push({ jsonrpc: "2.0", id: id++, method: "eth_call", params: [{ to: addr, data: hasRoleData(rhash, DEPLOYER) }, "latest"] });
        // MTQ token only: also Safe + Governance as candidate role holders (governance-critical check)
        if (cname === "MTQ.sol") {
          for (const [alabel, acct] of Object.entries(extraAccounts)) {
            probes.push({ contract: cname, address: addr, role: rlabel, account: acct, label: alabel });
            calls.push({ jsonrpc: "2.0", id: id++, method: "eth_call", params: [{ to: addr, data: hasRoleData(rhash, acct) }, "latest"] });
          }
        }
      }
    }
    // paused() on MTQ token
    probes.push({ contract: "MTQ.sol", address: chain.contracts["MTQ.sol"], role: "paused()", account: "-", label: "-" });
    calls.push({ jsonrpc: "2.0", id: id++, method: "eth_call", params: [{ to: chain.contracts["MTQ.sol"], data: PAUSED_DATA }, "latest"] });
    const bn = await fetch(chain.rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 99999, method: "eth_blockNumber", params: [] }) }).then(r => r.json());
    const results = await rpcBatch(chain.rpc, calls);
    const rows = probes.map((p, i) => {
      const r = results[i + 1];
      let value: boolean | string | null = null;
      if (r?.error) value = "REVERT/UNSUPPORTED";
      else if (typeof r?.result === "string" && r.result.length >= 66) {
        const padded = r.result.slice(2).padStart(64, "0");
        value = padded.slice(-2) === "01";
      } else value = "NO_RESULT";
      return { ...p, hasRole: value };
    });
    report.chains.push({ id: chain.id, name: chain.name, chainId: chain.chainId, rpc: chain.rpc, blockNumber: parseInt(bn.result, 16), probedAt: new Date().toISOString(), results: rows });
  }
  mkdirSync("/home/z/my-project/audit-work/v9-roles", { recursive: true });
  writeFileSync("/home/z/my-project/audit-work/v9-roles/role-probe.json", JSON.stringify(report, null, 2));

  const lines: string[] = [
    "# MTQΣ Task 8-e — Live Role Verification (READ-ONLY eth_call)",
    "",
    `Probed: ${new Date().toISOString()} · Mode: VERIFICATION-ONLY (§1) — hasRole()/paused() view calls only, no transactions.`,
    "",
  ];
  for (const c of report.chains) {
    lines.push(`## ${c.name} (chainId ${c.chainId}) — block ${c.blockNumber}`);
    lines.push("");
    lines.push("| Contract | Role | Account | hasRole |");
    lines.push("|---|---|---|---|");
    for (const r of c.results) lines.push(`| ${r.contract} | ${r.role} | ${r.label} | ${r.hasRole} |`);
    lines.push("");
  }
  writeFileSync("/home/z/my-project/audit-work/v9-roles/ROLE-VERIFICATION.md", lines.join("\n"));
  console.log(lines.join("\n"));
}

main().catch(e => { console.error("PROBE FAILED:", e); process.exit(1); });
