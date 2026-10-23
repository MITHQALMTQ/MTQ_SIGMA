// MTQΣ landing — stats row (v8 gap fill).
// The reference places a glass bar with four big numbers + small labels
// directly under the feature cards. Design reproduced faithfully; values
// are the pilot's TRUE, read-only-verified figures (see landing-status.ts)
// instead of the reference's marketing figures, per the no-fabrication
// mandate. Footnote states the substitution openly.
import { PROTOCOL_STATS } from "@/lib/mtq/landing-status";

export function StatsRow() {
  return (
    <section aria-label="Live protocol figures" className="relative z-10 pb-14 pt-6">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 xl:px-10">
        <div className="lp-stats-bar lp-rise">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-center">
            <span className="lp-stats-tag">{PROTOCOL_STATS.tag}</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4 sm:gap-x-2">
            {PROTOCOL_STATS.items.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1.5 text-center">
                <dd className="lp-stat-num">{s.value}</dd>
                <dt className="lp-stat-label">{s.label}</dt>
              </div>
            ))}
          </dl>
          <p className="lp-stat-footnote">{PROTOCOL_STATS.footnote}</p>
        </div>
      </div>
    </section>
  );
}
