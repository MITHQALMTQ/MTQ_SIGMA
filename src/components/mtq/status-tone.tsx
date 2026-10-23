// MTQΣ — shared status-keyed maps + sub-block wrapper
// STATUS_TONE, REDEEM_FEE_BY_STATUS and the Block sub-section wrapper were
// duplicated verbatim between MintSection and RedeemSection; both (plus
// SimulationSection's Block) now import from here. Behavior is identical.

"use client";

import type { ProtocolStatus } from "@/lib/mtq/blueprint";
import {
  REDEEM_FEE_NORMAL,
  REDEEM_FEE_STRESS,
  REDEEM_FEE_DEFENSIVE,
  REDEEM_FEE_RECOVERY,
} from "@/lib/mtq/blueprint";

/* ---------- Status → brand tone (Pill + GlowDot) ---------- */
export const STATUS_TONE: Record<
  ProtocolStatus,
  { pill: "gold" | "emerald" | "rose" | "amber" | "muted"; dot: "gold" | "emerald" | "rose" | "amber" }
> = {
  NORMAL: { pill: "emerald", dot: "emerald" },
  CAUTION: { pill: "gold", dot: "gold" },
  STRESS: { pill: "amber", dot: "amber" },
  DEFENSIVE: { pill: "amber", dot: "amber" },
  EMERGENCY: { pill: "rose", dot: "rose" },
  RECOVERY: { pill: "gold", dot: "gold" },
};

/* ---------- §21.4 — state-dependent redemption fee (from blueprint.ts) ----------
   Mirrors engine redeemFee() exactly (state-machine.ts). EMERGENCY maps to
   null: redemption is PAUSED in S5. The REDEEM_FEE_EMERGENCY constant is
   retained only as the legacy Listing-13 value — it is never charged. */
export const REDEEM_FEE_BY_STATUS: Record<ProtocolStatus, number | null> = {
  NORMAL: REDEEM_FEE_NORMAL,
  CAUTION: REDEEM_FEE_NORMAL,
  STRESS: REDEEM_FEE_STRESS,
  DEFENSIVE: REDEEM_FEE_DEFENSIVE,
  EMERGENCY: null,
  RECOVERY: REDEEM_FEE_RECOVERY,
};

/* ---------- Sub-block wrapper (section anchor + gold-icon heading) ---------- */
export function Block({
  id,
  icon: Icon,
  title,
  sub,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-32">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center">
            <Icon className="h-3.5 w-3.5 text-mtqs-gold-light" aria-hidden="true" />
          </span>
          <h3 id={`${id}-h`} className="text-base font-semibold text-white">
            {title}
          </h3>
        </div>
        {sub ? (
          <p className="mt-1.5 ml-9 text-[0.72rem] text-white/55 leading-relaxed">{sub}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
