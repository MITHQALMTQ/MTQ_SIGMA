// V31 TURN 3 — §10 regression battery: db-plane-state classifier units.
// Every DB-side state of the 14-state taxonomy, plus precedence and decay.
// Pure function tests — no I/O, no network, no live database.

import { describe, expect, test } from "bun:test";
import { classifyDbPlane, type DbPlaneInput } from "../../src/lib/boot/db-plane-state";
import type { ChainProbeResult, CustomProbeResult, DbProbeStatus } from "../../src/lib/boot/db-probe";

const GENESIS = "gen_3baf0dba552b527da4e9f6cedae44d04d0a40f7d";

function chainProbe(status: DbProbeStatus, height?: number, extra: Partial<ChainProbeResult> = {}): ChainProbeResult {
  return { status, height, blocks: height ?? 0, genesis: GENESIS, ...extra } as ChainProbeResult;
}
function customProbe(status: DbProbeStatus, rows?: number): CustomProbeResult {
  return { status, rows, tables: rows ? 3 : 0 } as CustomProbeResult;
}
function base(over: Partial<DbPlaneInput> = {}): DbPlaneInput {
  return {
    chainProbe: chainProbe("DATABASE_HEALTHY", 5000),
    customProbe: customProbe("DATABASE_HEALTHY", 9000),
    bootMode: "resume",
    selfhealAt: null,
    pointer: null,
    journalTail: null,
    committedTip: 5000,
    committedCustomRows: 9000,
    ...over,
  };
}

describe("db-plane-state — healthy family", () => {
  test("HEALTHY: live at/ahead of every reference, no journal activity", () => {
    const c = classifyDbPlane(base());
    expect(c.state).toBe("HEALTHY");
    expect(c.severity).toBe("ok");
  });

  test("HEALTHY: live ahead of pointer and committed (forward growth)", () => {
    const c = classifyDbPlane(base({ pointer: { chainTip: 5000, activatedAt: "2026-11-09T10:00:00.000Z" } }));
    expect(c.state).toBe("HEALTHY");
  });

  test("DATABASE_RECOVERED: fresh ACTIVATED tail within 30min and live at pointer", () => {
    const now = new Date("2026-11-09T12:10:00.000Z");
    const c = classifyDbPlane(base({
      pointer: { chainTip: 5000, activatedAt: "2026-11-09T12:00:00.000Z" },
      journalTail: { phase: "ACTIVATED", ts: "2026-11-09T12:00:30.000Z" },
      now,
    }));
    expect(c.state).toBe("DATABASE_RECOVERED");
    expect(c.severity).toBe("ok");
  });

  test("DATABASE_RECOVERED decays to HEALTHY after the 30-minute window", () => {
    const now = new Date("2026-11-09T12:45:00.000Z");
    const c = classifyDbPlane(base({
      pointer: { chainTip: 5000, activatedAt: "2026-11-09T12:00:00.000Z" },
      journalTail: { phase: "ACTIVATED", ts: "2026-11-09T12:00:30.000Z" },
      now,
    }));
    expect(c.state).toBe("HEALTHY");
  });

  test("DATABASE_RECOVERED NOT claimed when live is below the activated pointer", () => {
    const now = new Date("2026-11-09T12:10:00.000Z");
    const c = classifyDbPlane(base({
      chainProbe: chainProbe("DATABASE_HEALTHY", 4000),
      pointer: { chainTip: 5000, activatedAt: "2026-11-09T12:00:00.000Z" },
      journalTail: { phase: "ACTIVATED", ts: "2026-11-09T12:00:30.000Z" },
      committedTip: 5000,
      now,
    }));
    expect(c.state).not.toBe("DATABASE_RECOVERED");
    expect(c.state).toBe("DATABASE_REGRESSION");
  });
});

