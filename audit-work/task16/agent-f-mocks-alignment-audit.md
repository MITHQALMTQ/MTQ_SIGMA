# Task 16-f — Mocks/Placeholders + v3 No-Reserve Alignment + Blueprint-Conformance Audit

Agent: 16-f (READ-ONLY — no source modified; light curls only)
Date: 2026-10-23 (session)
Mandate: PLATFORM-FULL-AUDIT-AND-REMEDIATION-001 §13 (mocks), §2 (blueprint conformance) + owner "we don't use reserves" continuation (Task 15 lineage).
Method: full `src/` marker greps (TODO/FIXME/stub/mock/placeholder/fake/dummy/WIP/not-implemented/coming-soon), 351 user-visible-reserve occurrences triaged across 53 component files + lib doc strings, per-file render-context reads, live curls (/api/por, /api/banks, /api/metrics, /api/three-book, /api/protected-backing, /api/implementation-status). Cross-referenced (not re-audited): 16-a (API), 16-b (integrations), 16-c (frontend wiring), 16-d (DB), Task 14 (content audit), Task 15 (v3 framing).

---

## A. Mock/placeholder classification table (mandate §13)

| # | Location | Hit | Class | Verdict |
|---|----------|-----|-------|---------|
| 1 | `src/lib/mtq/sanctions.ts:102,110` | `// TODO: implement TRM Labs API call` / `// TODO: implement Chainalysis KYT API call` | incomplete — but module is DEAD CODE (never imported; 16b-007) | P4 — either delete or keep with the dead-code caveat; pairs with the "BM-04 AML" unwired-label finding (16b-007) |
| 2 | `src/lib/mtq/proof-of-reserve.ts:229-249` | "Production path stub… TODO(STABILITY-POOL-FEES-POR follow-up): wire the Chainlink PoR adapter" + pilot fallback (`verified:false`, custodian "NOT production-safe") | intentional-and-labeled | PASS — stub THROWS (fail-loud); fallback labeled; /api/por live-verified: `status:"unverified"`, "pilot fallback — Chainlink PoR feed not wired", disclaimer. UI shows UNVERIFIED pill |
| 3 | `src/lib/mtq/issuance/authorization.ts:191-215` | "STUB ATTESTER — CLEARLY LABELED… TEST-ONLY" | intentional test fixture | PASS — every surfaced string carries "STUB — TEST-ONLY"; /api/issuance records labeled "STUB attestation (TEST-ONLY — no authorized independent attester exists in this pilot)" |
| 4 | `src/lib/mtq/issuance/test-fixtures.ts` (consumed by `src/app/api/issuance/route.ts:77` — a production route) | TEST-USDC-X & co. SYNTHETIC fixtures | intentional test fixture in production path | PASS-with-note — the Issuance Lab IS a labeled demonstration: UI shows "TEST-ONLY fixtures", "BORN EMPTY… admission is FAIL-CLOSED", "synthetic fixtures · fixed clock", "ILLUSTRATIVE — D-13.8 OPEN", "UNAPPROVED · D-13.6 deferred", "D-13.27: ADOPTED (DELEGATED) — PENDING OWNER RATIFICATION". No non-test code imports `__tests__/` |
| 5 | `src/lib/mtq/bank-registry.ts:48-70` | "These are placeholder addresses for the testnet pilot" — Hardhat/Foundry default account #1, `isAuthorized:true`, `authorizedAt: Date.now()` | placeholder labeled in CODE ONLY, not in API/UI | **DEFECT 16f-006 (P2−/P3)** — UI renders "Pilot Bank A — 1/1 AUTHORIZED" emerald + "authorized: 2026-10-23" as a governance fact; no council exists (OD-3 OPEN); /api/banks note omits the disclosure |
| 6 | `src/components/mtq/WeightChangeDrawer.tsx:58-82,520-523` | `syntheticPriceRelative()` — synthetic per-component price relatives; rendered as "Purchasing-Power Signal … signed price-relative drift vs base date (§3.4)" | unlabeled synthetic at render | **DEFECT — cross-ref 16c-005 (still open)**; sibling row above it IS labeled ("synthetic vols for pilot") |
| 7 | `src/components/mtq/WeightChangeDrawer.tsx:158-162,600-611` | client-fabricated `DEC-YYYYMMDD-COMP-NNNN` + gold "audit" pill | fabricated audit-grade identifier | **DEFECT — cross-ref 16c-006 (still open)** |
| 8 | `src/components/mtq/GfbChart.tsx:20-35` + render at `HomeSection.tsx:186` | synthetic 24h trajectory ending at live value; no visible label | unlabeled synthetic visual | **DEFECT 16f-007 (P3)** — sibling ReferenceChart got inline "Illustrative — synthetic history" markers (Task 14); GfbChart did not |
| 9 | `src/components/mtq/EventExplorer.tsx:143-163` (also 246-248, 267-292, 319-346) | `buildSyntheticEvents()` + `fakeTxHash()/fakeBlock()` — per-row `source:"simulated"` rendered as amber "simulated" tag; explorer link aria-labeled "will not exist for synthetic events" | intentional-and-labeled (rows) | MOSTLY PASS, two exceptions: (a) header pill "live" whenever not loading even if /api/trials fetch failed (cross-ref 16c, still open); (b) **DEFECT 16f-009 (P3)** — the synthetic genesis row re-asserts the DISPROVED reserve-funding narrative: "1,100,000 USDC funded to reserve", detail "Reserve funded 1,100,000 USDC", "Status: ok · canonical" → contradicts mandate-register C-047 |
| 10 | `src/components/mtq/ReferenceChart.tsx:156,167,178,488,628` | synthetic history | intentional-and-labeled | PASS — CONFIRMED Task 14 fix held (inline "Illustrative — synthetic history" qualifiers) |
| 11 | `src/components/mtq/HonestStatus5Level.tsx:157-174,665-670,807` | "deterministic evidence-hash placeholder… NOT cryptographically secure — evidence-fingerprint placeholder per Deliverable I" | intentional-and-labeled | PASS — table framed as "methodology-register snapshot — the live masks, gate outcomes and version are fetched from /api/honest-status"; live pill `0xFFF implemented · 0/11 gates` consistent with register |
| 12 | `src/lib/mtq/mandate.ts:344-385`, `mase.ts:188,1458` | uniform κ=1 placeholder, zero reserve-risk placeholder (OD-5), uniform λ placeholder | intentional, REGISTERED placeholders ("never invented") | PASS — surfaced honestly in MaseEngine ("disclosed uniform placeholder (1/8, OD-1/OD-31 calibration…)") and mandate register OD-1/OD-5/OD-31 |
| 13 | `src/components/mtq/FaucetPanel.tsx:73-83` | "MockUSDC — pilot collateral" | intentional testnet fixture | PASS — labeled at every chain row |
| 14 | `src/components/mtq/NetworkSelector.tsx:47` + `ContractsSection.tsx:57,511,584` | pending-deploy zero-address placeholders (Base/Arbitrum) | intentional-and-labeled | PASS — "Pending-deploy banner for mainnet placeholder chains" renders; "never presented as deployed" |
| 15 | `src/lib/mtq/address-book-validation.ts:148-154` | "zero-address / pending-deploy placeholder" validation rule | intentional validation rule | PASS |
| 16 | `src/components/landing/EcosystemSection.tsx:5` + `landing-status.ts:20,191-236` | dashboard preview "mock" | intentional-and-labeled | PASS — SIMULATED PREVIEW tag + "Illustrative interface preview… not live data, not a deployed product." |
| 17 | `src/components/ui/*` + simulator inputs | `placeholder=` HTML attributes | non-data | ignore |
| 18 | `src/components/mtq/ArchitectureSection.tsx:204,231` | "Mock ERC-20 assets and mock oracle feeds prepared (Appendix D.3)" | intentional, labeled "mock" | PASS (checklist/spec rows) |
| 19 | `src/components/mtq/RiskSignals.tsx` | "Generated by …" attribution | previously fabricated (Task 14) | PASS — CONFIRMED fix held: renders live `model` field; fallback → muted "fallback-rules" tone |
| 20 | `src/app/api/inngest/route.ts` comment | claims dev-mode works | FALSE comment | cross-ref 16b-001 (route 500s ×3 methods) — still open |
| 21 | `src/lib/mtq/issuance/cbdc-adapter.ts`, `instrument-registry.ts` | "SIMULATED-CBDC-RAIL-1 (SYNTHETIC)", "NO ISSUING AUTHORITY EXISTS", notices "PROPOSED (D-13.19)… SYNTHETIC record" | intentional-and-labeled | PASS — exemplary density of synthetic/PROPOSED labels, live-verified in /api payloads |

