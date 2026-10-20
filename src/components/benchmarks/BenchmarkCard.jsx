import React from "react";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, AlertTriangle, CheckCircle2 } from "lucide-react";

const PRIORITY_STYLES = {
  P0: "bg-destructive/10 text-destructive border-destructive/30",
  P1: "bg-primary/10 text-primary border-primary/30",
  P2: "bg-muted text-muted-foreground border-border",
};

const SOURCE_STYLES = {
  verified_primary_source: {
    label: "Primary source",
    className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
  secondary_source: {
    label: "Secondary source",
    className: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  },
  vendor_claim_unverified: {
    label: "Vendor claim — unverified",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export default function BenchmarkCard({ benchmark }) {
  const source = SOURCE_STYLES[benchmark.verification_status] ?? SOURCE_STYLES.vendor_claim_unverified;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-heading font-bold text-base leading-snug">{benchmark.title}</h3>
          {benchmark.authority && (
            <p className="text-xs text-muted-foreground mt-1">{benchmark.authority}</p>
          )}
          {benchmark.citation && (
            <p className="text-[11px] font-mono text-muted-foreground/80 mt-0.5">{benchmark.citation}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge className={PRIORITY_STYLES[benchmark.priority] ?? PRIORITY_STYLES.P1}>
            {benchmark.priority || "P1"}
          </Badge>
          <Badge className={source.className}>{source.label}</Badge>
        </div>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <p className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">
            Requirement
          </p>
          <p className="text-foreground/90 leading-relaxed">{benchmark.requirement}</p>
        </div>

        {benchmark.our_target && (
          <div className="flex gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">
                Our target
              </p>
              <p className="text-muted-foreground leading-relaxed">{benchmark.our_target}</p>
            </div>
          </div>
        )}

        {benchmark.our_gap && (
          <div className="flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground/70 mb-1">
                Gap / status
              </p>
              <p className="text-muted-foreground leading-relaxed">{benchmark.our_gap}</p>
            </div>
          </div>
        )}
      </div>

      {benchmark.source_url && (
        <a
          href={benchmark.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-4"
        >
          <ExternalLink className="w-3 h-3" /> Read the source
        </a>
      )}
    </div>
  );
}