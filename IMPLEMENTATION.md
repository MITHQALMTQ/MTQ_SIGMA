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
- [x] `sdk check` clean on recipe.json — `valid: true`, up=8.8s, down=7.2s
- [x] POST discover → 200 with schema listing 5 models
- [x] POST up → 200 with refs + refsToken; rows present in Turso
- [x] POST down → 200 with `ok: true`; rows removed from Turso
- [x] Concurrent-instances proof: `{{testRunShortId}}` token in every
      unique `id` field — concurrent runs don't collide

## Ship
- [x] Commit on `autonoma-integration` (excluded the dev's
      `lib/forge-std` submodule change)
- [x] Pushed to GitHub `origin` (commit 200ae27)
- [x] Re-ran `autonoma-planner --resume` — all 7 pipeline steps now
      `done`:
      - projectMapper, pagesFinder, kb, entityAudit, scenarioRecipe,
        recipeBuilder, testGenerator

## Final artifacts
- Local test suite: 35 tests across 9 folders
  (`~/.autonoma/my-project/qa-tests/` — INDEX.md is the manifest)
- 17 critical, 10 high, 8 mid criticality
- 132 total user interactions (avg 11.5 steps per test)
- 0 features without tests; 0 tests lost in review
- 15 BFS nodes tested, 0 skipped
- Recipe: `/home/z/.autonoma/my-project/recipe.json`
- Knowledge base: `/home/z/.autonoma/my-project/AUTONOMA.md`

## Outstanding (requires user action in the Autonoma dashboard)
The planner's final note:
- "Test suite: not uploaded yet" — Autonoma uploads the suite when you
  take the app live in the dashboard
- "Autonoma SDK: not answering yet" — the dashboard hasn't pinged the
  endpoint yet (it's running, but not connected to Autonoma's runner)
- "Autonoma is not reviewing your pull requests yet" — takes effect
  after the dashboard connection is finalized

To finish in production: visit https://app.autonoma.app, link this
preview environment to your Autonoma app, and the suite will be
uploaded + the SDK will start receiving provisioning calls.
