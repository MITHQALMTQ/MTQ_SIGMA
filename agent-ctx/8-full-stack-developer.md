# Task 8 — full-stack-developer — MTQΣ Pilot Command Center frontend

## Summary
Built the entire single-route frontend for the MTQΣ Pilot Command Center as a Next.js 16 client component (`src/app/page.tsx`) plus 15 small presentational components under `src/components/mtq/`. The page polls `/api/metrics` every 4s, fetches `/api/trials` on mount and after every mint/redeem trial, lets the user switch chain (`monad`/`arc`/`solana`), and surfaces sonner toast feedback on trial success/failure.

## Files created
- `src/components/mtq/format.ts` — shared formatters + status colors
- `src/components/mtq/MetricCard.tsx` — `MetricCard` + `PanelSection`
- `src/components/mtq/HeroBand.tsx` — hero image banner + 3 quick stats
- `src/components/mtq/ReserveDonut.tsx` — recharts donut (no blue)
- `src/components/mtq/GoldWeightGauge.tsx` — observed vs target bar
- `src/components/mtq/MacroEngine.tsx` — VIX/DXY z-scores + θ + EMA + coefficients
- `src/components/mtq/RebalanceEngine.tsx` — decision + direction + λ/limits
- `src/components/mtq/MintSimulator.tsx` — mint form + result panel + sonner
- `src/components/mtq/RedeemSimulator.tsx` — redeem form + result + basket table + sonner
- `src/components/mtq/EjectMonitor.tsx` — peg health / depeg hours / stage ladder
- `src/components/mtq/ContractRegistry.tsx` — 3-chain tabs + copy/explorer
- `src/components/mtq/RiskStateMachine.tsx` — full §14.1 table with current row highlighted
- `src/components/mtq/GovernanceHierarchy.tsx` — §14.2 cards
- `src/components/mtq/GfbBasket.tsx` — §2 basket + base FX + denominator
- `src/components/mtq/TrialLog.tsx` — scrollable audit log + PilotTrial type
- `src/components/mtq/HonestStatus.tsx` — callout + HONEST_STATUS + REMOVED_CLAIMS

## Files modified
- `src/app/page.tsx` — replaced entirely with the Pilot Command Center
- `src/app/layout.tsx` — added Sonner Toaster, `<html className="dark">`, MTQΣ metadata + emblem favicon
- `src/app/globals.css` — `.mtqs-scroll` (gold custom scrollbar), `.mtqs-gold-text`, `.mtqs-glow`, `.mtqs-grid-bg`

## Did not touch
- Any `src/app/api/*` route (correct as-is per instructions)
- Any `src/lib/mtq/*` file (engine / blueprint / contracts / fx / pilot-state are correct as-is)

## Verification
- `bun run lint` — exit 0, no errors / warnings
- Dev server compiles the page (`GET / 200`, no errors in `dev.log`)
- `/api/metrics` returns a live `MetricsSnapshot` (Frankfurter ECB + gold-api, XAU ≈ $4444, gfbIndex ≈ 1.0544)
- `/api/trials?limit=N` returns `{ trials: PilotTrial[] }` (empty on fresh DB)
- `/api/contracts` returns all 3 chains
- HTML render contains skeleton (`Booting MTQΣ`) + footer (`Designed for Sharia`, `Deployer`, `Candidate for public testing`, `testnet`) on first SSR; full dashboard renders after hydration

## Known notes / honest constraints
- Client component → SSR renders only skeleton + footer (intentional per the "skeleton while first fetch in-flight" spec). Full dashboard appears after the first `/api/metrics` round-trip.
- VIX & DXY are flagged as "SIMULATED PILOT MACRO SIGNALS" in three places (FX row, MacroEngine, footer).
- Reserve Ratio / LCR show "∞ — fully reserved" when null or non-finite.
- Trial log starts empty on a fresh DB; the empty state is handled gracefully.
- Recharts is only used inside `'use client'` presentational components.
