import React from "react";
import { Link } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone, Mail, User, Clock, Database, Layers, Activity, Bot, RefreshCw, ArrowRight,
} from "lucide-react";

export default function SkipTracingDashboard({ traces, loading, onRefresh }) {
  const total = traces.length;
  const found = traces.filter((t) => t.status === "found").length;
  const partial = traces.filter((t) => t.status === "partial").length;
  const failed = traces.filter((t) => t.status === "failed").length;
  const pending = traces.filter((t) => t.status === "pending" || t.status === "searching").length;
  const avgConfidence = total > 0 ? Math.round(traces.reduce((s, t) => s + (t.confidence_score || 0), 0) / total) : 0;

  const batches = {};
  traces.forEach((t) => {
    const bid = t.batch_id || "single";
    if (!batches[bid]) batches[bid] = { id: bid, traces: [], found: 0, partial: 0, failed: 0, pending: 0 };
    batches[bid].traces.push(t);
    if (t.status === "found") batches[bid].found++;
    else if (t.status === "partial") batches[bid].partial++;
    else if (t.status === "failed") batches[bid].failed++;
    else batches[bid].pending++;
  });
  const batchList = Object.values(batches).sort((a, b) => b.traces.length - a.traces.length);

  const methodCounts = {};
  const sourceCounts = {};
  traces.forEach((t) => {
    (t.methods_used || []).forEach((m) => { methodCounts[m] = (methodCounts[m] || 0) + 1; });
    (t.sources_checked || []).forEach((s) => { sourceCounts[s] = (sourceCounts[s] || 0) + 1; });
  });
  const topMethods = Object.entries(methodCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 12);

  const ownerList = traces
    .filter((t) => t.found_owner_name || t.target_property_address)
    .map((t) => ({
      id: t.id,
      property: t.target_property_address || "—",
      owner: t.found_owner_name || "Not found",
      phones: t.found_phone_numbers?.length || 0,
      emails: t.found_emails?.length || 0,
      status: t.status,
      confidence: t.confidence_score || 0,
      batch_id: t.batch_id || "",
    }));

  const pct = (count) => String((count / total) * 100) + "%";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Total Traces</p>
            <p className="text-2xl font-bold mt-1">{total}</p>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Found</p>
            <p className="text-2xl font-bold mt-1 text-emerald-500">{found}</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Partial</p>
            <p className="text-2xl font-bold mt-1 text-amber-500">{partial}</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold mt-1 text-red-500">{failed}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/20">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold mt-1 text-blue-500">{pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Avg Confidence</p>
            <p className="text-2xl font-bold mt-1">{avgConfidence}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5" />Batch Enrichment Tasks</CardTitle>
              <CardDescription>Status of all batch skip tracing operations</CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={onRefresh} disabled={loading}>
              <RefreshCw className={"w-3 h-3 " + (loading ? "animate-spin" : "")} />Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {batchList.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No batches yet. Run a batch from the Swarm Orchestrator.</p>
          ) : (
            <div className="space-y-2">
              {batchList.map((batch) => (
                <div key={batch.id} className="p-3 rounded-lg border space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{batch.id === "single" ? "Individual" : batch.id}</Badge>
                      <span className="text-sm font-medium">{batch.traces.length} properties</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-emerald-500">{batch.found} found</span>
                      <span className="text-amber-500">{batch.partial} partial</span>
                      <span className="text-red-500">{batch.failed} failed</span>
                      <span className="text-blue-500">{batch.pending} pending</span>
                    </div>
                  </div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                    {batch.found > 0 && <div className="bg-emerald-500" style={{ width: pct(batch.found) }} />}
                    {batch.partial > 0 && <div className="bg-amber-500" style={{ width: pct(batch.partial) }} />}
                    {batch.failed > 0 && <div className="bg-red-500" style={{ width: pct(batch.failed) }} />}
                    {batch.pending > 0 && <div className="bg-blue-500" style={{ width: pct(batch.pending) }} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Identified Owner Names</CardTitle>
          <CardDescription>Every property traced and its identified owner</CardDescription>
        </CardHeader>
        <CardContent>
          {ownerList.length === 0 ? (
            <p className="text-center py-6 text-sm text-muted-foreground">No properties traced yet.</p>
          ) : (
            <div className="space-y-1">
              {ownerList.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-md border hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.property}</p>
                    <p className={"text-xs truncate " + (item.owner === "Not found" ? "text-muted-foreground" : "text-foreground")}>
                      Owner: {item.owner}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    {item.phones > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />{item.phones}
                      </span>
                    )}
                    {item.emails > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />{item.emails}
                      </span>
                    )}
                    <Badge variant="outline" className={"text-xs " + (
                      item.status === "found" ? "text-emerald-500" :
                      item.status === "partial" ? "text-amber-500" :
                      item.status === "failed" ? "text-red-500" : "text-blue-500"
                    )}>
                      {item.status}
                    </Badge>
                    <span className="text-xs font-medium w-8 text-right">{item.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><Activity className="w-4 h-4" />Search Methods Used</CardTitle>
          </CardHeader>
          <CardContent>
            {topMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground">No methods run yet.</p>
            ) : (
              <div className="space-y-2">
                {topMethods.map(([method, count]) => (
                  <div key={method} className="flex items-center justify-between">
                    <span className="text-xs font-mono">{method}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gold-gradient rounded-full" style={{ width: pct(count) }} />
                      </div>
                      <span className="text-xs font-medium w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm"><Database className="w-4 h-4" />Data Sources Checked</CardTitle>
          </CardHeader>
          <CardContent>
            {topSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sources checked yet.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {topSources.map(([source, count]) => (
                  <Badge key={source} variant="outline" className="text-xs">
                    {source} <span className="text-muted-foreground ml-1">({count})</span>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">AGI Swarm Orchestrator</p>
              <p className="text-xs text-muted-foreground">Assign tasks to Property Researcher, People Finder & Data Enricher</p>
            </div>
          </div>
          <Link to="/swarm-orchestrator">
            <Button size="sm">Open <ArrowRight className="w-3 h-3 ml-1" /></Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}