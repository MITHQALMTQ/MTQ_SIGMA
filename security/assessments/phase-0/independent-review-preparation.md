# Phase 0 — Independent Review Preparation (consolidated verification-support package)

**Document ID:** SEC-P0-IRP-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T03:3xZ (UTC)
**Assignment:** COO *Phase-0 Independent Verification Support* §D–§G: owner-side evidence checklist, P0 rotation-procedure review, evidence-integrity package (SHA-256 manifest, chain-of-custody), reproduction results, unresolved owner actions, exact evidence still required.
**Companion documents (this branch):** `authoritative-main-delta-assessment.md` (SEC-P0-DELTA-001) · `secret-history-assessment.md` (SEC-P0-SECHIST-001).
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED.

> **Standing independence limitation:** this package was prepared by the same AI-agent lineage that operates the assessed environment. **It is preparation for independent review, not independent review** — the author explicitly does not claim reviewer status (directive §A final rule). Every external fact below is marked **[UNVERIFIED — pending owner/reviewer evidence]** and no finding is claimed resolved.

---

## 1. Reproduction results achieved this session (verification support)

| §9.2 item (management plan) | Status | Where evidenced |
|---|---|---|
| 1 — Public historical key exposure | **REPRODUCED + EXTENDED** | secret-history §2–§3: intro commits verified (count 1 at `2e684d9d8:worklog.md`, 1 at `2da73fd65:scripts/verify-key-and-audit-roles.ts`); NEW: 12 worklog versions, 3 committed tool-transcripts, C-045-b 7 files, **zero public-remote-ref reachability of the 23 key-material blobs** |
| 4 — API authorization findings (code-level) | **RE-ANCHORED** | delta §2: 63 routes on authoritative (59 assessed); 2 new unaudited ai/* surfaces flagged |
| 6 — Platform re-image substitution | **REPRODUCED** | delta §1 + management plan §2.2 (topology, reflog, boot-timeline); actor attribution remains open **[HYPOTHESIS]** |
| 7 — Source-integrity/boot-chain gaps | **REPRODUCED + MECHANISM PINNED** | delta §5: identical `|| true` invocation; difference = dependency presence (heal script absent at d6fd5d6) |
| 8 — Scheduler registration/execution | **REPRODUCED** | management plan §13 + delta §6 (59-entry origin ledger vs 1-entry substituted; registration ≠ execution live instances) |
| 2, 3 — Live role assignments; Safe owners/threshold | **PENDING** — on-chain reads (owner/reviewer) | current matrix must be re-established at fresh blocks (last verified 2026-10-19/2026-10-24-era evidence) |
| 5 — Git credential scope | **PENDING** — owner GitHub-side audit | |
| 9 — Branch protection/CI enforcement | **PENDING** — owner GitHub-side attestation | |

Evidence-integrity anchors: git topology verified frozen (origin/main 926ee00; evidence branch ff595158; substituted d6fd5d6 untouched; management-plan branch a328d97 pushed).

---

## 2. §D — Owner-side security-dependency evidence checklist

Every item below is an **external fact the sandbox cannot verify**; each requires evidence from the owner or the independent reviewer before the corresponding register finding may move. Format: item → required evidence → who supplies → feeding finding.

| # | Item | Required evidence (exact) | Supplier | Feeds |
|---|---|---|---|---|
| D-1 | Current EOA roles | read-only eth_call `hasRole` matrix for `0x3C39…c8d8c` across **all three chains and every role-bearing surface** (per D4 authority inventory: both role-bearing token generations + 6 modules/chain × 2 EVM chains + module-side MINT/RESERVE MINTER grants + dormant Redeem grant), anchored at named block heights, from an independent RPC path | owner or reviewer (independent RPC) | F-0-P0-01 Phase A |
| D-2 | Safe owners & threshold | Safe `getOwners/getThreshold/getNonce/getModules/getGuard` on `0xE718…A7D0` **on both chains** (Monad + Arc) + re-run of `scripts/verify-safe.ts` (VERIFIED 4/7 gate) | owner or reviewer | F-0-P0-01 / OD-35 |
| D-3 | Affected-contract inventory | attested inventory matching D4 §1.1–1.3 (incl. **both** 1/1 Genesis Safes, the NOT-Safe `0x7435…d316`/`0xDfcA…B713` and `0xa3CE…5691` annotations, gen-A Ownable twins, Robinhood provenance tier, Solana current + superseded mints) | reviewer cross-check vs D4 | F-0-P0-01 |
| D-4 | GitHub token identity/scope/expiry/permissions | GitHub-side: which token the embedded `x-access-token` is, scopes, expiry, linked identity, admin capability (repo settings/secrets/Actions), audit log of its use | owner (GitHub admin) | F-0-P0-03 / §7.1 |
| D-5 | Branch-protection settings | screenshot/attestation of main-branch protection state (require PR? required checks? force-push block?) + change history | owner | F-0-P1-04 / P0-03 |
| D-6 | CODEOWNERS & required reviews | confirmation of absence (or addition plan) + PR review statistics for the 38 automation commits | owner | F-0-P0-03 |
| D-7 | Workflow secrets & release permissions | attested inventory of Actions secrets (`TURSO_AUTH_TOKEN` [read-**write** documented], `DEPLOYER_PRIVATE_KEY`, FRED key, Discord webhook), workflow permissions (`contents: write` on backup.yml), dispatch protection on deploy-testnet.yml, runner identity | owner | F-0-P1-04 |
| D-8 | Public repository exposure decision | owner decision record on: repo visibility posture, the two September tags (never-pushed status + D3 history-remediation decision), evidence-branch visibility, private-evidence copy + custody log (§4 below) | owner | §8 disclosure containment |
| D-9 | Platform attribution evidence | platform-provider audit logs / boot-script source for the 2026-11-11T00:20Z re-image + 00:54/00:56 checkout events (pids, command lines, parent chain) | owner + platform provider | F-0-P0-02 §6.2 |

None of D-1…D-9 is claimed verified. **The sandbox-side work for each (inventories, procedures, cross-check tables) is complete** — see D3 cross-check: `authoritative-main-delta-assessment.md` + D4 package on origin/main.

---

## 3. §E — Read-only review of the P0 rotation procedure (D4/D5 + ROLE_ROTATION + MASTER-E2E)

Sources read (origin/main @ 926ee00, read-only): `audit-work/task12/D4-EVM-AUTHORITY-MIGRATION-PACKAGE.md`, `D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md`, `D3-GIT-HISTORY-REMEDIATION-PLAN.md` (referenced), `D7-APPROVAL-AND-DEPENDENCY-MATRIX.md`/`D8-OWNER-APPROVAL-CHECKLIST.md` (referenced), `docs/ops/ROLE_ROTATION.md`, `docs/security/CRITICAL-PRIVATE-KEY-ROTATION.md`, `contracts/deployments/MTQSigmaV2-PENDING.json`, `audit-work/2026-11-01-MASTER-E2E-AUDIT.md`.

### 3.1 Permission-migration dependencies

1. **Grant-before-revoke ordering** (ROLE_ROTATION §6): the destination (Safe-B 4-of-7) must be verified working *before* any revoke of the deployer's roles; never batch steps 2–5 with 6–8 (D4 rule). Dependencies: T-1.4 dossier gate (getOwners==⟨OWNER-1..7⟩, threshold 4, nonce 0, v1.4.1, canonical singleton slot) *before any estate change*.
2. **Canonical-contract declaration (C-041)**: three distinct live MTQ token families per chain are recorded (v5.0 "MITHQAL" / canonical-map "MTQΣ" / deployment-JSON) — role migration requires the owner to declare which is canonical per chain **before** granting it new authority.
3. **The 7 Constitutional signers do not exist yet** (D4 §2: "signer addresses DO NOT EXIST YET… generated in a human-controlled ceremony OUTSIDE this repository/sandbox/any AI environment") — prerequisite to every later step; quorum-loss (3 simultaneous) freeze risk must be owner-accepted first.
4. **Governance contracts N-01**: `0xE35a…Bd66` (different bytecode on the two chains) has *unestablishable* authority without source — **NO INTERACTION, not even renouncing** (unknown behavior could brick or trigger). Publish source → audit → only then decide. This is a standing dependency and a residual old-identity surface (§3.4).
5. **Solana dependency**: current mint authority `DbFjz…` custody is **UNVERIFIED (CKPT-2)** — a verification prerequisite for D5; superseded-mint authority is the exposed C-045-b key.
6. **CI/CD dependency**: `DEPLOYER_PRIVATE_KEY` CI secret must be a *fresh, funded, outside-AI-environment* key (MASTER-E2E blocker 1) — the V2 deploy (PENDING.json) remains blocked on it; deploy scripts must run per ROLE_ROTATION §7 signing-method rules (hardware wallet / Safe CLI / secrets manager — never raw key in a shell; the in-repo rehearsal scripts `audit-fix-roles.ts`/`transfer-ownership.ts` predate these rules and read `.env` DEPLOYER_PRIVATE_KEY — retained as evidence only, must NOT be used for production-adjacent runs).

### 3.2 Can the old EOA block or interfere with migration? — YES, structurally

- **The migration paradox (verified from the authority inventory):** the old EOA is the *only* current DEFAULT_ADMIN/owner on every surface, so every grant-to-new-destination transaction **must itself be signed by the compromised key** (D4's design accepts this: "the exposed key, if ever used, is loaded ONLY in an owner-controlled session"). An attacker holding the key can: (a) **refuse** — then no permission migration is possible at all and the only remedy is contract migration/redeploy (immutable contracts, no upgrade path; testnet last-resort redeploy per ROLE_ROTATION §6); (b) **front-run/race** the grant transactions (nonce replacement, fee bumping) on public testnet mempools; (c) **re-grant** roles to attacker-controlled addresses during any dual-admin window; (d) **drain balances** (deployer holds 309.949/1,000 MTQ + native on Monad; 998.999/1,000 + native on Arc; Robinhood holdings — T-3.8 evacuation decision) — a race the owner must win or accept; (e) on Solana, mint unlimited superseded-mint tokens / freeze accounts / drain the 4.98 SOL (D5: "drainable by any repo holder — urgent regardless of everything else").
- **Interference mitigations already in the packages:** per-step verify-after-every-grant/revoke; owner-controlled session with nonce management; testnet-only value today (scope-limited blast radius); monitoring recommendation (management plan §5.3 EOA/Safe activity watch — expected state: **zero historical activity**; any movement = active-incident).

### 3.3 Can the Safe threshold change be performed safely? — Yes, via the D4 fresh-Safe path (with a documented caution on the alternative)

- **D4 path (recommended, reviewed as safe):** create a **new** Safe-B per chain via `createProxyWithNonce` (canonical singleton, byte-identity anchored) configured **4-of-7 from birth** (T-1.4 dossier gate). No surgery on the old 1/1 Safe is required to establish the new authority; the old Safe is then *stripped of token roles* (T-3.2) and decommissioned-or-preserved per owner decision. Residual risk: the old Safe remains 1/1 until stripped — bounded by the strip step.
- **In-place reconfiguration path (caution):** `addOwnerWithThreshold ×7 + changeThreshold(4)` on the existing 1/1 Safe (ROLE_ROTATION §8 blocker formulation) requires old-key signatures for every execTransaction and passes through **threshold-1 windows with a growing owner set** (each new owner can also act alone until the threshold is raised) — dual single-key authority during the transition. If the owner chooses this path, it needs an explicit risk acceptance; the D4 fresh-Safe path avoids it. Either way: **re-verification after ANY Safe reconfiguration is mandatory** (verify-safe VERIFIED 4/7 on both chains; the 2026-10-19 evidence certifies only the recorded block heights).

### 3.4 Remaining roles/modules and privileged operations available to the old identity

The full post-rotation role matrix must show **zero** for the old EOA across (per D4 §1 inventory — all verified current as of the fresh Task-12 anchors, to be re-verified at Phase-A):

- EVM: DEFAULT_ADMIN on both token generations × both chains; the **6 modules per chain** (Mint/Redeem/Reserve/Algorithm/Oracle/Takaful) admin grants; Mint-module MINTER (wired mint path); Reserve-module MINTER (Monad, ECON-DEC-2 pending); the **dormant Redeem-module token grant** (T-3.1 revoke); PAUSER surfaces (Arc asymmetry: Safe holds PAUSER only — normalize per owner decision).
- **gen-A Ownable twins** (`0x5D95…` Monad, `0x5C72…` Arc gen-C, `0xA3B8…44EF0` Robinhood, Arc genA `0x826b…`): `owner()` powers + one-shot `genesisMint` gates + self-custodied 1,000,000 genesis each — **an EOA-key rotation does NOT remove these; each needs its own `transferOwnership` or an explicit accept-provenance decision (D6/T-3.8)**.
- Both 1/1 Genesis Safes (same address both chains); the fake "Safes" (never custody).
- Governance contracts N-01 (unknown — no-interaction rule; remains an old-era deployer-linked surface until source is published and audited).
- Balances/native evacuation (T-3.8) — token and native holdings remain drainable by the old key until evacuated or accepted-as-loss (testnet value only).
- Solana: superseded mint authority + freeze (C-045-b), 4.98 SOL; current mint authority custody UNVERIFIED (CKPT-2).

### 3.5 Atomicity verdict — controlled multi-stage migration, never atomic

- The packages themselves forbid batching (grant-before-revoke, verify-after-every-step, never-batch rule) — and the dependency graph (§3.1) cannot be executed atomically anyway. Dual-admin windows are **inherent** and must be explicitly monitored (per-step verification; final independent matrix).
- Rollback analysis (ROLE_ROTATION §6): erroneous role revocation → Safe-as-admin re-grants (hence Safe must be verified working first); erroneous admin revocation with last-admin removal → **permanent** (immutable contracts; AccessControl self-administered; only remedy = migration Option A) — hence step-8 (deployer admin renounce) is policy-optional and rehearsal-prechecked.

### 3.6 How the replacement authority is independently verified

1. T-1.4 dossier gate on Safe-B before any estate change (owners/threshold/nonce/version/singleton slot).
2. `scripts/verify-safe.ts` re-run → **VERIFIED 4/7 on both chains** after any reconfiguration.
3. `scripts/verify-key-and-audit-roles.ts` (public-address verifier, redacted form) role matrix at fresh anchored blocks.
4. Fork-replay adversarial test T-13 (rotated roles reject the old key).
5. Post-migration matrix published with block anchors; independent reviewer re-derives via its own RPC path.
6. Release gates: MASTER-E2E blockers 1–5 (fresh funded CI key; 15 role-holder addresses; Safe 4/7 both chains; oracle ABIs; external audit engagement for Gates 3–4).

**No keys were created, no transactions proposed or executed — read-only review only.**

---

## 4. §F — Evidence-integrity package

### 4.1 SHA-256 manifest — the 17-document Phase-0 evidence set (pinned at `security/phase-0-baseline` @ `ff59515852053f197ddd725b7bc4107d63a0d589`)

*(The existing 17-document manifest in SEC-P0-MGMT-001 Appendix A — git blob SHA-1 + size + full file names — is UNALTERATED. The table below adds **content SHA-256** for the private evidence copy. Rows are numbered in the exact Appendix-A order; file names are *not* repeated on digest lines (they are listed immediately below the table). Verification: `git show security/phase-0-baseline:security/assessments/phase-0/<file> | sha256sum`.)*

| # | SHA-256 of content |
|---|---|
| 1 | `7de2e4ba7661bca5996debd30c4e05259abb4eb6a8924e915fb4789d3c88e97d` |
| 2 | `9a0d628d5db5aea443f679f5876a8814251235578066ce15d77059d5e5cb83b1` |
| 3 | `2447dcc41d33635e445e951ae7122f4e072ed14d473546475ec9f9272fde5897` |
| 4 | `3d3f89662dc1a3847cc187697f4e6fea1a9a16c444ca1625b6f8d35adc1b1bde` |
| 5 | `b15ac870763fd115f6a60c90efb1a3472260906605f2f4347d223c5eee48b7df` |
| 6 | `77953434dfd207adea53865de46ea8581f4ff5ad7058a8a8d20fe12cf052bc4c` |
| 7 | `dac95169344aa5d02e8419bfc584ca7c0d6803476dc03a420308cb4a8c903508` |
| 8 | `5348cc02bbed47e661e285ea020f553ce7f069b927cc2ac8f3a3593069cc59ae` |
| 9 | `f764f5cfbacc157aaa6c39fe840905186c21bf05d4c8d067d5382d9a57724a30` |
| 10 | `c866a9d77b48d90ae1958d4817a5e8ef71d93c0fe8ec7f8b7e07cdc02aef5957` |
| 11 | `03e9d4a39553efed782264056f2a2ef09b272b5ce669226f2fb878ca52155d0f` |
| 12 | `7f9894d75d359ff53c66cf2df94804fe93517c44564720224a24353a8192f6b5` |
| 13 | `ae067733f2ab8837ff087205a6f4f4401023c24c9d57630eb162f8bb664f91d5` |
| 14 | `9db000638518919b5b92628c0d0c53fa1f64d5d0d3bdcee8ffe8b54c5082f7e6` |
| 15 | `36611c4277cb6fef5798ab5614ddd9614c9612ee631b7e78589b04917eb64609` |
| 16 | `d2b02a325f53909e289ed4f90cfbf8b855bd1f00c8dd3b1dbb836e49437ce1f9` |
| 17 | `4e5fd49e504f8391cfd94910fa0a3bd92e48ec800c57cb3ffa0661b25ae97cf8` |

**Numbering key (Appendix-A order):** 1 architecture-inventory · 2 attack-path-analysis · 3 authority-graph · 4 authorization-flow-inventory · 5 contract-and-governance-assessment · 6 critical-asset-inventory · 7 critical-vulnerability-register · 8 developer-ai-and-cicd-assessment · 9 phase-0-evidence-index · 10 phase-0-executive-summary · 11 recovery-and-state-integrity-assessment · 12 security-dependency-register · 13 security-phase-plan · 14 threat-model · 15 trust-boundary-diagram · 16 validator-bridge-oracle-assessment · 17 wallet-and-signing-assessment (all `.md`, under `security/assessments/phase-0/`).

**Supplementary (this program's post-acceptance deliverables — review-support tier):**

| File | Ref / commit | Content SHA-256 |
|---|---|---|
| management-containment-and-review-plan.md | `origin/security/phase-0-management-plan` @ `a328d97` | `ef54488aeca97d3ade455866e611365082cc0e41cf239d7ebf5680956c15e33b` |
| authoritative-main-delta-assessment.md | this branch @ (see §4.2) | (record at commit; verify via `git show <ref>:<path> | sha256sum`) |
| secret-history-assessment.md | this branch @ (see §4.2) | (same) |
| independent-review-preparation.md | this branch @ (see §4.2) | (same) |
| private scan harness + redacted raw output | private evidence package only (`/home/z/phase0-review-tmp/*`, owner-copied) | bundle-hash recorded in custody log |

### 4.2 Git commit and blob references (pin set)

```
origin/main                          926ee001e70e404dd3ea870c37f4786524458517
origin/security/phase-0-baseline    ff59515852053f197ddd725b7bc4107d63a0d589
origin/security/phase-0-management-plan a328d97d4f545484267ff8776e63eda3316d20a9
origin/backup-incident10-amend      9fe40589fdff70f7636dc6f13d4cb29364016afe
substituted local main (frozen)     d6fd5d69816bbd096d673b90ca5e26c18e0241bd
evidence-branch chain               29581df → ff59515 (addendum)
key-material lineage (local-only)   backup-2026-09-22 (404ae56b) · backup-stable-2026-09-26 (a91f1f07)
key intro commits                   2e684d9d8 (worklog.md) · 2da73fd65 (scripts + tool-results)
```

### 4.3 Verification commands (reviewer, read-only)

```
git clone <repo> && cd <repo>
git rev-parse origin/main origin/security/phase-0-baseline origin/security/phase-0-management-plan
git ls-tree -r -l security/phase-0-baseline | rg 'security/assessments/phase-0/'   # matches SEC-P0-MGMT-001 App. A (blob SHA-1 + size)
for f in <17 files>; do git show security/phase-0-baseline:security/assessments/phase-0/$f | sha256sum; done   # matches §4.1
git log --all --oneline -- '.env'                     # empty
git show 926ee00:worklog.md | grep -cE '<full-literal regex per public fingerprint>'   # 0
```

### 4.4 Chain-of-custody template (private evidence copy)

| Field | Entry |
|---|---|
| Timestamp (UTC) | ____ |
| Custodian (name/role) | ____ (must satisfy §4.5 independence) |
| Operation (copy/transfer/verify) | ____ |
| Source refs copied | `security/phase-0-baseline@ff595158` · `main@926ee00` · management-plan `@a328d97` · this branch `@<commit>` · local Sept tags `backup-2026-09-22`/`backup-stable-2026-09-26` (tag objects 404ae56b / a91f1f07) |
| Verification | blob SHA-1 table (App. A) ✔ · SHA-256 table (§4.1) ✔ · bundle hash `sha256( bundle.tar )` = ____ |
| Storage location / access control | ____ |
| Notes | redacted scan harness + raw output included; no secret values present in any copied artifact |

### 4.5 Reviewer identity and independence requirements

1. Not the authoring agent lineage, the sandbox persona, or any credential derived from the sandbox substrate.
2. Own environment, own credentials, own RPC paths (on-chain reads), own GitHub-side attestation access.
3. Reproduces §9.2 items with classification discipline (fact / historical / hypothesis / unverified) and issues a written reproduction report citing the §4.1 hashes.
4. Sign-off gates: Gate #1 prerequisites (SEC-P0-MGMT-001 §10) — items 1–8 — before any Phase-1 authorization.

---

## 5. Unresolved owner actions (consolidated, none closed)

1. D-1…D-9 evidence items (§2) — owner/reviewer supplied.
2. Lineage adjudication + §6.3 restoration authorization (management plan §12 row 1) — pending Gate #1.
3. P0-01 phases A–E (§5 of the management plan; §3 here for the procedure review) — A actionable now; B–E owner-authorized per step.
4. Credential audit + rotation sequence (§7.2) — owner GitHub-side.
5. Disclosure-containment decision incl. the two local September tags + D3 history-remediation decision (secret-history §6) — owner.
6. Solana urgency (D5): superseded-mint authority is the exposed key; 4.98 SOL drainable by any repo holder; current-mint custody CKPT-2 — owner verification + containment.
7. Platform attribution evidence (F-0-P0-02 §6.2) — owner + platform provider.

## 6. Exact evidence still required (by review item)

- §9.2-1: reviewer re-run of the secret-history scan (harness in the private package) + spot-check of the 2 unmapped worklog blobs. **Sandbox-side: complete.**
- §9.2-2/3: fresh eth_call role matrix + Safe reads at named blocks (independent RPC) — **not yet supplied.**
- §9.2-4: route-level authz re-audit on the 63-route authoritative surface (incl. `ai/consensus`, `ai/catalog-sync`) — **Phase-1 input, pending.**
- §9.2-5: GitHub-side token audit — **not yet supplied.**
- §9.2-6: platform audit logs for the re-image/checkout events — **not yet supplied.**
- §9.2-7: re-verification drill on the authoritative lineage post-restoration (T-4/T-27-class) — **pending restoration.**
- §9.2-8: one captured live BLOCKED relay + post-restoration heartbeat continuity — **pending scheduler fire/restoration.**
- §9.2-9: GitHub-side branch-protection/CI attestation — **not yet supplied.**

## 7. Final gate status

```
PHASE 0 — INDEPENDENT REVIEW IN PROGRESS
PHASE 1 — NOT AUTHORIZED
TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED
```

No P0/P1 finding is claimed resolved; every resolution claim awaits independently verified evidence (owner/reviewer). No implementation changes of any kind were made in this assignment: three documents added on a fresh branch from authoritative main; no merges, no boots, no history writes, no key operations, no credential changes.
