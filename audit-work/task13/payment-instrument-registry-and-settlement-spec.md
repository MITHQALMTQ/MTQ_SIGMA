# MTQΣ — TASK 13 · Payment-Instrument Registry & Settlement Specification (deliverable 6, Stage E)

**STATUS: PROPOSED v1 — NOT APPROVED, NOT IMPLEMENTED.** This document is a design proposal with alternatives for owner decision. No instrument is accepted, no rail is connected, and no settlement capability exists or is implied by anything below.
**Updated 2026-10-22 (MANDATE-006 cycle):** §14 added — reconciliation with MANDATE-006 §7 (stablecoin/CBDC-funded issuance), including the §7.7 payment-funded-issuance vs no-automatic-minting conflict and its precise alternatives (**decision D-13.27, opened, OPEN**). Nothing in §14 alters the PROPOSED status of anything else in this document.
**Revised 2026-10-22 (MANDATE-007 cycle, §2):** §14.6 rewritten as the corrected D-13.27 decision record — the owner's stablecoin- and eligible-CBDC-funded primary-issuance requirement is recorded as **established product direction** (not an option), an **8-stage controlled issuance process** is proposed, the no-unauthorized-minting safeguard is explicitly separated from the existence question, open implementation decisions (settlement timing, reversals, failure recovery, issuance transaction boundaries) are **kept OPEN**, and §14.3/§14.4/§14.7 gained non-production prototype cross-references (evidence/issuance-state-machine/). **D-13.27 remains OPEN / NOT APPROVED.**
**Revised 2026-10-23 (delegated-adoption cycle, Task M8-2b):** §14.6 **REVISION 2** records the owner-delegated executive adoption of the D-13.27 authorization model (**ALT-4 — hybrid + periodic attestation**) and its four sub-decisions plus the D-13.8 fees / §14.5 quote-policy **FORM** — each labeled **ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION** (full rationale and the verbatim D-13.6 exception clause in §14.6; delegation record: `owner-directive-2026-10-23-delegated-execution.md` §1–§2). §14.7 gained the corresponding status line. Adoption confers implementation direction only — **no economic value is production-approved**, and the owner retains the right to revisit.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

Evidence legend (README §"Working rules"): `VERIFIED` (independently reproduced this session, cited) · `DEVELOPER-REPORTED` (prior in-repo work, cited) · `SIMULATED` (synthetic/reference data, labeled) · `PROPOSED` (design requiring approval) · `UNVERIFIED` · `NOT IMPLEMENTED`.

Mandate compliance target: MANDATE-004 §7 ("Separate the payment layer from basket composition") — every clause of that section is mapped in §12.

---

## 0. Purpose & scope

Define, as a **PROPOSED** design: (a) a payment-instrument registry that is **independent of the monetary reference basket**; (b) an instrument lifecycle state machine with defined deciders, evidence, and notice; (c) settlement-flow requirements (quote, finality, refunds, idempotency, reconciliation, exceptions); (d) the **separation invariant** that payment volume never determines currency eligibility or basket weights; (e) the honest current state of all payment-adjacent machinery (SIMULATED / NOT CONNECTED labels); (f) tests required (never claimed as run); (g) owner approvals required.

Out of scope: basket constituency/weights (deliverable 4), issuance/burn economics (deliverable 7), fee *rates* (D-13.8, deliverable 8), oracle failure policy (deliverable 10 — cross-referenced where settlement consumes oracle output).

---

## 1. Current state — what exists today (honest inventory)

- **No payment-instrument registry exists.** `VERIFIED`. The only registry is the asset registry whose members ARE basket instruments (`src/lib/mtq/registry.ts:57-115`): USDC/USDP/USDT/EURC `ACTIVE`, GBP/JPY/CNY placeholders `WATCH` with `issuerId "TBD"`, PAXG/XAUT `ACTIVE`. Its 8 admission criteria (`registry.ts:40-48`) — issuer authorization, redemption right, custody, sanctions policy, contract audit, liquidity ≥$1M 24h DEX volume, ≥2 independent oracle feeds, issuer ≤30% concentration — are **reserve/basket** criteria, not payment-acceptance criteria. Conflating them is the exact error the mandate §7 forbids.
- **Bank machinery is institution-level and SIMULATED.** `VERIFIED`. `src/lib/mtq/bank-registry.ts:57-70` holds exactly one record, "Pilot Bank A" at the well-known Hardhat/Foundry default account #1 `0x71C7656EC7ab88b098defB751B7401B5f6d8976F` (`bank-registry.ts:52-57` states it is NOT a real bank — a deterministic dev key), jurisdiction US, `isAuthorized: true`, **dailyMintCap $1,000,000**, runtime-set `authorizedAt`. This is SIMULATED reference data. The file's own header (`bank-registry.ts:13-20`) states the on-chain `bankRegistry` mapping of the undeployed V3 contract is the intended source of truth and production banks require 7/7 Constitutional-Council authorization.
- **MBG gateway exists, is chain-read-only, and has three auth paths including a testnet bypass.** `VERIFIED`. `src/app/api/mbg/mint-request/route.ts`: HMAC-SHA256 signature over `(bank, timestamp, nonce, rawBody)` with a ±60s window (`:102-117`, secret `MBG_HMAC_SECRET`), OR SHA-256 API-key match (`:89-99`), OR **`MBG_TESTNET_BYPASS=true` pilot flag** admitting any registered pilot bank with no credentials (`:81-86`). The route **explicitly does NOT call the chain** (`:17-21`); the `MBG_TESTNET_AUTO_SUBMIT` keeper path exists **only in a comment — no auto-submit code exists anywhere** (`DEVELOPER-REPORTED`, Stage A infra census). The route validates payload schema incl. future `expiry` and `nonce` (`:346-349`), checks registry authorization, jurisdiction match and daily cap (`:163-192`), persists `BM01_PENDING` to the DB fail-soft (`:282-304`), and returns a deterministic SHA-256 `requestId` over canonical fields (`:353-369`). Its 7-layer finality mirror hardcodes `protocolState: "NORMAL", reserveRatio: 1.30, oracleHealthy: true` at request time (`:246-268`) — an honesty caveat, not live evidence.
- **Settlement finality machinery is code-level only.** `DEVELOPER-REPORTED`. `src/lib/finality-before-mint.ts:15-33`: 7 enforcement layers (L1 API · L2 WORKFLOW BM-01..16 · L3 POLICY · L4 AUTHORIZATION · L5 LEDGER · L6 DATABASE TX · L7 SMART CONTRACT); 10 §84 bypass routes tested blocked at code level; honest state `finalityProductionReady: false`, risk "MITIGATED_AT_CODE_LEVEL — NOT MITIGATED_AT_PRODUCTION_LEVEL".
- **Three-book machinery is a SIMULATED reference ledger.** `VERIFIED`. `src/lib/three-book-separation.ts:135-188`: Book A (corporate operating cash — "SIMULATED — operating cash, NOT bank-side MTQ backing"), Book B (bank MTQ obligation — "Reference-Responsible-Bank (SIMULATED)"), Book C (participant position — "SIMULATED"), module `v25.2-three-book-separation-1.0`.
- **Systemic-exposure engine is design-time on SIMULATED reference data.** `VERIFIED` header: `src/lib/systemic-exposure-engine.ts:18-27` — `systemicRiskMonitoringLive: false` ("NO live institutional feeds"); it does not poll live bank balances, custodian holdings, or oracle feeds.
- **Bank-default framework specified, not contractually validated.** `DEVELOPER-REPORTED`. `src/lib/bank-default-resolution.ts`: 8-state lifecycle, 11 contractual questions, honest state `bankDefaultContractValidated: false` (`:504-522`); "MITHQAL NOT guarantor" (`:62`).
- **V3 settlement is an off-chain event obligation.** `VERIFIED`. The undeployed `contracts/MTQSigmaV3.sol:1054-1146` `redeem()` burns MTQ and emits `RedeemSettlement` (`:243`); the bank settles in sovereign currency off-chain; the contract never pushes USDC. SOURCE-READY, NOT DEPLOYED (`DEVELOPER-REPORTED`, baseline §2).
- **Stablecoin "flows" on testnet are MockUSDC-class test tokens** (6 decimals), not real stablecoins. `DEVELOPER-REPORTED` (baseline §2/§5 Stage E). **No real stablecoin, CBDC, or bank-rail settlement exists anywhere. VERIFIED by the Stage A census: exactly 3 DB-writing routes, 0 signing routes, one guarded keeper.**
- **CBDCs: NOT CONNECTED.** No authorized interface, technical standard, or test environment exists in this repository for any CBDC. `VERIFIED` (absence confirmed by the Stage A source/infra censuses). No CBDC integration may be claimed.
- **Idempotency/expiry primitives exist in the simulate layer**: `quoteExpiresAt` guards on mint/redeem trials and min-out slippage guards (`pilot-state.ts:652-663`); nonce+expiry on MBG requests. `VERIFIED`. These are seed primitives for this spec, currently SIMULATED-path only.

