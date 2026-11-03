# MTQΣ — TASK 39-b · V4 Contract Dynamic-Membership Design Plan

**STATUS: IMPLEMENTED (testnet reference layer — Solidity source + compiled artifact + solcjs reproducible harness; UNDEPLOYED).**
Prior status: PROPOSED — superseded by owner directive 2026-11-03 ("fix and implement the honest-limits items"), TASK-39. Production deployment remains **Gate-C / Task-12-gated** (authority migration D8 chain must execute first — spec §11 risk 6); nothing in this plan advances any gate.
**Artifacts:** `contracts/MTQSigmaV4.sol` (source, 818 lines, self-contained) · `contracts/out-v4/compile-standard.mjs` (harness) · `contracts/out-v4/v4-result.json` (compiled artifact + ABI + storage layout).
**Governing spec:** `audit-work/task13/currency-constituency-and-weight-transition-spec.md` (v0.1 PROPOSED — Gate C; §13 parameters UNAPPROVED DRAFT). This document is the contract-side implementation plan for that spec.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Never audited. Never deployed. No parameter herein is production-approved.**

Evidence legend (per README): `VERIFIED` (reproduced this session, cited) · `DEVELOPER-REPORTED` (prior in-repo work, cited) · `PROPOSED` · `NOT IMPLEMENTED`. The V4 contract itself is `VERIFIED-COMPILED` (zero errors, this session, §7) and `UNDEPLOYED`.

---

## 1. Problem — the static V2/V3 contract layer (VERIFIED line citations)

The platform's honest status discloses "the contract layer remains STATIC — the V4 dynamic-membership design plan is PROPOSED (Gate-C / Task-12-gated)" (`src/lib/mtq/constituency/types.ts:26-29`, `index.ts:16-18`, `src/app/api/constituency/route.ts:11,41,112`). The spec's §9 conclusion is a BLOCKER: the fixed-7 architecture is hard-coded at every layer, so an expandable constituency engine requires **contract-level redesign of the undeployed V2/V3, not parameter changes**. Verified this session by direct read:

| Static-layer defect | V2 evidence | V3 evidence |
|---|---|---|
| Fixed 7-component shape `bytes3[7]` | `MTQSigmaV2.sol:298` (`COMPONENTS`) | `MTQSigmaV3.sol:288` |
| Fixed `uint256[7]` envelope/velocity arrays | `MTQSigmaV2.sol:301-305` (`LOWER_BOUND`/`UPPER_BOUND`/`MAX_VELOCITY`) | `MTQSigmaV3.sol:291-295` |
| `setEnvelopes` cannot change component COUNT | `MTQSigmaV2.sol:560-564` | `MTQSigmaV3.sol:1344-1348` |
| Positive-weights-only submission (an exit can NEVER reach 0 on-chain — no exit transition is expressible at all) | `MTQSigmaV2.sol:526` (`if (!(target[i] > 0)) revert Err62();`) | `MTQSigmaV3.sol:1317` |
| ±1e14 (±1 bp) commit tolerance on the weight sum | `MTQSigmaV2.sol:638` | `MTQSigmaV3.sol:1388` |
| Every weight loop hard-codes `i < 7` | `MTQSigmaV2.sol:523-549` | `MTQSigmaV3.sol:1315-1341` |

This document was previously a dangling citation (it did not exist); it now exists and is IMPLEMENTED as an UNDEPLOYED reference layer. The TS-layer strings still read "PROPOSED" — the src/ side is TASK 39-a's (parallel agent); TASK 39-b does not touch `src/` (constraint honored).

## 2. Registry model (spec §2, hybrid alternative (c) — DRAFT recommendation, UNAPPROVED D-13.11)

V4 implements the spec §2 **hybrid model (c)**: on-chain stores only `{id, status, bounds, weight}`; the full dossier (scoring inputs with provenance, decision IDs, quorums, timelock references, methodology versions) lives off-chain and is committed on-chain as a `bytes32` hash. Chosen because status/bounds/weights are what the index math consumes on-chain; the full dossier is audit evidence. Alternatives (a) full on-chain registry and (b) off-chain registry + hash commitment were rejected per the spec's own reasoning (a: schema rigidity/gas; b: keeper trust dependency) — owner-visible, not silently chosen.

