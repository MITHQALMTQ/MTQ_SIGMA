# MTQΣ — TASK 12 · D2: SECRET-CONTAINMENT STATUS

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Per-key, per-channel containment record after the Task 12 K-1 purge and the
control build-out. Fingerprint-only references (never literals). Evidence:
`evidence/redaction-report-task12.json` (sha256 chain), scanner logs in this
session's records, `evidence/fresh-anchors-task12.json` (fresh on-chain state).

---

## 1. C-045-a — EVM deployer key (`0xdbe1…62d6`, derives to `0x3C39…d8c`)

| Channel | Before Task 12 | After Task 12 | Status |
|---|---|---|---|
| Repository working tree | 2 files (`scripts/verify-key-and-audit-roles.ts:5` + `worklog.md` plaintext quote) | **0 occurrences** — both redacted with in-place notices (worklog redaction is append-only discipline: sentence preserved, marker replaces the literal) | **CONTAINED (worktree) — VERIFIED by re-sweep** |
| Git history | all commits since the 2026-10-19 baseline squash | **UNCHANGED — all commits still contain both literals** (intentional: history rewrite requires separate owner + security-lead approval; see D3) | **OPEN — plan ready, approval required** |
| `.env` / `.env.local` / db / dev.log | clean (Task 10/11 census) | clean (re-scanned byte-level this session) | VERIFIED |
| `upload/private_key.txt` | ABSENT on disk; never git-tracked | unchanged (absent) | UNVERIFIED deletion-time/copy status (carried) |
| AI-session transcript | PI-3: one argv-printed emission (Task 11) | **No new emission by Task 12 tooling** — all Task 12 tools are value-redacted by design; no key material was read, printed, logged, or re-derived this session | Disclosed incident, stands (retention/access owner-side) |
| Remotes / CI systems / artifacts / backups / external clones | UNVERIFIED (no local remote ≠ absence) | **STILL UNVERIFIED** — no remote is configured locally, which proves nothing about remote copies; workflows imply GitHub intent | **OPEN — OWNER-ATT-1 required (D8)** |
| **On-chain authority** | FULLY PRIVILEGED (roles ×15, both 1/1 Safes, ~100% supplies, natives) | **UNCHANGED — fully privileged** (fresh probe @ Monad 73,243,944 / Arc 68,520,264 confirms every role cell) | **OPEN — rotation = D4 package + owner approvals** |

## 2. C-045-b — Solana 4saT key (`58c19e…eb60` hex / `2mvV…j13V` base58)

| Channel | Before Task 12 | After Task 12 | Status |
|---|---|---|---|
| Repository working tree | 6 files (128-hex form) | **0 occurrences** (6 redacted; scripts replaced with read-only verifier or fail-closed stubs) | **CONTAINED (worktree) — VERIFIED by re-sweep** |
| **NEW: base58 form** | **MISSED by the Task 10/11 census** ("base58 secrets: none") — `scripts/verify-sol-key2.ts` embedded the same key as seed‖pubkey base58 (88 chars) | **FOUND by the Task 12 scanner; REDACTED; script replaced with a retired stub.** Identification used ONLY the embedded PUBLIC address (4saT…cA1d) — the secret value was never printed or re-derived | **CONTAINED — census CORRECTED (was a 7th worktree copy)** |
| Git history | all commits (hex form) | **UNCHANGED** (hex + base58 forms both present in history until the approved rewrite) | **OPEN — D3 plan covers all encodings** |
| `.env` / db / dev.log | clean | clean (re-scanned) | VERIFIED |
| AI-session transcript | handled per prior sessions (no known base58 emission) | No new emission — Task 12 identification was crypto-free (embedded-pubkey check) | n/a |
| Remotes / CI / backups / clones | UNVERIFIED | **STILL UNVERIFIED** (as C-045-a) | **OPEN — OWNER-ATT-1** |
| **On-chain authority** | mint+freeze authority of superseded mint `2EaK5c…`, full old supply in its ATA, 4.98 SOL drainable | **UNCHANGED** (fresh probe @ slot 513,885,476: both authorities = 4saT…, supply 4,477,988,020,393,345,024 raw, balance 4.98368596 SOL) | **OPEN — containment = D5 package (T-4.3/4.4/4.5) + owner approvals** |

## 3. Prevention controls now in force (tested)

| Control | Enforcement point | Proof |
|---|---|---|
| Worktree secret-scanning gate | `bun run security:scan` (exit 1 on finding) | Full-tree PASS; regression tests prove seeded SYNTHETIC secrets block the gate without printing values (12/12) |
| CI gate | `.github/workflows/ci.yml` job `secret-scan` — runs FIRST; every other job depends on it | Commands executed locally with PASS; actual runner execution UNVERIFIED (no remote) |
| Pre-commit hook | `.githooks/pre-commit` (activated via `git config core.hooksPath .githooks` in this clone) | Staged-files scan wired |
| Known-literal tripwire | Both compromised literals (hex + base58 forms) are ALWAYS flagged by the scanner, unsuppressible via allowlist | Regression test asserts shape-detection with synthetic middles |
| Secret-safe I/O discipline | All new tools print only paths/counts/sha256/redacted fingerprints | Redaction report + scanner output reviewed (no value emission) |
| False-positive process | `secret-scan-allowlist.json` (11 entries, each with public-meaning justification + verification basis) | Entries listed in D1 §B2 |
| Incident/rotation procedure | `SECURITY.md` §9.3 (5 steps: contain → report → rotate reachable creds → on-chain rotation per D4/D5 → independent verification per D9) | Documented |

## 4. Standing rules (unchanged, now enforced by tooling where possible)

1. **Repository cleanup does NOT revoke an exposed key.** Worktree purge, allowlists, and scanners stop ONGOING spread; only the on-chain migration packages (D4 EVM, D5 Solana) executed after the D8 approvals remove the keys' power.
2. **An exposed key remains compromised wherever it is stored.** No env-file or "local-only" placement is treated as containment.
3. **No key handling in this repo / AI environment** — all key-verification and signing scripts are retired (fail-closed stubs) or owner-side.
4. **A clean scan proves nothing about external copies** — the scanner's honest scope is text-pattern detection in this tree.

## 5. What would make this status worse again (recontamination vectors, monitored)

- New commits pasting key-shaped values → pre-commit + CI gate (tested).
- The AI-tool persisted-output cache (`tool-results/`) snapshotting contaminated content → gitignored + byte-checked this session (both cached files verified pattern-clean).
- Git history remaining reachable without rewrite → D3 plan pending; any clone made TODAY still exposes both literals in every commit.
- Remote existence (if any) → OWNER-ATT-1 + T-0.4 credential rotation (D8).

**Both keys remain REAL and fully privileged. NOT ACCEPTED.**
