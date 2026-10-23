# D-4 — CONTRACT-SIZE REMEDIATION OPTIONS PAPER + EVM EXECUTION-TEST MATRIX

**MTQΣ — Evidence Reconciliation and Pre-Remediation Control Directive (§5, §7.4)**
No redesign is selected here. No contract was deployed, upgraded, or modified. This paper reproduces the size evidence, states the per-chain constraint problem, compares options **including their new security/trust boundaries**, and defines the mandatory execution-test matrix + review gates a redesign must pass before selection.

---

## 1. Verified size evidence (all reproduced this round at HEAD `b68ccb8`, solcjs `0.8.36+commit.8a079791.Emscripten.clang`, standard-JSON)

| Source | evmVersion | runs | viaIR | creation B | runtime B | vs 24,576 B limit | keccak256(runtime) |
|---|---|---|---|---|---|---|---|
| `MTQSigmaV3` @ HEAD | shanghai | 200 | yes | 42,114 | **40,500** | **+15,925** | `0x6b5cf853adcfbb0d57808a13e4eb141a6265858b5c8063327f1f2a354e80a03d` |
| `MTQSigmaV3` @ `a56646b` | shanghai | 200 | yes | 42,018 | 40,411 | +15,835 | `0xab15bb61…f94831` |
| `MTQSigmaV3` @ `c6ec946` (pre permit+votes) | shanghai | 200 | yes | 38,023 | 36,706 | +12,130 | `0xa0eec119…ab16e` |
| `MTQSigmaV3` @ `c6ec946` | **paris** | 200 | yes | 39,482 | 38,152 | +13,576 | `0x2c793eee…bd2f` — **this IS the committed `v3-baseline-result.json` (adjudicated: artifact was paris, docs said shanghai)** |
| `MTQSigmaV2` (protocol core, no permit/votes) @ HEAD | shanghai | 200 | yes | 26,307 | **24,894** | **+318** | `0x7f3dd874…92432` |
| `MTQSigmaV2` @ HEAD | cancun | 200 | yes | 26,279 | 24,866 | +290 | `0x9c6ed217…e2388` |
| `MTQSigmaV2` @ HEAD | shanghai | 200 | **no** | 30,094 | 28,714 | +4,138 | `0x61c80a34…36edd` |
| `MTQSigmaV2` @ HEAD | shanghai | **1** | yes | 26,158 | 24,745 | +169 | `0xe57bf0d2…5936c` |
| `MTQSigmaV2` @ HEAD | cancun | **1** | yes | 26,131 | **24,718** | **+142 (best case)** | `0x0f9c28a7…5404f` |

Reproduce: `node contracts/out-v3/compile-repro-hash.mjs <source> <contractName> <label> [runs] [viaIR] [evmVersion]` → `audit-work/v6/compile-repro-<label>.json`.

**Adjudicated size narrative (closes the v5-era discrepancy):** 36,706 (c6ec946, shanghai) → **+3,705** permit+votes (a56646b) → 40,411 → **+89** verifyIndexBase/CHF/GOLD (b24e7e0) → 40,500 at HEAD. The committed `v3-baseline-result.json` (38,152) was the c6ec946 source compiled with **paris** — reproduced byte-for-byte.

**C-044 (CRITICAL — new):** `MTQSigmaV2-PENDING.json`'s "23,220 B (within limit by 1,356 B)" claim does **not reproduce from any source revision in git history** (its claimed 1,390 source lines match no revision; the only revision, `fb6bb6c`, has 1,622 lines and compiles ≥ 24,718 B in every tested configuration). **The repository currently contains ZERO EIP-170-compliant deployable token source.**

## 2. Per-chain deployment constraint verification (open item — cannot be closed in this phase)

- EIP-170's 24,576-byte runtime limit is the **default EVM deploy-time rule** (Spurious Dragon); solc emits the warning above; the repo's own `MTQSigmaV2-PENDING.json` records it as binding for Arc.
- **Monad 10143 / Arc 5042002 / Robinhood 46630:** no authoritative chain-spec statement is available in this sandbox; no chain-documented exception is known. **Engineering position: treat 24,576 B as binding on all three** until (a) authoritative chain documentation is produced, or (b) a single **authorized** probe-deployment of an intentionally oversized contract is approved and executed (that is an on-chain action — **prohibited in this phase**, listed as remediation R-14 with the required transaction-plan format).
- Testnet-specific exceptions must **not** be assumed (per directive: "do not rely on testnet-specific exceptions").

