# MTQΣ — TASK 13 · Issuance, Burn & Market-Mechanism Specification (deliverable 7)

**Mandate:** MTQSIGMA-COO-MANDATE-004 §8 ("Define supply operations independently"). Stage F; Gate E (per `README.md` deliverables index).
**STATUS: PROPOSED — DRAFT FOR OWNER APPROVAL (v1). Nothing in this document is chosen, implemented, or authorized.** No supply operation is authorized by this document. Candidate policies are presented per decisions **D-13.6** (supply policy), **D-13.7** (redemption/market mechanism), **D-13.8** (fees) — all OPEN; this spec never picks among them.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

Evidence-status legend (per `README.md`): `VERIFIED` (independently reproduced this session from cited source) · `DEVELOPER-REPORTED` (stated by prior in-repo work, cited) · `SIMULATED` · `PROPOSED` (design content requiring approval) · `UNVERIFIED` · `NOT IMPLEMENTED`. Every substantive claim below carries one of these statuses. Existing caps and rates in code are **cited facts about source text, not approved parameters**; every v3.0 number is confined to Annex A as an UNAPPROVED DRAFT PARAMETER.

---

## 0. Status, posture & how to read this document

- **Status:** PROPOSED v1 — a redesign proposal for owner review. It supersedes no prior design (v2.0 remains the historical baseline until an approved v3.0 change proposal exists — `README.md` header rule).
- **Decision posture:** every branch point in this spec is an OPEN decision. Where the mandate requires a definition and none can be given without an owner choice, the spec says **"not defined until D-13.x"** — it never substitutes a default.
- **Numbers discipline:** source-code constants (V3 $500K caps, 5% DMCE, 10% breaker, 0.10%/ladder fees, RR 1.30, 1.1M USDC → 1M MTQ genesis) are **cited facts about existing text** and are labeled with the generation they belong to. Every v3.0 quantity lives only in Annex A as an UNAPPROVED DRAFT PARAMETER (mandate §2 rule 8: unapproved economic parameters are research inputs, never decisions).
- **Evidence statuses:** claims about repo source were re-read from the cited files this session (VERIFIED); claims about deployment state, prior audits, and the worklog chain are DEVELOPER-REPORTED with their citation; everything this document designs is PROPOSED; anything unverifiable is UNVERIFIED; anything absent from the codebase is NOT IMPLEMENTED.

---

## 1. Purpose & scope

- **Purpose:** define the v3.0 supply operations as **distinct, non-interchangeable operations**, each with authorization, amount calculation, accounting entries, event records, replay protection, idempotency, failure recovery, reconciliation, and limits (mandate §8, all clauses). This is the redesign the mandate demands because today's operations are **conflated** (DEVELOPER-REPORTED, baseline §5 Stage F: TS `applyMint` = USDC-gated basket acquisition; V2 `mint` = permissionless-with-USDC, `MINTER_ROLE` declared-but-unenforced; V3 = bank-mediated 16-step workflow; deployed v1.2 = permissionless-with-USDC at admin-set prices; gen-A/C `genesisMint` owner-gated, exposed-key-inflatable).
- **The load-bearing problem (DEVELOPER-REPORTED, baseline §6):** issuance capacity today is computed **only** by reserve mechanics — PBC (`AvailableBacking = Recognized − Encumbered − Allocated`, `src/lib/protected-backing-cell.ts:40`, VERIFIED) → ABC (`src/lib/mtq/available-backing-certificate.ts`, custodian-attestation certificate, VERIFIED) → DMCE gate (V3 `MTQSigmaV3.sol:913-923`, VERIFIED), with `maxMtqIssuanceUsd = availableBacking / 1.30` (`protected-backing-cell.ts:740,749`, VERIFIED) — and redemption is NAV-proportional (`engine.ts:2077-2200`, V2 `:1275-1322`, VERIFIED). **Removing the conventional reserve therefore leaves BOTH issuance capacity and redemption UNDEFINED** until a replacement policy is chosen (D-13.6/D-13.7). This spec supplies the candidate replacements; it does not choose them.
- **No unstated assumptions (stub honesty rules, retained):** minting is not always payment-backed; burning does not automatically create revenue; not every burn is a redemption; a token transfer is never a supply operation.
- **Issuance security requirement (stub, baseline §5):** no unapproved minting role may be able to create unlimited supply; role separation, caps, timelocks per final design. Carried defects any descendant must fix: the declared-but-unenforced `MINTER_ROLE` in V2 (`MTQSigmaV2.sol:200` declared; `mint()` at `:1238` has **no role gate** — VERIFIED), and owner-gated `genesisMint` on gen-A/C whose key is compromised (DEVELOPER-REPORTED, baseline §3: R-1 can inflate those pots).
- **Honesty rule:** absent a reserve or an enforceable redemption facility, the interface must not promise redemption at reference value; any secondary-market mechanism gets its own liquidity/price-impact/counterparty/legal-risk model (stub; D-13.7).
- **Out of scope:** reference-index construction (deliverable 5), payment-instrument registry (deliverable 6), fee rates and recipients (deliverable 8 / D-13.8 supplies the branches), cross-chain supply model (deliverable 9 / D-13.10), oracle/emergency states (deliverable 10). Cross-referenced by decision ID only where those files are drafted in parallel.

---

## 2. The operations (mandate §8) — distinct, each with its own controls

Naming (stub scope, retained): **(2.1) primary acquisition**, **(2.2) secondary-market purchase/sale**, **(2.3) issuance** (supply increase under the approved policy), **(2.4) burn** (supply decrease under the approved policy), **(2.5) redemption/sale-back** (only if a real facility exists), **(2.6) transfer & cross-chain movement**; plus, because mandate §8 lists them as distinct clauses, **(2.7) payment settlement** and **(2.8) refunds & failed transactions**. All authorization gates below are additionally subject to the **fail-closed release-controls architecture** (`src/lib/mtq/release-controls.ts`, VERIFIED): 8 controls (`software-tests` … `production-authorization`), grants live only in an owner-authored file outside git (`RELEASE-GRANTS`, carried Task 12), currently **8/8 NOT_GRANTED** (VERIFIED, baseline §9 re-run 2026-10-22) — so nothing below is runnable in any authorized sense today. All content in §2 is **PROPOSED** unless a status says otherwise.

**Named ledgers used by the accounting entries below (PROPOSED — one consistent double-entry universe):**

| Ledger | Carries | Exists today? |
|---|---|---|
| Token ledger | holder balances + totalSupply (ERC-20 state) | Yes (VERIFIED — every token contract) |
| Burned-supply ledger | permanent record of extinguished tokens by burn type | No — today only the implicit `Transfer(→0x0)` trace (NOT IMPLEMENTED) |
| Supply-policy ledger | caps, outstanding-issued, tranche consumption, timelock state | No (capacity lives in reserve mechanics instead — DEVELOPER-REPORTED, baseline §6) |
| Payment-instrument ledger | per-instrument obligations/balances received or owed | No (V2/v1.2 move USDC directly to a vault; V3 records event-only obligations — VERIFIED) |
| Settlement ledger | rail obligations + finality state per §2.7 | No (NOT IMPLEMENTED; TS rails are SIMULATED — DEVELOPER-REPORTED) |
| Fee ledger | fee obligations per recipient | Partial: V3 `accumulatedFees` is a single counter with **no sweep/claim** (VERIFIED; baseline §8); V2/v1.2 commingle fees with collateral (T4 finding) |
| Refund/exception ledger | failed operations, refunds, aging | No (NOT IMPLEMENTED) |

