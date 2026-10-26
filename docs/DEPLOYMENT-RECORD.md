# DEPLOYMENT-RECORD — OD-36 Repository Access and Deployment Record

| | |
|---|---|
| **Mandate ref** | Ext-3 Part D **OD-36** — "Repository access and deployment record: repo URL, branch, commit hash of deployed contracts, foundry.toml/hardhat config, test suite status, deployment scripts, CI/CD, prior audits." |
| **Compiled** | 2026-10-19 (UTC) by the Ext-3 closure task (3-d). Every value below was observed directly in this sandbox on that date; nothing is copied from prior claims without re-verification. |
| **Scope** | FACTUAL record only. This document does not claim production readiness; production reserve trading remains NOT AUTHORIZED (OD-1/OD-2 open; Gate 5 blocked). |
| **Related** | `audit-work/v5/T01-T88-RECONCILIATION.md` (T-80 companion deliverable) · `audit-work/v5/SAFE-VERIFICATION.md` (OD-35/T-87 evidence) · `contracts/TOKEN-STANDARD.md` (OD-37/T-88 evidence) · `src/lib/mtq/oracle-feeds.ts` (OD-34/T-86 evidence) |

> **ADDENDUM 2026-10-26 (Task 35 — owner directive "check against what we have
> and only keep what is needed").** This record is a point-in-time snapshot
> observed 2026-10-19 and is preserved verbatim below. Supersessions since that
> date, so no section below is read as current state:
> **(1)** the 2026-10-24 owner-directed registry cleanup removed the Robinhood
> Chain (46630) suite and the Base/Arbitrum placeholders and pruned
> `contracts/deployments/` to the single retained upgrade-path record
> `MTQSigmaV2-PENDING.json` — the §3.4 deployment JSONs (and the
> `Monad-Testnet.json` the OD-35 RPC correction referenced) are therefore no
> longer on disk (recoverable from git history); **(2)** §1.2's "no remote
> hosting configured" is superseded — the repo is hosted on GitHub
> (`MITHQALMTQ/MTQ_SIGMA`, branch `main`) with CI, a nightly Turso backup
> workflow, and Vercel auto-deploy on push; **(3)** the dead-RPC carriers
> flagged by v6 D-6 open claim #17 / R-15 (`scripts/deploy.ts`,
> `scripts/verify-deploy.ts`, `scripts/audit-chains.ts`, plus other superseded
> one-off scripts) were removed 2026-10-26, closing that claim — §4
> script-inventory rows for removed scripts are historical. The current
> deployed estate is carried ONLY by the authoritative "WHAT YOU HAVE NOW"
> registry: `src/lib/mtq/contracts.ts` (Monad Testnet 10143 · Arc Testnet
> 5042002 · Solana devnet) + `src/lib/mtq/roles.ts` (AccessControl role
> hashes, owner query set, cast-command reference).

---

## §1 Repository state

### §1.1 Commit hash and branch (observed 2026-10-19)

```
$ git log --oneline -3
c6ec946 Ext-3 v5.3 mandate implementation: MASE 8-term objective + adaptive softmax ensemble (mase.ts), 7-step genesis reference (genesis.ts), mandate shadow layer with Listings C-1..C-5 + J(s) + five clocks + EIP-712 decisions + commit-reveal (mandate.ts), consolidated registers OD-1..38 / C-001..040 / T-01..88 (mandate-register.ts), /api/mandate + MandateCompliance UI, policy documents (ROLE_ROTATION, UPGRADEABILITY, SECURITY, MANDATE-COMPLIANCE)
48a858f 74055d9d-ab08-4f40-9a13-b64bb72482f4
da29ef0 7f5a1285-8359-4b2c-ad13-f03672e61346
```

- **HEAD (baseline for this record): `c6ec946afcebf641ca62c6018d54d6bd348f08c8`** (short `c6ec946`) — the Ext-3 v5.3 mandate-implementation commit. **No later commit was observed on 2026-10-19**; the Ext-3 session work (Tasks 3-a/3-b/3-c and this record) is present as *uncommitted working-tree changes* (§1.3).
- **Branch: `main`** (`git branch -a` shows only `* main` — no other local branches).
- **Commit hash of the *deployed* contracts:** the on-chain deployments recorded in `contracts/deployments/*.json` predate the git history available in this sandbox (deployedAt timestamps 2026-09-05/09-06). The repo's git history does **not** reach back to a commit that can be tied to those deployment transactions; the deployment JSONs (§3) + live on-chain reads (audit-work/v5/SAFE-VERIFICATION.md, 2026-10-19) are the authoritative deployment evidence. This gap is recorded honestly per OD-36 ("Confirm commit hash of deployed contracts" — not confirmable from this repo's history).

