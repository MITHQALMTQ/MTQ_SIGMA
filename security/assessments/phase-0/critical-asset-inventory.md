# Phase 0 — Critical Asset & Authority Inventory

Release classification: **TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED** (assets below are pilot/testnet-scope; severities account for that scope per §0.3).
The ten §1.3 questions are answered per asset in condensed form (R=read, M=modify, A=authorize movement, P=policy change, V=revoke, Rec=recover, C=single-compromise effect, U=unavailability effect, I=independent integrity verification).

## A1 — On-chain monetary estate (v1.2, live testnets: Monad 10143, Arc 5042002, Robinhood)

- **What to protect:** MTQ token contracts (0x5D95…fd4a / 0x826b…63c1 / 0xA3B8…4EF0), their admin roles, mint/pause/fx/reserve-vault authority, genesis supply (1,000,000 MTQ / 1,100,000 USDC, RR 1.10), MtqEcosystem deployments.
- **R/M/A/P/V:** one EOA (0x3C39…c8d8c) holds DEFAULT_ADMIN+MINTER+PAUSER on both tokens; sole owner of 1/1 Genesis Safe 0xE718…A7D0 (nonce 0, no modules, no guard — verified 2026-10-19). Anyone can READ; the EOA can MODIFY/AUTHORIZE/CHANGE POLICY/REVOKE everything.
- **Rec:** contract redeploy + role migration scripts exist (transfer-ownership.ts, audit-fix-roles.ts) but require the same EOA.
- **C:** full on-chain authority loss (mint at will, pause protocol, redirect reserve vault) — **the controlling private key is recoverable from git history (C-045-a; commits 2e684d9, 2da73fd)** → F-0-P0-01.
- **U:** testnet-only; monetary pilot continues off-chain; low availability impact.
- **I:** /api/roles live eth_call hasRole/paused with verified-snapshot fallback (roles.ts:68-193); Safe state verified on-chain 2026-10-19; explorer-verifiable.
- **Authority path:** authorization-flow-inventory.md §5.

## A2 — Pilot monetary state (in-process ReserveState + PilotTrial/IssuanceEvent rows)

- **What to protect:** shadow-mode monetary simulation state (NAV, RR, balances, supply, policy state machine) — the reference implementation of the monetary constitution.
- **R:** engine singleton; **M/A:** any unauthenticated POST to /api/simulate/mint|redeem (rate-limit 12/min/IP only) and /api/issuance — F-0-P1-01. P:** none at runtime** (parameters are code constants — governance path undeployed). V: none. Rec: git-tracked DB dumps (origin-side, h23811 at audit).
- **C:** monetary-state distortion of the reference implementation (a large mint previously flipped pilot to EMERGENCY — disclosed in route comments); no real funds at risk (shadow).
- **U:** pilot terminal shows stale data; engine restarts from dump.
- **I:** three-way agreement checks (dumps ↔ live ↔ origin) executed by plane-5 battery (on origin only at audit); audit-trail tables.

## A3 — Devnet chain state (db/chain.db: blocks, txs, accounts, validators, stakes, proposals, votes, oracle tables)

- **R:** public APIs; **M/A:** ed25519-signed txs (any wallet; faucet-funded), governance execution (in-code timelock); faucet (deterministic public key, 10,000 MTQD/drip).
- **P:** network_param allowlist (8 params, dual-gated); **monetary guard rejects 21 pattern classes** (shared.ts:341-350) — real code-level separation.
- **V/Rec:** none on-chain-style (state-root commitment; no slashing/revocation); recovery via git dumps.
- **C:** validator compromise impossible-by-construction to separate (all validators in one process with public keys — testnet sim; disclosed). An unauth network caller can drain faucet credits (rate-limited) and spam governance proposals (deposit-gated).
- **U/I:** devnet only; integrity via state-root + dump round-trip verification.

## A4 — Cryptographic key material (inventory — no values reproduced)

| Item | Status | Notes |
|---|---|---|
| EVM deployer private key (C-045-a) | **IN GIT HISTORY** (commits 2e684d9 worklog.md; 2da73fd verify-key-and-audit-roles.ts); worktree purged; **rotation NOT executed** | F-0-P0-01 — treat as compromised (owner declaration 2026-10-24; D4/D5 migration packages await approval) |
| Solana multisig key (C-045-b) | same class — history retention declared | treat as compromised |
| Devnet validator/faucet keys | deterministic, PUBLIC by design ("INSECURE BY DESIGN", genesis.ts:5-8) | testnet-only credit, disclosed |
| Browser wallet seeds | localStorage, user-held | low-value devnet assets |
| `x-access-token` GitHub push credential | **embedded in .git/config remote URL**, plaintext-readable by any process in sandbox | F-0-P0-03; no rotation procedure observed |
| CI secrets (TURSO_*, DEPLOYER_PRIVATE_KEY, FRED, KEEPER_URL, DISCORD, INNGEST, UPSTASH, AI keys) | **existence unverifiable from inside**; .env.example declares 27 credential names; current .env holds only DATABASE_URL | F-0-P1-04 |
| Keeper hot key (KEEPER_PRIVATE_KEY) | env-only design; unset; service RETIRED-LOCALLY | F-0-P2-03 |