On-chain structures (`MTQSigmaV4.sol §1.c`):

- `enum LifecycleStatus { NONEXISTENT, CANDIDATE, ELIGIBLE, ACTIVE, WATCH, RETIRING, EXCLUDED, EMERGENCY_SUSPENDED }` — spec §3 states plus the storage default.
- `struct ComponentRecord { bytes3 id; uint64 registeredAt; LifecycleStatus status; uint32 envelopeMinBp; uint32 envelopeMaxBp; uint32 velocityBp; uint96 baseFixingUsdMicros; bytes32 dossierHash; bool exists; }` — the hybrid-(c) subset. `velocityBp` (spec §5.5 Δ_i class) is stored for governance visibility but NOT enforced on-chain (glide planning is off-chain — §4 below). `baseFixingUsdMicros` is a dormant field reserved for the future chain-linked-index adapter (deliverable 5).
- `bytes3[] public componentList` + `mapping(uint256 => ComponentRecord) records` keyed by a **monotonic registryId counter that is NEVER reused** + `mapping(bytes3 => uint256) idToRegistryId`. **No fixed-size arrays anywhere.**
- Registry versioning (spec §2 "versioned registry … every transition emits an append-only record"): `registryVersion` starts at 1; every status mutator and every executed N_max change bumps it and emits `RegistryVersionBumped(uint256)`.
- Hard structural sanity bound: N_total (registered ever) `< 64` at `register` time; `MAX_BASKET_SIZE = 15` caps nMax; weight submissions are bounded by the same registry size (loops are O(N_total × M), N_total ≤ 64).

## 3. Lifecycle mapping T1–T9 → V4 functions + evidence-hash discipline

The trust split (documented, not solved): **the on-chain registry records governance OUTCOMES and weight commitments; it does NOT verify off-chain rule evidence.** Scores, observation windows, hysteresis bands, pre-announcement notices, multi-sig quorums and timelocks (other than the N_max one) are off-chain obligations whose artifacts are committed as hashes. The rule engine that evaluates them is the TS reference layer `src/lib/mtq/constituency/engine.ts` (TASK 39-a; VERIFIED present — the validated prototype semantics with 15/15 MANDATE-007 §3 assertions per `types.ts:4-10`).

| # | Spec §3 transition | V4 function | Authority (spec → V4) | On-chain evidence |
|---|---|---|---|---|
| T1 | → CANDIDATE | `register(bytes3,bytes32,uint32,uint32,uint32,uint96)` | Economic Authority + Risk Council docket → `MTQ_GOVERNANCE_ROLE` (flattened, disclosed) | non-zero `dossierHash` |
| T2 | CANDIDATE → ELIGIBLE (rule-driven) | `markEligible(uint256,bytes32)` | rule-driven outcome relayed by governance | non-zero evidence hash (score series over T_obs_entry) |
| T3 | ELIGIBLE → ACTIVE | `confirmAdmission(uint256,bytes32)` | Monetary Authority + Constitutional ratification → `MTQ_GOVERNANCE_ROLE` | non-zero evidence hash + slot check `activeCount() < nMax` (D-13.11) |
| T4 | ACTIVE → WATCH (rule-driven) | `flagWatch(uint256,bytes32)` | rule-driven outcome relayed by governance | non-zero reason hash |
| T5 | WATCH → RETIRING | `confirmRetirement(uint256,bytes32)` | Risk Council 4/7 → `MTQ_GOVERNANCE_ROLE` (flattened, disclosed) | non-zero evidence hash (θ_out series + completed exit window) |
| T6 | RETIRING → EXCLUDED | `completeRetirement(uint256)` | "automatic on glide completion" → attested by governance; the glide-completion FACT is enforced on-chain | **hard invariant: `weightsBp[registryId] == 0` or revert** (exclusion-zero) |
| T7 | ACTIVE/WATCH/RETIRING → EMERGENCY_SUSPENDED | `emergencySuspend(uint256,bytes32)` | Emergency Council 2-of-3 → `MTQ_EMERGENCY_ROLE` (the 2-of-3 quorum itself is an off-chain multi-sig property) | non-zero cause hash, stored in `suspensionCause`; weight frozen (untouched) |
| T8 | EMERGENCY_SUSPENDED → resolution | `resolveSuspension(uint256,bool)` | Emergency + Risk Councils joint → `MTQ_GOVERNANCE_ROLE` (flattened); T_rein window enforced off-chain | `reinstate=true` → ACTIVE; `false` → RETIRING (accelerated glide N_em off-chain) |
| T9 | EXCLUDED → CANDIDATE | `renominate(uint256,bytes32)` | same as T1 → `MTQ_GOVERNANCE_ROLE` | fresh non-zero dossier hash; SAME registryId reused (ids never re-minted; oscillation guard = full new T1→T3 cycle) |

