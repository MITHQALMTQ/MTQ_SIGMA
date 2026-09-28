// MTQΣ — Sidebar Navigation (SIDEBAR-UI)
// Fixed left sidebar (desktop) / collapsible drawer (mobile).
// Replaces the old horizontal <Navigation /> top bar with a sovereign
// institutional-terminal layout: PAR1D brand → live status pill →
// grouped section tree (PROTOCOL / OPERATIONS / INSTITUTIONAL) →
// Cmd+K hint + honest-status badge.
//
// Design language: obsidian + gold + glassmorphism (mtqs-glass-premium
// family). Active item has a gold left border + gold tint. Hover has a
// subtle gold glow. The mobile hamburger is a floating glass button at
// the top-left (md:hidden) that opens the drawer via a transform.
//
// The drawer state is owned internally (per the SidebarProps contract);
// external components can request to open it by dispatching a
// `mtqs:open-sidebar` CustomEvent on window — used by the page-level
// mobile top bar so the page does not need to control the Sidebar's state.

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Vault,
  Shield,
  RefreshCw,
  Eye,
  Users,
  Plus,
  Minus,
  Activity,
  FlaskConical,
  Droplet,
  TrendingUp,
  CheckCircle,
  Lock,
  FileCode,
  Network,
  FileText,
  Code,
  Wallet,
  Presentation,
  Menu,
  X,
  Command,
} from "lucide-react";
import { BRAND_ASSETS, BRAND_VOICE, STATUS_COLORS } from "@/lib/mtq/brand";
import { fmtRatio, fmtUsdCompact } from "./format";
import type { SectionId } from "./Navigation";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

export interface SidebarProps {
  active: SectionId;
  onChange: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
  error: string | null;
}

type SectionDef = {
  id: SectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type SidebarGroup = {
  key: string;
  label: string;
  items: SectionDef[];
};

// ─── PROTOCOL — institutional terminal main navigation (7) ───────────
const PROTOCOL: SectionDef[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "reference", label: "Reference Index", icon: BookOpen },
  { id: "reserve", label: "Reserve Vault", icon: Vault },
  { id: "risk", label: "Risk State", icon: Shield },
  { id: "rebalancing", label: "Rebalancing", icon: RefreshCw },
  { id: "transparency", label: "Transparency", icon: Eye },
  { id: "governance", label: "Governance", icon: Users },
];

// ─── OPERATIONS — user-facing mint/redeem/activity (5) ───────────────
const OPERATIONS: SectionDef[] = [
  { id: "mint", label: "Mint Simulator", icon: Plus },
  { id: "redeem", label: "Redeem Simulator", icon: Minus },
  { id: "simulation", label: "Simulation Lab", icon: FlaskConical },
  { id: "activity", label: "Activity Explorer", icon: Activity },
  { id: "faucet", label: "Faucet", icon: Droplet },
];

// ─── INSTITUTIONAL — dashboard + validation + infra (9) ──────────────
// "Dashboard" maps to the `investors` section (renders InstitutionalDashboard
// + InvestorSection per page.tsx) — labelled "Dashboard" in the sidebar to
// match the SIDEBAR-UI spec.
const INSTITUTIONAL: SectionDef[] = [
  { id: "investors", label: "Dashboard", icon: TrendingUp },
  { id: "validation", label: "Validation", icon: CheckCircle },
  { id: "security", label: "Security", icon: Lock },
  { id: "contracts", label: "Contracts", icon: FileCode },
  { id: "networks", label: "Networks", icon: Network },
  { id: "docs", label: "Documentation", icon: FileText },
  { id: "developers", label: "Developers", icon: Code },
  { id: "portfolio", label: "Portfolio", icon: Wallet },
  { id: "pitch", label: "Pitch Deck", icon: Presentation },
];

const SIDEBAR_GROUPS: SidebarGroup[] = [
  { key: "protocol", label: "Protocol", items: PROTOCOL },
  { key: "operations", label: "Operations", items: OPERATIONS },
  { key: "institutional", label: "Institutional", items: INSTITUTIONAL },
];

// All section IDs the sidebar exposes (used for active-label lookup).
const ALL_SIDEBAR_ITEMS: SectionDef[] = [
  ...PROTOCOL,
  ...OPERATIONS,
  ...INSTITUTIONAL,
];

// Status → dot tone for the live status pill.
function statusTone(s: string | undefined): "emerald" | "amber" | "rose" {
  if (s === "NORMAL") return "emerald";
  if (s === "CAUTION" || s === "RECOVERY" || s === "STRESS") return "amber";
  return "rose";
}

function statusDotHex(tone: "emerald" | "amber" | "rose"): string {
  if (tone === "emerald") return "#3ddc97";
  if (tone === "amber") return "#ffb84d";
  return "#ff5d73";
}

