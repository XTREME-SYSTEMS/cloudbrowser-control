import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Circle, ShieldCheck } from "lucide-react";

export default function ValidationResults({ results }) {
  if (results.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Automated Validation</CardTitle>
          <CardDescription>Test results from the comprehensive scoring suite</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8 text-sm text-muted-foreground">No validation tests run yet. Use Vision Cortex → "Run Validation Tests".</p>
        </CardContent>
      </Card>
    );
  }

  const passing = results.filter((t) => t.status === "pass").length;
  const failing = results.filter((t) => t.status === "fail").length;
  const skipped = results.filter((t) => t.status === "skip").length;
  const suites = [...new Set(results.map((t) => t.suite))];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5" />Automated Validation</CardTitle>
            <CardDescription>{results.length} tests · {suites.length} suites · {passing} pass · {failing} fail · {skipped} skip</CardDescription>
          </div>
          <Badge variant={passing === results.length ? "default" : "destructive"} className="text-sm">
            {passing === results.length ? "ALL PASSING" : `${failing} FAILING`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {suites.map((suite) => {
            const suiteTests = results.filter((t) => t.suite === suite);
            const suitePass = suiteTests.filter((t) => t.status === "pass").length;
            const suiteScore = suiteTests.length > 0 ? Math.round((suitePass / suiteTests.length) * 100) : 0;
            return (
              <div key={suite}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{suite}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className={"h-full rounded-full " + (suiteScore === 100 ? "bg-emerald-500" : suiteScore >= 75 ? "bg-amber-500" : "bg-red-500")} style={{ width: suiteScore + "%" }} />
                    </div>
                    <span className="text-xs font-bold w-8 text-right">{suiteScore}%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {suiteTests.map((t, i) => (
                    <div key={t.id || i} className="flex items-center gap-2 p-2 rounded-md border text-xs">
                      {t.status === "pass" ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> :
                       t.status === "fail" ? <XCircle className="w-3 h-3 text-red-500 shrink-0" /> :
                       <Circle className="w-3 h-3 text-muted-foreground shrink-0" />}
                      <span className="flex-1 truncate">{t.test_name}</span>
                      {t.score_points !== undefined && t.max_points !== undefined && (
                        <span className="text-muted-foreground">{t.score_points}/{t.max_points}</span>
                      )}
                      {t.duration_ms > 0 && <span className="text-muted-foreground">{t.duration_ms}ms</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}