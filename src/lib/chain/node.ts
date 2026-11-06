// MTQΣ Network — Sovereign Devnet reference node (in-process singleton)
//
// Boots with the Next.js server via src/instrumentation.ts. Produces blocks
// on a heartbeat (params.heartbeat_ms) or promptly when the mempool holds
// ready transactions. Every block goes through the full signed BFT round
// (consensus.ts) and is applied deterministically (state.ts), persisted to
// db/chain.db (store.ts). globalThis-guarded against HMR double-start,
// mirroring the pilot engine's loop hygiene (16d-002 pattern).
//
// HONEST STATUS (surfaced via /api/chain):
//   • REFERENCE DEVNET — single process, in-process transport, 4 co-located
//     validator engines. NOT multi-host, NOT decentralized, NO BFT guarantees
//     against compromise of this process.
//   • Production path: Cosmos SDK + CometBFT (docs/NETWORK-DESIGN-DECISION.md).

import { ConsensusEngine, assembleBlockHeader, type RoundTelemetry } from "./consensus";
import { ensureGenesis, genesisHash, type Genesis } from "./genesis";
import { Mempool } from "./mempool";
import * as store from "./store";
import { applyBlock, computeStateRoot } from "./state";
import {
  CHAIN_ID,
  DEFAULT_CHAIN_PARAMS,
  blockHeaderHash,
  txHash,
  type Block,
  type ChainParams,
  type Tx,
} from "./shared";
import type { NodeKeys } from "./crypto";
import { signTx, pubToAddress } from "./crypto";

/** Block-committed event pushed to SSE subscribers (Task-42). Pure data —
 *  no engine internals leak into the public stream payload. */
export interface ChainBlockEvent {
  height: number;
  hash: string;
  txs: number;
  proposer: string | null;
  qc_committed_power: number;
  qc_total_power: number;
  consensus_ms: number;
  time_ms: number;
}

interface ChainNodeRuntime {
  ready: boolean;
  codeVersion: number; // state-machine version this runtime instance runs
  bootedAtMs: number;
  genesis: Genesis;
  keys: NodeKeys;
  params: ChainParams;
  mempool: Mempool;
  engine: ConsensusEngine;
  producing: boolean;
  lastBlockAtMs: number;
  lastError: string | null;
  timer: ReturnType<typeof setInterval> | null;
  telemetry: RoundTelemetry[];
  /** Task-42 SSE subscribers — block-committed listeners. Cleaned on stop()
  *  so a hot code-upgrade teardown never leaks stale subscribers. */
  blockListeners: Set<(ev: ChainBlockEvent) => void>;
  stop: () => void;
}

const G = globalThis as unknown as { __MTQ_CHAIN__?: ChainNodeRuntime };

// Bump on every substantive state-machine/protocol change so the running
// devnet node hot-upgrades to the new code at the next API request (dev-mode
// HMR cannot re-run instrumentation.ts, and the old runtime's interval
// closure otherwise keeps executing the OLD state machine forever). In
// production the constant never changes per process → zero restarts.
export const CHAIN_NODE_CODE_VERSION = 49; // Task-42 (root-cause remediation): boot-time DB self-heal — ensureChainNode() now restores db/{chain,custom}.db forward-only from the git-tracked cloud dumps BEFORE any schema/genesis work, so a sandbox re-image data-layer wipe can no longer silently re-seed a fresh chain (incident 2026-11-06 class); no consensus/state-machine change, but boot-path change ⇒ forward-only bump per the task-41 hot-upgrade discipline

// ─── boot ────────────────────────────────────────────────────────────────────

