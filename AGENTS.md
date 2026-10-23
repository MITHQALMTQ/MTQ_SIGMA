# AGENTS.md — MTQΣ

## Autonoma test data

[Autonoma](https://autonoma.app) generates end-to-end tests that drive the
real MTQΣ dashboard against its API. It seeds realistic monetary state
(pilot trial history, audit-trail vectors, oracle samples, rebalancing
decisions) into the database through factories that call the app's own
creation paths.

- **Endpoint:** `POST /api/autonoma` (route handler in
  `src/app/api/autonoma/route.ts`)
- **Factories:** `src/lib/autonoma/factories.ts` — one per Prisma model
  (PilotTrial, DailyStateVector, RebalancingDecision, OracleSample,
  MetricSample)
- **Recipe:** `/home/z/.autonoma/my-project/recipe.json`

When you add or change a Prisma model, or change the code path that
creates it (e.g. a new `persistX` function in `audit-trail.ts`, or moving
the inline insert out of `simulate/mint/route.ts`), update the matching
factory in `src/lib/autonoma/factories.ts` so test data still flows
through the app's real creation logic.
