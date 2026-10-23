// MTQΣ — Truth Banner (shared amber posture banner)
// The hand-written amber TESTNET ONLY · SHADOW MODE ENFORCED · RESERVE TRADING
// NOT AUTHORIZED banner that used to be duplicated across the operations and
// labs sections (Mint / Redeem / Simulation / Networks). One shared component
// now renders it: the pill row defaults to the standard trio (overridable —
// e.g. the Networks page's two pills, or API banner segments split on "·"),
// and each site passes its own explanatory copy as children.
//
// Rendered as a plain div (not a Panel) because .mtqs-glass is unlayered CSS
// that would override the amber border/background utilities (see the note
// that used to live in MintSection).

"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Pill } from "@/components/mtq/primitives";

/* The standard posture pill trio. */
export const TRUTH_BANNER_LINES = [
  "TESTNET ONLY",
  "SHADOW MODE ENFORCED",
  "RESERVE TRADING NOT AUTHORIZED",
] as const;

export function TruthBanner({
  lines = TRUTH_BANNER_LINES,
  children,
}: {
  /** Pill row — defaults to the standard trio; pass a subset (e.g. the
      Networks page's two pills) or API banner segments as needed. */
  lines?: readonly string[];
  /** Site-specific explanatory copy (typically one amber <p>). */
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-mtqs-amber/25 bg-mtqs-amber/[0.04] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-mtqs-amber shrink-0 mt-0.5" aria-hidden="true" />
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {lines.map((line) => (
              <Pill key={line} tone="amber">
                {line}
              </Pill>
            ))}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
