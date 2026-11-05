// MTQΣ Network — Sovereign Devnet state machine (deterministic apply layer)
//
// applyBlock() is the ONLY way state advances: a Block with a valid QC is
// applied tx-by-tx, each tx re-validated against the CURRENT state (mempool
// validation is advisory; consensus-state validation is authoritative — a
// tx that fails here is included with a FAILED receipt, exactly like an
// EVM reverted tx, never silently dropped).
//
// Modules: bank (send), staking (register/delegate/undelegate + time-locked
// unbonding queue), gov (submit/vote + end-of-block proposal processing +
// timelocked execution), plus per-block unbonding maturation, validator power
// recomputation and the flat state root.
//
// Constitutional guard: gov proposal payloads touching MTQ monetary
// registry territory are rejected at SUBMISSION (see shared.ts) — network
// governance cannot acquire MTQ monetary-governance authority (Part 2).

import {
  CHAIN_ID,
  DEFAULT_CHAIN_PARAMS,
  NETWORK_PARAM_ALLOWLIST,
  violatesMonetaryGuard,
  type Block,
  type ChainParams,
  type GovProposal,
  type Tx,
  type Validator,
  type VoteOption,
} from "./shared";
import { verifyTx } from "./crypto";
import * as store from "./store";

export interface ApplyResult {
  ok: boolean;
  error?: string;
  effects: string[];
}

// ─── per-tx execution ────────────────────────────────────────────────────────

async function chargeFee(from: string, fee: number, params: ChainParams): Promise<string | null> {
  if (fee < params.base_fee_u) return `fee ${fee} below base fee ${params.base_fee_u}`;
  const acct = await store.getAccount(from);
  if (acct.fee_u < fee) return `insufficient fee balance (${acct.fee_u} < ${fee})`;
  await store.executeAccountUpdate(from, { fee_u: acct.fee_u - fee, nonce: acct.nonce });
  return null;
}

