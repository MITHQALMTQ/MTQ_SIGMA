// MTQΣ — Brand Identity System (state of the art)
// The single source of truth for the MTQΣ visual identity.
// Used by globals.css (CSS variables) and the UI components (Tailwind tokens).
//
// DESIGN PHILOSOPHY: "Sovereign, collateralized, calm."
// The MTQΣ brand evokes a monetary authority — gold (the reserve), obsidian
// (the ledger stone), emerald (health/solvency), and rose (risk). No indigo,
// no blue. Premium, cinematic, bespoke.

export interface BrandColor {
  name: string;
  hex: string;
  oklch: string;        // for Tailwind v4 @theme
  usage: string;
}

export const BRAND_COLORS = {
  // === Core: Obsidian (background / ledger stone) ===
  obsidian: {
    950: { hex: "#050709", oklch: "oklch(0.06 0.01 250)", usage: "Deepest background (canvas base)" },
    900: { hex: "#080a0c", oklch: "oklch(0.09 0.01 250)", usage: "Primary app background" },
    850: { hex: "#0b0f0e", oklch: "oklch(0.12 0.012 250)", usage: "Card surface (elevated)" },
    800: { hex: "#11161a", oklch: "oklch(0.16 0.012 250)", usage: "Panel / hover surface" },
    700: { hex: "#1a2026", oklch: "oklch(0.22 0.014 250)", usage: "Border / divider" },
    600: { hex: "#2a323a", oklch: "oklch(0.30 0.014 250)", usage: "Subtle border / muted" },
  },
  // === Primary: Gold (the reserve / purchasing power) ===
  gold: {
    50: { hex: "#fdf8ee", oklch: "oklch(0.97 0.03 85)", usage: "Gold on dark (high contrast text)" },
    100: { hex: "#f5e6c8", oklch: "oklch(0.92 0.05 85)", usage: "Gold tint" },
    200: { hex: "#ecd6a0", oklch: "oklch(0.87 0.07 85)", usage: "Gold accent light" },
    300: { hex: "#e0bd76", oklch: "oklch(0.80 0.09 85)", usage: "Gold accent" },
    400: { hex: "#e8b964", oklch: "oklch(0.78 0.10 85)", usage: "PRIMARY brand gold" },
    500: { hex: "#d4a44f", oklch: "oklch(0.72 0.11 85)", usage: "Gold solid" },
    600: { hex: "#b88638", oklch: "oklch(0.62 0.10 85)", usage: "Gold pressed" },
    700: { hex: "#8f6526", oklch: "oklch(0.50 0.08 85)", usage: "Gold deep" },
  },
  // === Secondary: Emerald (health / solvency / "normal") ===
  emerald: {
    300: { hex: "#6ff0c0", oklch: "oklch(0.85 0.13 165)", usage: "Emerald accent light" },
    400: { hex: "#3ddc97", oklch: "oklch(0.78 0.14 165)", usage: "HEALTH / NORMAL status" },
    500: { hex: "#22c08a", oklch: "oklch(0.72 0.15 165)", usage: "Emerald solid" },
    600: { hex: "#15996a", oklch: "oklch(0.60 0.13 165)", usage: "Emerald deep" },
  },
  // === Risk: Rose (danger / circuit breaker / emergency) ===
  rose: {
    300: { hex: "#ff8ea3", oklch: "oklch(0.78 0.15 10)", usage: "Rose accent light" },
    400: { hex: "#ff5d73", oklch: "oklch(0.70 0.18 10)", usage: "RISK / EMERGENCY status" },
    500: { hex: "#e63e5c", oklch: "oklch(0.62 0.20 10)", usage: "Rose solid" },
    600: { hex: "#c92647", oklch: "oklch(0.54 0.20 10)", usage: "Rose deep" },
  },
  // === Amber: caution / stress tier ===
  amber: {
    300: { hex: "#ffd07a", oklch: "oklch(0.85 0.13 75)", usage: "Amber light" },
    400: { hex: "#ffb84d", oklch: "oklch(0.80 0.14 75)", usage: "CAUTION / STRESS tier" },
    500: { hex: "#f59e0b", oklch: "oklch(0.73 0.15 75)", usage: "Amber solid" },
  },
  // === Warm neutrals (text) ===
  neutral: {
    50: { hex: "#f4f1ec", oklch: "oklch(0.95 0.01 75)", usage: "Primary text on dark" },
    200: { hex: "#c9c4ba", oklch: "oklch(0.80 0.012 75)", usage: "Secondary text" },
    400: { hex: "#8a8478", oklch: "oklch(0.60 0.012 75)", usage: "Muted text" },
    600: { hex: "#5a544a", oklch: "oklch(0.42 0.012 75)", usage: "Disabled text" },
  },
} as const;

