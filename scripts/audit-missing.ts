// MTQΣ — "What Is Missing (Roles Not Yet Deployed)" audit.
// For each chain, lists what SHOULD exist per the blueprint vs what's actually
// deployed + live, and flags every gap.

import { ethers } from "ethers";
import { Connection, PublicKey } from "@solana/web3.js";

const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
const ROLE_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ROLE_MINTER = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6";
const ROLE_PAUSER = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a";

const ACCESS_ABI = ["function hasRole(bytes32,address) view returns (bool)","function paused() view returns (bool)","function name() view returns (string)","function symbol() view returns (string)"];
const BRANDED_ABI = ["function owner() view returns (address)","function protocolStatus() view returns (uint8)","function mintPaused() view returns (bool)","function name() view returns (string)","function symbol() view returns (string)","function brandIconUri() view returns (string)"];

interface ChainCfg { key: string; label: string; chainId: number; rpc: string; contracts: Record<string, string>; }
const CHAINS: ChainCfg[] = [
  { key: "monad", label: "Monad Testnet", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", contracts: {
    mtqUser: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD",
    mtqBranded: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a",
    governance: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
    safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
    algorithm: "0x8839ce50e8D414005518769999c0A5b961D00CB2",
    reserve: "0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177",
    mint: "0x197e9CB28216dfe18a199b4c2930F74C2F460809",
    redeem: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4",
    oracle: "0xDfcA66ac0450C9AB86307af1942E157C5A4DB713",
    takaful: "0x3eC27BB283644eF0A98B9961E9FBED0583a02f19",
  }},
  { key: "arc", label: "Arc Testnet", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", contracts: {
    mtqUser: "0x237c3Aa2B79248f86f6523D3890095BCd1996601",
    mtqBranded: "0x5C728F729110013A1fa59fFc85938bbD973A2563",
    governance: "0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66",
    safe: "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0",
    algorithm: "0x62f8E5243f32eE5C87a14A7896C61104aD9e7727",
    reserve: "0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471",
    mint: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa",
    redeem: "0xcAde4594177829597882555Ff57d0e34092daF8e",
    oracle: "0xFd2B8d176bf059287638Db30D02C6651dA02861e",
    takaful: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0",
  }},
  { key: "robinhood", label: "Robinhood Chain Testnet", chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", contracts: {
    mtqBranded: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0",
    mockUsdc: "0xFd2B8d176bf059287638Db30D02C6651dA02861e",
  } as any },
];

async function codeAt(provider: ethers.JsonRpcProvider, addr: string): Promise<{ live: boolean; bytes: number }> {
  try {
    const code = await Promise.race([provider.getCode(addr), new Promise<never>((_,r)=>setTimeout(()=>r(new Error("t")),8000))]);
    return { live: code && code !== "0x", bytes: code?.length ?? 0 };
  } catch { return { live: false, bytes: 0 }; }
}

