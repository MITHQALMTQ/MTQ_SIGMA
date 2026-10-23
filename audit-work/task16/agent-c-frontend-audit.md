# Task 16-c — Frontend Wiring + UX States + Routing Audit (mandate §4, source-level)

- Agent: Audit Agent 16-c (READ-ONLY — zero source files modified; no dev/build/lint/tsc/browser runs)
- Date: 2026-10-23 (UTC)
- Scope: `src/app/page.tsx` (single-route shell), `src/components/mtq/**` (PilotCommandCenter + 57 components + 20 sections), `src/components/landing/**` (7 components), `src/lib/mtq/landing-status.ts`. Reused agent 16-a's route register (44/44 frontend-referenced endpoints verified to EXIST with matching fields — not redone here). Light read-only curls only (`/api/health`, `/api/oracle`, `/api/metrics` keys, `/api/registry`).
- Method: full source read of the shell + nav surfaces + polling layer + every interactive control; import-graph scan (node script) for dead exports; DOM-id / aria-ref extraction + cross-check; grep sweeps for `fetch(`/`setInterval`/`console.*`/`onClick` on non-interactive elements.

## 0. Architecture summary (verified)

Single route `/` renders two client views: LANDING (LandingNav → Hero → ProtocolCards → StatsRow → EcosystemSection → LandingFooter) and, via client state (`mtqs.view` in sessionStorage) + `next/dynamic` (ssr:false, 3-retry chunk loader), the PilotCommandCenter terminal with **26 internal sections** switched by state (no routes). `mtqs.section` persisted in sessionStorage, restored on mount and **validated against ALL_SECTIONS** (invalid → falls back to `overview` — PCC.tsx:916-926). The whole terminal is wrapped in ONE `ChunkRecoveryBoundary`, which is a full React ErrorBoundary (chunk auto-reload once/15s; other render errors → branded panel + "Retry view").

## A. Wiring map — every fetch/poll consumer → endpoint → interval → error-state behavior

