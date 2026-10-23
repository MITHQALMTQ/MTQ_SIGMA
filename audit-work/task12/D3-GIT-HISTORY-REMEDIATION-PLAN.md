# MTQΣ — TASK 12 · D3: GIT-HISTORY REMEDIATION PLAN (PLAN ONLY — NO REWRITE PERFORMED)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

**Status: NOT EXECUTED. No force-push, no history rewrite, no reflog expiry, no
destructive cleanup happened during Task 12.** Everything below is the precise,
ready-to-execute plan awaiting the explicit owner + security-lead approval named
in D8. (There is no locally-configured remote — a rewrite here would not
propagate anywhere by itself, which also means we cannot clean any remote copy
from this sandbox even after approval.)

---

## 1. Inventory of reachable historical occurrences (what the rewrite must remove)

| Secret | Encodings in history | Where |
|---|---|---|
| C-045-a EVM key (`0xdbe1…62d6`) | 66-char 0x-hex literal | all reachable commits since the baseline squash `fb6bb6c` (2026-10-19 00:09:46Z) — **25/25 commits at the Task 11 census; unchanged by Task 12** |
| C-045-b Solana key (`58c19e…eb60`) | 128-char hex literal (seed‖pubkey) **and — NEW Task 12 finding — base58 form (`2mvV…j13V`)** in `scripts/verify-sol-key2.ts` history | same commit range (hex); base58 form from that file's introduction commit onward |

Notes (honest limits):
- The pre-baseline (pre-squash) history is UNVERIFIABLE from this repository; exposure window is treated as ≥ 2026-08-07 (Task 10 D1).
- The exact base58-form commit range was not re-censused this session (no reprocessing discipline — patterns travel via stdin/program logic, values never re-emitted). The rewrite procedure below strips ALL encodings from ALL reachable commits, so precise per-encoding commit ranges are not required for execution.
- `worklog.md` line-history also carried the EVM plaintext quote (Task 10 D1) — included in the same rewrite.

## 2. Affected artifacts and blast radius (before anything runs)

| Surface | Impact of rewrite | Required action |
|---|---|---|
| All branches on this machine (`main` only) | All commit SHAs change from the first contaminated commit onward | Owner/cooperators re-clone after the rewrite; open PRs (none known) rebased |
| Local reflogs / `.git/objects` | Old commits remain REACHABLE via reflog until expiry — a partial rewrite is worse than none | Step 4 expires reflogs + aggressive gc (below) |
| Any existing clone/backup (local or external) | NOT rewritten by this procedure — old literals remain there until each holder acts | Owner notice declares all pre-rewrite clones/backup snapshots void; holders re-clone (OWNER-ATT-1 determines who they are) |
| CI systems / artifacts / release assets / caches (if any remote ever existed) | NOT rewritten from here | Conditional T-0.4: invalidate Actions caches, artifacts, release assets; rotate every credential that touched the repo (TURSO_AUTH_TOKEN, TURSO_DATABASE_URL creds, FRED_API_KEY, DISCORD_WEBHOOK, KEEPER_URL, platform PATs) |
| AI-session transcript(s) | Untouchable from here | Treated as retained indefinitely; folded into the key-risk clock (rotation urgency), never into "we cleaned everything" claims |

## 3. Execution procedure (after approval; owner-controlled session)

1. **Freeze + snapshot**: stop all tooling; create a full backup bundle of the CURRENT (contaminated) state (`git bundle create …`) stored owner-side, access-restricted — this is the forensic original, retained per evidence-preservation rules, and clearly labeled contaminated.
2. **Install tooling**: `git-filter-repo` (preferred) or BFG repo-cleaner, owner-side.
3. **Strip all encodings**:
   - literal-anchored replacements for C-045-a (66-char hex), C-045-b (128-char hex), and C-045-b-base58 (88-char seed‖pubkey whose embedded pubkey equals the public address 4saT…cA1d — the match rule from `scripts/security/redact-known-secrets.ts` is the reference implementation and contains none of the values);
   - run across ALL refs (`--refs refs/*` / `--force`) so branches, tags, and stash are covered;
   - replace with the same redaction markers used in the worktree purge (fingerprint-only notices) so history remains readable.
4. **Purge reachability**: `git reflog expire --expire=now --all && git gc --prune=now --aggressive`.
5. **Verify**: (a) `git log --all -p | <scanner --stdin>`-style sweep OR run `scripts/security/secret-scan.ts` against a fresh clone — must be PASS with zero known-literal hits; (b) per-commit fingerprint-anchored grep (values passed via stdin only, per the PI-3 lesson) — zero occurrences across every commit; (c) confirm working-tree files byte-identical to the pre-rewrite tree except the replaced bytes.
6. **Re-clone**: all holders (this machine included) re-clone from the rewritten state; the old clone is decommissioned.
7. **Post-rotate the reachable credentials** (T-0.4) — conditional on OWNER-ATT-1: rotate every credential listed in §2 row 4.
8. **Record**: commit-hash mapping of the rewrite, the verification outputs, and the operator identity in `audit-work/task12/evidence/` (append-only).

## 4. Recontamination prevention (already in force; survives the rewrite)

- Pre-commit hook (staged scan) + CI first-job gate (worktree scan) + known-literal tripwire (unsuppressible) — all tested this session (D1 §E).
- Scanner regression suite runs in CI, proving a seeded secret blocks the gate.
- `tool-results/` (AI-tool output cache) gitignored.
- The two retired-stub scripts name the compromise explicitly, so future readers cannot unknowingly reintroduce the material.

## 5. Honest limits of this plan (what it does NOT achieve)

1. Adversary copies cannot be proven absent (Task 11 D2 §1.4) — the rewrite REDUCES exposure; it never zeros it.
2. Platform-level unreferenced objects (if any remote ever existed) may retain old commits indefinitely — only owner-side platform actions (support tickets / GDR-style deletion) can address that, post OWNER-ATT-1.
3. The rewrite does not touch either key's ON-CHAIN authority (D4/D5 are the only containment that does).
4. Session transcripts (PI-3) are outside this repository's control.

## 6. Approvals required before execution (D8 items)

| Step | Approver(s) |
|---|---|
| History rewrite itself (this plan) | **Owner + Security Lead** |
| Clone/backup invalidation notices | Owner (convener of all holders) |
| Credential rotation T-0.4 | Owner + Security Lead (conditional on OWNER-ATT-1) |
| Fresh-clone verification sign-off | Security Lead |

**Do not execute any part of this plan on a "continue working" instruction. It
requires the explicit D8 approval naming this plan.**
