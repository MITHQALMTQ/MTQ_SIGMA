// MTQΣ — Staking & On-Chain Governance for the Sovereign Devnet.
//
// Live sources (canonical 3s poll): /api/chain/validators (set + power),
// /api/chain/gov (proposals + votes + params) and /api/chain/account?a=…
// (bonded positions; wallet-dependent). Delegate / undelegate / gov_vote /
// gov_submit transactions are SIGNED IN THE BROWSER (see chain-kit) and
// POSTed to /api/chain/submit — the node re-verifies everything.
//
// HONESTY (verbatim note at the bottom): staking records bonding + voting
// power only — no rewards/inflation/slashing events exist in the reference
// devnet; economics await the approved Network Economics Specification.
//
// TASK 40-c — section contract: StakingSection({ onNavigate }) — used by the
// no-wallet gate inside the action forms.

"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  ChevronDown,
  FileText,
  Layers,
  Lock,
  Scale,
  ShieldAlert,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Panel, Pill, Reveal, SectionHeading, Skeleton, MiniBar } from "@/components/mtq/primitives";
import {
  LiveClockPill,
  PayloadChip,
  StaleStrip,
  ValidatorStatusPill,
  fmtDuration,
  fmtMicro,
  fmtPower,
  parseMicroAmount,
  useChainPoll,
  useChainSubmitter,
  type AccountDto,
  type GovProposalDto,
  type GovViewDto,
  type StakeRowDto,
  type SubmitOutcomeDto,
  type UnbondingRowDto,
  type ValidatorDto,
} from "@/components/mtq/chain/chain-kit";
import { NETWORK_PARAM_ALLOWLIST } from "@/lib/chain/shared";
import { useWalletStore } from "@/lib/chain/wallet-store";
import type { SectionId } from "@/components/mtq/Navigation";
import { shortAddr } from "@/components/mtq/format";

const POLL_MS = 3000;
const GOV_DEPOSIT_U = 100_000; // fixed minimum governance deposit (state.ts)

/* ---------- proposal status → badge classes (brand palette; EXECUTION_QUEUED
             is the task-specified blue-gray exception) ---------- */
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

