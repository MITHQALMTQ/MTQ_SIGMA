# Phase 0 — Secret-History Assessment (read-only full-history scan, redacted evidence)

**Document ID:** SEC-P0-SECHIST-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T03:2xZ (UTC)
**Assignment:** COO *Phase-0 Independent Verification Support*, §C — complete read-only scan of all reachable git history, branches, and tags for private-key and credential exposure; classification of real key material vs hashes / addresses / public test keys / role constants; counts and locations only.
**Redaction discipline:** no secret values reproduced anywhere (repo convention: fingerprints first-6…last-6 + length). The two known-literal *identification rules* reuse the public fingerprints already disclosed in `docs/security/CRITICAL-PRIVATE-KEY-ROTATION.md` (e.g. `0xdbe1…62d6`).
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED.

---

## 1. Method **[VERIFIED-FACT]**

- **Scope:** every object reachable from **all refs** in the local repository — 4 local heads (`main` substituted, `security/phase-0-baseline`, `security/phase-0-management-plan`, `security/phase-0-review-prep`), 4 remote-tracking refs (incl. `origin/backup-incident10-amend`), **23 tags** (`backup-2026-09-22` … `backup-2026-11-10`, `backup-stable-2026-09-26`, `no-rollback-anchor-2026-10-25`). `git rev-list --all` → **401 commits / 7,221 unique objects / 3,923 text-scan-eligible blobs** (3,298 binary-extension blobs skipped: images/media; 0 oversize; 0 decode failures — largest blob ~80 MB, all scanned).
- **Rule taxonomy** mirrors the repo's own fail-closed scanner (`scripts/security/secret-scan.ts`): known-compromised literals C-045-a/b (unsuppressible, matched by their public fingerprints); `0x`+64-hex and bare 64-hex and 128-hex **in key-shaped line context**; base58 80–90-char strings; PEM private-key headers; mnemonic/seed-phrase assignments; env-style `PRIVATE_KEY|DEPLOYER_PRIVATE_KEY|KEEPER_PRIVATE_KEY|SOL_SECRET_KEY|SECRET_KEY|MNEMONIC|SEED_PHRASE = <value>`; plus credential shapes the repo scanner does not cover: GitHub token shapes (`ghp_/gho_/ghs_/ghu_/ghr_`, `github_pat_`), AWS key shapes (`AKIA…`), `x-access-token` values.
- **Classification of matches** into: real key material; public test keys; public validator/consensus data; role constants; hashes/digests; build artifacts; placeholders; on-chain storage evidence — by line-context and file semantics (spot-verified on samples, values redacted before display).
- **Commit mapping:** blob → commits via `git log --all -- <path>` + `git rev-parse <c>:<path>` equality (path-history simplification limitation noted in §8).
- **Ref-reachability of real key material:** each key-bearing blob tested against `git rev-list <ref> --objects` for every **public-remote** ref and every **local-only** ref — the decisive exposure discriminator (§3).
- Scan harness (read-only, one-off, not committed): `/home/z/phase0-review-tmp/secret-history-scan.mjs`; raw redacted output retained at `/home/z/phase0-review-tmp/secret-scan-output.txt` for the private evidence package.

## 2. Verified historical key locations **[VERIFIED-FACT — re-verification of the register]**

- **C-045-a at `2e684d9d8:worklog.md`** — full-literal count **1** (register said 1 ✓).
- **C-045-a at `2da73fd65:scripts/verify-key-and-audit-roles.ts`** — count **1** (register said 1 ✓).
- **Current trees clean:** `926ee00:worklog.md` full-literal count **0** (5 mentions of the *redacted fingerprint notation* `0xdbe1…62d6` only); `d6fd5d6:worklog.md` 0; `CRITICAL-PRIVATE-KEY-ROTATION.md` fingerprint-notation only. Worktree scan (Phase-0 evidence-index) 0 matches — consistent.

## 3. Complete real-key-material inventory and where it actually lives

**Real key material = 23 blobs (16 C-045-a + 6 C-045-b hex + 1 C-045-b base58). All 23 sit on the September lineage reachable ONLY from two LOCAL tags — `backup-2026-09-22` (tag obj `404ae56b`) and `backup-stable-2026-09-26` (`a91f1f07`). [VERIFIED-FACT]**

**Ref-reachability test (definitive, per-ref `git rev-list <ref> --objects`):**

| Ref | real-key-material blobs reachable |
|---|---|
| `origin/main` @ 926ee00 | **0** |
| `origin/backup-incident10-amend` (9fe4058) | **0** |
| `origin/security/phase-0-baseline` (ff595158) | **0** |
| `origin/security/phase-0-management-plan` (a328d97) | **0** |
| local `backup-2026-09-22` | **23** |
| local `backup-stable-2026-09-26` | **23** |

