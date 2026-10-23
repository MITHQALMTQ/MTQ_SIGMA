# MTQΣ — TASK 11 · D3: EVM AUTHORITY-MIGRATION PLAN (chain-by-chain, function-level)

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN**

**Every item on this page is a PLAN. Nothing below has been signed, broadcast, or executed.**
Ground rule (§2 prohibitions honored): no transaction was sent by this task; no key was
used; no role was changed; no Safe was created. The purpose is to make remediation
**ready, ordered, and reviewable** — not to perform it.

Fresh evidence base: Monad block 73,193,262 · Arc block 68,490,282 · RH block 140,634,936
(`evidence/onchain-evm-task11.json`, hashed transport). Role hashes:
DEFAULT_ADMIN `0x0000…0000` · MINTER `0x9f2df0fe…56a6` · PAUSER `0x65d7a28e…862a`.

---

## 1. Authority inventory — every control surface that must change (with evidence)

### 1.1 Monad testnet 10143 — current estate

| # | Contract (address) | Function surface (deployed selectors) | Gated by | Holder today (fresh) | Destination |
|---|---|---|---|---|---|
| M-1 | MTQ token `0x9e6E…53aD` (6,681 B) | `mint(address,uint256)` | MINTER_ROLE | deployer EOA · Genesis Safe · **Mint module** · **Redeem module (DORMANT — CORR-6)** | Safe-B(Monad) + governed Mint module only |
| M-2 | — | `pause()/unpause()` | PAUSER_ROLE | deployer EOA · Genesis Safe | Safe-B(Monad) + emergency policy (owner decision) |
| M-3 | — | `grantRole/revokeRole` (admin/minter/pauser) | role-admin = DEFAULT_ADMIN | deployer EOA (sole) | Safe-B(Monad) |
| M-4 | — | `burn/burnFrom` | none (any holder/allowance) | n/a — public | unchanged |
| M-5 | Mint module `0x197e…0809` | `mint(address,uint256)` (module entry, calls token.mint) | module MINTER_ROLE | deployer EOA (sole) | Safe-B(Monad) or committee-operational key per owner decision |
| M-6 | — | `setReserve(address)` | module ADMIN_ROLE (default-admin family, fresh: roleAdmin(ADMIN)=DEFAULT_ADMIN) | deployer EOA | Safe-B(Monad) |
| M-7 | Redeem module `0x9632…35a4` | `redeem(uint256)` (+ burn path) | module roles | deployer EOA (ADMIN; holds no MINTER on module) | Safe-B(Monad) |
| M-8 | Reserve module `0x1bbC…6177` | `removeReserve(bytes32,uint256)`, `getNAV()` | module ADMIN | deployer EOA (+MINTER on module, Monad only) | Safe-B(Monad) |
| M-9 | Algorithm `0x8839…0CB2` / Oracle `0xDfcA…B713` / Takaful `0x3eC2…02f19` | config/admin surface (AC) | module DEFAULT_ADMIN | deployer EOA | Safe-B(Monad) |
| M-10 | Genesis Safe `0xE718…A7D0` (proxy 171 B, singleton = **canonical v1.4.1, byte-proven vs mainnet**) | `execTransaction`; owner mgmt (`addOwnerWithThreshold/removeOwner/swapOwner/changeThreshold`); `enableModule/setGuard/setFallbackHandler` | threshold 1, sole owner deployer | **deployer EOA with ONE signature** | decommission-or-rotate (§4.3) |
| M-11 | Governance `0xE35a…Bd66` (25,819 B, 50 sels) | propose/queue/execute/cancel/relay/ERC-1271; params 1/1/1/1; name "MITHQAL Governance" | **UNESTABLISHABLE without source** | unknown — treat as live unassessed surface | NO change until N-01 sources published; recorded as residual risk |
| M-12 | token role held by Safe | MINTER+PAUSER+ADMIN on MTQ (Monad) | — | Genesis Safe (i.e., the deployer via 1/1) | revoke at T-3.2 after Safe-B holds them |

### 1.2 Arc testnet 5042002 — current estate (differences only)

