// MTQΣ — Risk Signals (Groq llama-3.3-70b-versatile).
//
// Server-side only. Generates 2-5 fast risk signals from the live snapshot
// using Groq's ultra-low-latency inference. Risk signals are ADVISORY ONLY
// — they never write to engine state and never trigger rebalance. The engine
// math (src/lib/mtq/engine.ts) is always the source of truth.
//
// Caching: 15s in-memory cache (risk signals need freshness but not every poll).
//
// Graceful fallback: rule-based signals derived directly from the snapshot —
// the pilot stays fully functional even when Groq is down.

import { getKeys, hasKey } from "./keys";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

const MODEL = GROQ_MODEL;
const FALLBACK_MODEL = "fallback-rules";
const CACHE_MS = 15_000;

const ALLOWED_SEVERITIES = ["critical", "warning", "info"] as const;
type Severity = (typeof ALLOWED_SEVERITIES)[number];

export interface RiskSignal {
  severity: Severity | string;
  title: string;
  detail: string;
  source: string;
}

export interface RiskSignalsResult {
  signals: RiskSignal[];
  generatedAt: number;
  model: string;
}

interface Cached {
  signals: RiskSignal[];
  at: number;
}
let cached: Cached | null = null;

function r(n: number, d = 4): number {
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

/** The eject stage is a per-currency object; return the max (0 = inactive). */
function maxEjectStage(snap: MetricsSnapshot): number {
  if (!snap.ejectStage) return 0;
  const vals = Object.values(snap.ejectStage).filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  return vals.length ? Math.max(...vals) : 0;
}

/** Compact JSON summary of the live snapshot — same shape as policy-briefer. */
function buildSnapshotSummary(snap: MetricsSnapshot): string {
  const top = snap.concentration && snap.concentration.length > 0 ? snap.concentration[0] : null;
  return JSON.stringify({
    gfbIndex: r(snap.gfbIndex, 4),
    mtqPrice: r(snap.mtqPrice, 4),
    status: snap.status,
    reserveRatio: Number.isFinite(snap.reserveRatio) ? r(snap.reserveRatio, 4) : null,
    lcr: Number.isFinite(snap.lcr) ? r(snap.lcr, 4) : null,
    bufferState: snap.bufferState,
    observedGoldWeight: r(snap.observedGoldWeight, 4),
    targetGoldWeight: r(snap.targetGoldWeight, 4),
    macro: {
      vix: r(snap.macro.vix, 2),
      dxy: r(snap.macro.dxy, 2),
    },
    rebalance: {
      shouldRebalance: snap.rebalance.shouldRebalance,
      direction: snap.rebalance.direction,
      deviation: r(snap.rebalance.deviation, 4),
      reason: snap.rebalance.reason,
    },
    oraclePaused: snap.oraclePaused,
    concentration: top
      ? {
          topIssuer: top.issuer,
          sharePct: r(top.sharePct * 100, 2),
          status: top.status,
        }
      : null,
    ejectStage: { perCurrency: snap.ejectStage, max: maxEjectStage(snap) },
  });
}

function buildPrompt(snap: MetricsSnapshot): string {
  const summary = buildSnapshotSummary(snap);
  return [
    "You are a real-time risk monitor for the MTQΣ protocol. Given this live snapshot, output 2-5 risk signals as a JSON array. Each signal MUST be an object with shape: {severity: 'critical'|'warning'|'info', title: string, detail: string, source: string}. Only emit signals for genuine risks (don't pad). If everything is normal, emit one 'info' signal saying so.",
    "",
    "Snapshot:",
    summary,
    "",
    "Risk areas to consider: oracle consensus (paused/ok), issuer concentration (top issuer share vs 25% warn / 30% breach), peg health (mtqPrice vs 1.00 PAR, band 0.50-2.00), buffer state (BASE/STRESS/EMERGENCY), geopolitical eject ladder (stage 0 = inactive), reserve ratio (1.10 target, 1.05 stress floor), reconciliation findings.",
    "",
    "Output ONLY the JSON array — no markdown fences, no prose. The `source` field must be a short string (e.g. '§9 oracle', '§5.6 concentration', '§14.1 buffer').",
  ].join("\n");
}

/** Parse the Groq chat-completion response, handling markdown code fences. */
function parseSignalArray(text: string): RiskSignal[] {
  if (!text) return [];
  let t = text.trim();
  // Strip markdown code fences if present (```json ... ``` or ``` ... ```).
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) t = fence[1].trim();
  // Find the first '[' and last ']' to isolate the JSON array.
  const firstBracket = t.indexOf("[");
  const lastBracket = t.lastIndexOf("]");
  if (firstBracket === -1 || lastBracket === -1 || lastBracket < firstBracket) return [];
  const slice = t.slice(firstBracket, lastBracket + 1);
  let arr: unknown;
  try {
    arr = JSON.parse(slice);
  } catch {
    return [];
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((item) => validateSignal(item as Record<string, unknown>))
    .filter((s): s is RiskSignal => s !== null);
}

function validateSignal(raw: Record<string, unknown>): RiskSignal | null {
  if (!raw || typeof raw !== "object") return null;
  const severity = typeof raw.severity === "string" ? raw.severity.toLowerCase() : "";
  if (!ALLOWED_SEVERITIES.includes(severity as Severity)) return null;
  let title = typeof raw.title === "string" ? raw.title.trim() : "";
  let detail = typeof raw.detail === "string" ? raw.detail.trim() : "";
  const source = typeof raw.source === "string" ? raw.source.trim() : "";
  if (!title) return null;
  if (title.length > 80) title = title.slice(0, 77) + "...";
  if (detail.length > 300) detail = detail.slice(0, 297) + "...";
  return { severity, title, detail, source: source || "engine snapshot" };
}

/** Deterministic rule-based risk signals (used when Groq is unavailable). */
function fallbackSignals(snap: MetricsSnapshot): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const top = snap.concentration && snap.concentration.length > 0 ? snap.concentration[0] : null;
  const rr = Number.isFinite(snap.reserveRatio) ? snap.reserveRatio : Infinity;
  const eject = maxEjectStage(snap);

  if (snap.oraclePaused) {
    signals.push({
      severity: "critical",
      title: "Oracle consensus paused",
      detail:
        "Fewer than 2 valid feeds for at least one FX pair (§9.3). Minting should be suspended until at least 2 feeds recover.",
      source: "§9 oracle",
    });
  }
  if (top) {
    const pct = (top.sharePct * 100).toFixed(2);
    if (top.status === "breach") {
      signals.push({
        severity: "critical",
        title: "Issuer concentration breach",
        detail: `${top.issuer} at ${pct}% of NAV — above the §5.6 30% hard limit. Multi-issuer optimizer must continue splitting.`,
        source: "§5.6 concentration",
      });
    } else if (top.status === "warn") {
      signals.push({
        severity: "warning",
        title: "Issuer concentration warn",
        detail: `${top.issuer} at ${pct}% of NAV — above the 25% warn threshold.`,
        source: "§5.6 concentration",
      });
    }
  }
  if (Number.isFinite(rr) && rr < 1.05) {
    signals.push({
      severity: "critical",
      title: "Reserve ratio below stress floor",
      detail: `RR at ${rr.toFixed(4)} — below the 1.05 stress floor (§14.2). Hard solvency floor is 1.00.`,
      source: "§14.2 reserve",
    });
  }
  if (eject > 0) {
    signals.push({
      severity: "warning",
      title: "Geopolitical eject active",
      detail: `Eject ladder at stage ${eject} (§11). Staged gold sell-off in progress.`,
      source: "§11 eject",
    });
  }
  if (snap.status !== "NORMAL") {
    signals.push({
      severity: "warning",
      title: "Protocol status degraded",
      detail: `Status is ${snap.status} (NORMAL is the only fully-healthy state).`,
      source: "§14.1 status",
    });
  }
  if (signals.length === 0) {
    const rrStr = Number.isFinite(rr) ? rr.toFixed(4) : "n/a";
    signals.push({
      severity: "info",
      title: "All systems normal",
      detail: `GFB ${snap.gfbIndex.toFixed(4)}, RR ${rrStr}, status ${snap.status}. No active risk signals.`,
      source: "engine snapshot",
    });
  }
  return signals;
}