## 3. Options comparison (NONE selected; each requires independent review before selection)

### Option A — Deploy V2-core (MTQSigmaV2.sol) with a ≥142 B trim, defer permit/votes
- **Evidence:** best case 24,718 B (cancun, runs=1) → need ≥142 B reduction; trimming candidates: unused getters, redundant guards (audit before removal), 2-3 custom-error consolidations. Expected achievable: 200–800 B.
- **Scope cost:** OD-37 (EIP-2612 + ERC20Votes) is **deferred** — requires Committee + Legal sign-off on deferral.
- **New trust boundaries:** none (immutable monolith preserved; Option-A upgradeability stance intact).
- **Regression:** existing 30-test V2 Foundry suite + fresh execution matrix §4 (minus permit/votes rows).
- **Risk:** LOW-MEDIUM · **Effort:** small. **This is the only option with no new trust surface.**

### Option B — Split MTQSigmaV3 into ERC20-core + separate ERC20Votes checkpointing contract
- Pattern: votes/wrapper token (Compound-style) or dedicated checkpointing module; core keeps `≈V2-core` size, votes logic lives in its own contract (far under limit).
- **New trust boundaries:** (i) a second contract whose address the core must trust (or a proxy/wrapper relationship); (ii) if implemented upgradeable (UUPS), this **contradicts UPGRADEABILITY.md Option A "immutable"** — requires OD-16 Constitutional Council + 90-day timelock decision; an immutable second contract avoids this but fixes bugs forever.
- **Regression:** full execution matrix + wrapper accounting invariants (votes conservation under transfers, double-delegation edge cases).
- **Risk:** MEDIUM (design correctness) · **Effort:** MEDIUM.

