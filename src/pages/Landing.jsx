import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Image } from "@/components/ui/image";
import {
  Zap, Globe, Search, Code2, Shield, Bot, Copy, Monitor,
  ArrowRight, Check, Sparkles, Lock, Database, Eye, Clock, TrendingUp,
  MousePointerClick, FileSearch, Download, RefreshCw, ChevronRight, Box, Ghost, Repeat
} from "lucide-react";

const useCases = [
  { icon: Bot, title: "Build agents that never sleep", desc: "Send your agent to search, organize, and act on data while you do literally anything else.", color: "text-violet-600" },
  { icon: Lock, title: "Access the 85% APIs can't reach", desc: "Your agent logs in, navigates, and pulls data from any website, login walls included.", color: "text-blue-600" },
  { icon: Shield, title: "Catch broken flows before users do", desc: "Run agents that click through your product continuously and alert you the moment something breaks.", color: "text-rose-600" },
  { icon: TrendingUp, title: "Research at a scale no human could", desc: "Spin up thousands of concurrent browser sessions and return answers immediately.", color: "text-emerald-600" },
  { icon: Eye, title: "Unblock agents that get stuck", desc: "When your workflow requires a form, a CAPTCHA, or a login prompt, it's handled.", color: "text-amber-600" },
  { icon: MousePointerClick, title: "Let agents fill in the blanks", desc: "Job applications, vendor portals, government forms. Agents that act on the web, not just read it.", color: "text-cyan-600" },
  { icon: RefreshCw, title: "Watch the whole web at once", desc: "Track prices, job listings, product changes, and competitor moves as they happen.", color: "text-indigo-600" },
  { icon: Download, title: "Move data at agent speed", desc: "Upload files, trigger downloads, and process records across hundreds of sites in parallel.", color: "text-orange-600" },
];

const products = [
  {
    icon: Monitor,
    name: "Browser Sessions",
    desc: "Give your agent a real browser to use the web like a human. Navigate interactive websites and perform complex actions, without interruptions.",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    icon: Search,
    name: "Fetch & Search API",
    desc: "Quickly fetch web context for your agent by converting any URL into HTML, JSON or markdown. Web search built for agents.",
    gradient: "from-blue-500 to-cyan-600",
  },
  {
    icon: Bot,
    name: "AI Agent Builder",
    desc: "Build, deploy, and run AI agents that browse and interact with the web. Natural language instructions, visual workflows.",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    icon: Box,
    name: "Sandboxed Clone Engine",
    desc: "Clone any website into an isolated sandbox and recursively iterate until 100% parity. The DEEP pipeline captures, synthesizes, deploys, and self-heals — automatically.",
    gradient: "from-amber-500 to-yellow-600",
  },
  {
    icon: Ghost,
    name: "Shadow Mode",
    desc: "Keep your clone in sync forever. Shadow mode continuously monitors the original site and auto-re-syncs your sandboxed clone the moment anything changes.",
    gradient: "from-violet-500 to-fuchsia-600",
  },
  {
    icon: Repeat,
    name: "Recursive Parity Loop",
    desc: "Our engine doesn't just clone once — it validates, finds gaps, heals them, redeploys, and re-validates in a loop until your clone is pixel-perfect.",
    gradient: "from-rose-500 to-orange-600",
  },
];

const steps = [
  { num: "01", icon: Monitor, title: "Create a browser session", desc: "Spin up a browser instance, configure your environment, and prepare it to run tasks across the web." },
  { num: "02", icon: Sparkles, title: "Choose your model", desc: "Connect AI to the browser session so it can interpret pages, make decisions, and drive interactions autonomously." },
  { num: "03", icon: Zap, title: "Execute your first task", desc: "Run your first workflow end-to-end, from navigation to action, and see results directly in the browser." },
];

const stats = [
  { value: "10,000+", label: "Years of browsing saved" },
  { value: "800K+", label: "Weekly SDK downloads" },
  { value: "100K+", label: "Developers building" },
  { value: "Millions", label: "Websites visited" },
];

const features = [
  { icon: Shield, title: "Auto Captcha Solving", desc: "reCAPTCHA, hCaptcha, Turnstile — solved automatically with self-hosted + fallback solvers" },
  { icon: Globe, title: "Global Proxy Network", desc: "Residential proxies with geo-targeting across 50+ countries" },
  { icon: Box, title: "Sandboxed Recursive Cloning", desc: "Deploy clones into isolated sandboxes and iterate to 100% parity automatically" },
  { icon: Ghost, title: "Shadow Mode", desc: "Continuously monitor the original site and auto-re-sync your clone when anything changes" },
  { icon: Code2, title: "MCP Integration", desc: "Connect ChatGPT, Claude, Gemini, or any AI agent via MCP protocol" },
  { icon: Database, title: "Sandbox Environments", desc: "Isolated Railway-provisioned backends for every user — zero DevOps" },
  { icon: Eye, title: "Live View & Recording", desc: "Watch your agents work in real-time with full session recording" },
  { icon: Repeat, title: "Self-Healing Parity Loop", desc: "Validate, detect gaps, heal, redeploy, and re-validate until pixel-perfect" },
];