## A5 — Governance authority

- **What to protect:** the 4-council constitution (CONSTITUTIONAL 7/7 · DAO 51% · RISK 4/7 · EMERGENCY 4/7 — blueprint.ts:392-418) and the parameter registry envelopes.
- **Reality:** TS metadata only. The only *running* governance is the devnet's (turnout>1/3, majority-of-turnout — not >2/3) over 8 network params; monetary territory is constitutionally firewalled (21 patterns). On-chain authority = the single EOA (F-0-P1-03). No governance execution API exists for humans.
- **C:** the compromised-class deployer key IS the constitutional authority of the live estate; council bypass exists in undeployed V3 (DEFAULT_ADMIN bypass modifier).
- **I:** devnet proposals/votes are signed txs (verifiable); council claims are labels only.

## A6 — Authoritative state & recovery infrastructure

- **What to protect:** origin/main (the 168-commit authoritative lineage incl. dump layer h23811+), the plane-5 recovery contract (staged generations, sentinel authorization, forward-only rules), the execution ledger, heartbeat channel, and the git-tracked snapshot manifests (v12/v13, sha256).
- **M/A/P:** git push credential (single) can rewrite main if protection is absent (unverified) — F-0-P0-03/P1-04. Generation activation authorization = plane-5 contract + operator sentinels (db/ALLOW-*).
- **C:** a compromised sandbox can (a) push arbitrary "recovery" state to origin, (b) create sentinel files (they are filesystem markers, not authenticated identities), (c) boot stale dumps over authoritative state (the incident class — F-0-P0-02).
- **Rec:** the plane-5 chain demonstrated autonomous, validated recovery through 2026-11-10T23:31:59Z (deficit 19,613→0) — on origin/main only.
- **I:** sha256 dump verification; three-way agreement battery; independent validation from origin (v11/v12/v13 publish records).

## A7 — Scheduler & automation registry

- **What to protect:** cron job definitions (522460/522457 + their payload contracts), execution history, run semantics (registration ≠ execution).
- **Reality:** registry lives on the platform, **outside version control**; wiped ≥2× (2026-11-10 21:23Z refresh; earlier per worklog), manually re-registered each time; 15 consecutive backstop fires observed failing ("model concurrency limit exceeded") while run_count still incremented; display clock +8h skewed. F-0-P1-05.

## A8 — Security evidence & audit record

- **What to protect:** worklog.md (2MB), audit-work/ (25 deliverables incl. DELIVERABLE-H security findings, MASTER-E2E-AUDIT), backups/* manifests, incident files, this Phase-0 directory.
- **R/M:** public read via repo; modification = any push (single credential; F-0-P0-03). Evidence tamper-resistance: none beyond git history itself.
- **C:** an attacker with push rights can rewrite the security narrative (mitigated only if branch protection is real — unverified).

## A9 — Secrets pipeline & environment

- Current .env: DATABASE_URL only. `.env.example` enumerates 27 credential names (AI providers, Alchemy, QuickNode, Upstash, Sentry ×4, Tenderly, Discord, FRED, Neon, Inngest ×2, Turso ×2, DEPLOYER_PRIVATE_KEY, KEEPER_×2). `.env` never entered git history (verified `git log --all -- .env` → empty). Worktree scans show 0 compromised-literal matches. Secrets rotation procedures documented, not exercised.

## A10 — External integrations (unverified surfaces)

Vercel deployment config (vercel.json; sync route advertises `mtq-sigma.vercel.app`), Inngest Cloud, Turso, Neon, Sentry, Discord webhook, GitHub Actions — all referenced in code/config, none verifiable from inside the sandbox. Classified EXISTING/UNVERIFIED; each is an additional credential-bearing external trust surface (F-0-P1-04).

## Authority-summary (the §22 test)

> Can one compromised person/identity/device/service/credential independently cause unauthorized monetary or asset movement, change governing rules, or defeat recovery and security controls?

**On-chain estate:** YES — the single deployer EOA (key recoverable from repo history). **Pilot state:** YES (no auth) — shadow-scope only. **Protocol rules (source):** YES — single push credential, unverifiable branch protection, 38 unreviewed automation commits already on main. **Recovery/monitoring:** YES — same sandbox domain runs recovery, monitoring, and the monitored system. These four YESes define the Phase-1 architecture agenda.
