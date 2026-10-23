// MTQΣ landing — hero section (v8 cinematic environment).
// Reference composition preserved (badge → aurora headline → paragraph → CTAs
// → holographic globe + floating panels) but the section is now staged as a
// SCENE, not a "header with a pasted picture":
//   • layered sky: nebula washes + star field + glint stars + shooting stars
//   • volumetric ground light: the globe's platform spill lights the terrain
//   • 3-ridge mountain range with atmospheric perspective, fog bands and a
//     crest rim-light that fades away from the light source
//   • film grain + deep vignette for the cinematic grade
// All motion is CSS-only and honors prefers-reduced-motion. Deterministic.
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { HERO, HERO_PANELS } from "@/lib/mtq/landing-status";
import { HoloGlobe, PanelCard } from "./HoloGlobe";
import { VideoDialogButton } from "./StatusDialogs";

// Deterministic PRNG (server-rendered — identical every build).
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = {
  id: number;
  left: number;
  top: number;
  size: number;
  opacity: number;
  twinkle: boolean;
  delay: number;
  dur: number;
  glint: boolean;
};

function Stars({ count = 110 }: { count?: number }) {
  const rnd = mulberry32(20261021);
  const stars: Star[] = Array.from({ length: count }, (_, i) => {
    const left = rnd() * 100;
    const top = rnd() * 100;
    const size = 1 + rnd() * 1.7;
    const opacity = 0.14 + rnd() * 0.55;
    const twinkle = rnd() < 0.3;
    const glint = rnd() > 0.965;
    const delay = +(rnd() * 3.4).toFixed(2);
    const dur = 2.6 + rnd() * 2.4;
    return { id: i, left, top, size, opacity, twinkle, delay, dur, glint };
  });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {stars.map((s) =>
        s.glint ? (
          <span
            key={s.id}
            className="lp-glint"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur + 3.4}s`,
            }}
          />
        ) : (
          <span
            key={s.id}
            className="lp-star"
            data-twinkle={s.twinkle}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ),
      )}
      {/* two deterministic shooting stars, offset phases */}
      <span className="lp-shoot" style={{ left: "64%", top: "7%", animationDelay: "2.5s" }} />
      <span className="lp-shoot" style={{ left: "31%", top: "3%", animationDelay: "10.8s" }} />
    </div>
  );
}

/* Slow-drifting nebula washes — "empty space has air". */
function Nebulae() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="lp-nebula lp-n1" />
      <div className="lp-nebula lp-n2" />
      <div className="lp-nebula lp-n3" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* mountain range — organic undulating Bézier ridges dissolving into   */
/* the night (reference treatment): deepest/darkest at epic distance, */
/* richer blue toward the foreground where the platform light touches  */
/* it. Each crest is softened by haze; fog bands glue the layers into  */
/* one continuous landscape; a horizontal mask fades the terrain out   */
/* at the frame edges so nothing is "cut".                             */
/* ------------------------------------------------------------------ */
export function Mountains({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 ${className}`} aria-hidden>
      <svg viewBox="0 0 1440 240" preserveAspectRatio="none" className="block h-[190px] w-full sm:h-[230px]">
        <defs>
          {/* organic night palette sampled from the reference:
              far ridges sink into the sky, near ridge carries the
              blue-purple mass lit by the platform glow */}
          <linearGradient id="lp-epic-ridge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#111b33" stopOpacity="0.60" />
            <stop offset="100%" stopColor="#0a1128" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="lp-far-ridge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e2d4d" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#101c38" />
          </linearGradient>
          <linearGradient id="lp-mid-ridge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#263c66" />
            <stop offset="100%" stopColor="#16244a" />
          </linearGradient>
          <linearGradient id="lp-near-ridge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a3f6b" />
            <stop offset="55%" stopColor="#101d3d" />
            <stop offset="100%" stopColor="#0a1226" />
          </linearGradient>
          {/* crest rim-light — strong on the right (globe side), fading left */}
          <linearGradient id="lp-crest" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(140,214,255,0.06)" />
            <stop offset="42%" stopColor="rgba(140,214,255,0.30)" />
            <stop offset="100%" stopColor="rgba(186,240,255,0.62)" />
          </linearGradient>
          {/* fog bands — glue the ridges into one misty landscape */}
          <linearGradient id="lp-fog-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(100,150,230,0)" />
            <stop offset="45%" stopColor="rgba(100,150,230,0.22)" />
            <stop offset="100%" stopColor="rgba(100,150,230,0)" />
          </linearGradient>
          <linearGradient id="lp-fog-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(85,135,220,0)" />
            <stop offset="50%" stopColor="rgba(85,135,220,0.17)" />
            <stop offset="100%" stopColor="rgba(85,135,220,0)" />
          </linearGradient>
          <linearGradient id="lp-fog-c" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(60,110,200,0)" />
            <stop offset="55%" stopColor="rgba(60,110,200,0.13)" />
            <stop offset="100%" stopColor="rgba(60,110,200,0)" />
          </linearGradient>
          {/* horizontal edge fade — terrain tapers into darkness at the
              frame edges instead of being "cut" */}
          <linearGradient id="lp-edge-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000000" />
            <stop offset="7%" stopColor="#ffffff" />
            <stop offset="93%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#000000" />
          </linearGradient>
          <mask id="lp-mtn-mask">
            <rect x="0" y="0" width="1440" height="240" fill="url(#lp-edge-fade)" />
          </mask>
          {/* crest softening */}
          <filter id="lp-mtn-blur" x="-4%" y="-40%" width="108%" height="180%">
            <feGaussianBlur stdDeviation="0.8" />
          </filter>
        </defs>

        <g mask="url(#lp-mtn-mask)">
          {/* ── epic distance — ghost ridge dissolving into night ── */}
          <g className="lp-ridge lp-ridge-epic">
            <path
              d="M0,176 C60,168 96,150 150,158 C205,166 240,148 300,156 C360,164 400,146 460,154 C520,162 560,144 620,152 C680,160 720,146 780,154 C840,162 880,144 940,152 C1000,160 1040,146 1100,154 C1160,162 1200,148 1260,156 C1320,164 1380,152 1440,158 L1440,240 L0,240 Z"
              fill="url(#lp-epic-ridge)"
              opacity="0.5"
            />
          </g>

          {/* ── far range — muted slate-blue swell ── */}
          <g className="lp-ridge lp-ridge-far">
            <path
              d="M0,160 C48,150 84,128 140,138 C196,148 232,124 290,134 C348,144 392,120 450,130 C508,140 552,118 610,128 C668,138 712,116 770,126 C828,136 872,114 930,124 C988,134 1032,112 1090,122 C1148,132 1192,110 1250,120 C1308,130 1360,112 1440,124 L1440,240 L0,240 Z"
              fill="url(#lp-far-ridge)"
            />
          </g>
          <rect x="0" y="106" width="1440" height="62" fill="url(#lp-fog-a)" />

          {/* ── mid range — deeper mass with the soft crest rim-light ── */}
          <g className="lp-ridge lp-ridge-mid">
            <path
              d="M0,152 C42,142 76,112 132,124 C188,136 226,108 284,120 C342,132 386,104 444,116 C502,128 548,102 606,114 C664,126 710,100 768,112 C826,124 870,98 928,110 C986,122 1030,96 1088,108 C1146,120 1190,94 1248,106 C1306,118 1356,98 1440,110 L1440,240 L0,240 Z"
              fill="url(#lp-mid-ridge)"
            />
            <path
              d="M0,152 C42,142 76,112 132,124 C188,136 226,108 284,120 C342,132 386,104 444,116 C502,128 548,102 606,114 C664,126 710,100 768,112 C826,124 870,98 928,110 C986,122 1030,96 1088,108 C1146,120 1190,94 1248,106 C1306,118 1356,98 1440,110"
              fill="none"
              stroke="url(#lp-crest)"
              strokeWidth="1.6"
              strokeLinecap="round"
              filter="url(#lp-mtn-blur)"
            />
          </g>
          <rect x="0" y="132" width="1440" height="52" fill="url(#lp-fog-b)" />

          {/* ── near range — blue-purple foreground lit by the platform ── */}
          <path
            d="M0,192 C40,180 62,158 96,166 C132,174 150,152 190,160 C228,168 248,148 292,156 C332,164 354,146 398,154 C440,162 458,144 504,152 C546,160 566,142 612,150 C652,158 672,140 718,148 C758,156 776,138 822,146 C862,154 880,136 926,144 C966,152 984,134 1030,142 C1070,150 1088,132 1134,140 C1174,148 1192,130 1238,138 C1278,146 1296,128 1342,136 C1382,144 1412,132 1440,138 L1440,240 L0,240 Z"
            fill="url(#lp-near-ridge)"
          />
          {/* crest catching the platform light (right side strongest) */}
          <path
            d="M718,148 C758,156 776,138 822,146 C862,154 880,136 926,144 C966,152 984,134 1030,142 C1070,150 1088,132 1134,140 C1174,148 1192,130 1238,138 C1278,146 1296,128 1342,136 C1382,144 1412,132 1440,138"
            fill="none"
            stroke="rgba(140,214,255,0.22)"
            strokeWidth="1.3"
            strokeLinecap="round"
            filter="url(#lp-mtn-blur)"
          />
          <rect x="0" y="158" width="1440" height="58" fill="url(#lp-fog-c)" />
        </g>
      </svg>
    </div>
  );
}