### §1.2 Repo URL / remote

- **`git remote -v` returns EMPTY — no remote hosting is configured.** There is no GitHub/GitLab org, no repo URL, and therefore no clone path other than this sandbox machine. Recorded honestly: "no remote hosting configured."
- The register's OD-36 note (mandate-register.ts) still reads "Local repo single-commit fb6bb6c" — **stale**: the observed HEAD is `c6ec946` and the repo contains multiple commits. Recorded as a discrepancy; the register is the orchestrator's to update (not edited here).

### §1.3 Working-tree status (uncommitted, 2026-10-19)

```
$ git status --short
 M ROLE_ROTATION.md
 M contracts/MTQSigmaV3.sol
 M src/app/api/mandate/route.ts
 M src/components/mtq/MandateCompliance.tsx
 M src/lib/mtq/contracts.ts
 M src/lib/mtq/genesis.ts
 M src/lib/mtq/mandate-register.ts
 M worklog.md
?? audit-work/v5/
?? contracts/TOKEN-STANDARD.md
?? contracts/out-v3/
?? scripts/verify-safe.ts
?? src/lib/mtq/oracle-feeds.ts
```

These are the Ext-3 session deliverables (Tasks 2, 3-a, 3-b, 3-c + register fold-ins) awaiting commit by the project owner. `docs/DEPLOYMENT-RECORD.md` and `audit-work/v5/T01-T88-RECONCILIATION.md` (this task) join them uncommitted.

### §1.4 CORRECTION NOTICE — v5.0 §1.4 "reported 4/7" Safe configuration (supersedes the recorded posture)

> **v5.0 §1.4 recorded "reported 4/7" Safe configuration — DISPROVEN by on-chain verification 2026-10-19 (threshold=1, sole owner=deployer EOA); the production security finding stands; see `audit-work/v5/SAFE-VERIFICATION.md`.**

Reads performed on BOTH chains (Monad Testnet block 72,421,819; Arc Testnet block 68,031,046; read-only `eth_call`/`eth_getCode`/`eth_getStorageAt`): the Genesis Reserve Safe `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` is a genuine Safe v1.4.1 proxy, **but `getThreshold()` = 1 (expected 4) and `getOwners()` = [deployer EOA `0x3C39…8d8c`] (expected 7 signers)** — a 1-of-1 deployer-controlled Safe, nonce 0, zero modules, guard = address(0). OD-35 = VERIFIED-FAILED (critical finding); Gate 5 remains blocked. Any prose in older documents that describes this Safe as "4/7 multi-sig" is a *reported* claim, not a verified one, and is disproven as of 2026-10-19.

### §1.5 .gitignore posture

`.env` / `.env.local` / `.env.*.local` are excluded (secrets posture: `.env.example` committed with dummy values only). Live-written runtime artifacts are excluded by the 2026-10-19 hardening block: `db/*.db`, `db/*.db-journal`, `db/*.db-wal`, `db/*.db-shm` (engine/keeper SQLite), `.zscripts/dev.pid`, `dev.log`, and the transient `tool-results/` cache. CI-artifact lines from earlier plans also present: `weight-vector.json` ("CI uploads as artifact", TASK-5) and `backups/` (TASK-9 Tururso backups) — see §6 for why those CI plans are not operative. Sandbox exclusions: `/skills/`, `screenshots/`, `agent-ctx/`, `upload/*.txt`/`upload/private_key.txt` (never commit key material). Solidity test dirs are explicitly re-allowed (`!contracts/test/`, `!contracts/test/**`) against the blanket `test` ignore.

---

## §2 Toolchain and build configuration

### §2.1 `contracts/foundry.toml` (canonical; for the protocol owner's Foundry environment)

- `[profile.default]`: `src = "."`, `out = "foundry-out"`, `libs = ["lib"]`, **solc `0.8.20`**, **optimizer on, `optimizer_runs = 200`**, **`via_ir = true`**.
- **remappings**: `"@openzeppelin/=lib/openzeppelin-contracts/"`, `"forge-std/=lib/forge-std/src/"`.
- Fuzz: `runs = 256`, `max_test_rejects = 65536`; `[profile.ci]` fuzz `runs = 1024`.
- Header records honestly: **this sandbox does NOT have Foundry installed (no `forge` binary)** — `contracts/MTQSigmaV2.t.sol` cannot be compiled here; the test file is source-ready for the protocol owner's Foundry environment.
- `foundry.toml.example` is the earlier template for the same suite (src = "contracts", solc 0.8.20, optimizer 200, via_ir true, forge-std remapping only) with P1/P2 constructor prerequisites for MTQSigmaV2.sol noted in its header.

