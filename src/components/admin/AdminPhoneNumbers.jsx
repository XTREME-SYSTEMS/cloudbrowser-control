import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Globe, Server, MapPin } from "lucide-react";

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

  if (loading) {
    return <div className="grid grid-cols-3 gap-4">{Array.from({length:3}).map((_,i)=><div key={i} className="h-28 rounded-md bg-[#191a1c] border border-[#34363a] animate-pulse xa-carbon" />)}</div>;
  }

  const activeProxies = proxies.filter(p => p.status === "active" || p.status === "healthy" || p.active === true);
  const regions = [...new Set(proxies.map(p => p.region || p.country || "unknown").filter(Boolean))];

  const summary = [
    { label: "Total Proxies", value: proxies.length, icon: Server, accent: "from-blue-500 to-blue-700" },
    { label: "Active", value: activeProxies.length, icon: Globe, accent: "from-emerald-500 to-emerald-700" },
    { label: "Regions", value: regions.length, icon: MapPin, accent: "from-[#b95700] to-[#ff8800]" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {summary.map(c => (
          <Card key={c.label} className="border-[#34363a] bg-[#191a1c] xa-carbon">
            <CardContent className="pt-5 text-center">
              <div className={`w-10 h-10 rounded-md bg-gradient-to-br ${c.accent} flex items-center justify-center mx-auto mb-3`}>
                <c.icon className="w-5 h-5 text-white" />
              </div>
              <div className="text-2xl font-bold text-[#e7e8e9] font-heading">{c.value}</div>
              <div className="text-xs text-[#9ca3af] mt-0.5">{c.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-3">
        {proxies.map(p => {
          const isActive = p.status === "active" || p.status === "healthy" || p.active === true;
          return (
            <Card key={p.id} className="border-[#34363a] bg-[#191a1c] xa-carbon hover:border-[#414347] transition-colors">
              <CardContent className="pt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${isActive ? "bg-gradient-to-br from-emerald-500 to-emerald-700" : "bg-[#34363a]"}`}>
                    <Globe className={`w-5 h-5 ${isActive ? "text-white" : "text-[#777d83]"}`} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm font-mono text-[#e7e8e9]">{p.ip_address || p.host || p.server || "—"}</div>
                    <div className="text-xs text-[#9ca3af] mt-0.5">
                      {p.region || p.country || "Unknown region"} · {p.provider || "Unknown provider"}
                      {p.ip_type && ` · ${p.ip_type}`}
                    </div>
                  </div>
                </div>
                <Badge className={isActive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-[#34363a] text-[#777d83] border-[#414347]"}>
                  {isActive ? "active" : (p.status || "inactive")}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
        {proxies.length === 0 && (
          <div className="text-center py-16 text-[#777d83]">
            <Phone className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <div className="text-sm font-medium">No proxies configured</div>
            <div className="text-xs mt-1">Add proxies from the Proxies page</div>
          </div>
        )}
      </div>
    </div>
  );
}