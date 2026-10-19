import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Search, RefreshCw, AlertCircle, ChevronDown, ChevronRight, Clock, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BulkIngestionPanel from "@/components/keyword-intelligence/BulkIngestionPanel";

const trendIcon = { rising: TrendingUp, declining: TrendingDown, stable: Minus };
const trendColor = { rising: "text-emerald-600", declining: "text-red-600", stable: "text-muted-foreground" };

function TrendBadge({ direction }) {
  const Icon = trendIcon[direction] || Minus;
  const color = trendColor[direction] || "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {direction}
    </span>
  );
}

function ReportCard({ report }) {
  const [open, setOpen] = useState(false);
  const failed = !!report.error_message;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="cursor-pointer hover:bg-muted/40" onClick={() => setOpen(!open)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {open ? <ChevronDown className="w-4 h-4 mt-1 shrink-0" /> : <ChevronRight className="w-4 h-4 mt-1 shrink-0" />}
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{report.topic}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{report.run_at ? new Date(report.run_at).toLocaleString() : "—"}</span>
                <Badge variant="secondary" className="text-[10px]">{report.run_type}</Badge>
                <Badge variant="outline" className="text-[10px]">{report.triggered_by}</Badge>
                {report.alert_sent && <span className="inline-flex items-center gap-1 text-emerald-600"><Mail className="w-3 h-3" />alerted</span>}
                {failed && <span className="inline-flex items-center gap-1 text-red-600"><AlertCircle className="w-3 h-3" />failed</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground shrink-0">
            <span>{report.top_words?.length || 0} words</span>
            <span>{report.top_categories?.length || 0} cats</span>
            <span>{report.top_phrases?.length || 0} phrases</span>
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 space-y-5">
          {failed ? (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-500/5 rounded-md p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{report.error_message}</span>
            </div>
          ) : (
            <>
              {report.summary && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Summary</h4>
                  <p className="text-sm">{report.summary}</p>
                </div>
              )}
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Top Words</h4>
                  <ul className="space-y-1.5">
                    {(report.top_words || []).map((w, i) => (
                      <li key={i} className="text-sm flex items-center justify-between gap-2">
                        <span className="truncate">{w.word}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{w.search_volume_estimate}</span>
                          <TrendBadge direction={w.trend_direction} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Top Categories</h4>
                  <ul className="space-y-1.5">
                    {(report.top_categories || []).map((c, i) => (
                      <li key={i} className="text-sm flex items-center justify-between gap-2">
                        <span className="truncate">{c.category}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{c.search_volume_estimate}</span>
                          <TrendBadge direction={c.trend_direction} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Top Phrases</h4>
                  <ul className="space-y-1.5">
                    {(report.top_phrases || []).map((p, i) => (
                      <li key={i} className="text-sm flex items-center justify-between gap-2">
                        <span className="truncate">{p.phrase}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">{p.search_volume_estimate}</span>
                          <TrendBadge direction={p.trend_direction} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {report.sources?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-1">Sources</h4>
                  <ul className="space-y-0.5">
                    {report.sources.map((s, i) => (
                      <li key={i} className="text-xs text-primary truncate">{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function KeywordIntelligence() {
  const [topic, setTopic] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.KeywordIntelligence.list("-run_at", 50);
      setReports(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setRunning(true);
    setError("");
    try {
      await base44.functions.invoke("runKeywordIntelligence", { topic, triggered_by: "manual" });
      await load();
      setTopic("");
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Search className="w-6 h-6 text-primary" />
          Intelligence Center
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Research trending keywords and ingest large quantities of intelligence feeds. Keyword research runs daily at 9am ET automatically.
        </p>
      </div>

      <Tabs defaultValue="keywords">
        <TabsList>
          <TabsTrigger value="keywords">Keyword Research</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Ingestion</TabsTrigger>
        </TabsList>

        <TabsContent value="keywords" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="Optional topic (e.g. polished concrete, web scraping, AI agents)…"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runNow()}
                  className="flex-1"
                />
                <Button onClick={runNow} disabled={running} className="sm:w-auto">
                  {running ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Researching…</> : <><Search className="w-4 h-4 mr-1" /> Run Now</>}
                </Button>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 mt-3">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-3">
                Uses live web search. Each run stores a report and alerts all admins via in-app notification + email.
              </p>
            </CardContent>
          </Card>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-heading font-semibold">Recent Reports</h2>
              <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
              </div>
            ) : reports.length === 0 ? (
              <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">No reports yet. Run your first intelligence sweep above.</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {reports.map((r) => <ReportCard key={r.id} report={r} />)}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bulk">
          <BulkIngestionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}