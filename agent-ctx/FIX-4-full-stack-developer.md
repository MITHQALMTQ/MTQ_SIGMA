# FIX-4 — On-Chain vs Off-Chain Implementation Matrix panel

## Task
Add a new `OnChainMatrix.tsx` component that renders an honest, two-column
matrix mapping every Master Blueprint v1.0 component to its on-chain (Arc
Testnet pilot) vs TypeScript engine (`src/lib/mtq/*`) implementation status.
Wire it into both the Docs section (as the very first content) and the
Security section (near the top, after the section heading). Complementary to
the existing `HonestStatus.tsx` (which renders live reconciliation findings
F1-F4) — must NOT modify `HonestStatus.tsx`.

## Work Log
- Read `worklog.md` + `primitives.tsx` to understand the existing brand
  primitives (Panel, Reveal, Pill, GlowDot, SectionHeading, Eyebrow) and the
  Tailwind tokens already used in the codebase (`border-white/[0.08]`,
  `bg-white/[0.02]`, `text-mtqs-gold`, `text-emerald-400`, `text-rose-400`,
  `font-mono`, `tabular-nums`).
- Read `DocsSection.tsx` (600 lines), `SecuritySection.tsx` (557 lines), and
  `HonestStatus.tsx` (279 lines) to confirm integration points and the
  complementary view requirement.
- Confirmed the Arc Testnet contract address
  `0x826b82F79FD6c5347cDC568B1d0A7918128B63c1` is the v1.2 5-currency GFB
  pilot (chain 5042002) by grepping `src/lib/mtq/contracts.ts`.
- Created `src/components/mtq/OnChainMatrix.tsx` (~280 lines):
  - `CellStatus` type = `"on-chain" | "ts-only" | "not-implemented" | "n/a"`.
  - `MatrixRow` interface + `ROWS` array — canonical 20-row matrix (audit-
    derived) covering every blueprint component.
  - `StatusBadge({ status, text })` — renders a brand-tone Pill with a lucide
    icon: emerald + CheckCircle2 (on-chain), amber + Cog (ts-only), rose +
    XCircle (not-implemented), muted + Minus (n/a). No emojis in the code.
  - `classifyRow(row)` — RowClass tally: `on-chain`, `ts-only`, `not-
    implemented`, `audit-trail` (the last is the row-20 case where on-chain
    is `n/a` by design AND ts-engine is on-chain).
  - `OnChainMatrix()` — single Reveal > Panel:
    1. Header — eyebrow "Honest · On-chain vs Off-chain" + h3 "Implementation
       Matrix — Arc Testnet vs TypeScript Reference Engine" + small legend
       paragraph naming the 4 status badges and their colours.
    2. Summary chip (top-right, flex-wrap on mobile) — 4 colour-coded Pills:
       `7 on-chain` (emerald + CheckCircle2), `12 TS-only` (amber + Cog),
       `0 not implemented` (rose + XCircle), `1 audit-trail` (muted + Minus).
    3. Lead paragraph in a bordered sub-panel naming the deployed contract
       `0x826b82F79FD6c5347cDC568B1d0A7918128B63c1` (chain 5042002) and
       stating plainly: the on-chain pilot is v1.2 5-currency; the v1.0
       7-component adaptive architecture is implemented in the TS engine
       only and NOT yet deployed on-chain.
    4. Matrix table — responsive Tailwind grid:
       - Desktop (`sm+`): CSS grid `grid-cols-[36px_2.2fr_1.3fr_1.3fr_2.6fr]`
         with sticky-style header (# | Component | On-Chain | TS Engine |
         Notes) and 20 rows. Each row has a left-border colour strip
         matching the row classification (emerald/amber/rose/muted).
       - Mobile (`<sm`): stacked card per row — # + component on top, a
         2-col mini-grid showing On-Chain / TS Engine badges with their own
         tiny labels, then notes below. Uses `sm:hidden` + `hidden sm:grid`
         to switch layouts.
       - `max-h-[640px] overflow-y-auto mtqs-scroll` on the row container so
         the matrix is bounded and scrollable (long-list handling rule).
    5. Honest summary paragraph at the bottom (gold-bordered, gold-tinted
       sub-panel) — exactly the text the task specified: "The v1.0 Master
       Blueprint is fully implemented in the TypeScript reference engine
       (`src/lib/mtq/*`). The Arc Testnet pilot contract is a v1.2
       5-currency GFB pilot — a faithful minimal-but-complete
       implementation of the mint / redeem / index core, but NOT the v1.0
       7-component adaptive architecture. Production deployment of the
       v1.0 contract is the next major milestone."
