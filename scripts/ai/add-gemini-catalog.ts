// Task 54 (2026-11-08) — add the probe-verified Google AI Studio (Gemini)
// models to AiModelCatalog. Idempotent (INSERT OR REPLACE) so it can be
// re-run after a sandbox re-image restores custom.db from the git-tracked
// dump (the cloud-sync loop then re-baselines the dump with these rows).
//
// Honest status semantics — the owner-supplied AQ.… key AUTHENTICATES (bogus
// keys return API_KEY_INVALID; this one passes auth), and the live model IDs
// were probe-verified via the 404-vs-geo-400 discriminator:
//   gemini-3.8-flash  → exists (400 FAILED_PRECONDITION "User location…")
//   gemini-3.5-flash  → exists (same)
//   gemini-2.0-flash  → RETIRED (Google's own 404 retirement notice)
// The sandbox egress region is geo-blocked by Google, so status records the
// honest live-probe outcome: GEO_BLOCKED_400 (not WORKING — generation was
// never observed from here; it serves from supported regions e.g. Vercel US).
import { createClient } from "@libsql/client";
import { join } from "node:path";

const ROWS = [
  { id: "gemini::gemini-3.8-flash", model: "gemini-3.8-flash", role: "anchor" },
  { id: "gemini::gemini-3.5-flash", model: "gemini-3.5-flash", role: "verifier" },
];

const c = createClient({ url: `file:${join(import.meta.dir, "..", "..", "db", "custom.db")}` });
const now = new Date().toISOString();
for (const r of ROWS) {
  await c.execute({
    sql: `INSERT OR REPLACE INTO "AiModelCatalog"
      ("id","provider","model","role","status","latencyMs","free","contextK","source","lastProbedAt","updatedAt")
      VALUES (?, 'gemini', ?, ?, 'GEO_BLOCKED_400', NULL, 1, NULL, 'task54-gemini-reaudit', ?, ?)`,
    args: [r.id, r.model, r.role, now, now],
  });
  console.log(`upserted ${r.id} (GEO_BLOCKED_400)`);
}
const total = await c.execute(`SELECT COUNT(*) AS n FROM "AiModelCatalog"`);
const byProv = await c.execute(`SELECT provider, COUNT(*) AS n FROM "AiModelCatalog" GROUP BY provider`);
console.log("catalog total:", total.rows[0].n, "| byProvider:", byProv.rows.map((r) => `${r.provider}:${r.n}`).join(" "));
c.close();
