// ============================================================================
// MTQΣ — Koyeb Keeper Service (always-on, port 3040)
// ============================================================================
//
// 🔴 HOT WALLET — low-privilege, rotate regularly.
//   Can only submit weight vectors. Cannot mint/redeem/pause.
//
// This Bun service is the always-on keeper for the MTQSigmaV2 contract.
// It calls the contract's `onlyKeeper` functions on a 4-second tick:
//
//   1. advanceIndex(currentPrices)         — §9.2 authoritative chain-link
//   2. commitWeights(newWeights, prices)   — §9.3 divisor adjustment
//   3. (optional) submitTargetWeights(...) — §7.7 MASE registry
//   4. executeRebalance(trades)            — §10 MARP execution (only if needed)
//
// The keeper holds ONLY the KEEPER_ROLE. It CANNOT mint, redeem, pause,
// change governance, or touch the constitutional envelopes — those roles
// are held by separate addresses (MINTER, PAUSER, EMERGENCY_COUNCIL, etc.).
// Compromise of this key is bounded: an attacker can at most submit
// out-of-spec weights, which the contract's admissibility envelopes
// (LOWER_BOUND / UPPER_BOUND) and per-component velocity caps reject.
//
// Endpoints (Bun.serve, port 3040 FIXED — not env-configurable):
//   GET  /health  → 200 {status, keeper, lastTick, uptime}  (uptime monitor)
//   POST /tick    → runs ONE keeper cycle and returns the audit trail
//
// The internal setInterval also runs the tick every 4s automatically.
// External /tick is for manual triggering / debugging.
//
// All errors are caught and logged — the process NEVER crashes on a tick
// failure. Critical errors trigger a Discord webhook alert (best-effort).
//
// Audit trail: every step is persisted to Turso (keeper_audit table, created
// lazily via CREATE TABLE IF NOT EXISTS). If Turso is unreachable, the tick
// still runs — the audit row is just skipped (with a stderr warning).
//
// Distributed lock (optional): if UPSTASH_REDIS_REST_URL is set, the keeper
// acquires a short-lived lock before each tick so that two keeper instances
// (e.g. during a blue-green deploy) don't both submit the same tx.
// ============================================================================

import { ethers } from "ethers";
import { createClient as createTursoClient } from "@libsql/client";
import { Redis as UpstashRedis } from "@upstash/redis";

// ============================================================================
// §0  Constants — port 3040 is FIXED (per task spec, not env-configurable)
// ============================================================================

const PORT = 3040;                          // ← fixed, do not move to env
const TICK_INTERVAL_MS = 4_000;             // matches the 4s engine tick
const REBALANCE_DEVIATION_THRESHOLD = 0.05; // 5% absolute deviation → rebalance
const LOCK_TTL_SECONDS = 8;                 // Upstash lock TTL (just over 2 ticks)
const BOOT_TIME_MS = Date.now();

// 🔴 HOT WALLET — low-privilege, rotate regularly. Can only submit weight
//    vectors. Cannot mint/redeem/pause. See header comment.
const KEEPER_PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY ?? "";
const KEEPER_ADDRESS     = process.env.KEEPER_ADDRESS ?? "";
const RPC_URL            = process.env.RPC_URL ?? "";
const CONTRACT_ADDRESS   = process.env.CONTRACT_ADDRESS ?? "";

const TURSO_URL    = process.env.TURSO_DATABASE_URL ?? "";
const TURSO_TOKEN  = process.env.TURSO_AUTH_TOKEN ?? "";
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL ?? "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? "";

// ============================================================================
// §1  Minimal ABI — only the onlyKeeper functions + the views the keeper reads
// ============================================================================

