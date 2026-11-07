// MTQΣ Network — shared client kit for the four Sovereign Devnet UI sections
// (NetworkSection · ExplorerSection · WalletSection · StakingSection).
//
// Contents (all client-safe — no node: imports anywhere in this module):
//   • DTO interfaces for every /api/chain/* endpoint (JSON wire shapes).
//   • fmtMicro / fmtPower / fmtUptime / fmtDuration — micro-unit display
//     helpers (all on-chain amounts are INTEGER micro-units, ÷1e6 to render).
//   • useChainPoll — the app's canonical polling pattern: setInterval, skip
//     while document.hidden, immediate refresh on visibilitychange, last-good
//     retention on failed polls (flagged stale), mountedRef guard.
//   • useChainSubmitter — client-side ed25519 signing (private key NEVER
//     leaves the browser) + POST /api/chain/submit, with local nonce tracking
//     so rapid consecutive submissions don't collide.
//   • Task-43: OracleViewDto + useOracleView — §17.10 on-chain oracle consensus
//     view (GET /api/chain/oracle, 6s poll).
//   • Small shared atoms: CopyMono, ValidatorStatusPill, TxTypePill,
//     TxResultBadge, QuorumChip, LiveClockPill, StaleStrip, FieldCell.
//
// READ-ONLY dependency: @/lib/chain/shared is the client-safe canonical
// encoding module (documented as such in its header) — the Wallet UI signs
// with the exact same canonicalTxBytes the node verifies.

"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  toHex,
  fromHex,
  addressFromPublicKey,
  canonicalTxBytes,
  type TxType,
} from "@/lib/chain/shared";
import { useWalletStore, type WalletRecord } from "@/lib/chain/wallet-store";
import { GlowDot, Pill } from "@/components/mtq/primitives";
import { copyToClipboard, shortAddr } from "@/components/mtq/format";

/* ============================================================
   DTOs — /api/chain/* wire shapes (client-side mirrors, typed)
   ============================================================ */

export interface ValidatorCoreDto {
  pub_key: string;
  address: string;
  moniker: string;
  power: number;
  commission_bp: number;
  status: "ACTIVE" | "CANDIDATE" | "RETIRED" | "JAILED";
  self_stake: number;
  delegated: number;
  joined_height: number;
}

export interface ValidatorDto extends ValidatorCoreDto {
  is_proposer_next: boolean;
}

export interface ChainParamsDto {
  base_fee_u: number;
  max_block_txs: number;
  voting_period_s: number;
  timelock_s: number;
  heartbeat_ms: number;
  unbonding_s: number;
  /** Task-42: block-reward engine switch — 0 = OFF (shipped default; dual-gate
   *  activation: owner ratification of the Network Economics DRAFT + governance vote). */
  rewards_enabled: number;
  /** Task-42: per-block reward in uMTQD from the devnet treasury (0 = nothing paid). */
  block_reward_u: number;
}

export interface TelemetryRowDto {
  height: number;
  round: number;
  /** Proposer ADDRESS (mtq1…) — canonical identity, same semantics as
   *  latest_block.proposer. The NOC maps it to a moniker for display
   *  (Task-40 F-40-2: the engine used to ship the moniker here). */
  proposer: string;
  proposed_at_ms: number | null;
  prevotes: number; // summed voting POWER of prevotes
  precommits: number; // summed voting POWER of precommits
  committed_at_ms: number | null;
  consensus_ms: number;
  txs: number;
}

export interface ChainHonestDto {
  status: string;
  scope: string;
  separation: string;
  economics: string;
  productionPath: string;
  transport: string;
  label: string;
}

export interface ChainSummaryDto {
  ready: boolean;
  chain_id: string;
  chain_id_configured: string;
  height: number;
  latest_block: {
    hash: string;
    time_ms: number;
    txs: number;
    proposer: string | null;
    consensus_ms: number;
    qc_committed_power: number;
    qc_total_power: number;
  } | null;
  validators: {
    active: number;
    total: number;
    total_power: number;
    list: ValidatorDto[];
  };
  params: ChainParamsDto;
  mempool_size: number;
  telemetry_recent: TelemetryRowDto[];
  genesis_hash: string;
  booted_at_ms: number;
  uptime_ms: number;
  last_error: string | null;
  tps_1m: number;
  honest: ChainHonestDto;
}

