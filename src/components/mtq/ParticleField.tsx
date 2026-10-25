"use client";

// MTQΣ — Particle Background (RETIRED with the dark cinematic theme).
// The owner's fresh-light directive ("alot of graphics") removed ambient
// particle graphics. The component is kept as a harmless no-op so every
// existing import continues to work; it renders nothing.

export function ParticleField({ count = 30 }: { count?: number }) {
  void count; // API compatibility only — nothing is rendered.
  return null;
}
