# MTQΣ — TASK 10 · D2: CANONICAL CONTRACT & ADDRESS-BOOK PROPOSAL (DRAFT — FOR HUMAN APPROVAL)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

**No canonical selection is made automatically.** This document proposes a structure and a decision
package; the C-041 choice between candidate families is expressly reserved for constituted human
governance. Fresh identity anchors: Monad block 73,167,496 / Arc block 68,475,006 / Robinhood block
140,564,404 / Solana slot ≈513.8M — all probed read-only 2026-10-22.

---

## 1. Proposed structure (three tiers)

**Tier 1 — ACTIVE (the single operational address book; `src/lib/mtq/contracts.ts` stays the source of
truth):**

| Chain | Contract | Address | Runtime keccak (fresh) | Notes |
|---|---|---|---|---|
| Monad 10143 | MTQ | `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` | `0x9057c3e6…55bbb` (6,681 B) | owner-declared; name "MITHQAL" (conflict, D6-1) |
| Monad | Governance | `0xE35a…EaBd66` | `0xb0624cbd…6057a` (25,819 B ⚠ oversized) | different code from Arc twin (see §3) |
| Monad | Safe (Genesis) | `0xE718…BfA7D0` | `0xd7d408eb…331fb4c` (171 B, v1.4.1 proxy) | 1/1 deployer — not yet the mandated 4/7 |
| Monad | Algorithm / Reserve / Mint / Redeem / Oracle / Takaful | `0x8839…` / `0x1bbC…` / `0x197e…` / `0x9632…` / `0xDfcA…` / `0x3eC2…` | fresh keccaks in `evidence/onchain-evm.json` | deployer DEFAULT_ADMIN on all |
| Arc 5042002 | MTQ | `0x237c3Aa2…1996601` | `0x0183b25e…12fcf` (3,474 B) | oldest of 4 Arc generations (2026-08-07) |
| Arc | Governance / Safe | same hexes as Monad | `0x214a785c…4b82` (13,129 B) / byte-identical 171 B Safe | same-address-different-code (Governance); twin Safes (separate instances) |
| Arc | Algorithm / Reserve / Mint / Redeem / Oracle / Takaful | `0x62f8…` / `0x27a1…` / `0x0dd8…` / `0xcAde…` / `0xFd2B…` / `0xA3B8…` | fresh keccaks in evidence | deployer DEFAULT_ADMIN on all |
| Solana devnet | SPL mint | `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4` | Token program account (82 B) | mintAuthority `DbFjz…QhXb3`; decimals 18 (anomaly); supply u64-max (D6-8) |
| Solana devnet | Wallet (mint authority) | `DbFjzWcD…fPQhXb3` | — | key NOT in repo (census, D1 §4) |

**Tier 2 — SUPERSEDED / PROVENANCE (retain, never active, never rendered as custody):**

| Chain | Generation | Address | Identity (proven) |
|---|---|---|---|
| Monad | gen-A "MTQΣ" (2026-09-06 manifest) | `0x5D9564C2…129bfd4a` | 11,666 B, keccak `0xa7331051…e92e`, **Ownable**, self-custodies its own 1,000,000 genesis |
| Monad | gen-B "MTQΣ" (OD-35-era) | `0x0Ac20360…18A5982f` | 3,413 B, keccak `0x31496b92…0180`, AccessControl, deployer ≈ sole holder |
| Arc | gen-A "MTQ Sigma" (2026-09-05) | `0x826b82F7…128B63c1` | 11,551 B, Ownable, self-custodies its own 1,000,000 |
| Arc | gen-B "MTQΣ" | `0x24203404…80d9897` | byte-identical twin of Monad gen-B (`0x31496b92…`) |
| Arc | gen-C "MTQΣ" (verify-key script era) | `0x5C728F72…93A2563` | **byte-identical to Monad gen-A** (`0xa7331051…`), self-custodies 1,000,000 |
| Solana | superseded mint | `2EaK5cQt…WRLSf3gY` | mint+freeze authority = `4saT…` (EXPOSED key, D1); supply 4.477988020393345024 |
| EVM (all) | Ecosystem manifests 2026-09-06 (`*-Ecosystem.json`) | 10 rows/chain | **"Safe" rows are NOT Safes** — keccak-proven non-Safes (3,321 B on Arc/RH; different code on Monad); MTQToken rows = gen-B twins |

