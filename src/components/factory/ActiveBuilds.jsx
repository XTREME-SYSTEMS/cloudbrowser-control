import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, ExternalLink, Package } from "lucide-react";

const STATUS_META = {
  spec_submitted: { color: "#8A7300", bg: "#FFF7B3", label: "Submitted" },
  planning: { color: "#2563EB", bg: "#DBEAFE", label: "Planning" },
  building: { color: "#2563EB", bg: "#DBEAFE", label: "Building" },
  deploying: { color: "#7C3AED", bg: "#EDE9FE", label: "Deploying" },
  delivered: { color: "#16A34A", bg: "#DCFCE7", label: "Delivered" },
  failed: { color: "#DC2626", bg: "#FEE2E2", label: "Failed" }
};

export default function ActiveBuilds({ refreshKey }) {
  const [builds, setBuilds] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.SystemBuild.filter({}, { sort: "-created_date", limit: 50 });
      setBuilds(res.items || []);
    } catch (e) { setBuilds([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { const i = setInterval(load, 10000); return () => clearInterval(i); }, [load]);

  return (
    <section className="xa-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#FFF7B3] flex items-center justify-center"><Package className="w-5 h-5 text-[#8A7300]" /></div>
          <div>
            <h2 className="font-heading font-bold text-lg text-black">Active Builds</h2>
            <p className="text-xs text-black/50">Systems being built and delivered by the autonomous worker</p>
          </div>
        </div>
        <button onClick={load} className="text-black/50 hover:text-black"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#CCBB00]" /></div> : builds.length === 0 ? (
        <div className="text-center py-8"><Package className="w-8 h-8 mx-auto text-black/20" /><p className="text-sm text-black/50 mt-2">No builds yet. Submit a system spec above to start.</p></div>
      ) : (
        <div className="space-y-2">
          {builds.map(b => {
            const meta = STATUS_META[b.status] || STATUS_META.spec_submitted;
            return (
              <div key={b.id} className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-black text-sm truncate">{b.title}</div>
                    <div className="text-xs text-black/45 capitalize">{b.build_type?.replace("_", " ")}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                </div>
                {b.what_to_build && <p className="text-xs text-black/55 mt-1.5 line-clamp-2">{b.what_to_build}</p>}
                {b.build_stage && b.status !== 'delivered' && b.status !== 'failed' && <p className="text-xs text-black/40 mt-1.5">{b.build_stage}</p>}
                {b.deployment_url && (
                  <a href={b.deployment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#CCBB00] mt-2 hover:underline">
                    <ExternalLink className="w-3 h-3" /> {b.deployment_url}
                  </a>
                )}
                {b.status === 'failed' && b.last_error && <p className="text-xs text-red-600 mt-1.5 line-clamp-3">{b.last_error}</p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}