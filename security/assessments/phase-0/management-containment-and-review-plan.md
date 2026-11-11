# MTQΣ Phase 0 — Management Containment & Independent Review Plan

**Program:** MTQΣ Network — Sovereign Security Architecture (assume-breach) · **Phase:** 0 closeout — P0 containment & review preparation
**Document ID:** SEC-P0-MGMT-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T02:3xZ (UTC)
**Prepared by / under:** AI coding-agent lineage operating the shared sandbox, per COO directive *"Phase 0 Acceptance, P0 Containment and Independent Review"* received 2026-11-11T02:1xZ.
**Release classification (unchanged):** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED.

> **Self-assessment limitation (standing, §19):** Phase 0 and this plan were authored by the same AI-agent lineage that operates the assessed environment. *Implementer ≠ assessor is NOT satisfied.* Every substantive claim below is therefore labeled with its evidence class (§4) and is subject to the independent reproduction protocols in §9. **No P0 finding is claimed resolved.** Resolution requires independently verified evidence (COO directive, final clause).

---

## 0. Purpose, scope, and authorization boundary

This document is the COO-mandated management deliverable for Phase-0 acceptance. It **prepares** containment, restoration, disclosure, and review procedures. It does **not** authorize execution of any of them. Specifically, under the COO STOP directive and this plan:

- Phase 1 and broad security implementation are **NOT authorized** and have not begun.
- The evidence branch is **NOT merged** into main; the substituted checkout is **NOT booted**; the stale lineage is **NOT** reset, rebased, cleaned, or overwritten.
- The historical compromised private key is **NOT** exposed, regenerated, imported, or used; **no new private keys or credentials are placed in the AI development environment.**
- No application, monetary, deployment, database, or signing behavior is changed by this deliverable. The only mutation attributable to this work is the addition of this file (docs-only), committed from an isolated worktree branched from authoritative `origin/main` (see Appendix B).
- Key generation, funding, signing, transfer, role migration, and Safe modification are owner-executed operations. They are specified here as procedures only (§5).

---

## 1. Immediate containment recommendations (in force now)

1. **Freeze the substituted state.** Local `main` = `d6fd5d6` (2 ahead / 168 behind `origin/main`; §2). Do not boot, do not realign, do not mutate. The plane-5 bootstrap guard's own contract (BLOCKED on genuine unique local content — no realign, no commit) is the operative interim control. **Status: HELD (verified this session).**
2. **Evidence preservation.** Evidence branch `security/phase-0-baseline` pinned at `ff59515852053f197ddd725b7bc4107d63a0d589`; `origin/main` pinned at `926ee00` — both frozen by directive; no merge/rewrite/deletion. **Status: HELD.**
3. **Treat the historical deployer EOA key as compromised — operational posture, effective immediately.** The old key must not be *used* for any new operation by anyone pending rotation (P0-01, §5). This is the known-compromised-key containment that is **not deferred** to Phase 3: the *posture and verification* are immediate owner actions; the *migration execution* sequence remains §5 Phase C/D pending owner authorization. **Status: DOCUMENTED, owner enforcement required (the sandbox cannot enforce what it cannot control — it can only refrain, which it does).**
4. **No further public publication of unremediated exploit detail.** This plan deliberately omits exploit specifics beyond what the already-public Phase-0 register contains; no secret values or key material are reproduced anywhere in it. **Status: HELD.**
5. **Scheduler containment posture.** Plane-5 jobs 522460/522457 remain registered (their payload definitions are themselves review evidence); fires under the current divergence degrade to guard-BLOCKED relays (no boot, no commit, no push — verified semantics, §13). Autonomous remediation/push operations are suspended while the substitution stands. **Status: HELD (protocol in §13).**
6. **Owner immediate actions (no sandbox involvement):** (a) GitHub-side audit of the embedded push credential (scope/expiry/identity/admin — §7); (b) current read-only on-chain role verification (§5 Phase A); (c) disclosure-containment decision (§8); (d) platform-side audit of the re-image actor (§6.2). Each is elaborated below with its required approval.

---

## 2. Situation summary — verified current state

All items below are **[VERIFIED-FACT]** unless labeled otherwise (classification discipline: §4).

### 2.1 Git topology (observed 2026-11-11T02:19Z)

| Object | Commit | Role | State |
|---|---|---|---|
| `origin/main` | `926ee001e70e404dd3ea870c37f4786524458517` | authoritative main | untouched through Phase 0 and this deliverable |
| `security/phase-0-baseline` (origin) | `ff59515852053f197ddd725b7bc4107d63a0d589` | Phase-0 evidence (17 docs + addendum) | frozen; commits `29581df` → `ff59515` |
| local `main` | `d6fd5d6` | substituted checkout (re-image of 2026-11-11T00:20Z) | not booted; divergence 2 ahead / 168 behind; merge-base `ff67aa2` (task45, 2026-11-06T12:49Z) |
| local unique commits on substituted main | `9fe4058` (task46) + `d6fd5d6` (UUID-cron telemetry, 2026-11-10T16:56:54Z) | preservation required by restoration procedure | `9fe4058` preserved at `origin/backup-incident10-amend` (`9fe40589fdff…`); `d6fd5d6` recoverable verbatim from the object database; both must be re-verified during restoration (§6.3) |

