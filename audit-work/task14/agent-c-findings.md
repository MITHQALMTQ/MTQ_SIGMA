# Task 14-c — Explore Agent C: Governance Evidence Cluster Audit (READ-ONLY)

**Scope**: TransparencySection, ValidationResearchSection, MandateCompliance, TestsSection, EvidencePackageSection, SecuritySection, ContractsSection, AuthorizationAuditSection, InvestorSection, PitchSection, DevelopersSection + supporting shared components (HonestStatus, HonestStatus5Level, AuditFindings, BlueprintQA, AIPolicyBriefing, TrialLog, ContractRegistry, EventExplorer, GfbChart, GfbBasket, ClosedLoopMap, ConstitutionalSeparation, SuccessionLab, ReproducibilityPanel, InstitutionalDashboard).
**Method**: every file read line-by-line; every live endpoint curled and diffed against every displayed number (`/api/metrics`, `honest-status`, `tests`, `mandate`, `evidence`, `roles`, `contracts`, `succession`, `trials`, `validation`, `implementation-status`, `three-book`, `legal-registry`, `licensing-matrix`, `por`, `contradiction-scan`, `systemic-risk`, `protected-backing`, `bank-default`, `sync`, `ai/status`, `ai/briefing`, `ai/risk-signals`, `v3`, `banks`, `stability-pool`, `onchain/10143`, `status`; `/api/ai/qa` verified POST-only by reading its route file). **No source file modified.**

**Live API baselines captured this session** (evidence for every verdict below):
- `/api/honest-status`: gates **0/11** passed, implementedMask **4095 (0xFFF)**, authorizedMask 0, status "NOT PRODUCTION-AUTHORIZED".
- `/api/mandate`: rollups **odOpen 7 / odTotal 38**, conflicts **49/49 resolved**, tests 88 (37 unit-tested), selfTests **23/23**; pipelineDemo gross **$371.25** / cost **$16.52** / protection **$825.00** / net **−$470.27** / threshold $10 / decision **reject** / shadowOnly true.
- `/api/metrics` snapshot: `marp.decisions[0].mandate` = gross **$126.99** / cost **$77.40** / net **−$492.06** / eligible **false** ("blocked · shadow"); concentration TETHER/PAXOS/CIRCLE each **25.57% status "warn"**; reconciliation F1–F4 severities fixed/fixed/fixed/informational.
- `/api/tests`: **10,300 runs / 8 suites**, all survival 100%, worstMinRR per suite (worst: Depression 1.3250), overallVerdict **PASS**; `/api/validation`: **11 scenarios, 5 PASS / 0 WARN / 6 FAIL** — **S5 Gold+50% survival 0.0% (EMERGENCY, 100/100 breach runs)**, S1 87.8%, S2 83.0%, S3 33.9%, S4 56.05%, S11 51.5%.
- `/api/roles` (LIVE, probed 2026-10-21): Monad MTQ.sol deployer holds ADMIN+MINTER+PAUSER all **true**; Safe holds all three **true** on Monad but **only PAUSER on Arc**; governance none; paused=false both chains.
- `/api/evidence`: findings C-040..C-049 (10), claimCounts 25/5/3, stopConditions **5/5 triggered**, gates 7 (none closed), custody 8 rows (Safe share 0 everywhere).
- `/api/sync`: Turso **false**, Neon **false**, Inngest **false**, Vercel deployed true. `/api/ai/status`: **0/5 providers configured** (briefing/qa run on `fallback-rules`).

---

## A. NUMBER-BY-NUMBER VERDICTS