**Public-remote refs actually present** (`git ls-remote origin`, 2026-11-11T03:1xZ): `main`, `backup-incident10-amend`, the two security branches, HEAD; tags `backup-2026-10-24` … `backup-2026-11-10` + `no-rollback-anchor-2026-10-25`. The two September tags are **absent from the remote** — no public-remote ref reaches any key-material blob.

**Locations (counts and paths only; fingerprints redacted to repo convention):**

| # | Path (at the Sept lineage) | Class | Intro commit |
|---|---|---|---|
| 1 | `scripts/verify-key-and-audit-roles.ts` | C-045-a (66-hex) ×1 | `2da73fd65` |
| 2–4 | `tool-results/read_1788722996398_…txt`, `read_1788725306776_…txt`, `read_1788731310038_…txt` | C-045-a ×1 each | `2da73fd65` |
| 5–16 | `worklog.md` — **12 distinct blob versions** carry the literal | C-045-a ×1 each | `2e684d9d8` (first); carried through the Sept-line worklog chain (≥10 mapped commits incl. `802b4726e`, `7479a8e02`, `4aa451e9f`, `29a2b8364`, `e34cba5ab`, `66dbeafc6`, `6d94c4989`, `2ba734d27`, `5d4f8e7bc`; 2 versions tree-reachable without direct commit-path attribution — §8 limitation) |
| 17–22 | `scripts/solana-create-fresh.ts`, `solana-create-umi.ts`, `solana-create-with-metadata.ts`, `solana-set-metadata-v2.ts`, `solana-set-metadata.ts`, `verify-hex-key.ts` | C-045-b (128-hex) ×1 each | `2da73fd65` |
| 23 | `scripts/verify-sol-key2.ts` | C-045-b **base58 form** (88-char export) ×1 | `2da73fd65` |

