# D-1 — CORRECTED ACCEPTANCE REPORT + EVIDENCE BASELINE MANIFEST

**MTQΣ — Evidence Reconciliation and Pre-Remediation Control Directive (§2, §7.1)**
Controlled verification phase. **NOT ACCEPTED. No release gate advanced. No on-chain action authorized or performed.**

| | |
|---|---|
| **Date of this verification round** | 2026-10-19, 20:45–20:57 UTC (all fresh reads) |
| **Repo / branch / HEAD** | `/home/z/my-project` · `main` · `b68ccb8ebe9a95e24e5c44c4a98c06aae44d26aa` |
| **Working tree at verification start** | 7 modified files — **mode-only changes (0644→0755), content byte-identical to HEAD** (text: `git diff` = 0 insertions/deletions; PNGs: sha256 of working file == sha256 of git blob — verified). Machine record: `audit-work/v6/BASELINE-MANIFEST.txt` |
| **Git remote** | **NONE** (`git remote -v` empty) — see §7 |
| **Mandate source** | `audit-work/MTQ_SIGMA-unrtf.txt` — sha256 `ac9638200369d066d12e4e2d2b06e1cbeb3e1a0c5e88e3ad5c7cb287defb3a75` (matches the hash recorded in `CUSTODY-BALANCE-REVERIFICATION.md` §1) |
| **Mode of this round** | READ-ONLY ONLY on-chain (`eth_chainId`, `eth_blockNumber`, `eth_getCode`, `eth_getBalance`, `eth_call`(view), `eth_getLogs`, `eth_getStorageAt`); local test/compile runs. **No key read, nothing signed, no transaction broadcast, no state change, no asset moved.** |

---

## 1. Commit relationship `b24e7e0` ↔ `b68ccb8` — RESOLVED

| Commit | Date (UTC) | Role |
|---|---|---|
| `fb6bb6c` | 2026-10-19 00:09:46 | Baseline "single-commit history" (imports all sources, audit-work, foundry-out **including committed Foundry failure caches** — see §6.4) |
| `8d64e44`, `71ab4b7` | 00:53 / 01:59 | Master Blueprint v1.0 alignment + formal audit fixes |
| `d99d903`, `52eb089`, `da29ef0`, `48a858f` | 07:37–11:48 | UUID-titled checkpoint commits — **non-descriptive messages (traceability weakness, recorded in D-6)** |
| `c6ec946` | 15:07:25 | Ext-3 v5.3 implementation (mase.ts, genesis.ts, mandate.ts, registers OD/C/T, /api/mandate) |
| `a56646b` | 15:57:38 | Ext-3 final closure — OD-35 first Safe verification (**CRITICAL: 1/1, not 4/7**), OD-37 token standard inline, OD-34 oracle config, OD-36 deployment record, C-041/C-042 first registered |
| **`b24e7e0`** | **18:11:15** | **The "baseline" commit**: contains the verifyIndexBase V3 contract work (+49 lines → 40,500 B), `v3-verifyindexbase-result.json`, `SAFE-VERIFICATION.md`, `T01-T88-RECONCILIATION.md`, `safe-verification.json` (Gen-1 reads), oracle-feeds.ts. UUID-titled message `05d37e39-bf2e-49f8-8398-0a362e93c528` (content ≠ title — traceability weakness, D-6) |
| **`b68ccb8`** | **18:33:05** | **HEAD — the verification commit**: all documented suites re-run green **against the `b24e7e0` tree**; custody findings reproduced (Gen-2 reads); C-043 registered; `verify-safe-balances.ts`, `CUSTODY-BALANCE-REVERIFICATION.md`, `safe-balance-probe.json` added |

**Resolution:** `b24e7e0` is the *implementation/baseline state* and `b68ccb8` is the *verification evidence commit produced on top of it*. The prior session's claim "verification performed at `b24e7e0` (clean tree)" is correct for its run window (the verification artifacts were uncommitted at read time, then committed as `b68ccb8`). The current dirty state of the tree is **mode-only chmod residue from that session** — content is identical to `b68ccb8` (hash-verified, §0 above). This round's fresh reads therefore execute against content-identical `b68ccb8` state, with new evidence committed afterwards.

