# MTQΣ — TASK 13 · Oracle & Emergency-State Specification (deliverable 10, Stage I)

**STATUS: PROPOSED v1 — NOT APPROVED, NOT IMPLEMENTED.** This document proposes the v3.0 oracle-integrity and economic-emergency design and records the honest current state. No emergency threshold, restricted-state definition, or oracle policy is chosen by this document; every parameter is an open owner decision.
**Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED. Production authorization: FALSE.**

Evidence legend: `VERIFIED` (independently reproduced this session, cited) · `DEVELOPER-REPORTED` (prior in-repo work, cited) · `SIMULATED` · `PROPOSED` · `UNVERIFIED` · `NOT IMPLEMENTED`.

Mandate compliance target: MANDATE-004 §4 clause G ("Oracle independence, manipulation resistance, stale data, and incident handling"), the standing fail-closed requirement ("fail-closed behavior on oracle/economic failure" — verified for anything creating or valuing new supply), the no-claims-without-evidence rule for manipulation resistance, and the emergency-state requirements (defined entry evidence, allowed/disallowed actions per state, recovery/reinstatement procedures, public disclosure obligations). The twelve §11 failure scenarios are mapped in §10.

---

## 0. Purpose & scope

(a) Oracle independence requirements and the plan to close the KNOWN single-upstream gap; (b) manipulation-resistance design with an honest statement of what may NOT be claimed; (c) stale-data policy including a strict last-known-good (LKG) scope; (d) the four-state NORMAL/DEGRADED/FAILED/EMERGENCY table with per-state allowed operations; (e) an incident-response runbook; (f) economic emergency states — triggers, entry evidence, per-state action matrix, recovery & reinstatement with observation periods, disclosure obligations, cross-chain consistency; (g) existing TS vs undeployed-Solidity implementation comparison, breaking changes, migration implications; (h) tests required (never claimed as run); (i) owner approvals.

---

## 1. Existing implementation (file-cited honest inventory)

### 1.1 TypeScript reference layer (the live pilot path) — VERIFIED unless noted

- **Five-state per-feed machine** (`src/lib/mtq/oracle.ts:39-49`): `VALID` / `DEGRADED` (missed heartbeat, still included) / `STALE` (age > staleness — discarded) / `OUTLIER` (beyond 2.5% deviation breaker — discarded) / `HALTED` (age > 2×staleness — dead, escalates). Heartbeat table 15s/30s/15s/60s by class (`:54-59`).
- **Per-class bounds** (`oracle.ts:135-154`, imported from `blueprint.ts` ORACLE_VALIDATION): MAJOR_FX staleness 60s · confidence 0.5%; MINOR_FX 120s · 1.0%; GOLD 60s · 1.0%; VIX_DXY 120s · 2.0%; deviation breaker 2.5% class-independent (`:154`). Coarse ±50% plausible-range pre-filter (`:127-129, :452-461`).
- **Aggregate states** (`oracle.ts:101-122, :623-632`): per-pair `NORMAL` / `DEGRADED` / `FAILED`. Board aggregates over 6 pairs — EUR/GBP/JPY/CNY/CHF/XAU (`:703-728`); USD is the unit of account (price 1.0 by construction, §9.7.4).
- **Quorum** (v2.0 §17.2 reconciliation note, `oracle.ts:330-357`): ≥2 valid feeds from ≥2 families; 3 survivors → filtered-mean (median anchor); 2 survivors → average + sanity check ⇒ **DEGRADED**; <2 ⇒ **FAILED** (finalPrice 0, all operations pause). The prior strict-I9 pause-at-<3 directive is documented as superseded *in the TS layer*.
- **§17.6 Confidence** (five-factor geometric score; `ORACLE_CONFIDENCE_MIN = 0.60`, `oracle.ts:126, :561-600`): score < C_MIN ⇒ publish LKG instead of the suspect aggregate (`:603-616`, `lastPublishedRegistry`); no prior good value ⇒ fail closed for that round (`:610-614`).
- **§17.9 correlation warning** (`oracle.ts:280-312, :510-533`): raw pairwise deviation > 1.5% for 3 consecutive updates ⇒ SOURCE_CORRELATION_WARNING; **all-feeds >2.5% deviation ⇒ `oracleDispute` published and price stays PAUSED** (`:535-542`).
- **Operation gating today (the divergence)** — `VERIFIED`, `src/lib/mtq/pilot-state.ts:625-648`: FAILED (quorum lost) ⇒ mint AND redeem blocked; **DEGRADED ⇒ mint blocked, REDEMPTION REMAINS AVAILABLE** against the board's published LKG/filtered values ("exit-first doctrine"). This is a **fail-open redeem on DEGRADED** and the KNOWN DIVERGENCE this spec must close (§5.5).
- **Independence gap (honesty-disclosed):** all three "sources" are synthetic noise-perturbed witnesses around ONE live upstream per pair (`witness()`, `oracle.ts:314-328`; Chainlink = the reference itself `:405-412`; disclosure `honest-status.ts:224-228` "D-oracle-witnesses": "source-family INDEPENDENCE is therefore not yet real"). Live upstream families: Frankfurter (ECB) FX, gold-api.com XAU, FRED macro series, Yahoo fallbacks, metalpriceapi demo fallback (`DEVELOPER-REPORTED`, Stage A census; `oracle-feeds.ts:57-61`).
- **On-chain adapter read path (WIRING-1):** env-gated (`MTQ_V3_CONTRACT_ADDRESS` + `RPC_URL`, `oracle.ts:183-184`); reads V3's three adapters; on missing env/RPC failure/zero/stale adapter the function returns nulls and **falls back to the synthetic witness path** (`:210-243`) — a deliberate pilot fallback that is fail-open-to-synthetic and must become fail-closed in any real deployment (PROPOSED, D-13.15).
- **Adapter deployment honesty** (`oracle-feeds.ts:50-61`): adapters are COMPILED but NOT deployed; the three protocol-owner Oracle.sol deployments have an UNPUBLISHED ABI — real-vs-mock feeds UNVERIFIED; Solana oracle wiring deferred-G7; §17.10 three-independent-family compliance **NOT met** in the pilot.

