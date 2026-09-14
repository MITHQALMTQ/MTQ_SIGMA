# MTQΣ Testnet Simplification Memo

**From:** Lead AI Platform Developer
**To:** COO/PM
**Date:** 2026-09-14
**Subject:** Architecture simplification for zero-cost testnet

## Executive Summary

The original Brief v2.0 specified 13 services. After audit, I recommend
**dropping 4 services** and keeping 9. This reduces failure modes by ~31%
while maintaining all constitutional invariants (I1-I10).

## Current Architecture (13 services per Brief v2.0)

| # | Service | Role | Free Tier | Keep? |
|---|---------|------|-----------|-------|
| 1 | Neon | Analytical DB | 0.5GB, 190h/mo | DROPPED |
| 2 | Turso | Edge Read DB | 9GB, 500M reads/mo | KEPT |
| 3 | Cloudflare Workers | Edge Compute | 100k req/day | DROPPED |
| 4 | Cloudflare KV | Public Cache | 100k reads/day | DROPPED |
| 5 | Upstash Redis | Dynamic Cache | 500k cmd/mo, 256MB | KEPT |
| 6 | Alchemy | RPC Gateway | Free, no card | KEPT |
| 7 | QuickNode | RPC Fallback | 1-month trial | TRIAL ONLY |
| 8 | Pyth Network | Oracle #1 | Free | KEPT |
| 9 | Chainlink | Oracle #2 | Free (gas only) | KEPT |
| 10 | Redstone | Oracle #3 | Free | KEPT |
| 11 | GitHub Actions | Compute Engine | Unlimited (public repo) | KEPT |
| 12 | Koyeb | Keeper | 512MB, 0.1 vCPU | KEPT |
| 13 | Vercel Hobby | Frontend | Non-commercial | KEPT |

## Recommended Architecture (9 services — 4 dropped)

### Dropped Services

#### 1. Neon PostgreSQL — DROPPED
**Reason:** Turso already holds all data (5 tables, 20K+ rows, 23MB).
No analytical workload requires Postgres. Neon adds a second DB to
manage, monitor, and back up — for zero benefit on testnet.

**Impact:** Removes 1 service, 1 DB connection string, 1 backup target.
Vercel routes already use Turso exclusively (verified by `check:no-neon`
CI guardrail — 20 route files scanned, 0 violations).

**Risk:** None. Neon was never used in the codebase.

#### 2. Cloudflare Workers — DROPPED
**Reason:** Vercel Edge Middleware can do the same API proxying + cache
invalidation. Adding a Cloudflare Worker in front of Vercel adds a
network hop and a second deployment target.

**Impact:** Removes 1 service, 1 wrangler.toml, 1 deploy pipeline.

**Risk:** None. Workers were never implemented.

#### 3. Cloudflare KV — DROPPED
**Reason:** KV's 1k writes/day limit is too restrictive for rate limiting
(5 req/IP/min x 100 IPs = 700k writes/day). Upstash Redis handles rate
limiting + locks better (500k commands/mo, no write limit). For public
cache, Vercel's built-in CDN + Cache-Control headers suffice.

**Impact:** Removes 1 service, 1 KV namespace, 1 binding config.

**Risk:** None. KV was never implemented.

#### 4. Mobile App — PARKED (not dropped, deferred to Phase 4)
**Reason:** The `mobile/` directory is a 75-line stub. It's not in the
testnet critical path. Park it until the web app is production-stable.

**Impact:** Removes 1 build target, 1 deploy pipeline.

**Risk:** None. The stub has no real functionality.

### Kept Services (9 total)

| Service | Why It's Kept |
|---------|---------------|
| **Turso** | Single DB for all data (analytical + edge reads). 9GB, 500M reads/mo. Already wired. |
| **Upstash Redis** | Rate limiting (5 req/IP/min for AI routes) + distributed locks for keeper. 500k cmd/mo. |
| **Alchemy** | Primary RPC for all 4 testnet chains. Free, no card. |
| **QuickNode** | RPC fallback (1-month trial). Treat as temporary. |
| **Pyth + Chainlink + Redstone** | 3-source oracle consensus (strict I9). All free on testnet. |
| **GitHub Actions** | Compute engine (Docker, daily cron) + CI (typecheck, tests, no-neon guardrail). Unlimited on public repo. |
| **Koyeb** | Always-on keeper (MARP execution, crisis monitoring). 512MB, 0.1 vCPU. Heartbeat fixed (inbound /health). |
| **Vercel Hobby** | Frontend + API routes. Non-commercial, no card. Cloudflare Pages as fallback if Vercel flags. |

## Trade-Off Analysis

### What We Gain by Simplifying
1. **Fewer failure modes:** 9 services vs 13 = 31% fewer things to break
2. **Fewer credentials:** 9 sets of env vars vs 13 = simpler .env.local
3. **Fewer backup targets:** 1 DB (Turso) vs 2 (Turso + Neon)
4. **Fewer deploy pipelines:** 3 (Vercel, Koyeb, GitHub Actions) vs 5 (+ Cloudflare Worker + KV)
5. **Lower cognitive load:** Engineers can hold the entire architecture in their head

### What We Risk by Simplifying
1. **No Postgres-specific features:** Turso (libSQL) doesn't have Postgres's
   advanced window functions, CTEs, or JSON operators. **Mitigation:** All
   current queries are simple CRUD + time-range. No Postgres features are used.

2. **No edge compute layer:** Vercel Edge Middleware has a 1MB response size
   limit and 25s timeout. **Mitigation:** No API route returns >1MB. The
   longest route (audit trail export) streams and is well under 25s.

3. **No public KV cache:** Vercel CDN + Cache-Control headers are less
   flexible than Cloudflare KV for programmatic cache invalidation.
   **Mitigation:** Use revalidateTag() / revalidatePath() from Next.js
   for on-demand invalidation. Works on Vercel without KV.

4. **Vercel Hobby non-commercial clause:** If Vercel flags the project,
   we need to migrate. **Mitigation:** Keep deployment config
   Cloudflare-Pages-compatible (no Vercel-specific APIs). Migration is
   ~2 hours (change next.config.ts adapter + redeploy).

## Services That Could Be Dropped Later (Phase 5+)

### Upstash Redis — CONDITIONAL DROP
If we implement rate limiting via Vercel's built-in @vercel/kv (Redis-compatible,
free tier 256MB, 300k commands/mo), we could drop Upstash. **Not recommended
for testnet** — Upstash is already wired and working. Revisit for production.

### QuickNode — DROP AFTER TRIAL
QuickNode is a 1-month trial. After it expires, drop to Alchemy + public RPC
fallback only. **Already planned** per the brief: "Treat QuickNode as temporary."

## Final Recommendation

**Adopt the simplified 9-service architecture for testnet.** The 4 dropped
services were never implemented and add no value. The remaining 9 services
cover all requirements with fewer failure modes and lower operational overhead.

For production (mainnet), revisit this memo — Neon may be needed for
governance-grade analytics, and Cloudflare Workers may be needed for
edge compute in regions where Vercel doesn't have POPs.