---

## 2. Evidence baseline manifest (machine-generated + verified)

Full machine manifest: `audit-work/v6/BASELINE-MANIFEST.txt` (git state + sha256 of 15 key files). Key values:

| Artifact | Value |
|---|---|
| `audit-work/MTQ_SIGMA-unrtf.txt` (mandate SSOT) | sha256 `ac9638200369d066d12e4e2d2b06e1cbeb3e1a0c5e88e3ad5c7cb287defb3a75` |
| `contracts/MTQSigmaV3.sol` (HEAD) | sha256 `37260565f86f5c7246060d16855707c9d883c801ee84b276925b1fa6e74d9aa3` (2,537 lines) |
| `contracts/MTQSigmaV2.sol` (HEAD) | sha256 `8efb0be0b3e84aa65c03ac05da7e31af16e178c3c6b26fcc1326642bb3db72e3` (1,622 lines) |
| `bun.lock` | sha256 `b55729abb10034a4a617c44c341f2c65055e47d5fb70b2e7b33397b1b5e61115` |
| Compiler (V3 pipeline) | solcjs `0.8.36+commit.8a079791.Emscripten.clang` · standard-JSON · optimizer on, runs=200 · viaIR=true · **evmVersion=shanghai** (default of `contracts/out-v3/compile-standard.mjs`; **evmVersion was NOT recorded in the committed artifacts — closed this round**, §4.2) |
| Foundry config (`contracts/foundry.toml`) | solc 0.8.20, optimizer 200, via_ir — **forge NOT installed in this sandbox; Foundry suite not runnable here** |

**Runtime bytecode hashes (NEW this round — committed artifacts recorded only byte counts):**

| Build (this round, reproducible) | deployed bytes | keccak256(deployed) | sha256(deployed) |
|---|---|---|---|
| `MTQSigmaV3` @ HEAD, shanghai/200/viaIR | **40,500** | `0x6b5cf853adcfbb0d57808a13e4eb141a6265858b5c8063327f1f2a354e80a03d` | `2f3e48f831df5f2708fcca6bb89f8bd05d49b4259c87326908d59f506c3c4a8d` |
| `MTQSigmaV3` @ `a56646b` (pre-verifyIndexBase) | 40,411 | `0xab15bb619e51466e26856d1d3cc0d778faa01819afbc10430e756d5459f94831` | `6ac85050…` |
| `MTQSigmaV3` @ `c6ec946` (pre-permit/votes), shanghai | 36,706 | `0xa0eec11945baf1f7c70ed81eee102d5a6b8bfeba16ae218ab5400c3e639ab16e` | `32e4e958…` |
| `MTQSigmaV3` @ `c6ec946`, **paris** (= the committed `v3-baseline-result.json`, adjudicated) | 38,152 | `0x2c793eee5346098959f07a17770c34facf9c9b1b0969b7c20695acf33ab4bd2f` | `e712977e…` |
| `MTQSigmaV2` @ HEAD, shanghai/200/viaIR | **24,894** | `0x7f3dd874d3628f6a4cf725242706613daa409b48645848dab7136cbdd4d92432` | `af83a09d…` |
| `MTQSigmaV2` @ HEAD, cancun/200/viaIR | 24,866 | `0x9c6ed2177ad17a52dbe9e32d560bedf85fd2c831d4c21fda1f27df66396e2388` | `c649baa9…` |
| `MTQSigmaV2` @ HEAD, shanghai/200/**no-viaIR** | 28,714 | `0x61c80a345bd49ea68fac86a71a41362345495d314ce9de2230987c86a5736edd` | `32143738…` |
| `MTQSigmaV2` @ HEAD, shanghai/**runs=1**/viaIR | 24,745 | `0xe57bf0d2131f4c53e35c8bda4cd3ace1508a8bb64cd2e0c25d8544b42f35936c` | `6d1fee9a…` |
| `MTQSigmaV2` @ HEAD, cancun/**runs=1**/viaIR | **24,718** | `0x0f9c28a7733f01c9b6d9f11a98b6cd5f690014d43662599611bd00292305404f` | `bf9843a8…` |

