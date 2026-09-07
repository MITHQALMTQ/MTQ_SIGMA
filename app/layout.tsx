import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MTQ Σ — The Global Purchasing Power Unit",
  description: "MTQ Σ (Mithqal) is a non-USD, multi-currency reference unit backed by a 110%+ collateralized reserve of stablecoins and tokenized gold.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