### §2.2 solcjs 0.8.36 compile pipeline for MTQSigmaV3 (`contracts/out-v3/`)

The sandbox truth (per `contracts/TOKEN-STANDARD.md` §6): solcjs ships with the `solc` npm dependency (`^0.8.36`, package.json) at `/home/z/my-project/node_modules/.bin/solcjs` → **`0.8.36+commit.8a079791.Emscripten.clang`** (not on PATH).

Commands (verbatim from TOKEN-STANDARD.md §6):

```
# Plain CLI (creation bytecode only — solcjs CLI has no --bin-runtime/--via-ir flags):
cd /home/z/my-project/contracts/out-v3
/home/z/my-project/node_modules/.bin/solcjs --bin --abi --optimize --optimize-runs 200 ../MTQSigmaV3.sol -o .
# → NO compile errors (exit code 2 is solcjs treating the EIP-170 size WARNING as failure-to-zero-warnings)

# Canonical standard-JSON harness (replicates foundry.toml: optimizer 200, via_ir=true, shanghai EVM):
node compile-standard.mjs ../MTQSigmaV3.sol v3-permit-votes 200 true shanghai
# → solc errors: 0, warnings: 1 (code size)
```

**Bytecode sizes (EIP-170 deployed-runtime limit 24,576 B):**

| Build | Creation | Deployed | vs 24,576 |
|---|---|---|---|
| MTQSigmaV2 (recorded baseline) | — | 22,627 | within |
| V3 pre-token-standard (solcjs 0.8.36, opt 200, viaIR, shanghai) | 38,023 | 36,706 | **exceeds by 12,130 (pre-existing)** |
| V3 with EIP-2612 + ERC20Votes | 42,018 | **40,411** | **exceeds by 15,835** |
| **V3 + Ext-3 A.3 on-chain `verifyIndexBase()` view (this session)** | 42,114 | **40,500** | **exceeds by 15,924** |
| V3 with, opt runs=1 | 41,691 | 40,084 | exceeds by 15,508 |
| V3 with, cancun | 41,925 | 40,318 | exceeds by 15,742 |
| V3 with, no viaIR | 48,506 | 46,982 | exceeds by 22,406 |

Net permit+votes cost +3,705 B; net Ext-3 A.3 `verifyIndexBase()` view cost +89 B. **EIP-170 FLAG: V3 cannot deploy as a single contract on EIP-170-enforcing chains (committee must split modules); the pre-existing body, not the token standard, is the dominant size driver.** `contracts/foundry-out/MTQSigmaV3.sol/MTQSigmaV3.json` is STALE (predates the token-standard insertion) — re-run `forge build` before any V3 deployment. Artifacts: `contracts/out-v3/{compile-standard.mjs, eip712-verify.cjs, v3-baseline-result.json, v3-final-result.json, v3-permit-votes-result.json, v3-permit-votes-runs1/-cancun/-noviair-result.json, v3-verifyindexbase-result.json, CLI _bin/_abi outputs}`.

### §2.3 `package.json` scripts relevant to tests/db (Next.js 16.1.1 / React 19 / ethers 6.17 / solc 0.8.36 / Prisma 6 + libsql)

| Script | Command | Notes |
|---|---|---|
| `dev` | `next dev -p 3000 2>&1 \| tee dev.log` | dev server (running; not restarted by this task) |
| `build` | `next build` + standalone copy | NOT run in this task (per protocol) |
| `lint` | `eslint .` | result in §4 |
| `typecheck` | `tsc --noEmit` | result in §4 |
| `test` | `bun test` | generic bun runner (the MTQΣ suites are run directly, see §4) |
| `test:backtest` | `bun run src/lib/mtq/__tests__/historical-backtest.ts` | Layer 6 suite |
| `db:push` / `db:generate` / `db:migrate` / `db:reset` | prisma workflows | local SQLite (`db/*.db`, git-ignored) |
| `check:no-neon` | `bun run scripts/check-no-neon.ts` | guardrail against the removed Neon dependency |

---

## §3 Deployed-contract inventory (per chain)

Deployer for every recorded deployment: `0x3C3932F865892EFabE45892f453f81B64f6c8d` (`DEPLOYER_WALLET`). All deployments are TESTNET deployments provided by the protocol owner.

### §3.1 `contracts/deployments/Monad-Testnet.json` (chainId 10143, deployedAt 2026-09-06T14:07:45Z)

