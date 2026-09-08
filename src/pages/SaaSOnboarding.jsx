import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import StepIndicator from "@/components/onboarding/StepIndicator";
import {
  Globe, Database, Bot, TrendingUp, Sparkles, Check, ArrowRight, ArrowLeft,
  Search, FileText, ShoppingCart, Building2, Mail, Briefcase, Newspaper,
  DollarSign, Share2, MousePointerClick, RefreshCw, Eye, Copy, Download,
  Lock, Code2, Zap, Rocket, Cloud, Loader2, Wand2, CheckCircle2,
  Star, Home, Shield, Clock, AlertTriangle, FlaskConical, Play, Target
} from "lucide-react";

const goals = [
  { id: "web_scraping", label: "Web Scraping", icon: Search, desc: "Extract data from websites at scale" },
  { id: "data_extraction", label: "Data Extraction", icon: Database, desc: "Pull structured data from any page" },
  { id: "form_automation", label: "Form Automation", icon: MousePointerClick, desc: "Fill and submit forms automatically" },
  { id: "website_cloning", label: "Website Cloning", icon: Copy, desc: "Clone any website's frontend + backend" },
  { id: "ai_agent_building", label: "AI Agent Building", icon: Bot, desc: "Build AI agents that browse the web" },
  { id: "monitoring", label: "Monitoring", icon: Eye, desc: "Watch websites for changes" },
  { id: "research", label: "Research", icon: FileText, desc: "Automated research across the web" },
  { id: "other", label: "Something Else", icon: Sparkles, desc: "Tell us what you need" },
];

const dataTypes = [
  { id: "product_info", label: "Product Info", icon: ShoppingCart },
  { id: "pricing", label: "Pricing", icon: DollarSign },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "contact_info", label: "Contact Info", icon: Mail },
  { id: "company_data", label: "Company Data", icon: Building2 },
  { id: "real_estate", label: "Real Estate", icon: Home },
  { id: "job_listings", label: "Job Listings", icon: Briefcase },
  { id: "social_media", label: "Social Media", icon: Share2 },
  { id: "news_articles", label: "News Articles", icon: Newspaper },
  { id: "financial_data", label: "Financial Data", icon: TrendingUp },
  { id: "custom", label: "Custom Data", icon: Sparkles },
];

const aiCapabilities = [
  { id: "navigate_pages", label: "Navigate Pages", icon: Globe },
  { id: "extract_data", label: "Extract Data", icon: Database },
  { id: "fill_forms", label: "Fill Forms", icon: MousePointerClick },
  { id: "solve_captcha", label: "Solve Captcha", icon: Lock },
  { id: "make_decisions", label: "Make Decisions", icon: Zap },
  { id: "answer_questions", label: "Answer Questions", icon: Bot },
  { id: "summarize_content", label: "Summarize Content", icon: FileText },
  { id: "monitor_sites", label: "Monitor Sites", icon: Eye },
  { id: "clone_sites", label: "Clone Sites", icon: Copy },
  { id: "build_workflows", label: "Build Workflows", icon: Code2 },
];

const WIZARD_STEPS = [
  { id: "welcome", label: "Welcome", icon: Sparkles },
  { id: "goal", label: "Goals", icon: Target },
  { id: "data", label: "Data & AI", icon: Database },
  { id: "agent", label: "Agent Config", icon: Bot },
  { id: "test", label: "Test", icon: FlaskConical },
  { id: "live", label: "Go Live", icon: Rocket },
];

