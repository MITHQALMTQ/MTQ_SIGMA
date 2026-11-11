# MTQΣ Phase-0 — Independent Security Reviewer Handoff Package

**Document ID:** SEC-P0-HANDOFF-001 · **Version:** 1.0 · **Prepared:** 2026-11-11T13:32Z (UTC) · **Workstream:** H
**Branch:** security/phase-0-review-prep @ fc9ad97 (docs-only; ancestry unchanged) · **Author role:** implementer AI-agent lineage (evidence preparer — NOT an independent auditor)
**Release classification:** TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED

> **Standing independence limitation:** prepared inside the assessed environment by the implementer's own agent lineage; all network/chain results herein are implementer-side and require independent reproduction per the reviewer handoff package (SEC-P0-HANDOFF-001). No secret value is reproduced anywhere — fingerprints, status codes, counts, and object identifiers only.

---

## 0. Purpose and how to use this package

This is the **operational package the external independent security reviewer executes from** (COO master directive §9, Workstream H / Deliverable H). Every command in §4 is **self-contained, anonymous where applicable, and read-only**: a reviewer on a fresh machine needs only (a) the public repository `github.com/MITHQALMTQ/MTQ_SIGMA`, (b) the three public testnet RPC endpoints (§6.3), and (c) the owner-transferred evidence archive (§6.1). No other MTQΣ document is needed to *run* the commands; they are cited as supporting evidence only, and the reviewer is expected to verify rather than trust them. Prior evidence documents referenced by ID: SEC-P0-MGMT-001 (management plan), SEC-P0-SECHIST-001, SEC-P0-DELTA-001, SEC-P0-ADDENDUM-001, SEC-P0-IRP-001, plus the Workstream A–J companions (§9).

**Evidence classes used throughout (R4 discipline):** `[VERIFIED-FACT]` (verified now, command cited), `[HISTORICAL]` (prior recorded implementer-side evidence, doc + section cited), `[UNVERIFIED — EXTERNAL EVIDENCE REQUIRED]` (a failed or absent query is UNVERIFIED, never a negative result).

---

## 1. Reviewer qualifications and independence requirements (directive §9.1)

The independent reviewer **must** satisfy all of the following before executing §4:

