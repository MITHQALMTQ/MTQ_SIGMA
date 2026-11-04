// MTQΣ Network — Sovereign Devnet RPC surface (in-process)
//
// Pure read/submit functions consumed by /api/chain/* routes. Every metric
// below originates from the actual chain state (db/chain.db + engine
// telemetry) — nothing is synthesized. Honest disclosure payload is
// attached to the summary for the UI to render verbatim.

import { chainNode, chainReady, submitTx, faucetDrip } from "./node";
import * as store from "./store";
import { CHAIN_ID, DEFAULT_CHAIN_PARAMS, type Tx, type Validator } from "./shared";
import { genesisHash } from "./genesis";
import { pubToAddress } from "./crypto";

export const CHAIN_HONEST_STATUS = {
  status: "REFERENCE DEVNET",
  scope:
    "Single-process in-process reference node: 4 validator ENGINES with real ed25519 keys run the full signed BFT voting protocol over an in-process transport bus; blocks require a genuine +2/3-by-power precommit quorum certificate. All engines are co-located in one process on one host — this provides protocol-logic realism, NOT Byzantine fault tolerance against process compromise, and NO decentralization.",
  separation:
    "Network governance cannot alter MTQ monetary parameters (constitutional guard enforced at proposal submission). MTQΣ is NOT the gas token — fees are paid in uMTQD, a testnet-only credit. PMTQ is a NON-CANONICAL pilot ledger mirror; canonical MTQΣ supply accounting stays in the monetary protocol engine.",
  economics:
    "Staking records bonding + voting power only. No reward stream, no inflation, no slashing events (single-process mode) — all economic parameters await the separately approved Network Economics Specification (owner approval required; nothing invented here).",
  productionPath:
    "Production network path: Cosmos SDK + CometBFT multi-host validator set (docs/NETWORK-DESIGN-DECISION.md). Production authorization for MTQ remains FALSE per the 11 validation gates.",
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
      list: vals.map((v) => ({ ...v, is_proposer_next: active.length > 0 && v.address === active[(height + 1) % active.length]?.address })),
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
  const validators = await store.getValidators();
  const asValidator = validators.find((v) => v.address === address) ?? null;
  const txs = await store.getTxsByAddress(address, 25);
  return {
    address,
    exists: acct.nonce > 0 || acct.fee_u > 0 || acct.pmtq_u > 0 || stakes.length > 0 || !!asValidator,
    nonce: acct.nonce,
    fee_u: acct.fee_u,
    pmtq_u: acct.pmtq_u,
    bonded_u: stakes.reduce((s, x) => s + x.amount_u, 0),
    stakes: stakes.map((s) => {
      const v = validators.find((x) => x.address === s.validator);
      return { ...s, validator_moniker: v?.moniker ?? s.validator, validator_status: v?.status ?? "UNKNOWN" };
    }),
    validator: asValidator,
    recent_txs: txs,
  };
}

export async function getValidatorList() {
  const vals = await store.getValidators();
  const height = await store.getHeight();
  const active = vals.filter((v) => v.status === "ACTIVE");
  return vals.map((v) => ({
    ...v,
    is_proposer_next: active.length > 0 && v.address === active[(height + 1) % active.length]?.address,
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

export async function getFaucetAddress(): Promise<string> {
  const rt = await chainNode();
  return pubToAddress(rt.keys.faucet.pub);
}
