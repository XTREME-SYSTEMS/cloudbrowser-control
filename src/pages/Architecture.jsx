import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Building2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import ScoreHeader from "@/components/architecture/ScoreHeader";
import VisionCortexPanel from "@/components/architecture/VisionCortexPanel";
import ChecklistGrid from "@/components/architecture/ChecklistGrid";
import ValidationResults from "@/components/architecture/ValidationResults";
import HealthGauge from "@/components/architecture/HealthGauge";
import HealingStatusPanel from "@/components/architecture/HealingStatusPanel";
import FallbackIndicator from "@/components/architecture/FallbackIndicator";
import SystemHeartbeat from "@/components/architecture/SystemHeartbeat";

export default function Architecture() {
  const [goals, setGoals] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const loadData = useCallback(async () => {
    try {
      const [g, t] = await Promise.all([
        base44.entities.SystemEnhancement.list("-priority", 500),
        base44.entities.TestResult.list("-created_date", 200),
      ]);
      setGoals(g);
      setTestResults(t);
    } catch (err) {
      console.error("Failed to load architecture data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Compute health scores for the gauge
  const goalScores = goals.map((g) => g.audit_result?.score || 0);
  const architectureHealth = goals.length > 0
    ? Math.round(goalScores.reduce((a, b) => a + b, 0) / goals.length)
    : 0;
  const passingTests = testResults.filter((t) => t.status === "pass").length;
  const capabilityScore = testResults.length > 0
    ? Math.round((passingTests / testResults.length) * 100)
    : 0;

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2">
            <Building2 className="w-7 h-7" />Architecture
          </h1>
          <p className="text-muted-foreground mt-1">FAANG enterprise deep architecture — maxed-out goal with Vision Cortex auto-optimization</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-1" />Refresh
        </Button>
      </div>

      <SystemHeartbeat />

      <HealthGauge architectureHealth={architectureHealth} capabilityScore={capabilityScore} />

      <ScoreHeader goals={goals} testResults={testResults} />

      <VisionCortexPanel onAction={loadData} />

      <HealingStatusPanel />

      <FallbackIndicator />

      <ChecklistGrid goals={goals} filter={filter} setFilter={setFilter} />

      <ValidationResults results={testResults} />
    </div>
  );
}