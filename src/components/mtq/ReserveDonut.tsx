/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
"use client";

import { motion } from "framer-motion";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

// MTQΣ — Reserve Composition Donut Chart
// 3D-perspective donut showing the 7-component Strategic Prior basket.

interface ReserveDonutProps {
  snapshot: MetricsSnapshot | null;
  size?: number;
}

const COMPONENTS = [
  { name: "USD", weight: 0.27, color: "#F0B90B" },
  { name: "EUR", weight: 0.20, color: "#00D68F" },
  { name: "Gold", weight: 0.26, color: "#FCD535" },
  { name: "JPY", weight: 0.09, color: "#2BD4E0" },
  { name: "GBP", weight: 0.08, color: "#7B61FF" },
  { name: "CNY", weight: 0.05, color: "#FF8C42" },
  { name: "CHF", weight: 0.05, color: "#FF4D6D" },
];

export function ReserveDonut({ snapshot, size = 200 }: ReserveDonutProps) {
  const radius = 40;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  
  const segments = COMPONENTS.map((comp) => { const dash = comp.weight * circumference; return { comp, dash }; }); let _offset = 0;
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <defs>
          <filter id="donut-glow">
            <feGaussianBlur stdDeviation="0.5" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        {/* Background ring */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
        
        {/* Component segments */}
        {COMPONENTS.map((comp, i) => {
          const dash = (comp.weight * circumference);
          const segment = (
            <motion.circle
              key={comp.name}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={comp.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              filter="url(#donut-glow)"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: "center" }}
            />
          );
          offset += dash;
          return segment;
        })}
      </svg>
      
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[0.6rem] text-white/55 uppercase tracking-wider">NAV</div>
        <div className="font-mono text-lg font-bold text-white tabular-nums">
          {snapshot ? `$${(snapshot.nav / 1000).toFixed(1)}K` : "—"}
        </div>
        <div className="text-[0.55rem] text-white/30 mt-0.5">7 components</div>
      </div>
    </div>
  );
}