export interface BlockHeaderDto {
  chain_id: string;
  height: number;
  time_ms: number;
  prev_hash: string;
  txs_root: string;
  state_root: string;
  validators_hash: string;
  proposer: string;
  round: number;
}

export interface QuorumCertificateDto {
  height: number;
  round: number;
  block_hash: string;
  precommits: Array<{ voter: string; power: number; sig: string }>;
  total_voting_power: number;
  committed_power: number;
}

export interface BlockRowDto {
  height: number;
  hash: string;
  header: BlockHeaderDto;
  qc: QuorumCertificateDto;
  num_txs: number;
  time_ms: number;
  consensus_ms: number;
}

export interface BlocksPageDto {
  height: number;
  blocks: BlockRowDto[];
  page: number;
  total_pages: number;
  page_size: number;
}

export interface TxRawDto {
  type: string;
  from: string;
  nonce: number;
  fee: number;
  payload: Record<string, unknown>;
  sig: string;
  pub_key: string;
}

export interface TxRowDto {
  hash: string;
  height: number;
  idx: number;
  raw: TxRawDto;
  result: { ok: boolean; error?: string; effects?: string[] };
  time_ms: number;
}

export interface BlockDetailDto extends BlockRowDto {
  txs: TxRowDto[];
}

export interface StakeRowDto {
  id?: number;
  delegator: string;
  validator: string;
  validator_moniker: string;
  validator_status: string;
  amount_u: number;
  created_height: number;
}

export interface UnbondingRowDto {
  id: number;
  delegator: string;
  validator: string;
  validator_moniker: string;
  amount_u: number;
  created_height: number;
  release_ms: number;
  claimed_height: number | null;
  release_in_ms: number; // >0 pending · 0 mature (auto-claimed at next block)
}

/** Task-42-D: ballot cast by THIS account on a governance proposal. Sourced
 *  from a bounded scan of the 50 most recent proposals (rpc.getAccountInfo) —
 *  ballots on older proposals are not included. */
export interface AccountVoteDto {
  proposal_id: number;
  proposal_title: string;
  proposal_status: GovProposalDto["status"];
  /** YES | NO | ABSTAIN — stored verbatim from the signed vote. */
  option: string;
  power: number;
  height: number;
}

export interface AccountDto {
  address: string;
  exists: boolean;
  nonce: number;
  fee_u: number;
  pmtq_u: number;
  bonded_u: number;
  unbonding_u: number;
  unbondings: UnbondingRowDto[];
  stakes: StakeRowDto[];
  validator: ValidatorCoreDto | null;
  /** Task-42-D: this account's governance ballots (newest proposals first). */
  votes: AccountVoteDto[];
  recent_txs: TxRowDto[];
}

export interface MempoolDto {
  pending: Array<{
    hash: string;
    type: string;
    from: string;
    fee: number;
    nonce: number;
    received_ms: number;
  }>;
}

export interface GovVoteDto {
  proposal_id: number;
  voter: string;
  option: string;
  power: number;
  height: number;
}

export interface GovProposalDto {
  id: number;
  type: "text" | "network_param" | "validator_set_change";
  title: string;
  description: string;
  proposer: string;
  status:
    | "VOTING"
    | "PASSED"
    | "REJECTED"
    | "EXECUTION_QUEUED"
    | "EXECUTED"
    | "FAILED_EXECUTION";
  submitted_height: number;
  voting_end_ms: number;
  execute_after_ms: number;
  executed_height: number | null;
  payload: Record<string, unknown>;
  deposit: number;
  yes_power: number;
  no_power: number;
  abstain_power: number;
  votes: GovVoteDto[];
}

export interface GovEventDto {
  id: number;
  height: number;
  type: string;
  data: Record<string, unknown>;
  time_ms: number;
}

export interface GovViewDto {
  proposals: GovProposalDto[];
  params: ChainParamsDto;
  recent_events: GovEventDto[];
}

export interface SubmitOutcomeDto {
  ok: boolean;
  hash?: string;
  error?: string;
}

