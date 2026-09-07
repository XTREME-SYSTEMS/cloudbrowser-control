import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Globe, Database, Bot, TrendingUp, Sparkles, Check, ArrowRight, ArrowLeft,
  Search, FileText, ShoppingCart, Building2, Mail, Briefcase, Newspaper,
  DollarSign, Share2, MousePointerClick, RefreshCw, Eye, Copy, Download,
  Lock, Code2, Zap, Rocket, Cloud, Loader2, Wand2, CheckCircle2,
  Star, Home, Shield, Upload, Clock
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

const automationTasks = [
  { id: "login_and_navigate", label: "Login & Navigate", icon: Lock },
  { id: "fill_forms", label: "Fill Forms", icon: MousePointerClick },
  { id: "submit_applications", label: "Submit Applications", icon: FileText },
  { id: "download_files", label: "Download Files", icon: Download },
  { id: "monitor_changes", label: "Monitor Changes", icon: RefreshCw },
  { id: "scrape_at_scale", label: "Scrape at Scale", icon: TrendingUp },
  { id: "bypass_captcha", label: "Bypass Captcha", icon: Shield },
  { id: "use_proxies", label: "Use Proxies", icon: Globe },
  { id: "clone_websites", label: "Clone Websites", icon: Copy },
  { id: "build_ai_agents", label: "Build AI Agents", icon: Bot },
];

const scaleLevels = [
  { id: "small", label: "Small", desc: "1-10 sites, occasional runs", icon: Rocket },
  { id: "medium", label: "Medium", desc: "10-100 sites, daily runs", icon: TrendingUp },
  { id: "large", label: "Large", desc: "100-1000 sites, continuous", icon: Zap },
  { id: "enterprise", label: "Enterprise", desc: "1000+ sites, 24/7 operations", icon: Building2 },
];

const aiTools = [
  { id: "chatgpt", label: "ChatGPT", icon: Bot },
  { id: "claude", label: "Claude", icon: Sparkles },
  { id: "gemini", label: "Gemini", icon: Globe },
  { id: "cursor", label: "Cursor", icon: Code2 },
  { id: "custom", label: "Custom / Other", icon: Wand2 },
  { id: "none", label: "None yet", icon: Cloud },
];

