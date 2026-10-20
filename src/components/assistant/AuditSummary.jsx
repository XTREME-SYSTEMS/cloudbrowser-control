import { Badge } from "@/components/ui/badge";
import { COMMS_AUDIT, COMMS_CAPABILITIES } from "@/data/commsAudit";
import { FileSearch, ShieldAlert, PackageCheck, Radio } from "lucide-react";

const SEVERITY_CLASS = {
  P0: "border-destructive/40 bg-destructive/10 text-destructive",
  P1: "border-gold/40 bg-gold/10 text-gold",
  P2: "border-border/60 text-muted-foreground",
};

const STATUS_CLASS = {
  "Queueable now": "border-primary/30 bg-primary/10 text-primary",
  Live: "border-primary/30 bg-primary/10 text-primary",
  "Needs carrier credentials": "border-gold/40 bg-gold/10 text-gold",
  "Needs provider credentials": "border-gold/40 bg-gold/10 text-gold",
  "Needs agent seats": "border-border/60 text-muted-foreground",
  "Needs connector": "border-border/60 text-muted-foreground",
};

/**
 * What the communications package turned out to be, and what was taken from it.
 * Findings are stated with their evidence, because an audit that only lists
 * strengths is not an audit.
 */
export default function AuditSummary() {
  const p = COMMS_AUDIT.package;
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold tracking-wide">Forensic audit — {p.name}</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Files" value={p.files} />
          <Metric label="Entities" value={p.entities} />
          <Metric label="Backend functions" value={p.backend_functions} />
          <Metric label="Pages" value={p.pages} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{p.what_it_is}</p>
        <p className="mt-2 rounded-lg border border-border/50 bg-secondary/30 p-2.5 text-[11px] text-foreground/85">
          <span className="font-semibold">Verdict:</span> {COMMS_AUDIT.verdict}
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <h3 className="font-display text-sm font-semibold tracking-wide">Findings</h3>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {COMMS_AUDIT.findings.filter((f) => f.severity === "P0").length} critical
          </span>
        </div>
        <div className="space-y-2">
          {COMMS_AUDIT.findings.map((f) => (
            <div key={f.id} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={SEVERITY_CLASS[f.severity]}>{f.severity}</Badge>
                <span className="font-display text-[12px] font-semibold">{f.id}</span>
                <span className="text-[11px] text-muted-foreground">{f.area}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-foreground/85">{f.finding}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Evidence: {f.evidence}</p>
              <p className="mt-1 text-[11px] text-foreground/80">
                <span className="font-semibold text-primary">What we do about it:</span> {f.action}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <PackageCheck className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold tracking-wide">Absorbed into this platform</h3>
        </div>
        <div className="space-y-2">
          {COMMS_AUDIT.assets_absorbed.map((a) => (
            <div key={a.asset} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
              <div className="font-display text-[12px] font-semibold">{a.asset}</div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{a.what_it_does}</p>
              <p className="mt-1 text-[11px] text-foreground/85">
                <span className="font-semibold text-primary">Where it lands:</span> {a.where_it_maps}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold tracking-wide">Communications the assistant can operate</h3>
        </div>
        <div className="space-y-2">
          {COMMS_CAPABILITIES.map((c) => (
            <div key={c.name} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-secondary/30 p-2.5">
              <span className="font-display text-[12px] font-semibold">{c.name}</span>
              <Badge className={STATUS_CLASS[c.status] || STATUS_CLASS["Needs connector"]}>{c.status}</Badge>
              <span className="w-full text-[11px] text-muted-foreground">{c.capability}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          The carrier-dependent rows are stated as dependent rather than as working: no call, message or payment is reported as sent without a provider confirmation.
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-md border border-border/50 bg-secondary/30 p-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}