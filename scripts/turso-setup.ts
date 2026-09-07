import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DB_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

(async () => {
  console.log("Creating PilotTrial table on Turso...");
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS PilotTrial (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        chain TEXT NOT NULL,
        inputAmount REAL NOT NULL,
        inputSymbol TEXT NOT NULL,
        outputAmount REAL NOT NULL,
        outputSymbol TEXT NOT NULL,
        gfbIndex REAL NOT NULL,
        mtqPrice REAL NOT NULL,
        nav REAL NOT NULL,
        reserveRatio REAL NOT NULL,
        lcr REAL NOT NULL,
        status TEXT NOT NULL,
        basketJson TEXT,
        ok INTEGER NOT NULL DEFAULT 1,
        reason TEXT,
        wallet TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("✓ PilotTrial table created");
  } catch (e: any) { console.log("PilotTrial:", e.message?.slice(0, 100)); }

  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS MetricSample (
        id TEXT PRIMARY KEY,
        gfbIndex REAL NOT NULL,
        mtqPrice REAL NOT NULL,
        nav REAL NOT NULL,
        reserveRatio REAL NOT NULL,
        lcr REAL NOT NULL,
        status TEXT NOT NULL,
        vix REAL NOT NULL,
        dxy REAL NOT NULL,
        targetGold REAL NOT NULL,
        bufferState TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log("✓ MetricSample table created");
  } catch (e: any) { console.log("MetricSample:", e.message?.slice(0, 100)); }

  // Test read
  try {
    const r = await client.execute("SELECT COUNT(*) as count FROM PilotTrial");
    console.log("PilotTrial count:", r.rows[0]);
  } catch (e: any) { console.log("Read test:", e.message?.slice(0, 100)); }

  console.log("Done.");
})();
