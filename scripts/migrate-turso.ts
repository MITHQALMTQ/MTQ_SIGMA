// One-time migration script: creates all Prisma-defined tables on Turso (libSQL).
// Run with: bun run scripts/migrate-turso.ts
import { createClient } from '@libsql/client'
import * as dotenv from 'dotenv'

dotenv.config()

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url || !authToken) {
  console.error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set')
  process.exit(1)
}

const client = createClient({ url, authToken })

// SQL DDL matching prisma/schema.prisma models exactly.
// libSQL/Turso supports TEXT PRIMARY KEY, REAL, INTEGER, BOOLEAN, TEXT.
const statements = [
  // PilotTrial
  `CREATE TABLE IF NOT EXISTS "PilotTrial" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "type" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "inputAmount" REAL NOT NULL,
    "inputSymbol" TEXT NOT NULL,
    "outputAmount" REAL NOT NULL,
    "outputSymbol" TEXT NOT NULL,
    "gfbIndex" REAL NOT NULL,
    "mtqPrice" REAL NOT NULL,
    "nav" REAL NOT NULL,
    "reserveRatio" REAL NOT NULL,
    "lcr" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "basketJson" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT 1,
    "reason" TEXT,
    "wallet" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // MetricSample
  `CREATE TABLE IF NOT EXISTS "MetricSample" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "gfbIndex" REAL NOT NULL,
    "mtqPrice" REAL NOT NULL,
    "nav" REAL NOT NULL,
    "reserveRatio" REAL NOT NULL,
    "lcr" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "vix" REAL NOT NULL,
    "dxy" REAL NOT NULL,
    "targetGold" REAL NOT NULL,
    "bufferState" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // DailyStateVector (with indexes)
  `CREATE TABLE IF NOT EXISTS "DailyStateVector" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "tickAt" DATETIME NOT NULL,
    "tickCount" INTEGER NOT NULL,
    "gfbIndex" REAL NOT NULL,
    "mtqPrice" REAL NOT NULL,
    "priceInBand" BOOLEAN NOT NULL,
    "navUsd" REAL NOT NULL,
    "liabilityUsd" REAL NOT NULL,
    "reserveRatio" REAL NOT NULL,
    "lcr" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "circulatingSupply" REAL NOT NULL,
    "totalSupply" REAL NOT NULL,
    "usdNet" REAL NOT NULL,
    "eurNet" REAL NOT NULL,
    "gbpNet" REAL NOT NULL,
    "jpyNet" REAL NOT NULL,
    "cnyNet" REAL NOT NULL,
    "chfNet" REAL NOT NULL,
    "goldNet" REAL NOT NULL,
    "fiatNet" REAL NOT NULL,
    "vix" REAL NOT NULL,
    "dxy" REAL NOT NULL,
    "zVix" REAL NOT NULL,
    "zDxy" REAL NOT NULL,
    "rawTheta" REAL NOT NULL,
    "smoothedGoldWeight" REAL NOT NULL,
    "targetGoldWeight" REAL NOT NULL,
    "observedGoldWeight" REAL NOT NULL,
    "bufferState" TEXT NOT NULL,
    "bufferGoldRatio" REAL NOT NULL,
    "ejectStage" INTEGER NOT NULL,
    "pegHealthJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // RebalancingDecision (with indexes)
  `CREATE TABLE IF NOT EXISTS "RebalancingDecision" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "tickAt" DATETIME NOT NULL,
    "tickCount" INTEGER NOT NULL,
    "navUsd" REAL NOT NULL,
    "reserveRatio" REAL NOT NULL,
    "observedGoldWeight" REAL NOT NULL,
    "targetGoldWeight" REAL NOT NULL,
    "deviationPct" REAL NOT NULL,
    "shouldRebalance" BOOLEAN NOT NULL,
    "direction" INTEGER NOT NULL,
    "tradeUsd" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "blockedBy" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT 0,
    "preGoldNet" REAL,
    "postGoldNet" REAL,
    "preFiatNet" REAL,
    "postFiatNet" REAL,
    "postReserveRatio" REAL,
    "postObservedGoldWeight" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // OracleSample (with indexes)
  `CREATE TABLE IF NOT EXISTS "OracleSample" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "tickAt" DATETIME NOT NULL,
    "tickCount" INTEGER NOT NULL,
    "pair" TEXT NOT NULL,
    "chainlinkValid" BOOLEAN NOT NULL,
    "chainlinkPrice" REAL NOT NULL,
    "pythValid" BOOLEAN NOT NULL,
    "pythPrice" REAL NOT NULL,
    "chronicleValid" BOOLEAN NOT NULL,
    "chroniclePrice" REAL NOT NULL,
    "validCount" INTEGER NOT NULL,
    "finalPrice" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "spreadBps" INTEGER NOT NULL,
    "paused" BOOLEAN NOT NULL,
    "discardReasons" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,

  // Indexes (DailyStateVector)
  `CREATE INDEX IF NOT EXISTS "DailyStateVector_tickAt_idx" ON "DailyStateVector" ("tickAt")`,
  `CREATE INDEX IF NOT EXISTS "DailyStateVector_status_idx" ON "DailyStateVector" ("status")`,

  // Indexes (RebalancingDecision)
  `CREATE INDEX IF NOT EXISTS "RebalancingDecision_tickAt_idx" ON "RebalancingDecision" ("tickAt")`,
  `CREATE INDEX IF NOT EXISTS "RebalancingDecision_shouldRebalance_idx" ON "RebalancingDecision" ("shouldRebalance")`,

  // Indexes (OracleSample)
  `CREATE INDEX IF NOT EXISTS "OracleSample_tickAt_idx" ON "OracleSample" ("tickAt")`,
  `CREATE INDEX IF NOT EXISTS "OracleSample_pair_idx" ON "OracleSample" ("pair")`,
  `CREATE INDEX IF NOT EXISTS "OracleSample_paused_idx" ON "OracleSample" ("paused")`,
]

async function main() {
  console.log(`Connecting to Turso: ${url}`)
  for (const stmt of statements) {
    try {
      await client.execute(stmt)
      const preview = stmt.replace(/\s+/g, ' ').slice(0, 80)
      console.log(`OK: ${preview}...`)
    } catch (err: any) {
      console.error(`FAIL: ${err.message}`)
      console.error(`SQL: ${stmt}`)
    }
  }
  console.log('Migration complete.')

  // Verify: list tables
  const res = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  console.log('\nTables on Turso:')
  for (const row of res.rows) {
    console.log(`  - ${row.name}`)
  }
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
