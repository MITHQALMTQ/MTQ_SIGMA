# MTQΣ — COO Professional Recommendations on the v1.0 Audit

**From:** COO
**Date:** 2026-09-08
**Re:** Honest professional recommendations following the top-tier multi-disciplinary audit (final grade 65/100)
**Audience:** Protocol owner, board, CTO, CFO, governance council
**Status:** Final — action-required

---

## 1. The honest summary (one paragraph)

The audit was thorough, the audit was right, and the audit's headline finding is **non-negotiable**: the protocol has a structural short-gold exposure caused by a chain-linking math error that makes the gold +50% stress test fail in 100% of runs. This is not a difference of opinion, not a stylistic preference, not a "we'll fix it later" item — it is a **math error that, if deployed to mainnet as-is, would cause the protocol to die on the exact asset it is supposed to be backed by**. The blueprint specification itself is excellent (92/100). The implementation is a strong pilot (62/100) that diverges from the blueprint on four constitutional points. The contract's self-declared `0x7FF` honest mask is overstated; the audit-verified honest mask is `0x5A7` — 4 of 11 bits are not truly implemented. The protocol is honestly a candidate for public testing on testnet, NOT production-authorized for mainnet, and the path from here to mainnet is concrete and finite.

## 2. The 4 things I recommend we do THIS WEEK (immediate, P0)

These four actions are not optional. Each has a single owner and a clear "done" criterion.

### Recommendation 1 — Fix the chain-linking math (P0-1)
**Owner:** CTO
**Deadline:** 5 business days
**Why now:** This is the single finding that, if unfixed, makes mainnet deployment professionally irresponsible. A +50% gold shock is a realistic scenario (gold has done +30% in 12 months in the real world); the protocol currently dies in 100% of those runs. We cannot ship a monetary unit that dies when its largest reserve asset appreciates.
**Done criterion:** Implement `I_t = I_{t-1} × Σ W_{i,t-1} × (P_{i,t}/P_{i,t-1})` in both `engine.ts::computeGfbIndex` and `MTQSigmaV2.sol::getGFB`. Store `I_t` and `W_{i,t-1}` in contract storage; advance `I_t` on every accepted weight commit. Re-run stress test S5 (gold +50%); target ≥ 95% survival.
**Resource:** 1 senior engineer × 5 days. No external dependency.

### Recommendation 2 — Downgrade `getHonestStatus()` to `0x5A7` and update the UI (honesty fix)
**Owner:** COO (me) — I am taking this action today, see §6 below
**Deadline:** Today
**Why now:** The contract claims `0x7FF` (all 11 bits). The audit proves only 7 bits are truly implemented. Shipping an honest-status function that lies is the single most reputation-damaging thing we could do — it converts a "strong pilot with known gaps" into "a protocol that misrepresents its state." The fix is trivial; the cost of not fixing it is existential trust loss.
**Done criterion:** The contract source returns `0x5A7`. The OnChainMatrix UI shows `0x5A7` with the 4 overstated bits visibly flagged. The Honest Status panel surfaces the 4 P0 audit findings.

### Recommendation 3 — Add the missing S3 STRESS risk state (P0-3)
**Owner:** CTO
**Deadline:** 3 business days
**Why now:** The protocol currently jumps from CAUTION (1.05–1.10) directly to DEFENSIVE (1.00–1.02), skipping STRESS (1.02–1.05). Under a moderate shock, redemers are overcharged 2× fee (1.00% instead of 0.50%). This is a user-experience failure and a fee-fairness failure.
**Done criterion:** S3 STRESS added to the `Status` enum (contract), `RISK_STATE_MACHINE` (TS), `determineStatus` function, and the redeem fee schedule. UI updated to show 6 states, not 5.
**Resource:** 1 engineer × 2 days.

### Recommendation 4 — Reconcile the redemption pricing contradiction (P0-2)
**Owner:** COO + CTO (joint)
**Deadline:** 5 business days
**Why now:** The blueprint contradicts itself — §3.4.2 says price redemption against the GFB index (P_MTQ); §19.1/§19.3.2/Invariant I6 say price against NAV_t. The implementation chose P_MTQ (the arbitrage-safe path). This is defensible, but the blueprint text is wrong, and we cannot ship a specification that contradicts itself on the second-most-important invariant (I6).
**Done criterion:** A signed-off blueprint v1.0.1 erratum that either (a) restates I6 as "Redemption is priced against the GFB index (P_MTQ) — the arbitrage-safe price — never against NAV_t which is unsafe at high RR" and updates §19.1/§19.3.2 to match, OR (b) defines `NAV_t = min(P_MTQ, V_net/S_circ)` and updates the implementation. I recommend (a); the CTO may disagree.
**Resource:** 1 day of COO+CTO joint writing + 1 external monetary architect review (1 day).

