// GET /api/chain/stream — Task-42 SSE live block-event push.
//
// Closes the documented "no WS push (polling only)" residual in the only way
// this in-process reference topology supports: a Server-Sent-Events stream
// fed directly by the node's block-committed listeners (subscribeChainEvents).
// No external message broker, no extra process (the sandbox reaps detached
// processes — NDD-1 §2), no WebSocket upgrade through the gateway. Consumers
// (NOC + Explorer) keep their canonical HTTP polling as a FALLBACK — SSE here
// is best-effort instant refresh, not a correctness dependency.
//
// Stream shape (text/event-stream):
//   event: hello  { chain_id, height, transport: "sse" }   — on connect
//   event: block  { height, hash, txs, proposer, qc_committed_power,
//                   qc_total_power, consensus_ms, time_ms } — per block
//   ": hb" comment every 15s (keep-alive)
//
// Lifecycle discipline: aborts (client close/tab) clean up the subscription
// via req.signal; a 10-minute self-close bounds zombie streams (EventSource
// auto-reconnects); MAX_STREAMS=20 concurrent streams per server process caps
// resource use — beyond the cap the route answers 503 (honest overload, the
// consumer falls back to polling). Enqueue failures after close are swallowed
// idempotently.

import { chainNode, subscribeChainEvents } from "@/lib/chain/node";
import * as store from "@/lib/chain/store";
import { CHAIN_ID } from "@/lib/chain/shared";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";

export const dynamic = "force-dynamic";

const MAX_STREAMS = 20;
const HB_MS = 15_000;
const SELF_CLOSE_MS = 10 * 60_000;
// Module-level concurrent-stream guard (per server process; HMR-safe enough —
// a stale module instance's decrements still run through the same closure).
let liveStreams = 0;

export async function GET(req: Request) {
  // Rate limit: reads bucket (same as other chain GETs).
  const ip = getClientIP(req);
  const rl = await rateLimit(ip, "chain");
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded", retryAfter: rl.resetAt }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  if (liveStreams >= MAX_STREAMS) {
    return new Response(
      JSON.stringify({ error: "Stream capacity reached — fall back to polling (honest overload)" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // Boots the node if needed (same lazy behavior as every other chain route).
  await chainNode();
  const startHeight = await store.getHeight();

  const encoder = new TextEncoder();
  let closed = false;
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let selfClose: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      liveStreams++;
      const write = (chunk: string): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          // enqueue after close — treat as closed
          closed = true;
          return false;
        }
      };
      const send = (event: string, data: unknown) => {
        write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      send("hello", { chain_id: CHAIN_ID, height: startHeight, transport: "sse" });

      // Subscribe to block-committed events (async — enqueued after readiness).
      void subscribeChainEvents((ev) => {
        send("block", ev);
      }).then(
        (unsub) => {
          if (closed) {
            try { unsub(); } catch { /* already gone */ }
          } else {
            unsubscribe = unsub;
          }
        },
        (err) => {
          // Subscription failed (node boot error) — end the stream honestly;
          // the consumer's polling fallback keeps it truthful.
          console.error("[api/chain/stream] subscribe failed:", err);
          cleanup();
        },
      );

      heartbeat = setInterval(() => {
        if (!write(": hb\n\n")) cleanup();
      }, HB_MS);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (selfClose) clearTimeout(selfClose);
        try { unsubscribe?.(); } catch { /* best-effort */ }
        try { controller.close(); } catch { /* already closed */ }
        liveStreams = Math.max(0, liveStreams - 1);
      };

      // Client disconnect (tab close, EventSource recycle) → cleanup.
      req.signal.addEventListener("abort", cleanup);
      // Bounded stream lifetime — EventSource reconnects automatically.
      selfClose = setTimeout(cleanup, SELF_CLOSE_MS);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (selfClose) clearTimeout(selfClose);
      try { unsubscribe?.(); } catch { /* best-effort */ }
      liveStreams = Math.max(0, liveStreams - 1);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // proxies: do not buffer the event stream
      "X-RateLimit-Remaining": String(rl.remaining),
    },
  });
}
