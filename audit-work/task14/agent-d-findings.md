# Task 14-d — Explore Audit: PUBLIC LANDING PAGE + TERMINAL SHELL (READ-ONLY)

Date: 2026-10-24 · Agent: 14-d (Explore, read-only — zero source files modified)
Scope: `src/app/page.tsx`, `src/components/landing/*`, `src/lib/mtq/landing-status.ts`, `src/components/mtq/{Header,TestnetStatusBar,Sidebar,Footer,MobileBottomNav,CommandLauncher,CinematicLoader,ChunkRecoveryBoundary,HeroBand}.tsx`, `Navigation.tsx` (registry cross-check), PCC shell wiring.
Live APIs curl-verified this session: `/api/status`, `/api/metrics`, `/api/honest-status`, `/api/oracle`, `/api/contracts`, `/api/registry`, `/api/evidence`, `/api/implementation-status`, `/api/tests`, `/api/mandate`. Landing HTML fetched and claim-string-verified. Git HEAD = 6cf291c (= evidence register runtimeHead — "re-run at HEAD" claims are anchored).

Live anchors used for verdicts:
- `/api/honest-status`: `gateSummary {passed:0,total:11}` · `validationGates` G1–G11 all `passed:false` · `authorizedMask 0` · status NOT PRODUCTION-AUTHORIZED.
- `/api/evidence`: 13 `rerunResults` (incl. "Safe configuration probe → CRITICAL reproduced", "Safe balances probe → C-043 reproduced", "Custody inventory → new evidence", "USDC custody → new evidence (100% in deployer EOA, C-047)"); `gates` = 7 (NOT CLOSED / SHADOW-permitted / NOT STARTED ×2 / BLOCKED-CRITICAL / NOT AUTHORIZED ×2) → 0 closed; Gate-1 blockers "OD-1/2/3/5 OPEN; 49 conflicts registered (C-001..C-049)"; `claimCounts {total:25, critical:5, high:8, resolvedThisRound:3}`; meta baseline b68ccb8, D-1 "b24e7e0↔b68ccb8", docsDir audit-work/v6, status NOT ACCEPTED.
- `/api/contracts`: Monad 10143 = 9 contracts (+wallet, several "code verified this session"); Arc 5042002 = 9; **Robinhood 46630 = 10 contracts** (MTQ token live-read "name()='MTQΣ' • symbol='MTQ' • decimals=18 • ADMIN+MINTER+PAUSER on deployer • not paused • genesis 1,000,000 MTQ"; Mint "Holds MINTER_ROLE • funded 1,100,000 USDC"; other 8 entries carry NO verification notes); Solana devnet = 1 SPL mint `GAGRdrY6jcRTmD7A9KzvXA5sGMpNAkkRXwDoXBrEjxS4` "Decimals: 18"; Base 8453 + Arbitrum 42161 = pending-deploy placeholders (0x000…, "Deploy V3 … pending").
- `/api/status`: 4 chains with canonical deployed contracts (monad, arc, robinhood, solana) + base/arbitrum listed without canonical; version "Σ-v1.2"; status "TESTNET PILOT".
- Disk: 47 API route files, 40 exporting GET (incl. bare `/api`), 9 exporting POST.

---

## (A) NUMBER/CLAIM-BY-CLAIM VERDICTS

Legend for "source": (a) live API field · (b) derived at render · (c) labeled spec constant · (d) hardcoded presented as fact.

