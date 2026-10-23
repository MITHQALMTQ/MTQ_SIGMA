// Task 8-e.2 — re-probe anomalous entries individually with retries (READ-ONLY).
import { ethers } from "ethers";
import { writeFileSync } from "fs";

const iface = new ethers.Interface(["function hasRole(bytes32 role, address account) view returns (bool)", "function paused() view returns (bool)"]);
const hr = (role: string, account: string) => iface.encodeFunctionData("hasRole", [role, account]);
const PAUSED = iface.encodeFunctionData("paused", []);
const ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
const MINTER = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const PAUSER = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const SAFE = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0";
const GOV = "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66";

type An = { chain: string; rpc: string; to: string; contract: string; role: string; account?: string; label: string };
const ANOMALIES: An[] = [
  // Monad
  { chain: "monad", rpc: "https://testnet-rpc.monad.xyz", to: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", contract: "Governance.sol", role: ADMIN, account: DEPLOYER, label: "admin/deployer" },
  { chain: "monad", rpc: "https://testnet-rpc.monad.xyz", to: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0", contract: "Safe", role: ADMIN, account: DEPLOYER, label: "admin/deployer" },
  { chain: "monad", rpc: "https://testnet-rpc.monad.xyz", to: "0x8839ce50e8D414005518769999c0A5b961D00CB2", contract: "Algorithm.sol", role: ADMIN, account: DEPLOYER, label: "admin/deployer" },
  { chain: "monad", rpc: "https://testnet-rpc.monad.xyz", to: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177", contract: "Reserve.sol", role: MINTER, account: DEPLOYER, label: "minter/deployer" },
  { chain: "monad", rpc: "https://testnet-rpc.monad.xyz", to: "0x197e9CB28216dfe18a199b4c2930F74C2F460809", contract: "Mint.sol", role: ADMIN, account: DEPLOYER, label: "admin/deployer" },
  { chain: "monad", rpc: "https://testnet-rpc.monad.xyz", to: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4", contract: "Redeem.sol", role: ADMIN, account: DEPLOYER, label: "admin/deployer" },
  { chain: "monad", rpc: "https://testnet-rpc.monad.xyz", to: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713", contract: "Oracle.sol", role: ADMIN, account: DEPLOYER, label: "admin/deployer" },
  { chain: "monad", rpc: "https://testnet-rpc.monad.xyz", to: "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19", contract: "Takaful.sol", role: ADMIN, account: DEPLOYER, label: "admin/deployer" },
  { chain: "monad", rpc: "https://testnet-rpc.monad.xyz", to: "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19", contract: "Takaful.sol", role: MINTER, account: DEPLOYER, label: "minter/deployer" },
  { chain: "monad", rpc: "https://testnet-rpc.monad.xyz", to: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", contract: "MTQ.sol", role: "paused()", label: "paused" },
  // Arc
  { chain: "arc", rpc: "https://rpc.testnet.arc.io", to: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", contract: "MTQ.sol", role: PAUSER, account: SAFE, label: "pauser/safe" },
  { chain: "arc", rpc: "https://rpc.testnet.arc.io", to: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", contract: "MTQ.sol", role: PAUSER, account: GOV, label: "pauser/governance" },
  { chain: "arc", rpc: "https://rpc.testnet.arc.io", to: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66", contract: "Governance.sol", role: ADMIN, account: DEPLOYER, label: "admin/deployer" },
  { chain: "arc", rpc: "https://rpc.testnet.arc.io", to: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0", contract: "Safe", role: ADMIN, account: DEPLOYER, label: "admin/deployer" },
  { chain: "arc", rpc: "https://rpc.testnet.arc.io", to: "0xcAde4594177829597882555Ff57d0e34092daF8e", contract: "Redeem.sol", role: PAUSER, account: DEPLOYER, label: "pauser/deployer" },
  { chain: "arc", rpc: "https://rpc.testnet.arc.io", to: "0xFd2B8d176bf059287638Db30D02C6651dA02861e", contract: "Oracle.sol", role: MINTER, account: DEPLOYER, label: "minter/deployer" },
  { chain: "arc", rpc: "https://rpc.testnet.arc.io", to: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0", contract: "Takaful.sol", role: ADMIN, account: DEPLOYER, label: "admin/deployer" },
];

async function callOnce(rpc: string, to: string, data: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(rpc, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }), signal: AbortSignal.timeout(12000) });
    const j = await res.json() as any;
    const ms = Date.now() - t0;
    if (j.error) return { verdict: "RPC_ERROR", detail: String(j.error.message || j.error).slice(0, 160), ms };
    const r: string = j.result ?? "";
    if (r === "0x") return { verdict: "REVERT_EMPTY", detail: "empty return (no revert data)", ms };
    if (r.length >= 66) return { verdict: r.slice(-2) === "01" ? "TRUE" : "FALSE", detail: r, ms };
    return { verdict: "MALFORMED", detail: r, ms };
  } catch (e: any) { return { verdict: "TIMEOUT/NETWORK", detail: String(e?.message || e).slice(0, 160), ms: Date.now() - t0 }; }
}

async function main() {
  const out: any[] = [];
  for (const a of ANOMALIES) {
    const data = a.role === "paused()" ? PAUSED : hr(a.role, a.account!);
    const attempts: any[] = [];
    let final = "";
    for (let i = 0; i < 3; i++) {
      const r = await callOnce(a.rpc, a.to, data);
      attempts.push(r);
      if (r.verdict !== "TIMEOUT/NETWORK" && r.verdict !== "RPC_ERROR") { final = r.verdict; break; }
      await new Promise(r2 => setTimeout(r2, 800));
    }
    if (!final) final = attempts[attempts.length - 1].verdict;
    out.push({ ...a, stableVerdict: final, attempts });
    console.log(`${a.chain} ${a.contract} ${a.label} → ${final} (${attempts.map(x => x.verdict + ":" + x.ms + "ms").join(", ")})`);
  }
  writeFileSync("/home/z/my-project/audit-work/v9-roles/anomaly-reprobe.json", JSON.stringify(out, null, 2));
  console.log("\nSaved: audit-work/v9-roles/anomaly-reprobe.json");
}
main().catch(e => { console.error(e); process.exit(1); });
