# MTQΣ Koyeb Keeper

Always-on Bun service that calls the MTQSigmaV2 contract's `onlyKeeper` functions on a 4-second tick.

> 🔴 **HOT WALLET — low-privilege, rotate regularly.**
> The keeper holds **ONLY `KEEPER_ROLE`**. It can call `advanceIndex`, `commitWeights`, `submitTargetWeights`, `executeRebalance`, `setCrisisFlag`, `updateState`. It **CANNOT** mint, redeem, pause, change governance, or touch the constitutional envelopes. Compromise of this key is bounded: an attacker can at most submit out-of-spec weights, which the contract's admissibility envelopes (`LOWER_BOUND` / `UPPER_BOUND`) and per-component velocity caps reject.

---

## What it does

Every 4 seconds (matching the engine tick), the keeper runs one cycle:

1. **Acquire distributed lock** (Upstash Redis, optional — prevents double-submit during blue-green deploys)
2. **Read contract state** — `paused()`, `indexValue()`, `getLiveWeights()`, `getReserveNavUsd()`, `reserveHeldUsd(i)` for each of 7 components
3. **Fetch current prices** — free no-key APIs (ECB/Frankfurter for FX, metals.live for gold). 1e18-scaled, USD-quoted
4. **`advanceIndex(currentPrices)`** — §9.2 authoritative chain-link recursion
5. **`commitWeights(newWeights, currentPrices)`** — §9.3 divisor adjustment (reads the latest MASE weight vector from Turso; skips if no vector available)
6. **Deviation check** — for each component, `|heldW_i − targetW_i|`. If any deviation > 5%, build trades
7. **`executeRebalance(trades)`** — §10 MARP execution (only if deviation > threshold; in normal operation this is never called)
8. **Audit** — every step persisted to Turso `keeper_audit` table (best-effort; never blocks the tick)
9. **Alert** — Discord webhook on critical errors (rate-limited to 1 per 5 min per topic)

**Errors are caught and logged — the process NEVER crashes on a tick failure.**

---

## Endpoints (port 3040, FIXED)

| Method | Path       | Description |
|--------|------------|-------------|
| `GET`  | `/health`  | `{"status":"healthy","keeper":"0x...","contract":"0x...","lastTick":"...","uptime":N,"tickCount":N,"turso":"on/off","upstash":"on/off","discord":"on/off"}` — **uptime monitor target** |
| `POST` | `/tick`    | Schedules one keeper cycle (async). Returns `{"status":"accepted","tickEpoch":N}`. Poll `GET /health` for `lastTick`. |

**Note:** `/tick` is async and non-blocking (it can take 2–10s due to RPC round-trips). The uptime monitor should hit `/health`, NOT `/tick`.

---

## Run locally

```bash
cd mini-services/keeper
cp .env.example .env
# Fill in .env (testnet faucet for the keeper address — see below)
bun install
bun run index.ts
# → [keeper] listening on :3040
```

Dev mode (auto-restart on file changes via `bun --hot`):

```bash
bun run dev
```

Verify:

```bash
curl http://localhost:3040/health
# → {"status":"healthy","keeper":"0x...","lastTick":"...","uptime":42,...}

curl -X POST http://localhost:3040/tick
# → {"status":"accepted","tickEpoch":3,...}
```

Without `KEEPER_PRIVATE_KEY` set, `/health` still returns 200 (so the uptime monitor works) but `/tick` will log an init error and continue. This is intentional — the keeper fails gracefully.

---

## Create + fund the keeper wallet (testnet, free, no card)

The keeper key is a **HOT WALLET** — generate it on a machine you control, NOT in the sandbox:

```bash
# Generate a fresh keypair:
bun -e "import {ethers} from 'ethers'; const w = ethers.Wallet.createRandom(); console.log('PRIVATE_KEY:', w.privateKey); console.log('ADDRESS:', w.address)"
```

**Fund it with testnet-native gas only** (NOT USDC, NOT MTQ):

