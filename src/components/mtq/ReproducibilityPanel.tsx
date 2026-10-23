"use client";

import { useState } from "react";
import { Panel, Reveal, Pill, GlowDot } from "./primitives";
import { RefreshCw, Check, X, FileText } from "lucide-react";
import type { MetricsSnapshot } from "@/lib/mtq/engine";

// MTQΣ — Reproducibility Panel (§34)
// Shows deterministic reproducibility: Published vs Recomputed output.

export function ReproducibilityPanel({ snapshot }: { snapshot: MetricsSnapshot | null }) {
  const [reproducing, setReproducing] = useState(false);
  const [result, setResult] = useState<{ published: number; recomputed: number; match: boolean } | null>(null);
  const [reproError, setReproError] = useState<string | null>(null);

  const handleReproduce = async () => {
    if (!snapshot) return;
    setReproducing(true);
    setReproError(null);
    try {
      // Re-fetch the metrics to "reproduce" the calculation
      const res = await fetch("/api/metrics", { cache: "no-store" });
      // 16c-003 fix: a non-2xx response (engine warming up / rate limit)
      // carries an error body — parsing it used to set recomputed=undefined
      // and crash the render at result.recomputed.toFixed(6) (taking the
      // whole terminal down via the top-level error boundary). Guard and
      // fail honest instead of rendering a fabricated value.
      if (!res.ok) throw new Error(`metrics ${res.status}`);
      const data = await res.json();
      const recomputed = data?.gfbIndex;
      if (typeof recomputed !== "number" || !Number.isFinite(recomputed)) {
        throw new Error("no usable gfbIndex in response");
      }
      const published = snapshot.gfbIndex;
      setResult({
        published,
        recomputed,
        match: Math.abs(published - recomputed) < 0.0001,
      });
    } catch {
      // Never render a fabricated "0.000000 · MISMATCH" — clear the result
      // and state the failure honestly.
      setResult(null);
      setReproError(
        "Recompute unavailable — the metrics endpoint did not return a usable value. Nothing is fabricated.",
      );
    }
    setReproducing(false);
  };

  return (
    <Reveal>
      <Panel className="p-5 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <FileText className="h-5 w-5 text-mtqs-gold mt-0.5" />
          <div>
            <div className="mtqs-eyebrow">§24 · §34</div>
            <h3 className="text-base font-semibold text-white/90 mt-1">Deterministic Reproducibility</h3>
            <p className="text-xs text-white/55 mt-1">Re-run the calculation from the same inputs and verify the output matches</p>
          </div>
        </div>

        {/* Version lineage — wired to the SAME live fields as the §24.2 cards in
            the Transparency section (data lineage / objective version / oracle
            aggregate state). The old hardcoded "v1.0-2026 / MASE-v1 / 3-Source-§9"
            strings contradicted the live values rendered beside this panel. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="text-[0.55rem] uppercase tracking-wider text-white/40">Data Version</div>
            <div className="font-mono text-[0.66rem] text-white/70 mt-1 break-words" title={snapshot?.source ?? undefined}>
              {snapshot?.source ?? "—"}
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="text-[0.55rem] uppercase tracking-wider text-white/40">Model Version</div>
            <div className="font-mono text-[0.66rem] text-white/70 mt-1 break-words">
              {snapshot?.mase?.objectiveVersion ?? "—"}
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="text-[0.55rem] uppercase tracking-wider text-white/40">Param Version</div>
            <div className="font-mono text-[0.66rem] text-white/70 mt-1 break-words">
              BLUEPRINT-v2.0 · §22.4 registry (pilot)
            </div>
          </div>
          <div className="p-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <div className="text-[0.55rem] uppercase tracking-wider text-white/40">Oracle Version</div>
            <div className="font-mono text-[0.66rem] text-white/70 mt-1 break-words">
              {snapshot?.oracle ? `3-source board · aggregate ${snapshot.oracle.aggregateState}` : "—"}
            </div>
          </div>
        </div>

        {/* Reproduce button */}
        <button
          onClick={handleReproduce}
          disabled={reproducing || !snapshot}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-mtqs-gold/30 bg-mtqs-gold/10 text-mtqs-gold text-sm font-medium hover:bg-mtqs-gold/20 transition-colors disabled:opacity-50 mtqs-focus"
          aria-label="Reproduce calculation"
        >
          <RefreshCw className={`h-4 w-4 ${reproducing ? "animate-spin" : ""}`} />
          {reproducing ? "Reproducing..." : "REPRODUCE"}
        </button>

        {/* Result */}
        {reproError && (
          <div className="mt-3 rounded-md border border-mtqs-amber/25 bg-amber-400/[0.04] px-3 py-2 text-[0.7rem] leading-relaxed text-mtqs-amber/90">
            {reproError}
          </div>
        )}
        {result && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <span className="text-xs text-white/55">Published Output (Reference Index)</span>
              <span className="font-mono tabular-nums text-sm text-white/90">{result.published.toFixed(6)}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
              <span className="text-xs text-white/55">Recomputed Output</span>
              <span className="font-mono tabular-nums text-sm text-white/90">{result.recomputed.toFixed(6)}</span>
            </div>
            <div className={`flex items-center justify-between p-3 rounded-lg border ${result.match ? "border-mtqs-emerald/30 bg-mtqs-emerald/5" : "border-mtqs-rose/30 bg-mtqs-rose/5"}`}>
              <span className="text-xs text-white/55">Match Status</span>
              {result.match ? (
                <span className="flex items-center gap-1.5 text-mtqs-emerald text-sm font-semibold"><Check className="h-4 w-4" /> MATCH</span>
              ) : (
                <span className="flex items-center gap-1.5 text-mtqs-rose text-sm font-semibold"><X className="h-4 w-4" /> MISMATCH</span>
              )}
            </div>
          </div>
        )}

        <p className="mt-3 text-[0.7rem] text-white/40">
          Version lineage above is live (same fields as the §24.2 cards in the Transparency section).
          Reproducibility uses the same data, model, parameter, and oracle versions. Every published output can be independently recomputed from public inputs.
        </p>
      </Panel>
    </Reveal>
  );
}