describe("db-plane-state — recovery pipeline states", () => {
  test("RECOVERY_IN_PROGRESS: fresh ACTIVATING tail (transient, not alert)", () => {
    const now = new Date("2026-11-09T12:05:00.000Z");
    const c = classifyDbPlane(base({ journalTail: { phase: "ACTIVATING", ts: "2026-11-09T12:00:00.000Z" }, now }));
    expect(c.state).toBe("RECOVERY_IN_PROGRESS");
    expect(c.severity).toBe("transient");
  });

  test("RECOVERY_IN_PROGRESS: fresh PREPARE tail", () => {
    const now = new Date("2026-11-09T12:05:00.000Z");
    const c = classifyDbPlane(base({ journalTail: { phase: "PREPARE", ts: "2026-11-09T12:00:00.000Z" }, now }));
    expect(c.state).toBe("RECOVERY_IN_PROGRESS");
  });

  test("RECOVERY_IN_PROGRESS: fresh VALIDATED tail", () => {
    const now = new Date("2026-11-09T12:05:00.000Z");
    const c = classifyDbPlane(base({ journalTail: { phase: "VALIDATED", ts: "2026-11-09T12:00:00.000Z" }, now }));
    expect(c.state).toBe("RECOVERY_IN_PROGRESS");
  });

  test("RECOVERY_FAILED: tail PREPARE_FAILED", () => {
    const c = classifyDbPlane(base({ journalTail: { phase: "PREPARE_FAILED", ts: "2026-11-09T12:00:00.000Z" } }));
    expect(c.state).toBe("RECOVERY_FAILED");
    expect(c.severity).toBe("alert");
  });

  test("RECOVERY_FAILED: tail VALIDATION_FAILED", () => {
    const c = classifyDbPlane(base({ journalTail: { phase: "VALIDATION_FAILED", ts: "2026-11-09T12:00:00.000Z" } }));
    expect(c.state).toBe("RECOVERY_FAILED");
  });

  test("RECOVERY_FAILED: ACTIVATING unresolved for >30 minutes (reconciler did not complete it)", () => {
    const now = new Date("2026-11-09T13:00:00.000Z");
    const c = classifyDbPlane(base({ journalTail: { phase: "ACTIVATING", ts: "2026-11-09T12:00:00.000Z" }, now }));
    expect(c.state).toBe("RECOVERY_FAILED");
  });

  test("terminal phases (ROLLED_BACK / DISCARDED / RECONCILED_*) fall through to tip geometry", () => {
    const c = classifyDbPlane(base({ journalTail: { phase: "ROLLED_BACK", ts: "2026-11-09T12:00:00.000Z" } }));
    expect(c.state).toBe("HEALTHY");
  });
});

describe("db-plane-state — probe-failure states (never height zero)", () => {
  test("DATABASE_UNREADABLE: chain BUSY", () => {
    const c = classifyDbPlane(base({ chainProbe: chainProbe("DATABASE_BUSY", undefined, { detail: "database is locked" }) }));
    expect(c.state).toBe("DATABASE_UNREADABLE");
    expect(c.severity).toBe("alert");
  });

  test("DATABASE_UNREADABLE: chain INTEGRITY_FAILURE", () => {
    const c = classifyDbPlane(base({ chainProbe: chainProbe("DATABASE_INTEGRITY_FAILURE", 4000, { detail: "integrity_check: bad" }) }));
    expect(c.state).toBe("DATABASE_UNREADABLE");
  });

  test("DATABASE_UNREADABLE: chain SCHEMA_UNSUPPORTED", () => {
    const c = classifyDbPlane(base({ chainProbe: chainProbe("DATABASE_SCHEMA_UNSUPPORTED", undefined, { detail: "no blocks table" }) }));
    expect(c.state).toBe("DATABASE_UNREADABLE");
  });

  test("DATABASE_UNREADABLE: custom unreadable poisons the pair", () => {
    const c = classifyDbPlane(base({ customProbe: customProbe("DATABASE_UNREADABLE") }));
    expect(c.state).toBe("DATABASE_UNREADABLE");
  });

  test("DATABASE_IDENTITY_MISMATCH: non-canonical genesis", () => {
    const c = classifyDbPlane(base({ chainProbe: chainProbe("DATABASE_IDENTITY_MISMATCH", 4000, { genesis: "gen_ffffffff" }) }));
    expect(c.state).toBe("DATABASE_IDENTITY_MISMATCH");
    expect(c.severity).toBe("alert");
  });
});

