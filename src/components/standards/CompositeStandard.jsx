import React from "react";
import SectionCard from "@/components/standards/SectionCard";
import { BENCHMARKED_AI_VENDORS, COMPOSITE_STANDARD, AI_BENCHMARK_FIELD_NOTE } from "@/data/standardsPlaybook";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Crown } from "lucide-react";

export default function CompositeStandard() {
  return (
    <SectionCard
      id="composite"
      eyebrow="Section 2"
      title="Chosen standard — strictest of the benchmarked AI companies"
      subtitle="The top-rated AI browser-infrastructure companies were benchmarked dimension by dimension. Rather than adopting one vendor wholesale, the operating standard takes the most stringent position available on each dimension and names where it came from."
    >
      <div className="grid gap-3 lg:grid-cols-3 mb-7">
        {BENCHMARKED_AI_VENDORS.map((v) => (
          <div key={v.name} className="rounded-xl border border-border bg-background/40 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              {v.rank === 1 && <Crown className="w-3.5 h-3.5 text-primary shrink-0" />}
              <h3 className="font-heading font-semibold text-sm">{v.name}</h3>
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">#{v.rank}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">{v.positioning}</p>

            <p className="text-[10px] font-display font-bold uppercase tracking-widest text-primary/70 mb-1.5">
              Wins on
            </p>
            <ul className="space-y-1 mb-3">
              {v.strengths.map((s) => (
                <li key={s} className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                  <span className="w-1 h-1 rounded-full bg-emerald-500/70 mt-1.5 shrink-0" />
                  {s}
                </li>
              ))}
            </ul>

            <p className="text-[10px] font-display font-bold uppercase tracking-widest text-destructive/70 mb-1.5">
              Falls short on
            </p>
            <ul className="space-y-1 mb-3">
              {v.gaps.map((g) => (
                <li key={g} className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                  <span className="w-1 h-1 rounded-full bg-destructive/60 mt-1.5 shrink-0" />
                  {g}
                </li>
              ))}
            </ul>

            {v.source_url && (
              <a
                href={v.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Source
              </a>
            )}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed mb-6">{AI_BENCHMARK_FIELD_NOTE}</p>

      <h3 className="font-heading font-semibold text-sm mb-3">
        The composite standard — adopted rule per dimension
      </h3>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium">Dimension</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Taken from</th>
              <th className="px-3 py-2 font-medium">Rule we operate to</th>
            </tr>
          </thead>
          <tbody>
            {COMPOSITE_STANDARD.map((c) => (
              <tr key={c.dimension} className="border-t border-border align-top">
                <td className="px-3 py-2.5 font-medium">
                  {c.dimension}
                  <Badge className="ml-2 align-middle bg-primary/10 text-primary border-primary/30 text-[9px]">
                    {c.basis}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{c.winner}</td>
                <td className="px-3 py-2.5 text-muted-foreground leading-relaxed">{c.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
        <p className="text-xs font-medium mb-1.5">
          Why no vendor's published benchmark was adopted
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Published agent leaderboards are demonstrably gameable. A published exploit reached roughly 100% on
          WebArena (812 tasks) through configuration leakage, DOM injection and prompt injection, and roughly
          98% on GAIA (165 tasks) through leaked answers and normalization collisions, in both cases without
          doing the work. Normalization is loose enough that a fully letter-spaced answer still matches its
          ground truth. Separately, the AgentAtlas audit notes that outcome-only web-agent benchmarks do not
          label act, ask, refuse and stop behaviour, nor safety constraints. The consequence for this
          standard: reliability figures come from our own case-outcome ledger, never from a leaderboard.
        </p>
      </div>
    </SectionCard>
  );
}