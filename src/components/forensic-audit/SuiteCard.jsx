import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SuiteCard({ suiteName, state }) {
  if (!state || state.status === "pending") {
    return (
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> {suiteName}
          </CardTitle>
        </CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Waiting…</p></CardContent>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            {suiteName} <Badge variant="destructive">ERROR</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent><p className="text-sm text-destructive">{state.error}</p></CardContent>
      </Card>
    );
  }

  const data = state.data;
  const score = data.score ?? 0;
  const passed = data.testsPassed ?? 0;
  const total = data.testsTotal ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{suiteName}</span>
          <div className="flex gap-2">
            <Badge variant={score === 100 ? "default" : "secondary"}>{score}/100</Badge>
            <Badge variant="outline">{passed}/{total}</Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-72 overflow-y-auto">
        {data.results?.map((t, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            {t.passed
              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
              : <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <span className="font-medium">{t.name}</span>
              <p className="text-muted-foreground truncate">{t.detail}</p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">{t.points}/{t.maxPoints}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}