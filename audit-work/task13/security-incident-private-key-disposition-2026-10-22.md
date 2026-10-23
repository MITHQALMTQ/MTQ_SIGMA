# Security Incident Disposition Record — T13-INC-001 (D-13.1)
## Authorized deletion of the quarantined uploaded copy `upload/private_key.txt`

- **Incident:** T13-INC-001 (see `security-incident-private-key-upload-2026-10-22.md`, retained unmodified as the forensic baseline)
- **Disposition executed:** 2026-10-22, 18:05:22 UTC
- **Authorization:** Owner instruction (IM gateway, session `web-32fffef0-0d39-4949-ad43-3f2619380163`): *"I authorize deletion of exactly the following quarantined uploaded file: `/home/z/my-project/upload/private_key.txt`. Delete only this exact file using the supported platform mechanism. Do not display, copy, export, load, or use the private key."* — Option **OPT-1** from incident record §6.
- **Scope honored:** exactly one `unlink` on the named path. No other file, record, report, or worklog entry was modified or deleted by the disposition itself. The key material was never displayed, printed, copied, hashed, exported, loaded, or used; `rm` reads no file content.

## 1. Exact evidence trail (commands, timestamps UTC, exit codes)

| # | Command | Window (UTC) | Result | Exit |
|---|---|---|---|---|
| A0 | `stat -c '%U:%G %a %s %y' upload/private_key.txt` | 18:04 pre-cycle | `root:root 777 66 2026-10-22 13:26:35` — file present (metadata only; no content access) | 0 |
| A1 | `bun run scripts/security/secret-scan.ts --path upload/private_key.txt` | 18:05:06 | **FAIL** — 1 finding: `upload/private_key.txt:1 [known-compromised-literal-C-045-a] 0xdbe1…62d6 (redacted by design)`; 1 file scanned, 0 suppressed | 1 |
| A2 | `bun test scripts/security/secret-scan.test.ts` | 18:05:06–18:05:20 | **11 pass / 1 fail** — failing test: `secret-scanner gate > the REPOSITORY worktree currently PASSES the gate (post-purge baseline)` (fail-closed, red for the T13-INC-001 cause) | 1 |
| B1 | `rm -- /home/z/my-project/upload/private_key.txt` | 18:05:22 | `rm completed without error` — single exact path, no glob, no recursion, no read | 0 |
| C1 | `stat -c '%U:%G %a %s %y' upload/private_key.txt` | 18:05:27 | `stat: cannot statx 'upload/private_key.txt': No such file or directory` — **confirmed absent** | 1 (expected ENOENT) |
| C2 | `bun run scripts/security/secret-scan.ts --path upload/private_key.txt` | 18:05:27 | **PASS** — 0 files scanned, 0 findings, `! error scanning upload/private_key.txt: path not found` (honest absence note) | 0 |
| C3 | `bun run scripts/security/secret-scan.ts` (full worktree) | 18:05:27–18:05:30 | **PASS** — 2,207 files scanned, 14 documented allowlist suppressions, **0 findings** | 0 |
| C4 | `bun test scripts/security/secret-scan.test.ts` | 18:05:30 | **12 pass / 0 fail** — worktree secret-gate test now green | 0 |
| C5 | `bun test` (full suite) | 18:05:30–18:05:33 | **37 pass / 0 fail** across 3 files, 2.95s (was 36/1) | 0 |
| C6 | `stat upload/*` | 18:05:33 | 12 remaining upload files present with unchanged metadata | 0 |
| C7 | `git check-ignore -v upload/private_key.txt` | 18:05:33 | still matched (`.gitignore:64` exact-path rule on file); `git status --porcelain` and `git diff --shortstat`: no change caused by the disposition | 0 |
| C8 | `stat audit-work/task13/security-incident-private-key-upload-2026-10-22.md` | 18:05:33 | 7,829 bytes, mtime 2026-10-22 13:35:59 — **original incident record retained unmodified** | 0 |

## 2. What this disposition does and does NOT mean (honest scope — owner's own framing adopted)

- **Done:** the one uploaded copy of the C-045-a literal inside this repository sandbox is destroyed; the worktree secret scan and its regression gate are green again; the T13-INC-001 tripwire state returned to its pre-incident PASS baseline (2,207 files / 0 findings / 14 documented suppressions).
- **NOT containment of the underlying credential.** R-1 (the compromised EVM private key, EOA `0x3C39…8d8c`) remains **compromised and fully privileged** at the latest on-chain anchors (Task 12: Monad 73,243,944 · Arc 68,520,264 · RH 140,748,341). Deletion of a copy does not revoke a key.
- **NOT key rotation.** Rotation/authority migration proceeds only via the Task 12 D4 (EVM) / D5 (Solana) packages after the D8 owner approvals (OWNER-ATT-1 → T12-1/T12-3 → CKPT-2/3/4 → CKPT-5/6/7). No signing, broadcasting, deployment, minting, burning, transfer, or authority change occurred in this disposition.
- **NOT proof of absence of external copies.** A clean worktree scan never proves that. The exposure census in Task 12 D2 remains: remote Git history, CI logs, session logs, backups, clones, and now platform-side retention of the IM-gateway attachment (outside this repository, outside this session's reach, owner-side item — the gateway stored the attachment when the message arrived; this `rm` cannot reach platform retention).
- No live-chain action of any kind was taken (standing shadow-mode, read-only posture).

## 3. Register updates

- **D-13.1 — DECIDED & EXECUTED (owner authorization, 2026-10-22 18:05:22 UTC):** OPT-1 secure deletion of the uploaded copy. Blocking effect cleared: worktree secret scan + secret-gate test return to PASS/0 findings. No other Task 13 work was gated on this.
- **R-1 status: UNCHANGED — compromised; rotation still gated on Task 12 D4/D8.** The copy census decreases by one in-repo location (this uploaded file); all other copy locations remain as documented in Task 12 D2, unverified externally.

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
