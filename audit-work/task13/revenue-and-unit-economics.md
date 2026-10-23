# MTQΣ — TASK 13 · Revenue & Unit Economics (MANDATE-004 §9 — the required revenue model; extended by MANDATE-006 §14)

**Mandate:** MTQSIGMA-COO-MANDATE-004 §9 ("Produce a fair and sustainable revenue model" — this file, with this exact filename, is the §9 deliverable). Stage G; input to Gate-H-adjacent commercial decisions. Sibling to deliverable 8 (`fee-and-commercial-revenue-model.md` — the fee architecture; this file carries the four-stream commercial model, scenarios, costs, and unit economics).
**STATUS: PROPOSED v1 — HYPOTHETICAL MODELING STRUCTURE ONLY.** **No customer number, trading volume, fee rate, conversion rate, or profit forecast is invented in this document.** All numbers that appear are either (a) cited facts about existing code (UNAPPROVED parameters), or (b) the value zero — the only revenue quantity with any evidentiary basis today. Every scenario below is a labeled HYPOTHETICAL structure awaiting owner approval (**D-13.9**) and real-world validation. Nothing here is a forecast, a claim of viability, or an approval of any price.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

Evidence-status legend (per `audit-work/task13/README.md`): `VERIFIED` · `DEVELOPER-REPORTED` · `SIMULATED` · `PROPOSED` · `UNVERIFIED` · `NOT IMPLEMENTED`. Facts about the current system are `DEVELOPER-REPORTED` (cited to the Stage A baseline `baseline-and-change-matrix.md` §2/§5 Stage G/§8 and sibling specs) unless re-verified this session; all commercial design is `PROPOSED`; the scenario math is a `PROPOSED` structure over `HYPOTHETICAL` inputs. English only. Nothing below advances any release gate.

---

## 0. Purpose, the owner's standing formula, and precise definitions

### 0.1 The standing identity (owner's formula, adopted verbatim and made operational)

> **Operating result = revenue − all operating costs.**

This identity governs every figure this program will ever publish. It is applied with the following precise definitions:

- **Revenue** — consideration received or receivable under an enforceable obligation **for a service actually provided** (a transaction executed, a settlement orchestrated, an API call served, a data feed delivered, a license granted, support delivered), recognized when the service is provided, measured per contract, **net of refunds**, and **never** including any of the §4 prohibited items (token issuance, token appreciation, validator gas, reference value of treasury tokens, customer funds held in course of settlement).
- **All operating costs** — the full deduction list of §3: payment processing, conversion, settlement, security, custody (where custody-adjacent services exist), data licensing, infrastructure, compliance, support, payroll, refunds, and other actual costs of providing the services and running the operating company.
- **Presentation rules:** pass-through third-party costs are presented **net** (never grossed up into revenue); fees denominated in volatile assets are recognized as revenue when the service is provided but realized as cash only on conversion, with conversion costs deducted; outstanding fee receivables/obligations are reported separately from realized revenue (stub profit-measurement field list, adopted).

### 0.2 Scope

- Evaluate the four §9 revenue streams **separately** (§1), each with: paying customer, deliverable, pricing basis, service costs, gross-margin drivers, contractual obligations, compliance questions, realistic path to customer acquisition — the eight mandated fields, plus a "what this stream is NOT" guard.
- Provide the **low/base/high scenario structure** as an explicit parameterized model with symbolic parameters, HYPOTHETICAL assumption labels, and structural sensitivity analysis (§2). No invented inputs.
- Provide the **cost model** and the symbolic break-even structure (§3).
- State what revenue is **NOT** (§4), the governance separation (§5), the honest status (§6), owner approvals (§7), the not-tested list (§8), and risks (§9).
- Stub continuity (deliverable-8 placeholder, Streams A–D): Stream A (disclosed protocol fees) and Stream B (cross-chain/payment services) together map to §1 Stream 1; Stream C (institutional software/APIs) maps to Streams 2–3; Stream D (research/licensing) maps to Stream 4.

---

## 1. The four revenue streams, evaluated separately