export default function Landing() {
  const [activeUseCase, setActiveUseCase] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="https://media.base44.com/images/public/6a837c8e995cc4824aabf594/392c402b4_LOGO.png" alt="XTREME SCRAPER" className="w-9 h-9 shrink-0" fittingType="fit" />
            <span className="font-heading font-bold text-lg">XTREME SCRAPER</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#products" className="hover:text-foreground transition-colors">Products</a>
            <a href="#use-cases" className="hover:text-foreground transition-colors">Use Cases</a>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/register"><Button size="sm">Get API key <ArrowRight className="w-4 h-4 ml-1" /></Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 md:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-50/50 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px]" />
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-100 text-amber-800 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Production-grade browser infrastructure for AI agents
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold tracking-tight leading-[1.05]">
            Give your agents access<br />to the <span className="text-gold-gradient">entire web</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            XTREME SCRAPER makes the web as reliable and programmable as APIs. Spin up browsers,
            build AI agents, clone websites, and scrape at scale — all from one platform.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/register">
              <Button size="lg" className="w-full sm:w-auto">
                Get started free <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                View pricing
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">No credit card required · 15 minutes free · Cancel anytime</p>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="py-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold">See what agents can do on the web</h2>
            <p className="mt-3 text-muted-foreground text-lg">From login to task completion, CloudBrowser powers agents that reliably operate on the web.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p) => (
              <Card key={p.name} className="group relative overflow-hidden border-border/50 hover:border-primary/30 transition-all hover:shadow-lg">
                <div className={`absolute inset-0 bg-gradient-to-br ${p.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
                <CardContent className="pt-6">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center mb-4`}>
                    <p.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-xl font-heading font-semibold">{p.name}</h3>
                  <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{p.desc}</p>
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                    Try for free <ArrowRight className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 px-4 md:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold">Anything you can do in a browser, your agent can too</h2>
            <p className="mt-3 text-muted-foreground text-lg">Automate what's tedious. Accelerate what's ambitious.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {useCases.map((uc, i) => (
              <Card key={uc.title} className="border-border/50 hover:shadow-md transition-all cursor-pointer" onClick={() => setActiveUseCase(i)}>
                <CardContent className="pt-5">
                  <uc.icon className={`w-8 h-8 ${uc.color} mb-3`} />
                  <h3 className="font-semibold text-sm">{uc.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{uc.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 3-Step Flow */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold">Zero setup. Real results.</h2>
            <p className="mt-3 text-muted-foreground text-lg">Spin up a browser, connect your model, and execute your first task.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s) => (
              <div key={s.num} className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl font-heading font-bold text-muted-foreground/30">{s.num}</span>
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <h3 className="font-heading font-semibold text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/register">
              <Button size="lg">Start building <ArrowRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 md:px-8 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-heading font-bold">Everything included. Nothing to manage.</h2>
            <p className="mt-3 text-muted-foreground text-lg">Production-grade infrastructure that scales with you.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div key={f.title} className="flex gap-3 p-5 rounded-xl bg-card border border-border/50">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{f.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-3xl md:text-4xl font-heading font-bold text-gold-gradient">
                  {s.value}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gold-gradient p-12 md:p-16 text-center">
            <div className="absolute inset-0 bg-grid-white/10 opacity-10" />
            <h2 className="relative text-3xl md:text-5xl font-heading font-bold text-black">
              100% of the web at production scale
            </h2>
            <p className="relative mt-4 text-lg text-black/70 max-w-xl mx-auto">
              No obstacles for your agents. No limits on what they can accomplish.
            </p>
            <div className="relative mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/register">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">Try for free</Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="ghost" className="w-full sm:w-auto text-black hover:text-black hover:bg-black/10">View pricing</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="https://media.base44.com/images/public/6a837c8e995cc4824aabf594/392c402b4_LOGO.png" alt="XTREME SCRAPER" className="w-7 h-7 shrink-0" fittingType="fit" />
            <span className="font-heading font-semibold">XTREME SCRAPER</span>
            <span className="text-sm text-muted-foreground ml-2">© 2026</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link to="/login" className="hover:text-foreground">Sign in</Link>
            <Link to="/register" className="hover:text-foreground">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}