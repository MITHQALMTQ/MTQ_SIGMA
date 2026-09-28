// MTQΣ — Global Purchasing Power Unit primitives
// Atomic building blocks for the bespoke UI: starfield, animated numbers,
// panels, eyebrows, glow dots, focusable buttons. All small + composable.
//
// Brand system (state of the art):
//   - Wordmark "MTQΣ" → Cormorant Garamond (font-display) + gold gradient.
//   - Section headings → uppercase, tracked, gold / warm-neutral, sans-serif.
//   - Numeric data → mono + tabular-nums with tick-flash on change.
//   - Glow dots → brand hex (gold #e8b964, emerald #3ddc97, rose #ff5d73, amber #ffb84d).

"use client";

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";

/* ---------- Starfield / dust layer ---------- */
export function _Starfield_deprecated({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div className="" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(61, 220, 151, 0.06), transparent 65%), radial-gradient(ellipse 80% 60% at 50% 8%, rgba(232, 185, 100, 0.04), transparent 70%)",
        }}
      />
    </div>
  );
}

/* ---------- usePrevious hook (for tick flash) ----------
   Stores the previous value of `value` across renders, mirroring the ref to
   state so the linter's "no ref access during render" rule is satisfied. */
export function usePrevious<T>(value: T): T | undefined {
  const [prev, setPrev] = useState<T | undefined>(undefined);
  const [cur, setCur] = useState<T | undefined>(value);
  if (cur !== value) {
    setPrev(cur);
    setCur(value);
  }
  return prev;
}

/* ---------- TickNumber — animated mono number with subtle flash on change ---------- */
export function TickNumber({
  value,
  format = (n) => String(n),
  className = "",
  flash = true,
}: {
  value: number | null | undefined;
  format?: (n: number) => string;
  className?: string;
  flash?: boolean;
}) {
  const prev = usePrevious(value);
  const changed = flash && prev !== undefined && prev !== value;
  return (
    <span
      key={changed ? `${value}-${Date.now()}` : "stable"}
      className={`font-mono tabular-nums ${changed ? "mtqs-tick-flash" : ""} ${className}`}
    >
      {value == null || !Number.isFinite(value) ? "—" : format(value)}
    </span>
  );
}

/* ---------- GlowDot — pulsing live indicator (brand hex) ---------- */
export function GlowDot({
  color = "emerald",
  size = "h-2 w-2",
  className = "",
}: {
  color?: "emerald" | "gold" | "rose" | "amber";
  size?: string;
  className?: string;
}) {
  // Brand hex codes — single source of truth for glow colors.
  const BRAND_HEX: Record<typeof color, string> = {
    emerald: "#3ddc97",
    gold: "#e8b964",
    rose: "#ff5d73",
    amber: "#ffb84d",
  };
  const hex = BRAND_HEX[color];
  return (
    <span
      className={`relative inline-flex ${size} ${className}`}
      aria-hidden="true"
    >
      <span
        className="relative inline-flex rounded-full"
        style={{ width: "100%", height: "100%", backgroundColor: hex }}
      />
      <span
        className="absolute inset-0 rounded-full mtqs-live-dot"
        style={{ color: hex }}
      />
    </span>
  );
}

/* ---------- Section eyebrow label ---------- */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`mtqs-eyebrow ${className}`}>
      {children}
    </span>
  );
}

/* ---------- Section heading: eyebrow + title + optional right slot ----------
   Eyebrow = §-reference (small tracked uppercase gold).
   Title   = readable section name (font-sans, medium, warm-white).
   Both layered into a sovereign editorial header that speaks the MTQΣ brand.
   Note: mb-6 is retained for sections that use this heading in isolation.
   Sections that place this heading inside a `space-y-*` container should
   add `className="mb-0"` to avoid double-spacing (space-y + mb-6). */
