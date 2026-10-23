// MTQΣ — Redeem Section (§19)
// Dedicated page for the "redeem" nav tab (user operations). Composes:
//   1. Live stat tiles from the metrics snapshot (P_MTQ, NAV per MTQ,
//      current state-dependent redemption fee, protocol status)
//   2. The engine-backed RedeemSimulator (§12.2 NAV settlement — the engine's
//      canonical doctrine since P0-FIX-2; §3.4.2 is the audit-only comparison)
//   3. The §19.3 redemption flow — user inputs + eight-step on-chain sequence
//   4. The §19.4.2 redemption slippage guard (single-asset router)
//   5. The §21.4 state-dependent fee table (highlighting the live state)
//   6. The §19.6.2 full-basket release doctrine (amber note)
//
// Honest-status tone: TESTNET ONLY · SHADOW MODE ENFORCED · RESERVE TRADING
// NOT AUTHORIZED — simulated pilot engine, no on-chain broadcast, no real
// value. Redemption is NEVER a USD promise: it releases the proportional
// basket.
//
// Props: { onNavigate, snapshot }.

"use client";

import { useCallback, useState } from "react";
import {
  Flame,
  AlertTriangle,
  ListOrdered,
  Percent,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import {
  Panel,
  Reveal,
  Pill,
  GlowDot,
  SectionHeading,
  Stat,
  TickNumber,
} from "@/components/mtq/primitives";
import { RedeemSimulator } from "@/components/mtq/RedeemSimulator";
import { TruthBanner } from "@/components/mtq/TruthBanner";
import { STATUS_TONE, REDEEM_FEE_BY_STATUS, Block } from "@/components/mtq/status-tone";
import { fmtFixed } from "@/components/mtq/format";
import {
  DEFAULT_USER_SLIPPAGE,
  type ProtocolStatus,
} from "@/lib/mtq/blueprint";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { SectionId } from "@/components/mtq/Navigation";

/* ---------- Status tone, §21.4 fee map, and the Block wrapper live in the
   shared status-tone module (extracted from the former Mint/Redeem
   duplication — behavior identical). ---------- */

const FEE_TABLE: {
  state: ProtocolStatus;
  slot: string;
  action: string;
}[] = [
  { state: "NORMAL", slot: "S1", action: "Allowed" },
  { state: "CAUTION", slot: "S2", action: "Allowed" },
  { state: "STRESS", slot: "S3", action: "Allowed" },
  { state: "DEFENSIVE", slot: "S4", action: "Allowed" },
  { state: "EMERGENCY", slot: "S5", action: "PAUSED" },
  { state: "RECOVERY", slot: "S6", action: "Allowed" },
];

/* ---------- §19.3.1 — user inputs ---------- */
const REDEEM_INPUTS = [
  {
    param: "Burn Amount",
    symbol: "Y",
    desc: "The amount of MTQΣ the user wants to redeem (minimum 1 MTQ, §19.6.4).",
  },
  {
    param: "Output Preference",
    symbol: "—",
    desc: "The user can choose to receive the full basket (default) or a single asset via the router.",
  },
  {
    param: "Output Asset",
    symbol: "outputAsset",
    desc: "A single asset (e.g. USDC) to receive; address(0) means the full basket. The router guard of §19.4.2 applies.",
  },
  {
    param: "Slippage Tolerance",
    symbol: "τ_user",
    desc: `Maximum acceptable deviation from the oracle price (default ${(DEFAULT_USER_SLIPPAGE * 100).toFixed(1)}%).`,
  },
];

/* ---------- §19.3.2 — the eight-step redemption sequence ---------- */
const REDEEM_STEPS = [
  {
    title: "Fetch the current NAV",
    body: "The per-token net asset value is read from the reserve accounting. The circulating supply excludes the non-circulating Genesis Reserve holdings (§20.1.4, Ch 18).",
    formula: "NAV_t = V_net,t / S_circ,t",
  },
  {
    title: "Compute the redemption value",
    body: "The redeem quote is the current value of the burned tokens expressed in USD-equivalent terms — invariant I6 of §2.6: users receive the current value of their claim, not a frozen 1:1 face amount.",
    formula: "RedeemValue_USD = Y × NAV_t",
  },
  {
    title: "Fee deduction",
    body: "F_redeem = 0.0015 (0.15%) is the Normal-state default. The risk-state fee schedule of Ch 21 raises the effective fee in elevated stress states — leaning against exit demand when the reserve most needs protection, and compensating the protocol for the liquidity it must surrender. Fees accrue to the Operational Wallet (§20.4).",
    formula: "RedeemValue_net = RedeemValue_USD × (1 − F_redeem)",
  },
  {
    title: "Calculate the proportional basket",
    body: "The protocol releases a proportional amount of each reserve asset. The release is always proportional to ACTUAL reserve composition, never to target weights — redemption reflects what is held, not what is intended. Under v2.0 the release spans all components of the reserve, including CHF and any successor instruments admitted under Ch 15.",
    formula: "Release_i = RedeemValue_net × V_i / V_net",
  },
  {
    title: "Release assets (full basket)",
    body: "The protocol transfers the proportional assets to the user's wallet. Each transfer is part of the same transaction as the burn, so the user cannot be left holding burned tokens against unreleased assets.",
    formula: null,
  },
  {
    title: "Optional single-asset redemption (router)",
    body: "If the user prefers only USDC (or another single asset), a DEX router swaps the proportional basket into that asset in a single atomic transaction. The router guard of §19.4.2 applies; the user bears the market conversion cost implicit in the route — the protocol itself never takes FX risk on the conversion.",
    formula: null,
  },
  {
    title: "Burn tokens",
    body: "The contract burns Y MTQΣ from the user's wallet, reducing both the asset base and the liability in the same operation.",
    formula: null,
  },
  {
    title: "Update reserve state",
    body: "The reserve state is updated to reflect the reduced assets and liabilities (Ch 18).",
    formula: null,
  },
];

export function RedeemSection({
  onNavigate: _onNavigate,
  snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  // Simulator plumbing (§12.2 contract): chain/wallet selectors + an
  // after-trial callback. No trial list on this page — documented no-op.
  const [chain, setChain] = useState("monad");
  const [wallet, setWallet] = useState("");
  const onAfterTrial = useCallback(() => {
    /* trial ledger refresh is out of scope for this page */
  }, []);

  const status = snapshot?.status ?? null;
  const tone = status ? STATUS_TONE[status] : null;
  const currentFee = status ? REDEEM_FEE_BY_STATUS[status] : undefined;
  const navPerMtq =
    snapshot && snapshot.nav > 0 && snapshot.circulatingSupply > 0
      ? snapshot.nav / snapshot.circulatingSupply
      : null;

  return (
    <div className="space-y-10">
      {/* Page heading + live status pill */}
      <SectionHeading
        eyebrow="§19 · user operations"
        title="Redeem MTQΣ"
        className="mb-0"
        right={
          tone ? (
            <Pill tone={tone.pill}>
              <GlowDot color={tone.dot} size="h-1.5 w-1.5" />
              {status} · live
            </Pill>
          ) : (
            <Pill tone="muted">
              <GlowDot color="gold" size="h-1.5 w-1.5" />
              awaiting snapshot
            </Pill>
          )
        }
      />

      {/* Amber truth banner (shared component) */}
      <Reveal>
        <TruthBanner>
          <p className="text-[0.75rem] text-amber-100/90 leading-relaxed">
            This redeem page runs the <strong className="text-amber-100">simulated pilot engine</strong> —
            no on-chain broadcast, no real value. And the exit side carries its own doctrine:
            redemption is priced against NAV and releases the <strong className="text-amber-100">full
            proportional basket</strong> (§19.6.2) — it is never a USD redemption promise.
          </p>
        </TruthBanner>
      </Reveal>

      {/* Live stat tiles — values from the snapshot prop + §21.4 fee map */}
      <Reveal delay={0.05}>
        <Panel className="p-4 sm:p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="P_MTQ · reference price"
              value={<TickNumber value={snapshot?.mtqPrice ?? null} format={(n) => fmtFixed(n, 4)} />}
              sub="chain-linked index I_t / I_base · §9.8"
            />
            <Stat
              label="NAV per MTQ"
              value={<TickNumber value={navPerMtq} format={(n) => fmtFixed(n, 4)} />}
              sub="NAV_t = V_net,t / S_circ,t · §19.3.2"
            />
            <Stat
              label="Current redemption fee"
              value={
                currentFee === undefined ? (
                  <span>—</span>
                ) : currentFee === null ? (
                  <span className="text-mtqs-rose">PAUSED</span>
                ) : (
                  <span>{(currentFee * 100).toFixed(2)}%</span>
                )
              }
              sub={`state-dependent · §21.4${status ? ` · ${status}` : ""}`}
            />
            <Stat
              label="Protocol status"
              value={
                tone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <GlowDot color={tone.dot} size="h-1.5 w-1.5" />
                    <span className="text-[0.82rem]">{status}</span>
                  </span>
                ) : (
                  <span>—</span>
                )
              }
              sub="sets the fee — or pauses redemption (S5)"
            />
          </div>
        </Panel>
      </Reveal>

      {/* Live simulator */}
      <Block
        id="redeem-simulator"
        icon={Flame}
        title="Live redeem simulator"
        sub="Burn MTQΣ → the engine prices the exit against live NAV, applies the state-dependent fee, and releases the proportional basket on a state-clone."
      >
        <Reveal>
          <Panel className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
                §12.2 · NAV settlement (§3.4.2 = audit-only comparison)
              </div>
              <Pill tone="emerald">
                <GlowDot color="emerald" size="h-1.5 w-1.5" />
                engine-backed
              </Pill>
            </div>
            <RedeemSimulator
              snapshot={snapshot}
              chain={chain}
              setChain={setChain}
              wallet={wallet}
              setWallet={setWallet}
              onAfterTrial={onAfterTrial}
            />
            <p className="mt-3 text-[0.65rem] text-white/45 leading-relaxed">
              The pilot settles at NAV (§12.2 / §19.3.2 Step 2 — P0-FIX-2): burn MTQΣ, release the
              proportional basket at book value; the legacy §3.4.2 index quote is the audit-only
              comparison (see the audit sub-panel on every run). Every run is recorded in the pilot
              trial ledger (SQLite); no wallet signature is ever requested.
            </p>
          </Panel>
        </Reveal>
      </Block>

      {/* §19.3 — step-by-step redemption */}
      <Block
        id="redeem-flow"
        icon={ListOrdered}
        title="How redemption works — §19.3 step-by-step"
        sub="Burn MTQΣ, release the proportional reserve basket — priced against NAV (the exit side uses what the reserve is actually worth, not what the reference unit quotes). The default exit is the full basket; the single-asset router is an optional convenience layered on top."
      >
        <Reveal>
          <Panel className="p-4 sm:p-5 space-y-4">
            {/* 16f-008: the §19.3 walkthrough documents the legacy v1/v2
                reserve-funded engine path as implemented in the pilot. */}
            <div className="rounded-md border border-mtqs-amber/25 bg-amber-400/[0.04] px-3 py-2 text-[0.68rem] leading-relaxed text-white/60">
              <span className="font-semibold text-mtqs-amber">Legacy v1/v2 pilot-ledger path.</span>{" "}
              The steps below document the reserve-funded engine path as implemented; the v3.0
              no-conventional-reserve objective (payment-funded issuance) supersedes it — Gate B
              open (D-13.3–D-13.7).
            </div>
            {/* §19.3.1 user inputs */}
            <div>
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75 mb-2">
                §19.3.1 · user inputs
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {REDEEM_INPUTS.map((input) => (
                  <div key={input.param} className="rounded-md border border-white/[0.06] bg-white/[0.03] p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[0.72rem] font-medium text-white/90">{input.param}</span>
                      <code className="font-mono text-[0.68rem] text-mtqs-gold-light">{input.symbol}</code>
                    </div>
                    <p className="mt-1.5 text-[0.68rem] text-white/55 leading-relaxed">{input.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* §19.3.2 steps */}
            <div>
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75 mb-2">
                §19.3.2 · the eight-step on-chain sequence
              </div>
              <ol className="space-y-3 max-h-96 overflow-y-auto mtqs-scroll pr-1">
                {REDEEM_STEPS.map((step, i) => (
                  <li key={step.title} className="flex gap-3">
                    <span className="h-6 w-6 shrink-0 rounded-full border border-mtqs-gold/30 bg-mtqs-gold/5 flex items-center justify-center text-[0.68rem] font-mono font-semibold text-mtqs-gold-light">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[0.8rem] font-medium text-white/90">{step.title}</div>
                      <p className="text-[0.72rem] text-white/55 leading-relaxed">{step.body}</p>
                      {step.formula ? (
                        <code className="mt-1.5 inline-block rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.68rem] text-mtqs-gold-light">
                          {step.formula}
                        </code>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[0.68rem] text-white/45 leading-relaxed">
                The full-basket branch emits <code className="font-mono text-[0.65rem] text-mtqs-gold-light">Redeemed(user, mtqBurned, valueOut, assetAmounts)</code>;
                the router branch emits <code className="font-mono text-[0.65rem] text-mtqs-gold-light">RedeemedSingle(user, mtqBurned, valueOut, outputAsset)</code> —
                both feed the transparency layer (§24.4). The full-basket release doctrine is §19.6.2 (below).
              </p>
            </div>
          </Panel>
        </Reveal>
      </Block>

      {/* §19.4.2 — redemption slippage guard */}
      <Block
        id="redeem-slippage"
        icon={SlidersHorizontal}
        title="Slippage guard — §19.4.2 (single-asset router)"
        sub="If the user chooses single-asset redemption, the DEX router provides a quote for converting the released basket into the chosen asset — and the guard compares what the route actually realizes against the canonical price."
      >
        <Reveal>
          <Panel className="p-4 sm:p-5 space-y-4">
            <div className="rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-white/45 mb-1.5">
                router revert condition
              </div>
              <code className="font-mono text-[0.78rem] text-mtqs-gold-light">
                {"revert if ExecPrice < OraclePrice × (1 − τ_user)"}
              </code>
            </div>
            <ul className="space-y-2 text-[0.72rem] text-white/55 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-mtqs-gold shrink-0" aria-hidden="true">·</span>
                <span>
                  <strong className="text-white/80">ExecPrice</strong> is the effective price actually
                  realized by the router swap (value out divided by value in);{" "}
                  <strong className="text-white/80">OraclePrice</strong> is the canonical price for the
                  same conversion implied by the aggregator of Ch 17. τ_user again defaults to 0.005 (0.5%).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-mtqs-gold shrink-0" aria-hidden="true">·</span>
                <span>
                  For <strong className="text-white/80">full-basket</strong> redemption no conversion
                  occurs, so the guard takes the simpler minAssetOut form of §19.3.2: the transaction
                  reverts if the net redemption value — or the aggregate value of the released basket at
                  canonical prices — falls below the user&apos;s declared minimum.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-mtqs-gold shrink-0" aria-hidden="true">·</span>
                <span>
                  SlippageWarning (Listing 11) is emitted whenever a guard binds, so the frequency of
                  binding guards is itself observable in the transparency layer (§24.4).
                </span>
              </li>
            </ul>
          </Panel>
        </Reveal>
      </Block>

      {/* §21.4 — state-dependent fee table */}
      <Block
        id="redeem-fees"
        icon={Percent}
        title="State-dependent fees — §21.4"
        sub="The redemption row of the state-dependent action matrix: fees rise from 0.15% (S1–S2) to 0.50% (S3) and 1.00% (S4), redemptions pause in S5, and S6 re-admits them at 0.30% — an anti-run circuit that prices liquidity demand by the state that demands it."
      >
        <Reveal>
          <Panel className="p-4 sm:p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[0.6rem] uppercase tracking-[0.22em] text-white/45">
                    <th className="py-2 pr-4 font-normal">State</th>
                    <th className="py-2 pr-4 font-normal">Redemption</th>
                    <th className="py-2 pr-4 font-normal">Fee</th>
                    <th className="py-2 font-normal">Note</th>
                  </tr>
                </thead>
                <tbody className="text-[0.72rem]">
                  {FEE_TABLE.map((row) => {
                    const fee = REDEEM_FEE_BY_STATUS[row.state];
                    const isCurrent = status === row.state;
                    const isEmergency = row.state === "EMERGENCY";
                    return (
                      <tr
                        key={row.state}
                        className={`border-t ${
                          isCurrent
                            ? "border-mtqs-amber/40 bg-mtqs-amber/5"
                            : isEmergency
                            ? "border-mtqs-rose/20 bg-mtqs-rose/5"
                            : "border-white/[0.06]"
                        }`}
                      >
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <span className="font-mono text-mtqs-gold-light">{row.slot}</span>{" "}
                          <span className="text-white/90">{row.state}</span>
                          {isCurrent ? (
                            <Pill tone="amber" className="ml-2">
                              <GlowDot color="amber" size="h-1.5 w-1.5" />
                              current
                            </Pill>
                          ) : null}
                        </td>
                        <td className="py-2.5 pr-4">
                          {row.action === "PAUSED" ? (
                            <span className="text-mtqs-rose">PAUSED</span>
                          ) : (
                            <span className="text-white/80">{row.action}</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 font-mono tabular-nums text-mtqs-gold-light">
                          {fee === null ? "—" : `${(fee * 100).toFixed(2)}%`}
                        </td>
                        <td className="py-2.5 text-white/55">
                          {isEmergency
                            ? "Redemption paused; REDEEM_FEE_EMERGENCY is retained only as the legacy Listing-13 constant and is never charged."
                            : row.state === "STRESS" || row.state === "DEFENSIVE"
                            ? "Elevated fee leans against exit demand while the reserve most needs protection."
                            : row.state === "RECOVERY"
                            ? "Re-admission at a reduced fee as the state machine heals."
                            : "Normal-state default fee (Monetary layer — DAO 51% tunable, §22.3)."}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[0.68rem] text-white/45 leading-relaxed">
              Fee values are imported from the pilot constants module (REDEEM_FEE_NORMAL / _STRESS / _DEFENSIVE / _RECOVERY) —
              nothing in the table is hand-typed. The effective rate is applied by the minting and
              redemption contracts (Ch 19); the matrix itself is §21.4.
            </p>
          </Panel>
        </Reveal>
      </Block>

      {/* §19.6.2 — full-basket release doctrine (amber note) */}
      <Block
        id="redeem-basket-doctrine"
        icon={ShieldAlert}
        title="The exit is the basket — §19.6.2"
        sub="Why the default redemption is the full proportional basket rather than a single currency."
      >
        <Reveal>
          <div className="rounded-lg border border-mtqs-amber/25 bg-mtqs-amber/[0.04] p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-mtqs-amber shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-2">
                <p className="text-[0.78rem] text-amber-100/90 leading-relaxed">
                  <strong className="text-amber-100">
                    Redemption releases the FULL proportional basket — never a USD redemption promise.
                  </strong>{" "}
                  The default redemption gives the user all fiat exposures plus gold, in proportion to
                  the current reserve composition, so the holder exits with the same diversified exposure
                  the unit represented while held. A single-currency settlement would silently re-impose
                  USD (or any other currency) risk at the exit door.
                </p>
                <p className="text-[0.72rem] text-amber-100/75 leading-relaxed">
                  The single-asset router is a user convenience that adds a market conversion on top of
                  this default; the conversion cost and the router slippage guard are borne by the
                  requesting user — never by the reserve.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </Block>
    </div>
  );
}