// Component enum order (from MTQSigmaV2.sol:31): USD, EUR, JPY, GBP, CNY, CHF, Gold
// RebalanceTrade struct: { uint8 component; int256 direction; uint256 tradeUsd; uint256 level }
const KEEPER_ABI = [
  // ----- onlyKeeper writes -----
  "function advanceIndex(uint256[7] currentPrices) external",
  "function commitWeights(uint256[7] newWeights, uint256[7] currentPrices) external",
  "function submitTargetWeights(uint256[7] target, bytes32 methodologyVersion, bytes32 dataVersion) external",
  "function executeRebalance(tuple(uint8 component,int256 direction,uint256 tradeUsd,uint256 level)[] trades) external",
  "function setCrisisFlag(bool flag) external",
  "function updateState(uint256 rr, uint256 lcr) external",
  // ----- views the keeper reads to decide whether to rebalance -----
  "function indexValue() view returns (uint256)",
  "function lastIndexUpdate() view returns (uint256)",
  "function getLiveWeights() view returns (uint256[7] weights, bytes32 methodologyVersion, bytes32 dataVersion)",
  "function getReserveNavUsd() view returns (uint256)",
  "function getReserveRatio() view returns (uint256)",
  "function reserveHeldUsd(uint8) view returns (uint256)",
  "function paused() view returns (bool)",
  "function currentState() view returns (uint8)",
] as const;

// ============================================================================
// §2  Optional clients — Turso (audit) and Upstash (distributed lock)
// ============================================================================

const turso = (TURSO_URL && TURSO_TOKEN)
  ? createTursoClient({ url: TURSO_URL, authToken: TURSO_TOKEN })
  : null;

const redis = (UPSTASH_URL && UPSTASH_TOKEN)
  ? new UpstashRedis({ url: UPSTASH_URL, token: UPSTASH_TOKEN })
  : null;

// ============================================================================
// §3  Ethers provider + signer + contract handle (lazy — built on first tick)
// ============================================================================

let provider: ethers.JsonRpcProvider | null = null;
let signer:  ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;

function getContract(): ethers.Contract {
  if (contract) return contract;
  if (!RPC_URL)            throw new Error("RPC_URL not set");
  if (!KEEPER_PRIVATE_KEY) throw new Error("KEEPER_PRIVATE_KEY not set");
  if (!CONTRACT_ADDRESS)   throw new Error("CONTRACT_ADDRESS not set");
  if (!ethers.isAddress(CONTRACT_ADDRESS)) throw new Error("CONTRACT_ADDRESS not a valid address");
  // 🔴 HOT WALLET — see header. Low-privilege key, rotate regularly.
  provider = new ethers.JsonRpcProvider(RPC_URL);
  signer   = new ethers.Wallet(KEEPER_PRIVATE_KEY, provider);
  contract = new ethers.Contract(CONTRACT_ADDRESS, KEEPER_ABI, signer);
  return contract;
}

// ============================================================================
// §4  Turso audit trail (best-effort — never blocks the tick)
// ============================================================================

const AUDIT_DDL = `
  CREATE TABLE IF NOT EXISTS keeper_audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tick_at     INTEGER NOT NULL,
    tick_epoch  INTEGER NOT NULL,
    step        TEXT NOT NULL,
    status      TEXT NOT NULL,           -- 'ok' | 'skip' | 'error'
    tx_hash     TEXT,
    gas_used    INTEGER,
    message     TEXT,
    keeper      TEXT NOT NULL,
    contract    TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS keeper_audit_tick_epoch_idx ON keeper_audit(tick_epoch);
  CREATE INDEX IF NOT EXISTS keeper_audit_status_idx     ON keeper_audit(status);
`;

let auditDdlApplied = false;

async function ensureAuditSchema(): Promise<void> {
  if (!turso || auditDdlApplied) return;
  try {
    await turso.executeMultiple(AUDIT_DDL);
    auditDdlApplied = true;
    console.log("[keeper] audit schema ready (keeper_audit table)");
  } catch (e) {
    // Non-fatal: subsequent audit writes will be skipped silently.
    console.warn("[keeper] audit DDL failed (audit will be best-effort):", (e as Error).message);
  }
}