export function SectionHeading({
  eyebrow,
  title,
  right,
  className = "",
}: {
  eyebrow: string;
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-4 mb-6 ${className}`}>
      <div className="space-y-1.5 min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mtqs-section-title text-white">
          {title}
        </h2>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/* ---------- Panel — 2026 glassmorphic card surface ---------- */
export function Panel({
  children,
  className = "",
  variant = "default",
  style,
  as: As = "section",
}: {
  children: ReactNode;
  className?: string;
  variant?: "default" | "emerald" | "rose";
  style?: CSSProperties;
  as?: "section" | "article" | "div";
}) {
  const v =
    variant === "emerald"
      ? "mtqs-glass-emerald"
      : variant === "rose"
      ? "mtqs-glass-emerald"
      : "mtqs-glass";
  return (
    <As className={`${v} ${className}`} style={style}>
      {children}
    </As>
  );
}

/* ---------- Reveal — fade/slide in on scroll ---------- */
export function Reveal({
  children,
  delay = 0,
  y = 12,
  className = "",
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "0px 0px -8% 0px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ type: "spring", stiffness: 300, damping: 28, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Stat — label / value / sub row used inside panels ---------- */
export function Stat({
  label,
  value,
  sub,
  className = "",
  valueClass = "",
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
  valueClass?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[0.625rem] uppercase tracking-[0.22em] text-white/55">
        {label}
      </span>
      <span className={`font-mono tabular-nums text-white ${valueClass}`}>
        {value}
      </span>
      {sub ? <span className="text-[0.7rem] text-white/55">{sub}</span> : null}
    </div>
  );
}

/* ---------- MiniBar — small horizontal progress bar ---------- */
export function MiniBar({
  value,
  max = 1,
  min = 0,
  colorClass = "bg-amber-400",
  trackClass = "bg-white/[0.03]/5",
  className = "",
  height = "h-1.5",
}: {
  value: number;
  max?: number;
  min?: number;
  colorClass?: string;
  trackClass?: string;
  className?: string;
  height?: string;
}) {
  const range = max - min;
  const pct = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0;
  return (
    <div
      className={`${height} ${trackClass} rounded-full overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={`${height} ${colorClass} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${pct * 100}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

/* ---------- Crossfade number swap for big display values ---------- */
export function FadeSwap({
  children,
  k,
  className = "",
}: {
  children: ReactNode;
  k: string | number;
  className?: string;
}) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={k}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.28 }}
        className={className}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

/* ---------- Skeleton block for first-fetch ---------- */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-white/[0.03]/[0.04] ${className}`}
      aria-hidden="true"
    />
  );
}

