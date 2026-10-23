# MTQΣ — TASK 12 · D1: IMPLEMENTATION CHANGELOG

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Every row below is a Task 12 change made directly in the active working tree,
with the four mandated reporting fields (Status / Evidence / Residual risk /
Approval required). Pre-existing uncommitted changes at session start were
verified to be file-mode-only (0 insertions/0 deletions vs HEAD) and are NOT
Task 12 work. Nothing was force-pushed (no remote exists), no history was
rewritten, no transaction was signed or broadcast.

---

## A. Secret-exposure containment (P0)

| # | Change | Status | Evidence | Residual risk | Approval required |
|---|---|---|---|---|---|
| A1 | `scripts/security/redact-known-secrets.ts` (NEW) — fingerprint-anchored purge tool for C-045-a/C-045-b (hex + base58 forms); never prints matched values | **implemented** | 2,537–2,540 files swept; 9 occurrences purged; sha256 before/after recorded in `evidence/redaction-report-task12.json` | Git history retains both literals in all commits (plan-only below) | History rewrite: owner + security lead (D3) |
| A2 | Purge of the 2 EVM + 6 Solana-hex worktree copies (incl. `worklog.md` → in-place redaction notice, never silent deletion) | **implemented** | Post-purge sweep: ZERO worktree occurrences | Keys remain fully privileged (cleanup ≠ revocation) | On-chain rotation (D4/D5) |
| A3 | **NEW FINDING**: `scripts/verify-sol-key2.ts` held C-045-b in BASE58 form (seed‖pubkey `2mvV…j13V`) — a 7th worktree copy the Task 10/11 census MISSED ("base58 secrets: none") | **implemented (found + purged)** | Identification used only the PUBLIC embedded pubkey (4saT…cA1d); sha256 chain in evidence file; original preserved in git history | Corrects the prior census — any external re-census must account for base58 formats | None (record correction); history rewrite covers the base58 form too |
| A4 | `scripts/verify-key-and-audit-roles.ts` REWRITTEN — public-address read-only role auditor; key-verification retired (no key handling in repo/AI env) | **implemented** | ethers eth_call only; runs against Monad+Arc+Solana RPCs; role hashes are public OZ constants | None from this file | None |
| A5 | `scripts/verify-hex-key.ts` REWRITTEN — public-address read-only Solana mint/wallet auditor (both mints, balances; no web3.js needed) | **implemented** | JSON-RPC jsonParsed reads; derivation checks retired | None | None |
| A6 | 5 Solana action scripts (`solana-create-fresh.ts`, `-umi.ts`, `-with-metadata.ts`, `solana-set-metadata.ts`, `-v2.ts`) REPLACED with fail-closed retired stubs (exit 1 + pointer to migration package) | **implemented** | Each stub names the C-045-b compromise, the u64-overflow defect (10B×10¹⁸ reverts), and the blocked-action status | Originals still in git history (intended — history plan) | New-mint execution: owner + economic (DEC-3/SOL-DEC-1) |
| A7 | `scripts/verify-sol-key2.ts` REPLACED with fail-closed retired stub (records the base58 finding) | **implemented** | exit 1 on run | None | None |
| A8 | `scripts/set-solana-multisig.mjs` REPLACED with fail-closed retired stub (Squads identity UNVERIFIED; signing workflow must be owner-side) | **implemented** | exit 1 + reasons | Program identity still UNVERIFIED (R-10) | Squads identity verification (CKPT-8) + SOL-DEC-1 |
| A9 | `scripts/generate-new-evm-key.mjs` HARDENED — no stdout printing of key/mnemonic (the PI-3 hazard class); writes 0600 file; explicit ack flag required | **implemented** | Requires `--ack-…` flag; output path gitignored (.gitignore) | Owner-side tool; an AI runner could still execute it with the flag — mitigated by output being a file, not transcript | None |
| A10 | `CRITICAL-PRIVATE-KEY-ROTATION.md` CORRECTED (described old-generation addresses, console-printing keygen, `.env.local` guidance, "internal pilot may keep key" — all wrong) | **implemented** | Rewritten to current facts + five-channel record + standing rules + pointers to D3/D4/D5/D8 | Documentation only | None |
| A11 | `SECURITY.md` §9 added — secret-handling controls, value-safe false-positive process, exposed-credential incident procedure (5 steps incl. rotation + independent verification) | **implemented** | Section §9 | Documentation only | None |

