"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ArrowRight } from "lucide-react";
import type { SectionId } from "./Navigation";

// MTQΣ — Cmd+K Command Launcher (§59)
// Press Cmd/Ctrl+K to open. Search + navigate.

interface Command {
  id: string;
  label: string;
  action: () => void;
  category: string;
}

export function CommandLauncher({ onNavigate }: { onNavigate: (id: SectionId) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands: Command[] = [
    { id: "overview", label: "Go to Overview", action: () => onNavigate("overview"), category: "Navigation" },
    { id: "reference", label: "Go to Reference", action: () => onNavigate("reference"), category: "Navigation" },
    { id: "reserve", label: "Go to Reserve", action: () => onNavigate("reserve"), category: "Navigation" },
    { id: "risk", label: "Go to Risk", action: () => onNavigate("risk"), category: "Navigation" },
    { id: "rebalancing", label: "Go to Rebalancing", action: () => onNavigate("rebalancing"), category: "Navigation" },
    { id: "transparency", label: "Go to Transparency", action: () => onNavigate("transparency"), category: "Navigation" },
    { id: "governance", label: "Go to Governance", action: () => onNavigate("governance"), category: "Navigation" },
    { id: "validation", label: "Go to Validation", action: () => onNavigate("validation"), category: "Navigation" },
    { id: "developers", label: "Go to Developers", action: () => onNavigate("developers"), category: "Navigation" },
    { id: "mint", label: "Mint MTQΣ", action: () => onNavigate("mint"), category: "Operations" },
    { id: "redeem", label: "Redeem MTQΣ", action: () => onNavigate("redeem"), category: "Operations" },
    { id: "portfolio", label: "Go to Portfolio", action: () => onNavigate("portfolio"), category: "Operations" },
    { id: "activity", label: "Go to Activity", action: () => onNavigate("activity"), category: "Operations" },
    { id: "simulation", label: "Open Simulation Lab", action: () => onNavigate("simulation"), category: "Supporting" },
    { id: "docs", label: "Open Documentation", action: () => onNavigate("docs"), category: "Supporting" },
    { id: "security", label: "Open Security", action: () => onNavigate("security"), category: "Supporting" },
    { id: "contracts", label: "Open Contracts", action: () => onNavigate("contracts"), category: "Supporting" },
    { id: "networks", label: "Open Networks", action: () => onNavigate("networks"), category: "Supporting" },
    { id: "faucet", label: "Open Faucet", action: () => onNavigate("faucet"), category: "Supporting" },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(""); setSelectedIndex(0); }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      setOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
          <motion.div
            initial={{ scale: 0.95, y: -10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: -10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-xl mtqs-glass rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Command palette"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
              <Search className="h-4 w-4 text-white/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search commands..."
                className="flex-1 bg-transparent text-sm text-white/90 placeholder-white/30 outline-none"
                autoFocus
              />
              <kbd className="text-[0.6rem] text-white/30 font-mono px-1.5 py-0.5 rounded border border-white/10">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[50vh] overflow-y-auto mtqs-scroll">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-white/30">No commands found</div>
              ) : (
                filtered.map((cmd, i) => (
                  <button
                    key={cmd.id}
                    onClick={() => { cmd.action(); setOpen(false); }}
                    onMouseEnter={() => setSelectedIndex(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === selectedIndex ? "bg-mtqs-gold/10" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <span className={`text-[0.6rem] uppercase tracking-wider ${i === selectedIndex ? "text-mtqs-gold" : "text-white/30"} w-20`}>{cmd.category}</span>
                    <span className={`flex-1 text-sm ${i === selectedIndex ? "text-mtqs-gold" : "text-white/70"}`}>{cmd.label}</span>
                    {i === selectedIndex && <ArrowRight className="h-3 w-3 text-mtqs-gold" />}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
