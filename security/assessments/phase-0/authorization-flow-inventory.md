# Phase 0 — Authorization-Flow Inventory

Chains follow §1.4: **PROPOSAL → VALIDATION → POLICY DECISION → APPROVAL → SIGNING → EXECUTION → SETTLEMENT → AUDIT → REVOCATION/RECOVERY**. "—" = stage has no implementing component. Each chain states reality (not design).

## F1 — Pilot mint/redeem (shadow monetary engine) — the reference monetary path

| Stage | Reality | Evidence |
|---|---|---|
| Proposal | unauth POST `/api/simulate/mint` / `redeem` (body ≤32KB; amount (0, 1e6]; rate 12/min/IP) | simulate/mint/route.ts:52-124 |
| Validation | structural schema; §17.7 oracle health gate; price band §3.5 (0.50–2.00); mintingAllowed §21.3; LCR §13.4.3; slippage §19.4.1 | engine.ts:1868-1924 |
| Policy decision | in-engine invariant machine (all above + §11.5.2 turnover truncation) | engine.ts:1493-1501 |
| **Approval** | **NONE** — any network caller (per-IP rate limit only) | **F-0-P1-01** |
| Signing | none (no actor identity exists) | — |
| Execution | `applyTrial → applyMint/applyRedeem` on globalThis singleton + `PilotTrial.create` | pilot-state.ts:705-725 |
| Settlement | shadow ledger only — "NEVER ON-CHAIN" (disclosed) | issuance headers |
| Audit | PilotTrial rows, Chapter-24 audit-trail persistence | audit-trail.ts:180,262,307 |
| Revocation/recovery | git dump layer (origin-side plane-5 recovery); no per-operation rollback | plane5 (origin) |

## F2 — MBG bank mint-request intake (institutional path)

