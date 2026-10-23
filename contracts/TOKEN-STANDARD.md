# TOKEN-STANDARD.md — MTQ Token Standard (ERC-20 + EIP-2612 Permit + ERC-20 Votes)

| Field | Value |
|---|---|
| Contract | `contracts/MTQSigmaV3.sol` (2,488 lines; single-file, no external imports) |
| Mandate basis | Ext-3 A.7 (OD-37) token-standard baseline; Test Matrix **T-88** |
| Status | **IMPLEMENTED IN SOURCE (compiles, zero errors). NOT deployed, NOT audited, NOT yet registered as T-88 evidence beyond this document.** |
| Supersedes | The compliance-register note "OpenZeppelin ERC20Permit/ERC20Votes compiled in foundry-out" (mandate-register.ts OD-37) — that note pointed at OZ library artifacts (`foundry-out/ERC20Permit.sol/`, `foundry-out/ERC20Votes.sol/`), not at the MTQ contract. The token-standard claim is now backed by a real, self-contained implementation inside MTQSigmaV3.sol. |

---

## 1. What is implemented

The OD-37 baseline for the MTQ token, per Ext-3 A.7:

1. **ERC-20** — pre-existing (transfer/approve/transferFrom, §1 core, lines 2112-2129).
2. **EIP-2612 Permit** — `permit()` gasless approvals with EIP-712 typed-data
   signatures, per-owner nonces, deadline enforcement (§1.b, lines 2258-2276).
3. **ERC-20 Votes / IERC-5805** — checkpoint-based vote delegation: block-number
   clock, `uint32`-key/`uint224`-value checkpoints (OZ `Checkpoints.Trace224`
   layout), binary-searched historical lookups, `delegate`/`delegateBySig`,
   `getVotes`/`getPastVotes`/`getPastTotalSupply` (§1.b, lines 2206-2412).
4. **IERC-6372** — `clock()` (block number) and `CLOCK_MODE()`
   (`"mode=blocknumber"`) so Governor contracts can discover the timepoint mode.
5. **No public transfer restrictions** — `transfer`/`transferFrom` were and remain
   permissionless; they are **not** gated by the `paused` flag (Pausable applies
   only to the mint/redeem/index machinery). `permit`/`delegate`/`delegateBySig`
   add no role gates either.
6. **No fixed supply cap** — cap policy stays **OD-29 = OPEN**. The only supply
   bound is the ERC-20 Votes representability guard (`Err105` at `2^224-1`),
   which is a data-structure limit, not a policy cap.
7. **Not upgradeable** — Option A per `UPGRADEABILITY.md` §1: no proxy machinery
   exists in the bytecode by construction; the EIP-712 cache uses `immutable`s
   (runtime-bytecode appended), not storage.

Everything is **self-contained**: the contract has NO imports; the OZ v5
`EIP712`/`Nonces`/`Checkpoints`/`ERC20Votes` semantics are reimplemented inline
in the contract's custom-error style. No OpenZeppelin code is linked or copied
verbatim; behavior was cross-verified against reference tooling (§6).

## 2. Function inventory added (with line refs in MTQSigmaV3.sol)

