// MTQΣ — Chains & Oracle Deployments sub-surface (T47 merge).
//
// Formerly a standalone "Networks" tab — folded UNDER the Contracts & Chains
// tab (2026-11-06): its chain-card grid duplicated the contract registry's
// canonical cards + metadata strip (chainID / currency / RPC / deployer /
// explorer / canonical MTQΣ) and the one-letter label collided with the
// live "Network NOC" tab. What remains here is the UNIQUE content:
//   • the OD-34 / §17.10 on-chain oracle deployment registry
//     (CHAIN_ORACLE_DEPLOYMENTS + getOracleFeedSummary, with the module's
//     honest UNVERIFIED feed labels verbatim),
//   • chain policy notes (incl. the Solana Gate-7 deferral),
//   • the §1.7 independent-verification banner with the DEPLOYER_WALLET.
//
// Props: { onNavigate, snapshot } (both unused — signature kept for the
// PCC render-map uniformity).

"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { ShieldAlert, FileWarning } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading } from "@/components/mtq/primitives";
import { TruthBanner } from "@/components/mtq/TruthBanner";
import { shortAddr, copyToClipboard } from "@/components/mtq/format";
import { DEPLOYER_WALLET } from "@/lib/mtq/contracts";
import {
  CHAIN_ORACLE_DEPLOYMENTS,
  getOracleFeedSummary,
} from "@/lib/mtq/oracle-feeds";
import type { SectionId } from "@/components/mtq/Navigation";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

/* ---------- Copy button (same pattern as ContractsSection) ---------- */
function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      onClick={async (e) => {
        e.preventDefault();
        const ok = await copyToClipboard(value);
        if (ok) toast.success(`Copied ${label}`, { description: shortAddr(value) });
        else toast.error("Copy failed");
      }}
      className="text-[0.65rem] font-mono text-mtqs-gold/70 hover:text-mtqs-gold transition px-1.5 py-0.5 rounded border border-transparent hover:border-mtqs-amber/30"
      aria-label={`Copy ${label}`}
    >
      copy
    </button>
  );
}

/* ---------- Small key/value cell ---------- */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-2.5 min-w-0">
      <div className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">{label}</div>
      <div className="mt-0.5 text-[0.7rem] text-[#0E1F1B] break-words">{children}</div>
    </div>
  );
}

/* ============================================================
   NetworksSection — unique deployment content (T47: renders under
   the Contracts & Chains tab; the chain-card grid was removed as a
   duplicate of the contract registry above it)
   ============================================================ */
