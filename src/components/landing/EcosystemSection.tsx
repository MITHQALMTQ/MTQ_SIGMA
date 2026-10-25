// MTQΣ landing — ecosystem section (v7.2 reference parity).
// Reference composition: "THE MTQΣ ECOSYSTEM" pill → "Powerful Tools. Unified
// in One Platform." heading (white → violet gradient) → paragraph → 4-item
// cyan checklist → "Explore the Ecosystem →" CTA — beside an illustrative
// dashboard preview. The preview renders the reference's mock interface and
// is explicitly tagged SIMULATED PREVIEW (illustration, never live data).
import { ArrowRight, Check, ChevronDown, ArrowDownUp, Send, ShieldCheck, Vote, LayoutGrid, Wallet as WalletIcon, Sprout, Scale, BarChart3 } from "lucide-react";
import { ECOSYSTEM, DASHBOARD_MOCK, SIMULATED_PREVIEW_TAG, SIMULATION_NOTE } from "@/lib/mtq/landing-status";
import { BrandMark } from "./BrandMark";

/* tiny token glyphs — simple flat geometric marks, no third-party logos */
function TokenGlyph({ kind }: { kind: "m" | "usdc" | "eth" | "sol" }) {
  if (kind === "m")
    return (
      <span className="grid size-7 place-items-center rounded-full bg-[#0D9488] text-[0.62rem] font-extrabold text-white">
        M
      </span>
    );
  if (kind === "usdc")
    return (
      <span className="grid size-7 place-items-center rounded-full bg-[#2775ca] text-[0.62rem] font-extrabold text-white">
        $
      </span>
    );
  if (kind === "eth")
    return (
      <span className="grid size-7 place-items-center rounded-full bg-[#627EEA]">
        <svg viewBox="0 0 24 24" className="size-3.5 fill-white" aria-hidden>
          <path d="M12 2 L19 12 L12 16 L5 12 Z" opacity="0.95" />
          <path d="M12 17.5 L19 13.5 L12 22 L5 13.5 Z" opacity="0.7" />
        </svg>
      </span>
    );
  return (
    <span className="grid size-7 place-items-center rounded-full bg-[#0F766E]">
      <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden>
        <path d="M5 8h9l-1.6 2.4H5zM7 11.8h9l-1.6 2.4H7z" fill="#EAF7F2" />
      </svg>
    </span>
  );
}

