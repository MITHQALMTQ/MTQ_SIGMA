// MTQΣ — Next.js instrumentation hook.
//
// Runs once per server boot (dev + prod). In the Node runtime it:
//   1. Restores any unstaged deletions of HEAD-tracked files (Task 47 —
//      closes the recurring "upload route deleted by re-image" class BEFORE
//      route compilation, no matter WHO started the server).
//   2. Boots the in-process MTQΣ Sovereign Devnet reference node (block
//      production, BFT consensus engines, SQLite chain store) — which itself
//      runs the forward-only DB self-heal before any schema/genesis work.
//   3. Starts the IN-PROCESS cloud-layer write-behind loop (Task 47): dump
//      freshness must never depend on dev-watchdog.sh survival — incident #7
//      proved the re-image kills the watchdog while the server keeps running,
//      leaving the git-tracked dumps unrefreshed for hours. Same 60s cadence,
//      same safety rules as the watchdog subloop (cloudSyncRefresh refuses to
//      overwrite a dump that is better than the live DB), plus a 60s
//      source-integrity sweep for mid-run file deletions.
// The Edge runtime is skipped.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // [1] Source-file integrity — before anything compiles or boots.
  try {
    const { restoreDeletedTrackedFiles } = await import("@/lib/boot/source-integrity");
    const report = restoreDeletedTrackedFiles();
    if (report.restored.length > 0) {
      console.log(
        `[source-integrity] boot restore: ${report.restored.length} file(s) recovered from HEAD — ` +
          report.restored.join(", "),
      );
    }
  } catch (e) {
    // Fail honest: loud, never crash the app over the guard itself.
    console.error("[source-integrity] boot guard FAILED (app continues):", e);
  }

  // [2] Chain devnet node (includes the DB self-heal — task42).
  try {
    const { ensureChainNode } = await import("@/lib/chain/node");
    await ensureChainNode();
  } catch (e) {
    // Fail honest: log loudly, keep serving the app WITHOUT the chain —
    // /api/chain routes report ready:false with the error. Never crash the
    // whole web app because the chain layer could not boot.
    console.error("[chain] devnet node FAILED to boot (app continues without chain):", e);
    const g = globalThis as unknown as { __MTQ_CHAIN_ERROR__?: string };
    g.__MTQ_CHAIN_ERROR__ = String(e);
  }

  // [2b] Pilot-engine warm boot (2026-11-08 root-cause fix — lazy-init gap).
  //      The §engine tick loop (pilot-state) previously started ONLY when an
  //      organic request hit /api/metrics — after a server restart with no
  //      browser traffic, /api/health honestly reported engine:false for an
  //      unbounded window and the metrics engine sat cold. Warm it here so
  //      the engine is a property of the SERVER boot, not of traffic. Fire-
  //      and-forget: register() must never block route compilation on FX
  //      network fetches; failures log loudly and the first metrics request
  //      still lazy-boots (belt).
  try {
    const pilot = await import("@/lib/mtq/pilot-state");
    void pilot.getSnapshot().then(
      () => console.log("[pilot] engine warm-booted at server start"),
      (e) => console.error("[pilot] engine warm-boot FAILED (first request will retry):", e),
    );
  } catch (e) {
    console.error("[pilot] warm-boot import failed (first request will retry):", e);
  }

  // [3] In-process cloud-sync write-behind + source-integrity sweep (Task 47).
  //     Global-this guarded (hot reload re-runs modules; the interval must
  //     not stack), unref'd (never keeps the process alive on shutdown).
  const g = globalThis as unknown as { __MTQ_GUARD_TIMER__?: ReturnType<typeof setInterval> };
  if (!g.__MTQ_GUARD_TIMER__) {
    const tick = async (): Promise<void> => {
      // 3a. write-behind dump refresh — never overwrites a better dump.
      try {
        const { cloudSyncRefresh } = await import("@/lib/db-ops");
        const r = await cloudSyncRefresh();
        if (r.chain.refreshed || r.custom.refreshed) {
          console.log(`[cloud-sync:inproc] chain ${r.chain.detail} · custom ${r.custom.detail}`);
        }
      } catch (e) {
        console.error("[cloud-sync:inproc] tick failed:", e);
      }
      // 3b. mid-run source-file deletion sweep (re-image while server runs).
      try {
        const { restoreDeletedTrackedFiles } = await import("@/lib/boot/source-integrity");
        const report = restoreDeletedTrackedFiles();
        if (report.restored.length > 0) {
          console.log(
            `[source-integrity] mid-run restore: ${report.restored.length} file(s) recovered from HEAD — ` +
              report.restored.join(", "),
          );
        }
      } catch {
        /* best-effort — next tick retries */
      }
    };
    g.__MTQ_GUARD_TIMER__ = setInterval(() => void tick(), 60_000);
    g.__MTQ_GUARD_TIMER__.unref?.();
    void tick(); // first tick immediately — bounded staleness right at boot
    console.log("[guard] in-process cloud-sync + source-integrity loop armed (60s)");
  }
}
