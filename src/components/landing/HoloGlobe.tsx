// MTQΣ landing — holographic globe centerpiece (v8 cinematic rebuild).
// A server-rendered SVG scene (no WebGL, sharp at any DPI). v8 fixes the
// "cut screenshot" feel: the SVG no longer clips its glow (lp-scene-svg →
// overflow visible) so orbital rings, platform rings and halos bleed softly
// into the page instead of being chopped at a rectangular boundary, and the
// scene gains volumetric ground light, chromatic rim separation, deeper
// scatter bloom and softer satellites — light behaves like it is IN air.
import { Landmark, BrainCircuit, Link2, Users } from "lucide-react";
import { GLOBE_DOT_PATHS, GLOBE_NODES, GLOBE_ARCS } from "./globe-dots";
import { GLOBE_COASTS } from "./globe-coasts";
import { HERO_PANELS } from "@/lib/mtq/landing-status";

const PANEL_ICONS = {
  landmark: Landmark,
  brain: BrainCircuit,
  link: Link2,
  users: Users,
} as const;

// Desktop positions hug the globe corners per the reference composition —
// top two beside the upper hemisphere, lower two at mid-height near the glow base.
const PANEL_POS = [
  "lg:-left-[6%] lg:top-[4%] xl:-left-[8%] xl:top-[3%]",
  "lg:-right-[6%] lg:top-[2%] xl:-right-[8%] xl:top-[1%]",
  "lg:-left-[8%] lg:top-[42%] xl:-left-[10%] xl:top-[41%]",
  "lg:-right-[8%] lg:top-[47%] xl:-right-[10%] xl:top-[46%]",
] as const;

/* ------------------------------------------------------------------ */
/* scene geometry                                                      */
/* ------------------------------------------------------------------ */
const CX = 320;
const CY = 300;
const R = 246; // sphere radius (viewBox 640×800)
const PFC = { x: 320, y: 700 }; // platform center

const rad = (d: number) => (d * Math.PI) / 180;

type Ring = {
  rx: number;
  ry: number;
  rot: number;
  stroke: string;
  glow: string;
  back: string;
  width: number;
  front: "left" | "right";
  sats: { t: number; r: number; cls: string }[];
  travelDur: number;
};

function ringPoint(rx: number, ry: number, rot: number, t: number): [number, number] {
  const c = Math.cos(rad(t));
  const s = Math.sin(rad(t));
  const x0 = rx * c;
  const y0 = ry * s;
  const cr = Math.cos(rad(rot));
  const sr = Math.sin(rad(rot));
  // 2-decimal rounding keeps the server-rendered SVG attribute string and
  // the client-computed number byte-identical (float→string shortest-repr
  // differs between runtimes and trips React hydration otherwise).
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return [r2(CX + x0 * cr - y0 * sr), r2(CY + x0 * sr + y0 * cr)];
}

// Elegant elliptical rings with luminous edges + satellites. Sizes kept
// inside the composition; with overflow visible nothing is hard-clipped.
const RINGS: Ring[] = [
  {
    rx: 312,
    ry: 80,
    rot: -17,
    stroke: "#46e2ff",
    glow: "rgba(34,211,238,0.5)",
    back: "rgba(34,211,238,0.26)",
    width: 2.3,
    front: "right",
    sats: [
      { t: 70, r: 7, cls: "lp-sat" },
      { t: 22, r: 5.5, cls: "lp-sat" },
    ],
    travelDur: 10,
  },
  {
    rx: 336,
    ry: 96,
    rot: 35,
    stroke: "#b79cff",
    glow: "rgba(167,139,250,0.45)",
    back: "rgba(167,139,250,0.22)",
    width: 2,
    front: "left",
    sats: [
      { t: 125, r: 6.5, cls: "lp-sat" },
      { t: 160, r: 4.8, cls: "lp-sat" },
    ],
    travelDur: 14,
  },
  {
    rx: 360,
    ry: 118,
    rot: 53,
    stroke: "#5da8ff",
    glow: "rgba(93,168,250,0.4)",
    back: "rgba(93,168,250,0.20)",
    width: 1.6,
    front: "right",
    sats: [
      { t: 55, r: 5, cls: "lp-sat" },
      { t: 75, r: 4, cls: "lp-sat" },
    ],
    travelDur: 18,
  },
];

