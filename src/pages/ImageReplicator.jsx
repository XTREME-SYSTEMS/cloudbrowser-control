import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Image as ImageIcon, Loader2, CheckCircle2, AlertCircle, RefreshCw,
  Code2, Eye, Copy, Download, Target, Repeat, Sparkles,
} from "lucide-react";

export default function ImageReplicator() {
  const [imageUrl, setImageUrl] = useState("");
  const [pageName, setPageName] = useState("");
  const [targetParity, setTargetParity] = useState(99);
  const [maxIterations, setMaxIterations] = useState(5);
  const [running, setRunning] = useState(false);
  const [replication, setReplication] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(null);

  useEffect(() => { loadHistory(); }, []);

  const loadHistory = async () => {
    try {
      const res = await base44.entities.ImageReplication.filter({}, { sort: "-created_date", limit: 20 });
      setHistory(res.items || res);
    } catch (e) { console.error(e); }
  };

  const handleFileUpload = async (file) => {
    try {
      const uploadRes = await base44.integrations.Core.UploadPublicFile({ file });
      setImageUrl(uploadRes.file_url);
    } catch (e) {
      setError("Upload failed: " + e.message);
    }
  };

  const handleStart = async () => {
    if (!imageUrl) { setError("Enter an image URL or upload an image"); return; }
    setRunning(true);
    setError(null);
    setReplication(null);
    try {
      const response = await base44.functions.invoke("replicateImageToCode", {
        image_url: imageUrl,
        page_name: pageName || undefined,
        target_parity: targetParity,
        max_iterations: maxIterations,
      });
      const data = response.data || response;
      if (data.error) {
        setError(data.error);
      } else {
        setReplication(data.replication);
        loadHistory();
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setRunning(false);
    }
  };

  const handleContinue = async () => {
    if (!replication) return;
    setRunning(true);
    setError(null);
    try {
      const response = await base44.functions.invoke("replicateImageToCode", {
        replication_id: replication.id,
      });
      const data = response.data || response;
      if (data.error) {
        setError(data.error);
      } else {
        setReplication(data.replication);
        loadHistory();
      }
    } catch (e) {
      setError(e.response?.data?.error || e.message);
    } finally {
      setRunning(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadFile = (content, filename) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scoreColor = (score) => {
    if (score >= 99) return "text-green-500";
    if (score >= 80) return "text-yellow-500";
    if (score >= 50) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
          <ImageIcon className="w-6 h-6 text-primary" />
          Image-to-Code Replicator
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl">
          Upload any design image — a GPT-generated mockup, a screenshot, a reference site. The system replicates it
          pixel-by-pixel into a fully operational React page. A recursive parity loop validates visual accuracy
          against the original until it reaches {targetParity}% match, then converts to production JSX.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Input Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Source Image</CardTitle>
            <CardDescription>Upload or paste an image URL to replicate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                placeholder="https://..."
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Or upload file</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={e => e.target.files[0] && handleFileUpload(e.target.files[0])}
              />
            </div>
            {imageUrl && (
              <div className="rounded-lg border overflow-hidden">
                <img src={imageUrl} alt="Reference" className="w-full max-h-48 object-contain bg-muted/20" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Page Name (optional)</Label>
              <Input
                placeholder="Marketing Home Page"
                value={pageName}
                onChange={e => setPageName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Target Parity</Label>
                <Input
                  type="number"
                  min="50"
                  max="100"
                  value={targetParity}
                  onChange={e => setTargetParity(parseInt(e.target.value) || 99)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> Max Iterations</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={maxIterations}
                  onChange={e => setMaxIterations(parseInt(e.target.value) || 5)}
                />
              </div>
            </div>
            <Button onClick={handleStart} disabled={running || !imageUrl} className="w-full">
              {running
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Replicating...</>
                : <><Sparkles className="w-4 h-4 mr-2" />Start Replication</>}
            </Button>
            {error && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Replication Result</CardTitle>
                <CardDescription>Visual parity score and generated code</CardDescription>
              </div>
              {replication && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`text-3xl font-heading font-bold ${scoreColor(replication.parity_score)}`}>
                      {replication.parity_score}%
                    </div>
                    <div className="text-xs text-muted-foreground">Visual Parity</div>
                  </div>
                  <Badge variant={replication.parity_score >= (replication.target_parity || 99) ? "default" : "secondary"}>
                    {replication.status === "complete" && replication.parity_score >= (replication.target_parity || 99)
                      ? <><CheckCircle2 className="w-3 h-3 mr-1" />Target Reached</>
                      : replication.status === "complete"
                      ? <><AlertCircle className="w-3 h-3 mr-1" />Max Iterations</>
                      : replication.status}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!replication && !running && (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Upload an image and start replication to see results</p>
              </div>
            )}

            {running && !replication && (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Analyzing image and generating code...</p>
                <p className="text-xs text-muted-foreground mt-1">This may take 1-3 minutes per iteration</p>
              </div>
            )}

            {replication && (
              <div className="space-y-4">
                {/* Iteration Timeline */}
                {replication.iterations?.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide">Iteration History</Label>
                    <div className="flex gap-2 flex-wrap">
                      {replication.iterations.map((it, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
                          <span className="text-xs font-mono text-muted-foreground">#{it.iteration}</span>
                          <span className={`text-sm font-bold ${scoreColor(it.score)}`}>{it.score}%</span>
                          {it.score >= (replication.target_parity || 99) && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
                        </div>
                      ))}
                    </div>
                    {replication.iterations[replication.iterations.length - 1]?.diff_summary && (
                      <div className="p-3 rounded-lg border bg-muted/20 text-xs">
                        <p className="font-semibold mb-1">Last Diff Feedback:</p>
                        <p className="text-muted-foreground whitespace-pre-wrap">
                          {replication.iterations[replication.iterations.length - 1].diff_summary}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Continue button if not at target */}
                {replication.status === "complete" && replication.parity_score < (replication.target_parity || 99) && (
                  <Button onClick={handleContinue} disabled={running} variant="outline" className="w-full">
                    {running
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Continuing...</>
                      : <><RefreshCw className="w-4 h-4 mr-2" />Continue Iterating (more rounds)</>}
                  </Button>
                )}

                {/* Tabs: Preview / HTML / JSX */}
                <Tabs defaultValue="preview">
                  <TabsList>
                    <TabsTrigger value="preview"><Eye className="w-4 h-4 mr-1" />Preview</TabsTrigger>
                    <TabsTrigger value="html"><Code2 className="w-4 h-4 mr-1" />HTML</TabsTrigger>
                    <TabsTrigger value="jsx"><Code2 className="w-4 h-4 mr-1" />JSX</TabsTrigger>
                  </TabsList>

                  <TabsContent value="preview" className="space-y-2">
                    {replication.html_url ? (
                      <div className="rounded-lg border overflow-hidden">
                        <iframe
                          src={replication.html_url}
                          title="Replica Preview"
                          className="w-full h-[500px] bg-white"
                        />
                      </div>
                    ) : replication.generated_html ? (
                      <div className="rounded-lg border overflow-hidden">
                        <iframe
                          srcDoc={replication.generated_html}
                          title="Replica Preview"
                          className="w-full h-[500px] bg-white"
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground py-8 text-center">No HTML generated yet</p>
                    )}
                    {replication.screenshot_url && (
                      <div className="space-y-1">
                        <Label className="text-xs">Rendered Screenshot (used for parity comparison)</Label>
                        <img src={replication.screenshot_url} alt="Screenshot" className="w-full rounded-lg border" />
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="html">
                    {replication.generated_html ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(replication.generated_html, "html")}>
                            <Copy className="w-3.5 h-3.5 mr-1" />{copied === "html" ? "Copied!" : "Copy"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => downloadFile(replication.generated_html, `${replication.page_name || "replica"}.html`)}>
                            <Download className="w-3.5 h-3.5 mr-1" />Download
                          </Button>
                        </div>
                        <pre className="p-3 rounded-lg border bg-muted/20 text-xs overflow-auto max-h-[500px] xa-scroll">
                          <code>{replication.generated_html}</code>
                        </pre>
                      </div>
                    ) : <p className="text-sm text-muted-foreground py-8 text-center">No HTML generated</p>}
                  </TabsContent>

                  <TabsContent value="jsx">
                    {replication.generated_jsx ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => copyToClipboard(replication.generated_jsx, "jsx")}>
                            <Copy className="w-3.5 h-3.5 mr-1" />{copied === "jsx" ? "Copied!" : "Copy"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => downloadFile(replication.generated_jsx, `${replication.page_name || "replica"}.jsx`)}>
                            <Download className="w-3.5 h-3.5 mr-1" />Download
                          </Button>
                        </div>
                        <pre className="p-3 rounded-lg border bg-muted/20 text-xs overflow-auto max-h-[500px] xa-scroll">
                          <code>{replication.generated_jsx}</code>
                        </pre>
                      </div>
                    ) : <p className="text-sm text-muted-foreground py-8 text-center">JSX not generated yet</p>}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Replication History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-muted/30 cursor-pointer"
                  onClick={() => setReplication(h)}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img src={h.source_image_url} alt="" className="w-12 h-12 rounded object-cover shrink-0 border" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{h.page_name || "Untitled"}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.iteration_count} iterations — {new Date(h.created_date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className={`text-sm font-bold ${scoreColor(h.parity_score)}`}>{h.parity_score}%</span>
                    <Badge variant="outline" className="text-xs">{h.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}