// MTQΣ — Issuance Lab Section (Task M8-3c-b · §14 payment-funded primary issuance)
//
// The Pilot Command Center surface for the payment-funded primary issuance
// pilot (src/lib/mtq/issuance/ — Task M8-3b engine):
//   1. Hero/status band — the honest status banner, D-13.27 adopted-delegated
//      pill, machine label, CBDC SIMULATED / NOT CONNECTED pill.
//   2. Instrument registry panel — the TEST-ONLY synthetic fixture rows
//      (TEST-USDC-X + the CBDC rows with their NOT_CONNECTED overlay) and the
//      BORN-EMPTY fail-closed admission note.
//   3. Scenario runner — 8 deterministic DEMO scenarios over the §14.4 12-step
//      workflow, each producing a step trace timeline, final-state callout,
//      exact-numbers row, exceptions/refunds, and the SEP separation proof.
//   4. Economics panel — fee / quote / supply caps, every value tagged
//      UNAPPROVED / ILLUSTRATIVE.
//   5. State-machine map — the 21 states (happy-path chain + terminal cluster),
//      the current run's visited states highlighted.
//   6. Audit trail — the last ~50 persisted IssuanceEvent rows (durability
//      mirror; the machine's in-memory log is authoritative).
//
// HONEST POSTURE (every panel): "ISSUED" IS A LEDGER RECORD ONLY — NEVER
// ON-CHAIN. TESTNET ONLY · SHADOW MODE ENFORCED · ECONOMIC VALUES UNAPPROVED /
// ILLUSTRATIVE · NOT ACCEPTED. All money values are the EXACT 6-decimal
// strings returned by the API (never reformatted from floats).
//
// Live data: GET /api/issuance (snapshot + audit trail) · POST /api/issuance
// (scenario run). Props: { onNavigate, snapshot } — shared section contract.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Panel,
  Reveal,
  Pill,
  GlowDot,
  SectionHeading,
  Skeleton,
  MiniBar,
  Stat,
} from "@/components/mtq/primitives";
import type { SectionId } from "@/components/mtq/Navigation";
import type { MetricsSnapshot } from "@/lib/mtq/engine";
import {
  Coins,
  ShieldAlert,
  Database,
  Play,
  Scale,
  ListOrdered,
  History,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Landmark,
  Loader2,
  Ban,
} from "lucide-react";

/* ---------- /api/issuance GET shape ---------- */

interface RegistryRowDto {
  instrumentId: string;
  code: string;
  type: string;
  network: string;
  issuer: { legalName: string; jurisdiction: string };
  state: string;
  honestyState: string;
  statusLabel: string;
  testOnly: boolean;
  jurisdictionAllowlist: string[];
  confirmation: { kind: string; finalityDefinition: string };
  valuation: { quoteUnit: string; pricePerUnit: string; basisLabel: string };
  fees: { feeClass: string; rateBps: string | null; label: string };
  depegBandsLabel: string;
  perInstanceIdentityNote: string;
}

interface AuditEventRowDto {
  id: string;
  createdAt: string;
  requestId: string;
  kind: string;
  state: string;
  instrument: string;
  grossAmount: string;
  feeAmount: string;
  netAmount: string;
  quote: string;
  issuedAmount: string;
  supplyAfter: string;
}

interface IssuanceGetDto {
  banner: string;
  labels: {
    banner: string;
    registryLabel: string;
    machineLabel: string;
    d1327Status: string;
    alt4Adoption: string;
    authScheme: string;
    cbdcAdapterStatus: string;
    cbdcAdapterMarker: string;
    feeScheduleLabel: string;
    quotePolicyLabel: string;
    supplyPolicyLabel: string;
    fixturesLabel: string;
    separationLabel: string;
  };
  economics: {
    fee: { rateBps: string; feeClass: string; label: string };
    quote: { tuPerToken: string; validityWindowMinutes: number; label: string };
    supply: {
      perTxCap: string;
      trancheId: string;
      trancheCap: string;
      globalMax: string;
      label: string;
    };
    roundingRule: string;
  };
  registry: { label: string; fixturesLabel: string; bornEmptyNote: string; rows: RegistryRowDto[] };
  states: {
    all: string[];
    terminal: string[];
    happyPath: string[];
    stepRefs: Record<string, string>;
    transitions: Record<string, string[]>;
  };
  separation: {
    label: string;
    methodologyVersion: string;
    weightsPct: Record<string, number>;
    constituency: string[];
    byteStable: boolean;
  };
  cbdc: {
    status: string;
    marker: string;
    realAdapterGate: { authorizedInterfaceVerified: boolean; endToEndIntegrationTested: boolean; admissionDossierAnnexExists: boolean; status: string };
    limitations: string[];
  };
  events: { rows: AuditEventRowDto[]; totalPersisted: number; dbError: string | null };
  auditNote: string;
}

/* ---------- /api/issuance POST shape ---------- */

interface RunEventDto {
  seq: number;
  atMs: number;
  requestId: string;
  from: string | null;
  to: string | null;
  stepRef: string;
  reasonCode: string;
  detail: string;
  taxonomyClass: string | null;
  econ: {
    instrument: string;
    grossAmount: string;
    feeAmount: string;
    netAmount: string;
    quote: string;
    issuedAmount: string;
    supplyAfter: string;
  };
}

