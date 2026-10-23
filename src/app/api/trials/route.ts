import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // [16a-008 fix, Task 16-fix-A] Strict limit parsing. Previously
  // `Math.min(Number(param ?? "50"), 200)` let NaN (limit=abc), negatives and
  // garbage flow into Prisma `take`, which threw and was misreported as
  // "Database not available" while the DB was healthy. Non-integer/garbage
  // limits are now a clean 400; integer limits are clamped to 1..500.
  const url = new URL(req.url);
  const rawLimit = url.searchParams.get("limit") ?? "50";
  const parsed = Number(rawLimit);
  if (!Number.isInteger(parsed)) {
    return NextResponse.json({ error: "limit must be an integer 1-500" }, { status: 400 });
  }
  const limit = Math.min(500, Math.max(1, parsed));
  try {
    const trials = await db.pilotTrial.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ trials });
  } catch (e: any) {
    // Reached ONLY on a real DB failure now — validation errors can no
    // longer land here (they 400 above before the DB call).
    console.error("trials route error:", e?.message?.slice(0, 100));
    return NextResponse.json({ trials: [], error: "Database not available" });
  }
}
