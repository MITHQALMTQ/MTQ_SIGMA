// MTQΣ — Task 9: Authorization Audit Section (§1 VERIFICATION-ONLY surface)
// =============================================================================
// UI surface for the full contract-authorization audit (audit-work/v9-task9).
// Every value rendered here comes from src/lib/mtq/task9-audit.ts — the typed
// mirror of the TASK9-AUTHORIZATION-AUDIT.md dossier. No fact, address, number
// or verdict is invented here; nothing in this surface can execute anything.
//
// Posture (app-wide): TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED
// RESERVE TRANSACTIONS FORBIDDEN. 0 transactions were sent during the audit.
//
// Visual language matches the existing sections (SecuritySection /
// ContractsSection / EvidencePackageSection): glass panels, numbered block
// headers, brand pills, max-h-96 mtqs-scroll tables. No blue/indigo, no emoji.
//
// Props: none (static evidence surface; no onNavigate, no snapshot).

"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  ShieldBan,
  Lock,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Network,
  Users,
  Vault,
  Copy,
  ListChecks,
  FlaskConical,
  Wrench,
  ClipboardCheck,
  KeyRound,
  History,
} from "lucide-react";
import {
  Panel,
  Reveal,
  Pill,
  GlowDot,
  SectionHeading,
  Stat,
} from "@/components/mtq/primitives";
import { shortAddr, copyToClipboard } from "@/components/mtq/format";
import {
  TASK9_META,
  TASK9_INVENTORY,
  TASK9_OWNER_REFERENCE,
  TASK9_ROLE_FINDINGS,
  TASK9_AUTHORITY_GRAPH,
  TASK9_SAFE_DOSSIER,
  TASK9_CUSTODY,
  TASK9_DUPLICATES,
  TASK9_REQUIREMENTS,
  TASK9_APP_LAYER_COUNTS,
  TASK9_REPRODUCIBILITY,
  TASK9_REMEDIATION,
  TASK9_RELEASE_GATES,
} from "@/lib/mtq/task9-audit";
import {
  TASK10_META,
  TASK10_KEY_INCIDENT,
  TASK10_KEY_CENSUS,
  TASK10_CORRECTIONS,
  TASK10_FRESH_ANCHORS,
  TASK10_SUPPLY_RECONCILIATION,
  TASK10_CONTAINMENT_PLAN,
  TASK10_RELEASE_GATES,
  TASK10_FINAL,
} from "@/lib/mtq/task10-containment";

/* ---------- shared small helpers ---------- */

/** Copy-to-clipboard button (same interaction as ContractsSection). */
function CopyBtn({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyToClipboard(value);
        if (ok) toast.success(`Copied ${label}`, { description: shortAddr(value) });
        else toast.error("Copy failed");
      }}
      className="ml-1 text-[0.62rem] font-mono text-mtqs-gold/70 hover:text-mtqs-gold transition px-1 py-0.5 rounded border border-transparent hover:border-mtqs-amber/30 mtqs-focus"
      aria-label={`Copy ${label}`}
    >
      copy
    </button>
  );
}

