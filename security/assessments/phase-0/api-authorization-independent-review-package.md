# Phase 0 — API Authorization Independent Review Package (`api/ai/consensus` + `api/ai/catalog-sync` + ingress boundary)

**Document ID:** SEC-P0-APIREV-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T13:41Z (UTC) · **Workstream:** E
**Branch:** security/phase-0-review-prep @ fc9ad97 (docs-only; ancestry unchanged) · **Author role:** implementer AI-agent lineage (evidence preparer — NOT an independent auditor)
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED

> **Standing independence limitation:** prepared inside the assessed environment by the implementer's own agent lineage; all network/chain results herein are implementer-side and require independent reproduction per the reviewer handoff package (SEC-P0-HANDOFF-001). No secret value is reproduced anywhere — fingerprints, status codes, counts, and object identifiers only.

**Companion documents (this branch, authored in parallel):** `p0-evidence-preservation-register.md` (SEC-P0-EVIDENCE-001, A) · `public-object-exposure-review-package.md` (SEC-P0-EXPOSURE-001, B) · `evm-key-compromise-containment-readiness.md` (SEC-P0-EVMCR-001, C) · `solana-key-compromise-containment-readiness.md` (SEC-P0-SOLCR-001, D) · `api-authorization-independent-review-package.md` (this file, E) · `boot-chain-source-integrity-review.md` (SEC-P0-BOOT-001, F) · `platform-identity-and-recovery-separation.md` (SEC-P0-IDENT-001, G) · `independent-security-reviewer-handoff.md` (SEC-P0-HANDOFF-001, H) · `owner-p0-decision-register.md` (SEC-P0-DECISIONS-001, I) · `p0-containment-readiness-executive-report.md` (SEC-P0-EXEC-001, J). Prior evidence extended here: `public-object-exposure-and-review-addendum.md` (SEC-P0-ADDENDUM-001 §8, findings AF-03/AF-04) and `authoritative-main-delta-assessment.md` (SEC-P0-DELTA-001 §2, the 63-route inventory context); the other 61 routes were covered by the frozen baseline set — see `authorization-flow-inventory.md` (security/phase-0-baseline).

---

## 0. Scope, method, and evidence base

**Assignment:** COO master directive §6 (2026-11-11) — complete read-only code-level authorization assessment of the two previously unreviewed routes on the authoritative lineage, plus the §6.3 ingress-boundary investigation and the §6.4 future-requirements register. This package COMPLETES the two-route gap identified in SEC-P0-DELTA-001 §2; the remaining 61-route re-audit stays a Phase-1 input [HISTORICAL — SEC-P0-IRP-001 §6].

- **Subjects:** `src/app/api/ai/consensus/route.ts` (129 lines) and `src/app/api/ai/catalog-sync/route.ts` (46 lines) — POST-only handlers [VERIFIED-FACT: `wc -l`, Read tool, 2026-11-11T13:31Z].
- **Full import closure read (every imported module under src/):** `src/lib/ai/consensus.ts` (1031 lines), `src/lib/ai/catalog.ts` (218), `src/lib/ai/keys.ts` (88), `src/lib/mtq/rate-limit.ts` (217), `src/lib/db.ts` (33), `src/lib/db-ops.ts` (canonicalRoot, :100-106), plus their own imports (`@libsql/client`, `@prisma/client` + `@prisma/adapter-libsql`, `@upstash/redis`, `next/server`, `node:crypto`, `node:path`) at the library level. Line citations below are worktree line numbers; tracked content is byte-identical to authoritative main 926ee00 [VERIFIED-FACT: `git diff --stat HEAD -- src/` empty; branch is docs-only per briefing §1].
- **Route-count context:** 63 `src/app/api/**/route.ts` files at HEAD [VERIFIED-FACT: `git ls-tree -r --name-only HEAD | rg -c 'src/app/api/.*route\.ts$'` → 63, 2026-11-11T13:31Z]; the `api/ai/*` family has 7 routes (briefing, catalog-sync, consensus, qa, risk-signals, screen, status) — all unauthenticated per prior evidence [HISTORICAL — SEC-P0-ADDENDUM-001 §8.3], spot-re-verified for `ai/status` below.
- **Method discipline:** every claim carries [VERIFIED-FACT] (with command/timestamp), [HISTORICAL] (doc + section), or [UNVERIFIED]. No application code was executed (R6); no live route, LLM provider, or catalog sync was invoked (R3); no credential was used; no git mutation was performed (R2).
- **Key-name rule:** provider keys are referenced by environment-variable NAME only (`NVIDIA_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY` — the complete keyed set, `keys.ts:32-36`); no value and no URL literal containing a value is reproduced (the Gemini key-in-URL pattern is described generically, §1.5).

### 0.1 Import closure — verified module set (all read in full)

| Module | Lines | Role in the request chain | Authorization-relevant facts verified |
|---|---|---|---|
| `src/app/api/ai/consensus/route.ts` | 129 | HTTP boundary | no authn/authz; manual validation; 503/400/429/502 paths (§1) |
| `src/app/api/ai/catalog-sync/route.ts` | 46 | HTTP boundary | no authn/authz; body ignored (§2) |
| `src/lib/ai/consensus.ts` | 1031 | engine: roster, panels, provider callers, aggregation, DDL, persistence | ENDPOINTS/keys-in-headers-and-URL (:217-338); retry (:235-253); DDL (:786-854); writes (:856-893); swallow (:637-639) |
| `src/lib/ai/catalog.ts` | 218 | catalog download + upsert | Bearer/no-auth GETs (:117-137); seeds fallback (:152-170); upsert loop (:173-189) |
| `src/lib/ai/keys.ts` | 88 | key presence + feature flags | env-name reads (:32-36); browser guard (:43-48); `anyConsensusProviderKeyed` (:65-67); flags default true (:71-88) |
| `src/lib/mtq/rate-limit.ts` | 217 | limiter + client-IP derivation | ai bucket 10/min (:42-48); Redis fail-open (:180-198); XFF trust (:201-217) |
| `src/lib/db.ts` | 33 | Prisma client construction | TURSO_DATABASE_URL/DATABASE_URL + TURSO_AUTH_TOKEN; libsql adapter (:8-30) |
| `src/lib/db-ops.ts` | (large) | `canonicalRoot` used by the DDL client | root resolution (:100-106) |
| `src/app/api/ai/status/route.ts` | 46 | adjacent family surface | GET unauthenticated; health-bucket only (:13-23) |
| Libraries (no repo source) | — | `next/server`, `@libsql/client`, `@prisma/client`, `@prisma/adapter-libsql`, `@upstash/redis`, `node:crypto`, `node:path` | treated as trusted vendored dependencies (supply-chain review out of scope — see baseline `security-dependency-register.md`) |

