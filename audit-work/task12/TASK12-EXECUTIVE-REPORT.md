# MTQΣ — TASK 12 · EXECUTIVE REPORT
## Executable Security Remediation, Authority-Migration Readiness & Release Control

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**
**Overall release status: NOT ACCEPTED — unchanged by this task. Nothing in Task
12 rotates a key, executes a transaction, or advances a release gate.**

Issued against: Task 12 directive (COO). Baseline: Task 10 D1–D8, Task 11
D1–D9 + Task 11.1 corrections (all evidence preserved byte-unmodified; the
Task 12 working-tree changes are additive/containment only; the 80 pre-existing
unstaged file-mode changes were verified content-identical to HEAD and left
untouched).

---

## 1. What was actually implemented (facts, not theater)

### P0 — Secret-exposure containment in the repository: **DONE (worktree), evidence-hashed**

- **Purge executed**: all worktree copies of both compromised literals removed —
  EVM C-045-a (2 files incl. the worklog plaintext quote, replaced by an
  in-place append-only redaction notice) and Solana C-045-b (6 hex-form files)
  — via `scripts/security/redact-known-secrets.ts`, a fingerprint-anchored tool
  that never prints a matched value. sha256 before/after chain:
  `evidence/redaction-report-task12.json`. Post-purge sweep: **zero occurrences**.
- **NEW FINDING — census correction**: the Task 12 scanner discovered a **7th
  worktree copy of C-045-b in BASE58 form** (`scripts/verify-sol-key2.ts`,
  seed‖pubkey `2mvV…j13V`) that the Task 10/11 census MISSED ("base58 secrets:
  none"). Identified without handling the value (crypto-free embedded-pubkey
  check against the public 4saT…cA1d address), purged, script retired. The
  incident record (D2) and the prior census claims are corrected accordingly.
- **Key-dependent audit scripts replaced**: the two "verify key" scripts are now
  public-address read-only auditors (roles matrix + mint/wallet state — same
  audit function, zero key handling); five Solana action scripts and the
  multisig draft are fail-closed retired stubs; the keygen helper no longer
  prints secrets to stdout (the exact PI-3 hazard class) and writes a 0600
  file behind an explicit acknowledgement flag.

### P0 — Secret-prevention controls: **IMPLEMENTED AND TESTED**

- `scripts/security/secret-scan.ts` — maintained fail-closed scanner (10 rule
  families incl. the two known compromised literals as unsuppressible
  tripwires; base58 secrets vs signatures distinguished by context).
- **Gate demonstrated**: full worktree PASS (2,162 files, 14 documented
  allowlist suppressions); **regression tests prove a seeded SYNTHETIC secret
  BLOCKS the gate (exit 1) without its value ever appearing in output — 12/12
  PASS**; allowlist false-positive process documented (value-safe); incident
  & rotation procedure documented (SECURITY.md §9.3).
- **Wired**: CI job `secret-scan` runs FIRST and all jobs depend on it;
  pre-commit hook active in this clone; `tool-results/` (AI-tool output cache)
  gitignored after byte-verification that this cycle created no new unprotected
  copies there. Honest limit: actual CI-runner execution is **UNVERIFIED — no
  remote exists**; the identical commands were executed locally with PASS.

### P0 — EVM + Solana migration packages: **EXECUTION-READY, UNSIGNED**

- `D4-EVM-AUTHORITY-MIGRATION-PACKAGE.md` — full authority inventory re-anchored
  at fresh blocks (**Monad 73,243,944 · Arc 68,520,264 · RH 140,748,341 — every
  probed cell identical to Task 11; no attacker action observed**), destination
  Safe-B 4-of-7 design with hard quorum-proof gate, grant-before-revoke
  sequence with exact reviewable calldata forms, the unavoidable handover
  window disclosed, bypass pathways enumerated (Governors, custom module roles,
  gen-A ownership), and an honest "what prevents full specificity" blocker
  list (signers not bound; factory/fallback policy; ECON-DEC-2; evacuation
  destinations).
- `D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md` — mint-by-mint dossiers re-anchored
  at **slot 513,885,476** (both authorities of the superseded mint still the
  exposed key; 4.98 SOL still drainable), unsigned SetAuthority sequence with
  SOL-evacuation-first ordering, the **u64 supply-representation design-decision
  analysis** (decimals 18 cannot represent the mandate; decimals ≤ 9 is an
  economic OPTION, not auto-selected; the 10B×10¹⁸ plan would revert and its
  script is now a fail-closed stub), and the S-1…S-7 decision set.
- `D3-GIT-HISTORY-REMEDIATION-PLAN.md` — precise rewrite plan (all encodings of
  both literals; reflog expiry; re-clone; forensic bundle preservation;
  recontamination prevention) **awaiting owner + security-lead approval**;
  git history is intentionally untouched.

### P1 — Release controls: **FAIL-CLOSED, PROVEN IN THE EXECUTION PATH**

- `src/lib/mtq/release-controls.ts`: 8 SEPARATE control states; 10-action map;
  **default = every control NOT_GRANTED, every chain-facing action DENIED**;
  grants exist only in an owner-authored authorization file outside git
  (partial/malformed = denied). A green software gate authorizes NOTHING
  chain-facing (tested).
