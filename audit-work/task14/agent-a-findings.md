# Task 14-a — Explore Audit: Terminal Core Sections (READ-ONLY)

Agent: Explore (14-a) · Date: 2026-10-23 (late) · Scope: PilotCommandCenter internal sections (Reference/Reserve/Risk/Rebalancing/Governance/activity/faucet + top-level polling), HomeSection, DashboardSection, and the 17 supporting shared components. Every live-wired number was traced end-to-end (API field → prop → render) and compared against fresh curls of `/api/metrics`, `/api/oracle`, `/api/status`, `/api/gfb`, `/api/honest-status`, `/api/registry`, `/api/trials`, `/api/ai/risk-signals`.

Live API values used as ground truth (fetch 16:50–16:53 UTC): NAV $983,904.31 · RR 1116.80% · LCR 2187.06% · liability $881.00 · circulating 747.87 MTQ · GFB 1.1780 · P_MTQ 1.1780 · in-band · status NORMAL · oracle 6 pairs / 18 feeds valid / anyPaused=false · VIX 19.56 (z −2.05) · DXY 101.81 (z −0.21) · goldNet $233,477.11 (= PAXG $116,738.55 + XAUT $116,738.55, exact 50/50 by engine design) · observedGoldWeight 23.72% · targetGoldWeight 20.91% · bufferState BASE · bufferGoldRatio 62.5% · rebalancePath "marp" · marpExecution {applied 1 · skipped 6 · $3,268.17} · mintThrottle 1.0 (capacity) · redeemFeePct 0.0015 · honest-status gates 0/11 · implementedMask 0xFFF · authorizedMask 0x0 · version master-v1.0-pilot · risk-signals model **"fallback-rules"** (NOT Groq).

---

## (A) NUMBER-BY-NUMBER VERDICTS

Legend: LIVE = wired from API field; DERIVED = computed from live data; SPEC = hardcoded spec constant, correctly labeled; **FABRICATED/STALE = hardcoded value pretending to be live or contradicting the API (FINDING)**.

### PilotCommandCenter.tsx

