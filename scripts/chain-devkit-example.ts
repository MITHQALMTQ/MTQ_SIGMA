/**
 * MTQΣ devnet DEVKIT EXAMPLE — the external-integrator golden loop, over the
 * PUBLIC HTTP API ONLY (no node boot; the server owns the chain).
 *
 * What this demonstrates (in the exact order an integrator would):
 *   1. generate a FRESH ed25519 keypair locally (never shared with the server)
 *   2. derive the mtq1 address:  "mtq1" + hex(sha256(pubkey)[0:20])
 *   3. faucet drip:              POST /api/chain/faucet { address }
 *   4. poll account state:        GET  /api/chain/account?a=<mtq1…>
 *   5. client-signed send:        POST /api/chain/submit (sig over canonicalTxBytes)
 *   6. delegate → bonded position + voting power
 *   7. undelegate → UNBONDING QUEUE: power drops now, funds time-lock
 *      (unbonding_s param) then auto-release WITHOUT a claim tx
 *   8. chain summary + honest-status payload: GET /api/chain
 *
 * Signing uses the same @noble/curves + canonical byte encoding as the node
 * (src/lib/chain/shared.ts canonicalTxBytes — one code path both sides).
 *
 * RUN: bun scripts/chain-devkit-example.ts   (dev server on :3000)
 */
import { generateKeyPair, pubToAddress, signTx } from "@/lib/chain/crypto";
import type { Tx } from "@/lib/chain/shared";

const BASE = "http://localhost:3000";
const MICRO = 1_000_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AccountDto = {
  address: string; nonce: number; fee_u: number; pmtq_u: number;
  bonded_u: number; unbonding_u: number;
  unbondings: Array<{ id: number; validator_moniker: string; amount_u: number; release_in_ms: number }>;
  stakes: Array<{ validator_moniker: string; amount_u: number }>;
  exists: boolean;
};

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`);
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}: ${await r.text()}`);
  return r.json() as Promise<T>;
}

async function submit(unsigned: Omit<Tx, "sig" | "pub_key">, privHex: string) {
  const { sig, pub } = signTx(privHex, unsigned);
  const r = await fetch(`${BASE}/api/chain/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...unsigned, sig, pub_key: pub }),
  });
  return (await r.json()) as { ok: boolean; hash?: string; error?: string };
}

async function acct(a: string): Promise<AccountDto> {
  return getJSON<AccountDto>(`/api/chain/account?a=${a}`);
}

/** Poll until predicate holds or timeout — blocks take ~1-5s to include txs. */
async function waitUntil(desc: string, pred: () => Promise<boolean>, timeoutMs = 20_000): Promise<void> {
  const t0 = Date.now();
  for (;;) {
    if (await pred()) return;
    if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for: ${desc}`);
    await sleep(2000);
  }
}

