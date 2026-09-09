// MTQΣ — Constitutional Separation radial diagram
// The blueprint's signature concept (§1.1): the GFB Index defines what one
// MTQΣ is intended to represent; the reserve portfolio exists to collateralize
// that obligation. Three concentric rings: (A) GFB Index, (B) MTQΣ Token,
// (C) Reserve. The active ring pulses based on the live status.

"use client";

import { motion } from "framer-motion";
import { TickNumber } from "./primitives";
import { fmtFixed, fmtRatio, fmtUsdCompact } from "./format";
import { STATUS_COLORS } from "@/lib/mtq/brand";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

export function ConstitutionalSeparation({
  snapshot,
  className = "",
}: {
  snapshot: MetricsSnapshot | null;
  className?: string;
}) {
  const status = snapshot?.status ?? "NORMAL";

  // Each ring has a "stress" tone — by status, the reserve ring brightens.
  // Brand STATUS_COLORS keep the palette tight (no orange): emerald / amber /
  // light-rose / rose.
  const reserveTone = (STATUS_COLORS[status] ?? STATUS_COLORS.NORMAL).color;

  return (
    <div className={`relative aspect-square w-full max-w-[520px] mx-auto ${className}`}>
      <svg
        viewBox="0 0 520 520"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        role="img"
        aria-label="Constitutional Separation diagram: three concentric rings labeled A GFB Index, B MTQΣ Token, C Reserve, with the active ring pulsing by protocol status."
      >
        <defs>
          <radialGradient id="mtqs-aurora" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(232, 185, 100, 0.10)" />
            <stop offset="55%" stopColor="rgba(232, 185, 100, 0.02)" />
            <stop offset="100%" stopColor="rgba(232, 185, 100, 0)" />
          </radialGradient>
          <linearGradient id="mtqs-gold-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f5d27a" />
            <stop offset="50%" stopColor="#e8b964" />
            <stop offset="100%" stopColor="#b8860b" />
          </linearGradient>
          <linearGradient id="mtqs-emerald-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6effc0" />
            <stop offset="50%" stopColor="#3ddc97" />
            <stop offset="100%" stopColor="#16a97a" />
          </linearGradient>
          <linearGradient id="mtqs-reserve-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#9fb0a3" />
            <stop offset="50%" stopColor="#7d9082" />
            <stop offset="100%" stopColor="#54665a" />
          </linearGradient>
          <filter id="mtqs-glow-filter" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Aurora backdrop */}
        <circle cx="260" cy="260" r="250" fill="url(#mtqs-aurora)" />

        {/* Faint outer tick ring (observatory feel) */}
        <g className="mtqs-spin-slower" style={{ transformOrigin: "260px 260px" }}>
          {[...Array(60)].map((_, i) => {
            const a = (i / 60) * Math.PI * 2;
            const r1 = 240;
            const r2 = i % 5 === 0 ? 232 : 236;
            const x1 = 260 + r1 * Math.cos(a);
            const y1 = 260 + r1 * Math.sin(a);
            const x2 = 260 + r2 * Math.cos(a);
            const y2 = 260 + r2 * Math.sin(a);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i % 5 === 0 ? "rgba(232, 185, 100, 0.45)" : "rgba(232, 185, 100, 0.15)"}
                strokeWidth={i % 5 === 0 ? 1.4 : 0.7}
              />
            );
          })}
        </g>

        {/* Ring A — GFB Index (outermost) */}
        <g className="mtqs-spin-slow" style={{ transformOrigin: "260px 260px" }}>
          <circle
            cx="260"
            cy="260"
            r="210"
            fill="none"
            stroke="url(#mtqs-gold-ring)"
            strokeWidth="1.2"
            strokeDasharray="3 10"
            opacity="0.6"
          />
          <circle
            cx="260"
            cy="260"
            r="210"
            fill="none"
            stroke="url(#mtqs-gold-ring)"
            strokeWidth="2.4"
            opacity="0.85"
            filter="url(#mtqs-glow-filter)"
          />
          {/* Active arc — pulses */}
          <motion.circle
            cx="260"
            cy="260"
            r="210"
            fill="none"
            stroke="#f5d27a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="60 1257"
            strokeDashoffset={0}
            filter="url(#mtqs-glow-filter)"
            animate={{ opacity: [0.4, 1, 0.4], rotate: 360 }}
            transition={{
              opacity: { duration: 2.4, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: 24, repeat: Infinity, ease: "linear" },
            }}
            style={{ transformOrigin: "260px 260px" }}
          />
        </g>

        {/* Ring B — MTQΣ Token (middle) */}
        <g className="mtqs-spin-slower" style={{ transformOrigin: "260px 260px" }}>
          <circle
            cx="260"
            cy="260"
            r="155"
            fill="none"
            stroke="url(#mtqs-emerald-ring)"
            strokeWidth="1.2"
            strokeDasharray="2 8"
            opacity="0.55"
          />
          <circle
            cx="260"
            cy="260"
            r="155"
            fill="none"
            stroke="url(#mtqs-emerald-ring)"
            strokeWidth="2"
            opacity="0.8"
            filter="url(#mtqs-glow-filter)"
          />
          <motion.circle
            cx="260"
            cy="260"
            r="155"
            fill="none"
            stroke="#6effc0"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="40 935"
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "260px 260px" }}
          />
        </g>

        {/* Ring C — Reserve (inner) — tone by status */}
        <g className="mtqs-spin-slow" style={{ transformOrigin: "260px 260px" }}>
          <circle
            cx="260"
            cy="260"
            r="100"
            fill="none"
            stroke="url(#mtqs-reserve-ring)"
            strokeWidth="1"
            strokeDasharray="2 6"
            opacity="0.45"
          />
          <motion.circle
            cx="260"
            cy="260"
            r="100"
            fill="none"
            stroke={reserveTone}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray="30 598"
            filter="url(#mtqs-glow-filter)"
            animate={{
              opacity: status === "NORMAL" ? [0.6, 0.95, 0.6] : [0.4, 1, 0.4],
              rotate: 360,
            }}
            transition={{
              opacity: { duration: status === "NORMAL" ? 3.2 : 1.4, repeat: Infinity, ease: "easeInOut" },
              rotate: { duration: 18, repeat: Infinity, ease: "linear" },
            }}
            style={{ transformOrigin: "260px 260px" }}
          />
        </g>

        {/* Center sigil */}
        <g>
          <circle cx="260" cy="260" r="44" fill="rgba(232, 185, 100, 0.04)" stroke="rgba(232, 185, 100, 0.25)" />
          <text
            x="260"
            y="270"
            textAnchor="middle"
            fontSize="42"
            fontFamily="var(--font-geist-mono), monospace"
            fill="url(#mtqs-gold-ring)"
            filter="url(#mtqs-glow-filter)"
          >
            Σ
          </text>
        </g>

        {/* Ring labels with leader dots */}
        {/* A — GFB Index */}
        <g>
          <circle cx="260" cy="50" r="4" fill="#f5d27a" />
          <text x="260" y="32" textAnchor="middle" fontSize="11" fill="#f5d27a" fontFamily="var(--font-geist-sans), sans-serif" letterSpacing="3">
            A · GFB INDEX
          </text>
          <text x="260" y="70" textAnchor="middle" fontSize="14" fill="#e8b964" fontFamily="var(--font-geist-mono), monospace" fontWeight="600">
            {snapshot ? fmtFixed(snapshot.gfbIndex, 4) : "—"}
          </text>
        </g>

        {/* B — MTQΣ Token (left side) */}
        <g>
          <circle cx="50" cy="260" r="4" fill="#6effc0" />
          <text x="36" y="248" textAnchor="middle" fontSize="11" fill="#6effc0" fontFamily="var(--font-geist-sans), sans-serif" letterSpacing="3">
            B
          </text>
          <text x="36" y="266" textAnchor="middle" fontSize="10" fill="#3ddc97" fontFamily="var(--font-geist-sans), sans-serif" letterSpacing="2">
            MTQΣ
          </text>
          <text x="36" y="282" textAnchor="middle" fontSize="11" fill="#3ddc97" fontFamily="var(--font-geist-mono), monospace" fontWeight="600">
            {snapshot ? `$${fmtFixed(snapshot.mtqPrice, 4)}` : "—"}
          </text>
        </g>

        {/* C — Reserve (right side) */}
        <g>
          <circle cx="470" cy="260" r="4" fill={reserveTone} />
          <text x="486" y="248" textAnchor="middle" fontSize="11" fill={reserveTone} fontFamily="var(--font-geist-sans), sans-serif" letterSpacing="3">
            C
          </text>
          <text x="486" y="266" textAnchor="middle" fontSize="10" fill={reserveTone} fontFamily="var(--font-geist-sans), sans-serif" letterSpacing="2">
            RESERVE
          </text>
          <text x="486" y="282" textAnchor="middle" fontSize="11" fill={reserveTone} fontFamily="var(--font-geist-mono), monospace" fontWeight="600">
            {snapshot ? fmtUsdCompact(snapshot.nav) : "—"}
          </text>
        </g>

        {/* Bottom — RR readout */}
        <g>
          <text x="260" y="488" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.5)" fontFamily="var(--font-geist-sans), sans-serif" letterSpacing="3">
            RESERVE RATIO
          </text>
          <text
            x="260"
            y="506"
            textAnchor="middle"
            fontSize="14"
            fill={reserveTone}
            fontFamily="var(--font-geist-mono), monospace"
            fontWeight="700"
          >
            {snapshot
              ? Number.isFinite(snapshot.reserveRatio)
                ? fmtRatio(snapshot.reserveRatio)
                : "∞ — fully reserved"
              : "—"}
          </text>
        </g>
      </svg>

      {/* Side readout card overlay (desktop) */}
      <div className="hidden md:block absolute top-1/2 -translate-y-1/2 -left-2 -translate-x-full pr-4 text-right">
        <div className="text-[0.6rem] uppercase tracking-[0.25em] text-white/40 mb-1">Active Ring</div>
        <div className="font-mono text-sm" style={{ color: reserveTone }}>
          {status === "NORMAL" ? "C · steady" : `${status} · ${status === "EMERGENCY" ? "C · drain" : "C · elevated"}`}
        </div>
      </div>
    </div>
  );
}
