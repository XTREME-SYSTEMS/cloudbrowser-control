import React from "react";
import { Landmark, Vault, BellRing, Home, Users, FileText } from "lucide-react";

const services = [
  {
    icon: Landmark,
    title: "Estate Search",
    body: "Identify, locate, prove and report known and unknown heirs or beneficiaries, both domestically and internationally.",
  },
  {
    icon: Vault,
    title: "Trust Search",
    body: "Assist trustees, trust administrators, and their legal counsel in identifying and locating trust beneficiaries.",
  },
  {
    icon: BellRing,
    title: "Notice Search",
    body: "Help clients satisfy their fiduciary duty to notify heirs by supplying current contact information or documented due diligence.",
  },
  {
    icon: Home,
    title: "Property Search",
    body: "Identify, locate, prove and report heirs, successors and assigns on matters related to Clear and Quiet Title Actions.",
  },
  {
    icon: Users,
    title: "Class Action & Mass Tort",
    body: "Search services for class action suits, mass tort plaintiffs, and heirs of wrongful deaths.",
  },
  {
    icon: FileText,
    title: "Pension & Beneficiary",
    body: "Locate pension plan participants and identify all legally entitled heirs to a property before transfer.",
  },
];

export default function Services() {
  return (
    <section id="services" className="py-20 lg:py-28 bg-[#faf8f3]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c9a961] mb-3">
            What We Do
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#0a1f3c] leading-tight">
            Search Services
          </h2>
          <p className="mt-4 text-slate-600 text-lg">
            Our reasonable, non-percentage-based fees are based on search type and
            always quoted in advance.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="group rounded-xl p-7 bg-white border border-slate-200 hover:border-[#c9a961] hover:shadow-lg transition-all"
              >
                <div className="w-12 h-12 rounded-lg bg-[#0a1f3c]/5 border border-[#0a1f3c]/10 flex items-center justify-center group-hover:bg-[#0a1f3c] group-hover:border-[#0a1f3c] transition-colors">
                  <Icon className="w-6 h-6 text-[#0a1f3c] group-hover:text-[#c9a961] transition-colors" />
                </div>
                <h3 className="mt-5 font-serif text-xl font-semibold text-[#0a1f3c] mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
                <div className="mt-4 text-sm font-medium text-[#0a1f3c] group-hover:text-[#c9a961] transition-colors">
                  Learn more →
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}