Honest disclosures on this mapping:

1. **T2/T4 recorders were ADDED beyond TASK-39's explicit function list** (`markEligible`, `flagWatch`). Reason: T5's WATCH precondition and T3's ELIGIBLE queue state require on-chain paths for the rule-driven transitions; without them the state machine is unreachable. They are the minimal completion, gated like the other recorders.
2. **Authority flattening.** The spec's four-body separation (Economic Authority / Risk Council / Monetary+Constitutional / Emergency Council) is flattened to two roles (`MTQ_GOVERNANCE_ROLE`, `MTQ_EMERGENCY_ROLE`) in this reference. Role separation, quorums and timelocks are the Gate-C mitigation list (spec §11 risk 1); the flattening is a REFERENCE simplification, not a design claim.
3. `resolveSuspension(reinstate=true)` reinstates to ACTIVE per the spec T8(a) literal; the pre-suspension glide resume is off-chain. There is no WATCH → ACTIVE un-suspend edge and no mid-glide reversal (spec §5.6 oscillation guard; the spec's own table has no such edge).
4. Evidence hashes are commitments, not verified content — INV: the contract cannot tell a genuine dossier hash from garbage; that is the documented cost of model (c).

## 4. Weight-submission semantics (`submitWeights(uint256[] registryIds, uint256[] weightsBp18)`)

The §8 item-3/4 core. Replaces V2/V3 `submitTargetWeights` (V2:518-555 / V3:1310-1342, `onlyKeeper`, fixed `uint256[7]`, positive-only). V4's keeper submits the full committed vector over the registry domain in **bp quanta at 1e18 scale (multiples of 1e14 — spec §5.3)**.

Validation, in order, each with a named custom error (exact names in source §1.a):

1. Non-empty arrays, equal lengths (`EmptySubmission`, `LengthMismatch`).
2. Every submitted id is a REGISTERED component (`NotRegistered`) — the membership precondition (spec §8 item 3).
3. Every ACTIVE component is included — no silent omission; the ACTIVE set is the submission's domain (`ActiveOmitted`) (spec §8 item 3).
4. Weight values: ACTIVE ⇒ > 0 (`ZeroWeightForActive`); non-ACTIVE ⇒ ≥ 0 — **0 is allowed exactly for non-ACTIVE slots** (spec §8 item 3); EXCLUDED ⇒ exactly 0 (`ExcludedMustBeZero`); every value is a bp quantum, `w % 1e14 == 0` (`NotBpQuantum`, spec §5.3).
5. Per-record envelope for ACTIVE components: `envelopeMinBp·1e14 ≤ w ≤ envelopeMaxBp·1e14` (`WeightBelowEnvelope` / `WeightAboveEnvelope`) (spec §5.2 — floors/ceilings apply to ACTIVE only).
6. Sum == **EXACTLY 1e18** (`SumNotExact`) — the ±1e14 commit tolerance of V2 (line 638) and V3 (line 1388) is TIGHTENED to exact per spec §8 item 4.
7. No duplicate ids (`DuplicateId`) (spec §5.4: no duplicated component).
8. **ADDED beyond the 7 rules** (`OmittedPositiveWeight`): any registered component OMITTED from the submission must carry stored weight exactly 0. Without this, a submitter could omit a frozen EMERGENCY_SUSPENDED component (weight frozen at its suspension value, spec §3) while summing the ACTIVE set to 1e18, leaving the stored total at ≠ 1e18 — violating spec §5.4 ("no unallocated weight; sum = 1 exactly at every step"). With rule 8, the post-merge stored vector ALWAYS sums to exactly 1e18. `totalWeight()` re-asserts this invariant as a view (reverting `InvariantSumNotExact` once `weightVersion > 0`), mirroring the TS layer's `engine.ts:902` period-commit assertion.

On success: stores `weightsBp[registryId]` for every submitted id, records the vector hash `keccak256(abi.encodePacked(registryVersion, ids, weights))` in the append-only `weightHistory`, bumps `weightVersion`, emits `WeightsSubmitted(weightVersion, count, vectorHash)`.

**Why exactness is now achievable (spec §5.3):** weights are committed in bp quanta; the off-chain layer rounds with the **largest-remainder method** — floor every weight to the quantum, distribute residual units one-by-one to the largest fractional remainders, **ties broken by ascending lexicographic order of the stable bytes3 component id** (implemented in the TS reference layer: `src/lib/mtq/constituency/weights.ts` `roundToBp`, spec §5.3; `engine.ts` applies it per period commit). Integer bp vectors then sum to exactly 10000 bp = 1e18 by construction, so the contract can demand exactness instead of tolerating ±1 bp. The contract VERIFIES the sum; the keeper ROUNDS off-chain (spec §9 table row 3: "keeper commitment path must round, not the contract; contract verifies"). This also fixes the V2/V3 smoothing drift caveat (per-component integer floor division with no final re-normalization — V2:546 / V3:1334; up to ~7 wei drift): in V4, smoothing/glide arithmetic is off-chain and the COMMIT is exact by rule 6.

Views: `getActiveWeight(registryId)`, `getActiveIds()` (dynamic array — the MASE optimization domain, spec §6 item 1), `activeCount()`, `registrySize()`, `totalWeight()`.

Honest limits of the on-chain rule set: per-component velocity Δ_i and aggregate caps (w_cap / HHI, D-13.14) are NOT enforced on-chain (velocity classes are stored per record for visibility; glide/cap enforcement lives in the TS layer per spec §5.5/§6); a positive weight for a CANDIDATE/ELIGIBLE slot is technically accepted by rules 4-8 (TASK-39's letter: "0 is allowed exactly for non-ACTIVE slots") even though the spec §3 state matrix pins those states at exactly 0 — the strict form is enforced by the TS reference layer, not the contract (§8 below).

## 5. N_max constitutional change path (spec §7)

`MAX_BASKET_SIZE = 15` is a hard constant (the spec §7 draft bound 7–15); the live parameter `nMax` initializes to **7** (preserving current composition — UNAPPROVED DRAFT, D-13.11) and changes ONLY through a two-step timelock:

1. `proposeNMax(uint256 newNMax)` — `MTQ_GOVERNANCE_ROLE`; requires `1 ≤ newNMax ≤ 15` (`InvalidNMax`); records `pendingNMax` and `pendingNMaxEffectiveBlock = block.number + NMAX_TIMELOCK_BLOCKS`; emits `NMaxProposed`. A later proposal overwrites an earlier pending one (latest-wins).
2. `executeNMax()` — `MTQ_GOVERNANCE_ROLE`; requires the DRAFT block timelock elapsed (`TimelockNotElapsed`), and that the new cap does not already violate the live `N_active ≤ N_max` invariant (`NMaxBelowActive`, spec §5.2); sets `nMax`, clears the pending state, **bumps `registryVersion`** and emits `NMaxExecuted` + `RegistryVersionBumped` — spec §7: "a change of N_max is itself a constitutional event (timelock + version bump), never an incidental edit."

`NMAX_TIMELOCK_BLOCKS = 43200` is a **DRAFT constant** (~7 days at the assumed 12s block cadence; post-merge block times vary — a block-based timelock is an approximation, flagged as DRAFT per spec §13 posture; owner approval required). The slot check at T3 (`confirmAdmission` → `BasketFull`) enforces `activeCount() < nMax` (D-13.11 slot availability).

## 6. Breaking-change reconciliation table (V4 vs V2/V3 — mirrors spec §8/§9)

| # | Breaking change (spec §8) | V2/V3 evidence (VERIFIED) | V4 implementation | Contract-ABI / test implication |
|---|---|---|---|---|
| 1 | Fixed `bytes3[7]`/`uint256[7]` → registry ID mapping + dynamic iteration | V2:298, 301-305; V3:288, 291-295 | `componentList` + `records` + `idToRegistryId` + monotonic `nextRegistryId`; zero fixed-size arrays | new ABI; V2/V3 sources stand rewritten-by-replacement (V4 is the replacement); v1.2 untouched |
| 2 | `uint256[7]` envelopes/velocity → per-record fields; `setEnvelopes` count-invariance → per-record bounds + N_max parameter | V2:560-564; V3:1344-1348 | `ComponentRecord.envelopeMinBp/MaxBp/velocityBp` + `nMax` two-step (§5) | constitutional governance surface changes (new proposal/timelock types) |
| 3 | Positive-weights-only → 0 allowed exactly for non-ACTIVE slots + ACTIVE-set membership precondition + EXCLUDED ⇒ 0 | V2:526; V3:1317 | rules 2-4 of `submitWeights` + T6 exclusion-zero invariant (`ExclusionWeightNotZero`) | on-chain exit transitions become expressible at all |
| 4 | ±1e14 commit tolerance → exact bp-sum | V2:638; V3:1388 | rule 6 (`SumNotExact`) + rule 8 + `totalWeight()` invariant view | keeper must round off-chain (largest-remainder); contract verifies |
| 5 | TS reference layer literal unions / `length !== 7` guards / 6-leg oracle board / genesis 7-fixings → registry-driven | `mase.ts:10-11`, `currency.ts:5-23`, `chain-index.ts:236-241` (spec citations; TS side = TASK 39-a) | out of contract scope — the registry ABI (`getActiveIds()`, `records()`) is the interface the TS layer will consume | TASK 39-a owns src/; not touched here |
| 6 | Foundry suites for V2/V3 must be rewritten for the registry ABI | existing suites cover V2/V3 (30/14 tests, forge execution UNVERIFIED in sandbox) | deliberately NOT done (§8) | Stage K CCY-* families (spec §10) are future work |

## 7. Compile + size evidence (VERIFIED this session)

- **Toolchain:** node v24.22.2 + solcjs (`solc` npm package 0.8.36, resolved from the repo root `node_modules/`); bun 1.3.14 available but not needed.
- **Compiler version (from result JSON):** `0.8.36+commit.8a079791.Emscripten.clang`.
- **Settings:** optimizer enabled, runs = 200, viaIR = true, evmVersion = `shanghai` (matches `foundry.toml`'s solc >=0.8.20 / optimizer / via_ir profile that the out-v3 harness replicates).
- **Result:** **0 errors, 1 warning** — the warning is cosmetic: `getHonestStatus()` "can be restricted to pure" (it reads no state); it is kept `view` to mirror the V2/V3 honest-status helper signature (`MTQSigmaV2.sol` / `MTQSigmaV3.sol:2509-2521`). No evm-version retry was needed (shanghai compiled clean on the first successful run).
- **Bytecode sizes (EIP-170):** creation 9,327 bytes; **deployed runtime 8,445 bytes — WITHIN the 24,576-byte limit (16,131 bytes headroom)**. No slimming was required (V4 is registry-only; the EIP-170 pressure that forced runs=1 + metadata stripping on V3's 24,314-byte token layer does not arise — `contracts/deployments/MTQSigmaV2-PENDING.json` records that V2/V3 fight).
- **Determinism:** a second compile produced byte-identical outputs (ABI, method identifiers, storage layout, sizes) — sha256 over the output tuple `9202beacdca9b726…` matched.
- **Artifacts:** source `contracts/MTQSigmaV4.sol`; harness `contracts/out-v4/compile-standard.mjs`; result `contracts/out-v4/v4-result.json` (contains ABI — 88 entries, method identifiers, storage layout, error list, sizes).
- **Reproduction command:**
  `cd contracts/out-v4 && node compile-standard.mjs ../MTQSigmaV4.sol v4 200 true shanghai`
- **Harness provenance (honest note):** the harness was copied from `contracts/out-v3/compile-standard.mjs` and is NOT byte-unchanged: the out-v3 script hard-codes the source key `"MTQSigmaV3.sol"` and the extraction target `out.contracts["MTQSigmaV3.sol"].MTQSigmaV3`, which cannot resolve a contract named `MTQSigmaV4` (verified: the byte-unchanged copy compiles the V4 source but then exits "NO CONTRACT OUTPUT"). Exactly four adaptations were made (header comment; default solPath `../MTQSigmaV4.sol`; default label `v4`; sources key and extraction target `MTQSigmaV4.sol`/`MTQSigmaV4`) — the compile logic, settings, and output selection are otherwise byte-identical (diff recorded in this session's transcript; the file header states the same).
- **Self-containment:** `MTQSigmaV4.sol` has NO imports; the one interface it defines (`IERC20`, retained verbatim from V2/V3 for harness-convention symmetry and future adapter use — V4 custodies nothing) is inline, so the single-source solcjs harness works exactly as it does for V2/V3.

## 8. What is deliberately NOT done (honest limits)

1. **Not deployed anywhere.** No network, no testnet, no address, no deploy transaction. UNDEPLOYED reference.
2. **No audit.** Never reviewed by any independent security function. Production deployment is gated on Gate-C ratification + audit + the Task-12 authority chain.
3. **No Foundry test suite for V4.** The existing suites cover V2/V3; writing the V4 registry-ABI suites (the spec §10 Stage K CCY-LC/HYS/SCORE/SUM/BOUND/VEL/EXCL/SEP/EMER/ANN/DET families, fuzz variants included) is future work, explicitly gated — and Foundry execution remains UNVERIFIABLE in this sandbox (no forge; baseline §9), so no test claim is made or implied.
4. **No gas claims.** The O(N_total × M) validation loops are bounded by the 64-record sanity bound; no gas benchmark was run and none is claimed.
5. **The on-chain registry does NOT verify off-chain rule evidence.** It records hashes (dossier, evidence, cause) — the trust split is documented (§3); INV: hash commitments are not content verification.
6. **MASE optimizer domain change (spec §6 item 1) not included** — that is TS-reference-layer work (TASK 39-a); the contract only exposes the domain (`getActiveIds()`).
7. **Velocity, aggregate caps (w_cap/HHI, D-13.14), smoothing ρ, glides, T_ann notices, T_rein windows, multi-sig quorums: off-chain obligations, not on-chain enforcement** (§4/§5 disclosures); a positive CANDIDATE/ELIGIBLE weight is technically accepted by the on-chain rule set (§4 honest-limits note).
8. **Authority flattening** (§3 disclosure 2) and the **DRAFT NMAX_TIMELOCK_BLOCKS block-based timelock** (§5) await owner decision (D-13.11).
9. **The src/ honest-status strings still read "PROPOSED"** for this plan (`types.ts:26-29`, `index.ts:16-18`, `route.ts:112`) — TASK 39-a owns the TS side; TASK 39-b did not touch src/ (constraint honored). Reconciliation of those strings to "IMPLEMENTED (UNDEPLOYED)" is recorded here as an open follow-up.
10. **No gate is advanced by this document.** Shadow mode; TESTNET ONLY; parameters UNAPPROVED (spec §13).

## 9. Migration posture

V4 is a **clean-slate redeploy path**. V2/V3 were never deployed (DEVELOPER-REPORTED: `contracts/deployments/MTQSigmaV2-PENDING.json`, status `V3_SOURCE_READY_PENDING_DEPLOY`, `expectedAddress: null`, `deployTx: null`) — so there is no on-chain V2/V3 state to migrate, and no upgrade path is offered or implied (no proxy, no storage-compatible layout; `UPGRADEABILITY.md` historical-immutable Option A default per spec §9). The deployed v1.2 5-currency pilot is a different economic family (C-INV-2; fixed 5-currency arrays, admin-set prices, vault-balance economics) and is **untouched** — incompatible with dynamic constituency and with the no-reserve semantics; its disposition is D-13.22 (no-reserve-model-compatibility-and-migration.md §3.1/§3.2: "contract redesigns, not parameterizations"). No migration action of any kind was taken this session; any on-chain step additionally requires the Task 12 D8 authority chain and is forbidden in the interim (shadow mode).

---

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED**
