# Phase 0 — Developer, AI-Agent & CI/CD Assessment

## 1. Developer endpoint reality (§4.2)

The "developer environment" is **the shared sandbox**: one OS user (`z`) with direct filesystem authority over source, DBs, secrets-in-files, and the git push credential; platform root sits above it. Endpoint management, disk encryption, EDR, device posture, dev/test/prod credential separation: **NOT PRESENT / NOT APPLICABLE** (container substrate, platform-owned). Honest classification: controls of this class are outside the project's authority; they are platform-bound and must be treated as assumed-compromised substrate per §0.1 — the architecture compensates upstream (push-token separation, review gates, signing).

## 2. AI-agent isolation (§4.3) — this program is itself the assessed object

| Requirement | Current status | Evidence |
|---|---|---|
| No production secrets | PARTIAL — `.env` holds only DATABASE_URL; 27 credential NAMES declared in `.env.example`; CI secrets unverifiable | .env census |
| No treasury credentials | YES (no custody exists) | — |
| No unrestricted signer access | **NO — the repo's git history contains the estate's controlling key (readable by the agent)** | F-0-P0-01 |
| No direct production deployment | PARTIAL — no production exists (testnet only), but the agent CAN push main directly and CAN dispatch deploys (credentials in substrate) | F-0-P0-03, F-0-P1-04 |
| No modification of critical security policy without independent approval | **NO — demonstrated channel: 38 automation commits + this program's own prior direct pushes; no CODEOWNERS; protection unverified** | F-0-P0-03 |
| Restricted repo/filesystem permissions | NO (full RW) | — |
| Network egress restrictions | NOT PRESENT (free egress incl. FX APIs, GitHub, Vercel/Inngest clients) | fx.ts et al. |
| Isolated execution environments | NO (single sandbox for code, DB, scheduler, monitoring) | F-0-P0-03 |
| Auditable actions/tool access | PARTIAL — worklog tradition + git history + plane-5 ledger; tool actions themselves unaudited | — |
| Human review of security-critical code | NOT ENFORCED (no PR requirement evidenced) | F-0-P1-04 |
| Independent authorization for sensitive ops | NOT PRESENT | — |

**"AI-generated code must not approve itself":** currently FALSE by structure — commits are authored, reviewed, and landed by the same sandbox identity (and the secret gate, while genuine, gates content leakage, not authority).

## 3. Credential management (§4.4)

- Embedded `x-access-token` push credential in `.git/config` (plaintext to any process) — no rotation procedure, no expiry inventory. [F-0-P0-03]
- 27 env credential names documented; only DATABASE_URL present locally; **CI-side provisioning unverifiable**; rotation procedures exist ONLY for the two compromised keys (documented, unexecuted).
- No secret values were reproduced in this assessment (policy followed; findings record locations/fingerprints only).
- Exposure-class observation: if any credential is found exposed, containment/rotation requires owner action outside the sandbox (documented in CRITICAL-PRIVATE-KEY-ROTATION.md pattern).

## 4. Supply chain (§5)

| Requirement | Status | Evidence |
|---|---|---|
| Protected branches | DOCUMENTED / UNVERIFIABLE | .github/BRANCH-PROTECTION.md; no in-sandbox proof |
| Required independent reviews / CODEOWNERS | **NOT PRESENT** | no CODEOWNERS file |
| Pinned dependencies / lockfile integrity | IMPLEMENTED | bun.lock tracked; `--frozen-lockfile` in runtime preflight (mismatch → repair-once → block) |
| Secret scanning | IMPLEMENTED + WIRED (fail-closed, redacted, allowlisted, unsuppressible literals for C-045-a/b) — SECURITY-TESTED at unit level; staged-only scope | .githooks/pre-commit; secret-scan.ts |
| SAST | NOT PRESENT (Slither job dead wiring — unsatisfiable trigger condition) | forge-tests.yml:103 |
| SCA / dependency vuln scanning | NOT PRESENT | — |
| SBOM | NOT PRESENT | — |
| Build artifact integrity / signed artifacts / provenance | NOT PRESENT (deploy-testnet.yml forge build has EIP-170 size gate only) | — |
| Ephemeral isolated runners | UNVERIFIABLE (GitHub-hosted assumed; no evidence accessible) | — |
| SLSA L3 target | **GAP ANALYSIS:** Build Track L3 requires hermetic, provenance-attested builds with non-falsifiable provenance; current pipeline offers no attestation, no signing, unverifiable runner identity → level: none evidenced; milestones mapped in security-phase-plan Phase 2 | — |

## 5. CI/CD reality (9 workflows — triggers & risk)

| Workflow | Trigger | Risk-relevant facts |
|---|---|---|
| ci.yml | push main / PR | secret-scan gate first (fail-closed) — good; ESLint `continue-on-error` (advisory); honest-status must be NOT-PRODUCTION-AUTHORIZED |
| backup.yml | cron 03:00 + manual | Turso dump → GitHub Release; uses TURSO_AUTH_TOKEN documented as **read-WRITE**; `contents: write` |
| deploy-testnet.yml | **dispatch-only** | sends live txs; requires DEPLOYER_PRIVATE_KEY secret; forge gates fail-closed |
| forge-tests.yml | push/PR (contracts/**) | **Slither condition can never fire** (references events the workflow doesn't declare) |
| health-probe.yml | cron */15 | pings Vercel surfaces (external hosting exists? unverifiable) |
| keeper-heartbeat.yml | dispatch-only (cron removed) | dormant; Discord alert path |
| inngest-resync.yml | push (inngest paths) + manual | mutates external Inngest registration |
| backtest-nightly.yml | cron 04:00 | FRED key; issues on failure |
| compute-engine.yml | cron 02:00 + manual | determinism harness (good control pattern); reads Turso |

**Unverifiable-from-inside set (honest):** any run history, secret provisioning, protection enablement, runner identity. All green claims in docs/worklog are self-reported. [F-0-P1-04]

## 6. Verdict

The developer/AI/CI domain is the **weakest boundary relative to its blast radius**: the agent (a §0.1-listed compromise vector) holds end-to-end authority with only content-level gates (secret-scan) standing between it and the authoritative lineage. Phase 2 exists to invert this: verified protection, CODEOWNERS, signed+provenance-attested releases, separated automation identities, and an independent review channel that the agent cannot satisfy alone.
