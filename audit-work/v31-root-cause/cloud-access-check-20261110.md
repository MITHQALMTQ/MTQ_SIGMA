# Cloud Access Check — 2026-11-10 (V31 TURN 3 §9 preliminary, read-only)

Scope: user-provided credentials applied to the previously-unverifiable cloud boundary.
Method: read-only probes only (HTTP API / SQL SELECT / DNS). No cloud writes performed.
Context going in: Turso HTTP 401, Neon mirror frozen 2026-10-29, Vercel deployment restriction,
Inngest completion unestablished → all previously `CLOUD_DATABASE_UNVERIFIED`.

## 1. GitHub — VERIFIED, PUSHED

- Remote: `github.com/MITHQALMTQ/MTQ_SIGMA` (origin, token-based push).
- At fire 03:17:48+08 the guard classified `SOURCE_CODE_AHEAD`; by fire 04:17:48+08 the state was
  `EXACT_MATCH` / `BOOTSTRAP_OK` (fire scripts' own commit/push rules had synced the repo).
- This check committed and pushed the remaining telemetry deltas: `a85b511..a6fd079 main -> main`.
- Pre-push secret scan: PASS on 3 files. Working tree clean after push.

## 2. Turso (libsql://mtqs-fortleem.aws-us-east-1.turso.io) — ACCESSIBLE (read-verified, rw token)

- Auth: HTTP 200 on Hrana `/v2/pipeline` with the provided token (previously HTTP 401).
  Token iat = 2026-09-07T16:31:00Z.
- Schema (sqlite_master): DailyStateVector, IssuanceEvent, MbzBackingCertificate, MbzBank,
  MbzMintRequest, MetricSample, OracleSample, PilotTrial, RebalancingDecision, keeper_audit,
  sqlite_sequence — the custom.db table family **plus `keeper_audit`, which does not exist in the
  local custom.db** (local custom.db additionally has AiModelCatalog, ConsensusRun, ConsensusVote,
  ScoringUpload — absent in Turso). ⇒ **Different generation of the custom schema.**
- Row counts (Turso): DailyStateVector 5000 · OracleSample 5042 · PilotTrial 32 ·
  RebalancingDecision 10000 · keeper_audit 5091 (ids contiguous 1..5091) · IssuanceEvent /
  MbzBackingCertificate / MbzBank / MbzMintRequest / MetricSample all 0.
- Row counts (local custom.db, live): DailyStateVector 2616 · OracleSample 5006 · PilotTrial 2 ·
  RebalancingDecision 10010 · ConsensusRun 50 · ConsensusVote 146 · AiModelCatalog 101 ·
  IssuanceEvent / MbzBank / MbzMintRequest / MetricSample / MbzBackingCertificate / ScoringUpload 0.
- Conclusion: Turso holds a **non-identical, non-current dataset**. Blind overwrite would violate
  the forward-only principle. Any sync is a deliberate TURN 3 §9 decision with an explicit
  generation-identity comparison, not a naive restore.

## 3. Neon (ep-super-dew-b77xmqbm, us-east-1) — ACCESSIBLE (read-verified via Postgres protocol)

- TCP 5432 open; password auth with the provided connection string succeeded (psycopg2).
- REST `/sql` endpoint requires a JWT bearer (not provided) — Postgres protocol used instead.
- Public schema: `local_cache` (701), `mtq_daily_state_vector` (15,962), `mtq_metric_sample` (0),
  `mtq_oracle_sample` (34,958), `mtq_pilot_trial` (30), `mtq_rebalancing_decision` (56,513),
  `mtq_sync_state` (3), plus neon_* platform tables.
- `mtq_sync_state` (Prisma-model sync markers):
  - DailyStateVector: last_tick_at 2026-10-29T02:01:10.379Z, last_id cmvswd0ji000xlh088my6zob7
  - RebalancingDecision: last_tick_at 2026-10-29T02:01:14.262Z
  - OracleSample: last_tick_at 2026-10-29T02:01:10.514Z
  - All updated_at ≤ 2026-10-29T02:01:16.925Z
  ⇒ **Mirror confirmed frozen at exactly 2026-10-29T02:01:16Z** (matches the prior forensic note).
- Conclusion: Neon mirror is older than the local published tip h21663 (2026-11-09/10 era) by ~11
  days of ticks. It is a historical mirror, not a recovery source; resuming it requires the sync
  writer (Prisma-based) to be repaired/relaunched — a §9 decision.

## 4. Vercel (mtq-sigma) — TOKEN VALID; SERVING BILLING-BLOCKED

- Token works against `/v9/projects` (200) and `/v6/deployments` (200). (`/v2/user` 404 — not
  applicable to this token type.)
- Project: `mtq-sigma`, id `prj_ZyfeYmYZ2cu2rcNsLLYerBNEVA11`, account `team_bVAdJfvsNGW6Os3KxkhvHoq8`,
  created 2026-09-07T16:34:18Z.
- Latest 5 deployments all READY; newest created 2026-10-28T15:08:01Z
  (`mtq-sigma-74apnl9m9-tonsy.vercel.app`).
- Production alias `https://mtq-sigma.vercel.app/` returns **HTTP 402 "Payment required /
  DEPLOYMENT_DISABLED"** (edge ref `hkg1::…`) — the deployment artifacts exist but serving is
  disabled at the billing layer.
- Conclusion: deploy capability exists via API; restoring public serving requires the account
  owner to resolve the Vercel billing state — a governance/billing action outside authorized scope.

## 5. Inngest — UNVERIFIED (network-blocked from this sandbox)

- `ingest.inngest.com`: DNS NXDOMAIN from the sandbox (both `ingest.inngest.com` and a
  region-style variant). `api.inngest.com` resolves (IPv6) and responds, but `GET /v1/apps`
  returns 404 (tried Bearer and Basic with the signing key) — wrong surface for this key or
  endpoint set.
- Event-key ingest path therefore could not be exercised from here. The completion path remains
  `CLOUD_DATABASE_UNVERIFIED` pending a probe from an unrestricted network or from the deployed
  app side (once Vercel serving is restored).

## 6. Local platform evidence observed during this check (supporting, not cloud)

- `db/generations/recovery-journal.jsonl` records a **complete successful R-2B recovery**:
  - 20:18:49.613Z FOREIGN_WRITE_DETECTED (live h3966 < active generation tip h21601)
  - 20:18:50.257Z DECISION_AUTHORIZED ("published h21663 over live h3966" — forward-only)
  - 20:24:04.404Z PREPARE (isolated import, expect h21663 / 18077 custom rows)
  - 20:24:04.493Z VALIDATED (h21663 · 18077 custom rows · all §4.2 checks passed)
  - 20:24:04.513Z ACTIVATED (pointer committed · casualty archive kept)
- After activation: `db/chain.db` blocks max(height) = **21672** (forward progress +9 past the
  published tip); genesis hash matches canonical `gen_3baf0dba…`; boot_mode=self-healed.
- Application: `next dev` running, `http://localhost:3000/` → HTTP 200.
- Snapshot manifest: `backups/db-snapshots/manifest.json` (v5, committedTip h21663).
- Note: `backups/plane5/heartbeat.json` still carries result=ALERT from 20:19:49Z (pre-recovery);
  the next backstop fire (05:17:48+08) will re-run its own battery and refresh it.

## Status roll-up

| Surface | Status |
| --- | --- |
| GitHub | VERIFIED — pushed, synced |
| Turso | ACCESSIBLE (rw) — non-identical dataset; sync = deliberate §9 decision |
| Neon | ACCESSIBLE (rw) — mirror frozen 2026-10-29T02:01:16Z; resync = §9 decision |
| Vercel | TOKEN VALID — artifacts READY, serving 402 DEPLOYMENT_DISABLED (billing, owner action) |
| Inngest | UNVERIFIED — sandbox DNS/API surface blocked; re-probe from app side |
