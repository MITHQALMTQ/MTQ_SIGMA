"use client";
import { Panel, Reveal, Pill } from "../primitives";
import { Handshake, ArrowRight } from "lucide-react";

const ALLIANCE_MEMBERS = [
  { category: "DEX", name: "Aerodrome (Base)", status: "Target", description: "Largest DEX on Base — primary liquidity venue for MTQΣ" },
  { category: "Lending", name: "Aave V3", status: "Target", description: "Use MTQΣ as collateral type — enables borrowing against purchasing power" },
  { category: "Wallet", name: "Rabby / Trust Wallet", status: "Target", description: "Native MTQΣ display with multi-currency + GFB ticker" },
  { category: "Payments", name: "Request Network / BitPay", status: "Target", description: "Accept MTQΣ as payment — purchasing-power-denominated commerce" },
  { category: "Data", name: "Pyth Network / Chainlink", status: "Target", description: "Primary oracle providers for the multi-source consensus (§9)" },
];

export function AllianceSection() {
  return (
    <Reveal>
      <Panel className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <Handshake className="h-6 w-6 text-mtqs-gold mt-0.5" />
          <div>
            <div className="mtqs-eyebrow">Strategic · R7</div>
            <h2 className="mtqs-section-title mt-1">MTQΣ Alliance — Integrators</h2>
            <p className="text-sm text-white/55 mt-2">
              The MTQΣ Alliance is a group of protocols, wallets, and payment processors that integrate MTQΣ.
              Each integration creates network effects — making MTQΣ more useful for everyone.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {ALLIANCE_MEMBERS.map((m) => (
            <div key={m.name} className="mtqs-glass p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-xs font-semibold text-mtqs-gold uppercase tracking-wide">{m.category}</div>
                  <div className="text-sm font-semibold text-white mt-1">{m.name}</div>
                </div>
                <Pill tone="amber">{m.status}</Pill>
              </div>
              <p className="text-xs text-white/55 leading-relaxed">{m.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 p-4 rounded-lg border border-mtqs-gold/20 bg-mtqs-gold/5">
          <p className="text-sm text-white">
            <span className="font-semibold text-mtqs-gold">Join the Alliance:</span> If you're building a protocol, wallet, or payment processor
            and want to integrate MTQΣ, contact the protocol team. Technical integration support + co-marketing available.
          </p>
        </div>
      </Panel>
    </Reveal>
  );
}
