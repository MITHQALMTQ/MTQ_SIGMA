# MTQΣ — TASK 10 · D1: REDACTED KEY-EXPOSURE INCIDENT REPORT (C-045)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Produced 2026-10-22 · Read-only forensic investigation · ZERO transactions · ZERO privilege changes ·
**No key material, and no fragment beyond a redacted fingerprint, appears in this report or any Task 10 artifact.**
Forensic tooling: `audit-work/task10/forensics-key-incident.ts` · evidence: `evidence/key-incident-forensics.json`
(9.95 MB, redaction-swept) · re-run: `bun audit-work/task10/forensics-key-incident.ts`.

---

## 1. Verdict

**TWO distinct key literals exist in the repository, and BOTH are REAL and live-privileged today.**
Neither is a placeholder, a dummy, or non-functional test material. Under the task's rule ("if the key is
real or its status cannot be safely established, treat it as compromised"), **both are treated as
compromised** pending owner-approved containment.

| ID | Kind | Redacted fingerprint | Derives to (verified locally) | Status |
|---|---|---|---|---|
| C-045-a | EVM secp256k1 private key (`0x`+64 hex) | `0xdbe1…62d6` (66 chars) | **`0x3C3932F865892EFabE45892f453f81B64f6c8d8c`** — the deployer EOA | REAL — full-estate authority |
| C-045-b | Solana ed25519 secret key (64-byte hex = seed‖pubkey) | `58c19e…eb60` (128 hex chars) | **`4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d`** — a funded, privileged Solana wallet | REAL — old-generation mint authority |

Derivation was performed offline (ethers `Wallet` for secp256k1; Node `crypto` ed25519 PKCS#8 derivation
+ embedded-pubkey consistency check for the Solana keypair). **No RPC, no signing, no execution was
involved; nothing was "used".**

## 2. What the associated accounts control (evidence-backed, current state 2026-10-22)

**C-045-a → deployer EOA `0x3C39…d8c`:**
- DEFAULT_ADMIN_ROLE + MINTER_ROLE + PAUSER_ROLE on BOTH current MTQ tokens (Monad `0x9e6E…53aD` @ block
  73,167,496; Arc `0x237c…6601` @ block 68,475,006 — individually re-probed this session).
- DEFAULT_ADMIN_ROLE on all 7 AccessControl modules on BOTH chains (14/14 re-verified). `getRoleAdmin` of
  every role = DEFAULT_ADMIN → **this key can grant/revoke every role on every AC contract unilaterally.**
- Sole owner + sole signer of BOTH Genesis Safes (`0xE718…A7D0`, threshold 1, nonce 0, v1.4.1).
- Holds ~100% of both chains' current token supply (309.94899999999999999997 MTQ Monad; 998.999…997 MTQ Arc)
  plus native balances (0.224343224 MON; 19.026597151851474173 native-Arc — unchanged since Task 9).
- **Ever controlled**: deployed the entire Arc current-generation estate (creation txs 2026-08-07 12:03–12:32,
  receipts preserved from Task 9) and the Sept-5/6 gen-A/Ecosystem/Robinhood deployments (manifests). Monad
  deployment authorship remains UNVERIFIED (pruned state) but is inferred from the role/nonce evidence.
- Deployer tx counts now: Monad 103 (0x67), Arc 92 (0x5c).

**C-045-b → wallet `4saT…cA1d`:**
- **Mint authority AND freeze authority of the superseded-but-live SPL mint `2EaK5cQt…RLSf3gY`** (fresh
  `getAccountInfo` 2026-10-22 06:31Z: both options SET, decimals 18, supply 4,477,988,020,393,345,024 raw).
  With this key an actor can mint unlimited old-generation tokens and freeze any of their accounts.
- Holds that mint's ENTIRE supply (4.477988020393345024) in its ATA `BLwtDcSn…BsX33`.
- **Holds 4.983686 SOL** (fresh `getBalance`) — drainable by anyone holding the key.
- Wallet activity: 5 transactions, all 2026-09-06 16:15–17:22Z (the Solana rebranding session). It was never
  the fee payer of the current mint `GAGRdrY6` (creation tx feePayer = `DbFjz…QhXb3`, 2026-08-10 12:06:06Z).
- **The current mint authority `DbFjz…QhXb3` key was NOT found in the repository census** (see §4 limits).

## 3. Exposure timeline (all timestamps UTC)

