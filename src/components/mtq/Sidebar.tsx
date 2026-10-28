// MTQΣ — Command Rail sidebar (COMMAND-RAIL redesign, 2026-10-26).
// Owner directive: high-end, upscale, modern, top-of-line — one coherent
// design language; never fragmented; never overwhelming.
//
// ARCHITECTURE
// • Two desktop modes: "full" (292px, labels) and "rail" (80px, icons).
//   Mode state is owned by the parent (PilotCommandCenter) so the main
//   content margin transitions in lock-step; it persists in localStorage.
// • Mobile (<768px): off-canvas drawer — always full layout, scrim + Escape.
// • Rail mode shows instant fixed-position tooltips (hover + keyboard focus),
//   which cannot be clipped by the scroll container.
//
// INFORMATION ARCHITECTURE — 5 semantic groups, all 26 sections reachable:
//   COMMAND     (8) — what the protocol is doing right now
//   OPERATIONS  (7) — what a pilot user does
//   ASSURANCE   (4) — proof it works
//   PLATFORM    (5) — how it is built
//   RESTRICTED  (2) — gated internal surfaces (lock-marked)
//
// Honesty is a layout rule here: the "Not Production-Authorized" strip is
// pinned in the footer OUTSIDE the scroll area — always visible, any height.
//
// Truth posture (unchanged): TESTNET ONLY · SHADOW MODE ENFORCED · RESERVE
// TRADING NOT AUTHORIZED. No wallet SDK, no signer, no transaction.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  Plus,
  Minus,
  Activity,
  FlaskConical,
  Coins,
  Droplet,
  TrendingUp,
  CheckCircle2,
  ClipboardCheck,
  Lock,
  FileCode,
  ShieldCheck,
  Network,
  FileText,
  Code,
  Wallet,
  Presentation,
  Menu,
  X,
  Search,
  ArrowLeft,
  Lock as LockMini,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { BRAND_VOICE, STATUS_COLORS } from "@/lib/mtq/brand";
import { BrandMark } from "@/components/landing/BrandMark";
import { fmtRatio, fmtUsdCompact } from "./format";
import type { SectionId } from "./Navigation";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

export type SidebarMode = "full" | "rail";

export interface SidebarProps {
  active: SectionId;
  onChange: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
  error: string | null;
  /** Desktop layout mode ("full" labels | "rail" icons). Owned by the parent
   *  so the main-content margin transitions together with the rail. */
  mode: SidebarMode;
  onModeChange: (mode: SidebarMode) => void;
  /** Exit back to the landing site — rendered in the drawer footer on mobile
   *  (the desktop header carries its own exit button). */
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
  /** Restricted surfaces get a quiet lock mark on the group header. */
  locked?: boolean;
  items: SectionDef[];
};

// ─── COMMAND — live protocol state surfaces (8) ────────────────────────
const COMMAND: SectionDef[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "reference", label: "Reference Index", icon: BookOpen },
  { id: "reserve", label: "Reserve Vault", icon: Vault },
  { id: "risk", label: "Risk State", icon: Shield },
  { id: "rebalancing", label: "Rebalancing", icon: RefreshCw },
  { id: "constituency", label: "Constituency", icon: Globe2 },
  { id: "governance", label: "Governance", icon: Users },
  { id: "transparency", label: "Transparency", icon: Eye },
];

// ─── OPERATIONS — what a pilot user does (7) ───────────────────────────
const OPERATIONS: SectionDef[] = [
  { id: "mint", label: "Mint", icon: Plus },
  { id: "redeem", label: "Redeem", icon: Minus },
  { id: "portfolio", label: "Portfolio", icon: Wallet },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "simulation", label: "Simulation Lab", icon: FlaskConical },
  { id: "issuance", label: "Issuance Lab", icon: Coins },
  { id: "faucet", label: "Faucet", icon: Droplet },
];

// ─── ASSURANCE — proof it works (4) ────────────────────────────────────
const ASSURANCE: SectionDef[] = [
  { id: "validation", label: "Validation", icon: CheckCircle2 },
  { id: "evidence", label: "Evidence Package", icon: ClipboardCheck },
  { id: "security", label: "Security", icon: Lock },
  { id: "authorization", label: "Authorization Audit", icon: ShieldCheck },
];

// ─── PLATFORM — how it is built (5) ────────────────────────────────────
const PLATFORM: SectionDef[] = [
  { id: "contracts", label: "Contracts", icon: FileCode },
  { id: "networks", label: "Networks", icon: Network },
  { id: "architecture", label: "Architecture", icon: Landmark },
  { id: "docs", label: "Documentation", icon: FileText },
  { id: "developers", label: "Developers", icon: Code },
];