### 2.2 Environment posture (substituted checkout — deliberately inert)

- Platform boot chain started 2026-11-11T00:20:14Z (`/tmp/boot-timeline.log`, root-owned): steps include *"Project initialization check"* (21 s), *"Extracting official skills to project"*, *"Rewriting lockfile registry"*, *"Restoring zcode state"*, *"Git setup"*, *"custom dev script"*. **[VERIFIED-FACT — process-level log]** The actor behind the git-checkout interference is **[HYPOTHESIS]** (§6.2).
- No application boot: `dev.log` absent; no next/watchdog processes; `db/` absent (live databases deleted by the re-image); `backups/plane5/heartbeat.json` absent; `scripts/plane5-run.sh` absent locally (cron payload falls back to the origin-sourced script — §13).
- `backups/plane5/execution-ledger.jsonl` at the substituted HEAD holds exactly **one** entry: monitor run 2026-11-10T16:56:44Z (parallel agent lineage `c8cbcc8c`), outcome `BOOTSTRAP-FAILED` — guard `BLOCKED: genuine unique local content. NO realign.` — corroborating that even the substituted lineage's own automation hit the guard, correctly.
- Local origin-tracking ref was stale (`ff2d385`, frozen ~16:17Z fetch state) until the Phase-0 audit's fetch restored `926ee00` — **[VERIFIED-FACT, evidence-index §1]**.
- **Interference events during evidence preservation** (reflog, exact): 2026-11-11T00:54:11Z and 00:56:12Z — working tree forced from the evidence branch to `main` twice, seconds after each auditor correction. Detected and contained within ~60 s; no Phase-0 content lost; `origin/main` untouched. **[VERIFIED-FACT events / HYPOTHESIS attribution]**

### 2.3 Last verified healthy runtime state (historical reference line)

2026-11-10T23:31:59Z: plane-5 heartbeat OK (chainTip h23846, customRows 129,692, deficit 0), server 200, upload route 403 fail-closed, origin/main `926ee00` pushed, browser E2E green. **[HISTORICAL — prior-session telemetry; the current sandbox is NOT that state.]**

### 2.4 Register status

P0×3 · P1×5 · P2×5 · P3×3 — **none closed** (§11). The three P0s: F-0-P0-01 (key-in-history ↔ key-in-control, OWNER-BLOCKED), F-0-P0-02 (re-image substitution class, PARTIALLY-CONTAINED — origin-side chain verified, absent at substituted HEAD), F-0-P0-03 (single credential domain, OPEN).

---

## 3. Evidence status and chain of custody

- **Authoritative anchors:** evidence branch `security/phase-0-baseline` @ `ff595158…` (17 documents + addendum, Appendix A manifest with blob hashes); `origin/main` @ `926ee00`. Both pushed to the public remote (`github.com/MITHQALMTQ/MTQ_SIGMA`) — durable custody is the origin refs, not local state.
- **Access protocol for reviewers (read-only, non-destructive):** clone the public repository; `git checkout security/phase-0-baseline` (or `git show ff59515:<path>`) — never merge into `main`, never rewrite, never delete. Pin verification: `git rev-parse` both refs against this document.
- **Private evidence copy + chain of custody (OWNER ACTION, §8.3):** clone both refs into owner-controlled storage before any public-visibility change; custody log template: timestamp · actor · operation · ref + blob hashes (Appendix A) · storage location · hash of the copied bundle.
- **Tamper-evidence:** the 17-document manifest in Appendix A pins each file by path + git blob SHA-1 + size at `ff59515`. Any future divergence from these hashes is detectable by any reviewer with one command.
- **Prohibition (directive §1, restated as procedure):** no reset/rebase/clean/overwrite of the forensic evidence; no boot of the substituted `d6fd5d6` checkout; no exposure/regeneration/import/use of the historical compromised key; no new credentials in the AI environment.

---

## 4. Classification framework — facts, historical evidence, hypotheses, unverified claims

Applied throughout this plan and required in the review package:

| Class | Definition | Current examples |
|---|---|---|
| **[VERIFIED-FACT]** | Reproducible now with in-repo commands/process evidence | git topology §2.1; reflog checkout events; environment posture §2.2; scheduler registration data; 38 automation commits on main; secret-gate wiring; register contents |
| **[HISTORICAL]** | Verified when observed, not re-verified now | on-chain role matrix & Safe state (live eth_call 2026-10-19); plane-5 healthy run 23:31:59Z; incident timeline (≥10 re-images) |
| **[HYPOTHESIS]** | Plausible, evidence-bounded, unproven | platform `.zscripts` normalization loop as the re-image/checkout actor (§6.2); indirect branch-protection existence (origin never regressed across 10+ incidents) |
| **[UNVERIFIED]** | Claimed/documented but no evidence obtainable from inside | CI run history, secrets provisioning, GitHub branch-protection settings, runner identity; embedded token's scope/expiry/admin permissions; current (2026-11-11) live on-chain roles |

