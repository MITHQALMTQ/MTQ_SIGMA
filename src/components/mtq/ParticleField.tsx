"use client";

import { useMemo, useState, useEffect } from "react";

// MTQΣ — Gold Particle Background
// Floating gold particles drifting upward — like gold dust in deep space.
// Uses a deterministic seed on first render (server) + randomizes on client mount
// to avoid hydration mismatches.

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 2654435761 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

interface Particle {
  id: number;
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

export function ParticleField({ count = 30 }: { count?: number }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const particles: Particle[] = useMemo(() => {
    if (!mounted) {
      // Deterministic particles for SSR (seeded random)
      const rng = seededRandom(42);
      return Array.from({ length: count }, (_, i) => ({
        id: i,
        left: rng() * 100,
        size: 1 + rng() * 3,
        duration: 8 + rng() * 12,
        delay: rng() * 10,
        opacity: 0.1 + rng() * 0.3,
      }));
    }
    // Random particles on client (after mount — no hydration mismatch)
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 1 + Math.random() * 3,
      duration: 8 + Math.random() * 12,
      delay: Math.random() * 10,
      opacity: 0.1 + Math.random() * 0.3,
    }));
  }, [count, mounted]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-mtqs-gold"
          style={{
            left: `${p.left}%`,
            bottom: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 2}px rgba(240, 185, 11, 0.5)`,
            animation: `mtqs-particle-rise ${p.duration}s linear infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
