// THROWAWAY (V31 §9 Phase 4 forensics — delete after use; untracked).
// Imports the PUBLISHED v9 custom dump into an ISOLATED temp DB at
// /tmp/mtq-v9verify/custom.db via bun:sqlite native exec with journaling
// disabled (analysis speed only — the dump's own BEGIN/COMMIT wrapper still
// lands the transaction atomically before close). Never touches db/custom.db.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";

const path = "/tmp/mtq-v9verify/custom.db";
const db = new Database(path, { create: true });
const text = readFileSync("/home/z/my-project/backups/db-snapshots/latest-custom.sql", "utf8");
db.exec("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;");
const t0 = Date.now();
db.exec(text);
console.log("exec ms:", Date.now() - t0);
const qc = db.query("PRAGMA quick_check").get();
console.log("quick_check:", JSON.stringify(qc));
db.close();
console.log("V9_TEMP_IMPORT_DONE");