## B. Secret-prevention controls (P0)

| # | Change | Status | Evidence | Residual risk | Approval required |
|---|---|---|---|---|---|
| B1 | `scripts/security/secret-scan.ts` (NEW) — maintained fail-closed scanner: EVM hex keys, raw-64-hex, Solana 128-hex/base58/keypair-JSON, mnemonics, env assignments, PEM, and the two known compromised literals (never suppressible) | **implemented** | Full-worktree gate PASS (2,162 files scanned, 14 allowlisted suppressions) | Scanner detects secret-shaped patterns in TEXT files only; a clean scan proves no external copies exist NOT | None |
| B2 | `scripts/security/secret-scan-allowlist.json` (NEW) — 10 documented entries (foundry build artifacts ×7, public role constants ×2 with verification bases, public BIP39 test vector ×1, verified sha256 digest ×1) — wait: 11 entries total incl. the scanner-test mnemonic | **implemented** | Each entry: file+rule+justification (public meaning + verification basis, never the value) | Allowlist is reviewable security state | Review by security lead at D8 |
| B3 | `scripts/security/secret-scan.test.ts` (NEW) — regression tests | **implemented, 12/12 PASS** | Seeded SYNTHETIC secrets (hash-derived, public by construction) BLOCK the gate (exit 1) and NEVER appear in output; known-literal SHAPES always flagged; clean-dir pass-through | None | None |
| B4 | `.github/workflows/ci.yml` — NEW first job `secret-scan` (worktree gate + regression + release-control tests); ALL other jobs `needs: secret-scan` | **implemented; locally executed** | The exact CI commands ran locally this session (gate PASS, tests PASS). Actual CI runner execution UNVERIFIED — no remote exists | Until a remote exists, the CI gate is aspirational infrastructure | Owner attestation of remote existence (OWNER-ATT-1) |
| B5 | `.githooks/pre-commit` + `git config core.hooksPath .githooks` (repo-local) — staged-files scan rejects commits | **implemented; activated in this clone** | Hook file chmod +x; config set | Hooks are local config — each clone must activate (documented in SECURITY.md §9.1) | None |
| B6 | `.gitignore` — `tool-results/` (AI-tool persisted-output cache) + `.fresh-evm-keypair-DO-NOT-COMMIT.txt` | **implemented** | Entries added | None | None |
| B7 | `package.json` — `security:scan`, `security:scan:staged`, `security:redact:dryrun`, `security:redact:execute`, `security:tests` | **implemented** | `bun run security:scan` PASS | None | None |

## C. Release controls (P1)

| # | Change | Status | Evidence | Residual risk | Approval required |
|---|---|---|---|---|---|
| C1 | `src/lib/mtq/release-controls.ts` (NEW) — 8 separate control states, fail-closed action map (10 actions), owner-side authorization-file mechanism (`RELEASE_AUTHORIZATIONS_FILE`), NO grant inference from build/tests/sessions/endpoints | **implemented** | 13/13 tests PASS: default-deny, malformed-deny, partial-grant-deny, green-software-gate-authorizes-nothing-chain-facing, deliberate-opening-only-with-complete-grants | The authorization-file mechanism is unexercised by a real owner ceremony | Each grant: named owner role (D8) |
| C2 | `mini-services/keeper/index.ts` — release-control guard FIRST in `runTick` (before provider/signer/contract construction); `/health` exposes control states | **implemented; live-verified** | `GET /health`: `keeperTxSubmission.allowed=false`, `grantedControls=0`; `POST /tick` → observe-only no-op (`lastTick` stays null) — verified on the RUNNING keeper (bun --hot restart) | The guard relies on the shared module; a fork of the keeper without the guard would bypass it (code-review item for D9) | Owner-side authorization file only (no change needed now — default is the required posture) |
| C3 | `src/app/api/release-state/route.ts` (NEW) — read-only exposure of control states + action map + address-book validation | **implemented; live-verified** | `GET /api/release-state` → posture, NOT_ACCEPTED, 0 grants, keeper-tx DENIED, addressBook ok=false (2 blockers, 9 findings) | Route grants nothing by design | None |
| C4 | Inngest functions reviewed (`src/lib/inngest/functions.ts`): all 6 are read/monitor/alert only — no chain-facing path exists | **verified (no change needed)** | File review: keeperTick reads snapshot + Discord alert; sync/backup/monitor/FRED/prune are DB/feed reads | Future functions must be re-reviewed (D9 checklist) | None |

