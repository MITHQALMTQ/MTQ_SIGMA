// MTQΣ — Developers Section (API reference + on-chain verification)
//
//   1. Public API endpoints — grouped table of the REAL routes under
//      src/app/api (every path verified to exist; rate-limit marks spot-checked
//      against the route files' rateLimit/getClientIP usage).
//   2. On-chain verification — Foundry/cast rehearsal commands
//      (Appendix B.6 Phase 5 pattern + ROLE_ROTATION.md §4.1 OD-35 reads);
//      addresses imported from contracts.ts / genesis.ts, never hardcoded.
//   3. Repo artifacts — one row per top-level document that actually exists.
//   4. Integration notes — auth posture, rate limits, MBG HMAC/testnet bypass.
//
// Props: { onNavigate, snapshot }.

"use client";

import { Fragment } from "react";
import { toast } from "sonner";
import { ArrowRight, Terminal, FolderGit2, Plug, ShieldAlert } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, SectionHeading } from "@/components/mtq/primitives";
import { shortAddr, copyToClipboard } from "@/components/mtq/format";
import { ALL_CHAINS, CANONICAL_MTQ_ADDRESSES, DEPLOYER_WALLET } from "@/lib/mtq/contracts";
import { GENESIS_RESERVE_SAFE } from "@/lib/mtq/genesis";
import type { SectionId } from "@/components/mtq/Navigation";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

/* ============================================================
   Public API endpoints — grouped rows (verified against src/app/api)
   ============================================================ */
interface ApiRow {
  method: "GET" | "POST";
  path: string;
  desc: string;
  rateLimited?: boolean;
}

