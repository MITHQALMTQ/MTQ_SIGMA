// MTQΣ — On-Chain vs Off-Chain Implementation Matrix
// Honest, explicit two-column table that maps every Master Blueprint v1.0
// component to:
//   - ✅ On-chain (deployed & verified on Arc Testnet / Monad / Robinhood)
//   - ⚙️ TypeScript engine only (src/lib/mtq/* — faithful blueprint math, NOT on-chain)
//   - ❌ Not implemented
//   - n/a (off-chain by design, or on-chain-only view)
//
// This is the complementary view to HonestStatus.tsx. HonestStatus renders the
// live reconciliation findings (F1-F4) from the engine snapshot; OnChainMatrix
// is a static, canonical, audit-derived matrix that names every component and
// states plainly whether it is on-chain, TS-only, or not implemented.
//
// The deployed Arc Testnet pilot contract (0x826b82F79FD6c5347cDC568B1d0A7918128B63c1,
// chain 5042002) is a v1.2 5-currency GFB pilot — NOT the v1.0 7-component
// adaptive architecture. The v1.0 architecture is implemented in the TypeScript
// reference engine (src/lib/mtq/*); production deployment is the next major
// milestone.

"use client";

import { CheckCircle2, Cog, XCircle, Minus } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot } from "@/components/mtq/primitives";

/* ---------- Status taxonomy ----------
   on-chain        → emerald Pill + CheckCircle2 — deployed & verified on-chain
   ts-only         → amber   Pill + Cog          — TS engine only (NOT on-chain)
   not-implemented → rose    Pill + XCircle       — not implemented
   n/a             → muted   Pill + Minus         — off-chain by design, or on-chain-only view */