**Independent-review item classifications (the 9 required reproductions):** historical key exposure [VERIFIED-FACT at 2 commits, re-verify]; live role assignments [HISTORICAL → re-verify]; Safe ownership/threshold [HISTORICAL → re-verify]; API authorization findings [VERIFIED-FACT from code]; git credential scope [UNVERIFIED inside → owner GitHub-side]; re-image substitution [VERIFIED-FACT events, HYPOTHESIS actor]; source-integrity/boot-chain gaps [VERIFIED-FACT]; scheduler registration/execution [VERIFIED-FACT]; branch protection/CI [UNVERIFIED inside → owner GitHub-side].

---

## 5. P0-01 — On-chain key compromise: owner-controlled incident procedure

**Finding:** F-0-P0-01 — the estate's on-chain authority (deployer EOA `0x3C39…c8d8c`: DEFAULT_ADMIN + MINTER + PAUSER on the live v1.2 token deployments across Monad-10143 / Arc-5042002 / Robinhood testnets, plus sole 1/1 ownership of the Genesis Safe `0xE718…A7D0`) is exercised by a private key recoverable from this repository's public git history (literal present at commits `2e684d9` and `2da73fd`; verified count = 1 at each; values never reproduced in any Phase-0 document or this plan). Rotation documented since 2026-10-24; owner-blocked; **unexecuted**.

**Standing containment (already in force, not deferred):**
- The key is treated as compromised (owner declaration 2026-10-24). No party may use it for any new operation pending rotation. **The sandbox never held it in the working tree (0 worktree matches, verified) and will never import, regenerate, or use it.**
- The V2 estate deploy remains blocked on a fresh funded key (PENDING.json) — accidental control is prevented by this block, which must remain until Phase C below.

### 5.1 Procedure phases (owner-executed; sandbox prohibited from every step)

| Phase | Operation | Required evidence (COO §2 list → phase) | Executor | Approval |
|---|---|---|---|---|
| **A — Current read-only verification** | eth_call role matrix on every affected chain & contract (both role-bearing token deployments, MtqEcosystem grants, Governance `0xE35a91…Bd66`); Safe `getOwners/getThreshold/getNonce/getModules/getGuard` | *Current read-only role verification on every affected chain; full affected-contract inventory (critical-asset-inventory.md + contract-and-governance-assessment.md); current Safe owners and threshold* | Independent reviewer or owner (never the sandbox agent as sole source; re-verification must use independent RPC/explorer paths) | Owner; no signing involved — read-only |
| **B — Custody architecture** | Fresh replacement key(s) generated **outside the AI sandbox** in owner-controlled custody (air-gapped/HSM-class tier-0 for testnet scope); independent signer identities designated for the mandated 4/7 Safe target | *Replacement key custody architecture; independent signer identities* | Owner + designated signers | Owner; key material must never transit the sandbox (directive §1) |
| **C — Permission migration** | Execute D4/D5 rotation packages (documented in `docs/security/CRITICAL-PRIVATE-KEY-ROTATION.md`, evidence branch — referenced, not reproduced): rotate token roles → reconfigure Safe to 4/7 with the new owner set → migrate Governance authority → verify each step live | *Permission migration plan* | Owner + independent verifier witnessing each step | Owner explicit per-step; independent verification per step |
| **D — Old-key revocation** | Renounce every remaining role held by the old EOA (last step, only after new authority is verified live); confirm zero authority | *Old-key revocation plan* | Owner | Owner + independent verification |
| **E — Post-migration verification** | Fresh eth_call role matrix + fork-replay adversarial test (T-13: rotated roles reject the old key); published role matrix | *Post-migration role matrix; independent verification of the final permissions* | Independent reviewer | Reviewer sign-off closes the evidence chain |

### 5.2 Sequencing honesty

Phase-plan sequences the **execution** of rotation into Phase 3 (after release-channel hardening, Phase 2) so the new authority lands on a verifiable channel. That is a sequencing dependency, **not a containment deferral**: Phases A (verification) and B (custody designation) are actionable **now** as owner actions, and the treat-as-compromised posture (no use of the old key, no new authority granted to it) applies from this moment. The owner may accelerate Phase C/D authorization at will — the dependency rationale (unverifiable push channel while F-0-P0-03 stands) is documented for the owner's decision, not as a blocker the sandbox asserts.

### 5.3 Interim monitoring recommendation (owner-side)

Watch the exposed EOA and the Safe on all three chains for **any** transaction activity (expected: none; any movement = incident requiring immediate response, since only treat-as-compromised holders could act). Out-of-band alerting; documented as the disclosure-monitoring overlap in §8.

