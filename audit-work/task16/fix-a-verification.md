# Task 16-fix-A — Backend API Hardening — Verification Evidence

- Agent: Fix Agent 16-fix-A (controlled remediation, territory: backend API)
- Date: 2026-10-23 (UTC)
- Files changed (all in-file-set, nothing else touched):
  `src/lib/mtq/rate-limit.ts`, `src/app/api/simulate/mint/route.ts`,
  `src/app/api/simulate/redeem/route.ts`, `src/app/api/issuance/route.ts` (POST side only),
  `src/app/api/validation/route.ts`, `src/app/api/tests/route.ts` (force gating only),
  `src/app/api/onchain/[chain]/route.ts`, `src/app/api/roles/route.ts`,
  `src/app/api/trials/route.ts`, `src/app/api/trials/export/route.ts`,
  `src/app/api/inngest/route.ts`, `src/app/api/route.ts`, `src/app/api/evidence/route.ts`,
  `scripts/check-no-neon.ts`.
- Note: the mandate listed `src/app/api/onchain/route.ts` — **that file does not exist**
  (only `onchain/[chain]/route.ts`); nothing to fix there.
- All 14 files syntax-checked: `bun build <file> --target=bun --outdir=/tmp/t16fixa` → OK ×14.
- Dev server: NEVER restarted (uptime continuous 2663s → 3067s across the session); all
  verification via curl against :3000 with Fast Refresh picking up edits. Rate-limit tests
  used spoofed `X-Forwarded-For` IPs (203.0.113.x) so shared buckets were not polluted.

---

## Fix 1 — simulate/mint + simulate/redeem [16a-001, 16a-004, 16a-009 P3, 16d-004, 16e-007]

### 1a. Bad JSON → 400 (was 500 + SyntaxError leak) [16a-004]
```
curl -X POST -H 'Content-Type: application/json' -d ''                      /api/simulate/mint
curl -X POST -H 'Content-Type: application/x-www-form-urlencoded' -d 'amount=5' /api/simulate/mint
curl -X POST -H 'Content-Type: application/json' -d '{"amount":'             /api/simulate/mint
```
- Before (16a audit): `HTTP 500 {"ok":false,"error":"SyntaxError: Unexpected end of JSON input"}`.
- After: `HTTP 400 {"error":"Invalid JSON body"}` — all three cases (empty, form-encoded, truncated).
- Redeem: empty body → `HTTP 400 {"error":"Invalid JSON body"}` (same fix).

### 1b. Amount bounds [16a-001]
```
curl -X POST -d '{"amount":1e15}'   /api/simulate/mint   → HTTP 400 {"ok":false,"error":"Amount must be between 0 and 1,000,000"}
curl -X POST -d '{"amount":1000001}'/api/simulate/mint   → HTTP 400 (same)
curl -X POST -d '{"amount":-5}'     /api/simulate/mint   → HTTP 400 (same)
curl -X POST -d '{"amount":1e15}'   /api/simulate/redeem → HTTP 400 (same)
```
- Before: 1e15 was ACCEPTED (200) and flipped the live pilot to EMERGENCY (16a-001 incident).

### 1c. Body size guard → 413 [16e-007]
```
curl -X POST --data-binary @big.json (33KB wallet payload) /api/simulate/mint
→ HTTP 413 {"ok":false,"error":"Request body too large"}
```
- Before: 2MB bodies accepted + parsed (16e-007 probe).

### 1d. Rate limit "simulate" 12 req/IP/min + 429 + Retry-After [16a-001]
```
13× curl -X POST -H 'X-Forwarded-For: 203.0.113.120' -d '{"amount":-1}' /api/simulate/mint
→ 400 400 400 400 400 400 400 400 400 400 400 400 429
13th: HTTP 429, headers: retry-after: 5, x-ratelimit-remaining: 0,
      body {"ok":false,"error":"Rate limit exceeded"}
```
- Before: 25× POST → zero 429s (no limiter on the route). Tokens were burned with INVALID
  amounts (400) so the ledger was not mutated by the hammer.

