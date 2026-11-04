# ROLE_ROTATION.md — MTQΣ Privileged-Role Rotation (Testnet Rehearsal)

| Field | Value |
|---|---|
| Purpose | Exact contract interface, role-admin configuration, transaction sequence, expected state after each step, rollback considerations, and verification commands for rotating privileged roles from the deployer EOA to the governance Safe (v5.0 §4.6 Listing C-6, §5.1, §5.2; Ext-3 A.5) |
| Status | **TESTNET REHEARSAL DOCUMENT.** Production role rotation is authorized only after Gate 5 written pilot approval (v5.0 Part 7, Gate 5: "Production role rotation completed and verified") |
| Supersedes | No prior formal ROLE_ROTATION.md existed. This document supersedes all informal rotation practices and the ad-hoc rehearsal scripts (§10) as the controlling procedure |
| Register refs | OD-35 (VERIFIED-FAILED — CRITICAL finding 2026-10-19), C-010, C-040 (verified-and-disproved), C-041/C-042 (post-Ext-3 findings), T-35 (not demonstrated live), T-87 (demonstrated-failed) |
| Project status | TESTNET-ONLY. Production reserve trading is NOT authorized (v5.0 §11.2) |

---

## 1. Reported role hashes and accounts

**Caveat (v5.0 §1.4):** these are *reported* assignments, not independently verified current state. Check each role on every relevant contract and chain. A role on MTQ.sol does not prove the same role controls Mint.sol, Reserve.sol, or Governance.sol. Reported ≠ verified.