/* ============================================================
   Task-43 — oracle consensus module (§17.10 reference) DTOs
   Wire shapes of GET /api/chain/oracle. All monetary amounts are INTEGER
   micro-units (÷1e6 to display), exactly like every other chain amount.
   ============================================================ */

/** One family median contributing to a published oracle price. */
export interface OracleFamilyMedianDto {
  family: string;
  /** Family median in integer micro-units (÷1e6 to display). */
  median_u: number;
  observers: number;
}

/** A published multi-family price record (cross-family median-of-medians). */
export interface OraclePriceDto {
  symbol: string;
  /** Aggregation height the record was published at. */
  height: number;
  /** Cross-family median value in integer micro-units (÷1e6 to display). */
  value_u: number;
  families: number;
  observers: number;
  /** Cross-family spread in basis points. */
  spread_bp: number;
  status: "PUBLISHED" | "DEGRADED_SPREAD" | "STALE";
  family_medians: OracleFamilyMedianDto[];
  time_ms: number;
}

/** Raw observation provenance row (a genuinely signed validator tx). */
export interface OracleObservationDto {
  id: number;
  height: number;
  observer: string;
  observer_moniker: string;
  family: string;
  symbol: string;
  value_u: number;
  time_ms: number;
}

/** Full GET /api/chain/oracle payload. */
export interface OracleViewDto {
  height: number;
  prices: OraclePriceDto[];
  recent_observations: OracleObservationDto[];
  thresholds: {
    min_families: number;
    max_spread_bp: number;
    max_staleness_blocks: number;
  };
  /** VERBATIM honest disclosure from the oracle module — render word-for-word. */
  honest: string;
}

/* ============================================================
   Micro-unit formatters (all on-chain amounts are integers, ÷1e6)
   ============================================================ */

/** 10_000_000_000 u → "10,000.00" (display units, grouped, fixed digits). */
export function fmtMicro(u: number | null | undefined, digits = 2): string {
  if (u == null || !Number.isFinite(u)) return "—";
  return (u / 1e6).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Voting power units — integers with grouping. */
export function fmtPower(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  return Math.round(p).toLocaleString("en-US");
}

/** Uptime as mm:ss (h:mm:ss past the hour mark). Ticking is the caller's job. */
export function fmtUptime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Countdown-ish duration ("42s" / "5m 12s" / "2h 03m"). Negative → "0s". */
export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

/** Parse a user-typed decimal amount into integer micro-units (or null). */
export function parseMicroAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) return null;
  const micro = Math.round(parseFloat(trimmed) * 1_000_000);
  if (!Number.isInteger(micro) || micro <= 0 || micro > Number.MAX_SAFE_INTEGER) return null;
  return micro;
}

/** mtq1… address shape: mtq1 + 40 hex (44 chars total). */
export function isMtqAddress(a: string): boolean {
  return /^mtq1[0-9a-f]{40}$/.test(a.trim());
}

/* ============================================================
   useChainPoll — canonical polling pattern
   ============================================================ */

export interface ChainPollState<T> {
  data: T | null;
  error: string | null;
  /** True while serving last-good data after a failed poll. */
  stale: boolean;
  /** True until the first fetch for the current URL resolves. */
  loading: boolean;
  lastReadAt: number | null;
  /** Force an immediate re-fetch (manual refresh / after a submission). */
  refresh: () => void;
}

/* ============================================================
   useChainBlockStream — Task-42 SSE live block-event hook
   ============================================================ */

/** Block-committed event payload from GET /api/chain/stream (SSE). */
export interface ChainBlockEventDto {
  height: number;
  hash: string;
  txs: number;
  proposer: string | null;
  qc_committed_power: number;
  qc_total_power: number;
  consensus_ms: number;
  time_ms: number;
}

export interface ChainBlockStreamState {
  /** True while the SSE connection is open (live push active). */
  connected: boolean;
  /** The most recent block event received (null before the first push). */
  lastEvent: ChainBlockEventDto | null;
  /** Millisecond timestamp of the last received event (for liveness clocks). */
  lastEventAt: number | null;
}

