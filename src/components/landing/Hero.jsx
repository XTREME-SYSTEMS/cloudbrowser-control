import React from "react";
import { ShieldCheck, Globe2, FileCheck2 } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden bg-gradient-to-b from-[#faf8f3] via-white to-white">
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, #0a1f3c 1px, transparent 0)",
        backgroundSize: "32px 32px",
      }} />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0a1f3c]/5 border border-[#0a1f3c]/10 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c9a961]" />
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0a1f3c]">
                Trusted Since 1967 · 97% Success Rate
              </span>
            </div>
            <h1 className="font-serif text-4xl lg:text-5xl xl:text-6xl font-bold text-[#0a1f3c] leading-[1.1] tracking-tight">
              We Find Missing Heirs{" "}
              <span className="text-[#c9a961] italic">A Better Way™</span>
            </h1>
            <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-xl">
              Protect your clients' legacies and satisfy the courts with our clear,
              convincing reports and transparent, non-percentage-based fees.
              Forensic genealogy for the legal and trust professions.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#quote"
                className="inline-flex items-center px-7 py-3.5 rounded-lg bg-[#0a1f3c] text-white font-semibold hover:bg-[#1a3a5c] transition-colors shadow-md"
              >
                Request a Free Quote
              </a>
              <a
                href="#services"
                className="inline-flex items-center px-7 py-3.5 rounded-lg bg-white text-[#0a1f3c] font-semibold border border-slate-300 hover:border-[#0a1f3c] transition-colors"
              >
                Explore Services
              </a>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-[#c9a961]" /> Authorized searches</span>
              <span className="flex items-center gap-2"><FileCheck2 className="w-4 h-4 text-[#c9a961]" /> Court-ready reports</span>
              <span className="flex items-center gap-2"><Globe2 className="w-4 h-4 text-[#c9a961]" /> 65+ countries</span>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] rounded-2xl overflow-hidden shadow-2xl bg-[#0a1f3c]">
              <img
                src="https://images.unsplash.com/photo-1589994965851-a8f479c573a8?w=800&q=80"
                alt="Genealogists reviewing estate research documents"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl p-5 border border-slate-100 max-w-[220px]">
              <div className="text-3xl font-serif font-bold text-[#0a1f3c]">65+</div>
              <div className="text-xs text-slate-500 mt-1">Countries where we've located heirs</div>
            </div>
            <div className="absolute -top-6 -right-6 bg-[#c9a961] rounded-xl shadow-xl p-5 text-white max-w-[200px]">
              <div className="text-3xl font-serif font-bold">97%</div>
              <div className="text-xs text-white/90 mt-1">Success rate since 1967</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}