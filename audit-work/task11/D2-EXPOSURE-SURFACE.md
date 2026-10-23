# MTQΣ — TASK 11 · D2: EXPOSURE SURFACE (per key — repository, history, CI/CD, unresolved)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**
Census: `forensics-census-task11.ts` (2026-10-22) → `evidence/exposure-surface-census-task11.json`.
Byte-level exact-literal scan of every working-tree file; per-commit `git grep -F` of all
25 commits (patterns passed via stdin — see PI-3); CI/CD workflow inventory; env/db/log scans.
**No key material beyond redacted fingerprints appears below.** Nothing was deleted,
rewritten, or pushed during this census.

---

## 1. C-045-a — EVM deployer key (`0xdbe1…62d6`, 66 chars)

### 1.1 Where the literal exists TODAY (fresh census — counts identical to Task 10)

| Surface | Copies | Detail |
|---|---|---|
| Working tree | **2 files** | `scripts/verify-key-and-audit-roles.ts:5` (seed file) · **`worklog.md`** (a prior audit agent quoted the plaintext into the append-only log — Task 10 D1) |
| Git history | **25 / 25 commits** (Task 10: 24/24 — the Task 10 commit added one more) | reachable via `git grep -F` per commit from `fb6bb6c` (2026-10-19 00:09:46, squashed baseline) through `ad1e1cf` (2026-10-22 07:09, HEAD) |
| `.env` / `.env.local` | 0 | `.env` holds only `DATABASE_URL` (a file path); `.env.local` ABSENT |
| `db/custom.db` (5,689,344 B) | 0 | byte-exact scan clean |
| `dev.log` (3,097,693 B) | 0 | byte-exact scan clean |
| `CRITICAL-PRIVATE-KEY-ROTATION.md` | 0 | describes `upload/private_key.txt`; contains no literal |
| `upload/private_key.txt` | ABSENT | deleted from disk at unknown time; **never git-tracked** (`.gitignore:56`) |
| Git remotes | **NONE configured** | this machine has never pushed this repo — remote existence UNVERIFIED |
| AI-session transcript | **YES (PI-3)** | one failed `execFileSync` printed the argv containing the literal (this session, disclosed in D1 §5); no file received it. **[C11.1-01]** this row is a channel of the five-channel disclosure record — see `CORRECTIONS-REGISTER.md` §A for the per-channel statuses (access/retention/incident-review controls are owner-side; transcript evidence preserved, not purged) |

### 1.2 Exposure window

Lower bound **2026-10-18 09:33** (file mtimes of the literal-bearing scripts) / git entry
**2026-10-19 00:09** (baseline squash). True origin earlier: the key has been in active use
since **≥ 2026-08-07 12:03** (Arc estate creation receipts, Task 9). Pre-baseline exposure
(history before the squash) is **UNVERIFIABLE from this repository** — the window must be
treated as [≥ 2026-08-07 … present].

### 1.3 CI/CD and deployment-credential surfaces (repo-local inventory)

Six workflow files exist at `.github/workflows/` — **written for GitHub Actions**:

| Workflow | Full checkout | Uploads artifacts | Secrets referenced |
|---|---|---|---|
| `ci.yml` | yes | no | — |
| `backup.yml` | yes | **yes** (90-day artifact + git Release asset) | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `GITHUB_TOKEN` |
| `compute-engine.yml` | yes | yes | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |
| `backtest-nightly.yml` | yes | yes | `FRED_API_KEY` |
| `forge-tests.yml` | yes | yes | — |
| `keeper-heartbeat.yml` | no | no | `KEEPER_URL`, `DISCORD_WEBHOOK` |

**What this means:** IF a remote repository exists (owner must answer), then every push
exposed both literals to the hosting platform, and every workflow run that checked out the
repo (and every artifact/release it produced containing repo content) copied them further.
Four Turso-related scripts exist locally (`backup-turso.ts`, `migrate-turso.ts`,
`migrate-to-turso.ts`, `push-turso.ts`); whether any remote Turso database exists and ever
received repo-derived content is **UNVERIFIABLE from this sandbox**.

**Credential-rotation consequence (if any remote exists/ever existed):** rotate
`TURSO_AUTH_TOKEN`, regenerate `TURSO_DATABASE_URL` credentials, rotate `FRED_API_KEY`,
`DISCORD_WEBHOOK`, `KEEPER_URL`, and any GitHub/other PAT that ever touched the repo or its
Actions — in addition to the K-2 history rewrite. Treat every CI cache, artifact, release
asset, and clone as retaining the literals until proven otherwise.

### 1.4 Why deletion / history-rewrite does NOT invalidate the key

1. A secp256k1 private key is **self-authenticating data, not a reference**. Its power
   comes from signature verification against the chain's stored addresses — deleting every
   copy changes nothing about what the holder can sign.
2. **Copies cannot be proven absent.** The literal has been readable at HEAD, in 25/25
   commits, in a `worklog.md` that multiple agents read, and (if any remote exists) on
   unobservable systems. "We removed it" is unfalsifiable for an adversary copy.
3. History rewrite invalidates local clones' trust anchors and forces re-cloning — but the
   old commits can persist in: remote forks, CI caches (actions/cache, artifact
   retention), platform-level refs (GitHub keeps unreferenced objects; reflogs), backups,
   and anyone's local clone. BFG/filter-repo **reduce** exposure; they do not **zero** it.