**New findings beyond the Phase-0 register [VERIFIED-FACT]:**
1. **The AI-tool transcript channel is committed key exposure**: three `tool-results/read_*.txt` blobs (the session tooling's own output transcripts) contain the C-045-a literal — the register's five-channel record listed "AI-session transcript" as an exposure channel but did **not** record that such transcripts were *committed into the repository*.
2. **The worklog exposure is multi-version**: 12 distinct worklog blob versions carry the literal (not just the single intro commit `2e684d9d8` the evidence-index verified).
3. **C-045-b breadth**: 7 files (6 hex + 1 base58) at one root commit — matches the rotation doc's "base58 form the prior census missed".
4. **The public-remote reachability of the key literals is ZERO today** — the register's and the COO directive's "key in public Git history" formulation requires refinement: the literal is recoverable from *the repository's git history* (any local clone/image that carries the two September tags — including every platform re-image that preserved `.git`, and the current sandbox), while **no currently-pushed ref reaches it**. Whether key-bearing refs were ever pushed to the remote and later deleted is **[UNVERIFIED]** (ls-remote shows present state only; GitHub retains no public deleted-ref trace). This does **not** weaken F-0-P0-01: the assumed-compromised substrate (this sandbox, platform images, any historical local copy) demonstrably holds the material, and the owner declared treat-as-compromised on 2026-10-24.

## 4. Classification of everything else found (non-secret) **[VERIFIED-FACT]**

| Class | Occurrences | Distinct blobs / paths | Classification basis (spot-verified) |
|---|---|---|---|
| SHA-256/structural digests | 7,273,434 | 733 / 346 | manifest/dump/evidence hash fields (`sha256`, `digest`, `hash`, merkle/tx/block hashes) |
| Role-constant 66-hex | 7,398 | 534 / 351 | OZ AccessControl role hashes & keccak constants in `.sol`/audit docs (e.g. custom `ADMIN_ROLE` identifiers in `audit-work/task11/D8…`, Safe singleton bytecode digest in `CORRECTIONS-REGISTER.md`) |
| Hex-66 unclassified | 8,718 | 74 / 55 | audit evidence JSONs — `eth_getStorageAt`/raw RPC storage words (top: `audit-work/v9-task9/evidence/raw.jsonl` 7,873) — on-chain public data |
| Public test key | present across the worklog chain | — | the Anvil/Hardhat deterministic dev-account #0 key (`0xac09…f2ff80`) — public-by-convention, value-less; co-occurs beside C-045-a entries in worklog versions |
| Devnet validator **public** keys | in every chain dump / generation / genesis | `config/chain-genesis.json` `"pub_key"` ×4; `validators.pub_key` column; `db/generations/*/chain.db` | public ed25519 validator identities (UI-displayed) |
| Devnet consensus artifacts | ~121 per chain dump | QC `"sig"` 128-hex, block/state/validator hashes | public chain data (signatures/hashes are publish-by-definition) |
| Build artifacts | foundry-out JSON | `0x6080…`-prefixed 66-hex = deployed-bytecode segments (PUSH1 0x80 runtime prefix), repeated across artifacts | not key material |
| Placeholders | 11 | 6 / 2 | `.env.example` + `mini-services/keeper/.env.example` `0xyour…_here`-style values |
| Test fixture | 2 | 2 / 1 | `secret-scan.test.ts` 12-word mnemonic fixture (public test vector) |

## 5. Negative results **[VERIFIED-FACT]**

- **Zero** GitHub-token-shaped strings, **zero** AWS-key-shaped strings, **zero** `x-access-token` values, **zero** PEM private-key blocks across all 3,923 scanned blobs (7,221 objects) of reachable history — the embedded push credential has **never entered git-tracked content** (it lives only in local `.git/config`, F-0-P0-03 substrate).
- `git log --all -- '.env' '.env.local' '.env.production'` → **empty** (never committed).
- No blob ever existed at `upload/private_key.txt` (the 2026-10-24 owner-supplied key file was never committed; `upload/` holds only documents/screenshots — path census verified).
- `.fresh-evm-keypair-DO-NOT-COMMIT.txt` never committed (gitignored output, absent).
- No oversized blobs were skipped; no decode failures.

## 6. Exposure implications and containment hooks (analysis, not action)

1. **Deletion is not remediation** (standing rule; `CRITICAL-PRIVATE-KEY-ROTATION.md`): the only true containment for C-045-a/b is the owner-controlled on-chain rotation (P0-01 procedure §5 of the management plan; D4/D5 packages).
2. **The two local September tags are the operative in-substrate exposure**: every environment that carries this `.git` (current sandbox; every platform re-image that preserved it) can extract the key material by checking out those tags. Local tag deletion would break reachability but is **history manipulation = owner decision under D3** (`audit-work/task12/D3-GIT-HISTORY-REMEDIATION-PLAN.md` — requires owner + security-lead approval; NOT performed, NOT recommended from here) — and object-DB remnants may survive in platform snapshots regardless.
3. **Public-remote posture today**: no key literal reachable from any pushed ref; the Phase-0 register/attack-path documents that ARE public contain fingerprint-notation only (verified: 0 full literals at HEAD docs). Residual unverifiable channels (register's five-channel record): historical push-then-delete (unverifiable), historical clones/forks/CI caches made while any key-bearing ref was pushed, local backup dissemination. The disclosure-containment decision (management plan §8) gains a sharper input: the *public* branch exposure of the key itself may be nil today — the register's phrasing should be corrected by the reviewer to "recoverable from the repository's local git history via two local-only tags; not reachable from any currently-pushed remote ref; remote-history unverifiable".
4. **Transcript hygiene (new recommendation for the review package):** the `tool-results/` committed-transcript channel proves AI-tool output was once committed verbatim; any future tool-output ingestion must pass the secret gate (it now does — pre-commit fail-closed covers all staged files) and the independent reviewer should confirm no *other* transcript-shaped paths exist on the Sept lineage (scan says: only these three carry key material).

## 7. Reproduction commands (read-only, redacted-safe)

```
git rev-list --all --objects | wc -l                        # object census
git ls-remote origin                                        # public-remote refs (no Sept tags)
git show 2e684d9d8:worklog.md | grep -cE '0xdbe1[0-9a-fA-F]{56}62d6'      # 1
git show 2da73fd65:scripts/verify-key-and-audit-roles.ts | grep -cE '…'   # 1 (regex per public fingerprint)
git log --all --oneline -- '.env'                          # empty
# full scan: run the harness (kept in the private evidence package) or re-implement per §1 taxonomy
git rev-list origin/main --objects | rg '<blob-sha>'        # 0 hits for each of the 23 key-material blobs
git rev-list backup-2026-09-22 --objects | rg '<blob-sha>'  # 23 hits
```

## 8. Limitations (honest)

- Classification of hex strings uses **line-context heuristics** mirrored from the repo scanner; a determined adversarial encoding (split literals, encoded material) is not covered — the reviewer should spot-check samples and may extend the harness.
- Commit attribution uses path-history simplification; 2 of 12 worklog versions could not be mapped to a specific commit (tree-reachable — enumerate via `git log --all --full-history -- worklog.md`).
- 3,298 binary-extension blobs (images/media) skipped — secret *steganography* class out of scope.
- Remote-history claims (never pushed / pushed-then-deleted) are **unverifiable from inside the sandbox** — only the current ls-remote state is evidenced.
- Scan authored by the same agent lineage as the environment (self-assessment limitation): the independent reviewer must re-run the reproduction commands before relying on these counts.

**No history was rewritten, no evidence deleted, no tags modified — read-only discipline held throughout.**