### 1e. FAILED trials persisted [16d-004]
```
curl -X POST -d '{"amount":0.01,"wallet":"0xT16fixA-rejected"}' /api/simulate/mint
→ HTTP 200 (shape unchanged) {"ok":false,"mint":{"ok":false,
   "reason":"Minimum mint is 1 MTQΣ (§19.7, constitutional) — deposit more or mint at full capacity (current throttle 100%).", ...}}
curl /api/trials?limit=6 → newest row:
   { "type":"MINT","ok":false,"amount":0.01,"wallet":"0xT16fixA-rejected",
     "reason":"Minimum mint is 1 MTQΣ (§19.7, constitutional) — ..." }
```
- Before (16-d audit, live-proven): rejected trials were NEVER persisted (ok=1 on 100% of rows).
- After: engine rejections (and §17.7 oracle-gate rejections, reason from `resp.error`)
  persist with ok:false + the verbatim engine reason. Success-path rows byte-identical to before.

### Success path unchanged
```
curl -X POST -d '{"amount":100,"chain":"monad","wallet":"0xT16fixA-success-mint"}' /api/simulate/mint
→ HTTP 200 {ok:true, mint:{ok:true, inputUsd:100, mtqMinted:84.83…, mtqPrice, throttleFactor,
  newCirculatingSupply, newReserveRatio, price, newCirculating, newRR (V2 aliases), …}, snapshot:{…}}
row visible in /api/trials with ok:true
curl -X POST -d '{"amount":50}' /api/simulate/redeem → HTTP 200 {ok:true, redeem:{ok:true, netUsd:…}}
```

### 1f. chain/wallet hygiene [16a-009 P3]
```
curl -X POST -d '{"amount":10,"wallet":"bad\u0007char"}' /api/simulate/mint
→ HTTP 400 {"ok":false,"error":"Invalid wallet"}
```
- Code: trim + cap (chain ≤ 24, wallet ≤ 64 chars) + control-char rejection; free text kept
  otherwise (verified: `wallet:"=SUM(A1:A2)"` accepted → row persisted, then neutralized in CSV).

---

## Fix 2 — POST /api/issuance rate limit [16a-003]
```
7× curl -X POST -H 'X-Forwarded-For: 203.0.113.122' -d '{"scenario":"bogus"}' /api/issuance
→ 400 400 400 400 400 400 429   (6/min "issuance" bucket)
8th: HTTP 429 {"error":"Rate limit exceeded"}
Functional: curl -X POST -d '{"scenario":"happy-path"}' (fresh IP)
→ HTTP 200, run.persistence: {written:14, disclosed:"all 14 events persisted…"} — demo intact.
```
- Before: hammer of 25× → zero 429s (unrate-limited multi-row DB write surface).

---

## Fix 3 — force-run gating [16a-002 + 16c-001] (ALLOW_FORCE_RUNS unset on this host)
```
curl '/api/validation?force=1'
→ HTTP 200 {cached:true, forceUsed:false, results:11, audit:{…preserved…},
  forceNote:"Re-runs are disabled on this host (memory guard) — serving the last recorded run."}
curl '/api/tests?force=1'
→ HTTP 200 {cached:true, forceUsed:false, totalRuns:10300, suites:8, forceNote:"…same…"}
curl '/api/validation'  → {cached:true, forceUsed:false}            (forceNote absent — not requested)
curl '/api/tests'       → {cached:true, forceUsed:false}            (forceNote absent)
```
- Before: `?force=1` re-ran the full Monte-Carlo in-request → **OOM-killed the server** (16a-002
  incident). After: force is IGNORED (forceUsed:false), all other response fields preserved,
  server stayed alive the whole session (health uptime continuous; no watchdog restart).
- Also implemented (defense-in-depth): if force is requested-and-denied AND no recorded run
  exists at all → 503 instead of an in-request run. `ALLOW_FORCE_RUNS=true` restores re-runs.

---