function MultiSelectGrid({ items, selected, onToggle, columns = "md:grid-cols-3" }) {
  return (
    <div className={`grid ${columns} gap-3`}>
      {items.map((item) => {
        const isSelected = selected.includes(item.id);
        return (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/30 hover:bg-muted/50"
            }`}
          >
            {item.icon && <item.icon className={`w-5 h-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{item.label}</div>
              {item.desc && <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>}
            </div>
            {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function SingleSelectGrid({ items, selected, onSelect, columns = "md:grid-cols-2" }) {
  return (
    <div className={`grid ${columns} gap-3`}>
      {items.map((item) => {
        const isSelected = selected === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:border-primary/30 hover:bg-muted/50"
            }`}
          >
            {item.icon && <item.icon className={`w-5 h-5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{item.label}</div>
              {item.desc && <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>}
            </div>
            {isSelected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

export default function SaaSOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [testing, setTesting] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [intelligence, setIntelligence] = useState(null);
  const [agentConfig, setAgentConfig] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [result, setResult] = useState(null);

  const [answers, setAnswers] = useState({
    primary_goal: "",
    target_websites: [],
    data_to_extract: [],
    ai_capabilities: [],
    automation_tasks: [],
    scale_level: "small",
    preferred_ai_tools: [],
    experience_level: "beginner",
    custom_description: "",
  });

  // Load existing progress on mount
  useEffect(() => {
    (async () => {
      try {
        const profiles = await base44.entities.OnboardingProfile.filter({}).catch(() => []);
        if (profiles.length > 0 && !profiles[0].completed) {
          const p = profiles[0];
          setStepIndex(p.current_step || 0);
          setAnswers({
            primary_goal: p.primary_goal || "",
            target_websites: p.target_websites || [],
            data_to_extract: p.data_to_extract || [],
            ai_capabilities: p.ai_capabilities || [],
            automation_tasks: p.automation_tasks || [],
            scale_level: p.scale_level || "small",
            preferred_ai_tools: p.preferred_ai_tools || [],
            experience_level: p.experience_level || "beginner",
            custom_description: p.custom_description || "",
          });
          if (p.intelligence_data) setIntelligence(p.intelligence_data);
          if (p.generated_agent_prompt) {
            setAgentConfig({
              agent_prompt: p.generated_agent_prompt,
              job_template: p.generated_job_template,
              recommended_plan: p.recommended_plan,
            });
          }
          if (p.test_result) setTestResult(p.test_result);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggleArray = (key, value) => {
    setAnswers(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(v => v !== value)
        : [...prev[key], value],
    }));
  };

  const addUrl = () => {
    if (urlInput.trim() && !answers.target_websites.includes(urlInput.trim())) {
      setAnswers(prev => ({ ...prev, target_websites: [...prev.target_websites, urlInput.trim()] }));
      setUrlInput("");
    }
  };

  const saveStep = async (stepName, stepData = {}, complete = false) => {
    setSaving(true);
    try {
      await base44.functions.invoke("saveOnboardingStep", {
        step_name: stepName,
        step_data: stepData,
        complete,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const scanIntelligence = async () => {
    setScanning(true);
    try {
      const res = await base44.functions.invoke("scanTargetIntelligence", {
        target_urls: answers.target_websites,
        primary_goal: answers.primary_goal,
      });
      setIntelligence(res.data?.intelligence || res.intelligence);
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || e.message);
    } finally {
      setScanning(false);
    }
  };

  const generateAgent = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke("generateAgentConfig", {
        ...answers,
        intelligence_data: intelligence,
      });
      setAgentConfig(res.data?.config || res.config);
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || e.message);
    } finally {
      setGenerating(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    try {
      const res = await base44.functions.invoke("testOnboardingSetup", {
        target_url: answers.target_websites[0],
        agent_prompt: agentConfig?.agent_prompt,
        extraction_schema: agentConfig?.job_template?.extraction_schema,
        job_template: agentConfig?.job_template,
      });
      setTestResult(res.data?.test_result || res.test_result);
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.error || e.message);
    } finally {
      setTesting(false);
    }
  };

  const goLive = async () => {
    setSaving(true);
    try {
      const res = await base44.functions.invoke("processOnboardingAnswers", answers);
      setResult(res.data || res);
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setSaving(false);
    }
  };

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  // ===== RESULT SCREEN =====
  if (result) {
    const config = result.ai_config || {};
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-heading font-bold">Your account is live!</h1>
          <p className="mt-2 text-muted-foreground">{config.welcome_message || "Welcome to CloudBrowser!"}</p>
        </div>

        <Card className="mb-4 border-primary/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Recommended Plan</h3>
              </div>
              <Badge className="capitalize">{config.recommended_plan}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {(config.recommended_capabilities || []).map(cap => (
                <Badge key={cap} variant="secondary" className="capitalize">{cap.replace(/_/g, ' ')}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {result.created_agents?.length > 0 && (
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Starter Agents Created</h3>
              </div>
              <div className="space-y-2">
                {result.created_agents.map(a => (
                  <div key={a.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-medium">{a.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={() => navigate("/dashboard")} className="flex-1">
            Go to Dashboard <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <Button variant="outline" onClick={() => navigate("/agent-builder")}>
            <Bot className="w-4 h-4 mr-1" /> Build an Agent
          </Button>
        </div>
      </div>
    );
  }

  // ===== WIZARD =====
  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <StepIndicator steps={WIZARD_STEPS} currentIndex={stepIndex} />

      <div className="rounded-xl border border-border bg-card p-6">
        {/* STEP 0: WELCOME */}
        {stepIndex === 0 && (
          <div className="text-center py-6">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-heading font-bold mb-2">Welcome to CloudBrowser!</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Let's set up your account in a few quick steps. We'll scan your target sites, configure an AI agent, test it, and get you live in minutes.
            </p>
            <div className="grid grid-cols-4 gap-3 mb-6 max-w-lg mx-auto">
              {[
                { icon: Search, label: "Scan Sites" },
                { icon: Bot, label: "Configure Agent" },
                { icon: FlaskConical, label: "Test Setup" },
                { icon: Rocket, label: "Go Live" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-accent/30 p-3 text-center">
                  <s.icon className="h-5 w-5 text-primary mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
            <button
              onClick={() => { saveStep("welcome", {}, true); setStepIndex(1); }}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 flex items-center gap-2 mx-auto"
            >
              Let's Get Started <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* STEP 1: GOAL + TARGETS + INTELLIGENCE SCAN */}
        {stepIndex === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-heading font-bold">What do you want to do?</h2>
              <p className="text-sm text-muted-foreground">Tell us your primary goal — we'll configure everything around it.</p>
            </div>
            <SingleSelectGrid
              items={goals}
              selected={answers.primary_goal}
              onSelect={(v) => setAnswers(prev => ({ ...prev, primary_goal: v }))}
              columns="md:grid-cols-2 lg:grid-cols-4"
            />

            <div>
              <Label className="mb-2 block">Target Websites</Label>
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
                />
                <Button onClick={addUrl} variant="outline">Add</Button>
              </div>
              {answers.target_websites.length > 0 && (
                <div className="space-y-2 mt-3">
                  {answers.target_websites.map(url => (
                    <div key={url} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm flex-1 truncate">{url}</span>
                      <Button size="sm" variant="ghost" onClick={() => toggleArray('target_websites', url)}>×</Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Intelligence Scan */}
            {answers.target_websites.length > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Industry Intelligence Scan</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Scan your target sites to build a knowledge base your AI agent uses. This detects site structure, anti-bot measures, and extraction strategies.
                </p>
                {intelligence ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-xs font-medium">Intelligence gathered</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {intelligence.site_summaries?.map((s, i) => (
                        <div key={i} className="rounded border border-border bg-background p-2">
                          <span className="text-muted-foreground">{s.url}:</span>{" "}
                          <span className="text-foreground capitalize">{s.site_type}</span>
                        </div>
                      ))}
                      {intelligence.recommended_capabilities?.length > 0 && (
                        <div className="rounded border border-border bg-background p-2 col-span-2">
                          <span className="text-muted-foreground">Recommended:</span>{" "}
                          <span className="text-foreground">{intelligence.recommended_capabilities.join(", ")}</span>
                        </div>
                      )}
                    </div>
                    <button onClick={scanIntelligence} disabled={scanning} className="text-xs text-primary hover:underline flex items-center gap-1">
                      {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-scan
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={scanIntelligence}
                    disabled={scanning}
                    className="w-full px-4 py-2 rounded-lg border border-primary text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {scanning ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning sites & industry...</> : <><Globe className="h-4 w-4" /> Scan Target Intelligence</>}
                  </button>
                )}
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStepIndex(0)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button
                onClick={() => { saveStep("goal", { primary_goal: answers.primary_goal, target_websites: answers.target_websites }, true); setStepIndex(2); }}
                disabled={!answers.primary_goal || saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: DATA & CAPABILITIES */}
        {stepIndex === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-heading font-bold">What data do you need?</h2>
              <p className="text-sm text-muted-foreground">Select all the types of data you want to extract.</p>
            </div>
            <MultiSelectGrid
              items={dataTypes}
              selected={answers.data_to_extract}
              onToggle={(v) => toggleArray('data_to_extract', v)}
              columns="md:grid-cols-3 lg:grid-cols-4"
            />

            <div>
              <h3 className="text-lg font-heading font-bold mb-2">What should your AI be able to do?</h3>
              <MultiSelectGrid
                items={aiCapabilities}
                selected={answers.ai_capabilities}
                onToggle={(v) => toggleArray('ai_capabilities', v)}
                columns="md:grid-cols-3 lg:grid-cols-5"
              />
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStepIndex(1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button
                onClick={() => { saveStep("data", { data_to_extract: answers.data_to_extract, ai_capabilities: answers.ai_capabilities }, true); setStepIndex(3); }}
                disabled={answers.data_to_extract.length === 0 || saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: AI AGENT CONFIG */}
        {stepIndex === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-heading font-bold">Configure Your AI Agent</h2>
              <p className="text-sm text-muted-foreground">
                We'll generate a system prompt and job template from your answers{intelligence ? " + intelligence scan" : ""}.
              </p>
            </div>

            {!agentConfig ? (
              <div className="text-center py-8">
                <Bot className="h-10 w-10 text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Click below to generate a personalized agent configuration.
                </p>
                <button
                  onClick={generateAgent}
                  disabled={generating}
                  className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating agent config...</> : <><Wand2 className="h-4 w-4" /> Generate with AI</>}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="mb-1 block">Agent System Prompt</Label>
                  <Textarea
                    value={agentConfig.agent_prompt || ""}
                    onChange={(e) => setAgentConfig({ ...agentConfig, agent_prompt: e.target.value })}
                    rows={8}
                    className="text-xs"
                  />
                </div>
                {agentConfig.job_template && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Job Template: {agentConfig.job_template.name}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {agentConfig.job_template.capabilities?.map(c => (
                        <Badge key={c} variant="secondary" className="text-xs capitalize">{c.replace(/_/g, ' ')}</Badge>
                      ))}
                    </div>
                    {agentConfig.job_template.steps?.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <strong>Steps:</strong> {agentConfig.job_template.steps.length} planned
                      </div>
                    )}
                  </div>
                )}
                <button
                  onClick={generateAgent}
                  disabled={generating}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Regenerate
                </button>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStepIndex(2)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button
                onClick={() => { saveStep("agent", { generated_agent_prompt: agentConfig?.agent_prompt, generated_job_template: agentConfig?.job_template }, true); setStepIndex(4); }}
                disabled={!agentConfig || saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: TEST */}
        {stepIndex === 4 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-heading font-bold">Test Your Setup</h2>
              <p className="text-sm text-muted-foreground">
                Run a simulated test to verify your agent will work on your target site before going live.
              </p>
            </div>

            {!testResult ? (
              <div className="text-center py-8">
                <FlaskConical className="h-10 w-10 text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  We'll simulate your agent on <span className="font-medium text-foreground">{answers.target_websites[0] || "your target site"}</span> and check for issues.
                </p>
                <button
                  onClick={runTest}
                  disabled={testing}
                  className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2 mx-auto"
                >
                  {testing ? <><Loader2 className="h-4 w-4 animate-spin" /> Running test simulation...</> : <><Play className="h-4 w-4" /> Run Test</>}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`rounded-lg border p-4 ${testResult.status === "pass" ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.status === "pass" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                    )}
                    <span className="font-semibold capitalize">{testResult.status === "pass" ? "Test Passed" : "Test Completed with Issues"}</span>
                    <Badge className="ml-auto">{testResult.confidence_score}% confidence</Badge>
                  </div>
                </div>

                {testResult.simulated_steps?.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Simulated Steps</Label>
                    <div className="space-y-2">
                      {testResult.simulated_steps.map((s, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                          <div className="text-xs">
                            <span className="font-medium">{s.step}:</span> <span className="text-muted-foreground">{s.action}</span>
                            <div className="text-muted-foreground/70">{s.result}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {testResult.issues_detected?.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Issues Detected</Label>
                    <div className="space-y-1">
                      {testResult.issues_detected.map((issue, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-amber-700">
                          <AlertTriangle className="h-3 w-3 shrink-0" /> {issue}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {testResult.recommendations?.length > 0 && (
                  <div>
                    <Label className="mb-2 block">Recommendations</Label>
                    <div className="space-y-1">
                      {testResult.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Sparkles className="h-3 w-3 text-primary shrink-0" /> {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={runTest} disabled={testing} className="text-xs text-primary hover:underline flex items-center gap-1">
                  {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Re-run Test
                </button>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStepIndex(3)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button
                onClick={() => { saveStep("test", { test_result: testResult }, true); setStepIndex(5); }}
                disabled={!testResult || saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 5: GO LIVE */}
        {stepIndex === 5 && (
          <div className="text-center py-6">
            <Rocket className="h-12 w-12 text-primary mx-auto mb-4" />
            <h2 className="text-2xl font-heading font-bold mb-2">Ready to Go Live!</h2>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">Review your setup and click "Go Live" to activate your account.</p>

            <div className="text-left max-w-md mx-auto rounded-lg border border-border bg-accent/30 p-4 space-y-2 mb-6">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Goal:</span><span className="font-medium capitalize">{answers.primary_goal?.replace(/_/g, ' ')}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Target Sites:</span><span className="font-medium">{answers.target_websites.length}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Data Types:</span><span className="font-medium">{answers.data_to_extract.length}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">AI Capabilities:</span><span className="font-medium">{answers.ai_capabilities.length}</span></div>
              {intelligence && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Intelligence:</span><span className="font-medium text-emerald-600">Scanned</span></div>}
              {agentConfig?.job_template && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Agent:</span><span className="font-medium">{agentConfig.job_template.name}</span></div>}
              {testResult && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Test:</span><span className={`font-medium ${testResult.status === "pass" ? "text-emerald-600" : "text-amber-600"}`}>{testResult.status === "pass" ? "Passed" : "Issues Found"}</span></div>}
              {agentConfig?.recommended_plan && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Plan:</span><span className="font-medium capitalize">{agentConfig.recommended_plan}</span></div>}
            </div>

            <div className="flex justify-between max-w-md mx-auto">
              <Button variant="ghost" onClick={() => setStepIndex(4)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
              <Button
                onClick={goLive}
                disabled={saving}
                className="px-8 py-2.5"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Go Live!
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}