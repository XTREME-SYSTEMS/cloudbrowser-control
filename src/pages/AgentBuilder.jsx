import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Plus, Sparkles, Globe, Database, MousePointerClick, Eye, Copy,
  Download, RefreshCw, Lock, Shield, Play, Pause, Trash2, Loader2,
  Search, FileText, Monitor, Zap, Code2, Rocket,
  Clock, Upload
} from "lucide-react";

const agentTypes = [
  { id: "scraper", label: "Scraper", icon: Search, desc: "Extract data from websites" },
  { id: "form_filler", label: "Form Filler", icon: MousePointerClick, desc: "Fill and submit forms" },
  { id: "cloner", label: "Cloner", icon: Copy, desc: "Clone website frontends" },
  { id: "researcher", label: "Researcher", icon: FileText, desc: "Research across the web" },
  { id: "monitor", label: "Monitor", icon: Eye, desc: "Watch sites for changes" },
  { id: "custom", label: "Custom", icon: Code2, desc: "Build from scratch" },
];

const allCapabilities = [
  { id: "navigate", label: "Navigate", icon: Globe },
  { id: "extract", label: "Extract Data", icon: Database },
  { id: "screenshot", label: "Screenshot", icon: Monitor },
  { id: "click", label: "Click", icon: MousePointerClick },
  { id: "type", label: "Type Text", icon: FileText },
  { id: "scroll", label: "Scroll", icon: RefreshCw },
  { id: "wait", label: "Wait", icon: Clock },
  { id: "solve_captcha", label: "Solve Captcha", icon: Lock },
  { id: "clone", label: "Clone", icon: Copy },
  { id: "fill_form", label: "Fill Form", icon: MousePointerClick },
  { id: "download", label: "Download", icon: Download },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "monitor_changes", label: "Monitor Changes", icon: Eye },
];

const models = [
  { id: "automatic", label: "Automatic (recommended)" },
  { id: "gpt_5_mini", label: "GPT-5 Mini (fast)" },
  { id: "gemini_3_flash", label: "Gemini 3 Flash (fast + web)" },
  { id: "claude_sonnet_4_6", label: "Claude Sonnet 4.6 (balanced)" },
  { id: "claude_opus_5", label: "Claude Opus 5 (most capable)" },
];

