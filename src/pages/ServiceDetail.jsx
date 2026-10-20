import { useState, useEffect, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useServiceCatalog } from "@/hooks/useServiceCatalog";
import { serviceIcon, groupStyle } from "@/components/services/serviceIcons";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import PromptIntake from "@/components/services/PromptIntake";
import WorkflowSteps from "@/components/services/WorkflowSteps";
import AgentSquadPanel from "@/components/services/AgentSquadPanel";
import RunHistoryPanel from "@/components/services/RunHistoryPanel";
import ServiceFacts from "@/components/services/ServiceFacts";

/**
 * One page per service. Everything the operator needs to see at once: the
 * numbered production workflow, the agent squad that runs it, the pricing and
 * deliverables the market expects, and the live monitoring of every run.
 */
export default function ServiceDetail() {
  const { slug } = useParams();
  const { services, loading: catalogLoading, error: catalogError, serviceFor } = useServiceCatalog();
  const service = serviceFor(slug);

  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadRuns = useCallback(async () => {
    if (!slug) return;
    setRunsLoading(true);
    try {
      const page = await base44.entities.ServiceRun.filter(
        { service_slug: slug },
        { sort: "-created_date", limit: 10 },
      );
      setRuns(page?.items || (Array.isArray(page) ? page : []));
    } catch (err) {
      setError(err?.message || "Could not load this service's run history.");
    } finally {
      setRunsLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  if (catalogLoading) {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading service…
      </div>
    );
  }

  if (catalogError || (!service && services.length > 0)) {
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <AlertCircle className="mx-auto h-6 w-6 text-destructive" />
        <p className="text-sm text-destructive">
          {catalogError || `No service matches "${slug}".`}
        </p>
        <Link to="/dashboard" className="text-xs text-primary hover:underline">
          Back to the dashboard
        </Link>
      </div>
    );
  }

  if (!service) return null;

  const Icon = serviceIcon(service.icon);
  const style = groupStyle(service.group);
  const latest = runs[0] || null;

  return (
    <div className="space-y-4">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" />
        All services
      </Link>

      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
        <div className={`absolute left-0 top-0 h-full w-1 ${style.bar} opacity-70`} />
        <div className="flex items-start gap-4 pl-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] ${style.chip}`}>
                {service.group}
              </span>
              <span className="text-[11px] text-muted-foreground">{service.workflow.length} steps · {service.agents.length} agents</span>
            </div>
            <h1 className="mt-1 font-heading text-xl font-bold tracking-wide">{service.name}</h1>
            <p className="mt-0.5 text-xs text-primary/80">{service.tagline}</p>
            <p className="mt-2 max-w-3xl text-xs text-muted-foreground">{service.summary}</p>
          </div>
        </div>
      </div>

      <PromptIntake service={service} onRunComplete={loadRuns} />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <WorkflowSteps service={service} run={latest} />
          <ServiceFacts service={service} />
        </div>
        <div className="space-y-3">
          <AgentSquadPanel service={service} run={latest} />
          <RunHistoryPanel runs={runs} loading={runsLoading} />
        </div>
      </div>
    </div>
  );
}