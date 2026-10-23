# MTQΣ — TASK 13 · ECONOMIC MODEL OPTIONS — STAGE B DECISION PAPER (Task ID 13-c1)

**File:** `audit-work/task13/economic-model-options.md` — required by MTQSIGMA-COO-MANDATE-004 §5; input to Gate B of MTQSIGMA-COO-MANDATE-003 (v3.0, Stage B). Sibling to deliverable 3 (`mtqsigma-v3-no-reserve-economic-spec.md`), which will encode the family the owner selects — never silently. Date: 2026-10-22.

**STATUS: PROPOSED (v1) — DECISION PAPER; NO MODEL SELECTED.** All design content is `PROPOSED`. Nothing in this document selects, approves, implements, or advances any model, parameter, or gate (standing rule: documentation, typecheck, lint, and tests never advance gates — Task 10 D8 / Task 11 D9 / Task 12 D10).

**Evidence-status legend** (per `audit-work/task13/README.md`): `VERIFIED` (independently reproduced, cited) · `DEVELOPER-REPORTED` (stated by prior in-repo work, cited) · `SIMULATED` · `PROPOSED` · `UNVERIFIED` · `NOT IMPLEMENTED`. Every factual claim below about current code/deployments is `DEVELOPER-REPORTED` from Task 10/11/12/13-Stage-A artifacts; all model content is `PROPOSED`.

**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

Forbidden-claim compliance: this paper makes **no** claim of guaranteed market-price stability, guaranteed redemption, full backing, audited security, regulatory approval, or commercial readiness. Model 1 is **not a stablecoin** and no index formula stabilizes any market price (§5 preamble). The final model is **not** selected here; §11 is the owner's decision surface.

---

## 1. Purpose & scope

- **Purpose.** COO-MANDATE-004 §5 requires an explicit economic decision paper comparing viable economic models against the owner's stated objective: an independently determined, adaptive currency-and-gold reference basket with **no conventional reserve**, a separately governed payment-acceptance layer, and a published reference-index methodology that is **not** a promise about the token's market price (owner steer, recorded as `PROPOSED` input, unapproved). This paper informs Gate B decisions D-13.3…D-13.7 without closing them.
- **Scope.** Decision support only: mandated model comparison, ten dimensions per model, trade-offs, an advisory recommendation, owner-approval fields. No parameter is selected — all fee rates, RR values, basket sizes, caps, and tolerances remain unapproved economic parameters; any figure not already established in prior audit artifacts is deliberately absent (§12).
- **Replacement-program rule.** v3.0 is a replacement program: reserve variables may not merely be renamed, and collateral checks may not be deleted without defining the resulting economic and legal model. Each model below therefore states what is deleted, what replaces it, and what the removal honestly takes away (D10 per model).
- **Out of scope.** Any on-chain action, any migration execution, any legal conclusion, any commercial claim. The deployed estate is not modified by this paper.
- **Sources.** `baseline-and-change-matrix.md` (esp. §2, §3, §5 Stage B, §6, §11, §12); `unresolved-decisions-and-owner-approvals.md` (§A); `claims-and-honest-status.md` (§B prohibitions); `mtqsigma-v3-no-reserve-economic-spec.md` (scope of the companion deliverable); worklog Task 12 + Task 13 Stage A agents (13-a1/a2/a3, 13-b). MITHQAL v25.3.1 remains binary-only in-repo (baseline §1) — nothing is quoted verbatim from it.

## 2. The decision being asked (Gate B — economic semantics)

| Decision | Question (register `unresolved-decisions-and-owner-approvals.md` §A) | How this paper feeds it |
|---|---|---|
| **D-13.3** | What MTQΣ **is**: (a) basket-referenced digital asset / (b) purchasing-power reference unit / (c) algorithmically managed monetary token / (d) hybrid, each property separately defined | §5–§8 map each model onto (a)–(d); per-option consequences in §11 |
| **D-13.4** | Which economic family survives as the v3.0 baseline: v1.0/v2.0 (7-ccy, RR 1.10) / MITHQAL v25.3.1 (11-ccy, RR 1.30, 80/18/2) / deployed v1.2 5-ccy pilot / clean-slate | §4 facts + per-model D10 (what breaks); contradiction register C-INV-1…4 |
| **D-13.5** | Stability objective: USD / basket / global purchasing-power / other defined objective | Each model changes what "stability" can honestly mean (per-model D4) |
| **D-13.6** | Supply policy under no-reserve + who may issue, under what caps/timelocks | Per-model D3; issuance capacity today exists ONLY as PBC→ABC→DMCE (§4 fact 4) |
| **D-13.7** | Redemption/market mechanism: (a) none promised / (b) specified facility with modeled liquidity/price-impact/counterparty/legal risk | Model 1/4 ≈ (a); Model 3 = (b); Model 2 = contractual middle case |

Interacting OPEN decisions not decided here: **D-13.1** (uploaded key file disposition), **D-13.8** (fees), **D-13.10** (cross-chain supply), **D-13.11** (basket max size), **D-13.12** (gold disposition) — plus the Task 12 D8 authority chain and RELEASE-GRANTS, which gate ALL on-chain work under every option.

- **Sequencing note.** D-13.4 (family) and D-13.7 (redemption axis) jointly determine which model the program lands in; D-13.3/D-13.5/D-13.6 then fix the claims, objective, and supply rule consistent with that landing. This paper presents all five together because they are not separable.
- **D-13.2** (key-handling protocol acknowledgment) and **D-13.1** (incident disposition) are prior-gate hygiene decisions independent of the model choice; nothing in this paper depends on their outcome, and this paper adds no new key-related exposure.

## 3. Evaluation framework — the ten comparison dimensions