## 3. The 4 things I recommend we do THIS MONTH (near-term, P1)

### Recommendation 5 — Fix the 6 Critical smart-contract findings before any testnet redeploy
**Owner:** CTO
**Deadline:** 15 business days
**Scope:**
- C1 MASE weights committed but never consumed by `getGFB` — wire `getGFB` to use `commitWeights` target/smoothed weights.
- C4 `executeRebalance` missing the §11.5.3 RR<1.05 direction-lock override — solvency outranks anti-churn.
- C5 `genesisMint(0)` lockout — add `require(amount > 0)`.
- C6 Oracle adapter zero-price collusion — add `require(p > 0)` in `commitFxRatesFromOracles`.
- H1/H2 Reentrancy in mint/redeem — apply Checks-Effects-Interactions + ReentrancyGuard.
- H3 Unbounded `executeRebalance` loop — cap at 7 trades (one per component).
- H4 Redeem missing the price-safety guard — apply `getMTQPriceWithGuard` to redeem.
- H5 `setReserveVault(address(0))` allowed — add `require(v != address(0))`.
- H6 `bootstrapReserveHoldings` overwrites — make it one-shot.
**Resource:** 1 senior Solidity engineer × 10 days + 1 external audit firm retainer (see §5).

### Recommendation 6 — Implement the 4 governance layers (P0-4)
**Owner:** COO + governance counsel
**Deadline:** 20 business days
**Why now:** The contract has 1 timelock (Monetary 48h). The blueprint specifies 4 layers (Constitutional 90d 7/7 / Monetary 48h DAO / Risk 24h 4/7 / Emergency instant 4/7). Until we have all 4, we cannot honestly claim "DAO governance" — and more importantly, we cannot protect the protocol from a single malicious or compromised admin.
**Done criterion:** 3 separate timelock controllers + Emergency Council multi-sig. Each privileged function maps to the correct layer (e.g., envelope changes → Constitutional 90d; fee changes → Monetary 48h; haircut changes → Risk 24h; pause → Emergency instant). Until done, `getHonestStatus()` bit 9 stays 0.
**Resource:** 1 senior Solidity engineer × 8 days + 1 governance architect × 4 days for the signer-selection + DAO-vote mechanics.

### Recommendation 7 — Document the RR decay curve and add the auto-rebalance trigger
**Owner:** CFO + CTO
**Deadline:** 10 business days
**Why now:** The audit's CFO finding is uncomfortable but accurate: at $1B of mints, the protocol's RR decays to 1.001 — close to the hard floor — without ongoing rebalancing. The protocol is sustainable ONLY if the keeper reliably executes rebalances as the reserve grows. This is not documented anywhere users can see. We must disclose it AND build the auto-trigger.
**Done criterion:** (a) Add an "RR Sustainability" panel to the Honest Status section that shows the decay curve (the table from AUDIT-D). (b) Implement an auto-rebalance trigger at RR < 1.05 (STRESS) that the keeper MUST execute within 24h (timelock-gated). At RR < 1.02 (DEFENSIVE), force-execute the rebalance regardless of keeper action — solvency outranks keeper discretion.
**Resource:** 1 engineer × 5 days for the trigger + 1 day COO sign-off on the disclosure language.

### Recommendation 8 — Separate the Operational Wallet (fee accounting fix)
**Owner:** CFO + CTO
**Deadline:** 10 business days
**Why now:** Fees currently accrue to `reserveVault` (which counts toward NAV/RR), inflating reported RR by 10–25 bps. The blueprint §20.4 specifies a separate Operational Wallet. Without this, we are reporting a healthier reserve than we actually have — a finding that, if a regulator or independent auditor caught it first, would be a credibility catastrophe.
**Done criterion:** Add `operationalWallet` address; split fees 20% to Operational Wallet / 80% to Reserve Vault (or per governance). Update NAV/RR computation to exclude the Operational Wallet balance.
**Resource:** 1 engineer × 3 days.

## 4. The 3 things I recommend we do THIS QUARTER (longer-term, P2)

