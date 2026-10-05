import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Sparkles, Rocket, Check } from "lucide-react";

const BUILD_TYPES = [
  { value: "website", label: "Website", icon: "🌐" },
  { value: "web_app", label: "Web App", icon: "⚡" },
  { value: "landing_page", label: "Landing Page", icon: "📄" },
  { value: "api", label: "API / Backend", icon: "🔌" },
  { value: "automation", label: "Automation", icon: "🔄" },
  { value: "dashboard", label: "Dashboard", icon: "📊" },
  { value: "tool", label: "Tool", icon: "🛠️" },
  { value: "system", label: "Full System", icon: "🏗️" }
];

const FIELDS = [
  { key: "what_to_build", label: "What to build", ph: "e.g. A SaaS landing page for a dental practice with booking, testimonials, and SEO optimization" },
  { key: "how_it_looks", label: "How it looks", ph: "e.g. Clean, modern, white with blue accents, professional medical aesthetic, mobile-first" },
  { key: "how_it_functions", label: "How it functions", ph: "e.g. Online booking form, contact form, Google Maps integration, testimonial carousel, FAQ accordion" },
  { key: "what_it_connects_to", label: "What it connects to", ph: "e.g. Google Calendar for booking, Gmail for notifications, Stripe for payments, Google Analytics" },
  { key: "what_it_says", label: "What it says", ph: "e.g. Friendly, professional, trust-building copy. Headline: 'Your healthiest smile starts here'" },
  { key: "how_it_operates", label: "How it operates", ph: "e.g. Auto-responds to form submissions within 5 min, sends weekly performance reports, monitors uptime" },
  { key: "deliver_to", label: "Deliver to", ph: "e.g. GitHub repo + deploy to Railway at myapp.up.railway.app + email report to me@gmail.com" }
];

export default function SystemBuilderForm({ onSubmitted }) {
  const [form, setForm] = useState({ title: "", build_type: "website", what_to_build: "", how_it_looks: "", how_it_functions: "", what_it_connects_to: "", what_it_says: "", how_it_operates: "", deliver_to: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim() || !form.what_to_build.trim()) return;
    setSubmitting(true);
    try {
      const build = await base44.entities.SystemBuild.create(form);
      const task = await base44.entities.AgentTask.create({
        agent_name: "meta_architect", task_type: "build_system", title: `Build: ${form.title}`,
        description: JSON.stringify({ ...form, build_id: build.id }), priority: "high", autonomous: true, status: "pending"
      });
      await base44.entities.SystemBuild.update(build.id, { task_id: task.id, status: "planning" });
      setSuccess(build.id);
      setForm({ title: "", build_type: "website", what_to_build: "", how_it_looks: "", how_it_functions: "", what_it_connects_to: "", what_it_says: "", how_it_operates: "", deliver_to: "" });
      if (onSubmitted) onSubmitted();
    } catch (e) { alert(e.message); }
    setSubmitting(false);
  };

  if (success) {
    return (
      <section className="xa-card p-6 text-center">
        <div className="w-14 h-14 mx-auto rounded-full bg-green-50 flex items-center justify-center"><Check className="w-7 h-7 text-green-600" /></div>
        <h3 className="font-heading font-bold text-lg text-black mt-3">Build submitted!</h3>
        <p className="text-sm text-black/50 mt-1">Your system spec is queued. The autonomous worker will pick it up and start building.</p>
        <button onClick={() => setSuccess(null)} className="xa-btn-outline mt-4">Build another</button>
      </section>
    );
  }

  return (
    <section className="xa-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center"><Sparkles className="w-5 h-5 text-muted-foreground" /></div>
        <div>
          <h2 className="font-heading font-bold text-lg text-black">System Builder</h2>
          <p className="text-xs text-black/50">Type your spec, press build, get it delivered — autonomously</p>
        </div>
      </div>

      <div className="space-y-3">
        <input className="xa-input" placeholder="System name (e.g. 'Dental Practice Landing Page')" value={form.title} onChange={e => set("title", e.target.value)} />

        <div className="flex flex-wrap gap-2">
          {BUILD_TYPES.map(t => (
            <button key={t.value} onClick={() => set("build_type", t.value)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${form.build_type === t.value ? "border-transparent text-black" : "border-[#E5E7EB] text-black/50"}`}
              className={form.build_type === t.value ? "border-primary bg-muted/50" : "border-border"}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>

        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="text-xs font-bold text-black/60 block mb-1">{f.label}</label>
            <textarea className="xa-input min-h-[70px] py-2.5 resize-y" placeholder={f.ph} value={form[f.key]} onChange={e => set(f.key, e.target.value)} />
          </div>
        ))}

        <button onClick={submit} disabled={submitting || !form.title.trim() || !form.what_to_build.trim()} className="xa-btn-primary w-full py-3.5 text-base">
          {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting build…</> : <><Rocket className="w-5 h-5" /> Launch build</>}
        </button>
      </div>
    </section>
  );
}