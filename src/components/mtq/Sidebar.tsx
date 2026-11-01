// MTQΣ — Sidebar Navigation (SIDEBAR-UI · "Sovereign Rail" premium pass)
// Fixed left rail (desktop) / collapsible drawer (mobile).
// Sovereign institutional-terminal layout: coin-badge BrandMark → live
// vitals widget (status · RR · NAV with pulse) → grouped section tree
// (PROTOCOL / OPERATIONS / INSTITUTIONAL, icon-chip items with gradient
// active indicator) → Cmd+K hint + honest-status chip.
//
// Design language: platform-unified (landing reference) — layered
// warm-neutral rail surface, hairline precision, teal brand accents,
// calm micro-interactions (no translate-on-hover, no heavy shadows —
// rich but never oppressive). Active item carries a gradient left
// indicator + teal wash + tinted icon chip. The nav is compacted so all
// 26 entries fit without internal scrolling on standard viewports (no
// wheel dead-zone); the mobile hamburger is a floating glass button at
// the top-left (md:hidden) that opens the drawer via a transform.
//
// The drawer state is owned internally (per the SidebarProps contract) and
// toggled by the mobile hamburger button below (16c-013: the external
// `mtqs:open-sidebar` CustomEvent listener was removed — no dispatcher for
// that event existed anywhere; the page-level mobile top bar it referenced
// was deleted in an earlier reorg).

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  BookOpen,
  Globe2,
  Landmark,
  Vault,
  Shield,
  RefreshCw,
  Eye,
  Users,
  CirclePlus,
  CircleMinus,
  Activity,
  FlaskConical,
  Coins,
  Droplet,
  TrendingUp,
  CheckCircle,
  ClipboardCheck,
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
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { BRAND_VOICE, STATUS_COLORS } from "@/lib/mtq/brand";
import { BrandMark } from "@/components/landing/BrandMark";
import { fmtRatio, fmtUsdCompact } from "./format";
import type { SectionId } from "./Navigation";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

export interface SidebarProps {
  active: SectionId;
  onChange: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
  error: string | null;
  /** Exit back to the landing site (rendered as a mobile-only button in the
      drawer footer — the desktop header already carries its own exit button). */
  onExit?: () => void;
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

// ─── PROTOCOL — institutional terminal main navigation (8) ───────────
const PROTOCOL: SectionDef[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "reference", label: "Reference Index", icon: BookOpen },
  { id: "constituency", label: "Constituency", icon: Globe2 },
  { id: "reserve", label: "Reserve Vault", icon: Vault },
  { id: "risk", label: "Risk State", icon: Shield },
  { id: "rebalancing", label: "Rebalancing", icon: RefreshCw },
  { id: "transparency", label: "Transparency", icon: Eye },
  { id: "governance", label: "Governance", icon: Users },
];

// ─── OPERATIONS — user-facing mint/redeem/activity + labs (6) ──────────
const OPERATIONS: SectionDef[] = [
  { id: "mint", label: "Mint Simulator", icon: CirclePlus },
  { id: "redeem", label: "Redeem Simulator", icon: CircleMinus },
  { id: "simulation", label: "Simulation Lab", icon: FlaskConical },
  { id: "issuance", label: "Issuance Lab", icon: Coins },
  { id: "activity", label: "Activity Explorer", icon: Activity },
  { id: "faucet", label: "Faucet", icon: Droplet },
];