const experienceLevels = [
  { id: "beginner", label: "Beginner", desc: "New to web automation" },
  { id: "intermediate", label: "Intermediate", desc: "Some experience with scrapers" },
  { id: "advanced", label: "Advanced", desc: "Built automation pipelines" },
  { id: "developer", label: "Developer", desc: "I code my own tools" },
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
  const [step, setStep] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [urlInput, setUrlInput] = useState("");

  const [answers, setAnswers] = useState({
    primary_goal: "",
    target_websites: [],
    data_to_extract: [],
    automation_tasks: [],
    ai_capabilities: [],
    scale_level: "small",
    preferred_ai_tools: [],
    experience_level: "beginner",
    custom_description: "",
  });

  const totalSteps = 8;
  const progress = ((step + 1) / totalSteps) * 100;

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

  const submit = async () => {
    setProcessing(true);
    try {
      const res = await base44.functions.invoke("processOnboardingAnswers", answers);
      const data = res.data || res;
      setResult(data);
    } catch (e) {
      alert(e.response?.data?.error || e.message);
    } finally {
      setProcessing(false);
    }
  };

  // RESULT SCREEN
  if (result) {
    const config = result.ai_config || {};
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-heading font-bold">Your account is ready!</h1>
          <p className="mt-2 text-muted-foreground">{config.welcome_message || "Welcome to CloudBrowser!"}</p>
        </div>

        {/* Recommended Plan */}
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

        {/* Starter Agents */}
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

        {/* Next Steps */}
        {config.setup_steps?.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Rocket className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Recommended Next Steps</h3>
              </div>
              <div className="space-y-2">
                {config.setup_steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                    <span className="text-sm text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex gap-3">
          <Button onClick={() => navigate("/")} className="flex-1">
            Go to Dashboard <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
          <Button variant="outline" onClick={() => navigate("/agent-builder")}>
            <Bot className="w-4 h-4 mr-1" /> Build an Agent
          </Button>
        </div>
      </div>
    );
  }

  // PROCESSING SCREEN
  if (processing) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-heading font-semibold">Configuring your account...</h2>
        <p className="mt-2 text-muted-foreground text-sm">
          Our AI is analyzing your answers and setting up your personalized workspace.
        </p>
      </div>
    );
  }

  // WIZARD STEPS
  const steps = [
    {
      title: "What do you want to do?",
      subtitle: "Tell us your primary goal — we'll configure everything around it.",
      content: (
        <SingleSelectGrid
          items={goals}
          selected={answers.primary_goal}
          onSelect={(v) => setAnswers(prev => ({ ...prev, primary_goal: v }))}
          columns="md:grid-cols-2 lg:grid-cols-4"
        />
      ),
      canProceed: !!answers.primary_goal,
    },
    {
      title: "What websites do you want to scrape?",
      subtitle: "Add the URLs you want to work with. You can skip this and add later.",
      content: (
        <div className="space-y-4">
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
            <div className="space-y-2">
              {answers.target_websites.map(url => (
                <div key={url} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1 truncate">{url}</span>
                  <Button size="sm" variant="ghost" onClick={() => toggleArray('target_websites', url)}>×</Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Optional — you can add URLs later from your dashboard.</p>
        </div>
      ),
      canProceed: true,
    },
    {
      title: "What data do you need?",
      subtitle: "Select all the types of data you want to extract. Choose as many as you need.",
      content: (
        <MultiSelectGrid
          items={dataTypes}
          selected={answers.data_to_extract}
          onToggle={(v) => toggleArray('data_to_extract', v)}
          columns="md:grid-cols-3 lg:grid-cols-4"
        />
      ),
      canProceed: answers.data_to_extract.length > 0,
    },
    {
      title: "What should your AI be able to do?",
      subtitle: "Select all the capabilities you want your AI agents to have.",
      content: (
        <MultiSelectGrid
          items={aiCapabilities}
          selected={answers.ai_capabilities}
          onToggle={(v) => toggleArray('ai_capabilities', v)}
          columns="md:grid-cols-3 lg:grid-cols-5"
        />
      ),
      canProceed: answers.ai_capabilities.length > 0,
    },
    {
      title: "What automation tasks do you need?",
      subtitle: "Select all the tasks you want to automate. Choose as many as apply.",
      content: (
        <MultiSelectGrid
          items={automationTasks}
          selected={answers.automation_tasks}
          onToggle={(v) => toggleArray('automation_tasks', v)}
          columns="md:grid-cols-3 lg:grid-cols-5"
        />
      ),
      canProceed: true,
    },
    {
      title: "What scale are you operating at?",
      subtitle: "This helps us recommend the right plan and configure your limits.",
      content: (
        <SingleSelectGrid
          items={scaleLevels}
          selected={answers.scale_level}
          onSelect={(v) => setAnswers(prev => ({ ...prev, scale_level: v }))}
          columns="md:grid-cols-2 lg:grid-cols-4"
        />
      ),
      canProceed: !!answers.scale_level,
    },
    {
      title: "Which AI tools do you use?",
      subtitle: "We'll set up MCP connections so you can control CloudBrowser from your favorite AI tool.",
      content: (
        <MultiSelectGrid
          items={aiTools}
          selected={answers.preferred_ai_tools}
          onToggle={(v) => toggleArray('preferred_ai_tools', v)}
          columns="md:grid-cols-3"
        />
      ),
      canProceed: true,
    },
    {
      title: "Tell us more (optional)",
      subtitle: "Anything else you'd like us to know? What's your experience level?",
      content: (
        <div className="space-y-6">
          <div>
            <Label className="mb-3 block">Experience level</Label>
            <SingleSelectGrid
              items={experienceLevels}
              selected={answers.experience_level}
              onSelect={(v) => setAnswers(prev => ({ ...prev, experience_level: v }))}
              columns="md:grid-cols-4"
            />
          </div>
          <div>
            <Label className="mb-2 block">Custom description (optional)</Label>
            <Textarea
              value={answers.custom_description}
              onChange={(e) => setAnswers(prev => ({ ...prev, custom_description: e.target.value }))}
              placeholder="Describe what you want to build, any specific requirements, or questions you have..."
              rows={4}
            />
          </div>
        </div>
      ),
      canProceed: true,
    },
  ];

  const currentStep = steps[step];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">Step {step + 1} of {totalSteps}</span>
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
      </div>

      {/* Step content */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-heading font-bold mb-2">{currentStep.title}</h1>
        <p className="text-muted-foreground">{currentStep.subtitle}</p>
      </div>

      <div className="mb-8">
        {currentStep.content}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {step < totalSteps - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!currentStep.canProceed}
          >
            Continue <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={submit} disabled={!currentStep.canProceed}>
            <Sparkles className="w-4 h-4 mr-1" /> Generate My Setup
          </Button>
        )}
      </div>
    </div>
  );
}