# Task B8 — full-stack-developer — MTQΣ brand system refinement

## Task
Apply the complete MTQΣ brand identity system (built in B2–B7) consistently across
all UI components in the existing "Monetary Observatory" — refinement/branding
pass, not a rebuild.

## Source-of-truth files consulted
- `src/lib/mtq/brand.ts` — BRAND_COLORS, GOVERNANCE_TIERS, STATUS_COLORS,
  BRAND_TYPOGRAPHY, BRAND_VOICE, LOGO_MARK_DESCRIPTION, BRAND_ASSETS,
  BRAND_SHADOWS, BRAND_RADII.
- `src/app/globals.css` — bespoke utilities (.mtqs-*).
- `src/app/layout.tsx` — fonts loaded (Geist Sans / Geist Mono / Cormorant
  Garamond display).
- `src/lib/mtq/engine.ts` — MetricsSnapshot.reconciliation /
  redemptionPolicy / perIssuer interfaces (F1 + F2 both "fixed" via the
  multi-issuer optimizer).
- `src/components/mtq/*` — every existing component.

## Files refined

### `src/components/mtq/primitives.tsx`
- Added `BrandPrinciples` primitive — renders the 4 brand principles
  ("Honest · Sovereign · Collateralized · Calm") as a tracked uppercase row.
