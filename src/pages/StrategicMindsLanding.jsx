import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Phone } from "lucide-react";

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

export default function StrategicMindsLanding() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen bg-[#06080d] text-white overflow-x-hidden relative flex flex-col">
      {/* Nebula glow background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 50% at 50% 35%, rgba(0,180,255,0.08), transparent 60%), radial-gradient(ellipse 50% 40% at 50% 55%, rgba(0,255,136,0.05), transparent 60%)",
        }}
      />

      {/* Starfield */}
      <Starfield />

      {/* Top Navigation */}
      <header className="relative z-20 px-4 sm:px-6 lg:px-10 pt-5">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-full border border-white/20 flex items-center justify-center bg-white/5 backdrop-blur-sm">
              <span className="font-heading font-bold text-sm text-white">S</span>
            </div>
          </Link>

          {/* Center nav pill */}
          <nav className="hidden md:flex items-center gap-1 px-2 py-1.5 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                to={link.to}
                className="px-3.5 py-1.5 rounded-full text-[11px] font-display font-semibold tracking-widest text-white/70 hover:text-white hover:bg-white/5 transition-all"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href="tel:+18000000000"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-display font-bold tracking-widest text-[#00ff88] border border-[#00ff88]/40 bg-[#00ff88]/5 hover:bg-[#00ff88]/10 transition-all"
            >
              <Phone className="w-3 h-3" /> CALL EDEN
            </a>
            <Link
              to="/client-onboarding"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-display font-bold tracking-widest text-[#00b4ff] border border-[#00b4ff]/40 bg-[#00b4ff]/5 hover:bg-[#00b4ff]/10 transition-all"
            >
              CALL NOW
            </Link>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden mt-3 flex items-center gap-1 px-2 py-1.5 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md overflow-x-auto xa-scroll">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              className="px-3 py-1.5 rounded-full text-[10px] font-display font-semibold tracking-widest text-white/70 hover:text-white hover:bg-white/5 transition-all whitespace-nowrap"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12 sm:py-16">
        {/* Emblem */}
        <div
          className={`relative mb-6 transition-all duration-1000 ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}
        >
          {/* Blue light ring behind emblem */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(0,180,255,0.25) 0%, transparent 65%)",
              transform: "scale(1.3)",
            }}
          />
          <img
            src={EMBLEM_IMG}
            alt="Strategic Minds AI S emblem"
            className="relative w-28 h-28 sm:w-36 sm:h-36 lg:w-44 lg:h-44 object-contain drop-shadow-[0_0_25px_rgba(0,180,255,0.3)]"
          />
        </div>

        {/* Wordmark */}
        <h1
          className={`text-center mb-4 transition-all duration-1000 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
        >
          <img
            src={WORDMARK_IMG}
            alt="Strategic Minds AI"
            className="w-[280px] sm:w-[420px] lg:w-[640px] max-w-full object-contain mx-auto"
          />
        </h1>

        {/* Tagline with flanking lines */}
        <div
          className={`flex items-center gap-3 sm:gap-4 mb-10 transition-all duration-1000 delay-500 ${mounted ? "opacity-100" : "opacity-0"}`}
        >
          <span className="h-px w-12 sm:w-24 bg-gradient-to-r from-transparent to-white/40" />
          <span className="text-xs sm:text-sm font-display font-semibold tracking-[0.35em] text-white/90 whitespace-nowrap">
            INTELLIGENCE IN MOTION
          </span>
          <span className="h-px w-12 sm:w-24 bg-gradient-to-l from-transparent to-white/40" />
        </div>

        {/* Main CTA */}
        <Link
          to="/client-onboarding"
          className={`group inline-flex items-center gap-3 px-8 sm:px-12 py-4 sm:py-5 rounded-full transition-all duration-300 hover:scale-105 ${mounted ? "opacity-100" : "opacity-0"}`}
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(0,180,255,0.06))",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 0 30px rgba(0,180,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.04)",
          }}
        >
          <span className="text-sm sm:text-base font-display font-bold tracking-[0.15em] text-white">
            BUILD SMARTER. GROW FASTER.
          </span>
          <span className="w-8 h-8 rounded-full flex items-center justify-center bg-[#00ff88]/15 border border-[#00ff88]/40 group-hover:bg-[#00ff88]/25 transition-all">
            <ArrowRight className="w-4 h-4 text-[#00ff88] group-hover:translate-x-0.5 transition-transform" />
          </span>
        </Link>
      </main>

      {/* Earth Globe Footer */}
      <div className="relative z-0 mt-auto">
        <div className="relative w-full">
          <img
            src={EARTH_IMG}
            alt=""
            className="w-full h-auto opacity-80"
            style={{ maskImage: "linear-gradient(to top, black 40%, transparent 100%)", WebkitMaskImage: "linear-gradient(to top, black 40%, transparent 100%)" }}
          />
          {/* Network overlay SVG */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 1254 306"
            preserveAspectRatio="xMidYMid meet"
          >
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
        {/* Bottom gradient blend */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#06080d] to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

function NetworkPath({ d }) {
  return (
    <>
      <path d={d} fill="none" stroke="rgba(0,180,255,0.15)" strokeWidth="1" />
      <path
        d={d}
        fill="none"
        stroke="rgba(0,180,255,0.6)"
        strokeWidth="1.5"
        strokeDasharray="4 8"
        className="animate-pulse"
      />
    </>
  );
}

function Starfield() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 70,
    size: Math.random() * 1.5 + 0.5,
    delay: Math.random() * 3,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white animate-pulse"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: 0.3 + Math.random() * 0.4,
            animationDelay: `${s.delay}s`,
            animationDuration: `${2 + Math.random() * 3}s`,
          }}
        />
      ))}
    </div>
  );
}