### 1.2 Solidity (V3, SOURCE-READY — NOT DEPLOYED) — VERIFIED unless noted

- **Strict 3-source quorum** (`contracts/MTQSigmaV3.sol:1602-1668`): per-pair read of three adapters; staleness `ORACLE_STALENESS_SEC = 60`, confidence `< ORACLE_CONFIDENCE_MAX = 0.01e18`, deviation `< ORACLE_DEVIATION_MAX_BPS = 250` (`:591-593`); **<3 valid after deviation filtering ⇒ paused, finalPrice = 0** (`:1659-1664`); median of 3 (`:1666-1667`).
- **Fail-closed monetary gates:** `_requireOracleHealthy()` reverts if ANY of the 6 pairs is paused (`:1790-1798`); enforced at BM-13 workflow advance (`:912`), `executeMint` (`:972`), and `redeem` (`:1074`); `_commitPair` reverts on paused (`:1691-1696`); `oracleHealthy()` public view (`:1800-1809`).
- **Circuit breaker:** keeper price-commit paths auto-pause on >10% MTQ-price move between commits (`:1680-1696`, also wired in `setFxRates` `:1706-1710`).
- **Economic six-state machine** (`ProtocolState` `:515`; `updateState` `:1437-1461`): NORMAL / CAUTION / STRESS / DEFENSIVE / EMERGENCY / RECOVERY keyed on RR (1.30 target `:255`, 1.05 floor `:256`, 1.00 hard floor `:257`) and LCR bands; more-restrictive transitions immediate, de-escalation requires `RECOVERY_CONFIRMATION_PERIOD = 48 hours` (`:258, :1456-1458`). Minting allowed in NORMAL/CAUTION/RECOVERY with throttles 1.00/0.50/0.25 (`:1482-1491`); **redemption allowed in every state except EMERGENCY** (`:1502-1504`); EMERGENCY redeem fee row 2.00% exists in code (`:1498`) but is unreachable while redemption is paused — the known C-INV-4 contradiction (EMERGENCY redemption PAUSED per §21.4 vs legacy 2.00% fee row).
- **Pause authority:** `pause()/unpause()` behind `onlyPauser` (`:207-211`); `whenNotPaused` on redeem/rebalance. **Every privileged role today resolves to the compromised R-1 EOA** (`DEVELOPER-REPORTED`, baseline §3) — governance compromise is not hypothetical; two fully-privileged compromised keys are live facts (T13-INC-001 added a copy location).
- **Release controls** (TS side, `src/lib/mtq/release-controls.ts`, VERIFIED): 8 controls, all NOT_GRANTED by default; grants only via owner-authored authorization file outside git (`:75-132`); unknown/incomplete grant ⇒ DENIED (`:104-112, :276-291`); only `database-write` reachable in the default posture (`:241-243`).

### 1.3 What does NOT exist today (NOT IMPLEMENTED)

