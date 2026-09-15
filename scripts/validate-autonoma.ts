// Validate the MTQΣ Autonoma integration against the live dev server.
// Uses the SDK's checkAllScenarios() which runs `up` then `down` against
// the same handler the dashboard hits, returning structured errors.

import { checkAllScenarios, signBody, type CheckScenario } from '@autonoma-ai/sdk'
import { factories } from '../src/lib/autonoma/factories'
import { readFileSync } from 'fs'

const SHARED_SECRET = process.env.AUTONOMA_SHARED_SECRET!
if (!SHARED_SECRET) {
  console.error('AUTONOMA_SHARED_SECRET not set')
  process.exit(1)
}

// Load recipe.json, extract the standard scenario.
// Pre-substitute {{testRunShortId}} so the SDK's checkAllScenarios can
// run the actual create/teardown. Autonoma does this substitution at
// runtime with a real testRunId; for validation we use a fixed value.
const SHORT_ID = 't' + Math.random().toString(36).slice(2, 9)  // 8 chars
const TEST_RUN_ID = 'val-' + SHORT_ID + '-0000-0000-000000000000'
const recipe = JSON.parse(
  readFileSync('/home/z/.autonoma/my-project/recipe.json', 'utf8')
    .replaceAll('{{testRunShortId}}', SHORT_ID)
    .replaceAll('{{testRunId}}', TEST_RUN_ID)
)
const standardRecipe = recipe.recipes[0]
const scenario: CheckScenario = { create: standardRecipe.create }

async function main() {
  console.log('=== sdk check: validating recipe against factories ===\n')
  console.log(`scenario: ${standardRecipe.name}`)
  console.log(`entities:`)
  for (const [model, rows] of Object.entries(scenario.create)) {
    console.log(`  ${model}: ${rows.length} row(s)`)
  }
  console.log('')

  const results = await checkAllScenarios(factories, [scenario], {
    scopeField: 'testRunId',
    sharedSecret: SHARED_SECRET,
    signingSecret: `${SHARED_SECRET}-internal-signing-v1`,
    auth: async () => ({}),
  })

  const r = results[0]
  console.log('=== result ===')
  console.log('valid:', r.valid)
  console.log('phase:', r.phase)
  if (r.timing) console.log(`timing: up=${r.timing.upMs}ms, down=${r.timing.downMs}ms`)
  if (r.errors.length > 0) {
    console.log('errors:')
    for (const e of r.errors) {
      console.log(`  [${e.phase}] ${e.message}`)
      if (e.fix) console.log(`     fix: ${e.fix}`)
    }
    process.exit(1)
  }
  console.log('\n✓ All factories validated — up + down round-trip clean.')
}

main().catch(e => {
  console.error('FAILED:', e)
  process.exit(1)
})
