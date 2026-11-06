// MTQΣ Network — Sovereign Devnet RPC surface (in-process)
//
// Pure read/submit functions consumed by /api/chain/* routes. Every metric
// below originates from the actual chain state (db/chain.db + engine
// telemetry) — nothing is synthesized. Honest disclosure payload is
// attached to the summary for the UI to render verbatim.

import { chainNode, chainReady, submitTx, faucetDrip } from "./node";
import * as store from "./store";
import { CHAIN_ID, DEFAULT_CHAIN_PARAMS, ORACLE_MAX_SPREAD_BP, ORACLE_MAX_STALENESS_BLOCKS, ORACLE_MIN_FAMILIES, type GovProposal, type OracleObservation, type OraclePriceRecord, type Tx, type Validator } from "./shared";
import { genesisHash } from "./genesis";
import { pubToAddress } from "./crypto";

export const CHAIN_HONEST_STATUS = {
  status: "REFERENCE DEVNET",
  scope:
    "Single-process in-process reference node: 4 validator ENGINES with real ed25519 keys run the full signed BFT voting protocol over an in-process transport bus; blocks require a genuine +2/3-by-power precommit quorum certificate. All engines are co-located in one process on one host — this provides protocol-logic realism, NOT Byzantine fault tolerance against process compromise, and NO decentralization.",
  separation:
    "Network governance cannot alter MTQ monetary parameters (constitutional guard enforced at proposal submission). MTQΣ is NOT the gas token — fees are paid in uMTQD, a testnet-only credit. PMTQ is a NON-CANONICAL pilot ledger mirror; canonical MTQΣ supply accounting stays in the monetary protocol engine.",
  economics:
    "Staking records bonding + voting power. A block-reward ENGINE is implemented (uMTQD testnet credit paid from the devnet treasury account) per the Network Economics Specification DRAFT — but rewards_enabled is DEFAULT OFF (block_reward_u = 0): no reward is paid anywhere until the owner ratifies the DRAFT values AND network governance votes activation. No MTQΣ inflation ever (constitutional); no slashing implemented in the single-process reference (no honest equivocation evidence can exist in-process — taxonomy documented in the draft); PMTQ/MTQ monetary territory is untouched by network economics.",
  productionPath:
    "Production network path: Cosmos SDK + CometBFT multi-host validator set (docs/NETWORK-DESIGN-DECISION.md). Production authorization for MTQ remains FALSE per the 11 validation gates.",
  transport:
    "API transport: HTTP polling (canonical, every consumer) + an in-process SSE block-event stream (GET /api/chain/stream) for instant refresh — no external message broker, no extra process; SSE is best-effort sugar and every consumer keeps its polling fallback.",
  oracle:
    "Oracle consensus module (§17.10 reference): validator-keyed observations → per-family medians → cross-family median-of-medians, gated by ≥2 independent families, a ≤2% cross-family spread, and ≤6-block freshness (~30 s at the production single-writer heartbeat cadence) — fail-closed on every gate (divergent or single-family data can never move the on-chain price). The reference devnet has NO automatic market feeds: observations arrive ONLY as genuinely signed validator transactions, and their values are operator-submitted test values, NOT market data. Production §17.10 three-family on-chain oracle (Chainlink/Pyth/Chronicle EVM adapters) remains Gate-C-gated; oracle-parameter governance stays in the MTQ monetary track, never network governance.",
  label: "TESTNET-ONLY · REFERENCE DEVNET · NOT DECENTRALIZED · NOT PRODUCTION-AUTHORIZED",
} as const;

export interface ChainSummary {
  ready: boolean;
  chain_id: string;
  chain_id_configured: string;
  height: number;
  latest_block: {
    hash: string;
    time_ms: number;
    txs: number;
    proposer: string | null;
    consensus_ms: number;
    qc_committed_power: number;
    qc_total_power: number;
  } | null;
  validators: {
    active: number;
    total: number;
    total_power: number;
    list: Array<Validator & { is_proposer_next: boolean }>;
  };
  params: typeof DEFAULT_CHAIN_PARAMS;
  mempool_size: number;
  telemetry_recent: Array<{
    height: number;
    round: number;
    proposer: string;
    proposed_at_ms: number | null;
    prevotes: number;
    precommits: number;
    committed_at_ms: number | null;
    consensus_ms: number;
    txs: number;
  }>;
  genesis_hash: string;
  booted_at_ms: number;
  uptime_ms: number;
  last_error: string | null;
  tps_1m: number;
  honest: typeof CHAIN_HONEST_STATUS;
}