| file:line | displayed value (sample) | source | verdict | evidence |
|---|---|---|---|---|
| PCC:108-116 | GFB prior weights 27/20/26/9/8/5/5% | SPEC | OK | matches /api/gfb components + blueprint STRATEGIC_PRIOR:36-44 |
| PCC:175 | GFB Index 1.1780 | LIVE `/api/gfb.gfbIndex` | OK | field exists, value matches |
| PCC:182 | P_MTQ $1.1780 | LIVE `gfb.mtqPrice` | OK | matches |
| PCC:189 | Methodology string | LIVE `gfb.methodology` (fallback §9.2 text) | OK | /api/gfb returns methodology ("Chain-linked recursive (§9.2 COO-16) — I_t = …"); fallback is spec-labeled |
| PCC:207-217, 241 | live W^Smooth / Δpp | LIVE `gfb.smoothedWeights` / `liveWeights` | OK | both arrays present; LIVE_WEIGHT_ORDER [USD,EUR,JPY,GBP,CNY,CHF,Gold] matches chainIndex.prevWeights order |
| PCC:225-227, 263 | prior % per component | SPEC | OK | identical to API weights; labeled "P = W^Prior" |
| PCC:253 | component price $… | LIVE `gfb.components[key].price` | OK | matches (e.g. Gold $4,004.62) |
| PCC:277 | "all 6 pairs live" | DERIVED | OK w/ caveat | 6 pairs confirmed; driven by `oracle.anyPaused` which **is** present top-level in /api/oracle ✓ |
| PCC:303-307 | final price, validCount/3, spreadBps | LIVE (`finalPrice`, `validCount`, `spreadBps`) + SPEC "/3" | OK | 3 feeds per pair is structural (CHAINLINK/PYTH/CHRONICLE) |
| **PCC:326-327** | "Strict I9 invariant: 3 valid feeds → median; fewer → pair paused" | STALE SPEC | **FINDING E3** | oracle.ts:333-354 (v2.0 §17.2/§17.7): quorum = **≥2** valid; 3 → "filtered-mean"; 2 → DEGRADED (mint held, **redemption available**); <2 → FAILED. The old §9.3 "<3 → pause" rule is superseded. Panel even shows method "filtered-mean" in its own table while the footnote says "median" — self-contradictory |
| PCC:367-393 | NAV / RR / LCR / liability / circulating | LIVE (`nav`, `reserveRatio`, `lcr`, `liability`, `circulatingSupply`) | OK | 1116.80% / 2187.06% / $881.00 / 747.87 all match; fmtRatio ×100 correct |
| PCC:378 | "target ≥ 110% · hard floor 100%" | SPEC | OK | RR_TARGET 1.10 / RR_HARD 1.00 (blueprint:124-126) |
| PCC:340-347, 406-433 | 7-asset breakdown + fiatNet/goldPrice/indexGold/reserveGold | LIVE (`reserve.*`) | OK | goldNet 233,477 = indexGold 140,858 + reserveGold 92,536 ✓ (note: values drift per tick; sums verified at one timestamp) |
| PCC:462 | risk state NORMAL | LIVE `snapshot.status` | OK | |
| PCC:486 | "entered: <time>" | LIVE `riskStateEnteredAt` | OK | field present (epoch) |
| PCC:491-500 | VIX 19.56 / z −2.05 / DXY 101.81 / z −0.21 | LIVE `macro.*` | OK | all four match |
| PCC:505 | worse condition "neither" | LIVE `riskStateWorseCondition` | OK | |
| **PCC:452-458** | RISK_BANDS ladder (EMERGENCY "LCR < 0.70"; RECOVERY "RR ≥ 1.10 + LCR ≥ 1.00 (48h)") | STALE SPEC | **FINDING B1** | state-machine.ts:11-27 + blueprint:487-497: EMERGENCY = RR<1.00 **only** ("hard-floor breach ONLY — LCR any"); RECOVERY = **RR ≥ 1.05 (rising), LCR ≥ 0.90**. PCC's EMERGENCY LCR column repeats DEFENSIVE's band and PCC's RECOVERY row shows NORMAL's thresholds |
| PCC:559 | Mint Throttle "100.0%" | LIVE value, ambiguous label | **FINDING E7** | `mintThrottle`=1.0 means 100% **capacity** (state-machine.ts:218-220 "fraction of normal capacity, 0 = paused"); labeled "Throttle" it reads as fully throttled. Same wording at RebalanceEngine.tsx:571 |
| PCC:563 | Redeem Fee 0.150% | LIVE `redeemFeePct` (0.0015) | OK | |
| PCC:567 | Rebalance Urgency 0.25 | LIVE | OK | |
| PCC:571-579 | Minting/Redemption ALLOWED | LIVE `mintingAllowed`/`redemptionAllowed` | OK | both true |
| PCC:584 | Confirmation Ends "—" | LIVE `riskStateConfirmationEnds` (null) | OK | honest null |
| PCC:599-601 | direction "SELL GOLD" | LIVE `rebalance.direction` (−1) | OK | |
| PCC:629 | Trade Size $0.00 | LIVE `rebalance.tradeUsd` (0) | OK | legacy path trade is 0 while shouldRebalance=true — faithful to API; visually odd but not a UI bug |
| PCC:636-645 | observed 23.7% / target 20.9% / deviation 2.8% | LIVE | OK | matches |
| PCC:656 | decision reason | LIVE `rebalance.reason` | OK | |
| PCC:660-662 | "MARP active" pill | LIVE `rebalancePath`="marp" | OK | |
| PCC:665-668 | applied 1 · skipped 6 · Σ $3,268.17 | LIVE `marpExecution` | OK | exact match |
| PCC:693-701 | MARP per-component rows | LIVE `marp.decisions` | OK | |
| **PCC:706-709** | "Read-only projection — actual mutation requires USE_MARP_EXECUTION=true" | **STALE/FALSE** | **FINDING E1 (top)** | USE_MARP_EXECUTION is **already true**; MARP is the ACTIVE path (rebalancePath="marp", marpExecution.appliedCount=1, honest-status D-marpa-active: "USE_MARP_EXECUTION = true: the per-component MARP path is the ACTIVE (simulated-pilot) execution route"). RebalanceEngine.tsx:222-231 states the opposite (correctly). PCC copy contradicts both |
| PCC:734-737 | 4 councils, 7/7 · 51% · 4/7 · 4/7, 90d/48h/24h/instant | SPEC (blueprint GOVERNANCE_HIERARCHY:476-481) | OK | design description; honest-status section right below shows gates 0/11 and G9 "no live councils" — acceptable as spec, could add "SPECIFIED — NOT OPERATIONAL" tag |
| **PCC:812-816** | "RR_TARGET ∈ [1.05, 1.20]" cited as an example of an envelope-bound changeable parameter | STALE SPEC | **FINDING E4** | blueprint.ts:429 (Task 8-b fix): RR_TARGET is **CONSTITUTIONAL, immutable** — "the former MONETARY classification was a v1.x row". The [1.05,1.20] envelope example is the superseded v1.x classification. LCR_TARGET ∈ [0.80,1.20] is still correct (RISK envelope) |
| PCC:849 | Gates Passed 0/11 | LIVE `honest.gateSummary` | OK | {passed:0,total:11} confirmed — matches TestnetStatusBar fix from E2E-LAUNCH |
| PCC:854-858 | 0xFFF / 0x0 masks | LIVE | OK | 4095 / 0 |
| PCC:864-876 | 11 gate rows w/ evidence | LIVE `validationGates` | OK | all present, 0 passed |
| PCC:882-886 | disclaimer + version + computedAt | LIVE | OK | master-v1.0-pilot, timestamp current |
| PCC:919-950 | 4s poll, hidden-tab skip, visibility refresh | — (behavior) | OK | POLL_MS 4000; verified pattern; no duplicate pollers (shared snapshot) |
| PCC:1084 | EventExplorer limit=60 | SPEC | OK | /api/trials?limit=60 works |
| PCC:1077-1080 | "live + synthetic" pill | DERIVED | OK | honest: EventExplorer mixes real DB trials + labeled synthetic events |
| PCC:1140 | "30-second cooldown after each successful claim" | SPEC | OK (verified true) | FaucetPanel.tsx:45 COOLDOWN_SECONDS=30; cooldown starts only on success (FaucetPanel:253-254) |
| PCC:1138 | "Calls /api/simulate/mint … fees, RR, circulating supply are real state changes" | DERIVED | OK | route confirmed (applyTrial + DB PilotTrial row); nuance: see E10 |
| PCC:1139 | "deterministic simulated tx hash + block number" | DERIVED | OK | makeTxHash/makeBlockNumber deterministic (FaucetPanel:90-110) |
| PCC:1145-1171 | Available test assets: MON/MockUSDC/ETH/SOL/MTQ/USDC | DERIVED | OK | matches ASSETS_BY_CHAIN exactly (FaucetPanel:63-83); 6 unique symbols |
| **PCC:1188-1191** | "10 blueprint modules · live API" | **STALE COUNT** | **FINDING E5** | InstitutionalDashboard.tsx:792-806 defines **14** tabs (A–N); its header comment says "Fetches all 14 blueprint-module API routes". "10" is wrong |

