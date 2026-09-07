// MTQΣ — shared formatting helpers used across the Pilot Command Center UI.

const USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const USD_FULL = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 6,
});
const NUM = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const NUM_FULL = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });

/** Format a USD value with commas and 2-decimal precision. Falls back gracefully on bad input. */
export function fmtUsd(v: number | null | undefined, full = false): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return (full ? USD_FULL : USD).format(v);
}

/** Format a plain number with grouping. */
export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (digits === 2) return NUM.format(v);
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** Format a fixed-precision number (no grouping for small ratios). */
export function fmtFixed(v: number | null | undefined, digits = 4): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(digits);
}

/** Format a ratio (e.g. 1.10) as a percentage (110.00%). Handles Infinity → "∞". */
export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "∞";
  return `${(v * 100).toFixed(digits)}%`;
}

/** Reserve-ratio formatter with the special-case "∞ — fully reserved" used by the blueprint. */
export function fmtRatio(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "∞ — fully reserved";
  return `${(v * 100).toFixed(2)}%`;
}

/** Classify reserve-ratio into a brand color band per the blueprint tiers.
 *  Brand palette only: emerald / amber / rose (no orange). */
export function rrColor(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "text-mtqs-emerald";
  if (v >= 1.1) return "text-mtqs-emerald";
  if (v >= 1.05) return "text-mtqs-amber";
  if (v >= 1.0) return "text-mtqs-amber";
  return "text-mtqs-rose";
}

/** Classify LCR color (≥1.0 emerald, else amber). Brand palette only. */
export function lcrColor(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "text-mtqs-emerald";
  return v >= 1.0 ? "text-mtqs-emerald" : "text-mtqs-amber";
}

/** Classify peg health: outside [0.98,1.02] is a depeg. */
export function pegIsHealthy(p: number): boolean {
  return p >= 0.98 && p <= 1.02;
}

/** Color for a ProtocolStatus badge — aligned to brand STATUS_COLORS (no orange). */
export function statusColor(s: string | undefined): {
  text: string;
  bg: string;
  border: string;
  dot: string;
} {
  switch (s) {
    case "NORMAL":
      return {
        text: "text-mtqs-emerald",
        bg: "bg-mtqs-emerald/10",
        border: "border-mtqs-emerald/40",
        dot: "bg-mtqs-emerald",
      };
    case "CAUTION":
      return {
        text: "text-mtqs-amber",
        bg: "bg-mtqs-amber/10",
        border: "border-mtqs-amber/40",
        dot: "bg-mtqs-amber",
      };
    case "DEFENSIVE":
      return {
        text: "text-mtqs-rose",
        bg: "bg-mtqs-rose/10",
        border: "border-mtqs-rose/40",
        dot: "bg-mtqs-rose",
      };
    case "EMERGENCY":
      return {
        text: "text-mtqs-rose",
        bg: "bg-mtqs-rose/10",
        border: "border-mtqs-rose/40",
        dot: "bg-mtqs-rose",
      };
    case "RECOVERY":
      return {
        text: "text-mtqs-emerald",
        bg: "bg-mtqs-emerald/10",
        border: "border-mtqs-emerald/30",
        dot: "bg-mtqs-emerald",
      };
    default:
      return {
        text: "text-muted-foreground",
        bg: "bg-muted/40",
        border: "border-white/10",
        dot: "bg-muted-foreground",
      };
  }
}

/** Format a Date / epoch ms as a short timestamp. */
export function fmtTime(v: number | string | Date | null | undefined): string {
  if (v == null) return "—";
  const d = typeof v === "number" ? new Date(v) : new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    month: "short",
    day: "2-digit",
  });
}

/** Copy text to clipboard, returns success boolean. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

/** Truncate an address into a "0x1234…abcd" form. */
export function shortAddr(a: string, head = 6, tail = 4): string {
  if (!a) return "";
  if (a.length <= head + tail + 1) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

/** Time-ago formatter for "5s ago" / "3h ago" / "2d ago". */
export function fmtAgo(ts: number | null | undefined): string {
  if (!ts) return "—";
  const diff = Date.now() - ts;
  if (diff < 0) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** BPS formatter — given a bps number, return "0.15%" etc. */
export function fmtBps(bps: number | null | undefined): string {
  if (bps == null || !Number.isFinite(bps)) return "—";
  return `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;
}

/** Compact USD (e.g. $1.2M, $34.5K) for ticker strips. */
export function fmtUsdCompact(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(2)}K`;
  return `$${v.toFixed(2)}`;
}

/** Signed delta formatter e.g. "+1.23%" / "-0.45%" */
export function fmtSignedPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v * 100).toFixed(digits)}%`;
}
