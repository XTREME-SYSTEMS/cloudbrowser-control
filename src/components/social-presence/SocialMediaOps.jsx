import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Zap, UserPlus, LogIn, MessageSquare, Edit, Heart, Send, UserCheck } from "lucide-react";

const PLATFORMS = ["twitter", "facebook", "instagram", "tiktok", "linkedin", "pinterest", "reddit", "threads", "medium", "quora", "bluesky", "mastodon", "tumblr", "youtube", "discord", "telegram"];
const ACTIONS = [
  { value: "create_account", label: "Create Account", icon: UserPlus },
  { value: "login", label: "Login", icon: LogIn },
  { value: "post", label: "Post", icon: Zap },
  { value: "comment", label: "Comment", icon: MessageSquare },
  { value: "respond", label: "Respond", icon: Send },
  { value: "edit_profile", label: "Edit Profile", icon: Edit },
  { value: "follow", label: "Follow", icon: UserCheck },
  { value: "like", label: "Like", icon: Heart },
  { value: "dm", label: "Direct Message", icon: Send },
];

export default function SocialMediaOps() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ platform: "twitter", handle: "" });
  const [action, setAction] = useState("post");
  const [platform, setPlatform] = useState("twitter");
  const [content, setContent] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [credentials, setCredentials] = useState({ email: "", username: "", password: "" });

  const fetchAccounts = useCallback(async () => {
    try {
      const page = await base44.entities.SocialMediaAccount.filter({}, { sort: "-created_date", limit: 50 });
      setAccounts(page.items || []);
    } catch { setAccounts([]); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const handleAddAccount = async () => {
    if (!form.handle.trim()) return;
    try {
      await base44.entities.SocialMediaAccount.create({ platform: form.platform, handle: form.handle, status: "disconnected" });
      setForm({ platform: "twitter", handle: "" });
      setShowAdd(false);
      await fetchAccounts();
    } catch {}
  };

  const handleDelete = async (id) => {
    try { await base44.entities.SocialMediaAccount.delete(id); await fetchAccounts(); } catch {}
  };

  const handleExecute = async () => {
    setExecuting(true);
    setResult(null);
    try {
      const payload = { action, platform, content, target_url: targetUrl, credentials, human_like: true, use_proxy: true };
      const res = await base44.functions.invoke("socialMediaOperate", payload);
      setResult(res.data);
    } catch (e) { setResult({ error: e.message }); }
    setExecuting(false);
  };

  return (
    <div className="space-y-6">
      {/* Connected Accounts */}
      <div className="xa-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-lg">Connected Social Accounts</h3>
            <p className="text-sm text-muted-foreground">Track accounts the AI operates. Credentials are entered per-action and never stored.</p>
          </div>
          <Button onClick={() => setShowAdd(!showAdd)} variant="outline" size="sm"><Plus className="w-4 h-4" /> Add Account</Button>
        </div>
        {showAdd && (
          <div className="flex gap-2 mb-4 p-3 rounded-lg border bg-muted/20">
            <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} className="xa-input w-40">
              {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <Input value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })} placeholder="@handle" className="xa-input flex-1" />
            <Button onClick={handleAddAccount} className="xa-btn-primary">Add</Button>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : accounts.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">No accounts tracked yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary uppercase">{a.platform.slice(0, 2)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{a.handle}</p>
                  <Badge variant={a.status === "active" ? "default" : "outline"} className="text-[10px]">{a.status}</Badge>
                </div>
                <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Console */}
      <div className="xa-card">
        <h3 className="font-heading font-bold text-lg mb-1">Autonomous Social Media Operations</h3>
        <p className="text-sm text-muted-foreground mb-4">The AI uses a stealth browser with CAPTCHA solving to perform actions on your behalf. Enter credentials per-action — they are never stored.</p>

        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold mb-2">Action *</Label>
            <div className="flex flex-wrap gap-2">
              {ACTIONS.map(a => {
                const Icon = a.icon;
                return (
                  <button key={a.value} onClick={() => setAction(a.value)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${action === a.value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}>
                    <Icon className="w-3.5 h-3.5" /> {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold mb-1">Platform *</Label>
              <select value={platform} onChange={e => setPlatform(e.target.value)} className="xa-input">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1">Target URL (for comment/respond/follow/like/dm)</Label>
              <Input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://..." className="xa-input" />
            </div>
          </div>

          {(action === "login" || action === "create_account") && (
            <div className="grid md:grid-cols-3 gap-3 p-3 rounded-lg border bg-muted/20">
              <div>
                <Label className="text-xs font-semibold mb-1">Email</Label>
                <Input value={credentials.email} onChange={e => setCredentials({ ...credentials, email: e.target.value })} className="xa-input" />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1">Username</Label>
                <Input value={credentials.username} onChange={e => setCredentials({ ...credentials, username: e.target.value })} className="xa-input" />
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1">Password</Label>
                <Input type="password" value={credentials.password} onChange={e => setCredentials({ ...credentials, password: e.target.value })} className="xa-input" />
              </div>
            </div>
          )}

          {["post", "comment", "respond", "dm", "edit_profile"].includes(action) && (
            <div>
              <Label className="text-xs font-semibold mb-1">Content *</Label>
              <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write the content to post/comment/send..." rows={4} className="xa-input" />
            </div>
          )}

          <Button onClick={handleExecute} disabled={executing} className="xa-btn-primary w-full">
            {executing ? <><Loader2 className="w-4 h-4 animate-spin" /> AI is operating the browser...</> : <><Zap className="w-4 h-4" /> Execute with AI</>}
          </Button>

          {result && (
            <div className="p-4 rounded-lg border bg-muted/20">
              {result.error ? (
                <p className="text-sm text-red-500">{result.error}</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={result.ok ? "default" : "destructive"}>{result.ok ? "Executed" : "Failed"}</Badge>
                    <span className="text-sm font-medium">{result.platform} — {result.action}</span>
                  </div>
                  {result.evidence?.length > 0 && <p className="text-xs text-muted-foreground">Evidence captured: {result.evidence.length} screenshot(s)</p>}
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Execution log ({result.log?.length || 0} steps)</summary>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto max-h-40">{JSON.stringify(result.log, null, 2)}</pre>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}