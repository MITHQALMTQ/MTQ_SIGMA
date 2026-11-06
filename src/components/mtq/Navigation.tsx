// MTQΣ — Institutional Terminal section registry
//
// T47 CONSOLIDATION (2026-11-06, owner directive "delete wrong or not needed
// tabs · one UI design"): three confusing tabs were merged into their natural
// parents and their ids REMOVED from the union:
//   networks     → folded into "contracts" (Contracts & Chains: the chain-card
//                  grid duplicated the contract registry; the OD-34 oracle
//                  deployment registry + policy notes + §1.7 banner render
//                  under the contracts tab now — also kills the one-letter
//                  "network NOC" vs "networks" collision)
//   architecture → folded into "docs" (both are static blueprint reference;
//                  the Four-Weight-States table was rendered in both)
//   pitch        → folded into "investors" (a fundraising deck is not pilot
//                  functionality; it renders under the restricted investors
//                  tab)
// "portfolio" was RELABELLED "Dashboard" — the tab renders DashboardSection
// (the full legacy protocol grid, zero personal-position data) and every
// cross-link in the app already called it "Dashboard".
// The PCC restore logic maps stale sessionStorage ids (networks/architecture/
// pitch) to their new homes, so no visitor ever lands on a dead section.
//
// Legacy section IDs (home / dashboard / trial / tests) were removed earlier:
// every internal onNavigate("…") call site targets the modern equivalents
// (overview / portfolio / activity / validation). "investors" remains as a
// real (restricted) surface.

export type SectionId =
  // PRIMARY
  | "overview"
  | "network" // 40-c: Sovereign Devnet NOC
  | "explorer" // 40-c: chain explorer
  | "reference"
  | "reserve"
  | "risk"
  | "rebalancing"
  | "transparency"
  | "governance"
  | "validation"
  | "evidence"
  | "developers"
  // USER OPERATIONS
  | "mint"
  | "redeem"
  | "wallet" // 40-c: devnet wallet (client-side signing)
  | "staking" // 40-c: staking + on-chain governance
  | "portfolio" // renders DashboardSection — relabelled "Dashboard" (T47)
  | "activity"
  // SUPPORTING
  | "simulation"
  | "constituency"
  | "issuance"
  | "docs" // T47: docs + architecture merged (Blueprint & Docs)
  | "security"
  | "contracts" // T47: contracts + networks merged (Contracts & Chains)
  | "authorization"
  | "faucet"
  // RESTRICTED
  | "investors"; // T47: investors + pitch merged

export type SectionDef = {
  id: SectionId;
  label: string;
  /** Optional — the sidebar supplies its own icons; kept for lookups. */
  icon?: React.ComponentType<{ className?: string }>;
};

// PRIMARY — institutional terminal main navigation (12)
const PRIMARY: SectionDef[] = [
  { id: "overview", label: "Overview" },
  { id: "network", label: "Network" },
  { id: "explorer", label: "Explorer" },
  { id: "reference", label: "Reference" },
  { id: "reserve", label: "Reserve" },
  { id: "risk", label: "Risk" },
  { id: "rebalancing", label: "Rebalancing" },
  { id: "transparency", label: "Transparency" },
  { id: "governance", label: "Governance" },
  { id: "validation", label: "Validation" },
  { id: "evidence", label: "Evidence Package" },
  { id: "developers", label: "Developers" },
];

// USER OPERATIONS — mint / redeem / wallet / staking / portfolio / activity (6)
const USER_OPS: SectionDef[] = [
  { id: "mint", label: "Mint" },
  { id: "redeem", label: "Redeem" },
  { id: "wallet", label: "Wallet" },
  { id: "staking", label: "Staking" },
  { id: "portfolio", label: "Dashboard" },
  { id: "activity", label: "Activity" },
];

// SUPPORTING — labs, constituency, issuance lab, docs(+architecture),
// security, contracts(+chains), authorization audit, faucet (8)
const SUPPORTING: SectionDef[] = [
  { id: "simulation", label: "Simulation Lab" },
  { id: "constituency", label: "Constituency" },
  { id: "issuance", label: "Issuance Lab" },
  { id: "docs", label: "Blueprint & Docs" },
  { id: "security", label: "Security" },
  { id: "contracts", label: "Contracts & Chains" },
  { id: "authorization", label: "Authorization Audit" },
  { id: "faucet", label: "Faucet" },
];

// RESTRICTED — surfaced via the sidebar's restricted group only.
const SECONDARY: SectionDef[] = [{ id: "investors", label: "Investors" }];

// Flat list of all primary-surface sections (PRIMARY + USER OPS + SUPPORTING).
// 16c-013: NAV_GROUPS was dead (exported, never imported) — removed; the
// sidebar builds its own PROTOCOL/OPERATIONS/INSTITUTIONAL groups.
const SECTIONS: SectionDef[] = [...PRIMARY, ...USER_OPS, ...SUPPORTING];

// All sections including restricted (for lookups / label resolution).
export const ALL_SECTIONS: SectionDef[] = [...SECTIONS, ...SECONDARY];
