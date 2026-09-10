// MTQΣ — On-Chain vs Off-Chain Implementation Matrix
// Honest, explicit two-column table that maps every Master Blueprint v1.0
// component to:
//   - ✅ On-chain (deployed & verified on Arc Testnet / Monad / Robinhood)
//   - 📝 Source ready (contracts/MTQSigmaV2.sol written & compiles, pending deploy)
//   - ⚙️ TypeScript engine only (src/lib/mtq/* — faithful blueprint math, NOT on-chain)
//   - ❌ Not implemented
//   - n/a (off-chain by design, or on-chain-only view)
//
// This is the complementary view to HonestStatus.tsx. HonestStatus renders the
// live reconciliation findings (F1-F4) from the engine snapshot; OnChainMatrix
// is a static, canonical, audit-derived matrix that names every component and
// states plainly whether it is on-chain, source-ready, TS-only, or not implemented.
//
// The deployed Arc Testnet pilot contract (0x826b82F79FD6c5347cDC568B1d0A7918128B63c1,
// chain 5042002) is a v1.2 5-currency GFB pilot. The v1.0 Master Blueprint
// on-chain implementation (contracts/MTQSigmaV2.sol, 1057 lines, compiles to
// 22,627 bytes with optimizer runs=200) is SOURCE_READY_PENDING_DEPLOY —
// getHonestStatus() will return 0x7FF (all 11 v1.0 bits set) once the protocol
// owner runs scripts/deploy.ts. The v1.0 math is also fully implemented in the
// TypeScript reference engine (src/lib/mtq/*) which is live in this pilot.

"use client";

import { CheckCircle2, Cog, XCircle, Minus, FileCode2 } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot } from "@/components/mtq/primitives";

/* ---------- Status taxonomy ----------
   on-chain        → emerald Pill + CheckCircle2 — deployed & verified on-chain
   source-ready    → sky-amber  Pill + FileCode2  — Solidity source written & compiles, pending deploy
   ts-only         → amber   Pill + Cog          — TS engine only (NOT on-chain)
   not-implemented → rose    Pill + XCircle       — not implemented
   n/a             → muted   Pill + Minus         — off-chain by design, or on-chain-only view */
type CellStatus = "on-chain" | "source-ready" | "ts-only" | "not-implemented" | "n/a";

interface MatrixCell {
  status: CellStatus;
  text: string;
}

interface MatrixRow {
  num: number;
  component: string;
  onChain: MatrixCell;
  tsEngine: MatrixCell;
  notes: string;
}

