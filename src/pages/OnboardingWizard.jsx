import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Rocket, ArrowRight, ArrowLeft, Check, Loader2, Shield, Sparkles, Zap } from "lucide-react";

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState({});
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [done, setDone] = useState(false);
  const [configPlan, setConfigPlan] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisioned, setProvisioned] = useState(null);
  const [error, setError] = useState("");

  const fetchNext = useCallback(async (currentAnswers) => {
    setLoading(true);
    setError("");
    try {
      const res = await base44.functions.invoke("onboardingInterview", { action: "next", answers: currentAnswers });
      const data = res.data;
      if (data.done) {
        setDone(true);
      } else {
        setQuestion(data.question);
        const f = data.question.field;
        const existing = currentAnswers[f];
        setDraft(Array.isArray(existing) ? "" : existing || "");
      }
    } catch (e) {
      setError(e.message || "Failed to load question");
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNext({}); }, [fetchNext]);

  const submitAnswer = () => {
    if (!question) return;
    let value = draft;
    if (question.type === "multiselect") {
      // draft holds comma-joined selected values
      value = draft.split(",").map((s) => s.trim()).filter(Boolean);
    }
    const next = { ...answers, [question.field]: value };
    setAnswers(next);
    fetchNext(next);
  };

  const finalize = async () => {
    setFinalizing(true);
    setError("");
    try {
      const res = await base44.functions.invoke("onboardingInterview", { action: "finalize", answers });
      setConfigPlan(res.data.config_plan);
    } catch (e) {
      setError(e.message || "Failed to generate plan");
    }
    setFinalizing(false);
  };

  const provision = async () => {
    setProvisioning(true);
    setError("");
    try {
      const settings = configPlan?.recommended_settings || {};
      const defaultSessionConfig = {
        viewport: settings.viewport || { width: 1920, height: 1080 },
        stealth: settings.stealth !== false,
        captcha_solver: settings.captcha_solver || answers.captcha_solver || "self_hosted",
        operating_mode: settings.operating_mode || answers.operating_mode || "full_operate",
        max_concurrent_sessions: settings.max_concurrent_sessions || 10,
        enforce_https: settings.enforce_https !== false,
        scraper_method: answers.scraper_method || "stealth_reverse",
        target_sites: (answers.target_sites || "").split(",").map((s) => s.trim()).filter(Boolean),
      };
      const res = await base44.functions.invoke("createProject", {
        name: answers.project_name,
        description: answers.project_goal,
        color: "blue",
        default_session_config: defaultSessionConfig,
        generate_key: true,
      });
      setProvisioned(res.data);
    } catch (e) {
      setError(e.message || "Provisioning failed");
    }
    setProvisioning(false);
  };

  const toggleOption = (val) => {
    const current = draft ? draft.split(",").map((s) => s.trim()).filter(Boolean) : [];
    const next = current.includes(val) ? current.filter((v) => v !== val) : [...current, val];
    setDraft(next.join(","));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Rocket className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">AI Onboarding Wizard</h1>
        </div>
        <p className="text-muted-foreground">Answer a few questions in order — the agent uses your answers to provision a max-capability, hardened project.</p>
      </div>

      {/* Capability banner */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /><span className="text-xs font-medium">Hardened</span></CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /><span className="text-xs font-medium">AI-assisted</span></CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /><span className="text-xs font-medium">Max capability</span></CardContent></Card>
      </div>

      {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}

      {/* Interview phase */}
      {!done && question && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">Q{Object.keys(answers).length + 1}</span>
              {question.label}
            </CardTitle>
            <CardDescription>{question.prompt}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {question.type === "text" && (
              question.field === "project_goal" || question.field === "target_sites" ? (
                <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your answer..." rows={3} />
              ) : (
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type your answer..." />
              )
            )}
            {question.type === "select" && (
              <div className="space-y-2">
                {question.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setDraft(opt.value)}
                    className={`w-full text-left px-3 py-2.5 rounded-md border text-sm transition-colors ${draft === opt.value ? "border-primary bg-primary/10 text-foreground" : "border-border hover:bg-accent"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            {question.type === "multiselect" && (
              <div className="space-y-2">
                {question.options.map((opt) => {
                  const selected = draft.split(",").map((s) => s.trim()).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      onClick={() => toggleOption(opt.value)}
                      className={`w-full text-left px-3 py-2.5 rounded-md border text-sm transition-colors flex items-center gap-2 ${selected ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${selected ? "bg-primary border-primary" : "border-input"}`}>
                        {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /> Back</Button>
              <Button onClick={submitAnswer} disabled={question.type !== "multiselect" && !draft.trim()}>Next <ArrowRight className="w-4 h-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Finalize phase */}
      {done && !configPlan && (
        <Card>
          <CardContent className="p-6 space-y-4 text-center">
            <Check className="w-10 h-10 text-green-500 mx-auto" />
            <h2 className="text-lg font-heading font-semibold">All questions answered</h2>
            <p className="text-sm text-muted-foreground">Let the AI generate your tailored, hardened provisioning plan.</p>
            <Button onClick={finalize} disabled={finalizing}>
              {finalizing ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating plan...</> : <><Sparkles className="w-4 h-4" /> Generate provisioning plan</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plan + provision phase */}
      {configPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Provisioning Plan</CardTitle>
            <CardDescription>{configPlan.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-muted p-3 text-xs">
              <pre className="whitespace-pre-wrap font-mono">{JSON.stringify(configPlan.recommended_settings, null, 2)}</pre>
            </div>
            {configPlan.risk_notes && (
              <div className="text-xs text-muted-foreground"><span className="font-medium">Hardening notes:</span> {configPlan.risk_notes}</div>
            )}
            {!provisioned ? (
              <Button onClick={provision} disabled={provisioning} className="w-full">
                {provisioning ? <><Loader2 className="w-4 h-4 animate-spin" /> Provisioning...</> : <><Rocket className="w-4 h-4" /> Provision project</>}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-600"><Check className="w-4 h-4" /> Project provisioned & API key generated.</div>
                {provisioned?.api_key?.api_key && (
                  <div className="rounded-md bg-muted p-3">
                    <div className="text-xs font-medium mb-1">API key (shown once):</div>
                    <code className="text-xs break-all">{provisioned.api_key.api_key}</code>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate("/projects")} className="flex-1">View projects</Button>
                  <Button onClick={() => navigate("/connection-wizard")} className="flex-1">Connect integrations</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}