function frontArcD(ring: Ring) {
  const sweep = ring.front === "right" ? 1 : 0;
  return `M 0 ${-ring.ry} A ${ring.rx} ${ring.ry} 0 0 ${sweep} 0 ${ring.ry}`;
}

export function PanelCard({
  panel,
  delay = 0,
}: {
  panel: (typeof HERO_PANELS)[number];
  delay?: number;
}) {
  const Icon = PANEL_ICONS[panel.icon];
  return (
    <div
      className="lp-holo-panel"
      style={{ animationDelay: `${delay}s` }}
      aria-label={`${panel.title}: ${panel.subtitle}`}
    >
      <div className="flex items-center gap-2.5">
        <span className="lp-icon-chip !h-9 !w-9 !rounded-lg">
          <Icon className="size-4" strokeWidth={1.9} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[0.78rem] font-semibold leading-snug text-white">{panel.title}</p>
          <p className="text-[0.66rem] font-medium leading-tight text-[#8fd8f2]">{panel.subtitle}</p>
        </div>
      </div>
    </div>
  );
}

/* deterministic bokeh particles */
const BOKEH = [
  { x: 150, y: 148, r: 4, c: "rgba(147,222,255,0.5)", o: 0.8, d: 0.4, dur: 5.2 },
  { x: 520, y: 92, r: 3, c: "rgba(196,181,253,0.5)", o: 0.7, d: 1.2, dur: 6.1 },
  { x: 566, y: 430, r: 4.5, c: "rgba(147,222,255,0.45)", o: 0.75, d: 2.1, dur: 4.8 },
  { x: 92, y: 388, r: 3.4, c: "rgba(196,181,253,0.45)", o: 0.7, d: 0.9, dur: 5.6 },
  { x: 205, y: 566, r: 4.2, c: "rgba(147,222,255,0.4)", o: 0.65, d: 1.7, dur: 6.4 },
  { x: 474, y: 585, r: 3, c: "rgba(165,243,252,0.55)", o: 0.8, d: 2.6, dur: 4.4 },
  { x: 138, y: 246, r: 2.6, c: "rgba(165,243,252,0.5)", o: 0.7, d: 0.2, dur: 5.9 },
  { x: 508, y: 244, r: 3.6, c: "rgba(147,222,255,0.42)", o: 0.7, d: 3.1, dur: 5.1 },
  { x: 78, y: 512, r: 3, c: "rgba(196,181,253,0.4)", o: 0.6, d: 1.4, dur: 6.6 },
  { x: 586, y: 330, r: 2.8, c: "rgba(165,243,252,0.5)", o: 0.7, d: 2.3, dur: 5.4 },
];

const SPOKES = Array.from({ length: 18 }, (_, i) => {
  const t = (i * 360) / 18;
  const c = Math.cos(rad(t));
  const s = Math.sin(rad(t));
  // 2-decimal rounding — deterministic server/client serialization.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    x1: r2(PFC.x + 84 * c),
    y1: r2(PFC.y + 21 * s),
    x2: r2(PFC.x + 274 * c),
    y2: r2(PFC.y + 66 * s),
  };
});

const PLATFORM_RINGS = [
  { rx: 84, ry: 21, stroke: "#8bf3ff", w: 5.4, op: 1 },
  { rx: 148, ry: 36, stroke: "#4fd0fc", w: 3.8, op: 0.95 },
  { rx: 210, ry: 51, stroke: "#97a6fa", w: 3, op: 0.8 },
  { rx: 274, ry: 66, stroke: "#b79cff", w: 2.5, op: 0.65 },
];

