import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardPaste, Zap, Loader2, CheckCircle, AlertCircle } from "lucide-react";

export default function BulkImport({ onDone }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [runSearches, setRunSearches] = useState(true);

  const handleImport = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress(null);
    try {
      const res = await base44.functions.invoke("bulkHeirSearchImport", { raw_text: text });
      const data = res.data || res;
      if (data.error) throw new Error(data.error);
      const created = data.created || [];
      setResult({ count: data.count || created.length, parsed: data.parsed || created.length, records: created });

      if (runSearches && created.length > 0) {
        // Deep search is the standard — run each sequentially with progress
        for (let i = 0; i < created.length; i++) {
          const c = created[i];
          setProgress({ current: i + 1, total: created.length, name: c.deceased_name, status: "searching" });
          try {
            await base44.functions.invoke("runHeirSearch", {
              deceased_name: c.deceased_name,
              deceased_dob: c.deceased_dob,
              deceased_dod: c.deceased_dod,
              deceased_last_address: c.deceased_last_address,
              death_location: c.death_location,
              deceased_ssn: c.deceased_ssn,
              case_reference: c.case_reference,
              deep_search: true,
              extreme_deep: false,
            });
          } catch (e) {
            console.error("Search failed for", c.deceased_name, e);
          }
        }
        setProgress({ current: created.length, total: created.length, status: "done" });
      }

      setText("");
      onDone();
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to import records");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClipboardPaste className="w-4 h-4 text-primary" />
          Bulk Import
        </CardTitle>
        <CardDescription>
          Paste one or more deceased person records in any format. The system normalizes the text and inputs each as a new case.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={`Paste records here — any format works. Examples:

John Michael Smith, DOB 03/15/1948, DOD 11/02/2024, last address 412 Oak Ave Dallas TX, died Dallas County TX
Mary Johnson; b. 1952-06-20; d. 2025-01-10; 789 Pine St, Houston, TX 77002; SSN xxx-xx-1234; ref TX-PROB-0042
Robert Lee Williams, 1940-2023, Austin TX`}
          rows={6}
          className="w-full px-3 py-2.5 rounded-lg text-sm font-mono bg-background border border-border resize-y focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={runSearches}
              onChange={e => setRunSearches(e.target.checked)}
              className="rounded border-border"
            />
            Run deep search on each (standard)
          </label>
          <div className="flex-1" />
          <Button onClick={handleImport} disabled={busy || !text.trim()}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            {busy ? "Processing..." : "Normalize & Import"}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {progress && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-2 text-sm">
              {progress.status === "done" ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              <span className="font-medium">
                {progress.status === "done"
                  ? `Completed ${progress.total} search${progress.total !== 1 ? "es" : ""}`
                  : `Searching ${progress.current} of ${progress.total}: ${progress.name}`}
              </span>
            </div>
            <div className="mt-2 w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gold-gradient rounded-full transition-all"
                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {result && !progress && (
          <div className="flex items-center gap-2 text-sm text-green-500">
            <CheckCircle className="w-4 h-4" />
            Imported {result.count} record{result.count !== 1 ? "s" : ""} ({result.parsed} parsed)
          </div>
        )}
      </CardContent>
    </Card>
  );
}