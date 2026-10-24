// MTQΣ LANDING PAGE — copy & truthful-status module (v7.2 pixel-parity rebuild).
//
// SINGLE SOURCE OF TRUTH for every string rendered on the landing page.
//
// Marketing copy (headline, badge, panels, cards, checklist, dashboard mock)
// mirrors the supplied reference design verbatim — it is aspirational design
// copy, not operational claims.
//
// Operational truth is anchored separately and can never drift from code:
//   • TESTNET ONLY            — contracts live on Monad 10143 / Arc 5042002 /
//                              Solana devnet only (src/lib/mtq/contracts.ts,
//                              docs/DEPLOYMENT-RECORD.md)
//   • SHADOW MODE ENFORCED    — ECONOMIC_ELIGIBILITY_ENABLED=false in
//                              src/lib/mtq/mandate.ts:1070 (code constant)
//   • RESERVE TRADING NOT
//     AUTHORIZED              — getHonestStatus(): authorizedMask=0 (all 11
//                              §25.5 gates false) + GATE_STATUS Gate 6
//                              (src/lib/mtq/honest-status.ts, evidence_package.ts)
//
// The dashboard preview renders the reference's illustrative mock interface and
// is explicitly tagged SIMULATED PREVIEW — it is a product illustration, never
// presented as live telemetry.
//
// Posture: TESTNET ONLY · SHADOW MODE ENFORCED · RESERVE TRADING NOT AUTHORIZED.

export type Tone = "cyan" | "amber" | "rose" | "violet" | "slate";

export type StatusStatement = {
  id: string;
  title: string;
  description: string;
  tone: Tone;
  icon: "flask" | "eye" | "ban";
};

// ---------------------------------------------------------------------------
// The three mandatory operational statements — always visible (footer ribbon,
// mobile drawer, wallet/video dialogs, and every info dialog).
// ---------------------------------------------------------------------------
export const OPERATIONAL_STATUS: readonly StatusStatement[] = [
  {
    id: "testnet-only",
    title: "TESTNET ONLY",
    description:
      "The current environment is for testnet validation only.",
    tone: "cyan",
    icon: "flask",
  },
  {
    id: "shadow-mode",
    title: "SHADOW MODE ENFORCED",
    description:
      "Execution is restricted to shadow or simulation behavior; simulated actions are not completed on-chain transactions.",
    tone: "amber",
    icon: "eye",
  },
  {
    id: "reserve-trading",
    title: "RESERVE TRADING NOT AUTHORIZED",
    description:
      "No production reserve trading or monetary execution is authorized.",
    tone: "rose",
    icon: "ban",
  },
] as const;

// ---------------------------------------------------------------------------
// Hero copy — verbatim from the reference design.
// ---------------------------------------------------------------------------
export const HERO = {
  badge: "The Next Generation Monetary Protocol",
  // Per-line color treatment sampled from the reference pixels:
  //   L1 "A More Stable,"            — violet → blue-violet gradient
  //   L2 "Transparent &"              — uniform light cyan
  //   L3 "Inclusive Financial Future" — blue → bright cyan gradient
  headlineLines: [
    { text: "A More Stable,", tone: "grad-1" as const },
    { text: "Transparent &", tone: "flat-cyan" as const },
    { text: "Inclusive Financial Future", tone: "grad-2" as const },
  ],
  paragraph:
    // 16c-012: "advanced AI models" overstated the pilot's live AI (no provider
    // is configured — the terminal discloses model:"fallback-rules"). Honest
    // phrasing aligned with the terminal's Risk Signals panel.
    "MTQΣ is a decentralized monetary system designed for global stability, referencing a real-world asset basket (simulated pilot), advisory AI risk signals (pilot: deterministic rule-based fallback), and transparent governance.",
  primaryCta: { label: "Launch App", href: "#ecosystem" },
  secondaryCta: { label: "Watch Video", action: "video-dialog" as const },
} as const;

