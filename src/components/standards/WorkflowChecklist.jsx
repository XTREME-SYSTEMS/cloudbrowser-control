import { useState, useEffect } from "react";
import SectionCard from "@/components/standards/SectionCard";
import { Button } from "@/components/ui/button";
import { WORKFLOW_STEPS, WORKFLOW_PHASES } from "@/data/standardsPlaybook";
import { CheckCircle2, Circle, RotateCcw } from "lucide-react";

const STORAGE_KEY = "cloudbrowser.workflow-checklist.v1";

function loadDone() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function WorkflowChecklist() {
  const [done, setDone] = useState(loadDone);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
    } catch {
      // storage unavailable — checklist still works for this session
    }
  }, [done]);

  const toggle = (n) => setDone((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  const pct = Math.round((done.length / WORKFLOW_STEPS.length) * 100);

  return (
    <SectionCard
      id="workflow"
      eyebrow="Section 3"
      title="End-to-end workflow checklist"
      subtitle="The full pipeline, step by step, with the gate that must pass before the step can be considered done. Tick steps as you work a case — progress is saved on this device."
    >
      <div className="flex items-center gap-4 mb-5">
        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
          {done.length}/{WORKFLOW_STEPS.length} · {pct}%
        </span>
        <Button variant="ghost" size="sm" onClick={() => setDone([])} disabled={done.length === 0}>
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
        </Button>
      </div>

      <div className="space-y-5">
        {WORKFLOW_PHASES.map((phase, pi) => {
          const steps = WORKFLOW_STEPS.filter((s) => s.phase === pi);
          return (
            <div key={phase}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-display font-bold uppercase tracking-[0.2em] text-primary/80">
                  {phase}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-2">
                {steps.map((s) => {
                  const checked = done.includes(s.n);
                  return (
                    <button
                      key={s.n}
                      onClick={() => toggle(s.n)}
                      className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                        checked
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-background/40 hover:border-primary/30"
                      }`}
                    >
                      <div className="flex gap-3">
                        {checked ? (
                          <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-medium ${checked ? "text-muted-foreground" : "text-foreground"}`}>
                            <span className="font-mono text-[11px] text-muted-foreground mr-2">
                              {String(s.n).padStart(2, "0")}
                            </span>
                            {s.action}
                          </p>
                          <div className="mt-2 flex flex-col sm:flex-row gap-1 sm:gap-4">
                            <p className="text-[11px] text-muted-foreground">
                              <span className="text-primary/80">Gate: </span>
                              {s.gate}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              <span className="text-primary/80">Artifact: </span>
                              {s.artifact}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}