// MTQΣ — Chain Explorer for the Sovereign Devnet (mtq-devnet-1).
//
// Live sources (canonical 3s poll each — skip while hidden, immediate refresh
// on visibilitychange, last-good retention flagged stale):
//   • /api/chain/blocks?page=P&pageSize=15 — paginated block table
//   • /api/chain/tx?recent=1               — latest 25 committed txs
//   • /api/chain/validators                — address → moniker lookup
// Search resolves height | blk_… | tx_… | mtq1… (block/tx detail dialogs,
// rich account detail view — balances, staking queues, governance ballots,
// validator role, recent txs). Detail dialogs fetch once per open — a FAILED
// receipt is shown as FAILED, never hidden; empty blocks say so.
//
// TASK 40-c — section contract: ExplorerSection() takes no props.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Search, ShieldAlert, X, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Panel, Pill, Reveal, SectionHeading, Skeleton, GlowDot } from "@/components/mtq/primitives";
import {
  CopyMono,
  FieldCell,
  LiveClockPill,
  QuorumChip,
  StaleStrip,
  TxResultBadge,
  TxTypePill,
  ValidatorStatusPill,
  fmtDuration,
  fmtMicro,
  fmtPower,
  useChainBlockStream,
  useChainPoll,
  type AccountDto,
  type AccountVoteDto,
  type BlockDetailDto,
  type BlockRowDto,
  type BlocksPageDto,
  type GovProposalDto,
  type StakeRowDto,
  type TxRowDto,
  type UnbondingRowDto,
  type ValidatorDto,
} from "@/components/mtq/chain/chain-kit";
import { fmtAgo, fmtTime, shortAddr, copyToClipboard } from "@/components/mtq/format";

const POLL_MS = 3000;
const PAGE_SIZE = 15;

/* ---------- search query resolution ---------- */

type ResolvedQuery =
  | { kind: "block"; value: string }
  | { kind: "tx"; value: string }
  | { kind: "account"; value: string }
  | { kind: "invalid"; value: string };

function resolveQuery(raw: string): ResolvedQuery {
  const t = raw.trim();
  if (!t) return { kind: "invalid", value: "" };
  if (/^\d+$/.test(t)) return { kind: "block", value: t };
  if (t.startsWith("blk_")) return { kind: "block", value: t };
  if (t.startsWith("tx_")) return { kind: "tx", value: t };
  if (/^mtq1[0-9a-f]{40}$/.test(t)) return { kind: "account", value: t };
  return { kind: "invalid", value: t };
}

/* ---------- payload readers (payload is Record<string, unknown>) ---------- */

function txAsset(raw: TxRowDto["raw"]): "MTQD" | "PMTQ" | null {
  if (raw.type !== "send") return null;
  return raw.payload.asset === "PMTQ" ? "PMTQ" : "MTQD";
}