/** Numbered block header — matches SecuritySection's panel pattern. */
function BlockHead({
  id,
  n,
  eyebrow,
  title,
  right,
}: {
  id: string;
  n: string;
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
      <div className="min-w-0">
        <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
          {n} · {eyebrow}
        </div>
        <h3 id={id} className="mt-2 text-base font-semibold text-[#0E1F1B]">
          {title}
        </h3>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/* ---------- verdict pill mappers (brand tones only) ---------- */

function GatePill({ status, kind }: { status: string; kind: "ok" | "warn" | "fail" | "neutral" }) {
  if (kind === "fail") return <Pill tone="rose">{status}</Pill>;
  if (kind === "warn") return <Pill tone="amber">{status}</Pill>;
  if (kind === "ok") return <Pill tone="emerald">{status}</Pill>;
  return <Pill tone="default">{status}</Pill>;
}

function InventoryVerdictPill({ v }: { v: "VERIFIED" | "UNVERIFIED" | "ANOMALY" }) {
  if (v === "VERIFIED") return <Pill tone="emerald">VERIFIED</Pill>;
  if (v === "ANOMALY") return <Pill tone="rose">ANOMALY</Pill>;
  return <Pill tone="amber">UNVERIFIED</Pill>;
}

function RoleVerdictPill({ verdict }: { verdict: string }) {
  if (verdict === "CONFIRMED") return <Pill tone="emerald">{verdict}</Pill>;
  if (verdict === "NO PROXIES") return <Pill tone="gold">{verdict}</Pill>;
  if (verdict === "SINGLE-KEY" || verdict === "ANOMALY" || verdict === "NOT WIRED") {
    return <Pill tone="rose">{verdict}</Pill>;
  }
  return <Pill tone="amber">{verdict}</Pill>;
}

function SafeVerdictPill({ v }: { v: string }) {
  if (v === "CRITICAL") return <Pill tone="rose">CRITICAL</Pill>;
  return <Pill tone="emerald">VERIFIED</Pill>;
}

/** Requirement status pill — unresolved items are NEVER green. */
function ReqStatusPill({ status }: { status: string }) {
  if (status === "AWAITING APPROVAL") {
    return (
      <Pill tone="muted">
        <Lock className="h-3 w-3" aria-hidden="true" />
        {status}
      </Pill>
    );
  }
  if (status === "ABSENT" || status === "NOT PERFORMED" || status === "FAILED") {
    return <Pill tone="rose">{status}</Pill>;
  }
  if (status === "IMPLEMENTED") return <Pill tone="gold">{status}</Pill>;
  return <Pill tone="amber">{status}</Pill>;
}

function PriorityPill({ p }: { p: string }) {
  if (p === "P0") return <Pill tone="rose">P0</Pill>;
  if (p === "P2") return <Pill tone="muted">P2</Pill>;
  return <Pill tone="amber">{p}</Pill>;
}

/** TRANSACTION PLAN ONLY badge — every on-chain remediation row carries it. */
function TransactionPlanOnlyBadge() {
  return (
    <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-mtqs-rose/40 bg-mtqs-rose/10 px-2.5 py-0.5 text-[0.6rem] font-medium text-mtqs-rose">
      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
      TRANSACTION PLAN ONLY — awaiting explicit owner approval (§1)
    </span>
  );
}

/* ---------- derived (never invented) counts ---------- */

const INVENTORY_CHAINS: string[] = [...new Set(TASK9_INVENTORY.map((r) => r.chain))];

const chainShort = (c: string): string =>
  c.startsWith("Monad") ? "Monad" : c.startsWith("Arc") ? "Arc" : "Solana";

const AUTHORITY_DEVIATIONS = TASK9_AUTHORITY_GRAPH.filter((r) => !r.ok).length;

/* ============================================================================ */

export function AuthorizationAuditSection() {
  const [chainFilter, setChainFilter] = useState<string>("all");

  const inventoryRows =
    chainFilter === "all"
      ? TASK9_INVENTORY
      : TASK9_INVENTORY.filter((r) => r.chain === chainFilter);

  return (
    <div className="space-y-8">
      {/* ── (a) Heading + posture banner + probe meta ─────────────────────── */}
      <SectionHeading
        eyebrow="tasks 9 & 10 · contract authorization audit + containment"
        title="Authorization Audit"
        className="mb-0"
        right={
          <Pill tone="rose">
            <GlowDot color="rose" size="h-1.5 w-1.5" />
            {TASK9_META.transactionCount} transactions sent
          </Pill>
        }
      />

      <Reveal>
        <div
          role="alert"
          className="rounded-xl border border-mtqs-rose/40 bg-mtqs-rose/[0.06] px-4 py-3.5 sm:px-5 sm:py-4"
        >
          <div className="flex items-center gap-2.5">
            <ShieldBan className="h-5 w-5 shrink-0 text-mtqs-rose" aria-hidden="true" />
            <span className="text-[0.76rem] sm:text-[0.85rem] font-semibold tracking-[0.1em] text-mtqs-rose">
              {TASK9_META.banner}
            </span>
          </div>
          <p className="mt-2.5 font-mono text-[0.66rem] leading-relaxed text-[#5B6E68]">
            Probed {TASK9_META.probedAt} · Monad block {TASK9_META.monadBlock} · Arc block{" "}
            {TASK9_META.arcBlock} · transactions sent: {TASK9_META.transactionCount}
          </p>
          <p className="mt-1.5 text-[0.66rem] leading-relaxed text-[#5B6E68]">
            Methods: {TASK9_META.methods}. Evidence: <span className="font-mono">{TASK9_META.evidencePath}</span>
          </p>
          <p className="mt-1.5 font-mono text-[0.66rem] leading-relaxed text-[#5B6E68]">
            Task 10 re-probe {TASK10_META.probedAt} · Monad block {TASK10_META.monadBlock} · Arc block{" "}
            {TASK10_META.arcBlock} · Robinhood block {TASK10_META.robinhoodBlock.split(" ")[0]}{" "}
            <span className="text-[#7A8C86]">
              (network removed from the estate 2026-10-24 — historical probe record only)
            </span>{" "}
            · transactions sent:{" "}
            {TASK10_META.transactionCount} · evidence: <span className="font-mono">{TASK10_META.evidencePath}</span>
          </p>
        </div>
      </Reveal>

      {/* ── (b00) Task 10 — Critical-Finding Containment ───────────────────── */}
      <section aria-labelledby="task10-containment-h">
        <BlockHead
          id="task10-containment-h"
          n="00"
          eyebrow="task 10 · 2026-10-22 · C-045 incident + reconciliation"
          title="Critical-Finding Containment — evidence, no on-chain action"
          right={
            <Pill tone="rose">
              <GlowDot color="rose" size="h-1.5 w-1.5" />
              {TASK10_META.overall}
            </Pill>
          }
        />

        {/* key-incident cards (redacted — no key material is ever rendered) */}
        <Reveal>
          <div
            role="alert"
            className="rounded-xl border-2 border-mtqs-rose/55 bg-mtqs-rose/[0.08] p-4 sm:p-5"
          >
            <div className="flex items-center gap-2.5">
              <KeyRound className="h-5 w-5 shrink-0 text-mtqs-rose" aria-hidden="true" />
              <span className="text-[0.8rem] font-semibold tracking-[0.08em] text-mtqs-rose">
                C-045 CONFIRMED: TWO live-privileged key literals exist in this repository and its git history
              </span>
            </div>
            <p className="mt-2 text-[0.7rem] leading-relaxed text-[#5B6E68]">
              Both derive to privileged accounts (verified by local derivation — never by executing anything). No
              literal, fragment beyond a redacted fingerprint, or key value is displayed anywhere in this app or
              the Task 10 deliverables. Posture: treat both as compromised; containment K-1/K-2 is the blocking P0.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {TASK10_KEY_INCIDENT.map((k) => (
                <div key={k.id} className="rounded-lg border border-mtqs-rose/30 bg-white p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="rose">{k.id}</Pill>
                    <span className="text-[0.7rem] font-medium text-[#0E1F1B]">{k.kind}</span>
                  </div>
                  <dl className="mt-2.5 space-y-1.5 text-[0.66rem] leading-relaxed">
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-[#7A8C86]">fingerprint</dt>
                      <dd className="font-mono text-mtqs-gold/85">{k.fingerprint}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-[#7A8C86]">derives to</dt>
                      <dd className="min-w-0 font-mono break-all text-[#0E1F1B]">{k.derivesTo}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-[#7A8C86]">controls</dt>
                      <dd className="min-w-0 text-[#5B6E68]">{k.controls}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-[#7A8C86]">copies</dt>
                      <dd className="min-w-0 text-[#5B6E68]">{k.copies}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-[#7A8C86]">window</dt>
                      <dd className="min-w-0 text-[#5B6E68]">{k.window}</dd>
                    </div>
                  </dl>
                  <p className="mt-2.5 rounded-md border border-mtqs-rose/40 bg-mtqs-rose/10 px-2.5 py-1.5 font-mono text-[0.62rem] text-mtqs-rose">
                    {k.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* exposure census */}
        <Reveal>
          <Panel className="mt-4 p-0 overflow-hidden">
            <div className="border-b border-[#E3EAE6] px-4 py-3">
              <div className="flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                <span className="text-[0.78rem] font-medium text-[#0E1F1B]">
                  Exposure census — where the material exists (and does not)
                </span>
              </div>
            </div>
            <ul className="max-h-72 overflow-y-auto mtqs-scroll divide-y divide-[#E3EAE6]">
              {TASK10_KEY_CENSUS.map((c) => (
                <li key={c.surface} className="px-4 py-2.5">
                  <p className="text-[0.68rem] font-medium text-[#33544C]">{c.surface}</p>
                  <p className="mt-0.5 text-[0.66rem] leading-relaxed text-[#5B6E68]">{c.result}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>

        {/* corrections register */}
        <Reveal>
          <Panel className="mt-4 p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
              <span className="text-[0.78rem] font-medium text-[#0E1F1B]">
                Corrections register — evidence-preserving (prior claim → verified truth → action)
              </span>
            </div>
            <ul className="mt-3 space-y-2.5">
              {TASK10_CORRECTIONS.map((c) => (
                <li key={c.id} className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="gold">{c.id}</Pill>
                    <span className="font-mono text-[0.64rem] text-[#7A8C86] line-through decoration-mtqs-rose/60">
                      {c.prior}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[0.68rem] leading-relaxed text-[#5B6E68]">{c.truth}</p>
                  <p className="mt-1 text-[0.64rem] leading-relaxed text-mtqs-gold/75">Action: {c.action}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>

        {/* fresh anchors + supply reconciliation tables */}
        <Reveal>
          <Panel className="mt-4 p-0 overflow-hidden">
            <div className="border-b border-[#E3EAE6] px-4 py-3">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                <span className="text-[0.78rem] font-medium text-[#0E1F1B]">
                  State stability — Task 9 (2026-10-21) vs Task 10 (2026-10-22) fresh anchors
                </span>
              </div>
            </div>
            <div className="overflow-x-auto mtqs-scroll">
              <table className="w-full text-[0.7rem] min-w-[680px]">
                <caption className="sr-only">
                  Task 10 re-verification of Task 9 live-state anchors — read-only re-probe, zero transactions.
                </caption>
                <thead className="bg-[#F7FAF8] text-[#5B6E68]">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Item</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Task 9</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Task 10 fresh probe</th>
                  </tr>
                </thead>
                <tbody>
                  {TASK10_FRESH_ANCHORS.map((a) => (
                    <tr key={a.item} className="border-t border-[#E3EAE6]">
                      <td className="px-3 py-2.5 font-mono text-[#0E1F1B]">{a.item}</td>
                      <td className="px-3 py-2.5 text-[#5B6E68]">{a.task9}</td>
                      <td className="px-3 py-2.5 text-mtqs-emerald">{a.task10}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </Reveal>

        <Reveal>
          <Panel className="mt-4 p-0 overflow-hidden">
            <div className="border-b border-[#E3EAE6] px-4 py-3">
              <div className="flex items-center gap-2">
                <Vault className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                <span className="text-[0.78rem] font-medium text-[#0E1F1B]">
                  Supply & genesis reconciliation — mandate §20.1 vs live estate
                </span>
              </div>
            </div>
            <div className="overflow-x-auto mtqs-scroll">
              <table className="w-full text-[0.7rem] min-w-[760px]">
                <caption className="sr-only">
                  Intended supply and genesis per the authoritative mandate, reconciled against live supplies, custody and holders.
                </caption>
                <thead className="bg-[#F7FAF8] text-[#5B6E68]">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Chain</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Intended (mandate)</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Actual (live)</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {TASK10_SUPPLY_RECONCILIATION.map((r) => (
                    <tr key={r.chain} className="border-t border-[#E3EAE6]">
                      <td className="px-3 py-2.5 font-mono text-[#0E1F1B]">{r.chain}</td>
                      <td className="px-3 py-2.5 text-[#5B6E68]">{r.intended}</td>
                      <td className="px-3 py-2.5 text-[#5B6E68]">{r.actual}</td>
                      <td className="px-3 py-2.5 text-mtqs-amber">{r.gap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-[#E3EAE6] px-4 py-2.5 text-[0.64rem] leading-relaxed text-[#7A8C86]">
              Custody is NOT declared closed because balances happen to sum to supply: every balance sits either in
              the deployer EOA, a self-custodying token contract (gen-A/C), or a single-key Solana wallet — none in
              the mandated 4/7 Genesis Safe. C-041/C-043/C-046/C-047 remain OPEN.
            </p>
          </Panel>
        </Reveal>

        {/* containment plan — all steps await human approval */}
        <Reveal>
          <Panel className="mt-4 p-0 overflow-hidden">
            <div className="border-b border-[#E3EAE6] px-4 py-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
                <span className="text-[0.78rem] font-medium text-[#0E1F1B]">
                  Transaction-free containment plan — dependencies, risks, required approvals
                </span>
              </div>
              <TransactionPlanOnlyBadge />
            </div>
            <ul className="max-h-96 overflow-y-auto mtqs-scroll divide-y divide-[#E3EAE6]">
              {TASK10_CONTAINMENT_PLAN.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={s.kind === "ON-CHAIN (PLAN ONLY)" ? "rose" : s.kind === "REPO" ? "gold" : "muted"}>
                      {s.id}
                    </Pill>
                    <span className="font-mono text-[0.62rem] text-[#7A8C86]">{s.kind}</span>
                  </div>
                  <p className="mt-1 text-[0.7rem] leading-relaxed text-[#0E1F1B]">{s.step}</p>
                  <p className="mt-1 text-[0.62rem] leading-relaxed text-[#5B6E68]">Risk: {s.risk}</p>
                  <p className="text-[0.62rem] leading-relaxed text-mtqs-gold/75">Approval authority: {s.approval}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>

        {/* release gates — unchanged */}
        <Reveal>
          <Panel className="mt-4 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-mtqs-gold/80" aria-hidden="true" />
              <span className="text-[0.78rem] font-medium text-[#0E1F1B]">
                Task 10 release-gate re-verification — statuses unchanged
              </span>
              <Pill tone="rose">{TASK10_FINAL.overall}</Pill>
            </div>
            <ul className="space-y-1.5">
              {TASK10_RELEASE_GATES.map((g) => (
                <li key={g.n} className="flex flex-wrap items-center gap-2 text-[0.7rem]">
                  <span className="w-6 shrink-0 font-mono text-[#7A8C86]">{String(g.n).padStart(2, "0")}</span>
                  <span className="text-[#0E1F1B]">{g.name}</span>
                  <GatePill status={g.status} kind={g.n === 1 ? "warn" : "fail"} />
                  {"note" in g && g.note ? (
                    <span className="text-[0.62rem] text-[#5B6E68]">— {g.note}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-md border border-mtqs-rose/30 bg-mtqs-rose/[0.06] px-3 py-2 text-[0.68rem] leading-relaxed text-mtqs-rose/90">
              {TASK10_FINAL.note}
            </p>
          </Panel>
        </Reveal>
      </section>

      {/* ── (b) Final recommendation — NOT ACCEPTED ────────────────────────── */}
      <Reveal>
        <section aria-labelledby="task9-recommendation-h">
          <div
            role="alert"
            className="rounded-xl border-2 border-mtqs-rose/55 bg-mtqs-rose/[0.09] p-4 sm:p-6"
          >
            <div
              id="task9-recommendation-h"
              className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-rose/80"
            >
              Final recommendation (G.8) — evidence-based
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <ShieldBan className="h-6 w-6 shrink-0 text-mtqs-rose" aria-hidden="true" />
              <span className="text-lg sm:text-xl font-bold tracking-wide text-mtqs-rose">
                {TASK9_META.recommendation}
              </span>
            </div>
            <p className="mt-3 text-[0.74rem] sm:text-[0.8rem] leading-relaxed text-[#5B6E68]">
              {TASK9_META.recommendationNote}
            </p>
          </div>
        </section>
      </Reveal>

      {/* ── (c) Release-status separation — 7 indicators ───────────────────── */}
      <section aria-labelledby="task9-gates-h">
        <BlockHead
          id="task9-gates-h"
          n="01"
          eyebrow="release gates"
          title="Release status — separate from software status"
          right={<Pill tone="rose">release authority: none</Pill>}
        />
        <Reveal>
          <Panel className="p-4 sm:p-6">
            <p className="mb-4 rounded-md border border-mtqs-amber/30 bg-mtqs-amber/[0.05] px-3 py-2.5 text-[0.72rem] leading-relaxed text-mtqs-amber/90">
              Software status is reported separately from release status. No software test result
              may automatically advance a release gate.
            </p>
            <ul className="space-y-2">
              {TASK9_RELEASE_GATES.map((g) => (
                <li
                  key={g.n}
                  className="flex flex-col gap-1.5 rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3 sm:flex-row sm:items-start sm:gap-3"
                >
                  <span
                    className="shrink-0 font-mono text-[0.65rem] text-[#7A8C86] sm:pt-1"
                    aria-hidden="true"
                  >
                    {String(g.n).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.78rem] font-medium text-[#0E1F1B]">{g.name}</span>
                      <GatePill status={g.status} kind={g.statusKind} />
                    </div>
                    <p className="mt-1 text-[0.66rem] leading-relaxed text-[#5B6E68]">{g.evidence}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </section>

      {/* ── (d) Owner reference check ─────────────────────────────────────── */}
      <section aria-labelledby="task9-owner-h">
        <BlockHead
          id="task9-owner-h"
          n="02"
          eyebrow="owner reference"
          title="Owner Reference Check — MTQ.sol · deployer account"
          right={<Pill tone="emerald">confirmed on both chains</Pill>}
        />
        <Reveal>
          <Panel className="p-0 overflow-hidden">
            <div className="overflow-x-auto mtqs-scroll">
              <table className="w-full text-[0.72rem] min-w-[560px]">
                <caption className="sr-only">
                  Owner reference check — AccessControl role hashes probed read-only against
                  MTQ.sol for the deployer account on both chains.
                </caption>
                <thead className="bg-[#F7FAF8] text-[#5B6E68]">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Role</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Role hash</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Monad</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Arc</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {TASK9_OWNER_REFERENCE.map((r) => (
                    <tr key={r.role} className="border-t border-[#E3EAE6]">
                      <td className="px-3 py-2.5 font-mono text-[#0E1F1B]">{r.role}</td>
                      <td className="px-3 py-2.5 font-mono text-mtqs-gold/80">{r.hash}</td>
                      <td className="px-3 py-2.5 font-mono text-mtqs-emerald">{r.monad}</td>
                      <td className="px-3 py-2.5 font-mono text-mtqs-emerald">{r.arc}</td>
                      <td className="px-3 py-2.5">
                        {r.monad === "TRUE" && r.arc === "TRUE" ? (
                          <Pill tone="emerald">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            matches owner reference ✓
                          </Pill>
                        ) : (
                          <Pill tone="rose">MISMATCH — investigate</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              role="note"
              className="border-t border-[#E3EAE6] px-3 py-2.5 text-[0.66rem] leading-relaxed text-[#5B6E68]"
            >
              {TASK9_ROLE_FINDINGS[0].detail}
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* ── (e) Contract inventory (19 accounts, chain filter) ─────────────── */}
      <section aria-labelledby="task9-inventory-h">
        <BlockHead
          id="task9-inventory-h"
          n="03"
          eyebrow="contract inventory"
          title="Contract Inventory — bytecode / source identity"
          right={
            <Pill tone="default">
              <FileSearch className="h-3 w-3" aria-hidden="true" />
              {TASK9_INVENTORY.length} accounts · {INVENTORY_CHAINS.length} chains
            </Pill>
          }
        />
        <Reveal>
          <div
            className="mb-3 flex flex-wrap gap-1"
            role="tablist"
            aria-label="Inventory chain filter"
          >
            <button
              type="button"
              role="tab"
              aria-selected={chainFilter === "all"}
              onClick={() => setChainFilter("all")}
              className={`mtqs-focus rounded-md px-3 py-1.5 text-[0.72rem] transition ${
                chainFilter === "all"
                  ? "bg-mtqs-gold/15 text-mtqs-gold"
                  : "text-[#5B6E68] hover:text-[#0E1F1B]"
              }`}
            >
              All chains ({TASK9_INVENTORY.length})
            </button>
            {INVENTORY_CHAINS.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={chainFilter === c}
                onClick={() => setChainFilter(c)}
                className={`mtqs-focus rounded-md px-3 py-1.5 text-[0.72rem] transition ${
                  chainFilter === c
                    ? "bg-mtqs-gold/15 text-mtqs-gold"
                    : "text-[#5B6E68] hover:text-[#0E1F1B]"
                }`}
              >
                {c} ({TASK9_INVENTORY.filter((r) => r.chain === c).length})
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
            <div className="max-h-96 overflow-auto mtqs-scroll">
              <table className="w-full text-[0.7rem] min-w-[840px]">
                <caption className="sr-only">
                  Contract inventory — {TASK9_INVENTORY.length} live accounts across Monad
                  Testnet, Arc Testnet and Solana Devnet with code size, runtime keccak,
                  deployment info, creator and verdict.
                </caption>
                <thead className="bg-[#F7FAF8] text-[#5B6E68] sticky top-0">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Chain</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Contract</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Address</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Code size</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">keccak(runtime)</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Deploy</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Creator</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryRows.map((r, i) => (
                    <tr
                      key={`${r.chain}-${r.name}-${r.address}`}
                      className={`border-t border-[#E3EAE6] ${i % 2 ? "bg-[#F7FAF8]" : ""}`}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <Pill tone="default">{chainShort(r.chain)}</Pill>
                      </td>
                      <td className="min-w-0 px-3 py-2.5">
                        <div className="font-medium text-[#0E1F1B]">{r.name}</div>
                        {r.note ? (
                          <div className="mt-0.5 max-w-[22rem] text-[0.62rem] leading-snug text-[#5B6E68]">
                            {r.note}
                          </div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="font-mono text-mtqs-gold" title={r.address}>
                          {shortAddr(r.address, 10, 8)}
                        </span>
                        <CopyBtn value={r.address} label={`${r.name} address`} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[#33544C]">
                        {r.size}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[0.62rem] text-[#5B6E68]">
                        {r.keccak}
                      </td>
                      <td className="max-w-[16rem] px-3 py-2.5 text-[0.64rem] text-[#5B6E68]">
                        {r.deploy}
                      </td>
                      <td className="max-w-[14rem] px-3 py-2.5 text-[0.64rem] text-[#5B6E68]">
                        {r.creator}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <InventoryVerdictPill v={r.verdict} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── (f) Authority graph ───────────────────────────────────────────── */}
      <section aria-labelledby="task9-authority-h">
        <BlockHead
          id="task9-authority-h"
          n="04"
          eyebrow="authority graph"
          title="Authority Graph — who can act today vs the blueprint"
          right={
            <Pill tone="rose">
              <Network className="h-3 w-3" aria-hidden="true" />
              {AUTHORITY_DEVIATIONS} of {TASK9_AUTHORITY_GRAPH.length} actions deviate
            </Pill>
          }
        />
        <Reveal>
          <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
            <div className="overflow-x-auto mtqs-scroll">
              <table className="w-full text-[0.7rem] min-w-[760px]">
                <caption className="sr-only">
                  Authority graph — sensitive actions, what enforces them, who can perform
                  them today per the captured evidence, and the blueprint mandate.
                </caption>
                <thead className="bg-[#F7FAF8] text-[#5B6E68]">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Action</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Enforced by</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">
                      Who can act TODAY (evidence)
                    </th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">
                      Mandated (blueprint)
                    </th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {TASK9_AUTHORITY_GRAPH.map((r) => (
                    <tr
                      key={r.action}
                      className={`border-t border-[#E3EAE6] ${r.ok ? "" : "bg-mtqs-rose/[0.04]"}`}
                    >
                      <td
                        className={`px-3 py-2.5 font-medium text-[#0E1F1B] ${
                          r.ok ? "" : "border-l-2 border-l-mtqs-rose/70"
                        }`}
                      >
                        {r.action}
                      </td>
                      <td className="px-3 py-2.5 text-[#5B6E68]">{r.enforcedBy}</td>
                      <td className="max-w-[18rem] px-3 py-2.5 text-[#33544C]">{r.today}</td>
                      <td className="max-w-[18rem] px-3 py-2.5 text-[#5B6E68]">{r.mandated}</td>
                      <td className="px-3 py-2.5">
                        {r.ok ? (
                          <Pill tone="gold">no proxies — no in-place upgrade</Pill>
                        ) : (
                          <Pill tone="rose">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            DEVIATION
                          </Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── (g) Role findings ─────────────────────────────────────────────── */}
      <section aria-labelledby="task9-roles-h">
        <BlockHead
          id="task9-roles-h"
          n="05"
          eyebrow="role findings"
          title="Role & Authority Findings"
          right={
            <Pill tone="amber">
              <Users className="h-3 w-3" aria-hidden="true" />
              {TASK9_ROLE_FINDINGS.length} findings · none downgraded
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-4 sm:p-6">
            <ul className="space-y-2">
              {TASK9_ROLE_FINDINGS.map((f) => (
                <li
                  key={f.finding}
                  className="flex flex-col justify-between gap-2 rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-3 py-2.5 sm:flex-row sm:items-start"
                >
                  <div className="min-w-0">
                    <div className="text-[0.74rem] font-medium text-[#0E1F1B]">{f.finding}</div>
                    <div className="mt-0.5 text-[0.66rem] leading-relaxed text-[#5B6E68]">
                      {f.detail}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <RoleVerdictPill verdict={f.verdict} />
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </section>

      {/* ── (h) Safe dossier ──────────────────────────────────────────────── */}
      <section aria-labelledby="task9-safe-h">
        <BlockHead
          id="task9-safe-h"
          n="06"
          eyebrow="safe configuration"
          title="Genesis Safe — Configuration & Custody Evidence Dossier"
          right={
            <Pill tone="rose">
              <Vault className="h-3 w-3" aria-hidden="true" />
              threshold 1/1 · nonce 0
            </Pill>
          }
        />
        <Reveal>
          <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
            <div className="max-h-96 overflow-auto mtqs-scroll">
              <table className="w-full text-[0.7rem] min-w-[640px]">
                <caption className="sr-only">
                  Genesis Safe dossier — read-only probe results on both chains with verdicts;
                  CRITICAL rows are single-key control evidence (OD-35 preserved).
                </caption>
                <thead className="bg-[#F7FAF8] text-[#5B6E68] sticky top-0">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Probe</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Monad</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Arc</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Verdict</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {TASK9_SAFE_DOSSIER.map((r) => (
                    <tr
                      key={r.probe}
                      className={`border-t border-[#E3EAE6] ${
                        r.verdict === "CRITICAL" ? "bg-mtqs-rose/[0.05]" : ""
                      }`}
                    >
                      <td
                        className={`px-3 py-2.5 font-mono text-[0.66rem] text-[#0E1F1B] ${
                          r.verdict === "CRITICAL" ? "border-l-2 border-l-mtqs-rose/70" : ""
                        }`}
                      >
                        {r.probe}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[#33544C]">{r.monad}</td>
                      <td className="px-3 py-2.5 font-mono text-[#33544C]">{r.arc}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <SafeVerdictPill v={r.verdict} />
                      </td>
                      <td className="max-w-[20rem] px-3 py-2.5 text-[0.66rem] text-[#5B6E68]">
                        {r.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── (h, cont.) Custody reconciliation ──────────────────────────────── */}
      <section aria-labelledby="task9-custody-h">
        <BlockHead
          id="task9-custody-h"
          n="07"
          eyebrow="custody reconciliation"
          title="Custody Reconciliation — current state, both chains"
          right={<Pill tone="emerald">supplies reconcile exactly</Pill>}
        />
        <Reveal>
          <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
            <div className="overflow-x-auto mtqs-scroll">
              <table className="w-full text-[0.7rem] min-w-[720px]">
                <caption className="sr-only">
                  Custody reconciliation — total supply against holders on each chain, plus the
                  Safe-holdings and reserve-funding confirmations.
                </caption>
                <thead className="bg-[#F7FAF8] text-[#5B6E68]">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Chain</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Supply</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Holders</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Reconciliation</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {TASK9_CUSTODY.map((r, i) => (
                    <tr
                      key={`${r.chain}-${r.holders}`}
                      className={`border-t border-[#E3EAE6] ${i % 2 ? "bg-[#F7FAF8]" : ""}`}
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[#0E1F1B]">
                        {r.chain}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[#33544C]">
                        {r.supply}
                      </td>
                      <td className="max-w-[20rem] px-3 py-2.5 text-[0.66rem] text-[#5B6E68]">
                        {r.holders}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        {r.closes ? (
                          <Pill tone="emerald">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            reconciles exactly
                          </Pill>
                        ) : (
                          <Pill tone="rose">does not close</Pill>
                        )}
                      </td>
                      <td className="max-w-[22rem] px-3 py-2.5 text-[0.64rem] text-[#5B6E68]">
                        {r.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── (i) Duplicate token generations ───────────────────────────────── */}
      <section aria-labelledby="task9-duplicates-h">
        <BlockHead
          id="task9-duplicates-h"
          n="08"
          eyebrow="duplicate generations"
          title="Duplicate MTQ Token Generations — address-book history"
          right={<Pill tone="amber">3 live generations per chain</Pill>}
        />
        <Reveal>
          <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
            <div className="overflow-x-auto mtqs-scroll">
              <table className="w-full text-[0.7rem] min-w-[640px]">
                <caption className="sr-only">
                  Duplicate token generations — current, generation-A and generation-B MTQ
                  tokens per chain, probed live in the Task 9 session (2026-10-21).
                </caption>
                <thead className="bg-[#F7FAF8] text-[#5B6E68]">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Chain</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Generation</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Address</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Live now</th>
                  </tr>
                </thead>
                <tbody>
                  {TASK9_DUPLICATES.map((r) => (
                    <tr
                      key={`${r.chain}-${r.label}`}
                      className="border-t border-[#E3EAE6]"
                    >
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[#0E1F1B]">
                        {r.chain}
                      </td>
                      <td className="px-3 py-2.5 text-[#33544C]">{r.label}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-mtqs-gold">
                        <span className="inline-flex items-center gap-1">
                          {r.address}
                          <Copy
                            className="h-3 w-3 text-mtqs-gold/50"
                            aria-hidden="true"
                          />
                          <span className="sr-only">address recorded in evidence</span>
                        </span>
                      </td>
                      <td className="max-w-[24rem] px-3 py-2.5 text-[0.64rem] text-[#5B6E68]">
                        {r.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── (j) Requirement register + app-layer counts ───────────────────── */}
      <section aria-labelledby="task9-requirements-h">
        <BlockHead
          id="task9-requirements-h"
          n="09"
          eyebrow="requirement register"
          title="Requirement-to-Code-to-Test Traceability — explicitly addressed items"
          right={
            <Pill tone="amber">
              <ListChecks className="h-3 w-3" aria-hidden="true" />
              unresolved items are never shown green
            </Pill>
          }
        />
        <Reveal>
          <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
            <div className="max-h-96 overflow-auto mtqs-scroll">
              <table className="w-full text-[0.7rem] min-w-[720px]">
                <caption className="sr-only">
                  Requirement register — explicitly addressed outstanding items with location
                  and honest status; no unresolved item is marked complete.
                </caption>
                <thead className="bg-[#F7FAF8] text-[#5B6E68] sticky top-0">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Requirement</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Where</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Status</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {TASK9_REQUIREMENTS.map((r) => (
                    <tr key={r.req} className="border-t border-[#E3EAE6]">
                      <td className="max-w-[16rem] px-3 py-2.5 text-[#0E1F1B]">{r.req}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.64rem] text-[#5B6E68]">
                        {r.where}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <ReqStatusPill status={r.status} />
                      </td>
                      <td className="max-w-[24rem] px-3 py-2.5 text-[0.64rem] leading-snug text-[#5B6E68]">
                        {r.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TASK9_APP_LAYER_COUNTS.map((c) => (
              <Panel key={c.layer} className="p-4">
                <Stat
                  label={c.layer}
                  value={c.counts}
                  valueClass="text-[0.7rem] leading-snug"
                />
              </Panel>
            ))}
          </div>
          <p className="mt-2 text-[0.62rem] text-[#7A8C86]">
            App-layer status strip — software status only; no software result advances a release
            gate.
          </p>
        </Reveal>
      </section>

      {/* ── (k) Reproducibility ──────────────────────────────────────────── */}
      <section aria-labelledby="task9-reproducibility-h">
        <BlockHead
          id="task9-reproducibility-h"
          n="10"
          eyebrow="reproducible test report"
          title="Reproducibility — scripts, provenance, honest limits"
          right={
            <Pill tone="default">
              <FlaskConical className="h-3 w-3" aria-hidden="true" />
              scripts + raw evidence
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-4 sm:p-6">
            <dl className="space-y-2.5">
              {TASK9_REPRODUCIBILITY.map((r) => (
                <div
                  key={r.item}
                  className="grid gap-1.5 rounded-md border border-[#E3EAE6] bg-[#F7FAF8] px-3 py-2.5 sm:grid-cols-[150px_1fr] sm:gap-4"
                >
                  <dt className="pt-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-mtqs-gold/75">
                    {r.item}
                  </dt>
                  <dd className="text-[0.68rem] leading-relaxed text-[#5B6E68]">{r.detail}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </Reveal>
      </section>

      {/* ── (l) Remediation register ─────────────────────────────────────── */}
      <section aria-labelledby="task9-remediation-h">
        <BlockHead
          id="task9-remediation-h"
          n="11"
          eyebrow="remediation register"
          title="Prioritized Remediation — P0 sequence first"
          right={
            <Pill tone="rose">
              <Wrench className="h-3 w-3" aria-hidden="true" />
              0 on-chain actions executed
            </Pill>
          }
        />
        <Reveal>
          <div className="overflow-hidden rounded-md border border-[#E3EAE6]">
            <div className="max-h-96 overflow-auto mtqs-scroll">
              <table className="w-full text-[0.7rem] min-w-[760px]">
                <caption className="sr-only">
                  Remediation register — prioritized items with dependencies and acceptance
                  criteria; on-chain rows are transaction plans only, none executed.
                </caption>
                <thead className="bg-[#F7FAF8] text-[#5B6E68] sticky top-0">
                  <tr>
                    <th scope="col" className="text-left px-3 py-2 font-medium">ID</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Item</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Priority</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Depends on</th>
                    <th scope="col" className="text-left px-3 py-2 font-medium">Acceptance</th>
                  </tr>
                </thead>
                <tbody>
                  {TASK9_REMEDIATION.map((r) => (
                    <tr key={r.id} className="border-t border-[#E3EAE6] align-top">
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[#0E1F1B]">
                        {r.id}
                      </td>
                      <td className="min-w-0 max-w-[26rem] px-3 py-2.5">
                        <div className="leading-snug text-[#0E1F1B]">{r.item}</div>
                        {r.onChain ? <TransactionPlanOnlyBadge /> : null}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <PriorityPill p={r.priority} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[0.64rem] text-[#5B6E68]">
                        {r.depends}
                      </td>
                      <td className="max-w-[16rem] px-3 py-2.5 text-[0.64rem] leading-snug text-[#5B6E68]">
                        {r.acceptance}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-2 text-[0.66rem] leading-relaxed text-mtqs-rose/85">
            Every on-chain step requires an approved transaction plan; none was executed under
            §1. Nothing on this surface implies that any on-chain action has been executed.
          </p>
        </Reveal>
      </section>

      {/* ── (m) Preserved findings + §1 + evidence footer ──────────────────── */}
      <Reveal>
        <Panel className="p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 h-5 w-5 shrink-0 text-mtqs-gold/80" aria-hidden="true" />
            <div className="space-y-1.5 text-[0.72rem] leading-relaxed text-[#5B6E68]">
              <p>
                Preserved findings{" "}
                <span className="font-mono text-[#0E1F1B]">C-041…C-047</span> and{" "}
                <span className="font-mono text-[#0E1F1B]">OD-35</span> are re-asserted — none
                re-labeled, none downgraded.
              </p>
              <p>
                §1 VERIFICATION-ONLY was respected throughout: {TASK9_META.transactionCount}{" "}
                transactions were sent; no role was granted or revoked; no contract was deployed
                or upgraded; no key material is exposed on this surface.
              </p>
              <p className="break-all font-mono text-[0.65rem] text-[#7A8C86]">
                Evidence: {TASK9_META.evidencePath} — raw request/response log, per-chain
                inventory JSONs, creation receipts, scan states. This surface is a verification
                artifact: no address, role, supply, or configuration was altered.
              </p>
            </div>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