const API_GROUPS: { group: string; rows: ApiRow[] }[] = [
  {
    group: "Monetary state",
    rows: [
      { method: "GET", path: "/api/metrics", desc: "Full pilot monetary snapshot — weights, reserve, NAV, RR/LCR, buffer, rebalance decision." },
      { method: "GET", path: "/api/gfb", desc: "GFB reference-index read (index value, price-band status) from the pilot snapshot." },
      { method: "GET", path: "/api/oracle", desc: "3-source consensus oracle board state — per-pair prices, staleness, paused flag." },
      { method: "GET", path: "/api/fred", desc: "Latest macro data from FRED (Federal Reserve Economic Data). Currently degraded: FRED_API_KEY not configured — returns 503 until the key is set.", rateLimited: true },
      { method: "GET", path: "/api/fx", desc: "Live FX + macro snapshot feeding the consensus board." },
    ],
  },
  {
    group: "Simulations",
    rows: [
      { method: "POST", path: "/api/simulate/mint", desc: "Trial mint simulation applied to the live snapshot (state-clone)." },
      { method: "POST", path: "/api/simulate/redeem", desc: "Trial redemption simulation (state-clone)." },
      { method: "GET", path: "/api/succession", desc: "Constituency succession drill — candidate universe + live admission quotes (§3.3 / §21.5 / §9.2)." },
      { method: "POST", path: "/api/succession", desc: "Run the pure succession simulation: shock → staged ladder → eject → successor admission." },
      { method: "GET", path: "/api/validation", desc: "§23 validation & research stress suite — 11 scenarios behind a disk cache.", rateLimited: true },
    ],
  },
  {
    group: "Evidence & registers",
    rows: [
      { method: "GET", path: "/api/evidence", desc: "Evidence Package v6 — review-only data surface (D1–D6 reconciliation)." },
      { method: "GET", path: "/api/honest-status", desc: "§25.5 honest status — 11 validation gates + pilot substitution disclosures.", rateLimited: true },
      { method: "GET", path: "/api/mandate", desc: "Single Source of Truth v5.0 + Ext-1…Ext-3 mandate compliance report.", rateLimited: true },
      { method: "GET", path: "/api/tests", desc: "Canonical test-suite results (read from disk)." },
      { method: "GET", path: "/api/registry", desc: "Asset Admission Registry + issuer concentration report." },
      { method: "GET", path: "/api/por", desc: "Proof-of-reserve status + attestation fetch.", rateLimited: true },
      { method: "GET", path: "/api/implementation-status", desc: "Implementation status report.", rateLimited: true },
      { method: "GET", path: "/api/three-book", desc: "Three-book separation report.", rateLimited: true },
      { method: "GET", path: "/api/systemic-risk", desc: "Systemic exposure report.", rateLimited: true },
      { method: "GET", path: "/api/legal-registry", desc: "Legal liability framework report.", rateLimited: true },
      { method: "GET", path: "/api/licensing-matrix", desc: "Licensing entity matrix report.", rateLimited: true },
      { method: "GET", path: "/api/contradiction-scan", desc: "Contradiction scan report.", rateLimited: true },
      { method: "GET", path: "/api/bank-default", desc: "Bank default resolution report.", rateLimited: true },
      { method: "GET", path: "/api/protected-backing", desc: "Protected backing report.", rateLimited: true },
      { method: "GET", path: "/api/v3", desc: "V3 contract status — the production-aligned architecture.", rateLimited: true },
      { method: "GET", path: "/api/constituency", desc: "Dynamic-membership machinery status (Task M8-3a) — QUIESCENT: the active basket remains the 7-component genesis set at strategic-prior weights; no transition has ever run." },
      { method: "GET", path: "/api/issuance", desc: "Payment-funded issuance state machine (pilot implementation) — ledger records only, never on-chain; the payment-instrument registry is born empty (fail-closed admission)." },
      { method: "GET", path: "/api/release-state", desc: "Fail-closed release-control state — every control NOT_GRANTED, overall status NOT_ACCEPTED; grants exist only in an owner-authored authorization file outside the repo." },
    ],
  },
  {
    group: "Trials",
    rows: [
      { method: "GET", path: "/api/trials", desc: "Recorded trial log (database)." },
      { method: "GET", path: "/api/trials/export", desc: "Export the recorded trial log." },
    ],
  },
  {
    group: "Health",
    rows: [
      { method: "GET", path: "/api/health", desc: "Liveness / readiness probe (engine + database).", rateLimited: true },
      { method: "GET", path: "/api/status", desc: "Deployment status — chains, canonical addresses, snapshot header." },
      { method: "GET", path: "/api/onchain/[chain]", desc: "Read-only on-chain reads for a chain slug: name / symbol / decimals / totalSupply / hasRole / paused." },
      { method: "GET", path: "/api/roles", desc: "LIVE AccessControl role matrix (READ-ONLY eth_call): hasRole for DEFAULT_ADMIN / MINTER / PAUSER across all Monad + Arc contracts, deployer + Safe + Governance accounts on MTQ, paused() — 60s cache, degrades to the verified snapshot (never fabricates)." },
    ],
  },
  {
    group: "Bank gateway · ops · AI (also available)",
    rows: [
      { method: "GET", path: "/api/contracts", desc: "Full contract registry (ALL_CHAINS + deployer wallet)." },
      { method: "GET", path: "/api/banks", desc: "Authorized banks in the MTQΣ Bank Registry.", rateLimited: true },
      { method: "GET", path: "/api/stability-pool", desc: "Stability Pool state.", rateLimited: true },
      { method: "GET", path: "/api/sync", desc: "Turso ↔ Neon hybrid sync status.", rateLimited: true },
      { method: "POST", path: "/api/mbg/mint-request", desc: "MBG bank mint request — HMAC-SHA256 in production; rate-limited testnet bypass for the pilot bank.", rateLimited: true },
      { method: "GET", path: "/api/mbg/status/[requestId]", desc: "MBG mint-request status by request id.", rateLimited: true },
      { method: "GET", path: "/api/ai/briefing", desc: "COO-voice AI briefing of the live snapshot (5-provider fallback chain).", rateLimited: true },
      { method: "GET", path: "/api/ai/risk-signals", desc: "2–5 AI risk signals generated from the live snapshot.", rateLimited: true },
      { method: "GET", path: "/api/ai/status", desc: "AI provider + fallback-chain status.", rateLimited: true },
      { method: "POST", path: "/api/ai/qa", desc: "Blueprint Q&A — §-citing answers about the Master Blueprint v1.0.", rateLimited: true },
      { method: "POST", path: "/api/ai/screen", desc: "Named-entity screening via the Hugging Face Inference API. Origin-restricted (same-origin only — non-whitelisted origins get 403).", rateLimited: true },
    ],
  },
];