function txAmountU(raw: TxRowDto["raw"]): number | null {
  if (raw.type !== "send") return null;
  const n = Number(raw.payload.amount);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function txCounterparty(raw: TxRowDto["raw"]): string | null {
  if (raw.type === "send") {
    const to = raw.payload.to;
    return typeof to === "string" ? to : null;
  }
  if (raw.type === "delegate" || raw.type === "undelegate") {
    const v = raw.payload.validator;
    return typeof v === "string" ? v : null;
  }
  if (raw.type === "gov_vote") {
    const id = Number(raw.payload.proposal_id);
    return Number.isFinite(id) ? `proposal #${id}` : null;
  }
  return null;
}

/* ---------- account-view helpers ---------- */

/** Proposal status → badge classes (same tone map as StakingSection — kept
 *  local per the self-contained-sections convention). */
function proposalStatusBadge(status: GovProposalDto["status"]): string {
  switch (status) {
    case "VOTING":
      return "border-mtqs-amber/40 bg-mtqs-amber/10 text-mtqs-amber";
    case "PASSED":
      return "border-mtqs-emerald/40 bg-mtqs-emerald/10 text-mtqs-emerald";
    case "EXECUTED":
      return "border-mtqs-emerald bg-mtqs-emerald text-white";
    case "REJECTED":
    case "FAILED_EXECUTION":
      return "border-mtqs-rose/40 bg-mtqs-rose/10 text-mtqs-rose";
    case "EXECUTION_QUEUED":
      return "border-slate-300 bg-slate-100 text-slate-600";
    default:
      return "border-[#E3EAE6] bg-[#F7FAF8] text-[#5B6E68]";
  }
}

/* ============================================================ */

export function ExplorerSection() {
  const [tab, setTab] = useState<"blocks" | "txs">("blocks");
  const [page, setPage] = useState(1);

  const blocks = useChainPoll<BlocksPageDto>(
    `/api/chain/blocks?page=${page}&pageSize=${PAGE_SIZE}`,
    POLL_MS,
  );
  const recentTxs = useChainPoll<{ txs: TxRowDto[] }>("/api/chain/tx?recent=1", POLL_MS);
  const validators = useChainPoll<{ validators: ValidatorDto[] }>("/api/chain/validators", POLL_MS);

  const monikerByAddr = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of validators.data?.validators ?? []) m.set(v.address, v.moniker);
    return m;
  }, [validators.data]);

  /* --- search --- */
  const [searchInput, setSearchInput] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [blockQuery, setBlockQuery] = useState<string | null>(null); // height | blk_…
  const [txQuery, setTxQuery] = useState<string | null>(null); // tx_…
  const [accountAddr, setAccountAddr] = useState<string | null>(null); // mtq1…

  const account = useChainPoll<AccountDto>(
    accountAddr ? `/api/chain/account?a=${accountAddr}` : null,
    POLL_MS,
  );

  // TASK-42 — live SSE block-event push: refresh the boards the instant a
  // block commits (throttled ≥700ms). Polling remains the correctness path;
  // a down stream just leaves the 3s cadence.
  const lastPushRefreshRef = useRef(0);
  const blockStream = useChainBlockStream(() => {
    const now = Date.now();
    if (now - lastPushRefreshRef.current < 700) return;
    lastPushRefreshRef.current = now;
    blocks.refresh();
    recentTxs.refresh();
    if (accountAddr) account.refresh();
  });

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const resolved = resolveQuery(searchInput);
    setSearchError(null);
    if (resolved.kind === "invalid") {
      setSearchError(
        resolved.value
          ? "Unrecognized query — use a block height, a blk_… block hash, a tx_… transaction hash, or an mtq1… address."
          : null,
      );
      return;
    }
    if (resolved.kind === "block") setBlockQuery(resolved.value);
    if (resolved.kind === "tx") setTxQuery(resolved.value);
    if (resolved.kind === "account") {
      setAccountAddr(resolved.value);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setSearchInput("");
  }

  const totalPages = blocks.data?.total_pages ?? 1;

  return (
    <div className="space-y-8">
      {/* ─── Header ─── */}
      <SectionHeading
        eyebrow={`explorer · ${blocks.data?.blocks[0]?.header.chain_id ?? "mtq-devnet-1"}`}
        title="Chain Explorer"
        className="mb-0"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={blockStream.connected ? "emerald" : "muted"}>
              <GlowDot color={blockStream.connected ? "emerald" : undefined} size="h-1.5 w-1.5" />
              {blockStream.connected ? "SSE live" : "poll only"}
            </Pill>
            <LiveClockPill
              stale={blocks.stale}
              lastReadAt={blocks.lastReadAt}
              loading={blocks.loading}
            />
            <Pill tone="muted" className="font-mono">
              tip {blockStream.lastEvent ? blockStream.lastEvent.height.toLocaleString("en-US") : blocks.data ? blocks.data.height.toLocaleString("en-US") : "—"}
            </Pill>
          </div>
        }
      />

      {/* ─── Search bar ─── */}
      <Reveal>
        <Panel className="p-4">
          <form onSubmit={runSearch} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative grow">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5B6E68]"
                aria-hidden="true"
              />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search height · blk_… · tx_… · mtq1…"
                aria-label="Search block height, block hash, transaction hash, or account address"
                className="h-11 border-[#E3EAE6] bg-white pl-9 font-mono text-[0.78rem] text-[#0E1F1B] placeholder:font-sans placeholder:text-[#5B6E68]"
              />
            </div>
            <Button
              type="submit"
              className="h-11 bg-mtqs-gold px-6 font-medium text-white hover:bg-mtqs-gold/90"
            >
              Search
            </Button>
          </form>
          {searchError ? (
            <p className="mt-2 text-[0.7rem] text-mtqs-amber" role="alert">
              {searchError}
            </p>
          ) : null}
          <p className="mt-2 text-[0.64rem] text-[#5B6E68]">
            Blocks, transactions and accounts are read live from the reference node&apos;s ledger —
            FAILED receipts are displayed as failures.
          </p>
        </Panel>
      </Reveal>

      {/* ─── Rich account detail view (search: mtq1…) ─── */}
      {accountAddr ? (
        <Reveal>
          <Panel className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#0E1F1B]">
                <UserRound className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
                Account
              </h3>
              <div className="flex items-center gap-2">
                <LiveClockPill
                  stale={account.stale}
                  lastReadAt={account.lastReadAt}
                  loading={account.loading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAccountAddr(null)}
                  className="h-8 border-[#E3EAE6] text-[0.7rem] text-[#5B6E68]"
                  aria-label="Close account view"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Close
                </Button>
              </div>
            </div>
            {account.stale && account.error && account.data ? (
              <StaleStrip error={account.error} source="/api/chain/account" />
            ) : null}
            {account.error && !account.data ? (
              <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-mtqs-rose" aria-hidden="true" />
                <p className="text-[0.72rem] text-rose-600">
                  Account lookup failed ({account.error}) — no balances are shown rather than
                  fabricated values.
                </p>
              </div>
            ) : account.data ? (
              <AccountView
                account={account.data}
                loading={account.loading}
                readAt={account.lastReadAt}
                onOpenBlock={(h) => setBlockQuery(String(h))}
                onOpenTx={(h) => setTxQuery(h)}
              />
            ) : (
              <div className="space-y-2">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            )}
          </Panel>
        </Reveal>
      ) : null}

      {/* ─── Blocks / Transactions tabs ─── */}
      <Reveal>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "blocks" | "txs")}>
          <TabsList className="bg-[#F0F5F2]">
            <TabsTrigger value="blocks" className="data-[state=active]:bg-white">
              Blocks
            </TabsTrigger>
            <TabsTrigger value="txs" className="data-[state=active]:bg-white">
              Transactions
            </TabsTrigger>
          </TabsList>

          {/* ── Blocks tab ── */}
          <TabsContent value="blocks" className="mt-4">
            <Panel className="p-4 sm:p-5">
              {blocks.stale && blocks.error && blocks.data ? (
                <StaleStrip error={blocks.error} source="/api/chain/blocks" />
              ) : null}

              {!blocks.data && blocks.loading ? (
                <div className="space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-md" />
                  ))}
                </div>
              ) : !blocks.data && blocks.error ? (
                <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-mtqs-rose" aria-hidden="true" />
                  <p className="text-[0.72rem] text-rose-600">
                    Block list unavailable ({blocks.error}) — no blocks are shown rather than stale
                    or fabricated rows.
                  </p>
                </div>
              ) : blocks.data && blocks.data.blocks.length === 0 ? (
                <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-6 text-center text-[0.72rem] text-[#5B6E68]">
                  No blocks yet — the chain is at height {blocks.data.height}.
                </p>
              ) : blocks.data ? (
                <>
                  <div className="overflow-x-auto">
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow className="border-[#E3EAE6] hover:bg-transparent">
                          <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Height</TableHead>
                          <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Hash</TableHead>
                          <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Txs</TableHead>
                          <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Proposer</TableHead>
                          <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Consensus</TableHead>
                          <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">QC power</TableHead>
                          <TableHead className="text-right text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Age</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {blocks.data.blocks.map((b) => (
                          <BlockRow
                            key={b.height}
                            b={b}
                            monikerByAddr={monikerByAddr}
                            onOpen={() => setBlockQuery(String(b.height))}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[0.66rem] text-[#5B6E68]">
                      Page {blocks.data.page} of {blocks.data.total_pages} · tip{" "}
                      {blocks.data.height.toLocaleString("en-US")} · newest first
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={blocks.data.page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="h-9 border-[#E3EAE6] text-[0.7rem] text-[#33544C]"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        Newer
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={blocks.data.page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        className="h-9 border-[#E3EAE6] text-[0.7rem] text-[#33544C]"
                      >
                        Older
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </Panel>
          </TabsContent>

          {/* ── Transactions tab ── */}
          <TabsContent value="txs" className="mt-4">
            <Panel className="p-4 sm:p-5">
              {recentTxs.stale && recentTxs.error && recentTxs.data ? (
                <StaleStrip error={recentTxs.error} source="/api/chain/tx" />
              ) : null}

              {!recentTxs.data && recentTxs.loading ? (
                <div className="space-y-2">
                  {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-md" />
                  ))}
                </div>
              ) : !recentTxs.data && recentTxs.error ? (
                <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-mtqs-rose" aria-hidden="true" />
                  <p className="text-[0.72rem] text-rose-600">
                    Transaction feed unavailable ({recentTxs.error}).
                  </p>
                </div>
              ) : recentTxs.data && recentTxs.data.txs.length === 0 ? (
                <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-6 text-center text-[0.72rem] text-[#5B6E68]">
                  No transactions committed yet — the recent-25 feed is empty.
                </p>
              ) : recentTxs.data ? (
                <div className="overflow-x-auto">
                  <Table className="min-w-[820px]">
                    <TableHeader>
                      <TableRow className="border-[#E3EAE6] hover:bg-transparent">
                        <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Hash</TableHead>
                        <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Type</TableHead>
                        <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">From → To</TableHead>
                        <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Amount</TableHead>
                        <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Fee</TableHead>
                        <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Status</TableHead>
                        <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Height</TableHead>
                        <TableHead className="text-right text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Age</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTxs.data.txs.map((t) => (
                        <TxRow
                          key={t.hash}
                          t={t}
                          monikerByAddr={monikerByAddr}
                          onOpen={() => setTxQuery(t.hash)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
              <p className="mt-3 text-[0.62rem] text-[#5B6E68]">
                Latest 25 committed transactions (GET /api/chain/tx?recent=1), newest first.
              </p>
            </Panel>
          </TabsContent>
        </Tabs>
      </Reveal>

      {/* ─── Detail dialogs ─── */}
      <BlockDetailDialog
        query={blockQuery}
        onClose={() => setBlockQuery(null)}
        monikerByAddr={monikerByAddr}
      />
      <TxDetailDialog query={txQuery} onClose={() => setTxQuery(null)} monikerByAddr={monikerByAddr} />
    </div>
  );
}

/* ============================================================
   Blocks table row
   ============================================================ */

function BlockRow({
  b,
  monikerByAddr,
  onOpen,
}: {
  b: BlockRowDto;
  monikerByAddr: Map<string, string>;
  onOpen: () => void;
}) {
  return (
    <TableRow
      className="cursor-pointer border-[#EDF2EF] hover:bg-[#F0F5F2]"
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open block ${b.height} detail`}
    >
      <TableCell className="py-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="font-mono tabular-nums text-[0.74rem] font-semibold text-mtqs-gold hover:underline"
        >
          #{b.height.toLocaleString("en-US")}
        </button>
      </TableCell>
      <TableCell className="py-2.5">
        <CopyMono value={b.hash} label="block hash" head={12} tail={6} />
      </TableCell>
      <TableCell className="py-2.5 font-mono tabular-nums text-[0.72rem] text-[#33544C]">
        {b.num_txs}
      </TableCell>
      <TableCell className="py-2.5 text-[0.72rem] text-[#33544C]">
        {b.header.proposer
          ? (monikerByAddr.get(b.header.proposer) ?? shortAddr(b.header.proposer, 10, 6))
          : "—"}
      </TableCell>
      <TableCell className="py-2.5 font-mono tabular-nums text-[0.72rem] text-[#33544C]">
        {b.consensus_ms} ms
      </TableCell>
      <TableCell className="py-2.5">
        <QuorumChip committed={b.qc.committed_power} total={b.qc.total_voting_power} />
      </TableCell>
      <TableCell className="py-2.5 text-right text-[0.68rem] text-[#5B6E68]">
        {fmtAgo(b.time_ms)}
      </TableCell>
    </TableRow>
  );
}

/* ============================================================
   Transactions table row
   ============================================================ */

function TxRow({
  t,
  monikerByAddr,
  onOpen,
}: {
  t: TxRowDto;
  monikerByAddr: Map<string, string>;
  onOpen: () => void;
}) {
  const asset = txAsset(t.raw);
  const amountU = txAmountU(t.raw);
  const counterparty = txCounterparty(t.raw);

  return (
    <TableRow
      className="cursor-pointer border-[#EDF2EF] hover:bg-[#F0F5F2]"
      onClick={onOpen}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open transaction ${shortAddr(t.hash, 8, 6)} detail`}
    >
      <TableCell className="py-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="font-mono text-[0.72rem] font-semibold text-mtqs-gold hover:underline"
        >
          {shortAddr(t.hash, 10, 6)}
        </button>
      </TableCell>
      <TableCell className="py-2.5">
        <TxTypePill type={t.raw.type} />
      </TableCell>
      <TableCell className="py-2.5 font-mono text-[0.68rem] text-[#33544C]">
        <span title={t.raw.from}>{shortAddr(t.raw.from, 8, 5)}</span>
        <span className="mx-1 text-[#5B6E68]" aria-hidden="true">→</span>
        {counterparty ? (
          counterparty.startsWith("mtq1") ? (
            <span title={counterparty}>
              {shortAddr(counterparty, 8, 5)}
              {monikerByAddr.has(counterparty) ? (
                <span className="ml-1 font-sans text-[0.6rem] text-[#5B6E68]">
                  ({monikerByAddr.get(counterparty)})
                </span>
              ) : null}
            </span>
          ) : (
            <span>{counterparty}</span>
          )
        ) : (
          <span className="text-[#5B6E68]">—</span>
        )}
      </TableCell>
      <TableCell className="py-2.5 font-mono tabular-nums text-[0.72rem] text-[#33544C]">
        {amountU != null ? `${fmtMicro(amountU)} ${asset}` : <span className="text-[#5B6E68]">—</span>}
      </TableCell>
      <TableCell className="py-2.5 font-mono tabular-nums text-[0.68rem] text-[#5B6E68]">
        {fmtMicro(t.raw.fee, 3)}
      </TableCell>
      <TableCell className="py-2.5">
        <TxResultBadge ok={t.result.ok} error={t.result.error} />
      </TableCell>
      <TableCell className="py-2.5 font-mono tabular-nums text-[0.72rem] text-[#33544C]">
        #{t.height.toLocaleString("en-US")}
      </TableCell>
      <TableCell className="py-2.5 text-right text-[0.68rem] text-[#5B6E68]">
        {fmtAgo(t.time_ms)}
      </TableCell>
    </TableRow>
  );
}

/* ============================================================
   Block detail dialog
   ============================================================ */

function BlockDetailDialog({
  query,
  onClose,
  monikerByAddr,
}: {
  query: string | null;
  onClose: () => void;
  monikerByAddr: Map<string, string>;
}) {
  const [detail, setDetail] = useState<BlockDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query == null) return;
    let mounted = true;
    setDetail(null);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/chain/block?id=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as BlockDetailDto;
        if (mounted) setDetail(json);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [query]);

  const open = query != null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-[#E3EAE6] bg-white text-[#0E1F1B] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-mono">
            Block {detail ? `#${detail.height.toLocaleString("en-US")}` : query}
          </DialogTitle>
          <DialogDescription className="text-[0.72rem] text-[#5B6E68]">
            Full header, quorum certificate (signed precommits) and transaction receipts — read
            directly from the node&apos;s ledger.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-mtqs-rose" aria-hidden="true" />
            <p className="text-[0.72rem] text-rose-600">
              Block not found or node unreachable ({error}).
            </p>
          </div>
        ) : detail ? (
          <div className="space-y-5">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <FieldCell label="Height" mono>
                {detail.height.toLocaleString("en-US")}
              </FieldCell>
              <FieldCell label="Chain ID" mono>{detail.header.chain_id}</FieldCell>
              <FieldCell label="Round" mono>R{detail.header.round}</FieldCell>
              <FieldCell label="Time">
                {fmtTime(detail.header.time_ms)}{" "}
                <span className="text-[#5B6E68]">({fmtAgo(detail.header.time_ms)})</span>
              </FieldCell>
              <FieldCell label="Txs" mono>{detail.num_txs}</FieldCell>
              <FieldCell label="Consensus" mono>{detail.consensus_ms} ms</FieldCell>
              <FieldCell label="Proposer">
                {monikerByAddr.get(detail.header.proposer) ?? "validator"}{" "}
                <span className="font-mono text-[0.62rem] text-[#5B6E68]">
                  {shortAddr(detail.header.proposer, 10, 6)}
                </span>
              </FieldCell>
              <FieldCell label="Block hash" mono>
                <CopyMono value={detail.hash} label="block hash" head={14} tail={8} />
              </FieldCell>
              <FieldCell label="Prev hash" mono>
                {detail.header.prev_hash ? (
                  <CopyMono value={detail.header.prev_hash} label="prev hash" head={10} tail={6} />
                ) : (
                  "— (genesis link)"
                )}
              </FieldCell>
              <FieldCell label="Txs root" mono>
                <CopyMono value={detail.header.txs_root} label="txs root" head={10} tail={6} />
              </FieldCell>
              <FieldCell label="State root" mono>
                <CopyMono value={detail.header.state_root} label="state root" head={10} tail={6} />
              </FieldCell>
              <FieldCell label="Validators hash" mono>
                <CopyMono
                  value={detail.header.validators_hash}
                  label="validators hash"
                  head={10}
                  tail={6}
                />
              </FieldCell>
            </div>

            {/* Quorum certificate */}
            <div className="rounded-xl border border-[#E3EAE6] bg-[#FAFCFA] p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h4 className="text-[0.8rem] font-semibold text-[#0E1F1B]">
                  Quorum certificate — +2/3 precommit power
                </h4>
                <QuorumChip committed={detail.qc.committed_power} total={detail.qc.total_voting_power} />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <FieldCell label="QC height · round" mono>
                  #{detail.qc.height}·R{detail.qc.round}
                </FieldCell>
                <FieldCell label="Committed power" mono>
                  {fmtPower(detail.qc.committed_power)} of {fmtPower(detail.qc.total_voting_power)}
                </FieldCell>
                <FieldCell label="QC block hash" mono>
                  <CopyMono value={detail.qc.block_hash} label="qc block hash" head={10} tail={6} />
                </FieldCell>
              </div>
              <p className="mt-3 text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
                Precommit signers ({detail.qc.precommits.length})
              </p>
              <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#E3EAE6] bg-white p-2 mtqs-scroll">
                <ul className="space-y-1">
                  {detail.qc.precommits.map((pc, i) => (
                    <li
                      key={`${pc.voter}-${i}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.66rem]"
                    >
                      <span className="font-mono text-[#0E1F1B]" title={pc.voter}>
                        {monikerByAddr.get(pc.voter) ?? shortAddr(pc.voter, 10, 6)}
                      </span>
                      <span className="font-mono tabular-nums text-[#5B6E68]">
                        power {fmtPower(pc.power)}
                      </span>
                      <span
                        className="font-mono text-[0.6rem] text-[#5B6E68]"
                        title={pc.sig}
                      >
                        sig {shortAddr(pc.sig, 8, 6)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Transactions + receipts */}
            <div>
              <h4 className="mb-2 text-[0.8rem] font-semibold text-[#0E1F1B]">
                Transactions ({detail.txs.length})
              </h4>
              {detail.txs.length === 0 ? (
                <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-3 text-center text-[0.7rem] text-[#5B6E68]">
                  No transactions in this block (heartbeat block).
                </p>
              ) : (
                <ul className="space-y-2">
                  {detail.txs.map((t) => (
                    <li key={t.hash} className="rounded-lg border border-[#E3EAE6] bg-white p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <TxTypePill type={t.raw.type} />
                        <TxResultBadge ok={t.result.ok} error={t.result.error} />
                        <span className="ml-auto font-mono text-[0.64rem] text-[#5B6E68]">
                          idx {t.idx} · nonce {t.raw.nonce}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.66rem] text-[#33544C]">
                        <CopyMono value={t.hash} label="tx hash" head={12} tail={6} />
                        <span className="font-mono">
                          from{" "}
                          <span title={t.raw.from}>
                            {monikerByAddr.get(t.raw.from) ?? shortAddr(t.raw.from, 8, 5)}
                          </span>
                        </span>
                        {txCounterparty(t.raw) ? (
                          <span className="font-mono">
                            to{" "}
                            <span title={txCounterparty(t.raw) ?? ""}>
                              {monikerByAddr.get(txCounterparty(t.raw) ?? "") ??
                                shortAddr(txCounterparty(t.raw) ?? "", 8, 5)}
                            </span>
                          </span>
                        ) : null}
                        {txAmountU(t.raw) != null ? (
                          <span className="font-mono tabular-nums">
                            {fmtMicro(txAmountU(t.raw))} {txAsset(t.raw)}
                          </span>
                        ) : null}
                        <span className="font-mono tabular-nums text-[#5B6E68]">
                          fee {fmtMicro(t.raw.fee, 3)} MTQD
                        </span>
                      </div>
                      {t.result.ok && t.result.effects && t.result.effects.length > 0 ? (
                        <ul className="mt-2 space-y-0.5 rounded-md bg-[#F7FAF8] p-2">
                          {t.result.effects.map((eff, i) => (
                            <li key={i} className="font-mono text-[0.6rem] leading-relaxed text-[#33544C]">
                              <span className="text-mtqs-emerald" aria-hidden="true">✓</span> {eff}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {t.result.error ? (
                        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 font-mono text-[0.6rem] leading-relaxed text-rose-600">
                          error: {t.result.error}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   Tx detail dialog
   ============================================================ */

function TxDetailDialog({
  query,
  onClose,
  monikerByAddr,
}: {
  query: string | null;
  onClose: () => void;
  monikerByAddr: Map<string, string>;
}) {
  const [detail, setDetail] = useState<TxRowDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query == null) return;
    let mounted = true;
    setDetail(null);
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/chain/tx?hash=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as TxRowDto;
        if (mounted) setDetail(json);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [query]);

  const open = query != null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-[#E3EAE6] bg-white text-[#0E1F1B] sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-mono">Transaction</DialogTitle>
          <DialogDescription className="text-[0.72rem] text-[#5B6E68]">
            Signed payload with its on-chain execution receipt.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-mtqs-rose" aria-hidden="true" />
            <p className="text-[0.72rem] text-rose-600">Transaction not found ({error}).</p>
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <TxTypePill type={detail.raw.type} />
              <TxResultBadge ok={detail.result.ok} error={detail.result.error} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <FieldCell label="Hash" mono>
                <CopyMono value={detail.hash} label="tx hash" head={12} tail={8} />
              </FieldCell>
              <FieldCell label="Height · idx" mono>
                #{detail.height.toLocaleString("en-US")} · {detail.idx}
              </FieldCell>
              <FieldCell label="Time">
                {fmtTime(detail.time_ms)} <span className="text-[#5B6E68]">({fmtAgo(detail.time_ms)})</span>
              </FieldCell>
              <FieldCell label="Signer (from)" mono>
                <span title={detail.raw.from}>
                  {monikerByAddr.get(detail.raw.from) ?? shortAddr(detail.raw.from, 10, 6)}
                </span>
              </FieldCell>
              <FieldCell label="Nonce" mono>{detail.raw.nonce}</FieldCell>
              <FieldCell label="Fee" mono>
                {detail.raw.fee.toLocaleString("en-US")} µMTQD ({fmtMicro(detail.raw.fee, 3)} MTQD)
              </FieldCell>
            </div>

            <div>
              <p className="mb-1.5 text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
                Payload
              </p>
              <div className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] p-3">
                <ul className="space-y-1">
                  {Object.entries(detail.raw.payload).map(([k, v]) => (
                    <li key={k} className="flex flex-wrap gap-x-2 font-mono text-[0.66rem]">
                      <span className="text-[#5B6E68]">{k}:</span>
                      <span className="break-all text-[#0E1F1B]">
                        {typeof v === "number" && /amount|deposit|fee|stake|power/.test(k)
                          ? `${v.toLocaleString("en-US")} u (${fmtMicro(v)} display)`
                          : String(v)}
                      </span>
                    </li>
                  ))}
                  {Object.keys(detail.raw.payload).length === 0 ? (
                    <li className="text-[0.66rem] text-[#5B6E68]">(empty payload)</li>
                  ) : null}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <FieldCell label="Signature (ed25519)" mono>
                <span title={detail.raw.sig}>{shortAddr(detail.raw.sig, 16, 8)}</span>
              </FieldCell>
              <FieldCell label="Public key" mono>
                <span title={detail.raw.pub_key}>{shortAddr(detail.raw.pub_key, 16, 8)}</span>
              </FieldCell>
            </div>

            {detail.result.ok && detail.result.effects && detail.result.effects.length > 0 ? (
              <div>
                <p className="mb-1.5 text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
                  Effects
                </p>
                <ul className="space-y-1 rounded-lg border border-mtqs-emerald/25 bg-mtqs-emerald/[0.05] p-3">
                  {detail.result.effects.map((eff, i) => (
                    <li key={i} className="font-mono text-[0.64rem] leading-relaxed text-[#33544C]">
                      <span className="text-mtqs-emerald" aria-hidden="true">✓</span> {eff}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {detail.result.error ? (
              <div>
                <p className="mb-1.5 text-[0.6rem] uppercase tracking-[0.18em] text-mtqs-rose">
                  Failure
                </p>
                <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 font-mono text-[0.64rem] leading-relaxed text-rose-600">
                  {detail.result.error}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
   Account view — rich detail panel (Task 42-D)
   Full-width account sheet: identity header (address · exists/
   unknown · nonce), balances row, staking block (bonded positions +
   unbonding queue with live countdowns), governance ballots, validator
   role (only when the account IS one), recent transactions. Every empty
   state is an honest line — nothing is fabricated.
   ============================================================ */

function AccountView({
  account,
  loading,
  readAt,
  onOpenBlock,
  onOpenTx,
}: {
  account: AccountDto;
  loading: boolean;
  readAt: number | null;
  onOpenBlock: (height: number) => void;
  onOpenTx: (hash: string) => void;
}) {
  // 1s ticker so unbonding countdowns advance between polls (StakingSection
  // pattern). release_in_ms is anchored at the server read, so the live
  // countdown subtracts client-side elapsed time since readAt — immune to
  // server/client clock skew.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsedSinceRead = readAt == null ? 0 : Math.max(0, now - readAt);

  return (
    <div className="space-y-5">
      {/* Identity header — full address, copy affordance, exists/unknown, nonce */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          className="font-mono text-[0.78rem] break-all text-[#0E1F1B]"
          title={account.address}
        >
          {account.address}
        </span>
        <button
          type="button"
          onClick={async () => {
            const ok = await copyToClipboard(account.address);
            if (ok) toast.success("Copied address", { description: shortAddr(account.address) });
            else toast.error("Copy failed");
          }}
          className="rounded border border-transparent px-1.5 py-0.5 font-mono text-[0.6rem] text-mtqs-gold transition hover:border-mtqs-amber/30 hover:text-mtqs-gold"
          aria-label="Copy full account address"
        >
          copy
        </button>
        {account.exists ? (
          <Pill tone="emerald">
            <span className="h-1.5 w-1.5 rounded-full bg-mtqs-emerald" aria-hidden="true" />
            on-chain
          </Pill>
        ) : (
          <Pill tone="muted">unknown</Pill>
        )}
        <Pill tone="muted" className="font-mono">
          nonce {account.nonce}
        </Pill>
        {loading ? <Pill tone="muted">refreshing…</Pill> : null}
      </div>

      {/* Unknown-account state — honest zeros, never invented history */}
      {!account.exists ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-2.5">
          <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#5B6E68]" aria-hidden="true" />
          <p className="text-[0.7rem] leading-relaxed text-[#5B6E68]">
            Account not found on-chain (no nonce, no balance, no history) — the address is valid
            mtq1 form, but the chain has recorded no activity for it. The blocks below read zero
            and empty, honestly.
          </p>
        </div>
      ) : null}

      {/* Balances row */}
      <section className="space-y-2">
        <p className="text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">Balances</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <FieldCell label="MTQD · testnet credit" mono>
            {fmtMicro(account.fee_u, 3)}{" "}
            <span className="text-[0.6rem] text-[#5B6E68]">MTQD</span>
          </FieldCell>
          <FieldCell label="PMTQ · non-canonical mirror" mono>
            {fmtMicro(account.pmtq_u, 3)}{" "}
            <span className="text-[0.6rem] text-[#5B6E68]">PMTQ</span>
          </FieldCell>
          <FieldCell label="Bonded (staked)" mono>
            {fmtMicro(account.bonded_u)}{" "}
            <span className="text-[0.6rem] text-[#5B6E68]">MTQD</span>
          </FieldCell>
          <FieldCell label="Unbonding (queued)" mono>
            {fmtMicro(account.unbonding_u)}{" "}
            <span className="text-[0.6rem] text-[#5B6E68]">MTQD</span>
          </FieldCell>
        </div>
        <p className="text-[0.62rem] text-[#5B6E68]">
          MTQD is devnet uMTQD — a testnet-only fee credit · PMTQ is a NON-CANONICAL pilot
          ledger mirror; canonical MTQΣ supply accounting stays in the monetary protocol
          engine.
        </p>
      </section>

      {/* Staking block — bonded positions + unbonding queue */}
      <section className="space-y-3">
        <p className="text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">Staking</p>
        <div className="space-y-1.5">
          <p className="text-[0.66rem] font-medium text-[#33544C]">
            Bonded positions ({account.stakes.length})
          </p>
          {account.stakes.length > 0 ? (
            <AccountStakesTable stakes={account.stakes} />
          ) : (
            <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-2.5 text-[0.7rem] text-[#5B6E68]">
              No bonded positions — this account delegates to no validator.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <p className="text-[0.66rem] font-medium text-[#33544C]">
            Unbonding queue ({account.unbondings.length})
          </p>
          {account.unbondings.length > 0 ? (
            <AccountUnbondingsTable unbondings={account.unbondings} elapsed={elapsedSinceRead} />
          ) : (
            <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-2.5 text-[0.7rem] text-[#5B6E68]">
              No unbonding entries — nothing time-locked in the release queue.
            </p>
          )}
        </div>
      </section>

      {/* Governance block — ballots cast by this account */}
      <section className="space-y-1.5">
        <p className="text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
          Governance participation
        </p>
        {account.votes.length > 0 ? (
          <AccountVotesTable votes={account.votes} />
        ) : (
          <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-2.5 text-[0.7rem] text-[#5B6E68]">
            No governance votes cast by this address.
          </p>
        )}
        <p className="text-[0.62rem] text-[#5B6E68]">
          Ballots across the 50 most recent proposals (bounded lookup — ballots on older
          proposals are not shown here).
        </p>
      </section>

      {/* Validator block — only when this account IS a validator */}
      {account.validator ? (
        <section className="space-y-1.5">
          <p className="text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">Validator role</p>
          <div className="rounded-lg border border-mtqs-gold/25 bg-mtqs-gold/[0.04] p-3">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="text-[0.8rem] font-semibold text-[#0E1F1B]">
                {account.validator.moniker}
              </span>
              <ValidatorStatusPill status={account.validator.status} />
              <Pill tone="muted" className="font-mono">
                power {fmtPower(account.validator.power)}
              </Pill>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.64rem] text-[#5B6E68]">
              <span>
                self-stake{" "}
                <span className="font-mono tabular-nums text-[#33544C]">
                  {fmtMicro(account.validator.self_stake)} MTQD
                </span>
              </span>
              <span>
                delegated{" "}
                <span className="font-mono tabular-nums text-[#33544C]">
                  {fmtMicro(account.validator.delegated)} MTQD
                </span>
              </span>
              <span title="Commission is informational only — rewards_enabled is default OFF (no reward stream anywhere)">
                commission{" "}
                <span className="font-mono tabular-nums text-[#33544C]">
                  {(account.validator.commission_bp / 100).toFixed(2)}%
                </span>{" "}
                <span className="text-[#5B6E68]">
                  (informational — no reward stream by default)
                </span>
              </span>
              <span>
                joined height{" "}
                <span className="font-mono tabular-nums text-[#33544C]">
                  #{account.validator.joined_height.toLocaleString("en-US")}
                </span>
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {/* Recent transactions — last 25 touching this address */}
      <section className="space-y-1.5">
        <p className="text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
          Recent transactions ({account.recent_txs.length})
        </p>
        {account.recent_txs.length === 0 ? (
          <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-3 text-center text-[0.7rem] text-[#5B6E68]">
            No transactions involving this address yet.
          </p>
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-lg border border-[#E3EAE6] bg-white mtqs-scroll">
            <ul className="divide-y divide-[#EDF2EF]">
              {account.recent_txs.map((t) => (
                <li
                  key={t.hash}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[0.68rem] hover:bg-[#F7FAF8]"
                >
                  <button
                    type="button"
                    onClick={() => onOpenTx(t.hash)}
                    className="font-mono font-semibold text-mtqs-gold hover:underline"
                    title={t.hash}
                  >
                    {shortAddr(t.hash, 10, 6)}
                  </button>
                  <TxTypePill type={t.raw.type} />
                  <TxResultBadge ok={t.result.ok} error={t.result.error} />
                  <button
                    type="button"
                    onClick={() => onOpenBlock(t.height)}
                    className="font-mono tabular-nums text-[#5B6E68] hover:text-mtqs-gold hover:underline"
                  >
                    #{t.height.toLocaleString("en-US")}
                  </button>
                  <span
                    className="ml-auto text-[0.62rem] text-[#5B6E68]"
                    title={fmtTime(t.time_ms)}
                  >
                    {fmtTime(t.time_ms)} ({fmtAgo(t.time_ms)})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="text-[0.62rem] text-[#5B6E68]">
          Last 25 committed transactions touching this address (from or to) — FAILED receipts
          render as failures, never hidden.
        </p>
      </section>
    </div>
  );
}

/* ============================================================
   Account sub-tables (bonded / unbonding / governance)
   ============================================================ */

/** Bonded delegation positions — validator moniker, status pill, amount. */
function AccountStakesTable({ stakes }: { stakes: StakeRowDto[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow className="border-[#E3EAE6] hover:bg-transparent">
            <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Validator</TableHead>
            <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Status</TableHead>
            <TableHead className="text-right text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Amount</TableHead>
            <TableHead className="text-right text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Bonded at</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stakes.map((s, i) => (
            <TableRow key={s.id ?? `${s.validator}-${i}`} className="border-[#EDF2EF]">
              <TableCell className="py-2 text-[0.72rem] font-semibold text-[#0E1F1B]" title={s.validator}>
                {s.validator_moniker}
              </TableCell>
              <TableCell className="py-2">
                <ValidatorStatusPill status={s.validator_status} />
              </TableCell>
              <TableCell className="py-2 text-right font-mono tabular-nums text-[0.72rem] text-[#33544C]">
                {fmtMicro(s.amount_u)} MTQD
              </TableCell>
              <TableCell className="py-2 text-right font-mono tabular-nums text-[0.68rem] text-[#5B6E68]">
                #{s.created_height.toLocaleString("en-US")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Unbonding queue — time-locked releases with a live countdown driven by
 *  release_in_ms minus client-elapsed time since the last successful read. */
function AccountUnbondingsTable({
  unbondings,
  elapsed,
}: {
  unbondings: UnbondingRowDto[];
  elapsed: number;
}) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow className="border-[#E3EAE6] hover:bg-transparent">
            <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Validator</TableHead>
            <TableHead className="text-right text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Amount</TableHead>
            <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Release</TableHead>
            <TableHead className="text-right text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Queued at</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {unbondings.map((u) => {
            const left = Math.max(0, u.release_in_ms - elapsed);
            return (
              <TableRow key={u.id} className="border-[#EDF2EF]">
                <TableCell className="py-2 text-[0.72rem] font-semibold text-[#0E1F1B]" title={u.validator}>
                  {u.validator_moniker}
                </TableCell>
                <TableCell className="py-2 text-right font-mono tabular-nums text-[0.72rem] text-[#33544C]">
                  {fmtMicro(u.amount_u)} MTQD
                </TableCell>
                <TableCell className="py-2">
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <Pill tone={left > 0 ? "amber" : "emerald"}>
                      {left > 0 ? "unbonding" : "mature"}
                    </Pill>
                    <span className="font-mono text-[0.62rem] text-[#5B6E68]">
                      {left > 0 ? `releases in ${fmtDuration(left)}` : "releases at next block"}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="py-2 text-right font-mono tabular-nums text-[0.68rem] text-[#5B6E68]">
                  #{u.created_height.toLocaleString("en-US")}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Governance ballots cast by this account — proposal, its status, the vote
 *  option (YES emerald · NO rose · ABSTAIN muted — StakingSection tone map)
 *  and the voting power the ballot carried. */
function AccountVotesTable({ votes }: { votes: AccountVoteDto[] }) {
  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[720px]">
        <TableHeader>
          <TableRow className="border-[#E3EAE6] hover:bg-transparent">
            <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Proposal</TableHead>
            <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Status</TableHead>
            <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Vote</TableHead>
            <TableHead className="text-right text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Power</TableHead>
            <TableHead className="text-right text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Cast at</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {votes.map((v) => (
            <TableRow key={`${v.proposal_id}-${v.height}`} className="border-[#EDF2EF]">
              <TableCell className="py-2 text-[0.72rem] text-[#33544C]">
                <span className="font-mono font-semibold text-mtqs-gold">#{v.proposal_id}</span>{" "}
                <span className="align-middle">{v.proposal_title}</span>
              </TableCell>
              <TableCell className="py-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium ${proposalStatusBadge(
                    v.proposal_status,
                  )}`}
                >
                  {v.proposal_status}
                </span>
              </TableCell>
              <TableCell className="py-2">
                <Pill tone={v.option === "YES" ? "emerald" : v.option === "NO" ? "rose" : "muted"}>
                  <span className="font-mono">{v.option}</span>
                </Pill>
              </TableCell>
              <TableCell className="py-2 text-right font-mono tabular-nums text-[0.72rem] text-[#33544C]">
                {fmtPower(v.power)}
              </TableCell>
              <TableCell className="py-2 text-right font-mono tabular-nums text-[0.68rem] text-[#5B6E68]">
                #{v.height.toLocaleString("en-US")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