- `GlowDot` now uses brand hex colors directly (#e8b964 / #3ddc97 / #ff5d73 /
  #ffb84d) via inline `style={{ backgroundColor, color }}` instead of Tailwind
  amber/emerald/rose classes — single source of truth.
- `Pill` tones now use brand `mtqs-gold` / `mtqs-emerald` / `mtqs-rose` /
  `mtqs-amber` tokens.
- `Reveal` transition shortened to 0.3s for subtle motion (was 0.5s).

### `src/components/mtq/Header.tsx`
- Wordmark "MTQΣ" now uses `mtqs-display mtqs-gold-text font-semibold` (Cormorant
  Garamond + gold gradient) — sovereign editorial feel.
- Logo-mark `/brand/mtqs-logo-mark.png` to the left of the wordmark, wrapped in
  `.mtqs-glow`.
- Tagline `BRAND_VOICE.tagline` ("The Global Purchasing Power Unit ·
  Closed-Loop Monetary Architecture") under the wordmark.
- Status declaration `BRAND_VOICE.statusDeclaration` under the version pill.
- Status pill now uses `STATUS_COLORS[status]` from brand.ts for the bg/border/
  label color (emerald / amber / light-rose / rose).
- Replaced `text-amber-*`/`text-emerald-*`/`text-rose-*` with brand hex literals
  (`text-[#f5d27a]`, `text-[#6ff0c0]`, `text-[#ff8ea3]`) in the ticker.

### `src/components/mtq/Footer.tsx`
- Uses `/brand/mtqs-emblem.png` wrapped in `.mtqs-glow`.
- Wordmark "MTQΣ" in `mtqs-display mtqs-gold-text`.
- Brand tagline + version line below the wordmark.
- `BrandPrinciples` row under the brand lockup.
- `BRAND_VOICE.designConstraint` ("Designed for Sharia review (interest-free,
  asset-backed, non-speculative)") and `BRAND_VOICE.statusDeclaration` in the
  honest disclaimers column (emerald-tinted).
- Testnet explorer links use `text-mtqs-gold` and `hover:border-mtqs-gold/40`.

### `src/app/page.tsx`
- Hero image now `/brand/mtqs-hero.png` (was `/mtqs-hero-v2.png`) with heavy
  obsidian overlays for legibility.
- Hero display title "The Monetary Observatory" rendered in `mtqs-display
  mtqs-gold-text` (Cormorant Garamond + gold gradient).
- Hero tagline `BRAND_VOICE.tagline` under the display title (tracked
  uppercase gold).
- Hero subtitle (blockquote) is `BRAND_VOICE.coreObjective`.
- `BrandPrinciples` row under the hero.
- Honest Status section now wraps the panel in a `.mtqs-pattern-bg` backdrop
  (very faint currency-basket weave).
- `FirstLoadSkeleton` now shows the brand emblem as the boot-loader mark.
- AssetRegistry now receives `perIssuer` from the snapshot.

### `src/components/mtq/HonestStatus.tsx` (MAJOR — both findings now FIXED)
- Replaced the rose-only "Honest Audit Findings" treatment with a calm,
  sovereign `.mtqs-glow` panel.
- Renders ALL 4 `snapshot.reconciliation` findings (F1 redemption contradiction,
  F2 genesis issuer concentration, F3 VIX/DXY simulated, F4 Sharia not
  certified) with severity-coded badges:
    - `fixed`         → emerald Pill + GlowDot ("fixed")
    - `outstanding`   → amber Pill + GlowDot ("outstanding")
    - `informational` → muted Pill + gold GlowDot ("informational")
- Each finding card shows: #, title, severity badge, description, resolution.
- F2 card includes an inline `IssuerBreakdown` of the live per-issuer
  concentration (`snapshot.concentration`) — each issuer colored ok=emerald /
  warn=amber / breach=rose with the live share %.
- Adds a redemption policy reconciliation block (emerald-tinted) rendering
  `snapshot.redemptionPolicy.canonical` + `.reason` + `.informational`.
- Removes all stale text claiming the concentration breach is "outstanding".
- Main declaration panel now uses `Panel` default (no rose), with `BRAND_VOICE`
  tagline + coreObjective + designConstraint.

### `src/components/mtq/AssetRegistry.tsx` (F2 RESOLVED)
- Removes the stale rose "Honest Finding — Circle issuer concentration breach"
  panel.
- Adds an emerald "Resolved Finding" panel when all issuers are ok; amber
  "optimizer running" panel if any warn/breach. Shows the live max issuer
  (e.g. "CIRCLE at 24.99% of NAV — all issuers ≤ 25% warn threshold ✓").
- `ConcentrationPanel` now renders each issuer's per-token constituent
  breakdown inline (e.g. "CIRCLE: USDC $12.5K · EURC $268.9K") using
  `snapshot.perIssuer`.
- Color discipline: ok=emerald, warn=amber, breach=rose via brand tokens.

### `src/components/mtq/RedeemSimulator.tsx` (audit panel RECONCILED)
- Honest Audit sub-panel now emerald ("Honest Audit · §12.2 vs §3.4.2 —
  RECONCILED"), not rose ("contradiction").
- Narrative reads: "v1.2 reconciles this: §3.4.2 is the canonical settlement
  price; §12.2's NAV-per-token is retained as an informational book-value
  metric only."
- Δ (§12.2 − §3.4.2) cell rendered in emerald with "would drain buffer if paid
  — NOT paid" caption.

### `src/components/mtq/RiskStateMachine.tsx`
- Governance hierarchy now uses `GOVERNANCE_TIERS` from brand.ts:
    - constitutional → gold #e8b964 + `0 0 24px rgba(232,185,100,0.35)` glow
    - monetary       → emerald #3ddc97 + `0 0 24px rgba(61,220,151,0.30)` glow
    - risk           → amber #ffb84d + `0 0 24px rgba(255,184,77,0.30)` glow
    - emergency      → rose #ff5d73 + `0 0 24px rgba(255,93,115,0.35)` glow
- Tier cards use the matching tier color for: border, background, icon color,
  authority/timelock mono text, and tier label (e.g. "Constitutional · 7/7 ·
  90d").
- Brand crests image (`/brand/mtqs-governance-crests.png`) renders above the
  tier cards inside a `.mtqs-glow` rounded frame.
- Risk state machine dots use `STATUS_COLORS[status].color` for the dot fill
  and active glow.

### `src/components/mtq/ConstitutionalSeparation.tsx`
- `reserveTone` now sourced from `STATUS_COLORS[status].color` (brand palette:
  no orange).

### `src/components/mtq/LiveMonetaryState.tsx`
- Reserve NAV big number now uses `mtqs-gold-text` gradient (was plain
  foreground).
- "∞ — fully reserved" tails now use `text-mtqs-emerald/80` instead of Tailwind
  `text-emerald-300/80`.
- RR stripe classification no longer references "orange" (brand has no orange).

### `src/components/mtq/MacroEngine.tsx`
- "Simulated Pilot Macro Signals" panel now uses `border-mtqs-amber/30` (was
  `variant="rose"` + `border-amber-400/30`).
- Eyebrow uses `text-mtqs-amber`.

### `src/components/mtq/format.ts`
- `rrColor` now returns brand tokens: `text-mtqs-emerald` / `text-mtqs-amber` /
  `text-mtqs-rose` (was Tailwind emerald-400 / amber-400 / orange-400 / rose-400;
  brand has no orange).
- `lcrColor` similarly uses brand tokens.
- `statusColor` returns brand tokens (`bg-mtqs-emerald/10`,
  `border-mtqs-emerald/40`, etc.) — no more Tailwind orange for DEFENSIVE
  (brand STATUS_COLORS.DEFENSIVE = #ff8ea3 light rose).

### `src/app/layout.tsx`
- Untouched (already loads Cormorant Garamond display font, sets `<html
  className="dark">`, references brand favicon + emblem).

### `src/app/globals.css`
- Untouched (brand tokens + bespoke utilities already in place from B2–B7).

### `/public/brand/favicon.png`
- Added (copy of `mtqs-emblem.png`) to silence a one-time `/brand/favicon.png`
  404 from Next.js metadata icon fallback.

## Verification
- `bun run lint` — exit 0, no errors / warnings.
- Dev server compiles + renders the page (`GET / 200 in ~40ms`), no fatal
  errors in `dev.log`.
- `/api/metrics` returns the expected contract:
    - `reconciliation[0].severity === "fixed"` (F1 — §12.2 vs §3.4.2
      contradiction, RESOLVED by adopting §3.4.2 as canonical).
    - `reconciliation[1].severity === "fixed"` (F2 — genesis issuer
      concentration breach, RESOLVED by admitting USDP/Paxos + USDT/Tether +
      XAUT/Tether and running the §5.6 multi-issuer optimizer).
    - `reconciliation[2].severity === "informational"` (F3 — VIX/DXY
      simulated).
    - `reconciliation[3].severity === "informational"` (F4 — Sharia not
      certified).
    - `concentration` reports all 3 issuers at `status === "ok"`
      (CIRCLE 24.99% / PAXOS 24.16% / TETHER 24.16%) — every issuer ≤ 25%
      warn threshold.
    - `perIssuer` returned (USDC / USDP / USDT / EURC / PAXG / XAUT net USD).
    - `redemptionPolicy.canonical` returned
      ("§3.4.2 — Redeem at P_MTQ (index price, arbitrage-safe)").
- SSR HTML contains: `MTQΣ`, `The Global Purchasing Power Unit`,
  `Designed for Sharia review`, all 4 brand principles (Honest / Sovereign /
  Collateralized / Calm), and references `/brand/mtqs-emblem.png` +
  `/brand/mtqs-logo-mark.png` via next/image.
- Tailwind v4 generates all `text-mtqs-*` / `bg-mtqs-*` / `border-mtqs-*`
  utilities (with opacity shorthand) from the `@theme` color tokens defined in
  globals.css.

## Did NOT touch (per instructions)
- Any `src/app/api/*` route.
- Any `src/lib/mtq/*` file (engine / blueprint / contracts / fx / pilot-state /
  registry / oracle / brand).
- `src/app/layout.tsx` and `src/app/globals.css` (already brand-correct from
  B2–B7).

## Known notes
- Both honest findings (F1 + F2) are surfaced as `severity === "fixed"` and
  rendered with emerald severity badges; the UI no longer claims the
  concentration breach is "outstanding".
- F3 (VIX/DXY simulated) + F4 (Sharia not certified) are surfaced as
  `informational` with neutral badges.
- The brand pattern background (`.mtqs-pattern-bg`) appears subtly behind the
  Honest Status section only (very low opacity ~6% via `mix-blend-mode:
  screen`).
- Mobile-first responsive preserved (390×844 viewport safe — verified the
  grids all collapse to single column, ticker scrolls horizontally).
- Sticky footer preserved (`min-h-screen flex flex-col` root + `mt-auto`
  footer).
