/// <reference types="bun-types" />
// ============================================================================
// MTQΣ — Task 12 · Release-Controls FAIL-CLOSED tests
// ============================================================================
// Proves (per Task 12 §6):
//   1. Default committed state: every control NOT_GRANTED, every chain-facing
//      action DENIED.
//   2. A green software gate alone authorizes NOTHING chain-facing.
//   3. Malformed / partial / unknown-version authorization sources are DENIED.
//   4. The ONLY path to "allowed" is a complete, valid, owner-authored grant
//      record for every required control (demonstrated with a synthetic grant
//      file — proving the mechanism can be opened ONLY deliberately).
//   5. The overall status remains NOT ACCEPTED regardless of grants recorded
//      (acceptance is a governance statement, not a file state).
// ============================================================================

import { describe, expect, test, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getControls,
  getReleaseState,
  isActionAllowed,
  assertActionAllowed,
  ReleaseControlError,
  ACTION_IDS,
  type ActionId,
} from "@/lib/mtq/release-controls";

const prevEnv = process.env.RELEASE_AUTHORIZATIONS_FILE;
const tmpFiles: string[] = [];

function setAuthSource(content: string | null): string {
  if (content === null) {
    delete process.env.RELEASE_AUTHORIZATIONS_FILE;
    return "";
  }
  const p = join(mkdtempSync(join(tmpdir(), "mtq-release-ctl-")), "authorizations.json");
  writeFileSync(p, content);
  tmpFiles.push(p);
  process.env.RELEASE_AUTHORIZATIONS_FILE = p;
  return p;
}

afterAll(() => {
  process.env.RELEASE_AUTHORIZATIONS_FILE = prevEnv;
  for (const f of tmpFiles) {
    try { rmSync(join(f, ".."), { recursive: true, force: true }); } catch { /* noop */ }
  }
});

const ALL_GRANTED = JSON.stringify({
  version: 1,
  grants: Object.fromEntries(
    [
      "software-tests", "contract-verification", "economic-validation",
      "governance-approval", "independent-security-review",
      "independent-legal-review", "live-pilot-authorization",
      "production-authorization",
    ].map(id => [id, {
      grantedBy: "SYNTHETIC TEST",
      grantedAt: "2026-10-23T00:00:00.000Z",
      evidenceRef: "synthetic://test-only",
    }]),
  ),
});

describe("release controls — fail-closed defaults (the committed posture)", () => {
  test("with NO authorization source, every control is NOT_GRANTED", () => {
    setAuthSource(null);
    const controls = getControls();
    expect(controls.length).toBe(8);
    expect(controls.every(c => c.status === "NOT_GRANTED")).toBe(true);
  });

  test("with NO authorization source, every chain-facing action is DENIED", () => {
    setAuthSource(null);
    const denied: ActionId[] = ACTION_IDS.filter(a => a !== "database-write");
    for (const a of denied) expect(isActionAllowed(a)).toBe(false);
  });

  test("a GREEN software gate alone authorizes NOTHING chain-facing", () => {
    const softwareOnly = JSON.stringify({
      version: 1,
      grants: {
        "software-tests": { grantedBy: "CI", grantedAt: "2026-10-23T00:00:00.000Z", evidenceRef: "ci://green" },
      },
    });
    setAuthSource(softwareOnly);
    expect(isActionAllowed("software-tests" as ActionId)).toBe(false); // not an action id
    // Every chain-facing action must remain denied with only the software gate:
    for (const a of ["keeper-tx-submission", "reserve-trade", "asset-movement", "role-change",
      "authority-change", "contract-deployment", "token-mint", "live-pilot-operations", "production-operations"] as ActionId[]) {
      expect(isActionAllowed(a)).toBe(false);
    }
    // …while the shadow-mode bookkeeping action becomes allowed (software gate
    // is its ONLY requirement — pilot bookkeeping must keep working):
    expect(isActionAllowed("database-write")).toBe(true);
  });

  test("assertActionAllowed THROWS a descriptive ReleaseControlError when denied", () => {
    setAuthSource(null);
    expect(() => assertActionAllowed("keeper-tx-submission")).toThrow(ReleaseControlError);
    try {
      assertActionAllowed("keeper-tx-submission");
      throw new Error("should have thrown");
    } catch (e) {
      const err = e as ReleaseControlError;
      expect(err.missing.length).toBe(6);
      expect(err.message.includes("SHADOW MODE ENFORCED")).toBe(true);
    }
  });

  test("unknown actions are DENIED (no wildcard openings)", () => {
    setAuthSource(ALL_GRANTED);
    // @ts-expect-error deliberate unknown action
    expect(isActionAllowed("make-everyone-rich")).toBe(false);
  });
});

describe("release controls — malformed sources stay DENIED (fail-closed)", () => {
  test("malformed JSON → all denied", () => {
    setAuthSource("{ this is not json");
    expect(isActionAllowed("keeper-tx-submission")).toBe(false);
  });

  test("unknown schema version → all denied", () => {
    setAuthSource(JSON.stringify({ version: 99, grants: {} }));
    expect(isActionAllowed("keeper-tx-submission")).toBe(false);
  });

  test("grant missing required fields is INVALID → that control stays NOT_GRANTED", () => {
    const partial = JSON.stringify({
      version: 1,
      grants: {
        "software-tests": { grantedBy: "owner", grantedAt: "2026-10-23T00:00:00.000Z" /* missing evidenceRef */ },
      },
    });
    setAuthSource(partial);
    const sw = getControls().find(c => c.id === "software-tests")!;
    expect(sw.status).toBe("NOT_GRANTED");
    expect(isActionAllowed("database-write")).toBe(false);
  });

  test("nonexistent authorization file path → all denied", () => {
    process.env.RELEASE_AUTHORIZATIONS_FILE = "/nonexistent/path/authorizations.json";
    expect(isActionAllowed("keeper-tx-submission")).toBe(false);
    expect(isActionAllowed("database-write")).toBe(false);
  });
});

describe("release controls — the deliberate opening path (and its limits)", () => {
  test("a COMPLETE valid grant set opens exactly the gated actions it satisfies", () => {
    setAuthSource(ALL_GRANTED);
    // Every action (incl. production-operations, which requires ALL 8) is now allowed…
    for (const a of ACTION_IDS) expect(isActionAllowed(a)).toBe(true);
  });

  test("granting everything EXCEPT production-authorization leaves production denied", () => {
    const g = JSON.parse(ALL_GRANTED);
    delete g.grants["production-authorization"];
    setAuthSource(JSON.stringify(g));
    expect(isActionAllowed("live-pilot-operations")).toBe(true);
    expect(isActionAllowed("production-operations")).toBe(false);
  });

  test("the overall release status reads NOT ACCEPTED regardless of grants (acceptance is a governance statement)", () => {
    setAuthSource(ALL_GRANTED);
    const state = getReleaseState();
    expect(state.overallStatus).toBe("NOT_ACCEPTED");
    expect(state.posture.includes("SHADOW MODE ENFORCED")).toBe(true);
  });
});