### Landing — StatsRow (`StatsRow.tsx` renders `PROTOCOL_STATS`, `landing-status.ts:159-169`)

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| landing-status.ts:162 / StatsRow.tsx:20 | "19 Contracts Verified On-Chain" | (d) hardcoded | TRUE TODAY · STATIC + PERIMETER INCONSISTENT | /api/contracts: Monad 9 + Arc 9 + Solana 1 = 19 (footnote defines exactly this). But Robinhood MTQ token was ALSO live-read this session (name/symbol/decimals/roles/supply) → verified-account count is arguably ≥20; Robinhood's other 9 contracts are listed without verification notes. Won't track registry changes. |
| landing-status.ts:163 | "4 Testnets Deployed" | (d) hardcoded | TRUE TODAY · STATIC | /api/status: monad+arc+robinhood+solana have canonical deployed contracts; base/arbitrum pending. Footnote "4 = Monad, Arc, Robinhood testnets + Solana devnet" matches. Inconsistent perimeter vs stat #1 (Robinhood counts here, its contracts don't count there). |
| landing-status.ts:164 | "253/253 Canonical Invariant Tests Passing" | (c) labeled baseline constant (footnote dates it 2026-10-23) | ACCEPTABLE LABELING · UNRECONCILED COUNTS | Worklog (E2E-LAUNCH, M8-3c-4): Layers 1-6+8 246/246 + Layer-7 7/7 = 253 at the 2026-10-23 baseline. No live API returns 253. Adjacent surfaces show different counts: /api/evidence rerun "Canonical invariants 250/250" (v6 register, 2026-10-19) and /api/honest-status G1 "159 canonical tests + Foundry suite green". All are different suites, but a public visitor cannot reconcile 253 vs 250 vs 159. |
| landing-status.ts:165 | "0/7 Release Gates Closed — Production Not Authorized" | (d) hardcoded | TRUE vs /api/evidence · CONFUSING next to terminal's 0/11 | /api/evidence `gates`: 7 gates, 0 closed (Gate 2 is "SHADOW (permitted)", not closed). TRUE. But the terminal TestnetStatusBar shows "Validation Gates: 0/11" (/api/honest-status §25.5). Two different gate registers (evidence release gates vs §25.5 validation gates) shown on the same product with no cross-reference. Static hardcode in 3 landing places. |
| landing-status.ts:160 | tag "LIVE TESTNET VALUES · READ-ONLY VERIFIED" | (d) | MISLEADING LABEL | None of the four numbers is fetched live; two (253/253, 0/7) are not "testnet values" at all (code/evidence-register facts). "READ-ONLY VERIFIED" is accurate as of the stated session; "LIVE … VALUES" overstates. Recommend "PILOT FIGURES · READ-ONLY VERIFIED (2026-10-23)". |
| landing-status.ts:168 | footnote (19=…, 4=…, 253/253=…, "TVL / user-count / uptime figures are not reproduced") | (c) labeled | CORRECT & EXEMPLARY | Explicitly declines the reference design's fake marketing stats; matches live registry math; dates the test baseline. |

### Landing — LandingNav (`LandingNav.tsx`)

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| LandingNav.tsx:96-101 | TESTNETS: "Monad Testnet cid 10143 · 9 contracts + wallet, code verified" / "Arc Testnet cid 5042002 · 9 contracts, native USDC (18 dec)" / "Solana Devnet · SPL mint GAGRdrY6…, decimals 18" — comment: "The three live testnets" | (d) hardcoded | EACH FACT ✓ · THE "THREE" IS STALE | Each row matches /api/contracts verbatim (counts, chainIds, decimals, address prefix). But the registry has FOUR testnets with deployed canonical contracts — Robinhood Chain Testnet (46630, 10 contracts incl. live-read MTQ token) is omitted. |
| LandingNav.tsx:337 | hint "Full registry: 3 testnets + mainnet targets" | (d) | STALE/WRONG | Live registry: 4 testnets + 2 mainnet targets (Base, Arbitrum — pending deploy). |
| LandingNav.tsx:57 | hint "41 read-only endpoints + verification" | (d) | STALE COUNT | Disk today: 40 GET route files (E2E audit recorded 43 GET at its time). Off-by-small; derive or update. |
| LandingNav.tsx:55-79 | 10 launch menu items (contracts/networks/developers/governance/transparency/security/docs/architecture/validation/evidence) | (b) launchTo(section) | ALL WIRED ✓ | All 10 are valid SectionIds in Navigation.tsx; PCC validates+restores `mtqs.section` (PCC:903-914); every target has a real render case (PCC:1036-1199). |
| LandingNav.tsx:264, 343 | "Launch items open the Pilot Command Center · TESTNET ONLY · SHADOW MODE" / "No production network is selected · reserve trading not authorized" | (c) | CORRECT ✓ | Matches posture. |
| LandingNav.tsx:98-100 + chain pill | "Monad Testnet" shown as selected chain | (d) | MINOR | Pill implies a "selected" chain; popover footer honestly says no production network selected. Acceptable. |