/**
 * Live block-event subscription over SSE (Task-42). EventSource handles
 * auto-reconnect; onBlock is invoked through a ref so callers never cause
 * re-subscription (callback identity is free to change). Failed streams just
 * leave `connected=false` — the consumer's canonical HTTP polling remains the
 * correctness path (SSE is instant-refresh sugar, never a dependency).
 * Events are ALSO delivered while document.hidden (cheap, ≤1/heartbeat) so a
 * tab returning to focus is already current.
 */
export function useChainBlockStream(onBlock?: (ev: ChainBlockEventDto) => void): ChainBlockStreamState {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<ChainBlockEventDto | null>(null);
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const onBlockRef = useRef(onBlock);
  useEffect(() => {
    onBlockRef.current = onBlock;
  }, [onBlock]);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/chain/stream");
    } catch {
      return; // no EventSource support → stay on polling (honest fallback)
    }
    const source = es;
    const onOpen = () => setConnected(true);
    const onErr = () => setConnected(false); // EventSource retries on its own
    const onBlockEv = (e: MessageEvent<string>) => {
      try {
        const ev = JSON.parse(e.data) as ChainBlockEventDto;
        setLastEvent(ev);
        setLastEventAt(Date.now());
        onBlockRef.current?.(ev);
      } catch {
        // malformed frame — ignore; polling remains the truth path
      }
    };
    source.addEventListener("open", onOpen);
    source.addEventListener("error", onErr);
    source.addEventListener("block", onBlockEv as EventListener);
    return () => {
      source.removeEventListener("open", onOpen);
      source.removeEventListener("error", onErr);
      source.removeEventListener("block", onBlockEv as EventListener);
      source.close();
      setConnected(false);
    };
  }, []);

  return { connected, lastEvent, lastEventAt };
}


/**
 * Canonical app polling hook (pattern: ConstituencySection / ReferenceSection):
 * fetch on mount, setInterval `intervalMs` with a document.hidden skip,
 * immediate refresh on visibilitychange→visible, mountedRef guard, and
 * last-good retention on failed polls (data kept, flagged stale).
 * `url === null` pauses the poll entirely (e.g. no wallet address yet).
 */
export function useChainPoll<T>(url: string | null, intervalMs: number): ChainPollState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(url != null);
  const [lastReadAt, setLastReadAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0); // manual refresh trigger
  const mountedRef = useRef(true);
  const fetchedUrlRef = useRef<string | null>(null);

  const fetchNow = useCallback(async () => {
    if (url == null) return;
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      if (!mountedRef.current) return;
      setData(json);
      setError(null);
      setStale(false);
      setLastReadAt(Date.now());
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : String(e));
      setStale(true); // keep last-good data — never blank a live board
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [url]);

  // Reset per-URL state when the target changes (wallet set/cleared etc.).
  useEffect(() => {
    if (fetchedUrlRef.current === url) return;
    fetchedUrlRef.current = url;
    mountedRef.current = true;
    setData(null);
    setError(null);
    setStale(false);
    setLoading(url != null);
    setLastReadAt(null);
  }, [url]);

  useEffect(() => {
    if (url == null) return;
    mountedRef.current = true;
    void fetchNow();
    const id = setInterval(() => void fetchNow(), intervalMs);
    const onVisible = () => {
      if (!document.hidden) void fetchNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchNow, intervalMs, url, tick]);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  return { data, error, stale, loading, lastReadAt, refresh };
}

/* ============================================================
   useOracleView — Task-43 oracle consensus poll (6s)
   ============================================================ */

/**
 * On-chain oracle consensus view from GET /api/chain/oracle, on the app's
 * canonical poll pattern (hidden-tab skip · visibility refresh · last-good
 * retention flagged stale). 6s cadence — oracle records move with signed
 * validator observations, not with every block, so this poll deliberately
 * runs slower than the 3s summary poll. Empty prices (the reference devnet
 * has no automatic market feeds) is a NORMAL state, not an error.
 */
export function useOracleView(): ChainPollState<OracleViewDto> {
  return useChainPoll<OracleViewDto>("/api/chain/oracle", 6000);
}

/* ============================================================
   Client-side signing (private key never leaves the browser)
   ============================================================ */

