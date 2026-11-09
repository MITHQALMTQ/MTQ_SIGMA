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
//   4. In-process git-drift guard (Task 60 — incident #8): if the re-image
//      strikes while THIS server keeps running (watchdog killed, server
//      alive — the incident #7 geometry), local HEAD goes stale vs
//      origin/main. The guard realigns forward-only under the same proofs
//      as the watchdog CLI (fast-forward, or diverged-with-subsumption);
//      dev-server hot reload picks up the swapped sources. Runtime-layer
//      refresh (bun install) is intentionally skipped in-process — the
//      watchdog's clean reboot owns that.
// The Edge runtime is skipped.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // [0] GIT-DRIFT GUARD — BEFORE the DB self-heal (v29 §3/§4, v30 Phase D).
  //     Live incident 2026-11-08T22:47:59Z: a re-image booted the platform's
  //     own `next dev` directly on a STALE task46-era snapshot (no watchdog,
  //     no external bootstrap), and ensureChainNode's forward-only self-heal
  //     restored db/chain.db from the snapshot's OBSOLETE disk dump (h3941)
  //     while origin/main's committed dump was h17661 → a 13,719-block data
  //     regression executed BEFORE any repository verification. This gate
  //     makes that ordering structurally impossible in-process, no matter
  //     WHO starts the server: the tree is realigned forward-only (under the
  //     guard's archive + content-subsumption proofs; db/*.db never touched)
  //     BEFORE the self-heal reads the disk dumps, so the dumps the heal
  //     consumes are the newest committed ones. Every FUTURE snapshot ships
  //     this gate (it is committed source), which is what makes the fix
  //     permanent across re-images.
  //     BLOCKED (genuine unique local content) → the chain layer does NOT
  //     self-heal over unadjudicated content — it stands down and reports
  //     (operator adjudication), while the web app keeps serving.
  //     Fetch/verify unreachable (e.g. transient network at boot) → proceed
  //     best-effort with the disk dumps and log LOUDLY; the authoritative
  //     strict gate remains the EXTERNAL bootstrap (scripts/plane5-bootstrap.
  //     sh exit 9/12 semantics) + the watchdog v4 boot chain.
  let driftBlocked = false;
  let driftUnverified = false;
  try {
    const { guardGitDrift } = await import("@/lib/boot/git-drift");
    const r = guardGitDrift({ runtimeRefresh: false });
    if (r.action === "blocked") {
      driftBlocked = true;
      console.error(
        `[git-drift:boot] BLOCKED (${r.note ?? "unique local content"}) — DB self-heal STANDS DOWN pending operator adjudication; ` +
          `chain layer will report ready:false`,
      );
    } else if (r.action === "fast-forwarded" || r.action === "realigned") {
      console.log(
        `[git-drift:boot] ${r.action} → origin/main ${r.status.origin.slice(0, 12)} BEFORE db self-heal — ` +
          `the disk dumps the heal reads are now the newest committed ones`,
      );
    }
  } catch (e) {
    // V31 RC-8 (Phase 6.B fail-closed): a guard FAILURE leaves origin UNVERIFIED.
    // A temporary network failure must never silently authorize recovery from a
    // stale local dump — the chain node (and its self-heal) stands down, the web
    // app serves degraded, and the 60s tick below lifts the stand-down once the
    // guard verifies origin mid-run.
    driftUnverified = true;
    console.error("[git-drift:boot] guard FAILED (origin UNVERIFIED) — DB self-heal STANDS DOWN fail-closed; retry via the 60s tick:", e);
  }

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

  // [2] Chain devnet node (includes the DB self-heal — task42). Gated on
  //     the [0] drift verdict: BLOCKED means never self-heal over
  //     unadjudicated unique content.
  if (driftBlocked || driftUnverified) {
    const g = globalThis as unknown as { __MTQ_CHAIN_ERROR__?: string; __MTQ_CHAIN_STANDDOWN_UNVERIFIED__?: boolean };
    if (driftBlocked) {
      g.__MTQ_CHAIN_ERROR__ = "git-drift guard BLOCKED at boot — DB self-heal stood down pending operator adjudication";
    } else {
      g.__MTQ_CHAIN_ERROR__ = "git-drift guard UNVERIFIED at boot — DB self-heal stood down fail-closed (a temporary verification failure must not authorize recovery from a stale local dump)";
      g.__MTQ_CHAIN_STANDDOWN_UNVERIFIED__ = true;
    }
  } else {
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
  } // end else (not driftBlocked) — chain node + DB self-heal gated on [0]

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
  //     V31 TURN 2A (incident 19 fix): the write-behind now refreshes the
  //     UNTRACKED STAGING dumps (backups/db-snapshots/.staging/) — the
  //     git-tracked published files are written only by the validated atomic
  //     publisher (scripts/snapshot-publish.ts), so the platform turn-end
  //     auto-commit can no longer sweep a dirty tracked dump into unpushed
  //     uncontrolled commits (the incident-19 loop). A threshold-gated
  //     publication (≥ PUBLISH_CHAIN_DELTA blocks) bounds published-snapshot
  //     staleness even while scheduler fires are rejected — the publisher
  //     itself classifies the git state first and never publishes from an
  //     unadjudicated tree.
  const g = globalThis as unknown as { __MTQ_GUARD_TIMER__?: ReturnType<typeof setInterval> };
  if (!g.__MTQ_GUARD_TIMER__) {
    const tick = async (): Promise<void> => {
      // 3a. write-behind dump refresh (staging) — never overwrites a better dump.
      try {
        const { cloudSyncRefresh } = await import("@/lib/db-ops");
        const r = await cloudSyncRefresh();
        if (r.chain.refreshed || r.custom.refreshed) {
          console.log(`[cloud-sync:inproc] chain ${r.chain.detail} · custom ${r.custom.detail}`);
        }
      } catch (e) {
        console.error("[cloud-sync:inproc] tick failed:", e);
      }
      // 3a2. threshold-gated snapshot publication (V31 TURN 2A): when the
      //      staged dump is far enough past the published one, spawn the
      //      validated publisher ONCE. Fire-and-forget — the tick never
      //      blocks on git, and the publisher refuses unadjudicated trees.
      //      The spawn lives in @/lib/boot/inproc-publication (the module
      //      owns its node builtins) because DIRECT node:-imports here break
      //      the Edge-runtime compilation of this entry (observed live
      //      2026-11-09T03:12Z).
      try {
        const { maybePublishThreshold } = await import("@/lib/boot/inproc-publication");
        await maybePublishThreshold();
      } catch (e) {
        console.error("[cloud-sync:inproc] publication check failed (non-fatal):", e);
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
      // 3c. mid-run git-drift guard (task60 — incident #8: re-image while the
      //     server runs leaves HEAD stale vs origin/main; realign forward-only
      //     under proof so hot-reload serves fresh code instead of stale).
      try {
        const { guardGitDrift } = await import("@/lib/boot/git-drift");
        const r = guardGitDrift({ runtimeRefresh: false });
        if (r.action === "fast-forwarded" || r.action === "realigned") {
          console.log(
            `[git-drift:inproc] ${r.action} → origin/main ${r.status.origin.slice(0, 12)} — dev hot-reload is picking up the realigned sources; ` +
              `a clean server restart is advised (watchdog will do it on its next loop).`,
          );
        }
        // V31 RC-8 recovery path: lift an UNVERIFIED boot stand-down once the
        // guard has verified origin mid-run (any non-blocked action here means
        // origin/main was fetched and classified — the dumps the heal will
        // consume are now verified-newest). BLOCKED stands-down are NEVER
        // lifted automatically (operator adjudication required).
        const sg = globalThis as unknown as { __MTQ_CHAIN_STANDDOWN_UNVERIFIED__?: boolean; __MTQ_CHAIN_ERROR__?: string };
        if (sg.__MTQ_CHAIN_STANDDOWN_UNVERIFIED__ && r.action !== "blocked") {
          sg.__MTQ_CHAIN_STANDDOWN_UNVERIFIED__ = false;
          try {
            const { ensureChainNode } = await import("@/lib/chain/node");
            await ensureChainNode();
            sg.__MTQ_CHAIN_ERROR__ = undefined;
            console.log("[chain] stand-down LIFTED mid-run: guard verified origin — chain node booted");
          } catch (bootErr) {
            sg.__MTQ_CHAIN_STANDDOWN_UNVERIFIED__ = true;
            sg.__MTQ_CHAIN_ERROR__ = String(bootErr);
            console.error("[chain] stand-down lift FAILED (retries next tick):", bootErr);
          }
        }
      } catch (e) {
        console.error("[git-drift:inproc] tick failed:", e);
      }
    };
    g.__MTQ_GUARD_TIMER__ = setInterval(() => void tick(), 60_000);
    g.__MTQ_GUARD_TIMER__.unref?.();
    void tick(); // first tick immediately — bounded staleness right at boot
    console.log("[guard] in-process cloud-sync + source-integrity + git-drift loop armed (60s)");
  }
}
