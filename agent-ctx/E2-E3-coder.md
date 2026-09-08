# Task E2-E3 — Coder (engine + UI implementation)

**Task:** Update engine.ts + UI components to use the new Master Blueprint v1.0 constants (commit 4b384a6 — blueprint.ts already updated by Orchestrator in E1).

**Scope:** fx.ts, engine.ts, pilot-state.ts, GfbBasket.tsx, LiveMonetaryState.tsx, ReserveVault.tsx, HomeSection.tsx, DocsSection.tsx, HonestStatus.tsx, blueprint.ts (only to remove the duplicate `RAMP_DURATION_HOURS`).

**Predecessors:** E1 (Orchestrator) — full gap audit + blueprint.ts update.

## Outcome

- Dev server: `GET / 200`, `GET /api/metrics 200`, `POST /api/simulate/mint 200`, `POST /api/simulate/redeem 200`.
- `bun run lint` → exit 0.
- Live metrics now include `reserve.chfNet` ≈ $76.5K and `fx.CHF_USD` ≈ 1.236 (live from Frankfurter).
- The GFB Index is now 7-component chain-linked (gold-heavy: ~1.77 vs the legacy ~1.00 because gold is now IN the index).
- The redeem basket returns 6 fiat currencies (USD, EUR, JPY, GBP, CNY, CHF) + gold (PAXG+XAUT).

## What changed

### Critical fix (was 500)
- `blueprint.ts`: removed the duplicate `RAMP_DURATION_HOURS` declaration at the end of the legacy-constants block (the §14.2 reserve-tier export at line 158 is now the only one). SWC was hard-failing on "the name `RAMP_DURATION_HOURS` is defined multiple times".
- `BASKET_TABLE` and `REMOVED_CLAIMS` exports were already removed by the E1 commit; their consumers (GfbBasket.tsx, DocsSection.tsx, HonestStatus.tsx) were updated in this task.

### fx.ts
- `FxSnapshot`: added `CHF_USD: number`.
- `DEFAULTS.CHF_USD: 0.88` (matches `BASE_FIXINGS.CHF_USD`).
- `fetchFrankfurter()` now extracts `CHF_USD = 1 / Number(r.CHF)` (CHF is in the ECB reference rate list); CHF is treated as optional with cache/default fallback.

### engine.ts
- Imports: `FxRates` from `./blueprint` (was erroneously from `./fx` — SWC was silently coercing the type to `any`); `FxSnapshot` from `./fx`. Replaced `Q_USD, Q_EUR, Q_GBP, Q_JPY, Q_CNY` with `STRATEGIC_PRIOR`. All legacy `BASE_GOLD_WEIGHT`, `GOLD_WEIGHT_LOWER/UPPER`, `ALPHA`, `BETA`, `THETA_MAX`, `LAMBDA_*`, `BUFFER_*`, `RAMP_DURATION_HOURS` imports RETAINED — the §6/§7/§8 buffer/MARP path still uses them (kept verbatim per task instructions).
- `ReserveState`: added `chf: number`.
- `initReserveState(goldPrice)`: $1.1M deposit split across the 7 Strategic Prior components (USD 27% · EUR 20% · JPY 9% · GBP 8% · CNY 5% · CHF 5% · Gold 26%); CHF tokens at base fixing 0.88. RR remains 1.10.
- `computeGfbIndex()`: now takes `Pick<FxRates, "EUR_USD" | "GBP_USD" | "JPY_USD" | "CNY_USD" | "CHF_USD" | "XAU_USD">` and computes the 7-component chain-linked numerator `Σ W^Prior_i × P_i,t` divided by `GFB_BASE_DENOMINATOR`.
- `reserveAssetValues()`: added `chfGross = s.chf * fx.CHF_USD`, `chfNet = chfGross * (1 - HAIRCUTS.CHF)`. `fiatGross` and `fiatNet` now include CHF. `nav` includes CHF.
- `applyRedeem()`: basket now 6 fiat rows (USD, EUR, JPY, GBP, CNY, CHF), split via `STRATEGIC_PRIOR` renormalised to the non-gold total 0.74. `s.chf` debited on redeem. Gold still 50/50 PAXG+XAUT.
- `MetricsSnapshot.reserve.chfNet` added; `computeSnapshot()` passes it through.
- `pilot-state.ts`: `STATE_SCHEMA_VERSION` 6 → 7 so the singleton rebuilds with the new `chf` field.