| Contract | Address | Deploy tx |
|---|---|---|
| MTQSigma | `0x5D9564C27111EA65Da3228a79833F0FF129bfd4a` | `0x89c47bb8aa1950a0077703056ec7013bc5bf6b8795ba0cbca17e023cf8fe26b0` |
| MockUSDC | `0x28a2f9812BeC1252eee3992D56e5Bbd51393d6DE` | `0x212da690728c621d44e69b00d3906427459413187ff9a531e96b60b877c576a9` |

Genesis read-back: supply 1,000,000 / circulating 0 / reserve 1,100,000 USDC; gfb 1.0, price 1.0.

### §3.2 `contracts/deployments/Arc-Testnet.json` (chainId 5042002, deployedAt 2026-09-05T18:22:32Z)

| Contract | Address | Deploy tx |
|---|---|---|
| MTQSigma | `0x826b82F79FD6c5347cDC568B1d0A7918128B63c1` | `0xd9accce91d487f76bda3c854ec0349debe775f87e32010ffefaa6540e2f9c45b` |
| MockUSDC | `0x334D14E7E39e1f02a60fc1169CdF7b0BEDE30dEb` | `0xd383189a42caf814cd14b9c8212b9257e8fe00d3a02b1e6108a80ef90ef66363` |

Same genesis read-back shape (1,000,000 / 1,100,000).

### §3.3 `contracts/deployments/Monad-Testnet-Ecosystem.json` (deployedAt 2026-09-06T15:43:34Z) and `Arc-Testnet-Ecosystem.json` (15:45:03Z)

Nine-contract ecosystem per chain (MTQToken, Governance, Safe, AlgorithmEngine, ReserveVault, MintContract, RedeemContract, Oracle, Takaful, MockUSDC) + role records (DEFAULT_ADMIN = deployer; MINTER on Mint; PAUSER on "Safe"):

| Entry | Monad (10143) | Arc (5042002) |
|---|---|---|
| MTQToken | `0x0Ac20360234b4C988a19586CBe55733e18A5982f` | `0x24203404B9b971C907e8Ced96106Fa74380d9897` |
| Governance | `0xc9C7867f54d11B31B0548ac04FfB9a39d5e83aE6` | `0xc7936C2E5e81534584C242f5088302D452510DA7` |
| **"Safe"** | `0x74353601354c0b71df5B16Fe1B28c7F0831dd316` | `0xDfcA66ac0450C9AB86307af1942E157C5A4DB713` |
| AlgorithmEngine | `0x26eD20C6233fAEeBc1635aD08686f6E79a334a21` | `0x3eC27BB283644eF0A98B9961E9FBED0583a02f19` |
| ReserveVault | `0xC472c5122B07935C66b1Ca956456e7574eae11bF` | `0x5EDb5e9d65691b654c906869dFFF2a6B9279c499` |
| MintContract | `0x4deA71BdB5Af2ce76e34c2AccA815855Af36A5fA` | `0x28a2f9812BeC1252eee3992D56e5Bbd51393d6DE` |
| RedeemContract | `0x1E52e1B8bD21183849e3e57B1d81100480E62148` | `0x5D9564C27111EA65Da3228a79833F0FF129bfd4a` |
| Oracle | `0x14Ee68E52F7d1c8C223225BD9a9A42dB6Ded8841` | `0x6b92c14458Ed7ed26E154F84947c7dFDc8C49d72` |
| Takaful | `0xC8aEdE4b4A29C365f19D1B6CE3BdfBa0F636B203` | `0x2CE0c1DD602a5314d406D0E030780f3D6c56C183` |
| MockUSDC | `0x9de7C1e69B386A8Df8B6E8Ef3ce8BA73C22F43D5` | `0xc881D58df7Dddb29BC2Da05363D04974896285B6` |

### §3.4 `contracts/deployments/Robinhood-Chain-Testnet.json` (chainId 46630, deployedAt 2026-09-06T13:49:17Z) + `-Ecosystem.json` (15:27:26Z)

- MTQSigma `0xA3B89FfdE28577A7D30E2c22503dB33509044EF0` (tx `0xfda3f6b4…d7d14`), MockUSDC `0xFd2B8d176bf059287638Db30D02C6651dA02861e` (tx `0x0066b178…bf022`); genesis read-back 1,000,000 / 1,100,000.
- Ecosystem: MTQToken `0xAF5B85658d074e071BbF392395a2ddA9B644C5A5` (canonical:true), Governance `0x80FF03DA…32B56`, "Safe" `0xa3CE28A1…75691`, AlgorithmEngine `0x8C012fC9…c9244`, ReserveVault `0x5929cBEb…67d6e`, Mint `0xeF3290d0…D084` (funded 1,100,000 USDC), Redeem `0x3aCE703d…8ac44`, Oracle `0x02D9531A…6A9F`, Takaful `0x1bbCd78E…6177`, MockUSDC `0xE842f1F4…2942`. Roles: DEFAULT_ADMIN deployer; MINTER on Mint; PAUSER on "Safe".

