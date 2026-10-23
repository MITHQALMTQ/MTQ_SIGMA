#!/usr/bin/env bun
/**
 * MTQΣ — Deterministic Compute Engine (TASK-5)
 *
 * A standalone script that computes the MASE (Multi-model Adaptive Stability
 * Engine) target weight vector for the MTQΣ reserve basket. This is the
 * "deterministic compute engine" that runs in Docker (Dockerfile.compute) on a
 * daily cron via GitHub Actions (.github/workflows/compute-engine.yml), and is
 * also runnable locally for development without Docker.
 *
 * WHAT IT DOES:
 *   1. Reads the current monetary state — either from Turso (production) or
 *      from a fixed genesis snapshot (--fixed-input, for determinism testing).
 *   2. Runs the MASE solver (advanceMase from engine.ts), which:
 *        - builds PriceData + VolatilityData from FX rates + state
 *        - detects the market regime from VIX/DXY
 *        - runs all 6 candidate models (min-var, ERC, max-div, CVaR, PPP, regime)
 *        - ensembles them equally → target weights
 *        - applies admissibility envelopes → constrained weights
 *        - EMA-smooths toward the constrained target (stress + velocity aware)
 *   3. Writes weight-vector.json with the computed weights + SHA-256 hash.
 *   4. Prints a one-line JSON: {"hash": "...", "weights": {...}, "timestamp": "..."}
 *
 * DETERMINISM GUARANTEES:
 *   - The MASE math path contains NO Math.random() and NO Date.now(). It is a
 *     pure function of (state, fx). Given the same inputs, it produces the same
 *     weights, byte-for-byte.
 *   - The hash covers ONLY the canonical JSON of the weights object (keys in
 *     COMPONENTS order, 12-decimal precision). The `timestamp` field is
 *     intentionally EXCLUDED from the hash so two runs at different times with
 *     the same inputs produce the same hash.
 *   - The Dockerfile pins node:20-slim + bun and sets OMP_NUM_THREADS=1,
 *     OPENBLAS_NUM_THREADS=1, MKL_NUM_THREADS=1, PYTHONHASHSEED=0,
 *     NODE_OPTIONS=--max-old-space-size=512 to eliminate thread-scheduling and
 *     hash-randomization non-determinism.
 *
 * MODES:
 *   bun run src/lib/mtq/compute-engine.ts
 *     # Read latest DailyStateVector from Turso, compute weights, write file.
 *     # Falls back to --fixed-input if Turso is unavailable or empty.
 *
 *   bun run src/lib/mtq/compute-engine.ts --fixed-input
 *     # Use a hardcoded FX snapshot + genesis state (no network). This is the
 *     # mode used by the CI determinism test (same inputs → same hash).
 *
 *   bun run src/lib/mtq/compute-engine.ts --verify-only
 *     # Read the existing weight-vector.json, recompute weights from the same
 *     # inputs, compare hashes. Exit 0 if MATCH, exit 1 if MISMATCH.
 *     # Combine with --fixed-input to verify against the fixed snapshot.
 *
 * EXIT CODES:
 *   0 = success (or --verify-only MATCH)
 *   1 = fatal error (or --verify-only MISMATCH)
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createClient, type Client } from '@libsql/client'

import { initReserveState, advanceMase, type ReserveState } from './engine'
import { STRATEGIC_PRIOR, type FxRates } from './blueprint'
import { COMPONENTS, type WeightVector } from './mase'

// ─── arg parsing ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const FIXED_INPUT = argv.includes('--fixed-input')
const VERIFY_ONLY = argv.includes('--verify-only')

// Output path — override via COMPUTE_ENGINE_OUTPUT env, default ./weight-vector.json
const OUTPUT_PATH = process.env.COMPUTE_ENGINE_OUTPUT ?? join(process.cwd(), 'weight-vector.json')

// ─── fixed genesis snapshot (for --fixed-input / CI determinism test) ──────
// These numbers are NOT meant to be "today's market" — they are a frozen
// reference snapshot chosen so that two runs of the compute engine produce
// byte-identical output. The MASE math is a pure function of these inputs.
const FIXED_GOLD_PRICE = 2650.0
const FIXED_FX: FxRates = {
  EUR_USD: 1.085,
  GBP_USD: 1.265,
  JPY_USD: 0.00665,
  CNY_USD: 0.1395,
  CHF_USD: 1.125,
  XAU_USD: FIXED_GOLD_PRICE,
  VIX: 17.5,
  DXY: 104.2,
  fetchedAt: 0,
  source: 'fixed-determinism-snapshot-v1',
}

// ─── canonical serialization + hashing ─────────────────────────────────────
// Deterministic JSON: keys in COMPONENTS order, 12-decimal precision (round
// to eliminate IEEE-754 representation drift across runs/platforms).
function canonicalWeightsJson(w: WeightVector): string {
  const obj: Record<string, number> = {}
  for (const c of COMPONENTS) {
    obj[c] = Math.round(w[c] * 1e12) / 1e12
  }
  return JSON.stringify(obj)
}

function hashWeights(w: WeightVector): string {
  return createHash('sha256').update(canonicalWeightsJson(w), 'utf8').digest('hex')
}

// ─── input sourcing ─────────────────────────────────────────────────────────
interface ComputeInputs {
  fx: FxRates
  state: ReserveState
  source: 'turso' | 'fixed' | 'turso-empty-fallback'
}

/**
 * Read the latest DailyStateVector from Turso and overlay its macro signals
 * (vix, dxy, status) onto a genesis base state. We do NOT try to fully
 * reconstruct the ~40-field ReserveState from the DB — the MASE weights are
 * determined by (lastVix, lastDxy, riskState, prev maseSmoothed, fx), so we
 * only need those fields from the live state. The reserve composition (token
 * holdings) does not affect the weight computation, only the post-trade
 * execution which is out of scope for this engine.
 */
