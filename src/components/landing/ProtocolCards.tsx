// MTQΣ landing — feature cards row (v7.2 reference parity).
// Reference copy: Stable Value · Low Fees · Cross-Chain · Community Driven.
import { ShieldCheck, Zap, Globe2, Users } from "lucide-react";
import { PROTOCOL_CARDS } from "@/lib/mtq/landing-status";

const CARD_ICONS = {
  shield: ShieldCheck,
  zap: Zap,
  globe: Globe2,
  users: Users,
} as const;

export function ProtocolCards() {
  return (
    <section
      id="product"
      className="relative z-20 -mt-16 pb-6 pt-4 sm:-mt-20"
      aria-label="Protocol pillars"
    >
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 px-5 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 xl:px-10">
        {PROTOCOL_CARDS.map((card, i) => {
          const Icon = CARD_ICONS[card.icon];
          return (
            <article
              key={card.id}
              className="lp-card lp-rise"
              style={{ animationDelay: `${0.08 * i}s` }}
            >
              <span className="lp-icon-chip">
                <Icon className="size-5" strokeWidth={1.9} aria-hidden />
              </span>
              <h3 className="mt-4 text-[1.02rem] font-bold text-[#0E1F1B]">{card.title}</h3>
              <p className="mt-1.5 text-[0.84rem] leading-relaxed text-[#5B6E68]">{card.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
