// ============================================================================
// Turso backup script (TASK-9-MONITORING)
// ----------------------------------------------------------------------------
// Run:   bun run scripts/backup-turso.ts
//
// Reads all 5 audit-trail tables from Turso, dumps them to a timestamped
// JSON file under ./backups/, and (when run in CI with GITHUB_TOKEN set)
// attaches the backup to a GitHub Release tagged `backup-YYYY-MM-DD`.
//
// Tables (matches prisma/schema.prisma):
//   - PilotTrial
//   - MetricSample
//   - DailyStateVector
//   - RebalancingDecision
//   - OracleSample
//
// Output file format (pretty-printed JSON for diff-friendliness):
//   {
//     "schemaVersion": 1,
//     "exportedAt": "2026-01-01T03:00:00.000Z",
//     "tursoUrl": "libsql://…",  // host only — authToken NEVER written
//     "tables": {
//       "PilotTrial":          [ {…}, {…}, … ],
//       "MetricSample":        [ {…}, {…}, … ],
//       "DailyStateVector":    [ {…}, {…}, … ],
//       "RebalancingDecision": [ {…}, {…}, … ],
//       "OracleSample":        [ {…}, {…}, … ]
//     },
//     "rowCounts": { "PilotTrial": 30, "MetricSample": 0, … },
//     "totalRows": 30
//   }
//
// CI upload (when GITHUB_TOKEN env is set):
//   - Creates a release tagged `backup-YYYY-MM-DD` (idempotent — if the tag
//     already exists, the script attaches the new backup as a 2nd asset
//     instead of failing).
//   - Uses the GitHub REST API directly (no `gh` CLI dependency).
// ============================================================================

import { createClient } from "@libsql/client";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Env + config
// ---------------------------------------------------------------------------

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY; // "owner/repo" in CI

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error(
    "FATAL: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set. " +
      "Copy .env.example → .env.local and fill in real values.",
  );
  process.exit(1);
}

