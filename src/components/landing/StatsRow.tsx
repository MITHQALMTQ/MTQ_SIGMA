// MTQΣ landing — stats row (Task 58: LIVE telemetry).
// The bar design is unchanged (four big numbers + small labels on the glass
// bar, directly under the feature cards), but the values are now LIVE reads
// from the reference engine's canonical snapshot (GET /api/landing-stats,
// 4s poll — the same source that drives the Pilot Command Center),
// replacing the 2026-10-24 point-in-time constants. The registry facts that
// used to occupy the four slots (19 contracts / 3 testnets / 253/253
// invariants / 0/7 gates) remain in the footnote, dated.
//
// Liveness signals rendered on the bar itself:
//   • a pulsing emerald dot inside the tag pill,
//   • a "read Ns ago" mono ticker that re-renders every second (resets on
//     every successful poll — 0s → 4s),
//   • "reconnecting…" (never stale numbers) while a poll fails; the last
//     good values stay on screen.
//
// 2026 warm counterpoint (task55 VLM review) preserved: the single amber
// accent now rides the "Oracle Feeds Valid" stat — the live-networks story
// the review wanted the eye guided to.
//
// Polling follows the app's canonical pattern (useChainPoll in chain-kit):
// setInterval, skip while the tab is hidden, immediate refresh on
// visibility regain. No aria-live on the digits: values legitimately
// re-render every 4s and must not spam screen readers.
import { useCallback, useEffect, useState } from "react";
import { LIVE_STATS } from "@/lib/mtq/landing-status";

type LandingLiveDto = {
  referenceIndex: number;
  mtqPrice: number;
  nav: number;
  goldWeight: number;
  status: string;
  eurUsdConsensus: number | null;
  oracle: {
    liveFeeds: number;
    totalFeeds: number;
    pairsLive: number;
    pairsTotal: number;
  };
  servedAt: number;
};

const POLL_MS = 4000;

const fmt6 = (n: number): string => n.toFixed(6);
const fmtUsd = (n: number): string => `$${Math.round(n).toLocaleString("en-US")}`;

export function StatsRow() {
  const [data, setData] = useState<LandingLiveDto | null>(null);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  const poll = useCallback(async () => {
    if (document.hidden) return;
    try {
      const res = await fetch("/api/landing-stats", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { live?: LandingLiveDto };
      if (!json.live) throw new Error("unexpected payload");
      setData(json.live);
      setLastOk(Date.now());
      setDegraded(false);
    } catch {
      // Keep the last good values on screen; flag the gap honestly.
      setDegraded(true);
    }
  }, []);

  useEffect(() => {
    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    const onVis = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const items = data
    ? [
        { value: fmt6(data.referenceIndex), label: LIVE_STATS.items[0].label },
        { value: fmtUsd(data.nav), label: LIVE_STATS.items[1].label },
        {
          value: data.eurUsdConsensus != null ? fmt6(data.eurUsdConsensus) : "—",
          label: LIVE_STATS.items[2].label,
        },
        {
          value: `${data.oracle.liveFeeds}/${data.oracle.totalFeeds}`,
          label: LIVE_STATS.items[3].label,
        },
      ]
    : LIVE_STATS.items.map((s) => ({ value: "—", label: s.label }));

  const ago =
    data && lastOk != null && now != null
      ? Math.max(0, Math.floor((now - lastOk) / 1000))
      : null;

  return (
    <section
      aria-label="Protocol live telemetry — live reads from the reference engine on a 4-second poll"
      className="relative z-10 pb-14 pt-6"
    >
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 xl:px-10">
        <div className="lp-stats-bar lp-rise">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-center">
            <span className="lp-stats-tag">
              <span
                className="size-1.5 animate-pulse rounded-full bg-teal-500"
                aria-hidden="true"
              />
              {LIVE_STATS.tag}
            </span>
            <span
              className="text-center text-[0.62rem] font-mono tabular-nums text-[#5B6E68] sm:ml-auto sm:self-center sm:text-right"
              aria-live="off"
            >
              {degraded
                ? "reconnecting…"
                : ago != null
                  ? `read ${ago}s ago`
                  : "connecting…"}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4 sm:gap-x-2">
            {items.map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1.5 text-center">
                {/* 2026 warm counterpoint (task55 VLM review, Task-58 port):
                    the single amber accent rides the live-networks stat. */}
                <dd
                  className={`lp-stat-num ${
                    s.label === LIVE_STATS.items[3].label ? "lp-stat-num-warm" : ""
                  }`}
                >
                  {s.value}
                </dd>
                <dt className="lp-stat-label">{s.label}</dt>
              </div>
            ))}
          </dl>
          <p className="lp-stat-footnote">{LIVE_STATS.footnote}</p>
        </div>
      </div>
    </section>
  );
}
