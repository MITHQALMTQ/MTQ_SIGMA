# Task 16-e — Security, Privacy & Permission Audit + Dependency Posture

**Mandate:** PLATFORM-FULL-AUDIT-AND-REMEDIATION-001 §10 (security/privacy/permissions) + §11/§12 subset (dependencies).
**Agent:** 16-e (READ-ONLY auditor — no source modified; controlled non-destructive probes only).
**Date:** 2026-10-23 (UTC). **Secrets policy:** only env var NAMES and set/unset status; no secret values anywhere in this file.

**Corroboration base:** 16-a (API contract, defects 16a-001…015) and 16-b (integrations register) were read in full; their findings were re-verified where mandated (live re-probes + source reads) and are NOT re-derived here. Env: `.env` sets ONLY `DATABASE_URL` (local SQLite file path) — re-confirmed by name-only profile.

---

## A. Secrets hygiene verdict

| Check | Method | Result |
|---|---|---|
| Worktree scan | `bun run security:scan` | 2,323 files, 14 documented allowlist suppressions, **1 finding: dev.log:75415 `evm-hex-private-key-context` "dead…beef (len 66)"** |
| dev.log finding characterization | safe metadata script (no value printed) | **FALSE POSITIVE**: line is a Next dev access log `GET /api/mbg/status/0xdead…beef` — an auditor probe URL path (repeat-pattern hex, starts `dead`/ends `beef`, distinctChars=5, NOT the known C-045-a literal); "key context" comes from the adjacent log line "…no signing key found…" (scanner context spans lines) |
| upload/ contents | `ls` (names only) + targeted scanner runs | 14 files (docx/rtf/png/jpg + 2 untracked `Pasted Content_*.txt`, both **scanner-PASS**); **`upload/private_key.txt` ABSENT** (destroyed under owner-authorized D-13.1); no key-like filename remains |
| upload/private_key.txt git history | `git log --all -- upload/private_key.txt` | **0 commits** — never tracked, never committed (corroborates Task-13 incident record §2) |
| .gitignore coverage | read + `git check-ignore -v` | `.env` (L34), `db/*.db` + journal/wal/shm (L89-92), `*.log`/`dev.log` (L95), `upload/*.txt` + exact `upload/private_key.txt` (L63-64), `tool-results/`, `backups/*` (manifests whitelisted), `.fresh-evm-keypair-DO-NOT-COMMIT.txt` — **comprehensive**; dev.log/db/.env confirmed untracked |
| .env on disk | name-only profile | ONLY `DATABASE_URL` (28 names in `.env.example`, all dummy) |
| Git history — known compromised literals | count-only: `git log --all -G'<anchored scanner regex>'` + `git grep -c` per commit | **CONFIRMED STILL PRESENT (documented OPEN item, Task 12 D2)**: full C-045-a pattern in baseline `fb6bb6c` (2 files: `worklog.md`, `scripts/verify-key-and-audit-roles.ts`); full C-045-b pattern in `fb6bb6c` (6 solana scripts). Removed from worktree in `3b26232` (2026-10-22) but **blobs remain reachable from HEAD** (`git merge-base --is-ancestor` YES for both). **No git remotes configured.** Pickaxe prefix control: well-known Hardhat test key appears 2× (benign, allowlisted). |
| dev.log other secrets | scanner rules (env-key-assignment etc.) | 0 env-key assignments; only the 1 FP above. dev.log is gitignored and not web-served (not in public/) |
| Retired key scripts in HEAD | head of `scripts/verify-key-and-audit-roles.ts` | Fail-closed/read-only stub with K-1 rewrite notice — no key handling ✓ |
| Prevention controls | live | CI secret-scan job present (`.github/workflows/ci.yml`, runs first); pre-commit hook ACTIVE (`core.hooksPath=.githooks`); scanner regression tests exist ✓ |

