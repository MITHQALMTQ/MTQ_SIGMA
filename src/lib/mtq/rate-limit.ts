// Rate limiting for MTQΣ API routes.
//
// Backing strategy:
//   - When process.env.UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are
//     set, rate-limit state is stored in Upstash Redis so it is shared across
//     every Vercel serverless instance. This is required for production.
//   - Otherwise, an in-memory Map is used.
//
// In-memory limiter is for dev only. On Vercel, each cold start = fresh state.
// Set UPSTASH_REDIS_REST_URL for production.

import { Redis } from "@upstash/redis";

interface Bucket {
  tokens: number;
  lastRefill: number;
}

// In-memory store (dev fallback). Persisted at module scope across requests
// within a single instance lifetime only.
const buckets = new Map<string, Bucket>();

// Lazily create the Upstash client only if env vars are set, so dev environments
// without Upstash credentials never pay the import cost or fail at module load.
let _redis: Redis | null = null;
let _redisChecked = false;
function getRedis(): Redis | null {
  if (_redisChecked) return _redis;
  _redisChecked = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      _redis = new Redis({ url, token });
    } catch {
      _redis = null;
    }
  }
  return _redis;
}

export const RATE_LIMITS = {
  // AI routes (briefing/qa/risk-signals/screen): 10 req per IP per minute.
  // [16a-005/16e-003 fix, Task 16-fix-A] raised from 5/min to 10/min; the
  // frontend pollers were slowed to match (coordinated fix). Every hit burns
  // Groq/Gemini/HF tokens when keys are configured = real cost, so this stays
  // far below the health bucket.
  ai: { capacity: 10, refillPerSec: 10 / 60 },
  // Simulate surfaces (simulate/mint, simulate/redeem, mbg mint-request/status):
  // 12 req per IP per minute. [16a-001 fix] mint/redeem previously had NO
  // limiter at all; they mutate the live pilot ledger and persist DB rows, so
  // they get the tightest mutation budget. (Was 20/min shared by the mbg
  // routes only — the shared capacity is tightened to 12, never loosened.)
  simulate: { capacity: 12, refillPerSec: 12 / 60 },
  // [16a-003 fix] POST /api/issuance demo runner: 6 req per IP per minute.
  // Each run persists ~14 IssuanceEvent rows to the durability mirror (the
  // documented 4th pilot write surface) — the hammer is bounded.
  issuance: { capacity: 6, refillPerSec: 6 / 60 },
  // [16a-007 fix] on-chain verification routes (onchain/[chain], roles):
  // 30 req per IP per minute. Each request fans out to multiple external
  // RPC eth_calls (roles: dozens ×3 retries across 2 chains) — amplification
  // surface when unrate-limited.
  rpc: { capacity: 30, refillPerSec: 30 / 60 },
  // [16a-010 fix] /api/evidence: 10 req per IP per minute (was unrate-limited;
  // the git HEAD probe is also cached 60s in-module now).
  evidence: { capacity: 10, refillPerSec: 10 / 60 },
  health: { capacity: 60, refillPerSec: 1 },
  // Proof of Reserve (PoR) public API: 60 req per IP per minute. Same
  // budget as health — PoR is a public good, but the underlying pilot
  // state computation is non-trivial. STABILITY-POOL-FEES-POR.
  por: { capacity: 60, refillPerSec: 1 },
} as const;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // epoch ms when the bucket will have ≥1 token again
}

// Fixed-window size for the Redis-backed counter (seconds). The in-memory
// limiter stays token-bucket (smooth), but Redis uses a per-minute fixed
// window because that maps cleanly to a single INCR + EXPIRE per key.
const WINDOW_SEC = 60;

