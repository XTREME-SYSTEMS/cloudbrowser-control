import { Loader2, ShieldCheck, HeartPulse, Wrench, Archive } from "lucide-react";

const ACTIONS = [
  {
    key: "qa",
    label: "Run QA validation",
    hint: "Every validation suite, engine health, the capability matrix and the visual check — measured and scored now.",
    icon: ShieldCheck,
  },
  {
    key: "heal",
    label: "Run self-heal cycle",
    hint: "Re-tests failing goals, audits each one for root cause, and opens or updates a healing flag with the finding.",
    icon: HeartPulse,
  },
  {
    key: "infra",
    label: "Heal infrastructure",
    hint: "Redeploys failed or stuck services and fails over a browser engine that is down.",
    icon: Wrench,
  },
  {
    key: "archive",
    label: "Archive and start fresh",
    hint: "Preserves finished results in the archive ledger, then clears them from the live system.",
    icon: Archive,
  },
];

/** The four things an operator actually presses. Each one is wired to a real call. */
export default function OperationsBar({ busy, onRun }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ACTIONS.map(({ key, label, hint, icon: Icon }) => (
        <button
          key={key}
          type="button"
          disabled={Boolean(busy)}
          onClick={() => onRun(key)}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <span className="mt-0.5 shrink-0 rounded-lg bg-primary/10 p-1.5 text-primary">
            {busy === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold tracking-wide">{label}</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{hint}</span>
          </span>
        </button>
      ))}
    </div>
  );
}