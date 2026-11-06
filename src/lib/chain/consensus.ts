// MTQΣ Network — Sovereign Devnet consensus engine
//
// A CometBFT-STYLE round executed by N validator ENGINES, each with its own
// ed25519 key, running inside this process and exchanging SIGNED messages
// over an in-process transport bus with simulated network latency. Every
// vote is genuinely signed and genuinely verified by every receiving
// engine; a block genuinely requires a +2/3-by-voting-power precommit
// quorum to commit, and the quorum certificate (aggregate of signed
// precommits) is stored in every block.
//
// HONEST SCOPE — this is a REAL consensus protocol implementation with REAL
// cryptography, but a SINGLE-PROCESS deployment: the engines do not provide
// Byzantine fault tolerance against a compromise of this process (all keys
// are co-located). It demonstrates and exercises the protocol logic; the
// production network runs CometBFT across independent hosts (see
// docs/NETWORK-DESIGN-DECISION.md). No fault-tolerance or decentralization
// claim may be derived from running this engine.

import {
  blockHeaderHash,
  canonicalProposalSigBytes,
  canonicalVoteBytes,
  hasQuorum,
  txHash,
  validatorsHash,
  type Block,
  type BlockHeader,
  type ChainParams,
  type ConsensusMessage,
  type QuorumCertificate,
  type Tx,
  type Validator,
} from "./shared";
import { signBytes, verifyBytes } from "./crypto";
import * as store from "./store";
import { applyBlock, computeStateRoot } from "./state";

const BUS_LATENCY_MS = 35; // per-hop simulated latency — keeps rounds observable

export interface RoundTelemetry {
  height: number;
  round: number;
  /** Proposer ADDRESS (mtq1…) — canonical identity, exactly like
   *  BlockHeader.proposer. Task-40 audit fix (F-40-2): this used to ship the
   *  moniker while the NOC UI treated it as an address (moniker lookup →
   *  shortAddr fallback → mangled text like "mtq-val-2.…eridian"). */
  proposer: string;
  proposed_at_ms: number | null;
  prevotes: number;
  precommits: number;
  committed_at_ms: number | null;
  consensus_ms: number;
  txs: number;
}

interface EngineState {
  index: number;
  moniker: string;
  pub: string;
  priv: string;
  address: string;
  /** Per-engine proposal dedup key — CRITICAL: must NOT live on the shared
   *  round state. The first shared-state implementation "claimed" the
   *  proposal for one engine and silently suppressed the other engines'
   *  prevotes (a single-process bug a real multi-process network cannot
   *  have — documented in NETWORK-DESIGN-DECISION.md). */
  lastProposalKey: string | null;
}

export class ConsensusEngine {
  private engines: EngineState[] = [];
  private telemetry: RoundTelemetry[] = [];
  private running = false;

  constructor(
    private keys: Array<{ moniker: string; pub: string; priv: string }>,
    private getActiveValidators: () => Promise<Validator[]>,
  ) {
    this.engines = keys.map((k, index) => ({
      index,
      moniker: k.moniker,
      pub: k.pub,
      priv: k.priv,
      address: "", // filled by init()
      lastProposalKey: null,
    }));
  }

  async init(): Promise<void> {
    const { pubToAddress } = await import("./crypto");
    for (const e of this.engines) {
      e.address = pubToAddress(e.pub);
      e.lastProposalKey = null;
    }
  }

  get recentTelemetry(): RoundTelemetry[] {
    return this.telemetry.slice(-40);
  }

  // ─── transport bus ────────────────────────────────────────────────────────

  private bus(msg: ConsensusMessage): void {
    if (!this.running) return;
    setTimeout(() => this.deliver(msg), BUS_LATENCY_MS);
  }

  private deliver(msg: ConsensusMessage): void {
    if (!this.running) return;
    for (const e of this.engines) {
      this.handle(e, msg).catch((err) => {
        // Honest error surfacing: a swallowed handler error would stall the
        // round silently — log it so the NOC last_error explains the stall.
        console.error(`[chain] consensus handler error (${e.moniker} ← ${msg.kind}):`, err);
      });
    }
  }

  // ─── message handling (per engine) ────────────────────────────────────────

