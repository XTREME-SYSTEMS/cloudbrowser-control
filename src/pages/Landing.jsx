import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import HeroTerminal from "@/components/landing/HeroTerminal";
import ComparisonTable from "@/components/landing/ComparisonTable";
import BrandLockup from '@/components/BrandLockup';
import { Image } from '@/components/ui/image';

const HERO_IMG = "https://media.base44.com/images/public/6a837c8e995cc4824aabf594/95e5949ab_generated_c1209656.jpg";
const PILLARS_IMG = "https://media.base44.com/images/public/6a837c8e995cc4824aabf594/3933df600_generated_29400de6.jpg";
const ENTERPRISE_IMG = "https://media.base44.com/images/public/6a837c8e995cc4824aabf594/be97ddf69_generated_07697d22.jpg";

const trustLogos = ["Microsoft", "Heroku", "Webflow", "Samsara", "CVS Health", "Clay", "Ramp", "Amplitude"];

const problemLines = [
  { time: "02:14:03", level: "ERROR", text: "Chrome process crashed (SIGSEGV)" },
  { time: "02:14:11", level: "WARN", text: "memory usage 4.2 GB / 4 GB" },
  { time: "02:14:28", level: "ERROR", text: "session_id=9f3a lost, unable to reconnect" },
  { time: "02:15:02", level: "WARN", text: "captcha_challenge detected, blocked" },
  { time: "02:15:44", level: "ERROR", text: "Chrome 130 → 131: launcher args rejected" },
  { time: "02:16:09", level: "ERROR", text: "queue overflow (127 sessions pending)" },
  { time: "02:16:12", level: "HINT", text: "migrate to Xtreme Cloud Browser → one-line swap" },
];

const pillars = [
  { tag: "01 / SCRAPE", title: "Scrape", subtitle: "Get past the blockers", desc: "Anti-bot bypass, retries, and Chrome upgrades. Not your problem anymore.", points: ["Stealth fingerprints that sites don't flag", "CAPTCHA solving, built in", "Session persistence cuts proxy spend"] },
  { tag: "02 / RUN", title: "Run", subtitle: "Production you can sleep through", desc: "Years in production, 99.9% uptime. Boring on purpose.", points: ["Auto-scales through traffic spikes", "PDF, screenshot, download APIs built in", "Live debugger. Fix in minutes, not hours"] },
  { tag: "03 / DEPLOY", title: "Deploy", subtitle: "Your infrastructure, your rules", desc: "Cloud, managed cloud, or your own Google Cloud. Same API either way. No lock-in.", points: ["Cloud, managed, or self-hosted", "Same API across every deployment", "Custom configs: GPUs, region, your cloud"] },
];

const useCases = [
  { title: "Build agents that never sleep", desc: "Send your agent to search, organize, and act on data while you do literally anything else." },
  { title: "Access the 85% APIs can't reach", desc: "Your agent logs in, navigates, and pulls data from any website, login walls included." },
  { title: "Catch broken flows before users do", desc: "Run agents that click through your product continuously and alert you the moment something breaks." },
  { title: "Research at a scale no human could", desc: "Spin up thousands of concurrent browser sessions and return answers immediately." },
  { title: "Unblock agents that get stuck", desc: "When your workflow requires a form, a CAPTCHA, or a login prompt, it's handled." },
  { title: "Let agents fill in the blanks", desc: "Job applications, vendor portals, government forms. Agents that act on the web, not just read it." },
  { title: "Watch the whole web at once", desc: "Track prices, job listings, product changes, and competitor moves as they happen." },
  { title: "Move data at agent speed", desc: "Upload files, trigger downloads, and process records across hundreds of sites in parallel." },
];