Depeg thresholds for accepted instruments; reorg/congestion handling rules; cross-chain message delay/replay rules (no bridge exists); admission/removal emergency paths (constituency static); a governance-compromise restricted state; an emergency runbook with disclosure timelines that bind production (RUNBOOK.md exists but is explicitly pilot-ops, not production-authorized — `DEVELOPER-REPORTED`, 13-a3); oracle-EMERGENCY → MARP interlock beyond the correlation-warning hold (the warning-based rebalance hold IS wired: `pilot-state.ts:321, 359, 389, 408` — VERIFIED; the baseline's "no oracle-emergency interlock" statement is imprecise, see §11 inconsistency INV-10.1).

### 1.4 Oracle-adjacent component inventory (file-cited honesty labels)

| Component | File | Function today | Label |
|---|---|---|---|
| Runtime consensus engine | `src/lib/mtq/oracle.ts` | 5-state feed machine, §17.2 quorum, §17.6 confidence/LKG, §17.9 correlation | Real logic; inputs SIMULATED (synthetic witnesses over 1 upstream/pair) |
| Feed configuration registry | `src/lib/mtq/oracle-feeds.ts` | Pairs/families/addresses, per-class bounds imports, honest labels | Adapters COMPILED NOT DEPLOYED; provider feeds UNVERIFIED |
| Off-chain upstream fetchers | `fx.ts`, `fred.ts`, `historical-data.ts`, gold/macro fetchers | Frankfurter / gold-api.com / FRED / Yahoo / metalpriceapi | Live HTTP upstreams; single-family per pair (independence NOT met) |
| Operation gating | `src/lib/mtq/pilot-state.ts:625-668` | Mint/redeem trial gating on board state; quote-expiry guards | SIMULATED path; DEGRADED redeem fail-open (the divergence) |
| Solidity adapters | `contracts/adapters/{Chainlink,Pyth,Chronicle}Adapter.sol` | `getPrice(bytes32)` → price/timestamp/confidence | COMPILED, NOT DEPLOYED |
| V3 on-chain consensus | `contracts/MTQSigmaV3.sol:1602-1668` | Strict-3 quorum + `_requireOracleHealthy` gates | SOURCE-READY, NOT DEPLOYED |
| Release controls | `src/lib/mtq/release-controls.ts` | 8 controls fail-closed; keeper guard | VERIFIED default-deny; only `database-write` reachable |
| Honest-status surfaces | `src/lib/mtq/honest-status.ts` | 11 gates all NOT CONDUCTED; D-oracle-witnesses disclosure | VERIFIED |

---

## 2. PROPOSED oracle independence requirements (D-13.16)

1. **Minimum independent upstreams:** ≥3 truly independent upstream *families* per pair at all times; an aggregate may be published only from ≥3 independent valid feeds. Independence means: different ultimate data providers, different aggregation/market-venue sources where the asset class permits, and no common failure domain (no single exchange, no single cloud region, no single legal counterparty). Current state: **1 live upstream per pair with synthetic witnesses — the requirement is NOT met** (disclosed, `honest-status.ts:224-228`); closing it requires contracting/wiring ≥2 additional real families per pair (Chainlink + Pyth + Chronicle adapters already compiled — `contracts/adapters/*.sol`, COMPILED NOT DEPLOYED) plus ≥3 off-chain families for the reference layer.
2. **Prohibited concentration:** the same ultimate data provider behind multiple "sources" does not count toward the quorum (e.g., two aggregators both repackaging one venue's feed). Provider-identity provenance must be recorded per sample (§2.4). A pair whose sources resolve to <2 distinct ultimate providers may not publish an ACTIVE-state aggregate regardless of feed count.
3. **Source-disagreement thresholds:** keep the class-independent 2.5% deviation breaker and the 1.5%×3 correlation-warning counter (both VERIFIED implemented, `oracle.ts:494-533`); ADD a published `maxPairDeviationPct` (already emitted, `:109`) consumed by the risk-state machine, and a dispute state (already implemented as `oracleDispute`) that requires operator attestation to clear.
4. **Provenance recording:** every consumed sample records: source family, endpoint identity, fetch timestamp, raw payload hash, parsed price/timestamp/confidence, and the ultimate-provider attribution. Provenance is append-only and published with the aggregate. NOT IMPLEMENTED today.
5. **Independence evidence review:** independence claims require an adversarial red-team report (§3) — none exists; none is claimed.

---

## 3. Manipulation resistance — PROPOSED mitigations + honest claims boundary

**Attack surface enumeration (each with current mitigation status):**

| # | Attack | Mechanism | Current status |
|---|---|---|---|
| A-1 | Single-source spoofing | One upstream feeds a false price; witnesses inherit it | Mitigation DEPENDS on independence — **currently ineffective** (witnesses derive from one upstream, `oracle.ts:314-328`) |
| A-2 | Cross-pair correlation attack | Coordinated manipulation across correlated FX/gold legs shifts the basket aggregate even with per-pair medians healthy | Partial: plausible-range + deviation breakers detect gross moves; no cross-pair joint test exists — NOT IMPLEMENTED |
| A-3 | Timestamp manipulation | Stale-but-in-window replays; clock skew at adapters; heartbeat gaming | Partial: staleness classes + 2×staleness HALTED + heartbeat DEGRADED (`oracle.ts:463-492`) — VERIFIED logic, SIMULATED inputs |
| A-4 | Rounding extraction | Repeated tiny quote/fee rounding skims across many operations | No rounding-extraction controls exist — NOT IMPLEMENTED (cross-ref deliverable 6 §6.1 rounding rule) |
| A-5 | Volume-based manipulation | Thin-venue wash trades to move an index-relevant price | Mitigation: **volume-independent sampling** (aggregates must not read traded-volume telemetry) — PROPOSED; plus per-class confidence ceilings (VERIFIED) and deviation breaker |
| A-6 | Synthetic-witness self-deception | The pilot mistakes its own noise witnesses for corroboration | Mitigated by disclosure discipline (D-oracle-witnesses) — VERIFIED as disclosed; risk remains while witnesses gate anything |
| A-7 | Feed-key/adapter compromise | Adapter reports attacker-controlled prices in-window | Partial: multi-adapter + deviation breaker; no adapter attestation/ownership pinning today — NOT IMPLEMENTED |

**Mitigations to adopt (PROPOSED):** median/filtered-mean with median validity anchor (keep — implemented, `oracle.ts:547-557`); per-class staleness and confidence ceilings (keep — implemented); deviation breaker + dispute flag (keep — implemented); volume-independent sampling (adopt — partly structural today, must be stated as a rule and tested); plausible-range pre-filter (keep); circuit breaker on aggregate MTQ price (keep — V3 compiled); adapter ownership pinning + on-chain staleness enforcement (V3 design, keep for deployment); adversarial red-team testing program (new).

**HONEST STATEMENT (no-claims rule):** none of the above constitutes evidence of manipulation resistance. Resistance claims require adversarial testing against the deployed configuration with independent sources — **NOT CONDUCTED, NOT IMPLEMENTED**. This document claims only that the *design* enumerates and addresses the enumerated surface.

---

## 4. Stale data & failure handling (PROPOSED)

### 4.1 Staleness thresholds per asset class
Keep the implemented per-class bounds (MAJOR_FX 60s/0.5% · MINOR_FX 120s/1.0% · GOLD 60s/1.0% · VIX_DXY 120s/2.0% · 2.5% deviation breaker) as the v3.0 defaults — values are Risk-Council parameters for owner approval (D-13.16). A new class for stablecoin peg pairs (deliverable 6) is PROPOSED at MAJOR_FX tightness with a wider instantaneous depeg alert band (cross-ref deliverable 6 §4 bands).

### 4.2 Last-known-good (LKG) policy — strict scope
- **MAY use LKG:** dashboards, monitoring, risk-state computation inputs, published *reference-display* values explicitly labeled `LKG (stale-display)`, and post-incident reconstruction.
- **MUST NOT use LKG:** mint pricing; **redeem pricing**; payment-instrument conversion quotes (deliverable 6 §6.1); index divisor updates; any operation creating or valuing new supply or new settlement obligations. The standing rule is fail-closed for anything creating or valuing new supply; a redeem values a settlement obligation and burns supply — pricing it at LKG is the fail-open hazard to close.
- Never silently reuse stale prices indefinitely: LKG display entries carry the source timestamp and age; a pair FAILED > 24h without recovery drops to NO-PUBLICATION (display shows unavailability, not a number).

### 4.3 Four-state operation table (the v3.0 TARGET — differs from the current TS behavior; adoption = D-13.15)

| State | Entry (evidence) | Mint | Redeem | Payment quotes | Rebalance | Index publication | Notes |
|---|---|---|---|---|---|---|---|
| `NORMAL` | 3 independent valid feeds, all pairs; confidence ≥ C_MIN; no warnings | OPEN | OPEN | OPEN | OPEN | OPEN | Current TS `NORMAL` matches |
| `DEGRADED` | Quorum met but: a 2-source path, confidence < C_MIN, or live correlation warning | **CLOSED** | **CLOSED (v3.0 target)** | CLOSED | CLOSED | display-only (LKG label) | **CHANGE vs today**: TS currently keeps redeem OPEN with LKG (`pilot-state.ts:629-634`); V3 (undeployed) already fail-closes redeem via `_requireOracleHealthy` (`:1074`) |
| `FAILED` | Quorum lost on ≥1 pair (finalPrice 0 / paused) | CLOSED | CLOSED | CLOSED | CLOSED | display-only | Matches today's both-layers behavior |
| `EMERGENCY` | Economic emergency per §6 (solvency, settlement breach, governance compromise) | per §6 matrix | per §6 matrix | CLOSED | CLOSED | frozen at last verified value | Layered on the economic state machine; oracle price gates still apply inside any open operation |

Fail-closed is the default for every cell not explicitly OPEN. The 2-source DEGRADED average-with-sanity rule (v2.0 §17.2) is retained **only as a publication-quality fallback for display/reference values**, never as a pricing input (D-13.15).

### 4.4 Incident-response runbook (PROPOSED — none binds production today)
1. **Detection:** heartbeat miss → DEGRADED alert; staleness → STALE discard alert; deviation/dispute flag; correlation-warning counter; circuit-breaker event (V3 `PriceUpdated`-adjacent); monitor dashboard gaps; external reports (issuer/depeg). Detection thresholds = the §4.1 classes.
2. **Triage + pause authority:** the on-duty operator (role UNRESOLVED — no such role exists; on-chain `PAUSER_ROLE` resolves to the compromised R-1 EOA today, `DEVELOPER-REPORTED`) may hold all quoting within 15 minutes on any FAILED/dispute evidence; formal pause requires the emergency council (nonexistent — G9 NOT CONDUCTED). Interim: release-controls keep every chain action DENIED (VERIFIED default posture).
3. **Containment:** scope the outage to the affected pairs/instruments (reference-data outages are separate from payment-instrument outages — an FX feed failure must not suspend a stablecoin instrument, and a bank-rail outage must not pause the index).
4. **Disclosure:** initial public notice within 1h of EMERGENCY/FAILED classification (what state, which pairs/instruments, effective timestamp); full report within 72h (trigger evidence, timeline, actions, remediation); every state exit published. Channel: the existing status/honest-status surfaces.
5. **Post-incident review:** mandatory for any EMERGENCY entry and any FAILED > 1h; findings append to the audit trail; parameters revised only through owner approval.

---

## 5. The KNOWN DIVERGENCE and its closure (D-13.15)

- **The divergence (VERIFIED):** the TS reference layer permits redeem on DEGRADED against LKG/published values (`pilot-state.ts:629-634`, exit-first doctrine per v2.0 §17.7); the undeployed V3 contract fail-closes redeem pricing on any paused pair (`_requireOracleHealthy`, `MTQSigmaV3.sol:1074` + `:1790-1798`).
- **v3.0 target (PROPOSED):** fail-closed redeem pricing — redeem (and payment quotes) require a healthy aggregate; LKG is display-only (§4.2). Rationale: pricing supply destruction and settlement obligations on stale data is exactly the "valuing new supply" hazard the standing rule forbids; the V3 design already chose this.
- **Alternatives considered:** (a) keep exit-first LKG redeem (rejected: creates stale-priced settlement obligations; holder-exit fairness is better served by a rapid recovery/reinstatement path and honest queueing than by stale prices); (b) LKG redeem with a haircut (rejected: introduces an unapproved economic parameter and still values obligations on stale data); (c) fail-closed redeem with a *queue-and-reprice* path: requests received during DEGRADED/FAILED are recorded (no pricing) and repriced on recovery, disclosed to the requester first (PROPOSED companion, D-13.15 option for owner selection).
- **Impact:** changing TS behavior is a breaking change to the pilot's documented v2.0 §17.7 reconciliation (`oracle.ts:349-356` records that reconciliation) — the change must be published as superseding it, not made silently.

## 6. Economic emergency states (PROPOSED)

### 6.1 Triggers and entry evidence

| Trigger | Entry evidence | Threshold (PROPOSED, D-13.17) |
|---|---|---|
| Oracle failure | FAILED on ≥1 pair beyond a 5-minute grace period | §4.3 |
| Index computation failure | index/divisor assertion failure or publication of a constraint-violating vector (sum≠1, envelope/velocity breach, negative weight) | any verified violation |
| Settlement-layer breach | verified finality violation, rail compromise, or reconciliation exception above threshold (deliverable 6 §6.5) | deliverable-6 thresholds |
| Governance compromise | credible evidence a privileged key/council seat is compromised (standing live evidence: R-1/R-2 remain REAL and fully privileged) | incident report + committee attestation |
| Solvency breach | RR < hard floor (V3: RR < 1.00 ⇒ EMERGENCY, `:1447-1448`) | economic machine (family choice pending D-13.4) |
| Instrument depeg | accepted-instrument emergency band (deliverable 6 §4) | deliverable-6 bands |

Entry is *evidence-gated, never automatic-only*: automatic detectors propose; the emergency council (nonexistent today) or owner confirms for economic triggers; oracle/solvency triggers enter automatically on verified machine evidence and are published immediately.

### 6.2 Per-state action matrix (economic six-state + oracle four-state overlay)

| Action | NORMAL | CAUTION | STRESS | DEFENSIVE | EMERGENCY | RECOVERY |
|---|---|---|---|---|---|---|
| Mint | open | 50% throttle | closed | closed | closed | 25% throttle |
| Redeem | open | open | open (fee ladder) | open (fee ladder) | **PAUSED** (§21.4; the 2.00% code row C-INV-4 is unreachable dead code — v3.0 must delete it, D-13.17) | open (0.30% TS / stress-tier V3) |
| Rebalance | open | restricted | restricted | defensive set | **frozen** | restricted |
| Parameter changes | governance path | governance path | restricted set | restricted set | **only pause-extension + safety actions** | restricted set |
| Index publication | open | open | open | open | frozen at last verified | open |
| Disclosure | periodic | alert | alert | alert | **1h notice / 72h report** | recovery notice |

Mint throttles/redeem ladder mirror the V3 six-state design (`MTQSigmaV3.sol:1482-1504`, UNDEPLOYED); fee *values* remain unapproved parameters (D-13.8). The 5-vs-6-state contradiction (C-INV-3) is resolved by adopting the six-state economic machine (V3) with the four-state *oracle/ops* table (§4.3) as a separate layer — PROPOSED for owner decision (D-13.17).

### 6.3 Recovery & reinstatement
1. Trigger condition verifiably cleared (e.g., 3 independent sources valid for the full observation window; RR recomputed above the band; breach remediated with evidence).
2. **Observation period:** 48h confirmation window (mirrors V3 `RECOVERY_CONFIRMATION_PERIOD`, `:258`) — no automatic de-escalation on raw threshold recovery; the V3 code already requires this for de-escalation (`:1456-1458`, VERIFIED).
3. Council certification + published exit notice; instrument-level reinstatement follows deliverable 6 §5 (its own 48h observation).
4. Emergency exits are one-way ratchets until certified — re-entry within the observation window restarts the clock.

### 6.4 Public disclosure obligations
Every emergency entry, exit, and parameter action under EMERGENCY is published with: state, trigger class, affected pairs/instruments, entry/exit timestamps, evidence summary, and the authority that acted. 1h initial notice / 72h full report for EMERGENCY (PROPOSED, D-13.17). The 11 §25.5 gates (all NOT CONDUCTED, `honest-status.ts:37-117`) remain the production-authorization boundary — no emergency framework changes that.

### 6.5 Cross-chain consistency requirement
The same emergency state must be visible on **every supported chain within a defined window** (PROPOSED: ≤ 5 minutes or 2× the target block time, whichever is larger — D-13.17). Today this is **NOT IMPLEMENTED and structurally impossible**: three EVM testnets + Solana are independently deployed with **no bridge, no messaging, and no shared state** (`DEVELOPER-REPORTED`, baseline §5 Stage H); each chain would need its own emergency declaration with no consistency mechanism. Implementing consistency depends on the cross-chain supply model decision (D-13.10). Interim honest position: per-chain states may diverge; any emergency declaration is published off-chain for all chains simultaneously.

---

## 7. Existing implementation vs v3.0 target — breaking changes & migration

| Dimension | TS reference layer (live pilot) | V3 Solidity (UNDEPLOYED) | v3.0 PROPOSED target | Breaking? |
|---|---|---|---|---|
| Quorum | ≥2 of 3 (v2.0 §17.2) | strict 3 (`:1638-1666`) | strict 3 independent (§2.1); 2-source average = display-only | Yes — TS behavior change |
| DEGRADED redeem | OPEN on LKG (`pilot-state.ts:629-634`) | fail-closed (`:1074`) | fail-closed + optional queue-and-reprice (§5) | Yes — closes the divergence (D-13.15) |
| LKG usage | published as price (`oracle.ts:603-616`) | none (no LKG in contract) | display-only (§4.2) | Yes |
| State machines | 3-state oracle aggregate + 6-state economic TS mirror | 6-state economic on-chain | 4-state oracle/ops + 6-state economic overlay (§6.2) | Documentation-level; C-INV-3 resolved |
| Synthetic fallback | automatic on adapter absence/failure (`oracle.ts:238-243`) | n/a (reverts) | removed for any real deployment; testnet-only | Yes for deployment posture |
| EMERGENCY redeem fee | TS RECOVERY 0.30% / EMERGENCY 2% ladder rows | 2.00% row unreachable (C-INV-4) | redemption PAUSED; delete dead row | Cleanup |

**Migration implications:** (1) V2/V3 are source-ready, NOT DEPLOYED — there is no live-contract migration constraint for the oracle policy itself; the deployed v1.2/ecosystem estate has admin-set prices and no oracle policy at all (upgrading it is a Stage H authority problem, not an oracle patch). (2) Changing the TS layer's §17.7 exit-first behavior requires publishing a supersession record (its current reconciliation note cites v2.0 §17.7 — `oracle.ts:349-356`). (3) Any adapter deployment requires the independence evidence of §2 first, else the synthetic-fallback honesty regime continues. (4) All 18 deployed contracts' source identity remains UNVERIFIED — nothing about this spec validates deployed behavior.

## 8. Security & economic implications

- **Oracle integrity is the pricing root of every operation** — mint, redeem, payment quotes, index values, and (via NAV) the settlement obligations of deliverable 6 all consume oracle aggregates. A single corrupt upstream propagates everywhere the witnesses gate.
- **The current single-upstream configuration is safe only because everything is SIMULATED** — the honest regime (witness disclosure, shadow mode, fail-closed release controls) is the actual protection today, not the consensus pipeline.
- **Fail-closed economics:** closing DEGRADED redeems trades a small liquidity convenience for elimination of stale-priced settlement obligations; the §5 queue-and-reprice alternative preserves exit *intent* without stale exit *prices*.
- **Emergency economics:** a state machine that pauses redemption under EMERGENCY (V3 §21.4) concentrates holder risk at the worst moment; the honest compensations are disclosure speed (§6.4), observation-period discipline (§6.3), and never letting a state exit on raw threshold recovery alone.

### 8.1 Risk register (spec-level)

| # | Risk | Severity | Mitigation (PROPOSED) |
|---|---|---|---|
| R-O1 | Single-upstream spoofing invisible to witnesses | HIGH | §2 independence standard (D-13.16); until met, SIMULATED labels persist |
| R-O2 | DEGRADED redeem at LKG prices creating stale-priced obligations | HIGH | D-13.15 fail-closed (or queue-and-reprice) |
| R-O3 | Synthetic-fallback surviving into a real deployment posture | HIGH | D-13.15 removal clause + deployment checklist gate |
| R-O4 | Same ultimate provider behind 3 "sources" (pseudo-quorum) | HIGH | §2.2 concentration prohibition + provenance attribution |
| R-O5 | Pause authority resolving to the compromised R-1 EOA | HIGH | Carried Task 12 D4/D8 chain (Stage H); interim = release-controls default-deny |
| R-O6 | Cross-chain emergency divergence confusing holders | MEDIUM | §6.5 window + interim honest off-chain publication; permanent fix gated on D-13.10 |
| R-O7 | Rounding-extraction micro-attacks on quotes | MEDIUM | deliverable 6 rounding rule + T-ORC-04 reporting |
| R-O8 | Correlation-warning fatigue (operators ignoring repeated §17.9 alerts) | MEDIUM | runbook triage timers (§4.4) + post-incident review requirement |

## 9. Tests required (Stage K families — PROPOSED, NOT RUN)

- **T-ORC-01 (staleness/disagreement):** per-class staleness boundary (60/120s ±1 tick); 2×staleness HALTED; heartbeat-miss → DEGRADED-not-STALE; 2.5% deviation discard; all-feeds-deviate ⇒ dispute + paused; 1.5%×3 correlation warning; confidence < C_MIN ⇒ LKG-display path, no pricing; plausible-range garbage rejection.
- **T-ORC-02 (fail-closed pricing):** DEGRADED and FAILED reject mint AND redeem AND payment quotes (the v3.0 target — will initially FAIL against current TS behavior by design, documenting the divergence); no-LKG-first-round fail-closed; synthetic-fallback absence of adapter ⇒ no pricing in deployment posture.
- **T-ORC-03 (emergency pause/recovery):** each §6.1 trigger enters the correct state on seeded evidence; EMERGENCY redemption paused; 48h observation blocks premature de-escalation; disclosure records emitted with 1h/72h clocks; per-chain state publication (once a mechanism exists).
- **T-ORC-04 (reference-vs-market reporting):** reference value, market price, deviation, and freshness published separately; LKG display entries carry staleness labels; no silent stale reuse (24h NO-PUBLICATION drop).
- **T-ORC-05 (independence/provenance, post-implementation):** two sources sharing an ultimate provider do not satisfy the quorum; provenance records complete per sample. NOT IMPLEMENTED — test written against the spec.
- **T-ORC-06 (adversarial red team, post-independence):** A-1..A-7 scenarios executed against the real source set; findings gate any manipulation-resistance claim. NOT CONDUCTED.

### 9.1 Acceptance criteria (PROPOSED — none met today)

1. ≥3 verifiably independent upstream families live per pair, with provenance records complete per sample and the concentration prohibition enforced in code. 2. The four-state table (§4.3) implemented in the pricing path — DEGRADED/FAILED reject mint, redeem, and payment quotes; LKG display-only. 3. T-ORC-01..05 green; T-ORC-06 red team executed with findings dispositioned — the precondition for ANY manipulation-resistance claim. 4. D-13.15/16/17 recorded as owner-approved with parameters filled. 5. Emergency framework operable: entry evidence recorded, disclosure clocks met in rehearsal, 48h observation enforced, cross-chain window defined or the mechanism honestly absent. Nothing in this document is acceptance evidence; no gate is advanced by documentation or tests.

## 10. Twelve-scenario mapping (mandate §11 self-check)

1 stale/missing prices → §4.1/§4.3 · 2 source disagreement → §2.3/§3 · 3 manipulated/illiquid prices → §3 + honest no-claim · 4 gold disruption → GOLD class + gold disposition D-13.12 · 5 stablecoin depeg → deliverable 6 bands + §6.1 · 6 CBDC/rail unavailability → NOT CONNECTED posture + §6.1 settlement-breach trigger · 7 congestion/reorg → deliverable 6 §6.6 reorg rules + confirmations (on-chain reorg rules NOT IMPLEMENTED) · 8 x-chain delay/replay → §6.5 (mechanism absent) · 9 abrupt admission/removal → deliverable 4 transitions + instrument-scoped suspension (never blanket) · 10 market-vs-reference deviation → T-ORC-04 reporting · 11 constraint-violating output → §6.1 index-failure trigger + §4.3 publication freeze · 12 governance compromise → §6.1 (standing live evidence R-1/R-2).

## 11. Inconsistencies & UNVERIFIED items (recorded for the orchestrator)

- **INV-10.1 (baseline imprecision):** baseline §5 Stage I states "MARP rebalance has no oracle-emergency interlock in pilot"; in fact the correlation-warning hold and anyDegraded/anyFailed rebalance gating ARE wired (`pilot-state.ts:321, 359, 389, 408` — VERIFIED). What is missing is the full EMERGENCY-state interlock for the other scenarios. Recommend correcting the baseline row.
- **INV-10.2 (known, carried):** C-INV-4 (EMERGENCY redeem PAUSED vs unreachable 2.00% fee row, `MTQSigmaV3.sol:1498` vs `:1502-1504`); C-INV-3 (5-vs-6-state); C-INV-5 (median-of-3 vs outlier-mean families); C-INV-7 (mask comment bug). All UNRESOLVED pending owner decisions.
- **UNVERIFIED:** the three protocol-owner Oracle.sol deployments' real-vs-mock feeds (ABI unpublished, `oracle-feeds.ts:53-56`); all 18 deployed contracts' source identity; Foundry suite execution (no forge in sandbox); whether upstream providers Frankfurter/gold-api.com/FRED/Yahoo remain reachable and independent (no live probe run this session — prices were not fetched). CI-runner behavior (no remote).

## 12. Assumptions & unresolved questions

1. Assumes D-13.4 (economic family) will decide which solvency thresholds drive §6 — the V3 1.30-family is used for illustration only. 2. Assumes the independence standard (D-13.16) precedes ANY production oracle claim; until then everything remains SIMULATED-witness labeled. 3. **OPEN:** who holds pause authority before councils exist (release-controls default-deny is the only real control today). 4. **OPEN:** queue-and-reprice vs hard-reject on DEGRADED redeems (§5 option c). 5. **OPEN:** cross-chain emergency window value + mechanism (§6.5, depends D-13.10). 6. **OPEN:** whether the 2-source display fallback should exist at all (strict-3 display purist alternative).

## 13. Owner approvals required (all OPEN)

- [ ] **D-13.15** (NEW): adopt fail-closed redeem/quote pricing on DEGRADED; LKG display-only scope (§4.2, §5); synthetic-fallback removal for any real deployment. *Numbers D-13.15–D-13.17 were unclaimed on disk at allocation time; the intra-wave collisions observed at D-13.13/14 (deliverables 4/7) mean final numbering is subject to orchestrator reconciliation.*
- [ ] **D-13.16** (NEW): oracle independence standard — ≥3 independent upstreams per pair; prohibited concentration; provenance recording; per-class staleness defaults; adversarial-testing evidence requirement before any manipulation-resistance claim. *Numbering subject to orchestrator reconciliation (see D-13.15 note).*
- [ ] **D-13.17** (NEW): emergency-state framework — entry evidence table (§6.1), action matrix (§6.2), 48h observation periods (§6.3), disclosure obligations 1h/72h (§6.4), cross-chain consistency window (§6.5), EMERGENCY redemption PAUSED with deletion of the dead 2.00% fee row (C-INV-4 cleanup). *Numbering subject to orchestrator reconciliation (see D-13.15 note).*
- Carried: D-13.8 (fee values in the ladder), D-13.10 (cross-chain model), D-13.12 (gold disposition), D-13.4/D-13.5 (family/stability objective), RELEASE-GRANTS + G9 councils (all pause/authority roles), T13-INC-001 disposition D-13.1.

## 14. What is NOT implemented / NOT tested (explicit)

Independence (1 upstream per pair, synthetic witnesses — disclosed); provenance recording; depeg/reorg/congestion/cross-chain/governance-compromise handlers; the fail-closed redeem change; the emergency council, pause authority, and disclosure clock machinery; cross-chain state consistency; T-ORC-01..06 (none exist; adversarial testing NOT CONDUCTED). The pilot's oracle runs on one live upstream per pair with honest SIMULATED-witness labels, and its DEGRADED state fail-opens redemption — both recorded here as gaps, not features. No manipulation resistance is claimed. Nothing in this document advances any release gate.

---

## 15. Evidence & source references (consolidated)

1. `src/lib/mtq/oracle.ts:37-49, 54-59, 101-122, 126-154, 183-184, 210-243, 314-328, 330-357, 389-437, 452-461, 463-492, 494-533, 535-557, 561-616, 623-650, 685-741` — five-state machine, class bounds, C_MIN, quorum, LKG, correlation, dispute, board. VERIFIED (read this session).
2. `src/lib/mtq/honest-status.ts:37-117, 224-228` — 11 gates NOT CONDUCTED; D-oracle-witnesses disclosure. VERIFIED.
3. `src/lib/mtq/pilot-state.ts:321, 359, 389, 408, 625-668` — operation gating; DEGRADED redeem fail-open; correlation hold; quote-expiry guards. VERIFIED.
4. `src/lib/mtq/oracle-feeds.ts:50-61` — adapters compiled-not-deployed; UNPUBLISHED ABI; off-chain families; §17.10 NOT met. VERIFIED.
5. `contracts/MTQSigmaV3.sol:207-211, 243, 255-258, 515, 591-593, 912, 972, 1054-1146, 1437-1461, 1482-1504, 1602-1668, 1691-1696, 1790-1809, 2071-2072` — pause roles, RR constants, oracle constants, fail-closed gates, six-state machine, EMERGENCY-only stability pool. VERIFIED.
6. `src/lib/mtq/release-controls.ts` (full file) — 8-control fail-closed map, authorization-file regime, default-deny. VERIFIED.
7. `audit-work/task13/baseline-and-change-matrix.md` §3, §4, §5 Stage I, §9, §11 (C-INV-3/4/5/7) — Stage A rows and contradictions. As labeled there (VERIFIED/DEVELOPER-REPORTED).
8. `audit-work/task13/unresolved-decisions-and-owner-approvals.md` — D-13.x register + carried Task 12 chain. VERIFIED.
9. Worklog 13-a2 (oracle §17 digest) and 13-a3 (services/routes census) — DEVELOPER-REPORTED, read as worklog tail this session.

---

*TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN · NOT ACCEPTED*
