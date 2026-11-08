// MTQΣ Network — Sovereign Devnet Reference Node (persistence layer)
//
// The chain keeps its OWN SQLite database (db/chain.db, raw SQL via
// @libsql/client) — deliberately SEPARATE from the pilot monetary engine's
// Prisma store. Layer separation per Part 2 rule 1: network infrastructure
// and monetary logic are distinct architectural layers. The blockchain data
// here is the chain's own ledger of network activity; it is NOT a source of
// MTQ monetary protocol state.

import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { canonicalRoot } from "../db-ops";
import { blockHeaderHash, type Block, type ChainParams, type GovProposal, type OracleObservation, type OraclePriceRecord, type Tx, type UnbondingEntry, type Validator } from "./shared";

let client: Client | null = null;

export function chainDb(): Client {
  if (client) return client;
  // v28 §5 root-cause fix: resolve against canonicalRoot(), NOT raw cwd —
  // Next's standalone server.js chdirs into .next/standalone at boot, and
  // the bundle contains a build-time COPY of db/; a raw-cwd join here made
  // the production chain node append blocks into that throwaway copy
  // (observed live, two runs) while the canonical db/ stayed frozen.
  const dbPath = join(canonicalRoot(), "db", "chain.db");
  const url = `file:${dbPath}`;
  mkdirSync(dirname(dbPath), { recursive: true });
  client = createClient({ url });
  return client;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS blocks (
  height INTEGER PRIMARY KEY,
  hash TEXT NOT NULL,
  header TEXT NOT NULL,
  qc TEXT NOT NULL,
  num_txs INTEGER NOT NULL,
  time_ms INTEGER NOT NULL,
  consensus_ms INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS txs (
  hash TEXT PRIMARY KEY,
  height INTEGER NOT NULL,
  idx INTEGER NOT NULL,
  raw TEXT NOT NULL,
  result TEXT NOT NULL,
  time_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_txs_height ON txs(height);
CREATE INDEX IF NOT EXISTS idx_txs_from ON txs(json_extract(raw, '$.from'));
CREATE TABLE IF NOT EXISTS accounts (
  address TEXT PRIMARY KEY,
  nonce INTEGER NOT NULL DEFAULT 0,
  fee_u INTEGER NOT NULL DEFAULT 0,
  pmtq_u INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS validators (
  pub_key TEXT PRIMARY KEY,
  address TEXT NOT NULL UNIQUE,
  moniker TEXT NOT NULL,
  power INTEGER NOT NULL DEFAULT 0,
  commission_bp INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'CANDIDATE',
  self_stake INTEGER NOT NULL DEFAULT 0,
  delegated INTEGER NOT NULL DEFAULT 0,
  joined_height INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS stakes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delegator TEXT NOT NULL,
  validator TEXT NOT NULL,
  amount_u INTEGER NOT NULL,
  created_height INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stakes_val ON stakes(validator);
CREATE INDEX IF NOT EXISTS idx_stakes_del ON stakes(delegator);
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  proposer TEXT NOT NULL,
  status TEXT NOT NULL,
  submitted_height INTEGER NOT NULL,
  voting_end_ms INTEGER NOT NULL,
  execute_after_ms INTEGER NOT NULL,
  executed_height INTEGER,
  payload TEXT NOT NULL,
  deposit INTEGER NOT NULL DEFAULT 0,
  yes_power INTEGER NOT NULL DEFAULT 0,
  no_power INTEGER NOT NULL DEFAULT 0,
  abstain_power INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS votes (
  proposal_id INTEGER NOT NULL,
  voter TEXT NOT NULL,
  option TEXT NOT NULL,
  power INTEGER NOT NULL,
  height INTEGER NOT NULL,
  PRIMARY KEY (proposal_id, voter)
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  height INTEGER NOT NULL,
  type TEXT NOT NULL,
  data TEXT NOT NULL,
  time_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_height ON events(height);
CREATE TABLE IF NOT EXISTS unbondings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  delegator TEXT NOT NULL,
  validator TEXT NOT NULL,
  amount_u INTEGER NOT NULL,
  created_height INTEGER NOT NULL,
  release_ms INTEGER NOT NULL,
  claimed_height INTEGER
);
CREATE INDEX IF NOT EXISTS idx_unbondings_del ON unbondings(delegator, claimed_height);
CREATE INDEX IF NOT EXISTS idx_unbondings_release ON unbondings(claimed_height, release_ms);
CREATE TABLE IF NOT EXISTS oracle_observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  height INTEGER NOT NULL,
  observer TEXT NOT NULL,
  family TEXT NOT NULL,
  symbol TEXT NOT NULL,
  value_u INTEGER NOT NULL,
  time_ms INTEGER NOT NULL,
  UNIQUE (height, observer, family, symbol)
);
CREATE INDEX IF NOT EXISTS idx_oracle_obs_symbol ON oracle_observations(symbol, height);
CREATE TABLE IF NOT EXISTS oracle_prices (
  symbol TEXT PRIMARY KEY,
  height INTEGER NOT NULL,
  value_u INTEGER NOT NULL,
  families INTEGER NOT NULL,
  observers INTEGER NOT NULL,
  spread_bp INTEGER NOT NULL,
  status TEXT NOT NULL,
  family_medians TEXT NOT NULL,
  time_ms INTEGER NOT NULL
);
`;

// HMR-migration guard: instrumentation only boots the node once per server
// process, but dev-mode module reloads can create fresh store instances —
// ensure the unbondings table exists before any queue operation.
let unbondingsTableReady = false;
async function ensureUnbondingsTable(): Promise<void> {
  if (unbondingsTableReady) return;
  await chainDb().execute(
    "CREATE TABLE IF NOT EXISTS unbondings (id INTEGER PRIMARY KEY AUTOINCREMENT, delegator TEXT NOT NULL, validator TEXT NOT NULL, amount_u INTEGER NOT NULL, created_height INTEGER NOT NULL, release_ms INTEGER NOT NULL, claimed_height INTEGER)",
  );
  await chainDb().execute("CREATE INDEX IF NOT EXISTS idx_unbondings_del ON unbondings(delegator, claimed_height)");
  await chainDb().execute("CREATE INDEX IF NOT EXISTS idx_unbondings_release ON unbondings(claimed_height, release_ms)");
  unbondingsTableReady = true;
}

// HMR-migration guard (same pattern as unbondings): the oracle tables must
// exist before any observation/price operation on a freshly reloaded module.
let oracleTablesReady = false;
async function ensureOracleTables(): Promise<void> {
  if (oracleTablesReady) return;
  await chainDb().execute(
    "CREATE TABLE IF NOT EXISTS oracle_observations (id INTEGER PRIMARY KEY AUTOINCREMENT, height INTEGER NOT NULL, observer TEXT NOT NULL, family TEXT NOT NULL, symbol TEXT NOT NULL, value_u INTEGER NOT NULL, time_ms INTEGER NOT NULL, UNIQUE (height, observer, family, symbol))",
  );
  await chainDb().execute("CREATE INDEX IF NOT EXISTS idx_oracle_obs_symbol ON oracle_observations(symbol, height)");
  await chainDb().execute(
    "CREATE TABLE IF NOT EXISTS oracle_prices (symbol TEXT PRIMARY KEY, height INTEGER NOT NULL, value_u INTEGER NOT NULL, families INTEGER NOT NULL, observers INTEGER NOT NULL, spread_bp INTEGER NOT NULL, status TEXT NOT NULL, family_medians TEXT NOT NULL, time_ms INTEGER NOT NULL)",
  );
  oracleTablesReady = true;
}

export async function initSchema(): Promise<void> {
  const c = chainDb();
  await c.batch(
    SCHEMA.split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((stmt) => ({ sql: stmt, args: [] })),
  );
}

// ─── meta ─────────────────────────────────────────────────────────────────────

export async function getMeta(key: string): Promise<string | null> {
  const r = await chainDb().execute({ sql: "SELECT value FROM meta WHERE key = ?", args: [key] });
  return r.rows[0] ? String(r.rows[0].value) : null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await chainDb().execute({
    sql: "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, value],
  });
}

// ─── blocks ───────────────────────────────────────────────────────────────────

export async function putBlock(b: Block, consensusMs: number): Promise<void> {
  await chainDb().execute({
    sql: "INSERT OR REPLACE INTO blocks (height, hash, header, qc, num_txs, time_ms, consensus_ms) VALUES (?,?,?,?,?,?,?)",
    args: [
      b.header.height,
      blockHeaderHash(b.header),
      JSON.stringify(b.header),
      JSON.stringify(b.qc),
      b.txs.length,
      b.header.time_ms,
      Math.round(consensusMs),
    ],
  });
}

export async function getHeight(): Promise<number> {
  const r = await chainDb().execute("SELECT COALESCE(MAX(height), 0) AS h FROM blocks");
  return Number(r.rows[0]?.h ?? 0);
}

export interface BlockRow {
  height: number;
  hash: string;
  header: Block["header"];
  qc: Block["qc"];
  num_txs: number;
  time_ms: number;
  consensus_ms: number;
}

export async function getBlocks(from: number, to: number, desc = true): Promise<BlockRow[]> {
  const r = await chainDb().execute({
    sql: `SELECT height, hash, header, qc, num_txs, time_ms, consensus_ms FROM blocks
          WHERE height >= ? AND height <= ? ORDER BY height ${desc ? "DESC" : "ASC"} LIMIT 500`,
    args: [from, to],
  });
  return r.rows.map(rowToBlockRow);
}

function rowToBlockRow(r: Record<string, unknown>): BlockRow {
  return {
    height: Number(r.height),
    hash: String(r.hash),
    header: JSON.parse(String(r.header)),
    qc: JSON.parse(String(r.qc)),
    num_txs: Number(r.num_txs),
    time_ms: Number(r.time_ms),
    consensus_ms: Number(r.consensus_ms),
  };
}

// ─── txs ──────────────────────────────────────────────────────────────────────

export interface TxRow {
  hash: string;
  height: number;
  idx: number;
  raw: Tx;
  result: { ok: boolean; error?: string; effects?: string[] };
  time_ms: number;
}

export async function putTx(
  hash: string,
  height: number,
  idx: number,
  raw: Tx,
  result: { ok: boolean; error?: string; effects?: string[] },
  timeMs: number,
): Promise<void> {
  await chainDb().execute({
    sql: "INSERT OR REPLACE INTO txs (hash, height, idx, raw, result, time_ms) VALUES (?,?,?,?,?,?)",
    args: [hash, height, idx, JSON.stringify(raw), JSON.stringify(result), timeMs],
  });
}

export async function getTx(hash: string): Promise<TxRow | null> {
  const r = await chainDb().execute({ sql: "SELECT * FROM txs WHERE hash = ?", args: [hash] });
  const row = r.rows[0];
  if (!row) return null;
  return {
    hash: String(row.hash),
    height: Number(row.height),
    idx: Number(row.idx),
    raw: JSON.parse(String(row.raw)),
    result: JSON.parse(String(row.result)),
    time_ms: Number(row.time_ms),
  };
}

export async function getTxsByHeight(height: number): Promise<TxRow[]> {
  const r = await chainDb().execute({
    sql: "SELECT * FROM txs WHERE height = ? ORDER BY idx ASC",
    args: [height],
  });
  return r.rows.map(txRow);
}

export async function getRecentTxs(limit: number): Promise<TxRow[]> {
  const r = await chainDb().execute({
    sql: `SELECT * FROM txs ORDER BY height DESC, idx DESC LIMIT ?`,
    args: [limit],
  });
  return r.rows.map(txRow);
}

export async function getTxsByAddress(address: string, limit: number): Promise<TxRow[]> {
  const r = await chainDb().execute({
    sql: `SELECT * FROM txs
          WHERE json_extract(raw, '$.from') = ? OR json_extract(raw, '$.payload.to') = ?
          ORDER BY height DESC, idx DESC LIMIT ?`,
    args: [address, address, limit],
  });
  return r.rows.map(txRow);
}

function txRow(r: Record<string, unknown>): TxRow {
  return {
    hash: String(r.hash),
    height: Number(r.height),
    idx: Number(r.idx),
    raw: JSON.parse(String(r.raw)),
    result: JSON.parse(String(r.result)),
    time_ms: Number(r.time_ms),
  };
}

// ─── accounts / validators / stakes / proposals / votes / events ─────────────

export async function getAccount(address: string): Promise<{ nonce: number; fee_u: number; pmtq_u: number }> {
  const r = await chainDb().execute({
    sql: "SELECT nonce, fee_u, pmtq_u FROM accounts WHERE address = ?",
    args: [address],
  });
  const row = r.rows[0];
  return { nonce: Number(row?.nonce ?? 0), fee_u: Number(row?.fee_u ?? 0), pmtq_u: Number(row?.pmtq_u ?? 0) };
}

export async function ensureAccount(address: string): Promise<void> {
  await chainDb().execute({
    sql: "INSERT OR IGNORE INTO accounts (address) VALUES (?)",
    args: [address],
  });
}

/** Partial account update — only the provided fields change. */
export async function executeAccountUpdate(
  address: string,
  fields: { nonce?: number; fee_u?: number; pmtq_u?: number },
): Promise<void> {
  await ensureAccount(address);
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (fields.nonce !== undefined) { sets.push("nonce = ?"); args.push(fields.nonce); }
  if (fields.fee_u !== undefined) { sets.push("fee_u = ?"); args.push(fields.fee_u); }
  if (fields.pmtq_u !== undefined) { sets.push("pmtq_u = ?"); args.push(fields.pmtq_u); }
  if (!sets.length) return;
  args.push(address);
  await chainDb().execute({ sql: `UPDATE accounts SET ${sets.join(", ")} WHERE address = ?`, args });
}

export async function nextProposalId(): Promise<number> {
  const r = await chainDb().execute("SELECT COALESCE(MAX(id), 0) AS m FROM proposals");
  return Number(r.rows[0]?.m ?? 0) + 1;
}

export async function updateStakeAmount(id: number, amountU: number): Promise<void> {
  await chainDb().execute({
    sql: "UPDATE stakes SET amount_u = ? WHERE id = ?",
    args: [amountU, id],
  });
}

export async function getValidators(): Promise<Validator[]> {
  const r = await chainDb().execute("SELECT * FROM validators ORDER BY power DESC, moniker ASC");
  return r.rows.map((row) => ({
    pub_key: String(row.pub_key),
    address: String(row.address),
    moniker: String(row.moniker),
    power: Number(row.power),
    commission_bp: Number(row.commission_bp),
    status: String(row.status) as Validator["status"],
    self_stake: Number(row.self_stake),
    delegated: Number(row.delegated),
    joined_height: Number(row.joined_height),
  }));
}

export async function putValidator(v: Validator): Promise<void> {
  await chainDb().execute({
    sql: `INSERT INTO validators (pub_key, address, moniker, power, commission_bp, status, self_stake, delegated, joined_height)
          VALUES (?,?,?,?,?,?,?,?,?)
          ON CONFLICT(pub_key) DO UPDATE SET moniker=excluded.moniker, power=excluded.power,
            commission_bp=excluded.commission_bp, status=excluded.status,
            self_stake=excluded.self_stake, delegated=excluded.delegated`,
    args: [
      v.pub_key, v.address, v.moniker, v.power, v.commission_bp,
      v.status, v.self_stake, v.delegated, v.joined_height,
    ],
  });
}

export async function getStakes(delegator?: string, validator?: string) {
  const conds: string[] = [];
  const args: (string | number)[] = [];
  if (delegator) { conds.push("delegator = ?"); args.push(delegator); }
  if (validator) { conds.push("validator = ?"); args.push(validator); }
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const r = await chainDb().execute({
    sql: `SELECT id, delegator, validator, amount_u, created_height FROM stakes ${where} ORDER BY id DESC LIMIT 1000`,
    args,
  });
  return r.rows.map((row) => ({
    id: Number(row.id),
    delegator: String(row.delegator),
    validator: String(row.validator),
    amount_u: Number(row.amount_u),
    created_height: Number(row.created_height),
  }));
}

export async function putStake(delegator: string, validator: string, amountU: number, height: number): Promise<void> {
  await chainDb().execute({
    sql: "INSERT INTO stakes (delegator, validator, amount_u, created_height) VALUES (?,?,?,?)",
    args: [delegator, validator, amountU, height],
  });
}

// ─── unbonding queue ─────────────────────────────────────────────────────────

function unbondingRow(r: Record<string, unknown>): UnbondingEntry {
  return {
    id: Number(r.id),
    delegator: String(r.delegator),
    validator: String(r.validator),
    amount_u: Number(r.amount_u),
    created_height: Number(r.created_height),
    release_ms: Number(r.release_ms),
    claimed_height: r.claimed_height == null ? null : Number(r.claimed_height),
  };
}

export async function putUnbonding(delegator: string, validator: string, amountU: number, height: number, releaseMs: number): Promise<void> {
  await ensureUnbondingsTable();
  await chainDb().execute({
    sql: "INSERT INTO unbondings (delegator, validator, amount_u, created_height, release_ms) VALUES (?,?,?,?,?)",
    args: [delegator, validator, amountU, height, releaseMs],
  });
}

/** Pending (unclaimed) unbonding entries — optionally filtered by delegator. */
export async function getUnbondings(delegator?: string): Promise<UnbondingEntry[]> {
  await ensureUnbondingsTable();
  const r = delegator
    ? await chainDb().execute({
        sql: "SELECT * FROM unbondings WHERE claimed_height IS NULL AND delegator = ? ORDER BY release_ms ASC, id ASC LIMIT 500",
        args: [delegator],
      })
    : await chainDb().execute(
        "SELECT * FROM unbondings WHERE claimed_height IS NULL ORDER BY release_ms ASC, id ASC LIMIT 1000",
      );
  return r.rows.map(unbondingRow);
}

/** Mature (release_ms <= now) pending entries — eligible for automatic claim. */
export async function getMatureUnbondings(nowMs: number): Promise<UnbondingEntry[]> {
  await ensureUnbondingsTable();
  const r = await chainDb().execute({
    sql: "SELECT * FROM unbondings WHERE claimed_height IS NULL AND release_ms <= ? ORDER BY release_ms ASC, id ASC LIMIT 500",
    args: [nowMs],
  });
  return r.rows.map(unbondingRow);
}

export async function markUnbondingClaimed(id: number, height: number): Promise<boolean> {
  await ensureUnbondingsTable();
  // Atomic claim gate: the guarded UPDATE succeeds for exactly ONE caller —
  // under any concurrent writer, the loser sees rowsAffected 0 and must NOT
  // credit the account (prevents double-release of the same queue entry).
  const r = await chainDb().execute({
    sql: "UPDATE unbondings SET claimed_height = ? WHERE id = ? AND claimed_height IS NULL",
    args: [height, id],
  });
  return Number((r as unknown as { rowsAffected?: number }).rowsAffected ?? 0) === 1;
}

export async function getProposals(): Promise<GovProposal[]> {
  const r = await chainDb().execute("SELECT * FROM proposals ORDER BY id DESC LIMIT 200");
  return r.rows.map((row) => ({
    id: Number(row.id),
    type: String(row.type) as GovProposal["type"],
    title: String(row.title),
    description: String(row.description),
    proposer: String(row.proposer),
    status: String(row.status) as GovProposal["status"],
    submitted_height: Number(row.submitted_height),
    voting_end_ms: Number(row.voting_end_ms),
    execute_after_ms: Number(row.execute_after_ms),
    executed_height: row.executed_height == null ? null : Number(row.executed_height),
    payload: JSON.parse(String(row.payload)),
    deposit: Number(row.deposit),
    yes_power: Number(row.yes_power),
    no_power: Number(row.no_power),
    abstain_power: Number(row.abstain_power),
  }));
}

export async function putProposal(p: GovProposal): Promise<void> {
  await chainDb().execute({
    sql: `INSERT INTO proposals (id, type, title, description, proposer, status, submitted_height,
            voting_end_ms, execute_after_ms, executed_height, payload, deposit, yes_power, no_power, abstain_power)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET status=excluded.status, executed_height=excluded.executed_height,
            yes_power=excluded.yes_power, no_power=excluded.no_power, abstain_power=excluded.abstain_power`,
    args: [
      p.id, p.type, p.title, p.description, p.proposer, p.status,
      p.submitted_height, p.voting_end_ms, p.execute_after_ms, p.executed_height,
      JSON.stringify(p.payload), p.deposit, p.yes_power, p.no_power, p.abstain_power,
    ],
  });
}

export async function getVotes(proposalId: number) {
  const r = await chainDb().execute({
    sql: "SELECT proposal_id, voter, option, power, height FROM votes WHERE proposal_id = ? ORDER BY height DESC",
    args: [proposalId],
  });
  return r.rows.map((row) => ({
    proposal_id: Number(row.proposal_id),
    voter: String(row.voter),
    option: String(row.option),
    power: Number(row.power),
    height: Number(row.height),
  }));
}

export async function putVote(proposalId: number, voter: string, option: string, power: number, height: number): Promise<void> {
  await chainDb().execute({
    sql: "INSERT OR REPLACE INTO votes (proposal_id, voter, option, power, height) VALUES (?,?,?,?,?)",
    args: [proposalId, voter, option, power, height],
  });
}

export async function putEvent(height: number, type: string, data: Record<string, unknown>, timeMs: number): Promise<void> {
  await chainDb().execute({
    sql: "INSERT INTO events (height, type, data, time_ms) VALUES (?,?,?,?)",
    args: [height, type, JSON.stringify(data), timeMs],
  });
}

export async function getRecentEvents(limit: number) {
  const r = await chainDb().execute({
    sql: "SELECT id, height, type, data, time_ms FROM events ORDER BY id DESC LIMIT ?",
    args: [limit],
  });
  return r.rows.map((row) => ({
    id: Number(row.id),
    height: Number(row.height),
    type: String(row.type),
    data: JSON.parse(String(row.data)),
    time_ms: Number(row.time_ms),
  }));
}

// ─── params ───────────────────────────────────────────────────────────────────

export async function loadParams(defaults: ChainParams): Promise<ChainParams> {
  const raw = await getMeta("chain_params");
  if (!raw) return { ...defaults };
  try {
    const parsed = JSON.parse(raw) as Partial<ChainParams>;
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

export async function saveParams(p: ChainParams): Promise<void> {
  await setMeta("chain_params", JSON.stringify(p));
}

// ─── oracle consensus (§17.10 reference, Task-43) ─────────────────────────────

function oracleObservationRow(r: Record<string, unknown>): OracleObservation {
  return {
    id: Number(r.id),
    height: Number(r.height),
    observer: String(r.observer),
    family: String(r.family),
    symbol: String(r.symbol),
    value_u: Number(r.value_u),
    time_ms: Number(r.time_ms),
  };
}

function oraclePriceRow(r: Record<string, unknown>): OraclePriceRecord {
  return {
    symbol: String(r.symbol),
    height: Number(r.height),
    value_u: Number(r.value_u),
    families: Number(r.families),
    observers: Number(r.observers),
    spread_bp: Number(r.spread_bp),
    status: String(r.status) as OraclePriceRecord["status"],
    family_medians: JSON.parse(String(r.family_medians)) as OraclePriceRecord["family_medians"],
    time_ms: Number(r.time_ms),
  };
}

/** Record a validator observation. Returns false on the one-per-block
 *  per-(observer, family, symbol) duplicate (enforced by the UNIQUE index —
 *  applyTx turns this into a FAILED receipt, never a silent overwrite). */
export async function putOracleObservation(
  observer: string,
  family: string,
  symbol: string,
  valueU: number,
  height: number,
  timeMs: number,
): Promise<boolean> {
  await ensureOracleTables();
  try {
    const r = await chainDb().execute({
      sql: "INSERT INTO oracle_observations (height, observer, family, symbol, value_u, time_ms) VALUES (?,?,?,?,?,?)",
      args: [height, observer, family, symbol, valueU, timeMs],
    });
    return Number((r as unknown as { rowsAffected?: number }).rowsAffected ?? 0) === 1;
  } catch {
    return false; // UNIQUE violation — duplicate observation in this block
  }
}

/** All observations from `fromHeight` upward (fresh window for aggregation). */
export async function getOracleObservations(fromHeight: number): Promise<OracleObservation[]> {
  await ensureOracleTables();
  const r = await chainDb().execute({
    sql: "SELECT * FROM oracle_observations WHERE height >= ? ORDER BY id ASC LIMIT 2000",
    args: [fromHeight],
  });
  return r.rows.map((row) => oracleObservationRow(row as Record<string, unknown>));
}

/** Most recent observations (provenance feed for the UI/explorer). */
export async function getRecentOracleObservations(limit = 25): Promise<OracleObservation[]> {
  await ensureOracleTables();
  const r = await chainDb().execute({
    sql: "SELECT * FROM oracle_observations ORDER BY id DESC LIMIT ?",
    args: [limit],
  });
  return r.rows.map((row) => oracleObservationRow(row as Record<string, unknown>));
}

export async function upsertOraclePrice(rec: OraclePriceRecord): Promise<void> {
  await ensureOracleTables();
  await chainDb().execute({
    sql: "INSERT INTO oracle_prices (symbol, height, value_u, families, observers, spread_bp, status, family_medians, time_ms) VALUES (?,?,?,?,?,?,?,?,?) " +
      "ON CONFLICT(symbol) DO UPDATE SET height=excluded.height, value_u=excluded.value_u, families=excluded.families, observers=excluded.observers, spread_bp=excluded.spread_bp, status=excluded.status, family_medians=excluded.family_medians, time_ms=excluded.time_ms",
    args: [rec.symbol, rec.height, rec.value_u, rec.families, rec.observers, rec.spread_bp, rec.status, JSON.stringify(rec.family_medians), rec.time_ms],
  });
}

export async function getOraclePrices(): Promise<OraclePriceRecord[]> {
  await ensureOracleTables();
  const r = await chainDb().execute("SELECT * FROM oracle_prices ORDER BY symbol ASC LIMIT 200");
  return r.rows.map((row) => oraclePriceRow(row as Record<string, unknown>));
}