**Common ground (all four streams):** none of these businesses exists today (`NOT IMPLEMENTED`; baseline §5 Stage G: "Revenue streams B/C/D + fairness rules + profit measurement — **not implemented anywhere**"; no customer-evidence artifact exists). Every stream is conditional on: the Gate B model decision (Streams 1's protocol-side fees exist only under models where the corresponding operations exist — `fee-and-commercial-revenue-model.md` §2.2), authority migration (Task 12 D8 chain — every authority today resolves to the compromised R-1 EOA, which is disqualifying for any live commercial operation), and counsel sign-off in each target jurisdiction (**no jurisdiction list exists** — `economic-model-options.md` §12). Success-fees note: **success-fee pricing in custody-adjacent services requires care** (conflict: an operator paid on completion is incentivized to force settlement timing and accept custody risk) — PROPOSED policy: success-fee bases require counsel review plus explicit D-13.9 approval before any use.

### 1.1 Stream 1 — Transparent transaction & integration-service fees (only where services are ACTUALLY provided)

- **What it is:** disclosed fees for services the operating company genuinely operates and is entitled to collect for: **payment acceptance** (merchant/enterprise acceptance of registered instruments), **settlement orchestration** (quote → finality → obligation recording per the payment spec), **conversion orchestration**, and **reconciliation tooling**. Fee rates, line-items, spread disclosure, and the no-double-charging rule are owned by **D-13.8/D-13.19** and designed in `payment-instrument-registry-and-settlement-spec.md` §6.1 (quote fee line-items: network/rail fee, conversion fee, protocol fee class; "no undisclosed spread, no double charging") and §2 layer 3 (a conversion is charged once per operation) — **cited as the controlling design**. Third-party network/relayer/LP/gateway/settlement costs are identified separately (stub Stream B rule); **validator gas is never MTQΣ revenue** (§4).
- **Paying customer:** the contracting party using the service — merchants, PSP/integrator partners, and authorized banks/institutions operating on the acceptance layer (payment spec §5.2 role model), NOT retail end-users except through a disclosed pass-through arrangement charged to the integrator. PROPOSED: fees are charged to the integrator/merchant contract party and itemized (no hidden retail surcharge the operator does not disclose).
- **Deliverable:** executed payment acceptance; orchestrated settlement with finality evidence per rail (payment spec §6.2); reconciliation reports (three-book style, §6.5); exception handling and refund processing (§6.3/§6.6); integration support during the transaction lifecycle.
- **Pricing basis (candidates; adoption checkboxes §7):** per-transaction flat fee; disclosed ad valorem (rate × processed value — rate is D-13.8, never set here); volume-tiered bands; integration/project fee for setup. **Success-fee bases only with the §1-common-ground caution.**
- **Service costs:** third-party PSP/rail/network fees (pass-through, netted); validator gas (cost, never revenue); conversion spread/slippage; settlement-window costs; support and fraud/exception staffing; infrastructure for the quoting/settlement services.
- **Gross-margin drivers:** the pass-through share `r_pass` (third-party costs as a share of gross — the single largest driver); transaction scale against the fixed settlement/monitoring base; automation of reconciliation and exception handling; refund rate; instrument mix (higher-cost rails compress margin); fee semantics (`FEE-SEMANTICS`, file 1 §1.2) affecting effective yield per operation.
- **Contractual obligations:** SLAs (service uptime, settlement deadlines, exception turnaround); refund commitments (fee refunded on failed transactions — D-13.8 default); audit rights; data-protection terms; liability caps; termination and portability of customer positions; disclosure of fee-schedule change governance (file 1 §2.4).
- **Compliance questions (flagged for counsel, never answered here):** whether accepting/orchestrating settlement in stablecoins/bank rails constitutes money transmission or a VASP-regulated activity per jurisdiction; AML/sanctions program obligations; PSP regulation; consumer-protection duties; cross-border restrictions; whether fee income on specific rails characterizes the operator differently.
- **Realistic path to customer acquisition (channel categories; NO customer counts invented):** (i) payment-acceptance partnerships with merchants/PSPs/banks already operating in target corridors; (ii) treasury/payments-software vendors embedding the acceptance layer; (iii) developer documentation and sandbox program (with SIMULATED/NOT CONNECTED labels maintained — no capability overclaim); (iv) named-account pilot programs under explicit owner authorization and RELEASE-GRANTS (none authorized today).
- **What this stream is NOT:** not a yield on balances; not a spread hidden in conversion (spread is an itemized, capped line); not fee income from volumes the system does not have; not revenue from gas. **Current capability: zero real rails** (payment spec §1: pilot bank SIMULATED; MBG gateway chain-read-only; stablecoins = MockUSDC test tokens; CBDC NOT CONNECTED) — Stream 1 revenue is therefore conditional on D-13.18/D-13.19 adoption plus real, verified rail integration.

### 1.2 Stream 2 — Institutional subscriptions

- **What it is:** recurring subscription products: **valuation APIs** (reference-value computation the customer can reproduce), **reference-index data feeds** (index level, composition/weights version, methodology version, deviation, freshness — the six-value publication surface of deliverable 5 §3), **treasury tools**, **reconciliation tooling**, **risk dashboards / data-quality alerts**, and **reporting**.
- **Paying customer:** financial institutions, corporate treasurers, asset managers, fintech/analytics firms, research organizations — institutional data consumers, under B2B contracts.
- **Deliverable:** API access (documented, versioned); data feeds with published freshness/staleness and revision policy (deliverable 5 §2.3); dashboard/reporting access; support tier.
- **Pricing basis (candidates; adoption checkboxes §7):** per-seat; per-call; volume-tiered API pricing; flat subscription by product tier; data-redistribution license tiers (distinct from end-use).
- **Service costs:** **data licensing** (upstream FX/gold/CPI feed licenses and — critically — redistribution rights for commercial API resale; current pilot feeds are free/public sources whose commercial-redistribution terms are UNVERIFIED and unchecked — flagged, not assumed); API infrastructure; data-quality operations (oracle monitoring per deliverable 10); support; security/compliance for data products.
- **Gross-margin drivers:** upstream data-license structure (fixed subscriptions vs per-customer royalties — often the dominant cost); API call economics; support leverage; churn; multi-product attach (API + dashboard + reporting); freshness/quality as the retention driver (which depends on oracle remediation — §17.10 independence NOT met today, `DEVELOPER-REPORTED`).
- **Contractual obligations:** SLAs (uptime, latency, data freshness, correction-notice windows); **upstream data-license sub-licensing restrictions flow down**; audit rights; indemnities and disclaimers (the index is a published measurement — no investment advice, no accuracy warranty beyond the published revision/correction policy, no reliance guarantee for trading); termination/data-portability; service credits.
- **Compliance questions (for counsel):** data-redistribution/market-data licensing law; **benchmark-administrator regimes if the index gains usage** (`economic-model-options.md` D7/M4 — flagged there, unresolved); data-protection; tax treatment of data services; possible securities-market-adjacent rules if reference values are used in regulated products.
- **Realistic path to acquisition (categories, no counts):** institutional data-sales channels (direct treasury/analytics-desk sales); financial-data marketplace/distribution partnerships; standards-body and methodology-credibility inbound; published research and reproducible methodology as the trust engine; integration with existing BI/risk platforms.
- **What this stream is NOT:** not a sale of influence over methodology (§5); not "free data" funded by hidden spreads elsewhere; the open methodology vs licensed software vs proprietary services vs third-party data costs are **clearly separated** in every offer (stub rule, retained for all streams 2–4).

### 1.3 Stream 3 — Enterprise integrations, licensing, and support

- **What it is:** bespoke enterprise integration of MTQΣ reference values and/or acceptance tooling into customer systems; software licensing (on-prem/customer-managed deployments of MTQΣ-adjacent tooling); premium support.
- **Paying customer:** enterprises — fintechs, banks, corporates — integrating MTQΣ-referenced data or the acceptance layer into their own products and workflows.
- **Deliverable:** implemented integration (against acceptance criteria); licensed software with versioning; support retainer (SLA tiers); training and documentation.
- **Pricing basis (candidates; adoption checkboxes §7):** implementation project fee; annual license fee; support retainer tiers (SLA-based); developer-days for change work.
- **Service costs:** professional-services payroll (solution engineers); support staffing; licensing-compliance work; travel; escalation engineering; QA for customer-specific deployments.
- **Gross-margin drivers:** staff utilization and leverage; **repeatability/productization** (bespoke integrations have structurally lower margin than productized ones); scope discipline; support automation; the license/PS mix.
- **Contractual obligations:** SLAs and acceptance criteria; IP ownership and work-product terms; liability caps and indemnities (professional-services exposure); change-order terms; non-solicitation; export-control/sanctions clauses; maintenance/version-support windows.
- **Compliance questions (for counsel):** professional liability for integration services; export controls and sanctions on software/service delivery; whether integrating payment rails triggers licensing for MTQΣ or the customer; data-protection in customer deployments.
- **Realistic path to acquisition (categories, no counts):** direct B2B sales to enterprises already expressing interest in basket-referenced valuation or acceptance; systems-integrator partnerships (they sell, MTQΣ enables); inbound from published methodology and documentation; conference/standards presence; conversion of Stream 2 subscribers needing deeper integration.
- **What this stream is NOT:** not a consulting engagement that grants any say in basket composition (§5 — contracts cannot buy methodology influence); not an endorsement of the customer's products.

### 1.4 Stream 4 — Research, methodology licensing, and permitted white-label services

- **What it is:** research publications and methodology documentation; **methodology licensing** (reproduction/derivative works of the published methodology and reference-index computation); **permitted white-label deployments** (a customer operates a branded instance of the reference-index service under license) — only where permitted by counsel and the licensing terms.
- **Paying customer:** index/data businesses, analytics vendors, research institutions, and fintechs wanting a branded or embedded reference value.
- **Deliverable:** licensed methodology artifacts (versioned); white-label deployment support; research reports and bespoke studies (clearly labeled as research, not investment advice).
- **Pricing basis (candidates; adoption checkboxes §7):** annual license; per-deployment license; per-redistribution-tier license; research sponsorship; bespoke-study fees.
- **Service costs:** research staff; computation infrastructure for licensed deployments; legal (license drafting, IP protection, brand review); per-licensee support.
- **Gross-margin drivers:** marginal cost of additional licensees (low for pure licensing, eroded by per-deployment support); IP defensibility; brand credibility — which depends on index quality and the honesty rules (a credibility failure destroys all four streams simultaneously — see §9 concentration).
- **Contractual obligations:** license scope and exclusivity (**PROPOSED: licenses are non-exclusive and never grant composition influence**); attribution requirements; audit rights; termination; warranty disclaimers (no investment advice; no guarantee of index representativeness beyond the published methodology and correction policy).
- **Compliance questions (for counsel):** whether licensing/white-labeling a reference index triggers **benchmark-administration obligations** (cross-ref Stream 2 flag); implied-endorsement/misrepresentation exposure in white-label use; IP law per jurisdiction; research-independence standards if research is sponsored.
- **Realistic path to acquisition (categories, no counts):** licensing outreach to index/data businesses; university and research-institution partnerships; open-methodology publication under an attribution license as the inbound engine; industry working groups and standards participation.
- **What this stream is NOT (mandate-critical):** **no sale of preferential access to unpublished monetary decisions** (weights, admission, retirement are announced only via the published process — never to paying clients first); **no secret client influence on basket weights**; no white-label implying MTQΣ endorsement of the client's products; the index methodology is **never priced or influenced by commercial relationships** (§5).

### 1.5 Stream comparison matrix (summary; all cells PROPOSED; none adopted)

| Field | Stream 1 — transaction/integration fees | Stream 2 — institutional subscriptions | Stream 3 — enterprise integration/licensing/support | Stream 4 — research/licensing/white-label |
|---|---|---|---|---|
| Paying customer | merchants / PSP-integrator partners / authorized banks on the acceptance layer | financial institutions, treasurers, asset managers, analytics firms | enterprises integrating reference values or acceptance tooling | index/data businesses, research institutions, fintechs wanting branded reference values |
| Deliverable | executed acceptance, orchestrated settlement + finality evidence, reconciliation reports, exception/refund handling | valuation APIs, index data feeds (six-value surface), treasury/reconciliation tools, risk dashboards, reporting | implemented integrations, licensed software, support retainers | methodology licenses, white-label deployments, research/bespoke studies |
| Pricing basis (candidates) | per-tx flat · ad valorem · volume tiers · integration fee (rates → D-13.8) | per-seat · per-call · volume tiers · flat tiers · redistribution licenses | project fee · annual license · SLA retainer tiers · developer-days | annual/per-deployment license · redistribution tiers · sponsorship · study fees |
| Dominant service cost | third-party rail/processing pass-throughs (`r_pass`) | upstream data licenses + API infrastructure | professional-services payroll | research staff + legal/IP |
| Margin driver | `r_pass`, scale vs fixed monitoring base, refund rate | data-license structure, support leverage, churn | utilization, productization, scope control | marginal licensee cost, IP defensibility, credibility |
| Decisive compliance question | money transmission / VASP / PSP characterization | data redistribution; benchmark-administrator regimes | professional liability; export controls | benchmark obligations; white-label misrepresentation |
| Existence precondition (today) | D-13.18/19 + REAL rails (none exist) + authority migration | productization + oracle remediation + redistribution licenses | first enterprise demand (none recorded) | methodology publication at production quality (deliverable 5) |
| Revenue today | **0** (VERIFIED absence) | **0** | **0** | **0** |

---

## 2. Scenario model — low / base / high (EXPLICIT PARAMETERIZED STRUCTURE; HYPOTHETICAL inputs)

**Reading rule (mandate compliance):** this section models low, base, and high scenarios **only with explicit assumptions and structural sensitivity analysis**, and invents **no customer numbers, trading volumes, fee rates, conversion rates, or profit forecasts**. The LOW scenario carries the only evidentiary value available (zero). BASE and HIGH are **placeholder structures**: their inputs must come from owner-commissioned validation (D-13.9 — willingness-to-pay validated with real prospective customers **before** expensive build-out) and never from documentation. Any numeric range shown below is a labeled modeling convention, not evidence.

### 2.1 Variable definitions (the editable model's symbol table — "assumption cells" per the stub)

**Revenue side (per period t):**

| Symbol | Meaning | Unit | Status |
|---|---|---|---|
| `N_i` | paying customers of stream i ∈ {1,2,3,4} | count | HYPOTHETICAL for base/high; `N_i = 0` is the only evidence-backed value |
| `ARPU_i` | average revenue per customer of stream i per period | currency/customer/period | HYPOTHETICAL; **no pricing has ever been tested** |
| `V_tx` | fee-bearing processed volume (Stream 1) | currency/period | HYPOTHETICAL; zero today (no rails exist — payment spec §1) |
| `F_tx` | blended Stream-1 fee rate applied to `V_tx` | fraction | **D-13.8 parameter** — never set here; code facts (0.10% mint etc.) are UNAPPROVED |
| `r_pass` | third-party pass-through cost share of Stream-1 gross fee | fraction | HYPOTHETICAL; contract-dependent |
| `ρ_refund` | refund rate on Stream-1 fees (failed transactions) | fraction | HYPOTHETICAL; D-13.8 default = full refund |
| `churn_i` | per-period customer loss rate, stream i | fraction | HYPOTHETICAL; no data exists |
| `CAC_i` | customer-acquisition cost, stream i | currency/customer | HYPOTHETICAL; no data exists |

**Cost side (per period t; §3 defines each):** `C_payroll` · `C_compliance` · `C_security` · `C_infra` · `C_data` · `C_support` · `C_custody` · `C_processing` · `C_conversion` · `C_settlement` · `C_refunds` · `C_other` — decomposed into fixed (`C_fixed`) and variable-per-unit components; `d_i` = direct variable cost of stream i (including Stream-1 pass-throughs, netted at the fee line).

### 2.2 Formula structure (symbolic; defines the model, sets no inputs)

```
GrossStream1_t      = V_tx,t · F_tx,t                          (disclosed transaction/integration fees)
NetStream1_t        = V_tx,t · F_tx,t · (1 − r_pass − ρ_refund) − C_var,1,t
Recurring_i,t       = N_i,t · ARPU_i,t        for i ∈ {2,3,4}  (subscriptions / licenses / PS)
Revenue_t (R_t)     = GrossStream1_t + Σ_{i=2..4} Recurring_i,t  (recognized when service provided; §0.1)
DirectCosts_t (D_t) = C_var,1,t + Σ_{i=2..4} d_i,t
Contribution_i      = Revenue_i − d_i ;  margin m_i = (Revenue_i − d_i) / Revenue_i
OperatingResult_t   = R_t − D_t − C_fixed,t                    ← THE OWNER'S IDENTITY (§0.1)
CAC payback (i)     = CAC_i / (ARPU_i · m_i) months            (recurring streams; meaningful only post-D-13.9)
Break-even          = the level(s) of (V_tx, {N_i·ARPU_i}) such that Σ_i Revenue_i·m_i = C_fixed
```

### 2.3 Scenario definitions

| Scenario | Definition | Input status | Evidentiary basis |
|---|---|---|---|
| **LOW** | `N_i = 0` ∀i; `V_tx = 0`; `OperatingResult = −C_fixed` per period | fully determined structurally; `C_fixed` = actual owner-funded cost structure (payroll/compliance/security/infra floor — §3) | **The only scenario with any evidentiary basis today**: no customers exist, no revenue exists, no rails exist (VERIFIED absence across the record; baseline §5 Stage G; payment spec §1). LOW is not a pessimism choice — it is the current state of the world. |
| **BASE** | hypothetical mid-case parameterization: `N_i, ARPU_i, V_tx, r_pass, churn, CAC` at placeholder values **to be supplied by owner-commissioned validation (D-13.9), not by this document** | HYPOTHETICAL — **no market evidence exists**; no pricing has been tested; no market analysis has been performed (§6) | none (by explicit statement) |
| **HIGH** | hypothetical high-case parameterization, same provenance rule | HYPOTHETICAL — same | none (by explicit statement) |

**What BASE/HIGH require before they can carry numbers (D-13.9 validation inputs):** prospective-customer evidence (willingness-to-pay interviews/LOIs per stream); real rail-cost quotes for `r_pass`; upstream data-license quotes for `C_data`; counsel scope per jurisdiction; authority migration complete. Until then, **any BASE/HIGH figure would be invented — which the mandate forbids and this document does not do.**

### 2.4 Assumption table (all rows HYPOTHETICAL until D-13.9; each is an explicit scenario assumption)

1. Stream existence: the Gate B model (D-13.3…D-13.7) leaves the stream's operations live (e.g., Stream-1 protocol fees exist only if payment-gated issuance/acceptance exists — file 1 §2.2).
2. Authority migration (Task 12 D4/D5/D8 + RELEASE-GRANTS) is complete before any live operation.
3. Counsel opinions are obtained per target jurisdiction before any offer (none exist; no jurisdiction list exists).
4. Oracle remediation (multi-source independence) supports the data-quality claims any Stream 2–4 product would implicitly make (currently NOT met — `DEVELOPER-REPORTED`).
5. Upstream data licenses with commercial redistribution rights are obtainable at some cost `C_data` (UNVERIFIED — flagged, never assumed).
6. Fee rates are whatever D-13.8 approves; `F_tx` in scenarios is a placeholder cell.
7. No customer, volume, or conversion-rate assumption in BASE/HIGH is derived from this repository — because none exists in the record.

### 2.5 Sensitivity analysis (structural — which parameters drive the operating result most)

- **Linearity:** `OperatingResult` is linear in each revenue driver — `∂OP/∂N_i = ARPU_i·m_i`, `∂OP/∂(V_tx) = F_tx·(1 − r_pass − ρ_refund) − c_var,1`. The parameters with the largest products (ARPU × margin; rate × net-of-pass-through) dominate. With everything else unknown, **structure is the only honest sensitivity statement available**.
- **Pass-through share `r_pass`:** Stream 1's contribution is most sensitive to third-party cost share — a one-percentage-point change in `r_pass` moves contribution by `V_tx·F_tx·0.01`, i.e., it can consume the entire margin at high pass-through. Rail selection is therefore a margin decision, not just a risk decision.
- **Fixed-cost leverage:** `C_fixed` (payroll, compliance, security, infra floor, fixed data licenses) sets the break-even scale. The larger the fixed base, the more revenue concentration in any single stream is required to break even — directly coupling §9's concentration risk to cost structure.
- **Concentration:** if stream j supplies share `s_j` of revenue, stream-j parameter variance dominates operating-result variance. Model consequence: report per-stream contribution alongside any consolidated figure.
- **Elasticity unknown:** price elasticity of demand is UNKNOWN (no pricing tests — §6); therefore D-13.8 rate changes must be treated as disclosed experiments with published before/after fee-transparency reporting (file 1 §4.1), never as assumptions inside scenarios.
- **Churn/CAC:** recurring-stream viability hinges on `CAC_i/(ARPU_i·m_i)` payback; with no customers, churn and CAC are pure unknowns — flagged so no scenario silently assumes favorable values.

### 2.6 Model operation — how inputs enter after D-13.9 (provenance workflow; PROPOSED)

1. **Owner approves D-13.9** (validation process + pricing-basis checkboxes §7) and commissions the validation work per stream.
2. **Validation produces inputs:** `ARPU_i` evidence (willingness-to-pay interviews, quotes, LOIs); `CAC_i`/`churn_i` from real acquisition/retention data; `r_pass` from real rail/processor quotes; `C_data` from real license quotes; `F_tx` from the D-13.8-approved schedule; `C_fixed` from the actual cost ledger (which must first exist — §8).
3. **Each input enters the model with a provenance label** (source, date, method, owner-approver); inputs without provenance are rejected — the anti-invention gate for the whole model.
4. **Scenario outputs are re-labeled** from HYPOTHETICAL to SCENARIO-ESTIMATE only when every input in the computation carries provenance; until then all outputs print with the LOW reality anchor (§6) side by side.
5. **Re-validation cadence** and model versioning are owner decisions (D-13.9 sub-item); every published scenario references its model version and input-provenance manifest.

### 2.7 Mandate-required statements (self-audit)

The mandate's requirement list for scenarios is satisfied as follows: low/base/high modeled **only** with explicit assumptions (§2.3–2.4) and sensitivity analysis (§2.5); **no** customer numbers, trading volumes, fee rates, conversion rates, or profit forecasts are invented (§2.1 placeholders; §6 honesty); all actual costs deducted (§3); token issuance/appreciation/gas excluded from revenue everywhere (§4). The symbol table §2.1 is the stub's "editable financial model with assumption cells"; all outputs are labeled SCENARIOS until validated.

---

## 3. Cost model — the full deduction list (definitional basis + cost-driver structure)

**The identity restated: Operating result = Σrevenue − Σcosts.** Every row below is a deduction in the owner's formula. "Current anchor" cites existing in-repo cost patterns (all `DEVELOPER-REPORTED`/`VERIFIED` as labeled); anchors are examples of the cost class, not quotes.

| # | Cost category | Definitional basis | Cost-driver structure | Current anchor (if any) |
|---|---|---|---|---|
| 1 | **Payment processing** | third-party PSP/processor/rail fees for receiving customer money in Stream-1 services | per-transaction + bps-of-value + monthly minimums; tiered by volume | none contracted (rails SIMULATED/NOT CONNECTED — payment spec §1) |
| 2 | **Conversion** | FX/stablecoin conversion fees and spread when moving between settlement assets | per-conversion fixed + spread % of value | cost patterns exist in `marp.ts` (router fee 0.1% `:136` VERIFIED; gas cost modeling `:117-142`) — third-party costs, never revenue |
| 3 | **Settlement** | bank/bridge/settlement-window fees, finality-message and reconciliation costs per settled obligation | per-settlement-event + per-batch; fixed per rail integration | none (settlement machinery SIMULATED; V3 obligations undeployed) |
| 4 | **Security** | audits, monitoring/scanning, key ceremonies and rotation, incident response, penetration tests, independent reviewer (CKPT-9) | mostly fixed + per-audit/per-incident | real costs already incurred as engineering time (Task 12 remediation, scanner gate — `DEVELOPER-REPORTED`); independent reviewer NOT ENGAGED |
| 5 | **Custody** | custodian/attestation costs for any custody-adjacent service | per-asset-under-care + attestation cadence | **no custody exists today** (V3 stability-pool sole-custody design UNDEPLOYED; three-book Book A SIMULATED); must be priced before any custody-adjacent offer is contemplated |
| 6 | **Data licensing** | upstream market-data licenses (FX/gold/CPI feeds) AND commercial-redistribution rights for API resale | fixed subscriptions + per-seat/per-customer royalties | pilot feeds are free/public (FRED, Frankfurter, gold-api.com, Yahoo — `DEVELOPER-REPORTED`); **commercial-redistribution terms UNVERIFIED** — flagged |
| 7 | **Infrastructure** | RPC nodes, API hosting, database, CI, monitoring, staging | fixed floor + usage tiers | real today (Vercel/Koyeb/Turso/6 workflows — `DEVELOPER-REPORTED`, infra census) |
| 8 | **Compliance** | counsel opinions, licensing fees, AML tooling, audit support, regulatory reporting | fixed + per-jurisdiction + per-license | none (no counsel engaged, no jurisdiction list — `economic-model-options.md` §12) |
| 9 | **Support** | SLA staffing per product tier across all streams | per-customer cohort + per-incident | none (no customers) |
| 10 | **Payroll** | engineering, methodology research, operations, management — listed explicitly per the owner's "all operating costs" | fixed (headcount) + variable (overtime/contractors) | implicitly real (the program has engineering effort); no cost ledger exists (`NOT IMPLEMENTED`) |
| 11 | **Refunds** | fee refunds on failed transactions (D-13.8 default: full refund), SLA credits, chargebacks | failure rate × fee + credits | none (no fee is collected anywhere; refund machinery NOT IMPLEMENTED) |
| 12 | **Other actual costs** | insurance, professional services (accounting/legal), marketing, travel, bad-debt on receivables, FX realization losses on volatile-denominated fees | miscellaneous fixed/variable | none recorded (no cost ledger exists) |

**Classification and identity:** each category decomposes as `C_k = C_k^fixed + C_k^var` with per-unit drivers where applicable; `C_fixed = Σ_k C_k^fixed`; `D = Σ_i d_i` (variable direct). Then:

```
OperatingResult = [ V_tx·F_tx·(1 − r_pass − ρ_refund) + Σ_{i=2..4} N_i·ARPU_i ] − Σ_i d_i − C_fixed
Break-even (symbolic): Σ_i Revenue_i·m_i = C_fixed   ⇔   the revenue mix at which contribution equals the fixed base
```

**Presentation discipline (applies to all rows):** pass-through costs netted at the fee line (never grossed); refunds netted from revenue; volatile-denominated fees realized on conversion with conversion costs deducted; outstanding fee receivables/obligations reported separately from realized revenue (stub profit-measurement list: gross collected fees by asset/service · refunds/chargebacks · third-party costs · realized operating revenue · net operating result · outstanding obligations/fee receivables — adopted as the reporting field set).

---

## 4. What revenue is NOT (the four prohibitions — verbatim rules; cross-ref `fee-and-commercial-revenue-model.md` §3)

1. **"Do not count token issuance as business revenue merely because tokens were created."** MTQ minted into any wallet — treasury, genesis pots, self-custody — is never revenue. The on-chain fact that `genesisMint` pots exist (`DEVELOPER-REPORTED`, baseline §3) creates no income.
2. **"Do not count hypothetical token appreciation or unrealized token value as operating profit."** **Token-appreciation is explicitly excluded from operating profit.** Unrealized token value may appear only, if the owner ever adopts such a policy, as a labeled non-operating memorandum item — never inside the §0.1 identity.
3. **"Do not count network gas paid to validators as protocol revenue."** Gas, router/aggregator fees, relayer and LP costs are third-party costs (deductions or netted pass-throughs).
4. **Reference value is not income.** The published reference value is a measurement; treasury tokens are never counted at an assumed reference value as cash income; no fee, price, or "backing" language may imply otherwise (forbidden-claims register, `claims-and-honest-status.md`).

Additionally (stub fairness rules, retained): customer funds held in the course of settlement are liabilities — **never revenue and never working capital** without lawful, disclosed authorization; minted tokens are never income; no yield/appreciation/stable-redemption promises are priced into any stream.

---

## 5. Governance & conflict separation (cross-ref `fee-and-commercial-revenue-model.md` §5, D-13.18, D-13.24)

- **The index methodology must never be priced or influenced by commercial relationships.** Methodology decisions (eligibility, weights, envelopes, admission/retirement, publication) belong to the methodology publisher under governance disjoint from the operating company's commercial decisions (pricing, discounts, enterprise contracts, marketing). No person holds both a commercial decision role and a methodology decision role (extends the payment-operator/index-publisher disjointness of D-13.18 to all four streams; adoption requested as **D-13.24**).
- **No preferential access:** unpublished monetary decisions are never sold, previewed, or hinted to paying clients (Stream 4 guard, §1.4). **No client influence on basket composition**, disclosed or not. Commercial contracts cannot buy, imply, or be read to buy composition influence.
- **Related-party rules:** arm's-length terms, prior disclosure, owner approval, annual related-party register review by the independent reviewer (none engaged — CKPT-9 pending).
- **Reporting separation:** commercial revenue/cost reporting is kept separate from monetary-system reporting (three-book Book A is the ancestor concept — SIMULATED today); fee-transparency reports (file 1 §4.1) disclose gross fees, refunds, pass-throughs, and net fee revenue without ever conflating operating cash with any basket/index ledger.
- **Current reality (honesty):** the separation holds today **only by absence** — no councils (G9 NOT CONDUCTED), no customers, no methodology live. The controls must exist before the first commercial contract.

---

## 6. Honest status (no hedging)

1. **NO customers exist** — none, in any stream; no LOI, no pipeline record, no customer-discovery artifact exists anywhere in the record (VERIFIED absence; baseline §5 Stage G: "no customer-evidence artifacts exist").
2. **NO revenue exists** — zero is the only revenue figure with evidentiary basis; no fee is collected anywhere (testnet-only estate, V3 feeWallet uncollectable, nothing production-deployed — file 1 §1).
3. **NO pricing has been tested** — no willingness-to-pay data, no price experiment, no competitive quote exists; `ARPU_i`, `CAC_i`, `churn_i` have no empirical values.
4. **NO market analysis has been performed** — no market sizing, segmentation, or addressable-market study exists in the record; none is invented here.
5. **No operating legal entity, license, counsel engagement, or real counterparty exists anywhere in the record** (`economic-model-options.md` §4 fact 6) — the "operating company" in this model is a future construction whose costs and obligations are not yet contracted to anyone.
6. **All scenarios are hypothetical structures awaiting owner approval (D-13.9) and real-world validation; nothing here is a forecast.** LOW (zero revenue, fixed-cost burn) is the only scenario that describes today. The owner's formula applied to today reads: `OperatingResult_today = 0 − C_fixed_actual` — a number the owner must fund deliberately.

---

## 7. Owner approvals required (all OPEN — checkboxes unchecked)

- [ ] **D-13.9 (existing)** — commercial model validation for Streams 1–4: commission/accept the willingness-to-pay validation process (prospective-customer evidence **before** expensive build-out — stub Stage G rule), and the provenance rule for BASE/HIGH scenario inputs (§2.3). *Approver: Owner (business).*
- Pricing-basis adoption per stream (sub-checkboxes of D-13.9; none is adopted by this document):
  - [ ] **S1-basis** — Stream 1 transaction/integration-service fee bases (per-transaction flat / ad valorem / volume tiers / integration fee; success-fee policy under §1 caution) — *rate values remain D-13.8*.
  - [ ] **S2-basis** — Stream 2 subscription bases (per-seat / per-call / volume tiers / flat tiers / redistribution licenses).
  - [ ] **S3-basis** — Stream 3 bases (implementation fee / license / support retainer tiers).
  - [ ] **S4-basis** — Stream 4 bases (annual license / per-deployment / redistribution tiers / research sponsorship; white-label permission scope).
- [ ] **D-13.8 (existing; file 1 §9)** — every fee rate, basis, recipient, treasury/sweep parameters, exemptions, refund-on-failure default, absolute cap, change governance. *Writing any rate anywhere in this two-file set approves nothing.*
- [ ] **D-13.24 (NEW, opened by file 1 §9)** — commercial–methodology separation & conflict-of-interest policy (§5 here).
- Interacting OPEN decisions (not re-opened): **D-13.3…D-13.7** (which streams can exist at all), **D-13.18/D-13.19** (payment governance/settlement parameters), **D-13.1** (uploaded key disposition), the Task 12 authority chain (OWNER-ATT-1 → … → CKPT-9, RELEASE-GRANTS) which precedes any live commercial operation, and G9-governance-body creation (none exists).

---

## 8. What has NOT been tested / implemented (explicit)

- No billing, invoicing, CRM, or payment-processing contract for any stream exists (`NOT IMPLEMENTED`).
- No pricing experiment, customer-discovery interview, LOI, or market study has been performed or recorded (none; §6).
- No revenue-recognition policy document, accounting system, or cost ledger exists; no fee-transparency report has ever been produced.
- No Stream 2–4 product is productized: no valuation API product, no data-feed distribution, no enterprise licensing program, no white-label deployment exists (`NOT IMPLEMENTED`; Stage G engines "B/C/D" of the stub).
- Stream 1 has no real rails (payment spec §1 inventory: pilot bank SIMULATED; MBG gateway chain-read-only with testnet bypass; stablecoins = MockUSDC; CBDC NOT CONNECTED); the registry/state machine/quote/settlement machinery of deliverable 6 is PROPOSED, NOT IMPLEMENTED.
- The v3.0 fee architecture of file 1 (fee ledger, treasury, sweep, disclosure surfaces, exemption machinery) is PROPOSED, NOT IMPLEMENTED; V3 `feeWallet` remains obligation-only with no sweep; V2/v1.2 fees remain commingled.
- Scenario math has never been run with real inputs (there are none); the LOW scenario's `C_fixed` cannot yet be computed from any ledger (no cost ledger exists).
- Foundry suites UNVERIFIABLE in this sandbox (no forge); canonical-invariants last recorded PASS at Task 12 (zero source changes since), UNVERIFIED this cycle; no Stage K commercial/fee test exists.
- Zero on-chain actions, zero code changes, zero commits, zero key handling in producing this document; `upload/` and `.env` were never opened; no secret-shaped file was read.

---

## 9. Risks (PROPOSED analysis; none claimed mitigated)

| # | Risk | Severity | Note / structural mitigation (all OPEN) |
|---|---|---|---|
| UR-1 | **Concentration risk — one stream dominates.** If a single stream supplies most revenue, its parameter variance dominates the operating result (§2.5), and its failure mode becomes existential; the most fragile candidate is Stream 1 (depends on rails that do not exist and regulation that is unscoped). | HIGH | per-stream contribution reporting (§2.5); no cross-subsidy of methodology by any single client (§5) |
| UR-2 | **Regulatory risk per stream.** S1: money-transmission/VASP/PSP characterization, AML program obligations. S2: data-redistribution licensing; benchmark-administrator regimes if the index gains usage (flagged `economic-model-options.md` D7/M4). S3: professional liability, export controls/sanctions. S4: IP, benchmark obligations, white-label misrepresentation. All jurisdiction-dependent; **no jurisdiction list exists**; every question is for counsel — never answered in this document. | HIGH (unscoped) | counsel engagement per jurisdiction precedes any offer (§2.4 assumption 3) |
| UR-3 | **Conflict risk — commercial pressure on methodology.** A paying client's preference for a composition outcome is the mandate's named failure mode; even unfunded, the *appearance* of purchasable influence destroys index credibility and with it Streams 2–4. | HIGH | §5 separation; D-13.24; T-PAY-01/T-FEE-06 separation tests (planned only) |
| UR-4 | **Sustainability risk — fixed-cost burn under zero revenue.** LOW is the current state; the owner funds `C_fixed` indefinitely until validation-driven revenue exists; premature build-out before willingness-to-pay evidence (the stub's rule) converts this into large sunk cost. | HIGH | D-13.9 validation BEFORE build; staged fixed-cost commitments |
| UR-5 | **Fee-income dependence on volumes that do not exist.** Any plan that treats current code fee rates (0.10%/ladder/0.20%) as expected income is assuming a phantom asset: no production deployment, no rails, no users; V3's fee ledger is uncollectable (no sweep). | HIGH | §6 honesty; LOW scenario mandatory in any internal plan |
| UR-6 | **Hidden-spread / double-charging reputational risk** if composite operations (payment + conversion + settlement + issuance) are not itemized exactly (file 1 §2.1 rules 2–3; payment spec §6.1/T-PAY-03). | MEDIUM–HIGH | quote line-item design + tests (planned only) |
| UR-7 | **Token-appreciation temptation.** Under sustained operating losses, pressure will arise to count treasury token appreciation as performance; the mandate prohibition exists precisely for this moment. | HIGH (governance) | §4 rule 2 absolute; §0.1 identity; audit hook via fee-transparency reporting |
| UR-8 | **Upstream data-license dependency (S2/S4).** Commercial-redistribution rights for FX/gold/CPI data may be unobtainable, delayed, or priced so that `C_data` consumes Stream-2 margin (`r_pass`-analog inside subscriptions); UNVERIFIED today. | MEDIUM–HIGH | obtain license quotes during D-13.9 validation, before productization |
| UR-9 | **White-label endorsement confusion (S4).** A licensee's use may imply MTQΣ endorsement of the client's products or of the client's own instruments, creating misrepresentation exposure. | MEDIUM | license terms (§1.4): attribution, disclaimers, brand-review; counsel |
| UR-10 | **Credibility coupling.** All four streams monetize the same underlying trust in the published methodology; an index-quality failure (oracle incident, methodology error, correction-policy breach) degrades all streams simultaneously — diversification across streams does not diversify this factor. | HIGH | deliverable 10 emergency states; deliverable 5 publication/revision policy; Stage J validation |

---

## 10. MANDATE-004 §9 clause-mapping self-audit (for orchestrator review)

| §9 clause (requirement) | Where satisfied (this file + deliverable 8 together) |
|---|---|
| Create `audit-work/task13/revenue-and-unit-economics.md` | this file (exact filename, NEW) |
| Evaluate the four revenue streams **separately** | §1.1–§1.4 + comparison matrix §1.5; fee architecture in `fee-and-commercial-revenue-model.md` §2 |
| Per stream: paying customer · deliverable · pricing basis · service costs · gross-margin drivers · contractual obligations · compliance questions · realistic path to customer acquisition | all eight fields present in each of §1.1–§1.4 |
| Transparent, disclosed transaction & integration-service fees where services are actually provided | §1.1 (payment acceptance, settlement orchestration, reconciliation tooling; cross-refs payment spec §6.1 fee line-items and D-13.19) |
| Institutional subscriptions (valuation APIs, reference-index data, treasury tools, reconciliation, risk dashboards, reporting) | §1.2 |
| Enterprise integrations, licensing, and support | §1.3 |
| Research, methodology licensing, and permitted white-label services | §1.4 |
| Do not count token issuance as business revenue | §4 rule 1 (also file 1 §3) |
| Do not count token appreciation / unrealized value as operating profit | §4 rule 2 (explicit exclusion from operating profit) |
| Do not count network gas paid to validators as protocol revenue | §4 rule 3 |
| Do not invent customer numbers, volumes, fee rates, conversion rates, or profit forecasts | §2.1–§2.3 (symbolic parameters; LOW=0 only); §6 |
| Low / base / high scenarios only with explicit assumptions and sensitivity analysis | §2.3–§2.5 (structure + HYPOTHETICAL labels) |
| Deduct payment processing, conversion, settlement, security, custody, data, infrastructure, compliance, support, payroll, refunds, other actual costs | §3 rows 1–12 + the §0.1 identity |
| Avoid hidden spreads, double charging, undisclosed conflicts, fees compromising basket independence | §1.1 (spread itemized, no double charge — payment spec cited); §5; file 1 §2.1 rules 2–4 |
| Maintain separation between operating-company commercial decisions and basket-determining methodology | §5 + file 1 §5; adoption checkbox D-13.24 |
| Present all proposed fee rates for owner approval; none approved by this mandate | §7 (D-13.8/D-13.9 + S1–S4 basis checkboxes); file 1 §9; both headers state no rate is approved by being written |

---

## 11. MANDATE-006 §14 reconciliation — added 2026-10-22 (five-stream mapping, fair-economics fields, zero baseline)

### 11.1 The five MANDATE-006 §14.1 streams vs this document's four streams (reconciliation, not duplication)

| MANDATE-006 stream (§14.1) | Where covered here | Status |
|---|---|---|
| **Institutional reference-index data** — subscriptions to published index values, component weights, historical series, methodology updates, data feeds | §1.2 (institutional subscriptions) + §1.4 — the index-data product family | `PROPOSED` |
| **Valuation and treasury APIs** — reference-value calculation, portfolio/treasury analytics, reconciliation, reporting, data export | §1.2 + §1.3 (enterprise integrations) | `PROPOSED` |
| **Risk and research products** — purchasing-power reports, currency/gold attribution, exposure analytics, stress reports, methodology licensing | §1.4 (research, methodology licensing, white-label) | `PROPOSED` |
| **Institutional software and integration** — payment adapters, treasury workflows, payment reconciliation, enterprise analytics, approved white-label implementations | §1.3 + §1.1 (integration-service fees where services are actually provided) | `PROPOSED` |
| **Transparent service fees** — disclosed charges for actual payment, integration, issuance, or other services **where permitted and supported by the selected operating model** | §1.1 (+ `fee-and-commercial-revenue-model.md` §2) | `PROPOSED` — all rates UNAPPROVED (D-13.8/D-13.9 OPEN) |

**Prohibitions restated (§14.1, verbatim effect):** do not charge a redemption fee for a redemption function that does not exist (none is charged anywhere today; none may be added while D-13.7 remains unresolved with no facility). Do not imply that paying a service fee purchases stability, appreciation, or a claim on basket assets.

### 11.2 Commercial independence (§14.2) — coverage check

- The methodology that determines currency eligibility, gold allocation, and basket weights is protected from commercial influence: §5 (governance & conflict separation; D-13.18 separation invariant + D-13.24 conflict-of-interest policy). Commercial clients must not be able to buy a preferred index position, alter their currency's score, or pay for a favorable weight — encoded in §5 and the payment-spec §2 invariant (payment volume never determines weights/eligibility).
- **Operational revenue accounting is separate from any token supply or monetary-index calculation:** §0.2 scope rule + `three-book-separation.ts` design + the §4 prohibitions (minted tokens ≠ revenue). Appropriate records for customer funds, service fees, operating capital, obligations, and expenses: §3 cost model + §0.1 identity.

### 11.3 Fair-economics field check (§14.3 — per stream: paying customer · deliverable · pricing model/rate · cost to deliver · gross-margin assumptions · settlement & third-party costs · data/infra/security/compliance/support/personnel · refunds/disputes/outstanding obligations · customer-acquisition assumptions · legal/jurisdictional · conflicts & controls)

All eleven fields are documented per stream in §1.1–§1.4 (customer/deliverable/pricing/costs/margins/legal/conflicts per stream), §2 (scenario/sensitivity structure with CAC-class assumptions in the symbol table), §3 (the full cost-deduction basis: settlement, third-party, data, infrastructure, security, compliance, support, personnel, refunds/disputes/obligations rows), and §9 (risks incl. disputes/refunds). **Gap found: none structural.** Every field remains `PROPOSED`/HYPOTHETICAL until D-13.9.

### 11.4 The identities and the zero baseline (§14.3, restated verbatim-effect)

`Revenue = actual fee-bearing activity + subscriptions + integration/licensing revenue` · `Operating result = revenue − all operating costs` (§0.1, adopted verbatim and made operational). Do not count token issuance as revenue (§4 rule 1); do not count hypothetical appreciation or unrealized token value as operating profit (§4 rule 2); do not count gas paid to validators as protocol revenue (§4 rule 3). **Zero remains the only evidence-backed commercial baseline** — no paying customers, revenue, or costs are demonstrated (§6); low/base/high scenarios are presented only with explicit hypothetical assumptions (§2.3–§2.4), and the LOW arm is fixed at zero by evidence. The operating company may sell software, data, and integration services — it must not influence the monetary methodology to benefit commercially (§5).

---

**TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED**