| When | Event | Evidence |
|---|---|---|
| ≥ 2026-08-07 12:03 | EVM key already in active use (Arc estate deployment session) | Arc creation txs (Task 9 receipts) |
| 2026-08-10 12:06 | Current Solana mint created by DbFjz (not by the exposed key) | `getTransaction` on mint's oldest sig, slot 482,635,368 |
| 2026-09-05/06 | EVM key deploys gen-A/Ecosystem/Robinhood sets; 4saT wallet performs 5 branding txs | manifests + devnet signatures |
| ~2026-10-18 09:33 | Both literals written into repo scripts; `CRITICAL-PRIVATE-KEY-ROTATION.md` written (describing `upload/private_key.txt`) | file mtimes (statSync) |
| 2026-10-19 00:09 | Baseline squash commit `fb6bb6c` — **both literals enter git history** | `git grep` across all 24 commits |
| 2026-10-19 21:11 | C-045 first registered in commit `8c2bc04` | commit message |
| 2026-10-21 | Task 9: literal presence re-confirmed at HEAD; never exposed in its report | `v9-task9` |
| 2026-10-22 05:48 | **This forensics: derived-address verification proves both literals REAL** | `evidence/key-incident-forensics.json` |
| unknown | `upload/private_key.txt` deleted from disk (ABSENT now; never git-tracked — `.gitignore:56`) | stat + `git log -- upload/private_key.txt` = never tracked |

**Exposure window**: lower-bound = 2026-10-18/19 (literal creation/git entry). True origin is earlier — the
keys were in active use from Aug 2026 — but git history is squashed from 2026-10-19, so pre-baseline
exposure is **UNVERIFIABLE from the repo**. Treat the window as [≥2026-08-07 (C-045-a) / ≥2026-09-06
(C-045-b) … present].

## 4. Copies census (where the material exists — and does not)

| Surface | Result |
|---|---|
| Working tree (2,412 files; byte-level exact-literal scan incl. binaries) | EVM literal: `scripts/verify-key-and-audit-roles.ts:5` **and `worklog.md:4648`** (a prior audit agent quoted the plaintext in the append-only log). Solana literal: **6 script files** (`verify-hex-key.ts:5`, `solana-create-fresh.ts:12`, `solana-create-umi.ts:8`, `solana-create-with-metadata.ts:11`, `solana-set-metadata.ts:7`, `solana-set-metadata-v2.ts:21`). NO other hits; no base58 secrets; no keypair JSON arrays; `.env` holds only `DATABASE_URL` (file path); `.env.example` holds dummies |
| Git history | **BOTH literals present in ALL 24 commits** (EVM in 2 files, Solana in 6, per `git grep -F` per commit). History rewrite is required for purge |
| `db/custom.db` (SQLite) + `dev.log` | byte-level exact scan: **NO hits** — keys never leaked into app DB or dev-server logs |
| `upload/private_key.txt` | ABSENT (deleted; deletion time UNVERIFIED); never git-tracked |
| Known-benign hex64 matches | OZ role-hash constants (public) — classified and excluded; base64 image data in design templates — excluded as false positives |
| Remote surfaces (Turso backups, remote repos) | **UNVERIFIED** — out of census reach; owner must check any remote clone/backup/CI cache and rotate any token that ever saw this repo |

## 5. Containment, revocation and rotation plan (PREPARED ONLY — nothing executed)

See D7 rows **K-1…K-7** (repo purge → history rewrite + credential rotation → sequenced EVM key rotation
behind a reconfigured 4/7 Safe → Solana 4saT rotation + old-mint authority settlement → DbFjz hygiene →
conformant Solana redeploy decision → canonical address book adoption). Every on-chain step is a
**transaction plan awaiting explicit human approval**; sequence risks are documented there.

**Honored constraints:** the key was not published; it was not placed in any new configuration file; it was
not used for any remediation; no rotation/transaction/privilege change was performed under this task.

## 6. Register impact

- C-045 is **upgraded from "potentially exposed material" (Task 9 wording) to CONFIRMED REAL, two keys**.
- OD-35 (single-key Safe) and the single-key-control findings are now **aggravated**: the single controlling
  key is itself exposed in-versioned-history. Gate 2 evidence updated (D8) — status unchanged: FAIL.
- No other register item is downgraded; C-041/42/43/44/46/47/49 all remain OPEN and are re-asserted.
