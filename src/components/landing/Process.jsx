import React from "react";
import { ClipboardList, CreditCard, Download } from "lucide-react";

const steps = [
  {
    n: "01",
    icon: ClipboardList,
    title: "Tell Us About Your Case",
    body: "Tell us a little about your case using our free quote calculator, or simply contact us directly. We'll recommend the best package for your needs.",
  },
  {
    n: "02",
    icon: CreditCard,
    title: "Authorize the Search",
    body: "Once we inform you of the best package and fee for your case, you authorize the search. Fees are always quoted in advance — never a percentage.",
  },
  {
    n: "03",
    icon: Download,
    title: "Download Court-Ready Documents",
    body: "Communicate directly with your researcher and download all court-ready documents, affidavits, and supporting evidence from your client portal.",
  },
];

export default function Process() {
  return (
    <section id="process" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c9a961] mb-3">
            How It Works
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#0a1f3c] leading-tight">
            Our Three-Step Process
          </h2>
          <p className="mt-4 text-slate-600 text-lg">
            Completing an heir search with us is straightforward — three simple steps
            from intake to court-ready delivery.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-full h-px bg-gradient-to-r from-[#c9a961]/40 to-transparent" />
                )}
                <div className="relative flex flex-col items-start">
                  <div className="w-24 h-24 rounded-full bg-[#faf8f3] border-2 border-[#c9a961]/30 flex items-center justify-center mb-6 relative">
                    <Icon className="w-9 h-9 text-[#0a1f3c]" />
                    <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[#c9a961] text-white text-xs font-bold flex items-center justify-center font-serif">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-[#0a1f3c] mb-3">
                    {s.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}