| # | Surface | Fresh state | Destination |
|---|---|---|---|
| A-1 | MTQ token `0x237c…6601` (3,474 B) roles | deployer: ADMIN+MINTER+PAUSER · **Safe: PAUSER ONLY** (asymmetry vs Monad) · Mint module: MINTER · Redeem: none | Safe-B(Arc): all three (normalization decision §4.4) |
| A-2 | Modules `0x62f8…` `0x27a1…` `0x0dd8…` `0xcAde…` `0xFd2B…` `0xA3B8…` | deployer DEFAULT_ADMIN on all (12/12 cross-chain re-verified); deployer MINTER on Mint module (Arc) | Safe-B(Arc) |
| A-3 | Genesis Safe (twin proxy, separate instance, same config 1/1/nonce-0) | sole owner deployer | decommission-or-rotate |
| A-4 | Governance (same hex, **different build** 13,129 B / 74 sels) | unassessed (as M-11) | NO change pre-N-01 |

### 1.3 Robinhood Chain 46630 — provenance tier (disposition, not rotation)

| # | Surface | Fresh state | Disposition proposed |
|---|---|---|---|
| R-1 | "MTQToken" `0xAF5B…C5A5` (gen-B twin) | deployer holds 1,000,999.999999999999997 of 1,001,000.00000000002997 | include in asset evacuation decision (D5 T-3.8); decommission-or-provenance per D6 |
| R-2 | "MTQSigma" `0xA3B8…4EF0` (gen-A twin) | self-custody genesis; owner = deployer | same |
| R-3 | "Safe" `0xa3CE…5691` (3,321 B) | **reverts on all Safe ABI calls — NOT a Safe (re-proven)** | annotate; never treat as custody |
| R-4 | deployer EOA on RH | txCount 60, native 0x22e44b0d00d200 | evacuate native if owner wants; no roles to migrate (provenance tier) |

### 1.4 Generations (both chains) — authority facts that survive rotation planning

gen-A family (Monad `0x5D95…` / Arc genC `0x5C72…` / RH `0xA3B8…` / Arc genA `0x826b…` sibling):
**Ownable**, owner = deployer (re-probed), self-custody 1,000,000 genesis each, `genesisMint`
owner-gated → the exposed key can inflate ANY gen-A-family token. gen-B family (Monad
`0x0Ac2…` / Arc `0x2420…` / RH `0xAF5B…`): AccessControl, deployer ≈ sole holder. **Rotation
of the EOA key does not remove `owner()` on gen-A tokens — those are separate owner-gated
surfaces that must be individually dispositioned (transfer ownership or accept-provenance)
in D5 T-3.8 / D6.**

## 2. The Monad Redeem-module MINTER_ROLE — function-level resolution (CORR-6)

- **Fact:** Redeem module `0x9632…35a4` HOLDS MINTER_ROLE on the Monad MTQ token (fresh
  `hasRole` = true — the Task 9 prose error CORR-1 remains corrected).
- **Function-level scan (new this session):** the module's **entire 6,170-byte runtime
  bytecode contains no `mint(address,uint256)` selector** (`0x40c10f19` absent byte-wise —
  not merely absent from the dispatch table). It DOES contain `burn(uint256)`
  (`0x42966c68`) + `transferFrom` — i.e., its redeem flow pulls and burns; **it has no code
  path that can call the token's mint**.
- **Consequence:** the grant is **DORMANT**. No caller can make Redeem mint, and the
  module is non-upgradeable (no proxy — EIP-1967 slots zero, re-verified) so it can never
  grow one. Arc's Redeem holds no MINTER at all (and its bytecode has neither mint nor burn
  selectors — transferFrom only: another cross-chain build divergence).
- **Likely origin (hypothesis, not established):** a symmetric deployment script granted
  MINTER to both "operations" modules on Monad; the Arc deployment (different, OZ-v5-era
  source generation) granted it only to Mint. Cannot be proven without source (N-01).
- **Disposition in this plan:** `revokeRole(MINTER_ROLE, Redeem)` — **hygiene, LOW
  severity** — scheduled AFTER Safe-B holds DEFAULT_ADMIN on the Monad token (T-3.1), so
  the revoke itself is executed by the governed destination, not the exposed key, wherever
  sequencing permits (see §4.2 for the unavoidable-handover caveat).

## 3. Destination authority design (NO invented identities)