### §3.5 `contracts/deployments/MTQSigmaV2-PENDING.json` — the V3 source record

Status `V3_SOURCE_READY_PENDING_DEPLOY`: contract MTQSigmaV2 (contractVersion 3), source `contracts/MTQSigmaV2.sol`, expectedAddress/deployTx/deployedAt all `null` — **NOT deployed**. Compile verification: solcjs 0.8.36, viaIR=true + optimizer 200 → deployed 23,220 B / creation 24,046 B (headroom 1,356 B under the 24,576 Spurious-Dragon limit), 240 ABI entries. 21 post-deploy steps enumerated (reserve vault → genesis reserve → genesisMint → asset registry → 3 oracle adapters → KEEPER/ORACLE/PAUSER/ADMIN roles → 4 governance councils → bootstrap holdings → seedGenesisWeights → genesisIndex → live FX/index/weights/state/governance flows). Honest-status expectation 0x7FF (all 11 v1.0 bits) vs the v1.2 Pilot's 0x400.

### §3.6 Reconciliation against the live chains (OD-35 / T-87 / C-041 / C-042 evidence)

Full evidence: `audit-work/v5/SAFE-VERIFICATION.md` §4 + `audit-work/v5/safe-verification.json` (reads 2026-10-19, Monad block 72,421,819 / Arc block 68,031,046). Cross-checked against `src/lib/mtq/contracts.ts` (which now carries the verified-presence notes on each row):

1. **THREE live MTQ tokens exist per chain** — one per conflicting repo record:
   - v5.0 §5.1 record (`0x9e6EdC15…53aD` Monad / `0x237c3Aa2…6601` Arc): live token named **"MITHQAL"** (supplies 310.949 / 1,000).
   - `CANONICAL_MTQ_ADDRESSES` + Ecosystem-JSON record (`0x0Ac2…982f` / `0x2420…9897`): live **"MTQΣ"**, identical 3,413-B bytecode prefix and identical supply 1,000,000.00000001998 on both chains — the only record that is the same contract cross-chain.
   - deployment-JSON record (`0x5D95…fd4a` / `0x826b…63c1`): live token (name "MTQΣ" on Monad / "MTQ Sigma" on Arc; supplies 1,012,987 / 1,005,889 — different deployments).
   Governance must declare the canonical MTQ contract before role rotation (T-35/T-87 prerequisite).
2. **The Ecosystem-JSON "Safe" entries are NOT Safes**: `0x7435…d316` (Monad) and `0xDfcA…B713` (Arc) share identical 3,321-B bytecode and revert on **all seven** Safe-interface reads (0/7) on both chains.
3. **Cross-chain address contaminations** (same hex, different contract): `0xDfcA…B713` = 5,273-B Monad "Oracle" vs 3,321-B Arc "Safe"-claim; `0xE35a…Bd66` = 25,819-B Monad vs 13,129-B Arc "Governance"; Arc Oracle `0xFd2B…861e` shares its hex with Robinhood MockUSDC; Monad Reserve `0x1bbC…6177` shares its hex with Robinhood Takaful.
4. **The ONE genuine Safe in any repo record is the Genesis Reserve Safe `0xE718…A7D0`** — and per the 2026-10-19 verification it is **1/1 deployer-controlled** (threshold 1, sole owner = deployer EOA, Safe v1.4.1, nonce 0, no modules, guard = address(0)), **not the mandated 4/7** — see §1.4 correction notice. OD-35 = VERIFIED-FAILED; Gate 5 blocked.
5. `contracts.ts` verified-presence notes (2026-10-19): Monad Oracle code present (5,273 B), Arc Oracle code present (2,601 B) — ABIs unpublished, feed contents real-vs-mock UNDETERMINED (OD-34); all other probed addresses have live code (see SAFE-VERIFICATION.md §4 tables). `src/lib/mtq/onchain-test-results.json` additionally records the September 2026 on-chain invariant reads (decimals 18, Σ-brand name, ADMIN/MINTER/PAUSER roles on deployer, not paused, supply > 0 per chain).
6. Solana devnet: SPL token `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4` recorded in `contracts.ts` (~18.44 test balance, 10B cap); canonical map lists `2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY` — a further address-record divergence, deferred-G7 (OD-9).

---

## §4 Test-suite status (run 2026-10-19 15:38–15:40 UTC, this sandbox, alongside the live dev server + keeper)