| Consumer (file) | Endpoint(s) | Interval | Loading state | Error behavior (verified) |
|---|---|---|---|---|
| **PCC fetchSnapshot** (PilotCommandCenter.tsx:935-963) | `/api/metrics` | **4s** (POLL_MS), skipped while `document.hidden`, immediate refetch on visibilitychange | Skeletons/null-guards in Header/LiveTicker/Sidebar/sections | Keeps last good snapshot; `error` string → Header "feed error" pill + Sidebar "FEED ERR"; no retry-storm (fixed interval, mounted-guard) |
| HomeSection (:275-298) | `/api/metrics` | 4s **only in standalone mode**; shared mode (parentSnapshot prop) drops poller | inherited | Silent keep-last (catch ignore); shared mode makes this a non-issue (one extra fetch at boot before parent snapshot arrives) |
| DashboardSection (:127-223) | `/api/metrics`+`/api/oracle` 4s standalone; `/api/registry`, `/api/trials?limit=50` one-shot | shared mode for metrics/oracle; hidden-paused | `BootSkeleton` while firstLoad && !snapshot | Silent keep-last for registry/trials (panels render null-guards); no explicit error panel |
| SystemHealth (:354-415) | `/api/metrics` | 5s standalone only; hidden-paused; 1s re-render tick | rows from snapshot | 503 → "Engine warming up" message; other errors → error state; shared mode via prop |
| TestnetStatusBar (:32-60) | `/api/honest-status` | once + on visibilitychange | "—" placeholder | `!res.ok` → keep null → renders "—/—" honestly |
| GovernanceSection (PCC :750-763) | `/api/honest-status` | once | Skeleton rows | **catch → ignore; NO res.ok check** → 429/503 JSON body becomes `honest` → Pill shows `honest?.status ?? "loading"` = **"loading" forever** (16c-004) |
| ReferenceSection (PCC :140-151) | `/api/gfb` + `/api/oracle` | **once per mount (no polling)** | Skeletons → "—" | catch → null → "—" values + "Oracle board unavailable" ✓; but liveness pills go stale (16c-011) |
| TransparencySection (:193-206) | `/api/gfb` | once | Skeleton | catch → null → "unavailable" rendering (explicit honest fallback) |
| ValidationResearchSection (:246-266) | `/api/validation` | once + retry button | Skeleton + "Running / loading…" | error → honest "§23 stress matrix unavailable … No stress data is faked" panel ✓ |
| AuditFindings (:165-180) | `/api/validation` | once | skeleton | error panel ✓ |
| TestsSection (:74-112) | `/api/tests`; **re-run button → `/api/tests?force=1`** | once + manual | skeletons; `cached/fresh` pill | error → error panel + re-run button; **force path = frontend-reachable server OOM (16a-002 → 16c-001), no timeout/abort** |
| SecuritySection (:95-120) | `/api/tests` | once | "audit loading…" | error → "audit unavailable" panel ✓ |
| PitchSection (:120-143) | `/api/tests` | once | "—" | auditFailed flag → honest "—" ✓ |
| MandateCompliance (:148-175) | `/api/mandate` | once + retry | skeletons | `!res.ok` → error text incl. body error; keep-last on refetch fail ✓ |
| EvidencePackageSection (:88-115) | `/api/evidence` + `/api/mandate` | once | skeletons | `!res.ok` throw → error panel ✓ |
| InstitutionalDashboard useJson (:72-90, tabs A–N) | implementation-status, three-book, protected-backing, systemic-risk, bank-default, legal-registry+licensing-matrix, contradiction-scan, sync, ai/status, por, stability-pool, banks, v3 | once per tab mount (Radix unmounts inactive) | LoadingRows skeletons | `!r.ok` throw → ErrorPanel per tab ✓ |
| ContractsSection RoleMatrixPanel (:258-283) | `/api/roles` | once + Re-verify button | loading | catch → DEGRADED banner ✓; **`!res.ok` NOT checked** → 500 body silently renders evidence matrix under "SNAPSHOT" pill (16c-009) |
| InvestorSection (:89-131) | `/api/onchain/{chainId}` × chains (Promise.all), `/api/trials/export?format=json&limit=5000` | once | loading per card | per-chain `{error}` rendering; trials silent-ignore → count "0" |
| EventExplorer (:437-459) | `/api/trials?limit={limit}` | once + manual refresh | "syncing" pill | **catch → ignore; Pill still shows "live"** on failure → stale rows labeled live (16c-010); synthetic rows individually labeled "simulated" ✓ |
| TrialLog (Dashboard :546; refresh via fetchTrials) | `/api/trials?limit=50` | on mount + manual | loading | silent keep-last |
| SuccessionLab (:67-129) | `/api/succession` GET; POST drill | once; drill on click | metaError panel; running spinner | GET `!ok` → detailed error string panel ✓; POST `!ok` → toast + error div ✓; run disabled while running ✓ |
| ConstituencySection (:263-315) | `/api/succession`, `/api/constituency` | once | Skeletons + "loading…" | both have explicit error panels ("unavailable — not fabricated") ✓ |
| IssuanceSection (:333-378) | `/api/issuance` GET; POST scenario | once + refresh; scenario click | snapLoading | GET `!ok` → snapError; POST `!ok` → runError; **all 8 scenario buttons `disabled={running !== null}`** ✓; persistence disclosed ✓ |
| MintSimulator (:42-81) | POST `/api/simulate/mint` | on click | pending spinner + disabled | ok:false → "Mint rejected" result card + toast.warning; data.error → toast.error; network → toast.error ✓; **no client max cap (16c-016)** |
| RedeemSimulator (:45-78) | POST `/api/simulate/redeem` | on click | pending + disabled | same honest ladder ✓ |
| FaucetPanel (:172-260) | POST `/api/simulate/mint` | on click + 30s cooldown (interval timer, leak-fixed) | pending + canClaim gating | wallet/amount validation per chain; rejection → toast + result card; honest asset-semantics banner ✓; client cap 100,000 ✓ |
| TransactionFlow (:384-404) | POST `/api/simulate/mint` | on click (11-step guided demo) | pending + disabled + state gating | rejection → ErrorDisplay + "Rejected" result card ✓; post-rejection "Skip to Confirmed" still offered (16c-015); component reachable only via dead TrialSection (16c-013) |
| BlueprintQA (:78-118) | POST `/api/ai/qa` | on click | loading + canSubmit | error state; Enter/Shift+Enter; 500-char cap client+server ✓ |
| RiskSignals (:100-135) | `/api/ai/risk-signals` | **15s, NO hidden-pause** | skeletons | `!ok` throw → rose error panel + retry ✓ (**429s expected on portfolio — 16c-002**) |
| AIPolicyBriefing (:70-108) | `/api/ai/briefing` | **60s, NO hidden-pause** | skeletons | error panel + retry; disabled-flag panel ✓ |
| LiveDataProvenance (:190-225) | `/api/fx` | **10s, NO hidden-pause** + 1s tick | skeletons | error state ✓ |
| HonestStatus5Level (:613-635) | `/api/honest-status` | once + retry | skeletons | `!res.ok` → honestError ✓ |
| ReproducibilityPanel (:15-33) | `/api/metrics` (manual "REPRODUCE") | on click | spinner + disabled | **NO res.ok check** → 503 JSON body → recomputed=undefined → `undefined.toFixed(6)` render crash (16c-003); methodological drift issue (16c-017) |
| OnChainMatrix / ProductionReadinessDashboard / ReproducibilityPanel / GfbBasket etc. | snapshot-prop driven (no own fetch) — read the shared PCC snapshot | 4s via parent | Skeleton/null-guards | inherit parent's keep-last |
| **DEAD (never imported)**: TrialSection (own `/api/trials?limit=50` + TransactionFlow mount) | — | — | — | unreachable code (16c-013) |

