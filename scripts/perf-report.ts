/**
 * TASK-4 — Database performance report.
 *
 * Connects to Turso and runs representative dashboard queries against the
 * (now-indexed) PilotTrial and MetricSample tables. For each query it reports:
 *   1. wall-clock time (including network round-trip to Turso)
 *   2. EXPLAIN QUERY PLAN output (deterministic proof the index is used)
 *   3. estimated server-side execution time = wall-clock − network baseline
 *
 * The SLO is "every dashboard query < 50ms". From a client co-located with
 * Turso (e.g. Vercel us-east-1 → Turso us-east-1), the network RTT is <5ms so
 * wall-clock ≈ server time. From other regions the network dominates and the
 * wall-clock SLO is not measurable. We therefore assert on the
 * (wall-clock − baseline) value, which isolates the query cost. We ALSO assert
 * that EXPLAIN QUERY PLAN references the expected index for each query — that
 * is the deterministic, network-independent proof that the optimization landed.
 *
 * Usage:
 *   bun run scripts/perf-report.ts            # run queries, report timings
 *   bun run scripts/perf-report.ts --seed     # seed 1000 synthetic rows first
 *   bun run scripts/perf-report.ts --cleanup  # delete synthetic seed rows
 *
 * Exit codes:
 *   0 = all queries pass (server time < 50ms AND index used)
 *   1 = one or more queries fail SLO or don't use the expected index
 */

import { createClient, type Client } from '@libsql/client'
import { createHash } from 'crypto'

// --- arg parsing ---------------------------------------------------------
const argv = process.argv.slice(2)
const SEED = argv.includes('--seed')
const CLEANUP = argv.includes('--cleanup')

const PERF_SLO_MS = 50
const SYNTH_WALLET_PREFIX = '0xPERFTEST'
const SYNTH_STATUSES = ['NORMAL', 'CAUTION', 'DEFENSIVE', 'EMERGENCY', 'RECOVERY']
const SYNTH_CHAINS = ['monad-testnet', 'arc-testnet', 'solana-devnet', 'robinhood-testnet']

// --- libsql client (Prisma uses the same client under the hood via the
//     adapter, so query plans + timings are representative of the dashboard) -
function makeClient(): Client {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) throw new Error('TURSO_DATABASE_URL (or DATABASE_URL) must be set')
  return createClient({ url, authToken })
}

const client = makeClient()

// --- timing helpers ------------------------------------------------------
function now(): number {
  return performance.now()
}

interface QueryResult {
  name: string
  sql: string
  args: any[]
  expectedIndex: string // substring we expect to see in EXPLAIN QUERY PLAN
  wallMs: number
  serverMs: number // wallMs - baselineMs
  rows: number
  explainPlan: string
  indexUsed: boolean
  serverOk: boolean // serverMs < SLO
}

async function rawCount(table: string): Promise<number> {
  const r = await client.execute(`SELECT COUNT(*) AS c FROM "${table}"`)
  return Number((r.rows[0] as any).c)
}

async function measureBaseline(): Promise<{ cold: number; warm: number }> {
  // Cold first call (TCP+TLS handshake)
  const t0 = now()
  await client.execute('SELECT 1')
  const cold = now() - t0
  // Warm average over 5 calls
  const samples: number[] = []
  for (let i = 0; i < 5; i++) {
    const t = now()
    await client.execute('SELECT 1')
    samples.push(now() - t)
  }
  const warm = samples.reduce((a, b) => a + b, 0) / samples.length
  return { cold, warm }
}

async function explain(sql: string, args: any[]): Promise<string> {
  // libSQL client doesn't let you EXPLAIN a parameterized statement directly
  // via execute(), so we inline the first arg as a literal for the plan only.
  // This is safe: EXPLAIN QUERY PLAN never executes the statement.
  let inlined = sql
  for (const a of args) {
    let lit: string
    if (typeof a === 'string') lit = `'${a.replace(/'/g, "''")}'`
    else if (a instanceof Date) lit = `'${a.toISOString()}'`
    else if (a == null) lit = 'NULL'
    else lit = String(a)
    inlined = inlined.replace('?', lit)
  }
  const r = await client.execute(`EXPLAIN QUERY PLAN ${inlined}`)
  return r.rows.map((row) => String((row as any).detail ?? JSON.stringify(row))).join('\n')
}

