import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import {
  Zap, Globe, Search, Code2, Shield, Bot, Monitor,
  ArrowRight, Sparkles, Lock, Database, Eye, TrendingUp,
  MousePointerClick, Download, RefreshCw, Box, Ghost, Repeat,
  Server, Fingerprint, Cpu, Cloud, Terminal, Check, ChevronDown,
  Activity, Layers, Network, Workflow
} from "lucide-react";
import HeroTerminal from "@/components/landing/HeroTerminal";
import ComparisonTable from "@/components/landing/ComparisonTable";

const LOGO = "https://media.base44.com/images/public/6a837c8e995cc4824aabf594/b9a9faf73_logo.png";

const trustLogos = ["Microsoft", "Heroku", "Webflow", "Samsara", "CVS Health", "Clay", "Ramp", "Amplitude"];

const problemLines = [
  { time: "02:14:03", level: "ERROR", text: "Chrome process crashed (SIGSEGV)" },
  { time: "02:14:11", level: "WARN", text: "memory usage 4.2 GB / 4 GB" },
  { time: "02:14:28", level: "ERROR", text: "session_id=9f3a lost, unable to reconnect" },
  { time: "02:15:02", level: "WARN", text: "captcha_challenge detected, blocked" },
  { time: "02:15:44", level: "ERROR", text: "Chrome 130 → 131: launcher args rejected" },
  { time: "02:16:09", level: "ERROR", text: "queue overflow (127 sessions pending)" },
  { time: "02:16:12", level: "HINT", text: "migrate to CloudBrowser → one-line swap" },
];