- **Keeper (the real execution path — it signs and broadcasts on a 4-second
  tick whenever configured) now guards FIRST**: `isActionAllowed("keeper-tx-submission")`
  is checked before any provider/signer/contract construction. **Live-verified
  on the running service**: `/health` reports the exact control states,
  `allowed=false`, `grantedControls=0`; a manual `POST /tick` observes-only
  (`lastTick` stays null — ticks never reach the chain stage). This is backend
  enforcement, not a badge.
- Inngest functions reviewed: all six are read/monitor paths (no change
  needed). No API route signs transactions. `/api/release-state` publishes the
  state read-only. Test evidence: 13/13 release-control tests, 12/12
  address-book tests.

### P1 — Address-book validation: **IMPLEMENTED, HONEST-RED**

- `src/lib/mtq/address-book-validation.ts` — the six mandated classifications,
  no auto-selection, no evidence deletion. Current verdict **ok=false (2
  BLOCKERs)**: cross-chain hex-role conflicts (RH "Takaful" == Monad "Reserve";
  RH "MockUSDC" == Arc "Oracle") plus flagged rows for the shared Safe and the
  same-hex-different-build Governance pair, the RH `canonical:true` flag
  (explicitly NOT an approval), mainnet rows vs the testnet-only posture, and
  zero-address pending rows. **APPROVED-CANONICAL count: 0 — the decision is
  pending by design.** All 18 deployed contracts remain source/build-identity
  UNVERIFIED (size/name/selector/address are insufficient); the Redeem-module
  permission finding stays OPEN pending governance disposition.

## 2. Verification results (honest)

| Check | Result |
|---|---|
| `bun run typecheck` | **PASS** |
| `bun run lint` | **PASS** (zero findings) |
| `bun run security:scan` (worktree gate) | **PASS** (0 findings / 14 documented suppressions) |
| Secret-scanner regression suite | **12/12 PASS** (blocks seeded secret; value never printed) |
| Release-controls suite | **13/13 PASS** (default-deny, malformed-deny, partial-grant-deny, no-inference, deliberate-opening-only) |
| Address-book validation suite | **12/12 PASS** |
| Full `bun test` | **37/37 PASS** |
| Canonical invariants (CI unit job) | **PASS (exit 0)** |
| No-Neon guardrail | **PASS** (45 routes) |
| Keeper fail-closed (live service) | **PASS** (guard denies; observe-only) |
| `/api/release-state` (live) | **PASS** (0 grants; honest blockers surfaced) |
| Actual CI-runner execution | **UNVERIFIED** — no remote configured; identical commands run locally |

A passing typecheck/test does not excuse a failed security control; none
failed. Environmental limitations are reported as UNVERIFIED, never PASS.

## 3. Residual risks (headline — full table in D10)

1. **Both compromised keys remain REAL and fully privileged** — verified live
   at the fresh anchors (R-1/R-2). Repository cleanup does not revoke keys;
   only the D4/D5 packages, executed after the D8 approvals, do.
2. **Git history still contains both literals in every commit** (now including
   the base58 form) — the D3 rewrite needs explicit owner + security-lead
   approval; every day of retention leaves the literals one `git log -p` away.
3. **Remote/CI/backup/clone exposure UNVERIFIED** — OWNER-ATT-1 gates the
   credential-rotation set.
4. **DbFjz custody (current Solana mint authority) UNVERIFIED** (CKPT-2); the
   superseded mint remains mintable by the exposed key; its 4.98 SOL is
   drainable by any repo holder.
5. **Canonical architecture UNSELECTED**; Governor sources unpublished (N-01);
   handover-window race inherent to any rotation (owner picks the policy).

## 4. Exactly which approvals are required next (D8 is the authority)

Smallest set that moves containment: **OWNER-ATT-1** (remote existence) →
**T12-1** (history rewrite) + **T12-3** (credential rotation) · **CKPT-2**
(DbFjz custody) · **CKPT-3/4** (signer ceremony — longest lead item) ·
**CKPT-5/6 → CKPT-7** (Safe-B dossier → grant set → revoke set + destinations) ·
**T12-8 + CKPT-7** (Solana evacuation + revocations) · **SOL-DEC-1 / DEC-3**
(mint disposition / decimals — economic) · **CKPT-9** (independent reviewer,
D9 plan) before any "contained" language. General instructions to continue
authorize none of these.

## 5. Execution boundary — respected

Zero transactions, signatures, deployments, role grants/revocations, Safe
changes, authority changes, asset movements, history rewrites, or destructive
cleanups. Zero key-material handling, printing, or re-derivation. No
testnet-only/shadow-mode posture change. No gate advancement from documentation,
typechecking, linting, or tests.

---

**Deliverables:** `TASK12-EXECUTIVE-REPORT.md` (this file) · `D1` implementation
changelog · `D2` secret-containment status · `D3` git-history remediation plan ·
`D4` EVM migration package · `D5` Solana migration package · `D6` canonical
validation · `D7` release-control verification · `D8` owner-approval checklist ·
`D9` independent-verification plan · `D10` remaining risks ·
`register-task12.json` (machine-readable) · evidence:
`redaction-report-task12.json` + `fresh-anchors-task12.json`.

**Required final posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED
RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.** Returned for owner review.
Stopped at the defined execution boundary.
