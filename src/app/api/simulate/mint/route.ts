import { NextResponse } from "next/server";
import { applyTrial } from "@/lib/mtq/pilot-state";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

// MINT-API-FIX (Task MINT-API-FIX + FULL-UI-AUDIT):
// The V3 engine's `applyMint` returns MintResult with V3 field names
// (`mtqPrice`, `newCirculatingSupply`, `newReserveRatio`). The MintSimulator
// UI already uses these V3 names correctly. But some legacy callers (and the
// verification curl) use V2 names (`price`, `newCirculating`, `newRR`).
// We add the V2 aliases alongside the V3 fields so BOTH work — the V3 fields
// stay authoritative, the V2 aliases are convenience copies that always mirror
// the V3 values. This is a backward-compat shim; the V3 engine is unchanged.

// ============================================================================
// Task 16-fix-A hardening (audit findings 16a-001 / 16a-004 / 16a-009 / 16d-004 / 16e-007):
//   • rate limit — "simulate" bucket, 12 req/IP/min → 429 + Retry-After
//     (previously NO limiter on this route).
//   • body size guard — raw body > 32KB → 413 (previously multi-MB bodies
//     were parsed and the free-text wallet persisted).
//   • invalid/missing JSON → clean 400 {error:"Invalid JSON body"}
//     (previously 500 + SyntaxError leak).
//   • amount bounds — finite, > 0 and ≤ 1,000,000 USD (pilot-only enforced
//     cap; a 1e15 mint previously flipped the live pilot to EMERGENCY).
//   • chain/wallet hygiene — trim, cap length (24/64), control chars → 400.
//     Free text is otherwise kept (this is a pilot).
//   • FAILED engine rejections are now persisted too — a PilotTrial row with
//     ok:false and the engine's rejection reason, so the trial log records
//     refusals honestly instead of only successes (16d-004).
//   The success-path response shape is unchanged.
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

    // AUDIT-FIX EQ-146 (§19.4.1/§19.7): minMTQOut + 5-minute quote deadline
    // passed through to the engine and enforced inside applyMint.
    const minOutMtq = Number.isFinite(Number(b.minOutMtq)) ? Number(b.minOutMtq) : undefined;
    const quoteExpiresAt = Number.isFinite(Number(b.quoteExpiresAt)) ? Number(b.quoteExpiresAt) : undefined;
    const resp = await applyTrial({ type: "MINT", amount, chain, wallet: wallet ?? undefined, minOutMtq, quoteExpiresAt });
    // Add V2 alias fields to the mint sub-object so both V2 and V3 callers work.
    const mint = resp.mint
      ? {
          ...resp.mint,
          // V2 aliases (mirror the authoritative V3 fields):
          price: resp.mint.mtqPrice,
          newCirculating: resp.mint.newCirculatingSupply,
          newRR: resp.mint.newReserveRatio,
        }
      : undefined;
    // Try to log to DB, but don't fail if DB is unavailable.
    // [16d-004] Persist FAILED trials too: when the engine rejects (guard
    // rules / §17.7 oracle gate), a PilotTrial row is still created with
    // ok:false and the engine's rejection reason. Success rows are identical
    // to before; on rejection outputAmount is the engine's post-guard value
    // (0) and reason carries the verbatim engine text.
    try {
      const { db } = await import("@/lib/db");
      if (resp.mint || !resp.ok) {
        await db.pilotTrial.create({
          data: {
            type: "MINT",
            chain,
            inputAmount: amount,
            inputSymbol: "USDC",
            outputAmount: resp.mint?.mtqMinted ?? 0,
            outputSymbol: "MTQ",
            gfbIndex: resp.snapshot.gfbIndex,
            mtqPrice: resp.snapshot.mtqPrice,
            nav: resp.snapshot.nav,
            reserveRatio: resp.snapshot.reserveRatio,
            lcr: resp.snapshot.lcr,
            status: resp.snapshot.status,
            ok: resp.mint ? resp.mint.ok : false,
            reason: resp.mint?.reason ?? resp.error ?? null,
            wallet: wallet ?? null,
          },
        });
      }
    } catch (dbErr) {
      console.error("DB log failed (non-fatal):", (dbErr as Error).message?.slice(0, 80));
    }
    return NextResponse.json(
      { ...resp, mint },
      { headers: { "X-RateLimit-Remaining": String(rl.remaining) } },
    );
  } catch (e) {
    // [16a-004-class] Generic error body — full detail stays server-side.
    console.error("[api/simulate/mint] internal error:", e);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
