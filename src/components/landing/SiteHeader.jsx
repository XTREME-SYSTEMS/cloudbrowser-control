import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Menu, X, Scale } from "lucide-react";

const navLinks = [
  { label: "Services", href: "#services" },
  { label: "Process", href: "#process" },
  { label: "Our Approach", href: "#pillars" },
  { label: "Team", href: "#team" },
  { label: "Success Stories", href: "#testimonials" },
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0a1f3c] to-[#1a3a5c] flex items-center justify-center shadow-md">
              <Scale className="w-5 h-5 text-[#c9a961]" />
            </div>
            <div className="leading-tight">
              <div className="font-serif text-lg font-bold text-[#0a1f3c] tracking-tight">
                Strategic Cloud Browser
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#c9a961] font-semibold">
                Heir Search · Probate Genealogy
              </div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-slate-600 hover:text-[#0a1f3c] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-600 hover:text-[#0a1f3c] px-4 py-2 transition-colors"
            >
              Client Login
            </Link>
            <a
              href="#quote"
              className="inline-flex items-center px-5 py-2.5 rounded-lg bg-[#0a1f3c] text-white text-sm font-semibold hover:bg-[#1a3a5c] transition-colors shadow-sm"
            >
              Request a Quote
            </a>
          </div>

          <button
            className="lg:hidden p-2 text-[#0a1f3c]"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="lg:hidden bg-white border-t border-slate-200 shadow-lg">
          <div className="px-6 py-4 space-y-3">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block text-sm font-medium text-slate-700 hover:text-[#0a1f3c]"
              >
                {l.label}
              </a>
            ))}
            <Link to="/login" className="block text-sm font-medium text-slate-700">
              Client Login
            </Link>
            <a
              href="#quote"
              onClick={() => setOpen(false)}
              className="block text-center px-5 py-2.5 rounded-lg bg-[#0a1f3c] text-white text-sm font-semibold"
            >
              Request a Quote
            </a>
          </div>
        </div>
      )}
    </header>
  );
}