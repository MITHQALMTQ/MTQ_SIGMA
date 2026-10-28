# MTQΣ Canonical Reference — Contracts, Roles & Authority

> **PURPOSE.** This is the single organized reference file for the MTQΣ pilot's
> deployed contract estate, its on-chain roles, and the authority model.
> Whenever a session, an agent, an auditor, or the owner needs to confirm
> *what exists, where it lives, who controls it, and what may be done with it* —
> revert to THIS file first.
>
> **HOW TO USE.**
> 1. Confirm the *Verification baseline* is current for your session.
> 2. Read the *Standing operational posture* before touching anything.
> 3. Look up the network → contract → role → holder you need.
> 4. If anything here disagrees with live chain state, **live chain state wins**
>    — then update this file with a dated revision entry (see the end of file).
>
> **AUTHORITATIVE CODE SOURCES OF TRUTH** (this file mirrors them; code wins on drift):
> | What | File |
> |---|---|
> | Deployed-estate registry (addresses, RPCs, explorers) | `src/lib/mtq/contracts.ts` |
> | Role hashes + role evidence + owner cast reference | `src/lib/mtq/roles.ts` |
> | Historical deployment record | `docs/DEPLOYMENT-RECORD.md` |
> | Pending canonical upgrade deployment | `contracts/deployments/MTQSigmaV2-PENDING.json` |

---

## 0. Standing operational posture (always in force)

| Statement | Meaning |
|---|---|
| **TESTNET ONLY** | All contracts below live on testnets/devnet. No mainnet deployment exists. |
| **SHADOW MODE ENFORCED** | The pilot app never broadcasts transactions. Simulations only. |
| **RESERVE TRADING NOT AUTHORIZED** | No production reserve trading or monetary execution is authorized. |
| **NOT PRODUCTION-AUTHORIZED** | 0/7 release gates (evidence register) closed. No gate may be advanced. |

Release-gate register: `audit-work/v6 D-5` · §25.5 validation gates (0/11) in the
terminal's Validation section. These two registers are DIFFERENT registers
(evidence-register gates ≠ terminal §25.5 gates) — do not conflate them.

---

## 1. Verification baseline

- **Estate registry**: re-verified read-only 2026-10-24 (code present via
  `eth_getCode`/`eth_call`/Solana `getAccountInfo` on every entry below).
- **Role matrix**: captured 2026-10-21 by individual `eth_call`
  (`hasRole`), blocks Monad 73,037,271 / Arc 68,397,451.
  Evidence: `audit-work/v9-roles/role-matrix-authoritative.json` + `ROLE-VERIFICATION.md`.
- **Safe configuration**: verified on-chain 2026-10-19 (OD-35).
  Evidence: `audit-work/v5/SAFE-VERIFICATION.md`.
- Token identity read live: `name()` = **MITHQAL**, `symbol()` = **MTQ** on both
  EVM chains; Solana SPL decimals = 18.

---

## 2. Wallets & authorities (current holders of power)

| Role | Address | Holds |
|---|---|---|
| **Deployer / Owner (EVM)** | `0x3C3932F865892EFabE45892f453f81B64f6c8d8c` | DEFAULT_ADMIN on every AccessControl contract (both EVM chains), MINTER on MTQ + Mint.sol (both) + Reserve.sol (Monad), PAUSER on MTQ (both). Sole owner of the 1/1 Safe. |
| **Solana owner wallet** | `DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3` | SPL mintAuthority of the MTQ devnet mint. |
| **Genesis Safe (proxy)** | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | Holds ADMIN+MINTER+PAUSER on Monad MTQ; PAUSER only on Arc MTQ (cross-chain asymmetry). See §6. |
| **Governance contract** | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | Holds NO MTQ token roles (verified false on both chains). Councils not yet constituted (OD-3 open). |

> ⚠ **CRITICAL AUTHORITY FINDING (stands until re-verified otherwise).**
> The Genesis Safe is **1/1 deployer-controlled** (Safe v1.4.1 proxy, threshold=1,
> sole owner = deployer EOA, nonce=0, no modules, no guard) — NOT the mandated
> 4/7. **Effective control of every role currently rests with a single key.**
> Gate 5 is blocked on this. A fresh funded deployer key + 4/7 Safe rotation
> remain the owner-side prerequisites for any canonical deploy.

---

## 3. Networks