### Recommendation 9 — Engage an independent third-party audit firm
**Owner:** COO
**Deadline:** 60 business days from now
**Scope:** Trail of Bits, OpenZeppelin, or Consensys Diligence for the contract. StatPath or Gauntlet for the monetary engine + Monte Carlo. This is non-negotiable before mainnet. Our internal audit is thorough; an external audit is the credibility gate. Budget: $80-150K.
**Why:** The §23.12 validation gates require an independent audit. We cannot self-certify.

### Recommendation 10 — Complete the §23 validation program in full
**Owner:** CTO + research lead
**Deadline:** 90 business days
**Scope:** §23.2 historical backtest (10+ years of FX/gold data), §23.3 walk-forward validation, §23.4 purged/leakage-controlled validation, §23.5 Monte Carlo (re-run after the chain-linking fix; target ≥ 95% on all 11 scenarios), §23.6 parameter perturbation, §23.7 model-selection criterion, §23.8 gold-specific stress (re-run after the fix), §23.9 currency stress, §23.10 stable-value stress, §23.11 reserve stress equation. Publish the results, including failures, in a §24 transparency report.
**Resource:** 1 quantitative researcher × 12 weeks.

### Recommendation 11 — Document the genesis distribution + governance tokenomics
**Owner:** COO + tokenomics counsel
**Deadline:** 60 business days
**Scope:** The blueprint does not specify (a) who owns the genesis 1M MTQ, (b) whether there's a governance token, (c) how the 7/7 Constitutional Multi-Sig signers are selected, (d) how the DAO vote mechanics work. These are not optional for mainnet — they are the difference between a protocol and a project.
**Done criterion:** A signed-off Genesis Distribution + Governance document covering: genesis holder (recommended: a Cayman foundation holding 100%, with a 4-year vesting schedule for any team allocation); governance token decision (recommended: NO governance token — the 4-layer hierarchy is sufficient, simpler, and avoids the governance-token regulatory surface); signer-selection process (recommended: 7 independent entities, no single entity > 2 seats); DAO vote mechanics (recommended: 51% quorum with 48h timelock, on-chain voting via Snapshot off-chain + on-chain execution).
**Resource:** 1 tokenomics counsel × 5 days + 1 governance counsel × 5 days.

## 5. Resource + budget allocation (COO view)

| Item | Owner | Days | Est. cost (USD) |
|---|---|---|---|
| P0-1 chain-linking fix | CTO | 5 senior-eng | $7.5K |
| P0-2 redemption reconciliation | COO+CTO | 2 + 1 external | $4K |
| P0-3 S3 STRESS state | CTO | 2 eng | $3K |
| P0-4 4 governance layers | COO+CTO | 8 eng + 4 governance arch | $18K |
| P1 6 Critical + 8 High smart-contract fixes | CTO | 10 eng | $15K |
| P1 Operational Wallet | CFO+CTO | 3 eng | $4.5K |
| P1 RR decay disclosure + auto-trigger | CFO+CTO | 6 eng | $9K |
| External audit (Trail of Bits / OZ / Diligence) | COO | — | $80-150K |
| §23 validation program | CTO+research | 12 weeks | $60K |
| Genesis + governance docs | COO+counsel | 10 counsel-days | $20K |
| **Total to mainnet-ready** | | | **$220-280K** |
| Timeline to mainnet-ready | | **6-9 months** | (sequential, not parallel) |

This is a realistic budget and timeline for a top-tier monetary protocol. Anything less is cutting corners that the audit has already identified.

## 6. The honesty action I am taking today (as COO)

As COO, I am not just recommending — I am taking three immediate actions on the honesty findings, because they cost zero engineering time and are entirely within my authority:

**Action A — Downgrade the OnChainMatrix honest mask to `0x5A7`.**
The audit proved 4 of 11 bits in the contract's `getHonestStatus()` are overstated. The OnChainMatrix currently shows "11 source-ready" implying all 11 bits will be earned by V2. I am updating it to honestly show: **7 bits truly implemented, 4 bits overstated, audit-verified honest mask = `0x5A7`**.

**Action B — Surface the audit findings in the Honest Status panel.**
The audit produced 4 P0 findings, 6 Critical smart-contract findings, 8 High findings, and 5/11 stress tests that failed their targets. The user-facing Honest Status panel must surface these — not as "we passed the audit" but as "here is what the audit found, here is what we are doing about it." Transparency is the cheapest credibility we can buy.