async function applySend(tx: Tx, effects: string[]): Promise<string | null> {
  const to = String(tx.payload.to ?? "");
  const asset = tx.payload.asset === "PMTQ" ? "PMTQ" : "FEE";
  const amount = Number(tx.payload.amount ?? 0);
  if (!to.startsWith("mtq1") || to.length !== 44) return "invalid recipient address";
  if (!Number.isInteger(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER) return "invalid amount";
  const from = await store.getAccount(tx.from);
  const balance = asset === "PMTQ" ? from.pmtq_u : from.fee_u;
  if (balance < amount) return `insufficient ${asset} balance (${balance} < ${amount})`;
  await store.ensureAccount(to);
  const toAcct = await store.getAccount(to);
  if (asset === "PMTQ") {
    await store.executeAccountUpdate(tx.from, { pmtq_u: from.pmtq_u - amount });
    await store.executeAccountUpdate(to, { pmtq_u: toAcct.pmtq_u + amount });
  } else {
    await store.executeAccountUpdate(tx.from, { fee_u: from.fee_u - amount });
    await store.executeAccountUpdate(to, { fee_u: toAcct.fee_u + amount });
  }
  effects.push(`bank.send ${amount / 1e6} ${asset === "PMTQ" ? "PMTQ (pilot-mirror)" : "MTQD"} → ${to.slice(0, 14)}…`);
  return null;
}

async function applyValidatorRegister(tx: Tx, height: number, effects: string[]): Promise<string | null> {
  const moniker = String(tx.payload.moniker ?? "").trim();
  const commissionBp = Number(tx.payload.commission_bp ?? 0);
  const selfStake = Number(tx.payload.self_stake ?? 0);
  const pubKey = String(tx.payload.pub_key ?? "");
  if (moniker.length < 3 || moniker.length > 40) return "moniker must be 3-40 chars";
  if (!Number.isInteger(commissionBp) || commissionBp < 0 || commissionBp > 2000) return "commission_bp out of range [0, 2000]";
  if (!/^[0-9a-f]{64}$/.test(pubKey)) return "pub_key must be 32-byte hex";
  if (pubKey !== tx.pub_key) return "registered pubkey must equal tx signer pubkey";
  if (!Number.isInteger(selfStake) || selfStake < 10_000) return "self_stake minimum is 10,000 uMTQD";
  const acct = await store.getAccount(tx.from);
  if (acct.fee_u < selfStake) return "insufficient balance for self-stake";
  const existing = (await store.getValidators()).find((v) => v.pub_key === pubKey || v.address === tx.from);
  if (existing) return "validator already registered";
  await store.executeAccountUpdate(tx.from, { fee_u: acct.fee_u - selfStake });
  await store.putValidator({
    pub_key: pubKey,
    address: tx.from,
    moniker,
    power: 0, // CANDIDATE: joins ACTIVE set only via governance (V4 dynamic membership)
    commission_bp: commissionBp,
    status: "CANDIDATE",
    self_stake: selfStake,
    delegated: 0,
    joined_height: height,
  });
  effects.push(`staking.validator_register "${moniker}" self-stake ${selfStake / 1e6} MTQD → CANDIDATE (needs governance admission)`);
  return null;
}

async function applyDelegate(tx: Tx, height: number, effects: string[]): Promise<string | null> {
  const validatorAddr = String(tx.payload.validator ?? "");
  const amount = Number(tx.payload.amount ?? 0);
  if (!Number.isInteger(amount) || amount <= 0) return "invalid amount";
  const val = (await store.getValidators()).find((v) => v.address === validatorAddr);
  if (!val) return "unknown validator";
  if (val.status !== "ACTIVE" && val.status !== "CANDIDATE") return `validator not bondable (${val.status})`;
  const acct = await store.getAccount(tx.from);
  if (acct.fee_u < amount) return "insufficient fee balance to bond";
  await store.executeAccountUpdate(tx.from, { fee_u: acct.fee_u - amount });
  await store.putStake(tx.from, validatorAddr, amount, height);
  await store.putValidator({ ...val, delegated: val.delegated + amount });
  effects.push(`staking.delegate ${amount / 1e6} MTQD → ${val.moniker}`);
  return null;
}

async function applyUndelegate(tx: Tx, height: number, params: ChainParams, effects: string[]): Promise<string | null> {
  const validatorAddr = String(tx.payload.validator ?? "");
  const amount = Number(tx.payload.amount ?? 0);
  if (!Number.isInteger(amount) || amount <= 0) return "invalid amount";
  const val = (await store.getValidators()).find((v) => v.address === validatorAddr);
  if (!val) return "unknown validator";
  const stakes = (await store.getStakes(tx.from, validatorAddr)).filter((s) => s.amount_u > 0);
  const bonded = stakes.reduce((s, x) => s + x.amount_u, 0);
  if (bonded < amount) return `unbond amount exceeds bonded (${bonded} < ${amount})`;
  let left = amount;
  for (const s of stakes) {
    if (left <= 0) break;
    const take = Math.min(s.amount_u, left);
    left -= take;
    await store.updateStakeAmount(s.id, s.amount_u - take);
  }
  // self-stake unbond
  if (left > 0) {
    await store.putValidator({ ...val, self_stake: Math.max(0, val.self_stake - left) });
    left = 0;
  }
  // Voting power drops NOW (validator.delegated reduced; end-of-block
  // recompute) — funds return via the time-locked unbonding queue.
  const fresh = (await store.getValidators()).find((v) => v.address === validatorAddr)!;
  const newDel = Math.max(0, fresh.delegated - Math.min(amount, val.delegated));
  await store.putValidator({ ...fresh, delegated: newDel });
  if (params.unbonding_s > 0) {
    const releaseMs = Date.now() + params.unbonding_s * 1000;
    await store.putUnbonding(tx.from, validatorAddr, amount, height, releaseMs);
    effects.push(`staking.undelegate ${amount / 1e6} MTQD ← ${val.moniker} → unbonding queue (power dropped now; funds release in ${params.unbonding_s}s)`);
  } else {
    // unbonding_s = 0 (governance-set): immediate release — legacy path
    const acct = await store.getAccount(tx.from);
    await store.executeAccountUpdate(tx.from, { fee_u: acct.fee_u + amount });
    effects.push(`staking.undelegate ${amount / 1e6} MTQD ← ${val.moniker} (unbonding_s=0 — immediate release)`);
  }
  return null;
}

async function applyGovSubmit(tx: Tx, height: number, params: ChainParams, effects: string[]): Promise<string | null> {
  const proposalType = String(tx.payload.proposal_type ?? "");
  const title = String(tx.payload.title ?? "").trim();
  const description = String(tx.payload.description ?? "").trim();
  const payload = (tx.payload.payload ?? {}) as Record<string, unknown>;
  const deposit = Number(tx.payload.deposit ?? 0);
  if (!["text", "network_param", "validator_set_change"].includes(proposalType)) return "unknown proposal type";
  if (title.length < 4 || title.length > 120) return "title must be 4-120 chars";
  if (description.length > 2000) return "description too long";
  if (!Number.isInteger(deposit) || deposit < 100_000) return "minimum governance deposit is 100,000 uMTQD";
  const acct = await store.getAccount(tx.from);
  if (acct.fee_u < deposit) return "insufficient balance for deposit";

  if (proposalType === "network_param") {
    const key = String(payload.key ?? "");
    const value = Number(payload.value ?? NaN);
    const allow = NETWORK_PARAM_ALLOWLIST[key];
    if (!allow) return `param "${key}" is not in the network allowlist`;
    if (violatesMonetaryGuard(key)) return `param "${key}" touches MTQ monetary registry — constitutionally forbidden (Part 2)`;
    if (!Number.isFinite(value) || value < allow.min || value > allow.max) {
      return `param value out of bounds [${allow.min}, ${allow.max}]`;
    }
  }
  if (proposalType === "validator_set_change") {
    const action = String(payload.action ?? "");
    if (!["add", "remove", "repower"].includes(action)) return "action must be add | remove | repower";
    if (action === "add") {
      const target = String(payload.validator ?? "");
      const val = (await store.getValidators()).find((v) => v.address === target || v.moniker === target);
      if (!val) return "add: validator must be registered (CANDIDATE) first";
      if (val.status !== "CANDIDATE") return "add: validator is not a CANDIDATE";
    } else {
      const target = String(payload.validator ?? "");
      const val = (await store.getValidators()).find((v) => v.address === target || v.moniker === target);
      if (!val || val.status !== "ACTIVE") return `${action}: target must be an ACTIVE validator`;
      if (action === "repower") {
        const power = Number(payload.power ?? NaN);
        if (!Number.isInteger(power) || power < 0 || power > 100) return "repower: power must be integer [0,100]";
      }
    }
  }

  await store.executeAccountUpdate(tx.from, { fee_u: acct.fee_u - deposit });
  const now = Date.now();
  const proposal: GovProposal = {
    id: await store.nextProposalId(),
    type: proposalType as GovProposal["type"],
    title,
    description,
    proposer: tx.from,
    status: "VOTING",
    submitted_height: height,
    voting_end_ms: now + params.voting_period_s * 1000,
    execute_after_ms: now + params.voting_period_s * 1000 + params.timelock_s * 1000,
    executed_height: null,
    payload,
    deposit,
    yes_power: 0,
    no_power: 0,
    abstain_power: 0,
  };
  await store.putProposal(proposal);
  effects.push(`gov.submit #${proposal.id} [${proposalType}] "${title}" deposit ${deposit / 1e6} MTQD`);
  return null;
}

async function applyGovVote(tx: Tx, height: number, effects: string[]): Promise<string | null> {
  const proposalId = Number(tx.payload.proposal_id ?? NaN);
  const option = String(tx.payload.option ?? "");
  if (!Number.isInteger(proposalId)) return "invalid proposal_id";
  if (!["YES", "NO", "ABSTAIN"].includes(option)) return "option must be YES | NO | ABSTAIN";
  const proposal = (await store.getProposals()).find((p) => p.id === proposalId);
  if (!proposal) return "unknown proposal";
  if (proposal.status !== "VOTING") return `proposal not in voting period (${proposal.status})`;
  // Voting power = bond to any validator + validator self-power. Wallet users
  // vote with their bonded stake (one account, one vote — final power).
  const stakes = await store.getStakes(tx.from);
  const bonded = stakes.reduce((s, x) => s + x.amount_u, 0);
  const asValidator = (await store.getValidators()).find((v) => v.address === tx.from);
  const power = Math.floor(bonded / 100_000) + (asValidator && asValidator.status === "ACTIVE" ? asValidator.power : 0);
  if (power <= 0) return "no voting power (bond ≥ 0.1 MTQD or be an ACTIVE validator)";
  await store.putVote(proposalId, tx.from, option, power, height);
  const delta = option === "YES" ? { yes_power: power } : option === "NO" ? { no_power: power } : { abstain_power: power };
  const prev = await store.getVotes(proposalId);
  // Recount from votes (source of truth) — idempotent per voter.
  const yes = prev.filter((v) => v.option === "YES").reduce((s, v) => s + v.power, 0);
  const no = prev.filter((v) => v.option === "NO").reduce((s, v) => s + v.power, 0);
  const abstain = prev.filter((v) => v.option === "ABSTAIN").reduce((s, v) => s + v.power, 0);
  await store.putProposal({ ...proposal, yes_power: yes, no_power: no, abstain_power: abstain });
  effects.push(`gov.vote #${proposalId} ${option} (+${power} power)`);
  void delta;
  return null;
}

export async function applyTx(tx: Tx, height: number, params: ChainParams): Promise<ApplyResult> {
  const effects: string[] = [];
  // 1) signature + address binding
  if (!verifyTx(tx)) return { ok: false, error: "invalid ed25519 signature or address/pubkey mismatch", effects };
  // 2) nonce (strictly +1 over account)
  const acct = await store.getAccount(tx.from);
  if (tx.nonce !== acct.nonce + 1) return { ok: false, error: `nonce ${tx.nonce} != expected ${acct.nonce + 1}`, effects };
  // 3) fee
  const feeErr = await chargeFee(tx.from, tx.fee, params);
  if (feeErr) return { ok: false, error: feeErr, effects };
  // 4) nonce advance (tx is now consuming its slot even if module rejects)
  const afterFee = await store.getAccount(tx.from);
  await store.executeAccountUpdate(tx.from, { nonce: afterFee.nonce + 1 });
  // 5) module
  let err: string | null = null;
  switch (tx.type) {
    case "send": err = await applySend(tx, effects); break;
    case "validator_register": err = await applyValidatorRegister(tx, height, effects); break;
    case "delegate": err = await applyDelegate(tx, height, effects); break;
    case "undelegate": err = await applyUndelegate(tx, height, params, effects); break;
    case "gov_submit": err = await applyGovSubmit(tx, height, params, effects); break;
    case "gov_vote": err = await applyGovVote(tx, height, effects); break;
    default: err = `unknown tx type ${tx.type}`;
  }
  return err ? { ok: false, error: err, effects } : { ok: true, effects };
}

// ─── end-of-block processing ────────────────────────────────────────────────

export async function processBlockEnd(height: number, params: ChainParams, proposer?: string): Promise<string[]> {
  const effects: string[] = [];
  const proposals = await store.getProposals();
  const validators = await store.getValidators();
  const totalPower = validators.filter((v) => v.status === "ACTIVE").reduce((s, v) => s + v.power, 0);

  // 0) unbonding queue maturation — mature entries auto-claim to balance.
  // The CLAIM runs first through the atomic guarded UPDATE; only the winner
  // credits the funds (concurrent writers can never double-release).
  const mature = await store.getMatureUnbondings(Date.now());
  for (const u of mature) {
    const won = await store.markUnbondingClaimed(u.id, height);
    if (!won) continue; // already claimed by a concurrent processor
    const acct = await store.getAccount(u.delegator);
    await store.executeAccountUpdate(u.delegator, { fee_u: acct.fee_u + u.amount_u });
    await store.putEvent(height, "staking.unbond_released", { id: u.id, delegator: u.delegator, validator: u.validator, amount_u: u.amount_u }, Date.now());
    effects.push(`staking.unbond_released ${u.amount_u / 1e6} MTQD → ${u.delegator.slice(0, 14)}… (queued @ h${u.created_height}, released @ h${height})`);
  }

  // 1) close voting periods
  for (const p of proposals) {
    if (p.status === "VOTING" && Date.now() >= p.voting_end_ms) {
      const voted = p.yes_power + p.no_power + p.abstain_power;
      const quorum = totalPower > 0 ? voted * 3 > totalPower : false; // turnout > 1/3
      const passed = quorum && p.yes_power * 2 > voted; // strict majority of turnout
      await store.putProposal({ ...p, status: passed ? "PASSED" : "REJECTED" });
      effects.push(`gov.close #${p.id} ${passed ? "PASSED" : "REJECTED"} (yes ${p.yes_power} · no ${p.no_power} · abstain ${p.abstain_power} · turnout ${voted}/${totalPower})`);
    }
    // 2) execute timelocked PASSED proposals
    if (p.status === "PASSED" && Date.now() >= p.execute_after_ms) {
      const execErr = await executeProposal(p, height, params, validators);
      await store.putProposal({ ...p, status: execErr ? "FAILED_EXECUTION" : "EXECUTED", executed_height: height });
      effects.push(`gov.execute #${p.id} ${execErr ? `FAILED: ${execErr}` : "EXECUTED"}`);
    }
    if (p.status === "EXECUTION_QUEUED" && Date.now() >= p.execute_after_ms) {
      // legacy state path — execute as well
      const execErr = await executeProposal(p, height, params, validators);
      await store.putProposal({ ...p, status: execErr ? "FAILED_EXECUTION" : "EXECUTED", executed_height: height });
      effects.push(`gov.execute #${p.id} ${execErr ? `FAILED: ${execErr}` : "EXECUTED"}`);
    }
  }

  // 3) recompute validator voting power from bonded amounts (integer micro-MTQD → power units)
  for (const v of validators) {
    if (v.status !== "ACTIVE" && v.status !== "CANDIDATE") continue;
    const power = Math.floor((v.self_stake + v.delegated) / 100_000); // 0.1 MTQD = 1 power
    if (v.power !== power || (v.status === "ACTIVE" && power === 0)) {
      await store.putValidator({ ...v, power });
    }
  }
  // An ACTIVE validator whose power drops to 0 loses consensus participation.

  // 4) Network economics — block rewards (DEFAULT OFF, Task-42).
  // Machinery per the Network Economics Specification DRAFT
  // (docs/NETWORK-ECONOMICS-SPEC-DRAFT.md): pays uMTQD testnet credit from
  // the devnet treasury (the faucet account) to the block proposer (20% cut)
  // + all ACTIVE validators pro-rata by voting power over the remaining 80%,
  // with rounding dust flowing to the proposer (deterministic, no dust loss).
  // Runs only when rewards_enabled=1 AND block_reward_u>0 — the shipped
  // default is OFF; activation is dual-gated (owner ratification of the DRAFT
  // + governance vote on rewards_enabled). MTQΣ supply is constitutionally
  // untouched: rewards are uMTQD network credit, never the monetary asset.
  // Distribution uses the post-recompute ACTIVE set — the validators that
  // closed this block (documented in the DRAFT §4).
  if (params.rewards_enabled === 1 && params.block_reward_u > 0) {
    const rewardEffects = await distributeBlockReward(height, params, proposer ?? null);
    effects.push(...rewardEffects);
  }
  return effects;
}

/** Distribute the per-block reward (integer micro-units, fail-closed on an
 * insufficient treasury — never partial). Pure bookkeeping in the shared
 * state store; emits an econ.block_reward event with the full payout record. */
async function distributeBlockReward(
  height: number,
  params: ChainParams,
  proposer: string | null,
): Promise<string[]> {
  const out: string[] = [];
  const treasury = await store.getMeta("treasury_address");
  if (!treasury) {
    await store.putEvent(height, "econ.reward_skipped", { reason: "treasury_address meta not provisioned" }, Date.now());
    out.push("econ.reward_skipped: treasury not provisioned (node boot sets it)");
    return out;
  }
  const R = params.block_reward_u;
  const tAcct = await store.getAccount(treasury);
  if (tAcct.fee_u < R) {
    // fail-closed: never pay partially, never borrow — event + skip
    await store.putEvent(height, "econ.rewards_exhausted", { treasury, attempted_u: R, available_u: tAcct.fee_u }, Date.now());
    out.push(`econ.rewards_exhausted: treasury ${tAcct.fee_u} < ${R} uMTQD — reward skipped (fail-closed)`);
    return out;
  }
  const active = (await store.getValidators()).filter((v) => v.status === "ACTIVE" && v.power > 0);
  const totalPower = active.reduce((s, v) => s + v.power, 0);
  if (totalPower <= 0) {
    await store.putEvent(height, "econ.reward_skipped", { reason: "no ACTIVE voting power" }, Date.now());
    out.push("econ.reward_skipped: no ACTIVE voting power to distribute to");
    return out;
  }
  // proposer 20% cut (floor), remainder pro-rata by power, dust → proposer
  const proposerCut = Math.floor(R / 5);
  const base = R - proposerCut;
  let paid = 0;
  for (const v of active) {
    const share = Math.floor((base * v.power) / totalPower);
    if (share <= 0) continue;
    const acct = await store.getAccount(v.address);
    await store.executeAccountUpdate(v.address, { fee_u: acct.fee_u + share });
    paid += share;
  }
  const proposerShare = R - paid; // proposerCut + all floor-rounding dust
  if (proposerShare > 0) {
    if (proposer && active.some((v) => v.address === proposer)) {
      const acct = await store.getAccount(proposer);
      await store.executeAccountUpdate(proposer, { fee_u: acct.fee_u + proposerShare });
      paid += proposerShare;
    } else {
      // no recorded proposer in the ACTIVE set: dust stays in the treasury
      // (documented burn rule — deterministic, no invention)
      await store.putEvent(height, "econ.reward_dust_burned", { amount_u: proposerShare, reason: "proposer not in ACTIVE set" }, Date.now());
      out.push(`econ.reward_dust_burned ${proposerShare} uMTQD → treasury (proposer not in ACTIVE set)`);
    }
  }
  const tAfter = await store.getAccount(treasury);
  await store.executeAccountUpdate(treasury, { fee_u: tAfter.fee_u - paid });
  await store.putEvent(
    height,
    "econ.block_reward",
    { amount_u: paid, r_u: R, proposer, proposer_share_u: proposerShare, recipients: active.length, treasury, total_power: totalPower },
    Date.now(),
  );
  out.push(`econ.block_reward ${paid / 1e6} MTQD ← treasury → proposer cut ${proposerShare / 1e6} + ${active.length} ACTIVE validators (pro-rata by power)`);
  return out;
}

async function executeProposal(
  p: GovProposal,
  height: number,
  params: ChainParams,
  validators: Validator[],
): Promise<string | null> {
  if (p.type === "text") {
    await store.putEvent(height, "gov.text_executed", { id: p.id, title: p.title }, Date.now());
    return null;
  }
  if (p.type === "network_param") {
    const key = String(p.payload.key ?? "");
    const value = Number(p.payload.value ?? NaN);
    const allow = NETWORK_PARAM_ALLOWLIST[key];
    if (!allow || !Number.isFinite(value) || value < allow.min || value > allow.max) {
      return "param no longer valid at execution time";
    }
    const next = { ...params, [key]: value } as ChainParams;
    await store.saveParams(next);
    await store.putEvent(height, "gov.param_change", { id: p.id, key, value }, Date.now());
    return null;
  }
  if (p.type === "validator_set_change") {
    const action = String(p.payload.action ?? "");
    const target = String(p.payload.validator ?? "");
    const val = validators.find((v) => v.address === target || v.moniker === target);
    if (!val) return "validator not found at execution time";
    if (action === "add") {
      if (val.status !== "CANDIDATE") return "target is not CANDIDATE";
      await store.putValidator({ ...val, status: "ACTIVE" });
      await store.putEvent(height, "gov.validator_added", { id: p.id, validator: val.moniker, address: val.address }, Date.now());
      return null;
    }
    if (action === "remove") {
      if (val.status !== "ACTIVE") return "target is not ACTIVE";
      await store.putValidator({ ...val, status: "RETIRED", power: 0 });
      await store.putEvent(height, "gov.validator_removed", { id: p.id, validator: val.moniker, address: val.address }, Date.now());
      return null;
    }
    if (action === "repower") {
      const power = Number(p.payload.power ?? NaN);
      if (!Number.isInteger(power) || power < 0 || power > 100) return "invalid power";
      await store.putValidator({ ...val, power, status: val.status === "CANDIDATE" && power > 0 ? "ACTIVE" : val.status });
      await store.putEvent(height, "gov.validator_repowered", { id: p.id, validator: val.moniker, power }, Date.now());
      return null;
    }
    return "unknown action";
  }
  return "unexecutable proposal type";
}

// ─── state root ──────────────────────────────────────────────────────────────
// Flat cryptographic commitment over the full canonical state (accounts,
// validators, stakes, proposals, params). Simplification vs a merkle-trie —
// documented in NETWORK-DESIGN-DECISION.md; it is still a complete,
// deterministic, verifiable commitment.

export async function computeStateRoot(): Promise<string> {
  const { createHash } = await import("node:crypto");
  const accounts = await store.chainDb().execute("SELECT address, nonce, fee_u, pmtq_u FROM accounts ORDER BY address");
  const validators = (await store.getValidators()).map((v) => [v.address, v.status, v.power, v.self_stake, v.delegated]);
  const stakes = await store.getStakes();
  const unbondings = await store.getUnbondings();
  const proposals = (await store.getProposals()).slice(0, 50).map((p) => [p.id, p.status]);
  const params = await store.loadParams(DEFAULT_CHAIN_PARAMS);
  const canonical = JSON.stringify({
    chain_id: CHAIN_ID,
    accounts: accounts.rows.map((r) => [r.address, Number(r.nonce), Number(r.fee_u), Number(r.pmtq_u)]),
    validators,
    stakes: stakes.map((s) => [s.delegator, s.validator, s.amount_u]),
    unbondings: unbondings.map((u) => [u.delegator, u.validator, u.amount_u, u.release_ms]),
    proposals,
    params,
  });
  return "sroot_" + createHash("sha256").update(canonical).digest("hex").slice(0, 48);
}

// ─── block application (consensus entry point) ───────────────────────────────

export async function applyBlock(b: Block): Promise<void> {
  const params = await store.loadParams(DEFAULT_CHAIN_PARAMS);
  const { txHash } = await import("./shared");
  for (let i = 0; i < b.txs.length; i++) {
    const tx = b.txs[i];
    const res = await applyTx(tx, b.header.height, params);
    await store.putTx(txHash(tx), b.header.height, i, tx, { ok: res.ok, error: res.error, effects: res.effects }, b.header.time_ms);
  }
  const endEffects = await processBlockEnd(b.header.height, params, b.header.proposer);
  for (const e of endEffects) {
    await store.putEvent(b.header.height, "gov.processing", { detail: e }, b.header.time_ms);
  }
  if (b.txs.length > 0) {
    await store.putEvent(b.header.height, "block.tx_count", { count: b.txs.length }, b.header.time_ms);
  }
}