export async function ensureChainNode(): Promise<ChainNodeRuntime> {
  if (G.__MTQ_CHAIN__?.ready) return G.__MTQ_CHAIN__;

  // Task-42 ROOT-CAUSE REMEDIATION (incident 2026-11-06): a sandbox re-image
  // wipes the gitignored data layer — booting on a wiped db/chain.db used to
  // silently re-seed genesis (divergence + forensic mess). BEFORE any
  // schema/genesis work, self-heal both databases forward-only from the
  // git-tracked cloud dumps whenever the cloud layer is strictly ahead. This
  // runs no matter who starts the dev server (platform restart, watchdog, or
  // manual). Once-per-process guard via globalThis (HMR-safe); an intentional
  // genesis reset opts out via the db/ALLOW-GENESIS-RESET sentinel.
  const SH = G as unknown as { __MTQ_DB_SELFHEALED__?: boolean };
  if (!SH.__MTQ_DB_SELFHEALED__) {
    SH.__MTQ_DB_SELFHEALED__ = true;
    try {
      const { selfHealDatabases } = await import("@/lib/db-ops");
      const rep = await selfHealDatabases();
      if (rep.healed) {
        console.log(
          `[chain] DB SELF-HEAL — restored from git-tracked cloud dumps: ` +
          `chain ${rep.chain.live} → ${rep.chain.dump}, custom ${rep.custom.live} → ${rep.custom.dump}`,
        );
      }
    } catch (e) {
      console.error("[chain] DB self-heal FAILED (continuing — an empty DB may re-seed):", e);
    }
  }

  const { genesis, keys, created } = ensureGenesis();
  await store.initSchema();

  // Chain identity continuity: if blocks exist, the genesis hash must match.
  const persistedGenesisHash = await store.getMeta("genesis_hash");
  const currentGenesisHash = genesisHash(genesis);
  const existingHeight = await store.getHeight();
  if (existingHeight > 0 && persistedGenesisHash && persistedGenesisHash !== currentGenesisHash) {
    throw new Error(
      `[chain] FATAL: db/chain.db was built on genesis ${persistedGenesisHash.slice(0, 18)}… ` +
      `but config/chain-genesis.json hashes to ${currentGenesisHash.slice(0, 18)}…. ` +
      `Refusing to continue (state/genesis mismatch). Reset via scripts/chain-reset.ts.`,
    );
  }

  if (existingHeight === 0) {
    // seed genesis state (self-stakes + powers come from the committed genesis)
    for (const v of genesis.validators) {
      await store.putValidator({
        pub_key: v.pub_key,
        address: v.address,
        moniker: v.moniker,
        power: v.power,
        commission_bp: 500,
        status: "ACTIVE",
        self_stake: v.self_stake_u,
        delegated: 0,
        joined_height: 0,
      });
    }
    for (const a of genesis.allocs) {
      await store.ensureAccount(a.address);
      await store.executeAccountUpdate(a.address, { fee_u: a.fee_u, pmtq_u: a.pmtq_u, nonce: 0 });
    }
    await store.setMeta("genesis_hash", currentGenesisHash);
    await store.setMeta("boot_mode", created ? "first-boot" : "re-seeded");
  }

  const params = await store.loadParams({ ...DEFAULT_CHAIN_PARAMS, ...genesis.params });
  // Task-42: provision the devnet treasury address (the faucet account) in
  // chain metadata — the block-reward engine pays uMTQD from this account
  // when (and only when) rewards_enabled=1 (default OFF). Idempotent; set on
  // every boot so hot code-upgrades on older DBs pick it up too.
  await store.setMeta("treasury_address", pubToAddress(keys.faucet.pub));
  const mempool = new Mempool();
  const engine = new ConsensusEngine(keys.validators, store.getValidators);
  await engine.init();

  const runtime: ChainNodeRuntime = {
    ready: true,
    codeVersion: CHAIN_NODE_CODE_VERSION,
    bootedAtMs: Date.now(),
    genesis,
    keys,
    params,
    mempool,
    engine,
    producing: false,
    lastBlockAtMs: 0,
    lastError: null,
    timer: null,
    telemetry: engine.recentTelemetry,
    blockListeners: new Set(),
    stop: () => {
      runtime.ready = false;
      runtime.producing = false;
      engine.stop();
      if (runtime.timer) clearInterval(runtime.timer);
      runtime.blockListeners.clear();
    },
  };
  G.__MTQ_CHAIN__ = runtime;

  // production loop — 700ms tick: produce when mempool has ready txs (≥1s
  // after last block) or on heartbeat
  runtime.timer = setInterval(() => void produceIfDue(runtime).catch((e) => {
    runtime.lastError = String(e);
    console.error("[chain] produce error:", e);
  }), 700);
  runtime.timer.unref?.();
  console.log(
    `[chain] MTQΣ devnet node up · chain_id=${CHAIN_ID} · genesis=${currentGenesisHash.slice(0, 22)}… ` +
    `· validators=${genesis.validators.length} · height=${existingHeight} · mode=${created ? "FIRST-BOOT" : "RESUME"}`,
  );
  return runtime;
}

