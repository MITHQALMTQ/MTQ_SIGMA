# MTQΣ §6 Ecosystem Audit — Open-Findings Register (Task 61b continuation)
**Compiled 2026-11-07 · research-only · sources: audit-work/task10-13 corpus + current code reads**
Staleness: FRESH = verified this session · STALE = last verified 2026-10-19→23, not re-verified today.

(Summary of the eleven areas — full detail in the primary docs cited per area.)

1. CONTRACT INVENTORY — FRESH ls: V1 pilot source; V2 canonical deployable candidate (24,314B
   bytecode, 56/56 tests, R-06); V3 reference-only (C-044); V4 registry-based UNDEPLOYED;
   MtqEcosystem historical; 3 adapters compiled NOT deployed. Deployments dir: only
   MTQSigmaV2-PENDING.json (V3_SOURCE_READY_PENDING_DEPLOY). Deployed estate (STALE task10/11
   probes): 18 EVM contracts on Monad+Arc (+Robinhood byte-twin), 2 Solana mints (current DbFjz
   u64-max @18 decimals structurally non-conformant; superseded 4saT exposed key); no deployed
   contract matches any local build. OD-36 open; canonical deploy blocked on fresh funded key
   (C-045-a compromised).
2. SOLIDITY ROLES/AUTHORITY — STALE probes: blueprint mandates 4 tiers (7/7·90d constitutional,
   DAO 48h, Risk 4/7·24h, Emergency 4/7·instant) + 5 operational roles; live reality: EVERY
   authority resolves to single deployer EOA 0x3C39…d8c (DEFAULT_ADMIN on all 7 AC modules × both
   chains, MINTER+PAUSER, role-admin everywhere). Monad Redeem holds token MINTER (N-02, proven
   code-dormant). Governor pair = unassessed surface (N-01). OD-35 VERIFIED-FAILED (Safe 1/1).
   C-041 canonical-address ambiguity (3 live MTQ tokens/chain).
3. ON-CHAIN VERIFICATION — STALE (anchors 2026-10-22/23/24: Monad 73,243,944 · Arc 68,520,264 ·
   RH 140,748,341 · Solana slot 513,885,476): cell-for-cell identical across audits; allowances
   all-zero (queried cells); Safe singleton byte-proven v1.4.1; 0 transactions ever sent. Nothing
   re-verified today — fresh read-only probes required before any claim.
4. GOVERNANCE/SAFE — genuine Safe 0xE718…A7D0 threshold 1/1 deployer, nonce 0, no modules/guard;
   Ecosystem-JSON + Robinhood "Safes" proven fake. Rotation requirements: canonical MTQ per chain
   (C-041) → constitute 7 signers → addOwnerWithThreshold ×7 + changeThreshold 4 → verify-safe
   re-verification → grant-before-revoke into Safe-B per D4 under CKPT-3..7 + RELEASE-GRANTS.
   OD-16 satisfied-by-document pending Committee approval (blocks Gate 1); OD-3 committee open.
5. ORACLE — TS engine: 5-state feed machine, ≥2-of-≥2-families quorum, §17.6 LKG, 2.5% breaker;
   app board = 18 synthetic-noise witnesses around ONE live upstream per pair (families NOT
   independent — D-13.16 open). V3 strict-3-source = SOURCE-READY NOT DEPLOYED; adapters not
   deployed; protocol-owner Oracle.sol ABIs unpublished (real-vs-mock undetermined). WIRING-1
   env-gated fallback open-to-synthetic must become fail-closed (D-13.15). TS-degraded-redeem vs
   V3 fail-closed divergence open (D-13.15). Emergency framework D-13.17 open. §17.10 devnet
   reference implementation = validator-signed medians, operator-submitted values only; production
   three-family requirement UNMET. Spec = PROPOSED v1 NOT APPROVED.