/* ============================================================
   Repo artifacts — every row verified to exist in the repository
   ============================================================ */
const REPO_ARTIFACTS: { name: string; purpose: string }[] = [
  { name: "ROLE_ROTATION.md", purpose: "Privileged-role rotation procedure (testnet rehearsal): exact contract interface, role-admin configuration, transaction sequence, rollback rules — OD-35 resolved by on-chain verification with a CRITICAL finding." },
  { name: "UPGRADEABILITY.md", purpose: "Upgradeability strategy (Ext-1 E.3 / OD-16): upgrade options incl. contract migration; governed by the Constitutional Council + 90-day timelock." },
  { name: "SECURITY.md", purpose: "Vulnerability disclosure policy (Ext-3 A.8 / OD-38) — published; a Gate 5 blocker otherwise." },
  { name: "docs/MANDATE-COMPLIANCE.md", purpose: "Consolidated compliance report for the Single Source of Truth v5.0 + Ext-1…Ext-3 — testnet-only; no production-readiness claims." },
  { name: "contracts/TOKEN-STANDARD.md", purpose: "MTQ token standard baseline (Ext-3 A.7 / T-88): ERC-20 + EIP-2612 Permit + ERC-20 Votes/Snapshots." },
  { name: "RUNBOOK.md", purpose: "Operations runbook for the pilot command center (testnet only — NOT production-authorized)." },
  { name: "IMPLEMENTATION.md", purpose: "Autonoma SDK integration checklist." },
  { name: "CRITICAL-PRIVATE-KEY-ROTATION.md", purpose: "BLOCKING notice: deployer private-key rotation required before public testnet launch." },
  { name: "CHANGELOG.md", purpose: "Project changelog." },
  { name: "README.md · AGENTS.md", purpose: "Repository overview + agent working instructions." },
  { name: "contracts/", purpose: "Solidity sources: MTQSigmaV2.sol · MTQSigmaV3.sol · MtqEcosystem.sol · adapters/ (ChainlinkAdapter, PythAdapter, ChronicleAdapter) · deployments/*.json register · foundry.toml." },
  { name: "foundry.toml", purpose: "Root Foundry configuration." },
  { name: "scripts/verify-safe.ts", purpose: "Read-only Safe verification script (eth_call / eth_getCode / eth_getStorageAt) behind the OD-35 evidence." },
  { name: "docs/", purpose: "Audit & record set: MAINNET-AUDIT-REPORT.md, BANK-GRADE-AUDIT.md, CORRECTED-BANK-AUDIT.md, BLUEPRINT-GAP-ANALYSIS.md, DEPLOYMENT-RECORD.md (OD-36), SIMPLIFICATION-MEMO.md." },
  { name: "audit-work/", purpose: "Machine evidence tree — v5 SAFE-VERIFICATION.md + safe-verification.json (OD-35), v6 evidence package, v8 probe results." },
];

/* ---------- Copy button (sibling pattern) ---------- */
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

/* ============================================================
   DevelopersSection
   ============================================================ */