Polling architecture verdict: ONE shared 4s metrics poller at the PCC root feeds the whole terminal via props; the three former duplicate pollers (HomeSection, DashboardSection, SystemHealth) all support shared mode and drop their own intervals when the parent snapshot is present (residual: one extra `/api/metrics` fetch during the <1s boot window before the parent snapshot arrives). No N-duplicate-poller problem. Pause-on-hidden is implemented for the metrics family but NOT for the 3 secondary pollers (16c-008). Hydration: PCC is `ssr:false`; landing is deterministic (seeded PRNGs, static constants); ParticleField randomizes only after mount; sessionStorage restores happen in effects → hydration-safe.

## B. Navigation map + defects

Section registry: `Navigation.tsx` SectionId = 26 ids. Render chain (PCC :1068-1198) renders all 26. Verified surfaces:

| Surface | Items | All targets valid? |
|---|---|---|
| Sidebar (SIDEBAR_GROUPS 8+6+12) | all 26 sections (investors labeled "Dashboard") | ✓ 26/26, zero dead items, zero missing entries |
| MobileBottomNav | 5 (overview/reserve/risk/mint/redeem) + hamburger → Sidebar drawer (all 26) | ✓ |
| CommandLauncher (Cmd+K) | all 26 ("investors"/"pitch" categorized "Restricted") | ✓ (note: "Restricted" label implies gating that does not exist — cosmetic) |
| Header | "Landing" exit (desktop), status pill, NetworkSelector | ✓ exit wired to onExit |
| LandingNav anchors | #home/#product/#ecosystem — all 3 ids exist (Hero/ProtocolCards/EcosystemSection); IntersectionObserver active-state; skip-to-content link → #home ✓ | ✓ |
| LandingNav menus (Developers/Governance/Resources) | launch targets: contracts, networks, developers, governance, transparency, security, docs, architecture, validation, evidence | ✓ all real sections (restored via sessionStorage) |
| LandingNav chain popover | 4 testnets (info rows) + "Open Networks in the terminal" → networks | ✓ |
| Hero CTAs | "Launch App" → app; "Watch Video" → honest VideoDialog (no video exists — says so) | ✓ |
| Ecosystem CTA | "Launch Pilot Command Center" → app | ✓ |
| Footer | #anchors + 10 launch links (same valid set) + Launch App | ✓ |

