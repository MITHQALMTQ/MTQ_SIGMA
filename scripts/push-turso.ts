import { createClient } from '@libsql/client'
import { readFileSync } from 'fs'

const url = process.env.TURSO_DATABASE_URL!
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error('TURSO_DATABASE_URL not set')
  process.exit(1)
}

const sql = readFileSync('/tmp/turso_migration.sql', 'utf8')

async function main() {
  const client = createClient({ url, authToken })
  console.log('Connecting to:', url)

  // Execute each statement (libSQL client executes one statement per execute() call)
  // Split on ");" boundary carefully — but better: use the `batch` API.
  // Parse statements by splitting on lines that end with `;`
  const statements: string[] = []
  let current = ''
  for (const line of sql.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('--')) continue // skip comments
    current += line + '\n'
    if (trimmed.endsWith(';')) {
      // Make idempotent: CREATE TABLE/INDEX -> CREATE TABLE/INDEX IF NOT EXISTS
      let stmt = current.trim().replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ')
      stmt = stmt.replace(/^CREATE INDEX /, 'CREATE INDEX IF NOT EXISTS ')
      statements.push(stmt)
      current = ''
    }
  }
  if (current.trim()) statements.push(current.trim())

  console.log(`Executing ${statements.length} statements...`)
  await client.batch(
    statements.map(stmt => ({ sql: stmt, args: [] })),
    'write'
  )
  console.log('✓ All tables and indexes created.')

  // Verify by listing tables
  const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
  console.log('Tables in Turso:')
  for (const row of tables.rows) {
    console.log(' -', row.name)
  }
}

main().catch(e => {
  console.error('Migration failed:', e)
  process.exit(1)
})
