// ============================================================================
// MTQΣ — Task 12 §6 · Release Controls (FAIL-CLOSED)
// ============================================================================
// TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN
//
// This module is the single source of truth for execution authorization. It
// implements the mandated separation of control states:
//
//   1. Software tests                    (software-tests)
//   2. Contract & architecture verification (contract-verification)
//   3. Economic-model validation         (economic-validation)
//   4. Governance approval               (governance-approval)
//   5. Independent security review       (independent-security-review)
//   6. Independent economic/legal review (independent-legal-review)
//   7. Live-pilot authorization          (live-pilot-authorization)
//   8. Production authorization           (production-authorization)
//
// THESE ARE SEPARATE CONTROLS. A green software test, a passing build, a
// completed audit report, a signed-in user, or an available keeper endpoint
// advances NONE of them. The ONLY way a control becomes GRANTED is an
// explicit, owner-authored authorization record (see §"Authorization source").
//
// FAIL-CLOSED MEANS:
//   • Default (this repository as committed): every control NOT_GRANTED,
//     every action DENIED.
//   • Malformed / partially-populated authorization source → DENIED.
//   • Missing fields in any grant → that grant is invalid → DENIED.
//   • Unknown action → DENIED.
//
// This module is DEPENDENCY-FREE so the keeper mini-service (and any future
// executor) can import it directly without pulling the web app's tree.
// ============================================================================

// ---------------------------------------------------------------------------
// §1  Control states
// ---------------------------------------------------------------------------

export const CONTROL_IDS = [
  "software-tests",
  "contract-verification",
  "economic-validation",
  "governance-approval",
  "independent-security-review",
  "independent-legal-review",
  "live-pilot-authorization",
  "production-authorization",
] as const;

export type ControlId = (typeof CONTROL_IDS)[number];

export type ControlStatus = "NOT_GRANTED" | "GRANTED";

export interface ControlState {
  id: ControlId;
  /** Human-readable name of the control (Task 12 §6 wording). */
  name: string;
  status: ControlStatus;
  /** Required for a GRANTED state; recorded in the authorization record. */
  grantedBy?: string;
  grantedAt?: string;   // ISO 8601
  evidenceRef?: string; // pointer to the approval artifact (outside this module)
}

export const CONTROL_NAMES: Record<ControlId, string> = {
  "software-tests": "Software tests",
  "contract-verification": "Contract & architecture verification",
  "economic-validation": "Economic-model validation",
  "governance-approval": "Governance approval",
  "independent-security-review": "Independent security review",
  "independent-legal-review": "Independent economic & legal review",
  "live-pilot-authorization": "Live-pilot authorization",
  "production-authorization": "Production authorization",
};

// ---------------------------------------------------------------------------
// §2  Authorization source
// ---------------------------------------------------------------------------
// The committed repository authorizes NOTHING. Grants live in an
// owner-authored JSON file whose path is provided at RUNTIME via the
// RELEASE_AUTHORIZATIONS_FILE environment variable (e.g. on an owner-controlled
// machine, outside git). The file is NOT part of this repository.
//
// Schema (all fields required per grant; anything else is invalid):
// {
//   "version": 1,
//   "grants": {
//     "<ControlId>": { "grantedBy": "...", "grantedAt": "ISO-8601", "evidenceRef": "..." }
//   }
// }

import { readFileSync } from "node:fs";

export interface GrantRecord {
  grantedBy: string;
  grantedAt: string;
  evidenceRef: string;
}

export interface AuthorizationFile {
  version: number;
  grants: Partial<Record<ControlId, GrantRecord>>;
}

function isValidGrant(g: unknown): g is GrantRecord {
  if (typeof g !== "object" || g === null) return false;
  const r = g as Record<string, unknown>;
  return (
    typeof r.grantedBy === "string" && r.grantedBy.trim().length > 0 &&
    typeof r.grantedAt === "string" && r.grantedAt.trim().length > 0 &&
    typeof r.evidenceRef === "string" && r.evidenceRef.trim().length > 0
  );
}

function loadAuthorizationFile(): AuthorizationFile | null {
  const path = process.env.RELEASE_AUTHORIZATIONS_FILE;
  if (!path || path.trim() === "") return null; // no source → all NOT_GRANTED
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null; // unreadable/absent → fail-closed
  }
  try {
    const parsed = JSON.parse(raw) as AuthorizationFile;
    if (typeof parsed !== "object" || parsed === null) return null;
    if (parsed.version !== 1) return null; // unknown schema → fail-closed
    if (typeof parsed.grants !== "object" || parsed.grants === null) return null;
    return parsed;
  } catch {
    return null; // malformed JSON → fail-closed
  }
}

// ---------------------------------------------------------------------------
// §3  Computed control states
// ---------------------------------------------------------------------------

export function getControls(): ControlState[] {
  const auth = loadAuthorizationFile();
  return CONTROL_IDS.map((id) => {
    const g = auth?.grants?.[id];
    if (isValidGrant(g)) {
      return { id, name: CONTROL_NAMES[id], status: "GRANTED" as const, ...g };
    }
    // Invalid/partial grant → NOT_GRANTED (fail-closed)
    return { id, name: CONTROL_NAMES[id], status: "NOT_GRANTED" as const };
  });
}

export function getReleaseState(): {
  posture: string;
  overallStatus: "NOT_ACCEPTED" | "ACCEPTED";
  controls: ControlState[];
  grantedCount: number;
} {
  const controls = getControls();
  const grantedCount = controls.filter(c => c.status === "GRANTED").length;
  return {
    posture: "TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN",
    overallStatus: "NOT_ACCEPTED",
    controls,
    grantedCount,
  };
}

