import React from "react";
import { Cpu, Server, MonitorSmartphone } from "lucide-react";

const DOT = {
  ok: "bg-primary",
  warn: "bg-gold",
  bad: "bg-destructive",
};

function Dot({ tone }) {
  return <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[tone] || DOT.warn}`} />;
}

function Panel({ icon: Icon, title, note, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold tracking-wide">{title}</h3>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{note}</p>
      <div className="mt-3 space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ tone = "warn", label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Dot tone={tone} />
      <span className="min-w-0 flex-1 text-[11px]">
        <span className="font-medium">{label}</span>
        {value ? <span className="text-muted-foreground"> · {value}</span> : null}
      </span>
    </div>
  );
}

/**
 * What the last cycle actually read, side by side: the engine fleet, the Railway
 * project and the paired machine. A tile with no reading says so rather than
 * showing zero, which would read as "healthy".
 */
export default function ProbeGrid({ cycle }) {
  const observed = cycle?.observed || {};
  const engines = observed.engines || [];
  const railway = observed.railway || {};
  const machine = observed.machine || {};
  const gateway = machine.gateway || {};
  const worstDisk = Math.max(0, ...(machine.disk || []).map((entry) => entry.use_pct));

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Panel icon={Cpu} title="Browser engines" note={`${engines.length} configured`}>
        {engines.length === 0 ? (
          <Row tone="warn" label="No engine reading" value="ENGINE_URL may not be configured" />
        ) : engines.map((engine) => (
          <Row
            key={engine.url}
            tone={engine.serving ? "ok" : engine.status === "degraded" ? "warn" : "bad"}
            label={engine.label}
            value={engine.serving ? "serving" : engine.status}
          />
        ))}
      </Panel>

      <Panel icon={Server} title="Railway project" note="service and deployment state">
        {railway.ok ? (
          <>
            <Row tone="ok" label={`${railway.services} service(s) read`} />
            <Row
              tone={railway.failed?.length ? "warn" : "ok"}
              label={railway.failed?.length ? `${railway.failed.length} failed deployment(s)` : "no failed deployments"}
              value={railway.failed?.length ? railway.failed.join(", ") : null}
            />
          </>
        ) : (
          <Row tone="bad" label="Project could not be read" value={railway.error || "unknown error"} />
        )}
      </Panel>

      <Panel icon={MonitorSmartphone} title="Paired machine" note={machine.device || "Desktop Commander bridge"}>
        {!machine.connected ? (
          <Row tone="warn" label="Not read this cycle" value={machine.paired ? `device status: ${machine.status}` : "no machine paired"} />
        ) : (
          <>
            <Row
              tone={gateway.running && gateway.health_ok ? "ok" : "bad"}
              label={gateway.running ? `OpenClaw gateway up ${gateway.uptime || ""}`.trim() : "gateway not running"}
              value={gateway.version ? `v${gateway.version}` : null}
            />
            <Row
              tone={gateway.loopback_only ? "ok" : "bad"}
              label={gateway.loopback_only ? "bound to loopback only" : "listening beyond loopback"}
              value={gateway.bind?.[0] || null}
            />
            {worstDisk > 0 ? <Row tone={worstDisk >= 85 ? "warn" : "ok"} label={`disk use ${worstDisk}%`} /> : null}
            {machine.memory ? <Row tone={machine.memory.used_pct >= 92 ? "warn" : "ok"} label={`memory use ${machine.memory.used_pct}%`} /> : null}
            {gateway.user ? <Row tone="ok" label={`gateway runs as ${gateway.user}`} /> : null}
            {machine.partial_reading ? <Row tone="warn" label="partial reading" value="the probe did not finish" /> : null}
          </>
        )}
      </Panel>
    </div>
  );
}