function teardownStale(prev: ChainNodeRuntime): void {
  try { prev.stop(); } catch { /* best-effort */ }
}

/** Hot-reload-safe accessor for API routes. Also performs the dev-mode code
 *  upgrade: when the loaded module's CHAIN_NODE_CODE_VERSION is strictly
 *  NEWER than the running runtime's, the stale runtime is torn down (timers +
 *  engines) and the node re-boots from persisted state — committed blocks are
 *  never lost, only the ephemeral mempool of in-flight (uncommitted) txs is
 *  dropped. */
export async function chainNode(): Promise<ChainNodeRuntime> {
  const cur = G.__MTQ_CHAIN__;
  // Forward-only: only a strictly NEWER code version reboots the node — a
  // stale module instance (dev HMR transition) must never tear down a runtime
  // that runs newer code (prevents version flapping).
  if (cur?.ready) {
    if (cur.codeVersion >= CHAIN_NODE_CODE_VERSION) return cur;
    console.log(
      `[chain] code upgrade: v${cur.codeVersion} → v${CHAIN_NODE_CODE_VERSION} — rebooting node (state resumes from db/chain.db)`,
    );
  }
  if (cur) teardownStale(cur);
  return ensureChainNode();
}

export function chainReady(): boolean {
  return !!G.__MTQ_CHAIN__?.ready;
}

// ─── block production ────────────────────────────────────────────────────────

async function produceIfDue(rt: ChainNodeRuntime): Promise<void> {
  if (rt.producing) return;
  const now = Date.now();
  const ready = await rt.mempool.takeReady(rt.params.max_block_txs);
  const dueHeartbeat = now - rt.lastBlockAtMs >= rt.params.heartbeat_ms;
  const dueTxs = ready.length > 0 && now - rt.lastBlockAtMs >= 1000;
  if (!dueHeartbeat && !dueTxs) return;
  rt.producing = true;
  try {
    await produceBlock(rt);
  } finally {
    rt.producing = false;
    rt.telemetry = rt.engine.recentTelemetry;
  }
}

async function produceBlock(rt: ChainNodeRuntime): Promise<void> {
  const height = (await store.getHeight()) + 1;
  const prevRow = height > 1 ? (await store.getBlocks(height - 1, height - 1))[0] : null;
  const prevHash = prevRow ? prevRow.hash : "";
  const stateRoot = await computeStateRoot(); // commitment of state BEFORE this block (documented)
  const validators = await store.getValidators();
  const active = validators.filter((v) => v.status === "ACTIVE");
  if (active.length === 0) {
    rt.lastError = "no ACTIVE validators — chain halted (honest stop; fix via governance or reset)";
    return;
  }

  const result = await rt.engine.runHeight(
    height,
    async (proposer, maxTxs) => {
      const txs = await rt.mempool.takeReady(maxTxs);
      const header = await assembleBlockHeader(height, prevHash, txs, proposer, stateRoot, validators);
      return { txs, header };
    },
    rt.params,
    prevHash,
  );
  if (!result) {
    rt.lastError = `round timeout at height ${height} (no QC)`;
    return;
  }
  const { block, consensusMs } = result;
  await store.putBlock(block, consensusMs);
  await applyBlock(block);
  rt.mempool.removeIncluded(block.txs, height);
  rt.lastBlockAtMs = Date.now();
  rt.lastError = null;
  await store.putEvent(height, "block.committed", {
    hash: blockHeaderHash(block.header).slice(0, 20) + "…",
    txs: block.txs.length,
    qc_power: block.qc.committed_power,
    total_power: block.qc.total_voting_power,
    consensus_ms: Math.round(consensusMs),
    proposer: active.find((v) => v.address === block.header.proposer)?.moniker ?? block.header.proposer,
  }, block.header.time_ms);
  // Task-42 SSE push: notify subscribers (each listener isolated in try/catch
  // so one dead consumer can never break block production).
  if (rt.blockListeners.size > 0) {
    const ev: ChainBlockEvent = {
      height,
      hash: blockHeaderHash(block.header),
      txs: block.txs.length,
      proposer: block.header.proposer ?? null,
      qc_committed_power: block.qc.committed_power,
      qc_total_power: block.qc.total_voting_power,
      consensus_ms: Math.round(consensusMs),
      time_ms: block.header.time_ms,
    };
    for (const cb of rt.blockListeners) {
      try { cb(ev); } catch { /* isolate subscriber failures */ }
    }
  }
}

