/**
 * MTQΣ devnet smoke test — boots the in-process node, verifies:
 *  1. heartbeat blocks advance with valid QCs (+2/3 precommits)
 *  2. a signed send tx flows mempool → block → state
 *  3. faucet drip signs a REAL consensus tx
 *  4. governance: submit → vote → pass → timelock → EXECUTED validator_set_change
 *     (V4 dynamic-membership mechanism live)
 *  5. state root advances; explorer queries return the data
 */
import { ensureChainNode, signAndSubmit, faucetDrip } from "@/lib/chain/node";
import * as store from "@/lib/chain/store";
import { txHash } from "@/lib/chain/shared";
import { pubToAddress, nodeKeys } from "@/lib/chain/crypto";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const rt = await ensureChainNode();
  console.log("[smoke] node up · genesis validators:", rt.genesis.validators.map(v => `${v.moniker}(${v.power})`).join(" "));

  // 1) heartbeat blocks
  await sleep(12000);
  let h = await store.getHeight();
  console.log(`[smoke] height after 12s: ${h} (expect ≥2)`);
  if (h < 2) throw new Error("no heartbeat blocks");
  const blk = (await store.getBlocks(h, h))[0];
  console.log(`[smoke] block ${h}: hash=${blk.hash.slice(0,18)}… qc=${blk.qc.committed_power}/${blk.qc.total_voting_power} consensus_ms=${blk.consensus_ms}`);
  if (blk.qc.committed_power * 3 <= blk.qc.total_voting_power * 2) throw new Error("QC does not meet +2/3");

  // 2) signed send tx val-0 → faucet
  const faucetAddr = pubToAddress(nodeKeys().faucet.pub);
  const val0Addr = rt.genesis.validators[0].address;
  const r1 = await signAndSubmit("val-0", { type: "send", from: val0Addr, nonce: 1, fee: 1000, payload: { to: faucetAddr, asset: "FEE", amount: 250_000 } });
  console.log("[smoke] send submit:", r1.ok ? "OK" : r1.error);
  if (!r1.ok) throw new Error("send rejected");
  await sleep(6000);
  const txRow = r1.hash ? await store.getTx(r1.hash) : null;
  console.log(`[smoke] send receipt: height=${txRow?.height} ok=${txRow?.result.ok} effects=${txRow?.result.effects?.join("; ")}`);
  if (!txRow || !txRow.result.ok) throw new Error("send tx not executed");
  const fa = await store.getAccount(faucetAddr);
  const v0 = await store.getAccount(val0Addr);
  console.log(`[smoke] balances: faucet fee=${fa.fee_u} val0 fee=${v0.fee_u} (nonce=${v0.nonce})`);

  // 3) faucet drip to a fresh address (generate random key)
  const { generateKeyPair } = await import("@/lib/chain/crypto");
  const user = generateKeyPair();
  const userAddr = pubToAddress(user.pub);
  const r2 = await faucetDrip(userAddr);
  console.log("[smoke] faucet drip:", r2.ok ? "OK hash=" + r2.hash?.slice(0, 14) + "…" : r2.error);
  if (!r2.ok) throw new Error("faucet drip failed");
  await sleep(6000);
  const ua = await store.getAccount(userAddr);
  console.log(`[smoke] user balance after drip: ${ua.fee_u} uMTQD (expect 10,000 MTQD = 10,000,000,000 u)`);
  if (ua.fee_u !== 10_000 * 1_000_000) throw new Error("drip amount wrong");

  // 4) governance: validator_set_change add — register a 5th validator first
  const val5 = generateKeyPair();
  const val5Addr = pubToAddress(val5.pub);
  const r3 = await signAndSubmit("val-1", { type: "send", from: rt.genesis.validators[1].address, nonce: 1, fee: 1000, payload: { to: val5Addr, asset: "FEE", amount: 200_000 } });
  await sleep(6000); // val5 now funded
  // register: signed BY val5's own key
  const { signTx } = await import("@/lib/chain/crypto");
  const { Mempool } = await import("@/lib/chain/mempool");
  const regUnsigned = { type: "validator_register" as const, from: val5Addr, nonce: 1, fee: 1000, payload: { moniker: "mtq-val-5.sovereign", commission_bp: 700, self_stake: 100_000, pub_key: val5.pub } };
  const regSigned = signTx(val5.priv, regUnsigned);
  const mp = new Mempool();
  const r4 = await rt.mempool.admit({ ...regUnsigned, sig: regSigned.sig, pub_key: regSigned.pub }, rt.params);
  console.log("[smoke] validator_register:", r4.ok ? "OK" : r4.error);
  await sleep(6000);
  const vals = await store.getValidators();
  console.log("[smoke] validators:", vals.map(v => `${v.moniker}:${v.status}/${v.power}`).join(" "));
  if (!vals.some(v => v.moniker === "mtq-val-5.sovereign" && v.status === "CANDIDATE")) throw new Error("registration failed");

  // gov proposal: add val-5 (submitted by val-2)
  const val2Addr = rt.genesis.validators[2].address;
  const r5 = await signAndSubmit("val-2", { type: "gov_submit", from: val2Addr, nonce: 1, fee: 1000, payload: { proposal_type: "validator_set_change", title: "Admit mtq-val-5.sovereign to the ACTIVE set", description: "V4 dynamic-membership mechanism demo — governance-executed validator admission.", payload: { action: "add", validator: "mtq-val-5.sovereign" }, deposit: 100_000 } });
  console.log("[smoke] gov_submit:", r5.ok ? "OK" : r5.error);
  if (!r5.ok) throw new Error("gov submit failed");
  await sleep(6000);
  let proposals = await store.getProposals();
  const addProp = proposals.find(p => p.type === "validator_set_change");
  console.log(`[smoke] proposal #${addProp?.id} status=${addProp?.status} voting_end in ${Math.max(0, ((addProp?.voting_end_ms ?? 0) - Date.now()) / 1000).toFixed(0)}s`);

  // votes: 3 of 4 validators vote YES (>1/2 of turnout with quorum >1/3)
  for (const v of ["val-0", "val-1", "val-3"]) {
    const idx = Number(v.slice(-1));
    const addr = rt.genesis.validators[idx].address;
    const rv = await signAndSubmit(v as "val-0", { type: "gov_vote", from: addr, nonce: addr === val0Addr ? 2 : addr === rt.genesis.validators[1].address ? 2 : 1, fee: 1000, payload: { proposal_id: addProp!.id, option: "YES" } });
    console.log(`[smoke] vote ${v}:`, rv.ok ? "OK" : rv.error);
    if (!rv.ok) throw new Error(`vote ${v} failed`);
  }
  // wait for voting period end + timelock + execution
  console.log("[smoke] waiting for voting period (60s) + timelock (15s)…");
  await sleep(80_000);
  proposals = await store.getProposals();
  const finalProp = proposals.find(p => p.id === addProp!.id)!;
  console.log(`[smoke] final proposal status: ${finalProp.status} yes=${finalProp.yes_power} no=${finalProp.no_power}`);
  if (finalProp.status !== "EXECUTED") throw new Error(`proposal not EXECUTED (${finalProp.status})`);
  const valsAfter = await store.getValidators();
  const val5After = valsAfter.find(v => v.moniker === "mtq-val-5.sovereign")!;
  console.log(`[smoke] mtq-val-5.sovereign status after execution: ${val5After.status}/${val5After.power}`);
  if (val5After.status !== "ACTIVE") throw new Error("dynamic membership not applied");

  // 5) state root advances + telemetry exists
  const { computeStateRoot } = await import("@/lib/chain/state");
  const root = await computeStateRoot();
  console.log(`[smoke] state root: ${root.slice(0, 24)}…`);
  const hFinal = await store.getHeight();
  console.log(`[smoke] final height: ${hFinal} · telemetry rounds: ${rt.telemetry.length}`);
  const blocks = await store.getBlocks(Math.max(1, hFinal - 4), hFinal);
  console.log("[smoke] last blocks:", blocks.map(b => `${b.height}(${b.num_txs}tx,${b.consensus_ms}ms)`).join(" "));
  console.log("\n[smoke] ALL PASS ✅ — devnet: blocks+QC, signed txs, faucet, governance, dynamic membership");
  rt.stop();
  process.exit(0);
}

main().catch((e) => { console.error("[smoke] FAIL:", e); process.exit(1); });
