import React from "react";
import { Lock, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

function Group({ icon: Icon, title, note, children }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-[11px] font-semibold">{title}</h3>
        <span className="text-[10px] text-muted-foreground">{note}</span>
      </div>
      <div className="mt-2 space-y-1.5">{children}</div>
    </div>
  );
}

function Entry({ entry, onRun = null, busy = false, runnable = false }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium">{entry.label}</span>
        <span className="text-[10px] text-muted-foreground">{entry.id}</span>
        {runnable ? (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-6 px-2 text-[10px]"
            disabled={Boolean(busy)}
            onClick={() => onRun(entry.id)}
          >
            Run now
          </Button>
        ) : null}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{entry.why}</p>
    </div>
  );
}

/**
 * The guardian's catalogue, shown as the boundary it is: what runs unattended, what
 * waits for a person, and what is refused outright. Nothing outside this list can be
 * executed, so the table is a complete description of the system's authority.
 */
export default function PolicyTable({ policy, onRun, busy }) {
  const catalogue = policy?.catalogue || [];
  const automatic = catalogue.filter((entry) => entry.risk === "safe");
  const approval = catalogue.filter((entry) => entry.risk === "approval");
  const blocked = policy?.blocked || [];

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Lock className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-wide">What it may do</h2>
        <span className="text-[10px] text-muted-foreground">{policy?.policy_version}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          anything not listed here is refused
        </span>
      </div>

      <div className="mt-3 grid gap-5 lg:grid-cols-3">
        <Group icon={Zap} title="Automatic" note="reversible, with its own guards">
          {automatic.map((entry) => <Entry key={entry.id} entry={entry} onRun={onRun} busy={busy} runnable />)}
        </Group>

        <Group icon={ShieldCheck} title="Needs your approval" note="queued with the exact command">
          {approval.map((entry) => <Entry key={entry.id} entry={entry} onRun={onRun} busy={busy} runnable />)}
        </Group>

        <Group icon={Lock} title="Refused outright" note="never queued, only reported">
          {blocked.map((entry) => <Entry key={entry.id} entry={entry} />)}
        </Group>
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground">
        Two different model families review this: {policy?.guardian_model} may only refuse what the catalogue allows, and {policy?.validator_model} judges the evidence afterwards. If either review cannot run, nothing is applied.
      </p>
    </section>
  );
}