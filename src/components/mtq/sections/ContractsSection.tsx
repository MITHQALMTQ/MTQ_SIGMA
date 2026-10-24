// MTQΣ — Contracts Section
// Chain tabs (the 3 live testnets from ALL_CHAINS — Monad, Arc, Solana devnet)
// · Canonical MTQΣ card (gold, CANONICAL_MTQ_ADDRESSES)
// · Ecosystem contracts table (with search filter) · Copy buttons + explorer links.
// · AccessControl Role Matrix (Task 8-e) — LIVE /api/roles read-only verification
//   with the owner-pinned role hashes, honest REVERT/anomaly display, and the
//   owner's cast-operations reference (SHADOW MODE — never executed here).
//
// Props: { onNavigate }.

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, ArrowRight, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot } from "@/components/mtq/primitives";
import { shortAddr, copyToClipboard } from "@/components/mtq/format";
import {
  ALL_CHAINS,
  CANONICAL_MTQ_ADDRESSES,
  buildExplorerAddressUrl,
  type ChainInfo,
} from "@/lib/mtq/contracts";
import {
  MTQ_ROLE_HASHES,
  ROLE_KEYS,
  ROLE_EVIDENCE,
  ROLE_FINDINGS,
  OWNER_CAST_REFERENCE,
  type RoleVerdict,
  type RoleRowEvidence,
  type ChainRoleEvidence,
} from "@/lib/mtq/roles";
import type { SectionId } from "@/components/mtq/Navigation";

/* ---------- Copy button ---------- */
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

/* ---------- Chain tab ---------- */
// Defensive guard: a chain whose every contract entry is the zero address is
// a PENDING-DEPLOY placeholder — labeled as such, never presented as a live
// deployment (TESTNET-ONLY posture). No current registry chain trips this
// (the Base/Arbitrum placeholders were removed 2026-10-24 per the owner's
// directive), but the guard stays so any future placeholder is still
// labeled honestly.
function isPendingDeploy(chain: ChainInfo): boolean {
  return (
    chain.contracts.length > 0 &&
    chain.contracts.every((c) => /^0x0+$/.test(c.address))
  );
}

function ChainTab({ chain, active, onClick }: { chain: ChainInfo; active: boolean; onClick: () => void }) {
  const pending = isPendingDeploy(chain);
  return (
    <button
      onClick={onClick}
      className={`mtqs-focus relative px-4 py-2.5 text-sm font-medium transition ${
        active ? "text-mtqs-gold" : "text-white/55 hover:text-white/55"
      }`}
      aria-pressed={active}
    >
      {chain.label}
      {pending && (
        <span className="ml-1.5 rounded-full border border-mtqs-amber/30 bg-mtqs-amber/10 px-1.5 py-0.5 align-middle font-mono text-[0.52rem] uppercase tracking-wider text-mtqs-amber/90">
          mainnet · pending deploy
        </span>
      )}
      {active && (
        <motion.div
          layoutId="mtqs-contracts-tab-underline"
          className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent"
        />
      )}
    </button>
  );
}

