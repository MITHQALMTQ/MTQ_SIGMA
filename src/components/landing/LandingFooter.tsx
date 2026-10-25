// MTQΣ landing — footer (fresh light redesign + mandatory status ribbon).
// The mountain silhouette and dark glass ribbon were retired with the dark
// theme. The mandatory operational statements are carried prominently.
// Footer links LAUNCH the Pilot Command Center at real sections.
import { TAGLINE, FOOTER, OPERATIONAL_STATUS } from "@/lib/mtq/landing-status";
import { Rocket, ArrowUpRight } from "lucide-react";

const TONE_DOT: Record<string, string> = {
  cyan: "bg-teal-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
};

const FOOTER_LINKS = [
  { label: "Home", href: "#home" },
  { label: "Product", href: "#product" },
  { label: "Ecosystem", href: "#ecosystem" },
] as const;

/* Working footer "tabs" — each launches the terminal at a REAL section. */
const FOOTER_LAUNCH_LINKS: { label: string; section: string }[] = [
  { label: "Contracts", section: "contracts" },
  { label: "Networks", section: "networks" },
  { label: "API Reference", section: "developers" },
  { label: "Governance", section: "governance" },
  { label: "Transparency", section: "transparency" },
  { label: "Security", section: "security" },
  { label: "Documentation", section: "docs" },
  { label: "Architecture", section: "architecture" },
  { label: "Validation", section: "validation" },
  { label: "Evidence", section: "evidence" },
];

export function LandingFooter({
  onLaunch,
  onLaunchTo,
}: {
  onLaunch?: () => void;
  onLaunchTo?: (section: string) => void;
}) {
  return (
    <footer className="relative mt-auto overflow-hidden">
      {/* tagline block — clean centered composition */}
      <div className="relative pb-6 pt-12">
        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 xl:px-10">
          <p className="lp-tagline">
            <span className="lp-tagline-line" aria-hidden />
            <span className="shrink-0 text-[0.86rem] font-medium tracking-wide text-[#33544C]">
              {TAGLINE}
            </span>
            <span className="lp-tagline-line" data-flip="true" aria-hidden />
          </p>
        </div>
      </div>

      {/* mandatory operational status ribbon — always visible */}
      <div className="relative z-10 border-y border-[#E3EAE6] bg-white/70 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-center gap-2.5 px-5 py-4 sm:px-8 xl:px-10">
          {OPERATIONAL_STATUS.map((s) => (
            <span key={s.id} className="lp-status-pill" title={s.description}>
              <span className={`size-1.5 rounded-full ${TONE_DOT[s.tone]}`} aria-hidden />
              {s.title}
            </span>
          ))}
        </div>
      </div>

      {/* footer body */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center gap-4 px-5 py-6 sm:px-8 xl:px-10">
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {FOOTER_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="text-[0.74rem] font-medium text-[#5B6E68] transition hover:text-[#0E1F1B]">
              {l.label}
            </a>
          ))}
          {onLaunchTo
            ? FOOTER_LAUNCH_LINKS.map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => onLaunchTo(l.section)}
                  className="inline-flex items-center gap-1 text-[0.74rem] font-medium text-[#5B6E68] transition hover:text-[#0E1F1B]"
                  aria-label={`Open ${l.label} in the Pilot Command Center`}
                >
                  {l.label}
                  <ArrowUpRight className="size-3 text-[#0D9488]" aria-hidden />
                </button>
              ))
            : null}
          {onLaunch ? (
            <button
              type="button"
              onClick={onLaunch}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#BEE3DD] bg-[#E7F4F1] px-3.5 py-1.5 text-[0.74rem] font-bold text-[#0F766E] transition hover:border-[#0D9488] hover:bg-[#D9EFEA]"
              aria-label="Launch the MTQΣ Pilot Command Center"
            >
              <Rocket className="size-3.5" aria-hidden />
              Launch App
            </button>
          ) : null}
        </nav>
        <p className="max-w-3xl text-center text-[0.66rem] leading-relaxed text-[#7A8C86]">
          {FOOTER.disclaimer}
        </p>
        <p className="text-[0.66rem] text-[#9AA9A3]">{FOOTER.copyright}</p>
      </div>
    </footer>
  );
}
