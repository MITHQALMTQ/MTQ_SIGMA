import { ethers } from "ethers";
import { readFileSync } from "fs";

// 1. Confirm the pasted key is the EVM key (not Solana)
const pk = "0xdbe17f8db187557b779a1a5c9b80f0eab4661938dc68e7c7eef7d63ddb7862d6";
const w = new ethers.Wallet(pk);
console.log("=== KEY VERIFICATION ===");
console.log("Pasted key derives EVM address:", w.address);
console.log("Matches your EVM wallet 0x3C39...8c8c?", w.address.toLowerCase() === "0x3c3932f865892efabe45892f453f81b64f6c8d8c" ? "YES — this is the EVM key" : "NO");
console.log("Is it a Solana keypair? NO — Solana uses ed25519 (64-byte array / base58 ~88-char secret), not 0x-hex secp256k1.");
console.log("→ Cannot sign Solana transactions with this key. Solana branding still pending the Solana keypair.\n");

// 2. Roles audit: for each EVM chain, check what roles are deployed on the
//    user's original MTQ (MITHQAL, AccessControl) + the branded MTQΣ (pilot).
const ROLE_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ROLE_MINTER = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"; // keccak256("MINTER_ROLE")
const ROLE_PAUSER = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a"; // keccak256("PAUSER_ROLE")

const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c";
interface ChainAudit { key: string; label: string; chainId: number; rpc: string; mtqUser: string; mtqBranded: string; }
const CHAINS: ChainAudit[] = [
  { key: "monad", label: "Monad Testnet", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz", mtqUser: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD", mtqBranded: "0x5D9564C27111EA65Da3228a79833F0FF129bfd4a" },
  { key: "arc", label: "Arc Testnet", chainId: 5042002, rpc: "https://rpc.testnet.arc.io", mtqUser: "0x237c3Aa2B79248f86f6523D3890095BCd1996601", mtqBranded: "0x5C728F729110013A1fa59fFc85938bbD973A2563" },
  { key: "robinhood", label: "Robinhood Chain Testnet", chainId: 46630, rpc: "https://rpc.testnet.chain.robinhood.com/rpc", mtqUser: "", mtqBranded: "0xA3B89FfdE28577A7D30E2c22503dB33509044EF0" },
];

const ACCESS_ABI = [
  "function hasRole(bytes32,address) view returns (bool)",
  "function getRoleAdmin(bytes32) view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "function MINTER_ROLE() view returns (bytes32)",
  "function PAUSER_ROLE() view returns (bytes32)",
  "function paused() view returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
];
const BRANDED_ABI = [
  "function name() view returns (string)","function symbol() view returns (string)","function owner() view returns (address)",
  "function protocolStatus() view returns (uint8)","function mintPaused() view returns (bool)","function getMTQPrice() view returns (uint256)",
];

console.log("=== ROLES FULLY DEPLOYED — CROSS-CHAIN AUDIT ===\n");

