// MTQΣ — Brand Identity System v4 (Platform-Unified)
// The single source of truth for the MTQΣ visual identity.
// Used by globals.css (CSS variables) and the UI components (Tailwind tokens).
//
// SOURCE OF BRANDING: the approved landing reference design — "Futuristic
// MTQΣ Financial Ecosystem Dashboard" (pixel-parity v7.2) plus the official
// brand identity board (/public/brand/mtqs-brand-board.png).
//
// PLATFORM THEME UNIFICATION (owner directive, this session): the terminal's
// accent family was unified with the approved reference design. The legacy
// champagne-gold primary (#F6D58D) is SUPERSEDED — the primary accent is now
// the platform cyan #2BABFB (light #8DD3FF) on midnight #020D1F, with violet
// #8B5CF6 as the gradient partner. The v3 "Cyber-Luxe" gold scale below is
// preserved as the HISTORICAL champagne scale for provenance; the ACTIVE
// primary scale is "platform".
//
// DESIGN PHILOSOPHY: midnight-blue canvas, cyan → blue → violet aurora
// accents, glassmorphism, the coin-badge logo (faceted M inside a neon ring).
// Montserrat (display) + Inter (body). Premium, futuristic, trustworthy.

export interface BrandColor {
  name: string;
  hex: string;
  oklch: string;        // for Tailwind v4 @theme
  usage: string;
}

