# Phase 0 — Public Object Exposure and Review Addendum (COO corrective directive)

**Document ID:** SEC-P0-ADDENDUM-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T12:4xZ (UTC)
**Assignment:** COO *Corrective Directive — Public Git Object Exposure, Rotation Risk and Phase-0 Review Completion*, §§1–9 (2026-11-11).
**Corrects:** `secret-history-assessment.md` (SEC-P0-SECHIST-001) §6 item 3 — the formulation "*the public branch exposure of the key itself may be nil today*" is **RETIRED AND SUPERSEDED** by §5 below. The 23-blob inventory, ref-reachability table, and classification sections of SEC-P0-SECHIST-001 remain valid and are **extended**, not altered.
**Companion documents (this branch):** `authoritative-main-delta-assessment.md` (SEC-P0-DELTA-001) · `secret-history-assessment.md` (SEC-P0-SECHIST-001) · `independent-review-preparation.md` (SEC-P0-IRP-001, updated by this assignment).
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED.

> **Standing independence limitation:** prepared by the same AI-agent lineage that operates the assessed environment — *verification-support material, not independent review*. The directive requires the independent reviewer to reproduce the direct-object and file-retrieval checks with an unauthenticated client; every test in §2 was executed from this sandbox with **no credentials** (construction documented in §2.1), but reviewer reproduction on an independent network path remains **REQUIRED** and is supported by the exact commands in §13. No secret value is reproduced anywhere in this document (repo convention: fingerprints first-6…last-6 only).

---

## 0. Directive-guardrail compliance (§8 of the directive)

| Guardrail | Status |
|---|---|
| Read-only forensic and source review | HELD — git object reads, anonymous HTTP GETs (status/headers only), zero mutations of remote or history |
| Documentation-only changes | HELD — this file + the IRP update; no source/config/boot changes |
| No key generation · no signing · no on-chain transactions · no credential rotation | HELD — none performed, none proposed for execution from here |
| No tag deletion · no Git history rewriting · no repository visibility changes | HELD — remote refs untouched (verified post-work, §2.10) |
| No merges into main | HELD — work continues on `security/phase-0-review-prep`; parent lineage unchanged (`926ee00` → `c5a2678` → this commit) |
| No application boot · no database operations | HELD — no `next dev`, no watchdog, no Prisma/SQL execution; the only "database" touched is none |
| No Phase 1 implementation | HELD — all code-level findings (§8, §9) are documented with Phase-1 recommendations, not implemented |

---

## 1. Exposure model — public-reference reachability vs direct object addressability (directive §1)

**The corrective core.** SEC-P0-SECHIST-001 established ref-reachability (`git rev-list <ref> --objects` per public-remote ref → 0/23 key-material blobs). That metric answers only: *“is the key material in the tree of any currently pushed branch/tag?”* On GitHub that is **not** an exposure boundary, because GitHub's object store serves **objects by SHA** through multiple anonymous interfaces regardless of ref reachability:

1. `raw.githubusercontent.com/<owner>/<repo>/<commit-sha>/<path>` — file content at any retained commit.
2. `github.com/<owner>/<repo>/commit/<sha>` — commit page (metadata **and diff content**), plus `/blob/<sha>/<path>` file pages and `/commit/<sha>.diff` / `.patch` patch channels.
3. `api.github.com/repos/<owner>/<repo>/git/blobs|trees|tags/<sha>` — raw object access (base64 content).
4. The **git protocol itself**: `git fetch <url> <full-sha>` — upload-pack serves the commit (and its tree/blobs) to unauthenticated clients (§2.6).

An object that reached the GitHub object store at any time (via any historically pushed ref, since deleted or rewritten) can remain server-retrievable by SHA indefinitely; GitHub performs dangling-object garbage collection only on its own schedule, and objects reachable through hidden refs (e.g. `refs/pull/*`) are never collected. **Therefore: absence from current refs is necessary but not sufficient for de-exposure; only direct-object testing per known SHA resolves the question.** That testing is performed in §2 and it resolves the question **negatively** (the material IS anonymously retrievable).

---

## 2. Direct-object test evidence (this session, anonymous unauthenticated) **[VERIFIED-FACT]**

### 2.1 Method and anonymity construction

- **Client:** curl 8.14.1, invoked with **no** `Authorization` header, **no** `.netrc` (verified absent), **no** proxy environment variables (verified empty), **no** cookies. The sandbox's embedded git push credential (`x-access-token` in `.git/config`, F-0-P0-03) was **never used** for any test — it cannot leak into curl.
- **Tier evidence:** the anonymous API tier is evidenced by `x-ratelimit-limit: 60` (unauthenticated bucket; authenticated core = 5,000) observed on `api.github.com` responses from this client.
- **Safety discipline (directive: “Record HTTP outcome and response classification only. Never record secret values”):** every content-bearing response was piped directly into `grep -c <pattern>` (count only — content never displayed) or discarded with `-o /dev/null` while recording only the HTTP status code. Patterns used are the public fingerprints already disclosed in `docs/security/CRITICAL-PRIVATE-KEY-ROTATION.md` (EVM: `0xdbe1…62d6` 66-hex form; Solana: 128-hex and 88-char base58 forms). Raw test log (status/count lines only) is preserved in the private evidence package (`/home/z/phase0-review-tmp/object-exposure-tests.log`, §10).
- **Controls:** current-`main` file fetches (expect HTTP 200 with pattern-count **0** — clean current refs) and nonexistent-commit / nonexistent-path fetches (expect **404**) — both behaved exactly as expected, validating that the 200s below are meaningful object retrievals, not blanket responses.
- **Test window:** 2026-11-11T11:38:30Z–12:41:24Z (raw/HTML/protocol batteries 11:38–11:41; API tier in three passes 11:58:38–12:41:24 due to shared-bucket contention, §2.7).

### 2.2 Raw historical file retrieval by full commit SHA — **CONFIRMED, all 12 key-bearing files**

| # | Object (path at commit) | HTTP | Key-pattern count |
|---|---|---|---|
| R01 | `worklog.md` @ `2e684d9d8` | **200** | **1** (C-045-a) |
| R02 | `scripts/verify-key-and-audit-roles.ts` @ `2da73fd65` | **200** | **1** (C-045-a) |
| R03 | `scripts/verify-hex-key.ts` @ `2da73fd65` | **200** | **1** (C-045-b hex) |
| R04 | `scripts/solana-create-fresh.ts` @ `2da73fd65` | **200** | **1** |
| R05 | `scripts/solana-create-umi.ts` @ `2da73fd65` | **200** | **1** |
| R06 | `scripts/solana-create-with-metadata.ts` @ `2da73fd65` | **200** | **1** |
| R07 | `scripts/solana-set-metadata.ts` @ `2da73fd65` | **200** | **1** |
| R08 | `scripts/solana-set-metadata-v2.ts` @ `2da73fd65` | **200** | **1** |
| R09 | `scripts/verify-sol-key2.ts` @ `2da73fd65` | **200** | **1** (C-045-b base58) |
| R10 | `tool-results/read_1788722996398_…txt` @ `2da73fd65` | **200** | **1** (C-045-a) |
| R11 | `tool-results/read_1788725306776_…txt` @ `2da73fd65` | **200** | **1** |
| R12 | `tool-results/read_1788731310038_…txt` @ `2da73fd65` | **200** | **1** |