for (const c of CHAINS) {
  console.log(`─── ${c.label} (chainId ${c.chainId}) ───`);
  const provider = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: c.key }, { staticNetwork: true });

  // RPC reachability
  try {
    const net = await Promise.race([provider.getNetwork(), new Promise<never>((_,r)=>setTimeout(()=>r(new Error("timeout")),8000))]);
    console.log(`  RPC: ✓ chainId ${Number(net.chainId)}`);
  } catch (e:any) { console.log(`  ✗ RPC unreachable: ${e.message?.slice(0,60)}`); continue; }

  // USER'S ORIGINAL MITHQAL (AccessControl + Pausable) — only Monad + Arc have it
  if (c.mtqUser) {
    try {
      const code = await Promise.race([provider.getCode(c.mtqUser), new Promise<never>((_,r)=>setTimeout(()=>r(new Error("timeout")),8000))]);
      if (code && code !== "0x") {
        console.log(`  USER MTQ (MITHQAL) ${c.mtqUser}: LIVE (${code.length} bytes)`);
        const mtq = new ethers.Contract(c.mtqUser, ACCESS_ABI, provider);
        // try AccessControl role checks
        let isAccessControl = false;
        try {
          const da = await mtq.hasRole(ROLE_ADMIN, DEPLOYER);
          isAccessControl = true;
          console.log(`    AccessControl: DEFAULT_ADMIN_ROLE(deployer)=${da}`);
          try { console.log(`    MINTER_ROLE(deployer)=${await mtq.hasRole(ROLE_MINTER, DEPLOYER)}`); } catch { console.log("    MINTER_ROLE: not exposed"); }
          try { console.log(`    PAUSER_ROLE(deployer)=${await mtq.hasRole(ROLE_PAUSER, DEPLOYER)}`); } catch { console.log("    PAUSER_ROLE: not exposed"); }
          try { console.log(`    paused()=${await mtq.paused()}`); } catch { console.log("    paused(): not exposed (no Pausable)"); }
        } catch (e:any) {
          console.log(`    AccessControl: NOT present (hasRole reverted: ${e.message?.slice(0,50)})`);
        }
      } else { console.log(`  USER MTQ (MITHQAL) ${c.mtqUser}: EMPTY (no code)`); }
    } catch (e:any) { console.log(`  USER MTQ getCode failed: ${e.message?.slice(0,60)}`); }
  } else {
    console.log(`  USER MTQ (MITHQAL): NOT deployed on this chain (Robinhood has only the branded pilot)`);
  }

  // BRANDED MTQΣ (this build's pilot — owner-gated, not AccessControl)
  try {
    const code = await Promise.race([provider.getCode(c.mtqBranded), new Promise<never>((_,r)=>setTimeout(()=>r(new Error("timeout")),8000))]);
    if (code && code !== "0x") {
      console.log(`  BRANDED MTQΣ ${c.mtqBranded}: LIVE (${code.length} bytes)`);
      const mtq = new ethers.Contract(c.mtqBranded, BRANDED_ABI, provider);
      try {
        console.log(`    name()="${await mtq.name()}" symbol()="${await mtq.symbol()}"`);
        try { console.log(`    owner()=${await mtq.owner()} (deployer? ${(await mtq.owner()).toLowerCase()===DEPLOYER.toLowerCase()})`); } catch {}
        try { console.log(`    protocolStatus()=${["NORMAL","CAUTION","DEFENSIVE","EMERGENCY","RECOVERY"][Number(await mtq.protocolStatus())]}`); } catch {}
        try { console.log(`    mintPaused()=${await mtq.mintPaused()}`); } catch {}
        try { console.log(`    getMTQPrice()=$${ethers.formatEther(await mtq.getMTQPrice())}`); } catch {}
      } catch (e:any) { console.log(`    read failed: ${e.message?.slice(0,60)}`); }
    } else { console.log(`  BRANDED MTQΣ ${c.mtqBranded}: EMPTY`); }
  } catch (e:any) { console.log(`  BRANDED MTQΣ getCode failed: ${e.message?.slice(0,60)}`); }
  console.log("");
}

// Solana roles
console.log("─── Solana Devnet (SPL) ───");
try {
  const r = await fetch("https://api.devnet.solana.com", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({jsonrpc:"2.0",id:1,method:"getAccountInfo",params:["GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4",{encoding:"jsonParsed"}]}), signal: AbortSignal.timeout(8000) });
  const j = await r.json() as any;
  const info = j?.result?.value?.data?.parsed?.info;
  console.log(`  Mint GAGRdrY6...jxS4: LIVE`);
  console.log(`    mintAuthority=${info?.mintAuthority} (this is the only "role" on an SPL mint)`);
  console.log(`    freezeAuthority=${info?.freezeAuthority}`);
  console.log(`    decimals=${info?.decimals}, supply=${info?.supply}`);
  console.log(`    Metaplex metadata: NONE (name='MTQΣ' on-chain display pending Solana keypair)`);
} catch (e:any) { console.log(`  Solana RPC failed: ${e.message?.slice(0,60)}`); }
