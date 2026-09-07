import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);
    const trials = await db.pilotTrial.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ trials });
  } catch (e: any) {
    // If DB is not available (e.g., Turso not configured), return empty trials
    console.error("trials route error:", e?.message?.slice(0, 100));
    return NextResponse.json({ trials: [], error: "Database not available on this deployment" });
  }
}
