/**
 * MTQΣ Task 10 — SUPPLEMENTAL EVM PROBE (READ-ONLY)
 * - Locate the 1,000,000-MTQ holder on gen-A/gen-C tokens (self-custody hypothesis)
 * - Privilege surfaces of every MTQ generation (owner()/hasRole/minter checks)
 * - Resolve key unknown selectors via 4byte.directory (best-effort, public registry)
 */
import { writeFileSync, appendFileSync } from "node:fs";
import { Interface, JsonRpcProvider, Network, keccak256, toUtf8Bytes } from "ethers";

const now = () => new Date().toISOString();
const RAWLOG = "/home/z/my-project/audit-work/task10/evidence/raw-onchain.jsonl";
const log = (o: any) => appendFileSync(RAWLOG, JSON.stringify({ t: now(), ...o }) + "\n");
const R = { admin: "0x" + "0".repeat(64), minter: "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6", pauser: "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a" };
const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";

const CH = {
  monad: {
    rpc: "https://testnet-rpc.monad.xyz", cid: 10143,
    tokens: {
      genA: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a",
      genB: "0x0Ac20360234b4C988a19586CBe55733e18A5982f",
    },
    candidateHolders: { // from Monad-Testnet-Ecosystem.json (gen-A era ecosystem)
      ecoGovernance: "0xc9C7867f54d11B31B0548ac04FfB9a39d5e83aE6",
      ecoSafe: "0x74353601354c0b71df5B16Fe1B28c7F0831dd316",
      ecoAlgorithm: "0x26eD20C6233fAEeBc1635aD08686f6E79a334a21",
      ecoReserveVault: "0xC472c5122B07935C66b1Ca956456e7574eae11bF",
      ecoMintContract: "0x4deA71BdB5Af2ce76e34c2AccA815855Af36A5fA",
      ecoRedeemContract: "0x1E52e1B8bD21183849e3e57B1d81100480E62148",
      ecoOracle: "0x14Ee68E52F7d1c8C223225BD9a9A42dB6Ded8841",
      ecoTakaful: "0xC8aEdE4b4A29C365f19D1B6CE3BdfBa0F636B203",
      ecoMockUSDC: "0x9de7C1e69B386A8Df8B6E8Ef3ce8BA73C22F43D5",
    },
  },
  arc: {
    rpc: "https://rpc.testnet.arc.io", cid: 5042002,
    tokens: {
      genA: "0x826b82F79FD6c5347cDC568B1d0A7918128B63c1",
      genB: "0x24203404B9b971C907e8Ced96106Fa74380d9897",
      genC: "0x5C728F729110013A1fa59fFc85938bbD973A2563",
    },
    candidateHolders: { // from Arc-Testnet-Ecosystem.json
      ecoGovernance: "0xc7936C2E5e81534584C242f5088302D452510DA7",
      ecoSafe: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713",
      ecoAlgorithm: "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19",
      ecoReserveVault: "0x5EDb5e9d65691b654c906869dFFF2a6B9279c499",
      ecoMintContract: "0x28a2f9812BeC1252eee3992D56e5Bbd51393d6DE",
      ecoRedeemContract: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a",
      ecoOracle: "0x6b92c14458Ed7ed26E154F84947c7dFDc8C49d72",
      ecoTakaful: "0x2CE0c1DD602a5314d406D0E030780f3D6c56C183",
      ecoMockUSDC: "0xc881D58df7Dddb29BC2Da05363D04974896285B6",
    },
  },
};

const ERC20 = ["function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)", "function decimals() view returns (uint8)", "function name() view returns (string)", "function symbol() view returns (string)"];
const OWN = ["function owner() view returns (address)", "function paused() view returns (bool)"];
const AC = ["function hasRole(bytes32,address) view returns (bool)", "function grantRole(bytes32,address)", "function mint(address,uint256)"];