// === Governance tier colors (§14.2 hierarchy) ===
export const GOVERNANCE_TIERS = {
  constitutional: { color: "#e8b964", label: "Constitutional · 7/7 · 90d", glow: "0 0 24px rgba(232,185,100,0.35)" },
  monetary: { color: "#3ddc97", label: "Monetary · DAO 51% · 48h", glow: "0 0 24px rgba(61,220,151,0.30)" },
  risk: { color: "#ffb84d", label: "Risk · Council 4/7 · 24h", glow: "0 0 24px rgba(255,184,77,0.30)" },
  emergency: { color: "#ff5d73", label: "Emergency · 4/7 · instant", glow: "0 0 24px rgba(255,93,115,0.35)" },
} as const;

// === Status colors (§14.1 risk state machine) ===
export const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  NORMAL: { color: "#3ddc97", bg: "rgba(61,220,151,0.10)", label: "NORMAL" },
  CAUTION: { color: "#ffb84d", bg: "rgba(255,184,77,0.10)", label: "CAUTION" },
  DEFENSIVE: { color: "#ff8ea3", bg: "rgba(255,142,163,0.12)", label: "DEFENSIVE" },
  EMERGENCY: { color: "#ff5d73", bg: "rgba(255,93,115,0.15)", label: "EMERGENCY" },
  RECOVERY: { color: "#6ff0c0", bg: "rgba(111,240,192,0.10)", label: "RECOVERY" },
};

// === Typography ===
export const BRAND_TYPOGRAPHY = {
  display: { family: '"Cormorant Garamond", "Playfair Display", Georgia, serif', usage: "Wordmark + hero display" },
  sans: { family: '"Inter", "Geist Sans", system-ui, sans-serif', usage: "UI labels + body" },
  mono: { family: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace', usage: "All numeric data" },
  weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700 },
  sizes: { xs: "0.6875rem", sm: "0.8125rem", base: "0.9375rem", lg: "1.125rem", xl: "1.5rem", "2xl": "2rem", "3xl": "2.75rem", "4xl": "4rem" },
} as const;

// === Voice & principles ===
export const BRAND_VOICE = {
  tagline: "The Global Purchasing Power Unit",
  principles: ["Honest", "Sovereign", "Collateralized", "Calm"],
  coreObjective: "The GFB Index defines what one MTQΣ is intended to represent. The reserve portfolio exists to collateralize that obligation.",
  statusDeclaration: "Candidate for public testing — NOT production-authorized",
  designConstraint: "Designed for Sharia review (interest-free, asset-backed, non-speculative)",
} as const;

// === Logo mark description (for AI generation + brand book) ===
export const LOGO_MARK_DESCRIPTION =
  "The MTQΣ mark is the Greek capital sigma (Σ) sculpted as a faceted gold ingot — " +
  "symbolizing the union of purchasing power (the sigma, a summation/the index) and " +
  "reserve (the ingot, collateral). Polished gold on obsidian, with a thin emerald " +
  "accent line at the base representing solvency. No text accompanies the mark itself.";

// === Asset paths ===
export const BRAND_ASSETS = {
  logoMark: "/brand/mtqs-logo-mark.png",
  emblem: "/brand/mtqs-emblem.png",
  hero: "/brand/mtqs-hero.png",
  pattern: "/brand/mtqs-pattern.png",
  governanceCrests: "/brand/mtqs-governance-crests.png",
  favicon: "/brand/favicon.svg",
} as const;

// === Shadow / glow system ===
export const BRAND_SHADOWS = {
  goldGlow: "0 0 32px rgba(232,185,100,0.18)",
  goldGlowStrong: "0 0 48px rgba(232,185,100,0.32)",
  emeraldGlow: "0 0 32px rgba(61,220,151,0.18)",
  roseGlow: "0 0 32px rgba(255,93,115,0.22)",
  cardLift: "0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(232,185,100,0.06) inset",
} as const;

// === Radii ===
export const BRAND_RADII = {
  sm: "0.375rem",
  md: "0.625rem",
  lg: "0.875rem",
  xl: "1.25rem",
  pill: "999px",
} as const;