// ─── SSE block-event subscription (Task-42) ─────────────────────────────

/** Subscribe to block-committed events (in-process push — the transport is
 *  the /api/chain/stream SSE route). Returns an unsubscribe function. Listener
 *  failures are isolated by the producer; unsubscribe is idempotent. */
export async function subscribeChainEvents(
  cb: (ev: ChainBlockEvent) => void,
): Promise<() => void> {
  const rt = await chainNode();
  rt.blockListeners.add(cb);
  return () => {
    rt.blockListeners.delete(cb);
  };
}

// ─── tx submission (used by RPC routes + faucet) ─────────────────────────────

export async function submitTx(tx: Tx): Promise<{ ok: boolean; hash?: string; error?: string }> {
  const rt = await chainNode();
  const res = await rt.mempool.admit(tx, rt.params);
  return res;
}

export async function faucetDrip(to: string): Promise<{ ok: boolean; hash?: string; error?: string }> {
  const rt = await chainNode();
  if (!/^mtq1[0-9a-f]{40}$/.test(to)) return { ok: false, error: "invalid mtq1… address" };
  const acct = await store.getAccount(to);
  if (acct.fee_u > 0) return { ok: false, error: "address already holds uMTQD (faucet is one-drip-per-address)" };
  const faucetAddr = (await import("./crypto")).pubToAddress(rt.keys.faucet.pub);
  const faucetAcct = await store.getAccount(faucetAddr);
  const amount = 10_000 * 1_000_000; // 10,000 MTQD per drip
  const pmtqAmount = 10 * 1_000_000; // 10 PMTQ pilot-mirror per drip (non-canonical demo asset)
  if (faucetAcct.fee_u < amount + 2 * rt.params.base_fee_u) return { ok: false, error: "faucet reserve exhausted" };
  const mirrorAvailable = faucetAcct.pmtq_u >= pmtqAmount;
  // tx 1: fee-asset drip
  const unsigned1 = {
    type: "send" as const,
    from: faucetAddr,
    nonce: faucetAcct.nonce + 1,
    fee: rt.params.base_fee_u,
    payload: { to, asset: "FEE", amount },
  };
  const s1 = signTx(rt.keys.faucet.priv, unsigned1);
  const r1 = await rt.mempool.admit({ ...unsigned1, sig: s1.sig, pub_key: s1.pub }, rt.params);
  if (!r1.ok) return r1;
  // tx 2: PMTQ pilot-mirror drip (same nonce sequence)
  if (mirrorAvailable) {
    const unsigned2 = {
      type: "send" as const,
      from: faucetAddr,
      nonce: faucetAcct.nonce + 2,
      fee: rt.params.base_fee_u,
      payload: { to, asset: "PMTQ", amount: pmtqAmount },
    };
    const s2 = signTx(rt.keys.faucet.priv, unsigned2);
    await rt.mempool.admit({ ...unsigned2, sig: s2.sig, pub_key: s2.pub }, rt.params);
  }
  return { ok: true, hash: r1.hash };
}

// ─── node-held helper used by tooling/tests ──────────────────────────────────

export async function signAndSubmit(
  which: "val-0" | "val-1" | "val-2" | "val-3" | "faucet",
  unsigned: Omit<Tx, "sig" | "pub_key">,
): Promise<{ ok: boolean; hash?: string; error?: string }> {
  const rt = await chainNode();
  const key = which === "faucet" ? rt.keys.faucet : rt.keys.validators[Number(which.slice(-1))];
  const { sig, pub } = signTx(key.priv, unsigned);
  const tx: Tx = { ...unsigned, sig, pub_key: pub };
  const res = await rt.mempool.admit(tx, rt.params);
  return res.ok ? { ok: true, hash: txHash(tx) } : res;
}
