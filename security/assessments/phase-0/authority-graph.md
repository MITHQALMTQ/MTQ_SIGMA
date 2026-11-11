# Phase 0 — Authority Graph

## 1. Identity inventory (every actor that holds authority)

| Identity | Type | Holds authority over | Independent? |
|---|---|---|---|
| Sandbox user `z` (host `c-6af3b4be…`) | OS account | filesystem, processes, secrets-in-files, git | root platform above it |
| `Z User <z@container>` (git author) | git identity | all commits in BOTH lineages (single author) | none — it is the only committer |
| `x-access-token` in `.git/config` | push credential | origin/main (push; force-push rights unknown) | none — one token for all pushes incl. automation |
| Platform scheduler (cronjob-gateway-prod) | automation control | job registry (survived latest re-image; wiped 2× before), agentTurn fires | separate platform, but fires execute IN the sandbox with sandbox credentials |
| AI coding agent (this program) | privileged executor | bash, filesystem, git push, cron tool, subagents | none — operates as the sandbox user |
| Deployer EOA `0x3C39…c8d8c` | on-chain key | DEFAULT_ADMIN+MINTER+PAUSER both live tokens; sole owner of 1/1 Safe 0xE718…A7D0 | on-chain-independent; **key recoverable from repo git history (C-045-a)** |
| Devnet faucet key | deterministic public | testnet credit issuance (10,000 MTQD/drip) | public by design (disclosed) |
| Browser wallet seeds | user-held | devnet txs per account | per-user, low-value |
| GitHub org admin (outside) | platform admin | branch protection, Actions, secrets, repo deletion | unverifiable from inside |

## 2. Authority matrix (who can do what)

| Operation | z (OS) | push token | scheduler | AI agent | deployer EOA | anyone (net) |
|---|---|---|---|---|---|---|
| Read all source & evidence | ✔ | ✔ | — | ✔ | — | ✔ (repo) |
| Modify monetary engine source | ✔ | — | — | ✔ | — | — |
| Land source on origin/main | (via token) | ✔ direct push | ✔ (38 cron commits already) | ✔ | — | ✖ |
| Start/stop app & watchdog | ✔ | — | (fires agent only) | ✔ | — | — |
| Wipe/restore DBs | ✔ (sentinels are files) | — | — | ✔ | — | — |
| Create authorization sentinels (ALLOW-*) | ✔ | — | — | ✔ | — | — |
| Mutate pilot monetary state | — | — | — | — | — | ✔ (unauth POST) |
| Write Mbz requests | — | — | — | — | — | ✔ if bypass env set |
| Devnet txs / faucet drain | — | — | — | — | — | ✔ (sig-gated, faucet-funded) |
| On-chain mint/pause/redirect vault | — | — | — | — | ✔ (single key) | ✖ |
| Deploy contracts on-chain | (via CI secret) | (dispatch+secret) | — | — | ✔ | ✖ |
| Re-register scheduler jobs | — | — | ✔ | ✔ | — | — |
| Rewrite security narrative (worklog/audit-work) | ✔ | ✔ (push) | — | ✔ | — | — |

## 3. Correlated compromise clusters (a service is not a boundary because it runs separately — §1.4)

**Cluster A — "the sandbox":** OS user + git identity + push token + AI agent + watchdog + plane-5 (origin) + scheduler fires. Any single compromise of the sandbox host/process gives the whole column. This cluster can: substitute source on origin, boot stale state, create authorization sentinels, re-register or rely on cron, and rewrite evidence. **Single point of compromise: YES.** [F-0-P0-03]

**Cluster B — "the deployer key":** one EOA = all on-chain authority across three chains + the 1/1 Safe; the key is recoverable from git history (i.e., from Cluster A's substrate). **The two clusters intersect: owning the repo ⇒ owning the chain estate.** [F-0-P0-01]

**Cluster C — "public pilot surface":** unauthenticated POSTs (simulate/issuance, latent MBG bypass, faucet) — no identity needed at all; bounded by rate limits and shadow-scope disclosure. [F-0-P1-01]

## 4. Single points (§1.5)

| ID | Kind | Element | Effect if compromised/unavailable |
|---|---|---|---|
| SPOC-1 | COMPROMISE | sandbox host / AI agent session | authority over source, DB, scheduler, monitoring, recovery, evidence (all domains) |
| SPOC-2 | COMPROMISE | push credential (embedded in .git/config) | origin/main rewrite (branch protection unverified) |
| SPOC-3 | COMPROMISE | deployer EOA (key in git history) | full on-chain testnet authority |
| SPOC-4 | COMPROMISE | platform scheduler (single registry) | automation loss OR rogue automation (fires act with sandbox rights) |
| SPOF-1 | FAILURE | origin/main (single authoritative remote, single GitHub org) | authoritative state, recovery manifests, and evidence all lost together |
| SPOF-2 | FAILURE | single SQLite files + single dump layer | monetary/devnet state unavailable |
| SPOF-3 | FAILURE | single sandbox process (app+engine+validators+oracle in one Node process) | entire pilot + devnet down (self-heal exists but same-substrate) |
| SPOF-4 | FAILURE | platform base-image pipeline (outside control) | recurring state-loss incidents (10+ documented) |

## 5. Independence verdicts (§6.2-style separation, current state)

| Required separation | Status |
|---|---|
| App vs transaction-policy engine | policy engine NOT PRESENT |
| Signing infra vs app | no signing infra (pilot); devnet keys public-by-design; on-chain single key |
| Monitoring vs monitored | **NOT SEPARATE** (plane-5/watchdog co-located; Sentry unverifiable) |
| Recovery authorization vs runtime | sentinel files (fs-level) + plane-5 (same substrate) — no independent authority |
| Policy configuration change vs signer | n/a (no signer); config change = code push (single credential) |
| Audit records vs audited systems | git history — same credential domain (tamper-resistance unverified) |
| Scheduler vs scheduler-observed | same platform, display-clock skew; fires execute in-band |

## 6. Graph conclusion

The authority graph is a **star with two centers** (sandbox credential domain; deployer EOA) and a fully **public leaf layer** (pilot APIs). Every defense currently claimed by the program (branch protection, CI gates, rotation packages, council timelocks) either lives outside the verifiable substrate or is NOT PRESENT at runtime. Phase 1 must convert this star into separated authority domains; the phase plan (security-phase-plan.md) sequences exactly that.
