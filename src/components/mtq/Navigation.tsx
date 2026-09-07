// MTQΣ — Navigation (9-section nav with active underline + mobile hamburger)
// Brand: gold active state, framer-motion layoutId underline, mobile grid menu.
// Exports `SectionId` so the page wrapper and all sections can share the type.

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  LayoutDashboard,
  FileText,
  FlaskConical,
  BookOpen,
  TrendingUp,
  Presentation,
  ShieldCheck,
  TestTube,
  Menu,
  X,
} from "lucide-react";
import { Pill } from "./primitives";

export type SectionId =
  | "home"
  | "dashboard"
  | "contracts"
  | "trial"
  | "docs"
  | "investors"
  | "pitch"
  | "security"
  | "tests";

export const SECTIONS: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "contracts", label: "Contracts", icon: FileText },
  { id: "trial", label: "Trial", icon: FlaskConical },
  { id: "docs", label: "Docs", icon: BookOpen },
  { id: "investors", label: "Investors", icon: TrendingUp },
  { id: "pitch", label: "Pitch", icon: Presentation },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "tests", label: "Tests", icon: TestTube },
];

export function Navigation({
  active,
  onChange,
}: {
  active: SectionId;
  onChange: (id: SectionId) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handlePick = (id: SectionId) => {
    onChange(id);
    setMobileOpen(false);
  };

  return (
    <nav
      className="sticky top-[57px] sm:top-[69px] z-30 border-b border-white/[0.06] bg-[#080a0c]/90 backdrop-blur-xl"
      role="navigation"
      aria-label="MTQΣ sections"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Desktop nav row */}
        <div className="hidden md:flex items-center justify-between gap-2 py-1">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = s.id === active;
            return (
              <button
                key={s.id}
                onClick={() => handlePick(s.id)}
                className={`mtqs-focus relative flex items-center gap-1.5 px-3 py-2.5 text-[0.78rem] font-medium tracking-tight transition ${
                  isActive
                    ? "text-mtqs-gold-light"
                    : "text-muted-foreground/70 hover:text-foreground/85"
                }`}
                aria-pressed={isActive}
                aria-label={`${s.label} section`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{s.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="mtqs-nav-underline"
                    className="absolute inset-x-1 -bottom-px h-px bg-gradient-to-r from-transparent via-mtqs-gold to-transparent"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile: hamburger toggle + current-section label */}
        <div className="md:hidden flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="mtqs-focus inline-flex items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.02] p-2 text-mtqs-gold/85 hover:text-mtqs-gold-light hover:border-mtqs-gold/30 transition"
              aria-label={mobileOpen ? "Close section menu" : "Open section menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <Pill tone="gold" className="font-mono uppercase tracking-wider">
              {SECTIONS.find((s) => s.id === active)?.label ?? "Home"}
            </Pill>
          </div>
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground/60">
            9 sections
          </div>
        </div>

        {/* Mobile grid menu */}
        <AnimatePresence initial={false}>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="md:hidden overflow-hidden"
            >
              <div className="grid grid-cols-3 gap-2 py-2 pb-3">
                {SECTIONS.map((s) => {
                  const Icon = s.icon;
                  const isActive = s.id === active;
                  return (
                    <button
                      key={s.id}
                      onClick={() => handlePick(s.id)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-md border px-2 py-3 text-[0.7rem] font-medium transition ${
                        isActive
                          ? "border-mtqs-gold/40 bg-mtqs-gold/10 text-mtqs-gold-light"
                          : "border-white/[0.06] bg-white/[0.02] text-muted-foreground/80 hover:text-foreground/90 hover:border-white/[0.12]"
                      }`}
                      aria-pressed={isActive}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