async function rateLimitRedis(
  ip: string,
  category: keyof typeof RATE_LIMITS,
  config: { capacity: number },
): Promise<RateLimitResult> {
  const redis = getRedis()!;
  const now = Date.now();
  const windowIndex = Math.floor(now / 1000 / WINDOW_SEC);
  const key = `rl:${category}:${ip}:${windowIndex}`;
  // INCR is atomic in Upstash — safe against concurrent requests across
  // instances. Set TTL only on the first increment so the key expires
  // shortly after the window closes.
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SEC + 1);
  }
  const windowEnd = (windowIndex + 1) * WINDOW_SEC * 1000;
  if (count > config.capacity) {
    return { allowed: false, remaining: 0, resetAt: windowEnd };
  }
  return {
    allowed: true,
    remaining: Math.max(0, config.capacity - count),
    resetAt: windowEnd,
  };
}

// [16e-003 fix, Task 16-fix-A] Memory bound for the in-memory fallback
// store. Previously every request with a distinct client IP (spoofable via
// X-Forwarded-For on the direct :3000 port — see getClientIP) minted a
// PERMANENT Map entry with no eviction → unbounded memory growth under the
// 768MB dev heap cap. Pruning is opportunistic on every rateLimitMemory()
// call:
//   1. entries untouched for > STALE_BUCKET_MS are deleted — every bucket
//      refills to full capacity within 60s, so an untouched entry carries no
//      enforceable state;
//   2. if the map is still at/over MAX_TRACKED_BUCKETS after that sweep,
//      the oldest-touched quartile is evicted (hard cap, only reachable
//      under spoofed-IP flood; honest traffic never sees it).
const MAX_TRACKED_BUCKETS = 10_000;
const STALE_BUCKET_MS = 65_000;

function pruneBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > STALE_BUCKET_MS) buckets.delete(key);
  }
  if (buckets.size >= MAX_TRACKED_BUCKETS) {
    const oldest = [...buckets.entries()].sort(
      (a, b) => a[1].lastRefill - b[1].lastRefill,
    );
    const evict = Math.ceil(oldest.length / 4);
    for (let i = 0; i < evict; i++) buckets.delete(oldest[i][0]);
  }
}

function rateLimitMemory(
  ip: string,
  category: keyof typeof RATE_LIMITS,
  config: { capacity: number; refillPerSec: number },
): RateLimitResult {
  const key = `${ip}:${category}`;
  const now = Date.now();
  pruneBuckets(now);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: config.capacity, lastRefill: now };
    buckets.set(key, bucket);
  }
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    config.capacity,
    bucket.tokens + elapsed * config.refillPerSec,
  );
  bucket.lastRefill = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens), resetAt: now };
  }
  return {
    allowed: false,
    remaining: 0,
    resetAt: now + Math.ceil((1 - bucket.tokens) / config.refillPerSec) * 1000,
  };
}

// Returns a RateLimitResult. If Upstash env vars are configured, uses Redis
// for distributed limiting across serverless instances. Otherwise falls back
// to in-memory (dev only). If Redis errors at runtime (network/auth/quota),
// we fall back to in-memory rather than fail-closed so the app stays usable;
// the dev limiter still bounds abuse from any single instance.
export async function rateLimit(
  ip: string,
  category: keyof typeof RATE_LIMITS,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[category];
  const redis = getRedis();
  if (redis) {
    try {
      return await rateLimitRedis(ip, category, config);
    } catch {
      return rateLimitMemory(ip, category, config);
    }
  }
  return rateLimitMemory(ip, category, config);
}

// [16a-005/16e-003 — documented residual, accepted for the sandbox]
// XFF TRUST BOUNDARY: the Caddy gateway (:81) overwrites X-Forwarded-For
// with the true client IP (verified live — spoofing through the gateway
// fails), but the app ALSO listens directly on :3000, where any client can
// send an arbitrary X-Forwarded-For and mint a fresh rate-limit bucket per
// request (re-proved live by audit 16a-005/16e-003). A trusted-proxy fix
// (honor XFF only when the socket peer is the gateway) is not reachable
// from the Web Request API inside Next dev. The residual is ACCEPTED for
// this sandbox pilot, mitigated by the bucket-eviction memory cap above,
// and recorded in audit-work/task16 (16e-003).
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