async function readInputsFromTurso(): Promise<ComputeInputs | null> {
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) return null

  let client: Client
  try {
    client = createClient({ url, authToken })
  } catch {
    return null
  }

  try {
    const r = await client.execute({
      sql: `SELECT "vix", "dxy", "status", "smoothedGoldWeight", "targetGoldWeight", "observedGoldWeight", "bufferState" FROM "DailyStateVector" ORDER BY "tickAt" DESC LIMIT 1`,
      args: [],
    })
    if (r.rows.length === 0) return null

    const row = r.rows[0] as Record<string, unknown>
    const state = initReserveState(FIXED_GOLD_PRICE)
    state.lastVix = Number(row.vix) || FIXED_FX.VIX
    state.lastDxy = Number(row.dxy) || FIXED_FX.DXY
    const status = String(row.status ?? 'NORMAL') as ReserveState['riskState']['state']
    state.riskState.state = status
    // maseSmoothed starts null at genesis; advanceMase will fall back to
    // STRATEGIC_PRIOR. We deliberately do NOT restore a prev maseSmoothed
    // from the DB so the computation is a pure function of the macro signals
    // (deterministic per tick). The first advanceMase tick uses STRATEGIC_PRIOR
    // as the smoothing anchor.
    state.maseSmoothed = null

    // FX: the DailyStateVector doesn't store per-currency FX. We use the fixed
    // snapshot for the currency rates (the MASE weight math is relatively
    // insensitive to small FX drift — the dominant drivers are vix/dxy/regime).
    // VIX/DXY come from the live state.
    const fx: FxRates = { ...FIXED_FX, VIX: state.lastVix, DXY: state.lastDxy }

    return { fx, state, source: 'turso' }
  } catch (e) {
    console.error('[compute-engine] Turso read failed:', (e as Error).message)
    return null
  } finally {
    try { await client.close() } catch { /* ignore */ }
  }
}

