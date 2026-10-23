# MTQΣ — TASK 13 · Security Remediation & Release Gates (deliverable 12)

**Renamed this cycle:** `security-remediation-and-migration-readiness.md` → **`security-remediation-and-release-gates.md`** per MANDATE-006 §16.10 (git history preserved; every prior citation of the old filename refers to this file). §12 (MANDATE-006 §12 mapping + final operating restrictions) added 2026-10-22; §§1–11 are unchanged from the prior cycle.

**Consolidates Task 12 D2 (secret-containment status) · D3 (git-history remediation plan) · D4 (EVM authority-migration package) · D5 (Solana authority-migration package) · D8 (owner-approval checklist) · D10 (remaining risks) into the Task 13 view — plus the incident-disposition report for T13-INC-001 required by MANDATE-004 §2.**

- **Status:** PRODUCED (v1 — Stage B–K, wave 1). This file replaces the 2026-10-22 placeholder stub entirely. Producing a document executes nothing, approves nothing, and advances no release gate (Task 10 D8 / Task 11 D9 / Task 12 standing rule).
- **Evidence-status legend** (per `audit-work/task13/README.md`): `VERIFIED` (independently reproduced with cited evidence) · `DEVELOPER-REPORTED` (stated by prior in-repo work, cited) · `SIMULATED` · `PROPOSED` (design content requiring approval, not implemented) · `UNVERIFIED` (could not be confirmed; environmental limitations are reported as UNVERIFIED, never as PASS) · `NOT IMPLEMENTED`. Every claim below carries a status.
- **Sources:** shared worklog (Task IDs 12, 13-0, 13-a1/a2/a3, 13-b); `security-incident-private-key-upload-2026-10-22.md` (this directory — incident T13-INC-001); Task 12 `TASK12-EXECUTIVE-REPORT.md`, D2, D3, D4, D5, D8, D10, `register-task12.json`, evidence files (`redaction-report-task12.json`, `fresh-anchors-task12.json`); `baseline-and-change-matrix.md` §0/§9; root `CRITICAL-PRIVATE-KEY-ROTATION.md`.
- **Safety discipline held while writing this document:** no file under `upload/` was ever opened, read, printed, hashed, or copied; no `.env` or secret-shaped file was read; no state-changing command was run; no key material, literal, or value appears anywhere below — redacted fingerprints only (e.g. `0xdbe1…62d6`). `VERIFIED`
- **Lineage:** deliverable 12 of the Task 13 set. The prior stub (2026-10-22) described this consolidation as Task 12 D3/D4/D5/D8 only; this v1 additionally consolidates **D2** (containment status) and **D10** (remaining risks) and adds the **T13-INC-001 disposition report** — as MANDATE-004 §2 requires. Prior-cycle documents are cited, never edited.
- **Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

## MANDATE-004 §2 clause coverage map (every clause addressed)

| Clause | Requirement (abridged) | Addressed in |
|---|---|---|
| 1 | Never read/print/copy/hash/export/load/use key material; value-safe incident tooling only | §1.2, §1.3, §9, §10 |
| 2 | Provide the exact quarantined file path + supported deletion procedure; do not guess the path | §1.1, §1.4 |
| 3 | Do not delete or modify files outside explicitly approved scope | §1.3, §9 |
| 4 | Preserve redacted incident evidence; update the incident record when an authorized disposition occurs | §1.4 (update protocol), §8 (D-13.1) |
| 5 | Do not suppress the finding or weaken secret scanning to make the gate green | §1.2, §5, §7 |
| 6 | Continue preparing rotation/migration materials without signing, broadcasting, or changing authority | §6, §9 |
| 7 | Report separately per credential: addresses, role holders, Safe ownership, remote Git history, CI logs, session logs, backups, clones, custody — verified vs unverified distinguished | §2, §3 |

**Mandate restatement, carried through this entire document:** *the uploaded copy being deleted does not constitute complete incident containment or key rotation.* No statement below may be read as claiming otherwise.

---

## §1 Incident T13-INC-001 — disposition status (P0)

**Summary:** on 2026-10-22 the mandate-transmission message (MTQSIGMA-COO-MANDATE-004 cycle) arrived with an attached private-key file and an instruction to place it in `.env`. The instruction was **REFUSED**; the file was quarantined and value-safely classified as the **already-known compromised EVM literal C-045-a (R-1)** — not a new third key. `VERIFIED` (incident record; worklog Task ID 13-0).

### 1.1 Exact quarantined file — facts (metadata only; contents never accessed)

| Property | Value | Status |
|---|---|---|
| **Exact path** | `/home/z/my-project/upload/private_key.txt` | `VERIFIED` — this is the path; no other path is asserted or guessed |
| Size | 66 bytes | `VERIFIED` (stat metadata) |
| Owner / group | `root:root` | `VERIFIED` |
| Mode | `777` (world-readable/writable on the sandbox host) | `VERIFIED` |
| mtime | 2026-10-22 13:26:35 UTC (15:26 Africa/Cairo) | `VERIFIED` |
| Classification | Known compromised literal **C-045-a**, redacted fingerprint `0xdbe1…62d6` — the EVM key recorded compromised since the Task 10 incident (**R-1**) | `VERIFIED` via the Task 12 fingerprint-anchored scanner (`scripts/security/secret-scan.ts --path`), which outputs only file + rule + redacted fingerprint. The file was **never opened, read, printed, hashed, copied, exported, or loaded** by the AI. Zero AI-side content exposure. |

### 1.2 Containment state (all `VERIFIED` 2026-10-22; evidence: incident record §2, `baseline-and-change-matrix.md` §9)

