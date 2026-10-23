# Security Incident Record — T13-INC-001
## Private-key file uploaded into the AI session with an instruction to place it in `.env`

- **Incident ID:** T13-INC-001
- **Recorded:** 2026-10-22 (file mtime 2026-10-22 13:26:35 UTC / 15:26 Africa/Cairo)
- **Vector:** COO message transmitting MTQSIGMA-COO-MANDATE-003 (Task 13) via the IM gateway. The platform persisted the attachment at `upload/private_key.txt` (gateway metadata: session `web-32fffef0-0d39-4949-ad43-3f2619380163`, chat `32f17db1-a61e-4f6b-be50-a6bec6e14b72`, trace `1a163cb0536ff0dd`).
- **Requested action:** "my private key incase you need it is attached to put in .env" — **REFUSED.** No `.env` write occurred. Rationale in §3.
- **Key classification (value-safe):** contents were identified by the Task 12 fingerprint-anchored scanner (`scripts/security/secret-scan.ts --path`) as **KNOWN compromised literal C-045-a** (rule `known-compromised-literal-C-045-a`, redacted fingerprint `0xdbe1…62d6`) — i.e. the EVM private key recorded as compromised since the Task 10 incident (**R-1**), associated with EOA `0x3C3932F865892EFabE45892f453f81B64f6c8d8c`. **Not a new third key.** The file was never opened, read, printed, hashed, or copied by the AI; identification used only the scanner's value-safe output (file + rule + redacted first-4…last-4 fingerprint).

## 1. File facts (metadata only)

| Property | Value |
|---|---|
| Path | `/home/z/my-project/upload/private_key.txt` |
| Size | 66 bytes |
| Owner / mode | `root:root`, mode `777` |
| mtime | 2026-10-22 13:26:35 UTC |
| `chmod 600` by session | **FAILED** — `Operation not permitted` (root-owned; session runs as uid `z`) |

## 2. Containment state (verified 2026-10-22)

1. **Commit-impossible:** `git check-ignore -v` → matched by **two pre-existing rules**: `.gitignore:63` (`upload/*.txt`) and `.gitignore:64` (exact `upload/private_key.txt`). No bulk `git add` can stage this file.
2. **Never tracked, never committed:** `git ls-files upload/` lists only documents/media; `git log --all --oneline -- upload/private_key.txt` → **EMPTY**. Zero commits touch this exact path across all refs.
3. **Fresh full-worktree secret scan (2026-10-22):** 2,183 files scanned, 14 documented allowlist suppressions, **exactly 1 finding = this file** (rule `known-compromised-literal-C-045-a`). **The gate is correctly RED and must stay red until the owner disposes of the file.** All other worktree files: 0 findings. The commit-blocking gates (pre-commit / `--staged` mode) are unaffected because the file is gitignored.
4. **Zero AI-side content exposure:** the key material never entered any AI transcript, tool output, log, or derived artifact (contrast with the Task 10 transcript-emission incident class — this event was handled with zero content exposure, per the Task 12 value-safe tooling design).
5. **No use:** no signing, no address derivation, no import, no verification call, no copy. The key was not processed in any way beyond the scanner's fingerprint classification.

## 3. Why the `.env` instruction was refused

1. **The mandate forbids it in its own §2 rule 1:** "Treat the previously exposed EVM and Solana private keys as compromised. Never reuse them, ask the owner to paste them, print them, log them, or use them for a transaction." Writing a live key into `.env` creates a fresh plaintext copy in the working tree — exactly the exposure class Task 12 §2 removed.
2. **No operation in Task 12/13 scope needs a key.** All verification is public-address, read-only. Migration packages are unsigned by design. A "need" for a private key would itself be an out-of-scope signal.
3. **The key is already compromised (R-1)** and remains fully privileged at the latest fresh anchors (Task 12 evidence, block anchors Monad 73,243,944 · Arc 68,520,264 · RH 140,748,341). The only correct handling is non-use plus rotation via the Task 12 D4 package after the D8 owner approvals. A `.env` copy adds an uncontrolled copy location and changes nothing about the security facts.
4. **Standing rule:** this session will never ask for, accept, store, or use private keys.

## 4. Exposure-taxonomy update (extends the Task 11.1 five-way taxonomy)

New disclosure-location class observed: **"owner upload into AI-session server storage"** (gateway attachment persisted under `upload/`). This class is outside what repository remediation can ever address — it is controlled only by owner-side behavior (never attach keys to chat) and platform retention policy. This incident adds **one copy of C-045-a** in this class. **R-1's status is unchanged** (compromised; rotation gated on Task 12 D4/D8 approvals); the copy census grows by one location.

## 5. Residual risk & honest limits

- The file is `root:root` mode `777` — world-readable/writable on the sandbox host; the session user cannot restrict it. Mitigation in place: double gitignore, never-read policy, and a durable scanner tripwire (every worktree scan flags it until disposition). **Host-level access control over `upload/` is an owner-side item** — same class as the unresolved remote/CI/backup/clone exposure question (OWNER-ATT-1).
- A clean scan never proves absence of external copies; this event demonstrates that new copies can appear outside the repository at any time via the chat channel itself.
- Deletion/movement of the file was **not** performed: it is an owner file, deletion is a destructive action (mandate §2.3), and the file is now forensic evidence of this incident.

## 6. Disposition options — OWNER APPROVAL REQUIRED (no default action taken)

- **OPT-1 (recommended):** Owner confirms R-1 remains compromised (Task 10 D1 evidence already establishes this) and authorizes **secure deletion of `upload/private_key.txt`** via an explicit instruction naming this exact path. The worktree gate then returns to PASS / 0 findings. The AI will not delete owner files without this explicit approval.
- **OPT-2:** Owner destroys the file platform-side / infra-side (owner-managed), same effect; session re-runs the scan to confirm.
- **Permanently out of scope (refused regardless of any instruction):** placing the key in `.env` or any file; using, deriving, importing, or "testing" with the key; moving it into any tracked location; suppressing or allowlisting the scanner finding.

Rotation of the underlying on-chain authority proceeds **only** via Task 12 D4 (EVM) / D5 (Solana) after the D8 approvals (OWNER-ATT-1 → T12-1/T12-3 → CKPT-2/3/4 → CKPT-5/6/7). This incident does not alter that sequence.

## 7. Reproducible evidence (value-safe — no command outputs key material)

```
stat -c '%U:%G %a %s %y' upload/private_key.txt
  → root:root 777 66 bytes 2026-10-22 13:26:35 UTC
git check-ignore -v upload/private_key.txt
  → .gitignore:63 (upload/*.txt) + .gitignore:64 (exact) — exit 0
git ls-files upload/
  → documents/media only; private_key.txt absent
git log --all --oneline -- upload/private_key.txt
  → (empty)
bun run scripts/security/secret-scan.ts --path upload/private_key.txt
  → FAIL — 1 finding: known-compromised-literal-C-045-a (0xdbe1…62d6, redacted by design)
bun run scripts/security/secret-scan.ts        (full worktree)
  → FAIL — 1 finding (same file); 2,183 files scanned; 14 documented suppressions; all else clean
chmod 600 upload/private_key.txt
  → Operation not permitted (root-owned file)
```

## 8. Approval register entries created

- **D-13.1** — disposition of `upload/private_key.txt` (OPT-1 / OPT-2 choice). Blocking for: worktree-scan green status only. Not blocking any other Task 13 work.
- Standing dependency reminder: R-1 rotation = Task 12 D4 + D8 approval chain (unchanged by this incident).

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED.**
