import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, CheckCircle2, AlertCircle, Clock, Rocket, Code,
  ShieldCheck, Globe, Star, ExternalLink, RefreshCw, FileCode, Trophy, Play
} from "lucide-react";

const STAGES = [
  { key: "intake", label: "Client Intake", icon: CheckCircle2, threshold: 5 },
  { key: "discovery", label: "Discovery Pipeline", icon: Clock, threshold: 15 },
  { key: "spec_ready", label: "Build Spec Generated", icon: FileCode, threshold: 25 },
  { key: "building", label: "Autonomous Build", icon: Code, threshold: 50 },
  { key: "qa_validating", label: "QA Validation", icon: ShieldCheck, threshold: 70 },
  { key: "deploying", label: "Deploying", icon: Rocket, threshold: 85 },
  { key: "deployed", label: "Live Preview Ready", icon: Globe, threshold: 90 },
  { key: "delivered", label: "Delivered & Approved", icon: Trophy, threshold: 100 },
];

export default function ClientDelivery() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const [engagement, setEngagement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!token) { navigate("/"); return; }
    loadEngagement();
    const interval = setInterval(loadEngagement, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const loadEngagement = async () => {
    try {
      const { items } = await base44.entities.ClientEngagement.filter({ client_portal_token: token }, { limit: 1 });
      if (!items || items.length === 0) { setError("Invalid portal link"); setLoading(false); return; }
      setEngagement(items[0]);
      setLoading(false);
    } catch (e) {
      setError(e.message); setLoading(false);
    }
  };

  const [runningLifecycle, setRunningLifecycle] = useState(false);

  const runLifecycle = async () => {
    setRunningLifecycle(true);
    try {
      await base44.functions.invoke("runClientLifecycle", { engagement_id: engagement.id });
      loadEngagement();
    } catch (e) { console.error(e); }
    finally { setRunningLifecycle(false); }
  };

  const submitReview = async (status, notes) => {
    setSubmittingReview(true);
    try {
      await base44.entities.ClientEngagement.update(engagement.id, {
        review_status: status,
        review_notes: notes || "",
        factory_stage_log: [
          ...(engagement.factory_stage_log || []),
          { stage: "client_review", status, timestamp: new Date().toISOString(), message: notes || "" }
        ]
      });
      if (status === "approved") {
        await base44.entities.ClientEngagement.update(engagement.id, {
          factory_status: "delivered", handoff_date: new Date().toISOString(), factory_progress: 100
        });
      }
      loadEngagement();
    } catch (e) { console.error(e); }
    finally { setSubmittingReview(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error) return <div className="text-center py-20 space-y-2"><AlertCircle className="w-10 h-10 text-destructive mx-auto" /><p className="text-destructive">{error}</p></div>;
  if (!engagement) return null;

  const currentStage = STAGES.find(s => s.key === engagement.factory_status) || STAGES[0];
  const progress = engagement.factory_progress || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="text-center space-y-2 py-4">
        <Badge variant="outline" className="text-xs"><Rocket className="w-3 h-3 mr-1" /> Delivery Portal</Badge>
        <h1 className="text-2xl font-heading font-bold">{engagement.client_company || engagement.client_name}'s Project</h1>
        <p className="text-sm text-muted-foreground">{engagement.industry} · {engagement.geo_focus}</p>
      </div>

      {/* Progress Bar */}
      <Card className="glass-panel">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <currentStage.icon className={`w-5 h-5 ${progress === 100 ? "text-green-400" : "text-primary"} ${engagement.factory_status === "building" || engagement.factory_status === "discovery" ? "animate-pulse" : ""}`} />
              <span className="font-display font-semibold">{currentStage.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-heading font-bold text-gold-gradient">{progress}%</span>
              {(engagement.factory_status === "intake" || engagement.factory_status === "failed") && (
                <Button size="sm" variant="outline" onClick={runLifecycle} disabled={runningLifecycle}>
                  {runningLifecycle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run Pipeline
                </Button>
              )}
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
            <div className="h-full bg-gold-gradient transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          {/* Stage Timeline */}
          <div className="flex items-center justify-between gap-1">
            {STAGES.map((stage, i) => {
              const done = progress >= stage.threshold;
              const active = engagement.factory_status === stage.key;
              return (
                <div key={stage.key} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                    done ? "bg-green-500/20 border-green-500 text-green-400" :
                    active ? "bg-primary/20 border-primary text-primary animate-pulse" :
                    "border-border text-muted-foreground/40"
                  }`}>
                    <stage.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-[9px] text-center font-medium ${active ? "text-primary" : done ? "text-green-400" : "text-muted-foreground/40"}`}>{stage.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Live Preview / Deployment */}
      {(engagement.preview_url || engagement.deployment_url) && (
        <Card className="border-green-500/20">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Globe className="w-4 h-4 text-green-400" /> Live Preview</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {engagement.preview_url && (
              <a href={engagement.preview_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-all">
                <span className="text-sm font-medium">Staging Preview</span>
                <ExternalLink className="w-4 h-4 text-primary" />
              </a>
            )}
            {engagement.deployment_url && (
              <a href={engagement.deployment_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                <span className="text-sm font-medium text-green-400">Production Live</span>
                <ExternalLink className="w-4 h-4 text-green-400" />
              </a>
            )}
          </CardContent>
        </Card>
      )}

      {/* Build Spec Preview */}
      {engagement.build_spec && (
        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileCode className="w-4 h-4 text-primary" /> Build Specification</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <SpecStat label="Pages" value={engagement.build_spec.pages?.length || 0} />
              <SpecStat label="Entities" value={engagement.build_spec.entities?.length || 0} />
              <SpecStat label="Automations" value={engagement.build_spec.automations?.length || 0} />
              <SpecStat label="Build Steps" value={engagement.build_spec.build_sequence?.length || 0} />
            </div>
            {engagement.build_spec.brand && (
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">Brand</p>
                <p className="font-display font-semibold">{engagement.build_spec.brand.name}</p>
                <p className="text-xs text-muted-foreground italic">"{engagement.build_spec.brand.tagline}"</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stage Log */}
      {engagement.factory_stage_log && engagement.factory_stage_log.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Activity Log</CardTitle>
              <Button size="sm" variant="ghost" onClick={loadEngagement}><RefreshCw className="w-3.5 h-3.5" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5 max-h-48 overflow-y-auto xa-scroll">
            {[...engagement.factory_stage_log].reverse().slice(0, 10).map((log, i) => (
              <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-md hover:bg-muted/20">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${log.status === "complete" || log.status === "approved" ? "bg-green-500" : log.status === "error" || log.status === "failed" ? "bg-red-500" : "bg-primary"}`} />
                <div className="flex-1">
                  <span className="font-medium">{log.stage}</span>
                  {log.message && <span className="text-muted-foreground"> — {log.message}</span>}
                  <span className="text-muted-foreground/50 ml-1">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Review & Approve — only when deployed */}
      {engagement.factory_status === "deployed" && engagement.review_status !== "approved" && (
        <ReviewPanel onSubmit={submitReview} submitting={submittingReview} />
      )}

      {/* Delivered */}
      {engagement.factory_status === "delivered" && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <h3 className="text-xl font-heading">Project Delivered!</h3>
            <p className="text-sm text-muted-foreground">Your system is live. Thank you for choosing us.</p>
            {!engagement.rating && <RatingPanel engagementId={engagement.id} onRated={loadEngagement} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SpecStat({ label, value }) {
  return (
    <div className="p-2 rounded-lg border border-border bg-muted/20 text-center">
      <p className="text-lg font-heading font-bold text-primary">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

function ReviewPanel({ onSubmit, submitting }) {
  const [notes, setNotes] = useState("");
  return (
    <Card className="border-primary/30">
      <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Star className="w-4 h-4 text-primary" /> Review & Approve</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <textarea className="w-full p-3 rounded-lg bg-muted/20 border border-border text-sm" rows={3} placeholder="Any changes or feedback before we go live? (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onSubmit("changes_requested", notes)} disabled={submitting}>Request Changes</Button>
          <Button className="flex-1" onClick={() => onSubmit("approved", notes)} disabled={submitting}>{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Approve & Launch</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RatingPanel({ engagementId, onRated }) {
  const [rating, setRating] = useState(0);
  const [testimonial, setTestimonial] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      await base44.entities.ClientEngagement.update(engagementId, { rating, testimonial });
      onRated();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };
  return (
    <div className="space-y-3 pt-3 border-t border-border">
      <p className="text-sm font-medium">How was your experience?</p>
      <div className="flex gap-1 justify-center">
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => setRating(n)} className="transition-transform hover:scale-110">
            <Star className={`w-8 h-8 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <>
          <textarea className="w-full p-3 rounded-lg bg-muted/20 border border-border text-sm" rows={2} placeholder="Leave a testimonial (optional)" value={testimonial} onChange={e => setTestimonial(e.target.value)} />
          <Button onClick={submit} disabled={submitting} className="w-full">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Review"}</Button>
        </>
      )}
    </div>
  );
}