export const BRAND_COLORS = {
  // === Core: Midnight (background / deep space) — board #050A1A ===
  midnight: {
    950: { hex: "#030611", oklch: "oklch(0.05 0.02 265)", usage: "Deepest background (canvas base)" },
    900: { hex: "#050A1A", oklch: "oklch(0.08 0.03 265)", usage: "Primary app background (brand Midnight)" },
    850: { hex: "#081024", oklch: "oklch(0.11 0.035 265)", usage: "Card surface (elevated)" },
    800: { hex: "#0C1730", oklch: "oklch(0.15 0.04 265)", usage: "Panel / hover surface" },
    700: { hex: "#12203F", oklch: "oklch(0.21 0.045 265)", usage: "Border / divider" },
    600: { hex: "#1B2C52", oklch: "oklch(0.28 0.05 265)", usage: "Subtle border / muted" },
  },
  // === ACTIVE Primary: Platform Cyan (aurora accent) — reference #2BABFB ===
  platform: {
    50: { hex: "#EAF7FF", oklch: "oklch(0.97 0.02 230)", usage: "Cyan-white highlight text" },
    100: { hex: "#8DD3FF", oklch: "oklch(0.93 0.05 230)", usage: "Light cyan (headings / tints)" },
    200: { hex: "#2BABFB", oklch: "oklch(0.75 0.12 235)", usage: "PRIMARY platform accent (reference swatch)" },
    300: { hex: "#1E93E0", oklch: "oklch(0.68 0.13 240)", usage: "Cyan accent deep" },
    400: { hex: "#1E7FC4", oklch: "oklch(0.60 0.12 240)", usage: "Cyan solid" },
    500: { hex: "#1668A6", oklch: "oklch(0.52 0.11 245)", usage: "Cyan pressed" },
    600: { hex: "#0F4F84", oklch: "oklch(0.42 0.10 245)", usage: "Cyan deep" },
  },
  // === SUPERSEDED Primary: historical champagne scale (v3 board — provenance only) ===
  champagne: {
    50: { hex: "#FDF9EF", oklch: "oklch(0.97 0.03 90)", usage: "[SUPERSEDED] Champagne on dark" },
    100: { hex: "#8DD3FF", oklch: "oklch(0.93 0.05 230)", usage: "[retinted] now platform light cyan" },
    200: { hex: "#2BABFB", oklch: "oklch(0.75 0.12 235)", usage: "[retinted] now platform cyan" },
    300: { hex: "#EFC268", oklch: "oklch(0.82 0.10 90)", usage: "[SUPERSEDED] historical champagne accent" },
    400: { hex: "#E7AE4C", oklch: "oklch(0.76 0.11 90)", usage: "[SUPERSEDED] historical champagne deep" },
    500: { hex: "#D4973A", oklch: "oklch(0.70 0.12 90)", usage: "[SUPERSEDED] historical champagne solid" },
    600: { hex: "#B87D2E", oklch: "oklch(0.60 0.11 90)", usage: "[SUPERSEDED] historical champagne pressed" },
    700: { hex: "#8F6123", oklch: "oklch(0.48 0.09 90)", usage: "[SUPERSEDED] historical champagne deep" },
  },
  // === Secondary: Cyan (neon health / live) — board #00E5FF ===
  cyan: {
    300: { hex: "#7FF2FF", oklch: "oklch(0.88 0.10 210)", usage: "Cyan accent light" },
    400: { hex: "#00E5FF", oklch: "oklch(0.84 0.12 210)", usage: "HEALTH / LIVE status (board swatch)" },
    500: { hex: "#00C4DB", oklch: "oklch(0.76 0.12 210)", usage: "Cyan solid" },
    600: { hex: "#0099AE", oklch: "oklch(0.62 0.11 210)", usage: "Cyan deep" },
  },
  // === Tertiary: Sapphire (globe / structure) — board #3882F6 ===
  sapphire: {
    300: { hex: "#7BA8F9", oklch: "oklch(0.78 0.11 265)", usage: "Sapphire light" },
    400: { hex: "#3882F6", oklch: "oklch(0.62 0.19 265)", usage: "Sapphire (globe / icon backgrounds)" },
    500: { hex: "#2566D4", oklch: "oklch(0.54 0.19 265)", usage: "Sapphire solid" },
    600: { hex: "#1B4DA8", oklch: "oklch(0.45 0.17 265)", usage: "Sapphire deep" },
  },
  // === Quaternary: Violet (gradient partner / secondary glow) — board #8B5CF6 ===
  violet: {
    300: { hex: "#B79CF9", oklch: "oklch(0.80 0.11 290)", usage: "Violet light" },
    400: { hex: "#8B5CF6", oklch: "oklch(0.62 0.18 290)", usage: "Violet (gradients / secondary glows)" },
    500: { hex: "#7343D1", oklch: "oklch(0.54 0.18 290)", usage: "Violet solid" },
    600: { hex: "#5B33AA", oklch: "oklch(0.45 0.16 290)", usage: "Violet deep" },
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
  // === Cool neutrals (text) ===
  neutral: {
    50: { hex: "#EDF1FA", oklch: "oklch(0.95 0.01 260)", usage: "Primary text on dark" },
    200: { hex: "#C2CADF", oklch: "oklch(0.80 0.015 260)", usage: "Secondary text" },
    400: { hex: "#7B86A6", oklch: "oklch(0.60 0.02 260)", usage: "Muted text" },
    600: { hex: "#4A5270", oklch: "oklch(0.42 0.02 260)", usage: "Disabled text" },
  },
} as const;

// === Governance tier colors (§14.2 hierarchy) ===
export const GOVERNANCE_TIERS = {
  constitutional: { color: "#2BABFB", label: "Constitutional · 7/7 · 90d", glow: "0 0 24px rgba(43,171,251,0.35)" },
  monetary: { color: "#00E5FF", label: "Monetary · DAO 51% · 48h", glow: "0 0 24px rgba(0,229,255,0.30)" },
  risk: { color: "#ffb84d", label: "Risk · Council 4/7 · 24h", glow: "0 0 24px rgba(255,184,77,0.30)" },
  emergency: { color: "#ff5d73", label: "Emergency · 4/7 · instant", glow: "0 0 24px rgba(255,93,115,0.35)" },
} as const;

// === Status colors (§14.1 risk state machine) ===
export const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  NORMAL: { color: "#00E5FF", bg: "rgba(0,229,255,0.08)", label: "NORMAL" },
  CAUTION: { color: "#FFB84D", bg: "rgba(255,184,77,0.08)", label: "CAUTION" },
  STRESS: { color: "#FF8C42", bg: "rgba(255,140,66,0.08)", label: "STRESS" },
  DEFENSIVE: { color: "#FF6B6B", bg: "rgba(255,107,107,0.08)", label: "DEFENSIVE" },
  EMERGENCY: { color: "#FF4D6D", bg: "rgba(255,77,109,0.10)", label: "EMERGENCY" },
  RECOVERY: { color: "#3882F6", bg: "rgba(56,130,246,0.08)", label: "RECOVERY" },
};

// === Typography (brand board: Montserrat primary + Inter secondary) ===
export const BRAND_TYPOGRAPHY = {
  display: { family: '"Montserrat", "Inter", system-ui, sans-serif', usage: "Wordmark + hero display (Bold/ExtraBold)" },
  sans: { family: '"Inter", "Geist Sans", system-ui, sans-serif', usage: "UI labels + body" },
  mono: { family: '"JetBrains Mono", "Geist Mono", ui-monospace, monospace', usage: "All numeric data" },
  weights: { light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 },
  sizes: { xs: "0.6875rem", sm: "0.8125rem", base: "0.9375rem", lg: "1.125rem", xl: "1.5rem", "2xl": "2rem", "3xl": "2.75rem", "4xl": "4rem" },
} as const;

