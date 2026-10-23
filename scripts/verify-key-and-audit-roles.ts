// ============================================================================
// MTQΣ — Cross-Chain Roles Audit (READ-ONLY, public-address based)
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// TASK 12 K-1 REWRITE (was: scripts/verify-key-and-audit-roles.ts):
//   The ORIGINAL version of this script embedded the compromised EVM deployer
//   private key literal (incident C-045-a, fingerprint 0xdbe1…62d6) at line 5
//   in order to "verify" that it derives to the deployer address. That use is
//   RETIRED: no key material may be handled, derived, or re-verified inside
//   this repository or any AI environment (Task 12 §2.1).
//
//   The key→address derivation was already recorded by Tasks 10/11 with
//   offline forensics (see audit-work/task10/D1-KEY-INCIDENT-REPORT.md and
//   audit-work/task11/evidence/*). It is NOT re-run here.
//
// WHAT THIS SCRIPT STILL DOES (public-address, read-only eth_call only):
//   - Probes each chain's RPC (chainId check).
//   - Checks the deployed MTQ / module contracts for AccessControl role
//     membership of PUBLIC addresses (deployer EOA, Genesis Safe, modules).
//   - Reports code presence, paused state, name/symbol/supply.
//   - Solana: reads the mint account's authority/decimals/supply (jsonParsed).
//
//   ZERO transactions, ZERO signing, ZERO key material. Safe to run anywhere.
// ============================================================================

import { ethers } from "ethers";

// Task 10/11 incident record (public data only — fingerprints, never literals):
//   C-045-a  EVM secp256k1 private key, fingerprint 0xdbe1…62d6 (66 chars)
//            → derives to the DEPLOYER address below (verified offline in
//              Task 10; NOT re-derived here). TREAT AS COMPROMISED.
//   Posture: repository cleanup does NOT revoke this key; only the owner-
//   approved on-chain rotation (audit-work/task12/D4-EVM-AUTHORITY-MIGRATION-PACKAGE.md) does.

const ROLE_ADMIN = "0x0000000000000000000000000000000000000000000000000000000000000000";
const ROLE_MINTER = "0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"; // keccak256("MINTER_ROLE")
const ROLE_PAUSER = "0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a"; // keccak256("PAUSER_ROLE")

const DEPLOYER = "0x3C3932F865892EFabE45892f453f81B64f6c8d8c"; // PUBLIC address (compromised key's identity)
const GENESIS_SAFE = "0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0"; // 1/1, sole owner = DEPLOYER (Task 10/11)

interface ChainAudit { key: string; label: string; chainId: number; rpc: string; mtqUser: string; modules: { name: string; address: string }[]; }
const CHAINS: ChainAudit[] = [
  {
    key: "monad", label: "Monad Testnet", chainId: 10143, rpc: "https://testnet-rpc.monad.xyz",
    mtqUser: "0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD",
    modules: [
      { name: "Mint module", address: "0x197e9CB28216dfe18a199b4c2930F74C2F460809" },
      { name: "Redeem module", address: "0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4" },
    ],
  },
  {
    key: "arc", label: "Arc Testnet", chainId: 5042002, rpc: "https://rpc.testnet.arc.io",
    mtqUser: "0x237c3Aa2B79248f86f6523D3890095BCd1996601",
    modules: [
      { name: "Mint module", address: "0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa" },
      { name: "Redeem module", address: "0xcAde4594177829597882555Ff57d0e34092daF8e" },
    ],
  },
];

const ACCESS_ABI = [
  "function hasRole(bytes32,address) view returns (bool)",
  "function paused() view returns (bool)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
];

console.log("=== MTQΣ ROLES AUDIT — READ-ONLY (public addresses; key verification RETIRED — see header) ===\n");
console.log(`DEPLOYER (C-045-a identity, treated as compromised): ${DEPLOYER}`);
console.log(`GENESIS SAFE (1/1, sole owner = deployer):             ${GENESIS_SAFE}\n`);

for (const c of CHAINS) {
  console.log(`─── ${c.label} (chainId ${c.chainId}) ───`);
  const provider = new ethers.JsonRpcProvider(c.rpc, { chainId: c.chainId, name: c.key }, { staticNetwork: true });

  try {
    const net = await Promise.race([provider.getNetwork(), new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 8000))]);
    const block = await provider.getBlockNumber();
    console.log(`  RPC: ✓ chainId ${Number(net.chainId)} @ block ${block} (evidence anchor)`);
  } catch (e: any) { console.log(`  ✗ RPC unreachable: ${e.message?.slice(0, 60)} — UNVERIFIED (failed query, not a negative result)`); continue; }

  const mtq = new ethers.Contract(c.mtqUser, ACCESS_ABI, provider);
  try {
    console.log(`  MTQ ${c.mtqUser}:`);
    console.log(`    name()="${await mtq.name()}" symbol()="${await mtq.symbol()}" totalSupply=${ethers.formatEther(await mtq.totalSupply())}`);
    const holders: { label: string; address: string }[] = [
      { label: "deployer EOA", address: DEPLOYER },
      { label: "Genesis Safe", address: GENESIS_SAFE },
      ...c.modules.map(m => ({ label: m.name, address: m.address })),
    ];
    for (const role of [ROLE_ADMIN, ROLE_MINTER, ROLE_PAUSER]) {
      const roleName = role === ROLE_ADMIN ? "ADMIN " : role === ROLE_MINTER ? "MINTER" : "PAUSER";
      const cells: string[] = [];
      for (const h of holders) {
        let v: string;
        try { v = (await mtq.hasRole(role, h.address)) ? "TRUE " : "false"; }
        catch { v = "ERR  "; }
        cells.push(`${h.label}=${v}`);
      }
      console.log(`    ${roleName}: ${cells.join("  ")}`);
    }
    try { console.log(`    paused()=${await mtq.paused()}`); } catch { console.log("    paused(): not exposed"); }
  } catch (e: any) {
    console.log(`  MTQ read failed: ${e.message?.slice(0, 60)} — UNVERIFIED`);
  }
  console.log("");
}

// Solana read-only (jsonParsed — public mint accounts)
console.log("─── Solana Devnet (SPL) — read-only ───");
const MINTS = [
  { label: "CURRENT mint GAGRdrY6…", address: "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4" },
  { label: "SUPERSEDED mint 2EaK5c…", address: "2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY" },
];
for (const m of MINTS) {
  try {
    const r = await fetch("https://api.devnet.solana.com", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [m.address, { encoding: "jsonParsed" }] }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json() as any;
    const info = j?.result?.value?.data?.parsed?.info;
    if (!info) { console.log(`  ${m.label}: EMPTY/UNPARSED — UNVERIFIED`); continue; }
    console.log(`  ${m.label}:`);
    console.log(`    mintAuthority=${info.mintAuthority ?? "NONE"}`);
    console.log(`    freezeAuthority=${info.freezeAuthority ?? "NONE"}`);
    console.log(`    decimals=${info.decimals} supply(raw)=${info.supply}`);
  } catch (e: any) { console.log(`  ${m.label}: RPC failed: ${e.message?.slice(0, 60)} — UNVERIFIED`); }
}
console.log("\n[roles audit] read-only probe complete. No transactions were made; no key material was processed.");