export function StakingSection({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const wallet = useWalletStore((s) => s.wallet);
  const hydrated = useWalletStore((s) => s.hydrated);
  const hydrate = useWalletStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const validators = useChainPoll<{ validators: ValidatorDto[] }>("/api/chain/validators", POLL_MS);
  const gov = useChainPoll<GovViewDto>("/api/chain/gov", POLL_MS);
  const account = useChainPoll<AccountDto>(
    wallet ? `/api/chain/account?a=${wallet.address}` : null,
    POLL_MS,
  );

  const acct = account.data;
  const valList = validators.data?.validators ?? [];
  const totalPower = useMemo(
    () => valList.filter((v) => v.status === "ACTIVE").reduce((s, v) => s + v.power, 0),
    [valList],
  );

  // The account's live voting power (mirrors state.applyGovVote exactly):
  // floor(bonded / 100,000 µ) + ACTIVE-validator self power.
  const myPower = useMemo(() => {
    if (!acct) return 0;
    const bonded = acct.bonded_u;
    const base = Math.floor(bonded / 100_000);
    const val = acct.validator && acct.validator.status === "ACTIVE" ? acct.validator.power : 0;
    return base + val;
  }, [acct]);

  const { submit, submitting, nextNonce } = useChainSubmitter({
    accountNonce: acct ? acct.nonce : null,
    fee: gov.data?.params.base_fee_u ?? 1000,
  });

  /* 1s ticker so voting countdowns advance between polls. */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ─── delegate / undelegate forms ─── */
  const bondable = useMemo(
    () => valList.filter((v) => v.status === "ACTIVE" || v.status === "CANDIDATE"),
    [valList],
  );
  const stakedValidators = useMemo(() => {
    const stakedAddrs = new Set((acct?.stakes ?? []).map((s) => s.validator));
    return valList.filter((v) => stakedAddrs.has(v.address));
  }, [valList, acct]);

  const [delVal, setDelVal] = useState<string>("");
  const [delAmount, setDelAmount] = useState("");
  const [delResult, setDelResult] = useState<SubmitOutcomeDto | null>(null);
  const [undelVal, setUndelVal] = useState<string>("");
  const [undelAmount, setUndelAmount] = useState("");
  const [undelResult, setUndelResult] = useState<SubmitOutcomeDto | null>(null);

  const delAmountU = parseMicroAmount(delAmount);
  const undelAmountU = parseMicroAmount(undelAmount);
  const bondedToDelVal = acct?.stakes.find((s) => s.validator === delVal)?.amount_u ?? 0;
  const bondedToUndelVal = acct?.stakes.find((s) => s.validator === undelVal)?.amount_u ?? 0;

  async function handleDelegate() {
    if (!delVal || delAmountU == null) return;
    setDelResult(null);
    const out = await submit("delegate", { validator: delVal, amount: delAmountU });
    setDelResult(out);
    if (out.ok) {
      toast.success("Delegate tx submitted", { description: shortAddr(out.hash ?? "", 10, 6) });
      setDelAmount("");
      account.refresh();
      validators.refresh();
    } else {
      toast.error("Delegate rejected", { description: out.error ?? "unknown error" });
    }
  }

  async function handleUndelegate() {
    if (!undelVal || undelAmountU == null) return;
    setUndelResult(null);
    const out = await submit("undelegate", { validator: undelVal, amount: undelAmountU });
    setUndelResult(out);
    if (out.ok) {
      toast.success("Undelegate tx submitted", { description: shortAddr(out.hash ?? "", 10, 6) });
      setUndelAmount("");
      account.refresh();
      validators.refresh();
    } else {
      toast.error("Undelegate rejected", { description: out.error ?? "unknown error" });
    }
  }

  /* ─── voting ─── */
  const [voteBusyId, setVoteBusyId] = useState<number | null>(null);
  const monikerByAddr = useMonikerMap(valList);

  async function handleVote(p: GovProposalDto, option: "YES" | "NO" | "ABSTAIN") {
    setVoteBusyId(p.id);
    const out = await submit("gov_vote", { proposal_id: p.id, option });
    setVoteBusyId(null);
    if (out.ok) {
      toast.success(`Vote ${option} submitted`, {
        description: `proposal #${p.id} · ${shortAddr(out.hash ?? "", 10, 6)}`,
      });
      gov.refresh();
      account.refresh();
    } else {
      toast.error("Vote rejected", { description: out.error ?? "unknown error" });
    }
  }

  return (
    <div className="space-y-10">
      {/* ─── Header ─── */}
      <SectionHeading
        eyebrow="staking · bond + network governance"
        title="Staking & On-Chain Governance"
        className="mb-0"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <LiveClockPill
              stale={validators.stale}
              lastReadAt={validators.lastReadAt}
              loading={validators.loading}
            />
            {wallet ? (
              <Pill tone="gold" className="font-mono">
                your power {fmtPower(myPower)}
              </Pill>
            ) : null}
          </div>
        }
      />

      {/* ─── Honest economics note (verbatim, always visible) ─── */}
      <Reveal>
        <div className="rounded-xl border border-mtqs-amber/40 bg-amber-50 px-4 py-3">
          <p className="flex items-start gap-2 text-[0.72rem] leading-relaxed text-amber-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-mtqs-amber" aria-hidden="true" />
            Staking records bonding + voting power only — no rewards/inflation/slashing events in
            the reference devnet (economics await the approved Network Economics Specification).
          </p>
        </div>
      </Reveal>

      {/* ─── Validators table ─── */}
      <Reveal>
        <section aria-labelledby="staking-validators-h">
          <SectionHeading
            eyebrow="validator set"
            title={<span id="staking-validators-h">Validators</span>}
            className="mb-4"
            right={
              <Pill tone="muted" className="font-mono">
                total power {fmtPower(totalPower)}
              </Pill>
            }
          />
          <Panel className="p-4 sm:p-5">
            {validators.stale && validators.error && validators.data ? (
              <StaleStrip error={validators.error} source="/api/chain/validators" />
            ) : null}

            {!validators.data && validators.loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-md" />
                ))}
              </div>
            ) : !validators.data && validators.error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-[0.72rem] text-rose-600">
                Validator set unavailable ({validators.error}).
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow className="border-[#E3EAE6] hover:bg-transparent">
                      <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Moniker</TableHead>
                      <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Status</TableHead>
                      <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Voting power</TableHead>
                      <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Self-stake</TableHead>
                      <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Delegated</TableHead>
                      <TableHead className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valList.map((v) => {
                      const share = totalPower > 0 ? v.power / totalPower : 0;
                      return (
                        <TableRow key={v.address} className="border-[#EDF2EF] hover:bg-[#F0F5F2]">
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2">
                              {v.is_proposer_next ? (
                                <Pill tone="gold">
                                  <Star className="h-3 w-3" aria-hidden="true" />
                                  proposes next
                                </Pill>
                              ) : null}
                              <span className="text-[0.78rem] font-semibold text-[#0E1F1B]">
                                {v.moniker}
                              </span>
                            </div>
                            <span
                              className="mt-0.5 block font-mono text-[0.6rem] text-[#7A8C86]"
                              title={v.address}
                            >
                              {shortAddr(v.address, 12, 6)}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5">
                            <ValidatorStatusPill status={v.status} />
                          </TableCell>
                          <TableCell className="py-2.5">
                            <div className="w-32">
                              <span className="font-mono tabular-nums text-[0.74rem] text-[#0E1F1B]">
                                {fmtPower(v.power)}{" "}
                                <span className="text-[0.62rem] text-[#5B6E68]">
                                  ({(share * 100).toFixed(1)}%)
                                </span>
                              </span>
                              <MiniBar
                                value={v.power}
                                max={totalPower}
                                colorClass="bg-mtqs-emerald"
                                trackClass="bg-[#EDF2EF]"
                                height="h-1"
                                className="mt-1"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="py-2.5 font-mono tabular-nums text-[0.72rem] text-[#33544C]">
                            {fmtMicro(v.self_stake)}
                          </TableCell>
                          <TableCell className="py-2.5 font-mono tabular-nums text-[0.72rem] text-[#33544C]">
                            {fmtMicro(v.delegated)}
                          </TableCell>
                          <TableCell className="py-2.5 font-mono tabular-nums text-[0.72rem] text-[#33544C]">
                            {(v.commission_bp / 100).toFixed(2)}%
                            <span className="ml-1 text-[0.6rem] text-[#7A8C86]">
                              ({v.commission_bp} bp)
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="mt-3 text-[0.62rem] text-[#7A8C86]">
              Power recomputes every block from bonded amounts (0.1 MTQD = 1 power). Commission is
              informational — no reward stream exists (see note above).
            </p>
          </Panel>
        </section>
      </Reveal>

      {/* ─── Delegate / Undelegate + bonded positions ─── */}
      <Reveal>
        <section aria-labelledby="staking-bond-h">
          <SectionHeading
            eyebrow="bonding"
            title={<span id="staking-bond-h">Delegate & Bond</span>}
            className="mb-4"
            right={
              acct ? (
                <Pill tone="muted" className="font-mono">
                  bonded {fmtMicro(acct.bonded_u)} MTQD
                </Pill>
              ) : undefined
            }
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Delegate form */}
            <Panel className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">Delegate</h3>
              </div>
              <WalletGate
                hasWallet={!!wallet}
                hydrated={hydrated}
                onNavigate={onNavigate}
              >
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="delegate-validator"
                      className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                    >
                      Validator (ACTIVE / CANDIDATE)
                    </label>
                    <Select value={delVal} onValueChange={setDelVal}>
                      <SelectTrigger id="delegate-validator" className="h-11 border-[#E3EAE6] bg-white">
                        <SelectValue placeholder="choose a validator" />
                      </SelectTrigger>
                      <SelectContent className="border-[#E3EAE6] bg-white">
                        {bondable.map((v) => (
                          <SelectItem key={v.address} value={v.address}>
                            {v.moniker} · {v.status} · power {fmtPower(v.power)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label
                      htmlFor="delegate-amount"
                      className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                    >
                      Amount (MTQD)
                    </label>
                    <Input
                      id="delegate-amount"
                      value={delAmount}
                      onChange={(e) => setDelAmount(e.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="h-11 border-[#E3EAE6] bg-white font-mono text-[0.8rem] text-[#0E1F1B]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.64rem] text-[#5B6E68]">
                    <span>
                      currently bonded to validator{" "}
                      <span className="font-mono tabular-nums text-[#33544C]">
                        {delVal ? fmtMicro(bondedToDelVal) : "—"}
                      </span>
                    </span>
                    <span>
                      fee{" "}
                      <span className="font-mono tabular-nums text-[#33544C]">
                        {gov.data ? `${gov.data.params.base_fee_u.toLocaleString("en-US")} µMTQD` : "…"}
                      </span>
                    </span>
                    <span>
                      nonce{" "}
                      <span className="font-mono tabular-nums text-[#33544C]">{nextNonce ?? "—"}</span>
                    </span>
                  </div>
                  <Button
                    onClick={handleDelegate}
                    disabled={!delVal || delAmountU == null || submitting}
                    className="h-11 w-full bg-mtqs-gold font-medium text-white hover:bg-mtqs-gold/90 sm:w-auto sm:px-6"
                  >
                    {submitting ? "Signing + submitting…" : "Sign & delegate"}
                  </Button>
                  <OutcomeLine outcome={delResult} />
                </div>
              </WalletGate>
            </Panel>

            {/* Undelegate form */}
            <Panel className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <Lock className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0E1F1B]">Undelegate</h3>
              </div>
              <WalletGate hasWallet={!!wallet} hydrated={hydrated} onNavigate={onNavigate}>
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="undelegate-validator"
                      className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                    >
                      Validator (your positions)
                    </label>
                    <Select value={undelVal} onValueChange={setUndelVal}>
                      <SelectTrigger id="undelegate-validator" className="h-11 border-[#E3EAE6] bg-white">
                        <SelectValue placeholder="choose a bonded validator" />
                      </SelectTrigger>
                      <SelectContent className="border-[#E3EAE6] bg-white">
                        {(stakedValidators.length > 0 ? stakedValidators : bondable).map((v) => (
                          <SelectItem key={v.address} value={v.address}>
                            {v.moniker} · {v.status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label
                      htmlFor="undelegate-amount"
                      className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                    >
                      Amount (MTQD)
                    </label>
                    <Input
                      id="undelegate-amount"
                      value={undelAmount}
                      onChange={(e) => setUndelAmount(e.target.value)}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="h-11 border-[#E3EAE6] bg-white font-mono text-[0.8rem] text-[#0E1F1B]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.64rem] text-[#5B6E68]">
                    <span>
                      bonded to validator{" "}
                      <span className="font-mono tabular-nums text-[#33544C]">
                        {undelVal ? fmtMicro(bondedToUndelVal) : "—"}
                      </span>
                    </span>
                    <span className="text-[#7A8C86]">
                      {gov.data
                        ? gov.data.params.unbonding_s > 0
                          ? `power drops now · funds queue ${gov.data.params.unbonding_s}s (unbonding_s param) then auto-release`
                          : "unbonding_s = 0 — funds release immediately (governance-set)"
                        : "power drops now · funds queue per unbonding_s param"}
                    </span>
                  </div>
                  <Button
                    onClick={handleUndelegate}
                    disabled={!undelVal || undelAmountU == null || submitting}
                    variant="outline"
                    className="h-11 w-full border-mtqs-gold/40 font-medium text-mtqs-gold hover:bg-mtqs-gold/10 sm:w-auto sm:px-6"
                  >
                    {submitting ? "Signing + submitting…" : "Sign & undelegate"}
                  </Button>
                  <OutcomeLine outcome={undelResult} />
                </div>
              </WalletGate>
            </Panel>
          </div>

          {/* Bonded positions */}
          {wallet ? (
            <Panel className="mt-6 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#0E1F1B]">
                  Bonded positions {acct ? `(${acct.stakes.length})` : ""}
                </h3>
                {acct && acct.unbonding_u > 0 ? (
                  <Pill tone="amber" className="font-mono">
                    unbonding {fmtMicro(acct.unbonding_u)} MTQD
                  </Pill>
                ) : null}
              </div>
              {!acct && account.loading ? (
                <Skeleton className="h-16 rounded-lg" />
              ) : acct && acct.stakes.length === 0 ? (
                <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-4 text-center text-[0.72rem] text-[#5B6E68]">
                  No bonded positions yet — delegate above to gain voting power.
                </p>
              ) : acct ? (
                <div className="max-h-72 overflow-y-auto rounded-lg border border-[#E3EAE6] bg-white mtqs-scroll">
                  <ul className="divide-y divide-[#EDF2EF]">
                    {acct.stakes.map((s, i) => (
                      <StakeRow key={s.id ?? `${s.validator}-${i}`} s={s} />
                    ))}
                  </ul>
                </div>
              ) : null}
            </Panel>
          ) : null}

          {/* Unbonding queue — time-locked returning funds */}
          {wallet && acct && acct.unbondings.length > 0 ? (
            <Panel className="mt-6 p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#0E1F1B]">
                  Unbonding queue ({acct.unbondings.length})
                </h3>
                <Pill tone="muted" className="font-mono">
                  auto-release at maturity · no claim tx needed
                </Pill>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-lg border border-[#E3EAE6] bg-white mtqs-scroll">
                <ul className="divide-y divide-[#EDF2EF]">
                  {acct.unbondings.map((u) => (
                    <UnbondingRow key={u.id} u={u} now={now} />
                  ))}
                </ul>
              </div>
              <p className="mt-3 text-[0.62rem] text-[#7A8C86]">
                Undelegated bond sits in a time-locked queue (unbonding_s network param — current{" "}
                <span className="font-mono">{gov.data ? `${gov.data.params.unbonding_s}s` : "…"}</span>). Voting power already dropped at
                undelegate; funds return to your balance automatically at the next block after maturity.
              </p>
            </Panel>
          ) : null}
        </section>
      </Reveal>

      {/* ─── Governance proposals ─── */}
      <Reveal>
        <section aria-labelledby="staking-gov-h">
          <SectionHeading
            eyebrow="network governance"
            title={<span id="staking-gov-h">Proposals</span>}
            className="mb-4"
            right={
              <Pill tone="muted" className="font-mono">
                quorum: turnout &gt; ⅓ · majority of turnout
              </Pill>
            }
          />
          <Panel className="p-4 sm:p-5">
            {gov.stale && gov.error && gov.data ? (
              <StaleStrip error={gov.error} source="/api/chain/gov" />
            ) : null}

            {!gov.data && gov.loading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-40 rounded-xl" />
                ))}
              </div>
            ) : !gov.data && gov.error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-3 text-[0.72rem] text-rose-600">
                Governance view unavailable ({gov.error}).
              </p>
            ) : gov.data && gov.data.proposals.length === 0 ? (
              <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-6 text-center text-[0.72rem] text-[#5B6E68]">
                No proposals submitted yet — the governance ledger is empty (submit one below).
              </p>
            ) : (
              <div className="space-y-4">
                {gov.data?.proposals.map((p) => (
                  <ProposalCard
                    key={p.id}
                    p={p}
                    now={now}
                    totalPower={totalPower}
                    hasWallet={!!wallet}
                    hydrated={hydrated}
                    myPower={myPower}
                    busy={voteBusyId === p.id}
                    monikerByAddr={monikerByAddr}
                    onNavigate={onNavigate}
                    onVote={(option) => void handleVote(p, option)}
                  />
                ))}
              </div>
            )}
          </Panel>
        </section>
      </Reveal>

      {/* ─── Submit proposal form ─── */}
      <Reveal>
        <section aria-labelledby="staking-submit-h">
          <SectionHeading
            eyebrow="submit a proposal"
            title={<span id="staking-submit-h">New Proposal</span>}
            className="mb-4"
          />
          <Panel className="p-5">
            <SubmitProposalForm
              hasWallet={!!wallet}
              hydrated={hydrated}
              validators={valList}
              onNavigate={onNavigate}
              submit={submit}
              submitting={submitting}
              onSubmitted={() => {
                gov.refresh();
                account.refresh();
              }}
            />
          </Panel>
        </section>
      </Reveal>

      {/* ─── Recent governance events ─── */}
      {gov.data && gov.data.recent_events.length > 0 ? (
        <Reveal>
          <Panel className="p-5">
            <h3 className="mb-3 text-sm font-semibold text-[#0E1F1B]">
              Governance events ({gov.data.recent_events.length})
            </h3>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-[#E3EAE6] bg-white mtqs-scroll">
              <ul className="divide-y divide-[#EDF2EF]">
                {gov.data.recent_events.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-2 text-[0.68rem]"
                  >
                    <Pill tone="muted">
                      <span className="font-mono">{ev.type}</span>
                    </Pill>
                    <span className="font-mono tabular-nums text-[#5B6E68]">
                      #{ev.height.toLocaleString("en-US")}
                    </span>
                    <span className="font-mono text-[0.62rem] break-all text-[#33544C]">
                      {JSON.stringify(ev.data)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </Reveal>
      ) : null}
    </div>
  );
}

/* ============================================================
   Small local components
   ============================================================ */

function useMonikerMap(validators: ValidatorDto[]): Map<string, string> {
  return useMemo(() => {
    const m = new Map<string, string>();
    for (const v of validators) m.set(v.address, v.moniker);
    return m;
  }, [validators]);
}

/** Inline no-wallet gate shared by the staking action forms. */
function WalletGate({
  hasWallet,
  hydrated,
  onNavigate,
  children,
}: {
  hasWallet: boolean;
  hydrated: boolean;
  onNavigate: (id: SectionId) => void;
  children: React.ReactNode;
}) {
  if (hasWallet || !hydrated) return <>{children}</>;
  return (
    <div className="rounded-lg border border-mtqs-amber/40 bg-amber-50 px-4 py-5 text-center">
      <p className="text-[0.74rem] font-medium text-amber-800">
        Create/import a wallet in the Wallet section first
      </p>
      <p className="mt-1 text-[0.66rem] text-[#5B6E68]">
        Actions here sign transactions with your browser-local key.
      </p>
      <Button
        onClick={() => onNavigate("wallet")}
        className="mt-3 h-10 bg-mtqs-gold px-5 font-medium text-white hover:bg-mtqs-gold/90"
      >
        Go to Wallet
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}

function OutcomeLine({ outcome }: { outcome: SubmitOutcomeDto | null }) {
  if (!outcome) return null;
  return (
    <p
      className={`text-[0.66rem] leading-relaxed ${
        outcome.ok ? "text-mtqs-emerald" : "text-rose-600"
      }`}
    >
      {outcome.ok
        ? `Submitted — tx ${shortAddr(outcome.hash ?? "", 12, 8)} (inclusion with the next block).`
        : `Rejected: ${outcome.error}`}
    </p>
  );
}

function StakeRow({ s }: { s: StakeRowDto }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[0.7rem]">
      <span className="font-semibold text-[#0E1F1B]">{s.validator_moniker}</span>
      <ValidatorStatusPill status={s.validator_status} />
      <span className="font-mono tabular-nums text-[#33544C]">{fmtMicro(s.amount_u)} MTQD</span>
      <span className="ml-auto text-[0.62rem] text-[#7A8C86]">
        bonded at #{s.created_height.toLocaleString("en-US")} ·{" "}
        <span className="font-mono" title={s.validator}>
          {shortAddr(s.validator, 10, 6)}
        </span>
      </span>
    </li>
  );
}

function UnbondingRow({ u, now }: { u: UnbondingRowDto; now: number }) {
  const left = u.release_ms - now;
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[0.7rem]">
      <span className="font-semibold text-[#0E1F1B]">{u.validator_moniker}</span>
      <Pill tone={left > 0 ? "amber" : "emerald"}>
        {left > 0 ? "unbonding" : "mature"}
      </Pill>
      <span className="font-mono tabular-nums text-[#33544C]">{fmtMicro(u.amount_u)} MTQD</span>
      <span className="font-mono text-[0.62rem] text-[#7A8C86]">
        {left > 0 ? `releases in ${fmtDuration(left)}` : "releases at next block"}
      </span>
      <span className="ml-auto text-[0.62rem] text-[#7A8C86]">
        queued at #{u.created_height.toLocaleString("en-US")} ·{" "}
        <span className="font-mono" title={u.validator}>
          {shortAddr(u.validator, 10, 6)}
        </span>
      </span>
    </li>
  );
}

/* ============================================================
   Proposal card
   ============================================================ */

function ProposalCard({
  p,
  now,
  totalPower,
  hasWallet,
  hydrated,
  myPower,
  busy,
  monikerByAddr,
  onNavigate,
  onVote,
}: {
  p: GovProposalDto;
  now: number;
  totalPower: number;
  hasWallet: boolean;
  hydrated: boolean;
  myPower: number;
  busy: boolean;
  monikerByAddr: Map<string, string>;
  onNavigate: (id: SectionId) => void;
  onVote: (option: "YES" | "NO" | "ABSTAIN") => void;
}) {
  const voted = p.yes_power + p.no_power + p.abstain_power;
  const turnout = totalPower > 0 ? voted / totalPower : 0;
  const votingLeft = p.voting_end_ms - now;

  return (
    <article className="rounded-xl border border-[#E3EAE6] bg-[#FAFCFA] p-4 sm:p-5">
      {/* Header row */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[0.74rem] font-semibold text-mtqs-gold">#{p.id}</span>
        <Pill tone="muted">
          <span className="font-mono">{p.type}</span>
        </Pill>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-medium ${proposalStatusBadge(
            p.status,
          )}`}
        >
          {p.status}
        </span>
        <span className="ml-auto font-mono text-[0.62rem] text-[#7A8C86]" title={p.proposer}>
          proposer {monikerByAddr.get(p.proposer) ?? shortAddr(p.proposer, 8, 5)}
        </span>
      </div>

      <h4 className="text-[0.92rem] font-semibold text-[#0E1F1B]">{p.title}</h4>
      <p className="mt-1 text-[0.72rem] leading-relaxed text-[#5B6E68]">{p.description}</p>

      {/* Payload summary chip */}
      <div className="mt-2">
        {p.type === "network_param" ? (
          <PayloadChip>
            {String(p.payload.key ?? "?")} = {String(p.payload.value ?? "?")}
          </PayloadChip>
        ) : p.type === "validator_set_change" ? (
          <PayloadChip>
            {String(p.payload.action ?? "?")} ·{" "}
            {monikerByAddr.get(String(p.payload.validator ?? "")) ??
              shortAddr(String(p.payload.validator ?? "—"), 8, 5)}
            {p.payload.power != null ? ` · power ${String(p.payload.power)}` : ""}
          </PayloadChip>
        ) : (
          <PayloadChip>text — no on-chain execution</PayloadChip>
        )}
      </div>

      {/* Tally */}
      <div className="mt-4">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[0.64rem] text-[#5B6E68]">
          <span className="uppercase tracking-[0.16em]">Tally (voting power)</span>
          <span className="font-mono">
            turnout {fmtPower(voted)}/{fmtPower(totalPower)} ({(turnout * 100).toFixed(1)}%) ·
            quorum needs &gt; ⅓
          </span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#EDF2EF]" role="img" aria-label={`Tally: yes ${p.yes_power}, no ${p.no_power}, abstain ${p.abstain_power}`}>
          {voted > 0 ? (
            <>
              <div
                className="h-full bg-mtqs-emerald"
                style={{ width: `${(p.yes_power / voted) * 100}%` }}
                title={`YES ${fmtPower(p.yes_power)}`}
              />
              <div
                className="h-full bg-mtqs-rose"
                style={{ width: `${(p.no_power / voted) * 100}%` }}
                title={`NO ${fmtPower(p.no_power)}`}
              />
              <div
                className="h-full bg-[#A9BCB4]"
                style={{ width: `${(p.abstain_power / voted) * 100}%` }}
                title={`ABSTAIN ${fmtPower(p.abstain_power)}`}
              />
            </>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.64rem]">
          <span className="text-mtqs-emerald">YES {fmtPower(p.yes_power)}</span>
          <span className="text-mtqs-rose">NO {fmtPower(p.no_power)}</span>
          <span className="text-[#5B6E68]">ABSTAIN {fmtPower(p.abstain_power)}</span>
          <span className="ml-auto text-[#7A8C86]">
            deposit {fmtMicro(p.deposit)} MTQD · submitted #{p.submitted_height.toLocaleString("en-US")}
          </span>
        </div>
      </div>

      {/* Timing / lifecycle */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.64rem] text-[#5B6E68]">
        {p.status === "VOTING" ? (
          <span className={votingLeft <= 0 ? "text-mtqs-amber" : ""}>
            {votingLeft > 0 ? `voting ends in ${fmtDuration(votingLeft)}` : "voting period ended — awaiting close"}
          </span>
        ) : null}
        {p.status === "PASSED" || p.status === "EXECUTION_QUEUED" ? (
          <span className="inline-flex items-center gap-1">
            <Lock className="h-3 w-3" aria-hidden="true" />
            timelock — executes {p.execute_after_ms > now ? `in ${fmtDuration(p.execute_after_ms - now)}` : "now (next block)"}
          </span>
        ) : null}
        {p.executed_height != null ? (
          <span>executed at #{p.executed_height.toLocaleString("en-US")}</span>
        ) : null}
      </div>

      {/* Votes list */}
      {p.votes.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1 text-[0.6rem] uppercase tracking-[0.18em] text-[#5B6E68]">
            Votes ({p.votes.length})
          </p>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-[#E3EAE6] bg-white mtqs-scroll">
            <ul className="divide-y divide-[#EDF2EF]">
              {p.votes.map((v) => (
                <li
                  key={v.voter}
                  className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5 text-[0.66rem]"
                >
                  <span className="font-mono text-[#33544C]" title={v.voter}>
                    {monikerByAddr.get(v.voter) ?? shortAddr(v.voter, 10, 6)}
                  </span>
                  <Pill
                    tone={
                      v.option === "YES" ? "emerald" : v.option === "NO" ? "rose" : "muted"
                    }
                  >
                    {v.option}
                  </Pill>
                  <span className="font-mono tabular-nums text-[#5B6E68]">
                    +{fmtPower(v.power)}
                  </span>
                  <span className="ml-auto text-[0.6rem] text-[#7A8C86]">
                    #{v.height.toLocaleString("en-US")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Vote buttons */}
      {p.status === "VOTING" ? (
        <div className="mt-4 border-t border-[#EDF2EF] pt-3">
          {!hasWallet && hydrated ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[0.68rem] text-[#5B6E68]">
                Voting requires a wallet — create/import one to vote with your bonded power.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("wallet")}
                className="h-8 border-mtqs-gold/40 text-[0.68rem] text-mtqs-gold hover:bg-mtqs-gold/10"
              >
                Go to Wallet
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={!hasWallet || myPower <= 0 || busy}
                  onClick={() => onVote("YES")}
                  className="h-9 bg-mtqs-emerald px-4 text-[0.7rem] font-semibold text-white hover:bg-mtqs-emerald/90"
                >
                  Vote YES
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasWallet || myPower <= 0 || busy}
                  onClick={() => onVote("NO")}
                  className="h-9 border-mtqs-rose/40 px-4 text-[0.7rem] font-semibold text-mtqs-rose hover:bg-mtqs-rose/10"
                >
                  Vote NO
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasWallet || myPower <= 0 || busy}
                  onClick={() => onVote("ABSTAIN")}
                  className="h-9 border-[#E3EAE6] px-4 text-[0.7rem] font-semibold text-[#5B6E68] hover:bg-[#F0F5F2]"
                >
                  ABSTAIN
                </Button>
                <span className="ml-auto font-mono text-[0.62rem] text-[#5B6E68]">
                  your power {fmtPower(myPower)}
                </span>
              </div>
              {hasWallet && myPower <= 0 ? (
                <p className="mt-2 text-[0.64rem] text-mtqs-amber">
                  No voting power — bond ≥ 0.1 MTQD or be an ACTIVE validator.
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

/* ============================================================
   Submit proposal form
   ============================================================ */

function SubmitProposalForm({
  hasWallet,
  hydrated,
  validators,
  onNavigate,
  submit,
  submitting,
  onSubmitted,
}: {
  hasWallet: boolean;
  hydrated: boolean;
  validators: ValidatorDto[];
  onNavigate: (id: SectionId) => void;
  submit: (type: "gov_submit", payload: Record<string, unknown>) => Promise<SubmitOutcomeDto>;
  submitting: boolean;
  onSubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"text" | "network_param" | "validator_set_change">("text");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [paramKey, setParamKey] = useState("base_fee_u");
  const [paramValue, setParamValue] = useState("");
  const [action, setAction] = useState<"add" | "remove" | "repower">("add");
  const [targetVal, setTargetVal] = useState("");
  const [repower, setRepower] = useState("");
  const [result, setResult] = useState<SubmitOutcomeDto | null>(null);

  const allow = NETWORK_PARAM_ALLOWLIST[paramKey];
  const paramValueNum = Number(paramValue);
  // BUG FIX (Task-40 E2E): param checks only apply to network_param proposals —
  // the unconditional form made text/validator_set_change proposals permanently
  // un-submittable (button never enabled).
  const paramValid =
    type !== "network_param" ||
    (paramValue.trim() !== "" &&
      Number.isFinite(paramValueNum) &&
      allow != null &&
      paramValueNum >= allow.min &&
      paramValueNum <= allow.max);
  const repowerNum = Number(repower);
  const repowerValid =
    action !== "repower" ||
    (Number.isInteger(repowerNum) && repowerNum >= 0 && repowerNum <= 100);
  const titleValid = title.trim().length >= 4 && title.trim().length <= 120;
  const descValid = description.trim().length <= 2000;

  const candidates = validators.filter((v) => v.status === "CANDIDATE");
  const actives = validators.filter((v) => v.status === "ACTIVE");
  const targetList = action === "add" ? candidates : actives;

  const canSubmit =
    hasWallet &&
    titleValid &&
    descValid &&
    paramValid &&
    repowerValid &&
    (type !== "validator_set_change" || !!targetVal);

  async function handleSubmit() {
    if (!canSubmit) return;
    setResult(null);
    const payload: Record<string, unknown> =
      type === "network_param"
        ? { key: paramKey, value: paramValueNum }
        : type === "validator_set_change"
          ? {
              action,
              validator: targetVal,
              ...(action === "repower" ? { power: repowerNum } : {}),
            }
          : {};
    const out = await submit("gov_submit", {
      proposal_type: type,
      title: title.trim(),
      description: description.trim(),
      payload,
      deposit: GOV_DEPOSIT_U,
    });
    setResult(out);
    if (out.ok) {
      toast.success("Proposal submitted", { description: shortAddr(out.hash ?? "", 10, 6) });
      setTitle("");
      setDescription("");
      setParamValue("");
      setRepower("");
      setTargetVal("");
      onSubmitted();
    } else {
      toast.error("Proposal rejected", { description: out.error ?? "unknown error" });
    }
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.74rem] text-[#5B6E68]">
          Submit a network-governance proposal (deposit{" "}
          <span className="font-mono text-[#33544C]">
            {GOV_DEPOSIT_U.toLocaleString("en-US")} µMTQD
          </span>{" "}
          = {fmtMicro(GOV_DEPOSIT_U)} MTQD, charged on submission).
        </p>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="h-9 border-mtqs-gold/40 text-[0.72rem] text-mtqs-gold hover:bg-mtqs-gold/10">
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            {open ? "Close form" : "Open form"}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="mt-4">
        <WalletGate hasWallet={hasWallet} hydrated={hydrated} onNavigate={onNavigate}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="proposal-type"
                  className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                >
                  Type
                </label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as typeof type)}
                >
                  <SelectTrigger id="proposal-type" className="h-11 border-[#E3EAE6] bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-[#E3EAE6] bg-white">
                    <SelectItem value="text">text — signaling only</SelectItem>
                    <SelectItem value="network_param">network_param — allowlisted key</SelectItem>
                    <SelectItem value="validator_set_change">
                      validator_set_change — add / remove / repower
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label
                  htmlFor="proposal-title"
                  className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                >
                  Title (4–120 chars)
                </label>
                <Input
                  id="proposal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Raise base fee to 1,500 µMTQD"
                  className="h-11 border-[#E3EAE6] bg-white text-[0.78rem] text-[#0E1F1B]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="proposal-description"
                className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
              >
                Description (≤ 2000 chars)
              </label>
              <Textarea
                id="proposal-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Rationale, scope, impact…"
                className="min-h-20 border-[#E3EAE6] bg-white text-[0.78rem] text-[#0E1F1B]"
              />
            </div>

            {/* Dynamic payload fields */}
            {type === "network_param" ? (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-[#E3EAE6] bg-[#F7FAF8] p-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="param-key"
                    className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                  >
                    Allowlisted key
                  </label>
                  <Select value={paramKey} onValueChange={setParamKey}>
                    <SelectTrigger id="param-key" className="h-11 border-[#E3EAE6] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#E3EAE6] bg-white">
                      {Object.keys(NETWORK_PARAM_ALLOWLIST).map((k) => (
                        <SelectItem key={k} value={k}>
                          <span className="font-mono">{k}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {allow ? (
                    <p className="mt-1 text-[0.6rem] text-[#7A8C86]">
                      {allow.note} · bounds [{allow.min.toLocaleString("en-US")}, {" "}
                      {allow.max.toLocaleString("en-US")}]
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    htmlFor="param-value"
                    className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                  >
                    New value
                  </label>
                  <Input
                    id="param-value"
                    value={paramValue}
                    onChange={(e) => setParamValue(e.target.value)}
                    inputMode="numeric"
                    placeholder={String(allow?.min ?? 0)}
                    className="h-11 border-[#E3EAE6] bg-white font-mono text-[0.8rem] text-[#0E1F1B]"
                  />
                  {paramValue.trim() !== "" && !paramValid ? (
                    <p className="mt-1 text-[0.6rem] text-mtqs-amber">
                      Out of bounds [{allow?.min}, {allow?.max}].
                    </p>
                  ) : null}
                </div>
                <p className="sm:col-span-2 flex items-start gap-1.5 text-[0.64rem] leading-relaxed text-[#33544C]">
                  <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mtqs-gold" aria-hidden="true" />
                  Constitutional guard: monetary params are rejected on-chain — network governance
                  cannot touch the MTQ monetary registry.
                </p>
              </div>
            ) : null}

            {type === "validator_set_change" ? (
              <div className="grid grid-cols-1 gap-3 rounded-lg border border-[#E3EAE6] bg-[#F7FAF8] p-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="vs-action"
                    className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                  >
                    Action
                  </label>
                  <Select
                    value={action}
                    onValueChange={(v) => {
                      setAction(v as typeof action);
                      setTargetVal("");
                    }}
                  >
                    <SelectTrigger id="vs-action" className="h-11 border-[#E3EAE6] bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-[#E3EAE6] bg-white">
                      <SelectItem value="add">add — admit a CANDIDATE</SelectItem>
                      <SelectItem value="remove">remove — retire an ACTIVE</SelectItem>
                      <SelectItem value="repower">repower — set an ACTIVE&apos;s power</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label
                    htmlFor="vs-validator"
                    className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                  >
                    Validator ({action === "add" ? "CANDIDATE" : "ACTIVE"})
                  </label>
                  <Select value={targetVal} onValueChange={setTargetVal}>
                    <SelectTrigger id="vs-validator" className="h-11 border-[#E3EAE6] bg-white">
                      <SelectValue
                        placeholder={
                          targetList.length === 0
                            ? `no ${action === "add" ? "CANDIDATE" : "ACTIVE"} validators`
                            : "choose target"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="border-[#E3EAE6] bg-white">
                      {targetList.map((v) => (
                        <SelectItem key={v.address} value={v.address}>
                          {v.moniker} · power {fmtPower(v.power)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {action === "repower" ? (
                  <div>
                    <label
                      htmlFor="vs-power"
                      className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                    >
                      Power (integer 0–100)
                    </label>
                    <Input
                      id="vs-power"
                      value={repower}
                      onChange={(e) => setRepower(e.target.value)}
                      inputMode="numeric"
                      placeholder="e.g. 10"
                      className="h-11 border-[#E3EAE6] bg-white font-mono text-[0.8rem] text-[#0E1F1B]"
                    />
                    {!repowerValid ? (
                      <p className="mt-1 text-[0.6rem] text-mtqs-amber">
                        Power must be an integer in [0, 100].
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || submitting}
                className="h-11 bg-mtqs-gold font-medium text-white hover:bg-mtqs-gold/90"
              >
                {submitting ? "Signing + submitting…" : "Sign & submit proposal"}
              </Button>
              <span className="text-[0.64rem] text-[#5B6E68]">
                deposit <span className="font-mono">{GOV_DEPOSIT_U.toLocaleString("en-US")} µMTQD</span>{" "}
                (0.1 MTQD) is charged when the tx executes.
              </span>
            </div>
            {!titleValid && title.length > 0 ? (
              <p className="text-[0.64rem] text-mtqs-amber">
                Title must be 4–120 characters (currently {title.trim().length}).
              </p>
            ) : null}
            <OutcomeLine outcome={result} />
          </div>
        </WalletGate>
      </CollapsibleContent>
    </Collapsible>
  );
}
