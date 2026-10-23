#!/usr/bin/env python3
"""
REBRAND-NEUTRAL: Remove all USD-peg language from MTQΣ user-facing UI.

Applies targeted, explicit string replacements across ALL .tsx files in:
  src/components/mtq/*.tsx
  src/components/mtq/sections/*.tsx

Rules followed (per task REBRAND-NEUTRAL):
  - "MTQ Price" / "MTQ price" (label)          → "Reference Value"
  - "MTQ$"                                      → "MTQΣ"
  - "$" prefix on MTQ reference values          → remove (show plain number)
  - "MTQ Price = $"                             → "Reference Value: "
  - "GFB Index" (user-facing label/heading)    → "Adaptive Reference Basket" (primary)
                                                 or "Reference Index" (compact / chart)
  - "GFB" in code/technical comments            → keep
  - "Strategic Prior" (for 27/20/9/8/5/5/26)    → keep (already correct)
  - "Current Weights"                          → "Current Live Weights"
  - USD values for NAV / liability / RR         → keep, but add "(USD reporting)" tag
  - "100% Halal" / "Fatwa-ready"               → "Designed for Sharia review"
  - "guaranteed"                                → "designed for" (except in UNSUPPORTED_CLAIMS table
                                                 where it's an honest disclosure)
  - "protect the peg"                          → "protect the reference value"
  - Variable names (mtqPrice, gfbIndex, etc.)  → keep (don't touch)
  - Code comments referencing GFB              → keep (technical)
  - Imports / function signatures               → don't touch
  - The brand tagline "The Global Purchasing Power Unit" → keep
  - "Candidate for public testing — NOT production-authorized" → keep
  - "Closed-Loop Monetary Architecture"        → keep
"""

import sys
from pathlib import Path

ROOT = Path("/home/z/my-project/src/components/mtq")

