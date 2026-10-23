# MTQΣ Task 8-e — Authoritative Live Role Verification (individual eth_call, READ-ONLY)

Probed: 2026-10-21T19:11:26.157Z · §1 VERIFICATION-ONLY — hasRole()/paused() view calls only.

## Monad Testnet (chainId 10143) — block 73037271

| Contract | Role | Account | hasRole |
|---|---|---|---|
| MTQ.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| MTQ.sol | DEFAULT_ADMIN_ROLE | safe | true |
| MTQ.sol | DEFAULT_ADMIN_ROLE | governance | false |
| MTQ.sol | MINTER_ROLE | deployer | true |
| MTQ.sol | MINTER_ROLE | safe | true |
| MTQ.sol | MINTER_ROLE | governance | false |
| MTQ.sol | PAUSER_ROLE | deployer | true |
| MTQ.sol | PAUSER_ROLE | safe | true |
| MTQ.sol | PAUSER_ROLE | governance | false |
| Governance.sol | DEFAULT_ADMIN_ROLE | deployer | REVERT |
| Governance.sol | MINTER_ROLE | deployer | REVERT |
| Governance.sol | PAUSER_ROLE | deployer | REVERT |
| Safe (Multi-Sig) | DEFAULT_ADMIN_ROLE | deployer | REVERT |
| Safe (Multi-Sig) | MINTER_ROLE | deployer | REVERT |
| Safe (Multi-Sig) | PAUSER_ROLE | deployer | REVERT |
| Algorithm.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| Algorithm.sol | MINTER_ROLE | deployer | false |
| Algorithm.sol | PAUSER_ROLE | deployer | false |
| Reserve.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| Reserve.sol | MINTER_ROLE | deployer | true |
| Reserve.sol | PAUSER_ROLE | deployer | false |
| Mint.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| Mint.sol | MINTER_ROLE | deployer | true |
| Mint.sol | PAUSER_ROLE | deployer | false |
| Redeem.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| Redeem.sol | MINTER_ROLE | deployer | false |
| Redeem.sol | PAUSER_ROLE | deployer | REVERT |
| Oracle.sol | DEFAULT_ADMIN_ROLE | deployer | REVERT |
| Oracle.sol | MINTER_ROLE | deployer | false |
| Oracle.sol | PAUSER_ROLE | deployer | false |
| Takaful.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| Takaful.sol | MINTER_ROLE | deployer | false |
| Takaful.sol | PAUSER_ROLE | deployer | false |
| MTQ.sol | paused() | - | false |

## Arc Testnet (chainId 5042002) — block 68397451

| Contract | Role | Account | hasRole |
|---|---|---|---|
| MTQ.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| MTQ.sol | DEFAULT_ADMIN_ROLE | safe | false |
| MTQ.sol | DEFAULT_ADMIN_ROLE | governance | false |
| MTQ.sol | MINTER_ROLE | deployer | true |
| MTQ.sol | MINTER_ROLE | safe | false |
| MTQ.sol | MINTER_ROLE | governance | false |
| MTQ.sol | PAUSER_ROLE | deployer | true |
| MTQ.sol | PAUSER_ROLE | safe | true |
| MTQ.sol | PAUSER_ROLE | governance | false |
| Governance.sol | DEFAULT_ADMIN_ROLE | deployer | REVERT |
| Governance.sol | MINTER_ROLE | deployer | REVERT |
| Governance.sol | PAUSER_ROLE | deployer | REVERT |
| Safe (Multi-Sig) | DEFAULT_ADMIN_ROLE | deployer | REVERT |
| Safe (Multi-Sig) | MINTER_ROLE | deployer | REVERT |
| Safe (Multi-Sig) | PAUSER_ROLE | deployer | REVERT |
| Algorithm.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| Algorithm.sol | MINTER_ROLE | deployer | false |
| Algorithm.sol | PAUSER_ROLE | deployer | false |
| Reserve.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| Reserve.sol | MINTER_ROLE | deployer | false |
| Reserve.sol | PAUSER_ROLE | deployer | false |
| Mint.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| Mint.sol | MINTER_ROLE | deployer | true |
| Mint.sol | PAUSER_ROLE | deployer | false |
| Redeem.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| Redeem.sol | MINTER_ROLE | deployer | false |
| Redeem.sol | PAUSER_ROLE | deployer | false |
| Oracle.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| Oracle.sol | MINTER_ROLE | deployer | false |
| Oracle.sol | PAUSER_ROLE | deployer | false |
| Takaful.sol | DEFAULT_ADMIN_ROLE | deployer | true |
| Takaful.sol | MINTER_ROLE | deployer | false |
| Takaful.sol | PAUSER_ROLE | deployer | false |
| MTQ.sol | paused() | - | false |

## CORRECTION (2026-10-21, later same session) — evidence-preserving

Two Monad entries in the earlier tables above were **transient RPC errors misclassified as REVERT**,
corrected after direct individual re-verification with raw output:

| Contract | Role | Earlier table | Re-verified truth (raw eth_call result) |
|---|---|---|---|
| Oracle.sol (Monad) | DEFAULT_ADMIN_ROLE | REVERT | **TRUE** (`0x…01`) |
| Redeem.sol (Monad) | PAUSER_ROLE | REVERT | **false** (`0x…00`) |

The only TRUE reverts are Governance.sol and the Safe proxy (both chains, all three role queries,
stable across batch + individual + live probes) — they do not implement OpenZeppelin `hasRole`.

Root cause: the Monad public RPC intermittently returns JSON-RPC errors (rate limit / load) that
were mapped to "REVERT" by the probe scripts. Fix applied in `/api/roles` ethCall: JSON-RPC errors
are classified REVERT only when the message contains "revert"; otherwise retried 3×, then honestly
reported as UNREACHABLE/UNVERIFIED. Raw probe files (role-probe.json, role-matrix-authoritative.json)
are preserved unmodified as the original evidence trail.

Re-verified stable summary (Monad block ~73,050,000, Arc block ~68,405,000, live via /api/roles):
- MTQ.sol on BOTH chains: deployer holds DEFAULT_ADMIN ✓ / MINTER ✓ / PAUSER ✓ — matches the
  owner's reference ("Click Query → Should return true" ×3). paused() = false on both.
- Genesis Safe holds ADMIN+MINTER+PAUSER on Monad MTQ; only PAUSER on Arc MTQ (cross-chain asymmetry).
- Deployer holds DEFAULT_ADMIN on all 7 AccessControl contracts per chain (MTQ, Algorithm, Reserve,
  Mint, Redeem, Oracle, Takaful). MINTER additionally on: MTQ + Mint.sol (both chains), Reserve.sol (Monad).
