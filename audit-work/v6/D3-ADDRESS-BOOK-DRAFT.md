# D-3 — CORRECTED CANONICAL ADDRESS BOOK (DRAFT — FOR HUMAN APPROVAL ONLY)

**MTQΣ — Evidence Reconciliation and Pre-Remediation Control Directive (§4, §7.3)**
This address book is a **review artifact**. Per directive: no canonical token was auto-selected; no address was altered in any configuration file; no supply was moved. Matching names, symbols, or supplies are **not** treated as identity proof — identity is established only by **keccak256 of full runtime bytecode** (Gen-3 reads, `audit-work/v6/custody-inventory-probe.json`).

**Status: DRAFT — NOT SIGNED OFF. Every selection below requires an explicit human governance decision (D-5, R-03).**

---

## 1. Monad Testnet (chainId 10143 — asserted at every probe)

| # | Address | Recorded role(s) in repo | Live identity (on-chain) | Runtime code | Deployment tx recorded | Suitability for future approved use |
|---|---|---|---|---|---|---|
| M-1 | `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` | mandate Part 1.1 "MTQ.sol"; `contracts.ts MONAD_TESTNET "MTQ Token"` | name **"MITHQAL"**, symbol MTQ, 18 dec, supply **310.949** | 6,681 B · keccak `0x9057c3e61d81f7d3e261f71b4cb5710a2d5043666766894772459dd643d55bbb` | none | ⚠ name contradicts the mandate's token identity; small supply; **not** cross-chain-identical. Conditional — governance decision required. |
| M-2 | `0x0Ac20360234b4C988a19586CBe55733e18A5982f` | `CANONICAL_MTQ_ADDRESSES.monad`; Ecosystem-JSON "MTQToken" | name **"MTQΣ"**, MTQ, 18 dec, supply **1,000,000.00000001998** | 3,413 B · keccak `0x31496b929dbea855c0a5fd0736f42afd0b6490840b71708023c8212d168c0180` — **byte-identical to Arc A-2** | none | ⚠ **only record that is provably the same contract cross-chain**; but 100% of supply in deployer EOA (C-043) and simple ERC20 (no MTQSigma protocol features). **Candidate for canonical — requires governance declaration + custody remediation first.** |
| M-3 | `0x5D9564C27111EA65Da3228a79833F0FF129bfd4a` | deployment-JSON "MTQSigma" | name **"MTQΣ"**, MTQ, 18 dec, supply **1,012,987** | 11,666 B · keccak `0xa73310510ce003d5c7ba9b6a8eacd150488d11997d643f369e16d77df900e92e` | **`0x89c47bb8aa1950a0077703056ec7013bc5bf6b8795ba0cbca17e023cf8fe26b0`** (2026-09-06T14:07:45Z) | ⚠ the only candidate with a recorded deployment transaction; MTQSigma-protocol family; **genesis self-custody bug (C-046)** — 1M sits inside the token contract; owner = deployer. Conditional. |
| M-4 | `0x28a2f9812BeC1252eee3992D56e5Bbd51393d6DE` | deployment-JSON "MockUSDC" | "USD Coin (Mock Pilot)", USDC, 6 dec, supply **1,100,000** | (probed via reads) | `0x212da690728c621d44e69b00d3906427459413187ff9a531e96b60b877c576a9` | ⚠ ⚠ same hex recorded as **Arc "MintContract"** (contamination C-042-6). Reserve asset; **100% in deployer EOA (C-047)**. |
| M-5 | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | Genesis Reserve Safe (mandate, both chains) | Gnosis Safe v1.4.1 proxy, 1/1 deployer, nonce 0, zero assets | 171 B · keccak `0xd7d408ebcd99b2b70be43e20253d6d92a8ea8fab29bd3be7f55b10032331fb4c` (identical cross-chain) | none recorded | the **only genuine Safe** in any record — but NOT the mandated 4/7 (OD-35 critical). Must be reconfigured (R-02) before any custody role. |
| M-6 | `0x74353601354c0b71df5B16Fe1B28c7F0831dd316` | Ecosystem-JSON "Safe" + PAUSER_on_Safe | **NOT a Safe — 0/7 Safe-interface reads revert**; 3,321 B · keccak `0x3c6c7d2580a18c85428d7ad9da6d9daa114867c95a358ead58ab9ba47be6c04e` (byte-identical to Arc false-Safe A-5) | — | ✗ **false Safe record — remove from any custody role after approval.** |
| M-7 | `0xDfcA66ac0450C9AB86307af1942E157C5A4DB713` | `contracts.ts` "Oracle" (code verified-present, 5,273 B, keccak `0xf057e6e5a983c585a46c558402738f2ba72bf5f5e8acd8a2a6e9eaa857ded2e7`) | — | also recorded as **Arc Ecosystem-JSON "Safe"** (where it is a 3,321-B non-Safe) — same hex, different contracts per chain (C-042-1) | ABI unpublished; feed contents UNVERIFIED | shadow-only until real-feed verification (D-1 §6.3). |
| M-8 | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | "Governance" on BOTH chains | different code per chain: 25,819 B (keccak `0xb0624cbd…`) here | — | ⚠ same hex recorded on Arc with 13,129 B code — different contracts (C-042-2). |

