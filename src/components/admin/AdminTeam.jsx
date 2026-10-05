import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Users, Crown, Shield, Eye, Trash2, Loader2, CheckCircle2, Mail } from "lucide-react";

const ROLE_ICONS = { admin: Crown, user: Shield, viewer: Eye };
const ROLE_COLORS = { admin: "text-[#ff8800]", user: "text-blue-400", viewer: "text-[#9ca3af]" };
const usersApi = /** @type {any} */ (base44).users;

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
        await usersApi.inviteUser(email, role);
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
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#9ca3af]" /></div>;
  }

  return (
    <div className="space-y-6">
      <Card className="border-[#34363a] bg-[#191a1c] xa-carbon">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#e7e8e9]"><UserPlus className="w-5 h-5 text-[#ff8800]" />Add Team Members</CardTitle>
          <CardDescription className="text-[#9ca3af]">Invite multiple emails at once — add your adjutant, team members, and collaborators</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[#9ca3af] mb-1 block">Email Addresses (one per line or comma-separated)</label>
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder={"adjutant@example.com\nteam-member@example.com\ncollaborator@example.com"}
              rows={5}
              className="w-full rounded-md border border-[#34363a] bg-[#191a1c] px-3 py-2 text-sm font-mono text-[#e7e8e9] placeholder-[#777d83] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#ff8800]"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-[#9ca3af]">Role:</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-1.5 rounded-md border border-[#34363a] bg-[#191a1c] text-[#e7e8e9] text-sm">
              <option value="user">Developer (user)</option>
              <option value="admin">Admin</option>
            </select>
            <Button onClick={inviteBulk} disabled={busy || !emails.trim()} className="bg-[#ff8800] text-[#171514] hover:bg-[#ffa333]">
              {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
              {busy ? "Inviting..." : "Invite All"}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-1">
              {results.map((r, i) => (
                <div key={i} className={"flex items-center gap-2 text-xs p-2 rounded border " + (r.ok ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5")}>
                  {r.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Trash2 className="w-3 h-3 text-red-400" />}
                  <span className="font-mono text-[#c0c1c3]">{r.email}</span>
                  <span className={r.ok ? "text-emerald-400" : "text-red-400"}>{r.msg}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-[#34363a] bg-[#191a1c] xa-carbon">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#e7e8e9]"><Users className="w-5 h-5 text-[#ff8800]" />Team Members ({members.length})</CardTitle>
          <CardDescription className="text-[#9ca3af]">Manage roles and access for all team members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((m) => {
              const RoleIcon = ROLE_ICONS[m.role] || Eye;
              return (
                <div key={m.id} className="flex items-center justify-between p-3 border border-[#34363a] rounded-md bg-[#191a1c]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#ff8800]/10 flex items-center justify-center text-sm font-bold text-[#ff8800]">
                      {(m.full_name || m.email || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#e7e8e9]">{m.full_name || m.email}</p>
                      <p className="text-xs text-[#9ca3af]">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleIcon className={"w-4 h-4 " + (ROLE_COLORS[m.role] || "")} />
                    <select
                      value={m.role || "user"}
                      onChange={(e) => setMemberRole(m.id, e.target.value)}
                      className="px-2 py-1 rounded border border-[#34363a] bg-[#191a1c] text-[#c0c1c3] text-xs"
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