Legend: **LIVE** = fetched from API at render; **DERIVED** = computed from live; **SPEC** = labeled blueprint/spec constant (ok); **HARD** = hardcoded value duplicating or pretending to be live (finding).

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| TransparencySection:944 `firstMandate.grossBenefitUsd` | Expected benefit $126.99 (tick-dependent) | snapshot.marp.decisions[].mandate | **LIVE ✓** | /api/metrics marp.decisions[0].mandate.grossBenefitUsd 126.989; sane USD magnitude post-1e18 fix |
| TransparencySection:948 costUsd | $77.40 | same | **LIVE ✓** | 77.4009 |
| TransparencySection:952 netBenefitUsd | −$492.06 | same | **LIVE ✓** | −492.056; net negative ✓ (netBenefit usually negative/blocked) |
| TransparencySection:904,957 | ε threshold $10, "blocked · shadow" | same | **LIVE ✓** | thresholdUsd 10, netBenefitEligible false |
| TransparencySection:576-613 | NAV equation gImplied/navRaw/navReconciled/identityCloses | getNavForm(snapshot) | **DERIVED ✓** | recomputed in browser from published components (COO-17) |
| TransparencySection:865-884 | observed gold 23.73% / target 20.92% / dev 2.81pp / no-trade ½θ 0.75% (crisis 1.5%) | snapshot.rebalance + blueprint | **LIVE + SPEC ✓** | matches /api/metrics rebalance; ½θ labeled spec constant |
| TransparencySection:700 | "retained {history.length} of {totalDivisorCommits} · window 50" | navForm | **DERIVED ✓** | process-local ledger, disclosed as such |
| TransparencySection:972 | "10k decision / 5k state-vector rows" retention | blueprint spec | **SPEC ✓** | labeled honest pilot limitation (OD-21 OPEN) |
| ValidationResearchSection:472-509 | S1–S11 runs/survival/worstMinRR/breach | /api/validation | **LIVE ✓** | matches curl exactly (incl. S5 0.0% FAIL, 6 FAIL verdicts) |
| ValidationResearchSection:558-575 | audit verdict verbatim + 5 PASS/0 WARN/6 FAIL badge | /api/validation audit.passCount/warnCount/failCount | **LIVE ✓** | OverallVerdictBadge derives from live counts |
| ValidationResearchSection:349-351 | "5.21% annualized volatility / −4.1% MDD" (old architecture) | blueprint §23.1 | **SPEC ✓** | explicitly presented as NOT evidence (negative rule) |
| MandateCompliance:283 | "7 / 38" open decisions | /api/mandate rollups | **LIVE ✓** | odOpen 7, odTotal 38 — matches mandate (7 OPEN) |
| MandateCompliance:283 sub | "OD register (38 total)" | HARD | **HARD (minor)** | duplicates live odTotal; will go stale when register grows |
| MandateCompliance:284 | "49 / 49" conflicts resolved | rollups | **LIVE ✓** | conflictsResolvedByCode 49 / total 49 |
| MandateCompliance:284 sub | "C-001…C-043 mapped to code" | HARD | **HARD — STALE** | live conflictsTotal = **49** (C-001…C-049); sub-label contradicts the live numerator beside it |
| MandateCompliance:285-286 | "37 / 88" tests unit-tested; "23/23" self-tests | live | **LIVE ✓** | rollups.testsUnitTested 37/88; selfTestsSummary 23/23 |
| MandateCompliance:348-359 | decision REJECT, oracle HEALTHY, I(q) 0.0150, G $371.25, C $16.52, B $825.00, N −$470.27, ε $10 | /api/mandate pipelineDemo | **LIVE ✓** | all 8 fields match curl; sane magnitudes; net negative; 21 steps + decision record live |
| MandateCompliance:406,440-456 | Safe 1/1 deployer-controlled (threshold 1, owners 1, nonce 0), C-041/C-042/C-043 supplemental | /api/mandate safeVerification | **LIVE ✓** | matches evidence package + OD-35 |
| MandateCompliance:474-492 | oracleFeeds counts, staleness classes, validation %s | /api/mandate oracleFeeds | **LIVE ✓** | rendered from payload |
| MandateCompliance:646-653 | 37/48/1/0/1/1 register rollups + "candidate" objective | rollups + jsTradeGate | **LIVE ✓** (value "candidate" is a label; sub is live version string) |
| TestsSection:125-128,257 | verdict PASS, 10,300 runs, 8 suites, 8 findings | /api/tests audit | **LIVE ✓** | overallVerdict starts "PASS", totalRuns 10300, suites.length 8 |
| TestsSection:111,133,149,269 | "10,300 runs" in eyebrow/intro/toast/cached-note | HARD | **HARD (currently true)** | duplicates live totalRuns in 4 static strings; derive instead |
| TestsSection:298-364 | per-suite survival 100.0%, worstMinRR (1.33–4.58), runs, peg% | /api/tests | **LIVE ✓** | all 8 suite cards match curl |
| EvidencePackageSection:449-452 | "7 OPEN · 8 IMPLEMENTED-PENDING-APPROVAL · 3 SATISFIED-BY-DOCUMENT · 1 VERIFIED-FAILED" | /api/mandate rollups (fetched live, fail-honest) | **LIVE ✓** | matches odByStatus; rollup error state withholds counts |
| EvidencePackageSection:470 | "5/5 triggered" stop conditions | derived from /api/evidence | **DERIVED ✓** | stopConditions all triggered=true |
| EvidencePackageSection:497-499 | 25 unresolved claims / 5 critical / 3 resolved | /api/evidence claimCounts | **LIVE ✓** | 25/5/3 |
| EvidencePackageSection:341 | "best case +142 B over" (C-044) | HARD copy of API data | **HARD (matches)** | compileMatrix best-case row over=142; static copy duplicates it |
| EvidencePackageSection:379 | "1.1M USDC × 2 chains" custody note | HARD copy of API data | **HARD (matches)** | custody rows show 1,100,000 USDC both chains |
| EvidencePackageSection:248 | header "C-040 … C-049" | HARD | **HARD (matches)** | findings list is C-040/OD-35..C-049 (10 rows) |
| SecuritySection:92,208 | "{canonicalCount} canonical MTQΣ contracts live" = 4 | lib CANONICAL_MTQ_ADDRESSES | **SPEC/LIVE-ish ✓** | 4 canonical addresses (Monad/Arc/Robinhood/Solana); wording counts chains as "contracts" |
| SecuritySection:239-243 | "Constitution: 7/7 Multi-Sig · 90d timelock" posture card | blueprint design target | **HARD — MISLEADING** | presented under "Security Posture" without target label; live reality = Safe is 1/1 deployer (OD-35 CRITICAL). Panel 2 discloses it, but this card reads as current state |
| SecuritySection:249-253 | "Oracle consensus: 3 sources · 3-of-3 valid — Chainlink + Pyth + Chronicle per pair" | blueprint | **HARD — MISLEADING** | pilot feeds are Frankfurter+gold-api+Yahoo (snapshot.source); on-chain Oracle.sol ABI unpublished/adapters not deployed (mandate oracleFeeds) |
| SecuritySection:259 | "Staged 10/25/50/100%" eject | blueprint §11.3 | **SPEC ✓** | labeled design |
| SecuritySection:336 | "10,300 runs · 8 suites" pill | /api/tests | **LIVE ✓** | totalRuns + findings.length (8 per-suite rows) |
| SecuritySection:648 | "The 10,300-run audit" (disclaimer 06) | HARD | **HARD (currently true)** | duplicates live count |
| SecuritySection:571-586 | Sharia roadmap Q4 2026→Q4 2027 5 phases | blueprint §2.8 | **SPEC ✓** | verbatim table, "NOT certified" stated |
| ContractsSection:460 | eyebrow "Deployments · 4 testnets" | HARD | **HARD — INCONSISTENT** | tabs render **6** chains (incl. Base + Arbitrum MAINNET placeholders); pill shows "6 chains · 31 contracts" |
| ContractsSection:445-451 | canonicalChainIds map incl. "arc-pilot-v2" | DEAD KEY | **DEAD CODE** | no `arc-pilot-v2` id exists in ALL_CHAINS |
| ContractsSection:474 | CanonicalCard name/symbol/decimals/address per chain | lib constants | **SPEC ✓** | matches /api/contracts + /api/status + /api/onchain live reads |
| ContractsSection RoleMatrixPanel:262-435 | role matrix + owner reference ×3 TRUE + paused false | /api/roles (LIVE; DEGRADED→ROLE_EVIDENCE snapshot) | **LIVE ✓** | matches curl: Monad deployer 3×true, Safe 3×true; Arc Safe PAUSER-only; REVERT rows preserved; findings incl. cross-chain asymmetry |
| AuthorizationAuditSection:214,232-241 | "0 transactions sent", probe blocks/dates, NOT ACCEPTED | lib task9/task10 evidence mirrors | **SPEC (evidence dossier) ✓** | static typed mirrors of audit-work/v9-task9 + task10, labeled as such; transactionCount 0 |
| AuthorizationAuditSection:637,754,862,985,1145 | 19 accounts, N deviations, threshold 1/1 · nonce 0, 3 live generations | derived from lib arrays | **DERIVED ✓** | counts computed from the imported evidence arrays |
| InvestorSection:218 | "4 chains verified" pill | lib length | **DERIVED ✓** | Object.keys(CANONICAL_MTQ_ADDRESSES).length = 4 |
| InvestorSection:248-349 | per-chain name/symbol/decimals/roles/block/verifiedAt | /api/onchain/<chainId> per chain | **LIVE ✓** | curl monad: MITHQAL/MTQ/18, roles admin/minter/pauser true, paused false, latestBlock 73582483 |
| InvestorSection:145-190 | 5 health cards (Index, RR, NAV, LCR, status) | snapshot | **LIVE ✓** | RR 1116.83→"1116.8x", NAV $983.96K etc. |
| InvestorSection:482-507 | total trials / mints / redeems / success rate | /api/trials/export?format=json | **LIVE ✓** | derived from live export (limit 5000 ≥ current count) |
| InvestorSection:410 | pill "F1 + F2 FIXED" + static copy "every issuer ≤ 25% warn threshold" | static copy vs live severity | **HARD — CONTRADICTED LIVE** | live concentration: TETHER/PAXOS/CIRCLE each **25.57% status "warn"**; /api/ai/risk-signals: "CIRCLE at 25.57% — above the 25% warn threshold". (F2 severity=fixed comes from the engine, but the "≤ 25%" sentence is false today; root cause also engine text in snapshot.reconciliation[F2].resolution) |
| PitchSection:189-208 | traction title/body derived "Live on 4 testnets · 10,300 runs · … verdict PASS" | /api/tests audit | **LIVE ✓** | fetch-fail fallback renders "—" honestly; "4 testnets" hardcoded but matches canonical 4 |
| PitchSection:62 | "Mint fee 0.10% / Redeem fee 0.15% (§3.4)" | blueprint | **SPEC ✓** | redeem golden path fee $197.11/$131,403.55 = 0.15% consistent |
| PitchSection:51 | "$200B stablecoin supply 2025 / tokenized gold ~$1.2B" | external market claim | **UNSOURCED MARKETING** | no citation/API backing; add source or label as estimates |
| PitchSection:162,279 | "v1.2 · FINAL" pill; "the 10,300-run Monte Carlo audit" CTA | HARD | **HARD (minor)** | version string conflicts w/ honest-status "master-v1.0-pilot" & /api/status "Σ-v1.2"; 10,300 static |
| DevelopersSection:36-109 | API route table (41 rows) + "N routes · M rate-limited" | verified static doc | **SPEC ✓ (doc)** — but **INCOMPLETE** | omits existing public routes **/api/constituency, /api/issuance, /api/release-state** (verified present in src/app/api); webhooks/inngest internal (ok) |
| DevelopersSection:114-130 | repo artifacts list | verified static doc | **SPEC ✓** | existence-verified claim; spot-checked dirs exist |
| HonestStatus.tsx:129-224 | F1–F4 findings + per-issuer breakdown | snapshot.reconciliation + snapshot.concentration | **LIVE ✓** | IssuerBreakdown shows live 25.57% warn chips (amber) — honest despite "fixed" severity |
| HonestStatus.tsx:163-171,248 | HONEST_STATUS + UNSUPPORTED_CLAIMS tables | blueprint lib | **SPEC ✓** | labeled v1.0 tables |
| HonestStatus5Level:616 | pill "**0x7FF · 11/11 VALIDATED**" | HARD | **HARD — STALE/CONFLICTS** | live implementedMask = **4095 = 0xFFF**, not 0x7FF; "11/11 VALIDATED" is a static claim (live API has no per-bit validation field) |
| HonestStatus5Level:657,688,524 | "141-test Layer 1-7 suite" (×3) | HARD | **HARD — STALE** | current canonical suite is **253/253** (worklog D-13.26); older records say 159; evidence rerunResults say 250/250 — four different counts circulate |
| HonestStatus5Level:260-360 | 11 gates: 1 PARTIAL + 10 SPECIFIED_ONLY | static 5-level grading | **SPEC-ish ✓** | consistent with live 0/11 passed (no gate marked passed); evidence wordings differ from live /api/honest-status evidence strings (redundant drift risk) |
| AuditFindings:118-130 | static STRESS_HEADLINE (S5 100% PASS, S3 39.5%, S2 84.4%, S1 89.0%, S11 51.5% PARTIAL…) | HARD | **HARD — CONTRADICTS LIVE** | live /api/validation: **S5 = 0.0% FAIL (EMERGENCY)**, S3 33.9%, S2 83.0%, S1 87.8%, S11 51.5% FAIL; live audit says **6 FAIL** not "3 stress tests still FAIL (S2/S3/S4)" |
| AuditFindings:308 | "11 scenarios, 18,450 trajectories" | HARD | **HARD — WRONG** | live validation total runs = **11,553** (2000+2000+2000+2000+100+100+1+1+1+50+3200) |
| AuditFindings:166,177,197 | "141/141 Tests Pass" (header + chip + body) | HARD | **HARD — STALE** | current suite 253/253 (and /api/tests is a different 10,300-run battery) |
| AuditFindings:105-106,253 | "0x7FF honest mask … TRUTHFULLY EARNED" | HARD | **HARD — CONFLICTS** | live implementedMask 0xFFF; the 0x7FF claim describes the undeployed V3 contract — presented without that qualifier in the header |
| InstitutionalDashboard Tab A:109-124 | 19/23 acceptance (82.6%), 0/13 institutional gates, 13 gates list | /api/implementation-status | **LIVE ✓** | heading "(0 passed)" hardcoded but matches live passed=0 |
| InstitutionalDashboard Tab B:144-169 | gates 0/11, masks 0xFFF/0x000, version, per-gate FAIL pills | /api/honest-status | **LIVE ✓** | **canonical live gate surface — correct** |
| InstitutionalDashboard Tab C:184-213 | threeBookOperational pill, N tests, N/N BLOCKED | /api/three-book | **LIVE ✓** | counts live (E2E fix verified) |
| InstitutionalDashboard Tab D:230-244 | cellCount 4 (SIM), live cells 0, $127.1M backing, $97.7M max issuance | /api/protected-backing | **LIVE ✓** | "0 LIVE CELLS" pill + "4 SIMULATED" heading hardcoded but match live values |
| InstitutionalDashboard Tab E:261-277 | 13 dimensions, $140.00M exposure, violations, HHI 0.1881 | /api/systemic-risk | **LIVE ✓** | constraintsMet false → "VIOLATIONS" pill honest |
| InstitutionalDashboard Tab F:289-308 | 8 jurisdictions (PENDING), 72 licensing entries, 0 licenses | /api/legal-registry + /api/licensing-matrix | **LIVE ✓** | "0 LICENSES" pill + "8 jurisdictions (ALL PENDING)" heading hardcoded, match live |
| InstitutionalDashboard Tab G:328-348 | 17 patterns, 0 unresolved, per-pattern CLEAN | /api/contradiction-scan | **LIVE ✓** | post-E2E fix verified live |
| InstitutionalDashboard Tab H | 8 lifecycle states, 3-step waterfall | /api/bank-default | **LIVE ✓** | live |
| InstitutionalDashboard Tab I:407-413 | "**ALL CONNECTED**" pill + 4 emerald ✓/✗ boxes | /api/sync values | **LIVE values, HARD tone — BUG** | live: Turso **false**, Neon **false**, Inngest **false** (only Vercel true) — header claims ALL CONNECTED and boxes are hardcoded emerald |
| InstitutionalDashboard Tab J:441 | "0/5 CONFIGURED" emerald pill | /api/ai/status | **LIVE value, HARD tone — BUG** | totalConfigured=0 rendered with hardcoded emerald + check icon |
| InstitutionalDashboard Tab K | PoR unverified, RR 1116.8003, $881.05 liability, $983,962 backing, composition vs targets | /api/por | **LIVE ✓** | matches curl |
| InstitutionalDashboard Tab L | pool $50K/$50K, coverage 2676.79% | /api/stability-pool | **LIVE ✓** | live |
| InstitutionalDashboard Tab M | 1/1 banks authorized | /api/banks | **LIVE ✓** | live |
| InstitutionalDashboard Tab N | MTQSigmaV3 NOT DEPLOYED, gates 0/11, masks | /api/v3 | **LIVE ✓** | live |
| InstitutionalDashboard:832 | "All 14 sections fetched live" | true | ✓ | all 14 tabs use useJson + error panels |
| ReproducibilityPanel:50-64 | version lineage "v1.0-2026 / MASE-v1 / BLUEPRINT-v1.0 / 3-Source-§9" | HARD | **HARD — CONTRADICTS ADJACENT LIVE** | TransparencySection §24.2 cards 20 lines above show live source ("Live (Frankfurter ECB + gold-api + Yahoo…)") and objectiveVersion ("8term-v2-pilot-uniform-lambda-plus-5.5-regime-scaled-cvar") |
| ReproducibilityPanel:20-32 | REPRODUCE = re-fetch /api/metrics, compare gfbIndex (tol 1e-4) | weak check | **DESIGN GAP** | network re-fetch of live endpoint ≠ recompute from published inputs; FX drift between fetches can produce false MISMATCH |
| GfbBasket | Strategic prior 7 components, base fixings, denominator 7.1781 | blueprint lib | **SPEC ✓** | constants from lib (single source) |
| ClosedLoopMap:39-49 | edge values P/L/RR/W_target/in-band | snapshot | **LIVE ✓** | live snapshot fields |
| SuccessionLab:45,136-139 | ejected options (live w/ static fallback), quotes live/fallback label | /api/succession | **LIVE ✓** | fallback labeled |
| TrialLog | trial rows, RR/LCR coloring | /api/trials via props | **LIVE ✓** | props from parent fetch |
| ContractRegistry | chain tabs + contract tables | lib ALL_CHAINS | **SPEC ✓ (dup)** | duplicate of ContractsSection (see C) |
| TestnetStatusBar (context check) | "Validation Gates: 0/11" | /api/honest-status | **LIVE ✓** | fetched live + focus refresh; matches 0/11 |