export function HoloGlobe() {
  return (
    <div
      className="relative mx-auto aspect-[4/5] w-full max-w-[380px] sm:max-w-[470px] lg:max-w-[560px] xl:max-w-[620px]"
      aria-label="Holographic globe illustration — a visual depiction of the protocol's intended scope, not an operational network"
      role="img"
    >
      <div className="lp-globe-glow" aria-hidden />

      {/* lp-scene-svg = overflow:visible — the scene bleeds past its box,
          nothing is chopped, no rectangular "screenshot" boundary exists. */}
      <svg
        viewBox="0 0 640 800"
        className="lp-scene-svg absolute inset-0 h-full w-full"
        aria-hidden
      >
        <defs>
          {/* luminous glass sphere — reference reads as a bright plasma-blue
              marble (bright-cell averages #206cc4…#3886d1, luminous rim). */}
          <radialGradient id="lp-sphere-fill" cx="40%" cy="26%" r="94%">
            <stop offset="0%" stopColor="#5b9df5" />
            <stop offset="24%" stopColor="#3474dc" />
            <stop offset="54%" stopColor="#1c4daa" />
            <stop offset="82%" stopColor="#0e2f6e" />
            <stop offset="100%" stopColor="#081f4e" />
          </radialGradient>
          <radialGradient id="lp-spec" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d7f1ff" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#a5e2ff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#a5e2ff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lp-shade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#020814" stopOpacity="0" />
            <stop offset="80%" stopColor="#020814" stopOpacity="0" />
            <stop offset="100%" stopColor="#020814" stopOpacity="0.55" />
          </radialGradient>
          <radialGradient id="lp-core-shade" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#031034" stopOpacity="0.14" />
            <stop offset="55%" stopColor="#031034" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#031034" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lp-vig" cx="50%" cy="50%" r="50%">
            <stop offset="78%" stopColor="transparent" />
            <stop offset="100%" stopColor="#01040c" stopOpacity="0.22" />
          </radialGradient>
          {/* volumetric floor light — the platform spill that lights the ground */}
          <radialGradient id="lp-spill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.5" />
            <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="lp-rim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8be4ff" />
            <stop offset="45%" stopColor="#46c8fb" />
            <stop offset="100%" stopColor="#b79cff" />
          </linearGradient>
          <linearGradient id="lp-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a5f3fc" stopOpacity="0" />
            <stop offset="55%" stopColor="#67e8f9" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#cffafe" stopOpacity="0.9" />
          </linearGradient>
          {/* emblem M — two overlapping chevrons → four crystalline facets.
              Reference proportions: wider than tall (≈1.42:1), apex
              separation ≈36% of width, deep middle notch (≈57% of height). */}
          <linearGradient id="lp-mf1" x1="2" y1="7" x2="17" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#7de4ff" />
            <stop offset="1" stopColor="#2b8df8" />
          </linearGradient>
          <linearGradient id="lp-mf2" x1="17" y1="7" x2="32" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4fb4fc" />
            <stop offset="1" stopColor="#2f7bf8" />
          </linearGradient>
          <linearGradient id="lp-mf3" x1="19" y1="7" x2="34" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#8874ff" />
            <stop offset="1" stopColor="#8f4bf7" />
          </linearGradient>
          <linearGradient id="lp-mf4" x1="34" y1="7" x2="49" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#bc74ff" />
            <stop offset="1" stopColor="#8b34f0" />
          </linearGradient>
          <linearGradient id="lp-streak" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="35%" stopColor="#eaf9ff" stopOpacity="0.66" />
            <stop offset="62%" stopColor="#bde9ff" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="lp-pfcore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#bdf4ff" stopOpacity="0.8" />
            <stop offset="45%" stopColor="#67d8ff" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#67e8f9" stopOpacity="0" />
          </radialGradient>
          <clipPath id="lp-sphere-clip">
            <circle cx={CX} cy={CY} r={R - 4} />
          </clipPath>
          <filter id="lp-blur" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
          {/* tight glow for the emblem letter — must NOT flood the valley
              between the two M peaks (scaled ~5.1× by the emblem group) */}
          <filter id="lp-emblem-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.05" />
          </filter>
          <filter id="lp-blur-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
          <filter id="lp-blur-halo" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <path id="lp-dots-rim" d={GLOBE_DOT_PATHS[0]} />
          <path id="lp-dots-mid" d={GLOBE_DOT_PATHS[1]} />
          <path id="lp-dots-core" d={GLOBE_DOT_PATHS[2]} />
        </defs>

        {/* ── deep scatter bloom — light scattering in the air around the
              whole sphere (cinematic "air glow", widest layer) ────────── */}
        <g className="lp-flare-soft">
          <circle cx={CX} cy={CY} r={R + 130} fill="rgba(37,110,231,0.13)" filter="url(#lp-blur-halo)" />
        </g>

        {/* ── atmosphere halo — tight, bright, plasma-blue ──────────── */}
        <g className="lp-flare-soft">
          <circle cx={CX} cy={CY} r={R + 26} fill="none" stroke="rgba(72,161,255,0.42)" strokeWidth="26" filter="url(#lp-blur-halo)" />
          <circle cx={CX} cy={CY} r={R + 10} fill="none" stroke="rgba(103,232,249,0.4)" strokeWidth="16" filter="url(#lp-blur-halo)" />
          <circle cx={CX} cy={CY} r={R + 62} fill="none" stroke="rgba(139,92,246,0.3)" strokeWidth="26" filter="url(#lp-blur-halo)" />
          <circle cx={CX} cy={CY} r={R - 20} fill="rgba(43,116,231,0.3)" filter="url(#lp-blur-halo)" />
        </g>

        {/* ── orbital rings — BACK halves (dimmer, fading with depth) ── */}
        {RINGS.map((ring) => (
          <g key={`back-${ring.rot}`} transform={`translate(${CX} ${CY}) rotate(${ring.rot})`}>
            <ellipse cx="0" cy="0" rx={ring.rx} ry={ring.ry} fill="none" stroke={ring.glow} strokeWidth={ring.width * 4.2} opacity="0.28" filter="url(#lp-blur-soft)" />
            <ellipse cx="0" cy="0" rx={ring.rx} ry={ring.ry} fill="none" stroke={ring.back} strokeWidth={ring.width} opacity="0.6" filter="url(#lp-blur)" />
          </g>
        ))}

        {/* ── the glass sphere ───────────────────────────────────── */}
        <circle cx={CX} cy={CY} r={R} fill="url(#lp-sphere-fill)" />
        <ellipse cx={CX + 88} cy={CY - 116} rx="190" ry="148" fill="url(#lp-spec)" />
        <ellipse cx={CX + 58} cy={CY - 128} rx="54" ry="30" transform={`rotate(-30 ${CX + 58} ${CY - 128})`} fill="#eaf9ff" opacity="0.55" filter="url(#lp-blur)" />
        <ellipse cx={CX + 88} cy={CY - 150} rx="16" ry="9" transform={`rotate(-30 ${CX + 88} ${CY - 150})`} fill="#ffffff" opacity="0.7" filter="url(#lp-blur)" />

        {/* graticule + point-cloud continents — generated geometry is in a
            600-viewBox at (300,300), shifted into place */}
        <g clipPath="url(#lp-sphere-clip)">
          <g transform={`translate(${CX - 300} ${CY - 300})`}>
            {/* glass body sheen + faint lat/long grid — the reference shows
                subtle meridian/parallel lines on the luminous sphere */}
            <g stroke="rgba(147,214,255,0.10)" strokeWidth="1" fill="none">
              <ellipse cx="300" cy="300" rx="40" ry="244" />
              <ellipse cx="300" cy="300" rx="90" ry="244" />
              <ellipse cx="300" cy="300" rx="140" ry="244" />
              <ellipse cx="300" cy="300" rx="190" ry="244" />
              <ellipse cx="300" cy="300" rx="220" ry="244" />
              <line x1="300" y1="56" x2="300" y2="544" />
              {[-60, -40, -20, 0, 20, 40, 60].map((deg) => {
                const r2 = (v: number) => Math.round(v * 100) / 100;
                const lat = (deg * Math.PI) / 180;
                const cy = r2(300 - 244 * Math.sin(lat) * 0.94);
                const rx = r2(244 * Math.cos(lat));
                return <ellipse key={deg} cx="300" cy={cy} rx={rx} ry={r2(rx * 0.3)} />;
              })}
            </g>

            {/* soft luminous landmass haze — NO crisp coast outlines in the
                reference; continents read as glowing dot clusters instead */}
            <g fill="none" strokeLinecap="round" strokeLinejoin="round">
              <g stroke="#38bdf8" strokeWidth="5.6" opacity="0.4" filter="url(#lp-blur-soft)">
                {GLOBE_COASTS.map((d) => (
                  <path key={`c1-${d.slice(1, 12)}`} d={d} />
                ))}
              </g>
            </g>

            {/* connectivity network — soft arcs + glowing city nodes */}
            <g stroke="rgba(125,211,252,0.32)" strokeWidth="1.1" fill="none">
              {GLOBE_ARCS.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
            {GLOBE_NODES.map(([x, y]) => (
              <g key={`${x}-${y}`}>
                <circle cx={x} cy={y} r="7.4" fill="rgba(103,232,249,0.6)" filter="url(#lp-blur)" />
                <circle cx={x} cy={y} r="3" fill="#f0fdff" />
              </g>
            ))}

            {/* Earth-at-Night point-cloud continents — bright cyan, white and
                violet luminous points with soft bloom (reference palette) */}
            <use href="#lp-dots-core" fill="#e2c6ff" opacity="0.55" filter="url(#lp-blur-soft)" />
            <use href="#lp-dots-rim" fill="rgba(56,189,248,0.9)" />
            <use href="#lp-dots-mid" fill="rgba(147,236,255,1)" />
            <use href="#lp-dots-core" fill="#ffffff" />
          </g>
        </g>

        {/* luminous Fresnel rim + chromatic separation (lens-like fringe) */}
        <circle cx={CX} cy={CY} r={R} fill="url(#lp-core-shade)" />
        <circle cx={CX} cy={CY} r={R} fill="url(#lp-shade)" />
        <circle cx={CX} cy={CY} r={R - 6} fill="none" stroke="rgba(158,224,255,0.45)" strokeWidth="12" filter="url(#lp-blur)" />
        {/* chromatic fringe — cyan & violet copies of the rim, offset ±2px */}
        <path d={`M ${CX - 224} ${CY - 150} A ${R} ${R} 0 0 1 ${CX} ${CY - R}`} fill="none" stroke="#5eead4" strokeWidth="2.6" opacity="0.5" filter="url(#lp-blur)" transform="translate(-2.5 -1.5)" />
        <path d={`M ${CX + 224} ${CY + 150} A ${R} ${R} 0 0 1 ${CX} ${CY + R}`} fill="none" stroke="#c4b5fd" strokeWidth="2.6" opacity="0.5" filter="url(#lp-blur)" transform="translate(2.5 1.5)" />
        <circle cx={CX} cy={CY} r={R - 1} fill="none" stroke="url(#lp-rim)" strokeWidth="3.2" opacity="1" />
        <path d={`M ${CX - 224} ${CY - 150} A ${R} ${R} 0 0 1 ${CX} ${CY - R}`} fill="none" stroke="#c3eeff" strokeWidth="4.4" opacity="0.75" filter="url(#lp-blur)" />
        <path d={`M ${CX + 224} ${CY + 150} A ${R} ${R} 0 0 1 ${CX} ${CY + R}`} fill="none" stroke="#d3c6ff" strokeWidth="4" opacity="0.65" filter="url(#lp-blur)" />
        <circle cx={CX} cy={CY} r={R} fill="url(#lp-vig)" />

        {/* ── center emblem — faceted gradient M on the globe ────── */}
        <g>
          <circle cx={CX} cy={CY - 58} r="176" fill="url(#lp-pfcore)" opacity="0.9" />
          {/* the M — two overlapping chevrons → four crystalline facets.
              Chevron A: (2,40)→(17,7)→(32,40); chevron B: shifted +17.
              Wide stance, deep notch — reads unmistakably as M. */}
          <g transform={`translate(${CX - 130} ${CY - 185}) scale(5.1)`}>
            {/* dark bed — lets the letter's counter (negative space) read
                dark against the luminous sphere so the M silhouette pops */}
            <ellipse cx="25.5" cy="24" rx="31" ry="23" fill="#040f26" opacity="0.62" filter="url(#lp-emblem-glow)" />
            {/* glow underlay — tight, follows the strokes only */}
            <g fill="#39d7ff" opacity="0.32" filter="url(#lp-emblem-glow)">
              <path d="M2 35.5 L17 7 L17 16 L2 40 Z" />
              <path d="M17 7 L32 35.5 L32 40 L17 16 Z" />
              <path d="M19 35.5 L34 7 L34 16 L19 40 Z" />
              <path d="M34 7 L49 35.5 L49 40 L34 16 Z" />
            </g>
            {/* dark extruded under-edge → 3D volume */}
            <g transform="translate(0 1)" fill="#04102a" opacity="0.92">
              <path d="M2 35.5 L17 7 L17 16 L2 40 Z" />
              <path d="M17 7 L32 35.5 L32 40 L17 16 Z" />
              <path d="M19 35.5 L34 7 L34 16 L19 40 Z" />
              <path d="M34 7 L49 35.5 L49 40 L34 16 Z" />
            </g>
            {/* four crystalline facets — pure fills, rounded outer edges */}
            <g strokeLinejoin="round" strokeWidth="1.1" paintOrder="stroke">
              <path d="M2 35.5 L17 7 L17 16 L2 40 Z" fill="url(#lp-mf1)" stroke="url(#lp-mf1)" />
              <path d="M17 7 L32 35.5 L32 40 L17 16 Z" fill="url(#lp-mf2)" stroke="url(#lp-mf2)" />
              <path d="M19 35.5 L34 7 L34 16 L19 40 Z" fill="url(#lp-mf3)" stroke="url(#lp-mf3)" />
              <path d="M34 7 L49 35.5 L49 40 L34 16 Z" fill="url(#lp-mf4)" stroke="url(#lp-mf4)" />
            </g>
          </g>
          <text
            x={CX}
            y={CY + 74}
            textAnchor="middle"
            className="lp-emblem-word lp-emblem-word-glow"
            style={{ fontFamily: "var(--font-mtqs-display), Montserrat, sans-serif" }}
          >
            MTQΣ
          </text>
          <text
            x={CX}
            y={CY + 74}
            textAnchor="middle"
            className="lp-emblem-word"
            style={{ fontFamily: "var(--font-mtqs-display), Montserrat, sans-serif" }}
          >
            MTQΣ
          </text>
          <text x={CX} y={CY + 108} textAnchor="middle" className="lp-emblem-tag">
            STABILITY • UTILITY • GLOBAL ACCESS
          </text>
        </g>

        {/* ── orbital rings — FRONT arcs (thick, luminous, traveling light) ── */}
        {RINGS.map((ring) => (
          <g key={`front-${ring.rot}`} transform={`translate(${CX} ${CY}) rotate(${ring.rot})`}>
            <path d={frontArcD(ring)} fill="none" stroke={ring.glow} strokeWidth={ring.width + 6} opacity="0.5" filter="url(#lp-blur-soft)" />
            <path d={frontArcD(ring)} fill="none" stroke={ring.stroke} strokeWidth={ring.width + 1.2} opacity="0.55" filter="url(#lp-blur)" />
            <path d={frontArcD(ring)} fill="none" stroke={ring.stroke} strokeWidth={ring.width} opacity="1" />
            <path
              d={frontArcD(ring)}
              fill="none"
              stroke="#f6feff"
              strokeWidth={ring.width + 1.4}
              strokeLinecap="round"
              pathLength={100}
              className="lp-ring-travel"
              style={{ animationDuration: `${ring.travelDur}s` }}
            />
          </g>
        ))}
        {/* satellites riding the front arcs — soft energy-node halos */}
        {RINGS.flatMap((ring) =>
          ring.sats.map((sat) => {
            const [x, y] = ringPoint(ring.rx, ring.ry, ring.rot, sat.t);
            return (
              <g key={`sat-${ring.rot}-${sat.t}`} className={sat.cls}>
                <circle cx={x} cy={y} r={sat.r * 3.4} fill="rgba(165,243,252,0.34)" filter="url(#lp-blur-soft)" />
                <circle cx={x} cy={y} r={sat.r * 2.2} fill="rgba(165,243,252,0.42)" filter="url(#lp-blur)" />
                <circle cx={x} cy={y} r={sat.r} fill={ring.front === "left" ? "#ede9fe" : "#d9fbff"} />
                <circle cx={x} cy={y} r={sat.r * 0.45} fill="#ffffff" />
              </g>
            );
          }),
        )}

        {/* ── bokeh light particles ──────────────────────────────── */}
        <g>
          {BOKEH.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={p.c}
              opacity={p.o}
              filter="url(#lp-blur)"
              className="lp-bokeh"
              style={{ animationDelay: `${p.d}s`, animationDuration: `${p.dur}s` }}
            />
          ))}
        </g>

        {/* ── atmospheric mist — the sphere emerges from haze (depth cue;
              veils the lower rim so the object sits IN air, not ON it) ── */}
        <g className="lp-flare-soft">
          <ellipse cx={CX} cy={CY + 208} rx="310" ry="54" fill="rgba(56,120,220,0.15)" filter="url(#lp-blur-halo)" opacity="0.85" />
          <ellipse cx={CX - 46} cy={CY + 178} rx="240" ry="42" fill="rgba(80,140,240,0.11)" filter="url(#lp-blur-halo)" />
          <ellipse cx={CX + 74} cy={CY + 166} rx="190" ry="36" fill="rgba(103,232,249,0.07)" filter="url(#lp-blur-halo)" />
        </g>

        {/* ── lens flare & light streaks ────────────────────────── */}
        <g className="lp-flare-pulse">
          {/* anamorphic horizontal streak across the specular hotspot */}
          <line x1="150" y1="152" x2="492" y2="152" stroke="url(#lp-streak)" strokeWidth="2.6" opacity="0.5" filter="url(#lp-blur)" />
          <line x1="58" y1="342" x2="586" y2="96" stroke="url(#lp-streak)" strokeWidth="3.8" filter="url(#lp-blur)" />
          <line x1="120" y1="508" x2="470" y2="300" stroke="url(#lp-streak)" strokeWidth="1.7" opacity="0.7" filter="url(#lp-blur)" />
          <circle cx="512" cy="128" r="22" fill="rgba(191,242,255,0.36)" filter="url(#lp-blur)" />
          <circle cx="512" cy="128" r="8" fill="#f2fdff" />
          <circle cx="512" cy="128" r="34" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.6" />
          <circle cx="110" cy="470" r="10" fill="rgba(196,181,253,0.42)" filter="url(#lp-blur)" />
          <circle cx="110" cy="470" r="3.4" fill="#f5f3ff" />
        </g>

        {/* ── god-ray light beam with drifting dust motes ──────── */}
        <g className="lp-beam-shimmer">
          <polygon points="284,700 356,700 336,538 304,538" fill="url(#lp-beam)" filter="url(#lp-blur-soft)" opacity="0.6" />
          <polygon points="302,700 338,700 326,548 314,548" fill="url(#lp-beam)" opacity="0.9" />
          <polygon points="313,702 327,702 321,558 319,558" fill="#dffcff" opacity="0.6" filter="url(#lp-blur)" />
          {/* dust motes drifting up the beam — volumetric air */}
          <circle cx="322" cy="648" r="2.4" fill="rgba(223,252,255,0.8)" className="lp-bokeh" style={{ animationDelay: "0.8s", animationDuration: "7.2s" }} />
          <circle cx="312" cy="610" r="1.7" fill="rgba(223,252,255,0.65)" className="lp-bokeh" style={{ animationDelay: "2.9s", animationDuration: "8.6s" }} />
          <circle cx="330" cy="576" r="1.4" fill="rgba(223,252,255,0.6)" className="lp-bokeh" style={{ animationDelay: "4.4s", animationDuration: "6.4s" }} />
        </g>

        {/* ── volumetric floor light — platform spill lighting the ground
              (drawn before the platform so the pad sits INSIDE its light) ── */}
        <g className="lp-flare-soft">
          <ellipse cx={PFC.x} cy={PFC.y + 46} rx="430" ry="98" fill="url(#lp-spill)" opacity="0.55" filter="url(#lp-blur-halo)" />
        </g>

        {/* ── holographic platform — vibrant neon rings ─────────── */}
        <g>
          <ellipse cx={PFC.x} cy={PFC.y} rx="176" ry="44" fill="rgba(56,189,248,0.4)" filter="url(#lp-blur-soft)" />
          <ellipse cx={PFC.x} cy={PFC.y} rx="84" ry="20" fill="rgba(140,243,255,0.6)" filter="url(#lp-blur-soft)" />
          <circle cx={PFC.x} cy={PFC.y} r="26" fill="rgba(213,250,255,0.5)" filter="url(#lp-blur-soft)" />
          <ellipse cx={PFC.x} cy={PFC.y + 32} rx="128" ry="27" fill="rgba(56,150,248,0.26)" filter="url(#lp-blur-soft)" />
          {/* wide faint projection rings — complete ellipses; with overflow
              visible they bleed off the scene box like a real floor plane */}
          <ellipse cx={PFC.x} cy={PFC.y} rx="326" ry="79" fill="none" stroke="rgba(103,232,249,0.13)" strokeWidth="1.5" />
          <ellipse cx={PFC.x} cy={PFC.y} rx="386" ry="94" fill="none" stroke="rgba(139,92,246,0.09)" strokeWidth="1.3" />
          <g stroke="rgba(125,211,252,0.09)" strokeWidth="1">
            {SPOKES.map((s, i) => (
              <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
            ))}
          </g>
          {PLATFORM_RINGS.map((r) => (
            <g key={r.rx}>
              <ellipse
                cx={PFC.x}
                cy={PFC.y}
                rx={r.rx}
                ry={r.ry}
                fill="none"
                stroke={r.stroke}
                strokeWidth={r.w + 2.4}
                opacity={r.op * 0.42}
                filter="url(#lp-blur)"
              />
              <ellipse
                cx={PFC.x}
                cy={PFC.y}
                rx={r.rx}
                ry={r.ry}
                fill="none"
                stroke={r.stroke}
                strokeWidth={r.w}
                opacity={r.op}
              />
            </g>
          ))}
        </g>
      </svg>

      {/* floating glass panels — desktop composition around the globe */}
      {HERO_PANELS.map((panel, i) => (
        <div key={panel.id} className={`absolute hidden w-[228px] lg:block ${PANEL_POS[i]}`}>
          <PanelCard panel={panel} delay={-i * 1.7} />
        </div>
      ))}
    </div>
  );
}