### Landing — StatusDialogs content (`landing-status.ts:254-312`)

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| landing-status.ts:262 (VIDEO_DIALOG body) | "13 verification suites re-run green at HEAD" | (d) | **FINDING — OVERSTATED** | /api/evidence `rerunResults` has exactly 13 suites, but 4 of the 13 are NOT green: "Safe configuration probe → CRITICAL reproduced", "Safe balances probe → C-043 reproduced", "Custody inventory → new evidence", "USDC custody → new evidence (100% in deployer EOA, C-047)". The suites re-ran and CONFIRMED recorded critical findings — honest phrasing must not read as all-pass. |
| landing-status.ts:262 | "49 registered conflicts preserved" | (d) | TRUE ✓ | /api/evidence Gate-1 blockers: "49 conflicts registered (C-001..C-049)". |
| landing-status.ts:262 | "0 of 7 release gates closed" | (d) | TRUE ✓ (see A-row 4 caveat) | /api/evidence gates: 0 of 7 closed. |
| landing-status.ts:288 (governance headline) | "No approvals exist — 0 of 7 release gates closed" | (d) | TRUE ✓ | Same register; "committee approvals: none" consistent with G9 "no live councils with signers". |
| landing-status.ts:292 | "Genesis Safe configuration: 1/1 deployer-controlled (expected 4/7)" | (d) | TRUE ✓ | /api/contracts Monad+Arc Safe note (OD-35): "threshold=1, sole owner = deployer EOA … NOT the mandated 4/7. CRITICAL finding, Gate 5 blocked." |
| landing-status.ts:291 | "Open decisions blocking Gate 1: OD-1 · OD-2 · OD-3 · OD-5" | (d) | TRUE ✓ | Gate-1 blockers "OD-1/2/3/5 OPEN". |
| landing-status.ts:293-294 | "Gate 6 — production: NOT AUTHORIZED" / "Governance layers (code): implemented — no live signers" | (d) | TRUE ✓ | gates[5] "NOT AUTHORIZED"; honest-status G9. |
| landing-status.ts:274-281 (developers rows) | 9/9 Monad, 9/9 Arc, Solana SPL decimals 18, MITHQAL/MTQ, 28/28 on-chain tests, 4/4 EIP-712 (digest-level), Foundry not runnable, production NOT AUTHORIZED | (d) | ALL TRUE ✓ | Every row matches /api/contracts notes + /api/evidence rerunResults ("On-chain tests 28/28 PASS", "EIP-712 digests 4/4 MATCH, digest-level ONLY", stop-conditions "Foundry environment (no forge)"). Dialog is silent on Robinhood — same 3-testnet blind spot. |
| landing-status.ts:303-308 (resources rows) | D-1 committed, D-2 committed, D-3 DRAFT, D-4 "V3 runtime 40,500 B — over EIP-170", D-5 "R-01…R-16 planned", D-6 "25 registered" | (d) | ALL TRUE ✓ | /api/evidence deliverables + claimCounts.total=25 + D-4 "40,500-byte runtime REPRODUCED exactly" + D-5 "R-01..R-16". |
| landing-status.ts:310 | footnote "Baseline b24e7e0 · verification b68ccb8 — re-run 2026-10-19" | (d) | TRUE ✓ · STALE-BY-DESIGN | Matches /api/evidence meta (baselineCommit b68ccb8; D-1 "b24e7e0↔b68ccb8"; freshAnchors 2026-10-19). It is a frozen v6-register snapshot — honestly dated, but 5 days older than the current 2026-10-23 baseline cited in the stats row. |

