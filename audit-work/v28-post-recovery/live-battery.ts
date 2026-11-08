// v28 §3 — read-only live chain battery (verification only; no writes)
// NOTE binding discipline: db.query(sql, params) silently drops params in bun 1.3.14 —
// always bind via statement methods: db.query(sql).get(params) / .all(params).
import { Database } from "bun:sqlite";

const c = new Database("/home/z/my-project/db/chain.db", { readonly: true });

const mn = c.query("SELECT MIN(height) h FROM blocks").get() as { h: number };
const tip = c.query("SELECT MAX(height) h, COUNT(*) n FROM blocks").get() as { h: number; n: number };
const gaps = c.query(
  "SELECT COUNT(*) n FROM (SELECT height, LAG(height) OVER (ORDER BY height) prev FROM blocks) WHERE height-prev != 1"
).get() as { n: number };
const integ = c.query("PRAGMA integrity_check").get() as Record<string, string>;

const gb = c.query("SELECT hash, header FROM blocks WHERE height=?").get(mn.h) as { hash: string; header: string };
const b2 = c.query("SELECT hash, header FROM blocks WHERE height=?").get(mn.h + 1) as { hash: string; header: string };
const hg = JSON.parse(gb.header);
const h2 = JSON.parse(b2.header);
const tipB = c.query("SELECT hash, header FROM blocks WHERE height=?").get(tip.h) as { hash: string; header: string };

const meta = Object.fromEntries(
  (c.query("SELECT key, value FROM meta").all() as { key: string; value: string }[]).map((r) => [r.key, r.value])
);
const vals = c.query("SELECT COUNT(*) n FROM validators").get() as { n: number };
const tables = (c.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[]).map((r) => r.name);

const validators = c.query("SELECT * FROM validators ORDER BY 1").all();

// per-table row counts (chain.db) — guarded: a transient prepare failure
// during concurrent write bursts must not abort the battery (observed once:
// "no such table: accounts" on the first iteration while the write-behind
// dump refresh + chain advance were concurrent; direct re-test passes)
const chainCounts: Record<string, number> = {};
const chainCountErrors: Record<string, string> = {};
for (const t of tables) {
  try {
    chainCounts[t] = (c.query(`SELECT COUNT(*) n FROM "${t}"`).get() as { n: number }).n;
  } catch (e) {
    chainCountErrors[t] = String(e);
  }
}

console.log(
  JSON.stringify(
    {
      minHeight: mn.h,
      liveTip: tip,
      contiguousGaps: gaps.n,
      integrity: integ,
      genesisBlockHash: gb.hash,
      genesisChainId: hg.chain_id,
      genesisPrevHash: hg.prev_hash,
      b2PrevHash: h2.prev_hash,
      b2LinksGenesis: h2.prev_hash === gb.hash,
      tipHash: tipB.hash,
      tipChainId: JSON.parse(tipB.header).chain_id,
      validators: vals.n,
      meta,
      tables,
      chainCounts,
      validatorIdentities: validators,
    },
    null,
    1
  )
);
