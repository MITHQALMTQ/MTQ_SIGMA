# Phase 0 — Platform Identity & Recovery Separation (13-Role Authority Design, Embedded Push-Credential Review, PLATFORM_REIMAGE_STATE_LOSS Formal Assessment)

**Document ID:** SEC-P0-IDENT-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T13:38Z (UTC) · **Workstream:** G
**Branch:** security/phase-0-review-prep @ fc9ad97 (docs-only; ancestry unchanged) · **Author role:** implementer AI-agent lineage (evidence preparer — NOT an independent auditor)
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED

> **Standing independence limitation:** prepared inside the assessed environment by the implementer's own agent lineage; all network/chain results herein are implementer-side and require independent reproduction per the reviewer handoff package (SEC-P0-HANDOFF-001). No secret value is reproduced anywhere — fingerprints, status codes, counts, and object identifiers only.

---

## 0. Directive mapping and guardrail compliance

**Assignment:** COO master directive *"P0 Security Incident Containment Readiness & Independent Security Review"* (received 2026-11-11), §8 (identity/authority separation across 13 roles; embedded Git push-token review; owner-approved rotation sequence) and §8.1 (PLATFORM_REIMAGE_STATE_LOSS — DATABASE_AND_SCHEDULER_REGISTRY formal assessment). This document extends — never contradicts — SEC-P0-ADDENDUM-001, the four prior assessment documents, and the 17-doc frozen baseline.

| Directive item | Section | Class of output |
|---|---|---|
| §8 13-role identity/authority separation design (no shared administrative root) | §1–§2 | DESIGN — documented, NOT implemented |
| §8 contrast with the single-credential-domain reality + owner-message disclosure event | §1 | Assessment of current state |
| §8 embedded push-token review without displaying any credential | §3 | Review + owner-side checklist |
| §8 owner-approved rotation sequence preserving dependent automation | §4 | PROCEDURE — documented, NOT executed |
| §8.1 PLATFORM_REIMAGE_STATE_LOSS — DATABASE_AND_SCHEDULER_REGISTRY formal assessment | §5 | Formal assessment + state-domain matrix |
| Cross-references / no-action register | §6 | Register |

Guardrail compliance (this session): one file written (this document); read-only git only (rev-parse/rev-list/merge-base/show/reflog/remote with redaction); no network request of any kind was issued for this document; no repository application code executed; no credential was read out, echoed, or used; the 2026-11-11 owner-message credential disclosure event is referenced by TYPE ONLY per briefing rule R8.

---

## 1. Current reality — one credential domain (the contrast basis)

### 1.1 Verified facts about the shared credential substrate

| # | Fact | Evidence class |
|---|---|---|
| F1 | The origin remote URL of `/home/z/my-project` embeds a GitHub credential: pattern-count `git remote get-url origin \| grep -cE 'x-access-token'` = **1**; redacted `git remote -v` shows `https://<CREDENTIAL-REDACTED>@github.com/MITHQALMTQ/MTQ_SIGMA.git` for **both** fetch and push URLs (2026-11-11T13:27Z) | [VERIFIED-FACT — redacted probe, value never reproduced] |
| F2 | The review worktree `/home/z/phase0-review-wt` (branch `security/phase-0-review-prep` @ `fc9ad97`, verified 13:27Z) resolves the **same** origin remote with the **same** embedded credential class (count = 1, redacted form identical) — every push path in the estate, including this branch's own evidence commits, authenticates through it | [VERIFIED-FACT — same redacted probe, 13:27Z] |
| F3 | The credential sits in plaintext `.git/config`, readable by any process in the sandbox; no rotation procedure, no expiry inventory existed at baseline | [HISTORICAL — developer-ai-and-cicd-assessment.md §3, finding F-0-P0-03] |
| F4 | A single git persona (`Z User / z@container`) authors everything — human work, all automation commits, and the Phase-0 evidence itself; 38 UUID-cron automation commits plus plane-5 telemetry pushes landed on `origin/main` through it with **no PR/review trace** | [HISTORICAL — SEC-P0-MGMT-001 §7.1; baseline developer-ai-and-cicd-assessment.md §2/§6] |
| F5 | No CODEOWNERS file; branch protection unverifiable from inside; CI-side secret provisioning unverifiable | [HISTORICAL — baseline developer-ai-and-cicd-assessment.md §2/§4; SEC-P0-MGMT-001 §4 [UNVERIFIED] class] |
| F6 | The re-image of 2026-11-11T00:20Z destroyed working-tree/database/scheduler-payload state but **did not rotate or disturb the embedded push credential** (F1/F2 verified after it) — the credential domain persisted straight through the state-loss event | [VERIFIED-FACT (F1/F2) + HISTORICAL (re-image, baseline recovery §1)] |

### 1.2 Baseline finding this section cites (frozen evidence)

`developer-ai-and-cicd-assessment.md` (SEC-P0 baseline, 17-doc set) §6 verdict: the developer/AI/CI domain is **"the weakest boundary relative to its blast radius"** — the agent holds end-to-end authority with only content-level gates (secret-scan) between it and the authoritative lineage; "AI-generated code must not approve itself" is **currently FALSE by structure** (commits authored, reviewed, and landed by the same sandbox identity); §2 records the agent CAN push main directly and CAN dispatch deploys. Finding F-0-P0-03 (single credential domain across all boundaries) is the register entry this document's design answers. [HISTORICAL — cited, unmodified]