// Four holographic floating panels around the globe — reference copy,
// corrected to the pilot's honest posture (no external audit exists — G1;
// the pilot reserve is simulated — G8; the pilot runs on testnets).
export const HERO_PANELS = [
  {
    id: "real-world",
    icon: "landmark" as const,
    title: "Asset-Referencing Basket Design",
    subtitle: "Basket-referencing. Internally audited. Testnet pilot.",
  },
  {
    id: "ai-economics",
    icon: "brain" as const,
    // 16c-012: "AI-Powered Economics / Adaptive. Transparent. Fair." overclaimed
    // a live AI that does not exist (the pilot runs the deterministic
    // fallback-rules engine — no provider is configured).
    title: "AI Risk Signals (Advisory)",
    subtitle: "Pilot: deterministic rule-based fallback.",
  },
  {
    id: "cross-chain",
    icon: "link" as const,
    title: "Cross-Chain Interoperability",
    subtitle: "More Chains. More Access.",
  },
  {
    id: "community",
    icon: "users" as const,
    title: "Community Governance",
    subtitle: "Your Voice. Our Future.",
  },
] as const;

// ---------------------------------------------------------------------------
// Four feature cards — reference copy.
// ---------------------------------------------------------------------------
export const PROTOCOL_CARDS = [
  {
    id: "stable-value",
    icon: "shield" as const,
    title: "Basket-Referenced Value",
    body: "References a real-world asset basket (simulated pilot) via adaptive weighting — a reference, not a peg: the market price is free to deviate.",
  },
  {
    id: "low-fees",
    icon: "zap" as const,
    title: "Low Fees",
    body: "Efficient, transparent, and built for global scale.",
  },
  {
    id: "cross-chain",
    icon: "globe" as const,
    title: "Cross-Chain",
    body: "Multi-chain architecture — cross-chain movement paused by governance (X-1).",
  },
  {
    id: "community",
    icon: "users" as const,
    title: "Community Driven",
    body: "Governed by you, for a more inclusive financial system.",
  },
] as const;

// ---------------------------------------------------------------------------
// Stats row — reference layout (4 big numbers + small labels on a glass
// bar, directly under the feature cards). The reference shows marketing
// figures ($2.4B+ TVL / 12 chains / 250K+ members / 99.9% uptime); those
// are NOT true for this pilot, so per the standing no-fabrication mandate
// the same design carries values that ARE true and were re-verified
// read-only from the live testnets this session (see contracts.ts).
// ---------------------------------------------------------------------------
export const PROTOCOL_STATS = {
  // Honest tag: these four values are point-in-time verified constants (true
  // against the live registry / evidence register as of the dated baseline),
  // NOT live reads — live values are served in the Pilot Command Center.
  tag: "STATUS AT HEAD · 2026-10-24 · READ-ONLY VERIFIED",
  items: [
    { value: "19", label: "Contracts Verified On-Chain" },
    { value: "3", label: "Testnets Deployed" },
    { value: "253/253", label: "Canonical Invariant Tests Passing" },
    { value: "0/7", label: "Release Gates (Evidence Register) Closed — Production Not Authorized" },
  ],
  footnote:
    "Point-in-time verified values, not live reads (live values are served in the Pilot Command Center terminal). 19 = 9 Monad Testnet (10143) + 9 Arc Testnet (5042002) contracts + 1 Solana devnet SPL mint, each code/account verified by read-only RPC probe. 3 = Monad, Arc testnets + Solana devnet (the 2026-10-24 owner-directed registry cleanup removed the Robinhood Chain suite and the Base/Arbitrum placeholders from the registry). 253/253 = canonical invariant suite green at the 2026-10-23 baseline: deterministic Layers 1-6+8 re-run fresh 246/246 + Layer-7 7/7 carried from the recorded chunked evidence (six D-13.26 stale-assertion re-pins applied under the owner directive, +3 new invariant assertions; code-quality evidence only — no release authority). 0/7 = the evidence register's release gates (D-5) — a different register from the terminal's §25.5 validation gates (0/11). The reference design's TVL / user-count / uptime figures are not reproduced: they are not real for a shadow-mode testnet pilot.",
} as const;