### Landing — Hero / ProtocolCards / Ecosystem (aspirational reference copy)

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| landing-status.ts:77 | badge "The Next Generation Monetary Protocol" | (c) aspirational copy | MILD — acceptable with footer disclaimer | No factual assertion. |
| landing-status.ts:87-88 | paragraph "…powered by real-world assets, advanced AI models, and transparent governance" | (c) aspirational copy | **FINDING — implies live RWA backing** | G8: "pilot reserve is simulated (1.1M genesis deposit modeled); no on-chain proof of real reserve assets". Reserve is simulated; "powered by real-world assets" present-tense on a public page needs a qualifier. |
| landing-status.ts:98-99 | HERO_PANELS "Real-World Asset Backing — Tangible. Audited. Secure." | (c) aspirational copy | **FINDING — strongest honesty risk on the page** | "Audited" contradicts G1 ("external audit NOT CONDUCTED — internal only") and "Tangible" contradicts G8 (simulated reserve). Rendered around the globe on desktop (HoloGlobe) and as a visible card list on mobile (Hero.tsx:333-339). |
| landing-status.ts:124-148 | PROTOCOL_CARDS "Stable Value — Backed by real-world assets and algorithmic stability" / "Low Fees" / "Cross-Chain — Seamless movement across multiple blockchains" / "Community Driven — Governed by you…" | (c) aspirational copy | MIXED | "Low Fees" carries no number (good). "Seamless movement across multiple blockchains" implies a live bridge — X-1 forbids all moves; nothing moves. "Governed by you" — no live governance (G9). Reference-design copy; needs the standing disclaimer to carry it (footer does). |
| landing-status.ts:182-187 | ECOSYSTEM checklist "Real-time analytics & insights" / "Multi-chain wallet support" / "Governance & voting portal" / "Developer tools & APIs" | (c) aspirational copy | **"Multi-chain wallet support" MISLEADING** | Wallet connection is explicitly UNAVAILABLE (WalletDialog: "No wallet SDK is loaded, no signer is exposed, no wallet can be connected"). Governance voting: no live signers. Analytics + APIs: true (40 live GET endpoints). |
| landing-status.ts:195-233 | DASHBOARD_MOCK ($48,732.21, +12.5% (24h), assets, "Arbitrum/Ethereum Healthy" networks, "Voted: Proposal #12") | (c) labeled mock | CORRECTLY LABELED ✓ · minor coherence nit | Entire window carries `SIMULATED PREVIEW` tag + role="img" aria-label "Simulated product interface preview — illustrative only" + SIMULATION_NOTE caption (EcosystemSection.tsx:112-113, 318-321). Nit: mock "Network Status" shows Arbitrum + Ethereum mainnet as Healthy — chains with zero deployments (real pending targets are Base+Arbitrum); suggest swapping to the real 4 testnets for coherence. |
| landing-status.ts:242-249 | TAGLINE + FOOTER disclaimer + "© 2026 MTQΣ Labs" | (c) | CORRECT ✓ | Disclaimer explicitly: "Nothing on this page constitutes an offer, a live product, or an authorization to transact." Copyright year hardcoded (minor; terminal footer uses dynamic year). |

### Landing — link/button sweep (all wired, none dead)

- Nav anchors Home/Product/Ecosystem → `#home`/`#product`/`#ecosystem` — all three section ids exist (Hero.tsx:272 `id="home"`, ProtocolCards.tsx:16 `id="product"`, EcosystemSection.tsx:270 `id="ecosystem"`). ✓
- "Launch App" (nav :274-284, hero :303-307, footer :95-105) and "Launch Pilot Command Center" (ecosystem :301-311, mobile drawer :409-421) → `onLaunch`/`launchTo` → view switch + sessionStorage. ✓ (fallback hrefs "#ecosystem"/"#home" only render when the handler prop is absent — page.tsx always passes it.)
- "Watch Video" → VideoDialogButton → VideoDialog (honest "no video published" content). ✓
- "Connect Wallet" (desktop :349-358 + mobile :433-443) → WalletDialog (honest "unavailable"). ✓
- Chain pill → popover with 3 testnets + "Open Networks in the terminal" → launchTo("networks"). ✓ (content findings above)
- All three menus' "Status register" items → InfoDialogs. ✓
- Footer: 3 anchor links + 10 launch links (contracts/networks/developers/governance/transparency/security/docs/architecture/validation/evidence — all valid SectionIds) + Launch App. ✓
- Skip-link `#home` (page.tsx:167-172). ✓
- **Zero dead href="#" without handlers; zero links to nonexistent routes; zero dialogs that never open.**

