import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import Timeline from "@/components/onboarding/Timeline";
import {
  Search, Eye, ClipboardCheck, Repeat, ArrowRight, ArrowLeft,
  Loader2, CheckCircle, Sparkles, ExternalLink, Rocket,
} from "lucide-react";

const GOALS = [
  { id: "scraping", label: "Scrape Data", icon: Search, desc: "Extract product info, prices, listings, articles" },
  { id: "monitoring", label: "Monitor Changes", icon: Eye, desc: "Watch a page and get alerted when it changes" },
  { id: "testing", label: "Test a Website", icon: ClipboardCheck, desc: "Run checks against a site to verify it works" },
  { id: "automation", label: "Automate a Task", icon: Repeat, desc: "Fill forms, click through flows, schedule recurring runs" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [goal, setGoal] = useState(null);
  const [url, setUrl] = useState("");
  const [details, setDetails] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    base44.entities.Template.list("-created_date", 50).then(setTemplates).catch(() => {});
  }, []);

  const next = () => {
    setCompleted((c) => [...new Set([...c, step])]);
    setStep((s) => s + 1);
  };
  const back = () => setStep((s) => Math.max(0, s - 1));

  // Step 3 → 4: kick off generation
  const startGeneration = async () => {
    setCompleted((c) => [...new Set([...c, 2])]);
    setStep(3);
    setGenerating(true);
    setError(null);

    const goalLabel = GOALS.find((g) => g.id === goal)?.label || goal;
    const prompt = `${goalLabel}: Go to ${url}. ${details}`;

    try {
      // 1. Try template match by category
      let matchedTemplate = templates.find((t) => t.category === goal);

      let stepsData;
      if (matchedTemplate) {
        stepsData = {
          start_url: url,
          steps: matchedTemplate.steps,
          source: "template",
          template_name: matchedTemplate.name,
        };
      } else {
        // 2. Fall back to AI generation
        const res = await base44.functions.invoke("aiBuildSteps", { prompt });
        stepsData = { ...res.data, source: "ai" };
      }

      // 3. Create a Job with the generated steps
      const job = await base44.entities.Job.create({
        name: `${goalLabel} — ${new URL(url).hostname}`,
        status: "queued",
        start_url: url,
        steps_count: stepsData.steps?.length || 0,
        tags: [goal, stepsData.source],
      });

      // 4. Create Steps linked to the job
      if (stepsData.steps?.length) {
        await base44.entities.Step.bulkCreate(
          stepsData.steps.map((s, i) => ({
            job_id: job.id,
            order: i,
            name: s.name || s.action_type,
            action_type: s.action_type,
            selector: s.selector,
            value: s.value,
            options: s.options,
          }))
        );
      }

      setResult({ job, stepsData });
      setCompleted((c) => [...new Set([...c, 3])]);
      setStep(4);
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => {
    setStep(0);
    setCompleted([]);
    setGoal(null);
    setUrl("");
    setDetails("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Welcome — let's set up your automation</h1>
        <p className="text-muted-foreground mt-1">Answer a few questions and we'll build it for you.</p>
      </div>

      {/* Timeline */}
      <Timeline current={step} completed={completed} />

      {/* Step content */}
      <Card>
        <CardContent className="pt-6">
          {/* STEP 1 — Goal */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">What do you want to do today?</h2>
                <p className="text-sm text-muted-foreground">Pick the option that best matches your goal.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GOALS.map((g) => {
                  const Icon = g.icon;
                  const selected = goal === g.id;
                  return (
                    <button
                      key={g.id}
                      onClick={() => setGoal(g.id)}
                      className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
                    >
                      <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      <div>
                        <div className="font-medium">{g.label}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{g.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end">
                <Button onClick={next} disabled={!goal}>Continue <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* STEP 2 — Target URL */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">What website do you want to target?</h2>
                <p className="text-sm text-muted-foreground">Enter the full URL of the page to start from.</p>
              </div>
              <div>
                <Label>Target URL</Label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/products"
                  type="url"
                  autoFocus
                />
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={back}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                <Button onClick={next} disabled={!url || !url.startsWith("http")}>Continue <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* STEP 3 — Details */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Describe what you want to extract or do</h2>
                <p className="text-sm text-muted-foreground">The more specific you are, the better the result. We'll try a template first, then use AI if needed.</p>
              </div>
              <div>
                <Label>Instructions</Label>
                <Textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={4}
                  placeholder="e.g. Extract the top 20 product names, prices, and ratings. Sort by price low to high."
                  autoFocus
                />
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={back}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
                <Button onClick={startGeneration} disabled={!details.trim()}>Generate & Build <Sparkles className="w-4 h-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* STEP 4 — Generating */}
          {step === 3 && (
            <div className="py-12 text-center space-y-4">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <div>
                <h2 className="text-lg font-semibold">Building your automation…</h2>
                <p className="text-sm text-muted-foreground">
                  {templates.some((t) => t.category === goal)
                    ? "Found a matching template — applying it now."
                    : "No template matched — generating steps with AI."}
                </p>
              </div>
              {error && (
                <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
                  {error}
                  <Button variant="ghost" size="sm" className="ml-2" onClick={reset}>Start over</Button>
                </div>
              )}
            </div>
          )}

          {/* STEP 5 — Launch */}
          {step === 4 && result && (
            <div className="space-y-5">
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-lg font-semibold mt-3">Your automation is ready!</h2>
                <p className="text-sm text-muted-foreground">
                  Built via {result.stepsData.source === "template" ? `template "${result.stepsData.template_name}"` : "AI generation"} · {result.stepsData.steps?.length || 0} steps
                </p>
              </div>

              <div className="p-3 rounded-md bg-muted/40 border space-y-1">
                <div className="text-sm font-medium">{result.job.name}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">{result.job.start_url}</div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={() => navigate(`/jobs/${result.job.id}`)}>
                  <ExternalLink className="w-4 h-4 mr-1" /> View Job Details
                </Button>
                <Button variant="outline" onClick={() => navigate("/jobs")}>
                  <Rocket className="w-4 h-4 mr-1" /> Go to Jobs
                </Button>
                <Button variant="ghost" onClick={reset}>Build Another</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}