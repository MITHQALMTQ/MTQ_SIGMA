// MTQΣ Network — Sovereign Devnet Reference Node (chain core, shared module)
//
// HONEST SCOPE (read before touching anything here):
// This is the in-process REFERENCE implementation of the MTQ Sigma Network
// sovereign chain — Phase-1 "reproducible local development network" scope.
// It provides REAL cryptography (ed25519 via the audited @noble/curves),
// REAL signed transactions, REAL BFT-style voting logic with a +2/3 quorum
// certificate per block, REAL deterministic state transitions persisted to
// SQLite, and a REAL validator set with dynamic membership executed through
// on-chain governance. What it is NOT: a multi-host / multi-process network.
// The four validator ENGINES run inside one Node process and exchange
// messages over an in-process transport bus. Block production is therefore
// honest-CENTRALIZED (single operator, single machine). The production path
// remains Cosmos SDK + CometBFT as documented in
// docs/NETWORK-DESIGN-DECISION.md. No decentralization, uptime or
// production-readiness claim may be derived from this module.
//
// This file is CLIENT-SAFE (no node: imports, no Buffer) so the Wallet UI
// shares the exact canonical encoding with the node — one code path for
// tx bytes.

import { sha256 } from "@noble/hashes/sha2.js";

// ─── Pure-JS hex helpers (no Buffer — browser-safe) ─────────────────────────

export function toHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : "0" + hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const enc = new TextEncoder();

// ─── Units ───────────────────────────────────────────────────────────────────
// All on-chain amounts are INTEGER micro-units (1e-6). Two assets exist:
//   • FEE  — "uMTQD" network devnet credit. Testnet-only fee mechanism
//             (network-design decision §3.3: the chain runs a testnet-only
//             fee asset; MTQΣ is NOT the gas token).
//   • PMTQ — pilot MTQΣ ledger representation, NON-CANONICAL by design
//             (the canonical MTQΣ supply accounting stays in the monetary
//             protocol engine; Part 2 rules 1-4 preserved: the chain cannot
//             mint/alter MTQ monetary state — PMTQ moves are ledger-mirror
//             transfers only, honestly labeled).

export type AssetId = "FEE" | "PMTQ";

// ─── Addresses ───────────────────────────────────────────────────────────────
// mtq1 + first 20 bytes of sha256(pubkey), hex-encoded (40 chars).
// Documented simplification vs full bech32 — network-design decision.

export function addressFromPublicKey(pubKey: Uint8Array): string {
  return "mtq1" + toHex(sha256(pubKey).slice(0, 20));
}

// ─── Transactions ────────────────────────────────────────────────────────────

export type TxType =
  | "send" // bank: payload { to, asset, amount }
  | "validator_register" // staking: { moniker, commission_bp, self_stake, pub_key }
  | "delegate" // staking: { validator, amount }
  | "undelegate" // staking: { validator, amount } — enters the unbonding queue
  | "gov_submit" // gov: { proposal_type, title, description, payload, deposit }
  | "gov_vote"; // gov: { proposal_id, option }

// ─── Unbonding queue ─────────────────────────────────────────────────────────
// Undelegated bond sits in a time-locked queue (unbonding_s network param);
// voting power drops IMMEDIATELY at undelegate, funds return at maturity.
// This is a pure time-lock mechanism — NO reward stream, NO slashing, NO
// economic invention (all economics await the owner-approved Network
// Economics Specification).

export interface UnbondingEntry {
  id: number;
  delegator: string;
  validator: string;
  amount_u: number;
  created_height: number;
  release_ms: number;
  claimed_height: number | null;
}

export interface TxPayload {
  [k: string]: unknown;
}

export interface Tx {
  type: TxType;
  from: string; // mtq1… address of the signer
  nonce: number; // per-account strictly increasing
  fee: number; // uMTQD (asset FEE)
  payload: TxPayload;
  sig: string; // hex ed25519 signature over canonicalTxBytes
  pub_key: string; // hex ed25519 public key of the signer
}

