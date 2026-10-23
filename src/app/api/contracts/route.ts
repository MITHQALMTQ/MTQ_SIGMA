import { NextResponse } from "next/server";
import { ALL_CHAINS, DEPLOYER_WALLET } from "@/lib/mtq/contracts";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ deployer: DEPLOYER_WALLET, chains: ALL_CHAINS });
}
