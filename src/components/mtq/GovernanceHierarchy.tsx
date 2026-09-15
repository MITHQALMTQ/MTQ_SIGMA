"use client";

import * as React from "react";
import { Landmark, Scale, ShieldAlert, Vote } from "lucide-react";
import { GOVERNANCE_HIERARCHY } from "@/lib/mtq/blueprint";

const ICONS = [Landmark, Vote, Scale, ShieldAlert];

export function GovernanceHierarchy() {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {GOVERNANCE_HIERARCHY.map((row, i) => {
        const Icon = ICONS[i] ?? Landmark;
        return (
          <div
            key={row.scope}
            className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-300">
              <Icon className="h-4 w-4" />
            </div>
            <div className="text-xs font-semibold text-foreground">{row.scope}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              <span className="text-muted-foreground/80">Authority:</span>{" "}
              <span className="text-amber-200">{row.authority}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              <span className="text-muted-foreground/80">Timelock:</span>{" "}
              <span className="text-amber-200">{row.timelock}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