### HomeSection.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| Home:72 | prior basket 27/20/9/8/5/5/26 + "20-32% envelope" | SPEC | OK | matches STRATEGIC_PRIOR + ADMISSIBILITY_ENVELOPES.Gold |
| Home:86 | "110% Reserve Ratio target" | SPEC | OK | RR_TARGET |
| Home:92-95 | RR fallback "∞" when no snapshot | DERIVED | minor | loading-state oddity (implies infinite over-collateralization before data arrives); LiveMonetaryState:174 does the same but labels it "∞ — fully reserved" |
| Home:124-140 | NAV / RR / P_MTQ / status cards | LIVE | OK | all match |
| Home:357, 380 | PAXG / XAUT $116.7K each | LIVE `perIssuer.paxgUsd/xautUsd` (fallback `goldNet/2` dormant) | OK | perIssuer present; the engine itself models an exact 50/50 PAXG/XAUT split (registry.ts:54 comment; paxgOz == xautOz), so even the fallback equals the engine's model |
| Home:360, 383 | "$3,983/oz" | LIVE `reserve.goldPrice` | OK | 3983.18 |
| Home:363, 386 | "Haircut: 1.0%" PAXG/XAUT | SPEC | OK | registry haircuts 0.01 for both |
| Home:397-409 | observed 23.72% / target 20.91% / BASE / 62.5% | LIVE | OK | match |
| **Home:412-418** | gold progress bar `width = obs*100/30*100` with labels "20% envelope floor … 32% envelope ceiling" | DERIVED | **FINDING B2 (math/scale)** | bar is scaled 0→30% but labeled 20→32%: observed 23.72% renders at 79% width where the labels imply ~31%. ReserveVault's gauge (ReserveVault.tsx:214-215) correctly uses `((obs−lower)/(upper−lower))` |
| Home:426-439 | gold prose (26% prior, 20-32%, 1.0% haircut §14.1.1, ρ 0.50/0.75, 24h lock w/ RR<1.05 override, 10% pool depth) | SPEC | OK | all match blueprint + D-marpa-active disclosure |
| Home:477-483 | "Live · 4s poll" + oracle-live pill | LIVE (`oraclePaused`) | OK | field present (false) |
| Home:533 | "MTQΣ on 4 Testnets" + 4 address cards | LIVE `CANONICAL_MTQ_ADDRESSES` (4 entries) | OK | monad/arc/robinhood/solana; addresses match /api/status canonical fields |
| **Home:560-562** | "Every metric on this site is computed live by the reference engine and reconciled against the blueprint." | COPY | **FINDING E6 (overclaim)** | false as stated: ReferenceChart history/markers, RiskTimeline, EventExplorer synthetic rows, faucet cooldown/asset list, ReferenceSection prior weights, ParameterRegistry table are client-side synthetic or hardcoded spec constants |

### DashboardSection.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| Dash:2 | comment "Renders all 22 existing MTQ components" | — | trivial | ~30 components rendered; stale comment only (not user-facing) |
| Dash:220-222 | oracleValidCount 18/18 (Σ validCount; pairs×3) | DERIVED | OK | 6 pairs × 3 feeds, all valid |
| Dash:258 | RR `{(reserveRatio).toFixed(4)}` in §1.1 line | LIVE | OK | 1116.8041 — displayed as raw ratio (11.1680) not % — minor formatting inconsistency vs everywhere else (percent) |
| Dash:378 | WeightChangeDrawer tick = fetchedAt/4000 | DERIVED | OK | |
| Dash:436 | "Contract Registry · 4 Testnets" | SPEC | OK | CANONICAL_MTQ_ADDRESSES has 4 |
| Dash:468 | "16 parameters · 6 calc" | SPEC | OK-ish | ParameterRegistry.tsx:20-37 PARAMS has exactly 16 rows ✓; "6 calc" is unexplained (no visible "6 calculated" grouping in the panel) |
| Dash:184-204 | shared-snapshot / standalone polling | — | OK | dedupe works; no double poller (E2E-LAUNCH fix verified still in place) |

