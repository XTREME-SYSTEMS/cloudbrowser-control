import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Folder, Plus, Trash2, Copy, Check, Eye, EyeOff, Archive, ArchiveRestore } from "lucide-react";

const COLORS = [
  { name: "blue", class: "bg-blue-500" },
  { name: "purple", class: "bg-purple-500" },
  { name: "green", class: "bg-emerald-500" },
  { name: "orange", class: "bg-orange-500" },
  { name: "pink", class: "bg-pink-500" },
  { name: "cyan", class: "bg-cyan-500" },
];

export default function ProjectsManager() {
  const [projects, setProjects] = useState([]);
  const [newProj, setNewProj] = useState({ name: "", description: "", color: "blue" });
  const [createdKey, setCreatedKey] = useState(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = async () => { try { setProjects(await base44.entities.Project.list("-created_date", 50)); } catch (e) {} };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!newProj.name) return;
    setCreating(true);
    try {
      const res = await base44.functions.invoke("createProject", newProj);
      if (res.data.api_key?.api_key) {
        setCreatedKey(res.data.api_key.api_key);
        setShowKey(true);
      }
      setNewProj({ name: "", description: "", color: "blue" });
      load();
    } catch (e) { alert(e.response?.data?.error || e.message); }
    finally { setCreating(false); }
  };

  const copyKey = () => { navigator.clipboard.writeText(createdKey); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const remove = async (id) => {
    if (!confirm("Delete this project? Associated sessions and jobs will remain but lose the project link.")) return;
    await base44.entities.Project.delete(id);
    load();
  };

  const toggleArchive = async (p) => {
    await base44.entities.Project.update(p.id, { status: p.status === "active" ? "archived" : "active" });
    load();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Folder className="w-5 h-5" />Projects</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Organize sessions and jobs into projects. Each project gets its own API key for integration.</p>

        {createdKey && (
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-300">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-amber-800">Project API key — copy it now!</span>
              <Button size="sm" variant="ghost" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 rounded bg-white border font-mono text-xs sm:text-sm break-all">
                {showKey ? createdKey : "cb_live_•••••••••••••••••••••••••••••••••••••••••"}
              </code>
              <Button size="sm" onClick={copyKey} className="shrink-0">{copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</Button>
            </div>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => setCreatedKey(null)}>Done</Button>
          </div>
        )}

        <div className="space-y-3 p-3 border rounded-lg">
          <div><Label>Project Name</Label><Input value={newProj.name} onChange={(e) => setNewProj({ ...newProj, name: e.target.value })} placeholder="My Scraper, Competitor Monitor..." /></div>
          <div><Label>Description</Label><Textarea value={newProj.description} onChange={(e) => setNewProj({ ...newProj, description: e.target.value })} rows={2} /></div>
          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-1">
              {COLORS.map((c) => (
                <button key={c.name} onClick={() => setNewProj({ ...newProj, color: c.name })} className={`w-7 h-7 rounded-full ${c.class} ${newProj.color === c.name ? "ring-2 ring-offset-2 ring-primary" : ""}`} />
              ))}
            </div>
          </div>
          <Button onClick={create} disabled={creating || !newProj.name} size="sm"><Plus className="w-4 h-4 mr-1" />{creating ? "Creating..." : "Create Project & Generate Key"}</Button>
        </div>

        {projects.length > 0 && (
          <div className="space-y-2">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full bg-${p.color || "blue"}-500`} />
                  <div>
                    <span className="font-medium">{p.name}</span>
                    {p.status === "archived" && <span className="text-xs text-muted-foreground ml-1">(archived)</span>}
                    {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => toggleArchive(p)}>
                    {p.status === "active" ? <Archive className="w-4 h-4" /> : <ArchiveRestore className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}