/* Distant terrain BEHIND the globe — the reference shows dark mountain
   silhouettes rising in the background space around the sphere's lower
   half. Rendered before the grid so the globe paints over it. */
function DistantTerrain() {
  return (
    <div className="lp-distant-terrain" aria-hidden>
      <svg viewBox="0 0 1440 260" preserveAspectRatio="none" className="block h-full w-full">
        <defs>
          <linearGradient id="lp-bg-ridge-1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c2c4f" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#0a1226" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lp-bg-ridge-2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#25375f" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#101c38" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* taller on the left, dipping under the globe column on the right */}
        <path
          className="lp-bg-ridge"
          d="M0,150 C70,110 130,74 210,92 C290,110 340,128 420,116 C500,104 560,132 640,138 C720,144 800,168 880,172 C960,176 1050,158 1130,166 C1210,174 1310,188 1440,196 L1440,260 L0,260 Z"
          fill="url(#lp-bg-ridge-2)"
        />
        <path
          className="lp-bg-ridge lp-bg-ridge-deep"
          d="M0,190 C90,158 160,120 250,134 C340,148 400,170 490,164 C580,158 640,182 730,190 C820,198 920,206 1010,204 C1100,202 1220,212 1440,222 L1440,260 L0,260 Z"
          fill="url(#lp-bg-ridge-1)"
        />
      </svg>
    </div>
  );
}

