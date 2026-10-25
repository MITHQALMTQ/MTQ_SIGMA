/* eslint-disable react-hooks/set-state-in-effect -- first-load loader: syncs
   with sessionStorage and schedules timed fade-out; setState in timeouts is
   intentional (external-system sync pattern). */
"use client";

import { useState, useEffect } from "react";
import { BrandMark } from "@/components/landing/BrandMark";

// MTQΣ — Pre-Loader (fresh light redesign).
// Shows on FIRST page load only (not on section switches). The dark
// cinematic aurora-ring scene was retired with the dark theme; what remains
// is a calm 1.2s presentation of the official logo on paper white, then a
// quick fade-out to reveal the page.

export function CinematicLoader() {
  const [show, setShow] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Check if this is the first load (not a section switch)
    const loaded = sessionStorage.getItem("mtqs:loaded");
    if (loaded) {
      // Already shown once this session — never show again.
      setShow(false);
      return;
    }
    sessionStorage.setItem("mtqs:loaded", "true");
    setShow(true);

    // Start fade after 1.2s
    const t1 = setTimeout(() => setFadeOut(true), 1200);
    // Remove from DOM after 1.8s
    const t2 = setTimeout(() => setShow(false), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#FAFCFA] transition-opacity duration-700"
      style={{ opacity: fadeOut ? 0 : 1, pointerEvents: fadeOut ? "none" : "auto" }}
      role="status"
      aria-live="polite"
      aria-label="MTQΣ loading"
    >
      {/* Logo mark + quiet teal pulse */}
      <div className="relative flex flex-col items-center gap-6">
        <span role="img" aria-label="MTQΣ official logo" className="flex items-center justify-center">
          <BrandMark size={120} glow={false} />
        </span>
        <span
          className="h-0.5 w-16 rounded-full bg-[#0D9488] opacity-70"
          style={{ animation: "mtqs-pulse-dot 2s ease-in-out infinite" }}
        />

        {/* Tagline */}
        <div className="text-center">
          <div className="text-xs text-[#7A8C86] uppercase tracking-[0.3em] mt-2">The Global Digital Asset</div>
        </div>
      </div>
    </div>
  );
}
