// MTQΣ — Constituency Succession API (§3.3 / §21.5 / §9.2)
// GET  → candidate universe + live admission quotes + current basket state
// POST → run the pure (state-clone) succession simulation on the LIVE index:
//        a chosen currency loses power (configurable shock), the §21.5 staged
//        ladder liquidates its reserve sleeve, the component is ejected, and a
//        governed successor from the candidate universe takes its slot — with
//        zero artificial index return at every step (chain-link divisors).
import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/mtq/pilot-state";
import { rateLimit, getClientIP } from "@/lib/mtq/rate-limit";
import {
  CANDIDATE_UNIVERSE,
  fetchCandidateQuotes,
  simulateSuccession,
} from "@/lib/mtq/succession";

export const dynamic = "force-dynamic";

const COMPONENT_LABELS = ["USD", "EUR", "JPY", "GBP", "CNY", "CHF", "Gold"] as const;
const EJECTED_OPTIONS = COMPONENT_LABELS.filter((c) => c !== "Gold");

function holdingPerMtqFor(code: string, perMtq: Record<string, number>): number | null {
  switch (code) {
    case "USD": return perMtq.usd ?? null;
    case "EUR": return perMtq.eur ?? null;
    case "GBP": return perMtq.gbp ?? null;
    case "JPY": return perMtq.jpy ?? null;
    case "CNY": return perMtq.cny ?? null;
    case "CHF": return perMtq.chf ?? null;
    default: return null;
  }
}

export async function GET(req: Request) {
  // [Task 24-c hardening] "simulate" bucket, 12 req/IP/min — GET fires an
  // UNCACHED external fetch (fetchCandidateQuotes → Frankfurter, 6s timeout,
  // two fallback URLs) plus live snapshot assembly; unguarded it is an
  // external-fetch amplifier (same bucket class as mint/redeem sims).
  const rl = await rateLimit(getClientIP(req), "simulate");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  try {
    const [snap, quotes] = await Promise.all([getSnapshot(), fetchCandidateQuotes()]);
    return NextResponse.json({
      universe: CANDIDATE_UNIVERSE,
      quotes,
      basket: COMPONENT_LABELS,
      ejectedOptions: EJECTED_OPTIONS,
      live: {
        iLevel: snap.chainIndex.I_t,
        // The live smoothed weights (or the Strategic Prior at genesis).
        weights: snap.weightStates?.smoothed ?? null,
        holdingsPerMtq: snap.holdings?.perMtq ?? null,
        basis: snap.holdings?.basis ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Engine not ready", detail: String(e) },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  // [Task 24-c hardening] "simulate" bucket, 12 req/IP/min — POST runs the
  // same uncached external quote fetch + the full §21.5 staged-ladder
  // simulation (heaviest pure-compute endpoint outside the AI family).
  const rl = await rateLimit(getClientIP(req), "simulate");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000))),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }
  try {
    const body = await req.json().catch(() => ({}));
    const ejected = typeof body.ejected === "string" ? body.ejected.toUpperCase() : "";
    const shockPct = Number(body.shockPct);
    const successor = typeof body.successor === "string" && body.successor.length > 0
      ? body.successor.toUpperCase()
      : null;

    if (!EJECTED_OPTIONS.includes(ejected as (typeof EJECTED_OPTIONS)[number])) {
      return NextResponse.json(
        { error: `ejected must be one of [${EJECTED_OPTIONS.join(", ")}] (Gold is the constitutional anchor and cannot be ejected).` },
        { status: 400 },
      );
    }
    if (!Number.isFinite(shockPct) || shockPct <= 0 || shockPct >= 100) {
      return NextResponse.json(
        { error: "shockPct must be a number in (0, 100) — e.g. 40 for a −40% purchasing-power collapse." },
        { status: 400 },
      );
    }
    if (successor && !CANDIDATE_UNIVERSE.some((c) => c.code === successor)) {
      return NextResponse.json(
        { error: `successor must be a candidate code [${CANDIDATE_UNIVERSE.map((c) => c.code).join(", ")}] or null (eject-only).` },
        { status: 400 },
      );
    }

    const [snap, quotes] = await Promise.all([getSnapshot(), fetchCandidateQuotes()]);
    const successorPriceUsd =
      typeof body.successorPriceUsd === "number" && body.successorPriceUsd > 0
        ? body.successorPriceUsd
        : successor
          ? quotes.quotes[successor] ?? null
          : null;

    const sim = simulateSuccession({
      liveIndex: snap.chainIndex,
      componentLabels: [...COMPONENT_LABELS],
      ejected,
      shockPct,
      successor,
      successorPriceUsd,
      ejectedHoldingNativePerMtq: snap.holdings?.perMtq
        ? holdingPerMtqFor(ejected, snap.holdings.perMtq)
        : null,
    });

    if (!sim.ok) {
      return NextResponse.json({ error: sim.error }, { status: 400 });
    }
    return NextResponse.json({
      sim,
      quoteSource: quotes,
      liveBasis: snap.holdings?.basis ?? null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Simulation failed", detail: String(e) },
      { status: 500 },
    );
  }
}
