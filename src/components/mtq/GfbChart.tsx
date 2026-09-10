"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

// MTQΣ — Live GFB Index Chart
// Aurora gradient line chart showing the GFB index value.
// In production, this would show 24h history; in the pilot, it shows
// the current value with a synthetic recent trajectory.

interface GfbChartProps {
  snapshot: MetricsSnapshot | null;
  height?: number;
}

export function GfbChart({ snapshot, height = 200 }: GfbChartProps) {
  const gfb = snapshot?.gfbIndex ?? 1.0;
  
  // Generate a synthetic 24h trajectory ending at the current GFB value
  const data = useMemo(() => {
    const points: { t: number; v: number }[] = [];
    const base = gfb;
    for (let i = 0; i < 48; i++) {
      const t = i / 47;
      // Smooth random walk that ends at the current value
      const noise = Math.sin(i * 0.3) * 0.002 + Math.sin(i * 0.7) * 0.001;
      const trend = (gfb - 1.0) * t;
      points.push({ t, v: 1.0 + trend + noise + (i === 47 ? (gfb - 1.0 - trend - noise) : 0) });
    }
    // Force the last point to be exactly the current GFB
    points[47] = { t: 1, v: gfb };
    return points;
  }, [gfb]);

  const minV = Math.min(...data.map(d => d.v));
  const maxV = Math.max(...data.map(d => d.v));
  const range = maxV - minV || 0.001;
  const pad = range * 0.2;
  const yMin = minV - pad;
  const yMax = maxV + pad;
  const yRange = yMax - yMin;

  const width = 100; // percentage-based viewBox
  const h = height;
  
  // Build the SVG path
  const path = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = h - ((d.v - yMin) / yRange) * h;
    return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
  
  // Area fill path
  const areaPath = path + ` L ${width} ${h} L 0 ${h} Z`;
  
  // Latest point
  const lastX = width;
  const lastY = h - ((data[data.length - 1].v - yMin) / yRange) * h;

  return (
    <div className="relative w-full" style={{ height: `${h}px` }}>
      <svg viewBox={`0 0 ${width} ${h}`} preserveAspectRatio="none" className="w-full h-full">
        <defs>
          <linearGradient id="gfb-aurora" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7B61FF" stopOpacity="0.6" />
            <stop offset="33%" stopColor="#2BD4E0" stopOpacity="0.8" />
            <stop offset="66%" stopColor="#00D68F" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#F0B90B" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="gfb-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F0B90B" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#F0B90B" stopOpacity="0" />
          </linearGradient>
          <filter id="gfb-glow">
            <feGaussianBlur stdDeviation="0.5" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1="0" y1={h * p} x2={width} y2={h * p} stroke="rgba(255,255,255,0.04)" strokeWidth="0.1" />
        ))}
        
        {/* Area fill */}
        <motion.path
          d={areaPath}
          fill="url(#gfb-area)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.5, delay: 0.3 }}
        />
        
        {/* Aurora line */}
        <motion.path
          d={path}
          fill="none"
          stroke="url(#gfb-aurora)"
          strokeWidth="0.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#gfb-glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
        />
        
        {/* Pulsing endpoint */}
        <motion.circle
          cx={lastX}
          cy={lastY}
          r="0.8"
          fill="#F0B90B"
          filter="url(#gfb-glow)"
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.5, 1] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
        />
      </svg>
      
      {/* Current value label */}
      <div className="absolute top-2 right-2 flex flex-col items-end">
        <div className="text-[0.6rem] text-white/55 uppercase tracking-wider">Reference Index</div>
        <div className="font-mono text-lg font-bold mtqs-gold-text tabular-nums">{gfb.toFixed(4)}</div>
      </div>
    </div>
  );
}