4. Therefore the ONLY effective containment is **on-chain rotation** (D3): move every
   privilege off the derived address, then treat the key as a burnt, valueless artifact.
   Repo cleanup (K-1/K-2) is still mandatory — it stops ONGOING exposure of future
   material and shrinks the attacker window — but it is hygiene, not revocation.

## 2. C-045-b — Solana 4saT key (`58c19e…eb60`, 128 hex = seed‖pubkey)

### 2.1 Where the literal exists TODAY (identical to Task 10)

| Surface | Copies |
|---|---|
| Working tree | **6 files** — `scripts/verify-hex-key.ts:5` (seed), `solana-create-fresh.ts:12`, `solana-create-umi.ts:8`, `solana-create-with-metadata.ts:11`, `solana-set-metadata.ts:7`, `solana-set-metadata-v2.ts:21` |
| Git history | **25 / 25 commits** |
| `.env`, db, dev.log, upload/ | 0 / 0 / 0 / ABSENT |
| Derivation | seed‖pubkey consistent; derives exactly to `4saT…cA1d` (re-verified offline this session) |

### 2.2 What it controls (fresh, unchanged) — see D1 §6. Because the whole supply of the
superseded mint sits in its ATA and it holds SOL, the key remains **economically
live on devnet**, not merely administratively live.

### 2.3 Same non-invalidation logic (§1.4) applies verbatim: after purge/rewrite, the
on-chain authorities (`mintAuthority`/`freezeAuthority` of `2EaK5cQt…`) must be changed
(D4) or the key stays dangerous.

## 3. The seven containment categories (Task 11 §4 mapping)

| # | Category | C-045-a | C-045-b | Where planned |
|---|---|---|---|---|
| 1 | **Current-source cleanup** | purge 2 worktree copies (replace the `worklog.md` plaintext with an append-only redaction notice — never silently delete log history) | purge 6 script literals | D5 T-0.1/T-0.2 (K-1) |
| 2 | **Repository & Git-history remediation** | filter-repo/BFG strip from 25 commits; expire reflogs/objects; re-clone; **then** | same sweep | D5 T-0.3 (K-2) |
| 3 | **CI/CD, environment & deployment credentials** | rotate TURSO/FRED/DISCORD/KEEPER/平台 tokens **if** any remote ever existed; owner attestation of remote existence first | same | D5 T-0.4; D7 OWNER-ATT-1 |
| 4 | **EVM on-chain authority migration** | grant→Safe-B (4/7)→revoke sequence on Monad+Arc (+RH disposition) | n/a | D3 + D5 Phase 2/3 (K-3) |
| 5 | **Solana authority migration** | n/a | superseded-mint authority settlement + asset evacuation; (current-mint DbFjz decision reserved) | D4 + D5 Phase 4 (K-4/K-6) |
| 6 | **Asset & native-gas exposure** | Monad 0.224343224 MON + Arc 19.026597… native + ~100% both supplies + RH holdings — evacuation plans in D5 (move BEFORE or AT rotation; ordering risk documented) | 4.98368596 SOL + old-mint ATA — evacuate to owner-controlled destination (Squads after provisioning, or fresh single key as interim with disclosed weakness) | D5 T-3.8 / Phase 4 |
| 7 | **Independent post-remediation verification** | D8 test suite (roles FALSE ×15, Safe dossier, nonce freeze, fresh-clone scan, custody reconciliation) | D8 Solana tests (authorities per decision, balance zero, sig count frozen) | D8 |

## 4. Repository-wide collateral sweep status

| Artifact | Status |
|---|---|
| Other private-key formats (keypair JSON arrays, base58 secrets, mnemonics) | Task 10 census: none; worktree counts unchanged this session → no NEW material |
| Known-benign 64-hex hits | OZ role-hash constants (public values) — excluded by classification |
| `.env.example` | dummy values only (Task 10; file unchanged) |
| Prisma DB, dev server log | clean (re-scanned byte-level this session) |
| `mini-services/`, `examples/`, `mobile/`, `contracts/` | inside worktree scan scope — no exact-literal hits |

## 5. Remote systems that CANNOT be inspected from this sandbox (assigned UNRESOLVED — do not assume safe)

1. **Any remote git host** (GitHub/GitLab/other) — existence unknown (no remote configured; workflows imply intent to use GitHub).
2. **GitHub Actions caches/artifacts/releases** — exist only if (1) exists.
3. **Turso / remote database + its backups** — scripts exist; database existence unknown.
4. **Developer/owner machines and any clone made outside this sandbox** — unknown.
5. **The AI session transcript(s)** — PI-3: this session's terminal transcript received one argv-printed EVM literal; prior sessions that processed these files are outside this sandbox's auditability.
6. **`upload/private_key.txt` deletion time and any copy of it** — unknown (file absent, never tracked).

Each of these must be closed by **owner attestation + independent inspection**, and any
credential that touched them rotated. Until then, history rewrite alone must be presumed
insufficient and the on-chain rotation (D3/D4) remains the only robust containment.

## 6. Exposure-status summary (what changed since Task 10: **one additional commit-copy;
nothing else**)

- Both keys: **still REAL, still fully privileged, still in 2+6 worktree files and now 25/25 commits.**
- No negative evidence discovered anywhere; no surface cleaned; no rotation performed (correctly — none authorized).
- The only NEW exposure this session is **PI-3** (transcript argv leak), disclosed above.