// ---------------------------------------------------------------------------
// §4  Actions and their REQUIRED control sets
// ---------------------------------------------------------------------------
// An action is allowed ONLY if every control in its required set is GRANTED.
// The sets implement the separation rules:
//   • software-tests gate alone authorizes nothing chain-facing;
//   • blockchain/asset/authority actions additionally require the human gates;
//   • live-pilot and production are gated on ALL of their prerequisites.

export const ACTION_IDS = [
  "keeper-tx-submission",      // keeper signs/submits any on-chain transaction
  "reserve-trade",              // reserve rebalancing / asset trades
  "asset-movement",             // moving tokens / native balances between accounts
  "role-change",               // grantRole / revokeRole / ownership transfer
  "authority-change",          // Safe reconfig / Solana SetAuthority
  "contract-deployment",       // deploying any new contract
  "token-mint",                // minting MTQ on any chain
  "database-write",            // app-level writes (pilot bookkeeping) — ALLOWED BY DEFAULT
  "live-pilot-operations",     // operating the live pilot beyond shadow mode
  "production-operations",      // any production action
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export const ACTION_REQUIREMENTS: Record<ActionId, ControlId[]> = {
  // Keeper transaction submission is a LIVE-PILOT class action: requires the
  // contract/econ verification chain + governance + security review + explicit
  // live-pilot authorization. Software tests alone never unlock it.
  "keeper-tx-submission": [
    "software-tests",
    "contract-verification",
    "economic-validation",
    "governance-approval",
    "independent-security-review",
    "live-pilot-authorization",
  ],
  "reserve-trade": [
    "software-tests",
    "contract-verification",
    "economic-validation",
    "governance-approval",
    "independent-security-review",
    "independent-legal-review",
    "live-pilot-authorization",
  ],
  "asset-movement": [
    "governance-approval",
    "independent-security-review",
    "live-pilot-authorization",
  ],
  "role-change": [
    "governance-approval",
    "independent-security-review",
  ],
  "authority-change": [
    "governance-approval",
    "independent-security-review",
  ],
  "contract-deployment": [
    "software-tests",
    "contract-verification",
    "governance-approval",
  ],
  "token-mint": [
    "software-tests",
    "contract-verification",
    "economic-validation",
    "governance-approval",
    "independent-security-review",
    "live-pilot-authorization",
  ],
  // Pilot bookkeeping (simulated trials, engine state, audit trail) stays
  // functional in shadow mode — it is NOT a chain-facing action. It requires
  // only the software gate and is the ONLY action reachable in the default
  // posture.
  "database-write": [
    "software-tests",
  ],
  "live-pilot-operations": [
    "software-tests",
    "contract-verification",
    "economic-validation",
    "governance-approval",
    "independent-security-review",
    "independent-legal-review",
    "live-pilot-authorization",
  ],
  "production-operations": [
    // Production requires EVERY control — including production-authorization
    // itself, which can only be granted after all others exist.
    ...CONTROL_IDS.slice(),
  ],
};

export class ReleaseControlError extends Error {
  constructor(
    public action: ActionId,
    public missing: ControlId[],
    public invalidGrants: ControlId[],
  ) {
    super(
      `RELEASE CONTROL: action '${action}' DENIED (fail-closed). ` +
      (missing.length > 0 ? `Missing grants: ${missing.join(", ")}. ` : "") +
      (invalidGrants.length > 0 ? `Invalid/incomplete grants: ${invalidGrants.join(", ")}. ` : "") +
      `Posture: TESTNET ONLY · SHADOW MODE ENFORCED · UNAUTHORIZED RESERVE TRANSACTIONS FORBIDDEN.`,
    );
    this.name = "ReleaseControlError";
  }
}

export function isActionAllowed(action: ActionId): boolean {
  if (!ACTION_IDS.includes(action)) return false; // unknown action → DENIED
  const requirements = ACTION_REQUIREMENTS[action];
  const controls = getControls();
  const missing: ControlId[] = [];
  const invalid: ControlId[] = [];
  for (const req of requirements) {
    const c = controls.find(x => x.id === req)!;
    if (c.status !== "GRANTED") {
      // Distinguish "no grant at all" from "grant present but invalid" for
      // operator diagnostics (both DENY).
      missing.push(req);
    }
  }
  return missing.length === 0;
}

/** Fail-closed assertion — throws ReleaseControlError when denied. */
export function assertActionAllowed(action: ActionId): void {
  if (isActionAllowed(action)) return;
  const requirements = ACTION_REQUIREMENTS[action] ?? [];
  const controls = getControls();
  const missing = requirements.filter(id => controls.find(c => c.id === id)?.status !== "GRANTED");
  throw new ReleaseControlError(action, missing, []);
}

/** Diagnostics for /health-style surfaces (read-only; never grants anything). */
export function describeAction(action: ActionId): {
  action: ActionId;
  allowed: boolean;
  requiredControls: Array<{ id: ControlId; status: ControlStatus }>;
} {
  const controls = getControls();
  return {
    action,
    allowed: isActionAllowed(action),
    requiredControls: (ACTION_REQUIREMENTS[action] ?? []).map(id => ({
      id,
      status: controls.find(c => c.id === id)?.status ?? "NOT_GRANTED",
    })),
  };
}
