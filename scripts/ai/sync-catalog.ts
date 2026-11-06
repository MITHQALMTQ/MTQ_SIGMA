// Task 47 — sync the provider model catalogs into custom.db
import { syncModelCatalogs } from "@/lib/ai/catalog";
import { db } from "@/lib/db";

async function main() {
  const r = await syncModelCatalogs();
  console.log(JSON.stringify(r, null, 2));
  const working = await db.aiModelCatalog.findMany({
    where: { status: "WORKING" },
    orderBy: [{ provider: "asc" }, { latencyMs: "asc" }],
  });
  console.log("\nWORKING models:");
  for (const w of working) console.log(`  ${w.provider} :: ${w.model} (${w.latencyMs}ms) role=${w.role ?? "-"}`);
  const excluded = await db.aiModelCatalog.findMany({ where: { status: "EXCLUDED" } });
  console.log(`\nEXCLUDED by z.ai policy: ${excluded.length} → ${excluded.map((e) => `${e.provider}/${e.model}`).join(", ")}`);
  const total = await db.aiModelCatalog.count();
  console.log(`\ntotal catalog rows: ${total}`);
}
main();