  private async handle(engine: EngineState, msg: ConsensusMessage): Promise<void> {
    const state = this.round;
    if (!state || msg.height !== state.height || msg.round !== state.round) return;
    const validators = await this.getActiveValidators();
    const sender = validators.find((v) => v.address === msg.from);
    if (!sender || sender.status !== "ACTIVE") return; // only ACTIVE validators count

    switch (msg.kind) {
      case "proposal": {
        // Per-ENGINE dedup (each engine processes each proposal exactly once;
        // a shared "claimed" guard would suppress the other engines' votes).
        const key = `${msg.height}:${msg.round}:${msg.from}:${msg.header.txs_root}`;
        if (engine.lastProposalKey === key) return;
        if (msg.from !== state.proposer) return;
        const sigBytes = canonicalProposalSigBytes(msg.height, msg.round, msg.from, msg.header.txs_root);
        if (!verifyBytes(msg.sig, sigBytes, sender.pub_key)) return;
        engine.lastProposalKey = key;
        state.proposal = { header: msg.header, txHashes: msg.txHashes, sig: msg.sig, from: msg.from };
        this.telemetryAt().proposed_at_ms ??= Date.now();
        // engine prevotes the proposal it saw (locked-on-proposal discipline)
        this.emitVote(engine, "prevote", blockHeaderHash(msg.header), validators);
        break;
      }
      case "prevote": {
        const sigBytes = canonicalVoteBytes("prevote", msg.height, msg.round, msg.from, msg.blockHash);
        if (!verifyBytes(msg.sig, sigBytes, sender.pub_key)) return;
        if (msg.blockHash) state.prevotes.set(msg.from, { power: sender.power, sig: msg.sig, hash: msg.blockHash });
        else state.prevotes.set(msg.from, null);
        this.telemetryAt().prevotes = this.countPower(state.prevotes);
        // On +2/3 prevotes for the same hash → precommit
        const byHash = new Map<string, number>();
        for (const v of state.prevotes.values()) {
          if (v) byHash.set(v.hash, (byHash.get(v.hash) ?? 0) + v.power);
        }
        const total = validators.filter((v) => v.status === "ACTIVE").reduce((s, v) => s + v.power, 0);
        for (const [hash, power] of byHash) {
          if (hasQuorum(power, total)) {
            this.emitVote(engine, "precommit", hash, validators);
            break;
          }
        }
        break;
      }
      case "precommit": {
        const sigBytes = canonicalVoteBytes("precommit", msg.height, msg.round, msg.from, msg.blockHash);
        if (!verifyBytes(msg.sig, sigBytes, sender.pub_key)) return;
        if (msg.blockHash) state.precommits.set(msg.from, { power: sender.power, sig: msg.sig, hash: msg.blockHash });
        else state.precommits.set(msg.from, null);
        const tel = this.telemetryAt();
        tel.precommits = this.countPower(state.precommits);
        // Commit is detected by the round driver (runRound), not here.
        break;
      }
    }
  }

  private emitVote(engine: EngineState, kind: "prevote" | "precommit", blockHash: string, _validators: Validator[]): void {
    if (!this.round) return;
    const state = this.round;
    if (kind === "prevote" && state.prevoted.has(engine.address)) return;
    if (kind === "precommit" && state.precommitted.has(engine.address)) return;
    const sig = signBytes(engine.priv, canonicalVoteBytes(kind, state.height, state.round, engine.address, blockHash));
    if (kind === "prevote") state.prevoted.add(engine.address);
    else state.precommitted.add(engine.address);
    this.bus({ kind, height: state.height, round: state.round, from: engine.address, blockHash, sig });
  }

  private countPower(m: Map<string, { power: number; sig: string; hash: string } | null>): number {
    let p = 0;
    for (const v of m.values()) if (v) p += v.power;
    return p;
  }

  private telemetryAt(): RoundTelemetry {
    return this.telemetry[this.telemetry.length - 1];
  }

  // ─── round driver ─────────────────────────────────────────────────────────

  private round: {
    height: number;
    round: number;
    proposer: string;
    proposal: { header: BlockHeader; txHashes: string[]; sig: string; from: string } | null;
    prevotes: Map<string, { power: number; sig: string; hash: string } | null>;
    precommits: Map<string, { power: number; sig: string; hash: string } | null>;
    prevoted: Set<string>;
    precommitted: Set<string>;
    expectedHash: (n: number) => string;
  } | null = null;

