import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/mtq/pilot-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  try {
    const snap = await getSnapshot();
    return NextResponse.json(snap, { headers: PRIVATE_RESPONSE_HEADERS });
  } catch (error) {
    // Keep operational details in server-side logs without returning exception
    // messages, database details, or provider metadata to public callers.
    console.error("[api/metrics] snapshot unavailable", {
      errorType: error instanceof Error ? error.name : typeof error,
    });

    return NextResponse.json(
      { error: "Engine not ready" },
      { status: 503, headers: PRIVATE_RESPONSE_HEADERS },
    );
  }
}
