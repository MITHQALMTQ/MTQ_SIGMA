# Task 14-b — Explore Audit: Operations & Labs (Mint / Redeem / Simulation / Constituency / Issuance / Networks + supporting components)

Agent: B (Explore, READ-ONLY — no source file modified)
Date: 2026-10-23 (session)
Live server: http://localhost:3000 (verified live throughout)

Territory read line-by-line: `sections/{MintSection, RedeemSection, SimulationSection, ConstituencySection, IssuanceSection, NetworksSection}.tsx` + supporting `MintSimulator, RedeemSimulator, FaucetPanel, NetworkSelector, WeightChangeDrawer, TreasurySweep, EjectMonitor, EjectReintegration, MaseEngine, AssetRegistry, ParameterRegistry, OnChainMatrix` (+ `SuccessionLab`, rendered by SimulationSection).

Live endpoints curled: `/api/metrics`, `/api/constituency`, `/api/issuance` (GET + 1 POST `happy-path`), `/api/succession`, `/api/registry`, `/api/contracts`, `/api/onchain/10143` (monad), `/api/onchain/5042002` (arc), `/api/honest-status`. Sanctioned engine POSTs: exactly 1 × `/api/simulate/mint` (amount 1000) and 1 × `/api/simulate/redeem` (amount 10). **State-mutation disclosure:** those two POSTs + the issuance demo changed live pilot state (circulating supply 747.87 → 1585.74 MTQ; 14 IssuanceEvent rows appended). No source file under src/ was touched.

Source classes used below: (a) live API field · (b) derived from live data · (c) hardcoded spec constant, clearly labeled · (d) hardcoded pretending to be live → **FINDING**.

---

## A) NUMBER-BY-NUMBER VERDICTS

### MintSection.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :252 | P_MTQ (fmtFixed 4) | (a) `snapshot.mtqPrice` | ✔ | live 1.1780580… |
| :257 | Reserve ratio (raw ratio) | (a) `snapshot.reserveRatio` | ✔ | live 1116.80 → post-audit-POSTs 523.96; sub honestly says "reserve ÷ liability" |
| :262 | Circulating supply | (a) `snapshot.circulatingSupply` | ✔ | live 747.87 |
| :121 | `F_mint = 0.001 (0.10%)` formula | (c) spec | ✔ labeled | blueprint MINT_FEE_BPS=10 |
| :160 | "1,000 USDC → ≈892.86 MTQ @P=1.12 / ≈1,086.96 @P=0.92" | (c) spec example | ⚠ copy | values are 1000/P (gross); post-fee formula gives 891.96 / 1085.87 — example silently omits the 0.10% fee |
| :479–480 | Mint fee 0.10% · "10 bps · **Risk Council (4/7)**" | (c) value ✔ / authority ✗ | **FINDING** | blueprint.ts:430 `MINT_FEE_BPS: {layer:"MONETARY"}` → authority "DAO Vote 51%" (GOVERNANCE_LAYERS:411). ParameterRegistry.tsx:26 says DAO 51% — MintSection's authority label is the outlier |
| :483–490 | Min mint / min redeem 1 MTQ | (c) imported constants | ✔ | MIN_MINT_MTQ=MIN_REDEEM_MTQ=1 |
| :493–495 | Default slippage 0.5% · "Risk Council (4/7)" | (c) | ✔ | DEFAULT_USER_SLIPPAGE=0.005; REDEEM_SLIPPAGE_TAU_USER layer RISK |
| :498–500 | Trade deadline 5 min | (c) | ✔ | TRADE_DEADLINE_MINUTES=5 |
| :418 | τ_user 0.005 (0.5%) inline | (c) | ✔ | matches DEFAULT_USER_SLIPPAGE |
| :426 | "{TRADE_DEADLINE_MINUTES}-minute deadline" | (c) imported | ✔ | |

