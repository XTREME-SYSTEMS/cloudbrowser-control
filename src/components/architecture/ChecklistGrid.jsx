import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Loader2, AlertTriangle, Circle, Target, Wrench } from "lucide-react";

const STATUS_CONFIG = {
  pending: { icon: Circle, color: "text-muted-foreground", bg: "bg-muted", label: "Pending" },
  in_progress: { icon: Loader2, color: "text-amber-500", bg: "bg-amber-500/10", label: "In Progress" },
  implemented: { icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/10", label: "Implemented" },
  auditing: { icon: Loader2, color: "text-purple-500", bg: "bg-purple-500/10", label: "Auditing" },
  audited: { icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/10", label: "Audited" },
  optimized: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Optimized" },
  failed: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Failed" },
  blocked: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10", label: "Blocked" },
};

const CATEGORY_LABELS = {
  hardening: "Hardening",
  competitive: "Competitive",
  reliability: "Reliability",
  observability: "Observability",
  dx: "Developer Experience",
  proxy_captcha: "Proxy & Captcha",
};

function ChecklistItem({ item }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
  const score = item.audit_result?.score || 0;
  const StatusIcon = cfg.icon;

  return (
    <div className={"rounded-lg border transition-all " + (expanded ? "border-primary/40 shadow-md" : "border-border")}>
      <button onClick={() => setExpanded(!expanded)} className="w-full p-3 flex items-center gap-3 text-left">
        <div className={"w-8 h-8 rounded-full flex items-center justify-center shrink-0 " + cfg.bg}>
          <StatusIcon className={"w-4 h-4 " + cfg.color + (item.status === "in_progress" || item.status === "auditing" ? " animate-spin" : "")} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground truncate">{CATEGORY_LABELS[item.category] || item.category} · {cfg.label}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={"h-full rounded-full " + (score >= 100 ? "bg-emerald-500" : score >= 75 ? "bg-amber-500" : score >= 50 ? "bg-blue-500" : "bg-red-500")} style={{ width: score + "%" }} />
          </div>
          <span className="text-xs font-bold w-8 text-right">{score}</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">{item.description}</p>

          <div>
            <p className="text-xs font-semibold mb-1 flex items-center gap-1"><Target className="w-3 h-3" />Acceptance Criteria</p>
            <ul className="space-y-1">
              {(item.acceptance_criteria || []).map((c, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span className={"mt-0.5 " + (score >= 100 ? "text-emerald-500" : "text-muted-foreground")}>
                    {score >= 100 ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>

          {item.audit_result?.failures?.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1 text-red-500">Failures</p>
              <ul className="space-y-1">
                {item.audit_result.failures.map((f, i) => (
                  <li key={i} className="text-xs text-red-500 flex items-start gap-1"><XCircle className="w-3 h-3 mt-0.5 shrink-0" />{f}</li>
                ))}
              </ul>
            </div>
          )}

          {item.implementation_notes && (
            <div>
              <p className="text-xs font-semibold mb-1 flex items-center gap-1"><Wrench className="w-3 h-3" />Implementation Notes</p>
              <p className="text-xs text-muted-foreground">{item.implementation_notes}</p>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Layer: <Badge variant="outline" className="text-xs">{item.target_layer}</Badge></span>
            <span>Priority: P{item.priority}</span>
            <span>Fix attempts: {item.fix_attempts}/{item.max_fix_attempts}</span>
            {item.auto_managed && <Badge variant="outline" className="text-xs">Auto-managed</Badge>}
          </div>

          {item.blocked_reason && (
            <p className="text-xs text-orange-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{item.blocked_reason}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ChecklistGrid({ goals, filter, setFilter }) {
  const categories = ["all", "hardening", "competitive", "reliability", "observability", "dx", "proxy_captcha"];
  const filtered = filter === "all" ? goals : goals.filter((g) => g.category === filter);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle>Architecture Checklist — Maxed-Out Goal</CardTitle>
            <CardDescription>{filtered.length} goals · Agent reference point for optimization</CardDescription>
          </div>
          <div className="flex gap-1 flex-wrap">
            {categories.map((c) => (
              <Button key={c} size="sm" variant={filter === c ? "default" : "outline"} onClick={() => setFilter(c)} className="text-xs">
                {c === "all" ? "All" : CATEGORY_LABELS[c] || c}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <AlertTriangle className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No architecture goals found.</p>
            <p className="text-xs text-muted-foreground">Use Vision Cortex → "Seed Goals" to initialize the maxed-out checklist.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => (
              <ChecklistItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}