COO-MANDATE-004 §5 mandates nine per-model dimensions (D1–D9, verbatim topics below); this engagement adds the tenth (D10) from the replacement-program rule (baseline §5 Stage B / §6). Every model in §5–§8 documents all ten:

| # | Dimension (source) |
|---|---|
| D1 | What holders own and what they do not own (mandate §5) |
| D2 | Whether redemption is available, optional, conditional, or unavailable (mandate §5) |
| D3 | How token supply changes (mandate §5) |
| D4 | What, if anything, aligns market price with reference value (mandate §5) |
| D5 | What happens during a depeg, market closure, currency control, oracle failure, or liquidity crisis (mandate §5) |
| D6 | Capital requirements and who bears losses (mandate §5) |
| D7 | Legal and regulatory questions requiring qualified advice (mandate §5) |
| D8 | Manipulation opportunities and incentive failures (mandate §5) |
| D9 | Quantitative tests and evidence required before approval (mandate §5) |
| D10 | What breaks in the current code under this model + migration implications given the deployed v1.2 estate (Task 13 rule; baseline §5 Stage B / §6) |

Governing honesty rules: no model may be described as making market price track anything unless D4 identifies a real, tested mechanism; no redemption language unless D2 reflects a real facility (D-13.7); reference value ≠ market price everywhere. No dimension may be left blank for any model — an honest "none"/"N/A" is a valid and expected answer (e.g., D4 under Model 1).

## 4. Baseline facts every model must fit (all `DEVELOPER-REPORTED`; cited to Task 10/11/12/13-Stage-A artifacts via baseline §2–§8)

1. **Deployed estate:** v1.2 five-currency pilot (`contracts/MTQSigma.sol`: USD 0.389 / EUR 0.278 / GBP 0.1669 / JPY 0.1111 / CNY 0.055; gold reserve-only; MockUSDC flows; admin-set prices) + ecosystem modules (Mint · Redeem · ReserveVault [USDC+PAXG] · Oracle · Algorithm · Takaful · Governance · Safe) on Monad testnet (10143), Arc testnet (5042002), Robinhood Chain testnet; plus one Solana devnet SPL mint (decimals-18 anomaly; supply field = u64 ceiling; mandated 1M unrepresentable — SOL-DEC-1 / DEC-3 OPEN). Deployed supplies: Monad 310.949 / Arc 1,000; no on-chain supply cap; genesis 1.1M-USDC→1M-MTQ model DISPROVEN on-chain (Safe holds 0).
2. **Undeployed source:** the 7-component `MTQSigmaV2.sol` and bank-mediated `MTQSigmaV3.sol` exist ONLY as source (`V3_SOURCE_READY_PENDING_DEPLOY`). Redesigning them faces no live-contract constraint; the deployed v1.2 estate is the live constraint.
3. **Authority (blocking for every model):** every privilege (admin/minter/pauser/keeper/oracle, Safe ownership, Solana authorities) resolves to the single compromised deployer EOA `0x3C39…8d8c` (R-1); Safes are 1-of-1 owned by that EOA; Task 12 D4/D5 migration packages are unsigned; **no live migration is authorized**; gen-A/C self-custody 1M pots with owner-gated `genesisMint` mean the exposed key can inflate supply today.
4. **Reserve dependence is total in the TS reference economics** (baseline §6; ~15 modules): RR ladder (MITHQAL canon 1.30/1.05/1.00 vs blueprint family 1.10/1.05/1.00 — C-INV-1); issuance capacity exists ONLY as PBC→ABC→DMCE (`maxMtqIssuanceUsd = availableBacking/1.30`); NAV-proportional redemption (EQ-142–145); proof-of-reserve (Chainlink PoR stub throws — `NOT IMPLEMENTED`); V3 stability pool (sole USDC custody; EMERGENCY deficit cover); genesis funding story; MARP reserve trades.
5. **Oracle reality:** one live upstream per pair with synthetic 3-source witnesses (§17.10 independence NOT met, disclosed); TS DEGRADED = mint paused / redeem open on last-known-good (fail-open divergence, disclosed). Every model below requires oracle remediation regardless of choice.
6. **Commercial/legal reality:** bank registry = 1 `SIMULATED` pilot bank (reference data only); all settlement/three-book machinery `SIMULATED`; **no issuer entity, license, counsel engagement, or real counterparty exists anywhere in the record.**
7. **Fee reality** (baseline §8): mint 0.10%; redeem ladder 0.15/0.50/1.00% (+2.00% EMERGENCY row — C-INV-4); RECOVERY 0.30%; rebalance 0.20% — all UNAPPROVED parameters; V3 `feeWallet` has no sweep function; V2/v1.2 commingle fees with collateral (C-INV-10).

---

## 5. Model 1 — Floating market-priced token + separately published adaptive reference index

*(COO-MANDATE-004 §5 examined-model 1 of 4; all ten dimensions below; design `PROPOSED`.)*

**Mandatory preamble.** Model 1 is **NOT a stablecoin**. The market price is set by supply and demand and **may deviate from the published reference index arbitrarily — any magnitude, either direction, any duration**. **Nothing in the index formula stabilizes, targets, supports, or defends the market price.** The reference index is a published measurement methodology — a statistic — and is not a promise about the token. Marketing implying otherwise violates the claims register (§B) and is prohibited.

**Model** (`PROPOSED`). MTQΣ is a transferable token with no backing, no redemption promise, no peg, no band, and no intervention mechanism. The adaptive currency-and-gold index (Stage C constituency + Stage D gold methodology) is published separately: methodology, versioned composition, index level, freshness, and a reference-vs-market deviation report (Stage K family). The payment-acceptance layer (Stage E) may voluntarily quote at reference value.