const features = [
  { title: "Tier-7 CAPTCHA Fallback", desc: "Self-solver → LLM vision → 2captcha → capsolver. Seven tiers, zero blocks." },
  { title: "Geo-Targeted Proxy Rotation", desc: "Health-scored, weighted-random rotation across 50+ countries with city/ASN/ZIP targeting." },
  { title: "TLS & Browser Fingerprinting", desc: "Rotating JA3/JA4 fingerprints, human-like behavior patterns, stealth by default." },
  { title: "Sandboxed Recursive Cloning", desc: "Clone any website into an isolated sandbox and iterate to 100% parity automatically." },
  { title: "Shadow Mode", desc: "Continuously monitor the original site and auto-re-sync your clone when anything changes." },
  { title: "MCP Protocol Server", desc: "Connect ChatGPT, Claude, Gemini, or any AI agent via the Model Context Protocol." },
  { title: "Distributed Engine Fleet", desc: "Multi-region Chrome engine replicas with auto-scaling and health-based routing." },
  { title: "Self-Healing Parity Loop", desc: "Validate, detect gaps, heal, redeploy, and re-validate until pixel-perfect." },
  { title: "Live View & Session Recording", desc: "Watch your agents work in real-time with full session recording and replay." },
  { title: "Self-Hosted on Google Cloud", desc: "Deploy entirely within your VPC. Data sovereignty, air-gapped, zero lock-in." },
  { title: "Autonomous Workflows", desc: "Schedule, trigger, and chain multi-step browser workflows with durable waits." },
  { title: "AI Agent Infrastructure", desc: "Orchestrator + specialist fleet: Growth, Code, Social, Sales, Brand, Replicator, Swarm." },
];

const stats = [
  { value: "175M+", label: "Docker pulls", gauge: 76 },
  { value: "99.9%", label: "Uptime, measured", gauge: 99 },
  { value: "8+", label: "Years in production", gauge: 80 },
  { value: "2,000+", label: "Paying customers", gauge: 65 },
];

