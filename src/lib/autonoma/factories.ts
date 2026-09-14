// MTQΣ — Autonoma SDK factory layer
//
// Wires the Autonoma test-data SDK into the MTQΣ closed-loop monetary
// architecture. Each factory creates an entity through the same database
// write path the application itself uses (the audit-trail `persistX`
// functions and the inline `db.pilotTrial.create` insert in
// /api/simulate/mint/route.ts).
//
// The MTQΣ app has no authentication system (it is a public institutional
// dashboard). The auth callback returns an empty AuthResult.
//
// Teardown is per-record (delete by id). Seeded ids contain the
// `{{testRunShortId}}` token, so each test run's rows are isolated and
// can be safely torn down without touching production data.

import { defineFactory } from '@autonoma-ai/sdk'
import { z } from 'zod'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────
// PilotTrial — inline insert in src/app/api/simulate/mint/route.ts
// The handler has no reusable function (the insert lives in the route
// handler itself), so we COPY the insert here verbatim, with a few
// ergonomics: accept all fields from the recipe and let the recipe
// supply concrete values.
// ─────────────────────────────────────────────────────────────────────
export const pilotTrialInput = z.object({
  id: z.string(),
  type: z.string(),
  chain: z.string(),
  inputAmount: z.number(),
  inputSymbol: z.string(),
  outputAmount: z.number(),
  outputSymbol: z.string(),
  gfbIndex: z.number(),
  mtqPrice: z.number(),
  nav: z.number(),
  reserveRatio: z.number(),
  lcr: z.number(),
  status: z.string(),
  basketJson: z.string().nullable().optional(),
  ok: z.boolean().default(true),
  reason: z.string().nullable().optional(),
  wallet: z.string().nullable().optional(),
  // Offset in minutes from seeding time — see integration prompt re: time
  createdAtMinutesAgo: z.number().default(120),
})

export const pilotTrialFactory = defineFactory({
  inputSchema: pilotTrialInput,
  async create(data) {
    const createdAt = new Date(Date.now() - data.createdAtMinutesAgo * 60_000)
    await db.pilotTrial.create({
      data: {
        id: data.id,
        type: data.type,
        chain: data.chain,
        inputAmount: data.inputAmount,
        inputSymbol: data.inputSymbol,
        outputAmount: data.outputAmount,
        outputSymbol: data.outputSymbol,
        gfbIndex: data.gfbIndex,
        mtqPrice: data.mtqPrice,
        nav: data.nav,
        reserveRatio: data.reserveRatio,
        lcr: data.lcr,
        status: data.status,
        basketJson: data.basketJson ?? null,
        ok: data.ok,
        reason: data.reason ?? null,
        wallet: data.wallet ?? null,
        createdAt,
      },
    })
    return { id: data.id }
  },
  async teardown(record) {
    await db.pilotTrial.delete({ where: { id: String(record.id) } })
  },
})

// ─────────────────────────────────────────────────────────────────────
// DailyStateVector — creation function `persistDailyStateVector` in
// src/lib/mtq/audit-trail.ts. That function takes a complex
// MetricsSnapshot object and transforms it into column values. For test
// data we already HAVE the column values (from scenarios.md), so we
// bypass the wrapper and call db.dailyStateVector.create directly with
// the same column shape persistDailyStateVector writes.
// ─────────────────────────────────────────────────────────────────────
export const dailyStateVectorInput = z.object({
  id: z.string(),
  tickCount: z.number().int(),
  gfbIndex: z.number(),
  mtqPrice: z.number(),
  priceInBand: z.boolean(),
  navUsd: z.number(),
  liabilityUsd: z.number(),
  reserveRatio: z.number(),
  lcr: z.number(),
  status: z.string(),
  circulatingSupply: z.number(),
  totalSupply: z.number(),
  usdNet: z.number(),
  eurNet: z.number(),
  gbpNet: z.number(),
  jpyNet: z.number(),
  cnyNet: z.number(),
  chfNet: z.number(),
  goldNet: z.number(),
  fiatNet: z.number(),
  vix: z.number(),
  dxy: z.number(),
  zVix: z.number(),
  zDxy: z.number(),
  rawTheta: z.number(),
  smoothedGoldWeight: z.number(),
  targetGoldWeight: z.number(),
  observedGoldWeight: z.number(),
  bufferState: z.string(),
  bufferGoldRatio: z.number(),
  ejectStage: z.number().int(),
  pegHealthJson: z.string().default('{}'),
  // Time offsets
  tickAtMinutesAgo: z.number().default(600), // 10 hours
})