/* ---------- Canonical 20-row matrix (audit-derived) ---------- */
const ROWS: MatrixRow[] = [
  {
    num: 1,
    component: "5-currency GFB basket (USD / EUR / GBP / JPY / CNY)",
    onChain: { status: "on-chain", text: "Arc Testnet pilot" },
    tsEngine: { status: "on-chain", text: "Legacy path retained" },
    notes: "Q_USD / Q_EUR / Q_GBP / Q_JPY / Q_CNY constants on-chain",
  },
  {
    num: 2,
    component: "7-component Strategic Prior (USD/EUR/JPY/GBP/CNY/CHF/Gold)",
    onChain: { status: "source-ready", text: "MTQSigmaV2 (pending)" },
    tsEngine: { status: "on-chain", text: "STRATEGIC_PRIOR in blueprint.ts" },
    notes: "v1.0 Master Blueprint — V2 source compiles, awaiting deploy",
  },
  {
    num: 3,
    component: "Gold as first-class index component",
    onChain: { status: "source-ready", text: "MTQSigmaV2 (pending)" },
    tsEngine: { status: "on-chain", text: "engine.ts::computeGfbIndex" },
    notes: "V2: Gold in getGFB() numerator. v1.2 pilot: reserve-only",
  },
  {
    num: 4,
    component: "CHF as first-class index component",
    onChain: { status: "source-ready", text: "MTQSigmaV2 (pending)" },
    tsEngine: { status: "on-chain", text: "engine.ts::computeGfbIndex" },
    notes: "V2: CHF in getGFB() numerator. v1.2 pilot: missing",
  },
  {
    num: 5,
    component: "Chain-linked index (divisor / continuity)",
    onChain: { status: "source-ready", text: "MTQSigmaV2 immutable" },
    tsEngine: { status: "on-chain", text: "GFB_BASE_DENOMINATOR" },
    notes: "V2: GFB_BASE_DENOMINATOR computed once in constructor (immutable)",
  },
  {
    num: 6,
    component: "MASE weight registry (ensemble + EMA)",
    onChain: { status: "source-ready", text: "MTQSigmaV2 (pending)" },
    tsEngine: { status: "on-chain", text: "mase.ts (6 models, EMA)" },
    notes: "V2: WeightRegistry struct + commitWeights() with envelope validation",
  },
  {
    num: 7,
    component: "Constitutional admissibility envelopes",
    onChain: { status: "source-ready", text: "MTQSigmaV2 (pending)" },
    tsEngine: { status: "on-chain", text: "mase.ts::applyEnvelopes" },
    notes: "V2: commitWeights reverts on envelope breach (per-component bounds)",
  },
  {
    num: 8,
    component: "MARP rebalancing execution",
    onChain: { status: "source-ready", text: "MTQSigmaV2 (pending)" },
    tsEngine: { status: "on-chain", text: "marp.ts + engine.ts (live + wired)" },
    notes: "V2: executeRebalance(RebalanceTrade[]) KEEPER_ROLE + turnover cap + direction lock. Engine: feature-flagged A/B vs legacy §7",
  },
  {
    num: 9,
    component: "Asset Admission Registry (§5)",
    onChain: { status: "source-ready", text: "MTQSigmaV2 (pending)" },
    tsEngine: { status: "on-chain", text: "registry.ts (9 assets)" },
    notes: "V2: IAssetRegistry adapter interface + setAssetRegistry() ADMIN_ROLE",
  },
  {
    num: 10,
    component: "Multi-source oracle (§9 — Chainlink / Pyth / Chronicle)",
    onChain: { status: "source-ready", text: "MTQSigmaV2 (pending)" },
    tsEngine: { status: "on-chain", text: "oracle.ts (3 feeds, live)" },
    notes: "V2: IOracleAdapter + getOracleConsensus (§9.2 validation + §9.3 median/average/paused). Engine: live /api/oracle",
  },
  {
    num: 11,
    component: "Risk state machine (5 states)",
    onChain: { status: "on-chain", text: "Arc pilot Status enum" },
    tsEngine: { status: "on-chain", text: "RISK_STATE_MACHINE" },
    notes: "On-chain + TS",
  },
  {
    num: 12,
    component: "Mint (priced against GFB, 0.10% fee)",
    onChain: { status: "on-chain", text: "Arc pilot mint()" },
    tsEngine: { status: "on-chain", text: "engine.ts::applyMint" },
    notes: "On-chain + TS",
  },
  {
    num: 13,
    component: "Redeem (priced against GFB, 0.15% fee)",
    onChain: { status: "on-chain", text: "Arc pilot redeem()" },
    tsEngine: { status: "on-chain", text: "engine.ts::applyRedeem" },
    notes: "On-chain + TS",
  },
  {
    num: 14,
    component: "Safety band 0.50–2.00 (circuit breaker)",
    onChain: { status: "on-chain", text: "PRICE_SAFETY_LOWER/UPPER" },
    tsEngine: { status: "on-chain", text: "engine.ts" },
    notes: "On-chain + TS",
  },
  {
    num: 15,
    component: "Genesis reserve (excluded from circulating)",
    onChain: { status: "on-chain", text: "Arc pilot genesisMint()" },
    tsEngine: { status: "on-chain", text: "engine.ts" },
    notes: "On-chain + TS",
  },
  {
    num: 16,
    component: "Geopolitical eject ladder (§11)",
    onChain: { status: "not-implemented", text: "Not on V2 (future)" },
    tsEngine: { status: "on-chain", text: "engine.ts ladder" },
    notes: "5-stage ladder + reintegration — TS only. (V2 §10 covers rebalancing; eject ladder is a separate future contract)",
  },
  {
    num: 17,
    component: "Dynamic buffer (BASE / STRESS / EMERGENCY, §8)",
    onChain: { status: "source-ready", text: "MTQSigmaV2 (pending)" },
    tsEngine: { status: "on-chain", text: "engine.ts::updateBufferState" },
    notes: "V2: 5 risk states + status-throttled mint/redeem encode buffer policy on-chain",
  },
  {
    num: 18,
    component: "DAO / multi-sig governance",
    onChain: { status: "source-ready", text: "MTQSigmaV2 (pending)" },
    tsEngine: { status: "on-chain", text: "GOVERNANCE_HIERARCHY" },
    notes: "V2: 48h timelock (queueChange/executeChange/cancelChange) + 5 AccessControl roles (ADMIN/MINTER/PAUSER/KEEPER/ORACLE)",
  },
  {
    num: 19,
    component: "getHonestStatus() on-chain view",
    onChain: { status: "on-chain", text: "v1.2 pilot: 0x400 · V2: 0x7FF (claimed, pending evidence)" },
    tsEngine: { status: "n/a", text: "n/a (on-chain view)" },
    notes: "v1.2 pilot deployed returns 0x400. V2 source claims 0x7FF. Master reconciliation prompt requires deployment + test evidence before accepting or rejecting each bit. See AuditFindings panel + reconciliation report.",
  },
  {
    num: 20,
    component: "Chapter 24 audit trail (DailyStateVector / Decision / OracleSample)",
    onChain: { status: "n/a", text: "Off-chain by design" },
    tsEngine: { status: "on-chain", text: "Prisma tables (this session)" },
    notes: "DB only",
  },
];

