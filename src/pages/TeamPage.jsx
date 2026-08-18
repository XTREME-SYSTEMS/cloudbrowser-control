import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, Crown, Shield, Eye } from "lucide-react";

const ROLE_ICONS = { admin: Crown, developer: Shield, viewer: Eye };
const ROLE_COLORS = { admin: "text-orange-500", developer: "text-blue-500", viewer: "text-muted-foreground" };

export default function TeamPage() {
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [loading, setLoading] = useState(true);

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

  const invite = async () => {
    if (!inviteEmail) return;
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      setInviteEmail("");
      const users = await base44.entities.User.list();
      setMembers(users);
    } catch (e) { alert(e.response?.data?.error || e.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;

  if (!team) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl md:text-3xl font-heading font-bold flex items-center gap-2"><Users className="w-7 h-7" />Team</h1>
        <Card><CardContent className="pt-6 text-center space-y-4">
          <p className="text-muted-foreground">You don't have a team yet. Create one to invite members and collaborate.</p>
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

      {/* Invite */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><UserPlus className="w-4 h-4" />Invite Member</CardTitle></CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="member@example.com" type="email" />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="px-3 py-2 rounded-md border bg-transparent text-sm">
            <option value="user">Developer</option>
            <option value="admin">Admin</option>
          </select>
          <Button onClick={invite} disabled={!inviteEmail}><UserPlus className="w-4 h-4 mr-1" />Invite</Button>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader><CardTitle className="text-base">Members ({members.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((m) => {
              const RoleIcon = ROLE_ICONS[m.role] || Eye;
              return (
                <div key={m.id} className="flex items-center justify-between p-3 border rounded">
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
    </div>
  );
}