- **D1 — holders own / do not own.**
  - Own: an on-ledger balance; transferability; whatever utility the acceptance layer voluntarily grants.
  - Do **not** own: any claim on assets (none exist); any redemption right; any claim on the operator's balance sheet; any entitlement to the basket composition; any guarantee that market price ≈ reference value. No custody of basket currencies or gold exists or is implied.
- **D2 — redemption.** **Unavailable** at the protocol level. Secondary-market exits exist only at the market's discretion (venues unnamed — implying liquidity is prohibited). The v1.2/V2 vault-balance redeem machinery cannot survive as a production feature of this model; testnet remnants must be re-labeled honestly. Interface copy must state that redemption is not provided (Stage F honesty rule).
- **D3 — supply.** Defined by the owner's D-13.6 choice: (a) fixed supply post-migration; (b) rule-governed elastic issuance (governance-voted tranches with caps/timelocks); (c) authorized-issuer limits. The PBC→ABC→DMCE capacity chain is **deleted**; no other code computes issuance today, so the replacement rule must be explicit. The declared-but-unenforced `MINTER_ROLE` in V2 source must be enforced or removed in any descendant; `genesisMint` must be governed or removed.
- **D4 — price↔reference alignment.** **None, structurally.** Only soft forces: (i) acceptance-layer conventions quoting at reference value create local demand at that price point only where acceptance exists; (ii) narrative/psychological anchoring; (iii) voluntary arbitrage by participants who choose to treat the index as an anchor. No peg, band, intervention, or stabilization mechanism exists or is claimed.
- **D5 — stress behavior.**
  - *Depeg (sustained deviation):* expected and permitted; the response is publication of deviation metrics — never intervention.
  - *Market closure:* exit only via the acceptance layer or OTC — no facility; exit risk must be disclosed up front.
  - *Currency control:* the index can keep publishing (a data problem), but chain transfers and acceptance may be blocked jurisdictionally; component data availability may degrade.
  - *Oracle failure:* index publication suspends fail-closed (Stage I rules); token transfer and market price continue; deviation reporting pauses and must be disclosed as suspended.
  - *Liquidity crisis:* no backstop; price impact borne entirely by sellers; no circuit breaker exists on secondary markets.
- **D6 — capital & losses.** Minimal: index publication infrastructure, feeds, security, audits. No reserve capital. Losses: holders bear market risk; the operator bears operational/reputational risk; acceptance-layer merchants quoting at reference value bear FX-like risk. The Takaful module has no defined economic role under this model (open question, §12).
- **D7 — legal/regulatory (for counsel).** Token characterization per jurisdiction (commodity / none / other); whether publishing an index while operating a referencing token creates implied-claim/misrepresentation exposure; benchmark-administrator regimes if the index gains usage; AML/money-transmission for the acceptance layer; marketing-law limits on words like "stable/value/reference". No conclusions asserted; no jurisdiction list exists yet (§12).
- **D8 — manipulation & incentives.** Index-feed manipulation (damages credibility; no direct payout surface); wash-trading to manufacture a flattering "market price" statistic; operator incentive to over-issue if fees scale with volume; merchant adverse selection (accepting only when deviation favors the merchant); two failure modes — markets rationally ignore the index (relevance risk), or participants impute a peg that does not exist (expectation/litigation risk).
- **D9 — tests/evidence before approval.**
  - Index methodology reproduction + continuity suite (Stage D; chain-linked index exists — the <15%-vs-Laspeyres backtest is `DEVELOPER-REPORTED` for the OLD fixed-7 family only and must not be reused as evidence for a new constituency).
  - Oracle multi-source remediation evidence (§17.10 currently NOT met).
  - Reference-vs-market deviation-reporting harness (`SIMULATED` data only; Stage K family).
  - Shadow-mode simulation of candidate supply policies on historical data — no live pilot without Gate I.
  - Counsel memo on token characterization and permitted marketing language BEFORE any public use.
  - **No test can or should claim price alignment — there is no mechanism to test; the honest test is that the system never claims alignment.**
- **D10 — what breaks / migration.**
  - *Deleted:* RR ladder, PBC/ABC/DMCE, PoR, genesis funding story, NAV-proportional redemption, MARP reserve trades, stability pool — each removal documented with its consequences for redemption/liquidity/holder risk (mandate §4.9 rule).
  - *Deployed estate:* the v1.2 pilot's priced mint/redeem against MockUSDC is semantically incompatible with Model 1; owner options — explicitly re-label the pilot as testnet-only legacy and issue a fresh contract, or disable mint/redeem on the pilot. No on-chain step before Task 12 D8 authority migration.
  - *Solana:* a fixed-supply story conflicts with the u64-max supply field until SOL-DEC-1/DEC-3 disposition; decimals-18 anomaly unresolved.
- **Interface-language consequence.** UI/docs must present the token price as market-determined, the reference index as a published statistic, and redemption as not provided; "backed", "pegged", "collateralized" wording is prohibited in all artifacts.
- **Objective-fit verdict.** Fully consistent with the no-conventional-reserve objective — nothing is held, promised, or owed; the cost is that nothing aligns market price with reference value either.

## 6. Model 2 — Index-linked instrument with explicitly defined legal and economic obligations

*(COO-MANDATE-004 §5 examined-model 2 of 4; all ten dimensions below; design `PROPOSED`.)*

**Model** (`PROPOSED`). A token/instrument whose issuer — a legal obligor — owes holders payments defined by reference to the index: e.g., settlement at an index-determined value at maturity or on demand, and/or a committed tracking-error tolerance with remedies. What "index-linked obligations" would have to mean, contractually:

