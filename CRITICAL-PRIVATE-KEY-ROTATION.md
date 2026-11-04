# 🔴 CRITICAL — Deployer Private Key Compromise & Rotation (CORRECTED 2026-10-23)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**
**Release status: NOT ACCEPTED**

> **Task 12 correction of the record.** The previous version of this document
> (a) described the OLD generation's contracts, (b) suggested generating keys by
> printing them to the console, and (c) implied an internal-pilot could keep the
> exposed key. All three points are obsolete and unsafe. This version states the
> current facts and points to the authoritative remediation packages.

## Current facts (verified — Task 10/11/11.1/12 evidence)

| Key | Incident | Fingerprint (public) | Derives to | Status |
|---|---|---|---|---|
| EVM deployer key | **C-045-a** | `0xdbe1…62d6` (66 chars) | `0x3C3932F865892EFabE45892f453f81B64f6c8d8c` | **REAL, fully privileged, TREAT AS COMPROMISED** — sole admin/owner of the Monad + Arc estates and both 1/1 Genesis Safes |
| Solana 4saT key | **C-045-b** | `58c19e…eb60` (128 hex) / base58 `2mvV…j13V` | `4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d` | **REAL, live-privileged (superseded mint mint+freeze authority + 4.98 SOL), TREAT AS COMPROMISED** |

Exposure channels (five-channel record — `audit-work/task11/D2-EXPOSURE-SURFACE.md`):
repository worktree (purged by Task 12 K-1 — including a **base58 form the
prior census missed**, now redacted), **git history (still present in all
commits — rewrite requires separate owner approval)**, the AI-session transcript
(disclosed incident PI-3), and remote/CI/backup/clone surfaces (UNVERIFIED — no
remote is configured locally, which proves nothing about remote copies).

## Standing rules (do not un-learn these)

1. **Repository cleanup does NOT revoke an exposed private key.** Keys are
   self-authenticating data; deleting every copy changes nothing about what a
   holder can sign. Only the owner-approved on-chain rotation does.
2. **An exposed key stays compromised no matter where it is moved** — .env
   files, "local-only" files, gitignored folders. Storage location is not
   revocation.
3. **Never print, paste, echo, or re-derive key material** in this repository
   or any AI environment (incident PI-3 was exactly this class).
4. **The compromised keys are never loaded by any repo tooling** — signing, if
   ever performed, happens in an owner-controlled session outside this
   environment (migration packages D4/D5 define the steps and checkpoints).

## Remediation — the actual plans (all awaiting owner approvals)

- **EVM rotation**: `audit-work/task12/D4-EVM-AUTHORITY-MIGRATION-PACKAGE.md`
  (grant-before-revoke sequence to a 4-of-7 destination Safe; never revoke the
  only working admin before the destination is verified).
- **Solana containment**: `audit-work/task12/D5-SOLANA-AUTHORITY-MIGRATION-PACKAGE.md`
  (superseded-mint authority revocation + SOL evacuation; current-mint
  disposition SOL-DEC-1; decimals decision reserved to the economic authority).
- **Git-history remediation** (requires owner + security-lead approval):
  `audit-work/task12/D3-GIT-HISTORY-REMEDIATION-PLAN.md`.
- **Approvals required before ANY execution**:
  `audit-work/task12/D8-OWNER-APPROVAL-CHECKLIST.md` +
  `audit-work/task11/D7-APPROVAL-AND-DEPENDENCY-MATRIX.md`.

## What Task 12 already implemented in-repo (safe, non-destructive)

- Purge of both literals (all 9 worktree occurrences incl. the missed base58
  copy) — `audit-work/task12/evidence/redaction-report-task12.json`.
- Fail-closed secret-scanning gate (CI + pre-commit) with regression tests:
  `scripts/security/secret-scan.ts`.
- Fail-closed release controls enforced in the keeper execution path:
  `src/lib/mtq/release-controls.ts` (all chain-facing actions denied by
  default; `NOT ACCEPTED`).
- Read-only audit scripts converted to public-address verifiers
  (`scripts/verify-key-and-audit-roles.ts`, `scripts/verify-hex-key.ts`).

**Completion of any documentation or tooling does NOT mean the keys have been
rotated. The release status remains NOT ACCEPTED.**

---

## Addendum — 2026-10-24 owner instruction (recorded, not a remediation)

The protocol owner re-supplied the C-045-a key material
(`upload/private_key.txt`, fingerprint match `0xdbe1…62d6`) and explicitly
instructed that it be placed in the repo-root `.env` as
`DEPLOYER_PRIVATE_KEY` (the variable this repo's operational scripts read).
The instruction was executed: the key now lives in `.env` (gitignored) and
nowhere in any tracked file. Consequences, stated honestly:

1. **This is storage, not revocation.** The key remains exposed in git
   history and any historical copies; only the D4 on-chain rotation package
   fixes that. Blast radius today is the TESTNET Monad + Arc estates (sole
   admin of the current generation + both 1/1 Genesis Safes).
2. **Standing rules 3/4 above are amended by the owner's own authority** for
   this key and this location: the fail-closed scanner
   (`scripts/security/secret-scan.ts`) now skips the owner-designated LOCAL
   secret stores (`.env*`, `upload/private_key.txt`) in whole-tree scans —
   and ONLY when `git check-ignore` confirms the file is actually ignored.
   `--staged` scans and every other location keep full blocking force, so
   the key can still never enter tracked files or git history.
3. CI is unaffected: the checkout contains neither `.env` nor `upload/`, so
   the gate and its regression tests run exactly as before.
4. **Recommended next step (owner action):** execute
   `audit-work/task12/D4-EVM-AUTHORITY-MIGRATION-PACKAGE.md` (grant-before-
   revoke to a 4-of-7 destination Safe), then rotate this key and delete the
   `.env` entry. Until then, treat every testnet transaction from the
   deployer EOA as signed by a publicly-derivable key.
