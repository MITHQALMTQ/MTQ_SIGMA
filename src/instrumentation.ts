// MTQΣ — Next.js instrumentation hook.
//
// Runs once per server boot (dev + prod). In the Node runtime it boots the
// in-process MTQΣ Sovereign Devnet reference node (block production, BFT
// consensus engines, SQLite chain store). The Edge runtime is skipped.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureChainNode } = await import("@/lib/chain/node");
    await ensureChainNode();
  } catch (e) {
    // Fail honest: log loudly, keep serving the app WITHOUT the chain —
    // /api/chain routes report ready:false with the error. Never crash the
    // whole web app because the chain layer could not boot.
    console.error("[chain] devnet node FAILED to boot (app continues without chain):", e);
    const g = globalThis as unknown as { __MTQ_CHAIN_ERROR__?: string };
    g.__MTQ_CHAIN_ERROR__ = String(e);
  }
}
