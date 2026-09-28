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
  // AI routes (briefing/qa/risk-signals/screen): 5 req per IP per minute.
  // Stricter than health — every hit burns Groq/Gemini/HF tokens = real cost.
  ai: { capacity: 5, refillPerSec: 5 / 60 },
  simulate: { capacity: 20, refillPerSec: 20 / 60 },
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

function rateLimitMemory(
  ip: string,
  category: keyof typeof RATE_LIMITS,
  config: { capacity: number; refillPerSec: number },
): RateLimitResult {
  const key = `${ip}:${category}`;
  const now = Date.now();
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

export function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
