// MTQΣ — Apple-style Navigation (segmented control + spring physics + frosted glass)
// Apple design: frosted glass background, segmented control pills, spring animations,
// generous touch targets, SF Pro-like typography (Inter), subtle haptic-like transitions.

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

// Apple spring physics
const springTransition = { type: "spring" as const, stiffness: 400, damping: 30 };

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
      className="sticky top-[57px] sm:top-[69px] z-30"
      role="navigation"
      aria-label="MTQΣ sections"
    >
      {/* Frosted glass background bar */}
      <div className="bg-[#080a0c]/72 backdrop-blur-xl saturate-200 border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          {/* Desktop: Apple segmented control */}
          <div className="hidden md:flex items-center gap-1 py-2.5">
            <div className="mtqs-segmented flex items-center gap-0.5 rounded-xl p-1">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const isActive = s.id === active;
                return (
                  <button
                    key={s.id}
                    onClick={() => handlePick(s.id)}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[0.78rem] font-medium tracking-tight rounded-lg transition-colors duration-200 ${
                      isActive
                        ? "text-white"
                        : "text-muted-foreground/60 hover:text-foreground/80"
                    }`}
                    aria-pressed={isActive}
                    aria-label={`${s.label} section`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="mtqs-nav-pill"
                        className="absolute inset-0 mtqs-nav-pill"
                        transition={springTransition}
                      />
                    )}
                    <Icon className="h-3.5 w-3.5 relative z-10" aria-hidden="true" />
                    <span className="relative z-10">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mobile: hamburger + current label */}
          <div className="md:hidden flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="flex items-center justify-center rounded-lg p-2 text-amber-200/80 hover:text-amber-200 hover:bg-white/[0.05] transition-colors duration-200"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <span className="text-sm font-semibold text-amber-100/90 tracking-tight">
                {SECTIONS.find((s) => s.id === active)?.label ?? "Home"}
              </span>
            </div>
            <span className="text-[0.65rem] font-medium text-muted-foreground/40 uppercase tracking-widest">
              9 sections
            </span>
          </div>

          {/* Mobile: Apple-style expanding grid */}
          <AnimatePresence initial={false}>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="md:hidden overflow-hidden"
              >
                <div className="grid grid-cols-3 gap-2 py-2 pb-4">
                  {SECTIONS.map((s, i) => {
                    const Icon = s.icon;
                    const isActive = s.id === active;
                    return (
                      <motion.button
                        key={s.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03, duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => handlePick(s.id)}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3.5 transition-colors duration-200 ${
                          isActive
                            ? "bg-amber-400/15 text-amber-200 border border-amber-400/25"
                            : "bg-white/[0.04] text-muted-foreground/70 border border-white/[0.04] hover:bg-white/[0.08]"
                        }`}
                        aria-pressed={isActive}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                        <span className="text-[0.7rem] font-medium">{s.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}