---

## 6. P0-02 — Platform re-image: cause determination and forward-only restoration procedure

### 6.1 What is established vs open

**Established [VERIFIED-FACT]:** ≥10 re-image/state-loss incidents since 2026-10-26 (timeline in `recovery-and-state-integrity-assessment.md` §3), including the live-captured substitution at 2026-11-11T00:20Z (stale lineage 2/168 behind; dumps h3941 vs origin h23811 ≈19,870-block deficit; `db/` deleted; `.env` regenerated; scheduler registry previously wiped 2× on 2026-11-10; two forced `git checkout main` events at 00:54:11Z/00:56:12Z during evidence preservation, reflog-verified).

**Not established [HYPOTHESIS — explicitly not fact]:** the actor. The `.zscripts`-platform-normalization-loop attribution is the most plausible actor class — supported by: the root-owned boot-timeline showing platform steps that touch the project (*"Project initialization check"*, *"Extracting official skills to project"*, *"Rewriting lockfile registry"*, *"Restoring zcode state"*, *"Git setup"*, *"custom dev script"*); the 38 UUID-cron commits demonstrating that uncoordinated platform-side git automation exists in this estate; and the two interference events occurring with **no** registered plane-5 fire active in their windows (registration ≠ execution, verified). **Exact attribution remains open** and, per the COO directive, may only be made from process-level or platform audit evidence (§6.2), not inference.

### 6.2 Cause-determination requirements (owner action)

1. Obtain platform-side boot scripts / init automation source and audit logs from the platform provider for the 2026-11-11T00:20Z window and the 00:54/00:56 checkout events (process-level evidence: pids, commands, parent chain).
2. Cross-examine `/tmp/boot-timeline.log` (root-owned) against the reflog timestamps.
3. Preserve the substituted checkout's forensic value: commit `d6fd5d6` and its single ledger entry remain in the object database; no cleaning of the substituted working tree before the restoration procedure's preservation step (§6.3 precondition 3) has run.

### 6.3 Sanctioned forward-only restoration procedure (PREPARED — not authorized for execution now)

**Preconditions (all must hold):**
1. **Isolated environment established** that platform initialization automation cannot silently change. The sandbox *itself* cannot guarantee this (platform root sits above it — F-0-P0-03 substrate). Required: an owner-controlled host/VM/clone outside the shared platform substrate. *Interim pattern already demonstrated by this deliverable:* a git worktree outside the platform-initialized project directory (Appendix B) — an operational-isolation mitigation only, **not** a security boundary (same OS user and credential substrate — limitation stated honestly).
2. **Evidence frozen:** evidence branch @ `ff595158…` and origin/main @ `926ee00` pinned and privately copied (§8.3).
3. **Local unique commits preserved and verified:** `9fe4058` must be confirmed byte-identical to `origin/backup-incident10-amend` (`9fe40589fdff…`); `d6fd5d6`'s telemetry content (the 16:56:44Z ledger line) must be recorded verbatim for re-append on the authoritative lineage (orphaned-entry verbatim-recovery precedent, commit `926ee00`). Both verifications logged.
4. Scheduler jobs 522460/522457 registered (currently true) and their containment posture documented (§13).

**Steps (forward-only — no reset/rebase/clean at any point):**
1. In the isolated environment: clone/fetch; verify `origin/main == 926ee00`.
2. Run the origin-contract plane-5 bootstrap (`scripts/plane5-run.sh` from `origin/main`, as the cron payloads pin): guard adjudicates the divergence — BLOCKED on unique local content → operator (owner) adjudication with the §6.3-precondition-3 verification results.
3. Owner authorizes realignment: fast-forward local `main` to `origin/main` (the two local commits preserved per above — never discarded, never rebased).
4. Boot via the origin contract (watchdog v5 boot chain: guard → source-integrity heal → runtime preflight → db-selfheal with staged generations → `next dev`).
5. Full §4.2 battery + §4.2 checks (audit-trail EXACT, broken=0, unhashed three-way agreement, quick_check, trials/landing-stats 200, upload 403).
6. Durable heartbeat + execution-ledger append with provenance notes; commit/push per contract.
7. Update the incident record with the 00:20Z event and any platform attribution evidence obtained (§6.2).

**Acceptance criteria:** plane-5 heartbeat OK with chainTip ≥ h23846 lineage continuity; audit-trail EXACT; no data regression; evidence branch still `ff595158…`; `origin/main` advanced only by the sanctioned telemetry commits.

**Approval required:** COO/owner explicit authorization per §12 row 1, executed after §6.2/§8.3 owner actions where feasible.

---

## 7. P0-03 — Credential and authority separation

### 7.1 Embedded push credential — review status