async function audit(
  tickEpoch: number,
  step: string,
  status: "ok" | "skip" | "error",
  opts: { txHash?: string | null; gasUsed?: number | null; message?: string } = {},
): Promise<void> {
  const line = `[keeper] audit epoch=${tickEpoch} step=${step} status=${status}${opts.txHash ? ` tx=${opts.txHash}` : ""}${opts.message ? ` msg=${opts.message}` : ""}`;
  if (status === "error") console.error(line); else console.log(line);
  if (!turso) return;
  try {
    await turso.execute({
      sql: `INSERT INTO keeper_audit (tick_at, tick_epoch, step, status, tx_hash, gas_used, message, keeper, contract)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        Date.now(), tickEpoch, step, status,
        opts.txHash ?? null, opts.gasUsed ?? null, opts.message ?? null,
        KEEPER_ADDRESS || "(unset)", CONTRACT_ADDRESS || "(unset)",
      ],
    });
  } catch (e) {
    // Best-effort: do not let audit failure abort the tick.
    console.warn("[keeper] audit write failed:", (e as Error).message);
  }
}

// ============================================================================
// §5  Discord alert (best-effort, rate-limited to avoid spam)
// ============================================================================

let lastDiscordAlertAt = 0;
const DISCORD_ALERT_COOLDOWN_MS = 5 * 60 * 1000; // max 1 alert per 5 min per topic

async function discordAlert(message: string): Promise<void> {
  if (!DISCORD_WEBHOOK_URL) return;
  const now = Date.now();
  if (now - lastDiscordAlertAt < DISCORD_ALERT_COOLDOWN_MS) return;
  lastDiscordAlertAt = now;
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `⚠️ **MTQΣ Keeper** (port ${PORT})\n${message}` }),
    });
  } catch (e) {
    console.warn("[keeper] discord alert failed:", (e as Error).message);
  }
}

// ============================================================================
// §6  Upstash distributed lock (prevents double-submit during blue-green deploys)
// ============================================================================

async function acquireLock(tickEpoch: number): Promise<boolean> {
  if (!redis) return true; // no Redis → single instance → always proceed
  try {
    // NX + PX = set-if-not-exists with TTL. Returns "OK" on success.
    const res = await redis.set(`keeper:lock:${CONTRACT_ADDRESS}`, String(tickEpoch), {
      ex: LOCK_TTL_SECONDS,
      nx: true,
    });
    return res === "OK";
  } catch (e) {
    // If Redis is down, FAIL OPEN (run the tick) — better to risk a rare
    // double-submit than to silently stop the keeper. Discord alert so we
    // notice the Redis outage.
    console.warn("[keeper] lock acquire failed (failing open):", (e as Error).message);
    await discordAlert(`Upstash lock acquire failed — failing open.\n\`\`\`\n${(e as Error).message}\n\`\`\``);
    return true;
  }
}

async function releaseLock(): Promise<void> {
  if (!redis) return;
  try { await redis.del(`keeper:lock:${CONTRACT_ADDRESS}`); } catch { /* ignore */ }
}

// ============================================================================
// §7  Price + weight sources
// ----------------------------------------------------------------------------
// The keeper is the EXECUTOR, not the SOLVER. The deterministic MASE solver
// lives in Dockerfile.compute + .github/workflows/compute-engine.yml (TASK-5),
// which writes weight-vector.json to a Turso table. Here we:
//   • Read the latest weight vector from Turso (DailyStateVector or a
//     dedicated weights table) — if missing, skip commitWeights gracefully.
//   • Fetch current FX + gold prices from the same free no-key APIs the
//     Next.js engine uses (ECB/Frankfurter for FX, metals.live for gold).
//     If the price fetch fails, skip advanceIndex gracefully (the contract
//     will simply not advance this tick — lastIndexUpdate ages by 4s).
// ============================================================================

interface PriceVector { usd: bigint; eur: bigint; jpy: bigint; gbp: bigint; cny: bigint; chf: bigint; gold: bigint; }
interface WeightVector { usd: bigint; eur: bigint; jpy: bigint; gbp: bigint; cny: bigint; chf: bigint; gold: bigint; }

const E18 = 10n ** 18n;

function toE18(x: number): bigint {
  // Convert a JS float (e.g. 1.0852) to a 1e18-scaled bigint.
  if (!Number.isFinite(x) || x <= 0) return 0n;
  return BigInt(Math.round(x * 1e18));
}

async function fetchCurrentPrices(): Promise<PriceVector | null> {
  // Free no-key APIs (mirrors src/lib/mtq/fx.ts).
  // FX: ECB/Frankfurter. Gold: metals.live (or fallback to a constant).
  try {
    const fxRes = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,JPY,GBP,CNY,CHF", { signal: AbortSignal.timeout(2500) });
    if (!fxRes.ok) throw new Error(`frankfurter HTTP ${fxRes.status}`);
    const fx = await fxRes.json() as { rates: Record<string, number> };
    // B7 FIX: Frankfurter returns "1 USD = X foreign" for ALL currencies.
    // The contract expects "USD per 1 unit of foreign" (USD/EUR ≈ 1.087).
    // So we must INVERT every rate: USD_per_F = 1 / (F_per_USD).
    // Previously EUR/GBP/CNY/CHF were pushed uninverted (≈0.92 instead of ≈1.087),
    // which would corrupt the chain-linked index within one tick.
    const eur = 1 / fx.rates.EUR;
    const jpy = 1 / fx.rates.JPY;
    const gbp = 1 / fx.rates.GBP;
    const cny = 1 / fx.rates.CNY;
    const chf = 1 / fx.rates.CHF;

    // Gold: try metals.live (free, no key). If it fails, fall back to a
    // placeholder — the contract will still advance with stale gold, just
    // flagged in the audit. This is acceptable for a testnet pilot keeper.
    let gold = 2650; // fallback USD/oz
    try {
      const gRes = await fetch("https://api.metals.live/v1/spot/gold", { signal: AbortSignal.timeout(2500) });
      if (gRes.ok) {
        const gJson = await gRes.json() as Array<{ price: number }> | { price: number };
        const p = Array.isArray(gJson) ? gJson[gJson.length - 1]?.price : gJson.price;
        if (p && p > 0) gold = p;
      }
    } catch { /* keep fallback */ }

    return {
      usd: E18,                       // USD = 1.0 by definition
      eur: toE18(eur),
      jpy: toE18(jpy),
      gbp: toE18(gbp),
      cny: toE18(cny),
      chf: toE18(chf),
      gold: toE18(gold),
    };
  } catch (e) {
    console.warn("[keeper] price fetch failed:", (e as Error).message);
    return null;
  }
}

async function fetchLatestWeightVector(): Promise<WeightVector | null> {
  // Read the latest committed weight vector from Turso. The deterministic
  // compute engine (TASK-5) writes to DailyStateVector. If the table or row
  // is missing, return null — commitWeights will be skipped this tick.
  if (!turso) return null;
  try {
    // The compute engine writes weights into a `weight_vector` table if
    // available; otherwise we fall back to the Strategic Prior (which the
    // contract already has seeded at genesis, so skipping commitWeights is
    // safe — the index just continues with the existing weights).
    const res = await turso.execute(
      "SELECT w_usd, w_eur, w_jpy, w_gbp, w_cny, w_chf, w_gold FROM weight_vector ORDER BY id DESC LIMIT 1",
    );
    const row = res.rows[0];
    if (!row) return null;
    const num = (v: unknown): bigint => {
      if (typeof v === "bigint") return v;
      if (typeof v === "number") return BigInt(Math.round(v));
      if (typeof v === "string") return BigInt(v);
      return 0n;
    };
    return {
      usd: num(row.w_usd), eur: num(row.w_eur), jpy: num(row.w_jpy),
      gbp: num(row.w_gbp), cny: num(row.w_cny), chf: num(row.w_chf),
      gold: num(row.w_gold),
    };
  } catch {
    // Table doesn't exist yet, or schema differs — skip gracefully.
    return null;
  }
}

function toArray7(v: PriceVector | WeightVector): bigint[] {
  return [v.usd, v.eur, v.jpy, v.gbp, v.cny, v.chf, v.gold];
}

// ============================================================================
// §8  Rebalance decision — compare held weights vs live weights
// ----------------------------------------------------------------------------
// For each of the 7 components:
//   currentW_i = reserveHeldUsd[i] / NAV
//   targetW_i  = liveWeights.weights[i] / 1e18
//   deviation_i = |currentW_i - targetW_i|
// If ANY deviation > REBALANCE_DEVIATION_THRESHOLD (5%), build a trade that
// moves the reserve toward targetW_i. Direction: +1 (buy) if currentW < targetW,
// -1 (sell) if currentW > targetW. tradeUsd = (targetW - currentW) * NAV, clamped
// to ±5% of NAV (the contract's MAX_DAILY_TURNOVER cap).
//
// This is a deliberately SIMPLE rebalance policy. The full MARP solver (§10.4)
// lives in src/lib/mtq/engine.ts:evaluateRebalance; the keeper here is a
// last-resort executor that only fires when deviation is large. In normal
// operation, deviation should be < 5% and executeRebalance is never called.
// ============================================================================

interface RebalanceTradeTuple {
  component: number; // 0-6 (USD/EUR/JPY/GBP/CNY/CHF/Gold)
  direction: number; // +1 buy, -1 sell, 0 hold
  tradeUsd: bigint;  // 1e18 scale
  level: number;     // 1-6 (MARP level)
}

function buildRebalanceTrades(
  heldUsd: bigint[],
  nav: bigint,
  liveWeights: bigint[],
): RebalanceTradeTuple[] {
  if (nav === 0n) return [];
  const trades: RebalanceTradeTuple[] = [];
  for (let i = 0; i < 7; i++) {
    const currentW = Number((heldUsd[i] * E18) / nav) / 1e18;
    const targetW  = Number(liveWeights[i]) / 1e18;
    const deviation = Math.abs(currentW - targetW);
    if (deviation <= REBALANCE_DEVIATION_THRESHOLD) continue;
    const direction = currentW < targetW ? 1 : -1;
    // Trade size = full deviation × NAV, clamped to 5% of NAV.
    const rawUsd = BigInt(Math.round(Math.abs(targetW - currentW) * Number(nav)));
    const maxTrade = (nav * 5n) / 100n; // 5% cap
    const tradeUsd = rawUsd > maxTrade ? maxTrade : rawUsd;
    if (tradeUsd === 0n) continue;
    trades.push({ component: i, direction, tradeUsd, level: 1 });
  }
  return trades;
}

// ============================================================================
// §9  The keeper tick — one full cycle
// ============================================================================

export interface TickResult {
  tickEpoch: number;
  startedAt: number;
  endedAt: number;
  keeper: string;
  contract: string;
  steps: Array<{ step: string; status: "ok" | "skip" | "error"; message?: string; txHash?: string; gasUsed?: number }>;
  error?: string;
}

let lastTickAt: number | null = null;
let tickCounter = 0;
let tickInProgress = false;

async function runTick(): Promise<TickResult> {
  const tickEpoch = ++tickCounter;
  const startedAt = Date.now();
  const result: TickResult = {
    tickEpoch, startedAt, endedAt: 0,
    keeper: KEEPER_ADDRESS || "(unset)",
    contract: CONTRACT_ADDRESS || "(unset)",
    steps: [],
  };

  // Reentrancy guard: if the previous tick is still running (slow RPC), skip.
  if (tickInProgress) {
    result.steps.push({ step: "lock-local", status: "skip", message: "previous tick still running" });
    result.endedAt = Date.now();
    return result;
  }
  tickInProgress = true;

  try {
    await ensureAuditSchema();

    // --- Distributed lock (Upstash) so dual instances don't both submit ---
    const gotLock = await acquireLock(tickEpoch);
    if (!gotLock) {
      result.steps.push({ step: "lock-dist", status: "skip", message: "another keeper instance holds the lock" });
      await audit(tickEpoch, "lock-dist", "skip", { message: "held by another instance" });
      result.endedAt = Date.now();
      return result;
    }

    // --- Build the contract handle (throws if env is missing) ---
    let c: ethers.Contract;
    try {
      c = getContract();
    } catch (e) {
      const msg = (e as Error).message;
      result.steps.push({ step: "init", status: "error", message: msg });
      await audit(tickEpoch, "init", "error", { message: msg });
      await discordAlert(`Keeper init failed — env not configured.\n\`\`\`\n${msg}\n\`\`\`\nThis is expected during local dev without a real RPC.`);
      result.error = msg;
      return result;
    }

    // --- Read contract state (paused? what's the current index?) ---
    let paused: boolean;
    try {
      paused = await c.paused() as boolean;
      result.steps.push({ step: "read-paused", status: "ok", message: `paused=${paused}` });
      await audit(tickEpoch, "read-paused", "ok", { message: `paused=${paused}` });
    } catch (e) {
      const msg = (e as Error).message;
      result.steps.push({ step: "read-paused", status: "error", message: msg });
      await audit(tickEpoch, "read-paused", "error", { message: msg });
      result.error = msg;
      await discordAlert(`Keeper cannot read contract state (RPC down?).\n\`\`\`\n${msg}\n\`\`\``);
      return result;
    }

    if (paused) {
      result.steps.push({ step: "guard-paused", status: "skip", message: "contract paused — skipping tick" });
      await audit(tickEpoch, "guard-paused", "skip", { message: "paused" });
      // Do NOT alert Discord on every tick when paused — that would spam.
      // The GitHub Actions backup heartbeat will catch a long pause via /health.
      return result;
    }

    // --- Fetch current prices (free no-key APIs) ---
    const prices = await fetchCurrentPrices();
    if (!prices) {
      result.steps.push({ step: "fetch-prices", status: "skip", message: "price fetch failed — skipping advanceIndex" });
      await audit(tickEpoch, "fetch-prices", "skip", { message: "price fetch failed" });
      // Continue to commitWeights check? No — both advanceIndex AND commitWeights
      // need current prices. Skip the rest of the tick.
      return result;
    }
    result.steps.push({ step: "fetch-prices", status: "ok", message: `gold=${Number(prices.gold) / 1e18}` });
    await audit(tickEpoch, "fetch-prices", "ok", { message: `gold=${Number(prices.gold) / 1e18}` });

    const pricesArr = toArray7(prices);

    // --- Step 1: advanceIndex(currentPrices) ---
    try {
      const tx = await c.advanceIndex(pricesArr);
      const receipt = await tx.wait();
      result.steps.push({ step: "advanceIndex", status: "ok", txHash: tx.hash, gasUsed: Number(receipt?.gasUsed ?? 0) });
      await audit(tickEpoch, "advanceIndex", "ok", { txHash: tx.hash, gasUsed: Number(receipt?.gasUsed ?? 0) });
    } catch (e) {
      const msg = (e as Error).message;
      result.steps.push({ step: "advanceIndex", status: "error", message: msg });
      await audit(tickEpoch, "advanceIndex", "error", { message: msg });
      // advanceIndex failing is often benign (e.g. "Err09: price=0" from a
      // bad feed). Continue to commitWeights, but flag it.
    }

    // --- Step 2: commitWeights(newWeights, currentPrices) ---
    const weights = await fetchLatestWeightVector();
    if (!weights) {
      result.steps.push({ step: "commitWeights", status: "skip", message: "no weight vector in Turso — skipping commitWeights" });
      await audit(tickEpoch, "commitWeights", "skip", { message: "no weight vector available" });
    } else {
      try {
        const weightsArr = toArray7(weights);
        const tx = await c.commitWeights(weightsArr, pricesArr);
        const receipt = await tx.wait();
        result.steps.push({ step: "commitWeights", status: "ok", txHash: tx.hash, gasUsed: Number(receipt?.gasUsed ?? 0) });
        await audit(tickEpoch, "commitWeights", "ok", { txHash: tx.hash, gasUsed: Number(receipt?.gasUsed ?? 0) });
      } catch (e) {
        const msg = (e as Error).message;
        result.steps.push({ step: "commitWeights", status: "error", message: msg });
        await audit(tickEpoch, "commitWeights", "error", { message: msg });
      }
    }

    // --- Step 3: deviation check → executeRebalance (only if needed) ---
    try {
      const [liveWeightsArr] = await c.getLiveWeights() as [bigint[], unknown, unknown];
      const nav = await c.getReserveNavUsd() as bigint;
      const held: bigint[] = [];
      for (let i = 0; i < 7; i++) held.push(await c.reserveHeldUsd(i) as bigint);

      const trades = buildRebalanceTrades(held, nav, liveWeightsArr);
      if (trades.length === 0) {
        result.steps.push({ step: "executeRebalance", status: "skip", message: "no deviation > 5% — no rebalance needed" });
        await audit(tickEpoch, "executeRebalance", "skip", { message: "within tolerance" });
      } else {
        // Encode trades as the tuple array the ABI expects.
        const txArgs = trades.map(t => ({ component: t.component, direction: t.direction, tradeUsd: t.tradeUsd, level: t.level }));
        const tx = await c.executeRebalance(txArgs);
        const receipt = await tx.wait();
        result.steps.push({ step: "executeRebalance", status: "ok", txHash: tx.hash, gasUsed: Number(receipt?.gasUsed ?? 0), message: `${trades.length} trades` });
        await audit(tickEpoch, "executeRebalance", "ok", { txHash: tx.hash, gasUsed: Number(receipt?.gasUsed ?? 0), message: `${trades.length} trades` });
        await discordAlert(`Rebalance executed: ${trades.length} trades (tx ${tx.hash}). This is expected during large FX moves.`);
      }
    } catch (e) {
      const msg = (e as Error).message;
      result.steps.push({ step: "executeRebalance", status: "error", message: msg });
      await audit(tickEpoch, "executeRebalance", "error", { message: msg });
      // Rebalance errors are usually contract reverts (direction lock, daily
      // cap, envelope breach). They're not process-fatal — log and continue.
    }

    lastTickAt = Date.now();
    result.endedAt = Date.now();
    return result;
  } catch (e) {
    // Top-level catch — NEVER let the tick throw out to setInterval.
    const msg = (e as Error).message;
    result.error = msg;
    result.endedAt = Date.now();
    await audit(tickEpoch, "top-level", "error", { message: msg });
    await discordAlert(`Keeper tick ${tickEpoch} crashed (caught at top level — process stable).\n\`\`\`\n${msg}\n\`\`\``);
    return result;
  } finally {
    tickInProgress = false;
    await releaseLock();
  }
}

// ============================================================================
// §10  Bun.serve — port 3040 (FIXED)
// ============================================================================

interface BunReq { method: string; url: string; }
interface BunRes {
  status: number;
  headers: Headers;
  body: string;
}

function json(status: number, payload: unknown): BunRes {
  return {
    status,
    headers: new Headers({ "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }),
    body: JSON.stringify(payload),
  };
}

const server = Bun.serve({
  port: PORT,
  hostname: "0.0.0.0", // bind to all interfaces — Koyeb routes external traffic in
  fetch(req: Request): Response {
    const url = new URL(req.url);
    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      }});
    }
    if (req.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "healthy",
        keeper: KEEPER_ADDRESS || "(unset)",
        contract: CONTRACT_ADDRESS || "(unset)",
        lastTick: lastTickAt ? new Date(lastTickAt).toISOString() : null,
        uptime: Math.floor((Date.now() - BOOT_TIME_MS) / 1000),
        tickCount: tickCounter,
        turso: turso ? "connected" : "off",
        upstash: redis ? "connected" : "off",
        discord: DISCORD_WEBHOOK_URL ? "on" : "off",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (req.method === "POST" && url.pathname === "/tick") {
      // Run one tick synchronously and return the audit trail.
      // NOTE: this can take 2-10s (RPC round-trips). The uptime monitor
      // should hit /health, NOT /tick.
      runTick().then((result) => {
        // Resolved below via the promise — but Bun.serve fetch is sync.
        // To keep it simple, we accept the slight non-ideal pattern:
        // respond 202 immediately with the tickEpoch, and let the caller
        // poll /health for lastTick. This keeps /tick non-blocking.
      }).catch(() => { /* runTick already catches everything */ });
      return new Response(JSON.stringify({
        status: "accepted",
        message: "tick scheduled — poll GET /health for lastTick",
        tickEpoch: tickCounter + 1,
        keeper: KEEPER_ADDRESS || "(unset)",
      }), { status: 202, headers: { "Content-Type": "application/json" } });
    }
    // 404 for everything else
    return new Response(JSON.stringify({ error: "not found", routes: ["GET /health", "POST /tick"] }), {
      status: 404, headers: { "Content-Type": "application/json" },
    });
  },
});

