// MTQΣ — Blueprint Q&A (P1-B)
// Chat-style Q&A over the MTQΣ v1.0 Master Blueprint, powered by Gemini
// long-context via POST /api/ai/qa → { answer, citations, model, disclaimer }.
//
// Behaviour:
//   - Maintains a 5-item Q&A history (question amber-200, answer foreground/90,
//     citations as small muted pills).
//   - The "current answer" panel renders the latest answer (or 3 pulsing gray
//     bars while loading) with citations as small gold pills prefixed by §.
//   - Input is a 2-row textarea + Send button. Enter submits, Shift+Enter
//     inserts a newline. 500-char cap with a `{n}/500` counter on the right.
//     Submit is disabled if empty or loading.
//   - Suggested question chips (3 of them) appear only when history is empty —
//     clicking fills the input and submits.
//   - Auto-scrolls the history to the bottom when a new answer arrives.
//   - Error state is a rose-tinted panel with a retry button.
//
// Brand: obsidian + gold, font-mono on numerics, lucide icons (no emojis),
// Panel + Reveal + Pill + GlowDot from the primitives. NO indigo, NO blue.

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, BookOpen, Sparkles, AlertCircle } from "lucide-react";
import { Panel, Reveal, Pill, GlowDot, Skeleton } from "./primitives";

/* ---------- API shape contract (must match P1-A backend) ---------- */
interface QaResponse {
  answer: string;
  citations: string[];
  model: string;
  disclaimer: string;
}

interface QaItem {
  q: string;
  a: string;
  citations: string[];
}

const MAX_CHARS = 500;
const HISTORY_LIMIT = 5;
const SUGGESTED_QUESTIONS = [
  "What is the GFB Index?",
  "How does the §9 oracle consensus work?",
  "What are the admissibility envelopes?",
];

/* ---------- Model badge tone: gold / muted / rose ---------- */
function modelTone(model: string | null | undefined): "gold" | "muted" | "rose" {
  if (!model) return "muted";
  if (model === "disabled" || model === "error") return "rose";
  if (model.startsWith("fallback")) return "muted";
  return "gold"; // real model
}

