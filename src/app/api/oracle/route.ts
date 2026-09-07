import { NextResponse } from "next/server";
import { getOracle } from "@/lib/mtq/pilot-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const oracle = await getOracle();
  return NextResponse.json(oracle);
}
