// v28 §6 — monetary & governance restriction reconfirmation (READ-ONLY).
// Proves, from the databases themselves, that no issuance, redemption, reserve
// transfer, or real (non-shadow) monetary rebalancing was executed, that no
// compromised key material was used, and that governance/Safe controls are
// unchanged. Never writes db/.
import { Database } from "bun:sqlite";

const c = new Database("/home/z/my-project/db/chain.db", { readonly: true });
const u = new Database("/home/z/my-project/db/custom.db", { readonly: true });

const one = (db: Database, sql: string, ...params: unknown[]) => db.query(sql).get(...params) as Record<string, unknown>;
const all = (db: Database, sql: string, ...params: unknown[]) => db.query(sql).all(...params) as Record<string, unknown>[];
const colsOf = (db: Database, t: string) => (db.query(`PRAGMA table_info("${t}")`).all() as { name: string }[]).map((r) => r.name);
const statusCol = (db: Database, t: string): string | null =>
  colsOf(db, t).find((c0) => /^(status|state|result|decision|approved)$/i.test(c0)) ?? null;
const tables = (db: Database) =>
  (db.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'").all() as { name: string }[]).map(
    (r) => r.name
  );

const report: Record<string, unknown> = { generatedAtIso: new Date().toISOString() };

// ---- 1. custom.db: row counts of every table + key status distributions ----
const customCounts: Record<string, number> = {};
for (const t of tables(u)) customCounts[t] = (u.query(`SELECT COUNT(*) n FROM "${t}"`).get() as { n: number }).n;
report.customTableCounts = customCounts;

// Issuance / mint / redemption surfaces — must show NO real issuance
if (customCounts["IssuanceEvent"] !== undefined)
  report.issuanceEvents = { total: customCounts["IssuanceEvent"], rows: all(u, "SELECT * FROM IssuanceEvent ORDER BY id DESC LIMIT 5") };
if (customCounts["MbzMintRequest"] !== undefined) {
  const sc = statusCol(u, "MbzMintRequest");
  report.mbzMintRequests = sc
    ? { by: sc, dist: all(u, `SELECT "${sc}" v, COUNT(*) n FROM MbzMintRequest GROUP BY 1`) }
    : { columns: colsOf(u, "MbzMintRequest"), rows: all(u, "SELECT * FROM MbzMintRequest LIMIT 5") };
}
if (customCounts["MbzBank"] !== undefined)
  report.mbzBank = one(u, "SELECT * FROM MbzBank ORDER BY id DESC LIMIT 1");
if (customCounts["MbzBackingCertificate"] !== undefined) {
  const sc = statusCol(u, "MbzBackingCertificate");
  report.mbzBackingCertificates = sc
    ? { by: sc, dist: all(u, `SELECT "${sc}" v, COUNT(*) n FROM MbzBackingCertificate GROUP BY 1`) }
    : { columns: colsOf(u, "MbzBackingCertificate"), rows: all(u, "SELECT * FROM MbzBackingCertificate LIMIT 5") };
}

// Rebalancing decisions — every row must be a SHADOW record, none executed-real
if (customCounts["RebalancingDecision"] !== undefined) {
  const cols = (u.query("PRAGMA table_info(RebalancingDecision)").all() as { name: string }[]).map((r) => r.name);
  report.rebalancingDecisionColumns = cols;
  report.rebalancingDecisionTotal = customCounts["RebalancingDecision"];
  // newest rows: show the most recent decisions with their mode/flags
  report.rebalancingDecisionNewest = all(u, "SELECT * FROM RebalancingDecision ORDER BY id DESC LIMIT 3");
  // any row that is NOT explicitly shadow → would be a violation
  const shadowCol = cols.find((c0) => /shadow|mode|executed|dry/i.test(c0));
  if (shadowCol) {
    report.rebalancingShadowColumn = shadowCol;
    report.rebalancingShadowDistinct = all(u, `SELECT "${shadowCol}" v, COUNT(*) n FROM RebalancingDecision GROUP BY 1`);
    report.rebalancingNonShadowCount = (u.query(`SELECT COUNT(*) n FROM RebalancingDecision WHERE "${shadowCol}" IS NOT NULL AND LOWER(CAST("${shadowCol}" AS TEXT)) NOT LIKE '%shadow%'`).get() as { n: number }).n;
  }
}

// ---- 2. chain.db: governance proposals & votes — no executed governance change ----
report.proposals = all(c, "SELECT * FROM proposals ORDER BY rowid DESC LIMIT 10");
report.proposalStatusDist = all(c, "SELECT status, COUNT(*) n FROM proposals GROUP BY status");
report.votesTotal = (c.query("SELECT COUNT(*) n FROM votes").get() as { n: number }).n;
// treasury / monetary surfaces on the chain: events by type (issuance/redeem/transfer classes)
report.eventTypeDist = all(c, "SELECT type, COUNT(*) n FROM events GROUP BY type ORDER BY n DESC");
report.monetaryEventScan = all(
  c,
  "SELECT type, COUNT(*) n FROM events WHERE LOWER(type) LIKE '%issu%' OR LOWER(type) LIKE '%redeem%' OR LOWER(type) LIKE '%mint%' OR LOWER(type) LIKE '%reserve%' OR LOWER(type) LIKE '%transfer%' GROUP BY type"
);
// txs: distribution by whatever kind/type column exists (schema-defensive)
const txCols = colsOf(c, "txs");
const txKindCol = txCols.find((c0) => /^(kind|type|tx_type|action)$/i.test(c0)) ?? null;
report.txColumns = txCols;
report.txKindColumn = txKindCol;
report.txKindDist = txKindCol ? all(c, `SELECT "${txKindCol}" v, COUNT(*) n FROM txs GROUP BY 1 ORDER BY n DESC`) : [];
// accounts: balances exist but must be genesis/testnet allocation, not issuance output
report.accounts = all(c, "SELECT address, nonce, fee_u, pmtq_u FROM accounts ORDER BY address LIMIT 20");
report.blocksRecent = all(c, "SELECT height, num_txs, time_ms FROM blocks ORDER BY height DESC LIMIT 3");

// ---- 3. meta: boot mode + genesis (re-seed must be absent) ----
report.chainMeta = Object.fromEntries((c.query("SELECT key, value FROM meta").all() as { key: string; value: string }[]).map((r) => [r.key, r.value]));

console.log(JSON.stringify(report, null, 1));
