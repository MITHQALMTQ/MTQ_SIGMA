/* eslint-disable react-hooks/set-state-in-effect -- first-load loader: syncs
   with sessionStorage and schedules timed fade-out; setState in timeouts is
   intentional (external-system sync pattern). */
"use client";

import { useState, useEffect } from "react";
import { BrandMark } from "@/components/landing/BrandMark";

// MTQΣ — Cinematic Pre-Loader
// Shows on FIRST page load only (not on section switches).
// Displays the official PAR1D.jpg luxury emblem inside rotating
// aurora rings for 1.5s, then fades out to reveal the page.
// The loader canvas is painted #020D1F so the emblem's own obsidian
// backdrop blends into a single seamless field.

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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020D1F] transition-opacity duration-700"
      style={{ opacity: fadeOut ? 0 : 1, pointerEvents: fadeOut ? "none" : "auto" }}
      role="status"
      aria-live="polite"
      aria-label="MTQΣ loading"
    >
      {/* Animated gold logo + aurora rings */}
      <div className="relative" style={{ width: 180, height: 180 }}>
        {/* Rotating aurora rings */}
        <svg viewBox="0 0 180 180" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="loader-aurora" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2BABFB" />
              <stop offset="33%" stopColor="#00E5FF" />
              <stop offset="66%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#3882F6" />
            </linearGradient>
            <filter id="loader-glow">
              <feGaussianBlur stdDeviation="3" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Outer ring */}
          <circle cx="90" cy="90" r="82" fill="none" stroke="url(#loader-aurora)" strokeWidth="1.2" opacity="0.45" filter="url(#loader-glow)">
            <animateTransform attributeName="transform" type="rotate" from="0 90 90" to="360 90 90" dur="3s" repeatCount="indefinite" />
          </circle>
          {/* Inner ring */}
          <circle cx="90" cy="90" r="68" fill="none" stroke="url(#loader-aurora)" strokeWidth="0.6" opacity="0.3">
            <animateTransform attributeName="transform" type="rotate" from="360 90 90" to="0 90 90" dur="4s" repeatCount="indefinite" />
          </circle>
        </svg>

        {/* Coin-badge BrandMark — platform-unified official logo, glowing
            inside the rotating aurora rings. */}
        <div
          className="absolute inset-0 flex items-center justify-center rounded-full overflow-hidden"
          style={{
            background: "#020D1F",
            boxShadow: "0 0 48px rgba(43,171,251,0.25), 0 0 0 1px rgba(43,171,251,0.18)",
          }}
        >
          <span role="img" aria-label="MTQΣ official logo" className="flex h-[150px] w-[150px] items-center justify-center">
            <BrandMark size={150} glow={false} />
          </span>
        </div>

        {/* Pulsing emerald line at base — keeps the "solvency" accent from the original loader */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-0.5 rounded-full bg-mtqs-emerald opacity-70" style={{
          animation: "mtqs-pulse 2s ease-in-out infinite",
          boxShadow: "0 0 8px rgba(0,229,255,0.5)",
        }} />
      </div>

      {/* Tagline */}
      <div className="absolute bottom-1/3 text-center">
        <div className="text-xs text-white/40 uppercase tracking-[0.3em] mt-2">The Global Digital Asset</div>
      </div>
    </div>
  );
}
