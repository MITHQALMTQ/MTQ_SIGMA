# UPGRADEABILITY.md — MTQΣ Upgradeability Strategy

| Field | Value |
|---|---|
| Mandate basis | Ext-1 Part E.3 (deployment and upgradeability); OD-16; v5.0 §22.3 (Constitutional Council + 90-day timelock) |
| Decision owner | Governance + Committee (Ext-1 E.3: "Approval: Governance + Committee") |
| Blocks | Gate 1 |
| Status | **SATISFIED-BY-DOCUMENT (OD-16), pending Committee approval.** This document records the strategy; it does not implement it. The Committee has not yet approved it. |
| Test obligations | T-55 (initialization), T-57 (upgradeability path) — see §5 |
| Project status | TESTNET-ONLY. Production reserve trading is NOT authorized (v5.0 §11.2) |

---

## 1. The decision

Ext-1 E.3 requires the project to choose between immutable contracts and upgradeable
contracts, document the choice, obtain Committee approval, and test it. The choice:

| Scope | Strategy | Rationale |
|---|---|---|
| MTQ token + Reserve contracts (MTQ.sol, Reserve.sol, Mint.sol, Redeem.sol, Takaful.sol, Governance.sol) | **Option A — immutable contracts + migration** | Holds the token standard (OD-37 baseline: ERC-20 + EIP-2612 Permit + ERC20Votes, **not upgradeable**), the reserve accounting, and the value-carrying core. No proxy-admin risk; no upgrade-governance attack surface on the assets. |
| MARP execution logic (Algorithm.sol execution path) | **Option B (UUPS proxy) is OPTIONAL — only if the correction cadence is demonstrably high** | Ext-1 E.3 recommends upgradeability for MARP execution logic "if the correction cadence is expected to be high." That cadence is not yet demonstrated. Default remains Option A for MARP logic too; adopting Option B requires a documented correction-cadence case + the §3 governance package + Committee approval. |

Per Ext-1 E.3, both paths are documented below; adopting Option B anywhere is a Committee
decision, not a developer default.

## 2. Option A — immutable contracts + migration (the chosen default)

- No upgrades. Defects are fixed by deploying new contracts and migrating state.
- **Migration path (Ext-1 E.3, mandatory sequence):**
  1. New deployment (new address, new deployment record; old addresses preserved for auditability — C-016).
  2. State migration script (holdings, supplies, role assignments, parameter registry, index state — chain-linked divisor and last prices must migrate without altering the index level).
  3. User notification.
  4. Transition period with **both** contracts live.
  5. Final cutover.
- Cost: every fix is a migration.
- Benefit: no proxy-admin risk, no upgrade-governance attack surface.
- Current live example of the pattern: the corrected V3 source (`contracts/MTQSigmaV2.sol` /
  `contracts/deployments/MTQSigmaV2-PENDING.json`) is a fresh deployment carrying the P0
  corrections, not an in-place upgrade of the existing testnet deployments.

## 3. Option B — upgradeable contracts (UUPS or Transparent Proxy), if ever chosen

Applies only to MARP execution logic per §1, and only with all of the following:

1. **Upgrade governance:** 7/7 Constitutional Council + 90-day timelock (v5.0 §22.3). No EOA, no single Safe signature, no emergency short-circuit.
2. **Upgrade proposal must include:**
   - new implementation address,
   - storage layout diff,
   - security audit,
   - rollback plan.
3. **Hard rules (Ext-1 E.1), regardless of proxy flavor:**
   - the implementation contract calls `_disableInitializers()` in its constructor;
   - the proxy is initialized **atomically in the same deployment transaction** (no window with an uninitialized proxy);
   - the proxy admin is the Safe, with a timelock;
   - for the MTQ token (ERC20 with roles): initialization sets `DEFAULT_ADMIN_ROLE` to the Safe, **not** the deployer EOA; the deployer receives only the temporary roles needed to complete the transfer, then is revoked (see ROLE_ROTATION.md).

## 4. Compensating controls

- OD-27 (implemented): the registry records each deployment's implementation/code hash; any change triggers a WATCH state — this is the monitoring pattern that would police an Option B deployment and also detects unauthorized redeploys masquerading as the real contract.
- OD-37 (implemented): token baseline is explicitly NOT upgradeable, which makes the §3 governance package inapplicable to the token by construction.
- C-017/C-018 (Ext-1 A.1/A.2): reentrancy guards and approval hygiene are enforced in the immutable contracts, reducing the expected defect rate that would motivate Option B.

## 5. Test obligations

| Test | Requirement | Status |
|---|---|---|
| T-55 | Initializer can be called exactly once; reinitialization attempts revert; `DEFAULT_ADMIN_ROLE` is on the Safe, not the deployer EOA (Ext-1 E.1) | Applies to any future proxied deployment; no proxy is currently deployed, so it is not-demonstrated on-chain. The immutable constructor pattern in `contracts/MTQSigmaV2.sol` sets roles at construction (no initializer window). |
| T-57 | Verify that the chosen path works and that **the other path is not accidentally enabled** (Ext-1 E.3) | The chosen path (Option A, immutable) is demonstrated by the existing deployments and the V3 pending-deployment record; register labels it satisfied-by-document pending Committee approval of this document. Accidental-enablement check: no proxy admin machinery exists in the deployed bytecode — verify per deployment via code hash in the deployment register. |

## 6. Approval record

| Field | Value |
|---|---|
| Document | UPGRADEABILITY.md (this file) |
| Choice | Option A (immutable + migration) for MTQ token + Reserve contracts; Option B (UUPS) optional for MARP execution logic only upon documented high correction cadence |
| Committee approval | **NOT YET GRANTED** — OD-16 remains SATISFIED-BY-DOCUMENT, blocking Gate 1 until approved |
| Change control | Any switch between Options A and B reopens OD-16 and requires a new Committee decision record (owner, date, version, affected components) |