| Question | Current answer |
|---|---|
| Location / form | `x-access-token` embedded in the remote URL in `.git/config` (plaintext, readable by any process in the sandbox) — **[VERIFIED-FACT, value never reproduced]** |
| Identity | single git persona authors everything (`Z User / z@container`) incl. all automation and this deliverable — **[VERIFIED-FACT]** |
| Demonstrated scope | push to `origin/main` — 38 UUID-cron automation commits plus plane-5 telemetry pushes, all without any PR/review trace; no CODEOWNERS; branch protection **[UNVERIFIED]** from inside |
| Expiry / admin permissions / linked account | **[UNVERIFIED]** — not determinable from inside the sandbox. **Owner action required:** GitHub-side token audit (which token, scopes, expiry, linked identity, whether it can administer repo settings/secrets/Actions). Until then the credential is treated as indefinite repo-admin-class. |

### 7.2 Rotation/revocation recommendation (owner-controlled process)

1. **Audit first** (§7.1 owner action) — record the token's scope/expiry/identity/admin permissions as review evidence (COO §4 requirement).
2. Design the separated identities (§7.3); provision each **outside the sandbox** (GitHub-side).
3. Migrate automation that must continue (scheduler relay pushes) to a scoped machine identity; migrate the human developer to a personal credential; reviewers use their own access.
4. **Revoke the embedded token last**, only after dependent automation is migrated (avoids the watchdog losing its durability channel mid-transition).
5. At no point place any new private key or credential in the AI development environment (directive §1). The sandbox's residual future authority (if any) should be a scoped, revocable bot identity that cannot administer settings, secrets, or protection.

### 7.3 Identity separation design (eight authorities)

| Identity | Scope (allowed) | Forbidden | Custody |
|---|---|---|---|
| Human developer | feature branches, PRs | direct main push, deploy dispatch, signing | owner-controlled workstation |
| AI coding agent | branch/worktree commits via scoped bot token; telemetry pushes only to designated paths | security-critical path pushes without review, deploys, recovery policy changes, scheduler re-registration without second signal, any signing | scoped revocable bot token (post-Phase 2); today: the single embedded credential — the deficiency F-0-P0-03 documents |
| CI automation | workflow execution with its own ephemeral credentials | persistent repo-admin tokens, direct main push | GitHub Actions OIDC/scoped secrets |
| Independent reviewer | read + PR review + sign-off | push, deploy | reviewer-owned account |
| Deployment operator | dispatch-only deploys (testnet), second-approver rule | source authority, signing custody | owner-controlled |
| Recovery operator | sanctioned restoration procedure execution | signing, deploy, source authority | owner-controlled |
| Security monitor | read-only mirror + out-of-band alerting (independence from the monitored substrate) | any write to the monitored estate | independent host (owner) |
| On-chain signer administration | Safe/role operations under the Phase 5/6 matrix | any sandbox involvement, single-key control | owner + designated signers (§5 Phase B) |

**Directive requirement check:** *the AI development environment must not be able to independently administer all these authorities* — today it demonstrably can (single credential domain, F-0-P0-03). The design above inverts this; its implementation is Phase 2 scope and is **not started** (STOP directive).

---

## 8. Public security disclosure containment

1. **Exposure facts:** the repository is public (`github.com/MITHQALMTQ/MTQ_SIGMA`). The Phase-0 threat register and attack-path analysis are on the public evidence branch; the historical key literal is in public git history (2 commits). **[VERIFIED-FACT]** Deleting the branch or rewriting history does **not** reverse exposure (clones/forks/CI caches/automation pulls may persist) — deletion is not remediation and is not performed.
2. **Standing rule:** no additional unremediated exploit detail in public commits. This plan complies (management-level content only; references to findings by ID/path, no key material, no credential values, no new attack recipes).
3. **Disclosure-containment recommendation (owner decision):**
   - **First:** preserve the private evidence copy + chain of custody (§3): clone `security/phase-0-baseline` @ `ff595158…` and `main` @ `926ee00`, hash the bundles, log custody.
   - **Then** decide posture on the public evidence branch (restrict visibility / coordinated removal / retained-public with monitoring) and on repository visibility overall — with the understanding that exposure is irreversible and the *actual* containment for the key exposure is the P0-01 rotation, not branch deletion.
   - Coordinated-disclosure policy going forward: security-relevant detail publishes only **after** the corresponding remediation is verified (gate-linked disclosure).
   - Overlap monitoring: EOA/Safe activity watch (§5.3) plus repo watch (unexpected forks/stars/issues referencing the key literal).
4. **Gate linkage:** any decision to rewrite history (purge the key literal) is owner-approved, executed only **after** P0-01 Phase E verifies the old key holds nothing — never before (it would destroy evidence while the threat stands).

---

## 9. Independent review package

### 9.1 Package definition (17 documents, pinned)