/** Task-40 audit fix (F-40-1): the proposer for the NEXT height must be
 *  computed EXACTLY as the consensus engine rotates it — over the ENGINEABLE
 *  subset of ACTIVE validators (validators this process holds keys for; the
 *  Task-43 liveness semantics), index (height+1) mod subset length. The old
 *  formula rotated over ALL ACTIVE validators, so on a mature set (genesis 4
 *  engineable + governance-admitted engineless) the UI's gold "proposes next"
 *  star sat on a validator that can never propose for 4 of every 8 heights.
 *  Returns null when the node runtime is unavailable — then NO validator is
 *  marked (honest absence rather than a wrong guess). */
function nextProposerOf(
  rt: Awaited<ReturnType<typeof chainNode>> | null,
  height: number,
  active: Validator[],
): string | null {
  if (!rt || active.length === 0) return null;
  const engineable = new Set(rt.keys.validators.map((k) => pubToAddress(k.pub)));
  const subset = active.filter((v) => engineable.has(v.address));
  if (subset.length === 0) return null;
  return subset[(height + 1) % subset.length]?.address ?? null;
}

export async function getSummary(): Promise<ChainSummary> {
  const ready = chainReady();
  const height = await store.getHeight();
  const params = await store.loadParams(DEFAULT_CHAIN_PARAMS);
  const vals = await store.getValidators();
  const active = vals.filter((v) => v.status === "ACTIVE");
  const blocks = await store.getBlocks(Math.max(1, height - 59), Math.max(1, height));
  const txsInWindow = blocks.reduce((s, b) => s + b.num_txs, 0);
  const windowSpanMs = Math.max(1, (blocks[0]?.time_ms ?? Date.now()) - (blocks[blocks.length - 1]?.time_ms ?? Date.now()));
  const latest = blocks[0] ?? null;
  const rt = ready ? await chainNode() : null;
  const nextProposer = nextProposerOf(rt, height, active);

  let genesisHashVal = await store.getMeta("genesis_hash");
  if (!genesisHashVal && rt) genesisHashVal = genesisHash(rt.genesis);

  return {
    ready,
    chain_id: CHAIN_ID,
    chain_id_configured: CHAIN_ID,
    height,
    latest_block: latest
      ? {
          hash: latest.hash,
          time_ms: latest.time_ms,
          txs: latest.num_txs,
          proposer: latest.header.proposer ?? null,
          consensus_ms: latest.consensus_ms,
          qc_committed_power: latest.qc.committed_power,
          qc_total_power: latest.qc.total_voting_power,
        }
      : null,
    validators: {
      active: active.length,
      total: vals.length,
      total_power: active.reduce((s, v) => s + v.power, 0),
      list: vals.map((v) => ({ ...v, is_proposer_next: v.address === nextProposer })),
    },
    params,
    mempool_size: rt?.mempool.size ?? 0,
    telemetry_recent: rt?.telemetry.slice(-12) ?? [],
    genesis_hash: genesisHashVal ?? "unknown",
    booted_at_ms: rt?.bootedAtMs ?? 0,
    uptime_ms: rt ? Date.now() - rt.bootedAtMs : 0,
    last_error: rt?.lastError ?? null,
    tps_1m: Number((txsInWindow / (windowSpanMs / 1000)).toFixed(3)),
    honest: CHAIN_HONEST_STATUS,
  };
}

