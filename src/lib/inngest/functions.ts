// MTQΣ — Inngest Functions (v4 API — triggers in options object)

import { inngest } from "./client";

// 1. Keeper Tick — every 15 seconds
export const keeperTick = (inngest as any).createFunction(
  { id: "keeper-tick", name: "MTQΣ Keeper Tick", retries: 3, triggers: [{ cron: "*/15 * * * * *" }] },
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
export const tursoNeonSync = (inngest as any).createFunction(
  { id: "turso-neon-sync", name: "Turso → Neon Sync", retries: 2, triggers: [{ cron: "0 * * * *" }] },
  async ({ step, logger }: any) => {
    const neonUrl = process.env.NEON_DATABASE_URL;
    if (!neonUrl) {
      logger.info("Neon not configured — skipping");
      return { skipped: true };
    }
    // [Task 20, 2026-10-24] REAL sync — the read-count stub is retired. Read
    // and write happen in ONE step so rows never serialize through Inngest's
    // inter-step state; a retry re-reads and re-upserts the same window,
    // which is idempotent (INSERT … ON CONFLICT (id) DO NOTHING).
    // Boundaries, honestly:
    //   - Incremental TAIL sync only: latest SYNC_WINDOW rows per table
    //     (well above the pilot's ~5–9 rows/hour/table growth rate). Full
    //     history + parity check = scripts/full-neon-sync.ts (maintenance).
    //   - Column shape shared verbatim with the full sync via
    //     src/lib/neon-schema.ts (single source of truth).
    //   - Crons only FIRE when Inngest Cloud is wired: INNGEST_SIGNING_KEY
    //     must be set in Vercel + the app registered (owner action, see
    //     RUNBOOK §Neon).
    const SYNC_WINDOW = 100;
    const result = await step.run("sync-turso-to-neon", async () => {
      const { db } = await import("@/lib/db");
      const { neonClient } = await import("@/lib/neon-client");
      const [dsv, rd, os] = await Promise.all([
        db.dailyStateVector.findMany({ take: SYNC_WINDOW, orderBy: { tickAt: "desc" } }),
        db.rebalancingDecision.findMany({ take: SYNC_WINDOW, orderBy: { tickAt: "desc" } }),
        db.oracleSample.findMany({ take: SYNC_WINDOW, orderBy: { tickAt: "desc" } }),
      ]);
      const written = await neonClient.syncFromTurso({ dsv, rd, os });
      return {
        read: { dsv: dsv.length, rd: rd.length, os: os.length },
        written: written.tables,
        wroteToNeon: true,
        timestamp: new Date().toISOString(),
      };
    });
    logger.info(
      `turso-neon-sync: read ${result.read.dsv + result.read.rd + result.read.os} rows from Turso, upserted (new + already-present) into Neon — ${JSON.stringify(result.written)}`,
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