### Terminal shell

| file:line | displayed value | source | verdict | evidence |
|---|---|---|---|---|
| TestnetStatusBar.tsx:32-60, 86 | "Validation Gates: 0/11" | (a) LIVE FETCH | **CORRECT — FIX VERIFIED** | Code fetches `/api/honest-status` on mount + visibilitychange; reads `gateSummary` (present: `{passed:0,total:11}`) with `validationGates` fallback (present: 11, 0 passed); degrades to "—". Live-wired, never fabricated. |
| TestnetStatusBar.tsx:69-95 | "MTQΣ TESTNET · Candidate for public testing · Not production-authorized · Oracles LIVE/… · Assets TESTNET · Production NO · Risk NORMAL" | (a)/(c) | CORRECT ✓ | Oracle/risk states derive from snapshot; static labels match posture. "Candidate for public testing" matches BRAND_VOICE.statusDeclaration. |
| Header.tsx:41-128 | status pill (snapshot.status), Σ-v1.2 pill, brand tagline, Landing exit | (a)+(d) | CORRECT ✓ · DEAD PROPS | Status pill + colors live from /api/metrics snapshot; "Σ-v1.2" matches /api/status.version (hardcoded but true). **oracleValidCount/oracleTotalCount/oracleAnyPaused props are accepted, defaulted (Header.tsx:23-27,36-38) and NEVER rendered** — PCC computes and passes them for nothing (PCC.tsx:971-975). |
| Header.tsx:147-231 (LiveTicker) | GFB / MTQ / NAV / RR / LCR / STATUS / BUFFER / ORACLE | (a) live fields | ALL LIVE-WIRED ✓ | Every value traces to MetricsSnapshot from `/api/metrics` (4s poll, PCC.tsx:76,919-950): gfbIndex, mtqPrice, priceInBand, nav, reserveRatio, lcr, status, bufferState, oracle pairs/failed/degraded. Skeleton state while null; honest "∞ — fully reserved" fallback. |
| Sidebar.tsx:84-122, 124-128 | 26 items in 3 groups | (b) static registry | MATCHES REGISTRY ✓ | 8+6+12 = 26 = Navigation.tsx ALL_SECTIONS (10 PRIMARY + 4 USER_OPS + 10 SUPPORTING + 2 RESTRICTED). Every id valid. Status pill RR/NAV live from snapshot. Comments stale: ":9 and :318 say '24 entries' (26 now); :83 '(7)' (8 items); :105 '(9)' (12 items)." |
| Sidebar.tsx:390-400 | "Not Production-Authorized" badge | (c) | CORRECT ✓ | Matches /api/honest-status status string. |
| Footer.tsx:98-119 | "Testnet explorers" + 6 explorer links + deployer wallet | (d) ALL_CHAINS | **FINDING — MISLABEL** | ALL_CHAINS includes Base (mainnet 8453) and Arbitrum One (mainnet 42161) — both PENDING-DEPLOY (0x000…, nothing deployed). Two MAINNET explorers rendered under a "Testnet explorers" heading. Deployer wallet matches /api/contracts. |
| Footer.tsx:143-146 | "Every metric on this site is computed live by the reference engine and reconciled against the blueprint." | (c) | ACCEPTABLE (broad) | True for terminal metrics (single /api/metrics pipeline); landing stats are not engine metrics. Low risk. |
| Footer.tsx:159-161 | "Built on Next.js 16 · Real-time engine in-process · 4s poll" | (c) | TRUE ✓ | POLL_MS=4000 (PCC.tsx:76). |
| Footer.tsx:155-157 | "© {year} MTQΣ Protocol · Global Digital Asset" | (c) | MINOR | "Global Digital Asset" is brand-voice marketing (BRAND_VOICE.tagline), not an operational claim. |
| Footer.tsx:165-167 | sr-only `Object.keys(STATUS_COLORS).length` span | — | DEAD CODE | Exists only to keep an otherwise-unused import alive. |
| MobileBottomNav.tsx:9-15 | Overview / Reserve / Risk / Mint / Redeem | (b) | ALL VALID ✓ | 5 valid SectionIds; onNavigate wired to PCC handleNavigate. "Mint"/"Redeem" labels lack the "Simulator" qualifier the sections carry (minor). |
| CommandLauncher.tsx:40-67 | 26 commands | (b) | ALL RESOLVE ✓ | 26 commands, every action targets a valid SectionId; categories Navigation(10)/Operations(4)/Supporting(10)/Restricted(2). Matches the 26-section registry. Keyboard wiring (Cmd/Ctrl+K, Esc, arrows, enter) intact. Same "Mint MTQΣ"/"Redeem MTQΣ" naming nit. |
| CinematicLoader.tsx:99-101 | "The Global Digital Asset" splash (1.8s, first app-view load only) | (c) | MINOR | Brand tagline; no factual assertion; sessionStorage-gated so it shows once. |
| ChunkRecoveryBoundary.tsx | recovery UI + posture footer | — | CORRECT ✓ | Honest copy, guarded reload, no claims. |
| HeroBand.tsx (whole file) | "MTQΣ — The Global Digital Asset", "target ≥ 110%", "in safety band 0.50–2.00" | (d) | **DEAD FILE — rendered nowhere** | No importer anywhere in src/. Its claims are never seen. Removal candidate. |
| page.tsx:9 | comment "22 sections" | — | STALE COMMENT | 26 sections now. |

