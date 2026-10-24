// MTQΣ — Inngest Functions (v4 API — triggers in options object)

import { inngest } from "./client";

// 1. Keeper Tick — every minute
// [Task 21 fix] Was "*/15 * * * * *" (every 15 seconds) — INVALID on Inngest:
// the platform only supports minute-granularity 5-field crons, and the whole
// app registration was rejected because of this one trigger ("'*' isn't a
// valid cron schedule"). Every minute is the closest valid cadence (4× fewer
// runs than the 15s intent, ~43k runs/month — see RUNBOOK §2.3 run-rate note).
// The engine still self-ticks in-process between heartbeats; this cron keeps
// the serverless engine advancing when there is no API traffic.
export const keeperTick = (inngest as any).createFunction(
  { id: "keeper-tick", name: "MTQΣ Keeper Tick", retries: 3, triggers: [{ cron: "* * * * *" }] },
  async ({ step, logger }: any) => {
    const fx = await step.run("fetch-fx", async () => {
      const { fetchFxSnapshot } = await import("@/lib/mtq/fx");
      return await fetchFxSnapshot(false);
    });
    const snapshot = await step.run("advance-engine", async () => {
      const { getSnapshot } = await import("@/lib/mtq/pilot-state");
      return await getSnapshot();
    });
    if (snapshot.status === "EMERGENCY") {
      await step.run("alert-emergency", async () => {
        logger.error("EMERGENCY detected");
        const webhook = process.env.DISCORD_WEBHOOK_URL;
        if (webhook) {
          await fetch(webhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: `🚨 MTQΣ EMERGENCY: RR=${snapshot.reserveRatio}` }),
          });
        }
        return { alerted: true };
      });
    }
    return { status: snapshot.status, fx: fx.source?.slice(0, 50) };
  },
);

// 2. Turso→Neon Sync — hourly
// [Task 20] Real sync (the read-count stub retired). [Task 22] CURSOR
// REWRITE: the original "latest 100 rows/table" window was proven lossy in
// production at the 17:00Z 2026-10-24 run — live growth is DSV ~52 rows/h,
// RD ~260 rows/h, OS ~240 rows/h (keeper-tick every minute), so RD/OS grew
// ~2.4× faster than the window and ~60% of their rows were silently never
// mirrored. The sync now pages Turso with a DURABLE high-water cursor
// (Neon-side mtq_sync_state): WHERE (tickAt > cursor) OR (tickAt = cursor
// AND id > cursorId) ORDER BY tickAt,id — composite cursor on a PK is a
// total order, so no row can ever be skipped, regardless of growth rate or
// multi-hour gaps. First run (no cursor) sweeps from the beginning — ON
// CONFLICT DO NOTHING makes already-present rows free, so the sweep is the
// self-healing bootstrap that also backfills everything the window design
// skipped. Bounded per run: 500 rows/page × max 10 pages = 5,000 rows/table
// per hourly invocation (>> growth), so a backlog converges over a few runs
// without risking step timeouts. Turso retention (pruneAuditTrail, caps
// DSV 5k / RD 10k / OS 5k, oldest first) gives the honest outage bound: if
// the sync is down longer than a row's Turso lifetime (~21h OS, ~38h RD,
// ~83h DSV at current growth), pruned rows can only be recovered from the
// daily GitHub backup — see RUNBOOK §2.2/§2.3.
export const tursoNeonSync = (inngest as any).createFunction(
  { id: "turso-neon-sync", name: "Turso → Neon Sync", retries: 2, triggers: [{ cron: "0 * * * *" }] },
  async ({ step, logger }: any) => {
    const neonUrl = process.env.NEON_DATABASE_URL;
    if (!neonUrl) {
      logger.info("Neon not configured — skipping");
      return { skipped: true };
    }
    const result = await step.run("sync-turso-to-neon", async () => {
      const { db } = await import("@/lib/db");
      const { neonClient } = await import("@/lib/neon-client");
      await neonClient.ensureSyncStateTable();

      const delegates: Record<string, any> = {
        DailyStateVector: db.dailyStateVector,
        RebalancingDecision: db.rebalancingDecision,
        OracleSample: db.oracleSample,
      };
      const payloadKey: Record<string, "dsv" | "rd" | "os"> = {
        DailyStateVector: "dsv",
        RebalancingDecision: "rd",
        OracleSample: "os",
      };

      const PAGE = 500; // Turso rows read per page
      const MAX_PAGES = 10; // bounded per run: 5,000 rows/table ≫ hourly growth
      const report: Record<string, { read: number; pages: number; truncated: boolean; cursor: string | null }> = {};
      let totalRead = 0;

      for (const model of Object.keys(delegates)) {
        const delegate = delegates[model];
        let cursor = await neonClient.getSyncCursor(model);
        let pages = 0;
        let read = 0;
        let lastPageFull = false;
        while (pages < MAX_PAGES) {
          const where = cursor
            ? {
                OR: [
                  { tickAt: { gt: cursor.tickAt } },
                  { tickAt: cursor.tickAt, id: { gt: cursor.id } },
                ],
              }
            : undefined;
          const rows = await delegate.findMany({
            where,
            orderBy: [{ tickAt: "asc" }, { id: "asc" }],
            take: PAGE,
          });
          if (rows.length === 0) break;
          await neonClient.syncFromTurso({ [payloadKey[model]]: rows });
          read += rows.length;
          pages++;
          lastPageFull = rows.length === PAGE;
          const lastRow = rows[rows.length - 1];
          cursor = {
            tickAt: lastRow.tickAt instanceof Date ? lastRow.tickAt.toISOString() : String(lastRow.tickAt),
            id: String(lastRow.id),
          };
          if (!lastPageFull) break;
        }
        if (cursor) {
          await neonClient.setSyncCursor(model, cursor.tickAt, cursor.id);
        }
        report[model] = {
          read,
          pages,
          truncated: lastPageFull && pages === MAX_PAGES,
          cursor: cursor ? cursor.tickAt : null,
        };
        totalRead += read;
      }
      return { read: report, totalRead, timestamp: new Date().toISOString() };
    });
    logger.info(
      `turso-neon-sync: read ${result.totalRead} rows from Turso — ${JSON.stringify(result.read)}`,
    );
    return result;
  },
);

