import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ShieldCheck, Activity, Globe, Bot, FileSearch, ChevronDown, ChevronRight } from "lucide-react";
import ScoreGauge from "@/components/forensic-audit/ScoreGauge";
import SuiteCard from "@/components/forensic-audit/SuiteCard";
import ProofCard, { ScreenshotBlock, DataRow } from "@/components/forensic-audit/ProofCard";

const TESTS = [
  { key: "security", fn: "validateSecurity", label: "Security Suite", payload: {} },
  { key: "reliability", fn: "validateReliability", label: "Reliability Suite", payload: {} },
  { key: "capabilities", fn: "validateCapabilities", label: "Capabilities Suite", payload: {} },
  { key: "enhancements", fn: "validateEnhancements", label: "AI Enhancements Suite", payload: {} },
  { key: "matrix", fn: "getCapabilityMatrix", label: "Capability Matrix", payload: {} },
  { key: "realSite", fn: "runRealSiteTest", label: "Real-Site Extraction", payload: {} },
  { key: "captcha", fn: "testCaptchaSolver", label: "Captcha Solver (Live)", payload: { provider: "self" } },
  { key: "serp", fn: "serpMeasurement", label: "Google SERP + reCAPTCHA", payload: { keyword: "browser automation tool", target_url: "github.com", max_results: 15 } },
];

function initialState() {
  const t = {};
  TESTS.forEach((x) => (t[x.key] = { status: "pending", data: null, error: null }));
  return t;
}

