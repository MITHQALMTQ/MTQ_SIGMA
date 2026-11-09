# MTQΣ — V31 Phase 2/3/4 Cloud-Layer Evidence (2026-11-09)

**Method:** read-only probes only. No write was issued to any cloud database. The live sandbox application was NOT switched off local SQLite (dev stack stays authoritative; monetary/governance acceptance pending). Credentials were passed inline as environment variables to `scripts/cloud-db-probe.ts` (committed, env-driven, no secrets inside) and to `curl` for the platform APIs. No credential appears in any git-tracked file (secret-scan governs).

## Verdict table

| Layer | Verdict | Evidence |
|---|---|---|
| Vercel app (mtq-sigma.vercel.app) | **DOWN — payment required** | HTTP 402 `Payment required` / `DEPLOYMENT_DISABLED`; latest production deployment commit `9fc7ccd` created 2026-10-28; pushes after that (incl. `73143da` at 2026-11-09T01:56Z) trigger NO deployment |
| Turso primary (libsql://mtqs-fortleem…) | **DOWN — auth rejected (401)** | `@libsql/client` execute → `SERVER_ERROR: Server returned HTTP status 401` with the operator-provided token; **the production Vercel project's own `TURSO_AUTH_TOKEN` (decrypted via Vercel API, created 2026-09-07, never rotated) is byte-identical to the operator-provided token** — the primary DB rejects the token the production app itself uses |
| Neon mirror (neondb @ ep-super-dew…) | **ALIVE — schema OK, data frozen** | Read-only probe: reachable (3.7s latency incl. cold HTTP), 15 tables, all 5 expected `mtq_*` tables present; rows: pilot_trial 30, dsv 15,962, os 34,958, rd 56,513, ms 0; `mtq_sync_state` cursors: DSV/OS/RD all at 2026-10-29T02:01Z — mirror frozen ≈11 days |
| Inngest event key | **LIVE** | POST no-op event `probe/v31-availability-check` → HTTP 200 `{"ids":["01M6Z0NAE1RFDNPK0QP1XM2C5W"],"status":200}` (no function matches → no side effects) |
| Local sandbox stack | **HEALTHY — latest git** | Heartbeat 01:19:10Z `result=OK` (git/db/server 200/route 403, watchdog alive); HEAD == origin/main == `73143da`; monitor smoke 02:03:58Z `PLANE_5_OK job=516198 bootstrap=OK` |

## Root-cause chain (cloud layer)

1. **Vercel account exhausted its credits** → deployments disabled, site suspended (HTTP 402). Last successful deploy 2026-10-28 (`9fc7ccd`). Every push since then is undeployed — the cloud layer is NOT on latest git by force of the platform, not of the repository.
2. **Inngest's Turso→Neon hourly sync stopped at 2026-10-29T02:01Z** — the sync function executes on the Vercel app; with the app suspended the mirror froze. Neon itself is healthy.
3. **Turso rejects the production token (401)** — independent of Vercel's suspension. The token on the Vercel project and the operator-provided token are the same JWT (iat 2026-09-07); the database endpoint answers but refuses it (revoked, rotated elsewhere, or database/account suspended). Consequence: even if Vercel had credits, the production app could not boot its primary DB.

## Operator actions required (platform-side; not fixable from inside the repository)

1. **Vercel:** restore account credits (or upgrade plan) → confirm auto-deploy of `origin/main` (`73143da`+) resumes → verify `mtq-sigma.vercel.app` serves HTTP 200.
2. **Turso:** platform console — verify the database still exists / account standing; mint a fresh database token; update `TURSO_AUTH_TOKEN` in the Vercel project env.
3. **Inngest/Neon:** after 1+2, the hourly sync self-heals its backlog via the durable high-water cursor (`mtq_sync_state`, composite `tickAt,id` cursor, `ON CONFLICT DO NOTHING` sweep — see `src/lib/inngest/functions.ts` header). Outage bound note: rows pruned from Turso during the outage (retention caps DSV 5k / RD 10k / OS 5k) are recoverable only from the daily GitHub backup — the sandbox `backups/db-snapshots/latest-chain.sql` lineage and the git-tracked dumps remain available.

## Honest classification

- `PLANE_5_DATA_DIVERGENCE` does **not** apply to the local stack (local chain forward-only, recoveryDeficit 0, unbackedAhead bounded).
- The cloud layer is classified **UNAVAILABLE (Vercel: billing; Turso: auth; mirror: stale)** — reported honestly, never as healthy. TESTNET ONLY · SHADOW MODE · MONETARY/GOVERNANCE ACCEPTANCE PENDING.
- Nothing in this audit wrote to, migrated, or reconfigured any cloud database.
