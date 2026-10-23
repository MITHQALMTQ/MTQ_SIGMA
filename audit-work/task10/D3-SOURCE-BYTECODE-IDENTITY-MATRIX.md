# MTQΣ — TASK 10 · D3: SOURCE & BYTECODE IDENTITY MATRIX + DEPLOYABILITY

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

Fresh anchors: Monad block 73,167,496 · Arc block 68,475,006 · Robinhood block 140,564,404 (2026-10-22).
Method: `eth_getCode` → runtime keccak256 + size; PUSH4 selector extraction; local foundry-ABI selector
dictionary; 4byte.directory public registry (76/124 unknowns resolved — **indicative only**, registry entries
can be user-submitted); OpenChain lookup unavailable (HTTP 500). Evidence:
`evidence/onchain-evm.json`, `evidence/supplemental-generations.json`, `evidence/onchain-robinhood.json`,
`evidence/raw-onchain.jsonl`.

---

## 1. Runtime identity matrix (current estate)

| Contract (chain) | Size | Fresh keccak | Local-source match? | Explorer-verified source? |
|---|---|---|---|---|
| MTQ (Monad) | 6,681 B | `0x9057c3e6…55bbb` | **NO** (V1 5,948 B `0xe409ccc7…` / V2 30,608 B / V3 38,921 B all differ) | NO (Monadscan CF-gated) |
| MTQ (Arc) | 3,474 B | `0x0183b25e…12fcf` | **NO** — and differs from Monad MTQ | NO (`is_verified: false`, Task 9) |
| Governance (Monad) | **25,819 B ⚠** | `0xb0624cbd…6057a` | NO | NO |
| Governance (Arc) | 13,129 B | `0x214a785c…4b82` | NO — differs from Monad twin | NO |
| Safe (both) | 171 B ×2 | `0xd7d408eb…331fb4c` byte-identical | n/a (canonical Gnosis SafeProxy v1.4.1; singleton `0x29fcB43b…C762` at slot 0) | genuine-by-config |
| Algorithm | 2,546 B / 1,237 B | `0x20c147d7…` / `0x0c0cd82d…` | NO / NO | NO |
| Reserve | 5,703 B / 2,897 B | `0x04a7116d…` / `0x79e16139…` | NO / NO | NO |
| Mint | 5,644 B / 2,847 B | `0x2373495e…` / `0xe6346a6f…` | NO / NO | NO |
| Redeem | 6,170 B / 3,037 B | `0x8e8538e5…` / `0x410c8d36…` | NO / NO | NO |
| Oracle | 5,273 B / 2,601 B | `0xf057e6e5…` / `0x0c14190d…` | NO / NO | NO |
| Takaful | 6,043 B / 3,033 B | `0xb28868f6…` / `0xde0ba8da…` | NO / NO | NO |

**Cross-chain module divergence:** every "same" module differs in size and keccak between chains. Arc modules
embed OZ-v5-style custom-error selectors (`AccessControlUnauthorizedAccount`, `ReentrancyGuardReentrantCall`,
`Panic`), Monad modules do not → the two chains' module sets are **different source/compiler generations**, not
deployments of one codebase. Same for the MTQs (Arc MTQ carries the v5 error selectors; Monad MTQ does not).

