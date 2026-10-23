# Task 16-a — API Contract Audit (complete backend, mandate §5)

- Agent: Audit Agent 16-a (READ-ONLY auditor; no source files modified)
- Date: 2026-10-23 (UTC)
- Scope: every `route.ts` under `src/app/api/` (48 files, 4,196 LOC) + live curl contract tests against the running dev server (localhost:3000) + rate-limit verification + schema-drift check + DB-write surface + secrets scan + caching audit.
- Env during audit: `.env` sets ONLY `DATABASE_URL=file:…` (local SQLite). No Turso/Neon/Upstash/Inngest/AI/FRED/Tenderly/Discord/MBG credentials ⇒ in-memory rate limiter, AI fallback-rules, fred 503, tenderly 503, inngest broken (500), MBG auth closed (401). This env was profiled without printing any secret values.
- Test methods: curl (status + body + headers), jq, od -c (byte-exact where the tool renderer ate `[h` sequences — false alarm, see §F).

## A. Route register (48 routes)

| Route | Method | Purpose | Validation | Rate-limit | DB write | External calls | Status codes observed (live) | Notes |
|---|---|---|---|---|---|---|---|
| /api | GET | stub "Hello, world!" | none | none | no | no | 200 | No `dynamic` export → static in prod build; dead scaffold, not in UI API table (16a-013) |
| /api/health | GET | engine+db liveness | none | health 60/min | no (SELECT 1 read) | no | 200; 429 when hammered (61st) | Retry-After + X-RateLimit-Remaining ✓; 503 when degraded |
| /api/status | GET | protocol/chains/canonical addrs + live metrics mini | none | none | no | no | 200 | Exposes deployer wallet (public posture, labeled) |
| /api/metrics | GET | full engine snapshot (4s tick) | none | none | no | no | 200 | 164KB payload; force-dynamic; no explicit Cache-Control (force-dynamic suffices; client uses no-store) |
| /api/contracts | GET | deployer + chain registry | none | none | no | no | 200 | Public chain data |
| /api/fx | GET | FX/macro snapshot | none | none | no | upstream feeds via engine snapshot only | 200 | Passthrough of getFx() |
| /api/oracle | GET | oracle board (pairs/feeds/aggregateState) | none | none | no | no (snapshot) | 200 | Passthrough |
| /api/registry | GET | asset registry + concentration | none | none | no | no | 200 | Passthrough |
| /api/gfb | GET | public GFB index API (labeled W^Prior vs live weights) | none | none | no | no | 200; 503 if engine not ready | Honest labeling ✓ |
| /api/evidence | GET | Evidence Package v6 | none | none | no | execSync("git rev-parse HEAD") per request | 200 | Process spawn per request, unrate-limited (16a-010); fixed command, no injection |
| /api/release-state | GET | release-control state (fail-closed) | none | none | no | no | 200 | Grants nothing ✓ |
| /api/implementation-status | GET | §87 implementation report | none | health | no | no | 200 | `{report, generatedAt}` shape |
| /api/constituency | GET | dynamic-membership machinery (QUIESCENT) | none | none | no | no | 200 | no-store ✓; honest-limits disclosure ✓ |
| /api/succession | GET | candidate universe + quotes | none | none | no | fetchCandidateQuotes (FX feeds) | 200 | |
| /api/succession | POST | state-clone succession simulation | EXEMPLARY: ejected whitelist, shockPct∈(0,100), successor whitelist, empty body→400 w/ clear msg | none (compute-only, no DB) | no | quotes fetch | 200 valid; 400 for GOLD-eject / shockPct −5 / 99999 / successor ZZZ / empty body | Best-validated POST in the codebase |
| /api/roles | GET | LIVE AccessControl role matrix (eth_call view fns) | none | **none** | no | Monad+Arc testnet RPCs (blockNumber + dozens of eth_calls, 3 retries, 10s timeouts) | 200 (1.97s cold; 60s module cache); DEGRADED path returns 200 + last verified snapshot | Unrate-limited RPC amplification (16a-007); degraded path honest ✓ |
| /api/trials | GET | PilotTrial rows | `limit` weakly parsed (Math.min(Number,200)) — NaN/neg/fractional accepted | none | no (read) | no | 200; `limit=abc` → 200 + **misleading** `error:"Database not available on this deployment"` (16a-008) | DB reads local SQLite |
| /api/trials/export | GET | trials JSON/CSV export | same weak `limit` (cap 5000) | none | no (read) | no | 200 (json); 200 (csv w/ headers+quoted cells) | CSV quoting ok; no formula-injection neutralization (16a-009) |
| /api/tests | GET | Monte-Carlo test suite (disk cache test-results.json) | `force=1` exact-match string | **none** | no (read-only; runs in-process compute on force/cold) | no | 200 cached:true | `?force=1` re-runs full Monte Carlo in-request — same OOM class as /api/validation (16a-002); reached by TestsSection "re-run" button |
| /api/validation | GET | §23 stress suite (disk cache validation-results.json) | `force=1` exact-match | health | **file write**: `writeFileSync(src/lib/mtq/validation-results.json)` on force/cold | no | 200 cached:true; **?force=1 → server OOM-kill** (curl got no response after 118s; process died, watchdog restarted) | 16a-002 (server kill) + unexpected file-write surface into source tree |
| /api/honest-status | GET | §25.5 gates + disclosures | none | health | no | no | 200; 429 | no-store ✓ |
| /api/v3 | GET | V3 architecture status + gates | none | health | no | no | 200 | Returns `MTQ_V3_CONTRACT_ADDRESS` env value (null here; public-by-nature contract address, not a secret) |
| /api/mandate | GET | mandate reference layer (self-tests, pipeline demo, registers) | none | health | no | reads audit-work/v5/safe-verification.json (read-only) | 200 (68KB) | no-store ✓ |
| /api/por | GET | Proof-of-Reserve status | `bank` regex `^0x[a-fA-F0-9]{40}$` else falls back to 0x0 (lenient by design, 200 not 4xx) | por 60/min | no | no | 200 | no-store ✓; pilot fallback clearly labeled ✓ |
| /api/banks | GET | bank registry | none | health | no | no | 200 | `Cache-Control: public, s-maxage=60, swr=300` (intentional, registry static) |
| /api/stability-pool | GET | stability pool state | none | health | no | no | 200 | no-store ✓ |
| /api/sync | GET | hybrid sync status | none | health | no | no | 200 | Reports configured flags as ✓/✗ without leaking URLs ✓ |
| /api/sync | POST | trigger Inngest sync event | body ignored | health | no | **Inngest Cloud API call** (inngest.send) | 200 `{ok:false,error:"Inngest API Error: 401 Event key not found"}` (3.8s) | Unauthenticated external-call trigger; upstream error text surfaced (16a-012) |
| /api/inngest | GET/POST/PUT | Inngest serve() endpoint | SDK-managed | none (SDK) | no (functions only count/read) | Inngest SDK | **500 `{"code":"internal_server_error"}`** on GET and POST | Misconfigured: "In cloud mode but no signing key found… set INNGEST_DEV=1" (16a-006) |
| /api/webhooks/tenderly | GET | uptime probe | none | none | no | no | 200 | Reveals only discord-enabled flag |
| /api/webhooks/tenderly | POST | Tenderly alert receiver | HMAC-SHA256 via X-Tenderly-Webhook-Signature, constant-time compare | none | no | Discord webhook (if configured) | 503 (secret not configured — fail-closed ✓); would be 401 on bad signature | Correct fail-closed design ✓ |
| /api/mbg/mint-request | POST | BM-07/BM-08 mint-request entry (pilot-mirror) | STRONG: bank/corpHash/certId regex, amountUsd>0, jurisdiction len 2, nonce≥0, expiry future; JSON parse → 400 | simulate 20/min | **YES**: `db.mbzMintRequest.create` + `db.mbzBackingCertificate.create` (inline ABC) | no | 400 invalid JSON/bad bank; 401 no-auth / no API key on file; 403 layers | Auth fail-closed in this env (bypass flag unset, no apiKeyHash, no HMAC secret) ⇒ write surface currently unreachable; fractional nonce/expiry would silently skip mirror (16a-011) |
| /api/mbg/status/[requestId] | GET | workflow state of mint request | requestId regex `^0x…{64}$` → 400; unknown → 404 | simulate 20/min | no (read) | no | 400 bad id; 404 unknown id | Returns stored `apiRemoteIp`/`apiUserAgent` of the creator to any requester holding the id (P4 privacy note) |
| /api/simulate/mint | POST | simulated MINT (mutates live pilot ledger + DB) | amount finite>0 only; **no upper bound**; chain/wallet free-text | **NONE** | **YES**: `db.pilotTrial.create` on ok | no | 200 valid (ok:true or ok:false e.g. EMERGENCY pause); 400 amount≤0/non-numeric; **500 + SyntaxError on empty/invalid JSON** | 16a-001 (accepted 1e15, flipped pilot to EMERGENCY), 16a-004, 16a-009 |
| /api/simulate/redeem | POST | simulated REDEEM (mutates ledger + DB) | same as mint | **NONE** | **YES**: `db.pilotTrial.create` on ok | no | 200; 400; **500 + SyntaxError on empty/bad-JSON** (also on form-encoded) | Same defects as mint (16a-001/004/009) |
| /api/issuance | GET | issuance machine/registry/labels + last 50 events | none | none | no (read + count) | no | 200 | no-store ✓; fail-soft DB error disclosed ✓ |
| /api/issuance | POST | run 1 of 8 DEMO scenarios on synthetic fixtures | scenario whitelist → 400 (empty body → 400 too) | **NONE** | **YES**: `db.issuanceEvent.create` per event via Prisma sink — **14 rows per happy-path run (live-verified, persisted, survive restart)** | no (explicitly none — simulated rails) | 200 (`persistence.written:14`); 400 bogus scenario | Honest G8 labeling exemplary; but unrate-limited unauthenticated multi-row DB writes (16a-003) |
| /api/ai/status | GET | provider fallback-chain status | none | health | no | no | 200 | Only booleans (hasKey/configured) — no key material ✓ |
| /api/ai/briefing | GET | COO-voice briefing | none | ai 5/min | no | AI providers (none configured → fallback-rules) | 200 `{model:"fallback-rules"}`; **429 + Retry-After when hammered** | 503 if flag disabled; 500 w/ `error:String(e)` on throw (16a-012) |
| /api/ai/risk-signals | GET | 2-5 risk signals | none | ai 5/min | no | AI providers | 200 fallback-rules (4 signals) | as above |
| /api/ai/qa | POST | blueprint Q&A | body parse fail-tolerant ({} fallback); question string, 500-char cap enforced server-side | ai 5/min | no | AI providers | 200 fallback answer for empty/garbage/10k-char inputs | Graceful degradation ✓ |
| /api/ai/screen | POST | NER sanctions screening | CORS origin whitelist; body fail-tolerant; 5000-char cap in lib | ai 5/min (after CORS gate) | no | HuggingFace Inference (if key) | **403 no/evil Origin** (before rate limit/cost); OPTIONS 204 whitelisted | Only route with CORS; server-to-server callers blocked by design |
| /api/bank-default | GET | §48 report | none | health | no | no | 200 | shared-bucket caveat (16a-015) |
| /api/contradiction-scan | GET | §77 report | none | health | no | no | 200 | |
| /api/legal-registry | GET | §49 report | none | health | no | no | 200 | |
| /api/licensing-matrix | GET | §50 report | none | health | no | no | 200 (38KB) | |
| /api/systemic-risk | GET | §52 report | none | health | no | no | 200 | |
| /api/three-book | GET | §51 report | none | health | no | no | 200 | |
| /api/protected-backing | GET | PBC report + evidence | none | health | no | no | 200 | |
| /api/fred | GET | FRED macro series | none | health | no | **FRED API** (key server-side) | **503 `FRED_API_KEY not configured`** | Cache-Control public s-maxage=300 (intentional) |