- **Duplicate DOM ids: NONE** (full-tree id extraction + uniq check).
- **Dangling aria-labelledby: 66 of 108 unique refs point to ids that never render** (SectionHeading emits no heading id — see 16c-007); 2 dangling `htmlFor` (faucet-network, faucet-asset → label-to-button-group).
- Deep-links: no hash routing in terminal (by design, single route); `launchTo(section)` path validated against ALL_SECTIONS on restore ✓; invalid sessionStorage values fall back to overview ✓.
- Sections without a nav entry: none. Nav entries without a section: none.

## C. Defect list

**16c-001 · P1 · "Re-run suite" button is a frontend-reachable server self-destruct (OOM) trigger**
- Evidence: `sections/TestsSection.tsx:83` (`?force=1`), `:221-228` + `:282-292` (two re-run buttons; disabled-while-running only). Agent 16-a live-proved `/api/tests?force=1` + `/api/validation?force=1` run the full Monte-Carlo in-request and OOM-killed the dev server (16a-002). No AbortController/timeout, no confirmation, no environment gate.
- Min fix (frontend side): remove the force button from the UI (or gate behind an explicit dev flag + confirmation + fetch timeout); server-side fix per 16a-002 (serve cache only).

**16c-002 · P2 · Portfolio section's two AI pollers exactly saturate the shared 5/min `ai` bucket → recurring 429 "unavailable" panels in normal use**
- Evidence: `sections/DashboardSection.tsx:551,556` mounts AIPolicyBriefing (60s) + RiskSignals (15s) = 5 req/min sustained = exactly `rate-limit.ts:45` capacity 5, refill 5/60s; any remount (section switch back), extra consumer, or jitter ⇒ 429s; RiskSignals/AIPolicyBriefing render honest rose error panels (verified) but they will appear routinely ~60s into a portfolio visit and stay. Neither poller pauses on hidden tab.
- Min fix: poll risk-signals ≥30s (or derive from the metrics snapshot payload), add document.hidden gating, honor Retry-After in the retry button.

**16c-003 · P2 · ReproducibilityPanel: missing res.ok check → render crash path that can loop the whole terminal**
- Evidence: `ReproducibilityPanel.tsx:20-31` — `const data = await res.json()` with no `res.ok`/finite guard; `/api/metrics` returns 503 `{error,detail}` when the engine is not ready → `recomputed = undefined` → `:98 result.recomputed.toFixed(6)` throws during render → the single top-level ChunkRecoveryBoundary blanks the ENTIRE terminal; "Reload terminal" restores `mtqs.section` = portfolio → same crash → potential hard reload loop (no per-section boundary exists).
- Min fix: check `res.ok` + `Number.isFinite(data.gfbIndex)` before setResult; add a per-section error boundary; on boundary reset, consider falling back to overview.

**16c-004 · P2 · GovernanceSection stores a 429/503 error body as the honest-status payload → status pill reads "loading" forever (misleading state on error)**
- Evidence: `PilotCommandCenter.tsx:756-761` (`.then((r) => r.json())` without ok check) + `:781-784` (`honest?.status ?? "loading"`). A 429 body is `{error:"Rate limit exceeded",retryAfter}` (honest-status route :39-44) → `status` undefined → permanent "loading" pill while gates show "—".
- Min fix: `if (!r.ok) throw` → render the existing "Honest status unavailable." branch.

**16c-005 · P2 · WeightChangeDrawer "Purchasing-Power Signal" is unlabeled synthetic data**
- Evidence: `WeightChangeDrawer.tsx:62-74` `syntheticPriceRelative()` (client-side perturbation "that drifts with gfbIndex so the signal feels connected") rendered at `:520-523` with sub "signed price-relative drift vs base date (§3.4)" — no synthetic qualifier, while the sibling Risk Contribution row properly says "(synthetic vols for pilot)" (:510). G-posture violation: synthetic value presented as a real §3.4 metric.
- Min fix: sub → "signed price-relative drift vs base date (§3.4) — synthetic pilot fixture".