# Each entry: (relative_path, old_string, new_string)
# Order within a file matters when strings overlap; replacements are applied
# sequentially and counted. We use exact (case-sensitive) string matching.
REPLACEMENTS = [
    # ============================================================
    # Header.tsx — live ticker MTQ value: remove "$" prefix
    # ============================================================
    ("Header.tsx", '<TickNumber value={snapshot.mtqPrice} format={(n) => `$${fmtFixed(n, 4)}`} className={toneByPrice === "emerald" ? "text-mtqs-emerald" : "text-mtqs-rose"} />',
     '<TickNumber value={snapshot.mtqPrice} format={(n) => fmtFixed(n, 4)} className={toneByPrice === "emerald" ? "text-mtqs-emerald" : "text-mtqs-rose"} />'),

    # ============================================================
    # HomeSection.tsx
    # ============================================================
    # "What is MTQΣ?" 3-card grid: card 1 title
    ("sections/HomeSection.tsx",
     '    title: "GFB Index",\n    body:\n      "A 7-component Strategic Prior basket',
     '    title: "Adaptive Reference Basket",\n    body:\n      "A 7-component Strategic Prior basket'),
    # Card 2 body: "reference price equals the GFB Index" → "reference value equals the Adaptive Reference Basket"
    ("sections/HomeSection.tsx",
     '"An ERC-20 (and SPL) unit whose reference price equals the GFB Index. Minted against, and redeemed into, the reserve portfolio — never fiat-printed, never algorithmic."',
     '"An ERC-20 (and SPL) unit whose reference value equals the Adaptive Reference Basket. Minted against, and redeemed into, the reserve portfolio — never fiat-printed, never algorithmic."'),
    # Live stats band: GFB Index label → Reference Index
    ("sections/HomeSection.tsx",
     '{ label: "GFB Index", value: snapshot ? fmtFixed(snapshot.gfbIndex, 4) : null, tone: "text-mtqs-gold-light" },',
     '{ label: "Reference Index", value: snapshot ? fmtFixed(snapshot.gfbIndex, 4) : null, tone: "text-mtqs-gold-light" },'),
    # Live stats band: MTQ Price label + $ removal
    ("sections/HomeSection.tsx",
     '{ label: "MTQ Price", value: snapshot ? `$${fmtFixed(snapshot.mtqPrice, 4)}` : null, tone: snapshot?.priceInBand ? "text-mtqs-emerald" : "text-mtqs-rose" },',
     '{ label: "Reference Value", value: snapshot ? fmtFixed(snapshot.mtqPrice, 4) : null, tone: snapshot?.priceInBand ? "text-mtqs-emerald" : "text-mtqs-rose" },'),
    # Gold-in-both explanation paragraph
    ("sections/HomeSection.tsx",
     'Gold is in <span className="text-mtqs-gold font-medium">BOTH</span> the GFB Index (26% strategic prior,\n          20-32% admissibility envelope per §8.1)',
     'Gold is in <span className="text-mtqs-gold font-medium">BOTH</span> the Adaptive Reference Basket (26% Strategic Prior,\n          20-32% admissibility envelope per §8.1)'),
    # Constitutional Separation intro paragraph
    ("sections/HomeSection.tsx",
     'The GFB Index defines what one MTQΣ is intended to represent. The reserve\n              portfolio exists to collateralize that obligation. The two are constitutionally',
     'The Adaptive Reference Basket defines what one MTQΣ is intended to represent. The reserve\n              portfolio exists to collateralize that obligation. The two are constitutionally'),

    # ============================================================
    # InvestorSection.tsx — Protocol Health cards
    # ============================================================
    ("sections/InvestorSection.tsx",
     'label: "GFB Index",\n      value: snapshot ? fmtFixed(snapshot.gfbIndex, 4) : null,\n      sub: snapshot ? `Price $${fmtFixed(snapshot.mtqPrice, 4)}` : "polling…",',
     'label: "Reference Index",\n      value: snapshot ? fmtFixed(snapshot.gfbIndex, 4) : null,\n      sub: snapshot ? `Ref Value ${fmtFixed(snapshot.mtqPrice, 4)}` : "polling…",'),
    # Reserve NAV card: clarify USD reporting on the liability sub-label
    ("sections/InvestorSection.tsx",
     'label: "Reserve NAV",\n      value: snapshot ? fmtUsdCompact(snapshot.nav) : null,\n      sub: snapshot ? `Liability ${fmtUsdCompact(snapshot.liability)}` : "polling…",',
     'label: "Reserve NAV (USD reporting)",\n      value: snapshot ? fmtUsdCompact(snapshot.nav) : null,\n      sub: snapshot ? `Liability (USD reporting) ${fmtUsdCompact(snapshot.liability)}` : "polling…",'),

    # ============================================================
    # DashboardSection.tsx
    # ============================================================
    # Section 1 hero: "The GFB Index defines..."
    ("sections/DashboardSection.tsx",
     'The GFB Index defines what one MTQΣ is intended to represent. The reserve\n                portfolio exists to collateralize that obligation. Mint and redeem flows\n                arbitrage back to the price, with the GFB Index as the immutable reference.',
     'The Adaptive Reference Basket defines what one MTQΣ is intended to represent. The reserve\n                portfolio exists to collateralize that obligation. Mint and redeem flows\n                arbitrage back to the price, with the Adaptive Reference Basket as the immutable reference.'),
    # Closed-Loop Architecture Map intro paragraph
    ("sections/DashboardSection.tsx",
     'The GFB Index feeds the MTQ Reference Price; the price multiplied by circulating\n                supply gives the protocol liability. The Reserve NAV backs that liability at the\n                Reserve Ratio. Mint and Redeem flows arbitrage back to the price, with the GFB\n                Index as the immutable reference. Live values ride along each edge.',
     'The Adaptive Reference Basket feeds the Reference Value; the value multiplied by circulating\n                supply gives the protocol liability. The Reserve NAV backs that liability at the\n                Reserve Ratio. Mint and Redeem flows arbitrage back to the value, with the Adaptive\n                Reference Basket as the immutable reference. Live values ride along each edge.'),
    # Section 16 title: "GFB Basket Reference" → "Adaptive Reference Basket"
    ("sections/DashboardSection.tsx",
     '      {/* ===== 16 — GFB Basket ===== */}\n      <Section id="basket" eyebrow="§2" title="GFB Basket Reference">',
     '      {/* ===== 16 — GFB Basket ===== */}\n      <Section id="basket" eyebrow="§2" title="Adaptive Reference Basket">'),

    # ============================================================
    # MintSimulator.tsx
    # ============================================================
    ('MintSimulator.tsx',
     '<Row label="MTQ price" value={`$${fmtFixed(result.mtqPrice, 4)}`} tone="gold" />',
     '<Row label="Reference Value" value={fmtFixed(result.mtqPrice, 4)} tone="gold" />'),

    # ============================================================
    # RedeemSimulator.tsx
    # ============================================================
    ('RedeemSimulator.tsx',
     '<Row label="MTQ price" value={`$${fmtFixed(result.mtqPrice, 4)}`} tone="gold" />',
     '<Row label="Reference Value" value={fmtFixed(result.mtqPrice, 4)} tone="gold" />'),

    # ============================================================
    # ClosedLoopMap.tsx
    # ============================================================
    # NODES labels (user-facing SVG text)
    ('ClosedLoopMap.tsx',
     'gfb:   { id: "gfb",   label: "GFB Index",     x: 80,  y: 200, accent: "#e8b964", glyph: "G" },\n  price: { id: "price", label: "MTQ Price",     x: 320, y: 80,  accent: "#3ddc97", glyph: "P" },',
     'gfb:   { id: "gfb",   label: "Reference Index",     x: 80,  y: 200, accent: "#e8b964", glyph: "G" },\n  price: { id: "price", label: "Reference Value",     x: 320, y: 80,  accent: "#3ddc97", glyph: "P" },'),
    # edge value: remove "$" from the displayed MTQ value
    ('ClosedLoopMap.tsx',
     'if (label === "P_MTQ = GFB_t") return `$${fmtFixed(snapshot.mtqPrice, 4)}`;',
     'if (label === "P_MTQ = GFB_t") return fmtFixed(snapshot.mtqPrice, 4);'),
    # aria-label: neutralize the GFB / MTQ Price language
    ('ClosedLoopMap.tsx',
     'aria-label="Closed-loop architecture map: GFB Index feeds MTQ Price; Price feeds Liability; Liability and Reserve NAV determine the Reserve Ratio; the Mint/Redeem flow feeds back to price, with the GFB Index as the reference."',
     'aria-label="Closed-loop architecture map: Adaptive Reference Basket feeds Reference Value; Reference Value feeds Liability; Liability and Reserve NAV determine the Reserve Ratio; the Mint/Redeem flow feeds back to value, with the Adaptive Reference Basket as the reference."'),

    # ============================================================
    # LiveMonetaryState.tsx
    # ============================================================
    # GFB Index tile eyebrow + /USD caption
    ('LiveMonetaryState.tsx',
     '<MetricTile eyebrow="GFB Index (§2)" stripe="gold">\n            <div className="flex items-baseline gap-2">\n              <TickNumber\n                value={snapshot.gfbIndex}\n                format={(n) => fmtFixed(n, 4)}\n                className="text-3xl font-semibold mtqs-gold-text"\n              />\n              <span className="text-xs text-white/55 font-mono">/USD</span>',
     '<MetricTile eyebrow="Reference Index (§2)" stripe="gold">\n            <div className="flex items-baseline gap-2">\n              <TickNumber\n                value={snapshot.gfbIndex}\n                format={(n) => fmtFixed(n, 4)}\n                className="text-3xl font-semibold mtqs-gold-text"\n              />\n              <span className="text-xs text-white/55 font-mono" title="USD is used here only as an external reporting/valuation numeraire. It does not define the MTQΣ monetary unit and does not constitute a USD peg.">·USD reporting</span>'),
    # MTQ Reference Price tile eyebrow + $ removal + safety band USD reporting tag
    ('LiveMonetaryState.tsx',
     '<MetricTile eyebrow="MTQ Reference Price (§3)" stripe={snapshot.priceInBand ? "emerald" : "rose"}>\n            <div className="flex items-baseline gap-2">\n              <TickNumber\n                value={snapshot.mtqPrice}\n                format={(n) => `$${fmtFixed(n, 4)}`}\n                className={`text-3xl font-semibold ${snapshot.priceInBand ? "text-mtqs-emerald" : "text-mtqs-rose"}`}\n              />',
     '<MetricTile eyebrow="Reference Value (§3)" stripe={snapshot.priceInBand ? "emerald" : "rose"}>\n            <div className="flex items-baseline gap-2">\n              <TickNumber\n                value={snapshot.mtqPrice}\n                format={(n) => fmtFixed(n, 4)}\n                className={`text-3xl font-semibold ${snapshot.priceInBand ? "text-mtqs-emerald" : "text-mtqs-rose"}`}\n              />'),
    # Safety band USD reporting tag
    ('LiveMonetaryState.tsx',
     'Safety band {PRICE_SAFETY_LOWER.toFixed(2)}–{PRICE_SAFETY_UPPER.toFixed(2)} USD',
     'Safety band {PRICE_SAFETY_LOWER.toFixed(2)}–{PRICE_SAFETY_UPPER.toFixed(2)} (USD reporting)'),
    # Reserve NAV tile eyebrow — label as USD reporting
    ('LiveMonetaryState.tsx',
     '<MetricTile eyebrow="Reserve NAV (§4)" stripe="gold">',
     '<MetricTile eyebrow="Reserve NAV · USD reporting (§4)" stripe="gold">'),

    # ============================================================
    # BasketValueDisplay.tsx
    # ============================================================
    # USD per 1 MTQΣ → External USD Reporting Value per 1 MTQΣ (with tooltip)
    ('BasketValueDisplay.tsx',
     '<span className="text-sm text-white/55">USD per 1 MTQΣ</span>',
     '<span className="text-sm text-white/55" title="USD is used here only as an external reporting/valuation numeraire. It does not define the MTQΣ monetary unit and does not constitute a USD peg.">External USD Reporting Value per 1 MTQΣ</span>'),
    # GFB Index: label inside the main value card
    ('BasketValueDisplay.tsx',
     '<div className="mt-2 text-xs text-white/40">GFB Index: {snapshot?.gfbIndex?.toFixed(4) ?? "—"}</div>',
     '<div className="mt-2 text-xs text-white/40">Reference Index: {snapshot?.gfbIndex?.toFixed(4) ?? "—"}</div>'),
    # Honest note: "GFB Index" → "Adaptive Reference Basket"
    ('BasketValueDisplay.tsx',
     '1 MTQΣ represents one unit of the GFB Index — a chain-linked 7-component basket.\n          The values above show what 1 MTQΣ is worth in each component currency at live FX rates.\n          Gold (PAXG + XAUT) is a first-class index component (26% Strategic Prior), not just reserve collateral.',
     '1 MTQΣ represents one unit of the Adaptive Reference Basket — a chain-linked 7-component reference.\n          The values above show what 1 MTQΣ is worth in each component currency at live FX rates.\n          Gold (PAXG + XAUT) is a first-class index component (26% Strategic Prior), not just reserve collateral.'),

    # ============================================================
    # GfbChart.tsx — chart label
    # ============================================================
    ('GfbChart.tsx',
     '<div className="text-[0.6rem] text-white/55 uppercase tracking-wider">GFB Index</div>',
     '<div className="text-[0.6rem] text-white/55 uppercase tracking-wider">Reference Index</div>'),

    # ============================================================
    # GfbBasket.tsx — GoldInReserve section
    # ============================================================
    # Section heading: GFB Index → Adaptive Reference Basket
    ('GfbBasket.tsx',
     '§3.2 + §14.1 · Gold is in BOTH the GFB Index AND the Reserve (v1.0)',
     '§3.2 + §14.1 · Gold is in BOTH the Adaptive Reference Basket AND the Reserve (v1.0)'),
    # Body paragraph: "The GFB Index (above) is a 7-component basket..."
    ('GfbBasket.tsx',
     'The GFB Index (above) is a 7-component basket that defines the VALUE of MTQΣ — Gold is\n        <span className="text-mtqs-gold font-medium"> a first-class index component</span> (26% strategic\n        prior, 20-32% admissibility envelope).',
     'The Adaptive Reference Basket (above) is a 7-component basket that defines the VALUE of MTQΣ — Gold is\n        <span className="text-mtqs-gold font-medium"> a first-class index component</span> (26% Strategic\n        Prior, 20-32% admissibility envelope).'),

    # ============================================================
    # ConstitutionalSeparation.tsx
    # ============================================================
    # aria-label: A GFB Index → A Reference Index
    ('ConstitutionalSeparation.tsx',
     'aria-label="Constitutional Separation diagram: three concentric rings labeled A GFB Index, B MTQΣ Token, C Reserve, with the active ring pulsing by protocol status."',
     'aria-label="Constitutional Separation diagram: three concentric rings labeled A Reference Index, B MTQΣ Token, C Reserve, with the active ring pulsing by protocol status."'),
    # SVG text label "A · GFB INDEX"
    ('ConstitutionalSeparation.tsx',
     'A · GFB INDEX',
     'A · REFERENCE INDEX'),
    # B-ring MTQ value: remove "$"
    ('ConstitutionalSeparation.tsx',
     '<text x="36" y="282" textAnchor="middle" fontSize="11" fill="#3ddc97" fontFamily="var(--font-geist-mono), monospace" fontWeight="600">\n            {snapshot ? `$${fmtFixed(snapshot.mtqPrice, 4)}` : "—"}\n          </text>',
     '<text x="36" y="282" textAnchor="middle" fontSize="11" fill="#3ddc97" fontFamily="var(--font-geist-mono), monospace" fontWeight="600">\n            {snapshot ? fmtFixed(snapshot.mtqPrice, 4) : "—"}\n          </text>'),

    # ============================================================
    # PriceEvents.tsx — "GFB Index" in copy
    # ============================================================
    ('PriceEvents.tsx',
     '<div className="text-sm font-semibold text-white/90">Price Events Log (§3.6)</div>\n          <div className="text-[0.7rem] text-white/55">\n            PriceUpdated events emitted when GFB changes ≥ {(PRICE_EVENT_THRESHOLD * 100).toFixed(1)}% · last {events.length} of 20\n          </div>',
     '<div className="text-sm font-semibold text-white/90">Reference Value Events Log (§3.6)</div>\n          <div className="text-[0.7rem] text-white/55">\n            Reference Value updates emitted when the Reference Index changes ≥ {(PRICE_EVENT_THRESHOLD * 100).toFixed(1)}% · last {events.length} of 20\n          </div>'),
    # Empty-state copy
    ('PriceEvents.tsx',
     'No price events yet. The GFB Index has not moved more than {(PRICE_EVENT_THRESHOLD * 100).toFixed(1)}% between ticks since the pilot started.',
     'No reference events yet. The Adaptive Reference Basket has not moved more than {(PRICE_EVENT_THRESHOLD * 100).toFixed(1)}% between ticks since the pilot started.'),

    # ============================================================
    # TrialLog.tsx — column header + value
    # ============================================================
    ('TrialLog.tsx',
     '<th className="text-right px-3 py-2 font-medium">Price</th>',
     '<th className="text-right px-3 py-2 font-medium">Ref Value</th>'),
    ('TrialLog.tsx',
     '<td className="px-3 py-2 text-right font-mono text-mtqs-gold/80">${fmtFixed(t.mtqPrice, 4)}</td>',
     '<td className="px-3 py-2 text-right font-mono text-mtqs-gold/80">{fmtFixed(t.mtqPrice, 4)}</td>'),
    # NAV column header — clarify USD reporting
    ('TrialLog.tsx',
     '<th className="text-right px-3 py-2 font-medium">NAV</th>\n                  <th className="text-right px-3 py-2 font-medium">RR</th>',
     '<th className="text-right px-3 py-2 font-medium">NAV (USD)</th>\n                  <th className="text-right px-3 py-2 font-medium">RR</th>'),

    # ============================================================
    # SystemHealth.tsx — chain-index subsystem label
    # ============================================================
    # User-facing secondary line: "GFB ... · P_MTQ ..." → "Ref Idx ... · Ref Val ..."
    ('SystemHealth.tsx',
     'secondary: `GFB ${fmtFixed(snap?.gfbIndex ?? null, 6)} · P_MTQ ${fmtFixed(snap?.mtqPrice ?? null, 6)}`,\n      tertiary: `peg ${snap?.priceInBand ? "in band" : "BROKEN"}`,',
     'secondary: `Ref Idx ${fmtFixed(snap?.gfbIndex ?? null, 6)} · Ref Val ${fmtFixed(snap?.mtqPrice ?? null, 6)}`,\n      tertiary: `ref ${snap?.priceInBand ? "in band" : "breaker"}`,'),

    # ============================================================
    # PitchSection.tsx
    # ============================================================
    # Solution panel: "The GFB Index fixes a basket of five currencies..."
    ('sections/PitchSection.tsx',
     '"The GFB Index fixes a basket of five currencies (USD 38.9% · EUR 27.8% · GBP 16.69% · JPY 11.11% · CNY 5.5%). One MTQΣ is intended to represent that basket\'s purchasing power."',
     '"The Adaptive Reference Basket is a chain-linked reference of seven components (USD 27% · EUR 20% · JPY 9% · GBP 8% · CNY 5% · CHF 5% · Gold 26%). One MTQΣ is intended to represent that basket\'s purchasing power."'),
    # Solution panel: "arbitrage back to the index price" → "...back to the reference value"
    ('sections/PitchSection.tsx',
     '"An audited reserve portfolio (stablecoins + tokenized gold) collateralizes every MTQΣ at a 110% Reserve Ratio target. Mint and redeem flows arbitrage back to the index price."',
     '"An audited reserve portfolio (stablecoins + tokenized gold) collateralizes every MTQΣ at a 110% Reserve Ratio target. Mint and redeem flows arbitrage back to the reference value."'),
    # Solution panel: "protect the peg" → "protect the reference value"
    ('sections/PitchSection.tsx',
     '"A 6-state risk machine, a 4-tier governance hierarchy, staged geopolitical eject, and a dynamic buffer protect the peg under stress. Every parameter is published and timelocked."',
     '"A 6-state risk machine, a 4-tier governance hierarchy, staged geopolitical eject, and a dynamic buffer protect the reference value under stress. Every parameter is published and timelocked."'),
    # Traction panel: "GFB index, MTQ price, NAV, RR, LCR"
    ('sections/PitchSection.tsx',
     '"Live pilot: every mint/redeem is logged to SQLite with full input/output, GFB index, MTQ price, NAV, RR, LCR, and pass/fail reason — full audit trail via /api/trials/export."',
     '"Live pilot: every mint/redeem is logged to SQLite with full input/output, Reference Index, Reference Value, NAV (USD reporting), RR, LCR, and pass/fail reason — full audit trail via /api/trials/export."'),

    # ============================================================
    # DocsSection.tsx
    # ============================================================
    # H3 heading: "GFB Index — 7-Component Strategic Prior"
    ('sections/DocsSection.tsx',
     '<h3 className="mt-2 text-base font-semibold text-white">GFB Index — 7-Component Strategic Prior</h3>',
     '<h3 className="mt-2 text-base font-semibold text-white">Adaptive Reference Basket — 7-Component Strategic Prior</h3>'),

    # ============================================================
    # SecuritySection.tsx — replace "100% Halal / Fatwa-ready" quote
    # (Strict rule: NEVER write "100% Halal". Rephrase the disclosure
    # so it still names what was removed without using the literal phrase.)
    # ============================================================
    ('sections/SecuritySection.tsx',
     "The earlier draft&apos;s claim &ldquo;100% Halal / Fatwa-ready&rdquo; was removed (§15.1) and\n                    replaced with &ldquo;designed for Sharia review.&rdquo;",
     "The earlier draft&apos;s claim of automatic Sharia compliance &ldquo;Halal / fatwa-ready&rdquo; was removed (§15.1) and\n                    replaced with &ldquo;designed for Sharia review.&rdquo;"),

    # ============================================================
    # HonestStatus5Level.tsx — Sharia gate evidence: "external fatwa" → "external Sharia review"
    # ============================================================
    ('HonestStatus5Level.tsx',
     'evidence: "NOT DONE — external fatwa not yet issued",',
     'evidence: "NOT DONE — external Sharia review not yet issued",'),

    # ============================================================
    # ProductionReadinessDashboard.tsx — "independent fatwa" → "independent Sharia review"
    # ============================================================
    ('ProductionReadinessDashboard.tsx',
     'evidence: "External dependency — independent fatwa from a recognised Sharia board required",',
     'evidence: "External dependency — independent Sharia review from a recognised Sharia board required",'),

    # ============================================================
    # MintSimulator.tsx — toast description: add "ref val" prefix
    # ============================================================
    ('MintSimulator.tsx',
     'description: `${fmtUsd(amt)} USDC → ${fmtUsd(data.mint.netUsd)} net @ ${fmtFixed(data.mint.mtqPrice, 4)}`,',
     'description: `${fmtUsd(amt)} USDC → ${fmtUsd(data.mint.netUsd)} net @ ref val ${fmtFixed(data.mint.mtqPrice, 4)}`,'),
]