Access: public repo, branch `security/phase-0-baseline`, HEAD `ff59515852053f197ddd725b7bc4107d63a0d589`. Full manifest with blob hashes in **Appendix A**. Supporting artifacts (same branch): `docs/security/CRITICAL-PRIVATE-KEY-ROTATION.md` (referenced only — contains rotation procedures; handle under §8 rules), `scripts/security/*` (redaction/scan tooling). The addendum (interference events) is embedded in `phase-0-evidence-index.md` §9.

### 9.2 Reproduction protocols (the 9 required items)

| # | Item | Protocol (commands/reads) | Expected result | Class discipline |
|---|---|---|---|---|
| 1 | Public historical key exposure | On a **private** copy (never re-publish values): `git show 2e684d9:worklog.md | grep -cE '<66-hex-literal-regex>'`; same for `2da73fd:scripts/verify-key-and-audit-roles.ts`; `git log --all --oneline -- .env` (expect empty); worktree scan for the literal forms (expect 0) | count = 1 at each of the two commits; no other exposure sites | report counts only; values never displayed |
| 2 | Live contract role assignments | Read-only eth_call role matrix per affected chain/contract for EOA `0x3C39…c8d8c` (hasRole for DEFAULT_ADMIN/MINTER/PAUSER on the role-bearing deployments; ecosystem grants; Governance) — independent RPC/explorer | matches register (all granted) **or** documents any drift | fresh verification supersedes the 2026-10-19 historical reads |
| 3 | Genesis Safe ownership & threshold | Safe `getOwners/getThreshold/getNonce/getModules/getGuard` on `0xE718…A7D0` | 1 owner (deployer EOA), threshold 1, nonce 0, no modules, no guard | fresh verification |
| 4 | API authorization findings | Route census (59 routes) + mutation-surface inspection per `authorization-flow-inventory.md` (simulate/mint/redeem paths, issuance rows, MBG bypass env, faucet) | no transaction-policy boundary exists; unauth mutation surfaces confirmed | code-evidence verified |
| 5 | Git credential scope | Owner-assisted GitHub-side: token identity/scopes/expiry/admin; sandbox-side: `git remote -v` (redacted), 38 automation commits, plane-5 push history | scope/expiry/identity recorded | closes the [UNVERIFIED] item |
| 6 | Platform re-image substitution | Reproduce topology: `git fetch; git rev-parse origin/main` (926ee00); `git rev-list --left-right --count HEAD...origin/main` (2/168); `git merge-base` (ff67aa2); reflog 00:54:11Z/00:56:12Z; `/tmp/boot-timeline.log` steps | substitution event fully reproduced; actor attribution remains **open** (hypothesis) | facts vs hypothesis separated |
| 7 | Source integrity & boot-chain gaps | At `d6fd5d6`: source-integrity-heal absent (Glob), watchdog heal invocation masked (`|| true`), `plane5-run.sh` absent; on `origin/main`: heal layer present (+57/+157/+232 line artifacts) | gap confirmed: containment is lineage-conditional | verified |
| 8 | Scheduler registration & execution | `cron list` (jobs 522460/522457, payload contracts, run_count, display-clock +8 h skew, next_run_time UTC); substituted-HEAD ledger single-entry (16:56:44Z BOOTSTRAP-FAILED); origin-side ledger through 23:30:29Z; registration ≠ execution instances (15 consecutive rejected fires; silent 00:17:48Z & 02:17:48Z run_count increments) | persistence not declarative; execution ≠ registration confirmed | verified |
| 9 | Branch protection & CI enforcement | GitHub-side: main protection settings, CODEOWNERS (absent), workflow inventory (9 workflows; Slither dead wiring `forge-tests.yml:103`; ESLint advisory `ci.yml:72`), run history, secrets provisioning | claims currently unverifiable from inside → owner-attested evidence decides | [UNVERIFIED] until attested |

### 9.3 Reviewer independence requirements

The independent reviewer must: (a) not be the authoring agent lineage or the sandbox persona; (b) use its own environment, credentials, and RPC paths; (c) reproduce §9.2 items with the classification discipline (§4) — distinguishing verified facts, historical evidence, hypotheses, unverified claims in the deliverable sign-off; (d) issue a written reproduction report referencing this plan and Appendix A hashes.

---

## 10. Gate #1 prerequisites (entry to Phase 1 — currently NOT authorized)

Gate #1 = the approval gate the Phase-0 plan defines (architecture direction + remediation priorities + the live-divergence adjudication). Prerequisites assembled here:

1. Independent review package delivered (this plan + Appendix A manifest + §9.2 protocols) — **DONE with this deliverable.**
2. Owner has reviewed the Phase-0 findings (executive summary + register).
3. Independent reviewer has reproduced the §9.2 items (at minimum 1, 2, 3, 6, 7, 8; 5 and 9 require GitHub-side owner assistance) and issued the sign-off artifact.
4. P0-01 Phase A verification (current role matrix + Safe state) completed by owner/reviewer — the *evidence* baseline for the rotation decision.
5. P0-03 credential audit (§7.1 owner action) executed or formally scheduled with an interim-compensation note.
6. Disclosure-containment decision made (§8.3) — including the private evidence copy with chain of custody.
7. P0-02 preconditions resolved: platform-side attribution evidence obtained (or formally deferred with rationale), isolated-environment decision made, unique-commit preservation verified.
8. **Then:** owner authorization for the §6.3 restoration (or explicit deferral), and the Gate #1 decision on Phase 1 architecture approval.

