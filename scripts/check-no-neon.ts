#!/usr/bin/env bun
/**
 * CI Guardrail: No Neon imports in Vercel API routes.
 *
 * Per COO/PM brief: "Vercel serverless routes must NEVER query Neon directly."
 * This script scans all route.ts files under src/app/api/ and fails if any
 * imports pg, psycopg2, or @neondatabase/serverless.
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
  /require\s*\(\s*['"]pg['"]\)/,
  /require\s*\(\s*['"]psycopg2['"]\)/,
  /require\s*\(\s*['"]@neondatabase\/serverless['"]\)/,
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
    console.error('  Vercel serverless routes must NEVER query Neon directly.')
    console.error('  Use Turso (via @libsql/client) for all DB access.')
    process.exit(1)
  }

  console.log(`✓ Scanned ${routeFiles.length} route files — no Neon/Postgres imports found.`)
  process.exit(0)
}

main()
