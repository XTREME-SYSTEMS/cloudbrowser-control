import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, RefreshCw, Layers } from "lucide-react";

const STATUS_META = {
  queued: { color: "hsl(var(--muted-foreground))", bg: "hsl(var(--muted))", label: "Queued" },
  dispatching: { color: "#2563EB", bg: "#DBEAFE", label: "Dispatching" },
  running: { color: "#2563EB", bg: "#DBEAFE", label: "Running" },
  complete: { color: "#16A34A", bg: "#DCFCE7", label: "Complete" },
  failed: { color: "#DC2626", bg: "#FEE2E2", label: "Failed" }
};

export default function BatchHistory({ refreshKey }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.BatchOperation.filter({}, { sort: "-created_date", limit: 20 });
      setBatches(res.items || []);
    } catch (e) { setBatches([]); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);
  useEffect(() => { const i = setInterval(load, 5000); return () => clearInterval(i); }, [load]);

  return (
    <section className="xa-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center"><Layers className="w-5 h-5 text-[hsl(var(--muted-foreground))]" /></div>
          <div>
            <h2 className="font-heading font-bold text-lg text-black">Batch History</h2>
            <p className="text-xs text-black/50">All mass operations — past + active</p>
          </div>
        </div>
        <button onClick={load} className="text-black/50 hover:text-black"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>

      {loading ? <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-foreground" /></div> : batches.length === 0 ? (
        <div className="text-center py-6"><Layers className="w-8 h-8 mx-auto text-black/20" /><p className="text-sm text-black/50 mt-2">No batches yet. Configure + launch one above.</p></div>
      ) : (
        <div className="space-y-2">
          {batches.map(b => {
            const meta = STATUS_META[b.status] || STATUS_META.queued;
            return (
              <div key={b.id} className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB]">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-black text-sm truncate">{b.name}</div>
                    <div className="text-xs text-black/45">{b.batch_size} sites · {b.sites_deployed || 0} deployed · {b.sites_failed || 0} failed · {b.progress || 0}%</div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>
                </div>
                <div className="flex gap-3 mt-2 text-[10px] text-black/50">
                  {b.google_connect && <span>🔍 Google</span>}
                  {b.social_connect && <span>📱 Social</span>}
                  {b.video_generate && <span>🎬 Video</span>}
                  {b.content_optimize && <span>✨ Content</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}