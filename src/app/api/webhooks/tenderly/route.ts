// ============================================================================
// Tenderly webhook receiver (TASK-9-MONITORING)
// ----------------------------------------------------------------------------
// POST /api/webhooks/tenderly
//
// Tenderly sends alerts here when a monitored contract emits events that
// match a configured Alert (Mint, Redeem, Liquidation, Pause, etc.). Each
// request includes a HMAC-SHA256 signature in the `X-Tenderly-Webhook-Signature`
// header that we verify against `TENDERLY_WEBHOOK_SECRET`.
//
// On a valid alert:
//   1. Parse the alert (which contract, which event, which args).
//   2. Forward a human-readable message to Discord (if DISCORD_WEBHOOK_URL
//      is set). When Discord is not configured, alerts are silently
//      accepted — Tenderly requires 200 ACK to stop retrying.
//   3. Return 200 OK.
//
// On an invalid signature: return 401 (and do NOT forward — a forged alert
// could otherwise spam the Discord channel or, worse, be used as a social-
// engineering vector to trigger a false emergency pause).
//
// This route uses ONLY the Web Crypto API (SubtleCrypto) — no Node.js
// `crypto` module — so it runs identically on Vercel Edge and Node runtimes.
// ============================================================================

import { NextResponse } from "next/server";

// Force Node.js runtime (we use crypto.subtle which is available on both, but
// Node runtime avoids Edge function size limits if we later add Prisma writes
// for an audit trail of received alerts).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// HMAC verification (Web Crypto API — works on Edge + Node)
// ---------------------------------------------------------------------------

async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<boolean> {
  if (!signatureHeader) return false;
  // Tenderly sends the signature as a hex-encoded HMAC-SHA256 digest.
  // Some integrations prefix with "sha256=" — we accept both forms.
  const expected = signatureHeader.replace(/^sha256=/, "").trim().toLowerCase();
  if (!expected || expected.length !== 64) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  const got = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time-ish compare (length is fixed at 64 chars for SHA-256 hex).
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Alert parsing
// ---------------------------------------------------------------------------

type TenderlyAlert = {
  alert_id?: string;
  alert_name?: string;
  alert_type?: string;
  chain_id?: number | string;
  network_name?: string;
  block_number?: number;
  tx_hash?: string;
  timestamp?: string;
  contract_address?: string;
  contract_name?: string;
  event_name?: string;
  log_index?: number;
  // Tenderly includes the decoded log args under either `data` or `args`.
  // We surface both as `any` because Tenderly's schema is per-alert.
  data?: any;
  args?: any;
  // Some payloads wrap the alert inside a top-level `alert` object.
  alert?: TenderlyAlert;
};

// Map raw alert → short human-readable summary + severity (for Discord color).
function summarizeAlert(raw: TenderlyAlert): {
  title: string;
  severity: "info" | "warn" | "error";
  fields: { name: string; value: string }[];
} {
  const a: TenderlyAlert = raw.alert ?? raw;
  const eventName = (a.event_name ?? "UnknownEvent").toString();
  const contract = (a.contract_name ?? a.contract_address ?? "0x?").toString();
  const chain = (a.network_name ?? a.chain_id ?? "?").toString();
  const txHash = (a.tx_hash ?? "").toString();
  const block = a.block_number != null ? String(a.block_number) : "?";
  const alertName = (a.alert_name ?? eventName).toString();

  // Map known event names to severities — Pause / Liquidation are CRITICAL.
  const lowerEvent = eventName.toLowerCase();
  let severity: "info" | "warn" | "error" = "info";
  if (lowerEvent.includes("pause") || lowerEvent.includes("liquidation")) {
    severity = "error";
  } else if (
    lowerEvent.includes("mint") ||
    lowerEvent.includes("redeem") ||
    lowerEvent.includes("burn")
  ) {
    severity = "warn";
  }

  return {
    title: `🚨 Tenderly Alert: ${alertName}`,
    severity,
    fields: [
      { name: "Event", value: `\`${eventName}\`` },
      { name: "Contract", value: `\`${contract}\`` },
      { name: "Chain", value: `\`${chain}\`` },
      { name: "Block", value: `\`${block}\`` },
      ...(txHash
        ? [{ name: "Tx", value: `[${txHash.slice(0, 10)}…](https://etherscan.io/tx/${txHash})` }]
        : []),
    ],
  };
}

// ---------------------------------------------------------------------------
// Discord forwarder
// ---------------------------------------------------------------------------

async function forwardToDiscord(
  webhookUrl: string,
  summary: ReturnType<typeof summarizeAlert>,
  rawBody: string,
): Promise<void> {
  // Discord color codes: red=0xED4245, orange=0xFEE75C, blue=0x5865F2
  const color =
    summary.severity === "error" ? 0xed4245 : summary.severity === "warn" ? 0xfee75c : 0x5865f2;

  const payload = {
    username: "MTQΣ Tenderly Monitor",
    embeds: [
      {
        title: summary.title,
        color,
        fields: summary.fields,
        footer: { text: `MTQΣ Pilot Command Center · ${new Date().toISOString()}` },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    // Discord 4xx (rate limit, malformed webhook) — log to stderr but don't
    // fail the webhook (Tenderly would otherwise retry forever).
    const text = await res.text().catch(() => "");
    console.error(
      `[tenderly-webhook] Discord forward failed: ${res.status} ${res.statusText} — ${text.slice(0, 200)}`,
    );
  }
  // Reference rawBody to avoid unused-var lint (kept for future raw-payload
  // audit log).
  void rawBody;
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.TENDERLY_WEBHOOK_SECRET;
  const discordUrl = process.env.DISCORD_WEBHOOK_URL;

  // If the secret isn't configured, refuse ALL webhooks — otherwise anyone
  // could POST arbitrary alert payloads and trigger false alarms.
  if (!secret || secret.length === 0) {
    return NextResponse.json(
      { error: "TENDERLY_WEBHOOK_SECRET not configured" },
      { status: 503 }, // 503 Service Unavailable — config issue, not client error
    );
  }

  // Read the raw body BEFORE parsing — HMAC must be computed on the raw bytes.
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-tenderly-webhook-signature");

  const ok = await verifySignature(rawBody, signatureHeader, secret);
  if (!ok) {
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  // Parse the alert. If the body isn't valid JSON, log + ACK (Tenderly will
  // not retry) — a malformed payload is more likely a Tenderly bug than an
  // attack (we already verified the HMAC, so it IS from Tenderly).
  let alert: TenderlyAlert;
  try {
    alert = JSON.parse(rawBody);
  } catch (err) {
    console.error("[tenderly-webhook] Invalid JSON payload:", err);
    return NextResponse.json({ ok: true, warning: "invalid-json" });
  }

  // Build a summary + optionally forward to Discord.
  const summary = summarizeAlert(alert);
  console.log(
    `[tenderly-webhook] Received alert: ${summary.title} (severity=${summary.severity})`,
  );

  if (discordUrl && discordUrl.length > 0) {
    try {
      await forwardToDiscord(discordUrl, summary, rawBody);
    } catch (err) {
      // Network errors shouldn't fail the webhook — Tenderly would retry.
      console.error("[tenderly-webhook] Discord forward threw:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

// GET — useful for uptime probes (Tenderly itself doesn't GET this route,
// but UptimeRobot/BetterStack can ping it to confirm the receiver is alive).
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    route: "/api/webhooks/tenderly",
    method: "POST",
    auth: "HMAC-SHA256 via X-Tenderly-Webhook-Signature",
    forward: process.env.DISCORD_WEBHOOK_URL ? "discord-enabled" : "discord-disabled",
  });
}
