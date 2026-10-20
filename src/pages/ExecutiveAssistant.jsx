import { useState } from "react";
import { Link } from "react-router-dom";
import CommandConsole from "@/components/assistant/CommandConsole";
import OpsQueue from "@/components/assistant/OpsQueue";
import AuditSummary from "@/components/assistant/AuditSummary";
import { Bot, ArrowLeft } from "lucide-react";

/**
 * The AI executive assistant: one place to operate the services, the outreach,
 * the follow-ups, the messaging, the scheduling and the monitoring — by
 * telling it what you want rather than by working the screens yourself.
 */
export default function ExecutiveAssistant() {
  const [queueKey, setQueueKey] = useState(0);

  return (
    <div className="space-y-4">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        Dashboard
      </Link>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-wide">AI Executive Assistant</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              It runs the production services, queues the outreach and follow-ups to named agents, watches every delivery gate, and escalates only the decisions that are genuinely yours. Nothing here asks you to do the work by hand.
            </p>
          </div>
        </div>
      </div>

      <CommandConsole onQueueChanged={() => setQueueKey((k) => k + 1)} />

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <OpsQueue refreshKey={queueKey} />
        </div>
        <div className="lg:col-span-2">
          <AuditSummary />
        </div>
      </div>
    </div>
  );
}