import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Users as UsersIcon, UserPlus, ExternalLink, Mail, Crown, Loader2,
  CheckCircle2, Search,
} from "lucide-react";

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      const data = await base44.entities.User.list("-created_date", 100);
      setUsers(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteResult(null);
    try {
      await base44.users.inviteUser(inviteEmail.trim(), inviteRole);
      setInviteResult({ success: true, email: inviteEmail.trim() });
      setInviteEmail("");
      setShowInvite(false);
      load();
    } catch (e) {
      setInviteResult({ error: e.message || "Failed to invite user" });
    } finally {
      setInviting(false);
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.email || "").toLowerCase().includes(q) || (u.full_name || "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Create test accounts, manage roles, and preview the user dashboard.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard")}>
            <ExternalLink className="w-4 h-4 mr-1" /> View User Dashboard
          </Button>
          <Button onClick={() => setShowInvite(!showInvite)} className="bg-gold-gradient text-black">
            <UserPlus className="w-4 h-4 mr-1" /> Create Account
          </Button>
        </div>
      </div>

      {/* Invite result */}
      {inviteResult?.success && (
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardContent className="pt-5 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <div>
              <div className="font-semibold text-sm">Invitation sent to {inviteResult.email}</div>
              <div className="text-xs text-muted-foreground">The user will receive an email to complete registration.</div>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setInviteResult(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {/* Invite form */}
      {showInvite && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-sm">Create New Account</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="testuser@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setInviteRole("user")}
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                      inviteRole === "user" ? "bg-amber-500 text-black border-amber-500" : "border-border hover:border-amber-300")}
                  >
                    User
                  </button>
                  <button
                    onClick={() => setInviteRole("admin")}
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                      inviteRole === "admin" ? "bg-amber-500 text-black border-amber-500" : "border-border hover:border-amber-300")}
                  >
                    Admin
                  </button>
                </div>
              </div>
            </div>
            {inviteResult?.error && <div className="text-sm text-red-500">{inviteResult.error}</div>}
            <div className="flex gap-2">
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="bg-gold-gradient text-black">
                {inviting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
                {inviting ? "Sending Invite…" : "Send Invitation"}
              </Button>
              <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* User list */}
      {loading ? (
        <div className="text-muted-foreground text-sm">Loading users…</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(u => (
            <Card key={u.id} className="border-border/50">
              <CardContent className="pt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    u.role === "admin" ? "bg-amber-100" : "bg-blue-100")}>
                    {u.role === "admin" ? <Crown className="w-5 h-5 text-amber-600" /> : <UsersIcon className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{u.full_name || u.email}</span>
                      <Badge variant="outline" className="text-xs capitalize">{u.role || "user"}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                    {u.created_date && <div className="text-xs text-muted-foreground mt-0.5">Joined {new Date(u.created_date).toLocaleDateString()}</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">No users found.</div>
          )}
        </div>
      )}
    </div>
  );
}