# MTQΣ Phase 0 — Public Object Exposure Review Package (Deliverable B)

**Document ID:** SEC-P0-EXPOSURE-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T13:52Z (UTC) · **Workstream:** B
**Branch:** security/phase-0-review-prep @ fc9ad97 (docs-only; ancestry unchanged) · **Author role:** implementer AI-agent lineage (evidence preparer — NOT an independent auditor)
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED

> **Standing independence limitation:** prepared inside the assessed environment by the implementer's own agent lineage; all network/chain results herein are implementer-side and require independent reproduction per the reviewer handoff package (SEC-P0-HANDOFF-001). No secret value is reproduced anywhere — fingerprints, status codes, counts, and object identifiers only.

**Assignment:** COO master directive *P0 Security Incident Containment Readiness & Independent Security Review* (2026-11-11) §3, Deliverable B — Workstream B: (i) the exposure model as the seven-level determination; (ii) known-object status; (iii) a fresh anonymous re-verification battery executed now; (iv) an independent-reviewer test package covering the 11 required checks; (v) the owner-side disclosure decision brief.
**Extends, never contradicts:** `public-object-exposure-and-review-addendum.md` (SEC-P0-ADDENDUM-001) — its §1 exposure model, §2 direct-object evidence, §5 required wording, and §13 reproduction commands are the baseline this package re-verifies and operationalizes.

---

## 1. Exposure model — current-reference reachability vs direct object addressability

**The distinction that governs everything below.** *Current-reference reachability* asks: is key material in the tree of any currently published branch/tag? *Direct object addressability* asks: can an anonymous client retrieve a specific historical object by its SHA through any GitHub interface, regardless of refs? These are different questions with different answers. On GitHub the second is **not bounded by the first**, because the object store serves objects by SHA through at least four anonymous channels: `raw.githubusercontent.com/<owner>/<repo>/<sha>/<path>`; `github.com/<owner>/<repo>/commit|blob/<sha>…` HTML pages plus `.diff`/`.patch` channels; `api.github.com/repos/<owner>/<repo>/git/blobs|trees|tags|commits/<sha>`; and the git protocol itself (`git fetch <url> <full-sha>` — upload-pack serves unreachable-by-ref commits to unauthenticated clients).

**Explicit rule [HISTORICAL — ADDENDUM-001 §1, re-affirmed]:** *the current public repo refs NOT including the key-bearing tags does NOT establish that the historical Git objects are unavailable.* Absence from current refs is **necessary but not sufficient** for de-exposure; an object that reached the GitHub object store at any time (via any historically pushed ref, since deleted or rewritten) can remain server-retrievable by SHA indefinitely, and GitHub performs dangling-object garbage collection only on its own schedule (not user-controllable). **Only direct-object testing per known SHA resolves the question — and that testing was performed (ADDENDUM-001 §2, baseline) and re-performed this session (§3 below), resolving it negatively for safety: the material IS anonymously retrievable.**

### 1.1 The seven exposure-model levels

| # | Level | Question it answers | Determination (status) |
|---|---|---|---|
| L1 | **Current-ref reachability** | Are the key-material blobs in the tree of any currently published branch/tag? | **NONE — CONFIRMED** [HISTORICAL ADDENDUM-001 §2.10/§3-L1: 0/23 blobs reachable from all 29 public-remote refs incl. `refs/pull/*`; current-`main` copies anonymously clean] · fresh control re-verified §3(a) [VERIFIED-FACT] |
| L2 | **Direct commit-SHA addressability** | Are the key-bearing historical commit objects served anonymously by SHA (HTML page, API, short and full forms)? | **CONFIRMED — anonymous** [HISTORICAL ADDENDUM-001 §2.4/§2.5/§2.7] · fresh §3(d) [VERIFIED-FACT] |
| L3 | **Historical tree/blob object addressability** | Are the trees and the 23 key-material blobs served anonymously by SHA (`git/trees`, `git/blobs` base64 content)? | **CONFIRMED — anonymous, 23/23 blobs → HTTP 200 at baseline** [HISTORICAL ADDENDUM-001 §2.7] · fresh §3(h) [VERIFIED-FACT] |
| L4 | **Raw file retrieval by commit SHA** | Does `raw…/<commit-sha>/<path>` serve the key-bearing file content? | **CONFIRMED — anonymous, 12/12 key-bearing files count 1 at baseline (+4 further Sept-lineage commits)** [HISTORICAL ADDENDUM-001 §2.2/§2.3] · fresh §3(b)(c) [VERIFIED-FACT] |
| L5 | **Commit diff/patch channels** | Do `/commit/<sha>` HTML (renders the diff) and `.diff`/`.patch` serve the added key lines verbatim? | **CONFIRMED — anonymous** [HISTORICAL ADDENDUM-001 §2.5 D1/D2 + H01/H02] · fresh §3(d)(e) [VERIFIED-FACT] |
| L6 | **Anonymous git-protocol fetch-by-SHA** | Does upload-pack deliver the historical commit + its tree/blobs to an unauthenticated fetch client? | **CONFIRMED — 12/23 blobs in one `--depth=1` request at baseline** [HISTORICAL ADDENDUM-001 §2.6] · reviewer reproduction required (§4 check 6 — not re-run this session: a fresh fetch would require creating files outside this document, prohibited by the docs-only rule) |
| L7 | **Dissemination copies — clones / forks / caches** | Who already holds a copy (historical clones, forks, CI caches, CDN edges, archive datasets)? | **UNRESOLVED by construction** [HISTORICAL ADDENDUM-001 §3-L6/§4]: current `forks_count: 0`; historical clones made while key-bearing refs existed must be assumed [UNVERIFIED]; CDN edge caching active (§2.9 baseline, §3.3 fresh); GH Archive-class datasets [UNVERIFIED from this sandbox] |

