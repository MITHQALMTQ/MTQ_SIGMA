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

import { useEffect, useMemo, useRef, useState } from "react";
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
  type ChainSummaryDto,
} from "@/components/mtq/chain/chain-kit";
import { shortAddr } from "@/components/mtq/format";

const POLL_MS = 3000;

export function NetworkSection() {
  const poll = useChainPoll<ChainSummaryDto>("/api/chain", POLL_MS);
  const summary = poll.data;

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
                    <div className="mt-0.5 text-[0.6rem] text-[#7A8C86]">{sub}</div>
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
