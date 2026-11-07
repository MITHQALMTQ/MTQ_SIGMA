// MTQΣ — Network Operations Center (NOC) for the Sovereign Devnet.
//
// Every value on this board is read from GET /api/chain (the in-process
// reference node's ACTUAL state) on the app's canonical 3s poll: skip while
// document.hidden, immediate refresh on visibilitychange, last-good retention
// (flagged stale) on failed polls. Nothing is synthesized. The node's honest
// disclosure payload (summary.honest.*) is rendered VERBATIM in the amber
// panel — this devnet is single-process and says so.
//
// TASK 40-c — section contract: NetworkSection() takes no props.

"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Blocks,
  Fingerprint,
  Gauge,
  Inbox,
  Radio,
  ShieldAlert,
  Star,
  Timer,
  Users,
  CheckCircle2,
} from "lucide-react";
import {
  GlowDot,
  MiniBar,
  Panel,
  Pill,
  Reveal,
  SectionHeading,
  Skeleton,
  StatCard,
} from "@/components/mtq/primitives";
import {
  LiveClockPill,
  StaleStrip,
  ValidatorStatusPill,
  fmtDuration,
  fmtMicro,
  fmtPower,
  fmtUptime,
  useChainBlockStream,
  useChainPoll,
  useOracleView,
  type ChainPollState,
  type ChainSummaryDto,
  type OracleFamilyMedianDto,
  type OracleViewDto,
} from "@/components/mtq/chain/chain-kit";
import { fmtAgo, shortAddr } from "@/components/mtq/format";

const POLL_MS = 3000;