### 1.2 Four-way required wording (exact, per ADDENDUM-001 §5 / briefing §5)

> **current-refs clean CONFIRMED / retrievability-by-SHA CONFIRMED / anonymous access CONFIRMED from sandbox vantage — independent reviewer reproduction REQUIRED / historical dissemination UNRESOLVED**

Each element is evidenced: L1 by §3(a) fresh control and the 29-ref enumeration; retrievability by §3(b)–(i); anonymous access by construction (§3.1 — no credentials possible in the client) with reviewer reproduction REQUIRED (§4); dissemination UNRESOLVED (L7 — no command can enumerate historical copies).

---

## 2. Known-object status [HISTORICAL — SEC-P0-ADDENDUM-001 §2; baseline window 2026-11-11T11:38:30Z–12:41:24Z]

| Object class | Status at baseline (ADDENDUM-001 §2) |
|---|---|
| **23 key-material blobs** | 16 × C-045-a (66-hex: 12 worklog versions + `verify-key-and-audit-roles.ts` + 3 committed `tool-results/` transcripts) + 6 × C-045-b (128-hex Solana scripts) + 1 × C-045-b (88-char base58 export, `verify-sol-key2.ts`); **all 23 individually addressable via `api.github.com git/blobs/<sha>` → 200**, anonymously, base64 content served |
| **Key-bearing commits** | `2e684d9d86633e74d1f975a13a2de92a13126af2` (worklog + EVM-key blob) and `2da73fd6542ff22962ba27d62f1593fdad1834fa` (`verify-key-and-audit-roles.ts` + 6 Solana scripts + 1 base58 script + 3 tool transcripts); **plus 4 further Sept-lineage commits** tested (`802b4726e`, `66dbeafc6`, `5d4f8e7bc`, `7479a8e02` — worklog key pattern count 1 each) |
| **Two Sept tag objects** | `backup-2026-09-22` (tag object `404ae56bdb79545e14aaed6efe58ced52b51f268`) and `backup-stable-2026-09-26` (tag object `a91f1f07e7b05876426a538119257b4c294acf02`): **tag objects API-served (200) while absent from `ls-remote` refs — direct object evidence that key-bearing refs were historically PUSHED to the public remote and later deleted** (push-then-delete) |
| **Current refs** | Clean — 0/23 key-material blobs reachable from all 29 public-remote refs (branches, tags, `refs/pull/1..3/head`); current-`main` file fetches 200 with key-pattern count 0 |
| **Anonymous git-protocol fetch-by-SHA** | **Previously succeeded**: fresh empty repo, no credentials, `git fetch --depth=1 <url> 2da73fd65…` → exit 0, **859 objects including 12 of the 23 key-material blobs in one request** |
| **Repo metadata** | `visibility: "public"` · `forks_count: 0` · `default_branch: main` · `pushed_at: 2026-11-11T10:31:57Z` (baseline §2.7) |
| **CDN** | Fastly/varnish observed on object URLs (§2.9): `cache-control: max-age=300`, `etag`, `via: 1.1 varnish`, `x-github-edge-region: southeastasia` |

**Retrieval keys are published (AF-02) [HISTORICAL — ADDENDUM-001 §2.4/§4]:** the 9-char short SHAs (`2e684d9d8`, `2da73fd65`) that unlock every channel are printed in the **publicly pushed** evidence documents themselves (`secret-history-assessment.md` ×10, `independent-review-preparation.md` ×2 on `origin/security/phase-0-review-prep`) — the exposure chain is self-documenting. Owner must assume the SHAs are known to any motivated attacker.

---

## 3. Fresh re-verification battery (this session) **[VERIFIED-FACT]**

### 3.1 Method and anonymity construction