// === Voice & principles (from the brand board taglines) ===
// Task-23 honesty pass: "Real Assets" / "asset-backed" / "collateralized"
// overclaims replaced with the v3 truth (asset-referencing; issued against
// settled payment; no conventional reserve — Gate B open). taglineFull and
// principles currently have ZERO render consumers, but are kept honest so a
// future consumer cannot resurrect the stale claim.
export const BRAND_VOICE = {
  tagline: "The Global Digital Asset",
  taglineFull: "Asset-Referencing Basket · Transparent Governance · Global Reach",
  taglineFooter: "Multi-Chain · Multi-Asset · One Vision",
  principles: ["Asset-Referencing Basket", "Transparent Governance", "Global Reach"],
  // 16f-004 (v3 posture, Task-15 phrasing): the index defines what one MTQΣ
  // references — under the no-conventional-reserve objective there is no
  // reserve portfolio; the legacy v1/v2 pilot-ledger path is retained, labeled.
  coreObjective:
    "The Adaptive Reference Basket defines what one MTQΣ references. Under the v3.0 no-conventional-reserve objective (Gate B, D-13.3–D-13.7 open) there is no reserve portfolio — the legacy v1/v2 pilot-ledger path is retained, labeled.",
  statusDeclaration: "Candidate for public testing — NOT production-authorized",
  designConstraint: "Designed for Sharia review (interest-free, basket-referencing, non-speculative)",
} as const;

// === Logo mark description (CURRENT — platform-unified) ===
// The rendered mark everywhere (landing, terminal, favicon) is the coin-badge
// emblem: a dark glass disc inside a neon cyan → blue → violet gradient ring,
// containing a sharp faceted M built from two overlapping chevrons with four
// crystalline facets (cyan → blue → indigo → violet). See
// src/components/landing/BrandMark.tsx (the single source of truth).
export const LOGO_MARK_DESCRIPTION =
  "The MTQΣ mark is a circular coin-badge: a dark glass disc framed by a neon " +
  "cyan → blue → violet gradient ring, carrying a sharp faceted M formed by two " +
  "overlapping gradient chevrons with four crystalline facets — cyan → blue → " +
  "indigo → violet — over a midnight-blue field with luminous bloom.";

// === Asset paths ===
// logoCanonical is the single source of truth — the official emblem from the
// brand identity board (hexagon + champagne Σ + globe + orbital rings),
// cropped and trimmed from the master board PNG.
export const BRAND_ASSETS = {
  logoCanonical: "/brand/mtqs-emblem-v3.png",
  logoMark: "/brand/mtqs-emblem-v3.png",
  emblem: "/brand/mtqs-emblem-v3.png",
  wordmark: "/brand/mtqs-wordmark-v3.png",
  brandBoard: "/brand/mtqs-brand-board.png",
  hero: "/brand/mtqs-emblem-v3.png",
  pattern: "/brand/mtqs-pattern.png",
  governanceCrests: "/brand/mtqs-governance-crests.png",
  favicon: "/brand/favicon.svg",
} as const;

// === Shadow / glow system ===
export const BRAND_SHADOWS = {
  champagneGlow: "0 0 32px rgba(43,171,251,0.18)",
  champagneGlowStrong: "0 0 48px rgba(43,171,251,0.32)",
  cyanGlow: "0 0 32px rgba(0,229,255,0.18)",
  sapphireGlow: "0 0 32px rgba(56,130,246,0.22)",
  roseGlow: "0 0 32px rgba(255,93,115,0.22)",
  cardLift: "0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(43,171,251,0.06) inset",
  // legacy aliases (kept so existing consumers stay in sync)
  goldGlow: "0 0 32px rgba(43,171,251,0.18)",
  goldGlowStrong: "0 0 48px rgba(43,171,251,0.32)",
  emeraldGlow: "0 0 32px rgba(0,229,255,0.18)",
} as const;

// === Radii ===
export const BRAND_RADII = {
  sm: "0.375rem",
  md: "0.625rem",
  lg: "0.875rem",
  xl: "1.25rem",
  pill: "999px",
} as const;
