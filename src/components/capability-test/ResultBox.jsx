import { CheckCircle2, XCircle, Loader2, AlertCircle, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ResultBox({ result }) {
  if (!result || result.status === "idle") {
    return (
      <div className="rounded-lg border border-dashed p-4 text-center">
        <p className="text-sm text-muted-foreground">No test run yet — click "Run Test" to verify this capability.</p>
      </div>
    );
  }

  if (result.status === "running") {
    return (
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <p className="text-sm text-blue-600 dark:text-blue-400">Running test…</p>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <Badge variant="destructive">ERROR</Badge>
        </div>
        <p className="text-sm text-destructive font-mono break-all">{result.error}</p>
      </div>
    );
  }

  // done
  const passed = result.passed;
  const isUI = result.passed === null;

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${isUI ? "border-purple-500/30 bg-purple-500/5" : passed ? "border-green-500/30 bg-green-500/5" : "border-destructive/30 bg-destructive/5"}`}>
      <div className="flex items-center gap-2">
        {isUI ? (
          <>
            <Eye className="w-5 h-5 text-purple-500" />
            <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-0">UI VERIFICATION</Badge>
          </>
        ) : passed ? (
          <>
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-0">PASSED</Badge>
          </>
        ) : (
          <>
            <XCircle className="w-5 h-5 text-destructive" />
            <Badge variant="destructive">FAILED</Badge>
          </>
        )}
        {result.points != null && (
          <Badge variant="outline" className="ml-auto">{result.points}/{result.maxPoints} pts</Badge>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1">Actual Result:</p>
        <p className="text-sm font-mono break-words">{result.detail}</p>
      </div>
    </div>
  );
}