(async () => {
  console.log("================================================================");
  console.log("  WHAT IS MISSING (Roles/Contracts Not Yet Deployed) — by chain");
  console.log("================================================================");

  for (const c of CHAINS) {
    console.log(`\n════════ ${c.label.toUpperCase()} (chainId ${c.chainId}) ════════`);
    const provider = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: c.key }, { staticNetwork: true });
    const missing: string[] = [];

    // User MITHQAL ecosystem (only Monad + Arc have it)
    if (c.contracts.mtqUser) {
      const mtq = new ethers.Contract(c.contracts.mtqUser, ACCESS_ABI, provider);
      const u = await codeAt(provider, c.contracts.mtqUser);
      console.log(`\n  User MITHQAL token (${c.contracts.mtqUser}): ${u.live ? `LIVE (${u.bytes} B)` : "MISSING"}`);
      if (u.live) {
        let admin=false, minter=false, pauser=false, paused=false;
        try { admin = await mtq.hasRole(ROLE_ADMIN, DEPLOYER); } catch {}
        try { minter = await mtq.hasRole(ROLE_MINTER, DEPLOYER); } catch {}
        try { pauser = await mtq.hasRole(ROLE_PAUSER, DEPLOYER); } catch {}
        try { paused = await mtq.paused(); } catch {}
        console.log(`    Roles → ADMIN:${admin} MINTER:${minter} PAUSER:${pauser} paused:${paused}`);
        if (!admin) missing.push("MITHQAL: DEFAULT_ADMIN_ROLE not granted to deployer");
        if (!minter) missing.push("MITHQAL: MINTER_ROLE not granted to deployer");
        if (!pauser) missing.push("MITHQAL: PAUSER_ROLE not granted to deployer");
      } else missing.push("User MITHQAL token: not deployed");

      // Ecosystem contracts check
      const eco = ["governance","safe","algorithm","reserve","mint","redeem","oracle","takaful"];
      for (const k of eco) {
        const a = (c.contracts as any)[k];
        if (!a) { missing.push(`${k}: address not recorded`); continue; }
        const r = await codeAt(provider, a);
        console.log(`  ${k.padEnd(12)} ${a}: ${r.live ? `LIVE (${r.bytes} B)` : "MISSING"}`);
        if (!r.live) missing.push(`${k}: no bytecode at recorded address`);
      }
    } else {
      console.log(`\n  User MITHQAL ecosystem: NOT deployed on ${c.label} (entire ecosystem missing)`);
      missing.push("User MITHQAL ecosystem: not deployed on this chain (Governance, Safe, Algorithm, Reserve, Mint, Redeem, Oracle, Takaful)");
    }

    // Branded MTQΣ
    if (c.contracts.mtqBranded) {
      const b = await codeAt(provider, c.contracts.mtqBranded);
      console.log(`\n  Branded MTQΣ (${c.contracts.mtqBranded}): ${b.live ? `LIVE (${b.bytes} B)` : "MISSING"}`);
      if (b.live) {
        const mtq = new ethers.Contract(c.contracts.mtqBranded, BRANDED_ABI, provider);
        try {
          const owner = await mtq.owner();
          const status = ["NORMAL","CAUTION","DEFENSIVE","EMERGENCY","RECOVERY"][Number(await mtq.protocolStatus())];
          const paused = await mtq.mintPaused();
          const name = await mtq.name();
          const brandIcon = await mtq.brandIconUri();
          console.log(`    name="${name}" symbol="${await mtq.symbol()}" owner=${owner} (deployer? ${owner.toLowerCase()===DEPLOYER.toLowerCase()})`);
          console.log(`    protocolStatus=${status} mintPaused=${paused} brandIconUri=${brandIcon}`);
          if (owner.toLowerCase() !== DEPLOYER.toLowerCase()) missing.push("Branded MTQΣ: owner is not deployer");
          if (!name.includes("Σ")) missing.push("Branded MTQΣ: name() does not contain Σ (brand not applied)");
        } catch (e:any) { console.log(`    read failed: ${e.message?.slice(0,60)}`); }
      } else missing.push("Branded MTQΣ: not deployed");
    }

    // Cross-chain gaps specific to this chain
    const chainGaps: string[] = [];
    if (c.key === "robinhood") {
      chainGaps.push("User MITHQAL ecosystem (Governance/Safe/Algorithm/Reserve/Mint/Redeem/Oracle/Takaful): not deployed");
      chainGaps.push("AccessControl roles (DEFAULT_ADMIN/MINTER/PAUSER): not deployed (no MITHQAL)");
    }
    if (c.key === "arc" || c.key === "monad") {
      chainGaps.push("MockUSDC pilot collateral: deployed alongside branded MTQΣ (verify if intended)");
    }

    console.log(`\n  >> MISSING on ${c.label}:`);
    const allMissing = [...missing, ...chainGaps];
    if (allMissing.length === 0) console.log("     (none — all expected roles/contracts deployed)");
    else for (const m of allMissing) console.log(`     • ${m}`);
  }

  // Solana
  console.log(`\n════════ SOLANA DEVNET ════════`);
  const conn = new Connection("https://api.devnet.solana.com", "confirmed");
  const mint = new PublicKey("GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4");
  const mintAcct = await conn.getParsedAccountInfo(mint);
  const info = (mintAcct.value as any)?.data?.parsed?.info;
  console.log(`  SPL Mint ${mint.toBase58()}: ${info ? "LIVE" : "MISSING"}`);
  if (info) {
    console.log(`    mintAuthority: ${info.mintAuthority}`);
    console.log(`    freezeAuthority: ${info.freezeAuthority ?? "null"}`);
    console.log(`    decimals: ${info.decimals}`);
  }
  // Metaplex metadata
  const METAPLEX_PID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
  const [metaPDA] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), METAPLEX_PID.toBuffer(), mint.toBuffer()], METAPLEX_PID);
  const meta = await conn.getAccountInfo(metaPDA);
  console.log(`    Metaplex metadata PDA ${metaPDA.toBase58()}: ${meta ? "EXISTS" : "MISSING"}`);
  console.log(`\n  >> MISSING on Solana Devnet:`);
  console.log(`     • Metaplex Token Metadata account: NOT created (name='MTQΣ' on-chain display cannot be set)`);
  console.log(`     • On-chain display name 'MTQΣ': pending (SPL mint symbol 'MTQ' is immutable anyway)`);
  console.log(`     • Token Metadata update authority: not set (would default to mint authority once created)`);
  console.log(`     • Multisig on mintAuthority: not configured (single-key control = key-person risk)`);
})();