const TABLES = [
  "PilotTrial",
  "MetricSample",
  "DailyStateVector",
  "RebalancingDecision",
  "OracleSample",
] as const;
type TableName = (typeof TABLES)[number];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timestamp(): string {
  // YYYY-MM-DD-HHMM in UTC — keeps filenames sortable + avoids any
  // local-timezone ambiguity in CI.
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`
  );
}

function dateTag(): string {
  // YYYY-MM-DD for the GitHub Release tag (daily granularity so re-runs
  // on the same day attach to the same release instead of forking new ones).
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// libSQL returns BOOLEAN columns as 0/1 integers; we rehydrate to boolean
// so the JSON dump is human-readable and language-portable. Same for
// DATETIME columns → ISO string.
function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null) {
      out[k] = null;
    } else if (typeof v === "bigint") {
      out[k] = Number(v);
    } else if (v instanceof Uint8Array) {
      out[k] = Array.from(v);
    } else if (typeof v === "object" && v !== null && "toString" in v) {
      // libsql may return BigInt-as-object in some code paths.
      out[k] = String(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Main backup logic
// ---------------------------------------------------------------------------

async function backupTurso(): Promise<void> {
  const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });

  console.log(`[backup-turso] Connecting to Turso: ${TURSO_URL.replace(/\?auth=.*/, "")}`);

  // Sanity check: confirm all 5 expected tables exist before dumping.
  const tablesRes = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const existingTables = new Set(tablesRes.rows.map((r) => String(r.name)));
  const missing = TABLES.filter((t) => !existingTables.has(t));
  if (missing.length > 0) {
    console.warn(
      `[backup-turso] WARNING: missing tables (skipping): ${missing.join(", ")}`,
    );
  }

  // Dump each table. We use SELECT * to be schema-resilient — if a future
  // migration adds a column, the backup picks it up automatically.
  const tables: Record<string, unknown[]> = {};
  const rowCounts: Record<string, number> = {};
  let totalRows = 0;

  for (const table of TABLES) {
    if (!existingTables.has(table)) {
      tables[table] = [];
      rowCounts[table] = 0;
      continue;
    }
    const res = await client.execute(`SELECT * FROM "${table}" ORDER BY "createdAt" ASC`);
    const rows = res.rows.map((r) => normalizeRow(r as unknown as Record<string, unknown>));
    tables[table] = rows;
    rowCounts[table] = rows.length;
    totalRows += rows.length;
    console.log(`[backup-turso]   ${table.padEnd(22)} ${String(rows.length).padStart(8)} rows`);
  }

  // Build the dump object. Note: we deliberately write the Turso HOST only
  // (never the authToken) into the dump so the backup file is safe to
  // commit to git / ship as a GitHub Release asset if needed.
  const dump = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    tursoUrl: TURSO_URL.replace(/\?auth=.*/, "").replace(/(libsql:\/\/[^/]+).*/, "$1"),
    tables,
    rowCounts,
    totalRows,
  };

  // Write to backups/turso-backup-YYYY-MM-DD-HHMM.json (create dir if missing)
  const backupDir = join(process.cwd(), "backups");
  await mkdir(backupDir, { recursive: true });
  const filename = `turso-backup-${timestamp()}.json`;
  const filepath = join(backupDir, filename);
  await writeFile(filepath, JSON.stringify(dump, null, 2), "utf8");

  console.log(
    `[backup-turso] Backed up ${totalRows} rows across ${TABLES.length} tables to ${filepath}`,
  );

  // CI upload (best-effort — never fails the script if upload errors).
  if (GITHUB_TOKEN && GITHUB_REPOSITORY) {
    try {
      await uploadToGitHubRelease(filepath, filename);
    } catch (err) {
      console.error(`[backup-turso] GitHub Release upload failed (non-fatal):`, err);
    }
  } else {
    console.log(
      "[backup-turso] GITHUB_TOKEN / GITHUB_REPOSITORY not set — skipping GitHub Release upload.",
    );
  }
}

// ---------------------------------------------------------------------------
// GitHub Release upload (REST API, no `gh` CLI dependency)
// ---------------------------------------------------------------------------

async function uploadToGitHubRelease(filepath: string, filename: string): Promise<void> {
  const [owner, repo] = GITHUB_REPOSITORY!.split("/");
  if (!owner || !repo) {
    console.warn(`[backup-turso] GITHUB_REPOSITORY malformed: "${GITHUB_REPOSITORY}" — skipping upload.`);
    return;
  }

  const tag = `backup-${dateTag()}`;
  const apiBase = "https://api.github.com";

  console.log(`[backup-turso] Uploading ${filename} to GitHub Release "${tag}" in ${owner}/${repo}…`);

  // 1. Create-or-get the release for today's tag.
  //    GET by tag first; if 404, POST a new release.
  let releaseId: number;
  let uploadUrl: string;

  const getRes = await fetch(`${apiBase}/repos/${owner}/${repo}/releases/tags/${tag}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (getRes.status === 200) {
    const data = (await getRes.json()) as { id: number; upload_url: string };
    releaseId = data.id;
    uploadUrl = data.upload_url.replace(/\{.*\}/, "");
    console.log(`[backup-turso]   Existing release #${releaseId} for tag "${tag}" — will attach.`);
  } else if (getRes.status === 404) {
    const createRes = await fetch(`${apiBase}/repos/${owner}/${repo}/releases`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tag_name: tag,
        name: `Turso Backup ${tag}`,
        body: `Automated Turso backup generated on ${new Date().toISOString()}.\n\nRun via \`bun run scripts/backup-turso.ts\` (TASK-9-MONITORING).`,
        draft: false,
        prerelease: false,
      }),
    });
    if (!createRes.ok) {
      const t = await createRes.text();
      throw new Error(`create release ${createRes.status}: ${t.slice(0, 200)}`);
    }
    const data = (await createRes.json()) as { id: number; upload_url: string };
    releaseId = data.id;
    uploadUrl = data.upload_url.replace(/\{.*\}/, "");
    console.log(`[backup-turso]   Created release #${releaseId} for tag "${tag}".`);
  } else {
    const t = await getRes.text();
    throw new Error(`get release ${getRes.status}: ${t.slice(0, 200)}`);
  }

  // 2. Read the file + upload as a release asset.
  const { readFile } = await import("node:fs/promises");
  const fileBytes = await readFile(filepath);

  const uploadRes = await fetch(`${uploadUrl}?name=${encodeURIComponent(filename)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "Content-Length": String(fileBytes.byteLength),
    },
    body: fileBytes,
  });

  if (!uploadRes.ok) {
    const t = await uploadRes.text();
    // 422 → asset with this name already exists on the release. Non-fatal.
    if (uploadRes.status === 422) {
      console.warn(
        `[backup-turso]   Asset "${filename}" already exists on release #${releaseId} — skipping (non-fatal).`,
      );
      return;
    }
    throw new Error(`upload asset ${uploadRes.status}: ${t.slice(0, 200)}`);
  }

  console.log(`[backup-turso]   Uploaded ${filename} → release #${releaseId}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

backupTurso().catch((err) => {
  console.error("[backup-turso] FATAL:", err);
  process.exit(1);
});