const HL_CLASS = {
  "grad-1": "lp-hl-1",
  "flat-cyan": "lp-hl-2",
  "grad-2": "lp-hl-3",
} as const;

export function Hero({ onLaunch }: { onLaunch?: () => void }) {
  return (
    <section id="home" className="relative overflow-visible" aria-labelledby="hero-heading">
      {/* sky layers — deep space with air and drift */}
      <Nebulae />
      <Stars />

      {/* distant terrain BEHIND the globe (reference: dark ridges rising
          around the sphere's lower half) */}
      <DistantTerrain />

      {/* horizon light — the platform glow spilling onto the terrain (paints
          OVER the mountains so the ground reads as lit by the globe) */}
      <div className="lp-terrain-glow" aria-hidden />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-5 pb-24 pt-10 sm:px-8 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)] lg:items-center lg:gap-2 lg:pb-36 xl:px-10">
        {/* left — copy */}
        <div className="lp-rise">
          <span className="lp-badge">
            <Sparkles className="size-3.5 text-cyan-300" aria-hidden />
            {HERO.badge}
          </span>
          <h1 id="hero-heading" className="lp-h1">
            {HERO.headlineLines.map((line, i) => (
              <span key={i} className={`block ${HL_CLASS[line.tone]}`}>
                {line.text}
              </span>
            ))}
          </h1>
          <p className="mt-5 max-w-[33rem] text-[0.95rem] leading-relaxed text-slate-400">
            {HERO.paragraph}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            {onLaunch ? (
              <button type="button" className="lp-btn-primary" onClick={onLaunch}>
                {HERO.primaryCta.label}
                <ArrowRight className="size-4" aria-hidden />
              </button>
            ) : (
              <a href={HERO.primaryCta.href} className="lp-btn-primary">
                {HERO.primaryCta.label}
                <ArrowRight className="size-4" aria-hidden />
              </a>
            )}
            <VideoDialogButton
              className="lp-btn-ghost"
              label={HERO.secondaryCta.label}
            >
              <span className="grid size-6 place-items-center rounded-full border border-cyan-300/60 bg-cyan-400/10 text-cyan-200">
                <Play className="size-3 translate-x-[1px] fill-cyan-200" aria-hidden />
              </span>
              {HERO.secondaryCta.label}
            </VideoDialogButton>
          </div>
        </div>

        {/* right — holographic globe (scene bleeds beyond its box — no crop) */}
        <div className="lp-rise relative lg:-mb-40" style={{ animationDelay: "0.15s" }}>
          <HoloGlobe />
        </div>
      </div>

      {/* floating panels — reflowed grid for small screens */}
      <div className="relative z-10 -mt-14 grid grid-cols-1 gap-3 px-5 pb-10 sm:grid-cols-2 sm:px-8 lg:hidden">
        {HERO_PANELS.map((panel, i) => (
          <div key={panel.id} className="w-full">
            <PanelCard panel={panel} delay={-i * 1.7} />
          </div>
        ))}
      </div>

      <Mountains />
      {/* cinematic grade — deep vignette + film grain */}
      <div className="lp-hero-vignette" aria-hidden />
      <div className="lp-grain" aria-hidden />
    </section>
  );
}
