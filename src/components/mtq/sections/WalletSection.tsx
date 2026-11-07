// MTQΣ — Devnet Wallet for the Sovereign Devnet (client-side signing).
//
// The private key NEVER leaves the browser: the seed is generated with
// crypto.getRandomValues, stored in localStorage (mtqs.chain.wallet.v1) and
// used to ed25519-sign transactions over the SAME canonicalTxBytes the node
// verifies. Only the finished signed Tx is POSTed to /api/chain/submit.
//
// Live sources: /api/chain (3s — live base fee) and /api/chain/account?a=…
// (3s — balances/nonce/history), canonical poll pattern. The faucet POSTs
// { address } and drips 10,000 MTQD + 10 PMTQ once per fresh address.
//
// HONESTY: browser-local key custody is demo-only — the amber warning panel
// is always visible; balances carry the testnet-asset disclosure line.
//
// TASK 40-c — section contract: WalletSection({ onNavigate }) — onNavigate is
// used for the post-send "View in Explorer" cross-link.

"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Copy,
  Droplets,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
  Send,
  Trash2,
  Wallet as WalletIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Panel, Pill, Reveal, SectionHeading, Skeleton, StatCard } from "@/components/mtq/primitives";
import {
  LiveClockPill,
  StaleStrip,
  TxResultBadge,
  TxTypePill,
  fmtMicro,
  generateWalletRecord,
  importWalletRecord,
  isMtqAddress,
  parseMicroAmount,
  useChainPoll,
  useChainSubmitter,
  type AccountDto,
  type ChainSummaryDto,
  type SubmitOutcomeDto,
} from "@/components/mtq/chain/chain-kit";
import { useWalletStore } from "@/lib/chain/wallet-store";
import type { SectionId } from "@/components/mtq/Navigation";
import { copyToClipboard, fmtAgo, shortAddr } from "@/components/mtq/format";

const POLL_MS = 3000;