// Canonical tx bytes: FIXED key order, JSON.stringify (no whitespace).
// The signature is computed over exactly these UTF-8 bytes. Any field added
// to Tx must NOT enter the signed set without a chain-id-aware version bump.
export function canonicalTxBytes(tx: Omit<Tx, "sig" | "pub_key">): Uint8Array {
  const obj: Record<string, unknown> = {
    type: tx.type,
    from: tx.from,
    nonce: tx.nonce,
    fee: tx.fee,
  };
  // payload keys sorted → deterministic regardless of insertion order
  if (tx.payload && Object.keys(tx.payload).length > 0) {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(tx.payload).sort()) sorted[k] = tx.payload[k];
    obj.payload = sorted;
  }
  return enc.encode(JSON.stringify(obj));
}

export function txHash(tx: Tx): string {
  const c = canonicalTxBytes(tx);
  const sig = fromHex(tx.sig);
  const buf = new Uint8Array(c.length + sig.length);
  buf.set(c, 0);
  buf.set(sig, c.length);
  return "tx_" + toHex(sha256(buf));
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

export interface BlockHeader {
  chain_id: string;
  height: number; // 1-based; height 0 = genesis
  time_ms: number;
  prev_hash: string; // "blk_"… ; "" at height 1
  txs_root: string; // merkle root of included tx hashes ("mroot_…")
  state_root: string; // sha256 of canonical state snapshot ("sroot_…")
  validators_hash: string; // sha256 of canonical ACTIVE validator set
  proposer: string; // validator address
  round: number; // consensus round that finalized this block (0-based)
}

export interface QuorumCertificate {
  height: number;
  round: number;
  block_hash: string;
  precommits: Array<{ voter: string; power: number; sig: string }>; // ed25519 sigs over blockHash
  total_voting_power: number;
  committed_power: number;
}

export interface Block {
  header: BlockHeader;
  txs: Tx[];
  qc: QuorumCertificate;
}

export function blockHeaderHash(h: BlockHeader): string {
  return "blk_" + toHex(sha256(enc.encode(JSON.stringify(h))));
}

export function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return "mroot_empty";
  let level = hashes.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : level[i]; // duplicate last on odd
      next.push("m0_" + toHex(sha256(enc.encode(a + b))));
    }
    level = next;
  }
  return "mroot_" + level[0];
}

// ─── Validators ───────────────────────────────────────────────────────────────

export type ValidatorStatus = "ACTIVE" | "CANDIDATE" | "RETIRED" | "JAILED";

export interface Validator {
  pub_key: string; // hex ed25519
  address: string; // mtq1…
  moniker: string;
  power: number; // voting power (integers; = self-bond + delegated at last recompute)
  commission_bp: number; // basis points, informational (no reward stream — economics UNAPPROVED)
  status: ValidatorStatus;
  self_stake: number;
  delegated: number;
  joined_height: number;
}

export function validatorsHash(vals: Validator[]): string {
  const canonical = vals
    .filter((v) => v.status === "ACTIVE")
    .map((v) => ({ a: v.address, p: v.power, k: v.pub_key }))
    .sort((x, y) => (x.a < y.a ? -1 : 1));
  return "vhash_" + toHex(sha256(enc.encode(JSON.stringify(canonical))));
}

// +2/3 BFT quorum: strictly greater than 2/3 of total voting power.
export function hasQuorum(committedPower: number, totalPower: number): boolean {
  if (totalPower <= 0) return false;
  return committedPower * 3 > totalPower * 2;
}

// ─── Governance ───────────────────────────────────────────────────────────────

export type ProposalType =
  | "text"
  | "network_param"
  | "validator_set_change"; // add | remove | repower (V4 dynamic-membership mechanism)

