interface Bucket { tokens: number; lastRefill: number; }
const buckets = new Map<string, Bucket>();
export const RATE_LIMITS = { ai: { capacity: 10, refillPerSec: 10/60 }, simulate: { capacity: 20, refillPerSec: 20/60 }, health: { capacity: 60, refillPerSec: 1 } } as const;
export function rateLimit(ip: string, category: keyof typeof RATE_LIMITS): { allowed: boolean; remaining: number; resetAt: number } {
  const config = RATE_LIMITS[category]; const key = `${ip}:${category}`; const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) { bucket = { tokens: config.capacity, lastRefill: now }; buckets.set(key, bucket); }
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(config.capacity, bucket.tokens + elapsed * config.refillPerSec);
  bucket.lastRefill = now;
  if (bucket.tokens >= 1) { bucket.tokens -= 1; return { allowed: true, remaining: Math.floor(bucket.tokens), resetAt: now }; }
  return { allowed: false, remaining: 0, resetAt: now + Math.ceil((1 - bucket.tokens) / config.refillPerSec) * 1000 };
}
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip"); if (real) return real;
  return "unknown";
}