### RedeemSection.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :265 | P_MTQ tile | (a) snapshot.mtqPrice | ✔ | |
| :270 | NAV per MTQ | (b) `snapshot.nav / snapshot.circulatingSupply` | ✔ | live 983,940.06/747.87 = 1315.65 (pre-POST) |
| :209/:274–285 | Current redemption fee 0.15% (NORMAL) / PAUSED (S5) | (b) REDEEM_FEE_BY_STATUS keyed by live `snapshot.status` | ✔ | state-machine.ts:236 redeemFee matches table exactly (15/15/50/100/paused/30 bps); live status NORMAL → 0.15% |
| :452 | fee ladder copy 0.15→0.50→1.00 / pause / 0.30 | (c) | ✔ | constants REDEEM_FEE_NORMAL/STRESS/DEFENSIVE/RECOVERY |
| :499–500 | table fee cells | (b) from imported constants | ✔ | |
| :509 | "Normal-state default fee (**Risk Council 4/7 tunable**)" | (c) authority | **FINDING** | REDEEM_FEE_NORMAL is MONETARY layer (blueprint.ts:431) → DAO 51%, not Risk Council |
| :158 | "RedeemValue_USD = Y × NAV_t" step formula | (c) | ✔ | matches engine (see B2/B3 — but contradicts RedeemSimulator's audit panel) |

### MintSimulator.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :49–51 | min-mint pre-check & min deposit hint | (b) derived from live price + constants | ✔ | 1/0.999×1.1782 ≈ 1.18 USDC |
| :92 | pill "§12.1 · fee 0.10%" | (c) MINT_FEE_BPS | ✔ | |
| :108 | "min 1 MTQΣ · τ 0.5% · deadline 5m" | (c) | ✔ | |
| :186–192 | Input/Fee/Net/RefVal/Throttle/New RR | (a) `result.*` from POST /api/simulate/mint | ✔ | curl: 1000 → fee 1.00 (exactly 0.10%) → net 999 → 847.8725 = 999/1.1782431 ✓ |
| :195–203 | MTQ Minted + new supply | (a) | ✔ | newCirculating 1595.743 = 747.8706+847.8725 ✓ |
| :9 | unused `Reveal` import | — | ⚠ dead import | never rendered in file |

### RedeemSimulator.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :78–85, :94 | pill "§12 · fee {(feeBps/100)}% ({status})" via local `feeBpsByStatus` | (d) **hardcoded map pretending to reflect the engine** | **FINDING (B1)** | map: NORMAL/CAUTION 15 ✓, DEFENSIVE **50** (engine 100), EMERGENCY **200 shown as a fee** (engine PAUSES redemption — §21.4 "never charged"), STRESS **missing → falls back 15** (engine 50), RECOVERY **missing → 15** (engine 30). Wrong in 4 of 6 states; correct only because live status is NORMAL. API returns the true `result.feeBps` (used post-run at :179) — the pill should use it or the §21.4 map from RedeemSection |
| :178 | label "**Gross USD (§3.4.2)**" on `result.grossUsd` | mislabel | **FINDING (B2)** | engine: `grossUsd = inputMtq × navPerMtq` (§19.3.2 Step 2 / P0-FIX-2). curl 10 MTQ → gross 6,172.52 = 10 × 617.25 NAV/token; Y×P_MTQ would be 11.78. Label cites the index-priced section the engine explicitly reverted |
| :176–184 | Input/RefVal/Gross/Fee/Net/Gold/New circ/New RR | (a) | ✔ math | fee = gross×15bps exact; basket 7 rows sum to netUsd (6,163.262774721843 vs …844 float) ✓ |
| :228/:233/:238 | NAV per token / §12.2 Gross / Δ | (a) audit fields | ✔ values | 617.25 / 6,172.52 / 6,160.74 — but see B3: the panel's *interpretation* is inverted |
| :242–250 | "§3.4.2 is the canonical settlement price; §12.2's NAV-per-token … NOT paid" | (d) **stale doctrine** | **FINDING (B3)** | engine auditNote (visible in this very panel's `<details>`): "the primary settlement now uses NAV (§12.2 — formerly audit-only). The legacy §3.4.2 (index-priced) is now the AUDIT-ONLY alternative." The API **paid** the NAV-based number; the Δ IS the premium actually paid over index |

### SimulationSection.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :82 | ladder "10%→25%→50%→100%", 5% pause rule | (c) | ✔ | EJECT_STAGES sellPct .10/.25/.50/1.00; EJECT_PAUSE_RULE_PCT=.05 |
| :89 | "none of the eleven gates … has been passed" | (b) matches live | ✔ | /api/honest-status authorizedMask 0, 0/11 |
| :90 | old-engine stats "~5.21% vol, −4.1% MDD" | (c) prior-architecture figures, explicitly NOT evidence | ✔ honest | §23.1 negative rule restated |
| :167 | `R_score = 0.40·…+0.25·…+0.20·…+0.15·…` | (c) hardcoded weights | ✔ values, ⚠ duplication | equals REINTEGRATION_WEIGHTS (0.40/0.25/0.20/0.15) — but duplicated as string (see C3) |
| :170–175 | re-entry ≥0.80; 25/50/100% at 0.80/0.85/0.90 sustained 24/48/72h | (c) copy | ⚠ un-wired specifics | threshold 0.80 matches REINTEGRATION_THRESHOLD; the 0.85/0.90 + 24/48/72h tiering exists only in this copy; chapter cited as §21.5.4 while EjectReintegration calls the same formula §11.3 |
| :192–197 | S1–S11, "2,000 paths per scenario" pointer | (c) spec copy | ✔ labeled pointer to Validation tab |
| :254 | "Perf(old architecture) not⇒ Perf(MTQΣ)" | (c) | ✔ |

### ConstituencySection.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :175–182 | BIS 2025 turnover shares (USD 89.2 … CHF 6.4) | (c) labeled survey table "INPUTS — never weights" | ✔ | static institutional reference, amber-labeled |
| :587–633 | candidate cards: seedWeight, envelope, ±pp, live USD quote | (a) `/api/succession` | ✔ | universe SGD/AUD/CAD/KRW/SEK/NOK, quotes live (source ECB/Frankfurter) |
| :295 | fallback basket `["USD",…,"Gold"]` | (c) fallback only | ✔ | matches live `basket` exactly; used only when API data absent |
| :644 | `I_t {data.live.iLevel.toFixed(6)}` | (a) | ✔ | live 1.177940 |
| :663–680 | live basket weights table | (a) `data.live.weights` | ✔ | 7 rows, sum = 1.000000; honest "genesis state → —" branch |
| :894 | "genesis 7 ({sum} bp = 100.00%)" | (a) `/api/constituency` | ✔ | genesisWeightSumBp = 10000 |
| :898 | "{activeBasketCount} ACTIVE" | (a) | ✔ | 7 |
| :910/:920 | per-entry genesisWeightBp / envelope | (a) | ✔ | CHF 500 · CNY 500 · EUR 2000 · GBP 800 · JPY 900 · USD 2700 · XAU 2600 = **10,000 bp**; envelopes match blueprint ADMISSIBILITY_ENVELOPES |
| :994–996 | "Transitions ever run: {n} · directives ever applied: {n}" | (a) | ✔ | 0 · 0 — QUIESCENT claim true |
| :865–866 | QUIESCENT disclosure | (a) with honest fallback | ✔ | API disclosure verbatim |
| :960–966 | lifecycle legend (EMERGENCY-SUSPENDED filtered as overlay) | (a) | ✔ | legend has 7 states; filter matches copy |

### IssuanceSection.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :440 | honest banner | (a) `snap.banner` (fallback matches verbatim) | ✔ | live: "TESTNET ONLY · SHADOW MODE ENFORCED · LEDGER RECORDS ONLY — NEVER ON-CHAIN · ECONOMIC VALUES UNAPPROVED / ILLUSTRATIVE · NOT ACCEPTED" |
| :449 | "D-13.27: ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION" | (c) hardcoded pill | ✔ value matches live | `labels.d1327Status` begins with identical string; live detail also rendered at :464–468 |
| :453 | "CBDC adapter: SIMULATED / NOT CONNECTED" | (c) pill | ✔ | cbdc.status identical; realAdapterGate all false |
| :519–588 | registry rows, TEST-ONLY pills, CBDC NOT_CONNECTED overlay, "NEITHER EXISTS" | (a) | ✔ | 3 stablecoin + 2 CBDC rows; honestyState NOT_CONNECTED |
| :768 | sub "fee-class 0.10%" | (d) hardcoded | **FINDING (B6)** | `snap.economics.fee.rateBps="10"` is live in the same payload; value not wired |
| :775–780 | expected chain copy "gross 10,000.000000 → fee 10.000000 → net 9,990.000000 → issued 4,995.000000 @ 2.000000" | (c) copy vs (a) run | ✔ verified | POST happy-path: expected == observed, checks all true, met=true; fee==gross×0.001, net==gross−fee, issued==net/quote exact |
| :765 | "clock 1,800,000,000,000 ms · deterministic" | (a) | ✔ | |
| :803 | "snapshot {n} bytes, 7 components at strategic-prior weights" | (a)+(c) | ✔ | 1,029 bytes; weightsPct = 27/20/9/8/5/5/26 (strategic prior = 10,000 bp) |
| :1029–1031 | **"0.10%" flat fee (big value)** | (d) hardcoded | **FINDING (B6)** | quote panel (:1044) wires `snap.economics.quote.tuPerToken`; the fee panel hardcodes the number while its label is live — asymmetric wiring |
| :1044 | quote "2.000000 TU/token" | (a) with fallback | ✔ | |
| :1050 | validity window 15 min (ILLUSTRATIVE, D-13.19) | (a) with fallback | ✔ | |
| :1063–1071 | per-tx 500,000 / tranche 1,000,000 / global 10,000,000 | (a) with fallback | ✔ | all match live economics.supply |
| :1081 | rounding rule | (a) with fallback | ✔ | live "ROUND_HALF_TO_EVEN @ 6 decimals (PROPOSED, spec §6.1 / D-13.19 — UNAPPROVED)" |
| :1104–1124 | "12 flow states" / "9 terminal" / header "21-state machine" | (c) counts + (a) lists | ✔ | live happyPath len 12, terminal len 9, all len 21 |
| :1156 | "{n} events persisted" | (a) | ✔ | 28 → 42 after my demo run |
| :1232–1251 | audit trail rows (time/request/kind/state/gross/fee/net/issued/supply) | (a) | ✔ | exact 6-decimal strings, no reformat |

### NetworksSection.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :96–113 | Chain ID / native currency / contract count / deployer per card | (c→shared module) `ALL_CHAINS` | ✔ | same module serves `/api/contracts` — monad 10143/MON, arc 5042002/USDC(18d), robinhood 46630/ETH, solana devnet/SOL, base 8453, arbitrum 42161; verified against live API |
| :237–238 | "{ALL_CHAINS.length} chains · {Σ contracts} recorded entries" | (b) computed | ✔ | 6 · 31 |
| :69–70/:82–92 | MAINNET TARGET · NO DEPLOYMENT pill | (b) derived: every contract address is zero-address | ✔ | base/arbitrum zero-only in live API; no hardcoded chain IDs |
| :270–285 | oracle counts (pairs / §17.10 pairs / chains / protocol-owner EVM oracles) | (b) `getOracleFeedSummary()` deterministic | ✔ | "feed contents UNVERIFIED" pill honest |
| :352–358 | "providerFeedAddress null — pending OD-34 confirmation" | (c) module verbatim | ✔ | |
| :493 | DEPLOYER_WALLET | (c) shared module | ✔ | 0x3C3932F8… matches /api/contracts deployer |
| — | block numbers | not displayed | ✔ | FaucetPanel's block # is generated + labeled "Simulated transaction … no on-chain broadcast" |

### FaucetPanel.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :45–47 | 30s cooldown / 1,000 default / 100,000 max claim | (c) pilot-local constants, displayed | ✔ | |
| :63–83 | per-chain asset catalogue (MON/MockUSDC/MTQ …) | (c) | ⚠ see B5 | arc "USDC · Native gas token (testnet)" is *correct* (Arc native currency = USDC 18d per contracts.ts:87) |
| :90–110 | deterministic tx hash + block #10,000,000–15,000,000 | (c) simulated, labeled | ✔ | italic "Simulated transaction · hash is deterministic per claim · no on-chain broadcast. The mint path through the engine is real." |
| :215–247 | claim → POST /api/simulate/mint with `{amount, chain, wallet}` | wiring | **FINDING (B5)** | asset selector is cosmetic — every asset (MON/ETH/SOL/USDC/MTQ) is sent as a plain `amount` and the engine mints MTQ as if a USD deposit of that size (mint math is USD-based). Result shows "Asset: 10,000.00 MON" **and** "MTQ Minted ≈ 8,4xx" implying a conversion that never happens; only MockUSDC's description says "mint MTQ against this" |
| :585–614 | Asset / MTQ Minted / MTQ Price / RR post | (a) from engine response | ✔ fields | mtqMinted, mtqPrice, newCirculating, gfbIndex, reserveRatio all read from response/snapshot |

### NetworkSelector.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :43–53 | live/pending/devnet status | (b) derived from canonical address ≠ 0x0 / zero-contract | ✔ | matches live zero-address data for base/arbitrum |
| :136/:183 | chain ID chips | (c) shared module | ✔ | |

### WeightChangeDrawer.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :48–56 | SYNTHETIC_VOLS (0.05–0.15) | (c) labeled "synthetic vols for pilot" (sub at :510) | ✔ labeled | |
| :62–74 | synthetic price relatives | (c) labeled | ✔ | sub "signed price-relative drift vs base date" |
| :117–132/:287–303 | prior/target/smoothed/execution/live weights | (a)/(b) snapshot.weightStates + reserve/nav | ✔ | live sums 1.0 |
| :188 | "EMA λ=20%" in summary | (c) hardcoded | ⚠ | SMOOTHING_LAMBDA = 1−ρ_normal = 0.50 — the copy's λ=20% matches neither ρ (0.50/0.75) nor λ (0.50); stale free-text |
| :626–652 | G_t / divisor records | (a) snapshot.chainIndex | ✔ | |

### MaseEngine.tsx (rendered by DashboardSection)
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :246–270 | 7 model rows + alphas + ensemble target | (a) snapshot.mase | ✔ | live: 7 models, adaptive, 947 OOS samples |
| :335–362 | σ horizon table + ω weights | (a) risk.volHorizons/volHorizonWeights | ✔ | |
| :380–424 | 6-regime probabilities + CrisisScore + λ_CVaR | (a) | ✔ | |
| :481–499 | 4-state weight table + Δ | (a) | ✔ | |
| :535–544 | envelope ok/warn/breach counts | (b) reduce over live envelopes | ✔ | live all ok |
| :653–681 | correlation matrix | (a) | ✔ | |
| :703–724 | VaR/CVaR/MDD/window | (a) | ✔ | MDD envelope honestly "not published…surfacing-only" |
| :796–843 | MARP decisions + Σ total + "5% of NAV ≈ {nav×0.05}" | (a)+(b) | ✔ | live totalTradeUsd 2,964.73 |
| :161–166 | 4-state regime thresholds VIX 30/22/15, DXY 115/88 | (c) client recompute, labeled "state decisions only" | ✔ | |
| :231 | "η = 3" pill | (c) spec | ✔ | |
| :184 | title "(v1.0)" | (c) | ⚠ stale label | content is v2.0 §5/§6; header comment (:2) also says "6 candidate models" vs live 7 |

### AssetRegistry.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :110 | haircut % | (a) rec.haircut | ✔ | /api/registry assets haircut 0.005 |
| :114 | "Liq. Min. ${x/1e6}M" | (a) rec.liquidityThresholdUsd | ✔ | 1,000,000 → $1.0M |
| :118–121 | score n/8 | (b) eligibilityScore(rec) | ✔ | |
| :172–174/:219–228 | warn 25% / limit 30% / crisis 35% ticks | (c) imported constants | ✔ | CONCENTRATION_* = .25/.30/.35 |
| :266 | "{registry?.length} admitted assets · 8 criteria" | (a)+(c) | ✔ | live 9 assets (mixture) / ELIGIBILITY_CRITERIA len 8 |
| :299 | "Live max issuer = X at Y% of NAV" | (b) reduce over live concentration | ✔ | |
| :270 | "48h timelock (§5.10)" | (c) REGISTRY_TIMELOCK_HOURS=48 | ✔ | |

### ParameterRegistry.tsx (rendered by DashboardSection)
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :21 | PAR 1.00 immutable | (c) | ✔ | blueprint PAR=1.00 CONSTITUTIONAL |
| :22 | **RR Target 1.10 · Monetary · DAO 51% · GOVERNED** | (d) stale row | **FINDING (B7a)** | blueprint.ts:429 `RR_TARGET: {layer:"CONSTITUTIONAL", immutable:true}` — "the former MONETARY classification was a v1.x row (Task 8-b fix)" |
| :23–25 | RR Stress Floor 1.05 / Hard Floor 1.00 / LCR 1.00 | (c) values | ✔ values | RR_STRESS 1.05, RR_HARD 1.00, LCR_TARGET 1.00 (LCR layer is RISK in blueprint vs "Risk" here ✔) |
| :26–29 | fees 0.10/0.15/0.50/1.00 | (c) | ✔ | match constants + engine |
| :30 | ρ 0.50/0.75 | (c) | ✔ | SMOOTHING_RHO_NORMAL/STRESS |
| :31 | **Slippage Tolerance 1.00%** | (d) contradictory | **FINDING (B7b)** | DEFAULT_USER_SLIPPAGE = 0.5% (shown as τ_user default in Mint & Redeem sections and §19.7); per-class SLIPPAGE_TOLERANCES are 0.5/1.0/1.5% — a single "1.00%" row contradicts both surfaces |
| :32–36 | turnover 5% / direction lock 24h / de-peg 12h / Gold 20–32% / velocity 0.5% | (c) | ✔ | DEPEG_DETECTION_HOURS=12; Gold envelope 20–32% ✓ |
| :26 authority | Mint Fee "DAO 51%" | (c) | ✔ per blueprint | but conflicts with MintSection.tsx:480 "Risk Council (4/7)" (see B7c) |

### OnChainMatrix.tsx (rendered by DocsSection + SecuritySection)
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :15–16, :315–317 | "deployed Arc Testnet pilot contract **0x826b82F79FD6c5347cDC568B1d0A7918128B63c1**, chain 5042002" | (d) **stale hardcoded address** | **FINDING (B4)** | live canonical Arc = 0x237c3Aa2B79248f86f6523D3890095BCd1996601 (contracts.ts:236, /api/contracts, /api/onchain/5042002 — name MITHQAL, 1,000 MTQ); superseded record = 0x24203404…; 0x826b… matches NEITHER. Chain ID 5042002 is correct; the address is presented as "the deployed pilot contract" |
| :19–21, :320–327 | MTQSigmaV2.sol 1057 lines / 22,627 bytes / 0x7FF "claimed, pending evidence" / SOURCE_READY_PENDING_DEPLOY | (c) static audit matrix, honest labels | ✔ | row 19 explicitly marks the V2 claim as pending evidence |
| :260–264 | summary chips (7 on-chain · 11 source-ready · 1 TS-only · 0 not-implemented · 1 audit-trail) | (b) computed from ROWS | ✔ | counts sum to 20 |
| :53–190 | 20-row status matrix | (c) canonical audit-derived, labeled static | ✔ | |

### TreasurySweep.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :18–20 | fill / near / over thresholds | (b) live hotWalletUsd vs TREASURY_SWEEP_THRESHOLD_USD=10,000 | ✔ | live hot 5,528.17 → "below threshold", 55% fill |
| :63/:70/:79 | cold treasury / last sweep / total swept | (a) snapshot.treasury | ✔ | live 0 / none / $0 |
| :54–55/:84 | "$10K threshold", "$5,000 operating float" | (c) threshold imported; float hardcoded copy | ✔ / ⚠ | float not an imported constant (spec copy) |

### EjectReintegration.tsx (SimulationSection + DashboardSection)
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :98–104 | peg health / band / outside | (a)+(b) pegBandFor per asset | ✔ | live peg USD 1.00056 in ±0.5% band |
| :106 | repurchase stage % | (b) REINTEGRATION_REPURCHASE_STAGES[stage−1] | ✔ | [0.25,0.5,1.0] |
| :150–153 | R_score gauge + threshold 0.80 | (a) reintegration.score + REINTEGRATION_THRESHOLD | ✔ | live USD score 0.997 |
| :202 | pill "peg bands ±0.5/±1.0/±1.5% per asset (§21.5.2)" | (c) | ✔ | PEG_BANDS USDC/EURC ±0.5, GBP/JPY ±1, CNY ±1.5 |
| :240–253 | w₁–w₄ = 0.40/0.25/0.20/0.15 | (c) REINTEGRATION_WEIGHTS | ✔ | matches SimulationSection's hardcoded formula string (duplication, C3) |
| :9–10 | unused `TickNumber`, `fmtPct` imports | — | ⚠ dead imports | never used in file |

### EjectMonitor.tsx
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| whole file | 5-currency peg/depeg/stage table | **never rendered — ZERO importers** | **FINDING (D1) dead component** | rg over src/: only the definition file matches |
| :40–41 | banner copy "peg leaves the **[0.98, 1.02]** band" | (d) stale copy | FINDING if revived | superseded by per-asset PEG_BANDS (±0.5/±1.0/±1.5%, §21.5.2) which the same file's logic actually uses via pegBandFor |

### SuccessionLab.tsx (SimulationSection)
| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| :60–62 | defaults CNY / −40% / SGD | (c) UI defaults | ✔ | |
| :136–139 | ejectedOptions | (a) live with hardcoded fallback | ✔ | live = USD/EUR/JPY/GBP/CNY/CHF = fallback |
| :296–326 | artificial return / P before/after / loss / G_t / successor sanity | (a) POST /api/succession sim | ✔ | zero-artificial-return pill from `cont.artificialReturnPct` |
| :460–489 | ladder table (stage/hour/sell%/price/proceeds per MTQ) + exposure/realized/saved | (a) | ✔ | |
| :490–493 | "USD sleeve → USDC/USDP/USDT ⅓ each · gold sleeve → PAXG/XAUT 50/50, §15.6" | (c) spec copy | ✔ | |

---

## B) WIRING BUGS (ranked)

1. **RedeemSimulator.tsx:78–85 (fee map) — wrong fee displayed in 4 of 6 risk states.** Local `feeBpsByStatus` = {NORMAL:15, CAUTION:15, DEFENSIVE:50, EMERGENCY:200}; engine `redeemFee()` (state-machine.ts:236) = {NORMAL:15, CAUTION:15, STRESS:50, DEFENSIVE:100, EMERGENCY:paused, RECOVERY:30}. STRESS and RECOVERY are missing (fall back to 15), DEFENSIVE shows 50 (engine 100), and EMERGENCY shows a 2.00% "fee" although §21.4 pauses redemption and RedeemSection.tsx:504 explicitly says the legacy constant "is never charged". The pill (line 94) currently reads correctly only because the live status is NORMAL. Fix: reuse `REDEEM_FEE_BY_STATUS` from RedeemSection (or blueprint constants) — the same page already displays the correct table 300px above.
2. **RedeemSimulator.tsx:178 — "Gross USD (§3.4.2)" mislabel.** `result.grossUsd` is NAV-based (`grossUsd = inputMtq × navPerMtq`, engine.ts ~2150, P0-FIX-2 / §19.3.2 Step 2). Verified live: 10 MTQ → gross $6,172.52 = 10 × $617.25 NAV/token; the index-priced figure (Y×P_MTQ) is $11.78. The label cites the index-priced path the engine reverted.
3. **RedeemSimulator.tsx:217–255 + RedeemSection.tsx:330–334 — the "Honest Audit §12.2 vs §3.4.2 RECONCILED" panel tells the inverted story.** Panel: "§3.4.2 is the canonical settlement price; §12.2's NAV-per-token is retained as an informational book-value metric only" and Δ "would drain buffer if paid — **NOT paid**". Engine auditNote (rendered in the same panel's details): "the primary settlement now uses NAV (§12.2 — formerly audit-only). The legacy §3.4.2 (index-priced) is now the AUDIT-ONLY alternative… at RR > 100% NAV-based redemption pays the book value of the token." The API **did** pay the NAV-based amount (basket releases sum exactly to NAV-based net). The Δ ($6,160.74 on 10 MTQ) is the premium actually paid over index — presented as "not paid". This is the most serious truth-posture defect in the territory: the panel accuses the §12.2 path of the very thing the engine does, while denying what it does.
4. **OnChainMatrix.tsx:15–16, 315–317 — stale hardcoded Arc address.** `0x826b82F79FD6c5347cDC568B1d0A7918128B63c1` presented as "the deployed Arc Testnet pilot contract"; live canonical is `0x237c3Aa2B79248f86f6523D3890095BCd1996601` (verified via /api/contracts, /api/onchain/5042002 and contracts.ts:236; the superseded OD-35 record is 0x24203404…). Should import `CANONICAL_MTQ_ADDRESSES.arc` instead of hand-typing.
5. **FaucetPanel.tsx:63–83 + 202–265 — asset selector is decorative.** Every claim posts `{amount}` to /api/simulate/mint, which mints MTQ as if the amount were a USDC deposit regardless of asset. Claiming "10,000 MON" renders "Asset: 10,000.00 MON" alongside "MTQ Minted ≈ 8,4xx" — implying an asset conversion that never happens, with no disclosure that only MockUSDC semantics apply. Either restrict the faucet to MockUSDC/MTQ rows or label the amount as USD-equivalent.
6. **IssuanceSection.tsx:768 & 1029–1031 — fee value not wired.** "fee-class 0.10%" and the big "0.10% flat" are hand-typed while `snap.economics.fee.rateBps` ("10") + `feeClass` ("FLAT-10BPS (ILLUSTRATIVE)") are live in the same payload (the labels beside them ARE wired). Currently matches; silently lies if the pilot fee changes.
7. **ParameterRegistry.tsx:22 & :31 — stale rows in an otherwise spec-static table.** (a) RR Target shown as Monetary/DAO-51%/GOVERNED; blueprint PARAMETER_REGISTRY (Task 8-b) made RR_TARGET CONSTITUTIONAL/immutable. (b) "Slippage Tolerance 1.00%" contradicts DEFAULT_USER_SLIPPAGE 0.5% (τ_user, shown in Mint/Redeem sections and §19.7) and the per-class 0.5/1.0/1.5% tolerances. Related: MintSection.tsx:480 says F_mint authority is "Risk Council (4/7)" while blueprint (MONETARY) and ParameterRegistry say DAO 51% — one of the two is wrong, and the blueprint side is self-consistent, so MintSection's label loses.
8. **RedeemSection.tsx:509 — wrong authority for the normal redeem fee** ("Risk Council 4/7 tunable"; REDEEM_FEE_NORMAL is MONETARY → DAO 51% per blueprint.ts:431).

## C) REDUNDANCY / GROUPING OPPORTUNITIES

1. **The amber truth banner is hand-written 4× in this territory** — MintSection.tsx:225–244, RedeemSection.tsx:238–257, SimulationSection.tsx:117–136, NetworksSection.tsx:213–226 (identical TESTNET ONLY / SHADOW MODE ENFORCED / RESERVE TRADING NOT AUTHORIZED pill triple, near-identical body) — on top of the global pinned TestnetStatusBar. IssuanceSection already consumes its banner verbatim from the API (`snap.banner`); extract one shared `<TruthBanner>` (accepting an optional API string) and delete ~80 lines.
2. **STATUS_TONE map + Block wrapper duplicated verbatim** between MintSection.tsx:51–95 and RedeemSection.tsx:53–122 (~70 lines) — extract to a shared module.
3. **Reintegration machinery shown twice on the same Simulation page**: SimulationSection.tsx:162–177 hardcodes the §21.5.4 formula string (0.40/0.25/0.20/0.15 + 0.80/0.85/0.90 + 24/48/72h) directly above EjectReintegration, which renders the same formula from REINTEGRATION_WEIGHTS constants (:229–258) plus its own ladder summary (:205–212). Keep one; wire the tier thresholds (0.85/0.90, 24/48/72h) to constants or delete them. Also reconcile chapter numbering: §21.5.3/§21.5.4 (SimulationSection) vs §11/§11.3 (EjectReintegration) for the same machinery.
4. **P_MTQ + protocol-status stat tiles duplicated** in MintSection and RedeemSection headers; mint fee appears on 4 surfaces (MintSection strip, MintSimulator pill, ParameterRegistry, IssuanceSection economics) — all currently agree at 0.10%, but each is an independent hand-copy except the two blueprint-imported ones.
5. **MintSimulator/RedeemSimulator are rendered in 3 places** (Mint/Redeem sections, DashboardSection, TrialSection) with different §-labels around them (§12.1 vs §19.2 vs §12) — fine as reuse, but consider passing the label down.

## D) REMOVAL CANDIDATES

1. **EjectMonitor.tsx — entire 133-line component is dead** (zero importers; superseded by EjectReintegration). Its banner copy is also stale ([0.98, 1.02] band). Delete.
2. **MintSimulator.tsx:9** — unused `Reveal` import. **EjectReintegration.tsx:9–10** — unused `TickNumber`, `fmtPct` imports.
3. **RedeemSimulator.tsx:242–250** — the stale reconciliation paragraph should be replaced by (or reduced to) the engine's own `auditNote`, which the panel already renders in the `<details>` below it; keeping both means the page argues with itself.
4. **MaseEngine.tsx:1–2 header comment** ("6 candidate model weight vectors") — live engine runs 7 models across 6 families; comment-only staleness.
5. ConstituencySection.tsx:295 and SuccessionLab.tsx:45 fallback arrays — keep (honest error-path fallbacks, both match live data), but note they are the only remaining hand-typed basket lists.

## E) COPY / CLAIM CORRECTIONS

1. RedeemSimulator audit panel + RedeemSection:330–334 — replace the §3.4.2-canonical narrative with the engine's actual doctrine: redemption settles at NAV_t (§19.3.2 Step 2 / Invariant I6, P0-FIX-2, 2026-10-19 audit); the index-priced gross is the audit-only alternative. ("The pilot settles on §3.4.2 — burn MTQΣ, release the basket" can survive if §3.4.2 is understood as burn-and-release-basket, but "the §12.2 NAV-per-token valuation is informational" must go.)
2. MintSection.tsx:160 — the 892.86/1,086.96 example values ignore the 0.10% fee the same sentence's formula applies (X_net/P gives 891.96/1,085.87); restate as "≈" with fee or recompute.
3. MintSection.tsx:480 — F_mint authority → "DAO 51% (Monetary, 48h)" per blueprint PARAMETER_REGISTRY; RedeemSection.tsx:509 same fix for the normal redeem fee.
4. ParameterRegistry.tsx:22 — RR Target → Constitutional / 7/7 Multi-Sig / 90 days / IMMUTABLE. :31 — Slippage Tolerance → either "τ_user 0.50% (§19.7)" or "per-class 0.5/1.0/1.5% (§12.3.3)"; not a single 1.00%.
5. SimulationSection §21.5.4 vs EjectReintegration §11.3 — pick one chapter reference for the reintegration score.
6. OnChainMatrix — import the Arc address from contracts.ts (see B4).
7. WeightChangeDrawer.tsx:188 — "EMA λ=20%" free text matches no current constant (ρ=0.50/0.75, λ=0.50); restate as "ρ=0.50 (stress 0.75)".
8. MaseEngine.tsx:184 — drop "(v1.0)" from the panel title (content is v2.0 §5/§6).
9. FaucetPanel — add "USD-equivalent pilot deposit" wording or restrict assets (see B5).

## F) VERIFIED CORRECT (brief)

- **Mint math end-to-end (live POST):** $1,000 → fee $1.00 (exactly 0.10%) → net $999.00 → 847.8725 MTQ = net/1.1782431 ✓. Constants strip fully imported from blueprint (fee 10 bps, min 1/1 MTQ, τ 0.5%, deadline 5 min) — nothing hand-typed. Oracle-pause and status gating honest.
- **Redeem math (live POST):** fee 15 bps in NORMAL = gross × 0.0015 exact; net = gross − fee; 7-asset released basket sums to net to the float cent; gold portion + PAXG qty consistent; state-dependent fee source matches the §21.4 table on the same page; NAV-per-MTQ tile correctly derived from live nav/supply.
- **Issuance Lab (live GET + POST happy-path):** expected == observed for all six values (10,000.000000 / 10.000000 / 9,990.000000 / 2.000000 / 4,995.000000 / supply 4,995.000000), checks all true, three-book reconciliation BALANCED, separation snapshot byte-identical (1,029 bytes), 14 events persisted, mint record labeled "LEDGER RECORD ONLY — NEVER ON-CHAIN". Every honesty pill (D-13.27 adopted-delegated pending ratification, CBDC SIMULATED / NOT CONNECTED, BORN EMPTY / FAIL-CLOSED, TEST-ONLY fixtures, values UNAPPROVED / ILLUSTRATIVE) matches the live API strings. 12/9/21 state counts correct.
- **Constituency:** genesis weights sum to exactly 10,000 bp (500+500+2000+800+900+2700+2600); 7 ACTIVE components match /api/constituency; QUIESCENT claims true (transitionsEverRun 0 · directivesEverApplied 0 · 7 ACTIVE); live universe + live ECB/Frankfurter quotes + live smoothed weights (Σ = 1.000000) all wired; honest error/loading branches everywhere.
- **Networks:** chain cards render from the shared contracts.ts registry (identical to /api/contracts); monad 10143 / arc 5042002 / robinhood 46630 / solana devnet / base 8453 / arbitrum 42161 all verified; "MAINNET TARGET · NO DEPLOYMENT" derived from zero-addresses, not IDs; oracle-deployment panel honest (feed contents UNVERIFIED, providerFeedAddress null); §1.7 independent-verification banner + deployer wallet correct.
- **Supporting live-wired panels:** MaseEngine (7 models, adaptive α, OOS 947, envelopes all ok, MARP total $2.96K, VaR/CVaR/MDD from engine), AssetRegistry (9 assets, 8 criteria, concentration thresholds from constants, live max-issuer), TreasurySweep (live hot $5,528 vs $10,000 threshold, no sweep yet), WeightChangeDrawer (4-state weights + live holdings share + chain-index records), EjectReintegration (per-asset bands, live peg health, R_score gauge), SuccessionLab (state-clone drill, zero artificial return) — every displayed number traced to a snapshot/API field.
- **OnChainMatrix structure:** counts computed from rows; V2 claims honestly labeled "claimed, pending evidence"; only the Arc address is wrong (B4).
