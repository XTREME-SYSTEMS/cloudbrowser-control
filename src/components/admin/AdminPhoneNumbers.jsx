import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Globe, Server } from "lucide-react";

export default function AdminPhoneNumbers() {
  const [proxies, setProxies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Proxy.list("-created_date", 100).catch(() => []);
        setProxies(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="text-muted-foreground text-sm">Loading proxy numbers…</div>;

  const activeProxies = proxies.filter(p => p.status === "active" || p.status === "healthy");
  const regions = [...new Set(proxies.map(p => p.region || p.country || "unknown").filter(Boolean))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Phone Numbers & Proxies</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage proxy IP addresses and phone numbers used for SMS verification and geo-targeted automation.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-5 text-center">
            <Server className="w-5 h-5 text-amber-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{proxies.length}</div>
            <div className="text-xs text-muted-foreground">Total Proxies</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 text-center">
            <Globe className="w-5 h-5 text-amber-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{activeProxies.length}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-5 text-center">
            <Phone className="w-5 h-5 text-amber-600 mx-auto mb-2" />
            <div className="text-2xl font-bold">{regions.length}</div>
            <div className="text-xs text-muted-foreground">Regions</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3">
        {proxies.map(p => (
          <Card key={p.id} className="border-border/50">
            <CardContent className="pt-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Globe className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="font-semibold text-sm font-mono">{p.ip_address || p.host || "—"}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.region || p.country || "Unknown region"} · {p.provider || "Unknown provider"}
                  </div>
                </div>
              </div>
              <Badge className={
                p.status === "active" || p.status === "healthy"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-muted text-muted-foreground"
              }>
                {p.status || "unknown"}
              </Badge>
            </CardContent>
          </Card>
        ))}
        {proxies.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No proxies configured. Add proxies from the Proxies page.
          </div>
        )}
      </div>
    </div>
  );
}