**Verdict A:** Worktree is CLEAN (single finding = documented-FP class). Repo-side hygiene since T13-INC-001 is verified good: the uploaded key copy is gone, never entered git, and the tripwire gate is live. The one standing repo-side secrets liability is the **acknowledged, still-OPEN git-history presence of both compromised key literals** (Task 12 D2 §1/§2; D3 rewrite plan pending owner + security-lead approval). Until D3 executes, **every clone/bundle/backup of `.git` is key-bearing material**. Keys themselves remain compromised owner-side regardless (D4/D5 rotation gated on D8) — per D2's standing rule, repo cleanup never revokes them.

---

## B. Mutating-surface security table

All endpoints unauthenticated by design (public testnet pilot). "Bound" = request-level bound on resource use. XFF column reflects effective behavior (see §D rate-limit).

| # | Endpoint | Auth | Rate limit | Bound? | Injection risks | Severity |
|---|---|---|---|---|---|---|
| 1 | POST /api/simulate/mint | none | **NONE** | NO — amount finite>0 only (1e15 accepted, 16a-001); chain/wallet free text; **2MB body accepted+parsed** (16e-007) | wallet/chain persisted → CSV injection downstream (16a-009/16d-005); `String(e)` 500 on bad JSON | **P1** |
| 2 | POST /api/simulate/redeem | none | **NONE** | same as mint | same | **P1** |
| 3 | POST /api/issuance | none | **NONE** | scenario whitelist ✓; 14 DB rows per run, unbounded rate (16a-003) | `String(e)` leak | **P1** |
| 4 | GET /api/validation?force=1 | none | health 60/min shared | NO — full Monte-Carlo in-request → OOM server kill; writeFileSync into src tree (16a-002) | fixed-path write only | **P1** |
| 5 | GET /api/tests?force=1 | none | **NONE** (no limiter on route at all) | same OOM class; frontend "re-run" button (16a-002/16c-001) | fixed-path read | **P1** |
| 6 | POST /api/mbg/mint-request | **fail-closed 401** (HMAC-SHA256 constant-time, ±60s window / API-key sha256-hash compare / testnet bypass only when `MBG_TESTNET_BYPASS==="true"`) — live-re-verified 401 `no authentication provided` | simulate 20/min ✓ | strong schema validation; fractional nonce BigInt fail-soft (16a-011); no one-time nonce (replay ≤±60s, 16e-009) | none found | P2 (auth design is the codebase's best) |
| 7 | POST /api/sync | none | health 60/min ✓ | fixed event name; external Inngest call bounded by bucket; upstream error text surfaced (16a-012) | none | P3 |
| 8 | POST /api/succession | none | **NONE** (verified: no rateLimit import) | best-in-class validation (400s, 16-a); compute-only BUT external FX quote fetch per request + engine clone per request | none | P3 (new: unrate-limited external-fetch compute) |
| 9 | POST /api/webhooks/tenderly | HMAC-SHA256 on raw body, 64-len check, XOR constant-time compare; **fail-closed 503 when secret unset** (live-re-verified) | none (minor — 1 HMAC/req) | forward-only; parse AFTER verify ✓ | none; no replay protection (16e-009) | P4 |
| 10 | /api/inngest GET/POST/PUT | SDK-managed; cloud-mode w/o signing key → **500** (refuses to serve = fail-closed in effect, wrong status code) (live-re-verified) | none | 6 scheduled functions become triggerable once configured | — | P2 (16a-006; see 16e-011 remediation caveat) |
| 11 | POST /api/ai/qa | none | ai 5/min ✓ | 500-char server-side cap, fail-tolerant parse ✓ | question → prompt text only (see §F) | PASS |
| 12 | POST /api/ai/screen | CORS whitelist gate (403 non-whitelisted, pre-cost) | ai 5/min ✓ | 5000-char cap ✓ | user text → HF NER (dead endpoint; egress note §F) | PASS |
| 13 | GET /api/roles, /api/onchain/[chain] | none | **NONE** | unrate-limited RPC amplification (16a-007) | fixed RPC map — no SSRF from params | P2 |

**DoS inventory beyond force-runs:** single-shot latencies measured via gateway — all normal GETs 5–165 ms; /api/roles 1.66 s (60 s module cache, cold 1.97 s per 16-a); /api/metrics 165 KB/resp unthrottled (4 s poller). No other heavy GET found; contradiction-scan 85 ms, evidence 50 ms (per-request `execSync("git rev-parse HEAD")`, fixed argv, 16a-010 corroborated).

---

## C. Injection & input-validation verdicts

| Vector | Method | Verdict |
|---|---|---|
| Prototype pollution | grep all spreads/`Object.assign` of parsed bodies; JSON.parse sites | **NONE** — only spreads are server-computed payloads (validation route `{...payload}`, tests cache). No merge of user objects into state. |
| Command injection | grep `execSync/exec/spawn` in src/scripts/mini-services + context read | **NONE reachable** — sole execSync is /api/evidence with fixed string argv (no user input). Bun.spawn only in scanner tests (fixed args). Corroborates 16a-010. |
| Path traversal | all fs reads in API routes | **NONE** — all fixed paths (`test-results.json`, `validation-results.json`, `audit-work/v5/safe-verification.json`, release-controls env-path); `[requestId]` regex-gated → Prisma (400 live-verified). Release-controls grant file: env-provided path, unreadable → all NOT_GRANTED (fail-closed verified). |
| SSRF from app routes | all fetch() sites | **NONE from user input** — fixed RPC/URL maps; `onchain/[chain]` param only indexes a fixed `RPC`/address map (unknown → 404); Discord webhook URL from env. **BUT the gateway itself is an open localhost-port proxy (16e-002).** |
| ReDoS | heuristic nested-quantifier grep + read of user-input regex paths | **NONE found** — sanctions fallback regex is bounded-repetition `{0,2}` over ≤5000 chars (linear); §-citation regexes simple; audit ReDoS advisories exist only in transitive dev-graph deps (picomatch). |
| CSV/formula injection | corroborate 16a-009/16d-005 | **CONFIRMED (carried)** — CSV export quotes but does not neutralize `=+-@` prefixes; wallet/chain free text round-trips. Extension: wallet accepts multi-MB strings (16e-007). |
| HTML/XSS sinks | grep dangerouslySetInnerHTML/innerHTML/document.write/eval/new Function | **ZERO occurrences in src/** — React auto-escaping everywhere; AI outputs render as text. |
| JSON.parse robustness | mbg (try→400 ✓), tenderly (after HMAC ✓), ai/qa (fail-tolerant ✓), simulate (500+SyntaxError — 16a-004 carried) | mixed; worst is simulate pair. |

---

## D. Rate-limit & gateway analysis (XFF bypass — mandated §6)

`getClientIP` (src/lib/mtq/rate-limit.ts:142-148): trusts `x-forwarded-for` **first value** unconditionally, then `x-real-ip`, else `"unknown"`. No trusted-proxy concept.

Live probes (controlled):
1. **Through Caddy gateway :81** — 70 requests with rotating spoofed `X-Forwarded-For: 10.0.0.N` → **60×200 + 10×429 (shared bucket)**. The running Caddy config does `header_up X-Forwarded-For {remote_host}` (repo Caddyfile; /app/Caddyfile unreadable but behavior matches exactly) → **XFF is OVERWRITTEN with the real client IP; spoofing fails through the gateway**. This *narrows* 16a-005's external impact.
2. **Direct :3000** — exhausted bucket for `unknown`, then `X-Forwarded-For: 203.0.113.99` → 200 fresh bucket. **Bypass re-proved on the direct port** (16a-005 corroborated). :3000 binds `*:3000` (all interfaces), as do :3003 (mtq-feed) and `0.0.0.0:3040` (keeper).
3. **Exposure uncertainty, stated honestly:** next.config comment says "preview-*.space-z.ai forwards to localhost:3000" — suggesting the sandbox preview may map DIRECTLY to :3000 (where XFF spoofing works and Caddy's sanitization never applies), while :81 is the Caddy-gated path. Mapping cannot be determined from inside the sandbox; **both paths must be assumed reachable and both fixed.**
4. **New extension (16e-003b):** every spoofed unique IP mints a permanent entry in the in-memory `buckets` Map (no eviction/TTL) → unbounded memory growth under the 768 MB heap cap (memory-exhaustion vector, synergistic with the direct-port bypass). Also: no-XFF clients all share the single `"unknown"` bucket (inverse cross-client lockout on direct port); Upstash path is **fail-open** on Redis errors (documented design tradeoff — noted).
5. **Gateway open proxy (16e-002):** Caddyfile rule `?XTransformPort=<port>` → `reverse_proxy localhost:<port>`. **LIVE-PROVEN**: `GET http://localhost:81/health?XTransformPort=3040` returned the keeper's full /health JSON (release controls NOT_ACCEPTED observed); `?XTransformPort=3003` reached mtq-feed; closed port → Caddy error page. Anyone who can reach :81 can reach **every localhost service**, including keeper `POST /tick` (observe-only via release controls today — the only thing bounding this) and any future localhost listener. This is a gateway-level SSRF/port-proxy by configuration.

---

## E. Headers / CORS / cookies

- **Security headers: NONE configured anywhere** (live-checked `/` and `/api/metrics`): no CSP, no X-Frame-Options (app is frameable), no X-Content-Type-Options, no Referrer-Policy, no HSTS; `X-Powered-By: Next.js` exposed. No `headers()` in next.config, no middleware.ts. → 16e-006 (P3; XSS-sink-free codebase lowers CSP urgency; clickjacking impact minimal on testnet but the mint UI is interactive).
- **CORS: correct by default.** No `Access-Control-Allow-Origin` on any route except /api/ai/screen (whitelist-echo + `Vary: Origin` + 403 preflight for non-whitelisted, verified in source). No `*` anywhere. Browsers cannot cross-read any other API route.
- **Cookies/session: none.** Sole cookie is the shadcn sidebar UI-state cookie (non-sensitive, no session semantics); localStorage holds UI preferences only. Sessionless-by-design confirmed — nothing to hijack.
- **Cache poisoning:** all data routes force-dynamic; state-sensitive routes explicitly no-store; only banks (s-maxage 60) / fred (s-maxage 300) are public-cacheable and neither reflects user input into the response; Caddy does not cache; Next dev does not cache. **No poisoning vector found.**

---

## F. AIP security (/api/ai/*)

- **No user input reaches any prompt except /api/ai/qa's question** (sanitized: control chars stripped, 500-char server-side cap) — embedded as the `user` message with a fixed system instruction + server-built blueprint context. Risk-signals/briefing prompts are built exclusively from the live engine snapshot (16-a register; re-read source).
- **No tool use / function-calling anywhere in the AI chain** (`callWithFallback` → chat completions only); **fallback paths are deterministic constants/rules** (FALLBACK_ANSWER for QA — it does not even echo the question; TETHER>25% rule for risk signals — verified live by 16-b) and cannot execute anything.
- **AI outputs render as escaped React text** (zero HTML sinks, §C) → prompt injection yields at worst manipulated advisory text in the UI. Acceptable for a read-only advisory AIP; documented.
- **Privacy note:** /api/ai/screen sends user-supplied text (≤5000 chars) to HuggingFace when a key is configured (endpoint currently dead, 16b INT-13) — third-party data egress is inherent to that feature; CORS-whitelisted + rate-limited + disclosed-model. No PII is collected anywhere else (no accounts, no tracking, no cookies beyond UI state).

---

## G. Dependencies (§11/§12 subset)

`bun pm ls`: 1,408 node_modules (89 top-level). `bun audit`: **115 vulnerabilities — 6 critical, 61 high, 41 moderate, 7 low.**

**Top items (severity + component + applicability):**
| Advisory | Component (installed) | Applicability to this app |
|---|---|---|
| critical ×3: RCE in Image Optimization API (AVIF/SVG), RCE in `use cache`, RCE on Windows hosts | `next@16.1.3` | **Partially applicable**: next/image IS used (RiskStateMachine.tsx) → image-opt API reachable in dev; `use cache` NOT used (inapplicable); host is Linux (inapplicable). Conditions of the image-opt RCEs not tested (no attacks per protocol). Update required. |
| critical: Sentry middleware bypass via tunnel route | `@sentry/nextjs@10.74.0` (<10.75.2) | Mitigating: no middleware.ts exists, DSN unset → SDK no-op. But `tunnelRoute: "/monitoring"` is configured in next.config. Update to ≥10.75.2. |
| critical: Auth.js homoglyph email-normalizer bypass (+high/moderate) | `next-auth@4.24.13` | **INAPPLICABLE — dead dependency**: zero importers in src/scripts/mini-services. Remove it (it currently only adds an unpatched critical to the graph). |
| high: js-cookie prototype hijack | via `@reactuses/core` (0 importers) | Dead transitive weight — remove @reactuses/core. |
| high: picomatch ReDoS ×2, moderate: fast-uri, + ~100 more | dev/lint graph (eslint, next-intl watcher, sentry build chain) | Mostly build-time; not runtime-reachable via HTTP. Batch `bun update` advised. |

**Unused heavy dependencies (grep-verified import counts):** `@mdxeditor/editor` (0 imports), `@dnd-kit/core|sortable|utilities` (0), `next-auth` (0), `@tanstack/react-query` (0), `@reactuses/core` (0), `socket.io-client` (only in the orphaned mini-services/mtq-feed — corroborates 16b-003). `@neondatabase/serverless` (1.1.0): imported only by `src/lib/neon-client.ts` + scripts; see 16e-004 below.

**16e-004 — check:no-neon guard coverage gap:** the guard scans ONLY direct `from '…@neondatabase…' patterns in route.ts files and PASSES ("Scanned 47 route files — no Neon/Postgres imports found"), while `src/app/api/sync/route.ts` imports `@/lib/neon-client` and queries Neon (`getTableSizes()`) whenever `NEON_DATABASE_URL` is set. The CI guardrail's intent ("routes must NEVER query Neon") is evaded by the indirection. Fix: extend the guard to flag `neon-client` imports in route files (or any @neondatabase import under src/lib reachable from routes).

---

## H. Defect list (16e-NNN)

| ID | Severity | Finding | Evidence | Minimal fix |
|---|---|---|---|---|
| 16e-001 | **P1 (carried-OPEN, independently re-verified)** | Both known compromised private-key literals (C-045-a EVM, C-045-b Solana hex) remain fully present in reachable git history (baseline `fb6bb6c` → 8 file-hits; removal commit `3b26232` did not purge blobs). Documented OPEN in Task 12 D2 with D3 rewrite plan pending owner + security-lead approval. No remotes configured; any clone/bundle/.git copy made today is key-bearing. | `git log --all -G'0xdbe1[0-9a-fA-F]{56}62d6'` → 2 commits; `git grep -c` per commit → file:count only; `merge-base --is-ancestor` YES; `git remote -v` empty | Execute D3 history rewrite (filter-repo/BFG) after owner approval; until then treat .git copies as sensitive; proceed D4/D5 rotation (unchanged) |
| 16e-002 | **HIGH (new)** | Caddy gateway `?XTransformPort=<port>` = open proxy to ANY localhost service through the exposed :81 listener. Live-proven: reached keeper :3040 /health (full JSON incl. release-controls posture) and mtq-feed :3003 through :81. Exposes keeper POST /tick, the orphaned feed, and any future localhost listener to anyone who can reach the gateway. | curl `http://localhost:81/health?XTransformPort=3040` → 200 keeper JSON; `?XTransformPort=3003` → engine.io 400; repo Caddyfile lines 3-8; running caddy pid 2 (`/app/Caddyfile`, behavior-identical) | Delete the XTransformPort rule, or port-whitelist (3000 only); if a port-transform dev feature is needed, bind it to an internal listener |
| 16e-003 | P2 (new, extends 16a-005) | Rate-limit trust model split-brain: gateway overwrites XFF (spoof fails — 70-req shared-bucket probe), but the app on :3000 (bound `*:3000`) trusts client XFF (fresh-bucket bypass re-proved) AND the sandbox preview may map directly to :3000 (next.config comment "preview-*.space-z.ai forwards to localhost:3000"). Plus: in-memory `buckets` Map has no eviction → spoofed-unique-IP spam grows memory unbounded under the 768 MB cap; no-XFF clients share one `"unknown"` bucket; Upstash path fail-open on Redis error. | Probes §D.1-3; rate-limit.ts:92-148 (no eviction, fail-open catch at 135) | Trusted-proxy check in getClientIP (honor XFF only from the gateway); cap+evict the buckets Map; bind dev server to 127.0.0.1 when a gateway exists; keep Redis fail-open documented or make it fail-closed per posture |
| 16e-004 | P2 (new) | check:no-neon CI guardrail bypassed by indirection: api/sync/route.ts → @/lib/neon-client → @neondatabase/serverless, guard reports clean | `bun run check:no-neon` → "✓ …no Neon/Postgres imports found" while sync route calls neonClient.getTableSizes() when configured | Extend guard to match `neon-client` / any @neondatabase import under src/lib imported by routes |
| 16e-005 | P2 (new) | Dependency posture: 115 advisories (6 critical) incl. next@16.1.3 image-optimization RCE advisories with next/image in use; next-auth (0 importers) carrying an unpatched critical; @sentry/nextjs below the tunnel-route-bypass patch with tunnelRoute configured; 6 unused heavy deps | `bun audit` summary; import-count greps §G | `bun update` (next, @sentry/nextjs ≥10.75.2, sharp); remove next-auth, @mdxeditor/editor, @dnd-kit/*, @tanstack/react-query, @reactuses/core; retire mtq-feed per 16b-003 |
| 16e-006 | P3 (new) | No security headers on any response (CSP/XFO/XCTO/Referrer-Policy absent; X-Powered-By exposed) | live header dumps §E | Add `headers()` in next.config (at minimum X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Referrer-Policy; CSP once evaluated against inline styles) |
| 16e-007 | P3 (new) | No request-body size cap on mutating routes: 2 MB JSON accepted and parsed by /api/simulate/mint (route handlers have no framework limit); wallet free-text of multi-MB length would persist into SQLite and re-export via CSV | 100 KB and 2 MB probes → both 200+parsed (non-mutating: amount below §19.7 minimum → no row written) | Cap body size (route-level Content-Length/byte check, e.g. 64 KB) + wallet length/charset cap (16a-009 fix covers this) |
| 16e-008 | P3 (new) | Secret-scanner FP class on dev.log access lines (multi-line context pulls "signing key" text into a URL-path match) keeps the worktree gate RED; dev.log also grows unbounded (75k+ lines) | security:scan output + safe characterization (§A) | Add a justified allowlist entry (public probe-URL constant class) or rotate dev.log; consider narrowing scanner context to same-line for URL paths |
| 16e-009 | P4 (new) | No replay protection on auth-carrying receivers: tenderly HMAC has no timestamp/nonce; mbg HMAC window ±60s but nonce is signed, not consumed (replay ≤120 s window) | route sources §B#6/#9 | Nonce store (one-time use) for mbg; tenderly: document accepted risk or add ts header |
| 16e-010 | P4 (carried, corroborated) | Privacy: /api/mbg/status/[requestId] returns creator's stored apiRemoteIp/apiUserAgent to any requestId holder; tenderly GET discloses discord-enabled flag | 16a-015 + source | Strip requester metadata from status payloads |
| 16e-011 | INFO (remediation caveat) | The inngest fix must be env-scoped: setting INNGEST_DEV=1 blanket would make /api/inngest accept UNAUTHENTICATED function triggers (keeper-tick/sync/backup/monitor/prune = heavy compute) wherever it is set | SDK serve() dev-mode semantics + route comment | Set INNGEST_DEV=1 only in local dev env files; in prod set INNGEST_SIGNING_KEY; prefer explicit 503 "not configured" guard in the route |

**Corroborated, not re-filed:** 16a-001 (unbounded unauthenticated ledger mutation — re-verified in source: no limiter, no cap), 16a-002 (force-run OOM; /api/tests has NO limiter at all — worse than validation), 16a-003 (issuance DB writes), 16a-004 (500+SyntaxError), 16a-005 (XFF — refined by §D), 16a-006 (inngest 500 — re-verified live), 16a-007 (RPC amplification), 16a-008 (trials limit), 16a-009/16d-005 (CSV injection + free-text persistence), 16a-010 (execSync/req), 16a-012 (error leakage — full enumeration: 21+ `String(e)`/`e.message` sites across 18 routes, list in §B/§C), 16a-014 (shared health bucket), 16b-001/003 (inngest, orphaned feed).

---

## I. Release-blocking assessment (mandate F)

**No NEW P0.** No active repo-side compromise (worktree clean, key copy destroyed, gates live), no authentication bypass on any auth-carrying route (all fail-closed, constant-time), no injection-class RCE reachable (command/path/proto/SSRF/HTML all clean), no secret leakage in any HTTP response (re-confirmed 16-a's 498 KB scan conclusion by source audit of all error paths).

**However, the pilot is NOT safe to expose beyond the sandbox as-is.** Blocking queue for any wider exposure (all already tracked or filed today):
1. 16a-001/002/003 — bound the write/compute surfaces (simulate limiter+cap, force-run removal, issuance limiter). P1.
2. **16e-002 — remove the gateway XTransformPort open proxy** (exposes every localhost service through the preview path). HIGH.
3. **16e-001 — execute D3 history rewrite** (or formally accept that all .git copies are key-bearing until D4/D5 rotation lands). P1 carried.
4. 16e-003 — trusted-proxy XFF + dev-server bind + bucket eviction; verify which port the preview actually maps (infra check).
5. 16e-005 — dependency update + dead-dep removal (next image-opt RCE advisories with next/image in use).

**Posture note:** all on-chain authorities remain fully privileged with compromised keys (D2: "real and fully privileged — NOT ACCEPTED"); that is an owner-side rotation matter (D4/D5/D8), unchanged by anything in this repo, and the release-controls fail-closed layer (8×10, grants only via env-path file, honest-status gates) plus the keeper observe-only guard are the compensating controls — both re-verified live this session.

## J. Honest negatives / things NOT claimed

- I did not attempt to exploit any CVE (image-optimization RCE conditions, XFF bypass beyond bucket-minting, OOM beyond the already-documented class) — protocol forbids attacks; all probes were single-shot or ≤70-request bounded.
- I could not determine from inside the sandbox whether the external preview maps to :81 (Caddy-sanitized) or directly to :3000 (XFF-spoofable) — recorded as an infra verification item, not a finding.
- /app/Caddyfile (running config) is root-owned unreadable; the gateway's behavior was verified black-box (XFF overwrite + XTransformPort both live-proven) — behavior matches the repo Caddyfile.
- A clean worktree scan does not prove absence of external key copies (scanner's own honest-scope note; D2 §5 recontamination vectors remain).
- The scanner does not scan binary files (docx/png in upload/) — owner documents, out of pattern scope by design.

## K. Audit residue

None on the running system: all probes read-only or rejected (the 2 MB body probe mint was below the §19.7 minimum → engine rejected, no row written — verified reasoning + no code path). Artifacts: this file + one worklog entry. /tmp probe files (char16e.mjs, body.json) contain no secrets.