interface IssuancePostDto {
  banner: string;
  demoDisclaimer: string;
  run: {
    scenario: string;
    scenarioDescription: string;
    machineId: string;
    clockStartMs: number;
    cbdcSimulationMode: boolean;
    finalRequestId: string;
    finalState: string;
    finalStateIsTerminal: boolean;
    terminalReasonCode: string | null;
    terminalTaxonomyClass: string | null;
    pipelineSuspended: boolean;
    suspensionReasons: string[];
    events: RunEventDto[];
    ledgerView: {
      requests: { requestId: string; state: string; terminalReasonCode: string | null; instrument: string; hasMintRecord: boolean; issuedAmount: string | null; authorizationProgramId: string | null }[];
      payments: { requestId: string; paymentTxId: string; grossTU: string; feeTU: string; netTU: string; status: string }[];
      mints: { mintId: string; requestId: string; recipientId: string; amount: string; nonce: number; programId: string; recordOnlyLabel: string }[];
      reconciliation: { balanced: boolean; checks: { check: string; passed: boolean; detail: string }[]; bookTotals: Record<string, string> };
      supply: { totalSupplyMicro: string; trancheIssuedMicro: string; trancheCapMicro: string; globalMaxSupplyMicro: string; perTxCapMicro: string; mintCount: number; feeBookTotalMicro: string };
    };
    mintRecord: { mintId: string; requestId: string; recipientId: string; amount: string; nonce: number; programId: string; recordOnlyLabel: string } | null;
    exceptions: { exceptionId: string; requestId: string | null; taxonomyClass: string; reasonCode: string; status: string; notes: string }[];
    refundQueue: { refundId: string; requestId: string; paymentTxId: string; idempotencyKey: string; grossInstrumentAmount: string; reasonCode: string; state: string }[];
    programs: { programId: string; instruments: string[]; perTxCap: string; perProgramCap: string; issuedInProgram: string; revoked: boolean; signedBy: string; rules: string[]; label: string }[];
    attestation: { attestationId: string; matched: boolean; attester: string; periodMs: number; notes: string } | null;
    separation: { label: string; byteIdenticalBeforeAfter: boolean; snapshotBytesLength: number; note: string };
    expectedNumbers: {
      expected: { gross: string; fee: string; net: string; quote: string; issued: string; supplyAfterSingleMint: string };
      checks: { gross: boolean | null; fee: boolean | null; net: boolean | null; quote: boolean | null; issued: boolean | null; supplyAfter: boolean | null };
      observed: { gross: string | null; fee: string | null; net: string | null; quote: string | null; issued: string | null; supplyAfter: string; mintCount: number };
      met: boolean;
    };
    persistence: { written: number; error: string | null; disclosed: string };
  };
}

/* ---------- The 8 scenarios ---------- */

const SCENARIOS: { id: string; label: string; blurb: string; tone: "emerald" | "rose" | "amber" }[] = [
  {
    id: "happy-path",
    label: "Happy Path",
    blurb: "Full §14.4 12-step workflow → ISSUED (ledger record) → RECONCILED.",
    tone: "emerald",
  },
  {
    id: "duplicate",
    label: "Duplicate",
    blurb: "Same idempotency key replayed → DUPLICATE; never a second execution (INV-C).",
    tone: "rose",
  },
  {
    id: "delayed-finality",
    label: "Delayed Finality",
    blurb: "Finality after quote expiry → EXPIRED_QUOTE + refund (finality-before-issuance).",
    tone: "amber",
  },
  {
    id: "failed-payment",
    label: "Failed Payment",
    blurb: "Settlement FAILED → PAYMENT_FAILED; failed payments never mint (INV-B).",
    tone: "rose",
  },
  {
    id: "reversal-pre",
    label: "Reversal (Pre-Issue)",
    blurb: "Reversal before issuance → CANCELLED, no mint, refund queued.",
    tone: "rose",
  },
  {
    id: "reversal-post",
    label: "Reversal (Post-Issue)",
    blurb: "Reversal after issuance → RECONCILIATION_BREAK + pipeline SUSPENDED.",
    tone: "rose",
  },
  {
    id: "unauthorized",
    label: "Unauthorized",
    blurb: "No ALT-4 program → UNAUTHORIZED; payments alone never mint (INV-A).",
    tone: "rose",
  },
  {
    id: "cbdc-simulated",
    label: "CBDC (Simulated)",
    blurb: "SIMULATION-MODE demo on the simulated rail — NOT CONNECTED, ever.",
    tone: "amber",
  },
];

/* ---------- helpers ---------- */

function stateTone(state: string): "emerald" | "rose" | "amber" | "muted" {
  if (state === "ISSUED" || state === "RECONCILED") return "emerald";
  if (state === "RECONCILIATION_BREAK") return "rose";
  if (["DUPLICATE", "EXPIRED_QUOTE", "PAYMENT_FAILED", "CANCELLED", "UNAUTHORIZED", "INVALID_INSTRUMENT", "INVALID_PAYMENT", "SUPPLY_CAP_EXCEEDED"].includes(state)) {
    return "rose";
  }
  if (state === "AUTHORIZED" || state === "SUPPLY_CHECKED") return "amber";
  return "muted";
}

