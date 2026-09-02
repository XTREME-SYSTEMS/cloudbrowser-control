import { useState, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, FlaskConical, CheckCircle2, XCircle, AlertCircle, Eye, ListChecks } from "lucide-react";
import { CAPABILITIES, CATEGORIES } from "@/components/capability-test/capabilitiesData";
import ResultBox from "@/components/capability-test/ResultBox";

export default function CapabilityTestLab() {
  const [selectedId, setSelectedId] = useState(1);
  const [results, setResults] = useState({});
  const [runningAll, setRunningAll] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const stopRef = useRef(false);

  const selected = CAPABILITIES.find((c) => c.id === selectedId);

  const runSingle = useCallback(async (cap) => {
    if (!cap.testFn) {
      const uiResult = cap.checkResult();
      setResults((p) => ({ ...p, [cap.id]: { status: "done", ...uiResult } }));
      return;
    }

    setResults((p) => ({ ...p, [cap.id]: { status: "running" } }));
    try {
      const res = await base44.functions.invoke(cap.testFn, cap.testPayload || {});
      const data = res.data || res;
      const checkResult = cap.checkResult(data);
      setResults((p) => ({ ...p, [cap.id]: { status: "done", ...checkResult, raw: data } }));
    } catch (e) {
      setResults((p) => ({ ...p, [cap.id]: { status: "error", error: e.message } }));
    }
  }, []);

  const runAll = useCallback(async () => {
    setRunningAll(true);
    stopRef.current = false;
    setRunProgress(0);
    setResults({});
    for (let i = 0; i < CAPABILITIES.length; i++) {
      if (stopRef.current) break;
      await runSingle(CAPABILITIES[i]);
      setRunProgress(i + 1);
    }
    setRunningAll(false);
  }, [runSingle]);

  const stopAll = () => {
    stopRef.current = true;
  };

  const testedCount = Object.keys(results).length;
  const passedCount = Object.values(results).filter((r) => r.status === "done" && r.passed === true).length;
  const failedCount = Object.values(results).filter((r) => r.status === "done" && r.passed === false).length;
  const errorCount = Object.values(results).filter((r) => r.status === "error").length;
  const uiCount = Object.values(results).filter((r) => r.status === "done" && r.passed === null).length;

  const getStatusIcon = (capId) => {
    const r = results[capId];
    if (!r || r.status === "idle") return <span className="text-muted-foreground/40 text-xs">○</span>;
    if (r.status === "running") return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />;
    if (r.status === "error") return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    if (r.passed === null) return <Eye className="w-3.5 h-3.5 text-purple-500" />;
    return r.passed ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />;
  };

  let categoryStartId = 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <FlaskConical className="w-6 h-6" /> Capability Test Lab
          </h1>
          <p className="text-sm text-muted-foreground">
            {CAPABILITIES.length} capabilities — each numbered, testable, with expected results.
          </p>
        </div>
        <div className="flex gap-2">
          {runningAll ? (
            <Button variant="destructive" onClick={stopAll}>
              <Loader2 className="w-4 h-4 animate-spin mr-2" /> Stop ({runProgress}/{CAPABILITIES.length})
            </Button>
          ) : (
            <Button onClick={runAll}>
              <ListChecks className="w-4 h-4 mr-2" /> Run All Tests
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <div><div className="text-lg font-bold">{passedCount}</div><div className="text-xs text-muted-foreground">Passed</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <XCircle className="w-4 h-4 text-destructive" />
          <div><div className="text-lg font-bold">{failedCount}</div><div className="text-xs text-muted-foreground">Failed</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          <div><div className="text-lg font-bold">{errorCount}</div><div className="text-xs text-muted-foreground">Errors</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <Eye className="w-4 h-4 text-purple-500" />
          <div><div className="text-lg font-bold">{uiCount}</div><div className="text-xs text-muted-foreground">UI Verify</div></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2">
          <ListChecks className="w-4 h-4 text-blue-500" />
          <div><div className="text-lg font-bold">{testedCount}/{CAPABILITIES.length}</div><div className="text-xs text-muted-foreground">Tested</div></div>
        </CardContent></Card>
      </div>

      {/* Main Layout: Left list + Right detail */}
      <div className="flex gap-4">
        {/* Left: Numbered List */}
        <div className="w-72 shrink-0">
          <Card className="h-[calc(100vh-280px)] flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Capabilities (1–{CAPABILITIES.length})</CardTitle>
            </CardHeader>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-3">
              {CATEGORIES.map((cat) => {
                const caps = CAPABILITIES.filter((c) => c.category === cat);
                return (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1 sticky top-0 bg-card py-1">
                      {cat}
                    </p>
                    {caps.map((cap) => (
                      <button
                        key={cap.id}
                        onClick={() => setSelectedId(cap.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${
                          selectedId === cap.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        }`}
                      >
                        <span className={`w-6 text-right font-mono font-bold ${selectedId === cap.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {cap.id}
                        </span>
                        {getStatusIcon(cap.id)}
                        <span className="flex-1 truncate">{cap.name}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right: Detail Panel */}
        <div className="flex-1 min-w-0">
          {selected && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-mono font-bold text-muted-foreground/30">{selected.id}</span>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{selected.name}</CardTitle>
                    <Badge variant="outline" className="mt-1 text-xs">{selected.category}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Description */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">What It Does</p>
                  <p className="text-sm">{selected.description}</p>
                </div>

                {/* Test Target */}
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Tests Against</p>
                  <p className="text-sm font-mono">{selected.testTarget}</p>
                </div>

                {/* Expected Result */}
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">Expected Result</p>
                  <p className="text-sm">{selected.expectedResult}</p>
                </div>

                {/* Test Button + Results */}
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => runSingle(selected)}
                    disabled={results[selected.id]?.status === "running" || runningAll}
                  >
                    {results[selected.id]?.status === "running" ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Testing…</>
                    ) : (
                      <><Play className="w-4 h-4 mr-2" /> Run Test</>
                    )}
                  </Button>
                  {!selected.testFn && (
                    <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-0">
                      <Eye className="w-3 h-3 mr-1" /> UI Verification Required
                    </Badge>
                  )}
                </div>

                {/* Results Box */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Results</p>
                  <ResultBox result={results[selected.id] || { status: "idle" }} />
                </div>

                {/* Raw Response (if available) */}
                {results[selected.id]?.raw && (
                  <details className="mt-2">
                    <summary className="text-xs font-semibold text-muted-foreground cursor-pointer">Raw Response (JSON)</summary>
                    <pre className="text-xs font-mono overflow-x-auto bg-muted/50 p-3 rounded mt-2 max-h-64 overflow-y-auto">
                      {JSON.stringify(results[selected.id].raw, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}