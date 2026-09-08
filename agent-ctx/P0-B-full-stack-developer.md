# P0-B — Wire Chapter 24 audit-trail logging into pilot-state.ts tick loop

Agent: full-stack-developer
Task ID: P0-B
Parent worklog: `/home/z/my-project/worklog.md` (see the `--- Task ID: P0-B` section appended at the end).

## Files I OWNED (only edited these)
- Created: `src/lib/mtq/audit-trail.ts` (~237 lines) — 4 async persistence helpers + 2 small helpers (`fin`, `maxEjectStage`).
- Modified: `src/lib/mtq/pilot-state.ts` — audit-trail imports, STATE_SCHEMA_VERSION 8→9, two new PilotStore fields, restructured rebalance block, 4 audit-trail persistence calls in try/catch.
- Created: `scripts/check-audit-trail.ts` (one-off verifier, NOT added to package.json).

## What the audit trail persists (per tick, every 4s)
- `DailyStateVector` (§24.1, throttled 30s): 28-field monetary snapshot (GFB, MTQ price, NAV, liability, RR, LCR, status, supply, 7-component reserve net, VIX/DXY + z-scores + theta + smoothed gold, target/observed gold, buffer state + ratio, max eject stage, pegHealth JSON).
- `RebalancingDecision` (§24.2, unthrottled): every `evaluateRebalance` call — both "yes" and "no" decisions, with reason/blockedBy, and for "yes" decisions the pre/post-trade gold/fiat net + post-trade RR + post-trade observed gold weight.
- `RebalancingDecision` (§10 + §24.2): per-component MARP advisory rows (6/tick), prefixed `[MARP:{component}]`, `applied=false` (advisory).
- `OracleSample` (§24.3, throttled 30s): 5 rows/tick (one per pair) — per-feed validity + price, validCount, finalPrice, method, spreadBps, paused, discard-reasons JSON. Batched in a single `db.$transaction`.

## Issues hit & fixed
1. **Stale Prisma client in globalThis cache** — the dev server had pinned a `PrismaClient` from before AUDIT-FIX-1+2+3+4 added the 3 new models, so `db.dailyStateVector`/`rebalancingDecision`/`oracleSample` were `undefined`. Fix: `bun run db:generate` then restart the dev server (`setsid -f bash -c 'exec bun run dev >> dev.log 2>&1'` to fully detach — the system kills manually-launched `bun run dev` if not detached).
2. **`reserveRatio = Infinity` at genesis stripped by Prisma** — genesis has `circulatingSupply = 0` → `liability = 0` → `computeReserveRatio()` returns `Infinity`, which SQLite can't store and Prisma strips for non-nullable Float columns → `PrismaClientValidationError: Argument 'reserveRatio' is missing`. Fix: added `fin(v) = Number.isFinite(v) ? v : 0` helper in `audit-trail.ts`; documented convention in the file header (`reserveRatio = 0` in the audit log = "N/A — no circulating supply").
3. **HMR didn't invalidate the singleton's setInterval closure after the `fin()` fix** — the singleton was rebuilt (v8→v9) BEFORE the `fin()` fix, so the tick closure pinned the OLD `audit-trail.ts`. Fix: killed + restarted the dev server.

## Verification (final state)
- `bun run lint` → exit 0
- `curl /api/metrics` → HTTP 200
- DB row counts after ~73s of running:
  - DailyStateVector: 9 (throttled 30s; tickCount=33 on the last row)
  - RebalancingDecision: 552 (69 legacy `evaluateRebalance` rows + 483 MARP per-component rows; 12 legacy rows have `applied=true` with full pre/post-trade state)
  - OracleSample: 95 (19 batches × 5 pairs)
- `dev.log`: zero `[audit-trail]` errors, zero `prisma:error` lines, zero `TypeError` lines. Only `GET /api/... 200` lines.

## Notes for next agent
- The same `Infinity → 0` coercion convention could be applied to `/api/simulate/mint/route.ts` and `/api/simulate/redeem/route.ts` `pilotTrial.create` calls (they pass `reserveRatio: resp.snapshot.reserveRatio` directly), but those routes only run AFTER a mint when circulating supply > 0, so they never hit the Infinity case in practice. Left unchanged (out of scope).
- The `ejectStage` schema column is a single `Int`, but `MetricsSnapshot.ejectStage` is the per-currency map `{ USD, EUR, GBP, JPY, CNY }`. We collapse to MAX across currencies as the worst-case severity indicator. If a future auditor needs per-currency stages, they can read `pegHealthJson` (which IS per-currency) and infer; OR the schema can be changed to add an `ejectStageJson String` column (requires a new Prisma migration).
- MARP decisions are written to the same `RebalancingDecision` table with `applied=false` (advisory in the pilot — not executed as separate trades). They're distinguishable by the `[MARP:{component}]` prefix in `reason` and by `deviationPct = 0` (per-component deviation is encoded textually in `reason`). If a future agent wants a separate `MarpDecision` table, the schema can be extended and the `persistMarpDecisions` helper updated to write to it instead.
