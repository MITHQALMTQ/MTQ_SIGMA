// MTQΣ landing — brand mark.
// Reference-accurate logo: a circular coin-badge — dark glass disc inside a
// neon gradient ring (cyan → blue → violet) — containing a sharp FACETED M
// built from two overlapping gradient chevrons (mountain form) with four
// crystalline facets: cyan → blue → indigo → violet.
export function BrandMark({
  size = 20,
  className = "",
  glow = true,
  bare = false,
}: {
  size?: number;
  className?: string;
  glow?: boolean;
  /** Render only the faceted M — no disc, no ring (globe emblem mode). */
  bare?: boolean;
}) {
  const uid = `bm${glow ? "g" : "n"}${bare ? "b" : ""}${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden
      style={
        glow
          ? {
              filter: `drop-shadow(0 0 ${size * 0.12}px rgba(34,211,238,0.34)) drop-shadow(0 0 ${size * 0.32}px rgba(139,92,246,0.30))`,
            }
          : undefined
      }
    >
      <defs>
        <linearGradient id={`${uid}-ring`} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset="0.5" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#a855f7" />
        </linearGradient>
        <radialGradient id={`${uid}-disc`} cx="42%" cy="32%" r="78%">
          <stop offset="0" stopColor="#15335c" />
          <stop offset="0.55" stopColor="#0a1e3f" />
          <stop offset="1" stopColor="#04101f" />
        </radialGradient>
        {/* four crystalline facets of the double-chevron M */}
        <linearGradient id={`${uid}-f1`} x1="8" y1="9" x2="29" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#48eefb" />
          <stop offset="1" stopColor="#0fb0e8" />
        </linearGradient>
        <linearGradient id={`${uid}-f2`} x1="18" y1="9" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3ec4f9" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id={`${uid}-f3`} x1="18" y1="9" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6d6ef5" />
          <stop offset="1" stopColor="#9257f8" />
        </linearGradient>
        <linearGradient id={`${uid}-f4`} x1="29" y1="9" x2="41" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#b465f8" />
          <stop offset="1" stopColor="#8b34f0" />
        </linearGradient>
      </defs>

      {/* badge disc — skipped in bare (globe emblem) mode */}
      {!bare && (
        <>
          <circle cx="24" cy="24" r="21.4" fill={`url(#${uid}-disc)`} />
          <ellipse cx="19.5" cy="15.5" rx="13" ry="8" fill="rgba(148,197,255,0.10)" />
        </>
      )}

      {/* faceted M — two overlapping chevrons (cyan-left / violet-right). */}
      <g>
        {!bare && (
          <g transform="translate(0 2.6)" opacity="0.9">
            <path d="M7.5 37.5 L18.5 9 L18.5 15 L7.5 40 Z" fill="#06182f" />
            <path d="M18.5 9 L29.5 37.5 L29.5 40 L18.5 15 Z" fill="#0a1f3c" />
            <path d="M18.5 37.5 L29.5 9 L29.5 15 L18.5 40 Z" fill="#0c1c3d" />
            <path d="M29.5 9 L40.5 37.5 L40.5 40 L29.5 15 Z" fill="#180f38" />
          </g>
        )}
        <path d="M7.5 37.5 L18.5 9 L18.5 15 L7.5 40 Z" fill={`url(#${uid}-f1)`} />
        <path d="M18.5 9 L29.5 37.5 L29.5 40 L18.5 15 Z" fill={`url(#${uid}-f2)`} />
        <path d="M18.5 37.5 L29.5 9 L29.5 15 L18.5 40 Z" fill={`url(#${uid}-f3)`} />
        <path d="M29.5 9 L40.5 37.5 L40.5 40 L29.5 15 Z" fill={`url(#${uid}-f4)`} />
      </g>

      {/* neon gradient ring — skipped in bare mode */}
      {!bare && (
        <>
          <circle cx="24" cy="24" r="22.2" fill="none" stroke={`url(#${uid}-ring)`} strokeWidth="2.3" />
          <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.9" />
          <circle cx="24" cy="24" r="23.3" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
        </>
      )}
    </svg>
  );
}