// ---------------------------------------------------------------------------
// Ecosystem section (lower two-column block) — reference copy.
// ---------------------------------------------------------------------------
export const ECOSYSTEM = {
  pill: "THE MTQΣ ECOSYSTEM",
  headlineLines: [
    { text: "Powerful Tools.", tone: "white" as const },
    { text: "Unified in One Platform.", tone: "gradient" as const },
  ],
  paragraph:
    "Manage your assets, track performance, and participate in governance — all in a sleek, intuitive interface designed for the next generation of users.",
  checklist: [
    "Real-time analytics & insights",
    "Simulated mint/redeem across 3 testnets",
    // 16c-012: no voting portal exists — the real surface is the Governance
    // transparency view (councils, gates, spec status) in the terminal.
    "Governance transparency & gates view",
    "Developer tools & APIs",
  ],
  cta: { label: "Launch Pilot Command Center", href: "#home" },
} as const;

// ---------------------------------------------------------------------------
// Dashboard preview — the reference's illustrative product mock.
// Rendered verbatim and tagged SIMULATED PREVIEW (see SIMULATED_PREVIEW_TAG).
// ---------------------------------------------------------------------------
export const DASHBOARD_MOCK = {
  address: "0x3F4...9e28",
  tabs: ["Dashboard", "Wallet", "Swap", "Farming", "Governance", "Analytics"] as const,
  welcome: {
    title: "Welcome back, Alex",
    subtitle: "Your portfolio is growing",
    value: "$48,732.21",
    change: "12.5% (24h)",
    actions: ["Deposit", "Swap", "Send"] as const,
    tokens: [
      { symbol: "ETH", amount: "1.2384", value: "$3,421.76" },
      { symbol: "SOL", amount: "25.67", value: "$4,125.45" },
    ],
    chartX: ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"] as const,
  },
  assets: [
    { symbol: "MTQ", tag: "Native", amount: "12,450.32", value: "$14,563.21", icon: "m" as const },
    { symbol: "USDC", tag: "Stable", amount: "8,732.10", value: "$8,732.10", icon: "usdc" as const },
    { symbol: "ETH", tag: "Priority", amount: "1.2384", value: "$3,411.76", icon: "eth" as const },
    { symbol: "SOL", tag: "Staked", amount: "25.67", value: "$4,125.45", icon: "sol" as const },
  ],
  activity: {
    title: "Recent Activity",
    rows: [
      { id: "r1", icon: "m", title: "Staked MTQ", value: "+250.00 MTQ", when: "2 hours ago", positive: true },
      { id: "r2", icon: "swap", title: "Swapped USDC → MTQ", value: "+1,250.00 MTQ", when: "4 hours ago", positive: true },
      { id: "r3", icon: "vote", title: "Governance Vote", detail: "Voted: Proposal #12", when: "6 hours ago", positive: false },
    ] as { id: string; icon: "m" | "swap" | "vote"; title: string; value?: string; detail?: string; when: string; positive: boolean }[],
  },
  network: {
    title: "Network Status",
    rows: [
      { id: "monad", name: "Monad", status: "Healthy", color: "#8b5cf6" },
      { id: "arbitrum", name: "Arbitrum", status: "Healthy", color: "#3b82f6" },
      { id: "ethereum", name: "Ethereum", status: "Healthy", color: "#627eea" },
      { id: "solana", name: "Solana", status: "Healthy", color: "#e4a1ff" },
    ],
  },
} as const;

export const SIMULATED_PREVIEW_TAG = "SIMULATED PREVIEW";
export const SIMULATION_NOTE =
  "Illustrative interface preview rendered from the reference design — not live data, not a deployed product.";

// ---------------------------------------------------------------------------
// Bottom tagline + footer statements.
// ---------------------------------------------------------------------------
export const TAGLINE =
  "Built for a more stable, transparent and inclusive financial future.";

