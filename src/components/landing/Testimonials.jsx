import React from "react";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    quote: "The detailed periodic reports were very helpful so we could see the efforts and progress being made to locate the individual.",
    role: "Senior Trust Officer",
    location: "Manchester, NH",
    date: "October 14, 2026",
  },
  {
    quote: "Very satisfied with the service. Would recommend it to others. They located a person that had no credit history, no friends or family communication and no public records.",
    role: "Attorney",
    location: "Wellsboro, PA",
    date: "August 24, 2026",
  },
  {
    quote: "The team was great to work with throughout the entire process! They were communicative, gave proper expectations and were always friendly. Extremely impressed with their service!",
    role: "Attorney",
    location: "Wausau, WI",
    date: "August 5, 2026",
  },
  {
    quote: "Process and delivery of work product were excellent. Great experience. Everyone was a pleasure to work with. I appreciate the speed with which the team completed the search.",
    role: "Senior Trust Advisor",
    location: "West Palm Beach, FL",
    date: "June 4, 2026",
  },
  {
    quote: "Working with the team was easy and efficient. Their communication is great and research is very thorough. They helped locate beneficiaries in Florida and Honduras.",
    role: "Attorney",
    location: "Pasadena, CA",
    date: "April 16, 2026",
  },
  {
    quote: "We were stuck on locating one heir. They found them in one week. Case closed. No more billable hours wasted. We're saving 30-50 billable hours per estate.",
    role: "Estate Attorney",
    location: "Phoenix, AZ",
    date: "March 12, 2026",
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="py-20 lg:py-28 bg-[#faf8f3]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c9a961] mb-3">
            Testimonials
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#0a1f3c] leading-tight">
            Hear From Our Clients
          </h2>
          <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-[#c9a961] text-[#c9a961]" />
              ))}
            </div>
            <span className="text-sm font-semibold text-[#0a1f3c]">4.8/5</span>
            <span className="text-sm text-slate-500">· 209 reviews</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="rounded-xl p-7 bg-white border border-slate-200 hover:shadow-lg transition-shadow"
            >
              <Quote className="w-8 h-8 text-[#c9a961]/40 mb-4" />
              <p className="text-sm text-slate-700 leading-relaxed mb-6">{t.quote}</p>
              <div className="pt-4 border-t border-slate-100">
                <div className="font-semibold text-[#0a1f3c] text-sm">{t.role}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {t.location} · {t.date}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}