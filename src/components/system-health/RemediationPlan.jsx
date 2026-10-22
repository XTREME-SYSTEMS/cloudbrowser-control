import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SEVERITY_TONE = {
  P0: "border-destructive/40 bg-destructive/10 text-destructive",
  P1: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  P2: "border-border bg-secondary text-muted-foreground",
};

/**
 * The QA report already ranks every issue it found. This is that ranking, in the
 * order it must be worked, with the fix the report states for each one.
 */
/**
 * A failure narrative can carry a whole stack trace — one engine issue arrives
 * with ~90KB of launch log attached. The first line is the part that says what
 * broke, so that is what is shown, and the rest stays reachable in the tooltip
 * rather than flooding the page.
 */
const leadLine = (text, max = 280) => {
  if (typeof text !== "string" || text.length === 0) return "";
  const first = text.split("\n")[0].trim();
  return first.length > max ? `${first.slice(0, max)}…` : first;
};

export default function RemediationPlan({ plan }) {
  if (!plan?.length) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">What to fix next</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">{plan.length} ranked issue(s)</span>
      </div>

      <ol className="mt-3 space-y-2">
        {plan.map((issue, i) => (
          <li key={`${issue.severity || "issue"}-${i}`} className="rounded-lg border border-border/60 bg-secondary/20 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={SEVERITY_TONE[issue.severity] || SEVERITY_TONE.P2}>{issue.severity || "P?"}</Badge>
              <span className="text-[11px] font-medium">{issue.category || issue.suite || "System"}</span>
              {issue.engine && <span className="text-[11px] text-muted-foreground">{issue.engine}</span>}
              {issue.test && <span className="text-[11px] text-muted-foreground">{issue.test}</span>}
              {issue.capability && <span className="text-[11px] text-muted-foreground">{issue.capability}</span>}
            </div>
            <p className="mt-1 text-xs" title={issue.issue || issue.detail || issue.gap || ""}>
              {leadLine(issue.issue || issue.detail || issue.gap)}
            </p>
            {issue.fix && (
              <p className="mt-1 text-[11px] text-primary" title={issue.fix}>
                {leadLine(issue.fix, 400)}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}