| Chain | Faucet | Amount needed |
|-------|--------|---------------|
| Monad Testnet | https://testnet.monadvision.com/faucet | 0.05 MON |
| Arc Testnet | https://faucet.testnet.arc.io | 0.001 ETH-equivalent |
| Robinhood Testnet | https://explorer.testnet.chain.robinhood.com/faucet | 0.001 ETH |

Then on the contract, grant `KEEPER_ROLE` to the keeper address (one-time, by `DEFAULT_ADMIN_ROLE` — the deployer wallet):

```solidity
// From the deployer wallet:
contract.grantRole(keccak256("KEEPER_ROLE"), KEEPER_ADDRESS);
```

---

## Deploy to Koyeb (FREE, no credit card)

> **Koyeb free tier:** 1 service, 512MB RAM, always-on (does NOT sleep on the free tier for web services, but we still wire up the uptime monitor as a belt-and-braces measure — Koyeb may restart instances at any time).

### Steps

1. **Push to GitHub** (public repo — private repos need a paid Koyeb tier).
2. **Connect GitHub to Koyeb:** https://www.koyeb.com → Sign up with GitHub → Authorize.
3. **Create service:**
   - Service type: **Docker image from Dockerfile**
   - Source: your GitHub repo, branch `main`
   - Build context: `mini-services/keeper` (the Dockerfile lives there)
   - Port: **3040** (matches `EXPOSE 3040` in Dockerfile)
   - Path: `/` (root — Koyeb will route to `/health` etc.)
4. **Set env vars** in the Koyeb dashboard (Service → Settings → Environment Variables):
   - `KEEPER_PRIVATE_KEY` — 🔴 hot wallet key
   - `KEEPER_ADDRESS` — the keeper's EVM address
   - `RPC_URL` — testnet RPC (see `.env.example`)
   - `CONTRACT_ADDRESS` — MTQSigmaV2 address
   - `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` — audit trail
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — (optional) distributed lock
   - `DISCORD_WEBHOOK_URL` — (optional) alerts
5. **Deploy.** Koyeb builds the Docker image and starts the service. The Koyeb-assigned URL looks like `https://mtqs-keeper-<random>.koyeb.app`.

---

## 🚨 CRITICAL: External uptime monitor (PRIMARY heartbeat)

> **Per COO correction #1:** Koyeb free instances can restart at any time. Outbound pings from the keeper do NOT prevent restarts. You MUST use an EXTERNAL uptime monitor that pings `https://<koyeb-url>/health` every 5 minutes.

### UptimeRobot (recommended — free, no card)

1. https://www.uptimerobot.com → Sign up (free tier: 50 monitors, 5-min checks).
2. **Add Monitor:**
   - Monitor type: **HTTP(s)**
   - Friendly name: `MTQΣ Keeper`
   - URL: `https://mtqs-keeper-<random>.koyeb.app/health`
   - Monitoring interval: **5 minutes**
3. **Alert contacts:** Add email + (optional) Discord webhook (UptimeRobot supports Discord natively in the free tier).
4. Save. UptimeRobot will alert you within 5 minutes if `/health` returns non-200 or times out.

### cron-job.org (alternative — free, no card)

1. https://cron-job.org → Sign up (free).
2. **Create Cronjob:**
   - URL: `https://mtqs-keeper-<random>.koyeb.app/health`
   - Execution: every 5 minutes
   - Notify on failure: yes

### GitHub Actions cron (BACKUP ONLY — 10-min minimum granularity)

The GitHub Actions workflow at `.github/workflows/keeper-heartbeat.yml` runs every **10 minutes** (GitHub Actions minimum) and pings `/health`. On failure, it posts to Discord. **This is a BACKUP** — it is NOT the primary monitor because:

- GitHub Actions minimum cron granularity is 5 minutes (and 10 minutes is the practical floor for reliability).
- GitHub Actions does not provide alert management (UptimeRobot does).

**Primary:** UptimeRobot (5-min).
**Backup:** GitHub Actions cron (10-min).

---

## Emergency response target: **5–15 minutes best-effort**