**Conclusion:** **authoritative source identity CANNOT be established for ANY of the 18 deployed EVM
contracts.** Distinguishing genuine mismatch from mere metadata differences is moot at this layer — even
metadata-stripped local artifacts match nothing (Task 9 hash sweep + this session's re-probe). Source
publication/verification on both explorers (N-01) is the unblocking owner action.

## 2. Function-surface discovery (selector-level, from deployed bytecode)

**Both MTQ tokens** expose the full OZ stack: ERC20 + AccessControl (hasRole/getRoleAdmin/grantRole/revokeRole/
renounceRole) + Pausable (pause/unpause/paused) + **`mint(address,uint256)`** + burn/burnFrom + supportsInterface.
**Neither exposes `cap()`** (probe reverts) → **no on-chain supply cap exists on either token**; scarcity is
role-policy only. Monad MTQ has 25 selectors, Arc 37 — different function sets, two implementations.

**Modules (both chains)** expose: `mtq()`, `reserve()`, `algorithm()`, `setReserve(address)`, `FEE_RATE()`,
`FEE_CAP()`, `FEE_DENOMINATOR()`, `reserveRatio()`, `getNAV()` (Reserve), `removeReserve(bytes32,uint256)`
(Reserve), `redeem(uint256)` (Redeem — plus balanceOf/transferFrom), **`mint(address,uint256)`** (Mint module,
both chains), full AC role surface with `ADMIN_ROLE()` + `MINTER_ROLE()` constants. Gaps (unresolved selectors)
are listed in evidence and remain UNVERIFIED identities.

**Governors (both chains)** expose OZ Governor families: propose/queue/execute/cancel/relay/
castVote(WithReason/WithParams)/proposal*(…)/quorum/votingDelay/votingPeriod/proposalThreshold/setVotingDelay/
setVotingPeriod/setProposalThreshold/updateQuorumNumerator/`isValidSignature` (ERC-1271)/`version()`; votingDelay
= 1, quorumNumerator = 1 (probed). Arc build adds `getProposalId` + more. proposalCount() reverts on both →
non-standard/incomplete Governor storage or older lib mix. **Who may propose/execute is UNESTABLISHABLE
without source** — treat the Governor pair as a live, unassessed authority surface (D4).

**Safe proxies** carry 0 extractable selectors (pure proxy) — config verified by calls (D4).

## 3. Generation families (byte-identity proven)

| Family | Bytecode keccak | Members |
|---|---|---|
| gen-A family (11,666/11,551 B, **Ownable**, self-custody genesis) | `0xa7331051…e92e` (identical across 11,666 B members) | Monad `0x5D95…` · Arc gen-C `0x5C72…` · **Robinhood "MTQSigma" `0xA3B8…`** · Arc gen-A `0x826b…` (11,551 B sibling) |
| gen-B family (3,413 B, AccessControl) | `0x31496b92…0180` | Monad `0x0Ac2…` · Arc `0x2420…` · **Robinhood "MTQToken" `0xAF5B…`** |
| current MITHQAL | two distinct implementations | Monad 6,681 B / Arc 3,474 B |

## 4. Deployability / runtime-size limits per intended target chain

- **EIP-170 canonical limit: 24,576 B.** On it: V2 30,608 B (over +6,132), V3 38,921 B (over +14,345), best-case
  V2 with viaIR 24,718 B (**over by 142** — C-044). The `MTQSigmaV2-PENDING.json` claim of "23,220 B with
  viaIR" **matches no source in git** — unproven claim, preserved as a conflict (D6-11).
- **Monad testnet demonstrably accepts >24,576 B** (live Governance 25,819 B) — chain-specific leniency, NOT
  portable: the same artifact would be undeployable on canonical mainnet EVMs (Ethereum/L2s) and is NOT proven
  deployable on Arc (no oversized Arc deployment exists in evidence). **No portability claim is made beyond
  this evidence.**
- Solana: no EVM-size analog; the analogous structural limit is the **u64 supply field** (D5 §4) — the current
  18-decimal mint cannot represent supplies > ~18.4467 whole tokens, and the scripted "10B × 10¹⁸" mint
  (`solana-create-fresh.ts`) **arithmetically exceeds u64 and would revert** (D6-8).

## 5. What would close this item (owner actions, no on-chain change)

N-01: publish + verify sources on both explorers (Arc Blockscout is reachable and accepts verification;
Monadscan is Cloudflare-gated — owner-side action), then re-run this matrix: selector tables become verifiable
ABIs, and the "UNVERIFIED identities" gaps close. R-06: produce a ≤24,576 B reproducible build (viaIR alone
is insufficient per C-044 best-case) with green Foundry runs before ANY redeploy.