- **Obligor identity:** a legal entity answerable in court — not the deployer EOA, not "the protocol". No such entity exists in the record (§4 fact 6) — a blocking gap.
- **Obligation formula:** exact payment amount as a function of index level(s); settlement asset; timing (on-demand / scheduled / maturity); fees netted; rounding; early-termination terms.
- **Disclosure duties:** prospectus-class documents; index methodology + deviation publication; conflicts disclosure; insolvency/event triggers.
- **Tracking-error tolerance:** what deviation, measured how, by whom (independent calculator?), over what window, triggers what remedy (rebate / compensation / acceleration / termination). **No tolerance value is proposed here** — it is an owner + counsel parameter.
- **Tracking-failure handling:** fallback index or suspension (an oracle-failure question — C-INV-5 family), wind-down mechanics, and holder rank in obligor insolvency.

- **D1 — holders own / do not own.**
  - Own: a contractual claim against the obligor — enforceability unproven until counsel opines in a target jurisdiction.
  - Do **not** own: basket assets (absent perfected security); any protocol-level right independent of the contract; any claim that survives obligor insolvency as anything better than an unsecured creditor.
  - Residual exposure: obligor credit risk at all times.
- **D2 — redemption.** **Conditional / optional per contract**: e.g., periodic issuer repurchases at index value (optional for the issuer) or on-demand settlement conditional on terms and obligor solvency — never "available" in the unconditional sense; the contract, not the chain, defines the right.
- **D3 — supply.** Supply = obligor issuance/repurchase, mirrored on-chain; requires a legal-ledger↔chain reconciliation mechanism (a "proof-of-issuance" carrying the same trust-problem class as proof-of-reserve); on-chain balances are a representation of the legal ledger, not the source of truth.
- **D4 — price↔reference alignment.** Via the contractual obligation, **only to the extent the obligor hedges and remains solvent**; market price ≈ discounted expected obligation value less credit and liquidity premia — deviation from obligation value is normal, not a defect; nothing is guaranteed.
- **D5 — stress behavior.**
  - *Tracking failure:* contract remedies — slow, legal, litigable; no protocol-level protection exists.
  - *Market closure:* the legal claim survives; token tradability may not.
  - *Currency control:* the obligor may be barred from settling in a given currency — force-majeure clauses must be drafted precisely.
  - *Oracle failure:* contract fallback rules govern (must be pre-defined — C-INV-5 family).
  - *Liquidity crisis:* obligor credit spread widens; market price falls below obligation value; holders bear credit risk in the interim.
- **D6 —** the obligor must hold hedge/economic capital against the commitment — **in substance a reserve by another name**, sized by owner-commissioned modeling (no figures here); losses: obligor equity first, holders as unsecured creditors beyond.
- **D7 —** near-certain securities characterization if offered publicly (counsel to confirm per jurisdiction); prospectus/licensing; derivative classification; insolvency ranking; consumer-protection; cross-border offering rules.
- **D8 —** index manipulation now has **direct monetary payoff** (obligations are set by the index); obligor under-hedging (moral hazard); self-measured tracking error (conflict); front-running index publication; incentive to draft favorable fallbacks. Requires independent calculation and publication controls.
- **D9 — tests/evidence before approval.**
  - Legal-enforceability opinion per target jurisdiction (obligor identity, insolvency rank, perfected-security question).
  - Hedge simulation under historical crises (`SIMULATED`; no live data exists or is claimed).
  - Tracking-error backtest under the drafted tolerance rules (the tolerance value itself is an owner + counsel parameter — none proposed here).
  - Obligor capital plan reviewed by qualified parties.
  - Disclosure documents drafted and reviewed (prospectus-class).
  - Proof-of-issuance reconciliation design + independent audit — all before any approval.
- **D10 — what breaks / migration.** Everything in Model 1's D10, plus: no obligor entity, licenses, disclosure machinery, or real bank counterparty exists (bank registry = 1 `SIMULATED` pilot bank). V3's bank-mediated workflow (`requestMint` → 16-step BM flow → off-chain `RedeemSettlement` obligations) is the nearest existing skeleton and could be formalized — but enforceability is a legal-construction project, not a code change. A Model 2 instrument is a **new issuance**; the v1.2 pilot cannot be retrofitted into obligations — it would be wound down or left as testnet-only legacy. Authority migration still precedes anything real.
- **Interface-language consequence.** UI/docs must present the instrument as a claim on a named obligor, with the obligation formula, tolerance, remedies, and insolvency rank disclosed; the index remains a separate published statistic.
- **Objective-fit verdict.** Partially consistent — the obligor's hedge/economic capital is a reserve in substance with less transparency than a named reserve; the no-reserve objective survives in language, not in economics.

## 7. Model 3 — Enforceable redemption facility

*(COO-MANDATE-004 §5 examined-model 3 of 4; all ten dimensions below; design `PROPOSED`.)*

**Model** (`PROPOSED`). Token redeemable on demand (or on defined conditions) at reference value through a facility that must actually exist. **Mandatory warning the owner must see: this model partially reintroduces reserve-like requirements — it is a conventional reserve by another name.** Honest enumeration of what the facility requires:

- **Assets:** settlement assets held in the facility (bank balances, tokenized instruments, gold instruments per the D-13.12 gold disposition). Haircut modeling exists in reference code (`engine.ts` reserveAssetValues) and is reusable — but haircuts ARE reserve accounting.
- **Counterparties:** custodians, banks, liquidity providers/market makers — each with signed agreements, credit risk, and jurisdictional exposure. None exist today (1 `SIMULATED` pilot bank).
- **Liquidity:** component-market depth (FX, gold), operational liquidity across settlement windows, settlement-finality terms; run-scenario coverage.
- **Capital:** a loss-absorbing buffer above expected redemption flows — the RR ladder (1.30/1.05/1.00 canon or 1.10 family, C-INV-1) is exactly such a buffer. Sizing requires owner-commissioned modeling; **no figures are proposed here**.
- **Legal enforceability:** perfected security interest / bankruptcy-remote trust / SPV so the claim survives operator failure; without it, "redemption" is discretionary. AML/KYC/sanctions screening on redeemers.

