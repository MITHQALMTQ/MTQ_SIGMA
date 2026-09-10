// MTQΣ — The Global Purchasing Power Unit
// 2026 Futuristic UI: cinematic entry, glassmorphic panels, dynamic sections
// Single-route Next.js 16 client component with View Transitions API

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MotionConfig } from "framer-motion";

import { Header, LiveTicker } from "@/components/mtq/Header";
import { Footer } from "@/components/mtq/Footer";
import { Navigation, type SectionId } from "@/components/mtq/Navigation";
import { CinematicLoader } from '@/components/mtq/CinematicLoader';
import { MobileBottomNav } from "@/components/mtq/MobileBottomNav";
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

// Cinematic section transitions
const sectionVariants = {
  initial: { opacity: 0, scale: 0.96, filter: "blur(12px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 1.04, filter: "blur(8px)" },
};

export default function Page() {
  const [section, setSection] = useState<SectionId>("home");
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

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
    return () => { mountedRef.current = false; clearInterval(id); };
  }, [fetchSnapshot]);

  // Scroll to top on section change (cinematic reset)
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [section]);

  const handleNavigate = useCallback((id: SectionId) => {
    setSection(id);
  }, []);

  return (
    <>
    <CinematicLoader />
    <MotionConfig reducedMotion="user" transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
      <div className="relative min-h-screen flex flex-col overflow-hidden mtqs-space-bg mtqs-cinematic-page">
        {/* Futuristic grid backdrop */}
        <div className="pointer-events-none fixed inset-0 mtqs-grid-bg" aria-hidden="true" />

        {/* Header + Ticker */}
        <Header snapshot={snapshot} oracleValidCount={snapshot?.oracle?.pairs.filter(p => !p.paused).length ?? 0} oracleTotalCount={snapshot?.oracle?.pairs.length ?? 0} oracleAnyPaused={snapshot?.oracle?.anyPaused ?? false} error={error} />
        <LiveTicker snapshot={snapshot} />
        <Navigation active={section} onChange={handleNavigate} />

        {/* Main content with cinematic transitions */}
        <main id="mtqs-main" className="relative z-10 flex-1 mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-16 md:pb-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              variants={sectionVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              {section === "home" && <HomeSection onNavigate={handleNavigate} />}
              {section === "dashboard" && <DashboardSection />}
              {section === "contracts" && <ContractsSection onNavigate={handleNavigate} />}
              {section === "trial" && <TrialSection onNavigate={handleNavigate} snapshot={snapshot} />}
              {section === "docs" && <DocsSection onNavigate={handleNavigate} snapshot={snapshot} />}
              {section === "investors" && <InvestorSection onNavigate={handleNavigate} snapshot={snapshot} />}
              {section === "pitch" && <PitchSection onNavigate={handleNavigate} />}
              {section === "security" && <SecuritySection onNavigate={handleNavigate} />}
              {section === "tests" && <TestsSection onNavigate={handleNavigate} />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Footer */}
        <Footer />

        {/* Mobile bottom nav */}
        <MobileBottomNav active={section} onNavigate={handleNavigate} />
      </div>
    </MotionConfig>
    </>
  );
}
