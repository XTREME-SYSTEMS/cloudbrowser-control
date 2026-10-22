import { Link } from "react-router-dom";
import { ChevronRight, Plug } from "lucide-react";

/**
 * The consoles that already exist behind this one. They were built and then lost
 * their routes, so nothing could reach them — these links put them back on the map.
 */
const CONSOLES = [
  { to: "/auto-heal", label: "Auto-Heal", note: "Infrastructure remediation log and its on/off switch" },
  { to: "/test-results", label: "Test Results", note: "Stored results from every suite that has run" },
  { to: "/forensic-audit", label: "Forensic Audit", note: "Scored proof suite with per-check evidence" },
  { to: "/capability-lab", label: "Capability Lab", note: "Press a capability and watch it tested" },
  { to: "/enhancements", label: "Enhancements", note: "Architecture goals and their audit scores" },
  { to: "/audit-logs", label: "Audit Logs", note: "Every recorded system action" },
  { to: "/errors", label: "Error Patterns", note: "Known failure shapes and their frequency" },
  { to: "/schedules", label: "Schedules", note: "What runs on a timer and when it last ran" },
  { to: "/costs", label: "Costs", note: "Spend recorded against runs and jobs" },
  { to: "/architecture", label: "Architecture", note: "The system's own health and heartbeat view" },
];

export default function OpsDeepLinks() {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Plug className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">Every operations console</h2>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {CONSOLES.map(({ to, label, note }) => (
          <Link
            key={to}
            to={to}
            className="flex items-start gap-2 rounded-lg border border-border/60 bg-secondary/20 p-2.5 transition-all hover:border-primary/40 hover:bg-muted/40"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-medium">{label}</span>
              <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">{note}</span>
            </span>
            <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </section>
  );
}