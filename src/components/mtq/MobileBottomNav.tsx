// MTQΣ — Mobile Bottom Navigation
// 5 most important institutional actions: Overview, Reserve, Risk, Mint, Redeem
// (All other sections reachable via hamburger in the desktop-style top Navigation.)

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
      className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-white/[0.06] mtqs-glass backdrop-blur"
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
                className={`h-5 w-5 ${isActive ? "text-mtqs-gold" : "text-white/55"}`}
                aria-hidden
              />
              <span
                className={`text-[0.6rem] font-medium tracking-wide ${
                  isActive ? "text-mtqs-gold" : "text-white/55"
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
