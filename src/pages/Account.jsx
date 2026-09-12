import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { User, Mail, Shield, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function Account() {
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    base44
      .auth.me()
      .then((u) => {
        setUser(u);
        setFullName(u.full_name || "");
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: fullName });
      setMessage("Profile updated successfully");
    } catch {
      setMessage("Failed to update profile");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  };

  if (!user)
    return (
      <div className="flex justify-center p-8">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-xl bg-gold-gradient p-6 text-black">
        <h1 className="text-2xl font-bold font-heading">Account</h1>
        <p className="text-sm text-black/80 mt-1">Manage your profile and account preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Full Name</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1" placeholder="Your name" />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              {user.email}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Role</label>
            <div className="mt-1">
              <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                <Shield className="h-3 w-3 mr-1" />
                {user.role || "user"}
              </Badge>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          {message && <p className="text-sm text-emerald-600">{message}</p>}
        </CardContent>
      </Card>
    </div>
  );
}