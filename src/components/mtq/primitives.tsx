// MTQΣ — Monetary Observatory primitives
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
export function Starfield({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div className="mtqs-starfield" />
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
   Both layered into a sovereign editorial header that speaks the MTQΣ brand. */
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
        <h2 className="mtqs-section-title text-foreground/95">
          {title}
        </h2>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/* ---------- Panel — bespoke obsidian card surface ---------- */
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
      ? "mtqs-glass mtqs-glass-emerald mtqs-hover-lift"
      : variant === "rose"
      ? "mtqs-glass mtqs-glass-emerald mtqs-hover-lift"
      : "mtqs-glass mtqs-hover-lift";
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
      <span className="text-[0.625rem] uppercase tracking-[0.22em] text-muted-foreground/80">
        {label}
      </span>
      <span className={`font-mono tabular-nums text-foreground ${valueClass}`}>
        {value}
      </span>
      {sub ? <span className="text-[0.7rem] text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

/* ---------- MiniBar — small horizontal progress bar ---------- */
export function MiniBar({
  value,
  max = 1,
  min = 0,
  colorClass = "bg-amber-400",
  trackClass = "bg-white/5",
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
      className={`animate-pulse rounded-md bg-white/[0.04] ${className}`}
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
    default: "border-white/10 bg-white/[0.03] text-foreground/80",
    gold: "border-mtqs-gold/30 bg-mtqs-gold/10 text-[#f5d27a]",
    emerald: "border-mtqs-emerald/30 bg-mtqs-emerald/10 text-[#6ff0c0]",
    rose: "border-mtqs-rose/30 bg-mtqs-rose/10 text-[#ff8ea3]",
    amber: "border-mtqs-amber/30 bg-mtqs-amber/10 text-[#ffd07a]",
    muted: "border-white/10 bg-white/[0.02] text-muted-foreground",
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
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground/75 ${className}`}
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

/* ---------- Section ID map (for nav anchors) ---------- */
export const SECTION_IDS = [
  "hero",
  "state",
  "loop",
  "oracle",
  "registry",
  "vault",
  "macro",
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
  "honest",
] as const;
