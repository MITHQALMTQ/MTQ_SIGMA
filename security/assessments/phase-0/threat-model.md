# Phase 0 — Threat Model

Method: STRIDE per trust boundary + abuse cases + economic threat modeling, scoped to the **actual** system (testnet/shadow). Attack paths with concrete steps are in `attack-path-analysis.md`; register severities in `critical-vulnerability-register.md`.

## 1. Asset-boundary STRIDE summary

| Boundary | S (spoof) | T (tamper) | R (repudiate) | I (info) | D (denial) | E (elevate) |
|---|---|---|---|---|---|---|
| Network → app (:81/:3000) | any caller IS the actor (no identity) [F-0-P1-01] | pilot state/rows writable [F-0-P1-01] | no actor identities to repudiate; trials store free-text wallet labels | full state read incl. trials/evidence | rate-limited only; several GETs unlimited [F-0-P2-01] | none exist to elevate from (floor is already "admin-less") |
| App → DBs | engine writes with no per-op authorization | dump layer protects integrity (origin-side) | audit-trail exists (Chapter-24) | — | single files; self-heal exists (same substrate) [F-0-P0-02] | sentinel files = fs-level authorization [F-0-P2-02-class] |
| Sandbox → origin/main | single push credential; commit author spoofable freely | evidence/worklog rewrite under same credential [F-0-P0-03] | git history = only ledger (rewritable if force-push possible — unverified) | repo private (assumed) | force-push/branch-lockout risk | 38 automation commits precedent [F-0-P1-04] |
| Repo history → on-chain authority | **C-045-a key literal** = permanent spoof of the entire estate owner [F-0-P0-01] | contract params/pause/vault redirect | on-chain events are attributable (good) | — | setProtocolStatus kill | DEFAULT_ADMIN bypass-by-design in undeployed V3 [F-0-P1-03] |
| Platform → sandbox | base-image refresh = the re-image substitution vector [F-0-P0-02] | whole-tree substitution observed live | worklog/ledger can be lost with tree | — | 10+ incidents; scheduler wipes | platform acts with root |
| Devnet mempool | ed25519 admission (real) | state-root commitment (real) | signed txs attributable | public chain by design | faucet drain (bounded, testnet) | gov monetary-guard real firewall |

## 2. §0.1 compromise-vector mapping (assume-breach census)

| Vector (§0.1) | Applies? | Path summary |
|---|---|---|
| Developer workstation | YES (the sandbox IS the dev env) | SPOC-1 |
| AI coding agent / tools | YES (this program) | full authority, no independent approval gate; pushes demonstrated |
| Source repository | YES | single credential; protection unverified; evidence rewrites possible |
| Dependency/package | YES | bun.lock pinned + runtime preflight enforce lockfile (control); SBOM/provenance NOT PRESENT; Slither dead |
| CI/CD runner | PARTIAL | workflows exist; runs unverifiable; deploy workflow holds chain-deploying secret |
| Deployment credential / cloud admin | YES | embedded push token; Turso write token documented |
| Wallet API / tx service | PARTIAL | keeper prototype (retired); no production wallet backend |
| Signing service / signer infra | PARTIAL | only devnet ed25519 + EOA (compromised-class) |
| Validator / consensus operator | SIM | all validators in one process, public keys |
| Bridge / operator | NO | bridges NOT PRESENT |
| Oracle / external data | PARTIAL | fx.ts real HTTP; §17.7 witnesses synthetic (Math.random) |
| Database / backup system | YES | re-image + dump substitution class; F-0-P0-02 |
| Scheduler / automation | YES | registry wipes; fires execute with sandbox authority; F-0-P1-05 |
| Governance participant | SIM | devnet gov; councils not implemented |
| Privileged administrator | YES | platform root; GitHub org admin (unverifiable) |

## 3. Abuse cases (selected, monetary-relevant)

1. **Shadow mint spam:** flood `/api/simulate/mint` within rate limits → drive pilot RR/EMERGENCY state → terminal dashboards misrepresent protocol health (reputational/reference-integrity harm; disclosed shadow scope).
2. **Bypass flip:** set `MBG_TESTNET_BYPASS=true` → unauth Mbz mint-request writes against public Hardhat-address bank.
3. **Historic key extraction:** clone repo → recover C-045-a from history → on-chain mint/pause/redirect on all three testnets, Safe takeover (owner threshold 1).
4. **Stale-boot regression:** boot substituted sandbox → self-heal restores h3941 dumps over h23811 authority → 19,870-block regression + conflicting heartbeats (incident precedent 2026-11-08T22:47:59Z).
5. **Narrative rewrite:** push credential → rewrite worklog/audit-work/evidence + force timeline consistency — poisoning the program's own record (§13.4 prohibits; nothing currently prevents).
6. **Scheduler suppression:** registry wipe or persistent "model concurrency" failures → plane-5 blind window → stale heartbeat treated as OK by future readers (fresh-heartbeat-is-not-proof rule exists in job payloads — good semantic, fragile channel).
7. **Evidence DoS:** unlimited GETs (constituency/gfb/metrics/oracle/registry/status/tests/trials) + `/api/validation` cold-path file write → tree dirty → drift-guard BLOCKED cascade (F-0-P2-01/04).

## 4. Economic threat modeling (pilot scope)

- **Integrity of the reference implementation** is the actual asset: the TS engine encodes the monetary constitution (invariants §3.5/§11.5.2/§13.4.3/§17.7/§19/§21). Unauthorized source substitution (F-0-P0-03 path) or unauth state mutation (F-0-P1-01) corrupts the reference — the program's own audits then certify modified math (the task38→46 audit lineage shows how deep surface-by-surface verification already went; that work is only as trustworthy as its input provenance).
- **On-chain testnet estate:** single-key authority (F-0-P0-01) makes "issuer risk" total but bounded to testnet value; the pending V2 deploy is blocked precisely on a fresh funded key — rotation is the economic control, unexecuted.
- **Incentive note:** no bug bounty funded; disclosure channel placeholder (F-0-P3-01) — no external incentive structure exists yet.

## 5. Monitoring-evasion & evidence-destruction threats (§3 checklist coverage)

Monitoring evasion: co-located monitor (same host/credential) — killing or editing `backups/plane5/*`, `dev.log`, `/tmp` telemetry suffices; the execution ledger is git-tracked (good) but git is the same single-credential domain. Evidence destruction: worklog/audit-work rewrite via push; re-image events themselves destroy local evidence (observed). Recovery abuse: sentinel files are filesystem artifacts — SPOC-1 can authorize its own "recovery" (design acknowledges central authorization on origin; the local-HEAD skew breaks it — F-0-P1-02).

## 6. Denial-of-service posture

Rate limits on ~40 routes; buckets absent on 9 GET routes; SSE MAX_STREAMS=20 with self-close; Upstash optional; XFF spoof accepted-residual on direct :3000; single-process substrate = one crash loop takes app+devnet+engine (watchdog exists — same substrate). Overall: best-effort, adequate for pilot scope, insufficient for any authorized-value scope.
