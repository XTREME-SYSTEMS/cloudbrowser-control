import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { Play, CheckCircle, XCircle, MinusCircle, Trophy, RefreshCw } from "lucide-react";

const GRADE_COLORS = { "A": "#22c55e", "A-": "#84cc16", "B": "#eab308", "C": "#f97316", "D": "#ef4444", "F": "#dc2626" };

export default function TestResults() {
  const [score, setScore] = useState(null);
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      const res = await base44.functions.invoke("calculateScore", {});
      setScore(res.data);
      const records = await base44.entities.ScoreRecord.list("-created_date", 20);
      setHistory(records);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, []);

  const runSuite = async () => {
    setRunning(true);
    setError(null);
    try {
      await base44.functions.invoke("runTestSuite", {});
      await load();
    } catch (e) { setError(e.response?.data?.error || e.message); }
    finally { setRunning(false); }
  };

  const passRateData = score ? [{ name: "Pass Rate", value: score.pass_rate, fill: GRADE_COLORS[score.letter_grade] || "#888" }] : [];
  const categoryData = score ? Object.entries(score.categories || {}).map(([name, c]) => ({ name, passed: c.passed, failed: c.total - c.passed })) : [];
  const historyData = history.map((h) => ({ date: new Date(h.created_date).toLocaleDateString(), score: h.score, pass_rate: h.pass_rate })).reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><Trophy className="w-7 h-7" />Test Results & Scoring</h1>
          <p className="text-muted-foreground mt-1">Automated test suite with pass/fail scoring</p>
        </div>
        <Button onClick={runSuite} disabled={running} size="lg">
          {running ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Running Tests...</> : <><Play className="w-4 h-4 mr-2" />Run Full Test Suite</>}
        </Button>
      </div>

      {error && <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}

      {score ? (
        <>
          {/* Score cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6 text-center"><div className="text-4xl font-bold" style={{ color: GRADE_COLORS[score.letter_grade] }}>{score.letter_grade}</div><p className="text-xs text-muted-foreground mt-1">Grade</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><div className="text-4xl font-bold">{score.score}%</div><p className="text-xs text-muted-foreground mt-1">Score</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><div className="text-4xl font-bold text-green-600">{score.passed}</div><p className="text-xs text-muted-foreground mt-1">Passed</p></CardContent></Card>
            <Card><CardContent className="pt-6 text-center"><div className="text-4xl font-bold text-red-600">{score.failed}</div><p className="text-xs text-muted-foreground mt-1">Failed</p></CardContent></Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pass rate gauge */}
            <Card>
              <CardHeader><CardTitle className="text-base">Pass Rate</CardTitle></CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="60%" outerRadius="100%" data={passRateData} startAngle={90} endAngle={-270}>
                      <RadialBar background dataKey="value" cornerRadius={10} />
                      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold fill-foreground">{score.passRate}%</text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Category breakdown */}
            <Card>
              <CardHeader><CardTitle className="text-base">Category Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="passed" stackId="a" fill="#22c55e" name="Passed" />
                      <Bar dataKey="failed" stackId="a" fill="#ef4444" name="Failed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Score history */}
          {historyData.length > 1 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Score History</CardTitle></CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} name="Score %" />
                      <Line type="monotone" dataKey="pass_rate" stroke="#22c55e" strokeWidth={2} name="Pass Rate %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed results table */}
          <Card>
            <CardHeader><CardTitle className="text-base">Test Details ({score.results?.length || 0} tests)</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {(score.results || []).map((t, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 text-sm">
                    {t.status === "pass" ? <CheckCircle className="w-4 h-4 text-green-500 shrink-0" /> : t.status === "fail" ? <XCircle className="w-4 h-4 text-red-500 shrink-0" /> : <MinusCircle className="w-4 h-4 text-muted-foreground shrink-0" />}
                    <span className="flex-1 truncate">{t.test_name}</span>
                    <span className="text-xs text-muted-foreground hidden sm:inline">{t.category}</span>
                    <span className="text-xs text-muted-foreground font-mono">{t.duration_ms}ms</span>
                    {t.error_message && <span className="text-xs text-red-500 truncate max-w-32 sm:max-w-64" title={t.error_message}>{t.error_message}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : !error ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>
      ) : (
        <Card><CardContent className="pt-6 text-center"><p className="text-muted-foreground">No test runs yet. Click "Run Full Test Suite" to start.</p></CardContent></Card>
      )}
    </div>
  );
}