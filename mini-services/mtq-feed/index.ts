// MTQΣ Live Feed Service — port 3003 (WebSocket only)
//
// Canonical source of truth for the pilot's live market state.
// socket.io path is "/" (required by the Caddy gateway forwarding rule).
// Because engine.io with path "/" consumes all HTTP on this port, this
// service exposes NO REST routes — everything goes over WS events:
//
//   Server → Client (broadcasts):
//     "metrics"  — full MetricsSnapshot, every ~3s and after every trial.
//     "trial"    — { type, result } immediately after a trial is applied.
//
//   Client → Server (with ack):
//     "getSnapshot"  ()            → ack(snapshot)
//     "trial"       ({type,amount,chain}) → ack(TrialResponse)
//
// Next.js API routes talk to this service via a server-side socket.io-client
// (see src/lib/mtq/feed-client.ts). The browser talks to it directly via
// io("/?XTransformPort=3003") for live "metrics" broadcasts.
//
// Honest: VIX & DXY are SIMULATED here as a labelled stochastic walk (no free
// no-key REST feed exists). FX (EUR/GBP/JPY/CNY) and gold are LIVE from free APIs.

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { Server } from "socket.io";
import {
  initReserveState,
  computeSnapshot,
  applyMint,
  applyRedeem,
  evaluateRebalance,
  applyRebalanceTrade,
  updatePegHealth,
  updateBufferState,
  advanceMacro,
  stepMacroSignals,
  type ReserveState,
  type MetricsSnapshot,
  type MintResult,
  type RedeemResult,
} from "../../src/lib/mtq/engine.ts";
import { fetchFxSnapshot, type FxSnapshot } from "../../src/lib/mtq/fx.ts";

const PORT = 3003;

let state: ReserveState | null = null;
let lastFx: FxSnapshot | null = null;
const SIM_TICK_HOURS = 0.25; // each 3s tick simulates ~15 min of macro time

async function bootstrap() {
  const fx0 = await fetchFxSnapshot(true);
  lastFx = fx0;
  state = initReserveState(fx0.XAU_USD);
  const s = computeSnapshot(state, fx0);
  console.log(
    `[mtq-feed] bootstrapped gold=${fx0.XAU_USD.toFixed(2)} gfb=${s.gfbIndex.toFixed(4)} price=${s.mtqPrice.toFixed(4)} rr=${s.reserveRatio.toFixed(3)}`,
  );
}

function snapshot(): MetricsSnapshot {
  if (!state || !lastFx) throw new Error("not ready");
  return computeSnapshot(state, lastFx);
}

async function tick() {
  try {
    if (!state || !lastFx) return;
    lastFx = await fetchFxSnapshot(false);
    const stepped = stepMacroSignals({ vix: lastFx.VIX, dxy: lastFx.DXY });
    lastFx = { ...lastFx, VIX: stepped.vix, DXY: stepped.dxy };
    advanceMacro(state, stepped.vix, stepped.dxy, SIM_TICK_HOURS);
    updatePegHealth(state, SIM_TICK_HOURS, lastFx);
    const snap0 = computeSnapshot(state, lastFx);
    const decision = evaluateRebalance(
      state,
      { nav: snap0.nav, goldNet: snap0.reserve.goldNet, fiatNet: snap0.reserve.fiatNet },
      snap0.reserveRatio,
    );
    if (decision.shouldRebalance) applyRebalanceTrade(state, decision, lastFx.XAU_USD);
    updateBufferState(state, snap0.reserveRatio);
    io.emit("metrics", computeSnapshot(state, lastFx));
  } catch (e) {
    console.error("[mtq-feed] tick error:", e);
  }
}

interface TrialRequest {
  type: "MINT" | "REDEEM";
  amount: number;
  chain: string;
}
interface TrialResponse {
  ok: boolean;
  mint?: MintResult;
  redeem?: RedeemResult;
  snapshot: MetricsSnapshot;
  error?: string;
}

function applyTrial(req: TrialRequest): TrialResponse {
  if (!state || !lastFx) return { ok: false, snapshot: null as never, error: "warming up" } as unknown as TrialResponse;
  const snap = computeSnapshot(state, lastFx);
  if (req.type === "MINT") {
    if (!(req.amount > 0)) return { ok: false, snapshot: snap, error: "Invalid amount" };
    const res = applyMint(state, lastFx, snap.status, req.amount);
    const ns = computeSnapshot(state, lastFx);
    io.emit("metrics", ns);
    io.emit("trial", { type: "MINT", result: res });
    return { ok: res.ok, mint: res, snapshot: ns, error: res.reason };
  } else {
    if (!(req.amount > 0)) return { ok: false, snapshot: snap, error: "Invalid amount" };
    const res = applyRedeem(state, lastFx, snap.status, req.amount);
    const ns = computeSnapshot(state, lastFx);
    io.emit("metrics", ns);
    io.emit("trial", { type: "REDEEM", result: res });
    return { ok: res.ok, redeem: res, snapshot: ns, error: res.reason };
  }
}

const httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
  // socket.io (path "/") handles WS upgrade + engine.io polling. Any other
  // request here is unexpected; respond 404 (engine.io normally intercepts first).
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "ws-only service; connect via socket.io" }));
});

const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  if (state) socket.emit("metrics", snapshot());
  socket.on("getSnapshot", (_: unknown, ack?: (s: MetricsSnapshot) => void) => {
    try {
      if (ack) ack(snapshot());
    } catch {
      /* ignore */
    }
  });
  socket.on("trial", (payload: TrialRequest, ack?: (r: TrialResponse) => void) => {
    const r = applyTrial(payload);
    if (ack) ack(r);
  });
});

bootstrap().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`[mtq-feed] listening on :${PORT} (socket.io path "/")`);
  });
  setInterval(tick, 3000);
});

process.on("SIGTERM", () => httpServer.close(() => process.exit(0)));
process.on("SIGINT", () => httpServer.close(() => process.exit(0)));
