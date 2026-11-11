# Phase 0 — Attack-Path Analysis

Format per path: preconditions → steps → existing control (with evidence) → residual. Severities carry testnet/shadow scope per §0.3. Register cross-ref in brackets.

## AP-01 — Historic key → total on-chain authority [F-0-P0-01] — P0
Preconditions: read access to repository (any clone / sandbox / CI checkout).
Steps: (1) extract C-045-a literal from git history (verified present at commits 2e684d9, 2da73fd); (2) import EOA 0x3C39…c8d8c; (3) call mint()/setFxRates()/setReserveVault() on v1.2 tokens on any of the 3 chains; (4) as sole 1/1 Safe owner, execute arbitrary Safe calls.
Controls: none in runtime (rotation packages D4/D5 await owner approvals; testnet-only value). Residual: complete, until rotation + history remediation. Test scenario (§15 program): T-13 single-key-share compromise — on-chain replay in isolated fork with rotated-role assertions.

## AP-02 — Credential harvest → source substitution on origin/main [F-0-P0-03, F-0-P1-04] — P0 (architecture)
Preconditions: any process in sandbox (token plaintext in .git/config) OR push-capable GitHub identity.
Steps: (1) read token; (2) push monetary-engine modification directly to main (or `--force` after rewriting history — protection unverified); (3) platform cron / CI then treats the modified tree as authoritative; (4) rewritten worklog/audit-work certifies it.
Controls: pre-commit secret gate (blocks committing NEW secret-shaped content — not authority changes); branch protection (documented, unverifiable); CI advisory. Residual: high — this is the program's own demonstrated channel (38 automation commits; agent pushes).

## AP-03 — Platform re-image → stale-state boot [F-0-P0-02] — P0 (live at audit)
Preconditions: platform base-image refresh (outside repo control; 10+ documented occurrences).
Steps: (1) refresh substitutes working lineage (observed 2026-11-11T00:20Z: 2/168 rollback, dumps h3941 vs origin h23811, db/ absent); (2) operator/automation boots app; (3) self-heal restores STALE dumps (incident precedent: 13,719-block regression on 2026-11-08T22:47:59Z); (4) divergent heartbeats/ledger poison telemetry.
Controls: origin-side plane-5 bootstrap guard (BLOCKED → no realign, no boot — verified design; absent at local HEAD); watchdog fail-closed selfheal rc1/2 (exists but on stale dumps when guard layer missing). Residual: open until lineage adjudication + head-only boot rule enforced from origin.
**Phase-0 containment decision (documented): dev server deliberately NOT started during this audit** — booting the substituted tree is itself the attack step (3).

## AP-04 — Unauthenticated monetary mutation (shadow) [F-0-P1-01] — P1
Steps: POST /api/simulate/mint (≤$1M, 12/min/IP) → applyMint on live singleton → PilotTrial row; repeat to distort reference state (EMERGENCY flip precedent in route comments). Variants: /api/issuance ledger writes; MBG with bypass env; faucet drain.
Controls: rate limits, body/amount caps, engine invariant machine (genuine), shadow-scope disclosure. Residual: state-integrity of the reference implementation; no real funds.

## AP-05 — Sentinel forgery → unauthorized "recovery" [F-0-P2-02-class] — P2
Steps: create `db/ALLOW-GENESIS-RESET` (filesystem marker) → db-selfheal re-seeds genesis over live state (the exact class the design's "central authorization" exists to prevent on origin). Controls: origin-side plane-5 authorization gate (absent locally); battery loud-notice. Residual: SPOC-1 can self-authorize locally.

## AP-06 — Scheduler registry loss / silent fire failures [F-0-P1-05] — P1
Steps: platform wipe (2× precedent) → plane-5 silent for hours (15 consecutive failed fires observed while run_count incremented); OR persistent "model concurrency" rejections → monitoring blind window.
Controls: manual re-registration (the workaround itself); monitor semantics "fresh heartbeat never proof". Residual: recurrence guaranteed until declarative manifest + post-reimage auto-validation exists (§13.3 requirement).

## AP-07 — CI secret exfiltration / live deployment by single secret [F-0-P1-04] — P1
Steps: dispatch deploy-testnet.yml (repo admin) with provisioned DEPLOYER_PRIVATE_KEY → live on-chain deployments under the compromised-class key story; or read Turso write-token from workflow context. Controls: dispatch-only trigger; forge fail-closed build/size gates. Residual: unverifiable-but-plausible; single-secret path by construction.

## AP-08 — Observation-economy attack on devnet governance [P3]
Steps: faucet-funded wallets spam proposals (deposit-gated 100k uMTQD), vote-stuffing via many faucet accounts. Controls: deposit, turnout>1/3 majority (NOT >2/3 — weaker than blueprint), **monetary-guard 21 patterns** (the real constitutional firewall, code-verified). Residual: network mechanics only; testnet credit.

## AP-09 — Oracle manipulation (internal) [P2]
External manipulation impossible-by-absence (witnesses are Math.random in-process). Insider/code path: modify oracle.ts → push (AP-02). Real external feeds (fx.ts) feed references; OU fallback on outage (fail-closed posture in engine: DEGRADED/FAILED pause ops). Residual: reference-quality only.

## AP-10 — Evidence & audit poisoning [F-0-P0-03 adjunct] — P1
Steps: rewrite worklog.md/audit-work/ (push token) → future gates read false history; OR delete plane5 telemetry files locally (re-image precedent). Controls: git history (single-credential domain), ledger on origin. Residual: tied to AP-02.

## AP-11 — DoS on pilot surface [F-0-P2-01] — P2
Unlimited GETs (9 routes) + `/api/validation` cold-path writes `src/lib/mtq/validation-results.json` into the repo tree → dirty tree → drift-guard BLOCKED → boot-anyway branch (watchdog design: "battery will shout") → availability + operational confusion. Controls: partial rate limits; cache-first validation responses. Residual: moderate.

## AP-12 — Browser wallet key theft (client) [P3]
Wallet seeds in localStorage (XSS would exfiltrate) — no value beyond devnet; disclosed. Controls: none needed at scope; noted for future custody design (§7 program).

## Path closure summary (§20 D)

| Path | Closed? | Restricted by | Open residual |
|---|---|---|---|
| AP-01 | NO | — | total on-chain authority |
| AP-02 | NO | advisory only | source substitution |
| AP-03 | PARTIAL | origin-side plane-5 (not at local HEAD) | stale boot until adjudication |
| AP-04 | PARTIAL | invariants + rate limits | reference-state integrity |
| AP-05 | PARTIAL | origin authorization (absent locally) | local self-authorization |
| AP-06 | NO | manual workaround | recurrence |
| AP-07 | UNVERIFIABLE | dispatch-only | single-secret deploy |
| AP-08 | YES (scope) | deposit + monetary guard | network-params only |
| AP-09 | N/A (sim) | fail-closed design | reference quality |
| AP-10 | NO | git history only | narrative rewrite |
| AP-11 | PARTIAL | partial limits | availability |
| AP-12 | N/A | disclosure | client scope |
