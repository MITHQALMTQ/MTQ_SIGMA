# MTQΣ — Deployed Contract Estate Baseline

**Baseline date:** 2026-11-01
**Source of truth:** `src/lib/mtq/contracts.ts` (estate) + `src/lib/mtq/roles.ts` (roles) — this document is the dated human-readable snapshot. When they disagree, the registries win; fix this document.
**Networks:** Monad Testnet (10143) · Arc Testnet (5042002) · Solana devnet — **TESTNET ONLY**
**Honest status:** Candidate for public testing · NOT production-authorized · Reserve trading not authorized · Shadow mode enforced

---

## 1. Deployer wallets & authorities

| Entity | Value | Chain scope |
|---|---|---|
| Deployer wallet (EVM) | `0x3C3932F865892EFabE45892f453f81B64f6c8d8c` | Monad + Arc |
| Solana owner wallet | `DbFjzWcD6kNmewadiG7ThjD7L4o3w3UhFhG31fPQhXb3` | Solana devnet (SPL mintAuthority) |
| Genesis Reserve Safe | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | Identical hex on BOTH EVM chains (real, nonce-derived) |
| Governance contract | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | Identical hex on BOTH EVM chains |

---

## 2. Monad Testnet (chainId 10143) — 9 contracts

RPC: `https://testnet-rpc.monad.xyz` · Explorer: `https://testnet.monadscan.com`

| # | Contract | Address | Live-verified state |
|---|---|---|---|
| 1 | **MTQ Token** (canonical) | `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` | `name()="MITHQAL"`, `symbol()="MTQ"`, totalSupply 310.949 MTQ, code 6,681 B; roles re-verified live (block 74,475,453): DEFAULT_ADMIN/MINTER/PAUSER all **true** for deployer |
| 2 | Governance | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | Code present (25,819 B) |
| 3 | Safe (Multi-Sig) | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | **Safe v1.4.1 proxy but threshold=1, sole owner = deployer EOA** — 1/1, NOT the mandated 4/7 (CRITICAL, Gate 5 blocked). Evidence: `audit-work/v5/SAFE-VERIFICATION.md` |
| 4 | Algorithm Engine | `0x8839ce50e8D414005518769999c0A5b961D00CB2` | Code present (2,546 B) |
| 5 | Reserve Vault | `0x1bbCd78E4DEF79b7a3B77242770cbAefAC816177` | Code present (5,703 B); historical hex-collision C-042 (audit trail retained) |
| 6 | Mint | `0x197e9CB28216dfe18a199b4c2930F74C2F460809` | Code present (5,644 B) |
| 7 | Redeem | `0x963201C0Fa258033CCDdFcDceb8B5E3bc2b435a4` | Code present (6,170 B) |
| 8 | Oracle | `0xDfcA66ac0450C9AB86307af1942E157C5A4DB713` | Code present (5,273 B); **ABI unpublished — feed contents unverified** |
| 9 | Takaful | `0x249c90B8751a4bA87c36Ab41d8ACaE1a3491eEC5` | Code present |

## 3. Arc Testnet (chainId 5042002) — 9 contracts

RPC: `https://rpc.testnet.arc.io` · Explorer: `https://testnet.arcscan.io`

| # | Contract | Address | Live-verified state |
|---|---|---|---|
| 1 | **MTQ Token** (canonical) | `0x237c3Aa2B79248f86f6523D3890095BCd1996601` | `name()="MITHQAL"`, `symbol()="MTQ"`, totalSupply 1,000 MTQ, code 3,474 B |
| 2 | Governance | `0xE35a91801bc541fb743BB9EaD26C1FbD81EaBd66` | Code present (13,129 B) |
| 3 | Safe (Multi-Sig) | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | Identical critical finding as Monad Safe: **1/1 deployer-controlled, not 4/7** |
| 4 | Algorithm Engine | `0x62f8E5243f32eE5C87a14A7896C61104aD9e7727` | Code present (1,237 B) |
| 5 | Reserve Vault | `0x27a1a201D6DF8215d0b0da3Be6211bE24ef4c471` | Code present (2,897 B) |
| 6 | Mint | `0x0dd8b4F8DA7fB6E3eE04ea9F24f853647F84c3aa` | Code present (2,847 B) |
| 7 | Redeem | `0xcAde4594177829597882555Ff57d0e34092daF8e` | Code present (3,037 B) |
| 8 | Oracle | `0xFd2B8d176bf059287638Db30D02C6651dA02861e` | Code present (2,601 B); ABI unpublished; Arc USDC/USD = 1.0 by construction; hex-collision C-042 (audit trail retained) |
| 9 | Takaful | `0xA3B89FfdE28577A7D30E2c22503dB33509044EF0` | Code present (3,033 B) |