export type ProposalStatus =
  | "DEPOSIT_PERIOD" // reserved (deposit paid upfront today)
  | "VOTING"
  | "PASSED"
  | "REJECTED"
  | "EXECUTION_QUEUED" // passed, waiting timelock
  | "EXECUTED"
  | "FAILED_EXECUTION";

export interface GovProposal {
  id: number;
  type: ProposalType;
  title: string;
  description: string;
  proposer: string;
  status: ProposalStatus;
  submitted_height: number;
  voting_end_ms: number;
  execute_after_ms: number; // timelock
  executed_height: number | null;
  payload: Record<string, unknown>;
  deposit: number;
  yes_power: number;
  no_power: number;
  abstain_power: number;
}

export type VoteOption = "YES" | "NO" | "ABSTAIN";

// Network-parameter allowlist (constitutional guard): network governance may
// ONLY touch these keys. Anything resembling MTQ monetary registry parameters
// is REJECTED at submission (Part 2 rules 2/3: network governance must not
// acquire control over MTQ monetary governance).
export const NETWORK_PARAM_ALLOWLIST: Record<string, { min: number; max: number; note: string }> = {
  base_fee_u: { min: 0, max: 1_000_000, note: "minimum tx fee in uMTQD" },
  max_block_txs: { min: 1, max: 5000, note: "transactions per block cap" },
  voting_period_s: { min: 10, max: 604800, note: "governance voting period seconds" },
  timelock_s: { min: 0, max: 86400, note: "passed-proposal execution delay seconds" },
  heartbeat_ms: { min: 1000, max: 60000, note: "empty-block heartbeat interval ms" },
  unbonding_s: { min: 0, max: 2_592_000, note: "unbonding queue period seconds (0 = immediate release)" },
};

// Substrings that identify monetary-registry territory — rejected outright.
export const MONETARY_GUARD_PATTERNS = [
  "weight", "basket", "reserve", "haircut", "buffer", "oracle", "mase",
  "marp", "mint_fee", "redeem", "supply", "index", "parity", "gold",
  "currency", "constituency", "lifecycle", "n_max", "theta", "envelope",
];

export function violatesMonetaryGuard(key: string): boolean {
  const k = key.toLowerCase();
  return MONETARY_GUARD_PATTERNS.some((p) => k.includes(p));
}

// ─── Consensus messages (in-process transport bus payloads) ──────────────────

export type ConsensusMessage =
  | { kind: "proposal"; height: number; round: number; from: string; header: BlockHeader; txHashes: string[]; sig: string }
  | { kind: "prevote"; height: number; round: number; from: string; blockHash: string | null; sig: string }
  | { kind: "precommit"; height: number; round: number; from: string; blockHash: string | null; sig: string };

// Canonical bytes a consensus signature covers (per message kind).
export function canonicalVoteBytes(
  kind: "prevote" | "precommit",
  height: number,
  round: number,
  voter: string,
  blockHash: string | null,
): Uint8Array {
  return enc.encode(JSON.stringify({ kind, height, round, voter, block: blockHash }));
}

export function canonicalProposalSigBytes(
  height: number,
  round: number,
  proposer: string,
  txsRoot: string,
): Uint8Array {
  return enc.encode(
    JSON.stringify({ kind: "proposal", height, round, proposer, txs_root: txsRoot }),
  );
}

// ─── Chain identifiers ────────────────────────────────────────────────────────

export const CHAIN_ID = "mtq-devnet-1";
export const MICRO = 1_000_000;

export interface ChainParams {
  base_fee_u: number;
  max_block_txs: number;
  voting_period_s: number;
  timelock_s: number;
  heartbeat_ms: number;
  unbonding_s: number;
}

export const DEFAULT_CHAIN_PARAMS: ChainParams = {
  base_fee_u: 1000,
  max_block_txs: 200,
  voting_period_s: 60,
  timelock_s: 15,
  heartbeat_ms: 5000,
  unbonding_s: 30, // devnet-paced queue (production value awaits the approved Network Economics Specification)
};
