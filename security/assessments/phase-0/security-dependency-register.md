# Phase 0 — Security Dependency & Tool Register

Only security-relevant entries (full app dependency list is in `package.json`/`bun.lock` — pinned). No tool was installed by this audit; classifications per §16 discipline (purpose → threat → evidence → justification). Free/self-hosted preferred over hosted/paid where equivalent (§16 rule) — noted per row.

## A. Cryptographic / signing libraries

| Dep | Version (lockfile) | Purpose / threat addressed | Evidence & justification |
|---|---|---|---|
| `@noble/curves`, `@noble/hashes` | pinned (^2.4.0 spec) | ed25519 devnet tx signatures & hashing (spoofing/tampering on devnet) | audited, minimal, no native deps; self-hosted lib (no vendor) — fits §16 |
| `ethers` | pinned | chain reads (`/api/roles`, `/api/onchain/*`), deploy tooling | required by EVM estate; broad attack surface acknowledged — usage is read-path + gated deploy scripts |

## B. Data / state layer

| Dep | Purpose | Notes |
|---|---|---|
| `prisma` + `@prisma/client` (+libsql adapter) | pilot persistence | parameterized queries (SQLi posture good); SQLite local file |
| `@libsql/client` | chain.db raw-SQL layer | hand-written SQL in `chain/store.ts` — input paths bounded (regex-gated addresses/ids) — Phase 2 SAST should re-verify |
| `@neondatabase/serverless` | optional mirror | env unset; serverless routes prohibited by `check-no-neon.ts` (enforced control, good) |
| `@upstash/redis` (optional) | rate-limit backend | absent → in-memory buckets (per-process reset caveat documented in rate-limit.ts) |

## C. Security tooling (in-repo)

| Tool | Threat | Wired? | Evidence | Status label |
|---|---|---|---|---|
| `scripts/security/secret-scan.ts` + `.githooks/pre-commit` + CI job 0 | secret leakage at commit/push | YES (local hook verified active; CI unverifiable) | 10 rules incl. 2 unsuppressible compromised literals; redacted output; allowlist w/ justification field; unit tests | SECURITY TESTED (unit) — staged-only scope caveat [F-0-P3-03] |
| `scripts/security/redact-known-secrets.ts` | known-compromise purge | manual (`security:redact:*`) | fingerprint-anchored incl. base58 form; usage evidenced (task12) | INTEGRATION TESTED (historical) |
| `secret-scan.test.ts`, `release-controls.test.ts`, `address-book-validation.test.ts` | gate regressions | `security:tests` + CI | bun tests | SECURITY TESTED (unit) |
| Slither (in forge-tests.yml) | SAST for contracts | **DEAD WIRING** (trigger condition unsatisfiable) | forge-tests.yml:103 | NOT STARTED (as control) [F-0-P1-04] |
| Foundry (`contracts/foundry.toml`, forge build/test; MTQSigmaV2.t.sol) | contract correctness/fuzz | manual + deploy workflow gates | EIP-170 size gate enforced in deploy-testnet.yml | INTEGRATION TESTED |
| ESLint (ci.yml) | code hygiene | advisory (`continue-on-error: true`) | ci.yml:72 | IMPLEMENTED (non-blocking) [F-0-P2-02 class] |
| `runtime-preflight.ts` | dependency-substitution at runtime (incident-22 class) | watchdog v5 (fail-closed block) | 14-state check incl. vendored meriyah | SECURITY TESTED (incident-driven) |
| `bun install --frozen-lockfile` | lockfile drift | wired in preflight repair path | package-lock parity | INTEGRATION TESTED |
| `git-drift-guard.ts` / `git-state-classify.ts` | stale-lineage boot | watchdog subloop + plane-5 | 14/14 regression tests; live-recovery evidence | SECURITY TESTED |
| `db-selfheal.ts` / `db-restore-verify.ts` / `backup-logical-dump.ts` | state loss/rollback | watchdog + battery + manual | incident #7 zero-manual recovery; round-trip PASS records | SECURITY TESTED (data layer) |
| `verify-upload-path.ts` | ingestion-control verification | manual | PASS records in manifests | INTEGRATION TESTED |

## D. External services (credential-bearing surfaces — all EXISTING/UNVERIFIED from sandbox)

| Service | Purpose | Data exposure | Cost posture |
|---|---|---|---|
| GitHub (repo, Actions, secrets, releases) | source authority + CI | full source; push credential embedded in sandbox | free tier assumed; protection state unknown |
| Turso | remote DB + backup.yml source | full pilot data; token is read-WRITE (documented) | free tier documented; limits unrecorded (§16 honesty) |
| Neon | analytics mirror | replicated state; env unset now | free tier |
| Inngest Cloud | scheduled functions | event payloads; signing key unset (503 fail-closed) | free tier |
| Vercel | hosting (advertised URL) | app surface | free tier assumed |
| Sentry | error telemetry | stack traces; DSN unset locally | free tier |
| Frankfurter / gold-api / FRED / Yahoo | price references | no secrets (FRED keyed, unset) | free/public |
| Discord webhook | alerting (keeper/backup paths) | alert text | free |

§16 explicit statement: no hosted/paid service was selected where a self-hosted equivalent met the requirement; free-tier usage limits and recurring-cost exposure are NOT inventoried anywhere in-repo (gap → Phase 2 dependency register task).

## E. Not present (deliberate — §16 anti-tool-spam compliance)

SBOM generator, SCA/dependency-vuln scanner, container image signing/admission, artifact signing/provenance attestation, network egress policy, EDR, WAF. None installed by Phase 0 (read-only). Each maps to Phase-2/5 gaps documented in the register rather than to speculative installs.
