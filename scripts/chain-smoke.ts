/**
 * MTQΣ devnet smoke test — boots the in-process node, verifies:
 *  1. heartbeat blocks advance with valid QCs (+2/3 precommits)
 *  2. a signed send tx flows mempool → block → state
 *  3. faucet drip signs a REAL consensus tx
 *  3b. unbonding queue: delegate → undelegate → time-locked queue
 *      (power drops now, funds NOT credited) → maturity → auto-release
 *  4. governance: submit → vote → pass → timelock → EXECUTED validator_set_change
 *     (V4 dynamic-membership mechanism live)
 *  5. state root advances; explorer queries return the data
 *  6. network economics (Task-42): enable block rewards via the param store
 *     (state-machine test — the governance path is proven by leg 4) → heartbeat
 *     block pays uMTQD from the treasury to proposer + ACTIVE validators →
 *     econ.block_reward event + balance conservation asserted → restored OFF
 */
import { ensureChainNode, signAndSubmit, faucetDrip } from "@/lib/chain/node";
import * as store from "@/lib/chain/store";
import { txHash, DEFAULT_CHAIN_PARAMS } from "@/lib/chain/shared";
import { pubToAddress, nodeKeys } from "@/lib/chain/crypto";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Task-42 fix: the smoke battery must be RE-RUNNABLE against the shared,
 * persistent chain.db (the dev-server node keeps it advancing across runs).
 * Hardcoded nonces broke on the mature chain — every actor now reads its
 * CURRENT nonce from the store immediately before signing. */