## 4. Solana devnet — 1 SPL mint

Owner-specified endpoint: `tokens.solana.com` · Operational RPC: `https://api.devnet.solana.com` · Explorer: `https://explorer.solana.com`

| # | Contract | Address | Live-verified state |
|---|---|---|---|
| 1 | **MTQ SPL Token** (canonical) | `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4` | SPL mint initialized, decimals 18, mintAuthority = owner wallet, supply ≈ 18.4467 MTQ. SPL token **name is off-chain metadata — not claimed on-chain** |

---

## 5. AccessControl roles (EVM)

Owner-pinned role hashes (verbatim from the owner's reference table):

| Role | Hash (bytes32) | Deployer holds? (live-verified) |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | `0x0000…0000` (zero hash) | **true** |
| `MINTER_ROLE` | `0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6` | **true** |
| `PAUSER_ROLE` | `0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a` | **true** |

- The app's **Authorization Audit** section re-verifies these **live** on every
  load (read-only `hasRole()` eth_calls) and degrades honestly to the last
  verified snapshot if RPC is unreachable — it never fabricates a pass.
- Rotation of all three roles to the 4/7 Safe is **planned and BLOCKED** on the
  Safe reconfiguration (see `docs/ops/ROLE_ROTATION.md`, Gate 5).

## 6. Operator command reference (shadow display)

The 7 owner cast commands are surfaced in the app (**Contracts → Role & cast
commands**) as copy-ready reference. Only the read-only ones are ever performed
by the app itself; state-changing commands are owner-operated:

| Operation | Command | Class |
|---|---|---|
| View contract | explorer URL | read-only |
| Check role | `cast call --rpc-url $RPC $CONTRACT "hasRole(bytes32,address)(bool)" $ROLE $ACCOUNT` | read-only (app-performed) |
| Check balance | `cast call --rpc-url $RPC $CONTRACT "balanceOf(address)(uint256)" $ADDRESS` | read-only |
| Mint MTQ | `cast send --rpc-url $RPC --private-key $PK $CONTRACT "mint(address,uint256)" $TO $AMOUNT` | **state-changing — owner only** |
| Transfer tokens | `cast send --rpc-url $RPC --private-key $PK $CONTRACT "transfer(address,uint256)" $TO $AMOUNT` | **state-changing — owner only** |
| Pause contract | `cast send --rpc-url $RPC --private-key $PK $CONTRACT "pause()"` | **state-changing — owner only** |
| Unpause contract | `cast send --rpc-url $RPC --private-key $PK $CONTRACT "unpause()"` | **state-changing — owner only** |

---

## 7. Known findings affecting the estate (open)

| Finding | Severity | Impact | Disposition |
|---|---|---|---|
| Safe is 1/1 deployer-controlled (both EVM chains), not 4/7 | **CRITICAL** | Gate 5 (mainnet) blocked; single-key compromise = total protocol control | Rotation plan ready (`docs/ops/ROLE_ROTATION.md`); awaiting owner-executed Safe reconfiguration |
| Oracle ABIs unpublished; feed contents unverified | HIGH | Oracle.sol code present but its data path cannot be audited from the registry alone | Documented; verify when ABI is published |
| Historical hex-collisions (C-042) on Reserve/Oracle rows | resolved-with-trail | Superseded Robinhood-era records collided with current addresses | Audit evidence retained in registers; registry carries only the owner-verified estate |
| `DEPLOYER_PRIVATE_KEY` intentionally absent from CI secrets | fail-closed guard (C-045-a) | Testnet deployment workflow cannot run until owner adds a **fresh, funded key created outside any AI environment** | By design — deploy gate stays closed |

## 8. Change protocol (how this baseline evolves)

1. **Owner directive** defines the estate change (add/remove/re-verify).
2. `src/lib/mtq/contracts.ts` / `roles.ts` are updated — they are the single source.
3. Live read-only re-verification runs (`/api/onchain`, `/api/roles`,
   `scripts/verify-safe.ts` as applicable); evidence is stored under `audit-work/`.
4. A **dated addendum** is appended to `docs/DEPLOYMENT-RECORD.md`.
5. This baseline document is updated in the same commit (or immediately after),
   with the baseline date advanced.
6. Nothing is ever silently deleted: removed rows keep their historical record
   in the audit registers and git history (owner-authorized dispositions only).

---

*Registry cleanup lineage: 2026-10-24 (Robinhood/Base/Arb removal), 2026-10-26
Task 35 (39-file citation-mapped cleanup, R-15 closed). This baseline reflects
the estate exactly as of 2026-11-01.*