All suites are EXISTING suites; no test code was written or modified by this task. Commands, exit codes, exact counts, wall-clock durations:

| # | Command | Result | Duration | Timestamp (start) |
|---|---|---|---|---|
| 1 | `bun run src/lib/mtq/__tests__/canonical-invariants.ts` | **exit 0 — 250/250 pass, 0 fail** (L1 41/41 · L2 42/42 · L3 25/25 · L4 12/12 · L5 29/29 · L6 3/3 · L7 7/7 · L8 91/91; S5/S6 survival 100%, S3 38.5%; VERDICT: ALL TESTS PASSED) | 0.757 s | 15:38:43Z |
| 2 | `bun run src/lib/mtq/__tests__/mandate-vectors.ts` | **exit 0 — 66 passed, 0 failed** ("ALL MANDATE VECTORS PASS") | 0.101 s | 15:38:49Z |
| 3 | `bun run src/lib/mtq/__tests__/e2e-integration.ts` | **exit 0 — 26/26 checks passed, 0 failed** (full mint→advance→redeem cycle + stress + recovery + oracle-pause path; RR invariant held) | 1.020 s | 15:38:57Z |
| 4 | `bun run src/lib/mtq/__tests__/stress-rerun.ts` | **exit 0 — 11/11 scenarios pass, 0 fail** (S1–S11 targets all met; runtime 3,362 ms in-suite) | 3.467 s | 15:39:05Z |
| 5 | `bun run src/lib/mtq/__tests__/historical-backtest.ts` | **exit 0 — PASS: all 5 Layer 6 invariants held across 2,562 trading days** (INV-1 min RR 1.076; INV-2 in-band 100%; INV-3 max EMERGENCY streak 0; INV-4 valid ticks 100%; INV-5 max divergence 8.2243%) | 2.687 s | 15:39:18Z |
| 6 | `bun run src/lib/mtq/__tests__/audit-retention-test.ts` | **exit 0 — TEST PASSED** (prune loop: RebalancingDecision capped at 10,000; 4,410 rows pruned over 5 iterations; cleanup restored live state: 2,410 rows; DSV 207 / OracleSample 1,242 intact) | 3.115 s | 15:39:25Z |
| 7 | `bunx tsc --noEmit` | **exit 0 — 0 errors** | 3.426 s | 15:39:34Z |
| 8 | `bun run lint` | **exit 1 — 2 errors, 0 warnings (VERBATIM, not fixed per task boundary):**<br>`contracts/out-v3/eip712-verify.cjs:1:14 — error A require() style import is forbidden @typescript-eslint/no-require-imports`<br>`scripts/verify-safe.ts:898:10 — error A require() style import is forbidden @typescript-eslint/no-require-imports` | 18.987 s | 15:39:40Z |

**Notes on §4:**

- canonical-invariants currently reports **250** checks (the task brief estimated ~248 — recorded as observed). Layers 6 and 7 of that suite are respectively the documented-pointer block (§23.2 runnable / §23.3–§23.4 documented) and the fixed-seed S5/S6/S3 stress re-runs; the full historical replay lives in the separate historical-backtest.ts (row 5).
- The two lint errors are introduced by **untracked artifacts of this Ext-3 session** (`scripts/verify-safe.ts` from Task 3-a; `contracts/out-v3/eip712-verify.cjs` from Task 3-b) — the repo's `lint` was clean at the c6ec946 baseline (Task-2 worklog: "eslint 0 errors"). Recorded verbatim; resolution (eslint override or import-style fix) is left to the orchestrator/project owner. Neither file is imported by the app runtime (`eip712-verify.cjs` is a standalone verification utility; `verify-safe.ts` is a standalone read-only script).
- Foundry suite (`contracts/MTQSigmaV2.t.sol`, `contracts/test/MTQSigmaV3.t.sol`): **cannot run in this sandbox** (no `forge`); source-ready for the protocol owner. The September 2026 JS-mirror on-chain fuzz harness result is preserved at `src/lib/mtq/onchain-test-results.json` (fuzz 5,000-run math/conservation/pause/over-redeem checks + read-only per-chain invariant reads — all passed at generation time 2026-09-07).

---

## §5 Deployment-scripts inventory (honest labels)

Per `ROLE_ROTATION.md` §10: the older scripts read `DEPLOYER_PRIVATE_KEY` from `.env` and **predate the v5.0 §4.6 signing-method rules** — they are retained as *prior testnet-rehearsal evidence only* and must not be invoked with an unmanaged key for production-adjacent operations. No production-signed deployment is authorized from this sandbox.

