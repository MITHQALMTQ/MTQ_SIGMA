"use client";

// MTQΣ — Chunk-load recovery boundary (dev-mode resilience, no product change).
//
// WHY THIS EXISTS: the Pilot Command Center is a heavy client bundle loaded
// via next/dynamic. In Next.js 16 / Turbopack DEV mode, every recompile can
// retire previously-served chunk files. A browser tab that was loaded against
// an earlier compile graph then requests a chunk URL that no longer exists
// on disk → "Runtime ChunkLoadError: Failed to load chunk
// /_next/static/chunks/node_modules_*.js". This is a dev-server staleness
// artifact, NOT a product defect — but it breaks the user's session and must
// self-heal instead of showing a dead screen.
//
// RECOVERY STRATEGY (in order):
//   1. The retrying loader in app/page.tsx already retries transient chunk
//      fetch failures a few times before rejecting.
//   2. If an error still reaches this boundary and looks like a chunk-load
//      failure, perform ONE guarded hard reload (sessionStorage guard, 15s
//      window). After a reload the browser receives fresh HTML referencing
//      the CURRENT chunk graph, so the failure cannot recur; the persisted
//      view/section keys (mtqs.view / mtqs.section) return the user to the
//      exact place they were.
//   3. If a guarded reload already happened recently, never loop — show a
//      branded panel with a manual "Reload terminal" button and the honest
//      reason.
//
// Non-chunk errors (real render bugs) are ALSO caught here: they show the
// same branded panel (without auto-reload) so a single component failure
// never blanks the whole single-route app.
//
// Truth posture (unchanged): TESTNET ONLY · SHADOW MODE ENFORCED · RESERVE
// TRADING NOT AUTHORIZED. This component changes no product behavior.

import { Component, type ErrorInfo, type ReactNode } from "react";

/** sessionStorage keys (namespaced, consistent with mtqs.* conventions). */
const RELOAD_AT_KEY = "mtqs.chunkReloadAt";
/** Auto-reload guard window — one automatic reload per this many ms. */
const RELOAD_GUARD_MS = 15_000;

/** Best-effort detection of chunk/module load failures across browsers. */
export function isChunkLoadError(err: unknown): boolean {
  if (err == null) return false;
  const name =
    typeof err === "object" && "name" in err
      ? String((err as { name?: unknown }).name ?? "")
      : "";
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : String((err as { message?: unknown })?.message ?? "");
  return (
    name === "ChunkLoadError" ||
    /failed to load chunk|loading chunk \d+ failed|loading css chunk \d+ failed|failed to fetch dynamically imported module|importing a module script failed|dynamically imported module is not available/i.test(
      message,
    )
  );
}

interface ChunkRecoveryBoundaryProps {
  children: ReactNode;
}

interface ChunkRecoveryBoundaryState {
  error: Error | null;
  chunkError: boolean;
  autoReloaded: boolean;
}

export class ChunkRecoveryBoundary extends Component<
  ChunkRecoveryBoundaryProps,
  ChunkRecoveryBoundaryState
> {
  state: ChunkRecoveryBoundaryState = {
    error: null,
    chunkError: false,
    autoReloaded: false,
  };

  static getDerivedStateFromError(error: Error): Partial<ChunkRecoveryBoundaryState> {
    const chunk = isChunkLoadError(error);
    return { error, chunkError: chunk };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console trace for developers; recovery decisions happen below.
    console.error(
      `[mtqs] ${this.state.chunkError ? "Chunk load failure" : "Render error"} caught by recovery boundary:`,
      error,
      info.componentStack,
    );
  }

  /**
   * A chunk-load error means THIS TAB is running a stale compile graph:
   * the only true fix is fetching fresh HTML. Do it once, guarded.
   */
  componentDidMount(): void {
    if (!this.state.chunkError || this.state.error == null) return;
    let last = 0;
    try {
      last = Number(window.sessionStorage.getItem(RELOAD_AT_KEY) ?? "0") || 0;
    } catch {
      /* storage unavailable — treat as never reloaded */
    }
    const now = Date.now();
    if (now - last > RELOAD_GUARD_MS) {
      try {
        window.sessionStorage.setItem(RELOAD_AT_KEY, String(now));
      } catch {
        /* non-fatal */
      }
      this.setState({ autoReloaded: true });
      window.location.reload();
    }
  }

  private manualReload = (): void => {
    try {
      window.sessionStorage.setItem(RELOAD_AT_KEY, "0");
    } catch {
      /* non-fatal */
    }
    window.location.reload();
  };

  /** Reset the boundary (used by the retry affordance for non-chunk errors). */
  private reset = (): void => {
    this.setState({ error: null, chunkError: false, autoReloaded: false });
  };

  render(): ReactNode {
    const { error, chunkError } = this.state;
    if (error == null) return this.props.children;

    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#FAFCFA] px-6 text-center"
      >
        <span
          className="text-xl font-extrabold tracking-[0.34em] text-[#0E1F1B]"
          style={{
            fontFamily: "var(--font-mtqs-display), Montserrat, sans-serif",
          }}
        >
          MTQΣ
        </span>
        <div className="max-w-xl space-y-2">
          <h1 className="text-lg font-bold text-[#0E1F1B]">
            {chunkError
              ? "Terminal update detected — recovering"
              : "The terminal hit an unexpected error"}
          </h1>
          <p className="text-sm leading-relaxed text-[#5B6E68]">
            {chunkError
              ? "This page was loaded against an earlier development build whose assets have since been replaced. A fresh reload restores the current build and returns you to where you were."
              : "The error has been contained to this view. You can retry the view or reload the terminal; the audit trail and persisted state are unaffected."}
          </p>
          <p className="font-mono text-[0.62rem] leading-relaxed text-[#7A8C86]">
            {error.name || "Error"}: {error.message || "unknown"}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {chunkError ? (
            <button
              type="button"
              onClick={this.manualReload}
              className="rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0F766E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0D9488]"
            >
              Reload terminal
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={this.reset}
                className="rounded-lg bg-[#0D9488] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0F766E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0D9488]"
              >
                Retry view
              </button>
              <button
                type="button"
                onClick={this.manualReload}
                className="rounded-lg border border-[#DCE5E0] px-5 py-2.5 text-sm font-semibold text-[#33544C] transition hover:border-[#0D9488] hover:text-[#0F766E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#0D9488]"
              >
                Reload terminal
              </button>
            </>
          )}
        </div>
        <span className="text-[0.6rem] text-[#7A8C86]">
          TESTNET ONLY · SHADOW MODE ENFORCED · RESERVE TRADING NOT AUTHORIZED
        </span>
      </div>
    );
  }
}