### UI
- **GfbBasket.tsx**: BASKET_TABLE → STRATEGIC_PRIOR_TABLE (7 components, columns Component / Token / W^Prior). Base-fixings card now includes CHF/USD (0.88) and XAU/USD (2500). GoldInReserve rewritten — gold is in BOTH the index and the reserve (§3.2 + §14.1), with the mandatory separation explained.
- **LiveMonetaryState.tsx**: added CHF/USD tile to the FX strip (grid now `lg:grid-cols-8`). Dynamic `GFB_BASE_DENOMINATOR`-driven label under the GFB Index tile.
- **ReserveVault.tsx**: CHF added to the assets array in both `VaultDiagram` and `ReserveVault` (color `#7ab8a3` — muted emerald-teal within brand palette).
- **HomeSection.tsx**: "What is MTQΣ?" GFB card text → 7-component Strategic Prior; Reserve card notes the v1.0 mandatory separation. Tokenized Gold section heading → "Tokenized Gold — in BOTH the Index and the Reserve"; gold-weight gauge bounds text → "20% envelope floor / 32% envelope ceiling". Explanatory paragraph rewritten to explain the §14.1 mandatory separation and that the legacy §6/§7/§8 buffer path is retained until MASE replaces it.
- **DocsSection.tsx**: now surfaces STRATEGIC_PRIOR_TABLE, ENVELOPES_TABLE, WEIGHT_STATE_DESCRIPTIONS, MASE_MODELS, CONSTITUTIONAL_INVARIANTS (I1–I11), RISK_STATE_MACHINE, GOVERNANCE_HIERARCHY, HONEST_STATUS, UNSUPPORTED_CLAIMS (incl. 3 new v1.0 entries), RECONCILIATION_CHANGES (11 areas), live reconciliation findings. Heading pill "v1.2 · FINAL" → "v1.0 · Master".
- **HonestStatus.tsx**: REMOVED_CLAIMS → UNSUPPORTED_CLAIMS (different shape: `claim`/`reason` vs `removed`/`replaced`). Title "MTQΣ v1.2 — ..." → "MTQΣ v1.0 (Master Blueprint) — ...". Added an explanatory note about the 3 new v1.0 unsupported claims.

## Constraints honoured

- No /api route files modified. The /api/metrics, /api/simulate/mint, /api/simulate/redeem routes are unchanged; they JSON-serialise the engine output which now includes `chfNet` and the 6-fiat redeem basket. The /api/status route's cosmetic `version: "Σ-v1.2"` label is out of scope for this task.
- No on-chain contracts (registry.ts, oracle.ts) modified.
- All legacy v1.2 constants RETAINED in blueprint.ts (marked SUPERSEDED) and still imported where the legacy buffer/MARP path uses them. The §6/§7/§8 buffer/MARP path is kept verbatim — the future MASE task will replace it.

## Outstanding for the next task

- MASE ensemble (replace the single-engine θ ±3% with the 6-model ensemble + adaptive weights).
- MARP (replace the simple trigger + 24h direction lock with the 6-level hierarchy).
- Per-component admissibility enforcement (currently the envelopes are display-only; the optimizer needs to clamp to them).
- Physically separate the index gold from the reserve gold (currently the same PAXG + XAUT holdings serve both roles).
- Update the cosmetic version labels in Header.tsx, Footer.tsx, InvestorSection.tsx, RedeemSimulator.tsx, PitchSection.tsx, /api/status (these are out of scope for E2-E3 — they all say "Σ-v1.2" / "v1.2 · FINAL" as a label and were not in the task brief).