**Tier 3 — THIRD-CHAIN PROVENANCE (Robinhood Chain Testnet 46630 — RPC ALIVE, corrected):**

| Contract | Address | Fresh evidence (block 140,564,404) |
|---|---|---|
| MTQToken | `0xAF5B8565…B644C5A5` | **byte-identical to gen-B twins** (`0x31496b92…`); "MTQΣ"; supply ≈ 1,001,000.00000000002997 |
| MTQSigma | `0xA3B89Ffd…09044EF0` | **byte-identical to gen-A family** (`0xa7331051…`); same hex hosts Arc's CURRENT Takaful |
| "Safe" | `0xa3CE28A1…bcd75691` | 3,321 B; getThreshold/getOwners/nonce all REVERT → **NOT a genuine Safe** |
| Governance | `0x80FF03DA…Aa732B56` | 3,487 B `0xcf0c00d3…0ac3` |

## 2. Hex-collision / contamination register (address rows that mean different things per chain)

| Hex | Monad meaning | Arc meaning | Robinhood meaning |
|---|---|---|---|
| `0xE35a…EaBd66` | Governance 25,819 B | Governance 13,129 B (**different code**) | — |
| `0xDfcA66ac…5A4DB713` | **current Oracle** | gen-era "Safe" row (3,321 B non-Safe) | — |
| `0x1bbCd78E…AC816177` | **current Reserve** | — | Ecosystem "Takaful" |
| `0xFd2B8d17…51dA02861e` | — | **current Oracle** | Ecosystem "MockUSDC" |
| `0xA3B89Ffd…09044EF0` | — | **current Takaful** | "MTQSigma" (gen-A build) |
| `0xE718…BfA7D0` | Genesis Safe (1/1) | Genesis Safe (1/1, separate instance) | — |
| `0x5D9564C2…129bfd4a` | gen-A token | — | Ecosystem "RedeemContract" row |

Same-address-different-code across chains is mechanically expected (same deployer EOA, same nonce, different
initcode) — but **one address-book row must never be treated as "one contract" cross-chain**.

## 3. Governance at one address, two implementations — investigation result

`0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` holds **bytecode-distinct OZ-Governor builds** on the two chains
(25,819 B / 50 selectors on Monad; 13,129 B / 74 selectors on Arc — Arc build exposes MORE extensions:
`getProposalId`, additional unresolved selectors, OZ-v5 error selectors like `CheckpointUnorderedInsertion` /
`FailedCall`; both expose propose/queue/execute/cancel/relay/ERC-1271 `isValidSignature`, votingDelay()=1,
quorumNumerator()=1). Cause: **same deployer EOA at the same CREATE nonce on both chains yields the same
address; different initcode (two different source versions) yields different runtime code.** Consequence: the
address book conflates two distinct governance contracts; cross-chain governance continuity DOES NOT exist
despite the identical hex. Resolution proposal: split into per-chain rows with distinct keccaks (Tier 1) and
record the divergence as a permanent design note (D6-7).

## 4. Decisions required from humans (no auto-selection)

1. **C-041 canonical family** — candidates on the table: (a) current owner-declared "MITHQAL" set (oldest
   on Arc; name conflicts with mandate's MTQΣ identity; supplies diverge), (b) gen-A/"MTQΣ" family
   (mandate-conformant name; self-custodied genesis; Ownable), (c) fresh conformant deployment after
   EIP-170 remediation + key rotation. **This audit recommends none and selects nothing.**
2. Name identity: "MITHQAL" vs "MTQΣ" vs "MTQ Sigma" (three live names, one mandate).
3. Solana decimals policy (D6-8): ≤9 or accept u64-representability limits.
4. Whether the Robinhood set should remain Tier-3 provenance or be decommissioned explicitly.
5. Approval of K-1/K-2 purge plan before any public exposure of this repo.

**Nothing in this proposal changes any address, contract, or configuration.**