export const FOOTER = {
  disclaimer:
    "MTQΣ is a monetary architecture protocol in development. Nothing on this page constitutes an offer, a live product, or an authorization to transact.",
  copyright: "© 2026 MTQΣ Labs. All rights reserved.",
} as const;

// ---------------------------------------------------------------------------
// Dialogs — every interactive element routes to truthful content.
// ---------------------------------------------------------------------------
export const WALLET_DIALOG = {
  title: "Wallet connection unavailable",
  body: "This landing page recreates the reference design's interface, but the MTQΣ pilot runs under a strict verification posture. No wallet SDK is loaded, no signer is exposed, and no wallet can be connected from this page.",
} as const;

export const VIDEO_DIALOG = {
  title: "Protocol overview",
  body: "A protocol overview video has not been published. What exists today is the committed evidence package: 13 verification suites re-run at HEAD with committed results — including reproduced critical findings (Genesis Safe 1/1 CRITICAL, C-043, custody: USDC 100% in the deployer EOA) — 49 registered conflicts preserved, and 0 of 7 release gates (evidence register) closed.",
} as const;

// Nav dialogs for Developers / Governance / Resources — condensed truthful
// content from the committed evidence register (audit-work/v6 D-1…D-6).
export const INFO_DIALOGS = [
  {
    id: "developers",
    title: "Developers",
    headline: "Testnet deployments & reproducible evidence",
    rows: [
      { label: "Monad Testnet (10143)", value: "9/9 contracts code verified (read-only)", status: "ok" as const },
      { label: "Arc Testnet (5042002)", value: "9/9 contracts code verified (read-only)", status: "ok" as const },
      { label: "Solana devnet", value: "SPL mint verified live (decimals 18)", status: "ok" as const },
      { label: "MTQ token identity", value: "name() MITHQAL · symbol() MTQ", status: "ok" as const },
      { label: "On-chain read-only tests", value: "28/28 PASS", status: "ok" as const },
      { label: "EIP-712 digests", value: "4/4 MATCH (digest-level)", status: "ok" as const },
      { label: "Foundry execution tests", value: "not runnable in sandbox", status: "warn" as const },
      { label: "Production deploy", value: "NOT AUTHORIZED", status: "fail" as const },
    ],
    footnote: "Canonical addresses: src/lib/mtq/contracts.ts — re-probed read-only this session; explorer links included per chain.",
  },
  {
    id: "governance",
    title: "Governance",
    headline: "No approvals exist — 0 of 7 release gates (evidence register) closed",
    rows: [
      { label: "Committee approvals in register", value: "none", status: "fail" as const },
      { label: "Open decisions blocking Gate 1", value: "OD-1 · OD-2 · OD-3 · OD-5", status: "warn" as const },
      { label: "Genesis Safe configuration", value: "1/1 deployer-controlled (expected 4/7)", status: "fail" as const },
      { label: "Gate 6 — production", value: "NOT AUTHORIZED", status: "fail" as const },
      { label: "Governance layers (code)", value: "implemented — no live signers", status: "ok" as const },
    ],
    footnote: "Full gate-by-gate register: audit-work/v6 D-5.",
  },
  {
    id: "resources",
    title: "Resources",
    headline: "Evidence package (D-1…D-6) — committed, never overwritten",
    rows: [
      { label: "D-1 Corrected acceptance report", value: "committed", status: "ok" as const },
      { label: "D-2 Custody reconciliation", value: "committed", status: "ok" as const },
      { label: "D-3 Canonical address book", value: "DRAFT", status: "warn" as const },
      { label: "D-4 Contract-size options", value: "V3 runtime 40,500 B — over EIP-170", status: "fail" as const },
      { label: "D-5 Remediation register", value: "R-01…R-16 planned", status: "warn" as const },
      { label: "D-6 Unresolved claims", value: "25 registered", status: "warn" as const },
    ],
    footnote: "Baseline b24e7e0 · verification b68ccb8 — re-run 2026-10-19.",
  },
] as const;