**16c-006 · P3 · WeightChangeDrawer "Decision ID" is a fabricated client-side ID badged "audit"**
- Evidence: `:162` `DEC-${ymd}-${component}-${tick}` built locally; rendered `:600-610` with `<Pill tone="gold">audit</Pill>` — implies an engine audit artifact; no such decision record exists.
- Min fix: relabel ("deterministic UI trace id") or drop the "audit" pill.

**16c-007 · P3 · Systemic dangling a11y label references (66/108 aria-labelledby + 2 htmlFor)**
- Evidence: `primitives.tsx:129-151` SectionHeading renders `<h2>` with NO id, while 66 `<section aria-labelledby="X-h">` wrappers reference a heading id that never exists (e.g. PCC :766 `governance-councils-h`, :1123 `faucet-panel-h`, all `docs-*`, `arch-*`, `dev-*`, `validation-*` …). FaucetPanel `:320,:365` label `htmlFor` → button groups with no id. Screen readers fall back to section content; labeling intent lost.
- Min fix: give SectionHeading an optional `id` prop (or auto-derive from eyebrow) and thread it; convert the two faucet labels to `aria-labelledby` group labeling.

**16c-008 · P3 · Secondary pollers never pause on hidden tabs**
- Evidence: `RiskSignals.tsx:131`, `AIPolicyBriefing.tsx:102`, `LiveDataProvenance.tsx:220` — bare setIntervals; contrast PCC :935, SystemHealth :399-402, HomeSection :279 (all hidden-gated). Background tabs keep burning requests + the ai bucket (compounding 16c-002).
- Min fix: add the same `if (document.hidden) return` guard.

**16c-009 · P3 · ContractsSection roles fetch: non-OK responses silently degrade to "SNAPSHOT" instead of the DEGRADED banner**
- Evidence: `sections/ContractsSection.tsx:264-271` — no `res.ok` check; a 500 `{error}` body sets data with undefined status → `:309-311` renders amber "SNAPSHOT" pill and the recorded-evidence matrix with no failure notice; only the catch path shows the "LIVE CHECK FAILED" banner (:325-327).
- Min fix: `if (!res.ok) throw new Error(...)` so the existing DEGRADED path fires.

**16c-010 · P3 · EventExplorer swallows fetch failures while the header pill still says "live"**
- Evidence: `EventExplorer.tsx:449-452` (catch → ignore) + `:513-517` (Pill `loading ? "syncing" : "live"`). On API failure the explorer shows stale rows under a green "live" pill.
- Min fix: error state → rose "stale" pill + footnote.

