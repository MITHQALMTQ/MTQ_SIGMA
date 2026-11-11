# Phase 0 — Trust-Boundary Diagrams (CURRENT architecture; proposed labeled separately)

All diagrams below depict the **actual discovered system at the audited state (2026-11-11T00:2xZ)**. Proposed/undeployed elements are boxed as `[PROPOSED — NOT PRESENT]`. Legend: `===` = trust boundary; `~~>` = data flow; `[!]` = finding reference.

## 1. Current architecture & trust boundaries

```
                          INTERNET / UNTRUSTED CLIENTS
        (any visitor; no identity, no authentication anywhere in the app)
========================== TRUST BOUNDARY: NETWORK ==========================
                                   |
                     Caddy :81  (repo template: proxy -> :3000 only)
                     [!] RUNNING /app/Caddyfile (root-owned, outside repo)
                         still holds wildcard XTransformPort rule   [F-0-P2-01]
                                   |
====================== TRUST BOUNDARY: APPLICATION =========================
            Next.js dev server :3000  (UNAUTHENTICATED data plane)
             |  59 API routes (rate-limited subsets; no auth) [F-0-P1-01]
             |
   +---------+------------------+------------------+---------------+
   |                             |                  |               |
 READ-ONLY REPORTS       PILOT MONETARY ENGINE    DEVNET CHAIN NODE
 /api/chain/* /api/por    (in-process singleton    (4 co-located validators,
 /api/metrics ...          ReserveState, 4s tick)   700ms blocks, real ed25519
                           [!] unauth POST         tx signatures, mempool
                           simulate/mint|redeem     admission, BFT voting,
                           MUTATES engine+DB        faucet w/ deterministic
                           [F-0-P1-01]              PUBLIC key [disclosed]
   |                             |                  |               |
   +-------------+---------------+------------------+---------------+
                 |            writes                     writes
                 v                                              v
======= TRUST BOUNDARY: PERSISTENT STATE (local filesystem) =======
        db/custom.db (Prisma: trials, oracle, issuance...)   db/chain.db
        [!] BOTH ABSENT at audit (re-imaged 00:20Z) [F-0-P0-02]
                 |                                              |
        backups/db-snapshots/latest-{chain,custom}.sql  (git-tracked)
        [!] local tips h3941 vs origin h23811 (stale) [F-0-P0-02]
```

## 2. Identity & administrative boundaries

```
ALL COMMITS: "Z User <z@container>" (single sandbox identity)   [F-0-P0-03]
        |
================= TRUST BOUNDARY: none — single domain =================
        |
   +----+--------------------+---------------------+-------------------+
   |         |                |                     |                   |
 Sandbox   .git/config      Platform cron        AI coding agent      Deployer EOA
 operator   embeds x-access- registry (jobs       (this program):     0x3C39…c8d8c
 (root-ish  token push       522460/522457;       bash, git push,     = DEFAULT_ADMIN +
 control)   credential)      wiped 2x, manual    cron mgmt           MINTER + PAUSER on
   |        [F-0-P0-03]      re-reg observed)                        both live tokens;
   |                         [F-0-P1-05]        38 UUID-cron commits   sole owner of the
   |                                            auto-pushed to        1/1 Genesis Safe
   |                                            origin/main           0xE718…A7D0
   |                                            [F-0-P1-04]           [F-0-P0-01]
   |
   v  ALL SIX ADMINISTRATIVE DOMAINS (app, DB, scheduler, monitoring,
      deployment, recovery) resolve to THIS ONE box — no boundary exists.
```

**Correlated compromise:** the sandbox operator, any process in the sandbox (token readable from `.git/config`), the platform scheduler, and the AI agent are one effective point of compromise. Separately, the deployer EOA is a second single point for the on-chain estate — and its private key is recoverable from git history (F-0-P0-01).

## 3. Asset & authorization path (money-relevant)

```
PROPOSAL/REQUEST            VALIDATION                POLICY                APPROVAL         SIGNING              EXECUTION                AUDIT
============================ (actual running paths) ===============================================================
/api/simulate/mint  ~~>  engine invariants      (§17.7 oracle gate,   NONE — rate     none (no signing   ReserveState +      PilotTrial row +
 POST (unauth)          price band, LCR,         mintingAllowed,      limit only)      exists for pilot)   PilotTrial row      worklog/audit-trail
 [F-0-P1-01]            slippage, amount cap)   throttle)                                [SHADOW ONLY]
/api/mbg/mint-request ~~> schema/nonce/expiry,   L3 bank registry,     HMAC / API-key   none (gateway      MbzMintRequest +   worklog
 POST                    jurisdiction, daily      finality L1..L7      / bypass env    is ledger-only)    certificate rows    (fail-closed 401 now)
                         cap                    [static table]
devnet tx (any          mempool admission       BFT quorum,           wallet ed25519   validator set      chain.db tables     /api/chain/* reads,
 wallet + faucet         (sig, nonce, fee),      gov monetary-guard   key (browser     (in-process)                          state-root
 funding)                consensus engine        (21 patterns)         localStorage)                                          commitment
on-chain v1.2 op         contract state machine  onlyOwner /          deployer EOA     deployer private   Monad/Arc/          chain explorers;
 (mint, pause, fx,       invariants             role checks           (key in git      Robinhood          worklog            roles.ts live reads
 reserve vault)                                  [F-0-P0-01]           history!)        testnets                              (verified 2026-10-19)
[PROPOSED — NOT PRESENT]  V2/V3 contracts: 4-council timelocks, onlyKeeper, BM-01..16 workflow, per-tx/daily caps, DMCE — undeployed byte
code only; every council modifier carries a DEFAULT_ADMIN bypass (V3:306) [F-0-P1-03]
```

