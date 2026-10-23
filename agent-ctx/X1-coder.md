# Task X1 — Rebuild Navigation + 9 sections + section-switching page

**Agent:** coder
**Task ID:** X1
**Scope:** Rebuild the MTQΣ Monetary Observatory section-based UI lost in a sandbox reset.

## Foundation intact (DO NOT TOUCH)
- 22 UI components in `src/components/mtq/`
- 8 lib files in `src/lib/mtq/`
- 13 API routes in `src/app/api/`
- Brand assets in `public/brand/`
- `src/app/layout.tsx`, `src/app/globals.css` (brand system)

## Files I will create
- `src/components/mtq/Navigation.tsx` — 9-section nav
- `src/components/mtq/sections/HomeSection.tsx`
- `src/components/mtq/sections/DashboardSection.tsx`
- `src/components/mtq/sections/ContractsSection.tsx`
- `src/components/mtq/sections/TrialSection.tsx`
- `src/components/mtq/sections/DocsSection.tsx`
- `src/components/mtq/sections/InvestorSection.tsx`
- `src/components/mtq/sections/PitchSection.tsx`
- `src/components/mtq/sections/SecuritySection.tsx`
- `src/components/mtq/sections/TestsSection.tsx`
- `src/app/page.tsx` — rewrite as section-switching wrapper

## Known issues to avoid
- `FileContract` icon does NOT exist → use `FileText`
- `ConstitutionalSeparation` causes hydration mismatch (SVG float precision) → wrap in `ClientOnly`
- `setState` in `useEffect` triggers lint error → use `// eslint-disable-next-line react-hooks/set-state-in-effect`
- `/api/tests` response may NOT have `audit.findings` → use `data.audit?.findings ?? []`
- All numeric formatting must use `(value ?? 0).toFixed(N)` NOT `value ?? 0.toFixed(N)`

## Plan
1. Build Navigation.tsx (9 nav buttons, active state with framer-motion layoutId, mobile hamburger)
2. Build HomeSection (hero, "What is MTQΣ?" 3 cards, constitutional separation in ClientOnly, live stats, 4 testnet cards, brand principles, honest badge)
3. Build DashboardSection (all 22 existing components in original order, fetch snapshot/oracle/registry/trials with 4s polling for snapshot)
4. Build ContractsSection (4 chain tabs, canonical MTQΣ card, ecosystem contracts table with search + copy + explorer links)
5. Build TrialSection (5 steps: faucets, canonical addresses, mint sim, redeem sim, trial log)
6. Build DocsSection (GFB basket, risk state machine, governance hierarchy, honest status, removed claims, reconciliation findings)
7. Build InvestorSection (live onchain verify per chain, 5 health cards, honest findings, trial traction, investor endpoints)
8. Build PitchSection (6 panels: problem/solution/market/business model/traction/ask)
9. Build SecuritySection (5 panels: posture, key management w/ EXPOSED badges, audit, regulatory, disclaimers)
10. Build TestsSection (verdict banner, 8 suite cards, invariants, findings, methodology, re-run button)
11. Rewrite page.tsx (section state, 4s snapshot poll, Header + Navigation + AnimatePresence + Footer, mt-auto footer)
12. lint, dev.log tail, git commit, append worklog