### Frontend-consumed endpoint cross-check (schema drift)
44 unique endpoints referenced from src/components (+ landing-status); **all 44 exist**; zero calls to non-existent routes. Field spot-checks (live response vs component access):
- `/api/simulate/mint` → MintSimulator reads mint.{ok,inputUsd,feeUsd,netUsd,mtqPrice,mtqMinted,throttleFactor,newCirculatingSupply,newReserveRatio,reason} + V2 aliases (price/newCirculating/newRR) — ALL present ✓
- `/api/succession` POST → SuccessionLab reads sim.{ok,ejected,ejectedFromBasket,baseline,after,continuity,reserveFlow,reintegrationNote,successor,successorSanity,timeline,error} — ALL present ✓
- `/api/metrics` → PCC keys (gfbIndex, mtqPrice, nav, lcr, status, fx, oracle, holdings, weightStates, treasury, marp, concentration, parameterRegistry, …) all present ✓ (note: `economics` is NOT in the metrics snapshot — IssuanceSection's `economics.fee.rateBps` comes from the **/api/issuance** payload, which has it ✓ — no drift, just two different payloads)
- `/api/issuance` → labels/economics/registry/states/separation/cbdc/events ✓ (14 persisted rows visible)
- `/api/tests` → cached, totalRuns, suites[].summary.survivalRate, audit.findings ✓
- `/api/trials`, `/api/trials/export` (json+csv), `/api/honest-status`, `/api/validation`, `/api/gfb`, `/api/por`, `/api/roles`, `/api/sync`, `/api/v3`, `/api/banks`, `/api/stability-pool`, report cluster, `/api/ai/*`, `/api/onchain/{chainId}`, `/api/onchain/solana`, `/api/health`, `/api/status`, `/api/contracts`, `/api/fx`, `/api/registry`, `/api/evidence`, `/api/mandate`, `/api/release-state`, `/api/constituency`, `/api/implementation-status`, `/api/mbg/mint-request` — all 200/expected-shape ✓
- Routes NOT referenced by the frontend (legit infra surfaces): /api (stub), /api/inngest, /api/mbg/status/[requestId], /api/webhooks/tenderly.

## B. Defect list

**16a-001 · P1 · Unbounded unauthenticated mutation of the shared pilot ledger + DB, no rate limit (simulate/mint & simulate/redeem)**
- Evidence: `curl -X POST -H 'Content-Type: application/json' -d '{"amount":1e15}' http://localhost:3000/api/simulate/mint` → `HTTP 200 {"ok":true,"mint":{"ok":true,"inputUsd":1e15,"mtqMinted":848490511601428.5,"newReserveRatio":0.9907…}}`; immediately after, `/api/metrics` → `{"status":"EMERGENCY","circulatingSupply":848490511601428.5,"reserveRatio":0.99074…}` (RR broke the 1.00 hard floor); a PilotTrial row was persisted (id `cmvldpy7n01vnwmpfzkai9u9v`, visible in /api/trials and CSV export). Hammer test: 25× POST → 25× 400/200, **zero 429s** (no limiter on the route).
- Root cause: route validates only `Number.isFinite(amount) && amount > 0`; no per-tx USD cap (the V3 "$500K per-tx cap" exists only as a /api/v3 feature string and in the issuance SUPPLY_POLICY — not applied to simulate); no rate limit; applyTrial mutates the globalThis engine directly.
- Side effects during audit: the single huge mint wedged the pilot into EMERGENCY (mint+redeem then fail-closed per §21.3/§21.4 — good defense-in-depth, but the pilot was unusable until the server restarted; it was cleared by the 16a-002 OOM restart, see Incident Log).
- Min fix: add the `simulate` rate-limit bucket to both routes; enforce an explicit maximum amount (e.g. the $500K per-tx cap, labeled pilot-limit); consider requiring a lightweight token for mutating routes; keep engine guards as defense-in-depth.

**16a-002 · P1 · One unauthenticated GET kills the whole dev server (OOM) — `/api/validation?force=1` (and same-class `/api/tests?force=1`, frontend-reachable)**
- Evidence: `curl --max-time 120 'http://localhost:3000/api/validation?force=1'` → HTTP 000 (no response in 118s); dev.log: `Mark-Compact … 764.6 (772.7) MB … FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory` → `next dev exited` → watchdog restarted at 19:49:44. The response never completed and validation-results.json was NOT rewritten (file mtime unchanged, git clean).
- Root cause: runAllStressTests()/runAllTests() execute the full Monte-Carlo suite synchronously inside the request under the 768MB heap cap (dev-watchdog NODE_OPTIONS); no concurrency guard, no memory budget, unauthenticated; the TestsSection UI has a "re-run" button hitting `/api/tests?force=1` (same class, deliberately NOT triggered during the audit).
- Min fix: serve the committed cache only from the HTTP route; move force-runs to a CLI/cron (scripts/run-tests.ts already exists); if force must stay, add a mutex + `?force` opt-out in capped environments + cap result-set allocation.

**16a-003 · P1 · DB write surface beyond the 3 expected routes: POST /api/issuance (unauthenticated, unrate-limited, 14 rows/run)**
- Evidence: `curl -X POST -d '{"scenario":"happy-path"}' /api/issuance` → `HTTP 200 … {"persisted":{"written":14,"error":null,"disclosed":"all 14 events persisted…"}}`; `GET /api/issuance` → `events.totalPersisted: 14` (rows survive server restart); hammer 25× invalid scenario → 25× 400, zero 429s (no limiter). Ledger sink confirmed in src/lib/mtq/issuance/ledger.ts:123-127 (`db.issuanceEvent.create`).
- Root cause: the §14.4 demo runner persists every machine event via the Prisma "durability mirror"; the route was not included in the mandate's expected write surface and carries no rate limit.
- Min fix: rate-limit with the `simulate` bucket (or a dedicated 5/min bucket), add a daily write cap, and register IssuanceEvent as the explicit 4th pilot-mirror write surface in the mandate/docs.

**16a-004 · P2 · simulate/mint + simulate/redeem return 500 with internal SyntaxError for empty/invalid JSON (should be 400)**
- Evidence: `curl -X POST -d '' /api/simulate/mint` → `HTTP 500 {"ok":false,"error":"SyntaxError: Unexpected end of JSON input"}`; same for redeem; `Content-Type: application/x-www-form-urlencoded` body `amount=5` → `HTTP 500 … "Unexpected token 'a'…"`. Contrast: /api/mbg/mint-request and /api/ai/qa handle this correctly (400 / graceful fallback).
- Root cause: `await req.json()` outside try → generic catch returns 500 + `String(e)`.
- Min fix: parse defensively (try/catch → 400 "Invalid JSON body"), mirror the mbg route; keep `String(e)` out of response bodies (log server-side).

**16a-005 · P2 · Per-IP rate limit bypass via spoofed X-Forwarded-For**
- Evidence: after exhausting the ai bucket (10 rapid GET /api/ai/briefing → 429s with `retry-after: 6`), `curl -H "X-Forwarded-For: 8.8.8.8" …` → `HTTP 200` with `x-ratelimit-remaining: 4` (fresh bucket).
- Root cause: `getClientIP` (src/lib/mtq/rate-limit.ts:142-148) trusts the client-supplied XFF/X-Real-IP headers unconditionally; in dev (no proxy) every request can mint unlimited fresh buckets.
- Min fix: only honor XFF when the direct socket peer is a trusted proxy (Vercel/AWS LB); otherwise use the socket address; keep the in-memory limiter as a fallback.

**16a-006 · P2 · /api/inngest hard-broken (500 on GET and POST) — Inngest integration non-functional**
- Evidence: `curl /api/inngest` → `HTTP 500 {"code":"internal_server_error"}` (headers include `x-inngest-sdk-handled: true`); POST `{}` → 500. dev.log root cause: `In cloud mode but no signing key found. For local dev, set the INNGEST_DEV=1 env var. For production, set the INNGEST_SIGNING_KEY env var.` Related: POST /api/sync → 200 `{ok:false,error:"Inngest API Error: 401 Event key not found"}` (3.8s external call).
- Root cause: SDK cloud mode auto-detected (NODE_ENV/signing key absent), no INNGEST_DEV=1 in dev env.
- Min fix: set `INNGEST_DEV=1` for local dev (or export the route only when configured); return an honest 503 "Inngest not configured" instead of a bare 500; note the scheduled jobs are design rows (dashboards already disclose this).

**16a-007 · P2 · Unrate-limited external-RPC amplification: /api/onchain/[chain] and /api/roles (+ upstream error leakage in 502)**
- Evidence: source — onchain route performs `Promise.all` of 10 RPC calls per request (Monad/Arc/Robinhood testnet + Solana devnet fetch), no rate limiter; roles route fires dozens of eth_calls ×3 retries across 2 chains (60s module cache, cold GET took 1.97s). `catch (e) { return … { error: e.message?.slice(0,200) }, status 502 }` returns provider error text to the client.
- Root cause: verification routes added without the rate-limit middleware pattern used by the report cluster.
- Min fix: apply the por/health bucket to both; replace raw `e.message` with a generic message (log full detail server-side).

**16a-008 · P2 · /api/trials (+ /api/trials/export) `limit` validation broken → misleading "Database not available" and silent acceptance of garbage limits**
- Evidence: `GET /api/trials?limit=abc` → `HTTP 200 {"trials":[],"error":"Database not available on this deployment"}` (DB was healthy — /api/health db:true); `limit=-5`, `limit=2.5`, `limit=1e999`, `limit=99999999` → 200 with empty trials and no error field; export behaves the same. No 4xx for any malformed limit.
- Root cause: `Math.min(Number(param ?? "50"), 200)` → NaN/negatives pass into Prisma `take`; catch conflates validation errors with DB outages.
- Min fix: parse with `Number.parseInt` + isFinite + 1≤limit≤cap → else 400; distinguish DB errors from validation errors in the catch.

**16a-009 · P3 · Unvalidated free-text persisted to DB and re-exposed (chain, wallet) + CSV formula-injection surface**
- Evidence: source — `chain = body.chain ?? "monad"` and `wallet: body.wallet ?? null` stored verbatim in PilotTrial (mint accepted `"chain":"notachain"` — live 200, only EMERGENCY-paused so no row written for that specific call; the 1e15 mint row shows wallet field round-trips via /api/trials and CSV export). CSV export quotes/escapes `"` but does not neutralize leading `=`, `+`, `-`, `@` (Excel formula injection) and has no cell-length cap.
- Root cause: no schema/whitelist for chain; no length/charset cap for wallet.
- Min fix: whitelist chain ids (ALL_CHAINS); cap wallet (e.g. 64 chars, [A-Za-z0-9._-]); prefix suspicious CSV cells with `'`.

**16a-010 · P3 · /api/evidence spawns a subprocess per request, unrate-limited**
- Evidence: source route.ts:24-30 — `execSync("git rev-parse HEAD", {timeout:5000})` on every GET; no rate limit. Command is a fixed string (no injection), output is a public commit hash.
- Min fix: cache HEAD for the module lifetime (or read .git/HEAD); add the health-bucket limiter.

**16a-011 · P3 · /api/mbg/mint-request: fractional nonce/expiry silently skips the DB mirror (fail-soft swallows a BigInt throw)**
- Evidence: source — validatePayload checks only `Number.isFinite(body.nonce) && ≥ 0` (1.5 passes); the persist block runs `BigInt(body.nonce)` inside the try whose catch is the fail-soft "DB log failed" path → `BigInt(1.5)` throws → caught → 200 returned with requestId but NO mirror row. Not triggerable live (auth closed in this env) — code-verified.
- Min fix: require `Number.isInteger` for nonce and expiry → 400 otherwise; move the BigInt conversion into validation.

**16a-012 · P3 · Error-body leakage pattern (`String(e)` / `e.message.slice`) across many routes**
- Evidence (live): metrics 503 `{error:"Engine not ready", detail:String(e)}` (source); succession/constituency/issuance 500 `{detail: String(e)}`; banks/stability-pool/v3 `{error: String(e?.message||e)}` 503; fred 500; ai routes 500 `{error:String(e),model:"error"}`; sync POST surfaces upstream "Inngest API Error: 401 Event key not found"; onchain 502 `e.message.slice(0,200)`. A 498KB aggregate scan of all live responses found NO secrets/keys/paths — the leak class is internal exception text only.
- Min fix: log full errors server-side; return `{error:"…"}` generic + request id.

**16a-013 · P3 · /api root stub ("Hello, world!") — static, undocumented**
- Evidence: `GET /api` → `{"message":"Hello, world!"}`; route has no `dynamic` export (would be prerendered/cached in a prod build), not listed in the DevelopersSection API reference.
- Min fix: delete the stub or make it a labeled, documented index endpoint with force-dynamic.

**16a-014 · P3 · ~20 routes share the single 60/min "health" bucket per IP**
- Evidence: source — bank-default, contradiction-scan, implementation-status, legal-registry, licensing-matrix, systemic-risk, three-book, protected-backing, banks, stability-pool, sync (GET+POST), v3, honest-status, mandate, validation, fred, por uses "por", ai/status, health all use `rateLimit(ip,"health")` (capacity 60, refill 1/s). One InstitutionalDashboard tab-load touches ~13 of these at once — a single legit user nearly exhausts their own bucket; combined with 16a-005 the limit is weak where it exists.
- Min fix: separate buckets per route class (or a per-route token cost), and/or raise capacity for read-only reports; keep ai/simulate/por as-is.

**16a-015 · P4 · Minor consistency notes (no action required for pilot)**
- mint/redeem return HTTP 200 for engine-level rejections (`ok:false`, e.g. "EMERGENCY: redemption paused per §21.4") while input errors are 400/500 and mbg uses 401/403 — convention is readable by the client but inconsistent across the API.
- Unknown API path (/api/nonexistent) returns Next's HTML 404, not JSON.
- /api/mbg/status returns the creator's stored `apiRemoteIp`/`apiUserAgent` to any holder of the requestId.
- /api/webhooks/tenderly GET discloses discord-enabled/disabled.
- /api/por?bank=<invalid> silently falls back to protocol-wide (0x0) instead of 4xx (documented lenient-by-design).

### PASS findings (verified working)
- 429 + Retry-After verified live on both ai (cap 5: 200,200,then 429s w/ `retry-after: 6`) and health (cap 60: 61×200 then 429s) buckets; `X-RateLimit-Remaining` header present on limited routes.
- CORS whitelist on /api/ai/screen: no-origin and evil-origin POST → 403 before any cost; whitelisted OPTIONS → 204. Only route with CORS; `Vary: Origin` present.
- Webhook HMAC fail-closed: no secret configured → all POSTs 503 (never forwards).
- MBG auth fail-closed: 401 "no authentication provided" / "bank has no API key on file"; constant-time comparisons used for apiKeyHash and HMAC.
- Input validation exemplary on: /api/succession POST (all malformed → 400 with precise messages), /api/mbg/* (regex + 400/401/403/404 ladder), /api/ai/qa (empty/garbage/oversize all graceful), /api/onchain (unknown chain → 404), /api/por (bank regex).
- G8 labeling: issuance route's banner/disclaimer/persistence disclosure, /api/gfb W^Prior vs W^Live labels, /api/constituency QUIESCENT disclosure, /api/release-state fail-closed note, honest-status/pilotDisclosures — all present and truthful in live payloads.
- Engine fail-closed defense-in-depth demonstrated live: after the 1e15 pollution, further mints/redemptions were refused by §21.3/§21.4 state-machine gating.
- Secrets scan: 498KB of aggregated live responses across 33 endpoints — zero env values, zero API keys/tokens, zero internal file paths, zero private keys (0x…64hex hits were public role-hash constants and the documented Safe GUARD_STORAGE_SLOT; "sk-" hits were "task-12" string splits).
- Caching: `force-dynamic` on all 47 data routes (only /api root lacks it); explicit `no-store` on state-sensitive routes (honest-status, por, stability-pool, sync, v3, mandate, constituency, issuance, ai/status); intentional public s-maxage on banks (60s) and fred (300s); disk-cached suites correctly flagged `cached:true/false`. No route can serve stale engine data in a prod build.
- PilotTrial persistence verified end-to-end (mint → row id `cmvldpy7n01vnwmpfzkai9u9v` in /api/trials + CSV export; rows survive dev-server restart — SQLite file).

## C. Mandate answers

1. **Are all frontend-consumed endpoints wired correctly?** YES — 44/44 referenced endpoints exist; every field spot-check (mint, succession, metrics, issuance, tests, trials, gfb, honest-status, ai/*, por, roles, sync, v3, report cluster) matched the live payloads. The only near-miss — `economics.fee.rateBps` — resolves to the /api/issuance payload, not /api/metrics (two different payloads; no drift).
2. **Any 500s?** YES, three classes: (a) simulate/mint + simulate/redeem on empty/invalid JSON (500 + SyntaxError body — 16a-004); (b) /api/inngest GET and POST always 500 in this env (misconfiguration — 16a-006); (c) /api/validation?force=1 did not even complete — it OOM-killed the server process (client saw a timeout — 16a-002). No 500 was observed on any read-only data route during normal polling.
3. **Any write surface beyond the 3 expected routes?** YES, two: POST /api/issuance (live-verified 14 IssuanceEvent rows/run, unauthenticated + unrate-limited — 16a-003) and GET /api/validation on ?force=1/cold (writeFileSync into src/lib/mtq/validation-results.json, i.e. a write into the source tree from an HTTP GET — live run OOMed before the write completed, code-verified). The MBG write surface is currently unreachable (auth fail-closed, 401s). Engine-side tick writes (DailyStateVector/RebalancingDecision/OracleSample + v13 retention prunes) are process-internal, documented, and not route-triggered.
4. **Any unvalidated input that reaches DB or external calls?** YES: `amount` on simulate routes is validated only as finite>0 — unbounded (1e15 accepted, mutated the ledger and persisted — 16a-001); `chain` and `wallet` are free text persisted to PilotTrial and re-exposed via /api/trials and CSV (16a-009); fractional nonce/expiry in mbg reaches the BigInt conversion (16a-011, code-level). Everything that reaches EXTERNAL services (onchain, roles, fred, ai) is either whitelist-validated (chain ids, scenario ids, origin) or server-fixed (series ids, prompts built server-side).

## D. Incident log (audit side effects — full transparency)

1. My mandated huge-amount test (`{"amount":1e15}` on /api/simulate/mint) was ACCEPTED and drove the live pilot engine to EMERGENCY (RR 0.9907, supply 848.49T MTQ). The state was in-memory only; the DB row remains as an honest trial record. Redemption was (correctly) paused in EMERGENCY, so I could not reverse it via the API.
2. My mandated force-run test (`/api/validation?force=1`) then OOM-killed the dev server; the watchdog restarted it at 19:49:44, which reset the in-process engine to genesis and thereby CLEARED the EMERGENCY pollution. Post-restart state verified: /api/health `{status:"healthy", engine:true, db:true}`; /api/metrics `{status:"NORMAL", circulatingSupply:0, reserveRatio:null}` (fresh genesis; RR null renders as "no liability · ∞" per the Task-15 UI handling). Rate-limit buckets also reset by the restart.
3. Net effect on the system: DB now contains 1 extra PilotTrial row (the 1e15 MINT) + 14 IssuanceEvent rows (happy-path demo) — both are labeled pilot-mirror records; source tree untouched (validation-results.json NOT rewritten; git clean except audit-work/task16/).

## E. Minimum-fix priority queue

1. 16a-002 (force-run OOM kill — also blocks the TestsSection button) + 16a-001 (unbounded unauthenticated mutation; add simulate-bucket rate limit + amount cap) + 16a-003 (issuance write rate limit) — the three P1s.
2. 16a-004 (500→400 on bad JSON), 16a-005 (XFF trust), 16a-006 (inngest 500), 16a-007 (RPC rate limit + error leakage), 16a-008 (trials limit) — P2s.
3. P3s (009-014) as a hygiene pass; P4 notes optional.

## F. Tooling false-alarm note

The Bash tool's output renderer swallowed the literal `[h` sequence when displaying the issuance 400 body, making `scenario must be one of [happy-path, …]` appear as `…one of appy-path, …`. `od -c` proved the wire bytes are correct. NOT an API defect; recorded so later auditors don't chase it.
