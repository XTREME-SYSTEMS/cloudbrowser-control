import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Database, RefreshCw, Zap, CheckCircle2, AlertCircle, Loader2, Layers } from "lucide-react";

function BatchRow({ batch }) {
  const pct = batch.total_items > 0 ? Math.round((batch.processed / batch.total_items) * 100) : 0;
  const isProcessing = batch.status === "processing";
  const statusColor = {
    completed: "text-emerald-600",
    partial: "text-amber-600",
    failed: "text-red-600",
    processing: "text-primary",
  };
  const StatusIcon = batch.status === "completed" ? CheckCircle2 : batch.status === "failed" ? AlertCircle : Loader2;

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon className={`w-4 h-4 shrink-0 ${statusColor[batch.status] || "text-muted-foreground"} ${isProcessing ? "animate-spin" : ""}`} />
          <code className="text-xs font-mono truncate">{batch.batch_id}</code>
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">{batch.source}</Badge>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span>{batch.processed}/{batch.total_items} processed ({pct}%)</span>
        <span className="text-emerald-600">{batch.artifacts_created} artifacts</span>
        {batch.duplicates_skipped > 0 && <span className="text-amber-600">{batch.duplicates_skipped} dupes skipped</span>}
        {batch.failed > 0 && <span className="text-red-600">{batch.failed} failed</span>}
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${batch.status === "failed" ? "bg-red-500" : batch.status === "partial" ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function BulkIngestionPanel() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [seedBatch, setSeedBatch] = useState("");
  const [limit, setLimit] = useState("500");
  const [chunkSize, setChunkSize] = useState("10");
  const [pendingCount, setPendingCount] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("ingestionBatchStatus", {});
      setBatches(res.batches || []);
      // Count pending seeds
      try {
        const pending = await base44.entities.IntelligenceSeed.filter({ status: "pending" }, "-priority", 1);
        setPendingCount(pending.length);
      } catch (_) {}
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      const hasProcessing = batches.some((b) => b.status === "processing");
      if (hasProcessing) load();
    }, 5000);
    return () => clearInterval(interval);
  }, [load, batches]);

  const runBulk = async () => {
    setRunning(true);
    setError("");
    try {
      await base44.functions.invoke("ingestIntelligenceBulk", {
        seed_batch_id: seedBatch || undefined,
        limit: parseInt(limit) || 500,
        chunk_size: parseInt(chunkSize) || 10,
        dedup: true,
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const activeBatch = batches.find((b) => b.status === "processing");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Async Bulk Intelligence Ingestion
          </CardTitle>
          <CardDescription>
            Processes large quantities of intelligence feeds in chunked batches with backpressure, deduplication, and live progress tracking. Handles hundreds of sources per run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Seed Batch ID (optional)</label>
              <Input
                placeholder="e.g. seed-1234567890"
                value={seedBatch}
                onChange={(e) => setSeedBatch(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Max Items</label>
              <Input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Chunk Size</label>
              <Input
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={runBulk} disabled={running}>
              {running ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Ingesting…</> : <><Layers className="w-4 h-4 mr-1" /> Start Bulk Ingestion</>}
            </Button>
            {pendingCount !== null && (
              <span className="text-xs text-muted-foreground">
                <Database className="w-3 h-3 inline mr-1" />
                {pendingCount} pending seed{pendingCount !== 1 ? "s" : ""} ready
              </span>
            )}
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}
          {activeBatch && (
            <div className="flex items-center gap-2 text-sm text-primary bg-primary/5 rounded-md p-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Batch <code className="text-xs font-mono">{activeBatch.batch_id}</code> is running: {activeBatch.processed}/{activeBatch.total_items} processed, {activeBatch.artifacts_created} artifacts created.
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-heading font-semibold">Recent Ingestion Batches</h2>
          <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
        {loading && batches.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : batches.length === 0 ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">No ingestion batches yet. Start your first bulk ingestion above.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {batches.map((b) => <BatchRow key={b.id} batch={b} />)}
          </div>
        )}
      </div>
    </div>
  );
}