If the objective is truly NO conventional reserve, Model 3 either **contradicts the objective** or must shrink to a capped, conditional facility (a hybrid: floating core + limited redemption window) — in which case D2 is "conditional", not "available".

- **D1 — holders own / do not own.**
  - Own: a redeemable claim whose strength equals the legal structure behind it.
  - Do **not** own: facility assets (absent perfected security / bankruptcy-remote structure); protection from haircuts or gates; any priority beyond what the legal structure grants.
  - Residual exposure: facility credit risk, haircut risk, gate risk.
- **D2 — redemption.** **Available** within facility terms if uncapped; **conditional** if capped or gated — the sub-choice is the owner's (D-13.7(b)) and must be stated in the interface exactly.
- **D3 — supply.** Mint against facility inflow, burn on redemption — the existing NAV-proportional machinery (EQ-142–145) is the nearest implementation; issuance capacity = facility assets / RR, i.e., PBC→ABC→DMCE is **rebuilt, not deleted**.
- **D4 — price↔reference alignment.** Redemption arbitrage IS the alignment mechanism: deviations close **if** facility capacity exceeds flow and quotes are live. Runs, haircuts, and gates break the loop under stress — the classic partial-reserve instability; it must be stated to holders.
- **D5 — stress behavior.**
  - *Depeg:* arbitrage until facility liquidity exhausts → pre-defined gates/suspension (else disorderly); six-state vs five-state (C-INV-3) and EMERGENCY semantics (C-INV-4) must be reconciled first.
  - *Market closure:* redemption continues or halts per pre-defined terms; stale-quote redemption must be forbidden.
  - *Currency control:* facility assets may be frozen in a jurisdiction → geographic subordination of holders.
  - *Oracle failure:* fail-closed (halt) vs fail-open (last-known-good — the current TS DEGRADED divergence) must be a deliberate, disclosed choice.
  - *Liquidity crisis:* run dynamics are first-come-first-served; gates protect remaining holders at early redeemers' expense — a distributional choice requiring explicit owner sign-off.
- **D6 —** largest of the four models: facility assets + buffer capital + operations. Losses: facility equity first, then holders via haircuts/gates. Who funds the buffer (owner capital? fee accrual? investors?) is an OPEN commercial question.
- **D7 —** money-transmission/e-money licensing; securities characterization of a redeemable instrument; custody rules; bankruptcy remoteness; AML program for redeemers; consumer-protection duties around gates; cross-border redemption restrictions.
- **D8 —** highest-value attack surface: oracle manipulation to over-redeem (direct payout); arbitrage against stale quotes; insider runs; facility-manager asset substitution; over-issuance incentive (fee income vs capacity) — the historical failure mode of fractional-reserve designs. Facility authority is a single point of failure — today it would be the compromised EOA, which is disqualifying until Task 12 D4/D5/D8 execute.
- **D9 — tests/evidence before approval.**
  - Redemption-flow stress model (`SIMULATED`; no live data exists or is claimed).
  - Run simulation under correlated stress (fixed-seed, in the style of the existing 11-scenario suite — facility-focused; does not exist today).
  - Gate/queue fairness analysis (distributional outcomes under first-come-first-served).
  - Haircut-adequacy review by qualified parties.
  - Per-jurisdiction enforceability opinions (perfected interest / bankruptcy remoteness).
  - Counterparty due-diligence files (custodians, banks, market makers — none exist today).
  - PoR-style attestation design (current Chainlink stub throws — `NOT IMPLEMENTED`).
  - Capital plan approved by owner + Economic Authority.
- **D10 — what breaks / migration.** Least breaks in code — the TS reference layer already approximately IS this model (RR / PBC / ABC / DMCE / NAV-proportional redemption); what breaks is the **owner's objective**. The deployed v1.2 pilot (admin-set prices, vault-balance economics, no supply cap) is a degraded ancestor, not this model; migration = formal replacement after authority migration. Solana u64-max/decimals-18 incompatibility stands (SOL-DEC-1).
- **Interface-language consequence.** UI/docs must disclose assets, counterparties, gate/suspension terms, haircuts, and the distributional rule under runs; "redeemable at reference value" is honest only while the facility is live, capitalized, and legally enforceable.
- **Objective-fit verdict.** Contradicts the stated objective — every honest component of this model (assets, counterparties, capital, enforceability) is a conventional reserve under another name; choosing it means the owner revises the no-reserve objective itself.

## 8. Model 4 — Two-layer architecture: neutral reference-index service + separately governed payment instrument

*(COO-MANDATE-004 §5 examined-model 4 of 4 — "any other technically and economically credible alternative"; all ten dimensions below; design `PROPOSED`.)*

**Model** (`PROPOSED`). Split the program: **Layer A — the MTQΣ Reference Index as a neutral published service**: methodology + verifiable computation + versioned constituency (Stage C) + gold methodology (Stage D) + a publication surface (index level, reference value, market price, deviation, freshness, component/weight version — per baseline Stage D row). It issues no obligations and has no holders. **Layer B — payment instrument(s)**: transferable token(s) whose operators voluntarily reference the index for pricing/acceptance, governed separately, with economics chosen per instrument (which could itself be Model 1, 2, or 3 — decided later, per instrument). This matches the owner's separately-governed acceptance-layer steer. **Alternatives considered and set aside (with reasons):** (i) *closed-end / structured-product wrapper* — fixed issuance of claims on a static basket: exhibits NAV-discount instability, still holds assets (reserve-like), near-certain fund/securities characterization; weaker on the objective; (ii) *fully synthetic index with no token at all (index-as-a-service)* — the null option: cleanest risk profile but abandons the token/payment objective; retained as fallback and as a Stage G revenue option (licensing engines B/C/D are `NOT IMPLEMENTED`, baseline §5 Stage G).