- **Client:** curl 8.14.1 (`curl --version` verified 13:29:30Z). Invocations carry **no Authorization header** (the `-v` request traces of §3.2 items show only `user-agent: curl/8.14.1` + `accept: */*`), **no cookies** (none passed, cookie engine never engaged), **no `~/.netrc`** (verified absent 13:29:30Z), **no proxy environment variables** (verified empty 13:29:30Z). The sandbox's embedded git push credential (`x-access-token` in `.git/config`, F-0-P0-03) was **never used and cannot reach curl**.
- **Anonymous API tier evidence:** `x-ratelimit-limit: 60` on the repo-metadata response (13:41:27Z) — the unauthenticated bucket (authenticated core = 5,000).
- **Safety discipline (R1-equivalent, per briefing):** every content-bearing response was piped directly into `grep -cE <pattern>` (**count only — matched text never displayed**) or discarded via `-o /dev/null` with only the HTTP status recorded. Patterns are the already-public fingerprints (EVM `0xdbe1…62d6` 66-hex form; base58 88-char form). API blob/tag-object JSON bodies were **discarded unread** (`-o /dev/null`).
- **Controls:** current-`main` fetch (expect 200/count 0) and nonexistent-commit fetch (expect 404) — both behaved exactly as expected, validating that the 200s on key-bearing objects are meaningful retrievals.
- **Test window:** 2026-11-11T13:29:52Z–13:41:48Z. **Scope:** the 12 battery URLs specified by the assignment. Client-side incidents: an initial use of curl's `-D /dev/stderr` header-dump aborted 7 fetches with status `000` (local write-error — those runs re-executed via the `-v` stderr trace); the anonymous API bucket was exhausted mid-battery (`remaining: 0`, reset 13:41:01Z), so the 6 API-tier items re-ran after the reset (with a documented `/rate_limit` poll at 13:41:18Z). Total HTTP requests issued: 26 (12 battery URLs, some hit twice for the above reasons); authenticated requests: **0**; secret content printed: **none**.

### 3.2 Results (status codes + pattern counts only; UTC timestamps)

| # | Battery item (per assignment §3) | Timestamp | Result | Expected | Baseline (ADDENDUM-001 §2, 2026-11-11T12:4xZ) | Drift |
|---|---|---|---|---|---|---|
| a | `raw…/main/worklog.md` (current-refs control) | 13:30:35Z | **200 · EVM pattern count 0** | 200 / 0 | R15-control 200 / 0 | none |
| b | `raw…/2e684d9d8/worklog.md` (key-bearing C1) | 13:30:36Z | **200 · EVM pattern count 1** | 200 / 1 | R01 200 / 1 | none |
| c | `raw…/2da73fd65/scripts/verify-sol-key2.ts` (key-bearing C2) | 13:30:36Z | **200 · base58 pattern count 1** | 200 / 1 | R09 200 / 1 | none |
| d | `github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65` (HTML page) | 13:29:52Z | **200** | 200 | §2.4/§2.5 200 | none |
| e | same + `.patch` | 13:29:53Z | **200** | 200 | D2 200 | none |
| f | `raw…/0000000000000000000000000000000000000000/worklog.md` (control) | 13:29:56Z | **404** | 404 | R18 404 | none |
| g | `api.github.com/repos/MITHQALMTQ/MTQ_SIGMA` (metadata) | 13:41:27Z | **200** · `visibility: "public"` · `forks_count: 0` · `pushed_at: 2026-11-11T12:49:41Z` · `default_branch: main` · `archived/disabled: false` · `x-ratelimit-limit: 60` | record fields | §2.7: public / 0 / pushed_at 2026-11-11T10:31:57Z | **pushed_at drifted — see §3.4**; visibility & forks unchanged |
| h | `api.github.com/…/git/blobs/210a9db97018e55ee2db75c21a8004602314eb75` (key-bearing blob — the `verify-sol-key2.ts` blob, from the 23-blob list referenced by ADDENDUM-001 §2.7) | 13:41:27Z | **200** (content discarded) | 200 | 23/23 blobs → 200 | none |
| i-1 | `api.github.com/…/git/refs/tags/backup-2026-09-22` | 13:41:48Z | **404** (same response carried `x-ratelimit-remaining: 50` → genuine 404, not rate-limit) | 404 (deleted from refs) | refs absent (§2.10) | none |
| i-2 | `api.github.com/…/git/refs/tags/backup-stable-2026-09-26` | 13:41:28Z | **404** | 404 | refs absent (§2.10) | none |
| i-3 | `api.github.com/…/git/tags/404ae56bdb79545e14aaed6efe58ced52b51f268` (tag object by SHA) | 13:41:28Z | **200** (content discarded) | 200 (object still served) | §2.7 2/2 → 200 | none |
| i-4 | `api.github.com/…/git/tags/a91f1f07e7b05876426a538119257b4c294acf02` (tag object by SHA) | 13:41:29Z | **200** (content discarded) | 200 | §2.7 2/2 → 200 | none |

Intermittent **403** responses occurred during API bursts (13:29:56Z items i-1/i-2; one rapid back-to-back retry at 13:41:48Z) — **rate-limit/secondary-limit contention artifacts from the shared anonymous egress pool, not object absence**: each resolved to the expected code on retry, and the genuine 404 (i-1) was returned with 50 requests remaining. This reproduces the baseline's documented contention behavior (ADDENDUM-001 §2.7/§14.2). Per evidence discipline, the failed attempts are recorded, not discarded.

### 3.3 CDN/cache observations (fresh) **[VERIFIED-FACT]**

`-v` header traces of §3.2 items a/b/c (13:30:35–36Z) on `raw.githubusercontent.com`: `cache-control: max-age=300` · `etag: "…"` · `via: 1.1 varnish` · `x-served-by: cache-hkg-vhhh86500{33,40,62}-HKG` (Fastly edge) · `x-fastly-request-id` present · `x-cache: MISS` / `x-cache-hits: 0` · `x-github-edge-region: southeastasia` · `expires: +300 s` · `source-age: 0`. **Consistent with baseline §2.9.** Consequence unchanged: cached edge copies mean retrieval history cannot be reasoned about from origin logs, and short-term CDN copies persist independently of any later origin-side purge; historical cache retention remains **[UNVERIFIED]**.