// ─── RESTRICTED — gated internal surfaces (2) ──────────────────────────
// "investors" renders the Institutional Dashboard; "pitch" the Pitch Deck.
const RESTRICTED: SectionDef[] = [
  { id: "investors", label: "Investor Dashboard", icon: TrendingUp },
  { id: "pitch", label: "Pitch Deck", icon: Presentation },
];

const SIDEBAR_GROUPS: SidebarGroup[] = [
  { key: "command", label: "Command", items: COMMAND },
  { key: "operations", label: "Operations", items: OPERATIONS },
  { key: "assurance", label: "Assurance", items: ASSURANCE },
  { key: "platform", label: "Platform", items: PLATFORM },
  { key: "restricted", label: "Restricted", locked: true, items: RESTRICTED },
];

const ALL_SIDEBAR_ITEMS: SectionDef[] = SIDEBAR_GROUPS.flatMap((g) => g.items);

// Status → dot tone for the live capsule.
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

export function Sidebar({
  active,
  onChange,
  snapshot,
  error,
  mode,
  onModeChange,
  onExit,
}: SidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; label: string } | null>(null);

  const isRail = mode === "rail";

  /* Close the drawer on Escape (mobile UX). */
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawerOpen]);

  /* Lock body scroll while the mobile drawer is open. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const orig = document.body.style.overflow;
    if (drawerOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = orig;
    return () => {
      document.body.style.overflow = orig;
    };
  }, [drawerOpen]);

  const handlePick = useCallback(
    (id: SectionId) => {
      onChange(id);
      setDrawerOpen(false);
    },
    [onChange],
  );

  /* Open the global Cmd+K Command Launcher (it listens for the keyboard
     shortcut itself, so we synthesize the same event here). */
  const openCmdK = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
    );
  }, []);

  /* Rail tooltips — fixed-position (never clipped by the scroll body).
     Shown on hover AND keyboard focus; desktop rail only. */
  const showTip = useCallback(
    (label: string, el: HTMLElement) => {
      if (!isRail || drawerOpen) return;
      if (typeof window === "undefined") return;
      if (!window.matchMedia("(min-width: 768px)").matches) return;
      const r = el.getBoundingClientRect();
      setTip({ x: r.right + 12, y: r.top + r.height / 2, label });
    },
    [isRail, drawerOpen],
  );
  const hideTip = useCallback(() => {
    setTip(null);
  }, []);

  const toggleMode = useCallback(() => {
    setTip(null); // drop any open tooltip before the layout flips
    onModeChange(isRail ? "full" : "rail");
  }, [isRail, onModeChange]);

  /* Live capsule values */
  const status = snapshot?.status ?? "NORMAL";
  const sc = STATUS_COLORS[status] ?? STATUS_COLORS.NORMAL;
  const tone = statusTone(status);
  const dotHex = statusDotHex(tone);
  const statusLabel = error ? "FEED ERROR" : sc.label;
  const statusLabelColor = error ? "#BE123C" : sc.color;
  const rrTxt = Number.isFinite(snapshot?.reserveRatio)
    ? fmtRatio(snapshot?.reserveRatio)
    : "∞";
  const navTxt = fmtUsdCompact(snapshot?.nav);

  const statusTip = `Status: ${statusLabel} · RR ${rrTxt} · NAV ${navTxt}`;

  return (
    <>
      {/* ─── Mobile hamburger (floating, fixed top-left, md:hidden) ─── */}
      <button
        type="button"
        className="mtqs-sidebar-hamburger"
        onClick={() => {
          setTip(null);
          setDrawerOpen(true);
        }}
        aria-label="Open sidebar menu"
        aria-expanded={drawerOpen}
        aria-controls="mtqs-sidebar"
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

      {/* ─── Sidebar (fixed left; full ↔ rail on desktop, drawer on mobile) ─── */}
      <aside
        id="mtqs-sidebar"
        className={`mtqs-sidebar ${drawerOpen ? "is-open" : ""}`}
        data-mode={mode}
        role="navigation"
        aria-label="MTQΣ Pilot Command Center sections"
      >
        {/* ── Brand row ── */}
        <div className="mtqs-sb-brand">
          <span className="shrink-0" role="img" aria-label="MTQΣ logo mark">
            <BrandMark size={38} />
          </span>
          <div className="mtqs-sb-brand-lockup">
            <div className="flex items-baseline gap-2">
              <span
                className="mtqs-sb-brand-name mtqs-gold-gradient-text"
                style={{ fontWeight: 700 }}
              >
                MTQΣ
              </span>
              <span className="mtqs-sb-brand-ver">Σ-v1.2</span>
            </div>
            <span className="mtqs-sb-brand-tag">{BRAND_VOICE.tagline}</span>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="mtqs-sb-close ml-auto"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* ── Live status capsule ── */}
        <div
          className="mtqs-sb-status"
          aria-label={`Protocol status: ${statusLabel} · Reserve Ratio: ${rrTxt} · NAV: ${navTxt}`}
          onMouseEnter={(e) => showTip(statusTip, e.currentTarget)}
          onMouseLeave={hideTip}
          onFocus={(e) => showTip(statusTip, e.currentTarget)}
          onBlur={hideTip}
          tabIndex={-1}
        >
          <span className="mtqs-sb-status-top" style={{ color: statusLabelColor }}>
            <span
              className="mtqs-sb-dot"
              style={{ backgroundColor: dotHex, color: dotHex }}
              aria-hidden="true"
            />
            <span className="truncate">{statusLabel}</span>
          </span>
          <span className="mtqs-sb-status-metrics">
            <span className="lbl">RR</span>
            <span>{rrTxt}</span>
            <span className="sep">·</span>
            <span className="lbl">NAV</span>
            <span style={{ color: "#0F766E" }}>{navTxt}</span>
          </span>
        </div>

        {/* ── Nav body ── */}
        <nav className="mtqs-sb-nav" aria-label="Sidebar sections">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.key}>
              <div className="mtqs-sb-group" aria-hidden="true">
                <span className="mtqs-sb-group-label">{group.label}</span>
                {group.locked ? (
                  <LockMini className="mtqs-sb-group-lock h-2.5 w-2.5" aria-hidden="true" />
                ) : null}
                <span className="mtqs-sb-group-count">{group.items.length}</span>
              </div>
              <ul className="flex flex-col" role="list">
                {group.items.map((s) => {
                  const Icon = s.icon;
                  const isActive = s.id === active;
                  return (
                    <li key={s.id} role="none">
                      <button
                        type="button"
                        onClick={() => handlePick(s.id)}
                        className={`mtqs-sb-item ${
                          isActive ? "mtqs-sb-item-active" : ""
                        }`}
                        aria-current={isActive ? "page" : undefined}
                        aria-label={
                          isActive
                            ? `${s.label} (current section)`
                            : `${s.label} section`
                        }
                        onMouseEnter={(e) => showTip(s.label, e.currentTarget)}
                        onMouseLeave={hideTip}
                        onFocus={(e) => showTip(s.label, e.currentTarget)}
                        onBlur={hideTip}
                      >
                        <Icon className="mtqs-sb-item-icon" aria-hidden="true" />
                        <span className="mtqs-sb-item-label">{s.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Footer: search · honest strip · utilities ── */}
        <div className="mtqs-sb-footer">
          <button
            type="button"
            className="mtqs-sb-search"
            onClick={openCmdK}
            aria-label="Open command launcher (Cmd+K)"
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="mtqs-sb-search-label">Search sections…</span>
            <kbd>⌘K</kbd>
          </button>

          <div
            className="mtqs-sb-honest"
            title="Candidate for public testing — NOT production-authorized"
            aria-label="Pilot status: not production-authorized"
          >
            <span
              className="mtqs-sb-dot"
              style={{ backgroundColor: "#E11D48", color: "#E11D48" }}
              aria-hidden="true"
            />
            <span className="truncate">Not Production-Authorized</span>
          </div>

          {/* Desktop mode toggle — CSS-owned visibility
              (.mtqs-sb-desktop-only; see TASK-37 cascade fix in globals.css). */}
          <button
            type="button"
            className="mtqs-sb-utility mtqs-sb-desktop-only"
            onClick={toggleMode}
            aria-label={
              isRail ? "Expand sidebar to full labels" : "Collapse sidebar to icon rail"
            }
            aria-pressed={isRail}
          >
            {isRail ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
            <span className="grow">{isRail ? "Expand" : "Collapse"}</span>
          </button>

          {/* Mobile: back to landing — TASK-37 R1 language alignment
              (ArrowLeft, mirroring the header + footer exit controls).
              CSS-owned visibility (.mtqs-sb-mobile-only). */}
          {onExit ? (
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                onExit();
              }}
              className="mtqs-sb-utility mtqs-sb-mobile-only"
              aria-label="Back to the landing site"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="grow">Back to Landing</span>
            </button>
          ) : null}
        </div>

        {/* Rail tooltip — fixed-position, so it is never clipped. */}
        {tip ? (
          <div
            className="mtqs-sb-tip"
            style={{ left: tip.x, top: tip.y }}
            role="tooltip"
          >
            {tip.label}
          </div>
        ) : null}
      </aside>
    </>
  );
}
