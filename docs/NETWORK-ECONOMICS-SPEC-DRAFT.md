# MTQΣ Network — Network Economics Specification (DRAFT)

**Document ID:** NES-DRAFT-1 · **Status:** DRAFT — FOR OWNER RATIFICATION. NO VALUE IN THIS DOCUMENT IS PRODUCTION-APPROVED.
**Authored:** Task-42 (2026-11-05), COO/CTO/crypto-ecosystem mandate ("full consensus creative thinking to implement all missing and recommendations").
**Scope:** the MTQ Sigma Network sovereign-chain economic layer ONLY — the `uMTQD` testnet network credit, block rewards, the treasury, slashing taxonomy, and the fee flow. **Explicitly OUT of scope (constitutionally excluded, Part 2):** the MTQΣ monetary asset — its supply, weights, basket, fees, haircuts, buffers, oracles, MASE/MARP machinery, and lifecycle parameters can NEVER be touched, minted, inflated, or governed by network economics or network governance. The constitutional guard in `src/lib/chain/shared.ts` (allowlist + `MONETARY_GUARD_PATTERNS`) rejects any proposal that drifts into monetary-registry territory at submission.

**Ratification protocol (dual-gate activation — the load-bearing rule):**
1. The owner ratifies specific D-NE decision values by explicit directive (recorded with verbatim evidence, timestamp, and parameter digest — the same ledger discipline as the constituency approvals ledger, D-13.11/D-13.14).
2. Network governance then votes `rewards_enabled` (a network param, allowlisted, bounds [0,1]).
3. Only when BOTH gates clear does the engine pay anything. The shipped default is **OFF** (`rewards_enabled = 0`, `block_reward_u = 0`) — no reward is paid anywhere today.

**Implementation status (honest, at authoring time):** the block-reward ENGINE is implemented in the reference devnet state machine (`src/lib/chain/state.ts::distributeBlockReward`, Task-42): integer micro-unit payouts from the devnet treasury, fail-closed on insufficient treasury, deterministic dust rule, `econ.block_reward` event per payout. Slashing is **documented-not-implemented** — a single-process reference node cannot generate honest equivocation/downtime evidence (see §6). Nothing in this draft changes any MTQ monetary parameter.

---

## 1. Assets and authority (what economics may touch)

| Asset | Nature | Economics authority | MTQΣ monetary authority |
|---|---|---|---|
| `uMTQD` (FEE) | testnet-only network credit | **this spec** (rewards, fees, treasury) | none — MTQΣ is not the gas token (NDD-1 §3.3) |
| `PMTQ` | NON-CANONICAL pilot ledger mirror | none — mirror transfers only | canonical accounting stays in the monetary engine |
| `MTQΣ` | the monetary unit | **NONE — constitutional exclusion** | monetary protocol + owner + Gate-C process |

**D-NE-1 (OPEN):** reward asset = `uMTQD` network credit exclusively. Alternatives considered: (a) none/no rewards, (b) uMTQD-only ✖/✔, (c) PMTQ rewards, (d) MTQΣ-denominated rewards. **Recommended: (b)** — the only asset that is both network-native and constitutionally firewalled from the monetary unit. (c)/(d) are REJECTED as constitutional violations (network economics must never create monetary-supply pressure); (a) remains the owner's prerogative — the default state of this draft is OFF, which IS (a) until ratified.

## 2. Treasury (emission source)

Rewards are paid from a **pre-funded treasury account**, never minted from nothing, never inflationary against any holder:
- Devnet treasury = the faucet account (`treasury_address` chain meta, provisioned at node boot), pre-funded by genesis allocation (1M MTQD devnet credit).
- **D-NE-2 (OPEN):** production treasury = a dedicated `network_treasury` genesis allocation, sized by a ratification decision, refilled ONLY by: (i) fee flow redirection (§7), (ii) explicit owner-funded deposits. No print-to-treasury path exists or is proposed.
- **D-NE-3 (OPEN):** treasury exhaustion is **fail-closed** — when the treasury cannot cover a block's reward, the payout is skipped and an `econ.rewards_exhausted` event is emitted (implemented). Never partial payment, never borrowing, never auto-refill.

## 3. Block reward schedule

**D-NE-4 (OPEN — devnet-paced proposal):** per-block reward `R = block_reward_u`, a network param (bounds [0, 1e9] µ), DEFAULT 0. Devnet-paced proposal for ratification consideration: **1,000 µMTQD/block** (≈ 0.001 MTQD per 5s heartbeat block — trivially small, enough to exercise the machinery visibly). Production values MUST be derived from a ratified emission budget (§4) — no number in this draft is endorsed.

