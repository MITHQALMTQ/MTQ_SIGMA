import { NextResponse } from "next/server";
import { applyTrial } from "@/lib/mtq/pilot-state";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

// REDEEM-API-FIX (Task MINT-API-FIX + FULL-UI-AUDIT):
// The V3 engine's `applyRedeem` returns RedeemResult with V3 field names
// (`mtqPrice`, `newCirculatingSupply`, `newReserveRatio`). The RedeemSimulator
// UI already uses these V3 names correctly. But some legacy callers expect the
// V2 `price` alias. We add the V2 alias alongside the V3 fields so BOTH work —
// the V3 fields stay authoritative, the V2 alias is a convenience copy that
// always mirrors the V3 value. This is a backward-compat shim; the V3 engine
// is unchanged.

// ============================================================================
// Task 16-fix-A hardening (audit findings 16a-001 / 16a-004 / 16a-009 / 16d-004 / 16e-007):
// identical posture to /api/simulate/mint — rate limit ("simulate" 12/min),
// 32KB body cap, clean 400 on invalid JSON, amount bounds (≤ 1,000,000),
// chain/wallet hygiene, and FAILED engine rejections persisted as PilotTrial
// rows with ok:false + the engine's reason. Success-path response shape is
// unchanged.
// ============================================================================

const MAX_BODY_BYTES = 32 * 1024;
const MAX_AMOUNT_USD = 1_000_000;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

// [16a-009 P3] chain/wallet input hygiene: trim, cap length, reject control
// characters. Returns { invalid: true } for non-string garbage or control
// chars; value is null when the field is absent.
function cleanFreeText(
  raw: unknown,
  maxLen: number,
): { invalid: boolean; value: string | null } {
  if (raw == null) return { invalid: false, value: null };
  if (typeof raw !== "string") return { invalid: true, value: null };
  const trimmed = raw.trim();
  if (CONTROL_CHARS.test(trimmed)) return { invalid: true, value: null };
  return { invalid: false, value: trimmed.slice(0, maxLen) };
}

export async function POST(req: Request) {
  try {
    // [16a-001d] Per-IP rate limit BEFORE any parsing cost.
    const rl = await rateLimit(getClientIP(req), "simulate");
    if (!rl.allowed) {
      return NextResponse.json(
        { ok: false, error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)),
            ),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    // [16e-007/16a-001c] Body size guard — 32KB cap.
    const declaredLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Request body too large" },
        { status: 413 },
      );
    }
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, error: "Request body too large" },
        { status: 413 },
      );
    }

    // [16a-004] Invalid/missing JSON → clean 400 (was 500 + SyntaxError leak).
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;

    // [16a-001b] Amount bounds: reject <= 0, non-finite, > 1,000,000.
    const amount = Number(b.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT_USD) {
      return NextResponse.json(
        { ok: false, error: "Amount must be between 0 and 1,000,000" },
        { status: 400 },
      );
    }

    // [16a-009 P3] chain/wallet hygiene (chain ≤ 24 chars, wallet ≤ 64).
    const chainClean = cleanFreeText(b.chain, 24);
    if (chainClean.invalid) {
      return NextResponse.json({ ok: false, error: "Invalid chain" }, { status: 400 });
    }
    const chain = chainClean.value ?? "monad";
    const walletClean = cleanFreeText(b.wallet, 64);
    if (walletClean.invalid) {
      return NextResponse.json({ ok: false, error: "Invalid wallet" }, { status: 400 });
    }
    const wallet = walletClean.value;

    // AUDIT-FIX EQ-147 (§19.4.2/§19.7): declared minAssetOut + 5-minute quote
    // deadline passed through to the engine and enforced inside applyRedeem.
    const minOutUsd = Number.isFinite(Number(b.minOutUsd)) ? Number(b.minOutUsd) : undefined;
    const quoteExpiresAt = Number.isFinite(Number(b.quoteExpiresAt)) ? Number(b.quoteExpiresAt) : undefined;
    const resp = await applyTrial({ type: "REDEEM", amount, chain, wallet: wallet ?? undefined, minOutUsd, quoteExpiresAt });
    // Add V2 alias fields to the redeem sub-object so both V2 and V3 callers work.
    const redeem = resp.redeem
      ? {
          ...resp.redeem,
          // V2 aliases (mirror the authoritative V3 fields):
          price: resp.redeem.mtqPrice,
          newCirculating: resp.redeem.newCirculatingSupply,
          newRR: resp.redeem.newReserveRatio,
        }
      : undefined;
    // [16d-004] Persist FAILED trials too (see mint route note) — engine
    // rejections create a PilotTrial row with ok:false + the engine's reason.
    try {
      const { db } = await import("@/lib/db");
      if (resp.redeem || !resp.ok) {
        await db.pilotTrial.create({
          data: {
            type: "REDEEM",
            chain,
            inputAmount: amount,
            inputSymbol: "MTQ",
            outputAmount: resp.redeem?.netUsd ?? 0,
            outputSymbol: "BASKET",
            gfbIndex: resp.snapshot.gfbIndex,
            mtqPrice: resp.snapshot.mtqPrice,
            nav: resp.snapshot.nav,
            reserveRatio: resp.snapshot.reserveRatio,
            lcr: resp.snapshot.lcr,
            status: resp.snapshot.status,
            basketJson: resp.redeem ? JSON.stringify(resp.redeem.basket) : null,
            ok: resp.redeem ? resp.redeem.ok : false,
            reason: resp.redeem?.reason ?? resp.error ?? null,
            wallet: wallet ?? null,
          },
        });
      }
    } catch (dbErr) {
      console.error("DB log failed (non-fatal):", (dbErr as Error).message?.slice(0, 80));
    }
    return NextResponse.json(
      { ...resp, redeem },
      { headers: { "X-RateLimit-Remaining": String(rl.remaining) } },
    );
  } catch (e) {
    // [16a-004-class] Generic error body — full detail stays server-side.
    console.error("[api/simulate/redeem] internal error:", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
