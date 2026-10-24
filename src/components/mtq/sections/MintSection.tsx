// MTQΣ — Mint Section (§19)
// Dedicated page for the "mint" nav tab (user operations). Composes:
//   1. Live stat tiles from the metrics snapshot (P_MTQ, reserve ratio,
//      circulating supply, protocol status)
//   2. The engine-backed MintSimulator (§12.1 reconciled with §19.2)
//   3. The §19.2 minting flow — user inputs + seven-step on-chain sequence
//   4. The §19.4.1 minting slippage-guard mathematics
//   5. The §19.6 critical notes (no 1:1 USD peg · pricing doctrine ·
//      on-chain-only atomicity · minimum amounts)
//   6. The §19.7 constants strip (all values imported from blueprint.ts)
//
// Honest-status tone: TESTNET ONLY · SHADOW MODE ENFORCED · RESERVE TRADING
// NOT AUTHORIZED — this page runs the simulated pilot engine; there is no
// on-chain broadcast and no real value anywhere in the loop.
//
// Props: { onNavigate, snapshot }.

"use client";

import { useCallback, useState } from "react";
import {
  Coins,
  ListOrdered,
  Scale,
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
import { MintSimulator } from "@/components/mtq/MintSimulator";
import { TruthBanner } from "@/components/mtq/TruthBanner";
import { STATUS_TONE, Block } from "@/components/mtq/status-tone";
import { fmtFixed, fmtNum } from "@/components/mtq/format";
import {
  MINT_FEE_BPS,
  MIN_MINT_MTQ,
  MIN_REDEEM_MTQ,
  DEFAULT_USER_SLIPPAGE,
  TRADE_DEADLINE_MINUTES,
} from "@/lib/mtq/blueprint";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import type { SectionId } from "@/components/mtq/Navigation";

/* ---------- Status tone + Block wrapper live in the shared status-tone
   module (extracted from the former Mint/Redeem duplication). ---------- */

/* ---------- §19.2 — user inputs ---------- */
const MINT_INPUTS = [
  {
    param: "Deposit Asset",
    symbol: "tokenIn",
    desc: "The stablecoin the user deposits (e.g. USDC, EURC). Must be admitted under the Asset Admission Registry (Ch 15).",
  },
  {
    param: "Deposit Amount",
    symbol: "X",
    desc: "The amount of tokenIn to deposit, in the token's native decimals.",
  },
  {
    param: "Slippage Tolerance",
    symbol: "τ_user",
    desc: `Maximum acceptable deviation from the quoted price (default ${(DEFAULT_USER_SLIPPAGE * 100).toFixed(1)}%).`,
  },
];

/* ---------- §19.2.2 — the seven-step minting sequence ---------- */
const MINT_STEPS = [
  {
    title: "Fee deduction",
    body: "The gross deposit is reduced by the mint fee before any pricing occurs. The fee accrues to the Operational Wallet, is not part of the reserve collateral, and is excluded from NAV (§20.4).",
    formula: "X_net = X × (1 − F_mint),  F_mint = 0.001 (0.10%)",
  },
  {
    title: "Fetch the current MTQ reference price",
    body: "The contract reads the reference price from the chain-linked index (§9.8, Listing 3). The component fixings feeding I_t are sourced from the canonical aggregator (Ch 17), so no single market venue can move the mint quote.",
    formula: "P_MTQ,t = I_t / I_base",
  },
  {
    title: "Compute the minted amount",
    body: "This step is where the not-a-dollar principle is enforced: if P_MTQ,t = 1.12 the user receives X_net / 1.12 tokens, not X_net tokens — the token count flexes so the value claim is preserved (invariant I5, §2.6).",
    formula: "MTQ_minted = X_net / P_MTQ,t",
  },
  {
    title: "Atomic swap execution",
    body: "The deposited stablecoin is swapped into the FULL reserve basket in a single atomic transaction through the DEX aggregator. Under v2.0 the purchased split is the live weight vector W_t published by the MASE weight registry — no percentage is hard-coded (the v1.2 80/20 fiat/gold tables survive only as lineage).",
    formula: null,
  },
  {
    title: "Slippage guard",
    body: "The user sets minMTQOut — the minimum number of MTQ tokens they are willing to accept. If the actual minted amount would be less than minMTQOut, the transaction reverts (§19.4.1).",
    formula: null,
  },
  {
    title: "Mint tokens",
    body: "The contract mints MTQ_minted to the user's wallet. The mint increases both the reserve assets (purchased above) and the token liability by construction, so the operation is collateral-neutral at the moment of completion — circulating supply rises with the reserve.",
    formula: null,
  },
  {
    title: "Update reserve state",
    body: "The reserve state is updated to reflect the new assets and liabilities (Ch 18), keeping the reserve-ratio and liquidity-coverage measurements current for the next operation.",
    formula: null,
  },
];

/* ---------- §19.6 — critical notes ---------- */
const MINT_NOTES = [
  {
    ref: "§19.6.1",
    title: "Minting does NOT create a 1:1 USD peg",
    body: "MTQ_minted = X_net / P_MTQ,t means the token count delivered for a given deposit moves inversely with the reference price: 1,000 USDC yields ≈ 892.86 MTQ at P = 1.12 but ≈ 1,086.96 MTQ at P = 0.92. This is intentional — the user receives the purchasing-power equivalent of the deposit, not a fixed number of tokens. The mirror image holds at redemption (priced against NAV_t), so a holder never redeems a frozen 1:1 amount either.",
  },
  {
    ref: "§19.1",
    title: "Pricing doctrine — index in, NAV out",
    body: "Minting is priced against the adaptive index (invariant I5); redemption is priced against NAV (invariant I6). All operations are atomic, all outputs are slippage-protected, and every price in a quote comes from the canonical multi-source aggregator (Ch 17) rather than any single market feed. Mint and redeem flows are the protocol's natural cash flows — MARP nets them against required weight corrections before any external trade (§10.7, Ch 11).",
  },
  {
    ref: "§19.6.3",
    title: "Atomicity is on-chain only",
    body: "\"Atomic\" refers to on-chain transaction atomicity: the entire mint is one blockchain transaction, and if any step fails the whole transaction reverts with no partial state change. External dependencies — the DEX aggregator, the oracle feeds — may still introduce latency or failure modes of their own (a stale feed, a route that cannot fill within the deadline); the failure mode of every external dependency is a clean revert, never a partially executed mint.",
  },
  {
    ref: "§19.6.4",
    title: "Minimum amounts",
    body: "MIN_MINT and MIN_REDEEM prevent dust transactions that would waste gas and clutter the reserve state; both are 1 MTQ. The blueprint records a discrepancy (governance-adjustable in BP §12.6.4 vs constitutional-immutable in BP §12.7) and resolves it by declaring them compile-time constants — any change requires a governance-approved redeployment. The stricter reading is normative.",
  },
];

export function MintSection({
  onNavigate: _onNavigate,
  snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  // Simulator plumbing (§12.1 contract): the simulators own their chain /
  // wallet selectors and expect an after-trial callback. There is no trial
  // list on this page — the Activity/Trial ledger owns the display — so the
  // callback is a documented no-op.
  const [chain, setChain] = useState("monad");
  const [wallet, setWallet] = useState("");
  const onAfterTrial = useCallback(() => {
    /* trial ledger refresh is out of scope for this page */
  }, []);

  const status = snapshot?.status ?? null;
  const tone = status ? STATUS_TONE[status] : null;

  return (
    <div className="space-y-10">
      {/* Page heading + live status pill */}
      <SectionHeading
        eyebrow="§19 · user operations"
        title="Mint MTQΣ"
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

      {/* Amber truth banner (shared component — TESTNET ONLY · SHADOW MODE
          ENFORCED · RESERVE TRADING NOT AUTHORIZED). Rendered as a plain div
          inside TruthBanner (not a Panel) because .mtqs-glass is unlayered CSS
          that would override the amber border/background utilities. */}
      <Reveal>
        <TruthBanner>
          <p className="text-[0.75rem] text-amber-100/90 leading-relaxed">
            This mint page runs the <strong className="text-amber-100">simulated pilot engine</strong> —
            no on-chain broadcast, no real value. The simulator posts to the pilot&apos;s
            /api/simulate/mint endpoint, which applies the §19.2 quote and the §19.7 guards against
            the live snapshot and records the run in the trial ledger. Nothing here mints a real token.
          </p>
        </TruthBanner>
      </Reveal>

      {/* Live stat tiles — every value comes from the snapshot prop */}
      <Reveal delay={0.05}>
        <Panel className="p-4 sm:p-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="P_MTQ · reference price"
              value={<TickNumber value={snapshot?.mtqPrice ?? null} format={(n) => fmtFixed(n, 4)} />}
              sub="chain-linked index I_t / I_base · §9.8"
            />
            <Stat
              label="Reserve ratio"
              value={<TickNumber value={snapshot?.reserveRatio ?? null} format={(n) => fmtFixed(n, 4)} />}
              sub="reserve ÷ liability · live"
            />
            <Stat
              label="Circulating supply"
              value={<TickNumber value={snapshot?.circulatingSupply ?? null} format={(n) => fmtNum(n)} />}
              sub="excludes Genesis Reserve · §20.1.4"
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
              sub="risk state machine §21 — gates minting"
            />
          </div>
        </Panel>
      </Reveal>

      {/* Live simulator */}
      <Block
        id="mint-simulator"
        icon={Coins}
        title="Live mint simulator"
        sub="Deposit USDC → the engine quotes MTQ_minted = X·(1−fee)/P_MTQ against the live snapshot, applies the §19.7 minimum and slippage guards, and records the run."
      >
        <Reveal>
          <Panel className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
                §12.1 · reconciled with §19.2
              </div>
              <Pill tone="emerald">
                <GlowDot color="emerald" size="h-1.5 w-1.5" />
                engine-backed
              </Pill>
            </div>
            <MintSimulator
              snapshot={snapshot}
              chain={chain}
              setChain={setChain}
              wallet={wallet}
              setWallet={setWallet}
              onAfterTrial={onAfterTrial}
            />
            <p className="mt-3 text-[0.65rem] text-white/45 leading-relaxed">
              Every run is recorded in the pilot trial ledger (SQLite). No wallet signature is ever
              requested — the pilot engine does not broadcast transactions. Oracle pause (§9.3) or an
              elevated risk state (§21.3) suspends the mint path exactly as the contract would.
            </p>
          </Panel>
        </Reveal>
      </Block>

      {/* §19.2 — step-by-step minting */}
      <Block
        id="mint-flow"
        icon={ListOrdered}
        title="How minting works — §19.2 step-by-step"
        sub="One admitted stablecoin in, the full reserve basket purchased, MTQΣ out — a single atomic transaction with the quote fixed by invariant I5."
      >
        <Reveal>
          <Panel className="p-4 sm:p-5 space-y-4">
            {/* 16f-008: the §19.2 walkthrough documents the legacy v1/v2
                reserve-funded engine path as implemented in the pilot. */}
            <div className="rounded-md border border-mtqs-amber/25 bg-amber-400/[0.04] px-3 py-2 text-[0.68rem] leading-relaxed text-white/60">
              <span className="font-semibold text-mtqs-amber">Legacy v1/v2 pilot-ledger path.</span>{" "}
              The steps below document the reserve-funded engine path as implemented; the v3.0
              no-conventional-reserve objective (payment-funded issuance) supersedes it — Gate B
              open (D-13.3–D-13.7).
            </div>
            {/* §19.2.1 user inputs */}
            <div>
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75 mb-2">
                §19.2.1 · user inputs
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {MINT_INPUTS.map((input) => (
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

            {/* §19.2.2 steps */}
            <div>
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75 mb-2">
                §19.2.2 · the seven-step on-chain sequence
              </div>
              <ol className="space-y-3 max-h-96 overflow-y-auto mtqs-scroll pr-1">
                {MINT_STEPS.map((step, i) => (
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
                On success the operation emits <code className="font-mono text-[0.65rem] text-mtqs-gold-light">Minted(user, tokenIn, amountIn, mtqMinted, mtqPrice)</code>,
                and <code className="font-mono text-[0.65rem] text-mtqs-gold-light">SlippageWarning</code> whenever
                a guard binds — both events feed the transparency and audit layer (§24.4). Reference
                implementation: Listing 11 (§19.5).
              </p>
            </div>
          </Panel>
        </Reveal>
      </Block>

      {/* §19.4.1 — slippage guard mathematics */}
      <Block
        id="mint-slippage"
        icon={SlidersHorizontal}
        title="Slippage guard mathematics — §19.4.1"
        sub="Quotes are computed before execution, but the swap legs inside the transaction still face price movement between quote and fill — the guard bounds the loss to a pre-declared tolerance, at the cost of a revert."
      >
        <Reveal>
          <Panel className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                <div className="text-[0.6rem] uppercase tracking-[0.22em] text-white/45 mb-1.5">
                  revert condition
                </div>
                <code className="font-mono text-[0.78rem] text-mtqs-gold-light">
                  {"revert if MTQ_minted < minMTQOut"}
                </code>
                <p className="mt-2 text-[0.68rem] text-white/55 leading-relaxed">
                  The user sets minMTQOut — the minimum number of MTQ tokens they are willing to accept.
                  If the actual minted amount would be less, the whole transaction reverts.
                </p>
              </div>
              <div className="rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
                <div className="text-[0.6rem] uppercase tracking-[0.22em] text-white/45 mb-1.5">
                  default guard from the quote
                </div>
                <code className="font-mono text-[0.78rem] text-mtqs-gold-light">
                  {"minMTQOut_default = (X_net / P_MTQ,t) × (1 − τ_user)"}
                </code>
                <p className="mt-2 text-[0.68rem] text-white/55 leading-relaxed">
                  When the user does not supply an explicit value, the contract and front-ends derive it
                  from the current quote and the declared tolerance.
                </p>
              </div>
            </div>
            <ul className="space-y-2 text-[0.72rem] text-white/55 leading-relaxed">
              <li className="flex gap-2">
                <span className="text-mtqs-gold shrink-0" aria-hidden="true">·</span>
                <span>
                  τ_user defaults to <code className="font-mono text-[0.68rem] text-mtqs-gold-light">0.005 (0.5%)</code> —
                  the DEFAULT_SLIPPAGE constant of Listing 11. A user may always tighten the guard below
                  the default (for example to 0.1% around a large deposit).
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-mtqs-gold shrink-0" aria-hidden="true">·</span>
                <span>
                  The guard interacts with the {TRADE_DEADLINE_MINUTES}-minute trade deadline (§19.7): if the
                  transaction is not mined within the deadline, the aggregator call itself fails and the
                  whole operation reverts.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-mtqs-gold shrink-0" aria-hidden="true">·</span>
                <span>
                  Why guards exist: the aggregator routes through venues whose prices can drift while the
                  transaction is in flight, and the oracle itself can refresh between quote and fill. A
                  binding guard emits SlippageWarning so the frequency of binding guards is itself
                  observable in the transparency layer (§24.4).
                </span>
              </li>
            </ul>
          </Panel>
        </Reveal>
      </Block>

      {/* §19.6 — critical notes */}
      <Block
        id="mint-notes"
        icon={Scale}
        title="Critical notes — §19.6"
        sub="Four properties of the entry/exit layer that are frequently misunderstood; each restates a rule already enforced by the code of Listing 11."
      >
        <Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MINT_NOTES.map((note) => (
              <Panel key={note.ref} className="p-4 h-full">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-[0.8rem] font-semibold text-white/90">{note.title}</div>
                  <Pill tone="gold">{note.ref}</Pill>
                </div>
                <p className="text-[0.72rem] text-white/55 leading-relaxed">{note.body}</p>
              </Panel>
            ))}
          </div>
        </Reveal>
      </Block>

      {/* §19.7 — constants strip (values imported from blueprint.ts) */}
      <Block
        id="mint-constants"
        icon={SlidersHorizontal}
        title="Constants — §19.7"
        sub="Developer-facing constants of the entry/exit layer. Values are imported from the pilot's blueprint constants module — nothing on this strip is hand-typed."
      >
        <Reveal>
          <Panel className="p-4 sm:p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Stat
                label="Mint fee"
                value={`${(MINT_FEE_BPS / 100).toFixed(2)}%`}
                sub={`F_mint · ${MINT_FEE_BPS} bps · Monetary · DAO 51%`}
              />
              <Stat
                label="Min mint"
                value={`${MIN_MINT_MTQ} MTQ`}
                sub="MIN_MINT · constitutional (immutable)"
              />
              <Stat
                label="Min redeem"
                value={`${MIN_REDEEM_MTQ} MTQ`}
                sub="MIN_REDEEM · constitutional (immutable)"
              />
              <Stat
                label="Default slippage"
                value={`${(DEFAULT_USER_SLIPPAGE * 100).toFixed(1)}%`}
                sub="τ_user · Risk Council (4/7)"
              />
              <Stat
                label="Trade deadline"
                value={`${TRADE_DEADLINE_MINUTES} min`}
                sub="constitutional (immutable)"
              />
              <Stat
                label="Price source"
                value="I_t / I_base"
                sub="chain-linked reference index · §9.8 + Ch 17 aggregator"
              />
            </div>
            <p className="mt-4 text-[0.68rem] text-white/45 leading-relaxed">
              F_mint is state-independent — 0.10% in every risk state (§19.7); Chapter 21 governs
              whether minting is allowed, throttled or paused, and the parameter itself is tunable
              only through the governance process of §19.7 (parameter registry §22.3 is the
              definitive mapping).
            </p>
          </Panel>
        </Reveal>
      </Block>
    </div>
  );
}