| Script | What it does | Honest label |
|---|---|---|
| `scripts/deploy.ts` (151 L) | solcjs-compile + deploy MTQSigma to hoodi/sepolia/arc/monad; reads `DEPLOYER_PRIVATE_KEY` from `.env`; notes the dead monadvision RPC in its chain table | **Testnet rehearsal tooling; production-unfit** (pre-§4.6 signing rules; stale Monad RPC entry; produces MTQSigma v1.x deployments) |
| `scripts/deploy-v3.ts` (464 L) | Deploys MTQSigmaV3 + 3 oracle adapters (Chainlink/Pyth/Chronicle) + wiring + pilot-bank authorization + feeWallet + stability-pool asset + verification; dry-run mode when keys absent; requires ORACLE_ROLE | **Prepared but NEVER RUN for V3** — MTQSigmaV2-PENDING.json still `expectedAddress: null`; pre-§4.6 signing rules |
| `scripts/deploy-ecosystem.ts` (193 L) | One-chain-at-a-time 9-contract MITHQAL ecosystem deploy (robinhood/monad/arc) + role grants; reads `DEPLOYER_PRIVATE_KEY` from `.env` | **Testnet rehearsal tooling; production-unfit** (pre-§4.6; produced the 2026-09-06 Ecosystem JSONs — whose "Safe" entries are now proven NOT Safes, §3.6) |
| `scripts/deploy-oracle-adapters.ts` (270 L) | Deploys the 3 real oracle adapters + wires setOracleAdapter (the "B4 fix"); requires ORACLE_ROLE | **Prepared; adapters compiled-NOT-deployed** (per OD-34/T-86: `contracts/adapters/*.sol` exist, no deployment record) |
| `scripts/transfer-ownership.ts` (225 L) | Ownership-transfer rehearsal: DEFAULT_ADMIN→Constitutional Safe, PAUSER→Emergency Safe, KEEPER/ORACLE, 4 councils, renounce deployer admin, verify | **Rehearsal procedure; BLOCKED as live action** — ROLE_ROTATION.md §8: rotation blocked until the Safe is reconfigured to genuine 4/7; pre-§4.6 signing rules |
| `scripts/audit-fix-roles.ts` (67 L) | Audits/grants MINTER-on-Mint + PAUSER-on-Safe for the two §1.1 MTQ deployments; reads `DEPLOYER_PRIVATE_KEY` from `.env` | **Testnet rehearsal tooling** (ROLE_ROTATION.md §10 explicitly retains it as prior evidence only) |
| `scripts/verify-safe.ts` (912 L) | **NEW (Task 3-a, this session)** — read-only OD-35 verification: chainId assert, blockNumber, 7 Safe view reads (both guard selectors), storage-slot reads, 19 code probes + ERC-20 reads; 3-attempt retry; writes `audit-work/v5/safe-verification.json`; NO transactions/keys/signing | **Read-only evidence script — SAFE to run anywhere; re-run after any Safe reconfiguration** (expected verdict for closure: VERIFIED 4/7) |
| `scripts/run-onchain-tests.ts` (74 L) | 7 fuzz families (5,000 runs each, local JS mirrors) + read-only per-chain invariant reads (name/decimals/supply/roles/paused) on the 3 EVM testnets; writes `src/lib/mtq/onchain-test-results.json` | **Read-only on-chain harness** (reads .env key but never signs/broadcasts); last recorded run 2026-09-07 |
| `scripts/onchain-tests.ts` (261 L) | Invariant/fuzz test harness (solcjs + ethers): deploys fresh contracts to a local sim and runs mint/redeem/role/pause sequences checking INV-1..INV-8 | **Local simulation harness** (sandbox stand-in for Foundry invariant tests; not a live-chain test) |

---

## §6 CI/CD — honestly recorded

- **NO operative CI/CD exists.** `git remote -v` is empty (no GitHub/GitLab host), so no pipeline has ever executed and no run history exists.
- **Dormant workflow files are committed in-repo** (from earlier plans, never operative): `.github/workflows/{ci.yml, forge-tests.yml, backtest-nightly.yml, backup.yml, compute-engine.yml, keeper-heartbeat.yml}` and `.github/BRANCH-PROTECTION.md` (PR-gate + 2-approvals + CI-status rules to "enforce on GitHub Settings"). These describe CI plans for a hosted remote that was never connected; `ci.yml` triggers (push to `main`/`autonoma-integration`, PRs) cannot fire without a remote.
- The `.gitignore` likewise references CI artifacts from those earlier plans (`weight-vector.json` "CI uploads as artifact" — TASK-5; `backups/` Turso nightly — TASK-9): **these CI plans are not operative**; the artifacts are simply excluded from git.
- Consequence (recorded honestly): type-check/lint/test discipline currently rests on the manually-run suites in §4; branch protection and PR review described in `.github/BRANCH-PROTECTION.md` are NOT enforced anywhere. Connecting a remote + activating the workflows is a project-owner action (independent of Gate 5 but relevant to it).

