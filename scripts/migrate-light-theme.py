#!/usr/bin/env python3
"""
MTQΣ — Light-theme migration batch replace.
Applies the global replacement rules to every .tsx file in:
  - src/components/mtq/*.tsx
  - src/components/mtq/sections/*.tsx
  - src/app/page.tsx

Rules are applied in order (longest/most-specific patterns first) to avoid
partial-match collisions. Uses literal string replacement (no regex) so
all special characters in the search strings are matched verbatim.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path("/home/z/my-project")

TARGETS = (
    list((ROOT / "src/components/mtq").glob("*.tsx"))
    + list((ROOT / "src/components/mtq/sections").glob("*.tsx"))
    + [ROOT / "src/app/page.tsx"]
)

# Order: longer / more-specific patterns first so shorter patterns do not
# partially overlap them. Each tuple is (search, replace) — both literal.
REPLACEMENTS: list[tuple[str, str]] = [
    # ── Background hex colors (with opacity first, then solid) ──────────
    ("bg-[#080a0c]/95", "bg-background/95"),
    ("bg-[#080a0c]/85", "bg-background/85"),
    ("bg-[#080a0c]/72", "bg-background/72"),
    ("bg-[#0a0e0d]/95", "bg-card/95"),
    ("bg-[#0a0e0d]/92", "bg-card/92"),
    ("bg-[#0a0e0d]/90", "bg-card/90"),
    ("bg-[#080a0c]", "bg-background"),
    ("bg-[#0a0e0d]", "bg-card"),
    ("bg-[#0b0f0e]", "bg-card"),
    ("bg-[#11161a]", "bg-muted"),
    ("bg-[#1a2026]", "bg-muted"),
    ("bg-[#050709]", "bg-background"),

    # ── White backgrounds with opacity (longest patterns first) ────────
    ("bg-white/[0.015]", "bg-black/[0.015]"),
    ("bg-white/[0.01]", "bg-black/[0.01]"),
    ("bg-white/[0.02]", "bg-black/[0.02]"),
    ("bg-white/[0.03]", "bg-black/[0.03]"),
    ("bg-white/[0.04]", "bg-black/[0.04]"),
    ("bg-white/[0.05]", "bg-black/[0.05]"),
    ("bg-white/[0.06]", "bg-black/[0.06]"),
    ("bg-white/[0.08]", "bg-black/[0.08]"),
    ("bg-white/[0.1]", "bg-black/[0.1]"),
    ("bg-white/10", "bg-black/10"),
    ("bg-white/5", "bg-black/5"),

    # ── White borders with opacity (longest first) ─────────────────────
    ("border-white/[0.12]", "border-border"),
    ("border-white/[0.08]", "border-border"),
    ("border-white/[0.07]", "border-border"),
    ("border-white/[0.06]", "border-border"),
    ("border-white/[0.05]", "border-border"),
    ("border-white/[0.04]", "border-border"),
    ("border-white/[0.1]", "border-black/[0.1]"),
    ("border-white/10", "border-border"),
    ("border-white/20", "border-black/[0.2]"),

    # ── text-white with opacity (longest first; bare text-white last) ──
    ("text-white/95", "text-foreground"),
    ("text-white/90", "text-foreground/90"),
    ("text-white/80", "text-muted-foreground"),
    ("text-white/70", "text-muted-foreground"),
    ("text-white/60", "text-muted-foreground"),
    ("text-white/50", "text-muted-foreground"),
    ("text-white", "text-foreground"),

    # ── text-foreground with opacity (per spec; /90 kept) ───────────────
    ("text-foreground/95", "text-foreground"),
    ("text-foreground/85", "text-foreground"),
    ("text-foreground/80", "text-muted-foreground"),
    ("text-foreground/75", "text-muted-foreground"),
    ("text-foreground/70", "text-muted-foreground"),
    ("text-foreground/60", "text-muted-foreground"),

    # ── text-muted-foreground with opacity → collapse (already light) ──
    ("text-muted-foreground/95", "text-muted-foreground"),
    ("text-muted-foreground/90", "text-muted-foreground"),
    ("text-muted-foreground/85", "text-muted-foreground"),
    ("text-muted-foreground/80", "text-muted-foreground"),
    ("text-muted-foreground/75", "text-muted-foreground"),
    ("text-muted-foreground/70", "text-muted-foreground"),
    ("text-muted-foreground/65", "text-muted-foreground"),
    ("text-muted-foreground/60", "text-muted-foreground"),
    ("text-muted-foreground/55", "text-muted-foreground"),
    ("text-muted-foreground/50", "text-muted-foreground"),
    ("text-muted-foreground/40", "text-muted-foreground"),
    ("text-muted-foreground/30", "text-muted-foreground"),

    # ── MTQ brand text hex colors (with opacity first) ─────────────────
    ("text-[#f5d27a]/90", "text-mtqs-gold"),
    ("text-[#f5d27a]/80", "text-mtqs-gold/80"),
    ("text-[#f5d27a]/75", "text-mtqs-gold/75"),
    ("text-[#f5d27a]/70", "text-mtqs-gold/70"),
    ("text-[#f5d27a]", "text-mtqs-gold"),

    ("text-[#6ff0c0]/85", "text-mtqs-emerald/85"),
    ("text-[#6ff0c0]", "text-mtqs-emerald"),

    ("text-[#ff8ea3]/90", "text-mtqs-rose/90"),
    ("text-[#ff8ea3]/80", "text-mtqs-rose/80"),
    ("text-[#ff8ea3]", "text-mtqs-rose"),

    ("text-[#ffd07a]", "text-mtqs-amber"),
    ("text-[#3ddc97]", "text-mtqs-emerald"),
    ("text-[#ff5d73]", "text-mtqs-rose"),

    # ── Tailwind amber-* text colors (longest first) ────────────────────
    ("text-amber-200/90", "text-mtqs-gold"),
    ("text-amber-200/80", "text-mtqs-gold/80"),
    ("text-amber-200/70", "text-mtqs-gold/70"),
    ("text-amber-200", "text-mtqs-gold"),
    ("text-amber-300", "text-mtqs-amber"),
    ("text-amber-400", "text-mtqs-amber"),
    ("text-amber-100", "text-mtqs-gold"),

    # ── Tailwind emerald-* text colors ─────────────────────────────────
    ("text-emerald-200", "text-mtqs-emerald"),
    ("text-emerald-300", "text-mtqs-emerald"),
    ("text-emerald-400", "text-mtqs-emerald"),

    # ── Tailwind rose-* text colors ────────────────────────────────────
    ("text-rose-100", "text-mtqs-rose"),
    ("text-rose-200", "text-mtqs-rose"),
    ("text-rose-300", "text-mtqs-rose"),
    ("text-rose-400", "text-mtqs-rose"),

    # ── Background brand color tints (longest first) ───────────────────
    ("bg-amber-400/50", "bg-mtqs-amber/25"),
    ("bg-amber-400/20", "bg-mtqs-amber/10"),
    ("bg-amber-400/15", "bg-mtqs-amber/10"),
    ("bg-amber-400", "bg-mtqs-amber/15"),
    ("bg-amber-500/[0.04]", "bg-mtqs-amber/5"),
    ("bg-amber-500/[0.06]", "bg-mtqs-amber/5"),
    ("bg-amber-500", "bg-mtqs-amber"),
    ("bg-amber-300/85", "bg-mtqs-amber/25"),
    ("bg-amber-300/70", "bg-mtqs-amber/20"),
    ("bg-amber-300/40", "bg-mtqs-amber/10"),
    ("bg-amber-300", "bg-mtqs-amber/15"),

    ("bg-emerald-400/20", "bg-mtqs-emerald/10"),
    ("bg-emerald-400", "bg-mtqs-emerald/15"),
    ("bg-emerald-500/[0.04]", "bg-mtqs-emerald/5"),
    ("bg-emerald-500/[0.06]", "bg-mtqs-emerald/5"),
    ("bg-emerald-500/20", "bg-mtqs-emerald/10"),
    ("bg-emerald-500", "bg-mtqs-emerald"),
    ("bg-emerald-300", "bg-mtqs-emerald/15"),

    ("bg-rose-400/60", "bg-mtqs-rose/30"),
    ("bg-rose-400", "bg-mtqs-rose/15"),
    ("bg-rose-300", "bg-mtqs-rose/15"),
    ("bg-rose-500/[0.04]", "bg-mtqs-rose/5"),
    ("bg-rose-500/[0.06]", "bg-mtqs-rose/5"),
    ("bg-rose-500/20", "bg-mtqs-rose/20"),
    ("bg-rose-500/15", "bg-mtqs-rose/15"),
    ("bg-rose-500", "bg-mtqs-rose"),

    # ── Border brand color tints (longest first) ───────────────────────
    ("border-amber-400/40", "border-mtqs-amber/40"),
    ("border-amber-400/30", "border-mtqs-amber/30"),
    ("border-amber-400/25", "border-mtqs-amber/25"),
    ("border-amber-400/20", "border-mtqs-amber/20"),
    ("border-amber-400/15", "border-mtqs-amber/15"),
    ("border-amber-400/10", "border-mtqs-amber/10"),
    ("border-amber-400", "border-mtqs-amber/30"),

    ("border-emerald-400/60", "border-mtqs-emerald/60"),
    ("border-emerald-400/40", "border-mtqs-emerald/40"),
    ("border-emerald-400/30", "border-mtqs-emerald/30"),
    ("border-emerald-400/20", "border-mtqs-emerald/20"),
    ("border-emerald-400", "border-mtqs-emerald/30"),

    ("border-rose-400/60", "border-mtqs-rose/60"),
    ("border-rose-400/40", "border-mtqs-rose/40"),
    ("border-rose-400/30", "border-mtqs-rose/30"),
    ("border-rose-400", "border-mtqs-rose/30"),
    ("border-rose-500/40", "border-mtqs-rose/40"),
    ("border-rose-500/30", "border-mtqs-rose/30"),

    # border-mtqs-gold/* — keep (works on light theme, per spec)

    # ── Special mtqs-[color]/[opacity] → /[pct] ────────────────────────
    ("bg-mtqs-rose/[0.04]", "bg-mtqs-rose/5"),
    ("bg-mtqs-rose/[0.06]", "bg-mtqs-rose/5"),
    ("bg-mtqs-emerald/[0.04]", "bg-mtqs-emerald/5"),
    ("bg-mtqs-emerald/[0.06]", "bg-mtqs-emerald/5"),
    ("bg-mtqs-amber/[0.04]", "bg-mtqs-amber/5"),
    ("bg-mtqs-amber/[0.06]", "bg-mtqs-amber/5"),
    ("bg-mtqs-gold/[0.04]", "bg-mtqs-gold/5"),
    ("bg-mtqs-gold/[0.06]", "bg-mtqs-gold/5"),

    # ── Gradient color classes (from-/to-/via-) ────────────────────────
    ("from-amber-500/60", "from-mtqs-amber/60"),
    ("from-amber-400/30", "from-mtqs-amber/30"),
    ("from-amber-400/5", "from-mtqs-amber/5"),
    ("from-amber-400", "from-mtqs-amber"),
    ("from-amber-300/80", "from-mtqs-amber/80"),
    ("from-amber-300", "from-mtqs-amber"),
    ("from-amber-200", "from-mtqs-gold"),
    ("to-amber-500", "to-mtqs-amber"),
    ("to-amber-400/5", "to-mtqs-amber/5"),
    ("to-amber-400", "to-mtqs-amber"),
    ("to-amber-300/80", "to-mtqs-amber/80"),
    ("to-amber-300", "to-mtqs-amber"),
    ("via-amber-400/10", "via-mtqs-amber/10"),
    ("via-amber-400", "via-mtqs-amber"),
    ("via-emerald-400/5", "via-mtqs-emerald/5"),
    ("via-emerald-400", "via-mtqs-emerald"),

    # ── Shadow color ───────────────────────────────────────────────────
    ("shadow-amber-500/15", "shadow-mtqs-amber/15"),

    # ── Dark-only decorative classes — remove entirely ─────────────────
    # (Task spec: mtqs-starfield, mtqs-radial-glow, mtqs-pattern-bg remove;
    #  mtqs-grid-bg keep.) Removing the bare class name is enough — the
    #  surrounding className string will keep working with extra whitespace.
    ("mtqs-starfield", ""),
    ("mtqs-radial-glow", ""),
    ("mtqs-pattern-bg", ""),
]


def process_file(path: Path) -> tuple[int, int]:
    """Return (was_modified, total_replacements_applied)."""
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return (0, 0)
    original = text
    total = 0
    for search, replace in REPLACEMENTS:
        if not search:
            continue
        count = text.count(search)
        if count:
            text = text.replace(search, replace)
            total += count
    if text != original:
        path.write_text(text, encoding="utf-8")
        return (1, total)
    return (0, 0)


def main() -> int:
    files_modified = 0
    replacements_applied = 0
    per_file_counts: list[tuple[str, int]] = []
    for path in TARGETS:
        if not path.exists():
            print(f"MISS: {path}")
            continue
        modified, count = process_file(path)
        if modified:
            files_modified += 1
            replacements_applied += count
            per_file_counts.append((str(path.relative_to(ROOT)), count))
    print(f"\nFiles modified: {files_modified}")
    print(f"Replacements applied: {replacements_applied}")
    print("\nPer-file replacement counts (top 15):")
    for p, c in sorted(per_file_counts, key=lambda x: -x[1])[:15]:
        print(f"  {c:5d}  {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