/* area chart — smooth upward curve, cyan→violet gradient, grid + x labels */
function PortfolioChart() {
  const pts = [18, 30, 26, 42, 38, 54, 50, 66, 62, 78, 74, 88] as const;
  const W = 300;
  const H = 86;
  const step = W / (pts.length - 1);
  const y = (p: number) => H - (p / 100) * H;
  // smooth cubic path through the points (Catmull-Rom → bezier)
  let line = `M 0,${y(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = i * step;
    const x1 = (i + 1) * step;
    const cx = (x0 + x1) / 2;
    const y0 = y(pts[i]);
    const y1 = y(pts[i + 1]);
    line += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="h-[96px] w-full" aria-hidden>
        <defs>
          <linearGradient id="lp-chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0D9488" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#0D9488" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="lp-chart-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#0F766E" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" y1={H * f} x2={W} y2={H * f} stroke="rgba(14,31,27,0.07)" strokeWidth="1" />
        ))}
        <path d={`${line} L ${W},${H} L 0,${H} Z`} fill="url(#lp-chart-fill)" />
        <path d={line} fill="none" stroke="url(#lp-chart-line)" strokeWidth="2.4" strokeLinecap="round" />
        {/* data-point markers */}
        {pts.map((p, i) => (
          <circle key={i} cx={i * step} cy={y(p)} r={i === pts.length - 1 ? 3.4 : 2} fill={i === pts.length - 1 ? "#0F766E" : "#5EEAD4"} stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
        ))}
      </svg>
      <div className="flex justify-between px-0.5 text-[0.54rem] font-medium text-[#7A8C86]">
        {DASHBOARD_MOCK.welcome.chartX.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

const ACTION_ICONS = [ArrowDownUp, ArrowDownUp, Send] as const;

const SIDEBAR_ICONS = [LayoutGrid, WalletIcon, ArrowDownUp, Sprout, Scale, BarChart3] as const;

function DashboardPreview() {
  const m = DASHBOARD_MOCK;
  return (
    <div className="lp-dash-window" role="img" aria-label="Simulated product interface preview — illustrative only">
      {/* top bar */}
      <div className="flex items-center justify-between gap-2 border-b border-[#EDF2EF] bg-[#FAFCFA] px-4 py-3">
        <div className="flex items-center gap-2">
          <BrandMark size={20} glow={false} />
          <span
            className="text-[0.78rem] font-bold text-[#0E1F1B]"
            style={{ fontFamily: "var(--font-mtqs-display), Montserrat, sans-serif" }}
          >
            MTQΣ
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="lp-sim-tag" title={SIMULATION_NOTE}>
            {SIMULATED_PREVIEW_TAG}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#E3EAE6] bg-white px-2 py-1 text-[0.6rem] font-medium text-[#5B6E68]">
            {m.address}
            <ChevronDown className="size-3 text-[#7A8C86]" aria-hidden />
          </span>
          <span className="grid size-6 place-items-center rounded-full bg-[#0D9488] text-[0.55rem] font-bold text-white">
            A
          </span>
        </div>
      </div>

      {/* body — left sidebar + content grid */}
      <div className="grid grid-cols-[minmax(0,88px)_minmax(0,1fr)] sm:grid-cols-[minmax(0,120px)_minmax(0,1fr)]">
        {/* sidebar */}
        <div className="flex flex-col gap-1 border-r border-[#EDF2EF] bg-[#F7FAF8] p-2.5">
          {m.tabs.map((t, i) => {
            const Icon = SIDEBAR_ICONS[i];
            return (
              <span
                key={t}
                               className={`flex items-center gap-2 rounded-lg px-2.5 py-2 text-[0.62rem] font-semibold ${
                  i === 0
                    ? "bg-[#0D9488] text-white"
                    : "text-[#5B6E68]"
                }`}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">{t}</span>
                <span className="sm:hidden">{t.slice(0, 1)}</span>
              </span>
            );
          })}
        </div>

        {/* content */}
        <div className="grid grid-cols-1 gap-3 p-3.5 md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        {/* welcome + chart */}
        <div className="lp-dash-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.92rem] font-bold text-[#0E1F1B]">{m.welcome.title}</p>
              <p className="text-[0.66rem] text-[#5B6E68]">{m.welcome.subtitle}</p>
            </div>
            <div className="flex gap-1.5">
              {m.welcome.actions.map((a, i) => {
                const Icon = ACTION_ICONS[i];
                return (
                  <span key={a} className="lp-dash-btn" data-active={i === 0}>
                    {i !== 0 && <Icon className="size-3" aria-hidden />}
                    {a}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between gap-3">
            <p className="text-[1.55rem] font-extrabold leading-none text-[#0E1F1B]">
              {m.welcome.value}
              <span className="ml-2 align-middle text-[0.62rem] font-bold text-emerald-600">
                ▲ {m.welcome.change}
              </span>
            </p>
            <div className="hidden flex-col items-end gap-1 sm:flex">
              {m.welcome.tokens.map((t) => (
                <span
                  key={t.symbol}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#E3EAE6] bg-white px-2 py-0.5 text-[0.58rem] text-[#5B6E68]"
                >
                  <TokenGlyph kind={t.symbol.toLowerCase() as "eth" | "sol"} />
                  <b className="text-[#0E1F1B]">{t.amount}</b>
                  {t.value}
                </span>
              ))}
            </div>
          </div>
          <PortfolioChart />
        </div>

        {/* your assets */}
        <div className="lp-dash-panel p-4">
          <p className="text-[0.72rem] font-bold text-[#0E1F1B]">Your Assets</p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {m.assets.map((a) => (
              <li key={a.symbol} className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 transition hover:bg-[#F0F7F4]">
                <span className="flex items-center gap-2">
                  <TokenGlyph kind={a.icon} />
                  <span>
                    <b className="block text-[0.7rem] font-bold leading-tight text-[#0E1F1B]">{a.symbol}</b>
                    <span className="block text-[0.56rem] leading-tight text-[#7A8C86]">{a.tag}</span>
                  </span>
                </span>
                <span className="text-right">
                  <b className="block text-[0.7rem] font-bold leading-tight text-[#0E1F1B]">{a.amount}</b>
                  <span className="block text-[0.56rem] leading-tight text-[#7A8C86]">{a.value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* recent activity */}
        <div className="lp-dash-panel p-4 md:col-span-1">
          <p className="text-[0.72rem] font-bold text-[#0E1F1B]">{m.activity.title}</p>
          <ul className="mt-2.5 flex flex-col gap-2.5">
            {m.activity.rows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2">
                <span className="flex items-start gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#E7F4F1]">
                    {r.icon === "vote" ? (
                      <Vote className="size-3 text-[#0F766E]" aria-hidden />
                    ) : r.icon === "swap" ? (
                      <ArrowDownUp className="size-3 text-[#0F766E]" aria-hidden />
                    ) : (
                      <span className="text-[0.5rem] font-extrabold text-[#0F766E]">M</span>
                    )}
                  </span>
                  <span>
                    <b className="block text-[0.68rem] font-semibold leading-tight text-[#0E1F1B]">{r.title}</b>
                    {r.detail && <span className="block text-[0.56rem] leading-tight text-emerald-600">{r.detail}</span>}
                    {r.value && (
                      <span className="block text-[0.62rem] font-bold leading-tight text-emerald-600">{r.value}</span>
                    )}
                    <span className="block text-[0.55rem] leading-tight text-[#7A8C86]">{r.when}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* network status */}
        <div className="lp-dash-panel p-4">
          <p className="text-[0.72rem] font-bold text-[#0E1F1B]">{m.network.title}</p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {m.network.rows.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="size-4 rounded-full" style={{ background: n.color }} aria-hidden />
                  <b className="text-[0.68rem] font-semibold text-[#0E1F1B]">{n.name}</b>
                </span>
                <span className="flex items-center gap-1.5 text-[0.62rem] font-semibold text-emerald-600">
                  <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                  {n.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      </div>
    </div>
  );
}

export function EcosystemSection({ onLaunch }: { onLaunch?: () => void }) {
  return (
    <section id="ecosystem" className="relative z-10 pb-4 pt-10 sm:pt-14" aria-labelledby="eco-heading">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:gap-12 xl:px-10">
        {/* left column */}
        <div className="lp-rise">
          <span className="lp-eco-pill">
            <span className="grid size-4 place-items-center">
              <span
                className="text-[0.7rem] font-extrabold text-[#0D9488]"
                style={{ fontFamily: "var(--font-mtqs-display), Montserrat, sans-serif" }}
                aria-hidden
              >
                M
              </span>
            </span>
            {ECOSYSTEM.pill}
          </span>
          <h2 id="eco-heading" className="lp-h2 mt-5">
            <span className="block">{ECOSYSTEM.headlineLines[0].text}</span>
            <span className="lp-h2-grad block">{ECOSYSTEM.headlineLines[1].text}</span>
          </h2>
          <p className="mt-4 text-[0.92rem] leading-relaxed text-[#4A5C56]">{ECOSYSTEM.paragraph}</p>
          <ul className="mt-6 flex flex-col gap-3">
            {ECOSYSTEM.checklist.map((item) => (
              <li key={item} className="lp-check-item">
                <span className="lp-check-circle">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
          {onLaunch ? (
            <button type="button" className="lp-btn-primary mt-8 !h-[2.9rem]" onClick={onLaunch}>
              {ECOSYSTEM.cta.label}
              <ArrowRight className="size-4" aria-hidden />
            </button>
          ) : (
            <a href={ECOSYSTEM.cta.href} className="lp-btn-primary mt-8 !h-[2.9rem]">
              {ECOSYSTEM.cta.label}
              <ArrowRight className="size-4" aria-hidden />
            </a>
          )}
        </div>

        {/* right column — simulated dashboard preview */}
        <div className="lp-rise relative" style={{ animationDelay: "0.12s" }}>
          <div className="pointer-events-none absolute -inset-10 -z-10 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(13,148,136,0.08),transparent_75%)]" aria-hidden />
          <DashboardPreview />
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-[0.6rem] text-[#7A8C86]">
            <ShieldCheck className="size-3 shrink-0" aria-hidden />
            {SIMULATION_NOTE}
          </p>
        </div>
      </div>
    </section>
  );
}
