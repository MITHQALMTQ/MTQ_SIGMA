# MTQΣ — The Global Purchasing Power Unit

A closed-loop monetary architecture protocol: a GFB purchasing-power reference
index (5-currency basket with a gold anchor), a live market-data engine
(Frankfurter ECB FX, FRED macro series, gold reference + PAXG/XAUT market rates),
and an issuance/rebalancing pilot with a hash-chained audit trail.

**Web pilot (live):** https://mtq-sigma.vercel.app — engine + Turso DB live,
Neon analytical mirror synced hourly via Inngest, cloud DB backups daily 03:00 UTC.

## Status (2026-10-26)
- Production web pilot: **live and healthy** (engine, Turso, Neon mirror, Inngest crons — Task 33 five-platform harmony verification).
- Testnet launch: **pending owner inputs** — `DEPLOYER_PRIVATE_KEY` repo secret
  (created OUTSIDE AI environments, per C-045-a fail-closed guard) + 15 role
  addresses in the dispatch form. Contract suite: `MTQSigmaV2.sol` compiles
  green at 24,314 B (EIP-170 fit), 30/30 forge tests + 26/26 draft workflows.
- **Not production-authorized for on-chain value.** Designed for Sharia review
  (independent fatwa required).

## Quick start
```bash
bun install
bun run db:push        # push Prisma schema (SQLite locally / Turso in prod)
bun run dev            # http://localhost:3000
bash scripts/session-open-battery.sh   # run BEFORE any session work
```

## Structure
- `src/` — Next.js 16 App Router production app
  - `src/app/api/` — 47 API routes (metrics, oracle, issuance, sync, health, mandate, …)
  - `src/components/mtq/` — protocol UI (17 sections, dashboards, simulators)
  - `src/lib/mtq/` — the engine: pilot-state, compute-engine, issuance,
    constituency, audit-trail, release controls
  - `src/lib/inngest/` — 6 crons (keeper-tick, hourly Turso→Neon sync, daily
    backup, oracle health, FRED refresh, audit prune)
- `prisma/` — live schema, 9 models (Prisma + Turso libSQL adapter)
- `contracts/` — Foundry project; `MTQSigmaV2.sol` canonical, vendored
  `lib/forge-std` (hermetic CI), deploy pipeline in `scripts/deploy-canonical.ts`
- `scripts/` — ops battery: fail-closed secret scan, Turso backup/restore,
  session-open battery, deploy + on-chain verification suite
- `audit-work/` — curated audit/governance archive: deliverable reports (A–J2),
  blueprint sources, and runtime-cited evidence. Reorganized 2026-10-26
  (Task 34): bulky visual evidence removed from the tree — preserved in git
  history + the pre-reorg backup bundle; see `docs/REORG-2026-10-26.md`
- `docs/` — canonical documents: mandate compliance, bank-grade audit,
  deployment record, release gates, ops (`ops/`), governance (`governance/`),
  security (`security/`), release (`release/`), archive (`archive/`)
- `mini-services/` — mtq-feed + keeper — **RETIRED locally** (see each
  service's RETIREMENT-NOTE.md; Task 16 decision)
- `mobile/` — Expo wallet skeleton (roadmap; excluded from CI typecheck)
- `backups/` — Turso backup manifests (dumps ride GitHub Releases)
- `upload/` — owner source material (blueprint originals, brand art)

## Tests
```bash
bun test                                        # unit + release-control gates
forge test                                      # contracts (cd contracts)
bun run scripts/run-tests.ts                    # Monte Carlo + stress suite
```

## Policy
- Git: `AGENTS.md` — latest-first, forward-only, no-rollback anchor enforced.
- Security: `SECURITY.md` (disclosure), `scripts/security/` (fail-closed scan,
  C-045-a/C-045-b known-compromised-literal rules never suppressible).
- Ops: `RUNBOOK.md` (monitoring, backup/restore, emergency pause).
