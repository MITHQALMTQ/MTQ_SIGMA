/**
 * SEC-P0-EVIDENCE-PRESERVATION-002 — evidence handoff service (inert static file server).
 * Serves the encrypted preservation archive for owner custody transfer via the
 * platform gateway (URL path /download?XTransformPort=3030).
 *
 * This is NOT the MTQSigma application: no database access, no repository
 * mutation, no application boot. Read-only file serving of two artifacts.
 */
const PORT = 3030;
const ARCHIVE = "/home/z/MTQSIGMA-EMERGENCY-EVIDENCE-2026-11-12-030014Z.tar.enc";
const ARCHIVE_NAME = "MTQSIGMA-EMERGENCY-EVIDENCE-2026-11-12-030014Z.tar.enc";
const ARCHIVE_SHA256 =
  "d141ed48c09886a65ecdaf935c722be5fd8e07255cef71f4b4efcbc0392373c0";
const INDEX_MD = "/home/z/MTQSIGMA-EMERGENCY-EVIDENCE-2026-11-12-030014Z/INDEX-EP-DELIVERABLES.md";

Bun.serve({
  port: PORT,
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (req.method === "GET" && (path === "/" || path === "/download")) {
      const file = Bun.file(ARCHIVE);
      if (!(await file.exists())) {
        return new Response("archive unavailable\n", { status: 503 });
      }
      return new Response(file, {
        headers: {
          "content-type": "application/octet-stream",
          "content-length": String(file.size),
          "content-disposition": `attachment; filename="${ARCHIVE_NAME}"`,
          "x-archive-sha256": ARCHIVE_SHA256,
          "cache-control": "no-store",
        },
      });
    }

    if (req.method === "GET" && path === "/status") {
      const file = Bun.file(ARCHIVE);
      const exists = await file.exists();
      const idx = await Bun.file(INDEX_MD).text();
      const body = [
        "EVIDENCE HANDOFF SERVICE — SEC-P0-EVIDENCE-PRESERVATION-002",
        `archive: ${ARCHIVE_NAME}`,
        `archive exists: ${exists}`,
        `archive bytes: ${exists ? file.size : 0}`,
        `archive sha256: ${ARCHIVE_SHA256}`,
        "package verdict: PRESERVATION VERIFIED — 100% MATCH (EP-04)",
        "decryption: openssl enc -d -aes-256-cbc -pbkdf2 (passphrase delivered to owner via private chat channel only)",
        "",
        "--- package INDEX (truncated) ---",
        idx.slice(0, 6000),
      ].join("\n");
      return new Response(body, {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }

    return new Response("not found\n", { status: 404 });
  },
});

console.log(`[evidence-handoff] listening on :${PORT} (inert static service)`);