### Option C — DELEGATECALL-library decomposition of permit+votes
- Deploy permit/votes internals as deployed libraries (library code does not count toward the main contract's EIP-170 size; Uniswap-V3-style).
- **New trust boundaries:** library addresses must be **immutable and independently verified**; internal dispatch increases audit surface (stack-depth/delegatecall semantics); metadata (EIP-712 domain string) must live in the core.
- **Regression:** full execution matrix; library-address pinning tests; forge `ir` optimizer runs.
- **Risk:** MEDIUM · **Effort:** MEDIUM.

### Option D — Keep the 40,500 B monolith, rely on a chain-level exception
- **REJECTED (recorded):** no confirmed chain exception exists (§2); relying on testnet quirks is explicitly prohibited by the directive; would leave the protocol undeployable on any standard EVM target.

### Option E — Architectural split: pure token + protocol contracts (already precedented by `MtqEcosystem.sol` layout)
- Keep the token contract minimal (ERC20 [+permit] only — comfortably under limit); move index/rebalance/risk-machine/governance to separate contracts (as the Ecosystem and blueprint Listings already model).
- **New trust boundaries:** inter-contract roles/permissions must be re-modeled (mint authority, pause authority, oracle/keeper roles across N contracts); event/ordering semantics across contracts; larger integration regression.
- **Regression:** the largest suite — full protocol integration matrix + the existing 56 Foundry tests re-pointed to new layout.
- **Risk:** MEDIUM-HIGH (scope) · **Effort:** HIGH.

**Mandatory review before ANY selection:** (1) independent security review of the chosen design (third party per DEPLOYMENT-RECORD §7 — none has ever been performed); (2) the §4 execution matrix green in a reproducible environment; (3) Committee decisions on OD-37 scope (A/B/C/E) or OD-16 (B-upgradeable); (4) size-gate CI rule (D-1 §7) enforcing ≤24,576 B on every future build.

## 4. EVM EXECUTION-TEST MATRIX (mandatory before any compliance claim — currently NOT green)

**Current honest status:** EIP-2612/EIP-712/ERC20Votes are verified at **digest level only** (`contracts/out-v3/eip712-verify.cjs`: domain, permit digest, delegation digest, sign+ecrecover round-trip — all MATCH) plus reference-layer JS mirrors (fuzz 7/7). **No state-changing execution test of `permit()`, `delegate()`, `delegateBySig()` exists anywhere in the repo** (both `.t.sol` files have zero permit/votes coverage; `forge` is not installed in this sandbox). Digest-level results are **distinct** from execution tests and are marked as such below.

| # | Test | Requirement | Method | Current status |
|---|---|---|---|---|
| E-01 | transfer / self / third-party | ERC-20 §4 + OZ semantics; events; rounding at 1 wei | forge unit | **not executed** (V2 suite covers transfer via mint/redeem paths) |
| E-02 | approve/transferFrom edge cases; infinite approval; allowance override (EIP-20 order) | ERC-20 §4.2/4.3 | forge unit | **not executed** |
| E-03 | zero-address / zero-value / insufficient-balance reverts | ERC-20 + draft-IERC6093 error semantics | forge unit | **not executed** |
| E-04 | **permit() happy path** — permit → transferFrom without prior approve | EIP-2612 §3 | forge unit | **digest-level only (digest MATCH); execution NOT tested** |
| E-05 | permit expired deadline (`block.timestamp ≥ deadline`) revert | EIP-2612 §3 | forge unit | **not executed** |
| E-06 | permit nonce replay (reuse same sig) revert | EIP-2612 §2 | forge unit | **not executed** |
| E-07 | permit tampered fields (owner/spender/value) revert | EIP-2612 | forge unit | **not executed** |
| E-08 | permit malformed `v,r,s` / ecrecover→0 revert | EIP-2 s-range, malleability | forge unit | **not executed** |
| E-09 | EIP-712 domain: name "MTQ Sigma V3", version "1", chainId, verifyingContract; **cross-chain replay** (different chainId → digest differs) | EIP-712 §3 | forge + reference | **digest-level MATCH on chainId 10143; cross-chain variant NOT executed** |
| E-10 | nonces() per-owner increment; uniqueness under concurrent permits | EIP-2612 §2 | forge unit | **not executed** |
| E-11 | delegate() / checkpoints from zero; getVotes correctness | ERC-5805 §2 | forge unit | **not executed** |
| E-12 | delegateBySig() happy + replay + bad-sig reverts | ERC-5805 §3 | forge unit | **digest-level only; execution NOT tested** |
| E-13 | getPastVotes / getPastTotalSupply at past blocks; ERC-6372 CLOCK() mode ("mode:block") | ERC-5805 §2/§5 | forge unit | **not executed** |
| E-14 | votes conservation under transfer; self-delegation; delegation switches | ERC-5805 | forge invariant | **not executed** |
| E-15 | mint/burn → totalSupply + checkpoints consistency; genesis one-shot guard | OD-37/T-85 | forge unit | **not executed on-chain; reference-layer unit-tested (genesis.ts)** |
| E-16 | no fixed cap — document behavior at large mints (OD-29 OPEN) | OD-29 | forge test + committee note | **not executed; policy OPEN** |
| E-17 | reentrancy on mint/redeem (existing guards) | H1/H2 | forge fuzz/invariant | **⚠ committed historical FAILURE cache** (`contracts/cache/test-failures/…test_Reentrancy_Redeem_Reverts`) — must be re-run and resolved with evidence |
| E-18 | fuzz: RR hard floor / S5 gold+50% / S6 gold−30% survival / mint-redeem conservation | V3 suite | forge fuzz | **⚠ committed counterexample caches** for 4 named tests (args recorded in-cache) — resolution unevidenced in-repo; no passing forge log exists |

**Gate to compliance claim:** every row above green in a reproducible environment (protocol-owner Foundry CI), plus independent security review. Until then, OD-37/T-88 remains **implemented (compiled 0 errors) — NOT execution-tested — NOT audited**, and the digest-level evidence must never be reported as contract compliance (kept distinct per directive §5).

**Reproduction notes:** foundry config exists (`contracts/foundry.toml`: solc 0.8.20 target, optimizer 200, via_ir, fuzz 256/CI 1024) but the suite has **never produced a passing in-repo log**; the only committed Foundry artifacts are failure caches (E-17/E-18 rows). The 30 V2 + 26 V3 `.t.sol` sources exist and are the protocol-owner's starting point. No EIP-5267 exposure exists in V3 (recorded limitation, TOKEN-STANDARD.md §9.6).

---
*No redesign selected; no compliance claimed. Sizes are keccak-hashed and reproducible per §1 commands. The E-17/E-18 adverse caches are preserved verbatim and must be resolved before any regression suite is called green (D-5 R-10, D-6 #7).*