### 0.2 Coverage map — where the 63 routes are assessed

| Route set | Where assessed |
|---|---|
| 59-route substituted-tree surface (the Phase-0 census) | frozen baseline `authorization-flow-inventory.md` (chains F1–F10) + `critical-vulnerability-register.md` [HISTORICAL] |
| `constituency/upload` (authoritative-only) | SEC-P0-DELTA-001 §2 — 403 fail-closed, verified live 2026-11-10T23:31Z [HISTORICAL] |
| `landing-stats` (authoritative-only) | referenced as the §4.2-battery endpoint, SEC-P0-DELTA-001 §2 [HISTORICAL] |
| **`ai/consensus` + `ai/catalog-sync`** | **THIS PACKAGE (completes the gap; extends AF-03/AF-04)** |
| full 63-route re-audit on the authoritative lineage | Phase-1 input, OPEN [HISTORICAL — SEC-P0-IRP-001 §6] |

---

## 1. `api/ai/consensus` — item-by-item assessment

**Handler:** `export async function POST(req: Request)` at `route.ts:43`; `dynamic = "force-dynamic"`, `revalidate = 0` (`:20-21`); route comment promises "one call = 3 model generations server-side" with a **stale "5 req/IP/min" figure** (`:12-13` — the actual `ai` bucket is 10/min, `rate-limit.ts:42-48`).

| # | Item | Finding | Evidence |
|---|---|---|---|
| 1.1 | Authentication | **ABSENT.** No Authorization/API-key/cookie/session check anywhere in the handler; no `middleware.ts` exists repo-wide (§3.1). | route.ts:43-129 (whole handler); git ls-tree middleware probe [VERIFIED-FACT] |
| 1.2 | Authorization | **ABSENT.** No role/owner/operator gate; any network caller reaching the route reaches the engine. | route.ts:43-63 |
| 1.3 | Input validation | Manual only: JSON parse → 400 (`:65-70`); `sanitize()` bounds 1–500 chars, strips control chars, rejects non-string → 400 (`:36-41`, `:72-78`). No schema library (zod is a dependency, `package.json:97`, but unused here); extra body fields silently ignored. | route.ts:36-78 |
| 1.4 | Prompt injection | **Unmitigated content channel.** The sanitized question is embedded verbatim as the user message and fanned to 3 providers (`route.ts:84`, `consensus.ts:489-497`); output is aggregated and echoed back (`route.ts:91-124`) and persisted (`consensus.ts:870`, resultJson ≤20k). No content filtering, no injection detection; the fixed SYSTEM fact-sheet (`route.ts:23-34`) is the only framing. Persisted consensus records can carry attacker-influenced prose (injection into the attestation trail). | route.ts:23-34, 72-89 |
| 1.5 | Provider-key handling | Keys read from env by NAME at module load, server-side only, browser-guarded (`keys.ts:32-36`, `:43-48`); NVIDIA/OpenRouter ride an `Authorization: Bearer` header (`consensus.ts:268`); **the Gemini key is transmitted as a URL query parameter on the generateContent path** (`consensus.ts:311`) — a log/Referer/reflection leakage class (key NAMES only; no literal reproduced). Route 503 message names the env-var locations (`route.ts:60`). | consensus.ts:222, 225-228, 268, 311 |
| 1.6 | External model-provider egress | Three providers per panel: NVIDIA chat-completions, OpenRouter chat-completions (`consensus.ts:217-219`), Gemini generateContent (`:222`); per-voter `AbortSignal.timeout` (20–45 s, `:86-160`, `:280`, `:321`); egress content = full SYSTEM prompt + the caller's question. OpenRouter requests carry `HTTP-Referer`/`X-Title` branding headers (`:269-271`). | consensus.ts:217-338 |
| 1.7 | Rate-limit enforcement | `rateLimit(ip, "ai")` — 10 req/IP/min (capacity 10, refill 10/60) `rate-limit.ts:42-48`; 429 + Retry-After `route.ts:46-54`; remaining echoed via X-RateLimit-Remaining `:61`, `:120`. | route.ts:44-54; rate-limit.ts:48 |
| 1.8 | X-Forwarded-For trust | `getClientIP` takes the FIRST XFF value, then `x-real-ip`, else "unknown" (`rate-limit.ts:211-217`). The Caddy gateway (:81) overwrites XFF with the true remote host (`Caddyfile:30`), but the app also listens directly on :3000 where a client can mint a fresh bucket per request — documented accepted residual (audit 16a-003/16e-003, `rate-limit.ts:201-210`). | rate-limit.ts:201-217 |
| 1.9 | Redis failure behavior | **FAIL-OPEN — verified in code.** If the Upstash Redis call throws, the catch falls back to the in-memory limiter rather than rejecting (`rate-limit.ts:190-198`, with the explicit design comment `:180-184` "fall back to in-memory rather than fail-closed so the app stays usable"). In-memory state is per-instance only (`:19-21`) — on serverless multi-instance deployments the distributed limit collapses to N independent limits. | rate-limit.ts:180-198 |
| 1.10 | Database writes | `ConsensusRun.create` + `ConsensusVote.createMany` per run (`consensus.ts:860-886`) via the Prisma db client (`db.ts:8-33` — TURSO_DATABASE_URL/DATABASE_URL + TURSO_AUTH_TOKEN, libsql adapter). | consensus.ts:856-893 |
| 1.11 | DDL execution | `ensureConsensusTables()` runs 3 `CREATE TABLE IF NOT EXISTS` + 6 `CREATE INDEX IF NOT EXISTS` via raw libsql `executeMultiple` (`consensus.ts:786-831`, `:837-854`) — reachable from an unauthenticated POST (through `persistRun` `:858`) against `DATABASE_URL` or the local `db/custom.db` fallback (`:840`). | consensus.ts:786-854 |
| 1.12 | Persistence failure behavior | **Fail-open (best-effort, swallowed).** `persistRun` is awaited via `.catch(() => undefined)` (`:637-639`); its own try/catch logs and returns undefined (`:889-892`) — the response is 200 with `runId` simply absent. The route never blocks on degraded persistence. | consensus.ts:637-639, 889-892 |
| 1.13 | Error disclosure | Per-vote upstream error bodies (first 200 chars of the provider HTTP response) are captured into `votes[].error` (`consensus.ts:284-285`, `:325-326`) and echoed to the unauthenticated caller (`route.ts:113`) — upstream-error disclosure. 502 catch-all logs the exception message server-side (`route.ts:125-128`). | consensus.ts:283-285, 324-326; route.ts:105-114, 125-128 |
| 1.14 | Retry amplification | `callModel` retries once on HTTP 429 or "empty content" after a 1.5 s sleep (`consensus.ts:235-253`) — up to 2 upstream calls per voter, i.e. up to 6 provider calls per POST at voters:3 (`route.ts:86`); each voter also re-transmits the full prompt. | consensus.ts:235-253 |
| 1.15 | Abuse & cost exposure | Unauthenticated keyed-LLM invocation: 10 req/IP/min × (3 voters × ≤2 attempts) ≈ ≤60 provider calls/min per honest IP; with XFF rotation on the direct :3000 listener (§1.8) the per-IP bound is effectively unbounded. Keys are free-tier by owner policy (`consensus.ts:968-970`), so exposure is quota exhaustion / key abuse / data egress rather than direct billing; 503 gates fail closed when disabled or keyless (`route.ts:55-63`). | route.ts:44-63; consensus.ts:235-253 |
| 1.16 | Automated test coverage | **NONE.** Zero references to `runConsensus`/`ai/consensus` in any `*.test.*` file across the worktree [VERIFIED-FACT: Grep over `*.test.*`, 2026-11-11T13:2xZ — no matches]. Only live-network CLI scripts exist (`scripts/ai/smoke-consensus.ts` — requires real provider keys; not an automated test). | Grep probe; scripts/ai/ |