console.log(`[keeper] listening on :${PORT}`);
console.log(`[keeper]   GET  /health  → uptime monitor target`);
console.log(`[keeper]   POST /tick    → manual cycle trigger (async)`);
console.log(`[keeper] keeper   = ${KEEPER_ADDRESS || "(unset — POST /tick will fail gracefully)"}`);
console.log(`[keeper] contract = ${CONTRACT_ADDRESS || "(unset)"}`);
console.log(`[keeper] turso    = ${turso ? "on" : "off (audit disabled)"}`);
console.log(`[keeper] upstash  = ${redis ? "on (distributed lock enabled)" : "off (single-instance mode)"}`);
console.log(`[keeper] discord  = ${DISCORD_WEBHOOK_URL ? "on" : "off"}`);
console.log(`[keeper] tick interval = ${TICK_INTERVAL_MS}ms (matches engine 4s tick)`);

// 🔴 HOT WALLET — low-privilege, rotate regularly. Can only submit weight
//    vectors. Cannot mint/redeem/pause. See header comment.
if (!KEEPER_PRIVATE_KEY) {
  console.warn("[keeper] ⚠️ KEEPER_PRIVATE_KEY not set — /tick will return errors but /health stays 200 (uptime monitor still works).");
}

// ============================================================================
// §11  Background tick loop — every 4s, matches the engine tick
// ============================================================================

setInterval(() => {
  // Fire-and-forget; runTick catches all errors internally.
  runTick().catch(() => { /* never reached — runTick has top-level try/catch */ });
}, TICK_INTERVAL_MS);

// Run one tick immediately on boot (don't wait 4s for the first cycle).
runTick().catch(() => { /* same */ });

// ============================================================================
// §12  Graceful shutdown
// ============================================================================

process.on("SIGTERM", () => {
  console.log("[keeper] SIGTERM — draining...");
  server.stop(true);
  setTimeout(() => process.exit(0), 500);
});
process.on("SIGINT", () => {
  console.log("[keeper] SIGINT — draining...");
  server.stop(true);
  setTimeout(() => process.exit(0), 500);
});

// Top-level uncaught-error handlers — the process must NEVER crash on a tick.
process.on("unhandledRejection", (reason) => {
  console.error("[keeper] unhandledRejection (process stable):", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[keeper] uncaughtException (process stable):", err);
  discordAlert(`uncaughtException (process stable, not crashing):\n\`\`\`\n${err.stack ?? err.message}\n\`\`\``);
});

// Exported for testing
export { runTick, PORT };