1. **Commit-impossible:** matched by two pre-existing `.gitignore` rules — `.gitignore:63` (`upload/*.txt`) and `.gitignore:64` (exact path). No bulk `git add` can stage it.
2. **Never tracked:** `git ls-files upload/` lists documents/media only.
3. **Never committed:** `git log --all --oneline -- <exact path>` → empty across all refs.
4. **Fresh full-worktree secret scan (2026-10-22):** 2,183 files scanned, 14 documented suppressions, **exactly 1 finding = this file** (rule `known-compromised-literal-C-045-a`); all other worktree files clean. **The worktree gate is truthfully RED and stays RED until owner disposition D-13.1.** This is the gate working as designed — fail-closed — not a regression. The commit-blocking gates (pre-commit / staged mode) are unaffected because the file is gitignored.
5. **chmod 600 FAILED** — `Operation not permitted` (root-owned file; session runs as uid `z`). Recorded as a **host-side residual limitation**: host-level access control over `upload/` is outside session control and is an owner-side item (same class as OWNER-ATT-1).
6. **No use:** no signing, no address derivation, no import, no verification call, no copy — the key was not processed in any way beyond the scanner's fingerprint classification.
7. **Zero AI-side content exposure:** the key material never entered any AI transcript, tool output, log, or derived artifact (contrast with the Task 10/11 transcript-emission incident class, PI-3 — this event was handled with zero content exposure because Task 12 tooling is value-redacted by design).

### 1.3 What the session did NOT do, and why (mandate clauses 1 and 3)

- **The session did NOT delete the file.** Reasons, all standing: (a) it is an **owner file**; (b) deletion is a **destructive action** requiring explicit approval (mandate §2.3 — no destructive action on a "continue" instruction); (c) the file is **forensic evidence** of this incident. `VERIFIED` (worklog Task ID 13-0; incident record §5).
- No `.env` write occurred (refused: it would create a fresh plaintext worktree copy of an already-compromised key — exactly the exposure class Task 12 removed; no in-scope operation needs any key).
- No suppression, allowlisting, or weakening of the scanner was performed to green the gate (clause 5). The two compromised literals are **unsuppressible tripwires** by design.
- No file outside the approved scope (this deliverable) was created, modified, or deleted this cycle.

### 1.4 Disposition options for the owner — approval D-13.1 (OPEN; no default action taken)

