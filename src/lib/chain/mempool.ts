// MTQΣ Network — Sovereign Devnet mempool
//
// Admission checks are ADVISORY (signature, fee floor, nonce window, basic
// payload shape). The authoritative validation happens in state.applyTx at
// consensus time — a tx admitted here can still fail on-chain and will then
// carry a FAILED receipt. Ordering: by fee/byte (descending), then nonce.

import { verifyTx, } from "./crypto";
import { txHash, type ChainParams, type Tx } from "./shared";
import * as store from "./store";

export interface MempoolEntry {
  tx: Tx;
  hash: string;
  received_ms: number;
  fee_per_byte: number;
}

const MAX_POOL = 2000;
const NONCE_WINDOW = 500; // admit up to 500 nonces ahead

export class Mempool {
  private pool = new Map<string, MempoolEntry>(); // hash → entry

  get size(): number {
    return this.pool.size;
  }

  async admit(tx: Tx, params: ChainParams): Promise<{ ok: boolean; hash?: string; error?: string }> {
    const hash = txHash(tx);
    if (this.pool.has(hash)) return { ok: false, hash, error: "already in mempool" };
    if (this.pool.size >= MAX_POOL) return { ok: false, error: "mempool full" };
    if (tx.type !== "send" && tx.type !== "validator_register" && tx.type !== "delegate" &&
        tx.type !== "undelegate" && tx.type !== "gov_submit" && tx.type !== "gov_vote" &&
        tx.type !== "oracle_observe") {
      return { ok: false, error: `unknown tx type: ${tx.type}` };
    }
    if (!Number.isInteger(tx.fee) || tx.fee < params.base_fee_u) {
      return { ok: false, error: `fee below base: ${tx.fee} < ${params.base_fee_u}` };
    }
    if (!Number.isInteger(tx.nonce) || tx.nonce < 1) return { ok: false, error: "nonce must be a positive integer" };
    if (!verifyTx(tx)) return { ok: false, error: "invalid ed25519 signature or address/pubkey mismatch" };
    const acct = await store.getAccount(tx.from);
    if (tx.nonce > acct.nonce + NONCE_WINDOW) {
      return { ok: false, error: `nonce too far ahead (max +${NONCE_WINDOW})` };
    }
    const bytes = JSON.stringify(tx).length || 1;
    this.pool.set(hash, { tx, hash, received_ms: Date.now(), fee_per_byte: tx.fee / bytes });
    return { ok: true, hash };
  }

  /** Highest-value txs ready to execute now (nonce == account nonce + 1).
   *
   * Ordering (BRING-UP BUG FIX, recorded): fee-priority sorts ACCOUNT
   * CHAINS by their head tx's fee/byte — never the txs WITHIN a chain —
   * because reordering same-account txs breaks the nonce sequence inside
   * a block (observed live: the faucet's second drip tx failed with
   * "nonce 3 != expected 2" when the global fee sort put it first). */
  async takeReady(count: number): Promise<Tx[]> {
    const nonces = new Map<string, number>();
    for (const e of this.pool.values()) {
      if (!nonces.has(e.tx.from)) {
        nonces.set(e.tx.from, (await store.getAccount(e.tx.from)).nonce);
      }
    }
    const used = new Map<string, number>(); // from → nonce cursor
    const chains = new Map<string, MempoolEntry[]>();
    for (const e of this.pool.values()) {
      const base = nonces.get(e.tx.from) ?? 0;
      const cur = used.get(e.tx.from) ?? base;
      if (e.tx.nonce === cur + 1) {
        const chain = chains.get(e.tx.from) ?? [];
        chain.push(e);
        chains.set(e.tx.from, chain);
        used.set(e.tx.from, cur + 1);
      }
    }
    const chainList = Array.from(chains.values());
    chainList.sort((a, b) => b[0].fee_per_byte - a[0].fee_per_byte);
    return chainList.flat().slice(0, count).map((e) => e.tx);
  }

  /** Drop txs included at `height` (matched by hash) — called after block apply. */
  removeIncluded(txs: Tx[], _height: number): void {
    for (const tx of txs) this.pool.delete(txHash(tx));
    // also drop now-stale entries (nonce <= executed nonce)
    // handled lazily by takeReady/admit re-validation
  }

  /** Purge everything (used on node restart / rollback scenarios). */
  clear(): void {
    this.pool.clear();
  }

  snapshot(limit = 50): MempoolEntry[] {
    return Array.from(this.pool.values())
      .sort((a, b) => b.fee_per_byte - a.fee_per_byte)
      .slice(0, limit);
  }
}