Controls: `worklog.md`/`verify-sol-key2.ts`/`solana-create-fresh.ts` @ `main` → **200 with count 0** (current refs clean, anonymously confirmed); nonexistent commit → **404**; existent commit + nonexistent path → **404**.

### 2.3 Multi-commit worklog exposure — 4 further September-lineage commits tested, all CONFIRMED

`worklog.md` fetched anonymously at commits `802b4726e`, `66dbeafc6`, `5d4f8e7bc`, `7479a8e02` → **HTTP 200, C-045-a pattern count 1 each** (local expectation matched). This directly confirms SEC-P0-SECHIST-001 §3's "12 distinct worklog blob versions" finding at the object level: the raw-file channel exposes **16 of the 23 key-material blobs** through 16 distinct commit-addressable file versions; the remaining 7 are worklog versions at other September-lineage commits — same mechanism (sampled 4 of ~10 mapped commits; the API blob test in §2.7 covers all 23 individually).

### 2.4 Short-SHA resolution and the self-documenting exposure chain **[VERIFIED-FACT — new finding AF-02]**

The 9-character abbreviated SHAs (`2e684d9d8`, `2da73fd65`) — exactly the forms printed in the **publicly pushed** evidence documents — resolve on all anonymous interfaces: `raw…/2e684d9d8/worklog.md` → **200 count 1**; `raw…/2da73fd65/scripts/verify-sol-key2.ts` → **200**; `github.com/…/commit/2da73fd65` → **200**; `github.com/…/blob/2e684d9d8/worklog.md` → **200**.

`git grep` on the pushed refs shows the retrieval keys are published: `origin/security/phase-0-review-prep` → `secret-history-assessment.md` (10 occurrences of the two short SHAs), `independent-review-preparation.md` (2 occurrences). Neither `origin/main` nor the other pushed branches print them. **The exposure chain is therefore self-documenting: public repo → pushed security branch → evidence document → short SHA → anonymous raw/diff/API/protocol retrieval → key material.** (See §4 for the dissemination corollary — the SHAs must be assumed known even without the docs.)

### 2.5 HTML object pages and patch channels — CONFIRMED

| # | Interface | HTTP |
|---|---|---|
| H01 | `github.com/…/commit/2e684d9d86633e…` (commit-object page) | **200** |
| H02 | `github.com/…/commit/2da73fd6542ff…` (commit-object page) | **200** |
| HB1 | `github.com/…/blob/2da73fd65…/scripts/verify-sol-key2.ts` (blob view by commit SHA) | **200** |
| HB2 | `github.com/…/blob/2e684d9d8…/worklog.md` | **200** |
| D1 | `github.com/…/commit/2da73fd65….diff` (unified diff — added lines verbatim) | **200** |
| D2 | `github.com/…/commit/2da73fd65….patch` (email patch — same) | **200** |
| H09 | `github.com/MITHQALMTQ/MTQ_SIGMA` (repo root — public viewability) | **200** |
| H08 | `github.com/…/commit/0000000000000000000000000000000000000000` (control) | **404** |

The commit pages (H01/H02) render the commit's **diff** — i.e. the key literals appear verbatim in the served HTML for the intro commits, independent of the raw endpoint.

### 2.6 Git-protocol anonymous fetch-by-SHA — CONFIRMED, 12 of 23 blobs in one request

`GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/bin/true git -c credential.helper= fetch --depth=1 https://github.com/MITHQALMTQ/MTQ_SIGMA.git 2da73fd6542ff22962ba27d62f1593fdad1834fa` (fresh empty repo, no stored credentials) → **succeeded** (`* branch 2da73fd… -> FETCH_HEAD`, exit 0) and delivered **859 objects including 12 key-material blobs** (the 11 at that commit's tree + that commit's key-bearing `worklog.md`). GitHub's upload-pack thus serves an unreachable-by-ref historical commit to **unauthenticated clone/fetch clients**. A fresh `git clone` of the public repo does **not** contain the objects (clone walks current refs), but any holder of the SHAs can fetch them explicitly.

### 2.7 API-tier object addressability (`api.github.com`, anonymous) **[VERIFIED-FACT]**

Executed in three passes (11:58:38Z burst · 11:59:32Z spaced-retry · 12:40:52Z reset-timed) because the sandbox's shared egress IP pool exhausts GitHub's anonymous core bucket (60/hr — evidenced by `x-ratelimit-limit: 60` response headers, the unauthenticated tier). Intermittent 403s during contention are **rate-limit artifacts, not object absence** — validated by the nonexistent-blob control returning **404** and by every contended 403 resolving to **200** on retry.