async function main() {
  console.log("── MTQΣ devkit example — external integrator loop (public HTTP only) ──\n");

  // 1) fresh local keypair — the server NEVER sees the private key
  const key = generateKeyPair();
  const myAddr = pubToAddress(key.pub);
  console.log(`1. local keypair generated`);
  console.log(`   address: ${myAddr}`);
  console.log(`   pubkey : ${key.pub.slice(0, 24)}… (ed25519, hex)\n`);

  // 2) chain summary + params (unbonding_s drives the queue leg below)
  const summary = await getJSON<{
    height: number;
    params: { base_fee_u: number; unbonding_s: number };
    honest: { label: string };
  }>("/api/chain");
  const baseFee = summary.params.base_fee_u;
  console.log(`2. chain: height=${summary.height} · base_fee=${baseFee} µMTQD · unbonding_s=${summary.params.unbonding_s}s`);
  console.log(`   honest: ${summary.honest.label}\n`);

  // 3) faucet drip
  const fr = await (await fetch(`${BASE}/api/chain/faucet`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: myAddr }),
  })).json() as { ok: boolean; error?: string };
  if (!fr.ok) throw new Error(`faucet rejected: ${fr.error}`);
  console.log(`3. faucet drip submitted (tx ${String(fr.ok)})`);
  await waitUntil("faucet drip inclusion", async () => (await acct(myAddr)).fee_u >= 10_000 * MICRO);
  const afterDrip = await acct(myAddr);
  console.log(`   balance: ${afterDrip.fee_u / MICRO} MTQD + ${afterDrip.pmtq_u / MICRO} PMTQ (mirror) · nonce ${afterDrip.nonce}\n`);

  // 4) find an ACTIVE validator to bond to (integrator reads the validator set)
  const vals = await getJSON<{ validators: Array<{ address: string; moniker: string; status: string; power: number }> }>("/api/chain/validators");
  const target = vals.validators.find((v) => v.status === "ACTIVE")!;
  console.log(`4. bonding target: ${target.moniker} (${target.status}, power ${target.power})`);

  // 5) client-signed send of 1 MTQD to the validator address
  const sendTx: Omit<Tx, "sig" | "pub_key"> = {
    type: "send", from: myAddr, nonce: afterDrip.nonce + 1, fee: baseFee,
    payload: { to: target.address, asset: "FEE", amount: 1 * MICRO },
  };
  const s1 = await submit(sendTx, key.priv);
  if (!s1.ok) throw new Error(`send rejected: ${s1.error}`);
  console.log(`5. send 1 MTQD → ${target.moniker}: submitted (hash ${s1.hash?.slice(0, 14)}…)`);
  await waitUntil("send inclusion", async () => (await acct(target.address)).fee_u > 0 && (await acct(myAddr)).nonce > afterDrip.nonce);
  const afterSend = await acct(myAddr);
  console.log(`   receipt confirmed · nonce now ${afterSend.nonce}\n`);

  // 6) delegate 0.5 MTQD
  const delTx: Omit<Tx, "sig" | "pub_key"> = {
    type: "delegate", from: myAddr, nonce: afterSend.nonce + 1, fee: baseFee,
    payload: { validator: target.address, amount: Math.floor(0.5 * MICRO) },
  };
  const s2 = await submit(delTx, key.priv);
  if (!s2.ok) throw new Error(`delegate rejected: ${s2.error}`);
  await waitUntil("delegate inclusion", async () => (await acct(myAddr)).bonded_u >= Math.floor(0.5 * MICRO));
  const afterBond = await acct(myAddr);
  console.log(`6. delegate 0.5 MTQD → bonded_u=${afterBond.bonded_u / MICRO} MTQD (voting power ≈ ${Math.floor(afterBond.bonded_u / 100_000)})`);

  // 7) undelegate 0.25 MTQD → UNBONDING QUEUE
  const undelTx: Omit<Tx, "sig" | "pub_key"> = {
    type: "undelegate", from: myAddr, nonce: afterBond.nonce + 1, fee: baseFee,
    payload: { validator: target.address, amount: Math.floor(0.25 * MICRO) },
  };
  const s3 = await submit(undelTx, key.priv);
  if (!s3.ok) throw new Error(`undelegate rejected: ${s3.error}`);
  await waitUntil("undelegate inclusion", async () => (await acct(myAddr)).unbonding_u > 0);
  const queued = await acct(myAddr);
  console.log(`7. undelegate 0.25 MTQD →`);
  console.log(`   bonded_u   = ${queued.bonded_u / MICRO} MTQD (power DROPPED immediately)`);
  console.log(`   unbonding  = ${queued.unbonding_u / MICRO} MTQD · releases in ~${Math.round(queued.unbondings[0]?.release_in_ms / 1000)}s (queue)`);
  console.log(`   balance    = ${queued.fee_u / MICRO} MTQD (NOT yet credited — time-locked)\n`);

  // 8) wait for maturity + auto-release (no claim tx — end-of-block processor credits it)
  const waitMs = (queued.unbondings[0]?.release_in_ms ?? 0) + 8000;
  console.log(`8. waiting ${Math.round(waitMs / 1000)}s for unbonding maturity + next block…`);
  await sleep(waitMs);
  const released = await acct(myAddr);
  const feeBefore = queued.fee_u;
  const feeAfter = released.fee_u;
  console.log(`   unbonding_u after = ${released.unbonding_u / MICRO} (expect 0 — auto-claimed)`);
  console.log(`   balance: ${feeBefore / MICRO} → ${feeAfter / MICRO} MTQD (released +${(feeAfter - feeBefore) / MICRO})`);
  if (released.unbonding_u !== 0) throw new Error("unbonding entry not released");
  if (feeAfter - feeBefore !== Math.floor(0.25 * MICRO)) throw new Error(`release amount wrong: ${feeAfter - feeBefore}`);

  console.log("\nDEVKIT EXAMPLE PASS ✅ — keygen → address → faucet → signed send → delegate → undelegate → unbonding queue → auto-release (public HTTP only)");
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
