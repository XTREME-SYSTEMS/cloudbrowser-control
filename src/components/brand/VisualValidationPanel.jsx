import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertCircle, CheckCircle, Zap } from "lucide-react";

export default function VisualValidationPanel() {
  const [validation, setValidation] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const runValidation = async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("runVisualValidation", {});
      const data = res.data || res;
      if (data.error) setError(data.error);
      else setValidation(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const scoreColor = (score) => score >= 80 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Visual Validation & QA
            </CardTitle>
            <CardDescription>Autonomous system validation with scoring</CardDescription>
          </div>
          <Button size="sm" onClick={runValidation} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
            {running ? "Running..." : "Run Validation"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive mb-3">{error}</p>}
        {!validation && !running && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Click "Run Validation" to score the system across infrastructure, quality, design, and integrations.
          </p>
        )}
        {running && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        {validation && (
          <div className="space-y-4">
            <div className="text-center p-4 rounded-lg bg-muted/30">
              <div className={`text-4xl font-heading font-bold ${scoreColor(validation.overall_score)}`}>
                {validation.overall_score}%
              </div>
              <p className="text-sm text-muted-foreground mt-1">Overall System Score</p>
              <div className="flex justify-center gap-4 mt-2 text-xs">
                <span className="text-green-500">{validation.passed} passed</span>
                <span className="text-red-500">{validation.failed} failed</span>
              </div>
            </div>
            {validation.categories?.map(cat => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{cat.name}</span>
                  <span className={scoreColor(cat.score_pct)}>{cat.score_pct}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gold-gradient rounded-full" style={{ width: `${cat.score_pct}%` }} />
                </div>
              </div>
            ))}
            {validation.recommendations?.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-destructive flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Issues to Fix ({validation.recommendations.length})
                </p>
                {validation.recommendations.map(rec => (
                  <div key={rec.id} className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                    <p className="text-sm font-medium">{rec.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{rec.detail}</p>
                    <p className="text-xs text-primary mt-1">→ {rec.action}</p>
                  </div>
                ))}
              </div>
            )}
            {validation.recommendations?.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <p className="text-sm text-green-600">All checks passed — system is production-ready.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}