| Object class | Anonymous endpoint | Result |
|---|---|---|
| Commit objects | `GET /repos/MITHQALMTQ/MTQ_SIGMA/commits/<sha>` | **4/4 → 200** (`2e684d9d8…` full · `2da73fd65…` full · `2da73fd65` short · `802b4726e…` full — a further Sept-lineage commit) |
| **All 23 key-material blobs** | `GET …/git/blobs/<sha>` | **23/23 → 200** — every key-material blob is individually addressable and its base64 content is served to unauthenticated clients |
| Tree objects | `GET …/git/trees/<sha>` | **2/2 → 200** (trees of both intro commits; note the HTML `/tree/<sha>` layer 404s — the API serves them) |
| **September tag objects** | `GET …/git/tags/<sha>` | **2/2 → 200** — `backup-2026-09-22` (`404ae56b…`) and `backup-stable-2026-09-26` (`a91f1f07…`) annotated-tag objects **are server-retained** |
| Nonexistent blob (control) | `GET …/git/blobs/000…0` | **404** |
| Repository metadata | `GET /repos/MITHQALMTQ/MTQ_SIGMA` | **200** — `visibility: "public"` · `forks_count: 0` · `default_branch: main` · `pushed_at: 2026-11-11T10:31:57Z` (the morning's automation push) · not archived/disabled |
| Pull-request metadata | `GET …/pulls?state=all` | PR#1 by `vercel[bot]` (2026-09-07, closed — a third-party integration held repo read access since September); PR#2 and PR#3 by `fortleem` (2026-10-24, closed — owner-side identity, to be confirmed in the D-4 token/identity audit) |

**The server-side retention of both September tag objects is direct object evidence that key-bearing refs were historically PUSHED to the public remote and later deleted** (both tag refs are absent from `ls-remote` today) — this upgrades the §3 level-6 push/deletion determination from inferred to object-evidenced. The 23-blob SHA list is retained only in the private evidence package (`key-blobs.txt`, §10.2); derivation commands in §13.

### 2.8 Negative and discriminating results (equally part of the model)

| Test | Result | Meaning |
|---|---|---|
| H03/H04: `github.com/…/commit/<tag-object-sha>` for `backup-2026-09-22` (`404ae56b…`) and `backup-stable-2026-09-26` (`a91f1f07…`) | **404** | The HTML commit layer does not resolve annotated-tag object SHAs — but the API `git/tags/<sha>` **serves both tag objects (200, §2.7)**: they are server-retained, which is direct evidence of historical push + later ref deletion |
| H05/H06: `github.com/…/tree/<tree-sha>` | **404** | HTML layer does not resolve bare tree SHAs |
| H07: `github.com/…/blob/<tree-sha>/<path>` | **404** | same |
| R13/R14: `raw…/<tree-sha>/<path>` | **404** | raw endpoint resolves commit/branch/tag refs, not bare tree SHAs |
| R15–R17, R18/R19, H08 | 200-count-0 / 404 / 404 | controls validate the method (§2.1) |

### 2.9 CDN/cache observations **[VERIFIED-FACT]**

`raw.githubusercontent.com` responses for the key-bearing objects carry `cache-control: max-age=300`, `etag: "…"`, `via: 1.1 varnish` (Fastly edge, `x-github-edge-region: southeastasia` at test time). Cached edge copies mean retrieval history cannot be reasoned about from origin logs alone, and short-term copies persist at CDN nodes independent of any later object purge. Historical cache retention is **[UNVERIFIED]**.

### 2.10 Remote-ref state re-verification (2026-11-11T11:38:30Z, and post-work)

`git ls-remote origin` (29 refs): heads `main` (`926ee00`), `backup-incident10-amend` (`9fe4058`), the three security branches; **3 pull refs** (`refs/pull/1..3/head` — see below); tags `backup-2026-10-24`…`backup-2026-11-11` + `no-rollback-anchor-2026-10-25`. The two September tags remain **absent**.

**New since SEC-P0-SECHIST-001 §3's ref table:** (a) three `refs/pull/*/head` refs exist on the remote and were not enumerated in that table (its `git ls-remote` listing omitted them — a documentation gap, closed here): PR 1 "Install and Configure Vercel Web Analytics", PR 2 "docs: record MTQ Sigma production release blockers", PR 3 "docs: add MTQ Sigma testnet release gates". All three were fetched read-only and tested: **0/23 key-material blobs reachable from each**; neither key-intro commit is an ancestor of any PR head. The "zero public-remote-ref reachability" conclusion therefore **holds and is now complete over all 29 remote refs**. (b) A new tag `backup-2026-11-11` → `926ee00` appeared during this session — the repository's GitHub Actions automation (backup workflow, `contents: write`) is **still operating autonomously** and pushing daily backup tags; this is live evidence for D-7 (workflow-secrets/permissions attestation) and for the F-0-P0-03 credential-scope question (whatever identity drives that workflow remains active).

---

## 3. Required investigation — the seven-level exposure determination (directive §1)

| # | Exposure model level | Determination | Evidence |
|---|---|---|---|
| 1 | Current branch/tag reachability | **NONE — CONFIRMED** (0/23 blobs reachable from all 29 public-remote refs incl. pull refs; current-`main` files anonymously re-verified pattern-count 0) | §2.2 controls, §2.10 |
| 2 | GitHub commit-object addressability by SHA | **CONFIRMED — anonymous** (HTML commit pages 200 ×2 + 4 more lineage commits; API commits endpoint 4/4 → 200 incl. short-SHA resolution; git-protocol fetch-by-SHA succeeded) | §2.2, §2.3, §2.5, §2.6, §2.7 |
| 3 | GitHub tree and blob addressability by SHA | **CONFIRMED — anonymous: API `git/blobs/<sha>` 23/23 → 200 (every key-material blob individually addressable, base64 content served); `git/trees/<sha>` 2/2 → 200.** HTML/raw do not resolve bare tree SHAs (§2.8) — irrelevant to exposure, since blob content is fully addressable via commit-SHA+path (§2.2), the API (this row), and the protocol (§2.6) | §2.7, §2.8 |
| 4 | Raw historical file retrieval by commit SHA | **CONFIRMED — anonymous, 12/12 key-bearing files at the intro commits + 4 further commits, pattern count 1 each** | §2.2, §2.3 |
| 5 | Anonymous unauthenticated accessibility | **CONFIRMED from this sandbox's network vantage** (no credentials by construction, §2.1; anonymous API tier headers). **Independent-reviewer reproduction on a separate path remains REQUIRED** (§13) | §2.1–2.7 |
| 6 | Historical push, deletion, clone, fork, cache exposure | **Push: CONFIRMED — object-evidenced** (both Sept tag objects AND all 23 blobs AND the commits are server-retained ⇒ key-bearing refs were pushed and later deleted; exact ref-path/dates **[UNVERIFIED]** — GitHub keeps no deleted-ref trace). **Deletion: refs absent — CONFIRMED; objects retained — CONFIRMED.** **Clone: any *current* anonymous client can fetch by SHA — CONFIRMED (§2.6); historical clones made while key-bearing refs existed — [UNVERIFIED] (must be assumed). Fork: `forks_count: 0` today — [VERIFIED]; historical created-then-deleted forks — [UNVERIFIED]. Cache: CDN edge caching active on the object URLs — CONFIRMED (§2.9); historical cache retention [UNVERIFIED]** | §2.6, §2.7, §2.9 |
| 7 | Local-only object retention | **CONFIRMED** — all 23 blobs present in this sandbox's `.git` (the assumed-compromised substrate); platform re-images preserved `.git` (F-0-P0-02 record); other local copies **[UNVERIFIED]** | SEC-P0-SECHIST-001 §3, incident record |

---

## 4. Compounding disclosure finding (AF-02) — the retrieval keys are themselves published

1. The short commit SHAs that unlock every retrieval channel are printed in the **publicly pushed** `secret-history-assessment.md` (10 occurrences) and `independent-review-preparation.md` (2 occurrences) on `origin/security/phase-0-review-prep` (§2.4). No current-`main` document prints them.
2. Independent of the docs: for a **public** repository, GitHub push events (including pushed commit SHAs) are recorded in GitHub's public Events feed and archived by third-party public datasets (GH Archive) — **[UNVERIFIED from this sandbox]**, but the owner must assume the September-era push SHAs are reconstructable from such archives by a motivated party.
3. Consequence: **the commit SHAs must be assumed KNOWN to any motivated attacker.** The only operative containment is therefore the on-chain rotation (P0-01) plus the owner's GitHub-side decisions (history remediation D-3, object GC via GitHub support, evidence-branch visibility D-8). *This addendum deliberately does not repeat full 40-char SHAs beyond the minimum needed for reproduction (short forms, which are already public); the 23-blob SHA list is retained only in the private evidence package.*

---

## 5. Revised EVM key exposure conclusion (directive §1 required wording) — supersedes SEC-P0-SECHIST-001 §6.3

- **No reachability through currently published refs:** CONFIRMED — none of the 23 key-material blobs is reachable from any of the 29 current public-remote refs (branches, tags, pull refs); current-`main` copies of every affected path are clean (anonymously re-verified, count 0).
- **Historical object retrievability by known SHA:** CONFIRMED — commit objects (4/4 via API, plus HTML pages), file content (raw and HTML blob views), diff/patch channels, **every one of the 23 key-material blobs via `git/blobs` (23/23 → 200)**, both trees, and the git protocol (fetch-by-SHA) all serve the September-lineage objects anonymously, **with the key material present in the served content** (raw-file pattern counts 1 per file).
- **Anonymous access:** CONFIRMED from this sandbox's unauthenticated client (no credentials by construction; anonymous API tier). Independent-reviewer reproduction from a separate unauthenticated client remains required and is fully specified (§13).
- **Historical dissemination:** UNRESOLVED — historical clones, forks, CI caches, archive datasets, and CDN retention cannot be enumerated from this substrate; the owner must treat the key as disseminated-since-September-2026 absent evidence to the contrary.

**Revised conclusion:** the C-045-a (and C-045-b) key material **is publicly exposed and anonymously retrievable by anyone holding the (published) commit SHAs**. The phrase "*public exposure may be nil*" (SEC-P0-SECHIST-001 §6.3) is **withdrawn**; the register's exposure-channel description for F-0-P0-01 should be corrected by the reviewer to: *"full key literals recoverable from the public GitHub repository by direct object address (raw/HTML/diff/API/protocol) at known historical commits, in addition to every local clone/image carrying the September tags; not reachable from any currently published ref; dissemination-since-push unresolved."*

**Impact on F-0-P0-01:** severity unchanged — the key was already declared treat-as-compromised on 2026-10-24 — but the exposure basis moves from "assumed-compromised substrate" to **demonstrated public anonymous retrievability**. Rotation urgency is maximal; nothing in this addendum changes the standing rule that deletion is not remediation and rotation is the only containment.

---

## 6. P0-01 Solana key family (C-045-b) — separate key-compromise incident + read-only verification checklist (directive §3)

**Classification (extends SEC-P0-SECHIST-001 §3):** C-045-b = **7 blobs** (6 × 128-hex key literals in `solana-create-fresh.ts`, `solana-create-umi.ts`, `solana-create-with-metadata.ts`, `solana-set-metadata.ts`, `solana-set-metadata-v2.ts`, `verify-hex-key.ts`; 1 × 88-char base58 export in `verify-sol-key2.ts`), all introduced at `2da73fd65`, all on the September lineage, **all anonymously retrievable by commit SHA (§2.2 R03–R09)** and all delivered by the single protocol fetch (§2.6). The three committed tool-transcripts also each contain a base58-shaped string alongside the C-045-a literal. **C-045-b is tracked as a SEPARATE key-compromise incident** (distinct key family, distinct chain, distinct rotation package D-5) with its own finding record — not a footnote to C-045-a.

**Standing discipline (directive §3):** the superseded Solana mint authority is **NOT** to be called currently privileged until a fresh independent chain read confirms what authorities remain operative on the mints. The 4.98 SOL / "drainable by any repo holder" statements in D-5 are task-11-era reads — to be re-established, not assumed.

### 6.1 Read-only verification checklist (owner/reviewer executes; independent RPC path; NO signing, NO transfer, NO key derivation from the compromised literals inside any AI environment)

| # | Item | Exact read-only procedure | Evidence to record | Status |
|---|---|---|---|---|
| S-1 | Current mint authority | `getAccountInfo` (jsonParsed) on the current MTQ mint → `.mintAuthority` / `.mintAuthorityOption` | address + slot + RPC endpoint identity | [UNVERIFIED — pending fresh chain read] |
| S-2 | Superseded mint authority | same read on the superseded mint; map authority address to the C-045-b public key (derivation performed only in an owner-controlled outside-AI session) | address + option state + slot | [UNVERIFIED — do NOT assert privileged] |
| S-3 | Freeze authority | `.freezeAuthority` / `.freezeAuthorityOption` on **both** mints | addresses + option states + slot | [UNVERIFIED] |
| S-4 | Token-account ownership | `getTokenLargestAccounts` on both mints; `getAccountInfo` (jsonParsed) per returned account → `.owner` | per-account owner map + slot | [UNVERIFIED] |
| S-5 | Current native SOL balance | `getBalance` on: current-mint authority address, C-045-b public address (owner-derived), both mints' authority addresses | lamports + slot (re-verify the task-11 "4.98 SOL" figure) | [UNVERIFIED] |
| S-6 | Associated asset exposure | `getTokenAccountsByOwner` (programId = Token Program) for each authority address; delegated/locked token accounts | holdings inventory + slot | [UNVERIFIED] |
| S-7 | Whether any old authority remains operative | S-1/S-2/S-3 combined: an authority is "retired" only where `mintAuthorityOption`/`freezeAuthorityOption` reads **null** (or shows a transferred-away address); any non-null old-authority read = operative | annotated authority matrix | [UNVERIFIED] |
| S-8 | Whether current mint authority is independently controlled | custody attestation for `DbFjz…` (CKPT-2): key-ceremony record generated outside this repository/sandbox/any AI environment | attestation + ceremony participants | [UNVERIFIED] |

All eight items feed the D-5 migration package prerequisites and the F-0-P0-01 Solana sub-finding. **No on-chain interaction beyond reads is authorized by this addendum.**

---

## 7. P0-01 EVM migration risk — the unresolved compromised-signer migration window + Option A vs Option B (directive §2)

### 7.1 The unresolved compromised-signer migration window (named risk)

**Definition:** the interval during which every authority change on the *existing* contract estate requires a transaction signed by the compromised EOA `0x3C39…c8d8c` (DEFAULT_ADMIN + MINTER + PAUSER on both token generations × three testnets; sole signer of the 1/1 Genesis Safe `0xE718…A7D0`; gen-A `owner()` twins). The D4/ROLE_ROTATION design accepts this ("the exposed key, if ever used, is loaded ONLY in an owner-controlled session") — but it remains **unresolved and structurally unresolvable on the existing estate**: an attacker holding the key can (a) **refuse** (no migration possible; only redeploy), (b) **front-run/race** the grant transactions (nonce replacement, fee bumping on public testnet mempools), (c) **re-grant** roles to attacker addresses during any dual-admin window, (d) **drain** the deployer's token/native balances (309.949/1,000 MTQ + native on Monad; 998.999/1,000 + native on Arc; Robinhood holdings). **A fresh 4-of-7 Safe is the better target architecture, but the migration is NOT labeled safe until this window is evaluated against the option chosen — which is the purpose of §7.2.**

### 7.2 Option A (in-place permission migration via the compromised EOA) vs Option B (replacement estate + formal deprecation)

| Dimension | A — migrate permissions on existing contracts | B — deploy replacement testnet estate under independent authority, then deprecate the old |
|---|---|---|
| Contract immutability | The contracts are immutable with no upgrade path (byte-identical across lineages, delta §4); A works *through* their mutable role state (AccessControl grant/revoke, Ownable transfer) — the only way to change authority on them | New immutable contracts carry correct authority **from birth**; the old immutable contracts remain exactly as compromised — B does **not** neutralize their role state without its own A-style steps |
| Existing token balances | Preserved (same contracts); evacuation of deployer-held tokens still required (attacker race) | Old-estate balances stay under the old authority surface (drainable); new estate starts at zero supply — testnet re-mint; migration of old balances would itself require old-key action or accept-as-loss |
| Mint and reserve permissions | Each grant/revoke of MINT/RESERVE MINTER is old-key-signed — the window applies to **every step** (incl. the Monad reserve-module MINTER pending ECON-DEC-2) | New estate grants mint/reserve to Safe-B at deploy with **no compromised signature needed**; old mint/reserve remain live under the old key until separately revoked or formally abandoned (indefinite residual mint window if neither) |
| Ownable contract owners (gen-A twins) | `transferOwnership` per twin, each old-key-signed; one-shot `genesisMint` gates remain available to the old owner until transferred | New estate has fresh owners; old twins keep `owner()` + their 1,000,000-genesis one-shots under the old key unless A-style transfers or explicit accept-provenance decisions are made (D6/T-3.8) |
| Genesis mint privileges | see above — must be neutralized per-twin during the window | same residual on the old estate; new genesis under independent control |
| Multisig modules and owners | Strip the old 1/1 Safe of token roles; in-place `addOwnerWithThreshold×7 + changeThreshold(4)` passes through **threshold-1 windows with a growing owner set** (each added owner can act alone) — explicit risk acceptance required; D4 fresh-Safe path avoids surgery on the old Safe but its establishment still needs old-key grants | Fresh Safe-B **4-of-7 from birth** via `createProxyWithNonce` (T-1.4 dossier gate) — zero old-key participation to establish; the old Safe stays 1/1 until stripped (bounded by the strip step, which is A-style) |
| Nonce management | Every migration tx consumes the EOA nonce — attacker can interleave/replace-by-fee; owner-side nonce pinning helps but cannot exclude interleaving | Establishment: **no old-key nonces at all**; deprecation steps re-introduce the nonce race only if and when performed |
| Mempool front-running | Exposed throughout — all grants visible to attackers monitoring public testnet mempools | Establishment clean (independent key signs its own deploy/grants); only the optional deprecation phase is exposed |
| Re-grant attacks | Persist until the **last** old-key admin surface is removed — sequencing must end at full renounce with per-step verification; any dual-admin window admits attacker re-grants | New estate has no relationship to the old key (immune); the **old estate can be re-granted by the attacker at any time, forever** — mitigated only by formal deprecation notice + monitoring, or by completing A-style revocation |
| Dual-administrator windows | Inherent (grant-before-revoke requires both old and new to hold powers simultaneously; never-batch rule) | None during establishment; re-introduced only inside the bounded deprecation steps |
| Native-asset exposure | Unchanged until evacuation (T-3.8) — attacker race regardless | Unchanged — evacuation still required either way |
| Rollback / permanent lockout | Erroneous last-admin renounce → **permanent lockout** (immutable, self-administered AccessControl; ROLE_ROTATION §6); step-8 renounce is policy-optional and rehearsal-prechecked; erroneous role revoke recoverable via Safe-as-admin re-grant (Safe must be verified working first) | New estate lockout risk minimal (4/7 from birth, dossier-gated, verify-safe re-run); deprecation errors can strand the deprecation itself but cannot affect the new estate |

### 7.3 Verdict

1. **Neither option is atomic** — controlled multi-stage only (never-batch, verify-after-every-step; T-13 fork-replay adversarial check; final independent role matrix).
2. **Option B removes the compromised-signer window from the *establishment* of the new authority; it does NOT remove it from the *deprecation* of the old estate.** Full deprecation (role revokes, ownership transfers, Safe strip) is A-style and re-opens every old-key vector (refuse/front-run/re-grant/nonce race). If the owner declines A-style deprecation, the old estate remains **live attacker-controlled authority on immutable contracts indefinitely** — acceptable on testnet only with an explicit risk-acceptance record, deprecation notice, and monitoring.
3. **Recommended sequencing (consistent with D4/ROLE_ROTATION, now sharpened):** B-first — stand up Safe-B 4-of-7 per chain and the replacement estate with **zero** old-key participation; migrate all *new* operations to it; then a bounded, per-step-verified A-style deprecation of the old estate (best-effort), with a pre-declared fallback of formal abandonment + monitoring if the attacker contests (any unexpected old-key activity = active incident per the §5.3 watch).
4. **"Safe" label prerequisites (all three):** (i) fresh role matrix showing the new authority active and verified (verify-safe VERIFIED 4/7 both chains; dossier gate); (ii) old-estate power inventory driven to zero **or** formally accepted-as-residual with deprecation notice; (iii) the §6 Solana checklist closed (C-045-b authorities resolved) — because a "migrated" EVM estate with a live Solana superseded mint is not a contained rotation.
5. **No transaction execution or signing is authorized by this addendum** (directive §2/§8). Everything above is read-only procedural review.

---

## 8. Authoritative API security reassessment — `api/ai/consensus` and `api/ai/catalog-sync` (directive §4)

**Scope:** code-level read-only review at authoritative `926ee00` (files identical on this docs-only branch): `src/app/api/ai/consensus/route.ts` (130 lines), `src/app/api/ai/catalog-sync/route.ts` (47 lines), plus their import closure (`src/lib/ai/{consensus,catalog,keys}.ts`, `src/lib/mtq/rate-limit.ts`, `src/lib/db.ts`) and repo-wide auth precedent. Line citations below are authoritative-tree line numbers.

### 8.1 `api/ai/consensus` (POST-only, `route.ts:43`)

| Aspect | Finding |
|---|---|
| Authentication | **NONE** — no Authorization/API-key/cookie/session check anywhere in the handler; **no `middleware.ts` exists in the repo** (glob-verified), so nothing gates it externally either |
| Authorization | **NONE** — no role/owner/operator gate |
| Input validation | Manual only: JSON parse → 400 (`:65-70`); `sanitize()` 1–500 chars, control-char strip (`:36-41`) → 400; no schema library, no other body fields inspected |
| Tenant/identity boundaries | **NONE** — no tenant concept; the only identity signal is `getClientIP` (XFF/`x-real-ip`, `rate-limit.ts:211-217`) used solely for rate bucketing; XFF spoofable on direct `:3000` (`rate-limit.ts:201-210`) |
| Privileged operations | Triggers multi-provider **keyed LLM consensus runs** (NVIDIA + OpenRouter + Gemini, up to 3 generations + 429-retries, `consensus.ts:217-311`) — an unauthenticated cost/abuse surface |
| Database writes | `consensusRun.create` + `consensusVote.createMany` (`consensus.ts:860-886`); idempotent DDL via `ensureConsensusTables()` raw libsql (`:800-854`); persistence best-effort, failures swallowed (`:637-639, 889-892`) |
| External service calls | `integrate.api.nvidia.com/v1/chat/completions` (Bearer); `openrouter.ai/api/v1/chat/completions` (Bearer + HTTP-Referer); `generativelanguage.googleapis.com/…?key=<GEMINI_API_KEY>` — **API key transmitted as URL query parameter** (`consensus.ts:222, 311`), a log/Referer leakage class; system prompt + user question egress to three third parties |
| Rate limits | `rateLimit(ip,"ai")` — 10 req/IP/min (route comment stale at "5", `route.ts:12-13` vs `rate-limit.ts:42-48`); Upstash Redis when configured, in-memory fallback **fail-open** on Redis errors (`rate-limit.ts:190-198`) |
| Replay and abuse | No nonce/idempotency — repeat POSTs repeat paid LLM spend; question text unconstrained beyond length (prompt-injection into persisted consensus records); per-vote upstream error bodies (first 200 chars, `consensus.ts:284-285, 326`) echoed to clients (`route.ts:113`) — upstream-error disclosure |
| Error behavior | 400 (invalid JSON / validation), 429 (+Retry-After), 503 (feature flag off `:55-57` / no provider keys `:58-63`), 502 catch-all with server-side console.error (`:125-127`) |
| Fail-closed properties | Enablement gates fail closed (503); **DB persistence fails open** (swallowed); **rate-limit Redis failure fails open** to memory; the route itself never blocks on degraded subsystems |
| Relevant tests | **NONE** — zero references in `tests/**` or `src/lib/**/__tests__`; only a live-network smoke script (`scripts/ai/smoke-consensus.ts`, requires real keys — not an automated test) |

### 8.2 `api/ai/catalog-sync` (POST-only, `route.ts:18`)

| Aspect | Finding |
|---|---|
| Authentication | **NONE** |
| Authorization | **NONE** — an unauthenticated endpoint that triggers outbound provider calls and DB writes |
| Input validation | **NONE** — the request body is completely ignored; `req` used only for `getClientIP` (`:19`) |
| Tenant/identity boundaries | NONE — per-IP rate bucket only |
| Privileged operations | Administrative-shaped operation (catalog refresh) exposed publicly |
| Database writes | `aiModelCatalog.upsert` per row (`catalog.ts:173-189`, idempotent by `<provider>::<model>`; owner-policy `EXCLUDED` rows included `:92-95, 200-218`) + the same DDL path as 8.1 |
| External service calls | `GET integrate.api.nvidia.com/v1/models` (Bearer, 15 s timeout); `GET openrouter.ai/api/v1/models` (**no auth header**; filtered to free-tier models) (`catalog.ts:117-137`); offline fallback seeds from hard-coded probe evidence (`:152-158, 165-170`) |
| Rate limits | same `"ai"` bucket, 10 req/IP/min (`:19-29`) |
| Replay and abuse | Hammering sync = outbound-request amplification (2 provider calls per hit) from an unauthenticated surface; idempotent upserts bound the DB damage; partial provider failures surfaced as `providers[].ok=false` inside HTTP 200 |
| Error behavior | 429; 200 with per-provider error strings (first 120 chars, `catalog.ts:153, 166`); 502 catch-all (`route.ts:42-45`) |
| Fail-closed properties | Fetch failure does **not** fail the route (falls back to seeded rows — availability-over-accuracy); DB failure → 502 (response-level fail-closed) but partial upserts may already persist |
| Relevant tests | **NONE** (CLI wrapper `scripts/ai/sync-catalog.ts` exists; no automated coverage) |

### 8.3 Repo-wide context and findings

Repo precedent: only `constituency/upload` (X-Upload-Token, 403 fail-closed), `webhooks/tenderly` (HMAC, 401), `mbg/mint-request` (API-key-hash/HMAC, 401; testnet bypass flag), and `inngest` (signature check when keyed) implement inbound authentication; **no middleware exists**. The entire `api/ai/*` family is unauthenticated — mitigated only by per-IP rate limiting (spoofable XFF residual) and env feature flags, in a TESTNET/SHADOW deployment.

**New findings for the register (reviewer to assign final IDs; proposed):**
- **AF-03 (P1-candidate)** `ai/consensus`: unauthenticated keyed-LLM invocation + cost amplification + third-party data egress (question text) + Gemini key-in-URL + upstream-error disclosure + zero tests + swallowed persistence failures. Existing-estate note: absent from the substituted baseline — this is an authoritative-only surface (delta §2).
- **AF-04 (P1-candidate)** `ai/catalog-sync`: unauthenticated state-changing DB writes + outbound amplification; body unvalidated (ignored).
- **Recommendation (Phase 1, NOT implemented here):** gate both routes with the proven fail-closed token/HMAC patterns above (or unify an `api/ai/*` auth middleware), add automated tests, move the Gemini key out of the URL, and stop echoing upstream error bodies. The directive's instruction is honored: this code-level review was performed now, not deferred to Phase 1.

---

## 9. Boot-chain failure semantics — `bun run scripts/source-integrity-heal.ts … || true` (directive §5)

**Invocation (authoritative `dev-watchdog.sh:180`):** `bun run scripts/source-integrity-heal.ts >> "$LOG" 2>&1 || true` — positioned **after** the pre-boot git-drift guard (`:169`, whose rc is captured but whose failure also does **not** stop boot — "booting local HEAD", `:173-175`) and **before** runtime-preflight (`:188`) → db-selfheal (`:206`) → `next dev` (`:215`). The chain has no `set -e`.

| Directive question | Determination (code-cited) |
|---|---|
| Missing-script behavior | `bun run` exits non-zero ("module not found") → `|| true` **masks it completely** → boot proceeds. Realized at the substituted `d6fd5d6` where the heal script is absent (F-0-P1-02's lineage-conditional form) |
| Non-zero exit behavior | **All** non-zero exits — runtime failure, integrity-report failure (`error`, or `failed>0 && restored==0` → exit 1, `source-integrity-heal.ts:46-50`) — are suppressed identically; the chain cannot distinguish heal-failed from heal-succeeded; the exit code is not captured into any variable |
| Partial recovery behavior | The heal CLI exits **0 on PARTIAL restore** (some files restored, others not — `:51-57`; `source-integrity.ts:146-147` `action:"partial"`) — so even a hypothetical rc check would miss partials; only human-readable text in `dev.log` lists the failures |
| Database state after failure | The heal itself touches **no database** (worktree file restores + optional sentinel only). DB state is governed by the *later* `db-selfheal` step, which **is** fail-closed (rc≠0 → BLOCKED, `dev-watchdog.sh:207-211`). However a source-integrity failure + passing db-selfheal yields a **source-vs-DB inconsistent state that still boots** |
| Whether boot continues | **YES — unconditionally** for the heal step specifically (runtime-preflight and db-selfheal do block; the heal does not) |
| Whether security monitoring detects the failure | **No automated detection:** the exit code is discarded; no status endpoint, alert, or ledger consumer reads the heal report; the in-process guard (instrumentation.ts:78-91, 177-189) never crashes the app and only logs; plane-5 ledger/heartbeat do not consume this rc. Detection = a human reading `dev.log` |
| Partially recovered application exposure | **YES, structurally possible:** `|| true` + exit-0-on-partial + passing later gates ⇒ `next dev` serves a tree with unrestored deletions while all monitoring shows green |
| Authorization failures | The heal CLI contains **no authorization concept** (any process able to run `bun` in the repo can invoke it, or write the `db/ALLOW-FILE-DELETIONS` stand-down sentinel, `source-integrity.ts:123-129`); the `|| true` would equally suppress any future non-zero semantics (incl. authorization) added to the script — the suppression is total, not failure-class-selective |

**Finding AF-05 (extends F-0-P1-02 to the authoritative lineage):** the `|| true` at `dev-watchdog.sh:180` suppresses **runtime, integrity, (future) authorization, and recovery** failure semantics of the source-integrity heal — including silent partial recovery — and boot continues into a potentially partially-recovered application. **No boot-chain modification was made in this assignment** (directive §5); the Phase-5 recommendation is logged: capture `HEAL_RC=$?` like the drift/selfheal steps, block or alert on non-zero, and make partial restore exit non-zero.

---

## 10. Evidence package completion (directive §6)

### 10.1 SHA-256 manifest (private evidence package tier)

Artifact key: (1) `authoritative-main-delta-assessment.md` @ this branch `c5a2678` (unchanged by this assignment) · (2) `secret-history-assessment.md` @ this branch `c5a2678` (unchanged; §6.3 corrected by THIS addendum §5, not by editing the file) · (3) `independent-review-preparation.md` @ this branch, this assignment's commit (version 1.1 — updated by this assignment) · (4) `public-object-exposure-and-review-addendum.md` (this file) @ this assignment's commit — its digest travels in the commit message · (5) the committed repo integrity scanner (`scripts/security/secret-scan.ts`) @ `origin/main` `926ee00` · (6) its committed redaction helper (`scripts/security/redact-known-secrets.ts`) @ `origin/main` `926ee00` · (7) the **original one-off history-scan harness + raw redacted output** — **ABSENT from this substrate**; its digest is unrecordable from here for the reasons documented in §10.2, and the owner-side pre-re-image copy, if one exists, is the sole surviving source.

Digests (verify via `git show <ref>:<path> | sha256sum`, reviewer read-only):

| # | SHA-256 of content |
|---|---|
| 1 | `bedc0dbc184ad438ee6c50db79a7b28f3fdf16681856f01edd45a6d3c4e7f402` |
| 2 | `098112dbbf41acf21082a8c2c4eecb0f049e585f846835f3807f4412b512b96a` |
| 3 | `e2c28a73a8fb278031baf9a079b26694968d037b55cef4223333a7a4f0cfbbe2` |
| 4 | (this file — see the assignment commit message) |
| 5 | `92681a780bd974c414af7b16d423953894a64734cc190d15073458e93ad722f5` |
| 6 | `f2b9f544659cc91fb327740e6d5fc45d2ef32eb2c02d2881b85278cc01e96657` |
| 7 | (unrecordable — artifacts lost; see §10.2) |

### 10.2 Original private scan harness and redacted output bundle — honest status **[VERIFIED-FACT]**

The directory `/home/z/phase0-review-tmp/` was **destroyed by the 2026-11-11T00:20Z platform re-image** (verified absent at 11:37Z, before this session recreated the directory at 11:42Z for the new artifacts of item 3 — the original contents did not survive). The one-off scan harness and the raw redacted output retained there at SEC-P0-SECHIST-001 time were destroyed with it (F-0-P0-02). Consequences, documented without invention:

1. The **actual SHA-256 of the original harness and output bundle cannot be recorded from here** — the artifacts do not exist on this machine. The SEC-P0-IRP-001 v1.0 supplementary-manifest row ("bundle-hash recorded in custody log") was superseded in v1.1 by the ABSENT/UNRECORDABLE row (§4.1 of that document).
2. If the owner copied the private evidence package before the re-image, that copy is now the **only** surviving instance — the D-8 custody item becomes load-bearing and its hash must be recorded by the owner at transfer. If no copy was made, the original harness/output are **lost**, and reviewer reproduction of the full-history scan must rely on the committed taxonomy (SEC-P0-SECHIST-001 §1) and the committed repo scanner (hashes above).
3. **New artifacts created by this assignment** (status/count lines and object identifiers only — no values of any credential), retained in the re-created evidence directory `/home/z/phase0-review-tmp/`. Artifact key, in file-name order: (1) the blob-ID list (the 23 object identifiers — derivable, non-credential) · (2) the raw/HTML/short-SHA battery script · (3) the API-tier first-pass script · (4) the API-tier spaced-retry script · (5) the API-tier reset-timed script · (6) the consolidated status log of all batteries and passes. Corresponding file names: `key-blobs.txt` · `object-exposure-tests.sh` · `api-battery.sh` · `api-retry.sh` · `api-final.sh` · `object-exposure-tests.log`. Digests recorded at finalization 2026-11-11T12:4xZ:

| # | SHA-256 |
|---|---|
| 1 | `b77b221892153a4e66de09dd56ac9185cb11500083a62982a791b9982db0d8d1` |
| 2 | `3b170dc49ceda862db13d8ad9ca8fbe10ee876f0ac440cbcf5ba91f2444efa25` |
| 3 | `583669ebf33cb173206a569c5f26e20e6bbb87244f649e20436829cb925e7e88` |
| 4 | `7bbd517d55eb9beeccc6dbb4650a501154be18227f231740aaf5abb14d3df756` |
| 5 | `b35336d06d836fc266bc3c9174eeb4f6bc3eca27cd41f6971b592630e5a51913` |
| 6 | `14b1f55f22a0447615a97e58498e826693d209eef30ab36ba5b5365231522594` |

### 10.3 Original 17-document manifest — UNCHANGED (verified)

`security/phase-0-baseline` @ `ff595158…` remains untouched; the SEC-P0-MGMT-001 Appendix-A blob table and the SEC-P0-IRP-001 §4.1 content-hash table are unaltered by this assignment (this addendum adds rows only in §10.1 above).

### 10.4 Chain-of-custody — NOT completed (no transfer has occurred)

No evidence transfer, copy, or verification has been performed by any owner or custodian in this assignment. The SEC-P0-IRP-001 §4.4 template stands with blank fields; **no custodian is named or invented**; the addendum's new artifacts remain on the sandbox substrate (assumed-compromised) pending a genuine owner-side transfer, at which point the owner completes the template including the §10.2 item-2 hash.

---

## 11. Remaining evidence and owner actions (updated, consolidated)

1. **URGENT (new, AF-01/AF-02):** treat the C-045-a/b GitHub object exposure as **active public anonymous exposure** (§5). Owner decisions now sharper: D-3 history-remediation (trigger materially strengthened — objects retrievable, not merely "local-only"); GitHub-support engagement for dangling-object GC (unreachable-object purge is not owner-performable); evidence-branch visibility (D-8) — the pushed `security/phase-0-review-prep` documents print the retrieval keys; repo visibility posture (guarded: no change made or instructed from here beyond the decision record).
2. **P0-01 rotation (EVM):** §7 verdict — B-first sequencing, bounded A-style deprecation, three "safe"-label prerequisites; phases A–E per management plan §5; fresh role matrix + Safe dossier (D-1/D-2) still pending independent reads.
3. **P0-01 rotation (Solana, separate incident):** §6 checklist S-1…S-8 — all eight chain reads + CKPT-2 custody attestation; D-5 package prerequisites.
4. **D-1…D-9 owner-side evidence items** (SEC-P0-IRP-001 §2): all remain UNVERIFIED; D-7 gains live evidence — the backup automation pushed `backup-2026-11-11` during this session (§2.10).
5. **API surfaces AF-03/AF-04:** Phase-1 gating/test decisions (recommendations in §8.3); route census re-run per delta §11.3.
6. **Boot chain AF-05:** Phase-5 fail-closed recommendation (§9); no modification now.
7. **Independent reviewer reproduction** of §2 (unauthenticated client, §13) and of the full-history scan (per §10.2 constraints).
8. **Evidence custody:** owner-side transfer + hash recording (§10.2–10.4).

## 12. Final status

```
PHASE 0 — INDEPENDENT REVIEW PREPARATION WITH CORRECTIVE FINDINGS
P0 KEY COMPROMISE — OWNER CONTAINMENT REQUIRED
PHASE 1 — NOT AUTHORIZED
TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED
```

No compromised key is claimed revoked; no historical exposure is claimed contained; every such claim awaits independently verified evidence (owner/reviewer). No P0/P1 finding is closed by this addendum — F-0-P0-01's exposure basis is **strengthened** (demonstrated public anonymous retrievability), and the register awaits reviewer correction of the exposure-channel wording (§5).

---

## 13. Reproduction commands (independent reviewer — UNAUTHENTICATED client, separate network path)

```
# Discipline: record HTTP status and pattern-count classifications ONLY; never save/display content bodies.
# Use a clean client: no Authorization header, no .netrc, no stored GitHub cookies/credentials.
curl -s -o /dev/null -w "%{http_code}\n" \
  https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2e684d9d8/worklog.md          # expect 200
curl -s https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2e684d9d8/worklog.md \
  | grep -cE '0xdbe1[0-9a-fA-F]{56}62d6'                                               # expect 1 (count only)
curl -s -o /dev/null -w "%{http_code}\n" \
  https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2da73fd65/scripts/verify-sol-key2.ts   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65.patch  # expect 200
# controls:
curl -s -o /dev/null -w "%{http_code}\n" https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/main/worklog.md            # 200
curl -s https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/main/worklog.md | grep -cE '0xdbe1[0-9a-fA-F]{56}62d6'      # 0
curl -s -o /dev/null -w "%{http_code}\n" https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/0000000000000000000000000000000000000000/worklog.md  # 404
# API tier (watch the anonymous 60/hr bucket; x-ratelimit-limit: 60 proves unauthenticated):
curl -s -o /dev/null -w "%{http_code}\n" https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/blobs/<blob-sha>   # per §2.7
# git protocol (fresh dir, no credentials):
git init t && cd t && git remote add origin https://github.com/MITHQALMTQ/MTQ_SIGMA.git
GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/bin/true git -c credential.helper= fetch --depth=1 origin 2da73fd6542ff22962ba27d62f1593fdad1834fa   # succeeds
# blob enumeration for the API test (short SHAs resolve everywhere; full SHAs via git):
git rev-parse 2da73fd65:scripts/verify-key-and-audit-roles.ts        # etc. — 23 blobs per SEC-P0-SECHIST-001 §3
```

## 14. Limitations (honest)

1. Same-agent-lineage self-assessment (standing): reviewer reproduction of every §2 result is required before reliance.
2. The anonymous tests ran from this sandbox's shared egress IP pool; GitHub's anonymous API bucket (60/hr per IP) was contended by other clients throughout — the API tier therefore completed across three passes with spaced retries; every contended 403 resolved to 200 on retry and the 404 control validated the discrimination. raw/HTML/protocol tiers are not API-rate-limited and completed in a single pass.
3. Dissemination channels (historical clones, forks, archives, CDN retention, GH Archive) are **not enumerable** from this substrate — status [UNVERIFIED] in §3 level 6; the owner must assume the worst consistent with §4.
4. GitHub's future retention of the unreachable objects is not guaranteed either way — the exposure determination is as-of 2026-11-11 and must be re-tested by the reviewer at review time.
5. The API/§8 review is code-level only (no live requests were made to either route — no application boot authorized); runtime behavior (e.g., actual Upstash configuration, Gemini geo-restrictions) is [UNVERIFIED].
6. No secret values were retrieved into any transcript, log, or committed file: all content-bearing responses were counted (`grep -c`) or discarded (`-o /dev/null`); the raw test log and the 23-blob SHA list reside only in the private evidence package (§10.2 item 3).
