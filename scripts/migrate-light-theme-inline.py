#!/usr/bin/env python3
"""
MTQΣ — Light-theme migration · PASS 2 (inline rgba / hex colors).

Pass 1 handled Tailwind class names (bg-*, text-*, border-*). This pass
handles the inline-style colors that escaped Tailwind:
  - SVG `fill="..."` / `stroke="..."` attributes using dark-theme brand hex
    (#f5d27a gold-light, #e8b964 gold, #3ddc97 emerald, #ff5d73 rose, ...)
  - Inline `style={{ background: 'rgba(8,10,12,0.9)', color: 'rgba(255,255,255,0.55)' }}`
    on dark-theme panels / step indicators / SVG text
  - SVG / linear-gradient `rgba(232, 185, 100, *)` (dark-theme gold rgba)
    → `rgba(201, 151, 0, *)` (light-theme gold rgba)

Targets the same 43 .tsx files + page.tsx as Pass 1.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path("/home/z/my-project")

TARGETS = (
    list((ROOT / "src/components/mtq").glob("*.tsx"))
    + list((ROOT / "src/components/mtq/sections").glob("*.tsx"))
    + [ROOT / "src/app/page.tsx"]
)

# Order: longest / most-specific patterns first so prefix replacements
# do not partially overlap with each other in unintended ways.
REPLACEMENTS: list[tuple[str, str]] = [
    # ── Hex brand colors used in SVG fill / stroke ────────────────────
    # Old dark-theme brand hex → new light-theme brand hex.
    ("#f5d27a", "#c99700"),  # gold-light → primary gold (readable on white)
    ("#e8b964", "#d4a017"),  # old primary gold → new primary gold
    ("#e0c068", "#d4a017"),  # mid-gold → new primary gold
    ("#d4a44f", "#d4a017"),  # mid-gold → new primary gold
    ("#3ddc97", "#12b76a"),  # emerald (health/normal)
    ("#6ff0c0", "#12b76a"),  # emerald accent → emerald
    ("#ff5d73", "#f6465d"),  # rose (risk)
    ("#ff8ea3", "#f6465d"),  # rose accent → rose
    ("#ffd07a", "#d97706"),  # amber
    ("#ffb84d", "#d97706"),  # amber light → amber

    # ── rgba(8,10,12,*) / rgba(8, 10, 12, *) dark bg → white bg ────────
    ("rgba(8, 10, 12, 0.95)", "rgba(255, 255, 255, 0.95)"),
    ("rgba(8, 10, 12, 0.92)", "rgba(255, 255, 255, 0.92)"),
    ("rgba(8, 10, 12, 0.9)",  "rgba(255, 255, 255, 0.9)"),
    ("rgba(8, 10, 12, 0.6)",  "rgba(255, 255, 255, 0.6)"),
    ("rgba(8,10,12,0.95)", "rgba(255,255,255,0.95)"),
    ("rgba(8,10,12,0.92)", "rgba(255,255,255,0.92)"),
    ("rgba(8,10,12,0.9)",  "rgba(255,255,255,0.9)"),
    ("rgba(8,10,12,0.6)",  "rgba(255,255,255,0.6)"),

    # ── rgba(255,255,255,0.0X) subtle borders → subtle dark borders ───
    # (These are border-tint opacities, not text — convert to dark tints.)
    ("rgba(255,255,255,0.06)", "rgba(0,0,0,0.06)"),
    ("rgba(255,255,255,0.07)", "rgba(0,0,0,0.07)"),
    ("rgba(255,255,255,0.08)", "rgba(0,0,0,0.08)"),
    ("rgba(255, 255, 255, 0.06)", "rgba(0, 0, 0, 0.06)"),
    ("rgba(255, 255, 255, 0.07)", "rgba(0, 0, 0, 0.07)"),
    ("rgba(255, 255, 255, 0.08)", "rgba(0, 0, 0, 0.08)"),

    # ── rgba(255,255,255,0.X) text → dark text (#1e2329 = 30,35,41) ──
    # (Longer/more-specific first; bare rgba(255,255,255, prefix is NOT
    #  collapsed because we still want true white where it appears.)
    ("rgba(255,255,255,0.85)", "rgba(30,35,41,0.85)"),
    ("rgba(255,255,255,0.7)",  "rgba(30,35,41,0.7)"),
    ("rgba(255,255,255,0.55)", "rgba(30,35,41,0.55)"),
    ("rgba(255,255,255,0.5)",  "rgba(30,35,41,0.5)"),
    ("rgba(255,255,255,0.45)", "rgba(30,35,41,0.45)"),
    ("rgba(255, 255, 255, 0.85)", "rgba(30, 35, 41, 0.85)"),
    ("rgba(255, 255, 255, 0.7)",  "rgba(30, 35, 41, 0.7)"),
    ("rgba(255, 255, 255, 0.55)", "rgba(30, 35, 41, 0.55)"),
    ("rgba(255, 255, 255, 0.5)",  "rgba(30, 35, 41, 0.5)"),
    ("rgba(255, 255, 255, 0.45)", "rgba(30, 35, 41, 0.45)"),

    # ── rgba(232, 185, 100, *) / rgba(232,185,100,*) dark-theme gold ──
    # (Prefix replacement: preserve trailing opacity value.)
    ("rgba(232, 185, 100, ", "rgba(201, 151, 0, "),
    ("rgba(232,185,100,",     "rgba(201,151,0,"),

    # ── rgba(208, 160, 79, *) secondary gold-tone (HomeSection.tsx) ──
    ("rgba(208, 160, 79, ", "rgba(201, 151, 0, "),
    ("rgba(208,160,79,",     "rgba(201,151,0,"),

    # ── rgba(255, 93, 115, *) dark-theme rose → light-theme rose ──────
    ("rgba(255, 93, 115, ",  "rgba(246, 70, 93, "),
    ("rgba(255,93,115,",     "rgba(246,70,93,"),

    # ── rgba(255, 184, 77, *) dark-theme amber → light-theme amber ────
    ("rgba(255, 184, 77, ",  "rgba(217, 119, 6, "),
    ("rgba(255,184,77,",     "rgba(217,119,6,"),

    # ── rgba(61, 220, 151, *) dark-theme emerald → light-theme emerald
    ("rgba(61, 220, 151, ",  "rgba(18, 183, 106, "),
    ("rgba(61,220,151,",     "rgba(18,183,106,"),
]


def process_file(path: Path) -> tuple[int, int]:
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
            continue
        modified, count = process_file(path)
        if modified:
            files_modified += 1
            replacements_applied += count
            per_file_counts.append((str(path.relative_to(ROOT)), count))
    print(f"\nFiles modified: {files_modified}")
    print(f"Replacements applied: {replacements_applied}")
    print("\nPer-file replacement counts:")
    for p, c in sorted(per_file_counts, key=lambda x: -x[1]):
        print(f"  {c:5d}  {p}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