A debit/credit pair below always names two of these ledgers; an operation is **only** complete when its entries balance and its events are emitted.

**Supply-impact classification (PROPOSED invariant summary — the conflation test):**

| Operation | Changes totalSupply? | Changes holder balances? | Gating decision |
|---|---|---|---|
| 2.1 Primary acquisition | only if it coincides with §2.3 issuance under the chosen policy | yes | D-13.6, D-13.8 |
| 2.2 Secondary purchase/sale | never | yes (between holders) | D-13.21, (D-13.7) |
| 2.3 Issuance | yes (+) | yes | D-13.6 |
| 2.4 Burn | yes (−) | yes | D-13.20, D-13.6 |
| 2.5 Redemption/sale-back | only via its burn leg (§2.4-ii) | yes | D-13.7, D-13.8 |
| 2.6 Transfer / cross-chain | never (per-chain ledgers only under D-13.10) | yes | D-13.10 |
| 2.7 Payment settlement | never | no (instrument ledgers) | D-13.8, deliverable 6 |
| 2.8 Refunds/failed tx | never | no (instrument ledgers) | D-13.8 |

Any implementation in which an operation violates its row (e.g., a "secondary" path that mints, or a "settlement" path that burns) is a specification failure by definition — this table is the conflation regression test written as an invariant.

### 2.1 Primary acquisition (holder obtains tokens from the authorized primary mechanism)
- **Authorization:** PROPOSED — requester passes KYC/AML-equivalent eligibility via the authorized channel (permissionless-with-instrument if D-13.6 selects a payment-gated policy; bank-mediated if the V3-family channel survives). Today's contrast, VERIFIED from source: v1.2/V2 `mint()` are permissionless (any address with USDC); V3 `requestMint` is `onlyAuthorizedBank` (`MTQSigmaV3.sol:813`). Emergency gates: pause + risk-state mint throttle (v1.2 `mintPaused`, V2 `Err25`, TS LCR<1.00 pause `engine.ts:1903-1905` — all VERIFIED).
- **Amount calculation:** **not defined until D-13.6** — the v3.0 formula depends on the chosen supply policy. Reference formulas that exist today (cited facts, not choices): V2 `minted = (usdcAmount − fee)·1e12·1e18 / P_MTQ · throttle` (`:1238-1266`); V3 `minted = amountUsd·1e18 / P_MTQ · throttle` (`:993-999`); v1.2 identical shape (`MTQSigma.sol:144-167`); TS adds the §19.7 slippage guard and MIN_MINT_MTQ=1 (VERIFIED).
- **Accounting entries (PROPOSED, double-entry):** DEBIT payment-instrument ledger (obligation received from requester) / CREDIT token ledger (holder balance increase) — with fee split per D-13.8: DEBIT payment ledger / CREDIT fee ledger. Today (VERIFIED): V2 credits `reserveVault` with the USDC and mints ERC-20 supply; V3 creates an off-chain-settled obligation and mints to the bank (`_mint(r.request.bank, minted)`, `:1031`).
- **Event records:** PROPOSED `PrimaryAcquired(requestId, requester, instrumentId, grossAmount, feeAmount, netAmount, tokenAmount, quoteId, quoteTimestamp, expiry, ledgerRefs[])`. Existing analogues (VERIFIED payload shapes): v1.2/V2 `Mint(user, usdcIn, feeUsd, mtqMinted, price)`; V3 `MintExecuted(requestId, bank, amountUsd, minted, price, ts)`.
- **Replay protection:** PROPOSED per-request nonce or idempotency key bound to (channel, requester). Existing (VERIFIED): V3 `usedNonces[bank][nonce]` consumed at `:817-818`; V1.2/V2 have **none** (any repeated mint is simply a new mint).
- **Idempotency:** PROPOSED — a retried submission with the same key returns the original outcome and must not double-credit. Existing (VERIFIED): V3 `executeMint` refuses a second execution (`Err76_WorkflowAlreadyMinted`, `:969`); nothing equivalent exists in V2/v1.2.
- **Distinguishing note:** acquisition is the **holder-side** operation; §2.3 issuance is the **supply-side** operation. One acquisition may or may not coincide with one issuance depending on the D-13.6 policy — e.g., under a fixed-supply policy (option A) post-genesis acquisitions happen only on secondary markets and NEVER create supply. Today all generations conflate the two into one `mint()` (VERIFIED).
- **Failure recovery:** PROPOSED compensation rules in §2.8; atomic revert (all-or-nothing) is the baseline (VERIFIED: V3 executeMint is single-tx atomic; V2 pulls USDC before minting — a mid-function revert returns everything).
- **Reconciliation:** PROPOSED daily + per-batch: token ledger vs payment ledger vs fee ledger vs cap counters (below). No reconciliation tooling exists today (NOT IMPLEMENTED; the only on-chain counters are V3 daily-cap and concentration counters, VERIFIED).
- **Limits:** **not defined until D-13.6**; draft caps in Annex A. Cited existing caps (facts about V3 source, VERIFIED): `MAX_MINT_PER_TX = 500_000e18` (`:356`), per-bank `dailyMintCap` (BM-12, `:903-907`), DMCE single-bank concentration 5% of supply (`dmceBankConcentrationCap = 0.05e18`, `:810`). V2/v1.2 have **no per-tx or daily mint cap** (VERIFIED absence).

### 2.2 Secondary-market purchase & sale (holder ↔ holder; no supply change)
- **Authorization:** PROPOSED — no protocol role is involved if D-13.7(a) (markets unnamed) is chosen; if D-13.7(b) or D-13.21 selects a project-facilitated venue, the venue operator needs a named role, license review, and its own risk model (liquidity/price-impact/counterparty/legal — stub requirement). Today: no project-operated market exists (NOT IMPLEMENTED; no venue code in repo).
- **Amount calculation:** PROPOSED — market-determined price between counterparties; the protocol quotes **reference value only** and must display market price and reference value as distinct quantities (deliverable 3, decision D-13.3/D-13.4, drafted in parallel). No formula exists to cite; any AMM/venue math is NOT IMPLEMENTED.
- **Accounting entries:** PROPOSED — DEBIT buyer instrument ledger / CREDIT seller instrument ledger at the venue custodian (if any); **token ledger and total supply unchanged** (invariant: secondary trades never touch supply — this distinguishes §2.2 from §2.3/§2.4).
- **Event records:** PROPOSED `SecondaryTraded(venueId|null, buyer, seller, tokenAmount, instrumentId, amount, priceExecuted, referenceValueAtTs, ts)` for facilitated venues only; for external venues nothing is claimed (honest absence).
- **Replay protection:** PROPOSED — venue order-id nonce; not the protocol's obligation for external venues.
- **Idempotency:** PROPOSED — venue-level order matching must be exactly-once; the protocol's only invariant is that token transfers (§2.6) remain exactly-once per signature (VERIFIED today: standard ERC-20 nonces/allowance).
- **Failure recovery:** PROPOSED — venue-level; protocol involvement limited to pause of transfer (§2.6) and honest disclosure that reference value ≠ executable price.
- **Reconciliation:** PROPOSED — if a venue exists: venue ledger vs token ledger transfer events; if not, no protocol reconciliation claim may be made (PROPOSED honesty rule).
- **Limits:** PROPOSED — venue-level; no protocol cap may be implied for external markets. No such caps exist today (NOT IMPLEMENTED).