| Item | Value | Source of report |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | `0x0000000000000000000000000000000000000000000000000000000000000000` | OpenZeppelin AccessControl constant |
| `MINTER_ROLE` | `0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6` | v5.0 §5.1 |
| `PAUSER_ROLE` | `0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a` | v5.0 §5.1 |
| Deployer EOA | `0x3C3932F865892EFabE45892f453f81B64f6c8d8c` | contracts/deployments/*.json (both chains) |
| Governance Safe (reported) | `0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0` | genesis.ts `GENESIS_RESERVE_SAFE`; reported 4/7 on both chains — see §9 |

### 1.1 Rehearsal target deployments (reported)

| Chain | ChainId | RPC | MTQ address used in this rehearsal |
|---|---|---|---|
| Monad Testnet | 10143 | `https://testnet-rpc.monad.xyz` | `0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD` |
| Arc Testnet | 5042002 | `https://rpc.testnet.arc.io` | `0x237c3Aa2B79248f86f6523D3890095BCd1996601` |

**2026-10-24 registry cleanup (owner directive "delete what is not used"):** the superseded deployment records (`contracts/deployments/Monad-Testnet.json`, `Arc-Testnet.json`, both `*-Ecosystem.json`, and the Robinhood Chain Testnet records — the V1/OD-35-era generations and the Robinhood suite) were DELETED from the worktree; only `MTQSigmaV2-PENDING.json` (the not-yet-deployed upgrade manifest) remains. Their historical addresses are still recoverable from git history and the audit registers (e.g. `MTQSigma` at `0x5D9564C27111EA65Da3228a79833F0FF129bfd4a` on Monad and `0x826b82F79FD6c5347cDC568B1d0A7918128B63c1` on Arc; ecosystem `MTQToken` at `0x0Ac20360234b4C988a19586CBe55733e18A5982f` / `0x24203404B9b971C907e8Ced96106Fa74380d9897`). Per v5.0 §5.1, repeat role verification for **every contract whose access-control configuration matters** (Mint.sol, Reserve.sol, Governance.sol). Each rehearsal run must state, in its evidence record, which (chain, address, code hash, correction version) it rotated — a role on one deployment says nothing about another (C-016).

---

## 2. Contract interface (AccessControl + Safe)

Do not implement generic wrapper functions that merely call another contract's `grantRole`. Verify the target's actual role-admin hierarchy first (v5.0 §4.6).

| Contract | Function | Kind | Notes |
|---|---|---|---|
| MTQ / Mint / Reserve / Governance | `hasRole(bytes32,address) view returns (bool)` | read | Role membership check |
| same | `getRoleAdmin(bytes32) view returns (bytes32)` | read | Admin of a role; for `DEFAULT_ADMIN_ROLE` this is `DEFAULT_ADMIN_ROLE` itself by default |
| same | `grantRole(bytes32,address)` | write | Caller must hold the role's admin |
| same | `revokeRole(bytes32,address)` | write | Caller must hold the role's admin |
| same | `renounceRole(bytes32,address)` | write | Self-renunciation only |
| Safe | `getThreshold() view returns (uint256)` | read | OD-35 evidence |
| Safe | `getOwners() view returns (address[])` | read | OD-35 evidence |
| Safe | `getModulesPaginated(address,uint256) view returns (address[],address)` | read | OD-35 evidence (Safe >= v1.3; `getModules()` on older versions) |
| Safe | `getGuard() view returns (address)` | read | OD-35 evidence |

### 2.1 Production baseline targets (v5.0 §4.6)

- `DEFAULT_ADMIN_ROLE` → governance Safe or approved governance-controlled mechanism.
- `MINTER_ROLE` → governance Safe or a narrowly scoped, approved minter contract.
- `PAUSER_ROLE` → approved emergency/governance authority.
- Deployer EOA → **no persistent privileged role** unless explicit, reviewed policy permits it.
- Do not assume the Safe is a 4-of-7 unless its actual on-chain configuration proves it. If the deployer is a Safe signer, that does not justify retaining a separate EOA administrator role.

---

## 3. Intended sequence (v5.0 §5.2 — testnet rehearsal first, production only after Gate 5)

1. Verify the Safe and its signers/threshold by inspecting its **actual configuration** (§5 commands).
2. Grant the Safe the required administrative role: `grantRole(ROLE_ADMIN, SAFE)`.
3. Verify the Safe can exercise the admin role (Safe-originated transaction confirmed on-chain).
4. Grant the Safe the required operational roles: `grantRole(ROLE_MINTER, SAFE)`, `grantRole(ROLE_PAUSER, SAFE)`.
5. Verify the Safe can perform the intended operational actions on **each** contract.
6. Revoke the deployer's operational roles through the authorized mechanism (Safe execution): `revokeRole(ROLE_MINTER, DEPLOYER)`, `revokeRole(ROLE_PAUSER, DEPLOYER)`.
7. Verify the deployer no longer holds those roles.
8. Revoke the deployer's admin role **if the approved policy requires it** (Safe execution): `revokeRole(ROLE_ADMIN, DEPLOYER)`.
9. Verify that a legitimate governance administrator remains and that no critical action has become impossible.

---

## 4. Verification commands (read-only)

All `cast call` commands below are **read-only — they do not rotate roles** (v5.0 §5.1).

### 4.1 Monad Testnet

```bash
export RPC="https://testnet-rpc.monad.xyz"
export MTQ="0x9e6EdC15DAc420931508d8Ddf9BC817651A253aD"
export SAFE="0xE71869C662733642bfBb262B8c6bad8B0fBfA7D0"
export DEPLOYER="0x3C3932F865892EFabE45892f453f81B64f6c8d8c"

export ROLE_ADMIN="0x0000000000000000000000000000000000000000000000000000000000000000"
export ROLE_MINTER="0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
export ROLE_PAUSER="0x65d7a28e3265b37a6474929f336521b332c1681b933f6cb9f3376673440d862a"

# Deployer holds which roles?
cast call --rpc-url "$RPC" "$MTQ" "hasRole(bytes32,address)(bool)" "$ROLE_ADMIN"   "$DEPLOYER"
cast call --rpc-url "$RPC" "$MTQ" "hasRole(bytes32,address)(bool)" "$ROLE_MINTER"  "$DEPLOYER"
cast call --rpc-url "$RPC" "$MTQ" "hasRole(bytes32,address)(bool)" "$ROLE_PAUSER"  "$DEPLOYER"

# Safe holds which roles?
cast call --rpc-url "$RPC" "$MTQ" "hasRole(bytes32,address)(bool)" "$ROLE_ADMIN"   "$SAFE"
cast call --rpc-url "$RPC" "$MTQ" "hasRole(bytes32,address)(bool)" "$ROLE_MINTER"  "$SAFE"
cast call --rpc-url "$RPC" "$MTQ" "hasRole(bytes32,address)(bool)" "$ROLE_PAUSER"  "$SAFE"

# Role-admin hierarchy (do not assume; read it)
cast call --rpc-url "$RPC" "$MTQ" "getRoleAdmin(bytes32)(bytes32)" "$ROLE_ADMIN"

# OD-35 — Safe actual configuration (reported 4/7 is NOT evidence)
cast call --rpc-url "$RPC" "$SAFE" "getThreshold()(uint256)"
cast call --rpc-url "$RPC" "$SAFE" "getOwners()(address[])"
cast call --rpc-url "$RPC" "$SAFE" "getModulesPaginated(address,uint256)(address[],address)" \
  "0x0000000000000000000000000000000000000001" "10"
cast call --rpc-url "$RPC" "$SAFE" "getGuard()(address)"
```

### 4.2 Arc Testnet

```bash
export RPC="https://rpc.testnet.arc.io"
export MTQ="0x237c3Aa2B79248f86f6523D3890095BCd1996601"
# SAFE, DEPLOYER, ROLE_* unchanged from 4.1 — but re-verify the Safe's on-chain
# configuration ON THIS CHAIN (identical addresses are not evidence of identical
# configuration; v5.0 §5.4).

# ...repeat every cast call from 4.1 against the Arc RPC...
```

Repeat for every contract whose access-control configuration matters: Mint.sol, Reserve.sol, Governance.sol (addresses per deployment register, e.g. `contracts/deployments/Monad-Testnet-Ecosystem.json` and `Arc-Testnet-Ecosystem.json`).

### 4.3 Rotation transactions (testnet rehearsal template — do NOT run on production without Gate 5)

```bash
# Step 2 — grant admin to Safe (hardware-wallet signing)
cast send --rpc-url "$RPC" --ledger "$MTQ" \
  "grantRole(bytes32,address)" "$ROLE_ADMIN" "$SAFE"

# Step 4 — grant minter and pauser to Safe
cast send --rpc-url "$RPC" --ledger "$MTQ" \
  "grantRole(bytes32,address)" "$ROLE_MINTER" "$SAFE"
cast send --rpc-url "$RPC" --ledger "$MTQ" \
  "grantRole(bytes32,address)" "$ROLE_PAUSER" "$SAFE"

# Step 3/5 — verify Safe holds all three
cast call --rpc-url "$RPC" "$MTQ" "hasRole(bytes32,address)(bool)" "$ROLE_ADMIN"  "$SAFE"
cast call --rpc-url "$RPC" "$MTQ" "hasRole(bytes32,address)(bool)" "$ROLE_MINTER" "$SAFE"
cast call --rpc-url "$RPC" "$MTQ" "hasRole(bytes32,address)(bool)" "$ROLE_PAUSER" "$SAFE"

# Step 6 — execute revocations FROM the Safe (Safe Wallet app or Safe CLI):
#   MTQ.revokeRole(ROLE_MINTER, DEPLOYER)
#   MTQ.revokeRole(ROLE_PAUSER, DEPLOYER)

# Step 7 — verify deployer no longer holds operational roles
cast call --rpc-url "$RPC" "$MTQ" "hasRole(bytes32,address)(bool)" "$ROLE_MINTER" "$DEPLOYER"
cast call --rpc-url "$RPC" "$MTQ" "hasRole(bytes32,address)(bool)" "$ROLE_PAUSER" "$DEPLOYER"

# Step 8 — optionally revoke admin from deployer if the approved policy requires it
#   (Safe execution): MTQ.revokeRole(ROLE_ADMIN, DEPLOYER)
```

---

## 5. Expected state after each step

Legend: `hasRole(R, X)` read on-chain. D = deployer EOA, S = governance Safe. Do not assume the initial state — read it (step 0) and record it.

| Step | Action | Actor | Expected state after the step |
|---|---|---|---|
| 0 | Baseline reads (§4.1/§4.2) | — | Actual `hasRole` values for D and S on all three roles recorded verbatim in the evidence log, per chain, per contract. No assumption. |
| 1 | Read Safe configuration (OD-35) | — | `getThreshold()`, `getOwners()`, `getModulesPaginated()`, `getGuard()` recorded. If the actual configuration does not match the approved policy (reported 4/7), the rotation **aborts** before any write. |
| 2 | `grantRole(ROLE_ADMIN, S)` | current admin (D, hardware wallet) | `hasRole(ADMIN, S) = true`; `hasRole(ADMIN, D) = true` (both hold admin). No revocation in this step. |
| 3 | Verify Safe admin capability | S (Safe-originated tx) | A Safe-originated admin action confirms on-chain (e.g. a Safe-executed `grantRole` of a harmless role, or `getRoleAdmin` read plus a signed test action per approved policy). Rotation does not proceed until this is evidenced. |
| 4 | `grantRole(ROLE_MINTER, S)`; `grantRole(ROLE_PAUSER, S)` | admin (D or S) | `hasRole(MINTER, S) = true`; `hasRole(PAUSER, S) = true`; D unchanged. |
| 5 | Verify Safe operational capability per contract | S | Intended operational action demonstrably exercisable by S on each relevant contract (mint path on Mint.sol, pause path on MTQ, rescue/parameter paths on Reserve.sol/Governance.sol). |
| 6 | `revokeRole(ROLE_MINTER, D)`; `revokeRole(ROLE_PAUSER, D)` | S (Safe execution) | `hasRole(MINTER, D) = false`; `hasRole(PAUSER, D) = false`; S roles unchanged; `hasRole(ADMIN, S) = true` still. |
| 7 | Verification reads | — | Reads return false for D on MINTER/PAUSER; D admin state unchanged (true unless step 8 policy already executed). |
| 8 | Optional: `revokeRole(ROLE_ADMIN, D)` | S (Safe execution) | `hasRole(ADMIN, D) = false`; `hasRole(ADMIN, S) = true` — the contract still has exactly the governance administrator. Skipped if approved policy retains a deployer admin (must be explicit, reviewed policy). |
| 9 | Final lockout check | — | `getRoleAdmin(ROLE_ADMIN) == ROLE_ADMIN`; at least one live account holds ADMIN; pause, mint, and rescue paths all demonstrably exercisable by governance; no critical action impossible. Evidence recorded (tx hashes, block numbers, reads). |

---

## 6. Rollback considerations

- **Erroneous revocation of an operational role:** the Safe, as admin, re-grants it: `grantRole(ROLE_MINTER, X)` / `grantRole(ROLE_PAUSER, X)` via Safe execution. This is the primary rollback path and is why step 2/3 (Safe admin verified working) must precede step 6/8.
- **Erroneous revocation of the admin role:** if D's admin is revoked by mistake while S holds admin, S re-grants via `grantRole(ROLE_ADMIN, D)` if policy wants it. Recovery requires a working admin — hence the ordering rule below.
- **NEVER leave a contract without an admin.** By default `getRoleAdmin(DEFAULT_ADMIN_ROLE) == DEFAULT_ADMIN_ROLE`: only an account already holding admin can grant admin. If the last admin is removed, all role management is permanently impossible and the only remedy is contract migration (Option A, see UPGRADEABILITY.md) — no key, no timelock, no Committee vote can restore it.
- **Ordering rule:** grant before revoke; verify after every grant and every revoke; never batch steps 2–5 with steps 6–8 in the same transaction or the same Safe batch.
- **Pause-path check:** confirm `hasRole(PAUSER, S) = true` and that S can pause, *before* removing D's pauser. The kill switch must never become unreachable.
- **Step 8 is optional by policy, not by convenience.** Revoke D's admin only if the approved policy requires it, and only after step 9's pre-checks pass in rehearsal.
- **Testnet last resort:** on testnet, a failed rotation can be remedied by redeploying with corrected role wiring (test assets only, old addresses preserved for auditability). **Production has no such rollback** — this is why production rotation is a Gate 5 item.

---

## 7. Signing-method security rules (v5.0 §4.6)

Approved signing methods — **never paste private keys into source code, chat, logs, shell history, or shared command files**:

1. Hardware wallet: `cast send --ledger --rpc-url $RPC ...` (preferred).
2. Safe Wallet app or Safe CLI for transactions originating from the Safe.
3. Secrets manager injecting the key at runtime into a signing service that is **not** the developer's shell history.

If a hardware wallet is unavailable, use the Safe interface or a secrets manager — never an interactive shell with a raw key. The `--ledger` flag is preferred for all EOA-originating grants during rehearsal.

---

## 8. OD-35 — RESOLVED BY ON-CHAIN VERIFICATION (2026-10-19): CRITICAL FINDING

**The reads have been performed.** `scripts/verify-safe.ts` (read-only eth_call / eth_getCode / eth_getStorageAt) executed against Monad Testnet (`https://testnet-rpc.monad.xyz`, block 72,421,819) and Arc Testnet (`https://rpc.testnet.arc.io`, block 68,031,046). Full evidence: `audit-work/v5/SAFE-VERIFICATION.md` + `safe-verification.json`.

- **`0xE718…A7D0` is a genuine Safe v1.4.1 proxy on BOTH chains** (171-byte proxy; singleton `0x29fcB43b…C762`, 24,421 B mastercopy; `VERSION()` = "1.4.1") — but **`getThreshold()` = 1** (expected 4) and **`getOwners()` = 1 owner: the deployer EOA `0x3C39…8d8c`** (expected 7 signers). `nonce()` = 0, `getModulesPaginated()` = [], guard slot = address(0). It is a **1/1 deployer-controlled Safe, not the mandated 4/7**.
- **Consequences (recorded per Ext-3 Part D):** OD-35 → VERIFIED-FAILED; T-87 → demonstrated-failed (the check was performed; expected 4/7 NOT met); C-040 → verified-and-disproved; v5.0 §1.4 “reported 4/7” posture is disproven — the production security finding stands and Gate 5 is blocked.
- **The conflicting reported Safe addresses are also resolved:** the Ecosystem-JSON “Safes” (`0x7435…d316` Monad / `0xDfcA…B713` Arc) share identical 3,321-byte bytecode and revert on ALL seven Safe-interface reads on both chains — they are **NOT Safes**. `0xE718…A7D0` is the only genuine Safe in any repo record.
- **Address-book contaminations found** (recorded as C-041/C-042): three distinct live MTQ token contracts exist per chain (v5.0 §5.1 “MITHQAL” `0x9e6E…`/`0x237c…`; canonical-map “MTQΣ” `0x0Ac2…`/`0x2420…`; deployment-JSON `0x5D95…`/`0x826b…`); `0xE35a…Bd66` is “Governance” on both chains with different bytecode; Arc Oracle `0xFd2B…861e` shares its hex with Robinhood MockUSDC.
- **Rotation is BLOCKED** until: (1) governance declares the canonical MTQ contract per chain (C-041); (2) the 7 Constitutional signers are constituted and the Safe reconfigured to threshold 4 (`addOwnerWithThreshold` × 7 + `changeThreshold`); (3) `bun run scripts/verify-safe.ts` re-run returns VERIFIED 4/7 on both chains.
- Re-verification is mandatory after ANY Safe reconfiguration — the 2026-10-19 evidence certifies the configuration only at the recorded block heights.

---

## 9. Related obligations

- T-35 (role rotation: no privilege gap; final assignments verified) — live run not yet demonstrated; this document is the procedure, not the evidence.
- Solana mint verification (v5.0 §5.3) is a separate, non-EVM flow (`spl-token display <MINT> --url $SOLANA_RPC`); deferred to Gate 7 per OD-9.
- Cross-chain verification (v5.0 §5.4): collect runtime bytecode/code hash, deployment tx and nonce (or CREATE2 evidence), compiler/build info, constructor args, proxy info if applicable, and role assignments per chain. Matching addresses are not sufficient evidence of matching behavior.

## 10. Prior rehearsal tooling in this repository

- `scripts/audit-fix-roles.ts` — audits the two §1.1 MTQ deployments (plus their Mint contracts) for the production wiring (MINTER on the Mint contract, PAUSER on the Safe) and grants missing roles from the deployer admin.
- `scripts/transfer-ownership.ts` — full ownership-transfer rehearsal: grants DEFAULT_ADMIN to the Constitutional Safe, PAUSER to the Emergency Safe, KEEPER/ORACLE roles, sets the four governance councils, then renounces the deployer's admin and verifies.

Honest note: both scripts predate the §4.6 signing-method rules and read `DEPLOYER_PRIVATE_KEY` from a local `.env`. They are retained as prior testnet-rehearsal evidence only. Any new rotation run must use the §7 signing methods, and the scripts must not be invoked with an unmanaged key for production-adjacent operations.