All via `node contracts/out-v3/compile-repro-hash.mjs <source> <contractName> <label> [runs] [viaIR] [evmVersion]` — scripts + JSON outputs committed under `audit-work/v6/compile-repro-*.json`, logs under `audit-work/v6/logs/`.

**Commit ↔ evidence mapping (which claim is evidenced at which commit):**

| Claim | Evidenced at | Evidence file |
|---|---|---|
| Safe 1/1 critical finding (first reads) | `a56646b` | `audit-work/v5/SAFE-VERIFICATION.md` + `safe-verification.json` (Gen-1: Monad 72,421,819 / Arc 68,031,046) |
| V3 = 40,500 B | `b24e7e0` | `contracts/out-v3/v3-verifyindexbase-result.json` (+ this round's repro: `compile-repro-verifyindexbase-repro.json`) |
| Suites green + custody reproduced + C-043 | `b68ccb8` | `safe-balance-probe.json` (Gen-2: Monad 72,458,443 / Arc 68,052,939), `CUSTODY-BALANCE-REVERIFICATION.md`, worklog |
| **All of the above re-verified fresh (Gen-3)** | **this round** | `audit-work/v6/logs/*` + refreshed `safe-verification.json` / `safe-balance-probe.json` / `onchain-test-results.json` (Gen-3 anchors below) |

**Stale / missing / inconsistent commit references found (full list in D-6):**
- `docs/DEPLOYMENT-RECORD.md` cites HEAD `c6ec946` (stale — two commits behind); oracle block anchors there are Gen-1.
- `docs/MANDATE-COMPLIANCE.md:54` still labels OD-35 "VERIFICATION-PENDING" (superseded by VERIFIED-FAILED in the register).
- `audit-work/audit-package/README.md` still cites `141/141`, `257/257` (superseded counts).
- Dead RPC `https://testnet-rpc.monadvision.com` persists in `scripts/verify-deploy.ts:70` / `scripts/deploy.ts`; divergent explorer URLs (`monadexplorer.com`) persist in audit scripts.
- `worklog.md:7181` describes the committed Foundry failure caches as "4 empty fuzz-failure marker dirs" — **the cache files are non-empty** (D-6 #7).

---

## 3. Re-run results at HEAD `b68ccb8` (this round, complete logs in `audit-work/v6/logs/`)

| Suite | Command | Result (fresh, 2026-10-19 ~20:45–20:57 UTC) | Prior claim @ `b68ccb8` |
|---|---|---|---|
| Canonical invariants | `bun run src/lib/mtq/__tests__/canonical-invariants.ts` | **250/250 PASS** (exit 0) | 250/250 ✓ reproduced |
| Mandate vectors | `bun run src/lib/mtq/__tests__/mandate-vectors.ts` | **66/66 PASS** (exit 0) | 66/66 ✓ |
| E2E integration | `bun run src/lib/mtq/__tests__/e2e-integration.ts` | **26/26 PASS** (exit 0) | 26/26 ✓ |
| Stress re-run | `bun run src/lib/mtq/__tests__/stress-rerun.ts` | **11/11 PASS**, S5 survival 100% (exit 0) | 11/11 ✓ |
| Audit retention | `bun run src/lib/mtq/__tests__/audit-retention-test.ts` | **PASS** (exit 0) | PASS ✓ |
| Historical backtest | `bun run src/lib/mtq/__tests__/historical-backtest.ts` | **PASS** — 5 invariants, 2,562 days, max divergence 8.22% — **caveat: runs on synthetic BASE_FIXINGS data** (`CHF_USD=1.13, XAU_USD=2500 — synthetic`, log line 8); see §6.2 | PASS ✓ (caveat added) |
| EIP-712 digests | `node contracts/out-v3/eip712-verify.cjs` | **4/4 MATCH** (domain, permit digest, delegation digest, sign+ecrecover round-trip) — **digest-level only, NOT execution** (D-4) | "digests match" ✓ |
| On-chain tests | `bun run scripts/run-onchain-tests.ts` | **28/28 PASS** (7 JS-mirror fuzz + 21 read-only RPC invariants) | 28/28 ✓ |
| Safe config probe | `bun run scripts/verify-safe.ts` | **CRITICAL FINDING reproduced on both chains** — see D-2 §1 | ✓ reproduced |
| Safe balance probe | `bun run scripts/verify-safe-balances.ts` | **C-043 reproduced** — see D-2 §2 | ✓ reproduced |
| Custody inventory (NEW) | `bun run scripts/verify-custody-inventory.ts` | full-bytecode identity + holder reconciliation — D-2 §3–5 | (new evidence) |
| ESLint | `bun run lint` | exit 0 | ✓ |
| TypeScript | `bun run typecheck` | exit 0 | ✓ |

**Gen-3 block anchors (fresh, this round):** Monad — custody inventory `72,486,899` · verify-safe `72,487,204` · balances `72,487,374` · Arc — inventory `68,070,028` · verify-safe `68,070,214` · balances `68,070,288`. All chainIds asserted (10143 / 5042002 ✓).

---

## 4. Contract deployability (details → D-4)

4.1 **The reported 40,500-byte runtime size is REPRODUCED EXACTLY** at HEAD with byte-identical settings (solcjs 0.8.36, optimizer 200, viaIR, shanghai; 0 errors; solc's own EIP-170 warning "code size is 40500 bytes").
4.2 The historical size narrative is now fully adjudicated (was contradictory in the docs):
   - `c6ec946` source @ shanghai = **36,706 B** (the docs' baseline number — **correct**);
   - the committed `v3-baseline-result.json` (38,152 B) is the **same source compiled with evmVersion=paris** (reproduced byte-for-byte: creation 39,482, deployed 38,152) — a settings inconsistency in the artifact, not a size lie;
   - permit+votes (added at `a56646b`) cost **+3,705 B** (36,706 → 40,411) — the documented net cost is **confirmed**;
   - verifyIndexBase + CHF/GOLD additions (`b24e7e0`) cost **+89 B** (40,411 → 40,500).
4.3 **NEW CRITICAL DEPLOYABILITY FINDING (C-044):** `MTQSigmaV2-PENDING.json` claims the V2/V3-core source compiles to **23,220 B (within EIP-170 by 1,356 B)** — this does **NOT reproduce** from any source state in git history. The only available revision (`fb6bb6c`, 1,622 lines; the PENDING record claims 1,390 lines — no such revision exists) compiles to **24,894 B** (shanghai) / 24,866 (cancun) / **24,718 B best case** (cancun, runs=1) — **over the 24,576 B limit in every tested configuration by 142–4,138 B**. **The repository currently contains ZERO EIP-170-compliant deployable token sources.** Per-chain limit enforcement verification and the options paper are in D-4.

---

## 5. Gate-by-gate status (mandate §0.5 gate table) — **NO GATE ADVANCED**

| Gate | Definition (mandate §0.5) | Status | Blockers (evidence) |
|---|---|---|---|
| **Gate 1** — closure | audit + conflict register + J(s) + thresholds; Committee approvals OD-1..5, OD-8, OD-12; OD-3 constituted | **NOT CLOSED** | OD-1/OD-2/OD-3/OD-5 OPEN (§6.1); 43 conflicts in register incl. C-041/042/043 + new C-044..C-049; J(s) candidate-only with κ placeholder |
| **Gate 2** — shadow on Monad | implementation in shadow | **shadow OPERATING (permitted posture)** | OD-34 real-vs-mock UNDETERMINED (Oracle.sol ABI unpublished); economic eligibility hard-disabled (`mandate.ts:1070`), shadow-only enforced at boundary — re-verified: no broadcast code in `src/app/api/**` |
| **Gate 3** — quantitative/technical validation | 4–8 weeks validation | **NOT STARTED** | walk-forward protocol required (§6.2); 26 OOS samples insufficient; current backtest is synthetic-data reference |
| **Gate 4** — shadow acceptance | ≥30 days + coverage | **NOT STARTED** | depends on Gate 3 |
| **Gate 5** — limited live pilot | requires Gate 4 + OD-6/OD-7/OD-13 approved | **BLOCKED (CRITICAL)** | OD-35 VERIFIED-FAILED: Safe is 1/1 deployer-controlled, not 4/7; C-043: Safe holds zero assets, genesis supply 100% in deployer EOA; C-045: deployer private key literal committed in repo |
| **Gate 6** — production authorization | governance decision, OD-11 | **NOT AUTHORIZED** | upstream gates + this report's STOP conditions |
| **Gate 7** — Solana/multichain | OD-9/OD-10 | **NOT AUTHORIZED** | Solana records unverified this round (D-3 §4) |

**Release-control posture (re-verified this round):** `ECONOMIC_ELIGIBILITY_ENABLED = false` (`mandate.ts:1070`); every Level-4 candidate carries `shadowOnly` mandate records; no transaction-broadcast code exists in the app/API surface; keeper cannot sign (`KEEPER_PRIVATE_KEY` unset; Redis lock fails-open — recorded double-submit risk, not a shadow bypass); the only broadcast-capable code path (keeper with env key) is inert. **No bypass found. No production config change made.**

---

## 6. Decision matrix & stop conditions

### 6.1 Unresolved-decision matrix (§6 of the directive) — implemented vs verified vs approved vs authorized

| Decision | Implemented logic | Technically verified behavior | Proposed policy | Committee approval | Release authorization |
|---|---|---|---|---|---|
| **OD-1** J(s) full definition (κ, reserve-risk) | ✓ `mandate.ts §3.5` candidate-v1, **uniform κ placeholder** | unit-tested at reference layer (vectors 66/66) | candidate only | **OPEN** (Quantitative Committee) | **NOT GRANTED** — economic eligibility disabled |
| **OD-2** threshold $10 abs vs 1% rel | ✓ both computed per shadow decision, never combined | ✓ per-decision dual records | undecided | **OPEN** | **NOT GRANTED** |
| **OD-3** Committee constitution | modeled in `blueprint.ts` | n/a — no human committee exists | constitution/quorum/escalation pending | **OPEN** (project owner + governance) | **NOT GRANTED** — blocks Gate 1 |
| **OD-5** reserve-risk term for J(s) | ✓ zero placeholder registered (never invented) | ✓ placeholder behavior tested | methodology pending | **OPEN** | **NOT GRANTED** |
| OD-8, OD-12 (Gate-1 approvals per §0.5), OD-6/OD-7/OD-13 (Gate-5), OD-11 (Gate-6), OD-9/OD-10 (Gate-7), OD-16 (upgradeability Option A council), OD-29 (supply cap) | partial/none | see register | — | **OPEN** (all listed OPEN or IMPLEMENTED-PENDING-APPROVAL in `mandate-register.ts`) | **NOT GRANTED (any)** |

Register status rollup (uppercase-status rows): 8 OPEN · 8 IMPLEMENTED-PENDING-APPROVAL · 3 SATISFIED-BY-DOCUMENT · 1 VERIFIED-FAILED (OD-35). **None carries committee approval.**

### 6.2 Quantitative validation protocol (required before Gate 3 can be attempted — specification, NOT yet executed)
1. **Data sources:** Frankfurter (ECB FX), FRED (VIXCLS, DTWEXBGS), gold (PAXG/XAU composite: gold-api.com + Yahoo volume), each with source-independence checks; **documented degraded-mode (seeded defaults) must be replaced by ≥3 independent source families per pair (Chainlink/Pyth/Chronicle per §17.10)** before any acceptance run.
2. **Splits:** explicit time boundaries; walk-forward with training window ≥ 252 trading days, embargo/purge gap ≥ max holding period (no leakage: no normalization or feature computed on full-sample statistics).
3. **Method:** purged walk-forward (and/or purged K-fold) — never random shuffles; each fold re-fit.
4. **Baselines:** equal-weight basket, strategic prior fixed weights, single MV, ERC — MASE must beat ALL baselines on the primary metric out-of-sample.
5. **Metrics:** OOS Sharpe/Sortino, max drawdown + drawdown duration, CVaR(95/99), turnover, tracking error vs prior, PPError, concentration, protected-net-benefit incl. explicit gas/fee model, per-regime breakdown.
6. **Uncertainty:** ≥1,000 bootstrap resamples of OOS returns; report confidence intervals; **≥ 250 OOS evaluations minimum for stability** — the current **26 OOS samples are explicitly NOT conclusive evidence** (per the earlier mandate; unchanged).
7. **Adversarial regimes:** gold ±30/50%, VIX spikes, FX peg scenarios (CNY), depeg windows, missing-data cascades.
8. **Independent acceptance criteria:** defined and signed by the Quantitative Committee BEFORE any run (OD-1/OD-2/OD-5 closure); current state: **committee not constituted (OD-3)** — acceptance impossible at present.
9. **Current backtest honesty note:** the committed 10-year backtest PASS is a *reference-layer* result on **synthetic base-fixings data** (VIX defaulted, seeded walk components; `historical-backtest-results.json` `degraded: true` ancestor fields; fresh log line 8). It is evidence the engine's invariants hold on that data — it is **NOT** evidence of real-market performance.

### 6.3 Oracle verification record (§6 of the directive)
- **Configured production feeds: NONE.** `oracle-feeds.ts` records `providerFeedAddress: null` for every pair on every chain by design ("oracle addresses are never invented"). Required families per §17.10: Chainlink, Pyth, Chronicle — none wired.
- **On-chain Oracle.sol:** code verified-present on Monad (`0xDfcA…B713`, 5,273 B) and Arc (`0xFd2B…861e`, 2,601 B) — **ABI unpublished; feed contents UNVERIFIED; real-vs-mock determination UNDETERMINED**. Robinhood Oracle `0x02D9…6A9F` existence-unverified (never probed).
- **Pilot (shadow) sources:** Frankfurter ECB (5 FX), gold-api.com + Yahoo (gold), FRED + Yahoo + seeded OU fallback (VIX/DXY — the seeded fallback is synthetic and must be excluded from any acceptance run), USDC/USD = 1.0 by construction (Arc).
- **Staleness rules implemented:** MAJOR_FX/GOLD 60 s, MINOR_FX/VIX_DXY 120 s (`blueprint.ts:191-194`), deviation max 2.5%, confidence caps 0.5%/1%/1%/2%; fail-closed on invalid/missing (unit-tested at reference layer).
- **Behavioral tests REQUIRED before Gate 2 acceptance (not yet executed — plan):** stale-feed transition, source-correlation collapse, divergent-price consensus (median-of-3), depeg windows, malformed responses, health-state machine. **No synthetic witness may be presented as verified production pricing.** (Current posture complies: everything oracle-related is labeled shadow/mock.)

### 6.4 STOP-CONDITION CHECKS (directive §7) — all checked, findings retained, none suppressed

| Stop condition | Triggered? | Disposition |
|---|---|---|
| Unexplained supply discrepancy | **YES (immaterial, recorded)** | 3-wei dust pattern on every candidate token on both chains (supply − deployer − known reserves = exactly 3 wei for candidates B and C; 1.000000000000000003 MTQ unlocated for candidate A) — D-2 §5. Immaterial (10⁻¹⁸ scale) but reported per directive; not explainable without logs (see next row). |
| Address mismatch | **YES (CRITICAL)** | C-041 (three live tokens per chain), C-042 (9+ cross-chain contaminations), plus 2 unprobed records (Arc `0x5C72…`, Robinhood `0xaf7c…`) and 2 Solana records — D-3. |
| Inaccessible evidence | **YES** | (a) `eth_getLogs` history: Monad RPC refuses **all** tested window sizes incl. 500 blocks (HTTP 413); Arc accepts ≤2,000-block windows (68M blocks ⇒ ~34,000 requests — infeasible here) — **historical custody cannot be established from these public RPCs**; requires archive/explorer access. (b) Foundry suite: forge not installed in sandbox. (c) No git remote — evidence exists only in this machine. |
| Failed invariant | **YES (CRITICAL)** | OD-35/T-87: Safe 1/1 ≠ 4/7 (Gen-1, Gen-2, **Gen-3 reproduced**). Also: committed Foundry **failure caches** exist in-repo (`contracts/cache/fuzz/failures/…` for 4 fuzz tests + `test-failures` for a reentrancy test, fb6bb6c-era) whose resolution is **unevidenced** — no passing forge log exists anywhere in the repo. |
| Custody-history inconsistency | **YES (CRITICAL)** | C-043: Genesis Reserve Safe holds zero of every candidate on both chains + nonce 0 + zero native; candidate-B genesis supply ~100% in deployer EOA; **new**: candidate-C genesis supply is self-custodied **inside the token contract itself** (`genesisReserve()` returns the token's own address on both chains) — D-2 §4, C-046. Ch. 20.1 step-5 ("1M MTQ to the Safe") remains **disproved for the live deployments**. |
| Private-key exposure | **YES (CRITICAL — new, C-045)** | Plaintext secp256k1 private key literal for the deployer EOA is committed at `scripts/verify-key-and-audit-roles.ts:5` (script self-verifies it derives `0x3C39…8d8c`). This key unilaterally controls: the Safe (sole owner), ~100% of candidate-B genesis supply (both chains), all admin roles. **Purge + rotation required before ANY further step; no on-chain action authorized until rotated** (a rotation plan must be a reviewable transaction plan). The referenced `upload/private_key.txt` is absent from disk; the literal in the script is the live exposure. |

**All stop conditions are reported. The adverse findings stand. This report does not resolve them — remediation requires authorized human action (D-5).**

---

## 7. Repository remote & CI — limitation and proposal (no credentials involved)

**Limitation (recorded):** the repository has **no remote**. All evidence exists solely on this machine. `git remote -v` is empty; there is no CI; on-chain deployments predate the available git history (OD-36 note). This weakens every immutability claim above to "immutable within this machine's history".

**Proposal (for human approval — nothing executed):**
1. Create a **private** hosted repository (GitHub/GitLab private or self-hosted Gitea) under an organization with 2FA enforced; **no credentials or secrets in the repo** (pre-commit secret scan; the C-045 key must be purged BEFORE the first push — pushing the current history would publish the key literal).
2. Access control: ≥2 maintainers for protected branch `main`; signed commits (GPG/SSH); no force-push; tag all evidence rounds (`evidence/v6`, …).
3. CI (GitHub Actions equivalent): on PR — `bun run lint`, `bun run typecheck`, the 7 reference suites, `node contracts/out-v3/compile-repro-hash.mjs` size-gate (fail if > 24,576 B unless an explicit waiver file is present), and secret-scan. Nightly: historical backtest refresh + read-only on-chain probes (never broadcast-capable).
4. Evidence policy: every test claim PR must attach the log file; the merge commit is the immutable evidence anchor.

---

## 8. Honest limitations of THIS round

1. Read-only public-RPC evidence only; one endpoint per chain; no multi-node cross-validation (mitigated by two chains + three generations of reads agreeing).
2. Log-based history is inaccessible via the public RPCs (§6.4c) — holder-history conclusions are bounded by balance/nonce/code state, not by event history.
3. Foundry suite unrunnable in this sandbox (no `forge`) — Solidity execution tests remain protocol-owner-environment items (D-4).
4. Robinhood Chain Testnet and Solana were not probed this round (Robinhood RPC reachable? untested; out of the directive's priority-zero scope) — their records remain unverified (D-3 §4).
5. Signer identity is not attested off-chain anywhere; the deployer EOA is known only as an address whose key appeared in-repo (C-045).
6. All conclusions are as-of the recorded Gen-3 blocks; the Safe configuration is mutable by its current 1/1 owner at any time.

---
*Every value above is traceable to `audit-work/v6/` artifacts, `audit-work/v6/logs/*.log`, the committed probe JSONs, or git. No gate advanced; no approval claimed; production remains NOT AUTHORIZED.*