### 2.3 Issuance (supply increase under the approved supply policy)
- **Authorization:** **not defined until D-13.6**, which selects among: **(A) fixed initial supply, no further issuance** (simplest; genesis-like one-shot; then this operation ceases to exist post-genesis); **(B) rule-governed elastic issuance** with published caps & timelocks (a deterministic policy computes capacity; the executor role only executes); **(C) governance-voted tranches** with timelock and per-period caps (each tranche an explicit approval). All three require the executor roles to be post-migration authorities (Task 12 D4/D5 — carried, unsigned), never the compromised deployer EOA (DEVELOPER-REPORTED, baseline §3: every current authority resolves to R-1).
- **Amount calculation:** **not defined until D-13.6.** The only capacity mechanism that exists today is reserve-dependent (DEVELOPER-REPORTED, baseline §6): `maxIssuance = availableBacking / 1.30` (PBC `:749`, VERIFIED) feeding V3's BM-05/BM-06/BM-11 gates (certificate exists, verified, and `backingVerified ≥ amountUsd` — VERIFIED `:885-892, :900-902`). **Under the no-reserve objective this mechanism is removed, so options A/B/C above must define capacity without backing.** Illustrations only: (B) `issuable_t = min(capPerPeriod, capOutstanding − issuedOutstanding_t)`; (C) `issuable_t = trancheAmount_voted`. Neither is a proposal until D-13.6.
- **Accounting entries (PROPOSED):** DEBIT supply-policy ledger (issued-outstanding increase, tranche/cap consumption) / CREDIT token ledger (recipient balance); if payment-gated, also §2.1 entries. Today (VERIFIED): V3 decrements `backingVerified[bank]`, increments `dailyMintUsed`, `bankMintedTotal`, `accumulatedFees`, and ERC-20 supply (`:1017-1047`).
- **Event records:** PROPOSED `Issued(policyId, requestId, recipient, tokenAmount, capacityBefore, capacityAfter, authorizedBy, timelockRef, ts)`. Existing (VERIFIED): V3 `MintRequested`, `WorkflowAdvanced(requestId, fromState, toState, caller, ts)` (16 steps BM-01→BM-16 + REJECTED, `:761-780`), `MintRejected(requestId, caller, reason, ts)`, `MintExecuted`; TS genesis events `GenesisVerification`/`GenesisCompleted` (`genesis.ts`).
- **Replay protection:** PROPOSED — same nonce/key discipline as §2.1, plus one-execution-per-policy-decision for (C). Existing: V3 nonce map (VERIFIED, `:804-805`).
- **Idempotency:** PROPOSED — replaying the signed authorization must not re-issue; existing V3 `Err76` guard is the analogue (VERIFIED). For option (C), a tranche authorization is consumed exactly once and its consumption is itself an event.
- **Timelock semantics (PROPOSED, all options):** any elastic or governance-voted issuance authorization carries a published timelock between authorization and execution; execution outside the window fails; cancellation during the window emits a cancellation event. No issuance timelock exists in any generation today (VERIFIED absence).
- **Failure recovery:** PROPOSED — issuance that violates a cap reverts atomically; a partially executed batch (if batched) rolls back the whole batch; see §2.8 for payment refunds.
- **Reconciliation:** PROPOSED — issued-outstanding (policy ledger) must equal ∑ recipient balances minus burned (§2.4) at every checkpoint; exceptions freeze issuance (fail-closed).
- **Limits:** **not defined until D-13.6** — draft caps/timelocks in Annex A. Cited facts (VERIFIED): V3 per-tx $500K, per-bank daily cap, DMCE 5%; 10% price-jump auto-pause circuit breaker (`_circuitBreakerCheck`, `:1290-1305`); v1.2 safety band [0.50, 2.00] (`MTQSigma.sol:60-61`).

