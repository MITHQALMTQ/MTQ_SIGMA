// MTQΣ — Institutional Terminal section registry
//
// CLEANUP (2026-10-24): this file previously also carried a ~300-line
// <Navigation /> horizontal-bar component that was superseded by the
// sidebar-based layout (see Sidebar.tsx) and rendered NOWHERE — dead code
// since the sidebar reorg. It has been removed; only the canonical section
// registry (SectionId + ALL_SECTIONS) remains, which is everything any
// consumer imports (PCC uses ALL_SECTIONS for the sessionStorage restore
// validation; labels for lookups). SECTIONS is an internal helper for
// ALL_SECTIONS; NAV_GROUPS was dead (never imported) and was removed in the
// 16c-013 dead-export sweep.
//
// Legacy section IDs (home / dashboard / trial / tests) were removed from the
// union: every internal onNavigate("…") call site now targets the modern
// equivalents (overview / portfolio / activity / validation). "investors" and
// "pitch" remain as real (restricted) surfaces.

export type SectionId =
  // PRIMARY
  | "overview"
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
  | "portfolio"
  | "activity"
  // SUPPORTING
  | "simulation"
  | "constituency"
  | "issuance"
  | "architecture"
  | "docs"
  | "security"
  | "contracts"
  | "authorization"
  | "networks"
  | "faucet"
  // RESTRICTED
  | "investors"
  | "pitch";

export type SectionDef = {
  id: SectionId;
  label: string;
  /** Optional — the sidebar supplies its own icons; kept for lookups. */
  icon?: React.ComponentType<{ className?: string }>;
};

// PRIMARY — institutional terminal main navigation (10)
const PRIMARY: SectionDef[] = [
  { id: "overview", label: "Overview" },
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

// USER OPERATIONS — mint / redeem / portfolio / activity (4)
const USER_OPS: SectionDef[] = [
  { id: "mint", label: "Mint" },
  { id: "redeem", label: "Redeem" },
  { id: "portfolio", label: "Portfolio" },
  { id: "activity", label: "Activity" },
];

// SUPPORTING — labs, constituency, issuance lab, architecture, docs, security,
// contracts, authorization audit, networks, faucet (10)
const SUPPORTING: SectionDef[] = [
  { id: "simulation", label: "Simulation Lab" },
  { id: "constituency", label: "Constituency" },
  { id: "issuance", label: "Issuance Lab" },
  { id: "architecture", label: "Architecture" },
  { id: "docs", label: "Documentation" },
  { id: "security", label: "Security" },
  { id: "contracts", label: "Contracts" },
  { id: "authorization", label: "Authorization Audit" },
  { id: "networks", label: "Networks" },
  { id: "faucet", label: "Faucet" },
];

// RESTRICTED — surfaced via the sidebar's restricted group only.
const SECONDARY: SectionDef[] = [
  { id: "investors", label: "Investors" },
  { id: "pitch", label: "Pitch" },
];

// Flat list of all primary-surface sections (PRIMARY + USER OPS + SUPPORTING).
// 16c-013: NAV_GROUPS was dead (exported, never imported) — removed; the
// sidebar builds its own PROTOCOL/OPERATIONS/INSTITUTIONAL groups.
const SECTIONS: SectionDef[] = [...PRIMARY, ...USER_OPS, ...SUPPORTING];

// All sections including restricted (for lookups / label resolution).
export const ALL_SECTIONS: SectionDef[] = [...SECTIONS, ...SECONDARY];