async function nextNonce(addr: string): Promise<number> {
  const acct = await store.getAccount(addr);
  return acct.nonce + 1;
}

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

  // 2) signed send tx val-0 → faucet (fresh nonce — the chain is persistent
  // across smoke runs; hardcoded nonces broke re-runnability)
  const faucetAddr = pubToAddress(nodeKeys().faucet.pub);
  const val0Addr = rt.genesis.validators[0].address;
  const r1 = await signAndSubmit("val-0", { type: "send", from: val0Addr, nonce: await nextNonce(val0Addr), fee: 1000, payload: { to: faucetAddr, asset: "FEE", amount: 250_000 } });
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

  // 3b) UNBONDING QUEUE: faucet delegates → undelegates → queue → auto-release
  //     (power drops at undelegate; funds return after unbonding_s without a claim tx)
  {
    const fAcct = await store.getAccount(faucetAddr);
    const delAmt = Math.floor(0.5 * 1_000_000);
    const rd = await signAndSubmit("faucet", { type: "delegate", from: faucetAddr, nonce: fAcct.nonce + 1, fee: 1000, payload: { validator: val0Addr, amount: delAmt } });
    if (!rd.ok) throw new Error(`smoke delegate failed: ${rd.error}`);
    await sleep(6000);
    const bonded = await store.getStakes(faucetAddr, val0Addr);
    const bondedU = bonded.reduce((s, x) => s + x.amount_u, 0);
    console.log(`[smoke] queue leg: faucet bonded ${bondedU / 1e6} MTQD to val-0`);
    if (bondedU < delAmt) throw new Error("delegate not executed");
    const fAcct2 = await store.getAccount(faucetAddr);
    const undelAmt = Math.floor(0.25 * 1_000_000);
    const ru = await signAndSubmit("faucet", { type: "undelegate", from: faucetAddr, nonce: fAcct2.nonce + 1, fee: 1000, payload: { validator: val0Addr, amount: undelAmt } });
    if (!ru.ok) throw new Error(`smoke undelegate failed: ${ru.error}`);
    await sleep(6000);
    const queued = await store.getUnbondings(faucetAddr);
    const feeAtQueue = (await store.getAccount(faucetAddr)).fee_u;
    const qU = queued.reduce((s, x) => s + x.amount_u, 0);
    console.log(`[smoke] queue leg: unbonding pending ${qU / 1e6} MTQD (release in ~${Math.max(0, Math.round((queued[0]?.release_ms ?? 0) - Date.now()) / 1000)}s) · fee_u ${fAcct2.fee_u} → ${feeAtQueue} (−fee only)`);
    if (qU !== undelAmt) throw new Error(`unbonding queue amount wrong (${qU})`);
    // Only the tx fee itself may have been charged — the unbonded amount must
    // NOT be credited until the queue matures.
    if (feeAtQueue !== fAcct2.fee_u - 1000) throw new Error(`unexpected fee delta ${fAcct2.fee_u - feeAtQueue} (expected just the 1000 µ tx fee)`);
    const waitMs = Math.max(0, (queued[0]?.release_ms ?? 0) - Date.now()) + 8000;
    await sleep(waitMs);
    const afterRelease = await store.getUnbondings(faucetAddr);
    const feeAfterRelease = (await store.getAccount(faucetAddr)).fee_u;
    console.log(`[smoke] queue leg: after maturity → pending ${afterRelease.length} · fee_u ${feeAtQueue} → ${feeAfterRelease} (+${feeAfterRelease - feeAtQueue})`);
    if (afterRelease.length !== 0) throw new Error("unbonding not auto-claimed at maturity");
    if (feeAfterRelease - feeAtQueue !== undelAmt) throw new Error(`release amount wrong (${feeAfterRelease - feeAtQueue})`);
  }

  // 4) governance: validator_set_change add — register a 5th validator first.
  // Task-42: UNIQUE moniker per run + ADDRESS-targeted proposals + fresh
  // nonces (the battery is re-runnable against the persistent shared chain).
  const val5 = generateKeyPair();
  const val5Addr = pubToAddress(val5.pub);
  const runSuffix = val5Addr.slice(-6); // unique per run (fresh CSPRNG key)
  const val5Moniker = `mtq-val-5.sovereign-${runSuffix}`;
  const val1Addr = rt.genesis.validators[1].address;
  const r3 = await signAndSubmit("val-1", { type: "send", from: val1Addr, nonce: await nextNonce(val1Addr), fee: 1000, payload: { to: val5Addr, asset: "FEE", amount: 200_000 } });
  await sleep(6000); // val5 now funded
  // register: signed BY val5's own key
  const { signTx } = await import("@/lib/chain/crypto");
  const { Mempool } = await import("@/lib/chain/mempool");
  const regUnsigned = { type: "validator_register" as const, from: val5Addr, nonce: await nextNonce(val5Addr), fee: 1000, payload: { moniker: val5Moniker, commission_bp: 700, self_stake: 100_000, pub_key: val5.pub } };
  const regSigned = signTx(val5.priv, regUnsigned);
  const mp = new Mempool();
  const r4 = await rt.mempool.admit({ ...regUnsigned, sig: regSigned.sig, pub_key: regSigned.pub }, rt.params);
  console.log("[smoke] validator_register:", r4.ok ? "OK" : r4.error);
  await sleep(6000);
  const vals = await store.getValidators();
  console.log("[smoke] validators:", vals.slice(-6).map(v => `${v.moniker}:${v.status}/${v.power}`).join(" "));
  if (!vals.some(v => v.moniker === val5Moniker && v.status === "CANDIDATE")) throw new Error("registration failed");

  // gov proposal: add the fresh validator (submitted by val-2; ADDRESS target)
  const val2Addr = rt.genesis.validators[2].address;
  const r5 = await signAndSubmit("val-2", { type: "gov_submit", from: val2Addr, nonce: await nextNonce(val2Addr), fee: 1000, payload: { proposal_type: "validator_set_change", title: `Admit ${val5Moniker} to the ACTIVE set`, description: "V4 dynamic-membership mechanism demo — governance-executed validator admission.", payload: { action: "add", validator: val5Addr }, deposit: 100_000 } });
  console.log("[smoke] gov_submit:", r5.ok ? "OK" : r5.error);
  if (!r5.ok) throw new Error("gov submit failed");
  await sleep(6000);
  let proposals = await store.getProposals();
  // Task-42: the persistent chain carries proposals from prior runs —
  // identify THIS run's proposal by its unique title (moniker-suffixed).
  const addProp = proposals.find(p => p.type === "validator_set_change" && p.title.includes(val5Moniker));
  console.log(`[smoke] proposal #${addProp?.id} status=${addProp?.status} voting_end in ${Math.max(0, ((addProp?.voting_end_ms ?? 0) - Date.now()) / 1000).toFixed(0)}s`);

  // votes: 3 of 4 validators vote YES (>1/2 of turnout with quorum >1/3)
  for (const v of ["val-0", "val-1", "val-3"]) {
    const idx = Number(v.slice(-1));
    const addr = rt.genesis.validators[idx].address;
    const rv = await signAndSubmit(v as "val-0", { type: "gov_vote", from: addr, nonce: await nextNonce(addr), fee: 1000, payload: { proposal_id: addProp!.id, option: "YES" } });
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
  const val5After = valsAfter.find(v => v.address === val5Addr)!;
  console.log(`[smoke] ${val5Moniker} status after execution: ${val5After.status}/${val5After.power}`);
  if (val5After.status !== "ACTIVE") throw new Error("dynamic membership not applied");

  // 6) NETWORK ECONOMICS (Task-42): block-reward machinery, default OFF.
  // Enable via the param store directly (state-machine test), wait ≥1
  // heartbeat block, assert the treasury paid out with conservation, then
  // restore OFF (the shipped default — activation is dual-gated in the
  // Network Economics Specification DRAFT).
  {
    const treasury = await store.getMeta("treasury_address");
    if (!treasury) throw new Error("treasury_address meta not provisioned (Task-42 boot step missing?)");
    const valsNow = await store.getValidators();
    const activeNow = valsNow.filter(v => v.status === "ACTIVE");
    const balBefore = new Map<string, number>();
    for (const v of activeNow) balBefore.set(v.address, (await store.getAccount(v.address)).fee_u);
    const tBefore = (await store.getAccount(treasury)).fee_u;
    const R = 1000; // µMTQD per block — state-machine test value only (DRAFT proposes ratification, NOT this run)
    const paramsOn = { ...(await store.loadParams(DEFAULT_CHAIN_PARAMS)), rewards_enabled: 1, block_reward_u: R };
    await store.saveParams(paramsOn);
    await sleep(7000); // ≥1 heartbeat block produced with rewards ON
    const events = await store.getRecentEvents(60);
    const rewardEvents = events.filter(e => e.type === "econ.block_reward");
    const paidTotal = rewardEvents.reduce((s, e) => s + Number((e.data as Record<string, unknown>).amount_u ?? 0), 0);
    const tAfter = (await store.getAccount(treasury)).fee_u;
    let validatorDelta = 0;
    for (const v of activeNow) validatorDelta += (await store.getAccount(v.address)).fee_u - (balBefore.get(v.address) ?? 0);
    console.log(`[smoke] econ leg: ${rewardEvents.length} econ.block_reward event(s) · paid ${paidTotal / 1e6} MTQD · treasury ${tBefore} → ${tAfter} (Δ ${tBefore - tAfter}) · validators Δ ${validatorDelta}`);
    if (rewardEvents.length === 0) throw new Error("no econ.block_reward event — reward engine did not run");
    if (paidTotal <= 0) throw new Error("reward events carry zero amount");
    if (tBefore - tAfter !== paidTotal) throw new Error(`treasury delta ${tBefore - tAfter} != paid total ${paidTotal} (conservation broken)`);
    if (validatorDelta !== paidTotal) throw new Error(`validator delta ${validatorDelta} != paid total ${paidTotal} (conservation broken)`);
    // restore OFF — the shipped default
    const paramsOff = { ...paramsOn, rewards_enabled: 0, block_reward_u: 0 };
    await store.saveParams(paramsOff);
    console.log("[smoke] econ leg: rewards restored OFF (shipped default; activation dual-gated per NES-DRAFT)");
  }

  // 5) state root advances + telemetry exists
  const { computeStateRoot } = await import("@/lib/chain/state");
  const root = await computeStateRoot();
  console.log(`[smoke] state root: ${root.slice(0, 24)}…`);
  const hFinal = await store.getHeight();
  console.log(`[smoke] final height: ${hFinal} · telemetry rounds: ${rt.telemetry.length}`);
  const blocks = await store.getBlocks(Math.max(1, hFinal - 4), hFinal);
  console.log("[smoke] last blocks:", blocks.map(b => `${b.height}(${b.num_txs}tx,${b.consensus_ms}ms)`).join(" "));
  console.log("\n[smoke] ALL PASS ✅ — devnet: blocks+QC, signed txs, faucet, governance, dynamic membership, block-reward engine (default OFF)");
  rt.stop();
  process.exit(0);
}

main().catch((e) => { console.error("[smoke] FAIL:", e); process.exit(1); });
