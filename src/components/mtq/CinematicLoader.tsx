"use client";

import { useState, useEffect } from "react";

// MTQΣ — Cinematic Pre-Loader
// Shows on FIRST page load only (not on section switches).
// Displays the animated gold sigma with aurora ring for 1.5s,
// then fades out to reveal the page.

export function CinematicLoader() {
  const [show, setShow] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Check if this is the first load (not a section switch)
    const loaded = sessionStorage.getItem("mtqs:loaded");
    if (loaded) {
      setShow(false);
      return;
    }
    sessionStorage.setItem("mtqs:loaded", "true");

    // Start fade after 1.2s
    const t1 = setTimeout(() => setFadeOut(true), 1200);
    // Remove from DOM after 1.8s
    const t2 = setTimeout(() => setShow(false), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#06080F] transition-opacity duration-700"
      style={{ opacity: fadeOut ? 0 : 1, pointerEvents: fadeOut ? "none" : "auto" }}
    >
      {/* Animated gold sigma + aurora rings */}
      <div className="relative" style={{ width: 120, height: 120 }}>
        {/* Rotating aurora rings */}
        <svg viewBox="0 0 120 120" className="absolute inset-0 w-full h-full">
          <defs>
            <linearGradient id="loader-aurora" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F0B90B" />
              <stop offset="33%" stopColor="#00D68F" />
              <stop offset="66%" stopColor="#7B61FF" />
              <stop offset="100%" stopColor="#2BD4E0" />
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
          <circle cx="60" cy="60" r="50" fill="none" stroke="url(#loader-aurora)" strokeWidth="1" opacity="0.4" filter="url(#loader-glow)">
            <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="3s" repeatCount="indefinite" />
          </circle>
          {/* Inner ring */}
          <circle cx="60" cy="60" r="40" fill="none" stroke="url(#loader-aurora)" strokeWidth="0.5" opacity="0.3">
            <animateTransform attributeName="transform" type="rotate" from="360 60 60" to="0 60 60" dur="4s" repeatCount="indefinite" />
          </circle>
        </svg>
        {/* Gold sigma */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl font-bold mtqs-gold-text" style={{
            animation: "mtqs-pulse 1.5s ease-in-out infinite",
          }}>
            Σ
          </span>
        </div>
        {/* Pulsing emerald line at base */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-0.5 rounded-full bg-mtqs-emerald opacity-60" style={{
          animation: "mtqs-pulse 2s ease-in-out infinite",
          boxShadow: "0 0 8px rgba(0,214,143,0.5)",
        }} />
      </div>
      {/* Tagline */}
      <div className="absolute bottom-1/3 text-center">
        <div className="text-xs text-white/40 uppercase tracking-[0.3em] mt-2">The Global Purchasing Power Unit</div>
      </div>
    </div>
  );
}
