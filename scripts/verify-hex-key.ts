// ============================================================================
// MTQΣ — Solana Mint/Authority Audit (READ-ONLY, public-address based)
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// TASK 12 K-1 REWRITE (was: scripts/verify-hex-key.ts):
//   The ORIGINAL version embedded the compromised Solana 4saT secret-key hex
//   literal (incident C-045-b, fingerprint 58c19e…eb60, 128 hex = seed‖pubkey)
//   and re-derived it through fromSecretKey/fromSeed/base58-encode to "verify"
//   which wallet it controls. That use is RETIRED: no key material may be
//   handled inside this repository or any AI environment (Task 12 §2.1).
//
//   The derivation was already recorded by Tasks 10/11 with offline forensics
//   (derives to 4saT…cA1d, the SUPERSEDED mint's mint+freeze authority — see
//   audit-work/task10/D1-KEY-INCIDENT-REPORT.md §C-045-b). It is NOT re-run
//   here. This script therefore no longer needs @solana/web3.js at all.
//
// WHAT THIS SCRIPT STILL DOES (public-address, read-only JSON-RPC only):
//   - Reads BOTH devnet mints (current + superseded): authority/decimals/supply.
//   - Reads the SOL balances of the two known PUBLIC wallet addresses.
//   - Failing or empty queries are reported UNVERIFIED — never as negative
//     results.
//
//   ZERO transactions, ZERO signing, ZERO key material.
// ============================================================================

const RPC = "https://api.devnet.solana.com";

const PUBLIC_IDENTITIES = {
  currentMint: { label: "CURRENT mint GAGRdrY6…", address: "GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4" },
  supersededMint: { label: "SUPERSEDED mint 2EaK5c…", address: "2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY" },
  currentAuthorityWallet: { label: "DbFjz… (current mint authority; key NOT found in repo — custody UNVERIFIED, CKPT-2)", address: "DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3" },
  exposedWallet: { label: "4saT… (C-045-b identity — TREAT AS COMPROMISED)", address: "4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d" },
};

async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
  try {
    const r = await fetch(RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    });
    const j = await r.json() as any;
    if (j?.error) { console.log(`    RPC error: ${j.error.message?.slice(0, 80)} — UNVERIFIED`); return null; }
    return (j?.result ?? null) as T;
  } catch (e: any) {
    console.log(`    RPC failed: ${e.message?.slice(0, 80)} — UNVERIFIED`);
    return null;
  }
}

console.log("=== MTQΣ SOLANA AUDIT — READ-ONLY (public addresses; key verification RETIRED — see header) ===\n");

// 1. Mint dossiers (jsonParsed-authoritative, per Task 11 D4 §1)
for (const m of [PUBLIC_IDENTITIES.currentMint, PUBLIC_IDENTITIES.supersededMint]) {
  console.log(`${m.label}  ${m.address}`);
  const res = await rpc<any>("getAccountInfo", [m.address, { encoding: "jsonParsed" }]);
  const info = res?.value?.data?.parsed?.info;
  if (!info) { console.log("  account EMPTY or unparseable — UNVERIFIED (not a negative result)\n"); continue; }
  console.log(`  mintAuthority = ${info.mintAuthority ?? "NONE"}`);
  console.log(`  freezeAuthority = ${info.freezeAuthority ?? "NONE"}`);
  console.log(`  decimals = ${info.decimals}   supply(raw) = ${info.supply}`);
  const sup = await rpc<any>("getTokenSupply", [m.address]);
  if (sup) console.log(`  getTokenSupply (uiAmount) = ${sup.value?.uiAmountString ?? "?"}`);
  console.log("");
}

// 2. Wallet SOL balances (public addresses)
for (const w of [PUBLIC_IDENTITIES.currentAuthorityWallet, PUBLIC_IDENTITIES.exposedWallet]) {
  console.log(`${w.label}  ${w.address}`);
  const bal = await rpc<{ value: number }>("getBalance", [w.address]);
  console.log(`  SOL balance = ${bal ? (bal.value / 1e9).toFixed(9) : "?"}\n`);
}

console.log("[solana audit] read-only probe complete. No transactions were made; no key material was processed.");
console.log("[solana audit] C-045-b posture: repository cleanup does NOT revoke the superseded mint's authority;");
console.log("               only the owner-approved SetAuthority steps in");
console.log("               audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md do.");