export function WalletSection({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const wallet = useWalletStore((s) => s.wallet);
  const hydrated = useWalletStore((s) => s.hydrated);
  const hydrate = useWalletStore((s) => s.hydrate);

  // Read the persisted wallet once on mount (avoids SSR null-flap).
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Live base fee (+ node readiness) and account state, both 3s.
  const summary = useChainPoll<ChainSummaryDto>("/api/chain", POLL_MS);
  const account = useChainPoll<AccountDto>(
    wallet ? `/api/chain/account?a=${wallet.address}` : null,
    POLL_MS,
  );

  const baseFee = summary.data?.params.base_fee_u ?? null;
  const acct = account.data;

  const { submit, submitting, nextNonce } = useChainSubmitter({
    accountNonce: acct ? acct.nonce : null,
    fee: baseFee ?? 1000,
  });

  /* ─── generate / import (no wallet yet) ─── */
  const [importSeed, setImportSeed] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const setWallet = useWalletStore((s) => s.setWallet);

  function handleGenerate() {
    const rec = generateWalletRecord();
    setWallet(rec);
    setImportSeed("");
    setImportError(null);
    toast.success("Wallet generated", {
      description: `Address ${shortAddr(rec.address, 12, 8)} — key stays in this browser.`,
    });
  }

  function handleImport() {
    const rec = importWalletRecord(importSeed);
    if (!rec) {
      setImportError("Invalid seed — paste 64 hex characters (32 bytes).");
      return;
    }
    setWallet(rec);
    setImportSeed("");
    setImportError(null);
    toast.success("Wallet imported", {
      description: `Address ${shortAddr(rec.address, 12, 8)}`,
    });
  }

  /* ─── faucet ─── */
  const [faucetBusy, setFaucetBusy] = useState(false);
  const [faucetResult, setFaucetResult] = useState<SubmitOutcomeDto | null>(null);

  async function handleFaucet() {
    if (!wallet) return;
    setFaucetBusy(true);
    setFaucetResult(null);
    try {
      const res = await fetch("/api/chain/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address }),
      });
      const json = (await res.json().catch(() => null)) as SubmitOutcomeDto | null;
      const outcome: SubmitOutcomeDto = json ?? { ok: false, error: `HTTP ${res.status}` };
      setFaucetResult(outcome);
      if (outcome.ok) {
        toast.success("Faucet drip submitted", {
          description: "10,000 MTQD + 10 PMTQ via a real signed tx through consensus.",
        });
        account.refresh();
      } else {
        toast.error("Faucet rejected", { description: outcome.error ?? "unknown error" });
      }
    } catch (e) {
      const outcome = { ok: false, error: e instanceof Error ? e.message : String(e) };
      setFaucetResult(outcome);
      toast.error("Faucet request failed", { description: outcome.error });
    } finally {
      setFaucetBusy(false);
    }
  }

  /* ─── send form ─── */
  const [asset, setAsset] = useState<"MTQD" | "PMTQ">("MTQD");
  const [recipient, setRecipient] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [sendResult, setSendResult] = useState<SubmitOutcomeDto | null>(null);

  const parsedAmount = parseMicroAmount(amountInput);
  const balanceU = asset === "MTQD" ? (acct?.fee_u ?? null) : (acct?.pmtq_u ?? null);
  const recipientValid = isMtqAddress(recipient);
  const amountValid = parsedAmount != null;
  const enoughBalance =
    parsedAmount != null && balanceU != null && parsedAmount <= balanceU;
  const feeCovered = baseFee != null && (acct?.fee_u ?? 0) >= baseFee;
  const canSend =
    wallet != null &&
    recipientValid &&
    amountValid &&
    enoughBalance &&
    feeCovered &&
    nextNonce != null &&
    !submitting;

  const sendHint = !recipientValid && recipient.length > 0
    ? "Recipient must be an mtq1… address (mtq1 + 40 hex)."
    : !amountValid && amountInput.length > 0
      ? "Amount must be a positive number with ≤ 6 decimals."
      : amountValid && !enoughBalance
        ? `Insufficient ${asset} balance (${fmtMicro(balanceU ?? 0)} available).`
        : !feeCovered
          ? "Fee balance too low — use the faucet first."
          : null;

  async function handleSend() {
    if (!wallet || parsedAmount == null) return;
    setSendResult(null);
    const outcome = await submit("send", {
      to: recipient.trim(),
      asset: asset === "PMTQ" ? "PMTQ" : "FEE",
      amount: parsedAmount,
    });
    setSendResult(outcome);
    if (outcome.ok) {
      toast.success("Transaction submitted", {
        description: `Signed in this browser · nonce ${nextNonce} · hash ${shortAddr(outcome.hash ?? "", 10, 6)}`,
      });
      setRecipient("");
      setAmountInput("");
      account.refresh();
    } else {
      toast.error("Submit rejected", { description: outcome.error ?? "unknown error" });
    }
  }

  /* ─── seed reveal / forget ─── */
  const [showSeed, setShowSeed] = useState(false);
  const removeWallet = useWalletStore((s) => s.removeWallet);

  const recentTxs = useMemo(() => acct?.recent_txs ?? [], [acct]);

  return (
    <div className="space-y-8">
      {/* ─── Header ─── */}
      <SectionHeading
        eyebrow="wallet · browser-local key custody"
        title="Devnet Wallet"
        className="mb-0"
        right={
          wallet ? (
            <LiveClockPill
              stale={account.stale}
              lastReadAt={account.lastReadAt}
              loading={account.loading}
            />
          ) : (
            <Pill tone="amber">no key loaded</Pill>
          )
        }
      />

      {/* ─── HONEST custody warning (always visible) ─── */}
      <Reveal>
        <div className="rounded-xl border-2 border-mtqs-amber/50 bg-amber-50 px-4 py-3">
          <p className="flex items-start gap-2 text-[0.74rem] font-medium leading-relaxed text-amber-800">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-mtqs-amber" aria-hidden="true" />
            Browser-local key — devnet demo custody only. Not secure storage. Never hold value.
          </p>
        </div>
      </Reveal>

      {/* ─── No wallet: generate / import ─── */}
      {hydrated && !wallet ? (
        <Reveal>
          <Panel className="mx-auto max-w-2xl p-6">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[#0E1F1B]">Create or import a key</h3>
            </div>
            <p className="mb-5 text-[0.74rem] leading-relaxed text-[#5B6E68]">
              The key is generated in this browser (CSPRNG seed → ed25519) and stored in
              localStorage only. Transactions are signed client-side — the server never sees the
              private key. Then use the faucet to receive devnet credits.
            </p>
            <div className="flex flex-col gap-4">
              <Button
                onClick={handleGenerate}
                className="h-11 bg-mtqs-gold font-medium text-white hover:bg-mtqs-gold/90"
              >
                <WalletIcon className="h-4 w-4" aria-hidden="true" />
                Generate new key
              </Button>
              <div className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] p-4">
                <label
                  htmlFor="import-seed"
                  className="mb-1.5 block text-[0.66rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                >
                  Import existing seed (64 hex)
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="import-seed"
                    value={importSeed}
                    onChange={(e) => {
                      setImportSeed(e.target.value);
                      setImportError(null);
                    }}
                    placeholder="paste 64-character hex seed"
                    className="h-11 border-[#E3EAE6] bg-white font-mono text-[0.74rem] text-[#0E1F1B]"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <Button
                    onClick={handleImport}
                    disabled={importSeed.trim().length === 0}
                    variant="outline"
                    className="h-11 border-mtqs-gold/40 text-[0.78rem] text-teal-800 hover:bg-mtqs-gold/10"
                  >
                    Import
                  </Button>
                </div>
                {importError ? (
                  <p className="mt-2 text-[0.68rem] text-mtqs-amber" role="alert">
                    {importError}
                  </p>
                ) : null}
              </div>
            </div>
          </Panel>
        </Reveal>
      ) : null}

      {/* ─── Wallet loaded ─── */}
      {wallet ? (
        <>
          {account.stale && account.error && acct ? (
            <StaleStrip error={account.error} source="/api/chain/account" />
          ) : null}

          {/* Address card */}
          <Reveal>
            <Panel className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <div className="text-[0.6rem] uppercase tracking-[0.2em] text-[#5B6E68]">
                    Address (mtq1 + sha256(pub)[:20])
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[0.84rem] break-all text-[#0E1F1B]">
                      {wallet.address}
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyToClipboard(wallet.address);
                        if (ok) toast.success("Copied address");
                        else toast.error("Copy failed");
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E3EAE6] text-[#5B6E68] transition hover:border-mtqs-gold/40 hover:text-mtqs-gold"
                      aria-label="Copy address"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="font-mono text-[0.64rem] text-[#5B6E68]" title={wallet.pub}>
                    pub {shortAddr(wallet.pub, 16, 8)} · created{" "}
                    {new Date(wallet.created_at).toLocaleString("en-US")}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSeed((s) => !s)}
                    className="h-9 border-[#E3EAE6] text-[0.7rem] text-[#5B6E68]"
                    aria-expanded={showSeed}
                  >
                    {showSeed ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {showSeed ? "Hide seed" : "Show seed (backup)"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 border-rose-200 text-[0.7rem] text-rose-800 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Forget key
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-[#E3EAE6] bg-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-[#0E1F1B]">
                          Forget this browser-local key?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-[0.78rem] text-[#5B6E68]">
                          The seed is removed from localStorage and this screen. Unless you backed
                          it up, the address and its devnet balances become unreachable — there is
                          no recovery (reference devnet, no value at stake).
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep key</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            removeWallet();
                            setShowSeed(false);
                            setSendResult(null);
                            setFaucetResult(null);
                            toast.success("Key forgotten (browser-local storage cleared)");
                          }}
                          className="bg-rose-600 text-white hover:bg-rose-700"
                        >
                          Forget key
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {showSeed ? (
                <div className="mt-4 rounded-lg border border-mtqs-amber/40 bg-amber-50 p-3">
                  <p className="mb-1.5 text-[0.62rem] uppercase tracking-[0.16em] text-amber-700">
                    Private seed — never transmitted, never displayed in logs
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-[0.68rem] break-all text-[#33544C]">
                      {wallet.seed}
                    </code>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyToClipboard(wallet.seed);
                        if (ok) toast.success("Seed copied — store it nowhere shared");
                        else toast.error("Copy failed");
                      }}
                      className="shrink-0 rounded border border-transparent px-1.5 py-0.5 font-mono text-[0.6rem] text-mtqs-amber transition hover:border-mtqs-amber/40"
                      aria-label="Copy seed"
                    >
                      copy
                    </button>
                  </div>
                </div>
              ) : null}
            </Panel>
          </Reveal>

          {/* Balances */}
          <Reveal>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                label="MTQD (fee credit)"
                value={acct ? fmtMicro(acct.fee_u) : "—"}
                trend="testnet-only fee asset"
                trendDirection="neutral"
                tone="neutral"
              />
              <StatCard
                label="PMTQ (pilot mirror)"
                value={acct ? fmtMicro(acct.pmtq_u) : "—"}
                trend="non-canonical ledger mirror"
                trendDirection="neutral"
                tone="neutral"
              />
              <StatCard
                label="Bonded"
                value={acct ? fmtMicro(acct.bonded_u) : "—"}
                trend={acct ? `${acct.stakes.length} position(s)` : "—"}
                trendDirection="neutral"
                tone="neutral"
              />
              <StatCard
                label="Nonce"
                value={acct ? acct.nonce.toLocaleString("en-US") : "—"}
                trend={nextNonce != null ? `next tx nonce ${nextNonce}` : "—"}
                trendDirection="neutral"
                tone="neutral"
              />
            </div>
          </Reveal>
          <p className="-mt-4 text-[0.66rem] text-[#5B6E68]">
            MTQD is a testnet-only fee credit · PMTQ is a non-canonical pilot ledger mirror.
          </p>

          {/* Faucet + send form */}
          <Reveal>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Faucet */}
              <Panel className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-[#0E1F1B]">Devnet faucet</h3>
                </div>
                <p className="mb-4 text-[0.72rem] leading-relaxed text-[#5B6E68]">
                  Drips 10,000 MTQD + 10 PMTQ. The faucet is an ordinary network participant: it
                  signs a real send transaction that goes through consensus like any other. One
                  drip per address.
                </p>
                <Button
                  onClick={handleFaucet}
                  disabled={faucetBusy || (acct != null && acct.fee_u > 0)}
                  className="h-11 w-full bg-mtqs-gold font-medium text-white hover:bg-mtqs-gold/90 sm:w-auto sm:px-6"
                >
                  {faucetBusy ? "Dripping…" : "Request drip"}
                </Button>
                {acct != null && acct.fee_u > 0 ? (
                  <p className="mt-2 text-[0.66rem] text-[#5B6E68]">
                    Disabled — this address already holds {fmtMicro(acct.fee_u)} MTQD (the faucet
                    drips once per address with a zero balance).
                  </p>
                ) : null}
                {faucetResult ? (
                  <div
                    className={`mt-3 rounded-lg border px-3 py-2 text-[0.66rem] leading-relaxed ${
                      faucetResult.ok
                        ? "border-mtqs-emerald/30 bg-mtqs-emerald/[0.06] text-[#33544C]"
                        : "border-rose-200 bg-rose-50 text-rose-800"
                    }`}
                  >
                    {faucetResult.ok ? (
                      <>
                        Drip submitted — tx{" "}
                        <span className="font-mono">{shortAddr(faucetResult.hash ?? "", 12, 8)}</span>{" "}
                        (credits arrive with the next committed block).
                      </>
                    ) : (
                      <>Rejected: {faucetResult.error}</>
                    )}
                  </div>
                ) : null}
              </Panel>

              {/* Send form */}
              <Panel className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Send className="h-4 w-4 text-mtqs-gold" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-[#0E1F1B]">Send</h3>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="send-asset"
                        className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                      >
                        Asset
                      </label>
                      <Select
                        value={asset}
                        onValueChange={(v) => setAsset(v as "MTQD" | "PMTQ")}
                      >
                        <SelectTrigger id="send-asset" className="h-11 border-[#E3EAE6] bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-[#E3EAE6] bg-white">
                          <SelectItem value="MTQD">MTQD — fee credit</SelectItem>
                          <SelectItem value="PMTQ">PMTQ — pilot mirror</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label
                        htmlFor="send-amount"
                        className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                      >
                        Amount ({asset})
                      </label>
                      <Input
                        id="send-amount"
                        value={amountInput}
                        onChange={(e) => setAmountInput(e.target.value)}
                        placeholder="0.00"
                        inputMode="decimal"
                        className="h-11 border-[#E3EAE6] bg-white font-mono text-[0.8rem] text-[#0E1F1B]"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="send-recipient"
                      className="mb-1 block text-[0.62rem] uppercase tracking-[0.16em] text-[#5B6E68]"
                    >
                      Recipient (mtq1…)
                    </label>
                    <Input
                      id="send-recipient"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      placeholder="mtq1…"
                      className="h-11 border-[#E3EAE6] bg-white font-mono text-[0.78rem] text-[#0E1F1B]"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.64rem] text-[#5B6E68]">
                    <span>
                      fee{" "}
                      <span className="font-mono tabular-nums text-[#33544C]">
                        {baseFee != null ? `${baseFee.toLocaleString("en-US")} µMTQD` : "…"}
                      </span>
                    </span>
                    <span>
                      resulting nonce{" "}
                      <span className="font-mono tabular-nums text-[#33544C]">{nextNonce ?? "—"}</span>
                    </span>
                    <span>
                      available{" "}
                      <span className="font-mono tabular-nums text-[#33544C]">
                        {balanceU != null ? `${fmtMicro(balanceU)} ${asset}` : "—"}
                      </span>
                    </span>
                  </div>

                  {sendHint ? (
                    <p className="text-[0.66rem] text-mtqs-amber" role="alert">
                      {sendHint}
                    </p>
                  ) : null}

                  <Button
                    onClick={handleSend}
                    disabled={!canSend}
                    className="h-11 w-full bg-mtqs-gold font-medium text-white hover:bg-mtqs-gold/90 sm:w-auto sm:px-6"
                  >
                    {submitting ? "Signing + submitting…" : "Sign & send"}
                  </Button>
                  <p className="text-[0.62rem] leading-relaxed text-[#5B6E68]">
                    Signed in this browser with ed25519 over the canonical tx bytes; the node
                    re-verifies before consensus. A FAILED receipt (e.g. insufficient balance)
                    still consumes the nonce and fee — exactly like a reverted EVM tx.
                  </p>

                  {sendResult ? (
                    <div
                      className={`rounded-lg border px-3 py-2.5 text-[0.68rem] leading-relaxed ${
                        sendResult.ok
                          ? "border-mtqs-emerald/30 bg-mtqs-emerald/[0.06] text-[#33544C]"
                          : "border-rose-200 bg-rose-50 text-rose-800"
                      }`}
                    >
                      {sendResult.ok ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            Submitted — tx{" "}
                            <span className="font-mono" title={sendResult.hash}>
                              {shortAddr(sendResult.hash ?? "", 12, 8)}
                            </span>
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onNavigate("explorer")}
                            className="h-7 border-mtqs-gold/40 px-2 text-[0.62rem] text-teal-800 hover:bg-mtqs-gold/10"
                          >
                            View in Explorer
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </Button>
                        </div>
                      ) : (
                        <>Rejected: {sendResult.error}</>
                      )}
                    </div>
                  ) : null}
                </div>
              </Panel>
            </div>
          </Reveal>

          {/* Tx history */}
          <Reveal>
            <Panel className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#0E1F1B]">
                  Transaction history ({recentTxs.length})
                </h3>
                <Pill tone="muted">latest 25 involving this address</Pill>
              </div>
              {!acct && account.loading ? (
                <div className="space-y-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-md" />
                  ))}
                </div>
              ) : recentTxs.length === 0 ? (
                <p className="rounded-lg border border-[#E3EAE6] bg-[#FAFCFA] px-3 py-6 text-center text-[0.72rem] text-[#5B6E68]">
                  No transactions involving this address yet — request a faucet drip or send
                  something.
                </p>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border border-[#E3EAE6] bg-white mtqs-scroll">
                  <ul className="divide-y divide-[#EDF2EF]">
                    {recentTxs.map((t) => (
                      <li
                        key={t.hash}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-[0.7rem] hover:bg-[#F7FAF8]"
                      >
                        <TxTypePill type={t.raw.type} />
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await copyToClipboard(t.hash);
                            if (ok) toast.success("Copied tx hash", { description: shortAddr(t.hash) });
                            else toast.error("Copy failed");
                          }}
                          className="font-mono text-[#33544C] hover:text-mtqs-gold"
                          title={`${t.hash} — click to copy`}
                        >
                          {shortAddr(t.hash, 12, 8)}
                        </button>
                        <span className="font-mono tabular-nums text-[#5B6E68]">
                          #{t.height.toLocaleString("en-US")}·{t.idx}
                        </span>
                        <TxResultBadge ok={t.result.ok} error={t.result.error} />
                        <span className="ml-auto text-[0.62rem] text-[#5B6E68]">
                          {fmtAgo(t.time_ms)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          </Reveal>
        </>
      ) : null}
    </div>
  );
}