### 3.4 Drift determination vs the 2026-11-11T12:4xZ baseline

**The exposure posture did NOT drift — every object-level channel re-served the key-bearing objects anonymously and every control reproduced exactly.** The single metadata drift is `pushed_at` (baseline `2026-11-11T10:31:57Z` → now `2026-11-11T12:49:41Z`), which is **fully accounted for and benign**: the addendum commit `fc9ad97` on `security/phase-0-review-prep` has committer date `2026-11-11T12:49:32Z` (verified read-only via `git log -1 --format=%cI fc9ad97`), i.e. the repository's own docs-only push for this program occurred 9 s before the recorded `pushed_at`. `visibility` (public) and `forks_count` (0) are unchanged. **Conclusion: the 23-blob / 2-commit / 2-tag-object exposure state is IDENTICAL to the baseline as of 2026-11-11T13:41Z.** GitHub's future retention of the unreachable objects is guaranteed neither way (ADDENDUM-001 §14.4) — the reviewer must re-test at review time (§4).

---

## 4. Independent reviewer test package — the 11 required checks

### 4.0 Test environment and discipline (applies to ALL checks — verify before starting)

| Requirement | Discipline |
|---|---|
| Fresh machine, separate network connection | Run on a machine **never used for this repository**, on a network path independent of the sandbox egress; do not reuse any sandbox clone |
| No Authorization header | Plain `curl` with no `-H "Authorization: …"`; the `-v` trace must show only `user-agent`/`accept` request headers |
| No `.netrc` | Verify `~/.netrc` absent (`[ -f ~/.netrc ]` must be false) before starting |
| No git credential helper | Check-6 fetch uses in-command `git -c credential.helper=` plus `GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/bin/true`; no helpers configured on the fresh machine |
| No cookies | No browser session, no `-b` cookie jar; curl sends none by default |
| No embedded push token | Never use any clone of the sandbox substrate (its `.git/config` carries an embedded push credential, F-0-P0-03); the check-6 repo is a fresh `git init` |
| Reporting discipline | Record **response-status codes and content-classification counts only**; never print, save, or paste any retrieved body content |
| Never print secret values | Fingerprints `first-6…last-6` only for classification notes; all content tests go through `grep -cE <pattern>` (count only) |
| Known fingerprints for classification only | The EVM form matches the public fingerprint already disclosed in `docs/security/CRITICAL-PRIVATE-KEY-ROTATION.md`; the base58 form likewise. They identify the known-compromised material — nothing new is derived |
| Never test a compromised key by using it | **Retrieval tests only.** No import into any wallet/tool, no signing, no transaction, no balance probe using retrieved material — on-chain verification of *authority state* is separate (per SEC-P0-EVMCR-001 / SEC-P0-SOLCR-001) |

Record for each check: UTC timestamp, HTTP status, pattern count (if applicable), and the `x-ratelimit-limit: 60` header on at least one API response (anonymous-tier proof). Commands below are self-contained (based on ADDENDUM-001 §13, extended per check).

### 4.1 Check 1 — current branch and tag reachability (git ls-remote + API refs)
- **Purpose:** establish that no **currently published ref** reaches key material, and that the two September tags are absent from refs (the L1 level — and its insufficiency, §1).
- **Exact commands:**
```bash
git ls-remote https://github.com/MITHQALMTQ/MTQ_SIGMA.git          # enumerate ALL refs (expect: main, security branches, backup-2026-10-24…11-11 tags, no-rollback-anchor, refs/pull/1..3/head; NO backup-2026-09-22 / backup-stable-2026-09-26)
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/refs/tags/backup-2026-09-22          # expect 404
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/refs/tags/backup-stable-2026-09-26   # expect 404
curl -s https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/main/worklog.md | grep -cE '0xdbe1[0-9a-fA-F]{56}62d6'              # expect 0 (current-refs clean)
```
- **Expected result:** ls-remote exits 0 and lists no September tags; both ref endpoints 404; main-`worklog.md` fetch 200 with EVM pattern count 0.
- **Actual result (reviewer):** `________________` (timestamp · statuses · count)

### 4.2 Check 2 — direct historical commit addressability
- **Purpose:** confirm both key-bearing commit objects (and short-SHA forms) are served anonymously by SHA (L2) — including the exact short forms printed in the pushed evidence documents (AF-02).
- **Exact commands:**
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd6542ff22962ba27d62f1593fdad1834fa   # expect 200 (commit page renders the diff)
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2e684d9d86633e74d1f975a13a2de92a13126af2   # expect 200
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65                                 # expect 200 (SHORT SHA resolves)
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/commits/2da73fd65                      # expect 200 (API, short SHA)
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/0000000000000000000000000000000000000000  # expect 404 (control)
```
- **Expected result:** 200 / 200 / 200 / 200; control 404.
- **Actual result (reviewer):** `________________`

### 4.3 Check 3 — historical tree and blob addressability
- **Purpose:** confirm the 23 key-material blobs (and the intro-commit trees) are individually addressable at the API object tier (L3) without any ref. Full 23-blob enumeration optional: derive blob IDs read-only from a local evidence copy per ADDENDUM-001 §13 (`git rev-parse <commit>:<path>`; the list is retained in the private evidence package `key-blobs.txt`).
- **Exact commands:**
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/blobs/210a9db97018e55ee2db75c21a8004602314eb75   # expect 200 (key-material blob; body DISCARDED — never print)
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/blobs/cc6c62666fcf4a168ee37e88b5b423a0edcba9fa   # expect 200 (another key-material blob)
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/trees/ee765cfa9c0120414070360598b5a0a8e62f7372   # expect 200 (tree of 2da73fd65)
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/trees/070c31e5e2379ad5c276ff71ade685ba54c419ab   # expect 200 (tree of 2e684d9d8)
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/blobs/0000000000000000000000000000000000000000   # expect 404 (control)
```
- **Expected result:** 200 ×4; control 404. (HTML/raw layers do NOT resolve bare tree SHAs — 404 there is expected and irrelevant; the API tier serves the objects.)
- **Actual result (reviewer):** `________________`

