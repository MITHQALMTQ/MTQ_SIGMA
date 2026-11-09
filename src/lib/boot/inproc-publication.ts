// MTQΣ — In-process threshold publication helper (V31 TURN 2A — incident 19
// root-cause fix, Phase 5).
//
// Extracted from src/instrumentation.ts deliberately: Next.js compiles the
// instrumentation entry for BOTH the Node and Edge runtimes, and DIRECT
// node:-builtin imports inside instrumentation.ts break the Edge build
// ("A Node.js module is loaded … not supported in the Edge Runtime" —
// observed live 2026-11-09T03:12Z). The established pattern in this codebase
// is to dynamic-import an app module that owns its node builtins (exactly
// like `await import("@/lib/db-ops")` below the same tick) — this module is
// that owner for the publication spawn.
//
// WHAT IT DOES: when the STAGED write-behind dump is ≥ PUBLISH_CHAIN_DELTA
// blocks (or ≥ PUBLISH_CUSTOM_DELTA rows) past the PUBLISHED one, spawn the
// validated publisher ONCE (scripts/snapshot-publish.ts --threshold).
// Fire-and-forget — the server tick never blocks on git, and the publisher
// itself classifies the git state first and never publishes from an
// unadjudicated tree (see scripts/snapshot-publish.ts).

import { execFile } from "node:child_process";
import { join, resolve } from "node:path";

export async function maybePublishThreshold(): Promise<void> {
  const { publicationDue } = await import("@/lib/boot/snapshot-manifest");
  const due = publicationDue();
  if (!due.due) return;
  console.log(`[cloud-sync:inproc] publication threshold: ${due.detail}`);
  const root = process.env.MTQ_SIGMA_ROOT ?? resolve(process.cwd());
  await new Promise<void>((res) => {
    execFile(
      "bun",
      ["run", join(root, "scripts", "snapshot-publish.ts"), "--threshold"],
      { cwd: root, timeout: 120_000 },
      (err, stdout) => {
        if (err) console.error(`[cloud-sync:inproc] threshold publisher exited: ${String(err).split("\n")[0]}`);
        const line = String(stdout).trim().split("\n").pop() ?? "";
        if (line) console.log(`[cloud-sync:inproc] threshold publisher: ${line}`);
        res();
      },
    );
  });
}