## B. WIRING BUGS (highest severity first)

1. **AuditFindings.tsx static stress table contradicts live /api/validation** (rendered at the TOP of SecuritySection, line 162). Static S5 "Gold +50% — FIXED, survival 100.0%, PASS" vs live S5 survival **0.0%, 100/100 breach runs, finalStatus EMERGENCY, verdict FAIL**; static "3 stress tests still FAIL (S2/S3/S4)" vs live **6 FAIL (S1,S2,S3,S4,S5,S11)**; static survival values (S1 89.0/S2 84.4/S3 39.5/S4 57.3) differ from live (87.8/83.0/33.9/56.05); "18,450 trajectories" vs live 11,553 runs; "141/141 tests" vs current 253/253 canonical. The same app shows live S5=FAIL in the Validation section and static S5=PASS in Security — a direct internal contradiction on a headline safety number. Fix: fetch /api/validation (like ValidationResearchSection) or delete STRESS_HEADLINE and link.
2. **InstitutionalDashboard Tab I "ALL CONNECTED"** (InstitutionalDashboard.tsx:408): hardcoded emerald pill + hardcoded emerald StatBox tones while live /api/sync returns Turso/Neon/Inngest `configured:false` (boxes render "✗" in green). Truth-posture violation on an institutional surface. Fix: derive pill text/tone from the connection flags.
3. **InstitutionalDashboard Tab J emerald "0/5 CONFIGURED"** (line 441): count live (0/5) but tone + check icon hardcoded emerald — green-washed zero. Fix: tone from totalConfigured>0.
4. **InvestorSection F2 copy vs live concentration** (InvestorSection.tsx:451-457): "every issuer ≤ 25% warn threshold" is false today (TETHER/PAXOS/CIRCLE each 25.57%, status warn; risk-signal fires). The "F1 + F2 FIXED" pill is also unconditional while the cards render only after snapshot load (empty state says "Loading…" under a "FIXED" pill). Root cause is shared with the engine's F2 resolution text (snapshot.reconciliation[F2].resolution) — engine text should be updated to "≤ 30% limit enforced; warn threshold currently exceeded (25.57% × 3)".
5. **HonestStatus5Level.tsx:616 "0x7FF · 11/11 VALIDATED"** — hardcoded mask conflicts with live implementedMask 0xFFF (4095) from /api/honest-status; the entire 22-row table is static (with "141-test" stale suite count ×3 at lines 524, 657, 688) while a live canonical source exists. Same page class (InstitutionalDashboard Tab B) renders it live and correctly — two surfaces disagree on presentation.
6. **MandateCompliance.tsx:284** sub-label "C-001…C-043" vs live conflictsTotal **49** — the static range truncates the live register it sits under.
7. **ContractsSection eyebrow "Deployments · 4 testnets"** (ContractsSection.tsx:460) vs the 6 tabs it renders (pill: "6 chains · 31 contracts"), including **Base and Arbitrum MAINNET** tabs whose only "contract" is a 0x000…000 "pending deploy" placeholder — mainnet entries in a TESTNET-ONLY terminal.
8. **ReproducibilityPanel hardcoded version lineage** (ReproducibilityPanel.tsx:50-64) contradicts the live §24.2 version cards in the very same section; and the REPRODUCE button re-fetches /api/metrics instead of recomputing from published inputs (§24.1 claim overstated).
9. **DevelopersSection API table omissions**: /api/constituency, /api/issuance, /api/release-state exist and are public GETs but are absent from the "every path verified to exist" reference (DevelopersSection.tsx:36-109).
10. **Hardcoded "10,300" copies** (currently correct, drift-prone): TestsSection:111,133,149,269; SecuritySection:648; PitchSection:279; InvestorSection INVESTOR_ENDPOINTS:58. Derive from `audit.totalRuns`.