export async function generateRiskSignals(
  snapshot: MetricsSnapshot,
): Promise<RiskSignalsResult> {
  // Cache hit — return immediately (15s TTL).
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return { signals: cached.signals, generatedAt: cached.at, model: MODEL };
  }

  if (!hasKey("groq")) {
    const signals = fallbackSignals(snapshot);
    cached = { signals, at: Date.now() };
    return { signals, generatedAt: cached.at, model: FALLBACK_MODEL };
  }

  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getKeys().groq}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 800,
        messages: [
          { role: "system", content: "You are a JSON-only risk monitor. Output only a JSON array — no prose, no markdown fences." },
          { role: "user", content: buildPrompt(snapshot) },
        ],
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[ai/risk-signals] Groq HTTP ${res.status}: ${detail.slice(0, 200)}`);
      const signals = fallbackSignals(snapshot);
      cached = { signals, at: Date.now() };
      return { signals, generatedAt: cached.at, model: FALLBACK_MODEL };
    }
    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content ?? "";
    let signals = parseSignalArray(text);
    // Defensive: if the model returned an empty/unparseable array, fall back.
    if (signals.length === 0) {
      console.error("[ai/risk-signals] Groq returned no parseable signals; using fallback");
      signals = fallbackSignals(snapshot);
      cached = { signals, at: Date.now() };
      return { signals, generatedAt: cached.at, model: FALLBACK_MODEL };
    }
    // Cap at 5 signals per the prompt constraint.
    if (signals.length > 5) signals = signals.slice(0, 5);
    cached = { signals, at: Date.now() };
    return { signals, generatedAt: cached.at, model: MODEL };
  } catch (e) {
    console.error("[ai/risk-signals] Groq call failed:", (e as Error).message?.slice(0, 200));
    const signals = fallbackSignals(snapshot);
    cached = { signals, at: Date.now() };
    return { signals, generatedAt: cached.at, model: FALLBACK_MODEL };
  }
}
