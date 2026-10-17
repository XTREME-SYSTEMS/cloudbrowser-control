import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  User, MapPin, Target, Palette, Rocket, CheckCircle2,
  ChevronRight, ChevronLeft, Loader2, Building2, Globe, Trophy
} from "lucide-react";

const STEPS = [
  { num: 1, name: "Profile", icon: User, desc: "Who you are" },
  { num: 2, name: "Market", icon: MapPin, desc: "Industry & audience" },
  { num: 3, name: "Goals", icon: Target, desc: "What success looks like" },
  { num: 4, name: "Brand", icon: Palette, desc: "Identity & competitors" },
  { num: 5, name: "Launch", icon: Rocket, desc: "Review & begin" },
];

const INDUSTRIES = [
  "Emergency Plumbing", "Epoxy Flooring", "Med Spa", "Estate Law", "Roofing",
  "HVAC", "Solar Installation", "Personal Injury", "Dental", "Mortgage",
  "Real Estate", "Insurance", "Auto Repair", "Landscaping", "Pest Control",
  "Other"
];

export default function OnboardingWizard({ onComplete }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState({
    client_name: "", client_email: "", client_phone: "", client_company: "", client_role: "",
    industry: "", target_market: "", geo_focus: "",
    business_goals: "", success_metrics: [], budget_range: "", timeline: "",
    brand_preferences: { voice: "", colors: [], style: "", references: [] },
    competitor_urls: [], current_website: "", differentiators: "",
  });

  const update = (field, value) => setData(prev => ({ ...prev, [field]: value }));
  const updateBrand = (field, value) => setData(prev => ({ ...prev, brand_preferences: { ...prev.brand_preferences, [field]: value } }));

  const canProceed = () => {
    if (step === 1) return data.client_name && data.client_email && data.industry;
    if (step === 2) return data.target_market && data.geo_focus;
    if (step === 3) return data.business_goals && data.budget_range;
    if (step === 4) return true;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const token = crypto.randomUUID();
      const engagement = await base44.entities.ClientEngagement.create({
        ...data,
        factory_status: "intake",
        factory_progress: 5,
        client_portal_token: token,
        status: "active",
        factory_stage_log: [{ stage: "intake", status: "complete", timestamp: new Date().toISOString(), message: "Client onboarding completed" }]
      });
      onComplete?.(engagement);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className={`flex flex-col items-center gap-1 ${step === s.num ? "" : "opacity-50"}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                step > s.num ? "bg-green-500/20 border-green-500 text-green-400" :
                step === s.num ? "bg-primary/20 border-primary text-primary" :
                "border-border text-muted-foreground"
              }`}>
                {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-4 h-4" />}
              </div>
              <span className={`text-[10px] font-display font-semibold tracking-wide ${step === s.num ? "text-primary" : "text-muted-foreground"}`}>{s.name}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground/30 mx-1" />}
          </div>
        ))}
      </div>

      <Card className="glass-panel">
        <CardContent className="p-6 space-y-5">
          {step === 1 && <StepProfile data={data} update={update} />}
          {step === 2 && <StepMarket data={data} update={update} />}
          {step === 3 && <StepGoals data={data} update={update} />}
          {step === 4 && <StepBrand data={data} update={update} updateBrand={updateBrand} />}
          {step === 5 && <StepReview data={data} />}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1 || submitting}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        {step < 5 ? (
          <Button onClick={() => setStep(s => Math.min(5, s + 1))} disabled={!canProceed()}>
            Continue <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting} className="min-w-[180px]">
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Initializing...</> : <><Rocket className="w-4 h-4" /> Launch Discovery</>}
          </Button>
        )}
      </div>
    </div>
  );
}

