/**
 * Migrate data from local SQLite -> Turso (libSQL).
 * Drops all rows in Turso first, then copies from local.
 */
import { Database } from 'bun:sqlite'
import { createClient } from '@libsql/client'

const LOCAL = 'db/custom.db'
const TURSO_URL = process.env.TURSO_DATABASE_URL!
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN

const TABLES = ['PilotTrial', 'MetricSample', 'DailyStateVector', 'RebalancingDecision', 'OracleSample']

async function main() {
  const local = new Database(LOCAL, { readonly: true })
  const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN })

  console.log(`Local DB: ${LOCAL}`)
  console.log(`Turso:    ${TURSO_URL}\n`)

  for (const table of TABLES) {
    const countRow = local.query(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number }
    const count = countRow.c
    console.log(`[${table}] local rows: ${count}`)

    if (count === 0) {
      console.log(`  → skipping (no data)\n`)
      continue
    }

    // Wipe remote table first (idempotent re-runs)
    await turso.execute(`DELETE FROM "${table}"`)
    console.log(`  → wiped remote`)

    // Stream rows in batches of 500
    const BATCH = 500
    const cols = (local.query(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(c => c.name)
    const placeholders = cols.map(() => '?').join(', ')
    const sql = `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`

    let inserted = 0
    const selectAll = local.query(`SELECT * FROM "${table}"`)
    // bun:sqlite returns an iterator for `.all()`; use `.all()` for simplicity
    const rows = local.query(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]

    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH)
      await turso.batch(
        slice.map(r => ({
          sql,
          // Convert Date/Timestamp -> ISO string; booleans stay as-is; null stays null
          args: cols.map(c => {
            const v = r[c]
            if (v instanceof Date) return v.toISOString()
            if (v instanceof Uint8Array) return Buffer.from(v).toString()
            return v as any
          }),
        })),
        'write'
      )
      inserted += slice.length
      if (inserted % 2500 === 0 || inserted === rows.length) {
        console.log(`  → inserted ${inserted}/${rows.length}`)
      }
    }
    console.log(`  ✓ done\n`)
  }

  // Verify final counts
  console.log('=== Final verification ===')
  for (const table of TABLES) {
    const r = await turso.execute(`SELECT COUNT(*) AS c FROM "${table}"`)
    console.log(`Turso ${table}: ${r.rows[0].c} rows`)
  }

  local.close()
}

main().catch(e => {
  console.error('Migration failed:', e)
  process.exit(1)
})