**Action C — Add a visible link to the full audit report.**
The 3,111-line audit (5 reports) is at `audit-work/`. The UI must link to it. Anyone evaluating the protocol must be able to read the audit in full, including the failures.

I am executing these three actions in parallel with this recommendation document. The engineering P0 fixes (Recommendations 1, 3, 5, 6, 7, 8) require CTO + engineering resources and are not in my unilateral power — those are recommendations to the protocol owner.

## 7. Communication posture (COO voice)

**External communication — what we say:**
- "The v1.0 Master Blueprint is complete and audited. The audit found 4 P0 gaps between the specification and the implementation. We are publishing the full audit report and the fix roadmap. The protocol remains a candidate for public testing on testnet; mainnet deployment is gated on the 4 P0 fixes + an independent external audit."
- "Our honest status is `0x5A7`, not `0x7FF`. We over-claimed 4 bits; we are correcting the record."
- "The audit caught a structural short-gold exposure in the index math that would have caused a death spiral under a gold appreciation shock. We are fixing it before any mainnet deployment. This is exactly what a rigorous pre-deployment audit is supposed to do."

**External communication — what we do NOT say:**
- ❌ "The audit passed." (It did not pass; it produced 4 P0 findings.)
- ❌ "The protocol is production-ready." (It is not; it is candidate for public testing.)
- ❌ "The contract implements all 11 v1.0 components." (It implements 7; 4 are overstated.)
- ❌ "The stress tests passed." (5 of 11 failed their targets.)
- ❌ "The chain-linking is implemented." (It is not; the engine uses fixed-base Laspeyres.)

The rule is simple: we say what is true, we correct what is not, we publish the audit, we fix the findings. Credibility is the only asset we cannot rebuild.

## 8. Governance posture (COO voice)

Until the 4 governance layers are implemented (Recommendation 6), the protocol is effectively under admin-key control. This is acceptable for a testnet pilot, unacceptable for mainnet. My recommendation is:
- **Testnet:** admin-key control is fine. Document it. The Honest Status already says "NOT production-authorized."
- **Mainnet:** no deployment until the 4 governance layers (Constitutional 90d 7/7 / Monetary 48h DAO / Risk 24h 4/7 / Emergency instant 4/7) are implemented AND the 7 Constitutional signers are independent entities AND the DAO vote mechanics are live.

I will not sign off on a mainnet deployment plan that does not include the 4 governance layers.

## 9. The 5 production-readiness gates (my COO sign-off criteria)

I will not sign off on mainnet deployment until ALL FIVE are met:

1. **Gate 1 — Chain-linking fixed.** Stress test S5 (gold +50%) survival ≥ 95%. Verified by re-running §23.5.
2. **Gate 2 — All 4 P0 findings fixed.** Chain-linking, redemption reconciliation, 6 risk states, 4 governance layers. Verified by code review + the audit team's re-run.
3. **Gate 3 — §23 validation program complete.** All 11 scenarios pass their targets. The §23.12 validation gates met. Published in a §24 transparency report.
4. **Gate 4 — Independent external audit clean.** Trail of Bits / OpenZeppelin / Consensys Diligence (or equivalent top-tier firm) issues a report with no unresolved Critical or High findings. We publish their report, including any disagreements.
5. **Gate 5 — Genesis + governance documented and signed off.** The 1M MTQ genesis holder is a foundation, the 7 Constitutional signers are independent, the DAO vote mechanics are live on testnet, the 4 timelocks are deployed and tested.

Until all 5 gates pass, `getHonestStatus()` returns `0x5A7` (or lower), the OnChainMatrix shows the audit findings, and the protocol remains a candidate for public testing — NOT production-authorized.

## 10. The one-sentence COO verdict

> The audit was right, the headline finding is non-negotiable, the path to mainnet is concrete and finite — fix the 4 P0 findings in the next 30 days, re-run the §23 validation program in the next 90 days, engage an independent audit firm in parallel, and do not sign off on mainnet until all 5 production-readiness gates pass. The protocol is honestly a strong pilot, and the audit is the cheapest insurance we will ever buy.

---

*End of COO Recommendations. Actions A/B/C (the honesty fixes I can take unilaterally today) are being executed in parallel with this document. The engineering P0 fixes (Recommendations 1, 3, 5, 6, 7, 8) require protocol-owner approval and CTO+engineering resource allocation.*