- **D1 — holders own / do not own.**
  - Index layer: users of a published dataset own at most usage/licensing rights — **no holder claims exist**; the index owes nobody a payment or a price.
  - Payment layer: holders own whatever that instrument defines — its own D1 analysis at its own decision; this paper does not pre-judge it.
- **D2 — redemption.** Index layer: N/A (nothing to redeem). Payment layer: per instrument — OPEN.
- **D3 — supply.** Index layer: no token, no supply. Payment layer: per its issuer; the index no longer computes or constrains issuance (PBC→ABC→DMCE fully decoupled).
- **D4 — price↔reference alignment.** Voluntary only: instruments may anchor pricing to the index; the index enforces nothing and implies no backing of any instrument.
- **D5 — stress behavior.**
  - *Oracle failure:* fail-closed index publication suspension, disclosed; no holder is directly harmed (there are no index-layer holders).
  - *Currency control:* data-availability risk only, at the index layer; instrument-layer exposure is that instrument's own.
  - *Depeg / market closure / liquidity crisis:* N/A at the index layer; payment-layer stresses belong to that instrument's chosen model.
  - Key property: index-layer failures create **no direct holder losses** — reputational only.
- **D6 —** index layer: operating capital only (feeds, computation, security, audit); losses borne by the operating entity. Payment layer: per its own model. Cleanest separation of who-bears-what across the four models.
- **D7 —** index publishing: data/IP/fintech service; possible benchmark-administrator exposure if widely used (counsel to determine the regime per jurisdiction); payment instruments face their own regimes independently — separation reduces regulatory contagion between layers.
- **D8 —** methodology/constituency capture by interested instruments (conflict-of-interest rules needed between layers); brand free-riding (instruments implying endorsement); feed manipulation (as Model 1, but with zero direct payout surface).
- **D9 — tests/evidence before approval.**
  - Index methodology reproduction + continuity suite (Stage D tests, incl. composition-change continuity once Stage C lands).
  - Multi-source oracle remediation evidence (§17.10 currently NOT met).
  - Governance simulation of constituency transitions (capture-resistance of admission/retirement decisions).
  - Benchmark-regime legal review (administrator obligations, if any, per jurisdiction — counsel).
  - Commercial validation for licensing (Stage G rule: prospective-customer evidence before building).
- **D10 — what breaks / migration.** Cleanest deletion: the ~15 reserve modules are deleted outright (none are needed for index computation); `chain-index.ts`, `mase.ts`, `oracle.ts` survive in modified form (Stage C/D). The deployed v1.2 estate is either explicitly re-labeled testnet-only legacy or becomes a Layer-B instrument whose economics must still be decided — its admin-set prices and MockUSDC flows can never honestly be described as index-referenced. Whether the MTQ brand attaches to the index or to the instrument is an owner product decision (§12). Solana disposition unchanged (SOL-DEC-1). Authority migration still precedes anything on-chain.
- **Interface-language consequence.** Index publications must carry methodology, versioning, freshness, and a no-promises disclaimer; instruments must state their own economics and must not imply index endorsement.
- **Objective-fit verdict.** Fully consistent — the index layer holds no reserve, promises nothing, and owes nobody; the acceptance/payment layer carries all economic claims, separately governed as the owner steered.

---

## 9. Comparison matrix (all cells: `PROPOSED` analysis over the `DEVELOPER-REPORTED` baseline of §4)

| Dim | M1 Floating + index | M2 Index-linked obligations | M3 Redemption facility | M4 Two-layer index service + instrument |
|---|---|---|---|---|
| D1 | Ledger balance; no claims, no assets | Contract claim on obligor; credit risk | Redeemable claim; facility credit risk | Index: no holders; instrument: per its own terms |
| D2 | Unavailable (protocol) | Conditional/optional per contract | Available if uncapped; conditional if gated | Index N/A; instrument OPEN |
| D3 | D-13.6 policy; capacity chain deleted | Obligor issuance mirrored; proof-of-issuance needed | Facility flows; capacity = assets/RR (rebuilt) | Index: none; instrument per issuer |
| D4 | None (voluntary conventions only) | Obligor hedge + credit; not guaranteed | Redemption arbitrage; breaks under runs/gates | Voluntary referencing; index enforces nothing |
| D5 | Deviation permitted; no backstop | Legal remedies; credit-spread risk | Runs → gates; distributional choices | Index fails soft (no holders); instrument per model |
| D6 | Operating capital only; holders bear market risk | Obligor hedge capital; equity then holders | Largest; facility equity then haircuts/gates | Index operating only; instrument separate |
| D7 | Token characterization; marketing limits | Securities/prospectus/derivative; insolvency rank | Licensing; custody; bankruptcy remoteness | Benchmark regimes; per-instrument regimes |
| D8 | Feed capture; wash-trading; expectation risk | Manipulation pays; self-graded tracking | Highest: oracle→over-redeem; insider runs | Governance capture; free-riding; feed capture |
| D9 | Deviation harness; supply-policy sim; counsel memo | Enforceability opinion; tracking backtest; capital plan | Run/gate sims; haircut review; enforceability | Continuity suite; oracle remediation; licensing validation |
| D10 | Deletes ~15 modules; pilot re-labeled | New legal entity needed; V3 skeleton formalizable | Rebuilds PBC/ABC/DMCE; objective broken | Clean deletion; index survives; estate re-labeled |
| **Objective fit** | **Fully consistent** | Partially (obligor capital is reserve-like) | **Contradicts no-reserve objective** | **Fully consistent** |

