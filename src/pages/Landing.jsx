import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import {
  ArrowRight, Brain, Code2, ShieldCheck, Bot, Globe2, Sparkles,
  Search, GitBranch, Copy, Gauge, Workflow,
  Video, FileText, MessageSquare,
  TrendingUp, MapPin, CheckCircle2, Network, Cpu,
} from "lucide-react";

const EMBLEM_URL = "https://media.base44.com/images/public/6a837c8e995cc4824aabf594/1433e0cca_generated_image.png";
const GLOBE_URL = "https://media.base44.com/images/public/6a837c8e995cc4824aabf594/12cd5d04d_generated_image.png";

const pillars = [
  { icon: Brain, title: "GPT-Commanded Orchestration", desc: "Every system — coding, cloning, social, SEO, lead gen — commanded by ChatGPT, validated by autonomous QA, and orchestrated end-to-end by GPT." },
  { icon: Code2, title: "Autonomous Coding System", desc: "A coding agent writes, ships, and self-validates. A dedicated QA validator runs capability tests and visual parity checks. Zero human gates between prompt and production." },
  { icon: Copy, title: "Mass Clone & Template Engine", desc: "Scrape any industry at scale. Discover, clone, benchmark, and reverse-engineer competitors into reusable templates. Build your library by ingestion, not by hand." },
  { icon: Globe2, title: "Programmatic Digital Dominance", desc: "Generate hundreds of location-targeted sites per Google's programmatic best practices. Launch to cities nationwide with validated SEO, AEO, and GEO built in." },
];

const autonomousSystems = [
  { icon: Code2, title: "Autonomous Coding Agent", desc: "Writes code, runs tests, self-heals failures, and ships — all validated by a QA validator before it reaches production.", tag: "Code + QA" },
  { icon: Bot, title: "Humanistic AI Agent", desc: "A conversational agent that engages users with natural, human-level dialogue. Lives on your sites, captures leads, answers questions, routes intent.", tag: "Engagement" },
  { icon: Video, title: "Autonomous Social System", desc: "Video generation, content generation, and image generation — fully autonomous. Posts, schedules, and adapts across every platform.", tag: "Content Gen" },
  { icon: Globe2, title: "Website Generation System", desc: "Full website generation from a prompt. Design, copy, structure, deploy — automated and validated for parity before launch.", tag: "Site Builder" },
  { icon: Workflow, title: "Bi-Directional GPT Sync", desc: "ChatGPT installs mockups and live websites directly into your template library. Two-way sync keeps everything current.", tag: "GPT Sync" },
  { icon: TrendingUp, title: "Mass Lead Gen Engine", desc: "Hundreds of location pages, each capturing leads. Validated operational at every destination, with visual links to verify.", tag: "Lead Gen" },
];

const intelligenceEngine = [
  { icon: Search, title: "Mass Industry Scrape", desc: "Scrape entire industries — competitors, directories, content, pricing, structure." },
  { icon: Sparkles, title: "Discover", desc: "Identify high-value targets automatically. Surface gaps, opportunities, and winning patterns." },
  { icon: Copy, title: "Clone", desc: "Full-site clone into isolated sandboxes. Recursive parity loop to 100% visual match." },
  { icon: Gauge, title: "Benchmark", desc: "Score every clone against the original. Performance, SEO, parity, capability — quantified." },
  { icon: GitBranch, title: "Reverse Engineer", desc: "Deconstruct what works. Extract the strategy, structure, and tactics behind winning sites." },
  { icon: FileText, title: "Template Library", desc: "Turn intelligence into reusable templates. Deploy variants at scale, each validated." },
];

const seoCapabilities = [
  { icon: Search, label: "SEO", desc: "Technical SEO, content optimization, schema markup, and GSC sync — automated per page." },
  { icon: MessageSquare, label: "AEO", desc: "Answer Engine Optimization. Structure content so AI search engines cite you as the source." },
  { icon: MapPin, label: "GEO", desc: "Geographic Engine Optimization. Location pages that rank in local and map results." },
  { icon: CheckCircle2, label: "Mass Validation", desc: "Every deployed site verified operational at its destination — with a visual link to check." },
];