**Destination per chain: "Safe-B" — a NEW Safe, threshold 4-of-7, deployed in a
human-controlled provisioning process.** The 4/7 shape follows the approved specification
(mandated committee); it is NOT assumed to exist today (OD-35 stands: the current Safes are
1/1 and must be treated as inadequate governance), and **no owner/signer addresses are
invented here** — the register (D5) carries `⟨OWNER-1…7⟩` placeholders that the owner must
bind to real, independently-generated addresses at provisioning time (T-1.1).

**Signer provisioning requirements (must be approved before ANY grant):**
1. Each of the 7 owner keys is generated **outside this repository, outside this sandbox,
   outside any AI execution environment** — hardware wallet or air-gapped generation per
   owner-controlled ceremony; no key material ever transits this repo (D2 rules).
2. **Independence:** 7 distinct custodians, no two keys controlled by one person/system;
   document custodian identity (pseudonymous acceptable) in the owner's private register.
3. **Custody:** documented storage per key (HW seed backup, location, recovery contact).
4. **Recovery:** ≥1 documented recovery path for a lost signer (Safe supports owner
   replacement at threshold); quorum survival plan for 3 simultaneous losses (7−3 < 4
   ⇒ Safe-B would be **frozen** — recovery requires a ≥3-sig owner swap which is itself
   4-sig-gated: documented, owner-accepted).
5. **Verification before handover (T-1.4, hard gate):** on-chain `getOwners()` == the 7
   declared addresses, `getThreshold()` == 4, `nonce()` == 0, `VERSION()` == 1.4.1,
   singleton == canonical v1.4.1 (byte-compare to the mainnet-anchored keccak recorded in
   `identity-anchors-task11.json`), modules empty, guard/fallback slots per policy, and one
   no-op or low-risk execTransaction executed and nonce-incremented **while the deployer
   still holds admin**, proving the quorum works end-to-end BEFORE any role is revoked.
6. **A higher threshold is not automatic security:** the plan documents signer independence
   (req. 2) and guard policy as the substance; threshold is only a parameter.

**Why a new Safe instead of reconfiguring the existing 1/1:** the existing Safes' owner
management is itself one signature of the exposed key, their history is contaminated, and
Monad's carries ADMIN+MINTER+PAUSER that would complicate sequencing. A fresh Safe-B gives
a clean, verifiable destination; the old Safes are then emptied of roles (T-3.2/T-3.3) and left
as provenance (or formally decommissioned by owner decision — D7).

## 4. Migration ordering (safe sequence — never admin-less; grant-before-revoke)

### 4.1 Phase structure (full register in D5)

```
Phase 0 (repo)   K-1 purge → K-2 history rewrite + credential rotation        [no chain tx]
Phase 1 (prep)   T-1.1 provision 7 signers (human ceremony) → T-1.2/T-1.3
                 deploy Safe-B per chain (SafeProxyFactory, CREATE2) → T-1.4 verify dossier +
                 end-to-end quorum proof                                   [exposed key NOT used
                                                                            except its final
                                                                            handover grants in Phase 2]
Phase 2 (grant)  deployer (unavoidable handover — §4.2) grants EVERYTHING to
                 Safe-B: token roles ×3, module ADMIN (+MINTER where intended),
                 on both chains                                          [grant-before-revoke]
Phase 3 (revoke) Safe-B (now admin) revokes: Monad Redeem MINTER (T-3.5),
                 old-Safe roles (T-3.4); LAST: Safe-B revokes the deployer's
                 remaining roles / owner renounces; deployer native+tokens
                 evacuated per owner decision (T-3.8)                      [verify-after-each]
Phase 4 (Solana) per D4                                                  [independent of EVM phases]
Phase 5 (verify) D8 suite                                                [gate for closure]
```

### 4.2 The unavoidable handover window (documented risk, no mitigation exists on-chain)

Only the current admin (the exposed key) can create its successor. Between T-1.2/T-1.3 (Safe-B
deployed) and T-3.6/T-3.7 (deployer stripped), **the compromised key remains fully privileged
and could race the migration**. Risk treatments (all imperfect, owner selects):
(a) execute Phase 2→3 as one tight, pre-signed, pre-broadcast batch per chain (minutes of
window); (b) pause the tokens first (PAUSER grant path — but pausing also requires the
exposed key and blocks the pilot; owner decision T-1.5); (c) accept the window —
**testnet-only assets**, financially negligible; the substantive loss would be "unknown
attacker becomes admin", recoverable only by repeating migration from a NEW clean key —
which is why T-1.4’s verification happens BEFORE revokes. **No ordering choice removes the
window; do not present any sequence as risk-free.**