| Network | Chain ID | RPC | Explorer | Native |
|---|---|---|---|---|
| Monad Testnet | 10143 | `https://testnet-rpc.monad.xyz` | `https://testnet.monadscan.com` | MON |
| Arc Testnet | 5042002 | `https://rpc.testnet.arc.io` | `https://testnet.arcscan.app` | USDC (18 dec) |
| Solana Devnet | devnet | `https://api.devnet.solana.com` (owner label: tokens.solana.com) | `https://explorer.solana.com` | SOL |

---

## 4. Deployed contract registry (the owner's "WHAT YOU HAVE NOW" estate)

### 4.1 Monad Testnet (10143) — 9 contracts

| # | Contract | Address | Note |
|---|---|---|---|
| 1 | **MTQ Token** (`MTQ.sol`) | `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` | name MITHQAL · symbol MTQ · supply 310.949 MTQ |
| 2 | Governance (`Governance.sol`) | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | not AccessControl (hasRole reverts — expected) |
| 3 | Safe (Multi-Sig) (`Safe.sol`) | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | 1/1 deployer-controlled — see §2 warning |
| 4 | Algorithm Engine (`Algorithm.sol`) | `0x8839ce50e8D414005518769999c0A5b961D00CB2` | |
| 5 | Reserve Vault (`Reserve.sol`) | `0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177` | |
| 6 | Mint (`Mint.sol`) | `0x197e9CB28216dfe18a199b4c2930F74C2F460809` | |
| 7 | Redeem (`Redeem.sol`) | `0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4` | |
| 8 | Oracle (`Oracle.sol`) | `0xDfcA66ac0450C9AB86307af1942E157C5A4DB713` | ABI unpublished — feed contents unverified |
| 9 | Takaful (`Takaful.sol`) | `0x3eC27BB283644eF0A98B9961E9FBED0583a02f19` | |

### 4.2 Arc Testnet (5042002) — 9 contracts

| # | Contract | Address | Note |
|---|---|---|---|
| 1 | **MTQ Token** (`MTQ.sol`) | `0x237c3Aa2B79248f86f6523D3890095BCd1996601` | name MITHQAL · symbol MTQ · supply 1,000 MTQ |
| 2 | Governance (`Governance.sol`) | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | same deployment address as Monad |
| 3 | Safe (Multi-Sig) (`Safe.sol`) | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | same deployment address as Monad |
| 4 | Algorithm Engine (`Algorithm.sol`) | `0x62f8E5243f32eE5C87a14A7896C61104aD9e7727` | |
| 5 | Reserve Vault (`Reserve.sol`) | `0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471` | |
| 6 | Mint (`Mint.sol`) | `0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa` | |
| 7 | Redeem (`Redeem.sol`) | `0xcAde4594177829597882555Ff57d0e34092daF8e` | |
| 8 | Oracle (`Oracle.sol`) | `0xFd2B8d176bf059287638Db30D02C6651dA02861e` | ABI unpublished — feed contents unverified |
| 9 | Takaful (`Takaful.sol`) | `0xA3B89FfdE28577A7D30E2c22503dB33509044EF0` | |

### 4.3 Solana Devnet — 1 SPL mint

| # | Contract | Address | Note |
|---|---|---|---|
| 1 | **MTQ SPL Token** | `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4` | decimals 18 · mintAuthority = owner wallet · supply ≈ 18.4467 MTQ · SPL name lives off-chain (not claimed) |

**Removed from the registry (2026-10-24 owner directive "delete what is not used")**:
Robinhood Chain Testnet (46630) suite, Base/Arbitrum placeholders, superseded
canonical generation map, MTQSigmaV2 status blob. History preserved in
`audit-work/`, `docs/DEPLOYMENT-RECORD.md` addenda, and git history.

---

## 5. AccessControl role system (EVM)

### 5.1 Role hashes (owner-pinned, verbatim)

| Role | Hash |
|---|---|
| `DEFAULT_ADMIN_ROLE` | `0x0000000000000000000000000000000000000000000000000000000000000000` |
| `MINTER_ROLE` | `0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6` |
| `PAUSER_ROLE` | `0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a` |

### 5.2 Role-holder matrix (captured 2026-10-21; `✓` = hasRole true)

**Monad MTQ.sol** `0x9e6E…53aD` — paused = false