### 4.4 Check 4 — raw historical file retrieval
- **Purpose:** confirm the raw-file channel serves key-bearing file content at historical commit SHAs (L4) and that current-`main` copies of the same paths are clean (control).
- **Exact commands:**
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2e684d9d8/worklog.md                       # expect 200
curl -s https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2e684d9d8/worklog.md | grep -cE '0xdbe1[0-9a-fA-F]{56}62d6'                 # expect 1 (count only — never display)
curl -s -o /dev/null -w '%{http_code}\n' https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2da73fd65/scripts/verify-sol-key2.ts     # expect 200
curl -s https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2da73fd65/scripts/verify-sol-key2.ts | grep -cE '[1-9A-HJ-NP-Za-km-z]{88}'   # expect 1
curl -s -o /dev/null -w '%{http_code}\n' https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/0000000000000000000000000000000000000000/worklog.md   # expect 404 (control)
```
- **Expected result:** 200 + count 1; 200 + count 1; control 404. (Optional extension per ADDENDUM-001 §2.3: `worklog.md` at `802b4726e`/`66dbeafc6`/`5d4f8e7bc`/`7479a8e02` — each 200 + EVM count 1.)
- **Actual result (reviewer):** `________________`

### 4.5 Check 5 — commit diff and patch retrieval
- **Purpose:** confirm the diff/patch channels serve the key lines verbatim (L5) — the commit page renders the diff; `.diff`/`.patch` return the added lines.
- **Exact commands:**
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65.diff    # expect 200
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65.patch   # expect 200
curl -s https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65.patch | grep -cE '0xdbe1[0-9a-fA-F]{56}62d6'   # expect ≥1 (count only — the diff renders the added line verbatim)
```
- **Expected result:** 200 / 200 / count ≥ 1.
- **Actual result (reviewer):** `________________`

### 4.6 Check 6 — anonymous Git fetch-by-SHA (the protocol tier)
- **Purpose:** confirm GitHub's upload-pack serves the unreachable-by-ref historical commit and its tree/blobs to an **unauthenticated** fetch client (L6) — the channel that matters for any clone-shaped tooling, not just HTTP.
- **Exact commands:**
```bash
mkdir fetch-test && cd fetch-test && git init
git remote add origin https://github.com/MITHQALMTQ/MTQ_SIGMA.git
GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/bin/true git -c credential.helper= fetch --depth=1 \
  https://github.com/MITHQALMTQ/MTQ_SIGMA.git 2da73fd6542ff22962ba27d62f1593fdad1834fa
# expect: exit 0, "* branch 2da73fd… -> FETCH_HEAD"
git rev-parse FETCH_HEAD                     # expect 2da73fd6542ff22962ba27d62f1593fdad1834fa
git rev-list --objects FETCH_HEAD | wc -l    # object count (baseline: ~859 objects incl. 12 key-material blobs)
git show FETCH_HEAD:scripts/verify-sol-key2.ts | grep -cE '[1-9A-HJ-NP-Za-km-z]{88}'   # expect 1 (count only)
cd .. && rm -rf fetch-test                   # clean up the scratch directory afterwards
```
- **Expected result:** fetch succeeds with no credentials (exit 0); `FETCH_HEAD` equals the requested SHA; the delivered object set includes key-material blobs (baseline: 12/23 in this one `--depth=1` request).
- **Actual result (reviewer):** `________________`
- **Note:** a plain `git clone` of the public repo does **not** contain these objects (clone walks current refs) — only explicit SHA fetches retrieve them; any holder of the SHAs can.

