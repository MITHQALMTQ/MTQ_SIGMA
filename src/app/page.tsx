// MTQΣ — Monetary Observatory · single-route Next.js 16 client component.
//
// Section-switching wrapper: Home · Dashboard · Contracts · Trial · Docs ·
// Investors · Pitch · Security · Tests. A single snapshot is polled every 4s
// and shared with Trial / Docs / Investor sections that need live data.
// Home and Dashboard sections fetch their own snapshot independently to keep
// their first-paint self-contained.
//
// Root wrapper: min-h-screen flex flex-col bg-[#080a0c] with starfield +
// radial glow background. Header + Navigation + AnimatePresence section
// switch + Footer (with mt-auto, sticky to viewport bottom on short content).

"use client";


import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Starfield } from "@/components/mtq/primitives";
import { Header, LiveTicker } from "@/components/mtq/Header";
import { Footer } from "@/components/mtq/Footer";
import { Navigation, type SectionId } from "@/components/mtq/Navigation";
import { HomeSection } from "@/components/mtq/sections/HomeSection";
import { DashboardSection } from "@/components/mtq/sections/DashboardSection";
import { ContractsSection } from "@/components/mtq/sections/ContractsSection";
import { TrialSection } from "@/components/mtq/sections/TrialSection";
import { DocsSection } from "@/components/mtq/sections/DocsSection";
import { InvestorSection } from "@/components/mtq/sections/InvestorSection";
import { PitchSection } from "@/components/mtq/sections/PitchSection";
import { SecuritySection } from "@/components/mtq/sections/SecuritySection";
import { TestsSection } from "@/components/mtq/sections/TestsSection";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

const POLL_MS = 4000;

export default function Page() {
  const [section, setSection] = useState<SectionId>("home");
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Fetch snapshot every 4s (shared with Trial / Docs / Investor sections).
  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics", { cache: "no-store" });
      if (!res.ok) throw new Error(`metrics ${res.status}`);
      const data = (await res.json()) as MetricsSnapshot;
      if (!mountedRef.current) return;
      setSnapshot(data);
      setError(null);
    } catch (e) {
      if (mountedRef.current) setError(String(e));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchSnapshot();
    const id = setInterval(fetchSnapshot, POLL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, [fetchSnapshot]);

  // Scroll to top of main on section change (so the section's first panel is in view).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const main = document.getElementById("mtqs-main");
    if (main) main.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }, [section]);

  const handleNavigate = useCallback((id: SectionId) => {
    setSection(id);
  }, []);

  // Oracle indicators for the Header (derived from shared snapshot).
  // (DashboardSection fetches its own oracle; the Header only needs the
  // shared snapshot's oraclePaused flag + a simple live count from the board.)
  const oracleValidCount = snapshot?.oracle?.pairs.filter((p) => !p.paused).length ?? 0;
  const oracleTotalCount = snapshot?.oracle?.pairs.length ?? 0;
  const oracleAnyPaused = snapshot?.oraclePaused ?? false;

  return (
    <div className="relative min-h-screen flex flex-col bg-[#080a0c] text-foreground overflow-hidden">
      {/* Background layers — starfield + radial glow + faint gold grid */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <Starfield />
        <div className="absolute inset-0 mtqs-radial-glow" />
        <div className="absolute inset-0 mtqs-grid-bg opacity-40" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header (sticky) */}
        <Header
          snapshot={snapshot}
          oracleValidCount={oracleValidCount}
          oracleTotalCount={oracleTotalCount}
          oracleAnyPaused={oracleAnyPaused}
          error={error}
        />
        {/* Live ticker strip (sticky) */}
        <LiveTicker snapshot={snapshot} />
        {/* Section navigation (sticky) */}
        <Navigation active={section} onChange={handleNavigate} />

        {/* Main content — section switch */}
        <main
          id="mtqs-main"
          className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-[1400px] w-full"
          role="main"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              transition={{ type: "spring", stiffness: 300, damping: 28, mass: 0.8 }}
            >
              {section === "home" && <HomeSection onNavigate={handleNavigate} />}
              {section === "dashboard" && <DashboardSection />}
              {section === "contracts" && <ContractsSection onNavigate={handleNavigate} />}
              {section === "trial" && (
                <TrialSection onNavigate={handleNavigate} snapshot={snapshot} />
              )}
              {section === "docs" && (
                <DocsSection onNavigate={handleNavigate} snapshot={snapshot} />
              )}
              {section === "investors" && (
                <InvestorSection onNavigate={handleNavigate} snapshot={snapshot} />
              )}
              {section === "pitch" && <PitchSection onNavigate={handleNavigate} />}
              {section === "security" && <SecuritySection onNavigate={handleNavigate} />}
              {section === "tests" && <TestsSection onNavigate={handleNavigate} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer — mt-auto pushes it to viewport bottom on short content */}
        <Footer />
      </div>
    </div>
  );
}