const stats = [
  { value: "∞", label: "Sites generated" },
  { value: "100%", label: "Parity validated" },
  { value: "3-Engine", label: "Browser swarm" },
  { value: "GPT", label: "Orchestrated" },
];

function StarField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf;
    const stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      a: Math.random() * 0.5 + 0.1,
      tw: Math.random() * 0.02 + 0.005,
      dir: Math.random() > 0.5 ? 1 : -1,
    }));
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of stars) {
        s.a += s.tw * s.dir;
        if (s.a > 0.7 || s.a < 0.05) s.dir *= -1;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120, 180, 255, ${s.a})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

function OrbitalRings() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[300, 450, 600, 750].map((size, i) => (
        <div
          key={i}
          className="absolute rounded-full border border-primary/10"
          style={{
            width: size, height: size,
            animation: `spin ${20 + i * 10}s linear infinite ${i % 2 ? "reverse" : ""}`,
          }}
        >
          <div className="absolute w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(201,169,97,0.8)]"
            style={{ top: "-3px", left: "50%", transform: "translateX(-50%)" }} />
        </div>
      ))}
    </div>
  );
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#050508] text-neutral-200 overflow-x-hidden">
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
        @keyframes pulse-glow { 0%,100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
      `}</style>

      {/* Nav */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#050508]/90 backdrop-blur-xl border-b border-white/5" : ""}`}>
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src={EMBLEM_URL} alt="Strategic Minds AI" className="w-8 h-8 shrink-0" fittingType="fit" />
            <span className="font-heading font-bold text-sm tracking-widest">STRATEGIC MINDS<span className="text-primary"> AI</span></span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-xs text-neutral-400 font-display tracking-wide uppercase">
            <a href="#systems" className="hover:text-primary transition-colors">Systems</a>
            <a href="#intelligence" className="hover:text-primary transition-colors">Intelligence</a>
            <a href="#domination" className="hover:text-primary transition-colors">Domination</a>
            <a href="#agent" className="hover:text-primary transition-colors">Agent</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login"><Button variant="ghost" size="sm" className="text-neutral-400 hover:text-white">Sign in</Button></Link>
            <Link to="/register"><Button size="sm" className="bg-primary/15 border-primary/40 text-primary hover:bg-primary/25 hover:border-primary/70">Enter <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button></Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 pb-12 px-4">
        <StarField />
        <div className="absolute inset-0 overflow-hidden">
          <Image src={GLOBE_URL} alt="" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140vw] max-w-none h-auto opacity-50 object-contain" fittingType="fit"
            style={{ animation: "float 8s ease-in-out infinite" }} />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050508] via-transparent to-[#050508]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050508] via-transparent to-transparent" />
        </div>
        <OrbitalRings />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px]" style={{ animation: "pulse-glow 4s ease-in-out infinite" }} />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Emblem */}
          <div className="relative mx-auto mb-8 w-40 h-40 md:w-48 md:h-48"
            style={{ animation: "float 6s ease-in-out infinite" }}>
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" style={{ animation: "pulse-glow 3s ease-in-out infinite" }} />
            <Image src={EMBLEM_URL} alt="Strategic Minds AI Emblem" className="relative w-full h-full drop-shadow-[0_0_30px_rgba(201,169,97,0.3)]" fittingType="fit" />
          </div>

          {/* Title */}
          <h1 className="font-heading font-black tracking-tight leading-none text-5xl md:text-7xl lg:text-8xl">
            <span className="chrome-text">STRATEGIC MINDS</span>
            <span className="text-primary ml-2 md:ml-4" style={{ textShadow: "0 0 30px rgba(201,169,97,0.5)" }}>AI</span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 font-display text-sm md:text-base tracking-[0.4em] text-neutral-300 uppercase">
            Intelligence in Motion
          </p>

          {/* Tagline line */}
          <div className="mt-8 flex items-center justify-center gap-3 text-xs md:text-sm font-display tracking-[0.25em] text-neutral-400 uppercase">
            <span>AI Strategy</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(201,169,97,0.8)]" />
            <span>Automation</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(201,169,97,0.8)]" />
            <span>Growth</span>
          </div>

          {/* CTA */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/register">
              <Button size="lg" className="bg-primary/15 border border-primary/50 text-primary hover:bg-primary/25 hover:border-primary px-8 text-sm font-display tracking-wide">
                BUILD SMARTER <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button size="lg" variant="outline" className="border-white/10 text-neutral-300 hover:text-white hover:border-primary/40 hover:bg-primary/5 px-8 text-sm font-display tracking-wide">
                GROW FASTER
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-neutral-500 text-xs font-display tracking-widest animate-pulse">
          SCROLL
        </div>
      </section>

      {/* Pillars */}
      <section id="systems" className="relative py-24 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-display tracking-widest uppercase mb-4">
              <Cpu className="w-3.5 h-3.5" /> The Platform
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-bold text-white">
              One system. <span className="text-gold-gradient">Total intelligence.</span>
            </h2>
            <p className="mt-4 text-neutral-400 max-w-2xl mx-auto text-base">
              An autonomous, GPT-orchestrated platform that codes, clones, generates, deploys, and dominates —
              all commanded by ChatGPT and validated before it ships.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {pillars.map((p) => (
              <div key={p.title} className="xa-card group p-6 md:p-7">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <p.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-heading font-semibold text-lg text-white">{p.title}</h3>
                    <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Autonomous Systems */}
      <section className="relative py-24 px-4 md:px-8 border-t border-white/5">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/5 rounded-full blur-[100px]" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-display tracking-widest uppercase mb-4">
              <Bot className="w-3.5 h-3.5" /> Autonomous Systems
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-bold text-white">
              Six systems. <span className="text-gold-gradient">Zero human gates.</span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {autonomousSystems.map((s) => (
              <div key={s.title} className="xa-card group p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <s.icon className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-[10px] font-display tracking-widest uppercase text-primary/60 border border-primary/20 px-2 py-0.5 rounded-full">{s.tag}</span>
                </div>
                <h3 className="font-heading font-semibold text-base text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed flex-1">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Intelligence Engine */}
      <section id="intelligence" className="relative py-24 px-4 md:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-display tracking-widest uppercase mb-4">
              <Network className="w-3.5 h-3.5" /> Intelligence Engine
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-bold text-white">
              Scrape. Discover. Clone. <span className="text-gold-gradient">Dominate.</span>
            </h2>
            <p className="mt-4 text-neutral-400 max-w-2xl mx-auto text-base">
              Mass industry intelligence — automatically reverse-engineered into reusable templates.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {intelligenceEngine.map((step, i) => (
              <div key={step.title} className="xa-card group p-5 relative">
                <div className="absolute top-4 right-4 text-5xl font-heading font-black text-primary/5 group-hover:text-primary/10 transition-colors">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <step.icon className="w-7 h-7 text-primary mb-3" />
                <h3 className="font-heading font-semibold text-sm text-white">{step.title}</h3>
                <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Digital Domination / SEO */}
      <section id="domination" className="relative py-24 px-4 md:px-8 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-display tracking-widest uppercase mb-4">
              <Globe2 className="w-3.5 h-3.5" /> Digital Domination
            </div>
            <h2 className="text-3xl md:text-5xl font-heading font-bold text-white">
              Programmatic at <span className="text-gold-gradient">hundreds of locations.</span>
            </h2>
            <p className="mt-4 text-neutral-400 max-w-2xl mx-auto text-base">
              Every site validated operational at its destination — with a visual link to check.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {seoCapabilities.map((c) => (
              <div key={c.label} className="xa-card p-6 text-center group">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <c.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-2xl text-white">{c.label}</h3>
                <p className="mt-2 text-xs text-neutral-400 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Validation strip */}
          <div className="mt-10 xa-card p-6 flex flex-col md:flex-row items-center gap-4 md:gap-8">
            <div className="flex items-center gap-3 shrink-0">
              <ShieldCheck className="w-8 h-8 text-primary" />
              <span className="font-heading font-semibold text-white text-sm">Mass Validation</span>
            </div>
            <p className="text-sm text-neutral-400 text-center md:text-left flex-1">
              Every deployed site is pinged, screenshot-verified, and confirmed live at its destination URL.
              Each one gets a visual link so you can check it yourself — no guessing.
            </p>
            <div className="flex items-center gap-2 text-xs font-display tracking-widest uppercase text-primary">
              <CheckCircle2 className="w-4 h-4" /> Validated
            </div>
          </div>
        </div>
      </section>

      {/* Humanistic AI Agent */}
      <section id="agent" className="relative py-24 px-4 md:px-8 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="xa-card p-8 md:p-12 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-[80px]" />
            <div className="relative flex flex-col md:flex-row items-center gap-8">
              <div className="w-24 h-24 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0"
                style={{ animation: "pulse-glow 3s ease-in-out infinite" }}>
                <MessageSquare className="w-12 h-12 text-primary" />
              </div>
              <div className="text-center md:text-left flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-display tracking-widest uppercase mb-3">
                  <Bot className="w-3.5 h-3.5" /> Humanistic AI
                </div>
                <h2 className="text-2xl md:text-4xl font-heading font-bold text-white">
                  An agent that <span className="text-gold-gradient">engages like a human.</span>
                </h2>
                <p className="mt-3 text-sm text-neutral-400 leading-relaxed max-w-xl">
                  A conversational AI that lives on every site you launch. It greets visitors, answers questions,
                  captures leads, and routes intent — with natural, human-level dialogue. Not a chatbot. A presence.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative py-20 px-4 md:px-8 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-4xl md:text-5xl font-heading font-black text-gold-gradient">{s.value}</div>
                <div className="mt-2 text-xs font-display tracking-widest uppercase text-neutral-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative xa-card p-10 md:p-16 text-center overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/15 rounded-full blur-[100px]" />
            <div className="relative">
              <Image src={EMBLEM_URL} alt="" className="w-16 h-16 mx-auto mb-6 opacity-80" fittingType="fit" />
              <h2 className="text-3xl md:text-5xl font-heading font-bold text-white">
                Build smarter.<br /><span className="text-gold-gradient">Grow faster.</span>
              </h2>
              <p className="mt-4 text-neutral-400 max-w-lg mx-auto text-sm">
                The entire platform — coding, cloning, social, SEO, lead gen, and a humanistic agent —
                commanded by ChatGPT and orchestrated by GPT.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/register">
                  <Button size="lg" className="bg-primary/15 border border-primary/50 text-primary hover:bg-primary/25 hover:border-primary px-8 font-display tracking-wide">
                    Enter the System <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button size="lg" variant="outline" className="border-white/10 text-neutral-300 hover:text-white hover:border-primary/40 px-8 font-display tracking-wide">
                    View Pricing
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-4 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <Image src={EMBLEM_URL} alt="Strategic Minds AI" className="w-7 h-7 shrink-0" fittingType="fit" />
              <span className="font-heading font-bold text-sm tracking-widest">STRATEGIC MINDS<span className="text-primary"> AI</span></span>
            </div>
            <div className="flex items-center gap-3 text-xs font-display tracking-[0.25em] text-neutral-500 uppercase">
              <span>AI Strategy</span>
              <span className="w-1 h-1 rounded-full bg-primary/60" />
              <span>Automation</span>
              <span className="w-1 h-1 rounded-full bg-primary/60" />
              <span>Growth</span>
            </div>
            <div className="flex items-center gap-5 text-xs text-neutral-500">
              <Link to="/pricing" className="hover:text-primary transition-colors">Pricing</Link>
              <Link to="/login" className="hover:text-primary transition-colors">Sign in</Link>
              <Link to="/register" className="hover:text-primary transition-colors">Get started</Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 text-center text-xs text-neutral-600">
            © 2026 Strategic Minds AI. Intelligence in Motion.
          </div>
        </div>
      </footer>
    </div>
  );
}