## C. REDUNDANCY / GROUPING (concrete merge proposals)

1. **Honest-status gates rendered 4×**: TestnetStatusBar (live), InstitutionalDashboard Tab B (live), HonestStatus5Level (static, in Security + Docs), HonestStatus HONEST_STATUS table (static blueprint). → Proposal: one shared `<HonestStatusLive>` component fed by /api/honest-status (single fetch, shared via PCC); keep HonestStatus5Level only as the 5-level *methodology* legend with live gate rows injected.
2. **AuditFindings (Security) vs ValidationResearchSection**: same §23 stress domain, one static, one live, values conflict (B1). → Proposal: AuditFindings keeps only the P0/bit-verdict audit history (clearly dated "V3 reconciliation record") and renders the §23 headline table from /api/validation; or move AuditFindings into Docs as an archival artifact.
3. **ContractsSection vs ContractRegistry**: near-identical chain tabs + ecosystem tables + honest note from the same lib (ContractRegistry.tsx is a subset of ContractsSection.tsx minus role matrix/canonical card). → Proposal: delete ContractRegistry; render `<ContractsSection />` (or a compact variant) in DashboardSection.
4. **Role/authority surfaces ×3**: ContractsSection role matrix (live /api/roles), AuthorizationAuditSection §02 owner-reference + §04 authority graph (static task9 evidence), InvestorSection role chips (/api/onchain). → Proposal: keep all three but have AuthorizationAuditSection §02 note "re-verified live in Contracts section" and drop the duplicated owner-reference block, or add a live re-probe there.
5. **Mandate registers ×2**: MandateCompliance full registers (od/conflicts/tests tabs) vs EvidencePackageSection §6 decision matrix + live rollup line. Overlap = OD decision statuses. → Proposal: EvidencePackage keeps only the D-6/evidence-specific rows (OD-1/2/3/5/29/35) and links to Mandate for the full register (it already fetches /api/mandate for rollups).
6. **Three "test" surfaces need explicit taxonomy labels**: MandateCompliance "Test Matrix" (T-01..88 requirement register), TestsSection (10,300-run MC survival audit), ValidationResearch (§23 S1–S11 reference engine with 6 FAILs). Users can conflate "audit PASS" (TestsSection) with "6 scenarios FAIL" (validation). → Proposal: cross-link banners on all three ("these are three different batteries — register / MC survival / §23 reference engine") and show the 6-FAIL headline wherever the 10,300 PASS headline appears.
7. **Trial surfaces ×3**: TrialLog (activity), InvestorSection Trial Traction (export counts), EventExplorer (PCC) — same SQLite source. Acceptable, but traction stats could be one shared component.

