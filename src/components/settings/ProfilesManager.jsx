import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, UserCircle } from "lucide-react";

export default function ProfilesManager() {
  const [profiles, setProfiles] = useState([]);
  const [newProfile, setNewProfile] = useState({ name: "", user_data_dir: "", description: "" });

  const load = async () => { try { setProfiles(await base44.entities.Profile.list("-created_date", 50)); } catch (e) {} };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!newProfile.name) return;
    try { await base44.functions.invoke("saveProfile", newProfile); setNewProfile({ name: "", user_data_dir: "", description: "" }); load(); } catch (e) { alert(e.message); }
  };
  const remove = async (id) => { await base44.entities.Profile.delete(id); load(); };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><UserCircle className="w-5 h-5" />Persistent Profiles</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Persistent profiles save cookies and state between sessions. The data directory must exist on the engine server.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><Label>Name</Label><Input value={newProfile.name} onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })} /></div>
          <div><Label>Data Directory</Label><Input value={newProfile.user_data_dir} onChange={(e) => setNewProfile({ ...newProfile, user_data_dir: e.target.value })} placeholder="/tmp/profiles/myprofile" /></div>
          <div><Label>Description</Label><Input value={newProfile.description} onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })} /></div>
        </div>
        <Button onClick={add} size="sm"><Plus className="w-4 h-4 mr-1" />Add Profile</Button>
        {profiles.length > 0 && (
          <div className="space-y-2">
            {profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 border rounded">
                <div><span className="font-medium">{p.name}</span> <span className="text-sm text-muted-foreground">{p.user_data_dir}</span></div>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}