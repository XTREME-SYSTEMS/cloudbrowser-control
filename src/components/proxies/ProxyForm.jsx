import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, X } from "lucide-react";

export default function ProxyForm({ onSave, onCancel, initial }) {
  const [form, setForm] = useState(initial || { name: "", server: "", username: "", password: "", country: "", protocol: "http", rotation_group: "" });

  const set = (k, v) => setForm({ ...form, [k]: v });

  const submit = () => {
    if (!form.name || !form.server) return;
    onSave(form);
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{initial ? "Edit Proxy" : "Add Proxy"}</span>
        {onCancel && <Button size="icon" variant="ghost" onClick={onCancel}><X className="w-4 h-4" /></Button>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="US-East-1" /></div>
        <div><Label className="text-xs">Server (host:port)</Label><Input value={form.server} onChange={(e) => set("server", e.target.value)} placeholder="proxy.example.com:8080" /></div>
        <div><Label className="text-xs">Username</Label><Input value={form.username} onChange={(e) => set("username", e.target.value)} /></div>
        <div><Label className="text-xs">Password</Label><Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={initial?.has_password ? "•••• (leave blank to keep)" : ""} /></div>
        <div><Label className="text-xs">Country</Label><Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="US" /></div>
        <div><Label className="text-xs">Rotation Group</Label><Input value={form.rotation_group} onChange={(e) => set("rotation_group", e.target.value)} placeholder="default" /></div>
        <div>
          <Label className="text-xs">Protocol</Label>
          <Select value={form.protocol} onValueChange={(v) => set("protocol", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="http">HTTP</SelectItem>
              <SelectItem value="https">HTTPS</SelectItem>
              <SelectItem value="socks5">SOCKS5</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={submit} size="sm">
        {initial ? <><Save className="w-4 h-4 mr-1" />Update</> : <><Plus className="w-4 h-4 mr-1" />Add Proxy</>}
      </Button>
    </div>
  );
}