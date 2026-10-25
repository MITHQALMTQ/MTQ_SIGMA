// MTQΣ landing — hero section (fresh light redesign).
// The v8 cinematic night-scene (stars, nebulae, mountain ridges, terrain
// glow, vignette, film grain, holographic globe) was retired per the owner
// directive: "alot of graphics and colors — make it simple but beautiful,
// fresh looking, not dark". The hero is now a clean editorial composition:
// badge → ink headline with one teal accent line → paragraph → CTAs, beside
// a calm presentation of the official emblem with floating fact panels.
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { HERO, HERO_PANELS } from "@/lib/mtq/landing-status";
import { HoloGlobe, PanelCard } from "./HoloGlobe";
import { VideoDialogButton } from "./StatusDialogs";

const HL_CLASS = {
  "grad-1": "lp-hl-1",
  "flat-cyan": "lp-hl-2",
  "grad-2": "lp-hl-3",
} as const;

export function Hero({ onLaunch }: { onLaunch?: () => void }) {
  return (
    <section id="home" className="relative overflow-visible" aria-labelledby="hero-heading">
      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[minmax(0,540px)_minmax(0,1fr)] lg:items-center lg:gap-6 lg:pb-24 lg:pt-16 xl:px-10">
        {/* left — copy */}
        <div className="lp-rise">
          <span className="lp-badge">
            <Sparkles className="size-3.5 text-[#0D9488]" aria-hidden />
            {HERO.badge}
          </span>
          <h1 id="hero-heading" className="lp-h1">
            {HERO.headlineLines.map((line, i) => (
              <span key={i} className={`block ${HL_CLASS[line.tone]}`}>
                {line.text}
              </span>
            ))}
          </h1>
          <p className="mt-5 max-w-[33rem] text-[0.95rem] leading-relaxed text-[#4A5C56]">
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
              <span className="grid size-6 place-items-center rounded-full border border-[#BEE3DD] bg-[#E7F4F1] text-[#0F766E]">
                <Play className="size-3 translate-x-[1px] fill-[#0F766E]" aria-hidden />
              </span>
              {HERO.secondaryCta.label}
            </VideoDialogButton>
          </div>
        </div>

        {/* right — emblem stage (panels float on desktop) */}
        <div className="lp-rise relative" style={{ animationDelay: "0.12s" }}>
          <HoloGlobe />
        </div>
      </div>

      {/* floating panels — stacked cards on small screens */}
      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 gap-3 px-5 pb-12 sm:grid-cols-2 sm:px-8 lg:hidden xl:px-10">
        {HERO_PANELS.map((panel) => (
          <PanelCard key={panel.id} panel={panel} className="w-full" />
        ))}
      </div>
    </section>
  );
}
