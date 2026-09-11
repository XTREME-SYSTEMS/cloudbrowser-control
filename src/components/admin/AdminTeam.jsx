import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Users, Crown, Shield, Eye, Trash2, Loader2, CheckCircle2, Mail } from "lucide-react";

const ROLE_ICONS = { admin: Crown, user: Shield, viewer: Eye };
const ROLE_COLORS = { admin: "text-orange-500", user: "text-blue-500", viewer: "text-muted-foreground" };

export default function AdminTeam() {
  const [members, setMembers] = useState([]);
  const [emails, setEmails] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);

  const load = async () => {
    try {
      const users = await base44.entities.User.list();
      setMembers(users);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const inviteBulk = async () => {
    const emailList = emails.split(/[\n,]/).map((e) => e.trim()).filter((e) => e && e.includes("@"));
    if (emailList.length === 0) return;
    setBusy(true);
    setResults([]);
    const batchResults = [];
    for (const email of emailList) {
      try {
        await base44.users.inviteUser(email, role);
        batchResults.push({ email, ok: true, msg: "Invited" });
      } catch (err) {
        batchResults.push({ email, ok: false, msg: err.response?.data?.error || err.message });
      }
    }
    setResults(batchResults);
    setEmails("");
    setBusy(false);
    load();
  };

  const setMemberRole = async (userId, newRole) => {
    try {
      await base44.entities.User.update(userId, { role: newRole });
      load();
    } catch (err) {
      console.error("Failed to update role:", err);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Bulk Invite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" />Add Team Members</CardTitle>
          <CardDescription>Invite multiple emails at once — add your adjutant, team members, and collaborators</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Addresses (one per line or comma-separated)</label>
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder={"adjutant@example.com\nteam-member@example.com\ncollaborator@example.com"}
              rows={5}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-muted-foreground">Role:</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-1.5 rounded-md border bg-transparent text-sm">
              <option value="user">Developer (user)</option>
              <option value="admin">Admin</option>
            </select>
            <Button onClick={inviteBulk} disabled={busy || !emails.trim()}>
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
              {busy ? "Inviting..." : "Invite All"}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className={"flex items-center gap-2 text-xs p-2 rounded border " + (r.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5")}>
                  {r.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Trash2 className="w-3 h-3 text-red-500" />}
                  <span className="font-mono">{r.email}</span>
                  <span className={r.ok ? "text-emerald-500" : "text-red-500"}>{r.msg}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" />Team Members ({members.length})</CardTitle>
          <CardDescription>Manage roles and access for all team members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((m) => {
              const RoleIcon = ROLE_ICONS[m.role] || Eye;
              return (
                <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">
                      {(m.full_name || m.email || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{m.full_name || m.email}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleIcon className={"w-4 h-4 " + (ROLE_COLORS[m.role] || "")} />
                    <select
                      value={m.role || "user"}
                      onChange={(e) => setMemberRole(m.id, e.target.value)}
                      className="px-2 py-1 rounded border bg-transparent text-xs"
                    >
                      <option value="user">Developer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}