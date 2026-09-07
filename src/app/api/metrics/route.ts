import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/mtq/pilot-state";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const snap = await getSnapshot();
    return NextResponse.json(snap);
  } catch (e) {
    return NextResponse.json(
      { error: "Engine not ready", detail: String(e) },
      { status: 503 },
    );
  }
}