export default function ForensicAudit() {
  const [running, setRunning] = useState(true);
  const [tests, setTests] = useState(initialState);
  const [showRaw, setShowRaw] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [completedAt, setCompletedAt] = useState(null);

  const runTest = useCallback(async (test) => {
    setTests((p) => ({ ...p, [test.key]: { status: "running", data: null, error: null } }));
    try {
      const res = await base44.functions.invoke(test.fn, test.payload);
      setTests((p) => ({ ...p, [test.key]: { status: "done", data: res, error: null } }));
    } catch (e) {
      setTests((p) => ({ ...p, [test.key]: { status: "error", data: null, error: e.message } }));
    }
  }, []);

  const runAudit = useCallback(async () => {
    setRunning(true);
    setStartedAt(new Date().toISOString());
    setCompletedAt(null);
    setTests(initialState());
    await Promise.allSettled(TESTS.map((t) => runTest(t)));
    setRunning(false);
    setCompletedAt(new Date().toISOString());
  }, [runTest]);

  useEffect(() => {
    runAudit();
  }, [runAudit]);

  // Compute overall score from the 4 validation suites
  const suiteKeys = ["security", "reliability", "capabilities", "enhancements"];
  const completedSuites = suiteKeys.filter((k) => tests[k].status === "done");
  const overallScore = completedSuites.length
    ? Math.round(completedSuites.reduce((s, k) => s + (tests[k].data?.score || 0), 0) / completedSuites.length)
    : 0;
  const totalTestsRun = completedSuites.reduce((s, k) => s + (tests[k].data?.testsTotal || 0), 0);
  const totalPassed = completedSuites.reduce((s, k) => s + (tests[k].data?.testsPassed || 0), 0);

  const realSiteData = tests.realSite.data;
  const serpData = tests.serp.data;
  const captchaData = tests.captcha.data;
  const matrixData = tests.matrix.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <FileSearch className="w-6 h-6" /> Deep Forensic Audit
          </h1>
          <p className="text-sm text-muted-foreground">
            End-to-end capability test system — every capability tested, scored, and proven with live evidence.
          </p>
        </div>
        <Button onClick={runAudit} disabled={running}>
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {running ? "Running…" : "Re-run Audit"}
        </Button>
      </div>

      {/* Overall Score */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-center justify-around gap-6">
            <ScoreGauge score={overallScore} label="Overall Score" size={140} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1 max-w-2xl">
              <StatBox icon={ShieldCheck} label="Tests Passed" value={`${totalPassed}/${totalTestsRun}`} color="text-green-500" />
              <StatBox icon={Activity} label="Suites Run" value={`${completedSuites.length}/4`} color="text-blue-500" />
              <StatBox icon={Globe} label="Real-Site Tests" value={realSiteData?.results?.length || 0} color="text-purple-500" />
              <StatBox icon={Bot} label="AI Features" value={tests.enhancements.data?.testsPassed || 0} color="text-orange-500" />
            </div>
          </div>
          {startedAt && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              Audit started: {new Date(startedAt).toLocaleTimeString()}
              {completedAt && ` · Completed: ${new Date(completedAt).toLocaleTimeString()}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Validation Suites Grid */}
      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">Validation Suites</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SuiteCard suiteName="Security" state={tests.security} />
          <SuiteCard suiteName="Reliability" state={tests.reliability} />
          <SuiteCard suiteName="Capabilities" state={tests.capabilities} />
          <SuiteCard suiteName="AI Enhancements" state={tests.enhancements} />
        </div>
      </div>

      {/* Real-Site Proof */}
      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">Real-Site Extraction Proof</h2>
        <ProofCard title="Live Browser Automation on Real Sites" state={tests.realSite}>
          {realSiteData?.results?.map((r, i) => (
            <div key={i} className="space-y-2 pb-3 border-b last:border-0">
              <div className="flex items-center gap-2">
                <Badge variant={r.success ? "default" : "destructive"}>{r.success ? "SUCCESS" : "FAILED"}</Badge>
                <span className="font-medium text-sm">{r.site}</span>
                <span className="text-xs text-muted-foreground">{r.url}</span>
              </div>
              {r.success ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <ScreenshotBlock url={r.screenshotUrl} label={r.url} />
                  <div className="space-y-1">
                    <DataRow label="Page Title" value={r.pageTitle || r.navTitle || "—"} />
                    <DataRow label="Nav Time" value={r.navTimeMs ? `${r.navTimeMs}ms` : "—"} />
                    <DataRow label="Text Extracted" value={`${r.textLength || 0} chars`} />
                    <DataRow label="Session" value={(r.sessionId || "").slice(0, 16) + "…"} mono />
                    {r.extractedText && (
                      <div className="mt-2 p-2 rounded bg-muted/50 text-xs font-mono max-h-32 overflow-y-auto">
                        {r.extractedText.slice(0, 300)}…
                      </div>
                    )}
                    {r.stories?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium">Top Stories Extracted:</p>
                        {r.stories.map((s, j) => (
                          <div key={j} className="text-xs flex gap-2">
                            <span className="text-muted-foreground">#{s.rank}</span>
                            <span className="truncate">{s.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-destructive">{r.error}</p>
              )}
            </div>
          ))}
        </ProofCard>
      </div>

      {/* SERP + Captcha Proof */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProofCard title="Google SERP + reCAPTCHA Bypass" state={tests.serp}>
          {serpData && (
            <div className="space-y-2">
              <DataRow label="Keyword" value={serpData.keyword} />
              <DataRow label="Target" value={serpData.target_url} />
              <DataRow label="Found" value={serpData.found ? `Position #${serpData.position}` : "Not found"} />
              <DataRow label="Total Results" value={serpData.total_results || 0} />
              <DataRow label="Captcha Detected" value={serpData.captcha_detected ? "Yes" : "No"} />
              <DataRow label="Captcha Solved" value={serpData.captcha_solved ? "Yes" : "No"} />
              {serpData.serp_results?.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium">SERP Results (top 5):</p>
                  {serpData.serp_results.slice(0, 5).map((s, j) => (
                    <div key={j} className="text-xs flex gap-2">
                      <span className="text-muted-foreground">#{s.position}</span>
                      <span className="truncate">{s.title || s.url}</span>
                    </div>
                  ))}
                </div>
              )}
              {serpData.error && <p className="text-sm text-destructive">{serpData.error}</p>}
            </div>
          )}
        </ProofCard>

        <ProofCard title="Captcha Solver (Live Test)" state={tests.captcha}>
          {captchaData && (
            <div className="space-y-2">
              <DataRow label="Engine Status" value={captchaData.engine_status || "—"} />
              <DataRow label="Engine Version" value={captchaData.engine_version || "—"} />
              <DataRow label="Captcha Detected" value={captchaData.captcha?.detected ? "Yes" : "No"} />
              <DataRow label="Captcha Solved" value={captchaData.captcha?.solved ? "Yes" : "No"} />
              <DataRow label="Solve Time" value={captchaData.duration_ms ? `${captchaData.duration_ms}ms` : "—"} />
              <DataRow label="Test URL" value={captchaData.url || "—"} />
              {captchaData.captcha?.error && <p className="text-xs text-destructive">{captchaData.captcha.error}</p>}
              {captchaData.captcha?.token && (
                <p className="text-xs font-mono break-all bg-muted/50 p-2 rounded">
                  Token: {captchaData.captcha.token.slice(0, 50)}…
                </p>
              )}
              {captchaData.error && <p className="text-sm text-destructive">{captchaData.error}</p>}
            </div>
          )}
        </ProofCard>
      </div>

      {/* Capability Matrix */}
      {matrixData?.categories && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Capability Matrix vs {matrixData.benchmark}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {matrixData.categories.map((cat, i) => (
                <div key={i}>
                  <p className="text-xs font-semibold mb-1">{cat.category}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {cat.capabilities?.map((c, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs p-1.5 rounded border">
                        {c.status === "implemented" ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        ) : (
                          <Activity className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                        )}
                        <span className="truncate">{c.name}</span>
                        {c.score != null && <Badge variant="outline" className="text-[10px] ml-auto">{c.score}</Badge>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw Evidence Log */}
      <Card>
        <CardHeader>
          <button onClick={() => setShowRaw(!showRaw)} className="flex items-center gap-2 text-sm font-semibold w-full">
            {showRaw ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Raw Evidence Log (JSON)
          </button>
        </CardHeader>
        {showRaw && (
          <CardContent>
            <pre className="text-xs font-mono overflow-x-auto bg-muted/50 p-4 rounded max-h-96 overflow-y-auto">
              {JSON.stringify(tests, null, 2)}
            </pre>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, color }) {
  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-lg border">
      <Icon className={`w-5 h-5 ${color}`} />
      <span className="text-xl font-bold">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}