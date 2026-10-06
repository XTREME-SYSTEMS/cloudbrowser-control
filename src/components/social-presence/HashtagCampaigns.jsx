import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Hash, Plus, Play, Trash2, CheckCircle, XCircle } from "lucide-react";

const PLATFORMS = ["twitter", "facebook", "instagram", "tiktok", "linkedin", "pinterest", "reddit", "threads", "medium", "quora", "bluesky", "mastodon", "tumblr", "youtube", "discord", "telegram"];

export default function HashtagCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [running, setRunning] = useState(null);
  const [form, setForm] = useState({ name: "", content_text: "", hashtags: "", target_platforms: [] });

  const fetchCampaigns = useCallback(async () => {
    try {
      const page = await base44.entities.HashtagCampaign.filter({}, { sort: "-created_date", limit: 50 });
      setCampaigns(page.items || []);
    } catch { setCampaigns([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const togglePlatform = (p) => {
    setForm(f => ({
      ...f,
      target_platforms: f.target_platforms.includes(p) ? f.target_platforms.filter(x => x !== p) : [...f.target_platforms, p]
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim() || !form.content_text.trim() || form.target_platforms.length === 0) return;
    try {
      await base44.entities.HashtagCampaign.create({
        name: form.name,
        content_text: form.content_text,
        hashtags: form.hashtags.split(",").map(h => h.trim()).filter(Boolean),
        target_platforms: form.target_platforms,
        persistent_hashtags: true,
        status: "draft"
      });
      setForm({ name: "", content_text: "", hashtags: "", target_platforms: [] });
      setShowForm(false);
      await fetchCampaigns();
    } catch {}
  };

  const handleRun = async (id) => {
    setRunning(id);
    try {
      await base44.functions.invoke("runHashtagCampaign", { campaign_id: id });
      await fetchCampaigns();
    } catch {}
    setRunning(null);
  };

  const handleDelete = async (id) => {
    try { await base44.entities.HashtagCampaign.delete(id); await fetchCampaigns(); } catch {}
  };

  return (
    <div className="space-y-6">
      <div className="xa-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-lg">Hashtag Campaigns</h3>
            <p className="text-sm text-muted-foreground">Post content with persistent hashtags across all connected platforms.</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="xa-btn-primary"><Plus className="w-4 h-4" /> New Campaign</Button>
        </div>

        {showForm && (
          <div className="space-y-4 p-4 rounded-lg border bg-muted/20 mb-4">
            <div>
              <Label className="text-xs font-semibold mb-1">Campaign Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Summer Promo Blitz" className="xa-input" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1">Post Content *</Label>
              <Textarea value={form.content_text} onChange={e => setForm({ ...form, content_text: e.target.value })} placeholder="Write your post content here..." rows={4} className="xa-input" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1">Hashtags (comma-separated)</Label>
              <Input value={form.hashtags} onChange={e => setForm({ ...form, hashtags: e.target.value })} placeholder="#growth, #marketing, #business" className="xa-input" />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-2">Target Platforms *</Label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button key={p} onClick={() => togglePlatform(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${form.target_platforms.includes(p) ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={!form.name.trim() || !form.content_text.trim() || form.target_platforms.length === 0} className="xa-btn-primary">Create Campaign</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : campaigns.length === 0 ? (
          <div className="xa-card text-center text-muted-foreground py-8 text-sm">No campaigns yet. Create one above.</div>
        ) : campaigns.map(c => (
          <div key={c.id} className="xa-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-heading font-bold">{c.name}</h4>
                  <Badge variant={c.status === "completed" ? "default" : c.status === "running" ? "secondary" : c.status === "failed" ? "destructive" : "outline"} className="text-[10px]">{c.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{c.content_text}</p>
                {c.hashtags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.hashtags.map((h, i) => <span key={i} className="text-xs text-primary font-medium"><Hash className="w-2.5 h-2.5 inline" />{h}</span>)}
                  </div>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {c.target_platforms?.map(p => <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={() => handleRun(c.id)} disabled={running === c.id || c.status === "running"} className="xa-btn-primary h-8">
                  {running === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run
                </Button>
                <button onClick={() => handleDelete(c.id)} className="p-2 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {(c.posts_made > 0 || c.posts_failed > 0) && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3.5 h-3.5" /> {c.posts_made} posted</span>
                <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3.5 h-3.5" /> {c.posts_failed} failed</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}