/* ---------- BlueprintQA component ---------- */
export function BlueprintQA({ className = "" }: { className?: string }) {
  const [question, setQuestion] = useState<string>("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [citations, setCitations] = useState<string[]>([]);
  const [model, setModel] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<QaItem[]>([]);

  const historyEndRef = useRef<HTMLDivElement>(null);

  /* ---------- Auto-scroll the history to the bottom when a new answer arrives ---------- */
  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [history, loading]);

  /* ---------- Submit handler ---------- */
  const submit = useCallback(async (q?: string) => {
    const trimmed = (q ?? question).trim();
    if (!trimmed || loading) return;
    if (trimmed.length > MAX_CHARS) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setCitations([]);
    setModel(null);
    setDisclaimer(null);

    try {
      const res = await fetch("/api/ai/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`qa ${res.status}`);
      const json = (await res.json()) as QaResponse;
      if (json?.model === "error" || (!json?.answer && !json?.citations)) {
        setError(json?.answer ? null : "Q&A payload missing");
        if (json?.answer) {
          setAnswer(json.answer);
          setCitations(json.citations ?? []);
          setModel(json.model ?? null);
          setDisclaimer(json.disclaimer ?? null);
        }
      } else {
        setAnswer(json.answer);
        setCitations(json.citations ?? []);
        setModel(json.model ?? null);
        setDisclaimer(json.disclaimer ?? null);
        // Prepend to history, keep last 5.
        setHistory((prev) => {
          const next = [
            { q: trimmed, a: json.answer, citations: json.citations ?? [] },
            ...prev,
          ];
          return next.slice(0, HISTORY_LIMIT);
        });
      }
      setQuestion("");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }, [question, loading]);

  /* ---------- Keyboard handler: Enter submits, Shift+Enter newline ---------- */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  /* ---------- Suggested question click — fill + submit ---------- */
  const onSuggested = (q: string) => {
    setQuestion(q);
    submit(q);
  };

  const tone = modelTone(model);
  const trimmed = question.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_CHARS && !loading;

  /* ---------- History item card ---------- */
  const renderHistoryItem = (item: QaItem, idx: number) => (
    <motion.div
      key={`${idx}-${item.q.slice(0, 24)}`}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: idx * 0.03 }}
      className="rounded-md border border-border bg-black/[0.02] p-3 space-y-2"
    >
      <div className="text-[0.78rem] font-medium text-mtqs-gold leading-snug">
        {item.q}
      </div>
      <div className="text-[0.75rem] text-foreground/90 leading-relaxed whitespace-pre-wrap">
        {item.a}
      </div>
      {item.citations && item.citations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.citations.map((c, i) => (
            <span
              key={i}
              className="inline-flex items-center rounded-full border border-border bg-black/[0.02] px-2 py-0.5 text-[0.6rem] font-mono text-muted-foreground"
            >
              §{c}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );

  /* ---------- Current answer panel ---------- */
  const renderCurrentAnswer = () => (
    <div className="rounded-md border border-mtqs-gold/25 bg-mtqs-gold/5 p-4 space-y-3">
      <div className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/85">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        Answer
      </div>
      {loading ? (
        <div className="space-y-2.5" aria-hidden="true">
          <Skeleton className="h-3 w-[92%]" />
          <Skeleton className="h-3 w-[86%]" />
          <Skeleton className="h-3 w-[78%]" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-mtqs-rose/40 bg-mtqs-rose/5 p-3 flex items-start gap-2.5">
          <AlertCircle className="h-3.5 w-3.5 text-mtqs-rose shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className="text-[0.78rem] font-medium text-mtqs-rose">
              Q&A unavailable
            </div>
            <p className="mt-0.5 text-[0.7rem] text-muted-foreground leading-relaxed break-words">
              {error}
            </p>
          </div>
          <button
            onClick={() => submit(trimmed)}
            disabled={loading || !canSubmit}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-md border border-mtqs-rose/30 bg-mtqs-rose/5 px-2.5 py-1.5 text-[0.66rem] font-medium text-rose-200 hover:bg-mtqs-rose/[0.12] transition disabled:opacity-50"
          >
            Retry
          </button>
        </div>
      ) : answer ? (
        <>
          <p className="whitespace-pre-wrap leading-relaxed text-[0.82rem] text-foreground">
            {answer}
          </p>
          {citations && citations.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground mr-1">
                Cites
              </span>
              {citations.map((c, i) => (
                <Pill key={i} tone="gold" className="font-mono text-[0.6rem]">
                  §{c}
                </Pill>
              ))}
            </div>
          )}
          {disclaimer && (
            <p className="text-[0.62rem] text-muted-foreground/55 leading-relaxed pt-1 border-t border-border">
              {disclaimer}
            </p>
          )}
        </>
      ) : null}
    </div>
  );

  return (
    <Reveal>
      <Panel className={`p-5 sm:p-6 ${className}`}>
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2">
              <BookOpen className="h-3.5 w-3.5 text-mtqs-gold/85" aria-hidden="true" />
              <span className="text-[0.6rem] uppercase tracking-[0.22em] text-mtqs-gold/85">
                AI · Blueprint Q&amp;A
              </span>
            </div>
            <h3 className="text-base font-semibold text-foreground">
              Ask the Blueprint
            </h3>
            <p className="text-[0.72rem] text-muted-foreground/75 leading-relaxed">
              Gemini-powered Q&amp;A over the v1.0 Master Blueprint constants. Informational only.
            </p>
          </div>
          <Pill tone={tone} className="font-mono shrink-0">
            <GlowDot
              color={tone === "gold" ? "gold" : tone === "rose" ? "rose" : "amber"}
              size="h-1.5 w-1.5"
            />
            {model ?? "—"}
          </Pill>
        </div>

        {/* ---------- History ---------- */}
        <AnimatePresence initial={false}>
          {history.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3"
            >
              <div className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground mb-2">
                Recent Q&amp;A
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto mtqs-scroll pr-1">
                {history.map((item, idx) => renderHistoryItem(item, idx))}
                <div ref={historyEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---------- Current answer (or loading skeleton) ---------- */}
        {(loading || answer || error) && (
          <div className="mb-3">{renderCurrentAnswer()}</div>
        )}

        {/* ---------- Suggested questions (only when history empty) ---------- */}
        {history.length === 0 && !loading && !answer && !error && (
          <div className="mb-3">
            <div className="text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground mb-2">
              Try one of
            </div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => onSuggested(q)}
                  className="inline-flex items-center rounded-full border border-mtqs-gold/25 bg-mtqs-gold/[0.05] px-3 py-1.5 text-[0.72rem] text-mtqs-gold hover:bg-mtqs-gold/[0.12] hover:border-mtqs-gold/40 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Input area — mobile-first stack, sm+ side-by-side ---------- */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-end gap-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={onKeyDown}
              placeholder="Ask about the v1.0 Master Blueprint…"
              rows={2}
              aria-label="Question"
              className="flex-1 resize-none rounded-md border border-border bg-black/[0.02] px-3 py-2 text-[0.8rem] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-mtqs-gold/40 focus:bg-black/[0.04] transition"
            />
            <button
              onClick={() => submit()}
              disabled={!canSubmit}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-mtqs-gold/30 bg-mtqs-gold/[0.08] px-4 py-2 text-[0.78rem] font-medium text-mtqs-gold hover:bg-mtqs-gold/[0.16] hover:border-mtqs-gold/45 transition disabled:opacity-50 disabled:cursor-not-allowed sm:self-stretch"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Send
            </button>
          </div>
          {/* Char counter — right-aligned */}
          <div className="flex justify-end">
            <span
              className={`text-[0.62rem] font-mono tabular-nums ${
                question.length >= MAX_CHARS
                  ? "text-mtqs-rose"
                  : question.length > MAX_CHARS * 0.9
                  ? "text-mtqs-amber"
                  : "text-muted-foreground/60"
              }`}
            >
              {question.length}/{MAX_CHARS}
            </span>
          </div>
        </div>
      </Panel>
    </Reveal>
  );
}

export default BlueprintQA;