const pillars = [
  {
    icon: Search,
    title: "Scrape",
    subtitle: "Get past the blockers",
    desc: "Anti-bot bypass, retries, and Chrome upgrades. Not your problem anymore.",
    points: ["Stealth fingerprints that sites don't flag", "CAPTCHA solving, built in", "Session persistence cuts proxy spend"],
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: Activity,
    title: "Run",
    subtitle: "Production you can sleep through",
    desc: "Years in production, 99.9% uptime. Boring on purpose.",
    points: ["Auto-scales through traffic spikes", "PDF, screenshot, download APIs built in", "Live debugger. Fix in minutes, not hours"],
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Cloud,
    title: "Deploy",
    subtitle: "Your infrastructure, your rules",
    desc: "Cloud, managed cloud, or your own Google Cloud. Same API either way. No lock-in.",
    points: ["Cloud, managed, or self-hosted", "Same API across every deployment", "Custom configs: GPUs, region, your cloud"],
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
];

const useCases = [
  { icon: Bot, title: "Build agents that never sleep", desc: "Send your agent to search, organize, and act on data while you do literally anything else." },
  { icon: Lock, title: "Access the 85% APIs can't reach", desc: "Your agent logs in, navigates, and pulls data from any website, login walls included." },
  { icon: Shield, title: "Catch broken flows before users do", desc: "Run agents that click through your product continuously and alert you the moment something breaks." },
  { icon: TrendingUp, title: "Research at a scale no human could", desc: "Spin up thousands of concurrent browser sessions and return answers immediately." },
  { icon: Eye, title: "Unblock agents that get stuck", desc: "When your workflow requires a form, a CAPTCHA, or a login prompt, it's handled." },
  { icon: MousePointerClick, title: "Let agents fill in the blanks", desc: "Job applications, vendor portals, government forms. Agents that act on the web, not just read it." },
  { icon: RefreshCw, title: "Watch the whole web at once", desc: "Track prices, job listings, product changes, and competitor moves as they happen." },
  { icon: Download, title: "Move data at agent speed", desc: "Upload files, trigger downloads, and process records across hundreds of sites in parallel." },
];

const features = [
  { icon: Shield, title: "Tier-7 CAPTCHA Fallback", desc: "Self-solver → LLM vision → 2captcha → capsolver. Seven tiers, zero blocks." },
  { icon: Globe, title: "Geo-Targeted Proxy Rotation", desc: "Health-scored, weighted-random rotation across 50+ countries with city/ASN/ZIP targeting." },
  { icon: Fingerprint, title: "TLS & Browser Fingerprinting", desc: "Rotating JA3/JA4 fingerprints, human-like behavior patterns, stealth by default." },
  { icon: Box, title: "Sandboxed Recursive Cloning", desc: "Clone any website into an isolated sandbox and iterate to 100% parity automatically." },
  { icon: Ghost, title: "Shadow Mode", desc: "Continuously monitor the original site and auto-re-sync your clone when anything changes." },
  { icon: Code2, title: "MCP Protocol Server", desc: "Connect ChatGPT, Claude, Gemini, or any AI agent via the Model Context Protocol." },
  { icon: Network, title: "Distributed Engine Fleet", desc: "Multi-region Chrome engine replicas with auto-scaling and health-based routing." },
  { icon: Repeat, title: "Self-Healing Parity Loop", desc: "Validate, detect gaps, heal, redeploy, and re-validate until pixel-perfect." },
  { icon: Eye, title: "Live View & Session Recording", desc: "Watch your agents work in real-time with full session recording and replay." },
  { icon: Server, title: "Self-Hosted on Google Cloud", desc: "Deploy entirely within your VPC. Data sovereignty, air-gapped, zero lock-in." },
  { icon: Workflow, title: "Autonomous Workflows", desc: "Schedule, trigger, and chain multi-step browser workflows with durable waits." },
  { icon: Cpu, title: "AI Agent Infrastructure", desc: "Orchestrator + specialist fleet: Growth, Code, Social, Sales, Brand, Replicator, Swarm." },
];

const stats = [
  { value: "175M+", label: "Docker pulls" },
  { value: "99.9%", label: "Uptime, measured" },
  { value: "8+", label: "Years in production" },
  { value: "2,000+", label: "Paying customers" },
];

const enterpriseFeatures = [
  { icon: Server, title: "Self-Hosted or Managed", desc: "Run on your Google Cloud, our managed cloud, or air-gapped on-prem. Same API across every deployment." },
  { icon: Shield, title: "Security & Compliance", desc: "SSO, audit logs, SOC 2 controls, data residency. Your security review can approve it." },
  { icon: Cloud, title: "Custom Infrastructure", desc: "Specify GPUs, operating systems, cloud providers, and regions. Tailored to your workload." },
  { icon: Layers, title: "Persistent Sessions", desc: "Keep browsers warm for reconnecting. Custom cache, cookies, and authenticated profiles." },
];

const codeTabs = [
  { name: "puppeteer.ts", code: `import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserWSEndpoint:
    'wss://cloud-browser.base44.app/engine?token=KEY',
});

const page = await browser.newPage();
await page.goto('https://example.com');` },
  { name: "playwright.ts", code: `import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP(
  'wss://cloud-browser.base44.app/engine?token=KEY'
);

const page = await browser.newPage();
await page.goto('https://example.com');` },
  { name: "rest.sh", code: `curl -X POST https://cloud-browser.base44.app/api/sessions \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "url": "https://example.com" }'` },
];

export default function Landing() {
  const [activeTab, setActiveTab] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link to="/landing" className="flex items-center gap-2.5">
            <Image src={LOGO} alt="CloudBrowser" className="w-8 h-8 shrink-0" fittingType="fit" />
            <span className="font-bold text-[15px] tracking-tight">CloudBrowser</span>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">ENTERPRISE</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm text-white/60">
            <a href="#platform" className="hover:text-white transition-colors">Platform</a>
            <a href="#solutions" className="hover:text-white transition-colors">Solutions</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#comparison" className="hover:text-white transition-colors">Compare</a>
            <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link to="/login" className="hover:text-white transition-colors">Sign in</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/register">
              <Button size="sm" className="bg-white text-black hover:bg-white/90 font-semibold">
                Get API key <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
            <button className="md:hidden p-2 text-white/60" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="md:hidden border-t border-white/10 px-4 py-3 space-y-2 bg-[#0a0a0a]">
            <a href="#platform" className="block text-sm text-white/60 py-1" onClick={() => setMobileNavOpen(false)}>Platform</a>
            <a href="#solutions" className="block text-sm text-white/60 py-1" onClick={() => setMobileNavOpen(false)}>Solutions</a>
            <a href="#features" className="block text-sm text-white/60 py-1" onClick={() => setMobileNavOpen(false)}>Features</a>
            <a href="#comparison" className="block text-sm text-white/60 py-1" onClick={() => setMobileNavOpen(false)}>Compare</a>
            <Link to="/pricing" className="block text-sm text-white/60 py-1" onClick={() => setMobileNavOpen(false)}>Pricing</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 md:px-8 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/8 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,234,0,0.04),transparent_60%)]" />
        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-white/70 mb-6">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Self-hosted browser infrastructure for AI agents
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05]">
              The browser layer<br />
              your agents run on.
            </h1>
            <p className="mt-6 text-lg text-white/60 max-w-xl leading-relaxed">
              Bring your own agent and library, or run ours. Stealth, CAPTCHA, residential proxies,
              and authenticated profiles that persist and scale to thousands. Deploy on your Google Cloud
              or ours. Your agent gets in, and gets it done.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
              <Link to="/register">
                <Button size="lg" className="bg-white text-black hover:bg-white/90 font-semibold w-full sm:w-auto">
                  Get your API key <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <a href="#platform">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/20 bg-transparent text-white hover:bg-white/5 hover:text-white">
                  Read the docs
                </Button>
              </a>
            </div>
            <p className="mt-4 text-sm text-white/40">1k free runs a month. No card, no catch.</p>
          </div>
          <div className="relative">
            <HeroTerminal />
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="py-12 px-4 md:px-8 border-y border-white/5">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-xs font-semibold text-white/30 uppercase tracking-wider mb-6">
            Trusted by 2,000+ teams, from solo devs to global enterprise
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {trustLogos.map((logo) => (
              <span key={logo} className="text-lg font-bold text-white/25 tracking-tight">{logo}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold">
              Why your AI automation works in the demo<br className="hidden md:block" /> and dies in production
            </h2>
            <p className="mt-4 text-white/50 text-lg max-w-2xl mx-auto">
              Your model reasons just fine. It's the browser underneath that gets blocked, loses the login,
              and stalls three steps into the task. The intelligence was never the bottleneck. The web was.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d0d0d] overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
              <Terminal className="w-4 h-4 text-white/40" />
              <span className="text-xs text-white/40 font-mono">prod.log</span>
            </div>
            <div className="p-5 font-mono text-[13px] leading-relaxed space-y-1">
              {problemLines.map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-white/30 shrink-0">{line.time}</span>
                  <span className={`shrink-0 font-semibold ${
                    line.level === "ERROR" ? "text-red-400" :
                    line.level === "WARN" ? "text-amber-400" :
                    line.level === "HINT" ? "text-emerald-400" : "text-white/50"
                  }`}>{line.level.padEnd(5)}</span>
                  <span className={line.level === "HINT" ? "text-emerald-400" : "text-white/70"}>{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3-Line Setup */}
      <section id="platform" className="py-20 px-4 md:px-8 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold">Connect your scripts in minutes</h2>
            <p className="mt-3 text-white/50 text-lg">Three lines, no rewrite. Swap launch() for connect().</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d0d0d] overflow-hidden">
            <div className="flex border-b border-white/10">
              {codeTabs.map((tab, i) => (
                <button
                  key={tab.name}
                  onClick={() => setActiveTab(i)}
                  className={`px-4 py-2.5 text-xs font-mono transition-colors ${
                    activeTab === i ? "bg-white/5 text-white border-b-2 border-amber-400" : "text-white/40 hover:text-white/60"
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>
            <div className="p-5">
              <pre className="font-mono text-[13px] leading-relaxed text-white/80 overflow-x-auto"><code>{codeTabs[activeTab].code}</code></pre>
            </div>
          </div>
          <div className="mt-8 grid md:grid-cols-3 gap-6">
            {[
              { num: "01", title: "Swap launch() for connect()", desc: "One-line change. Your automation code stays identical." },
              { num: "02", title: "Drop in your API key", desc: "Free plan: 1k sessions/month. No credit card required." },
              { num: "03", title: "Ship to production", desc: "Self-hosted on your Google Cloud or managed by us." },
            ].map((s) => (
              <div key={s.num} className="flex gap-3">
                <span className="text-2xl font-bold text-white/20">{s.num}</span>
                <div>
                  <h3 className="font-semibold text-sm">{s.title}</h3>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars: Scrape / Run / Deploy */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Your browser layer, without the trade-offs</h2>
            <p className="mt-3 text-white/50 text-lg">Scrape anything. Run anywhere. Deploy on your terms.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {pillars.map((p) => (
              <div key={p.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/20 transition-colors">
                <div className={`w-12 h-12 rounded-xl ${p.bg} flex items-center justify-center mb-4`}>
                  <p.icon className={`w-6 h-6 ${p.color}`} />
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <h3 className="text-2xl font-bold">{p.title}</h3>
                  <span className="text-sm text-white/40">{p.subtitle}</span>
                </div>
                <p className="text-white/50 text-sm leading-relaxed mb-4">{p.desc}</p>
                <ul className="space-y-2">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-sm text-white/70">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="solutions" className="py-20 px-4 md:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Anything you can do in a browser, your agent can too</h2>
            <p className="mt-3 text-white/50 text-lg">Automate what's tedious. Accelerate what's ambitious.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {useCases.map((uc) => (
              <div key={uc.title} className="rounded-xl border border-white/10 bg-[#0d0d0d] p-5 hover:border-amber-500/30 hover:bg-amber-500/5 transition-all cursor-pointer">
                <uc.icon className="w-7 h-7 text-amber-400 mb-3" />
                <h3 className="font-semibold text-sm">{uc.title}</h3>
                <p className="mt-1.5 text-xs text-white/50 leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Everything included. Nothing to manage.</h2>
            <p className="mt-3 text-white/50 text-lg">Production-grade infrastructure that scales with you.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div key={f.title} className="flex gap-3 p-5 rounded-xl border border-white/10 bg-white/[0.02] hover:border-white/20 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{f.title}</h3>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 md:px-8 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((s) => (
            <div key={s.label}>
              <div className="text-4xl md:text-5xl font-bold text-gold-gradient">{s.value}</div>
              <div className="mt-2 text-sm text-white/40">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section id="comparison" className="py-20 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold">How CloudBrowser compares</h2>
            <p className="mt-3 text-white/50 text-lg">The only platform that's self-hosted, AI-native, and clone-capable.</p>
          </div>
          <ComparisonTable />
          <p className="mt-4 text-center text-xs text-white/30">
            Comparison based on publicly available documentation as of Oct 2026. Competitor names are trademarks of their respective owners.
          </p>
        </div>
      </section>

      {/* Enterprise */}
      <section className="py-20 px-4 md:px-8 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Browser infrastructure your security review can approve</h2>
            <p className="mt-3 text-white/50 text-lg max-w-2xl mx-auto">
              CloudBrowser runs the headless browsers behind your automation, in our cloud or entirely on your own infrastructure.
              Same Puppeteer and Playwright code, no browser fleet to operate.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {enterpriseFeatures.map((f) => (
              <div key={f.title} className="rounded-xl border border-white/10 bg-[#0d0d0d] p-6">
                <f.icon className="w-8 h-8 text-amber-400 mb-3" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-white/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gold-gradient p-12 md:p-16 text-center">
            <h2 className="relative text-3xl md:text-5xl font-bold text-black">100% of the web at production scale</h2>
            <p className="relative mt-4 text-lg text-black/70 max-w-xl mx-auto">
              No obstacles for your agents. No limits on what they can accomplish.
            </p>
            <div className="relative mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/register">
                <Button size="lg" className="bg-black text-white hover:bg-black/90 font-semibold w-full sm:w-auto">Try for free</Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="ghost" className="w-full sm:w-auto text-black hover:text-black hover:bg-black/10">View pricing</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Image src={LOGO} alt="CloudBrowser" className="w-7 h-7 shrink-0" fittingType="fit" />
                <span className="font-bold">CloudBrowser</span>
              </div>
              <p className="text-sm text-white/40 leading-relaxed">
                Enterprise-grade, self-hosted browser automation platform for AI agents and data extraction.
              </p>
            </div>
            {[
              { title: "Platform", links: ["Overview", "Browsers as a Service", "APIs", "Self-Hosted", "MCP Server"] },
              { title: "Solutions", links: ["Web Scraping", "Automation", "AI Agents", "Testing", "Screenshots & PDFs"] },
              { title: "Resources", links: ["Pricing", "Docs", "Customers", "Blog", "Trust Center"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold text-sm mb-3 text-white/80">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-white/40 hover:text-white/70 transition-colors">{link}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/30">© 2026 CloudBrowser. All rights reserved.</p>
            <div className="flex items-center gap-6 text-sm text-white/40">
              <a href="#" className="hover:text-white/70 transition-colors">Privacy</a>
              <a href="#" className="hover:text-white/70 transition-colors">Terms</a>
              <a href="#" className="hover:text-white/70 transition-colors">Security</a>
              <Link to="/login" className="hover:text-white/70 transition-colors">Admin Login</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}