// ─── INSTITUTIONAL — dashboard + validation + infra (12) ─────────────
// "Dashboard" maps to the `investors` section (renders InstitutionalDashboard
// + InvestorSection per page.tsx) — labelled "Dashboard" in the sidebar to
// match the SIDEBAR-UI spec.
const INSTITUTIONAL: SectionDef[] = [
  { id: "investors", label: "Dashboard", icon: TrendingUp },
  { id: "validation", label: "Validation", icon: CheckCircle },
  { id: "evidence", label: "Evidence Package", icon: ClipboardCheck },
  { id: "security", label: "Security", icon: Lock },
  { id: "contracts", label: "Contracts", icon: FileCode },
  { id: "authorization", label: "Authorization Audit", icon: ShieldCheck },
  { id: "networks", label: "Networks", icon: Network },
  { id: "docs", label: "Documentation", icon: FileText },
  { id: "architecture", label: "Architecture", icon: Landmark },
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
  if (tone === "emerald") return "#10B981";
  if (tone === "amber") return "#D97706";
  return "#E11D48";
}

export function Sidebar({ active, onChange, snapshot, error, onExit }: SidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        {/* ── Brand lockup (premium) ── */}
        <div className="mtqs-sidebar-brand flex items-center gap-3">
          <span className="shrink-0" role="img" aria-label="MTQΣ logo mark">
            <BrandMark size={38} />
          </span>
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
            <span className="text-[0.58rem] tracking-[0.18em] uppercase text-[#7A8C86] truncate">
              {BRAND_VOICE.tagline}
            </span>
          </div>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="md:hidden ml-auto p-1.5 rounded-md text-[#7A8C86] hover:text-[#0E1F1B] hover:bg-[#F0F7F4] transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Gold hairline separator */}
        <div className="mtqs-divider-gold" aria-hidden="true" />

        {/* ── Live vitals widget (status · RR · NAV) ── */}
        <div className="mtqs-sidebar-vitals">
          <div
            className="mtqs-sidebar-vitals-row"
            aria-label={`Protocol status: ${sc.label} · Reserve Ratio: ${rrTxt} · NAV: ${navTxt}`}
          >
            <span
              className="mtqs-pulse-dot"
              style={{
                backgroundColor: dotHex,
                color: dotHex,
              }}
              aria-hidden="true"
            />
            <span
              className="uppercase tracking-wider"
              style={{ color: sc.color }}
            >
              {error ? "FEED ERR" : sc.label}
            </span>
            <span className="text-[#B7C6C0]">·</span>
            <span className="text-[#7A8C86]">RR</span>
            <span className="text-[#0E1F1B]">{rrTxt}</span>
          </div>
          <div className="mtqs-sidebar-vitals-meta">
            <span>NAV</span>
            <b className="text-[#0F766E]">{navTxt}</b>
            <span className="ml-auto inline-flex items-center gap-1.5 normal-case tracking-normal text-[#8CA099] font-semibold">
              <span
                className="mtqs-pulse-dot"
                style={{ backgroundColor: "#0D9488", color: "#0D9488" }}
                aria-hidden="true"
              />
              LIVE
            </span>
          </div>
        </div>

        {/* ── Nav body — 26 entries at premium rhythm; overflow-y with thin
            custom scrollbar + edge fades is the graceful fallback on shorter
            viewports (fully visible on 1080p+ heights) ── */}
        <nav className="mtqs-sidebar-body" aria-label="Sidebar sections">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.key} className="mb-0.5">
              <div className="mtqs-sidebar-group" aria-hidden="true">
                {group.label}
              </div>
              <ul className="flex flex-col" role="list">
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
                        <span className="mtqs-sidebar-item-icon">
                          <Icon aria-hidden="true" />
                        </span>
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
          {onExit ? (
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                onExit();
              }}
              className="mtqs-sidebar-cmdk mtqs-sidebar-exit"
              aria-label="Back to the landing site"
            >
              <span className="flex items-center gap-1.5">
                <LogOut className="h-3 w-3" aria-hidden="true" />
                Back to Landing
              </span>
            </button>
          ) : null}
          <div
            className="mtqs-sidebar-honest"
            title="Candidate for public testing — NOT production-authorized"
          >
            <span className="mtqs-pulse-dot" aria-hidden="true" />
            Not Production-Authorized
          </div>
        </div>
      </aside>
    </>
  );
}