---

## (B) WIRING BUGS

1. **Header.tsx:23-27,36-38 — dead oracle props.** `oracleValidCount` / `oracleTotalCount` / `oracleAnyPaused` are accepted, defaulted, and never referenced in the render; PCC.tsx:971-975 computes and passes all three for nothing. (LiveTicker derives oracle state from the snapshot itself.) Cosmetic dead wiring, not a user-facing bug.
2. **LandingNav.tsx:96-101 — chain registry snapshot omits Robinhood.** The popover presents itself as the pilot environment list ("Live pilot testnets · read-only verified") but shows 3 of the 4 deployed testnets. Not a crash — a stale data surface on the PUBLIC page.
3. **LandingNav.tsx:337 — "Full registry: 3 testnets + mainnet targets"** — live registry is 4 testnets + 2 mainnet targets (Base/Arbitrum pending).
4. **Footer.tsx:98-113 (terminal) — "Testnet explorers" heading covers 2 mainnet chains** (Base, Arbitrum One) where nothing is deployed. Mislabel, mild mislead.
5. **LandingNav.tsx:57 — "41 read-only endpoints"** vs 40 GET route files on disk (43 at E2E-audit time). Stale count, no live derivation.
6. No dead links, no non-opening dialogs, no href="#" without handlers, no links to nonexistent routes found anywhere on the landing page or shell. All 26 sidebar sections, 26 Cmd+K commands, 5 mobile-bottom items, and 10+10 landing launch targets resolve to real render cases in PCC.

## (C) REDUNDANCY / GROUPING