| Stage | Reality |
|---|---|
| Proposal | POST `/api/mbg/mint-request` — auth: HMAC-SHA256 (±60s) **or** API-key hash **or** `MBG_TESTNET_BYPASS=true`+authorized bank; all three unconfigured on this host → **401 fail-closed** |
| Validation | L1 schema/nonce/expiry; L3 bank registry (sole entry: Pilot Bank A at well-known Hardhat acct #1, no apiKeyHash) + jurisdiction + daily cap |
| Policy | 7-layer finality L1..L7 (hardcoded `blocked:true` static table; finality context hardcodes `protocolState:"NORMAL", oracleHealthy:true`) |
| Approval | as per auth above; **bypass env flips it open for a public address** [F-0-P1-01] |
| Signing | none (ledger-only gateway; never touches chain) |
| Execution | `MbzBackingCertificate.create` + `MbzMintRequest.create` |
| Audit | DB rows + worklog |
| Revocation | none (records immutable rows) |

## F3 — Devnet transaction (any wallet; the only cryptographically gated path)

| Stage | Reality |
|---|---|
| Proposal | client-side wallet (browser localStorage seed) signs ed25519 tx → POST `/api/chain/submit` (rate 20/min/IP) |
| Validation | mempool admission: **signature verify, nonce window, fee floor** (mempool.ts:29-50) |
| Policy | consensus BFT round (4 validators, >2/3 precommit — consensus.ts); governance monetary-guard at `gov_submit` (21 patterns, shared.ts:341-350) |
| Approval | quorum (in-process; keys public-by-design) |
| Signing | wallet key (user-held) — genuinely independent per-account identity |
| Execution | `applyBlock` mutates accounts/stakes/proposals/votes/oracle tables |
| Settlement | state-root commitment (state.ts:646-666) |
| Audit | events table, SSE stream, `/api/chain/tx` |
| Revocation/recovery | no slashing/revocation; recovery = dump layer |

## F4 — Governance execution (devnet)

Proposal (`gov_submit`, deposit 100,000 uMTQD, ed25519) → voting (bonded-stake power, **turnout>1/3, majority-of-turnout — not >2/3**) → timelock (15s) → automatic execution at block end **if type is allowlisted** (8 network params; monetary territory constitutionally rejected). Councils-as-signers: NOT PRESENT (labels only). On-chain council timelocks: undeployed (F-0-P1-03).

## F5 — On-chain estate operations (live testnets; v1.2)

Proposal/validation/policy = contract state machine + role checks; approval+signing = **single deployer EOA** (private key in git history — F-0-P0-01); execution = txs on Monad/Arc/Robinhood; settlement = chain state; audit = explorers + roles.ts live reads; **revocation = the same single key** (transfer-ownership.ts, audit-fix-roles.ts — testnet-rehearsal only, unexecuted). Emergency: `setMintPaused`/`setProtocolStatus` — same key. Upgrade path: none (immutable by design; V2 migration pending behind fresh key).

## F6 — Software deployment (source → running app)

Proposal = code change by AI agent/developer → validation = pre-commit secret gate (ACTIVE) + CI (unverifiable; advisory lint; dead Slither) → **approval = NONE VERIFIABLE** (no CODEOWNERS; branch protection unverifiable; 38 automation commits already direct-pushed) → "signing" = the embedded x-access-token → execution = `git push origin main` (or platform cron auto-push) → settlement = origin/main + Actions → audit = git history (rewritable under single credential) → revocation = **force-push rights unknown**. [F-0-P1-04 / F-0-P0-03]

## F7 — Contract deployment (on-chain)

Proposal = forge scripts (`scripts/deploy-v3.ts`, `deploy-canonical.ts`, …) → validation = forge build/test + EIP-170 size gate → approval = **workflow_dispatch by repo admin + DEPLOYER_PRIVATE_KEY secret presence** → signing = the secret key (same compromised-class key story) → execution = live txs → settlement = chain + deployments/*.json → audit = deployment records + onchain-tests → revocation = none (immutable). [F-0-P1-04]

## F8 — Database recovery & generation activation

Proposal = regression detected (drift guard / selfheal / plane-5 battery) → validation = forward-only checks (dump strictly ahead; refuse-behind; genesis-scale floors) → policy = sentinel authorization (`db/ALLOW-GENESIS-RESET`, `db/ALLOW-GIT-REALIGN`) + central plane-5 authorization (origin-side) → approval = guard classification (BLOCKED on unique local content → NO realign) → "signing" = commit hashes/sha256 dump manifests → execution = staged generation → atomic activation → settlement = heartbeat durable only when git synced → audit = execution-ledger.jsonl, alerts.log → revocation = rollback prevention (monotonic generations; no-rollback-anchor tag). **Status: verified on origin lineage through 2026-11-10T23:31:59Z; NOT PRESENT at audited HEAD.** [F-0-P0-02]

## F9 — Scheduler operations

Proposal = job registration (manual, by agent, via platform tool) → validation = none (payload prose) → approval = none → execution = hourly agentTurn fires → audit = run_count/last_run_at (display clock +8h skewed; registration ≠ execution — 15 consecutive failed fires observed) → recovery = **manual re-registration** (registry wiped ≥2×; survived the 00:20Z re-image). [F-0-P1-05]

## F10 — Monitoring & alerting

plane-5 monitor (origin-side): observes scheduler + heartbeat + six planes; NEVER remediates; alerts relayed to IM channel; ledger append. Co-located with monitored system (independence requirement §14: not met). Sentry/health-probe: unverifiable.

## Correlated-compromise notes (§1.4)

- F1/F2 "authorization" collapses into **network reachability** (plus rate limits).
- F3's only true separation is per-wallet keys on a public testnet faucet economy.
- F5/F6/F7/F8/F9 all terminate at **one sandbox credential domain** (push token) and/or **one EOA** — two correlated single points, each sufficient alone for the §22 "one compromised identity" test.
- Two "services" never form separate boundaries by virtue of running separately: watchdog, plane-5, keeper-design, and CI all share the same credential substrate (github token / same repo).