### 4.7 Check 7 — anonymous API access
- **Purpose:** confirm the API tier serves the repository and its objects to unauthenticated clients, with the anonymous bucket (`x-ratelimit-limit: 60`) proving the unauthenticated tier (level "anonymous access" of the four-way wording).
- **Exact commands:**
```bash
curl -s -o /dev/null -w '%{http_code} rl=%header{x-ratelimit-limit}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA   # expect 200, rl=60
curl -s https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA | grep -oE '"(visibility|forks_count|pushed_at)": *("[^"]*"|[0-9]+)'   # metadata fields only
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/blobs/210a9db97018e55ee2db75c21a8004602314eb75   # expect 200 (body discarded)
```
- **Expected result:** 200 with `x-ratelimit-limit: 60` (unauthenticated tier); fields recorded; blob endpoint 200. Intermittent 403 = rate-limit artifact (retry; a 404 **control** — Check 3's zeros-blob — discriminates).
- **Actual result (reviewer):** `________________`

### 4.8 Check 8 — anonymous web access
- **Purpose:** confirm the human-facing web tier (repo root, commit and blob pages) serves the public repository and the historical objects without login.
- **Exact commands:**
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/MITHQALMTQ/MTQ_SIGMA                                  # expect 200 (repo root viewable)
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65                # expect 200
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/MITHQALMTQ/MTQ_SIGMA/blob/2e684d9d8/worklog.md      # expect 200 (blob view by commit SHA)
curl -s -o /dev/null -w '%{http_code}\n' https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/0000000000000000000000000000000000000000   # expect 404 (control)
```
- **Expected result:** 200 / 200 / 200; control 404.
- **Actual result (reviewer):** `________________`

### 4.9 Check 9 — CDN and cache observations
- **Purpose:** document that object URLs are fronted by a CDN (Fastly/varnish), so retrieval history cannot be reasoned about from origin logs and short-term edge copies persist independent of origin purges (L7-cache component).
- **Exact commands:**
```bash
curl -s -o /dev/null -D - https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2e684d9d8/worklog.md \
  | grep -iE 'cache-control|etag|^via|expires|source-age|x-cache|x-served-by|x-github-edge-region|x-fastly'
```
- **Expected result (headers only, no body):** `cache-control: max-age=300`; `etag: "…"`; `via: 1.1 varnish`; `x-served-by: cache-…-HKG` (Fastly); `x-github-edge-region` (e.g. southeastasia); optionally re-request to observe `x-cache: HIT` after a first `MISS`.
- **Actual result (reviewer):** `________________`

### 4.10 Check 10 — historical push/deletion evidence
- **Purpose:** confirm the server-side retention of both September annotated-tag **objects** while their **refs** are absent — direct object evidence that key-bearing refs were historically pushed to the public remote and later deleted (upgrades L6-push from inferred to object-evidenced).
- **Exact commands:**
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/tags/404ae56bdb79545e14aaed6efe58ced52b51f268    # expect 200 (tag OBJECT of backup-2026-09-22 still served)
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/tags/a91f1f07e7b05876426a538119257b4c294acf02    # expect 200 (backup-stable-2026-09-26)
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/refs/tags/backup-2026-09-22     # expect 404 (ref deleted)
curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/refs/tags/backup-stable-2026-09-26   # expect 404 (ref deleted)
```
- **Expected result:** objects 200 ×2 **and** refs 404 ×2 — the combination is the evidence (objects served while absent from refs ⇒ historical push + ref deletion; exact ref-path/dates remain [UNVERIFIED] — GitHub keeps no deleted-ref trace).
- **Actual result (reviewer):** `________________`

### 4.11 Check 11 — clone and fork dissemination uncertainty
- **Purpose:** bound **current** fork dissemination and document, honestly, that pre-existing clone/cache/archive copies are **unknowable from outside GitHub** — the dissemination determination stays **UNRESOLVED by construction** (L7).
- **Exact commands:**
```bash
curl -s https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA | grep -oE '"forks_count": *[0-9]+'      # record CURRENT count (baseline and 13:41:27Z read: 0)
git ls-remote --heads https://github.com/MITHQALMTQ/MTQ_SIGMA.git | wc -l                          # current branch count (context for the ref surface)
```
- **Expected result:** a recorded `forks_count` (0 at both the 2026-11-11T12:4xZ baseline and the 13:41:27Z re-read — **not** a claim about September); then the reviewer states: *pre-existing clone copies, deleted forks, CI caches, CDN retention, and third-party archive datasets cannot be enumerated by any client-side command — the historical-dissemination element of the four-way wording remains UNRESOLVED.*
- **Actual result (reviewer):** `________________` (forks_count + the UNRESOLVED statement, or contrary evidence if found)

---

## 5. Owner-side disclosure decision brief (directive §3.2)

### 5.1 Current public visibility
`visibility: "public"` **[VERIFIED-FACT — 13:41:27Z anonymous API read]**; `forks_count: 0`; `pushed_at: 2026-11-11T12:49:41Z` (this program's own docs-only push); not archived/disabled. The repository is anonymously viewable, cloneable, and object-addressable in full (§3).

### 5.2 Risk — the retrieval keys are already published (AF-02)
The retrieval keys for every exposure channel are the **short commit SHAs printed in the pushed evidence documents themselves** (`2e684d9d8`, `2da73fd65` — in `secret-history-assessment.md` and `independent-review-preparation.md` on the public `security/phase-0-review-prep` branch). The exposure chain is therefore **self-documenting**: public repo → pushed security branch → evidence document → short SHA → anonymous raw/diff/API/protocol retrieval → key material. Independently, GitHub push events for a public repo are recorded in public event feeds and third-party archive datasets — reconstructability of the September-era SHAs by a motivated party must be assumed **[UNVERIFIED from this sandbox — ADDENDUM-001 §4.2]**. Consequence: **the commit SHAs must be assumed KNOWN to any motivated attacker.**

### 5.3 Risk — previously created copies
Historical clones made while any key-bearing ref existed (September 2026 → deletion) **must be assumed to exist** (unknowable otherwise — §4.11); CI caches and archive datasets similarly [UNVERIFIED]. CDN edge copies are **active** on the object URLs (§3.3: Fastly, `max-age=300`, HIT/MISS behavior) — short-term edge copies persist independently of any later origin-side purge; historical cache retention [UNVERIFIED]. Any visibility or history change made now does not recall these copies.

### 5.4 Limits of removing tags or rewriting Git history
1. **Unreferenced objects remain directly addressable while the server retains them** — demonstrated this session: both September tag **objects** answer `git/tags/<sha>` with 200 while their **refs** return 404 (§3 i-1…i-4). Deleting a ref does not delete an object.
2. **GitHub-side garbage collection of dangling objects is not user-controllable** — an owner cannot force collection of unreachable objects; engaging GitHub support is the only channel (and even then, retention is server-policy).
3. **History rewrite breaks reachability, not addressability** — rewriting refs changes which commits a clone walks, but every old object ID keeps answering by SHA in the object store (and old SHAs are published, §5.2).
4. **External copies are unaffected** — clones, forks, caches, archives made before any rewrite keep whatever they captured.

### 5.5 Changing visibility to private — benefits AND limitations
- **Benefit:** blocks **new** anonymous web/API/raw/clone access to the repository, including the anonymous git-protocol fetch-by-SHA channel (upload-pack requires authentication for private repos). This closes the *going-forward* anonymous retrieval path through GitHub itself.
- **Limit 1:** it does **NOT** erase existing copies — already-fetched clones, fork copies (if any ever existed), CDN edge caches, and archive datasets persist outside GitHub.
- **Limit 2:** it does **NOT** remediate the already-exposed key material — the C-045-a/C-045-b literals were retrievable anonymously since September 2026; visibility is perimeter control, not containment of the secret.
- **Limit 3:** it constrains the independent-reviewer reproduction package (§4) — checks would then require owner-granted read access, changing the evidence character of this program's reproduction steps.

### 5.6 Additional controls required EVEN AFTER visibility restriction
1. **Treat both exposed key materials as compromised until rotated — rotation is the actual containment.** Deletion/visibility/history operations are not remediation (standing rule, `CRITICAL-PRIVATE-KEY-ROTATION.md`); only owner-controlled on-chain rotation (P0-01 packages D4/D5, per SEC-P0-EVMCR-001 and SEC-P0-SOLCR-001) removes attacker capability.
2. **On-chain monitoring for key usage** — watch for any activity by the compromised EOA `0x3C39…c8d8c` (and Solana C-045-b authority usage); expected state is **zero historical activity — any movement = active incident** (management plan §5.3 watch).
3. **Engage GitHub support regarding unreachable objects** — request dangling-object garbage collection for the 23 blobs, the two intro commits' objects, and the two September tag objects; record the request and outcome in the decision register.

### 5.7 Recommendation and explicit non-actions
**Recommendation (URGENT): the owner should decide on restricting repository visibility NOW** — the exposure is active, anonymous, and self-documenting (§5.2), and every hour of public posture extends the window for new anonymous retrieval. Record the decision (accept / restrict / restrict-with-support-engagement) in `owner-p0-decision-register.md` (SEC-P0-DECISIONS-001) with the §5.5 limits and §5.6 required-additional-controls acknowledged.

**Explicit statements (per directive):** this agent did **NOT** change repository visibility (it remains public, verified 13:41:27Z); did **NOT** delete any historical evidence (refs, tags, objects, documents all untouched — read-only discipline throughout); and does **NOT** claim that making the repository private would erase existing copies (§5.5 Limits 1–2 stand).

### 5.8 Related registered disclosure event (2026-11-11 owner-message credentials)
The 2026-11-11 owner directive message itself contained plaintext credentials (types: GitHub PAT; Vercel token; Turso database URL + token; Neon Postgres URL + password; Inngest event key + signing key — **values redacted; not used, not echoed, not stored here**). This is relevant to this brief in two ways: (a) a **second GitHub credential has now also been exposed in the transcript**, and **repository-visibility decisions do not remediate credential exposure either** — credential rotation is a separate, equally urgent owner action (relationship to the repo's embedded push token UNKNOWN pending owner comparison); (b) it reinforces that perimeter decisions on the repository do not substitute for rotating every exposed secret. Rotation of those credentials is urgently recommended (owner-side).

---

## 6. Findings and cross-references

### 6.1 Findings touched by this package

| ID | Finding | Status after this package |
|---|---|---|
| AF-02 | Self-documenting exposure chain: retrieval keys (short SHAs) printed in the pushed evidence documents; objects anonymously retrievable | **STRENGTHENED [VERIFIED-FACT]** — fresh battery (§3) reproduces every channel 2026-11-11T13:29–13:41Z; chain unchanged |
| F-0-P0-01 | C-045-a key compromise; exposure basis = demonstrated public anonymous retrievability (ADDENDUM-001 §5) | **UNCHANGED, still OPEN** — fresh re-verification confirms retrievability persists; rotation not performed (owner action) |
| F-0-P0-01 (Solana sub-finding / C-045-b) | 7 key-material blobs of the separate Solana incident, all on the same exposed objects | **UNCHANGED, still OPEN** — `verify-sol-key2.ts` re-verified 200/count 1 (§3c); blob API 200 (§3h) |
| F-0-P0-03 | Embedded push credential scope (GitHub-side audit) | **OPEN [UNVERIFIED]** — compounded by the 2026-11-11 owner-message credential disclosure event (§5.8); owner comparison pending |
| (new, minor) | `pushed_at` drift 10:31:57Z → 12:49:41Z | **Explained, benign** — this program's docs-only push fc9ad97 (§3.4); no exposure-relevant drift |
| — | Dissemination (historical clones/forks/caches/archives) | **UNRESOLVED by construction** (§4.11) — no client-side command can enumerate; owner assumes worst case per ADDENDUM-001 §4 |

### 6.2 Cross-references

- **Prior evidence (this branch, frozen):** `public-object-exposure-and-review-addendum.md` (SEC-P0-ADDENDUM-001) §1 exposure model · §2 baseline object tests · §5 required wording · §13 reproduction commands; `secret-history-assessment.md` (SEC-P0-SECHIST-001) §3 blob inventory/ref-reachability; `independent-review-preparation.md` (SEC-P0-IRP-001 v1.1) §2 D-8; `authoritative-main-delta-assessment.md` (SEC-P0-DELTA-001).
- **Companion documents (authored in parallel on this branch — reference by filename/ID):** `p0-evidence-preservation-register.md` (SEC-P0-EVIDENCE-001, Workstream A) · **this file** (SEC-P0-EXPOSURE-001, B) · `evm-key-compromise-containment-readiness.md` (SEC-P0-EVMCR-001, C) · `solana-key-compromise-containment-readiness.md` (SEC-P0-SOLCR-001, D) · `api-authorization-independent-review-package.md` (SEC-P0-APIREV-001, E) · `boot-chain-source-integrity-review.md` (SEC-P0-BOOT-001, F) · `platform-identity-and-recovery-separation.md` (SEC-P0-IDENT-001, G) · `independent-security-reviewer-handoff.md` (SEC-P0-HANDOFF-001, H) · `owner-p0-decision-register.md` (SEC-P0-DECISIONS-001, I) · `p0-containment-readiness-executive-report.md` (SEC-P0-EXEC-001, J).
- **Owner-decision hooks:** D-8 (public repository exposure decision / evidence-branch visibility / repo-visibility posture), D-3 (history remediation — trigger materially strengthened), D-4 (GitHub token identity/scope), per SEC-P0-IRP-001 §2; visibility decision record → `owner-p0-decision-register.md`.
- **Key object identifiers used above:** commit `2e684d9d86633e74d1f975a13a2de92a13126af2` · commit `2da73fd6542ff22962ba27d62f1593fdad1834fa` · trees `070c31e5e2379ad5c276ff71ade685ba54c419ab` / `ee765cfa9c0120414070360598b5a0a8e62f7372` · tag objects `404ae56bdb79545e14aaed6efe58ced52b51f268` / `a91f1f07e7b05876426a538119257b4c294acf02` · sample blob IDs `210a9db97018e55ee2db75c21a8004602314eb75` / `cc6c62666fcf4a168ee37e88b5b423a0edcba9fa` (of the 23, list retained in the private evidence package `key-blobs.txt`).

---

## 7. Limitations (honest) and final status

1. **Standing independence limitation:** same-agent-lineage self-assessment — the §3 battery ran from this sandbox's shared egress pool; **reviewer reproduction per §4 on a separate unauthenticated path is REQUIRED before reliance** (four-way wording: anonymous access CONFIRMED *from sandbox vantage*).
2. The anonymous API bucket (60/hr/IP) is contended from the shared egress pool; intermittent 403s occurred and **every one resolved to the expected code on retry**; a failed query is recorded, never treated as a negative result (§3.2 note).
3. Dissemination channels (historical clones, deleted forks, CI caches, archive datasets, historical CDN retention) are **not enumerable from any client** — UNRESOLVED by construction; the owner must assume the worst consistent with §5.2–§5.3.
4. GitHub's future retention of the unreachable objects is guaranteed neither way; the exposure determination is **as-of 2026-11-11T13:41Z** and must be re-tested at review time (§4).
5. The git-protocol fetch (L6) was **not re-run this session** (a fresh fetch would create files outside this document — prohibited docs-only discipline); it stands on the baseline [HISTORICAL ADDENDUM-001 §2.6] and is fully specified for the reviewer (§4.6).
6. No secret value was retrieved into any transcript, log, or file: all content-bearing responses were counted (`grep -c`) or discarded (`-o /dev/null`); only status codes, pattern counts, response headers, repository metadata fields, and object identifiers were recorded.

```
PHASE 0 — INDEPENDENT REVIEW PREPARATION WITH CORRECTIVE FINDINGS
P0 KEY COMPROMISE — OWNER CONTAINMENT REQUIRED
PHASE 1 — NOT AUTHORIZED
TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED
```

No compromised key is claimed rotated or revoked; no historical exposure is claimed contained; every such claim awaits independently verified owner/reviewer evidence. The owner's URGENT visibility decision (§5.7) and the rotation packages remain OPEN.
