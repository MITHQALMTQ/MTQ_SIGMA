// MTQΣ landing — footer (v7.2 reference parity + mandatory status ribbon).
// Reference composition: centered tagline "Built for a more stable, transparent
// and inclusive financial future." flanked by thin glowing gradient lines, over
// a mountain silhouette. Below the tagline (outside the reference crop) the
// mandatory operational statements are carried prominently.
// TAB FIX: Developers / Governance / Resources footer links now LAUNCH the
// Pilot Command Center at real sections (previously: status dialogs only).
import { TAGLINE, FOOTER, OPERATIONAL_STATUS } from "@/lib/mtq/landing-status";
import { Rocket, ArrowUpRight } from "lucide-react";
import { Mountains } from "./Hero";

const TONE_DOT: Record<string, string> = {
  cyan: "bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]",
  amber: "bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.9)]",
  rose: "bg-rose-300 shadow-[0_0_10px_rgba(251,113,133,0.9)]",
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
      {/* tagline block — reference composition */}
      <div className="relative pb-6 pt-10">
        <Mountains />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8 xl:px-10">
          <p className="lp-tagline">
            <span className="lp-tagline-line" aria-hidden />
            <span className="shrink-0 text-[0.86rem] font-medium tracking-wide text-[#9ec2e4]">
              {TAGLINE}
            </span>
            <span className="lp-tagline-line" data-flip="true" aria-hidden />
          </p>
        </div>
      </div>

      {/* mandatory operational status ribbon — always visible */}
      <div className="relative z-10 border-y border-white/[0.07] bg-[rgba(2,9,22,0.55)] backdrop-blur-sm">
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
            <a key={l.label} href={l.href} className="text-[0.74rem] font-medium text-slate-400 transition hover:text-white">
              {l.label}
            </a>
          ))}
          {onLaunchTo
            ? FOOTER_LAUNCH_LINKS.map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => onLaunchTo(l.section)}
                  className="inline-flex items-center gap-1 text-[0.74rem] font-medium text-slate-400 transition hover:text-white"
                  aria-label={`Open ${l.label} in the Pilot Command Center`}
                >
                  {l.label}
                  <ArrowUpRight className="size-3 text-cyan-300/70" aria-hidden />
                </button>
              ))
            : null}
          {onLaunch ? (
            <button
              type="button"
              onClick={onLaunch}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3.5 py-1.5 text-[0.74rem] font-bold text-emerald-100 transition hover:border-emerald-300/60 hover:bg-emerald-400/20"
              aria-label="Launch the MTQΣ Pilot Command Center"
            >
              <Rocket className="size-3.5" aria-hidden />
              Launch App
            </button>
          ) : null}
        </nav>
        <p className="max-w-3xl text-center text-[0.66rem] leading-relaxed text-slate-500">
          {FOOTER.disclaimer}
        </p>
        <p className="text-[0.66rem] text-slate-600">{FOOTER.copyright}</p>
      </div>
    </footer>
  );
}
