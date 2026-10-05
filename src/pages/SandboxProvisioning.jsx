import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Rocket, ShieldCheck, CheckCircle2, Globe, Zap, AlertCircle, ArrowRight, Beaker, Server } from "lucide-react";
import SandboxCard from "@/components/provisioning/SandboxCard";
import ComplianceReport from "@/components/provisioning/ComplianceReport";

const ALL_PROVIDERS = ["supabase", "railway", "googledrive", "github"];

export default function SandboxProvisioning() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [projectName, setProjectName] = useState("");
  const [selectedProviders, setSelectedProviders] = useState(ALL_PROVIDERS);
  const [sandboxes, setSandboxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [domain, setDomain] = useState("");
  const [tld, setTld] = useState("com");
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [buildId, setBuildId] = useState(null);

  const loadSandboxes = useCallback(async () => {
    setLoading(true);
    try {
      const page = await base44.entities.SandboxProject.filter(
        {},
        { sort: "-created_date", limit: 50 }
      );
      setSandboxes(page?.items || []);
    } catch (e) {
      setError("Failed to load: " + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadSandboxes(); }, [loadSandboxes]);

  const toggleProvider = (p) => {
    setSelectedProviders((prev) => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const handleCreate = async () => {
    if (!projectName.trim()) { setError("Enter a project name"); return; }
    if (selectedProviders.length === 0) { setError("Select at least one provider"); return; }
    setCreating(true);
    setError("");
    try {
      const res = await base44.functions.invoke("provisionSandboxProjects", {
        project_name: projectName.trim(),
        providers: selectedProviders,
        build_id: buildId
      });
      const data = res?.data || res;
      if (data.error) { setError(data.error); setCreating(false); return; }
      await loadSandboxes();
      setStep(2);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await base44.entities.SandboxProject.update(id, {
        approval_status: "approved",
        status: "approved",
        approved_at: new Date().toISOString()
      });
      await loadSandboxes();
    } catch (e) { setError("Approve failed: " + e.message); }
  };

  const handleReject = async (id) => {
    try {
      await base44.entities.SandboxProject.update(id, { approval_status: "rejected" });
      await loadSandboxes();
    } catch (e) { setError("Reject failed: " + e.message); }
  };

  const handleApproveAll = async () => {
    const active = sandboxes.filter(s => s.status === "active" && s.approval_status === "pending");
    for (const s of active) {
      await base44.entities.SandboxProject.update(s.id, {
        approval_status: "approved",
        status: "approved",
        approved_at: new Date().toISOString()
      });
    }
    await loadSandboxes();
  };

  const handlePromote = async () => {
    if (!domain.trim()) { setError("Enter a domain name to buy"); return; }
    if (!buildId) { setError("No build ID — create sandboxes with a build first"); return; }
    setPromoting(true);
    setError("");
    try {
      const res = await base44.functions.invoke("promoteToProduction", {
        build_id: buildId,
        domain: domain.trim().toLowerCase(),
        tld
      });
      const data = res?.data || res;
      if (data.error) { setError(data.error); setPromoting(false); return; }
      setReport(data.report || data);
      setStep(4);
      await loadSandboxes();
    } catch (e) {
      setError(e.message);
    } finally {
      setPromoting(false);
    }
  };

  const activeSandboxes = sandboxes.filter(s => s.status === "active" || s.status === "creating" || s.status === "failed");
  const approvedSandboxes = sandboxes.filter(s => s.status === "approved" || s.status === "promoted");
  const allApproved = activeSandboxes.length > 0 && activeSandboxes.every(s => s.approval_status === "approved");

  const StepHeader = () => (
    <div className="flex items-center gap-2 mb-4 overflow-x-auto">
      {[
        { n: 1, label: "Create Sandboxes", icon: Beaker },
        { n: 2, label: "Review & Approve", icon: ShieldCheck },
        { n: 3, label: "Promote to Production", icon: Rocket },
        { n: 4, label: "Compliance Report", icon: CheckCircle2 },
      ].map((s, i) => {
        const Icon = s.icon;
        const active = step === s.n;
        const done = step > s.n;
        return (
          <React.Fragment key={s.n}>
            <button onClick={() => s.n <= step && setStep(s.n)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${active ? "bg-black text-white" : done ? "bg-green-100 text-green-700" : "bg-[#FAFAFA] text-black/40"}`}>
              <Icon className="w-3.5 h-3.5" /> {s.n}. {s.label}
            </button>
            {i < 3 && <ArrowRight className="w-3 h-3 text-black/20 shrink-0" />}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <header className="border-b border-[#E5E7EB] bg-white sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="xa-pill-badge">SANDBOX → PRODUCTION</span>
            <h1 className="font-heading font-black text-xl sm:text-2xl text-black mt-1 truncate">Infrastructure Provisioning</h1>
            <p className="text-xs text-black/50 mt-0.5">GPT builds in sandboxes → you approve → we provision real accounts, buy domains & ensure 100% Google compliance.</p>
          </div>
          <button onClick={() => navigate("/provisioning")} className="xa-btn-outline text-xs px-3 py-2 shrink-0">← Credentials</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <StepHeader />

        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}

        {/* Step 1: Create Sandboxes */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="xa-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Beaker className="w-5 h-5 text-[#8A7300]" />
                <h2 className="font-heading font-bold text-base text-black">Create Sandbox Projects</h2>
              </div>
              <p className="text-xs text-black/50 mb-4">GPT will create isolated sandbox projects within each provider. These are free-tier, isolated environments where the agent can build and test without touching production.</p>

              <label className="text-xs font-semibold text-black/70 mb-1 block">Project Name</label>
              <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g. my-saas-app" className="xa-input mb-4" />

              <label className="text-xs font-semibold text-black/70 mb-2 block">Select Providers</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {ALL_PROVIDERS.map((p) => {
                  const selected = selectedProviders.includes(p);
                  const labels = { supabase: "Supabase", railway: "Railway", googledrive: "Google Drive", github: "GitHub" };
                  const icons = { supabase: "🗄️", railway: "🚂", googledrive: "📁", github: "🐙" };
                  return (
                    <button key={p} onClick={() => toggleProvider(p)} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${selected ? "border-[#FFEA00] bg-[#FFF7B3]/30" : "border-[#E5E7EB] bg-white"}`}>
                      <span className="text-lg">{icons[p]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-black">{labels[p]}</div>
                        <div className="text-[10px] text-black/40">{selected ? "Selected" : "Click to select"}</div>
                      </div>
                      {selected && <CheckCircle2 className="w-4 h-4 text-[#8A7300] shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <button onClick={handleCreate} disabled={creating} className="xa-btn-primary w-full py-3.5 text-sm">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating sandboxes…</> : <><Rocket className="w-4 h-4" /> Create Sandbox Projects</>}
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-black/30" /></div>
            ) : sandboxes.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-black/50 uppercase tracking-wider px-1">Recent Sandboxes</h3>
                {sandboxes.slice(0, 5).map((s) => <SandboxCard key={s.id} sandbox={s} onApprove={handleApprove} onReject={handleReject} promoting={promoting} />)}
              </div>
            ) : null}
          </div>
        )}

        {/* Step 2: Review & Approve */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="xa-card p-4 flex items-center gap-3 bg-[#FFF7B3]/30 border-[#E6D400]/30">
              <ShieldCheck className="w-5 h-5 text-[#8A7300] shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-sm text-black">Review sandbox projects before production</div>
                <div className="text-xs text-black/50">Approve each sandbox to allow GPT to promote it to a real production account.</div>
              </div>
              {activeSandboxes.length > 0 && (
                <button onClick={handleApproveAll} disabled={promoting} className="xa-btn-primary text-xs px-3 py-2 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve All
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-black/30" /></div>
            ) : activeSandboxes.length === 0 ? (
              <div className="xa-card p-8 text-center">
                <p className="text-sm text-black/50">No active sandboxes to review. Create some first.</p>
                <button onClick={() => setStep(1)} className="xa-btn-outline text-xs px-3 py-2 mt-3">← Back to Create</button>
              </div>
            ) : (
              <>
                {activeSandboxes.map((s) => <SandboxCard key={s.id} sandbox={s} onApprove={handleApprove} onReject={handleReject} promoting={promoting} />)}
                {allApproved && (
                  <button onClick={() => setStep(3)} className="xa-btn-primary w-full py-3.5 text-sm">
                    <ArrowRight className="w-4 h-4" /> All approved — Continue to Production
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Promote to Production */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="xa-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Rocket className="w-5 h-5 text-[#8A7300]" />
                <h2 className="font-heading font-bold text-base text-black">Promote to Production</h2>
              </div>
              <p className="text-xs text-black/50 mb-4">On promotion, the system will: buy the domain, deploy to real accounts, submit the URL to Google Search Console, submit the sitemap, and run a 12-point compliance checklist for 100% Google compliance from day 1.</p>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-black/70 mb-1 block">Domain Name (to purchase)</label>
                  <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="my-saas-app" className="xa-input" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-black/70 mb-1 block">TLD</label>
                  <select value={tld} onChange={(e) => setTld(e.target.value)} className="xa-input">
                    <option value="com">.com</option>
                    <option value="net">.net</option>
                    <option value="io">.io</option>
                    <option value="ai">.ai</option>
                    <option value="app">.app</option>
                    <option value="store">.store</option>
                    <option value="site">.site</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                {[
                  { icon: Globe, text: "Buy domain via GoDaddy" },
                  { icon: Server, text: "Deploy to real Vercel + Supabase + Railway" },
                  { icon: Zap, text: "Submit URL to Google Search Console" },
                  { icon: CheckCircle2, text: "Submit sitemap.xml to GSC" },
                  { icon: ShieldCheck, text: "Run 12-point Google compliance checklist" },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[#FAFAFA] border border-[#E5E7EB]">
                      <Icon className="w-4 h-4 text-[#8A7300] shrink-0" />
                      <span className="text-xs text-black/70">{item.text}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 ml-auto" />
                    </div>
                  );
                })}
              </div>

              <button onClick={handlePromote} disabled={promoting || !domain.trim()} className="xa-btn-primary w-full py-3.5 text-sm">
                {promoting ? <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning production…</> : <><Rocket className="w-4 h-4" /> Approve & Promote to Production</>}
              </button>
            </div>

            <div>
              <h3 className="text-xs font-bold text-black/50 uppercase tracking-wider px-1 mb-2">Approved Sandboxes ({approvedSandboxes.length})</h3>
              {approvedSandboxes.map((s) => <SandboxCard key={s.id} sandbox={s} onApprove={handleApprove} onReject={handleReject} promoting={promoting} />)}
            </div>
          </div>
        )}

        {/* Step 4: Compliance Report */}
        {step === 4 && (
          <div className="space-y-4">
            <ComplianceReport report={report} />
            <div className="flex gap-2">
              <button onClick={() => { setStep(1); setReport(null); setProjectName(""); setDomain(""); }} className="xa-btn-outline flex-1 py-3 text-sm">New Project</button>
              <button onClick={() => navigate("/website-factory")} className="xa-btn-primary flex-1 py-3 text-sm"><Rocket className="w-4 h-4" /> Go to Factory</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}