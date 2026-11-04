// MTQΣ — Mobile Bottom Navigation
// 5 most important institutional actions: Overview, Reserve, Risk, Mint, Redeem.
// TASK-37 R3 — comment aligned with the Command-Rail layout: all other 21
// sections are reachable via the floating hamburger → sidebar drawer
// (Sidebar.tsx, md:hidden off-canvas with scrim + Escape). Labels stay short
// ("Reserve", "Risk") — the sidebar carries the full labels
// ("Reserve Vault", "Risk State").

"use client";
import { LayoutDashboard, Vault, Shield, Plus, Minus } from "lucide-react";
import type { SectionId } from "./Navigation";

const NAV_ITEMS: { id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "reserve", label: "Reserve", icon: Vault },
  { id: "risk", label: "Risk", icon: Shield },
  { id: "mint", label: "Mint", icon: Plus },
  { id: "redeem", label: "Redeem", icon: Minus },
];

export function MobileBottomNav({
  active,
  onNavigate,
}: {
  active: SectionId;
  onNavigate: (id: SectionId) => void;
}) {
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-[#E3EAE6] mtqs-glass"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Mobile section navigation"
    >
      <div className="flex items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="relative flex flex-col items-center justify-center gap-0.5 py-2 px-2 flex-1 min-w-0 mtqs-focus"
              aria-label={`${item.label} section`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "text-mtqs-gold" : "text-[#5B6E68]"}`}
                aria-hidden
              />
              <span
                className={`text-[0.6rem] font-medium tracking-wide ${
                  isActive ? "text-mtqs-gold" : "text-[#5B6E68]"
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <div
                  className="absolute -top-px h-0.5 w-8 rounded-full bg-mtqs-gold"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
