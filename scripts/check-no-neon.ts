#!/usr/bin/env bun
/**
 * CI Guardrail: No Neon imports in Vercel API routes.
 *
 * Per COO/PM brief: "Vercel serverless routes must NEVER query Neon directly."
 * This script scans all route.ts files under src/app/api/ and fails if any
 * imports pg, psycopg2, @neondatabase/serverless — OR, since Task 16-fix-A
 * (audit 16e-004), any INDIRECT usage via the local neon-client wrapper
 * ("@/lib/neon-client" / "lib/neon-client" / any *neon-client import or
 * dynamic import()). The indirection is how src/app/api/sync/route.ts
 * previously queried Neon while this guard reported clean.
 *
 * Run locally: bun run scripts/check-no-neon.ts
 * Run in CI:   part of .github/workflows/ci.yml
 *
 * Exit 0 = clean, Exit 1 = violation found.
 */

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const API_DIR = join(process.cwd(), 'src', 'app', 'api')
const FORBIDDEN_PATTERNS = [
  /from\s+['"]pg['"]/,
  /from\s+['"]pg-pool['"]/,
  /from\s+['"]psycopg2['"]/,
  /from\s+['"]psycopg2-binary['"]/,
  /from\s+['"]@neondatabase\/serverless['"]/,
  /from\s+['"]@neondatabase\/pg['"]/,
  // [16e-004 fix, Task 16-fix-A] INDIRECT Neon usage: a route importing the
  // local neon-client wrapper queries Neon just the same — the sync route
  // evaded the previous (direct-only) guard via exactly this indirection.
  /from\s+['"][^'"]*neon-client['"]/,
  /import\(\s*['"][^'"]*neon-client['"]\s*\)/,
  /require\s*\(\s*['"]pg['"]\)/,
  /require\s*\(\s*['"]psycopg2['"]\)/,
  /require\s*\(\s*['"]@neondatabase\/serverless['"]\)/,
  /require\s*\(\s*['"][^'"]*neon-client['"]\)/,
]

function findRouteFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath))
    } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
      files.push(fullPath)
    }
  }
  return files
}

function main() {
  console.log('🔍 Checking for forbidden Neon/Postgres imports in API routes...')
  console.log(`   Scanning: ${API_DIR}\n`)

  let violations = 0
  const routeFiles = findRouteFiles(API_DIR)

  if (routeFiles.length === 0) {
    console.log('⚠️  No route.ts files found — check path.')
    process.exit(0)
  }

  for (const file of routeFiles) {
    const content = readFileSync(file, 'utf8')
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        const rel = file.replace(process.cwd() + '/', '')
        console.error(`❌ ${rel}: matches ${pattern}`)
        violations++
      }
    }
  }

  if (violations > 0) {
    console.error(`\n✗ ${violations} violation(s) found.`)
    console.error('  Vercel serverless routes must NEVER query Neon directly —')
    console.error('  including INDIRECTLY via @/lib/neon-client (16e-004).')
    console.error('  Use Turso (via @libsql/client) for all DB access.')
    console.error('')
    console.error('  EXPECTED FAILURE (Task 16-fix-A, audit 16e-004): this guard now')
    console.error('  also detects indirect Neon usage. src/app/api/sync/route.ts still')
    console.error('  imports @/lib/neon-client (queries Neon when NEON_DATABASE_URL is')
    console.error('  set), so this check FAILS until the sync route is refactored to stop')
    console.error('  querying Neon from a serverless route (refactor is owned outside')
    console.error('  16-fix-A). The red CI is the HONEST detection of a real, known issue')
    console.error('  — do not silence, allowlist, or weaken this guard in the meantime.')
    process.exit(1)
  }

  console.log(`✓ Scanned ${routeFiles.length} route files — no Neon/Postgres imports found.`)
  process.exit(0)
}

main()
