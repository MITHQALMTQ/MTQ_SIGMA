// POST /api/constituency/upload — Task-42 operator-serviced ingestion for the
// SSO-gated official sources (IMF AREAER convertibility; the counsel/history
// desk geopolitical-exposure dimension).
//
// WHY THIS EXISTS: the automated IMF AREAER fetch is SSO-gated from the pilot
// sandbox (verified: elibrary-areaer redirects to login) — the honest standard
// remediation for a gated official source is an OPERATOR UPLOAD path: an
// authorized operator transcribes values from the official source, each record
// digest-bound (sha256 over the canonical payload) with a declared source
// label. feeds.ts reads fresh rows (≤ 90 days) and upgrades the corresponding
// scoring input to LIVE-UPLOADED with the full provenance string — honestly
// distinguished from an automated live feed.
//
// FAIL-CLOSED AUTH: the route requires the X-Upload-Token header to equal
// process.env.MTQ_UPLOAD_TOKEN (non-empty). When the token is not configured
// the route answers 403 "uploads disabled on this host" — an honest outage,
// never an open write surface. This is a TESTNET PILOT operator tool, not a
// production T2 confirmation path (no T2 confirmation is certifiable from
// operator-serviced rows alone — see feeds.ts residualLimits).

import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

const ALLOWED_KINDS = ["convertibility", "geopoliticalExposure"] as const;
type UploadKind = (typeof ALLOWED_KINDS)[number];

const ALLOWED_CCY = ["USD", "EUR", "JPY", "GBP", "CHF", "CNY", "XAU"] as const;

interface UploadEntry {
  ccy: string;
  value: number;
}

/** Canonical digest over the record exactly as persisted (value serialized
 * with full JS number precision so any later re-derivation matches). */
function recordDigest(kind: UploadKind, ccy: string, value: number, sourceLabel: string, uploadedAtIso: string): string {
  const canonical = JSON.stringify({ kind, ccy, value, sourceLabel, uploadedAt: uploadedAtIso });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function POST(req: Request) {
  // Rate limit: operator-write budget (same as chain-submit — 20/min/IP).
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain-submit");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", retryAfter: rl.resetAt },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  // Fail-closed token gate.
  const token = process.env.MTQ_UPLOAD_TOKEN;
  const provided = req.headers.get("x-upload-token") ?? "";
  if (!token || provided !== token) {
    return NextResponse.json(
      {
        error: "Uploads disabled on this host",
        detail: "MTQ_UPLOAD_TOKEN is not configured (or the provided token does not match) — the operator-upload path is fail-closed by design.",
      },
      { status: 403 },
    );
  }

  let body: { kind?: string; entries?: unknown; sourceLabel?: string; sourceUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate kind.
  const kind = String(body.kind ?? "");
  if (!ALLOWED_KINDS.includes(kind as UploadKind)) {
    return NextResponse.json(
      { error: `kind must be one of ${ALLOWED_KINDS.join(" | ")}` },
      { status: 400 },
    );
  }

  // Validate source label (the provenance the dossier will display verbatim).
  const sourceLabel = String(body.sourceLabel ?? "").trim();
  if (sourceLabel.length < 8 || sourceLabel.length > 200) {
    return NextResponse.json(
      { error: "sourceLabel must be 8-200 chars — the operator-declared provenance (e.g. \"IMF AREAER 2025 annual report — Official Restrictions table, EUR row\")" },
      { status: 400 },
    );
  }
  const sourceUrl = body.sourceUrl == null ? null : String(body.sourceUrl).slice(0, 300);

  // Validate entries.
  if (!Array.isArray(body.entries) || body.entries.length === 0 || body.entries.length > ALLOWED_CCY.length) {
    return NextResponse.json(
      { error: `entries must be a non-empty array of at most ${ALLOWED_CCY.length} {ccy, value} rows` },
      { status: 400 },
    );
  }
  const entries: UploadEntry[] = [];
  const seen = new Set<string>();
  for (const raw of body.entries) {
    const e = raw as Partial<UploadEntry>;
    const ccy = String(e?.ccy ?? "").toUpperCase();
    const value = Number(e?.value);
    if (!ALLOWED_CCY.includes(ccy as (typeof ALLOWED_CCY)[number])) {
      return NextResponse.json({ error: `ccy must be one of ${ALLOWED_CCY.join(" · ")}` }, { status: 400 });
    }
    if (seen.has(ccy)) {
      return NextResponse.json({ error: `duplicate ccy row: ${ccy}` }, { status: 400 });
    }
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      return NextResponse.json({ error: `value for ${ccy} must be a finite number in [0, 1]` }, { status: 400 });
    }
    seen.add(ccy);
    entries.push({ ccy, value });
  }

  // Persist with digest-bound provenance (uploadedAt stamped server-side).
  const uploadedAt = new Date();
  const uploadedAtIso = uploadedAt.toISOString();
  const records = entries.map((e) => ({
    kind: kind as UploadKind,
    ccy: e.ccy,
    value: e.value,
    sourceLabel,
    sourceUrl,
    sha256: recordDigest(kind as UploadKind, e.ccy, e.value, sourceLabel, uploadedAtIso),
    uploadedAt,
  }));

  try {
    await db.scoringUpload.createMany({ data: records });
  } catch (e) {
    console.error("[api/constituency/upload] store error:", e);
    return NextResponse.json({ error: "Internal error persisting uploads" }, { status: 500 });
  }

  // Bust the dossier cache so the next GET rebuilds with the LIVE-UPLOADED
  // rows (fail-soft: a rebuild failure never invalidates the persisted rows).
  try {
    const { buildLiveScoringDossier } = await import("@/lib/mtq/constituency/feeds");
    await buildLiveScoringDossier(true);
  } catch (e) {
    console.error("[api/constituency/upload] dossier cache-bust failed (non-fatal):", e);
  }

  return NextResponse.json(
    {
      ok: true,
      kind,
      sourceLabel,
      count: records.length,
      freshnessWindowDays: 90,
      records: records.map((r) => ({
        ccy: r.ccy,
        value: r.value,
        sha256: r.sha256,
        uploadedAt: uploadedAtIso,
      })),
      note:
        "Operator-serviced ingestion recorded with digest-bound provenance — feeds read these rows (≤90 days) and upgrade the corresponding scoring inputs to LIVE-UPLOADED. This is an operator path for a gated official source, NOT an automated live feed; no T2 confirmation is certifiable from it alone.",
    },
    { status: 201, headers: { "X-RateLimit-Remaining": String(rl.remaining) } },
  );
}
