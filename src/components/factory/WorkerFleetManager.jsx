import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Plus, Copy, Trash2, Server, Cpu } from "lucide-react";

const FOCUS_LABELS = { all: "All tasks", growth: "Growth ops", builds: "System builds", social: "Social", sales: "Sales", brand: "Brand" };
const DEPLOY_LABELS = { local: "Local machine", railway: "Railway 24/7", both: "Local + Railway" };

export default function WorkerFleetManager() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", poll_interval: 60000, max_cycles: 5, focus_area: "all", deploy_target: "local", report_email: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.WorkerFleet.filter({}, { sort: "-created_date", limit: 50 });
      setWorkers(res.items || []);
    } catch (e) { setWorkers([]); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name.trim()) return;
    try {
      await base44.entities.WorkerFleet.create({ ...form, active: true });
      setForm({ name: "", poll_interval: 60000, max_cycles: 5, focus_area: "all", deploy_target: "local", report_email: "" });
      setShowForm(false);
      await load();
    } catch (e) { alert(e.message); }
  };

  const remove = async (id) => {
    try { await base44.entities.WorkerFleet.delete(id); await load(); } catch (e) {}
  };

  const copyConfig = (w) => {
    const cfg = `APP_URL=https://cloud-browser.base44.app\nWORKER_SECRET=<your-secret>\nPOLL_INTERVAL=${w.poll_interval}\nMAX_CYCLES=${w.max_cycles}\nREPORT_EMAIL=${w.report_email || ""}`;
    navigator.clipboard.writeText(cfg);
  };

  return (
    <section className="xa-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-[#FFF7B3] flex items-center justify-center"><Server className="w-5 h-5 text-[#8A7300]" /></div>
          <div>
            <h2 className="font-heading font-bold text-lg text-black">Worker Fleet</h2>
            <p className="text-xs text-black/50">Spin up multiple autonomous workers — each with its own config</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="xa-btn-primary"><Plus className="w-4 h-4" /> New worker</button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] space-y-3">
          <input className="xa-input" placeholder="Worker name (e.g. 'Growth Worker 1')" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs"><span className="font-bold text-black/60 block mb-1">Poll interval (ms)</span><input type="number" className="xa-input" value={form.poll_interval} onChange={e => setForm({ ...form, poll_interval: +e.target.value })} /></label>
            <label className="text-xs"><span className="font-bold text-black/60 block mb-1">Max cycles</span><input type="number" className="xa-input" value={form.max_cycles} onChange={e => setForm({ ...form, max_cycles: +e.target.value })} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className="xa-input" value={form.focus_area} onChange={e => setForm({ ...form, focus_area: e.target.value })}>
              {Object.entries(FOCUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select className="xa-input" value={form.deploy_target} onChange={e => setForm({ ...form, deploy_target: e.target.value })}>
              {Object.entries(DEPLOY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <input className="xa-input" placeholder="Report email (optional)" value={form.report_email} onChange={e => setForm({ ...form, report_email: e.target.value })} />
          <button onClick={create} className="xa-btn-primary w-full">Create worker</button>
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-[#CCBB00]" /></div> : workers.length === 0 ? (
        <div className="text-center py-8"><Cpu className="w-8 h-8 mx-auto text-black/20" /><p className="text-sm text-black/50 mt-2">No workers yet. Create one to start spinning up systems.</p></div>
      ) : (
        <div className="space-y-2">
          {workers.map(w => (
            <div key={w.id} className="p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] flex items-center gap-3">
              <div className={`w-2 h-10 rounded-full ${w.active ? "bg-green-400" : "bg-gray-300"}`} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-black text-sm truncate">{w.name}</div>
                <div className="text-xs text-black/45">{w.poll_interval / 1000}s · {w.max_cycles} cycles · {FOCUS_LABELS[w.focus_area]} · {DEPLOY_LABELS[w.deploy_target]}</div>
              </div>
              <button onClick={() => copyConfig(w)} className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-[#E5E7EB]"><Copy className="w-4 h-4 text-black/50" /></button>
              <button onClick={() => remove(w.id)} className="p-2 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}