## Fix 4 — clean error bodies [16a-004-class] (my route files only)
- mint/redeem catch → `{ok:false,error:"Internal error"}` + server-side `console.error`
  (was `String(e)` — live-proven leak class).
- issuance POST catch → `{error:"Internal error"}` (was `{error:"…", detail:String(e)}`).
  GET-side fail-soft disclosures intentionally untouched (mandate: POST side only).
- validation catch → `{error:"Internal error"}` (was `msg.slice(0,200)`).
- tests inner catch → `{error:"Internal error"}` (was `e2.message?.slice(0,200)`).
- evidence: new try/catch → generic 500.
- onchain/[chain] catch → 502 `{error:"Upchain RPC unavailable"}` (was `e.message.slice(0,200)`;
  provider URLs/latency can no longer reach the client) — code-verified (upstream failure not
  artificially induced).
- roles catch → sanitized `reason` (no `e.message`), full detail logged server-side.
- grep after fix: zero `String(e)` / response-body `e.message` leaks remain in my file set
  (remaining repo hits are in files owned by other agents: metrics/succession/v3/banks/fred/
  ai/*/mandate/constituency/sync).

---

## Fix 5 — rate-limit.ts [16a-005 / 16e-003]
- (a) Bucket eviction: `pruneBuckets()` runs opportunistically on every in-memory
  `rateLimitMemory()` call — entries untouched >65s deleted (every bucket refills to capacity
  within 60s, so they carry no enforceable state); hard cap `MAX_TRACKED_BUCKETS = 10_000`,
  oldest-touched quartile evicted at the cap. Closes the spoofed-IP memory-growth vector (16e-003b).
- (b) `RATE_LIMITS.ai` 5/min → 10/min. Live: 11× `curl -H 'X-Forwarded-For: 203.0.113.150'
  /api/ai/briefing` → `200 ×10, 429` (11th), `retry-after: 4`. (ai/status uses the health bucket
  by design — tested via briefing.)
- (c) XFF trust boundary documented in-code at `getClientIP` (gateway overwrites XFF; direct
  :3000 spoofable; residual accepted for sandbox, recorded in audit 16e-003). Behavior unchanged
  (a trusted-proxy fix is not reachable from the Web Request API in Next dev).
- Also added buckets: `simulate` 20→12/min (see note), `issuance` 6/min, `rpc` 30/min, `evidence` 10/min.
- COORDINATION NOTE: the `simulate` bucket is SHARED with the mbg mint-request/status routes
  (pre-existing 20/min). Tightening it to 12/min tightens those too — stricter, never looser;
  mbg mint-request live-checked post-change: normal 400 validation ladder intact.

---

## Fix 6 — onchain/[chain] + roles [16a-007]
```
curl /api/onchain/garbagechain → HTTP 404 {"error":"Unknown chain"}      (clean, no URL leak)
curl /api/onchain/999          → HTTP 404 {"error":"Unknown chain"}
31× curl -H 'X-Forwarded-For: 203.0.113.130' /api/onchain/garbage
→ 404 ×30, then HTTP 429 {"error":"Rate limit exceeded"}  (30/min "rpc" bucket)
curl -H 'X-Forwarded-For: 203.0.113.131' /api/roles
→ HTTP 200 {status:"LIVE", mode:"READ-ONLY eth_call…", chains:2}          (route functional)
```
- Upstream-failure bodies are now generic 502 `"Upchain RPC unavailable"` (onchain) /
  sanitized DEGRADED reason (roles keeps its honest degrade-to-verified-snapshot contract —
  see worklog deviation note). Real-chain success path spot-checked once: `/api/onchain/solana`
  → 200 {chain:"Solana Devnet", codePresent:true, decimals:18}.

---

## Fix 7 — trials limit + CSV injection [16a-008 / 16a-009 / 16d-005]
```
curl '/api/trials?limit=abc'      → HTTP 400 {"error":"limit must be an integer 1-500"}
curl '/api/trials?limit=2.5'      → HTTP 400 (same)
curl '/api/trials?limit=99999999' → HTTP 200, rows: 9   (clamped ≤500)
curl '/api/trials?limit=-5'       → HTTP 200, rows: 1   (clamped ≥1)
curl '/api/trials/export?limit=abc' → HTTP 400 {"error":"limit must be an integer 1-5000"}
curl '/api/trials/export' (json)    → {count:9} (no misleading DB error)
```
- Before: limit=abc → 200 `{"trials":[],"error":"Database not available on this deployment"}`
  while the DB was healthy (NaN flowed into Prisma take). Now "Database not available" is only
  reachable on a real DB failure.
- CSV formula-injection neutralization (OWASP):
```
mint with wallet "=SUM(A1:A2)" → row persisted; export:
…,"NORMAL","true","","'=SUM(A1:A2)"
also neutralized: the 16-d audit row → "'=16d-csv-inject-test"
```
Cells starting with `=`, `+`, `-`, `@` or TAB get a visible `'` prefix (documented in-code).

---

## Fix 8 — inngest fail-closed [16b-001 / 16a-006]
```
curl /api/inngest           → HTTP 503 {"error":"Inngest disabled (no signing key)","mode":"disabled"}
curl -X POST /api/inngest   → HTTP 503 (same)
curl -X PUT  /api/inngest   → HTTP 503 (same)
```
- Before: `HTTP 500 {"code":"internal_server_error"}` on every method (SDK cloud-mode throw).
- Stale "dev mode works without a key" comment corrected in-file (dev mode requires explicit
  `INNGEST_DEV=1`; 16e-011 caveat documented — dev mode does no signature checks, local host only).
  `INNGEST_SIGNING_KEY` path and `INNGEST_DEV=1` path preserve the previous serve() behavior.

---

## Fix 9 — /api root stub [16a-013 / 16a P3]
```
curl /api → HTTP 200 {"service":"MTQΣ Pilot Command Center API","status":"testnet-shadow",
                        "docs":"/api/health","metrics":"/api/metrics"}
```
- Before: `{"message":"Hello, world!"}`, undocumented, no dynamic export. Now force-dynamic.

---

## Fix 10 — /api/evidence [16a-010]
```
curl -H 'X-Forwarded-For: 203.0.113.140' /api/evidence
→ HTTP 200 {meta:{runtimeHead:"b04d057…", runtimeHeadNote:"git HEAD at request time…",
  posture:"REVIEW-ONLY — NOT ACCEPTED…"}, …}   (payload fields unchanged)
11× curl -H 'X-Forwarded-For: 203.0.113.141' /api/evidence → 200 ×10, then HTTP 429 (10/min)
```
- execSync → async `exec` (promisified), result cached in-module 60s, "evidence" bucket added,
  generic 500 body. Command remains a fixed argv string (no injection surface — corroborated by 16-e).

---

## Fix 11 — check-no-neon indirect-usage guard [16e-004]
```
bun run scripts/check-no-neon.ts
→ ❌ src/app/api/sync/route.ts: matches /from\s+['"][^'"]*neon-client['"]/
  ✗ 1 violation(s) found. … EXIT CODE: 1
```
- Before: "✓ Scanned 47 route files — no Neon/Postgres imports found" (exit 0) while the sync
  route queries Neon via `@/lib/neon-client` — guard bypassed by indirection.
- After: guard detects direct AND indirect (`*neon-client` static/dynamic imports) usage and
  **FAILS (exit 1) — EXPECTED**, per mandate, until the sync route is refactored (owned outside
  16-fix-A). The script's output says exactly this; guard not silenced/allowlisted/weakened.

---

## End state
- `/api/health` → `{"status":"healthy","checks":{"engine":true,"db":true}}` (uptime continuous —
  the server was never restarted or OOM-killed during the fix).
- `/api/metrics` → `{"status":"NORMAL", circulatingSupply:333, reserveRatio:1031}` — pilot left
  NORMAL (my test mints/redeems were ≤100 USD and mostly validation-rejected).
- `GET /` → HTTP 200 (frontend intact).
- No compile errors in dev.log after the edits.
