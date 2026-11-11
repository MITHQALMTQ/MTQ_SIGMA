# Phase 0 — Architecture Inventory (READ-ONLY Forensic Baseline)

**Program:** MTQΣ Network — Sovereign Security Architecture, Assume-Breach & Operational Resilience
**Release classification (unchanged by this task):** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED.
**Audit date:** 2026-11-11T00:20Z–00:5xZ (UTC). **Auditor:** Phase-0 forensic pass (AI security agent, read-only).
**Repo state at audit:** `HEAD=d6fd5d6` (2026-11-10T16:56:54Z, working tree clean) — **2 commits ahead / 168 commits behind `origin/main=926ee00`** (2026-11-10T23:32:33Z). Fork point `ff67aa2` (task45, 2026-11-06T12:49Z). See `recovery-and-state-integrity-assessment.md` §1 — the audited sandbox itself is a substituted, unadjudicated state.

> Status labels used throughout: NOT STARTED / IN DEVELOPMENT / IMPLEMENTED / INTEGRATION TESTED / SECURITY TESTED / INDEPENDENTLY AUDITED / APPROVED FOR CONTROLLED TESTNET. (PRODUCTION AUTHORIZED is never assigned by this program.)

---

## 1. Environment ground truth (evidence, not assumption)

| Fact | Value | Evidence |
|---|---|---|
| Host identity | user `z`, host `c-6af3b4be-140d72b5-bce37c3c94cd` | `whoami; hostname` (this audit) |
| Platform infra processes | `tini→/start.sh`, `caddy run --config /app/Caddyfile`, `zcode-driver`, python `main.py` — all started 2026-11-11T00:20 | `ps aux` (this audit) |
| Application runtime | **NONE RUNNING** — no `next dev`, no watchdog pid/lock, no `dev.log`, no `db/` directory | `ps aux`; `ls db/` → absent |
| `.env` | 50 bytes, single var `DATABASE_URL=file:/home/z/my-project/db/custom.db` (regenerated 00:20Z) | `.env:1`; mtime |
| Dev entrypoint as scripted | **BROKEN at this HEAD**: `package.json "dev"` → `scripts/dev-entrypoint.sh` — file absent from tree and history (exists on origin/main only) | `ls scripts/dev-entrypoint.sh` |
| Git remote | `github.com/MITHQALMTQ/MTQ_SIGMA.git`; remote URL **embeds an `x-access-token:` push credential** (platform-provisioned; value redacted) | `.git/config`; `git remote -v` (redacted output) |
| Commit author | all commits authored by one sandbox identity (`Z User <z@container>`) — both lineages | `git config user.name/email` |
| Scheduler | Platform cron jobs 522460 (backstop, hourly :17:48Z) & 522457 (monitor, hourly :55:45Z) registered & enabled; registry **survived** the 00:20Z re-image; display clock +8h skewed vs `next_run_time` (UTC) | `cron list` (this audit) |
| Auto-push channel | **38 UUID-subject cron commits exist in origin/main history** (direct pushes, no PR/review trace) | `git log --format=%s origin/main` (count) |
| Exposed port | Caddy `:81` → `localhost:3000` (repo template); the RUNNING `/app/Caddyfile` (root-owned, outside repo) still contains a wildcard `XTransformPort` proxy | repo `Caddyfile:26-35`; `ps` (caddy) |

## 2. Component inventory (classification per §1.2)

### 2.1 Application plane

