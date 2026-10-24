import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bot, ExternalLink, Play, RefreshCw, ShieldCheck } from "lucide-react";
import ProbeGrid from "@/components/openclaw/ProbeGrid";
import GuardianQueue from "@/components/openclaw/GuardianQueue";
import CycleReport from "@/components/openclaw/CycleReport";
import PolicyTable from "@/components/openclaw/PolicyTable";

const ROLES = [
  { to: "/agents/openclaw_operator", label: "Operator" },
  { to: "/agents/openclaw_guardian", label: "Guardian" },
  { to: "/agents/openclaw_validator", label: "Validator" },
];

/**
 * The OpenClaw autonomy console: read the last cycle, decide what the guardian
 * queued, and switch the unsupervised parts on or off.
 */
export default function OpenClawCommand() {
  const [status, setStatus] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [statusRes, policyRes] = await Promise.all([
      base44.functions.invoke("openClawAgent", { action: "status" }),
      base44.functions.invoke("openClawAgent", { action: "policy" }),
    ]);
    setStatus(statusRes.data);
    setPolicy(policyRes.data);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.response?.data?.error || err.message));
  }, [load]);

  const call = async (payload, label) => {
    setBusy(label);
    setError("");
    try {
      const res = await base44.functions.invoke("openClawAgent", payload);
      await load();
      return res.data;
    } catch (err) {
      setError(err.response?.data?.reason || err.response?.data?.error || err.message);
      return null;
    } finally {
      setBusy("");
    }
  };

  const settings = status?.settings || {};
  const latest = status?.cycles?.[0] || null;
  const pending = status?.pending || [];

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-1 py-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-2xl">OpenClaw autonomy</h1>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Every 30 minutes it reads the engine fleet, the Railway project and your paired machine, repairs what it is allowed to repair,
            and has the result verified by a second model. Anything it is not allowed to do waits for you below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => call({ action: "cycle" }, "cycle")} disabled={Boolean(busy)}>
            <Play className="h-3.5 w-3.5" /> {busy === "cycle" ? "Running a cycle…" : "Run a cycle now"}
          </Button>
          <Button
            variant="outline"
            disabled={Boolean(busy)}
            onClick={() => { setBusy("reload"); load().catch((err) => setError(err.response?.data?.error || err.message)).finally(() => setBusy("")); }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reload
          </Button>
        </div>
      </header>

      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-destructive">{error}</p>
      ) : null}

      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(settings.enabled)}
            disabled={Boolean(busy)}
            onCheckedChange={(value) => call({ action: "set_setting", key: "openclaw.enabled", value }, "enabled")}
          />
          <span className="text-[11px]">
            <span className="font-medium">Scheduled cycles</span>
            <span className="block text-[10px] text-muted-foreground">the 30-minute run</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={Boolean(settings.platform_autofix)}
            disabled={Boolean(busy)}
            onCheckedChange={(value) => call({ action: "set_setting", key: "openclaw.platform_autofix", value }, "autofix")}
          />
          <span className="text-[11px]">
            <span className="font-medium">Repair the platform unattended</span>
            <span className="block text-[10px] text-muted-foreground">off means every platform repair waits for you</span>
          </span>
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground">
          machine: {status?.device?.device_name || status?.device?.status || "unknown"}
        </span>
      </section>

      <ProbeGrid cycle={latest} />
      <GuardianQueue
        pending={pending}
        busy={busy}
        onDecide={(approval, approved) => call({
          action: approved ? "approve" : "reject",
          cycle_id: approval.cycle_id,
          approval_id: approval.id,
        }, approved ? "approve" : "reject")}
      />
      <CycleReport cycle={latest} />
      <PolicyTable policy={policy} busy={busy} onRun={(actionId) => call({ action: "run", action_id: actionId }, actionId)} />

      <section className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        <Bot className="h-4 w-4 text-primary" />
        <span className="text-[11px] font-medium">Talk to the three roles</span>
        {ROLES.map((role) => (
          <Link key={role.to} to={role.to} className="text-[11px] text-primary underline-offset-4 hover:underline">
            {role.label}
          </Link>
        ))}
        <Link to="/system-health" className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
          System health console <ExternalLink className="h-3 w-3" />
        </Link>
      </section>
    </div>
  );
}