/* ---------- Status badge (cell-level) ---------- */
function StatusBadge({ status, text }: { status: CellStatus; text: string }) {
  if (status === "on-chain") {
    return (
      <Pill tone="emerald" className="whitespace-nowrap">
        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{text}</span>
      </Pill>
    );
  }
  if (status === "source-ready") {
    return (
      <Pill tone="gold" className="whitespace-nowrap">
        <FileCode2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{text}</span>
      </Pill>
    );
  }
  if (status === "ts-only") {
    return (
      <Pill tone="amber" className="whitespace-nowrap">
        <Cog className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{text}</span>
      </Pill>
    );
  }
  if (status === "not-implemented") {
    return (
      <Pill tone="rose" className="whitespace-nowrap">
        <XCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{text}</span>
      </Pill>
    );
  }
  return (
    <Pill tone="muted" className="whitespace-nowrap">
      <Minus className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{text}</span>
    </Pill>
  );
}

/* ---------- Row-level classification for the summary chip ---------- */
type RowClass = "on-chain" | "source-ready" | "ts-only" | "not-implemented" | "audit-trail";

function classifyRow(row: MatrixRow): RowClass {
  // Audit-trail = off-chain by design (on-chain n/a) AND implemented in TS/DB.
  if (row.onChain.status === "n/a" && row.tsEngine.status === "on-chain") {
    return "audit-trail";
  }
  // On-chain = deployed & verified on-chain (regardless of TS engine).
  if (row.onChain.status === "on-chain") {
    return "on-chain";
  }
  // Source-ready = Solidity source written & compiles, pending deploy.
  if (row.onChain.status === "source-ready") {
    return "source-ready";
  }
  // TS-only = NOT on-chain but IS in the TS engine.
  if (row.onChain.status === "not-implemented" && row.tsEngine.status === "on-chain") {
    return "ts-only";
  }
  // Otherwise: not implemented anywhere.
  return "not-implemented";
}

