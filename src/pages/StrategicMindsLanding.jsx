import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Brain, Globe, Rocket, Search, Users,
  Target, Zap, Shield, TrendingUp, Code2, Network, Sparkles,
  BarChart3, Bot, Layers, CheckCircle2, Star,
} from "lucide-react";

const EARTH_IMG = "https://www.strategicmindsai.com/v2-assets/connected-earth.jpg";
const EMBLEM_IMG = "https://www.strategicmindsai.com/v2-assets/silver-emblem.png";
const WORDMARK_IMG = "https://www.strategicmindsai.com/v2-assets/chrome-wordmark.png";

const NAV_LINKS = [
  { label: "HOME", to: "/" },
  { label: "SERVICES", to: "/digital-dominance" },
  { label: "SOLUTIONS", to: "/website-factory" },
  { label: "INDUSTRIES", to: "/intelligence-command-center" },
  { label: "PRICING", to: "/pricing" },
  { label: "PORTAL", to: "/client-portal" },
  { label: "CONTACT", to: "/connect" },
];

const PILLARS = [
  { icon: Brain, title: "Autonomous Intelligence", desc: "AI-driven market research, competitor reverse engineering, and strategic decision engines that operate 24/7 without human intervention.", to: "/intelligence-command-center" },
  { icon: Globe, title: "Digital Domination", desc: "Mass website orchestration, SEO/AEO optimization, and geo-targeted content factories that capture every relevant search query.", to: "/digital-dominance" },
  { icon: Rocket, title: "Autonomous Factory", desc: "End-to-end software factory that builds, deploys, and manages client platforms from discovery to delivery automatically.", to: "/website-factory" },
  { icon: Search, title: "Forensic Search", desc: "Deep-skip tracing, heir search, and people-finding pipelines that surface decision-maker contacts at scale.", to: "/skip-tracing" },
];

const SERVICES = [
  { icon: Target, title: "Lead Generation", desc: "Mass-scale prospect acquisition with verified contacts, enriched profiles, and AI-scored intent.", to: "/skip-tracing" },
  { icon: Zap, title: "SEO & AEO", desc: "Answer Engine Optimization that ranks your brand in AI search results, not just Google.", to: "/keyword-intelligence" },
  { icon: Code2, title: "Website Factory", desc: "Autonomous website generation with brand-accurate design replication and instant deployment.", to: "/website-factory" },
  { icon: Bot, title: "Agent Swarms", desc: "Multi-agent orchestration for research, analysis, and execution across any domain.", to: "/swarm-orchestrator" },
  { icon: Network, title: "Social Presence", desc: "Automated multi-platform posting, hashtag campaigns, and directory submissions.", to: "/social-presence" },
  { icon: Shield, title: "Stealth Operations", desc: "Residential proxy rotation, TLS fingerprint matching, and CAPTCHA-solving fallback chains.", to: "/sandboxed-clone" },
];

const STATS = [
  { value: "12-Step", label: "Intelligence Pipeline" },
  { value: "99%", label: "Visual Parity Target" },
  { value: "20+", label: "Autonomous Agents" },
  { value: "24/7", label: "Always Operating" },
];

const TESTIMONIALS = [
  { name: "Corporate Client", role: "Enterprise Growth", text: "Strategic Minds AI transformed our market research. What took weeks now happens in hours, autonomously.", rating: 5 },
  { name: "Agency Partner", role: "Digital Marketing", text: "The autonomous factory builds and deploys client sites faster than any team we've worked with.", rating: 5 },
  { name: "Legal Firm", role: "Heir Search", text: "Their forensic search pipeline found heirs we couldn't locate in months of manual work.", rating: 5 },
];