function fixedInputs(): ComputeInputs {
  const state = initReserveState(FIXED_GOLD_PRICE)
  state.lastVix = FIXED_FX.VIX
  state.lastDxy = FIXED_FX.DXY
  state.riskState.state = 'NORMAL'
  state.maseSmoothed = null
  return { fx: FIXED_FX, state, source: 'fixed' }
}

async function getInputs(): Promise<ComputeInputs> {
  if (FIXED_INPUT) return fixedInputs()
  const fromTurso = await readInputsFromTurso()
  if (fromTurso) return fromTurso
  console.error('[compute-engine] Turso unavailable or empty — falling back to fixed genesis snapshot')
  return { ...fixedInputs(), source: 'turso-empty-fallback' }
}

// ─── the compute step ───────────────────────────────────────────────────────
async function computeWeights(): Promise<{ weights: WeightVector; hash: string; source: string; inputs: ComputeInputs }> {
  const inputs = await getInputs()
  // advanceMase mutates `state` in place: it sets state.maseSmoothed to the
  // new EMA-smoothed, envelope-constrained ensemble target. It also calls
  // commitChainIndexWeights() internally (wrapped in try/catch) which updates
  // the chain-index state — but that has no external side effects (no DB write,
  // no network). The function is a pure function of (state, fx).
  advanceMase(inputs.state, inputs.fx)
  const weights: WeightVector = inputs.state.maseSmoothed ?? (STRATEGIC_PRIOR as WeightVector)
  const hash = hashWeights(weights)
  return { weights, hash, source: inputs.source, inputs }
}

// ─── output ─────────────────────────────────────────────────────────────────
interface WeightVectorFile {
  hash: string
  weights: WeightVector
  timestamp: string // ISO 8601 — EXCLUDED from hash (non-deterministic)
  source: string
  mode: string
  inputs: {
    fx: FxRates
    lastVix: number
    lastDxy: number
    riskState: string
  }
}

function buildOutputFile(weights: WeightVector, hash: string, source: string, inputs: ComputeInputs): WeightVectorFile {
  return {
    hash,
    weights,
    timestamp: new Date().toISOString(),
    source,
    mode: FIXED_INPUT ? 'fixed-input' : 'turso',
    inputs: {
      fx: inputs.fx,
      lastVix: inputs.state.lastVix,
      lastDxy: inputs.state.lastDxy,
      riskState: inputs.state.riskState.state,
    },
  }
}

// ─── verify-only mode ───────────────────────────────────────────────────────
async function verifyOnly(): Promise<number> {
  if (!existsSync(OUTPUT_PATH)) {
    console.error(`[compute-engine] --verify-only: ${OUTPUT_PATH} not found`)
    return 1
  }
  const prev = JSON.parse(readFileSync(OUTPUT_PATH, 'utf8')) as WeightVectorFile
  const { weights, hash, source } = await computeWeights()
  const match = prev.hash === hash
  const result = {
    verify: match ? 'MATCH' : 'MISMATCH',
    prevHash: prev.hash,
    newHash: hash,
    prevSource: prev.source,
    newSource: source,
    prevTimestamp: prev.timestamp,
    newTimestamp: new Date().toISOString(),
    weights,
  }
  console.log(JSON.stringify(result, null, 2))
  return match ? 0 : 1
}

// ─── main ───────────────────────────────────────────────────────────────────
async function main(): Promise<number> {
  if (VERIFY_ONLY) {
    return verifyOnly()
  }

  const { weights, hash, source, inputs } = await computeWeights()
  const outputFile = buildOutputFile(weights, hash, source, inputs)

  // Write the full file (with timestamp + inputs for human auditability)
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, JSON.stringify(outputFile, null, 2) + '\n', 'utf8')

  // Print the one-line result for CI parsing:
  //   {"hash": "...", "weights": {...}, "timestamp": "..."}
  console.log(JSON.stringify({ hash, weights, timestamp: outputFile.timestamp }))
  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error('[compute-engine] fatal:', e)
    process.exit(1)
  })