- Edited `src/components/mtq/sections/DocsSection.tsx`:
  - Added `import { OnChainMatrix } from "@/components/mtq/OnChainMatrix";`.
  - Rendered `<OnChainMatrix />` as the FIRST content after the
    `<SectionHeading>` (before the existing intro Panel). The matrix is
    the very first thing a Docs visitor now sees.
- Edited `src/components/mtq/sections/SecuritySection.tsx`:
  - Added `import { OnChainMatrix } from "@/components/mtq/OnChainMatrix";`.
  - Rendered `<OnChainMatrix />` right after the `<SectionHeading>` (before
    the existing intro Panel). Security-conscious readers see the on-chain
    vs off-chain truth immediately.
- `HonestStatus.tsx` was NOT modified (complementary view preserved).

## Verification
1. `bun run lint` → exit 0 (zero errors, zero warnings).
2. `curl -s http://localhost:3000/ -o /dev/null -w "%{http_code}\n"` → `200`.
3. `tail /home/z/my-project/dev.log` → clean compiles (`✓ Compiled in 427ms`,
   `✓ Compiled in 241ms` etc.); no compile errors; no hydration errors;
   only the standard `GET / 200`, `GET /api/metrics 200` lines.
4. agent-browser:
   - Opened `http://localhost:3000/` → page title "MTQΣ — The Monetary
     Observatory" returned 200.
   - Clicked `Docs section` → heading hierarchy became:
     H2: "Documentation — Master Blueprint v1.0"
     H3: "Implementation Matrix — Arc Testnet vs TypeScript Reference Engine"
     H3: "GFB Index — 7-Component Strategic Prior" (existing)
     ... (existing reference tables preserved).
   - Extracted the matrix panel text via JS eval: confirmed all 20 rows
     rendered with the correct # | Component | On-Chain | TS Engine |
     Notes columns. Summary chip text exactly: "7 on-chain / 12 TS-only /
     0 not implemented / 1 audit-trail". Honest summary paragraph at the
     bottom present verbatim. Lead paragraph names the deployed contract
     address.
   - Clicked `Security section` → heading hierarchy became:
     H2: "Security — Posture, Keys, Audit, Regulatory"
     H3: "Implementation Matrix — Arc Testnet vs TypeScript Reference Engine"
     H3: "Security Posture" (existing)
     ... (existing security panels preserved).
   - Confirmed all 20 rows render in Security section too (identical content).
   - Set viewport to 390×844 (iPhone 14) → confirmed the `sm:hidden` mobile
     stacked layout renders (1 column with #/component, then a 2-col mini-
     grid for On-Chain/TS Engine badges with their own tiny labels, then
     notes wrapping). Set viewport back to 1280×800 → confirmed `sm:hidden`
     elements have `display: none` (proper desktop grid visible).
   - `agent-browser errors` → empty (no page errors).
   - `agent-browser console` → only React DevTools + HMR lines (`Fast
     Refresh done in 161ms`).
   - Screenshots saved: `agent-ctx/onchainmatrix-docs.png` (Docs section)
     and `agent-ctx/onchainmatrix-security.png` (Security section).

## Files Created/Modified
- Created: `src/components/mtq/OnChainMatrix.tsx` (~280 lines)
- Modified: `src/components/mtq/sections/DocsSection.tsx` (import + 1 line
  render placement)
- Modified: `src/components/mtq/sections/SecuritySection.tsx` (import + 1
  line render placement)

## Stage Summary
- A canonical, audit-derived 20-row "On-Chain vs Off-Chain Implementation
  Matrix" is now the FIRST content visitors see in both the Docs section
  and the Security section.
- The matrix explicitly states, for every Master Blueprint v1.0 component,
  whether it is ✅ deployed on-chain (Arc Testnet pilot), ⚙️ TS-only
  (`src/lib/mtq/*`), ❌ not implemented, or n/a (off-chain by design or
  on-chain-only view).
- The summary chip "7 on-chain · 12 TS-only · 0 not implemented · 1
  audit-trail" gives an instant numerical read of the gap between the
  deployed v1.2 pilot contract and the v1.0 Master Blueprint.
- The matrix is responsive (mobile-stacked card layout, desktop grid
  layout), accessible (semantic headings, GlowDot aria-hidden, lucide
  icons with aria-hidden), and on-brand (uses the existing Panel, Reveal,
  Pill, GlowDot primitives and the existing mtqs-gold/emerald/rose/amber
  Tailwind tokens — no new colours introduced, no indigo/blue).
- `HonestStatus.tsx` is preserved untouched — OnChainMatrix is the
  complementary static canonical view; HonestStatus is the live
  reconciliation findings view. Both panels now coexist.
- Lint: 0 errors. HTTP: 200. Dev log: clean. Browser: matrix renders with
  all 20 rows in both sections, responsive on mobile + desktop, no
  hydration errors.
