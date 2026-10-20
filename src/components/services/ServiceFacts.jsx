import { Badge } from "@/components/ui/badge";
import { DollarSign, Package, Rocket, Activity, Building2, AlertCircle, CheckCircle2 } from "lucide-react";

const VERIFICATION_LABEL = {
  verified_primary_source: { text: "primary source", className: "border-primary/30 bg-primary/10 text-primary" },
  secondary_source: { text: "secondary source", className: "border-chart-5/30 bg-chart-5/10 text-chart-5" },
  vendor_claim_unverified: { text: "vendor claim — unverified", className: "border-gold/40 bg-gold/10 text-gold" },
};

/**
 * What the target market expects: the price band, the deliverables, how a
 * client actually starts, how the service is monitored, and the competitors
 * this service is measured against — with every vendor claim labelled as one.
 */
export default function ServiceFacts({ service }) {
  const p = service.pricing;
  return (
    <div className="space-y-3">
      <Block icon={DollarSign} title="Pricing of record">
        <div className="grid gap-2 sm:grid-cols-3">
          <Fact label="Model" value={p.model} />
          <Fact label="Typical market range" value={p.range} />
          <Fact label="Charged" value={p.unit} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{p.notes}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Ranges are gathered from published competitor pricing, not from this platform's own rate card.
        </p>
      </Block>

      <Block icon={Package} title="Deliverables the buyer should expect">
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {service.deliverables.map((d) => (
            <li key={d} className="flex items-start gap-2 text-xs text-foreground/85">
              <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
              {d}
            </li>
          ))}
        </ul>
      </Block>

      <Block icon={Rocket} title="How a client starts">
        <ol className="space-y-1.5">
          {service.initiation.map((step, i) => (
            <li key={step} className="flex gap-2 text-xs text-foreground/85">
              <span className="font-display text-[11px] font-bold text-primary">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </Block>

      <Block icon={Activity} title="Monitoring built into the service">
        <div className="grid gap-2 sm:grid-cols-2">
          <Fact label="Cadence" value={service.monitoring.cadence} />
          <Fact label="Signals watched" value={service.monitoring.signals.join(" · ")} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <AlertCircle className="h-3 w-3 text-destructive" />
          {service.monitoring.alerts.map((a) => (
            <span key={a} className="rounded-full border border-destructive/25 bg-destructive/5 px-2 py-0.5 text-[10px] text-destructive">
              {a}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Who buys this: {service.buyer}
        </p>
      </Block>

      <Block icon={Building2} title="Benchmarked against">
        <div className="space-y-2">
          {service.benchmarks.map((b) => {
            const label = VERIFICATION_LABEL[b.verification] || VERIFICATION_LABEL.vendor_claim_unverified;
            return (
              <div key={b.company} className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-[12px] font-semibold tracking-wide">{b.company}</span>
                  <Badge className={label.className}>{label.text}</Badge>
                </div>
                <p className="mt-1 text-[11px] text-foreground/85">{b.how_they_run}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Price signal: {b.price_signal}</p>
              </div>
            );
          })}
        </div>
        {service.sources?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {service.sources.map((url) => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline">
                {url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            ))}
          </div>
        )}
      </Block>
    </div>
  );
}

function Block({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-display text-sm font-semibold tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div className="rounded-md border border-border/50 bg-secondary/30 p-2">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[11px] text-foreground/85">{value}</div>
    </div>
  );
}