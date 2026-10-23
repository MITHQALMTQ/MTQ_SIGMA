// Task 16-b — mtq-feed (3003) vs /api/metrics (3000) engine DRIFT probe.
// Read-only: connects as a socket.io client, listens for one "metrics"
// broadcast, and in the same instant fetches /api/metrics. Compares values.
import { io } from "socket.io-client";

const socket = io("http://localhost:3003", {
  path: "/",
  transports: ["websocket"],
  reconnection: false,
  timeout: 8000,
});

const feedPromise = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timeout: no metrics broadcast in 15s")), 15000);
  socket.on("connect", () => console.log("[probe] connected to mtq-feed 3003, waiting for metrics broadcast..."));
  socket.on("metrics", (snap) => {
    clearTimeout(timer);
    resolve({ snap, at: Date.now() });
  });
  socket.on("connect_error", (e) => { clearTimeout(timer); reject(e); });
});

try {
  const { snap: feedSnap, at } = await feedPromise;
  console.log("[probe] got mtq-feed broadcast at", new Date(at).toISOString());
  const res = await fetch("http://localhost:3000/api/metrics");
  const apiSnap = await res.json();
  console.log("[probe] fetched /api/metrics at", new Date().toISOString(), "HTTP", res.status);

  const cmp = (label, a, b) => {
    const diff = typeof a === "number" && typeof b === "number" ? a - b : NaN;
    const rel = typeof a === "number" && typeof b === "number" && b !== 0 ? (diff / b) * 100 : NaN;
    console.log(`${label}: feed=${a} api=${b} absDiff=${Number.isFinite(diff) ? diff : "n/a"} relDiff%=${Number.isFinite(rel) ? rel.toFixed(6) : "n/a"}`);
  };
  cmp("nav", feedSnap.nav, apiSnap.nav);
  cmp("mtqPrice", feedSnap.mtqPrice, apiSnap.mtqPrice);
  cmp("gfbIndex", feedSnap.gfbIndex, apiSnap.gfbIndex);
  cmp("reserveRatio", feedSnap.reserveRatio, apiSnap.reserveRatio);
  cmp("circulatingSupply", feedSnap.circulatingSupply, apiSnap.circulatingSupply);
  cmp("totalSupply", feedSnap.totalSupply, apiSnap.totalSupply);
  console.log("feed fetchedAt:", feedSnap.fetchedAt, "api fetchedAt:", apiSnap.fetchedAt);
  console.log("feed fx.source:", feedSnap.fx?.source ?? feedSnap.source ?? "(none)");
  console.log("api  fx.source:", apiSnap.fx?.source ?? apiSnap.source ?? "(none)");
  console.log("feed fx XAU_USD:", feedSnap.fx?.XAU_USD, "api fx XAU_USD:", apiSnap.fx?.XAU_USD);
  console.log("feed reserve.goldNet:", feedSnap.reserve?.goldNet, "api reserve.goldNet:", apiSnap.reserve?.goldNet);
} catch (e) {
  console.error("[probe] FAILED:", e.message ?? e);
} finally {
  socket.disconnect();
  process.exit(0);
}
