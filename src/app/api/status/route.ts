import { NextResponse } from "next/server";
import { ALL_CHAINS, CANONICAL_MTQ_ADDRESSES, DEPLOYER_WALLET } from "@/lib/mtq/contracts";
import { getSnapshot } from "@/lib/mtq/pilot-state";
export const dynamic = "force-dynamic";
export async function GET() {
  let snapshot: any = null;
  try { snapshot = await getSnapshot(); } catch {}
  return NextResponse.json({ protocol: "MTQΣ", version: "Σ-v1.2", status: "TESTNET PILOT", deployerWallet: DEPLOYER_WALLET, chains: ALL_CHAINS.map(c => ({ id: c.id, label: c.label, chainId: c.chainId, canonical: CANONICAL_MTQ_ADDRESSES[c.id]?.address })), liveMetrics: snapshot ? { gfbIndex: snapshot.gfbIndex, mtqPrice: snapshot.mtqPrice, nav: snapshot.nav, status: snapshot.status } : null, generatedAt: new Date().toISOString() });
}