export function NetworksSection({
  onNavigate: _onNavigate,
  snapshot: _snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  // OD-34 / Ext-3 A.4 summary — deterministic, computed from the registry.
  const oracleSummary = useMemo(() => getOracleFeedSummary(), []);
  // The USDC/USD construct row note (verbatim from the module).
  const constructNote = oracleSummary.stalenessTable.find((r) => r.feedClass === null)?.note;

  return (
    <div className="space-y-10">
      {/* ---------- Sub-surface heading (T47: no page-level heading — this
          renders under the Contracts & Chains tab heading) ---------- */}
      <Reveal>
        <TruthBanner lines={["TESTNET ONLY", "RESERVE TRADING NOT AUTHORIZED"]}>
          <p className="text-[0.68rem] leading-relaxed text-[#5B6E68]">
            Appendix D.1: the v2.0 testnet edition targets Arc, Monad and Solana Devnet —
            the registry contains exactly these three owner-declared deployments (the former
            Base/Arbitrum mainnet placeholders were removed 2026-10-24). The pilot operates
            on testnets only, and every network the contracts inhabit must return the same
            honest status. Chain IDs, RPC endpoints, explorers, deployer wallets and
            canonical MTQΣ addresses render in the registry above.
          </p>
        </TruthBanner>
      </Reveal>

      {/* ---------- On-chain oracle deployments (OD-34 / §17.10) ---------- */}
      <section
        id="networks-oracle-deployments"
       
        className="scroll-mt-32"
      >
        <SectionHeading
          eyebrow="§17.10 / od-34 · oracle.sol deployments"
          title="On-Chain Oracle Deployments"
          right={
            <Pill tone="amber">
              <FileWarning className="h-3 w-3" aria-hidden="true" />
              feed contents UNVERIFIED
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Cell label="Feed pairs (registry)">
                <span className="font-mono text-mtqs-gold">{oracleSummary.counts.pairs}</span>
              </Cell>
              <Cell label="§17.10 pairs">
                <span className="font-mono text-mtqs-gold">
                  {oracleSummary.counts.section1710Pairs}
                </span>
              </Cell>
              <Cell label="Chains tracked">
                <span className="font-mono text-mtqs-gold">{oracleSummary.counts.chains}</span>
              </Cell>
              <Cell label="Protocol-owner EVM oracles">
                <span className="font-mono text-mtqs-gold">
                  {oracleSummary.counts.protocolOwnerEvmOracleDeployments}
                </span>
              </Cell>
            </div>

            <div className="space-y-3">
              {CHAIN_ORACLE_DEPLOYMENTS.map((dep) => (
                <div
                  key={dep.id}
                  className="rounded-lg border border-[#E3EAE6] bg-[#F7FAF8] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.8rem] font-semibold text-[#0E1F1B]">{dep.label}</span>
                      <span className="font-mono text-[0.62rem] text-[#5B6E68]">
                        chainId {String(dep.chainId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Pill
                        tone={
                          dep.codeStatus === "verified-present"
                            ? "emerald"
                            : dep.codeStatus === "existence-unverified"
                            ? "amber"
                            : "muted"
                        }
                      >
                        <GlowDot
                          color={dep.codeStatus === "verified-present" ? "emerald" : "amber"}
                          size="h-1.5 w-1.5"
                        />
                        {dep.codeStatus}
                      </Pill>
                      <Pill tone={dep.gateStatus === "Gate-2-configured" ? "gold" : "muted"}>
                        {dep.gateStatus}
                      </Pill>
                    </div>
                  </div>

                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-2.5 min-w-0">
                      <div className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">
                        Protocol-owner Oracle.sol
                      </div>
                      {dep.onChainOracle ? (
                        <div className="mt-0.5 flex items-center gap-1 min-w-0 flex-wrap">
                          <span
                            className="font-mono text-[0.66rem] text-mtqs-gold break-all"
                            title={dep.onChainOracle}
                          >
                            {dep.onChainOracle}
                          </span>
                          <CopyButton value={dep.onChainOracle} label={`${dep.label} Oracle.sol`} />
                        </div>
                      ) : (
                        <div className="mt-0.5 font-mono text-[0.66rem] text-[#5B6E68]">
                          none — Gate 7 external feeds
                        </div>
                      )}
                      <div className="mt-1 text-[0.6rem] text-[#5B6E68]">
                        {dep.oracleContract ?? "no protocol-owner on-chain oracle"} · ABI status:{" "}
                        <span className="text-amber-700/85">{dep.abiStatus}</span>
                      </div>
                    </div>
                    <div className="rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-2.5 min-w-0">
                      <div className="text-[0.6rem] uppercase tracking-[0.16em] text-[#5B6E68]">
                        providerFeedAddress
                      </div>
                      <div className="mt-0.5 font-mono text-[0.66rem] text-amber-700">
                        null — pending OD-34 confirmation
                      </div>
                      <div className="mt-1 text-[0.6rem] leading-relaxed text-[#5B6E68]">
                        No adapter instance exists at any address on any chain; every
                        providerFeedAddress in the registry is null.
                      </div>
                    </div>
                  </div>

                  <div className="mt-2.5 rounded-md border border-mtqs-amber/25 bg-mtqs-amber/[0.05] p-2.5">
                    <div className="text-[0.6rem] uppercase tracking-[0.16em] text-mtqs-amber/80">
                      Honest feed determination (Ext-3 A.4)
                    </div>
                    <p className="mt-0.5 text-[0.66rem] leading-relaxed text-[#5B6E68]">
                      {dep.feedDetermination}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Registry limitations — verbatim from getOracleFeedSummary() */}
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-[0.72rem] font-semibold text-[#0E1F1B]">
                <ShieldAlert className="h-3.5 w-3.5 text-mtqs-amber/80" aria-hidden="true" />
                Registry limitations (getOracleFeedSummary · OD-34)
              </div>
              <ul className="max-h-96 overflow-y-auto mtqs-scroll space-y-1.5 pr-2">
                {oracleSummary.limitations.map((l, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-[0.66rem] leading-relaxed text-[#5B6E68]"
                  >
                    <span className="mt-px w-4 shrink-0 text-right font-mono text-[0.6rem] text-mtqs-amber/70">
                      {i + 1}.
                    </span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* ---------- Chain policy notes ---------- */}
      <section id="networks-policy" className="scroll-mt-32">
        <SectionHeading
          eyebrow="policy · per-chain specifics"
          title="Chain Policy Notes"
          right={
            <Pill tone="muted">
              verbatim from contracts.ts / oracle-feeds.ts
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CHAIN_ORACLE_DEPLOYMENTS.filter((d) => d.onChainOracle !== null).map((dep) => (
                <div
                  key={dep.id}
                  className="rounded-lg border border-[#E3EAE6] bg-[#F7FAF8] p-3.5"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <GlowDot color="gold" size="h-1.5 w-1.5" />
                    <span className="text-[0.78rem] font-semibold text-[#0E1F1B]">{dep.label}</span>
                  </div>
                  <p className="text-[0.66rem] leading-relaxed text-[#5B6E68]">{dep.note}</p>
                </div>
              ))}
              <div className="rounded-lg border border-[#E3EAE6] bg-[#F7FAF8] p-3.5">
                <div className="mb-1.5 flex items-center gap-2">
                  <GlowDot color="gold" size="h-1.5 w-1.5" />
                  <span className="text-[0.78rem] font-semibold text-[#0E1F1B]">
                    Solana Devnet — deferred to Gate 7
                  </span>
                </div>
                <p className="text-[0.66rem] leading-relaxed text-[#5B6E68]">
                  {CHAIN_ORACLE_DEPLOYMENTS.find((d) => d.id === "solana")?.note ??
                    "deferred-G7"}
                </p>
                <ul className="mt-2 space-y-1">
                  {CHAIN_ORACLE_DEPLOYMENTS.find((d) => d.id === "solana")?.plannedFamilies?.map(
                    (f) => (
                      <li
                        key={f.family}
                        className="flex items-center gap-2 text-[0.64rem] text-[#5B6E68]"
                      >
                        <Pill tone="muted">{f.status}</Pill>
                        <span className="text-[#0E1F1B]">{f.family}</span>
                        <span className="text-[#5B6E68]">— {f.role}</span>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            </div>
            {constructNote ? (
              <div className="mt-3 rounded-md border border-[#E3EAE6] bg-[#F7FAF8] p-3">
                <div className="text-[0.6rem] uppercase tracking-[0.16em] text-mtqs-gold/75">
                  USDC/USD — construct pair
                </div>
                <p className="mt-0.5 text-[0.66rem] leading-relaxed text-[#5B6E68]">
                  {constructNote}
                </p>
              </div>
            ) : null}
          </Panel>
        </Reveal>
      </section>

      {/* ---------- §1.7 verification banner + deployer wallet ---------- */}
      <section id="networks-verification" className="scroll-mt-32">
        <Reveal>
          <Panel className="border-mtqs-amber/30 bg-mtqs-amber/[0.05] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <div className="flex-1">
                <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-amber/80">
                  §1.7 · independent verification required
                </div>
                <p className="mt-1 text-[0.72rem] leading-relaxed text-[#5B6E68]">
                  Reported addresses are user-reported testnet deployments. Per §1.7, reported
                  chain deployments, addresses, token decimals, Safe settings, and role
                  assignments{" "}
                  <span className="font-semibold text-amber-700">
                    must be verified independently
                  </span>{" "}
                  — a written specification, a successful compile, or a testnet transaction does
                  not prove that a correction is deployed. On-chain role rotation verification
                  commands live on the Developers tab; the Safe&rsquo;s actual on-chain
                  configuration (OD-35) is tracked on the Security tab.
                </p>
              </div>
              <div className="shrink-0 rounded-md border border-mtqs-gold/25 bg-mtqs-gold/[0.05] p-3">
                <div className="text-[0.6rem] uppercase tracking-[0.16em] text-mtqs-gold/75">
                  Deployer wallet (contracts.ts)
                </div>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-[0.68rem] text-amber-700 break-all">
                    {DEPLOYER_WALLET}
                  </span>
                  <CopyButton value={DEPLOYER_WALLET} label="deployer wallet" />
                </div>
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>
    </div>
  );
}