## D. REMOVAL candidates

1. `ContractsSection.tsx:445-451` — dead `arc-pilot-v2` key in canonicalChainIds (no such chain id).
2. `AuditFindings.tsx:118-130` STRESS_HEADLINE — static, wrong vs live (B1).
3. `HonestStatus5Level` static HONEST_BITS/VALIDATION_GATES arrays + "0x7FF" pill + "141-test" copy — replace with live fetch (B5).
4. `ReproducibilityPanel.tsx:48-65` hardcoded version-lineage block (or wire to snapshot.source / mase.objectiveVersion).
5. Base/Arbitrum placeholder chains from UI surfaces (either drop from ALL_CHAINS or filter `c.contracts.some(x => x.address !== ZERO)` in ContractsSection) — removes two mainnet tabs + fixes the "4 testnets vs 6 chains" mismatch.
6. `ContractRegistry.tsx` (whole component) — duplicate of ContractsSection (C3).
7. InvestorSection static F1/F2 prose block (lines 451-458) — replace with the live findings' own description/resolution text (already rendered in the cards above it).
8. `GfbChart` synthetic 24h trajectory (HomeSection hero): endpoint value is live but the path shape is synthetic (`Math.sin` noise) with no in-chart disclosure — either label "illustrative trajectory · live endpoint" or drop the history path (keep the live value).