export function Sidebar({ active, onChange, snapshot, error }: SidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // External open trigger — used by the page-level mobile top bar / any
  // other component that wants to reveal the drawer without owning state.
  useEffect(() => {
    const handler = () => setDrawerOpen(true);
    window.addEventListener("mtqs:open-sidebar", handler as EventListener);
    return () =>
      window.removeEventListener("mtqs:open-sidebar", handler as EventListener);
  }, []);

  // Close the drawer on Escape (mobile UX).
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const orig = document.body.style.overflow;
    if (drawerOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = orig;
    return () => {
      document.body.style.overflow = orig;
    };
  }, [drawerOpen]);

  const handlePick = (id: SectionId) => {
    onChange(id);
    setDrawerOpen(false);
  };

  // Open the global Cmd+K Command Launcher (it listens for the keyboard
  // shortcut itself, so we just synthesize the same event here).
  const openCmdK = () => {
    if (typeof window === "undefined") return;
    const ev = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(ev);
  };

  // Live status pill values
  const status = snapshot?.status ?? "NORMAL";
  const sc = STATUS_COLORS[status] ?? STATUS_COLORS.NORMAL;
  const tone = statusTone(status);
  const dotHex = statusDotHex(tone);
  const rrTxt = Number.isFinite(snapshot?.reserveRatio)
    ? fmtRatio(snapshot?.reserveRatio)
    : "∞";
  const navTxt = fmtUsdCompact(snapshot?.nav);

  const activeLabel =
    ALL_SIDEBAR_ITEMS.find((s) => s.id === active)?.label ?? "Overview";

  return (
    <>
      {/* ─── Mobile hamburger (floating, fixed top-left, md:hidden) ─── */}
      <button
        type="button"
        className={`mtqs-sidebar-hamburger md:hidden ${
          drawerOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        onClick={() => setDrawerOpen(true)}
        aria-label={`Open sidebar menu — current section: ${activeLabel}`}
        aria-expanded={drawerOpen}
        aria-controls="mtqs-sidebar"
        style={{ transition: "opacity 0.2s ease" }}
      >
        <Menu className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* ─── Mobile drawer scrim ─── */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            key="scrim"
            className="mtqs-sidebar-scrim md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* ─── Sidebar (fixed left on desktop, drawer on mobile) ─── */}
      <aside
        id="mtqs-sidebar"
        className={`mtqs-sidebar ${drawerOpen ? "is-open" : ""}`}
        role="navigation"
        aria-label="MTQΣ institutional sections"
      >
        {/* ── Brand lockup ── */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <div
            className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-black mtqs-logo-container"
            style={{
              boxShadow:
                "0 0 0 1px rgba(240,185,11,0.30), 0 0 18px rgba(240,185,11,0.22)",
            }}
            aria-label="MTQΣ logo mark"
          >
            <Image
              src={BRAND_ASSETS.logoCanonical}
              alt="MTQΣ official logo — luxury hexagonal Σ emblem with gold on obsidian"
              fill
              sizes="40px"
              className="object-contain mtqs-logo-image"
              style={{ objectFit: "contain" }}
              priority
            />
          </div>
          <div className="min-w-0 flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2">
              <span
                className="mtqs-display mtqs-gold-gradient-text text-xl font-semibold leading-none"
                style={{ fontWeight: 600 }}
              >
                MTQΣ
              </span>
              <span className="text-[0.55rem] font-mono text-mtqs-gold/70 tracking-wider">
                Σ-v1.2
              </span>
            </div>
            <span className="text-[0.58rem] tracking-[0.18em] uppercase text-white/55 truncate">
              {BRAND_VOICE.tagline}
            </span>
          </div>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="md:hidden ml-auto p-1.5 rounded-md text-white/55 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Gold divider */}
        <div className="mtqs-divider-gold mx-4" aria-hidden="true" />

        {/* ── Live status pill ── */}
        <div className="px-4 pt-3 pb-2">
          <div
            className="mtqs-sidebar-status-pill"
            aria-label={`Protocol status: ${sc.label} · Reserve Ratio: ${rrTxt} · NAV: ${navTxt}`}
          >
            <span
              className="inline-flex h-2 w-2 rounded-full"
              style={{
                backgroundColor: dotHex,
                boxShadow: `0 0 8px ${dotHex}`,
              }}
              aria-hidden="true"
            />
            <span
              className="uppercase tracking-wider"
              style={{ color: sc.color }}
            >
              {error ? "FEED ERR" : sc.label}
            </span>
            <span className="text-white/30">·</span>
            <span className="text-white/70">RR</span>
            <span className="text-white/95">{rrTxt}</span>
            <span className="text-white/30">·</span>
            <span className="text-white/70">NAV</span>
            <span className="text-mtqs-gold/95">{navTxt}</span>
          </div>
        </div>

        {/* ── Scrollable nav body ── */}
        <nav className="mtqs-sidebar-body" aria-label="Sidebar sections">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.key} className="mb-1">
              <div className="mtqs-sidebar-group" aria-hidden="true">
                {group.label}
              </div>
              <ul className="flex flex-col gap-0.5" role="list">
                {group.items.map((s) => {
                  const Icon = s.icon;
                  const isActive = s.id === active;
                  return (
                    <li key={s.id} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => handlePick(s.id)}
                        className={`mtqs-sidebar-item ${
                          isActive ? "mtqs-sidebar-item-active" : ""
                        }`}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={
                          isActive
                            ? `${s.label} (current section)`
                            : `${s.label} section`
                        }
                      >
                        <Icon
                          className="mtqs-sidebar-item-icon"
                          aria-hidden="true"
                        />
                        <span className="truncate">{s.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Footer: Cmd+K hint + honest status ── */}
        <div className="mtqs-sidebar-footer">
          <button
            type="button"
            className="mtqs-sidebar-cmdk"
            onClick={openCmdK}
            aria-label="Open command launcher (Cmd+K)"
          >
            <span className="flex items-center gap-1.5">
              <Command className="h-3 w-3" aria-hidden="true" />
              Command Launcher
            </span>
            <kbd>⌘K</kbd>
          </button>
          <div
            className="mtqs-sidebar-honest"
            title="Candidate for public testing — NOT production-authorized"
          >
            <span
              className="inline-flex h-1.5 w-1.5 rounded-full bg-mtqs-rose"
              style={{ boxShadow: "0 0 6px #ff4d6d" }}
              aria-hidden="true"
            />
            Not Production-Authorized
          </div>
        </div>
      </aside>
    </>
  );
}