**Label summary (current capability, all SIMULATED / NOT CONNECTED):** pilot bank = SIMULATED; MBG gateway = real code, SIMULATED purpose, no chain calls; settlement finality = code-level, not production; three-book / systemic exposure / bank-default = SIMULATED reference data; stablecoins = test tokens only; CBDCs = NOT CONNECTED; real bank rails = NOT CONNECTED.

### 1.1 Payment-adjacent component inventory (file-cited honesty labels)

| Component | File | Function today | Label |
|---|---|---|---|
| Bank registry (institution-level) | `src/lib/mtq/bank-registry.ts:57-70` | One pilot bank, $1M/day cap, lookup/cap helpers | SIMULATED (reference data; placeholder address) |
| MBG mint-request gateway | `src/app/api/mbg/mint-request/route.ts` | Auth (HMAC/API-key/bypass), L1/L3 checks, DB persist, BM-07/08 ack | Real code; **no on-chain call**; testnet bypass flag; purpose SIMULATED |
| Banks API (public list) | `src/app/api/banks/route.ts:26-46` | Exposes authorized banks + caps; bank-side KYC/KYB declared out-of-scope | Read-only; data SIMULATED |
| 7-layer finality engine | `src/lib/mtq/finality.ts` + `src/lib/finality-before-mint.ts` | L1–L7 gates + 10 bypass-route tests | Code-level enforced; production UNVALIDATED |
| Three-book separation | `src/lib/three-book-separation.ts` | Book A/B/C reference ledger + reconciliation helpers | SIMULATED |
| Systemic exposure engine | `src/lib/systemic-exposure-engine.ts` | 13-dimension concentration, Questions A/B, DMCE input | Design-time; SIMULATED inputs; no live feeds |
| Bank default & resolution | `src/lib/bank-default-resolution.ts` | 8-state lifecycle, 11 contractual questions | Specified; `bankDefaultContractValidated: false` |
| V3 on-chain settlement | `contracts/MTQSigmaV3.sol:1054-1146` | Bank-mediated burn + `RedeemSettlement` obligation event | SOURCE-READY, NOT DEPLOYED |
| Stablecoin "reserve" flows | v1.2 pilot + ecosystem modules | MockUSDC test-token transfers at admin-set prices | Test tokens; no real stablecoin |
| CBDC | — | Nothing exists | NOT CONNECTED |

---

## 2. THE SEPARATION INVARIANT (prominent — the load-bearing rule of this deliverable)

> **Payment volume or acceptance must NEVER automatically determine currency eligibility or basket weights. Accepting a USD-linked stablecoin does not itself justify increasing the USD weight. Accepting a euro-linked instrument does not itself justify increasing the EUR weight.** (MANDATE-004 §7, verbatim obligation.)

PROPOSED four-layer enforcement (all currently NOT IMPLEMENTED):