**16c-011 · P3 · ReferenceSection is one-shot but presents itself as live-streaming**
- Evidence: PCC `:140-151` — single Promise.all on mount, no interval; copy at `:218-221` "Live prices stream from the canonical oracle board"; pills ("all 6 pairs live" / oracle board state) go stale for as long as the section stays mounted (other panels re-fetch on visibility, this one doesn't).
- Min fix: poll on visibilitychange like TestnetStatusBar, or reword to "snapshot at section open".

**16c-012 · P3 · Landing-page residual overclaims**
- Evidence: `landing-status.ts:184` ECOSYSTEM checklist "Governance & voting portal" — no voting portal exists anywhere in the pilot (governance section is councils/gates/spec status; EventExplorer governance rows were already fixed by 14-fix to "SPECIFIED — NOT OPERATIONAL"); `:82` hero paragraph "advanced AI models" + `:99-102` hero panel "AI-Powered Economics / Adaptive. Transparent. Fair." — live AI is the deterministic fallback-rules engine (no provider configured; terminal discloses `model:"fallback-rules"`, RiskSignals even prints the honest attribution); the landing presents AI as an operating feature with no pilot qualifier (the same file qualifies the basket claim with "(simulated pilot)" — AI gets none).
- Min fix: checklist → "Governance status & gates"; hero → "AI-assisted economics (pilot: rule-based fallback)" or add the "(simulated pilot)" qualifier.

**16c-013 · P3 · Dead weight: unreachable components + dead exports + orphan listener**
- Evidence (import-graph scan, 113 used exports vs these unused): `sections/TrialSection.tsx` — the ENTIRE component is never imported (its `/api/trials?limit=50` fetch counted in 16-a's "frontend-referenced endpoints" is actually dead weight); it is the sole importer of `TransactionFlow.tsx` → both unreachable (~1,100 LOC). `primitives.tsx` dead exports: Eyebrow, FadeSwap, GradientText, SectionDivider, AnimatedCounter, CSSParticleField, SECTION_IDS. `Navigation.tsx` NAV_GROUPS/SECTIONS (only ALL_SECTIONS used). `StatusDialogs.tsx` VideoDialog (VideoDialogButton is the used one). `Sidebar.tsx:155-160` listens for `mtqs:open-sidebar` — no dispatcher exists anywhere (comment references a removed "page-level mobile top bar"). No console.log/warn/error leftovers in any component (grep clean).
- Min fix: delete TrialSection + TransactionFlow (or re-wire TrialSection into the activity section if wanted); prune the exports; drop the listener.

**16c-014 · P4 · InvestorSection API table says "5-pair oracle consensus" — live board has 6 pairs**
- Evidence: `sections/InvestorSection.tsx:52` vs live `curl /api/metrics`-independent `GET /api/oracle` → 6 pairs (EUR, GBP, JPY, CNY, CHF, XAU). ReferenceSection and the engine both say 6.
- Min fix: "6-pair".

**16c-015 · P4 · TransactionFlow offers "Skip to Confirmed" after a REJECTED mint**
- Evidence: `TransactionFlow.tsx:388-396` — on `mint.ok:false` it sets the error AND jumps to step 9; `:767-780` step 9 renders the honest "Rejected" card but still links "Skip to Confirmed" → steps 10/11 titled "Confirmed"/"Explorer" (rejection card stays visible, so not dishonest — but the progression implies completion). Also `mode="redeem"` is typed but confirmAndExecute always POSTs `/api/simulate/mint` (currently unreachable since only dead TrialSection mounts it, mode="mint").
- Min fix: on rejection, terminate the flow (no forward navigation); delete the redeem mode or implement it.

**16c-016 · P4 · Mint/Redeem simulators have no client-side amount cap while the faucet caps at $100K — inconsistent guardrails against the unbounded server (16a-001)**
- Evidence: `MintSimulator.tsx:42-53` (finite>0 + min-mint only) and `RedeemSimulator.tsx:45-50` vs `FaucetPanel.tsx:169,194` (`amount <= MAX_CLAIM_AMOUNT` 100,000). A user can paste 1e15 into either simulator; the server accepts it (16a live-proved EMERGENCY pollution).
- Min fix: mirror the faucet's labeled pilot cap until the server enforces its own.

**16c-017 · P4 · ReproducibilityPanel "REPRODUCE" methodology overclaims "same inputs"**
- Evidence: `:15-33` — compares the CURRENT snapshot's gfbIndex against a FRESH `/api/metrics` fetch (up to 4s later, engine ticks every ~3-4s with live FX) → legitimate live drift can flip MATCH→MISMATCH; copy `:43,113` claims "Re-run the calculation from the same inputs" / "Every published output can be independently recomputed from public inputs".
- Min fix: fetch twice back-to-back for the comparison, or compare snapshot against snapshot-derived recompute; reword.

### Positive findings (things that are RIGHT — verified)
- Navigation is complete and consistent: 26/26 sections rendered, 26/26 in Sidebar, 26/26 in CommandLauncher, all landing launch-targets real, **zero duplicate DOM ids in the entire tree**, restore path validated against the section registry.
- Double-submit protection is universal: every mutating control disables itself while pending (Mint :159, Redeem, Faucet canClaim, Succession run :240, Issuance scenarios :662, BlueprintQA canSubmit, Tests rerun, Reproducibility :81, TransactionFlow :741 — which also gates on mintingAllowed/oracleOk/inBand).
- Honest error panels exist across the heavy data sections (validation, audit findings, constituency, succession, mandate, evidence, security, pitch, AI panels, InstitutionalDashboard tabs each with per-tab ErrorPanel + skeletons); "unavailable / nothing is fabricated" fallbacks are the established pattern.
- G8/labeling discipline in the interactive surfaces: faucet banner + display-only asset picker disclosure, EventExplorer per-row "simulated" chips + honest explorer-link label, IssuanceSection "synthetic fixtures · fixed clock" + persistence disclosure, TestsSection counts from payload (never hardcoded), TestnetStatusBar "—/—" gate fallback, landing stats row footnote substitution disclosure, wallet/video dialogs truthful, SIMULATED PREVIEW tag + note on the dashboard mock.
- a11y is well above par for this kind of terminal: 227 aria-labels, keyboard paths everywhere sampled (drawer rows: role=button + onKeyDown + tabIndex; CommandLauncher arrows/enter/esc; Sheet drawer esc + scroll lock; skip-link; role=img with honest labels on HoloGlobe/BrandMark; prefers-reduced-motion honored in landing.css + MotionConfig reducedMotion="user").
- Hydration-safe: ssr:false terminal, deterministic landing PRNGs, effect-only sessionStorage restores, ParticleField mounted-gating, explicit `en-US` locale in the only toLocaleString usages.
- Chunk-load resilience: 3-retry dynamic loader + guarded single auto-reload + honest fallback panel (dev-motivated, product-neutral).
- No console.* leftovers; no onClick-on-div keyboard traps (full grep clean).

## D. Mandate answers

1. **Any component that renders misleading state on error?** YES — four: GovernanceSection (429/503 body → permanent "loading" pill, 16c-004), EventExplorer (fetch failure → stale rows under a green "live" pill, 16c-010), ContractsSection roles (!ok → silent "SNAPSHOT" without the failure banner, 16c-009), ReferenceSection (one-shot data presented as live-streaming, 16c-011). The primary metrics feed degrades honestly (stale data + explicit "feed error"/"FEED ERR" badges, no retry-storm).
2. **Any double-submit risk?** NO — every mutating button is disabled-while-pending (verified individually). The residual risk is server-side absence of rate limits/caps (16a-001) plus the client-cap inconsistency (16c-016).
3. **Any nav dead-ends?** NO — every nav target (26 sidebar, 26 launcher, 5 mobile, 10+10 landing menu/footer launches, 3 anchors, 4 CTAs) resolves to a real rendered section or honest dialog; no unreachable sections, no duplicate ids. Cosmetic only: CommandLauncher's "Restricted" category implies gating that doesn't exist.
4. **Any unlabeled synthetic data?** YES — WeightChangeDrawer's Purchasing-Power Signal (16c-005, P2) and its "audit"-badged fabricated Decision ID (16c-006). Everything else sampled (EventExplorer synthetic rows, faucet hashes, Issuance fixtures, synthetic vols, dashboard mock, landing stats) is labeled.
5. **Top-priority actions:** (1) 16c-001 — pull the force re-run button before someone clicks it in prod-like conditions (pairs with 16a-002); (2) 16c-003 — one-line res.ok guard to remove a whole-terminal crash+reload-loop path; (3) 16c-002 — rebalance the AI poll cadence; (4) 16c-005 — one string fix to restore G8 labeling discipline.

## E. Tooling note
Same renderer artifact as 16-a §F: the Bash/Read output renderer sporadically ate `[h`/`[m` sequences (e.g. `const [honest` displayed as `const onest`, `const [mounted` as `const ounted`). Verified against raw source with alternative greps — NOT code defects; documented so nobody chases ghosts.
