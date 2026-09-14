# IMPLEMENTATION.md — Autonoma integration checklist

Tracks the Autonoma SDK integration work for MTQΣ.
Source spec: `/home/z/.autonoma/my-project/{AUTONOMA.md,entity-audit.md,scenarios.md}`
Integration prompt: `/home/z/.autonoma/my-project/integration-prompt.md`

## Prerequisites
- [x] App running locally (dev server :3000 via `dev-watchdog.sh`)
- [x] Turso DB wired (`src/lib/db.ts` uses `PrismaLibSQL` adapter)
- [x] Prisma schema pushed to Turso (5 tables, 7 indexes)
- [x] Dev branch cut: `autonoma-integration` (kept uncommitted `lib/forge-std`
      submodule changes out of the commit)

## SDK install
- [x] `@autonoma-ai/sdk` (v0.2.9) — main SDK (factory definitions, handler)
- [x] `@autonoma-ai/server-web` (v0.2.9) — Web-standard adapter
      (Next App Router compatible)

## Endpoint
- [x] `src/app/api/autonoma/route.ts` — POST handler via `createHandler`
- [x] `scopeField: 'testRunId'`
- [x] HMAC `x-signature` verified against `AUTONOMA_SHARED_SECRET`
- [x] Internal `signingSecret` derived from shared secret
- [x] GET stub for manual probing
- [x] SDK endpoint path: `/api/autonoma`

## Factories (`src/lib/autonoma/factories.ts`)
- [x] **PilotTrial** — copied the inline `db.pilotTrial.create` insert
      from `src/app/api/simulate/mint/route.ts` (no reusable function
      existed; the handler owns the insert). Time offset via
      `createdAtMinutesAgo`.
- [x] **DailyStateVector** — bypassed `persistDailyStateVector` wrapper
      (it takes a complex `MetricsSnapshot` and only transforms it into
      column values); wrote columns directly via `db.dailyStateVector.create`
      matching the wrapper's exact field shape. Throttle logic skipped
      (undesirable for test data). Time offset via `tickAtMinutesAgo`.
- [x] **RebalancingDecision** — same approach as DailyStateVector;
      bypassed `persistRebalancingDecision` wrapper, wrote columns directly.
- [x] **OracleSample** — bypassed `persistOracleSamples` (it batch-creates
      5 rows per tick in a `$transaction`); factory writes ONE row per
      call. Recipe lists one record per pair sample.
- [x] **MetricSample** — entity-audit marked `independently_created: false`
      and no reusable creation function exists. Raw Prisma write with a
      note in the factory source. Will be re-wired when the app adds a
      creation path.
- [x] Teardown per-record (delete by id) for every entity.
- [x] Seeded ids include `{{testRunShortId}}` token for isolation.
- [x] `_alias` / `_ref` supported via the SDK's `resolvePayloadTree`
      (no parent/child relations in the MTQΣ schema, so no aliases used
      in the standard recipe, but the plumbing is there).

## Auth callback
- [x] MTQΣ has no auth (public institutional dashboard). Returns empty
      `AuthResult` (`{}`). No User model exists; the SDK's auth callback
      receives `null` and that's fine.

## Maintenance note
- [x] `AGENTS.md` at repo root with "Autonoma test data" section.

## Recipe
- [x] `/home/z/.autonoma/my-project/recipe.json` generated from
      `scenarios.md` with concrete values.
- [x] `{{testRunShortId}}` token placed in every unique `id` field.
- [x] Time fields are offsets (`tickAtMinutesAgo`, `createdAtMinutesAgo`)
      realized at factory-run time, not concrete instants.
- [x] No unknown `{{...}}` tokens (only `{{testRunId}}` and
      `{{testRunShortId}}` — both built-in).

## Validation
- [ ] `sdk check` clean on recipe.json
- [ ] POST discover → 200 with schema listing 5 models
- [ ] POST up → 200 with refs + refsToken; rows present in Turso
- [ ] POST down → 200 with `ok: true`; rows removed from Turso
- [ ] Concurrent-instances proof: two runs in parallel don't collide
      (each has its own `{{testRunShortId}}`-suffixed ids)

## Ship
- [ ] Commit on `autonoma-integration` (excluding the dev's
      `lib/forge-std` submodule change)
- [ ] Push to GitHub `origin`
- [ ] Re-run `autonoma-planner --resume` to complete step 7
      (test generation)