## 10. Recommendation — ADVISORY ONLY (no decision is made here)

- **Advisory recommendation:** **Model 1 as the token architecture, with Model 4's structural separation adopted** — publish the index as a neutral, separately governed service; treat the MTQ token as one voluntary client of the index; payment instruments reference it at their operators' choice. This is, in this analysis, the only option set fully consistent with the owner's stated no-conventional-reserve objective, and it is claims-register-compliant by construction: it promises nothing it cannot deliver.
- **Why not M2/M3 as the core:** M2 requires an obligor entity, licenses, hedge capital, and disclosure machinery — none exists — and its hedge capital is a reserve in substance with less transparency; M3 **contradicts the objective** (§7 preamble) and concentrates the highest manipulation/attack surface behind what is today a compromised EOA.
- **Trade-offs the owner must accept with this recommendation:**
  - No price-alignment mechanism at all → marketing cannot promise stability → adoption depends entirely on acceptance-layer uptake and index credibility.
  - Markets may ignore the index (relevance risk) or impute a promise it does not make (expectation/litigation risk).
  - D-13.5 must be reframed from price stability to index-quality objectives — a materially weaker-sounding product story that is nevertheless the only honest one under no-reserve.
  - Regulatory characterization remains open in every scenario; choosing M1/M4 narrows exposure but does not close the question.
  - The v1.2 deployed pilot must be honestly retired/re-labeled — it cannot be presented as an instance of the chosen model.
- **If the owner rejects the no-reserve objective itself:** Model 3 becomes the primary candidate — but that is a **change to the objective** (to be recorded as an owner decision), and C-INV-1 (RR family), C-INV-4 (EMERGENCY semantics), and the authority migration (Task 12 D8) would still block implementation.
- This recommendation is advisory. **No model is selected by this document.** §11 is the decision surface.

## 11. OWNER APPROVAL — Gate B (all OPEN; nothing below is decided by this paper)

**DECISION D-13.3 / D-13.4 / D-13.5 / D-13.6 / D-13.7 (Gate B — economic model selection): ☐ OPEN — owner decision required.**

- **D-13.3 — What is MTQΣ?** ☐ OPEN. Exact question: *"What is MTQΣ: (a) basket-referenced digital asset, (b) purchasing-power reference unit, (c) algorithmically managed monetary token, or (d) hybrid (each property separately defined)?"* Consequences: (a) fits Models 1/4 — claims limited to index reference, never price; (b) strongest index-quality duties, zero token-price implication — marketing must never conflate unit and token; (c) implies algorithmic action on supply/price — closest to M2/M3, weakest fit with no-reserve; (d) each property must be defined separately, with counsel. The choice fixes what may be said to holders and cannot be repaired retroactively.
  - *Dependency:* none of the other four can be answered coherently before this one.
- **D-13.4 — Which economic family survives (or none)?** ☐ OPEN. Exact question: *"Which family is the v3.0 baseline: v1.0/v2.0 (7-ccy, RR 1.10), MITHQAL v25.3.1 (11-ccy, RR 1.30, 80/18/2), the deployed v1.2 5-ccy pilot, or clean-slate per the selected model?"* Advisory: clean-slate, because Models 1/4 retain only index computation from existing code. Consequence: retiring a family invalidates its docs/tests/contracts; keeping two perpetuates C-INV-1/2/3/4.
  - *Dependency:* effectively settled by the model row chosen via D-13.7; this paper's advisory lean is clean-slate.
- **D-13.5 — Stability objective?** ☐ OPEN. Exact question: *"What is the stability objective: USD stability, basket stability, global purchasing-power preservation, or another defined objective?"* Under Models 1/4 only **index-quality objectives** (representativeness, reproducibility, continuity) are honestly available — market-price stability is NOT available under any no-reserve model. Under M2, a tracking-error objective; under M3, a redemption-value objective. Consequence: determines Stage J benchmarks and metrics; "all of them" is not an option.
  - *Dependency:* the honest option set is constrained by the model row (no-reserve rows admit only index-quality objectives).
- **D-13.6 — Supply policy + issuance authority?** ☐ OPEN. Exact question: *"Under no-conventional-reserve, what is the supply policy (fixed / rule-governed elastic with governance-voted tranches / authorized-issuer limits), and who may issue, under what caps and timelocks?"* Consequence: with PBC→ABC→DMCE deleted, issuance capacity is undefined until a rule is chosen; the unenforced `MINTER_ROLE` and the `genesisMint` pots must be fixed/governed in any descendant; the compromised-EOA authority (§4 fact 3) blocks real issuance regardless.
  - *Dependency:* interacts with D-13.10 (cross-chain supply) — the two rules must be consistent.
- **D-13.7 — Redemption/market mechanism?** ☐ OPEN. Exact question: *"Is redemption (a) not promised — reference value only, secondary markets unnamed — or (b) a specified facility with modeled liquidity/price-impact/counterparty/legal risk?"* Consequences: (a) is honest and cheap — consistent with Models 1/4; interface must state redemption is not provided. (b) equals Model 3 — reintroduces reserve-like assets/counterparties/capital/enforceability (§7) and contradicts the no-reserve objective unless the objective is revised.
  - *Dependency:* this is the principal model-selection axis of the whole Gate B set.
- Interacting OPEN decisions (not decided here): **D-13.1** (uploaded key file), **D-13.8** (fees), **D-13.10** (cross-chain supply), **D-13.11** (basket max size), **D-13.12** (gold). Precondition for ANY on-chain step under EVERY option: the Task 12 D8 authority-migration chain + RELEASE-GRANTS.

