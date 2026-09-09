// MTQΣ — Price Events log (§3.6)
// Last ~20 PriceUpdated events (>0.5% change) as a compact timeline.

"use client";

import { motion } from "framer-motion";
import { Panel, Reveal, Pill, GlowDot } from "./primitives";
import { fmtFixed, fmtSignedPct, fmtTime } from "./format";
import { PRICE_EVENT_THRESHOLD } from "@/lib/mtq/blueprint";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

export function PriceEvents({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const events = snapshot?.priceEvents ?? [];

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground/90">Price Events Log (§3.6)</div>
          <div className="text-[0.7rem] text-muted-foreground">
            PriceUpdated events emitted when GFB changes ≥ {(PRICE_EVENT_THRESHOLD * 100).toFixed(1)}% · last {events.length} of 20
          </div>
        </div>
        <Pill tone={events.length > 0 ? "amber" : "muted"}>
          <GlowDot color={events.length > 0 ? "amber" : "gold"} size="h-1.5 w-1.5" />
          {events.length} events
        </Pill>
      </div>

      {events.length === 0 ? (
        <div className="rounded-md border border-border bg-black/[0.02] p-4 text-center text-[0.72rem] text-muted-foreground">
          No price events yet. The GFB Index has not moved more than {(PRICE_EVENT_THRESHOLD * 100).toFixed(1)}% between ticks since the pilot started.
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto mtqs-scroll pr-1">
          <ol className="relative space-y-2">
            <div className="absolute left-2 top-2 bottom-2 w-px bg-gradient-to-b from-amber-400/30 via-amber-400/10 to-transparent" aria-hidden="true" />
            {events.map((e, i) => {
              const isUp = e.newPrice > e.oldPrice;
              return (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="relative flex items-start gap-3 pl-1"
                >
                  <span className={`relative z-10 mt-1.5 inline-flex h-3 w-3 items-center justify-center rounded-full border ${isUp ? "border-emerald-400/60 bg-emerald-500/20" : "border-rose-400/60 bg-rose-500/20"}`}>
                    <span className={`h-1 w-1 rounded-full ${isUp ? "bg-emerald-300" : "bg-rose-300"}`} />
                  </span>
                  <div className="flex-1 rounded-md border border-border bg-white/[0.015] p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-[0.75rem]">
                        <span className="text-muted-foreground">{fmtFixed(e.oldPrice, 4)}</span>
                        <span className="mx-1.5 text-muted-foreground/60">→</span>
                        <span className={isUp ? "text-mtqs-emerald" : "text-mtqs-rose"}>{fmtFixed(e.newPrice, 4)}</span>
                      </div>
                      <span className={`font-mono text-[0.75rem] font-semibold ${isUp ? "text-mtqs-emerald" : "text-mtqs-rose"}`}>
                        {fmtSignedPct(isUp ? e.changePct : -e.changePct)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[0.65rem] text-muted-foreground/60 font-mono">{fmtTime(e.ts)}</div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      )}
    </Panel>
  );
}