export default function AgentBuilder() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    agent_type: "scraper",
    instructions: "",
    target_urls: [],
    capabilities: ["navigate", "extract", "screenshot"],
    model_preference: "automatic",
    proxy_enabled: false,
    stealth_enabled: false,
    schedule_cron: "",
  });
  const [urlInput, setUrlInput] = useState("");

  const load = async () => {
    try {
      const data = await base44.entities.UserAgent.list("-created_date", 50).catch(() => []);
      setAgents(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleCap = (cap) => {
    setForm(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap) ? prev.capabilities.filter(c => c !== cap) : [...prev.capabilities, cap],
    }));
  };

  const addUrl = () => {
    if (urlInput.trim() && !form.target_urls.includes(urlInput.trim())) {
      setForm(prev => ({ ...prev, target_urls: [...prev.target_urls, urlInput.trim()] }));
      setUrlInput("");
    }
  };

  const save = async (deploy = false) => {
    setSaving(true);
    try {
      await base44.entities.UserAgent.create({
        ...form,
        status: deploy ? "active" : "draft",
      });
      setForm({
        name: "", description: "", agent_type: "scraper", instructions: "",
        target_urls: [], capabilities: ["navigate", "extract", "screenshot"],
        model_preference: "automatic", proxy_enabled: false, stealth_enabled: false, schedule_cron: "",
      });
      setShowForm(false);
      load();
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (agent) => {
    const newStatus = agent.status === "active" ? "paused" : "active";
    try {
      await base44.entities.UserAgent.update(agent.id, { status: newStatus });
      load();
    } catch (e) { alert(e.message); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this agent?")) return;
    try {
      await base44.entities.UserAgent.delete(id);
      load();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Bot className="w-6 h-6" />AI Agent Builder</h1>
          <p className="text-muted-foreground mt-1">Build browser automation agents with natural language. No code required.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4 mr-1" /> New Agent
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New Agent</CardTitle>
            <CardDescription>Describe what you want — our AI will handle the rest.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Type selector */}
            <div>
              <Label className="mb-3 block">Agent Type</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {agentTypes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setForm(prev => ({ ...prev, agent_type: t.id }))}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                      form.agent_type === t.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <t.icon className={`w-5 h-5 ${form.agent_type === t.id ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Name + Description */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">Agent Name</Label>
                <Input value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Product Price Scraper" />
              </div>
              <div>
                <Label className="mb-2 block">Description (optional)</Label>
                <Input value={form.description} onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))} placeholder="Scrapes product prices from e-commerce sites" />
              </div>
            </div>

            {/* Instructions */}
            <div>
              <Label className="mb-2 block">Instructions (natural language)</Label>
              <Textarea
                value={form.instructions}
                onChange={(e) => setForm(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="e.g. Go to the product page, find the price element, extract the price and product name. Handle pagination if there are multiple pages. Return the data as JSON."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">Describe what the agent should do in plain English. The AI will figure out the steps.</p>
            </div>

            {/* Target URLs */}
            <div>
              <Label className="mb-2 block">Target URLs</Label>
              <div className="flex gap-2 mb-2">
                <Input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://example.com" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())} />
                <Button onClick={addUrl} variant="outline">Add</Button>
              </div>
              {form.target_urls.length > 0 && (
                <div className="space-y-1">
                  {form.target_urls.map(url => (
                    <div key={url} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                      <Globe className="w-3 h-3 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate">{url}</span>
                      <Button size="sm" variant="ghost" onClick={() => setForm(prev => ({ ...prev, target_urls: prev.target_urls.filter(u => u !== url) }))}>×</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Capabilities */}
            <div>
              <Label className="mb-3 block">Capabilities</Label>
              <div className="flex flex-wrap gap-2">
                {allCapabilities.map(cap => (
                  <button
                    key={cap.id}
                    onClick={() => toggleCap(cap.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${
                      form.capabilities.includes(cap.id) ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {cap.icon && <cap.icon className="w-3 h-3" />}
                    {cap.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Model + Options */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="mb-2 block">AI Model</Label>
                <select
                  value={form.model_preference}
                  onChange={(e) => setForm(prev => ({ ...prev, model_preference: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm"
                >
                  {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="mb-2 block">Schedule (optional)</Label>
                <Input value={form.schedule_cron} onChange={(e) => setForm(prev => ({ ...prev, schedule_cron: e.target.value }))} placeholder="0 9 * * * (daily at 9am)" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => save(false)} variant="outline">
                Save as Draft
              </Button>
              <Button onClick={() => save(true)} disabled={saving || !form.name}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Rocket className="w-4 h-4 mr-1" />}
                Deploy Agent
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No agents yet. Create one to start automating.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {agents.map(agent => (
            <Card key={agent.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">{agent.agent_type}</Badge>
                    <Badge variant={agent.status === "active" ? "default" : agent.status === "running" ? "secondary" : "outline"}>
                      {agent.status === "running" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      {agent.status}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => toggleStatus(agent)}>
                      {agent.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(agent.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <h3 className="font-semibold mb-1">{agent.name}</h3>
                {agent.description && <p className="text-sm text-muted-foreground mb-2">{agent.description}</p>}
                {agent.instructions && (
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg line-clamp-2 mb-2">{agent.instructions}</p>
                )}
                <div className="flex flex-wrap gap-1 mb-2">
                  {(agent.capabilities || []).map(cap => (
                    <Badge key={cap} variant="secondary" className="text-xs">{cap}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{agent.run_count || 0} runs</span>
                  <span>·</span>
                  <span className="text-emerald-600">{agent.success_count || 0} success</span>
                  {agent.error_count > 0 && <><span>·</span><span className="text-rose-600">{agent.error_count} errors</span></>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}