Errors (lines 149-158, following the contract's numbering style):

| Error | Meaning |
|---|---|
| `Err103_PermitExpired` | EIP-2612: `block.timestamp > deadline` |
| `Err104_InvalidSignature` | ecrecover returned 0 or the recovered signer ≠ owner |
| `Err105_VotesBalanceOverflow` | balance/total supply (and hence checkpoint value) > `type(uint224).max` |
| `Err106_DelegationExpired` | delegateBySig: `block.timestamp > expiry` |
| `Err107_InvalidDelegationNonce` | delegateBySig: `nonce != nonces[signer]` |
| `Err108_FutureTimepoint` | getPastVotes/getPastTotalSupply for current/future block |
| `Err109_CheckpointKeyOverflow` | clock() > `type(uint32).max` (unreachable; OZ SafeCast parity) |
| `Err110_CheckpointKeyUnordered` | checkpoint write with a key below the latest key (unreachable) |

State (all appended at the END of the storage layout — see §5):

| Element | Line | Notes |
|---|---|---|
| `PERMIT_TYPEHASH` (constant) | 2182 | `Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)` |
| `DELEGATION_TYPEHASH` (constant) | 2184 | `Delegation(address delegatee,uint256 nonce,uint256 expiry)` |
| `nonces` (public mapping) | 2195 | shared by `permit` + `delegateBySig` (OZ Nonces semantics) |
| `_cachedDomainSeparator` / `_cachedChainId` (immutables) | 2203-2204 | per-chain EIP-712 cache; zero storage slots |
| `struct Checkpoint { uint32 _key; uint224 _value; }` | 2211-2214 | OZ Trace224 layout |
| `_checkpoints` (private mapping) | 2217 | per-delegatee vote history (OZ name: `_delegateCheckpoints`) |
| `_totalSupplyCheckpoints` (private array) | 2219 | block-keyed historical total supply |
| `delegates` (public mapping) | 2224 | EIP-5805 delegation record |
| `DelegateChanged` / `DelegateVotesChanged` events | 2226-2227 | exact EIP-5805 signatures |

External / public functions (§1.b):

| Function | Line | Standard |
|---|---|---|
| `DOMAIN_SEPARATOR()` | 2235 | EIP-2612 |
| `permit(owner,spender,value,deadline,v,r,s)` | 2258 | EIP-2612 (selector `0xd505accf`) |
| `clock()` | 2282 | IERC-6372 |
| `CLOCK_MODE()` | 2287 | IERC-6372 (`0x4bf5d7e9`) |
| `getVotes(account)` | 2293 | IERC-5805 (`0x9ab24eb0`) |
| `getPastVotes(account,timepoint)` | 2301 | IERC-5805 (`0x3a46b1a8`) |
| `getPastTotalSupply(timepoint)` | 2308 | IERC-5805 (`0x8e539e8c`) |
| `delegate(delegatee)` | 2316 | IERC-5805 (`0x5c19a95c`) |
| `delegateBySig(delegatee,nonce,expiry,v,r,s)` | 2324 | IERC-5805 (`0xc3cda520`) |

Internal helpers: `_buildDomainSeparator` (2242), `_delegate` (2343),
`_moveDelegateVotes` (2353), `_writeCheckpoint` (2370), `_lookupCheckpoint`
(2398). Constructor cache init at lines 1163-1168.

Wiring into the existing token internals (the only pre-existing functions touched):
`_transfer` (2130), `_mint` (2141), `_burn` (2153) — each now also moves delegated
vote weight and (mint/burn) writes the total-supply checkpoint. **All supply
paths are covered** because every mint goes through `_mint` (`genesisMint`
line 1849, `executeMint` line 963) and every burn through `_burn` (`redeem`
line 1061); no other code writes `balanceOf`/`totalSupply` (grep-verified).

## 3. EIP-712 domain details

- **name**: the contract's ERC-20 name — `name()` returns `"MTQ Sigma V3"`
  (declared line 228: `string public constant name = "MTQ Sigma V3";`). The
  domain separator hashes this exact string; a rename would change the
  separator (intentional, OZ behavior).
- **version**: `"1"` (`_EIP712_VERSION`, line 2190). This is the
  signature-scheme version, deliberately separate from the blueprint version
  (v25.3).
- **chainId**: `block.chainid` at call time.
- **verifyingContract**: `address(this)`.
- **Type string**: `EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)`.
- **Caching (OZ v5 non-upgradeable pattern)**: the separator is built once in
  the constructor into `immutable`s. `DOMAIN_SEPARATOR()` treats the cache as
  **invalidated whenever `block.chainid != _cachedChainId`** (fork/chain-split
  safety) and rebuilds on the fly; on the deployment chain the cached value is
  served at zero SLOAD cost. Immutables occupy no storage slots.

The domain construction and both typed-data digests (`Permit`, `Delegation`)
were verified byte-for-byte against ethers v6 `TypedDataEncoder` (reference
implementation) — see §6.

## 4. ERC-20 Votes checkpoint semantics (OZ v5 parity)

- **Clock**: `block.number` (ERC-20 Votes standard; declared via IERC-6372).
- **Undelegated accounts have ZERO votes** — exactly like OZ: holding a balance
  is not voting power; delegation is opt-in (canonical pattern: self-delegation
  via `delegate(myself)`).
- **Checkpoints**: at most one entry per block per delegate (same-block writes
  coalesce); value = running vote weight. `uint32` key, `uint224` value.
- **`getPastVotes(a, N)`** = weight of `a` at the end of block `N` (largest
  checkpoint key ≤ N, binary search, O(log n)); reverts `Err108` for `N >= block.number`.
- **`getPastTotalSupply(N)`** = total supply at the end of block `N`, from the
  `_totalSupplyCheckpoints` maintained by `_mint`/`_burn`.
- **Delegation moves all of the delegator's current balance-weight** (`_delegate`),
  emitting `DelegateChanged` + `DelegateVotesChanged` on each weight change.
- **`delegateBySig`** shares the `nonces` counter with `permit` (OZ behavior) and
  enforces expiry + nonce equality (`nonce != nonces[signer]++`).
- **Overflow guard**: `_mint` reverts with `Err105` if a balance or the total
  supply would exceed `type(uint224).max` (≈ 1.7e25 × 10^18-scale tokens);
  unreachable at pilot scale (1M genesis supply) — kept for OZ parity as required.

## 5. Storage-layout preservation (verified)

Compared solc `storageLayout` of the pre-edit and post-edit contracts
(same solcjs 0.8.36, optimizer 200, via_ir, shanghai):

- **71 existing state variables: zero slot/offset changes** (mismatch count = 0).
- 4 new storage variables appended at the very end:
  `nonces` @slot 117, `_checkpoints` @slot 118, `_totalSupplyCheckpoints` @slot 119,
  `delegates` @slot 120 (last pre-existing var `dailyTradeResetAt` @slot 116).
- The two `immutable`s occupy no storage slots. Struct `Checkpoint` and the new
  constants occupy no storage slots.
- No existing function signature changed. No existing event changed. The only
  pre-existing functions modified are `_transfer`/`_mint`/`_burn` (additive
  wiring at the end of each; all previous revert conditions and events preserved
  in order). The monetary logic (mint/redeem formulas, fees, caps, workflow,
  state machine, oracles) is untouched.

## 6. Compile & verification evidence

Environment: solcjs is **not on PATH** in this sandbox (task description said it
would be); the installed `solc` npm package provides it at
`/home/z/my-project/node_modules/.bin/solcjs`:

```
$ /home/z/my-project/node_modules/.bin/solcjs --version
0.8.36+commit.8a079791.Emscripten.clang
```

### Commands

Plain CLI (matches `contracts/foundry.toml` optimizer settings; solcjs CLI has
no `--bin-runtime` or `--via-ir` flags, so creation-bytecode only):

```
$ cd /home/z/my-project/contracts/out-v3
$ /home/z/my-project/node_modules/.bin/solcjs --bin --abi --optimize --optimize-runs 200 ../MTQSigmaV3.sol -o .
# exit code 2 — solcjs CLI treats the EIP-170 size WARNING as failure-to-zero-warnings;
# there are NO compile errors. Creation bytecode: 48,485 bytes (non-via-ir, CLI default EVM).
```

Standard-JSON harness (replicates `foundry.toml`: optimizer on, runs=200,
via_ir=true; this is the canonical configuration): kept at
`contracts/out-v3/compile-standard.mjs`:

```
$ node compile-standard.mjs ../MTQSigmaV3.sol v3-permit-votes 200 true shanghai
# solc errors: 0, warnings: 1 (code size — see §7)
```

### Bytecode sizes (bytes) — EIP-170 deployed-runtime limit is 24,576

| Build | Creation | Deployed (runtime) | vs 24,576 |
|---|---|---|---|
| MTQSigmaV2 (recorded baseline) | — | 22,627 | within |
| V3 **before** this task (solcjs 0.8.36, opt 200, viaIR, shanghai) | 38,023 | **36,706** | **exceeds by 12,130** |
| stale `foundry-out` V3 artifact (earlier revision, forge/solc 0.8.20, via_ir) | 40,097 | 38,922 | exceeds by 14,346 |
| V3 after permit+votes (solcjs 0.8.36, opt 200, viaIR, shanghai) | 42,018 | **40,411** | **exceeds by 15,835** |
| **V3 after + Ext-3 A.3 `verifyIndexBase()`** (same config; `v3-verifyindexbase-result.json`) | 42,114 | **40,500** | **exceeds by 15,924** |
| V3 after permit+votes, opt runs=1 (size-focused), viaIR, shanghai | 41,691 | 40,084 | exceeds by 15,508 |
| V3 after permit+votes, opt 200, viaIR, cancun | 41,925 | 40,318 | exceeds by 15,742 |
| V3 after permit+votes, opt 200, **no viaIR**, shanghai | 48,506 | 46,982 | exceeds by 22,406 |

**Net cost of permit + votes: +3,705 deployed bytes** (36,706 → 40,411 at the
canonical config). **Net cost of the Ext-3 A.3 on-chain `verifyIndexBase()`
genesis self-verification view: +89 deployed bytes** (40,411 → 40,500). Compile
result: **0 errors** at every configuration tested; the only warning is the
EIP-170 size warning.

### Verification performed (beyond compilation)

1. **Storage layout diff** (§5): 0 existing-slot shifts; 4 appended slots.
2. **Canonical selectors confirmed** in the emitted ABI — `permit` `0xd505accf`,
   `DOMAIN_SEPARATOR()` `0x3644e515`, `delegates(address)` `0x587cde1e`,
   `delegate` `0x5c19a95c`, `delegateBySig` `0xc3cda520`, `getVotes` `0x9ab24eb0`,
   `getPastVotes` `0x3a46b1a8`, `getPastTotalSupply` `0x8e539e8c`, `clock()`
   `0x91ddadf4`, `CLOCK_MODE()` `0x4bf5d7e9`, `nonces(address)` `0x7ecebe00` —
   all byte-identical to the ERC reference signatures.
3. **Checkpoint algorithm property test** (JS mirror of
   `_writeCheckpoint`/`_lookupCheckpoint`): 500 pseudo-random op-sequences,
   ~300 lookups each; binary-search result ≡ linear-scan ground truth on every
   query; same-block coalescing and key-before-history → 0 verified.
4. **EIP-712 cross-check against ethers v6** (`contracts/out-v3/eip712-verify.cjs`):
   the contract's `DOMAIN_SEPARATOR` construction, the `Permit` digest and the
   `Delegation` digest all match `TypedDataEncoder` reference hashing exactly
   (domain name "MTQ Sigma V3", version "1", chainId, verifyingContract); a
   sign + `ecrecover` round-trip in the contract's `(v,r,s)` format succeeds.
5. **No Solidity test files were written** (per task boundary); the existing
   Foundry suite (`contracts/test/MTQSigmaV3.t.sol`) cannot run in this sandbox
   (no forge) and its coverage predates this feature.

## 7. EIP-170 deployment flag (honest record — no features stripped)

**The V3 contract exceeds the 24,576-byte EIP-170 limit — and already did BEFORE
this task** (36,706 bytes deployed pre-edit vs 24,576). Permit + Votes add
3,705 bytes (40,411 total). Per instructions, nothing was stripped and the
numbers are recorded honestly. Deployment considerations for the Committee:

- Standard Ethereum mainnet/L2 deployments will **reject** contract creation
  above 24,576 bytes ("code size exceeds limit"); the target chains (Monad /
  Arc / Robinhood Chain testnets) may or may not enforce EIP-170 — this is an
  **open verification item** (chain-config dependent).
- Candidate mitigations (Committee decision, NOT implemented here): split the
  votes/permit module into a separate contract the token delegates to, or
  refactor via libraries (delegatecall-out architecture); the count shows the
  pre-existing body — not the token standard — is the dominant size driver
  (12,130 bytes over before this task).
- `contracts/foundry-out/MTQSigmaV3.sol/MTQSigmaV3.json` is STALE (predates this
  task). The protocol owner must re-run `forge build` (foundry.toml: solc 0.8.20,
  optimizer 200, via_ir) to refresh it before deploying V3; fresh solcjs
  artifacts from this task live in `contracts/out-v3/`.

## 8. T-88 mapping ("Permits, snapshots, restrictions verified per OD-37")

| T-88 clause | Now REAL (source-level) | Still PENDING |
|---|---|---|
| Permits | `permit()` EIP-2612 with nonces, deadline, EIP-712 domain; digest verified vs ethers | Not executed on-chain; no Foundry test; not audited |
| Snapshots | ERC-20 Votes checkpoints (per-delegate + total supply), `getPastVotes`/`getPastTotalSupply`, block-number clock | Not executed on-chain; no Governor integration exists yet |
| Restrictions (i.e. NONE allowed) | transfer/transferFrom remain permissionless, not pause-gated; no cap (OD-29 OPEN); not upgradeable (Option A) | Verify again post-deployment on-chain |
| Cap policy | No fixed cap implemented; OD-29 remains OPEN | OD-29 Committee decision |
| Upgradeability | No proxy machinery exists in bytecode (Option A, UPGRADEABILITY.md §1) | Committee approval of UPGRADEABILITY.md still pending (OD-16) |

The mandate-register.ts OD-37 note ("OpenZeppelin ERC20Permit/ERC20Votes compiled
in foundry-out") describes library artifacts, not the MTQ contract — that
overclaim is eliminated by this implementation: the register's `codeRef`
(`contracts/MTQSigmaV3.sol`) now points at a contract that genuinely contains
the permit + votes code. Register **status labels** remain the orchestrator's to
integrate (this task did not touch mandate-register.ts).

## 9. Honest limitations

1. **Not deployed** — no bytecode is on any chain; all verification is
   compile-time + reference-tooling cross-checks.
2. **Not audited** — independent review required before mainnet (§25.5 gates).
3. **No Solidity tests** for permit/votes in this change (sandbox has no
   Foundry); the JS cross-checks in §6 are the current evidence.
4. **EIP-170**: V3 (with or without this feature) cannot deploy on EIP-170-
   enforcing chains as a single contract — see §7.
5. **EIP-5267** (`eip712Domain()`) is NOT exposed — wallets/integrations must
   use `DOMAIN_SEPARATOR()` (EIP-2612's discovery route). Optional follow-up.
6. **foundry-out is stale** — must be regenerated before deployment (§7).
7. This document does not extend the on-chain `getHonestStatus()` mask
   (0x3FFF): the 14 documented bits describe Blueprint-v25.3 architecture
   features; the OD-37 token standard is an Ext-3 external-spec item tracked
   here and in the registers.
