import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Globe, FlaskConical, Layers, CheckCircle2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TIERS = [
  {
    key: "llm",
    label: "Tier 1: LLM Search",
    icon: Brain,
    desc: "AI-powered web search via InvokeLLM — highest quality, requires integration credits",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  {
    key: "direct_scrape",
    label: "Tier 2: Direct Scrape",
    icon: Globe,
    desc: "Direct HTTP scraping with regex pattern extraction — no credits needed, works when LLM fails",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  {
    key: "mock",
    label: "Tier 3: Mock Engine",
    icon: FlaskConical,
    desc: "Synthetic data generation — always works, for testing and credit-exhausted fallback",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
];

export default function FallbackIndicator() {
  const [lastTier, setLastTier] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadLastTier = useCallback(async () => {
    try {
      const tasks = await base44.entities.SwarmTask.list("-updated_date", 10);
      const completed = tasks.filter((t) => t.status === "completed" && t.result_data?.tier_used);
      if (completed.length > 0) {
        setLastTier(completed[0].result_data.tier_used);
      }
    } catch (err) {
      console.error("Failed to load fallback tier:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLastTier(); }, [loadLastTier]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gold-gradient flex items-center justify-center">
            <Layers className="w-5 h-5 text-black" />
          </div>
          <div>
            <CardTitle>Fallback Technology Stack</CardTitle>
            <CardDescription>Multi-tier fallback — the system keeps running when the original tech fails</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="p-3 rounded-lg bg-muted/50 border border-dashed">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Answer to "what works when original tech fails":</strong>{" "}
            Yes — the fallback engine tries LLM search first, then direct HTTP scraping
            (no credits needed), then mock synthetic data. The system never stops.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TIERS.map((tier) => {
            const isActive = lastTier === tier.key;
            const Icon = tier.icon;
            return (
              <div key={tier.key} className={"p-3 rounded-lg border transition-all " + (isActive ? tier.border + " shadow-md" : "border-border")}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={"w-8 h-8 rounded-lg flex items-center justify-center " + tier.bg}>
                    <Icon className={"w-4 h-4 " + tier.color} />
                  </div>
                  <span className="text-sm font-medium">{tier.label}</span>
                  {isActive && (
                    <Badge variant="outline" className="text-xs ml-auto">
                      <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" /> Active
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tier.desc}</p>
              </div>
            );
          })}
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground text-center">Checking last used tier...</p>
        ) : lastTier ? (
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-muted-foreground">
              Last skip trace used: <strong className="text-foreground">{TIERS.find((t) => t.key === lastTier)?.label || lastTier}</strong>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-muted-foreground">No skip traces run yet — tier will be selected automatically on first run.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}