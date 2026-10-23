import type { Metadata } from "next";
import "./globals.css";

import { Toaster as SonnerToaster } from "@/components/ui/sonner";

/* ============================================================
   SELF-HOSTED FONTS (Fontsource) — replaces next/font/google.

   next/font/google downloads fonts from fonts.gstatic.com at build
   time, which is unreliable in this sandboxed environment and broke
   the build with:
     Module not found: Can't resolve
     '@vercel/turbopack-next/internal/font/google/font'

   Fontsource ships the same Google Fonts as local woff2/woff files in
   node_modules — zero build-time network dependency. The CSS custom
   properties consumed across the codebase (--font-geist-sans,
   --font-geist-mono, --font-inter, --font-mtqs-display) are now defined
   in globals.css :root and point at these local families, so every
   var(--font-*) reference keeps working unchanged.

   Brand board typography (unchanged):
   - MONTSERRAT — primary display/wordmark font (geometric sans;
     Bold/ExtraBold for logo, Regular/Medium for taglines).
   - INTER — body text.
   - GEIST SANS / GEIST MONO — technical/data displays.
   ============================================================ */

// Geist Sans — UI + SVG diagram labels (weights 400–700)
import "@fontsource/geist-sans/latin-400.css";
import "@fontsource/geist-sans/latin-500.css";
import "@fontsource/geist-sans/latin-600.css";
import "@fontsource/geist-sans/latin-700.css";

// Geist Mono — monospace data/telemetry text (weights 400–700)
import "@fontsource/geist-mono/latin-400.css";
import "@fontsource/geist-mono/latin-500.css";
import "@fontsource/geist-mono/latin-600.css";
import "@fontsource/geist-mono/latin-700.css";

// Inter — body text (weights 300–700)
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";

// Montserrat — brand display font (weights 400–900)
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/montserrat/latin-900.css";

export const metadata: Metadata = {
  title: "MTQΣ — Monetary Architecture Protocol",
  description:
    "MTQΣ is developing a monetary architecture protocol with an emphasis on transparent rules, measurable controls, and accountable governance. Currently in testnet with enforced shadow mode — custody, economic policy, contract deployability, and independent verification remain unresolved. Reserve trading is not authorized.",
  keywords: [
    "MTQΣ",
    "MTQ",
    "monetary architecture",
    "protocol",
    "testnet",
    "shadow mode",
    "governance",
    "verification",
    "evidence",
  ],
  authors: [{ name: "MTQΣ Protocol" }],
  icons: {
    icon: [
      // The official brand-board emblem (hexagonal Σ shield + globe + orbits).
      { url: "/brand/mtqs-emblem-v3.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/mtqs-emblem-v3.png", type: "image/png", sizes: "96x96" },
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/brand/mtqs-emblem-v3.png",
    other: [
      { rel: "icon", url: "/brand/favicon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "MTQΣ — Monetary Architecture Protocol",
    description:
      "Transparent rules · measurable controls · accountable governance. Testnet only · shadow mode enforced · reserve trading not authorized.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MTQΣ — Monetary Architecture Protocol",
    description:
      "Transparent rules · measurable controls · accountable governance. Testnet only · shadow mode enforced · reserve trading not authorized.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en"  suppressHydrationWarning>
      <body
        className={"antialiased bg-background text-foreground"}
        style={{ fontFamily: 'var(--font-inter), var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
      >
        {/* PERF (2026-10-24): (1) dropped the redundant root <MotionConfig> — the
            Pilot Command Center already wraps its own tree in MotionConfig, so
            this only forced framer-motion into the landing initial bundle;
            (2) dropped the unused Radix <Toaster /> (zero useToast consumers —
            sonner is the only toast system actually used); (3) dropped the
            <CurrencyProvider> wrapper — zero components consume useCurrency
            (the CurrencySelector/CurrencySymbolBadge components were never
            rendered), so the provider only added a dead context layer. */}
        {children}
        <SonnerToaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