## E. COPY/CLAIM corrections

1. SecuritySection:239 "Constitution 7/7 Multi-Sig · 90d timelock" → append "(design target — current pilot Safe is 1/1 deployer-controlled, OD-35)". Line 249 "3 sources · 3-of-3 valid · Chainlink+Pyth+Chronicle" → "(design; pilot board = Frankfurter/gold-api/Yahoo; on-chain adapters compiled, not deployed)".
2. InvestorSection:454-457 & engine F2 resolution: "every issuer ≤ 25% warn threshold" → "30% hard limit enforced; all three issuers currently at ~25.6%, above the 25% warn threshold (drift warning active)".
3. MandateCompliance:284 "C-001…C-043" → "C-001…C-049".
4. HonestStatus5Level: "0x7FF" → live mask (0xFFF) or explicit "V3-contract target mask 0x7FF (not deployed)"; "141-test" → current canonical count (253) or "the canonical invariant suite (see /api/tests)".
5. AuditFindings header "141/141 Tests Pass… 3 stress tests still FAIL" → reconcile with live 253/253 canonical + /api/validation 6 FAIL, or re-caption the whole panel "Historical V3 reconciliation record (2026-10)".
6. PitchSection:51 market stats need a source or "estimate" label; "v1.2 · FINAL" version pill vs honest-status "master-v1.0-pilot" — pick one versioning scheme.
7. TransparencySection:971-977 grammar: "…not permanence. whose integrity is checkable…" — dangling clause after the period (merge sentences).
8. DevelopersSection integration notes: fine as-is; add the 3 missing routes.

