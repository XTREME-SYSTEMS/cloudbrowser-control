import React from "react";
import { DollarSign, ShieldCheck, Target, FileCheck2, Globe2 } from "lucide-react";

const pillars = [
  {
    n: "01",
    icon: DollarSign,
    title: "Reasonable Non-Percentage-Based Fees",
    body: "Our fees are quoted in advance and determined by a set fee schedule based on the type of search and your requirements — never as a percentage of the trust or estate.",
  },
  {
    n: "02",
    icon: ShieldCheck,
    title: "Authorized Search Services",
    body: "We never initiate a search without client consent or contractual arrangement. Courts look more favorably on agreements when the cost is known in advance.",
  },
  {
    n: "03",
    icon: Target,
    title: "97% Success Rate Since 1967",
    body: "Thanks to specialized education, training and experience, our research experts are highly qualified to find missing heirs and beneficiaries.",
  },
  {
    n: "04",
    icon: FileCheck2,
    title: "Documented Court-Ready Reports",
    body: "Our final report provides clear and convincing evidence, suitable for an exhibit in court. All supporting documentation is included in a concise format.",
  },
  {
    n: "05",
    icon: Globe2,
    title: "Worldwide Service",
    body: "We've located tens of thousands of missing heirs and lost beneficiaries in more than 65 countries. We succeed where other search firms often fail.",
  },
];

export default function Pillars() {
  return (
    <section id="pillars" className="py-20 lg:py-28 bg-[#0a1f3c] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, #c9a961 1px, transparent 0)",
        backgroundSize: "40px 40px",
      }} />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c9a961] mb-3">
            A Better Way
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl font-bold leading-tight">
            Our Five-Pillar Approach
          </h2>
          <p className="mt-4 text-slate-300 text-lg">
            Fulfill your fiduciary responsibility and satisfy the courts with our
            reasonable, authorized, and documented search services.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className={`rounded-xl p-7 bg-white/5 border border-white/10 backdrop-blur-sm hover:border-[#c9a961]/40 transition-all ${
                  i === 4 ? "md:col-span-2 lg:col-span-1" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-lg bg-[#c9a961]/15 border border-[#c9a961]/30 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-[#c9a961]" />
                  </div>
                  <span className="font-serif text-3xl font-bold text-white/15">{p.n}</span>
                </div>
                <h3 className="font-serif text-lg font-semibold mb-3 leading-snug">
                  {p.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}