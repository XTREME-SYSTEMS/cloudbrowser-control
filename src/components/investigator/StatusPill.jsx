import React from "react";
import { cn } from "@/lib/utils";

/**
 * One pill for every three-state verification label the pipeline produces, so
 * CERTIFIED / STALE / NOT CERTIFIED, VERIFIED / PARTIAL / UNVERIFIED and
 * APPROVED / REJECTED / PENDING always read the same way wherever they appear.
 *
 * The classes are written as literals: Tailwind purges anything it cannot find
 * as a complete string in the source, so a composed class name would silently
 * render unstyled.
 */
const TONES = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  bad: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
  neutral: "border-border bg-muted text-muted-foreground",
};

const LABEL_TONES = {
  CERTIFIED: "good",
  VERIFIED: "good",
  APPROVED: "good",
  granted: "good",
  STALE: "warn",
  PARTIAL: "warn",
  PENDING: "warn",
  "NOT CERTIFIED": "bad",
  UNVERIFIED: "bad",
  REJECTED: "bad",
  rejected: "bad",
};

export function toneFor(label) {
  return LABEL_TONES[String(label ?? "")] || "neutral";
}

export default function StatusPill({ label, tone = undefined, className = "" }) {
  const key = TONES[tone] ? tone : toneFor(label);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-display font-bold uppercase tracking-widest whitespace-nowrap",
        TONES[key],
        className,
      )}
    >
      {label}
    </span>
  );
}