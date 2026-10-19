import React, { useState } from "react";
import { ChevronDown, Layers, Globe } from "lucide-react";

const TEMPLATE_FIELDS = [
  { key: "what_to_build", label: "What to build", ph: "e.g. Local SEO landing page for {business_type} in {location}" },
  { key: "how_it_looks", label: "How it looks", ph: "e.g. Clean, modern, {color} brand colors, mobile-first" },
  { key: "how_it_functions", label: "How it functions", ph: "e.g. Contact form, booking, Google Maps, testimonials" },
  { key: "what_it_connects_to", label: "Connects to", ph: "e.g. Google Calendar, Gmail, Stripe, Analytics" },
  { key: "what_it_says", label: "What it says", ph: "e.g. Trust-building copy for {business_name}" },
  { key: "how_it_operates", label: "How it operates", ph: "e.g. Auto-responds to leads, weekly reports" },
  { key: "deliver_to", label: "Deliver to", ph: "e.g. Railway + GitHub repo + {domain}" }
];

const DEPLOY_TARGETS = [
  { id: "railway", label: "Railway" },
  { id: "vercel", label: "Vercel" },
  { id: "github", label: "GitHub" },
  { id: "custom", label: "Custom Domain" }
];

export default function BatchBuilder({ form, setForm }) {
  const [showTemplate, setShowTemplate] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleDeploy = (id) => setForm(f => ({ ...f, deploy_targets: f.deploy_targets.includes(id) ? f.deploy_targets.filter(t => t !== id) : [...f.deploy_targets, id] }));

  return (
    <section className="xa-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-[#FFF7B3] flex items-center justify-center"><Layers className="w-5 h-5 text-[#8A7300]" /></div>
        <div>
          <h2 className="font-heading font-bold text-lg text-black">Batch Builder</h2>
          <p className="text-xs text-black/50">Define the template — variables fill it per-site</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <input className="xa-input col-span-2" placeholder="Batch name (e.g. 'Dental Sites Q4')" value={form.name} onChange={e => set("name", e.target.value)} />
          <input type="number" className="xa-input" placeholder="Count" value={form.batch_size} onChange={e => set("batch_size", +e.target.value)} />
        </div>
        <p className="text-[10px] text-black/40 -mt-1 ml-1">Use {"{variables}"} like {"{domain}"}, {"{business_name}"}, {"{location}"} in the template — they'll be replaced per-site from your variables.</p>

        <button onClick={() => setShowTemplate(!showTemplate)} className="flex items-center justify-between w-full p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] text-sm font-bold text-black">
          <span>Template spec</span><ChevronDown className={`w-4 h-4 transition-transform ${showTemplate ? "rotate-180" : ""}`} />
        </button>
        {showTemplate && (
          <div className="space-y-2.5">
            {TEMPLATE_FIELDS.map(f => (
              <div key={f.key}>
                <label className="text-xs font-bold text-black/60 block mb-1">{f.label}</label>
                <textarea className="xa-input min-h-[60px] py-2 resize-y" placeholder={f.ph} value={form.template[f.key] || ""} onChange={e => set("template", { ...form.template, [f.key]: e.target.value })} />
              </div>
            ))}
          </div>
        )}

        <button onClick={() => setShowVars(!showVars)} className="flex items-center justify-between w-full p-3 rounded-xl bg-[#FAFAFA] border border-[#E5E7EB] text-sm font-bold text-black">
          <span>Variables (per-site data)</span><ChevronDown className={`w-4 h-4 transition-transform ${showVars ? "rotate-180" : ""}`} />
        </button>
        {showVars && (
          <div>
            <textarea className="xa-input min-h-[120px] py-2 resize-y font-mono text-xs" placeholder={'[\n  {"domain":"dental1.com","business_name":"Smile Co","location":"Austin, TX"},\n  {"domain":"dental2.com","business_name":"Bright Dental","location":"Denver, CO"}\n]'} value={form.variables} onChange={e => set("variables", e.target.value)} />
            <p className="text-[10px] text-black/40 mt-1 ml-1">JSON array — one object per site. If fewer than batch size, the template repeats with generated names.</p>
          </div>
        )}

        <div>
          <label className="text-xs font-bold text-black/60 block mb-1.5 flex items-center gap-1"><Globe className="w-3 h-3" /> Deploy targets</label>
          <div className="flex flex-wrap gap-2">
            {DEPLOY_TARGETS.map(d => (
              <button key={d.id} onClick={() => toggleDeploy(d.id)}
                className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${form.deploy_targets.includes(d.id) ? "border-transparent text-black" : "border-[#E5E7EB] text-black/50"}`}
                style={form.deploy_targets.includes(d.id) ? { background: "linear-gradient(135deg,#FFF7B3,#FFEA00 20%,#E6D400 45%,#FFEE33 65%,#FFEA00 80%,#CCBB00)" } : {}}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}