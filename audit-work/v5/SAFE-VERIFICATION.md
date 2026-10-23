# SAFE-VERIFICATION — OD-35 / T-87 On-Chain Verification Report

| | |
|---|---|
| **Date** | 2026-10-19 (reads executed 2026-10-19T15:18–15:23 UTC) |
| **Mandate ref** | MTQΣ v5.0+Ext **Extension 3, OD-35** ("Verify Safe configuration (threshold, signers, modules, guard)"), **T-87** (Safe on-chain verification — previously "not-demonstrated"), **C-040** ("Safe configuration assumed, not verified"), blocks Gate 5 |
| **Script** | `scripts/verify-safe.ts` (run: `bun run scripts/verify-safe.ts` from repo root) |
| **Machine evidence** | `audit-work/v5/safe-verification.json` (full raw returns, calldata, selectors, retry/error records — every value below is traceable to a field in that file) |
| **Target** | Genesis Reserve Safe `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` (`genesis.ts GENESIS_RESERVE_SAFE`; also `contracts.ts` "Safe (Multi-Sig)" on both chains) |
| **Expected configuration** | threshold **4 of 7** owners (the repo's standing "reported 4/7" claim — `mandate-register.ts` OD-35: "reported ≠ verified") |
| **RPC endpoints used** | Monad Testnet `https://testnet-rpc.monad.xyz` — chainId `0x279f` (10143) ✓ asserted · Arc Testnet `https://rpc.testnet.arc.io` — chainId `0x4cef52` (5042002) ✓ asserted. (Note: the older recorded Monad RPC `https://testnet-rpc.monadvision.com` in `contracts.ts` is dead and was not used.) |
| **Block heights at read time** | Monad **72,421,819** (`0x45111bb`) · Arc **68,031,046** (`0x40e1246`) — recorded via `eth_blockNumber` at the start of each chain's reads; individual reads executed at/after these heights |
| **Tooling** | ethers v6.17.0 `JsonRpcProvider` (staticNetwork pin per chain, batching disabled `batchMaxCount: 1`), read-only |

---

## §1 Method

- **Read-only only.** Every operation was `eth_chainId`, `eth_blockNumber`, `eth_getCode`, `eth_getStorageAt`, or a view-function `eth_call`. **No transaction was broadcast, no private key was read, nothing was signed, no state was changed, no balance was transferred.**
- `eth_chainId` was read raw and **asserted** against the expected chainId per chain before any other read (both matched; a mismatch would have failed loudly and forced an INCONCLUSIVE verdict — none occurred).
- Each individual read was retried **up to 3 attempts with linear backoff (800 ms, 1,600 ms)** and a 30 s per-attempt timeout; the recorded `attempts` field and every verbatim error are in the JSON. Revert-type errors were retried too — their determinism across attempts is itself recorded evidence.
- Function selectors (keccak256 computed live by ethers v6 `Interface`; **all confirmed by live behavior** — each returned cleanly ABI-decoded data on the target):
  - `getThreshold()` → `0xe75235b8`
  - `getOwners()` → `0xa0e67e2b`
  - `VERSION()` → `0xffa1ad74`
  - `nonce()` → `0xaffed0e0`
  - `getModulesPaginated(address,uint256)` → `0xcc2f8452` (called with `start = 0x0000000000000000000000000000000000000001` SENTINEL_MODULES, `pageSize = 10`)
  - `getGuard()` → `0xc9106389` and `guard()` → `0x7ceab3b1` (both tried, per OD-35/T-87 instruction)
  - ERC-20 probes: `totalSupply()` `0x18160ddd`, `symbol()` `0x95d89b41`, `name()` `0x06fdde03`, `decimals()` `0x313ce567`
  - Selector-correctness spot check (live): calling the Safe with `0xe34f3702` (an alternative selector sometimes mis-cited for `getThreshold()`) **REVERTS on both chains**, while `0xe75235b8` returns `uint256 1` — recorded in the run log.
- **Storage slots read (read-only `eth_getStorageAt`)**: proxy singleton at slot `0x0`; guard at `GUARD_STORAGE_SLOT = keccak256("guard_manager.guard.address") = 0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8` (both public guard getters revert on Safe v1.4.1 — it exposes no public guard getter — so the slot read is the authoritative guard evidence).
- Supplemental code-existence probes: `eth_getCode` for every conflicting recorded address (below), plus ERC-20 reads for token candidates, plus Safe-interface reads for recorded "Safe" claims, all in try/catch with verbatim error recording.

## §2 Safe verification results — `0xE718…A7D0`

| Read | Monad Testnet (block 72,421,819) | Arc Testnet (block 68,031,046) |
|---|---|---|
| `eth_getCode` (code exists / byte length) | **171 bytes** — prefix `0x608060405273ffffffffffff…` (Gnosis Safe proxy pattern; embeds the `masterCopy()` selector constant `0xa619486e` and slot-0 singleton load characteristic of the canonical SafeProxy runtime) | **171 bytes** — identical prefix |
| `getThreshold()` `0xe75235b8` | **`1`** (raw `0x…0001`) | **`1`** (raw `0x…0001`) |
| `getOwners()` `0xa0e67e2b` | **`["0x3C3932F865892EFabE45892f453f81B64f6c8d8c"]` — 1 owner** | **`["0x3C3932F865892EFabE45892f453f81B64f6c8d8c"]` — 1 owner** |
| `VERSION()` `0xffa1ad74` | **`"1.4.1"`** | **`"1.4.1"`** |
| `nonce()` `0xaffed0e0` | **`0`** (the Safe has never executed a transaction) | **`0`** |
| `getModulesPaginated(0x…01, 10)` `0xcc2f8452` | **`{ array: [], next: 0x0000000000000000000000000000000000000001 }` — 0 modules** | identical — **0 modules** |
| `getGuard()` `0xc9106389` | ✗ reverts (deterministically, 3 attempts) — v1.4.1 has no such function | ✗ reverts (deterministically, 3 attempts) |
| `guard()` `0x7ceab3b1` | ✗ reverts (deterministically, 3 attempts) — v1.4.1 has no public guard getter | ✗ reverts (deterministically, 3 attempts) |
| *extra:* `eth_getStorageAt` slot `0x0` (proxy singleton) | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762` | identical |
| *extra:* `eth_getCode` on singleton | **24,421 bytes** — the canonical Safe v1.4.1 mastercopy | identical |
| *extra:* `eth_getStorageAt` guard slot `0x4a204f62…c34c8` | **`0x0000…0000` — guard = address(0): NO guard configured** | identical |

The sole owner address `0x3C3932F865892EFabE45892f453f81B64f6c8d8c` is byte-identical to `DEPLOYER_WALLET` in `contracts.ts` and the `deployer` field in `contracts/deployments/Monad-Testnet.json` / `Arc-Testnet.json`.

## §3 Verdict per chain

| Chain | Verdict | Exact on-chain values vs expected 4/7 |
|---|---|---|
| **Monad Testnet** | **CRITICAL FINDING** | Code exists (171-byte Safe v1.4.1 proxy; singleton `0x29fcB43b…C762`, VERSION `1.4.1`), but **threshold = 1** (expected **4**) and **owner count = 1** (expected **7**), sole owner = the deployer EOA `0x3C3932…8d8c`. nonce = 0, modules = 0, guard = address(0). The reported 4/7 configuration is **NOT** what the chain says. |
| **Arc Testnet** | **CRITICAL FINDING** | Identical configuration: **threshold = 1** (expected **4**), **owner count = 1** (expected **7**), sole owner = the deployer EOA `0x3C3932…8d8c`, VERSION `1.4.1`, nonce 0, modules 0, guard address(0). |

**Reading of the finding:** the Genesis Reserve Safe *is* a genuine Gnosis Safe (v1.4.1 proxy + mastercopy, both chains) — but it is a **1-of-1 Safe under the unilateral control of the deployer EOA**, never used (nonce 0), with no modules and no guard. It is **not** the mandated 4/7 Constitutional multi-sig. OD-35 is therefore no longer "unverified" — it is now **verified and failing**. (Neither chain produced `NOT DEPLOYED` or `INCONCLUSIVE`.)

## §4 Supplemental address-discrepancy reconciliation

All probes are read-only `eth_getCode` at the block heights in the header. "ERC-20" columns are live `name()/symbol()/decimals()/totalSupply()` reads. Full raw values (and the 69-byte code prefix of each contract) are in `safe-verification.json → chains.*.codeProbes`.

### Monad Testnet (block 72,421,819)

| Recorded role (repo source) | Address | Code | ERC-20 evidence |
|---|---|---|---|
| MTQ candidate A — `contracts.ts MONAD_TESTNET "MTQ Token"` (v5.0 §5.1 record) | `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` | **6,681 bytes** | **LIVE token** — name `MITHQAL`, symbol `MTQ`, 18 dec, supply **310.949** |
| MTQ candidate B — `contracts.ts CANONICAL_MTQ_ADDRESSES.monad` + `Monad-Testnet-Ecosystem.json "MTQToken"` | `0x0Ac20360234b4C988a19586CBe55733e18A5982f` | **3,413 bytes** | **LIVE token** — name `MTQΣ`, symbol `MTQ`, 18 dec, supply **1,000,000.00000001998** |
| MTQSigma — `contracts/deployments/Monad-Testnet.json` | `0x5D9564C27111EA65Da3228a79833F0FF129bfd4a` | **11,666 bytes** | **LIVE token** — name `MTQΣ`, symbol `MTQ`, 18 dec, supply **1,012,987** |
| Oracle — `contracts.ts` (⚠ also recorded as Arc "Safe" in `Arc-Testnet-Ecosystem.json`) | `0xDfcA66ac0450C9AB86307af1942E157C5A4DB713` | **5,273 bytes** | n/a (code exists) |
| Governance — `contracts.ts` (⚠ identical address recorded for Arc "Governance") | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | **25,819 bytes** | n/a (code exists) |
| Reserve — `contracts.ts` (⚠ same address recorded as Robinhood "Takaful") | `0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177` | **5,703 bytes** | n/a (code exists) |
| Mint — `contracts.ts` | `0x197e9CB28216dfe18a199b4c2930F74C2F460809` | **5,644 bytes** | n/a (code exists) |
| Redeem — `contracts.ts` | `0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4` | **6,170 bytes** | n/a (code exists) |
| Algorithm — `contracts.ts` | `0x8839ce50e8D414005518769999c0A5b961D00CB2` | **2,546 bytes** | n/a (code exists) |
| *extra:* "Safe" claim — `Monad-Testnet-Ecosystem.json "Safe"` (conflicts with `0xE718…`) | `0x74353601354c0b71df5B16Fe1B28c7F0831dd316` | **3,321 bytes** | **NOT a Safe** — all 7 Safe-interface reads (`getThreshold/getOwners/VERSION/nonce/getModulesPaginated/getGuard/guard`) **REVERT (0/7 succeeded)** |

### Arc Testnet (block 68,031,046)

| Recorded role (repo source) | Address | Code | ERC-20 evidence |
|---|---|---|---|
| MTQ candidate A — `contracts.ts ARC_TESTNET "MTQ Token"` (v5.0 §5.1 record) | `0x237c3Aa2B79248f86f6523D3890095BCd1996601` | **3,474 bytes** | **LIVE token** — name `MITHQAL`, symbol `MTQ`, 18 dec, supply **1,000** |
| MTQ candidate B — `contracts.ts CANONICAL_MTQ_ADDRESSES.arc` + `Arc-Testnet-Ecosystem.json "MTQToken"` | `0x24203404B9b971C907e8Ced96106Fa74380d9897` | **3,413 bytes** | **LIVE token** — name `MTQΣ`, symbol `MTQ`, 18 dec, supply **1,000,000.00000001998** |
| MTQSigma — `contracts/deployments/Arc-Testnet.json` | `0x826b82F79FD6c5347cDC568B1d0A7918128B63c1` | **11,551 bytes** | **LIVE token** — name `MTQ Sigma`, symbol `MTQ`, 18 dec, supply **1,005,889** |
| Oracle — `contracts.ts` (⚠ same address recorded as Robinhood "MockUSDC") | `0xFd2B8d176bf059287638Db30D02C6651dA02861e` | **2,601 bytes** | n/a (code exists) |
| Governance — `contracts.ts` (⚠ identical to the Monad "Governance" address) | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | **13,129 bytes** | n/a (code exists) |
| Reserve — `contracts.ts` | `0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471` | **2,897 bytes** | n/a (code exists) |
| Mint — `contracts.ts` | `0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa` | **2,847 bytes** | n/a (code exists) |
| Redeem — `contracts.ts` | `0xcAde4594177829597882555Ff57d0e34092daF8e` | **3,037 bytes** | n/a (code exists) |
| Algorithm — `contracts.ts` | `0x62f8E5243f32eE5C87a14A7896C61104aD9e7727` | **1,237 bytes** | n/a (code exists) |
| *extra:* "Safe" claim — `Arc-Testnet-Ecosystem.json "Safe"` (⚠ same address recorded as Monad "Oracle" in `contracts.ts`) | `0xDfcA66ac0450C9AB86307af1942E157C5A4DB713` | **3,321 bytes** | **NOT a Safe** — all 7 Safe-interface reads **REVERT (0/7 succeeded)** |

### Reconciliation conclusions (each traceable to the JSON `codeProbes` records)

1. **Every probed address has live code** — no probe returned "no code at block N". The address book is not stale-dead, it is *multiply inconsistent*.
2. **Which address is the live MTQ token per chain: there are THREE live MTQ tokens per chain, one per conflicting repo record.** The v5.0 §5.1 record (`0x9e6E…`/`0x237c…`) is a live token named **"MITHQAL"** (supplies 310.949 / 1,000); the `CANONICAL_MTQ_ADDRESSES`+Ecosystem-JSON record (`0x0Ac2…`/`0x2420…`) is a live token named **"MTQΣ"** with identical bytecode (3,413 bytes, identical 69-byte prefix) and identical supply (1,000,000.00000001998) on both chains — the only record that is demonstrably the *same* contract cross-chain; the deployment-JSON record (`0x5D95…`/`0x826b…`) is a live token (name `MTQΣ` on Monad, `MTQ Sigma` on Arc; supplies 1,012,987 / 1,005,889 — different deployments).
3. **The Ecosystem-JSON "Safe" records are NOT Safes.** `0x7435…d316` (Monad) and `0xDfcA…713` (Arc) share identical bytecode (3,321 bytes, identical prefix) and revert on all seven Safe-interface reads on both chains. Neither is a Gnosis Safe.
4. **The same hex address hosts different contracts on different chains** — `0xDfcA…713`: 5,273 bytes on Monad (recorded "Oracle") vs 3,321 bytes on Arc (recorded "Safe" — not a Safe); `0xE35a…Bd66`: 25,819 bytes on Monad vs 13,129 bytes on Arc (both recorded "Governance"). The repo's address book mixes chains/roles in at least these four places (plus the cross-chain contaminations already recorded in `ROLE_ROTATION.md §8`).
5. **The only genuine Gnosis Safe found anywhere in the probed records is `0xE718…A7D0`** — and it is 1/1 deployer-controlled (§3).

## §5 Register impact — RECOMMENDATIONS ONLY (no register was edited by this task)

- **OD-35** (`mandate-register.ts`, status `VERIFICATION-PENDING`): the mandated reads have now been performed with evidence; recommend moving to a status reflecting **verified-and-failing** (e.g. `VERIFIED-FAILED (CRITICAL FINDING)`): on-chain threshold=1, owners=1 (deployer EOA), v1.4.1, nonce=0, no modules, no guard — **not 4/7**. Gate 5 remains blocked. Recommend OD-35 stay open as a corrective item: reconfigure the Safe (add the 7 Constitutional signers, set threshold 4), then re-run `scripts/verify-safe.ts` to obtain `VERIFIED 4/7`.
- **T-87** (currently "not-demonstrated"): recommend **demonstrated** — the Safe configuration reads were performed live on both chains; the demonstration's *result* is the §3 critical finding (a negative result is still a demonstration of the test).
- **C-040** ("Safe configuration assumed, not verified"): recommend resolving against this evidence — the assumption is **disproved**; the conflict should be re-labeled to the live finding (1/1 deployer-controlled).
- **genesis.ts / contracts.ts copy** (for the orchestrator, not edited here): the step-5 narrative "(4/7 multi-sig — OD-35 verification pending)" and the "Safe (Multi-Sig)" registry rows are contradicted by the on-chain 1/1 evidence and should be relabeled to "on-chain verified 1/1 (OD-35 critical finding; 4/7 reconfiguration pending)".
- **New conflict worth registering** (recommend): three distinct live MTQ token contracts exist per chain (§4.2) — the v5.0 §5.1 "MITHQAL" record vs the canonical-map/Ecosystem record vs the deployment-JSON record — plus four cross-chain address-book contaminations (§4.4). Governance must declare which token contract is canonical before any role-rotation rehearsal (T-35/T-87 prerequisite).

## §6 Honest limitations

1. **Single point in time.** All reads were taken 2026-10-19 ~15:22 UTC at Monad block 72,421,819 / Arc block 68,031,046. A Safe's owner set and threshold are mutable by its current owner at any time; this evidence certifies the configuration *at those blocks only*. Re-run the script after any reconfiguration. (Per-chain `blockNumber` is recorded once per chain; individual probes executed at/after that height — testnets advance quickly.)
2. **Explorer pages not independently cross-checked.** `testnet.monadscan.com` / `testnet.arcscan.app` (and the divergent `monadexplorer.com` URLs in `contracts.ts`) were not fetched; all conclusions rest on the raw RPC reads.
3. **Signers not identity-verified.** The single on-chain owner `0x3C39…8d8c` is byte-identical to the recorded `DEPLOYER_WALLET`, but no off-chain identity attestation exists, and the mandate's "7 signers" cannot be identified because only one owner exists. No signer-set membership beyond the raw address is claimed.
4. **Guard evidence rests on the storage-slot read.** Safe v1.4.1 exposes no public guard getter (both `getGuard()`/`guard()` revert deterministically), so the guard=address(0) finding is from `eth_getStorageAt` at `keccak256("guard_manager.guard.address")` = `0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8` — the slot documented in Safe's GuardManager for v1.3.0/v1.4.1; that constant was computed live by ethers v6 keccak but not diffed against the Safe source artifact in this run.
5. **Proxy identification is behavioral.** The address is identified as a Safe v1.4.1 proxy from: 171-byte proxy code (prefix includes the `masterCopy()` selector constant `0xa619486e`), slot-0 singleton `0x29fcB43b…C762` with 24,421 bytes of code (consistent with the canonical Safe v1.4.1 mastercopy), `VERSION()="1.4.1"`, and clean decodes of the canonical Safe view functions. The full bytecode was not hash-compared against official Safe artifacts.
6. **One public RPC endpoint per chain; no multi-node cross-validation.** A malicious or faulty RPC could fabricate these results; this is mitigated — not eliminated — by two independent chains returning mutually coherent values consistent with the repo's own deployment records.
7. **Cross-chain "same bytecode" claims** (candidate B tokens; the 3,321-byte non-Safe pair) are inferred from identical byte-length **and** identical 69-byte code prefix, not a full runtime-code hash comparison.
8. **Out of scope, still unknown:** the Safe's token balances were **not** read (`balanceOf` is outside OD-35's configuration scope) — whether the 1M genesis MTQ actually sits in this Safe is *not* verified by this run; likewise the Safe's transaction history (nonce 0 is the only history evidence collected).

---

*Every claim in this report is traceable to a raw read record in `audit-work/v5/safe-verification.json` (fields: `chains.*.safeReads.*.raw/decoded/error/attempts`, `chains.*.safeFindings`, `chains.*.codeProbes.*`). Script: `scripts/verify-safe.ts` (read-only, no keys, no signing).*