1. **OPERATIONAL_STATUS trio rendered in 6+ places** (footer ribbon always visible; mobile drawer list; StatusList inside WalletDialog, VideoDialog, and all 3 InfoDialogs). Mandatory-by-design (each modal is self-contained), but the dialogs each re-list what the persistent footer ribbon already shows. Consider keeping the trio in the footer ribbon + mobile drawer + wallet dialog, and a one-line pointer in the info dialogs.
2. **"0/7 gates" hardcoded in 3 landing surfaces** (stats row landing-status.ts:165; video dialog :262; governance dialog headline :288) while the terminal shows live "0/11" — three static copies + one live register = drift risk. Group to a single constant or derive from `/api/evidence`.
3. **TONE_DOT map duplicated** — LandingNav.tsx:84-88 and LandingFooter.tsx:12-16 are byte-identical; hoist to landing-status.ts.
4. **Gate-count registers not cross-referenced**: landing "0/7 Release Gates" (evidence D-5 register) vs terminal "0/11 Validation Gates" (§25.5) vs implementation-status "13 institutional validation gates" (§94). All three exist in live APIs; the public landing shows only the 7-count with no hint the 11-count (terminal) exists.
5. **Thematic triple on "cross-chain/multi-chain"**: HERO_PANELS "Cross-Chain Interoperability", PROTOCOL_CARDS "Cross-Chain", ECOSYSTEM checklist "Multi-chain wallet support" — three restatements of one unimplemented capability.
6. Mountains component reused hero+footer (intentional); 4 launch entry points (intentional per page.tsx comment). Not flagged.

## (D) REMOVAL CANDIDATES

1. **`src/components/mtq/HeroBand.tsx`** — 91 lines, zero importers, superseded by the landing Hero; carries "The Global Digital Asset" + RR/band claims that no one sees. Delete (also drops the `/mtqs-hero.png` dependency).
2. **`landing-status.ts:315-320 LAST_VERIFIED`** — exported, never imported (its data lives verbatim in the resources-dialog footnote).
3. **`landing-status.ts:36-40 PROTOCOL`** — exported, never imported.
4. **`landing-status.ts:257,263 WALLET_DIALOG.statuses / VIDEO_DIALOG.statuses`** — fields never read (StatusDialogs renders OPERATIONAL_STATUS directly).
5. **`StatusDialogs.tsx:163-183 InfoDialogLink`** — exported trigger helper with zero importers (nav/footer moved to controlled dialogs).
6. **`EcosystemSection.tsx:7,328`** — `TrendingUp` imported solely to be re-exported; no consumer of the re-export.
7. **`StatusDialogs.tsx:12,206`** — `ArrowUpRight` imported solely to be re-exported; unused in the file body.
8. **`Footer.tsx:16,165-167` (terminal)** — `STATUS_COLORS` import + sr-only `Object.keys(STATUS_COLORS).length` span that exists only to justify the import.
9. **Header oracle props + PCC oracle computation** (see B-1) — remove props or render them.
10. **Stale comments**: page.tsx:9 "22 sections"; Sidebar.tsx:9 & :318 "24 entries", :83 "(7)", :105 "(9)"; landing-status.ts:42-45 "always visible (footer ribbon, mobile drawer, wallet/video dialogs)" omits the 3 info dialogs. Comment-only.

## (E) COPY / CLAIM CORRECTIONS (public-facing priority order)

