/**
 * Governance full-cycle E2E via the PUBLIC HTTP API ONLY (no node boot —
 * one process owns the chain; everything else submits through /api/chain).
 * Signs txs with the deterministic devnet validator keys + submits via HTTP.
 */
import { nodeKeys, pubToAddress, signTx } from "@/lib/chain/crypto";
import type { Tx } from "@/lib/chain/shared";
const BASE = "http://localhost:3000";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function httpSubmit(unsigned: Omit<Tx, "sig" | "pub_key">, priv: string): Promise<{ ok: boolean; hash?: string; error?: string }> {
  const { sig, pub } = signTx(priv, unsigned);
  const r = await fetch(`${BASE}/api/chain/submit`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...unsigned, sig, pub_key: pub }),
  });
  return r.json();
}

async function main() {
  const keys = nodeKeys();
  const val0 = { addr: pubToAddress(keys.validators[0].pub), priv: keys.validators[0].priv, moniker: "val-0" };
  const val1 = { addr: pubToAddress(keys.validators[1].pub), priv: keys.validators[1].priv, moniker: "val-1" };
  const val2 = { addr: pubToAddress(keys.validators[2].pub), priv: keys.validators[2].priv, moniker: "val-2" };

  // 1) submit text proposal from val-0
  const acct0 = await (await fetch(`${BASE}/api/chain/account?a=${val0.addr}`)).json();
  let r = await httpSubmit({ type: "gov_submit", from: val0.addr, nonce: acct0.nonce + 1, fee: 1000, payload: { proposal_type: "text", title: "HTTP E2E cycle: text proposal PASSED→EXECUTED", description: "Signed with the deterministic devnet validator key and submitted through the public /api/chain/submit endpoint. Exercises quorum, timelock and execution.", payload: {}, deposit: 100000 } }, val0.priv);
  console.log("submit:", JSON.stringify(r));
  if (!r.ok) throw new Error("submit failed");
  await sleep(7000);
  let gov = await (await fetch(`${BASE}/api/chain/gov`)).json();
  const prop = gov.proposals[0];
  console.log(`proposal #${prop.id} ${prop.status} (voting ends in ${Math.max(0, Math.round((prop.voting_end_ms - Date.now()) / 1000))}s)`);

  // 2) three validator YES votes (turnout 30 of ~50 total → quorum ✓)
  for (const v of [val0, val1, val2]) {
    const acct = await (await fetch(`${BASE}/api/chain/account?a=${v.addr}`)).json();
    const rv = await httpSubmit({ type: "gov_vote", from: v.addr, nonce: acct.nonce + 1, fee: 1000, payload: { proposal_id: prop.id, option: "YES" } }, v.priv);
    console.log(`vote ${v.moniker}:`, rv.ok ? "OK" : rv.error);
  }
  console.log("waiting voting period (60s) + timelock (15s)…");
  await sleep(82_000);
  gov = await (await fetch(`${BASE}/api/chain/gov`)).json();
  const final = gov.proposals[0];
  console.log(`FINAL: #${final.id} status=${final.status} yes=${final.yes_power} no=${final.no_power} abstain=${final.abstain_power} votes=${final.votes.length}`);
  const evs = gov.recent_events.filter((e: { type: string }) => e.type.startsWith("gov."));
  for (const e of evs.slice(0, 5)) console.log("event:", e.type, JSON.stringify(e.data).slice(0, 90));
  if (final.status !== "EXECUTED") throw new Error(`expected EXECUTED, got ${final.status}`);
  console.log("\nGOV CYCLE PASS ✅ quorum → PASSED → timelock → EXECUTED (via public HTTP API only)");
}
main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