// 3. Daily Backup — 03:00 UTC
export const dailyBackup = (inngest as any).createFunction(
  { id: "daily-backup", name: "Daily Turso Backup", retries: 1, triggers: [{ cron: "0 3 * * *" }] },
  async ({ step, logger }: any) => {
    const result = await step.run("backup", async () => {
      const { createClient } = await import("@libsql/client");
      const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN });
      const tables = ["PilotTrial", "MetricSample", "DailyStateVector", "RebalancingDecision", "OracleSample"];
      const counts: Record<string, number> = {};
      for (const t of tables) {
        const r = await client.execute(`SELECT COUNT(*) as c FROM "${t}"`);
        counts[t] = Number((r.rows[0] as any)?.c ?? 0);
      }
      return { counts, timestamp: new Date().toISOString() };
    });
    logger.info(`Backup: ${JSON.stringify(result.counts)}`);
    return result;
  },
);

// 4. Oracle Health Monitor — every 5 minutes
export const oracleHealthMonitor = (inngest as any).createFunction(
  { id: "oracle-health", name: "Oracle Health Monitor", retries: 2, triggers: [{ cron: "*/5 * * * *" }] },
  async ({ step, logger }: any) => {
    const health = await step.run("check", async () => {
      const { getSnapshot } = await import("@/lib/mtq/pilot-state");
      const snap = await getSnapshot();
      return { status: snap.status, rr: snap.reserveRatio, lcr: snap.lcr, nav: snap.nav };
    });
    if (health.status === "EMERGENCY" || health.status === "DEFENSIVE") {
      logger.warn(`Stress: ${health.status} | RR: ${health.rr}`);
    }
    return health;
  },
);

// 5. FRED Data Refresh — hourly
export const fredDataRefresh = (inngest as any).createFunction(
  { id: "fred-refresh", name: "FRED Data Refresh", retries: 2, triggers: [{ cron: "0 * * * *" }] },
  async ({ step, logger }: any) => {
    const data = await step.run("fetch-fred", async () => {
      const { fetchFredMacroSignals } = await import("@/lib/mtq/fred");
      return await fetchFredMacroSignals();
    });
    logger.info(`FRED: VIX=${data.vix}, DXY=${data.dxy}`);
    return data;
  },
);

// 6. Audit Trail Prune — every 6 hours
export const auditTrailPrune = (inngest as any).createFunction(
  { id: "audit-prune", name: "Audit Trail Prune", retries: 1, triggers: [{ cron: "0 */6 * * *" }] },
  async ({ step, logger }: any) => {
    const result = await step.run("prune", async () => {
      const { db } = await import("@/lib/db");
      const [dsvC, rdC, osC] = await Promise.all([
        db.dailyStateVector.count(),
        db.rebalancingDecision.count(),
        db.oracleSample.count(),
      ]);
      return { dsv: dsvC, rd: rdC, os: osC };
    });
    logger.info(`Audit trail sizes: ${JSON.stringify(result)}`);
    return result;
  },
);

export const allFunctions = [
  keeperTick,
  tursoNeonSync,
  dailyBackup,
  oracleHealthMonitor,
  fredDataRefresh,
  auditTrailPrune,
];