export function DevelopersSection({
  onNavigate,
  snapshot: _snapshot,
}: {
  onNavigate: (id: SectionId) => void;
  snapshot: MetricsSnapshot | null;
}) {
  // Rehearsal targets — printed exactly as contracts.ts records them.
  const monad = ALL_CHAINS.find((c) => c.id === "monad");
  const arc = ALL_CHAINS.find((c) => c.id === "arc");
  const monadMpq = CANONICAL_MTQ_ADDRESSES.monad;
  const arcMpq = CANONICAL_MTQ_ADDRESSES.arc;

  // Appendix B.6 Phase 5 — Foundry verification commands (env-var pattern from
  // ROLE_ROTATION.md §4.1). Values interpolate the imported constants.
  const verifyScript = `# Environment (read-only rehearsal — ROLE_ROTATION.md §4.1 pattern)
export RPC="${monad?.rpcUrl ?? "<rpc>"}"                    # Arc: ${arc?.rpcUrl ?? "<rpc>"}
export MTQ_CONTRACT="${monadMpq.address}"   # Arc: ${arcMpq.address}
export GENESIS_RESERVE_ADDRESS="${GENESIS_RESERVE_SAFE}"
export COLD_TREASURY="$GENESIS_RESERVE_ADDRESS"   # same as the Genesis Reserve on testnet (App B, Phase 1)
export STATUS_CONTRACT="<Listing 15 honest-status contract — set from the deployment register>"

# Verify the reference-index base denominator
cast call $MTQ_CONTRACT "verifyGFBBase()" --rpc-url $RPC
# Check the Genesis Reserve token balance
cast call $MTQ_CONTRACT "balanceOf(address)" $GENESIS_RESERVE_ADDRESS --rpc-url $RPC
# Check the operational wallet balance (the contract itself)
cast balance $MTQ_CONTRACT --rpc-url $RPC
# Check the Cold Treasury balance
cast balance $COLD_TREASURY --rpc-url $RPC
# Honest-status checks (v2.0 additions; Listing 15)
cast call $STATUS_CONTRACT "getHonestStatus()" --rpc-url $RPC
cast call $STATUS_CONTRACT "getValidationGates()" --rpc-url $RPC
cast call $STATUS_CONTRACT "isProductionAuthorized()" --rpc-url $RPC
# isProductionAuthorized() must return false on every testnet deployment.`;

  // ROLE_ROTATION.md §4.1 — OD-35 Safe actual-configuration reads.
  const safeReads = `# OD-35 — Safe actual configuration (reported 4/7 is NOT evidence)
export SAFE="${GENESIS_RESERVE_SAFE}"
cast call --rpc-url "$RPC" "$SAFE" "getThreshold()(uint256)"
cast call --rpc-url "$RPC" "$SAFE" "getOwners()(address[])"
cast call --rpc-url "$RPC" "$SAFE" "getModulesPaginated(address,uint256)(address[],address)" \\
  "0x0000000000000000000000000000000000000001" "10"
cast call --rpc-url "$RPC" "$SAFE" "getGuard()(address)"`;

  return (
    <div className="space-y-10">
      {/* ---------- Page heading ---------- */}
      <div>
        <SectionHeading
          eyebrow="api · integration"
          title="Developer Reference"
          className="mb-4"
          right={
            <Pill tone="gold">
              <GlowDot color="gold" size="h-1.5 w-1.5" />
              public read-only JSON
            </Pill>
          }
        />
        <Reveal>
          <Panel className="border-mtqs-amber/25 bg-mtqs-amber/[0.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="amber">
                <GlowDot color="amber" size="h-1.5 w-1.5" />
                TESTNET ONLY
              </Pill>
              <p className="text-[0.68rem] leading-relaxed text-white/55">
                Every endpoint below was verified against the routes that exist under
                src/app/api. Rate-limit marks reflect the route files&rsquo; own
                rateLimit/getClientIP usage. Simulated outputs are not executable market
                quotes — no API response authorizes production activity (§1.7).
              </p>
            </div>
          </Panel>
        </Reveal>
      </div>

      {/* ---------- Public API endpoints ---------- */}
      <section id="dev-api" className="scroll-mt-32">
        <SectionHeading
          eyebrow="public api"
          title="Public API Endpoints"
          right={
            <Pill tone="muted">
              {API_GROUPS.reduce((a, g) => a + g.rows.length, 0)} routes ·{" "}
              {API_GROUPS.reduce((a, g) => a + g.rows.filter((r) => r.rateLimited).length, 0)}{" "}
              rate-limited
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-0 overflow-hidden">
            <div className="max-h-96 overflow-y-auto mtqs-scroll">
              <table className="w-full text-[0.68rem]">
                <thead className="bg-white/[0.03] text-white/55 sticky top-0 backdrop-blur">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-14">Method</th>
                    <th className="text-left px-3 py-2 font-medium">Path</th>
                    <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {API_GROUPS.map((g) => (
                    <Fragment key={g.group}>
                      <tr className="border-t border-white/[0.06] bg-white/[0.03]">
                        <td colSpan={3} className="px-3 py-1.5">
                          <span className="text-[0.6rem] uppercase tracking-[0.2em] text-mtqs-gold/80">
                            {g.group}
                          </span>
                        </td>
                      </tr>
                      {g.rows.map((r) => (
                        <tr key={r.method + r.path} className="border-t border-white/[0.05]">
                          <td className="px-3 py-2">
                            <span
                              className={`inline-block rounded border px-1.5 py-0.5 font-mono text-[0.6rem] ${
                                r.method === "GET"
                                  ? "border-mtqs-gold/25 bg-mtqs-gold/[0.06] text-mtqs-gold"
                                  : "border-mtqs-amber/25 bg-mtqs-amber/[0.06] text-mtqs-amber"
                              }`}
                            >
                              {r.method}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="font-mono text-[0.66rem] text-white/90 break-all">
                              {r.path}
                            </span>
                            {r.rateLimited ? (
                              <span
                                className="ml-1.5 text-[0.58rem] text-mtqs-amber/85"
                                title="rate-limited per client IP"
                              >
                                ● rate-limited
                              </span>
                            ) : null}
                            <span className="block sm:hidden text-[0.62rem] text-white/55 mt-0.5">
                              {r.desc}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-white/55 hidden sm:table-cell">
                            {r.desc}
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* ---------- On-chain verification (Foundry/cast) ---------- */}
      <section id="dev-cast" className="scroll-mt-32">
        <SectionHeading
          eyebrow="foundry · cast"
          title="On-Chain Verification"
          right={
            <Pill tone="muted">
              <Terminal className="h-3 w-3" aria-hidden="true" />
              testnet rehearsal commands — ROLE_ROTATION.md
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            {/* Rehearsal targets */}
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {[monadMpq, arcMpq].map((c) => (
                <div
                  key={c.chain}
                  className="rounded-md border border-white/[0.07] bg-white/[0.02] p-2.5"
                >
                  <div className="text-[0.6rem] uppercase tracking-[0.16em] text-white/55">
                    {c.chain} · chainId {String(c.chainId)} · MTQ rehearsal target
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 min-w-0 flex-wrap">
                    <span className="font-mono text-[0.66rem] text-mtqs-gold break-all">
                      {c.address}
                    </span>
                    <CopyButton value={c.address} label={`${c.chain} MTQ address`} />
                  </div>
                  <div className="mt-0.5 font-mono text-[0.6rem] text-white/55">
                    name {c.name} · symbol {c.symbol} · decimals {c.decimals}
                  </div>
                </div>
              ))}
            </div>

            <pre className="mtqs-scroll overflow-x-auto rounded-lg border border-white/[0.08] bg-black/40 p-3.5 font-mono text-[0.64rem] leading-relaxed text-white/80">
{verifyScript}
            </pre>
            <p className="mt-1.5 text-[0.6rem] text-white/55">
              Appendix B.6 Phase 5 sequence (MTQ_CONTRACT / GENESIS_RESERVE_ADDRESS /
              COLD_TREASURY / RPC environment). All cast calls are read-only.
            </p>

            <pre className="mtqs-scroll overflow-x-auto rounded-lg border border-white/[0.08] bg-black/40 p-3.5 font-mono text-[0.64rem] leading-relaxed text-white/80">
{safeReads}
            </pre>

            <div className="mt-3 rounded-md border border-mtqs-rose/30 bg-mtqs-rose/[0.06] p-3">
              <div className="flex items-center gap-2 text-[0.66rem] font-semibold text-mtqs-rose">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                OD-35 critical finding (2026-10-19 on-chain reads)
              </div>
              <p className="mt-1 text-[0.66rem] leading-relaxed text-white/70">
                The actual reads returned <span className="font-mono">getThreshold() = 1</span> and{" "}
                <span className="font-mono">getOwners() = [deployer EOA]</span> — a 1/1
                deployer-controlled Safe, NOT the mandated 4/7. Rotation is BLOCKED until
                governance declares the canonical MTQ contract per chain, the 7 Constitutional
                signers are constituted, and the Safe is reconfigured to threshold 4 (Gate 5
                blocked). Evidence: audit-work/v5/SAFE-VERIFICATION.md + safe-verification.json.
                Reported ≠ verified.
              </p>
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* ---------- Repo artifacts ---------- */}
      <section id="dev-artifacts" className="scroll-mt-32">
        <SectionHeading
          eyebrow="repository"
          title="Repo Artifacts"
          right={
            <Pill tone="muted">
              <FolderGit2 className="h-3 w-3" aria-hidden="true" />
              {REPO_ARTIFACTS.length} entries · existence-verified
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            <div className="max-h-96 overflow-y-auto mtqs-scroll pr-2 space-y-1.5">
              {REPO_ARTIFACTS.map((a) => (
                <div
                  key={a.name}
                  className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                >
                  <span className="font-mono text-[0.66rem] text-mtqs-gold sm:w-56 shrink-0 break-all">
                    {a.name}
                  </span>
                  <span className="text-[0.66rem] leading-relaxed text-white/55">{a.purpose}</span>
                </div>
              ))}
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* ---------- Integration notes ---------- */}
      <section id="dev-integration" className="scroll-mt-32">
        <SectionHeading
          eyebrow="integration"
          title="Integration Notes"
          right={
            <Pill tone="muted">
              <Plug className="h-3 w-3" aria-hidden="true" />
              read-only · no auth for GETs
            </Pill>
          }
        />
        <Reveal>
          <Panel className="p-5">
            <ul className="space-y-2.5">
              {[
                "All public GET endpoints return read-only JSON; no authentication is required for GETs.",
                "Rate limits are enforced per client IP (rateLimit + getClientIP) on the register/report routes; heavy reports are disk-cached (e.g. /api/validation).",
                "Server-side chain reads are read-only eth_call through a static ABI (ethers — no signer, no transactions), e.g. /api/onchain/[chain]. No wallet SDK operations happen server-side.",
                "POST /api/mbg/mint-request is the Bank Minting Workflow entry point: HMAC-SHA256 (MBG_HMAC_SECRET) authentication in production; the testnet pilot allows a rate-limited bypass for the pilot bank only.",
                "Status and report outputs carry the honest-status posture: NOT PRODUCTION-AUTHORIZED until all 11 §25.5 validation gates pass.",
                "No production authorization derives from any API output — a simulated quote is not an executable market quote (§1.7 / Appendix F).",
              ].map((n) => (
                <li key={n} className="flex items-start gap-2.5">
                  <GlowDot color="gold" size="h-1.5 w-1.5" className="mt-[7px] shrink-0" />
                  <span className="text-[0.72rem] leading-relaxed text-white/55">{n}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded-md border border-white/[0.07] bg-white/[0.02] p-3 inline-block">
              <div className="text-[0.6rem] uppercase tracking-[0.16em] text-white/55">
                Deployer wallet (contracts.ts)
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[0.68rem] text-amber-100 break-all">
                  {DEPLOYER_WALLET}
                </span>
                <CopyButton value={DEPLOYER_WALLET} label="deployer wallet" />
              </div>
            </div>
          </Panel>
        </Reveal>
      </section>

      {/* ---------- Cross-navigation ---------- */}
      <section id="dev-nav" className="scroll-mt-32">
        <Reveal>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate("contracts")}
              className="mtqs-focus rounded-lg border border-white/10 px-3 py-1.5 text-[0.75rem] text-white/85 hover:bg-white/5 transition inline-flex items-center gap-1.5"
            >
              Contract registry
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={() => onNavigate("evidence")}
              className="mtqs-focus rounded-lg border border-white/10 px-3 py-1.5 text-[0.75rem] text-white/85 hover:bg-white/5 transition inline-flex items-center gap-1.5"
            >
              Evidence package
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
