"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  valueClassName?: string;
  children?: React.ReactNode;
}

/**
 * A premium monetary-style metric card: small label up top, large tabular-num value,
 * optional hint below. Surface uses the dark card color with a subtle border.
 */
export function MetricCard({
  label,
  value,
  hint,
  badge,
  icon,
  className,
  valueClassName,
  children,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "relative gap-0 overflow-hidden rounded-xl border-white/10 bg-card/70 p-4 sm:p-5 backdrop-blur-sm",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.5)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {icon ? <span className="text-amber-400/80">{icon}</span> : null}
          {label}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </div>
      <div
        className={cn(
          "mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-[1.7rem]",
          valueClassName,
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1.5 text-xs text-muted-foreground/90">{hint}</div>
      ) : null}
      {children}
    </Card>
  );
}

/** A section-level wrapper used to give each major panel a consistent header style. */
export function PanelSection({
  id,
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  id?: string;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-2xl border border-white/10 bg-card/60 p-4 backdrop-blur-sm sm:p-6",
        className,
      )}
    >
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow ? (
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400/80">
              {eyebrow}
            </div>
          ) : null}
          <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