/* ---------- Canonical MTQΣ gold card ---------- */
function CanonicalCard({ chainId }: { chainId: string }) {
  const info = CANONICAL_MTQ_ADDRESSES[chainId];
  if (!info) return null;
  return (
    <Panel className="p-5 sm:p-6 mtqs-glow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75">
            Source of Truth · {info.chain}
          </div>
          <h3 className="mtqs-display mtqs-gold-text text-2xl font-semibold mt-1">
            MTQΣ Canonical Token
          </h3>
        </div>
        <Pill tone="gold" className="font-mono">cid {String(info.chainId)}</Pill>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[0.72rem]">
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
          <div className="text-white/55">Name</div>
          <div className="font-mono text-mtqs-gold">{info.name}</div>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
          <div className="text-white/55">Symbol</div>
          <div className="font-mono text-mtqs-gold">{info.symbol}</div>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
          <div className="text-white/55">Decimals</div>
          <div className="font-mono text-mtqs-gold">{info.decimals}</div>
        </div>
        <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
          <div className="text-white/55">Chain ID</div>
          <div className="font-mono text-mtqs-gold">{String(info.chainId)}</div>
        </div>
      </div>
      <div className="mt-3 rounded-md border border-mtqs-gold/25 bg-mtqs-gold/[0.05] p-3">
        <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75 mb-1">
          Contract address
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="font-mono text-sm text-amber-100 break-all">{info.address}</span>
          <div className="flex items-center gap-2 shrink-0">
            <CopyButton value={info.address} label="MTQΣ address" />
            <a
              href={info.explorer}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.65rem] text-mtqs-emerald/80 hover:text-mtqs-emerald transition"
            >
              explorer ↗
            </a>
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ---------- Ecosystem contracts table (with search) ---------- */
function EcosystemTable({ chain, query }: { chain: ChainInfo; query: string }) {
  const q = query.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!q) return chain.contracts;
    return chain.contracts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q),
    );
  }, [chain, q]);

  return (
    <div className="overflow-hidden rounded-md border border-white/[0.06]">
      <div className="max-h-96 overflow-y-auto mtqs-scroll">
        <table className="w-full text-[0.72rem]">
          <thead className="bg-white/[0.02] text-white/55 sticky top-0 backdrop-blur">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Contract</th>
              <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Symbol</th>
              <th className="text-left px-3 py-2 font-medium">Address</th>
              <th className="text-right px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-white/60">
                  No contracts match &ldquo;{query}&rdquo;.
                </td>
              </tr>
            ) : (
              rows.map((c, i) => {
                const url = buildExplorerAddressUrl(chain, c.address);
                return (
                  <tr
                    key={c.address}
                    className={`border-t border-white/[0.06] ${i % 2 ? "bg-white/[0.01]" : ""}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="text-white/90">{c.name}</div>
                      {c.note && (
                        <div className="text-[0.62rem] text-white/60 mt-0.5">{c.note}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-mtqs-gold/80 hidden sm:table-cell">
                      {c.symbol}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-mtqs-gold">
                      {/^0x0+$/.test(c.address) ? (
                        <span className="text-mtqs-amber/90" title={c.address}>
                          0x000…000 · PENDING DEPLOY
                        </span>
                      ) : (
                        <span title={c.address}>{shortAddr(c.address, 8, 6)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <CopyButton value={c.address} label={c.name} />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-[0.65rem] text-mtqs-emerald/80 hover:text-mtqs-emerald transition"
                      >
                        explorer ↗
                      </a>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- AccessControl role matrix (Task 8-e) ---------- */

type RolesResponse =
  | { status: "LIVE"; verifiedAt: string; mode: string; chains: (ChainRoleEvidence & { verifiedAt: string })[] }
  | { status: "DEGRADED"; reason: string; lastVerified: ChainRoleEvidence[] };

function VerdictCell({ v }: { v: RoleVerdict | undefined }) {
  if (v === "true")
    return (
      <span className="inline-flex items-center gap-1 text-mtqs-emerald font-mono">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> TRUE
      </span>
    );
  if (v === "false")
    return <span className="font-mono text-white/45">false</span>;
  if (v === "REVERT")
    return (
      <span className="inline-flex items-center gap-1 text-mtqs-amber font-mono" title="eth_call reverted — this contract/role query is not answered by the deployed bytecode; anomaly preserved">
        <AlertTriangle className="h-3 w-3" aria-hidden="true" /> REVERT*
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-white/45 font-mono" title="RPC unreachable — live value UNVERIFIED">
      <XCircle className="h-3 w-3" aria-hidden="true" /> UNVERIFIED
    </span>
  );
}

function RoleMatrixPanel() {
  const [data, setData] = useState<RolesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chainId, setChainId] = useState<"monad" | "arc">("monad");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/roles", { cache: "no-store" });
      // 16c-009 fix: without this guard a 500 error body was stored as the
      // payload, silently rendering the recorded-evidence matrix under a
      // "SNAPSHOT" pill. Throw so the existing DEGRADED path fires honestly.
      if (!res.ok) throw new Error(`roles endpoint returned HTTP ${res.status}`);
      const json = (await res.json()) as RolesResponse;
      setData(json);
    } catch {
      setData({ status: "DEGRADED", reason: "Network request to /api/roles failed.", lastVerified: ROLE_EVIDENCE });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const chains: (ChainRoleEvidence & { verifiedAt?: string })[] = useMemo(
    () => (data?.status === "LIVE" ? data.chains : data?.status === "DEGRADED" ? data.lastVerified : ROLE_EVIDENCE),
    [data],
  );
  const activeChain = chains.find((c) => c.id === chainId) ?? chains[0];
  const mtqRow = activeChain?.rows.find((r) => r.contract === "MTQ.sol");

  // Owner reference check: expected TRUE ×3 on the MTQ token, deployer account
  const ownerChecks = ROLE_KEYS.map((role) => {
    const live = data?.status === "LIVE" ? mtqRow?.deployer?.[role] : undefined;
    const evidence = mtqRow?.deployer?.[role];
    return { role, live, evidence, matches: (live ?? evidence) === "true" };
  });

  return (
    <Panel className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75 flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" /> AccessControl · Role Matrix
          </div>
          <h3 className="mtqs-display text-lg font-semibold text-white mt-1">Live Role Verification</h3>
          <p className="text-[0.68rem] text-white/55 mt-1 max-w-xl leading-relaxed">
            READ-ONLY <code className="font-mono">hasRole()</code> / <code className="font-mono">paused()</code> view calls
            (§1 VERIFICATION-ONLY — no transactions, no state changes). TESTNET ONLY · SHADOW MODE ENFORCED ·
            UNAUTHORIZED RESERVE TRANSACTIONS.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={data?.status === "LIVE" ? "gold" : data?.status === "DEGRADED" ? "rose" : "amber"}>
            <GlowDot color={data?.status === "LIVE" ? "gold" : data?.status === "DEGRADED" ? "rose" : "amber"} size="h-1.5 w-1.5" />
            {/* 16c-009: a failed live check must read "unavailable", not the
                reassuring "snapshot" label. */}
            {data?.status === "LIVE" ? "LIVE" : data?.status === "DEGRADED" ? "UNAVAILABLE" : "SNAPSHOT"}
          </Pill>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="mtqs-focus inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[0.7rem] text-white/75 hover:text-white hover:border-mtqs-gold/40 transition disabled:opacity-50"
            aria-label="Re-verify roles live"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            {loading ? "Probing…" : "Re-verify"}
          </button>
        </div>
      </div>

      {data?.status === "DEGRADED" && (
        <div className="mb-4 rounded-md border border-mtqs-amber/30 bg-mtqs-amber/[0.06] p-2.5 text-[0.68rem] text-mtqs-amber/90">
          LIVE CHECK FAILED — {data.reason} Displaying the last VERIFIED snapshot (block-height evidence below); live state
          is UNVERIFIED until the RPCs answer.
        </div>
      )}

      {/* Owner reference verification */}
      <div className="rounded-md border border-mtqs-gold/25 bg-mtqs-gold/[0.05] p-3 mb-4">
        <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/75 mb-2">
          Owner reference — “Click Query → Should return true” (MTQ.sol · deployer account)
        </div>
        <div className="space-y-1.5">
          {ownerChecks.map((c) => (
            <div key={c.role} className="flex flex-wrap items-center justify-between gap-2 text-[0.7rem]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-white/80 shrink-0">{c.role}</span>
                <span className="font-mono text-white/40 truncate text-[0.62rem]">{shortAddr(MTQ_ROLE_HASHES[c.role], 10, 8)}</span>
                <CopyButton value={MTQ_ROLE_HASHES[c.role]} label={`${c.role} hash`} />
              </div>
              <span className={`font-mono shrink-0 ${c.matches ? "text-mtqs-emerald" : "text-white/45"}`}>
                {c.matches ? "✓ TRUE — matches owner reference" : c.live === "false" || c.evidence === "false" ? "✗ FALSE — MISMATCH, investigate" : "live value UNVERIFIED"}
              </span>
            </div>
          ))}
        </div>
        {activeChain && (
          <div className="mt-2 text-[0.62rem] text-white/45 font-mono">
            verified {activeChain.verifiedAt ?? activeChain.probedAt} · {activeChain.name} block {activeChain.block}
          </div>
        )}
      </div>

      {/* Chain toggle */}
      <div className="flex gap-1 mb-3" role="tablist" aria-label="Role matrix chain">
        {(chains.length ? chains : ROLE_EVIDENCE).map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === chainId}
            onClick={() => setChainId(c.id as "monad" | "arc")}
            className={`mtqs-focus rounded-md px-3 py-1.5 text-[0.72rem] transition ${
              c.id === chainId ? "bg-mtqs-gold/15 text-mtqs-gold" : "text-white/55 hover:text-white/75"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Matrix table */}
      {activeChain && (
        <div className="overflow-hidden rounded-md border border-white/[0.06]">
          <div className="max-h-96 overflow-y-auto mtqs-scroll">
            <table className="w-full text-[0.7rem]">
              <thead className="bg-white/[0.03] text-white/55 sticky top-0 backdrop-blur">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Contract</th>
                  <th className="text-left px-3 py-2 font-medium">Account</th>
                  <th className="text-left px-3 py-2 font-medium">DEFAULT_ADMIN</th>
                  <th className="text-left px-3 py-2 font-medium">MINTER</th>
                  <th className="text-left px-3 py-2 font-medium">PAUSER</th>
                  <th className="text-left px-3 py-2 font-medium">paused()</th>
                </tr>
              </thead>
              <tbody>
                {activeChain.rows.map((row: RoleRowEvidence, i: number) => (
                  <RoleMatrixRow key={row.address + row.contract} row={row} zebra={i % 2 === 1} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Findings */}
      <div className="mt-4 space-y-2">
        {ROLE_FINDINGS.map((f, i) => (
          <div key={i} className="flex items-start gap-2 text-[0.66rem] leading-relaxed">
            <GlowDot color={f.level === "verified" ? "emerald" : f.level === "anomaly" ? "amber" : "gold"} size="h-1.5 w-1.5" className="mt-1.5" />
            <p className={f.level === "verified" ? "text-white/65" : f.level === "anomaly" ? "text-mtqs-amber/80" : "text-mtqs-gold/85"}>{f.text}</p>
          </div>
        ))}
      </div>

      {/* Owner cast reference — SHADOW MODE, display only */}
      <div className="mt-4 rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
        <div className="text-[0.6rem] uppercase tracking-[0.22em] text-white/45 mb-2">
          Owner operations reference — cast commands
        </div>
        <div className="text-[0.62rem] text-mtqs-amber/85 mb-2">
          SHADOW MODE ENFORCED: this command center NEVER executes transactions. Mint / transfer / pause / unpause are
          state-changing operations reserved to the protocol owner; RESERVE TRANSACTIONS NOT AUTHORIZED here.
        </div>
        <div className="max-h-56 overflow-y-auto mtqs-scroll space-y-1.5">
          {OWNER_CAST_REFERENCE.map((c) => (
            <div key={c.op} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[0.68rem] text-white/80">{c.op}</div>
                <code className="font-mono text-[0.6rem] text-white/50 break-all">{c.command}</code>
                {c.note && <div className="text-[0.58rem] text-white/35">{c.note}</div>}
              </div>
              <CopyButton value={c.command} label={`${c.op} command`} />
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function RoleMatrixRow({ row, zebra }: { row: RoleRowEvidence; zebra: boolean }) {
  const renderRow = (
    key: string,
    label: string,
    verdicts: Partial<Record<(typeof ROLE_KEYS)[number], RoleVerdict>>,
    paused?: RoleVerdict,
    indent = false,
  ) => (
    <tr key={key} className={`border-t border-white/[0.06] ${zebra ? "bg-white/[0.02]" : ""}`}>
      <td className={`px-3 py-2 ${indent ? "pl-6 text-white/55" : "text-white/90"}`}>{label}</td>
      <td className="px-3 py-2 text-white/55">{indent ? "→ holder" : "deployer"}</td>
      <td className="px-3 py-2"><VerdictCell v={verdicts.DEFAULT_ADMIN_ROLE} /></td>
      <td className="px-3 py-2"><VerdictCell v={verdicts.MINTER_ROLE} /></td>
      <td className="px-3 py-2"><VerdictCell v={verdicts.PAUSER_ROLE} /></td>
      <td className="px-3 py-2">{paused !== undefined ? <VerdictCell v={paused} /> : <span className="text-white/25">—</span>}</td>
    </tr>
  );
  return (
    <>
      {renderRow(row.contract + "-d", row.contract, row.deployer, row.paused)}
      {row.holders?.safe && renderRow(row.contract + "-s", `↳ Safe holds on ${row.contract}`, row.holders.safe, undefined, true)}
      {row.holders?.governance && renderRow(row.contract + "-g", `↳ Governance holds on ${row.contract}`, row.holders.governance, undefined, true)}
    </>
  );
}

export function ContractsSection({ onNavigate: _onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const [activeId, setActiveId] = useState<string>(ALL_CHAINS[0].id);
  const [query, setQuery] = useState("");
  const active = ALL_CHAINS.find((c) => c.id === activeId) ?? ALL_CHAINS[0];

  // Canonical chain id map — the 3 canonical MTQΣ addresses (the owner's
  // current deployment set; every registry chain now has a canonical entry).
  const canonicalChainIds: Record<string, string> = {
    monad: "monad",
    arc: "arc",
    solana: "solana",
  };
  const canonicalKey = canonicalChainIds[active.id];

  return (
    <div className="space-y-10">
      {/* Section heading */}
      <div>
        <div className="flex items-end justify-between gap-4 mb-5">
          <div className="space-y-1.5 min-w-0">
            <span className="mtqs-eyebrow">Deployments · 3 testnets (Monad · Arc · Solana devnet)</span>
            <h2 className="text-lg sm:text-xl font-medium tracking-tight text-white">
              Contract Registry &amp; Canonical MTQΣ
            </h2>
          </div>
          <Pill tone="gold">
            <GlowDot color="gold" size="h-1.5 w-1.5" />
            {ALL_CHAINS.length} chains · {ALL_CHAINS.reduce((a, c) => a + c.contracts.length, 0)} contracts
          </Pill>
        </div>
      </div>

      {/* Canonical MTQΣ card (always reflects the active chain's canonical address;
          pending-deploy mainnet tabs get an explicit zero-address notice) */}
      <Reveal>
        {canonicalKey && CANONICAL_MTQ_ADDRESSES[canonicalKey] ? (
          <CanonicalCard chainId={canonicalKey} />
        ) : (
          <Panel className="p-5 sm:p-6">
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-amber/75">
              Source of Truth · {active.label}
            </div>
            <h3 className="mtqs-display text-xl font-semibold text-white mt-1">
              No canonical MTQΣ deployed on this chain
            </h3>
            <p className="mt-2 text-[0.75rem] text-white/55 leading-relaxed">
              <span className="text-mtqs-amber font-medium">MAINNET · PENDING DEPLOY</span> — {active.label} is a
              mainnet placeholder in the registry carrying a zero address. The MTQΣ pilot is{" "}
              <span className="text-white/80">TESTNET-ONLY · NOT ACCEPTED</span>; no canonical contract exists on
              this chain and none may be deployed while the §25.5 gates remain unpassed.
            </p>
          </Panel>
        )}
      </Reveal>

      {/* Chain tabs */}
      <Reveal delay={0.05}>
        <Panel className="p-1">
          <div className="relative flex border-b border-white/[0.06] overflow-x-auto mtqs-no-scrollbar">
            {ALL_CHAINS.map((c) => (
              <ChainTab
                key={c.id}
                chain={c}
                active={c.id === activeId}
                onClick={() => {
                  setActiveId(c.id);
                  setQuery("");
                }}
              />
            ))}
          </div>

          {/* Chain metadata strip */}
          <div className="p-4 sm:p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[0.72rem]">
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">Chain ID</div>
                    <div className="font-mono text-mtqs-gold">{String(active.chainId)}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">Native Currency</div>
                    <div className="font-mono text-mtqs-gold">{active.nativeCurrency}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5 sm:col-span-2">
                    <div className="text-white/55">RPC URL</div>
                    <div className="font-mono text-mtqs-gold truncate text-[0.7rem]">{active.rpcUrl}</div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">Deployer Wallet</div>
                    <div className="font-mono text-mtqs-gold flex items-center gap-1.5">
                      {shortAddr(active.wallet, 6, 4)}
                      <CopyButton value={active.wallet} label="deployer wallet" />
                    </div>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                    <div className="text-white/55">Explorer</div>
                    <a
                      href={active.explorer}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-mtqs-gold hover:text-amber-100 underline-offset-4 hover:underline"
                    >
                      open ↗
                    </a>
                  </div>
                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5 sm:col-span-2">
                    <div className="text-white/55">Network</div>
                    <div className="text-mtqs-gold">{active.network}</div>
                  </div>
                </div>

                {/* Pending-deploy banner for mainnet placeholder chains */}
                {isPendingDeploy(active) && (
                  <div className="rounded-md border border-mtqs-amber/30 bg-mtqs-amber/[0.06] px-3 py-2 text-[0.68rem] leading-relaxed text-mtqs-amber/90">
                    MAINNET · PENDING DEPLOY — every registry entry below is the zero address (no contract
                    deployed on this chain). Kept for the deployment roadmap only; the pilot is TESTNET-ONLY.
                  </div>
                )}

                {/* Search input */}
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/60"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Filter ${active.contracts.length} ecosystem contracts by name, symbol, or address…`}
                    className="w-full rounded-md border border-white/[0.06] bg-white/[0.02] pl-9 pr-3 py-2 text-[0.78rem] text-white placeholder:text-white/50 focus:outline-none focus:border-mtqs-gold/40 focus:bg-white/[0.04] transition"
                    aria-label="Filter contracts"
                  />
                </div>

                {/* Ecosystem contracts table */}
                <EcosystemTable chain={active} query={query} />
              </motion.div>
            </AnimatePresence>
          </div>
        </Panel>
      </Reveal>

      {/* AccessControl role matrix — LIVE read-only verification (Task 8-e) */}
      <Reveal delay={0.08}>
        <RoleMatrixPanel />
      </Reveal>

      {/* Honest note */}
      <Reveal delay={0.1}>
        <Panel className="p-4">
          <div className="flex items-start gap-2 text-[0.7rem] text-white/55">
            <GlowDot color="gold" size="h-1.5 w-1.5" className="mt-1.5" />
            <p className="leading-relaxed">
              The canonical MTQΣ address per chain is the source-of-truth token contract.
              Ecosystem contracts (Governance, Safe, Algorithm, Reserve, Mint, Redeem, Oracle,
              Takaful) are the surrounding protocol layer deployed by the same wallet. Visit the
              Trial section to mint and redeem against these contracts in the simulator.
            </p>
          </div>
          <div className="mt-3">
            <button
              onClick={() => _onNavigate("activity")}
              className="inline-flex items-center gap-1.5 text-[0.75rem] text-mtqs-gold/85 hover:text-mtqs-gold-light transition"
            >
              Open Trial simulator
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </Panel>
      </Reveal>
    </div>
  );
}