1. **Structural (data-path) separation.** The payment registry (§3) has no foreign-key, import, or event path into the constituency/weighting modules. MASE inputs, eligibility scores, envelopes and the weight-transition engine consume index/methodology data only. There is **no telemetry field** for payment volumes in any weighting input. Basket membership changes must not auto-disable unrelated payment instruments (only an instrument-specific rule in §5 may).
2. **Organizational separation of duties** (§5.2): the payment-acceptance operator role is disjoint from the index/methodology publisher role; no person may hold both. Today this is moot-but-enforced-by-absence: no live councils exist (G9 NOT CONDUCTED, `honest-status.ts:97-101`) and the engine runs in shadow mode.
3. **Conflict-of-interest controls.** No undisclosed spreads (every quote itemizes spread — §6.1); no double charging (a conversion is charged once per operation; fee schedule governed by D-13.8); fee wallet custody independent of the acceptance operator (today V3's feeWallet is obligation-only with no sweep function — `DEVELOPER-REPORTED`, baseline §8).
4. **Test enforcement.** A Stage K property test (§8, T-PAY-01) injects synthetic payment-volume surges and asserts weight vectors and eligibility scores are bit-identical before/after. This test does not exist yet (NOT IMPLEMENTED).

---

## 3. PROPOSED registry data model

One registry row per *instrument instance* (the same stablecoin on two networks = two rows, each with its own contract identity and finality profile). Fields:

| Field | Contents | Notes |
|---|---|---|
| `instrumentId` | Stable opaque ID + version | Every mutation bumps version; append-only history |
| `type` | `STABLECOIN` \| `CBDC` \| `BANK_RAIL` \| `OTHER` | Type drives the policy set (§4) |
| `issuer` | Legal entity, jurisdiction of incorporation, regulation references | For BANK_RAIL: the bank/participant institution |
| `network`/`rail` | Chain ID + token address, or rail identifier | Exact contract identity per instance; never a ticker alone |
| `decimals`, `tokenStandard` | Numeric identity | MockUSDC 6-decimal class differences must be explicit |
| `jurisdiction` | ISO 3166-1 alpha-2 allowlist + denied list | Per-instrument, compositional with global lists |
| `assetPeg` | Referenced asset (USD, EUR…) + pricing source | **Never assume 1 token = 1 fiat unit**; price via the oracle board (deliverable 10) |
| `counterparty` | Settlement counterparty & custody arrangement | For rails: the account-holding institution |
| `restrictions` | Network / issuer / jurisdiction / asset / counterparty / access permissions | Each restriction machine-checkable at quote time |
| `confirmationPolicy` | Per-rail finality definition (§6.2) | e.g. stablecoin: N confirmations + issuer sanity check; bank rail: verified settlement interface message only |
| `depegThresholds` | warn / suspend / emergency bands vs referenced asset | Values = PROPOSED parameters (D-13.19) |
| `state` | `CANDIDATE` · `ACTIVE` · `SUSPENDED` · `RETIRED` · `SIMULATED` · `NOT CONNECTED` | §5; the last two are honesty states, never silently exited |
| `reviewCadence` | Scheduled review interval + last/next review | Default 90 days PROPOSED (D-13.19) |
| `evidence` | Citation list backing every ACTIVE claim | Link/anchor to attestation, contract address, test record; an ACTIVE row with an empty evidence list is invalid by construction |
| `fees` | Protocol fee class + rail/network fee estimates | **Rates live in D-13.8**; registry stores references only |

**Seed data (PROPOSED, all values unapproved):** the 9 basket-registry instruments are seed *candidates only* — they must pass payment admission independently; their basket status confers nothing. `DIGITAL_UNIVERSE` (`src/lib/mtq/mtq-final-reserve-spec.ts:397-404`, 7 stablecoins incl. USDC DRQS 8.5, EURC 7.8) is an inert quality-scored candidate list usable as seed input; its DRQS scores are UNAPPROVED economic parameters. No row may enter as ACTIVE from seed.

**Alternatives considered:** (a) *single unified registry with a role flag* — rejected: keeps one governance path, recreating the conflation hazard; (b) *two registries (payment vs basket), as proposed* — recommended: independent lifecycles and governance, with a documented cross-reference report for transparency; (c) *extend the existing asset registry* — rejected: its admission criteria are reserve criteria and its state machine feeds engine logic.

---

## 4. Per-type policy (PROPOSED)

- **Approved stablecoins.** Admission evidence: exact contract identity on each intended network (address, chain, decimals, standard); issuer legal identity + regulation; redemption terms; audited contracts within 12 months; liquidity minimum; sanctions/compliance policy; ≥2 independent price feeds for the peg pair (cross-ref deliverable 10 independence standard). Operational rules: balance receipt ≠ economic finality — finality requires the `confirmationPolicy` AND an issuer sanity check (no freeze event, no attestation failure); depeg handling per thresholds; reorg behavior defined per chain (N-confirmations chosen so a reorg at depth ≥ N is historical); never treat the token as equal to its fiat reference without a live price read.

  PROPOSED depeg band structure (values = D-13.19 parameters, none approved):

  | Band | Condition (vs referenced asset) | Automatic action |
  |---|---|---|
  | NORMAL | within 0.30% | quote normally; monitor |
  | WARN | beyond 0.30% sustained 1h | flag; new quotes carry a depeg warning disclosure |
  | SUSPEND | beyond 1.00% sustained 4h, or any 5.00% instantaneous move | instrument → SUSPENDED; in-flight settlements complete under existing quotes |
  | EMERGENCY | beyond 2.50% sustained 24h, or issuer redemption suspension | suspension + escalation into deliverable 10's emergency framework |

- **CBDCs — only where authorized access and technical interfaces exist.** None exist. Every CBDC row is born `NOT CONNECTED` and may leave that state ONLY on: (i) a verified authorized interface (contract/endpoint identity + access grant), and (ii) a recorded end-to-end test against the real interface. **No CBDC integration claim is made or implied anywhere in this repository.** Simulators or interface abstractions must be labeled `SIMULATED` and cannot back ACTIVE rows.
- **Approved bank and payment rails.** Admission evidence: authorized provider agreement; verified settlement interface (message format, reconciliation format, cut-off and finality semantics); counterparty and custody terms; jurisdiction allowlist. Bank rails inherit the bank-default-resolution framework (8-state, `bankDefaultContractValidated: false` today) — rail admission is blocked while that flag is false in any production context.
- **Other** (e.g., tokenized deposits, MMDs): admitted only via an owner-approved bespoke policy annex (new decision ID opened at that time; none proposed now).

---

## 5. PROPOSED state machine & governance

### 5.1 States and transitions

```
CANDIDATE ──admission(dossier+approval+notice)──▶ ACTIVE ──suspension trigger──▶ SUSPENDED
   │  ▲                                              │  ▲                        │
   │  └────────── rejection/withdraw ────────────── RETIRED ◀── retirement ───────┤
   │                                                 │                          │
   │                        recovery evidence + observation + approval ──────────┘
   └── any state may be honestly relabeled SIMULATED or NOT CONNECTED (one-way without new evidence)
```

Suspension triggers (each requires recorded evidence): depeg threshold breach (field §3; band values §4); issuer event (freeze, insolvency, regulatory action, redemption suspension); security incident affecting the instrument; settlement-finality evidence failure (reconciliation exception §6.5 above threshold); sanctions/AML trigger; pricing-source failure for the instrument's pair (cross-ref deliverable 10). Reinstatement requires: trigger condition cleared, an **observation period** (PROPOSED 48h, mirrors V3 `RECOVERY_CONFIRMATION_PERIOD = 48 hours`, `MTQSigmaV3.sol:258` — UNDEPLOYED), committee approval, and published notice. Retirement removes the instrument from quoting but preserves records (append-only).

### 5.2 Who decides, on what evidence, with what notice (separation of duties)

| Role | Decides | Explicitly must NOT | Holder today |
|---|---|---|---|
| Registry operator (maintains rows) | Record accuracy, evidence archiving | Admission/suspension decisions | Nobody — code only (no operator exists) |
| Payment-admission committee | Admissions, reinstatements, retirements, thresholds | Basket weights, eligibility scores, any MASE input | **DOES NOT EXIST** (G9 NOT CONDUCTED, `honest-status.ts:97-101`) |
| Emergency suspension officer | 24h suspension on trigger evidence; retro-review within 72h | Admissions, retirements, parameter changes | **DOES NOT EXIST**; on-chain pause authority resolves to the compromised R-1 EOA (`DEVELOPER-REPORTED`, baseline §3) |
| Index/methodology publisher | Weights, index values | Receiving payment-volume telemetry; registry state changes | TS reference layer, shadow mode |
| Independent reviewer | Annual registry audit + spot evidence checks | Any operational decision | None engaged (CKPT-9 pending) |
| Owner | Policy parameters (D-13.19), state-model changes, fee classes (D-13.8) | Day-to-day operations | Open |

Notice: every state transition is published (instrument ID, old→new state, trigger class, effective timestamp) within 1h for emergency suspensions and 24h for all others (PROPOSED, D-13.19). Evidence is retained per the §24 audit-trail regime.

### 5.3 Honesty-state discipline

`SIMULATED` and `NOT CONNECTED` are one-way without new evidence: a row may not become ACTIVE except via the full admission path with a verified interface and a recorded end-to-end test. The current pilot bank would be registered as `SIMULATED` (machinery exists, synthetic data); every CBDC row as `NOT CONNECTED`.

---

## 6. PROPOSED settlement-flow requirements

### 6.0 Flow overview

```
quote ─▶ acceptance(idempotency key) ─▶ instrument transfer ─▶ confirmation policy ─▶
finality ─▶ ledger entries (three books) ─▶ obligation issued ─▶ daily reconciliation ─▶ exception queue
   │                                    └── failure/expiry at ANY step ─▶ refund path (same key) ─▶ manual queue on failure
```

### 6.1 Quote generation
Quote fields: instrument(s), side, amount, **conversion source** (oracle board aggregate + method + timestamp — cross-ref deliverable 10), **quote expiry timestamp** (hard-rejected after expiry; seed primitive exists: `quoteExpiresAt` guards, `pilot-state.ts:652-663`), **spread disclosure** (explicit line item, cap PROPOSED), **fee line-items** (network/rail fee, conversion fee, protocol fee class — rates owned by D-13.8; no undisclosed spread, no double charging), **rounding rule** (PROPOSED banker's rounding to 6 decimals, D-13.19), total. Quotes are signed by the quoting service and replay-protected.

### 6.2 Confirmation & settlement finality (per-rail definitions)
- **Stablecoin:** N confirmations (per-chain parameter) AND issuer sanity check (no freeze/red-flag event, attestation current). Balance receipt alone is never finality.
- **Bank rail:** a **verified settlement interface** message of finality only (e.g., regulated settlement-system confirmation); no heuristic substitute. Rails without a verified interface cannot be ACTIVE.
- **CBDC:** the authorized interface's own finality signal, recorded with its message; absent interface ⇒ no quotes at all.
- Finality gates issuance of any instrument-bearing obligation (finality-before-mint analog, `finality-before-mint.ts:15-22`).

### 6.3 Refunds & failed-transaction handling
Failed, expired, or partially-confirmed transactions auto-refund to the source instrument (or the owner's declared fallback), using the same idempotency key; refund state machine (PENDING_REFUND → REFUNDED / REFUND_FAILED → manual queue) with disclosure; no fee retained on a failed transaction (PROPOSED, D-13.8 cross-ref).

### 6.4 Idempotency keys
Every settlement operation carries an idempotency key (seed: MBG deterministic `requestId` = SHA-256 over canonical fields, `route.ts:353-369`; nonce + expiry validation `:346-349`). Duplicate submission with the same key returns the original result — never a second execution.

### 6.5 Reconciliation (three-book style) & exception handling
Daily (UTC midnight) three-way reconciliation, adapted from the three-book module's structure (`three-book-separation.ts:59-132`): **initiator ledger** (bank/customer internal books) vs **acquirer ledger** (MBG/pilot DB records — today the hash-chained `MbzMintRequest`/`MbzBackingCertificate` tables, `DEVELOPER-REPORTED`, prisma schema census) vs **on-chain/token ledger** (chain events/balances). mismatches enter a dated **exception queue**; PROPOSED thresholds: exceptions > X count or > Y value on an instrument ⇒ instrument auto-SUSPENDED pending committee review; unresolved exceptions > Z days ⇒ payment layer enters the DEGRADED state of deliverable 10's emergency framework (reference-data outages remain separately scoped from payment-instrument outages, per the mandate's cross-cutting rule).

### 6.6 Exception taxonomy (PROPOSED)

| Class | Example | Automatic handling |
|---|---|---|
| CONFIRMATION_TIMEOUT | transfer unconfirmed before quote expiry | refund; retry forbidden on same key |
| REORG_ROLLBACK | confirmation reversed below N | revert ledger entry; refund; instrument flagged |
| FINALITY_EVIDENCE_GAP | interface message missing/malformed | hold in exception queue; block new obligations for instrument |
| RECONCILE_MISMATCH | three-book divergence | queue; threshold ⇒ auto-suspension (§6.5) |
| ISSUER_EVENT | freeze/redemption suspension | immediate SUSPENDED (§5 trigger list) |
| DUPLICATE_KEY_COLLISION | same idempotency key, different payload | reject second; alert; never execute twice |
| PARTIAL_SETTLEMENT | amount settled ≠ quoted amount | hold difference in queue; disclose; no silent write-off |

---

## 7. Security & economic implications

- A compromised or wrongly-admitted instrument is a direct conduit for laundering value into MTQΣ-denominated obligations; finality definitions are the last structural control before issuance.
- The separation invariant protects index integrity: without it, payment-side commercial incentives would leak into weights — the exact failure mode the mandate names.
- SIMULATED machinery must not be mistaken for capability: the pilot bank, three-book ledger, and finality layers are honest scaffolding. Treating them as evidence of readiness would be a false claim.
- Settlement obligations create counterparty exposure to every ACTIVE issuer/bank — concentration must be measured by the systemic-exposure engine (design-time today, `systemicRiskMonitoringLive: false`).

### 7.1 Risk register (spec-level)

| # | Risk | Severity | Mitigation (PROPOSED) |
|---|---|---|---|
| R-P1 | Payment volumes silently influencing basket weights | HIGH | §2 four-layer invariant + T-PAY-01 property test |
| R-P2 | Admitting an instrument on unverified evidence (e.g., ticker-level identity) | HIGH | §3 evidence-mandatory fields; independent reviewer |
| R-P3 | False finality (balance receipt treated as settled) | HIGH | §6.2 per-rail finality + issuer sanity checks |
| R-P4 | Testnet-bypass auth (`MBG_TESTNET_BYPASS`) surviving into any real path | HIGH | D-13.19: bypass removal precondition for any non-SIMULATED row |
| R-P5 | Depeg event during in-flight settlement | MEDIUM | band structure (§4) + in-flight completion rule |
| R-P6 | Reconciliation exception backlog masking losses | MEDIUM | thresholds ⇒ auto-suspension; aged exceptions escalate |
| R-P7 | Single-bank concentration (the only row today is one SIMULATED bank) | MEDIUM | systemic-exposure limits at admission, not after |
| R-P8 | Overclaiming CBDC readiness from simulator code | HIGH | §5.3 one-way honesty states; no claim made anywhere |


## 8. Tests required (Stage K families — PROPOSED, NOT RUN)

- **T-PAY-01 (instrument eligibility & suspension / separation invariant):** payment-volume surge property test (weights and eligibility scores bit-identical); depeg-threshold → suspension transitions at each band boundary (0.30% / 1.00% / 2.50% proposals); basket membership change does not auto-disable unrelated instruments; admission requires a complete evidence dossier; SIMULATED→ACTIVE blocked without verified-interface evidence; jurisdiction/asset/counterparty restriction composability at quote time.
- **T-PAY-02 (settlement finality & failed payments):** per-rail finality gates (N-confirmations boundary; reorg at depth N−1 rejected); issuer-sanity-check failure blocks finality; failed tx → auto-refund with same idempotency key; reconciliation exception above threshold → suspension; three-book mismatch detection on seeded divergences; duplicate idempotency key with different payload rejected.
- **T-PAY-03 (quote expiry/rounding/refunds/fees):** expired quotes hard-rejected at the boundary; rounding deterministic under the declared rule; no double charge across composite operations; refund idempotency (duplicate key returns original result); fee line-items sum to the total exactly; spread disclosure present on every quote artifact.

All three are NOT IMPLEMENTED. No test in this repository exercises payment-instrument admission, suspension, or settlement flows today. Environmental limits (e.g., any future Foundry-dependent assertions) will be recorded as UNVERIFIED, never PASS.

### 8.1 Acceptance criteria (PROPOSED — none met today)

1. All MANDATE-004 §7 clauses demonstrably implemented (self-check §12 all-green) with the registry live and every ACTIVE row carrying verifiable evidence citations. 2. T-PAY-01/02/03 families executed green against the implemented design, including the separation-invariant property test. 3. D-13.8 and D-13.18/D-13.19 decisions recorded as owner-approved with the parameters filled in. 4. One verified end-to-end settlement against a real (non-MockUSDC) instrument in a test environment with the three-book reconciliation closing — OR the corresponding capability explicitly remains SIMULATED/NOT CONNECTED with no ACTIVE rows. 5. No payment capability claimed beyond what 1–4 evidence; all SIMULATED/NOT CONNECTED labels still accurate. Nothing in this document is acceptance evidence; a gate can only be advanced by the processes that own it.

## 9. Assumptions & unresolved questions

1. Assumes deliverable 10's oracle independence standard will be adopted (stablecoin peg pricing depends on it). 2. Assumes a future payment-governance body can exist (none does; G9 NOT CONDUCTED). 3. Bank-rail finality semantics depend on external providers' message formats — none contracted. 4. **OPEN:** who holds the emergency suspension officer role on testnet in the interim? **OPEN:** should the pilot bank remain in the registry at all once a real design lands, or move to a sandbox registry partition? **OPEN:** cross-chain settlement identity (same instrument on 3 EVM testnets + Solana — interacts with D-13.10 cross-chain supply model). **OPEN:** whether quote conversion sources may ever include the payment counterparty's own price (PROPOSED: never).

## 10. Owner approvals required (all OPEN)

- [ ] **D-13.8** (existing, Gate E): fee schedule — rates, recipients, exemptions, caps, change governance; quote fee line-items reference its outcome; no fee is charged anywhere today.
- [ ] **D-13.18** (NEW): adopt the separation invariant + payment-layer governance model (§2, §5) — including the disjointness of payment-acceptance operator vs index publisher, and the honesty-state discipline. *Renumbered from D-13.13 after an intra-wave collision was observed on disk (deliverable 7 opened D-13.13 = burn taxonomy; deliverable 4 references D-13.13 = GPP-leg) — final numbering subject to orchestrator reconciliation.*
- [ ] **D-13.19** (NEW): settlement policy parameter set — depeg threshold bands, quote expiry windows, per-chain confirmation depths, rounding rule, refund timing, reconciliation cadence + exception thresholds, review cadence, notice windows, and the CBDC posture (NOT CONNECTED until a verified authorized interface + end-to-end test exists). *Renumbered from D-13.14 after the same collision (deliverable 7 opened D-13.14 = secondary-market posture; deliverable 4 opened D-13.14 = weight-rounding/concentration convention) — subject to orchestrator reconciliation.*
- Carried dependencies: governance bodies (G9 / Task 12 CKPT-3..7), RELEASE-GRANTS regime for any live operation.

## 11. What is NOT implemented / NOT tested (explicit)

The registry, state machine, admission/suspension governance, quoting service, settlement finality enforcement against any real rail, refund machinery, idempotency middleware, three-way reconciliation jobs, exception queues, and all T-PAY tests: **NOT IMPLEMENTED**. No real stablecoin, CBDC, bank rail, or payment network is integrated, tested, or claimed. The MBG gateway's `MBG_TESTNET_BYPASS` flag and the fail-soft DB persistence are pilot conveniences that must be governed (bypass removal is implied by any production posture; no production posture is authorized). Foundry/forge-dependent behaviors: UNVERIFIABLE in sandbox. Nothing here advances any release gate (tests/typecheck/docs never advance gates — standing rule).

## 12. MANDATE-004 §7 clause mapping (self-check)

| §7 clause | Where satisfied |
|---|---|
| Extensible model: approved stablecoins / authorized CBDCs / approved bank & payment rails | §3 data model, §4 policies |
| Network, issuer, jurisdiction, asset, counterparty restrictions | §3 `restrictions`; compositional checks at quote time |
| Confirmation & settlement-finality requirements | §6.2 per-rail definitions |
| Quote expiry, conversion sources, spreads, fees, refunds, reconciliation, exception handling | §6.1, §6.3–§6.5 |
| Depeg thresholds, suspension, recovery, reinstatement | §3 `depegThresholds`, §5 |
| Explicit SIMULATED / NOT CONNECTED states | §3 `state`, §5.3, §1 labels |
| Payment volume never determines eligibility/weights; USD/EUR examples | §2 (invariant, tests T-PAY-01) |
| No CBDC integration claim without verified interface + end-to-end test | §4 (CBDC), §11; none claimed |

---

## 14. MANDATE-006 §7 reconciliation (stablecoin- and CBDC-funded issuance) — added 2026-10-22

### 14.1 Architecture requirement restated (§7.1)

The target v3.0 architecture must support primary issuance funded by (1) individually approved stablecoins, (2) eligible CBDCs where authorized access and technical integration are available, (3) additional payment rails only when separately approved and implemented. **This is an architecture requirement, not a claim** that these capabilities are already integrated, tested, connected, or production-authorized. Current status unchanged: registry PROPOSED; instruments SIMULATED (pilot bank) / NOT CONNECTED (CBDCs) / test tokens (MockUSDC).

### 14.2 Stablecoin-registry field coverage check (§7.3 vs §3 data model)

MANDATE-006 §7.3 field list mapped to the §3 registry model: instrument identifier ✓ · issuer and jurisdiction ✓ · contract address and network ✓ (per-instance) · underlying reference currency and decimals ✓ · approval/restriction/suspension/revocation states ✓ (§5 state machine) · confirmation and settlement-finality requirements ✓ (§6.2) · valuation source and quote currency ✓ (§6.1) · quote expiry, permitted conversion routes, fees, slippage protections ✓ (§6.1/§6.3) · depeg detection and suspension thresholds ✓ (§3 `depegThresholds`) · recovery and reinstatement requirements ✓ (§5) · refund/failed-payment/duplicate-payment/reconciliation procedures ✓ (§6.3–§6.5). **Two rules added verbatim as registry invariants:** (a) approval of a stablecoin on one network must not automatically approve a similarly named instrument on another network (per-instance identity — encoded by the per-address row model, now restated as an explicit admission rule); (b) no assumption that a stablecoin maintains its stated value — issuer, reserve structure, redemption conditions, liquidity, network, and depeg risks are part of the instrument's assessment (§4 policy + T-PAY-01). **Gap found:** none structural; all fields already specified. Status unchanged: `SPECIFIED` / `NOT IMPLEMENTED`.

### 14.3 CBDC adapter requirements (§7.4)

MANDATE-006 §7.4 requires a **separate adapter interface per supported CBDC system / authorized institutional connection**, specifying: issuing authority and jurisdiction · eligible participating institutions · permissioning/account requirements · authorized technical interface · payment initiation, verification, settlement status · transaction identifiers and duplicate prevention · finality, failure, reversal, dispute, timeout behavior · privacy and audit requirements · reconciliation with the payment provider and MTQΣ issuance records. The §4 CBDC policy covers the admission side; **the per-adapter interface contract with the nine §7.4 fields is now specified as a required annex of any CBDC admission dossier** (to be produced per candidate system; none exists). No CBDC is freely transferable, public-chain-available, or accessible to an independent token contract by assumption. **Status: SIMULATED / NOT CONNECTED — unchanged, and no live CBDC integration may be claimed until an authorized interface and an end-to-end integration test exist.** A **non-production prototype** of the per-adapter interface (nine §7.4 concern areas) exercised with clearly labeled SIMULATED messages exists at `audit-work/task13/evidence/issuance-state-machine/cbdc-adapter.ts` (MANDATE-007 §4) — interface-design evidence only; the status above is unchanged by it.

### 14.4 Minting-workflow state machine (§7.5) — 12-step mapping

| §7.5 step | Where specified | Status |
|---|---|---|
| 1. Payment instrument selection | §6.0 flow | `SPECIFIED` |
| 2. Quote calculation and expiry | §6.1 | `SPECIFIED` |
| 3. User issuance request | §6.0 | `SPECIFIED` |
| 4. Payment verification and settlement-finality confirmation | §6.2 | `SPECIFIED` |
| 5. Instrument and jurisdiction checks | §3 restrictions (compositional at quote time) | `SPECIFIED` |
| 6. Conversion into the approved quote unit | §6.1 | `SPECIFIED` |
| 7. Fee calculation | §6.1 + D-13.8 | `SPECIFIED` (rates UNAPPROVED) |
| 8. Net accepted payment value | §6.1 | `SPECIFIED` |
| 9. Issuance authorization and supply-limit checks | §14.6 (this update) + `issuance-burn-and-market-mechanism-spec.md` §2.3 | `SPECIFIED` — previously under-specified; now explicit |
| 10. Token issuance | `issuance-burn-and-market-mechanism-spec.md` §2.3 | `SPECIFIED` |
| 11. Payment and issuance reconciliation | §6.5 (three-book) | `SPECIFIED` |
| 12. Failure recovery and audit publication | §6.3/§6.6 | `SPECIFIED` |

**Hard rules (§7.5, verbatim effect):** a payment notification alone must never trigger unauthorized issuance; a failed or unverified payment must never create tokens; repeated messages, replayed events, and retries must never cause duplicate issuance (idempotency §6.4). Where payment settlement and token issuance occur in different systems and cannot be atomic, a safe state machine, idempotency mechanism, exception handling, and compensating process are mandatory (§6.6 exception taxonomy; the pilot's fail-soft persistence is a governed-to-be-removed convenience, §11). **All steps: `NOT IMPLEMENTED` in production.** A **non-production prototype** of the full 12-step state machine exists (MANDATE-007 §4): `audit-work/task13/evidence/issuance-state-machine/` — common invariants, the 8-stage controlled process (§14.6), duplicate/delayed/failed/reversed/unauthorized/invalid payment paths, and the CBDC adapter tested with SIMULATED messages (123/123 assertions × 2 fresh runs, exit 0; evidence file cited there). Prototype evidence only — the production status of every step is unchanged.

### 14.5 Pricing calculation (§7.6)

The general form is evaluated: `MTQΣ issued = net accepted payment value in the approved quote unit / approved MTQΣ issuance quote`. Required definitions (mapped): conversion of the stablecoin/CBDC amount into the quote unit (§6.1) · valuation source and timestamp (§6.1) · relationship between the issuance quote and the published index (§6.1 — quote derivation policy) · fees and conversion costs (D-13.8) · rounding and precision (D-13.14) · quote expiry and slippage safeguards (§6.1) · authorization, caps, rejection rules (§14.6) · failure, reversal, reconciliation behavior (§6.3–§6.5). **The exact issuance-pricing policy remains subject to explicit owner approval; the formula is illustrative, not approved economic policy.** If MTQΣ is issued using an index-derived quote, that does not guarantee it will later trade at the same value (three-measurement separation).

### 14.6 D-13.27 — the payment→issuance authorization model (§7.7; MANDATE-007 §1/§2) — **REVISION 2 — 2026-10-23 (delegated adoption)**

**REVISION 2 — 2026-10-23 (delegated adoption).** Under the owner directive of 2026-10-23 (`owner-directive-2026-10-23-delegated-execution.md`), the executive team (COO/CTO/PM — roles assigned by the owner in that directive) adopted the D-13.27 implementation decisions recorded in **the adoption record at the end of this section**. Each adopted decision is labeled **ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION**: adoption confers **implementation direction, NOT production economic authorization**; the owner retains the right to revisit. The Revision-1 (MANDATE-007 §2, 2026-10-22) text below — the owner requirement, the 8-stage controlled process (**unchanged and still controlling**), the alternatives analysis, the common invariants, and the prototype evidence — is **preserved, not erased**; where the Revision-2 adoption record decides, it supersedes the Revision-1 open-decision framing.

*(Revision-1 text, 2026-10-22, preserved:)*

**Owner requirement, recorded (MANDATE-007 §1/§2, 2026-10-22).** Stablecoin- and eligible-CBDC-funded primary issuance is an **established product requirement of the v3.0 direction** — approved stablecoins and eligible CBDCs must be supportable as funding methods for MTQΣ issuance. This is **not presented as an option**: the remaining open core of D-13.27 is **which authorization model governs the payment→issuance edge**, plus the implementation decisions listed below. The Gate-B D-13.6 wording (*"no automatic minting in response to payment volume, network activity, or any operational metric"*) and this requirement **do not conflict**: the D-13.6 clause is an **authorization safeguard, not an existence prohibition** — a payment event alone must never trigger *unauthorized* minting, and that safeguard **does not prohibit payment-funded issuance performed inside an authorized, controlled process**.

**The controlled issuance process (PROPOSED — mandatory stages; every payment-funded issuance must pass all eight):**

1. **Explicit issuance request** — a request record must exist before any payment is evaluated; no spontaneous mint from an arriving payment.
2. **Payment verification** — payment authenticity and instrument checks (registry state, per-instance identity, jurisdiction, amount, idempotency key; §3/§6.4).
3. **Settlement-finality checks** — rail-specific finality per §6.2 must be established before any issuance step may proceed.
4. **Applicable authorization** — an explicit authorization record per the alternative selected below; issuance outside the selected model is forbidden.
5. **Approved pricing** — the issuance quote per an approved quote-derivation policy (§14.5; the policy itself remains UNAPPROVED) with expiry and slippage safeguards (§6.1).
6. **Fees** — fee calculation and conversion costs per D-13.8 (OPEN).
7. **Supply controls** — explicit supply-limit checks (tranche and per-transaction caps against the approved supply policy, D-13.6; fail-closed).
8. **Reconciliation** — three-book payment/issuance reconciliation (§6.5) with exception handling (§6.6).

**The alternatives (the OPEN core of D-13.27 — which authorization model governs the payment→issuance edge):**

- **ALT-1 — Authorized-issuance-window model.** Governance pre-authorizes issuance **tranches** (per-tranche token caps, quote policy, eligible instruments, window duration, disclosure). Payments settled inside an active window mint against the tranche; payments outside any window are **held-or-refunded, never minted**. Supply response to payments is bounded by the tranche and requires a fresh governance act to continue. *Consistent with D-13.6 as worded (each window = an explicit governed act; no operational metric mints anything).* Friction: governance cadence scales with demand.
- **ALT-2 — Approval-per-issuance model.** Every issuance requires an explicit authority action after settlement evidence is recorded (issuance request queue → authorized signer/multisig approval → mint). Strongest control; slowest; closest to "controlled, authorized operation" in the narrowest sense. *Consistent with D-13.6 as worded.* Friction: per-transaction human cost; unsuitable for retail-scale issuance.
- **ALT-3 — Rule-bound programmatic issuance (pre-authorized program).** Governance approves a **binding issuance rule** (quote derivation, per-period and per-transaction caps, instrument list, circuit breakers, disclosure events) and the program mints within the rule without per-transaction acts. Payments are inputs to the rule, not triggers outside it. ⚠ **This requires an explicit exception clause in the D-13.6 wording** (the rule-bound program IS an operational-metric response, pre-authorized) — i.e., D-13.6's wording must be revised or excepted by the same owner decision that adopts ALT-3; without that revision the two cannot coexist. Friction: lowest operationally; highest parameterization and review burden; caps/circuit-breakers must be fail-closed.
- **ALT-4 — Hybrid: authorized program + periodic attestation.** ALT-3's machinery plus a mandatory periodic (e.g., weekly) governance attestation that observed issuance matched the rule; any mismatch → automatic issuance suspension pending review. Middle ground; adds an operational duty.

*(Revision-2 annotation, 2026-10-23: **ALT-4 is the alternative adopted under delegated authority** — see the adoption record at the end of this section. The alternatives text above is preserved as the historical analysis.)*

**Common invariants under every alternative (implemented as a non-production prototype, all eight controlled-process stages):** settlement finality precedes issuance (§6.2/§14.4); issuance authorization + supply-limit checks are explicit state-machine steps (§14.4 step 9); no issuance outside the approved policy, permissions, and cap (if adopted); failed/unverified payments never mint; replay/idempotency enforced; payment volume never changes basket weights or eligibility (§2 invariant, T-PAY-01; asserted as a test-of-absence in the prototype); the issuance quote is never a promise of the token's later market value.

**Open implementation decisions (kept OPEN by this revision — not silently resolved):** settlement timing (when finality is deemed reached per rail); reversal semantics (pre-issuance vs post-issuance reversals, compensation and suspension behavior); failure recovery (retry, refund, hold-or-refund policy per §6.3); issuance transaction boundaries (atomic vs two-phase with the mandatory safe state machine, §7.5); plus the D-13.8 fee rates and the §14.5 quote-derivation policy.

*(Revision-2 annotation, 2026-10-23: the four sub-decisions and the fee/quote FORM are **adopted under delegated authority** in the adoption record below — pending owner ratification; the D-13.8 production VALUE and the §14.5 quote-policy publication remain OPEN.)*

**Non-production prototype evidence (MANDATE-007 §4, 2026-10-22):** a prototype state machine implementing the eight stages above with the four alternatives as pluggable authorization stubs (**no selection**) is implemented and tested at `audit-work/task13/evidence/issuance-state-machine/` — duplicate, delayed, failed, reversed, unauthorized, and invalid payment paths all tested; 123/123 assertions × 2 fresh runs, exit 0; CBDC adapter SIMULATED / NOT CONNECTED. **Prototype evidence only** — not a production implementation, not an approval, and it does not close D-13.27.

**Status (Revision 1, 2026-10-22 — superseded by the Revision-2 adoption record below; lead-in relabeled, substance preserved verbatim):** REVISED (MANDATE-007 §2) — STILL OPEN · NOT APPROVED. Approval requires the owner to select the authorization alternative (and, if ALT-3 is selected, to adopt the explicit D-13.6 exception clause **in the same decision record**); D-13.6's wording, this specification §14, and `issuance-burn-and-supply-policy-options.md` §4 must then be updated together. **Nothing in this revision marks D-13.27 approved.** The owner's resolution remains recorded as **D-13.27** (`unresolved-decisions-and-owner-approvals.md`).

---

**REVISION 2 — 2026-10-23 (delegated adoption) — THE ADOPTION RECORD**

**Owner delegation (quoted from `owner-directive-2026-10-23-delegated-execution.md` §1–§2).** The owner's directive of 23 October 2026, §1, verbatim:

> 1-you are the coo, cto, and project manager.
> 2-based on our model and your understanding to it, make all fixing an recommended modifications and fixing needed.
> 3-make all in honest way that gives and aligns our model for our vision.

§2 of that record states, on authority: *"The owner assigns the executive roles (COO, CTO, PM) and directs the executive team to implement **all needed fixes and recommended modifications**, based on the established model and the executive team's documented understanding of it, executed **honestly** and **aligned with the owner's vision**."* — and, on this decision specifically (§2 item 2): *"D-13.27 … the owner delegates the *implementation* decision to the executive team 'based on our model and your understanding to it.' … **Honest labeling:** every adopted decision is recorded as ADOPTED UNDER DELEGATED AUTHORITY (2026-10-23) — PENDING OWNER RATIFICATION, i.e., the owner retains the right to revisit; adoption confers implementation direction, not economic-production approval."*

The six decisions below were made by the COO/CTO/PM under that delegation, based on the established model and the executive team's documented understanding of it. **Adoption confers implementation direction, NOT production economic authorization; the owner retains the right to revisit.**

**Decision 1 — Authorization model: ALT-4 — hybrid + periodic attestation. ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION.**

Rule-bound programmatic issuance is permitted ONLY inside explicitly owner-authorized issuance programs (each program = a signed authorization record defining instrument(s), caps, windows, and rules; every ISSUED transition still requires an applicable authorization record — the payment-alone-never-mints invariant INV-A is preserved unconditionally), combined with periodic independent attestation (periodic three-book reconciliation attested by the authorized attester; attestation failure suspends the pipeline fail-closed).

**D-13.6 exception clause — recorded verbatim in this same decision record** (the condition ALT-3 attached to any rule-bound element, applied to ALT-4's embedded programmatic machinery): "Programmatic issuance under ALT-4 is the single authorized exception to the payment-alone-never-mints rule ONLY within the exact envelope of a recorded, unrevoked authorization program; anything outside that envelope remains unauthorized."

**Rationale (recorded for audit):**
- **(a)** preserves the D-13.6 safeguard — payment volume never authorizes anything;
- **(b)** scales across approved stablecoin rails and future qualifying CBDCs without per-transaction owner bottleneck;
- **(c)** institutional credibility via attestation aligns with the three-book reconciliation discipline and the long-run purchasing-power vision;
- **(d)** the program envelope (caps/windows/rules) keeps every authorization explicit, auditable, and revocable;
- **(e)** because it embeds rule-bound programmatic elements, the explicit D-13.6 exception clause is recorded in the same decision record as ALT-3 required.

**Decision 2 — Settlement timing: finality-before-issuance. ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION.** Issuance is permitted only after settlement finality of the funding payment on its rail is confirmed (per the instrument registry's finality classes); never before. Quote validity windows govern staleness; a payment whose finality arrives after quote expiry goes to EXPIRED_QUOTE (held-or-refunded per §6.3). *Rationale: preserves the 8-stage stage-3 ordering (§6.2 rail finality precedes every issuance step) and refuses stale-price minting (§6.1 hard-reject at expiry; prototype ISS-03 behavior is the demonstrated analog).*

**Decision 3 — Reversal semantics. ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION.** Pre-issuance reversal → the request cancels (no mint occurs; terminal CANCELLED). Post-issuance reversal → RECONCILIATION_BREAK terminal state + pipeline SUSPENDED + fail-closed remediation: resolution requires an explicit authorized reconciliation decision (three-book C1–C4 match verified); no automatic re-mint, re-burn, or adjustment without a new authorized request. *Rationale: the asymmetry tracks where value has already been created — before issuance nothing is owed (clean cancel); after issuance the books disagree, which is a reconciliation break that humans must resolve under explicit authorization (§6.5/§6.6). Honest naming note: the prototype's pre-issuance reversal terminal is labeled PAYMENT_REVERSED — the analogous no-mint fail-closed outcome; production naming follows this decision (CANCELLED); the prototype evidence is immutable history and is not retrofitted.*

**Decision 4 — Failure recovery: fail-closed. ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION.** A failed settlement, verification failure, or any reconciliation break halts the request and (for breaks) the pipeline; recovery only through the explicit authorized reconciliation path; no partial states, no retry-without-record, no silent healing. *Rationale: matches the §6.6 exception-taxonomy discipline and the finality-before-mint fail-closed tradition; "silent healing" is the exact failure mode the reconciliation path exists to prevent (prototype INV-B/INV-D behavior is the demonstrated analog).*

**Decision 5 — Issuance transaction boundaries: one request = one payment = one authorization record = one mint record. ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION.** Atomic, idempotent by request ID; no split mints, no partial issuances; replay of a completed request with a new payment is handled idempotently (single mint per request). *Rationale: matches §6.4 idempotency and the §14.4 hard rules (replays never double-mint); the 1:1:1:1 shape makes the §6.5 three-book check well-defined and gives every mint exactly one auditable authorization lineage (prototype ISS-02/ISS-09 behavior is the demonstrated analog).*

**Decision 6 — D-13.8 fees and §14.5 quote-derivation policy: FORM adopted, VALUES remain UNAPPROVED economic parameters. ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION (form only).** The fee is a named policy parameter with recorded illustrative default 0.10% (D-13.8 remains OPEN for production value); the quote follows the method-approved internal derivation with a validity window (§14.5); both are named defaults pending the validation program (D-13.25 pre-registration / D-13.26 validator independence) and Risk-Council publication. **The executive team does NOT mark any economic value production-approved.**

**What remains OPEN (explicit list, after the delegated adoption):**

1. **Owner ratification of this adoption itself** — every decision above is pending; the owner retains the right to revisit (owner-directive §2 item 2).
2. **D-13.8 production fee value** — FORM adopted; VALUE remains OPEN (the 0.10% figure is the recorded illustrative default only).
3. **§14.5 quote-derivation policy publication** — the internal derivation method and its publication under the validation program / Risk Council remain OPEN.
4. **CBDC admission dossiers** — the §14.3 per-adapter annex per candidate system; none exists; every CBDC row remains SIMULATED / NOT CONNECTED.
5. **All production and economic authorizations** — the Gate-B set D-13.3–D-13.7 (D-13.6's proposed wording must incorporate the exception clause above when the owner approves it — the two records move together), D-13.19 parameter values, D-13.6 supply-cap numbers, the Task 12 authority chain, RELEASE-GRANTS, and the production implementation of ALT-4 itself (a separate gated task; the immutable prototype's ALT-2 default FOR TESTING ONLY label is historical evidence, not the production model).

**Status (Revision 2, 2026-10-23):** the six decisions above are **ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION** — implementation direction for the v3.0 production design and the testnet Pilot demonstration only; **not** owner ratification, **not** production economic authorization, **not** an advance of any release gate. The 8-stage controlled process (Revision 1, unchanged) governs every payment-funded issuance under the adopted model; the common invariants and the §2 separation invariant stand unconditionally.

### 14.7 Acceptance-criteria additions (MANDATE-006 §19)

**Status line (REVISION 2 — 2026-10-23):** the D-13.27 authorization model and its four sub-decisions, plus the fee/quote FORM, are **ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION** (full record: §14.6 Revision 2). The adoption changes no acceptance criterion below and advances no gate: the stablecoin-funded issuance pathway remains production `NOT IMPLEMENTED` / `NOT TESTED` (non-production prototype evidence only); the CBDC adapter remains `SIMULATED / NOT CONNECTED` (no admission dossier exists); the separation invariant stands; and **no economic value is production-approved** (D-13.8 value and §14.5 quote-policy publication remain OPEN).

- **A separately specified and tested stablecoin-funded issuance pathway** — production status `NOT IMPLEMENTED`/`NOT TESTED`; a **non-production prototype** of the pathway is now implemented and tested against the approved TEST instrument `TEST-USDC-X` (evidence/issuance-state-machine/; MANDATE-007 §4) — prototype evidence only.
- **A properly modeled CBDC adapter with `SIMULATED / NOT CONNECTED` status** where no authorized integration exists (§14.3 — current status exactly that) — the prototype interface (nine §7.4 concern areas, SIMULATED message tests) exists as interface-design evidence only and does not change this status.
- **No automatic relationship between payment volume and basket weights** — the separation invariant made a test-of-absence (T-PAY-01; V3M-SUP-2 in `v3-purchasing-power-validation-plan.md`).
- **Explicit issuance authorization, accounting, reconciliation, and failure handling** (§14.4; `issuance-burn-and-market-mechanism-spec.md` §2).

---

## 15. Evidence & source references (MANDATE-006 additions)

14. MANDATE-006 (upload/Pasted Content_1792701542397.txt) §7, §7.1–§7.7, §16.5, §19 — the reconciliation requirements mapped in §14. SPECIFIED (owner direction).
15. `d13.3-d13.7-owner-decision-brief.md` §2 (D-13.6 wording) — the no-automatic-minting clause that §14.6 reconciles. SPECIFIED (PROPOSED wording, OPEN).
16. `issuance-burn-and-supply-policy-options.md` (new this cycle) §4 — the same D-13.27 alternatives from the supply-operations side. SPECIFIED (PROPOSAL).
17. `owner-directive-2026-10-23-delegated-execution.md` §1–§2 — the owner delegation (verbatim directive + authority grant, including the honest-labeling rule) under which the executive team adopted the §14.6 Revision-2 decisions. VERIFIED (record on file, 2026-10-23).

---

## 16. Evidence & source references (consolidated, pre-MANDATE-006; moved here for ordering — content unchanged)

1. `src/lib/mtq/registry.ts:40-48, 57-115` — asset registry = basket instruments; 8 admission criteria; ACTIVE/WATCH states. VERIFIED (read this session).
2. `src/lib/mtq/bank-registry.ts:13-20, 44-70, 94-124` — pilot bank record, placeholder-address disclosure, cap/authorization helpers. VERIFIED.
3. `src/app/api/mbg/mint-request/route.ts:17-21, 81-117, 163-192, 232-268, 282-369` — auth paths, bypass flag, no-on-chain-call note, hardcoded finality context, deterministic requestId, fail-soft persistence. VERIFIED.
4. `src/app/api/banks/route.ts:26-46` — public bank list; KYC/KYB bank-side declaration. VERIFIED.
5. `src/lib/finality-before-mint.ts:15-33` + `src/lib/mtq/finality.ts:42-283` — 7 layers, 10 blocked bypass routes, code-level-only honesty state. VERIFIED (read this session).
6. `src/lib/three-book-separation.ts:59-188` — Book A/B/C structure + SIMULATED reference entries. VERIFIED.
7. `src/lib/systemic-exposure-engine.ts:18-53` — honest state: no live feeds. VERIFIED.
8. `src/lib/bank-default-resolution.ts:37-62, 504-522` — 8-state framework; contract validation false. VERIFIED (headers + honest state).
9. `contracts/MTQSigmaV3.sol:243, 258, 1054-1146` — `RedeemSettlement` obligation; 48h recovery confirmation; bank-mediated redeem. VERIFIED.
10. `src/lib/mtq/pilot-state.ts:652-667` — `quoteExpiresAt`/min-out guard primitives (SIMULATED path). VERIFIED.
11. `src/lib/mtq/mtq-final-reserve-spec.ts:394-410` — `DIGITAL_UNIVERSE` candidate seed (DRQS thresholds 7.5/6.0). VERIFIED.
12. `audit-work/task13/baseline-and-change-matrix.md` §2, §5 Stage E, §8 — Stage A baseline rows cited throughout. DEVELOPER-REPORTED/VERIFIED as labeled there.
13. `audit-work/task13/unresolved-decisions-and-owner-approvals.md` — D-13.1…D-13.12 register (D-13.8 referenced). VERIFIED.

---

*TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED*
