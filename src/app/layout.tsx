import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const dynamic = "force-dynamic";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-mtqs-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "MTQΣ — The Monetary Observatory",
  description:
    "Closed-loop monetary architecture pilot — GFB Index, gold-collateralized reserve, §9 oracle consensus, mint/redeem simulation on Monad, Arc, and Solana testnets. Candidate for public testing — NOT production-authorized.",
  keywords: [
    "MTQΣ",
    "MTQ",
    "GFB",
    "monetary architecture",
    "gold reserve",
    "pilot",
    "testnet",
    "stablecoin",
    "oracle consensus",
  ],
  authors: [{ name: "MTQΣ Protocol" }],
  icons: {
    icon: [
      { url: "/brand/favicon.svg", type: "image/svg+xml" },
      { url: "/brand/mtqs-emblem.png", type: "image/png" },
    ],
    apple: "/brand/mtqs-emblem.png",
  },
  openGraph: {
    title: "MTQΣ — The Monetary Observatory",
    description:
      "The Global Purchasing Power Unit — Closed-loop monetary architecture pilot.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MTQΣ — The Monetary Observatory",
    description: "Closed-loop monetary architecture pilot. Candidate for testnet validation.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${cormorant.variable} antialiased bg-background text-foreground`}
        style={{ fontFamily: 'var(--font-inter), var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif' }}
      >
        {children}
        <Toaster />
        <SonnerToaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