**Distribution formula (implemented; deterministic integer math in micro-units):**
```
proposerCut = floor(R × 0.20)          // D-NE-5: proposer bonus
base        = R − proposerCut
share_v     = floor(base × power_v / totalPower)   for every ACTIVE validator v (power > 0)
dust        = R − proposerCut − Σ share_v           // floor-rounding residue
proposer    += proposerCut + dust                    // dust flows to the proposer — no dust loss
treasury    −= proposerCut + Σ share_v + dust        // exact conservation: Σ payouts ≡ R
```
- **D-NE-5 (OPEN):** proposer bonus 20% (alternatives: 0% / 10% / 20% / 25%). Recommended 20% (Cosmos-tutorial-adjacent, bounded proposer capture).
- **D-NE-6 (OPEN):** distribution basis = voting power pro-rata (implemented) vs. signed-blocks/uptime-weighted (production proposal — see §5). Power-pro-rata is the honest reference choice because in a single-process node, "uptime" cannot be measured honestly: all four engines are co-located and always "up".
- Recipients = the ACTIVE validator set **after** end-of-block processing of the block they closed (post-recompute — the set that actually ended the block; documented in code).
- Every payout emits an `econ.block_reward` event carrying the full record: `{amount_u, r_u, proposer, proposer_share_u, recipients, treasury, total_power}`.
- If the recorded proposer is not in the ACTIVE set (should not happen; defensive path), the proposer cut + dust stays in the treasury under a documented burn rule with an `econ.reward_dust_burned` event.

## 4. Emission budget discipline (production proposal — NOT for devnet)

Production `block_reward_u` must satisfy a ratified budget envelope:
```
annual_emission_uMTQD = block_reward_u × expected_blocks_per_year ≤ treasury_horizon_uMTQD / years
```
with `treasury_horizon` = the ratified treasury endowment and `years` = the ratified runway (proposal: 10 years). At exhaustion, rewards stop (fail-closed, D-NE-3) — the network does NOT have an inflation fallback. A council-documented treasury top-up (fee redirection §7 or owner deposit) is the only refill path. **No infinite-emission schedule is proposed. Ever.**

## 5. Uptime (production proposal — not honestly measurable in-process)

Production proposal (D-NE-7, OPEN): replace power-pro-rata with a per-epoch signed-block-window uptime factor `u_v = blocks_signed_v / blocks_expected_v` over the last `epoch_blocks`, paying `share_v ∝ power_v × u_v`, with a minimum-uptime floor below which the validator forfeits the epoch payout (not jailed — jailing/slashing is §6). This is the standard Cosmos-family design. **Why it is NOT implemented now:** the reference devnet's four engines are co-located in one process — any "uptime" number computed here would be synthetic by construction (they cannot fail independently), which would be a fake metric. The machinery (epoch windows, per-validator counters) will be implemented with the multi-host CometBFT production node, where missed-block evidence is real.

## 6. Slashing taxonomy (documented — deliberately NOT implemented)

**D-NE-8 (OPEN — ratification required before ANY implementation):**

| Violation | Evidence required | Proposed penalty (FOR RATIFICATION) |
|---|---|---|
| Equivocation / double-sign | two conflicting signed proposals/precommits for same (height, round) from the same key, observed by ≥2 independent witnesses | burn of self-stake: 5% (proposal), plus power zeroing + jail |
| Downtime (persistent) | signed-block-window deficit below floor across an epoch | NO burn (proposal); payout forfeiture only (§5) — jailing after governance vote |
| Governance misconduct | provable vote-bribery/collusion evidence — counsel-defined | counsel-defined; NOT auto-slashable |
| INVALID STATE SIGNATURE (signing a block whose state transition provably violates canonical rules) | replayable deterministic proof | burn of 100% self-stake (proposal) — the existential offense |

**Why nothing is implemented in the reference devnet:** slashing requires *unforgeable evidence of an offense*. A single-process node cannot produce honest equivocation evidence (one process signing twice is a code bug, not a Byzantine validator; there are no independent witnesses); a fake slashing demo would be exactly the kind of dishonest theater this platform refuses. The burn mechanics (integer self-stake deduction + power zero + jail status) are specified here so the production multi-host implementation is mechanical, not inventive. **No slashing event can occur on the devnet. This is a feature, not a gap.**