export const dailyStateVectorFactory = defineFactory({
  inputSchema: dailyStateVectorInput,
  async create(data) {
    const tickAt = new Date(Date.now() - data.tickAtMinutesAgo * 60_000)
    const createdAt = tickAt
    await db.dailyStateVector.create({
      data: {
        id: data.id,
        tickAt,
        tickCount: data.tickCount,
        gfbIndex: data.gfbIndex,
        mtqPrice: data.mtqPrice,
        priceInBand: data.priceInBand,
        navUsd: data.navUsd,
        liabilityUsd: data.liabilityUsd,
        reserveRatio: data.reserveRatio,
        lcr: data.lcr,
        status: data.status,
        circulatingSupply: data.circulatingSupply,
        totalSupply: data.totalSupply,
        usdNet: data.usdNet,
        eurNet: data.eurNet,
        gbpNet: data.gbpNet,
        jpyNet: data.jpyNet,
        cnyNet: data.cnyNet,
        chfNet: data.chfNet,
        goldNet: data.goldNet,
        fiatNet: data.fiatNet,
        vix: data.vix,
        dxy: data.dxy,
        zVix: data.zVix,
        zDxy: data.zDxy,
        rawTheta: data.rawTheta,
        smoothedGoldWeight: data.smoothedGoldWeight,
        targetGoldWeight: data.targetGoldWeight,
        observedGoldWeight: data.observedGoldWeight,
        bufferState: data.bufferState,
        bufferGoldRatio: data.bufferGoldRatio,
        ejectStage: data.ejectStage,
        pegHealthJson: data.pegHealthJson,
        createdAt,
      },
    })
    return { id: data.id }
  },
  async teardown(record) {
    await db.dailyStateVector.delete({ where: { id: String(record.id) } })
  },
})

// ─────────────────────────────────────────────────────────────────────
// RebalancingDecision — `persistRebalancingDecision` in audit-trail.ts.
// Same approach as DailyStateVector: bypass the wrapper, write the
// columns directly (matches exactly what persistRebalancingDecision
// writes to the DB).
// ─────────────────────────────────────────────────────────────────────
export const rebalancingDecisionInput = z.object({
  id: z.string(),
  tickCount: z.number().int(),
  navUsd: z.number(),
  reserveRatio: z.number(),
  observedGoldWeight: z.number(),
  targetGoldWeight: z.number(),
  deviationPct: z.number(),
  shouldRebalance: z.boolean(),
  direction: z.number().int(),
  tradeUsd: z.number(),
  reason: z.string(),
  blockedBy: z.string().nullable().optional(),
  applied: z.boolean().default(false),
  preGoldNet: z.number().nullable().optional(),
  postGoldNet: z.number().nullable().optional(),
  preFiatNet: z.number().nullable().optional(),
  postFiatNet: z.number().nullable().optional(),
  postReserveRatio: z.number().nullable().optional(),
  postObservedGoldWeight: z.number().nullable().optional(),
  tickAtMinutesAgo: z.number().default(300), // 5 hours
})

export const rebalancingDecisionFactory = defineFactory({
  inputSchema: rebalancingDecisionInput,
  async create(data) {
    const tickAt = new Date(Date.now() - data.tickAtMinutesAgo * 60_000)
    await db.rebalancingDecision.create({
      data: {
        id: data.id,
        tickAt,
        tickCount: data.tickCount,
        navUsd: data.navUsd,
        reserveRatio: data.reserveRatio,
        observedGoldWeight: data.observedGoldWeight,
        targetGoldWeight: data.targetGoldWeight,
        deviationPct: data.deviationPct,
        shouldRebalance: data.shouldRebalance,
        direction: data.direction,
        tradeUsd: data.tradeUsd,
        reason: data.reason,
        blockedBy: data.blockedBy ?? (data.shouldRebalance ? null : data.reason),
        applied: data.applied,
        preGoldNet: data.preGoldNet ?? null,
        postGoldNet: data.postGoldNet ?? null,
        preFiatNet: data.preFiatNet ?? null,
        postFiatNet: data.postFiatNet ?? null,
        postReserveRatio: data.postReserveRatio ?? null,
        postObservedGoldWeight: data.postObservedGoldWeight ?? null,
        createdAt: tickAt,
      },
    })
    return { id: data.id }
  },
  async teardown(record) {
    await db.rebalancingDecision.delete({ where: { id: String(record.id) } })
  },
})

