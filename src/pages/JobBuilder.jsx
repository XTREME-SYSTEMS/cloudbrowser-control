import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, GripVertical, Play, ArrowLeft, Calculator, DollarSign } from "lucide-react";

const ACTION_TYPES = [
  "goto", "back", "forward", "reload", "wait_for_selector", "wait_for_load_state", "wait_for_timeout",
  "click", "hover", "type", "fill", "press", "select_option", "scroll", "drag_and_drop",
  "upload_file", "download", "handle_dialog", "new_tab", "switch_tab", "close_tab",
  "screenshot", "pdf", "extract_text", "extract_html", "extract_attribute", "extract_table",
  "extract_json", "ai_extract", "set_cookies", "set_headers", "set_local_storage", "capture_response",
];

export default function JobBuilder() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [startUrl, setStartUrl] = useState("");
  const [steps, setSteps] = useState([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [costEstimate, setCostEstimate] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const [userAgent, setUserAgent] = useState("");
  const [blockedResources, setBlockedResources] = useState([]);

  const addStep = () => {
    setSteps([...steps, { name: "", action_type: "goto", selector: "", value: "", options: {} }]);
  };

  const updateStep = (i, field, val) => {
    const updated = [...steps];
    updated[i] = { ...updated[i], [field]: val };
    setSteps(updated);
  };

  const removeStep = (i) => setSteps(steps.filter((_, idx) => idx !== i));

  const fetchEstimate = async () => {
    setEstimating(true);
    try {
      const res = await base44.functions.invoke("estimateCost", {
        steps,
        sessionConfig: { viewport, userAgent, blockedResources },
      });
      setCostEstimate(res.data);
    } catch (e) {
      alert("Failed to estimate: " + (e.response?.data?.error || e.message));
    } finally {
      setEstimating(false);
    }
  };
  const moveStep = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const updated = [...steps];
    [updated[i], updated[j]] = [updated[j], updated[i]];
    setSteps(updated);
  };

  const save = async (run = false) => {
    if (!name || !startUrl) { alert("Name and start URL are required"); return; }
    setSaving(true);
    try {
      const job = await base44.entities.Job.create({
        name, status: "queued", start_url: startUrl,
        session_config: { viewport, userAgent, blockedResources },
        steps_count: steps.length,
      });

      if (steps.length > 0) {
        await base44.entities.Step.bulkCreate(
          steps.map((s, i) => ({
            job_id: job.id, order: i, name: s.name, action_type: s.action_type,
            selector: s.selector, value: s.value, options: s.options || {},
          }))
        );
      }

      if (run) {
        setRunning(true);
        await base44.functions.invoke("runJob", { jobId: job.id });
        setRunning(false);
      }
      navigate(`/jobs/${job.id}`);
    } catch (e) {
      alert("Failed: " + (e.response?.data?.error || e.message));
    } finally {
      setSaving(false);
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/jobs")} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to jobs
      </button>

      <h1 className="text-3xl font-heading font-bold">New Job</h1>

      {/* Job config */}
      <Card>
        <CardHeader><CardTitle>Job Configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Job Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My scraping job" />
          </div>
          <div>
            <Label>Start URL</Label>
            <Input value={startUrl} onChange={(e) => setStartUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Viewport Width</Label>
              <Input type="number" value={viewport.width} onChange={(e) => setViewport({ ...viewport, width: parseInt(e.target.value) })} />
            </div>
            <div>
              <Label>Viewport Height</Label>
              <Input type="number" value={viewport.height} onChange={(e) => setViewport({ ...viewport, height: parseInt(e.target.value) })} />
            </div>
            <div>
              <Label>User Agent (optional)</Label>
              <Input value={userAgent} onChange={(e) => setUserAgent(e.target.value)} placeholder="Default" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Steps ({steps.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={addStep}><Plus className="w-4 h-4 mr-1" />Add Step</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.length === 0 && <p className="text-center py-6 text-muted-foreground">No steps. Add one to get started.</p>}
          {steps.map((step, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Step {i + 1}</span>
                <div className="flex gap-1 ml-auto">
                  <Button size="sm" variant="ghost" onClick={() => moveStep(i, -1)} disabled={i === 0}>↑</Button>
                  <Button size="sm" variant="ghost" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}>↓</Button>
                  <Button size="sm" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input value={step.name} onChange={(e) => updateStep(i, "name", e.target.value)} placeholder="Step description" />
                </div>
                <div>
                  <Label className="text-xs">Action Type</Label>
                  <Select value={step.action_type} onValueChange={(v) => updateStep(i, "action_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-60">
                      {ACTION_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Selector (CSS / XPath)</Label>
                  <Input value={step.selector} onChange={(e) => updateStep(i, "selector", e.target.value)} placeholder=".button or //div[@id='x']" />
                </div>
                <div>
                  <Label className="text-xs">Value</Label>
                  <Input value={step.value} onChange={(e) => updateStep(i, "value", e.target.value)} placeholder="URL, text, etc." />
                </div>
              </div>
              <div>
                <Label className="text-xs">Options (JSON)</Label>
                <Textarea
                  className="font-mono text-xs"
                  rows={2}
                  value={JSON.stringify(step.options || {})}
                  onChange={(e) => {
                    try { updateStep(i, "options", JSON.parse(e.target.value)); } catch {}
                  }}
                  placeholder='{"fullPage": true}'
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Cost estimate */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5" />Cost Estimate</CardTitle>
            <Button size="sm" variant="outline" onClick={fetchEstimate} disabled={estimating || steps.length === 0}>
              {estimating ? <div className="w-3 h-3 border-2 border-muted border-t-primary rounded-full animate-spin" /> : <Calculator className="w-4 h-4 mr-1" />}
              {estimating ? "Calculating..." : "Estimate Cost"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!costEstimate ? (
            <p className="text-center py-4 text-muted-foreground text-sm">Click "Estimate Cost" to project the cost of this job based on {steps.length} step(s).</p>
          ) : (
            <div className="space-y-3">
              {costEstimate.estimates.map((est, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{est.category}: <span className="text-muted-foreground">{est.description}</span></span>
                  <span className="font-medium">${est.cost.toFixed(4)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="font-medium">Estimated Total</span>
                <span className="font-heading font-bold text-lg">${costEstimate.totalCost.toFixed(4)}</span>
              </div>
              <p className="text-xs text-muted-foreground">Est. duration: ~{costEstimate.estimatedDurationSec}s · Based on configured rates in Cost Monitor</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={() => save(false)} disabled={saving || running}>
          {saving ? "Saving..." : "Save Job"}
        </Button>
        <Button onClick={() => save(true)} disabled={saving || running}>
          {running ? <><div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />Running...</> : <><Play className="w-4 h-4 mr-2" />Save & Run</>}
        </Button>
      </div>
    </div>
  );
}