import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertCircle, Rocket, ListChecks, ShieldCheck } from "lucide-react";

/**
 * Talk to the assistant in plain words. Before it acts, the same prompt
 * enhancement engine used by the service pages turns the sentence into a work
 * brief — so the agents are never asked to act on a half-formed request.
 */
export default function CommandConsole({ onQueueChanged }) {
  const [brief, setBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [command, setCommand] = useState("");
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const getBrief = async () => {
    setBriefLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("executiveAssistant", { action: "brief" });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setBrief(data.brief);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Could not get the operating brief.");
    } finally {
      setBriefLoading(false);
    }
  };

  const send = async () => {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await base44.functions.invoke("executiveAssistant", { action: "command", sentence: command });
      const data = res?.data || res;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      onQueueChanged?.();
    } catch (err) {
      // Show what was actually refused rather than the bare HTTP status, so a
      // permission refusal reads as a permission refusal.
      setError(err?.response?.data?.error || err?.message || "The assistant could not act on that.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-primary/20 bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold tracking-wide">Command the assistant</h3>
          <Button size="sm" variant="outline" className="ml-auto" onClick={getBrief} disabled={briefLoading}>
            {briefLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
            Operating brief
          </Button>
        </div>

        <textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          rows={3}
          placeholder="Tell it what to run or chase. Example: follow up with the Phoenix owners from last week's run and schedule the calls."
          className="xa-input resize-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={send} disabled={!command.trim() || sending}>
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Rocket className="h-3 w-3" />}
            Enhance &amp; execute
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Your sentence is enhanced into a brief first, then queued to named agents
          </span>
        </div>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {brief && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h4 className="font-display text-sm font-semibold tracking-wide">{brief.headline}</h4>
          <BriefList title="Running well" items={brief.doing_well} tone="ok" />
          <BriefList title="Needs attention" items={brief.needs_attention} tone="bad" />
          <BriefList title="Next actions" items={brief.next_actions} tone="ok" />
          <BriefList title="Decisions only you can make" items={brief.decisions_required} tone="warn" />
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-sm text-foreground/90">{result.reply}</p>

          {result.launched_run && (
            <div className="mt-2 rounded-lg border border-border/50 bg-card p-2.5 text-[11px]">
              <span className="font-semibold">Service run launched:</span>{" "}
              {result.launched_run.error
                ? `failed — ${result.launched_run.error}`
                : `${result.launched_run.verdict} at ${result.launched_run.score}/100 · delivery ${result.launched_run.delivery_allowed ? "permitted" : "not permitted"}`}
            </div>
          )}

          {result.tasks_created?.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                <ListChecks className="h-3 w-3" />
                Queued to agents — nothing left for you to do manually
              </div>
              <ul className="space-y-1">
                {result.tasks_created.map((t) => (
                  <li key={t.id} className="text-[11px] text-foreground/85">
                    <span className="font-medium">{t.owner_agent}</span> · {t.title}{" "}
                    <span className="text-muted-foreground">({t.kind} / {t.channel})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.open_questions?.length > 0 && (
            <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 p-2.5">
              <div className="mb-1 text-[11px] font-semibold text-gold">Answer these and the assistant proceeds</div>
              <ul className="ml-4 list-disc space-y-0.5 text-[11px] text-foreground/80">
                {result.open_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {result.enhanced_prompt && (
            <details className="mt-3">
              <summary className="cursor-pointer text-[11px] text-primary">The brief it worked from</summary>
              <p className="mt-1.5 whitespace-pre-wrap text-[11px] text-foreground/85">{result.enhanced_prompt}</p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function BriefList({ title, items, tone }) {
  if (!items?.length) return null;
  const color = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-gold" : "text-primary";
  return (
    <div className="mt-3">
      <div className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${color}`}>{title}</div>
      <ul className="mt-1 ml-4 list-disc space-y-0.5 text-xs text-foreground/85">
        {items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}