export function NetworkSection() {
  const poll = useChainPoll<ChainSummaryDto>("/api/chain", POLL_MS);
  const summary = poll.data;

  // TASK-43 — on-chain oracle consensus (§17.10 reference) on its own 6s poll
  // (canonical pattern: hidden-tab skip, visibility refresh, last-good
  // retention). The panel below keeps its own honest loading / error / empty
  // states — an empty price set is a NORMAL devnet state, not a failure.
  const oracle = useOracleView();

  // TASK-42 — live SSE block-event push: instant refresh on every committed
  // block (throttled ≥700ms so bursts never stampede the API). Polling stays
  // the correctness path — SSE is instant-refresh sugar; if the stream is
  // down the board simply keeps its 3s cadence.
  const lastPushRefreshRef = useRef(0);
  const blockStream = useChainBlockStream(() => {
    const now = Date.now();
    if (now - lastPushRefreshRef.current >= 700) {
      lastPushRefreshRef.current = now;
      poll.refresh();
    }
  });

  // Local 1s clock so Uptime (mm:ss) ticks between server reads.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // address → moniker lookup (validator set ships with the summary)
  const monikerByAddr = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of summary?.validators.list ?? []) m.set(v.address, v.moniker);
    return m;
  }, [summary]);

  // Ticking uptime: server uptime_ms at last read + elapsed since that read.
  const uptimeMs =
    summary && summary.booted_at_ms > 0 && poll.lastReadAt != null
      ? summary.uptime_ms + Math.max(0, now - poll.lastReadAt)
      : null;

  const telemetry = useMemo(
    () => (summary?.telemetry_recent ?? []).slice(-8).reverse(),
    [summary],
  );

  return (
    <div className="space-y-10">
      {/* ─── Header ─── */}
      <SectionHeading
        eyebrow={`network noc · ${summary?.chain_id ?? "mtq-devnet-1"}`}
        title="Network Operations Center"
        className="mb-0"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={blockStream.connected ? "emerald" : "muted"}>
              <GlowDot color={blockStream.connected ? "emerald" : undefined} size="h-1.5 w-1.5" />
              {blockStream.connected ? "SSE live" : "poll only"}
            </Pill>
            <LiveClockPill stale={poll.stale} lastReadAt={poll.lastReadAt} loading={poll.loading} />
            <Pill tone="muted" className="font-mono">
              height {blockStream.lastEvent ? blockStream.lastEvent.height.toLocaleString("en-US") : summary ? summary.height.toLocaleString("en-US") : "—"}
            </Pill>
          </div>
        }
      />

      {/* First-fetch skeleton / hard error (no last-good data to serve) */}
      {!summary && poll.loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : null}
      {!summary && poll.error && !poll.loading ? (
        <Panel variant="rose" className="p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-mtqs-rose" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#0E1F1B]">Chain API unreachable</p>
              <p className="text-[0.75rem] text-[#5B6E68]">
                GET /api/chain failed ({poll.error}). The reference node boots with the Next.js
                server (src/instrumentation.ts) — if this persists, the dev server was restarted and
                the node is still initializing. No values are shown rather than fake ones.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      {summary ? (
        <>
          {poll.stale && poll.error ? (
            <StaleStrip error={poll.error} source="/api/chain" />
          ) : null}

          {/* ─── Hero stat row ─── */}
          <Reveal>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <StatCard
                icon={Blocks}
                label="Height"
                value={
                  <span className="inline-flex items-center gap-2">
                    <GlowDot color="emerald" size="h-2 w-2" />
                    {summary.height.toLocaleString("en-US")}
                  </span>
                }
                trend="live — 3s poll"
                trendDirection="neutral"
                tone="emerald"
              />
              <StatCard
                icon={Fingerprint}
                label="Chain ID"
                value={<span className="text-lg sm:text-xl">{summary.chain_id}</span>}
                trend={
                  <span
                    className="font-mono text-[0.62rem]"
                    title={summary.genesis_hash}
                  >
                    genesis {shortAddr(summary.genesis_hash, 18, 8)}
                  </span>
                }
                trendDirection="neutral"
                tone="neutral"
              />
              <StatCard
                icon={Gauge}
                label="Block time"
                value={
                  summary.latest_block ? (
                    <span>
                      {summary.latest_block.consensus_ms}
                      <span className="text-sm font-normal text-[#5B6E68]"> ms</span>
                    </span>
                  ) : (
                    "—"
                  )
                }
                trend="latest commit latency"
                trendDirection="neutral"
                tone="neutral"
              />
              <StatCard
                icon={Gauge}
                label="TPS (1m)"
                value={summary.tps_1m.toFixed(3)}
                trend="committed tx / window seconds"
                trendDirection="neutral"
                tone="neutral"
              />
              <StatCard
                icon={Users}
                label="Validators"
                value={
                  <span>
                    {summary.validators.active}
                    <span className="text-base font-normal text-[#5B6E68]">
                      /{summary.validators.total}
                    </span>
                  </span>
                }
                trend="ACTIVE / registered"
                trendDirection="neutral"
                tone="neutral"
              />
              <StatCard
                icon={Radio}
                label="Voting power"
                value={fmtPower(summary.validators.total_power)}
                trend="sum of ACTIVE power"
                trendDirection="neutral"
                tone="neutral"
              />
              <StatCard
                icon={Inbox}
                label="Mempool"
                value={summary.mempool_size.toLocaleString("en-US")}
                trend="pending · advisory-validated"
                trendDirection="neutral"
                tone="neutral"
              />
              <StatCard
                icon={Timer}
                label="Uptime"
                value={fmtUptime(uptimeMs ?? summary.uptime_ms)}
                trend="since node boot (ticks locally)"
                trendDirection="neutral"
                tone="neutral"
              />
            </div>
          </Reveal>

          {/* ─── Consensus telemetry ─── */}
          <Reveal>
            <Panel className="p-5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#0E1F1B]">
                  Consensus rounds — signed BFT votes, +2/3 quorum certificates
                </h3>
                <Pill tone="muted">last {telemetry.length} rounds</Pill>
              </div>
              <p className="mb-4 text-[0.7rem] text-[#5B6E68]">
                Each height runs a real round of ed25519-signed prevotes and precommits over the
                in-process transport bus; a block commits only when precommit power is strictly
                greater than ⅔ of total voting power.
              </p>
              {telemetry.length === 0 ? (
                <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-4 text-center text-[0.72rem] text-[#5B6E68]">
                  No consensus telemetry yet — the node reports an empty round log.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-[0.72rem]">
                    <thead>
                      <tr className="border-b border-[#E3EAE6] text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">
                        <th scope="col" className="py-2 pr-3 font-medium">Round</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Proposer</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Prevote power</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Precommit power</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Consensus</th>
                        <th scope="col" className="py-2 pr-3 font-medium">Txs</th>
                        <th scope="col" className="py-2 font-medium">Committed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {telemetry.map((t, i) => {
                        const committed = t.committed_at_ms != null;
                        return (
                          <tr
                            key={`${t.height}-${t.round}-${i}`}
                            className="border-b border-[#EDF2EF] last:border-0"
                          >
                            <td className="py-2 pr-3 font-mono tabular-nums text-[#0E1F1B]">
                              #{t.height}·R{t.round}
                            </td>
                            <td className="py-2 pr-3 text-[#0E1F1B]">
                              {monikerByAddr.get(t.proposer) ?? shortAddr(t.proposer, 10, 6)}
                            </td>
                            <td className="py-2 pr-3 font-mono tabular-nums text-[#33544C]">
                              {fmtPower(t.prevotes)}
                            </td>
                            <td className="py-2 pr-3 font-mono tabular-nums text-[#33544C]">
                              {fmtPower(t.precommits)}
                            </td>
                            <td className="py-2 pr-3 font-mono tabular-nums text-[#33544C]">
                              {t.consensus_ms} ms
                            </td>
                            <td className="py-2 pr-3 font-mono tabular-nums text-[#33544C]">
                              {t.txs}
                            </td>
                            <td className="py-2">
                              {committed ? (
                                <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-mtqs-emerald">
                                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                                  committed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium text-mtqs-amber">
                                  <span className="h-1.5 w-1.5 rounded-full bg-mtqs-amber" aria-hidden="true" />
                                  open
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </Reveal>

          {/* ─── Validator power distribution ─── */}
          <Reveal>
            <Panel className="p-5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#0E1F1B]">Validator power distribution</h3>
                <Pill tone="muted" className="font-mono">
                  total {fmtPower(summary.validators.total_power)}
                </Pill>
              </div>
              <p className="mb-4 text-[0.7rem] text-[#5B6E68]">
                Power = (self-stake + delegated) ÷ 100,000 µMTQD, recomputed every block. The
                highlighted validator proposes the next height (round-robin over the ACTIVE set).
              </p>
              <div className="space-y-3">
                {summary.validators.list.map((v) => {
                  const share =
                    summary.validators.total_power > 0 ? v.power / summary.validators.total_power : 0;
                  return (
                    <div
                      key={v.address}
                      className={`rounded-lg border p-3 ${
                        v.is_proposer_next
                          ? "border-mtqs-gold/40 bg-mtqs-gold/[0.04]"
                          : "border-[#E3EAE6] bg-[#FAFCFA]"
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {v.is_proposer_next ? (
                          <Pill tone="gold">
                            <Star className="h-3 w-3" aria-hidden="true" />
                            proposes next
                          </Pill>
                        ) : null}
                        <span className="text-[0.8rem] font-semibold text-[#0E1F1B]">
                          {v.moniker}
                        </span>
                        <ValidatorStatusPill status={v.status} />
                        <span className="ml-auto font-mono tabular-nums text-[0.72rem] text-[#0E1F1B]">
                          {fmtPower(v.power)}{" "}
                          <span className="text-[#5B6E68]">
                            ({(share * 100).toFixed(1)}%)
                          </span>
                        </span>
                      </div>
                      <MiniBar
                        value={v.power}
                        max={summary.validators.total_power}
                        colorClass="bg-mtqs-emerald"
                        trackClass="bg-[#EDF2EF]"
                        height="h-2"
                      />
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.64rem] text-[#5B6E68]">
                        <span>
                          self-stake{" "}
                          <span className="font-mono tabular-nums text-[#33544C]">
                            {fmtMicro(v.self_stake)} MTQD
                          </span>
                        </span>
                        <span>
                          delegated{" "}
                          <span className="font-mono tabular-nums text-[#33544C]">
                            {fmtMicro(v.delegated)} MTQD
                          </span>
                        </span>
                        <span className="font-mono" title={v.address}>
                          {shortAddr(v.address, 12, 6)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </Reveal>

          {/* ─── Oracle consensus (§17.10 reference) ─── */}
          <Reveal>
            <OracleConsensusCard poll={oracle} />
          </Reveal>

          {/* ─── Network parameters ─── */}
          <Reveal>
            <Panel className="p-5">
              <h3 className="mb-1 text-sm font-semibold text-[#0E1F1B]">Network parameters</h3>
              <p className="mb-4 text-[0.7rem] text-[#5B6E68]">
                Live values from the node&apos;s parameter store (governance can change them via
                passed network_param proposals).
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
                {(
                  [
                    ["Base fee", `${summary.params.base_fee_u.toLocaleString("en-US")} µMTQD`, `(${fmtMicro(summary.params.base_fee_u, 4)} MTQD)`],
                    ["Max block txs", `${summary.params.max_block_txs.toLocaleString("en-US")}`, "transactions per block"],
                    ["Voting period", `${summary.params.voting_period_s.toLocaleString("en-US")} s`, "governance voting window"],
                    ["Timelock", `${summary.params.timelock_s.toLocaleString("en-US")} s`, "passed → execute delay"],
                    ["Unbonding", `${summary.params.unbonding_s.toLocaleString("en-US")} s`, "undelegate → funds release queue"],
                    ["Heartbeat", `${summary.params.heartbeat_ms.toLocaleString("en-US")} ms`, `empty-block interval (${fmtDuration(summary.params.heartbeat_ms)})`],
                    ["Block reward", summary.params.rewards_enabled === 1 ? `${summary.params.block_reward_u.toLocaleString("en-US")} µMTQD` : "OFF", "uMTQD testnet credit · Net-Econ DRAFT (ratification open)"],
                  ] as const
                ).map(([label, value, sub]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-[#E3EAE6] bg-[#F7FAF8] p-3"
                  >
                    <div className="text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
                      {label}
                    </div>
                    <div className="mt-1 font-mono tabular-nums text-[0.85rem] text-[#0E1F1B]">
                      {value}
                    </div>
                    <div className="mt-0.5 text-[0.6rem] text-[#5B6E68]">{sub}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-lg border border-mtqs-gold/25 bg-mtqs-gold/[0.05] px-3 py-2 text-[0.68rem] leading-relaxed text-[#33544C]">
                Network governance can only change allowlisted params — MTQ monetary registry is
                constitutionally out of reach.
              </p>
            </Panel>
          </Reveal>

          {/* ─── Honest status (VERBATIM from the node) ─── */}
          <Reveal>
            <div className="rounded-xl border-2 border-mtqs-amber/50 bg-amber-50 p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-mtqs-amber" aria-hidden="true" />
                <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-mtqs-amber">
                  {summary.honest.status}
                </h3>
                <Pill tone="amber">disclosed by the node · rendered verbatim</Pill>
              </div>
              <div className="space-y-3">
                {(
                  [
                    ["Scope", summary.honest.scope],
                    ["Separation", summary.honest.separation],
                    ["Economics", summary.honest.economics],
                    ["Production path", summary.honest.productionPath],
                    ["Transport", summary.honest.transport],
                  ] as const
                ).map(([label, text]) => (
                  <div key={label}>
                    <div className="text-[0.6rem] uppercase tracking-[0.2em] text-amber-700">
                      {label}
                    </div>
                    <p className="mt-0.5 text-[0.74rem] leading-relaxed text-[#33544C]">{text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 w-full rounded-lg border border-mtqs-amber/40 bg-white/70 px-3 py-2 text-center font-mono text-[0.66rem] font-semibold uppercase tracking-[0.12em] text-mtqs-amber">
                {summary.honest.label}
              </div>
            </div>
          </Reveal>

          {/* ─── last_error (node self-report) ─── */}
          {summary.last_error ? (
            <Panel variant="rose" className="p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-mtqs-rose" aria-hidden="true" />
                <div>
                  <p className="text-[0.66rem] uppercase tracking-[0.18em] text-mtqs-rose">
                    Node last_error
                  </p>
                  <p className="mt-0.5 font-mono text-[0.7rem] leading-relaxed text-[#33544C]">
                    {summary.last_error}
                  </p>
                </div>
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/* ============================================================
   TASK-43 — Oracle consensus (§17.10 reference) subviews
   Local to NetworkSection: the panel renders GET /api/chain/oracle on
   its own 6s poll (passed in as a ChainPollState). Every state is
   honest — skeleton on first load, VERBATIM module disclosure, an
   explicit empty devnet state, last-good retention flagged stale,
   and an inline error panel on hard fetch failure.
   ============================================================ */

/** Price display: micro-units → grouped decimal (2 digits for large values,
 *  4 for small ones — the contract's "2–4 decimals"). */
function fmtPriceU(u: number | null | undefined): string {
  if (u == null || !Number.isFinite(u)) return "—";
  const v = u / 1e6;
  const digits = Math.abs(v) >= 1000 ? 2 : 4;
  return v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Oracle record status → brand pill (PUBLISHED emerald · DEGRADED_SPREAD rose · STALE amber). */
function OracleStatusBadge({ status }: { status: string }) {
  if (status === "PUBLISHED") {
    return (
      <Pill tone="emerald">
        <GlowDot color="emerald" size="h-1.5 w-1.5" />
        PUBLISHED
      </Pill>
    );
  }
  if (status === "DEGRADED_SPREAD") {
    return (
      <Pill tone="rose">
        <GlowDot color="rose" size="h-1.5 w-1.5" />
        DEGRADED_SPREAD
      </Pill>
    );
  }
  if (status === "STALE") {
    return (
      <Pill tone="amber">
        <GlowDot color="amber" size="h-1.5 w-1.5" />
        STALE
      </Pill>
    );
  }
  return <Pill tone="muted">{status || "—"}</Pill>;
}

/** Per-family medians as wrapping mono chips — family · median (µ→display) · observer count. */
function OracleFamilyMedians({ medians }: { medians: OracleFamilyMedianDto[] }) {
  if (medians.length === 0) {
    return <span className="text-[0.62rem] text-[#5B6E68]">no family medians recorded</span>;
  }
  return (
    <span className="flex flex-wrap items-baseline gap-1.5">
      {medians.map((m) => (
        <span
          key={m.family}
          className="inline-flex items-baseline gap-1 rounded-md border border-[#E3EAE6] bg-[#FAFCFA] px-2 py-0.5 font-mono text-[0.62rem]"
        >
          <span className="text-[#0E1F1B]">{m.family}</span>
          <span className="tabular-nums text-[#33544C]">{fmtPriceU(m.median_u)}</span>
          <span className="text-[#5B6E68]">· {m.observers} obs</span>
        </span>
      ))}
    </span>
  );
}

/** Oracle consensus panel — prices table + observation provenance + verbatim
 *  disclosure. Desktop (md+) renders a semantic table with an always-visible
 *  per-family medians sub-row; below md each price is a stacked card so 390px
 *  stays clean with zero horizontal overflow. */
function OracleConsensusCard({ poll }: { poll: ChainPollState<OracleViewDto> }) {
  const view = poll.data;
  const observations = (view?.recent_observations ?? []).slice(0, 25);

  return (
    <Panel className="p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#0E1F1B]">Oracle consensus — §17.10 reference</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="gold">multi-family · fail-closed</Pill>
          <LiveClockPill stale={poll.stale} lastReadAt={poll.lastReadAt} loading={poll.loading} />
        </div>
      </div>
      <p className="mb-4 text-[0.7rem] text-[#5B6E68]">
        Validator-keyed observations aggregate per family into medians, then a cross-family
        median-of-medians — a price publishes on-chain only when every gate passes. Read from
        GET /api/chain/oracle on a 6s poll; all values are operator-submitted test values, not
        market data.
      </p>

      {view ? (
        <>
          {poll.stale && poll.error ? (
            <StaleStrip error={poll.error} source="/api/chain/oracle" />
          ) : null}

          {/* Honest disclosure — VERBATIM from the oracle module (same row
              styling as the node honest panel: amber label + relaxed body). */}
          <div className="mb-4 rounded-lg border border-mtqs-amber/40 bg-amber-50 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-mtqs-amber" aria-hidden="true" />
              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-amber-700">
                Disclosure
              </span>
              <Pill tone="amber">disclosed by the oracle module · rendered verbatim</Pill>
            </div>
            <p className="mt-1 text-[0.74rem] leading-relaxed text-[#33544C]">{view.honest}</p>
          </div>

          {/* Publication gates — live thresholds from the module */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
              publication gates
            </span>
            <Pill tone="default">≥ {view.thresholds.min_families} independent families</Pill>
            <Pill tone="default">≤ {view.thresholds.max_spread_bp} bp cross-family spread</Pill>
            <Pill tone="default">≤ {view.thresholds.max_staleness_blocks}-block freshness</Pill>
          </div>

          {/* Published prices */}
          {view.prices.length === 0 ? (
            <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-4 text-center text-[0.72rem] leading-relaxed text-[#5B6E68]">
              No published prices yet — the reference devnet has no automatic market feeds;
              observations arrive only via genuinely signed validator transactions.
            </p>
          ) : (
            <>
              {/* Desktop (md+): semantic table, one row per symbol plus an
                  always-visible per-family medians sub-row under it. */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[640px] text-left text-[0.72rem]">
                  <thead>
                    <tr className="border-b border-[#E3EAE6] text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">
                      <th scope="col" className="py-2 pr-3 font-medium">Symbol</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Value</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Families</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Observers</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Spread (bp)</th>
                      <th scope="col" className="py-2 font-medium">Height</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.prices.map((p) => (
                      <Fragment key={`${p.symbol}-${p.height}`}>
                        <tr className="border-b border-[#EDF2EF]">
                          <td className="py-2 pr-3 font-mono text-[#0E1F1B]">{p.symbol}</td>
                          <td className="py-2 pr-3 font-mono tabular-nums text-[#0E1F1B]">
                            {fmtPriceU(p.value_u)}
                          </td>
                          <td className="py-2 pr-3">
                            <OracleStatusBadge status={p.status} />
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums text-[#33544C]">
                            {p.families}
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums text-[#33544C]">
                            {p.observers}
                          </td>
                          <td className="py-2 pr-3 font-mono tabular-nums text-[#33544C]">
                            {p.spread_bp}
                          </td>
                          <td className="py-2 font-mono tabular-nums text-[#33544C]">
                            #{p.height}
                          </td>
                        </tr>
                        <tr className="border-b border-[#EDF2EF] bg-[#FAFCFA]">
                          <td colSpan={7} className="px-1.5 py-2">
                            <span className="mr-2 align-baseline text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
                              family medians
                            </span>
                            <OracleFamilyMedians medians={p.family_medians} />
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile (<md): stacked cards with the same fields, wrapping
                  medians — 390px clean, no horizontal overflow. */}
              <div className="space-y-3 md:hidden">
                {view.prices.map((p) => (
                  <div
                    key={`${p.symbol}-${p.height}`}
                    className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[0.8rem] font-semibold text-[#0E1F1B]">
                        {p.symbol}
                      </span>
                      <OracleStatusBadge status={p.status} />
                    </div>
                    <div className="mt-1 font-mono tabular-nums text-[1.05rem] text-[#0E1F1B]">
                      {fmtPriceU(p.value_u)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.64rem] text-[#5B6E68]">
                      <span>
                        families{" "}
                        <span className="font-mono tabular-nums text-[#33544C]">{p.families}</span>
                      </span>
                      <span>
                        observers{" "}
                        <span className="font-mono tabular-nums text-[#33544C]">{p.observers}</span>
                      </span>
                      <span>
                        spread{" "}
                        <span className="font-mono tabular-nums text-[#33544C]">{p.spread_bp} bp</span>
                      </span>
                      <span>
                        height{" "}
                        <span className="font-mono tabular-nums text-[#33544C]">#{p.height}</span>
                      </span>
                    </div>
                    <div className="mt-2 border-t border-[#EDF2EF] pt-2">
                      <OracleFamilyMedians medians={p.family_medians} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Recent observations — signed validator submissions (≤ 25) */}
          <div className="mt-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[0.78rem] font-semibold text-[#0E1F1B]">
                Recent observations — signed validator submissions
              </h4>
              <Pill tone="muted">latest {observations.length}</Pill>
            </div>
            {observations.length === 0 ? (
              <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-3 text-center text-[0.72rem] text-[#5B6E68]">
                No oracle observations recorded yet.
              </p>
            ) : (
              <ul className="mtqs-scroll max-h-72 divide-y divide-[#EDF2EF] overflow-y-auto rounded-lg border border-[#E3EAE6]">
                {observations.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 px-3 py-2 text-[0.68rem]"
                  >
                    <span className="font-semibold text-[#0E1F1B]">
                      {o.observer_moniker || shortAddr(o.observer, 10, 6)}
                    </span>
                    <span className="text-[#5B6E68]" aria-hidden="true">·</span>
                    <span className="font-mono text-[#33544C]">{o.family}</span>
                    <span className="text-[#5B6E68]" aria-hidden="true">·</span>
                    <span className="font-mono text-[#33544C]">{o.symbol}</span>
                    <span className="text-[#5B6E68]" aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[#0E1F1B]">
                      {fmtPriceU(o.value_u)}
                    </span>
                    <span className="text-[#5B6E68]" aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[#5B6E68]">#{o.height}</span>
                    <span className="ml-auto pl-2 text-[0.62rem] text-[#5B6E68]">
                      {fmtAgo(o.time_ms)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : poll.loading ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : poll.error ? (
        /* Hard fetch failure — no last-good data to serve (section pattern). */
        <div className="rounded-lg border border-mtqs-rose/30 bg-mtqs-rose/[0.05] px-3 py-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-mtqs-rose" aria-hidden="true" />
            <div>
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-mtqs-rose">
                Oracle API unreachable
              </p>
              <p className="mt-0.5 text-[0.72rem] leading-relaxed text-[#5B6E68]">
                GET /api/chain/oracle failed ({poll.error}). No oracle prices or observations are
                shown rather than fake ones.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
