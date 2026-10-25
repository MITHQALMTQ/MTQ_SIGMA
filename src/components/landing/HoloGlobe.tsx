// MTQΣ landing — brand emblem stage (fresh light redesign).
// The v8 holographic SVG globe scene was retired with the dark cinematic
// theme (owner directive: "simple but beautiful, fresh looking, not dark").
// In its place: a clean presentation of the official emblem on a soft
// mint backdrop, with the four floating fact panels kept — now as
// simple white cards. Exports keep the legacy names (HoloGlobe,
// PanelCard) so Hero imports continue to work.
import { Landmark, BrainCircuit, Link2, Users } from "lucide-react";
import { HERO_PANELS } from "@/lib/mtq/landing-status";
import { BrandMark } from "./BrandMark";

const PANEL_ICONS = {
  landmark: Landmark,
  brain: BrainCircuit,
  link: Link2,
  users: Users,
} as const;

// Desktop positions hug the emblem corners (same slots the globe used).
const PANEL_POS = [
  "lg:-left-[7%] lg:top-[5%] xl:-left-[9%] xl:top-[4%]",
  "lg:-right-[7%] lg:top-[3%] xl:-right-[9%] xl:top-[2%]",
  "lg:-left-[9%] lg:top-[44%] xl:-left-[11%] xl:top-[43%]",
  "lg:-right-[9%] lg:top-[48%] xl:-right-[11%] xl:top-[47%]",
] as const;

/* ------------------------------------------------------------------ */
/* floating fact panel — a simple white card with an icon chip         */
/* ------------------------------------------------------------------ */
export function PanelCard({
  panel,
  className = "",
}: {
  panel: (typeof HERO_PANELS)[number];
  /** Legacy float-animation phase — kept for API compatibility. */
  delay?: number;
  className?: string;
}) {
  const Icon = PANEL_ICONS[panel.icon];
  return (
    <div
      className={`lp-holo-panel pointer-events-none flex items-center gap-2.5 px-3.5 py-3 lg:absolute lg:w-[13.5rem] ${className}`}
      aria-hidden={false}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#BEE3DD] bg-[#E7F4F1] text-[#0F766E]">
        <Icon className="size-4" strokeWidth={2} aria-hidden />
      </span>
      <span className="min-w-0">
        <b className="block truncate text-[0.72rem] font-bold leading-tight text-[#0E1F1B]">
          {panel.title}
        </b>
        <span className="block truncate text-[0.6rem] font-medium leading-tight text-[#5B6E68]">
          {panel.subtitle}
        </span>
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* emblem stage — replaces the holographic globe                      */
/* ------------------------------------------------------------------ */
export function HoloGlobe() {
  return (
    <div className="relative mx-auto w-full max-w-[30rem]">
      {/* soft mint backdrop */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full sm:size-[26rem]"
        style={{
          background:
            "radial-gradient(circle at 50% 42%, rgba(13,148,136,0.12), rgba(13,148,136,0.04) 55%, transparent 72%)",
        }}
        aria-hidden
      />

      {/* official emblem — the fresh vector coin-badge mark on a soft mint card */}
      <figure className="mx-auto w-[15rem] sm:w-[17rem]">
        <div className="grid aspect-square place-items-center rounded-3xl border border-[#BEE3DD] bg-gradient-to-b from-[#F0FAF7] to-[#E7F4F1] shadow-[0_2px_8px_rgba(14,31,27,0.05),0_16px_48px_rgba(14,31,27,0.08)]">
          <span role="img" aria-label="MTQΣ emblem — faceted M coin-badge mark" className="flex items-center justify-center">
            <BrandMark size={220} glow={false} />
          </span>
        </div>
        <figcaption className="mt-4 text-center">
          <p
            className="text-[1.05rem] font-extrabold tracking-[0.28em] text-[#0E1F1B]"
            style={{ fontFamily: "var(--font-mtqs-display), Montserrat, sans-serif" }}
          >
            MTQΣ
          </p>
          <p className="lp-emblem-tag mt-1">Basket-Referenced Monetary Standard</p>
        </figcaption>
      </figure>

      {/* floating fact panels — desktop only */}
      {HERO_PANELS.map((panel, i) => (
        <div key={panel.id} className={`hidden lg:block ${PANEL_POS[i]}`}>
          <PanelCard panel={panel} className="relative" />
        </div>
      ))}
    </div>
  );
}