export default function StrategicMindsLanding() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen bg-[#06080d] text-white overflow-x-hidden relative">
      {/* Nebula glow background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 35%, rgba(0,180,255,0.08), transparent 60%), radial-gradient(ellipse 50% 40% at 50% 55%, rgba(0,255,136,0.05), transparent 60%)",
        }}
      />
      <Starfield />

      {/* Top Navigation */}
      <header className="relative z-20 px-4 sm:px-6 lg:px-10 pt-5">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center bg-white/5 backdrop-blur-sm">
              <span className="font-heading font-bold text-sm text-white">S</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md">
            {NAV_LINKS.map((link) => (
              <Link key={link.label} to={link.to} className="px-3.5 py-1.5 rounded-full text-[11px] font-display font-semibold tracking-widest text-white/70 hover:text-white hover:bg-white/5 transition-all">
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/client-onboarding" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-display font-bold tracking-widest text-[#00b4ff] border border-[#00b4ff]/40 bg-[#00b4ff]/5 hover:bg-[#00b4ff]/10 transition-all">
              CALL NOW
            </Link>
          </div>
        </div>
        <nav className="md:hidden mt-3 flex items-center gap-1 px-2 py-1.5 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-x-auto xa-scroll">
          {NAV_LINKS.map((link) => (
            <Link key={link.label} to={link.to} className="px-3 py-1.5 rounded-full text-[10px] font-display font-semibold tracking-widest text-white/70 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap">
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 flex flex-col items-center justify-center px-4 py-16 sm:py-20 lg:py-24 min-h-[80vh]">
        <div className={`relative mb-6 transition-all duration-1000 ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
          <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(0,180,255,0.25) 0%, transparent 65%)", transform: "scale(1.3)" }} />
          <img src={EMBLEM_IMG} alt="Strategic Minds AI S emblem" className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44 object-contain drop-shadow-[0_0_25px_rgba(0,180,255,0.3)]" />
        </div>
        <h1 className={`text-center mb-4 transition-all duration-1000 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <img src={WORDMARK_IMG} alt="Strategic Minds AI" className="w-[280px] sm:w-[420px] lg:w-[640px] max-w-full object-contain mx-auto" />
        </h1>
        <div className={`flex items-center gap-3 sm:gap-4 mb-10 transition-all duration-1000 delay-500 ${mounted ? "opacity-100" : "opacity-0"}`}>
          <span className="h-px w-12 sm:w-24 bg-gradient-to-r from-transparent to-white/40" />
          <span className="text-xs sm:text-sm font-display font-semibold tracking-[0.35em] text-white/90 whitespace-nowrap">INTELLIGENCE IN MOTION</span>
          <span className="h-px w-12 sm:w-24 bg-gradient-to-l from-transparent to-white/40" />
        </div>
        <Link to="/client-onboarding" className={`group inline-flex items-center gap-3 px-8 sm:px-12 py-4 sm:py-5 rounded-full transition-all duration-300 hover:scale-105 ${mounted ? "opacity-100" : "opacity-0"}`} style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,180,255,0.06))", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 0 30px rgba(0,180,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.04)" }}>
          <span className="text-sm sm:text-base font-display font-bold tracking-[0.15em] text-white">BUILD SMARTER. GROW FASTER.</span>
          <span className="w-8 h-8 rounded-full flex items-center justify-center bg-[#00ff88]/15 border border-[#00ff88]/40 group-hover:bg-[#00ff88]/25 transition-all">
            <ArrowRight className="w-4 h-4 text-[#00ff88] group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      </section>

      {/* Earth Globe Divider */}
      <div className="relative z-0">
        <div className="relative w-full">
          <img src={EARTH_IMG} alt="" className="w-full h-auto opacity-70" style={{ maskImage: "linear-gradient(to top, black 30%, transparent 100%)", WebkitMaskImage: "linear-gradient(to top, black 30%, transparent 100%)" }} />
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1254 306" preserveAspectRatio="xMidYMid meet">
            <NetworkPath d="M104 230 Q276 56 464 205" />
            <NetworkPath d="M464 205 Q670 25 860 181" />
            <NetworkPath d="M860 181 Q1011 35 1171 232" />
            <NetworkPath d="M261 253 Q599 81 1015 253" />
            <circle cx="104" cy="230" r="3.6" fill="#00b4ff" className="animate-pulse" />
            <circle cx="464" cy="205" r="4" fill="#00b4ff" className="animate-pulse" />
            <circle cx="860" cy="181" r="3.8" fill="#00b4ff" className="animate-pulse" />
            <circle cx="1171" cy="232" r="3" fill="#00b4ff" className="animate-pulse" />
          </svg>
        </div>
      </div>

      {/* Platform Pillars */}
      <Section id="platform" eyebrow="THE PLATFORM" title="Four Pillars of Domination" subtitle="An autonomous enterprise-grade platform for digital domination, forensic search, and large-scale lead generation.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {PILLARS.map((p, i) => (
            <Link key={i} to={p.to} className="group p-6 rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm hover:border-[#00b4ff]/40 hover:bg-[#00b4ff]/[0.04] transition-all">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-[#00b4ff]/10 border border-[#00b4ff]/20 shrink-0 group-hover:bg-[#00b4ff]/20 transition-all">
                  <p.icon className="w-6 h-6 text-[#00b4ff]" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-lg mb-1.5 group-hover:text-[#00b4ff] transition-colors">{p.title}</h3>
                  <p className="text-sm text-white/60 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* Services Grid */}
      <Section id="services" eyebrow="CAPABILITIES" title="Autonomous Services" subtitle="Every capability engineered for scale, speed, and intelligence — operating without human gates.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((s, i) => (
            <Link key={i} to={s.to} className="group p-5 rounded-xl border border-white/8 bg-white/[0.015] hover:border-[#00ff88]/30 hover:bg-[#00ff88]/[0.03] transition-all">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 border border-white/10 mb-3 group-hover:border-[#00ff88]/30 transition-all">
                <s.icon className="w-5 h-5 text-white/70 group-hover:text-[#00ff88] transition-colors" />
              </div>
              <h3 className="font-display font-semibold text-base mb-1.5">{s.title}</h3>
              <p className="text-xs text-white/50 leading-relaxed">{s.desc}</p>
            </Link>
          ))}
        </div>
      </Section>

      {/* Stats Bar */}
      <div className="relative z-10 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STATS.map((s, i) => (
              <div key={i} className="text-center p-5 rounded-xl border border-white/8 bg-white/[0.02]">
                <div className="text-2xl sm:text-3xl font-heading font-bold text-gold-gradient mb-1">{s.value}</div>
                <div className="text-[10px] sm:text-xs font-display font-semibold tracking-widest text-white/50 uppercase">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Intelligence Pipeline Section */}
      <Section id="pipeline" eyebrow="THE PROCESS" title="12-Step Intelligence Pipeline" subtitle="From envisioning to deployment, every step compounds intelligence into actionable strategy.">
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {["ENVISION", "DISCOVER", "INGEST", "NORMALIZE", "BUYERS", "COMPETITORS", "SKIP TRACE", "SIMULATE", "BRAND", "STRATEGY", "DEPLOY", "SYNC"].map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-[10px] font-display font-bold tracking-widest text-white/70 hover:text-[#00b4ff] hover:border-[#00b4ff]/30 transition-all cursor-default">
                <span className="text-[#00b4ff]/60 mr-1.5">{String(i + 1).padStart(2, "0")}</span>{step}
              </div>
              {i < 11 && <ArrowRight className="w-3 h-3 text-white/20 hidden sm:block" />}
            </div>
          ))}
        </div>
        <div className="text-center">
          <Link to="/intelligence-command-center" className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-display font-bold tracking-wide text-white border border-white/15 bg-white/5 hover:bg-white/10 hover:border-[#00b4ff]/40 transition-all">
            <Sparkles className="w-4 h-4 text-[#00b4ff]" /> Launch Intelligence Pipeline
          </Link>
        </div>
      </Section>

      {/* Testimonials */}
      <Section id="testimonials" eyebrow="RESULTS" title="Trusted by Operators" subtitle="Real outcomes from autonomous intelligence deployed at scale.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="p-6 rounded-2xl border border-white/8 bg-white/[0.02] backdrop-blur-sm">
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="w-3.5 h-3.5 fill-[#00ff88] text-[#00ff88]" />
                ))}
              </div>
              <p className="text-sm text-white/70 leading-relaxed mb-4 italic">"{t.text}"</p>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00b4ff]/20 to-[#00ff88]/10 border border-white/10 flex items-center justify-center">
                  <span className="text-xs font-heading font-bold">{t.name.charAt(0)}</span>
                </div>
                <div>
                  <div className="text-sm font-display font-semibold">{t.name}</div>
                  <div className="text-[10px] text-white/40 tracking-wide">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <section className="relative z-10 py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative p-10 sm:p-14 rounded-3xl border border-[#00b4ff]/20 overflow-hidden" style={{ background: "radial-gradient(ellipse at center, rgba(0,180,255,0.06), transparent 70%)" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 0%, rgba(0,255,136,0.08), transparent 50%)" }} />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00ff88]/30 bg-[#00ff88]/5 mb-5">
                <TrendingUp className="w-3.5 h-3.5 text-[#00ff88]" />
                <span className="text-[10px] font-display font-bold tracking-widest text-[#00ff88]">READY TO DOMINATE</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-bold mb-4">Start Your Domination Campaign</h2>
              <p className="text-sm text-white/60 mb-8 max-w-xl mx-auto leading-relaxed">
                Onboard in minutes. Our autonomous factory runs the full 12-step intelligence pipeline, generates your build spec, and deploys your platform — all without human gates.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link to="/client-onboarding" className="group inline-flex items-center gap-3 px-8 py-4 rounded-full transition-all duration-300 hover:scale-105" style={{ background: "linear-gradient(135deg, rgba(0,180,255,0.15), rgba(0,255,136,0.08))", border: "1px solid rgba(0,180,255,0.4)", boxShadow: "0 0 30px rgba(0,180,255,0.15)" }}>
                  <span className="text-sm font-display font-bold tracking-wide text-white">BUILD SMARTER. GROW FASTER.</span>
                  <span className="w-7 h-7 rounded-full flex items-center justify-center bg-[#00ff88]/15 border border-[#00ff88]/40">
                    <ArrowRight className="w-3.5 h-3.5 text-[#00ff88] group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
                <Link to="/pricing" className="inline-flex items-center gap-2 px-6 py-4 rounded-full text-sm font-display font-bold tracking-wide text-white/80 border border-white/15 hover:border-white/30 hover:text-white transition-all">
                  View Pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/8 px-4 py-10">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center bg-white/5">
                <span className="font-heading font-bold text-xs">S</span>
              </div>
              <div>
                <div className="font-heading font-bold text-sm">STRATEGIC MINDS AI</div>
                <div className="text-[10px] text-white/40 tracking-widest">INTELLIGENCE IN MOTION</div>
              </div>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {NAV_LINKS.map((link) => (
                <Link key={link.label} to={link.to} className="text-[10px] font-display font-semibold tracking-widest text-white/50 hover:text-[#00b4ff] transition-colors">
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-[10px] text-white/30 tracking-wide">© 2026 Strategic Minds AI. Autonomous Intelligence Platform.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ id, eyebrow, title, subtitle, children }) {
  return (
    <section id={id} className="relative z-10 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00b4ff]/20 bg-[#00b4ff]/5 mb-4">
            <Layers className="w-3 h-3 text-[#00b4ff]" />
            <span className="text-[10px] font-display font-bold tracking-widest text-[#00b4ff]">{eyebrow}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-heading font-bold mb-3">{title}</h2>
          <p className="text-sm text-white/50 max-w-2xl mx-auto leading-relaxed">{subtitle}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function NetworkPath({ d }) {
  return (
    <>
      <path d={d} fill="none" stroke="rgba(0,180,255,0.15)" strokeWidth="1" />
      <path d={d} fill="none" stroke="rgba(0,180,255,0.6)" strokeWidth="1.5" strokeDasharray="4 8" className="animate-pulse" />
    </>
  );
}

function Starfield() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 70, size: Math.random() * 1.5 + 0.5, delay: Math.random() * 3,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {stars.map((s) => (
        <div key={s.id} className="absolute rounded-full bg-white animate-pulse" style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.size}px`, height: `${s.size}px`, opacity: 0.3 + Math.random() * 0.4, animationDelay: `${s.delay}s`, animationDuration: `${2 + Math.random() * 3}s` }} />
      ))}
    </div>
  );
}