> Per COO correction: the keeper is NOT a 60-second-SLO production system. It is a testnet pilot keeper. Emergency response target is **5–15 minutes best-effort**, gated by:
> - UptimeRobot alert latency (≤5 min)
> - On-call engineer availability (best-effort, no dedicated NOC)
> - The contract's `pause()` function (only `PAUSER_ROLE`, multi-sig) is the kill switch — see `RUNBOOK.md` §1.

---

## Configuration reference

| Env var | Required | Default | Description |
|---------|----------|---------|-------------|
| `KEEPER_PRIVATE_KEY` | **yes** | — | 🔴 Hot wallet key. Holds `KEEPER_ROLE` only. |
| `KEEPER_ADDRESS` | yes | — | Keeper's EVM address (for /health + audit). |
| `RPC_URL` | **yes** | — | Testnet RPC endpoint. |
| `CONTRACT_ADDRESS` | **yes** | — | MTQSigmaV2 contract address. |
| `TURSO_DATABASE_URL` | yes | — | libSQL URL for audit trail. |
| `TURSO_AUTH_TOKEN` | yes | — | libSQL auth token. |
| `UPSTASH_REDIS_REST_URL` | no | — | Distributed lock (for dual-instance deploys). |
| `UPSTASH_REDIS_REST_TOKEN` | no | — | Upstash auth token. |
| `DISCORD_WEBHOOK_URL` | no | — | Critical alerts (rate-limited 1 per 5 min). |

**Port 3040 is hardcoded** in `index.ts` — it is NOT env-configurable per the task spec.

---

## Audit trail

The keeper lazily creates a `keeper_audit` table in Turso on first tick:

```sql
CREATE TABLE keeper_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tick_at     INTEGER NOT NULL,    -- ms since epoch
  tick_epoch  INTEGER NOT NULL,    -- monotonic tick counter
  step        TEXT NOT NULL,       -- 'advanceIndex' | 'commitWeights' | ...
  status      TEXT NOT NULL,       -- 'ok' | 'skip' | 'error'
  tx_hash     TEXT,                -- ethers tx hash (for 'ok' write steps)
  gas_used    INTEGER,
  message     TEXT,
  keeper      TEXT NOT NULL,
  contract    TEXT NOT NULL
);
CREATE INDEX keeper_audit_tick_epoch_idx ON keeper_audit(tick_epoch);
CREATE INDEX keeper_audit_status_idx     ON keeper_audit(status);
```

Query the last 24 hours of ticks:

```sql
SELECT tick_epoch, step, status, tx_hash, message, datetime(tick_at/1000, 'unixepoch') as t
FROM keeper_audit
WHERE tick_at > strftime('%s','now','-1 day') * 1000
ORDER BY tick_epoch DESC, id DESC
LIMIT 200;
```

---

## Security notes

- **The keeper key is a HOT WALLET.** Rotate monthly (see `RUNBOOK.md` §4).
- **Fund it with testnet-native gas only.** 0.05 MON on Monad testnet is plenty for months of ticks. Do NOT fund it with USDC or MTQ — the keeper has no role that touches those tokens.
- **The keeper CANNOT pause the contract.** `pause()` is gated by `PAUSER_ROLE` (multi-sig Safe 4/7). The keeper can only submit weight vectors and rebalance trades. If the keeper is compromised, the worst case is a bad weight vector — which the contract's admissibility envelopes reject (revert `Err12`/`Err06`).
- **No billing details.** Koyeb free tier, UptimeRobot free tier, Upstash free tier, Turso free tier — all no-card.

---

## Related

- `RUNBOOK.md` (project root) — War Room procedures, key rotation, postmortem template
- `.github/workflows/keeper-heartbeat.yml` — backup heartbeat (10-min GitHub Actions cron)
- `src/lib/mtq/contracts.ts` — deployed contract registry
- `contracts/MTQSigmaV2.sol` — the contract this keeper drives
- `Dockerfile.compute` + `.github/workflows/compute-engine.yml` — the deterministic MASE solver that produces the weight vectors this keeper submits