No "coming soon", "WIP", "HACK", "FIXME", "dummy", "not implemented" hits in src/ beyond the above. TODO total: 3 (2 dead-code sanctions, 1 labeled PoR stub).

### A.2 Hardcoded data that LOOKS live (terminal sections)
- EventExplorer synthetic events — labeled per row (see #9) EXCEPT the genesis narrative (16f-009).
- Bank Registry — hardcoded authorization state presented as live governance (16f-006).
- GfbChart — synthetic trajectory, unlabeled (16f-007).
- PitchSection PANELS — static marketing copy incl. the "audited reserve portfolio" claim (16f-001) and "v1.2 · FINAL" pill; traction numbers correctly LIVE-wired to /api/tests with honest "—" fallback (PASS on wiring).
- LandingNav chain notes ("code verified") — consistent with the read-only-verified registry (PASS).
- COUNCILS / GOV_LAYERS constant arrays — spec tables; EventExplorer versions carry "SPECIFIED, no live councils (G9 NOT CONDUCTED)" (PASS); PCC GovernanceSection cards lack that qualifier (16f-011, P4).
- PoR targets (por/route.ts:70-76: 1.30 / 80-18-2) — from the v25.3 final-reserve spec module (CANDIDATE_MODEL_VALIDATION_PENDING) but presented in the PoR panel without the candidate qualifier, and inconsistent with the 110% RR target shown everywhere else (16f-012, P4).
- Everything else traced in Task 14 (InstitutionalDashboard tabs, HonestStatus5Level, OnChainMatrix, AuditFindings, ProductionReadinessDashboard) — CONFIRMED fixes held on spot-checks.

### A.3 Success-before-completion traces ("verified"/"live"/"on-chain")
- "VERIFIED" pill (InstitutionalDashboard SectionK) ← `att.verified` from /api/por ← pilot fallback hard-codes `verified:false` → renders UNVERIFIED. PASS (honest by construction).
- "code verified" (LandingNav, InvestorSection "N chains verified · verified {ago}") ← contracts.ts registry + live /api/onchain. PASS.
- "ALL CONNECTED" (InstitutionalDashboard) — now computed from live per-chain fetch (Task 14 fix held). PASS.
- "1/1 AUTHORIZED" (Bank Registry) ← hardcoded `isAuthorized:true` + `authorizedAt:Date.now()` → DEFECT 16f-006.
- "live" pill (EventExplorer) ← `!loading` only; fetch failures swallowed → cross-ref 16c (still open).
- HonestStatus5Level "VALIDATED" rows ← methodology-register snapshot, live masks shown above; labeled. PASS.
- TruthBanner trio (TESTNET ONLY · SHADOW MODE ENFORCED · RESERVE TRADING NOT AUTHORIZED) — rendered on Mint/Redeem/Simulation/Networks. PASS (prohibition banner, per mandate).
- IssuanceSection statuses ← /api/issuance snapshots with D-13.27/D-13.8/D-13.6 labels. PASS.

### A.4 Catch blocks that hide failures (src/components + src/lib/mtq)
- Dominant pattern is fail-honest (setError / keep-last-good with comments; TestnetStatusBar renders "—/—"; TransparencySection renders "unavailable, nothing fabricated"). PASS overall.
- `DashboardSection.tsx:152,163,175` + `InvestorSection.tsx:121` — catch-ignore on oracle/registry/trials fetches → null state renders "—"/empty; the TRIALS case renders **"No trials yet"** on fetch failure (TrialLog.tsx:75-77) — fetch-failure presented as empty ledger → 16f-014 (P4).
- `EventExplorer.tsx:446` catch-ignore → "live" pill on failure (cross-ref 16c, still open).
- `GovernanceSection` (PCC) `.catch(() => {})` at :759 → permanent "loading" pill on failure (cross-ref 16c-004, still open).
- lib/mtq: all catches are log-and-continue with explanatory comments (rate-limit falls back to in-memory limiter; release-controls fail-CLOSED; engine attribution non-blocking). Acceptable. pilot-state audit-trail persistence failures are console.error-only — severity inherited from 16d-001 (hash chain unverifiable), not re-filed here.

### A.5 Test fixtures in production paths
- Only production-path fixture consumer: `/api/issuance` route → `issuance/test-fixtures.ts` — BY DESIGN for the Issuance Lab, fully labeled end-to-end (see #4). No `__tests__/` or `*.test.*` imports in non-test code (ProductionReadinessDashboard references a `__tests__` path as an instructional STRING only). PASS.

---

## B. v3 no-reserve alignment sweep (Part B deliverable table)

Legend: ✅ = labeled-legacy / banner / prohibition; 🔧 = DEFECT (16f-ID); 🟡 = technical-OK per standard (live legacy-engine metric in a technical dashboard, legacy qualifier elsewhere in same view) with optional consistency polish; ℹ️ = code-only (not user-visible).

### B.1 Task 15 items — CONFIRMED HELD
| Surface | Check | Verdict |
|---|---|---|
| HomeSection WHAT_IS card "No Conventional Reserve" + D-13.3–D-13.7 note | lines 84-87 | ✅ HELD |
| HomeSection gold section "v3 no-reserve posture" eyebrow + "Legacy pilot buffer path (v1/v2)" row + by-design strip | 349, 420-526 | ✅ HELD (index-weight gauge keyed to MASE target; buffer row labeled) |
| InstitutionalHero tagline "No-Conventional-Reserve Design" + "legacy v1/v2 reserve-path accounting" cards | 251, 345, 390-405 | ✅ HELD |
| QuickStatsRow / LiveStatsBand "Pilot Ledger NAV" / "Reserve Ratio (legacy)" / trend "no liability · ∞" | 121-179 | ✅ HELD (labels) — but the VALUE string still renders "∞ — fully reserved" via shared fmtRatio → 16f-002 |
| BasketValueDisplay "Pilot-Ledger Reference Basket (simulated, legacy v1/v2)" + Gate B note | 86-101 | ✅ HELD |
| ConstitutionalSeparation home intro "Legacy §1.1 exhibit… kept labeled" | HomeSection 519-526 | ✅ HELD |
| GfbBasket GoldInReserve eyebrow + "legacy v1/v2 reference path" paragraph | 141, 179 | ✅ HELD |
| landing-status.ts "Asset-Referencing Basket Design / Basket-referencing", "Basket-Referenced Value — a reference, not a peg", "0/7 Release Gates" stat | 94-95, 124-125, 164 | ✅ HELD |

### B.2 Every remaining user-visible "Reserve" phrase → verdict
| Surface (file:line) | Phrase | Verdict |
|---|---|---|
| TruthBanner.tsx:23 + MintSection/RedeemSection/SimulationSection/NetworksSection banners; MandateCompliance:266; landing-status:59; LandingNav:345 | "RESERVE TRADING NOT AUTHORIZED" / "Production reserve trading: NOT AUTHORIZED" | ✅ prohibition banner (mandate: fine) |
| **PitchSection.tsx:41** | "An audited reserve portfolio (stablecoins + tokenized gold) collateralizes every MTQΣ at a 110% Reserve Ratio target." | 🔧 **16f-001 (P2)** — marketing-grade reserve-backing claim, unlabeled legacy + "audited" contradicts G1 register |
| PitchSection.tsx:38,52,53,60,63 | "collateralized Global Digital Asset", "asset-backed", "protocol-owned reserve yield", "reserve portfolio holds yield-bearing stablecoins" | 🔧 16f-001 (same fix pass) |
| **brand.ts:135** (BRAND_VOICE.coreObjective) | "The reserve portfolio exists to collateralize that obligation." | 🔧 **16f-004 (P2−)** — rendered app-wide: Footer.tsx:88 ("Objective:"), HonestStatus.tsx:146, PitchSection.tsx:173 |
| **DashboardSection.tsx:242-245** | "The reserve portfolio exists to collateralize that obligation." (Portfolio intro) | 🔧 **16f-003 (P2−)** — the Home twin was reframed (Task 15); the Portfolio twin kept the v1/v2 doctrine |
| **DashboardSection.tsx:295-299** | "The Reserve NAV backs that liability at the Reserve Ratio." (Closed-Loop intro) | 🔧 16f-003 (same fix pass) |
| **format.ts:43** (+ copies Header:156,159 · LiveMonetaryState:174,198 · ConstitutionalSeparation:282 · RebalanceEngine:571 · DashboardSection:250) | "∞ — fully reserved" | 🔧 **16f-002 (P3, high-leverage)** — shared formatter injects the phrase into every RR/LCR display platform-wide whenever liability=0, incl. Task-15-fixed value strings, Sidebar aria, ClosedLoopMap edge, TrialLog rows, MintSimulator "New RR". Task 15's own standard is "no liability · ∞" |
| **PilotCommandCenter.tsx:339-443** (ReserveSection, sidebar "Reserve Vault" :88, MobileBottomNav "Reserve") | "§4 · RESERVE VAULT / Reserve Composition & Solvency", "Reserve Ratio (RR) … target ≥ 110%", "Reserve Breakdown · 7 Asset Classes", "Reserve gold (MARP)" | 🔧 **16f-005 (P3)** — dedicated reserve-forward section with zero legacy/v3 qualifier in-view; needs the InstitutionalHero-style amber strip |
| MintSection.tsx:76-131,202-209,269 / RedeemSection.tsx:95-130,278,440-484 | §12 mechanics copy: "reserve collateral", "FULL reserve basket", "the reserve most needs protection", "Reserve ratio · reserve ÷ liability · live" | 🔧 **16f-008 (P3)** — TruthBanner covers simulated-pilot but no legacy/v3 note on the mechanics walkthrough (engine-as-implemented v1/v2 doctrine) |
| EventExplorer.tsx:153-163 | synthetic genesis: "1,100,000 USDC funded to reserve … Status: ok · canonical" | 🔧 **16f-009 (P3)** — re-asserts the C-047-DISPROVED funding narrative with "canonical" status |
| InstitutionalDashboard.tsx:504,508,515 | "§47.1 · Chainlink PoR feed / Proof of Reserve / reserve ratio / Reserve composition vs targets" | 🟡 mostly-OK (UNVERIFIED pill + honest summary/disclaimer live-verified) — eyebrow mislabels the source: 🔧 16f-010 (P4) "Chainlink PoR feed" while the feed is NOT wired |
| InstitutionalDashboard SectionA (:676-784) | institutional-facts fields reserveRatioTarget/reserveComposition | 🟡 report fields from labeled v25.x modules |
| InvestorSection.tsx:151,165 | "Reserve Ratio", "Reserve NAV (USD reporting)" | 🟡 technical stats, no legacy tag — optional "(legacy)" for consistency with Home |
| ConstitutionalSeparation.tsx:258,268,282 | ring "C RESERVE", "RESERVE RATIO", "∞ — fully reserved" | 🟡 on Home (legacy-exhibit framing present ✅); on Portfolio unlabeled → covered by 16f-002/003; ring label itself acceptable as the labeled exhibit's content |
| ClosedLoopMap.tsx:25,71 | node "Reserve NAV" + aria "…Reserve NAV determine the Reserve Ratio" | 🟡 technical exhibit; legacy qualifier exists elsewhere in the same Portfolio view only via GfbBasket GoldInReserve — P3-class per standard; fold into 16f-003 fix pass |
| ReserveVault.tsx (§4+§8 panel, Portfolio) | "Reserve Vault Composition" gauge, core/buffer ring | 🟡 technical §-referenced panel; legacy formula explicitly labeled "pre-MASE genesis fallback only" (:277) — OK |
| RebalanceEngine.tsx:165-166,437-444,553,617 | "Reserve gold (MARP buffer)", "legacy §8 buffer formula — pre-MASE genesis fallback", "reserve preservation" | ✅/🟡 legacy-labeled technical panel |
| PCC RebalancingSection:643-654 | "Observed Gold Wt … reserve + index gold / NAV", "Target Gold Wt" | 🔧 (fold into 16f-005 pass) — the §6.5/§8 legacy buffer metric without the "Legacy pilot buffer path" label Task 15 applied on Home |
| LiveMonetaryState.tsx:143,167,320 | "Reserve NAV · USD reporting (§4)", "Reserve Ratio (§4.2)", "Genesis Reserve" | 🟡 technical tiles; "∞ — fully reserved" → 16f-002 |
| Sidebar.tsx:88,205-293 / Navigation / MobileBottomNav / CommandLauncher | "Reserve Vault" nav label; RR in status aria | 🟡 nav-label; resolves itself once ReserveSection carries the legacy strip (16f-005) |
| MandateCompliance.tsx:406,417 | "Genesis Reserve Safe" | ✅ proper noun of the deployed Safe artifact; honest OD-35 1/1 finding displayed — judged FAIRLY = fine |
| OnChainMatrix.tsx:159 | "Genesis reserve (excluded from circulating)" | 🟡 supply-breakdown technical row — OK |
| ArchitectureSection.tsx:32,144,164,188-189,217-221,239,278-291,312-313,337,603 | blueprint §-referenced spec text ("The Reserve NAV collateralizes the token", Ch13/14 mapping, "Reserve Engine" flow node) | 🟡 blueprint-exhibit genre; every row §-referenced; section ends with "Locked vs Must-Be-Validated" honesty — P4 note: could carry one "v1/v2 blueprint exhibit; v3 objective supersedes" banner |
| PCC GovernanceSection COUNCILS:744-749 | (no reserve text — related) 4-council cards | 🔧 16f-011 (P4) — missing "SPECIFIED — NOT OPERATIONAL (OD-3)" qualifier that EventExplorer's own governance rows carry |
| SuccessionLab / SimulationSection:50,102 | "live per-MTQ reserve holdings" | 🟡 lab language; suggest "pilot-ledger holdings" — P4 polish |
| SystemHealth:191,217 | "RR …" ticker text | 🟡 abbreviation, value string via 16f-002 |
| TrialLog:127-128 | RR column `fmtRatio` | 🟡 (16f-002 value string) |
| ConstituencySection:119-123 | "Reserve relevance (IMF COFER)" | ✅ external-world metric (central-bank reserves), not protocol reserve |
| TransparencySection:1039-1040 | MARP formula doc string | ✅ engine formula |
| FaucetPanel / MintSimulator / RedeemSimulator:191 | "New RR" result row | 🟡 (16f-002 value string) |
| Contracts.ts registry rows "Reserve Vault / Reserve.sol" | deployed contract proper names, code-verified notes | ✅ artifact proper nouns |
| lib doc strings (three-book, legal-liability, systemic-exposure, bank-default, protected-backing, implementation-status, final-reserve-spec) | v25.x module reports | ✅ all live-verified honest: "0 live cells; all reference cells SIMULATED", "NOT PRODUCTION-AUTHORIZED", "Never inflate any column", CANDIDATE_MODEL_VALIDATION_PENDING |
| engine.ts / genesis.ts / audit-stress.ts / mandate.ts / oracle-feeds.ts / task10-containment.ts / roles.ts / registry.ts / audit-trail.ts / honest-status.ts / available-backing-certificate.ts | engine-internal + register text | ℹ️/✅ dev-facing or register-honest (ReserveState etc. — not user-visible marketing) |

### B.3 Gold-weight / "LEGACY BUFFER PATH" sweep (§6.5/§8)
- HomeSection gold-weight gauge: ✅ keyed to the INDEX weight (MASE target, 20-32% envelope) with the legacy buffer stats demoted to the labeled "Legacy pilot buffer path (v1/v2)" row (Task 15 — HELD).
- RebalancingSection (PCC:643-654): "Observed Gold Wt (reserve + index gold / NAV)" — legacy buffer metric, unlabeled → fold into 16f-005.
- RebalanceEngine: "legacy buffer (§8)" / "pre-MASE genesis fallback" labels present ✅.
- ReferenceSection: prior-vs-live §3.2/§7 index weights ✅ (no buffer framing).
- RiskSection: no gold-weight display.
- ReserveVault §14.1 split: legacy formula labeled ✅.

### B.4 Landing page (Part B8)
- page.tsx + landing components: ZERO "backed by reserve"/"reserve-backed"/"stable value" claims remain (only a code comment "reference, reserve, risk, MARP" in page.tsx:10 — not user-visible). ✅
- PROTOCOL_STATS "STATUS AT HEAD · READ-ONLY VERIFIED" + substitution footnote ✅; PROTOCOL_CARDS "a reference, not a peg" ✅; VIDEO/WALLET/INFO dialogs truthful (0/7, 1/1 Safe, EIP-170, custody findings) ✅.
- Residuals (cross-ref 16c, still open): EcosystemSection checklist **"Governance & voting portal"** (no voting portal exists — 🔧 16f-013); HERO paragraph "advanced AI models" without the pilot qualifier; headline "A More Stable," aspirational (borderline — vision language, qualified paragraph "(simulated pilot)").

---

## C. Blueprint-conformance scan (documentation-level)

### C.1 Register of known, DOCUMENTED deviations (blueprint.ts + mandate-register.ts + honest-status.ts)
1. **0/11 §25.5 validation gates pass; NOT PRODUCTION-AUTHORIZED** (honest-status.ts:30-36; authorizedMask 0x000) — UI consistent (GovernanceSection honest panel, HonestStatus5Level, landing "0/7 evidence-register gates" footnote with the 0/11 vs 0/7 taxonomy explained).
2. **OD-35 VERIFIED-FAILED**: Genesis Safe is 1/1 deployer-controlled, not the mandated 4/7 — "reported 4/7 disproven"; Gate 5 blocked. UI consistent (MandateCompliance displays the finding verbatim).
3. **OD-37 / EIP-170 FLAG**: V3 runtime 40,500 B > 24,576 limit — pre-deploy flag, committee must split modules. UI consistent (landing Resources dialog "D-4 … over EIP-170").
4. **OD-33**: verifyIndexBase() implemented + compiled (solcjs 0 errors) but NOT redeployed on-chain — "the live contracts predate this function". Consistent (docs/DEPLOYMENT-RECORD).
5. **OD-34**: Oracle.sol code VERIFIED-PRESENT (Monad 5,273 B / Arc 2,601 B) but ABI unpublished → real-vs-mock feed contents UNDETERMINED; adapters compiled-not-deployed; mock strategy accepted for Gate 2 shadow. UI consistent (NetworksSection/MandateCompliance quote the determination verbatim).
6. **OD-1 / OD-5 / OD-31**: κ uniform placeholder, zero reserve-risk term (never invented), λ placeholder — registered OPEN; economic eligibility DISABLED. UI consistent (MaseEngine, EvidencePackage "implemented ≠ verified ≠ approved ≠ authorized").
7. **OD-3**: committees NOT constituted. UI: EventExplorer honest ("SPECIFIED — NOT OPERATIONAL"); PCC GovernanceSection cards lack the qualifier (16f-011).
8. **C-047**: the 1,100,000 USDC genesis deposit NEVER left the deployer EOA — every "reserve funding" narrative DISPROVED for the live deployments. UI contradiction: EventExplorer genesis row (16f-009).
9. **C-043 + custody**: USDC 100% in deployer EOA — consistently disclosed (landing VIDEO_DIALOG, SecuritySection, task9-audit row "Reserve funding: absent at current addresses").
10. **OD-29 / D-13.x**: supply-cap OPEN; D-13.6/D-13.8/D-13.19/D-13.27 issuance decisions open/pending-ratification. UI consistent (IssuanceSection's ILLUSTRATIVE/UNAPPROVED/PENDING-RATIFICATION pills).
11. **G1**: no external audit (internal only). UI contradiction: PitchSection "audited" (16f-001).
12. **Engine retains v1/v2 reserve economics (NAV/RR/LCR/buffer/MARP)** — retiring it is Gate-B-conditional (D-13.3–D-13.7 open; deleting reserve mechanisms without chosen replacements leaves issuance/redemption UNDEFINED). **DOCUMENTED-AND-INTENTIONAL — NOT a defect.** Recorded per mandate.
13. Blueprint-version discipline: blueprint.ts header "v1.2 SUPERSEDED — v1.0 constants verbatim" with the M8-3a registry-seed note; blueprint.ts:549 carries the v1.2→v1.0 reserve-gold lineage row. Consistent.

### C.2 UI claims contradicting the register (the Part C answer)
- 16f-001 PitchSection "audited reserve portfolio" vs G1/OD-36 (no third-party audit).
- 16f-009 EventExplorer "Reserve funded … ok · canonical" vs C-047 (funding disproved).
- 16f-006 Bank Registry "1/1 AUTHORIZED" vs OD-3/G9 (no constituted authority; address is a published dev key).
- 16f-012 PoR "RR prod target 1.30" vs the engine/blueprint 110% target shown elsewhere — two target regimes presented without cross-reference (v25.3 candidate spec unlabeled in UI).

---

## D. Defect register (16f-NNN)

| ID | Sev | Location | Finding | Minimal fix |
|---|-----|----------|---------|-------------|
| 16f-001 | **P2** | sections/PitchSection.tsx:41 (also 38,52,60,63) | Marketing-grade claim "An audited reserve portfolio … collateralizes every MTQΣ at a 110% RR target" — (a) unlabeled legacy doctrine vs the v3.0 no-reserve objective, (b) "audited" contradicts G1 (no external audit exists) | Reword panel 02/04 to the v3 posture with the Gate-B note + replace "audited" with the honest internal-audit status; keep "v1.2 · FINAL" pill only with a legacy tag |
| 16f-002 | **P3 (high-leverage)** | components/mtq/format.ts:43 + copies in Header.tsx:156,159 · LiveMonetaryState.tsx:174,198 · ConstitutionalSeparation.tsx:282 · RebalanceEngine.tsx:571 · DashboardSection.tsx:250 | Shared `fmtRatio` special-case renders **"∞ — fully reserved"** into every RR/LCR surface when liability=0 (incl. the Task-15-fixed Home stat cards' value strings, Sidebar aria, ClosedLoopMap edge, TrialLog, MintSimulator "New RR") — reserve-forward success phrase, inconsistent with Task 15's "no liability · ∞" standard | One-line change format.ts:43 → `"∞"` (or `"∞ · no liability"`), update the 6 literal copies |
| 16f-003 | **P2−** | sections/DashboardSection.tsx:242-250, 295-299 | Portfolio twin of the reframed Home intro still teaches the v1/v2 doctrine unlabeled: "The reserve portfolio exists to collateralize that obligation." and "The Reserve NAV backs that liability at the Reserve Ratio." (+ "∞ — fully reserved") | Replicate Task 15's "Legacy §1.1 exhibit (kept labeled)" framing on both paragraphs |
| 16f-004 | **P2−** | lib/mtq/brand.ts:135 (consumed by Footer.tsx:88 app-wide, HonestStatus.tsx:146, PitchSection.tsx:173) | Shared BRAND_VOICE.coreObjective still carries "the reserve portfolio exists to collateralize that obligation" — rendered in the app-wide footer on every section | Single-string fix: v3 posture or append "(legacy v1/v2 exhibit — v3.0 removes the conventional reserve, D-13.3–D-13.7 open)" |
| 16f-005 | **P3** | PilotCommandCenter.tsx:339-443 (ReserveSection; nav "Reserve Vault" Sidebar:88 / MobileBottomNav:11; also RebalancingSection:643-654 buffer-metric sub) | The dedicated Reserve Vault section (title, RR target, 7-asset breakdown, "Reserve gold (MARP)") carries NO legacy/v3 qualifier anywhere in-view | Add the InstitutionalHero-style amber strip: "legacy v1/v2 pilot-ledger accounting · the v3.0 objective removes the conventional reserve (Gate B, D-13.3–D-13.7 open)"; label RebalancingSection's observed-gold-wt sub "legacy buffer path" |
| 16f-006 | **P2−/P3** | lib/mtq/bank-registry.ts:48-70 + /api/banks note + InstitutionalDashboard.tsx:622-663 | "Pilot Bank A — 1/1 AUTHORIZED" emerald + "authorized: <boot-date>" rendered from a hardcoded registry (Hardhat default account #1, `isAuthorized:true`, `authorizedAt:Date.now()`); the placeholder disclosure exists only in code comments; no constituted council could have authorized anything (OD-3) | Add the placeholder disclosure to the /api/banks note + render a "TEST PILOT ROW — placeholder address (dev key #1); no on-chain authorization exists" tag; drop or qualify authorizedAt |
| 16f-007 | **P3** | components/mtq/GfbChart.tsx:20-35 rendered at HomeSection.tsx:186 | Synthetic 24h trajectory chart with no illustrative label (sibling ReferenceChart was fixed in Task 14) | Add inline "Illustrative — synthetic trajectory (endpoint is live)" caption |
| 16f-008 | **P3** | sections/MintSection.tsx:76-131,202-209,269 · sections/RedeemSection.tsx:95-130,278,440-484 | §12 mechanics walkthroughs teach the v1/v2 reserve flow ("full reserve basket", "reserve collateral", "reserve most needs protection") under the TruthBanner but with no legacy/v3 note | One banner sentence: "The steps below document the legacy v1/v2 engine path as implemented; the v3.0 objective replaces the reserve (D-13.3–D-13.7 open)." |
| 16f-009 | **P3** | components/mtq/EventExplorer.tsx:153-163 | Synthetic genesis row re-asserts the C-047-DISPROVED narrative "1,100,000 USDC funded to reserve / Reserve funded / Status: ok · canonical" | Reword to the C-047 finding (e.g., "1.1M USDC mandate — custody finding: funds remained in the deployer EOA (C-047)") |
| 16f-010 | **P4** | InstitutionalDashboard.tsx:504 | SectionK eyebrow "§47.1 · Chainlink PoR feed" while the Chainlink feed is NOT wired (pilot fallback; body is honest) | Eyebrow → "PoR — pilot fallback (Chainlink feed not wired)" |
| 16f-011 | **P4** | PilotCommandCenter.tsx:744-749 (COUNCILS) | 4-council cards lack the "SPECIFIED — NOT OPERATIONAL (OD-3)" qualifier EventExplorer's governance rows carry | One caption line under the grid |
| 16f-012 | **P4** | app/api/por/route.ts:70-76 + InstitutionalDashboard SectionK targets | "RR prod target 1.30 / 80-18-2" from the v25.3 candidate spec (CANDIDATE_MODEL_VALIDATION_PENDING) shown without the candidate label and inconsistent with the 110% target in every other RR surface; composition bars trivially match the fallback's own constants | Label the targets row "candidate spec v25.3 (§§16-46) — validation pending §28.7" |
| 16f-013 | **P4** | landing-status.ts:184 (ECOSYSTEM.checklist) + :82 (HERO.paragraph) | "Governance & voting portal" checklist item (no voting portal exists) + "advanced AI models" without the pilot qualifier (16c residuals) | One-string fixes |
| 16f-014 | **P4** | sections/DashboardSection.tsx:175 (catch-ignore) + TrialLog.tsx:75-77 (+ InvestorSection.tsx:121) | Failed /api/trials fetch renders the empty-state "No trials yet" — fetch-failure presented as an empty ledger | Track a fetch-error flag → render an error row in TrialLog |

Cross-referenced STILL-OPEN defects from sibling audits (confirmed present, not re-filed): 16c-005 (WeightChangeDrawer unlabeled synthetic PP signal), 16c-006 (fabricated "audit" Decision ID), 16c EventExplorer "live" pill on failure, 16c-004 (GovernanceSection loading-pill on error), 16b-001 (Inngest false dev-mode comment + 500s), 16b-007 (unwired AML/sanctions module vs "BM-04 AML" label — pairs with the sanctions TODOs), 16b-003 (orphaned divergent mtq-feed), 16a-001/002/003 (P1 API items), 16d-001/002 (hash-chain + multi-writer).

---

## E. Mandate answers

1. **How many unlabeled synthetic data points exist?** Strictly-unlabeled-at-render: **4** — GfbChart synthetic trajectory (16f-007), WeightChangeDrawer Purchasing-Power Signal (16c-005), Bank Registry "AUTHORIZED" state (16f-006), EventExplorer genesis funding narrative with "ok · canonical" (16f-009). Plus **1 systemic synthetic-success phrase** ("∞ — fully reserved", 7 literal sites + the shared fmtRatio formatter, 16f-002) and 2 partially-labeled residuals (PoR candidate-spec targets 16f-012; PoR eyebrow 16f-010). Everything else synthetic on the platform is labeled (issuance fixtures, EventExplorer rows, landing DASHBOARD_MOCK, ReferenceChart, MockUSDC, v25.x module reports) — the labeling discipline elsewhere is genuinely strong.
2. **Does any surface overclaim readiness?** YES — three: PitchSection's "audited reserve portfolio collateralizes every MTQΣ" (worst: marketing-grade + false "audited"), Bank Registry "1/1 AUTHORIZED" (fabricated authorization state), landing "Governance & voting portal". The readiness spine itself (0/11 gates, 0/7 release gates, NOT PRODUCTION-AUTHORIZED, TESTNET/SHADOW banners) is consistent and honest everywhere.
3. **Is the v3 framing consistent platform-wide?** NO — not yet. Home + landing + Portfolio-gold + hero are consistent post-Task 15. Remaining legacy-forward-without-qualifier: the shared coreObjective string (app-wide Footer/HonestStatus/Pitch), the Portfolio §1.1 twin (DashboardSection), the dedicated ReserveSection, Mint/Redeem §12 mechanics, the Pitch deck panels, the "∞ — fully reserved" formatter class, and the gold-weight sub-caption in RebalancingSection. All are one-string/one-strip fixes; the fix queue is small and mechanical.

**Task 15 verdict: HELD** on all eight completed surfaces (labels verified in source; the only erosion is the fmtRatio value-string interaction recorded as 16f-002).

READ-ONLY compliance: no source files modified; only light curls to localhost APIs; evidence written to this file; worklog appended once.