1. **Independent machine.** A fresh host the MTQΣ project has never touched: no prior clone, no stored git credential, no sandbox-derived tool state. Nothing executed on the implementer's substrate (assumed-compromised) may be reused as review evidence.
2. **Independent credentials.** Reviewer-owned accounts/tokens only. No credential that ever transited the implementer sandbox (including the repo's embedded push credential, F-0-P0-03) may be used for any step. GitHub reproduction is designed to run **fully anonymous**; if the API tier requires a token to escape the 60/hr anonymous bucket, it must be the reviewer's own, and the tier must be recorded.
3. **Independent GitHub access.** Ability to exercise all five anonymous retrieval channels (web `github.com`, `api.github.com`, `raw.githubusercontent.com`, commit `.diff`/`.patch`, git smart-protocol) from a clean client: no `Authorization` header, no cookies, no `.netrc`, no stored credentials.
4. **Independent RPC paths.** On-chain reproduction over public endpoints (§6.3) and/or a reviewer-arranged RPC/explorer path that does not share egress with the implementer sandbox. Record endpoint identity, chainId, and a fresh block/slot anchor before/after each probe set.
5. **EVM and Solana capability.** Able to issue and decode read-only `eth_call` (`hasRole`, `getOwners`, `getThreshold`, `nonce`, `paused`) on Monad testnet 10143 and Arc testnet 5042002, and read-only Solana JSON-RPC `getAccountInfo` (jsonParsed) / `getBalance` / `getSlot` on devnet — without signing anything.
6. **Smart-contract security experience.** Sufficient OpenZeppelin AccessControl / Ownable / Safe (Gnosis) background to judge the role-inventory, threshold, and migration-risk determinations in the Option A/B packages (SEC-P0-EVMCR-001; SEC-P0-ADDENDUM-001 §7).
7. **Git object and software-supply-chain forensic capability.** Able to reason about ref reachability vs direct object addressability (dangling blobs/commits/tag objects), CDN edge caching, CI/Action identities, branch protection, CODEOWNERS, and credential scope.
8. **Next.js API authorization and infrastructure boot-chain review capability.** Able to audit route handlers and their import closures for authn/authz, and to trace a shell boot chain (`dev-watchdog.sh` → guard → heal → preflight → selfheal → `next dev`) including exit-code semantics.
9. **No dependence on the implementation agent's conclusions.** Every implementer-side "actual result" in §4 is an input to *check*, never a premise. The reviewer's finding stands on the reviewer's own reproduction.

**Standing expectation — disagreement is legitimate.** The reviewer is **PERMITTED — and expected to be able — to DISAGREE with the AI developer's conclusions.** Disagreement with any implementer-side determination in this package or the Phase-0 evidence set is a **legitimate review outcome, not a failure** of the review. Where the reviewer's independent result contradicts the implementer's recorded result, the reviewer records it as a **disagreement record** (§5.3) and it escalates to the owner (§5.4). Nothing in the Phase-0 documentation may be treated as presumptively correct; the package exists precisely because the implementer lineage cannot certify itself (R5 standing limitation, header).

---

## 2. Standing read-only constraints for the reviewer (asked to uphold throughout)

1. **No signing, no transactions.** Read-only RPC methods only (`eth_call`, `eth_blockNumber`, `eth_chainId`, `eth_getBalance`, `eth_getCode`; Solana `getAccountInfo`, `getBalance`, `getSlot`, `getTokenLargestAccounts`, `getTokenSupply`, `getTokenAccountsByOwner`). NEVER sign, transfer, mint, burn, freeze, or approve anything.
2. **No live administrative or state-changing API calls.** Do not call the deployment URL (`mtq-sigma.vercel.app`) or any deployed route. Live route testing is permitted **only in an isolated environment and only after separate owner authorization** (RT-06).
3. **No use of exposed key material.** Never test a compromised credential by using it; never derive, import, or load C-045-a/C-045-b material in any environment; no key derivation inside any AI environment.
4. **Content discipline on key-bearing objects.** Record HTTP status codes and pattern **counts only**; never print, save, or display the content of the 23 key-material objects (use `grep -c` pipelines or `-o /dev/null`); never print any credential value anywhere.
5. **No mutations of the remote or history.** No pushes, tag/branch creation or deletion, force-anything, or repo-settings changes from reviewer tooling while executing this package.

---

## 3. Reproduction task index (directive §9.2 — the 12 tasks)

| # | Task ID | Subject | Finding IDs (register) |
|---|---|---|---|
| 1 | RT-01 | Historical secret-object addressability (23 blobs) | F-0-P0-01 · C-045-a/C-045-b · AF-01/AF-02 |
| 2 | RT-02 | Anonymous GitHub retrieval channels | F-0-P0-01 · AF-01/AF-02 |
| 3 | RT-03 | EVM role matrix (fresh block) | F-0-P0-01 · F-0-P1-03 |
| 4 | RT-04 | Safe owners and thresholds | OD-35 · F-0-P1-03 |
| 5 | RT-05 | Solana mint/freeze authorities + 4.98 SOL re-verification | C-045-b (P0-01 Solana) · D-5 |
| 6 | RT-06 | API authorization (ai/consensus, ai/catalog-sync) | AF-03 · AF-04 · F-0-P1-01 class |
| 7 | RT-07 | External ingress restrictions (deployment evidence) | AF-03/AF-04 deployment dimension |
| 8 | RT-08 | Watchdog failure handling (`|| true`, partial restore) | AF-05 · F-0-P1-02 |
| 9 | RT-09 | GitHub credential authority + disclosure-event inventory | F-0-P0-03 · D-4 |
| 10 | RT-10 | Re-image and scheduler failure evidence | F-0-P0-02 · F-0-P1-05 |
| 11 | RT-11 | Evidence integrity (SHA-256 manifest verification) | cross-cutting (evidence set) |
| 12 | RT-12 | Monetary-constitution protection in containment paths | C-041 · ECON · F-0-P0-01 |

---

## 4. The 12 reproduction tasks (directive §9.2)

Common block/slot discipline for RT-03/RT-04/RT-05: record `eth_blockNumber` / `getSlot` before and after each probe set and anchor every verdict to the observed height; a failed query is recorded as UNVERIFIED, never as a negative result.

### RT-01 — Historical secret-object addressability

- **Finding IDs:** F-0-P0-01 (C-045-a / C-045-b); AF-01/AF-02.
- **Reproduction procedure (anonymous, read-only, self-contained).** Key-bearing commits: `2e684d9d8` (worklog.md) and `2da73fd65` (verify-key-and-audit-roles.ts + 6 Solana scripts + 1 base58 script + 3 tool transcripts), plus further September-lineage worklog commits `802b4726e`, `66dbeafc6`, `5d4f8e7bc`, `7479a8e02`.

```bash
# TIER A — raw channel (status + count only; never print content)
curl -s -o /dev/null -w "%{http_code}\n" https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2e684d9d8/worklog.md          # expect 200
curl -s https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2e684d9d8/worklog.md | grep -cE '0xdbe1[0-9a-fA-F]{56}62d6'   # expect 1 (C-045-a count only)
for P in scripts/verify-key-and-audit-roles.ts scripts/verify-hex-key.ts scripts/solana-create-fresh.ts scripts/solana-create-umi.ts scripts/solana-create-with-metadata.ts scripts/solana-set-metadata.ts scripts/solana-set-metadata-v2.ts scripts/verify-sol-key2.ts tool-results/read_1788722996398_c6cdcc96c3d5.txt tool-results/read_1788725306776_203e06965f23.txt tool-results/read_1788731310038_0a4e4799d310.txt; do
  printf '%s ' "$P"; curl -s -o /dev/null -w "%{http_code}\n" "https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2da73fd65/$P"   # expect 200 x11
done
# count-only classifiers for the C-045-b forms (exact forms per docs/security/CRITICAL-PRIVATE-KEY-ROTATION.md in the repo):
curl -s https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2da73fd65/scripts/verify-hex-key.ts    | grep -cE '[0-9a-fA-F]{128}'   # expect >=1
curl -s https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2da73fd65/scripts/verify-sol-key2.ts   | grep -cE '[1-9A-HJ-NP-Za-km-z]{88}'   # expect >=1
for C in 802b4726e 66dbeafc6 5d4f8e7bc 7479a8e02; do
  printf '%s ' "$C"; curl -s -o /dev/null -w "%{http_code}\n" "https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/$C/worklog.md"   # expect 200 x4
done
# TIER B — web pages and patch channels
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65           # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65.diff     # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65.patch     # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/MITHQALMTQ/MTQ_SIGMA/blob/2e684d9d8/worklog.md # expect 200
# TIER C — git protocol (fetch-by-SHA; fresh dir; no stored credentials)
git init t1 && cd t1 && git remote add origin https://github.com/MITHQALMTQ/MTQ_SIGMA.git
GIT_TERMINAL_PROMPT=0 GIT_ASKPASS=/bin/true git -c credential.helper= fetch --depth=1 origin 2da73fd6542ff22962ba27d62f1593fdad1834fa   # expect success, 12 objects of interest
for P in worklog.md scripts/verify-key-and-audit-roles.ts scripts/verify-hex-key.ts scripts/solana-create-fresh.ts scripts/solana-create-umi.ts scripts/solana-create-with-metadata.ts scripts/solana-set-metadata.ts scripts/solana-set-metadata-v2.ts scripts/verify-sol-key2.ts tool-results/read_1788722996398_c6cdcc96c3d5.txt tool-results/read_1788725306776_203e06965f23.txt tool-results/read_1788731310038_0a4e4799d310.txt; do
  git rev-parse "FETCH_HEAD:$P"    # 12 blob object IDs (do not print their content)
done
# TIER D — API object tier (status only; anonymous 60/hr bucket — watch x-ratelimit-limit: 60)
for B in $(git rev-parse FETCH_HEAD:worklog.md FETCH_HEAD:scripts/verify-key-and-audit-roles.ts FETCH_HEAD:scripts/verify-hex-key.ts FETCH_HEAD:scripts/solana-create-fresh.ts FETCH_HEAD:scripts/solana-create-umi.ts FETCH_HEAD:scripts/solana-create-with-metadata.ts FETCH_HEAD:scripts/solana-set-metadata.ts FETCH_HEAD:scripts/solana-set-metadata-v2.ts FETCH_HEAD:scripts/verify-sol-key2.ts FETCH_HEAD:tool-results/read_1788722996398_c6cdcc96c3d5.txt FETCH_HEAD:tool-results/read_1788725306776_203e06965f23.txt FETCH_HEAD:tool-results/read_1788731310038_0a4e4799d310.txt); do
  curl -s -o /dev/null -w "%{http_code}\n" "https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/git/blobs/$B"   # expect 200 x12
done
# remaining 11 worklog blob IDs: resolve each further Sept commit (API resolves short SHAs), git-fetch it, rev-parse worklog.md, then re-run the blob URL per ID — 23/23 expected overall
# CONTROLS
curl -s -o /dev/null -w "%{http_code}\n" https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/main/worklog.md   # expect 200
curl -s https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/main/worklog.md | grep -cE '0xdbe1[0-9a-fA-F]{56}62d6'   # expect 0
curl -s -o /dev/null -w "%{http_code}\n" https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/0000000000000000000000000000000000000000/worklog.md   # expect 404
```

- **Required environment:** fresh machine; clean curl/git with no GitHub credentials; any public network path (must differ from the implementer sandbox egress for the API tier).
- **Expected result:** all four tiers serve the September-lineage objects anonymously; pattern counts ≥1 per key-bearing file; 23/23 blob IDs addressable over the API; controls behave (main→200/count 0; nonexistent→404). Any 404 where the implementer recorded 200 is a material disagreement (record per §5.3).
- **Actual result (implementer side) `[HISTORICAL]`:** SEC-P0-ADDENDUM-001 §2.2 (12/12 key-bearing files → HTTP 200, pattern count 1 each), §2.3 (4 further commits → 200/count 1), §2.5 (commit/blob HTML pages and `.diff`/`.patch` → 200), §2.6 (protocol fetch-by-SHA succeeded, delivering 12/23 in one request), §2.7 (API: commits 4/4, blobs **23/23**, trees 2/2, both September tag objects 2/2 → 200), §2.8 (negative controls), §2.9 (Fastly/varnish edge caching on object URLs). Test window 2026-11-11T11:38:30Z–12:41:24Z.
- **Evidence identifier:** private evidence package items `object-exposure-tests.log` and the blob-ID list (SEC-P0-ADDENDUM-001 §10.2 item 3, digests recorded); supporting: SEC-P0-SECHIST-001 §2–§3.
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** historical dissemination (clones, forks, CI caches, archives, CDN retention) is UNRESOLVED and not enumerable from any substrate; GitHub's future retention of unreachable objects is not guaranteed — re-test at review time; short SHAs that unlock retrieval are printed in the already-pushed evidence docs (AF-02).

### RT-02 — Anonymous GitHub retrieval (web, API, raw, diff/patch, git protocol)

- **Finding IDs:** F-0-P0-01 exposure channels; AF-01/AF-02.
- **Reproduction procedure (anonymous, read-only, self-contained):**

```bash
# channel census + anonymity proof + repo posture (status/headers only)
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/MITHQALMTQ/MTQ_SIGMA                                    # expect 200 (public viewability)
curl -s -D - -o /dev/null https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA | tr -d '\r' | grep -i '^x-ratelimit-limit:'   # expect 60 = anonymous tier
curl -s -o /dev/null -w "%{http_code}\n" https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA                            # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/commits/2e684d9d8           # expect 200 (short-SHA resolution)
curl -s -o /dev/null -w "%{http_code}\n" https://api.github.com/repos/MITHQALMTQ/MTQ_SIGMA/commits/2da73fd6542ff22962ba27d62f1593fdad1834fa   # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://raw.githubusercontent.com/MITHQALMTQ/MTQ_SIGMA/2e684d9d8/worklog.md    # expect 200
curl -s -o /dev/null -w "%{http_code}\n" https://github.com/MITHQALMTQ/MTQ_SIGMA/commit/2da73fd65.patch                # expect 200
GIT_TERMINAL_PROMPT=0 git -c credential.helper= ls-remote https://github.com/MITHQALMTQ/MTQ_SIGMA.git | wc -l          # expect 29 refs (incl. 3 refs/pull/*)
GIT_TERMINAL_PROMPT=0 git -c credential.helper= ls-remote https://github.com/MITHQALMTQ/MTQ_SIGMA.git | grep -c 'refs/tags/backup-2026-09'   # expect 0 (Sept tags absent)
```

- **Required environment:** as RT-01.
- **Expected result:** every channel answers anonymously; anonymous API tier evidenced by `x-ratelimit-limit: 60`; no September tags in ls-remote; 3 pull refs present.
- **Actual result (implementer side) `[HISTORICAL]`:** SEC-P0-ADDENDUM-001 §2.1 (client construction: no auth header, no `.netrc`, no proxy vars, no cookies; anonymous tier headers), §2.4 (short SHAs resolve on all anonymous interfaces — the self-documenting exposure chain, AF-02), §2.10 (29 refs; PR 1 vercel[bot] 2026-09-07 closed, PRs 2–3 by `fortleem` 2026-10-24 closed; new tag `backup-2026-11-11` → `926ee00` pushed autonomously during the session; `visibility: public`, `forks_count: 0`, `pushed_at: 2026-11-11T10:31:57Z`), §13 (command set).
- **Evidence identifier:** `object-exposure-tests.log` (private evidence package); supporting: SEC-P0-ADDENDUM-001 §2.
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** API-tier results can be masked by anonymous-bucket contention (shared egress pools) — 403 under contention is a rate artifact, not object absence; validate with the 404 control and spaced retries (SEC-P0-ADDENDUM-001 §14.2).

### RT-03 — EVM role matrix at a fresh block (hasRole for EOA / Safe / Governance / modules)

- **Finding IDs:** F-0-P0-01 (live authority of the exposed material); F-0-P1-03.
- **Reproduction procedure (read-only public RPC; self-contained).** Accounts: EOA `0x3C3932F865892EFabE45892f453f81B64f6c8d8c` (C-045-a identity), Safe `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0`, Governance `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66`. Role constants (32-byte values, no `0x` prefix): DEFAULT_ADMIN_ROLE `0000000000000000000000000000000000000000000000000000000000000000`; MINTER_ROLE `9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6`; PAUSER_ROLE `65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a`. Calldata = selector `0x91d14854` + role value + account padded to 32 bytes. `hasRole` TRUE = result word ends `…01`; FALSE = `…00`.

```bash
RPC_M=https://testnet-rpc.monad.xyz; RPC_A=https://rpc.testnet.arc.io
for R in $RPC_M $RPC_A; do curl -s -m 12 -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' $R; echo; done   # anchor BEFORE
# Monad MTQ token — the three role checks for the EOA (fully assembled):
curl -s -m 12 -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD","data":"0x91d1485400000000000000000000000000000000000000000000000000000000000000000000000000000000000000003c3932f865892efabe45892f453f81b64f6c8d8c"},"latest"]}' $RPC_M   # DEFAULT_ADMIN on the EOA — expect ...01
curl -s -m 12 -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD","data":"0x91d148549f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a60000000000000000000000003c3932f865892efabe45892f453f81b64f6c8d8c"},"latest"]}' $RPC_M   # MINTER on the EOA — expect ...01
curl -s -m 12 -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD","data":"0x91d1485465d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a0000000000000000000000003c3932f865892efabe45892f453f81b64f6c8d8c"},"latest"]}' $RPC_M   # PAUSER on the EOA — expect ...01
# Arc MTQ token — same three (only "to" and RPC change):
curl -s -m 12 -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x237c3Aa2B79248f86f6523D3890095BCd1996601","data":"0x91d1485400000000000000000000000000000000000000000000000000000000000000000000000000000000000000003c3932f865892efabe45892f453f81b64f6c8d8c"},"latest"]}' $RPC_A   # DEFAULT_ADMIN on the EOA — expect ...01
curl -s -m 12 -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x237c3Aa2B79248f86f6523D3890095BCd1996601","data":"0x91d148549f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a60000000000000000000000003c3932f865892efabe45892f453f81b64f6c8d8c"},"latest"]}' $RPC_A   # MINTER on the EOA — expect ...01
curl -s -m 12 -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_call","params":[{"to":"0x237c3Aa2B79248f86f6523D3890095BCd1996601","data":"0x91d1485465d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a0000000000000000000000003c3932f865892efabe45892f453f81b64f6c8d8c"},"latest"]}' $RPC_A   # PAUSER on the EOA — expect ...01
# Full matrix — loop the same shape over every target x role x account; padded accounts:
#   EOA  ...0000000000000000000000003c3932f865892efabe45892f453f81b64f6c8d8c
#   SAFE ...000000000000000000000000e71869c662733642bfbb262b8c6bad8b0fbfa7d0
#   GOV  ...000000000000000000000000e35a91801bc541fb743bb9ead26c1fbd81eabd66
for A in 0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD 0x197e9CB28216dfe18a199b4c2930F74C2F460809 0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4; do
  for R in 0000000000000000000000000000000000000000000000000000000000000000 9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6 65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a; do
    for W in 0000000000000000000000003c3932f865892efabe45892f453f81b64f6c8d8c 000000000000000000000000e71869c662733642bfbb262b8c6bad8b0fbfa7d0 000000000000000000000000e35a91801bc541fb743bb9ead26c1fbd81eabd66; do
      curl -s -m 12 -X POST -H 'content-type: application/json' --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_call\",\"params\":[{\"to\":\"$A\",\"data\":\"0x91d14854$R$W\"},\"latest\"]}" $RPC_M
    done
  done
done   # repeat the block with $RPC_A and the Arc addresses: MTQ 0x237c3Aa2B79248f86f6523D3890095BCd1996601, Mint 0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa, Redeem 0xcAde4594177829597882555Ff57d0e34092daF8e
# remaining module addresses (Algorithm/Reserve/Oracle/Takaful per chain) are enumerated in audit-work/v9-roles/role-matrix-authoritative.json in the public repo
for R in $RPC_M $RPC_A; do curl -s -m 12 -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' $R; echo; done   # anchor AFTER
```

- **Required environment:** fresh machine; public RPCs §6.3 (or reviewer-arranged independent path); no signing. Robinhood chain: registry rows were removed by owner decision 2026-10-24 and state is `[UNVERIFIED]` — run the same matrix on any Robinhood RPC the owner can supply (recorded cross-chain hex collisions: Robinhood Takaful `0x1bbC…6177`, Robinhood MockUSDC `0xFd2B…861e`, per `audit-work/v9-task9/TASK9-AUTHORIZATION-AUDIT.md`); with no endpoint, record UNVERIFIED.
- **Expected result:** either the 2026-10-21 matrix holds at the fresh block (EOA TRUE on the three roles on both MTQ tokens; Safe TRUE×3 on Monad MTQ / PAUSER-only on Arc MTQ; Governance FALSE on both; EOA DEFAULT_ADMIN TRUE on all seven AccessControl contracts per chain; MINTER additionally on MTQ + Mint both chains + Reserve on Monad), or any drift is documented — per SEC-P0-MGMT-001 §5.3, **any unexpected movement of the exposed identity is an active incident**.
- **Actual result (implementer side) `[HISTORICAL]`:** probe 2026-10-21T19:11:28Z, Monad block 73037271 / Arc block 68397451 — matrix exactly as the expected line above, incl. the two-entry correction of transient RPC errors (Oracle Monad DEFAULT_ADMIN TRUE; Redeem Monad PAUSER false). Recorded in `audit-work/v9-roles/role-matrix-authoritative.json` and `audit-work/v9-roles/ROLE-VERIFICATION.md` (both tracked in the public repo at origin/main; JSON content digest verified this session: `362a767c418a64ea83b3878f48f05092a390907344f36591c53977dc1484e5f3`). **No implementer-side fresh read exists for 2026-11-11 — PENDING REVIEWER.**
- **Evidence identifier:** `audit-work/v9-roles/role-matrix-authoritative.json` + `ROLE-VERIFICATION.md` (public repo); supporting: SEC-P0-ADDENDUM-001 §6 (S-checklist framing), SEC-P0-IRP-001 §2 D-1.
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** role state may have drifted since 2026-10-21 (front-running/re-grant vectors documented in SEC-P0-ADDENDUM-001 §7.1); public RPC intermittent errors can masquerade as reverts — classify JSON-RPC errors as UNREACHABLE, not FALSE (ROLE-VERIFICATION correction); Robinhood state remains unverifiable absent an endpoint.

### RT-04 — Safe owners and thresholds (Genesis Safe)

- **Finding IDs:** OD-35 · F-0-P1-03.
- **Reproduction procedure (read-only public RPC; self-contained):**

```bash
RPC_M=https://testnet-rpc.monad.xyz; RPC_A=https://rpc.testnet.arc.io; SAFE=0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0
for R in $RPC_M $RPC_A; do
  curl -s -m 12 -X POST -H 'content-type: application/json' --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_call\",\"params\":[{\"to\":\"$SAFE\",\"data\":\"0xa0e67e2b\"},\"latest\"]}" $R   # getOwners()
  curl -s -m 12 -X POST -H 'content-type: application/json' --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_call\",\"params\":[{\"to\":\"$SAFE\",\"data\":\"0xe75235b8\"},\"latest\"]}" $R   # getThreshold()
  curl -s -m 12 -X POST -H 'content-type: application/json' --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"eth_call\",\"params\":[{\"to\":\"$SAFE\",\"data\":\"0xaffed0e0\"},\"latest\"]}" $R   # nonce()
done
# decode: dynamic-array address words; verify the owner set == the expected sole EOA and threshold word == 1
```

- **Required environment:** as RT-03 (both chains — the same Safe address is live on Monad and Arc).
- **Expected result:** one owner — the EOA `0x3C39…c8d8c`; threshold 1 (1/1); nonce 0; no modules; no guard; OR documented drift (drift = active incident per SEC-P0-MGMT-001 §5.3).
- **Actual result (implementer side) `[HISTORICAL]`:** 1/1 sole-owner Safe, nonce 0, no modules, no guard — verified 2026-10-19, recorded in `security/assessments/phase-0/critical-asset-inventory.md` (row: "sole owner of 1/1 Genesis Safe 0xE718…A7D0 (nonce 0, no modules, no guard — verified 2026-10-19)", baseline branch `ff595158`); cross-confirmed by ROLE-VERIFICATION (Safe holds roles on MTQ tokens but reverts on hasRole — proxy semantics). **No implementer-side fresh read for 2026-11-11 — PENDING REVIEWER.**
- **Evidence identifier:** critical-asset-inventory.md (baseline evidence branch) + `audit-work/v9-roles/ROLE-VERIFICATION.md`; supporting: SEC-P0-IRP-001 §2 D-2, SEC-P0-EVMCR-001.
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** 1-of-1 threshold means a single exposed signature exercises every Safe power until migration (OD-35); owner-set/threshold changes since 2026-10-19 are undetectable without this fresh read.

### RT-05 — Solana mint/freeze authorities and the historical 4.98 SOL

- **Finding IDs:** C-045-b (P0-01 Solana — tracked as a separate key-compromise incident) · D-5 prerequisites.
- **Reproduction procedure (read-only devnet JSON-RPC; self-contained).** Mint addresses (public on-chain identifiers, recorded in `audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md` §1.1–§1.2 in the public repo): current mint `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4`; superseded mint `2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY`. The superseded mint's recorded authority address (the on-chain public identifier of the C-045-b material) is returned by the first read below — never print or derive any private form.

```bash
RPC_S=https://api.devnet.solana.com
curl -s -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4",{"encoding":"jsonParsed"}]}' $RPC_S   # current mint: mintAuthorityOption + mintAuthority, freezeAuthorityOption + freezeAuthority, supply, decimals
curl -s -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"getAccountInfo","params":["2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY",{"encoding":"jsonParsed"}]}' $RPC_S   # superseded mint: same fields
curl -s -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d"]}' $RPC_S   # re-verify the historical 4.98 SOL figure on the superseded-mint authority address (lamports -> SOL / 1e9)
curl -s -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"getSlot","params":[]}' $RPC_S   # slot anchor before/after the probe set
curl -s -X POST -H 'content-type: application/json' --data '{"jsonrpc":"2.0","id":1,"method":"getTokenLargestAccounts","params":["2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY"]}' $RPC_S   # holdings concentration on the superseded mint
```

- **Required environment:** fresh machine; devnet RPC §6.3 or reviewer-arranged independent endpoint; NO signing, NO transfer, NO key derivation.
- **Expected result (operative-status rule):** an authority is "retired" only where `mintAuthorityOption`/`freezeAuthorityOption` reads null or shows a transferred-away address; **any non-null old-authority read = operative.** Expected per the historical dossier: current mint authority = `DbFjz…` single address (custody UNVERIFIED, CKPT-2), supply at the u64 ceiling; superseded mint authority and freeze authority = the C-045-b public address (operative unless drifted); superseded-mint authority balance ≈ 4.98 SOL unless drained. Any change = document drift.
- **Actual result (implementer side) `[HISTORICAL]`:** D5 dossier fresh at slot 513,885,476 — current mint `GAGRdrY6…`: mintAuthority `DbFjz…` (single address, not in any repo census, custody UNVERIFIED CKPT-2), supply 18,446,744,073,709,551,615 raw (deliberate 2026-08-10 mint-to-ceiling), full supply in a single ATA of `DbFjz…`, wallet SOL 9.99500752; superseded mint `2EaK5cQ…`: mintAuthority = freezeAuthority = the exposed C-045-b public address, wallet SOL 4.98368596 ("drainable by any repo holder"). Recorded in `audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md` §1.1–§1.2; the eight-item read-only checklist S-1…S-8 in SEC-P0-ADDENDUM-001 §6.1 is **all [UNVERIFIED — pending fresh read] — PENDING REVIEWER.**
- **Evidence identifier:** D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md (public repo, origin/main); supporting: SEC-P0-ADDENDUM-001 §6, SEC-P0-SOLCR-001.
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** the exposed C-045-b material can mint unlimited superseded-generation tokens, freeze accounts, and drain the authority wallet while its authorities read non-null; current-mint control rests on the UNVERIFIED `DbFjz…` custody attestation (CKPT-2); the 4.98 SOL figure is a historical read — re-verification is the point of this task.

### RT-06 — API authorization review (source level)

- **Finding IDs:** AF-03 · AF-04 (F-0-P1-01 class).
- **Reproduction procedure (code-level, self-contained from the public repo):**

```bash
git clone https://github.com/MITHQALMTQ/MTQ_SIGMA.git mtq-review && cd mtq-review
git rev-parse origin/main          # expect 926ee001e70e404dd3ea870c37f4786524458517
sed -n '1,129p' src/app/api/ai/consensus/route.ts       # POST handler at :43
sed -n '1,46p'  src/app/api/ai/catalog-sync/route.ts    # POST handler at :18
rg -n 'Authorization|Bearer|x-api-key|API-Key|cookie|session|middleware' src/app/api/ai/ src/middleware.ts middleware.ts src/   # expect no auth gate anywhere
rg -n 'getClientIP|rateLimit' src/app/api/ai/consensus/route.ts src/app/api/ai/catalog-sync/route.ts                        # XFF-spoofable per-IP buckets only
sed -n '1,60p' src/lib/mtq/rate-limit.ts                                                        # fail-open Redis fallback
rg -n 'ensureConsensusTables|createMany|upsert|CREATE TABLE|generativelanguage.googleapis.com' src/lib/ai/consensus.ts src/lib/ai/catalog.ts   # DDL + writes + provider egress
ls tests/ 2>/dev/null | rg -i 'consensus|catalog' || echo "no automated tests for either route"
```

- **Required environment:** fresh machine; public clone; **isolated-environment route tests ONLY after separate owner authorization; NEVER live administrative or state-changing calls** (do not call the deployment URL; boot nothing on the implementer substrate).
- **Expected result (source-level auth expected ABSENT):** both routes are POST-only with **no** application-level authentication or authorization; no `middleware.ts` exists at repo root or under `src/`; per-IP rate limiting only (XFF-spoofable, Redis fail-open); DB writes including idempotent DDL; Gemini provider identifier passed as a URL query parameter; upstream-error body disclosure; zero automated tests — findings AF-03/AF-04.
- **Actual result (implementer side) `[HISTORICAL — code-level, verified at 926ee00]`:** SEC-P0-ADDENDUM-001 §8.1 (consensus: no authn/authz; keyed multi-provider invocation; `consensusRun`/`consensusVote` persistence with swallowed failures; key-in-URL egress class; 10 req/IP/min; zero tests) and §8.2 (catalog-sync: body ignored; unauthenticated administrative-shaped catalog refresh; outbound amplification 2 provider calls/hit; idempotent upserts), §8.3 (repo precedent: only constituency/upload, webhooks/tenderly, mbg/mint-request, inngest implement inbound auth; **no middleware exists**); route anchors re-verified this session at origin/main: consensus `route.ts` POST at line 43 (129 lines), catalog-sync POST at line 18 (46 lines).
- **Evidence identifier:** SEC-P0-ADDENDUM-001 §8 (AF-03/AF-04); companion: SEC-P0-APIREV-001.
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** runtime configuration (Upstash, feature flags, provider availability) is `[UNVERIFIED]` from code alone; live reachability and ingress classification are RT-07, deliberately separate; isolated route tests await separate owner authorization.

### RT-07 — External ingress restrictions (deployment/infrastructure evidence)

- **Finding IDs:** AF-03/AF-04 deployment dimension (external ingress vs source-level auth classified separately).
- **Reproduction procedure (repo side self-contained; deployment side owner-supplied):**

```bash
cd mtq-review
cat vercel.json                                   # framework/build/install/maxDuration only
git show origin/main:vercel.json | sha256sum      # implementer-recorded content digest: 1fe0518933d83ca9376ec599dd8588495983680c324b59dbe88535d31b442610
git ls-tree -r --name-only origin/main | rg -i 'middleware\.(ts|js)$' || echo "no middleware file anywhere in the tree"
```

  Owner-supplied infrastructure evidence to obtain and review (EXTERNAL EVIDENCE REQUIRED): Vercel project configuration (deployment protections, access policy/password, preview protections, domain/edge settings), any platform-level firewall/WAF or network restriction records, and Vercel request logs for the `api/ai/*` paths. Classify **(a) source-level auth** (RT-06 result), **(b) external ingress auth** (platform-level gate, from owner evidence), and **(c) live reachability** (deployment actually serving — from owner logs/status) as three separate determinations.
- **Required environment:** fresh machine for repo commands; owner cooperation for deployment evidence. **The reviewer is asked NOT to probe the deployment URL** (no live calls — §2.2); reachability is classified from owner-supplied evidence, and any authorized read-only probe must be a separately recorded owner authorization.
- **Expected result:** repo-side `vercel.json` carries no access-control, header, or ingress restriction configuration; no middleware exists; therefore external-ingress protection, if any, exists only at the platform layer and must be evidenced by the owner. If the owner supplies no ingress evidence, classify ingress and live reachability `[UNVERIFIED — EXTERNAL EVIDENCE REQUIRED]`.
- **Actual result (implementer side) `[VERIFIED-FACT]`:** `vercel.json` at origin/main contains only `framework`, `buildCommand`, `installCommand`, and a `functions` `maxDuration` block — no auth/ingress keys (verified 2026-11-11T13:29Z, `git show origin/main:vercel.json`, digest above, identical on the review-prep worktree); **no `middleware.ts` exists anywhere in the authoritative tree** (ls-tree empty; SEC-P0-ADDENDUM-001 §8.1/§8.3). A public deployment URL exists in owner communications (`mtq-sigma.vercel.app`); **live reachability UNVERIFIED by the implementer — no live calls were made or are permitted.** Owner-supplied ingress evidence: PENDING REVIEWER/OWNER.
- **Evidence identifier:** this document's verification commands + SEC-P0-ADDENDUM-001 §8.3; companion: SEC-P0-APIREV-001.
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** unauthenticated source-level routes may be reachable at the edge; XFF spoofing applies at any direct-ingress path; platform evidence gaps leave ingress classification UNVERIFIED, which itself blocks any Phase-1 authorization that depends on external ingress (SEC-P0-MGMT-001 §10).

### RT-08 — Watchdog failure handling (boot chain)

- **Finding IDs:** AF-05 · F-0-P1-02.
- **Reproduction procedure (code-level, self-contained from the public repo):**

```bash
cd mtq-review
grep -n '|| true' dev-watchdog.sh                  # 4 suppression sites: 135 (db-cloud-sync), 158/159 (pkill), 180 (heal)
sed -n '176,182p' dev-watchdog.sh                  # the heal invocation: bun run scripts/source-integrity-heal.ts >> "$LOG" 2>&1 || true
sed -n '44,57p' scripts/source-integrity-heal.ts   # exit semantics: exit 1 only on action=="error" OR (failed>0 AND restored==0); any restored>0 with failed>0 -> exit 0 (PARTIAL)
sed -n '169,215p' dev-watchdog.sh                  # chain order: git-drift guard -> heal -> runtime-preflight -> db-selfheal -> next dev
rg -n 'set -e' dev-watchdog.sh || echo "no set -e anywhere in the boot chain"
```

  The **10 mandatory boot questions** (canonical set in SEC-P0-BOOT-001; answer each from the code): (1) behavior when the heal script is MISSING at boot; (2) behavior on a non-zero heal exit (runtime/integrity failure); (3) behavior on PARTIAL restore (some files restored, some failed); (4) database state after a heal failure; (5) does boot continue; (6) does any automated monitoring consume the heal result; (7) can a partially recovered application be served with green monitoring; (8) are authorization failures within the heal suppressed too; (9) do the later gates (runtime-preflight, db-selfheal) catch a partially-restored source tree; (10) what exit code does a partial restore emit, and would even a captured rc detect it.
- **Required environment:** fresh machine; public clone; no application boot (do not execute `dev-watchdog.sh` or any repo application code).
- **Expected result:** line 180 `|| true` suppresses every non-zero heal outcome including missing-script; partial restore exits 0 so even a captured rc would miss it; the exit code is discarded (not captured into a variable); no `set -e`; boot proceeds unconditionally past the heal step; detection is human-only via `dev.log`; later gates verify runtime deps and DB, not source-tree completeness; suppression is failure-class-total (would equally mask future authorization semantics); the heal CLI has no authorization concept.
- **Actual result (implementer side) `[VERIFIED-FACT — code-level]`:** SEC-P0-ADDENDUM-001 §9 (all eight directive questions answered with code citations; finding AF-05 extends F-0-P1-02 to the authoritative lineage); anchors re-verified this session at origin/main: `dev-watchdog.sh:180` invocation with `|| true` (grep count 4 across the file: 135, 158, 159, 180), partial-restore exit-0 in `scripts/source-integrity-heal.ts` lines 46–57. F-0-P1-02's lineage-conditional form (heal absent at the substituted `d6fd5d6`, present at `926ee00`) per SEC-P0-DELTA-001 §5/§11.
- **Evidence identifier:** SEC-P0-ADDENDUM-001 §9; companion: SEC-P0-BOOT-001 (10-question set + drill procedures).
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** the authoritative lineage's heal layer presence does not close AF-05 (the suppression is unconditional on both lineages); a partially-recovered source tree with a passing DB gate still boots; no monitoring consumes the result until the Phase-5 fail-closed recommendation (unimplemented) lands.

### RT-09 — GitHub credential authority (owner-side evidence)

- **Finding IDs:** F-0-P0-03 · D-4 (SEC-P0-IRP-001 §2).
- **Reproduction procedure (owner-side; reviewer examines the owner's evidence — never the value):** obtain from the owner/GitHub admin, and review: which token the embedded push credential is (form: `x-access-token` embedded in the remote URL of the sandbox `.git/config` — **never display it**), its scopes, expiry, linked identity, admin capability (repo settings / secrets / Actions), and the GitHub audit-log trail of its use (incl. the 38 automation pushes to `origin/main`). Sandbox-side facts the reviewer can corroborate read-only from the evidence archive: single git persona authors everything (`Z User / z@container`); automation pushed a daily backup tag (`backup-2026-11-11` → `926ee00`) while the credential stands (SEC-P0-ADDENDUM-001 §2.10).
- **Required environment:** owner GitHub administrative access; reviewer independence from both the owner's and the sandbox's credentials is not compromised by reading owner-supplied exports.
- **Expected result:** token identity/scope/expiry/permissions recorded as review evidence, closing the `[UNVERIFIED]` item D-4/F-0-P0-03 §7.1; until recorded, the credential must be treated as indefinite repo-admin-class.
- **Actual result (implementer side) `[VERIFIED-FACT — substrate facts / UNVERIFIED — identity]`:** SEC-P0-MGMT-001 §7.1 — embedded `x-access-token` in `.git/config` (plaintext, value never reproduced); demonstrated scope: push to `origin/main` (38 UUID-cron automation commits + plane-5 telemetry pushes, no PR/review trace; no CODEOWNERS); expiry/linked identity/admin permissions UNVERIFIED from inside. **Disclosure-event inventory (types only):** the 2026-11-11 owner-message credential disclosure event (values redacted) — plaintext material of types GitHub PAT; Vercel token; Turso database URL + token; Neon Postgres URL + password; Inngest event key + signing key. Not used, not echoed, not stored by the implementer lineage; rotation urgently recommended; relationship to the repo's embedded push token UNKNOWN pending owner comparison. Owner-side evidence: **PENDING REVIEWER/OWNER.**
- **Evidence identifier:** SEC-P0-MGMT-001 §7.1–§7.2; SEC-P0-IRP-001 §2 (D-4, D-7); SEC-P0-ADDENDUM-001 §2.10 (active automation evidence).
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** until audited and rotated, a single credential domain spans all six trust boundaries (F-0-P0-03); the 2026-11-11 owner-message disclosure event multiplies exposure until every listed type is rotated owner-side; scope inflation or repo-admin capability would convert every automation path into an administrative path.

### RT-10 — Re-image and scheduler failure evidence

- **Finding IDs:** F-0-P0-02 · F-0-P1-05.
- **Reproduction procedure (archive review + public cross-check; self-contained given §6.1 archive):**

```bash
# public-remote cross-checks (anonymous):
git clone https://github.com/MITHQALMTQ/MTQ_SIGMA.git mtq-clone && cd mtq-clone
git rev-parse origin/main                                                 # 926ee001e70e404dd3ea870c37f4786524458517
git rev-parse origin/backup-incident10-amend                             # 9fe40589fdff70f7636dc6f13d4cb29364016afe
GIT_TERMINAL_PROMPT=0 git -c credential.helper= ls-remote origin | grep -c 'refs/heads/main\|backup-incident10-amend'   # both present
# evidence-archive review (owner-transferred, hash-verified per RT-11):
#   reflog capture: git -C <frozen-sandbox-copy> reflog --date=iso | head -25  — expect the 2026-11-11T00:54:11Z and 00:56:12Z forced-checkout entries
#   boot timeline: /tmp/boot-timeline.log capture — root-owned steps starting 2026-11-11T00:20:14Z
#   substituted-HEAD ledger: backups/plane5/execution-ledger.jsonl — 1 entry, 16:56:44Z BOOTSTRAP-FAILED
#   origin-side ledger: 59 entries through 2026-11-10T23:30:29Z; heartbeat chainTip h23846; 129,692 rows; deficit 0
```

- **Required environment:** fresh machine + anonymous clone + the owner-transferred evidence archive (the reflog, boot timeline, and substituted-tree objects live only on the implementer substrate and its forensic copies — the substituted lineage `d6fd5d6` is NOT retrievable from the public remote; any direct examination of a forensic copy is read-only).
- **Expected result:** the 2026-11-11T00:20Z `PLATFORM_REIMAGE_STATE_LOSS` event (`DATABASE_AND_SCHEDULER_REGISTRY`) is evidenced by: substituted local main `d6fd5d6` at 2 ahead / 168 behind origin/main with merge-base `ff67aa2`; the two forced-checkout reflog entries; the root-owned boot-timeline steps; the scheduler registry wipes (2× on 2026-10-10-class events; 15 rejected fires; registration ≠ execution) and the ledger divergence; actor attribution remains explicitly `[HYPOTHESIS]` (platform `.zscripts` normalization loop is the leading class) and may only be resolved from platform-side audit logs (owner + provider).
- **Actual result (implementer side) `[VERIFIED-FACT — captured events / HYPOTHESIS — actor]`:** SEC-P0-MGMT-001 §2.1–§2.2 and §6.1 (topology, reflog, boot timeline, interference events detected and contained within ~60 s, no Phase-0 content lost); SEC-P0-DELTA-001 §1 (lineage table; 725-file / +187,623/−14,231 total delta) and §6 (59-entry vs 1-entry ledger; heartbeat/monitor-state presence); `[HISTORICAL]` last healthy runtime 2026-11-10T23:31:59Z (chainTip h23846, 129,692 rows, deficit 0). Companion: SEC-P0-IDENT-001.
- **Evidence identifier:** SEC-P0-DELTA-001 §1/§5/§6; SEC-P0-MGMT-001 §2, §6, §13; archive items per SEC-P0-EVIDENCE-001 manifest.
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** actor attribution open (owner + platform provider audit logs — D-9); ≥10 re-image incidents since 2026-10-26 mean recurrence is expected until the isolated-environment precondition (SEC-P0-MGMT-001 §6.3 precondition 1) is satisfied; scheduler state loss recurs with each wipe (F-0-P1-05 open).

### RT-11 — Evidence integrity (SHA-256 manifest verification of the whole evidence set)

- **Finding IDs:** cross-cutting (evidence-set integrity).
- **Reproduction procedure (self-contained given the owner-transferred archive + public refs):**

```bash
# The canonical manifest of the whole evidence set lives in SEC-P0-EVIDENCE-001:
#   security/assessments/phase-0/p0-evidence-preservation-register.md (this branch) — verify EVERY listed digest.
# git-hosted artifacts, e.g. the 17 baseline docs:
git clone https://github.com/MITHQALMTQ/MTQ_SIGMA.git mtq-clone && cd mtq-clone
git fetch origin security/phase-0-baseline security/phase-0-management-plan
for f in architecture-inventory attack-path-analysis authority-graph authorization-flow-inventory contract-and-governance-assessment critical-asset-inventory critical-vulnerability-register developer-ai-and-cicd-assessment phase-0-evidence-index phase-0-executive-summary recovery-and-state-integrity-assessment security-dependency-register security-phase-plan threat-model trust-boundary-diagram validator-bridge-oracle-assessment wallet-and-signing-assessment; do
  git show FETCH_HEAD:security/assessments/phase-0/$f.md | sha256sum    # compare against SEC-P0-IRP-001 §4.1 rows 1-17 and the register manifest
done
# archive-carried artifacts (private evidence package tier): sha256sum each file; compare against the register manifest
# classify any artifact whose digest cannot be verified as UNVERIFIABLE/LOST in the reviewer report
```

- **Required environment:** fresh machine; owner-transferred archive; public repo.
- **Expected result:** every manifest digest matches; any artifact whose hash cannot be recomputed (destroyed in the 2026-11-11T00:20Z re-image) is classified as **lost/unrecordable** rather than silently omitted — notably the original one-off history-scan harness and its raw redacted output (the pre-re-image owner copy, if any, is the sole surviving source).
- **Actual result (implementer side) `[VERIFIED-FACT]`:** SEC-P0-IRP-001 §4.1 (17-document SHA-256 table pinned at `security/phase-0-baseline` @ `ff595158…`); SEC-P0-ADDENDUM-001 §10.1 (7-item evidence-package manifest with digests), §10.2 (6 new session artifacts with digests; original harness/output **UNRECORDABLE — destroyed by the re-image**), §10.3 (17-doc manifest unchanged), §10.4 (chain-of-custody NOT completed — no transfer has occurred; template blank; no custodian named). Canonical register: **SEC-P0-EVIDENCE-001 `p0-evidence-preservation-register.md`**.
- **Evidence identifier:** SEC-P0-EVIDENCE-001 (manifest of record); SEC-P0-IRP-001 §4.1; SEC-P0-ADDENDUM-001 §10.
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** until a genuine owner-side transfer completes the custody log, all evidence sits on the assumed-compromised substrate; the lost-harness gap means the full-history scan cannot be byte-verified against its original output (reviewer re-runs per SEC-P0-SECHIST-001 §1 taxonomy or the committed scanner `scripts/security/secret-scan.ts`).

### RT-12 — Monetary-constitution protection across containment paths

- **Finding IDs:** C-041 (canonical-token declaration) · F-0-P0-01 (rotation) · ECON decision gates.
- **Reproduction procedure (document/procedure review + the role inventories from RT-03/04/05):** verify that the MTQΣ monetary constitution — supply rules and the prohibition of any unauthorized second supply — is preserved in any proposed containment path:
  1. Take the reviewer's own fresh role inventories (RT-03 MTQ-token roles per chain and generation; RT-04 Safe control; RT-05 Solana authorities/supply) and enumerate **who can mint, on which generation, today**.
  2. Review the migration Option A / Option B packages (SEC-P0-EVMCR-001; SEC-P0-ADDENDUM-001 §7.2 table) against the constitution: Option A must end at full verified renounce with no dual-admin re-grant window left open; Option B must show the replacement estate minting **only** under the independently verified new authority, with the old estate's live authority formally inventoried, deprecated, or accepted-as-residual by recorded owner decision.
  3. Check the multi-generation hazard: the repo carries ≥3 live "MTQ token" generations per chain with cross-chain hex collisions (`audit-work/v9-task9/TASK9-AUTHORIZATION-AUDIT.md` duplicate-MTQ dossier) — any path that grants new authority before the owner's canonical declaration (C-041) risks legitimizing a second supply.
  4. Check the one-shot genesis surfaces (gen-A Ownable twins' 1,000,000 genesis one-shots) and the Solana superseded-mint unlimited-mint exposure (RT-05) — both are potential unauthorized-supply channels until neutralized or accepted.
  5. Confirm the three "safe"-label prerequisites in SEC-P0-ADDENDUM-001 §7.3 item 4 (fresh role matrix VERIFIED; old-estate power inventory zero or formally accepted; Solana checklist closed) — a "migrated" EVM estate with a live Solana superseded mint is **not** a contained rotation.
- **Required environment:** fresh machine; public repo (D4/D5 packages, TASK9 dossier, ROLE_ROTATION/CRITICAL-PRIVATE-KEY-ROTATION docs); reviewer's RT-03/04/05 results.
- **Expected result:** each containment path either demonstrably preserves the constitution (single authorized supply under the declared canonical estate; every other mint path neutralized or formally accepted) or is rejected/flagged with a specific constitutional violation. No path may be recorded as executed — this is procedural review only.
- **Actual result (implementer side) `[HISTORICAL — procedural review]`:** SEC-P0-ADDENDUM-001 §7.2/§7.3 (Option A/B dimension table; verdict: neither atomic; B-first sequencing recommended; compromised-signer window named; three prerequisites); TASK9 duplicate-MTQ dossier `[HISTORICAL]`; D5 §1.1 (current mint supply at u64 ceiling — a deliberate prior action, not an unauthorized second mint); genesis exposure per critical-asset-inventory (1,000,000 MTQ / 1,100,000 USDC genesis, RR 1.10); SEC-P0-IRP-001 §3.1 items 2–3 (canonical declaration and 7-signer ceremony prerequisites). Companion: SEC-P0-EVMCR-001.
- **Evidence identifier:** SEC-P0-EVMCR-001 + SEC-P0-ADDENDUM-001 §7 + `audit-work/v9-task9/TASK9-AUTHORIZATION-AUDIT.md` (public repo).
- **Reviewer's independent result:** ____________________________________________
- **Residual risk:** until the owner records the canonical declaration (C-041) and the fresh inventories, three live generations per chain plus the superseded Solana mint constitute standing unauthorized-supply channels; the migration window itself (old-key grants) can create transient dual-admin conditions in which an attacker re-grants mintage.

---

## 5. Independent sign-off requirements (directive §9.3)

### 5.1 Hard sign-off rules

1. **A signed written assessment is REQUIRED.** The reviewer issues a written report, signed by a named accountable human (name, role, date, scope), covering the twelve reproduction results and the sign-off determinations.
2. **No self-approval.** No sign-off, approval, or gate-closure may be issued by the implementer AI-agent lineage, by any persona or credential derived from the sandbox substrate, or by any document this lineage authored. The implementer's documents are inputs only (SEC-P0-MGMT-001 §9.3; SEC-P0-IRP-001 §4.5).
3. **No AI-generated claim of independent audit.** Nothing authored by the AI lineage — including every Phase-0 document — may be cited as, or transformed into, a claim of independent audit; an independent-audit claim exists only in the reviewer's own signed report.
4. **Phase-1 approval is NOT granted based on documentation completion alone.** Documentation completeness (including this handoff package) satisfies no Gate #1 criterion by itself. Gate #1 (SEC-P0-MGMT-001 §10, items 1–8) closes only on: reviewer reproduction of the §9.2 items (at minimum RT-01, RT-03, RT-04, RT-10-class, RT-08-class; RT-09 requires owner GitHub-side evidence), the reviewer's sign-off artifact, P0-01 Phase A verification (fresh role matrix + Safe state), the P0-03 credential audit (executed or formally scheduled with interim-compensation note), the disclosure-containment decision, and the owner's explicit authorization. All remain OPEN; **PHASE 1 IS NOT AUTHORIZED.**

### 5.2 Reviewer deliverables

| # | Deliverable | Content |
|---|---|---|
| 1 | Signed report | Written assessment with evidence classes ([VERIFIED-FACT]/[HISTORICAL]/[UNVERIFIED]) per finding; block/slot anchors; named reviewer |
| 2 | Filled actual-result columns | The reviewer's independent results for RT-01…RT-12 (the blank fields in §4) |
| 3 | Residual-risk register | Every residual risk the reviewer confirms, corrects, or adds, mapped to register finding IDs |
| 4 | Disagreement records | Every instance where the reviewer's result contradicts an implementer-side result, with both values recorded |

### 5.3 Disagreement handling

Each disagreement record states: the task ID, the implementer's recorded result (with document + section), the reviewer's independently reproduced result (with command + anchor), and the reviewer's determination of which is correct. Disagreements are **expected outcomes** (§1) and are never resolved by re-asserting the implementer's value; unresolved disagreements block the affected Gate #1 item.

### 5.4 Escalation path to the owner

1. Reviewer → **owner (COO)** directly, out-of-band, with the signed report — no sandbox intermediary at any point (the sandbox cannot transmit, filter, or "relay" review evidence).
2. The owner records adjudication of every disagreement and every residual risk in **SEC-P0-DECISIONS-001** (`owner-p0-decision-register.md`).
3. Safety-critical findings (active exposure of the C-045-a/C-045-b material, unexpected on-chain activity of the exposed identity, evidence-integrity failures) escalate immediately, ahead of the full report — per SEC-P0-MGMT-001 §5.3, any movement of the exposed identity is an active incident requiring immediate response.

---

## 6. Logistics

### 6.1 Obtaining the evidence archive

- Custody is **owner-controlled**: the archive (evidence set + private evidence package) is assembled and manifested per **SEC-P0-EVIDENCE-001 `p0-evidence-preservation-register.md`** (SHA-256 manifest of the whole evidence set — the manifest of record for RT-11). Transfer is out-of-band from owner to reviewer; the chain-of-custody template (SEC-P0-IRP-001 §4.4) is completed by the owner at transfer (currently blank — no transfer has occurred).
- **Trust rule:** nothing originating on the implementer substrate is trusted without digest verification against the SEC-P0-EVIDENCE-001 manifest (the substrate is assumed-compromised). Verify hashes before relying on any archive item (RT-11 procedure).
- Anonymous checks need no archive at all: RT-01/RT-02/RT-03/RT-04/RT-05/RT-06/RT-07(repo side)/RT-08 run from the public repo and public RPCs alone.

### 6.2 Environment preparation checklist

- [ ] Fresh machine never used for MTQΣ work: no preexisting clone, no stored GitHub credential, no sandbox-derived state.
- [ ] No shared credentials: nothing that ever transited the implementer environment (§1 items 1–2). GitHub access anonymous by default; any token used is reviewer-owned and its tier is recorded.
- [ ] Separate network path: egress distinct from the implementer sandbox's shared IP pool (anonymous API-bucket contention evidence: SEC-P0-ADDENDUM-001 §14.2).
- [ ] Tools: `curl`, `git`, `sha256sum`, any ABI decoder (e.g. `python3`/`cast` optional) for RT-04 decoding.
- [ ] RPC endpoints configured and identity-verified (`eth_chainId` = 10143 / 5042002; Solana devnet) before probe sets; block/slot anchors recorded before/after.
- [ ] Evidence archive obtained from the owner and hash-verified (RT-11) before archive-dependent tasks (RT-10, RT-11, RT-09 owner-side).
- [ ] No signing tooling armed for any account; no exposed material present on the review machine.

### 6.3 Public RPC endpoints

- EVM Monad Testnet: `https://testnet-rpc.monad.xyz` (chainId 10143)
- EVM Arc Testnet: `https://rpc.testnet.arc.io` (chainId 5042002)
- Solana Devnet: `https://api.devnet.solana.com`
- Robinhood chain: no public endpoint known to the implementer (registry rows removed 2026-10-24); owner-supplied endpoint if any — otherwise record UNVERIFIED (RT-03).

### 6.4 Read-only constraints (restated binding)

No signing or transactions of any kind; no live administrative or state-changing API calls (isolated route tests only after separate owner authorization); no use of exposed key material (never test a compromised credential by using it; no derivation/import in any AI environment); GitHub reproduction anonymous; content discipline on the 23 key-bearing objects (status codes + pattern counts only).

---

## 7. Evidence-label discipline for the reviewer's report

Every claim in the reviewer's deliverables carries one of: **[VERIFIED-FACT]** (reviewer verified it — command, timestamp, block/slot anchor cited), **[HISTORICAL]** (prior recorded evidence — doc + section cited), **[UNVERIFIED]** / EXTERNAL EVIDENCE REQUIRED (a failed or absent query is UNVERIFIED, never a negative result). The four-way wording discipline for the object exposure (SEC-P0-ADDENDUM-001 §5) applies to RT-01: current-refs clean / retrievability-by-SHA / anonymous access (from the reviewer's own vantage) / historical dissemination UNRESOLVED.

## 8. Limitations (honest)

1. This package was prepared by the implementer's own agent lineage inside the assessed environment (header limitation): it is an operational handoff, not a review; every implementer-side result cited in §4 awaits the reviewer's independent reproduction.
2. All implementer-side network/chain results are from the sandbox vantage (shared egress; 2026-10-21/2026-11-11 anchors); none is claimed independently verified.
3. Nothing herein asserts that any credential was rotated/revoked, any key contained, any exposure remediated, or any audit performed — all owner actions remain OPEN; Phase 1 is NOT AUTHORIZED.
4. The reviewer's blank result fields are deliberate: only the independent reviewer completes them.
5. No secret value appears anywhere in this document: fingerprints, status codes, counts, object identifiers, public addresses, and role constants only.

## 9. Companion documents on this branch (reference by ID/filename)

| ID | File | Workstream | Role for the reviewer |
|---|---|---|---|
| SEC-P0-EVIDENCE-001 | `p0-evidence-preservation-register.md` | A | SHA-256 manifest of record (RT-11) |
| SEC-P0-EXPOSURE-001 | `public-object-exposure-review-package.md` | B | RT-01/RT-02 supporting |
| SEC-P0-EVMCR-001 | `evm-key-compromise-containment-readiness.md` | C | RT-03/RT-04/RT-12 supporting |
| SEC-P0-SOLCR-001 | `solana-key-compromise-containment-readiness.md` | D | RT-05 supporting |
| SEC-P0-APIREV-001 | `api-authorization-independent-review-package.md` | E | RT-06/RT-07 supporting |
| SEC-P0-BOOT-001 | `boot-chain-source-integrity-review.md` | F | RT-08 canonical 10-question set |
| SEC-P0-IDENT-001 | `platform-identity-and-recovery-separation.md` | G | RT-10 supporting |
| SEC-P0-HANDOFF-001 | `independent-security-reviewer-handoff.md` | H | this document (operational package) |
| SEC-P0-DECISIONS-001 | `owner-p0-decision-register.md` | I | escalation/adjudication record (§5.4) |
| SEC-P0-EXEC-001 | `p0-containment-readiness-executive-report.md` | J | owner-facing summary |
| Prior | SEC-P0-ADDENDUM-001 / SECHIST-001 / DELTA-001 / IRP-001 / MGMT-001 | — | cited throughout §4 |

---

**Status block:**

```
PHASE 0 — INDEPENDENT REVIEW PREPARATION WITH CORRECTIVE FINDINGS
P0 KEY COMPROMISE — OWNER CONTAINMENT REQUIRED
PHASE 1 — NOT AUTHORIZED
TESTNET ONLY — SHADOW MODE — NOT PRODUCTION-AUTHORIZED
```

No compromised material is claimed rotated, revoked, contained, or audited by this document; every such determination awaits the independent reviewer's signed assessment and the owner's recorded decisions. Disagreement with the implementer's conclusions remains a legitimate and expected review outcome.