### 1.3 The 2026-11-11 owner-message credential disclosure event (fresh evidence of credential concentration)

The COO owner directive message of 2026-11-11 itself contained plaintext credentials. Types only (values redacted, per briefing R8): a GitHub PAT; a Vercel token; a Turso database URL + token; a Neon Postgres URL + password; an Inngest event key + signing key. They were NOT used, NOT echoed, NOT stored by this lineage. **Rotation of all disclosed items is an owner P0 action registered in the owner decision register (SEC-P0-DECISIONS-001) — NOT performed here.** The event is registered as fresh evidence of credential-concentration risk: the same communication channel that commands the estate carried its credential set in the clear, in the same window in which the embedded push token's scope remains unexamined (§3.2). The **relationship between the embedded origin-remote token and the GitHub PAT disclosed in that owner message is UNKNOWN** pending owner-side comparison — this document does not compare values and does not use either. [VERIFIED-FACT (event registered per briefing R8) / relationship: UNVERIFIED — EXTERNAL EVIDENCE REQUIRED]

### 1.4 Why a shared administrative root is unacceptable (failure modes of the current design)

| Failure mode of the single credential domain | Consequence | Evidence anchor |
|---|---|---|
| Any process in the sandbox can read the push credential from `.git/config` | One compromise event = repo write authority (main included, protection unproven) | F3; F-0-P0-03 |
| Developer, AI agent, and CI effectively share one identity | Audit trail cannot attribute an action to a role; no role can be revoked alone | F4; baseline §2 "shared sandbox" rows |
| Platform-side automation (re-image actor, UUID-cron lineages) shares the same substrate and git config | Uncoordinated platform automation can force checkouts and commit/push under the same authority — observed live 2026-11-11T00:54:11Z/00:56:12Z | [HISTORICAL — baseline recovery §1; reflog §5.3] |
| Credential disclosure in owner channel (§1.3) while one embedded token drives all automation | Concentration: a single leaked item maps to the entire push authority, not to one scoped role | [VERIFIED-FACT event / scope: EXTERNAL EVIDENCE REQUIRED §3.2] |

The design in §2 exists to remove exactly this root: after implementation, no single credential — and no single role — can administer the whole estate.

---

## 2. Target design — identity/authority separation across the 13 roles (DESIGN; NOT implemented)

### 2.1 Design principles

1. **One role = one identity = one credential class.** No credential is shared across roles; no role can issue, revoke, or administer another role's credential class.
2. **Humans hold human credentials; automation holds scoped, revocable, short-expiry machine identities; nothing holds a standing broad token.**
3. **Signing authority is offline and quorum-based** (owner custody outside repo/sandbox/AI — per directive §1 and the rotation packages D4/D5).
4. **Issuance and revocation for every class have a distinct named owner** — revocable in one action, independent of every other class.
5. **The AI development environment (this substrate) ends up with at most a scoped, revocable bot identity for designated telemetry paths — never settings/secrets/protection administration** (the deficiency F-0-P0-03 documents is inverted).
6. Implementation is Phase-2 scope under the STOP directive — **not started**; every table below is design output, not a claim of deployed state.

### 2.2 Identity register (identity type · credential class)

| # | Role | Identity type | Credential class |
|---|---|---|---|
| 1 | Human developer | Human (named individual) | Personal GitHub account credential (fine-grained PAT or SSH) on an owner-controlled workstation |
| 2 | AI coding agent | Automation — machine service acting for the implementer | Scoped fine-grained machine PAT (bot identity), short expiry, contents-write to designated paths only; no admin scopes |
| 3 | CI automation | Machine service (workflow runner) | Ephemeral per-run job identity (OIDC) + narrowly scoped repo secrets provisioned by owner |
| 4 | Release approval | Human (gate role) | No standing credential — approval records under required-review + CODEOWNERS protection rules |
| 5 | Deployment operator | Human | Dispatch-only credential (workflow-dispatch authority), per environment |
| 6 | EVM signer administration | Human group (multi-signer quorum) | Offline / HSM-class signing material under owner custody; never in repo, sandbox, or AI environment |
| 7 | Solana signer administration | Human group (distinct custody) | Offline key-ceremony material with custody attestation (CKPT-2 class for the `DbFjz…` authority) |
| 8 | Treasury transaction policy | Machine service (policy engine) + human policy approvers | Policy-as-code authority (limits, destinations, rates); quorum-approved exceptions; no standing transfer credential |
| 9 | Recovery operator | Human (incident-scoped) | Time-boxed break-glass credential issued at incident time, auto-expiring at close |
| 10 | Database administrator | Human (owner-side) + machine service (application) | Cloud DB console identity (owner) / least-privilege app DB credential (service; schema-scoped) |
| 11 | Scheduler provisioning | Machine service (platform registry tier) | Registry control identity at the platform; job definitions declarative in-repo (manifest-pinned payloads) |
| 12 | Security monitoring | Machine service on independent owner host | Read-only mirror credentials; out-of-band alert channel; zero write access to the monitored estate |
| 13 | Independent reviewer | Human (third party) | Reviewer-owned account, environment, RPC path; no estate credentials whatsoever |

