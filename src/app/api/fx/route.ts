import { NextResponse } from "next/server";
import { getFx } from "@/lib/mtq/pilot-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const fx = await getFx();
  return NextResponse.json(fx);
}