export async function getBlocksPage(page: number, pageSize = 15) {
  const height = await store.getHeight();
  if (height === 0) return { height: 0, blocks: [], page, page_size: pageSize, total_pages: 0 };
  const totalPages = Math.max(1, Math.ceil(height / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const to = height - (p - 1) * pageSize;
  const from = Math.max(1, to - pageSize + 1);
  const blocks = await store.getBlocks(from, to);
  return { height, blocks, page: p, page_size: pageSize, total_pages: totalPages };
}

export async function getBlockDetail(idOrHash: string) {
  const height = Number(idOrHash);
  let rows;
  if (Number.isInteger(height) && height > 0) {
    rows = await store.getBlocks(height, height);
  } else if (idOrHash.startsWith("blk_")) {
    const all = await store.getBlocks(1, await store.getHeight());
    rows = all.filter((b) => b.hash === idOrHash);
  } else {
    return null;
  }
  const b = rows[0];
  if (!b) return null;
  const txs = await store.getTxsByHeight(b.height);
  return { ...b, txs };
}

export async function getTxDetail(hash: string) {
  return store.getTx(hash);
}

export async function getAccountInfo(address: string) {
  const acct = await store.getAccount(address);
  const stakes = await store.getStakes(address);
  const unbondings = await store.getUnbondings(address);
  const validators = await store.getValidators();
  const asValidator = validators.find((v) => v.address === address) ?? null;
  const txs = await store.getTxsByAddress(address, 25);
  // Governance participation (Task 42-D): ballots cast by this address across
  // the MOST RECENT proposals. Bounded scan — getProposals() is id-DESC so
  // slice(0,50) is the newest 50; one indexed votes-table read per proposal,
  // keeping only this voter's ballot. Older proposals are NOT scanned (a vote
  // older than the 50-proposal window is invisible here — the UI discloses
  // this bound; a proper voter-indexed query is a future store extension).
  const votes: Array<{
    proposal_id: number;
    proposal_title: string;
    proposal_status: GovProposal["status"];
    option: string;
    power: number;
    height: number;
  }> = [];
  for (const p of (await store.getProposals()).slice(0, 50)) {
    const mine = (await store.getVotes(p.id)).find((v) => v.voter === address);
    if (mine) {
      votes.push({
        proposal_id: p.id,
        proposal_title: p.title,
        proposal_status: p.status,
        option: mine.option,
        power: mine.power,
        height: mine.height,
      });
    }
  }
  return {
    address,
    exists:
      acct.nonce > 0 || acct.fee_u > 0 || acct.pmtq_u > 0 || stakes.length > 0 ||
      unbondings.length > 0 || !!asValidator || votes.length > 0,
    nonce: acct.nonce,
    fee_u: acct.fee_u,
    pmtq_u: acct.pmtq_u,
    bonded_u: stakes.reduce((s, x) => s + x.amount_u, 0),
    unbonding_u: unbondings.reduce((s, x) => s + x.amount_u, 0),
    unbondings: unbondings.map((u) => {
      const v = validators.find((x) => x.address === u.validator);
      return { ...u, validator_moniker: v?.moniker ?? u.validator, release_in_ms: Math.max(0, u.release_ms - Date.now()) };
    }),
    stakes: stakes.map((s) => {
      const v = validators.find((x) => x.address === s.validator);
      return { ...s, validator_moniker: v?.moniker ?? s.validator, validator_status: v?.status ?? "UNKNOWN" };
    }),
    validator: asValidator,
    votes,
    recent_txs: txs,
  };
}

export async function getValidatorList() {
  const vals = await store.getValidators();
  const height = await store.getHeight();
  const active = vals.filter((v) => v.status === "ACTIVE");
  // Task-40 audit fix (F-40-1): same engineable-subset rotation as getSummary.
  const rt = chainReady() ? await chainNode() : null;
  const nextProposer = nextProposerOf(rt, height, active);
  return vals.map((v) => ({
    ...v,
    is_proposer_next: v.address === nextProposer,
  }));
}

export async function getMempoolView() {
  const rt = await chainNode();
  return rt.mempool.snapshot(50).map((e) => ({
    hash: e.hash,
    type: e.tx.type,
    from: e.tx.from,
    fee: e.tx.fee,
    nonce: e.tx.nonce,
    received_ms: e.received_ms,
  }));
}

export async function getGovernanceView() {
  const proposals = await store.getProposals();
  const withVotes: Array<typeof proposals[number] & { votes: Awaited<ReturnType<typeof store.getVotes>> }> = [];
  for (const p of proposals.slice(0, 50)) {
    const votes = await store.getVotes(p.id);
    withVotes.push({ ...p, votes: votes.slice(0, 50) });
  }
  const params = await store.loadParams(DEFAULT_CHAIN_PARAMS);
  const events = await store.getRecentEvents(30);
  return { proposals: withVotes, params, recent_events: events.filter((e) => e.type.startsWith("gov.")) };
}

export { submitTx, faucetDrip, store };

// ─── oracle consensus view (Task-43, §17.10 reference) ─────────────────────────

export interface OracleView {
  height: number;
  prices: OraclePriceRecord[];
  recent_observations: Array<OracleObservation & { observer_moniker: string }>;
  thresholds: {
    min_families: number;
    max_spread_bp: number;
    max_staleness_blocks: number;
  };
  honest: string;
}

export async function getOracleView(): Promise<OracleView> {
  const height = await store.getHeight();
  const prices = await store.getOraclePrices();
  const observations = await store.getRecentOracleObservations(25);
  const monikerOf = new Map((await store.getValidators()).map((v) => [v.address, v.moniker] as const));
  return {
    height,
    prices,
    recent_observations: observations.map((o) => ({ ...o, observer_moniker: monikerOf.get(o.observer) ?? o.observer.slice(0, 14) + "…" })),
    thresholds: {
      min_families: ORACLE_MIN_FAMILIES,
      max_spread_bp: ORACLE_MAX_SPREAD_BP,
      max_staleness_blocks: ORACLE_MAX_STALENESS_BLOCKS,
    },
    honest: CHAIN_HONEST_STATUS.oracle,
  };
}

export async function getFaucetAddress(): Promise<string> {
  const rt = await chainNode();
  return pubToAddress(rt.keys.faucet.pub);
}