### 2.3 Scope (allowed · explicitly forbidden)

| # | Role | Allowed | Explicitly forbidden |
|---|---|---|---|
| 1 | Human developer | Feature branches, PRs, code review, docs | Direct main push; deploy dispatch; any signing; secret/settings administration |
| 2 | AI coding agent | Branch/worktree commits via scoped bot identity; telemetry pushes to designated paths only | Security-critical-path pushes without independent review; deploys; recovery-policy changes; scheduler re-registration without a second signal; signing; repo settings/secrets/protection administration |
| 3 | CI automation | Run gates (secret-scan, tests, size), build artifacts, read source on push/PR events | Persistent repo-admin tokens; direct main push; approving its own changes |
| 4 | Release approval | Approve/tag releases; required-review sign-off | Authoring what it approves (dual control); signing; deploy dispatch |
| 5 | Deployment operator | Dispatch approved testnet deploys (second-approver rule) | Source authority; signing custody; secret administration |
| 6 | EVM signer administration | Safe/role operations under the phase-5/6 authority matrix (target 4-of-7 Safe) | Single-key control; any sandbox/AI presence; use of compromised-class historical material for new operations |
| 7 | Solana signer administration | Mint/freeze authority operations for the MTQ SPL mints per the S-1…S-8 read-only checklist | Key material in repo/sandbox/AI; single-person control |
| 8 | Treasury transaction policy | Define and enforce transaction bounds (amount, destination, rate); quorum exception review | Custody of any signer material; silent bypass of its own bounds |
| 9 | Recovery operator | Execute the sanctioned forward-only restoration with lineage verification (§5.4 controls) | Signing; deploy; standing authority; history rewriting for cosmetic consistency |
| 10 | Database administrator | Schema/ops/backup policy; cloud-console administration | Writes to policy-governed monetary tables outside policy; any git push authority |
| 11 | Scheduler provisioning | Register/re-register jobs from the declarative manifest; registry integrity self-check before action | Arbitrary code execution beyond pinned payloads; repo writes; secret access |
| 12 | Security monitoring | Read-only mirror; ledger/heartbeat ingestion; out-of-band alerting | ANY write to the monitored estate; sharing a credential or host with the monitored object |
| 13 | Independent reviewer | Read, reproduce (the 9 protocols), sign-off | Push; deploy; signing; merge authority |

### 2.4 Custody — issuance/revocation owner · dependency mapping

| # | Role | Issuance & revocation owner | Depends on | Depended on by |
|---|---|---|---|---|
| 1 | Human developer | Owner (org membership; revocation = org removal) | Repo via PR; CI gate results | Release approval (authors the PRs under review); CI (runs on them) |
| 2 | AI coding agent | Owner (provisions the scoped bot; revocation = one-click bot removal — no dependence on any human PAT) | Source tree inside sandbox; designated push paths | Snapshot-publication cadence; watchdog durability channel (§4.2 sites) |
| 3 | CI automation | Platform-issued ephemeral per run; secrets owner-provisioned and rotated | Repo events; scoped secrets | Release approval (consumes gate results); deployment operator (deploy jobs) |
| 4 | Release approval | Owner (CODEOWNERS + protection rules) | Review artifacts; CI outputs | Main-lineage integrity; Gate #1 decisions |
| 5 | Deployment operator | Owner (dispatch grant) | CI gates passed; an approved release | Testnet deploy workflows (dispatch-only) |
| 6 | EVM signer administration | Owner key ceremony (CKPT-1 class); revocation = Safe reconfiguration / role renounce | Safe quorum; rotation packages D4 | Treasury policy (execution within policy); monitoring watch |
| 7 | Solana signer administration | Owner ceremony (CKPT-2 class); revocation = authority transfer | SPL mint authority state (S-1…S-8) | Treasury policy |
| 8 | Treasury transaction policy | Owner approves policy versions; service identity owner-issued | Both signer administrations (execute within policy) | Deployment operator; recovery operator |
| 9 | Recovery operator | Owner (incident grant, time-boxed; auto-revoked at close) | Lineage-pin verification (§5.4); scheduler integrity check | Nothing standing (authority expires) |
| 10 | Database administrator | Owner (cloud console + app service credential issuance/rotation) | App runtime; git-tracked backup layer | Recovery operator (restores data plane); monitoring (audit ingestion) |
| 11 | Scheduler provisioning | Owner (platform tier) | Declarative manifest on `origin/main` | Backstop/monitor cadence; durable heartbeat |
| 12 | Security monitoring | Owner (independent host + identity) | Read-only mirror; GitHub audit log; execution ledger | Owner alerting; reviewer evidence package |
| 13 | Independent reviewer | Owner (engagement/access grant) | The 9 reproduction protocols (SEC-P0-MGMT-001 §9.2) | Owner Gate #1 decision; register closure |

### 2.5 Least-privilege rationale (per role, one line)

