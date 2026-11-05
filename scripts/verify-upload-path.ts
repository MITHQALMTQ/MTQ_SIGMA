/**
 * Task-42 verification — operator-upload ingestion path, positive leg.
 *
 * The HTTP token gate (fail-closed 403 without MTQ_UPLOAD_TOKEN) is verified
 * separately by curl against the live route. This script verifies the REST
 * of the path deterministically against the real Prisma store:
 *   1. insert a TEST ScoringUpload row (convertibility:EUR, provenance-labeled)
 *   2. rebuild the live scoring dossier with force=true
 *   3. assert the EUR convertibility input upgrades to LIVE-UPLOADED with the
 *      digest + source label + upload date rendered in the detail string
 *   4. CLEAN UP the test rows (the pilot store stays pristine)
 *
 * Run: bun run scripts/verify-upload-path.ts   (exit 0 = PASS)
 */
import { db } from "@/lib/db";
import { buildLiveScoringDossier } from "@/lib/mtq/constituency/feeds";
import { createHash } from "node:crypto";

async function main() {
  const uploadedAt = new Date();
  const sha = createHash("sha256")
    .update(JSON.stringify({ kind: "convertibility", ccy: "EUR", value: 0.93, sourceLabel: "VERIFY-SCRIPT IMF AREAER test row", uploadedAt: uploadedAt.toISOString() }))
    .digest("hex");

  console.log("[verify-upload] inserting TEST row (convertibility EUR 0.93)…");
  await db.scoringUpload.create({
    data: {
      kind: "convertibility",
      ccy: "EUR",
      value: 0.93,
      sourceLabel: "VERIFY-SCRIPT IMF AREAER test row",
      sourceUrl: null,
      sha256: sha,
      uploadedAt,
    },
  });

  try {
    console.log("[verify-upload] rebuilding dossier (force)…");
    const dossier = await buildLiveScoringDossier(true);
    const eur = dossier.components.find((c) => c.code === "EUR");
    if (!eur) throw new Error("EUR component missing from dossier");
    const status = eur.inputStatus.convertibility;
    const detail = eur.inputDetail.convertibility;
    const value = eur.inputs.convertibility;
    console.log(`[verify-upload] EUR convertibility → status=${status} value=${value}`);
    console.log(`[verify-upload] detail: ${detail.slice(0, 220)}`);

    if (status !== "LIVE-UPLOADED") throw new Error(`expected LIVE-UPLOADED, got ${status}`);
    if (Math.abs(value - 0.93) > 1e-9) throw new Error(`expected value 0.93, got ${value}`);
    if (!detail.includes(sha.slice(0, 16))) throw new Error("detail does not carry the record digest");
    if (!detail.includes("VERIFY-SCRIPT IMF AREAER test row")) throw new Error("detail does not carry the source label");
    if (!detail.includes(uploadedAt.toISOString().slice(0, 10))) throw new Error("detail does not carry the upload date");
    if (!detail.includes("operator-serviced")) throw new Error("detail does not label the ingestion as operator-serviced");
    // other components must remain honestly fixture-fed (no upload rows for them)
    const usd = dossier.components.find((c) => c.code === "USD");
    if (usd && usd.inputStatus.convertibility !== "FIXTURE-FALLBACK") {
      throw new Error(`USD should stay FIXTURE-FALLBACK, got ${usd.inputStatus.convertibility}`);
    }
    console.log("[verify-upload] PASS — LIVE-UPLOADED upgrade verified with full provenance; untouched components stay honestly labeled");
  } finally {
    // CLEANUP — never leave verification rows in the pilot store
    const del = await db.scoringUpload.deleteMany({ where: { sourceLabel: "VERIFY-SCRIPT IMF AREAER test row" } });
    console.log(`[verify-upload] cleanup: removed ${del.count} test row(s)`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("[verify-upload] FAIL:", e);
  process.exit(1);
});