---

## §7 Prior audits (in-repo audit trail; NO third-party security audit)

In-repo audit deliverables produced by internal review rounds (most recent first):

1. **Ext-3 closure work (current, 2026-10-19):**
   - `audit-work/v5/SAFE-VERIFICATION.md` + `safe-verification.json` — OD-35/T-87 live on-chain Safe verification (critical finding: 1/1 deployer-controlled; §1.4 above).
   - `contracts/TOKEN-STANDARD.md` + `contracts/MTQSigmaV3.sol` §1.b — OD-37/T-88 token-standard implementation evidence (EIP-2612 + ERC-20 Votes inline; solcjs 0.8.36 zero errors; EIP-170 flag).
   - `src/lib/mtq/oracle-feeds.ts` — OD-34/T-86 per-chain oracle-feed configuration registry (feed classes, staleness bounds, provider addresses, honest "existence-unverified"/unpublished-ABI labels; Arc USDC/USD = 1.0 by construction).
   - `docs/MANDATE-COMPLIANCE.md`, `ROLE_ROTATION.md`, `UPGRADEABILITY.md`, `SECURITY.md` (OD-16/OD-38 documents, pending Committee approval where noted).
2. **Equation-by-equation audit (audit-work/v3/):** `EQUATION-BY-EQUATION-AUDIT-REPORT.md` (353 L) + `IMPLEMENTATION-LOG.md` (119 L) + `test-evidence.md` (64 L) + `GOVERNANCE-DECISION-RECORDS.md` (217 L) + per-block trace files (trace-EQ-001-024/025-058/059-100/101-134/135-175, eq-by-eq-spec, blueprint-source-verification, NOMENCLATURE-MAP). All P0/P1/P2 findings from that round were implemented and verified by the canonical suite's Layer-8 audit-fix block (91/91 passing, §4).
3. **Master Blueprint v1.0 formal audit:** `audit-work/v2/MASTER-AUDIT-REPORT.md` (227 L) — verdict "PARTIALLY COMPLIANT — pilot-stage implementation…; **5 confirmed deviations found and fixed in this audit round** (D1–D5)", re-verifying the 14 deviations fixed in the prior Task-5 round; 13 disclosed pilot simplifications (P1–P13) enumerated.
4. **Earlier in-repo rounds:** `audit-work/DELIVERABLE-{A..J2}` set (implementation reconciliation, audit reconciliation, canonical state machine, mathematical closure, governance enforcement, test suite, stress rerun, historical backtest, honest-status evidence, Solidity test plan), `FINAL-TOP-TIER-AUDIT-REPORT.md`, `docs/{BANK-GRADE-AUDIT,CORRECTED-BANK-AUDIT,MAINNET-AUDIT-REPORT}.md`, `audit-{a,b,c,d}-*.md` static/stress/tokenomics reviews, `SHARIA-COMPLIANCE-NOTE.md`, `COO-RECOMMENDATIONS.md`, `COMPETITIVE-ANALYSIS.md`, `ui-audit/` browser-audit screenshots.
5. **Security-disclosure policy (not an audit):** `SECURITY.md` (OD-38, published with placeholder channel).

> **NO THIRD-PARTY SECURITY AUDIT HAS BEEN PERFORMED.** Every audit listed above is an internal review round conducted inside this repository. An independent external security review remains a **Gate 5 requirement** and has not been started. No production authorization is claimed or implied by this record.

---

## §8 OD-36 completion statement (honest)

OD-36 asked for: repo URL (§1.2 — none, no remote), branch (main, §1.1), commit hash of deployed contracts (§1.1 — deployments predate available git history; JSONs + live reads are the evidence; HEAD c6ec946 recorded), foundry/hardhat config (§2 — foundry.toml solc 0.8.20/opt-200/via_ir + the solcjs 0.8.36 pipeline; no hardhat config exists), test-suite status (§4 — 6 suites + tsc + lint, exact counts; lint failure recorded verbatim), deployment scripts (§5 — honest testnet-rehearsal labels), CI/CD (§6 — absent, dormant files recorded), prior audits (§7 — internal rounds only; no third-party audit). Gaps are named, not smoothed over: stale OD-36 register note (fb6bb6c), lint regressions from session artifacts, EIP-170 V3 size flag, stale foundry-out artifact, three-MTQ-token conflict, and the 1/1 Safe critical finding (§1.4).