type CellStatus = "on-chain" | "ts-only" | "not-implemented" | "n/a";

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
    onChain: { status: "not-implemented", text: "Not deployed" },
    tsEngine: { status: "on-chain", text: "STRATEGIC_PRIOR in blueprint.ts" },
    notes: "v1.0 Master Blueprint",
  },
  {
    num: 3,
    component: "Gold as first-class index component",
    onChain: { status: "not-implemented", text: "Not on-chain" },
    tsEngine: { status: "on-chain", text: "engine.ts::computeGfbIndex" },
    notes: "Reserve-only on contract",
  },
  {
    num: 4,
    component: "CHF as first-class index component",
    onChain: { status: "not-implemented", text: "Not on-chain" },
    tsEngine: { status: "on-chain", text: "engine.ts::computeGfbIndex" },
    notes: "Missing on contract",
  },
  {
    num: 5,
    component: "Chain-linked index (divisor / continuity)",
    onChain: { status: "not-implemented", text: "No divisor logic" },
    tsEngine: { status: "on-chain", text: "GFB_BASE_DENOMINATOR" },
    notes: "Denominator includes CHF + Gold; contract recomputes each call",
  },
  {
    num: 6,
    component: "MASE weight registry (ensemble + EMA)",
    onChain: { status: "not-implemented", text: "No on-chain weights" },
    tsEngine: { status: "on-chain", text: "mase.ts (6 models, EMA)" },
    notes: "TS only",
  },
  {
    num: 7,
    component: "Constitutional admissibility envelopes",
    onChain: { status: "not-implemented", text: "No on-chain bounds" },
    tsEngine: { status: "on-chain", text: "mase.ts::applyEnvelopes" },
    notes: "ADMISSIBILITY_ENVELOPES — TS only",
  },
  {
    num: 8,
    component: "MARP rebalancing execution",
    onChain: { status: "not-implemented", text: "No rebalance() function" },
    tsEngine: { status: "on-chain", text: "marp.ts + engine.ts" },
    notes: "applyRebalanceTrade — TS only",
  },
  {
    num: 9,
    component: "Asset Admission Registry (§5)",
    onChain: { status: "not-implemented", text: "Hardcoded USDC" },
    tsEngine: { status: "on-chain", text: "registry.ts (9 assets)" },
    notes: "Concentration limits — TS only",
  },
  {
    num: 10,
    component: "Multi-source oracle (§9 — Chainlink / Pyth / Chronicle)",
    onChain: { status: "not-implemented", text: "Owner-settable FX" },
    tsEngine: { status: "on-chain", text: "oracle.ts (3 feeds)" },
    notes: "§9 validation, median / average — TS only",
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
    onChain: { status: "not-implemented", text: "Not on-chain" },
    tsEngine: { status: "on-chain", text: "engine.ts ladder" },
    notes: "5-stage ladder + reintegration — TS only",
  },
  {
    num: 17,
    component: "Dynamic buffer (BASE / STRESS / EMERGENCY, §8)",
    onChain: { status: "not-implemented", text: "Not on-chain" },
    tsEngine: { status: "on-chain", text: "engine.ts::updateBufferState" },
    notes: "TS only",
  },
  {
    num: 18,
    component: "DAO / multi-sig governance",
    onChain: { status: "not-implemented", text: "Owner-only" },
    tsEngine: { status: "on-chain", text: "GOVERNANCE_HIERARCHY" },
    notes: "Displayed only — TS-only concept",
  },
  {
    num: 19,
    component: "getHonestStatus() on-chain view",
    onChain: { status: "on-chain", text: "Just added (this session)" },
    tsEngine: { status: "n/a", text: "n/a (on-chain view)" },
    notes: "On-chain",
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
type RowClass = "on-chain" | "ts-only" | "not-implemented" | "audit-trail";

function classifyRow(row: MatrixRow): RowClass {
  // Audit-trail = off-chain by design (on-chain n/a) AND implemented in TS/DB.
  if (row.onChain.status === "n/a" && row.tsEngine.status === "on-chain") {
    return "audit-trail";
  }
  // On-chain = deployed & verified on-chain (regardless of TS engine).
  if (row.onChain.status === "on-chain") {
    return "on-chain";
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
            <h3 className="text-base font-semibold text-foreground/95">
              Implementation Matrix — Arc Testnet vs TypeScript Reference Engine
            </h3>
            <p className="text-[0.72rem] text-muted-foreground/70 leading-relaxed">
              20 blueprint components mapped explicitly. Status badges:
              <span className="text-[#6ff0c0]"> on-chain</span>,
              <span className="text-[#ffd07a]"> TS-only</span>,
              <span className="text-[#ff8ea3]"> not-implemented</span>,
              <span className="text-muted-foreground/80"> n/a</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <Pill tone="emerald">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {onChainCount} on-chain
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
        <div className="mb-5 rounded-md border border-white/[0.07] bg-white/[0.02] p-3.5">
          <div className="flex items-start gap-2.5">
            <GlowDot color="gold" size="h-2 w-2" className="mt-1.5 shrink-0" />
            <p className="text-[0.76rem] text-muted-foreground/85 leading-relaxed">
              The deployed Arc Testnet pilot contract (
              <span className="font-mono text-amber-200/90">0x826b82F79FD6c5347cDC568B1d0A7918128B63c1</span>,
              chain 5042002) is a <span className="text-amber-200/90 font-medium">v1.2 5-currency GFB pilot</span> — a
              faithful minimal-but-complete implementation of the mint / redeem / index core. The full
              v1.0 7-component adaptive architecture (Gold + CHF as index components, MASE, MARP,
              multi-source oracle, Asset Registry, admissibility envelopes) is implemented in the
              TypeScript reference engine (<span className="font-mono text-amber-200/90">src/lib/mtq/*</span>),
              but <span className="text-[#ff8ea3] font-medium">NOT yet deployed on-chain</span>.
              Production deployment of the v1.0 contract is the next major milestone.
            </p>
          </div>
        </div>

        {/* Matrix table — responsive grid */}
        <div className="overflow-hidden rounded-md border border-white/[0.07]">
          {/* Desktop header row — visible sm+ */}
          <div className="hidden sm:grid grid-cols-[36px_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,2.6fr)] gap-3 px-3 py-2 bg-white/[0.03] text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground/70">
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
                  : rowClass === "ts-only"
                  ? "border-l-2 border-l-mtqs-amber/40"
                  : rowClass === "not-implemented"
                  ? "border-l-2 border-l-mtqs-rose/40"
                  : "border-l-2 border-l-white/[0.10]";
              return (
                <div
                  key={row.num}
                  className={`border-t border-white/[0.05] px-3 py-3 ${rowBorder} ${
                    i % 2 ? "bg-white/[0.01]" : ""
                  }`}
                >
                  {/* Desktop: grid row */}
                  <div className="hidden sm:grid grid-cols-[36px_minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_minmax(0,2.6fr)] gap-3 items-start">
                    <div className="font-mono text-[0.7rem] text-muted-foreground/60 pt-0.5">
                      {row.num}
                    </div>
                    <div className="text-[0.78rem] font-medium text-foreground/95 leading-snug">
                      {row.component}
                    </div>
                    <div className="min-w-0">
                      <StatusBadge status={row.onChain.status} text={row.onChain.text} />
                    </div>
                    <div className="min-w-0">
                      <StatusBadge status={row.tsEngine.status} text={row.tsEngine.text} />
                    </div>
                    <div className="text-[0.7rem] text-muted-foreground/85 leading-relaxed">
                      {row.notes}
                    </div>
                  </div>

                  {/* Mobile: stacked card */}
                  <div className="sm:hidden space-y-2.5">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-[0.65rem] text-muted-foreground/60 shrink-0 mt-0.5">
                        {row.num}
                      </span>
                      <div className="text-[0.8rem] font-medium text-foreground/95 leading-snug">
                        {row.component}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 pl-5">
                      <div className="space-y-1">
                        <div className="text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground/60">
                          On-Chain
                        </div>
                        <StatusBadge status={row.onChain.status} text={row.onChain.text} />
                      </div>
                      <div className="space-y-1">
                        <div className="text-[0.55rem] uppercase tracking-[0.18em] text-muted-foreground/60">
                          TS Engine
                        </div>
                        <StatusBadge status={row.tsEngine.status} text={row.tsEngine.text} />
                      </div>
                    </div>
                    <div className="pl-5 text-[0.7rem] text-muted-foreground/85 leading-relaxed">
                      {row.notes}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Honest summary paragraph — bottom */}
        <div className="mt-5 rounded-md border border-mtqs-gold/20 bg-mtqs-gold/[0.04] p-4">
          <div className="flex items-start gap-2.5">
            <GlowDot color="gold" size="h-2 w-2" className="mt-1.5 shrink-0" />
            <p className="text-[0.76rem] text-muted-foreground/90 leading-relaxed">
              The v1.0 Master Blueprint is fully implemented in the TypeScript reference engine
              (<span className="font-mono text-amber-200/90">src/lib/mtq/*</span>). The Arc Testnet pilot
              contract is a v1.2 5-currency GFB pilot — a faithful minimal-but-complete implementation
              of the mint / redeem / index core, but NOT the v1.0 7-component adaptive architecture.
              Production deployment of the v1.0 contract is the next major milestone.
            </p>
          </div>
        </div>
      </Panel>
    </Reveal>
  );
}