function StateChip({ state, highlight }: { state: string; highlight?: boolean }) {
  const tone = stateTone(state);
  const base =
    tone === "emerald"
      ? "border-mtqs-emerald/40 bg-mtqs-emerald/10 text-mtqs-emerald"
      : tone === "rose"
        ? "border-rose-400/40 bg-rose-400/10 text-rose-300"
        : tone === "amber"
          ? "border-mtqs-amber/40 bg-mtqs-amber/10 text-mtqs-amber"
          : "border-white/[0.08] bg-white/[0.03] text-white/60";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[0.62rem] font-medium tracking-tight ${base} ${
        highlight ? "ring-1 ring-mtqs-gold/60 ring-offset-1 ring-offset-[#0a0d18]" : ""
      }`}
    >
      {state}
    </span>
  );
}

function CheckMark({ ok }: { ok: boolean | null }) {
  if (ok === null) return <span className="text-white/30" aria-label="not applicable">—</span>;
  return ok ? (
    <CheckCircle2 className="h-3.5 w-3.5 text-mtqs-emerald" aria-label="matches expected" />
  ) : (
    <XCircle className="h-3.5 w-3.5 text-rose-400" aria-label="does not match expected" />
  );
}

function fmtClock(ms: number): string {
  // Deterministic demo clock — display as +offset from the fixed start.
  return `+${((ms - 1_800_000_000_000) / 1000).toFixed(0)}s`;
}

/* ---------- Section ---------- */

export function IssuanceSection({
  onNavigate: _onNavigate,
  snapshot: _snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  const [snap, setSnap] = useState<IssuanceGetDto | null>(null);
  const [snapError, setSnapError] = useState<string | null>(null);
  const [snapLoading, setSnapLoading] = useState(true);
  const [run, setRun] = useState<IssuancePostDto | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadSnapshot = useCallback(async () => {
    setSnapLoading(true);
    try {
      const res = await fetch("/api/issuance", { cache: "no-store" });
      if (!res.ok) {
        if (mountedRef.current) setSnapError(`HTTP ${res.status}`);
        return;
      }
      const dto = (await res.json()) as IssuanceGetDto;
      if (mountedRef.current) {
        setSnap(dto);
        setSnapError(null);
      }
    } catch (e) {
      if (mountedRef.current) setSnapError(String(e));
    } finally {
      if (mountedRef.current) setSnapLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const runScenario = useCallback(
    async (scenario: string) => {
      setRunning(scenario);
      setRunError(null);
      try {
        const res = await fetch("/api/issuance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario }),
        });
        const dto = await res.json();
        if (!res.ok) {
          setRunError(dto?.error ?? `HTTP ${res.status}`);
          return;
        }
        if (mountedRef.current) setRun(dto as IssuancePostDto);
        // Refresh the audit trail (the run just persisted new events).
        loadSnapshot();
      } catch (e) {
        if (mountedRef.current) setRunError(String(e));
      } finally {
        if (mountedRef.current) setRunning(null);
      }
    },
    [loadSnapshot],
  );

  const registryRows = snap?.registry.rows ?? [];
  const stableRows = registryRows.filter((r) => r.type !== "CBDC");
  const cbdcRows = registryRows.filter((r) => r.type === "CBDC");
  const visitedStates = new Set<string>(
    (run?.run.events ?? []).map((e) => e.to).filter((s): s is string => s !== null),
  );
  const finalState = run?.run.finalState;
  const finalIsGood = finalState === "ISSUED" || finalState === "RECONCILED";
  const observed = run?.run.expectedNumbers.observed;
  const checks = run?.run.expectedNumbers.checks;

  return (
    <div className="space-y-10">
      {/* ============ header ============ */}
      <SectionHeading
        eyebrow="§14 · payment-funded primary issuance"
        title="Issuance Lab"
        className="mb-0"
        right={
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            21-state machine · ALT-4 · TEST LEDGER
          </Pill>
        }
      />

      {/* ============ 1. hero / status band ============ */}
      <Reveal>
        <Panel className="p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-4">
            <Coins className="h-5 w-5 text-mtqs-gold/80 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white/90 mb-1">
                Payment-Funded Primary Issuance — Pilot (spec §14.4 12-step workflow / §14.6 8-stage controlled process)
              </h3>
              <p className="text-[0.78rem] text-white/55 leading-relaxed">
                A payment funds a primary issuance only through the full controlled workflow: request → quote →
                payment → authenticity → settlement finality → instrument re-check → fees → net value → ALT-4
                authorization → supply caps → <span className="text-white/85">ISSUED (ledger record)</span> →
                three-book reconciliation. <span className="text-mtqs-amber">A payment event ALONE never mints — INV-A, unconditional.</span>
              </p>
            </div>
          </div>

          {/* The honest status banner (verbatim from the API) */}
          <div
            className="rounded-lg border border-mtqs-amber/30 bg-mtqs-amber/[0.07] px-4 py-3 mb-4"
            role="status"
            aria-label="Honest status banner"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 text-mtqs-amber mt-0.5 shrink-0" aria-hidden="true" />
              <p className="text-[0.74rem] font-semibold text-amber-100/90 tracking-wide leading-relaxed">
                {snapLoading && !snap ? "…" : (snap?.banner ?? "TESTNET ONLY · SHADOW MODE ENFORCED · LEDGER RECORDS ONLY — NEVER ON-CHAIN · ECONOMIC VALUES UNAPPROVED / ILLUSTRATIVE · NOT ACCEPTED")}
              </p>
            </div>
          </div>

          {/* Status pills row */}
          <div className="flex flex-wrap gap-2">
            <Pill tone="gold">
              <GlowDot color="gold" size="h-1.5 w-1.5" />
              D-13.27: ADOPTED (DELEGATED) 2026-10-23 — PENDING OWNER RATIFICATION
            </Pill>
            <Pill tone="amber">
              <GlowDot color="amber" size="h-1.5 w-1.5" />
              CBDC adapter: SIMULATED / NOT CONNECTED
            </Pill>
            <Pill tone="muted">fee/quote FORM adopted · VALUES UNAPPROVED</Pill>
            <Pill tone="rose">ISSUED = LEDGER RECORD ONLY — NEVER ON-CHAIN</Pill>
          </div>

          {/* Machine label */}
          <p className="mt-4 text-[0.68rem] text-white/40 leading-relaxed">
            {snap?.labels.machineLabel ??
              "PAYMENT-FUNDED PRIMARY ISSUANCE STATE MACHINE — TEST LEDGER ONLY · NEVER ON-CHAIN · ISSUED = LEDGER RECORD ONLY."}
          </p>
          {snap?.labels.d1327Status ? (
            <p className="mt-2 text-[0.66rem] text-white/35 leading-relaxed">
              D-13.27 — {snap.labels.d1327Status}
            </p>
          ) : null}
        </Panel>
      </Reveal>

      {/* ============ 2. instrument registry panel ============ */}
      <section id="issuance-registry" aria-labelledby="issuance-registry-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§3–§5 · instrument registry"
          title="Payment Instrument Registry"
          className="mb-0"
          right={
            <Pill tone="amber">
              <GlowDot color="amber" size="h-1.5 w-1.5" />
              TEST-ONLY fixtures
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            <h3 id="issuance-registry-h" className="text-sm font-semibold text-white/90 mb-1">
              BORN EMPTY · FAIL-CLOSED ADMISSION
            </h3>
            <p className="text-[0.74rem] text-white/55 leading-relaxed mb-4">
              {snap?.registry.bornEmptyNote ??
                "BORN EMPTY — the production registry is born empty and admission is FAIL-CLOSED; the rows below are TEST-ONLY synthetic fixtures."}
            </p>

            {snapError ? (
              <div className="p-4 rounded-lg border border-rose-400/30 bg-rose-400/[0.06]">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert className="h-4 w-4 text-rose-300" aria-hidden="true" />
                  <span className="text-[0.8rem] font-semibold text-rose-100">Registry snapshot unavailable</span>
                </div>
                <p className="text-[0.72rem] text-rose-100/70 mb-2">/api/issuance did not respond ({snapError}).</p>
                <button
                  onClick={loadSnapshot}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[0.72rem] text-white/75 hover:bg-white/[0.08] transition-colors"
                  aria-label="Retry registry snapshot"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" /> Retry
                </button>
              </div>
            ) : snapLoading && !snap ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Stablecoin-pathway rows */}
                {stableRows.map((r) => (
                  <div key={r.instrumentId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-semibold text-mtqs-gold">{r.code}</span>
                        <span className="text-[0.68rem] text-white/50">@ {r.network}</span>
                        <Pill tone={r.state === "ACTIVE" ? "emerald" : r.state === "RETIRED" ? "rose" : "amber"}>
                          {r.state}
                        </Pill>
                        <Pill tone="rose">
                          <Ban className="h-3 w-3" aria-hidden="true" />
                          TEST-ONLY
                        </Pill>
                      </div>
                      <span className="text-[0.62rem] font-mono text-white/40">{r.instrumentId}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-[0.68rem]">
                      <div>
                        <span className="text-white/40">issuer: </span>
                        <span className="text-white/75">{r.issuer.legalName}</span>
                      </div>
                      <div>
                        <span className="text-white/40">jurisdiction: </span>
                        <span className="text-white/75">{r.issuer.jurisdiction}</span>
                      </div>
                      <div>
                        <span className="text-white/40">finality: </span>
                        <span className="text-white/75">{r.confirmation.kind}</span>
                      </div>
                      <div>
                        <span className="text-white/40">conversion: </span>
                        <span className="font-mono text-white/75">{r.valuation.pricePerUnit}</span>
                        <span className="text-white/40"> TU/unit</span>
                      </div>
                    </div>
                    <p className="mt-2 text-[0.64rem] text-white/45 leading-relaxed">{r.statusLabel}</p>
                  </div>
                ))}

                {/* CBDC rows — SIMULATED / NOT CONNECTED overlay */}
                <div className="relative rounded-xl border border-mtqs-amber/25 bg-mtqs-amber/[0.03] p-4">
                  <div className="absolute right-3 top-3 z-10">
                    <Pill tone="amber">
                      <GlowDot color="amber" size="h-1.5 w-1.5" />
                      SIMULATED / NOT CONNECTED
                    </Pill>
                  </div>
                  <h4 className="text-[0.78rem] font-semibold text-white/85 mb-2 pr-44 sm:pr-52">
                    CBDC rows — born NOT_CONNECTED (spec §4/§5.3)
                  </h4>
                  <div className="space-y-2">
                    {cbdcRows.map((r) => (
                      <div
                        key={r.instrumentId}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1"
                      >
                        <span className="font-mono text-[0.78rem] font-semibold text-mtqs-gold">{r.code}</span>
                        <span className="text-[0.64rem] text-white/50">@ {r.network}</span>
                        <Pill tone="muted">{r.state}</Pill>
                        <Pill tone="amber">{r.honestyState}</Pill>
                        <span className="text-[0.6rem] text-white/40 font-mono">{r.instrumentId}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[0.66rem] text-amber-100/70 leading-relaxed">
                    A CBDC row may leave NOT_CONNECTED only via (i) a verified authorized interface and (ii) a
                    recorded end-to-end test — <span className="font-medium text-mtqs-amber">NEITHER EXISTS</span>.
                    The cbdc-simulated scenario below runs in labeled SIMULATION MODE only: the registry row stays
                    NOT_CONNECTED; it is NOT an integration.
                  </p>
                </div>

                {/* SEP separation strip */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Scale className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                    <h4 className="text-[0.76rem] font-semibold text-white/85">
                      Separation invariant (spec §2) — payment volume never changes weights
                    </h4>
                    {snap?.separation.byteStable ? (
                      <Pill tone="emerald">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        snapshot byte-stable
                      </Pill>
                    ) : null}
                  </div>
                  {snap?.separation ? (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {Object.entries(snap.separation.weightsPct).map(([k, v]) => (
                        <span
                          key={k}
                          className="rounded-md border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[0.62rem] text-white/65"
                        >
                          {k} {v.toFixed(1)}%
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-[0.64rem] text-white/45 leading-relaxed">
                    {snap?.separation.label ??
                      "SEPARATION INVARIANT CHECK — canonical basket/constituency snapshot captured READ-ONLY."}{" "}
                    Every scenario run below re-captures this snapshot before and after and proves byte-identity.
                  </p>
                </div>
              </div>
            )}
          </Panel>
        </Reveal>
      </section>

      {/* ============ 3. scenario runner ============ */}
      <section id="issuance-runner" aria-labelledby="issuance-runner-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§14.4 · 12-step workflow · demo"
          title="Scenario Runner"
          className="mb-0"
          right={
            <Pill tone="rose">
              <GlowDot color="rose" size="h-1.5 w-1.5" />
              LEDGER RECORDS ONLY — NEVER ON-CHAIN
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            <h3 id="issuance-runner-h" className="text-sm font-semibold text-white/90 mb-1">
              Eight deterministic demo scenarios (synthetic fixtures · fixed clock)
            </h3>
            <p className="text-[0.72rem] text-white/50 leading-relaxed mb-4">
              Each run builds a FRESH machine on TEST-ONLY fixtures with a fixed deterministic clock
              (1,800,000,000,000 ms) — the same scenario always produces the identical event sequence. Runs are
              demos of the §14.4 workflow, not production issuance; every event is persisted to the audit trail below.
            </p>

            {/* Scenario buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4" role="group" aria-label="Issuance demo scenarios">
              {SCENARIOS.map((s) => {
                const isRunning = running === s.id;
                const isLast = run?.run.scenario === s.id && !isRunning;
                return (
                  <button
                    key={s.id}
                    onClick={() => runScenario(s.id)}
                    disabled={running !== null}
                    aria-label={`Run the ${s.label} issuance demo scenario`}
                    className={`text-left rounded-xl border p-3 transition-colors min-h-[44px] ${
                      isRunning
                        ? "border-mtqs-gold/50 bg-mtqs-gold/10"
                        : isLast
                          ? "border-mtqs-emerald/40 bg-mtqs-emerald/[0.07]"
                          : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.16]"
                    } ${running !== null && !isRunning ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[0.76rem] font-semibold text-white/85">{s.label}</span>
                      {isRunning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-mtqs-gold" aria-label="running" />
                      ) : (
                        <Play className="h-3 w-3 text-white/35" aria-hidden="true" />
                      )}
                    </div>
                    <p className="text-[0.62rem] text-white/50 leading-relaxed">{s.blurb}</p>
                  </button>
                );
              })}
            </div>

            {runError ? (
              <div className="mb-4 p-3 rounded-lg border border-rose-400/30 bg-rose-400/[0.06]">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-300" aria-hidden="true" />
                  <span className="text-[0.76rem] font-semibold text-rose-100">Scenario run failed</span>
                </div>
                <p className="text-[0.68rem] text-rose-100/70 mt-1">{runError}</p>
              </div>
            ) : null}

            {/* Run result */}
            {running && !run ? (
              <div className="flex items-center justify-center gap-2 py-10">
                <Loader2 className="h-4 w-4 animate-spin text-mtqs-gold" aria-hidden="true" />
                <span className="text-[0.76rem] text-white/55">Running the deterministic scenario…</span>
              </div>
            ) : null}

            {run ? (
              <div className="space-y-4">
                {/* final-state callout */}
                <div
                  className={`rounded-xl border p-4 ${
                    finalIsGood ? "border-mtqs-emerald/40 bg-mtqs-emerald/[0.06]" : "border-rose-400/40 bg-rose-400/[0.06]"
                  }`}
                  role="status"
                  aria-label="Final state callout"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="text-[0.6rem] uppercase tracking-[0.22em] text-white/50">final state</span>
                    <StateChip state={run.run.finalState} />
                    {finalIsGood ? (
                      <Pill tone="emerald">LEDGER RECORD ONLY — NEVER ON-CHAIN</Pill>
                    ) : (
                      <Pill tone="rose">terminal · fail-closed</Pill>
                    )}
                    {run.run.pipelineSuspended ? (
                      <Pill tone="rose">
                        <GlowDot color="rose" size="h-1.5 w-1.5" />
                        PIPELINE SUSPENDED
                      </Pill>
                    ) : null}
                    {run.run.cbdcSimulationMode ? (
                      <Pill tone="amber">SIMULATION MODE — NOT CONNECTED</Pill>
                    ) : null}
                  </div>
                  <p className="text-[0.72rem] text-white/60 leading-relaxed">
                    {run.run.scenarioDescription}
                  </p>
                  {run.run.terminalReasonCode ? (
                    <p className="mt-1 text-[0.68rem] font-mono text-white/50">
                      reason: {run.run.terminalReasonCode}
                      {run.run.terminalTaxonomyClass ? ` · taxonomy: ${run.run.terminalTaxonomyClass}` : ""}
                    </p>
                  ) : null}
                  {run.run.suspensionReasons.length > 0 ? (
                    <p className="mt-1 text-[0.66rem] text-rose-200/70">
                      suspension reasons: {run.run.suspensionReasons.join(" · ")}
                    </p>
                  ) : null}
                </div>

                {/* exact numbers row */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-[0.6rem] uppercase tracking-[0.22em] text-white/50">
                      exact numbers (6-decimal fixed point)
                    </span>
                    <Pill tone={run.run.expectedNumbers.met ? "emerald" : "rose"}>
                      {run.run.expectedNumbers.met ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> expectedNumbersMet: true
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" aria-hidden="true" /> expectedNumbersMet: false
                        </>
                      )}
                    </Pill>
                    <Pill tone="muted">clock {run.run.clockStartMs.toLocaleString("en-US")} ms · deterministic</Pill>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <Stat label="gross (TU)" value={observed?.gross ?? "—"} sub={<>fee-class {(Number(snap?.economics.fee.rateBps ?? 10) / 100).toFixed(2)}% <CheckMark ok={checks?.gross ?? null} /></>} />
                    <Stat label="fee (TU)" value={observed?.fee ?? "—"} sub={<CheckMark ok={checks?.fee ?? null} />} />
                    <Stat label="net (TU)" value={observed?.net ?? "—"} sub={<CheckMark ok={checks?.net ?? null} />} />
                    <Stat label="quote (TU/token)" value={observed?.quote ?? "—"} sub={<CheckMark ok={checks?.quote ?? null} />} />
                    <Stat label="issued (tokens)" value={observed?.issued ?? "—"} sub={<CheckMark ok={checks?.issued ?? null} />} />
                    <Stat label="supply after" value={observed?.supplyAfter ?? "—"} sub={<CheckMark ok={checks?.supplyAfter ?? null} />} />
                  </div>
                  <p className="mt-3 text-[0.62rem] text-white/40 leading-relaxed">
                    Expected happy-path chain: gross 10,000.000000 TEST-USDC-X → fee 10.000000 (0.10% ILLUSTRATIVE,
                    D-13.8 OPEN) → net 9,990.000000 → issued 4,995.000000 at 2.000000 TU/token (§14.5 FORM adopted,
                    derivation OPEN). Checks marked “—” are not applicable to this scenario (the flow ended before
                    that value was computed). All values UNAPPROVED / ILLUSTRATIVE.
                  </p>
                </div>

                {/* SEP separation proof */}
                <div className="rounded-xl border border-mtqs-emerald/25 bg-mtqs-emerald/[0.04] p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Scale className="h-4 w-4 text-mtqs-emerald/80" aria-hidden="true" />
                    <span className="text-[0.72rem] font-semibold text-emerald-100/90">
                      SEP separation proof — spec §2 invariant
                    </span>
                    <Pill tone={run.run.separation.byteIdenticalBeforeAfter ? "emerald" : "rose"}>
                      {run.run.separation.byteIdenticalBeforeAfter ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> byte-identical before → after
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" aria-hidden="true" /> DIVERGED
                        </>
                      )}
                    </Pill>
                  </div>
                  <p className="text-[0.68rem] text-white/55 leading-relaxed">
                    basket/constituency snapshot ({run.run.separation.snapshotBytesLength.toLocaleString("en-US")}{" "}
                    bytes, 7 components at strategic-prior weights) byte-identical before → after —{" "}
                    <span className="text-white/80">payment volume never changes weights.</span>
                  </p>
                </div>

                {/* mint record / exceptions / refunds */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {run.run.mintRecord ? (
                    <div className="rounded-xl border border-mtqs-emerald/30 bg-mtqs-emerald/[0.05] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Landmark className="h-4 w-4 text-mtqs-emerald/80" aria-hidden="true" />
                        <span className="text-[0.74rem] font-semibold text-white/85">Mint record (LEDGER ONLY)</span>
                      </div>
                      <div className="text-[0.68rem] font-mono text-white/65 space-y-1">
                        <div>mint: {run.run.mintRecord.mintId} · nonce {run.run.mintRecord.nonce}</div>
                        <div>
                          amount: <span className="text-mtqs-emerald">{run.run.mintRecord.amount}</span> tokens →{" "}
                          {run.run.mintRecord.recipientId}
                        </div>
                        <div>program: {run.run.mintRecord.programId}</div>
                      </div>
                      <p className="mt-2 text-[0.62rem] text-mtqs-emerald/80 font-medium">
                        {run.run.mintRecord.recordOnlyLabel}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Ban className="h-4 w-4 text-white/40" aria-hidden="true" />
                        <span className="text-[0.74rem] font-semibold text-white/70">No mint record</span>
                      </div>
                      <p className="text-[0.66rem] text-white/45 leading-relaxed">
                        This scenario never reaches step 10 — no ledger mint record exists for it. Issuance requires
                        settlement finality AND an applicable unrevoked ALT-4 authorization program (INV-A).
                      </p>
                    </div>
                  )}

                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4 text-mtqs-amber/80" aria-hidden="true" />
                      <span className="text-[0.74rem] font-semibold text-white/85">
                        Exceptions ({run.run.exceptions.length}) · Refunds ({run.run.refundQueue.length})
                      </span>
                    </div>
                    {run.run.exceptions.length === 0 && run.run.refundQueue.length === 0 ? (
                      <p className="text-[0.66rem] text-white/45">
                        None — the run completed with no open exception and no queued refund.
                      </p>
                    ) : (
                      <ul className="text-[0.66rem] text-white/60 space-y-1.5 max-h-40 overflow-y-auto mtqs-scroll pr-1">
                        {run.run.exceptions.map((e) => (
                          <li key={e.exceptionId} className="font-mono leading-relaxed">
                            <span className={e.status === "OPEN" ? "text-rose-300" : "text-mtqs-emerald"}>
                              {e.exceptionId} [{e.status}]
                            </span>{" "}
                            {e.taxonomyClass} — {e.reasonCode}
                          </li>
                        ))}
                        {run.run.refundQueue.map((r) => (
                          <li key={r.refundId} className="font-mono leading-relaxed">
                            <span className="text-mtqs-amber">{r.refundId} [{r.state}]</span> {r.reasonCode} ·{" "}
                            {r.grossInstrumentAmount} (same idempotency key {r.idempotencyKey})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* reconciliation checks */}
                {run.run.ledgerView.mints.length > 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ListOrdered className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                      <span className="text-[0.74rem] font-semibold text-white/85">
                        Three-book reconciliation (spec §6.5 — C1–C4)
                      </span>
                      <Pill tone={run.run.ledgerView.reconciliation.balanced ? "emerald" : "rose"}>
                        {run.run.ledgerView.reconciliation.balanced ? "BALANCED" : "BREAK"}
                      </Pill>
                    </div>
                    <ul className="text-[0.66rem] font-mono text-white/60 space-y-1">
                      {run.run.ledgerView.reconciliation.checks.map((c) => (
                        <li key={c.check} className="flex items-start gap-1.5">
                          {c.passed ? (
                            <CheckCircle2 className="h-3 w-3 mt-0.5 text-mtqs-emerald shrink-0" aria-hidden="true" />
                          ) : (
                            <XCircle className="h-3 w-3 mt-0.5 text-rose-400 shrink-0" aria-hidden="true" />
                          )}
                          <span>
                            {c.check} — <span className="text-white/45">{c.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* step trace timeline */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="h-4 w-4 text-mtqs-gold/70" aria-hidden="true" />
                      <span className="text-[0.74rem] font-semibold text-white/85">
                        Step trace — {run.run.events.length} events (§14.4 step mapping)
                      </span>
                    </div>
                    <span className="text-[0.6rem] font-mono text-white/35">
                      machine {run.run.machineId} · request {run.run.finalRequestId}
                    </span>
                  </div>
                  <ol className="relative border-l border-white/[0.08] ml-2 space-y-3 max-h-[28rem] overflow-y-auto mtqs-scroll pl-4" aria-label="Issuance event trace">
                    {run.run.events.map((e) => {
                      const toTone = e.to ? stateTone(e.to) : null;
                      return (
                        <li key={e.seq} className="relative">
                          <span
                            className={`absolute -left-[21px] top-1 h-2 w-2 rounded-full ${
                              toTone === "emerald"
                                ? "bg-mtqs-emerald"
                                : toTone === "rose"
                                  ? "bg-rose-400"
                                  : toTone === "amber"
                                    ? "bg-mtqs-amber"
                                    : "bg-white/30"
                            }`}
                            aria-hidden="true"
                          />
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <span className="font-mono text-[0.58rem] text-white/35">
                              #{String(e.seq).padStart(2, "0")} · {fmtClock(e.atMs)}
                            </span>
                            {e.from ? <StateChip state={e.from} /> : null}
                            {e.from || e.to ? (
                              <span className="text-white/30 text-[0.6rem]" aria-hidden="true">
                                →
                              </span>
                            ) : null}
                            {e.to ? <StateChip state={e.to} /> : <Pill tone="muted">machine-level</Pill>}
                          </div>
                          <div className="font-mono text-[0.66rem] text-mtqs-gold-light/90">{e.reasonCode}</div>
                          <p className="text-[0.66rem] text-white/50 leading-relaxed mt-0.5">{e.detail}</p>
                          <p className="text-[0.58rem] text-white/30 mt-0.5">{e.stepRef}</p>
                          {(e.econ.grossAmount || e.econ.feeAmount || e.econ.netAmount || e.econ.issuedAmount) && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {e.econ.grossAmount ? (
                                <span className="rounded border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[0.58rem] text-white/55">
                                  gross {e.econ.grossAmount}
                                </span>
                              ) : null}
                              {e.econ.feeAmount ? (
                                <span className="rounded border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[0.58rem] text-white/55">
                                  fee {e.econ.feeAmount}
                                </span>
                              ) : null}
                              {e.econ.netAmount ? (
                                <span className="rounded border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[0.58rem] text-white/55">
                                  net {e.econ.netAmount}
                                </span>
                              ) : null}
                              {e.econ.quote ? (
                                <span className="rounded border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[0.58rem] text-white/55">
                                  quote {e.econ.quote}
                                </span>
                              ) : null}
                              {e.econ.issuedAmount ? (
                                <span className="rounded border border-mtqs-emerald/25 bg-mtqs-emerald/[0.07] px-1.5 py-0.5 font-mono text-[0.58rem] text-mtqs-emerald">
                                  issued {e.econ.issuedAmount}
                                </span>
                              ) : null}
                              {e.econ.supplyAfter ? (
                                <span className="rounded border border-white/[0.07] bg-white/[0.02] px-1.5 py-0.5 font-mono text-[0.58rem] text-white/55">
                                  supply {e.econ.supplyAfter}
                                </span>
                              ) : null}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {/* demo disclaimer + persistence disclosure */}
                <div className="rounded-lg border border-mtqs-amber/25 bg-mtqs-amber/[0.05] px-4 py-3">
                  <p className="text-[0.66rem] text-amber-100/80 leading-relaxed">{run.demoDisclaimer}</p>
                  <p className="text-[0.62rem] text-white/45 mt-1.5 leading-relaxed">
                    Persistence: {run.run.persistence.disclosed}
                    {run.run.persistence.error ? (
                      <span className="text-rose-300"> (error: {run.run.persistence.error})</span>
                    ) : null}
                  </p>
                </div>
              </div>
            ) : null}
          </Panel>
        </Reveal>
      </section>

      {/* ============ 4. economics panel ============ */}
      <section id="issuance-economics" aria-labelledby="issuance-economics-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§14.5 / D-13.8 / D-13.6 · economics"
          title="Fee, Quote & Supply Policy"
          className="mb-0"
          right={
            <Pill tone="rose">
              <GlowDot color="rose" size="h-1.5 w-1.5" />
              ALL VALUES UNAPPROVED
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            <h3 id="issuance-economics-h" className="sr-only">
              Fee, quote, and supply policy parameters — all unapproved illustrative values
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* fee */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[0.72rem] font-semibold text-white/85">Fee schedule</span>
                  <Pill tone="rose">UNAPPROVED · D-13.8 OPEN</Pill>
                </div>
                <div className="font-mono text-xl text-mtqs-gold mb-1">
                  {/* Live from the API payload (economics.fee.rateBps, bps → %)
                      with the same fallback string the sibling panels use. */}
                  {snap ? `${(Number(snap.economics.fee.rateBps) / 100).toFixed(2)}%` : "0.10%"}
                  <span className="text-sm text-white/40"> flat</span>
                </div>
                <p className="text-[0.62rem] text-white/45 leading-relaxed">
                  {snap?.economics.fee.label ??
                    "ILLUSTRATIVE — D-13.8 OPEN: 0.10% flat named default. FORM adopted (delegated) 2026-10-23 pending owner ratification."}
                </p>
              </div>
              {/* quote */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[0.72rem] font-semibold text-white/85">Issuance quote</span>
                  <Pill tone="rose">ILLUSTRATIVE · derivation OPEN</Pill>
                </div>
                <div className="font-mono text-xl text-mtqs-gold mb-1">
                  {snap?.economics.quote.tuPerToken ?? "2.000000"}
                  <span className="text-sm text-white/40"> TU/token</span>
                </div>
                <p className="text-[0.62rem] text-white/45 leading-relaxed">
                  §14.5 FORM adopted (issued = net accepted payment value ÷ issuance quote); the quote-derivation
                  policy publication remains OPEN. Validity window{" "}
                  {snap?.economics.quote.validityWindowMinutes ?? 15} min (ILLUSTRATIVE, D-13.19). An index-derived
                  quote is never a promise of later market value (three-measurement separation).
                </p>
              </div>
              {/* supply caps */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[0.72rem] font-semibold text-white/85">Supply caps</span>
                  <Pill tone="rose">ILLUSTRATIVE · D-13.6 deferred</Pill>
                </div>
                <div className="space-y-1.5 mb-2">
                  <div className="flex justify-between text-[0.68rem]">
                    <span className="text-white/50">per-transaction</span>
                    <span className="font-mono text-white/80">{snap?.economics.supply.perTxCap ?? "500000.000000"}</span>
                  </div>
                  <div className="flex justify-between text-[0.68rem]">
                    <span className="text-white/50">tranche ({snap?.economics.supply.trancheId ?? "TRANCHE-TEST-001"})</span>
                    <span className="font-mono text-white/80">{snap?.economics.supply.trancheCap ?? "1000000.000000"}</span>
                  </div>
                  <div className="flex justify-between text-[0.68rem]">
                    <span className="text-white/50">global max supply</span>
                    <span className="font-mono text-white/80">{snap?.economics.supply.globalMax ?? "10000000.000000"}</span>
                  </div>
                </div>
                <p className="text-[0.62rem] text-white/45 leading-relaxed">
                  D-13.6 supply-cap numbers are deferred to owner approval; every cap check is fail-closed (an
                  issuance that would exceed any cap is rejected and never minted).
                </p>
              </div>
            </div>
            <p className="mt-4 text-[0.62rem] text-white/40 leading-relaxed">
              Rounding: {snap?.economics.roundingRule ?? "ROUND_HALF_TO_EVEN @ 6 decimals (PROPOSED — UNAPPROVED)"}.
              Money math is exact 6-decimal fixed point on BigInt — no floating point anywhere in the pipeline.
            </p>
          </Panel>
        </Reveal>
      </section>

      {/* ============ 5. state machine map ============ */}
      <section id="issuance-states" aria-labelledby="issuance-states-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§14.4 · 21 states"
          title="State Machine Map"
          className="mb-0"
          right={
            <Pill tone="muted">
              {visitedStates.size > 0
                ? `${visitedStates.size} state${visitedStates.size === 1 ? "" : "s"} visited by the last run`
                : "run a scenario to trace states"}
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            <h3 id="issuance-states-h" className="text-sm font-semibold text-white/90 mb-3">
              Happy-path chain (§14.4 steps 1–11) — 12 flow states
            </h3>
            <div className="flex flex-wrap items-center gap-1.5 mb-5">
              {(snap?.states.happyPath ?? []).map((s, i) => (
                <span key={s} className="flex items-center gap-1.5">
                  <StateChip state={s} highlight={visitedStates.has(s)} />
                  {i < (snap?.states.happyPath.length ?? 0) - 1 ? (
                    <span className="text-white/25 text-[0.6rem]" aria-hidden="true">
                      →
                    </span>
                  ) : null}
                </span>
              ))}
            </div>

            <h4 className="text-sm font-semibold text-white/90 mb-3">
              Terminal failure states (spec §6.6 taxonomy) — 9
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
              {(snap?.states.terminal ?? []).map((s) => (
                <StateChip key={s} state={s} highlight={visitedStates.has(s)} />
              ))}
            </div>

            <p className="mt-4 text-[0.64rem] text-white/45 leading-relaxed">
              The transition table is EXPLICIT (no skipping): the machine enforces INV-A as a hard guard inside the
              ISSUED transition — settlement finality AND an applicable unrevoked ALT-4 authorization record AND
              SUPPLY_CHECKED AND a non-suspended pipeline are ALL required. Gold-highlighted chips mark the states
              visited by the last scenario run. Full step references per state are returned by the API
              (STATE_STEP_REFS) and printed in every trace event above.
            </p>
          </Panel>
        </Reveal>
      </section>

      {/* ============ 6. audit trail ============ */}
      <section id="issuance-audit" aria-labelledby="issuance-audit-h" className="scroll-mt-32">
        <SectionHeading
          eyebrow="§14.4 step 12 · audit publication"
          title="Issuance Audit Trail"
          className="mb-0"
          right={
            <div className="flex items-center gap-2">
              {snap?.events.dbError ? (
                <Pill tone="rose">
                  <GlowDot color="rose" size="h-1.5 w-1.5" />
                  DB mirror error
                </Pill>
              ) : (
                <Pill tone="emerald">
                  <GlowDot color="emerald" size="h-1.5 w-1.5" />
                  {snap?.events.totalPersisted ?? 0} events persisted
                </Pill>
              )}
              <button
                onClick={loadSnapshot}
                disabled={snapLoading}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[0.72rem] text-white/75 hover:bg-white/[0.08] transition-colors min-h-[36px] disabled:opacity-50"
                aria-label="Refresh the issuance audit trail"
              >
                <RefreshCw className={`h-3 w-3 ${snapLoading ? "animate-spin" : ""}`} aria-hidden="true" />
                Refresh
              </button>
            </div>
          }
        />
        <Reveal>
          <Panel className="p-5">
            <div className="flex items-start gap-3 mb-3">
              <History className="h-4 w-4 text-mtqs-gold/70 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <h3 id="issuance-audit-h" className="text-sm font-semibold text-white/90 mb-1">
                  Last 50 IssuanceEvent rows (Prisma durability mirror)
                </h3>
                <p className="text-[0.68rem] text-white/50 leading-relaxed">
                  {snap?.auditNote ??
                    "The DB is the durability mirror (fail-soft-disclosed); the machine's in-memory event log is authoritative."}
                </p>
              </div>
            </div>

            {snap?.events.dbError ? (
              <div className="p-3 rounded-lg border border-rose-400/30 bg-rose-400/[0.06] mb-3">
                <p className="text-[0.7rem] text-rose-100/80">
                  DB read failed (fail-soft-disclosed): {snap.events.dbError}. The in-memory log of each run remains
                  authoritative and fully shown in the scenario runner above.
                </p>
              </div>
            ) : null}

            {snapLoading && !snap ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-md" />
                ))}
              </div>
            ) : (snap?.events.rows.length ?? 0) === 0 ? (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center">
                <Database className="h-5 w-5 text-white/30 mx-auto mb-2" aria-hidden="true" />
                <p className="text-[0.74rem] text-white/55">
                  No issuance events persisted yet — run a scenario above and the audit trail will fill in.
                </p>
                <p className="text-[0.62rem] text-white/35 mt-1">
                  Every scenario run persists its full event log here (fail-soft-disclosed).
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-white/[0.06]">
                <div className="max-h-96 overflow-y-auto mtqs-scroll">
                  <table className="w-full text-[0.68rem]">
                    <caption className="sr-only">
                      Persisted issuance audit events — newest first
                    </caption>
                    <thead className="bg-white/[0.02] text-white/55 sticky top-0">
                      <tr>
                        <th scope="col" className="text-left px-2.5 py-2 font-medium">time (UTC)</th>
                        <th scope="col" className="text-left px-2.5 py-2 font-medium">request</th>
                        <th scope="col" className="text-left px-2.5 py-2 font-medium">kind</th>
                        <th scope="col" className="text-left px-2.5 py-2 font-medium">state</th>
                        <th scope="col" className="text-right px-2.5 py-2 font-medium">gross</th>
                        <th scope="col" className="text-right px-2.5 py-2 font-medium">fee</th>
                        <th scope="col" className="text-right px-2.5 py-2 font-medium">net</th>
                        <th scope="col" className="text-right px-2.5 py-2 font-medium">issued</th>
                        <th scope="col" className="text-right px-2.5 py-2 font-medium">supply after</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(snap?.events.rows ?? []).map((r, i) => (
                        <tr key={r.id} className={`border-t border-white/[0.06] ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                          <td className="px-2.5 py-1.5 font-mono text-white/45 whitespace-nowrap">
                            {new Date(r.createdAt).toISOString().slice(11, 19)}
                          </td>
                          <td className="px-2.5 py-1.5 font-mono text-white/60">{r.requestId || "—"}</td>
                          <td className="px-2.5 py-1.5">
                            <span className="rounded border border-white/[0.08] bg-white/[0.02] px-1 py-0.5 font-mono text-[0.6rem] text-mtqs-gold-light/80">
                              {r.kind}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5">
                            {r.state ? <StateChip state={r.state} /> : <span className="text-white/30">—</span>}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-white/55">{r.grossAmount || "—"}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-white/55">{r.feeAmount || "—"}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-white/55">{r.netAmount || "—"}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-mtqs-emerald/90">{r.issuedAmount || "—"}</td>
                          <td className="px-2.5 py-1.5 text-right font-mono text-white/55">{r.supplyAfter || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p className="mt-3 text-[0.6rem] text-white/35 leading-relaxed">
              Rows are the flat IssuanceEvent persistence docs (requestId · kind · state · instrument · exact
              6-decimal amounts · supply-after · JSON payload). The machine&apos;s synchronous in-memory event log —
              shown per-run in the Scenario Runner — is the AUTHORITATIVE record; this table is the durability mirror.
            </p>
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}