**Adjacent surface (same closure, spot-verified):** `api/ai/status` GET is likewise unauthenticated — `status/route.ts:13-23` applies only a `health`-bucket rate limit and returns provider keyPresent booleans, endpoint identifiers, roster, catalog counts and recent-run vote errors (`consensus.ts:908-972`) [VERIFIED-FACT: Read, 2026-11-11T13:2xZ].

### 1.A Existing compensating controls (honest inventory — none is an authentication control)

- **Enablement gates fail closed:** `AI_CONSENSUS_ENABLED=false` → 503 before any egress (`route.ts:55-57`; flag default true, `keys.ts:88`); no keyed provider → 503 before any egress (`route.ts:58-63`) — the route cannot spend keys it does not have.
- **Advisory-only contract:** the engine "never writes engine state, never modifies reserves" by design (`consensus.ts:48-50`) — monetary surfaces are untouched by this route; the blast radius is spend/egress/DB-attestation, not the pilot ledger.
- **Bounded prompt and output budgets:** 1–500 chars after control-char stripping (`route.ts:36-41`); `maxTokens: 400`, `temperature: 0.2` per call (`route.ts:87-88`) — per-request token cost is structurally small.
- **Per-model timeouts:** 20–45 s `AbortSignal.timeout` per voter (`consensus.ts:86-160`, `:280`, `:321`) — a hung provider cannot pin a request indefinitely.
- **Free-tier keys only** by owner policy (`consensus.ts:968-970`, roster header `:25-46`) — direct monetary billing is not the exposure class; quota exhaustion, key abuse and data egress are.
- **Raw vote content stays server-side** by design (`route.ts:8-10` comment) — though per-vote error strings ARE returned (§1.13), which is the disclosure residual.

### 1.B Rate-limit arithmetic (the actual abuse ceiling)

- Honest single IP: 10 POSTs/min (`rate-limit.ts:48`) × 3 voters (`route.ts:86`) × ≤2 attempts each (`consensus.ts:235-253`) = **≤60 provider calls/min**, each carrying the full SYSTEM fact-sheet plus the 1–500-char question.
- XFF-rotating client on the direct `:3000` listener: `getClientIP` keys the bucket on the FIRST XFF value (`rate-limit.ts:211-217`) — a distinct spoofed header per request yields a distinct full-capacity bucket; **no effective ceiling** (documented accepted residual, `rate-limit.ts:201-210`; audit 16a-003/16e-003 [HISTORICAL]).
- Redis-down multi-instance deployment: fail-open memory fallback per instance (`rate-limit.ts:190-198`) — the aggregate ceiling multiplies by instance count.

---

## 2. `api/ai/catalog-sync` — item-by-item assessment

**Handler:** `export async function POST(req: Request)` at `route.ts:18`; comment: "a sync makes 2 provider API calls" (`:9`).