describe("db-plane-state — regression & stale-image family", () => {
  test("DATABASE_REGRESSION: live below the active-generation pointer", () => {
    const c = classifyDbPlane(base({
      chainProbe: chainProbe("DATABASE_HEALTHY", 3941),
      pointer: { chainTip: 20333, activatedAt: "2026-11-09T03:20:21.000Z" },
      committedTip: 20333,
    }));
    expect(c.state).toBe("DATABASE_REGRESSION");
    expect(c.severity).toBe("alert");
  });

  test("STALE_IMAGE: live below pointer AND serving restore NEWER than the pointer activation", () => {
    const c = classifyDbPlane(base({
      chainProbe: chainProbe("DATABASE_HEALTHY", 3941),
      bootMode: "self-healed",
      selfhealAt: "2026-11-09T11:53:41.959Z",
      pointer: { chainTip: 20333, activatedAt: "2026-11-09T03:20:21.000Z" },
      committedTip: 20333,
    }));
    expect(c.state).toBe("STALE_IMAGE");
    expect(c.severity).toBe("alert");
  });

  test("boot_mode=self-healed alone is NOT a stale-image verdict (markers survive sanctioned restores)", () => {
    // The 2026-11-09 live state: selfheal_at 12:22 OLDER than activation
    // 15:23, live h21679 >= pointer h21601, committed h21601.
    const c = classifyDbPlane(base({
      chainProbe: chainProbe("DATABASE_HEALTHY", 21679),
      bootMode: "self-healed",
      selfhealAt: "2026-11-09T12:22:19.263Z",
      pointer: { chainTip: 21601, activatedAt: "2026-11-09T15:23:10.860Z" },
      committedTip: 21601,
      customProbe: customProbe("DATABASE_HEALTHY", 18023),
      committedCustomRows: 18077,
    }));
    expect(c.state).toBe("HEALTHY");
  });

  test("DATABASE_REGRESSION: chain database MISSING (wipe signature)", () => {
    const c = classifyDbPlane(base({
      chainProbe: { status: "DATABASE_MISSING", detail: "absent" } as ChainProbeResult,
    }));
    expect(c.state).toBe("DATABASE_REGRESSION");
  });

  test("DATABASE_REGRESSION: live materially behind the committed layer (deficit > 60)", () => {
    const c = classifyDbPlane(base({ committedTip: 21000 }));
    expect(c.state).toBe("DATABASE_REGRESSION");
  });

  test("DATABASE_REGRESSION: custom materially behind its committed layer", () => {
    const c = classifyDbPlane(base({ customProbe: customProbe("DATABASE_HEALTHY", 5000), committedCustomRows: 18000 }));
    expect(c.state).toBe("DATABASE_REGRESSION");
  });

  test("custom prune tolerance: a sub-10% deficit is NOT a regression", () => {
    const c = classifyDbPlane(base({ customProbe: customProbe("DATABASE_HEALTHY", 16500), committedCustomRows: 18000 }));
    expect(c.state).toBe("HEALTHY");
  });
});

describe("db-plane-state — precedence", () => {
  test("a failed recovery journal entry outranks an unreadable live probe", () => {
    const c = classifyDbPlane(base({
      chainProbe: chainProbe("DATABASE_BUSY"),
      journalTail: { phase: "VALIDATION_FAILED", ts: "2026-11-09T12:00:00.000Z" },
    }));
    expect(c.state).toBe("RECOVERY_FAILED");
  });

  test("an in-progress recovery outranks a regression signal (pipeline is handling it)", () => {
    const now = new Date("2026-11-09T12:05:00.000Z");
    const c = classifyDbPlane(base({
      chainProbe: chainProbe("DATABASE_HEALTHY", 3941),
      pointer: { chainTip: 20333, activatedAt: "2026-11-09T03:20:21.000Z" },
      committedTip: 20333,
      journalTail: { phase: "ACTIVATING", ts: "2026-11-09T12:00:00.000Z" },
      now,
    }));
    expect(c.state).toBe("RECOVERY_IN_PROGRESS");
  });
});