Phase 1 remains **NOT AUTHORIZED** until items 1–8 are closed by the owner — and not by this agent's assertion.

---

## 11. Outstanding P0/P1 risk register (status snapshot — none resolved)

| ID | Finding | Status | Current containment posture |
|---|---|---|---|
| F-0-P0-01 | Compromised-class EOA key recoverable from git history; it is the live on-chain authority | OWNER-BLOCKED (since 2026-10-24) | treat-as-compromised posture in force; procedure §5; verification (Phase A) requested now |
| F-0-P0-02 | Platform re-image state substitution (live instance 00:20Z) | PARTIALLY-CONTAINED | no boot, no realign; restoration procedure prepared (§6.3); origin-side chain last verified 23:31:59Z |
| F-0-P0-03 | Single credential domain across all six boundaries | OPEN | no authority operations from sandbox; identity design §7.3 (Phase 2 implementation, not started) |
| F-0-P1-01 | Unauthenticated write surfaces against pilot monetary state (+ latent MBG bypass) | OPEN | shadow-scope only; must close before controlled-testnet gate |
| F-0-P1-02 | Anti-deletion/self-heal layer absent at substituted HEAD | OPEN at HEAD / VERIFIED on origin | frozen state; resolves via §6.3 restoration |
| F-0-P1-03 | Governance authority inversion at every running layer (Safe 1/1 vs mandated 4/7; undeployed councils carry DEFAULT_ADMIN bypass) | OPEN | V2/V3 deploys remain blocked on fresh key |
| F-0-P1-04 | Supply-chain/CI claims unverifiable; automation direct-push channel; single-secret deploy | OPEN (verification blocked from inside) | GitHub-side attestation required (owner) |
| F-0-P1-05 | Scheduler persistence not declarative; registration ≠ execution | OPEN | containment posture §13; declarative manifest = Phase 5 |

P2 (rate-limit gaps/XFF/wildcard Caddy; doc-code drift; retired hot-key prototypes; unauth cold-path file write; devnet faucet accepted-by-design) and P3 (disclosure placeholder; dev-entrypoint broken at substituted HEAD — resolves with §6.3; secret-scan staged-only/`--no-verify` bypass possible + no history scan) remain OPEN as documented in the register. **No finding above is claimed resolved.**

---

## 12. Approval matrix — exact approval required for each operation