| # | Item | Finding | Evidence |
|---|---|---|---|
| 2.1 | Authentication | **ABSENT.** No credential check of any kind in the handler. | route.ts:18-46 |
| 2.2 | Authorization | **ABSENT.** An administrative-shaped operation (catalog refresh, DB write, outbound calls) exposed to any network caller. | route.ts:31-41 |
| 2.3 | Input validation | **NONE — the request body is completely ignored.** `req` is used only for `getClientIP` (`:19`); there is nothing to validate because nothing is consumed. | route.ts:18-19 |
| 2.4 | Provider catalog downloads | Two outbound GETs per hit: NVIDIA `/v1/models` with Bearer key, 15 s timeout, empty-key short-circuit → `[]` (`catalog.ts:117-127`, key check `:118-119`); OpenRouter `/v1/models` with **no auth header**, 15 s timeout, filtered to zero-priced/free models (`:129-137`). On fetch failure the route falls back to hard-coded Task-47 probe-evidence seeds (`:152-158`, `:165-170`) — availability-over-accuracy. | catalog.ts:117-137, 152-170 |
| 2.5 | Database DDL | Same `ensureConsensusTables()` DDL path as §1.11, invoked first (`catalog.ts:141`) — unauthenticated DDL execution. | catalog.ts:141; consensus.ts:786-854 |
| 2.6 | Database upserts | `db.aiModelCatalog.upsert` per row in a sequential loop — idempotent by `<provider>::<model>` id (`catalog.ts:172-189`, id built `:201`); probe-provenance rows and owner-policy `EXCLUDED` (z.ai) rows included (`:92-95`, `:200-218`). No transaction wrapper — the loop is interruptible mid-way. | catalog.ts:173-189, 200-218 |
| 2.7 | Rate limits | Same `ai` bucket, 10 req/IP/min (`route.ts:19-29`); 429 + Retry-After (`:21-29`); XFF trust and Redis fail-open residuals identical to §1.8/§1.9. | route.ts:19-29 |
| 2.8 | Upstream service behavior | Both fetches run under `Promise.allSettled` (`catalog.ts:142`) — one provider failing never fails the sync; per-provider outcomes surface as `providers[].ok` flags with counts. | catalog.ts:140-170 |
| 2.9 | Partial failure behavior | Provider failure → HTTP 200 with `providers[].ok=false` plus error string (first 120 chars) and seed rows substituted (`:153`, `:166`); DB failure inside the upsert loop → thrown → route 502 (`route.ts:42-45`), **but partial upserts may already persist** (no transaction, no rollback). | catalog.ts:152-170, 173-189; route.ts:42-45 |
| 2.10 | Error disclosure | Provider rejection reasons (sliced to 120 chars) returned inside the 200 body (`catalog.ts:153`, `:166`); 502 catch-all logs the server-side exception message (`route.ts:42-45`). | catalog.ts:153, 166; route.ts:42-45 |
| 2.11 | Replay & abuse potential | No nonce/idempotency token — every POST repeats 2 outbound provider calls + up to ~100 sequential upserts (NVIDIA ~84 + OpenRouter ~15 rows per catalog size, `catalog.ts:10-12`); hammering = unauthenticated outbound-request amplification and DB churn; idempotent upserts bound the data damage but not the load. | catalog.ts:140-198 |
| 2.12 | Automated test coverage | **NONE.** Zero test references to `syncModelCatalogs`/`ai/catalog-sync` [VERIFIED-FACT: Grep `*.test.*`, no matches]; only the CLI wrapper `scripts/ai/sync-catalog.ts` (not an automated test). | Grep probe; scripts/ai/ |

### 2.A Existing compensating controls (honest inventory)

- **Idempotent upserts:** rows keyed `<provider>::<model>` (`catalog.ts:172-189`, id built `:201`) — replaying the sync cannot duplicate rows or grow the table unboundedly; damage is bounded to churn/refresh, not accumulation.
- **Free-model filter:** the OpenRouter download filters to zero-priced or `:free` models (`catalog.ts:133-136`) and every row is marked `free: true` (`:214`) — the catalog cannot smuggle paid-tier models into routing.
- **z.ai exclusion policy** applied at row-build time (`catalog.ts:92-95`, `:204-206`) — owner policy is enforced in data, auditable in the table.
- **15 s fetch timeouts** on both downloads (`catalog.ts:122`, `:130-131`) — a slow upstream cannot pin the route.
- **At most one keyed call per hit:** the OpenRouter GET carries no credential at all (`catalog.ts:130`); only the NVIDIA GET is keyed (`:120-121`) — the amplification surface spends at most one keyed call per POST.

### 2.B Route chains in the baseline-inventory format (completing the F-series)

The frozen baseline `authorization-flow-inventory.md` documents chains F1–F10 for the substituted-tree surface; the two routes assessed here were absent from that tree. Recorded in the same stage format so the register can absorb them without re-mapping (each stage states reality, not design):

**F-ai-1 — Unauthenticated consensus query (`ai/consensus`)**

| Stage | Reality | Evidence |
|---|---|---|
| Proposal | unauth POST `/api/ai/consensus` (body: `question`, 1–500 chars; rate 10 req/IP/min — comment stale at "5") | route.ts:12-13, 43-78 |
| Validation | structural only: JSON parse + length/control-char sanitize; no content policy | route.ts:36-78 |
| Policy decision | enablement flags + key presence (503 fail-closed) | route.ts:55-63; keys.ts:65-88 |
| **Approval** | **NONE — any network caller (per-IP rate limit only)** | **AF-03** |
| Signing | none (no actor identity exists anywhere in the chain) | — |
| Execution | 3-voter provider fan-out (≤2 attempts each) + field-majority aggregation | consensus.ts:486-640, 235-253 |
| Settlement | advisory JSON to caller; "never writes engine state" | route.ts:91-124; consensus.ts:48-50 |
| Audit | ConsensusRun/ConsensusVote rows — best-effort, failures swallowed | consensus.ts:856-893 |
| Revocation/recovery | none per-run; rate-bucket expiry only | rate-limit.ts:95-178 |

**F-ai-2 — Unauthenticated catalog sync (`ai/catalog-sync`)**

| Stage | Reality | Evidence |
|---|---|---|
| Proposal | unauth POST `/api/ai/catalog-sync` (body ignored; rate 10 req/IP/min) | route.ts:18-29 |
| Validation | **NONE — no input is consumed** | route.ts:18-19 |
| Policy decision | none beyond the rate bucket; DDL + upserts unconditional | route.ts:31-41 |
| **Approval** | **NONE — administrative-shaped operation on a public handler** | **AF-04** |
| Signing | none | — |
| Execution | 2 provider catalog GETs (1 keyed) + sequential idempotent upsert loop | catalog.ts:117-137, 173-189 |
| Settlement | `AiModelCatalog` rows in custom.db / Turso | catalog.ts:172-189; db.ts:8-30 |
| Audit | row provenance only (source/lastProbedAt); no run log, no caller identity | catalog.ts:200-218 |
| Revocation | none (rows silently overwritten on next sync; seeds substituted on fetch failure) | catalog.ts:152-170 |

