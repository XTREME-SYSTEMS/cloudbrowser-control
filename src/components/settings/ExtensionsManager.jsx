import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Puzzle } from "lucide-react";

export default function ExtensionsManager() {
  const [extensions, setExtensions] = useState([]);
  const [newExt, setNewExt] = useState({ name: "", file_url: "", description: "" });

  const load = async () => { try { setExtensions(await base44.entities.Extension.list("-created_date", 50)); } catch (e) {} };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newExt.name || !newExt.file_url) return;
    try { await base44.entities.Extension.create(newExt); setNewExt({ name: "", file_url: "", description: "" }); load(); } catch (e) { alert(e.message); }
  };
  const remove = async (id) => { await base44.entities.Extension.delete(id); load(); };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><Puzzle className="w-5 h-5" />Browser Extensions</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Upload extensions (.crx or .zip) to load into browser sessions. The file URL must be accessible from the engine server.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label>Name</Label><Input value={newExt.name} onChange={(e) => setNewExt({ ...newExt, name: e.target.value })} /></div>
          <div><Label>File URL</Label><Input value={newExt.file_url} onChange={(e) => setNewExt({ ...newExt, file_url: e.target.value })} placeholder="https://.../ext.crx" /></div>
          <div><Label>Description</Label><Input value={newExt.description} onChange={(e) => setNewExt({ ...newExt, description: e.target.value })} /></div>
        </div>
        <Button onClick={add} size="sm"><Plus className="w-4 h-4 mr-1" />Add Extension</Button>
        {extensions.length > 0 && (
          <div className="space-y-2">
            {extensions.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 border rounded">
                <div><span className="font-medium">{e.name}</span> <span className="text-sm text-muted-foreground">{e.description}</span></div>
                <Button size="sm" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}