| # | Role | Least-privilege rationale |
|---|---|---|
| 1 | Human developer | Named accountable human; changes reach main only through review — the direct-push channel that produced 38 unreviewed automation commits is closed for humans too |
| 2 | AI coding agent | The §0.1 compromise vector gets a revocable, path-scoped identity: it can keep telemetry flowing but cannot approve itself, administer settings/secrets, or dispatch deploys |
| 3 | CI automation | Ephemeral identity = no standing credential to steal; gates run where the lineage is, not inside the sandbox |
| 4 | Release approval | Integrity-bearing changes require a second human will — the control whose absence F-0-P1-04 records |
| 5 | Deployment operator | Separates "can move contracts/money on testnet" from "can change code" — today one persona holds both |
| 6 | EVM signer administration | Removes the single-EOA root the compromised key embodies; quorum custody matches the mandated 4-of-7 target |
| 7 | Solana signer administration | Same principle on a distinct chain/family (C-045-b is a separate incident); distinct ceremony, distinct revocation path |
| 8 | Treasury transaction policy | Splits "who may sign" from "what may be signed" — policy binds even valid quorum keys |
| 9 | Recovery operator | Recovery must not be a standing root: break-glass is time-boxed, single-purpose, auto-expiring |
| 10 | Database administrator | Separates data-plane administration from code-plane push authority (today one substrate holds both) |
| 11 | Scheduler provisioning | Registration ≠ execution: declarative, integrity-checked registration prevents registry loss or silent fire rejection from going unnoticed |
| 12 | Security monitoring | A monitor sharing substrate/credential with the monitored object cannot detect compromise of that substrate — independence is the control |
| 13 | Independent reviewer | Implements implementer ≠ assessor — the standing limitation printed atop every Phase-0 document |

### 2.6 No-shared-root assertion and boundary contrast

| Boundary (per baseline authority-graph) | Current basis (one domain) | Target basis (separated) |
|---|---|---|
| Developer | The embedded remote credential / sandbox OS user | Role 1 personal credential, PR-only path |
| AI agent | Same embedded credential, same OS user, full RW | Role 2 scoped bot, designated paths |
| CI | Unverifiable provisioning; same repo authority | Role 3 ephemeral identity + scoped secrets |
| Ops / monitoring | Inside the same sandbox (watchdog, plane-5) | Roles 5/12 on owner-controlled hosts |
| Signing | Single EOA root (compromised class) + platform keys in history | Roles 6/7/8 offline quorum + policy |
| Platform / scheduler | Shared substrate, registry payload-pinned only | Roles 9/10/11 owner-tier issuance |

**Assertion:** in the target design no credential class is held by more than one role (§2.2 has 13 rows and 13 distinct credential bases; only roles 6/7 share a *class pattern* — offline quorum custody — with distinct ceremonies, chains, and revocation paths), and no role can administer another role's credential. The design therefore contains **no shared administrative root**. Status: DESIGN ONLY — not implemented, not started (STOP directive). [DESIGN]

---

## 3. Embedded Git push token review (without displaying any credential)

### 3.1 What is verified from inside

| # | Item | Result |
|---|---|---|
| 1 | Presence | [VERIFIED-FACT] pattern-count = 1 for the embedded-token marker in the origin remote URL; both fetch and push URLs carry it (13:27Z, redacted form `https://<CREDENTIAL-REDACTED>@github.com/MITHQALMTQ/MTQ_SIGMA.git`) |
| 2 | Storage form | [VERIFIED-FACT/HISTORICAL] plaintext in `.git/config`; readable by any sandbox process (F3) |
| 3 | Consumers | [VERIFIED-FACT] every push call site in §4.2 authenticates through it, including this branch's evidence commits (F2) |
| 4 | Identity / scope / expiry / linkage | **UNKNOWN from inside the sandbox** — EXTERNAL EVIDENCE REQUIRED (§3.2) |
| 5 | Provenance class | [HISTORICAL] worklog Task 19 (owner directive 2026-10-24): the embedded token was replaced with an **owner-provided fresh GitHub PAT**, stored only in `.git/config`, fetch/push verified, two Actions secrets confirmed present at the time — so the token lineage is owner-provided; the specific current identity is still unknown |

### 3.2 Owner-side checklist — every item EXTERNAL EVIDENCE REQUIRED

| # | Question | Owner-side procedure (GitHub UI/API with owner account) |
|---|---|---|
| T-1 | Token identity — which token is this (classic PAT / fine-grained PAT / app token / other)? | Inspect developer settings → token list; match the redacted fingerprint the sandbox can supply out-of-band |
| T-2 | Token scope | Record the scope list (contents? workflow? admin-org? admin-repo?) |
| T-3 | Expiry | Record expiry date, or record "no expiry" as a finding |
| T-4 | Linked human or automation identity | Record the owning account (owner personal? bot? org?) |
| T-5 | Repository write permissions | Which repos/branches writable; is main included |
| T-6 | Organization administration permissions | Can it administer repo settings/members/policies |
| T-7 | Branch-protection bypass | Can it push to protected refs / dismiss protections |
| T-8 | Workflow dispatch authority | Can it trigger workflows (deploy-testnet.yml class) |
| T-9 | Secret administration | Can it read/rotate Actions secrets (deployer-key class) |
| T-10 | Audit log evidence | Pull the GitHub audit log for this token's creation, last use, and scope changes |

### 3.3 Explicit non-claims (required wording)