async function main() {
  const out: any = { probe: "task10 supplemental generations probe", startedAt: now() };
  for (const [key, cfg] of Object.entries(CH) as [string, any][]) {
    const p = new JsonRpcProvider(cfg.rpc, new Network(key, cfg.cid));
    const o: any = {};
    for (const [g, taddr0] of Object.entries(cfg.tokens as Record<string, string>)) {
      const taddr = taddr0;
      const t: any = {};
      const selfBal = await (async () => { const i = new Interface(ERC20); try { const d = await p.call({ to: taddr, data: i.encodeFunctionData("balanceOf", [taddr]) }); return i.decodeFunctionResult("balanceOf", d)[0].toString(); } catch (e: any) { return "ERR:" + String(e.message).slice(0, 60); } })();
      t.selfBalance = selfBal;
      const holderHunt: Record<string, string> = {};
      for (const [who, waddr0] of Object.entries(cfg.candidateHolders as Record<string, string>)) {
        const waddr = waddr0;
        try { const i = new Interface(ERC20); const d = await p.call({ to: taddr, data: i.encodeFunctionData("balanceOf", [waddr]) }); const v = i.decodeFunctionResult("balanceOf", d)[0].toString(); if (v !== "0") holderHunt[who] = v; } catch { }
      }
      t.ecosystemBalances = holderHunt;
      // privilege surface
      const ownI = new Interface(OWN);
      try { const d = await p.call({ to: taddr, data: ownI.encodeFunctionData("owner", []) }); t.owner = ownI.decodeFunctionResult("owner", d)[0]; } catch (e: any) { t.owner = "ERR:" + (/revert/i.test(e.message) ? "EVM-REVERT" : "?"); }
      try { const d = await p.call({ to: taddr, data: ownI.encodeFunctionData("paused", []) }); t.paused = String(ownI.decodeFunctionResult("paused", d)[0]); } catch (e: any) { t.paused = "ERR:" + (/revert/i.test(e.message) ? "EVM-REVERT" : "?"); }
      const acI = new Interface(AC);
      for (const [rn, rh] of Object.entries(R)) {
        try { const d = await p.call({ to: taddr, data: acI.encodeFunctionData("hasRole", [rh, DEPLOYER]) }); t[`hasRole_${rn}_deployer`] = String(acI.decodeFunctionResult("hasRole", d)[0]); } catch (e: any) { t[`hasRole_${rn}_deployer`] = "ERR:" + (/revert/i.test(e.message) ? "EVM-REVERT" : "?"); }
      }
      o[g] = t;
    }
    out[key] = o;
    log({ call: `supp:${key}`, result: JSON.stringify(o).slice(0, 400) });
  }

  // ---- 4byte resolution for the privilege-relevant unknown selectors ----
  const evm = JSON.parse((await import("node:fs")).readFileSync("/home/z/my-project/audit-work/task10/evidence/onchain-evm.json", "utf8"));
  const interest = ["MTQ", "Governance", "Safe", "Mint", "Redeem", "Reserve", "Oracle", "Algorithm", "Takaful"];
  const localDictSel = new Set<string>();
  { // rebuild local dict keys (subset): recompute from the same foundry ABIs
    const { readFileSync, existsSync } = await import("node:fs");
    const add = (sig: string) => localDictSel.add(keccak256(toUtf8Bytes(sig)).slice(0, 10).toLowerCase());
    for (const sig of ["name()", "symbol()", "decimals()", "totalSupply()", "balanceOf(address)", "transfer(address,uint256)", "transferFrom(address,address,uint256)", "approve(address,uint256)", "allowance(address,address)", "cap()", "hasRole(bytes32,address)", "getRoleAdmin(bytes32)", "grantRole(bytes32,address)", "revokeRole(bytes32,address)", "renounceRole(bytes32,address)", "getRoleMember(bytes32)", "getRoleMemberCount(bytes32)", "DEFAULT_ADMIN_ROLE()", "MINTER_ROLE()", "PAUSER_ROLE()", "paused()", "pause()", "unpause()", "owner()", "transferOwnership(address)", "renounceOwnership()", "mint(address,uint256)", "burn(uint256)", "burnFrom(address,uint256)", "getThreshold()", "getOwners()", "nonce()", "VERSION()", "getModulesPaginated(address,uint256)", "getGuard()", "votingDelay()", "quorumNumerator()"]) add(sig);
    for (const f of ["MTQToken", "Governance", "MintContract", "RedeemContract", "Oracle", "ReserveVault", "Takaful", "AlgorithmEngine", "Safe", "MockUSDC"]) {
      const art = JSON.parse(readFileSync(`/home/z/my-project/contracts/foundry-out/MtqEcosystem.sol/${f}.json`, "utf8"));
      for (const a of art.abi ?? []) if (a.type === "function") add(`${a.name}(${a.inputs.map((i: any) => i.type).join(",")})`);
    }
  }
  const unknowns = new Set<string>();
  for (const ch of ["monad", "arc"]) for (const n of interest) {
    for (const s of evm[ch].contracts[n].selectors) if (!localDictSel.has(s)) unknowns.add(s);
  }
  const four: Record<string, string[]> = {};
  let n = 0;
  for (const s of unknowns) {
    n++;
    await new Promise(r => setTimeout(r, 350));
    try {
      const r = await fetch(`https://www.4byte.directory/api/v1/signatures/?hex_signature=${s}`, { signal: AbortSignal.timeout(6000) });
      const j = await r.json() as any;
      if (j.results?.length) four[s] = j.results.slice(0, 3).map((x: any) => x.text_signature);
    } catch { }
    if (n % 40 === 0) console.log(`4byte progress ${n}/${unknowns.size}`);
  }
  out.fourByteResolution = { asked: [...unknowns], resolved: four, note: "4byte.directory public registry — top-3 candidates per selector; candidates can include spoofed submissions; treat as indicative, not verified identity" };
  out.finishedAt = now();
  const p = "/home/z/my-project/audit-work/task10/evidence/supplemental-generations.json";
  writeFileSync(p, JSON.stringify(out, null, 2));
  console.log("written " + p);
  console.log(JSON.stringify({ monad: out.monad, arc: out.arc, resolvedCount: Object.keys(four).length, asked: unknowns.size }, null, 1).slice(0, 4500));
}
main().catch(e => { console.error("FATAL", e); process.exit(1); });
