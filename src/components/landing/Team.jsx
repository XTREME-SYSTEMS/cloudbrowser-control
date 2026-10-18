import React from "react";
import { Award, Globe2, Dna, BookOpen } from "lucide-react";

const researchers = [
  {
    name: "Quentin B.",
    role: "Lead Investigator",
    bio: "Former CIA case officer with 50+ years of investigative experience. Has handled cases for more than 200 clients in 30+ countries.",
    specialty: "International Investigation",
  },
  {
    name: "Megan R.",
    role: "Senior Genealogist",
    bio: "Retired corporate litigation partner with 20+ years in U.S. genealogical research. Expert in Colonial New England, Irish, and Italian lineages.",
    specialty: "DNA + Documentary Research",
  },
  {
    name: "Kim A.",
    role: "Qualitative Researcher",
    bio: "Doctoral degree in social sciences with a post-graduate diploma in genealogical studies. 10+ years as a professional genealogist.",
    specialty: "Metis & Native American",
  },
  {
    name: "Nancy P.",
    role: "Probate Specialist",
    bio: "PLCGS credentialed in Methodology and American Records. Reports are court-usable and available for expert testimony when required.",
    specialty: "American Records",
  },
];

const credentials = [
  { icon: Award, label: "ICAPGEN Accredited", value: "Since 1992" },
  { icon: Globe2, label: "Global Research Network", value: "45+ Experts" },
  { icon: Dna, label: "In-House DNA Experts", value: "Certified" },
  { icon: BookOpen, label: "Family History Library", value: "On-Site Access" },
];

export default function Team() {
  return (
    <section id="team" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-[#c9a961] mb-3">
            Who We Are
          </div>
          <h2 className="font-serif text-3xl lg:text-4xl font-bold text-[#0a1f3c] leading-tight">
            Our Professional Investigators
          </h2>
          <p className="mt-4 text-slate-600 text-lg">
            A team of certified genealogists, former intelligence officers, and legal
            research experts — trusted by law firms and estate professionals nationwide.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {researchers.map((r, i) => (
            <div
              key={i}
              className="rounded-xl p-6 bg-[#faf8f3] border border-slate-200 hover:border-[#c9a961] transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0a1f3c] to-[#1a3a5c] flex items-center justify-center text-[#c9a961] font-serif text-xl font-bold mb-4">
                {r.name.charAt(0)}
              </div>
              <h3 className="font-serif text-lg font-semibold text-[#0a1f3c]">{r.name}</h3>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#c9a961] mt-1 mb-3">
                {r.role}
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-3">{r.bio}</p>
              <div className="text-xs font-medium text-[#0a1f3c] pt-3 border-t border-slate-200">
                {r.specialty}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {credentials.map((c, i) => {
            const Icon = c.icon;
            return (
              <div
                key={i}
                className="flex items-center gap-3 p-4 rounded-lg bg-[#0a1f3c]/5 border border-[#0a1f3c]/10"
              >
                <Icon className="w-6 h-6 text-[#c9a961] shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-[#0a1f3c]">{c.label}</div>
                  <div className="text-xs text-slate-500">{c.value}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}