  /**
   * Runs one full height: propose → prevote → precommit → commit.
   * Returns the committed Block (with QC) or null if the round timed out
   * (which, with all engines co-located and healthy, should not happen —
   * it is implemented for protocol completeness).
   */
  async runHeight(
    height: number,
    buildBlock: (proposer: string, maxTxs: number) => Promise<{ txs: Tx[]; header: Omit<BlockHeader, "round"> } | null>,
    params: ChainParams,
    prevHash: string,
  ): Promise<{ block: Block; consensusMs: number } | null> {
    const validators = await this.getActiveValidators();
    const active = validators.filter((v) => v.status === "ACTIVE");
    if (active.length === 0) return null;
    const totalPower = active.reduce((s, v) => s + v.power, 0);
    if (totalPower === 0) return null;

    // BRING-UP BUG FIX (Task-43, the FOURTH recorded — observed live at height
    // 648): proposer rotation must pick from validators this process HOLDS
    // ENGINES for. Governance can admit validators with no in-process engine
    // (dynamic membership); rotation onto such a validator burns the round
    // instantly (`continue` — no proposal is ever signed), and with the other
    // rounds failing on timing the 3-round budget exhausted → PERMANENT
    // "round timeout" stall of the whole chain (liveness loss). Honest
    // semantics preserved: quorum math keeps the FULL ACTIVE power — an
    // engineless-but-ACTIVE validator legitimately raises the commitment bar
    // (the co-located engines must still reach +2/3 of the TOTAL set).
    const engineable = active.filter((v) => this.engines.some((e) => e.address === v.address));
    if (engineable.length === 0) return null; // no co-located engine for any ACTIVE validator

    const started = Date.now();
    for (let round = 0; round < 3; round++) {
      // CometBFT-style proposer rotation: proposer changes across rounds so a
      // failed round does not retry the same proposer forever. (Task-43 fix:
      // rotation is over the ENGINEABLE subset — see the note above runHeight.)
      const proposer = engineable[(height + round) % engineable.length];
      const roundStart = Date.now();
      this.telemetry.push({
        height,
        round,
        proposer: proposer.address, // F-40-2: canonical address, not the moniker
        proposed_at_ms: null,
        prevotes: 0,
        precommits: 0,
        committed_at_ms: null,
        consensus_ms: 0,
        txs: 0,
      });
      this.round = {
        height,
        round,
        proposer: proposer.address,
        proposal: null,
        prevotes: new Map(),
        precommits: new Map(),
        prevoted: new Set(),
        precommitted: new Set(),
        expectedHash: () => "",
      };
      this.running = true;

      // 1) propose (the proposer engine builds + signs the block)
      const proposerEngine = this.engines.find((e) => e.address === proposer.address);
      if (!proposerEngine) continue;
      const built = await buildBlock(proposer.address, params.max_block_txs);
      if (!built) continue;
      const header: BlockHeader = { ...built.header, round };
      const hash = blockHeaderHash(header);
      const txHashes = built.txs.map((t) => txHash(t));
      const propSig = signBytes(
        proposerEngine.priv,
        canonicalProposalSigBytes(height, round, proposer.address, header.txs_root),
      );
      this.bus({ kind: "proposal", height, round, from: proposer.address, header, txHashes, sig: propSig });

      // 2) wait for the round to settle — PER-ROUND deadline (a shared
      // height-level deadline made rounds 1+ skip waiting entirely).
      const settleDeadline = roundStart + 4000;
      while (Date.now() < settleDeadline) {
        await sleep(50);
        const st = this.round;
        if (!st) break;
        const committedPower = this.countPower(st.precommits);
        if (hasQuorum(committedPower, totalPower)) break;
        // Safety valve: every ACTIVE validator's precommit message has been
        // RECEIVED (tally complete — emission-side tracking is NOT enough:
        // messages still in flight would otherwise end the wait before the
        // votes can be counted, failing every round).
        if (st.precommits.size >= active.length) break;
      }

      // 3) assemble QC from precommits for THIS block hash
      const st = this.round;
      this.running = false;
      if (!st) continue;
      const precommits: QuorumCertificate["precommits"] = [];
      let committedPower = 0;
      for (const [voter, v] of st.precommits) {
        if (v && v.hash === hash) {
          const val = active.find((a) => a.address === voter);
          if (val) {
            precommits.push({ voter, power: val.power, sig: v.sig });
            committedPower += val.power;
          }
        }
      }
      if (!hasQuorum(committedPower, totalPower)) {
        continue; // round failed → next round (round++ would need new proposer; simplified: retry)
      }
      const qc: QuorumCertificate = {
        height,
        round,
        block_hash: hash,
        precommits,
        total_voting_power: totalPower,
        committed_power: committedPower,
      };
      const block: Block = { header, txs: built.txs, qc };
      const tel = this.telemetryAt();
      tel.committed_at_ms = Date.now();
      tel.consensus_ms = tel.committed_at_ms - started;
      tel.txs = built.txs.length;
      this.round = null;
      return { block, consensusMs: tel.consensus_ms };
    }
    this.round = null;
    return null;
  }

  stop(): void {
    this.running = false;
    this.round = null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── block assembly helper (used by the node) ────────────────────────────────

export async function assembleBlockHeader(
  height: number,
  prevHash: string,
  txs: Tx[],
  proposer: string,
  stateRoot: string,
  vals: Validator[],
): Promise<BlockHeader> {
  const { merkleRoot, txHash, CHAIN_ID } = await import("./shared");
  return {
    chain_id: CHAIN_ID,
    height,
    time_ms: Date.now(),
    prev_hash: prevHash,
    txs_root: merkleRoot(txs.map((t) => txHash(t))),
    state_root: stateRoot,
    validators_hash: validatorsHash(vals),
    proposer,
    round: 0, // set by runHeight
  };
}

export { applyBlock, computeStateRoot, store };