/* ---------- Pill — small badge (brand tones) ---------- */
export function Pill({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "gold" | "emerald" | "rose" | "amber" | "muted";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "border-white/[0.06] bg-white/[0.03]/[0.03] text-white/55",
    gold: "border-mtqs-gold/30 bg-mtqs-gold/10 text-mtqs-gold",
    emerald: "border-mtqs-emerald/30 bg-mtqs-emerald/10 text-mtqs-emerald",
    rose: "border-mtqs-rose/30 bg-mtqs-rose/10 text-mtqs-rose",
    amber: "border-mtqs-amber/30 bg-mtqs-amber/10 text-mtqs-amber",
    muted: "border-white/[0.06] bg-white/[0.03]/[0.02] text-white/55",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------- BrandPrinciples — "Honest · Sovereign · Collateralized · Calm" row ---------- */
export function BrandPrinciples({ className = "" }: { className?: string }) {
  const principles = ["Honest", "Sovereign", "Collateralized", "Calm"];
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] uppercase tracking-[0.22em] text-white/55/75 ${className}`}
      aria-label="MTQΣ brand principles"
    >
      {principles.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-x-3">
          <span className="text-mtqs-gold/85">{p}</span>
          {i < principles.length - 1 && (
            <span className="text-mtqs-gold/30" aria-hidden="true">·</span>
          )}
        </span>
      ))}
    </div>
  );
}

/* ============================================================
   PAR1D Premium Primitives (UI-REDESIGN)
   Luxury building blocks that compose on top of the new
   `.mtqs-glass-premium` / `.mtqs-gold-gradient-text` / etc. tokens.
   All components stay within the obsidian / gold / emerald / rose
   palette and respect prefers-reduced-motion via globals.css.
   ============================================================ */

/* ---------- PremiumCard — glassmorphic card with gold gradient border, hover lift ---------- */
export function PremiumCard({
  children,
  className = "",
  as: As = "section",
  aurora = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
  aurora?: boolean;
  style?: CSSProperties;
}) {
  return (
    <As
      className={`mtqs-glass-premium mtqs-card-hover ${aurora ? "mtqs-border-aurora" : ""} ${className}`}
      style={style}
    >
      {children}
    </As>
  );
}

/* ---------- GradientText — gold gradient text component ---------- */
export function GradientText({
  children,
  className = "",
  as: As = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
}) {
  return (
    <As className={`mtqs-gold-gradient-text ${className}`}>
      {children}
    </As>
  );
}

/* ---------- GlowBadge — badge with glow effect (gold/emerald/rose variants) ---------- */
export function GlowBadge({
  children,
  variant = "gold",
  className = "",
}: {
  children: ReactNode;
  variant?: "gold" | "emerald" | "rose";
  className?: string;
}) {
  const cls =
    variant === "emerald"
      ? "mtqs-badge-emerald"
      : variant === "rose"
      ? "mtqs-badge-rose"
      : "mtqs-badge-gold";
  return <span className={`${cls} ${className}`}>{children}</span>;
}

/* ---------- SectionDivider — decorative gold divider with Σ symbol ---------- */
export function SectionDivider({
  label = "Σ",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={`mtqs-section-divider ${className}`} aria-hidden="true">
      <span>{label}</span>
    </div>
  );
}

/* ---------- AnimatedCounter — counts up to a value with easing ---------- */
export function AnimatedCounter({
  value,
  format = (n) => n.toLocaleString("en-US"),
  duration = 0.8,
  className = "",
}: {
  value: number | null | undefined;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const prev = usePrevious(value);
  const [display, setDisplay] = useState<number>(value ?? 0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (value == null || !Number.isFinite(value)) return;
    const from = prev != null && Number.isFinite(prev) ? prev : value;
    const to = value;
    if (from === to) {
      setDisplay(to);
      return;
    }
    const start = performance.now();
    const ms = Math.max(120, duration * 1000);
    // easeOutCubic
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const v = from + (to - from) * ease(t);
      setDisplay(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(to);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, duration, prev]);

  if (value == null || !Number.isFinite(value)) {
    return <span className={`font-mono tabular-nums ${className}`}>—</span>;
  }
  return (
    <span className={`font-mono tabular-nums mtqs-count-up ${className}`}>
      {format(display)}
    </span>
  );
}

/* ---------- StatCard — large stat display with icon, value, label, trend arrow ---------- */
export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendDirection = "neutral",
  tone = "gold",
  className = "",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: ReactNode;
  value: ReactNode;
  trend?: ReactNode;
  trendDirection?: "up" | "down" | "neutral";
  tone?: "gold" | "emerald" | "rose" | "neutral";
  className?: string;
}) {
  const toneText =
    tone === "emerald"
      ? "text-mtqs-emerald"
      : tone === "rose"
      ? "text-mtqs-rose"
      : tone === "neutral"
      ? "text-white"
      : "text-mtqs-gold-light";
  const trendColor =
    trendDirection === "up"
      ? "text-mtqs-emerald"
      : trendDirection === "down"
      ? "text-mtqs-rose"
      : "text-white/55";
  const trendArrow = trendDirection === "up" ? "▲" : trendDirection === "down" ? "▼" : "■";

  return (
    <div className={`mtqs-stat-card mtqs-card-hover ${className}`}>
      <div className="flex items-start justify-between gap-3 relative z-10">
        <span className="text-[0.6rem] uppercase tracking-[0.22em] text-white/55">
          {label}
        </span>
        {Icon ? (
          <span className="inline-flex items-center justify-center rounded-md border border-mtqs-gold/25 bg-mtqs-gold/8 p-1.5">
            <Icon className="h-3.5 w-3.5 text-mtqs-gold-light" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      <div className={`font-mono tabular-nums text-2xl sm:text-3xl font-semibold relative z-10 ${toneText}`}>
        {value}
      </div>
      {trend ? (
        <div className={`flex items-center gap-1 text-[0.7rem] relative z-10 ${trendColor}`}>
          <span aria-hidden="true">{trendArrow}</span>
          <span>{trend}</span>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- CSSParticleField — CSS-only floating gold particles ---------- */
/* Uses the .mtqs-particle-bg class (radial-gradient dust layers + drift animation).
   Pure CSS — no JS particle generation, no hydration concerns, zero runtime cost.
   Note: a separate <ParticleField /> component exists at
   @/components/mtq/ParticleField (JS-generated divs). This one is the
   CSS-only premium variant per the UI-REDESIGN spec. */
export function CSSParticleField({
  className = "",
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`mtqs-particle-bg ${className}`} aria-hidden={children ? undefined : true}>
      {children}
    </div>
  );
}

// Spec-compliant alias: `ParticleField` from primitives is the CSS-only variant.
// (The JS-rendered ParticleField lives at @/components/mtq/ParticleField.)
export const ParticleField = CSSParticleField;

/* ---------- SectionFade — wrapper that fades its children in on scroll into view ---------- */
export function SectionFade({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  return (
    <div
      ref={ref}
      className={`mtqs-section-fade ${inView ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ---------- Section ID map (for nav anchors) ---------- */
export const SECTION_IDS = [
  "hero",
  "state",
  "loop",
  "oracle",
  "registry",
  "vault",
  "macro",
  "mase",
  "rebalance",
  "mint",
  "redeem",
  "buffer",
  "eject",
  "treasury",
  "price-events",
  "contracts",
  "risk",
  "governance",
  "basket",
  "trials",
  "ai-briefing",
  "ai-risk",
  "honest",
] as const;