const enterpriseFeatures = [
  { title: "Self-Hosted or Managed", desc: "Run on your Google Cloud, our managed cloud, or air-gapped on-prem. Same API across every deployment." },
  { title: "Security & Compliance", desc: "SSO, audit logs, SOC 2 controls, data residency. Your security review can approve it." },
  { title: "Custom Infrastructure", desc: "Specify GPUs, operating systems, cloud providers, and regions. Tailored to your workload." },
  { title: "Persistent Sessions", desc: "Keep browsers warm for reconnecting. Custom cache, cookies, and authenticated profiles." },
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
  const [clock, setClock] = useState(14 * 60 + 3);

  useEffect(() => {
    const t = setInterval(() => setClock((c) => (c > 0 ? c - 1 : 14 * 60 + 3)), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtClock = (s) =>
    `T\u2212 ${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-[#121214] text-[#e7e8e9] font-body">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 h-16 border-b border-[#34363a] bg-[#161619]">
        <div className="max-w-7xl mx-auto h-full px-6 md:px-8 flex items-center justify-between">
          <Link to="/landing" className="min-w-0"><BrandLockup compact /></Link>
          <div className="hidden lg:flex items-center gap-5 text-sm text-muted-foreground">
            <a href="#platform" className="hover:text-[#ffae52] transition-colors">Platform</a>
            <a href="#solutions" className="hover:text-[#ffae52] transition-colors">Solutions</a>
            <a href="#features" className="hover:text-[#ffae52] transition-colors">Features</a>
            <a href="#comparison" className="hover:text-[#ffae52] transition-colors">Compare</a>
            <Link to="/pricing" className="hover:text-[#ffae52] transition-colors">Pricing</Link>
            <Link to="/login" className="hover:text-[#ffae52] transition-colors">Sign in</Link>
            <Link to="/register" className="xa-btn-primary">Get API key →</Link>
            <span className="xa-pulse font-mono text-[11px] font-bold text-[#ff8800] tracking-wider border-l border-[#48494b] pl-3.5">
              {fmtClock(clock)}
            </span>
          </div>
          <div className="flex lg:hidden items-center gap-2">
            <Link to="/register" className="xa-btn-primary text-[10px] px-3 py-2">Get key</Link>
            <button aria-label="Toggle navigation" aria-expanded={mobileNavOpen} className="p-2 text-muted-foreground" onClick={() => setMobileNavOpen(!mobileNavOpen)}>
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="lg:hidden border-t border-[#34363a] px-6 py-3 space-y-2 bg-[#161619] text-xs text-[#b5b8bc]">
            <a href="#platform" onClick={() => setMobileNavOpen(false)} className="block py-1 hover:text-[#ffae52]">Platform</a>
            <a href="#solutions" onClick={() => setMobileNavOpen(false)} className="block py-1 hover:text-[#ffae52]">Solutions</a>
            <a href="#features" onClick={() => setMobileNavOpen(false)} className="block py-1 hover:text-[#ffae52]">Features</a>
            <a href="#comparison" onClick={() => setMobileNavOpen(false)} className="block py-1 hover:text-[#ffae52]">Compare</a>
            <Link to="/pricing" onClick={() => setMobileNavOpen(false)} className="block py-1 hover:text-[#ffae52]">Pricing</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden grid lg:grid-cols-[1.05fr_0.95fr] gap-10 px-6 md:px-11 xl:px-20 pt-32 pb-20 lg:items-center min-h-[620px]">
        <Image src={HERO_IMG} alt="" className="absolute inset-0 w-full h-full opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#121214] via-[#121214]/85 to-[#121214]/20" />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#121214] to-transparent" />
        <div className="relative z-10 xa-arrive" style={{ animationDelay: "0.12s" }}>
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 border border-[#51402e] bg-[#1d1a16] text-[11px] text-[#e1ded8] rounded-sm mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff8800] shadow-[0_0_10px_#ff8800]" />
            Self-hosted browser infrastructure for AI agents
          </div>
          <h1 className="text-5xl md:text-6xl xl:text-7xl font-bold uppercase tracking-tight leading-[0.98] font-heading">
            The browser layer<br />your agents run on.
          </h1>
          <p className="mt-6 text-base text-muted-foreground leading-relaxed max-w-xl">
            Bring your own agent and library, or run ours. Stealth, CAPTCHA, residential proxies,
            and authenticated profiles that persist and scale to thousands. Deploy on your Google Cloud
            or ours. Your agent gets in, and gets it done.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-7">
            <Link to="/register" className="xa-btn-primary">Get your API key →</Link>
            <a href="#platform" className="xa-btn-outline">Read the docs</a>
          </div>
          <p className="mt-3 text-[11px] text-[#9ca3af]">1k free runs a month. No card, no catch.</p>
        </div>
        <div className="relative z-10 xa-arrive" style={{ animationDelay: "0.28s" }}>
          <HeroTerminal />
        </div>
      </section>

      {/* Trust */}
      <section className="py-4 px-6 md:px-9 border-y border-[#2c2d30] bg-[#171719] text-center">
        <p className="text-[10px] text-[#85898d] tracking-[1.3px] uppercase mb-3">
          Trusted by 2,000+ teams, from solo devs to global enterprise
        </p>
        <div className="flex flex-wrap justify-center md:justify-between gap-3 md:gap-0 text-[13px] font-bold text-[#a6a8aa]">
          {trustLogos.map((l) => <span key={l}>{l}</span>)}
        </div>
      </section>

      {/* Problem */}
      <section className="py-16 md:py-20 px-6 md:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">
              Why your AI automation works in the demo<br className="hidden md:block" /> and dies in production
            </h2>
            <p className="mt-2 text-xs text-[#aeb1b4] max-w-[650px] mx-auto leading-relaxed">
              Your model reasons just fine. It's the browser underneath that gets blocked, loses the login,
              and stalls three steps into the task. The intelligence was never the bottleneck. The web was.
            </p>
          </div>
          <div className="xa-panel">
            <div className="font-mono text-[10px] text-[#ff8800] mb-2">prod.log</div>
            <div className="font-mono text-[10px] leading-[1.8] text-[#c7c9cc]">
              {problemLines.map((line, i) => (
                <div key={i}>
                  <span className="text-[#777d83] mr-2">{line.time}</span>
                  <b className={line.level === "ERROR" ? "text-[#f08071]" : line.level === "WARN" ? "text-[#e8b35f]" : "text-[#ff8800]"}>
                    {line.level.padEnd(5)}
                  </b>{" "}{line.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Platform / 3-Line Setup */}
      <section id="platform" className="py-16 md:py-20 px-6 md:px-10 bg-[#18191b] border-y border-[#2a2c2f]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">Connect your scripts in minutes</h2>
            <p className="mt-3 text-sm text-muted-foreground">Three lines, no rewrite. Swap launch() for connect().</p>
          </div>
          <div className="grid md:grid-cols-2 gap-3.5">
            <div className="xa-panel">
              <div className="flex gap-2 mb-2">
                {codeTabs.map((tab, i) => (
                  <button
                    key={tab.name}
                    onClick={() => setActiveTab(i)}
                    className={`font-mono text-[10px] px-2 py-1 rounded-sm transition-colors ${
                      activeTab === i ? "text-[#ff8800] bg-[#ff8800]/10" : "text-[#777d83] hover:text-[#aeb1b4]"
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>
              <pre className="font-mono text-[10px] leading-[1.7] text-[#d5d8db] whitespace-pre-wrap"><code>{codeTabs[activeTab].code}</code></pre>
            </div>
            <div className="grid gap-2.5 content-center">
              {[
                { num: "01", title: "Swap launch() for connect()", desc: "One-line change. Your automation code stays identical." },
                { num: "02", title: "Drop in your API key", desc: "Free plan: 1k sessions/month. No credit card required." },
                { num: "03", title: "Ship to production", desc: "Self-hosted on your Google Cloud or managed by us." },
              ].map((s) => (
                <div key={s.num} className="flex gap-3 text-[11px] text-[#d8dadd]">
                  <strong className="text-[#ff8800] text-[17px] font-bold">{s.num}</strong>
                  <div>
                    <b>{s.title}</b>
                    <p className="text-[#a9adb1] mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="py-16 md:py-20 px-6 md:px-10">
        <div className="max-w-7xl mx-auto">
          <Image src={PILLARS_IMG} alt="" className="w-full h-44 md:h-60 rounded-lg border border-border mb-3" />
          <div className="text-center mb-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">Your browser layer, without the trade-offs</h2>
            <p className="mt-3 text-sm text-muted-foreground">Scrape anything. Run anywhere. Deploy on your terms.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {pillars.map((p) => (
              <div key={p.title} className="xa-card">
                <div className="font-mono text-[10px] text-[#ff8800] mb-2">{p.tag}</div>
                <h3 className="text-[15px] font-bold mb-1.5">
                  {p.title}{"\u3000"}<span className="text-sm text-[#9ca3af] font-normal">{p.subtitle}</span>
                </h3>
                <p className="text-[11px] text-[#aeb2b6] leading-relaxed">{p.desc}</p>
                <ul className="pl-4 mt-2 space-y-1 list-disc">
                  {p.points.map((pt) => (
                    <li key={pt} className="text-[11px] text-[#aeb2b6]">{pt}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="solutions" className="py-16 md:py-20 px-6 md:px-10 bg-[#18191b] border-y border-[#2a2c2f]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">Anything you can do in a browser, your agent can too</h2>
            <p className="mt-3 text-sm text-muted-foreground">Automate what's tedious. Accelerate what's ambitious.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {useCases.map((uc) => (
              <div key={uc.title} className="xa-smallcard">
                <h3 className="text-lg font-heading font-bold mb-2">{uc.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-20 px-6 md:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">Everything included. Nothing to manage.</h2>
            <p className="mt-3 text-sm text-muted-foreground">Production-grade infrastructure that scales with you.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {features.map((f) => (
              <div key={f.title} className="xa-smallcard">
                <h3 className="text-lg font-heading font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 md:py-20 px-6 md:px-10 bg-[#18191b] border-y border-[#2a2c2f]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 text-center">
          {stats.map((s) => (
            <div key={s.label} className="p-3 border border-[#34373a] bg-[#191a1c]">
              <strong className="text-2xl text-[#ff8800] block font-bold font-heading">{s.value}</strong>
              <div className="xa-gauge" style={{ background: `linear-gradient(90deg, #ff8800 0 ${s.gauge}%, #444 ${s.gauge}%)` }} />
              <span className="text-[10px] text-[#aeb1b4]">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section id="comparison" className="py-16 md:py-20 px-6 md:px-10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">How Xtreme Cloud Browser compares</h2>
            <p className="mt-3 text-sm text-muted-foreground">The only platform that's self-hosted, AI-native, and clone-capable.</p>
          </div>
          <ComparisonTable />
          <p className="mt-3 text-center text-[10px] text-[#85898d]">
            Comparison based on publicly available documentation as of Oct 2026. Competitor names are trademarks of their respective owners.
          </p>
        </div>
      </section>

      {/* Enterprise */}
      <section className="py-16 md:py-20 px-6 md:px-10 bg-[#18191b] border-y border-[#2a2c2f]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-5">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight font-heading">Browser infrastructure your security review can approve</h2>
            <p className="mt-2 text-xs text-[#aeb1b4] max-w-[650px] mx-auto">
              Xtreme Cloud Browser runs the headless browsers behind your automation, in our cloud or entirely on your own infrastructure.
              Same Puppeteer and Playwright code, no browser fleet to operate.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-3.5 items-center">
            <Image src={ENTERPRISE_IMG} alt="" className="w-full h-44 md:h-60 rounded-lg border border-border" />
            <div className="grid grid-cols-2 gap-2">
              {enterpriseFeatures.map((f) => (
                <div key={f.title} className="xa-smallcard">
                  <h3 className="text-xs font-bold mb-1.5">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-20 px-6 md:px-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center bg-gradient-to-r from-[#b95700] via-[#ff8800] to-[#c96708] text-[#151413] rounded-[5px] p-7">
            <h2 className="text-2xl font-extrabold font-heading">100% of the web at production scale</h2>
            <p className="text-xs mt-1">No obstacles for your agents. No limits on what they can accomplish.</p>
            <div className="mt-5 flex flex-col sm:flex-row justify-center gap-2.5">
              <Link to="/register" className="xa-btn-dark">Try for free</Link>
              <Link to="/pricing" className="xa-btn-dark">View pricing</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-6 md:px-10 border-t border-[#333] text-[11px] text-[#999]">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BrandLockup compact />
              </div>
              <p className="text-[#777d83] leading-relaxed">
                Enterprise-grade, self-hosted browser automation platform for AI agents and data extraction.
              </p>
            </div>
            {[
              { title: "Platform", links: ["Overview", "Browsers as a Service", "APIs", "Self-Hosted", "MCP Server"] },
              { title: "Solutions", links: ["Web Scraping", "Automation", "AI Agents", "Testing", "Screenshots & PDFs"] },
              { title: "Resources", links: ["Pricing", "Docs", "Customers", "Blog", "Trust Center"] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="font-bold text-xs mb-2 text-[#e7e8e9]">{col.title}</h4>
                <ul className="space-y-1.5">
                  {col.links.map((l) => (
                    <li key={l}><a href="#" className="hover:text-[#ffae52] transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-5 border-t border-[#333] flex flex-col md:flex-row justify-between gap-3">
            <p className="text-[#777d83]">&copy; 2026 Xtreme Cloud Browser. All rights reserved.</p>
            <div className="flex gap-5">
              <a href="#" className="hover:text-[#ffae52] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[#ffae52] transition-colors">Terms</a>
              <a href="#" className="hover:text-[#ffae52] transition-colors">Security</a>
              <Link to="/login" className="hover:text-[#ffae52] transition-colors">Admin Login</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}