def main() -> int:
    files_modified = 0
    total_replacements = 0
    per_file_counts: dict[str, int] = {}

    # Group replacements by file so we read/write each file only once.
    by_file: dict[str, list[tuple[str, str]]] = {}
    for rel, old, new in REPLACEMENTS:
        by_file.setdefault(rel, []).append((old, new))

    for rel, edits in by_file.items():
        path = ROOT / rel
        if not path.exists():
            print(f"  ! MISSING: {path}")
            continue
        text = path.read_text(encoding="utf-8")
        file_count = 0
        for old, new in edits:
            if old in text:
                # Count occurrences (only count first match if there are multiple
                # but our edits are unique enough — replace_all=True behaviour
                # only when needed).
                occurrences = text.count(old)
                text = text.replace(old, new)
                file_count += occurrences
            else:
                print(f"  ! NOT FOUND in {rel}:\n     {old[:120]!r}")
        if file_count:
            path.write_text(text, encoding="utf-8")
            files_modified += 1
            total_replacements += file_count
            per_file_counts[rel] = file_count
            print(f"  ✓ {rel}: {file_count} replacement(s) applied")

    print()
    print("=" * 64)
    print(f"Files modified:        {files_modified}")
    print(f"Total replacements:     {total_replacements}")
    print("=" * 64)
    for rel, n in sorted(per_file_counts.items()):
        print(f"  {rel:50s}  {n:3d}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