## 4. Transaction-signing flow (devnet — the only live signing path)

```
Browser wallet (seed in localStorage — user-side, low-value testnet)
   ~~> client ed25519 sign(tx)  ~~> POST /api/chain/submit
   ~~> mempool: signature verify + nonce window + fee floor  (mempool.ts:29-50)
   ~~> consensus round (4 validators, 1 process; >2/3 precommit)
   ~~> applyBlock: accounts/stakes/proposals/votes/oracle tables
   ~~> state-root commitment; SSE stream to clients
Faucet: server-side deterministic PUBLIC key (INSECURE BY DESIGN, disclosed) → 10,000 MTQD/drip, 6/min/IP.
On-chain signing: ONLY the deployer EOA (compromised-class key in git history) [F-0-P0-01].
Keeper signing [PROPOSED — NOT PRESENT]: KEEPER_PRIVATE_KEY hot key, onlyKeeper functions; RETIRED-LOCALLY.
```

## 5. Deployment & software supply-chain flow

```
Developer/AI agent (sandbox)
   ~~> git commit (pre-commit secret gate ACTIVE — .githooks wired) [control]
   ~~> git push origin main  — DIRECT, credential embedded in .git/config
       [!] no CODEOWNERS; branch protection documented but UNVERIFIABLE
       [!] 38 UUID-cron automation commits already on main (no review)  [F-0-P1-04]
   ~~> GitHub Actions (9 workflows) — existence of runs UNVERIFIABLE from inside
       deploy-testnet.yml: workflow_dispatch + DEPLOYER_PRIVATE_KEY → live txs
       [!] Slither job condition can never be true (dead wiring)      [F-0-P1-04]
       [!] ci.yml ESLint continue-on-error (advisory)
   ~~> Platform base-image refreshes — OUTSIDE repo control; source of the
       re-image state-loss incident class [F-0-P0-02]
```

## 6. Validator & consensus boundary

```
All 4 validators + faucet + governance executor + oracle observers run
INSIDE one Node process (src/lib/chain/node.ts:10-14). Keys are deterministic
public devnet keys (genesis.ts:5-8 "INSECURE BY DESIGN"). Boundary between
"validator infrastructure" and "application" therefore does not exist at
runtime; the security-relevant boundary is only the process boundary vs.
network callers, enforced by tx signature admission.
External validators: NOT PRESENT (PLANNED in architecture docs).
```

## 7. Bridge & oracle boundaries

```
Bridges: NOT PRESENT (no cross-chain escrow/lock/mint exists; token
deployments on 3 chains are independent minting estates, not bridged).

Oracle: two layers, both in-sandbox —
  (a) §17.7 TS overlay: synthetic Math.random() witnesses around real
      FX references (Frankfurter/gold-api/FRED/Yahoo via fx.ts);
      fail-closed on stale/conflict (DEGRADED pauses mint+rebalance;
      FAILED pauses all; redemption stays open — exit-first).
  (b) devnet §17.10: oracle_observe txs from ACTIVE validators only,
      ≥2 families, ≤200bp spread, ≤6-block freshness; fail-closed.
  [!] The gate that guards pilot monetary operations is a simulation
      (disclosed in-code; externally-anchored oracles NOT PRESENT).
```

## 8. Database, snapshot & recovery boundaries

```
Live DBs (db/*.db)  ===(dump threshold Δ≥60 blocks / Δ≥400 rows)==>  git-tracked
dump layer (backups/db-snapshots) === git push ==> origin/main (authoritative)
                                              |
   RECOVERY (plane-5 v3.3, on origin/main only):
   fetch → bootstrap guard (BLOCKED on unique local content → NO realign,
   /tmp telemetry only) → drift guard (ff-only/subsumption) → source-integrity
   heal → runtime preflight → db-selfheal (staged generation, sentinel
   db/ALLOW-GENESIS-RESET, forward-only, identity gate) → atomic activation
   → dual heartbeat (durable only when git synced) → execution ledger
   [!] NONE of this exists at the audited HEAD [F-0-P1-02]; local watchdog
   would restore from STALE dumps if booted (incident 2026-11-08T22:47:59Z
   class) — boot deliberately NOT performed during Phase 0.
```

## 9. Emergency containment & revocation flow

```
Currently available:
  - server kill / process control (sandbox operator)
  - git push force-protection: UNKNOWN (unverifiable)               [F-0-P1-04]
  - on-chain: setMintPaused / setProtocolStatus by deployer EOA (single
    key — the same key that is the compromise vector)                [F-0-P0-01]
  - secret rotation: documented procedures (ROLE_ROTATION.md) — NOT
    EXECUTED (blocked on owner approvals for 3+ weeks)
  - emergency signing suspension: NOT PRESENT (no signer infrastructure)
  - revocation of on-chain roles: scriptable (transfer-ownership.ts)
    but requires the same single compromised-class key               [F-0-P0-01]
[PROPOSED — NOT PRESENT]: 4/7 Emergency Council, timelocked execution,
  independent revocation authority, kill-switch with quorum.
```