- The token is **NOT claimed compromised** — no evidence of that exists here.
- The token is **NOT claimed harmless** — no evidence of that exists either; until T-1…T-10 close it is treated as **indefinite repo-admin-class** (SEC-P0-MGMT-001 §7.1 wording).
- It is **NOT rotated and NOT revoked in this document** (rotation is a sequenced owner action, §4; nothing was executed).
- Its relationship to the GitHub PAT disclosed in the 2026-11-11 owner message is **UNKNOWN pending owner-side comparison** (§1.3): values are not compared and neither is used.

---

## 4. Owner-approved rotation sequence (documented — NOT executed)

### 4.1 Dependent-automation inventory (read-only grep of the review worktree, 2026-11-11T13:2xZ)

[VERIFIED-FACT — Grep for `git push` call sites across the worktree; sites listed verbatim by path:line.]

| # | Call site | Mechanism | Credential path |
|---|---|---|---|
| 1 | `scripts/plane5-run.sh:403` | Plane-5 monitor classification commit → `git push origin main` | Embedded remote credential |
| 2 | `scripts/plane5-run.sh:589` | Snapshot publication commit → `git push origin main` | Same |
| 3 | `scripts/plane5-run.sh:597` | Push-rejected retry after one guard realign → `git push origin main` | Same |
| 4 | `scripts/plane5-run.sh:608` | Non-plane5-dirty publication path → `git push origin main` | Same |
| 5 | `src/lib/boot/snapshot-manifest.ts:522` | `commitAndPushSnapshots()` → `git push origin HEAD:main` (the sole sanctioned snapshot path; v11/v12 precedent) | Same |
| 6 | `scripts/snapshot-publish.ts:143` | Invokes #5 (refuses to publish from an unadjudicated git state) | Same |
| 7 | `scripts/db-cloud-sync.ts:121–126` | Threshold publisher spawns `snapshot-publish --threshold` (write-behind cadence) | Same |
| 8 | `dev-watchdog.sh:135` | Watchdog 60s cloud-sync subloop → #7 → #5 (indirect push) | Same |
| 9 | `dev-watchdog.sh:127,169` | `git-drift-guard.ts` — fetch/classify/forward-only realign; **no push**, but fetch still consumes the credential | Same (read path) |
| 10 | Platform cron payloads `audit-work/v26-task61b-cont/evidence/plane5-job-512782-original-payload.txt` and `plane5-job-v2-payload.txt` | External orchestration backstop instructs `git add/commit/push origin main` after remediation | EXTERNAL dependent — platform tier |
| 11 | Advisory-only (no invocation): `scripts/session-open-battery.sh:54` (echo text); `src/lib/boot/git-drift.ts:566` (message string) | Not call sites — recorded to bound the inventory | — |
| 12 | Test harness: `tests/git-drift-guard-filenames.test.ts:74,80,82` | Pushes to a test-local origin, not the production remote | Test-local only |
| 13 | Runbook/manifest procedures: `backups/BACKUP-MANIFEST-2026-10-23.md:43–48`, `BACKUP-MANIFEST-2026-10-26.md:33` | Manual push instructions | Embedded credential when run by a human/agent |
| 14 | Interactive/agent pushes (incl. this branch's evidence commits, F2) | Any `git push` from either clone | Same |

Inventory status: read-only, complete as of the grep; sites at the substituted HEAD differ (plane-5/heal scripts absent there — §5.2, F-0-P1-02).

### 4.2 The sequence (owner-approved, owner-executed; documented here only)

| Step | Action | Verification gate | If executed out of order — what breaks |
|---|---|---|---|
| (a) | Inventory dependent automation **read-only** (this section: which scripts push — plane-5 publication/monitor paths, snapshot-publish chain, watchdog subloop, platform backstop payloads, interactive pushes) | Grep evidence recorded here (§4.1) | Skipping it: an unlisted dependent keeps silently using the old credential after "rotation", and the revoke step later breaks it mid-flight |
| (b) | Create a **narrowly-scoped replacement** credential — fine-grained, least privilege (contents-write to the designated paths only), short expiry, no settings/secrets/workflow admin — provisioned owner-side, never inside the sandbox | Token exists with recorded scope/expiry (T-1…T-9 answers on file) | A broad replacement reproduces F-0-P0-03 under a new name |
| (c) | **Rewire dependents one at a time**, with verification after each: per site in §4.1 update the credential source, then observe one real cycle — snapshot/telemetry push lands, `origin/main` advances by exactly the expected commit, watchdog heartbeat durable | Per-site verification record (site, time, resulting SHA) | Rewiring several at once leaves no way to tell which site failed; an unverified site can push from a stale/adjudicated-pending tree (the substituted-lineage hazard §5.4) |
| (d) | **Revoke the broad credential only after ALL dependents are verified** (GitHub-side revoke; purge substrate copies — note F6: the credential survived the 00:20Z re-image in `.git/config`, so revocation is what actually kills it, not time or re-images) | Zero remaining consumers; §4.1 table fully re-wired | Revoke-first: the watchdog/snapshot chain loses its durability channel mid-transition — publication commits accumulate in `SAFE_SNAPSHOT_AHEAD` limbo, plane-5 ledgers stop being durable, heartbeats degrade — while the shared-root exposure (§1.4) is not even closed for the other disclosed items (§1.3) |
| (e) | **Confirm via GitHub audit log** — token last-use, creation, scope history; no activity after revocation timestamp | Audit-log evidence (T-10) | Without confirmation the estate believes rotation happened without evidence — the exact honest-evidence discipline Phase 0 exists to enforce |

**Why order matters (summary):** the estate's durability automation (plane-5 publication, watchdog subloop) is itself a dependent of the credential being replaced; destroying the credential before dependents are migrated trades a security exposure for an availability regression that the automation's own suppression patterns (`|| true`, AF-05 class) would hide. Sequencing (a)→(e) closes the exposure **without ever widening the outage window and without leaving the shared credential with unrestricted authority indefinitely** — the broad token's lifetime is bounded by the verification milestones, not by convenience.

**No action taken:** nothing rotated, revoked, re-wired, or provisioned by this document; the sequence is owner procedure only (also required by briefing R5 and directive §1: no new credentials in the AI environment).

---

## 5. PLATFORM_REIMAGE_STATE_LOSS — DATABASE_AND_SCHEDULER_REGISTRY (directive §8.1 formal assessment)

### 5.1 Event and class

Event: 2026-11-11T00:20:14Z platform re-image of the sandbox. Classification: **PLATFORM_REIMAGE_STATE_LOSS — DATABASE_AND_SCHEDULER_REGISTRY**. It is the ≥10th member of the re-image/state-loss incident class [HISTORICAL — recovery-and-state-integrity-assessment.md §3 timeline, 2026-10-26 → 2026-11-11]. The class is recurring, externally caused (platform tier above the sandbox), and only partially preventable from inside.

### 5.2 State-domain difference matrix (before vs after the 00:20Z re-image)

| State domain | Before (last verified healthy, 2026-11-10T23:31:59Z) | After (00:20Z re-image, observed 00:23:11Z) | Evidence | Current standing |
|---|---|---|---|---|
| Repository state | Local main == `origin/main` @ `926ee00`, pushed; cloud layer durable; worklog continuity current | Local main = substituted `d6fd5d6` (2 ahead / 168 behind, merge-base `ff67aa2`); local origin/main ref stale at `ff2d385` until the Phase-0 fetch restored `926ee00` | [HISTORICAL baseline §1; VERIFIED-FACT rev-parse/rev-list 13:27Z = same topology still] | Substitution frozen; no boot, no realign (containment) |
| Working-tree state | Lineage-B checkout healthy: server 200, upload 403 fail-closed, browser E2E green, watchdog alive | `.git` restored to a mid-session frozen snapshot; `db/`, `dev.log`, watchdog absent; `.env` regenerated (50 bytes); **the original private evidence workdir `/home/z/phase0-review-tmp` was destroyed** — the one-off history-scan harness + raw redacted output LOST (verified absent 11:37Z; recreated 11:42Z; digests UNRECORDABLE from this substrate) | [HISTORICAL baseline §1; SEC-P0-MGMT-001 §2.2; SEC-P0-ADDENDUM-001 §10.2 evidence-loss record] | Still inert; `db/` and `dev.log` verified absent now [VERIFIED-FACT Glob 13:2xZ] |
| Database state | chainTip h23846 · customRows 129,692 · deficit 0 (23:31:59Z heartbeat) | Live DBs deleted; dump tips h3941/12,395 vs origin h23811/129,583 → ≈19,870-block deficit exposure had a boot occurred | [HISTORICAL baseline §1; §2 of same for the 22:47:59Z stale-dump regression class] | Not booted — no restore attempted (§5.4 controls govern any future one) |
| Generation-store state | Recovery generation ACTIVATED 23:04:16Z; snapshot v12 published + independently validated (23:18Z, commit `0f7b10a`) | `backups/plane5/heartbeat.json` absent; execution ledger at substituted HEAD holds exactly ONE entry — 16:56:44Z monitor run, outcome BOOTSTRAP-FAILED, guard BLOCKED on genuine unique local content | [HISTORICAL worklog 2026-11-10T23:04–23:25Z; SEC-P0-MGMT-001 §2.2; ledger file present now — VERIFIED-FACT LS 13:2xZ] | Recovery machinery exists on the origin lineage only |
| Scheduler state | Jobs 522460/522457 armed (hourly cadence; registry wiped twice earlier that day, re-registered 22:1xZ) | Registry survived this instance (jobs enabled); 00:17:48Z backstop fire incremented run_count with **no relay, no telemetry** — registration ≠ execution | [HISTORICAL baseline §1/§4; worklog 2026-11-10 entries] | Current registration state not re-probed this session [UNVERIFIED — platform-tier evidence required] |
| Environment identity | `.env` held DATABASE_URL; `/tmp/cloud.env` credentials already wiped by the 00:18:23Z base-image refresh; git persona `z@container` | `.env` regenerated 50 bytes; OS user unchanged; **embedded push credential persisted in `.git/config` (F1/F6)** — identity substrate survived the state loss | [HISTORICAL baseline §1, worklog 2026-11-10 00:18Z entry; VERIFIED-FACT F1] | The credential domain is the one state that re-images do NOT lose — this is why §4 rotation is owner-side |
| Platform bootstrap state | Watchdog v5 chain + plane-5 contract operative on the origin lineage | Platform processes started 00:20:14Z (root-owned `/tmp/boot-timeline.log`: "Project initialization check", "Git setup", "custom dev script", …); substituted HEAD lacks source-integrity-heal and plane-5-run.sh → a boot would restore STALE dumps (F-0-P1-02) | [HISTORICAL SEC-P0-MGMT-001 §2.2; VERIFIED-FACT absence of those scripts at the substituted tree, Glob 13:2xZ] | No application boot performed; adjudication deferred to the approval gate |

### 5.3 Substituted-lineage reflog (read-only inspection — `git -C /home/z/my-project reflog --date=iso \| head -25`, executed 2026-11-11T13:27Z)

[VERIFIED-FACT — reflog entries quoted by timestamp + short SHA only.]

| Reflog entry (time · SHA · operation) | What it shows |
|---|---|
| `00:57:23 · d6fd5d6 · checkout: security/phase-0-baseline → main` | The main clone was left ON the substituted main at session end — current state F-verified |
| `00:57:09 · ff59515 · commit: phase-0 addendum` | Commit message records: concurrent platform automation **forced `git checkout main` twice during evidence preservation (00:54:11Z, 00:56:12Z — reflog-verified)**; local main restored to substituted ground truth; `origin/main` untouched `926ee00`; live corroboration of F-0-P0-03 (shared administrative substrate) |
| `00:54:11 · 29581df · commit: Phase 0 forensic baseline (17 deliverables)` | The branch-only baseline commit — main untouched by it |
| `00:54:06 / 00:54:11 / 00:55:55 / 00:56:12 · checkouts main ↔ baseline` | The interference window itself — uncoordinated platform-side git activity inside the evidence-preservation session |
| `2026-11-10 16:56:54 · d6fd5d6 · commit: c8cbcc8c-…-cron` | The substituted lineage tip IS a UUID-cron telemetry commit — a second agent lineage frozen into the image at 16:56Z (baseline §1 corroborated) |
| `2026-11-07 22:37:38 · 9fe4058 · commit (amend): task46` (+ 9c3ead3/0552ab5/1254c4c amend chain) | The stale amend-history objects of the parallel workstream — the incident-#8/#9 signature |
| `2026-11-06 12:49:35 · ff67aa2 · commit: task45` | The merge-base of substituted vs authoritative main |
| `2026-11-06 12:02:49 · 4fe4528 · reset: moving to origin/main` | Prior sanctioned forward-only realignment precedent (guard-class, not a rewrite) |

### 5.4 Prevention controls — fail-closed lineage pinning (mechanism to keep stale state from becoming authoritative)

**Plain statement:** recovery — restoring state after a loss — must not be mistaken for prevention — controls that stop the loss (or its stale artifacts) from becoming authoritative again. The estate's recovery tooling is battle-tested (forward-only, hash-verified, sentinel-gated); the incident count in §5.1 is what recovery-only posture buys. The following are the prevention mechanisms the design requires before any write/bootstrap:

| # | Control | Mechanism (fail-closed) | Prevents | Current status |
|---|---|---|---|---|
| P-1 | Lineage pin before any write/bootstrap | `git fetch` then verify `origin/main == approved SHA` (currently `926ee00`); bootstrap guard BLOCKS on genuine unique local content — no realign, no commit, no push | A substituted lineage becoming authoritative through automation | Present on the origin lineage (plane-5 contract); **absent at the substituted HEAD** [HISTORICAL F-0-P1-02; VERIFIED-FACT absence 13:2xZ] |
| P-2 | Scheduler registry integrity check before action | Verify expected jobs from a declarative manifest AND last-successful execution (not registration alone) before any registry-dependent action; alert on fire rejection | Registration ≠ execution silently persisting (15 consecutive rejected fires; run_count increments with no relay) | Partial — plane-5 heartbeat records it; no independent check exists [HISTORICAL baseline §4; F-0-P1-05 OPEN] |
| P-3 | Recovery-generation activation requires preserved source provenance | Activate a staged generation only with its source SHA/provenance chain intact; orphaned entries recovered verbatim with provenance notes (commit `449b018` / `926ee00` precedent) | A stale dump (h3941-class) being restored over fresher truth (the 2026-11-08T22:47:59Z regression class) | Verified-capable on origin lineage (v11→v12 activation sequence) [HISTORICAL baseline §2/§6] |
| P-4 | Watchdog must refuse substituted lineage | Pre-boot drift guard runs BEFORE source-integrity heal; realign only with content-subsumption proof; refuse-behind dumps; otherwise refuse to boot | A stale boot restoring stale dumps (F-0-P1-02's exact failure mode) | Watchdog v4/v5 order correct on origin lineage; the substituted tree would boot unguarded — it has NOT been booted [HISTORICAL baseline §2; VERIFIED-FACT inert] |

Prevention additionally requires owner-tier actions no sandbox control can substitute: attribution of the re-image actor (platform-side audit, SEC-P0-MGMT-001 §6.2), the isolated-environment precondition (§6.3-1), and the credential separation of §2 (so the platform substrate no longer shares the estate's git authority).

### 5.5 Honest capability statement

Recovery from data-layer loss: strong and demonstrated. Recovery from lineage substitution: guarded (P-1) but operator-dependent. Recovery from registry loss: manual (re-registration ×2 on 2026-11-10). Prevention (P-1…P-4 plus owner-tier actions): partially implemented on the authoritative lineage, **absent at the substituted HEAD, and not reinforced by any scheduler-manifest or isolation change yet** — none of it is closed by this document. [HISTORICAL — baseline §6, extended by §5.2–§5.4 above]

---

## 6. Cross-references and no-action register

### 6.1 Cross-references

| Document | ID | Used herein for |
|---|---|---|
| `developer-ai-and-cicd-assessment.md` (baseline) | — | §1.2 shared-credential-domain finding F-0-P0-03, AI-isolation table, §6 verdict |
| `recovery-and-state-integrity-assessment.md` (baseline) | — | §5 substitution table, incident timeline §3, scheduler verdict §4, capability statement §6 |
| `public-object-exposure-and-review-addendum.md` | SEC-P0-ADDENDUM-001 | §5.2 evidence-loss record (the `/home/z/phase0-review-tmp` destruction of the original scan harness + output, §10.2 of that doc) |
| `owner-p0-decision-register.md` | SEC-P0-DECISIONS-001 | owner P0 action: rotation of all disclosed credential items (§1.3); token audit T-1…T-10 |
| `p0-evidence-preservation-register.md` | SEC-P0-EVIDENCE-001 | preservation/custody chain for the evidence this assessment cites |
| `evm-key-compromise-containment-readiness.md` / `solana-key-compromise-containment-readiness.md` | SEC-P0-EVMCR-001 / SEC-P0-SOLCR-001 | signer-administration roles 6/7 custody context (CKPT classes) |
| `boot-chain-source-integrity-review.md` | SEC-P0-BOOT-001 | AF-05 suppression semantics referenced in §4.2 failure modes |
| `independent-security-reviewer-handoff.md` | SEC-P0-HANDOFF-001 | reproduction requirements for §7 commands |
| `management-containment-and-review-plan.md` | SEC-P0-MGMT-001 | §7 eight-authority design this 13-role design extends; §6.3 restoration procedure; §2.2 posture facts |
| `wallet-and-signing-assessment.md` / `authority-graph.md` (baseline) | — | six-boundary single-domain basis; signer custody context |

### 6.2 No-action register (explicit)

| Candidate action | Status |
|---|---|
| Rotate or revoke the embedded push token (or any disclosed credential) | **NOT performed** — owner sequence §4.2 documented only |
| Rewire any dependent automation to a new credential | **NOT performed** — inventory §4.1 read-only |
| Provision any new credential/private material in the AI environment | **NOT performed** — prohibited (directive §1) |
| Boot, realign, reset, or clean the substituted checkout | **NOT performed** — frozen; adjudication at the approval gate |
| Scheduler re-registration or any registry mutation | **NOT performed** |
| Use of any credential, live route, or state-changing call | **NONE — read-only git/Glob/Grep probes only** |

### 6.3 Final status

```
PHASE 0 — IDENTITY & RECOVERY SEPARATION DESIGN + STATE-LOSS FORMAL ASSESSMENT
F-0-P0-03 SINGLE CREDENTIAL DOMAIN — OPEN; ROTATION SEQUENCE DOCUMENTED (OWNER-EXECUTED ONLY)
PLATFORM_REIMAGE_STATE_LOSS — DATABASE_AND_SCHEDULER_REGISTRY — ASSESSED; PREVENTION CONTROLS PARTIAL (ORIGIN LINEAGE ONLY)
PHASE 1 — NOT AUTHORIZED
TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED
```

---

## 7. Read-only reproduction commands (independent reviewer)

```bash
# Embedded-token presence (count-only; NEVER print the URL unredacted):
git -C /home/z/my-project remote get-url origin | grep -cE 'x-access-token'   # expect 1
git -C /home/z/my-project remote -v | sed -E 's#://[^@]+@#://<CREDENTIAL-REDACTED>@#'
git -C /home/z/phase0-review-wt remote get-url origin | grep -cE 'x-access-token'   # expect 1 (shared domain)

# Substituted topology + reflog (read-only):
git -C /home/z/my-project rev-parse HEAD origin/main                            # d6fd5d6… / 926ee00…
git -C /home/z/my-project rev-list --left-right --count main...origin/main      # 2  168
git -C /home/z/my-project merge-base main origin/main                           # ff67aa2…
git -C /home/z/my-project reflog --date=iso | head -25                          # §5.3 entries

# Absence checks at the substituted tree (F-0-P1-02 posture):
ls /home/z/my-project/db /home/z/my-project/dev.log 2>&1                       # absent
ls /home/z/my-project/scripts/plane5-run.sh /home/z/my-project/scripts/source-integrity-heal.ts 2>&1  # absent

# Push call-site inventory (read-only):
rg -n 'git push' /home/z/phase0-review-wt/scripts /home/z/phase0-review-wt/src /home/z/phase0-review-wt/dev-watchdog.sh
```

Owner-side (outside the sandbox, with the owner account): T-1…T-10 of §3.2; rotation sequence §4.2; GitHub audit-log confirmation (e). None of the above commands mutates state, displays any credential value, or contacts any endpoint.