*Unprobed Monad records: none outstanding.*

## 2. Arc Testnet (chainId 5042002 — asserted at every probe)

| # | Address | Recorded role(s) | Live identity | Runtime code | Deployment tx recorded | Suitability |
|---|---|---|---|---|---|---|
| A-1 | `0x237c3Aa2B79248f86f6523D3890095BCd1996601` | mandate Part 1.2 "MTQ.sol"; `contracts.ts ARC_TESTNET "MTQ Token"` | name **"MITHQAL"**, MTQ, 18 dec, supply **1,000** | 3,474 B · keccak `0x0183b25ee34b9f8e7d18e976eadc6fb021652f9b52c5d6876a536aad92d12fcf` | none | ⚠ different contract from Monad M-1 (despite same recorded role). Conditional. |
| A-2 | `0x24203404B9b971C907e8Ced96106Fa74380d9897` | `CANONICAL_MTQ_ADDRESSES.arc`; Ecosystem-JSON "MTQToken" | name **"MTQΣ"**, MTQ, 18 dec, supply **1,000,000.00000001998** | 3,413 B · keccak **`0x31496b929dbea855c0a5fd0736f42afd0b6490840b71708023d8212d168c0180`** = Monad M-2 | none | **the only cross-chain-identical token** (keccak-proven). Candidate for canonical — governance decision + custody remediation required. |
| A-3 | `0x826b82F79FD6c5347cDC568B1d0A7918128B63c1` | deployment-JSON "MTQSigma" | name **"MTQ Sigma"**, MTQ, 18 dec, supply **1,005,889** | 11,551 B · keccak `0x0e6a6e1ad373c8e7c005c51266fb9d5bb27c7e37a294741e4f86d34ac6709a0d` | **`0xd9accce91d487f76bda3c854ec0349debe775f87e32010ffefaa6540e2f9c45b`** (2026-09-05T18:22:32Z) | ⚠ genesis self-custody bug (C-046); owner = deployer; different contract from Monad M-3. Conditional. |
| A-4 | `0x334D14E7E39e1f02a60fc1169CdF7B0BEDE30dEb` | deployment-JSON "MockUSDC" | "USD Coin (Mock Pilot)", USDC, 6 dec, supply **1,100,000** | (probed via reads) | `0xd383189a42caf814cd14b9c8212b9257e8fe00d3a02b1e6108a80ef90ef66363` | ⚠ reserve asset; **100% in deployer EOA (C-047)**. |
| A-5 | `0xDfcA66ac0450C9AB86307af1942E157C5A4DB713` | Ecosystem-JSON "Safe" + PAUSER_on_Safe | **NOT a Safe — 0/7 reads revert**; 3,321 B · keccak `0x3c6c7d25…be6c04e` (identical to Monad M-6) | — | ✗ false Safe record — remove after approval. **Same hex hosts Monad's Oracle (C-042-1).** |
| A-6 | `0xFd2B8d176bf059287638Db30D02C6651dA02861e` | `contracts.ts` "Oracle" (2,601 B, keccak `0x0c14190ddcce23aadc615b9c0750981ccb0f9a2e593b0de5616832d825f2deb6`) | — | ⚠ same hex recorded as **Robinhood "MockUSDC"** (C-042-4). ABI unpublished; UNVERIFIED feeds. |
| A-7 | `0x5C728F729110013A1fa59fFc85938bbD973A2563` | `scripts/verify-key-and-audit-roles.ts` "mtqBranded" | **NEVER PROBED — existence/identity unverified** | unknown | none | ✗ unresolved record (D-6 #14). Must be probed before any address-book sign-off. |
| A-8 | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | "Governance" (same hex as Monad) | 13,129 B code — **different contract from Monad's 25,819 B** (C-042-2) | keccak `0x214a785c40138641e42a955466a9c5ab977980a18dfb207215c8ed3c522c4b82` | — | ⚠ |

## 3. Robinhood Chain Testnet (chainId 46630) — **ENTIRELY UNPROBED (no probe has ever run against this chain)**

| Address | Recorded role | Status |
|---|---|---|
| `0xA3B89FfdE28577A7D30E2c22503dB33509044EF0` | deployment-JSON "MTQSigma" (tx `0xfda3f6b4…d7d14` recorded) | unverified; **same hex recorded as Arc "Takaful"** (C-042-8) |
| `0xAF5B85658d074e071BbF392395a2ddA9B644C5A5` | `CANONICAL_MTQ_ADDRESSES.robinhood` ("MTQΣ Token", `canonical: true` in contracts.ts) | unverified; onchain-test-results.json records invariant reads (Sep 2026) incl. supply 1,001,000.00000002997 — not re-verified this round |
| `0xaf7cF40E37C00261E6B89D96371Da85Dd7b9b7af` | pilot-v2 record in audit scripts | **never probed** |
| `0xa3CE28A10854B375272D528EeC4295D6bcd75691` | "Safe (Multi-Sig, 4/7)" (contracts.ts:128) | **unverified — never probed; given the two false-Safe precedents on other chains, MUST NOT be assumed genuine** |
| `0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177` | "Takaful" | **same hex as Monad "Reserve"** (C-042-3) |
| `0xFd2B8d176bf059287638Db30D02C6651dA02861e` | "MockUSDC" | **same hex as Arc "Oracle"** (C-042-4) |
| `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` | "collateral/USDC" in audit scripts | **same hex as Monad candidate-A MTQ token** (C-042-5) |

## 4. Solana devnet — SPL model, two conflicting records, **unprobed this round**

| Record | Mint/address | Source | Status |
|---|---|---|---|
| `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4` | SPL Token (decimals 18) | `contracts.ts SOLANA_DEVNET` | unverified this round; mint authority recorded `4saTectHYExxsyBFwZVUbgAP7hYYbkAVKz5SxPewcA1d` (worklog) |
| `2EaK5cQtGUVNyuw9kSsWVRNoL8dFf21cxX2YWRLSf3gY` | SPL Token | `CANONICAL_MTQ_ADDRESSES.solana` | **conflicts with the row above — two canonical Solana records exist; unresolved (D-6 #13)** |

## 5. Undeployed / placeholder records (kept distinct from live addresses)

| Record | Status |
|---|---|
| `MTQSigmaV2-PENDING.json` — expectedAddress/deployTx/deployedAt = **null** | **NOT DEPLOYED.** V3-source-ready claim **non-reproducible at HEAD** (C-044: source compiles 24,718–28,714 B — over EIP-170 in every tested configuration). The "23,220 B deployable" record matches no source revision in git history (1,390 claimed lines vs 1,622 actual). |
| Base Mainnet / Arbitrum One entries `0x0000…0000` | placeholders — no deployment exists |

## 6. Cross-chain contamination register (consolidated; all now keccak-anchored where probed)

| # | Hex | Chain A role / code | Chain B role / code | Disposition |
|---|---|---|---|---|
| C-042-1 | `0xDfcA…B713` | Monad Oracle (5,273 B, keccak `0xf057e6e5…`) | Arc "Safe" (3,321 B non-Safe, keccak `0x3c6c7d25…`) + Arc PAUSER | different contracts — **do not unify; fix address book** |
| C-042-2 | `0xE35a…Bd66` | Monad Governance (25,819 B, `0xb0624cbd…`) | Arc Governance (13,129 B, `0x214a785c…`) | different contracts |
| C-042-3 | `0x1bbC…6177` | Monad Reserve (5,703 B) | Robinhood Takaful | unprobed pair (Robinhood) |
| C-042-4 | `0xFd2B…861e` | Arc Oracle (2,601 B, `0x0c14190d…`) | Robinhood MockUSDC | unprobed pair (Robinhood) |
| C-042-5 | `0x9e6E…53aD` | Monad MTQ candidate A "MITHQAL" (6,681 B) | Robinhood "collateral/USDC" | unprobed pair |
| C-042-6 | `0x28a2…d6DE` | Monad MockUSDC (live, 6-dec USDC) | Arc "MintContract" (Ecosystem JSON) | nonce-reused hex across chains — Arc role unprobed |
| C-042-7 | `0x5D95…fd4a` | Monad MTQSigma candidate C (live token) | Arc "RedeemContract" (Ecosystem JSON) | nonce-reused hex — Arc role unprobed |
| C-042-8 | `0xA3B8…4EF0` | Robinhood MTQSigma (JSON) | Arc "Takaful" (contracts.ts) | unprobed pair |
| C-042-9 | `0x3eC2…02f19` | Arc AlgorithmEngine (JSON) | Monad "Takaful" (contracts.ts) | unprobed pair |
| **new** | `0x7435…d316` (Monad) ↔ `0xDfcA…B713` (Arc) | recorded "Safe" (3,321 B, keccak `0x3c6c7d25…`) | recorded "Safe" (3,321 B, **identical keccak**) | **keccak-proven: the same non-Safe contract deployed on both chains** — both records false |

## 7. Recommendation (for human review — NOT a selection)

1. **No canonical MTQ may be declared from this document.** Per directive §4, identity requires more than name/symbol/supply coincidence; the three-way conflict (C-041) is a governance decision (OD-3-dependent).
2. **Evidence available to the decider:** candidate B (`0x0Ac2…/0x2420…`) is the only keccak-proven cross-chain-identical contract and the current `CANONICAL_MTQ_ADDRESSES` record — but it is a plain ERC20 (no MTQSigma protocol features), its entire supply is in the deployer EOA, and the mandate's Part-1 records point elsewhere (candidate A "MITHQAL"). Candidate C carries the only recorded deployment transactions and the protocol feature set, but has the self-custody genesis defect (C-046) and different code per chain. Candidate A contradicts the mandated token identity (name "MITHQAL") on both chains.
3. **Consolidation preconditions** (any path): C-045 key purge/rotation → Safe reconfiguration to 4/7 (R-02) → explicit canonical declaration by constituted governance (R-03) → only then transfer/jettison per an approved transaction plan (R-04).
4. **The two Ecosystem-JSON "Safe" records must be removed from any custody semantics** (keccak-proven false), and the Robinhood "Safe (Multi-Sig, 4/7)" row must be treated as **unverified** until probed (R-13).
5. **The PENDING (V3) record must not be treated as deployable** until the size remediation (D-4) lands and a compliant build is produced.

---
*Identity claims in this book are keccak256-of-runtime-bytecode based (Gen-3 blocks, `custody-inventory-probe.json`); unprobed rows are marked as such — no inference is drawn across chains. DRAFT — awaiting authorized human sign-off; no address or supply was altered.*