### 4.3 Old Safes (Monad+Arc): after T-3.2/T-3.3 revokes they hold zero roles, zero assets,
nonce 0/1. Options for owner: (i) leave as inert provenance; (ii) `swapOwner` to Safe-B
then `changeThreshold`… — rejected (adds handover surface for no benefit); (iii) formal
decommission note in address book (K-7). **Recommendation (not decision): (iii).**

### 4.4 Normalization decisions embedded in the grant set (owner-approvable):
- Arc Safe asymmetry: today the Arc Genesis Safe holds ONLY PAUSER (vs Monad's
  ADMIN+MINTER+PAUSER). The plan grants Safe-B **all three roles on both chains** so the
  destination is symmetric — flagged as a deliberate normalization, not a mandate.
- Monad Reserve-module MINTER held by deployer: grant Safe-B module-MINTER on both chains'
  Reserve modules only if the owner confirms Reserve is intended to mint; otherwise grant
  nothing and let the role lapse with the deployer's renounce (D7 ECON-DEC-2).
- Module-side MINTER on Mint modules: required for the wired mint path to keep functioning
  (CORR-1) — grant to Safe-B; the day-to-day operational mint key policy (whether a
  separate operational EOA should hold module-MINTER under Safe-B admin) is an owner
  decision (D7 OPS-DEC-1) — default plan keeps MINTER on Safe-B only (most conservative).

## 5. What is deliberately NOT in this plan

1. **No Governor changes** (M-11/A-4): proposer/executor auth is UNESTABLISHABLE without
   source; any interaction (even renouncing) could brick or trigger unknown behavior.
   Requires N-01 source publication first; recorded as **residual risk** in D9.
2. **No canonical-selection actions**: grants above assume the CURRENT owner-declared
   estate as the rotation target because it is what exists; if governance later selects a
   different canonical family (D6), authority migration to that family becomes a follow-up
   plan — the two decisions are independent (D7).
3. **No genesis/custody transactions**: supply/genesis corrections (1M → Safe etc.) are
   OUT of scope for rotation and live in the conditional-acceptance path (R-04) — they
   must never be bundled with the handover.
4. **No upgrades/proxies**: none exist; none are introduced.
5. **No production-adjacent claim**: everything here is testnet remediation rehearsal; a
   mainnet equivalent would require the full §23 program and independent reviews (D9).

## 6. Per-chain function-level grant/revoke target list (summary — calldata templates in D5)

| Chain | Grant set (Phase 2, by deployer) | Revoke set (Phase 3, by Safe-B / last steps) |
|---|---|---|
| Monad | MTQ: grantRole(ADMIN, Safe-B) + grantRole(MINTER, Safe-B) + grantRole(PAUSER, Safe-B) · Mint module: grantRole(ADMIN, Safe-B) + grantRole(MINTER, Safe-B) · Reserve/Redeem/Algorithm/Oracle/Takaful: grantRole(ADMIN, Safe-B) (± Reserve MINTER per ECON-DEC-2) | MTQ: revokeRole(MINTER, Redeem-module) [T-3.1] · MTQ: revokeRole(ADMIN/MINTER/PAUSER, old Safe) [T-3.2] · MTQ: revokeRole(ADMIN/MINTER/PAUSER, deployer) [T-3.6, LAST] · modules: revokeRole(ADMIN, deployer) after each module's Safe-B admin verified |
| Arc | MTQ: ×3 grantRole(…, Safe-B) · 6 modules: grantRole(ADMIN, Safe-B); Mint module also grantRole(MINTER, Safe-B) | MTQ: revokeRole(PAUSER, old Safe) [T-3.3] · MTQ: revokeRole(×3, deployer) [T-3.7, LAST] · modules: revokeRole(ADMIN, deployer) |
| RH | none (provenance tier) | none (annotate + evacuate assets only, T-3.8) |

Every revoke is executed **only after** the corresponding grant is verified on-chain
(postcondition probes listed in D5/D8). A failure between steps leaves the estate
**admin-redundant (safe)**, never admin-less — that is the design invariant of §4.1.