**Correlated-compromise note (matching the baseline's closing analysis):** like F1/F2, these chains' "authorization" collapses into **network reachability** (plus a spoofable per-IP rate limit); and their provider-key custody terminates in the same single sandbox credential substrate as F5–F9 — an attacker with repo/host access reads the provider keys from the environment regardless of any route gating. The route-level fix (§4) bounds the *network* caller class only; the key-custody class is the owner-side rotation track (SEC-P0-EVMCR-001 / SEC-P0-SOLCR-001 are chain-side; the AI provider keys ride the same environment).

---

## 3. Actual ingress boundary (§6.3) — repository evidence only, no live calls

Investigated exclusively from tracked repository evidence (read-only). Nothing in this section derives from a live request; R3 forbids live calls to the application, LLM providers, and catalog sync.

### 3.1 Repository-controlled layers

| Layer | Presence/config | Evidence |
|---|---|---|
| `src/middleware.ts` / any middleware | **ABSENT** — no `middleware.ts`/`.js`/`.mjs` or `proxy.ts` at ANY path in the tree [VERIFIED-FACT: `git ls-tree -r --name-only HEAD` + pattern match, exit 1, 2026-11-11T13:2xZ]; nothing gates routes externally. Nothing else in the repo performs request-level authn for these routes. | git ls-tree probe |
| `vercel.json` | **PRESENT (10 lines)** — framework nextjs, `buildCommand: next build`, `installCommand: bun install`, function `maxDuration: 30` for `src/app/api/**/route.ts` (`vercel.json:1-10`). **No headers, no rewrites, no redirects, no auth, no WAF/route-protection config of any kind.** [VERIFIED-FACT: Read] | vercel.json:1-10 |
| `next.config.ts` | `output: "standalone"` (`:13`); `allowedDevOrigins: ["*.space-z.ai"]` (`:22`); security headers X-Content-Type-Options / Referrer-Policy / Permissions-Policy on `/:path*` (`:29-40`); X-Frame-Options/CSP frame-ancestors deliberately omitted (sandbox iframe preview, `:24-28`); HSTS omitted (plain HTTP behind gateway, `:27-28`). **No rewrites, no authentication.** [VERIFIED-FACT: Read] | next.config.ts:13-40 |
| `Dockerfile` / `Dockerfile.compute` | No web-serving `Dockerfile` exists. `Dockerfile.compute` is the MASE compute-engine container (non-root `USER node` `:92`, `ENTRYPOINT bun run src/lib/mtq/compute-engine.ts` `:102`, no EXPOSE/no ports) — **not a web ingress**. [VERIFIED-FACT: Read + ls-tree] | Dockerfile.compute:92-106 |
| `dev-watchdog.sh` — local dev supervisor | **The application runs under a LOCAL WATCHDOG, not a public ingress:** `cd /home/z/my-project` (`:66`), sources `.env.local`/`.env` (`:86-88`), unsets all AI/FRED provider keys from its own environment (`:93-106`), supervises `./node_modules/.bin/next dev -p 3000` (`:215`) behind a singleton flock (`:77-81`), health-gated (`:151-161`), with pre-boot git-drift guard (`:169`), source-integrity heal whose failures are suppressed by `|| true` (`:180` — AF-05), blocking runtime preflight (`:188-197`) and blocking db-selfheal (`:206-211`). `package.json:6` routes `bun run dev` → `scripts/dev-entrypoint.sh`, which babysits the same watchdog (local platform semantics). [VERIFIED-FACT: Read both files] | dev-watchdog.sh:66-215; package.json:6 |
| `Caddyfile` — reverse proxy | Repo template: `:81` reverses to `localhost:3000` and **overwrites** `X-Forwarded-For`/`X-Real-IP` with the true remote host (`:26-35`, anti-spoof). Running-gateway caveat: the live sandbox caddy uses root-owned `/app/Caddyfile`; the repo file is only the template, and the historical wildcard transform-port open-proxy rule (finding 16e-002) may persist in the running config until platform access applies it (`:19-24`) [HISTORICAL — Caddyfile comment; SEC-P0-ADDENDUM-001 lineage]. **No authentication is added at this layer.** | Caddyfile:19-35 |
| `TESTNET_READINESS.md` | Standing gate, **NOT evidence a gate passed**: "Status: NOT YET CERTIFIED FOR PUBLIC TESTNET USE" (`:3`); Gate 0 treats the 2026-10-24-pasted GitHub/Vercel/Turso/Neon credentials as compromised-class and demands rotation (`:12-23`); Gate 5 requires per-route authn/authz testing — all checkboxes open (`:76-84`). [VERIFIED-FACT: Read] | TESTNET_READINESS.md:3, 12-23, 76-84 |
| `.github/workflows` (deployment paths) | 9 workflows; **no workflow deploys the web app** — `deploy-testnet.yml` deploys contracts on workflow_dispatch with the `DEPLOYER_PRIVATE_KEY` secret (`:34-38`, `:133-141`). The web-app ingress is referenced, not deployed, by: `health-probe.yml` (cron `*/15`, GETs the public root and `/api/health`, `:17-18`, `:33`, `:43`) and `inngest-resync.yml` (waits for the production deployment to go live, then `PUT /api/inngest`, `:28-42`, `:50`). `backup.yml` daily 03:00 (`:39`), `compute-engine.yml` daily 02:00 dockerized MASE (`:25`), `backtest-nightly.yml` 04:00 (`:6`). [VERIFIED-FACT: Read/grep] | .github/workflows/* |
| `package.json` scripts | `dev` → dev-entrypoint (local supervisor); `build` → `next build` + standalone assembly; `start` → `NODE_ENV=production bun .next/standalone/server.js` (`:6-9`) — a self-hosted production entry exists but no repo-side ingress/auth wraps it. [VERIFIED-FACT: Read] | package.json:6-24 |
| API gateway / edge authn / WAF / network restrictions | **None found in repository evidence** — no WAF rules, no firewall/VPC/network-restriction config, no edge-auth component anywhere in the tree. (Platform-side controls are external — see classification.) [VERIFIED-FACT: absence of any matching config in tracked files] | — |

### 3.2 Deployment environments evidenced in-repo

1. **Local sandbox (this substrate):** watchdog-supervised `next dev -p 3000` in `/home/z/my-project`, optionally behind the Caddy `:81` gateway — a dev supervisor, not a public ingress [VERIFIED-FACT: dev-watchdog.sh:66-215].
2. **Vercel-hosted pilot:** repo evidence asserts the web pilot is live — `README.md:8-9` ("Web pilot (live): https://mtq-sigma.vercel.app — engine + Turso DB live, Neon analytical mirror synced hourly via Inngest"), `README.md:11-12`, `RUNBOOK.md:341-368`, plus the two workflows above that target that hostname; `vercel.json` + `next.config.ts` are the only repo-side hosting config, and neither adds authentication. The vercel[bot] PR metadata (2026-09-07) is prior evidence of the platform integration [HISTORICAL — SEC-P0-ADDENDUM-001 §2.10].

**Route exposure in the live environment:** [UNVERIFIED] — the repository contains no route-exclusion list, no preview/production environment separation, and no evidence that `api/ai/*` is disabled or enabled on the deployed instance; TESTNET_READINESS.md:84 requires verifying exactly this separation as an OPEN gate item. Whether the two routes serve on the public deployment is an external fact (§3.3).

**Deployment-path inventory (all 9 workflows read):**

| Workflow | Trigger | Touches the web-app ingress? | Evidence |
|---|---|---|---|
| `health-probe.yml` | cron `*/15` + dispatch | Yes — GETs the public root and `/api/health` (read-only probe of the deployment) | :17-18, :33, :43 |
| `inngest-resync.yml` | dispatch | Yes — waits for the production deployment to go live, then `PUT /api/inngest` | :28-42, :50 |
| `deploy-testnet.yml` | workflow_dispatch | No — contract deployment (`DEPLOYER_PRIVATE_KEY` secret; dry-run before live) | :34-38, :133-141, :143-182 |
| `backup.yml` | cron 03:00 + dispatch | No — repo/database backup (contents: write) | :36-40 [HISTORICAL — DELTA §7] |
| `compute-engine.yml` | cron 02:00 + dispatch | No — dockerized MASE compute (Turso read) | :23-26 |
| `backtest-nightly.yml` | cron 04:00 + dispatch | No — engine backtest | :4-7 |
| `ci.yml` / `forge-tests.yml` / `keeper-heartbeat.yml` | push/PR; schedule+dispatch; dispatch | No — build checks, contract tests, keeper heartbeat | ci.yml:72, forge-tests.yml:103, keeper-heartbeat.yml:28 [HISTORICAL — DELTA §7] |

No workflow deploys the web application: the Vercel web-app deployment path is platform-side (vercel[bot] integration) and its project settings are not in the repository [UNVERIFIED — external evidence required].

### 3.3 Mandatory four-way classification (per route)

| Classification | `api/ai/consensus` | `api/ai/catalog-sync` |
|---|---|---|
| **Source-level authentication** | **ABSENT** [VERIFIED-FACT — route.ts:43-129 contains no credential check; no middleware exists] | **ABSENT** [VERIFIED-FACT — route.ts:18-46 contains no credential check] |
| **External ingress authentication** | **UNVERIFIED — external evidence required.** The repo-controlled ingress layers are VERIFIED-ABSENT (no middleware.ts; vercel.json carries no auth/headers/routes config; Caddyfile adds none; no WAF config in-repo). The live Vercel project's protection settings (deployment protection / SSO / access control) are owner-side and not observable from the repository. | Same determination — UNVERIFIED (identical evidence) |
| **Live public reachability** | **UNVERIFIED.** A public deployment URL exists in owner communications (mtq-sigma.vercel.app — briefing §5) AND in repository evidence (README.md:8; health-probe.yml:33; inngest-resync.yml:33,50), and the repo asserts the pilot live — **but NO live call was made from this assessment** (guardrail R3: no application live routes, no LLM providers, no catalog sync). Current reachability, current served commit, and current route behavior at that URL are exactly the facts an independent reviewer must establish externally. | Same — UNVERIFIED |
| **State-changing side effects** | **VERIFIED at source level / UNVERIFIED live.** DB writes (ConsensusRun/ConsensusVote creates) and DDL execution are code-verified (§1.10-1.11); whether a live request actually persists rows on the deployed instance is unverified (would require the forbidden live call). | **VERIFIED at source level / UNVERIFIED live.** DDL + upserts are code-verified (§2.5-2.6); live persistence behavior unverified |

**Mandatory caveat (§6.3):** a missing application-level authentication layer is **NOT** proof of unrestricted public reachability — and vice versa. The repo shows no application-level authentication on these routes; it does NOT show that the routes are publicly reachable in the live environment (platform-side access controls, network placement, and deployment state are external facts). Conversely, any platform-level protection that may exist does NOT retroactively supply the missing source-level authentication, which remains absent in code regardless of hosting.

### 3.4 Public vs internal routes

No route-level segmentation exists in the repository: all 63 routes compile identically as ordinary handlers, none is marked internal-only, and no config distinguishes public from administrative surfaces [VERIFIED-FACT: route-family inspection + absence of middleware/ingress auth, §3.1]. The only inbound-authentication precedents in the codebase are per-route opt-ins — `constituency/upload` (X-Upload-Token == `MTQ_UPLOAD_TOKEN`, 403 fail-closed when unconfigured, `upload/route.ts:14-16`, `:57-65`), `webhooks/tenderly` (HMAC vs `TENDERLY_WEBHOOK_SECRET`, 401, `:186-206`), `mbg/mint-request` (API-key-hash constant-time compare or HMAC, 401, `:81-158`), and `inngest` (SDK signature check when `INNGEST_SIGNING_KEY` set; dev mode performs none, route comments `:14-31`) — proving the team's fail-closed patterns exist and were simply not applied to `api/ai/*` [HISTORICAL — SEC-P0-ADDENDUM-001 §8.3; spot-verified 2026-11-11T13:2xZ].

---

## 4. Proposed future security requirements (§6.4) — DOCUMENTED, NOT IMPLEMENTED

Owner-decision inputs for Phase 1/Phase 5. **Nothing in this section was implemented, changed, or staged in this assignment** (R2/R5); every item remains OPEN pending owner authorization.

1. **Central API authentication** — a single gate for `api/ai/*` (and eventually all 63 routes) using the already-proven fail-closed token/HMAC patterns of §3.4, or a unified auth middleware at the route-tree level; unconfigured credentials must fail closed (401/403), never open.
2. **Role-based authorization** — declared roles (owner / operator / public) enforced server-side per route; UI hiding is not access control (TESTNET_READINESS.md:79 already requires this posture).
3. **Owner/operator restrictions on administrative-shaped routes** — `ai/catalog-sync` (DB writes + outbound calls + DDL) should be operator-gated; consider removing it from any public deployment entirely.
4. **Trusted-proxy IP handling** — honor XFF only when the socket peer is a known gateway; otherwise use the peer address; document the residual direct-`:3000` exposure (rate-limit.ts:201-210).
5. **Fail-closed distributed rate limiting** — on Redis failure, reject or degrade to a strictly tighter local limit, not the current fail-open memory fallback (rate-limit.ts:180-198).
6. **Request budgets for LLM operations** — per-IP and global token/request budgets, concurrency caps, and per-run cost ceilings on `ai/consensus` (one POST currently fans to ≤6 provider calls, §1.14-1.15).
7. **Sensitive-data redaction** — stop echoing upstream error bodies to callers (§1.13, §2.10); scrub key-bearing URL forms from any logged egress; consider redacting question text in persisted records.
8. **API-key protection** — move the Gemini credential out of the URL query channel into an authenticated header (or provider SDK pattern); audit all egress for key-in-URL forms (§1.5).
9. **Idempotency controls** — idempotency keys/nonce for catalog sync and consensus runs to bound replay amplification (§2.11, §1.15).
10. **Audit logging** — authenticated audit trail for administrative operations (sync provenance, consensus runs, auth failures) with retention, instead of best-effort console.error only.
11. **Automated authorization tests** — route-level tests asserting 401/403 without credentials, 429 behavior, fail-closed gates with keys unset, and DDL/upsert authorization — the current zero-test posture (§1.16, §2.12) is itself a finding.

---

## 5. Findings register — extension of AF-03/AF-04

Extends SEC-P0-ADDENDUM-001 §8.3 (AF-03/AF-04, P1-candidates proposed there; final IDs remain the independent reviewer's to assign). Severities are preparer-proposals. All file:line evidence is worktree == authoritative main 926ee00.

| ID | Severity (proposed) | Affected surface | Finding | Evidence (file:line) |
|---|---|---|---|---|
| AF-03 | P1-candidate | `api/ai/consensus` (authoritative-only surface; absent from the substituted baseline — SEC-P0-DELTA-001 §2) | Parent finding: unauthenticated keyed-LLM invocation + cost amplification + third-party data egress + zero tests [HISTORICAL — ADDENDUM §8.3]. Sub-findings AF-03.1–.7 below extend it item-by-item. | — |
| AF-03.1 | P1 | POST /api/ai/consensus | No authentication, no authorization, no tenant boundary; only per-IP rate bucket. | route.ts:43-63; rate-limit.ts:211-217 |
| AF-03.2 | P1 | Provider egress | Gemini credential transmitted as URL query parameter (key NAME only: `GEMINI_API_KEY`) — log/Referer/reflection leakage class; NVIDIA/OpenRouter keys in Bearer headers (lesser but same custody question). | consensus.ts:311, 268, 225-228 |
| AF-03.3 | P2 | Response contract | Upstream provider error bodies (first 200 chars) disclosed to unauthenticated callers via `votes[].error`. | consensus.ts:284-285, 325-326; route.ts:113 |
| AF-03.4 | P2 | Rate limiting | XFF-spoofable identity (direct :3000) + Redis failure fail-open to per-instance memory → effective limits far weaker than configured 10/min. | rate-limit.ts:180-198, 201-217 |
| AF-03.5 | P2 | Persistence | DB persistence failures swallowed (fail-open); runs succeed with no attestation id; DDL executed from an unauthenticated request path. | consensus.ts:637-639, 889-892, 786-854 |
| AF-03.6 | P2 | Input/prompt | No content filtering on the question channel — prompt-injection into provider egress and persisted consensus records. | route.ts:36-41, 72-89 |
| AF-03.7 | P2 | Testing | Zero automated tests for the route/engine (only live-network smoke script requiring real keys). | §1.16 Grep probe; scripts/ai/smoke-consensus.ts |
| AF-04 | P1-candidate | `api/ai/catalog-sync` (authoritative-only surface) | Parent finding: unauthenticated state-changing DB writes + outbound amplification; body unvalidated/ignored [HISTORICAL — ADDENDUM §8.3]. Sub-findings AF-04.1–.5. | — |
| AF-04.1 | P1 | POST /api/ai/catalog-sync | No authentication/authorization on an administrative-shaped operation. | route.ts:18-46 |
| AF-04.2 | P2 | DB layer | Unauthenticated DDL (CREATE TABLE/INDEX IF NOT EXISTS) + non-transactional upsert loop; partial upserts can persist before a 502. | catalog.ts:141, 173-189; consensus.ts:786-854 |
| AF-04.3 | P2 | Outbound | 2 provider calls per hit (1 keyed), unauthenticated amplification; offline fallback silently substitutes stale seed rows (availability-over-accuracy). | catalog.ts:117-137, 152-170 |
| AF-04.4 | P2 | Response contract | Provider rejection reasons (120 chars) returned inside HTTP 200 — upstream-error disclosure. | catalog.ts:153, 166 |
| AF-04.5 | P2 | Testing | Zero automated tests (CLI wrapper only). | §2.12 Grep probe; scripts/ai/sync-catalog.ts |

**Reviewer reproduction procedure (isolated, code-level; NEVER live):**
- **Code-level (any environment, read-only):** re-verify every citation above with the Read/git commands of §7; confirm middleware absence and the route census.
- **Isolated-environment route tests — ONLY after separate, explicit authorization, and only with providers DISABLED:** boot the route in an isolated clone with all provider keys UNSET (expect the 503 path, `route.ts:58-63`), `AI_CONSENSUS_ENABLED=false` (503, `:55-57`), invalid JSON (400, `:65-70`), over-length/empty question (400, `:36-41`) — these paths exercise the handler without any outbound call. Exercise the DDL/upsert paths only against a throwaway local SQLite file, and the rate-limit 429/XFF behavior only with the in-memory limiter. **Never invoke the LLM providers or catalog sync to test them; never make live calls to administrative or state-changing endpoints; the public deployment URL must not be probed from the review sandbox** — its reachability is an owner/reviewer external determination (§3.3).
- **What CANNOT be reproduced here:** live behavior of the deployed instance, Vercel project settings, actual egress on the Gemini URL pattern at runtime — all external evidence required.

### 5.A Isolated-environment test matrix (providers disabled — NO provider invocation, NO live deployment)

Preconditions for every row: an isolated throwaway clone; provider keys UNSET or egress firewalled OFF; scratch SQLite `DATABASE_URL`; in-memory limiter only; execute ONLY after separate authorization (preamble above). Every row exercises a code path that precedes any outbound provider call.

| Probe (local listener) | Expected result (code-derived) | Evidence basis | Provider invoked? |
|---|---|---|---|
| POST `/api/ai/consensus`, valid JSON, keys unset | 503 "No consensus-capable AI provider key configured…" | route.ts:58-63 | NO — gate precedes egress |
| POST `/api/ai/consensus`, `AI_CONSENSUS_ENABLED=false` | 503 `{model: "disabled"}` | route.ts:55-57; keys.ts:88 | NO |
| POST `/api/ai/consensus`, body not JSON | 400 "Invalid JSON body" | route.ts:65-70 | NO |
| POST `/api/ai/consensus`, `question` missing / empty / 501 chars / control chars | 400 "Body must include 'question' (1-500 chars…)" | route.ts:36-41, 72-78 | NO |
| 11 rapid POSTs from one honest IP (in-memory limiter, keys unset) | first 10 hit the 503 gate, the 11th → 429 + `Retry-After` | route.ts:44-54; rate-limit.ts:48, 150-178 | NO |
| Same 11 POSTs, distinct `X-Forwarded-For` per request on the direct listener | no 429 at all — fresh full-capacity bucket per spoofed IP (AF-03.4 proof) | rate-limit.ts:211-217 | NO |
| POST `/api/ai/consensus` with the persistence layer failing (unit-mock the db client, or scratch DB unreachable with egress firewalled OFF) | 200 with `runId` ABSENT (fail-open persistence proof, AF-03.5). Preferred form: unit-mock `persistRun`'s db calls — no network of any kind | consensus.ts:637-639, 889-892 | NO |
| Unit-invoke `ensureConsensusTables` against scratch SQLite | `AiModelCatalog` / `ConsensusRun` / `ConsensusVote` + 6 indexes created (DDL reachability proof) | consensus.ts:786-854 | NO |
| POST `/api/ai/catalog-sync`, 11th rapid request | 429 — the rate gate precedes everything; rows 1–10 of the burst are NOT executed in this matrix (see next row) | route.ts:19-29 | NO |
| POST `/api/ai/catalog-sync` dynamic execution | **OUT OF MATRIX — do not run:** exercising the sync would perform provider downloads (or the seeded fallback, itself a DB write). Its authorization-absence is proven statically (§2.1–2.2) plus via the 429 gate; deeper dynamic testing is a separately-authorized, egress-blocked, reviewer-side decision | route.ts:18-46; catalog.ts:140-198 | N/A |
| GET `/api/ai/status` | 200 with `providers[].keyPresent=false`, roster/catalog view (adjacent-surface confirmation) | status/route.ts:13-23; consensus.ts:908-972 | NO |

**Auth-absence assertion for both routes:** no combination of missing/invalid `Authorization`, cookie, API-key, or signature headers changes any outcome above — the code paths contain no such checks (§1.1, §2.1) [VERIFIED-FACT: source-level].

---

## 6. The 2026-11-11 owner-message credential disclosure event — relevance note

The 2026-11-11 owner directive message itself contained plaintext credentials (types: GitHub PAT; Vercel token; Turso database URL + token; Neon Postgres URL + password; Inngest event key + signing key) — "the 2026-11-11 owner-message credential disclosure event (values redacted)" [HISTORICAL — briefing R8]. They were not used, echoed, or stored by this workstream; rotation is urgently recommended (owner-side).

**Relevance to THIS package, and only this:** the deployed-infrastructure credential types now also exist in an exposed transcript — i.e., the credentials that govern the *external ingress and hosting layer* whose settings are the UNVERIFIED column of §3.3 (Vercel project protection, Turso/Neon access) have an additional public-exposure path. Access-path analysis for those credentials (who can reach the deployed stack, with what effect) is owner-side work requiring external evidence — it does not change the source-level findings: the routes remain source-level-ABSENT for authentication and code-verified for state-changing effects regardless of who holds hosting credentials. TESTNET_READINESS.md Gate 0 (`:12-23`) already treats the 2026-10-24 credential set as compromised-class; the 2026-11-11 event extends the same urgency to the Vercel/Turso/Neon/Inngest types. No rotation, revocation, or remediation is claimed by this document (R5).

---

## 7. Reproduction commands (reviewer, read-only)

```
# Route census + middleware absence (read-only)
git ls-tree -r --name-only <ref> | grep -cE 'src/app/api/.*route\.ts$'      # 63 at fc9ad97/926ee00
git ls-tree -r --name-only <ref> | grep -E '(^|/)(middleware|proxy)\.(ts|js|mjs)$'   # (empty)
# File-level reads (worktree == authoritative main content)
$EDITOR src/app/api/ai/consensus/route.ts src/app/api/ai/catalog-sync/route.ts
$EDITOR src/lib/ai/consensus.ts src/lib/ai/catalog.ts src/lib/ai/keys.ts
$EDITOR src/lib/mtq/rate-limit.ts src/lib/db.ts src/lib/db-ops.ts
$EDITOR vercel.json next.config.ts Caddyfile dev-watchdog.sh scripts/dev-entrypoint.sh
$EDITOR .github/workflows/health-probe.yml .github/workflows/inngest-resync.yml
$EDITOR .github/workflows/deploy-testnet.yml TESTNET_READINESS.md package.json
# Zero-test coverage probe (no test file references the routes or engine)
grep -rEl 'runConsensus|syncModelCatalogs|ai/consensus|catalog-sync' --include='*.test.*' .   # (empty)
# Key-name enumeration only (never values): rg -n '^[A-Z_]+=' .env.example
# DDL/upsert authorization is read from source (consensus.ts:786-854; catalog.ts:141,173-189) —
# live DB effects are NOT reproducible here (external evidence required).
```

All commands above are read-only file/git inspections; none executes application code, none performs network calls, none touches credentials.

---

## 8. Final status

```
PHASE 0 — API AUTHORIZATION REVIEW: BOTH UNREVIEWED ROUTES NOW ASSESSED AT CODE LEVEL
AF-03/AF-04 EXTENDED (AF-03.1-.7, AF-04.1-.5) — ALL FINDINGS OPEN, NONE REMEDIATED
INGRESS BOUNDARY: REPO LAYERS VERIFIED-ABSENT AUTH · LIVE PLATFORM UNVERIFIED (NO LIVE CALLS MADE)
PHASE 1 — NOT AUTHORIZED
TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED
```

**Limitations (honest):** prepared by the implementer's own agent lineage inside the assessed environment — verification-support material, not independent review; no live request, provider call, or DB operation was performed; the four-way ingress classification is therefore source-anchored with the live columns UNVERIFIED by construction; the 61-route re-audit and all §6.4 requirements remain future owner-authorized work. No finding herein is claimed resolved, rotated, revoked, or remediated.