## F. VERIFIED CORRECT (brief)

- **0/11 gates**: TestnetStatusBar and InstitutionalDashboard Tab B both live-fetched and match /api/honest-status (0/11, isProductionAuthorized false). No "3/11" anywhere in the audited cluster.
- **7 OPEN mandate**: MandateCompliance (7/38) and EvidencePackageSection rollup line both live from /api/mandate.
- **J/G/netBenefit scale fix holds**: TransparencySection firstMandate ($126.99/$77.40/−$492.06) and MandateCompliance pipelineDemo ($371.25/$16.52/$825.00/−$470.27/REJECT) — all sane USD, net negative, blocked·shadow. Zero quadrillion values.
- **TestsSection / SecuritySection audit panel / PitchSection traction / EvidencePackageSection / ValidationResearchSection / InstitutionalDashboard Tabs A–H, K–N**: fully live with honest error states, matching their APIs number-for-number.
- **ContractsSection role matrix**: live /api/roles with DEGRADED fallback + honest UNVERIFIED markers; Monad/Arc asymmetry (Safe all-3 vs PAUSER-only) preserved and explained.
- **AuthorizationAuditSection, DevelopersSection cast scripts, GfbBasket, TrialLog, AIPolicyBriefing, BlueprintQA, SuccessionLab, ClosedLoopMap, ConstitutionalSeparation, EventExplorer**: correct sourcing (typed evidence mirrors labeled as evidence, live snapshot fields, or live API), shadow-mode disclaimers intact, POST /api/ai/qa wired correctly.
- **CBDC SIMULATED / NOT ACCEPTED posture** preserved in every audited surface header.

**Posture check**: TESTNET ONLY · SHADOW MODE · 0/11 gates · 7 OPEN · netBenefit negative/blocked · NOT ACCEPTED — all correctly reflected by the live surfaces; the exceptions are the static panels listed in B/E.
