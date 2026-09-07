import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Ticket, Plus, Trash2, Copy, Check, Gift } from "lucide-react";

const PLANS = ["free", "developer", "startup", "enterprise"];

const STATUS_COLORS = {
  active: "bg-emerald-100 text-emerald-700",
  expired: "bg-muted text-muted-foreground",
  disabled: "bg-red-100 text-red-700",
  exhausted: "bg-orange-100 text-orange-700",
};

export default function AdminPromos() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [form, setForm] = useState({
    code: "",
    description: "",
    granted_plan: "developer",
    granted_months: 1,
    max_uses: 100,
    target_user_email: "",
  });

  const load = async () => {
    try {
      const res = await base44.functions.invoke("managePromo", { action: "list" });
      setPromos(res.data?.promos || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const generateRandomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 10; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setForm({ ...form, code: `XTREME-${code}` });
  };

  const handleCreate = async () => {
    if (!form.code.trim()) return;
    setCreating(true);
    try {
      await base44.functions.invoke("managePromo", {
        action: "create",
        ...form,
        applicable_plans: ["free"],
      });
      setShowCreate(false);
      setForm({ code: "", description: "", granted_plan: "developer", granted_months: 1, max_uses: 100, target_user_email: "" });
      load();
    } catch (e) {
      alert(e.response?.data?.error || e.message || "Failed to create promo");
    } finally {
      setCreating(false);
    }
  };

  const handleDisable = async (promoId) => {
    if (!confirm("Disable this promo code?")) return;
    try {
      await base44.functions.invoke("managePromo", { action: "disable", promo_id: promoId });
      load();
    } catch (e) { alert("Failed to disable promo"); }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) return <div className="text-muted-foreground text-sm">Loading promos…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Promo Codes</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage promotional codes for plan upgrades and trials.</p>
        </div>
        <Button onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> Create Promo
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="space-y-2">
              <Label>Promo Code</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="XTREME-XXXXXXXXXX"
                  value={form.code}
                  onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
                <Button variant="outline" onClick={generateRandomCode}>Auto-generate</Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (internal note)</Label>
              <Input
                placeholder="e.g. Beta tester bonus, partner referral"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Granted Plan</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.granted_plan}
                  onChange={e => setForm({ ...form, granted_plan: e.target.value })}
                >
                  {PLANS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Duration (months)</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.granted_months}
                  onChange={e => setForm({ ...form, granted_months: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Uses</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.max_uses}
                  onChange={e => setForm({ ...form, max_uses: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Target User Email (optional)</Label>
                <Input
                  placeholder="user@example.com (blank = anyone)"
                  value={form.target_user_email}
                  onChange={e => setForm({ ...form, target_user_email: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={creating || !form.code.trim()}>
                {creating ? "Creating…" : "Create Promo"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {promos.map(p => (
          <Card key={p.id} className="border-border/50">
            <CardContent className="pt-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-semibold text-sm">{p.code}</code>
                    <button onClick={() => copyCode(p.code)} className="p-1 hover:bg-muted rounded">
                      {copiedCode === p.code ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                    </button>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || STATUS_COLORS.active}`}>
                      {p.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Grants <span className="font-medium capitalize">{p.granted_plan}</span> for {p.granted_months}mo ·
                    {" "}Used {p.used_count}/{p.max_uses}
                  </div>
                  {p.description && (
                    <div className="text-xs text-muted-foreground/70 mt-0.5">{p.description}</div>
                  )}
                </div>
              </div>
              {p.status === "active" && (
                <Button size="sm" variant="ghost" onClick={() => handleDisable(p.id)}>
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {promos.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">No promo codes yet. Create one to get started.</div>
        )}
      </div>
    </div>
  );
}