- **OPT-1 (session-supported procedure — recommended):** the owner authorizes deletion by **explicit instruction naming the exact path** `/home/z/my-project/upload/private_key.txt`. Sequence: owner names the path → session executes the deletion → session re-runs the worktree scan → the gate re-scans green (0 findings) → results recorded. The AI will not delete owner files without this explicit, path-naming approval.
- **OPT-2 (platform-side / infra-side):** the owner destroys the file on the platform/infrastructure side (owner-managed; the file is root-owned, so owner-side destruction is fully within the owner's capability); the session then **re-runs the scan to confirm** 0 findings and records the confirmation.
- **Permanently out of scope regardless of any instruction:** placing the key in `.env` or any file; using, deriving, importing, or "testing" with the key; moving it into any tracked location; suppressing or allowlisting the scanner finding. `PROPOSED` boundaries, enforced as refusal rules.
- **Incident-record update protocol (mandate clause 4):** the redacted incident record (`security-incident-private-key-upload-2026-10-22.md`) is preserved unmodified; when an authorized disposition occurs (D-13.1 OPT-1 or OPT-2 executed), the record's disposition/approval sections and the census in §3 below are updated append-only, and the shared worklog receives the entry via the orchestrator.

### 1.5 Deletion ≠ containment ≠ rotation (do not soften this)

Deleting this one copy removes **one platform-stored copy of C-045-a**. It does **not**: revoke or weaken the key's on-chain authority (R-1 remains fully privileged until the D4 package executes through the D8 approvals); remove the literals from git history (D3/T12-1); affect any external copy (remote/CI/backup/clone exposure remains `UNVERIFIED`, OWNER-ATT-1); or change the Solana credential's status (C-045-b, §2.2). A green re-scan proves only that **this worktree** no longer textually contains the literals at scan time. `VERIFIED` (standing rule; incident record §4–§5).

### 1.6 Reproducible value-safe evidence (from incident record §7 — no command outputs key material)

```
stat -c '%U:%G %a %s %y' upload/private_key.txt
  → root:root 777 66 bytes 2026-10-22 13:26:35 UTC
git check-ignore -v upload/private_key.txt
  → .gitignore:63 (upload/*.txt) + .gitignore:64 (exact) — exit 0
git ls-files upload/
  → documents/media only; private_key.txt absent
git log --all --oneline -- upload/private_key.txt
  → (empty)
bun run scripts/security/secret-scan.ts --path upload/private_key.txt
  → FAIL — 1 finding: known-compromised-literal-C-045-a (0xdbe1…62d6, redacted by design)
bun run scripts/security/secret-scan.ts        (full worktree)
  → FAIL — 1 finding (same file); 2,183 files; 14 documented suppressions; all else clean
chmod 600 upload/private_key.txt
  → Operation not permitted (root-owned file)
```

---

## §2 Compromised-credential report (mandate clause 7 — separate per credential)

### 2.1 (a) EVM credential — R-1 / literal C-045-a

| Field | Value | Status |
|---|---|---|
| Literal ID | C-045-a (66-char 0x-hex) — redacted fingerprint `0xdbe1…62d6` | `VERIFIED` |
| Derives to (public address) | EOA `0x3C3932F865892EFabE45892f453f81B64f6c8d8c` | `VERIFIED` (public derivation; D4/D10) |
| Compromised since | The Task 10 incident (exposure window treated as ≥ 2026-08-07) | `DEVELOPER-REPORTED` (Task 10 D1 trail, carried by Task 12 D3 §1) |
| Current status | **REAL and fully privileged — compromised; rotation NOT executed** | `VERIFIED` at fresh anchors (Task 12 probe, hashed evidence `fresh-anchors-task12.json`): **Monad 73,243,944 · Arc 68,520,264 · RH 140,748,341** — every probed cell identical to Task 11; no attacker action observed |

**Role holders affected / what this EOA controls (all `VERIFIED` at the fresh anchors; full inventory = Task 12 D4 §1):**

- **DEFAULT_ADMIN on all 7 AccessControl contracts on both EVM testnets** — per chain: the MTQ token plus the 6 modules (Mint, Redeem, Reserve, Algorithm, Oracle, Takaful); Monad + Arc.
- **Token roles held directly by the EOA:** ADMIN + MINTER + PAUSER on the MTQ token on both chains (D4 §1.1; Arc "same structure" per D4 §1.2). The EOA additionally admin+minter+pauser on Monad MTQ via the Genesis Safe and pauser on Arc MTQ via the Genesis Safe (see next row — the recorded Arc asymmetry is that the **Genesis Safe holds PAUSER only** on Arc).
- **Safe ownership:** **sole owner of the threshold-1 (1/1) Genesis Safes on both chains** (`0xE718…A7D0` family, nonce 0, SafeL2 v1.4.1, fresh-verified) — single-signature control of every role those Safes hold, on both EVM testnets.
- D10 R-1 consolidated profile: "roles ×15, both 1/1 Safes, gen-A ownership, ~100% supplies, natives" — the EOA holds ≈100% of MTQ supplies (Monad 309.949 of 310.949; Arc 998.999…997 of 1,000), native balances (Monad 0.2243 MON · Arc 19.0266 · RH 0.00982 ETH), and **gen-A Ownable `owner()` on four tokens** (`0x5D95…`, `0x5C72…`, `0xA3B8…`, `0x826b…`) — a power that **survives EOA role revocation** and closes only via per-token `transferOwnership`/accept-provenance (D4 §1.4, §5.3).
- **Bypass pathways not closed by rotation alone** (D4 §5): the Governor pair (same hex, two builds — authority unestablishable without source, N-01, no interaction planned); unprobed module custom roles (E-15/E-16); deployer-held balances until evacuation (T-3.8).

**Affected estate at the fresh anchors (public addresses/balances only; the authoritative per-address inventory is Task 12 D4 §1):**

| Chain | Fresh anchor | Key facts |
|---|---|---|
| Monad testnet 10143 | block 73,243,944 | MTQ token `0x9e6E…53aD`: supply 310.949, deployer holds 309.948999999999999997, paused=false; deployer native 0.2243 MON; 6 modules (`0x197e…`/`0x9632…`/`0x1bbC…`/`0x8839…`/`0xDfcA…`/`0x3eC2…`) all DEFAULT_ADMIN'd by the EOA; Genesis Safe `0xE718…A7D0` 1/1, sole owner = EOA, nonce 0 |
| Arc testnet 5042002 | block 68,520,264 | Supply 1,000, deployer holds 998.999999999999999997 MTQ + 19.0266 native; same 7-surface admin profile; **Genesis Safe holds PAUSER only on Arc** (recorded asymmetry — normalize per owner decision); Governance same hex, different build (N-01) |
| Robinhood Chain 46630 | block 140,748,341 | Provenance tier — disposition, not rotation: gen-A "MTQSigma" `0xA3B8…44EF0` Ownable `owner()` = EOA; gen-B twin `0xAF5B…C5A5`; deployer txCount 60, native 0.00982 ETH; "Safe" `0xa3CE…5691` re-proven NOT a Safe (reverts on Safe ABI) |

**Containment state for this credential:** repository worktree purged (§4); git history still contains the literal in every reachable commit (§3); the new quarantined platform copy is pending D-13.1 (§1). **Nothing on-chain has changed: the key remains fully privileged.** Only D4 execution through the D8 approvals changes any row above.

### 2.2 (b) Solana credential — literal C-045-b

| Field | Value | Status |
|---|---|---|
| Literal ID | C-045-b — redacted fingerprints `58c19e…eb60` (128-hex seed‖pubkey) / base58 `2mvV…j13V` (88 chars) | `VERIFIED` |
| Derives to (public address) | `4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d` (4saT…) | `VERIFIED` (public; D5 §1.2) |
| Authorities held | **Mint authority AND freeze authority of the superseded Solana devnet mint** `2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY` — anyone holding the literal can mint unlimited old-generation tokens and freeze any old-mint account | `VERIFIED` at fresh anchor **slot 513,885,476** (Task 12 probe; identical to Task 11) |
| Associated wallet | The 4saT wallet: **4.98368596 SOL drainable by any repo holder** (fresh), plus the 4saT ATA holding 100% of the old supply (4,477,988,020,393,345,024 raw units) | `VERIFIED` (D5 §1.2) |
| Current status | **REAL, live-privileged — compromised; rotation NOT executed** | `VERIFIED` at slot 513,885,476 |

**Census correction the owner must accept (T12-0, `DEVELOPER-REPORTED` → corrected by Task 12 scanner, `VERIFIED`):** the Task 10/11 census claimed "base58 secrets: none." Task 12 found a **7th worktree copy of C-045-b in base58 form** embedded in `scripts/verify-sol-key2.ts` (seed‖pubkey). It was identified **crypto-free** — by checking the embedded *public* 4saT address, with the secret value never printed or re-derived — then purged; the script is now a fail-closed retired stub. Prior census claims are superseded (D2 §2; executive report §1).

**Exposure channels for C-045-b (state):** worktree — purged in both encodings, `VERIFIED` (incl. the corrected base58 census); git history — both forms present in all reachable commits, `VERIFIED`-contaminated (D3 plan covers all encodings); remote/CI/backups/clones — `UNVERIFIED` (OWNER-ATT-1); transcript — no known base58 emission, no new emission in Task 12/13 (`DEVELOPER-REPORTED` where not independently checkable).

**Related-but-distinct Solana fact (not this credential):** the *current* mint `GAGRdrY6…` is controlled by single key `DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3`, which was **never in the repo** — its custody is `UNVERIFIED` (CKPT-2 / OWNER-ATT-2); the DbFjz wallet holds 9.99500752 SOL (fresh). Do not conflate: the compromised credential is C-045-b/4saT (superseded mint + wallet); the DbFjz key is an open custody question, not a repo exposure.

### 2.3 What is common to both credentials

- Both are **self-authenticating compromised credentials**: repository cleanup, file deletion, allowlists, and scanners stop ongoing *spread* only. **Only the on-chain rotation packages (D4 EVM, D5 Solana), executed after the D8 owner approvals, remove their power.** `VERIFIED` (standing rule; CRITICAL-PRIVATE-KEY-ROTATION.md).
- Neither key was loaded, used, signed with, or re-derived at any point in Task 12 or Task 13. All verification is public-address, read-only. `VERIFIED`

---

## §3 Exposure-location census — VERIFIED vs UNVERIFIED (mandate clause 7)

| # | Location | State | Status | Evidence / note |
|---|---|---|---|---|
| 1 | **Repository worktree** | Clean post-purge **except** the quarantined upload: full scan = exactly **1 finding = `upload/private_key.txt`**; all other files 0 findings (2,183 files, 14 documented suppressions) | **VERIFIED** (clean post-purge; the 1 finding is the quarantined upload pending D-13.1) | Fresh scan 2026-10-22; baseline §9; D2 |
| 2 | **Git history** | **Contaminated:** both literals present in **every encoding** (C-045-a 66-hex; C-045-b 128-hex; C-045-b base58) in all reachable commits since the 2026-10-19 baseline squash (25/25 at the Task 11 census; unchanged by Task 12). History **intentionally untouched** — the D3 rewrite plan awaits owner + security-lead approval (T12-1) | **VERIFIED (contaminated)** | D3 §1; D2 |
| 3 | **Remote Git repository** | No remote is configured or known to exist (`git remote -v` empty). "No local remote" proves nothing about hosted copies — 6 GitHub workflow files imply hosting intent | **UNVERIFIED** — OWNER-ATT-1 attestation required | D2; D10 R-4; worklog 13-a3 |
| 4 | **CI logs** | The CI runner has **never executed** (no remote → no trigger surface). `ci.yml` wires secret-scan as job 0 with all jobs needs-dependent; identical commands were proven locally only | **UNVERIFIED** (wiring `VERIFIED`; runner execution never observed) | D2 §3; D10 R-15; worklog 13-a3 |
| 5 | **Session / AI transcripts** | Two facts: (i) the Task 10/11 transcript-emission incident class (PI-3 — the EVM literal was argv-printed once into an AI-session terminal; retention/access owner-side) **stands**; (ii) T13-INC-001 added the new exposure-taxonomy class **"owner upload into AI-session server storage"** — this event itself caused **zero** content exposure (value-safe tooling) | **PARTIALLY VERIFIED** (prior emission disclosed and stands; platform retention policy outside audit control) | D2 §1; D10 R-3; incident record §4 |
| 6 | **Platform upload storage** | **One copy** of C-045-a at the exact path in §1.1 — quarantined (double-gitignored, never tracked/committed, never read), pending owner disposition **D-13.1**; root-owned mode-777 file (host-side access control outside session reach) | **VERIFIED** (existence, metadata, classification; disposition `UNVERIFIED` until D-13.1) | Incident record §1–§2 |
| 7 | **Backups** | Absent locally **by design** (`backups/` is gitignored; produced only by the CI `backup.yml` job, which has never run from this clone) | **UNVERIFIED** whether any backup exists anywhere | Worklog 13-a3; OWNER-ATT-1 |
| 8 | **Clones** | No clones are known; any pre-rewrite clone retains both literals in full history | **UNVERIFIED** | D3 §2; OWNER-ATT-1 |
| 9 | **Custody systems** | No custody documentation exists for: the DbFjz current-mint key (CKPT-2/OWNER-ATT-2), the proposed Safe-B signers (none generated — ceremony pending, CKPT-3/4), or a Squads multisig identity (prior candidate probe returned NULL; nothing asserted — CKPT-8) | **UNVERIFIED** | D5 §3; D8 |
| 10 | **Owner-side devices / channels** | Outside repository visibility entirely. **Demonstrated live by T13-INC-001 itself:** a key copy traversed the chat channel into platform storage on 2026-10-22 — new copies can appear at any time via this channel | **UNVERIFIED** (and provably re-populable) | Incident record §4–§5 |

**Reading rule:** `UNVERIFIED` never means "absent" — it means the audit could not confirm. Rows 3, 4, 7, 8, 9, 10 are gated on OWNER-ATT-1 / OWNER-ATT-2 attestations and are part of the key-risk clock that makes rotation urgent.

### 3.1 How each `UNVERIFIED` row closes (owner actions — none performed by this audit)

| Row | Closure path | Then
|---|---|---|
| 3 Remote | OWNER-ATT-1 attestation (hosted repo ever existed? Y/N/unknown) | If Y/unknown → T-0.4 credential rotation + platform-side history purge (support ticket); blast radius feeds D3 §2 |
| 4 CI logs | OWNER-ATT-1 + connect a remote under branch protection → observe the gate actually run | Actions caches/artifacts invalidated if any ever existed (D3 §3 step 7) |
| 7 Backups | OWNER-ATT-1 (any CI-produced backup artifact ever downloaded/retained?) | Declare void per T12-2 if pre-rewrite |
| 8 Clones | Owner enumerates every machine/holder that ever cloned | T12-2 invalidation notices + re-clone after the rewrite |
| 9 Custody | CKPT-2 (DbFjz) · CKPT-3/4 (Safe-B signers) · CKPT-8 (Squads identity, owner-side live verification) | Custody + recovery documentation recorded owner-side |
| 10 Owner-side | Owner-side sweep of devices/channels that ever held either key | Behavioral rule §7.1 (never via chat) is the only durable control |

---

## §4 What has been done (Task 12 — all evidence-cited; repository-side only)

1. **Worktree purge of both literals** — all 9 known worktree occurrences removed (2 EVM incl. the worklog plaintext quote, replaced in-place by an append-only redaction notice; 6 Solana hex; 1 base58 missed by the prior census), via the fingerprint-anchored `scripts/security/redact-known-secrets.ts` which never prints matched values; sha256 before/after chain in `audit-work/task12/evidence/redaction-report-task12.json`. Post-purge sweep: zero occurrences. `VERIFIED`
2. **Value-safe fingerprint-anchored scanner** — `scripts/security/secret-scan.ts`, fail-closed: 10 rule families (EVM raw-64/128-hex, base58 secret-vs-signature context-gated, keypair-JSON, mnemonic, env, PEM) plus **both compromised literals as unsuppressible tripwires**; documented allowlist (11 entries; 14 suppression hits across the full tree). `VERIFIED`
3. **Scanner regression tests 12/12 PASS** — a seeded **synthetic** secret blocks the gate (exit 1) **without its value ever printing**. `VERIFIED`
4. **CI wiring** — `ci.yml` runs `secret-scan` as the **first job** with every other job needs-dependent. Wiring `VERIFIED`; **runner execution UNVERIFIED** (no remote exists). Pre-commit hook active in this clone (`core.hooksPath=.githooks`); `tool-results/` AI-tool cache gitignored after byte-verification. `VERIFIED`
5. **Fail-closed release controls** — `src/lib/mtq/release-controls.ts`: 8 separate control states × 10-action map, **default-deny**; grants exist **only** via an owner-authored authorization file outside git (partial/malformed = denied); no inference from build/tests/sessions/endpoints. 13/13 control tests. `VERIFIED`
6. **Keeper guard verified live** — `isActionAllowed("keeper-tx-submission")` is the **first** statement of the keeper's `runTick`, before provider/signer/contract construction; live service shows `grantedControls=0`, `allowed=false`; manual `POST /tick` observes-only. This is the only transactional path in the system. `VERIFIED`
7. **Key-dependent scripts eliminated** — the two "verify key" scripts became public-address **read-only auditors**; 5 Solana action scripts + the multisig draft + `verify-sol-key2.ts` became fail-closed retired stubs; the keygen helper no longer prints secrets (the PI-3 hazard class), writes 0600 behind an ack flag. `VERIFIED`
8. **Address-book validation** — `src/lib/mtq/address-book-validation.ts`: honest-red verdict **ok=false** with **2 BLOCKERs** (RH "Takaful" hex == Monad "Reserve"; RH "MockUSDC" == Arc "Oracle"), flagged Safe/Governance hex reuse, and **APPROVED-CANONICAL count = 0 by design** (no auto-selection; findings surfaced, records never deleted). 12/12 tests. `VERIFIED`
9. **Unsigned migration packages** — D4 (EVM) and D5 (Solana), execution-ready, re-anchored at fresh blocks/slot, with disclosed handover window, enumerated bypass pathways, and explicit blocker lists (§6 below). `PROPOSED — NOT SIGNED — NOT BROADCAST — NOT EXECUTED`
10. **D3 git-history rewrite plan** — precise, ready to execute after approval (all encodings, reflog expiry, re-clone, forensic-bundle preservation, post-rotation of reachable credentials); **plan only — history intentionally untouched.** `PROPOSED`
11. **Documentation hygiene** — `SECURITY.md` §9 incident/rotation procedure; `CRITICAL-PRIVATE-KEY-ROTATION.md` corrected to the current facts; incident record T13-INC-001 produced with redacted fingerprints only. `VERIFIED`

**Task 12 verification record (executive report §2 / D1 §E — reproduced at Task 12 time):**

| Check | Task 12 result | Task 13 fresh re-run (2026-10-22, baseline §9) |
|---|---|---|
| typecheck / lint | PASS / PASS (0 findings) | PASS / PASS |
| Worktree secret gate | PASS (0 findings — pre-incident) | **FAIL = exactly 1 finding** (the quarantined upload; truthful red, by design) |
| Scanner regression suite | 12/12 PASS | 12/12 PASS (behavioral cases) |
| Release-controls / address-book suites | 13/13 / 12/12 PASS | 13/13 / 12/12 PASS |
| Full `bun test` | 37/37 PASS | 36 pass / 1 fail — same single cause (the gate is no longer green) |
| Canonical invariants | PASS (exit 0, Layers 1–8) | `UNVERIFIED` this cycle — 3 documented attempts killed by sandbox timeouts; recorded as UNVERIFIED, never PASS (no source changes since the Task 12 PASS) |
| Keeper guard (live) + `/api/release-state` | PASS (0 grants, observe-only) | not re-run this cycle (last live proof = Task 12) |
| CI-runner execution | `UNVERIFIED` (no remote) | `UNVERIFIED` (unchanged) |

**No gate is advanced by any item above.** All 8 release controls remain NOT_GRANTED; all 11 §25.5 gates remain NOT CONDUCTED.

---

## §5 What remains open (not softened — the security truth)

1. **Key rotation NOT executed.** Both compromised keys remain **REAL and fully privileged** at the latest fresh anchors (Monad 73,243,944 · Arc 68,520,264 · RH 140,748,341 · Solana slot 513,885,476). R-1/R-2 severity: CRITICAL. `VERIFIED`
2. **Git history still contains both literals in every encoding.** Every day of retention leaves them one `git log -p` away from any repo reader; the D3 rewrite needs T12-1 (owner + security lead). `VERIFIED`
3. **Remote / CI / backup / clone exposure UNVERIFIED** — OWNER-ATT-1 gates the credential-rotation set and the D3 blast radius. `UNVERIFIED`
4. **The uploaded platform copy is pending owner disposition D-13.1** — and its deletion (when it happens) is **not** containment or rotation (§1.5). `OPEN`
5. **Host-level access control over `upload/` is outside session control** — a root-owned, mode-777 key file on the sandbox host; owner-side item. `VERIFIED limitation`
6. **No independent security reviewer commissioned yet** (CKPT-9) — no "contained/rotated/revoked" language is permitted before that review (D9 scope: scanner efficacy, allowlist audit, release-control red-team, keeper-guard re-review, redaction-marker integrity, history-rewrite verification). `OPEN`
7. **APPROVED-CANONICAL count = 0** — no authoritative address book exists; canonical architecture UNSELECTED (DEC-1…7 pending). `OPEN`
8. **All 18 deployed contracts are source/build-identity UNVERIFIED** (size/name/selector/address matching is insufficient); every probed authority currently resolves to the compromised EOA; the Monad Redeem-module token-MINTER grant origin remains unexplained (finding preserved OPEN). `UNVERIFIED / OPEN`
9. **The chat/upload channel itself is a live re-contamination path** — proven by T13-INC-001; no repository control can close it (§7). `VERIFIED`

---

## §6 Rotation & migration readiness chain (unsigned, unchanged)

**State: execution-ready, unsigned, approval-gated. No signing, no broadcasting, no authority change has occurred — and none is authorized by this document or by any general "continue" instruction.** `PROPOSED`

**Approval chain (Task 12 D8 — full register in §8):**

```
OWNER-ATT-1 (remote/CI/backup existence attestation)
   → T12-1 (git-history rewrite, D3) / T12-3 (credential rotation set, conditional)
   → CKPT-2 (DbFjz custody attestation)  ·  CKPT-3/4 (signer ceremony → ⟨OWNER-1..7⟩)
   → CKPT-5/6 (Safe-B dossiers + quorum proofs + grant set; opens the handover window)
   → CKPT-7 (revoke set + evacuation destinations)
   → T12-5/6/7 (factory/fallback policy · handover-window policy · module-MINTER policy)
   → T12-8 (4saT SOL evacuation urgency) · CKPT-8 (Squads identity) · SOL-DEC-1 · DEC-3
   → CKPT-9 (independent reviewer) — precedes ANY "contained" language
   → RELEASE-GRANTS (owner-authored file outside git — the only grant path)
```

**D4 — EVM authority-migration package (summary; contents per Task 12 D4):** fresh-anchored authority inventory (Monad/Arc/RH); destination = new **Safe-B 4-of-7** per chain (the current 1/1 Safes are NOT acceptable destinations — sole owner is the compromised EOA); **grant-before-revoke** sequence — Phase 1 destination provisioning with the **T-1.4 quorum-proof hard gate** (a 4-signature no-op exec must succeed before any estate change), Phase 2 grants by the exposed key **in an owner-controlled session only** (never this repo/AI environment), Phase 3 revocations executed by Safe-B with the deployer-strip **last and irreversible** (T-3.6/T-3.7), then T-3.8 evacuation. The **unavoidable handover window** is disclosed (R-13: between Safe-B deployment and deployer strip, the compromised key remains fully privileged; owner picks the policy — T12-6, all options imperfect). Bypass pathways explicitly not closed: Governor pair (N-01), unprobed module roles (E-15/16), gen-A `owner()`, deployer balances. **Preconditions missing today:** ⟨OWNER-1…7⟩ do not exist yet (human ceremony, CKPT-3/4); factory/fallback policy (T12-5); ECON-DEC-2; evacuation destinations (CKPT-7); N-01; OPS-DEC-1.

**D5 — Solana authority-migration package (summary; contents per Task 12 D5):** mint-by-mint dossiers at slot 513,885,476; superseded mint → **evacuate-then-revoke**: T-4.4 (evacuate the 4saT wallet's 4.98 SOL, with/before the revocations — an authority-dead wallet stays drainable) then T-4.3/T-4.5 (`SetAuthority → None` for mint and freeze, permanent — S-5 default); current mint → SOL-DEC-1 (S-1 transfer to multisig / S-2 revoke / S-3 leave-pending / S-4 redeploy); **u64 decimals design-decision analysis** — decimals ≤ 9 is an **economic OPTION (DEC-3), never auto-selected**; the historical 10B×10¹⁸ plan is arithmetically unrepresentable and its script is a fail-closed stub. Squads 2-of-3 destination identity is **UNVERIFIED** until owner-side verification (CKPT-8). Sequencing is **independent of the EVM phases and NOT a prerequisite of repo housekeeping** — waiting for the history rewrite only extends the window in which any repo holder can act with the old literals (C11.1-05 rule).

**Dependency graph (Task 12 D10 §B, carried unchanged):**

```
[DONE K-1] worktree purge + scanner + hooks + CI config + release controls (Task 12)
   ├─ OWNER-ATT-1 (remote?) ──► T-0.4 credential rotation (conditional)
   ├─ T-1.1 signer ceremony ─► T-1.2/T-1.3 Safe-B deploys ─► T-1.4 QUORUM PROOF (hard gate)
   │        └► Phase 2 grants (EXPOSED-KEY session, owner-controlled) ─► Phase 3 revokes (Safe-B; T-3.6/3.7 LAST)
   │                 └► T-3.8 evacuation (per-destination probe-verified)
   ├─ Solana: CKPT-2 ─► SOL-DEC-1; CKPT-8 ─► (if S-1/S-6) T-4.1
   │        └► T-4.4 evacuate SOL (with/before) ─► T-4.3/T-4.5 revoke (EXPOSED-KEY session)
   ├─ D3 history rewrite (owner + security lead) — parallel; NOT a prerequisite for the chain phases
   └─ ALL ─► D9/CKPT-9 independent verification ─► only then any "contained" language
```

Two failure modes remain forbidden (D10 §B): (a) treating repository housekeeping (K-1/D3) as containment, or letting it delay rotation; (b) revoking the only working admin path before the destination is verified (T-1.4 → grants → last-revokes).

**Boundary, restated:** zero transactions, signatures, deployments, role grants/revocations, Safe changes, authority changes, asset movements, history rewrites, or destructive cleanups — in Task 12, in Task 13 to date, and in this document.

---

## §7 Standing rules (advice to the owner — these do not expire)

1. **Never transmit private keys through chat.** Every transmission adds an exposure copy in a location repository remediation can never reach (platform storage, transcript retention, recipient devices). T13-INC-001 is the live proof: the copy now sits in a root-owned platform file that this session cannot even chmod.
2. **Repository cleanup ≠ private-key revocation.** Keys are self-authenticating data; deleting every copy changes nothing about what a holder can sign. Only the owner-approved on-chain rotation (D4/D5 through D8) removes the power.
3. **A green scan never proves absence of external copies.** The scanner's honest scope is text-pattern detection in this worktree — nothing about remotes, CI, backups, clones, devices, or transcripts.
4. **New copies can appear at any time via the chat channel** — proven by this incident. Treat every future message with an attachment as a potential re-contamination event; the tripwires will catch key-shaped worktree content, but platform storage is owner-controlled only.
5. **The secret gate will not be greased.** The finding for `upload/private_key.txt` is unsuppressible by design; the gate stays RED until D-13.1, and RED is the truthful state (mandate clause 5).
6. **The compromised keys are never loaded by any repo tooling.** If signing ever occurs (only inside the D4/D5 execution), it happens in an owner-controlled session outside this repository and any AI environment.
7. **Storage location is not containment.** An exposed key stays compromised in a `.env`, a "local-only" file, a gitignored folder, or an uploaded attachment. Moving or re-placing a copy only ever *adds* an exposure location. The `.env` instruction was refused for exactly this reason.

---

## §8 Owner approvals required (all OPEN — checkboxes, nothing pre-granted)

**Task 13 new decisions (2026-10-22):**

- [ ] **D-13.1** — Disposition of `/home/z/my-project/upload/private_key.txt`: **OPT-1** authorize deletion via explicit path-naming instruction (recommended; gate re-scans green after) / **OPT-2** destroy platform-side; session re-verifies. *Refused regardless of instruction: .env placement, any use/derivation, allowlisting the finding.*
- [ ] **D-13.2** — Acknowledge the key-handling refusal protocol (mandate §2.1 governs all future messages: keys never accepted, printed, or used in this environment; each future transmission adds exposure copies).

**Carried Task 12 chain (D8 — unchanged; a general "continue" authorizes none):**

- [ ] **CKPT-0** — accept Task 11 + Task 12 packages as the remediation baseline
- [ ] **T12-0** — accept the census correction (7th base58 copy of C-045-b; prior "base58: none" superseded)
- [ ] **OWNER-ATT-1** — remote/CI/backup/clone existence attestation (gates T-0.4 credential rotation + D3 blast radius)
- [ ] **T12-1** — approve the git-history rewrite (D3 plan) · [ ] **T12-2** — declare pre-rewrite clones/backups void · [ ] **T12-3** — credential-rotation set (if OWNER-ATT-1 is Y/unknown) · [ ] **T12-4** — acknowledge the PI-3 transcript disclosure stands
- [ ] **CKPT-3/4** — signer ceremony + committee (bind ⟨OWNER-1…7⟩) · [ ] **T12-5** — SafeProxyFactory/fallback policy · [ ] **CKPT-5/6** — Safe-B dossiers + grant set · [ ] **T12-6** — handover-window policy · [ ] **CKPT-7** — revoke set + evacuation destinations · [ ] **T12-7/OPS-DEC-1** — module-MINTER end-state
- [ ] **CKPT-2 / OWNER-ATT-2** — DbFjz custody attestation · [ ] **T12-8** — 4saT 4.98 SOL evacuation urgency · [ ] **CKPT-8** — Squads identity (owner-side verification) · [ ] **SOL-DEC-1** — current-mint disposition (S-1…S-4) · [ ] **DEC-3/ECON-DEC-3** — Solana decimals (economic; never auto-selected) · [ ] **ECON-DEC-2** — Reserve-module MINTER policy
- [ ] **DEC-1…DEC-7** — canonical architecture selection (APPROVED-CANONICAL = 0) · [ ] **T12-9** — adopt address-book validation as standing inventory tool
- [ ] **CKPT-9** — commission the independent security reviewer (precedes any "contained" language) · [ ] **K-7** — post-verification address-book Tier-1/Tier-2 updates
- [ ] **RELEASE-GRANTS** — any control grant, via the owner-authored authorization file outside git (the only path; none exists today — 8/8 controls NOT_GRANTED)

**Smallest set that moves containment** (D10 §D): OWNER-ATT-1 → CKPT-2 → CKPT-3/4 (longest lead) → T12-8/T-4.4 → D3 approval.

---

## §9 What has NOT been done this cycle (and will not be done without approval)

- **No deletion of `upload/private_key.txt`** — pending D-13.1 (owner file; destructive; forensic evidence). No `.env` write, ever.
- **No key rotation, no on-chain action of any kind** — no transactions, signatures, broadcasts, deployments, role/Safe/authority changes, asset movements (Task 12 and Task 13 to date).
- **No git history rewrite** (D3 plan only); **no reflog expiry; no destructive cleanup**; no commits, tags, or pushes; no remote created.
- **No suppression or weakening of secret scanning** to make the gate green — the gate is intentionally RED and honestly reported.
- **No CI-runner execution** (no remote exists; commands proven locally only) — recorded as `UNVERIFIED`, never PASS.
- **No canonical selection, no tokenomics/decimals change, no release-gate advancement** — documentation, typecheck, lint, and tests advance nothing.
- **No independent reviewer commissioned** (CKPT-9 open); **no "contained/rotated" language is used anywhere in this package.**
- **No reading of any file under `upload/`, no `.env` read, no key material processed** — beyond the scanner's value-safe fingerprint classification of the quarantined file.

## §10 Honest limits of this document

1. **Scanner scope:** text-pattern detection in this worktree only. It cannot see remotes, CI systems, backups, clones, owner devices, platform retention, or an adversary's copy. All such rows are `UNVERIFIED` by construction.
2. **`UNVERIFIED` ≠ absent.** Every unverified row is an open question for the owner, not a clean bill of health. Environmental limitations are never reported as PASS.
3. **Fresh anchors are point-in-time, scoped reads:** "verified at the recorded block/slot, for the queried addresses and methods" — no broader claim of attacker absence is made or implied.
4. **The uploaded file's host-side posture (root:root, 777) is outside this session's control**; the mitigations in force (double gitignore, never-read policy, unsuppressible tripwire) are repository-side only.
5. **Deleting the quarantined copy (D-13.1) will change exactly one census row** (§3 row 6). It will not rotate either key, clean git history, verify a remote, or constitute containment — per the mandate's own words.
6. **This document is consolidation, not remediation.** It adds no new control, removes no exposure, and advances no gate. The controls that exist are Task 12's, and the decisions that matter are all still the owner's (§8).

---

## §11 MANDATE-005 reaffirmation (2026-10-22) — deletion outcome vs containment, unchanged exposure truth

This section adds no new fact beyond the records cited; it re-separates what the owner's authorized action changed from what it did not, and confirms the exposure census is unchanged.

**1. The local uploaded-key copy is deleted (owner-authorized D-13.1, executed 18:05:22 UTC).** Per the disposition record (`security-incident-private-key-disposition-2026-10-22.md`): single `unlink` of exactly `/home/z/my-project/upload/private_key.txt`, contents never read/printed/copied/hashed/exported/loaded/used; post-deletion verification — targeted scan PASS (path not found), full worktree scan PASS (2,207 files, 14 suppressions, 0 findings), secret-scan suite 12/12, full `bun test` 37/37 exit 0; the 12 collateral `upload/` files and the original incident record verified untouched. The redacted incident record is retained verbatim.

**2. That outcome is NOT containment, and it is NOT rotation.** Exactly one census row changed (§3 row 6 — the worktree copy). Still true, unchanged, and not softened:
- **Compromised EVM authority R-1** (deployer of the deployed testnet estate) and the **compromised Solana credential C-045-b** remain REAL and fully privileged at the last fresh anchors; no rotation has occurred.
- **Git history still contains both key literals** (worktree-clean ≠ history-clean; history rewrite is its own approval-gated plan).
- **Gateway/platform retention of the original chat attachment** (how the key entered this environment) remains **UNVERIFIED — owner-side** (OWNER-ATT-1): this session cannot see, purge, or attest the IM gateway, its storage, or its retention policy.
- **Remote / CI / backup / clone exposure remains UNVERIFIED** (no remote is configured in this repo — `git remote -v` empty — which is an absence of evidence, not evidence of absence; owner-side copies, forks, CI exports, backups, and clones are outside this session's visibility).
- **Custody status of production-grade credentials** (hardware/software custody for any future signer) remains **UNDEFINED** — no custody arrangement exists, is specified, or is approved.

**3. Approved remediation dependencies (unchanged, all OPEN):** the Task 12 D8 chain (OWNER-ATT-1 → T12-1/T12-3 → CKPT-2/3/4 → CKPT-5/6/7) + the owner-authored RELEASE-GRANTS file, before any authority migration, rotation, or v3.0 on-chain implementation. The unsigned Task 12 D4/D5 migration packages remain the only prepared rotation instruments, and remain unsigned by design.

**4. Standing prohibition (reaffirmed verbatim):** no signing, broadcasting, on-chain rotation, authority change, deployment, minting, burning, or transfer is authorized. Nothing in MANDATE-005 alters this; the local deletion was exactly the single narrowly authorized act and is complete.

**5. Records integrity:** the incident record and the disposition record are retained unmodified; this section is an addendum to a consolidation document, not an edit of either forensic record.

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**

---

## §12 MANDATE-006 §12 mapping — security incident, legacy estate, and release restrictions (added 2026-10-22)

MANDATE-006 §12 restates the incident baseline and its seven requirements. Mapping, with the fresh MANDATE-006-cycle verification battery recorded:

| # | MANDATE-006 §12 requirement | Where satisfied | Status |
|---|---|---|---|
| 1 | Never request, reveal, print, copy, or use private-key material | §1.1 (never-read discipline, value-safe classification only); §7 rules 6–7; enforced again this cycle (upload/ and .env unopened) | Held (`VERIFIED` every cycle) |
| 2 | Preserve redacted forensic evidence and the incident record | §1.4 update protocol; incident + disposition records byte-identical | Held (`VERIFIED`) |
| 3 | No Git-history rewrite, no additional deletions, no suppression of findings without an approved recovery plan | §3 row 2 (history intentionally untouched; D3/T12-1 gated); §9 | Held (`VERIFIED`) |
| 4 | Continue the authorized exposure census across remotes, CI, session storage, backups, clones, custody — where access permits | §3 census (10 rows, VERIFIED/UNVERIFIED distinguished); §3.1 closure paths | Maintained; unverifiable rows stay `UNVERIFIED` (never PASS) |
| 5 | Distinguish verified checks from external locations that cannot be inspected | §3 table + §10 honest limits | Held (`VERIFIED` methodology) |
| 6 | Prepare unsigned authority-migration and rotation plans where required | §6 (D4/D5 packages + approval chain, unsigned by design) | Ready, unsigned, `PROPOSED` |
| 7 | No signing, broadcasting, deploying, minting, burning, transferring, rotating on-chain authorities, or changing deployed-contract permissions without separate explicit authorization + prerequisites | §6 boundary (restated); §9; every cycle's execution boundary | Held — zero on-chain actions to date |

**§12 baseline restated (verbatim effect):** the reported local deletion of the uploaded private-key copy (D-13.1, executed 18:05:22 UTC, §11) does **not** mean the broader incident is contained or that any compromised authority has been rotated. The compromised EVM and Solana credentials (R-1/C-045-a, C-045-b), the historical Git exposure, the deployed authorities (all resolving to the compromised EOA at the last fresh anchors), custody uncertainty, and external retention/exposure questions remain **separate remediation concerns** until verified evidence proves otherwise.

**Fresh MANDATE-006-cycle verification battery (2026-10-22, 20:41–21:0x UTC; exact commands, exit codes recorded):** worktree secret scan **PASS (0)** — 2,221 files, 14 documented suppressions, 0 findings · typecheck **PASS (0)** · lint **PASS (0)** · `bun test` **37/37 (0)** · canonical Layer-8 focused run **85/91, 6 fail, exit 1** (the known six stale assertions; byte-identical set; evidence `evidence/l8-focused-mandate006-2026-10-22.txt`) · deterministic Layers 1–6+8 isolated run **237/243, exit 1** (L1–6 all green 152/152; same six L8 fails; evidence `evidence/l-deterministic-mandate006-2026-10-22.txt`) · Layer 7 carried unchanged from the recorded chunked evidence (no source change since) · `upload/private_key.txt` confirmed **absent** (deletion stands) · git: clean tree at `12dc545`, **no remote** (remote/CI/backup/clone exposure unchanged `UNVERIFIED`, OWNER-ATT-1).

### 12.1 Release-gate taxonomies (mapped once, never collapsed)

Per the Stage-A record (`baseline-and-change-matrix.md` §13-a1 digest), three gate taxonomies coexist and all remain in force: (i) the **7 release indicators** (Task 10 D8 / Task 11 D9: PARTIAL / FAIL / NOT PERFORMED / NOT GRANTED / ABSENT / NOT AUTHORIZED); (ii) the **11 §25.5 validation gates** (`honest-status.ts:37-117`, all NOT CONDUCTED); (iii) the **SSOT G0–G7 mandate gates** (blueprint-v2.0 Appendix F). Standing rule (Task 10 D8 / Task 11 D9 / Task 12 D10 §C): **documentation, typechecking, linting, and tests never advance any gate.** MANDATE-006 §20 final operating restrictions are additive and fully in force (§12.2).

### 12.2 MANDATE-006 §20 final operating restrictions — mapped

No production authorization · no signing/broadcasting · no live issuance/burning · no transfers or authority changes · no live migration or contract upgrade · no live reserve transactions · no suppression of security findings or weakening of required tests · no claim of independent economic validation until actually completed · no claim that dynamic replacement, CBDC support, or stablecoin-funded issuance is operational without specific evidence. **All held this cycle.** The expected final-report discipline (precise file paths, test commands, exit codes, source versions, evidence references; no claim without current evidence) is implemented in `test-matrix-and-results.md`, this file, and the shared worklog.

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
