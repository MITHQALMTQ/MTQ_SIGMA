// MTQΣ — Institutional Terminal Navigation
// Professional terminal architecture: PRIMARY + USER OPERATIONS + SUPPORTING
// Desktop: clean horizontal bar with visual group dividers (not a segmented control).
// Mobile: hamburger grid with grouped sections (PRIMARY / USER OPS / SUPPORTING) + a
// 5-tab bottom nav (handled separately by MobileBottomNav).

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Vault,
  Shield,
  RefreshCw,
  Eye,
  Users,
  CheckCircle,
  Code,
  Plus,
  Minus,
  Wallet,
  Activity,
  FlaskConical,
  FileText,
  Lock,
  FileCode,
  Network,
  Droplet,
  Menu,
  X,
  TrendingUp,
  Presentation,
} from "lucide-react";

// New institutional terminal section IDs (PRIMARY / USER OPERATIONS / SUPPORTING).
// Legacy IDs (home, dashboard, trial, tests, investors, pitch) are retained on the
// union so that existing section components (HomeSection, DocsSection, …) which still
// call `onNavigate("trial")` etc. continue to type-check. They are simply not exposed
// in the primary navigation surface.
export type SectionId =
  // PRIMARY
  | "overview"
  | "reference"
  | "reserve"
  | "risk"
  | "rebalancing"
  | "transparency"
  | "governance"
  | "validation"
  | "developers"
  // USER OPERATIONS
  | "mint"
  | "redeem"
  | "portfolio"
  | "activity"
  // SUPPORTING
  | "simulation"
  | "docs"
  | "security"
  | "contracts"
  | "networks"
  | "faucet"
  // LEGACY (kept for backward compat with internal section links; not shown in primary nav)
  | "home"
  | "dashboard"
  | "trial"
  | "tests"
  | "investors"
  | "pitch";

type SectionDef = {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  key: string;
  label: string;
  items: SectionDef[];
};

// PRIMARY — institutional terminal main navigation (9)
const PRIMARY: SectionDef[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "reference", label: "Reference", icon: BookOpen },
  { id: "reserve", label: "Reserve", icon: Vault },
  { id: "risk", label: "Risk", icon: Shield },
  { id: "rebalancing", label: "Rebalancing", icon: RefreshCw },
  { id: "transparency", label: "Transparency", icon: Eye },
  { id: "governance", label: "Governance", icon: Users },
  { id: "validation", label: "Validation", icon: CheckCircle },
  { id: "developers", label: "Developers", icon: Code },
];

// USER OPERATIONS — mint / redeem / portfolio / activity (4)
const USER_OPS: SectionDef[] = [
  { id: "mint", label: "Mint", icon: Plus },
  { id: "redeem", label: "Redeem", icon: Minus },
  { id: "portfolio", label: "Portfolio", icon: Wallet },
  { id: "activity", label: "Activity", icon: Activity },
];

// SUPPORTING — labs, docs, security, contracts, networks, faucet (6)
const SUPPORTING: SectionDef[] = [
  { id: "simulation", label: "Simulation Lab", icon: FlaskConical },
  { id: "docs", label: "Documentation", icon: FileText },
  { id: "security", label: "Security", icon: Lock },
  { id: "contracts", label: "Contracts", icon: FileCode },
  { id: "networks", label: "Networks", icon: Network },
  { id: "faucet", label: "Faucet", icon: Droplet },
];

// SECONDARY / RESTRICTED — accessible via "More" dropdown only.
// Per task spec: keep the components, just don't show them in the primary nav.
const SECONDARY: SectionDef[] = [
  { id: "investors", label: "Investors", icon: TrendingUp },
  { id: "pitch", label: "Pitch", icon: Presentation },
];

export const NAV_GROUPS: NavGroup[] = [
  { key: "primary", label: "Primary", items: PRIMARY },
  { key: "user-ops", label: "User Operations", items: USER_OPS },
  { key: "supporting", label: "Supporting", items: SUPPORTING },
];

