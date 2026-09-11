import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Crown, Shield, Eye, Mail, Loader2, CheckCircle2, XCircle, Building2, Link as LinkIcon, Copy } from "lucide-react";

const ROLE_ICONS = { admin: Crown, user: Shield, viewer: Eye };
const ROLE_COLORS = { admin: "text-orange-500", user: "text-blue-500", viewer: "text-muted-foreground" };

export default function TeamPage() {
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [emails, setEmails] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const teams = await base44.entities.Team.list("-created_date", 1);
        if (teams[0]) {
          setTeam(teams[0]);
          const users = await base44.entities.User.list();
          setMembers(users);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const createTeam = async () => {
    try {
      const user = await base44.auth.me();
      const newTeam = await base44.entities.Team.create({ name: `${user.full_name || user.email}'s Team`, owner_id: user.id, member_ids: [user.id] });
      setTeam(newTeam);
    } catch (e) { alert(e.message); }
  };

  const inviteBulk = async () => {
    const emailList = emails.split(/[\n,]/).map((e) => e.trim()).filter((e) => e && e.includes("@"));
    if (emailList.length === 0) return;
    setBusy(true);
    setResults([]);
    const batchResults = [];
    for (const email of emailList) {
      try {
        await base44.users.inviteUser(email, inviteRole);
        batchResults.push({ email, ok: true, msg: "Invited" });
      } catch (err) {
        batchResults.push({ email, ok: false, msg: err.response?.data?.error || err.message });
      }
    }
    setResults(batchResults);
    setEmails("");
    setBusy(false);
    const users = await base44.entities.User.list();
    setMembers(users);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;

  if (!team) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><Users className="w-7 h-7" />Team</h1>
        <Card><CardContent className="pt-6 text-center space-y-4">
          <p className="text-muted-foreground">You don't have a team yet. Create one to invite your adjutant and collaborators.</p>
          <Button onClick={createTeam}><UserPlus className="w-4 h-4 mr-2" />Create Team</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><Users className="w-7 h-7" />Team</h1>
        <p className="text-muted-foreground mt-1">{team.name}</p>
      </div>

      {/* Bulk Invite */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4" />Invite Members</CardTitle>
          <CardDescription>Add your adjutant, team members, and collaborators — multiple emails at once</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Email Addresses (one per line or comma-separated)</label>
            <textarea
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder={"adjutant@example.com\nteam-member@example.com\ncollaborator@example.com"}
              rows={4}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="px-3 py-2 rounded-md border bg-transparent text-sm">
              <option value="user">Developer</option>
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
                  {r.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
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
          <CardTitle className="text-base">Members ({members.length})</CardTitle>
          <CardDescription>Your team — work together on architecture, skip tracing, and clone projects</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((m) => {
              const RoleIcon = ROLE_ICONS[m.role] || Eye;
              return (
                <div key={m.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold">{(m.full_name || m.email || "?")[0].toUpperCase()}</div>
                    <div><p className="text-sm font-medium">{m.full_name || m.email}</p><p className="text-xs text-muted-foreground">{m.email}</p></div>
                  </div>
                  <div className="flex items-center gap-2"><RoleIcon className={`w-4 h-4 ${ROLE_COLORS[m.role] || ""}`} /><span className="text-sm capitalize">{m.role || "user"}</span></div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Architecture collaboration */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-primary" />
            <div>
              <p className="text-sm font-medium">Architecture Collaboration</p>
              <p className="text-xs text-muted-foreground">Work together on the FAANG enterprise architecture goals</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => window.location.href = "/architecture"}>
            <LinkIcon className="w-3 h-3 mr-1" />Open Architecture
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}