function StepProfile({ data, update }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-lg flex items-center gap-2"><User className="w-5 h-5 text-primary" /> Client Profile</h3>
        <p className="text-xs text-muted-foreground">Tell us about the primary decision maker</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Full Name *</Label>
          <Input value={data.client_name} onChange={e => update("client_name", e.target.value)} placeholder="John Smith" />
        </div>
        <div className="space-y-1.5">
          <Label>Email *</Label>
          <Input type="email" value={data.client_email} onChange={e => update("client_email", e.target.value)} placeholder="john@company.com" />
        </div>
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input value={data.client_phone} onChange={e => update("client_phone", e.target.value)} placeholder="(555) 123-4567" />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Input value={data.client_role} onChange={e => update("client_role", e.target.value)} placeholder="Owner / CEO / CMO" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Company Name</Label>
        <Input value={data.client_company} onChange={e => update("client_company", e.target.value)} placeholder="Acme Corp" />
      </div>
      <div className="space-y-1.5">
        <Label>Industry *</Label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map(ind => (
            <button key={ind} onClick={() => update("industry", ind)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                data.industry === ind ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"
              }`}>{ind}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepMarket({ data, update }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Market & Audience</h3>
        <p className="text-xs text-muted-foreground">Who are we targeting and where?</p>
      </div>
      <div className="space-y-1.5">
        <Label>Target Market / Ideal Customer *</Label>
        <Textarea value={data.target_market} onChange={e => update("target_market", e.target.value)} placeholder="Homeowners with burst pipes, 35-65, suburban areas, emergency situations" rows={3} />
      </div>
      <div className="space-y-1.5">
        <Label>Geographic Focus *</Label>
        <Input value={data.geo_focus} onChange={e => update("geo_focus", e.target.value)} placeholder="Dallas-Fort Worth metro / National / Texas" />
      </div>
    </div>
  );
}

function StepGoals({ data, update }) {
  const METRICS = ["Lead Generation", "Revenue Growth", "Brand Awareness", "Search Ranking", "Phone Calls", "Form Submissions", "Online Booking", "Market Share"];
  const toggleMetric = (m) => {
    const metrics = data.success_metrics.includes(m) ? data.success_metrics.filter(x => x !== m) : [...data.success_metrics, m];
    update("success_metrics", metrics);
  };
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-lg flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Goals & Success</h3>
        <p className="text-xs text-muted-foreground">Define what winning looks like</p>
      </div>
      <div className="space-y-1.5">
        <Label>Business Goals *</Label>
        <Textarea value={data.business_goals} onChange={e => update("business_goals", e.target.value)} placeholder="Dominate emergency plumbing in DFW, generate 50+ qualified leads/month, rank #1 for emergency plumber searches" rows={3} />
      </div>
      <div className="space-y-1.5">
        <Label>Success Metrics</Label>
        <div className="flex flex-wrap gap-2">
          {METRICS.map(m => (
            <button key={m} onClick={() => toggleMetric(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                data.success_metrics.includes(m) ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground hover:border-primary/50"
              }`}>{m}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Budget Range *</Label>
          <select className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm" value={data.budget_range} onChange={e => update("budget_range", e.target.value)}>
            <option value="">Select...</option>
            <option value="$2k-$5k">Starter ($2k-$5k)</option>
            <option value="$5k-$15k">Growth ($5k-$15k)</option>
            <option value="$15k-$50k">Premium ($15k-$50k)</option>
            <option value="$50k+">Enterprise ($50k+)</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Timeline</Label>
          <select className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm" value={data.timeline} onChange={e => update("timeline", e.target.value)}>
            <option value="">Select...</option>
            <option value="2-4 weeks">Express (2-4 weeks)</option>
            <option value="1-2 months">Standard (1-2 months)</option>
            <option value="3-6 months">Comprehensive (3-6 months)</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function StepBrand({ data, update, updateBrand }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-lg flex items-center gap-2"><Palette className="w-5 h-5 text-primary" /> Brand & Competitors</h3>
        <p className="text-xs text-muted-foreground">Identity preferences and competitive landscape</p>
      </div>
      <div className="space-y-1.5">
        <Label>Brand Voice</Label>
        <Input value={data.brand_preferences.voice} onChange={e => updateBrand("voice", e.target.value)} placeholder="Professional, trustworthy, urgent, empathetic" />
      </div>
      <div className="space-y-1.5">
        <Label>Style Preference</Label>
        <select className="w-full px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm" value={data.brand_preferences.style} onChange={e => updateBrand("style", e.target.value)}>
          <option value="">Select...</option>
          <option value="modern_dark">Modern Dark / Tech</option>
          <option value="clean_minimal">Clean Minimal</option>
          <option value="bold_corporate">Bold Corporate</option>
          <option value="warm_trustworthy">Warm Trustworthy</option>
          <option value="luxury_premium">Luxury Premium</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Current Website</Label>
        <Input value={data.current_website} onChange={e => update("current_website", e.target.value)} placeholder="https://current-site.com" />
      </div>
      <div className="space-y-1.5">
        <Label>Top Competitors (URLs, comma-separated)</Label>
        <Textarea value={data.competitor_urls.join(", ")} onChange={e => update("competitor_urls", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} placeholder="competitor1.com, competitor2.com" rows={2} />
      </div>
      <div className="space-y-1.5">
        <Label>What Makes You Different?</Label>
        <Textarea value={data.differentiators} onChange={e => update("differentiators", e.target.value)} placeholder="24/7 live answer, 30-min response time, licensed & insured, 5-star rated..." rows={3} />
      </div>
    </div>
  );
}

function StepReview({ data }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading text-lg flex items-center gap-2"><Rocket className="w-5 h-5 text-primary" /> Review & Launch</h3>
        <p className="text-xs text-muted-foreground">Confirm everything looks right — we'll start discovery immediately</p>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <ReviewItem icon={User} label="Client" value={`${data.client_name} (${data.client_email})`} />
        <ReviewItem icon={Building2} label="Company" value={data.client_company || "—"} />
        <ReviewItem icon={Globe} label="Industry" value={data.industry} />
        <ReviewItem icon={MapPin} label="Market" value={data.target_market} />
        <ReviewItem icon={MapPin} label="Geo Focus" value={data.geo_focus} />
        <ReviewItem icon={Target} label="Budget" value={data.budget_range} />
        <ReviewItem icon={Target} label="Timeline" value={data.timeline || "—"} />
        <ReviewItem icon={Trophy} label="Metrics" value={data.success_metrics.join(", ") || "—"} />
      </div>
      <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
        <p className="text-xs text-muted-foreground mb-2">What happens next:</p>
        <ol className="space-y-1.5 text-sm">
          <li className="flex gap-2"><Badge variant="outline" className="text-[10px]">1</Badge> Discovery pipeline runs (12 steps: demand, social, competitors, buyers, skip trace, strategy, brand, sales assets, build docs, Google sync)</li>
          <li className="flex gap-2"><Badge variant="outline" className="text-[10px]">2</Badge> Machine-readable build spec generated for the autonomous coding agent</li>
          <li className="flex gap-2"><Badge variant="outline" className="text-[10px]">3</Badge> System built, QA validated, deployed to Vercel + Railway + Supabase</li>
          <li className="flex gap-2"><Badge variant="outline" className="text-[10px]">4</Badge> You receive a private portal link to review, approve, and launch</li>
        </ol>
      </div>
    </div>
  );
}

function ReviewItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 p-2.5 rounded-lg border border-border bg-muted/20">
      <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}