| Holder | ADMIN | MINTER | PAUSER |
|---|---|---|---|
| Deployer `0x3C39…c8d8c` | ✓ | ✓ | ✓ |
| Safe `0xE718…fA7D0` | ✓ | ✓ | ✓ |
| Governance `0xE35a…Bd66` | ✗ | ✗ | ✗ |

**Arc MTQ.sol** `0x237c…6601` — paused = false

| Holder | ADMIN | MINTER | PAUSER |
|---|---|---|---|
| Deployer `0x3C39…c8d8c` | ✓ | ✓ | ✓ |
| Safe `0xE718…fA7D0` | ✗ | ✗ | ✓ *(asymmetry vs Monad)* |
| Governance `0xE35a…Bd66` | ✗ | ✗ | ✗ |

**Deployer DEFAULT_ADMIN across the estate** — verified ✓ on every AccessControl
contract, both chains: MTQ, Algorithm, Reserve, Mint, Redeem, Oracle, Takaful.
Deployer MINTER: MTQ (both) + Mint.sol (both) + Reserve.sol (Monad only).
Neither MTQ token is paused.

**Expected reverts (not anomalies):** Governance.sol and the Safe proxy do not
implement OpenZeppelin `hasRole` — every role query reverts by design.

### 5.3 Owner's read-only cast reference (display only — SHADOW MODE)

```bash
# View contract (Monad MTQ)
https://testnet.monadscan.com/address/0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD

# Check role / balance (read-only)
cast call --rpc-url $RPC $CONTRACT "hasRole(bytes32,address)(bool)" $ROLE $ACCOUNT
cast call --rpc-url $RPC $CONTRACT "balanceOf(address)(uint256)" $ADDRESS

# STATE-CHANGING — owner-operated only, never from the pilot app:
cast send --rpc-url $RPC --private-key $PK $CONTRACT "mint(address,uint256)" $TO $AMOUNT
cast send --rpc-url $RPC --private-key $PK $CONTRACT "transfer(address,uint256)" $TO $AMOUNT
cast send --rpc-url $RPC --private-key $PK $CONTRACT "pause()"
cast send --rpc-url $RPC --private-key $PK $CONTRACT "unpause()"
```

The pilot terminal's **Contracts** and **Authorization Audit** sections render
this matrix live from `roles.ts` / `contracts.ts` and re-verify via `/api/roles`
(`/api/onchain`); a failed live check degrades to the snapshot with an explicit
UNVERIFIED-live marker — never fabricated over.

---

## 6. Canonical V3 upgrade path (NOT deployed — pending)

- Source ready: `contracts/MTQSigmaV2.sol` (contract version 3), solc 0.8.36,
  viaIR, optimizer runs=1 (required for EIP-170 fit; runs=200 re-breaks it).
  Deployed-bytecode 24,314 B. Foundry suites green at generation baseline
  (56/56). Pending record: `contracts/deployments/MTQSigmaV2-PENDING.json`.
- **BLOCKED on ONE owner action**: a fresh funded deployer key
  (the compromised 2026-10 key can never be used again — C-045-a), plus the
  4/7 Safe rotation (§2). Deploy path: `scripts/deploy-canonical.ts` (dry-run
  proven) → `.github/workflows/deploy-testnet.yml` (owner adds
  `DEPLOYER_PRIVATE_KEY` secret + fills public addresses).
- `contracts/MTQSigmaV3.sol` is the older non-deployable draft (C-044),
  retained for reference only.
- Resulting addresses would land in `contracts/deployments/MTQSigmaV3-<chainId>.json`
  with the full role architecture (KEEPER/ORACLE/PAUSER/ADMIN + councils).

---

## 7. Revision log (append dated entries — never rewrite history)

| Date | Entry |
|---|---|
| 2026-10-21 | Role matrix captured (individual eth_call, both EVM chains). |
| 2026-10-24 | Estate registry cleanup per owner directive; re-verified read-only. |
| 2026-10-26 | Task 35: registry made single-source (contracts.ts + roles.ts); DEPLOYMENT-RECORD un-staled via addendum. |
| 2026-10-26 | **THIS FILE CREATED** (owner directive: one organized reference to always revert to). Consolidates contracts.ts + roles.ts posture as of the 2026-10-24/21 verification baselines. |
| 2026-10-28 | Task 37 ("implement all recommended"): contract/role content unchanged — this revision records the UI-layer recommendation implementation only (landing↔app exit-language mirror, viewport-cascade fixes). No on-chain posture change; §0–§6 remain authoritative as written. |
