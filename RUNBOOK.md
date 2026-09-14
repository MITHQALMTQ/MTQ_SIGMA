# MTQΣ Pilot Command Center — Operations RUNBOOK

> **Status:** PILOT (testnet only) — NOT production-authorized.
> **Audience:** Engineering on-call, COO/PM, multi-sig signers.
> **Last updated:** TASK-9-MONITORING.

This runbook is the single source of truth for day-to-day operations of the
MTQΣ Pilot Command Center. It documents:

1. [Monitoring](#1-monitoring) — Sentry (app errors) + Tenderly (contract events) + Discord alerts
2. [Backup & Recovery](#2-backup--recovery) — daily Turso JSON dumps
3. [Emergency Pause Procedure](#3-emergency-pause-procedure) — who, when, how
4. [On-Call Escalation](#4-on-call-escalation)
5. [Common Incidents](#5-common-incidents)

---

## 1. Monitoring

### 1.1 Sentry — application error tracking

- **Service:** [Sentry](https://sentry.io) (free tier — 50k errors/mo, no credit card)
- **SDK:** `@sentry/nextjs` v10
- **Init files:**
  - `sentry.client.config.ts` — browser (uses `NEXT_PUBLIC_SENTRY_DSN`)
  - `sentry.server.config.ts` — Node runtime (uses `SENTRY_DSN`)
  - `sentry.edge.config.ts` — Edge runtime (uses `SENTRY_DSN`)
- **Sample rates:**
  - Errors: **100%** (capture every error)
  - Transactions (performance): **10%** (1-in-10 page loads / route transitions)
- **Build integration:** `next.config.ts` wraps the Next.js config with
  `withSentryConfig({ org, project, silent: true, sourcemaps: { deleteSourcemapsAfterUpload: true }, widenClientFileUpload: true })`.
  When `SENTRY_DSN` / `SENTRY_ORG` / `SENTRY_PROJECT` are unset, the wrapper
  silently no-ops — the app builds and runs identically with or without a
  Sentry account. **Graceful degradation guaranteed.**
- **PII:** `sendDefaultPii: false` — no IP addresses, no wallet IDs, no request bodies sent to Sentry.
- **Required env vars (see `.env.example`):**
  - `SENTRY_DSN` — server/edge runtime
  - `NEXT_PUBLIC_SENTRY_DSN` — client runtime (shipped to browser; safe — DSN is a public value)
  - `SENTRY_ORG`, `SENTRY_PROJECT` — build-time only (source map upload)
  - `SENTRY_AUTH_TOKEN` — **CI-only GitHub Actions secret, NEVER in `.env.local`**

### 1.2 Tenderly — contract event monitoring

- **Service:** [Tenderly](https://tenderly.co) (free tier, no credit card)
- **Receiver route:** `POST /api/webhooks/tenderly` (`src/app/api/webhooks/tenderly/route.ts`)
- **Auth:** HMAC-SHA256 of the raw request body, verified against `TENDERLY_WEBHOOK_SECRET`. Header name: `X-Tenderly-Webhook-Signature` (also accepts `sha256=`-prefixed form). Constant-time compare.
- **Failure modes:**
  - 503 if `TENDERLY_WEBHOOK_SECRET` not configured → refuse all webhooks (fail-closed)
  - 401 if signature doesn't match → reject, do NOT forward to Discord
  - 200 + `warning: "invalid-json"` if HMAC passes but body isn't valid JSON (ACK so Tenderly doesn't retry)
  - 200 + `ok: true` on success → Tenderly stops retrying
- **Forwarded alert types (configured in Tenderly dashboard):**
  - `Mint` — severity `warn` (orange)
  - `Redeem` — severity `warn` (orange)
  - `Burn` — severity `warn` (orange)
  - `Liquidation` — severity `error` (red) — **page on-call**
  - `Pause` / `Unpause` — severity `error` (red) — **page on-call**
- **Discord forward:** When `DISCORD_WEBHOOK_URL` is set, every valid alert is
  posted to the configured Discord channel as an embed with the alert name,
  contract, chain, block, tx hash, and a timestamp. Discord failures are
  logged but do NOT fail the webhook (so Tenderly stops retrying).
- **Required env vars (see `.env.example`):**
  - `TENDERLY_WEBHOOK_SECRET` — 32+ char random string, same value in the Tenderly webhook config UI
  - `DISCORD_WEBHOOK_URL` — optional; when unset, alerts are accepted but not forwarded

### 1.3 Uptime probes

- `GET /api/health` — full app health (engine ready + DB ping). Returns 503 if degraded.
- `GET /api/webhooks/tenderly` — receiver alive check (returns auth-method + forward-status JSON).

External uptime monitors (UptimeRobot / BetterStack — both free) should poll
`/api/health` every 60s and alert the on-call if 5 consecutive polls return
non-200 or take > 5s.

---

## 2. Backup & Recovery

### 2.1 Daily Turso backup

- **Script:** `scripts/backup-turso.ts` (run with `bun run scripts/backup-turso.ts`)
- **Workflow:** `.github/workflows/backup.yml` — daily cron at **03:00 UTC**
  (offset from the 02:00 compute-engine cron to avoid double-loading Turso).
- **Output:**
  - **Local:** `backups/turso-backup-YYYY-MM-DD-HHMM.json` (gitignored)
  - **CI artifact:** `turso-backup-<run_id>` (90-day retention in the Actions UI)
  - **GitHub Release:** tag `backup-YYYY-MM-DD` (releases page; permanent until manually deleted)
- **Tables backed up (5 total, matching `prisma/schema.prisma`):**
  1. `PilotTrial` — every mint/redeem trial simulation
  2. `MetricSample` — dashboard metric ticks (currently 0 — populated by keeper)
  3. `DailyStateVector` — per-tick full monetary state (NAV, RR, LCR, weights, buffer)
  4. `RebalancingDecision` — every evaluateRebalance + applyRebalanceTrade
  5. `OracleSample` — per-pair per-tick oracle consensus result
- **Backup file schema:**
  ```json
  {
    "schemaVersion": 1,
    "exportedAt": "2026-09-14T14:49:55.688Z",
    "tursoUrl": "libsql://mtqs-fortleem.aws-us-east-1.turso.io",
    "tables": { "PilotTrial": [...], "MetricSample": [...], ... },
    "rowCounts": { "PilotTrial": 30, "MetricSample": 0, ... },
    "totalRows": 20124
  }
  ```
- **Verified:** 2026-09-14 dry run produced a 17MB JSON file with 20,124 rows
  across 5 tables (PilotTrial=30, MetricSample=0, DailyStateVector=5006,
  RebalancingDecision=10058, OracleSample=5030). All rows ordered by `createdAt ASC`.
- **Required secrets (GitHub Actions → Settings → Secrets):**
  - `TURSO_DATABASE_URL` — libsql:// URL (read-only DB sufficient)
  - `TURSO_AUTH_TOKEN` — auth token with read access
  - (`GITHUB_TOKEN` is auto-provided by GitHub Actions)

### 2.2 Restore procedure (cold recovery)

If the primary Turso DB is corrupted / deleted / region-down:

1. Download the most recent backup from the GitHub Releases page (tag `backup-YYYY-MM-DD`).
2. Provision a new Turso DB: `turso db create mtqs-restore --region aws-us-east-1`.
3. Apply the Prisma schema to the new DB: `DATABASE_URL='libsql://…?auth=…' bunx prisma db push`.
4. Restore rows from JSON:
   ```bash
   bun run scripts/restore-turso.ts backups/turso-backup-YYYY-MM-DD-HHMM.json
   ```
   (NOTE: `restore-turso.ts` is not yet implemented — see §6 TODO. Until then,
   use any SQLite JSON-import tool or hand-write the INSERT loop.)
5. Update `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` in Vercel + GitHub Actions secrets to point at the new DB.
6. Trigger a redeploy on Vercel.
7. Verify by hitting `/api/health` — should return `db: true`.

---

## 3. Emergency Pause Procedure

### 3.1 Who can pause

The MTQΣ V2 contract (`contracts/MTQSigmaV2.sol`) gates pause/unpause behind the `onlyPauser` modifier, which checks the `PAUSER_ROLE` (or `DEFAULT_ADMIN_ROLE` as a fallback). See contract lines 213 (`onlyPauser` definition), 224 (`pause()`), 225 (`unpause()`).

> **IMPORTANT naming note:** The contract uses `pause()` (not `emergencyPause()`) and `PAUSER_ROLE` (not `EMERGENCY_ROLE`). These are the **same concept** — the blueprint §22.6 calls this the "Emergency Council" (4/7 multi-sig with hardware wallets); the contract implementation calls it `PAUSER_ROLE`. Do NOT add a second `emergencyPause()` function — it would create naming inconsistency and require contract redeployment. The access-control guarantee required by TASK-9 is already satisfied by `onlyPauser`.

### 3.2 Current state of PAUSER_ROLE holder

- **Production target:** Safe multi-sig (4/7 hardware-wallet signers, per blueprint §22.6).
- **Current state (testnet pilot):** Deployer EOA (`0x3C39…8d8c`) holds `DEFAULT_ADMIN_ROLE` AND is the only `PAUSER_ROLE` grantee. **TODO:** Before any public testnet launch, the deployer EOA must:
  1. Deploy a Safe multi-sig with 4/7 hardware-wallet signers.
  2. Call `grantRole(PAUSER_ROLE, safeAddress)` from the deployer EOA.
  3. Call `grantRole(DEFAULT_ADMIN_ROLE, safeAddress)` from the deployer EOA.
  4. Call `revokeRole(PAUSER_ROLE, deployerEOA)` from the Safe.
  5. Call `revokeRole(DEFAULT_ADMIN_ROLE, deployerEOA)` from the Safe.
  6. Update `contracts.ts` `DEPLOYER_WALLET` constant to remove the EOA reference.

This is tracked as a separate worklog action item (HIGH #8 in the FINAL-TOP-TIER-AUDIT-REPORT). The pause procedure below assumes the role is held by the Safe multi-sig (production) or the deployer EOA (testnet pilot — explicitly noted where the procedures differ).

### 3.3 Crisis detection → pause → assess → unpause

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 1 — DETECT CRISIS                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Trigger sources (any one is sufficient):                                     │
│   • Tenderly alert on Liquidation/Pause event (Discord 🔴 red embed)         │
│   • Sentry spike (app errors > 5/min) — on-call paged                        │
│   • Manual observation: oracle paused, RR < hard floor, or LCR < 0.70        │
│   • External: oracle provider outage (Chainlink/Pyth/Chronicle status page)  │
│   • External: bridge / USDC depeg event                                      │
│ Action:                                                                      │
│   • On-call opens #mtqs-incident channel                                     │
│   • On-call posts the trigger source + timestamp in the channel              │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 2 — DECIDE: PAUSE OR NOT?                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ Pause immediately if ANY of:                                                 │
│   • Oracle consensus is `paused` (any pair) for > 60 seconds                 │
│   • ReserveRatio < RR_HARD_FLOOR                                              │
│   • LCR < 0.70                                                                │
│   • Suspected bridge exploit (USDC supply differs from contract liability)   │
│   • Tenderly Liquidation event fired                                         │
│ If unsure, defer to the Risk Council (4/7 multi-sig) — they have 24h to      │
│ respond. For suspected exploits, DO NOT wait — pause immediately.            │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 3 — EXECUTE PAUSE                                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ Production (Safe multi-sig as PAUSER_ROLE):                                  │
│   1. On-call submits a `pause()` transaction to the Safe UI (Tenderly        │
│      dashboard → "Submit Transaction" → contract address → pause()).         │
│   2. 4 of 7 Safe signers (hardware wallets) co-sign the tx.                  │
│   3. Once threshold met, tx is broadcast — `Paused(safeAddress)` event.      │
│   4. On-call confirms pause on the block explorer (paused() returns true).   │
│ Testnet pilot (deployer EOA as PAUSER_ROLE — TODO to migrate):               │
│   1. On-call calls `pause()` directly from the deployer EOA.                 │
│   2. Confirm on Monad/Arc/Solana explorer.                                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 4 — ALERT GOVERNANCE                                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│   • Post-mortem channel: #mtqs-incident                                      │
│   • Notify: DAO (51% quorum), Risk Council (4/7), Emergency Council (4/7),   │
│     Constitutional Council (7/7).                                            │
│   • Include: trigger source, tx hash of pause(), current reserve state,      │
│     estimated recovery time.                                                 │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 5 — ASSESS + REMEDIATE                                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│   • Confirm root cause (oracle back up? bridge safe? USDC repeg?)            │
│   • If oracle issue: wait for validCount >= 3 across all 5 pairs.            │
│   • If bridge/USDC: await Risk Council ruling on whether to redeploy or      │
│     resume operations as-is.                                                 │
│   • If exploit: bridge funds to a new deployment, write a post-mortem.       │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 6 — UNPAUSE (only after Risk Council sign-off)                          │
├──────────────────────────────────────────────────────────────────────────────┤
│   • Risk Council posts a signed Go decision in #mtqs-incident.               │
│   • Same Safe multi-sig flow as Step 3, but call `unpause()`.                │
│   • Confirm `paused() returns false` on explorer.                            │
│   • On-call posts "UNPAUSED at <timestamp> — root cause: <…>" in the channel.│
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 What pause() does NOT do

- Does NOT freeze user balances (only state-mutating operations: mint, redeem, advanceIndex, commitWeights, commitFxRatesFromOracles, executeRebalance).
- Does NOT pause views (getMTQPrice, getReserveRatio, getHonestStatus, etc.) — these still return their last-computed value. Users can still see their balance + the reserve composition.
- Does NOT pause the off-chain UI (the dashboard continues to render, but mint/redeem buttons will revert on-chain).

---

## 4. On-Call Escalation

| Severity | Trigger | Initial responder | Escalates to |
|---|---|---|---|
| 🔴 P0 | Contract paused unexpectedly / Liquidation event / Sentry error spike > 50/min | On-call engineer (15-min SLA) | CTO + Risk Council (4/7) within 1 hour |
| 🟠 P1 | Sentry error spike > 5/min / Tenderly Mint/Redeem anomaly | On-call engineer (1-hour SLA) | CTO if unresolved in 4 hours |
| 🟡 P2 | Single Sentry error / Dashboard slowness | On-call engineer (next-business-day SLA) | — |
| 🟢 P3 | Backup job failed | On-call engineer (next-business-day SLA) | CTO if 3 consecutive failures |

On-call rotation: weekly, Monday 00:00 UTC → next Monday 00:00 UTC. Handoff
notes go in `#mtqs-oncall-handoff`. The on-call rotation is documented in
the team Notion (link redacted from this public runbook).

---

## 5. Common Incidents

### 5.1 Oracle paused (any pair)

**Symptom:** `/api/oracle` returns `anyPaused: true`; Sentry logs "oracle paused" warnings.
**Action:**
1. Check Chainlink / Pyth / Chronicle status pages (links in §6).
2. If a single feed is down, the strict I9 fix (TASK-7-ORACLE-I9) auto-pauses when <3 feeds are valid.
3. Wait for the provider to recover; do NOT call `pause()` — the contract auto-pauses mint/redeem via the oracle quorum gate.
4. If the issue persists > 1 hour, escalate to P1 + post in #mtqs-incident.

### 5.2 Backup job failed (GitHub Actions)

**Symptom:** The "Turso Backup" workflow shows a red X in the Actions UI.
**Action:**
1. Download the failed run's logs.
2. Common causes:
   - Turso creds expired → regenerate `TURSO_AUTH_TOKEN` and update the GitHub Actions secret.
   - Turso DB deleted → restore from the most recent successful backup (§2.2).
   - GitHub Release API rate-limited → wait 1 hour, re-run the workflow manually.
3. If 3 consecutive failures, escalate to P3 (CTO).

### 5.3 Sentry DSN leaked

**Symptom:** Sentry dashboard shows a flood of obviously-spam events.
**Action:**
1. Rotate the DSN in Sentry dashboard → Settings → Projects → Client Keys → Generate new DSN.
2. Update `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in Vercel + `.env.local`.
3. Redeploy. The old DSN is permanently invalid.

---

## 6. TODO / Known Gaps

- [ ] Migrate `PAUSER_ROLE` from deployer EOA to a Safe multi-sig (see §3.2).
- [ ] Implement `scripts/restore-turso.ts` for automated cold-recovery (see §2.2).
- [ ] Add UptimeRobot / BetterStack probe on `/api/health` (see §1.3).
- [ ] Wire the Tenderly alert → PagerDuty / BetterStack for 24/7 paging (currently Discord-only).
- [ ] Add an explicit `EMERGENCY_ROLE` mapping to `PAUSER_ROLE` (alias) if external auditors require the exact name — currently deferred because it requires contract redeployment.

---

## Appendix A — Contract pause access control (verified TASK-9)

```
contracts/MTQSigmaV2.sol:
  Line 198:   bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
  Line 213:   modifier onlyPauser() { if (!(_roles[PAUSER_ROLE][msg.sender] || _roles[DEFAULT_ADMIN_ROLE][msg.sender])) revert Err33(); _; }
  Line 224:   function pause()   external onlyPauser { paused = true;  emit Paused(msg.sender); }
  Line 225:   function unpause() external onlyPauser { paused = false; emit Unpaused(msg.sender); }
```

**Verdict (TASK-9):** The `pause()` function is correctly gated by `onlyPauser`, which requires `PAUSER_ROLE` or `DEFAULT_ADMIN_ROLE`. This satisfies the access-control guarantee required by the task — only authorized role-holders can pause. The naming differs from the task spec (`pause()` / `PAUSER_ROLE` vs `emergencyPause()` / `EMERGENCY_ROLE`) but the access-control semantics are equivalent. No contract change was made (would require redeployment — out of scope).