/** Generate a fresh wallet record from CSPRNG bytes (browser crypto). */
export function generateWalletRecord(): WalletRecord {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  const pub = ed25519.getPublicKey(seed);
  return {
    seed: toHex(seed),
    pub: toHex(pub),
    address: addressFromPublicKey(pub),
    created_at: Date.now(),
  };
}

/** Import a wallet from a pasted 64-hex seed (invalid → null). */
export function importWalletRecord(seedHex: string): WalletRecord | null {
  const clean = seedHex.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) return null;
  const seed = fromHex(clean);
  const pub = ed25519.getPublicKey(seed);
  return {
    seed: clean,
    pub: toHex(pub),
    address: addressFromPublicKey(pub),
    created_at: Date.now(),
  };
}

export interface UseChainSubmitterOpts {
  /** On-chain nonce of the signing account (from /api/chain/account), or null. */
  accountNonce: number | null;
  /** Tx fee in micro-units (live base fee from /api/chain params). */
  fee: number;
}

/**
 * Signs transactions in the BROWSER (ed25519 over canonicalTxBytes — the
 * node's exact encoding) and POSTs the finished Tx to /api/chain/submit.
 * Local nonce tracking: nextNonce = max(account.nonce + 1, lastUsed + 1), so
 * submissions made before the 3s account poll catches up never collide.
 */
export function useChainSubmitter({ accountNonce, fee }: UseChainSubmitterOpts): {
  submit: (type: TxType, payload: Record<string, unknown>) => Promise<SubmitOutcomeDto>;
  submitting: boolean;
  nextNonce: number | null;
} {
  const wallet = useWalletStore((s) => s.wallet);
  const [submitting, setSubmitting] = useState(false);
  const lastUsedNonceRef = useRef(0);

  const nextNonce =
    accountNonce == null
      ? null
      : Math.max(accountNonce + 1, lastUsedNonceRef.current + 1);

  const submit = useCallback(
    async (type: TxType, payload: Record<string, unknown>): Promise<SubmitOutcomeDto> => {
      if (!wallet) return { ok: false, error: "no wallet (create or import one first)" };
      if (nextNonce == null) return { ok: false, error: "account state not loaded yet" };
      if (!Number.isInteger(fee) || fee <= 0) return { ok: false, error: "base fee not loaded yet" };
      setSubmitting(true);
      try {
        const unsigned = {
          type,
          from: wallet.address,
          nonce: nextNonce,
          fee,
          payload,
        };
        const seed = fromHex(wallet.seed);
        const sig = toHex(ed25519.sign(canonicalTxBytes(unsigned), seed));
        const res = await fetch("/api/chain/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...unsigned, sig, pub_key: wallet.pub }),
        });
        const json = (await res.json().catch(() => null)) as SubmitOutcomeDto | null;
        if (!json) return { ok: false, error: `submit failed (HTTP ${res.status})` };
        if (json.ok) lastUsedNonceRef.current = nextNonce;
        return json;
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      } finally {
        setSubmitting(false);
      }
    },
    [wallet, nextNonce, fee],
  );

  return { submit, submitting, nextNonce };
}

/* ============================================================
   Shared presentational atoms
   ============================================================ */