6. MONETARY MODEL — v3.0 no-conventional-reserve = owner direction; modules A–L replacement spec
   PROPOSED, gated on Gate-B D-13.3–D-13.7 (ALL OPEN). Dynamic-replacement engine QUIESCENT (never
   transitioned; pilot-approved testnet-shadow only; Gate-C ratification open). Issuance D-13.27
   ALT-4 ADOPTED-DELEGATED pending owner ratification; LEDGER-RECORDS-ONLY; fee values unapproved
   (D-13.8). OD-1/OD-2/OD-5 open (economic eligibility disabled). Test suite 253/253 last
   developer-reported 2026-10-23 (not re-run this session); D-13.26 Layer-8 review open.
7. VALIDATORS — 8 validators (4 genesis engines + 4 governance-admitted) in ONE process; genuine
   ed25519 BFT voting, +2/3 quorum, V4 dynamic membership, timelocks, time-locked unbonding.
   Limitations verbatim: REFERENCE DEVNET · NOT DECENTRALIZED · NOT PRODUCTION-AUTHORIZED; no BFT
   guarantee against process compromise; no automatic market feeds; no economic inventions;
   uMTQD test credit not gas. FRESH design docs 2026-11-05 + live height advancing 2026-11-07.
8. API/APP AUTH — ~63 routes. Upload fail-closed 403 (live-verified today); chain/submit
   client-signed (server never sees keys); faucet one-drip on-chain; Tenderly webhook HMAC 503
   fail-closed; Inngest signed; per-IP rate limits. release-controls.ts: 8 controls all
   NOT_GRANTED; grants only via owner-authored file outside git. TESTNET_READINESS Gate 5
   per-route battery = unexecuted checklist.
9. DB ADAPTERS — Prisma+PrismaLibSQL: Turso when TURSO_DATABASE_URL else local SQLite; write-behind
   git-tracked dump layer LIVE (FRESH); boot self-heal forward-only; round-trip verified today.
   Turso CI backup + Neon replica armed 2026-10-24 (runtime wiring not re-verified this session);
   off-box third copy = owner action.
10. SECRETS — C-045 (2026-10-22): EVM deployer + Solana 4saT keys REAL, fully privileged,
    treat-as-compromised (both still privileged at last anchor); repo copy deleted (≠ containment
    ≠ rotation). 2026-10-24: GitHub/Vercel/Turso/Neon credentials pasted externally — provider-side
    revocation UNVERIFIED (Gate 0 unchecked). Containment VERIFIED in worktree (0 literals; scan
    gate 12/12 tests; STALE re git-history). Git history still contains both literals (T12-1
    rewrite awaits owner + security-lead). OWNER-ATT-1 remote/CI exposure unverified. PI-3
    transcript disclosure owner-side.
11. DEPLOYMENT/RECOVERY — RUNBOOK 557 lines pilot-ops; monitoring (Sentry/Tenderly/health-probe CI);
    boot self-heal chain Tasks 42/44/47/60/61 (FRESH); plane-5 rebuilt this session as jobs
    513022 + 513021 (first auto-fire pending). Gaps: external 24/7 paging owner-side; PAUSER→Safe
    migration TODO; no production emergency-disclosure runbook; RUNBOOK explicitly pilot-ops.

OWNER DECISIONS STILL REQUIRED: OD-1 · OD-2 · OD-3 · OD-5 · OD-11 · OD-29 · OD-30 · OD-35
(execution) · OD-16 (approval) · OD-4/12/13/14/18/19/24/31 (implemented-pending-approval ×8) ·
OD-34 production confirmation · D-13.3–D-13.26 · D-13.27 ratification · Task-12 chain
(OWNER-ATT-1, T12-1, T12-3, CKPT-2..9, RELEASE-GRANTS, SOL-DEC-1/3) · 2026-10-24 credential
revocations.

TESTNET-READY CLAIM BOUNDARY: evidenced today = app/UI readability+truth layer, data layer with
verified recovery, reference devnet machinery, fail-closed controls. NOT certified = contracts
layer, monetary/economic model, governance, oracle independence, key rotation, production
deployment. Posture: TESTNET ONLY · SHADOW MODE · NOT ACCEPTED.