### 2.4 Burn (supply decrease under the approved supply policy)
- **Authorization:** PROPOSED — depends on D-13.6 and on the burn taxonomy (new decision **D-13.20**): (i) **holder-initiated burn** (self-burn, extinguishes the holder's own balance, creates no claim — available today: `MTQToken.burn()` in `MtqEcosystem.sol:35-37`, VERIFIED, permissionless); (ii) **redemption burn** (§2.5 only — burn that is one leg of a settlement); (iii) **operational/policy burn** (supply-policy-driven; requires the D-13.6 executor role and timelock). Not every burn is a redemption (stub rule).
- **Amount calculation:** PROPOSED — burn amount = tokens surrendered (i); = settled redemption amount (ii); = policy formula (iii), **not defined until D-13.6**. Today only (i) and (ii) exist (VERIFIED: V2/V3 redeem burn via `_burn`; ecosystem token allows self-burn; v1.2 has no standalone burn function — VERIFIED absence).
- **Accounting entries (PROPOSED):** DEBIT token ledger (holder balance) / CREDIT burned-supply ledger (permanent extinction record); for (ii) additionally the §2.5 settlement entries; burning creates **no revenue and no fee** by itself (stub rule; fee only per D-13.8 if attached to §2.5).
- **Event records:** PROPOSED `Burned(burnType, burner|policyId, holder, tokenAmount, proofRef?, ts)` with an explicit `burnType` so (i)/(ii)/(iii) are never conflatable. Existing (VERIFIED): ERC-20 `Transfer(holder, 0x0, amount)` is the only on-chain burn trace in V2/V3/v1.2; V3 `RedeemSettlement` carries the redemption-burn leg (`:1145`).
- **Replay protection:** PROPOSED — burn operations (ii)/(iii) carry an operation id bound to the originating authorization; (i) needs none (it is a plain state change gated by balance).
- **Idempotency:** PROPOSED — a settled redemption burn must never execute twice; a policy burn must never re-execute after cancellation. Today, V3's atomicity makes double-burn structurally impossible within one tx, but there is no cross-tx operation id (VERIFIED absence).
- **Failure recovery:** PROPOSED — atomic revert; a burn whose counterpart settlement (§2.5) fails must never leave a burned-but-unpaid state: burn and settlement-obligation creation are one atomic unit, or the burn is void.
- **Reconciliation:** PROPOSED — burned-supply ledger vs `totalSupply` decrease vs (for ii) settlement ledger; daily.
- **Limits:** **not defined until D-13.6/D-13.20**; draft caps in Annex A. Cited fact (VERIFIED): V3 redemption burns are capped via `MAX_REDEEM_PER_TX = 500_000e18` gross and `dailyRedeemCap = 500_000e18` (gross, rolling 24h, `:1089-1104`); standalone burns are uncapped everywhere today.

### 2.5 Redemption / sale-back (ONLY if a real, enforceable facility exists)
- **Authorization:** **not defined until D-13.7**: **(a) none promised** — reference value only, secondary markets unnamed; the operation then does not exist and all UI/contract language must say so; or **(b) explicitly defined facility** — named operator, enforceable terms, modeled liquidity/price-impact/counterparty/legal risk, capital and legal review (cross-referenced to the economic-model decision in `mtqsigma-v3-no-reserve-economic-spec.md`, decision IDs **D-13.4/D-13.7**, drafted in parallel). What exists today (VERIFIED source; DEVELOPER-REPORTED deployment): V2 redeem = NAV-based burn + USDC payout from `reserveVault` (`:1275-1322`); V3 redeem = authorized-bank-mediated burn + `RedeemSettlement` off-chain obligation (no USDC push; `:1054-1146`); v1.2/ecosystem redeem pays from contract/vault balances at admin-set prices (`MTQSigma.sol:173-194`; `MtqEcosystem.sol:220-229`). **All are reserve/balance-dependent and die with the reserve** (DEVELOPER-REPORTED, baseline §6).
- **Amount calculation:** **not defined until D-13.7.** Cited reference formulas (facts, not choices): TS `grossUsd = mtq × NAV_t`, `NAV_t = V_net/S_circ`, release proportional to actual basket (I6, `engine.ts:2098-2204`, VERIFIED); V2 same shape on-chain; V3 same NAV math with caps. A facility under (b) must define its own basis (NAV-of-what, under no-reserve?) — that is exactly D-13.7/D-13.4 work.
- **Accounting entries (PROPOSED, only if (b)):** DEBIT token ledger (burn per §2.4-ii) / DEBIT facility asset ledger (payment out) / CREDIT redeemer settlement ledger; fee split per D-13.8.
- **Event records:** PROPOSED `Redeemed(requestId, redeemer, tokenAmount, basis, grossValue, feeAmount, netObligation, settlementDeadline, facilityId, ts)`. Existing (VERIFIED): V3 `RedeemSettlement(redeemer, bank, mtqAmount, grossUsd18, feeUsd18, netUsd, navPerToken, ts)`; V2/v1.2 `Redeem(user, mtqIn, feeUsd, usdcOut, price)`.
- **Replay protection:** PROPOSED — settlement id bound to burn transaction hash/operation id; one redemption per id.
- **Idempotency:** PROPOSED — retrying a redemption submission returns the original `Redeemed` record. Existing: none beyond V3's per-tx atomicity (VERIFIED absence).
- **Failure recovery (PROPOSED, critical under (b)):** if the facility cannot settle within its deadline, the obligation becomes a claim under the facility's enforceable terms — the protocol itself owes nothing (or the facility must be capitalized; D-13.7). Failure of the off-chain leg must be visible on-chain (unfulfilled-obligation aging report).
- **Reconciliation:** PROPOSED — burn events vs settled obligations vs unpaid/aging obligations, daily; exception = facility suspension (fail-closed).
- **Limits:** only meaningful under (b); draft caps in Annex A. Cited existing (VERIFIED): V3 $500K/tx and $500K/day gross caps; v1.2 fee-by-status ladder (15/50/200 bps); TS state machine pauses redemption in EMERGENCY while **deployed v1.2 keeps it open at 2.00%** (divergence, VERIFIED code-both; contradiction family C-INV-4).

### 2.6 Transfer & cross-chain movement
- **Authorization:** PROPOSED — standard ERC-20 holder authority; pause gate (all token contracts today implement pause or `_update` gating — VERIFIED: ecosystem `_update` blocks when paused; V2/V3 `whenNotPaused`). Cross-chain movement additionally requires the **cross-chain supply model (D-13.10)** — none exists today (NOT IMPLEMENTED; three independent testnet deployments + one Solana SPL mint, no bridge/lock-and-mint code — DEVELOPER-REPORTED, baseline §3/§5 Stage H). No "own blockchain" claims are made anywhere (none exist — DEVELOPER-REPORTED).
- **Amount calculation:** exact amount moved, minus any transfer fee — **no transfer fee exists anywhere today** (VERIFIED absence; baseline §8) and adding one is D-13.8-gated.
- **Accounting entries:** DEBIT token ledger (sender) / CREDIT token ledger (receiver); supply unchanged. Cross-chain (PROPOSED, model-dependent): debit origin-chain supply / credit destination-chain supply with a canonical total-supply invariant per D-13.10.
- **Event records:** ERC-20 `Transfer(from, to, value)` (VERIFIED everywhere); cross-chain model events PROPOSED and deferred to deliverable 9.
- **Replay protection:** intra-chain transfers need none beyond ERC-20 semantics (VERIFIED). Cross-chain replay protection exists only under D-13.10 (PROPOSED nonce/chain-id binding; NOT IMPLEMENTED today).
- **Idempotency:** intra-chain transfers are naturally balance-safe (VERIFIED); bridge retries deferred to D-13.10.
- **Failure recovery:** atomic revert; a failed cross-chain message must not strand tokens (deliverable 9 scope).
- **Reconciliation:** PROPOSED — per-chain supply vs canonical record per D-13.10; **cannot be defined before that decision**. Today each chain's supply is independent and one Solana mint is u64-max at 18 decimals (DEVELOPER-REPORTED, baseline §3) — cross-chain supply reconciliation does not exist (NOT IMPLEMENTED).
- **Limits:** none today beyond pause (VERIFIED); PROPOSED per-chain caps only under D-13.10.

### 2.7 Payment settlement (mandate §8 clause)
- **Authorization:** PROPOSED — settlement operators (bank, payment processor) must be separately named from issuance executors; today V3 collapses bank + settlement into the authorized-bank role (VERIFIED `:1064-1065`) — role separation is a v3.0 requirement.
- **Amount calculation:** PROPOSED — net obligation per §2.1/§2.5 after D-13.8 fees. Cited facts (VERIFIED): V3 mint fee = obligation on top (`accumulatedFees += amountUsd·mintFee/1e18`, does NOT reduce minted tokens, `:1042-1048`); V2/v1.2 mint fee = deducted from payment before computing tokens (`:1252-1257` / `:153-157`) — **the two generations differ; v3.0 must normalize this under D-13.8** (inconsistency, see final report).
- **Accounting entries (PROPOSED):** DEBIT requester instrument ledger / CREDIT settlement ledger → on finality CREDIT recipient instrument ledger; fees → fee ledger per D-13.8 recipient policy. Today (VERIFIED): V3 records obligations via events only (no ledger contract); V2/v1.2 move USDC directly to vault.
- **Event records:** PROPOSED `SettlementInitiated`, `SettlementFinalized(settlementId, railsRef, finalityLayerRef, ts)`, `SettlementFailed(settlementId, reasonCode, ts)` with the 7-layer finality model (`finality-before-mint.ts`, whose L3 is reserve-sufficiency — reserve-dependent, DEVELOPER-REPORTED baseline §6, and therefore itself a v3.0 redesign input).
- **Replay protection:** PROPOSED settlementId nonce per rail (rail-assigned sequence or hash of the obligation id + rail id).
- **Idempotency:** PROPOSED — the same obligation settled twice must be rejected by the settlement ledger (structural exactly-once), because V3's event-only obligations today could theoretically be honored twice off-chain with no on-chain contradiction (VERIFIED absence of any double-settlement guard).
- **Failure recovery:** PROPOSED — unsettled-after-deadline obligations route to §2.8 refund/compensation; ledger holds the obligation until resolved.
- **Reconciliation:** PROPOSED — rail statements vs settlement ledger vs obligation events, per finality batch and daily.
- **Limits:** PROPOSED per-rail and per-operator exposure caps (Annex A); none exist today (NOT IMPLEMENTED).

### 2.8 Refunds & failed transactions (mandate §8 clause)
- **Authorization:** PROPOSED — compensation officer/role (timelocked, post-migration authority) or deterministic auto-refund; never ad-hoc by a single EOA.
- **Amount calculation:** PROPOSED — refund = original obligation (gross), or net-of-fee if the fee schedule defines failed-transaction fees (D-13.8 must state this; today no fee rule for failures exists — VERIFIED absence).
- **Accounting entries:** reversal entries: DEBIT refund ledger / CREDIT requester instrument ledger; any fee reversal posts against the fee ledger.
- **Event records:** PROPOSED `Refunded(requestId, amount, instrumentId, railRef, reasonCode, ts)`; existing analogue: V3 `MintRejected(requestId, caller, reason, ts)` (VERIFIED) — but **no on-chain refund path exists anywhere** (V3 rejected requests simply end; the USDC never moved on-chain — VERIFIED; V2/v1.2 failures revert atomically).
- **Replay protection:** PROPOSED — refund id derived from the original operation id; a refund cannot itself be replayed.
- **Idempotency:** PROPOSED — one refund per requestId; duplicate refund requests return the original refund record.
- **Failure recovery:** the refund operation itself needs one — PROPOSED aging + escalation to the compensation authority; unresolved refunds surface in reconciliation exceptions.
- **Reconciliation:** PROPOSED — failed/refunded count vs exceptions ledger, daily; refund backlog above threshold ⇒ issuance/redeem suspension (fail-closed).
- **Limits:** PROPOSED refund backlog cap and per-day compensation budget (Annex A). None exist today (NOT IMPLEMENTED).

---

## 3. Issuance priced from a reference value — policy block (mandate §8, final clauses)

> **Mandate §8 (verbatim):** "If primary issuance is calculated from a reference price, define the exact quote currency, valuation timestamp, rounding, fees, quote expiry, and authorization policy. An illustrative calculation such as `net payment value / reference price = token quantity` is not sufficient to define an issuance policy. It does not establish that the resulting token can later be sold or redeemed at that reference price."

Everything in §3 is **PROPOSED** and gated on D-13.6 (and D-13.7 for the warning below). This block defines the **shape** of the policy; the **values** are Annex A draft parameters.

1. **Exact quote currency:** PROPOSED — a single named quote currency (candidate: USD as numeraire, consistent with the existing `P_MTQ = I_t` USD-denominated convention, VERIFIED `mandate.ts` PAR=1.00 / non-USD-peg); **final choice belongs to the economic spec (D-13.3/D-13.4/D-13.5, deliverable 3, drafted in parallel)** — issuance quotes must use the same numeraire the index publishes, or conversion rules must be defined in the payment-instrument registry (deliverable 6).
2. **Valuation timestamp rule:** PROPOSED — the quote uses the **published index value at a named publication timestamp** (the index's own publication record, e.g. "index value at the latest publication no older than the staleness bound"), never a spot feed at execution time; the executed transaction must record `quoteTimestamp` in its event; a stale quote (older than the freshness bound) is rejected fail-closed. Existing analogues (cited facts, VERIFIED): oracle staleness 60s classes in contracts/TS; §19.7 five-minute trade deadline in `engine.ts` (`quoteExpiresAt`); V3 `expiry` field per request (`:816, :867, :973`).
3. **Rounding direction:** PROPOSED — **conservative rounding against the requester at every step**: token quantity rounded **down** to the token's smallest unit on issuance; payment/obligation values rounded **up** for what the requester pays and **down** for what the requester receives; fee computed on gross with the rounding order: fee → net → quantity. Rounding mode and decimal scale must be named per instrument (MockUSDC 6 decimals vs MTQ 18 decimals today — VERIFIED `MtqEcosystem.sol:283`, `MTQSigma.sol:35`). Existing code truncates via integer division (VERIFIED) but never states a rounding **policy**; drift between 6-dec and 18-dec scales is untested (NOT IMPLEMENTED).
4. **Fee application order:** PROPOSED — (i) validate quote (§3.2), (ii) compute gross, (iii) apply fee per D-13.8 to determine net, (iv) compute quantity from net, (v) round per §3.3, (vi) post entries per §2.1/§2.3. The V2-style (fee-from-payment) vs V3-style (fee-as-side-obligation) divergence (§2.7) must be normalized here once D-13.8 decides rates, basis, and whether the fee reduces the minted quantity.
5. **Quote expiry (validity window):** PROPOSED — every quote carries `issuedAt` and `expiresAt`; execution after expiry is rejected and the requester is refunded per §2.8 (nothing is captured from an expired quote). Cited existing windows (facts, VERIFIED): TS §19.7 = 5 minutes; V3 request `expiry` = caller-chosen; v1.2/V2 = none. v3.0 window value: Annex A draft.
6. **Authorization policy for quotes:** PROPOSED — quotes are derived from the published index (deliverable 5) by a named oracle/quote role under the fail-closed oracle rules (deliverable 10, drafted in parallel), committed with the publication timestamp and a verifiable hash; the issuance executor may not manufacture quotes. Quote publication and issuance execution must be role-separated (stub: no unapproved minting role can create unlimited supply).
7. **The mandated warning (verbatim in substance):** the illustrative formula `net payment value / reference price = token quantity` **is not sufficient to define an issuance policy** and **does not establish that the resulting token can later be sold or redeemed at that reference price**. Under the no-conventional-reserve objective there may be **NO redemption at all** — whether any exit exists is decision **D-13.7** (option (a): none promised, reference value only; option (b): a specified facility). Issuance at a reference price therefore creates a token whose exit path is **not implied by the issuance price**; the acquisition interface (§2.1) must display this fact verbatim-equivalent at the point of acquisition. Any claim that the token "can be redeemed at reference value" is forbidden absent an approved D-13.7(b) facility (stub honesty rule; baseline Stage B row: interface must not promise redemption at reference value).
8. **Worked illustration (PROPOSED, illustrative only — it is exactly the kind of example the mandate warns is NOT a policy):** suppose the published index at timestamp T quotes 1.0123 USD per MTQ (reference value, USD numeraire), fee F per D-13.8, quote validity V per Annex A, and a requester tenders 10,000.00 units of a registered 6-decimal USD instrument. Then: gross = 10,000.00; fee = gross·F; net = gross − fee; tokenAmount = floor(net·10^18 / (1.0123·10^18)); quote binds only for `T ≤ execTime < T + V`; on expiry the operation reverts and the tender is refunded per §2.8; every value (F, V) and the quote authority itself await §9 approvals. **This example defines nothing about what the token is later worth** — that is the §3.7 warning, and under D-13.7(a) the honest answer is "no protocol exit exists; reference value is a measurement, not a bid."

---

## 4. Existing implementation vs v3.0, per operation

**Honest framing (DEVELOPER-REPORTED, baseline §2/§3):** the only deployed estate is the **v1.2 five-currency pilot + ecosystem modules** on Monad (10143), Arc (5042002), RH testnets plus one Solana SPL mint; **V2 and V3 are SOURCE-READY, NOT DEPLOYED**; deployed ecosystem bytecode ≠ repo source; address-book validation ok=false; every deployed authority resolves to the compromised R-1 EOA. **Deployed modules cannot perform blueprint roles per prior audits** (admin-set prices/NAV, pilot-pattern code, 34/34 owner-table match but source identity UNVERIFIED for all 18 deployed contracts) — DEVELOPER-REPORTED, baseline §3; mainnet-audit verdict NOT mainnet-ready (2026-09-15). Nothing below is an approval of any generation.

| Operation | v1.2 deployed pilot (MTQSigma.sol) | Ecosystem modules (deployed) | V2 (source-ready) | V3 (source-ready) | TS reference layer | v3.0 target |
|---|---|---|---|---|---|---|
| Primary acquisition (§2.1) | Permissionless-with-USDC at GFB price, owner-set FX (VERIFIED `:144-167, :235-243`) | `MintContract.mint` at admin-set `mtqPriceUsd`, fee 10 bps, USDC held in module (VERIFIED `:196-205`) | Same shape, oracle-gated, fee from payment (VERIFIED `:1238-1266`) | Bank-mediated only; corporate customer settles off-chain (VERIFIED) | USDC-gated basket acquisition, LCR<1.00 paused, 5-min quote, minOut (VERIFIED `:1868-1924`) | Undefined until D-13.6; §2.1 gates |
| Secondary market (§2.2) | None (VERIFIED absence) | None | None | None | None | External-only or venue decision D-13.21 |
| Issuance (§2.3) | `genesisMint` one-shot, owner-gated (VERIFIED `:260-264`); no supply cap | `MTQToken.mint` MINTER_ROLE-gated; roles → deployer (VERIFIED `:31-33`) | `MINTER_ROLE` **declared-not-enforced**; no cap (VERIFIED `:200` vs `:1238`) | 16-step BM workflow; executeMint onlyKeeper; caps $500K/tx, per-bank daily, DMCE 5% (VERIFIED) | Capacity via PBC→ABC, `availableBacking/1.30` (VERIFIED) | Undefined until D-13.6 |
| Burn (§2.4) | No standalone burn (VERIFIED absence) | Self-burn permissionless; **Redeem contract does NOT burn — it escrows MTQ to itself** despite its header comment (VERIFIED `:220-229`) | Burn only inside redeem (VERIFIED) | Burn only inside bank-mediated redeem (VERIFIED `:1106`) | n/a | Taxonomy D-13.20 |
| Redemption (§2.5) | USDC from vault at GFB price, fee ladder 15/50/200 bps, **open in EMERGENCY** (VERIFIED `:173-194`) | USDC from module balance at admin price, 15 bps (VERIFIED) | NAV-based burn + USDC from vault (VERIFIED `:1275-1322`) | Burn + `RedeemSettlement` off-chain obligation; $500K/tx + $500K/day gross caps (VERIFIED) | NAV-proportional I6, EMERGENCY paused (VERIFIED `:2098-2204`) | Undefined until D-13.7 |
| Settlement (§2.7) | Direct vault transfer (VERIFIED) | Direct module transfer | Direct vault transfer | Off-chain obligation events; fee = obligation, **no sweep function** (VERIFIED; baseline §8) | SIMULATED bank rails (DEVELOPER-REPORTED) | §2.7 design |
| Refunds (§2.8) | Atomic revert only (VERIFIED) | Atomic revert only | Atomic revert only | Reject-event only, no refund path (VERIFIED) | Revert-only | §2.8 design |

Genesis note (both a cited fact and a warning): the genesis model 1.1M USDC → 1M MTQ → Safe, RR 1.10 (`genesis.ts:37-39`, VERIFIED) is **DISPROVEN on-chain** — deployed supplies 310.949 (Monad) / 1,000 (Arc), Safe holds 0 (DEVELOPER-REPORTED, baseline §3/§4) — so no v3.0 genesis story may cite the pilot as evidence.

**The V3 16-step mint workflow as it exists in source (VERIFIED, `MTQSigmaV3.sol:740-758`) — cited because §2.3 builds on or replaces it:**

1. BM-01 PENDING — bank submits `requestMint` (nonce consumed here; per-bank daily-cap precheck).
2. BM-02 RECEIVED · BM-03 KYC · BM-04 AML — keeper attests off-channel checks.
3. BM-05 BACKING · BM-06 EVIDENCE — ABC exists, then verified + attestation unexpired.
4. BM-07 REQUESTED · BM-08 TRANSLATED — gateway translation/payload validation.
5. BM-09 ELIGIBLE · BM-10 JURISDICTION — bank authorized; jurisdiction match.
6. BM-11 BACKING_VERIFIED — `backingVerified ≥ amountUsd` (**reserve-dependent**).
7. BM-12 BANK_RISK — per-bank daily cap. BM-13 SYSTEM_RISK — risk state + oracle health. BM-14 DMCE — daily-cap/concentration (5%).
8. BM-15 AUTHORIZED — `MONETARY_CONTROL_ROLE` signer (L4). BM-16 MINTED — `executeMint` keeper-only atomic write (L5–L7: ledger gate, atomicity, keeper finality); REJECTED is the terminal failure state.

**Observations that shape §2 (VERIFIED from the same source):** steps BM-02..BM-14 are keeper-attested with only light on-chain re-verification — the workflow's real control is *who holds the keeper and monetary-control roles*, which today is the compromised deployer path (DEVELOPER-REPORTED, baseline §3); and every backing-dependent step (BM-05/06/11, and the DMCE capacity canon `availableBacking/1.30`, PBC `:749` VERIFIED) is exactly what the no-reserve objective deletes — so a v3.0 inheriting this workflow inherits six undefined gates, not a working one.

**Fee flows, per generation (VERIFIED, baseline §8 + source reads):** v1.2/ecosystem — fees stay inside the vault/module with collateral (commingled, T4 finding); V2 — fees commingled in `reserveVault`; V3 — fee is an `accumulatedFees` **obligation** to `feeWallet` with **no sweep/claim function anywhere**; TS — treasury sweep constants exist with **no sweep execution code**. A v3.0 fee ledger (§2 table) is therefore a new component, not a refactor.

---

## 5. Breaking changes & migration implications

1. **Any new supply policy almost certainly requires NEW contracts, not upgrades** (PROPOSED): caps, timelocks, burn taxonomy, and role separation are structural; V2/V3 hard-code shapes (e.g., V3's bank-registry workflow; V2's `bytes3[7]` basket) and none implements a configurable supply policy. Upgrade paths (proxy patterns) are not present in the deployed estate (DEVELOPER-REPORTED, baseline §3).
2. **Deployed v1.2 pilot needs an explicit decommission/migration decision** (PROPOSED): it is a live, divergent, uncapped, permissionless-with-USDC pilot under a compromised key; continuing it alongside a v3.0 policy would perpetuate the exact conflations this spec forbids. The disposition interacts with D-13.4 (family selection), D-13.10 (cross-chain model), and the carried Task 12 D4/D5/D8 authority-migration chain (all UNSIGNED — DEVELOPER-REPORTED).
3. **Reserve removal breaks §2.1/§2.3/§2.5 as currently coded** (DEVELOPER-REPORTED, baseline §6): capacity (PBC/ABC/DMCE), pricing (NAV-based), the V3 BM-05/06/11 backing gates, and the `finality-before-mint` L3 reserve-sufficiency layer all assume backing. A v3.0 keeps either an honest replacement or deletes the operation — never a silent placeholder.
4. **Carried defects block any descendant** (DEVELOPER-REPORTED/VERIFIED): MINTER_ROLE unenforced (V2), fee commingling (V2/v1.2 → vault, T4 finding), no fee sweep (V3), no absolute fee cap/exemptions (all), EMERGENCY redemption divergence (v1.2 open vs TS paused), ecosystem Redeem non-burn escrow.
5. **The Solana estate is a supply-operations liability** (DEVELOPER-REPORTED, baseline §3): the current SPL mint is u64-max supply at 18 decimals (mandated 1M physically unrepresentable at that scale) with a funded, drainable legacy authority (C-045-b/R-2); any §2.3/§2.4 policy that speaks of "total supply" must either exclude Solana by decision (D-13.10) or inherit its disposition (carried SOL-DEC-1 S-1..S-4, DEC-3/ECON-DEC-3). No supply statement in this spec applies to Solana until those carried decisions resolve.
6. **Data-continuity implication (PROPOSED):** operation history is currently event-log-only; a v3.0 reconciliation regime (§2.1–§2.8) requires a new ledger index built from — not inherited by assumption from — V3-style events, and the deployed v1.2 event history cannot be re-interpreted into v3.0 ledgers because its semantics (admin-set prices, commingled fees) differ.

---

## 6. Tests required (Stage K — planned, NOT run; none of these exist yet: NOT IMPLEMENTED)

1. **Issuance authorization:** each D-13.6 option — executor role separation; unauthorized executor rejected; timelock elapsibility; per-tranche/per-period cap enforcement; fixed-supply option proves issuance impossible post-genesis (negative test).
2. **Burn authorization & taxonomy:** self-burn ≠ redemption (event `burnType` asserted); redemption burn without settlement reverts; policy burn requires the D-13.6 authorization and respects caps.
3. **Fee-recipient accounting:** fee posts to the D-13.8 recipient ledger only; no commingling (regression against T4); fee-order per §3.4; V2-style vs V3-style fee semantics normalized once and asserted.
4. **Quote expiry / rounding / refunds:** expired quote rejected; conservative rounding asserted at 6-dec↔18-dec boundaries (both directions, no drift over N operations); refund path exercised for every §2.8 failure class; rounding drift regression over 10⁶ simulated operations (SIMULATED class when run).
5. **Replay & idempotency:** nonce reuse rejected; same-key retry returns original outcome; cross-operation replay (issuance key replayed as redemption) rejected.
6. **Reconciliation:** supply identity (policy ledger = balances − burned) at every checkpoint; exception triggers fail-closed suspension; settlement ledger vs rail statements; refund backlog threshold.
7. **Emergency-cap integrity:** per-tx/daily/outstanding caps cannot be bypassed by splitting, batching, or multi-channel submission; emergency pause holds under each D-13.6 option.
8. **Honesty surfaces:** UI/event language tests — no redemption promise when D-13.7(a) is chosen; reference-vs-market price displayed as distinct quantities.
All suites are **planned evidence only**; environmental limits (no Foundry in sandbox) will be recorded as UNVERIFIED per working rule 3 (no gate advanced by tests).

**Planned evidence classes per family (so results land in the right legend bucket):** 6.1–6.3, 6.5–6.8 → unit/integration tests against repo source (VERIFIED class when they pass against source; deployed-contract variants stay UNVERIFIED absent fresh anchors); 6.4 rounding-drift and any volume simulation → SIMULATED (synthetic data, labeled); anything touching deployed bytecode or on-chain history → UNVERIFIED until a fresh read-only probe is run and hashed; no family may ever be recorded as PASS against the deployed estate while the 18 source identities remain UNVERIFIED (baseline §3).

---

## 7. Risks (PROPOSED analysis)

- **Over-issuance:** any executor role that can mint beyond published capacity — mitigated only by D-13.6 caps + timelocks + reconciliation; today's analogues (uncapped V2/v1.2 mints, R-1-inflatable genesisMint) are live demonstrations of the failure class (VERIFIED/DEVELOPER-REPORTED).
- **Emergency-cap bypass:** splitting large requests under per-tx caps; daily windows rolled by clock manipulation; timelock shortened under duress. Requires outstanding-cap invariant + reconciliation freeze (§2.3).
- **Rounding drift:** 6-dec/18-dec conversions and integer division accumulate requester-favorable or protocol-favorable dust; unbounded over volume; needs §3.3 policy + drift test 6.4.
- **Authorization confusion between operations:** the historical conflation (acquisition called "mint", burns implied by redemptions) can smuggle an unauthorized supply change through a "payment" path — the `burnType`/`policyId`-typed events and per-operation gates exist precisely to make this structurally detectable.
- **False redemption expectation:** pricing issuance from a reference value invites holders to read it as an exit price — the §3.7 warning must be enforced at the interface level or the project makes an implicit promise it cannot keep (D-13.7a case).
- **Settlement orphaning:** V3-style off-chain obligations without an on-chain aging/refund path can strand holders (VERIFIED absence of refund path).
- **Compromised-authority carry:** until Task 12 D4/D5/D8 execute, every "authorized role" in any deployed or ready system resolves to R-1 (DEVELOPER-REPORTED, baseline §3) — any pilot of these mechanisms before migration is unauthorized and unsafe.

---

## 8. Acceptance criteria (for a future owner gate — NOT met today)

1. Owner has selected D-13.6 option, D-13.7 option, D-13.8 schedule, D-13.20 taxonomy, D-13.21 posture (§9), and this spec is revised from branches to a single approved policy.
2. Every §2 operation has a specification with all nine mandated fields filled by approved content (no "not defined until D-13.x" placeholders remaining).
3. §3 policy block has named quote currency, publication-timestamp rule, rounding order, fee order, expiry window, and quote authorization — all values moved from Annex A to an approved-parameters record.
4. Stage K families §6.1–6.8 exist and pass in their designated evidence classes; environmental gaps recorded UNVERIFIED, never PASS.
5. Release-controls posture: the relevant control grants exist in the owner authorization file (outside git); on-chain authorities resolve to post-migration signers (Task 12 chain complete).
6. Interface honesty audit passes: no redemption-at-reference-value language anywhere while D-13.7(a) holds.

---

## 9. Owner approvals required (all OPEN — checkboxes unchecked)

- [ ] **D-13.6** — supply policy under no-conventional-reserve: (A) fixed initial supply, no further issuance / (B) rule-governed elastic issuance, published caps & timelocks / (C) governance-voted tranches, timelock + per-period caps; plus who may issue under what caps/timelocks. *Approver: Owner + Economic Authority. Gates B/E.*
- [ ] **D-13.7** — redemption/market mechanism: (a) none promised — reference value only, secondary markets unnamed / (b) explicitly defined facility with modeled liquidity/price-impact/counterparty/legal risk. *Approver: Owner. Gates B/E.* (Cross-ref: deliverable 3 `mtqsigma-v3-no-reserve-economic-spec.md`, decisions D-13.4/D-13.7 — drafted in parallel.)
- [ ] **D-13.8** — fee schedule: mint/redeem/secondary/service fees, basis, asset, recipients, treasury authority, exemptions, absolute caps, change governance; normalizes the V2-vs-V3 fee-semantics divergence (§2.7). *Approver: Owner + Economic Authority. Gate E.* (Cross-ref: deliverable 8, drafted in parallel.)
- [ ] **D-13.20 (new, opened by this spec)** — burn taxonomy & authorization: what a burn extinguishes; whether self-burn, redemption burn, and policy burn share or separate events/roles; whether burned supply can ever be re-issued; per-operation burn caps. Required because D-13.6/D-13.7/D-13.8 do not cover burn semantics and the stub forbids assuming "every burn is a redemption".
- [ ] **D-13.21 (new, opened by this spec)** — secondary-market posture: external markets only (protocol provides no venue, no facilitation, no quotes-as-prices) vs a project-facilitated venue with its own liquidity/price-impact/counterparty/legal-risk model and license review. Distinct from D-13.7 (which governs the issuer-side exit facility, not third-party trading posture).
- Carried and interacting (unchanged, not re-opened here): D-13.4 (family selection), D-13.10 (cross-chain supply model — gates §2.6), D-13.1 (upload key disposition — the worktree secret gate stays red until it resolves), Task 12 OWNER-ATT-1/T12-1/T12-3…CKPT-7/D8 chain and RELEASE-GRANTS (no §2 operation may be piloted before authority migration).

---

## 10. Assumptions & unresolved questions

- Assumption (PROPOSED, unconfirmed): a v3.0 keeps an ERC-20-style token on existing testnets; if D-13.10 changes that, §2.6/§4 must be rewritten.
- Unresolved: which numeraire the index publishes (D-13.5/D-13.4) — §3.1 cannot be finalized without it.
- Unresolved: whether the V3 bank-mediated channel survives at all under a no-reserve model (its BM-05..BM-11 backing gates are reserve-dependent — DEVELOPER-REPORTED, baseline §6); D-13.6 may retire the whole workflow.
- Unresolved: the fee-on-failure question (§2.8) and the V2-vs-V3 fee-order normalization both sit with D-13.8.
- Open question (VERIFIED code, unresolved policy): V3 `executeMint` consumes the nonce at request time; a rejected request permanently burns that nonce — acceptable anti-replay behavior, but the UX contract should be owner-acknowledged.
- Open question: whether genesis (under any D-13.6 option) is re-executed for a v3.0 or only the deployed-pilot disposition (D-13.4) decides — the current genesis story is disproven on-chain (§4 note).
- Open question (VERIFIED absence, unresolved design): V3 `redeem` exposes **no minimum-out parameter** (unlike `executeMint`'s `minMinted`) — a v3.0 redemption, if D-13.7(b) creates one, must add a `minNetObligation` or equivalent binding promise at burn time.
- Open question: whether §2.7 settlement operators must be drawn from the payment-instrument registry (deliverable 6, drafted in parallel) or a separate operator registry — currently unspecified either way.
- Open question: the request-id collision surface — V3 derives `requestId` from a hash including `block.timestamp` (`:830-838`), so an identical bank request re-submitted in a different second yields a *different* id with the nonce map as the only replay guard; the v3.0 id scheme should make operation ids deterministic in the operation content (PROPOSED) so reconciliation can key on them.

## 11. What has NOT been tested / implemented (honest status)

- Nothing in §2/§3 exists as v3.0 code: **NOT IMPLEMENTED** (all PROPOSED).
- No reconciliation tooling, no refund/compensation path, no quote-commitment oracle role, no secondary-market venue code (NOT IMPLEMENTED).
- Foundry suites for V2/V3 are UNVERIFIABLE in this sandbox (no forge — DEVELOPER-REPORTED, baseline §9); no test below has run.
- All 18 deployed contract source identities UNVERIFIED; deployed module role cells E-15/E-16 unprobed; the Redeem-module MINTER grant origin is an open governance question (DEVELOPER-REPORTED, baseline §3) — every §4 "deployed" claim inherits this caveat.
- Cross-chain anything (bridges, lock-and-mint, supply reconciliation) does not exist (NOT IMPLEMENTED; D-13.10).

---

## Annex A — UNAPPROVED DRAFT PARAMETERS (placeholders/ranges only; never presented as decided; values await §9 approvals)

| Symbol | Meaning (owning section) | Draft value / range | Depends on |
|---|---|---|---|
| `ISS-PERTX-CAP` | max issuance per transaction (§2.3) | TBD — illustrative range for study only: $50K–$500K (the V3 $500K is a cited V3-source fact, not a v3.0 decision) | D-13.6 |
| `ISS-DAILY-CAP` | max issuance per rolling 24h, per channel and global | TBD | D-13.6 |
| `ISS-OUTSTANDING-CAP` | published outstanding-issuance ceiling | TBD (option B/C only) | D-13.6 |
| `ISS-TIMELOCK` | notice/execution delay on issuance authorizations | TBD — e.g., 24h–7d study range | D-13.6 |
| `BURN-PERTX-CAP` / `BURN-DAILY-CAP` | caps per burn type (§2.4) | TBD | D-13.6, D-13.20 |
| `REDEEM-*-CAP` | per-tx / daily / facility-backstop caps (§2.5) | TBD — exists only if D-13.7(b) | D-13.7 |
| `QUOTE-VALIDITY` | quote validity window (§3.5) | TBD — existing cited facts: 5 min (TS §19.7), caller-chosen (V3), none (V2/v1.2) | D-13.6 (+ deliverable 10 staleness bounds) |
| `FEE-*` / `FEE-RECIPIENT` / `FEE-CAP-ABS` | rates, basis, recipient ledger, absolute cap, exemptions (§2.1/§2.7/§3.4) | TBD — all current rates (0.10% mint; redeem ladders; 0.20% rebalance) are UNAPPROVED parameters | D-13.8 |
| `REFUND-BACKLOG-CAP` | unresolved-refund threshold triggering suspension (§2.8) | TBD | D-13.6/D-13.8 |
| `SETTLE-DEADLINE` | settlement finality deadline before §2.8 escalation (§2.7) | TBD | D-13.7 (facility), deliverable 6 |

---

**Posture (bottom, per standing rule): TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. This document is a PROPOSAL: it authorizes nothing, implements nothing, and chooses nothing. Production authorization: FALSE.**