/** Truncated mono value + inline copy affordance (toast feedback). */
export function CopyMono({
  value,
  label = "value",
  head = 10,
  tail = 6,
  className = "",
}: {
  value: string;
  label?: string;
  head?: number;
  tail?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[0.68rem] ${className}`}>
      <span className="truncate" title={value}>
        {shortAddr(value, head, tail)}
      </span>
      <button
        type="button"
        onClick={async (e) => {
          e.stopPropagation();
          const ok = await copyToClipboard(value);
          if (ok) toast.success(`Copied ${label}`, { description: shortAddr(value) });
          else toast.error("Copy failed");
        }}
        className="shrink-0 rounded border border-transparent px-1 py-0.5 text-[0.6rem] text-mtqs-gold transition hover:border-mtqs-amber/30 hover:text-mtqs-gold"
        aria-label={`Copy ${label}: ${value}`}
      >
        copy
      </button>
    </span>
  );
}

/** Validator status → brand pill (ACTIVE emerald · CANDIDATE amber · JAILED rose · RETIRED muted). */
export function ValidatorStatusPill({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <Pill tone="emerald">
        <GlowDot color="emerald" size="h-1.5 w-1.5" />
        ACTIVE
      </Pill>
    );
  }
  if (status === "CANDIDATE") {
    return (
      <Pill tone="amber">
        <GlowDot color="amber" size="h-1.5 w-1.5" />
        CANDIDATE
      </Pill>
    );
  }
  if (status === "JAILED") {
    return (
      <Pill tone="rose">
        <GlowDot color="rose" size="h-1.5 w-1.5" />
        JAILED
      </Pill>
    );
  }
  return <Pill tone="muted">{status === "RETIRED" ? "RETIRED" : status || "—"}</Pill>;
}

/** Tx type chip — mono type text, tone by module family. */
export function TxTypePill({ type }: { type: string }) {
  const tone: "default" | "gold" | "emerald" | "amber" =
    type === "send"
      ? "default"
      : type === "delegate" || type === "undelegate" || type === "validator_register"
        ? "gold"
        : type === "gov_vote" || type === "gov_submit"
          ? "amber"
          : "emerald";
  return (
    <Pill tone={tone}>
      <span className="font-mono">{type}</span>
    </Pill>
  );
}

/** Execution receipt badge: emerald SUCCESS / rose FAILED (error in title tooltip). */
export function TxResultBadge({ ok, error }: { ok: boolean; error?: string }) {
  if (ok) {
    return (
      <Pill tone="emerald">
        <GlowDot color="emerald" size="h-1.5 w-1.5" />
        SUCCESS
      </Pill>
    );
  }
  return (
    <Pill tone="rose" className="cursor-help">
      <GlowDot color="rose" size="h-1.5 w-1.5" />
      FAILED
      {error ? <span className="sr-only"> — {error}</span> : null}
      {error ? (
        <span className="font-normal opacity-80" title={error} aria-hidden="true">
          ⚯
        </span>
      ) : null}
    </Pill>
  );
}

/** QC power chip: "committed/total" (+2/3 quorum tint). */
export function QuorumChip({ committed, total }: { committed: number; total: number }) {
  const quorum = total > 0 && committed * 3 > total * 2;
  return (
    <Pill tone={quorum ? "emerald" : "amber"} className="font-mono">
      {fmtPower(committed)}/{fmtPower(total)}
    </Pill>
  );
}

/** Live/stale indicator with last-read clock (ReferenceSection pattern). */
export function LiveClockPill({
  stale,
  lastReadAt,
  loading,
}: {
  stale: boolean;
  lastReadAt: number | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Pill tone="muted">
        <GlowDot color="gold" size="h-1.5 w-1.5" />
        connecting…
      </Pill>
    );
  }
  const clock =
    lastReadAt == null
      ? "—"
      : new Date(lastReadAt).toLocaleTimeString("en-GB", { hour12: false });
  return (
    <Pill tone={stale ? "amber" : "emerald"}>
      <GlowDot color={stale ? "amber" : "emerald"} size="h-1.5 w-1.5" />
      {stale ? "stale" : "live"} · read {clock}
    </Pill>
  );
}

/** Last-good retention strip (serving previous snapshot after a failed poll). */
export function StaleStrip({ error, source }: { error: string; source: string }) {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
      <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
      <span className="text-[0.66rem] leading-snug text-rose-600">
        Last {source} refresh failed ({error}) — serving the previously fetched snapshot. Values may
        be stale.
      </span>
    </div>
  );
}

/** Small labeled value cell used in detail dialogs. */
export function FieldCell({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-2.5 min-w-0">
      <div className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">{label}</div>
      <div className={`mt-0.5 text-[0.72rem] break-all text-[#0E1F1B] ${mono ? "font-mono" : ""}`}>
        {children}
      </div>
    </div>
  );
}

/** One-line mono key=value chip for proposal payloads. */
export function PayloadChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-md border border-[#E3EAE6] bg-[#FAFCFA] px-2 py-1 font-mono text-[0.64rem] text-[#33544C]">
      <span className="truncate">{children}</span>
    </span>
  );
}