### LiveMonetaryState.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| LMS:101 | "normalised = 1.00 at 2026-01-01 00:00 UTC" | SPEC | OK (verified) | Master Blueprint §3.4: "At the genesis timestamp (January 1, 2026, 00:00 UTC …) the basket is seeded … so that the index starts at exactly 1.0000" |
| LMS:104 | "GFB_base = $650.64" | SPEC | OK | GFB_BASE_DENOMINATOR = 650.644103 = /api/gfb chainIndex.baseDenominator ✓ |
| LMS:124-136 | safety band 0.50–2.00 | SPEC (blueprint:225-226) | OK | matches PRICE_SAFETY_LOWER/UPPER |
| LMS:145-161 | NAV/fiatNet/goldNet/goldPrice | LIVE | OK | |
| LMS:177-183 | TGT 110% / STR 105% / HRD 100% pills + policy rrTarget | SPEC+LIVE | OK | RR_TARGET/RR_STRESS/RR_HARD; policy row from RISK_STATE_MACHINE (NORMAL rrTarget 1.10) |
| LMS:191-205 | LCR 2187.06% · formula · "STRESS_REDEMPTION_RATE 25% / 30 days" | LIVE+SPEC | OK | matches STRESS_REDEMPTION_RATE 0.25 (blueprint:128) |
| LMS:215-266 | NAV per MTQ $1,315.7248 · Δ +111580.91% · status stress | LIVE `indexNavDivergence` | OK | honest: tiny circulating supply (747.87) vs $983K NAV ⇒ navPerMtq 1315.72; divergencePct 111580.9 matches; status "stress" → rose tone wired correctly |
| LMS:226-242 | navPerMtq / pMtq / divergence / status | LIVE | OK | all four fields present |
| LMS:289-298 | minting/redemption/rebalancing/RR target policy row | LIVE policy lookup (blueprint table) | OK | NORMAL → Allowed/Allowed(0.15%)/Active(urgency 1)/110% |
| LMS:303-325 | supply 747.87 / total 1,000,747.87 / genesis 1,000,000 | LIVE | OK | all match |
| LMS:343-356 | FX grid (6 pairs) | LIVE `fx.*` | OK | values match |
| **LMS:358-369** | "VIX · live" / "DXY · live" chips | hardcoded label | **FINDING B3 (unwired)** | `fx.liveVix` / `fx.liveDxy` (both true now) and `fx.degraded` exist in the API but the chips say "live" unconditionally — if Yahoo rate-limits and the OU-walk fallback engages, chips still say "live" (the header pill at :338 does show "degraded", the chips don't follow) |
| LMS:371-376 | "All 8 macro signals are now live." | COPY | minor | true now (fx.liveCount=8) but hardcoded prose, will be stale in degraded mode |

### ReferenceChart.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| RC:92-195 | 1D…MAX line shape | SYNTHETIC (disclosed) | OK w/ caveat | seeded mulberry32 walk; honestly labeled at :622 "Synthetic pilot history · live endpoint tracks the engine's chain-linked I_t" |
| RC:135 | last point forced to live gfbIndex | LIVE | OK | |
| RC:139-181 | risk/marp/weight markers with specific event claims ("Risk → STRESS…", "MARP rebalance… deviation exceeded no-trade zone (L6), 50% partial correction", "EMA λ=20% smoothing applied") | SYNTHETIC (partially disclosed) | **FINDING E8** | markers describe events that never happened; the legend says synthetic but each tooltip reads like a real historical event. Real transitions exist in the DB (DailyStateVector 219 rows / RebalancingDecision 2,536 rows per backup manifest) — wire or watermark inline ("illustrative") |
| RC:490-558 | Live attribution: price/alloc pp, Σ return, cost $, per-component contributions | LIVE `snapshot.attribution` | OK | all attribution fields present in /api/metrics |
| RC:520-523 | "Rebal. 0.000pp · §9.3" | SPEC | OK | divisor-neutralized rebalancing is structurally 0 — labeled with rationale (API does carry `attribution.rebalancingEffectPct`; could be wired but 0 is the invariant) |
| RC:601-604 | period change/high/low | DERIVED (from synthetic series) | OK w/ same caveat | computed from the synthetic walk; disclosed |
| RC:630-635 | "Last step sampled HH:MM:SS" | LIVE `attribution.sampledAt` | OK | |

### ReserveVault.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| RV:42-48 | fiat/gold % of NAV, buffer 10%/core 90% | LIVE + SPEC | OK | BUFFER_SIZE 0.10; bufferGoldRatio derived from bufferState (BASE 62.5%) matches snapshot.bufferGoldRatio |
| RV:53-58, 295-300 | token labels "USDC", "EURC", **"GBP₿", "JPY₿", "CNY₿", "CHF₿"** | SPEC-ish labels | **FINDING E9** | /api/registry: GBP/JPY/CNY stablecoins are "TBD (governance-pending)" state WATCH; CHF not in registry at all. Displaying concrete token tickers (with a spurious ₿ suffix) implies admitted instruments that don't exist. Should read "GBP (modeled)" / "registry-pending" |
| RV:59-60, 301-302 | PAXG/XAUT values | LIVE `perIssuer` (fallback /2) | OK | engine models exact 50/50; values match |
| RV:175-187 | BUFFER 10% · 62.5% Au · CORE 90% · "20% Au · 80% fiat" | SPEC | OK | CORE_GOLD_WEIGHT 0.20 |
| RV:194 | NAV center readout | LIVE | OK | |
| RV:205-281 | Gold weight gauge (envelope 20–32%, prior 26%, obs/tgt live, legacy-formula caveat) | LIVE + SPEC | OK | exemplary honest panel: labels the legacy [22,30] formula "pre-MASE genesis fallback only — not the live rule" |
| RV:341 | per-asset % of total | DERIVED | OK | |

### ReserveDonut.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| RD:14-22 | 7 hardcoded prior weights | SPEC | OK | honestly captioned (:84-94) "Strategic Prior composition (§3.2) — live reserve weights differ (see Reserve Vault)" |
| RD:79 | NAV/1000 "$983.9K" | LIVE | OK | |
| RD:81 | "7 components" | SPEC | OK | |

### RiskSignals.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| **RS:237** | "Generated by Groq (llama-3.3-70b) from the live snapshot." | COPY | **FINDING E2 (top)** | live `/api/ai/risk-signals` returns `"model":"fallback-rules"` (rule-based fallback — no Groq key in env). The model Pill (:243-249) honestly shows "fallback-rules" (muted tone) while the prose right above claims Groq. False attribution |
| RS:106-133 | fetch + 15s poll | — | OK | matches documented behavior |
| RS:297-300 | "Generated {ago} · {n} signals" | LIVE | OK | 1 signal (TETHER concentration warn) — matches live concentration report |

### RiskStateMachine.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| RSM:49 | current state | LIVE | OK | |
| **RSM:69** | `grid-cols-5` for the 6-state track | LAYOUT BUG | **FINDING B4** | RISK_STATE_MACHINE has 6 entries (blueprint:492-497) — RECOVERY wraps to a second row, breaking the horizontal "track" line (RSM:68) and the "6-state horizontal track" claim (RSM:66) |
| **RSM:103** | state letter map N/C/D/E/R | BUG | **FINDING B5** | STRESS falls through to "R" (should be "S"); RECOVERY is the only "R". STRESS circle displays "R" |
| RSM:138-159 | §14.1 policy matrix (fees/throttle/rrTarget per state) | SPEC (blueprint RISK_STATE_MACHINE) | OK | rendered from the blueprint table, incl. live "current" highlight |
| RSM:191-227 | governance 4-tier cards | SPEC (blueprint GOVERNANCE_HIERARCHY) | OK | authority/timelock match |

### RiskTimeline.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| RT:86-240 | 10 synthetic transitions (dates, RR/LCR bands, triggers, evidence) | SYNTHETIC (disclosed ×3) | OK w/ upgrade note | disclosed at :287-288, :363-367; real history exists in DB (DailyStateVector 219 rows) — wire-up opportunity |
| RT:196-202 | per-state fee schedule ("Mint 0.1% · redeem 0.15%" …) | SPEC | OK | matches §14.1/RISK_STATE_MACHINE rows |
| RT:294 | "{n} transitions" | DERIVED | OK | |

### RebalanceEngine.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| RE:130-131, 137 | tab default = snapshot.rebalancePath; MARP ACTIVE badge | LIVE | OK (minor) | if the component mounts before the first snapshot lands, the useState initializer sticks at "legacy" and never follows the live path — minor default-tab bug |
| RE:143-151 | lcrBreach / crisisActive | DERIVED | OK | |
| RE:172-179 | active path + gold target source pills | LIVE (`rebalancePath`, `executionTargetSource`="mase-envelope") | OK | |
| RE:182-186, 219-233 | Appendix-F honest gate note | SPEC | OK | matches honest-status D-cost/disclosures |
| RE:262-283 | observed/target/deviation/trade | LIVE | OK | |
| RE:307-333 | λ₁–λ₄ 0.40/0.30/0.20/0.10 — labeled HISTORICAL/NON-OPERATIVE | SPEC | OK | labeled "UNAPPROVED… must not gate trades" |
| RE:343-364 | slippage 0.5/1.0/1.5% · turnover 5% · pool 10% · lock 24h · quote providers | SPEC (blueprint imports) | OK | all match blueprint:201,262-264 |
| RE:413-429 | index gold $140.9K / reserve gold $92.5K / total $233.5K | LIVE (`reserve.indexGoldNet` etc.) | OK | sums verified |
| RE:446-499 | MARP table + Σ summary | LIVE (`marp.decisions`, `marpExecution`) | OK | matches live values |
| RE:559 | LCR floor 1.00 | SPEC | OK | LCR_TARGET |
| RE:571 | "mint throttle 100%" | LIVE value / ambiguous label | see E7 | same capacity-vs-throttle wording issue |
| RE:596-615 | crisis-mode table (×2 band, ×0.5 size, 5% cap…) | SPEC | OK | labeled "pilot instantiations of the 'may' clauses (no operative number is published)" |
| RE:629-643 | per-class τ table | SPEC | OK | |
| **RE:659** | "$17.82/trade*" | hardcoded estimate | OK (disclosed) | footnote gives full derivation (150k gas × 30 gwei × $3,000 ×1.32 = $17.82; math checks out) and states "no live gas oracle in the shadow pilot; GAS_FALLBACK $50 DISABLED" — acceptable labeled illustration |
| RE:671 | Protocol fee 0.20% | SPEC (REBALANCE_FEE_BPS 20) | OK | |
| RE:679-681 | 25/30/35% concentration tiers | SPEC | OK | matches CONCENTRATION_* blueprint constants |

### SystemHealth.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| SH:190 | "tick: — · uptime: —" | hardcoded placeholder | OK (disclosed) | honest note :518-521 explains the fields aren't exposed |
| SH:198-200 | "8/8 live", source string, VIX/DXY | LIVE (`fx.liveCount`, `source`, fx values) | OK | liveCount=8, source matches |
| SH:207-209 | I_t 1.178011 · Ref Idx · Ref Val · in band | LIVE (`chainIndex.I_t`, `gfbIndex`, `mtqPrice`, `priceInBand`) | OK | |
| SH:227-229 | oracle "live" · 18/18 feeds · 6 pairs × 3 | LIVE + SPEC | OK | |
| SH:236-238 | top issuer TETHER @ 25.57% · warn | LIVE `concentration[0]` | OK | matches (⇒ live panel correctly shows 7/8 healthy, 1 WARN) |
| SH:245-247 | reconciliation counts (0 outstanding …) | LIVE `reconciliation` | OK | |
| SH:253-256 | Audit Trail "populated · HEALTHY" | hardcoded | OK (disclosed) / improvement | classifyAuditTrail always HEALTHY (:153-156); disclosed "no counts endpoint (kept simple)" — but /api/trials and the DB exist; a counts endpoint would make this real |
| SH:436 | "X/8 healthy" | DERIVED | OK | |

### OracleConsensus.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| OC:121-126 | three-state board (failed/degraded/paused), validTotal 18/18 | LIVE (`oracleFailed`, `oracleDegraded`, pairs) | OK | fields present (all false now) |
| OC:124, 149-151 | Confidence_G 92.7% (C_min 60%) | LIVE `oracleGoldConfidence` (0.9274) | OK w/ nuance | per-pair (XAU) 5-factor confidence; honest-status says the protocol-wide §17.6 aggregate is not computed — the label "Confidence_G" for the gold pair's score is slightly generous; fine if understood as the gold-pair gate |
| OC:161-179 | staleness 60s · confidence <1.0% · deviation <2.5% · quorum ≥2 · C ≥ 0.60 | SPEC (blueprint ORACLE_*) | OK | matches oracle.ts:154 etc. |
| OC:226 | "Pyth & Chronicle … synthetic witnesses" honest note | COPY | OK | exemplary disclosure |

### InstitutionalHero.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| IH:65 | "testnet · live" | DERIVED (oracleOk) | OK | |
| IH:71 | oracle 6/6 | LIVE | OK | |
| IH:301-305 | RR / NAV / Status / VIX / DXY pills | LIVE | OK | all match |
| IH:316 | "v1.0 · reference engine · t 1792774367" | SPEC + LIVE | minor | "v1.0" aligns with honest-status version master-v1.0-pilot; the raw epoch-seconds "t …" is user-hostile formatting |
| IH:338-345 | Gold Anchor 2.4616 g/MTQΣ | LIVE `holdings.perMtq.goldGrams` | OK value | "· live backing" wording → **FINDING E10** (see copy) |
| IH:363-423 | snapshot cards (index, value, NAV, PAR 1.00) | LIVE + SPEC | OK | PAR immutable §18.1 ✓ |

### BasketValueDisplay.tsx

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| BVD:64-137 | gold grams 2.4616 g · oz 7.914e-2 · index/reserve split oz | LIVE `holdings.perMtq`, `holdings.indexGoldOz/reserveGoldOz` | OK | all live |
| BVD:141-180 | per-asset native quantities + NAV shares | LIVE (`holdings.perMtq.*`, `navShares.*`) | OK | shares sum 100.00% ✓ |
| BVD:73-76 | basis label (circulating vs total) | LIVE `holdings.basis` | OK | |
| **BVD:96** | "1 MTQΣ — Backed by the Live Reserve Basket" / "Live · Reserve Backing" | COPY | **FINDING E9-adjacent** | values are engine-live, but the reserve is the simulated pilot ledger (G8: "pilot reserve is simulated … no on-chain proof of real reserve assets") — "Backed by" needs a simulated-pilot qualifier |
| **BVD:200** | "PAXG · XAUT — allocated, vaulted bullion" | COPY | **FINDING E9 (top-tier)** | asserts real vaulted bullion for modeled holdings |
| **BVD:205-207** | "held in its own vault, issued by its own issuers, independently custodied" | COPY | **FINDING E9** | no vaults, no custody, no issuers exist in the pilot — this directly overstates the honesty posture |
| BVD:235-238 | USD reporting-numeraire footnote | LIVE | OK | honest anti-peg disclaimer |

### FaucetPanel.tsx / EventExplorer.tsx (supporting the PCC faucet/activity sections)

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| FP:45-47 | cooldown 30s · default 1,000 · max 100,000 | SPEC | OK | rendered at :464-465 |
| FP:63-83 | asset catalogue per chain | SPEC | OK | PCC side-panel list matches exactly |
| FP:90-110 | deterministic hash/block | DERIVED | OK | disclosed "simulated · no on-chain broadcast" |
| FP:215-247 | engine response (mtqMinted, price, RR post) | LIVE `/api/simulate/mint` | OK | V2/V3 alias shim documented in the route |
| **FP:70** | Arc "USDC — Native gas token (testnet)" | SPEC | minor | USDC described as Arc's native gas token — dubious; verify or reword ("testnet gas/fee token" only if true) |
| FP (design) | asset selector is cosmetic | BEHAVIOR | **FINDING E11 (nuance)** | /api/simulate/mint ignores the asset symbol: every claim mints against `amount` as USDC and the DB PilotTrial row logs `inputSymbol:"USDC"` even when the user "claimed" MON/ETH/SOL. The faucet result card shows "Asset: 1,000 SOL" next to an engine mint recorded as 1,000 USDC — inconsistent audit trail; disclose ("asset choice is cosmetic; all claims mint against the USDC path") or wire the symbol through |
| EE:143-367 | synthetic events (genesis, validation "141/141", governance proposals, oracle/weight/reserve/risk/rebalance rows) | SYNTHETIC (labeled) | **FINDING E12** | every row carries a "simulated" chip (:662) + detail disclosure (:766) ✓, BUT the fabricated contents include (a) "Canonical invariants · 141/141 tests" — the real canonical suite is 246/246 (+ Layer-7 ⇒ 253/253 per worklog), and "1 stress rerun failed (turnover cap)" — a fabricated failure; (b) governance proposals ("RR floor 1.05 → 1.06" executed/cancelled) — no governance exists (G9 NOT CONDUCTED). Recommend prefixing descriptions with "SIM:" or wiring Validation to /api/tests and dropping fabricated governance rows |
| EE:429-453 | real trials from /api/trials merged in, sorted | LIVE | OK | |
| EE:783-789 | footer disclosure | COPY | OK | |

---

## (B) WIRING BUGS

1. **B1 — PCC RISK_BANDS contradicts the canonical state machine** (PilotCommandCenter.tsx:452-458). EMERGENCY row shows LCR "< 0.70" but §21.2/state-machine.ts:14 says EMERGENCY is the RR<1.00 hard-floor breach **only** (LCR any). RECOVERY row shows "RR ≥ 1.10 + LCR ≥ 1.00 (48h confirm)" but canonical S6 is **RR ≥ 1.05 (rising), LCR ≥ 0.90** (state-machine.ts:15, blueprint:496). Fix: EMERGENCY lcr → "any"; RECOVERY rr → "≥ 1.05 (rising)", lcr → "≥ 0.90", keep 48h note as exit-confirmation.
2. **B2 — HomeSection gold-weight bar scale bug** (HomeSection.tsx:413). `width = observed*100/30*100`% scales 0–30% while the bar is labeled 20% floor / 32% ceiling (:415-418). observed 23.72% renders 79% wide (implies ~31% on the labeled scale). Fix: `((observed−0.20)/(0.32−0.20))*100` clamped, matching ReserveVault.tsx:214-215.
3. **B3 — VIX/DXY "· live" chips never reflect fallback mode** (LiveMonetaryState.tsx:358-369). API exposes `fx.liveVix`/`fx.liveDxy`/`fx.degraded`; chips hardcode "live". Wire tone/label to the booleans (header pill at :338 already handles `degraded`).
4. **B4 — 6-state track rendered in a 5-column grid** (RiskStateMachine.tsx:69). RISK_STATE_MACHINE has 6 entries; RECOVERY wraps, breaking the track line and the "horizontal 6-state" design. Fix: `grid-cols-6` (or auto-fit).
5. **B5 — STRESS state letter renders "R"** (RiskStateMachine.tsx:103). Ternary chain maps NORMAL→N, CAUTION→C, DEFENSIVE→D, EMERGENCY→E, else→R — STRESS and RECOVERY both fall to "R". Fix: add STRESS→"S".
6. **B6 — RebalanceEngine default tab sticks to "legacy" when mounted before the first snapshot** (RebalanceEngine.tsx:130). `useState(snapshot?.rebalancePath ?? "legacy")` is computed once; if mounted with a null snapshot (fast navigation), it never follows the live path. Low severity (badge still shows MARP ACTIVE). Fix: key the component on path or use an effect to sync once.
7. **B7 — DashboardSection §1.1 line prints RR as a raw ratio** (DashboardSection.tsx:258): `RR {(snapshot?.reserveRatio ?? 0).toFixed(4)}` → "RR 1116.8041" — every other surface formats RR as a percentage (fmtRatio). Formatting inconsistency, wrong unit for the audience.
8. Minor: ReferenceSection's own table shows method "filtered-mean" while its footnote claims "3 valid feeds → median" (PCC:306 vs :326) — see E3; the data is live, the prose is stale.

No dead props were found on the snapshot path: every field referenced across the audited components (`oraclePaused`, `oracleFailed`, `oracleDegraded`, `oracleGoldConfidence`, `perIssuer`, `holdings`, `navShares`, `attribution`, `indexNavDivergence`, `riskStateEnteredAt/ConfirmationEnds/WorseCondition`, `mintThrottle`, `redeemFeePct`, `rebalanceUrgency`, `mintingAllowed`, `redemptionAllowed`, `rebalancePath`, `executionTargetSource`, `marp`, `marpExecution`, `concentration`, `reconciliation`, `waterfall`, `bufferState`, `bufferGoldRatio`, `chainIndex.I_t`) exists in the live /api/metrics payload and matches the rendered values.

---

## (C) REDUNDANCY / GROUPING OPPORTUNITIES

1. **Oracle consensus rendered twice**: PCC ReferenceSection's 6-row table (PCC:270-331) vs DashboardSection's full `OracleConsensus` panel (Dash:315-328). Same data, two designs, and the PCC one carries the stale I9 footnote. → Drop the PCC table; embed `<OracleConsensus snapshot={snapshot} oracle={undefined} />` (it already falls back to `snapshot.oracle`) or link to the dashboard panel.
2. **MARP decision table rendered twice**: PCC RebalancingSection table (PCC:673-712) vs DashboardSection RebalanceEngine MARP tab (RE:431-508). Same `marp.decisions` + `marpExecution` summary. → Keep RebalanceEngine (richer: §11.7 events, levels, crisis set); reduce PCC RebalancingSection to the 4 summary Stat cards + reason + a link, dropping its duplicate table (and its stale read-only note).
3. **RR / NAV / P_MTQ / status shown ~7×**: HomeSection QuickStatsRow (Home:116-151) + LiveStatsBand (Home:168-199) + InstitutionalHero pills + Protocol Snapshot cards (IH:294-424) + DashboardSection hero line (Dash:256-259) + LiveMonetaryState tiles + SystemHealth rows + ReserveSection cards. → Merge HomeSection's QuickStatsRow and LiveStatsBand into one stats band (they render back-to-back on the same page with 4 of 4 overlapping metrics).
4. **Reserve composition visualized 5×**: ReserveSection bars (PCC:396-436), ReserveVault diagram+bars (Dash:339-342), ReserveDonut (Dash:236), BasketValueDisplay per-asset grid (Home:200), GfbBasket/GoldInReserve (Dash:478-482). → On the dashboard, ReserveDonut + ReserveVault are both composition visuals rendered one screen apart; keep ReserveVault (live weights) and drop the donut (prior-only) or move the donut to the Reference section where the prior belongs.
5. **Risk-state ladder duplicated 3×**: PCC RISK_BANDS cards (PCC:452-547), RiskStateMachine track+policy matrix (Dash:440-443), RiskTimeline's local rr/lcr band functions (RT:242-256). → Single shared `RISK_BANDS` constant (fixed per B1) consumed by all three.
6. **Governance 4-tier cards rendered twice + once dead**: PCC GovernanceSection COUNCILS (PCC:733-802) vs RiskStateMachine's Governance Hierarchy panel (RSM:166-229) vs dead GovernanceHierarchy.tsx. → Merge: the dashboard's version (with crests + brand tiers) is richer; PCC's governance section could embed it and drop its parallel COUNCILS copy (they differ only in scope prose).
7. **Mint/Redeem simulators in two nav destinations**: DashboardSection "Mint & Redeem Simulators" (Dash:387-411) vs dedicated MintSection/RedeemSection. → Keep the dedicated sections; replace the dashboard pair with links (removes a duplicated interactive block and its shared wallet/chain state duplication).
8. **Gold-weight gauge 3× (one dead)**: HomeSection gold card gauge (scale-buggy, B2), ReserveVault inline gauge (correct, honest), dead GoldWeightGauge.tsx. → Keep only ReserveVault's; fix or remove HomeSection's bar.

---

## (D) REMOVAL CANDIDATES

1. **src/components/mtq/GoldWeightGauge.tsx — zero importers (dead)**. Also uses SUPERSEDED constants (BASE_GOLD_WEIGHT 26.25%, GOLD_WEIGHT_LOWER/UPPER 22/30% — blueprint.ts:566-568) contradicting the live 20–32% envelope. Delete.
2. **src/components/mtq/GovernanceHierarchy.tsx — zero importers (dead)**. Its data source (GOVERNANCE_HIERARCHY) is still used by RiskStateMachine. Delete the component.
3. **src/components/mtq/MetricCard.tsx (+PanelSection) — zero importers (dead)**. Delete.
4. **CurrencySelector.tsx — mounted-but-unconsumed feature**: `CurrencyProvider` wraps the entire app in app/layout.tsx:115 but **no component calls `useCurrency()`**, and `CurrencySelector`/`CurrencySymbolBadge` have zero render sites. Either remove the provider from the root layout (bundle savings) or finish the display-currency feature. Currently it is dead weight at the app root.
5. **PCC RebalancingSection duplicate MARP table** (PCC:673-712) per C2.
6. **PCC ReferenceSection oracle table** (PCC:270-331) per C1 (or fix footnote E3 and keep as the light variant).
7. **ReserveDonut on the dashboard** (Dash:236) per C4 — prior-only donut adjacent to the live vault diagram.
8. **EventExplorer fabricated Governance rows** (EE:187-210) per E12 — synthetic governance proposals should go (no governance exists to illustrate "cancelled (outvoted)").
9. Stale comment DashboardSection.tsx:2 ("22 existing MTQ components") — update or drop.

---

## (E) COPY/CLAIM CORRECTIONS

- **E1 (top)** — PilotCommandCenter.tsx:708: "Read-only projection — actual mutation requires `USE_MARP_EXECUTION=true`." → FALSE. The flag is already true; MARP is the ACTIVE path (live `rebalancePath:"marp"`, `marpExecution.appliedCount:1`; honest-status D-marpa-active; RebalanceEngine.tsx:222-231 says the opposite, correctly). Reword: "Engine-internal records — MARP executes in the simulated pilot (shadow-mode); no on-chain settlement."
- **E2 (top)** — RiskSignals.tsx:237: "Generated by Groq (llama-3.3-70b) from the live snapshot." → live model is `fallback-rules` (no Groq key). Reword dynamically from `data.model` (the Pill already shows it): e.g. "Rule-based fallback signals from the live snapshot (Groq unavailable)."
- **E3** — PilotCommandCenter.tsx:326-327: "Strict I9 invariant: 3 valid feeds → median; fewer → pair paused (mint / redeem / rebalance halt)." → superseded v1.x rule. Live rule (oracle.ts §17.2/§17.7): quorum ≥ 2; 3 valid → filtered-mean; 2 → DEGRADED (mint+rebalance held, redemption AVAILABLE); <2 → FAILED (all paused). Also self-contradicts the panel's own method column ("filtered-mean").
- **E4** — PilotCommandCenter.tsx:812-816 cites "RR_TARGET ∈ [1.05, 1.20]" as an envelope example for the three non-constitutional layers → RR_TARGET is CONSTITUTIONAL/immutable since the Task 8-b fix (blueprint.ts:429). Same staleness in **ParameterRegistry.tsx:22** ("RR Target … Monetary, DAO 51%, 48h, GOVERNED"). Pick a still-valid example (e.g. LCR_TARGET ∈ [0.80, 1.20], fees, MIN_PROFITABILITY_USD ∈ [0, 1000]).
- **E5** — PilotCommandCenter.tsx:1190: "10 blueprint modules · live API" → the Institutional Dashboard renders **14** modules (A–N; file comment "Fetches all 14 blueprint-module API routes"). Derive the count from TABS.length or say 14.
- **E6** — HomeSection.tsx:560-562: "Every metric on this site is computed live by the reference engine and reconciled against the blueprint." → overclaim (synthetic chart history, synthetic risk timeline, synthetic explorer events, hardcoded spec tables). Reword: "Core monetary metrics are computed live by the reference engine; illustrative/synthetic panels are labeled as such."
- **E7** — "Mint Throttle 100.0%" (PCC:558-560) and "mint throttle 100%" (RebalanceEngine.tsx:571): the field is **capacity** (1.0 = unthrottled; 0 = paused — state-machine.ts:218-220). Rename to "Mint Capacity" or display `1 − throttle` as the throttle.
- **E8** — ReferenceChart.tsx:139-181: synthetic markers present specific historical claims ("Risk → STRESS … triggered an automated transition", "MARP rebalance … 50% partial correction applied", "EMA λ=20% smoothing applied"). Legend discloses synthetic, but tooltips read as real events; real transitions exist in the audit DB. Watermark inline ("illustrative") or wire to the audit trail.
- **E9 (top-tier truth-posture)** — BasketValueDisplay.tsx:96 ("Backed by the Live Reserve Basket"), :200 ("PAXG · XAUT — allocated, vaulted bullion"), :205-207 ("held in its own vault, issued by its own issuers, independently custodied") — the pilot reserve is a **simulated ledger** (G8: "pilot reserve is simulated … no on-chain proof of real reserve assets"). Add the missing qualifier ("simulated pilot reserve ledger — no real custody") to the panel; keep the live numbers. Same class: InstitutionalHero.tsx:345 "of gold / MTQΣ · live backing" → "· live pilot ledger" (or similar).
- **E10** — InstitutionalHero.tsx:251 tagline "Real Assets · Transparent Governance · Global Reach" → "Real Assets" overstates the testnet/simulated-reserve posture. Suggest "Designed for real-asset backing · …".
- **E11** — FaucetPanel asset selector is cosmetic: every claim mints via the USDC path and the DB logs `inputSymbol:"USDC"` regardless of the chosen MON/ETH/SOL/USDC (route: app/api/simulate/mint/route.ts). The PCC "What this faucet does" copy (PCC:1137) implies the asset matters. Disclose or wire the symbol through. Also FaucetPanel.tsx:70 describes Arc "USDC" as "Native gas token (testnet)" — verify before shipping.
- **E12** — EventExplorer.tsx:174: synthetic Validation rows claim "141/141 tests" and "1 stress rerun failed (turnover cap)" — the real canonical suite is 246/246 (253/253 with Layer 7; all green), so the fabricated count AND the fabricated failure misrepresent test state; EE:188-210 fabricates governance proposals (executed/cancelled) while G9 is NOT CONDUCTED. Rows are labeled "simulated", but contents should be either real (wire /api/tests; drop governance rows) or clearly watermarked.
- Minor — ParameterRegistry.tsx:31 "Slippage Tolerance 1.00%" single value vs the per-class 0.5/1.0/1.5% shown correctly in RebalanceEngine; LiveMonetaryState.tsx:375 "All 8 macro signals are now live" (hardcoded prose; wire to fx.liveCount/liveVix/liveDxy); InstitutionalHero.tsx:316 raw epoch "t 1792774367" (format as time).

---

## (F) VERIFIED CORRECT (brief)

- **Shared-snapshot polling architecture** (PCC 4s poll + hidden-tab skip + visibility refresh; HomeSection/DashboardSection/SystemHealth shared-prop with standalone fallbacks): verified — no duplicate /api/metrics pollers, no timer leaks (FaucetPanel cooldown cleanup fix from E2E-LAUNCH confirmed in place at FP:177-196).
- **Honest-status wiring** (GovernanceSection + TestnetStatusBar): gates 0/11, masks 0xFFF/0x0, disclaimer, version, computedAt all live and matching — the E2E-LAUNCH truth-posture fix holds.
- **All snapshot fields** consumed by the audited components exist in /api/metrics with matching values (field-by-field trace done — see B-note); no dead props, no unit/scale errors except B2/B7; percentages vs fractions handled correctly by fmtRatio/fmtPct throughout.
- **ReserveVault's GoldWeightGauge** is the model honest panel (live 20–32% envelope, live obs/tgt, legacy formula explicitly demoted). ReserveDonut honestly captions the prior-vs-live distinction. ReferenceChart legend/footnote disclose synthetic history and carry live §9.4 attribution. RiskTimeline discloses synthetic history in three places. OracleConsensus discloses synthetic witnesses. EventExplorer labels every row real/simulated with a footer disclosure. FaucetPanel carries the TESTNET banner and "no on-chain broadcast" note; all PCC faucet claims (30s cooldown, /api/simulate/mint, deterministic hash, asset list) verified TRUE.
- **Spec constants** (strategic prior 27/20/26/9/8/5/5, envelopes 20–32%, RR 110/105/100, LCR 100%, PAR 1.00, safety band 0.50–2.00, GFB_base $650.64, base date 2026-01-01 00:00 UTC (blueprint §3.4), fees 0.10%/0.15%, buffer 10%/62.5–85–100%, core 20% Au, λ-vector labeled HISTORICAL, slippage 0.5/1.0/1.5%, turnover 5%, pool 10%, direction lock 24h, governance tiers/timelocks, concentration 25/30/35%) all match blueprint.ts and are correctly labeled as spec/prior where displayed.
- **4 canonical testnet addresses** in HomeSection TestnetCards match /api/status + contracts.ts (monad/arc/robinhood/solana); "MTQΣ on 4 Testnets" and "Contract Registry · 4 Testnets" counts are right.
- **Live concentration** (TETHER 25.57% warn) drives SystemHealth to an honest 7/8 healthy — real live-data coloring, not a hardcoded "all healthy".