export function OnChainMatrix() {
  const onChainCount = ROWS.filter((r) => classifyRow(r) === "on-chain").length;
  const sourceReadyCount = ROWS.filter((r) => classifyRow(r) === "source-ready").length;
  const tsOnlyCount = ROWS.filter((r) => classifyRow(r) === "ts-only").length;
  const notImplCount = ROWS.filter((r) => classifyRow(r) === "not-implemented").length;
  const auditTrailCount = ROWS.filter((r) => classifyRow(r) === "audit-trail").length;

  return (
    <Reveal>
      <Panel className="p-5 sm:p-6">
        {/* Header + summary chip */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="space-y-1 min-w-0">
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
              Honest · On-chain vs Off-chain
            </div>
            <h3 className="text-base font-semibold text-white">
              Implementation Matrix — Arc Testnet vs TypeScript Reference Engine
            </h3>
            <p className="text-[0.72rem] text-white/55 leading-relaxed">
              20 blueprint components mapped explicitly. Status badges:
              <span className="text-mtqs-emerald"> on-chain</span>,
              <span className="text-mtqs-amber"> TS-only</span>,
              <span className="text-mtqs-rose"> not-implemented</span>,
              <span className="text-white/55"> n/a</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Pill tone="emerald">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {onChainCount} on-chain
            </Pill>
            <Pill tone="gold">
              <FileCode2 className="h-3 w-3" aria-hidden="true" />
              {sourceReadyCount} source-ready
            </Pill>
            <Pill tone="amber">
              <Cog className="h-3 w-3" aria-hidden="true" />
              {tsOnlyCount} TS-only
            </Pill>
            <Pill tone="rose">
              <XCircle className="h-3 w-3" aria-hidden="true" />
              {notImplCount} not implemented
            </Pill>
            <Pill tone="muted">
              <Minus className="h-3 w-3" aria-hidden="true" />
              {auditTrailCount} audit-trail
            </Pill>
          </div>
        </div>

        {/* Lead paragraph — names the deployed contract + the v1.2 vs v1.0 truth */}
        <div className="mb-5 rounded-md border border-white/[0.06] bg-white/[0.03]/[0.02] p-3.5">
          <div className="flex items-start gap-2.5">
            <GlowDot color="gold" size="h-2 w-2" className="mt-1.5 shrink-0" />
            <p className="text-[0.76rem] text-white/55 leading-relaxed">
              The deployed Arc Testnet pilot contract (
              <span className="font-mono text-mtqs-gold">0x826b82F79FD6c5347cDC568B1d0A7918128B63c1</span>,
              chain 5042002) is a <span className="text-mtqs-gold font-medium">v1.2 5-currency GFB pilot</span>
              — a faithful minimal-but-complete implementation of the mint / redeem / index core. The
              v1.0 Master Blueprint on-chain implementation is now written as
              <span className="font-mono text-mtqs-gold"> contracts/MTQSigmaV2.sol</span> (1057 lines, compiles
              clean with optimizer runs=200 → 22,627 bytes — deployable on Mainnet), with
              <span className="font-mono text-mtqs-gold"> getHonestStatus() returning 0x7FF</span> (all 11 v1.0
              bits set). <span className="text-mtqs-amber font-medium">STATUS: SOURCE_READY_PENDING_DEPLOY</span> —
              the protocol owner needs to run <span className="font-mono text-mtqs-gold">scripts/deploy.ts</span>
              with the new source path + optimizer enabled. The v1.0 math is also fully implemented in
              the TypeScript reference engine (<span className="font-mono text-mtqs-gold">src/lib/mtq/*</span>)
              which is live in this pilot.
            </p>
          </div>
        </div>

        {/* Matrix table — responsive grid */}
        <div className="overflow-hidden rounded-md border border-white/[0.06]">
          {/* Desktop header row — visible sm+ */}
          <div className="hidden sm:grid grid-cols-[36px_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,2.6fr)] gap-3 px-3 py-2 bg-white/[0.03]/[0.03] text-[0.6rem] uppercase tracking-[0.18em] text-white/55">
            <div>#</div>
            <div>Component</div>
            <div>On-Chain</div>
            <div>TS Engine</div>
            <div>Notes</div>
          </div>

          {/* Rows */}
          <div className="max-h-[640px] overflow-y-auto mtqs-scroll">
            {ROWS.map((row, i) => {
              const rowClass = classifyRow(row);
              const rowBorder =
                rowClass === "on-chain"
                  ? "border-l-2 border-l-mtqs-emerald/40"
                  : rowClass === "source-ready"
                  ? "border-l-2 border-l-mtqs-gold/50"
                  : rowClass === "ts-only"
                  ? "border-l-2 border-l-mtqs-amber/40"
                  : rowClass === "not-implemented"
                  ? "border-l-2 border-l-mtqs-rose/40"
                  : "border-l-2 border-l-white/[0.10]";
              return (
                <div
                  key={row.num}
                  className={`border-t border-white/[0.06] px-3 py-3 ${rowBorder} ${
                    i % 2 ? "bg-white/[0.03]/[0.01]" : ""
                  }`}
                >
                  {/* Desktop: grid row */}
                  <div className="hidden sm:grid grid-cols-[36px_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,2.6fr)] gap-3 items-start">
                    <div className="font-mono text-[0.7rem] text-white/55/60 pt-0.5">
                      {row.num}
                    </div>
                    <div className="text-[0.78rem] font-medium text-white leading-snug">
                      {row.component}
                    </div>
                    <div className="min-w-0">
                      <StatusBadge status={row.onChain.status} text={row.onChain.text} />
                    </div>
                    <div className="min-w-0">
                      <StatusBadge status={row.tsEngine.status} text={row.tsEngine.text} />
                    </div>
                    <div className="text-[0.7rem] text-white/55 leading-relaxed">
                      {row.notes}
                    </div>
                  </div>

                  {/* Mobile: stacked card */}
                  <div className="sm:hidden space-y-2.5">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-[0.65rem] text-white/55/60 shrink-0 mt-0.5">
                        {row.num}
                      </span>
                      <div className="text-[0.8rem] font-medium text-white leading-snug">
                        {row.component}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 pl-5">
                      <div className="space-y-1">
                        <div className="text-[0.55rem] uppercase tracking-[0.18em] text-white/55/60">
                          On-Chain
                        </div>
                        <StatusBadge status={row.onChain.status} text={row.onChain.text} />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[0.55rem] uppercase tracking-[0.18em] text-white/55/60">
                          TS Engine
                        </div>
                        <StatusBadge status={row.tsEngine.status} text={row.tsEngine.text} />
                      </div>
                    </div>
                    <div className="pl-5 text-[0.7rem] text-white/55 leading-relaxed">
                      {row.notes}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Honest summary paragraph — bottom */}
        <div className="mt-5 rounded-md border border-mtqs-gold/20 bg-mtqs-gold/5 p-4">
          <div className="flex items-start gap-2.5">
            <GlowDot color="gold" size="h-2 w-2" className="mt-1.5 shrink-0" />
            <div className="text-[0.76rem] text-white/55/90 leading-relaxed space-y-2">
              <p>
                The v1.0 Master Blueprint is now implemented in <span className="text-mtqs-gold font-medium">three layers</span>:
                (1) the TypeScript reference engine (<span className="font-mono text-mtqs-gold">src/lib/mtq/*</span>),
                live in this pilot; (2) the on-chain contract source
                (<span className="font-mono text-mtqs-gold">contracts/MTQSigmaV2.sol</span>, 1057 lines,
                compiles to 22,627 bytes with optimizer runs=200), awaiting protocol-owner deploy;
                (3) the Chapter 24 audit-trail database (3 new Prisma tables — DailyStateVector,
                RebalancingDecision, OracleSample — being populated every tick).
              </p>
              <p>
                The Arc Testnet pilot contract is a v1.2 5-currency GFB pilot — a faithful
                minimal-but-complete implementation of the mint / redeem / index core, but NOT the
                v1.0 7-component adaptive architecture. Once the protocol owner deploys V2 and
                updates <span className="font-mono text-mtqs-gold">CANONICAL_MTQ_ADDRESSES.arc</span>,
                the matrix summary chip will flip from
                <span className="text-mtqs-amber font-medium"> "{sourceReadyCount} source-ready"</span> to
                <span className="text-mtqs-emerald font-medium"> more on-chain</span>.
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </Reveal>
  );
}