## 7. Fee flow (current: burn · production proposal)

**Current implemented behavior (unchanged by Task-42):** tx fees are charged in `uMTQD` and debited from the sender with NO credit to anyone — an implicit burn. Honest, conservative, and simple.
**D-NE-9 (OPEN — production proposal):** redirect a ratified fraction of each block's fees to the block proposer (gas-fee model) and/or the treasury: `fee_split = {proposer: X%, treasury: Y%, burn: 100−X−Y}%`. Requires owner ratification of (X, Y); until then the burn stays. **NOT implemented — changing fee destinations without ratification would be an economic invention.**

## 8. Unbonding + reward claiming interplay

- Unbonding queue (`unbonding_s`, Task-41): pure time-lock, no rewards accrue while queued, no slashing applies to queued amounts (they have zero voting power — nothing to punish). Production `unbonding_s` proposal for ratification: **21 days (1,814,400 s)** with the slashing-safety rationale: queued stake must remain exposed long enough to cover a detected equivocation committed while bonded (standard Cosmos-family reasoning). Devnet stays 30 s.
- Rewards are paid to **validator accounts** directly (implemented). Distribution to delegators (commission-aware pass-through: `delegator_share = share_v × (1 − commission_bp/10⁴)`) is D-NE-10 (OPEN) — production proposal: commission pass-through at epoch payout, with the validator's `commission_bp` (already stored, informational today) becoming operative ONLY upon ratification. **Not implemented now:** with rewards OFF there is nothing to pass through; implementing the split before activation would be building machinery for an unapproved economy.

## 9. Governance interaction (what network governance may and may not do)

- MAY: propose `rewards_enabled` (0/1) and `block_reward_u` (within allowlist bounds) — both in `NETWORK_PARAM_ALLOWLIST` after Task-42, subject to the full voting period + timelock.
- MAY NOT: touch anything matching `MONETARY_GUARD_PATTERNS` (weights, basket, reserve, haircut, buffer, oracle, mase, marp, mint_fee, redeem, supply, index, parity, gold, currency, constituency, lifecycle, …) — rejected at submission (constitutional guard, verbatim in `shared.ts`).
- The dual-gate rule means network governance alone can NEVER switch rewards on without the owner's prior ratification record. A governance vote passing `rewards_enabled=1` without a recorded owner ratification on file is an owner-audit finding, and the honest-status layer reports ratification state.

## 10. Honest-status text of record (rendered by the node)

> "Staking records bonding + voting power. A block-reward ENGINE is implemented (uMTQD testnet credit paid from the devnet treasury account) per the Network Economics Specification DRAFT — but rewards_enabled is DEFAULT OFF (block_reward_u = 0): no reward is paid anywhere until the owner ratifies the DRAFT values AND network governance votes activation. No MTQΣ inflation ever (constitutional); no slashing implemented in the single-process reference (no honest equivocation evidence can exist in-process — taxonomy documented in the draft); PMTQ/MTQ monetary territory is untouched by network economics."

## 11. Verification evidence (Task-42)

- `scripts/chain-smoke.ts` leg 6: enable rewards via the param store (state-machine test; the governance path is exercised by leg 4) → heartbeat block pays from treasury → `econ.block_reward` event present → balance conservation asserted (treasury delta = −Σ validator deltas) → params restored OFF.
- Determinism: integer micro-unit math, floor division, dust-to-proposer — same inputs ⇒ same payouts on any host.
- Devnet topology note: under the tolerated dual-writer smoke topology, each block is paid exactly once (the payout runs in `applyBlock`, which executes only in the block's producing process); the single-writer invariant remains the supported deployment.

## 12. NOT-claims (verbatim discipline)

- NO production value in this document is approved, endorsed, or activated.
- NO reward is paid on the shipped devnet (both params 0).
- NO slashing exists anywhere in the codebase.
- NO fee-destination change has been made.
- NO MTQΣ-denominated reward, inflation, or monetary-registry influence is proposed — ever.
- Production economics (emission budget, uptime, commission pass-through, slashing penalties) all await owner ratification of the D-NE register above, and the multi-host production node where their evidence inputs become real.

---

*End of Network Economics Specification DRAFT. Decision register D-NE-1 … D-NE-10 all OPEN. Ratification path: owner directive → recorded evidence + digest → governance vote on `rewards_enabled` → activation. Until then: OFF.*
