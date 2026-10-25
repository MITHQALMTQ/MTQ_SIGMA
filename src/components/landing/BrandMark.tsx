// MTQΣ landing — brand mark (fresh light redesign).
// The neon cyan→blue→violet gradient ring and glow shadows were retired
// with the dark theme. The mark keeps its shape — a dark disc containing
// the faceted M (double chevron) — now in the fresh spring-teal family
// with a simple hairline ring. Flat, crisp, readable on white.
export function BrandMark({
  size = 20,
  className = "",
  glow = false,
  bare = false,
}: {
  size?: number;
  className?: string;
  /** Legacy prop — glows are retired; accepted for API compatibility. */
  glow?: boolean;
  /** Render only the faceted M — no disc, no ring (globe emblem mode). */
  bare?: boolean;
}) {
  const uid = `bm${bare ? "b" : ""}${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
    >
      <defs>
        {/* disc — deep ink */}
        <radialGradient id={`${uid}-disc`} cx="42%" cy="32%" r="78%">
          <stop offset="0" stopColor="#17382F" />
          <stop offset="0.55" stopColor="#122822" />
          <stop offset="1" stopColor="#0E1F1B" />
        </radialGradient>
        {/* four crystalline facets of the double-chevron M — fresh teal ramp */}
        <linearGradient id={`${uid}-f1`} x1="8" y1="9" x2="29" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="1" stopColor="#14B8A6" />
        </linearGradient>
        <linearGradient id={`${uid}-f2`} x1="18" y1="9" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id={`${uid}-f3`} x1="18" y1="9" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
        <linearGradient id={`${uid}-f4`} x1="29" y1="9" x2="41" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0D9488" />
          <stop offset="1" stopColor="#115E59" />
        </linearGradient>
      </defs>

      {/* badge disc — skipped in bare (globe emblem) mode */}
      {!bare && (
        <>
          <circle cx="24" cy="24" r="21.4" fill={`url(#${uid}-disc)`} />
          <ellipse cx="19.5" cy="15.5" rx="13" ry="8" fill="rgba(94,234,212,0.10)" />
        </>
      )}

      {/* faceted M — two overlapping teal chevrons */}
      <g>
        {!bare && (
          <g transform="translate(0 2.6)" opacity="0.9">
            <path d="M7.5 37.5 L18.5 9 L18.5 15 L7.5 40 Z" fill="#0B1B16" />
            <path d="M18.5 9 L29.5 37.5 L29.5 40 L18.5 15 Z" fill="#0F241E" />
            <path d="M18.5 37.5 L29.5 9 L29.5 15 L18.5 40 Z" fill="#122B24" />
            <path d="M29.5 9 L40.5 37.5 L40.5 40 L29.5 15 Z" fill="#1B0F2E" />
          </g>
        )}
        <path d="M7.5 37.5 L18.5 9 L18.5 15 L7.5 40 Z" fill={`url(#${uid}-f1)`} />
        <path d="M18.5 9 L29.5 37.5 L29.5 40 L18.5 15 Z" fill={`url(#${uid}-f2)`} />
        <path d="M18.5 37.5 L29.5 9 L29.5 15 L18.5 40 Z" fill={`url(#${uid}-f3)`} />
        <path d="M29.5 9 L40.5 37.5 L40.5 40 L29.5 15 Z" fill={`url(#${uid}-f4)`} />
      </g>

      {/* simple teal ring — skipped in bare mode */}
      {!bare && (
        <>
          <circle cx="24" cy="24" r="22.2" fill="none" stroke="#0D9488" strokeWidth="2.3" />
          <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="0.9" />
        </>
      )}
    </svg>
  );
}