| # | Operation | Required approval | Required verification before approval | Sandbox may execute? |
|---|---|---|---|---|
| 1 | Forward-only realignment + sanctioned boot (§6.3) | COO/owner explicit | §6.3 preconditions 1–4 (isolation, evidence frozen, unique-commit preservation verified) | Only after approval, per the origin contract |
| 2 | On-chain key generation / funding / signing / transfer | Owner + designated signer | custody architecture (§5 Phase B) | **NEVER** |
| 3 | Role migration / Safe modification / revocation (P0-01 Phases C/D) | Owner explicit per step | independent witness per step | **NEVER** |
| 4 | Read-only on-chain role verification (§5 Phase A) | Owner (informational) | none (read-only) | Not as sole source — independent paths required |
| 5 | Embedded-token rotation/revocation (§7.2) | Owner (GitHub admin) | token audit (§7.1) + migrated automation | No (credential work is owner-side) |
| 6 | Scheduler re-registration / declarative manifest / suspension | Owner decision | §13 posture documented | relay-level only, per existing payloads |
| 7 | Evidence branch merge / delete / history rewrite | Owner | independent review complete; for history rewrite also P0-01 Phase E verified | **NEVER** for rewrite; merge not authorized now |
| 8 | Public disclosure / branch-visibility changes | Owner | private evidence copy + custody log (§8.3) | No |
| 9 | Phase 1 start | Owner (Gate #1) | §10 items 1–8 closed with reviewer sign-off | No |
| 10 | Any force-push, boot of substituted lineage, new installs/deploys, credential creation in sandbox | — prohibited outright (directive §1) | — | **NEVER** |

---

## 13. Scheduler & plane-5 containment posture (live operational note)

- **Jobs (registered, enabled):** 522460 backstop v3.3 (hourly :17:48Z, run_count 5) · 522457 monitor v3.2 (hourly :55:45Z, run_count 4). Display clock +8 h vs UTC next_run_time (skew documented — F-0-P1-05).
- **Registration ≠ execution (live instances):** the 2026-11-11T00:17:48Z and 02:17:48Z backstop fires incremented run_count with no relay/telemetry observed in this session — the §13.3 distinction again demonstrated. Historical: 15 consecutive fires rejected at the platform layer ("model concurrency limit exceeded") without dead-man alerting.
- **Containment protocol while the substitution stands:** `scripts/plane5-run.sh` is absent at the substituted HEAD, so per the payloads' own fallback, fires resolve to the origin-sourced script whose **bootstrap guard classifies BLOCKED (genuine unique local content → no realign, no commit, no boot — telemetry to /tmp only)**. Relays must report that classification verbatim. No autonomous remediation, no boot, no pushes from the substituted lineage; the substituted-tree script must never be run even if one appears locally (source-integrity, F-0-P1-02 class). The last durable plane-5 telemetry remains the origin-side ledger through 2026-11-10T23:30:29Z — the watchdog continuity gap is honestly declared, not papered over with fresh-but-empty heartbeats (never-present-a-fresh-heartbeat-as-proof rule).
- **Post-restoration (after §6.3 approval):** the plane-5 contract resumes (heartbeat + ledger durability); scheduler declarative manifest is Phase 5 work (not started).

---

## 14. Final status

```
PHASE 0 COMPLETE — INDEPENDENT REVIEW REQUIRED
PHASE 1 NOT AUTHORIZED
TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED
```

No P0 finding is claimed resolved. Resolution requires independently verified evidence establishing it (per the COO directive and the Phase-0 register's final rule: *no finding is marked resolved by commit alone*).

---

## Appendix A — 17-document evidence manifest (pinned at `security/phase-0-baseline` = `ff59515852053f197ddd725b7bc4107d63a0d589`)

| # | Path (under `security/assessments/phase-0/`) | Git blob SHA-1 | Size (B) |
|---|---|---|---|
| 1 | architecture-inventory.md | `58b60fabb566ad14ab4bf291265a1959462e18f5` | 11,391 |
| 2 | attack-path-analysis.md | `f69c7764ea185163a8ffebf6c7ae073adddc5d16` | 7,051 |
| 3 | authority-graph.md | `894ff5e31faca810ae320a258e5a9881cb55d009` | 6,184 |
| 4 | authorization-flow-inventory.md | `a44f4a70766221b4764f7c84bd52c9692313725c` | 7,516 |
| 5 | contract-and-governance-assessment.md | `f224eecea0d9405237725e48d0ab48b9a55f89f9` | 4,567 |
| 6 | critical-asset-inventory.md | `95d5f13b409be7be3909e498b1e46d0b67d2bd2c` | 9,236 |
| 7 | critical-vulnerability-register.md | `249a8d953e9b50611b16c5c24339323cfb4aa789` | 18,550 |
| 8 | developer-ai-and-cicd-assessment.md | `61c7451e17829b0423eeaa0d0294301161e6e72e` | 6,310 |
| 9 | phase-0-evidence-index.md (incl. §9 addendum) | `1a60bbf469e34190c6dc5803a491f7fc474d12b4` | 9,795 |
| 10 | phase-0-executive-summary.md | `d0d94cccee89a2411d75831b2c0a0e367644896e` | 9,103 |
| 11 | recovery-and-state-integrity-assessment.md | `b6dac1cdd655bced4fe6ba0b7d7519288c6f548d` | 6,549 |
| 12 | security-dependency-register.md | `24fdea91c290da90e13d9282f9531edb2aded559` | 5,317 |
| 13 | security-phase-plan.md | `f4fe0949da089c8fa964f92be39ec841859ba013` | 8,034 |
| 14 | threat-model.md | `b02fda34e9ad8d5be6dc21eef71ddc1fe59b8651` | 7,000 |
| 15 | trust-boundary-diagram.md | `2a57a77c1ca6d66146bc75b00a489ce2c9e75531` | 10,942 |
| 16 | validator-bridge-oracle-assessment.md | `d014ae65f20682bee342082aa94b68287ba71de0` | 4,267 |
| 17 | wallet-and-signing-assessment.md | `f5ae9c161f89c15c7f030b35fa293cc452e15295` | 3,836 |

Verification command (any reviewer): `git ls-tree -r -l security/phase-0-baseline | rg 'security/assessments/phase-0/'` — must match this table exactly.

## Appendix B — Delivery note

This file was authored and committed **from an isolated worktree** (`/home/z/phase0-wt`, outside the platform-initialized project directory — the interim isolation pattern of §6.3 precondition 1, with its stated limits) on branch **`security/phase-0-management-plan`**, created from **`origin/main` @ `926ee00`** (authoritative). Neither `origin/main`, nor local `main` (substituted `d6fd5d6`), nor the evidence branch was modified; no merge, reset, rebase, or clean was performed anywhere; the substituted checkout was not booted. The wired pre-commit secret gate (fail-closed) was active on this commit. Promotion of this deliverable into `main` is an owner decision at Gate #1 (§12 row 7). Known limitation: the commit is authored by the single sandbox persona (F-0-P0-03) — independent review (§9.3) is the compensating control.
