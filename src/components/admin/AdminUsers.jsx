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

const usersApi = /** @type {any} */ (base44).users;

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
      await usersApi.inviteUser(inviteEmail.trim(), inviteRole);
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
          <h1 className="text-2xl font-heading font-bold text-[#e7e8e9]">User Management</h1>
          <p className="text-[#9ca3af] text-sm mt-1">Create test accounts, manage roles, and preview the user dashboard.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/dashboard")} className="border-[#34363a] text-[#b5b8bc] hover:bg-white/5 hover:text-[#e7e8e9]">
            <ExternalLink className="w-4 h-4 mr-1" /> View User Dashboard
          </Button>
          <Button onClick={() => setShowInvite(!showInvite)} className="bg-[#ff8800] text-[#171514] hover:bg-[#ffa333]">
            <UserPlus className="w-4 h-4 mr-1" /> Create Account
          </Button>
        </div>
      </div>

      {inviteResult?.success && (
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="pt-5 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <div>
              <div className="font-semibold text-sm text-[#e7e8e9]">Invitation sent to {inviteResult.email}</div>
              <div className="text-xs text-[#9ca3af]">The user will receive an email to complete registration.</div>
            </div>
            <Button variant="ghost" size="sm" className="ml-auto text-[#9ca3af] hover:bg-white/5" onClick={() => setInviteResult(null)}>Dismiss</Button>
          </CardContent>
        </Card>
      )}

      {showInvite && (
        <Card className="border-[#34363a] bg-[#191a1c] xa-carbon">
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <UserPlus className="w-5 h-5 text-[#ff8800]" />
              <h3 className="font-semibold text-sm text-[#e7e8e9]">Create New Account</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[#c0c1c3]">Email Address</Label>
                <Input
                  type="email"
                  placeholder="testuser@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="bg-[#191a1c] border-[#34363a] text-[#e7e8e9] placeholder-[#777d83]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[#c0c1c3]">Role</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setInviteRole("user")}
                    className={cn("px-4 py-2 rounded-md text-sm font-medium border transition-colors",
                      inviteRole === "user" ? "bg-[#ff8800] text-[#171514] border-[#ff8800]" : "border-[#34363a] text-[#b5b8bc] hover:border-[#ff8800]/30")}
                  >
                    User
                  </button>
                  <button
                    onClick={() => setInviteRole("admin")}
                    className={cn("px-4 py-2 rounded-md text-sm font-medium border transition-colors",
                      inviteRole === "admin" ? "bg-[#ff8800] text-[#171514] border-[#ff8800]" : "border-[#34363a] text-[#b5b8bc] hover:border-[#ff8800]/30")}
                  >
                    Admin
                  </button>
                </div>
              </div>
            </div>
            {inviteResult?.error && <div className="text-sm text-red-400">{inviteResult.error}</div>}
            <div className="flex gap-2">
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()} className="bg-[#ff8800] text-[#171514] hover:bg-[#ffa333]">
                {inviting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
                {inviting ? "Sending Invite…" : "Send Invitation"}
              </Button>
              <Button variant="outline" onClick={() => setShowInvite(false)} className="border-[#34363a] text-[#b5b8bc] hover:bg-white/5 hover:text-[#e7e8e9]">Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777d83]" />
        <Input
          placeholder="Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-[#191a1c] border-[#34363a] text-[#e7e8e9] placeholder-[#777d83]"
        />
      </div>

      {loading ? (
        <div className="text-[#9ca3af] text-sm">Loading users…</div>
      ) : (
        <div className="grid gap-2">
          {filtered.map(u => (
            <Card key={u.id} className="border-[#34363a] bg-[#191a1c] xa-carbon">
              <CardContent className="pt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-md flex items-center justify-center shrink-0",
                    u.role === "admin" ? "bg-[#ff8800]/10" : "bg-blue-500/10")}>
                    {u.role === "admin" ? <Crown className="w-5 h-5 text-[#ff8800]" /> : <UsersIcon className="w-5 h-5 text-blue-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#e7e8e9]">{u.full_name || u.email}</span>
                      <Badge variant="outline" className="text-xs capitalize border-[#414347] text-[#aeb1b4]">{u.role || "user"}</Badge>
                    </div>
                    <div className="text-xs text-[#9ca3af]">{u.email}</div>
                    {u.created_date && <div className="text-xs text-[#777d83] mt-0.5">Joined {new Date(u.created_date).toLocaleDateString()}</div>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-[#777d83] text-sm">No users found.</div>
          )}
        </div>
      )}
    </div>
  );
}