| Component | Path | Reality | Exposure | Admin identity | Data | Evidence |
|---|---|---|---|---|---|---|
| Landing page | `src/app/page.tsx`, `src/components/landing/*` | EXISTING/VERIFIED | `:81`, unauthenticated | none | static marketing | page.tsx:1-186; zero API calls in landing |
| Pilot Command Center (30 sections) | `src/components/mtq/*` | EXISTING/VERIFIED | unauthenticated (cosmetic "Restricted" lock only — Sidebar.tsx:164,369-371) | none | chain, trials, oracle, evidence | Navigation.tsx:18-52 |
| API surface — 59 routes | `src/app/api/**` | EXISTING/VERIFIED (58) + NOT PRESENT (1: `constituency/upload`, deleted 5th time in commit 9fe4058) | unauthenticated; rate-limit buckets on ~40; **no auth on any human surface** | none | reads/writes below | full table in `authorization-flow-inventory.md` |
| In-process monetary pilot engine | `src/lib/mtq/pilot-state.ts` (globalThis singleton, 4s tick) | EXISTING/VERIFIED (shadow) | mutated via `/api/simulate/mint\|redeem` (unauthenticated) | none | ReserveState, PilotTrial | pilot-state.ts:1-22,705-725 |
| Devnet chain node + consensus | `src/lib/chain/node.ts`, `consensus.ts` (4 co-located validators, 700ms block loop, ed25519 tx sigs) | EXISTING/VERIFIED (testnet sim) | via `/api/chain/*` | none | chain.db | node.ts:77-190,239-296 |
| Oracle §17.7 overlay | `src/lib/mtq/oracle.ts` (3 synthetic witnesses = `Math.random()` around real FX references; fail-closed) | EXISTING/VERIFIED as simulation; externally-anchored oracles: NOT PRESENT | read APIs | none | OracleSample | oracle.ts:19-31,314-316 |
| FX/external data | `src/lib/mtq/fx.ts` (Frankfurter, gold-api, FRED, Yahoo; OU fallback) | EXISTING/VERIFIED | server-side egress | none | prices | fx.ts:6-25,116-173 |
| AI advisory surfaces | `src/app/api/ai/*`, `src/lib/ai/*` | EXISTING/VERIFIED (disabled — no provider keys) | rate-limited | none | none persisted | briefing/route.ts:22-44 |
| Issuance machine (ALT-4) | `src/lib/mtq/issuance/*` | PROTOTYPE ("ISSUED = LEDGER RECORD ONLY — NEVER ON-CHAIN"; synthetic attester/tags) | `/api/issuance` demo | none | IssuanceEvent | authorization.ts:88-99,303-323 |
| MBG bank gateway | `src/app/api/mbg/mint-request` | EXISTING/UNVERIFIED (fail-closed now: all 3 auth paths unconfigured) | unauth → 401 | bank registry (placeholder: Hardhat acct #1) | MbzMintRequest | route.ts:74-120; bank-registry.ts:63-71 |
| PBC / three-book / systemic-exposure / bank-default / contradiction-scan | `src/lib/{protected-backing-cell,three-book-separation,systemic-exposure-engine,bank-default-resolution,contradiction-scan}.ts` | PROTOTYPE (GET-report only; declared simulated) | read APIs | none | reports | module headers |
| Authentication (sessions/NextAuth/API keys for humans) | — | **NOT PRESENT** (no middleware.ts, no next-auth/jose in deps) | n/a | n/a | n/a | grep negative |

### 2.2 Data plane

| Component | Path | Reality | Notes |
|---|---|---|---|
| Prisma + SQLite `db/custom.db` | `prisma/schema.prisma` (10 models: PilotTrial, MetricSample, DailyStateVector, RebalancingDecision, OracleSample, MbzMintRequest, MbzBackingCertificate, MbzBank, IssuanceEvent, ScoringUpload) | EXISTING/VERIFIED (code); **live file absent at audit time** | no governance tables — devnet governance lives in chain.db |
| Devnet store `db/chain.db` | `src/lib/chain/store.ts` (12 raw-SQL tables) | EXISTING/VERIFIED (code); file absent at audit | state-root commitment state.ts:646-666 |
| Dump layer | `backups/db-snapshots/latest-{chain,custom}.sql` | EXISTING/VERIFIED; **local tips h3941/12,395 vs origin h23811/129,583 (≈19,870-block deficit)** | see recovery assessment |
| Neon Postgres mirror | `src/lib/neon-client.ts` | EXISTING/UNVERIFIED (env unset; Inngest disabled; serverless routes prohibited — check-no-neon.ts) |
| Turso remote | scripts + `TURSO_*` env names | EXISTING/UNVERIFIED from sandbox (cloud-side) |
| Inngest functions | `src/lib/inngest/functions.ts` (6 scheduled fns) | EXISTING/UNVERIFIED (signing key unset → 503 fail-closed) |

### 2.3 On-chain plane (see contract assessment for detail)

| Component | Reality |
|---|---|
| MTQSigma v1.2 token (Monad 10143 `0x5D95…fd4a`, Arc 5042002 `0x826b…63c1`, Robinhood `0xA3B8…4EF0`) | EXISTING/VERIFIED — live testnet, single-admin (deployer EOA `0x3C39…c8d8c`) |
| Genesis Safe `0xE718…A7D0` | EXISTING/VERIFIED — live, **threshold 1, sole owner = deployer EOA** (OD-35 VERIFIED-FAILED vs mandated 4/7) |
| MTQSigmaV2 | PROTOTYPE — compiled artifact only (`MTQSigmaV2-PENDING.json`; deploy blocked on fresh funded key — prior key compromised, C-045-a) |
| MTQSigmaV3 / V4, adapters | PROTOTYPE / compiled-artifact-only (V3 size conflict on record; V4 registry-only) |
| MtqEcosystem (9 contracts) | EXISTING/VERIFIED (deployed; mock-class; all constructor roles → msg.sender; "Safe" entries verified NOT Safes) |
| Keeper service (`mini-services/keeper`) | PROTOTYPE — complete code, RETIRED-LOCALLY, observe-only (key unset); hot-key design `KEEPER_PRIVATE_KEY` |
| mtq-feed WS service | PROTOTYPE — RETIRED-LOCALLY |

### 2.4 Ops / security plane

| Component | Reality at THIS HEAD | On origin/main |
|---|---|---|
| `dev-watchdog.sh` v5 (port guard → drift guard → source-integrity heal → preflight → db-selfheal → next dev; 60s subloops: drift-guard, cloud-sync) | EXISTING/VERIFIED (code) — currently INERT; heal layer #3 broken (see below) | same + in-process belt |
| `scripts/source-integrity-heal.ts` + `src/lib/boot/source-integrity.ts` | **NOT PRESENT** (watchdog line 180 `\|\| true` masks absence) | EXISTING/VERIFIED |
| `src/instrumentation.ts` boot-order gate (drift-before-heal) | NOT PRESENT (13-line minimal) | EXISTING/VERIFIED (+232 lines) |
| `scripts/db-selfheal.ts`, `db-restore-verify.ts`, `db-cloud-sync.ts` (forward-only, refuse-behind, sentinel `db/ALLOW-GENESIS-RESET`) | EXISTING/VERIFIED (code + incident evidence) | same |
| `scripts/git-drift-guard.ts` (ff-only / subsumption-proven realign; sentinel `db/ALLOW-GIT-REALIGN`) | EXISTING/VERIFIED (14/14 regression tests, live-recovery evidence) | same |
| Plane-5 suite (`plane5-run.sh`, bootstrap, heartbeat, `snapshot-publish.ts`, execution ledger) | **NOT PRESENT locally; EXISTING/VERIFIED on origin** (heartbeat OK 2026-11-10T23:31:59Z, chainTip 23846, deficit 0) | EXISTING/VERIFIED |
| Pre-commit secret gate (`.githooks/pre-commit` → `scripts/security/secret-scan.ts`; fail-closed; redacted output) | **EXISTING/VERIFIED — wired** (`core.hooksPath=.githooks`; node-builtin-only implementation; runs without node_modules) | same |
| CI workflows (9 files: ci, backup, deploy-testnet, forge-tests, health-probe, keeper-heartbeat, inngest-resync, backtest-nightly, compute-engine) | EXISTING/UNVERIFIED (execution, secrets, protection cannot be verified from inside; Slither job dead wiring; ESLint advisory) | same |
| Branch protection / CODEOWNERS | BRANCH-PROTECTION.md documents 2-approval+checks; **unverifiable from inside**; CODEOWNERS **NOT PRESENT** | same |
| Monitoring/alerting | plane5 heartbeat+ledger (origin); Sentry hooks (env unset); health-probe workflow (unverified) — all co-located with monitored system | same |
| Audit evidence base | `worklog.md` (2.0MB, root), `audit-work/` (25 entries incl. DELIVERABLE-A…J2, MASTER-E2E-AUDIT), `backups/*MANIFEST*`, incident files | same |

## 3. Component reality verdict

The MTQΣ estate is a **pilot/shadow simulation with a genuinely deployed single-administrator testnet contract estate**, wrapped in an unusually disciplined ops-recovery layer that is itself version-skewed and partially absent at the audited (substituted) HEAD. The critical security-relevant asymmetries:

1. Every *running* authority path terminates in **one sandbox identity + one embedded push credential + one compromised-class deployer EOA** (see authority-graph.md).
2. The strongest autonomous controls (plane-5, source-integrity heal, boot-order gate) exist **only on origin/main** — the substituted sandbox cannot currently run them (F-0-P1-02, F-0-P0-02).
3. There is **no authentication boundary anywhere in the application** (by design for a public pilot terminal, but it eliminates identity separation the security program requires).

Cross-references: `trust-boundary-diagram.md` (boundaries), `critical-asset-inventory.md` (assets), `authorization-flow-inventory.md` (flows), `critical-vulnerability-register.md` (findings F-0-*).