## 12. Assumptions & unresolved questions

- **Assumptions.** (1) The no-conventional-reserve objective is a hard constraint — if the owner would accept a reserve by another name, Model 3 becomes viable, which is an objective change to be recorded as a decision; (2) an Economic Authority will be appointed (persons unknown today); (3) target jurisdictions will be named (none exist today — this blocks all D7 legal analysis from being scoped); (4) oracle multi-source independence is achievable (currently NOT met).
- **Unresolved questions.**
  - *Product/branding:* brand assignment under Model 4 (index vs instrument); the Takaful module's economic role (undefined under all four models).
  - *Chain:* Solana disposition per model (a Model 1 fixed-supply story conflicts with the u64-max supply field); interaction of D-13.10 cross-chain supply with each model's supply rule.
  - *Commercial:* who funds index publication (Stage G revenue engines B/C/D `NOT IMPLEMENTED`); no acceptance-layer adoption evidence exists (M1/M4 both depend on it).
  - *Technical:* the deviation-reporting surface (Stage K reference-vs-market family not implemented); oracle multi-source independence remediation.
  - *Legal:* whether index publication could trigger benchmark-administration obligations in any target jurisdiction.
- **No invented figures.** This paper deliberately contains no capital amounts, tolerance values, redemption capacities, volatilities, or APRs. Any such number must come from owner-commissioned modeling (Stage J) or qualified advisors — never from documentation.

## 13. What has NOT been tested/implemented

- Everything herein is `PROPOSED`. Nothing was implemented, deployed, or authorized for these models.
- No gate advanced; zero on-chain actions; zero key handling; `upload/` and `.env` were never opened and no secret-shaped file was read (zero-key-handling discipline maintained).
- **No model in this paper has been simulated.** The existing backtests/stress suites (10-yr backtest, 11-scenario suite, canonical invariants) test the OLD reserve-based reference family and must NOT be cited as evidence for any model here.
- No legal opinion obtained; no counsel engaged; no regulator contacted (`NOT IMPLEMENTED`).
- No redemption-flow/run modeling (M3), no tracking-error backtest (M2), no acceptance-layer adoption evidence (M1/M4) exists.
- Oracle independence remediation `NOT IMPLEMENTED` (single live upstream per pair; synthetic witnesses).
- The deployed v1.2 estate is untouched; migrations of any kind are unauthorized pending Task 12 D8; Foundry suites `UNVERIFIABLE` in this sandbox; canonical-invariants last recorded PASS = Task 12 (zero source changes since; `UNVERIFIED` this cycle per `test-matrix-and-results.md`).
- The worktree secret gate remains intentionally RED pending D-13.1 (T13-INC-001) — the gate working as designed, not a failure.

## 14. Mandate-clause compliance cross-check (COO-MANDATE-004 §5 self-audit)

| Mandate requirement | Where satisfied in this paper |
|---|---|
| Compare viable models against the owner's no-conventional-reserve objective | §4 facts; per-model **objective-fit verdicts**; §9 matrix last row |
| Examine (1) floating market-priced token + separately published adaptive reference index | §5 |
| Examine (2) index-linked instrument with explicitly defined legal and economic obligations | §6 (contractual meaning enumerated: obligor, formula, disclosure, tolerance, failure handling) |
| Examine (3) model with enforceable redemption facility incl. actual assets, counterparties, liquidity | §7 (enumerated honestly; reserve-by-another-name warning) |
| Examine (4) other technically and economically credible alternative | §8 (two-layer architecture; closed-end wrapper and index-as-a-service considered and set aside with reasons) |
| Per model: what holders own / do not own | D1 (§5–§8) |
| Per model: redemption available / optional / conditional / unavailable | D2 (§5–§8) |
| Per model: how token supply changes | D3 (§5–§8) |
| Per model: what aligns market price with reference value | D4 (§5–§8) |
| Per model: depeg, market closure, currency control, oracle failure, liquidity crisis | D5 — five named scenarios per model |
| Per model: capital requirements and who bears losses | D6 (§5–§8) |
| Per model: legal and regulatory questions requiring qualified advice | D7 (§5–§8) + §15 |
| Per model: manipulation opportunities and incentive failures | D8 (§5–§8) |
| Per model: quantitative tests and evidence required before approval | D9 (§5–§8) |
| Do NOT describe the floating model as a stablecoin; no implication that an index formula guarantees stable market value | §5 mandatory preamble; §3 honesty rules; no such claim appears anywhere |
| Do NOT select the final model; present recommendation, trade-offs, owner-approval field | §10 (advisory), §11 (all ☐ OPEN with exact questions + consequences) |
| Deliverable fields: purpose/scope · evidence & sources · design + alternatives · assumptions & unresolved · tests required · security & economic implications · owner approvals · not-tested/not-implemented | §1 · §4 + citations · §5–§9 · §12 · D9s · D5/D6/D8/D10 · §11 · §13 |
| Replacement-program rule (no silent renames/deletions) | D10 per model (what is deleted and what replaces it) |

## 15. Legal disclaimer

- All regulatory characterizations above (security, commodity, derivative, e-money, money transmission, benchmark administration, custody, AML obligations) are **questions requiring qualified counsel**, not conclusions. This document is not legal advice.
- Before any public offering, marketing, acceptance-layer operation, instrument issuance, or third-party reliance on the published index, written opinions from qualified counsel in **each target jurisdiction** are REQUIRED. No jurisdiction list exists today (§12), so no opinion can yet even be scoped.
- No regulatory approval, exemption, or safe harbor is claimed or implied. Nothing in this paper authorizes any transaction, deployment, or transfer; unauthorized reserve transactions remain FORBIDDEN by posture.

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED**