// ─────────────────────────────────────────────────────────────────────
// OracleSample — `persistOracleSamples` in audit-trail.ts creates 5
// rows per tick (one per pair). Each recipe record corresponds to ONE
// pair sample, so the factory writes one row per call. This matches
// what `db.oracleSample.create` inside the persistOracleSamples
// transaction does for each pair.
// ─────────────────────────────────────────────────────────────────────
export const oracleSampleInput = z.object({
  id: z.string(),
  tickCount: z.number().int(),
  pair: z.string(),
  chainlinkValid: z.boolean(),
  chainlinkPrice: z.number(),
  pythValid: z.boolean(),
  pythPrice: z.number(),
  chronicleValid: z.boolean(),
  chroniclePrice: z.number(),
  validCount: z.number().int(),
  finalPrice: z.number(),
  method: z.string(),
  spreadBps: z.number().int(),
  paused: z.boolean(),
  discardReasons: z.string().nullable().optional(),
  tickAtMinutesAgo: z.number().default(30),
})

export const oracleSampleFactory = defineFactory({
  inputSchema: oracleSampleInput,
  async create(data) {
    const tickAt = new Date(Date.now() - data.tickAtMinutesAgo * 60_000)
    await db.oracleSample.create({
      data: {
        id: data.id,
        tickAt,
        tickCount: data.tickCount,
        pair: data.pair,
        chainlinkValid: data.chainlinkValid,
        chainlinkPrice: data.chainlinkPrice,
        pythValid: data.pythValid,
        pythPrice: data.pythPrice,
        chronicleValid: data.chronicleValid,
        chroniclePrice: data.chroniclePrice,
        validCount: data.validCount,
        finalPrice: data.finalPrice,
        method: data.method,
        spreadBps: data.spreadBps,
        paused: data.paused,
        discardReasons: data.discardReasons ?? null,
        createdAt: tickAt,
      },
    })
    return { id: data.id }
  },
  async teardown(record) {
    await db.oracleSample.delete({ where: { id: String(record.id) } })
  },
})

// ─────────────────────────────────────────────────────────────────────
// MetricSample — entity audit says this is dependent (`independently_
// created: false`). No reusable creation function exists in the app
// yet; the schema has no insert call site we could find. Fall back to
// a raw write through Prisma. The factory will be wired when the app
// adds a creation path; until then this is the same shape the app's
// dashboard sparklines expect.
// ─────────────────────────────────────────────────────────────────────
export const metricSampleInput = z.object({
  id: z.string(),
  gfbIndex: z.number(),
  mtqPrice: z.number(),
  nav: z.number(),
  reserveRatio: z.number(),
  lcr: z.number(),
  status: z.string(),
  vix: z.number(),
  dxy: z.number(),
  targetGold: z.number(),
  bufferState: z.string(),
  createdAtMinutesAgo: z.number().default(50),
})

export const metricSampleFactory = defineFactory({
  inputSchema: metricSampleInput,
  async create(data) {
    const createdAt = new Date(Date.now() - data.createdAtMinutesAgo * 60_000)
    await db.metricSample.create({
      data: {
        id: data.id,
        gfbIndex: data.gfbIndex,
        mtqPrice: data.mtqPrice,
        nav: data.nav,
        reserveRatio: data.reserveRatio,
        lcr: data.lcr,
        status: data.status,
        vix: data.vix,
        dxy: data.dxy,
        targetGold: data.targetGold,
        bufferState: data.bufferState,
        createdAt,
      },
    })
    return { id: data.id }
  },
  async teardown(record) {
    await db.metricSample.delete({ where: { id: String(record.id) } })
  },
})

// ─────────────────────────────────────────────────────────────────────
// Registry — the FactoryRegistry passed to the SDK handler.
// ─────────────────────────────────────────────────────────────────────
export const factories = {
  PilotTrial: pilotTrialFactory,
  DailyStateVector: dailyStateVectorFactory,
  RebalancingDecision: rebalancingDecisionFactory,
  OracleSample: oracleSampleFactory,
  MetricSample: metricSampleFactory,
}