1. **landing-status.ts:262 — "13 verification suites re-run green at HEAD"** → 4 of the 13 reproduce CRITICAL/custody findings (Safe 1/1 CRITICAL reproduced; C-043 reproduced; USDC 100% in deployer EOA). Required fix, e.g. "13 verification suites re-run with committed results — including reproduced CRITICAL Safe/custody findings".
2. **landing-status.ts:98-99 — "Real-World Asset Backing / Tangible. Audited. Secure."** → no external audit exists (G1) and the reserve is simulated (G8). Soften to design-target phrasing ("Designed for asset backing · auditability · security").
3. **landing-status.ts:87-88 — "powered by real-world assets"** → same; qualify as design objective or add "(design target — pilot reserves are simulated)".
4. **landing-status.ts:182-187 — "Multi-chain wallet support"** → wallet connection is explicitly unavailable on this page; mark as planned/roadmap or remove.
5. **landing-status.ts:160 — tag "LIVE TESTNET VALUES"** → values are verified-at-baseline constants, not live reads; reword ("PILOT FIGURES · READ-ONLY VERIFIED 2026-10-23").
6. **LandingNav.tsx:97-101 + :337** → include Robinhood Chain Testnet (46630) in the popover or state the registry truth (4 testnets + 2 pending mainnet targets).
7. **Gate labeling** → distinguish the two registers on the landing stats row, e.g. "0/7 evidence release gates · 0/11 §25.5 validation gates — production not authorized" (both live-true today).
8. **Footer.tsx:98 (terminal)** → don't render Base/Arbitrum under "Testnet explorers" (pending mainnet targets); filter or relabel "Network explorers (incl. 2 pending mainnet targets)".
9. **CommandLauncher.tsx:51-52 / MobileBottomNav labels** → "Mint MTQΣ"/"Redeem MTQΣ" → "Mint Simulator"/"Redeem Simulator" for parity with section titles (minor).
10. **DASHBOARD_MOCK network rows** (landing-status.ts:227-230) → swap "Arbitrum/Ethereum Healthy" for the real registry chains (Monad/Arc/Robinhood/Solana) — inside a correctly-labeled SIMULATED PREVIEW, but why depict mainnets where nothing exists.
11. **LandingNav.tsx:57** → "41 read-only endpoints" → "40" (or derive from the developers API surface).
12. **"The Global Digital Asset"** (CinematicLoader, terminal Footer/Header/Sidebar via BRAND_VOICE.tagline) — aspirational brand voice, no operational assertion; owner call, low priority.

## (F) VERIFIED CORRECT (brief)

- TestnetStatusBar 0/11 gate fetch — live-wired and verified against /api/honest-status (the prior hardcoded "3/11" bug is definitively fixed in code).
- LiveTicker (8 fields), Header status pill, Sidebar status pill (RR/NAV) — all live-wired from the /api/metrics snapshot; honest skeleton/null states.
- Sidebar 26 items == Navigation registry 26; CommandLauncher 26/26 commands resolve; MobileBottomNav 5/5 valid; every landing launch target (10 nav + 10 footer + 4 CTAs) lands on a real PCC section; PCC section-restore validates against ALL_SECTIONS.
- Landing dialogs: every factual row in developers/governance/resources dialogs matches /api/contracts + /api/evidence verbatim (9/9, 9/9, SPL decimals 18, MITHQAL/MTQ, 28/28, 4/4 digest-level, Foundry n/a, Safe 1/1 vs 4/7, OD-1/2/3/5, 49 conflicts, 25 claims, D-4 40,500 B, R-01…R-16, b24e7e0/b68ccb8).
- Landing honesty furniture: 3-statement operational ribbon always visible; explicit no-fabrication stats footnote (declines fake TVL/users/uptime); SIMULATED PREVIEW tag + aria on the dashboard mock; HoloGlobe aria "not an operational network"; WalletDialog "no wallet SDK / no signer / no transaction"; footer disclaimer "nothing on this page constitutes an offer, a live product, or an authorization to transact".
- ChunkRecoveryBoundary + retrying dynamic import: honest recovery UX, no claims; CommandCenterBoot carries the posture line.

## Bottom line

The landing page is *structurally* honest — every interactive element is wired to real content, the three mandatory status statements are always visible, the stats bar refuses the reference design's fabricated marketing numbers, and the dialogs are anchored fact-by-fact to the committed evidence register. The residual risks are: (1) one overstated sentence ("13 suites re-run green" — 4 reproduce CRITICAL findings), (2) aspirational reference copy that present-tenses capabilities that don't exist (RWA backing "Tangible. Audited. Secure.", "Multi-chain wallet support", "real-world assets"), (3) a stale 3-testnet view of a 4-testnet registry (Robinhood omitted), (4) hardcoded true-today numbers (19 / 4 / 253 / 0-of-7) that can silently drift, tagged "LIVE" when they are not live reads, and (5) the 0/7-vs-0/11 gate-register duality shown to the public without reconciliation. Terminal shell wiring is clean: gates fetch live, ticker/header/sidebar live, all navigation surfaces resolve; only dead props, a dead file (HeroBand), a dead-import hack, and a "Testnet explorers" mislabel need attention.