// Flat list of all primary-surface sections (PRIMARY + USER OPS + SUPPORTING).
// Used by mobile hamburger grid + mobile bottom nav lookups.
export const SECTIONS: SectionDef[] = [...PRIMARY, ...USER_OPS, ...SUPPORTING];

// All sections including secondary (for lookups / mobile menu).
export const ALL_SECTIONS: SectionDef[] = [...SECTIONS, ...SECONDARY];

// Spring physics for active pill indicator
const springTransition = { type: "spring" as const, stiffness: 400, damping: 30 };

export function Navigation({
  active,
  onChange,
}: {
  active: SectionId;
  onChange: (id: SectionId) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const handlePick = (id: SectionId) => {
    onChange(id);
    setMobileOpen(false);
    setMoreOpen(false);
  };

  const activeLabel =
    ALL_SECTIONS.find((s) => s.id === active)?.label ?? "Overview";

  return (
    <nav
      className="sticky top-[57px] sm:top-[69px] z-30"
      role="navigation"
      aria-label="MTQΣ institutional sections"
    >
      {/* Frosted glass background bar */}
      <div className="bg-transparent/72 backdrop-blur-xl saturate-200 border-b border-white/[0.06]">
        <div className="mx-auto max-w-[1400px] px-3 sm:px-6 lg:px-8">
          {/* ─── DESKTOP: professional terminal horizontal bar with group dividers ─── */}
          <div className="hidden md:flex items-stretch gap-1 py-2 overflow-x-auto mtqs-no-scrollbar">
            {/* PRIMARY group */}
            <div className="flex items-center gap-0.5">
              {PRIMARY.map((s) => (
                <NavButton
                  key={s.id}
                  def={s}
                  active={active}
                  onClick={handlePick}
                />
              ))}
            </div>

            <GroupDivider />

            {/* USER OPERATIONS group */}
            <div className="flex items-center gap-0.5">
              {USER_OPS.map((s) => (
                <NavButton
                  key={s.id}
                  def={s}
                  active={active}
                  onClick={handlePick}
                  accent
                />
              ))}
            </div>

            <GroupDivider />

            {/* SUPPORTING group */}
            <div className="flex items-center gap-0.5">
              {SUPPORTING.map((s) => (
                <NavButton
                  key={s.id}
                  def={s}
                  active={active}
                  onClick={handlePick}
                />
              ))}
            </div>

            <GroupDivider />

            {/* SECONDARY — "More" dropdown (investors / pitch) */}
            <div className="relative flex items-center">
              <button
                onClick={() => setMoreOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[0.78rem] font-medium tracking-tight rounded-lg text-white/45 hover:text-white/80 hover:bg-white/[0.04] transition-colors duration-200"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-label="More sections"
              >
                <span className="text-[0.65rem] uppercase tracking-widest text-white/40">
                  More
                </span>
                <span
                  className={`text-white/40 transition-transform ${
                    moreOpen ? "rotate-90" : ""
                  }`}
                  aria-hidden
                >
                  ›
                </span>
              </button>
              <AnimatePresence initial={false}>
                {moreOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 top-full mt-1 z-50 min-w-[180px] rounded-xl border border-white/[0.08] bg-[#0a0d18]/95 backdrop-blur-xl shadow-2xl shadow-black/50 p-1"
                    role="menu"
                  >
                    <div className="px-2 py-1.5 text-[0.6rem] uppercase tracking-widest text-white/35">
                      Restricted
                    </div>
                    {SECONDARY.map((s) => {
                      const Icon = s.icon;
                      const isActive = s.id === active;
                      return (
                        <button
                          key={s.id}
                          onClick={() => handlePick(s.id)}
                          role="menuitem"
                          aria-label={isActive ? `${s.label} (current section)` : `${s.label} section`}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[0.78rem] font-medium transition-colors duration-150 ${
                            isActive
                              ? "bg-amber-400/10 text-mtqs-gold"
                              : "text-white/65 hover:bg-white/[0.05] hover:text-white/85"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {s.label}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ─── MOBILE: hamburger + current label ─── */}
          <div className="md:hidden flex items-center justify-between py-2.5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileOpen((v) => !v)}
                className="flex items-center justify-center rounded-lg p-2 text-mtqs-gold/80 hover:text-mtqs-gold hover:bg-white/[0.05] transition-colors duration-200"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <span className="text-sm font-semibold text-amber-100/90 tracking-tight">
                {activeLabel}
              </span>
            </div>
            <span className="text-[0.6rem] font-medium text-white/40 uppercase tracking-widest">
              {SECTIONS.length} sections
            </span>
          </div>

          {/* ─── MOBILE: grouped grid ─── */}
          <AnimatePresence initial={false}>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="md:hidden overflow-hidden"
              >
                <div className="max-h-[72vh] overflow-y-auto mtqs-scroll pb-4">
                  {NAV_GROUPS.map((group, gi) => (
                    <div key={group.key} className={gi > 0 ? "mt-3" : ""}>
                      <div className="px-1 pb-1.5 text-[0.6rem] uppercase tracking-widest text-white/40 font-semibold">
                        {group.label}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {group.items.map((s, i) => (
                          <MobileGridButton
                            key={s.id}
                            def={s}
                            index={i}
                            active={active}
                            onClick={handlePick}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* Secondary / restricted */}
                  <div className="mt-3">
                    <div className="px-1 pb-1.5 text-[0.6rem] uppercase tracking-widest text-white/40 font-semibold">
                      Restricted
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {SECONDARY.map((s, i) => (
                        <MobileGridButton
                          key={s.id}
                          def={s}
                          index={i}
                          active={active}
                          onClick={handlePick}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function NavButton({
  def,
  active,
  onClick,
  accent,
}: {
  def: SectionDef;
  active: SectionId;
  onClick: (id: SectionId) => void;
  accent?: boolean;
}) {
  const Icon = def.icon;
  const isActive = def.id === active;
  return (
    <button
      onClick={() => onClick(def.id)}
      className={`relative flex items-center gap-1.5 px-2.5 py-1.5 text-[0.78rem] font-medium tracking-tight rounded-lg transition-colors duration-200 whitespace-nowrap ${
        isActive
          ? accent
            ? "text-mtqs-gold"
            : "text-white"
          : "text-white/55 hover:text-white/85 hover:bg-white/[0.04]"
      }`}
      aria-pressed={isActive}
      aria-label={`${def.label} section`}
    >
      {isActive && (
        <motion.div
          layoutId={accent ? "mtqs-nav-pill-accent" : "mtqs-nav-pill"}
          className={`absolute inset-0 rounded-lg ${
            accent
              ? "bg-amber-400/12 border border-amber-400/25"
              : "bg-white/[0.06] border border-white/[0.08]"
          }`}
          transition={springTransition}
        />
      )}
      <Icon className="h-3.5 w-3.5 relative z-10" aria-hidden="true" />
      <span className="relative z-10">{def.label}</span>
    </button>
  );
}

function GroupDivider() {
  return (
    <div
      className="mx-1 self-stretch w-px bg-white/[0.08]"
      aria-hidden="true"
    />
  );
}

function MobileGridButton({
  def,
  index,
  active,
  onClick,
}: {
  def: SectionDef;
  index: number;
  active: SectionId;
  onClick: (id: SectionId) => void;
}) {
  const Icon = def.icon;
  const isActive = def.id === active;
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: index * 0.025,
        duration: 0.2,
        ease: [0.16, 1, 0.3, 1],
      }}
      onClick={() => onClick(def.id)}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3.5 transition-colors duration-200 ${
        isActive
          ? "bg-amber-400/15 text-mtqs-gold border border-amber-400/25"
          : "bg-white/[0.04] text-white/55 border border-white/[0.06] hover:bg-white/[0.07]"
      }`}
      aria-pressed={isActive}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span className="text-[0.68rem] font-medium leading-tight text-center">
        {def.label}
      </span>
    </motion.button>
  );
}
