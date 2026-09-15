"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import {
  EJECT_DEPEG_BAND_LOWER,
  EJECT_DEPEG_BAND_UPPER,
  EJECT_STAGES,
} from "@/lib/mtq/blueprint";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtFixed } from "./format";

type Ccy = "USD" | "EUR" | "GBP" | "JPY" | "CNY";

function stageColor(stage: number): string {
  if (stage <= 0) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (stage === 1) return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  if (stage === 2) return "border-orange-500/30 bg-orange-500/10 text-orange-300";
  if (stage === 3) return "border-rose-500/30 bg-rose-500/10 text-rose-300";
  return "border-rose-500/50 bg-rose-500/20 text-rose-200";
}

export function EjectMonitor({ snapshot }: { snapshot: MetricsSnapshot }) {
  const ccy: Ccy[] = ["USD", "EUR", "GBP", "JPY", "CNY"];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/80" />
        <span>
          Per-asset staged liquidation ladder (§11). When an asset's peg leaves
          the {"[0.98, 1.02]"} band, its <span className="font-mono text-amber-300/90">depegHours</span>{" "}
          accumulator begins. Stages escalate at 10% → 25% → 50% → 100% sell.
          Peg health itself is a simulated pilot signal.
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10">
        <Table>
          <TableHeader className="bg-white/[0.03]">
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Currency
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Peg health
              </TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Depeg hours
              </TableHead>
              <TableHead className="text-right text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Eject stage
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ccy.map((c) => {
              const peg = snapshot.pegHealth[c];
              const hours = snapshot.depegHours?.[c] ?? 0;
              const stage = snapshot.ejectStage[c] ?? 0;
              const outside =
                peg < EJECT_DEPEG_BAND_LOWER || peg > EJECT_DEPEG_BAND_UPPER;
              return (
                <TableRow
                  key={c}
                  className="border-white/5 hover:bg-white/[0.02]"
                >
                  <TableCell className="py-2.5 font-mono text-xs font-semibold text-foreground">
                    {c}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        outside ? "text-rose-300" : "text-emerald-300"
                      }`}
                    >
                      {fmtFixed(peg, 4)}
                    </span>
                    {outside ? (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.12em] text-rose-300/80">
                        outside band
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="py-2.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {hours.toFixed(1)}h
                  </TableCell>
                  <TableCell className="py-2.5 text-right">
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] tabular-nums ${stageColor(stage)}`}
                    >
                      Stage {stage}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {EJECT_STAGES.map((s) => (
          <div
            key={s.stage}
            className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Stage {s.stage}
              </span>
              <span className="font-mono text-xs font-semibold text-amber-300">
                {(s.sellPct * 100).toFixed(0)}% sell
              </span>
            </div>
            <div className="mt-1 text-[11px] leading-snug text-muted-foreground/90">
              {s.condition}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