async function runOne(
  name: string,
  sql: string,
  args: any[],
  expectedIndex: string,
  baselineMs: number,
): Promise<QueryResult> {
  const plan = await explain(sql, args)
  const t0 = now()
  const r = await client.execute({ sql, args })
  const wallMs = now() - t0
  const rows = r.rows.length
  const serverMs = Math.max(0, wallMs - baselineMs)
  const indexUsed = plan.includes(expectedIndex)
  return {
    name,
    sql,
    args,
    expectedIndex,
    wallMs,
    serverMs,
    rows,
    explainPlan: plan,
    indexUsed,
    serverOk: serverMs < PERF_SLO_MS,
  }
}

// --- seed / cleanup ------------------------------------------------------
async function seed(n: number): Promise<void> {
  console.log(`\n[seed] inserting ${n} synthetic PilotTrial + ${n} MetricSample rows...`)
  const nowMs = Date.now()
  const dayMs = 86_400_000
  const trials: any[][] = []
  for (let i = 0; i < n; i++) {
    const daysAgo = (i * 0.03) % 30
    trials.push([
      'mint',
      SYNTH_CHAINS[i % SYNTH_CHAINS.length],
      1000 + i,
      'USDC',
      990 + i,
      'MTQ',
      1.0 + (i % 100) * 0.0001,
      1.01 + (i % 100) * 0.0001,
      1_100_000 + i,
      1.1,
      1.05,
      SYNTH_STATUSES[i % SYNTH_STATUSES.length],
      null,
      1,
      null,
      SYNTH_WALLET_PREFIX + (i % 50).toString().padStart(4, '0'),
      new Date(nowMs - daysAgo * dayMs).toISOString(),
    ])
  }
  // 18 columns; id is generated by randomblob() so 17 placeholders for the
  // remaining columns: type,chain,inputAmount,inputSymbol,outputAmount,
  // outputSymbol,gfbIndex,mtqPrice,nav,reserveRatio,lcr,status,basketJson,
  // ok,reason,wallet,createdAt.
  const tSql = `INSERT INTO "PilotTrial" ("id","type","chain","inputAmount","inputSymbol","outputAmount","outputSymbol","gfbIndex","mtqPrice","nav","reserveRatio","lcr","status","basketJson","ok","reason","wallet","createdAt") VALUES (lower(hex(randomblob(16))),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  // libSQL batch
  const tBatch = trials.map((a) => ({ sql: tSql, args: a }))
  for (let i = 0; i < tBatch.length; i += 200) {
    await client.batch(tBatch.slice(i, i + 200), 'write')
  }

  const metrics: any[][] = []
  for (let i = 0; i < n; i++) {
    const daysAgo = (i * 0.03) % 30
    metrics.push([
      1.0 + (i % 100) * 0.0001,
      1.01 + (i % 100) * 0.0001,
      1_100_000 + i,
      1.1,
      1.05,
      SYNTH_STATUSES[i % SYNTH_STATUSES.length],
      18.5 + (i % 50) * 0.1,
      104.2 + (i % 30) * 0.05,
      0.26,
      'BASE',
      new Date(nowMs - daysAgo * dayMs).toISOString(),
    ])
  }
  const mSql = `INSERT INTO "MetricSample" ("id","gfbIndex","mtqPrice","nav","reserveRatio","lcr","status","vix","dxy","targetGold","bufferState","createdAt") VALUES (lower(hex(randomblob(16))),?,?,?,?,?,?,?,?,?,?,?)`
  const mBatch = metrics.map((a) => ({ sql: mSql, args: a }))
  for (let i = 0; i < mBatch.length; i += 200) {
    await client.batch(mBatch.slice(i, i + 200), 'write')
  }
  console.log(`[seed] done — inserted ${n} + ${n} rows`)
}

async function cleanup(): Promise<void> {
  console.log('\n[cleanup] removing synthetic seed rows...')
  const t = await client.execute({
    sql: `DELETE FROM "PilotTrial" WHERE wallet LIKE ?`,
    args: [SYNTH_WALLET_PREFIX + '%'],
  })
  console.log(`[cleanup] deleted ${(t as any).rowsAffected ?? '?'} PilotTrial rows`)
  const m = await client.execute({
    sql: `DELETE FROM "MetricSample" WHERE nav >= ? AND nav < ? AND "createdAt" >= ?`,
    args: [1_100_000, 1_101_000, new Date(Date.now() - 32 * 86_400_000).toISOString()],
  })
  console.log(`[cleanup] deleted ${(m as any).rowsAffected ?? '?'} MetricSample rows`)
}

// --- the queries under test ---------------------------------------------
async function runQueries(baselineMs: number): Promise<QueryResult[]> {
  const out: QueryResult[] = []
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString()

  // 1. PilotTrial — find by wallet equality (dashboard "export my trials")
  //    Uses @@index([wallet]). The actual /api/trials route currently orders
  //    by createdAt without a wallet filter, but the wallet index is for the
  //    "export my trials" feature → equality on a single wallet is the
  //    realistic pattern.
  out.push(
    await runOne(
      'PilotTrial WHERE wallet=? [wallet idx]',
      `SELECT * FROM "PilotTrial" WHERE wallet = ? ORDER BY "createdAt" DESC LIMIT 100`,
      [SYNTH_WALLET_PREFIX + '0000'],
      'PilotTrial_wallet_idx',
      baselineMs,
    ),
  )

  // 2. PilotTrial — find by status (dashboard filter)
  out.push(
    await runOne(
      'PilotTrial WHERE status=? [status idx]',
      `SELECT * FROM "PilotTrial" WHERE status = ? ORDER BY "createdAt" DESC LIMIT 100`,
      ['NORMAL'],
      'PilotTrial_status_idx',
      baselineMs,
    ),
  )

  // 3. PilotTrial — find by chain (dashboard chain tab)
  out.push(
    await runOne(
      'PilotTrial WHERE chain=? [chain idx]',
      `SELECT * FROM "PilotTrial" WHERE chain = ? LIMIT 100`,
      ['monad-testnet'],
      'PilotTrial_chain_idx',
      baselineMs,
    ),
  )

  // 4. PilotTrial — date range (dashboard recents last 7d)
  out.push(
    await runOne(
      'PilotTrial WHERE createdAt>=? [createdAt idx]',
      `SELECT * FROM "PilotTrial" WHERE "createdAt" >= ? ORDER BY "createdAt" DESC LIMIT 100`,
      [weekAgo],
      'PilotTrial_createdAt_idx',
      baselineMs,
    ),
  )

  // 5. PilotTrial — recent 50 (dashboard default view, ORDER BY createdAt)
  out.push(
    await runOne(
      'PilotTrial ORDER BY createdAt DESC LIMIT 50 [createdAt idx]',
      `SELECT * FROM "PilotTrial" ORDER BY "createdAt" DESC LIMIT 50`,
      [],
      'PilotTrial_createdAt_idx',
      baselineMs,
    ),
  )

  // 6. MetricSample — time series sparkline (last 200 by createdAt)
  out.push(
    await runOne(
      'MetricSample ORDER BY createdAt DESC LIMIT 200 [createdAt idx]',
      `SELECT * FROM "MetricSample" ORDER BY "createdAt" DESC LIMIT 200`,
      [],
      'MetricSample_createdAt_idx',
      baselineMs,
    ),
  )

  // 7. MetricSample — filter by status (risk-status filter)
  out.push(
    await runOne(
      'MetricSample WHERE status=? ORDER BY createdAt DESC LIMIT 100 [status idx]',
      `SELECT * FROM "MetricSample" WHERE status = ? ORDER BY "createdAt" DESC LIMIT 100`,
      ['NORMAL'],
      'MetricSample_status_idx',
      baselineMs,
    ),
  )

  // 8. MetricSample — date range (last 24h sparkline)
  out.push(
    await runOne(
      'MetricSample WHERE createdAt>=? ORDER BY createdAt DESC LIMIT 200 [createdAt idx]',
      `SELECT * FROM "MetricSample" WHERE "createdAt" >= ? ORDER BY "createdAt" DESC LIMIT 200`,
      [dayAgo],
      'MetricSample_createdAt_idx',
      baselineMs,
    ),
  )

  return out
}

// --- main ----------------------------------------------------------------
async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(' MTQΣ — TASK-4 Performance Report')
  console.log(` SLO: every dashboard query < ${PERF_SLO_MS}ms (server-side, excl. network)`)
  console.log('═══════════════════════════════════════════════════════════════')

  const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  console.log(`Target:  ${tursoUrl}`)

  const ptCount = await rawCount('PilotTrial')
  const msCount = await rawCount('MetricSample')
  console.log(`Row counts:  PilotTrial=${ptCount}  MetricSample=${msCount}`)

  if (CLEANUP) {
    await cleanup()
    await client.close()
    return
  }

  if (SEED) {
    await seed(1000)
  }

  if (ptCount === 0 && !SEED) {
    console.log('\n⚠️  PilotTrial is empty — queries will return [] instantly,')
    console.log('    but the index will not be exercised. Re-run with --seed')
    console.log('    to populate 1000 synthetic rows and get a meaningful timing.')
  }

  // Baseline network round-trip (warm average)
  console.log('\n[baseline] measuring network round-trip to Turso (SELECT 1)...')
  const baseline = await measureBaseline()
  console.log(
    `  cold=${baseline.cold.toFixed(1)}ms  warm-avg=${baseline.warm.toFixed(1)}ms (network RTT, excluded from SLO)`,
  )

  // Warm-up: run each query once to populate the SQLite page cache on Turso.
  console.log('\n[warmup] running each query once to populate page cache...')
  await runQueries(baseline.warm)

  // Measured run
  console.log('\n[measured] running queries...')
  const results = await runQueries(baseline.warm)

  // Report
  console.log('\n┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐')
  console.log('│ Query                                                          │  wall  │ server │ rows │ idx │ SLO  │')
  console.log('├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤')
  let allServerOk = true
  let allIndexOk = true
  for (const r of results) {
    const wall = r.wallMs.toFixed(1).padStart(6)
    const srv = r.serverMs.toFixed(1).padStart(6)
    const rows = String(r.rows).padStart(4)
    const idx = r.indexUsed ? ' ✓ ' : ' ✗ '
    const slo = r.serverOk ? ' ✓ ' : ' ✗ '
    const name = r.name.padEnd(62)
    console.log(`│ ${name} │ ${wall} │ ${srv} │ ${rows} │ ${idx} │ ${slo} │`)
    if (!r.serverOk) allServerOk = false
    if (!r.indexUsed) allIndexOk = false
  }
  console.log('└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘')
  console.log(`  (wall = wall-clock incl. network; server = wall − ${baseline.warm.toFixed(1)}ms baseline; idx = expected index found in EXPLAIN QUERY PLAN)`)

  // EXPLAIN QUERY PLAN detail (deterministic proof of index usage)
  console.log('\n── EXPLAIN QUERY PLAN (deterministic proof of index usage) ──')
  for (const r of results) {
    console.log(`\n  ${r.name}`)
    console.log(`    SQL: ${r.sql}`)
    console.log(`    expected index: ${r.expectedIndex}  →  ${r.indexUsed ? '✓ FOUND' : '✗ NOT FOUND'}`)
    for (const line of r.explainPlan.split('\n')) {
      console.log(`    plan: ${line}`)
    }
  }

  // Deterministic hash of the report (so CI can compare two runs)
  const reportHash = createHash('sha256')
    .update(
      results
        .map((r) => `${r.name}|server=${r.serverMs.toFixed(2)}ms|idx=${r.indexUsed ? 1 : 0}`)
        .join('||'),
    )
    .digest('hex')
    .slice(0, 16)

  const maxServer = Math.max(...results.map((r) => r.serverMs))
  const avgServer = results.reduce((a, b) => a + b.serverMs, 0) / results.length
  console.log(`\nSummary: max-server=${maxServer.toFixed(2)}ms  avg-server=${avgServer.toFixed(2)}ms  queries=${results.length}  reportHash=${reportHash}`)
  console.log(`         network-baseline=${baseline.warm.toFixed(2)}ms (warm avg)  cold-connect=${baseline.cold.toFixed(2)}ms`)

  const pass = allServerOk && allIndexOk
  if (pass) {
    console.log(`\n✓ PASS — all ${results.length} queries: server-time < ${PERF_SLO_MS}ms AND expected index used`)
  } else {
    if (!allServerOk) {
      const fails = results.filter((r) => !r.serverOk)
      console.log(`\n✗ FAIL — ${fails.length}/${results.length} queries exceeded ${PERF_SLO_MS}ms server-time:`)
      for (const f of fails) console.log(`    ${f.serverMs.toFixed(2)}ms  ${f.name}`)
    }
    if (!allIndexOk) {
      const fails = results.filter((r) => !r.indexUsed)
      console.log(`\n✗ FAIL — ${fails.length}/${results.length} queries did NOT use their expected index:`)
      for (const f of fails) console.log(`    expected ${f.expectedIndex}  ${f.name}`)
    }
  }

  await client.close()
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error('perf-report fatal:', e)
  process.exit(1)
})
