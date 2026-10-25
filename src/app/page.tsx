"use client";

// MTQΣ — single-route app shell (landing ↔ Pilot Command Center).
//
// The sandbox exposes exactly one route ("/"), so the complete product is
// staged as two client views inside it:
//   • LANDING      — the pixel-parity marketing composition (nav → cinematic
//                    hero → protocol cards → stats → ecosystem → footer).
//   • COMMAND CENTER — the full institutional terminal: 26 sections covering
//                    the blueprint v2.0 (reference, reserve, risk, MARP,
//                    transparency, governance, validation, evidence, mint,
//                    redeem, portfolio, activity, simulation, constituency,
//                    architecture, docs, security, contracts, networks,
//                    faucet + restricted investors/pitch).
//
// Entry points: nav "Launch App" button, hero primary CTA, ecosystem CTA,
// footer link. Exit: the "Landing" button in the Command Center header.
// The active view + active section persist in sessionStorage so a refresh
// keeps the user where they were.
//
// Truth posture (unchanged): TESTNET ONLY · SHADOW MODE ENFORCED · RESERVE
// TRADING NOT AUTHORIZED. No wallet SDK, no signer, no transaction, no gate
// advanced anywhere in this shell.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import "@/components/landing/landing.css";
import { LandingNav } from "@/components/landing/LandingNav";
import { Hero } from "@/components/landing/Hero";
import { ProtocolCards } from "@/components/landing/ProtocolCards";
import { StatsRow } from "@/components/landing/StatsRow";
import { EcosystemSection } from "@/components/landing/EcosystemSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  ChunkRecoveryBoundary,
  isChunkLoadError,
} from "@/components/mtq/ChunkRecoveryBoundary";

// The Command Center is a heavy client bundle (charts, simulators, live
// polling). Dynamic-import it so the landing view stays instant; it only
// loads when the user actually launches the terminal.
//
// CHUNK-LOAD RESILIENCE (dev): Turbopack recompiles retire previously-served
// chunk files, so a tab opened against an older compile graph can request a
// chunk URL that no longer exists (Runtime ChunkLoadError). The loader below
// retries transient chunk fetches a few times; any failure that still
// surfaces is caught by <ChunkRecoveryBoundary>, which performs ONE guarded
// hard reload (fresh HTML → current chunk graph) and restores the persisted
// view/section, or degrades to a manual reload button — never a dead screen.
type CommandCenterModule = typeof import("@/components/mtq/PilotCommandCenter");

const loadCommandCenter = (retriesLeft: number): Promise<CommandCenterModule> =>
  import("@/components/mtq/PilotCommandCenter").catch((err: unknown) => {
    if (retriesLeft > 0 && isChunkLoadError(err)) {
      return new Promise<void>((resolve) => setTimeout(resolve, 400)).then(
        () => loadCommandCenter(retriesLeft - 1),
      );
    }
    throw err;
  });

const PilotCommandCenter = dynamic(
  () =>
    loadCommandCenter(3).then((m) => m.PilotCommandCenter),
  {
    ssr: false,
    loading: () => <CommandCenterBoot />,
  },
);

type View = "landing" | "app";

const VIEW_KEY = "mtqs.view";
const SECTION_KEY = "mtqs.section";

/* Branded boot state shown while the terminal chunk streams in. */
function CommandCenterBoot() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#FAFCFA]"
      role="status"
      aria-live="polite"
    >
      <span
        className="text-xl font-extrabold tracking-[0.34em] text-[#0E1F1B]"
        style={{ fontFamily: "var(--font-mtqs-display), Montserrat, sans-serif" }}
      >
        MTQΣ
      </span>
      <span className="text-[0.68rem] uppercase tracking-[0.24em] text-[#5B6E68]">
        Loading Pilot Command Center…
      </span>
      <span className="mt-2 h-1 w-40 overflow-hidden rounded-full bg-[#E3EAE6]">
        <span className="block h-full w-1/3 animate-pulse rounded-full bg-[#0D9488]" />
      </span>
      <span className="text-[0.6rem] text-[#7A8C86]">
        TESTNET ONLY · SHADOW MODE ENFORCED · RESERVE TRADING NOT AUTHORIZED
      </span>
    </div>
  );
}

export default function Page() {
  const [view, setView] = useState<View>("landing");

  // Restore the persisted view after hydration (never during SSR).
  useEffect(() => {
    try {
      // Canonical "restore persisted UI state" pattern: the server always
      // renders the landing view, so this one setState must run AFTER
      // hydration to avoid a mismatch — an effect is the only correct place.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.sessionStorage.getItem(VIEW_KEY) === "app") setView("app");
    } catch {
      /* private mode / storage disabled — default to landing */
    }
  }, []);

  const launch = useCallback(() => {
    setView("app");
    try {
      window.sessionStorage.setItem(VIEW_KEY, "app");
    } catch {
      /* non-fatal */
    }
    window.scrollTo({ top: 0 });
  }, []);

  /* Launch straight into a specific terminal section — used by the landing
     nav menus (Developers / Governance / Resources) so every landing "tab"
     navigates somewhere real. The terminal restores `mtqs.section` on mount. */
  const launchTo = useCallback(
    (section: string) => {
      try {
        window.sessionStorage.setItem(SECTION_KEY, section);
      } catch {
        /* non-fatal */
      }
      launch();
    },
    [launch],
  );

  const exitToLanding = useCallback(() => {
    setView("landing");
    try {
      window.sessionStorage.setItem(VIEW_KEY, "landing");
    } catch {
      /* non-fatal */
    }
    window.scrollTo({ top: 0 });
  }, []);

  /* ─── COMMAND CENTER VIEW ──────────────────────────────────── */
  if (view === "app") {
    return (
      <ChunkRecoveryBoundary>
        <PilotCommandCenter onExit={exitToLanding} />
      </ChunkRecoveryBoundary>
    );
  }

  /* ─── LANDING VIEW ────────────────────────────────────────────────── */
  return (
    <div className="lp-root">
      {/* keyboard users can skip the nav */}
      <a
        href="#home"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[#0D9488] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <LandingNav onLaunch={launch} onLaunchTo={launchTo} />

      <main className="flex-1">
        <Hero onLaunch={launch} />
        <ProtocolCards />
        <StatsRow />
        <EcosystemSection onLaunch={launch} />
      </main>

      <LandingFooter onLaunch={launch} onLaunchTo={launchTo} />
    </div>
  );
}