## D. Canonical architecture / address book (P1)

| # | Change | Status | Evidence | Residual risk | Approval required |
|---|---|---|---|---|---|
| D1 | `src/lib/mtq/address-book-validation.ts` (NEW) — six-way classification (CANONICAL-CANDIDATE / CURRENT-UNAPPROVED / SUPERSEDED / DUPLICATE-CONFLICT / UNVERIFIED / APPROVED-CANONICAL); findings NOT mutations; no auto-selection | **implemented** | 12/12 tests PASS; validator reports ok=false honestly (2 BLOCKERS: cross-chain hex-role conflicts) | Validator is advisory tooling; the underlying contamination is factual, not fixable in code | Canonical selection: governance (DEC-1…7) |
| D2 | Contamination facts surfaced as durable test invariants: RH Takaful = Monad Reserve hex; RH MockUSDC = Arc Oracle hex; Safe+Governance same-hex cross-chain; RH `canonical:true` flagged as NOT approval; mainnet rows (Base/Arbitrum) flagged vs testnet-only posture; zero-address rows flagged UNVERIFIED | **implemented** | `address-book-validation.test.ts` assertions all PASS | Records preserved, not deleted (per §5) | None |
| D3 | Fresh read-only evidence probe `audit-work/task12/probe-fresh-anchors.ts` → `evidence/fresh-anchors-task12.json` (Monad 73,243,944 · Arc 68,520,264 · RH 140,748,341 · Solana slot 513,885,476; hashed responses; failures=UNVERIFIED) | **implemented** | All cells IDENTICAL to Task 11 evidence — state unchanged, no attacker action observed; Monad Redeem MINTER anomaly and 1/1 Safes persist | Snapshot only — not continuous monitoring | None |

## E. Verification runs (P1 §7) — honest results

| Check | Command | Result |
|---|---|---|
| TypeScript | `bun run typecheck` | **PASS** (clean; bun-types reference added to the 2 new test files) |
| ESLint | `bun run lint` | **PASS** (zero output) |
| Secret-scanner gate | `bun run security:scan` | **PASS** (2,162 files, 14 allowlisted suppressions, 0 findings) |
| Secret-scanner regression | `bun test scripts/security/secret-scan.test.ts` | **12/12 PASS** |
| Release controls | `bun test src/lib/mtq/__tests__/release-controls.test.ts` | **13/13 PASS** |
| Address-book validation | `bun test src/lib/mtq/__tests__/address-book-validation.test.ts` | **12/12 PASS** |
| Full suite | `bun test` | **37/37 PASS (3 files)** |
| Canonical invariants (CI unit job) | `bun run src/lib/mtq/__tests__/canonical-invariants.ts` | **PASS, exit 0** (Layers 1–8) |
| No-Neon guardrail | `bun run check:no-neon` | **PASS** (45 API routes clean) |
| Keeper fail-closed (live) | `GET :3040/health`, `POST :3040/tick` | **PASS** (guard denies; observe-only; lastTick null) |
| Release-state API (live) | `GET :3000/api/release-state` | **PASS** (0 grants; keeper-tx DENIED; honest address-book blockers) |
| CI runner execution | n/a | **UNVERIFIED — no remote configured** (the same commands were executed locally) |

## F. Deliberately NOT done (execution boundary honored)

No transactions, signatures, deployments, role changes, Safe changes, authority
changes, asset movements, history rewrites, or destructive cleanup. No release-gate
advancement claimed from any test/typecheck/lint result (Task 11.1 §7 rule).
The canonical architecture remains UNSELECTED. Both compromised keys remain
REAL and fully privileged — nothing in this changelog revokes them.
