import { NextResponse } from "next/server";
import { getRegistry } from "@/lib/mtq/pilot-state";
import { ELIGIBILITY_CRITERIA, computeConcentration } from "@/lib/mtq/registry";
import { getSnapshot } from "@/lib/mtq/pilot-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const registry = await getRegistry();
  const snap = await getSnapshot();
  const concentration = snap.concentration;
  return NextResponse.json({
    criteria: ELIGIBILITY_CRITERIA,
    assets: registry,
    concentration,
  });
}
