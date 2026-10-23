"use client";

// MTQΣ landing — truthful interaction dialogs.
// Every interactive element on the landing page routes to honest content:
//   • Connect Wallet  → wallet connection is UNAVAILABLE (no SDK, no signer)
//   • Watch Video     → no video published; points at committed evidence
//   • Developers / Governance / Resources → condensed evidence-register facts
// The reference design's visuals are preserved; nothing here fabricates
// capability, telemetry, or authorization.
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FlaskConical, Eye, Ban, TrendingUp, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import { WALLET_DIALOG, VIDEO_DIALOG, INFO_DIALOGS, OPERATIONAL_STATUS } from "@/lib/mtq/landing-status";
import { BrandMark } from "./BrandMark";

const STATUS_ICON = {
  flask: FlaskConical,
  eye: Eye,
  ban: Ban,
} as const;

const STATUS_COLOR: Record<string, string> = {
  cyan: "text-cyan-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  violet: "text-violet-300",
  slate: "text-slate-300",
};

function StatusList() {
  return (
    <ul className="mt-4 flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      {OPERATIONAL_STATUS.map((s) => {
        const Icon = STATUS_ICON[s.icon];
        return (
          <li key={s.id} className="flex items-start gap-2.5">
            <Icon className={`mt-0.5 size-4 shrink-0 ${STATUS_COLOR[s.tone]}`} aria-hidden />
            <div>
              <p className={`text-[0.7rem] font-bold uppercase tracking-[0.12em] ${STATUS_COLOR[s.tone]}`}>{s.title}</p>
              <p className="text-[0.72rem] leading-snug text-slate-400">{s.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const ROW_ICON = {
  ok: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
} as const;

const ROW_COLOR = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  fail: "text-rose-300",
} as const;

function useDialog() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

/* ---------------------------------------------------------------- */
/* Controlled wrappers                                               */
/* ---------------------------------------------------------------- */
export function WalletDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#040f24]/95 text-slate-100 backdrop-blur-xl sm:max-w-[26rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <BrandMark size={24} />
            {WALLET_DIALOG.title}
          </DialogTitle>
          <DialogDescription className="pt-1 text-left text-[0.82rem] leading-relaxed text-slate-300">
            {WALLET_DIALOG.body}
          </DialogDescription>
        </DialogHeader>
        <StatusList />
        <p className="mt-3 text-[0.68rem] leading-relaxed text-slate-500">
          No wallet SDK is loaded anywhere on this page. No signer is exposed. No transaction is constructed,
          signed, or broadcast.
        </p>
      </DialogContent>
    </Dialog>
  );
}

// 16c-013: VideoDialog is no longer exported — the only consumer is the
// VideoDialogButton below (no external importer existed).
function VideoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#040f24]/95 text-slate-100 backdrop-blur-xl sm:max-w-[26rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <BrandMark size={24} />
            {VIDEO_DIALOG.title}
          </DialogTitle>
          <DialogDescription className="pt-1 text-left text-[0.82rem] leading-relaxed text-slate-300">
            {VIDEO_DIALOG.body}
          </DialogDescription>
        </DialogHeader>
        <StatusList />
      </DialogContent>
    </Dialog>
  );
}

export function InfoDialog({
  which,
  open,
  onOpenChange,
}: {
  which: "developers" | "governance" | "resources";
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const info = INFO_DIALOGS.find((d) => d.id === which) ?? INFO_DIALOGS[0];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#040f24]/95 text-slate-100 backdrop-blur-xl sm:max-w-[30rem]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <BrandMark size={24} />
            {info.title}
          </DialogTitle>
          <DialogDescription className="pt-1 text-left text-[0.82rem] font-medium text-slate-200">
            {info.headline}
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-1 flex flex-col gap-2">
          {info.rows.map((r) => {
            const Icon = ROW_ICON[r.status];
            return (
              <li
                key={r.label}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3.5 py-2.5"
              >
                <span className="text-[0.76rem] text-slate-300">{r.label}</span>
                <span className="flex items-center gap-1.5 text-right text-[0.76rem] font-semibold">
                  <Icon className={`size-3.5 shrink-0 ${ROW_COLOR[r.status]}`} aria-hidden />
                  <span className={ROW_COLOR[r.status]}>{r.value}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 flex items-center gap-1.5 text-[0.68rem] text-slate-500">
          <TrendingUp className="size-3.5 shrink-0" aria-hidden />
          {info.footnote}
        </p>
        <StatusList />
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- */
/* Uncontrolled trigger helper (used by the hero's Watch Video CTA)  */
/* ---------------------------------------------------------------- */

/* Self-contained "Watch Video" trigger used inside the hero. */
export function VideoDialogButton({
  className,
  label,
  children,
}: {
  className?: string;
  label: string;
  children?: ReactNode;
}) {
  const { open, setOpen } = useDialog();
  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {children ?? label}
      </button>
      <VideoDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
